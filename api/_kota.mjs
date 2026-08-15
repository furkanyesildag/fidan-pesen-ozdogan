/*
 * _kota.mjs — kötüye kullanım koruması
 * ---------------------------------------------------------------------------
 * Asistan artık dogalmarkam.com'da da açık olduğu için uç nokta herkese görünür.
 * Buradaki asıl risk gizlilik değil PARA: her istek DeepSeek'te ücretlendiriliyor.
 * Bir betik dakikada yüzlerce istek atarsa bakiye bir gecede biter.
 *
 * Önceki hız sınırı süreç belleğindeki bir Map'ti. Sunucusuz ortamda her örnek
 * kendi belleğini taşır ve örnekler ölçeklendikçe çoğalır; yani "dakikada 12"
 * gerçekte "örnek başına dakikada 12" demekti ve kolayca aşılıyordu.
 *
 * Redis varsa sayaçlar orada tutulur ve sınır gerçekten uygulanır. Yoksa
 * bellek yedeği devreye girer: kusurlu ama hiç yoktan iyidir. Kurulum için
 * UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN (ya da KV_REST_API_URL /
 * KV_REST_API_TOKEN) yeterlidir.
 *
 * Katmanlar:
 *   1. köken denetimi   — tarayıcıdan gelen istek izinli siteden mi
 *   2. kaba bot elemesi — istemci imzası olmayan istekler
 *   3. kişi başı sınır  — dakika / saat / gün
 *   4. oturum sınırı    — tek sekmeden gelen aşırı kullanım
 *   5. genel gün sınırı — toplam harcama tavanı, sigorta niteliğinde
 *   6. tekrar elemesi   — aynı mesajın art arda gönderilmesi
 * ---------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto';

const KOK = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const JETON = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
export const REDIS_VAR = Boolean(KOK && JETON);

/* Sınırlar. Ortam değişkeniyle değiştirilebilir ki kampanya günlerinde
   kod dokunmadan gevşetilebilsin. */
const sayi = (ad, varsayilan) => Number(process.env[ad]) || varsayilan;
export const SINIR = {
  dakika:   sayi('KOTA_DAKIKA', 8),
  saat:     sayi('KOTA_SAAT', 80),
  gun:      sayi('KOTA_GUN', 250),
  oturum:   sayi('KOTA_OTURUM', 150),
  genelGun: sayi('KOTA_GENEL_GUN', 4000),
};

const ozet = (m) =>
  createHash('sha256').update(String(m) + (process.env.KAYIT_TUZU || 'fpo')).digest('hex').slice(0, 16);

/* ------------------------------------------------------------------- Redis */
async function boruHatti(komutlar) {
  const y = await fetch(`${KOK}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(komutlar),
  });
  if (!y.ok) throw new Error(`Redis ${y.status}`);
  return (await y.json()).map((x) => x.result);
}

/* ------------------------------------------------------- bellek yedeği */
const bellek = new Map();
function bellekArtir(anahtar, saniye) {
  const simdi = Date.now();
  const k = bellek.get(anahtar);
  if (!k || simdi - k.bas > saniye * 1000) {
    bellek.set(anahtar, { adet: 1, bas: simdi });
    if (bellek.size > 5000) bellek.clear();
    return 1;
  }
  k.adet++;
  return k.adet;
}

/* --------------------------------------------------------------- yardımcı */
const bugun = () => new Date().toISOString().slice(0, 10);

/** İzinli kökenler. CORS yalnızca tarayıcıyı bağlar; curl her başlığı
 *  taklit edebilir. Yine de kaba trafiği eler ve niyeti belgeler. */
export const IZINLI_KOKEN = new Set([
  'https://fidanpesen.com',
  'https://www.fidanpesen.com',
  'https://dogalmarkam.com',
  'https://www.dogalmarkam.com',
  'https://fidan-pesen-ozdogan.vercel.app',
]);

export function kokenTamam(req) {
  const koken = req.headers.origin;
  if (koken) return IZINLI_KOKEN.has(koken);
  /* Kökeni olmayan istek: tarayıcı dışı çağrı. Yönlendiren başlığı izinli
     alan adlarından biriyse geçer, değilse reddedilir. */
  const yonlendiren = req.headers.referer || '';
  if (!yonlendiren) return false;
  return [...IZINLI_KOKEN].some((k) => yonlendiren.startsWith(k));
}

/** Gerçek tarayıcıların hepsinde bulunan başlıkların yokluğu, isteğin
 *  betikten geldiğini gösterir. Kesin değil ama en ucuz elemedir. */
export function botMu(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (ua.length < 20) return true;
  return /\b(curl|wget|python-requests|httpie|go-http|axios\/|scrapy|bot|spider|headless)\b/i.test(ua);
}

/**
 * Bütün sayaçları tek turda artırır ve hangisinin aşıldığını söyler.
 * @returns {Promise<{gecti: boolean, sebep?: string, bekle?: number}>}
 */
export async function kotaKontrol({ ip, oturum, sonMesaj }) {
  const kisi = ozet(ip);
  const gun = bugun();
  const anahtarlar = [
    [`kota:dk:${kisi}`, 60, SINIR.dakika, 'dakika'],
    [`kota:sa:${kisi}`, 3600, SINIR.saat, 'saat'],
    [`kota:gn:${kisi}:${gun}`, 86400, SINIR.gun, 'gün'],
    [`kota:ot:${ozet(oturum)}:${gun}`, 86400, SINIR.oturum, 'oturum'],
    [`kota:genel:${gun}`, 86400, SINIR.genelGun, 'genel'],
  ];

  let sayilar;
  if (REDIS_VAR) {
    try {
      const komut = [];
      for (const [a, sn] of anahtarlar) { komut.push(['INCR', a]); komut.push(['EXPIRE', a, sn]); }
      /* Aynı mesajın art arda gönderilmesi: kısa ömürlü bir imza tutulur. */
      const imza = `kota:tekrar:${kisi}:${ozet(sonMesaj).slice(0, 8)}`;
      komut.push(['INCR', imza]); komut.push(['EXPIRE', imza, 120]);
      const sonuc = await boruHatti(komut);
      sayilar = anahtarlar.map((_, i) => Number(sonuc[i * 2]));
      const tekrar = Number(sonuc[sonuc.length - 2]);
      if (tekrar > 3) return { gecti: false, sebep: 'tekrar', bekle: 120 };
    } catch {
      sayilar = null;                         // Redis düşerse bellek yedeğine geç
    }
  }
  if (!sayilar) {
    sayilar = anahtarlar.map(([a, sn]) => bellekArtir(a, sn));
  }

  for (let i = 0; i < anahtarlar.length; i++) {
    const [, sn, tavan, ad] = anahtarlar[i];
    if (sayilar[i] > tavan) return { gecti: false, sebep: ad, bekle: sn };
  }
  return { gecti: true };
}

export const SINIR_MESAJI = {
  dakika: 'Çok hızlı yazıyorsunuz. Bir dakika bekleyip tekrar deneyin.',
  saat: 'Bu saat için soru hakkınız doldu. Biraz sonra devam edebilir ya da ' +
        'WhatsApp destek hattımıza (+90 533 632 03 13) yazabilirsiniz.',
  gün: 'Bugünlük soru hakkınız doldu. Yarın devam edebilir ya da WhatsApp ' +
       'destek hattımıza (+90 533 632 03 13) yazabilirsiniz.',
  oturum: 'Bu sohbet için soru hakkı doldu. Yeni bir sekmede devam edebilir ya da ' +
          'WhatsApp destek hattımıza (+90 533 632 03 13) yazabilirsiniz.',
  tekrar: 'Aynı mesajı üst üste gönderdiniz. Biraz farklı yazar mısınız?',
  genel: 'Asistan şu an çok yoğun. Kısa süre sonra tekrar deneyin ya da ' +
         'WhatsApp destek hattımıza (+90 533 632 03 13) yazabilirsiniz.',
};

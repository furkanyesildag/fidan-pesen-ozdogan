/*
 * api/sohbet.js — Fidan'ın Asistanı sohbet uç noktası
 * ---------------------------------------------------------------------------
 * Neden sunucu tarafı: DeepSeek API anahtarı tarayıcıya ASLA gönderilemez.
 * Tarayıcıdan çağrılsaydı anahtar herkese açık olurdu ve bakiye boşaltılırdı.
 * Anahtar yalnızca Vercel ortam değişkeninde durur (DEEPSEEK_API_KEY) ve
 * depoda bulunmaz.
 *
 * Akış: istemci mesaj geçmişini yollar → ilgili ürünler katalogdan seçilir →
 * sistem istemi kurulur → DeepSeek'ten yanıt akış hâlinde alınır → SSE ile
 * istemciye aktarılır → konuşma kaydedilir.
 * ---------------------------------------------------------------------------
 */
import { urunGetir, guvenlikTara, istemKur, URUNLER } from './_istem.mjs';
import { kaydet } from './_kayit.mjs';

const API = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const AZAMI_MESAJ = 24;          // geçmişte tutulacak azami mesaj
const AZAMI_UZUNLUK = 1500;      // tek mesajda azami karakter

/* Çok kaba bir hız sınırı: aynı IP dakikada 12 istekten fazlasını yapamaz.
   Sunucusuz örnekler arasında paylaşılmaz ama kötüye kullanımın önünü keser. */
const pencere = new Map();
function hizSiniri(ip) {
  const simdi = Date.now();
  const kayit = pencere.get(ip) ?? { adet: 0, bas: simdi };
  if (simdi - kayit.bas > 60000) { kayit.adet = 0; kayit.bas = simdi; }
  kayit.adet++;
  pencere.set(ip, kayit);
  if (pencere.size > 500) pencere.clear();
  return kayit.adet <= 12;
}

const ACIL_YANIT =
  'Yazdıklarınız acil tıbbi değerlendirme gerektirebilecek belirtiler içeriyor. ' +
  'Lütfen vakit kaybetmeden **112 Acil**\'i arayın ya da en yakın acil servise ' +
  'başvurun.\n\nBu durumda size ürün öneremem; şu an yapılması gereken tek şey ' +
  'bir sağlık kuruluşuna ulaşmanız. Geçmiş olsun.';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ hata: 'Yalnızca POST' }); return; }

  const anahtar = process.env.DEEPSEEK_API_KEY;
  if (!anahtar) {
    res.status(500).json({ hata: 'Sunucu yapılandırılmamış: DEEPSEEK_API_KEY tanımlı değil.' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'bilinmeyen';
  if (!hizSiniri(ip)) {
    res.status(429).json({ hata: 'Çok fazla istek. Bir dakika sonra tekrar deneyin.' });
    return;
  }

  let govde = req.body;
  if (typeof govde === 'string') { try { govde = JSON.parse(govde); } catch { govde = {}; } }
  const gelen = Array.isArray(govde?.mesajlar) ? govde.mesajlar : [];
  const oturum = String(govde?.oturum || '').slice(0, 40) || 'oturumsuz';

  const mesajlar = gelen
    .filter((m) => m && (m.rol === 'kullanici' || m.rol === 'asistan') && typeof m.metin === 'string')
    .slice(-AZAMI_MESAJ)
    .map((m) => ({
      role: m.rol === 'kullanici' ? 'user' : 'assistant',
      content: m.metin.slice(0, AZAMI_UZUNLUK),
    }));

  if (!mesajlar.length || mesajlar[mesajlar.length - 1].role !== 'user') {
    res.status(400).json({ hata: 'Geçerli bir kullanıcı mesajı gerekli.' });
    return;
  }

  const sonMesaj = mesajlar[mesajlar.length - 1].content;
  const tumMetin = mesajlar.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  const guvenlik = guvenlikTara(tumMetin);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const gonder = (tur, veri) => {
    res.write(`event: ${tur}\ndata: ${JSON.stringify(veri)}\n\n`);
  };

  /* --- acil durum: modele hiç gitmeden sabit yanıt --- */
  if (guvenlik.acil) {
    gonder('parca', ACIL_YANIT);
    gonder('bitti', { urunler: [], acil: true });
    res.end();
    await kaydet({ oturum, ip, mesajlar, yanit: ACIL_YANIT, acil: true, urunler: [] });
    return;
  }

  /* --- ürün getirme: son mesaj ağırlıklı, geçmiş destekleyici --- */
  const secilen = urunGetir(`${sonMesaj} ${sonMesaj} ${tumMetin}`, 10);
  const sistem = istemKur(secilen, guvenlik.uyari);

  let tamYanit = '';
  try {
    const yanit = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anahtar}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.6,
        max_tokens: 900,
        messages: [{ role: 'system', content: sistem }, ...mesajlar],
      }),
    });

    if (!yanit.ok || !yanit.body) {
      const hataMetni = await yanit.text().catch(() => '');
      throw new Error(`DeepSeek ${yanit.status}: ${hataMetni.slice(0, 200)}`);
    }

    const okuyucu = yanit.body.getReader();
    const cozucu = new TextDecoder();
    let tampon = '';

    while (true) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      tampon += cozucu.decode(value, { stream: true });
      const satirlar = tampon.split('\n');
      tampon = satirlar.pop() ?? '';
      for (const satir of satirlar) {
        const s = satir.trim();
        if (!s.startsWith('data:')) continue;
        const yuk = s.slice(5).trim();
        if (yuk === '[DONE]') continue;
        try {
          const j = JSON.parse(yuk);
          const parca = j.choices?.[0]?.delta?.content;
          if (parca) { tamYanit += parca; gonder('parca', parca); }
        } catch { /* yarım kalan JSON, sonraki turda tamamlanır */ }
      }
    }
  } catch (e) {
    const mesaj = 'Şu an bağlantıda bir sorun var. Birazdan tekrar deneyebilir ya da ' +
      'doğrudan WhatsApp destek hattımıza (+90 533 632 03 13) yazabilirsiniz.';
    gonder('parca', tamYanit ? '\n\n' + mesaj : mesaj);
    gonder('hata', { mesaj: String(e.message).slice(0, 200) });
    tamYanit += mesaj;
  }

  /* --- ÜRÜN: satırlarını karta çevir --- */
  const adlar = [...tamYanit.matchAll(/^\s*ÜRÜN:\s*(.+?)\s*$/gm)].map((m) => m[1]);
  const kartlar = [];
  for (const ad of adlar) {
    const u = URUNLER.find((x) => x.ad === ad)
      || URUNLER.find((x) => x.ad.toLocaleLowerCase('tr').includes(ad.toLocaleLowerCase('tr')))
      || secilen.find((x) => x.ad.toLocaleLowerCase('tr').includes(ad.toLocaleLowerCase('tr')));
    if (u && !kartlar.some((k) => k.bag === u.bag)) {
      kartlar.push({ ad: u.ad, kategori: u.kategori, bag: u.bag, gorsel: u.gorsel, fiyat: u.fiyat });
    }
  }

  gonder('bitti', { urunler: kartlar.slice(0, 3), uyari: guvenlik.uyari });
  res.end();

  await kaydet({
    oturum, ip, mesajlar,
    yanit: tamYanit,
    urunler: kartlar.map((k) => k.ad),
    uyari: guvenlik.uyari,
    acil: false,
  });
}

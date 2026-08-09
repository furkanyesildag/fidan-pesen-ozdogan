/*
 * _istem.mjs — asistanın sistem istemi ve ürün getirme mantığı
 * ---------------------------------------------------------------------------
 * Yalnızca sunucuda çalışır (api/ altında alt çizgiyle başlayan dosyalar uç
 * nokta olarak yayınlanmaz).
 * ---------------------------------------------------------------------------
 */
import { URUNLER, KATEGORILER } from './_urunler.mjs';

/* ---------------------------------------------------------- sadeleştirme */
export function sade(m) {
  return String(m ?? '')
    .replace(/I/g, 'ı').replace(/İ/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const govde = (k) => (k.length > 5 ? k.slice(0, Math.max(4, k.length - 2)) : k);

/* ------------------------------------------------------------- güvenlik */
export const ACIL = [
  'gogus agrisi', 'gogsumde agri', 'nefes darligi', 'nefes alamiyorum',
  'nefes alamiyor', 'bayildim', 'bayiliyorum', 'bilinc kaybi', 'felc gecirdim',
  'inme gecirdim', 'konusamiyorum', 'yuzum kaydi', 'siddetli bas agrisi',
  'durmayan kanama', 'kan kusma', 'kanli kusma', 'intihar', 'kendime zarar',
  'yasamak istemiyorum', 'zehirlenme', 'anafilaksi', 'alerjik sok',
  'havale gecirdi', 'kalp krizi', 'ani gorme kaybi'
];
export const DIKKAT = [
  { k: ['hamile', 'gebe', 'gebelik', 'hamilelik'], n: 'gebelik' },
  { k: ['emzir', 'sut veriyorum'], n: 'emzirme' },
  { k: ['bebek', 'yenidogan', 'bebegim'], n: 'bebek' },
  { k: ['cocugum', 'cocuk icin', 'yasindaki'], n: 'çocuk' },
  { k: ['kanser', 'tumor', 'kemoterapi', 'radyoterapi'], n: 'onkolojik tedavi' },
  { k: ['bobrek yetmezligi', 'diyaliz', 'karaciger yetmezligi', 'siroz'], n: 'organ yetmezliği' },
  { k: ['kan sulandirici', 'warfarin', 'kumadin', 'insulin', 'antidepresan',
    'tansiyon ilaci', 'tiroid ilaci', 'ilac kullaniyorum', 'ilac kullaniyor'], n: 'düzenli ilaç kullanımı' },
  { k: ['ameliyat olacagim', 'ameliyat oldum'], n: 'ameliyat' },
  { k: ['seker hastasi', 'diyabet'], n: 'diyabet' }
];

export function guvenlikTara(metin) {
  const n = sade(metin);
  const acil = ACIL.some((a) => n.includes(a));
  const uyari = DIKKAT.filter((d) => d.k.some((k) => n.includes(k))).map((d) => d.n);
  return { acil, uyari };
}

/* --------------------------------------------------- niyet sözlüğü */
const NIYET = [
  { d: ['sac dokul', 'sacim dokul', 'kellik', 'sac seyrel', 'sac azal', 'dokulme'], a: ['sac', 'dokulme', 'serum', 'sampuan', 'dolgunlastirici', 'borbone'] },
  { d: ['kepek'], a: ['kepek', 'sampuan', 'sac'] },
  { d: ['sivilce', 'akne', 'siyah nokta'], a: ['akne', 'sivilce', 'temizlik', 'krem'] },
  { d: ['leke', 'melasma', 'koyu'], a: ['leke', 'beyazlatici', 'krem'] },
  { d: ['kirisik', 'yaslanma', 'ince cizgi', 'sarkma'], a: ['kirisiklik', 'serum', 'krem'] },
  { d: ['goz alti', 'morluk', 'torbalanma', 'goz cevresi'], a: ['goz', 'morluk', 'torbalanma'] },
  { d: ['kuru cilt', 'cildim kuru', 'nemlendir'], a: ['nemlendirici', 'nem', 'krem'] },
  { d: ['yagli cilt', 'gozenek', 'parlama'], a: ['gozenekli', 'temizlik'] },
  { d: ['kizarik', 'rozasea', 'rozali', 'hassas cilt'], a: ['rozali', 'kizariklik'] },
  { d: ['gunes'], a: ['gunes', 'koruyucu', 'krem'] },
  { d: ['ter kokusu', 'koltuk alti', 'terleme', 'deodorant'], a: ['deo', 'koltuk'] },
  { d: ['sindirim', 'gaz', 'siskinlik', 'hazimsizlik', 'mide'], a: ['sindirim', 'mide', 'rezene'] },
  { d: ['uyku', 'uyuyamiyorum', 'stres', 'kaygi'], a: ['huzur', 'uyku'] },
  { d: ['yorgun', 'halsiz', 'bagisiklik', 'enerji'], a: ['kuvvet', 'bagisiklik'] },
  { d: ['eklem', 'kirec', 'diz agri', 'romatizma'], a: ['eklem', 'borjoint'] },
  { d: ['oksuruk', 'bogaz', 'balgam', 'solunum'], a: ['nefes', 'okaliptus', 'adacay'] },
  { d: ['karaciger', 'safra'], a: ['karahindiba', 'enginar'] },
  { d: ['prostat', 'idrar'], a: ['isirgan', 'prostat'] },
  { d: ['tiroit', 'tiroid', 'guatr'], a: ['tiroit', 'ceviz'] },
  { d: ['unutkanlik', 'hafiza', 'odaklan'], a: ['hafiza', 'ginseng'] },
  { d: ['menopoz', 'adet', 'regl'], a: ['kadin', 'menopoz'] },
  { d: ['ucucu yag', 'esansiyel'], a: ['ucucu', 'yag'] },
  { d: ['sabit yag', 'tasiyici yag'], a: ['sabit', 'yag'] },
  { d: ['bitki cayi', 'bitkisel cay'], a: ['bitki', 'cay'] }
];

/* Ürünleri konuşmaya göre puanlar, en alakalı N tanesini döner. */
export function urunGetir(metin, adet = 10) {
  const n = sade(metin);
  const kelime = n.split(' ').filter((k) => k.length > 2).map(govde);
  let ek = [];
  for (const g of NIYET) if (g.d.some((x) => n.includes(x))) ek = ek.concat(g.a.map(govde));
  const hepsi = kelime.concat(ek, ek);       // niyet anahtarları iki kez sayılır
  if (!hepsi.length) return [];

  return URUNLER
    .map((u) => {
      const havuz = (u.anahtar ?? []).map(govde);
      const kat = sade(u.kategori);
      let p = 0;
      for (const k of hepsi) {
        if (havuz.includes(k)) p += 3;
        else if (havuz.some((h) => h.startsWith(k) || k.startsWith(h))) p += 1;
        if (kat.includes(k)) p += 2;
      }
      if (!u.stokta) p -= 2;
      return { u, p };
    })
    .filter((x) => x.p > 2)
    .sort((a, b) => b.p - a.p)
    .slice(0, adet)
    .map((x) => x.u);
}

/* ------------------------------------------------------------ istem */
const KIMLIK = `
Sen "Fidan'ın Asistanı"sın. Dr. Ecz. Fidan Pesen Özdoğan'ın markası Doğal
Markam'ın dijital danışma asistanısın.

KİMLİĞİN
- Sen Fidan Hanım'ın kendisi değilsin; onun yaklaşımıyla çalışan otomatik bir
  asistansın. Sana doğrudan "sen Fidan Pesen misin?" diye sorulursa dürüstçe
  "Hayır, ben Fidan Hanım'ın asistanıyım" de. Bunu her mesajda tekrarlama.
- Fidan Hanım kimdir: Hacettepe Eczacılık mezunu, Gazi Üniversitesi'nde
  fitoterapi yüksek lisansı yapmış Uzman Eczacı, Geleneksel ve Tamamlayıcı Tıp
  bilim doktoru. Uygurca ve Osmanlı Türkçesi bilir, geleneksel Uygur tıbbı
  kaynakları üzerine çalışır. Doğal Markam ürünlerinin formülasyonlarını
  bizzat o tasarlar.
- Onun bakış açısını taşırsın: eczacılığın etken madde bilgisi ile geleneksel
  tıbbın mizaç anlayışı (safravi/ateş, demevi/hava, balgami/su, sevdavi/toprak)
  bir arada.

ÜSLUBUN
- Türkçe, sıcak ama profesyonel. Karşındaki insana değer verdiğini hissettir.
- Kısa paragraflar, sade cümleler. Uzun uzun anlatma.
- Abartılı samimiyet ("canım", "kardeşim") ve emoji yığını kullanma. En fazla
  bir tane, yeri geldiyse.
- Asla robotik liste dökme; konuşur gibi yaz.

KONUŞMA AKIŞIN
1. İlk mesajda ürün satmaya çalışma. Önce kişiyi ve durumunu anla.
2. Anlamak için en fazla 2-3 soru sor, hepsini birden değil, sırayla.
   Sorabileceklerin: ne kadar süredir devam ediyor, daha önce ne denendi,
   cilt/saç tipi, yaş aralığı, gebelik-emzirme durumu, düzenli kullanılan ilaç.
3. Yeterince bilgi toplayınca 1-3 ürün öner. Her biri için NEDEN o ürünü
   seçtiğini içeriğine dayanarak açıkla. Ezber cümle kurma.
4. Nasıl kullanılacağını ve ne kadar süre kullanılması gerektiğini söyle.
5. Sonunda destek hattını hatırlat.
`.trim();

const KURALLAR = `
ÜRÜN KURALLARI
- SADECE aşağıdaki katalogda verilen ürünleri önerebilirsin. Katalog dışında
  hiçbir marka, eczane ürünü, jenerik takviye veya bitki önerme.
- Aradığı şey katalogda yoksa bunu kısaca söyle ve HEMEN WhatsApp hattına
  yönlendir: ekibimiz kişiye özel çözüm çıkarabilir.
- Fiyat söyleyeceksen yalnızca katalogdaki fiyatı söyle.
- ZORUNLU: Metninde bir ürün adı geçiriyorsan, mesajının EN SONUNA o ürünü
  ayrı bir satır olarak MUTLAKA şu biçimde yazacaksın (en fazla 3 tane):
  ÜRÜN: <katalogdaki tam ürün adı>
  Bu satırlar kullanıcıya gösterilmez; arayüz onları tıklanabilir ürün kartına
  çevirir. Bu satırı yazmazsan kullanıcı ürüne ulaşamaz. Ürün adını katalogdaki
  gibi harfi harfine kopyala, kısaltma, değiştirme. Hiç ürün anmadıysan bu
  satırları yazma.

YÖNLENDİRME KURALI (ÇOK ÖNEMLİ)
- Tek yönlendirme adresin Doğal Markam WhatsApp destek hattıdır:
  https://wa.me/905336320313 (+90 533 632 03 13)
- Bilmediğin, emin olmadığın, katalogda karşılığı olmayan, kişiye özel
  değerlendirme isteyen HER konuda bu hatta yönlendir.
- Sipariş, kargo, iade, stok, kampanya, toplu alım, kullanım süresi, birlikte
  kullanım gibi tüm sorularda da bu hatta yönlendir.
- Eczane, hastane, doktor, dermatolog, başka bir web sitesi veya başka bir
  marka ÖNERME. "Bir uzmana görünün", "doktorunuza sorun", "eczanenizden
  alabilirsiniz" gibi cümleler KURMA. Bunun yerine ekibimize yönlendir.
- Tek istisna aşağıdaki ACİL DURUM maddesidir.
- Yönlendirirken kuru olma; ekibin kişiye özel yardım edeceğini, kullanım
  boyunca yanında olacağını sıcak bir dille söyle.

DİL VE İDDİA SINIRI
- Teşhis koyma, hastalık adı söyleme, tahlil yorumlama.
- "Tedavi eder", "iyileştirir", "geçirir", "şifa olur" gibi ifadeler kullanma;
  bunlar takviye edici gıda ve kozmetik mevzuatına aykırıdır ve markayı riske
  atar. Bunun yerine "içeriğindeki ... ile ... desteklemek üzere hazırlandı"
  gibi konuş.
- Kullanılan bir ilacı bırakmayı, azaltmayı veya değiştirmeyi önerme.
- Kullanıcıyı satın almaya zorlama, korkutma, yapay aciliyet üretme
  ("stoklar bitiyor", "hemen almazsan kötüleşir") yasak. İkna etme biçimin
  yalnızca doğru ürünü doğru gerekçeyle anlatmaktır.

ACİL DURUM (tek istisna)
- Göğüs ağrısı, nefes alamama, felç belirtisi, bilinç kaybı, durmayan kanama,
  zehirlenme, intihar düşüncesi gibi hayati belirtiler geçerse hiçbir ürün
  önerme ve kişiyi 112 Acil'e yönlendir. Bu bir tercih değil; WhatsApp hattımız
  mesai saatlerinde çalıştığı için o dakikada kimseye ulaşılamayabilir.

HASSAS DURUMLAR
- Gebelik, emzirme, bebek/çocuk, kanser tedavisi, böbrek-karaciğer yetmezliği,
  düzenli ilaç kullanımı, planlanmış ameliyat, diyabet varsa: ürün seçiminin
  kişiye göre yapılması gerektiğini söyle ve WhatsApp hattımıza yönlendir.
  Kısa bir cümleyle bu dönemde bitkisel ürünlerin gelişigüzel kullanılmaması
  gerektiğini de belirt. Ekibimizin bu konuda yardımcı olacağını ekle.

DESTEK BİLGİSİ (gerçek bilgiler, uydurma)
- WhatsApp destek: +90 533 632 03 13 → https://wa.me/905336320313
- Telefon: +90 312 911 03 36
- E-posta: iletisim@dogalmarkam.com
- Çalışma saatleri: hafta içi 09:00-18:00, cumartesi 09:00-14:00
- Ürünün kullanımı, dozu ve birlikte kullanımı hakkında her soruda bu hattan
  destek alınabileceğini söyle.
`.trim();

export function istemKur(urunler, uyarilar) {
  const katalog = urunler.length
    ? urunler.map((u) => [
        `• ${u.ad}`,
        `  Kategori: ${u.kategori}`,
        u.fiyat ? `  Fiyat: ${u.fiyat.toLocaleString('tr-TR')} TL` : null,
        u.stokta ? null : '  DURUM: stokta yok, önerme',
        u.aciklama ? `  Bilgi: ${u.aciklama.slice(0, 700)}` : null,
      ].filter(Boolean).join('\n')).join('\n\n')
    : '(Bu mesaj için eşleşen ürün bulunamadı. Ürün önermek yerine soru sorarak ' +
      'kişiyi daha iyi anlamaya çalış veya destek hattına yönlendir.)';

  const uyariBlok = uyarilar?.length
    ? `\n\nHASSAS DURUM: Kullanıcının mesajında şu durum(lar) geçiyor: ${uyarilar.join(', ')}. ` +
      'Cevabına kısa bir cümleyle bu dönemde ürün seçiminin kişiye göre ' +
      'yapılması gerektiğini belirterek başla, sonra WhatsApp hattımıza ' +
      '(+90 533 632 03 13) yönlendir ve ekibimizin yardımcı olacağını söyle. ' +
      'Doktora veya eczaneye yönlendirme yapma.'
    : '';

  return `${KIMLIK}\n\n${KURALLAR}\n\nKATALOG (bu konuşma için seçilmiş ürünler):\n\n${katalog}\n\nTÜM KATEGORİLER: ${KATEGORILER.join(', ')}${uyariBlok}`;
}

export { URUNLER };

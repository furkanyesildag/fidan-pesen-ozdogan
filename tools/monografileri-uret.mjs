#!/usr/bin/env node
/**
 * monografileri-uret.mjs
 * ---------------------------------------------------------------------------
 * data/monografiler.json içindeki bitki monografilerinden statik sayfalar
 * üretir:
 *
 *   monografi/index.html            → dizin sayfası (29 bitki)
 *   monografi/<kimlik>/index.html   → her bitki için tam monografi
 *
 * JSON'u tools/monografi-cikar.py üretir. Bu iş yalnızca sunum katmanıdır;
 * metne dokunmaz, yalnızca bölümlere ayırır, kaynak numaralarını üst simgeye
 * çevirir ve katalogdaki ilgili ürünleri sayfanın altına bağlar.
 *
 * Ürün eşleştirmesi api/_urunler.mjs üzerinden yapılır çünkü hangi çayın
 * hangi bitkiyi içerdiği yalnızca açıklamada yazıyor. Açıklama metni sayfaya
 * KOPYALANMAZ; yalnızca ürün adı ve bağlantısı yazılır.
 *
 *   node tools/monografileri-uret.mjs
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERI = path.join(KOK, 'data', 'monografiler.json');
const CIKTI = path.join(KOK, 'monografi');
const SITE = 'https://fidan-pesen-ozdogan.vercel.app';
const SURUM = 'v=19';
const BUGUN = '2026-08-11';
const BUGUN_YAZI = '11 Ağustos 2026';

/* --------------------------------------------------------------- yardımcı */
const kacis = (m) => String(m ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** JSON dizesi içine gömülecek metin: tırnak ve satır sonu temizlenir. */
const duz = (m) => String(m ?? '').replace(/\s+/g, ' ').trim();

const sade = (m) => String(m ?? '')
  .replace(/I/g, 'ı').replace(/İ/g, 'i')
  .toLocaleLowerCase('tr-TR')
  .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
  .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Boşluksuz sadeleştirme: "civan perçemli" ile "civanperçemi" eşleşsin diye. */
const sikis = (m) => sade(m).replace(/\s+/g, '');

/**
 * Metindeki kaynak numaralarını üst simgeye çevirir: "içerir.3,6" → "içerir.³ʼ⁶"
 * Yalnızca harf ya da kapanış parantezinden hemen sonra gelen, en fazla üç
 * basamaklı öbekler alınır; böylece "%1.5" ve "30-80 cm" gibi ölçüler
 * bozulmaz.
 */
function ustSimge(m) {
  return m.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ’')\]][.,]?)(\d{1,3}(?:[-–,]\d{1,3})*)(?=$|[\s.,;:)\]])/g,
    (_, on, sayi) => `${on}<sup class="kaynak-no">${sayi}</sup>`);
}

/** Latince tür adlarını italik yazar. */
function latinceIsaretle(m) {
  return m.replace(/\b([A-Z][a-z]{3,})\s+((?:subsp\.|var\.|ssp\.)?\s?[a-z][a-zé-]{2,})\b/g,
    (tam, c, t) => (/^(Alman|Amerikan|Avrupa|İngiliz|Türk|Doğu|Batı|Kuzey|Güney|Orta)$/.test(c)
      ? tam : `<i>${c} ${t}</i>`));
}

function paragrafYaz(metin) {
  return `<p>${ustSimge(latinceIsaretle(kacis(metin)))}</p>`;
}

function tabloYaz(satirlar) {
  const [bas, ...govde] = satirlar;
  const hucre = (h, etiket) => `<${etiket}>${kacis(h)}</${etiket}>`;
  return `<div class="tablo-sar">
        <table>
          <thead><tr>${bas.map((h) => hucre(h, 'th')).join('')}</tr></thead>
          <tbody>
${govde.map((s) => `            <tr>${s.map((h) => hucre(h, 'td')).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
        </div>`;
}

/* ------------------------------------------------------------ ürün eşleme */
/** Bitki adının katalogda geçebilecek biçimleri. */
function anahtarlar(m) {
  const kume = new Set();
  const ekle = (x) => { const s = sikis(x); if (s.length >= 4) kume.add(s); };
  ekle(m.ad);
  ekle(m.ad.replace(/\s*(otu|bitkisi|çayı)$/i, ''));
  const parca = m.ad.split(/\s+/);
  if (parca.length > 1) {
    ekle(parca[parca.length - 1]);            // "Adi Ardıç" → "ardıç"
    ekle(parca[0]);                           // "Ginkgo Biloba" → "ginkgo"
  }
  if (m.cins) ekle(m.cins);
  return [...kume];
}

function urunleriBul(m, urunler, digerAnahtar) {
  const kendi = anahtarlar(m);
  const bulundu = [];
  for (const u of urunler) {
    const adMetin = sikis(u.ad);
    const tumMetin = sikis(`${u.ad} ${u.aciklama || ''}`);
    let puan = 0;
    for (const a of kendi) {
      // Daha uzun başka bir bitki adı bu anahtarı kapsıyor ve o da eşleşiyorsa
      // ürün o bitkiye aittir: "ceviz" ile "hindistan cevizi" karışmasın.
      const golge = digerAnahtar.some((d) => d.includes(a) && d !== a && tumMetin.includes(d));
      if (golge) continue;
      if (adMetin.includes(a)) puan = Math.max(puan, 3);
      else if (tumMetin.includes(a)) puan = Math.max(puan, 1);
    }
    if (puan) bulundu.push({ u, puan });
  }
  return bulundu
    .sort((a, b) => b.puan - a.puan || a.u.ad.localeCompare(b.u.ad, 'tr'))
    .slice(0, 8)
    .map((x) => x.u);
}

/* ------------------------------------------------------------- SSS üretimi */
/** Bölüm gövdesinden, soruya cevap olacak ilk anlamlı paragrafı alır. */
function cevap(bolum, sinir = 420) {
  if (!bolum) return '';
  for (const [tur, icerik] of bolum.govde) {
    if (tur !== 'p' || icerik.length < 60) continue;
    let s = '';
    for (const c of icerik.split(/(?<=[.!?])\s+/)) {
      if (s && s.length + c.length > sinir) break;
      s += (s ? ' ' : '') + c;
    }
    return s.replace(/(\s*\d+(,\d+)*(-\d+)?)+(?=[.]|$)/g, '').trim();
  }
  return '';
}

function sssUret(m, bol) {
  const soru = [];
  const it = (k) => bol[k];
  const kısaAd = m.ad;
  if (m.ozet) {
    soru.push([`${kısaAd} nedir?`,
      `${kısaAd}${m.latince ? ` (${m.latince})` : ''}, ${m.ozet.charAt(0).toLocaleLowerCase('tr-TR')}${m.ozet.slice(1)}`]);
  }
  const c1 = cevap(it('kisim'));
  if (c1) soru.push([`${kısaAd} bitkisinin hangi kısımları kullanılır?`, c1]);
  const c2 = cevap(it('bilesen'));
  if (c2) soru.push([`${kısaAd} hangi etken maddeleri içerir?`, c2]);
  const c3 = cevap(it('gelenek'));
  if (c3) soru.push([`${kısaAd} geleneksel olarak nasıl kullanılmış?`, c3]);
  const c4 = cevap(it('farmakoloji'));
  if (c4) soru.push([`${kısaAd} üzerine yapılan çalışmalar ne gösteriyor?`, c4]);
  const c5 = cevap(it('uyari'));
  if (c5) soru.push([`${kısaAd} kullanırken nelere dikkat edilmeli?`, c5]);
  const c6 = cevap(it('farmakope'));
  if (c6) soru.push([`${kısaAd} hangi farmakopelerde yer alıyor?`, c6]);
  return soru.filter(([, c]) => c && c.length > 40).slice(0, 8);
}

/* ------------------------------------------------------------ ortak kabuk */
const MARKA_SVG = `<svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="20.2" stroke="currentColor" stroke-width="1" opacity=".38"/><circle cx="22" cy="1.8" r="1.25" fill="currentColor" opacity=".55"/><circle cx="42.2" cy="22" r="1.25" fill="currentColor" opacity=".55"/><circle cx="22" cy="42.2" r="1.25" fill="currentColor" opacity=".55"/><circle cx="1.8" cy="22" r="1.25" fill="currentColor" opacity=".55"/><path d="M22 34.5V15.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M22 22.6c-5.3 0-8.5-3.2-8.5-8.5 5.3 0 8.5 3.2 8.5 8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 18.4c0-5.9 3.4-9.2 9.3-9.2 0 5.9-3.4 9.2-9.3 9.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M17.6 34.5h8.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".65"/></svg>`;

const SIMGE = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' fill='none'><path d='M22 36V14' stroke='%23a8842c' stroke-width='3' stroke-linecap='round'/><path d='M22 22.6c-6 0-9.6-3.6-9.6-9.6 6 0 9.6 3.6 9.6 9.6Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/><path d='M22 18c0-6.6 3.8-10.4 10.4-10.4 0 6.6-3.8 10.4-10.4 10.4Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/></svg>`;

function bas({ yol, baslik, aciklama, ldJson }) {
  const url = `${SITE}${yol}`;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem('fpo_tema');document.documentElement.dataset.tema=(t==='koyu'||t==='acik')?t:'acik';}catch(e){document.documentElement.dataset.tema='koyu';}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${kacis(baslik)}</title>
<meta name="description" content="${kacis(aciklama)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="author" content="Dr. Ecz. Fidan Pesen Özdoğan">
<meta name="theme-color" content="#fbf8f1">
<link rel="alternate" hreflang="tr" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Dr. Ecz. Fidan Pesen Özdoğan">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${kacis(baslik)}">
<meta property="og:description" content="${kacis(aciklama)}">
<meta property="og:image" content="${SITE}/assets/img/portre-atolye.jpg">
<meta property="article:author" content="Dr. Ecz. Fidan Pesen Özdoğan">
<meta property="article:published_time" content="${BUGUN}">
<meta property="article:modified_time" content="${BUGUN}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@PesenFidan">
<meta name="twitter:title" content="${kacis(baslik)}">
<meta name="twitter:description" content="${kacis(aciklama)}">
<meta name="twitter:image" content="${SITE}/assets/img/portre-atolye.jpg">
<link rel="stylesheet" href="/assets/css/style.css?${SURUM}">
<link rel="stylesheet" href="/assets/css/makale.css?${SURUM}">
<link rel="icon" href="${SIMGE}">
<script type="application/ld+json">
${JSON.stringify(ldJson, null, 2)}
</script>
</head>
<body class="makale-govde">

<div class="makale-zemin" aria-hidden="true"></div>

<header class="ust-bar">
  <a class="marka" href="/">
    <span class="marka-mim" aria-hidden="true">
      ${MARKA_SVG}
    </span>
    <span class="marka-yazi"><b>Dr. Ecz. Fidan Pesen Özdoğan</b></span>
  </a>
  <nav class="menu" id="menu">
    <a href="/fitoterapi">Fitoterapi</a>
    <a href="/monografi">Monografiler</a>
    <a href="/cilt-bakimi">Cilt Bakımı</a>
    <a href="/sac-bakimi">Saç Bakımı</a>
    <a href="/gida-takviyeleri">Gıda Takviyeleri</a>
    <a href="/geleneksel-tip">Geleneksel Tıp</a>
    <a href="/sss">SSS</a>
    <a class="menu-cta" href="/asistan">Asistan</a>
  </nav>
  <button class="tema-dugme" id="temaDugme" type="button" aria-pressed="false" aria-label="Aydınlık moda geç" title="Aydınlık mod">
    <svg class="t-ay" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z"/></svg>
    <svg class="t-gunes" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></svg>
  </button>
  <button class="menu-dugme" id="menuDugme" aria-label="Menüyü aç" aria-expanded="false"><span></span><span></span></button>
</header>
`;
}

function dip() {
  return `
<footer class="dip">
  <div class="kap">
    <div class="dip-satir">
      <div class="dip-marka">
        <b>Dr. Ecz. Fidan Pesen Özdoğan</b>
        <p>Geleneksel tıp, mizaçlar ve fitoterapi üzerine biyografik sayfa.</p>
        <div class="dip-sosyal">
          <a href="https://www.instagram.com/fidanpesen/" target="_blank" rel="noopener">Instagram</a>
          <a href="https://www.youtube.com/@fidanpesen" target="_blank" rel="noopener">YouTube</a>
          <a href="https://x.com/pesenfidan" target="_blank" rel="noopener">X</a>
          <a href="https://www.threads.com/@fidanpesen" target="_blank" rel="noopener">Threads</a>
          <a href="https://www.facebook.com/dogalmarkambor/" target="_blank" rel="noopener">Facebook</a>
          <a href="https://tr.linkedin.com/in/fidan-pesen-ozdogan-a4392b125" target="_blank" rel="noopener">LinkedIn</a>
        </div>
      </div>
      <nav class="dip-menu" aria-label="Alt menü">
        <a href="/">Özgeçmiş</a>
        <a href="/fitoterapi">Fitoterapi</a>
        <a href="/monografi">Bitki Monografileri</a>
        <a href="/cilt-bakimi">Cilt Bakımı</a>
        <a href="/sac-bakimi">Saç Bakımı</a>
        <a href="/ucucu-yaglar">Uçucu Yağlar</a>
        <a href="/hunnap-ozu">Hünnap Özü</a>
        <a href="/pancar-pekmezi">Pancar Pekmezi</a>
        <a href="/gida-takviyeleri">Gıda Takviyeleri</a>
        <a href="/geleneksel-tip">Geleneksel Tıp</a>
        <a href="/videolar">Videolar</a>
        <a href="/sss">SSS</a>
        <a href="/asistan">Asistan</a>
        <a href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">dogalmarkam.com ↗</a>
      </nav>
    </div>
    <p class="dip-not">
      Bu sitedeki bilgiler kamuya açık kaynaklardan derlenmiş biyografik ve
      kültürel içeriktir. Hiçbir bölümü tıbbi teşhis, tedavi veya reçete
      yerine geçmez. Sağlık kararlarınız için hekiminize danışın. Görseller
      Doğal Markam / Dr. Ecz. Fidan Pesen Özdoğan arşivine aittir.
    </p>
  </div>
</footer>

<script src="/assets/js/main.js?${SURUM}"></script>
<script src="/assets/js/tema.js?${SURUM}"></script>
</body>
</html>
`;
}

const YAZAR_KART = `<div class="yazar-kart">
        <img src="/assets/img/portre-kunye.jpg" alt="Dr. Ecz. Fidan Pesen Özdoğan" width="88" height="88" loading="lazy" decoding="async">
        <div>
          <h2>Dr. Ecz. Fidan Pesen Özdoğan</h2>
          <p>Hacettepe Üniversitesi Eczacılık Fakültesi mezunu. Gazi Üniversitesi
             Eczacılık Fakültesi'nde fitoterapi yüksek lisansı yaparak Uzman Eczacı
             unvanını aldı. Sağlık Bilimleri Üniversitesi Geleneksel ve Tamamlayıcı
             Tıp (GETAT) Anabilim Dalı'nda doktorasını tamamladı; Türkiye'de bu
             alanda verilen ilk bilim doktoru unvanı bu çalışmayla geldi.
             Geleneksel Uygur tıbbı kaynaklarını aslından okuyabilmek için Uygurca
             ve Osmanlı Türkçesi öğrendi. Doğal Markam markasının bitkisel
             formülasyonlarını tasarlıyor.</p>
          <div class="yazar-baglar">
            <a href="/">Özgeçmiş</a>
            <a href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">dogalmarkam.com</a>
            <a href="https://www.instagram.com/fidanpesen/" target="_blank" rel="noopener">Instagram</a>
            <a href="https://www.youtube.com/@fidanpesen" target="_blank" rel="noopener">YouTube</a>
          </div>
        </div>
      </div>`;

const SORUMLULUK = `<p class="sorumluluk">
        <b>Sorumluluk reddi.</b> Bu monografi, bitki üzerine yayımlanmış
        farmakope ve bilimsel literatürün derlemesidir; sayfada aktarılan
        bulgular kaynakların ifadesidir, bir tedavi önerisi ya da sağlık beyanı
        değildir. Bitkisel ürünler ve takviye edici gıdalar hastalıkları önleme,
        tedavi etme veya iyileştirme amacıyla kullanılamaz. İlaç kullananların
        ve gebe ya da emziren kişilerin bitkisel ürünlere başlamadan önce
        hekimine danışması gerekir. Ürün seçimi için
        <a href="https://wa.me/905336320313" target="_blank" rel="noopener">WhatsApp
        destek hattımızdan</a> ekibimize ulaşabilirsiniz.
      </p>`;

/* --------------------------------------------------------- monografi sayfa */
function monografiSayfa(m, komsu, urunler) {
  const bol = Object.fromEntries(m.bolumler.map((b) => [b.kimlik, b]));
  const sss = sssUret(m, bol);
  const baslik = `${m.ad}${m.latince ? ` (${m.latince})` : ''} Nedir? Bitki Monografisi | Dr. Ecz. Fidan Pesen Özdoğan`;
  const aciklama = duz(`${m.ad} monografisi: botanik kimliği, kimyasal bileşenleri, `
    + `farmakopelerdeki yeri, geleneksel kullanımı, farmakolojik özellikleri ve `
    + `dikkat edilmesi gereken noktalar. Dr. Ecz. Fidan Pesen Özdoğan'ın derlemesi.`).slice(0, 300);

  const bolumBaslik = m.bolumler.map((b) => ({
    kimlik: b.kimlik.replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'bolum',
    baslik: b.baslik,
    b,
  }));

  const ldJson = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Article', 'MedicalWebPage'],
        '@id': `${SITE}/monografi/${m.kimlik}/#article`,
        headline: `${m.ad} Monografisi`,
        name: duz(baslik),
        description: duz(aciklama),
        inLanguage: 'tr-TR',
        datePublished: BUGUN,
        dateModified: BUGUN,
        wordCount: m.kelime,
        articleSection: 'Fitoterapi',
        keywords: [m.ad, m.latince, `${m.ad} nedir`, `${m.ad} faydaları`,
          `${m.ad} kullanımı`, `${m.ad} yan etkileri`, `${m.ad} monografi`,
          'fitoterapi', 'tıbbi bitki'].filter(Boolean).join(', '),
        author: { '@id': `${SITE}/#kisi` },
        publisher: { '@id': `${SITE}/#kurulus` },
        isPartOf: { '@id': `${SITE}/monografi/#koleksiyon` },
        mainEntityOfPage: `${SITE}/monografi/${m.kimlik}`,
        citation: m.kaynakca.slice(0, 40).map((k) => duz(k)),
        about: {
          '@type': 'Taxon',
          name: m.latince || m.ad,
          alternateName: [m.ad, m.latinceTam].filter((x) => x && x !== m.latince),
          taxonRank: m.latince && m.latince.includes(' ') ? 'species' : 'genus',
          ...(m.cins ? { parentTaxon: m.cins } : {}),
        },
      },
      {
        '@type': 'Person',
        '@id': `${SITE}/#kisi`,
        name: 'Dr. Ecz. Fidan Pesen Özdoğan',
        jobTitle: 'Fitoterapi Uzmanı Eczacı · Geleneksel ve Tamamlayıcı Tıp Bilim Doktoru',
        url: SITE,
      },
      {
        '@type': 'Organization',
        '@id': `${SITE}/#kurulus`,
        name: 'Doğal Markam',
        url: 'https://www.dogalmarkam.com/',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Bitki Monografileri', item: `${SITE}/monografi` },
          { '@type': 'ListItem', position: 3, name: m.ad, item: `${SITE}/monografi/${m.kimlik}` },
        ],
      },
      ...(sss.length ? [{
        '@type': 'FAQPage',
        '@id': `${SITE}/monografi/${m.kimlik}/#sss`,
        mainEntity: sss.map(([s, c]) => ({
          '@type': 'Question',
          name: duz(s),
          acceptedAnswer: { '@type': 'Answer', text: duz(c) },
        })),
      }] : []),
    ],
  };

  const kimlikTablo = m.taksonomi.length ? `
      <section id="kimlik">
        <h2>${kacis(m.ad)} kimlik bilgileri</h2>
        <div class="tablo-sar">
        <table class="kimlik-tablo">
          <tbody>
${m.latince ? `            <tr><th>Botanik adı</th><td><i>${kacis(m.latinceTam || m.latince)}</i></td></tr>` : ''}
${m.taksonomi.map(([a, d]) => `            <tr><th>${kacis(a)}</th><td>${latinceIsaretle(kacis(d))}</td></tr>`).join('\n')}
          </tbody>
        </table>
        </div>
      </section>` : '';

  const govde = bolumBaslik.map(({ kimlik, baslik: bs, b }) => {
    const ic = b.govde.map(([tur, icerik]) => (tur === 'tablo'
      ? tabloYaz(icerik)
      : paragrafYaz(icerik))).join('\n        ');
    return `
      <section id="${kimlik}">
        <h2>${kacis(bs)}</h2>
        ${ic}
      </section>`;
  }).join('\n');

  const urunBlok = urunler.length ? `
      <section id="urunler">
        <h2>${kacis(m.ad)} içeren Doğal Markam ürünleri</h2>
        <p>Dr. Ecz. Fidan Pesen Özdoğan'ın formülasyonlarıyla üretilen ve
        ${kacis(m.ad.toLocaleLowerCase('tr-TR'))} içeren ürünler:</p>
        <ul class="urun-liste">
${urunler.map((u) => `          <li><a class="urun-bag" href="${kacis(u.bag)}" target="_blank" rel="noopener">${kacis(u.ad)}</a></li>`).join('\n')}
        </ul>
        <p class="urun-cagri">
          <a class="dugme birincil" href="/asistan">Bana uygun olanı bul</a>
          <a class="dugme" href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">Tüm ürünler</a>
        </p>
        <p>Bu liste, ürünün içeriğinde bu bitkinin bulunduğunu belirtir; yukarıda
        aktarılan literatür bulgularının ürüne ait bir etki iddiası olduğu
        anlamına gelmez.</p>
      </section>` : '';

  const sssBlok = sss.length ? `
      <section id="sss">
        <h2>Sık sorulan sorular</h2>
        <div class="sss-liste">
${sss.map(([s, c], i) => `          <details${i === 0 ? ' open' : ''}>
            <summary>${kacis(s)}</summary>
            <div class="sss-cevap"><p>${latinceIsaretle(kacis(c))}</p></div>
          </details>`).join('\n')}
        </div>
      </section>` : '';

  const kaynakBlok = m.kaynakca.length ? `
      <section id="kaynakca">
        <h2>Kaynakça</h2>
        <details class="kaynak-katla">
          <summary>${m.kaynakca.length} kaynağı göster</summary>
          <ol class="kaynak-liste">
${m.kaynakca.map((k) => `            <li>${latinceIsaretle(kacis(k))}</li>`).join('\n')}
          </ol>
        </details>
      </section>` : '';

  const icindekiler = [
    ...(kimlikTablo ? [['kimlik', `${m.ad} kimlik bilgileri`]] : []),
    ...bolumBaslik.map((x) => [x.kimlik, x.baslik]),
    ...(urunler.length ? [['urunler', 'İlgili ürünler']] : []),
    ...(sss.length ? [['sss', 'Sık sorulan sorular']] : []),
    ...(m.kaynakca.length ? [['kaynakca', 'Kaynakça']] : []),
  ];

  return bas({ yol: `/monografi/${m.kimlik}`, baslik, aciklama, ldJson }) + `
<main>
  <div class="makale-basi">
    <div class="kap">
      <ol class="kirinti">
        <li><a href="/">Ana sayfa</a></li>
        <li><a href="/monografi">Bitki Monografileri</a></li>
        <li>${kacis(m.ad)}</li>
      </ol>
      <h1>${kacis(m.ad)}</h1>
${m.latince ? `      <p class="makale-latin"><i>${kacis(m.latinceTam || m.latince)}</i></p>` : ''}
      <p class="makale-ozet">${latinceIsaretle(kacis(m.ozet))}</p>
      <div class="makale-kimlik">
        <img src="/assets/img/portre-kunye.jpg" alt="Dr. Ecz. Fidan Pesen Özdoğan" width="40" height="40" loading="lazy" decoding="async">
        <span>Derleyen <b>Dr. Ecz. Fidan Pesen Özdoğan</b>, Uzman Eczacı</span>
        <span>${m.kaynakca.length} kaynak · ${m.kelime.toLocaleString('tr-TR')} kelime</span>
        <span>Güncelleme: <time datetime="${BUGUN}">${BUGUN_YAZI}</time></span>
      </div>
    </div>
  </div>

  <div class="makale-duzen">
    <article class="makale">
${kimlikTablo}
${govde}
${urunBlok}
${sssBlok}
${kaynakBlok}
      <div class="makale-son">
${YAZAR_KART}
        <div class="ilgili">
          <h2>Diğer monografiler</h2>
          <div class="ilgili-izgara">
${komsu.map((k) => `        <a href="/monografi/${k.kimlik}">${kacis(k.ad)}<span>${kacis(k.latince || 'Bitki monografisi')}</span></a>`).join('\n')}
        <a href="/monografi">Tüm monografiler<span>29 bitkinin tam listesi</span></a>
          </div>
        </div>
${SORUMLULUK}
      </div>
    </article>

    <aside class="icindekiler" aria-label="İçindekiler">
      <h2>İçindekiler</h2>
      <ol>
${icindekiler.map(([k, b]) => `        <li><a href="#${k}">${kacis(b)}</a></li>`).join('\n')}
      </ol>
    </aside>
  </div>
</main>
` + dip();
}

/* -------------------------------------------------------------- dizin sayfa */
function dizinSayfa(hepsi, urunSayi) {
  const baslik = 'Bitki Monografileri | Tıbbi Bitkiler Arşivi | Dr. Ecz. Fidan Pesen Özdoğan';
  const aciklama = duz(`${hepsi.length} tıbbi bitkinin tam monografisi: botanik `
    + `sınıflandırma, kimyasal bileşenler, farmakopelerdeki yeri, geleneksel `
    + `kullanım, farmakolojik özellikler, yan etki ve ilaç etkileşimleri. `
    + `Fitoterapi Uzmanı Eczacı Dr. Ecz. Fidan Pesen Özdoğan'ın derlemesi.`);

  const ldJson = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE}/monografi/#koleksiyon`,
        name: duz(baslik),
        description: duz(aciklama),
        url: `${SITE}/monografi`,
        inLanguage: 'tr-TR',
        dateModified: BUGUN,
        author: { '@id': `${SITE}/#kisi` },
        about: { '@type': 'Thing', name: 'Fitoterapi ve tıbbi bitkiler' },
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE}/monografi/#liste`,
        name: 'Bitki monografileri',
        numberOfItems: hepsi.length,
        itemListElement: hepsi.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${m.ad}${m.latince ? ` (${m.latince})` : ''}`,
          url: `${SITE}/monografi/${m.kimlik}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Bitki Monografileri', item: `${SITE}/monografi` },
        ],
      },
      {
        '@type': 'Person',
        '@id': `${SITE}/#kisi`,
        name: 'Dr. Ecz. Fidan Pesen Özdoğan',
        jobTitle: 'Fitoterapi Uzmanı Eczacı · Geleneksel ve Tamamlayıcı Tıp Bilim Doktoru',
        url: SITE,
      },
    ],
  };

  const kart = hepsi.map((m) => `        <a class="monografi-kart" href="/monografi/${m.kimlik}">
          <span class="mk-ad">${kacis(m.ad)}</span>
${m.latince ? `          <span class="mk-latin"><i>${kacis(m.latince)}</i></span>` : ''}
          <span class="mk-ozet">${kacis(m.ozet.slice(0, 150))}${m.ozet.length > 150 ? '…' : ''}</span>
          <span class="mk-alt">${m.kaynakca.length} kaynak${m.urunSayi ? ` · ${m.urunSayi} ürün` : ''}</span>
        </a>`).join('\n');

  const toplamKelime = hepsi.reduce((a, m) => a + m.kelime, 0);
  const toplamKaynak = hepsi.reduce((a, m) => a + m.kaynakca.length, 0);

  return bas({ yol: '/monografi', baslik, aciklama, ldJson }) + `
<main>
  <div class="makale-basi">
    <div class="kap">
      <ol class="kirinti">
        <li><a href="/">Ana sayfa</a></li>
        <li>Bitki Monografileri</li>
      </ol>
      <h1>Bitki Monografileri</h1>
      <p class="makale-ozet">
        Bir bitkiyi tanımak, adını bilmekle bitmiyor. Hangi türü, hangi kısmı,
        hangi bileşeni, hangi dozda, kiminle birlikte kullanıldığında ne yapıyor?
        Bu arşiv, ${hepsi.length} tıbbi bitkinin her birini botanik kimliğinden
        ilaç etkileşimlerine kadar tek sayfada topluyor. Metinler farmakope ve
        bilimsel literatür taramasına dayanıyor; her bölümdeki numaralar sayfa
        sonundaki kaynakçaya işaret ediyor.
      </p>
      <div class="makale-kimlik">
        <img src="/assets/img/portre-kunye.jpg" alt="Dr. Ecz. Fidan Pesen Özdoğan" width="40" height="40" loading="lazy" decoding="async">
        <span>Derleyen <b>Dr. Ecz. Fidan Pesen Özdoğan</b>, Uzman Eczacı</span>
        <span>${hepsi.length} monografi · ${toplamKaynak.toLocaleString('tr-TR')} kaynak · ${toplamKelime.toLocaleString('tr-TR')} kelime</span>
        <span>Güncelleme: <time datetime="${BUGUN}">${BUGUN_YAZI}</time></span>
      </div>
    </div>
  </div>

  <div class="kap">
    <article class="makale monografi-dizin">
      <section id="liste">
        <h2>Monografi arşivi</h2>
        <p>Her monografi şu başlıkları içeriyor: bilimsel sınıflandırma, botanik
        türler, Türkçe ve İngilizce adları, terapide kullanılan kısımları,
        kimyasal bileşenleri, bitkinin yer aldığı farmakopeler, botanik
        özellikleri ve yetiştiği yerler, tarihsel ve geleneksel kullanımı,
        farmakolojik özellikleri ve endikasyonları, yan etki ve ilaç
        etkileşimleri, kaynakça.</p>
        <div class="monografi-izgara">
${kart}
        </div>
      </section>

      <section id="nasil-okunur">
        <h2>Monografi nasıl okunur?</h2>
        <p>Bir bitki monografisi, o bitkiye dair dağınık bilgiyi tek bir düzende
        toplayan referans metnidir. Sırası tesadüfi değildir: önce bitkinin
        <b>kim olduğu</b> belirlenir (sınıflandırma ve tür), sonra <b>neyin
        kullanıldığı</b> (yaprak mı, kök mü, tohum mu), sonra <b>içinde ne
        olduğu</b> (kimyasal bileşenler), sonra <b>kimin onayladığı</b>
        (farmakopeler), en sonunda da <b>ne yaptığı</b> ve <b>ne zaman
        kullanılmaması gerektiği</b>.</p>
        <p>Bu sıralamayı atlayıp doğrudan &ldquo;neye iyi geliyor&rdquo;
        bölümüne bakmak, fitoterapide en sık yapılan hatadır. Aynı bitkinin
        farklı türü, farklı kısmı ya da farklı hazırlanışı bambaşka sonuç verir:
        adaçayının bir türü yüksek oranda thujon içerirken bir diğeri neredeyse
        hiç içermez. Monografinin başındaki bölümler, sondaki bölümü doğru
        okumak için vardır.</p>
        <p>Metinlerdeki üst simge numaralar, o cümlenin dayandığı kaynağı
        gösterir. Kaynakça her sayfanın sonunda katlanmış hâlde durur.
        ${urunSayi > 0 ? 'İlgili ürün bağlantıları, yalnızca o bitkinin ürün içeriğinde bulunduğunu gösterir; bir etki iddiası taşımaz.' : ''}</p>
      </section>

      <div class="makale-son">
${YAZAR_KART}
        <div class="ilgili">
          <h2>İlgili sayfalar</h2>
          <div class="ilgili-izgara">
        <a href="/fitoterapi">Fitoterapi<span>Bitkisel tedavinin bilimsel çerçevesi</span></a>
        <a href="/geleneksel-tip">Geleneksel Tıp ve Mizaç<span>Dört unsur ve mizaç tipleri</span></a>
        <a href="/ucucu-yaglar">Uçucu Yağlar<span>Aromaterapi ve güvenli kullanım</span></a>
        <a href="/asistan">Fidan'ın Asistanı<span>Size uygun ürünü birlikte bulalım</span></a>
          </div>
        </div>
${SORUMLULUK}
      </div>
    </article>
  </div>
</main>
` + dip();
}

/* ------------------------------------------------------------------- akış */
const veri = JSON.parse(await readFile(VERI, 'utf8'));
const hepsi = veri.monografiler.slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

let URUNLER = [];
try {
  ({ URUNLER } = await import('../api/_urunler.mjs'));
} catch (e) {
  console.warn(`Ürün kataloğu okunamadı, ürün bölümleri atlanıyor: ${e.message}`);
}

const tumAnahtar = hepsi.flatMap((m) => anahtarlar(m));
let toplamUrun = 0;
for (const m of hepsi) {
  m.urunler = urunleriBul(m, URUNLER, tumAnahtar);
  m.urunSayi = m.urunler.length;
  toplamUrun += m.urunSayi;
}

await mkdir(CIKTI, { recursive: true });
await writeFile(path.join(CIKTI, 'index.html'), dizinSayfa(hepsi, toplamUrun), 'utf8');

for (let i = 0; i < hepsi.length; i++) {
  const m = hepsi[i];
  const komsu = [hepsi[(i + 1) % hepsi.length], hepsi[(i + 2) % hepsi.length],
    hepsi[(i + hepsi.length - 1) % hepsi.length]];
  const dizin = path.join(CIKTI, m.kimlik);
  await mkdir(dizin, { recursive: true });
  await writeFile(path.join(dizin, 'index.html'), monografiSayfa(m, komsu, m.urunler), 'utf8');
}

console.log(`Yazıldı: monografi/index.html ve ${hepsi.length} monografi sayfası`);
console.log(`${hepsi.reduce((a, m) => a + m.kelime, 0).toLocaleString('tr-TR')} kelime · `
  + `${hepsi.reduce((a, m) => a + m.kaynakca.length, 0)} kaynak · ${toplamUrun} ürün bağlantısı`);
console.log('Ürünsüz: ' + (hepsi.filter((m) => !m.urunSayi).map((m) => m.ad).join(', ') || 'yok'));

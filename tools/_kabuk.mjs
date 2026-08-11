/**
 * _kabuk.mjs
 * ---------------------------------------------------------------------------
 * Üretilen makale sayfalarının ortak kabuğu: head bloğu, üst çubuk, altlık,
 * yazar kartı, sorumluluk reddi ve metin biçimleme yardımcıları.
 *
 * monografileri-uret.mjs ile herbalizm-uret.mjs bu dosyayı paylaşır; menü ya
 * da altlık değiştiğinde tek yerden değişsin diye ayrıldı. Alt çizgiyle
 * başlayan dosyalar uç nokta olarak yayınlanmaz.
 * ---------------------------------------------------------------------------
 */
export const SITE = 'https://fidan-pesen-ozdogan.vercel.app';
export const SURUM = 'v=22';
export const BUGUN = '2026-08-11';
export const BUGUN_YAZI = '11 Ağustos 2026';

/* --------------------------------------------------------------- yardımcı */
export const kacis = (m) => String(m ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** JSON alanına gömülecek metin: satır sonları toparlanır. */
export const duz = (m) => String(m ?? '').replace(/\s+/g, ' ').trim();

export const sade = (m) => String(m ?? '')
  .replace(/I/g, 'ı').replace(/İ/g, 'i')
  .toLocaleLowerCase('tr-TR')
  .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
  .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const kimlik = (m) => sade(m).replace(/\s+/g, '-').slice(0, 60) || 'bolum';

/**
 * Kaynak numaralarını üst simgeye çevirir: "içerir.3,6" gibi. Yalnızca harf
 * ya da kapanış parantezinden hemen sonra gelen, en fazla üç basamaklı
 * öbekler alınır; böylece "%1.5" ve "30-80 cm" gibi ölçüler bozulmaz.
 */
export function ustSimge(m) {
  return m.replace(
    /([a-zçğıöşüA-ZÇĞİÖŞÜ’')\]][.,]?)(\d{1,3}(?:[-–,]\d{1,3})*)(?=$|[\s.,;:)\]])/g,
    (_, on, sayi) => `${on}<sup class="kaynak-no">${sayi}</sup>`);
}

/* Latince cins adları metinden çıkarılır: Latince tür sonekiyle biten bir
   kelimeden önce gelen büyük harfli kelimeler aday sayılır. Sabit liste
   tutmaya göre üstünlüğü, yeni belge eklendiğinde kendiliğinden büyümesi. */
const LATIN_SON = /(?:us|um|is|ae|ii|ense|ensis|oides|ata|atum|ica|icum|osa|osum|ifolia|iflora|inalis|iana|icus|ida|ina|alis|aria|estris|orum|ella|iae|eus|ium|iva|iba|oba)$/;
const CINS_DISI = new Set(['Latince', 'Chinese', 'Hawaiian', 'English', 'German',
  'Japanese', 'Indian', 'Tels', 'Bitkinin', 'Bitkisel', 'Normal', 'Klinik']);

/* Cins adından sonra gelen her kelime tür adı değil: "Ginkgo yaprak",
   "Crataegus cinsinin", "Ginkgo biloba extract" gibi öbekler de geçiyor. */
const TURKCE_EK = /(?:lar|ler|leri|ları|lerin|ların|sinin|sine|sinden|sini|inin|inde|inden|nin|nın|siz|lik|lık|dır|dir|ktir|ndan|nden)$/;
const TUR_DISI = new Set(['alt', 'and', 'for', 'ise', 'olarak', 'botanik', 'cinsi',
  'yaprak', 'yapra', 'genus', 'sect', 'special', 'species', 'spp', 'taxa', 'cum',
  'berry', 'berries', 'compounds', 'extract', 'extracts', 'flavonoids', 'ginkgo',
  'preparation', 'polysaccharide', 'aronia', 'anthocyanins-rich',
  'extract-induced', 'bilobaextracts', 'unguicularisfixed', 'bakterisine']);

let CINSLER = new Set();

/** Verilen metinden cins adı sözlüğünü kurar. */
export function cinsleriKur(metin, ekstra = []) {
  const kume = new Set(ekstra.filter(Boolean));
  for (const e of metin.matchAll(/\b([A-Z][a-z]{3,})\s+([a-z][a-zé-]{2,})\b/g)) {
    if (CINS_DISI.has(e[1]) || /[çğıöşü]/.test(e[1] + e[2])) continue;
    if (LATIN_SON.test(e[2])) kume.add(e[1]);
  }
  kume.delete('');
  CINSLER = kume;
  return kume;
}

/** Yalnızca bilinen cins adlarıyla başlayan gerçek ikilileri italik yazar. */
export function latinceIsaretle(m) {
  return m.replace(/\b([A-Z][a-z]{3,})\s+((?:subsp\.|var\.|ssp\.)?\s?[a-z][a-zé-]{2,})\b/g,
    (tam, c, t) => {
      const tur = t.replace(/^(?:subsp\.|var\.|ssp\.)\s?/, '');
      if (!CINSLER.has(c) || TUR_DISI.has(tur) || TURKCE_EK.test(tur)) return tam;
      return `<i>${c} ${t}</i>`;
    });
}

/** Belgede tümü büyük harf yazılmış başlıkları normal düzene çevirir. */
export function baslikDuzelt(m) {
  const harf = m.replace(/[^A-Za-zÇĞİıÖŞÜçğöşü]/g, '');
  if (!harf || harf !== harf.toLocaleUpperCase('tr-TR')) return m;
  const kucuk = m.toLocaleLowerCase('tr-TR');
  return kucuk.charAt(0).toLocaleUpperCase('tr-TR') + kucuk.slice(1);
}

export function paragrafYaz(metin) {
  return `<p>${ustSimge(latinceIsaretle(kacis(metin)))}</p>`;
}

export function tabloYaz(satirlar) {
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

/** Bölüm gövdesini (paragraf ve tablo karışık) HTML'e çevirir. */
export function govdeYaz(govde, girinti = '        ') {
  return govde
    .map(([tur, icerik]) => (tur === 'tablo' ? tabloYaz(icerik) : paragrafYaz(icerik)))
    .join(`\n${girinti}`);
}

/* ------------------------------------------------------------ ortak kabuk */
const MARKA_SVG = `<svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="20.2" stroke="currentColor" stroke-width="1" opacity=".38"/><circle cx="22" cy="1.8" r="1.25" fill="currentColor" opacity=".55"/><circle cx="42.2" cy="22" r="1.25" fill="currentColor" opacity=".55"/><circle cx="22" cy="42.2" r="1.25" fill="currentColor" opacity=".55"/><circle cx="1.8" cy="22" r="1.25" fill="currentColor" opacity=".55"/><path d="M22 34.5V15.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M22 22.6c-5.3 0-8.5-3.2-8.5-8.5 5.3 0 8.5 3.2 8.5 8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 18.4c0-5.9 3.4-9.2 9.3-9.2 0 5.9-3.4 9.2-9.3 9.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M17.6 34.5h8.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".65"/></svg>`;

const SIMGE = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' fill='none'><path d='M22 36V14' stroke='%23a8842c' stroke-width='3' stroke-linecap='round'/><path d='M22 22.6c-6 0-9.6-3.6-9.6-9.6 6 0 9.6 3.6 9.6 9.6Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/><path d='M22 18c0-6.6 3.8-10.4 10.4-10.4 0 6.6-3.8 10.4-10.4 10.4Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/></svg>`;

export function bas({ yol, baslik, aciklama, ldJson }) {
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
    <a href="/bitki-kimyasi">Bitki Kimyası</a>
    <a href="/vitamin-mineral">Vitamin ve Mineral</a>
    <a href="/cilt-bakimi">Cilt Bakımı</a>
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

export function dip() {
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
        <a href="/medikal-herbalizm">Medikal Herbalizm</a>
        <a href="/bitki-kimyasi">Bitki Kimyası</a>
        <a href="/vitamin-mineral">Vitamin ve Mineraller</a>
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

export const YAZAR_KART = `<div class="yazar-kart">
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

export const SORUMLULUK = `<p class="sorumluluk">
        <b>Sorumluluk reddi.</b> Bu sayfa, konu üzerine yayımlanmış farmakope ve
        bilimsel literatürün derlemesidir; aktarılan bulgular kaynakların
        ifadesidir, bir tedavi önerisi ya da sağlık beyanı değildir. Bitkisel
        ürünler ve takviye edici gıdalar hastalıkları önleme, tedavi etme veya
        iyileştirme amacıyla kullanılamaz. İlaç kullananların ve gebe ya da
        emziren kişilerin bitkisel ürünlere başlamadan önce hekimine danışması
        gerekir. Ürün seçimi için
        <a href="https://wa.me/905336320313" target="_blank" rel="noopener">WhatsApp
        destek hattımızdan</a> ekibimize ulaşabilirsiniz.
      </p>`;

/** Kişi ve kuruluş düğümleri: her sayfanın yapısal verisinde aynısı geçiyor. */
export const KISI_LD = {
  '@type': 'Person',
  '@id': `${SITE}/#kisi`,
  name: 'Dr. Ecz. Fidan Pesen Özdoğan',
  jobTitle: 'Fitoterapi Uzmanı Eczacı · Geleneksel ve Tamamlayıcı Tıp Bilim Doktoru',
  url: SITE,
};

export const KURULUS_LD = {
  '@type': 'Organization',
  '@id': `${SITE}/#kurulus`,
  name: 'Doğal Markam',
  url: 'https://www.dogalmarkam.com/',
};

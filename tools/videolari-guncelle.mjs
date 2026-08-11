#!/usr/bin/env node
/**
 * videolari-guncelle.mjs
 * ---------------------------------------------------------------------------
 * İki kaynaktan veri toplar:
 *   1. Resmî RSS beslemesi  — güvenilir taban. Son 15 video; başlık, tarih,
 *      açıklama ve KESİN görüntülenme sayısı verir.
 *   2. Kanalın /shorts sekmesi — zenginleştirme. Yaklaşık 48 Shorts'un kimliği
 *      ve başlığı. YouTube'un iç JSON'u olduğu için kırılgandır; hata alırsa
 *      sessizce atlanır ve RSS tek başına yeter.
 *
 * Sonuçlar data/videolar.json arşiviyle BİRLEŞTİRİLİR (eskiler silinmez, arşiv
 * büyür), eksik yayın tarihleri yalnızca YENİ videolar için tek seferlik
 * doldurulur ve videolar/index.html yeniden üretilir.
 *
 * Bağımlılık yok. Node 18+ yeterlidir (global fetch).
 *
 *   node tools/videolari-guncelle.mjs
 *
 * RSS yalnızca son 15 videoyu döner; bu yüzden birleştirme yapıyoruz. Haftada
 * bir çalıştıkça arşiv kendiliğinden büyür.
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK_DIZIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KANAL_ID = 'UCKNR5SBIbxZtwIE0zauo28Q';
const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${KANAL_ID}`;
const SHORTS_SEKME = 'https://www.youtube.com/@fidanpesen/shorts';
const TARAYICI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SITE = 'https://fidan-pesen-ozdogan.vercel.app';
const ARSIV = path.join(KOK_DIZIN, 'data', 'videolar.json');
const CIKTI = path.join(KOK_DIZIN, 'videolar', 'index.html');

/* ------------------------------------------------------------- yardımcılar */
const kacir = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const cozXml = (s) => String(s ?? '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Başlıktaki hashtag kuyruğunu ayırır: görünen başlık + etiket listesi. */
function basligiAyir(hamBaslik) {
  const etiketler = [...hamBaslik.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  const temiz = hamBaslik
    .replace(/#[\p{L}\p{N}_]*/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?…])/g, '$1')
    .trim()
    .replace(/[\s.·|-]+$/u, '');
  return { baslik: temiz || hamBaslik.trim(), etiketler };
}

function alan(blok, etiket) {
  const m = blok.match(new RegExp(`<${etiket}[^>]*>([\\s\\S]*?)</${etiket}>`));
  return m ? cozXml(m[1].trim()) : '';
}

/* ------------------------------------------------------------- RSS okuma */
async function rssOku() {
  const yanit = await fetch(RSS, {
    headers: { 'user-agent': 'fidan-pesen-ozdogan-site/1.0 (+https://fidan-pesen-ozdogan.vercel.app)' },
  });
  if (!yanit.ok) throw new Error(`RSS alınamadı: HTTP ${yanit.status}`);
  const xml = await yanit.text();

  const girisler = xml.split('<entry>').slice(1);
  return girisler.map((g) => {
    const id = alan(g, 'yt:videoId');
    const hamBaslik = alan(g, 'title');
    const { baslik, etiketler } = basligiAyir(hamBaslik);
    const aciklama = alan(g, 'media:description').replace(/\s+/g, ' ').trim();
    const gorunum = (g.match(/views="(\d+)"/) || [])[1] || null;
    const bag = (g.match(/<link[^>]+href="([^"]+)"/) || [])[1] || `https://www.youtube.com/watch?v=${id}`;
    return {
      id,
      baslik,
      hamBaslik,
      etiketler,
      aciklama: aciklama.slice(0, 400),
      yayin: alan(g, 'published'),
      bag,
      kisa: bag.includes('/shorts/'),
      gorunum: gorunum ? Number(gorunum) : null,
      kucukResim: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }).filter((v) => v.id);
}

/* --------------------------------------------------- Shorts sekmesi (opsiyonel) */
/* YouTube'un iç veri yapısı haber vermeden değişebilir. Bu yüzden burada
   olabilecek her hata yutulur: zenginleştirme başarısız olursa sayfa yine
   RSS ile üretilir. */
async function shortsOku() {
  try {
    const yanit = await fetch(SHORTS_SEKME, { headers: { 'user-agent': TARAYICI_UA } });
    if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
    const html = await yanit.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!m) throw new Error('ytInitialData bulunamadı');
    const veri = JSON.parse(m[1]);

    const bulunan = [];
    const gez = (o) => {
      if (Array.isArray(o)) { o.forEach(gez); return; }
      if (!o || typeof o !== 'object') return;
      const lk = o.shortsLockupViewModel;
      if (lk && typeof lk === 'object') {
        const id = (JSON.stringify(lk).match(/"videoId":"([\w-]{11})"/) || [])[1];
        const om = lk.overlayMetadata || {};
        const baslik = om.primaryText?.content || lk.accessibilityText;
        const izlenme = om.secondaryText?.content || null;
        if (id && baslik) bulunan.push({ id, hamBaslik: baslik.trim(), izlenmeMetni: izlenme });
      }
      Object.values(o).forEach(gez);
    };
    gez(veri);

    const benzersiz = new Map();
    for (const v of bulunan) if (!benzersiz.has(v.id)) benzersiz.set(v.id, v);
    return [...benzersiz.values()].map((v) => {
      const { baslik, etiketler } = basligiAyir(v.hamBaslik);
      return {
        id: v.id,
        baslik,
        hamBaslik: v.hamBaslik,
        etiketler,
        izlenmeMetni: v.izlenmeMetni,
        bag: `https://www.youtube.com/shorts/${v.id}`,
        kisa: true,
        kucukResim: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      };
    });
  } catch (e) {
    console.warn(`Shorts sekmesi okunamadı (${e.message}); yalnızca RSS kullanılacak.`);
    return [];
  }
}

/* Yayın tarihi yalnızca YENİ videolar için, videonun kendi sayfasından bir kez
   çekilir; arşivde saklandığı için sonraki çalıştırmalarda tekrar istenmez. */
async function tarihGetir(id) {
  try {
    const yanit = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: { 'user-agent': TARAYICI_UA },
    });
    if (!yanit.ok) return null;
    const html = await yanit.text();
    const m = html.match(/"uploadDate":"([0-9T:+\-]+)"/);
    return m ? new Date(m[1]).toISOString() : null;
  } catch { return null; }
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------- birleştirme */
async function arsiviBirlestir(rssVideolar, shortsVideolar) {
  let eskiler = [];
  if (existsSync(ARSIV)) {
    try { eskiler = JSON.parse(await readFile(ARSIV, 'utf8')).videolar ?? []; }
    catch { eskiler = []; }
  }
  const harita = new Map(eskiler.map((v) => [v.id, v]));
  let eklenen = 0;

  // Önce Shorts sekmesi (zayıf veri), sonra RSS (güçlü veri) yazılır ki
  // RSS'in kesin tarihi ve görüntülenmesi üste gelsin.
  for (const v of [...shortsVideolar, ...rssVideolar]) {
    if (!harita.has(v.id)) eklenen++;
    harita.set(v.id, { ...harita.get(v.id), ...v });
  }

  // Tarihi olmayanlar yalnızca ilk keşifte doldurulur.
  const tarihsiz = [...harita.values()].filter((v) => !v.yayin);
  if (tarihsiz.length) {
    console.log(`${tarihsiz.length} videonun yayın tarihi çekiliyor...`);
    for (const v of tarihsiz) {
      const t = await tarihGetir(v.id);
      if (t) harita.set(v.id, { ...harita.get(v.id), yayin: t });
      await bekle(220);                       // nazik olalım
    }
  }

  const hepsi = [...harita.values()]
    .filter((v) => v.yayin)
    .sort((a, b) => (a.yayin < b.yayin ? 1 : -1));
  await mkdir(path.dirname(ARSIV), { recursive: true });
  await writeFile(ARSIV, JSON.stringify({
    kanal: 'Dr. Ecz. Fidan Pesen Özdoğan',
    kanalUrl: 'https://www.youtube.com/@fidanpesen',
    guncelleme: new Date().toISOString().slice(0, 10),
    videolar: hepsi,
  }, null, 2) + '\n', 'utf8');
  return { hepsi, eklenen };
}

/* --------------------------------------------------------------- sayfa */
function sayfaUret(videolar, guncelleme) {
  const url = `${SITE}/videolar`;
  const tr = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const tarihYaz = (i) => tr.format(new Date(i));
  const sayiYaz = (n) => (n == null ? '' : new Intl.NumberFormat('tr-TR').format(n));

  const kartlar = videolar.map((v) => `
        <li class="video-kart${v.kisa ? ' dikey' : ''}">
          <button class="video-kapak" type="button" data-video="${kacir(v.id)}"
                  aria-label="${kacir(v.baslik)} videosunu oynat">
            <img src="${kacir(v.kucukResim)}" alt="" width="480" height="360" loading="lazy" decoding="async">
            <span class="video-oynat" aria-hidden="true"></span>
            ${v.kisa ? '<span class="video-rozet">Shorts</span>' : ''}
          </button>
          <div class="video-govde">
            <h3><a href="${kacir(v.bag)}" target="_blank" rel="noopener">${kacir(v.baslik)}</a></h3>
            <p class="video-ust">
              <time datetime="${kacir(v.yayin.slice(0, 10))}">${tarihYaz(v.yayin)}</time>
              ${v.gorunum
                ? `<span>·</span><span>${sayiYaz(v.gorunum)} görüntülenme</span>`
                : v.izlenmeMetni ? `<span>·</span><span>${kacir(v.izlenmeMetni)}</span>` : ''}
            </p>
            ${v.etiketler.length ? `<p class="video-etiket">${v.etiketler.slice(0, 4).map((e) => `<span>#${kacir(e)}</span>`).join('')}</p>` : ''}
          </div>
        </li>`).join('');

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}/#webpage`,
        url,
        name: 'Videolar | Dr. Ecz. Fidan Pesen Özdoğan',
        description: 'Dr. Ecz. Fidan Pesen Özdoğan’ın YouTube kanalındaki güncel videolar: şifalı bitkiler, mizaç, doğal bakım ve geleneksel tıp anlatımları.',
        inLanguage: 'tr-TR',
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#fidan-pesen-ozdogan` },
        dateModified: guncelleme,
        breadcrumb: { '@id': `${url}/#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Videolar' },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${url}/#liste`,
        name: 'Dr. Ecz. Fidan Pesen Özdoğan videoları',
        numberOfItems: videolar.length,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        itemListElement: videolar.map((v, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'VideoObject',
            '@id': `https://www.youtube.com/watch?v=${v.id}`,
            name: v.baslik,
            description: v.aciklama || v.baslik,
            thumbnailUrl: [v.kucukResim],
            uploadDate: v.yayin,
            contentUrl: v.bag,
            embedUrl: `https://www.youtube.com/embed/${v.id}`,
            inLanguage: 'tr-TR',
            creator: { '@id': `${SITE}/#fidan-pesen-ozdogan` },
            publisher: { '@id': `${SITE}/#fidan-pesen-ozdogan` },
            keywords: v.etiketler.join(', ') || undefined,
            ...(v.gorunum ? {
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/WatchAction',
                userInteractionCount: v.gorunum,
              },
            } : {}),
          },
        })),
      },
      {
        '@type': 'Person',
        '@id': `${SITE}/#fidan-pesen-ozdogan`,
        name: 'Fidan Pesen Özdoğan',
        honorificPrefix: 'Dr. Ecz.',
        url: `${SITE}/`,
        sameAs: [
          'https://www.dogalmarkam.com/',
          'https://www.instagram.com/fidanpesen/',
          'https://www.instagram.com/dogalmarkambor/',
          'https://www.youtube.com/@fidanpesen',
          'https://x.com/pesenfidan',
          'https://www.facebook.com/dogalmarkambor/',
          'https://tr.linkedin.com/in/fidan-pesen-ozdogan-a4392b125',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: 'Dr. Ecz. Fidan Pesen Özdoğan',
        inLanguage: 'tr-TR',
        publisher: { '@id': `${SITE}/#fidan-pesen-ozdogan` },
      },
    ],
  };

  const baslik = 'Videolar | Dr. Ecz. Fidan Pesen Özdoğan';
  const aciklama = 'Dr. Ecz. Fidan Pesen Özdoğan’ın YouTube kanalındaki güncel videolar: şifalı bitkiler, mizaç, doğal bakım ve geleneksel tıp anlatımları.';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem('fpo_tema');document.documentElement.dataset.tema=(t==='koyu'||t==='acik')?t:'acik';}catch(e){document.documentElement.dataset.tema='koyu';}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${baslik}</title>
<meta name="description" content="${aciklama}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="author" content="Dr. Ecz. Fidan Pesen Özdoğan">
<meta name="theme-color" content="#fbf8f1">
<link rel="alternate" hreflang="tr" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dr. Ecz. Fidan Pesen Özdoğan">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${baslik}">
<meta property="og:description" content="${aciklama}">
<meta property="og:image" content="${SITE}/assets/img/portre-atolye.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@PesenFidan">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<link rel="stylesheet" href="/assets/css/style.css?v=17">
<link rel="stylesheet" href="/assets/css/makale.css?v=17">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' fill='none'><path d='M22 36V14' stroke='%23a8842c' stroke-width='3' stroke-linecap='round'/><path d='M22 22.6c-6 0-9.6-3.6-9.6-9.6 6 0 9.6 3.6 9.6 9.6Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/><path d='M22 18c0-6.6 3.8-10.4 10.4-10.4 0 6.6-3.8 10.4-10.4 10.4Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/></svg>">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body class="makale-govde">

<div class="makale-zemin" aria-hidden="true"></div>

<header class="ust-bar">
  <a class="marka" href="/">
    <span class="marka-mim" aria-hidden="true">
      <svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="20.2" stroke="currentColor" stroke-width="1" opacity=".38"/><circle cx="22" cy="1.8" r="1.25" fill="currentColor" opacity=".55"/><circle cx="42.2" cy="22" r="1.25" fill="currentColor" opacity=".55"/><circle cx="22" cy="42.2" r="1.25" fill="currentColor" opacity=".55"/><circle cx="1.8" cy="22" r="1.25" fill="currentColor" opacity=".55"/><path d="M22 34.5V15.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M22 22.6c-5.3 0-8.5-3.2-8.5-8.5 5.3 0 8.5 3.2 8.5 8.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M22 18.4c0-5.9 3.4-9.2 9.3-9.2 0 5.9-3.4 9.2-9.3 9.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M17.6 34.5h8.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".65"/></svg>
    </span>
    <span class="marka-yazi"><b>Dr. Ecz. Fidan Pesen Özdoğan</b></span>
  </a>
  <nav class="menu" id="menu">
    <a href="/fitoterapi">Fitoterapi</a>
    <a href="/cilt-bakimi">Cilt Bakımı</a>
    <a href="/sac-bakimi">Saç Bakımı</a>
    <a href="/gida-takviyeleri">Gıda Takviyeleri</a>
    <a href="/geleneksel-tip">Geleneksel Tıp</a>
    <a href="/videolar">Videolar</a>
    <a href="/sss">SSS</a>
    <a class="menu-cta" href="/asistan">Asistan</a>
  </nav>
  <button class="tema-dugme" id="temaDugme" type="button" aria-pressed="false" aria-label="Aydınlık moda geç" title="Aydınlık mod">
    <svg class="t-ay" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z"/></svg>
    <svg class="t-gunes" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></svg>
  </button>
  <button class="menu-dugme" id="menuDugme" aria-label="Menüyü aç" aria-expanded="false"><span></span><span></span></button>
</header>

<main>
  <div class="makale-basi">
    <div class="kap">
      <ol class="kirinti">
        <li><a href="/">Ana sayfa</a></li>
        <li>Videolar</li>
      </ol>
      <h1>Videolar</h1>
      <p class="makale-ozet">
        Dr. Ecz. Fidan Pesen Özdoğan’ın <a href="https://www.youtube.com/@fidanpesen" target="_blank" rel="noopener">YouTube kanalındaki</a>
        güncel videoları. Şifalı bitkiler, mizaç, doğal bakım ve geleneksel tıp
        üzerine kısa anlatımlar. Liste kanalın resmî beslemesinden otomatik
        güncellenir.
      </p>
      <div class="makale-kimlik">
        <img src="/assets/img/portre-kunye.jpg" alt="Dr. Ecz. Fidan Pesen Özdoğan" width="40" height="40" loading="lazy" decoding="async">
        <span><b>${videolar.length}</b> video · ${videolar.filter((v) => v.kisa).length} Shorts</span>
        <span>Güncelleme: <time datetime="${guncelleme}">${tarihYaz(guncelleme)}</time></span>
      </div>
    </div>
  </div>

  <div class="kap video-kap">
    <ul class="video-izgara">${kartlar}
    </ul>

    <div class="kanal-cta">
      <div>
        <h2>Tüm arşiv YouTube’da</h2>
        <p>Bu sayfada kanalın son videoları listelenir. Tamamı ve oynatma
           listeleri için kanala göz atın.</p>
      </div>
      <a class="dugme birincil" href="https://www.youtube.com/@fidanpesen" target="_blank" rel="noopener">Kanala git ↗</a>
    </div>

    <div class="sosyal-cta">
      <a class="sosyal-blok" href="https://www.instagram.com/fidanpesen/" target="_blank" rel="noopener">
        <span class="sosyal-ad">Instagram</span>
        <b>@fidanpesen</b>
        <p>Günlük mizaç ve bitki anlatımları, reels arşivi.</p>
      </a>
      <a class="sosyal-blok" href="https://www.instagram.com/dogalmarkambor/" target="_blank" rel="noopener">
        <span class="sosyal-ad">Instagram · Marka</span>
        <b>@dogalmarkambor</b>
        <p>Doğal Markam ürün ve üretim içerikleri.</p>
      </a>
      <a class="sosyal-blok" href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">
        <span class="sosyal-ad">Mağaza</span>
        <b>dogalmarkam.com</b>
        <p>Formülasyonların resmî satış noktası.</p>
      </a>
    </div>

    <p class="sorumluluk">
      <b>Sorumluluk reddi.</b> Bu sayfa, Dr. Ecz. Fidan Pesen Özdoğan’ın YouTube
      kanalındaki videoların bir listesidir; video başlıkları kanaldan olduğu gibi
      aktarılmıştır. İçerikler genel bilgilendirme amaçlıdır, tıbbi teşhis, tedavi
      ya da reçete yerine geçmez. Bitkisel ürünler ve takviye edici gıdalar
      hastalıkları önleme, tedavi etme veya iyileştirme amacıyla kullanılamaz.
      Kullandığınız ilaçlar, gebelik, emzirme ve kronik hastalık durumlarında
      hekiminize ve eczacınıza danışın.
    </p>
  </div>
</main>

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
    <p class="dip-uyari">
      Bu sitedeki bilgiler kamuya açık kaynaklardan derlenmiş biyografik ve
      kültürel içeriktir. Hiçbir bölümü tıbbi teşhis, tedavi veya reçete yerine
      geçmez. Sağlık kararlarınız için hekiminize danışın.
      Görseller Doğal Markam / Dr. Ecz. Fidan Pesen Özdoğan arşivine aittir.
    </p>
  </div>
</footer>

<script src="/assets/js/sayfa.js?v=17"></script>
<script src="/assets/js/tema.js?v=17"></script>
<script src="/assets/js/asistan-baloncuk.js?v=17" defer></script>
<script>
/* Tıklanana kadar YouTube'dan hiçbir şey yüklenmez (facade deseni):
   kapak görseli i.ytimg.com'dan gelir, oynatıcı yalnızca tıklamada eklenir. */
document.querySelectorAll('.video-kapak').forEach(function (d) {
  d.addEventListener('click', function () {
    var id = d.dataset.video;
    var ç = document.createElement('div');
    ç.className = 'video-cerceve';
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    f.title = d.getAttribute('aria-label') || 'Video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.allowFullscreen = true;
    f.loading = 'lazy';
    ç.appendChild(f);
    d.replaceWith(ç);
  }, { once: true });
});
</script>
</body>
</html>
`;
}

/* --------------------------------------------------------------- çalıştır */
const rssVideolar = await rssOku();
const shortsVideolar = await shortsOku();
const { hepsi, eklenen } = await arsiviBirlestir(rssVideolar, shortsVideolar);
const guncelleme = new Date().toISOString().slice(0, 10);
await mkdir(path.dirname(CIKTI), { recursive: true });
await writeFile(CIKTI, sayfaUret(hepsi, guncelleme), 'utf8');
/* Ana sayfadaki "Video Arşivi" kartının küçük resim kapağını tazele. Kapak
   yalnızca uzun videolardan seçilir; Shorts kapakları dikey olduğu için
   yatay kutuda kırpılıyor. İşaretçiler arası satırlar değişir, kartın
   gerisi elle yazılmış hâliyle kalır. */
try {
  const ANA = path.join(KOK_DIZIN, 'index.html');
  const secilen = hepsi.filter((v) => !v.kisa)[0];
  if (secilen) {
    const kucuk = `https://i.ytimg.com/vi/${secilen.id}/mqdefault.jpg`;
    const buyuk = `https://i.ytimg.com/vi/${secilen.id}/hq720.jpg`;
    // hq720 her videoda bulunmaz; yoksa srcset yazmıyoruz ki kırık
    // görsel çıkmasın. mqdefault her zaman vardır ve 16:9'dur.
    let buyukVar = false;
    try { buyukVar = (await fetch(buyuk, { method: 'HEAD', headers: { 'user-agent': UA } })).ok; }
    catch { /* ağ hatasında küçük görselle yetin */ }
    const serit =
      '<!-- KUCUKLER:BAS --><span class="medya-onizleme" aria-hidden="true">\n' +
      `          <img src="${kucuk}"\n` +
      (buyukVar
        ? `               srcset="${kucuk} 320w,\n                       ${buyuk} 1280w"\n` +
          '               sizes="(max-width: 700px) 88vw, 420px"\n'
        : '') +
      '               alt="" width="1280" height="720" loading="lazy" decoding="async">\n' +
      '          <span class="oynat"></span>\n' +
      '        </span><!-- KUCUKLER:SON -->';
    const ana = await readFile(ANA, 'utf8');
    const yeni = ana.replace(/<!-- KUCUKLER:BAS -->[\s\S]*?<!-- KUCUKLER:SON -->/, serit);
    if (yeni !== ana) await writeFile(ANA, yeni, 'utf8');
  }
} catch (e) {
  console.warn(`Ana sayfa şeridi güncellenemedi: ${e.message}`);
}

const kisaSayi = hepsi.filter((v) => v.kisa).length;
console.log(
  `RSS: ${rssVideolar.length} · Shorts sekmesi: ${shortsVideolar.length} · ` +
  `yeni: ${eklenen} · arşiv: ${hepsi.length} (${kisaSayi} Shorts)`);
console.log(`Yazıldı: ${path.relative(KOK_DIZIN, CIKTI)} ve ${path.relative(KOK_DIZIN, ARSIV)}`);

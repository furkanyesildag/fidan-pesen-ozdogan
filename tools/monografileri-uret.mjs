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

import {
  SITE, SURUM, BUGUN, BUGUN_YAZI, kacis, duz, sade, ustSimge, cinsleriKur,
  latinceIsaretle, paragrafYaz, tabloYaz, bas, dip, YAZAR_KART, SORUMLULUK,
  KISI_LD, KURULUS_LD,
} from './_kabuk.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERI = path.join(KOK, 'data', 'monografiler.json');
const CIKTI = path.join(KOK, 'monografi');

/** Boşluksuz sadeleştirme: "civan perçemli" ile "civanperçemi" eşleşsin diye. */
const sikis = (m) => sade(m).replace(/\s+/g, '');

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

/* --------------------------------------------------------- monografi sayfa */
function monografiSayfa(m, komsu, urunler) {
  const bol = Object.fromEntries(m.bolumler.map((b) => [b.kimlik, b]));
  const sss = sssUret(m, bol);
  /* Başlık arama sonucunda kırpılmasın diye 62 karakteri aşmıyor: "Monografisi"
     kelimesi ancak sığdığında giriyor, sığmadığında botanik ad tek başına
     kalıyor. Açıklama da 160'ı aşmıyor. */
  const MARKA = ' | Dr. Ecz. Fidan Pesen';
  const latin = m.latince ? ` (${m.latince})` : '';
  const uzunAd = `${m.ad} Monografisi${latin}`;
  const baslik = (uzunAd + MARKA).length <= 62 ? uzunAd + MARKA : `${m.ad}${latin}${MARKA}`;
  const aciklama = duz(`${m.ad}${latin} monografisi: botanik sınıflandırma, kimyasal `
    + `bileşenler, farmakopeler, geleneksel kullanım, yan etki ve ilaç etkileşimleri.`);

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
      KISI_LD,
      KURULUS_LD,
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
  const baslik = 'Bitki Monografileri Arşivi | Dr. Ecz. Fidan Pesen';
  const aciklama = duz(`${hepsi.length} tıbbi bitkinin tam monografisi: botanik `
    + `sınıflandırma, kimyasal bileşenler, farmakopeler, geleneksel kullanım `
    + `ve ilaç etkileşimleri.`);

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
      KISI_LD,
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

/* Cins sözlüğü tüm monografi metninden kuruluyor; ortak kabuk bu sözlükle
   yalnızca gerçek Latince ikilileri italik yazıyor. */
cinsleriKur(
  veri.monografiler.map((m) => m.bolumler.map((b) => b.govde
    .map(([t, i]) => (t === 'p' ? i : '')).join(' ')).join(' ')
    + ' ' + m.taksonomi.map(([, d]) => d).join(' ') + ' ' + (m.latinceTam || '')).join(' '),
  veri.monografiler.flatMap((m) => [m.cins?.replace(/[^A-Za-z]/g, ''),
    m.latince?.split(' ')[0]]),
);

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

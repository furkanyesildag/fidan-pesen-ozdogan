#!/usr/bin/env node
/**
 * herbalizm-uret.mjs
 * ---------------------------------------------------------------------------
 * data/herbalizm.json (MEDİKAL HERBALİZM belgesi) üzerinden üç sayfa üretir:
 *
 *   /medikal-herbalizm  → fitoterapinin tanımı, yaygınlığı, yasal statüsü,
 *                         bilimsel dayanakları, sinerji ve polivalans
 *   /bitki-kimyasi      → tıbbi bitkilerin kimyasal bileşenleri: fenolikler,
 *                         flavonoidler, terpenler, glikozidler, alkaloidler…
 *   /vitamin-mineral    → vitaminler ve mineraller tek tek
 *
 * Belge tek parça, ancak üç ayrı konu kümesi taşıyor. Tek sayfaya sığdırmak
 * 30.000 kelimelik bir duvar demek olurdu; ayırınca her sayfa kendi soru
 * kümesine karşılık geliyor ve içindekiler kullanılabilir kalıyor.
 *
 * Bölümlerin hangi sayfaya ve hangi başlık düzeyine gideceği aşağıda başlık
 * adıyla tanımlı; belge sırası korunuyor.
 *
 *   node tools/herbalizm-uret.mjs
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE, BUGUN, BUGUN_YAZI, kacis, duz, kimlik, govdeYaz, cinsleriKur, baslikDuzelt,
  latinceIsaretle, bas, dip, YAZAR_KART, SORUMLULUK, KISI_LD, KURULUS_LD,
} from './_kabuk.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERI = path.join(KOK, 'data', 'herbalizm.json');

/* Sayfa tanımları. `bas` ve `son` belgedeki bölüm başlıklarıdır (dahil).
   `ust` kümesindeki başlıklar h2, geri kalanı bir önceki h2'nin altında h3
   olur. `araBaslik` ise belgede olmayan ama gezinme için gereken üst
   başlıkları ekler: vitaminlerle mineralleri ayırmak gibi. */
const SAYFALAR = [
  {
    yol: 'medikal-herbalizm',
    ilk: 'Paraherbalizm',
    son: 'Fitoterapinin Bilimsel Dayanakları',
    ayrica: ['Sinerji ve Polivalans'],
    ust: null,                                  // her bölüm h2
    h1: 'Medikal Herbalizm ve Fitoterapi',
    baslik: 'Medikal Herbalizm ve Fitoterapi Nedir? | Dr. Ecz. Fidan Pesen Özdoğan',
    aciklama: 'Medikal herbalizm ve fitoterapi nedir, paraherbalizmden farkı '
      + 'nedir? Fitoterapinin dünyada ve Türkiye\'de kullanım yaygınlığı, '
      + 'bitkisel ürünlerin yasal statüsü, bilimsel dayanakları, sinerji ve '
      + 'polivalans kavramları. Dr. Ecz. Fidan Pesen Özdoğan\'ın derlemesi.',
    ozet: 'Fitoterapi, bitkiyi bir inanç nesnesi değil bir ilaç hammaddesi '
      + 'olarak ele alan bilim dalıdır. Bu sayfa alanın tanımını, bilimsel '
      + 'dayanaklarını, dünyada ve Türkiye\'deki yerini, bitkisel ürünlerin '
      + 'yasal statüsünü ve bir bitkinin neden tek bir moleküle indirgenemediğini '
      + 'anlatan sinerji ve polivalans kavramlarını bir arada topluyor.',
    anahtar: ['medikal herbalizm', 'fitoterapi nedir', 'paraherbalizm',
      'bitkisel tedavi', 'fitoterapi bilimsel dayanak', 'sinerji', 'polivalans'],
  },
  {
    yol: 'bitki-kimyasi',
    ilk: 'TIBBİ BİTKİLERİN KİMYASAL BİLEŞENLERİ',
    son: 'Proteinler',
    ust: new Set(['TIBBİ BİTKİLERİN KİMYASAL BİLEŞENLERİ', 'Primer Bitki Metabolitleri',
      'Sekonder Bitki Metabolitleri', 'Fenolik Bileşenler (Fenoller ve Polifenoller)',
      'Terpenler (İzoprenoidler)', 'Glikozidler', 'Alkaloidler ve Aminler',
      'Karbonhidratlar ve türevleri', 'Lipidler', 'Amino asitler ve türevleri',
      'Proteinler']),
    h1: 'Tıbbi Bitkilerin Kimyasal Bileşenleri',
    baslik: 'Bitki Kimyası: Flavonoid, Tanen, Saponin, Alkaloid Nedir? | Dr. Ecz. Fidan Pesen Özdoğan',
    aciklama: 'Tıbbi bitkilerdeki etken maddeler: fenolik bileşenler, '
      + 'flavonoidler, tanenler, kumarinler, antrakinonlar, terpenler, uçucu '
      + 'yağlar, saponinler, glikozidler, alkaloidler, polisakkaritler. Her '
      + 'bileşen sınıfının tanımı, hangi bitkilerde bulunduğu ve ne yaptığı.',
    ozet: 'Bir bitkinin ne yaptığını anlamak, içinde ne olduğunu bilmekle '
      + 'başlar. Bu sayfa tıbbi bitkilerdeki etken madde sınıflarını sırayla '
      + 'ele alıyor: primer ve sekonder metabolitler, fenolik bileşenler ve '
      + 'flavonoidler, tanenler, kumarinler, kinonlar, terpenler ve uçucu '
      + 'yağlar, saponinler ve kardiyak glikozidleri, alkaloidler, '
      + 'karbonhidratlar, lipidler ve proteinler.',
    anahtar: ['flavonoid nedir', 'tanen nedir', 'saponin nedir', 'alkaloid nedir',
      'terpen', 'sekonder metabolit', 'bitki kimyası', 'fitokimyasal',
      'antrakinon', 'kumarin', 'polisakkarit', 'kardiyak glikozit'],
  },
  {
    yol: 'vitamin-mineral',
    ilk: 'Vitamin ve mineraller',
    son: 'Potasyum (K)',
    ust: new Set(['Vitamin ve mineraller']),
    araBaslik: { 'B1 vitamini (Tiamin)': 'Vitaminler', 'Kalsiyum (Ca)': 'Mineraller' },
    h1: 'Vitaminler ve Mineraller',
    baslik: 'Vitaminler ve Mineraller: Görevleri, Kaynakları, Eksikliği | Dr. Ecz. Fidan Pesen Özdoğan',
    aciklama: 'B1, B2, B3, B5, B6, B12, biotin, folat, C, A, D, E, K '
      + 'vitaminleri ile kalsiyum, magnezyum, fosfor, krom, bakır, iyot, '
      + 'demir, manganez, molibden, selenyum, çinko ve potasyum: her birinin '
      + 'vücuttaki görevi, besin kaynakları ve eksiklik belirtileri.',
    ozet: 'Vitaminler ve mineraller, vücudun kendi üretemediği ya da yeterince '
      + 'üretemediği için dışarıdan almak zorunda olduğu bileşenlerdir. Bu '
      + 'sayfa on üç vitamini ve on üç minerali tek tek ele alıyor: her birinin '
      + 'vücuttaki görevi, hangi besinlerde bulunduğu ve eksikliğinde ne '
      + 'olduğu.',
    anahtar: ['b12 vitamini', 'd vitamini', 'c vitamini', 'demir eksikliği',
      'çinko', 'magnezyum', 'folik asit', 'selenyum', 'vitamin görevleri',
      'mineral kaynakları', 'vitamin eksikliği belirtileri'],
  },
];

/* --------------------------------------------------------------- yardımcı */
const veri = JSON.parse(await readFile(VERI, 'utf8'));
const kitap = veri.kitap;

cinsleriKur(kitap.bolumler
  .map((b) => b.govde.map(([t, i]) => (t === 'p' ? i : '')).join(' ')).join(' '));

const sirali = kitap.bolumler;
const dizin = (ad) => sirali.findIndex((b) => b.baslik === ad);

/** Sayfa için bölümleri belge sırasında seçer. */
function bolumSec(s) {
  const a = dizin(s.ilk);
  const b = dizin(s.son);
  if (a < 0 || b < 0) throw new Error(`Bölüm bulunamadı: ${s.ilk} / ${s.son}`);
  const secim = sirali.slice(a, b + 1);
  for (const ek of s.ayrica ?? []) {
    const i = dizin(ek);
    if (i >= 0) secim.push(sirali[i]);
  }
  return secim;
}

/**
 * Bölümleri h2 ve altındaki h3'lere yerleştirir. İçindekiler yalnızca h2
 * düzeyini listeler; 40 satırlık bir içindekiler kimseye yaramıyor.
 */
function agacKur(bolumler, s) {
  const agac = [];
  for (const b of bolumler) {
    const ara = s.araBaslik?.[b.baslik];
    if (ara) agac.push({ baslik: ara, kimlik: kimlik(ara), sentetik: true, govde: [], alt: [] });
    const ustMu = !s.ust || s.ust.has(b.baslik);
    if (ustMu || !agac.length) {
      agac.push({ baslik: b.baslik, kimlik: kimlik(b.baslik), govde: b.govde, alt: [] });
    } else {
      agac[agac.length - 1].alt.push({ baslik: b.baslik, kimlik: kimlik(b.baslik), govde: b.govde });
    }
  }
  return agac;
}

/** Bölüm metninden SSS cevabı çıkarır. */
function cevap(govde, sinir = 400) {
  for (const [tur, icerik] of govde) {
    if (tur !== 'p' || icerik.length < 80) continue;
    let s = '';
    for (const c of icerik.split(/(?<=[.!?])\s+/)) {
      if (s && s.length + c.length > sinir) break;
      s += (s ? ' ' : '') + c;
    }
    if (!s) s = icerik.slice(0, sinir);
    return s.replace(/(?<=[.!?])\d+(?:[-–,]\d+)*(?=\s|$)/g, '')
      .replace(/\s*\d+(?:[-–,]\d+)*$/, '').trim();
  }
  return '';
}

function sssUret(agac) {
  const soru = [];
  for (const ust of agac) {
    for (const b of [ust, ...ust.alt]) {
      if (!b.govde?.length) continue;
      const c = cevap(b.govde);
      if (c.length < 90) continue;
      const ad = baslikDuzelt(b.baslik).replace(/\s*\(.*?\)\s*$/, '').trim();
      soru.push([`${ad} nedir?`, c]);
      if (soru.length >= 12) return soru;
    }
  }
  return soru;
}

/* ----------------------------------------------------------------- sayfa */
function sayfaUret(s, komsular) {
  const agac = agacKur(bolumSec(s), s);
  const sss = sssUret(agac);
  const kelime = agac.reduce((a, u) => a + [u, ...u.alt].reduce(
    (x, b) => x + b.govde.filter(([t]) => t === 'p')
      .reduce((y, [, i]) => y + i.split(/\s+/).length, 0), 0), 0);

  const ldJson = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Article', 'MedicalWebPage'],
        '@id': `${SITE}/${s.yol}/#article`,
        headline: s.h1,
        name: duz(s.baslik),
        description: duz(s.aciklama),
        inLanguage: 'tr-TR',
        datePublished: BUGUN,
        dateModified: BUGUN,
        wordCount: kelime,
        articleSection: 'Fitoterapi',
        keywords: s.anahtar.join(', '),
        author: { '@id': `${SITE}/#kisi` },
        publisher: { '@id': `${SITE}/#kurulus` },
        mainEntityOfPage: `${SITE}/${s.yol}`,
        citation: kitap.kaynakca.slice(0, 60).map(duz),
        hasPart: agac.filter((u) => !u.sentetik || u.alt.length).map((u) => ({
          '@type': 'WebPageElement',
          name: baslikDuzelt(u.baslik),
          url: `${SITE}/${s.yol}#${u.kimlik}`,
        })),
      },
      KISI_LD,
      KURULUS_LD,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE },
          { '@type': 'ListItem', position: 2, name: s.h1, item: `${SITE}/${s.yol}` },
        ],
      },
      ...(sss.length ? [{
        '@type': 'FAQPage',
        '@id': `${SITE}/${s.yol}/#sss`,
        mainEntity: sss.map(([q, a]) => ({
          '@type': 'Question',
          name: duz(q),
          acceptedAnswer: { '@type': 'Answer', text: duz(a) },
        })),
      }] : []),
    ],
  };

  const govde = agac.map((u) => {
    const kendi = u.govde.length ? `\n        ${govdeYaz(u.govde)}` : '';
    const alt = u.alt.map((b) => `
        <h3 id="${b.kimlik}">${kacis(baslikDuzelt(b.baslik))}</h3>
        ${govdeYaz(b.govde)}`).join('\n');
    return `
      <section id="${u.kimlik}">
        <h2>${kacis(baslikDuzelt(u.baslik))}</h2>${kendi}
${alt}
      </section>`;
  }).join('\n');

  const sssBlok = sss.length ? `
      <section id="sss">
        <h2>Sık sorulan sorular</h2>
        <div class="sss-liste">
${sss.map(([q, a], i) => `          <details${i === 0 ? ' open' : ''}>
            <summary>${kacis(q)}</summary>
            <div class="sss-cevap"><p>${latinceIsaretle(kacis(a))}</p></div>
          </details>`).join('\n')}
        </div>
      </section>` : '';

  const kaynakBlok = `
      <section id="kaynakca">
        <h2>Kaynakça</h2>
        <p>Aşağıdaki liste, Medikal Herbalizm derlemesinin tamamının kaynakçasıdır;
        metindeki üst simge numaralar bu listeye işaret eder.</p>
        <details class="kaynak-katla">
          <summary>${kitap.kaynakca.length} kaynağı göster</summary>
          <ol class="kaynak-liste">
${kitap.kaynakca.map((k) => `            <li>${latinceIsaretle(kacis(k))}</li>`).join('\n')}
          </ol>
        </details>
      </section>`;

  const icindekiler = [
    ...agac.map((u) => [u.kimlik, u.baslik]),
    ...(sss.length ? [['sss', 'Sık sorulan sorular']] : []),
    ['kaynakca', 'Kaynakça'],
  ];

  return bas({ yol: `/${s.yol}`, baslik: s.baslik, aciklama: s.aciklama, ldJson }) + `
<main>
  <div class="makale-basi">
    <div class="kap">
      <ol class="kirinti">
        <li><a href="/">Ana sayfa</a></li>
        <li>${kacis(s.h1)}</li>
      </ol>
      <h1>${kacis(s.h1)}</h1>
      <p class="makale-ozet">${kacis(s.ozet)}</p>
      <div class="makale-kimlik">
        <img src="/assets/img/portre-kunye.jpg" alt="Dr. Ecz. Fidan Pesen Özdoğan" width="40" height="40" loading="lazy" decoding="async">
        <span>Derleyen <b>Dr. Ecz. Fidan Pesen Özdoğan</b>, Uzman Eczacı</span>
        <span>${kitap.kaynakca.length} kaynak · ${kelime.toLocaleString('tr-TR')} kelime</span>
        <span>Güncelleme: <time datetime="${BUGUN}">${BUGUN_YAZI}</time></span>
      </div>
    </div>
  </div>

  <div class="makale-duzen">
    <article class="makale">
${govde}
${sssBlok}
${kaynakBlok}
      <div class="makale-son">
${YAZAR_KART}
        <div class="ilgili">
          <h2>İlgili sayfalar</h2>
          <div class="ilgili-izgara">
${komsular.map(([y, a, n]) => `        <a href="/${y}">${kacis(a)}<span>${kacis(n)}</span></a>`).join('\n')}
          </div>
        </div>
${SORUMLULUK}
      </div>
    </article>

    <aside class="icindekiler" aria-label="İçindekiler">
      <h2>İçindekiler</h2>
      <ol>
${icindekiler.map(([k, b]) => `        <li><a href="#${k}">${kacis(baslikDuzelt(b))}</a></li>`).join('\n')}
      </ol>
    </aside>
  </div>
</main>
` + dip();
}

/* ------------------------------------------------------------------- akış */
const ILGILI = {
  'medikal-herbalizm': [
    ['bitki-kimyasi', 'Tıbbi Bitkilerin Kimyasal Bileşenleri', 'Flavonoid, tanen, saponin, alkaloid'],
    ['monografi', 'Bitki Monografileri', '29 tıbbi bitkinin tam monografisi'],
    ['vitamin-mineral', 'Vitaminler ve Mineraller', 'Görevleri, kaynakları, eksiklikleri'],
    ['geleneksel-tip', 'Geleneksel Tıp ve Mizaç', 'Dört unsur ve mizaç tipleri'],
  ],
  'bitki-kimyasi': [
    ['monografi', 'Bitki Monografileri', 'Hangi bitkide hangi bileşen var'],
    ['medikal-herbalizm', 'Medikal Herbalizm ve Fitoterapi', 'Alanın tanımı ve dayanakları'],
    ['ucucu-yaglar', 'Uçucu Yağlar', 'Terpenlerin en bilinen hâli'],
    ['vitamin-mineral', 'Vitaminler ve Mineraller', 'Görevleri, kaynakları, eksiklikleri'],
  ],
  'vitamin-mineral': [
    ['gida-takviyeleri', 'Bitkisel Gıda Takviyeleri', 'Etiket okuma ve etkileşimler'],
    ['bitki-kimyasi', 'Tıbbi Bitkilerin Kimyasal Bileşenleri', 'Bitkideki etken madde sınıfları'],
    ['monografi', 'Bitki Monografileri', '29 tıbbi bitkinin tam monografisi'],
    ['asistan', "Fidan'ın Asistanı", 'Size uygun ürünü birlikte bulalım'],
  ],
};

for (const s of SAYFALAR) {
  const dizinYol = path.join(KOK, s.yol);
  await mkdir(dizinYol, { recursive: true });
  const html = sayfaUret(s, ILGILI[s.yol]);
  await writeFile(path.join(dizinYol, 'index.html'), html, 'utf8');
  console.log(`Yazıldı: ${s.yol}/index.html · ${(html.length / 1024).toFixed(0)} KB`);
}
console.log(`${kitap.kaynakca.length} ortak kaynak · ${kitap.kelime.toLocaleString('tr-TR')} kelime`);

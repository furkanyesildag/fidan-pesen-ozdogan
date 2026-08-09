#!/usr/bin/env node
/**
 * urunleri-guncelle.mjs
 * ---------------------------------------------------------------------------
 * dogalmarkam.com'un kendi site haritasından ürün listesini çeker ve
 * data/urunler.json kataloğunu üretir. Asistan sayfası bu dosyayı kullanır.
 *
 * Bağımlılık yok, Node 18+ yeterlidir.
 *   node tools/urunleri-guncelle.mjs
 *
 * ÖNEMLİ TASARIM KARARI
 * Ürün sayfalarındaki pazarlama metinleri buraya OLDUĞU GİBİ taşınmaz.
 * İki sebep var:
 *   1. Aynı metnin iki alan adında bulunması ikisinin de arama başarımını
 *      düşürür (duplicate content).
 *   2. O metinler yer yer sağlık ifadeleri içeriyor; takviye edici gıda ve
 *      kozmetik mevzuatı bu tür beyanları yasaklıyor.
 * Bu yüzden açıklama metni yalnızca ARAMA ANAHTARI üretmek için işlenir,
 * katalogda saklanmaz ve sayfada gösterilmez. Kullanıcıya yalnızca ürün adı,
 * kategorisi ve mağaza bağlantısı gösterilir.
 * ---------------------------------------------------------------------------
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK_DIZIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARITA = 'https://www.dogalmarkam.com/xml/sitemap/product.xml';
const CIKTI = path.join(KOK_DIZIN, 'data', 'urunler.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* Türkçe duyarlı sadeleştirme: küçült, aksanı kaldır, harf/rakam dışını at. */
function sadelestir(m) {
  return String(m ?? '')
    .replace(/I/g, 'ı').replace(/İ/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Anahtar üretmeye değmeyen kelimeler. */
const DOLGU = new Set(`
ve ile veya bir bu su icin gibi olan olarak adet gr ml mg kg li lu lı lü
set paket urun urunu urunler fp pharma dogal markam dogalmarkam
karisik cayi cay yeni ozel numara no
`.trim().split(/\s+/));

function anahtarUret(...metinler) {
  const sayac = new Map();
  for (const m of metinler) {
    for (const k of sadelestir(m).split(' ')) {
      if (k.length < 3 || DOLGU.has(k) || /^\d+$/.test(k)) continue;
      sayac.set(k, (sayac.get(k) ?? 0) + 1);
    }
  }
  return [...sayac.keys()].slice(0, 40);
}

function ldCikar(html) {
  const bloklar = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let urun = null, kirinti = null;
  for (const b of bloklar) {
    try {
      const d = JSON.parse(b[1]);
      if (d['@type'] === 'Product') urun = d;
      if (d['@type'] === 'BreadcrumbList') kirinti = d;
    } catch { /* bozuk blok atlanır */ }
  }
  return { urun, kirinti };
}

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function getir(url) {
  const y = await fetch(url, { headers: { 'user-agent': UA } });
  if (!y.ok) throw new Error(`HTTP ${y.status}`);
  return y.text();
}

/* ------------------------------------------------------------------ akış */
console.log('Site haritası okunuyor...');
const xml = await getir(HARITA);
const baglar = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
console.log(`${baglar.length} ürün bağlantısı bulundu.`);

const urunler = [];
let hata = 0;

for (let i = 0; i < baglar.length; i++) {
  const bag = baglar[i];
  try {
    const html = await getir(bag);
    const { urun, kirinti } = ldCikar(html);
    const ad = urun?.name?.trim();
    if (!ad) throw new Error('Product verisi yok');

    // kırıntıdan kategori: Anasayfa dışındaki son ara basamak
    const basamaklar = (kirinti?.itemListElement ?? [])
      .map((x) => x.name)
      .filter((n) => n && !/^anasayfa$/i.test(n));
    // kırıntı [Anasayfa, Kategori, Ürün] biçiminde; son basamak ürünün kendisidir.
    // Yalnızca [Anasayfa, Ürün] geldiyse kategori yok demektir, ürün adını kategori sanmayalım.
    const kategori = basamaklar.length > 1 ? basamaklar[0] : '';

    // açıklama YALNIZCA anahtar üretmek için kullanılır, saklanmaz
    const aciklama = typeof urun.description === 'string' ? urun.description : '';

    urunler.push({
      ad,
      kategori,
      bag,
      gorsel: Array.isArray(urun.image) ? urun.image[0] : (urun.image ?? null),
      anahtar: anahtarUret(ad, kategori, aciklama, bag.split('/').pop().replace(/-/g, ' ')),
    });
  } catch (e) {
    hata++;
    console.warn(`  atlandı (${e.message}): ${bag}`);
  }
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${baglar.length}`);
  await bekle(180);
}

const kategoriler = [...new Set(urunler.map((u) => u.kategori).filter(Boolean))].sort();

await mkdir(path.dirname(CIKTI), { recursive: true });
await writeFile(CIKTI, JSON.stringify({
  kaynak: 'https://www.dogalmarkam.com/',
  guncelleme: new Date().toISOString().slice(0, 10),
  not: 'Ürün açıklamaları bilinçli olarak saklanmaz; yalnızca arama anahtarı üretilir.',
  kategoriler,
  urunler,
}, null, 2) + '\n', 'utf8');

console.log(`\nYazıldı: data/urunler.json`);
console.log(`${urunler.length} ürün · ${kategoriler.length} kategori · ${hata} atlanan`);

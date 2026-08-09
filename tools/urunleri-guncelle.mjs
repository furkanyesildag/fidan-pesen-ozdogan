#!/usr/bin/env node
/**
 * urunleri-guncelle.mjs
 * ---------------------------------------------------------------------------
 * dogalmarkam.com'un kendi site haritasından ürün kataloğunu çeker ve İKİ dosya
 * üretir:
 *
 *   data/urunler.json   → HERKESE AÇIK. Yalnızca ad, kategori, fiyat, görsel,
 *                         bağlantı ve arama anahtarları. Açıklama YOKTUR.
 *   api/_urunler.mjs    → YALNIZCA SUNUCUDA. Tam ürün açıklamalarını içerir;
 *                         sohbet fonksiyonu bunu bağlam olarak kullanır.
 *                         api/ altındaki alt çizgiyle başlayan dosyalar uç
 *                         nokta olarak yayınlanmaz, dışarıdan okunamaz.
 *
 * Açıklamaların ayrı tutulmasının sebebi: aynı metnin iki alan adında birden
 * bulunması ikisinin de arama başarımını düşürür, ayrıca o metinler yer yer
 * mevzuatın yasakladığı sağlık ifadeleri içeriyor. Kullanıcıya gösterilmezler;
 * yalnızca asistanın doğru ürünü seçebilmesi için okunur.
 *
 * Bağımlılık yok, Node 18+ yeterlidir.
 *   node tools/urunleri-guncelle.mjs
 * ---------------------------------------------------------------------------
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARITA = 'https://www.dogalmarkam.com/xml/sitemap/product.xml';
const ACIK = path.join(KOK, 'data', 'urunler.json');
const GIZLI = path.join(KOK, 'api', '_urunler.mjs');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export function sadelestir(m) {
  return String(m ?? '')
    .replace(/I/g, 'ı').replace(/İ/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DOLGU = new Set(`
ve ile veya bir bu su icin gibi olan olarak adet kutu gr ml mg kg
set paket urun urunu urunler fp pharma dogal markam dogalmarkam
karisik cayi cay yeni ozel numara sekli kullanim saklama kosullari
serin kuru yerde muhafaza ediniz sicak suya karistirilarak icilir
bal pekmeze kampanya firsat paketi icerir icermez
`.trim().split(/\s+/));

function anahtarUret(...metinler) {
  const gorulen = new Set();
  for (const m of metinler) {
    for (const k of sadelestir(m).split(' ')) {
      if (k.length < 3 || DOLGU.has(k) || /^\d+$/.test(k)) continue;
      gorulen.add(k);
      if (gorulen.size >= 30) break;
    }
  }
  return [...gorulen];
}

/** Açıklamanın başındaki ürün adı tekrarını atar, boşlukları toparlar. */
function aciklamaTemizle(ham, ad) {
  let a = String(ham ?? '').replace(/\s+/g, ' ').trim();
  if (a.toLowerCase().startsWith(ad.toLowerCase())) a = a.slice(ad.length).trim();
  return a.replace(/^[-–—:.,\s]+/, '').slice(0, 900);
}

function ldCikar(html) {
  let urun = null, kirinti = null;
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
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
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Site haritası okunuyor...');
  const xml = await getir(HARITA);
  const baglar = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  console.log(`${baglar.length} ürün bağlantısı bulundu.`);

  const urunler = [];
  let hata = 0;

  for (let i = 0; i < baglar.length; i++) {
    try {
      const { urun, kirinti } = ldCikar(await getir(baglar[i]));
      const ad = urun?.name?.trim();
      if (!ad) throw new Error('Product verisi yok');

      const yol = (kirinti?.itemListElement ?? [])
        .map((x) => x.name)
        .filter((n) => n && !/^anasayfa$/i.test(n))
        .slice(0, -1);                       // son basamak ürünün kendisi
      const kategori = yol.filter((k) => !/^\d+\.\s*SET$/.test(k)).join(' · ');
      const aciklama = aciklamaTemizle(urun.description, ad);

      urunler.push({
        ad,
        kategori: kategori || (ad.includes('Bitki Çayı') ? 'Bitkisel Çaylar' : 'Diğer'),
        bag: baglar[i],
        gorsel: Array.isArray(urun.image) ? urun.image[0] : (urun.image ?? null),
        fiyat: urun.offers?.price ? Number(urun.offers.price) : null,
        stokta: /InStock/i.test(urun.offers?.availability ?? ''),
        aciklama,
        anahtar: anahtarUret(ad, kategori, aciklama),
      });
    } catch (e) {
      hata++;
      console.warn(`  atlandı (${e.message}): ${baglar[i]}`);
    }
    if ((i + 1) % 40 === 0) console.log(`  ${i + 1}/${baglar.length}`);
    await bekle(150);
  }

  const kategoriler = [...new Set(urunler.map((u) => u.kategori))].sort();

  /* --- herkese açık dosya: açıklama YOK --- */
  await mkdir(path.dirname(ACIK), { recursive: true });
  await writeFile(ACIK, JSON.stringify({
    kaynak: 'https://www.dogalmarkam.com/',
    guncelleme: new Date().toISOString().slice(0, 10),
    not: 'Ürün açıklamaları bu dosyada bilinçli olarak yer almaz.',
    kategoriler,
    urunler: urunler.map(({ aciklama, ...k }) => k),
  }, null, 2) + '\n', 'utf8');

  /* --- sunucu tarafı modül: açıklamalar dahil --- */
  await mkdir(path.dirname(GIZLI), { recursive: true });
  await writeFile(GIZLI,
    '/* OTOMATİK ÜRETİLDİ — tools/urunleri-guncelle.mjs\n' +
    '   Bu dosya yalnızca sunucu tarafında okunur. api/ altındaki alt çizgiyle\n' +
    '   başlayan dosyalar uç nokta olarak yayınlanmaz. Elle düzenlemeyin. */\n' +
    `export const GUNCELLEME = ${JSON.stringify(new Date().toISOString().slice(0, 10))};\n` +
    `export const KATEGORILER = ${JSON.stringify(kategoriler, null, 1)};\n` +
    `export const URUNLER = ${JSON.stringify(urunler, null, 1)};\n`, 'utf8');

  console.log(`\nYazıldı: data/urunler.json (açık) ve api/_urunler.mjs (sunucu)`);
  console.log(`${urunler.length} ürün · ${kategoriler.length} kategori · ${hata} atlanan`);
}

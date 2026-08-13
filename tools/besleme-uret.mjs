#!/usr/bin/env node
/**
 * besleme-uret.mjs — RSS beslemesi üretir
 * ---------------------------------------------------------------------------
 * Neden: besleme, içeriğin ne zaman değiştiğini makineye tek dosyadan
 * söyleyen en eski ve en yaygın yöntem. Site haritası "hangi sayfalar var"
 * der, besleme "en son ne değişti" der. Güncellik, cevap motorlarının kaynak
 * seçiminde ölçülmüş bir etken; besleme bunu ucuza duyurur.
 *
 * Kaynak sayfaların başlığı, açıklaması ve tarihi doğrudan HTML'den okunur;
 * ayrı bir liste tutulmaz ki iki yer birbirinden ayrı düşmesin.
 *
 *   node tools/besleme-uret.mjs
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://fidanpesen.com';
const CIKTI = path.join(KOK, 'feed.xml');

const kacis = (m) => String(m ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Sayfadan başlık, açıklama ve son değişiklik tarihini çıkarır. */
async function sayfaOku(yol) {
  const tam = path.join(KOK, yol, 'index.html');
  let ham;
  try { ham = await readFile(tam, 'utf8'); } catch { return null; }

  const bul = (kalip) => (ham.match(kalip) || [])[1] || '';
  const baslik = bul(/<title>([^<]*)<\/title>/);
  const aciklama = bul(/<meta name="description" content="([^"]*)"/);
  /* Tarih önce yapısal veriden, yoksa görünen zaman etiketinden alınır. */
  const tarih = bul(/"dateModified"\s*:\s*"([^"]+)"/)
    || bul(/<time datetime="([^"]+)"/)
    || new Date().toISOString().slice(0, 10);

  if (!baslik) return null;
  return {
    yol: yol ? `/${yol}` : '/',
    baslik: baslik.replace(/\s*\|\s*Dr\. Ecz\..*$/, '').trim(),
    aciklama,
    tarih: /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? `${tarih}T09:00:00+03:00` : tarih,
  };
}

const dizinler = [
  '', 'monografi', 'medikal-herbalizm', 'bitki-kimyasi', 'vitamin-mineral',
  'fitoterapi', 'geleneksel-tip', 'cilt-bakimi', 'sac-bakimi', 'ucucu-yaglar',
  'gida-takviyeleri', 'hunnap-ozu', 'pancar-pekmezi', 'basinda', 'videolar', 'sss',
];

const kayitlar = [];
for (const d of dizinler) {
  const k = await sayfaOku(d);
  if (k) kayitlar.push(k);
}
/* Monografiler ayrı: sayıca çok, hepsi beslemeye girmeli. */
for (const ad of await readdir(path.join(KOK, 'monografi'), { withFileTypes: true })) {
  if (!ad.isDirectory()) continue;
  const k = await sayfaOku(path.join('monografi', ad.name));
  if (k) kayitlar.push(k);
}

kayitlar.sort((a, b) => b.tarih.localeCompare(a.tarih));

const oge = kayitlar.map((k) => `    <item>
      <title>${kacis(k.baslik)}</title>
      <link>${SITE}${k.yol}</link>
      <guid isPermaLink="true">${SITE}${k.yol}</guid>
      <description>${kacis(k.aciklama)}</description>
      <pubDate>${new Date(k.tarih).toUTCString()}</pubDate>
      <dc:creator>Dr. Ecz. Fidan Pesen Özdoğan</dc:creator>
    </item>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Dr. Ecz. Fidan Pesen Özdoğan</title>
    <link>${SITE}</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Fitoterapi, geleneksel tıp, mizaç ve tıbbi bitki monografileri.</description>
    <language>tr</language>
    <copyright>Dr. Ecz. Fidan Pesen Özdoğan</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${oge}
  </channel>
</rss>
`;

await writeFile(CIKTI, xml, 'utf8');
console.log(`Yazıldı: feed.xml · ${kayitlar.length} kayıt`);

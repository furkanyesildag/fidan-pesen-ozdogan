/*
 * api/panel.js — yönetim ekranının kapısı
 * ---------------------------------------------------------------------------
 * /kayitlar adresine gelen istekler buraya düşer.
 *
 * Yetkisiz gelen herkese düz 404 döner. 401 ya da giriş formu göstermek,
 * "burada korunan bir şey var" demektir; 404 ise sayfanın var olmadığını
 * söyler. Dışarıdan bakan biri için o adres yoktur.
 *
 * Giriş tek seferlik bir bağlantıyla yapılır:
 *
 *   https://fidanpesen.com/kayitlar?a=<ANAHTAR>
 *
 * Anahtar doğrulanınca imzalı bir çerez bırakılır ve adres temizlenir.
 * Sonraki ziyaretlerde yalnızca /kayitlar yeterlidir; anahtar bir daha
 * hiçbir yerde görünmez. Çerezde anahtarın kendisi değil, ondan türetilen
 * bir imza durur; çerez çalınsa bile anahtar okunamaz.
 * ---------------------------------------------------------------------------
 */
import { createHmac, createHash } from 'node:crypto';
import { PANEL_HTML } from './_panel-html.mjs';

const KOK = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const JETON = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const COOKIE = 'fpo_panel';
const OMUR = 60 * 60 * 24 * 30;            // 30 gün

function esitMi(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let fark = 0;
  for (let i = 0; i < x.length; i++) fark |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return fark === 0;
}

/** Çerez değeri: anahtarın kendisi değil, ondan türetilmiş imza. */
function imza(anahtar) {
  return createHmac('sha256', String(anahtar))
    .update('panel-' + (process.env.KAYIT_TUZU || 'fpo'))
    .digest('hex');
}

function cerezOku(req) {
  const ham = req.headers.cookie || '';
  for (const parca of ham.split(';')) {
    const [ad, ...kalan] = parca.trim().split('=');
    if (ad === COOKIE) return kalan.join('=');
  }
  return '';
}

/** Yanlış anahtar denemelerini sınırlar; kapıyı da kaba kuvvete kapatır. */
async function denemeSayaci(ip, basarili) {
  if (!KOK || !JETON) return true;
  const a = 'panel:deneme:' + createHash('sha256')
    .update(String(ip) + (process.env.KAYIT_TUZU || 'fpo')).digest('hex').slice(0, 16);
  try {
    if (basarili) {
      await fetch(`${KOK}/del/${a}`, { headers: { Authorization: `Bearer ${JETON}` } });
      return true;
    }
    const y = await fetch(`${KOK}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', a], ['EXPIRE', a, 3600]]),
    });
    return Number((await y.json())[0]?.result) <= 10;
  } catch { return true; }
}

function yok(res) {
  /* Var olmayan bir sayfayla ayırt edilemesin diye aynı başlıklar. */
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.status(404).send(
    '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">'
    + '<title>Sayfa bulunamadı</title><meta name="robots" content="noindex">'
    + '<meta http-equiv="refresh" content="0; url=/404.html"></head>'
    + '<body><p>Sayfa bulunamadı. <a href="/">Ana sayfa</a></p></body></html>'
  );
}

export default async function handler(req, res) {
  const beklenen = process.env.KAYIT_ANAHTARI;
  if (!beklenen) { yok(res); return; }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'bilinmeyen';
  const dogruImza = imza(beklenen);

  /* 1) Tek seferlik bağlantı: anahtar doğruysa çerez bırakılıp adres
        temizleniyor, böylece anahtar adres çubuğunda kalmıyor. */
  const gelen = String(req.query?.a || '');
  if (gelen) {
    if (!esitMi(gelen, beklenen)) {
      await denemeSayaci(ip, false);
      yok(res);
      return;
    }
    await denemeSayaci(ip, true);
    res.setHeader('Set-Cookie',
      `${COOKIE}=${dogruImza}; Path=/; Max-Age=${OMUR}; HttpOnly; Secure; SameSite=Strict`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(302).setHeader('Location', '/kayitlar');
    res.end();
    return;
  }

  /* 2) Çerezi olan geçer, olmayan için sayfa yoktur. */
  if (!esitMi(cerezOku(req), dogruImza)) { yok(res); return; }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(200).send(PANEL_HTML);
}

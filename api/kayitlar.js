/*
 * api/kayitlar.js — kaydedilen sohbetleri okuma uç noktası
 * ---------------------------------------------------------------------------
 * Konuşmaları saklamak, okunamadıkları sürece bir işe yaramaz. Bu uç nokta
 * kayıtları en yeniden eskiye doğru verir.
 *
 * Erişim KAYIT_ANAHTARI ortam değişkeniyle korunur. Değişken tanımlı değilse
 * uç nokta tamamen kapalıdır: yanlışlıkla herkese açık kalmasındansa hiç
 * çalışmaması yeğdir. Kayıtlar müşteri konuşmalarıdır.
 *
 *   /api/kayitlar?anahtar=...            son 50 konuşma
 *   /api/kayitlar?anahtar=...&adet=200   daha fazlası
 *   /api/kayitlar?anahtar=...&bicim=csv  tabloya aktarmak için
 * ---------------------------------------------------------------------------
 */
import { createHash, createHmac } from 'node:crypto';

const KOK = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const JETON = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

/** Sabit süreli karşılaştırma: anahtarın uzunluğu ya da ilk harfleri
 *  yanıt süresinden anlaşılmasın. */
function esitMi(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let fark = 0;
  for (let i = 0; i < x.length; i++) fark |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return fark === 0;
}

/**
 * Yanlış anahtar denemelerini sınırlar. Anahtar 32 karakterlik rastgele bir
 * dizi olduğu için kaba kuvvetle bulunması pratikte imkânsız; yine de
 * sınırsız deneme hakkı bırakmak doğru değil. Aynı IP saatte 10 kez
 * yanılırsa bir saat boyunca kapatılır.
 */
async function denemeSayaci(ip, basarili) {
  if (!KOK || !JETON) return true;
  const anahtar = 'kayit:deneme:' + createHash('sha256')
    .update(String(ip) + (process.env.KAYIT_TUZU || 'fpo')).digest('hex').slice(0, 16);
  try {
    if (basarili) {
      await fetch(`${KOK}/del/${anahtar}`, { headers: { Authorization: `Bearer ${JETON}` } });
      return true;
    }
    const y = await fetch(`${KOK}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', anahtar], ['EXPIRE', anahtar, 3600]]),
    });
    const s = await y.json();
    return Number(s[0]?.result) <= 10;
  } catch { return true; }          // depo düşerse erişimi büsbütün kesme
}

/* Panelden gelen istekler imzalı çerezle de doğrulanabilir; kullanıcı
   anahtarı bir kez girdikten sonra her seferinde yeniden yazmasın. */
function cerezGecerli(req, beklenen) {
  const dogru = createHmac('sha256', String(beklenen))
    .update('panel-' + (process.env.KAYIT_TUZU || 'fpo')).digest('hex');
  const ham = req.headers.cookie || '';
  for (const parca of ham.split(';')) {
    const [ad, ...kalan] = parca.trim().split('=');
    if (ad === 'fpo_panel') return esitMi(kalan.join('='), dogru);
  }
  return false;
}

function csvKacis(m) {
  const s = String(m ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

export default async function handler(req, res) {
  const beklenen = process.env.KAYIT_ANAHTARI;
  if (!beklenen) {
    res.status(503).json({
      hata: 'Kayıt okuma kapalı. KAYIT_ANAHTARI ortam değişkeni tanımlı değil.',
    });
    return;
  }

  /* Anahtar öncelikle başlıkla alınır: adres çubuğuna yazıldığında tarayıcı
     geçmişine, sunucu erişim günlüklerine ve dışarı verilen bağlantıların
     Referer başlığına düşüyor. Sorgu biçimi elle açmak isteyenler için
     duruyor ama ekran başlığı kullanıyor. */
  const anahtar = String(req.headers['x-anahtar'] || req.query?.anahtar || '');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'bilinmeyen';

  if (!esitMi(anahtar, beklenen) && !cerezGecerli(req, beklenen)) {
    const devam = await denemeSayaci(ip, false);
    res.setHeader('Cache-Control', 'no-store');
    if (!devam) {
      res.setHeader('Retry-After', '3600');
      res.status(429).json({ hata: 'Çok fazla hatalı deneme. Bir saat sonra tekrar deneyin.' });
      return;
    }
    res.status(401).json({ hata: 'Anahtar geçersiz.' });
    return;
  }
  await denemeSayaci(ip, true);

  if (!KOK || !JETON) {
    res.status(503).json({
      hata: 'Depolama bağlı değil. UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN tanımlanmalı.',
    });
    return;
  }

  const adet = Math.min(Math.max(Number(req.query?.adet) || 50, 1), 1000);

  let ham;
  try {
    const y = await fetch(`${KOK}/lrange/sohbet:kayit/0/${adet - 1}`, {
      headers: { Authorization: `Bearer ${JETON}` },
    });
    if (!y.ok) throw new Error('HTTP ' + y.status);
    ham = (await y.json()).result || [];
  } catch (e) {
    res.status(502).json({ hata: 'Depolama okunamadı: ' + e.message });
    return;
  }

  const kayitlar = ham.map((x) => { try { return JSON.parse(x); } catch { return null; } })
    .filter(Boolean);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (String(req.query?.bicim) === 'csv') {
    const satir = [['zaman', 'oturum', 'kaynak', 'ziyaretci', 'acil', 'onerilen', 'soru', 'yanit']
      .map(csvKacis).join(',')];
    for (const k of kayitlar) {
      const sorular = (k.mesajlar || []).filter((m) => m.rol === 'kullanici')
        .map((m) => m.metin).join(' | ');
      satir.push([
        k.zaman, k.oturum, k.kaynak || '', k.ziyaretci, k.acil ? 'evet' : '',
        (k.onerilen || []).join(' | '), sorular, k.yanit,
      ].map(csvKacis).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sohbetler.csv"');
    res.status(200).send('﻿' + satir.join('\n'));   // BOM: Excel Türkçe karakterleri doğru okusun
    return;
  }

  res.status(200).json({
    adet: kayitlar.length,
    kayitlar,
  });
}

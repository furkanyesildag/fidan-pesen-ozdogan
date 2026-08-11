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

  const anahtar = String(req.query?.anahtar || '');
  if (!esitMi(anahtar, beklenen)) {
    res.status(401).json({ hata: 'Anahtar geçersiz.' });
    return;
  }

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

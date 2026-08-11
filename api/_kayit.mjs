/*
 * _kayit.mjs — konuşma kaydı
 * ---------------------------------------------------------------------------
 * Kayıt hedefi ortam değişkenleriyle seçilir; hiçbiri tanımlı değilse konuşma
 * yalnızca Vercel çalışma zamanı günlüğüne düşer (kalıcı değildir).
 *
 *   1) KV_REST_API_URL + KV_REST_API_TOKEN
 *      Vercel KV / Upstash Redis. Her konuşma "sohbet:kayit" listesine eklenir.
 *      Kurulum: Vercel panelinde Storage > Create > KV, projeye bağlayın.
 *
 *   2) SOHBET_WEBHOOK
 *      Konuşmayı JSON olarak POST edeceği adres (Google Apps Script, Make,
 *      Zapier, kendi sunucunuz...). En hızlı kurulan seçenek budur.
 *
 * KVKK: Sayfada kayıt tutulduğu açıkça yazar. IP adresi ham hâlde saklanmaz,
 * yalnızca tekrar edeni ayırt etmeye yarayan tek yönlü bir özet tutulur.
 * ---------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto';

const ipOzet = (ip) =>
  createHash('sha256')
    .update(String(ip) + (process.env.KAYIT_TUZU || 'fpo'))
    .digest('hex')
    .slice(0, 12);

export async function kaydet(veri) {
  const kayit = {
    zaman: new Date().toISOString(),
    oturum: veri.oturum,
    kaynak: veri.kaynak || '',        // sohbetin başladığı site
    ziyaretci: ipOzet(veri.ip),
    acil: !!veri.acil,
    uyari: veri.uyari ?? [],
    onerilen: veri.urunler ?? [],
    mesajlar: (veri.mesajlar ?? []).map((m) => ({
      rol: m.role === 'user' ? 'kullanici' : 'asistan',
      metin: m.content,
    })),
    yanit: veri.yanit ?? '',
  };

  // Her hâlükârda çalışma zamanı günlüğüne tek satır düşsün.
  console.log('SOHBET ' + JSON.stringify(kayit));

  const isler = [];

  const kvUrl = process.env.KV_REST_API_URL;
  const kvTok = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvTok) {
    isler.push(
      fetch(`${kvUrl}/rpush/sohbet:kayit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvTok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(kayit),
      }).catch((e) => console.error('KV kaydı başarısız:', e.message))
    );
  }

  const kanca = process.env.SOHBET_WEBHOOK;
  if (kanca) {
    isler.push(
      fetch(kanca, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kayit),
      }).catch((e) => console.error('Webhook kaydı başarısız:', e.message))
    );
  }

  if (isler.length) await Promise.allSettled(isler);
}

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

  const kvUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const kvTok = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvTok) {
    /* Boru hattı ile üç iş birden: konuşmayı listeye ekle, listeyi son
       KAYIT_TAVANI kayıtla sınırla (sonsuza kadar büyümesin) ve günlük
       sayacı artır. Komut dizisi biçimi Upstash ve Vercel KV'de aynıdır. */
    const tavan = Number(process.env.KAYIT_TAVANI) || 5000;
    const gun = kayit.zaman.slice(0, 10);
    isler.push(
      fetch(`${kvUrl}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvTok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['LPUSH', 'sohbet:kayit', JSON.stringify(kayit)],
          ['LTRIM', 'sohbet:kayit', 0, tavan - 1],
          ['INCR', `sohbet:sayac:${gun}`],
          ['EXPIRE', `sohbet:sayac:${gun}`, 60 * 60 * 24 * 400],
        ]),
      })
        .then((y) => { if (!y.ok) throw new Error('HTTP ' + y.status); })
        .catch((e) => console.error('KV kaydı başarısız:', e.message))
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

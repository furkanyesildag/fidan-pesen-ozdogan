/* OTOMATİK TAŞINDI — yönetim ekranının HTML'i.
   api/ altında ve alt çizgiyle başladığı için uç nokta olarak yayınlanmaz;
   yalnızca api/panel.js kimlik doğruladıktan sonra gönderir. */
export const PANEL_HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem('fpo_tema');document.documentElement.dataset.tema=(t==='koyu'||t==='acik')?t:'acik';}catch(e){document.documentElement.dataset.tema='acik';}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sohbet Kayıtları | Dr. Ecz. Fidan Pesen</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#fbf8f1">
<link rel="stylesheet" href="/assets/css/style.css?v=32">
<link rel="stylesheet" href="/assets/css/makale.css?v=32">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' fill='none'><path d='M22 36V14' stroke='%23a8842c' stroke-width='3' stroke-linecap='round'/><path d='M22 22.6c-6 0-9.6-3.6-9.6-9.6 6 0 9.6 3.6 9.6 9.6Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/><path d='M22 18c0-6.6 3.8-10.4 10.4-10.4 0 6.6-3.8 10.4-10.4 10.4Z' stroke='%23a8842c' stroke-width='2.8' stroke-linejoin='round'/></svg>">
<style>
  .kyt-kap { max-width: 1020px; margin: 0 auto; padding: clamp(28px,5vw,54px) clamp(16px,4vw,28px) 90px; }
  .kyt-bas { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin-bottom: 26px; }
  .kyt-bas h1 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px,4vw,38px); margin: 0; }
  .kyt-bas p { margin: 0; color: var(--sis); font-size: 14px; }
  .kyt-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 22px; }
  .kyt-form input, .kyt-form select {
    border: 1px solid var(--cizgi); border-radius: 12px; padding: 11px 14px;
    font: inherit; font-size: 14.5px; background: var(--kutu); color: var(--ink);
    outline: none; min-width: 210px;
  }
  .kyt-form input:focus { border-color: var(--aksan); }
  .kyt-form button {
    border: 0; border-radius: 99px; padding: 12px 24px; cursor: pointer;
    font: inherit; font-size: 14px; font-weight: 600;
    background: linear-gradient(140deg, var(--aksan-ac), var(--aksan)); color: #17150f;
  }
  .kyt-form .ikincil { background: none; border: 1px solid var(--cizgi-kuv); color: var(--ink); }
  .kyt-ozet { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
  .kyt-ozet div {
    border: 1px solid var(--cizgi); border-radius: 14px; padding: 12px 18px;
    background: var(--kutu); min-width: 120px;
  }
  .kyt-ozet b { display: block; font-family: var(--serif); font-size: 25px; font-weight: 500; }
  .kyt-ozet span { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--sis-2); }
  .kyt-kart {
    border: 1px solid var(--cizgi); border-radius: 16px; background: var(--kutu);
    padding: 18px 20px; margin-bottom: 14px;
  }
  .kyt-kart.acil { border-color: rgba(var(--acil-rgb), .6); background: rgba(var(--acil-rgb), .08); }
  .kyt-ust { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
             font-size: 11.5px; color: var(--sis); margin-bottom: 14px; }
  .kyt-etiket { border: 1px solid var(--cizgi-kuv); border-radius: 99px; padding: 3px 10px; font-size: 11px; }
  .kyt-etiket.dm { border-color: rgba(var(--aksan-rgb), .5); color: var(--aksan-ac); }
  .kyt-etiket.acil { border-color: var(--acil); color: var(--acil); }
  .kyt-satir { display: flex; gap: 10px; margin-bottom: 10px; }
  .kyt-satir .rol { flex: 0 0 auto; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
                    color: var(--sis-2); width: 64px; padding-top: 3px; }
  .kyt-satir .metin { flex: 1; font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; }
  .kyt-satir.soru .metin { color: var(--ink); font-weight: 500; }
  .kyt-satir.yanit .metin { color: var(--ink-2); }
  .kyt-urun { margin-top: 10px; font-size: 12.5px; color: var(--aksan-ac); }
  .kyt-durum { padding: 40px 0; text-align: center; color: var(--sis); }
  @media (max-width: 620px) { .kyt-satir { flex-direction: column; gap: 3px; } .kyt-satir .rol { width: auto; } }
</style>
</head>
<body class="makale-govde">

<div class="makale-zemin" aria-hidden="true"></div>

<main class="kyt-kap">
  <div class="kyt-bas">
    <h1>Sohbet Kayıtları</h1>
    <p>Fidan’ın Asistanı üzerinden yapılan görüşmeler</p>
  </div>

  <form class="kyt-form" id="form">
    <input type="password" id="anahtar" placeholder="Erişim anahtarı" autocomplete="current-password" required>
    <select id="adet">
      <option value="50">Son 50</option>
      <option value="200">Son 200</option>
      <option value="500">Son 500</option>
      <option value="1000">Son 1000</option>
    </select>
    <button type="submit">Getir</button>
    <button type="button" class="ikincil" id="csv">CSV indir</button>
  </form>

  <div class="kyt-ozet" id="ozet" hidden></div>
  <div id="liste"></div>
  <div class="kyt-durum" id="durum">Anahtarı girip <b>Getir</b>’e basın.</div>
</main>

<script>
(function () {
  'use strict';
  var form = document.getElementById('form');
  var anahtarKutu = document.getElementById('anahtar');
  var adetKutu = document.getElementById('adet');
  var liste = document.getElementById('liste');
  var durum = document.getElementById('durum');
  var ozet = document.getElementById('ozet');

  /* Anahtar bu tarayıcıda hatırlanır ki her açılışta yeniden yazılmasın.
     Adres çubuğuna yazılmıyor: geçmişte ve sunucu günlüklerinde kalırdı. */
  try { anahtarKutu.value = localStorage.getItem('fpo_kayit_anahtar') || ''; } catch (e) {}

  function kacis(m) {
    return String(m == null ? '' : m).replace(/[&<>"]/g, function (k) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[k];
    });
  }

  function zaman(s) {
    try {
      var t = new Date(s);
      return t.toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit' });
    } catch (e) { return s; }
  }

  function kaynakAdi(u) {
    if (!u) return 'bilinmiyor';
    if (u.indexOf('dogalmarkam') > -1) return 'dogalmarkam.com';
    if (u.indexOf('fidanpesen') > -1) return 'fidanpesen.com';
    return u.replace(/^https?:\\/\\//, '').split('/')[0];
  }

  function ciz(kayitlar) {
    liste.innerHTML = '';
    if (!kayitlar.length) { durum.textContent = 'Henüz kayıt yok.'; durum.hidden = false; return; }
    durum.hidden = true;

    var dm = 0, fp = 0, acil = 0, urun = 0;
    kayitlar.forEach(function (k) {
      var kn = kaynakAdi(k.kaynak);
      if (kn === 'dogalmarkam.com') dm++; else if (kn === 'fidanpesen.com') fp++;
      if (k.acil) acil++;
      if ((k.onerilen || []).length) urun++;
    });
    ozet.hidden = false;
    ozet.innerHTML =
      '<div><b>' + kayitlar.length + '</b><span>Görüşme</span></div>' +
      '<div><b>' + dm + '</b><span>dogalmarkam</span></div>' +
      '<div><b>' + fp + '</b><span>fidanpesen</span></div>' +
      '<div><b>' + urun + '</b><span>Ürün önerildi</span></div>' +
      (acil ? '<div><b>' + acil + '</b><span>Acil uyarı</span></div>' : '');

    kayitlar.forEach(function (k) {
      var d = document.createElement('article');
      d.className = 'kyt-kart' + (k.acil ? ' acil' : '');
      var kn = kaynakAdi(k.kaynak);
      var satirlar = (k.mesajlar || []).map(function (m) {
        return '<div class="kyt-satir ' + (m.rol === 'kullanici' ? 'soru' : 'yanit') + '">' +
          '<span class="rol">' + (m.rol === 'kullanici' ? 'Soru' : 'Asistan') + '</span>' +
          '<span class="metin">' + kacis(m.metin) + '</span></div>';
      }).join('');
      d.innerHTML =
        '<div class="kyt-ust">' +
          '<span>' + kacis(zaman(k.zaman)) + '</span>' +
          '<span class="kyt-etiket' + (kn === 'dogalmarkam.com' ? ' dm' : '') + '">' + kacis(kn) + '</span>' +
          '<span>ziyaretçi ' + kacis(k.ziyaretci) + '</span>' +
          (k.acil ? '<span class="kyt-etiket acil">acil yönlendirme</span>' : '') +
        '</div>' +
        satirlar +
        '<div class="kyt-satir yanit"><span class="rol">Yanıt</span>' +
        '<span class="metin">' + kacis(k.yanit) + '</span></div>' +
        ((k.onerilen || []).length
          ? '<div class="kyt-urun">Önerilen: ' + kacis(k.onerilen.join(' · ')) + '</div>' : '');
      liste.appendChild(d);
    });
  }

  /* Anahtar adres çubuğuna yazılmıyor; istek başlığıyla gönderiliyor.
     Sorguya konsaydı tarayıcı geçmişine ve sunucu erişim günlüklerine
     düşerdi. CSV de bu yüzden bağlantıyla değil, indirilip dosyaya
     çevrilerek veriliyor. */
  function iste(bicim) {
    var n = encodeURIComponent(adetKutu.value);
    return fetch('/api/kayitlar?adet=' + n + (bicim ? '&bicim=' + bicim : ''), {
      headers: { 'x-anahtar': anahtarKutu.value.trim() },
      cache: 'no-store',
    }).then(function (y) {
      if (y.status === 401) throw new Error('Anahtar geçersiz.');
      if (y.status === 429) throw new Error('Çok fazla hatalı deneme. Bir saat sonra tekrar deneyin.');
      if (y.status === 503) return y.json().then(function (j) { throw new Error(j.hata); });
      if (!y.ok) throw new Error('Sunucu hatası (' + y.status + ')');
      return y;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = anahtarKutu.value.trim();
    if (!a) return;
    try { localStorage.setItem('fpo_kayit_anahtar', a); } catch (er) {}
    liste.innerHTML = ''; ozet.hidden = true;
    durum.hidden = false; durum.textContent = 'Getiriliyor...';
    iste('')
      .then(function (y) { return y.json(); })
      .then(function (j) { ciz(j.kayitlar || []); })
      .catch(function (er) { durum.hidden = false; durum.textContent = er.message; });
  });

  document.getElementById('csv').addEventListener('click', function () {
    if (!anahtarKutu.value.trim()) { anahtarKutu.focus(); return; }
    durum.hidden = false; durum.textContent = 'CSV hazırlanıyor...';
    iste('csv')
      .then(function (y) { return y.blob(); })
      .then(function (b) {
        var u = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href = u; a.download = 'sohbetler.csv';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
        durum.hidden = true;
      })
      .catch(function (er) { durum.textContent = er.message; });
  });

  /* Sayfaya çerezle girildiyse anahtar zaten doğrulanmış demektir; kutuyu
     hiç göstermeden kayıtlar getirilir. Çerez yoksa kutu görünür. */
  durum.textContent = 'Getiriliyor...';
  iste('')
    .then(function (y) { return y.json(); })
    .then(function (j) {
      form.querySelector('#anahtar').hidden = true;
      form.querySelector('button[type=submit]').hidden = true;
      ciz(j.kayitlar || []);
    })
    .catch(function () {
      durum.textContent = 'Anahtarı girip Getir’e basın.';
      if (anahtarKutu.value) form.dispatchEvent(new Event('submit'));
    });
})();
</script>

<script src="/assets/js/tema.js?v=32"></script>
</body>
</html>
`;

/*
 * asistan.js — Fidan'ın Asistanı sohbet arayüzü
 * ---------------------------------------------------------------------------
 * Harici kütüphane yok. Sunucudaki /api/sohbet uç noktasına konuşma geçmişini
 * yollar, yanıtı SSE akışıyla parça parça alır ve yazdırır.
 * API anahtarı burada YOKTUR; yalnızca sunucuda durur.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var akis = document.getElementById('sohbetAkis');
  if (!akis) return;
  var form = document.getElementById('sohbetForm');
  var alan = document.getElementById('sohbetGirdi');
  var dugme = document.getElementById('sohbetGonder');
  var cipler = document.getElementById('sohbetCipler');

  var gecmis = [];          // [{rol, metin}]
  var mesgul = false;
  var oturum = (function () {
    try {
      var k = sessionStorage.getItem('fpo_oturum');
      if (!k) {
        k = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        sessionStorage.setItem('fpo_oturum', k);
      }
      return k;
    } catch (e) { return 'gecici'; }
  })();

  /* --------------------------------------------------------- yardımcılar */
  function kacir(m) {
    return String(m == null ? '' : m).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Küçük bir markdown alt kümesi: **kalın**, satır başı, madde işareti. */
  function bicimle(metin) {
    var t = kacir(metin)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, '$1<i>$2</i>');
    var satirlar = t.split('\n');
    var html = '', liste = false;
    for (var i = 0; i < satirlar.length; i++) {
      var s = satirlar[i].trim();
      var m = s.match(/^[-•*]\s+(.*)$/) || s.match(/^\d+[.)]\s+(.*)$/);
      if (m) {
        if (!liste) { html += '<ul>'; liste = true; }
        html += '<li>' + m[1] + '</li>';
      } else {
        if (liste) { html += '</ul>'; liste = false; }
        if (s) html += '<p>' + s + '</p>';
      }
    }
    if (liste) html += '</ul>';
    return html || '<p></p>';
  }

  /* ÜRÜN: satırları arayüz içindir, metinden ayıklanır. */
  function urunSatirlariniAt(metin) {
    return metin.replace(/^\s*ÜRÜN:\s*.+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function enAlta() { akis.scrollTop = akis.scrollHeight; }

  /* ------------------------------------------------------------- balonlar */
  function balonEkle(rol, html, sinif) {
    var d = document.createElement('div');
    d.className = 'balon ' + rol + (sinif ? ' ' + sinif : '');
    if (rol === 'asistan') {
      d.innerHTML = '<span class="balon-ad">Fidan\u2019ın Asistanı</span>' +
        '<div class="balon-govde">' + html + '</div>';
    } else {
      d.innerHTML = '<div class="balon-govde">' + html + '</div>';
    }
    akis.appendChild(d);
    enAlta();
    return d;
  }

  function yaziyorEkle() {
    var d = document.createElement('div');
    d.className = 'balon asistan yaziyor';
    d.innerHTML = '<span class="balon-ad">Fidan\u2019ın Asistanı</span>' +
      '<div class="balon-govde"><span class="nokta"></span><span class="nokta"></span><span class="nokta"></span></div>';
    akis.appendChild(d);
    enAlta();
    return d;
  }

  function urunKartlari(urunler) {
    if (!urunler || !urunler.length) return '';
    return '<div class="sohbet-urunler">' + urunler.map(function (u) {
      return '<a class="sohbet-urun" href="' + kacir(u.bag) + '" target="_blank" rel="noopener">' +
        (u.gorsel ? '<img src="' + kacir(u.gorsel) + '" alt="" width="56" height="56" loading="lazy">' : '<span class="sohbet-urun-bos"></span>') +
        '<span class="sohbet-urun-metin">' +
          (u.kategori ? '<i>' + kacir(u.kategori) + '</i>' : '') +
          '<b>' + kacir(u.ad) + '</b>' +
          (u.fiyat ? '<em>' + Number(u.fiyat).toLocaleString('tr-TR') + ' TL</em>' : '') +
        '</span>' +
        '<span class="sohbet-urun-ok" aria-hidden="true">↗</span>' +
        '</a>';
    }).join('') +
    '<p class="sohbet-urun-not">Ürünler ilaç değildir; hastalıkları önleme, tedavi etme ' +
    'veya iyileştirme amacıyla kullanılamaz.</p></div>';
  }

  /* ---------------------------------------------------------------- akış */
  function gonder(metin) {
    if (mesgul || !metin.trim()) return;
    mesgul = true;
    dugme.disabled = true;
    alan.value = '';
    alan.style.height = '';
    if (cipler) cipler.hidden = true;

    gecmis.push({ rol: 'kullanici', metin: metin });
    balonEkle('kullanici', bicimle(metin));
    var yaziyor = yaziyorEkle();

    var balon = null, govde = null, biriken = '';

    function yazdir() {
      var temiz = urunSatirlariniAt(biriken);
      if (!balon) {
        if (yaziyor) { yaziyor.remove(); yaziyor = null; }
        balon = balonEkle('asistan', '<div class="balon-metin"></div>');
        govde = balon.querySelector('.balon-metin');
      }
      govde.innerHTML = bicimle(temiz);
      enAlta();
    }

    fetch('/api/sohbet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oturum: oturum, mesajlar: gecmis.slice(-24) })
    }).then(function (y) {
      if (!y.ok || !y.body) {
        return y.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.hata || ('HTTP ' + y.status));
        });
      }
      var okuyucu = y.body.getReader();
      var cozucu = new TextDecoder();
      var tampon = '';

      function oku() {
        return okuyucu.read().then(function (r) {
          if (r.done) return;
          tampon += cozucu.decode(r.value, { stream: true });
          var bloklar = tampon.split('\n\n');
          tampon = bloklar.pop() || '';
          bloklar.forEach(function (blok) {
            var tur = 'message', veri = '';
            blok.split('\n').forEach(function (satir) {
              if (satir.indexOf('event:') === 0) tur = satir.slice(6).trim();
              else if (satir.indexOf('data:') === 0) veri += satir.slice(5).trim();
            });
            if (!veri) return;
            var j;
            try { j = JSON.parse(veri); } catch (e) { return; }
            if (tur === 'parca') { biriken += j; yazdir(); }
            else if (tur === 'bitti') {
              if (!balon) yazdir();
              if (j.urunler && j.urunler.length) {
                var k = document.createElement('div');
                k.innerHTML = urunKartlari(j.urunler);
                balon.querySelector('.balon-govde').appendChild(k.firstChild);
              }
              if (j.acil) balon.classList.add('acil');
              enAlta();
            }
          });
          return oku();
        });
      }
      return oku();
    }).catch(function (e) {
      if (yaziyor) { yaziyor.remove(); yaziyor = null; }
      balonEkle('asistan', '<p>Bağlantıda bir aksaklık oldu. Birazdan tekrar deneyebilir ' +
        'ya da doğrudan <a href="https://wa.me/905336320313" target="_blank" rel="noopener">' +
        'WhatsApp destek hattımıza</a> yazabilirsiniz.</p>', 'hata');
      console.error(e);
    }).then(function () {
      var son = urunSatirlariniAt(biriken);
      if (son) gecmis.push({ rol: 'asistan', metin: biriken });
      mesgul = false;
      dugme.disabled = false;
      alan.focus();
      enAlta();
    });
  }

  /* --------------------------------------------------------------- olaylar */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    gonder(alan.value);
  });

  alan.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(alan.value); }
  });

  alan.addEventListener('input', function () {
    alan.style.height = 'auto';
    alan.style.height = Math.min(alan.scrollHeight, 160) + 'px';
  });

  if (cipler) {
    cipler.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ornek]');
      if (b) gonder(b.dataset.ornek);
    });
  }

  /* açılış mesajı */
  balonEkle('asistan',
    '<p>Merhaba, hoş geldiniz. Ben Fidan Hanım\u2019ın asistanıyım.</p>' +
    '<p>Size nasıl yardımcı olabilirim? Cildinizle, saçınızla ya da genel ' +
    'olarak kendinizi nasıl hissettiğinizle ilgili ne varsa rahatça anlatın. ' +
    'Acele etmeyin, önce sizi doğru anlamak istiyorum.</p>');

  var ilk = new URLSearchParams(location.search).get('s');
  if (ilk) setTimeout(function () { gonder(ilk.slice(0, 400)); }, 400);
})();

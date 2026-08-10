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

  /* Arayüz WhatsApp düğmesini zaten gösteriyor; modelin metne yazdığı çıplak
     wa.me adresi ve telefonu tekrar olur, temizliyoruz. */
  function baglantiTemizle(m) {
    return String(m)
      .replace(/\(?\s*https?:\/\/(?:www\.)?wa\.me\/\d+\s*\)?/gi, '')
      .replace(/[:\-–—]\s*$/gm, '')
      .replace(/\s{2,}/g, ' ');
  }

  /* Küçük bir markdown alt kümesi: **kalın**, satır başı, madde işareti.
     Kalan http bağlantıları tıklanabilir hâle getirilir. */
  function bicimle(metin) {
    var t = kacir(metin)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
        '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
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
    return baglantiTemizle(metin.replace(/^\s*ÜRÜN:\s*.+$/gm, ''))
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function enAlta() { akis.scrollTop = akis.scrollHeight; }

  /* Sayfa gövdesi mobilde kaymasın diye sohbet açıkken taşma kilitlenir. */
  if (window.matchMedia('(max-width: 820px)').matches) {
    document.body.style.overflowY = 'auto';
  }

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

  var WA = 'https://wa.me/905336320313';

  /* Her asistan mesajının altında duran eylem satırı: önerilen ürünlerin
     bağlantıları ve doğrudan WhatsApp sohbeti. */
  function eylemSatiri(urunler, acil) {
    var h = '<div class="sohbet-eylem">';
    if (urunler && urunler.length) {
      h += urunler.map(function (u) {
        return '<a class="se-urun" href="' + kacir(u.bag) + '" target="_blank" rel="noopener">' +
          'Ürünü incele<span aria-hidden="true"> ↗</span></a>';
      }).join('');
    }
    h += '<a class="se-wa" href="' + WA + '" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3a8.5 8.5 0 1 1 15.6-4.6Z"/>' +
      '<path d="M8.9 8.4c.3-.6.6-.5.9-.5h.7c.2 0 .5 0 .7.5l.8 1.9c.1.3 0 .5-.1.7l-.4.5c-.1.2-.3.3-.1.6.5.9 1.4 1.8 2.4 2.3.3.2.5.1.7-.1l.5-.5c.2-.2.4-.2.7-.1l1.7.9c.4.2.5.4.5.6 0 .5-.3 1.5-1.4 1.7-1 .2-2.5-.2-4.4-1.5-1.9-1.3-2.9-3-3.2-3.9-.3-.9-.2-2 .1-2.6Z" fill="currentColor" stroke="none"/></svg>' +
      (acil ? 'Hocamızın ekibi' : 'Hocamızın ekibine yaz') + '</a>';
    h += '</div>';
    return h;
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
              var kap = balon.querySelector('.balon-govde');
              if (j.urunler && j.urunler.length) {
                var k = document.createElement('div');
                k.innerHTML = urunKartlari(j.urunler);
                kap.appendChild(k.firstChild);
              }
              // düğme satırı yalnızca anlamlıysa: ürün var ya da sunucu istedi
              if ((j.urunler && j.urunler.length) || j.whatsapp) {
                var e = document.createElement('div');
                e.innerHTML = eylemSatiri(j.urunler, j.acil);
                kap.appendChild(e.firstChild);
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
      balonEkle('asistan', '<p>Bağlantıda bir aksaklık oldu. Birazdan tekrar ' +
        'deneyebilir ya da doğrudan destek hattımıza yazabilirsiniz.</p>' +
        eylemSatiri(null, false), 'hata');
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

  /* Odaklanınca SAYFAYI kaydırmıyoruz; kutu zaten dvh ile klavyeye uyum
     sağlıyor. Yalnızca mesaj akışını en alta çekiyoruz. scrollIntoView
     kullanmak sayfanın bir aşağı bir yukarı zıplamasına yol açıyordu. */
  alan.addEventListener('focus', function () { setTimeout(enAlta, 260); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (document.activeElement === alan) setTimeout(enAlta, 60);
    });
  }

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
    '<p>Merhaba, hoş geldiniz. Ben Dr. Ecz. Fidan Pesen Özdoğan Hocamızın asistanıyım.</p>' +
    '<p>Size nasıl yardımcı olabilirim? Cildinizle, saçınızla ya da genel ' +
    'olarak kendinizi nasıl hissettiğinizle ilgili ne varsa rahatça anlatın. ' +
    'Acele etmeyin, önce sizi doğru anlamak istiyorum.</p>');

  var ilk = new URLSearchParams(location.search).get('s');
  if (ilk) setTimeout(function () { gonder(ilk.slice(0, 400)); }, 400);
})();

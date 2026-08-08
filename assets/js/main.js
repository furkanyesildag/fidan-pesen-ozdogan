/*
 * main.js — sayfa orkestrasyonu
 * ---------------------------------------------------------------------------
 * · scroll → sahne şekli/paleti/kamera geçişleri
 * · giriş animasyonları (IntersectionObserver)
 * · mizaç kartları → tüm sayfanın rengini değiştirir
 * · imleçle 3B kart eğimi (CSS transform, kütüphanesiz)
 * · mobil menü, ilerleme çubuğu, aktif nav
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var kok = document.documentElement;
  var azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dokunmatik = window.matchMedia('(hover: none)').matches;

  /* ------------------------------------------------------ palet → CSS rengi */
  var RENK = {
    kok:    { a: '#d8b45f', ac: '#f6e7bb', koy: '#7d6427', rgb: '216, 180, 95' },
    ates:   { a: '#ff7a2f', ac: '#ffd9a8', koy: '#a12f0d', rgb: '255, 122, 47' },
    hava:   { a: '#e8506f', ac: '#ffd4dc', koy: '#8d2440', rgb: '232, 80, 111' },
    su:     { a: '#3fa9e0', ac: '#cdefff', koy: '#1a5e85', rgb: '63, 169, 224' },
    toprak: { a: '#c2a06b', ac: '#f0dcb4', koy: '#6f5a34', rgb: '194, 160, 107' }
  };

  var aktifPalet = 'kok';
  function temaUygula(ad) {
    var r = RENK[ad] || RENK.kok;
    if (ad === aktifPalet) return;
    aktifPalet = ad;
    kok.style.setProperty('--aksan', r.a);
    kok.style.setProperty('--aksan-ac', r.ac);
    kok.style.setProperty('--aksan-koy', r.koy);
    kok.style.setProperty('--aksan-rgb', r.rgb);
  }

  /* ============================================================ 1. SAHNE */
  var canvas = document.getElementById('sahne');
  var sahne = null;

  if (canvas && window.UnsurSahnesi) {
    sahne = new window.UnsurSahnesi(canvas, { sekil: 'kure', palet: 'kok' });
    if (azHareket) {
      sahne.tekKare();
    } else {
      sahne.basla();
      // sekme arka plana düştüğünde döngüyü durdur
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) sahne.dur();
        else sahne.basla();
      });
    }
  }

  /* ------------------------------------------- imleç parallaksı (kamera) */
  if (sahne && !azHareket && !dokunmatik) {
    var hedefNX = 0, hedefNY = 0, suanNX = 0, suanNY = 0, imlecRaf = null;
    window.addEventListener('pointermove', function (e) {
      hedefNX = (e.clientX / window.innerWidth) * 2 - 1;
      hedefNY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!imlecRaf) imlecRaf = requestAnimationFrame(imlecDongu);
    }, { passive: true });

    function imlecDongu() {
      suanNX += (hedefNX - suanNX) * 0.06;
      suanNY += (hedefNY - suanNY) * 0.06;
      sahne.imlecAyarla(suanNX, suanNY);
      if (Math.abs(hedefNX - suanNX) > 0.001 || Math.abs(hedefNY - suanNY) > 0.001) {
        imlecRaf = requestAnimationFrame(imlecDongu);
      } else {
        imlecRaf = null;
      }
    }
  }

  /* ==================================================== 2. BÖLÜM GEÇİŞLERİ */
  var bolumler = Array.prototype.slice.call(document.querySelectorAll('.bolum[data-sekil]'));
  var navLinkler = Array.prototype.slice.call(document.querySelectorAll('.menu a'));
  var kilitliUnsur = null;   // kullanıcı bir mizaç seçtiyse palet ona kilitlenir

  function bolumuUygula(bl) {
    if (!bl) return;
    if (sahne) {
      sahne.sekilAyarla(bl.dataset.sekil || 'kure');
      sahne.kameraAyarla({
        zoom: parseFloat(bl.dataset.zoom || '1'),
        yogunluk: parseFloat(bl.dataset.yogunluk || '1'),
        merkez: parseFloat(bl.dataset.merkez || '0.5')
      });
    }
    var palet = bl.dataset.palet || 'kok';
    if (bl.id === 'unsurlar' && kilitliUnsur) palet = kilitliUnsur;
    if (sahne) sahne.paletAyarla(palet);
    temaUygula(palet);

    // nav vurgusu
    var id = bl.id;
    navLinkler.forEach(function (a) {
      a.classList.toggle('aktif', a.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window) {
    var bolumGozcu = new IntersectionObserver(function (girisler) {
      // ekranın ortasına en yakın bölümü seç
      var enIyi = null, enIyiOran = 0;
      girisler.forEach(function (g) {
        if (g.isIntersecting && g.intersectionRatio > enIyiOran) {
          enIyiOran = g.intersectionRatio;
          enIyi = g.target;
        }
      });
      if (enIyi) bolumuUygula(enIyi);
    }, { threshold: [0.18, 0.4, 0.65], rootMargin: '-12% 0px -12% 0px' });

    bolumler.forEach(function (b) { bolumGozcu.observe(b); });
  }

  /* ==================================================== 3. GİRİŞ ANİMASYONU */
  var gizliler = Array.prototype.slice.call(document.querySelectorAll('.reveal, .reveal-op'));
  gizliler.forEach(function (el) {
    if (el.dataset.gecikme) el.style.setProperty('--g', el.dataset.gecikme);
  });

  if ('IntersectionObserver' in window && !azHareket) {
    var revealGozcu = new IntersectionObserver(function (girisler, gozcu) {
      girisler.forEach(function (g) {
        if (g.isIntersecting) {
          g.target.classList.add('gorundu');
          gozcu.unobserve(g.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    gizliler.forEach(function (el) { revealGozcu.observe(el); });
  } else {
    gizliler.forEach(function (el) { el.classList.add('gorundu'); });
  }

  /* ================================================== 4. MİZAÇ ETKİLEŞİMİ */
  /* Aynı sözleşme her yerde geçerli: data-unsur + data-sekil taşıyan her öğe
     (mizaç kartı, keyfiyet kadranı) sahneyi sürebilir. */
  var tetikler = Array.prototype.slice.call(document.querySelectorAll('[data-unsur][data-sekil]'));
  var unsurKartlar = tetikler.filter(function (e) { return e.classList.contains('unsur-kart'); });
  var kadranlar = tetikler.filter(function (e) { return e.classList.contains('kadran'); });

  function unsuruGoster(unsur, sekil, kalici) {
    if (sahne) {
      if (sekil) sahne.sekilAyarla(sekil);
      sahne.paletAyarla(unsur);
    }
    temaUygula(unsur);
    if (kalici) kilitliUnsur = unsur;

    unsurKartlar.forEach(function (k) { k.classList.toggle('secili', k.dataset.unsur === unsur); });
    kadranlar.forEach(function (k) { k.classList.toggle('parlak', k.dataset.unsur === unsur); });
  }

  tetikler.forEach(function (el) {
    var unsur = el.dataset.unsur;
    var sekil = el.dataset.sekil;
    var kadran = el.classList.contains('kadran');

    if (!dokunmatik) {
      el.addEventListener('mouseenter', function () { unsuruGoster(unsur, sekil, false); });
    }
    // kadranlar yalnızca önizleme; kart ve noktalar seçimi kilitler
    if (!kadran) {
      el.addEventListener('click', function (e) { e.preventDefault(); unsuruGoster(unsur, sekil, true); });
      el.addEventListener('focus', function () { unsuruGoster(unsur, sekil, true); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unsuruGoster(unsur, sekil, true); }
      });
    }
  });

  /* ==================================================== 4b. PARALLAKS ÖĞELER */
  /* Portre ve tam genişlik bant, scroll'a göre hafifçe kayar. */
  if (!azHareket) {
    var parcalar = [];
    var portre = document.querySelector('.portre');
    if (portre) parcalar.push({ el: portre, hiz: -0.06, sinir: 60 });
    var bantGorsel = document.querySelector('.bant img');
    if (bantGorsel) parcalar.push({ el: bantGorsel, hiz: 0.10, sinir: 90, taban: -9 });

    if (parcalar.length) {
      var pRaf = null;
      var parallaksUygula = function () {
        pRaf = null;
        var orta = window.innerHeight / 2;
        parcalar.forEach(function (p) {
          var r = p.el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
          var fark = (r.top + r.height / 2 - orta) * p.hiz;
          var y = Math.max(-p.sinir, Math.min(p.sinir, fark)) + (p.taban || 0);
          p.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
        });
      };
      window.addEventListener('scroll', function () {
        if (!pRaf) pRaf = requestAnimationFrame(parallaksUygula);
      }, { passive: true });
      window.addEventListener('resize', parallaksUygula, { passive: true });
      parallaksUygula();
    }
  }

  /* ===================================================== 5. 3B KART EĞİMİ */
  /* Kütüphanesiz "tilt": imlecin karta göre konumundan rotateX/rotateY üretilir. */
  if (!dokunmatik && !azHareket) {
    var egilenler = Array.prototype.slice.call(document.querySelectorAll('.tilt, .unsur-kart'));

    egilenler.forEach(function (el) {
      var raf = null, hx = 0, hy = 0;

      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        hx = (py - 0.5) * -9;    // rotateX
        hy = (px - 0.5) * 12;    // rotateY
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (!raf) raf = requestAnimationFrame(uygula);
      }, { passive: true });

      function uygula() {
        raf = null;
        var kalk = el.classList.contains('unsur-kart') ? 'translateY(-8px)' : 'translateY(-4px)';
        el.style.transform =
          'perspective(900px) rotateX(' + hx.toFixed(2) + 'deg) rotateY(' + hy.toFixed(2) + 'deg) ' + kalk;
      }

      el.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.transform = '';
      });
    });
  }

  /* ========================================== 6. ÜST BAR / MENÜ / İLERLEME */
  var ustBar = document.querySelector('.ust-bar');
  var cubuk = document.getElementById('ilerlemeCubuk');
  var menu = document.getElementById('menu');
  var menuDugme = document.getElementById('menuDugme');

  var scrollRaf = null;
  function scrollDurumu() {
    scrollRaf = null;
    var y = window.scrollY || window.pageYOffset;
    if (ustBar) ustBar.classList.toggle('kondu', y > 40);
    if (cubuk) {
      var toplam = document.documentElement.scrollHeight - window.innerHeight;
      var oran = toplam > 0 ? (y / toplam) * 100 : 0;
      cubuk.style.width = Math.min(100, Math.max(0, oran)).toFixed(2) + '%';
    }
  }
  window.addEventListener('scroll', function () {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(scrollDurumu);
  }, { passive: true });
  scrollDurumu();

  if (menuDugme && menu) {
    menuDugme.addEventListener('click', function () {
      var acik = menu.classList.toggle('acik');
      menuDugme.setAttribute('aria-expanded', acik ? 'true' : 'false');
      menuDugme.setAttribute('aria-label', acik ? 'Menüyü kapat' : 'Menüyü aç');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('acik');
        menuDugme.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Açılışta ilk bölümün kompozisyonunu uygula. */
  bolumuUygula(document.getElementById('kapak'));
})();

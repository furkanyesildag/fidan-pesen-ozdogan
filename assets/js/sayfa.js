/*
 * sayfa.js — konu rehberleri ve SSS sayfaları
 * Canvas sahnesi yok; bu sayfalarda hız önceliklidir.
 * Tek işi: üst barın kondu durumu, mobil menü ve içindekiler vurgusu.
 */
(function () {
  'use strict';

  /* --------------------------------------------------- üst bar + menü */
  var ustBar = document.querySelector('.ust-bar');
  var menu = document.getElementById('menu');
  var menuDugme = document.getElementById('menuDugme');

  var raf = null;
  function scrollDurumu() {
    raf = null;
    if (ustBar) ustBar.classList.toggle('kondu', (window.scrollY || 0) > 40);
  }
  window.addEventListener('scroll', function () {
    if (!raf) raf = requestAnimationFrame(scrollDurumu);
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

  /* ------------------------------------------ içindekiler: aktif başlık */
  var baglar = Array.prototype.slice.call(document.querySelectorAll('.icindekiler a[href^="#"]'));
  if (!baglar.length || !('IntersectionObserver' in window)) return;

  var esle = {};
  var hedefler = [];
  baglar.forEach(function (a) {
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (el) { esle[el.id] = a; hedefler.push(el); }
  });

  var gorunen = new Set();
  var gozcu = new IntersectionObserver(function (girisler) {
    girisler.forEach(function (g) {
      if (g.isIntersecting) gorunen.add(g.target.id);
      else gorunen.delete(g.target.id);
    });
    // belge sırasında görünen ilk bölüm işaretlenir
    var secili = null;
    for (var i = 0; i < hedefler.length; i++) {
      if (gorunen.has(hedefler[i].id)) { secili = hedefler[i].id; break; }
    }
    baglar.forEach(function (a) {
      a.classList.toggle('aktif', secili != null && esle[secili] === a);
    });
  }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

  hedefler.forEach(function (el) { gozcu.observe(el); });
})();

/*
 * tema.js — aydınlık / karanlık mod anahtarı
 * ---------------------------------------------------------------------------
 * Temanın kendisi sayfa <head>'inde satır içi küçük bir betikle, boyamadan
 * ÖNCE ayarlanır; yoksa sayfa bir an yanlış renkte parlar. Bu dosya yalnızca
 * düğmenin davranışını ve tema değişince haber verilmesi gereken yerleri
 * (parçacık sahnesi, tarayıcı çubuğu rengi) yönetir.
 *
 * Sıra: kullanıcı seçimi (localStorage) > işletim sistemi tercihi > karanlık.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var kok = document.documentElement;

  function suanki() {
    return kok.dataset.tema === 'acik' ? 'acik' : 'koyu';
  }

  function cubukRengi(tema) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
    }
    m.content = tema === 'acik' ? '#fbf8f1' : '#07100c';
  }

  function uygula(tema, kaydet) {
    kok.dataset.tema = tema;
    cubukRengi(tema);
    if (kaydet) { try { localStorage.setItem('fpo_tema', tema); } catch (e) {} }
    guncelleDugme(tema);
    // sahne ve renk haritası dinliyor
    window.dispatchEvent(new CustomEvent('temadegisti', { detail: { tema: tema } }));
  }

  function guncelleDugme(tema) {
    var d = document.getElementById('temaDugme');
    if (!d) return;
    var acik = tema === 'acik';
    d.setAttribute('aria-pressed', acik ? 'true' : 'false');
    d.setAttribute('aria-label', acik ? 'Karanlık moda geç' : 'Aydınlık moda geç');
    d.setAttribute('title', acik ? 'Karanlık mod' : 'Aydınlık mod');
  }

  document.addEventListener('click', function (e) {
    var d = e.target.closest('#temaDugme');
    if (!d) return;
    uygula(suanki() === 'acik' ? 'koyu' : 'acik', true);
  });

  /* Kullanıcı elle seçmediyse işletim sistemi tercihini izlemeye devam et. */
  var mq = window.matchMedia('(prefers-color-scheme: light)');
  var dinle = function (e) {
    var secili = null;
    try { secili = localStorage.getItem('fpo_tema'); } catch (er) {}
    if (!secili) uygula(e.matches ? 'acik' : 'koyu', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', dinle);
  else if (mq.addListener) mq.addListener(dinle);

  guncelleDugme(suanki());
  cubukRengi(suanki());
})();

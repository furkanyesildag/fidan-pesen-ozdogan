/*
 * asistan-baloncuk.js — her sayfada sağ altta duran asistan girişi
 * ---------------------------------------------------------------------------
 * Tek bir yerden yönetilsin diye baloncuk HTML'i sayfalara elle yazılmaz,
 * burada üretilir. Asistan sayfasının kendisinde görünmez; kullanıcı
 * kapatırsa tercihi o oturum boyunca hatırlanır.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (location.pathname.replace(/\/$/, '') === '/asistan') return;
  try { if (sessionStorage.getItem('fpo_baloncuk') === 'kapali') return; } catch (e) {}

  var a = document.createElement('a');
  a.className = 'asistan-baloncuk';
  a.href = '/asistan';
  a.setAttribute('aria-label', "Fidan'ın Asistanı ile sohbet başlat");
  a.innerHTML =
    '<img src="/assets/img/asistan-avatar.jpg" alt="" width="38" height="38" loading="lazy" decoding="async">' +
    '<span class="bal-yazi">' +
      '<b>Fidan’ın Asistanı</b>' +
      '<i><span class="bal-nokta"></span>Size nasıl yardımcı olabilirim?</i>' +
    '</span>' +
    '<button class="bal-kapat" type="button" aria-label="Baloncuğu kapat">×</button>';

  /* Sayfada tam ekran katman varsa baloncuk oraya yönlendirmez, katmanı açar. */
  a.addEventListener('click', function (e) {
    if (e.target.closest('.bal-kapat')) return;
    if (document.getElementById('asistanKatman') && window.asistanKatmaniAc) {
      e.preventDefault();
      window.asistanKatmaniAc();
    }
  });

  a.querySelector('.bal-kapat').addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    try { sessionStorage.setItem('fpo_baloncuk', 'kapali'); } catch (er) {}
    a.remove();
  });

  document.body.appendChild(a);
})();

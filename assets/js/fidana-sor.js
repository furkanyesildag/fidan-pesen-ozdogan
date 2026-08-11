/*
 * fidana-sor.js — başka sitelere gömülebilen "Fidan'a Sor" asistanı
 * ---------------------------------------------------------------------------
 * dogalmarkam.com gibi bizim denetimimizde olmayan sayfalara tek satırla
 * eklenir:
 *
 *   <script src="https://fidanpesen.com/assets/js/fidana-sor.js" defer></script>
 *
 * Tasarım kararları:
 *
 * 1) Shadow DOM. Gömüldüğü sitenin CSS'i bileşeni bozamaz, bileşenin CSS'i de
 *    o siteyi bozamaz. T-Soft temasında "button { width:100% }" gibi bir kural
 *    olması işten bile değil; kapalı gölge ağaç bunu tamamen keser.
 *
 * 2) Bağımsız. Ne kütüphane ne yapı adımı gerekiyor; tek dosya, saf JS.
 *
 * 3) Aynı uç nokta. fidanpesen.com/api/sohbet çağrılır, yani sistem istemi,
 *    ürün kataloğu, güvenlik taraması ve konuşma kaydı tek yerde kalır.
 *    Kayıtta hangi siteden gelindiği de yazar.
 *
 * 4) API anahtarı burada YOKTUR ve olamaz. Anahtar yalnızca sunucuda durur.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var KOK = 'https://fidanpesen.com';
  var UC = KOK + '/api/sohbet';
  var WA = 'https://wa.me/905336320313';
  var AVATAR = KOK + '/assets/img/asistan-avatar.jpg';

  if (window.__fidanaSor) return;               // iki kez yüklenirse tek çalış
  window.__fidanaSor = true;

  /* Gömüldüğü sitede zaten bizim tam sayfa asistanımız varsa karışmasın. */
  if (location.hostname.indexOf('fidanpesen.com') > -1) return;

  /* ------------------------------------------------------------------ yardım */
  function el(tur, sinif, icerik) {
    var d = document.createElement(tur);
    if (sinif) d.className = sinif;
    if (icerik != null) d.textContent = icerik;
    return d;
  }

  function kacis(m) {
    return String(m).replace(/[&<>"]/g, function (k) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[k];
    });
  }

  /* Modelin yazdığı sade metni güvenli HTML'e çevirir: kalın, bağlantı,
     madde işareti ve paragraf. Ham HTML asla geçirilmez. */
  function bicimle(metin) {
    var m = kacis(metin).replace(/^\s*ÜRÜN:.*$/gm, '').trim();
    m = m.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    m = m.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    m = m.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    var satir = m.split(/\n+/).filter(Boolean).map(function (s) {
      return /^\s*[-•*]\s+/.test(s)
        ? '<li>' + s.replace(/^\s*[-•*]\s+/, '') + '</li>'
        : '<p>' + s + '</p>';
    }).join('');
    return satir.replace(/(<li>.*?<\/li>)(?!\s*<li>)/gs, function (t) {
      return t.indexOf('<li>') === 0 ? '<ul>' + t + '</ul>' : t;
    });
  }

  var BICIM = [
    ':host{all:initial}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.kok{--altin:#a8842c;--murekkep:#1a221e;--sis:#6f736a;--cizgi:#e4ded1;',
    '  --kagit:#fbf8f1;--beyaz:#fff;',
    '  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    '  font-size:15px;line-height:1.6;color:var(--murekkep)}',

    /* --- baloncuk --- */
    '.bal{position:fixed;right:20px;bottom:20px;z-index:2147483000;',
    '  display:flex;align-items:center;gap:10px;padding:9px 16px 9px 9px;',
    '  border:1px solid var(--cizgi);border-radius:99px;background:var(--beyaz);',
    '  box-shadow:0 14px 40px -14px rgba(26,34,30,.34);cursor:pointer;',
    '  transition:transform .35s cubic-bezier(.2,.9,.3,1.2),box-shadow .35s}',
    '.bal:hover{transform:translateY(-3px);box-shadow:0 20px 48px -16px rgba(26,34,30,.42)}',
    '.bal img{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:0 0 auto}',
    '.bal b{display:block;font-size:13.5px;font-weight:600}',
    '.bal i{display:block;font-size:12px;font-style:normal;color:var(--sis)}',
    '.bal .nokta{display:inline-block;width:6px;height:6px;border-radius:50%;',
    '  background:#3fa66a;margin-right:6px;vertical-align:middle}',
    '.bal .kapat{border:0;background:none;color:var(--sis);font-size:17px;',
    '  line-height:1;padding:4px;cursor:pointer;margin-left:2px}',
    '@media(max-width:520px){.bal{right:14px;bottom:14px;padding:8px 13px 8px 8px}',
    '  .bal i{display:none}}',

    /* --- panel --- */
    '.panel{position:fixed;right:20px;bottom:20px;z-index:2147483000;',
    '  width:390px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 40px);',
    '  display:flex;flex-direction:column;overflow:hidden;',
    '  border:1px solid var(--cizgi);border-radius:18px;background:var(--kagit);',
    '  box-shadow:0 30px 80px -24px rgba(26,34,30,.45);',
    '  opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;',
    '  transition:opacity .3s,transform .3s cubic-bezier(.2,.9,.3,1.2)}',
    '.panel.acik{opacity:1;transform:none;pointer-events:auto}',
    '@media(max-width:520px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;',
    '  height:100dvh;max-height:100dvh;border-radius:0;border:0}}',

    '.ust{display:flex;align-items:center;gap:11px;padding:14px 16px;',
    '  border-bottom:1px solid var(--cizgi);background:var(--beyaz)}',
    '.ust img{width:40px;height:40px;border-radius:50%;object-fit:cover}',
    '.ust .ad{font-weight:600;font-size:14.5px}',
    '.ust .kimden{font-size:11.5px;color:var(--sis)}',
    '.ust .kapa{margin-left:auto;border:0;background:none;font-size:22px;',
    '  line-height:1;color:var(--sis);cursor:pointer;padding:4px 6px}',

    '.akis{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;',
    '  -webkit-overflow-scrolling:touch}',
    '.msj{max-width:86%;padding:11px 14px;border-radius:14px;font-size:14.5px}',
    '.msj p{margin:0 0 8px}.msj p:last-child{margin:0}',
    '.msj ul{margin:6px 0;padding-left:18px}.msj li{margin:3px 0}',
    '.msj a{color:var(--altin);text-decoration:underline}',
    '.ben{align-self:flex-end;background:var(--murekkep);color:#f4f1e8;border-bottom-right-radius:5px}',
    '.o{align-self:flex-start;background:var(--beyaz);border:1px solid var(--cizgi);',
    '  border-bottom-left-radius:5px}',
    '.yaziyor{display:flex;gap:4px;padding:13px 15px}',
    '.yaziyor span{width:6px;height:6px;border-radius:50%;background:var(--sis);',
    '  animation:zipla 1.2s infinite}',
    '.yaziyor span:nth-child(2){animation-delay:.18s}',
    '.yaziyor span:nth-child(3){animation-delay:.36s}',
    '@keyframes zipla{0%,60%,100%{opacity:.3;transform:translateY(0)}',
    '  30%{opacity:1;transform:translateY(-4px)}}',

    /* --- ürün kartı --- */
    '.urunler{display:flex;flex-direction:column;gap:8px;align-self:flex-start;',
    '  max-width:86%;width:100%}',
    '.urun{display:flex;gap:11px;align-items:center;padding:9px;text-decoration:none;',
    '  border:1px solid var(--cizgi);border-radius:12px;background:var(--beyaz);',
    '  color:inherit;transition:border-color .3s,transform .3s}',
    '.urun:hover{border-color:var(--altin);transform:translateY(-1px)}',
    '.urun img{width:46px;height:46px;border-radius:8px;object-fit:cover;flex:0 0 auto;',
    '  background:var(--kagit)}',
    '.urun .ad{font-size:13px;font-weight:600;line-height:1.35}',
    '.urun .fi{font-size:12px;color:var(--altin);margin-top:2px}',

    '.wa{display:flex;align-items:center;justify-content:center;gap:8px;',
    '  align-self:flex-start;max-width:86%;padding:11px 16px;border-radius:99px;',
    '  background:#25d366;color:#08331a;font-size:13.5px;font-weight:600;',
    '  text-decoration:none}',

    '.alt-bar{border-top:1px solid var(--cizgi);background:var(--beyaz);padding:11px 12px}',
    '.satir{display:flex;gap:8px;align-items:flex-end}',
    '.satir textarea{flex:1;resize:none;border:1px solid var(--cizgi);border-radius:12px;',
    '  padding:10px 12px;font:inherit;font-size:14.5px;max-height:110px;background:var(--kagit);',
    '  color:var(--murekkep);outline:none}',
    '.satir textarea:focus{border-color:var(--altin)}',
    '.gonder{flex:0 0 auto;width:42px;height:42px;border:0;border-radius:50%;',
    '  background:var(--altin);color:#fff;font-size:17px;cursor:pointer}',
    '.gonder:disabled{opacity:.45;cursor:default}',
    '.kvkk{margin:8px 2px 0;font-size:10.5px;line-height:1.5;color:var(--sis)}',
    '.kvkk a{color:var(--sis)}',
    '.oneri{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
    '.oneri button{border:1px solid var(--cizgi);background:var(--beyaz);border-radius:99px;',
    '  padding:7px 12px;font:inherit;font-size:12.5px;color:var(--murekkep);cursor:pointer}',
    '.oneri button:hover{border-color:var(--altin);color:var(--altin)}',
  ].join('');

  var ACILIS =
    'Merhaba, ben Dr. Ecz. Fidan Pesen Özdoğan Hocamızın asistanıyım. ' +
    'Ne aradığınızı ya da neye iyi gelmesini istediğinizi yazın, ' +
    'Doğal Markam ürünleri arasından size uygun olanı birlikte bulalım.';

  var ONERILER = ['Cildim çok kuru', 'Saçlarım dökülüyor', 'Uykuya dalmakta zorlanıyorum',
    'Bağışıklığımı desteklemek istiyorum'];

  /* ------------------------------------------------------------------- kurulum */
  function kur() {
    var yuva = document.createElement('div');
    yuva.setAttribute('data-fidana-sor', '');
    var golge = yuva.attachShadow({ mode: 'open' });
    var bicim = document.createElement('style');
    bicim.textContent = BICIM;
    golge.appendChild(bicim);

    var kok = el('div', 'kok');
    golge.appendChild(kok);
    document.body.appendChild(yuva);

    /* --- baloncuk --- */
    var bal = el('div', 'bal');
    bal.setAttribute('role', 'button');
    bal.setAttribute('tabindex', '0');
    bal.setAttribute('aria-label', "Fidan'a Sor asistanını aç");
    bal.innerHTML =
      '<img src="' + AVATAR + '" alt="">' +
      '<span><b>Fidan’a Sor</b>' +
      '<i><span class="nokta"></span>Size nasıl yardımcı olabilirim?</i></span>' +
      '<button class="kapat" type="button" aria-label="Kapat">×</button>';
    kok.appendChild(bal);

    /* --- panel --- */
    var panel = el('div', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', "Fidan'a Sor");
    panel.innerHTML =
      '<div class="ust">' +
        '<img src="' + AVATAR + '" alt="">' +
        '<div><div class="ad">Fidan’a Sor</div>' +
        '<div class="kimden">Dr. Ecz. Fidan Pesen Özdoğan’ın asistanı</div></div>' +
        '<button class="kapa" type="button" aria-label="Kapat">×</button>' +
      '</div>' +
      '<div class="akis"></div>' +
      '<div class="alt-bar">' +
        '<div class="oneri"></div>' +
        '<div class="satir">' +
          '<textarea rows="1" placeholder="Mesajınızı yazın..." aria-label="Mesaj"></textarea>' +
          '<button class="gonder" type="button" aria-label="Gönder">→</button>' +
        '</div>' +
        '<p class="kvkk">Bu bir otomatik asistandır, tıbbi tavsiye vermez. ' +
        'Görüşmeler hizmet kalitesi için kaydedilir. ' +
        '<a href="' + KOK + '/asistan" target="_blank" rel="noopener">Ayrıntı</a></p>' +
      '</div>';
    kok.appendChild(panel);

    var akis = panel.querySelector('.akis');
    var kutu = panel.querySelector('textarea');
    var gonderDugme = panel.querySelector('.gonder');
    var oneriKap = panel.querySelector('.oneri');
    var gecmis = [];
    var mesgul = false;
    var acildi = false;

    var oturum = (function () {
      try {
        var o = sessionStorage.getItem('fidana_oturum');
        if (!o) { o = 'ds-' + Math.random().toString(36).slice(2, 11); sessionStorage.setItem('fidana_oturum', o); }
        return o;
      } catch (e) { return 'ds-' + Math.random().toString(36).slice(2, 11); }
    })();

    function kaydir() { akis.scrollTop = akis.scrollHeight; }

    function balonEkle(kim, metin) {
      var d = el('div', 'msj ' + (kim === 'ben' ? 'ben' : 'o'));
      d.innerHTML = bicimle(metin);
      akis.appendChild(d); kaydir(); return d;
    }

    function onerileriGoster() {
      oneriKap.innerHTML = '';
      ONERILER.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = m;
        b.addEventListener('click', function () { kutu.value = m; yolla(); });
        oneriKap.appendChild(b);
      });
    }

    function urunleriGoster(liste) {
      if (!liste || !liste.length) return;
      var k = el('div', 'urunler');
      liste.forEach(function (u) {
        var a = document.createElement('a');
        a.className = 'urun'; a.href = u.bag;
        a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML =
          (u.gorsel ? '<img src="' + kacis(u.gorsel) + '" alt="" loading="lazy">' : '') +
          '<span><span class="ad">' + kacis(u.ad) + '</span>' +
          (u.fiyat ? '<span class="fi">' + kacis(String(u.fiyat)) + ' TL</span>' : '') + '</span>';
        k.appendChild(a);
      });
      akis.appendChild(k); kaydir();
    }

    function waGoster() {
      var a = document.createElement('a');
      a.className = 'wa'; a.href = WA; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Müşteri temsilcimize WhatsApp’tan yazın';
      akis.appendChild(a); kaydir();
    }

    function yollaKapat() { mesgul = false; gonderDugme.disabled = false; kutu.disabled = false; }

    async function yolla() {
      var metin = kutu.value.trim();
      if (!metin || mesgul) return;
      mesgul = true; gonderDugme.disabled = true;
      kutu.value = ''; kutu.style.height = 'auto';
      oneriKap.innerHTML = '';
      balonEkle('ben', metin);
      gecmis.push({ rol: 'kullanici', metin: metin });

      var bekle = el('div', 'msj o yaziyor');
      bekle.innerHTML = '<span></span><span></span><span></span>';
      akis.appendChild(bekle); kaydir();

      var balon = null, toplam = '';
      try {
        var yanit = await fetch(UC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mesajlar: gecmis.slice(-24), oturum: oturum }),
        });
        if (!yanit.ok || !yanit.body) throw new Error('HTTP ' + yanit.status);

        var okuyucu = yanit.body.getReader();
        var cozucu = new TextDecoder();
        var tampon = '';

        while (true) {
          var p = await okuyucu.read();
          if (p.done) break;
          tampon += cozucu.decode(p.value, { stream: true });
          var bloklar = tampon.split('\n\n');
          tampon = bloklar.pop() || '';
          for (var i = 0; i < bloklar.length; i++) {
            var satirlar = bloklar[i].split('\n');
            var tur = '', veri = '';
            for (var j = 0; j < satirlar.length; j++) {
              if (satirlar[j].indexOf('event:') === 0) tur = satirlar[j].slice(6).trim();
              else if (satirlar[j].indexOf('data:') === 0) veri += satirlar[j].slice(5).trim();
            }
            if (!tur || !veri) continue;
            var d;
            try { d = JSON.parse(veri); } catch (e) { continue; }

            if (tur === 'parca') {
              if (bekle.parentNode) bekle.remove();
              if (!balon) balon = balonEkle('o', '');
              toplam += d;
              balon.innerHTML = bicimle(toplam);
              kaydir();
            } else if (tur === 'bitti') {
              if (bekle.parentNode) bekle.remove();
              gecmis.push({ rol: 'asistan', metin: toplam });
              urunleriGoster(d.urunler);
              if (d.whatsapp) waGoster();
            }
          }
        }
      } catch (e) {
        if (bekle.parentNode) bekle.remove();
        balonEkle('o',
          'Şu an bağlantıda bir sorun var. Birazdan tekrar deneyebilir ya da ' +
          'doğrudan [WhatsApp destek hattımıza](' + WA + ') yazabilirsiniz.');
      }
      yollaKapat();
      kutu.focus();
    }

    /* --- olaylar --- */
    function ac() {
      panel.classList.add('acik');
      bal.style.display = 'none';
      if (!acildi) { acildi = true; balonEkle('o', ACILIS); onerileriGoster(); }
      setTimeout(function () { kutu.focus(); }, 260);
    }
    function kapa() { panel.classList.remove('acik'); bal.style.display = ''; }

    bal.addEventListener('click', function (e) {
      if (e.target.closest('.kapat')) {
        e.stopPropagation();
        try { sessionStorage.setItem('fidana_kapali', '1'); } catch (er) {}
        yuva.remove();
        return;
      }
      ac();
    });
    bal.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); }
    });
    panel.querySelector('.kapa').addEventListener('click', kapa);
    gonderDugme.addEventListener('click', yolla);
    kutu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); yolla(); }
    });
    kutu.addEventListener('input', function () {
      kutu.style.height = 'auto';
      kutu.style.height = Math.min(kutu.scrollHeight, 110) + 'px';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('acik')) kapa();
    });

    /* Dışarıdan açılabilsin: sitedeki herhangi bir düğmeye
       onclick="FidanaSor.ac()" yazmak yeterli. */
    window.FidanaSor = { ac: ac, kapat: kapa };
  }

  try {
    if (sessionStorage.getItem('fidana_kapali') === '1') return;
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kur);
  } else {
    kur();
  }
})();

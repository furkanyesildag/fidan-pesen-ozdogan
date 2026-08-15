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
  var AVATAR = KOK + '/assets/img/asistan-avatar.webp';

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
    /* Renkler ve yazı karakterleri fidanpesen.com'daki asistanla aynı:
       iki yüzey aynı markanın parçası gibi okunsun. */
    '.kok{--altin:#a8842c;--altin-ac:#c9a447;--altin-rgb:168,132,44;',
    '  --murekkep:#1a221e;--ink2:#3c4640;--sis:#6f736a;--cizgi:#e6e0d3;',
    '  --kagit:#fbf8f1;--kutu:#fffdf8;--beyaz:#fff;',
    '  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;',
    '  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    '  font-size:15px;line-height:1.6;color:var(--murekkep)}',

    /* --- baloncuk --- */
    '.bal{position:fixed;right:20px;bottom:var(--dip,20px);z-index:2147483000;',
    '  display:flex;align-items:center;gap:11px;padding:8px 18px 8px 8px;',
    '  border:1px solid var(--cizgi);border-radius:99px;background:var(--beyaz);',
    '  box-shadow:0 16px 42px -14px rgba(26,34,30,.30);cursor:pointer;',
    '  transition:transform .4s cubic-bezier(.2,.9,.3,1.2),box-shadow .4s,border-color .4s}',
    '.bal:hover{transform:translateY(-3px);border-color:rgba(var(--altin-rgb),.5);',
    '  box-shadow:0 22px 52px -16px rgba(26,34,30,.4)}',
    '.bal img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:0 0 auto;',
    '  border:1px solid rgba(var(--altin-rgb),.3)}',
    '.bal b{display:block;font-family:var(--serif);font-weight:500;font-size:15px;letter-spacing:.01em}',
    '.bal i{display:block;font-size:11.5px;font-style:normal;color:var(--sis);margin-top:1px}',
    '.bal .nokta{display:inline-block;width:6px;height:6px;border-radius:50%;',
    '  background:#3fa66a;margin-right:6px;vertical-align:middle}',
    '.bal .kapat{border:0;background:none;color:var(--sis);font-size:17px;',
    '  line-height:1;padding:4px;cursor:pointer;margin-left:2px;opacity:.5}',
    '.bal .kapat:hover{opacity:1}',
    '@media(max-width:520px){',
    '  .bal{right:14px;width:58px;height:58px;padding:0;justify-content:center;border-radius:50%}',
    '  .bal span{display:none}.bal .kapat{display:none}',
    '  .bal img{width:46px;height:46px}}',

    /* --- doğrudan WhatsApp düğmesi ---
       Mağazanın kendi yeşil balonunun yerini alıyor. Asistan "hangi ürün
       bana uygun" sorusunu çözüyor; bu düğme ise doğrudan insana ulaşmak
       isteyene. İkisi yan yana ve aynı dilde duruyor. */
    '.wa-dugme{position:fixed;right:20px;bottom:var(--ust-dip,88px);z-index:2147482999;',
    '  width:52px;height:52px;border-radius:50%;display:flex;align-items:center;',
    '  justify-content:center;background:#fff;border:1px solid rgba(37,211,102,.45);',
    '  box-shadow:0 14px 34px -12px rgba(26,34,30,.3);cursor:pointer;text-decoration:none;',
    '  transition:transform .4s cubic-bezier(.2,.9,.3,1.2),box-shadow .4s,background .35s}',
    '.wa-dugme:hover{transform:translateY(-3px);background:#25d366;',
    '  box-shadow:0 20px 44px -14px rgba(37,211,102,.55)}',
    '.wa-dugme svg{width:27px;height:27px;fill:#25d366;transition:fill .35s}',
    '.wa-dugme:hover svg{fill:#fff}',
    '.wa-ipucu{position:absolute;right:60px;white-space:nowrap;background:var(--murekkep);',
    '  color:#f4f1e8;font-size:12px;padding:6px 11px;border-radius:8px;opacity:0;',
    '  pointer-events:none;transition:opacity .3s,transform .3s;transform:translateX(6px)}',
    '.wa-dugme:hover .wa-ipucu{opacity:1;transform:none}',
    '@media(max-width:520px){.wa-dugme{right:14px;width:50px;height:50px}',
    '  .wa-ipucu{display:none}}',

    /* --- panel --- */
    '.panel{position:fixed;right:20px;bottom:var(--dip,20px);z-index:2147483000;',
    '  width:396px;max-width:calc(100vw - 32px);height:620px;',
    '  max-height:calc(100vh - var(--dip,20px) - 20px);',
    '  display:flex;flex-direction:column;overflow:hidden;',
    '  border:1px solid var(--cizgi);border-radius:20px;background:var(--kagit);',
    '  box-shadow:0 34px 90px -26px rgba(26,34,30,.5);',
    '  opacity:0;transform:translateY(14px) scale(.98);pointer-events:none;',
    '  transition:opacity .32s,transform .32s cubic-bezier(.2,.9,.3,1.2)}',
    '.panel.acik{opacity:1;transform:none;pointer-events:auto}',
    '@media(max-width:520px){.panel{left:0;right:0;bottom:0!important;width:100vw;max-width:100vw;',
    '  height:100dvh;max-height:100dvh;border-radius:0;border:0}}',

    '.ust{display:flex;align-items:center;gap:12px;padding:15px 18px;',
    '  border-bottom:1px solid var(--cizgi);',
    '  background:linear-gradient(160deg,#fff,rgba(var(--altin-rgb),.05))}',
    '.ust img{width:42px;height:42px;border-radius:50%;object-fit:cover;',
    '  border:1px solid rgba(var(--altin-rgb),.32)}',
    '.ust .ad{font-family:var(--serif);font-weight:500;font-size:17px}',
    '.ust .kimden{font-size:11px;color:var(--sis);margin-top:1px}',
    '.ust .kapa{margin-left:auto;border:0;background:none;font-size:21px;',
    '  line-height:1;color:var(--sis);cursor:pointer;padding:4px 6px;border-radius:8px}',
    '.ust .kapa:hover{background:rgba(var(--altin-rgb),.1);color:var(--murekkep)}',

    '.akis{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:20px 18px 10px;',
    '  display:flex;flex-direction:column;gap:16px;-webkit-overflow-scrolling:touch;',
    '  scrollbar-width:thin;scrollbar-color:rgba(var(--altin-rgb),.4) transparent}',
    '.akis::-webkit-scrollbar{width:6px}',
    '.akis::-webkit-scrollbar-thumb{background:rgba(var(--altin-rgb),.4);border-radius:99px}',

    /* --- balonlar: sitedeki asistanla aynı düzen --- */
    '.msj{max-width:88%;animation:gir .35s ease both}',
    '@keyframes gir{from{opacity:0;transform:translateY(8px)}}',
    '.msj .kim{display:block;margin:0 0 6px 2px;font-size:10px;letter-spacing:.18em;',
    '  text-transform:uppercase;color:var(--altin)}',
    '.msj .govde{padding:13px 17px;border-radius:16px;border:1px solid var(--cizgi);',
    '  background:var(--kutu);font-size:15px;line-height:1.62;color:var(--ink2)}',
    '.ben{align-self:flex-end}',
    '.ben .govde{background:linear-gradient(150deg,rgba(var(--altin-rgb),.16),rgba(var(--altin-rgb),.06));',
    '  border-color:rgba(var(--altin-rgb),.32);color:var(--murekkep);border-bottom-right-radius:5px}',
    '.o .govde{border-bottom-left-radius:5px}',
    '.govde p{margin:0 0 10px}.govde p:last-child{margin:0}',
    '.govde b{color:var(--murekkep);font-weight:600}',
    '.govde a{color:var(--altin);border-bottom:1px solid rgba(var(--altin-rgb),.4);text-decoration:none}',
    '.govde ul{margin:8px 0 10px;padding:0;list-style:none}',
    '.govde li{position:relative;padding-left:18px;margin-bottom:6px}',
    '.govde li::before{content:"";position:absolute;left:2px;top:.65em;width:5px;height:5px;',
    '  border-radius:50%;background:var(--altin);opacity:.8}',
    '.yaziyor .govde{display:flex;gap:5px;padding:17px}',
    '.yaziyor i{width:6px;height:6px;border-radius:50%;background:var(--altin);opacity:.35;',
    '  animation:zipla 1.2s infinite}',
    '.yaziyor i:nth-child(2){animation-delay:.18s}',
    '.yaziyor i:nth-child(3){animation-delay:.36s}',
    '@keyframes zipla{0%,60%,100%{opacity:.3;transform:translateY(0)}',
    '  30%{opacity:1;transform:translateY(-4px)}}',

    /* --- ürün kartı --- */
    '.urunler{display:flex;flex-direction:column;gap:9px;align-self:flex-start;max-width:88%;width:100%}',
    '.urun{display:flex;gap:12px;align-items:center;padding:10px;text-decoration:none;',
    '  border:1px solid var(--cizgi);border-radius:14px;background:var(--beyaz);',
    '  color:inherit;transition:border-color .35s,transform .35s,box-shadow .35s}',
    '.urun:hover{border-color:rgba(var(--altin-rgb),.55);transform:translateY(-2px);',
    '  box-shadow:0 12px 28px -14px rgba(26,34,30,.35)}',
    '.urun img{width:52px;height:52px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:var(--kagit)}',
    '.urun .ad{display:block;font-size:13px;font-weight:600;line-height:1.36;color:var(--murekkep)}',
    '.urun .fi{display:block;font-size:12.5px;color:var(--altin);margin-top:3px}',
    '.urun .ok{margin-left:auto;color:var(--altin);font-size:15px;flex:0 0 auto}',

    '.wa{display:inline-flex;align-items:center;justify-content:center;gap:8px;',
    '  align-self:flex-start;max-width:88%;padding:12px 20px;border-radius:99px;',
    '  background:#25d366;color:#08331a;font-size:13.5px;font-weight:600;',
    '  text-decoration:none;transition:transform .3s}',
    '.wa:hover{transform:translateY(-2px)}',

    '.alt-bar{border-top:1px solid var(--cizgi);background:var(--beyaz);padding:12px 14px}',
    '.satir{display:flex;gap:9px;align-items:flex-end}',
    '.satir textarea{flex:1;resize:none;border:1px solid var(--cizgi);border-radius:14px;',
    '  padding:11px 14px;font:inherit;font-size:15px;max-height:110px;background:var(--kagit);',
    '  color:var(--murekkep);outline:none;transition:border-color .3s}',
    '.satir textarea:focus{border-color:rgba(var(--altin-rgb),.6)}',
    '.gonder{flex:0 0 auto;width:44px;height:44px;border:0;border-radius:50%;',
    '  background:linear-gradient(140deg,var(--altin-ac),var(--altin));color:#fff;',
    '  font-size:17px;cursor:pointer;transition:transform .3s,filter .3s}',
    '.gonder:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.08)}',
    '.gonder:disabled{opacity:.4;cursor:default}',
    '.kvkk{margin:9px 3px 0;font-size:10.5px;line-height:1.55;color:var(--sis)}',
    '.kvkk a{color:var(--sis)}',
    '.oneri{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px}',
    '.oneri button{border:1px solid var(--cizgi);background:var(--beyaz);border-radius:99px;',
    '  padding:8px 14px;font:inherit;font-size:12.5px;color:var(--ink2);cursor:pointer;',
    '  transition:border-color .3s,color .3s,transform .3s}',
    '.oneri button:hover{border-color:rgba(var(--altin-rgb),.55);color:var(--altin);transform:translateY(-1px)}',
  ].join('');

  var ACILIS =
    'Merhaba, ben Dr. Ecz. Fidan Pesen Özdoğan Hocamızın asistanıyım. ' +
    'Ne aradığınızı ya da neye iyi gelmesini istediğinizi yazın, ' +
    'Doğal Markam ürünleri arasından size uygun olanı birlikte bulalım.';

  var ONERILER = ['Cildim çok kuru', 'Saçlarım dökülüyor', 'Uykuya dalmakta zorlanıyorum',
    'Bağışıklığımı desteklemek istiyorum'];

  /**
   * Sağ alt köşe boş mu?
   *
   * Pek çok mağazada orada zaten bir WhatsApp düğmesi duruyor; baloncuğu
   * körlemesine oraya koyunca üstüne biniyor. Kendi öğemizi eklemeden ÖNCE
   * o noktada ne olduğuna bakıyoruz: sabit konumlu bir şey varsa baloncuk
   * onun üstüne çıkacak kadar yukarı kayıyor.
   *
   * Betik etiketine data-dip="120" yazılarak elle de belirlenebilir.
   */
  function dipBosluk() {
    var elle = document.currentScript && document.currentScript.getAttribute('data-dip');
    if (elle) return parseInt(elle, 10) || 20;

    var vh = window.innerHeight;
    var enYuksek = 0;
    /* Baloncuk sağ altta durduğu için o köşe yoklanıyor. Tek nokta yanıltıcı
       olabildiğinden birkaç noktaya bakılıyor: çerez şeridi, sepet çubuğu ya
       da yukarı çık düğmesi gibi öğeler farklı yüksekliklerde oluyor. */
    var vw = window.innerWidth;
    var noktalar = [[vw - 40, vh - 40], [vw - 40, vh - 70], [vw - 70, vh - 40], [vw - 90, vh - 55]];
    for (var i = 0; i < noktalar.length; i++) {
      var o = document.elementFromPoint(noktalar[i][0], noktalar[i][1]);
      while (o && o !== document.body && o !== document.documentElement) {
        var b = getComputedStyle(o);
        if (b.position === 'fixed' || b.position === 'sticky') {
          var k = o.getBoundingClientRect();
          /* Ekranın altına yapışmış, makul boyutta bir öğe mi? */
          if (k.height > 24 && k.height < 200 && k.bottom > vh - 140) {
            enYuksek = Math.max(enYuksek, vh - k.top);
          }
          break;
        }
        o = o.parentElement;
      }
    }
    return enYuksek ? Math.round(enYuksek + 16) : 20;
  }

  /* ------------------------------------------------------------------- kurulum */
  function kur() {
    var yuva = document.createElement('div');
    yuva.setAttribute('data-fidana-sor', '');
    var golge = yuva.attachShadow({ mode: 'open' });
    var bicim = document.createElement('style');
    bicim.textContent = BICIM;
    golge.appendChild(bicim);

    var kok = el('div', 'kok');
    /* Ölçüm kendi öğemiz sayfaya girmeden yapılmalı, yoksa kendimizi
       ölçmüş oluruz. */
    var dip = dipBosluk();
    kok.style.setProperty('--dip', dip + 'px');
    /* Asistan baloncuğu tabanda; WhatsApp düğmesi onun üstünde durur.
       68 piksel, baloncuğun yüksekliği artı aradaki boşluk. */
    kok.style.setProperty('--ust-dip', (dip + 68) + 'px');
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

    /* --- doğrudan WhatsApp düğmesi: baloncuğun hemen üstünde --- */
    var waDugme = document.createElement('a');
    waDugme.className = 'wa-dugme';
    /* Hangi sayfadan yazıldığı mesaja giriyor: ürün sayfasındaysa temsilci
       hangi ürün için sorulduğunu ilk satırda görüyor, müşteri de baştan
       anlatmak zorunda kalmıyor. Tek tık, ara adım yok. */
    waDugme.href = (function () {
      var baslik = (document.title || '').replace(/\s*[|·–-]\s*Doğal ?markam.*$/i, '').trim();
      var satir = ['Merhaba, doğalmarkam.com üzerinden yazıyorum.'];
      var markaMi = /^do[ğg]al ?markam/i.test(baslik) || baslik.length > 90;
      if (baslik && !markaMi) satir.push('', 'Baktığım sayfa: ' + baslik);
      satir.push('', 'Bilgi almak istiyorum.');
      return WA + '?text=' + encodeURIComponent(satir.join('\n'));
    })();
    waDugme.target = '_blank';
    waDugme.rel = 'noopener';
    waDugme.setAttribute('aria-label', 'WhatsApp ile yazın');
    waDugme.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1l-.9 1.2c-.2.2-.3.2-.6.1-1.5-.7-2.6-1.6-3.5-3-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-1.2 1.3-1.1 3 .2 4.9 1.4 2.1 3 3.4 5.4 4.2 1.6.5 2.3.4 3-.1.4-.3.9-1 1-1.6.1-.5 0-.7-.2-.8Z"/>' +
      '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/>' +
      '</svg><span class="wa-ipucu">WhatsApp ile yazın</span>';
    kok.appendChild(waDugme);

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
      d.innerHTML = (kim === 'ben' ? '' : '<span class="kim">Fidan\u2019ın Asistanı</span>')
        + '<div class="govde">' + bicimle(metin) + '</div>';
      akis.appendChild(d); kaydir();
      return d.querySelector('.govde');
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
          (u.fiyat ? '<span class="fi">' + kacis(String(u.fiyat)) + ' TL</span>' : '') + '</span>' +
          '<span class="ok" aria-hidden="true">\u2197</span>';
        k.appendChild(a);
      });
      akis.appendChild(k); kaydir();
    }

    function waGoster(bag) {
      var a = document.createElement('a');
      /* Sunucu hazır metinli bir bağlantı yolluyorsa o kullanılır: müşteri
         temsilcisi kişinin ne sorduğunu ve ne önerildiğini görerek başlar. */
      a.className = 'wa'; a.href = bag || WA; a.target = '_blank'; a.rel = 'noopener';
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
      bekle.innerHTML = '<span class="kim">Fidan\u2019ın Asistanı</span>'
        + '<div class="govde"><i></i><i></i><i></i></div>';
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
              if (d.whatsapp) waGoster(d.waBag);
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
      waDugme.style.display = 'none';
      if (!acildi) { acildi = true; balonEkle('o', ACILIS); onerileriGoster(); }
      setTimeout(function () { kutu.focus(); }, 260);
    }
    function kapa() {
      panel.classList.remove('acik');
      bal.style.display = '';
      waDugme.style.display = '';
    }

    bal.addEventListener('click', function (e) {
      if (e.target.closest('.kapat')) {
        e.stopPropagation();
        try { sessionStorage.setItem('fidana_kapali', '1'); } catch (er) {}
        /* Baloncuk kapatılsa da WhatsApp düğmesi kalsın: insana ulaşma
           yolunu kapatmak doğru olmaz. */
        bal.remove();
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

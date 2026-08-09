/*
 * asistan.js — "Fidan'ın Asistanı" ürün bulucu
 * ---------------------------------------------------------------------------
 * Tamamen tarayıcıda çalışır: sunucu yok, API yok, harici kütüphane yok.
 * Katalog /data/urunler.json dosyasından okunur, eşleştirme burada yapılır.
 * Yazdığınız hiçbir şey hiçbir yere gönderilmez.
 *
 * GÜVENLİK KATMANI
 * Bu bir sağlık danışmanı değildir; ürün kataloğunda arama yapan bir bulucudur.
 *   · ACİL belirti geçen metinlerde hiçbir ürün gösterilmez, 112 kartı çıkar.
 *   · DİKKAT durumlarında (gebelik, emzirme, bebek, kronik hastalık, ilaç,
 *     ameliyat) sonuçların üstünde uyarı kartı belirir.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  /* ------------------------------------------------------- Türkçe sadeleştirme */
  function sade(m) {
    return String(m == null ? '' : m)
      .replace(/I/g, 'ı').replace(/İ/g, 'i')
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Türkçe eklerin kabaca atılması: "sacimin" ~ "sac" olsun diye gövde alınır. */
  function govde(k) {
    return k.length > 5 ? k.slice(0, Math.max(4, k.length - 2)) : k;
  }

  /* ------------------------------------------------------------ güvenlik */
  var ACIL = [
    'gogus agrisi', 'gogsumde agri', 'nefes darligi', 'nefes alamiyorum',
    'nefes alamiyor', 'bayildim', 'bayiliyorum', 'bilinc kaybi', 'felc', 'inme',
    'konusamiyorum', 'yuzum kaydi', 'siddetli bas agrisi', 'durmayan kanama',
    'kan kusma', 'kanli kusma', 'kanli disk', 'intihar', 'kendime zarar',
    'yasamak istemiyorum', 'zehirlenme', 'anafilaksi', 'alerjik sok',
    'havale gecirdi', 'kalp krizi', 'komada', 'ates 40', 'ates 39',
    'gorme kaybi', 'ani gorme'
  ];
  var DIKKAT = [
    { k: ['hamile', 'gebe', 'gebelik', 'hamilelik'], n: 'Gebelik' },
    { k: ['emzir', 'sut veriyorum', 'emziriyorum'], n: 'Emzirme' },
    { k: ['bebek', 'yenidogan', 'aylik cocuk', 'bebegim'], n: 'Bebek' },
    { k: ['cocugum', 'cocuk', 'yasindaki'], n: 'Çocuk' },
    { k: ['kanser', 'tumor', 'kemoterapi', 'radyoterapi'], n: 'Onkolojik tedavi' },
    { k: ['bobrek yetmezligi', 'diyaliz', 'karaciger yetmezligi', 'siroz'], n: 'Böbrek veya karaciğer yetmezliği' },
    { k: ['tansiyon ilaci', 'kan sulandirici', 'warfarin', 'kumadin', 'insulin',
      'antidepresan', 'tiroid ilaci', 'ilac kullaniyorum', 'ilaclarim'], n: 'Düzenli ilaç kullanımı' },
    { k: ['ameliyat', 'operasyon olacagim'], n: 'Planlanmış ameliyat' },
    { k: ['seker hastasi', 'diyabet', 'tip 1', 'tip 2'], n: 'Diyabet' }
  ];

  /* --------------------------------------------- niyet sözlüğü (şikâyet → anahtar) */
  /* Soldaki ifadeler kullanıcının yazdığı dil, sağdakiler katalog anahtarları. */
  var NIYET = [
    { der: ['sac dokul', 'sacim dokul', 'sac dokulmesi', 'kellik', 'sac seyrel', 'sac azal', 'dokulme'],
      ara: ['sac', 'dokulme', 'serum', 'dolgunlastirici', 'sampuan'] },
    { der: ['kepek'], ara: ['kepek', 'sampuan', 'sac'] },
    { der: ['sivilce', 'akne', 'ergenlik sivilce', 'siyah nokta'],
      ara: ['akne', 'sivilce', 'krem', 'temizlik'] },
    { der: ['leke', 'gunes lekesi', 'melasma', 'cil'],
      ara: ['leke', 'beyazlatici', 'krem'] },
    { der: ['kirisik', 'yaslanma', 'ince cizgi', 'sarkma'],
      ara: ['kirisiklik', 'serum', 'krem', 'yaslanma'] },
    { der: ['goz alti', 'morluk', 'torbalanma', 'goz cevresi'],
      ara: ['goz', 'morluk', 'torbalanma', 'cevresi'] },
    { der: ['kuru cilt', 'cildim kuru', 'nem', 'nemlendir'],
      ara: ['nemlendirici', 'nem', 'krem'] },
    { der: ['yagli cilt', 'gozenek', 'parlama'],
      ara: ['gozenekli', 'temizlik', 'cilt'] },
    { der: ['kizarik', 'rozasea', 'rozali', 'hassas cilt'],
      ara: ['rozali', 'kizariklik', 'krem'] },
    { der: ['gunes', 'uv', 'gunes koruy'], ara: ['gunes', 'krem', 'koruyucu'] },
    { der: ['ter kokusu', 'koltuk alti', 'terleme', 'deodorant'],
      ara: ['deo', 'koltuk', 'krem'] },
    { der: ['sindirim', 'gaz', 'siskinlik', 'hazimsizlik', 'mide'],
      ara: ['sindirim', 'rezene', 'mide', 'cay'] },
    { der: ['uyku', 'uyuyamiyorum', 'stres', 'huzursuz', 'kaygi', 'sakinles'],
      ara: ['huzur', 'uyku', 'cay'] },
    { der: ['yorgun', 'halsiz', 'bagisiklik', 'enerji', 'kuvvet'],
      ara: ['kuvvet', 'bagisiklik', 'cay'] },
    { der: ['eklem', 'kirec', 'diz agri', 'romatizma', 'bel agri'],
      ara: ['eklem', 'borjoint', 'kirec'] },
    { der: ['oksuruk', 'bogaz', 'balgam', 'nefes', 'solunum', 'bronsit'],
      ara: ['nefes', 'okaliptus', 'adacay', 'bogaz'] },
    { der: ['karaciger', 'yag lanmasi', 'safra'],
      ara: ['karahindiba', 'enginar', 'karaciger'] },
    { der: ['prostat', 'idrar', 'mesane'], ara: ['isirgan', 'prostat', 'idrar'] },
    { der: ['tiroit', 'tiroid', 'guatr'], ara: ['tiroit', 'ceviz'] },
    { der: ['unutkanlik', 'hafiza', 'odaklan', 'dikkat'], ara: ['hafiza', 'ginseng'] },
    { der: ['adet', 'regl', 'menopoz', 'kadin'], ara: ['kadin', 'menopoz', 'adet'] },
    { der: ['sac bakim', 'sampuan'], ara: ['sac', 'sampuan', 'bakim'] },
    { der: ['ucucu yag', 'esansiyel yag', 'aromaterapi'], ara: ['ucucu', 'yag'] },
    { der: ['sabit yag', 'tasiyici yag', 'bitkisel yag'], ara: ['sabit', 'yag'] },
    { der: ['bitki cayi', 'cay', 'bitkisel cay'], ara: ['bitki', 'cay'] },
    { der: ['cocuk', 'macun'], ara: ['cocuk', 'macun'] }
  ];

  /* --------------------------------------------------------------- öğeler */
  var form = document.getElementById('asistanForm');
  if (!form) return;
  var alan = document.getElementById('asistanGirdi');
  var cikti = document.getElementById('asistanCikti');
  var durum = document.getElementById('asistanDurum');
  var cipKap = document.getElementById('asistanCipler');

  var katalog = null;
  var yukleniyor = null;

  function katalogYukle() {
    if (katalog) return Promise.resolve(katalog);
    if (yukleniyor) return yukleniyor;
    yukleniyor = fetch('/data/urunler.json')
      .then(function (y) {
        if (!y.ok) throw new Error('HTTP ' + y.status);
        return y.json();
      })
      .then(function (d) {
        katalog = d;
        katalog.urunler.forEach(function (u) {
          u._h = (u.anahtar || []).concat(sade(u.ad).split(' '), sade(u.kategori).split(' '))
            .filter(function (x) { return x && x.length > 2; })
            .map(govde);
        });
        return katalog;
      });
    return yukleniyor;
  }

  /* --------------------------------------------------------------- eşleştirme */
  function guvenlikTara(n) {
    for (var i = 0; i < ACIL.length; i++) if (n.indexOf(ACIL[i]) !== -1) return { acil: true };
    var uyarilar = [];
    for (var j = 0; j < DIKKAT.length; j++) {
      for (var k = 0; k < DIKKAT[j].k.length; k++) {
        if (n.indexOf(DIKKAT[j].k[k]) !== -1) { uyarilar.push(DIKKAT[j].n); break; }
      }
    }
    return { acil: false, uyarilar: uyarilar };
  }

  function ara(metin) {
    var n = sade(metin);
    var kelimeler = n.split(' ').filter(function (k) { return k.length > 2; }).map(govde);

    // niyet sözlüğünden gelen ek anahtarlar
    var ekler = [];
    NIYET.forEach(function (g) {
      for (var i = 0; i < g.der.length; i++) {
        if (n.indexOf(g.der[i]) !== -1) { ekler = ekler.concat(g.ara.map(govde)); break; }
      }
    });

    var hepsi = kelimeler.concat(ekler);
    if (!hepsi.length) return [];

    var sonuc = katalog.urunler.map(function (u) {
      var puan = 0;
      hepsi.forEach(function (k) {
        for (var i = 0; i < u._h.length; i++) {
          var h = u._h[i];
          if (h === k) { puan += 3; return; }
          if (h.indexOf(k) === 0 || k.indexOf(h) === 0) { puan += 2; return; }
        }
      });
      // niyet sözlüğünden gelen eşleşme kategoriyi de tutuyorsa öne çıkar
      if (ekler.length && sade(u.kategori) && ekler.some(function (e) {
        return sade(u.kategori).indexOf(e) !== -1;
      })) puan += 4;
      return { u: u, puan: puan };
    }).filter(function (x) { return x.puan > 0; });

    sonuc.sort(function (a, b) { return b.puan - a.puan; });
    return sonuc.slice(0, 12);
  }

  /* ---------------------------------------------------------------- çizim */
  function kacir(m) {
    return String(m == null ? '' : m).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function acilKarti() {
    return '<div class="asistan-acil" role="alert">' +
      '<b>Bu bir acil durum olabilir.</b>' +
      '<p>Yazdığınız ifadeler acil tıbbi değerlendirme gerektirebilecek belirtiler ' +
      'içeriyor. Lütfen vakit kaybetmeden <b>112 Acil</b> hattını arayın veya en ' +
      'yakın acil servise başvurun. Bu sayfa size ürün önermeyecektir.</p>' +
      '<a class="dugme birincil" href="tel:112">112&rsquo;yi ara</a>' +
      '</div>';
  }

  function dikkatKarti(uyarilar) {
    return '<div class="asistan-dikkat" role="note">' +
      '<b>Önce hekiminize danışın</b>' +
      '<p>Yazdıklarınızda <b>' + kacir(uyarilar.join(', ')) + '</b> geçiyor. ' +
      'Bu durumlarda bitkisel ürünler ve takviye edici gıdalar, hekiminizin ve ' +
      'eczacınızın bilgisi olmadan kullanılmamalıdır. Aşağıdaki liste yalnızca ' +
      'katalogda eşleşen ürünleri gösterir, bir öneri değildir.</p>' +
      '</div>';
  }

  function urunKarti(u) {
    return '<li class="asistan-urun">' +
      (u.gorsel ? '<img src="' + kacir(u.gorsel) + '" alt="" width="80" height="80" loading="lazy" decoding="async">' : '<span class="asistan-gorselsiz" aria-hidden="true"></span>') +
      '<div class="asistan-urun-govde">' +
        (u.kategori ? '<span class="asistan-kat">' + kacir(u.kategori) + '</span>' : '') +
        '<h3>' + kacir(u.ad) + '</h3>' +
      '</div>' +
      '<a class="asistan-bag" href="' + kacir(u.bag) + '" target="_blank" rel="noopener">' +
        'Mağazada gör<span aria-hidden="true"> ↗</span></a>' +
      '</li>';
  }

  function bosSonuc(metin) {
    return '<div class="asistan-bos">' +
      '<b>Eşleşen ürün bulunamadı.</b>' +
      '<p>“' + kacir(metin.slice(0, 80)) + '” için katalogda bir karşılık çıkmadı. ' +
      'Daha genel bir ifade deneyebilir (örneğin “saç bakımı”, “cilt nemlendirici”, ' +
      '“bitkisel çay”) ya da doğrudan mağazaya bakabilirsiniz.</p>' +
      '<a class="dugme" href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">dogalmarkam.com&rsquo;a git ↗</a>' +
      '</div>';
  }

  function calistir(metin) {
    if (!metin.trim()) return;
    durum.textContent = 'Katalogda aranıyor...';
    cikti.innerHTML = '';

    katalogYukle().then(function () {
      var g = guvenlikTara(sade(metin));
      if (g.acil) {
        cikti.innerHTML = acilKarti();
        durum.textContent = 'Acil uyarısı gösterildi.';
        cikti.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      var bulunan = ara(metin);
      var html = g.uyarilar.length ? dikkatKarti(g.uyarilar) : '';

      if (!bulunan.length) {
        html += bosSonuc(metin);
        durum.textContent = 'Sonuç bulunamadı.';
      } else {
        html += '<p class="asistan-sonuc-basi">Katalogda eşleşen <b>' + bulunan.length +
          '</b> ürün. Sıralama yalnızca metin benzerliğine göredir, bir öneri sırası değildir.</p>' +
          '<ul class="asistan-liste">' + bulunan.map(function (x) { return urunKarti(x.u); }).join('') + '</ul>' +
          '<p class="asistan-son-not">Bu ürünler ilaç değildir; hastalıkları önleme, tedavi etme ' +
          'veya iyileştirme amacıyla kullanılamaz. Kullandığınız ilaçlar ve mevcut ' +
          'hastalıklarınız için hekiminize ve eczacınıza danışın.</p>';
        durum.textContent = bulunan.length + ' sonuç bulundu.';
      }
      cikti.innerHTML = html;
      cikti.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch(function (e) {
      cikti.innerHTML = '<div class="asistan-bos"><b>Katalog yüklenemedi.</b>' +
        '<p>Bağlantınızı kontrol edip tekrar deneyin. Bu sırada doğrudan ' +
        '<a href="https://www.dogalmarkam.com/" target="_blank" rel="noopener">dogalmarkam.com</a> ' +
        'adresine bakabilirsiniz.</p></div>';
      durum.textContent = 'Hata: ' + e.message;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    calistir(alan.value);
  });

  /* hızlı başlangıç çipleri */
  if (cipKap) {
    cipKap.addEventListener('click', function (e) {
      var d = e.target.closest('button[data-ornek]');
      if (!d) return;
      alan.value = d.dataset.ornek;
      calistir(alan.value);
      alan.focus();
    });
  }

  /* Adresteki ?s= parametresi doldurup çalıştırır: paylaşılabilir arama
     bağlantısı sağlar ve sonucu yer imine eklemeyi mümkün kılar. */
  var ilk = new URLSearchParams(location.search).get('s');
  if (ilk) { alan.value = ilk.slice(0, 400); calistir(alan.value); }

  /* katalog boyutu küçük; sayfa boştayken sessizce önden yükle */
  if ('requestIdleCallback' in window) requestIdleCallback(katalogYukle);
  else setTimeout(katalogYukle, 1500);
})();

/*
 * scene.js — "Unsur Motoru"
 * ---------------------------------------------------------------------------
 * Three.js YOK. WebGL YOK. Harici kütüphane YOK.
 * Saf Canvas 2D üzerine elle yazılmış bir 3B parçacık sahnesi:
 *   - 3B nokta bulutu (dünya uzayı)
 *   - X/Y ekseni rotasyon matrisleri
 *   - perspektif bölme (fov / (fov + z))
 *   - derinliğe göre boyut + opaklık + additive (lighter) harmanlama
 *   - şekiller arası yumuşak "morph" (lerp) geçişleri
 *   - ön-render edilmiş glow sprite'ları (her kare radial-gradient yok)
 *
 * Şekiller geleneksel tıbbın dört unsuruna karşılık gelir:
 *   ateş → alev girdabı | hava → halka (torus) | su → dalga düzlemi
 *   toprak → kafes (lattice) | ayrıca: küre, sarmal
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- yardımcı */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* Deterministik sözde-rastgele: her yüklemede aynı kompozisyon çıksın diye. */
  function makeRandom(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* --------------------------------------------------------------- paletler */
  /* Her palet 3 katman: çekirdek (parlak), orta, sis. */
  var PALETTES = {
    kok:     ['#f6e7bb', '#d8b45f', '#7d6427'],   // nötr / altın — açılış
    ates:    ['#ffd9a8', '#ff7a2f', '#a12f0d'],   // safra
    hava:    ['#ffd4dc', '#e8506f', '#8d2440'],   // kan
    su:      ['#cdefff', '#3fa9e0', '#1a5e85'],   // balgam
    toprak:  ['#f0dcb4', '#c2a06b', '#6f5a34']    // sevda
  };

  /* ------------------------------------------------------------ şekil üreteci */
  var Shapes = {
    kure: function (n, R, rnd) {
      // Fibonacci küresi — homojen dağılım
      var pts = new Float32Array(n * 3);
      var golden = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < n; i++) {
        var y = 1 - (i / (n - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = golden * i;
        var jitter = 0.94 + rnd() * 0.12;
        pts[i * 3] = Math.cos(th) * r * R * jitter;
        pts[i * 3 + 1] = y * R * jitter;
        pts[i * 3 + 2] = Math.sin(th) * r * R * jitter;
      }
      return pts;
    },

    alev: function (n, R, rnd) {
      // Yukarı doğru incelen girdap — ateş
      var pts = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var t = Math.pow(rnd(), 0.65);            // tabana yığılma
        var y = -R * 1.05 + t * R * 2.15;
        var taper = Math.pow(1 - t, 0.85) * 0.95 + 0.05;
        var rad = R * 0.62 * taper * (0.35 + rnd() * 0.65);
        var a = rnd() * TAU + t * 2.4;            // burulma
        pts[i * 3] = Math.cos(a) * rad;
        pts[i * 3 + 1] = y;
        pts[i * 3 + 2] = Math.sin(a) * rad;
      }
      return pts;
    },

    halka: function (n, R, rnd) {
      // Torus — hava
      var pts = new Float32Array(n * 3);
      var majör = R * 0.86, minör = R * 0.26;
      for (var i = 0; i < n; i++) {
        var u = (i / n) * TAU * 1.0 + rnd() * 0.05;
        var v = rnd() * TAU;
        var rr = minör * (0.55 + rnd() * 0.45);
        var cx = (majör + rr * Math.cos(v));
        pts[i * 3] = Math.cos(u) * cx;
        pts[i * 3 + 1] = rr * Math.sin(v) * 1.15;
        pts[i * 3 + 2] = Math.sin(u) * cx;
      }
      return pts;
    },

    dalga: function (n, R, rnd) {
      // Sinüs düzlemi — su
      var pts = new Float32Array(n * 3);
      var side = Math.ceil(Math.sqrt(n));
      for (var i = 0; i < n; i++) {
        var gx = (i % side) / (side - 1) - 0.5;
        var gz = Math.floor(i / side) / (side - 1) - 0.5;
        var x = gx * R * 2.5 + (rnd() - 0.5) * R * 0.05;
        var z = gz * R * 2.5 + (rnd() - 0.5) * R * 0.05;
        var d = Math.sqrt(x * x + z * z) / R;
        pts[i * 3] = x;
        pts[i * 3 + 1] = Math.sin(d * 3.1) * R * 0.22 * Math.exp(-d * 0.45);
        pts[i * 3 + 2] = z;
      }
      return pts;
    },

    kafes: function (n, R, rnd) {
      // Küp kafesi — toprak
      var pts = new Float32Array(n * 3);
      var k = Math.max(2, Math.round(Math.cbrt(n)));
      for (var i = 0; i < n; i++) {
        var ix = i % k;
        var iy = Math.floor(i / k) % k;
        var iz = Math.floor(i / (k * k)) % k;
        var j = R * 0.055;
        pts[i * 3] = (ix / (k - 1) - 0.5) * R * 1.72 + (rnd() - 0.5) * j;
        pts[i * 3 + 1] = (iy / (k - 1) - 0.5) * R * 1.72 + (rnd() - 0.5) * j;
        pts[i * 3 + 2] = (iz / (k - 1) - 0.5) * R * 1.72 + (rnd() - 0.5) * j;
      }
      return pts;
    },

    sarmal: function (n, R, rnd) {
      // Çift sarmal — "yolculuk" bölümü
      var pts = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var strand = i % 3;                        // 0,1 = sarmal · 2 = basamak
        var a = t * TAU * 2.6;
        var y = (t - 0.5) * R * 2.6;
        if (strand === 2) {
          var m = rnd();                           // iki sarmal arası basamak
          var a2 = a + Math.PI;
          var x1 = Math.cos(a) * R * 0.5, z1 = Math.sin(a) * R * 0.5;
          var x2 = Math.cos(a2) * R * 0.5, z2 = Math.sin(a2) * R * 0.5;
          pts[i * 3] = lerp(x1, x2, m);
          pts[i * 3 + 1] = y;
          pts[i * 3 + 2] = lerp(z1, z2, m);
        } else {
          var ang = a + (strand ? Math.PI : 0);
          pts[i * 3] = Math.cos(ang) * R * 0.5;
          pts[i * 3 + 1] = y;
          pts[i * 3 + 2] = Math.sin(ang) * R * 0.5;
        }
      }
      return pts;
    },

    dagilim: function (n, R, rnd) {
      // Gevşek toz bulutu — kapanış
      var pts = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pts[i * 3] = (rnd() - 0.5) * R * 3.0;
        pts[i * 3 + 1] = (rnd() - 0.5) * R * 2.0;
        pts[i * 3 + 2] = (rnd() - 0.5) * R * 3.0;
      }
      return pts;
    }
  };

  /* Şekle özgü canlılık: genlik(x,y,z), hız, dönüş hızı, dikey sürüklenme */
  var HAREKET = {
    kure:    { amp: [0.030, 0.030, 0.030], hiz: 0.55, spin: 0.055, akis: 0 },
    alev:    { amp: [0.055, 0.110, 0.055], hiz: 1.85, spin: 0.130, akis: 0.16 },
    halka:   { amp: [0.045, 0.070, 0.045], hiz: 1.05, spin: 0.180, akis: 0 },
    dalga:   { amp: [0.020, 0.140, 0.020], hiz: 0.75, spin: 0.035, akis: 0 },
    kafes:   { amp: [0.018, 0.018, 0.018], hiz: 0.30, spin: 0.048, akis: 0 },
    sarmal:  { amp: [0.030, 0.020, 0.030], hiz: 0.60, spin: 0.115, akis: 0 },
    dagilim: { amp: [0.060, 0.060, 0.060], hiz: 0.40, spin: 0.030, akis: 0.04 }
  };

  /* ------------------------------------------------------------- glow sprite */
  function spriteYap(renk, boyut) {
    var c = document.createElement('canvas');
    c.width = c.height = boyut;
    var g = c.getContext('2d');
    var yari = boyut / 2;
    var grad = g.createRadialGradient(yari, yari, 0, yari, yari, yari);
    grad.addColorStop(0.00, renk);
    grad.addColorStop(0.28, renk);
    grad.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.globalAlpha = 1;
    g.fillStyle = grad;
    g.beginPath();
    g.arc(yari, yari, yari, 0, TAU);
    g.fill();
    return c;
  }

  function paletSpriteleri(renkler) {
    return [
      spriteYap(renkler[0], 40),
      spriteYap(renkler[1], 34),
      spriteYap(renkler[2], 28)
    ];
  }

  /* ================================================================== SAHNE */
  function Sahne(canvas, secenekler) {
    secenekler = secenekler || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);

    /* Mobilde sahne bir arka plan dokusudur, gösteri değil: parçacık sayısı
       ciddi biçimde düşer — hem pil hem de görsel sakinlik için. */
    var dar = global.matchMedia('(max-width: 820px)').matches;
    this.n = secenekler.sayi || (dar ? 420 : 1700);

    this.rnd = makeRandom(20231984);
    this.R = 1;                       // birim yarıçap; ekran ölçeği ayrı
    this.time = 0;
    this.raf = null;
    this.calisiyor = false;

    /* konum tamponları */
    this.cur = new Float32Array(this.n * 3);
    this.from = new Float32Array(this.n * 3);
    this.to = new Float32Array(this.n * 3);

    /* parçacık başına sabitler */
    this.katman = new Uint8Array(this.n);   // 0/1/2 → sprite katmanı
    this.tohum = new Float32Array(this.n);  // faz kayması
    this.olcek = new Float32Array(this.n);  // boyut çarpanı
    for (var i = 0; i < this.n; i++) {
      var r = this.rnd();
      this.katman[i] = r < 0.14 ? 0 : r < 0.55 ? 1 : 2;
      this.tohum[i] = this.rnd() * TAU;
      this.olcek[i] = 0.55 + this.rnd() * 0.85;
    }

    /* şekil önbelleği */
    this.sekiller = {};
    this.sekilAdi = secenekler.sekil || 'kure';
    this.hedefSekil = this.sekilAdi;
    this.morphT = 1;
    this.morphSure = 1.25;

    var ilk = this.sekilAl(this.sekilAdi);
    this.cur.set(ilk); this.from.set(ilk); this.to.set(ilk);

    /* palet & sprite önbelleği */
    this.spriteler = {};
    for (var ad in PALETTES) this.spriteler[ad] = paletSpriteleri(PALETTES[ad]);
    this.paletAdi = secenekler.palet || 'kok';
    this.oncekiPalet = this.paletAdi;
    this.paletT = 1;
    this.paletSure = 0.9;

    /* kamera */
    this.rotX = -0.22; this.rotY = 0.4;
    this.hedefRotX = -0.22; this.hedefRotY = 0.4;
    this.fov = 3.1;
    this.zoom = 1;
    this.hedefZoom = 1;
    this.yogunluk = 1;
    this.hedefYogunluk = 1;
    this.merkezX = 0.5;          // sahnenin yatay merkezi (0..1)
    this.hedefMerkezX = 0.5;
    this.imlec = { x: 0, y: 0 };

    this.olcekle();
    this._resize = this.olcekle.bind(this);
    global.addEventListener('resize', this._resize, { passive: true });
  }

  Sahne.prototype.sekilAl = function (ad) {
    if (!this.sekiller[ad]) {
      var uretici = Shapes[ad] || Shapes.kure;
      this.sekiller[ad] = uretici(this.n, this.R, makeRandom(9176 + ad.length * 733));
    }
    return this.sekiller[ad];
  };

  Sahne.prototype.olcekle = function () {
    var c = this.canvas;
    var w = c.clientWidth || global.innerWidth;
    var h = c.clientHeight || global.innerHeight;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    this.w = w; this.h = h;
    this.cx = w / 2; this.cy = h / 2;
    this.ekranOlcek = Math.min(w, h) * (w < 820 ? 0.42 : 0.36);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  /* ------------------------------------------------------------- genel API */
  Sahne.prototype.sekilAyarla = function (ad) {
    if (!Shapes[ad] || ad === this.hedefSekil) return;
    this.from.set(this.cur);
    this.to.set(this.sekilAl(ad));
    this.hedefSekil = ad;
    this.morphT = 0;
  };

  Sahne.prototype.paletAyarla = function (ad) {
    if (!PALETTES[ad] || ad === this.paletAdi) return;
    this.oncekiPalet = this.paletAdi;
    this.paletAdi = ad;
    this.paletT = 0;
  };

  Sahne.prototype.kameraAyarla = function (opt) {
    if (opt.zoom != null) this.hedefZoom = opt.zoom;
    if (opt.yogunluk != null) this.hedefYogunluk = opt.yogunluk;
    if (opt.egim != null) this.temelRotX = opt.egim;
    if (opt.merkez != null) this.hedefMerkezX = opt.merkez;
  };

  Sahne.prototype.imlecAyarla = function (nx, ny) {
    this.imlec.x = clamp(nx, -1, 1);
    this.imlec.y = clamp(ny, -1, 1);
  };

  Sahne.prototype.basla = function () {
    if (this.calisiyor) return;
    this.calisiyor = true;
    var self = this, son = performance.now();
    function kare(t) {
      if (!self.calisiyor) return;
      var dt = Math.min((t - son) / 1000, 0.05);
      son = t;
      self.guncelle(dt);
      self.ciz();
      self.raf = global.requestAnimationFrame(kare);
    }
    this.raf = global.requestAnimationFrame(kare);
  };

  Sahne.prototype.dur = function () {
    this.calisiyor = false;
    if (this.raf) global.cancelAnimationFrame(this.raf);
    this.raf = null;
  };

  /* ------------------------------------------------------------- döngü */
  Sahne.prototype.guncelle = function (dt) {
    this.time += dt;

    /* morph ilerlemesi */
    if (this.morphT < 1) {
      this.morphT = Math.min(1, this.morphT + dt / this.morphSure);
      var e = easeOutCubic(this.morphT);
      var cur = this.cur, from = this.from, to = this.to;
      for (var i = 0, L = cur.length; i < L; i++) {
        cur[i] = from[i] + (to[i] - from[i]) * e;
      }
      if (this.morphT >= 1) this.sekilAdi = this.hedefSekil;
    }

    if (this.paletT < 1) this.paletT = Math.min(1, this.paletT + dt / this.paletSure);

    /* kamera yumuşatma */
    this.hedefRotX = (this.temelRotX != null ? this.temelRotX : -0.18) + this.imlec.y * 0.34;
    this.rotX = lerp(this.rotX, this.hedefRotX, 1 - Math.pow(0.001, dt));
    this.zoom = lerp(this.zoom, this.hedefZoom, 1 - Math.pow(0.004, dt));
    this.yogunluk = lerp(this.yogunluk, this.hedefYogunluk, 1 - Math.pow(0.01, dt));
    this.merkezX = lerp(this.merkezX, this.hedefMerkezX, 1 - Math.pow(0.004, dt));

    var hareket = HAREKET[this.hedefSekil] || HAREKET.kure;
    var yavas = this.w < 820 ? 0.5 : 1;          // mobilde daha ağır dönüş
    this.rotY += (hareket.spin * yavas + this.imlec.x * 0.22) * dt;
  };

  Sahne.prototype.ciz = function () {
    var ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    if (this.yogunluk < 0.02) return;

    var hareket = HAREKET[this.hedefSekil] || HAREKET.kure;
    var t = this.time * hareket.hiz * (w < 820 ? 0.6 : 1);
    var ax = hareket.amp[0], ay = hareket.amp[1], az = hareket.amp[2];

    var cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
    var cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);

    var S = this.ekranOlcek * this.zoom;
    var fov = this.fov;
    /* Dar ekranlarda merkez kaydırması metni bozar; orada hep ortada kalsın. */
    var cx = w < 980 ? this.cx : w * this.merkezX;
    var cy = this.cy;

    /* Dar ekranda içerik ortada durduğu için sahne metnin üstüne biniyor;
       yoğunluğu bir tık kısarak okunurluğu koruyoruz. */
    var ekranKatsayi = w < 820 ? 0.42 : 1;

    var yeni = this.spriteler[this.paletAdi];
    var eski = this.spriteler[this.oncekiPalet];
    var pt = easeOutCubic(this.paletT);

    ctx.globalCompositeOperation = 'lighter';

    var cur = this.cur, tohum = this.tohum, katman = this.katman, olcek = this.olcek;

    for (var i = 0, p = 0; i < this.n; i++, p += 3) {
      var sd = tohum[i];

      /* --- canlılık: yerel salınım (her parçacık kendi fazında) --- */
      var x = cur[p]     + Math.sin(t + sd) * ax;
      var y = cur[p + 1] + Math.sin(t * 1.31 + sd * 1.7) * ay;
      var z = cur[p + 2] + Math.cos(t * 0.87 + sd * 2.3) * az;

      /* Alev/toz için yukarı sürüklenme. Testere dişi bir faz kullanıp
         opaklığı sin(faz·π) ile çarpıyoruz: parçacık altta belirip yukarıda
         sönüyor, böylece geri sarmada "sıçrama" görünmüyor. */
      var akisAlfa = 1;
      if (hareket.akis) {
        var faz = (t * hareket.akis + sd * 0.159) % 1;
        y += faz * 0.55 - 0.16;
        akisAlfa = Math.sin(faz * Math.PI);
      }

      /* --- 3B döndürme: önce Y ekseni, sonra X ekseni --- */
      var x1 = x * cosY + z * sinY;
      var z1 = z * cosY - x * sinY;
      var y2 = y * cosX - z1 * sinX;
      var z2 = z1 * cosX + y * sinX;

      /* --- perspektif bölme --- */
      var d = fov + z2;
      if (d < 0.35) continue;                       // kameranın arkası
      var k = fov / d;

      var sx = cx + x1 * k * S;
      var sy = cy - y2 * k * S;
      if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

      /* derinlik → boyut & opaklık */
      var boyut = olcek[i] * k * (this.w < 820 ? 7.5 : 9.5);
      var derinlik = clamp((k - 0.42) / 1.05, 0, 1);
      var alfa = (0.10 + derinlik * 0.90) * this.yogunluk * akisAlfa * ekranKatsayi;
      if (alfa <= 0.004) continue;

      var kat = katman[i];

      if (pt < 1) {
        ctx.globalAlpha = alfa * (1 - pt);
        var se = eski[kat];
        ctx.drawImage(se, sx - boyut / 2, sy - boyut / 2, boyut, boyut);
        ctx.globalAlpha = alfa * pt;
      } else {
        ctx.globalAlpha = alfa;
      }
      var sy2 = yeni[kat];
      ctx.drawImage(sy2, sx - boyut / 2, sy - boyut / 2, boyut, boyut);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  /* Hareket azaltma tercihinde: tek kare, donuk kompozisyon. */
  Sahne.prototype.tekKare = function () {
    this.guncelle(0);
    this.ciz();
  };

  Sahne.prototype.yokEt = function () {
    this.dur();
    global.removeEventListener('resize', this._resize);
  };

  global.UnsurSahnesi = Sahne;
  global.UnsurPaletleri = PALETTES;
})(window);

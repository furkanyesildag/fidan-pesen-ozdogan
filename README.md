# Dr. Ecz. Fidan Pesen Özdoğan — Biyografi Sitesi

Tek sayfalık, görsel ağırlıklı bir özgeçmiş/biyografi sitesi.
**Hiçbir harici kütüphane yok** — Three.js yok, WebGL yok, framework yok, CDN yok.
Sadece HTML + CSS + vanilla JS.

**Canlı:** https://fidan-pesen-ozdogan.vercel.app
**Kaynak:** https://github.com/furkanyesildag/fidan-pesen-ozdogan

## Çalıştırma

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

`index.html` dosyasını doğrudan çift tıklayarak da açabilirsiniz (dosya
yolları göreli, `file://` üzerinden de çalışır).

## Dosya yapısı

```
index.html                 — tüm içerik ve bölümler
assets/css/style.css       — tasarım sistemi, düzen, animasyonlar
assets/js/scene.js         — "Unsur Motoru": Canvas 2D üzerinde 3B parçacık sahnesi
assets/js/main.js          — scroll orkestrasyonu, mizaç etkileşimi, tilt, parallaks, menü
assets/img/                — görseller (aşağıya bakın)
```

## Görseller

Hepsi Doğal Markam'ın kendi sitesinden (dogalmarkam.com) alındı — yani markanın
kendi arşivi. Kullanıldıkları yerler:

| Dosya | Nerede |
|---|---|
| `fidan-portre.webp` | Açılış — kemerli portre çerçevesi, parçacık küresi arkasında hâle yapıyor |
| `fidan-portre-acik.jpg` | İletişim bölümündeki künye kartı |
| `atolye.webp` | Kronoloji sonrası tam genişlik parallakslı bant |
| `dogalmarkam-logo.jpg` | Doğal Markam bölümü, beyaz kart üzerinde |

Değiştirmek isterseniz aynı isimle üzerine yazmak yeterli; boyut/oran CSS'te
`object-fit: cover` ile yönetiliyor. Portrenin kadrajı
[style.css](assets/css/style.css) içindeki `.portre-kemer img { object-position }`
değeriyle ayarlanır.

## 3B sahne nasıl çalışıyor (Three.js olmadan)

`assets/js/scene.js` içinde küçük bir 3B boru hattı elle yazıldı:

1. **Nokta bulutu** — 1700 parçacık (mobilde 700), `Float32Array` içinde x/y/z.
2. **Şekil üreteçleri** — `kure` (Fibonacci küresi), `alev` (girdap konisi),
   `halka` (torus), `dalga` (sinüs düzlemi), `kafes` (küp ızgarası),
   `sarmal` (çift sarmal), `dagilim` (toz bulutu).
3. **Morph** — şekil değişiminde `from → to` arası `easeOutCubic` ile lerp.
4. **Rotasyon** — Y ve X eksenleri için elle yazılmış sinüs/kosinüs dönüşümü.
5. **Perspektif projeksiyon** — `k = fov / (fov + z)`; ekran konumu, boyut ve
   opaklık bu `k` katsayısından türetiliyor.
6. **Render** — derinlik sıralaması yerine `globalCompositeOperation = 'lighter'`
   (additive blending; sıra önemsiz, dolayısıyla kare başına sort maliyeti yok).
   Parçacıklar önceden üretilmiş radial-gradient sprite'ları olarak çiziliyor —
   kare başına gradient üretilmiyor.
7. **Palet geçişi** — iki sprite seti çapraz solduruluyor (0.9 sn).

### Sahneyi bölüme bağlama

Her `<section class="bolum">` üzerindeki `data-*` öznitelikleri sahneyi sürüyor:

| Öznitelik | Anlamı |
|---|---|
| `data-sekil` | `kure` · `alev` · `halka` · `dalga` · `kafes` · `sarmal` · `dagilim` |
| `data-palet` | `kok` (altın) · `ates` · `hava` · `su` · `toprak` |
| `data-zoom` | kamera yakınlığı (1 = varsayılan) |
| `data-yogunluk` | sahne opaklığı — metin yoğun bölümlerde düşürülür |
| `data-merkez` | sahnenin yatay merkezi (0–1). Açılışta `0.72` — küre portrenin arkasına oturup hâle yapsın diye. 980px altında yok sayılır. |

Yeni bir bölüm eklerken bunları vermek yeterli; `main.js` gerisini yapar.

Sahneyi süren tek bir sözleşme var: **`data-unsur` + `data-sekil` taşıyan her
öğe** (mizaç kartı, keyfiyet kadranı) sahneyi değiştirebilir. Karta tıklanınca
palet o unsura **kilitlenir** ve tüm sayfanın aksan rengi
(`--aksan`, `--aksan-rgb`) değişir.

## Bağlantılar

Sitede geçen tüm resmî kanallar — üç yerde birden (sol sabit şerit, İletişim
bölümü, altlık):

- Site: [dogalmarkam.com](https://www.dogalmarkam.com/)
- Instagram: [@fidanpesen](https://www.instagram.com/fidanpesen/) · [@dogalmarkambor](https://www.instagram.com/dogalmarkambor/)
- YouTube: [@fidanpesen](https://www.youtube.com/@fidanpesen)
- X: [@PesenFidan](https://x.com/pesenfidan)
- Facebook: [Doğal Markam](https://www.facebook.com/dogalmarkambor/)
- LinkedIn: [Fidan Pesen Özdoğan](https://tr.linkedin.com/in/fidan-pesen-ozdogan-a4392b125)
- WhatsApp: [+90 533 632 03 13](https://wa.me/905336320313)
- Telefon: +90 312 911 03 36 · E-posta: iletisim@dogalmarkam.com
- Adres: Cevizlidere Mah. Mevlâna Bulvarı, Çankaya / Ankara
- Tüzel kişilik: GETAT Geleneksel ve Tamamlayıcı Tıp Araştırmaları Merkezi
  Bitkisel İlaç San. Ltd. Şti.

İletişim bilgileri [dogalmarkam.com/iletisim](https://www.dogalmarkam.com/iletisim)
sayfasından alındı — değişirse tek yerden değil, `index.html` içinde üç yerden
güncellenmesi gerekir (şerit, `#iletisim`, altlık).

## Erişilebilirlik & performans

- `prefers-reduced-motion: reduce` → animasyon döngüsü çalışmaz, tek kare çizilir.
- Mobil (≤820px): parçacık sayısı 1700→700, sprite boyutu ve sahne yoğunluğu
  düşer, sahnenin yatay merkez kaydırması devre dışı kalır.
- Sekme arka plana düşünce `requestAnimationFrame` döngüsü durur.
- Dokunmatik cihazlarda hover/tilt etkileşimleri devre dışı; kartlar tıklanabilir.
- Mizaç kartları klavye ile gezilebilir (`tabindex`, Enter/Space).
- DPR 2 ile sınırlı; mobilde parçacık sayısı ve sprite boyutu düşürülür.

## İçerik kaynakları

Sitedeki biyografik bilgiler kamuya açık kaynaklardan derlendi:

- [dogalmarkam.com — "Dr. Ecz. Fidan PESEN ÖZDOĞAN kimdir?"](https://www.dogalmarkam.com/neden-biz)
- [dogalmarkam.com — Hakkımızda / marka değerleri, ürün aileleri](https://www.dogalmarkam.com/hakkimizda)
- [mizaclar.com — Uzman Eczacı Fidan Pesen Özdoğan](https://www.mizaclar.com/fidan-pesen-ozdogan/)
- [mizaclar.com — Mizaca göre beslenme](https://www.mizaclar.com/mizaca-gore-beslenme-fidan-pesen-acikliyor/)
- [Kitapstore — "Geleneksel Tıbbın Temel Kaideleri"](https://www.kitapstore.com/urun/383857/kitap/geleneksel-tip-dernegi-yayinlari/fidan-pesen-ozdogan/geleneksel-tibbin-temel-kaideleri/)
- [Instagram @fidanpesen](https://www.instagram.com/fidanpesen/) · [@dogalmarkambor](https://www.instagram.com/dogalmarkambor/)
- [YouTube — Dr. Ecz. Fidan Pesen Özdoğan](https://www.youtube.com/@fidanpesen)
- [TRT 1 — Alişan ile Hayata Gülümse konuk videoları](https://www.youtube.com/watch?v=2MnlY56bUrI)

### Doğrulanması gerekenler

Yayına almadan önce sahibiyle teyit edilmesi iyi olur:

- Doktoranın verildiği kurum (bazı kaynaklarda İstanbul Sağlık Bilimleri
  Üniversitesi geçiyor; kendi sitesinde kurum adı belirtilmemiş) — şu an
  sitede kurum adı yazmıyor, sadece yıl ve unvan var.
- Yüksek lisans yılı: kendi sitesinde 2012, bazı derlemelerde 2011.
- Kitabın baskı yılı/yayınevi künyesi.
- Sosyal medya takipçi sayıları (sitede sayı verilmedi, "milyonu aşan" ifadesi
  kullanıldı).
- Görsellerin kullanım izni: dosyalar Doğal Markam'ın kendi sitesinden alındı,
  yani hak sahibi kendisi. Yine de yayına almadan önce onayı alınmalı.

## Yayın

Vercel projesi GitHub deposuna bağlı: **`main`'e her push otomatik olarak
production'a çıkar.** Elle yayınlamak isterseniz:

```bash
vercel deploy --prod --scope furkanyesildags-projects
```

`vercel.json` içinde `/assets/*` için bir yıllık immutable önbellek ve temel
güvenlik başlıkları (`X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`) tanımlı. Build adımı yok — tamamen statik.

Kendi alan adını bağlamak için: Vercel panelinde proje → Settings → Domains,
ya da `vercel domains add <alanadi> --scope furkanyesildags-projects`.

## Yasal not

Sitede hiçbir yerde tıbbi tavsiye verilmiyor; geleneksel tıp anlatımı kültürel/
tarihî bilgi olarak sunuluyor ve hem mizaç bölümünde hem site altlığında
açık bir sorumluluk reddi bulunuyor. Ürün bölümü ürün *aileleri* düzeyinde
kalıyor; sağlık iddiası içermiyor.

# Dr. Ecz. Fidan Pesen Özdoğan — Biyografi Sitesi

Tek sayfalık, görsel ağırlıklı bir özgeçmiş/biyografi sitesi.
**Hiçbir harici kütüphane yok** — Three.js yok, WebGL yok, framework yok, CDN yok.
Sadece HTML + CSS + vanilla JS.

**Canlı:** https://fidanpesen.com
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
index.html                 — özgeçmiş ana sayfası
fitoterapi/index.html      — rehber: Fitoterapi Nedir?
cilt-bakimi/index.html     — rehber: Doğal Cilt Bakımı
gida-takviyeleri/index.html— rehber: Bitkisel Gıda Takviyeleri
geleneksel-tip/index.html  — rehber: GETAT ve Mizaç
sss/index.html             — Sık Sorulan Sorular
robots.txt · sitemap.xml · llms.txt
assets/css/style.css       — tasarım sistemi, düzen, animasyonlar
assets/css/makale.css      — rehber sayfalarının makale düzeni
assets/js/scene.js         — "Unsur Motoru": Canvas 2D üzerinde 3B parçacık sahnesi
assets/js/main.js          — ana sayfa: scroll orkestrasyonu, mizaç etkileşimi, tilt
assets/js/sayfa.js         — rehber sayfaları: menü + içindekiler vurgusu
assets/img/                — görseller (aşağıya bakın)
```

Rehber sayfalarında canvas sahnesi **yoktur**; bu sayfalarda sayfa hızı ve
okunabilirlik önceliklidir. Ana sayfa ile ortak tasarım jetonlarını
`style.css` üzerinden paylaşırlar.

## Görseller

Hepsi Doğal Markam'ın kendi sitesinden (dogalmarkam.com) alındı — yani markanın
kendi arşivi. Kullanıldıkları yerler:

| Dosya | Nerede |
|---|---|
| `portre-atolye.jpg` | Açılış: kemerli portre çerçevesi, parçacık küresi arkasında hâle yapıyor |
| `portre-kirmizi.jpg` | İletişim künye kartı, rehber sayfalarındaki yazar kartı ve künye satırı |
| `saha-cicek.jpg` · `saha-dag.jpg` · `saha-selale.jpg` | Kaynaklar bölümündeki saha şeridi |
| `atolye.webp` | Kronoloji sonrası tam genişlik parallakslı bant |
| `dogalmarkam-logo.jpg` | Doğal Markam bölümü, beyaz kart üzerinde |

Portre ve saha fotoğrafları Dr. Ecz. Fidan Pesen Özdoğan'ın kendi arşivinden;
`atolye.webp` ve logo Doğal Markam sitesinden alındı.

Değiştirmek isterseniz aynı isimle üzerine yazmak yeterli; boyut/oran CSS'te
`object-fit: cover` ile yönetiliyor. Portrenin kadrajı
[style.css](assets/css/style.css) içindeki `.portre-kemer img { object-position }`
değeriyle ayarlanır.

## 3B sahne nasıl çalışıyor (Three.js olmadan)

`assets/js/scene.js` içinde küçük bir 3B boru hattı elle yazıldı:

1. **Nokta bulutu** — 1700 parçacık (mobilde 420), `Float32Array` içinde x/y/z.
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

### Yatay galeriler

Saha fotoğrafları ve konu rehberleri `.yatay-galeri` sınıfını paylaşır:
`grid-auto-flow: column` + `scroll-snap-type: x proximity` ile kaydırılabilir
bir şerit olur. Kenarda bir sonraki kartın ucu bilerek görünür bırakılır ki
kaydırılabildiği anlaşılsın; dar ekranda üstünde "Kaydırın" ipucu belirir.
Kart genişliği `grid-auto-columns` ile ayarlanır (masaüstü sabit, mobilde
yüzde). Alt alta yığmak yerine bu tercih edildi.

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

## Mobil katmanı

Masaüstü ve mobil kasıtlı olarak **farklı yoğunlukta**. Küçük ekranda aynı anda
çalışan efekt sayısı yorucu olduğu için `style.css` sonundaki
`@media (max-width: 820px)` bloğu tek elden şunları yapar:

- **Sahne geri çekilir** — parçacık sayısı 1700→420, opaklık %42'ye iner,
  dönüş ve iç hareket yarı hıza düşer, film greni tamamen kapanır, vinyet
  güçlenir. Sahne bir gösteri değil, arka plan dokusu olur.
- **Sürekli hareket durur** — portredeki dönen ışık halkası ve scroll parallaksı
  mobilde çalışmaz.
- **Cam efektleri kalkar** — bütün kartlarda `backdrop-filter` kapanır, yerine
  düz `#0a1610` yüzey gelir. Parıltı katmanları ve gölgeler kaldırılır.
  Hem görsel gürültü hem GPU maliyeti düşer.
- **Ritim değişir** — bölüm boşlukları artar, kart içleri sıkışır, giriş
  animasyonunun yolu ve gecikme kuyruğu kısalır.
- **Kartlar yan yana gelir** — mizaçlar, akademi kartları ve ürün aileleri
  2 sütuna geçer. Dört mizaç tek bakışta karşılaştırılır, toplam kaydırma
  yarıya iner. Ürün alt kategori çipleri gizlenir (tam liste zaten markanın
  sitesinde), dokunma hedefleri 44px'e çıkar.

### Mobilde "kendi kendine zoom" sorunu

Mobil tarayıcılarda adres çubuğu kaydırmayla açılıp kapandığı için viewport
yüksekliği sürekli değişir. Sahne buna her seferinde yeniden ölçeklendiğinde
sayfa kendi kendine yakınlaşıyormuş gibi görünüyordu. Üç katmanlı çözüm:

1. `.sahne-katman` yüksekliği `100lvh` ile sabitlendi — katman artık adres
   çubuğuyla birlikte boyutlanmıyor.
2. `Sahne.olcekle()` boyut gerçekten değişmediyse erken çıkıyor; dar ekranda
   parçacık ölçeği yalnızca **genişlikten** türetiliyor, yükseklikten değil.
3. `kameraAyarla()` dar ekranda `data-zoom` ve `data-merkez` değerlerini yok
   sayıyor — bölümler arası kamera yakınlaşması mobilde hiç çalışmıyor.

Ayrıca `body { touch-action: manipulation }` ile çift dokunuşta tarayıcının
kendi yakınlaştırması engellendi (parmakla yakınlaştırma çalışmaya devam eder).

Mobil davranışı değiştirmek isterseniz tek yer var: o blok. Masaüstü kurallarına
dokunmadan çalışır.

## Erişilebilirlik & performans

- `prefers-reduced-motion: reduce` → animasyon döngüsü çalışmaz, tek kare çizilir.
- Mobil (≤820px): yukarıdaki mobil katmanı. Sahnenin yatay merkez kaydırması
  da devre dışı kalır.
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
- [Instagram @fidanpesen](https://www.instagram.com/fidanpesen/) · [@dogalmarkambor](https://www.instagram.com/dogalmarkambor/)
- [YouTube — Dr. Ecz. Fidan Pesen Özdoğan](https://www.youtube.com/@fidanpesen)
- [TRT 1 — Alişan ile Hayata Gülümse konuk videoları](https://www.youtube.com/watch?v=2MnlY56bUrI)

### Doğrulanması gerekenler

Yayına almadan önce sahibiyle teyit edilmesi iyi olur:

- Doktoranın verildiği kurum (bazı kaynaklarda İstanbul Sağlık Bilimleri
  Üniversitesi geçiyor; kendi sitesinde kurum adı belirtilmemiş) — sitede
  kurum adı ve tarih yazmıyor, sadece unvan var.
- Yüksek lisans yılı: kendi sitesinde 2012, bazı derlemelerde 2011.
- Sosyal medya takipçi sayıları (sitede sayı verilmedi, "milyonu aşan" ifadesi
  kullanıldı).
- Görsellerin kullanım izni: dosyalar Doğal Markam'ın kendi sitesinden alındı,
  yani hak sahibi kendisi. Yine de yayına almadan önce onayı alınmalı.

## Fidan'ın Asistanı (`/asistan`)

DeepSeek üzerinde çalışan, Doğal Markam kataloğuna bağlı bir sohbet asistanı.

### Mimari

```
tarayıcı  ──POST /api/sohbet──▶  Vercel Function
                                   ├─ katalogdan en alakalı 10 ürünü seç
                                   ├─ sistem istemini kur
                                   ├─ DeepSeek'e sor (stream)
                                   └─ SSE ile geri akıt + konuşmayı kaydet
```

| Dosya | İş |
|---|---|
| `api/sohbet.js` | Uç nokta. Hız sınırı, güvenlik taraması, akış, ürün kartı çıkarımı. |
| `api/_istem.mjs` | Sistem istemi, niyet sözlüğü, ürün getirme, acil/dikkat listeleri. |
| `api/_urunler.mjs` | Tam açıklamalı katalog. **Yalnızca sunucu.** |
| `api/_kayit.mjs` | Konuşma kaydı. |
| `assets/js/asistan.js` | Sohbet arayüzü, SSE okuyucu, ürün kartları. |

`api/` altında **alt çizgiyle başlayan dosyalar uç nokta olarak yayınlanmaz**;
dışarıdan istendiğinde 404 döner. Ürün açıklamaları bu yüzden oraya konuldu.

### API anahtarı

Anahtar **depoda yoktur ve tarayıcıya gitmez.** Yalnızca Vercel ortam
değişkeninde durur:

```bash
vercel env add DEEPSEEK_API_KEY production
```

Tarayıcıdan doğrudan DeepSeek'e istek atılsaydı anahtar sayfanın kaynağında
herkese görünür olur, bakiye dakikalar içinde boşaltılabilirdi. Sunucusuz
fonksiyon tam olarak bunu engellemek için var.

İsteğe bağlı: `DEEPSEEK_MODEL` (varsayılan `deepseek-chat`).

### Asistanın sınırları

Sistem istemi (`api/_istem.mjs`) şunları **zorunlu** kılar:

- Kendini Fidan Hanım olarak tanıtmaz. Doğrudan sorulursa "onun asistanıyım" der.
- Yalnızca katalogdaki ürünleri önerir; rakip marka, eczane ilacı, jenerik
  takviye önermez. Katalogda yoksa açıkça söyler.
- Teşhis koymaz, "tedavi eder / iyileştirir / geçirir" demez, hekimin verdiği
  ilacı bırakmayı önermez.
- Yapay aciliyet ve baskı yasaktır ("stoklar bitiyor" gibi).
- Önce anlamak için soru sorar, ürünü ancak yeterli bilgi toplayınca önerir.
- Destek bilgisi olarak gerçek WhatsApp hattı ve gerçek çalışma saatleri verilir.

Kod tarafındaki iki katman istemden bağımsız çalışır:

| Durum | Davranış |
|---|---|
| Acil belirti | Modele hiç gidilmez. Sabit 112 yanıtı döner, ürün gösterilmez. |
| Gebelik, emzirme, bebek, onkoloji, organ yetmezliği, düzenli ilaç, ameliyat, diyabet | Sisteme uyarı enjekte edilir; cevap hekim/eczacı uyarısıyla başlar. |

Listeleri genişletmek için `ACIL` ve `DIKKAT` dizilerine satır eklemek yeterli.

### Ürün kartları

Model, ürün önerdiğinde mesajın sonuna `ÜRÜN: <tam ad>` satırları yazar.
Sunucu bu adları katalogla eşleştirip kart verisi üretir, istemci satırları
metinden ayıklar ve kartı çizer. Böylece model serbest metin yazarken arayüz
yapılandırılmış veri alır.

### Konuşma kaydı

`api/_kayit.mjs` üç hedefi destekler; hangisi tanımlıysa oraya yazar:

1. **Vercel KV / Upstash** — `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
   Konuşmalar `sohbet:kayit` listesine eklenir. Vercel panelinde
   Storage → Create → KV ile 2 dakikada bağlanır.
2. **Webhook** — `SOHBET_WEBHOOK`. Konuşma JSON olarak POST edilir
   (Google Apps Script, Make, Zapier veya kendi sunucunuz).
3. **Çalışma zamanı günlüğü** — her zaman yazılır, ama Hobby planında
   kalıcı değildir. Tek başına yeterli sayılmamalı.

**Şu an 1 ve 2 tanımlı değil**, yani kayıtlar kalıcı tutulmuyor. Kalıcı kayıt
için yukarıdaki iki seçenekten biri kurulmalı.

KVKK: sayfada kayıt tutulduğu açıkça yazar ve kullanıcıdan kimlik/iletişim
bilgisi paylaşmaması istenir. IP adresi ham hâlde saklanmaz; yalnızca tekrar
eden ziyaretçiyi ayırt etmeye yarayan tek yönlü bir özet (`KAYIT_TUZU` ile
tuzlanmış SHA-256'nın ilk 12 karakteri) tutulur.

### Katalog

```bash
node tools/urunleri-guncelle.mjs
```

169 ürün, 30 kategori. İki dosya üretir: `data/urunler.json` (herkese açık,
açıklamasız) ve `api/_urunler.mjs` (sunucu, tam açıklamalı). Yeni ürün
eklendiğinde bu komutu çalıştırıp commit'lemek yeterli.

## Video entegrasyonu

`/videolar` sayfası, YouTube kanalının **resmî RSS beslemesinden** üretilir:

```bash
node tools/videolari-guncelle.mjs
```

Betiğin bağımlılığı yoktur (Node 18+ yeterli). İki kaynaktan besleniyor:

| Kaynak | Ne verir | Güvenilirlik |
|---|---|---|
| Resmî RSS beslemesi | Son 15 video: başlık, **kesin tarih**, açıklama, **kesin görüntülenme** | Yüksek, belgelenmiş uç nokta |
| Kanalın `/shorts` sekmesi | ~48 Shorts: kimlik, başlık, yaklaşık görüntülenme | Düşük, YouTube'un iç JSON'u |

Shorts sekmesi bir **zenginleştirmedir**: okunamazsa hata verilmez, uyarı
basılıp yalnızca RSS ile devam edilir. Sonra:

1. İki kaynak `data/videolar.json` arşiviyle **birleştirilir** (önce Shorts,
   sonra RSS yazılır ki kesin veri üste gelsin). Eski kayıtlar silinmez.
2. Tarihi olmayan videoların yayın tarihi, **yalnızca ilk keşifte** kendi
   sayfalarından bir kez çekilir ve arşive yazılır; sonraki çalıştırmalarda
   tekrar istenmez.
3. `videolar/index.html` yeniden üretilir: kart ızgarası, `ItemList` +
   `VideoObject` yapısal verisi. `InteractionCounter` yalnızca RSS'ten gelen
   **kesin** sayılar için yazılır; Shorts sekmesinin yuvarlanmış değerleri
   ("140 B görüntüleme") sadece ekranda gösterilir.

Şu an arşivde **53 video** var, bunların **48'i Shorts**.

`.github/workflows/videolari-guncelle.yml` bunu **her pazartesi** otomatik
çalıştırır ve değişiklik varsa commit eder; Vercel depoyu izlediği için sayfa
kendiliğinden yayına çıkar. Elle tetiklemek için GitHub'da Actions sekmesinden
"Run workflow" yeterlidir.

### Sayfanın teknik tercihleri

- **Facade deseni:** tıklanana kadar YouTube'dan hiçbir iframe veya script
  yüklenmez. Kapak görseli `i.ytimg.com` üzerinden gelir; oynatıcı yalnızca
  tıklamada, `youtube-nocookie.com` üzerinden eklenir.
- **Küçük resim:** `hqdefault.jpg` (~13 KB) kullanılır. Shorts için orijinal
  oranlı `oardefault.jpg` da var ama ~200 KB olduğu için sayfa hızı adına
  tercih edilmedi; bunun yerine Shorts kartları 3:4 orana alınıp görsel bir
  miktar yakınlaştırılarak yandaki dolgu kadraj dışında bırakıldı.
- **Başlıklar:** hashtag kuyruğu başlıktan ayrılıp etiket çipine dönüştürülür;
  ham başlık `data/videolar.json` içinde saklanır.

### Instagram hakkında

Instagram'da otomatik entegrasyon **mümkün değil**: herkese açık bir gönderi
listeleme API'si yok ve kazıma hem engelleniyor hem kullanım şartlarına aykırı.
Şu an sayfada profillere yönlendiren bloklar var. İki seçenek mevcut:

1. Belirli gönderilerin bağlantılarını verirseniz, Meta'nın resmî gömme
   yöntemiyle (`instagram.com/embed.js`) sayfaya yerleştirilebilir. Bu, siteye
   üçüncü taraf JavaScript ekler.
2. Ekran görüntüsü ya da görsel verilirse, YouTube kartlarındakine benzer
   statik kartlar hazırlanabilir; üçüncü taraf kod gerekmez.

## GEO / SEO altyapısı

Amaç, hem klasik arama motorlarında hem de yapay zekâ cevap motorlarında
(ChatGPT, Perplexity, Google AI Overviews, Claude) **Fidan Pesen Özdoğan** ve
**Doğal Markam** varlıklarının doğru tanınması ve alıntılanabilmesi.

### Varlık (entity) tanımı

Her sayfada `schema.org` JSON-LD `@graph` bulunur. Grafın omurgası sabit
`@id`'lerle birbirine bağlanmış üç düğümdür:

| Düğüm | `@id` | Rolü |
|---|---|---|
| `Person` | `/#fidan-pesen-ozdogan` | Kişi varlığı: unvanlar, `alumniOf`, `hasCredential`, `knowsAbout`, `knowsLanguage`, `sameAs` |
| `Organization` + `HealthAndBeautyBusiness` | `dogalmarkam.com/#organization` | Marka varlığı: `legalName`, adres, telefon, çalışma saatleri, `founder` → Person |
| `WebSite` | `/#website` | Site varlığı, `publisher` → Person |

Rehber sayfaları buna `Article`, `WebPage`, `BreadcrumbList` ve `FAQPage`
düğümlerini ekler. Toplam 7 düğüm, hepsi çapraz referanslı.

`sameAs` listesi kritik: cevap motorları bir kişinin farklı platformlardaki
hesaplarını bu alan üzerinden tek varlıkta birleştirir. Yeni bir hesap
açıldığında **her sayfadaki** `sameAs` dizisine eklenmelidir.

### Cevap motorları için içerik biçimi

- Her rehberin ilk bölümü, motorların doğrudan alıntılayabileceği
  **`.kisa-cevap` kutusuyla** açılır: tek paragrafta, 40-60 kelimede net tanım.
- Karşılaştırmalar **tablo** olarak verilir; tablolar çıkarım için en kolay
  biçimdir.
- Her rehberde `FAQPage` işaretlemeli soru-cevap bölümü vardır. SSS sayfasında
  otuza yakın soru tek `FAQPage` altında toplanır.
- Başlıklar soru cümlesi biçimindedir ("Fitoterapi nedir?", "Cilt tipimi nasıl
  belirlerim?"), çünkü sorgular bu biçimde gelir.
- Mevzuat atıfları tarih ve sayı ile verilir (örn. RG 27.10.2014 / 29158),
  bu doğrulanabilirliği artırır.

### Tarama dosyaları

- `robots.txt` — GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot,
  Google-Extended, Applebot-Extended, CCBot dahil tüm yapay zekâ tarayıcılarına
  açık; sitemap referansı içerir.
- `sitemap.xml` — 6 URL, `lastmod` ve görsel etiketleriyle.
- `llms.txt` — dil modelleri için sadeleştirilmiş site özeti: kimlik bilgileri,
  sayfa listesi ve açıklamaları, doğrulanmış hesaplar, alıntı sınırları.

### Marka mimarisi

Bu site, `dogalmarkam.com` ile **rekabet etmez**. Ürün kopyası burada
tekrarlanmaz; ürün aileleri aile düzeyinde anlatılıp mağazaya yönlendirilir.
Bu site yetki/biyografi merkezi, `dogalmarkam.com` ticaret merkezi olarak
konumlanır. İki alan adı birbirine `sameAs` ve doğrudan bağlantılarla
bağlanmıştır.

### Sıralama hakkında dürüst not

Bu altyapı **görünürlük olasılığını artırır, sıralama garantisi vermez.**
Hiçbir teknik çalışma "en üst sıra" sözü veremez. Bundan sonraki en büyük
kazanç teknikten değil şunlardan gelir:

1. **Özel alan adı.** `*.vercel.app` altındaki bir site, kendi alan adına sahip
   bir siteye göre otorite biriktirmekte dezavantajlıdır. İlk yapılacak iş bu.
2. **Google Search Console ve Bing Webmaster Tools** kaydı; sitemap'in elle
   gönderilmesi.
3. **Dış atıf.** Haber, röportaj, üniversite ve dernek sayfalarından gelen
   bağlantılar. Cevap motorları için tek başına en belirleyici sinyal budur.
4. **Google Business Profile** kaydı (Ankara Çankaya adresi ile).
5. **Düzenli güncelleme.** `dateModified` alanları gerçek güncellemelerle
   birlikte tazelenmelidir.

### Sayfa eklerken

Rehber sayfaları elle bakılan statik HTML'dir. Yeni sayfa eklerken:
`sitemap.xml`, `llms.txt`, ana sayfadaki `#rehberler` bölümü, üst menü ve
altlık menüsü güncellenmelidir.

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

/*
 * _protokol.mjs — konu → ürün eşlemesi
 * ---------------------------------------------------------------------------
 * Dr. Ecz. Fidan Pesen Özdoğan'ın kendi danışmanlık notundan çıkarıldı.
 * Asistanın 169 ürünlük katalogtan doğru olanı kendi bulmasını ummak yerine,
 * hangi konuda hangi ürünlerin kullanıldığı burada açıkça yazılı.
 *
 * İki seviye var:
 *
 *   'yonlendir'  Asistan ÜRÜN SAYMAZ. Onkolojik, organ yetmezliği, nörolojik
 *                ve psikiyatrik başlıklar burada. Konu doğrudan Hocamızın
 *                ekibine gider; kararı bir insan verir.
 *
 *   'oner'       Asistan ürünleri adıyla söyler. Ama önce ilaç kullanımını
 *                sorar ve hiçbir koşulda "bu hastalığı iyileştirir" demez;
 *                takviye edici gıdadır, hekim tedavisinin yerine geçmez.
 *
 * ETKİLEŞİM: kantaron ve ginkgo içeren ürünlerde ilaç sorusu her hâlükârda
 * zorunlu. Sarı kantaron karaciğer enzimlerini uyararak doğum kontrol hapı,
 * antidepresan, kan sulandırıcı ve bağışıklık baskılayıcıların etkisini
 * azaltır; ginkgo kan sulandırıcılarla kanama riskini artırır.
 * ---------------------------------------------------------------------------
 */
import { sade, URUNLER } from './_istem.mjs';

/** Ürün numarasından katalogdaki ürünü bulur (042 → "...Karışık Bitki Çayı 042 KTL..."). */
export function kodlaBul(kod) {
  /* Ürün adları "... Karışık Bitki Çayı 030 İYT 30 Gr" biçiminde: kod üç
     haneli, sonundaki "30 Gr" ise gramaj. Kodu üç haneye tamamlamadan
     aramak gramaja takılıyordu ve 030 istendiğinde "30 Gr" içeren ilk ürün
     dönüyordu. Artık tam üç haneli kod aranıyor. */
  const k = String(kod).replace(/\D/g, '').padStart(3, '0');
  const kalip = new RegExp('(^|\\s)' + k + '(\\s|$)');
  return URUNLER.find((u) => kalip.test(u.ad)) || null;
}

/* Anahtar kelimeler sadeleştirilmiş biçimde yazılır (İ/ı, ğ, ş dönüşümü
   _istem.mjs'deki sade() ile aynı). Kısa ve ayırt edici tutuldu. */
export const PROTOKOL = [
  /* ---------------------------------------------------- yalnızca yönlendir */
  { ad: 'Akciğer kanseri', seviye: 'yonlendir',
    anahtar: ['akciger kanser', 'akciger kanseri', 'akcigerimde kanser', 'akciger tumor'] },
  { ad: 'Beyin kitlesi ya da nodülü', seviye: 'yonlendir',
    anahtar: ['beyin kitle', 'beyinde kitle', 'beyin nodul', 'beyin tumor', 'beyinde tumor'] },
  { ad: 'Rahim, yumurtalık ya da göğüs kitlesi', seviye: 'yonlendir',
    anahtar: ['miyom', 'rahimde kitle', 'yumurtalikta kist', 'genital kitle', 'gogusumde kitle',
      'meme kitle', 'fibroadenom', 'rahim kanser', 'yumurtalik kanser', 'meme kanser'] },
  { ad: 'Böbrek yetmezliği', seviye: 'yonlendir',
    anahtar: ['bobrek yetmezlig', 'bobreklerim calismiyor', 'diyaliz', 'diyalize giriyorum'] },
  { ad: 'Hepatit A ve B', seviye: 'yonlendir',
    anahtar: ['hepatit a', 'hepatit b', 'sarilik hastalig'] },
  { ad: 'Pankreas hastalıkları', seviye: 'yonlendir',
    anahtar: ['pankreas', 'pankreatit', 'pankreasim'] },
  { ad: 'Kalp ve damar tıkanıklığı', seviye: 'yonlendir',
    anahtar: ['damar tikanik', 'kalp damar tikan', 'baypass', 'bypass', 'stent takil', 'kalp krizi gecir'] },
  { ad: 'Sara (epilepsi)', seviye: 'yonlendir',
    anahtar: ['sara hastalig', 'sara hastasi', 'saram var', 'epilepsi', 'nobet geciriyorum',
      'havale geciriyor', 'epilepsi hastasi'] },
  { ad: 'Behçet hastalığı', seviye: 'yonlendir',
    anahtar: ['behcet', 'behcet hastasi'] },
  { ad: 'Stres ve depresyon', seviye: 'yonlendir',
    anahtar: ['depresyon', 'depresyondayim', 'antidepresan', 'psikiyatri', 'panik atak'] },

  /* ------------------------------------------------------------- öneri var */
  { ad: 'Astım, bronşit ve KOAH', seviye: 'oner', kod: ['002', '005', '060'],
    anahtar: ['astim', 'bronsit', 'koah', 'nefes darligi cekiyorum'] },
  { ad: 'İdrar kaçırma', seviye: 'oner', kod: ['007', '027'],
    anahtar: ['idrar kacir', 'idrarimi tutamiyorum', 'mesane'] },
  { ad: 'Alzheimer ve Parkinson', seviye: 'oner', kod: ['008', '063', '026', '037'],
    anahtar: ['alzheimer', 'parkinson', 'unutkanlik', 'bunama'] },
  { ad: 'Anemi (kansızlık)', seviye: 'oner', kod: ['004', '041', '027'],
    anahtar: ['anemi', 'kansizlik', 'demir eksiklig', 'hemoglobinim dusuk'] },
  { ad: 'Kolit ve irritabl bağırsak', seviye: 'oner', kod: ['036', '029', '028'],
    anahtar: ['kolit', 'irritabl bagirsak', 'ibs', 'hassas bagirsak'] },
  { ad: 'Hemoroid', seviye: 'oner', kod: ['029', '028', '030'],
    anahtar: ['hemoroid', 'basur', 'makatta kanama'] },
  { ad: 'Böbrek taşı', seviye: 'oner', kod: ['012', '013'],
    anahtar: ['bobrek tasi', 'bobregimde tas', 'idrar yolu tasi'] },
  { ad: 'Egzema', seviye: 'oner', kod: ['017', '056', '041'],
    anahtar: ['egzama', 'egzema', 'ekzama'] },
  { ad: 'Gastrit, ülser ve reflü', seviye: 'oner', kod: ['067', '047', '025'],
    anahtar: ['gastrit', 'ulser', 'reflu', 'mide yanmasi'] },
  { ad: 'Tiroid hastalıkları', seviye: 'oner', kod: ['022', '030', '041'],
    anahtar: ['tiroid', 'hashimoto', 'hasimato', 'guatr'] },
  { ad: 'Hepatit C ve siroz', seviye: 'oner', kod: ['034', '062'],   // 061 katalogda yok
    anahtar: ['hepatit c', 'siroz'] },
  { ad: 'Karaciğer yağlanması', seviye: 'oner', kod: ['034', '041', '050'],
    anahtar: ['karaciger yaglanmas', 'yagli karaciger'] },
  { ad: 'Kabızlık', seviye: 'oner', kod: ['032', '029'],
    anahtar: ['kabizlik', 'kabiz', 'tuvalete cikamiyorum', 'bagirsak tembellig'] },
  { ad: 'İshal', seviye: 'oner', kod: ['031', '028'],
    anahtar: ['ishal', 'surgun'] },
  { ad: 'Yumurtalık tembelliği', seviye: 'oner', kod: ['009', '010', '043'],
    anahtar: ['yumurtalik tembel', 'polikistik', 'pkos', 'adet duzensizlig', 'hamile kalamiyorum'] },
  { ad: 'Erken menopoz', seviye: 'oner', kod: ['046', '009', '043'],
    anahtar: ['erken menopoz'] },
  { ad: 'Menopoz', seviye: 'oner', kod: ['046', '009', '057'],
    anahtar: ['menopoz', 'sicak basmas'] },
  { ad: 'Kadınlarda cinsel isteksizlik', seviye: 'oner', kod: ['009', '010', '043'],
    anahtar: ['cinsel isteksizlik', 'cinsel tembellik'] },
  { ad: 'Kas güçsüzlüğü', seviye: 'oner', kod: ['040', '026', '024'],
    anahtar: ['kas gucsuzlug', 'kas erimes', 'guc kaybi'] },
  { ad: 'Kemik erimesi', seviye: 'oner', kod: ['040', '054', '041'],
    anahtar: ['kemik erimes', 'osteoporoz', 'kemiklerim agriyor'] },
  { ad: 'Kulak çınlaması', seviye: 'oner', kod: ['057', '060', '008'],
    anahtar: ['kulak cinlamas', 'kulagim cinliyor', 'tinnitus', 'kulak uguldam'] },
  { ad: 'Migren', seviye: 'oner', kod: ['044', '058', '060'],
    anahtar: ['migren', 'migrenim'] },
  { ad: 'Romatizma', seviye: 'oner', kod: ['054', '016', '040'],
    anahtar: ['romatizma', 'eklem agri'] },
  { ad: 'İltihaplı romatizma ve kireçlenme', seviye: 'oner', kod: ['054', '060', '040'],
    anahtar: ['iltihapli romatizma', 'kireclenme', 'kirec'] },
  { ad: 'Sedef ve vitiligo', seviye: 'oner', kod: ['056', '017', '041'],
    anahtar: ['sedef', 'vitiligo', 'psoriasis'] },
  { ad: 'Sinüzit ve rinit', seviye: 'oner', kod: ['060', '057', '058'],
    anahtar: ['sinuzit', 'rinit', 'burun tikanik'] },
  { ad: 'Bademcik iltihabı ve farenjit', seviye: 'oner', kod: ['060', '057', '058'],
    anahtar: ['bademcik', 'farenjit', 'bogaz agri'] },
  { ad: 'Şeker hastalığı (diyabet)', seviye: 'oner', kod: ['065', '064'],
    anahtar: ['seker hastalig', 'seker hastasi', 'diyabet', 'kan sekerim yuksek',
      'insulin kullaniyorum', 'sekerim var'] },
  { ad: 'Uyku düzensizliği', seviye: 'oner', kod: ['057', '058'],
    anahtar: ['uyku duzensizlig', 'uyuyamiyorum', 'uykusuzluk', 'uykuya dalamiyorum'] },
  { ad: 'Varis', seviye: 'oner', kod: ['068', '037', '016'],
    anahtar: ['varis', 'varikoz', 'bacaklarimda damar'] },
  { ad: 'Zayıflama', seviye: 'oner', kod: ['045', '050'],
    anahtar: ['zayiflamak', 'kilo vermek', 'kilo verme', 'obezite', 'fazla kilo'] },
  { ad: 'Sperm sayısı ve kalitesi', seviye: 'oner', kod: ['018', '027', '033'],
    anahtar: ['sperm', 'oligozoospermi', 'cocugumuz olmuyor'] },
  { ad: 'Kolesterol', seviye: 'oner', kod: ['035', '041'],
    anahtar: ['kolesterol', 'kolesterolum yuksek'] },
  { ad: 'Felç sonrası destek', seviye: 'oner', kod: ['019', '008', '033', '026'],
    anahtar: ['felc gecirdi', 'felc gecirdim', 'inme gecirdi', 'inme gecirdim'] },
  { ad: 'Damar sertliği', seviye: 'oner', kod: ['016', '054', '037'],
    anahtar: ['damar sertlig', 'ateroskleroz'] },
  { ad: 'İştahsızlık', seviye: 'oner', kod: ['024', '027'],
    anahtar: ['istahsizlik', 'istahim yok', 'kilo alamiyorum'] },
  { ad: 'İyileşmeyen yaralar', seviye: 'oner', kod: ['030', '042', '041'],
    anahtar: ['iyilesmeyen yara', 'yaralarim kapanmiyor'] },
  { ad: 'Hipertansiyon', seviye: 'oner', kod: ['053', '016', '041'],
    anahtar: ['hipertansiyon', 'tansiyonum yuksek', 'yuksek tansiyon', 'tansiyon hastasi',
      'tansiyon ilaci kullaniyorum'] },
  { ad: 'Multipl skleroz (MS)', seviye: 'oner', kod: ['037', '041', '026'],
    anahtar: ['multipl skleroz', 'ms hastalig', 'ms hastasi', 'em hastalig'] },
  { ad: 'Prostat', seviye: 'oner', kod: ['051', '052', '060'],
    anahtar: ['prostat', 'prostatim'] },
  { ad: 'Safra kesesi', seviye: 'oner', kod: ['055', '012', '013'],
    anahtar: ['safra kesesi', 'safra tasi'] },
  { ad: 'Zihin açıcı destek', seviye: 'oner', kod: ['057', '026'],
    anahtar: ['odaklanamiyorum', 'konsantre olamiyorum', 'zihin acic', 'sinav'] },
  { ad: 'Vertigo (baş dönmesi)', seviye: 'oner', kod: ['057', '063', '008'],
    anahtar: ['vertigo', 'bas donmesi', 'basim donuyor'] },
  { ad: 'Huzursuz bacak sendromu', seviye: 'oner', kod: ['057', '040', '008'],
    anahtar: ['huzursuz bacak'] },
  { ad: 'Aşırı aktif mesane', seviye: 'oner', kod: ['051', '052'],
    anahtar: ['asiri aktif mesane', 'sik idrara cikiyorum'] },
  { ad: 'Lenf ödemi', seviye: 'oner', kod: ['022', '030'],
    anahtar: ['lenf odem', 'lenfodem'] },
  /* --------------------------------- kozmetik: kategori üzerinden eşleşir.
     Bu başlıklarda ürün numarası yok; kategori adı veriliyor ve o
     kategorideki ürünler öneriliyor. Hepsi düşük riskli, soru sormadan
     önerilebilir. */
  { ad: 'Yoğun saç dökülmesi', seviye: 'oner', kategori: 'Saç Bakımı · Yoğun Saç Dökülmesi',
    anahtar: ['sac dokul', 'sacim dokul', 'saclarim dokul', 'sac dokulmesi', 'kellik',
      'sac seyrel', 'sacim aziliyor', 'sac kaybi'] },
  { ad: 'Saç dolgunlaştırma', seviye: 'oner', kategori: 'Saç Bakımı · Saç Dolgunlaştırıcı',
    anahtar: ['sac dolgun', 'saclarim ince', 'sac incelme', 'sac hacim'] },
  { ad: 'Akneli ciltler', seviye: 'oner', kategori: 'Cilt Bakımı · Akneli Ciltler',
    anahtar: ['sivilce', 'akne', 'siyah nokta', 'yuzumde sivilce'] },
  { ad: 'Cilt lekeleri', seviye: 'oner', kategori: 'Cilt Bakımı · Leke Karşıtı',
    anahtar: ['cilt lekesi', 'lekelerim', 'melasma', 'yuzumde leke', 'cilt leke'] },
  { ad: 'Kırışıklık karşıtı bakım', seviye: 'oner', kategori: 'Cilt Bakımı · Kırışıklık Karşıtı',
    anahtar: ['kirisiklik', 'ince cizgi', 'yaslanma karsiti', 'cildim sarkiyor'] },
  { ad: 'Cilt nemlendirme', seviye: 'oner', kategori: 'Cilt Bakımı · Cilt Nemlendirme',
    anahtar: ['cildim kuru', 'kuru cilt', 'nemlendirici', 'cilt kurulugu'] },
  { ad: 'Rozalı ciltler', seviye: 'oner', kategori: 'Cilt Bakımı · Rozalı Ciltler',
    anahtar: ['rozasea', 'rozali', 'roza cilt', 'cildim kizariyor', 'hassas cilt'] },
  { ad: 'Göz altı morluk ve torbalanma', seviye: 'oner',
    kategori: 'Cilt Bakımı · Gözaltı Morluk ve Torbalanma',
    anahtar: ['goz alti morluk', 'goz alti torba', 'gozaltim mor'] },
  { ad: 'Gözenekli ciltler', seviye: 'oner', kategori: 'Cilt Bakımı · Gözenekli Ciltler',
    anahtar: ['gozenek', 'gozeneklerim'] },
  { ad: 'Güneş koruyucu', seviye: 'oner', kategori: 'Cilt Bakımı · Güneş Kremi',
    anahtar: ['gunes kremi', 'gunes koruyucu', 'spf'] },
];

/* Etkileşim uyarısı gerektiren ürün numaraları. Kantaron ve ginkgo içerenler. */
const ETKILESIMLI = new Set(['009', '008', '026', '019', '033']);

/**
 * Kullanıcının yazdıklarında protokol başlığı arar.
 * @returns {{ad, seviye, urunler, etkilesim}|null}
 */
export function protokolBul(metin) {
  const n = sade(metin);
  let bulunan = null;
  let enUzun = 0;
  for (const p of PROTOKOL) {
    for (const a of p.anahtar) {
      if (n.includes(a) && a.length > enUzun) { bulunan = p; enUzun = a.length; }
    }
  }
  if (!bulunan) return null;

  let urunler = (bulunan.kod || []).map(kodlaBul).filter(Boolean);
  /* Kozmetik başlıklarında ürün numarası yok; kategorideki ürünler alınır.
     Stokta olmayanlar elenir, en fazla üç tane. */
  if (!urunler.length && bulunan.kategori) {
    urunler = URUNLER.filter((u) => u.kategori === bulunan.kategori && u.stokta !== false).slice(0, 3);
  }
  const etkilesim = (bulunan.kod || []).some((k) => ETKILESIMLI.has(k));
  return { ad: bulunan.ad, seviye: bulunan.seviye, urunler, etkilesim };
}

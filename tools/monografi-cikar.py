#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monografi-cikar.py
---------------------------------------------------------------------------
belge/monografi/ klasöründeki .docx dosyalarını okuyup data/monografiler.json
üretir. Sayfaları üreten iş bu JSON'u okur (tools/monografileri-uret.mjs);
böylece .docx dosyaları depoya girmese de sayfalar yeniden üretilebilir.

Word dosyalarının hepsi aynı bölüm başlıklarını kullanıyor. Başlıklar biçem
adıyla değil metinle tanınıyor, çünkü belgelerde başlıklar da gövde metniyle
aynı biçemde ("AralkYok") yazılmış.

Kullanım:  python3 tools/monografi-cikar.py
Bağımlılık yok, Python 3.9+ yeterlidir.
---------------------------------------------------------------------------
"""
import glob
import json
import os
import re
import sys
import unicodedata as ud
import zipfile
from xml.etree import ElementTree as ET

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, 'belge', 'monografi')
CIKTI = os.path.join(KOK, 'data', 'monografiler.json')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# Belgelerdeki bölüm başlıkları. Soldaki anahtar sayfada kullanılan kimlik,
# sağdaki liste belgede geçebilecek yazımlar (ilk eşleşen kazanır).
BOLUMLER = [
    ('sinif',      ['Bilimsel Sınıflandırması', 'Bilimsel Sınıflandırılması']),
    ('turler',     ['Diğer Botanik Türleri', 'Botanik Türleri']),
    ('adlar',      ['Diğer Adları', 'Diğer Türkçe Adları']),
    ('ingilizce',  ['İngilizce Adları']),
    ('kisim',      ['Terapide Kullanılan Kısımları', 'Terapide Kullanılan Kısmı']),
    ('bilesen',    ['Kimyasal Bileşenleri', 'Kimyasal Bileşimi']),
    ('farmakope',  ['Farmakope ve Monografiler', 'Farmakopeler ve Monografiler']),
    ('botanik',    ['Bitkinin Botanik Özellikleri ve Yetiştiği Yerler',
                    'Botanik Özellikleri ve Yetiştiği Yerler']),
    ('gelenek',    ['Tarihsel ve Geleneksel Kullanımı', 'Tarihsel ve Geleneksel Kullanım']),
    ('farmakoloji', ['Farmakolojik Özellikleri ve Endikasyonları (Kullanıldığı Hastalıklar)',
                     'Farmakolojik Özellikleri ve Endikasyonları']),
    ('uyari',      ['Yan Etki, Kontraendikasyon, Toksisite ve İlaç Etkileşimleri',
                    'Yan Etki, Kontraendikasyon, Toksisite ve İlaç Etkileşimi']),
    ('kaynakca',   ['Kaynakça:', 'Kaynaklar:', 'Kaynakça', 'Kaynaklar']),
]

# Sayfada bölümlerin gösterileceği başlıklar.
BASLIK = {
    'sinif':       'Bilimsel sınıflandırması',
    'turler':      'Botanik türleri',
    'adlar':       'Diğer adları',
    'ingilizce':   'İngilizce adları',
    'kisim':       'Terapide kullanılan kısımları',
    'bilesen':     'Kimyasal bileşenleri',
    'farmakope':   'Farmakope ve monografiler',
    'botanik':     'Botanik özellikleri ve yetiştiği yerler',
    'gelenek':     'Tarihsel ve geleneksel kullanımı',
    'farmakoloji': 'Farmakolojik özellikleri ve endikasyonları',
    'uyari':       'Yan etki, kontrendikasyon, toksisite ve ilaç etkileşimleri',
    'kaynakca':    'Kaynakça',
}

TAKSON = ['Âlemi', 'Alemi', 'Bölümü', 'Sınıfı', 'Takımı', 'Familyası', 'Cinsi', 'Türü', 'Altsınıfı']

CEVIR = str.maketrans('çğıöşüÇĞİÖŞÜâîû', 'cgiosucgiosuaiu')


def nfc(m):
    return ud.normalize('NFC', m)


def kimlik(ad):
    """Türkçe başlıktan URL parçası üretir."""
    a = nfc(ad).lower().replace('ı', 'i').translate(CEVIR)
    a = re.sub(r'[^a-z0-9]+', '-', a).strip('-')
    return a


def paragraflar(yol):
    """Belgeyi sırayla gezer; paragrafları ve tabloları metne çevirir."""
    z = zipfile.ZipFile(yol)
    kok = ET.fromstring(z.read('word/document.xml'))
    govde = kok.find(W + 'body')
    cikti = []
    for oge in govde:
        if oge.tag == W + 'p':
            m = ''.join(t.text or '' for t in oge.iter(W + 't')).strip()
            if m:
                cikti.append(('p', nfc(re.sub(r'\s+', ' ', m))))
        elif oge.tag == W + 'tbl':
            satirlar = []
            for tr in oge.iter(W + 'tr'):
                hucre = []
                for tc in tr.iter(W + 'tc'):
                    m = ' '.join(t.text or '' for t in tc.iter(W + 't'))
                    hucre.append(nfc(re.sub(r'\s+', ' ', m).strip()))
                if any(hucre):
                    satirlar.append(hucre)
            if satirlar:
                cikti.append(('tablo', satirlar))
    return cikti


YAZIM = {}
for _anahtar, _adlar in BOLUMLER:
    for _a in _adlar:
        YAZIM[_a.rstrip(':').lower()] = _anahtar


def baslik_mi(metin, sonraki):
    """Belgelerde başlıklar gövdeyle aynı biçemde yazılmış, bu yüzden yapıdan
    tanınıyor: kısa, noktayla bitmeyen ve ardından uzun bir paragraf gelen
    satır başlıktır. Yıl içeren satırlar kaynakça girdisidir, başlık değil."""
    if metin.rstrip(':').strip().lower() in YAZIM:
        return True
    if len(metin) > 82 or metin.endswith(('.', ',', ';')):
        return False
    if re.search(r'\b(19|20)\d{2}\b', metin):
        return False
    if re.match(r'^(%s)\s*[:：]' % '|'.join(TAKSON + ['Takım', 'Alt familyası',
                                                     'Altfamilyası', 'Şubesi']), metin):
        return False
    return sonraki is None or len(sonraki) > 110 or sonraki.rstrip(':').lower() in YAZIM


def bolumle(oge):
    """Paragraf akışını bölümlere parçalar. Tanınan başlıklar ortak kimlik
    alır; tanınmayanlar (Alıç belgesinde olduğu gibi) kendi adlarıyla bölüm
    olur, böylece hiçbir metin kaybolmaz."""
    duzp = [i if t == 'p' else None for t, i in oge]
    bolumler, basliksiz, simdiki = [], [], None

    for sira, (tur, icerik) in enumerate(oge):
        if tur == 'p':
            sonraki = next((d for d in duzp[sira + 1:] if d is not None), None)
            if baslik_mi(icerik, sonraki):
                duz = icerik.rstrip(':').strip().lower()
                anahtar = YAZIM.get(duz)
                simdiki = {
                    'kimlik': anahtar or kimlik(icerik)[:60] or 'bolum%d' % sira,
                    'baslik': BASLIK[anahtar] if anahtar else icerik.rstrip(':'),
                    'kanonik': bool(anahtar),
                    'govde': [],
                }
                bolumler.append(simdiki)
                continue
        (simdiki['govde'] if simdiki else basliksiz).append([tur, icerik])

    # Aynı kimlikli bölümler (iki kaynakça gibi) tek gövdede birleştirilir.
    birlesik, gorulen = [], {}
    for b in bolumler:
        if b['kimlik'] in gorulen:
            gorulen[b['kimlik']]['govde'] += b['govde']
        else:
            gorulen[b['kimlik']] = b
            birlesik.append(b)
    return basliksiz, birlesik


TAKSON_HEPSI = TAKSON + ['Takım', 'Alt familyası', 'Altfamilyası', 'Şubesi']


def taksonomi(bolumler):
    """"Familyası: Rosaceae (Gülgiller)" biçimindeki satırları ayrıştırıp
    sınıflandırma bölümünün gövdesinden çıkarır."""
    cikti = []
    for b in bolumler:
        if b['kimlik'] != 'sinif':
            continue
        kalan = []
        for tur, icerik in b['govde']:
            m = re.match(r'^(%s)\s*[:：]\s*(.+)$' % '|'.join(TAKSON_HEPSI),
                         icerik) if tur == 'p' else None
            if m:
                cikti.append([m.group(1), m.group(2).strip()])
            else:
                kalan.append([tur, icerik])
        b['govde'] = kalan
    return cikti


def buyuk_turkce(m):
    return m.replace('i', 'İ').replace('ı', 'I').upper()


def baslik_turkce(m):
    """Türkçe büyük harften başlık düzenine çevirir: ALIÇ → Alıç."""
    if not m:
        return m
    kelime = []
    for k in m.split():
        if not k or not k.isupper():
            kelime.append(k)
            continue
        ilk, geri = k[0], k[1:]
        geri = geri.replace('I', 'ı').replace('İ', 'i').lower()
        kelime.append(ilk + geri)
    return ' '.join(kelime)


def latin_ayikla(ham):
    """Başlıktaki "ÇÖREK OTU (Nigella sativa L.)" kalıbını ada ve binom adına
    ayırır. Parantez yoksa binom ad metinden aranır."""
    m = re.match(r'^(.*?)\s*\((.+)\)\s*$', ham)
    if not m or re.search(r'[çğıöşü]', m.group(2)) or not re.match(r'[A-Z][a-z]{2,}\b', m.group(2)):
        return ham.strip(), '', ''
    ad, ic = m.group(1).strip(), m.group(2).strip()
    e = re.match(r'([A-Z][a-z]{2,})\s+([a-z][a-zé\-]{2,})\b', ic)
    if e:
        return ad, '%s %s' % (e.group(1), e.group(2)), e.group(1)
    return ad, '', re.match(r'([A-Z][a-z]{2,})', ic).group(1)


def cinsle(cins_ad, *metinler):
    """Taksonomideki cins adıyla başlayan ilk ikiliyi bulur; düzyazıdan
    yanlış ikili toplamanın önüne geçer."""
    if not cins_ad:
        return ''
    for m in metinler:
        e = re.search(r'\b%s\s+([a-z][a-zé\-]{2,})\b' % re.escape(cins_ad), m or '')
        if e:
            return '%s %s' % (cins_ad, e.group(1))
    return ''


def binom(*metinler):
    """Latince binom adayı arar. Türkçe kelimeleri elemek için tür adının
    Türkçeye özgü harf içermemesi ve Latince sonek taşıması beklenir."""
    for m in metinler:
        if not m:
            continue
        for e in re.finditer(r'\b([A-Z][a-z]{3,})\s+([a-z][a-zé\-]{2,})\b', m):
            cins_, tur_ = e.group(1), e.group(2)
            if re.search(r'[çğıöşüâîû]', cins_ + tur_):
                continue
            if tur_ in ('ve', 'ile', 'veya', 'bitkiler', 'bitkisi', 'olarak', 'gibi'):
                continue
            return '%s %s' % (cins_, tur_)
    return ''


def duz_metin(bolumler, kimlikler=None):
    return ' '.join(i for b in bolumler if kimlikler is None or b['kimlik'] in kimlikler
                    for t, i in b['govde'] if t == 'p')


def ozet(bolumler):
    """Sayfanın açıklama alanı ve kısa cevap kutusu için ilk cümleler."""
    sirali = [b for a in ('botanik', 'kisim', 'gelenek', 'farmakoloji')
              for b in bolumler if b['kimlik'] == a]
    sirali += [b for b in bolumler if b not in sirali and b['kimlik'] != 'sinif']
    for b in sirali:
        for tur, icerik in b['govde']:
            if tur != 'p' or len(icerik) <= 120:
                continue
            s = ''
            for c in re.split(r'(?<=[.!?])\s+', icerik):
                if s and len(s) + len(c) > 300:
                    break
                s += (' ' if s else '') + c
            if len(s) > 320:                       # tek cümle bile uzunsa kırp
                s = s[:300].rsplit(' ', 1)[0].rstrip(',;:') + '…'
            return re.sub(r'(\s*\d+(,\d+)*(-\d+)?)+(?=[.…]|$)', '', s.strip())
    return ''


def calis():
    if not os.path.isdir(KAYNAK):
        sys.exit('belge/monografi/ klasörü yok: %s' % KAYNAK)

    kayitlar = []
    for yol in sorted(glob.glob(os.path.join(KAYNAK, '*.docx')), key=lambda p: nfc(p)):
        dosya = nfc(os.path.basename(yol))
        if 'HERBAL' in dosya.upper():
            continue                                  # ayrı belge, ayrı sayfa
        oge = paragraflar(yol)
        if not oge:
            print('  boş atlandı: %s' % dosya)
            continue

        ham = oge[0][1] if oge[0][0] == 'p' else ''
        ham = re.sub(r'^MONOGRAF[İI]\s*\d*\s*', '', ham).strip(' -–—')
        if not ham:
            ham = re.sub(r'^MONOGRAF[İI]\s*\d*\s*|\s*\(\d+\)|\.docx$', '', dosya).strip()
        ad, latin, cins_ipucu = latin_ayikla(ham)
        ad = baslik_turkce(ad)

        basliksiz, bolumler = bolumle(oge[1:])
        takson = taksonomi(bolumler)
        takson_metin = ' '.join('%s: %s' % (a, b) for a, b in takson)
        cins_ad = cins_ipucu
        for a, d in takson:
            if a.startswith('Cins'):
                cins_ad = re.split(r'[\s,]', d.strip())[0] or cins_ad
        tam_metin = duz_metin(bolumler)
        latin = (latin
                 or cinsle(cins_ipucu or cins_ad, duz_metin(bolumler, {'turler'}), tam_metin)
                 or cinsle(cins_ad, duz_metin(bolumler, {'turler'}), tam_metin)
                 or binom(takson_metin, duz_metin(bolumler, {'turler'}),
                          duz_metin(bolumler, {'botanik'})))

        kaynakca = []
        icerik = []
        for b in bolumler:
            if b['kimlik'] == 'kaynakca':
                kaynakca = [i for t, i in b['govde'] if t == 'p' and len(i) > 12]
                continue
            if not b['govde']:
                continue
            icerik.append(b)

        kayit = {
            'ad': ad,
            'kimlik': kimlik(ad),
            'latince': ' '.join(latin.split()[:2]),
            'latinceTam': latin,
            'cins': cins_ad,
            'taksonomi': takson,
            'ozet': ozet(icerik),
            'bolumler': icerik,
            'kaynakca': kaynakca,
            'kelime': 0,
        }
        kayit['kelime'] = sum(
            len(i.split()) for b in icerik for t, i in b['govde'] if t == 'p')
        kayitlar.append(kayit)
        print('  %-20s %-26s %5d kelime · %2d bölüm · %3d kaynak' % (
            kayit['ad'], kayit['latince'], kayit['kelime'],
            len(icerik), len(kaynakca)))

    os.makedirs(os.path.dirname(CIKTI), exist_ok=True)
    with open(CIKTI, 'w', encoding='utf-8') as f:
        json.dump({
            'kaynak': 'Dr. Ecz. Fidan Pesen Özdoğan monografi arşivi',
            'not': 'tools/monografi-cikar.py tarafından üretildi, elle düzenlemeyin.',
            'monografiler': kayitlar,
        }, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('\nYazıldı: data/monografiler.json · %d monografi · %d kelime' % (
        len(kayitlar), sum(k['kelime'] for k in kayitlar)))


if __name__ == '__main__':
    calis()

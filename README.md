# 🏆 Winning Product Finder

Meta (Facebook/Instagram) Reklam Kütüphanesi'nden **kazanan ürünleri** keşfeden mini web uygulaması.
Hangi ürünler reklam veriyor, **ne kadar süredir aktif**, hangi kreatiflerle çalışıyor — hepsini temiz bir liste halinde gösterir ve CSV olarak dışa aktarır.

## Çalıştırma (tek adım)

`app` klasöründeki **`start.bat`** dosyasına çift tıkla.
Veya terminalde:

```powershell
node app/server.js
```

Sonra tarayıcıda aç: **http://localhost:4545**

> Gereksinim: Node.js (zaten kurulu). `npm install` GEREKMEZ — sıfır bağımlılık.

## İki mod

| Mod | Açıklama |
|-----|----------|
| **Demo verisi** | İnternet/hesap olmadan bile her zaman çalışır. Demo için en güvenli mod. |
| **Canlı (Apify)** | Arayüze Apify API token girilince Meta Ad Library'den gerçek reklamları çeker. |

### Canlı mod için Apify token
1. https://console.apify.com → ücretsiz hesap aç
2. Settings → Integrations → API token'ı kopyala
3. Uygulamada "Canlı (Apify)" sekmesine geç, token'ı yapıştır, ara.
   (Kullanılan actor: `curious_coder/facebook-ads-library-scraper`)

## Özellikler
- 🔍 Anahtar kelime / kategori / minimum aktif gün filtreleri
- 🏆 **Kazanan skoru** = aktif süre (50p) + reklam ölçeği (30p) + puan (20p)
- ▦ Kart ve ▤ Tablo görünümü
- ⬇ CSV dışa aktarma (Excel uyumlu, UTF-8)
- 📡 Canlı veya demo veri kaynağı

## Yapı
```
app/
  server.js            # Sıfır bağımlılık Node sunucu (demo + canlı API)
  start.bat            # Tek tıkla başlat
  data/
    demo-products.json # Gerçekçi demo ürünler
  public/
    index.html / styles.css / app.js
```

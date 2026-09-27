# 🏆 Winning Product Finder

> Meta (Facebook/Instagram) Reklam Kütüphanesi'nden **kazanan ürünleri** keşfeden, katmanlı mimariye sahip bir ürün araştırma sistemi.

Hangi ürünler reklam veriyor, **ne kadar süredir aktif**, hangi kreatiflerle çalışıyor — hepsini deterministik bir **100 puanlık kazanan skoru** ile sıralar, kart/tablo olarak gösterir, CSV'ye aktarır ve (opsiyonel) her aramayı Postgres/Supabase'e kaydeder.

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-informational">
  <img alt="Architecture" src="https://img.shields.io/badge/architecture-layered-blueviolet">
  <img alt="DB" src="https://img.shields.io/badge/db-Postgres%2FSupabase%20(opsiyonel)-success">
  <img alt="Tests" src="https://img.shields.io/badge/tests-node%3Atest-brightgreen">
</p>

---

## Neden bu proje?

Ürün araştırmasında asıl mesele "AI'a en iyi ürünü sordurmak" değil; **farklı kaynaklardan gelen veriyi toplayıp, doğrulayıp, deterministik kurallarla değerlendirip** yalnızca gerçekten yorum gerektiren yerde modele başvurmak. Sistem bu yüzden tek bir dev prompt değil, **sorumlulukları ayrılmış katmanlardan** oluşur.

Detaylı mimari için → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Hızlı başlangıç

```bash
# 1) Bağımlılık YOK (demo mod) — sadece çalıştır:
node src/index.js
#   → http://localhost:4545

# veya npm ile
npm start
```

> Demo mod internet/hesap/DB olmadan da her zaman çalışır. Aranan kelime demo
> listesinde yoksa, kelimeye özel **deterministik** (tekrar-üretilebilir) ürünler üretilir.

### Canlı mod (Apify)

```bash
cp .env.example .env
# .env içine APIFY_TOKEN yaz  → https://console.apify.com (Settings → API)
npm start
```

Arayüzde **Canlı (Apify)** sekmesine geç. Token sunucuda tanımlıysa arayüzde girmene gerek yoktur (tercih edilen, daha güvenli yol).

### Veritabanı ile (opsiyonel — Postgres / Supabase)

```bash
# .env içine bağlantı bilgisini ekle:
# DATABASE_URL=postgresql://...   (Supabase: Project Settings → Database → Connection string)
npm install            # pg sürücüsünü kurar
npm run db:schema      # db/schema.sql'i uygular
npm start              # artık her arama kaydedilir; GET /api/searches ile geçmiş
```

### Docker (uygulama + Postgres)

```bash
docker compose up --build
#   Uygulama: http://localhost:4545   |   Postgres: localhost:5432 (şema otomatik yüklenir)
```

---

## Özellikler

- 🔍 Anahtar kelime / kategori / minimum aktif gün filtreleri
- 🏆 **100 puanlık ağırlıklı kazanan skoru** (config-driven) + skor kırılımı
- 🧠 **AI analiz (opsiyonel)**: Claude ile reklam metninden niş/hook/açı çıkarımı (**tool/function-calling**)
- ▦ Kart ve ▤ Tablo görünümü, ⬇ CSV dışa aktarma (Excel uyumlu, UTF-8)
- 📡 İki veri kaynağı: **Demo** (offline) ve **Canlı** (Apify → Meta Ad Library)
- 🗄️ Opsiyonel kalıcılık: Postgres/Supabase; yoksa otomatik **in-memory** fallback
- 🧪 Skorlama + doğrulama + AI analiz için birim testler (`node:test`, sıfır bağımlılık)
- 🐳 Docker + docker-compose, `/health` probe'u

### AI analiz (Claude tool-calling)

```bash
# .env içine ekle:  ANTHROPIC_API_KEY=sk-ant-...   (opsiyonel: ANTHROPIC_MODEL, LLM_ANALYZE_TOP_N)
# İstekte analyze:true gönder → sıralamanın en üstündeki N ürün analiz edilir (maliyet kontrolü)
curl -X POST localhost:4545/api/search -H 'Content-Type: application/json' \
  -d '{"source":"demo","keyword":"blender","analyze":true}'
```

Model serbest metin değil, **tanımlı bir JSON şemasına** (`record_ad_insight`) uyan yapılandırılmış
çıktı döndürür (`tool_choice` ile o tool'a zorlanır). Anahtar yoksa özellik sessizce kapanır,
arama yine çalışır (best-effort). Arayüzde **🧠 AI analiz** kutusuyla açılır.

---

## API

| Metot | Yol | Açıklama |
|------|-----|----------|
| `POST` | `/api/search` | Arama çalıştırır. Gövde: `{ source, keyword, niche, minDays, sort, count, token }` |
| `GET`  | `/api/searches?limit=20` | Kaydedilen son aramaların özeti |
| `GET`  | `/health` | Sağlık kontrolü |

**Örnek**

```bash
curl -X POST localhost:4545/api/search \
  -H 'Content-Type: application/json' \
  -d '{"source":"demo","keyword":"led","sort":"winningScore"}'
```

```jsonc
{
  "source": "demo",
  "count": 2, "avgDays": 210, "avgScore": 58, "strong": 1,
  "items": [
    {
      "productName": "RGB LED Şerit Işık (5m)",
      "winningScore": 87,
      "tier": "🔥 Çok Güçlü",
      "scoreBreakdown": { "longevity": 37, "adScale": 29, "rating": 11, "freshness": 10 }
    }
  ],
  "searchId": 1
}
```

---

## Kazanan skoru nasıl hesaplanır?

Skor **deterministik ve açıklanabilir**; her sinyal 0..1'e normalize edilip ağırlıkla çarpılır (toplam = 100):

| Sinyal | Ağırlık | Sezgi |
|--------|:------:|------|
| `longevity` (aktif gün) | 45 | Uzun süredir aktif reklam = kanıtlanmış talep |
| `adScale` (reklam sayısı) | 30 | Çok reklam/varyasyon = bütçe & ölçek sinyali |
| `rating` (ürün puanı) | 15 | Yalnızca 4.0 üzeri kısım katkı verir |
| `freshness` (hâlâ aktif) | 10 | Canlı talep sinyali |

Ağırlıklar `.env` üzerinden (`SCORE_W_*`) kod değişmeden ayarlanabilir.

---

## Proje yapısı

```
winning-product-finder/
├── src/
│   ├── index.js                # Giriş noktası (HTTP sunucuyu başlatır)
│   ├── config/                 # Merkezî config + .env yükleme + skor ağırlıkları
│   ├── domain/                 # İş kuralları: scoring (100p motor) + product modeli
│   ├── providers/              # Veri kaynağı adaptörleri (demo, apify) + llm/ (Anthropic client)
│   ├── services/               # Orchestration (searchService) + insightService (LLM tool-calling)
│   ├── repositories/           # Kalıcılık: postgres + memory + factory (fallback)
│   ├── validation/             # İstek doğrulama & sanitizasyon
│   ├── server/                 # HTTP transport: httpServer, static, controllers
│   └── utils/                  # logger, errors
├── api/search.js               # Vercel serverless adaptörü (aynı servisi kullanır)
├── db/schema.sql               # Postgres/Supabase şeması (searches + search_items)
├── data/demo-products.json     # Offline demo ürünleri
├── public/                     # Vanilla JS arayüz (index.html, styles.css, app.js)
├── automation/                 # n8n workflow (agentic pipeline referansı)
├── test/scoring.test.js        # Birim testler
├── Dockerfile · docker-compose.yml
└── ARCHITECTURE.md
```

---

## Güvenlik

- `.env`, `.mcp.json`, `*.key`, `*.pem` ve `secrets/` **git'e girmez** (`.gitignore`).
- Apify token'ı **sunucu tarafında** (`APIFY_TOKEN`) tutmak tercih edilir; arayüz girişi yalnızca kolaylık içindir.
- İstek gövdesi boyutu sınırlanır, girişler doğrulanır, statik sunumda path-traversal engellenir.
- Kalıcılık hatası aramayı düşürmez (best-effort persist).

---

## Yol haritası

- [x] LLM katmanı: reklam metinlerinden niş/hook/açı çıkarımı (tool/function-calling)
- [ ] Semantik arama (embeddings + pgvector) — Supabase üzerinde
- [ ] RAG: geçmiş kazanan ürünlerle analizi zenginleştirme
- [ ] Ek kaynak sağlayıcıları (TikTok Creative Center) — mevcut provider arayüzüne takılır
- [ ] React/Next.js arayüz

## Lisans

MIT

# Mimari — Winning Product Finder

Bu doküman sistemin **neden** bu şekilde yapılandırıldığını ve katmanların nasıl
ayrıştığını anlatır. Amaç: her problemi LLM'e atmadan, **deterministik olarak
çözülebilen kısmı kod tarafında** çözen; kaynak/depolama/transport'u birbirinden
bağımsız, test edilebilir ve genişletilebilir bir sistem.

## Tasarım prensipleri

1. **Katmanlı ve tek-yönlü bağımlılık.** Üst katman alt katmanı çağırır; tersi olmaz.
   `server → services → (providers | domain | repositories)`. Domain hiçbir şeyi bilmez.
2. **Transport'tan bağımsız iş mantığı.** Yerel HTTP sunucusu ve Vercel serverless
   fonksiyonu *aynı* `searchService.runSearch()`'i çağırır — kod tekrarı yok.
3. **Strategy ile açık/kapalı genişleme.** Yeni bir veri kaynağı = yeni bir provider
   + registry kaydı. Servis/HTTP değişmez.
4. **Graceful degradation.** DB yoksa in-memory'ye, canlı mod hatalıysa anlamlı
   502 + hint'e, persist hatası aramayı düşürmeden uyarıya düşer.
5. **Config-driven davranış.** Skor ağırlıkları, tavanlar, portlar, token'lar tek
   bir `config` modülünden gelir; `process.env`'e başka yerde dokunulmaz.

## Katmanlar

| Katman | Klasör | Sorumluluk |
|--------|--------|------------|
| Config | `src/config` | `.env` yükleme, tipli/doğrulanmış ayarlar, skor ağırlıkları |
| Domain | `src/domain` | Saf iş kuralları: `scoring` (100p motor), `product` modeli |
| Providers | `src/providers` | Kaynak adaptörleri (`demo`, `apify`) + `llm/` Anthropic istemcisi |
| Services | `src/services` | `searchService` (orchestration) + `insightService` (LLM tool-calling) |
| Repositories | `src/repositories` | Kalıcılık: `postgres` + `memory` + `factory` |
| Validation | `src/validation` | İstek doğrulama & sanitizasyon |
| Server | `src/server` | HTTP transport: sunucu, router, controller, statik |
| Utils | `src/utils` | `logger`, tipli `errors` |

## Bileşen ilişkileri

```mermaid
flowchart TD
    subgraph Client["Arayüz (public/)"]
      UI["Vanilla JS · kart/tablo · CSV"]
    end

    subgraph Transport["Transport katmanı"]
      HTTP["src/server/httpServer.js"]
      VERCEL["api/search.js (serverless)"]
      CTRL["controllers/searchController.js"]
    end

    subgraph App["Uygulama katmanı"]
      VAL["validation/searchQuery.js"]
      SVC["services/searchService.js"]
      INS["services/insightService.js — LLM tool-calling"]
    end

    subgraph Domain["Domain (saf)"]
      SCORE["domain/scoring.js — 100p motor"]
      PROD["domain/product.js — normalize+enrich"]
    end

    subgraph Providers["Providers (strategy)"]
      REG["providers/index.js (registry)"]
      DEMO["demoProvider"]
      APIFY["apifyProvider → Meta Ad Library"]
    end

    subgraph LLM["AI analiz (opsiyonel)"]
      ANTH["providers/llm/anthropicClient → Claude Messages API"]
    end

    subgraph Persistence["Repositories (factory)"]
      REPO["repositories/index.js"]
      PG["postgresRepository (pg, lazy)"]
      MEM["memoryRepository (fallback)"]
    end

    UI -->|POST /api/search| HTTP --> CTRL
    VERCEL --> SVC
    CTRL --> SVC
    SVC --> VAL
    SVC --> REG --> DEMO & APIFY
    SVC --> PROD --> SCORE
    SVC --> INS --> ANTH
    SVC --> REPO --> PG & MEM
```

## Arama boru hattı (pipeline)

`searchService.runSearch()` şu deterministik adımları yürütür:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as searchService
    participant V as validation
    participant P as provider
    participant D as domain(scoring)
    participant R as repository

    C->>S: runSearch(rawQuery)
    S->>V: validate & sanitize
    V-->>S: güvenli query
    S->>P: fetch(query)  (demo | apify)
    P-->>S: ham ürünler
    S->>D: enrich + score (0..100)
    D-->>S: skorlu ürünler + kırılım
    S->>S: sort
    opt analyze=true ve ANTHROPIC_API_KEY var
      S->>S: insightService.enrichWithInsights(top N)
      Note right of S: Claude tool-calling → niş/hook/açı (best-effort)
    end
    S->>S: summarize
    S->>R: saveSearch(...)  (best-effort)
    R-->>S: searchId
    S-->>C: { source, count, avg*, items, searchId }
```

**Validate → Collect → Transform+Score → Sort → Persist → Output.** Her adımın
tek sorumluluğu vardır ve bir adımın çıktısı diğerinin girdisidir.

## Veri modeli

```mermaid
erDiagram
    searches ||--o{ search_items : contains
    searches {
      bigserial id PK
      timestamptz created_at
      text source
      jsonb query
      jsonb summary
      int item_count
    }
    search_items {
      bigserial id PK
      bigint search_id FK
      text product_name
      int days_active
      int ad_count
      int winning_score
      text tier
      jsonb payload
    }
```

Şema: [`db/schema.sql`](./db/schema.sql). Supabase yönetilen bir Postgres olduğu
için aynı `pg` sürücüsü ve `DATABASE_URL` ile çalışır; ek istemci gerekmez.

## Neden LLM çekirdekte değil?

Skorlama sayısal ve deterministik olarak çözülebilir; bu yüzden `domain/scoring.js`
saf bir fonksiyondur (test edilebilir, tekrar-üretilebilir, ücretsiz). LLM ise yalnızca
gerçekten **anlamsal yorum** gereken adımda devreye girer: `insightService`, reklam
metninden niş/hook/açı çıkarımını **tool/function-calling** ile yapar — modelden serbest
metin değil, `record_ad_insight` şemasına uyan yapılandırılmış çıktı istenir (`tool_choice`
ile zorlanır). Bu adım opsiyonel (`analyze=true`), best-effort ve maliyet için yalnızca
sıralamanın en üstündeki N ürünle sınırlıdır; anahtar yoksa sessizce kapanır. Bu ayrım
maliyeti düşürür ve deterministik çekirdeği açıklanabilir tutar.
`automation/n8n-facebook-ads-workflow.json`, bu boru hattının no-code/agentic bir
varyantını (Apify → normalize → analiz) referans olarak içerir.

## Güvenlik notları

- Sırlar `.gitignore` ile dışlanır (`.env`, `.mcp.json`, `*.key`, `*.pem`, `secrets/`).
- Apify token'ı sunucu env'inde tutulur; arayüz girişi opsiyonel kolaylıktır.
- Girdi doğrulama, gövde-boyutu sınırı ve statik sunumda path-traversal koruması vardır.
- DB kimlik bilgileri yalnızca `DATABASE_URL`/Supabase env'inde; koda gömülmez.

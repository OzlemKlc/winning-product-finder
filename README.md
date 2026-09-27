# 🏆 Winning Product Finder

> A layered product-research tool that surfaces **winning products** from the Meta (Facebook/Instagram) Ad Library.

It ranks products with a deterministic **100-point weighted "winning score"**, shows them as cards or a table, exports to CSV, and (optionally) persists every search to Postgres/Supabase. An optional AI layer analyses ad copy with Claude via **tool/function-calling**.

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-informational">
  <img alt="Architecture" src="https://img.shields.io/badge/architecture-layered-blueviolet">
  <img alt="DB" src="https://img.shields.io/badge/db-Postgres%2FSupabase%20(optional)-success">
  <img alt="Tests" src="https://img.shields.io/badge/tests-node%3Atest-brightgreen">
</p>

---

## Why this project

The real challenge in product research isn't "ask an AI for the best product." It's **collecting data from different sources, validating it, evaluating it with deterministic rules**, and calling a model only where genuine interpretation is needed. That's why the system is a set of **single-responsibility layers**, not one giant prompt.

Full design write-up → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## Quick start

```bash
# No dependencies (demo mode) — just run:
node src/index.js
#   → http://localhost:4545

# or with npm
npm start
```

> Demo mode always works — no internet, account, or database required. If a keyword
> isn't in the demo set, the app generates keyword-specific **deterministic**
> (reproducible) products.

### Live mode (Apify)

```bash
cp .env.example .env
# put APIFY_TOKEN in .env  → https://console.apify.com (Settings → API)
npm start
```

Switch to the **Canlı (Apify)** tab in the UI. If the token is set on the server, you don't need to enter it in the UI (the preferred, more secure path).

### AI analysis (Claude tool-calling)

```bash
# add to .env:  ANTHROPIC_API_KEY=sk-ant-...   (optional: ANTHROPIC_MODEL, LLM_ANALYZE_TOP_N)
# send analyze:true → only the top-N ranked products are analysed (cost control)
curl -X POST localhost:4545/api/search -H 'Content-Type: application/json' \
  -d '{"source":"demo","keyword":"blender","analyze":true}'
```

The model returns **structured output** matching a defined JSON schema (`record_ad_insight`), forced with `tool_choice` — not free text. If no key is set, the feature is silently disabled and search still works (best-effort). Toggle it in the UI with **🧠 AI analiz**.

### With a database (optional — Postgres / Supabase)

```bash
# add a connection string to .env:
# DATABASE_URL=postgresql://...   (Supabase: Project Settings → Database → Connection string)
npm install            # installs the pg driver
npm run db:schema      # applies db/schema.sql
npm start              # every search is now persisted; GET /api/searches for history
```

### Docker (app + Postgres)

```bash
docker compose up --build
#   App: http://localhost:4545   |   Postgres: localhost:5432 (schema auto-loaded)
```

---

## Features

- 🔍 Keyword / category / minimum-active-days filters
- 🏆 **100-point weighted winning score** (config-driven) with a per-signal breakdown
- 🧠 **Optional AI analysis**: niche/hook/angle extraction from ad copy via Claude **tool/function-calling**
- ▦ Card and ▤ table views, ⬇ CSV export (Excel-friendly, UTF-8)
- 📡 Two data sources: **Demo** (offline) and **Live** (Apify → Meta Ad Library)
- 🗄️ Optional persistence: Postgres/Supabase; automatic **in-memory** fallback otherwise
- 🧪 Unit tests for scoring, validation, and AI analysis (`node:test`, zero dependencies)
- 🐳 Docker + docker-compose, `/health` probe

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/search` | Runs a search. Body: `{ source, keyword, niche, minDays, sort, count, token, analyze }` |
| `GET`  | `/api/searches?limit=20` | Summary of recent persisted searches |
| `GET`  | `/health` | Health check |

**Example**

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
      "productName": "RGB LED Strip Light (5m)",
      "winningScore": 87,
      "tier": "🔥 Çok Güçlü",
      "scoreBreakdown": { "longevity": 37, "adScale": 29, "rating": 11, "freshness": 10 }
    }
  ],
  "searchId": 1
}
```

---

## How the winning score works

The score is **deterministic and explainable**; each signal is normalised to 0..1 and multiplied by a weight (total = 100):

| Signal | Weight | Intuition |
|--------|:------:|-----------|
| `longevity` (active days) | 45 | Long-running ads = proven demand |
| `adScale` (ad count) | 30 | Many ads/variants = budget & scale signal |
| `rating` (product rating) | 15 | Only the portion above 4.0 contributes |
| `freshness` (still active) | 10 | Live-demand signal |

Weights are configurable via `.env` (`SCORE_W_*`) without touching code.

---

## Project structure

```
winning-product-finder/
├── src/
│   ├── index.js                # Entry point (starts the HTTP server)
│   ├── config/                 # Central config + .env loading + score weights
│   ├── domain/                 # Business rules: scoring (100-pt engine) + product model
│   ├── providers/              # Data-source adapters (demo, apify) + llm/ (Anthropic client)
│   ├── services/               # Orchestration (searchService) + insightService (LLM tool-calling)
│   ├── repositories/           # Persistence: postgres + memory + factory (fallback)
│   ├── validation/             # Request validation & sanitisation
│   ├── server/                 # HTTP transport: httpServer, static, controllers
│   └── utils/                  # logger, errors
├── api/search.js               # Vercel serverless adapter (reuses the same service)
├── db/schema.sql               # Postgres/Supabase schema (searches + search_items)
├── data/demo-products.json     # Offline demo products
├── public/                     # Vanilla-JS UI (index.html, styles.css, app.js)
├── automation/                 # n8n workflow (agentic-pipeline reference)
├── test/                       # Unit tests
├── Dockerfile · docker-compose.yml
└── ARCHITECTURE.md
```

---

## Security

- `.env`, `.mcp.json`, `*.key`, `*.pem` and `secrets/` are **never committed** (`.gitignore`).
- The Apify token is kept **server-side** (`APIFY_TOKEN`); UI entry is a convenience only.
- Request body size is capped, inputs are validated, and static serving blocks path traversal.
- Persistence failures never break a search (best-effort persist).

---

## Roadmap

- [x] LLM layer: niche/hook/angle extraction from ad copy (tool/function-calling)
- [ ] Semantic search (embeddings + pgvector) on Supabase
- [ ] RAG: enrich analysis with past winning products
- [ ] Additional source providers (TikTok Creative Center) — plugs into the existing provider interface
- [ ] React/Next.js UI

## License

MIT

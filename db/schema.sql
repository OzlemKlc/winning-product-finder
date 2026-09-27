-- Winning Product Finder — Postgres / Supabase şeması
-- Supabase'de: SQL Editor'e yapıştırıp çalıştır. Yerel Postgres'te: psql -f db/schema.sql
-- İki tablo: her arama çalışması (searches) ve o çalışmanın ürünleri (search_items).

CREATE TABLE IF NOT EXISTS searches (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    source      TEXT        NOT NULL CHECK (source IN ('demo', 'live')),
    query       JSONB       NOT NULL,   -- doğrulanmış arama sorgusu (keyword, niche, ...)
    summary     JSONB       NOT NULL,   -- count / avgDays / avgScore / strong
    item_count  INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS search_items (
    id             BIGSERIAL PRIMARY KEY,
    search_id      BIGINT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    product_name   TEXT   NOT NULL,
    niche          TEXT,
    advertiser     TEXT,
    days_active    INTEGER,
    ad_count       INTEGER,
    is_active      BOOLEAN,
    creative_type  TEXT,
    est_price      NUMERIC(12, 2),
    currency       TEXT,
    rating         NUMERIC(3, 1),
    winning_score  INTEGER,            -- 0..100 ağırlıklı skor
    tier           TEXT,
    payload        JSONB               -- ürünün tam kanonik gövdesi (skor kırılımı dahil)
);

-- Sık sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_searches_created_at   ON searches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_items_search   ON search_items (search_id);
CREATE INDEX IF NOT EXISTS idx_search_items_score    ON search_items (winning_score DESC);

-- Örnek analitik görünüm: kaynak bazında ortalama kazanan skoru
CREATE OR REPLACE VIEW v_source_performance AS
SELECT source,
       COUNT(*)                     AS run_count,
       ROUND(AVG((summary->>'avgScore')::numeric), 1) AS avg_score
  FROM searches
 GROUP BY source;

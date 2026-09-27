'use strict';

/**
 * Centralized configuration & environment loading.
 *
 * Tek sorumluluk: environment değişkenlerini (opsiyonel .env dosyası dahil)
 * tek bir yerden okuyup tip-güvenli, doğrulanmış bir config nesnesi üretmek.
 * Uygulamanın hiçbir yeri `process.env`'e doğrudan dokunmaz — herkes bu modülü kullanır.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

/**
 * .env dosyasını (varsa) process.env'e yükler. Zaten tanımlı değişkenleri ezmez.
 * Harici bağımlılık (dotenv) gerektirmez — küçük ve öngörülebilir bir parser.
 */
function loadDotEnv(envPath = path.join(ROOT_DIR, '.env')) {
  try {
    const text = fs.readFileSync(envPath, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    /* .env yoksa sorun değil — demo modu env'siz de çalışır. */
  }
}

loadDotEnv();

const bool = (v, def = false) =>
  v === undefined ? def : /^(1|true|yes|on)$/i.test(String(v).trim());
const int = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

/**
 * "Winning" skorunun ağırlıkları. Toplam 100 olacak şekilde tasarlanmıştır.
 * Ortamdan ezilebilir (SCORE_W_LONGEVITY vb.) — böylece skorlama stratejisi
 * kod değişmeden ayarlanabilir. Bu, skorlama mantığını "config-driven" yapar.
 */
const scoringWeights = {
  longevity: int(process.env.SCORE_W_LONGEVITY, 45), // reklamın ne kadar süredir aktif olduğu
  adScale: int(process.env.SCORE_W_ADSCALE, 30), // aynı ürün için reklam/varyasyon sayısı
  rating: int(process.env.SCORE_W_RATING, 15), // ürün puanı (varsa)
  freshness: int(process.env.SCORE_W_FRESHNESS, 10), // reklamın hâlâ aktif olması sinyali
};

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),

  server: {
    port: int(process.env.PORT, 4545),
    host: process.env.HOST || '0.0.0.0',
    maxBodyBytes: int(process.env.MAX_BODY_BYTES, 1_000_000),
  },

  apify: {
    token: process.env.APIFY_TOKEN || '',
    actor: process.env.APIFY_ACTOR || 'curious_coder~facebook-ads-library-scraper',
    // run-sync uzun sürebilir; makul bir timeout tutuyoruz.
    timeoutMs: int(process.env.APIFY_TIMEOUT_MS, 90_000),
    defaultCount: int(process.env.APIFY_DEFAULT_COUNT, 12),
  },

  /**
   * Anthropic (Claude) — reklam metni analizi (tool/function-calling).
   * API anahtarı verilmezse AI analiz otomatik olarak devre dışı kalır (no-op).
   */
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
    timeoutMs: int(process.env.ANTHROPIC_TIMEOUT_MS, 30_000),
  },

  /** LLM analiz davranışı — maliyet kontrolü için yalnızca ilk N ürün analiz edilir. */
  llm: {
    analyzeTopN: int(process.env.LLM_ANALYZE_TOP_N, 5),
  },

  /**
   * Kalıcılık katmanı. DATABASE_URL (veya Supabase bilgileri) verilmezse
   * uygulama otomatik olarak in-memory repository'ye düşer ve env'siz çalışır.
   */
  database: {
    url: process.env.DATABASE_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '',
    ssl: bool(process.env.DATABASE_SSL, true),
  },

  scoring: {
    weights: scoringWeights,
    // Normalizasyon tavanları — bir sinyalin "tam puan"a ulaştığı eşik.
    caps: {
      longevityDays: int(process.env.SCORE_CAP_DAYS, 365),
      adCount: int(process.env.SCORE_CAP_ADS, 60),
      ratingFloor: 4.0, // 4.0 altı puan skora katkı vermez
    },
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * Kalıcılık yapılandırılmış mı? (Postgres/Supabase için yeterli bilgi var mı)
 */
config.database.isConfigured = Boolean(config.database.url || config.database.supabaseUrl);

/**
 * Canlı (Apify) mod için sunucu tarafında token var mı?
 */
config.apify.isConfigured = Boolean(config.apify.token);

/**
 * AI analiz (Anthropic) kullanılabilir mi? API anahtarı yoksa özellik sessizce kapalı.
 */
config.anthropic.isConfigured = Boolean(config.anthropic.apiKey);
config.llm.enabled = config.anthropic.isConfigured;

module.exports = { config, loadDotEnv, ROOT_DIR };

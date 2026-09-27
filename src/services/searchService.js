'use strict';

/**
 * Search Service — orchestration katmanı.
 *
 * Attachment'ta anlatılan boru hattını (pipeline) tek bir yerde birleştirir:
 *
 *   Validate → Collect(provider) → Transform+Score(domain) → Sort → Persist(repo) → Output
 *
 * Her adımın tek sorumluluğu vardır ve bir adımın çıktısı diğerinin girdisidir.
 * Bu katman transport'tan (HTTP/serverless) bağımsızdır; hem yerel sunucu hem
 * Vercel fonksiyonu aynı `runSearch`i çağırır.
 */

const { config } = require('../config');
const { logger } = require('../utils/logger');
const { getProvider } = require('../providers');
const { getRepository } = require('../repositories');
const { enrich } = require('../domain/product');
const { validateSearchQuery } = require('../validation/searchQuery');

/**
 * Skorlanmış ürünler üzerinden özet metrikleri hesaplar.
 */
function summarize(items) {
  const count = items.length;
  const avgDays = count ? Math.round(items.reduce((s, p) => s + (p.daysActive || 0), 0) / count) : 0;
  const avgScore = count ? Math.round(items.reduce((s, p) => s + (p.winningScore || 0), 0) / count) : 0;
  const strong = items.filter((p) => p.winningScore >= 80).length;
  return { count, avgDays, avgScore, strong };
}

/**
 * Tam arama boru hattını çalıştırır.
 * @param {object} rawQuery  HTTP gövdesinden gelen ham sorgu
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true]  Sonucu repository'ye kaydet
 * @returns {Promise<{source:string, count:number, avgDays:number, avgScore:number, strong:number, items:object[], searchId?:number}>}
 */
async function runSearch(rawQuery = {}, opts = {}) {
  const persist = opts.persist !== false;

  // 1) Validate — güvenli, tipli sorgu
  const query = validateSearchQuery(rawQuery);
  logger.info('search.start', { source: query.source, keyword: query.keyword });

  // 2) Collect — kaynağa göre strategy provider
  const provider = getProvider(query.source);
  const rawItems = await provider.fetch(query);

  // 3) Transform + Score — domain motoru (deterministik, açıklanabilir)
  let items = rawItems.map((raw) => enrich(raw, config.scoring));

  // 4) Sort — istenen anahtara göre azalan
  const key = query.sort;
  items.sort((a, b) => (b[key] || 0) - (a[key] || 0));

  // 5) Summary
  const summary = { ...summarize(items), source: provider.name };

  // 6) Persist — best-effort; kalıcılık hatası aramayı düşürmez
  let searchId;
  if (persist) {
    try {
      const repo = await getRepository();
      const saved = await repo.saveSearch({ query, source: provider.name, summary, items });
      searchId = saved.id;
    } catch (e) {
      logger.warn('search.persist_failed', { error: e.message });
    }
  }

  logger.info('search.done', { source: provider.name, count: items.length, searchId });

  // 7) Output
  return { source: provider.name, ...summary, items, ...(searchId ? { searchId } : {}) };
}

/**
 * Son aramaların özetini döndürür (kalıcılık katmanından).
 */
async function recentSearches(limit = 20) {
  const repo = await getRepository();
  return repo.listRecentSearches(limit);
}

module.exports = { runSearch, recentSearches, summarize };

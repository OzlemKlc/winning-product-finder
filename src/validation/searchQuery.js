'use strict';

/**
 * Arama isteği doğrulama & sanitizasyon.
 *
 * Deterministik doğrulama katmanı: veriyi sağlayıcıya/skorlamaya göndermeden
 * ÖNCE tipleri düzeltir, sınırları uygular ve güvenli bir sorgu nesnesi üretir.
 * (Projenin temel prensibi: "her problemi modele atma; çözülebileni önce çöz".)
 */

const { ValidationError } = require('../utils/errors');

const ALLOWED_SOURCES = new Set(['demo', 'live']);
const ALLOWED_SORTS = new Set(['winningScore', 'daysActive', 'adCount', 'estPrice']);
const MAX_KEYWORD_LEN = 120;

/**
 * @param {object} raw  HTTP gövdesinden gelen ham sorgu
 * @returns {{source:string, keyword:string, niche:string, minDays:number, sort:string, count:number, token:string}}
 */
function validateSearchQuery(raw = {}) {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Geçersiz istek gövdesi.');
  }

  const source = ALLOWED_SOURCES.has(raw.source) ? raw.source : 'demo';

  let keyword = typeof raw.keyword === 'string' ? raw.keyword.trim() : '';
  if (keyword.length > MAX_KEYWORD_LEN) keyword = keyword.slice(0, MAX_KEYWORD_LEN);

  const niche = typeof raw.niche === 'string' && raw.niche ? raw.niche : 'all';

  let minDays = Number(raw.minDays);
  if (!Number.isFinite(minDays) || minDays < 0) minDays = 0;
  minDays = Math.min(Math.floor(minDays), 3650);

  const sort = ALLOWED_SORTS.has(raw.sort) ? raw.sort : 'winningScore';

  let count = Number(raw.count);
  if (!Number.isFinite(count)) count = 0;
  count = Math.min(Math.max(Math.floor(count), 0), 100);

  const token = typeof raw.token === 'string' ? raw.token.trim() : '';

  // AI analiz (LLM tool-calling) talebi — opsiyonel, best-effort
  const analyze = raw.analyze === true || raw.analyze === 'true' || raw.analyze === 1;

  return { source, keyword, niche, minDays, sort, count, token, analyze };
}

module.exports = { validateSearchQuery, ALLOWED_SOURCES, ALLOWED_SORTS };

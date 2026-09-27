'use strict';

/**
 * Search controller — HTTP isteğini servis çağrısına bağlar.
 * Transport detaylarını (req/res) servis katmanından uzak tutar.
 */

const { runSearch, recentSearches } = require('../../services/searchService');
const { AppError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * POST /api/search
 * @param {object} body  ayrıştırılmış JSON gövde
 */
async function handleSearch(body) {
  try {
    const result = await runSearch(body || {});
    return { status: 200, body: result };
  } catch (e) {
    return errorToResponse(e);
  }
}

/**
 * GET /api/searches — son arama geçmişi
 */
async function handleRecent(limit) {
  try {
    const rows = await recentSearches(limit);
    return { status: 200, body: { count: rows.length, searches: rows } };
  } catch (e) {
    return errorToResponse(e);
  }
}

function errorToResponse(e) {
  if (e instanceof AppError) {
    if (e.status >= 500) logger.error('controller.error', { name: e.name, msg: e.message });
    return { status: e.status, body: e.toJSON() };
  }
  logger.error('controller.unexpected', { msg: e.message, stack: e.stack });
  return { status: 500, body: { error: 'Beklenmeyen bir hata oluştu.' } };
}

module.exports = { handleSearch, handleRecent };

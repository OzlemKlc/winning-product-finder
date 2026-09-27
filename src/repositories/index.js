'use strict';

/**
 * Repository factory.
 *
 * Yapılandırmaya bakarak doğru kalıcılık uygulamasını seçer:
 *   - DATABASE_URL/Supabase varsa  → PostgresRepository
 *   - yoksa                        → MemoryRepository (fallback)
 *
 * Postgres init başarısız olursa (ör. `pg` yok, DB erişilemez) uygulamayı
 * çökertmek yerine belleğe düşer ve uyarı loglar — dayanıklılık (graceful degradation).
 */

const { config } = require('../config');
const { logger } = require('../utils/logger');
const { MemoryRepository } = require('./memoryRepository');
const { PostgresRepository } = require('./postgresRepository');

let _instance = null;

/**
 * Tekil (singleton) repository örneğini döndürür; ilk çağrıda başlatır.
 * @returns {Promise<MemoryRepository|PostgresRepository>}
 */
async function getRepository() {
  if (_instance) return _instance;

  if (config.database.isConfigured) {
    const pg = new PostgresRepository();
    try {
      await pg.init();
      _instance = pg;
      logger.info('repository.selected', { driver: pg.driver });
      return _instance;
    } catch (e) {
      logger.warn('repository.postgres_failed_fallback_memory', { error: e.message });
    }
  }

  const mem = new MemoryRepository();
  await mem.init();
  _instance = mem;
  logger.info('repository.selected', { driver: mem.driver });
  return _instance;
}

/** Test/kapanış için örneği sıfırlar. */
async function resetRepository() {
  if (_instance) await _instance.close().catch(() => {});
  _instance = null;
}

module.exports = { getRepository, resetRepository };

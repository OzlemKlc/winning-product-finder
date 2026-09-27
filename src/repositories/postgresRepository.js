'use strict';

/**
 * Postgres / Supabase repository.
 *
 * Kalıcı depolama katmanı. Supabase bir yönetilen Postgres olduğundan aynı
 * `pg` sürücüsüyle DATABASE_URL üzerinden konuşuruz (Supabase → Project Settings
 * → Database → Connection string). `pg` bağımlılığı YALNIZCA burada ve LAZY
 * (gerektiğinde) require edilir; böylece DB yapılandırılmadığında uygulama
 * `npm install` olmadan da demo modda çalışmaya devam eder.
 *
 * Şema için bkz. db/schema.sql (searches + search_items tabloları).
 */

const { config } = require('../config');
const { RepositoryError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class PostgresRepository {
  constructor() {
    this._pool = null;
  }

  get driver() {
    return 'postgres';
  }

  /**
   * Bağlantı havuzunu kurar. `pg` yüklü değilse anlaşılır bir hata verir.
   */
  async init() {
    let Pool;
    try {
      ({ Pool } = require('pg'));
    } catch {
      throw new RepositoryError(
        "Postgres modu için 'pg' paketi gerekli. `npm install` çalıştır veya DATABASE_URL'i kaldırıp demo moda dön."
      );
    }

    this._pool = new Pool({
      connectionString: config.database.url,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30_000,
    });

    await this._pool.query('SELECT 1');
    logger.info('postgres.connected');
  }

  async saveSearch({ query, source, summary, items }) {
    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO searches (source, query, summary, item_count)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [source, JSON.stringify(query), JSON.stringify(summary), items.length]
      );
      const searchId = rows[0].id;

      // Ürünleri toplu ekle
      for (const p of items) {
        await client.query(
          `INSERT INTO search_items
             (search_id, product_name, niche, advertiser, days_active, ad_count,
              is_active, creative_type, est_price, currency, rating, winning_score, tier, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            searchId, p.productName, p.niche, p.advertiser, p.daysActive, p.adCount,
            p.isActive, p.creativeType, p.estPrice, p.currency, p.rating,
            p.winningScore, p.tier, JSON.stringify(p),
          ]
        );
      }

      await client.query('COMMIT');
      return { id: searchId };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new RepositoryError(`Arama kaydedilemedi: ${e.message}`);
    } finally {
      client.release();
    }
  }

  async listRecentSearches(limit = 20) {
    const { rows } = await this._pool.query(
      `SELECT id, created_at, source, query, summary, item_count
         FROM searches
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async healthCheck() {
    try {
      await this._pool.query('SELECT 1');
      return { ok: true, driver: this.driver };
    } catch (e) {
      return { ok: false, driver: this.driver, error: e.message };
    }
  }

  async close() {
    if (this._pool) await this._pool.end();
  }
}

module.exports = { PostgresRepository };

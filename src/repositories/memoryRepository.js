'use strict';

/**
 * In-memory repository — sıfır yapılandırma, sıfır bağımlılık fallback'i.
 *
 * DATABASE_URL / Supabase tanımlı DEĞİLSE devreye girer. Arama geçmişini süreç
 * belleğinde tutar (yeniden başlatınca sıfırlanır). Amaç: uygulamanın DB olmadan
 * da tam çalışması ve arayüzün "son aramalar" gibi özellikleri kaybetmemesi.
 * Repository arayüzü Postgres ile birebir aynıdır (Liskov ikamesi).
 */

class MemoryRepository {
  constructor() {
    /** @type {Array<object>} */
    this._searches = [];
    this._seq = 1;
  }

  get driver() {
    return 'memory';
  }

  async init() {
    /* bellek için hazırlık gerekmez */
  }

  /**
   * Bir arama çalışmasını (özet + ürünler) kaydeder.
   * @returns {Promise<{id:number}>}
   */
  async saveSearch({ query, source, summary, items }) {
    const id = this._seq++;
    this._searches.unshift({
      id,
      created_at: new Date().toISOString(),
      source,
      query,
      summary,
      item_count: items.length,
      items,
    });
    // Belleği sınırlı tut
    if (this._searches.length > 200) this._searches.length = 200;
    return { id };
  }

  /**
   * Son aramaların özetini döndürür (ürün gövdesi olmadan).
   */
  async listRecentSearches(limit = 20) {
    return this._searches.slice(0, limit).map(({ items, ...rest }) => rest);
  }

  async healthCheck() {
    return { ok: true, driver: this.driver };
  }

  async close() {
    /* no-op */
  }
}

module.exports = { MemoryRepository };

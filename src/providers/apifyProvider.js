'use strict';

/**
 * Canlı veri sağlayıcısı — Meta (Facebook) Reklam Kütüphanesi, Apify actor üzerinden.
 *
 * Sorumluluk: Apify'a HTTP çağrısı yapmak, dataset'i çekmek ve her ham reklamı
 * kanonik ürün şekline (domain/product) yaklaştıran ara bir kayda normalize etmek.
 * Skorlama burada YAPILMAZ — o, servis katmanında domain motoruyla yapılır.
 */

const { config } = require('../config');
const { ProviderError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Apify'ın döndürdüğü tek bir reklam kaydını kanonik-benzeri ürüne indirger.
 */
function normalizeAd(ad) {
  const snap = ad.snapshot || {};
  const card = (snap.cards && snap.cards[0]) || {};
  const start = ad.start_date || ad.ad_delivery_start_time || snap.start_date;

  let daysActive = 0;
  if (start) {
    const ms = typeof start === 'number' ? start * 1000 : Date.parse(start);
    if (!Number.isNaN(ms)) daysActive = Math.max(0, Math.round((Date.now() - ms) / 86_400_000));
  }

  const image =
    card.original_image_url ||
    card.resized_image_url ||
    (snap.images && snap.images[0] && (snap.images[0].original_image_url || snap.images[0].resized_image_url)) ||
    card.video_preview_image_url ||
    (snap.videos && snap.videos[0] && snap.videos[0].video_preview_image_url) ||
    '';

  const body =
    (snap.body && (snap.body.text || (snap.body.markup && snap.body.markup.__html))) || card.body || '';
  const title = card.title || snap.title || snap.page_name || 'Bilinmeyen Ürün';

  return {
    id: ad.ad_archive_id || ad.adArchiveID || String(daysActive + Math.round((ad.collation_count || 1) * 7)),
    productName: title,
    niche: 'Canlı',
    advertiser: snap.page_name || ad.page_name || '—',
    advertiserUrl: snap.page_profile_uri || '',
    daysActive,
    adCount: ad.collation_count || 1,
    isActive: ad.is_active !== false,
    creativeType: snap.videos && snap.videos.length ? 'video' : 'image',
    image,
    adCopy: typeof body === 'string' ? body.replace(/<[^>]*>/g, ' ').trim() : '',
    landingUrl: card.link_url || snap.caption || '',
    estPrice: null,
    currency: 'USD',
    amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(title)}`,
    amazonPrice: null,
    rating: null,
  };
}

/**
 * Timeout destekli fetch (AbortController). Apify run-sync uzun sürebilir.
 */
async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * @implements {import('./index').SearchProvider}
 */
const apifyProvider = {
  name: 'live',

  /**
   * @param {{keyword?:string, count?:number, token?:string}} query
   * @returns {Promise<object[]>} normalize edilmiş (henüz skorlanmamış) ürün kayıtları
   */
  async fetch({ keyword = '', count, token } = {}) {
    // Token önceliği: (1) sunucu env (güvenli, tercih edilen) → (2) istekte gelen token.
    const apiToken = config.apify.token || token;
    if (!apiToken) {
      throw new ProviderError('Apify token gerekli (canlı mod için).', {
        hint: 'Sunucuda APIFY_TOKEN tanımla veya arayüzden token gir.',
      });
    }

    const fbUrl =
      `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US` +
      `&media_type=all&q=${encodeURIComponent(keyword || '')}&search_type=keyword_unordered&source=fb-logo`;

    const endpoint =
      `https://api.apify.com/v2/acts/${config.apify.actor}` +
      `/run-sync-get-dataset-items?token=${encodeURIComponent(apiToken)}`;

    const payload = {
      count: Math.max(10, Number(count) || config.apify.defaultCount),
      scrapeAdDetails: true,
      'scrapePageAds.activeStatus': 'all',
      urls: [{ url: fbUrl, method: 'GET' }],
    };

    logger.info('apify.fetch.start', { keyword, count: payload.count, actor: config.apify.actor });

    let res;
    try {
      res = await fetchWithTimeout(
        endpoint,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        config.apify.timeoutMs
      );
    } catch (e) {
      throw new ProviderError(
        e.name === 'AbortError' ? 'Apify isteği zaman aşımına uğradı.' : `Apify bağlantı hatası: ${e.message}`
      );
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new ProviderError(`Apify hata ${res.status}: ${txt.slice(0, 300)}`);
    }

    const data = await res.json().catch(() => null);
    const arr = Array.isArray(data) ? data : [];
    if (arr.length && arr[0] && arr[0].error && !arr[0].snapshot) {
      throw new ProviderError('Apify: ' + arr[0].error);
    }

    const items = arr.filter((ad) => ad && ad.snapshot).map(normalizeAd);
    logger.info('apify.fetch.done', { returned: arr.length, usable: items.length });
    return items;
  },
};

module.exports = { apifyProvider, normalizeAd };

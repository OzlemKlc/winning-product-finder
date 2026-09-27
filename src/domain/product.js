'use strict';

/**
 * Product domain modeli.
 *
 * Sistemdeki ürünün tek, kanonik şekli burada tanımlanır. Farklı kaynaklardan
 * (demo, Apify canlı verisi) gelen ham kayıtlar `normalize*` fonksiyonlarıyla
 * bu şekle indirgenir; skorlama ve kalıcılık her zaman kanonik şekille çalışır.
 */

const { computeScore, tierOf } = require('./scoring');

/**
 * Kanonik ürün alanları — dokümantasyon ve DB şeması ile hizalıdır.
 * @typedef {Object} Product
 * @property {string}  id
 * @property {string}  productName
 * @property {string}  niche
 * @property {string}  advertiser
 * @property {string}  advertiserUrl
 * @property {number}  daysActive
 * @property {number}  adCount
 * @property {boolean} isActive
 * @property {'video'|'image'} creativeType
 * @property {string}  image
 * @property {string}  adCopy
 * @property {string}  landingUrl
 * @property {?number} estPrice
 * @property {string}  currency
 * @property {string}  amazonUrl
 * @property {?number} amazonPrice
 * @property {?number} rating
 */

/**
 * Ham objeyi güvenli varsayılanlarla kanonik ürüne indirger.
 * @param {object} raw
 * @returns {Product}
 */
function toProduct(raw = {}) {
  return {
    id: String(raw.id ?? cryptoRandomId()),
    productName: String(raw.productName ?? 'Bilinmeyen Ürün'),
    niche: String(raw.niche ?? 'Trend'),
    advertiser: String(raw.advertiser ?? '—'),
    advertiserUrl: String(raw.advertiserUrl ?? ''),
    daysActive: Number(raw.daysActive) || 0,
    adCount: Number(raw.adCount) || 0,
    isActive: raw.isActive !== false,
    creativeType: raw.creativeType === 'video' ? 'video' : 'image',
    image: String(raw.image ?? ''),
    adCopy: String(raw.adCopy ?? ''),
    landingUrl: String(raw.landingUrl ?? ''),
    estPrice: raw.estPrice == null ? null : Number(raw.estPrice),
    currency: String(raw.currency ?? 'USD'),
    amazonUrl: String(raw.amazonUrl ?? ''),
    amazonPrice: raw.amazonPrice == null ? null : Number(raw.amazonPrice),
    rating: raw.rating == null ? null : Number(raw.rating),
  };
}

/**
 * Ürünü skor + tier + kırılım ile zenginleştirir (skorlama config'i gerekir).
 * @param {object} raw
 * @param {object} scoringConfig
 * @returns {Product & { winningScore:number, tier:string, scoreBreakdown:object }}
 */
function enrich(raw, scoringConfig) {
  const product = toProduct(raw);
  const { score, breakdown } = computeScore(product, scoringConfig);
  return { ...product, winningScore: score, tier: tierOf(score), scoreBreakdown: breakdown };
}

function cryptoRandomId() {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

module.exports = { toProduct, enrich };

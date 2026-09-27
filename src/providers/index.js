'use strict';

/**
 * Provider registry (strategy factory).
 *
 * Servis katmanı, kaynak adına ('demo' | 'live') göre buradan bir sağlayıcı ister
 * ve hepsi aynı arayüzü (`fetch(query) => rawProducts[]`) uygular. Yeni bir kaynak
 * eklemek (ör. TikTok Creative Center) yalnızca yeni bir provider + kayıt demektir;
 * servis/HTTP katmanları değişmez. (Open/Closed prensibi.)
 */

const { demoProvider } = require('./demoProvider');
const { apifyProvider } = require('./apifyProvider');

/**
 * @typedef {Object} SearchProvider
 * @property {string} name
 * @property {(query:object)=>Promise<object[]>} fetch
 */

/** @type {Record<string, SearchProvider>} */
const REGISTRY = {
  [demoProvider.name]: demoProvider,
  [apifyProvider.name]: apifyProvider,
};

/**
 * Kaynak adını sağlayıcıya çözer. Bilinmeyen/boş kaynak → 'demo' (güvenli varsayılan).
 * @param {string} source
 * @returns {SearchProvider}
 */
function getProvider(source) {
  return REGISTRY[source] || REGISTRY.demo;
}

module.exports = { getProvider, REGISTRY };

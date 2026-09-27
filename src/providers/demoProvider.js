'use strict';

/**
 * Demo veri sağlayıcısı.
 *
 * İnternet/hesap olmadan bile deterministik, gerçekçi ürünler döndürür.
 * Aranan kelime demo listesinde yoksa, kelimeye özel (seed'li, tekrar-üretilebilir)
 * sentetik ürünler üretir. Bu, sunum/demoların her koşulda çalışmasını garanti eder.
 */

const path = require('path');

const DEMO = require(path.join(__dirname, '..', '..', 'data', 'demo-products.json'));

const SYNTH_ADVERTISERS = ['TrendCart', 'ShopVibe', 'NovaGoods', 'PrimeFinds', 'UrbanDeals', 'GadgetHub', 'DailyWow', 'PeakStore'];
const SYNTH_VARIANTS = ['Pro', 'Plus', '2.0', 'Premium', 'Mini', 'Akıllı', 'Taşınabilir', 'XL'];
const SYNTH_COPY = [
  'Sınırlı stok! Bugün sipariş verenlere ücretsiz kargo. Binlerce mutlu müşteri.',
  'Görenleri şaşırtan tasarım. %50 indirim son gün. Hızlı teslimat.',
  'Hayatını kolaylaştıran ürün. Trend olan bu ürünü kaçırma!',
  'Viral olan ürün burada. Stoklar tükenmeden hemen al.',
  'Müşterilerimizin 1 numaralı tercihi. 30 gün iade garantisi.',
];

function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Seed'li sözde-rastgele üreticiyle kelimeye özel ürünler sentezler.
 * Aynı kelime her zaman aynı sonucu verir (tekrar-üretilebilirlik).
 */
function synthesize(keyword, n = 8) {
  const base = keyword.trim();
  const titled = base.charAt(0).toUpperCase() + base.slice(1);
  const seed = strHash(base.toLowerCase());
  const rng = (i, mod) => ((seed + i * 2654435761) >>> 0) % mod;
  const out = [];
  for (let i = 0; i < n; i++) {
    const variant = i === 0 ? '' : ' ' + SYNTH_VARIANTS[rng(i, SYNTH_VARIANTS.length)];
    const days = 25 + rng(i + 1, 300);
    const ads = 6 + rng(i + 3, 55);
    const rating = (40 + rng(i + 5, 10)) / 10;
    const price = 9.99 + rng(i + 7, 80);
    out.push({
      id: `s_${seed}_${i}`,
      productName: `${titled}${variant}`,
      niche: 'Trend',
      advertiser: SYNTH_ADVERTISERS[rng(i + 2, SYNTH_ADVERTISERS.length)] + ' Co',
      advertiserUrl: '',
      daysActive: days,
      adCount: ads,
      isActive: true,
      creativeType: rng(i, 2) ? 'video' : 'image',
      image: '',
      adCopy: SYNTH_COPY[rng(i + 4, SYNTH_COPY.length)],
      landingUrl: '',
      estPrice: Math.round(price * 100) / 100,
      currency: 'USD',
      amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(base)}`,
      amazonPrice: Math.round(price * 0.85 * 100) / 100,
      rating: Math.round(rating * 10) / 10,
    });
  }
  return out;
}

/**
 * @implements {import('./index').SearchProvider}
 */
const demoProvider = {
  name: 'demo',

  /**
   * @param {{keyword?:string, niche?:string, minDays?:number}} query
   * @returns {Promise<object[]>} ham (henüz skorlanmamış) ürün kayıtları
   */
  async fetch({ keyword = '', niche = 'all', minDays = 0 } = {}) {
    let items = [...DEMO];

    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter((p) =>
        `${p.productName} ${p.niche} ${p.advertiser} ${p.adCopy || ''}`.toLowerCase().includes(k)
      );
      if (items.length === 0) items = synthesize(keyword);
    }
    if (niche && niche !== 'all') items = items.filter((p) => p.niche === niche);
    if (minDays) items = items.filter((p) => (p.daysActive || 0) >= Number(minDays));

    return items;
  },
};

module.exports = { demoProvider, synthesize };

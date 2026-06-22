/**
 * Winning Product Finder — paylaşılan çekirdek mantık
 * Hem yerel sunucu (server.js) hem Vercel fonksiyonu (api/search.js) bunu kullanır.
 */
const DEMO = require('../data/demo-products.json');

// "Winning" skoru: uzun süre aktif = kanıtlanmış kazanan ürün sinyali
function computeScore(p) {
  const days = Math.min(p.daysActive || 0, 365);
  const ads = Math.min(p.adCount || 0, 60);
  const rating = Math.max(0, Math.min(p.rating || 0, 5));
  const ratingPts = rating >= 4 ? ((rating - 4) / 1) * 20 : 0;
  const score = Math.round((days / 365) * 50 + (ads / 60) * 30 + ratingPts);
  return Math.max(0, Math.min(100, score));
}

function tierOf(score) {
  if (score >= 80) return '🔥 Çok Güçlü';
  if (score >= 60) return 'Güçlü';
  if (score >= 40) return 'Orta';
  return 'Zayıf';
}

function enrich(p) {
  const winningScore = computeScore(p);
  return { ...p, winningScore, tier: tierOf(winningScore) };
}

// --- Demo modu: aranan kelime listede yoksa kelimeye özel gerçekçi ürünler üret ---
const SYNTH_ADVERTISERS = ['TrendCart', 'ShopVibe', 'NovaGoods', 'PrimeFinds', 'UrbanDeals', 'GadgetHub', 'DailyWow', 'PeakStore'];
const SYNTH_VARIANTS = ['Pro', 'Plus', '2.0', 'Premium', 'Mini', 'Akıllı', 'Taşınabilir', 'XL'];
const SYNTH_COPY = [
  'Sınırlı stok! Bugün sipariş verenlere ücretsiz kargo. Binlerce mutlu müşteri.',
  'Görenleri şaşırtan tasarım. %50 indirim son gün. Hızlı teslimat.',
  'Hayatını kolaylaştıran ürün. Trend olan bu ürünü kaçırma!',
  'Viral olan ürün burada. Stoklar tükenmeden hemen al.',
  'Müşterilerimizin 1 numaralı tercihi. 30 gün iade garantisi.'
];

function strHash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; }

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
    out.push(enrich({
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
      amazonPrice: Math.round((price * 0.85) * 100) / 100,
      rating: Math.round(rating * 10) / 10
    }));
  }
  return out;
}

function searchDemo({ keyword, niche, minDays }) {
  let items = DEMO.map(enrich);
  if (keyword) {
    const k = keyword.toLowerCase();
    items = items.filter(p =>
      `${p.productName} ${p.niche} ${p.advertiser} ${p.adCopy || ''}`.toLowerCase().includes(k));
    if (items.length === 0) items = synthesize(keyword);
  }
  if (niche && niche !== 'all') items = items.filter(p => p.niche === niche);
  if (minDays) items = items.filter(p => (p.daysActive || 0) >= Number(minDays));
  items.sort((a, b) => b.winningScore - a.winningScore);
  return items;
}

// --- Canlı mod: Apify Meta (Facebook) Ad Library Scraper ---
function normalizeAd(ad) {
  const snap = ad.snapshot || {};
  const card = (snap.cards && snap.cards[0]) || {};
  const start = ad.start_date || ad.ad_delivery_start_time || snap.start_date;
  let daysActive = 0;
  if (start) {
    const ms = typeof start === 'number' ? start * 1000 : Date.parse(start);
    if (!isNaN(ms)) daysActive = Math.max(0, Math.round((Date.now() - ms) / 86400000));
  }
  const image =
    card.original_image_url || card.resized_image_url ||
    (snap.images && snap.images[0] && (snap.images[0].original_image_url || snap.images[0].resized_image_url)) ||
    card.video_preview_image_url ||
    (snap.videos && snap.videos[0] && snap.videos[0].video_preview_image_url) || '';
  const body = (snap.body && (snap.body.text || (snap.body.markup && snap.body.markup.__html))) || card.body || '';
  return {
    id: ad.ad_archive_id || ad.adArchiveID || String(daysActive + Math.round((ad.collation_count || 1) * 7)),
    productName: card.title || snap.title || snap.page_name || 'Bilinmeyen Ürün',
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
    amazonUrl: `https://www.amazon.com/s?k=${encodeURIComponent(card.title || snap.page_name || '')}`,
    amazonPrice: null,
    rating: null
  };
}

async function searchLive({ keyword, token, count }) {
  token = token || process.env.APIFY_TOKEN;
  if (!token) throw new Error('Apify token gerekli (canlı mod için).');
  const fbUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&media_type=all&q=${encodeURIComponent(keyword || '')}&search_type=keyword_unordered&source=fb-logo`;
  const endpoint = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const payload = {
    count: Math.max(10, Number(count) || 12), // actor en az 10 sonuç ister
    scrapeAdDetails: true,
    'scrapePageAds.activeStatus': 'all',
    urls: [{ url: fbUrl, method: 'GET' }]
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify hata ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [];
  if (arr.length && arr[0] && arr[0].error && !arr[0].snapshot) {
    throw new Error('Apify: ' + arr[0].error);
  }
  const items = arr.filter(ad => ad && ad.snapshot).map(normalizeAd).map(enrich);
  items.sort((a, b) => b.winningScore - a.winningScore);
  return items;
}

async function runSearch(q = {}) {
  const source = q.source === 'live' ? 'live' : 'demo';
  const items = source === 'live' ? await searchLive(q) : searchDemo(q);
  const avgDays = items.length ? Math.round(items.reduce((s, p) => s + (p.daysActive || 0), 0) / items.length) : 0;
  const avgScore = items.length ? Math.round(items.reduce((s, p) => s + (p.winningScore || 0), 0) / items.length) : 0;
  return { source, count: items.length, avgDays, avgScore, items };
}

module.exports = { runSearch, searchDemo, searchLive, enrich, computeScore };

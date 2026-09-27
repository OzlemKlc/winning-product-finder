'use strict';

/**
 * Winning Score motoru — 100 puanlık, config-driven, ağırlıklı skorlama.
 *
 * Tasarım prensibi (bkz. ARCHITECTURE.md): Deterministik, açıklanabilir ve
 * saf (side-effect'siz) bir fonksiyon. LLM burada YOKTUR — bu, sayısal olarak
 * çözülebilen kısmın kasıtlı olarak model dışında tutulmasıdır. Bu ayrım hem
 * maliyeti düşürür hem de sonucu tekrar-üretilebilir kılar.
 *
 * Skor = Σ (normalize(sinyal) × ağırlık),  toplam ağırlık = 100.
 *   - longevity : reklam ne kadar süredir aktif (kanıtlanmış talep sinyali)
 *   - adScale   : aynı ürün için reklam/varyasyon sayısı (bütçe/ölçek sinyali)
 *   - rating    : ürün puanı (yalnızca ratingFloor üzerindeki kısım katkı verir)
 *   - freshness : reklamın hâlâ aktif olması (canlı talep sinyali)
 */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Ham sinyalleri 0..1 aralığına normalize eder.
 * @param {object} product
 * @param {object} caps  config.scoring.caps
 * @returns {{longevity:number, adScale:number, rating:number, freshness:number}}
 */
function normalizeSignals(product, caps) {
  const days = clamp(Number(product.daysActive) || 0, 0, caps.longevityDays);
  const ads = clamp(Number(product.adCount) || 0, 0, caps.adCount);
  const ratingRaw = clamp(Number(product.rating) || 0, 0, 5);

  // rating yalnızca ratingFloor (ör. 4.0) üzerindeyse ve 5'e kadar lineer katkı verir
  const ratingSpan = 5 - caps.ratingFloor;
  const rating =
    ratingSpan > 0 ? clamp((ratingRaw - caps.ratingFloor) / ratingSpan, 0, 1) : 0;

  return {
    longevity: days / caps.longevityDays,
    adScale: ads / caps.adCount,
    rating,
    freshness: product.isActive === false ? 0 : 1,
  };
}

/**
 * Ağırlıklı skoru (0..100 tamsayı) ve alt-kırılımı hesaplar.
 * @param {object} product
 * @param {object} scoringConfig  config.scoring ({ weights, caps })
 * @returns {{ score:number, breakdown:object }}
 */
function computeScore(product, scoringConfig) {
  const { weights, caps } = scoringConfig;
  const s = normalizeSignals(product, caps);

  const breakdown = {
    longevity: Math.round(s.longevity * weights.longevity),
    adScale: Math.round(s.adScale * weights.adScale),
    rating: Math.round(s.rating * weights.rating),
    freshness: Math.round(s.freshness * weights.freshness),
  };

  const score = clamp(
    breakdown.longevity + breakdown.adScale + breakdown.rating + breakdown.freshness,
    0,
    100
  );

  return { score, breakdown };
}

/**
 * Skoru insan-okur bir "tier"a çevirir (arayüzde rozet olarak kullanılır).
 */
function tierOf(score) {
  if (score >= 80) return '🔥 Çok Güçlü';
  if (score >= 60) return 'Güçlü';
  if (score >= 40) return 'Orta';
  return 'Zayıf';
}

/**
 * Toplam ağırlıkların 100 olduğunu doğrular (config sağlığı için).
 */
function weightsSumTo100(weights) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return sum === 100;
}

module.exports = { computeScore, normalizeSignals, tierOf, weightsSumTo100, clamp };

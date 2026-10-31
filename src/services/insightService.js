'use strict';

/**
 * Insight Service — LLM ile reklam metni analizi (tool/function-calling).
 *
 * Neden LLM burada? Skorlama deterministik/sayısaldır (domain/scoring). Ama reklam
 * metninden **niş, hook, açı (angle), hedef kitle, acı nokta** çıkarmak semantik
 * yorum gerektirir — projenin prensibi tam da budur: LLM'i yalnızca gerçekten
 * yorum gereken adımda kullan.
 *
 * Function-calling: Modelden serbest metin değil, tanımlı bir JSON şemasına uyan
 * **yapılandırılmış çıktı** isteriz (tool_choice ile o tool'a zorlanır). Böylece
 * sonuç programatik olarak güvenle kullanılabilir.
 */

const { config } = require('../config');
const { logger } = require('../utils/logger');
const { createResponse } = require('../providers/llm/openaiClient');

/**
 * Tool tanımı — modelin dolduracağı yapılandırılmış çıktının şeması.
 */
const AD_INSIGHT_TOOL = {
  type: 'function',
  name: 'record_ad_insight',
  description:
    'Bir e-ticaret reklamının metninden pazarlama içgörülerini yapılandırılmış olarak çıkar.',
  parameters: {
    type: 'object',
    properties: {
      niche: { type: 'string', description: 'Ürünün nişi/kategorisi (kısa)' },
      hook: { type: 'string', description: 'Reklamın dikkat çeken ana kancası (hook), tek cümle' },
      angle: {
        type: 'string',
        description: 'Pazarlama açısı',
        enum: ['problem-solution', 'social-proof', 'scarcity', 'curiosity', 'benefit', 'other'],
      },
      audience: { type: 'string', description: 'Hedef kitle (kısa)' },
      painPoint: { type: 'string', description: 'Ele alınan acı nokta / ihtiyaç (kısa)' },
      confidence: { type: 'number', description: '0..1 arası güven skoru' },
    },
    required: ['niche', 'hook', 'angle', 'confidence'],
    additionalProperties: false,
  },
};

const SYSTEM =
  'Sen bir performans pazarlama analistisin. Verilen reklam metnini analiz eder ve ' +
  'record_ad_insight tool\'unu çağırarak yapılandırılmış içgörü döndürürsün. Yalnızca tool çağır.';

/**
 * Tek bir ürünün reklam metnini analiz eder.
 * @param {object} product
 * @param {object} [deps]  { send } — test için enjekte edilebilir Messages fonksiyonu
 * @returns {Promise<object|null>} insight objesi ya da null
 */
async function analyzeProduct(product, deps = {}) {
  const send = deps.send || createResponse;
  const text = (product.adCopy || product.productName || '').slice(0, 1500);
  if (!text.trim()) return null;

  const response = await send({
    instructions: SYSTEM,
    input:
      `Ürün: ${product.productName}\nReklam metni: ${text}\n\n` +
      `Bu reklamı analiz et ve record_ad_insight fonksiyonunu çağır.`,
    tools: [AD_INSIGHT_TOOL],
    tool_choice: { type: 'function', name: AD_INSIGHT_TOOL.name },
    maxTokens: 512,
  });

  return parseInsight(response);
}

/**
 * OpenAI Responses yanıtından function_call argümanlarını çıkarır.
 * @param {object} response
 * @returns {object|null}
 */
function parseInsight(response) {
  const output = (response && response.output) || [];
  const call = output.find((item) => item.type === 'function_call' && item.name === AD_INSIGHT_TOOL.name);
  if (!call) return null;
  try {
    return typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
  } catch {
    return null;
  }
}

/**
 * En yüksek skorlu ilk N ürünü içgörülerle zenginleştirir (maliyet kontrolü).
 * Best-effort: bir ürün başarısız olursa diğerlerini düşürmez; hiç API yoksa no-op.
 * @param {object[]} items  skorlanmış, sıralı ürünler
 * @param {object} [opts]   { topN, deps }
 * @returns {Promise<object[]>} aynı liste; ilk N ürüne `insight` eklenmiş olabilir
 */
async function enrichWithInsights(items, opts = {}) {
  if (!config.llm.enabled) return items;
  const topN = opts.topN ?? config.llm.analyzeTopN;
  const targets = items.slice(0, topN);

  await Promise.all(
    targets.map(async (p) => {
      try {
        const insight = await analyzeProduct(p, opts.deps);
        if (insight) p.insight = insight;
      } catch (e) {
        logger.warn('insight.failed', { product: p.productName, error: e.message });
      }
    })
  );

  return items;
}

module.exports = { enrichWithInsights, analyzeProduct, parseInsight, AD_INSIGHT_TOOL };

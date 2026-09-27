'use strict';

/**
 * Insight service testleri — Anthropic çağrısı mock'lanır (ağ yok, anahtar gerekmez).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeProduct, parseInsight, enrichWithInsights, AD_INSIGHT_TOOL } = require('../src/services/insightService');
const { config } = require('../src/config');

// Sahte bir Anthropic tool_use yanıtı üretir
function fakeToolResponse(input) {
  return { content: [{ type: 'tool_use', name: AD_INSIGHT_TOOL.name, input }] };
}

test('tool şeması zorunlu alanları içerir', () => {
  assert.equal(AD_INSIGHT_TOOL.name, 'record_ad_insight');
  assert.deepEqual(AD_INSIGHT_TOOL.input_schema.required, ['niche', 'hook', 'angle', 'confidence']);
});

test('parseInsight tool_use girdisini çıkarır', () => {
  const r = fakeToolResponse({ niche: 'mutfak', hook: 'taze smoothie', angle: 'benefit', confidence: 0.9 });
  assert.deepEqual(parseInsight(r), { niche: 'mutfak', hook: 'taze smoothie', angle: 'benefit', confidence: 0.9 });
});

test('parseInsight tool yoksa null döner', () => {
  assert.equal(parseInsight({ content: [{ type: 'text', text: 'merhaba' }] }), null);
  assert.equal(parseInsight({}), null);
});

test('analyzeProduct enjekte edilen send ile yapılandırılmış içgörü döndürür', async () => {
  let captured;
  const send = async (payload) => {
    captured = payload;
    return fakeToolResponse({ niche: 'sağlık', hook: 'sırt ağrına son', angle: 'problem-solution', confidence: 0.8 });
  };
  const insight = await analyzeProduct(
    { productName: 'Duruş Düzeltici', adCopy: 'Gün boyu masada mı çalışıyorsun?' },
    { send }
  );
  assert.equal(insight.angle, 'problem-solution');
  // tool_choice ile ilgili tool'a zorlandığını doğrula
  assert.equal(captured.tool_choice.name, 'record_ad_insight');
  assert.equal(captured.tools[0].name, 'record_ad_insight');
});

test('analyzeProduct boş metinde null döner (gereksiz API çağrısı yok)', async () => {
  let called = false;
  const send = async () => { called = true; return fakeToolResponse({}); };
  const insight = await analyzeProduct({ productName: '', adCopy: '' }, { send });
  assert.equal(insight, null);
  assert.equal(called, false);
});

test('enrichWithInsights: LLM kapalıysa listeyi değiştirmez (no-op)', async () => {
  const original = config.llm.enabled;
  config.llm.enabled = false; // API anahtarı yokmuş gibi
  const items = [{ productName: 'X', adCopy: 'y' }];
  const out = await enrichWithInsights(items);
  assert.equal(out[0].insight, undefined);
  config.llm.enabled = original;
});

test('enrichWithInsights: açıkken yalnızca ilk N ürünü analiz eder', async () => {
  const original = config.llm.enabled;
  config.llm.enabled = true;
  const send = async () => fakeToolResponse({ niche: 'n', hook: 'h', angle: 'benefit', confidence: 1 });
  const items = Array.from({ length: 8 }, (_, i) => ({ productName: 'P' + i, adCopy: 'copy' }));
  const out = await enrichWithInsights(items, { topN: 3, deps: { send } });
  assert.equal(out.filter((p) => p.insight).length, 3);
  config.llm.enabled = original;
});

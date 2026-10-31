'use strict';

/**
 * Hook Radar + UGC brief birim testleri (node:test, bağımlılıksız).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectHooks, buildHookRadar, buildUgcBrief, firstSentence } = require('../src/domain/hooks');
const { enrich } = require('../src/domain/product');
const { config } = require('../src/config');
const demo = require('../data/demo-products.json');

test('firstSentence: ilk cümleyi noktalama dahil döndürür', () => {
  assert.equal(firstSentence('Her yerde taze smoothie! USB ile şarj olur.'), 'Her yerde taze smoothie!');
  assert.equal(firstSentence(''), '');
});

test('soru + acı nokta kalıbı (duruş düzeltici)', () => {
  const { patterns } = detectHooks(
    'Gün boyu masada mı çalışıyorsun? Bu duruş düzeltici ile sırt ağrına son ver.'
  );
  assert.ok(patterns.includes('question'));
  assert.ok(patterns.includes('pain'));
  assert.ok(patterns.includes('transformation'));
});

test('sayı / somut sonuç kalıbı', () => {
  assert.ok(detectHooks('Boyun ağrına 15 dakikada elveda.').patterns.includes('number'));
  assert.ok(detectHooks('Duvarına 120 inç görüntü yansıt.').patterns.includes('number'));
  assert.ok(!detectHooks('Cildini derinlemesine temizle.').patterns.includes('number'));
});

test('Türkçe yüzde yazımı (%100) ve İngilizce (100%) tanınır', () => {
  assert.ok(detectHooks('%100 ışık geçirmez uyku maskesi.').patterns.includes('number'));
  assert.ok(detectHooks('100% blackout sleep mask.').patterns.includes('number'));
});

test('UGC brief: problem sahnesi açılış cümlesini tekrar etmez', () => {
  const p = enrich(demo.find((d) => /Boyun/.test(d.productName)), config.scoring);
  const brief = buildUgcBrief(p);
  assert.notEqual(brief.shotList[1].say, brief.shotList[0].say);
});

test('Türkçe büyük harf (İ/I) doğru küçültülür', () => {
  assert.ok(detectHooks('İNANILMAZ! TAŞINABİLİR ve PRATİK.').patterns.includes('convenience'));
});

test('İngilizce reklam metni de tanınır', () => {
  const { patterns } = detectHooks('Tired of back pain? Say goodbye in 10 minutes a day.');
  assert.deepEqual(
    ['question', 'pain', 'transformation', 'number'].every((p) => patterns.includes(p)),
    true
  );
});

test('boş metin güvenli', () => {
  assert.deepEqual(detectHooks(''), { opener: '', patterns: [] });
  assert.deepEqual(detectHooks(undefined), { opener: '', patterns: [] });
});

test('buildHookRadar: ortalama skora göre sıralar, pay hesaplar', () => {
  const items = [
    { winningScore: 90, hooks: { patterns: ['pain', 'question'] } },
    { winningScore: 80, hooks: { patterns: ['pain'] } },
    { winningScore: 30, hooks: { patterns: ['question'] } },
    { winningScore: 50, hooks: { patterns: [] } },
  ];
  const radar = buildHookRadar(items);
  assert.equal(radar[0].id, 'pain');
  assert.equal(radar[0].count, 2);
  assert.equal(radar[0].avgScore, 85);
  assert.equal(radar[0].share, 50);
  assert.equal(radar[1].id, 'question');
  assert.equal(radar[1].avgScore, 60);
  assert.deepEqual(buildHookRadar([]), []);
});

test('buildHookRadar: tek ürünlük kalıp yüksek skorla bile en üste çıkmaz', () => {
  const items = [
    { winningScore: 99, hooks: { patterns: ['socialProof'] } },
    { winningScore: 70, hooks: { patterns: ['pain'] } },
    { winningScore: 60, hooks: { patterns: ['pain'] } },
  ];
  const radar = buildHookRadar(items);
  assert.equal(radar[0].id, 'pain');
  assert.equal(radar[0].lowSample, false);
  assert.equal(radar[1].id, 'socialProof');
  assert.equal(radar[1].lowSample, true);
});

test('buildUgcBrief: deterministik, 4 çekim, en fazla 3 hook seçeneği', () => {
  const p = enrich(demo[1], config.scoring);
  const a = buildUgcBrief(p);
  const b = buildUgcBrief(p);
  assert.deepEqual(a, b);
  assert.equal(a.shotList.length, 4);
  assert.ok(a.hookOptions.length >= 1 && a.hookOptions.length <= 3);
  assert.equal(a.hookOptions[0].type, 'original');
  assert.equal(a.signals.winningScore, p.winningScore);
});

test('demo verisinin tamamı en az bir hook kalıbı taşır', () => {
  for (const raw of demo) {
    const p = enrich(raw, config.scoring);
    assert.ok(p.hooks.patterns.length > 0, `${p.productName} için kalıp bulunamadı`);
  }
});

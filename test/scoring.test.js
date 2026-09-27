'use strict';

/**
 * Skorlama motoru birim testleri (node:test — yerleşik, bağımlılıksız).
 * Çalıştır:  npm test   (veya: node --test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeScore, tierOf, weightsSumTo100 } = require('../src/domain/scoring');
const { validateSearchQuery } = require('../src/validation/searchQuery');
const { config } = require('../src/config');

const scoring = config.scoring;

test('ağırlıklar toplamı 100', () => {
  assert.ok(weightsSumTo100(scoring.weights), 'skor ağırlıkları toplamı 100 olmalı');
});

test('boş/zayıf ürün düşük skor alır', () => {
  const { score } = computeScore(
    { daysActive: 0, adCount: 0, rating: 0, isActive: false },
    scoring
  );
  assert.equal(score, 0);
});

test('maks. sinyalli ürün tavana yakın skor alır', () => {
  const { score } = computeScore(
    { daysActive: 400, adCount: 100, rating: 5, isActive: true },
    scoring
  );
  assert.ok(score >= 95, `beklenen >=95, gelen ${score}`);
});

test('skor 0..100 aralığında sıkışır', () => {
  const { score } = computeScore(
    { daysActive: 99999, adCount: 99999, rating: 9, isActive: true },
    scoring
  );
  assert.ok(score >= 0 && score <= 100);
});

test('ratingFloor altındaki puan rating katkısını sıfırlar', () => {
  const low = computeScore({ daysActive: 0, adCount: 0, rating: 3.9, isActive: false }, scoring);
  assert.equal(low.breakdown.rating, 0);
});

test('kırılım toplamı skora eşit', () => {
  const { score, breakdown } = computeScore(
    { daysActive: 180, adCount: 30, rating: 4.5, isActive: true },
    scoring
  );
  const sum = breakdown.longevity + breakdown.adScale + breakdown.rating + breakdown.freshness;
  assert.equal(sum, score);
});

test('tier eşikleri doğru', () => {
  assert.equal(tierOf(85), '🔥 Çok Güçlü');
  assert.equal(tierOf(65), 'Güçlü');
  assert.equal(tierOf(45), 'Orta');
  assert.equal(tierOf(10), 'Zayıf');
});

test('doğrulama: geçersiz kaynak demo\'ya düşer, sınırlar uygulanır', () => {
  const q = validateSearchQuery({ source: 'hack', minDays: -5, sort: 'evil', keyword: '  led  ' });
  assert.equal(q.source, 'demo');
  assert.equal(q.minDays, 0);
  assert.equal(q.sort, 'winningScore');
  assert.equal(q.keyword, 'led');
});

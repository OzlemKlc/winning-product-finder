'use strict';

/**
 * Vercel serverless adaptörü — POST /api/search
 *
 * Yerel sunucu ile AYNI servis/domain katmanını kullanır (kod tekrarı yok).
 * Serverless ortamında kalıcılık (persist) varsayılan olarak kapalıdır; soğuk
 * başlangıçlarda bağlantı açmamak için. DB'ye yazmak istenirse `persist:true` verilir.
 */

const { runSearch } = require('../src/services/searchService');
const { AppError } = require('../src/utils/errors');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Sadece POST' }));
  }

  try {
    let q = req.body;
    if (q == null || typeof q === 'string') {
      let raw = typeof q === 'string' ? q : '';
      if (!raw) for await (const chunk of req) raw += chunk;
      q = raw ? JSON.parse(raw) : {};
    }

    const out = await runSearch(q, { persist: false });
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    if (e instanceof AppError) {
      res.statusCode = e.status;
      return res.end(JSON.stringify(e.toJSON()));
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Beklenmeyen bir hata oluştu.' }));
  }
};

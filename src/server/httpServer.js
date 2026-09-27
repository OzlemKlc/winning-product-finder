'use strict';

/**
 * HTTP sunucusu (bağımlılıksız `http` çekirdeği).
 *
 * Sorumluluk: request'i parse et, route'la, controller çağır, JSON yaz.
 * İş mantığı burada YOKTUR — sadece transport. Aynı controller'lar Vercel
 * fonksiyonu tarafından da kullanılır (api/search.js).
 */

const http = require('http');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { serveStatic } = require('./staticServer');
const { handleSearch, handleRecent } = require('./controllers/searchController');

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > maxBytes) {
        reject(new Error('İstek gövdesi çok büyük.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function requestHandler(req, res) {
  const url = req.url || '/';

  // Health check (container/orchestrator probe'ları için)
  if (url === '/health' || url === '/healthz') {
    return sendJSON(res, 200, { ok: true, env: config.env, ts: Date.now() });
  }

  // POST /api/search
  if (url.startsWith('/api/search') && req.method === 'POST') {
    let parsed = {};
    try {
      const raw = await readBody(req, config.server.maxBodyBytes);
      parsed = raw ? JSON.parse(raw) : {};
    } catch (e) {
      return sendJSON(res, 400, { error: 'Geçersiz JSON gövde.' });
    }
    const { status, body } = await handleSearch(parsed);
    return sendJSON(res, status, body);
  }

  // GET /api/searches — son aramalar
  if (url.startsWith('/api/searches') && req.method === 'GET') {
    const limit = Number(new URL(url, 'http://x').searchParams.get('limit')) || 20;
    const { status, body } = await handleRecent(limit);
    return sendJSON(res, status, body);
  }

  // Statik dosyalar
  return serveStatic(req, res);
}

function createServer() {
  return http.createServer((req, res) => {
    requestHandler(req, res).catch((e) => {
      logger.error('server.unhandled', { msg: e.message });
      if (!res.headersSent) sendJSON(res, 500, { error: 'Sunucu hatası.' });
    });
  });
}

function start() {
  const server = createServer();
  server.listen(config.server.port, config.server.host, () => {
    logger.info('server.listening', {
      port: config.server.port,
      env: config.env,
      apify: config.apify.isConfigured ? 'configured' : 'demo-only',
      db: config.database.isConfigured ? 'postgres' : 'memory',
    });
    // İnsan-okur başlangıç mesajı
    console.log('\n  🏆 Winning Product Finder hazır!');
    console.log('  👉 Tarayıcıda aç:  http://localhost:' + config.server.port + '\n');
  });
  return server;
}

module.exports = { createServer, start, requestHandler };

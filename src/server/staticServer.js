'use strict';

/**
 * Güvenli statik dosya sunumu (public/).
 * Path traversal koruması: çözümlenen yol her zaman publicDir içinde kalmalı.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(config.publicDir, path.normalize(urlPath).replace(/^([/\\])+/, ''));

  // Traversal koruması
  if (!filePath.startsWith(config.publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Bulunamadı');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

module.exports = { serveStatic, MIME };

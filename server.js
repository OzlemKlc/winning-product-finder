/**
 * Winning Product Finder — yerel geliştirme sunucusu (sıfır bağımlılık)
 * Çalıştır: node server.js   →   http://localhost:4545
 * (Vercel'de bunun yerine api/search.js serverless fonksiyonu kullanılır.)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// .env dosyasını yükle (varsa) — APIFY_TOKEN, PORT vb.
try {
  const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envText.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
} catch (e) { /* .env yoksa sorun değil */ }

const { runSearch } = require('./lib/finder');

const PORT = process.env.PORT || 4545;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Bulunamadı'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') return sendJSON(res, 200, { ok: true, ts: Date.now() });

  if (req.url === '/api/search' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let q = {};
      try { q = body ? JSON.parse(body) : {}; } catch (e) { return sendJSON(res, 400, { error: 'Geçersiz JSON' }); }
      try { sendJSON(res, 200, await runSearch(q)); }
      catch (e) { sendJSON(res, 502, { error: e.message, hint: 'Canlı mod başarısızsa Demo moduna geç.' }); }
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('\n  🏆 Winning Product Finder hazır!');
  console.log('  👉 Tarayıcıda aç:  http://localhost:' + PORT + '\n');
});

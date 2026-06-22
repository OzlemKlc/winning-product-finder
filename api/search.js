// Vercel serverless fonksiyonu — POST /api/search
// Yerel sunucu ile aynı çekirdek mantığı (lib/finder) kullanır.
const { runSearch } = require('../lib/finder');

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
      if (!raw) { for await (const chunk of req) raw += chunk; }
      q = raw ? JSON.parse(raw) : {};
    }
    const out = await runSearch(q);
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message, hint: 'Canlı mod başarısızsa Demo moduna geç.' }));
  }
};

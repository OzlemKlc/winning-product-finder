// Winning Product Finder — frontend
const $ = (s) => document.querySelector(s);
const state = { source: 'demo', view: 'cards', items: [], analyze: false };

const NICHE_EMOJI = {
  'Mutfak': '🍹', 'Sağlık': '💆', 'Ev Dekor': '💡', 'Elektronik': '📽️',
  'Evcil Hayvan': '🐾', 'Fitness': '💧', 'Otomotiv': '🚗', 'Güzellik': '🧖',
  'Oyuncak': '🖍️', 'Ev': '🧼', 'Hobi': '🧵', 'Canlı': '📡', 'Trend': '🔥'
};

const PRODUCT_EMOJI = {
  'Taşınabilir Mini Blender': '🥤', 'Duruş Düzeltici Korse': '🧍', 'RGB LED Şerit Işık (5m)': '🌈',
  'Mini Taşınabilir Projektör': '📽️', 'Akıllı Boyun Masaj Aleti': '💆', 'Evcil Hayvan Tüy Toplayıcı': '🐾',
  'Akıllı Su Şişesi (LED Hatırlatıcı)': '💧', 'Manyetik Araç Telefon Tutucu': '🧲', 'Yüz Temizleme Fırçası': '🧖',
  'Çocuk LCD Çizim Tableti': '🖍️', 'Otomatik Sensörlü Sabunluk': '🧼', 'Mini El Dikiş Makinesi': '🧵',
  'Akıllı Uyku Maskesi (Bluetooth)': '😴', 'Taşınabilir Espresso Makinesi': '☕'
};

const NICHE_GRADIENT = {
  'Mutfak': 'linear-gradient(135deg,#f0883e,#d9480f)', 'Sağlık': 'linear-gradient(135deg,#3bc9a0,#0c8068)',
  'Ev Dekor': 'linear-gradient(135deg,#b45cff,#6d5efc)', 'Elektronik': 'linear-gradient(135deg,#4dabf7,#1864ab)',
  'Evcil Hayvan': 'linear-gradient(135deg,#ffa94d,#e8590c)', 'Fitness': 'linear-gradient(135deg,#3bc9db,#0b7285)',
  'Otomotiv': 'linear-gradient(135deg,#748ffc,#364fc7)', 'Güzellik': 'linear-gradient(135deg,#ff8cc3,#c2255c)',
  'Oyuncak': 'linear-gradient(135deg,#ffd43b,#f08c00)', 'Ev': 'linear-gradient(135deg,#63e6be,#099268)',
  'Hobi': 'linear-gradient(135deg,#da77f2,#9c36b5)', 'Canlı': 'linear-gradient(135deg,#6d5efc,#b45cff)',
  'Trend': 'linear-gradient(135deg,#6d5efc,#ff5c9d)'
};

function emojiFor(p) { return PRODUCT_EMOJI[p.productName] || NICHE_EMOJI[p.niche] || '🛍️'; }

// Demo verisindeki sahte landing URL'leri yerine GERÇEK Meta Reklam Kütüphanesi araması
function adLink(p) {
  if (p.landingUrl && !/example\.com/i.test(p.landingUrl)) return p.landingUrl;
  let term = p.productName;
  if (p.amazonUrl && p.amazonUrl.includes('k=')) term = decodeURIComponent((p.amazonUrl.split('k=')[1] || '')).replace(/\+/g, ' ');
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&media_type=all&q=${encodeURIComponent(term)}&search_type=keyword_unordered&source=fb-logo`;
}

function fmtPrice(p, c) {
  if (p == null || isNaN(p)) return '—';
  const sym = c === 'USD' ? '$' : (c || '');
  return sym + Number(p).toFixed(2);
}
function stars(r) {
  if (r == null) return '<span class="stars">—</span>';
  const full = Math.round(r);
  return `<span class="stars">${'★'.repeat(full)}${'☆'.repeat(5 - full)}<span>${r.toFixed(1)}</span></span>`;
}
function scoreClass(s) { return s >= 80 ? 's-hot' : s >= 60 ? 's-strong' : ''; }

function thumb(p) {
  const emoji = emojiFor(p);
  const grad = NICHE_GRADIENT[p.niche] || 'linear-gradient(135deg,#232c45,#161d2e)';
  // Canlı modda gerçek reklam kreatifi; demo modda kategoriye özel markalı görsel kutusu
  if (state.source === 'live' && p.image) {
    return `<img src="${p.image}" alt="" loading="lazy"
      onerror="this.outerHTML='<div class=\\'ph\\' style=\\'background:${grad}\\'><span class=\\'ph-emoji\\'>${emoji}</span></div>'" />`;
  }
  return `<div class="ph" style="background:${grad}"><span class="ph-emoji">${emoji}</span><span class="ph-name">${esc(p.productName)}</span></div>`;
}

function cardHTML(p, i) {
  return `<article class="card">
    <div class="thumb">
      ${thumb(p)}
      <span class="score-badge ${scoreClass(p.winningScore)}">${p.tier} · ${p.winningScore}</span>
      <span class="creative-tag">${p.creativeType === 'video' ? '🎬 Video' : '🖼️ Görsel'}</span>
    </div>
    <div class="body">
      <h3>${esc(p.productName)}</h3>
      <div class="row-meta">
        <span class="chip niche">${NICHE_EMOJI[p.niche] || ''} ${esc(p.niche)}</span>
        <span class="advertiser">👤 <b>${esc(p.advertiser)}</b></span>
      </div>
      <p class="adcopy">${esc(p.adCopy || '')}</p>
      ${p.insight ? `<div class="insight">🧠 <b>${esc(p.insight.hook || '')}</b>${p.insight.angle ? ` <span class="chip angle">${esc(p.insight.angle)}</span>` : ''}${p.insight.audience ? `<span class="aud">👥 ${esc(p.insight.audience)}</span>` : ''}</div>` : ''}
      <div class="metrics">
        <div class="metric"><div class="v days">${p.daysActive}g</div><div class="k">Aktif süre</div></div>
        <div class="metric"><div class="v">${p.adCount}</div><div class="k">Reklam</div></div>
        <div class="metric"><div class="v">${p.estPrice != null ? fmtPrice(p.estPrice, p.currency) : '—'}</div><div class="k">Fiyat</div></div>
      </div>
      <div class="price-row">
        ${stars(p.rating)}
        ${p.amazonPrice != null ? `<span class="muted" style="font-size:12px">Amazon: <b style="color:#ffd479">${fmtPrice(p.amazonPrice, p.currency)}</b></span>` : ''}
      </div>
      <div class="actions">
        <a href="${adLink(p)}" target="_blank" rel="noopener">📚 Meta Reklamları</a>
        ${p.amazonUrl ? `<a class="amazon" href="${p.amazonUrl}" target="_blank" rel="noopener">🛒 Amazon</a>` : ''}
      </div>
    </div>
  </article>`;
}

function rowHTML(p, i) {
  return `<tr>
    <td>${i + 1}</td>
    <td><div class="prodcell"><span class="prod-emoji" style="background:${NICHE_GRADIENT[p.niche] || '#232c45'}">${emojiFor(p)}</span><span>${esc(p.productName)}</span></div></td>
    <td><span class="chip niche">${esc(p.niche)}</span></td>
    <td>${esc(p.advertiser)}</td>
    <td><b style="color:#2dd4a7">${p.daysActive}g</b></td>
    <td>${p.adCount}</td>
    <td>${p.estPrice != null ? fmtPrice(p.estPrice, p.currency) : '—'}</td>
    <td>${p.rating != null ? p.rating.toFixed(1) + ' ★' : '—'}</td>
    <td><span class="mini-score" style="color:${p.winningScore >= 80 ? '#ff5c9d' : p.winningScore >= 60 ? '#2dd4a7' : '#8a96ad'}">${p.winningScore}</span></td>
    <td><a href="${adLink(p)}" target="_blank">Meta</a>${p.amazonUrl ? ` · <a href="${p.amazonUrl}" target="_blank">Amazon</a>` : ''}</td>
  </tr>`;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function render(data) {
  state.items = data.items || [];
  // niche dropdown (demo)
  const niches = [...new Set(state.items.map(p => p.niche))];
  const sel = $('#niche'); const cur = sel.value;
  if (state.source === 'demo') {
    sel.innerHTML = '<option value="all">Tümü</option>' + niches.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sel.value = cur && niches.includes(cur) ? cur : 'all';
  }

  // stats
  $('#stats').innerHTML = `
    <div class="stat"><div class="num grad">${data.count}</div><div class="lbl">Bulunan ürün</div></div>
    <div class="stat"><div class="num">${data.avgDays}g</div><div class="lbl">Ort. aktif süre</div></div>
    <div class="stat"><div class="num">${data.avgScore}</div><div class="lbl">Ort. kazanan skoru</div></div>
    <div class="stat"><div class="num">${state.items.filter(p => p.winningScore >= 80).length}</div><div class="lbl">🔥 Çok güçlü ürün</div></div>`;

  $('#footCount').textContent = data.count;
  $('#empty').style.display = data.count ? 'none' : 'block';

  $('#cards').innerHTML = state.items.map(cardHTML).join('');
  $('#table tbody').innerHTML = state.items.map(rowHTML).join('');
  applyView();
}

function applyView() {
  $('#cards').style.display = state.view === 'cards' ? 'grid' : 'none';
  $('#tableWrap').style.display = state.view === 'table' ? 'block' : 'none';
}

async function search() {
  const body = {
    source: state.source,
    keyword: $('#keyword').value.trim(),
    niche: $('#niche').value,
    minDays: Number($('#minDays').value) || 0,
    sort: $('#sort').value,
    token: $('#apifyToken') ? $('#apifyToken').value.trim() : '',
    analyze: state.analyze
  };
  $('#loading').style.display = 'block';
  $('#cards').innerHTML = ''; $('#table tbody').innerHTML = ''; $('#empty').style.display = 'none';
  try {
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Hata');
    // client-side sort
    const key = body.sort;
    data.items.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    render(data);
  } catch (e) {
    $('#stats').innerHTML = '';
    $('#empty').style.display = 'block';
    $('#empty').innerHTML = `<p>⚠️ ${esc(e.message)}</p><p class="muted">Canlı mod başarısızsa Demo moduna geçip tekrar dene.</p>`;
  } finally {
    $('#loading').style.display = 'none';
  }
}

function exportCSV() {
  if (!state.items.length) return alert('Önce arama yap.');
  const cols = ['productName', 'niche', 'advertiser', 'daysActive', 'adCount', 'estPrice', 'currency', 'rating', 'winningScore', 'tier', 'landingUrl', 'amazonUrl'];
  const head = ['Ürün', 'Kategori', 'Advertiser', 'AktifGün', 'ReklamSayısı', 'Fiyat', 'ParaBirimi', 'Puan', 'KazananSkoru', 'Seviye', 'ReklamLink', 'AmazonLink'];
  const esc2 = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = state.items.map(p => cols.map(c => esc2(p[c])).join(','));
  const csv = '﻿' + head.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `winning-products-${Date.now()}.csv`;
  a.click();
}

// --- events ---
$('#searchBtn').addEventListener('click', search);
$('#keyword').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
$('#sort').addEventListener('change', search);
$('#exportBtn').addEventListener('click', exportCSV);

document.querySelectorAll('.seg-btn[data-source]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-source]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.source = b.dataset.source;
  const live = state.source === 'live';
  $('#tokenField').style.display = live ? 'flex' : 'none';
  $('#modePill').classList.toggle('live', live);
  $('#modeLabel').textContent = live ? 'Canlı mod (Apify)' : 'Demo modu';
}));

document.querySelectorAll('.seg-btn[data-view]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-view]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.view = b.dataset.view;
  applyView();
}));

const aiEl = document.getElementById('aiAnalyze');
if (aiEl) aiEl.addEventListener('change', () => { state.analyze = aiEl.checked; });

// initial load
search();

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
      <span class="creative-tag">${p.creativeType === 'video' ? '🎬 Video' : '🖼️ Image'}</span>
    </div>
    <div class="body">
      <h3>${esc(p.productName)}</h3>
      <div class="row-meta">
        <span class="chip niche">${NICHE_EMOJI[p.niche] || ''} ${esc(p.niche)}</span>
        <span class="advertiser">👤 <b>${esc(p.advertiser)}</b></span>
      </div>
      <p class="adcopy">${esc(p.adCopy || '')}</p>
      ${hookChips(p)}
      ${p.insight ? `<div class="insight">🧠 <b>${esc(p.insight.hook || '')}</b>${p.insight.angle ? ` <span class="chip angle">${esc(p.insight.angle)}</span>` : ''}${p.insight.audience ? `<span class="aud">👥 ${esc(p.insight.audience)}</span>` : ''}</div>` : ''}
      <div class="metrics">
        <div class="metric"><div class="v days">${p.daysActive}d</div><div class="k">Active</div></div>
        <div class="metric"><div class="v">${p.adCount}</div><div class="k">Ads</div></div>
        <div class="metric"><div class="v">${p.estPrice != null ? fmtPrice(p.estPrice, p.currency) : '—'}</div><div class="k">Price</div></div>
      </div>
      <div class="price-row">
        ${stars(p.rating)}
        ${p.amazonPrice != null ? `<span class="muted" style="font-size:12px">Amazon: <b style="color:#ffd479">${fmtPrice(p.amazonPrice, p.currency)}</b></span>` : ''}
      </div>
      <div class="actions">
        <a href="${adLink(p)}" target="_blank" rel="noopener">📚 Meta Ads</a>
        ${p.amazonUrl ? `<a class="amazon" href="${p.amazonUrl}" target="_blank" rel="noopener">🛒 Amazon</a>` : ''}
        ${p.ugcBrief ? `<button type="button" class="brief-btn" data-brief="${i}">🎬 UGC Brief</button>` : ''}
      </div>
    </div>
  </article>`;
}

// --- Hook Radar + UGC brief ---
const HOOK_LABEL = {
  question: 'Question', pain: 'Pain point', transformation: 'Transformation', number: 'Number',
  convenience: 'Convenience', audience: 'Audience', socialProof: 'Social proof',
  urgency: 'Urgency', exclamation: 'Exclamation'
};

function hookChips(p) {
  const pats = (p.hooks && p.hooks.patterns) || [];
  if (!pats.length) return '';
  return `<div class="hook-chips" title="Hook Radar: patterns detected in ad copy">🪝 ${pats
    .map(id => `<span class="chip hook">${esc(HOOK_LABEL[id] || id)}</span>`).join('')}</div>`;
}

function renderHookRadar(radar) {
  const el = $('#hookRadar');
  if (!el) return;
  if (!radar || !radar.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const max = Math.max(...radar.map(r => r.avgScore), 1);
  el.style.display = 'block';
  el.innerHTML = `
    <div class="radar-head"><b>🪝 Hook Radar</b><span class="muted">Which hook patterns stand out in stronger ads? Ranked by average winning score.</span></div>
    <div class="radar-rows">${radar.map(r => `
      <div class="radar-row${r.lowSample ? ' low' : ''}" ${r.lowSample ? 'title="Observed in one product — insufficient sample"' : ''}>
        <span class="radar-label">${esc(r.label)}</span>
        <span class="radar-bar"><span style="width:${Math.round((r.avgScore / max) * 100)}%"></span></span>
        <span class="radar-val"><b>${r.avgScore}</b> score · ${r.count} products (${r.share}%)${r.lowSample ? ' · low sample' : ''}</span>
      </div>`).join('')}
    </div>`;
}

function briefText(b) {
  return [
    `UGC BRIEF — ${b.product} (${b.format})`,
    `Proven angles: ${b.provenAngles.join(', ') || '—'}`,
    '', 'Hook options:', ...b.hookOptions.map((h, i) => `${i + 1}. ${h.text}`),
    '', 'Shot plan:', ...b.shotList.map(s => `[${s.t}] ${s.shot} → "${s.say}"`),
    '', `Signals: score ${b.signals.winningScore}, ${b.signals.daysActive} active days, ${b.signals.adCount} ads`
  ].join('\n');
}

function openBrief(i) {
  const p = state.items[i];
  if (!p || !p.ugcBrief) return;
  const b = p.ugcBrief;
  const dlg = $('#briefDialog');
  $('#briefBody').innerHTML = `
    <h3>🎬 ${esc(b.product)} <span class="muted">· ${esc(b.format)}</span></h3>
    <div class="brief-angles"><span class="muted">Proven angles:</span> ${b.provenAngles.map(a => `<span class="chip hook">${esc(a)}</span>`).join('') || '—'}</div>
    <h4>Hook options</h4>
    <ol>${b.hookOptions.map(h => `<li>${esc(h.text)}</li>`).join('')}</ol>
    <h4>Shot plan</h4>
    <table class="brief-table"><tbody>${b.shotList.map(s => `<tr><td><b>${esc(s.t)}</b></td><td>${esc(s.shot)}</td><td>“${esc(s.say)}”</td></tr>`).join('')}</tbody></table>`;
  $('#briefCopy').onclick = () => {
    navigator.clipboard.writeText(briefText(b)).then(() => { $('#briefCopy').textContent = '✓ Copied'; setTimeout(() => { $('#briefCopy').textContent = '📋 Copy'; }, 1500); });
  };
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.brief-btn');
  if (btn) openBrief(Number(btn.dataset.brief));
});

function rowHTML(p, i) {
  return `<tr>
    <td>${i + 1}</td>
    <td><div class="prodcell"><span class="prod-emoji" style="background:${NICHE_GRADIENT[p.niche] || '#232c45'}">${emojiFor(p)}</span><span>${esc(p.productName)}</span></div></td>
    <td><span class="chip niche">${esc(p.niche)}</span></td>
    <td>${esc(p.advertiser)}</td>
    <td><b style="color:#2dd4a7">${p.daysActive}d</b></td>
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
    sel.innerHTML = '<option value="all">All</option>' + niches.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sel.value = cur && niches.includes(cur) ? cur : 'all';
  }

  // stats
  $('#stats').innerHTML = `
    <div class="stat"><div class="num grad">${data.count}</div><div class="lbl">Products found</div></div>
    <div class="stat"><div class="num">${data.avgDays}d</div><div class="lbl">Avg. active days</div></div>
    <div class="stat"><div class="num">${data.avgScore}</div><div class="lbl">Avg. winning score</div></div>
    <div class="stat"><div class="num">${state.items.filter(p => p.winningScore >= 80).length}</div><div class="lbl">🔥 Very strong</div></div>`;

  renderHookRadar(data.hookRadar);

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
    if (!res.ok) throw new Error(data.error || 'Error');
    // Sunucu zaten `sort` anahtarına göre sıralı döndürür; burada yeniden sıralamak
    // kart index'leri ile UGC brif butonlarının eşleşmesini bozmaz (stabil sıralama).
    const key = body.sort;
    data.items.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    render(data);
  } catch (e) {
    $('#stats').innerHTML = '';
    $('#empty').style.display = 'block';
    $('#empty').innerHTML = `<p>⚠️ ${esc(e.message)}</p><p class="muted">If live mode fails, switch to demo mode and try again.</p>`;
  } finally {
    $('#loading').style.display = 'none';
  }
}

function exportCSV() {
  if (!state.items.length) return alert('Run a search first.');
  const cols = ['productName', 'niche', 'advertiser', 'daysActive', 'adCount', 'estPrice', 'currency', 'rating', 'winningScore', 'tier', 'hookPatterns', 'landingUrl', 'amazonUrl'];
  const head = ['Product', 'Category', 'Advertiser', 'ActiveDays', 'AdCount', 'Price', 'Currency', 'Rating', 'WinningScore', 'Tier', 'HookPatterns', 'AdLink', 'AmazonLink'];
  const esc2 = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const val = (p, c) => c === 'hookPatterns' ? ((p.hooks && p.hooks.patterns) || []).map(id => HOOK_LABEL[id] || id).join(' | ') : p[c];
  const rows = state.items.map(p => cols.map(c => esc2(val(p, c))).join(','));
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
  $('#modeLabel').textContent = live ? 'Live mode (Apify)' : 'Demo mode';
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

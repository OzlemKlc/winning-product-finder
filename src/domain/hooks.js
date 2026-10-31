'use strict';

/**
 * Hook Radar — reklam metnindeki "kanca" (hook) kalıplarını deterministik olarak çıkarır.
 *
 * Neden LLM değil? Skorlamadaki prensip burada da geçerli: kural ile çözülebilen
 * kısım modele gitmez. Bu modül ücretsiz, offline ve tekrar-üretilebilir; demo
 * modunda da çalışır. LLM tabanlı insightService ise isteğe bağlı derin yorum için kalır.
 *
 * Çıktı iki seviyededir:
 *   - detectHooks(adCopy)      → tek reklamdaki kalıplar
 *   - buildHookRadar(items)    → tüm sonuçlarda hangi kalıpların "kazandığı"
 * Ve AdForge (UGC) köprüsü:
 *   - buildUgcBrief(product)   → 15 sn'lik UGC video brifi (hook seçenekleri + çekim planı)
 */

/** Türkçe-duyarlı küçük harf (İ/ı sorununu çözer). */
const lower = (s) => String(s || '').toLocaleLowerCase('tr-TR');

/** Metnin ilk cümlesi (hook genelde buradadır). */
function firstSentence(text) {
  const t = String(text || '').trim();
  const m = t.match(/^[^.!?]*[.!?]?/);
  return (m ? m[0] : t).trim();
}

/**
 * Kalıp tanımları. Her biri: id, etiket (TR), test fonksiyonu.
 * Sıra = UI'da gösterim önceliği.
 */
const HOOK_PATTERNS = [
  {
    id: 'question',
    label: 'Soru ile açılış',
    test: (t, first) => /\?/.test(first),
  },
  {
    id: 'pain',
    label: 'Acı nokta / problem',
    test: (t) =>
      /(ağrı|ağrın|kabus|unutuyor|israf|derdi|sorun|yoruldun|bıktın|zor|pain|tired of|struggl|annoying)/.test(t),
  },
  {
    id: 'transformation',
    label: 'Dönüşüm / iddia',
    test: (t) =>
      /(son ver|elveda|devrim|kurtarıcı|vazgeçilmez|bir numara|hiç olmadığı kadar|game[- ]?changer|life[- ]?changing|must[- ]have|say goodbye)/.test(t),
  },
  {
    id: 'number',
    label: 'Sayı / somut sonuç',
    // Türkçede yüzde işareti sayıdan önce yazılır ("%100"); İngilizcede sonra ("100%").
    test: (t) =>
      /%\s*\d+/.test(t) ||
      /\d+\s*(dakika|dk|saniye|sn|saat|gün|inç|cm|kg|milyon|bin|%|x|minutes?|seconds?|hours?|days?|inch)/.test(t),
  },
  {
    id: 'convenience',
    label: 'Kolaylık / taşınabilirlik',
    test: (t) =>
      /(taşınabilir|her yerde|çantana|avuç|tek hareket|tek elle|tek tuş|anında|dokunmadan|kolay|pratik|portable|anywhere|one[- ]click|instantly|easy)/.test(t),
  },
  {
    id: 'audience',
    label: 'Hedef kitleye seslenme',
    test: (t) =>
      /(için ideal|için bir numara|çalışanların|favorisi|gamer|ebeveyn|anneler|öğrenci|kampçı|for (moms|gamers|parents|busy|pet owners))/.test(t),
  },
  {
    id: 'socialProof',
    label: 'Sosyal kanıt',
    test: (t) =>
      /(favorisi|en çok satan|binlerce|herkes|viral|trend|best[- ]?seller|thousands|everyone|reviews?|5 yıldız)/.test(t),
  },
  {
    id: 'urgency',
    label: 'Aciliyet / kıtlık',
    test: (t) => /(sınırlı|bugün|son \d|stoklar|kaçırma|hemen|limited|today only|hurry|last chance)/.test(t),
  },
  {
    id: 'exclamation',
    label: 'Ünlemli güçlü açılış',
    test: (t, first) => /!$/.test(first),
  },
];

const PATTERN_BY_ID = Object.fromEntries(HOOK_PATTERNS.map((p) => [p.id, p]));

/**
 * Tek reklam metnindeki hook kalıplarını bulur.
 * @param {string} adCopy
 * @returns {{ opener:string, patterns:string[] }}
 */
function detectHooks(adCopy) {
  const opener = firstSentence(adCopy);
  if (!opener) return { opener: '', patterns: [] };
  const t = lower(adCopy);
  const first = opener.trim();
  const patterns = HOOK_PATTERNS.filter((p) => p.test(t, first)).map((p) => p.id);
  return { opener, patterns };
}

/**
 * Tüm sonuçlar üzerinden "hangi hook kalıpları kazanıyor" özetini çıkarır.
 * Her kalıp için: kaç üründe görüldüğü, pay ve o ürünlerin ortalama kazanan skoru.
 * Ortalama skora göre sıralanır (sadece sıklığa göre değil — amaç kazananı bulmak).
 * Ancak tek üründe görülen kalıplar (minCount altı) en alta itilir ve `lowSample`
 * ile işaretlenir: tek bir yüksek skorlu ürün bir kalıbı "kazanan" gibi göstermesin.
 * @param {Array<{hooks?:{patterns:string[]}, winningScore?:number}>} items
 * @returns {Array<{id:string,label:string,count:number,share:number,avgScore:number}>}
 */
function buildHookRadar(items = [], { minCount = 2 } = {}) {
  const total = items.length;
  if (!total) return [];
  const acc = {};
  for (const it of items) {
    const pats = (it.hooks && it.hooks.patterns) || [];
    for (const id of pats) {
      acc[id] = acc[id] || { count: 0, scoreSum: 0 };
      acc[id].count += 1;
      acc[id].scoreSum += Number(it.winningScore) || 0;
    }
  }
  return Object.entries(acc)
    .map(([id, v]) => ({
      id,
      label: PATTERN_BY_ID[id] ? PATTERN_BY_ID[id].label : id,
      count: v.count,
      share: Math.round((v.count / total) * 100),
      avgScore: Math.round(v.scoreSum / v.count),
      lowSample: v.count < minCount,
    }))
    .sort(
      (a, b) =>
        Number(a.lowSample) - Number(b.lowSample) ||
        b.avgScore - a.avgScore ||
        b.count - a.count ||
        a.id.localeCompare(b.id)
    );
}

/**
 * Ürün için 15 saniyelik UGC video brifi (AdForge girdisi olarak kullanılabilir).
 * Tamamen deterministik: aynı ürün → aynı brif.
 * @param {object} product  skorlanmış + hooks eklenmiş ürün
 * @returns {object} brief
 */
function buildUgcBrief(product) {
  const name = product.productName || 'Ürün';
  const { opener, patterns } = product.hooks || detectHooks(product.adCopy);
  const sentences = String(product.adCopy || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rest = sentences.filter((s) => s !== opener);
  const benefit = rest[0] || name;
  // Problem sahnesi açılışı tekrar etmesin: açılış dışındaki acı-nokta cümlesi, yoksa jenerik.
  const painLine =
    rest.find((s) => PATTERN_BY_ID.pain.test(lower(s), s)) ||
    (patterns.includes('pain') && !patterns.includes('question') ? 'Önceden her gün bununla uğraşıyordum…' : 'Önceden şöyleydi…');

  const hookOptions = [];
  if (opener) hookOptions.push({ type: 'original', text: opener });
  if (!patterns.includes('question')) {
    hookOptions.push({ type: 'question', text: `${name} gerçekten işe yarıyor mu? Denedim.` });
  }
  if (!patterns.includes('pain')) {
    hookOptions.push({ type: 'pain', text: `Bunu bilmeden ${lower(name)} almayın.` });
  }
  hookOptions.push({ type: 'pov', text: `POV: ${name} hayatıma girdi ve…` });

  return {
    product: name,
    format: 'UGC · 9:16 · 15 sn',
    provenAngles: patterns.map((id) => (PATTERN_BY_ID[id] ? PATTERN_BY_ID[id].label : id)),
    hookOptions: hookOptions.slice(0, 3),
    shotList: [
      { t: '0–3 sn', shot: 'Yüz kameraya, ürün elde', say: hookOptions[0] ? hookOptions[0].text : name },
      { t: '3–7 sn', shot: 'Problem anı (ürünsüz hâl)', say: painLine },
      { t: '7–12 sn', shot: 'Ürün kullanımda, yakın plan', say: benefit },
      { t: '12–15 sn', shot: 'Sonuç + ürün tekrar görünür', say: 'Link profilde / Şimdi dene.' },
    ],
    signals: {
      winningScore: product.winningScore ?? null,
      daysActive: product.daysActive ?? null,
      adCount: product.adCount ?? null,
    },
  };
}

module.exports = { detectHooks, buildHookRadar, buildUgcBrief, firstSentence, HOOK_PATTERNS };

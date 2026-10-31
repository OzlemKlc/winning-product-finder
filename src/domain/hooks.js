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

/**
 * Türkçe + İngilizce küçük harf. tr-TR "I"yı noktasız "ı" yapar ("I tried" → "ı tried"),
 * bu yüzden İngilizce kalıplar için standart küçük harf de eklenir.
 */
const lower = (s) => {
  const str = String(s || '');
  return `${str.toLocaleLowerCase('tr-TR')}\n${str.toLowerCase()}`;
};

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
    label: 'Question opening',
    test: (t, first) => /\?/.test(first),
  },
  {
    id: 'pain',
    label: 'Pain point / problem',
    test: (t) =>
      /(ağrı|ağrın|kabus|unutuyor|israf|derdi|sorun|yoruldun|bıktın|zor|pain|tired of|struggl|annoying)/.test(t),
  },
  {
    id: 'transformation',
    label: 'Transformation / claim',
    test: (t) =>
      /(son ver|elveda|devrim|kurtarıcı|vazgeçilmez|bir numara|hiç olmadığı kadar|game[- ]?changer|life[- ]?changing|must[- ]have|say goodbye)/.test(t),
  },
  {
    id: 'number',
    label: 'Number / concrete result',
    // Türkçede yüzde işareti sayıdan önce yazılır ("%100"); İngilizcede sonra ("100%").
    test: (t) =>
      /%\s*\d+/.test(t) ||
      /\d+\s*(dakika|dk|saniye|sn|saat|gün|inç|cm|kg|milyon|bin|%|x|minutes?|seconds?|hours?|days?|inch)/.test(t),
  },
  {
    id: 'convenience',
    label: 'Convenience / portability',
    test: (t) =>
      /(taşınabilir|her yerde|çantana|avuç|tek hareket|tek elle|tek tuş|anında|dokunmadan|kolay|pratik|portable|anywhere|one[- ]click|instantly|easy)/.test(t),
  },
  {
    id: 'audience',
    label: 'Audience call-out',
    test: (t) =>
      /(için ideal|için bir numara|çalışanların|favorisi|gamer|ebeveyn|anneler|öğrenci|kampçı|for (moms|gamers|parents|busy|pet owners))/.test(t),
  },
  {
    id: 'socialProof',
    label: 'Social proof',
    test: (t) =>
      /(favorisi|en çok satan|binlerce|herkes|viral|trend|best[- ]?seller|thousands|everyone|reviews?|5 yıldız)/.test(t),
  },
  {
    id: 'urgency',
    label: 'Urgency / scarcity',
    test: (t) => /(sınırlı|bugün|son \d|stoklar|kaçırma|hemen|limited|today only|hurry|last chance)/.test(t),
  },
  {
    id: 'exclamation',
    label: 'Strong exclamation opening',
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
    hookOptions.push({ type: 'question', text: `Does ${name} really work? I tried it.` });
  }
  if (!patterns.includes('pain')) {
    hookOptions.push({ type: 'pain', text: `Do not buy ${name.toLowerCase()} before you know this.` });
  }
  hookOptions.push({ type: 'pov', text: `POV: ${name} entered my life and…` });

  return {
    product: name,
    format: 'UGC · 9:16 · 15 sec',
    provenAngles: patterns.map((id) => (PATTERN_BY_ID[id] ? PATTERN_BY_ID[id].label : id)),
    hookOptions: hookOptions.slice(0, 3),
    shotList: [
      { t: '0–3 sec', shot: 'Presenter faces camera and holds the product', say: hookOptions[0] ? hookOptions[0].text : name },
      { t: '3–7 sec', shot: 'Show the problem before using the product', say: painLine },
      { t: '7–12 sec', shot: 'Close-up of the product in use', say: benefit },
      { t: '12–15 sec', shot: 'Result and product return on screen', say: 'See the link / Try it now.' },
    ],
    signals: {
      winningScore: product.winningScore ?? null,
      daysActive: product.daysActive ?? null,
      adCount: product.adCount ?? null,
    },
  };
}

module.exports = { detectHooks, buildHookRadar, buildUgcBrief, firstSentence, HOOK_PATTERNS };

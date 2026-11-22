// Founders AI OS: the morning ideas run and remixes into formats, on the server.
// AI writes each format in parallel from the Brand DNA and the proven posts. Any format the AI cannot
// deliver falls back to the rules engine, so the founder always wakes up to a full set.
const I = require('../js/ideas.js');
const R = require('../js/remix.js');
const L = require('./_learning');

const SYS = 'You work inside Founders AI OS for one founder. You only use what the founder wrote or said and the posts you are given. Plain words, short sentences, no em dashes, no exclamation points, no emojis, no hype, no filler, no formulaic contrast lines. Write as the founder, in first person, in their voice. Return JSON only.';

const dnaOf = (offers) => ({ offers: (offers || []).filter((x) => x.kind === 'offer'), funnels: (offers || []).filter((x) => x.kind === 'funnel') });
const proofOf = (p) => p.own ? `${Number(p.views).toLocaleString('en-US')} views on your connected channel. ${p.outlier}x a similarly aged comparison group. ${p.comparison || ''} An observation to test, not a promise.`
  : `${p.author || 'The creator'}${p.views ? ' got ' + Number(p.views).toLocaleString('en-US') + ' ' + I.unitOf(p) : ''}${p.outlier ? ', ' + p.outlier + 'x their usual' : ''}.`;

// inputs: { dna, offers, proven, taken }. ai(system, user, max) returns { text, by } or null.
async function morning(inputs, ai, opts = {}) {
  const day = opts.day || new Date().toISOString().slice(0, 10); const per = opts.per || 10; const formats = opts.formats || I.IDS;
  const seen = new Set();
  const proven = [...L.sourceRows(inputs.learning), ...(inputs.proven || [])].filter((p) => p && p.title)
    .filter((p) => { const key = p.url || p.id || I.norm(p.title); if (seen.has(key)) return false; seen.add(key); return true; })
    .map((p, i) => ({ id: p.id || 'pv' + i, ...p }));
  if (!proven.length) return { items: [], by: null, empty: true };
  const dna = dnaOf(inputs.offers); const taken = (inputs.taken || []).slice(0, 80);
  const byFmt = {}; let by = null;
  if (ai) {
    await Promise.all(formats.map(async (fmt) => {
      const sources = L.rank(proven, inputs.learning, fmt);
      const user = [inputs.dna || '', L.prompt(inputs.learning), I.morningPrompt(fmt, sources, taken, per)].filter(Boolean).join('\n\n');
      const r = await ai(SYS, user, fmt === 'post' ? 9000 : 6500).catch(() => null);
      const got = r && I.parse(r.text, [fmt], fmt);
      if (got && got.length) {
        by = r.by;
        byFmt[fmt] = got.slice(0, per).map((g) => { const p = sources[(g.from || 1) - 1] || sources[0]; return I.row({ ...g, pattern: R.pattern(p.title).name, proof: proofOf(p) }, fmt, p, { morning: day, by: r.by }); });
      }
    }));
  }
  const fill = formats.flatMap((fmt) => I.morning(L.rank(proven, inputs.learning, fmt), dna, { per, formats: [fmt], taken, day, preserveOrder: !!inputs.learning?.enabled }));
  const items = [];
  formats.forEach((fmt) => {
    const mine = byFmt[fmt] || []; const seen = new Set(mine.map((x) => I.norm(x.title)));
    const extra = fill.filter((x) => x.channel === fmt && !seen.has(I.norm(x.title))).slice(0, Math.max(0, per - mine.length));
    items.push(...L.rank([...mine, ...extra], inputs.learning, fmt).map((x) => ({
      ...x, meta: { ...x.meta, learning: L.stamp(inputs.learning) },
    })));
  });
  return { items, by: by || 'Rules' };
}

// One proven post into one idea per chosen format.
async function remix(post, formats, inputs, ai, pool) {
  const fm = formats.filter((f) => I.IDS.includes(f)); if (!fm.length) return { items: [], by: null };
  const dna = dnaOf(inputs.offers);
  const rules = fm.map((f) => I.row(I.fromPost(post, f, dna, pool || [], 0), f, post, { remix: true, by: 'Rules' }));
  if (!ai) return { items: rules.map((x) => ({ ...x, meta: { ...x.meta, learning: { enabled: false, reason: 'Rules-only remix' } } })), by: 'Rules' };
  const user = [inputs.dna || '', L.prompt(inputs.learning), I.remixPrompt(post, fm)].filter(Boolean).join('\n\n');
  const r = await ai(SYS, user, 900 + fm.length * 700).catch(() => null);
  const got = (r && I.parse(r.text, fm, null)) || [];
  const items = fm.map((f, k) => { const g = got.find((x) => x.format === f); const row = g ? I.row({ ...g, pattern: rules[k].meta.pattern, proof: rules[k].meta.proof }, f, post, { remix: true, by: r.by }) : rules[k]; return { ...row, meta: { ...row.meta, learning: L.stamp(inputs.learning) } }; });
  return { items, by: got.length ? r.by : 'Rules' };
}

module.exports = { morning, remix };

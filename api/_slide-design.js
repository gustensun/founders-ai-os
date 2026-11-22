// How the AI designs program slides. The rules are distilled from Taste Skill (tasteskill.dev, MIT)
// and Impeccable (impeccable.style, Apache-2.0): one idea per slide, the layout follows the shape of
// the idea, varied rhythm, nouns in headings, no eyebrow labels, emphasis by weight or colour on a
// few words, nothing invented. Each design adds its own art direction on top.
const LAYOUTS = ['points', 'statement', 'steps', 'grid', 'compare', 'stat', 'quote'];
const DESIGNS = {
  tech: {
    name: 'Tech',
    brief: 'Tech: a precise, engineered deck. Think product keynote at a developer company. Short, exact titles with a strong verb or noun. Statements are crisp claims, 6 to 12 words. Prefer steps for anything that happens in order and grid for parts of a system. Compare is good for old way versus new way.',
  },
  editorial: {
    name: 'Editorial',
    brief: 'Editorial: a magazine feature set in a serif. Titles can be a short sentence with a point of view, 4 to 10 words. Statements read like a pull line from a good essay, 8 to 16 words. Use quote when the notes hold the founder\'s own words. Fewer, better words per slide; let the type breathe.',
  },
  clean: {
    name: 'Clean',
    brief: 'Clean: quiet, high-end, like a studio presenting to a premium client. Very few words. Titles 2 to 6 words. Statements 5 to 12 words, calm and confident. Prefer statement, points with 3 items and grid with 3 or 4 items. Nothing loud.',
  },
};
const RULES = `DESIGN RULES (follow every one)
1. One idea per slide. Pick the layout from the shape of the idea:
   - points: 3 to 5 parallel practical points. bullets, each 3 to 9 words.
   - statement: one insight said as one sentence. Put it in title (up to 16 words). Optional subtitle as one supporting line.
   - steps: something done in order. items: 3 to 5, each {"head": 2 to 4 words, "text": up to 12 words}.
   - grid: 3 or 4 parts of one whole that have no order. items like steps.
   - compare: a contrast, such as before and after or wrong and right. left and right: {"label": 1 to 3 words, "items": 2 to 4 short lines}.
   - stat: only when a real number appears in the lesson notes or materials. stat: {"value": the number exactly as written, "label": what it measures, up to 8 words}. Never invent or round a number.
   - quote: only for words the founder actually wrote or said in the notes or materials, copied exactly. quote: {"text", "who"}.
2. Rhythm: never use the same layout three slides in a row. Every lesson gets at least one statement or stat or quote. Points are at most 4 in 10 content slides.
3. Titles name the thing. Never "Overview", "Introduction", "Key points", "Summary" or "Recap" alone. Sentence case. No label or kicker above a title, no "Step 1:" inside a title.
4. Emphasis: set "em" to 1 to 3 words copied exactly from the title (or the statement) that carry the idea. They are shown in the accent colour. Never the whole title.
5. Words: plain and specific to this lesson. No hype, no em dashes, no exclamation points, no emojis, no filler like "unlock", "game changer", "seamless", "elevate", "leverage", "dive into".
6. Never invent results, numbers, testimonials, client names or claims. Use only what you are given.`;

const SCHEMA = '{"slides":[{"type":"section|content|recap","layout":"points|statement|steps|grid|compare|stat|quote","lesson_id":"id or null","title":"","em":"","subtitle":"","bullets":[],"items":[{"head":"","text":""}],"left":{"label":"","items":[]},"right":{"label":"","items":[]},"stat":{"value":"","label":""},"quote":{"text":"","who":""},"notes":""}]}. Only fill the fields the layout uses.';

function brief(design) { const d = DESIGNS[design] || DESIGNS.clean; return `${RULES}\n\nART DIRECTION\n${d.brief}`; }

// Clean what the model sent back so every slide renders, and fall back to points when a layout's data is missing.
function clean(x, t) {
  const arr = (v, n, m) => (Array.isArray(v) ? v : []).map((s) => t(typeof s === 'object' && s ? s.text || s.head || '' : s, m)).filter(Boolean).slice(0, n);
  const items = (Array.isArray(x.items) ? x.items : []).map((i) => (i && typeof i === 'object' ? { head: t(i.head, 60), text: t(i.text, 140) } : { head: t(i, 60), text: '' })).filter((i) => i.head || i.text).slice(0, 5);
  const side = (s) => (s && typeof s === 'object' ? { label: t(s.label, 40), items: arr(s.items, 4, 120) } : { label: '', items: [] });
  let layout = LAYOUTS.includes(x.layout) ? x.layout : 'points';
  const out = { layout, em: t(x.em, 60) };
  if (layout === 'steps' || layout === 'grid') { if (items.length >= 2) out.items = items; else layout = 'points'; }
  if (layout === 'compare') { const l = side(x.left), r = side(x.right); if (l.items.length && r.items.length) { out.left = l; out.right = r; } else layout = 'points'; }
  if (layout === 'stat') { const v = t(x.stat && x.stat.value, 16); if (v && /\d/.test(v)) out.stat = { value: v, label: t(x.stat.label, 80) }; else layout = 'statement'; }
  if (layout === 'quote') { const q = t(x.quote && x.quote.text, 260); if (q) out.quote = { text: q.replace(/^["\u201c]+|["\u201d]+$/g, ''), who: t(x.quote.who, 60) }; else layout = 'statement'; }
  out.layout = layout;
  if (out.em && !String(x.title || '').toLowerCase().includes(out.em.toLowerCase())) out.em = '';
  return out;
}

module.exports = { LAYOUTS, DESIGNS, RULES, SCHEMA, brief, clean };

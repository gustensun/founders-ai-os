// Library skills for AI Chat: 55 MIT licensed marketing, writing and research skills built into
// _skill-library.json by scripts/skills/build.cjs. They work next to the founder's own skills in _chatprompt.js;
// the founder's skills, facts, Brand DNA and house rules win on any overlap.
let DATA = null;
const lib = () => (DATA = DATA || require('./_skill-library.json'));
const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; };
const rx = new Map();
const re = (s) => { if (!rx.has(s.id)) rx.set(s.id, new RegExp(s.match, (s.flags || 'i').replace('g', '') + 'g')); const r = rx.get(s.id); r.lastIndex = 0; return r; };
const all = () => lib().skills;
const byId = (id) => all().find((s) => s.id === String(id || '').replace(/^lib:/, '').trim().toLowerCase());

// The library skills a request needs, best first. Several keyword hits beat one; the founder's own skill
// covering the same ground lowers a library skill's rank so it supplements instead of leading.
const OVERLAP = { cro: ['cro'], offers: ['offers'], launch: ['launch'], emails: ['email'], copywriting: ['copy', 'funnels'], 'content-strategy': ['content'], social: ['content'], image: ['design'], 'lead-magnets': ['funnels'], 'sales-enablement': ['dm', 'crm'] };
const BLOCK_SIZE = 15000;
function pick(question, own = [], max = 3) {
  const q = String(question || ''); if (!q.trim()) return [];
  const mine = new Set(own.map((s) => s.id));
  const scored = all().map((s) => {
    const hits = q.match(re(s)) || [];
    if (!hits.length) return null;
    let score = new Set(hits.map((h) => h.toLowerCase())).size * 2 + hits.length;
    if ((OVERLAP[s.id] || []).some((id) => mine.has(id))) score -= 1.5;
    if (/\b(last (30|thirty) days|this month|trending|what (are|is) people saying)\b/i.test(q) && s.id === 'last30days') score += 4;
    if (/\b(slop|sounds? (less |more )?(like )?ai|less like ai|more human|humani[sz]e)\b/i.test(q) && s.id === 'no-ai-slop') score += 4;
    return { s, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return scored.filter((x) => x.score > 0).slice(0, max).map((x) => x.s);
}

const ENV = "Library skills were written for coding agents that keep project files. In Founders AI OS: the product marketing context file is the Brand DNA and approved facts (get_brand_profile, get_founder_facts); brand.md or design.md is the brand board (os_read brand_board); saved lists, logs and notes live in OS sections and memory (os_read, os_write, search_memory); recurring loops become routines (propose_recurring_task); listening sources become web watches (watch_web) and Creators. Never tell the founder to create files, install anything or run commands. Name outside tools only when the founder asks which tool to use; otherwise work with what is connected in the OS. Reference files a skill mentions are loaded with read_skill.";

function block(list) {
  if (!list.length) return '';
  return list.map((s) => {
    const body = s.body.length > BLOCK_SIZE ? s.body.slice(0, BLOCK_SIZE) + `\n\n[The rest of this skill: read_skill id "${s.id}" part 2.]` : s.body;
    const refs = Object.keys(s.refs || {});
    return `## Library skill: ${s.name} (id ${s.id})\n${body}${refs.length ? `\n\nReference files for this skill (load with read_skill id "${s.id}" and file): ${refs.join(', ')}` : ''}`;
  }).join('\n\n');
}
// One line per skill so AI Chat knows everything it can load.
function catalog() {
  return all().map((s) => `- ${s.id}: ${s.name}. ${clip(s.when.replace(/^When the user wants to /i, ''), 150)}`).join('\n');
}

const PART = 9000;
function read(a) {
  const s = byId(a.id);
  if (!s) return { error: 'No library skill called ' + clip(a.id, 60) + '. Pick an id from the LIBRARY SKILLS list in your instructions.' };
  let text = s.body, file = null;
  if (a.file) {
    const want = String(a.file).replace(/^\.?\//, '').replace(/^.*?references\//, 'references/');
    file = Object.keys(s.refs || {}).find((k) => k === want || k === 'references/' + want || k.endsWith('/' + want) || k === want + '.md' || k.endsWith('/' + want + '.md'));
    if (!file) return { error: 'That file is not part of ' + s.id + '.', files: Object.keys(s.refs || {}) };
    text = s.refs[file];
  }
  const parts = Math.max(1, Math.ceil(text.length / PART)), part = Math.min(parts, Math.max(1, parseInt(a.part, 10) || 1));
  return { id: s.id, name: s.name, file: file || 'SKILL.md', part, parts, source: s.source + ' (MIT)', text: text.slice((part - 1) * PART, part * PART),
    ...(part < parts ? { more: `Call read_skill again with part ${part + 1} for the rest.` } : {}),
    ...(!a.file && Object.keys(s.refs || {}).length ? { files: Object.keys(s.refs) } : {}) };
}
function find(query) {
  const q = String(query || '');
  const hits = pick(q, [], 8);
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const extra = words.length ? all().filter((s) => !hits.includes(s) && words.some((w) => (s.name + ' ' + s.when).toLowerCase().includes(w))).slice(0, 8 - hits.length) : [];
  return { skills: [...hits, ...extra].map((s) => ({ id: s.id, name: s.name, when: clip(s.when, 220), files: Object.keys(s.refs || {}).length })) };
}

module.exports = { pick, block, catalog, read, find, byId, all, ENV };

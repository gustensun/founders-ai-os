// Founders AI OS Funnel Agent: one offer in, a live sales page out.
// Steps: research, offer, copy (with emails and the HighLevel handoff), brand, visuals, design, build, publish.
// After the intake answers nothing waits for the founder. Each run works through steps on the server, saves after every step
// and hands itself the next run, so a build finishes even when the browser is closed. Revisions and syncs reuse the same loop.
const { bad, clip, q, open, sb, rpc, jf, APP_URL, crypto } = require('./_lib');
const R = require('../js/funnel-render.js');
const Vault = require('./_vault');
const VaultBriefs = require('../js/vault');
let waitUntil = null; try { ({ waitUntil } = require('@vercel/functions')); } catch { /* local runs await instead */ }

const SECRET = () => process.env.CRON_SECRET || '';
const STEPS = ['research', 'offer', 'copy', 'brand', 'visuals', 'design', 'build', 'publish'];
const BUDGET = 110000; // start no new step after this many ms in one run; the next run picks it up
const now = () => new Date().toISOString();
const GEMINI = process.env.FUNNEL_GEMINI_BUILDER || 'google/gemini-4-carbon';
// Like clip, but keeps line breaks so attached files stay readable for the model.
const keep = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const SYS = 'You are the Funnel Agent inside Founders AI OS. You build one sales page for one founder from their own Brand DNA, offers, proven content and research. Write like a sharp human direct-response copywriter: plain words, short sentences, specific numbers, the reader\'s own words. Never use em dashes, exclamation points, emojis, hype words (game-changer, unlock, supercharge, revolutionize, skyrocket, seamless, effortless, elevate), formulaic contrast lines ("it is not X, it is Y"), rhetorical triplets or filler. Never invent testimonials, customer counts, revenue figures, media mentions, awards or results. Only use facts given to you. When a fact is missing, write around it.';

/* ---------- small helpers ---------- */
const jsonOut = (t) => { const s = String(t || ''); const m = s.match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { const f = m[0].replace(/,\s*([}\]])/g, '$1'); try { return JSON.parse(f); } catch { return null; } } };
const scrub = (v) => typeof v === 'string' ? v.replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, '-').replace(/!/g, '.').replace(/\.\.+/g, '.') : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^(url|href|checkout|checkout_url|website|bg|ink|accent|deep|deep_ink|surface|muted|line|id|name_slug)$/.test(k) ? x : scrub(x)])) : v;
const slug = (s) => String(s || 'sales-page').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sales-page';
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
const HEX = /^#[0-9a-f]{6}$/i;
const safeEq = (a, b) => { a = String(a || ''); b = String(b || ''); return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); };
const cron = (fn, args) => rpc(null, fn, { p_secret: SECRET(), ...args });
const save = (id, patch) => cron('cron_funnel_save', { p_id: id, p_patch: patch });

/* ---------- keys: every workspace brings its own ---------- */
async function keys(ws) {
  const K = {};
  await Promise.all(['claude', 'openai', 'openrouter', 'perplexity', 'github', 'vercel'].map(async (p) => {
    try {
      const c = await cron('cron_funnel_secret', { p_ws: ws, p_provider: p }); if (!c) return;
      const plain = open(c); let v; try { v = JSON.parse(plain); } catch { v = plain; }
      K[p] = typeof v === 'string' ? { key: v } : v;
      if (!K[p].key && K[p].token) K[p].key = K[p].token;
    } catch { /* not connected */ }
  }));
  return K;
}

/* ---------- AI: Claude Opus first, then Sonnet, then OpenAI. Long timeouts, the steps run in the background. ---------- */
async function claude(key, model, system, user, max, tools) {
  const j = await jf('Claude', 'https://api.anthropic.com/v1/messages', { method: 'POST', timeout: 230000, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model, max_tokens: max, system, messages: [{ role: 'user', content: user }], ...(tools ? { tools } : {}) }) });
  const text = (j.content || []).filter((x) => x.type === 'text').map((x) => x.text || '').join('').trim();
  const sources = [];
  (j.content || []).forEach((x) => { if (x.type === 'web_search_tool_result' && Array.isArray(x.content)) x.content.forEach((r) => { if (r.url) sources.push({ title: clip(r.title, 140) || r.url, url: r.url }); }); (x.citations || []).forEach((c) => { if (c.url) sources.push({ title: clip(c.title, 140) || c.url, url: c.url }); }); });
  if (!text) throw bad('Claude returned nothing', 502);
  return { text, by: model, sources };
}
async function openai(key, model, system, user, max, tools) {
  const j = await jf('OpenAI', 'https://api.openai.com/v1/responses', { method: 'POST', timeout: 230000, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions: system, input: user, max_output_tokens: max + 8000, reasoning: { effort: 'low' }, ...(tools ? { tools } : {}) }) });
  const parts = (j.output || []).flatMap((o) => o.content || []);
  const text = j.output_text || parts.filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  const sources = parts.flatMap((c) => (c.annotations || []).filter((a) => a.url).map((a) => ({ title: clip(a.title, 140) || a.url, url: a.url })));
  if (!text) throw bad('OpenAI returned nothing', 502);
  return { text, by: model, sources };
}
// One Perplexity key: Claude, GPT, Gemini and Grok through the Agent API, with its own web search.
async function pplxCall(key, model, system, user, max, web) {
  const j = await jf('Perplexity', 'https://api.perplexity.ai/v1/agent', { method: 'POST', timeout: 230000, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions: system, input: user, max_output_tokens: max + 4000, ...(web ? { tools: [{ type: 'web_search' }, { type: 'fetch_url' }], max_steps: 6 } : {}) }) });
  const text = require('./brain.js')._pplxText(j);
  const sources = (j.output || []).filter((o) => o.type === 'search_results').flatMap((o) => o.results || []).filter((r) => r.url).map((r) => ({ title: clip(r.title, 140) || r.url, url: r.url }));
  if (!text) throw bad('Perplexity returned nothing', 502);
  return { text, by: model.replace(/^[a-z]+\//, ''), sources };
}
async function llm(K, system, user, max = 4000, opt = {}) {
  let order = [];
  if (K.claude && K.claude.key) order.push(['claude', process.env.FUNNEL_MODEL || 'claude-opus-5-5'], ['claude', 'claude-sonnet-5-5']);
  if (K.openai && K.openai.key) order.push(['openai', process.env.FUNNEL_OPENAI_MODEL || 'gpt-6.1-sol']);
  // The builder the founder picked also writes: GPT builds write with GPT, Gemini builds with Gemini on OpenRouter.
  if (K.prefer === 'codex') order = [...order.filter((o) => o[0] === 'openai'), ...order.filter((o) => o[0] !== 'openai')];
  if (K.prefer === 'gemini' && K.openrouter && K.openrouter.key && !opt.web) order.unshift(['openrouter', GEMINI]);
  if (K.perplexity && K.perplexity.key) order.push(['perplexity', K.prefer === 'gemini' ? 'google/gemini-4-carbon' : K.prefer === 'codex' ? 'openai/gpt-6.1-sol' : 'anthropic/claude-opus-5-5']);
  if (!order.length && K.openrouter && K.openrouter.key) order.push(['openrouter', K.prefer === 'gemini' ? GEMINI : 'anthropic/claude-opus-5.5']);
  if (!order.length) throw bad('Connect Claude, OpenAI, Perplexity or OpenRouter in Connections so the Funnel Agent can write.', 409);
  let last;
  for (const [p, m] of order) {
    try {
      const tools = opt.web ? (p === 'claude' ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }] : [{ type: 'web_search' }]) : null;
      if (p === 'openrouter') return { ...(await orChat(K.openrouter.key, m, system, user, max, 'low', 230000)), sources: [] };
      if (p === 'perplexity') return await pplxCall(K.perplexity.key, m, system, user, max, !!opt.web);
      return await (p === 'claude' ? claude(K.claude.key, m, system, user, max, tools) : openai(K.openai.key, m, system, user, max, tools));
    } catch (e) { last = e; if (p === 'openrouter' && order.length > 1) continue; if (e.code === 422 && p === 'claude' && order.some((o) => o[0] === 'openai' || o[0] === 'perplexity')) continue; if (p !== 'perplexity' && order.some((o) => o[0] === 'perplexity') && !/credit|quota|billing/i.test(e.message || '')) continue; }
  }
  throw last;
}
async function llmJSON(K, system, user, max, opt = {}) {
  const r = await llm(K, system, user + '\n\nReturn only one JSON object. No prose before or after it.', max, opt);
  let j = jsonOut(r.text);
  if (!j) { const r2 = await llm(K, system, 'Turn this into one valid JSON object with the same content. Return only the JSON.\n\n' + r.text.slice(0, 30000), max); j = jsonOut(r2.text); }
  if (!j) throw bad('The model did not return a usable answer. The step will retry.', 502);
  return { j: scrub(j), by: r.by, sources: r.sources || [] };
}

/* ---------- what the agent knows about the founder ---------- */
function pickOffer(inp, b) {
  const all = inp.offers || [];
  return all.find((o) => o.id === b.offer_ref) || (b.offer && b.offer.name ? null : all.find((o) => o.kind === 'offer')) || null;
}
function brief(inp, b, depth = 'full') {
  const o = pickOffer(inp, b); const a = b.answers || {}; const ws = inp.workspace || {};
  const others = (inp.offers || []).filter((x) => !o || x.id !== o.id).slice(0, 18).map((x) => `- ${x.kind}: ${x.name}${x.price ? ' (' + x.price + ' ' + (x.currency || 'USD') + (x.price_note ? ', ' + x.price_note : '') + ')' : ''}${x.url ? ' ' + x.url : ''}`).join('\n');
  const proven = (inp.proven || []).slice(0, 14).map((p) => `- "${p.title}" by ${p.author || 'creator'} on ${p.platform || 'web'}, ${p.outlier}x their median${p.views ? ', ' + p.views + ' views' : ''}`).join('\n');
  const facts = (inp.facts || []).slice(0, 40).map((f) => `- [${f.category}] ${f.statement}`).join('\n');
  const swipe = (inp.swipe || []).slice(0, depth === 'full' ? 5 : 2).map((s) => `- ${s.kind} "${s.title || s.brand || s.url}"${s.notes ? ' Notes: ' + clip(s.notes, 200) : ''}${s.analysis ? ' Saved interpretation: ' + clip(typeof s.analysis === 'string' ? s.analysis : JSON.stringify(s.analysis), depth === 'full' ? 900 : 300) : ''}`).join('\n');
  const voice = inp.voice ? clip(inp.voice.ai_guide || inp.voice.guide, depth === 'full' ? 2200 : 900) : '';
  const answers = Object.entries(a).filter(([k, v]) => k !== 'vault_notes' && k !== 'attached' && v && String(v).trim()).map(([k, v]) => `- ${k}: ${clip(v, 900)}`).join('\n');
  return [
    `FOUNDER: ${ws.owner || 'the founder'} (workspace: ${ws.name || ''})`,
    o ? `THE OFFER (from the founder's OS): ${o.name}${o.price ? ', ' + o.price + ' ' + (o.currency || 'USD') : ''}${o.price_note ? ' (' + o.price_note + ')' : ''}${o.summary ? '. ' + clip(o.summary, 1500) : ''}${o.url ? '. Current page: ' + o.url : ''}` : b.offer && b.offer.name ? `THE OFFER: ${JSON.stringify(b.offer).slice(0, 3000)}` : 'THE OFFER: described in the answers below.',
    answers ? `FOUNDER ANSWERS (treat as true and final):\n${answers}` : '',
    inp.dna ? `BRAND DNA:\n${clip(VaultBriefs.stripLegacyDNA(inp.dna), depth === 'full' ? 7000 : 3000)}` : '',
    facts ? `APPROVED FACTS ABOUT THE FOUNDER (the only proof you may use):\n${facts}` : '',
    others ? `OTHER OFFERS AND FUNNELS (for upsells and the ascension path):\n${others}` : '',
    proven ? `CONTENT THAT ALREADY WORKED IN THIS MARKET (outliers against each creator's median):\n${proven}` : '',
    a.attached ? `FILES AND CONTEXT THE FOUNDER ATTACHED (use the facts in it, never invent beyond it):\n${keep(a.attached, depth === 'full' ? 24000 : 8000)}` : '',
    inp.vault_context || '',
    inp.design_guidance || '',
    swipe ? `${VaultBriefs.RULE}\nADDITIONAL SAVED EXAMPLES:\n${swipe}` : '',
    voice ? `THE FOUNDER'S VOICE:\n${voice}` : '',
  ].filter(Boolean).join('\n\n');
}

/* ---------- intake questions ---------- */
const BASE_Q = [
  ['audience', 'Who is this for, in one line?', 'Who buys it and where they are stuck'],
  ['promise', 'What result do they get, and how fast?', 'The outcome and a realistic timeline'],
  ['price', 'Price and payment options', 'For example $497, or 3 payments of $177'],
  ['proof', 'What proof can the page use?', 'Real results, numbers, testimonials with names. Leave out anything you cannot show.'],
  ['checkout_url', 'HighLevel order form link (optional)', 'https://... Leave empty and buttons scroll to the offer until you add it'],
  ['notes', 'Anything the page must say or avoid?', 'Bonuses, deadlines, words to avoid'],
];
function defaults(o, inp) {
  const price = o && o.price ? `${R.money(o.price, o.currency || 'USD')}${o.price_note ? ', ' + o.price_note : ''}` : '';
  const facts = (inp && inp.facts || []).filter((f) => /result|proof|credential|achiev|story/i.test(f.category || '')).slice(0, 3).map((f) => f.statement).join(' ');
  return { audience: '', promise: o && o.summary ? clip(o.summary, 200) : '', price, proof: clip(facts, 400) || '', checkout_url: o && /^https?:\/\//.test(o.url || '') ? o.url : '', notes: '' };
}
// Load the offer, Brand DNA, facts and Vault references once for intake and chat planning.
async function intakeContext(jwt, b) {
  const ws = b.workspace_id;
  let o = null;
  if (b.offer_id) { const rows = await sb(jwt, `/rest/v1/founder_strategy?id=eq.${q(b.offer_id)}&workspace_id=eq.${q(ws)}&kind=eq.offer&lifecycle=in.(live,planned)&select=*`); o = rows && rows[0]; if (!o) throw bad('That offer is not in this workspace', 404); }
  else { const rows = await sb(jwt, `/rest/v1/workspaces?id=eq.${q(ws)}&select=id`); if (!rows || !rows.length) throw bad('not allowed', 403); }
  if (!o && !clip(b.offer_name, 200)) throw bad('Pick an offer or name a new one');
  const inp = await require('./_strategy').cronInput(ws,await cron('cron_funnel_inputs', { p_ws: ws }));
  const references = await Vault.context(jwt, ws, (o && o.name || b.offer_name || '') + ' ' + (b.context || ''), 'funnels', b.inspiration_ids);
  inp.vault_context = references.text;
  let K = {}; try { K = await keys(ws); } catch { /* no AI */ }
  return { o, inp, K, d: defaults(o, inp) };
}
async function questions(jwt, b) {
  const { o, inp, K, d } = await intakeContext(jwt, b);
  if (b.context) d.notes = VaultBriefs.text(b.context, 1500);
  const base = BASE_Q.map(([id, label, hint]) => ({ id, label, hint, value: d[id] || '' }));
  if (!(K.claude || K.openai || K.perplexity)) return { offer: o, questions: base, by: null };
  try {
    const fake = { offer_ref: o && o.id, offer: o ? null : { name: b.offer_name }, answers: { notes: VaultBriefs.text(b.context, 1500) } };
    const { j, by } = await llmJSON(K, SYS, `${brief(inp, fake, 'short')}\n\nYou are about to build a full sales page for this offer. Ask the founder the few things you cannot find above. Keep the six standard questions (ids: audience, promise, price, proof, checkout_url, notes) and prefill each "value" with your best answer from the context so the founder can just confirm. Leave proof empty unless the context has real, specific proof. Add at most two extra questions only this offer needs (short ids in snake_case). Labels under 60 characters, hints under 110.\nJSON: {"questions":[{"id":"audience","label":"...","hint":"...","value":"..."}]}`, 1600);
    const qs = Array.isArray(j.questions) ? j.questions.filter((x) => x && /^[a-z_]{2,30}$/.test(x.id) && x.label).slice(0, 8) : [];
    const byId = Object.fromEntries(qs.map((x) => [x.id, x]));
    const merged = base.map((x) => ({ ...x, label: clip(byId[x.id] && byId[x.id].label, 80) || x.label, hint: clip(byId[x.id] && byId[x.id].hint, 140) || x.hint, value: x.id === 'checkout_url' ? x.value : clip(byId[x.id] && byId[x.id].value, 900) || x.value }));
    qs.filter((x) => !BASE_Q.some(([id]) => id === x.id)).slice(0, 2).forEach((x) => merged.splice(merged.length - 1, 0, { id: x.id, label: clip(x.label, 80), hint: clip(x.hint, 140) || '', value: clip(x.value, 900) || '' }));
    return { offer: o, questions: merged, by };
  } catch { return { offer: o, questions: base, by: null }; }
}
/* ---------- files and workspace context the founder attaches in the funnel chat ---------- */
const CTX_SCOPES = ['all', 'brain', 'recordings', 'offers', 'content', 'memory'];
async function attachedContext(jwt, b, query) {
  const parts = []; let room = 30000;
  for (const f of (Array.isArray(b.files) ? b.files : []).slice(0, 6)) {
    const t = keep(String((f && f.text) || '').replace(/\u0000/g, ''), Math.min(12000, room)); if (!t) continue;
    parts.push(`FILE: ${clip(f.name, 120) || 'Attached file'}\n${t}`); room -= t.length; if (room < 500) break;
  }
  const scope = CTX_SCOPES.includes(b.scope) ? b.scope : null;
  const mats = (Array.isArray(b.material_ids) ? b.material_ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 12);
  if (scope || mats.length) {
    try {
      const CH = require('./chat.js');
      const g = await CH._gather(jwt, { workspace_id: b.workspace_id, scope: mats.length ? 'programs' : scope, material_ids: mats, program_id: null }, clip(query, 600) || 'offer funnel', []);
      const block = CH._contextBlock((g.sources || []).filter((x) => !x.full).slice(0, 12), null);
      if (block) parts.push(`FROM THE WORKSPACE${mats.length ? ' (selected program materials)' : ''}:\n${keep(block, 14000)}`);
    } catch { /* workspace sources are optional */ }
  }
  return parts.join('\n\n');
}

/* ---------- AI Chat planning: one offer, the founder's context and wishes, then a build brief ---------- */
const PLAN_KEYS = ['audience', 'promise', 'price', 'proof', 'checkout_url', 'notes', 'angle', 'sections'];
function cleanAnswers(a, keep) {
  const out = {};
  Object.entries(a || {}).slice(0, 14).forEach(([k, v]) => { if (/^[a-z_]{2,30}$/.test(k) && k !== 'vault_notes' && v != null) out[k] = clip(String(v), 1500) || ''; });
  if (out.checkout_url && !/^https:\/\//.test(out.checkout_url)) out.checkout_url = '';
  // Proof only comes from the founder or from the founder's existing answers, never from the model.
  if (keep) out.proof = keep.proof || '';
  return out;
}
async function plan(jwt, b) {
  const { o, inp, K, d } = await intakeContext(jwt, b);
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', body: clip(m.body, 2000) || '' })).filter((m) => m.body);
  const prev = cleanAnswers(b.answers);
  const answers = { ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v)) };
  if (b.context && !answers.notes) answers.notes = VaultBriefs.text(b.context, 1500);
  const name = o ? o.name : clip(b.offer_name, 120);
  if (!(K.claude || K.openai || K.perplexity || K.openrouter)) return { offer: o, answers, reply: 'Connect Claude, OpenAI or Perplexity in Connections so the Funnel Agent can plan with you. You can still fill in the brief and build.', ready: false, by: null };
  const said = msgs.filter((m) => m.role === 'user').map((m) => m.body).join('\n');
  const convo = msgs.map((m) => (m.role === 'user' ? 'FOUNDER: ' : 'YOU: ') + m.body).join('\n\n');
  const attached = await attachedContext(jwt, b, [name, msgs.filter((m) => m.role === 'user').map((m) => m.body).slice(-2).join(' ')].join(' '));
  const fake = { offer_ref: o && o.id, offer: o ? null : { name }, answers: { ...answers, ...(attached ? { attached } : {}) } };
  if (Array.isArray(b.engines) && b.engines.length) K.prefer = b.engines[0];
  const { j, by } = await llmJSON(K, SYS + ' Right now you are planning in AI Chat, before anything is built.', `${brief(inp, fake, 'short')}

The founder picked the offer "${name}" and is telling you the context and what they want from the funnel. You keep a build brief that the Funnel Agent uses to research, write, design and publish the sales page, the emails and the HighLevel setup.

${convo ? 'CONVERSATION SO FAR:\n' + convo : 'The founder has not said anything yet. Open by saying in one or two sentences what you already know about this offer, then ask what they want this funnel to do and anything you need.'}

Rules:
- Reply in plain words, under 120 words. No emojis, no em dashes, no hype, no exclamation points.
- Ask at most two short questions, only about things the brief still needs. When the brief is good enough to build, say so and tell them to press Build.
- Update the brief with everything the founder said. Keep founder statements as written. Fill audience, promise, price, angle and sections from the context when you can.
- proof: only real proof the founder stated in this conversation or that is in APPROVED FACTS. Otherwise keep it empty.
- notes: what the page must say or avoid, bonuses, deadlines, style wishes, in the founder's words.
- sections: the planned page sections in order, one line.
- Never change the price or offer terms unless the founder asks.

JSON: {"reply":"...","ready":true|false,"answers":{"audience":"","promise":"","price":"","proof":"","notes":"","angle":"","sections":""}}`, 1400);
  const next = cleanAnswers({ ...answers, ...(j.answers || {}) });
  // Proof stays empty unless the founder wrote it, the prior brief had it, or approved facts back it up.
  const factText = (inp.facts || []).map((f) => f.statement).join(' ');
  if (next.proof && next.proof !== answers.proof && !said.includes(next.proof.slice(0, 40)) && !factText.includes(next.proof.slice(0, 40))) next.proof = answers.proof || '';
  if (answers.checkout_url) next.checkout_url = answers.checkout_url;
  Object.keys(next).forEach((k) => { if (!PLAN_KEYS.includes(k) && !(k in prev)) delete next[k]; });
  return { offer: o, answers: next, reply: clip(String(j.reply || ''), 1400) || 'Noted. Tell me more, or press Build when the brief looks right.', ready: !!j.ready, by, attached: attached ? attached.length : 0 };
}

/* ---------- AI suggest: drafts empty form fields from the founder's own context. Never overwrites, never invents proof. ---------- */
const SUGGEST_KINDS = { offer: 'an offer in the founder\'s strategy', funnel: 'a funnel in the founder\'s strategy', brief: 'the Funnel Agent build brief for a sales page', program: 'a course or coaching program', emails: 'an email sequence', video: 'a video brief', graphic: 'a graphic or ad brief', goal: 'a goal' };
async function suggest(jwt, b) {
  const ws = b.workspace_id;
  const rows = await sb(jwt, `/rest/v1/workspaces?id=eq.${q(ws)}&select=id`); if (!rows || !rows.length) throw bad('not allowed', 403);
  const kind = SUGGEST_KINDS[b.kind] ? b.kind : 'offer';
  const fields = (Array.isArray(b.fields) ? b.fields : []).slice(0, 24).map((f) => ({ key: clip(String(f && f.key || ''), 60), label: clip(String(f && f.label || ''), 120), hint: clip(String(f && f.hint || ''), 200), value: clip(String(f && f.value || ''), 1500) || '', proof: !!(f && f.proof) })).filter((f) => /^[a-z0-9_.]{1,60}$/i.test(f.key) && f.label);
  if (!fields.length) throw bad('Nothing to suggest');
  const empty = fields.filter((f) => !f.value.trim());
  if (!empty.length) return { values: {}, by: null };
  let o = null;
  if (/^[0-9a-f-]{36}$/i.test(String(b.offer_id || ''))) { const r = await sb(jwt, `/rest/v1/founder_strategy?id=eq.${q(b.offer_id)}&workspace_id=eq.${q(ws)}&select=*`).catch(() => null); o = r && r[0] || null; }
  const inp = await require('./_strategy').cronInput(ws, await cron('cron_funnel_inputs', { p_ws: ws }));
  let K = {}; try { K = await keys(ws); } catch { /* no AI */ }
  if (!(K.claude || K.openai || K.perplexity || K.openrouter)) throw bad('Connect Claude, OpenAI, Perplexity or OpenRouter in Connections to use AI suggest.', 409);
  const draft = b.draft && typeof b.draft === 'object' ? Object.entries(b.draft).slice(0, 20).filter(([k, v]) => /^[a-z0-9_.]{1,60}$/i.test(k) && v != null && String(v).trim()).map(([k, v]) => `- ${k}: ${clip(String(v), 900)}`).join('\n') : '';
  const filled = fields.filter((f) => f.value.trim()).map((f) => `- ${f.label}: ${f.value}`).join('\n');
  const fake = { offer_ref: o && o.id, offer: o ? null : { name: clip(b.offer_name, 120) || '' }, answers: {} };
  const ctx = brief(inp, fake, 'short');
  const list = empty.map((f) => `- ${f.key}: ${f.label}${f.hint ? ' (' + f.hint + ')' : ''}${f.proof ? ' [PROOF FIELD: only real proof from APPROVED FACTS or the founder\'s own text, otherwise ""]' : ''}`).join('\n');
  const { j, by } = await llmJSON(K, SYS + ' Right now you are filling in a form for the founder so they do not have to type it.', `${ctx}

You are drafting ${SUGGEST_KINDS[kind]}${b.title ? ' called "' + clip(b.title, 160) + '"' : ''}.
${b.context ? 'EXTRA CONTEXT FROM THE PAGE:\n' + clip(String(b.context), 3000) + '\n' : ''}${draft ? 'WHAT THE FORM ALREADY SAYS:\n' + draft + '\n' : ''}${filled ? 'FIELDS THE FOUNDER ALREADY FILLED (keep consistent with these, never repeat or contradict them):\n' + filled + '\n' : ''}
Draft a value for each of these empty fields:
${list}

Rules:
- Ground every value in the context above: the offer, Brand DNA, approved facts, other offers and the founder's voice. Be specific to this founder, not generic.
- Plain words, short. One to three sentences per field unless the label asks for a list, then a short comma or line separated list.
- No emojis, no em dashes, no hype, no exclamation points.
- Never invent prices, results, numbers, testimonials, guarantees or dates the context does not support. If you cannot ground a field, return "".
- Use the exact keys given.

JSON: {"values":{"key":"value"}}`, 1600);
  const vals = j && j.values && typeof j.values === 'object' ? j.values : {};
  const factText = (inp.facts || []).map((f) => f.statement).join(' ');
  const out = {};
  empty.forEach((f) => {
    let v = vals[f.key]; if (v == null) return; v = clip(Array.isArray(v) ? v.join('\n') : String(v), 1500).trim(); if (!v) return;
    if (f.proof && !factText.includes(v.slice(0, 40)) && !(inp.facts || []).some((x) => String(x.statement || '').length > 20 && v.includes(String(x.statement).slice(0, 40)))) return;
    out[f.key] = v;
  });
  return { values: out, by };
}

/* ---------- step: research ---------- */
async function stepResearch(b, inp, K) {
  const ctx = brief(inp, b, 'short');
  const want = 'JSON: {"summary":"3 sentences on the market and where this offer fits","audience":{"who":"","pains":["5 pains in their words"],"desires":["4"],"objections":["5 real buying objections"],"words":["8 phrases buyers actually use"]},"competitors":[{"name":"","offer":"","price":"","angle":"","url":""}],"price_range":"what similar offers cost","angles":["5 angles that could lead the page, strongest first"],"proven":["titles from the proven content list that match this offer, with the multiplier"],"gaps":["3 things competitors do not say that this offer can"],"sources":[{"title":"","url":""}]}';
  let web = null; let method = 'internal';
  if (K.perplexity && K.perplexity.key) {
    try {
      const o = pickOffer(inp, b); const a = b.answers || {};
      const topic = `${(o && o.name) || (b.offer && b.offer.name) || b.title}. ${a.audience || ''} ${a.promise || (o && o.summary) || ''}`.slice(0, 600);
      const j = await jf('Perplexity', 'https://api.perplexity.ai/chat/completions', { method: 'POST', timeout: 90000, headers: { Authorization: 'Bearer ' + K.perplexity.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.PPLX_RESEARCH_MODEL || 'sonar-pro', max_tokens: 2200, messages: [{ role: 'system', content: 'You are a market researcher for direct-response sales pages. Be specific and cite sources. No em dashes.' }, { role: 'user', content: `Research the market for this offer: ${topic}\nFind: 5 to 8 competing offers with their price and main angle and URL, the buyer's top pains and objections in their own words (forums, reviews, Reddit, YouTube comments), typical price ranges, and any angles that are working in ads or content right now.` }] }) });
      web = { text: String((j.choices && j.choices[0] && j.choices[0].message.content) || ''), sources: (j.search_results || []).map((s) => ({ title: clip(s.title, 140) || s.url, url: s.url })).concat((j.citations || []).map((u) => ({ title: u, url: u }))) };
      method = 'perplexity';
    } catch { web = null; }
  }
  let out;
  if (web) out = await llmJSON(K, SYS, `${ctx}\n\nWEB RESEARCH (cited):\n${web.text.slice(0, 12000)}\n\nCombine the web research with the founder's own data into research for the sales page. Use only competitor names and prices that appear in the research. ${want}`, 3500);
  else {
    try { out = await llmJSON(K, SYS, `${ctx}\n\nSearch the web for this offer's market: competing offers with prices and angles, buyer pains and objections in their own words, price ranges and angles working now. Then combine it with the founder's own data. ${want}`, 5000, { web: true }); method = 'web'; }
    catch (e) { if (e.code === 409) throw e; out = await llmJSON(K, SYS, `${ctx}\n\nNo web access right now. Build the research from the founder's own data and what is well known about this market. Leave competitors empty unless they are named above. ${want}`, 3000); }
  }
  const r = out.j || {};
  const srcs = [...(web ? web.sources : []), ...(out.sources || []), ...(Array.isArray(r.sources) ? r.sources : [])].filter((s) => s && /^https?:\/\//.test(s.url || ''));
  const seen = new Set(); r.sources = srcs.filter((s) => (seen.has(s.url) ? false : seen.add(s.url))).slice(0, 12);
  r.method = method; r.by = out.by;
  const n = (r.competitors || []).length;
  return { patch: { research: r }, note: `${n} competitor${n === 1 ? '' : 's'}, ${(r.angles || []).length} angles, ${r.sources.length} sources${method === 'internal' ? ', from your own data' : ''}` };
}

/* ---------- step: offer ---------- */
async function stepOffer(b, inp, K) {
  const { j, by } = await llmJSON(K, SYS, `${brief(inp, b)}\n\nRESEARCH:\n${JSON.stringify(b.research || {}).slice(0, 9000)}\n\nFinalize the offer for the sales page. Use the 3Ts: a clear Transformation, a believable Timeline and Trust (proof, guarantee, founder credibility). Name the mechanism (the founder's method) with 3 to 5 steps. Build a value stack where each item answers one objection from the research, with honest standalone values (total around 4 to 10 times the price). Bonuses only if they help the buyer act faster. Keep the founder's price and payment options exactly as answered. If no price is given, pick one inside the research price range and say why in "changes". Urgency only if it is real (a stated deadline, launch price or limited spots from the answers), otherwise an empty string. Guarantee: use the founder's terms if given, otherwise a fair conditional guarantee.\nJSON: {"name":"","one_liner":"","promise":"","audience":"","mechanism":{"name":"","steps":[{"name":"","what":""}]},"price":{"amount":0,"currency":"USD","compare_at":null,"note":"one payment, lifetime access","plans":[{"label":"Or 3 payments","amount":0,"every":"a month"}]},"stack":[{"name":"","what":"","value":0}],"bonuses":[{"name":"","what":"","value":0}],"guarantee":{"name":"","days":30,"terms":""},"cta":"Get <short offer name>","urgency":"","changes":"one sentence on what you sharpened and why"}`, 4000);
  const o = j; o.price = o.price || {}; o.price.amount = num(o.price.amount) || null; o.price.compare_at = num(o.price.compare_at) || null; o.price.currency = /^[A-Z]{3}$/.test(o.price.currency || '') ? o.price.currency : 'USD';
  o.price.plans = (o.price.plans || []).filter((p) => num(p.amount) > 0).map((p) => ({ ...p, amount: num(p.amount) }));
  o.stack = (o.stack || []).filter((x) => x && x.name).map((x) => ({ ...x, value: num(x.value) || null })).slice(0, 8);
  o.bonuses = (o.bonuses || []).filter((x) => x && x.name).map((x) => ({ ...x, value: num(x.value) || null })).slice(0, 4);
  if (o.cta && o.cta.length > 34) o.cta = 'Get ' + clip(o.name, 24);
  o.by = by;
  return { patch: { offer: o }, note: `${o.price.amount ? R.money(o.price.amount, o.price.currency) : 'Price open'}${o.price.plans.length ? ' with a payment plan' : ''}. ${o.stack.length} stack items, ${o.bonuses.length} bonus${o.bonuses.length === 1 ? '' : 'es'}${o.guarantee && o.guarantee.days ? ', ' + o.guarantee.days + '-day guarantee' : ''}.` };
}

/* ---------- step: copy, then emails and the HighLevel handoff ---------- */
const COPY_SHAPE = '{"meta":{"title":"","description":""},"hero":{"eyebrow":"","headline":"one *accent phrase*","sub":"","cta":"","trust":"Instant access"},"proofbar":{"items":[{"n":"","label":""}]},"problem":{"eyebrow":"","title":"","intro":"","bullets":[""],"close":""},"story":{"eyebrow":"","title":"","paragraphs":[""]},"mechanism":{"title":"","intro":""},"compare":{"title":"","old_label":"","new_label":"","old":[""],"new":[""]},"outcomes":{"eyebrow":"","title":"","items":[{"title":"","body":""}]},"stack":{"title":"","intro":"","today_label":"Today","note":""},"bonuses":{"title":"","intro":""},"proof":{"title":"","items":[{"quote":"","name":"","role":"","result":""}]},"who":{"title":"","for":[""],"not_for":[""]},"guarantee":{"title":""},"about":{"eyebrow":"","title":"founder name","paragraphs":[""],"creds":[""]},"urgency":{"title":"","body":""},"faq":{"items":[{"q":"","a":""}]},"final":{"title":"","body":""},"ps":"","footer":{"owner":""}}';
async function stepCopy(b, inp, K) {
  const { j, by } = await llmJSON(K, SYS, `${brief(inp, b)}\n\nRESEARCH:\n${JSON.stringify(b.research || {}).slice(0, 7000)}\n\nFINAL OFFER:\n${JSON.stringify(b.offer || {}).slice(0, 6000)}\n\nWrite the full sales page copy. Structure (17P, in order): Promotional Bar (hero.eyebrow is the announcement line), Promise (hero), Problem and Pain Points in the reader's words (problem), Proof of Results (proofbar), Personal Epiphany from the founder's real facts (story), Process to Solution, the named method (mechanism), Positioning of Offer, old way and new way (compare), Product BTS Breakdown, what is inside (outcomes), Price Anchor (stack), Product Bonuses (bonuses), Proof of Recommendations and Project Spotlight case studies when real ones exist (proof), Perfect Persona, who it is for and not for (who), Pushback Reflex, risk reversal (guarantee), the founder (about), Priority, why act now (urgency), FAQ that answers each objection from the research, and the Promotional Bar final call (final) with a P.S. Pricing Tables come from the offer plans when there are several. Not every P fits every page: leave a section's strings empty when it does not fit this offer's price point and page type, rather than padding it.\nRules:\n- The hero headline is the strongest angle from the research, under 12 words, with one phrase wrapped in *asterisks* for the accent. Use *accent* once in other section titles where it helps.\n- Mirror the buyer words from the research. Short paragraphs, one idea each.\n- proofbar: 3 or 4 items that are true from the facts or the offer itself (for example the number of templates, days, modules). Never invent customer counts or results.\n- proof.items: only real testimonials given in the answers or facts, with names. If there are none, return an empty array.\n- urgency: only if the offer has real urgency, otherwise empty strings.\n- 6 to 8 FAQ items. Each "who" list has 3 or 4 items.\n- Write in the founder's voice. Around 1,100 to 1,500 words in total.\nJSON in exactly this shape: ${COPY_SHAPE}`, 7000);
  const c = j; if (c.proof && Array.isArray(c.proof.items)) c.proof.items = c.proof.items.filter((x) => x && x.quote && x.name);
  c.by = by;
  let emails = []; let handoff = {};
  try {
    const e = await llmJSON(K, SYS, `${brief(inp, b, 'short')}\n\nFINAL OFFER:\n${JSON.stringify(b.offer || {}).slice(0, 5000)}\n\nHERO: ${JSON.stringify(c.hero || {})}\n\nWrite what HighLevel needs to sell this offer. 1) Emails: purchase confirmation with access steps, an onboarding sequence that gets the buyer to the first result (day 1, 3, 7), and two cart-abandon emails (1 hour, 24 hours). Plain text, short, in the founder's voice. 2) The handoff: the products to create (one-time and payment plan exactly matching the offer price), a two-step order form layout, one order bump under a third of the price that helps them act faster, one upsell or downsell (use one of the founder's other offers when it fits, by name and price), and the purchase workflow steps in HighLevel terms (trigger, tags, membership access, email waits).\nJSON: {"emails":[{"when":"Right after purchase","subject":"","body":""}],"handoff":{"products":[{"name":"","price":0,"currency":"USD","type":"one-time"}],"order_form":"","bump":{"name":"","price":0,"copy":""},"upsell":{"name":"","price":0,"every":"","copy":""},"workflow":[""]}}`, 3500);
    emails = Array.isArray(e.j.emails) ? e.j.emails.filter((x) => x && x.subject && x.body).slice(0, 10) : []; handoff = e.j.handoff || {};
  } catch { /* the page matters most; emails can be regenerated with a revision */ }
  const words = JSON.stringify(c).replace(/"[a-z_]+":/g, ' ').split(/\s+/).length;
  return { patch: { copy: c, emails, handoff }, note: `${Object.keys(c).filter((k) => !/meta|footer|ps|by/.test(k)).length} sections, about ${Math.round(words / 10) * 10} words, ${emails.length} emails for HighLevel` };
}

/* ---------- step: brand kit ---------- */
async function readSite(url) {
  if (!/^https?:\/\//.test(url || '')) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 FoundersAIOS' } }); clearTimeout(t);
    const html = (await r.text()).slice(0, 600000);
    const hex = {}; (html.match(/#[0-9a-fA-F]{6}\b/g) || []).forEach((h) => { h = h.toLowerCase(); hex[h] = (hex[h] || 0) + 1; });
    const fonts = new Set(); (html.match(/family=([^&"':]+)/g) || []).forEach((m) => fonts.add(decodeURIComponent(m.slice(7)).replace(/\+/g, ' ')));
    (html.match(/font-family:\s*['"]?([^;'",]+)/g) || []).slice(0, 20).forEach((m) => fonts.add(m.replace(/font-family:\s*['"]?/, '').trim()));
    const title = (html.match(/<title[^>]*>([^<]{0,140})/i) || [])[1] || '';
    return { url, title, colors: Object.entries(hex).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([h]) => h), fonts: [...fonts].slice(0, 10) };
  } catch { return null; }
}
function fixBrand(br, name) {
  const d = { bg: '#f7f4ee', surface: '#fffdf9', ink: '#141210', muted: '#5f5a52', line: '#e4ddd1', accent: '#d9692f', deep: '#151311', deep_ink: '#f5f0e7' };
  const p = br.palette || {}; br.palette = Object.fromEntries(Object.keys(d).map((k) => [k, HEX.test(p[k] || '') ? p[k].toLowerCase() : d[k]]));
  const f = br.fonts || {}; br.fonts = { display: R.DISPLAY.includes(f.display) ? f.display : 'Instrument Serif', body: R.BODY.includes(f.body) ? f.body : 'Hanken Grotesk' };
  br.radius = Math.max(0, Math.min(28, num(br.radius) || 16)); br.name = clip(br.name, 80) || name; br.logo_text = clip(br.logo_text, 40) || name;
  return br;
}
/* ---------- the founder's brand board: chosen palette, font pairing, custom fonts and own photos ---------- */
const PHOTO = /^kit-photo-[a-z0-9-]{4,60}\.(jpg|png|webp)$/;
function brandPick(x) {
  if (!x || typeof x !== 'object') return null;
  const id = (v) => (/^[a-z0-9-]{1,40}$/i.test(String(v || '')) ? String(v) : null);
  const photos = (Array.isArray(x.photos) ? x.photos : []).filter((n) => PHOTO.test(String(n))).slice(0, 20);
  const p = { palette_id: id(x.palette_id), font_set_id: id(x.font_set_id), photos, image_mode: ['mine', 'mix', 'ai'].includes(x.image_mode) ? x.image_mode : (photos.length ? 'mix' : 'ai') };
  return p.palette_id || p.font_set_id || photos.length ? p : null;
}
function kitChoice(kit, pick) {
  kit = kit || {}; pick = pick || {};
  const hex = (v) => (HEX.test(v || '') ? v.toLowerCase() : null);
  const pal = (kit.palettes || []).find((x) => x && x.id === pick.palette_id);
  const fs = (kit.font_sets || []).find((x) => x && x.id === pick.font_set_id);
  const c = pal && pal.colors ? pal.colors : null;
  const palette = c && hex(c.bg) && hex(c.ink) && hex(c.accent) ? { bg: hex(c.bg), ink: hex(c.ink), accent: hex(c.accent), deep: hex(c.deep) || hex(c.ink), surface: hex(c.soft) || hex(c.bg) } : null;
  const custom = (kit.custom_fonts || []).filter((f) => f && f.family && /^kit-font-[a-z0-9-]{4,60}\.(woff2|woff|ttf|otf)$/.test(f.file || ''));
  const fonts = fs && fs.display && fs.body ? { display: clip(fs.display, 60), body: clip(fs.body, 60) } : null;
  const used = fonts ? custom.filter((f) => f.family === fonts.display || f.family === fonts.body) : [];
  return { palette, fonts, custom: used, name: { palette: pal && clip(pal.name, 60), fonts: fs && clip(fs.name, 60) } };
}
async function copyKitAsset(ws, id, from, to) {
  const a = await cron('cron_gfx_asset_get', { p_ws: ws, p_name: from });
  if (!a || !a.data) return null;
  await cron('cron_funnel_asset_put', { p_id: id, p_name: to, p_mime: a.mime, p_data: a.data });
  return to;
}
const tag = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5);

async function stepBrand(b, inp, K) {
  const a = b.answers || {}; const o = pickOffer(inp, b);
  const site = await readSite(a.website || (o && o.url) || '');
  const pick = brandPick((b.brand || {}).pick);
  let ch = { palette: null, fonts: null, custom: [], name: {} };
  if (pick) { try { ch = kitChoice(((await cron('cron_gfx_kit', { p_ws: b.workspace_id })) || {}).kit, pick); } catch { /* the board is optional */ } }
  const fixed = [ch.palette ? `THE FOUNDER CHOSE THIS PALETTE FROM THE BRAND BOARD. Use these exact colors: background ${ch.palette.bg}, surface ${ch.palette.surface}, ink ${ch.palette.ink}, accent ${ch.palette.accent}, deep ${ch.palette.deep}. Derive only muted, line and deep_ink so they sit well with them.` : '', ch.fonts ? `THE FOUNDER CHOSE THESE FONTS: display ${ch.fonts.display}, body ${ch.fonts.body}. Return exactly these.` : ''].filter(Boolean).join('\n');
  const { j, by } = await llmJSON(K, SYS, `${fixed ? fixed + '\n\n' : ''}${brief(inp, b, 'short')}\n\nOFFER: ${JSON.stringify({ name: (b.offer || {}).name, promise: (b.offer || {}).promise, audience: (b.offer || {}).audience })}\nHERO: ${JSON.stringify((b.copy || {}).hero || {})}\n${site ? `THE FOUNDER'S CURRENT SITE (${site.url}): colors ${site.colors.join(', ')}; fonts ${site.fonts.join(', ')}` : ''}\n\nBuild the brand kit for this sales page. It should feel like the founder's brand (Brand DNA, site colors and fonts above), applied to this offer. Restrained and premium: one light or warm neutral background, near-black ink, one accent used sparingly, one deep color for the dark sections. Pick fonts only from these Google Fonts. Display: ${R.DISPLAY.join(', ')}. Body: ${R.BODY.join(', ')}. Also write three image prompts for the page artwork in one consistent art direction that fits the palette: hero (the product or the outcome, landscape), story (the founder's world, no face, square), stack (the offer as a tangible bundle, portrait). Images must contain no text, letters, logos, UI or screens with words.\nJSON: {"name":"brand name","logo_text":"short wordmark for the nav","palette":{"bg":"#","surface":"#","ink":"#","muted":"#","line":"#","accent":"#","deep":"#","deep_ink":"#"},"fonts":{"display":"","body":""},"radius":16,"voice":["4 short voice rules"],"notes":"two sentences on the look","art_direction":"","prompts":{"hero":"","story":"","stack":""}}`, 2500);
  const br = fixBrand(j, (b.offer || {}).name || b.title); br.by = by; if (site) br.site = { url: site.url, colors: site.colors.slice(0, 6), fonts: site.fonts.slice(0, 4) };
  if (ch.palette) Object.assign(br.palette, ch.palette);
  if (ch.fonts) {
    br.fonts = { ...ch.fonts };
    const files = [];
    for (const f of ch.custom) {
      const ext = f.file.split('.').pop(); const to = `font-${slug(f.family).slice(0, 24)}-${tag()}.${ext}`;
      try { if (await copyKitAsset(b.workspace_id, b.id, f.file, to)) files.push({ family: f.family, file: to, format: ext }); } catch { /* falls back to a Google font */ }
    }
    if (files.length) br.fonts.custom = files;
    ['display', 'body'].forEach((k) => { if (!R.DISPLAY.concat(R.BODY).includes(br.fonts[k]) && !files.some((x) => x.family === br.fonts[k])) br.fonts[k] = fixBrand({}, '').fonts[k]; });
  }
  if (pick) br.pick = pick;
  const from = [ch.name.palette && `${ch.name.palette} palette`, ch.name.fonts && `${ch.name.fonts} fonts`].filter(Boolean).join(' and ');
  return { patch: { brand: br }, note: `${br.fonts.display} and ${br.fonts.body}, accent ${br.palette.accent}${from ? ', from your brand board (' + from + ')' : site ? ', matched to your site' : ''}` };
}

/* ---------- step: visuals ---------- */
const IMG_MODELS = (process.env.FUNNEL_IMAGE_MODELS || 'gpt-image-2,gpt-image-1.5,gpt-image-1').split(',');
const OR_MODELS = (process.env.FUNNEL_OPENROUTER_MODELS || 'openai/gpt-image-2,google/gemini-3-pro-image,black-forest-labs/flux-3-image').split(',');
const RATIO = { '1536x1024': '3:2', '1024x1024': '1:1', '1024x1536': '2:3' };
const skip = (e) => [400, 404, 403, 422].includes(e.status) || /not (a valid|found|available|supported)|no endpoints/i.test(e.message || '');
// OpenRouter first when connected, then the founder's OpenAI key. Each tries its models in order.
// PNGs from image models run 2 MB and up. WebP keeps sales pages fast.
async function toWebp(r) {
  if (r.mime === 'image/webp') return r;
  try { const sharp = require('sharp'); const out = await sharp(Buffer.from(r.b64, 'base64')).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); r.b64 = out.toString('base64'); r.mime = 'image/webp'; } catch { /* keep the original */ }
  return r;
}
async function image(K, prompt, size) {
  let last;
  if (K.openrouter && K.openrouter.key) {
    const list = [K.openrouter.model, ...OR_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
    for (const model of list) {
      try {
        const j = await jf('OpenRouter images', 'https://openrouter.ai/api/v1/images', { method: 'POST', timeout: 170000, headers: { Authorization: 'Bearer ' + K.openrouter.key, 'Content-Type': 'application/json', 'HTTP-Referer': APP_URL, 'X-Title': 'Founders AI OS' }, body: JSON.stringify({ model, prompt, aspect_ratio: RATIO[size] || '1:1', resolution: '1K', n: 1 }) });
        const d = j && j.data && j.data[0];
        let b64 = d && d.b64_json, mime = (d && d.media_type) || 'image/png';
        if (!b64 && d && d.url && /^data:image\//.test(d.url)) { mime = d.url.slice(5, d.url.indexOf(';')); b64 = d.url.slice(d.url.indexOf(',') + 1); }
        if (b64 && /^image\/(png|jpeg|webp)$/.test(mime)) return { b64, mime, model: 'openrouter:' + model };
        last = bad('OpenRouter ' + model + ' sent no image', 502);
      } catch (e) { last = e; if (e.status === 402 || /credit|insufficient/i.test(e.message || '')) break; if (!skip(e) && e.status !== 429 && e.status !== 502) break; }
    }
  }
  if (K.openai && K.openai.key) {
    for (const model of IMG_MODELS) {
      try {
        const j = await jf('OpenAI images', 'https://api.openai.com/v1/images/generations', { method: 'POST', timeout: 170000, headers: { Authorization: 'Bearer ' + K.openai.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, size, n: 1, quality: 'medium', output_format: 'webp', output_compression: 82 }) });
        const d = j && j.data && j.data[0]; if (d && d.b64_json) return { b64: d.b64_json, mime: 'image/webp', model };
      } catch (e) { last = e; if (!skip(e)) break; }
    }
  }
  throw last || bad('No image model answered', 502);
}
// The founder's own brand photos go in first. Mix: real photos for the story and about sections, AI art for the hero and stack.
// Mine: only the founder's photos. AI: generated images only.
async function ownPhotos(b, only) {
  const pick = brandPick((b.brand || {}).pick); const mode = pick ? pick.image_mode : 'ai';
  if (!pick || mode === 'ai' || !pick.photos.length) return { assets: {}, slots: [], map: {} };
  const have = ((b.visuals || {}).photos) || {}; const map = {}; const names = [];
  for (const n of pick.photos) {
    if (have[n]) { map[n] = have[n]; names.push(have[n]); continue; }
    if (only) continue;
    try { const to = await copyKitAsset(b.workspace_id, b.id, n, `photo-${names.length + 1}-${tag()}.${n.split('.').pop()}`); if (to) { map[n] = to; names.push(to); } } catch { /* skip this one */ }
  }
  if (!names.length) return { assets: {}, slots: [], map };
  const assets = {};
  const order = mode === 'mine' ? ['hero', 'story', 'about', 'stack'] : ['story', 'about'];
  order.forEach((slot, i) => { if (names[i]) assets[slot] = names[i]; });
  if (!assets.about && names[0]) assets.about = names[0];
  names.forEach((n, i) => { if (!Object.values(assets).includes(n)) assets['photo_' + (i + 1)] = n; });
  return { assets, slots: Object.keys(assets).filter((k) => ['hero', 'story', 'stack'].includes(k)), map, mode };
}
async function stepVisuals(b, inp, K, only) {
  const br = b.brand || {}; const P = br.prompts || {};
  const own = await ownPhotos(b, only);
  if (own.slots.length || Object.keys(own.assets).length) {
    b = { ...b, assets: { ...(b.assets || {}), ...own.assets } };
    only = (only || ['hero', 'story', 'stack']).filter((x) => !own.slots.includes(x));
  }
  const ownNote = Object.keys(own.assets).length ? `${Object.keys(own.map).length} of your brand photos placed` : '';
  const ownVis = (v) => ({ ...v, ...(Object.keys(own.map).length ? { photos: { ...(((b.visuals || {}).photos) || {}), ...own.map }, photo_mode: own.mode } : {}) });
  if (only && !only.length) return { patch: { assets: b.assets, visuals: ownVis({ ...(b.visuals || {}), method: 'photos', fails: [] }) }, note: ownNote || 'Your photos are on the page' };
  if (!(K.openai && K.openai.key) && !(K.openrouter && K.openrouter.key)) return { patch: { visuals: ownVis({ method: 'svg', images: [] }), assets: b.assets || {} }, note: (ownNote ? ownNote + '. ' : '') + 'Brand artwork drawn in code. Connect OpenRouter or OpenAI for generated images.' };
  const style = `${br.art_direction || 'Editorial, calm, premium product photography with soft natural light'}. Palette: ${Object.values(br.palette || {}).slice(0, 7).join(', ')}. No text, no letters, no words, no logos, no watermarks, no UI with readable text.`;
  const jobs = [['hero', P.hero || `The ${(b.offer || {}).name} as a premium product, outcome-focused scene`, '1536x1024'], ['story', P.story || 'A calm, real workspace of a founder, no face visible', '1024x1024'], ['stack', P.stack || `The ${(b.offer || {}).name} as a tangible bundle of materials on a table`, '1024x1536']].filter(([slot]) => !only || only.includes(slot));
  const assets = { ...(b.assets || {}) }; const images = []; const fails = [];
  await Promise.all(jobs.map(async ([slot, prompt, size]) => {
    try {
      const r = await image(K, `${prompt}. ${style}`, size);
      await toWebp(r);
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[r.mime] || 'png';
      const name = `${slot}-v${(b.version || 0) + 1}-${Date.now().toString(36).slice(-4)}.${ext}`;
      await cron('cron_funnel_asset_put', { p_id: b.id, p_name: name, p_mime: r.mime, p_data: r.b64 });
      assets[slot] = name; images.push({ slot, name, model: r.model, prompt: clip(prompt, 400) });
    } catch (e) { fails.push(slot + ': ' + clip(e.message, 120)); }
  }));
  const ok = images.length;
  return { patch: { assets, visuals: ownVis({ method: ok ? 'openai' : 'svg', images: [...((b.visuals || {}).images || []).filter((x) => !images.some((y) => y.slot === x.slot)), ...images], fails }) }, note: (ownNote ? ownNote + '. ' : '') + (ok ? `${ok} image${ok === 1 ? '' : 's'} generated${fails.length ? ', ' + fails.length + ' drawn in code' : ''}` : (fails.some((f) => /credit|quota|billing/i.test(f)) ? 'Your image account is out of credits, so the artwork was drawn in code. Add credits on OpenRouter or OpenAI, then ask for new images in a revision.' : 'Image generation did not answer, so the artwork was drawn in code. Ask for new images in a revision.')) };
}

/* ---------- step: design ---------- */
async function stepDesign(b, inp, K) {
  const has = (k) => { const c = (b.copy || {})[k]; return c && JSON.stringify(c).replace(/[{}\[\]":,\s]|title|items|paragraphs|eyebrow|intro|body/g, '').length > 10; };
  let d = {};
  try {
    const r = await llmJSON(K, SYS, `OFFER: ${(b.offer || {}).name} at ${((b.offer || {}).price || {}).amount || '?'}. Audience: ${(b.offer || {}).audience || ''}.\nResearch summary: ${((b.research || {}).summary || '').slice(0, 800)}\nBrand: ${JSON.stringify({ palette: (b.brand || {}).palette, fonts: (b.brand || {}).fonts, notes: (b.brand || {}).notes })}\nSections with copy: ${R.SECTIONS.filter(has).join(', ')}\n\nDesign the page layout. Choose hero "split" (text left, image right) or "centered", hero_tone "light" or "deep", buttons "pill" or "soft", radius 0 to 24, and the section order. Keep hero first and final last. Put the stack where the reader is ready to buy, usually after the mechanism and outcomes. Guarantee right after the stack or the proof.\nJSON: {"hero":"split","hero_tone":"light","button":"pill","radius":16,"order":["hero","..."],"why":"two sentences"}`, 1200);
    d = r.j; d.by = r.by;
  } catch { d = {}; }
  const order = (Array.isArray(d.order) ? d.order : []).filter((k, i, a) => R.SECTIONS.includes(k) && a.indexOf(k) === i);
  const base = ['hero', 'proofbar', 'problem', 'story', 'mechanism', 'compare', 'outcomes', 'stack', 'bonuses', 'proof', 'who', 'guarantee', 'about', 'urgency', 'faq', 'final'];
  base.forEach((k) => { if (!order.includes(k)) order.splice(Math.max(0, order.indexOf('final') === -1 ? order.length : order.indexOf('final')), 0, k); });
  const o2 = order.filter((k) => k !== 'hero' && k !== 'final'); d.order = ['hero', ...o2, 'final'];
  d.hero = d.hero === 'centered' ? 'centered' : 'split'; d.hero_tone = d.hero_tone === 'deep' ? 'deep' : 'light'; d.button = d.button === 'soft' ? 'soft' : 'pill'; d.radius = Math.max(0, Math.min(24, num(d.radius) || (b.brand || {}).radius || 16));
  return { patch: { design: d }, note: `${d.hero === 'split' ? 'Split' : 'Centered'} hero, ${d.hero_tone} tone. ${clip(d.why, 160) || ''}`.trim() };
}

/* ---------- step: build ---------- */
const spec = (b) => ({ brand: b.brand || {}, design: b.design || {}, offer: b.offer || {}, copy: b.copy || {}, assets: b.assets || {}, links: { checkout: (b.links || {}).checkout || (b.answers || {}).checkout_url || '', support: (b.links || {}).support || '' } });
function previewUrl(b) { return `${APP_URL}/preview/${b.id}/${b.preview_key}`; }
function stepBuild(b, inp, K, note) {
  const s = spec(b); const html = R.render(s, { base: 'assets/', absolute: (b.deploy && b.deploy.url ? b.deploy.url + '/' : '') });
  const qa = R.qa(html, s); const v = (b.version || 0) + 1;
  return { patch: { html, qa, version: v, version_push: { v, at: now(), note: note || (v === 1 ? 'First build' : 'Rebuilt'), by: 'Funnel Agent' }, links: { preview: previewUrl(b) } }, note: `Version ${v}. ${qa.words} words, ${qa.sections} sections, ${qa.ctas} buttons. ${qa.ok ? 'Checks passed.' : 'Check: ' + qa.issues.filter((x) => !/^Buttons point/.test(x)).join(', ')}` };
}

/* ---------- builders: Claude or Codex write the page code themselves ---------- */
const ENGINE = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' };
const CRAFT_MS = 268000; // one call has to fit in one 300 second run
const DESIGNER = 'You are a world-class conversion designer and front-end engineer. You hand-build one bespoke sales page as a single index.html file. It must look like a premium studio made it for this brand, not a template: a clear typographic system, generous rhythm, strong hierarchy, real art direction around the images, and layouts that change from section to section. It must convert: one offer, one action, the price and guarantee easy to find, every objection answered. Rules: one self-contained file with inline CSS and inline JavaScript only. The only external resource allowed is Google Fonts for the two brand fonts. No frameworks, no CDNs, no tracking, no external images. Use the image paths exactly as given. Light mode. Mobile first and flawless from 360px to 1600px wide. Accessible contrast, visible focus states, semantic HTML, alt text, and prefers-reduced-motion respected. Motion is natural and quick: short fades and rises on scroll, nothing floaty, no scroll hijacking. All content must be visible if JavaScript never runs: only hide elements for a reveal after your script has added a class to the html element, and reveal anything already in view right away. Every call-to-action button links to the checkout URL given, or to #offer when there is none. The offer section has id="offer". Put a call-to-action in the hero, after the offer stack, in the offer section, after the guarantee and at the end, and give every call-to-action link the attribute data-cta. Give every section a data-section attribute with its key from the copy (hero, problem, story, offer, faq and so on). Keep every fact, price, name, number and guarantee exactly as given. You may tighten copy but never invent testimonials, numbers, logos or results. Never use em dashes, exclamation points or emojis. Return only the HTML, starting with <!doctype html> and ending with </html>.';
async function orChat(key, model, system, user, max, effort, ms) {
  const j = await jf('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', { method: 'POST', timeout: ms || CRAFT_MS, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': APP_URL, 'X-Title': 'Founders AI OS' }, body: JSON.stringify({ model, max_tokens: max, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], ...(effort ? { reasoning: { effort } } : {}) }) });
  const text = (((j.choices || [])[0] || {}).message || {}).content || '';
  if (!text) throw bad('OpenRouter ' + model + ' returned nothing', 502);
  return { text: String(text), by: model };
}
// Claude streams so a long page can carry on across runs instead of timing out.
async function claudeStream(key, system, messages, deadline) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), Math.max(5000, deadline - Date.now()));
  let r;
  try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.FUNNEL_CLAUDE_BUILDER || 'claude-opus-5-5', max_tokens: 32000, system, messages, stream: true, output_config: { effort: process.env.FUNNEL_CLAUDE_EFFORT || 'low' } }) }); }
  catch (e) { clearTimeout(timer); throw bad('Claude could not be reached right now', 502); }
  if (!r.ok) { clearTimeout(timer); const t = await r.text().catch(() => ''); let m = ''; try { m = JSON.parse(t).error.message; } catch { m = t.slice(0, 160); } throw bad('Claude: ' + (m || r.status), 502); }
  let text = ''; let buf = ''; let stop = null; const dec = new TextDecoder();
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true }); let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1); if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') text += ev.delta.text;
        else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') throw bad('Claude: ' + ((ev.error || {}).message || 'stream error'), 502);
      }
    }
  } catch (e) { if (e.status) { clearTimeout(timer); throw e; } }
  clearTimeout(timer);
  return { text, done: !!stop && stop !== 'max_tokens' };
}
const CONTINUE = 'You ran out of time in the middle of the file. Continue it from the exact character where it stops above. Do not repeat anything, do not start over and do not add commentary or code fences. Output only the rest of the file.';
// One builder pass. Returns { html, label } when the page is complete, or { draft } when Claude needs another run.
async function craftRun(b, K, user, kind) {
  const engine = b.engine; const t0 = Date.now(); const deadline = t0 + (+process.env.FUNNEL_CRAFT_MS || 262000);
  let d = null; try { d = b.draft ? JSON.parse(b.draft) : null; } catch { d = null; }
  if (!d || d.e !== engine || d.k !== kind) d = null;
  let last;
  if (engine === 'claude' && K.claude && K.claude.key) {
    try {
      const messages = [{ role: 'user', content: user }]; if (d) messages.push({ role: 'assistant', content: d.t }, { role: 'user', content: CONTINUE });
      const r = await claudeStream(K.claude.key, DESIGNER, messages, deadline);
      let add = r.text.replace(/^\s*```(?:html)?\s*/i, ''); if (r.done) add = add.replace(/\s*```\s*$/, '');
      const full = d && !/^\s*<!doctype html>/i.test(add) ? d.t + add : add;
      if (r.done || /<\/html>\s*$/i.test(full)) return { html: cleanHtml(full), label: 'Claude Opus 5.5' };
      const n = d ? d.n + 1 : 1;
      if (n <= 3 && add.length > 1500) return { draft: JSON.stringify({ e: engine, k: kind, n, t: full }), kb: Math.round(full.length / 1024) };
      last = bad('Claude stopped before the page was finished', 502);
    } catch (e) { last = e; }
    if (Date.now() - t0 > 60000) throw last;
  }
  if (engine === 'claude' && !(K.openrouter && K.openrouter.key)) throw last || bad('Connect Claude or OpenRouter in Connections to build with Claude.', 409);
  const r = await craftCall(engine, K, DESIGNER, user, Math.max(30000, deadline - Date.now()), engine === 'claude');
  return { html: cleanHtml(r.text), label: r.label };
}
// The founder's own key goes first, then OpenRouter with the same model family.
async function craftCall(engine, K, system, user, ms, orOnly) {
  const t0 = Date.now(); const tries = []; const T = ms || CRAFT_MS;
  if (engine === 'claude') {
    if (K.openrouter && K.openrouter.key) tries.push(['Claude Opus 5.5 on OpenRouter', () => orChat(K.openrouter.key, 'anthropic/claude-opus-5.5', system, user, 32000, 'low', T)]);
  } else if (engine === 'gemini') {
    if (K.openrouter && K.openrouter.key) tries.push(['Gemini 4 Carbon', () => orChat(K.openrouter.key, GEMINI, system, user, 40000, 'low', T)]);
  } else {
    if (K.openai && K.openai.key && !orOnly) tries.push(['GPT-5.3 Codex', () => jf('OpenAI', 'https://api.openai.com/v1/responses', { method: 'POST', timeout: T, headers: { Authorization: 'Bearer ' + K.openai.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.FUNNEL_CODEX_BUILDER || 'gpt-5.3-codex', instructions: system, input: user, max_output_tokens: 40000, reasoning: { effort: 'low' } }) }).then((j) => ({ text: j.output_text || (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join(''), by: 'gpt-5.3-codex' }))]);
    if (K.openrouter && K.openrouter.key) tries.push(['GPT-5.3 Codex on OpenRouter', () => orChat(K.openrouter.key, 'openai/gpt-5.3-codex', system, user, 40000, 'low', T - (Date.now() - t0))]);
  }
  if (!tries.length) throw bad(engine === 'claude' ? 'Connect Claude or OpenRouter in Connections to build with Claude.' : engine === 'gemini' ? 'Connect OpenRouter in Connections to build with Gemini.' : 'Connect OpenAI or OpenRouter in Connections to build with Codex.', 409);
  let last;
  for (const [label, fn] of tries) {
    if (last && Date.now() - t0 > 60000) break; // no time left for a second full call in this run
    try { const r = await fn(); if (r.text && r.text.trim()) return { ...r, label }; last = bad(label + ' returned nothing', 502); } catch (e) { last = e; }
  }
  throw last;
}
function cleanHtml(t) {
  let h = String(t || ''); const a = h.search(/<!doctype html>/i); const z = h.toLowerCase().lastIndexOf('</html>');
  if (a === -1 || z === -1) throw bad('The builder did not return a full page', 502);
  h = h.slice(a, z + 7);
  // house rules, enforced on the page text
  h = h.replace(/\s*\u2014\s*/g, ', ').replace(/&mdash;/g, ', ');
  h = h.replace(/<script[^>]+src=["'](?!https:\/\/fonts\.)[^"']+["'][^>]*>\s*<\/script>/gi, '');
  if (h.length < 6000) throw bad('The page came back too short', 502);
  return h;
}
function craftBrief(b, inp) {
  const s = spec(b); const A = s.assets || {};
  const real = new Set(Object.values(((b.visuals || {}).photos) || {}));
  const imgs = Object.entries(A).map(([slot, name]) => ({ slot, path: 'assets/' + name, real_photo_of_the_founder: real.has(name) || undefined, use: { hero: 'Hero image, wide 3:2', story: 'Founder story section, square', stack: 'Offer stack section, tall 2:3', about: 'About the founder section' }[slot] || 'Extra real photo of the founder. Use it where a face builds trust: story, about, proof or the final call' }));
  const cf = ((s.brand || {}).fonts || {}).custom || [];
  return `${brief(inp, b, 'short')}

BRAND KIT (use these fonts and these colors only. Fonts load from Google Fonts unless listed as custom files below):
${JSON.stringify(s.brand).slice(0, 6000)}

DESIGN DIRECTION FROM THE PLANNING STEP (section order, hero layout, tone). Improve on it freely:
${JSON.stringify(s.design).slice(0, 4000)}

THE FINAL OFFER:
${JSON.stringify(s.offer).slice(0, 8000)}

THE SALES COPY, SECTION BY SECTION (every section must appear):
${JSON.stringify(s.copy).slice(0, 40000)}

IMAGES (already made, use each one where it says. Real photos of the founder must never be cropped so the face is cut):
${imgs.length ? JSON.stringify(imgs) : 'None. Draw the art direction with CSS and inline SVG instead.'}
${cf.length ? `\nCUSTOM FONT FILES (load each with @font-face from this path, font-display swap, and do not request these families from Google Fonts):\n${JSON.stringify(cf.map((f) => ({ family: f.family, src: 'assets/' + f.file, format: f.format })))}` : ''}

CHECKOUT URL: ${s.links.checkout || 'none yet, link buttons to #offer'}
Page title and meta description from the offer. Footer with the founder or brand name, the year and Terms and Privacy links to #.`;
}
async function stepCraft(b, inp, K, note) {
  const engine = b.engine; const who = ENGINE[engine];
  const s = spec(b); const v = (b.version || 0) + 1;
  try {
    const r = await craftRun(b, K, craftBrief(b, inp), 'build');
    if (r.draft) return { patch: { draft: r.draft }, next: 'build', keep: true, note: `${who} is still writing the page code (${r.kb} KB so far). It carries on in the next run.` };
    const html = r.html; const qa = R.qa(html, s);
    return { patch: { html, qa, draft: '', version: v, version_push: { v, at: now(), note: note || (v === 1 ? 'First build' : 'Rebuilt with ' + who), by: who }, links: { preview: previewUrl(b) } }, note: `Version ${v}, hand-built by ${r.label}. ${qa.words} words, ${qa.sections} sections, ${qa.ctas} buttons. ${qa.ok ? 'Checks passed.' : 'Check: ' + qa.issues.filter((x) => !/^Buttons point/.test(x)).join(', ')}` };
  } catch (e) {
    if (e.status === 409) throw e;
    const fb = stepBuild(b, inp, K, (note || 'Built') + ' with the OS builder');
    fb.patch.draft = '';
    fb.note = `${who} could not finish (${clip(e.message, 140)}). Built with the OS builder instead. Press Build with ${who} to try again. ` + fb.note;
    return fb;
  }
}
// A new checkout link on a hand-built page: swap the button links in the code.
function relink(b, url) {
  const old = (b.links || {}).checkout || (b.answers || {}).checkout_url || ''; let html = b.html;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (old) html = html.replace(new RegExp('href=(["\'])' + esc(old) + '\\1', 'g'), 'href="' + (url || '#offer') + '"');
  else if (url) html = html.replace(/<a([^>]*?)href=(["'])#offer\2/g, '<a$1href="' + url + '"');
  const v = (b.version || 0) + 1;
  return { patch: { html, qa: R.qa(html, spec({ ...b, links: { ...(b.links || {}), checkout: url } })), version: v, version_push: { v, at: now(), note: url ? 'Checkout link added' : 'Checkout link removed', by: ENGINE[b.engine] }, links: { preview: previewUrl(b) } }, note: `Version ${v}. ${url ? 'Buttons now go to your checkout.' : 'Buttons point to the offer section.'}` };
}
// Revisions on a hand-built page go back to the same builder with the current code.
async function craftRevise(b, inp, K, request, swaps) {
  let html = b.html || '';
  Object.entries(swaps || {}).forEach(([a, z]) => { if (a && z) html = html.split('assets/' + a).join('assets/' + z); });
  return craftRun(b, K, `${brief(inp, b, 'short')}\n\nTHE CURRENT PAGE (index.html):\n${html.slice(0, 160000)}\n\nTHE FOUNDER'S REVISION REQUEST:\n${request}\n\nApply the request with care and keep everything else as it is. Return the full updated index.html.`, 'edit');
}

/* ---------- step: publish to the founder's own GitHub and Vercel ---------- */
const GH = 'https://api.github.com';
const ghH = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'FoundersAIOS' });
async function files(b) {
  const out = [];
  const html = b.html || stepBuild(b).patch.html;
  out.push({ path: 'index.html', content: Buffer.from(html, 'utf8') });
  const assets = await cron('cron_funnel_assets', { p_id: b.id }).catch(() => []);
  const used = new Set(Object.values(b.assets || {}));
  (assets || []).filter((a) => used.has(a.name) || html.includes('assets/' + a.name)).forEach((a) => out.push({ path: 'assets/' + a.name, content: Buffer.from(a.data, 'base64') }));
  const o = b.offer || {}; const h = b.handoff || {}; const pr = o.price || {};
  const md = (xs) => (xs || []).map((x) => '- ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
  out.push({ path: 'README.md', content: Buffer.from(`# ${o.name || b.title}\n\nSales page built by the Funnel Agent in Founders AI OS.\n\n- Live page: ${(b.deploy && b.deploy.url) || 'publishing'}\n- Preview in the OS: ${previewUrl(b)}\n- Version: ${b.version}\n\n## Files\n\n- \`index.html\` the full page, one file, no build step. Google Fonts only.\n- \`assets/\` generated images.\n- \`spec.json\` offer, copy, brand and design the page was built from.\n- \`HIGHLEVEL.md\` products, order form, bump, upsell, workflow and emails to set up in HighLevel.\n\n## Edit with Claude Code, Codex or any agent\n\nEdit \`index.html\` and push to this repo. Then press Sync from GitHub on the build in Founders AI OS, or call the \`funnel_update\` tool over MCP, and the OS saves a new version and publishes it again.\n\n## Move it into HighLevel\n\nImport this repo into HighLevel AI Studio, or paste \`index.html\` into a custom code element. Replace the checkout link with your HighLevel order form if it is not set yet.\n`, 'utf8') });
  out.push({ path: 'HIGHLEVEL.md', content: Buffer.from(`# HighLevel setup for ${o.name || b.title}\n\n## Products\n\n${md((h.products || []).map((p) => `${p.name}: ${R.money(p.price, p.currency || pr.currency || 'USD')} (${p.type || 'one-time'})`))}\n\n## Order form\n\n${h.order_form || 'Two-step order form.'}\n\n## Order bump\n\n${h.bump ? `${h.bump.name}, ${R.money(h.bump.price, pr.currency || 'USD')}. ${h.bump.copy || ''}` : 'None'}\n\n## Upsell\n\n${h.upsell ? `${h.upsell.name}, ${R.money(h.upsell.price, pr.currency || 'USD')}${h.upsell.every ? ' ' + h.upsell.every : ''}. ${h.upsell.copy || ''}` : 'None'}\n\n## Purchase workflow\n\n${md(h.workflow)}\n\n## Emails\n\n${(b.emails || []).map((e) => `### ${e.when}: ${e.subject}\n\n${e.body}`).join('\n\n')}\n`, 'utf8') });
  out.push({ path: 'spec.json', content: Buffer.from(JSON.stringify({ ...spec(b), research: b.research, emails: b.emails, handoff: b.handoff, version: b.version }, null, 2), 'utf8') });
  return out;
}
async function pushGitHub(b, token, fs) {
  const me = await jf('GitHub', GH + '/user', { headers: ghH(token) });
  let repo = b.repo && b.repo.full_name ? await jf('GitHub', GH + '/repos/' + b.repo.full_name, { headers: ghH(token) }).catch(() => null) : null;
  if (!repo) {
    const base = slug((b.offer || {}).name || b.title) + '-sales-page';
    for (const name of [base, base + '-' + b.id.slice(0, 6)]) {
      try { repo = await jf('GitHub', GH + '/user/repos', { method: 'POST', headers: ghH(token), body: JSON.stringify({ name, private: true, auto_init: true, description: `Sales page for ${(b.offer || {}).name || b.title}. Built by the Funnel Agent in Founders AI OS.` }) }); break; }
      catch (e) { if (e.status !== 422) throw e; }
    }
    if (!repo) throw bad('GitHub would not create the repository', 502);
  }
  const full = repo.full_name; const branch = repo.default_branch || 'main';
  let ref = null; for (let i = 0; i < 6 && !ref; i++) { ref = await jf('GitHub', `${GH}/repos/${full}/git/ref/heads/${branch}`, { headers: ghH(token) }).catch(() => null); if (!ref) await new Promise((r) => setTimeout(r, 1500)); }
  if (!ref) throw bad('GitHub repository is not ready yet. Publishing retries on the next run.', 502);
  const parent = await jf('GitHub', `${GH}/repos/${full}/git/commits/${ref.object.sha}`, { headers: ghH(token) });
  const tree = [];
  for (const f of fs) { const bl = await jf('GitHub', `${GH}/repos/${full}/git/blobs`, { method: 'POST', timeout: 60000, headers: ghH(token), body: JSON.stringify({ content: f.content.toString('base64'), encoding: 'base64' }) }); tree.push({ path: f.path, mode: '100644', type: 'blob', sha: bl.sha }); }
  const t = await jf('GitHub', `${GH}/repos/${full}/git/trees`, { method: 'POST', headers: ghH(token), body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
  const c = await jf('GitHub', `${GH}/repos/${full}/git/commits`, { method: 'POST', headers: ghH(token), body: JSON.stringify({ message: `Version ${b.version}: ${clip(((b.versions || []).slice(-1)[0] || {}).note, 120) || 'Sales page update'}\n\nBuilt by the Funnel Agent in Founders AI OS.`, tree: t.sha, parents: [parent.sha] }) });
  await jf('GitHub', `${GH}/repos/${full}/git/refs/heads/${branch}`, { method: 'PATCH', headers: ghH(token), body: JSON.stringify({ sha: c.sha, force: false }) });
  return { full_name: full, url: repo.html_url, branch, owner: me.login, commit: c.sha, at: now() };
}
async function deployVercel(b, cfg, fs) {
  const token = cfg.key || cfg.token; const team = cfg.team || cfg.team_id || cfg.teamId; const tq = team ? '?teamId=' + q(team) : '';
  const H = { Authorization: 'Bearer ' + token };
  const list = [];
  for (const f of fs.filter((x) => x.path === 'index.html' || x.path.startsWith('assets/'))) {
    const sha = crypto.createHash('sha1').update(f.content).digest('hex');
    await jf('Vercel', 'https://api.vercel.com/v2/files' + tq, { method: 'POST', timeout: 60000, headers: { ...H, 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha, 'Content-Length': String(f.content.length) }, body: f.content });
    list.push({ file: f.path, sha, size: f.content.length });
  }
  const name = (b.deploy && b.deploy.project) || (slug((b.offer || {}).name || b.title) + '-sales-page').slice(0, 90);
  const d = await jf('Vercel', 'https://api.vercel.com/v13/deployments' + tq + (tq ? '&' : '?') + 'skipAutoDetectionConfirmation=1', { method: 'POST', timeout: 60000, headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, files: list, target: 'production', projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null } }) });
  let st = d; for (let i = 0; i < 30 && !/READY|ERROR|CANCELED/.test(st.readyState || ''); i++) { await new Promise((r) => setTimeout(r, 2500)); st = await jf('Vercel', `https://api.vercel.com/v13/deployments/${d.id}${tq}`, { headers: H }).catch(() => st); }
  if (st.readyState === 'ERROR') throw bad('Vercel could not deploy the page: ' + clip(st.errorMessage || 'build error', 160), 502);
  const pid = st.projectId || d.projectId;
  try { await jf('Vercel', `https://api.vercel.com/v9/projects/${pid}${tq}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ ssoProtection: null }) }); } catch { /* the page still has the deployment URL */ }
  let host = null;
  try { const dm = await jf('Vercel', `https://api.vercel.com/v9/projects/${pid}/domains${tq}`, { headers: H }); const ds = (dm.domains || []).map((x) => x.name); host = ds.find((x) => !/\.vercel\.app$/.test(x)) || ds.find((x) => x === name + '.vercel.app') || ds[0] || null; } catch { /* fall back below */ }
  host = host || (st.alias && st.alias[0]) || st.url;
  return { project: name, project_id: pid, id: d.id, state: st.readyState || 'QUEUED', url: 'https://' + host, deployment_url: 'https://' + (st.url || d.url), at: now() };
}
async function stepPublish(b, inp, K) {
  const links = { preview: previewUrl(b) };
  const gh = K.github && K.github.key; const vc = K.vercel && (K.vercel.key || K.vercel.token);
  if (!gh && !vc) return { patch: { links }, note: 'Preview ready in the OS. Connect GitHub and Vercel in Connections to publish to your own accounts.' };
  const fs = await files(b); const notes = []; const patch = { links };
  const fromGit = ((b.versions || []).slice(-1)[0] || {}).by === 'GitHub';
  if (gh && !fromGit) { try { patch.repo = await pushGitHub(b, gh, fs); notes.push('Pushed to GitHub ' + patch.repo.full_name); } catch (e) { notes.push('GitHub: ' + clip(e.message, 140)); patch.repo = { ...(b.repo || {}), error: clip(e.message, 200), at: now() }; } }
  if (vc) { try { patch.deploy = { ...(b.deploy || {}), ...(await deployVercel(b, K.vercel, fs)), error: null }; links.live = patch.deploy.url; notes.push('Live on ' + patch.deploy.url.replace(/^https:\/\//, '')); } catch (e) { notes.push('Vercel: ' + clip(e.message, 140)); patch.deploy = { ...(b.deploy || {}), error: clip(e.message, 200), at: now() }; } }
  const vs = (b.versions || []).slice(); const last = vs[vs.length - 1]; if (last && links.live) { last.url = links.live; patch.versions_fix = true; }
  return { patch, note: notes.join('. ') };
}

/* ---------- revisions and syncs ---------- */
async function stepRevise(b, inp, K) {
  const revs = (b.revisions || []).slice(); const r = revs.slice().reverse().find((x) => x.state === 'queued');
  if (!r) return { patch: {}, note: 'Nothing to revise', next: 'publish' };
  const cur = { offer: b.offer, copy: b.copy, brand: { palette: (b.brand || {}).palette, fonts: (b.brand || {}).fonts, radius: (b.brand || {}).radius, prompts: (b.brand || {}).prompts, art_direction: (b.brand || {}).art_direction }, design: b.design, links: { checkout: (b.links || {}).checkout || (b.answers || {}).checkout_url || '' } };
  const { j } = await llmJSON(K, SYS, `${brief(inp, b, 'short')}\n\nTHE CURRENT PAGE SPEC:\n${JSON.stringify(cur).slice(0, 30000)}\n\nSection keys: ${R.SECTIONS.join(', ')}. Fonts allowed, display: ${R.DISPLAY.join(', ')}; body: ${R.BODY.join(', ')}.\n\nTHE FOUNDER'S REVISION REQUEST:\n${r.request}\n\nApply the request. Return only the parts that change as a patch with the same shape (objects merge, arrays replace whole). To move sections, return design.order with every section key. To change an image, list its slot (hero, story, stack) in "images" and rewrite brand.prompts for it. Keep every rule about honesty and style.\nJSON: {"summary":"one sentence on what changed","patch":{"copy":{},"offer":{},"brand":{},"design":{},"links":{}},"images":[]}`, 6000);
  const p = j.patch || {}; const nb = { ...b };
  ['copy', 'offer', 'design'].forEach((k) => { if (p[k] && typeof p[k] === 'object') nb[k] = R.merge(b[k] || {}, p[k]); });
  if (p.brand && typeof p.brand === 'object') nb.brand = fixBrand(R.merge(b.brand || {}, p.brand), (nb.offer || {}).name || b.title);
  const lk = p.links && /^https?:\/\//.test(p.links.checkout || '') ? { checkout: p.links.checkout } : null;
  if (lk) nb.links = { ...(b.links || {}), ...lk };
  if (nb.design && Array.isArray(nb.design.order)) nb.design.order = nb.design.order.filter((k, i, a) => R.SECTIONS.includes(k) && a.indexOf(k) === i);
  let vis = null; const imgs = (Array.isArray(j.images) ? j.images : []).filter((x) => ['hero', 'story', 'stack'].includes(x));
  if (imgs.length) { vis = await stepVisuals(nb, inp, K, imgs); nb.assets = vis.patch.assets; nb.visuals = vis.patch.visuals; }
  const summary = clip(j.summary, 300) || 'Applied the revision';
  if (ENGINE[b.engine]) {
    const swaps = {}; Object.entries(nb.assets || {}).forEach(([k, n]) => { const o = (b.assets || {})[k]; if (o && n && o !== n) swaps[o] = n; });
    r.state = 'crafting'; r.summary = summary; r.swaps = swaps;
    return { patch: { copy: nb.copy, offer: nb.offer, brand: nb.brand, design: nb.design, assets: nb.assets || b.assets, ...(vis ? { visuals: nb.visuals } : {}), ...(lk ? { links: lk } : {}), revisions: revs }, note: `${summary}. Handing the code to ${ENGINE[b.engine]}.`, next: 'recraft' };
  }
  const built = stepBuild(nb, inp, K, 'Revision: ' + summary);
  const v = built.patch.version; r.state = 'done'; r.summary = summary; r.v = v; r.done_at = now();
  return { patch: { copy: nb.copy, offer: nb.offer, brand: nb.brand, design: nb.design, assets: nb.assets || b.assets, ...(vis ? { visuals: nb.visuals } : {}), ...(lk ? { links: lk } : {}), ...built.patch, revisions: revs }, note: summary, next: 'publish' };
}
// New images only: redraw the three graphics with the current brand kit, rebuild the page and publish it.
async function stepImages(b, inp, K) {
  const vis = await stepVisuals(b, inp, K);
  const got = ((vis.patch.visuals || {}).images || []).filter((x) => (vis.patch.assets || {})[x.slot] === x.name).length;
  if (vis.patch.visuals && vis.patch.visuals.method === 'svg' && !got) { const f = (vis.patch.visuals.fails || [])[0]; throw bad(f ? 'No new images. ' + f : vis.note, 502); }
  const nb = { ...b, assets: vis.patch.assets, visuals: vis.patch.visuals };
  if (ENGINE[b.engine] && b.html) {
    let html = b.html; Object.entries(nb.assets || {}).forEach(([k, n]) => { const o = (b.assets || {})[k]; if (o && n && o !== n) html = html.split('assets/' + o).join('assets/' + n); });
    const v = (b.version || 0) + 1;
    return { patch: { ...vis.patch, html, qa: R.qa(html, spec(nb)), version: v, version_push: { v, at: now(), note: 'New images: ' + vis.note, by: ENGINE[b.engine] }, links: { preview: previewUrl(b) } }, note: vis.note, next: 'publish' };
  }
  const built = stepBuild(nb, inp, K, 'New images: ' + vis.note);
  return { patch: { ...vis.patch, ...built.patch }, note: vis.note, next: 'publish' };
}
// The builder edits its own code for a revision.
async function stepRecraft(b, inp, K) {
  const revs = (b.revisions || []).slice(); const r = revs.slice().reverse().find((x) => x.state === 'crafting');
  if (!r) return { patch: {}, note: 'Nothing to change', next: 'publish' };
  const v = (b.version || 0) + 1; let html; let note;
  try {
    const out = await craftRevise(b, inp, K, r.request + '\n(Planned change: ' + (r.summary || '') + ')', r.swaps);
    if (out.draft) return { patch: { draft: out.draft }, next: 'recraft', keep: true, note: `${ENGINE[b.engine]} is still editing the code (${out.kb} KB so far). It carries on in the next run.` };
    html = out.html; note = `Version ${v}, edited by ${out.label}: ${r.summary}`;
  } catch (e) {
    if (e.status === 409) throw e;
    const fb = stepBuild(b, inp, K, 'Revision: ' + r.summary);
    html = fb.patch.html; note = `${ENGINE[b.engine]} could not finish the edit (${clip(e.message, 120)}). Rebuilt with the OS builder instead.`;
  }
  r.state = 'done'; r.v = v; r.done_at = now(); delete r.swaps;
  return { patch: { html, draft: '', qa: R.qa(html, spec(b)), version: v, version_push: { v, at: now(), note: 'Revision: ' + r.summary, by: ENGINE[b.engine] }, links: { preview: previewUrl(b) }, revisions: revs }, note, next: 'publish' };
}
async function stepSync(b, inp, K) {
  if (!(K.github && K.github.key) || !(b.repo && b.repo.full_name)) throw bad('This build has no GitHub repository yet. Connect GitHub and publish first.', 409);
  const f = await jf('GitHub', `${GH}/repos/${b.repo.full_name}/contents/index.html?ref=${q(b.repo.branch || 'main')}`, { headers: ghH(K.github.key) });
  const html = Buffer.from(f.content || '', 'base64').toString('utf8'); if (html.length < 200) throw bad('index.html in the repository looks empty', 422);
  if (html === b.html) return { patch: {}, note: 'Already up to date with GitHub', next: 'done' };
  const commits = await jf('GitHub', `${GH}/repos/${b.repo.full_name}/commits?per_page=1&sha=${q(b.repo.branch || 'main')}`, { headers: ghH(K.github.key) }).catch(() => []);
  const msg = clip(commits && commits[0] && commits[0].commit && commits[0].commit.message.split('\n')[0], 160) || 'Changes from GitHub';
  const v = (b.version || 0) + 1;
  return { patch: { html, qa: R.qa(html, spec(b)), version: v, version_push: { v, at: now(), note: msg, by: 'GitHub' }, repo: { ...b.repo, commit: commits && commits[0] && commits[0].sha, synced_at: now() } }, note: `Version ${v} from GitHub: ${msg}`, next: 'publish' };
}

const RUN = { research: stepResearch, offer: stepOffer, copy: stepCopy, brand: stepBrand, visuals: stepVisuals, design: stepDesign, build: (b, i, K) => (ENGINE[b.engine] ? stepCraft(b, i, K) : stepBuild(b, i, K)), publish: stepPublish, revise: stepRevise, recraft: stepRecraft, images: stepImages, sync: stepSync };
const nextOf = (s) => { const i = STEPS.indexOf(s); return i === -1 || i === STEPS.length - 1 ? 'done' : STEPS[i + 1]; };

/* ---------- the loop ---------- */
async function loop(id) {
  const t0 = Date.now();
  let b = await cron('cron_funnel_claim', { p_id: id, p_secs: 295 }); if (!b) return { busy: true };
  if (b.status === 'done' || b.status === 'failed') { await save(id, { release: true }); return { done: true }; }
  let inp; let K;
  try { [inp, K] = await Promise.all([cron('cron_funnel_inputs', { p_ws: b.workspace_id }).then(x=>require('./_strategy').cronInput(b.workspace_id,x)), keys(b.workspace_id)]); }
  catch (e) { await save(id, { status: 'failed', error: clip(e.message, 300), release: true }); return { error: e.message }; }
  K.prefer = b.engine;
  try {
    const selected = Vault.ids(b.answers && b.answers.vault_notes ? b.answers.vault_notes.split(',').filter(Boolean) : []);
    const notes = await cron('cron_vault_context', { p_ws: b.workspace_id, p_query: [b.title, (b.answers || {}).notes, (b.answers || {}).audience].filter(Boolean).join(' '), p_purpose: 'funnels', p_ids: selected });
    inp.vault_context = VaultBriefs.context(notes);
  } catch (e) {
    if (b.answers && b.answers.vault_notes) { await save(id, { status: 'failed', error: clip(e.message, 300), release: true }); return { error: e.message }; }
  }
  let more = false;
  try { inp.design_guidance = await require('./_custom').funnelContext(b.workspace_id); }
  catch (e) { await save(id, { status: 'failed', error: 'Design guidance could not be loaded. Retry the build.', release: true }); return { error: e.message }; }
  while (true) {
    const step = b.step; if (step === 'done') { await save(id, { status: 'done', release: true }); break; }
    if (ENGINE[b.engine] && (step === 'build' || step === 'recraft') && Date.now() - t0 > 15000) { more = true; break; }
    const fn = RUN[step]; if (!fn) { await save(id, { status: 'failed', error: 'Unknown step ' + step, release: true }); break; }
    const at = now();
    await save(id, { status: 'running', steps_merge: { [step]: { state: 'running', at, note: (b.steps && b.steps[step] && b.steps[step].state === 'running' ? 'Picked up again' : null) } } });
    let out;
    const s0 = Date.now();
    try { out = await fn(b, inp, K); }
    catch (e) {
      if (e.code !== 409 && !(ENGINE[b.engine] && (step === 'build' || step === 'recraft')) && Date.now() - s0 < 90000) { try { out = await fn(b, inp, K); } catch (e2) { e = e2; } }
      if (!out) {
        await save(id, { status: 'failed', error: clip(e.message, 300), steps_merge: { [step]: { state: 'failed', at, note: clip(e.message, 240) } }, release: true });
        return { error: e.message, step };
      }
    }
    const next = out.next || nextOf(step);
    const patch = { ...out.patch }; let vfix = null;
    if (patch.versions_fix) { delete patch.versions_fix; vfix = (b.versions || []).slice(); }
    const saved = { ...patch, ...(vfix ? { versions_set: vfix } : {}), step: next, status: next === 'done' ? 'done' : 'running', error: null, steps_merge: { [step]: out.keep ? { state: 'running', at, note: clip(out.note, 300) } : { state: 'done', at, done_at: now(), note: clip(out.note, 300) } }, ...(next === 'done' ? { release: true } : {}) };
    if (vfix) { const last = vfix[vfix.length - 1]; if (last && patch.links && patch.links.live) last.url = patch.links.live; }
    await save(id, saved);
    // local copy for the next step
    b = { ...b, ...patch, step: next, links: { ...(b.links || {}), ...(patch.links || {}) }, versions: patch.version_push ? [...(b.versions || []), patch.version_push] : (b.versions || []) };
    if (next === 'done') break;
    if (Date.now() - t0 > BUDGET) { more = true; break; }
  }
  if (more) { await save(id, { release: true }); await kick(id); }
  return { ok: true, step: b.step };
}
async function kick(id) {
  try { await jf('Funnel Agent', APP_URL + '/api/funnel', { method: 'POST', timeout: 9000, headers: { 'Content-Type': 'application/json', 'x-fos-secret': SECRET() }, body: JSON.stringify({ action: 'run', id }) }); return true; } catch { return false; }
}
// Queue a step from another function (MCP updates, syncs) and start the loop.
async function queue(id, step) { await save(id, { status: 'running', step, error: null }); return kick(id); }
const later = (p) => { if (waitUntil) { waitUntil(p.catch(() => null)); return null; } return p.catch((e) => ({ error: e.message })); };

// Graphics lives in its own module and shares this function, keys and loop pattern.
const G = require('./_graphics')({ keys, cron, llm, jsonOut, scrub, later, clip, bad, jf, rpc, sb, q, APP_URL, SECRET, claudeStream });

/* ---------- member actions ---------- */
async function mine(jwt, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw bad('Missing build');
  const rows = await sb(jwt, `/rest/v1/funnel_builds?id=eq.${q(id)}&select=id,workspace_id,status,step,lease_until,updated_at,revisions,repo,version,engine`);
  if (!rows || !rows[0]) throw bad('Build not found', 404); return rows[0];
}
/* ---------- HighLevel: create the products, prices, page images and email templates on one approved click ---------- */
async function hlFor(ws) {
  const c = await cron('cron_funnel_secret', { p_ws: ws, p_provider: 'highlevel' }).catch(() => null);
  if (!c) throw bad('Connect HighLevel in Connections first', 409);
  return require('./_hl').fresh(JSON.parse(open(c, 'HighLevel')), ws);
}
const hlPrice = (p) => { const t = String((p && (p.type || p.every)) || '').toLowerCase(); const rec = /month|year|week|recurr|subscri|plan|install/.test(t); return { type: rec ? 'recurring' : 'one_time', ...(rec ? { recurring: { interval: /year|annual/.test(t) ? 'year' : /week/.test(t) ? 'week' : 'month', intervalCount: 1 } } : {}) }; };
async function hlPlanOf(r) {
  const b = await cron('cron_funnel_get', { p_id: r.id }); const h = b.handoff || {}; const done = (b.links && b.links.hl) || {};
  const has = (list, name) => (list || []).some((x) => String(x.name).toLowerCase() === String(name).toLowerCase());
  const products = [...(h.products || []), ...(h.bump && h.bump.name ? [{ ...h.bump, type: 'one-time', role: 'Order bump' }] : []), ...(h.upsell && h.upsell.name ? [{ ...h.upsell, type: h.upsell.every || 'one-time', role: 'Upsell' }] : [])]
    .filter((p) => p && p.name && num(p.price) > 0).slice(0, 8).map((p) => ({ name: clip(p.name, 120), price: num(p.price), currency: clip(p.currency, 3) || (b.offer && b.offer.price && b.offer.price.currency) || 'USD', ...hlPrice(p), role: p.role || 'Product', done: has(done.products, p.name) }));
  const emails = (b.emails || []).filter((e) => e && e.subject && e.body).slice(0, 10).map((e) => ({ name: clip(e.subject, 140), when: clip(e.when, 60), body: String(e.body).slice(0, 8000), done: has(done.emails, e.subject) }));
  const assets = await cron('cron_funnel_assets', { p_id: r.id }).catch(() => []); const html = b.html || '';
  const images = (assets || []).filter((a) => /\.(webp|png|jpg)$/.test(a.name) && (Object.values(b.assets || {}).includes(a.name) || html.includes('assets/' + a.name))).slice(0, 12).map((a) => ({ name: a.name, done: has(done.images, a.name) }));
  return { b, products, emails, images, done };
}
const hlPublic = (pl) => ({ products: pl.products, emails: pl.emails.map(({ body, ...e }) => e), images: pl.images, sent_at: pl.done.at || null });
const A = {
  questions,
  plan,
  suggest,
  async hl_plan(jwt, b) { const r = await mine(jwt, b.id); return hlPublic(await hlPlanOf(r)); },
  async hl_send(jwt, b) {
    const r = await mine(jwt, b.id); if (r.status === 'running') throw bad('This build is still running', 409);
    const want = b.parts || {}; const pl = await hlPlanOf(r); const c = await hlFor(r.workspace_id); const H = require('./_hl'); const L = c.location_id;
    const done = { products: [...(pl.done.products || [])], emails: [...(pl.done.emails || [])], images: [...(pl.done.images || [])] }; const errors = [];
    if (want.products !== false) for (const p of pl.products.filter((x) => !x.done)) {
      try {
        const pj = await H.call(c, '/products/', { method: 'POST', body: { name: p.name, locationId: L, productType: 'DIGITAL', description: (pl.b.offer && clip(pl.b.offer.promise || pl.b.offer.headline, 300)) || '' } });
        const pid = pj && (pj._id || pj.id || (pj.product && (pj.product._id || pj.product.id)));
        const price = await H.call(c, `/products/${q(pid)}/price`, { method: 'POST', body: { name: p.type === 'recurring' ? 'Monthly' : 'One payment', type: p.type, currency: p.currency, amount: p.price, locationId: L, ...(p.recurring ? { recurring: p.recurring } : {}) } });
        done.products.push({ name: p.name, id: pid, price_id: price && (price._id || price.id) || null });
      } catch (e) { errors.push(p.name + ': ' + e.message); }
    }
    if (want.images !== false) for (const im of pl.images.filter((x) => !x.done)) {
      try {
        const f = new FormData(); f.append('hosted', 'true'); f.append('fileUrl', `${APP_URL}/preview/${pl.b.id}/${pl.b.preview_key}/assets/${im.name}`); f.append('name', slug(pl.b.title || 'sales-page') + '-' + im.name);
        const j = await H.call(c, '/medias/upload-file', { method: 'POST', form: f, version: 'v3', alt: '2021-07-28' });
        done.images.push({ name: im.name, id: j && (j.fileId || j._id || j.id) || null, url: j && j.url || null });
      } catch (e) { errors.push(im.name + ': ' + e.message); }
    }
    if (want.emails !== false) for (const e of pl.emails.filter((x) => !x.done)) {
      try {
        const t = await H.call(c, '/emails/builder', { method: 'POST', body: { locationId: L, type: 'html', title: e.name, name: e.name, builderVersion: '2', ...(c.user_id ? { updatedBy: c.user_id } : {}) } });
        const tid = t && (t.id || t._id || t.templateId || (t.template && (t.template.id || t.template._id)));
        const html = String(e.body).split(/\n{2,}/).map((x) => '<p>' + x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])).replace(/\n/g, '<br>') + '</p>').join('');
        try { await H.call(c, `/emails/builder/${q(tid)}`, { method: 'PATCH', body: { locationId: L, editorType: 'html', editorContent: html, subject: e.name, previewText: clip(e.body, 90), ...(c.user_id ? { updatedBy: c.user_id } : {}) } }); }
        catch { await H.call(c, '/emails/builder/data', { method: 'POST', body: { locationId: L, templateId: tid, updatedBy: c.user_id || L, dnd: { elements: [], attrs: {}, templateSettings: {} }, html, editorType: 'html', previewText: clip(e.body, 90), isPlainText: false } }); }
        done.emails.push({ name: e.name, id: tid });
      } catch (x) { errors.push(e.name + ': ' + x.message); }
    }
    const hl = { ...done, at: new Date().toISOString() };
    await save(r.id, { links: { hl } });
    return { ...hlPublic({ ...pl, done: hl, products: pl.products.map((p) => ({ ...p, done: done.products.some((x) => x.name === p.name) })), emails: pl.emails.map((m) => ({ ...m, done: done.emails.some((x) => x.name === m.name) })), images: pl.images.map((m) => ({ ...m, done: done.images.some((x) => x.name === m.name) })) }), errors };
  },
  async start(jwt, b) {
    const answers = {}; Object.entries(b.answers || {}).slice(0, 12).forEach(([k, v]) => { if (/^[a-z_]{2,30}$/.test(k)) answers[k] = clip(v, 1500) || ''; });
    delete answers.vault_notes;
    const selected = Vault.ids(b.inspiration_ids);
    if (selected.length) {
      await Vault.context(jwt, b.workspace_id, b.title || '', 'funnels', selected);
      answers.vault_notes = selected.join(',');
    }
    if (answers.checkout_url && !/^https?:\/\//.test(answers.checkout_url)) answers.checkout_url = '';
    delete answers.attached;
    const attached = await attachedContext(jwt, b, [b.title, answers.audience, answers.notes].filter(Boolean).join(' '));
    if (attached) answers.attached = keep(attached, 30000);
    const r = await rpc(jwt, 'funnel_create', { p_ws: b.workspace_id, p_title: clip(b.title, 200) || 'Sales page', p_offer_ref: clip(b.offer_id, 120), p_answers: answers, p_offer: b.offer_name && !b.offer_id ? { name: clip(b.offer_name, 120) } : null });
    const engine = ENGINE[b.engine] ? b.engine : 'os';
    const pick = brandPick(b.brand_pick);
    if (engine !== 'os' || pick) await save(r.id, { ...(engine !== 'os' ? { engine } : {}), ...(pick ? { brand: { pick } } : {}) });
    const w = later(loop(r.id)); if (w) await w;
    return { ...r, engine };
  },
  // Rebuild the page with Claude, Codex or the OS builder, keeping research, offer, copy, brand and images.
  async rebuild(jwt, b) {
    const engine = ENGINE[b.engine] || b.engine === 'os' ? b.engine : null; if (!engine) throw bad('Pick Claude, Codex or the OS builder', 400);
    const cur = await mine(jwt, b.id);
    if (cur.status === 'running' || cur.status === 'queued') throw bad('This build is still working. Try again when it finishes.', 409);
    if (!cur.version) throw bad('Let the first build finish before rebuilding', 409);
    await save(cur.id, { engine, draft: '', step: 'build', status: 'running', error: null, release: true, steps_merge: { build: { state: 'queued', at: now(), note: 'Rebuilding with ' + (ENGINE[engine] || 'the OS builder') } } });
    const w = later(loop(cur.id)); if (w) await w;
    return { status: 'running', step: 'build', engine };
  },
  async tick(jwt, b) {
    const r = await mine(jwt, b.id);
    const stale = !r.lease_until || new Date(r.lease_until) < new Date();
    if ((r.status === 'running' || r.status === 'queued') && stale) { const w = later(loop(r.id)); if (w) await w; return { resumed: true, status: r.status, step: r.step }; }
    return { resumed: false, status: r.status, step: r.step };
  },
  async retry(jwt, b) { const r = await mine(jwt, b.id); if (r.status !== 'failed') return { status: r.status }; await save(r.id, { status: 'running', error: null, release: true }); const w = later(loop(r.id)); if (w) await w; return { status: 'running', step: r.step }; },
  async revise(jwt, b) {
    const r = await mine(jwt, b.id); const request = clip(b.request, 3000); if (!request) throw bad('Write what you want changed');
    if (r.status === 'running' || r.status === 'queued') throw bad('This build is still running. Send the revision when it is done.', 409);
    const revs = [...(r.revisions || []), { at: now(), request, state: 'queued' }].slice(-40);
    await save(r.id, { revisions: revs, status: 'running', step: 'revise', error: null, release: true });
    const w = later(loop(r.id)); if (w) await w; return { status: 'running', step: 'revise' };
  },
  async publish(jwt, b) { const r = await mine(jwt, b.id); if (r.status === 'running') throw bad('This build is still running', 409); await save(r.id, { status: 'running', step: 'publish', error: null, release: true }); const w = later(loop(r.id)); if (w) await w; return { status: 'running', step: 'publish' }; },
  async images(jwt, b) { const r = await mine(jwt, b.id); if (r.status === 'running' || r.status === 'queued') throw bad('This build is still running', 409); await save(r.id, { status: 'running', step: 'images', error: null, release: true }); const w = later(loop(r.id)); if (w) await w; return { status: 'running', step: 'images' }; },
  async sync(jwt, b) { const r = await mine(jwt, b.id); if (r.status === 'running') throw bad('This build is still running', 409); if (!r.repo || !r.repo.full_name) throw bad('Publish to GitHub first', 409); await save(r.id, { status: 'running', step: 'sync', error: null, release: true }); const w = later(loop(r.id)); if (w) await w; return { status: 'running', step: 'sync' }; },
  async checkout(jwt, b) {
    const r = await mine(jwt, b.id); const url = clip(b.url, 500) || '';
    if (url && !/^https:\/\//.test(url)) throw bad('Paste the full HighLevel order form link, starting with https://');
    if (r.status === 'running') throw bad('This build is still running', 409);
    await save(r.id, { links: { checkout: url }, status: 'running', step: 'build', error: null, release: true });
    const w = later((async () => { const full = await cron('cron_funnel_get', { p_id: r.id }); const out = ENGINE[full.engine] && full.html ? relink(full, url) : stepBuild({ ...full, links: { ...(full.links || {}), checkout: url } }, null, null, url ? 'Checkout link added' : 'Checkout link removed'); await save(r.id, { ...out.patch, step: 'publish', steps_merge: { build: { state: 'done', at: now(), done_at: now(), note: out.note } } }); return loop(r.id); })()); if (w) await w;
    return { status: 'running', step: 'build' };
  },
};

/* ---------- preview pages (private link with a long random key) ---------- */
async function preview(req, res, qs) {
  const id = qs.get('pid'); const k = qs.get('k'); const a = qs.get('a');
  const fail = (code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><meta name="robots" content="noindex"><title>Preview</title><body style="font:16px/1.5 system-ui;padding:48px;color:#333">${msg}</body>`); };
  if (!/^[0-9a-f-]{36}$/i.test(id || '') || !/^[0-9a-f]{20,80}$/i.test(k || '')) return fail(404, 'This preview link is not valid.');
  if (a) {
    if (!/^[a-z0-9-]{1,48}\.(webp|png|jpg|svg|woff2|woff|ttf|otf)$/.test(a)) return fail(404, 'Not found');
    const r = await rpc(null, 'funnel_preview_asset', { p_id: id, p_key: k, p_name: a }).catch(() => null);
    if (!r || !r.data) return fail(404, 'Not found');
    res.statusCode = 200; res.setHeader('Content-Type', r.mime || 'image/webp'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.setHeader('X-Robots-Tag', 'noindex'); return res.end(Buffer.from(r.data, 'base64'));
  }
  const r = await rpc(null, 'funnel_preview', { p_id: id, p_key: k }).catch(() => null);
  if (!r) return fail(404, 'This preview link is not valid.');
  if (!r.html) return fail(200, `<b>${String(r.title || 'Sales page').replace(/[<>&]/g, '')}</b><br>The Funnel Agent is still building this page. This tab refreshes on its own.<script>setTimeout(()=>location.reload(),8000)</script>`);
  const base = `/preview/${id}/${k}/assets/`;
  const html = String(r.html).replace(/(["'(])assets\//g, '$1' + base).replace('</head>', '<meta name="robots" content="noindex"></head>');
  res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
  // The page runs in its own sandboxed origin, so nothing on it can reach the app's session.
  res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms'); res.end(html);
}

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  const qs = new URL(req.url || '/', 'http://x').searchParams;
  if (req.method === 'GET' && qs.get('gws')) { try { return await G.asset(req, res, qs); } catch (e) { return send(500, { error: 'Image failed' }); } }
  if (req.method === 'GET' && qs.get('pid')) { try { return await preview(req, res, qs); } catch (e) { return send(500, { error: 'Preview failed' }); } }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Use POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  if (b.action === 'run') {
    if (!safeEq(req.headers['x-fos-secret'], SECRET())) return send(403, { error: 'not allowed' });
    if (!/^[0-9a-f-]{36}$/i.test(String(b.id || ''))) return send(400, { error: 'Missing build' });
    const run = b.kind === 'gfx' ? G.loop : loop;
    if (waitUntil) { waitUntil(run(b.id).catch(() => null)); return send(202, { ok: true }); }
    return send(200, await run(b.id).catch((e) => ({ error: e.message })));
  }
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  const act = A[b.action] || G.A[b.action]; if (!act) return send(400, { error: 'Unknown action' });
  if (!jwt) return send(401, { error: 'Sign in first' });
  if (b.action !== 'tick' && b.action !== 'revise' && b.action !== 'publish' && b.action !== 'sync' && b.action !== 'retry' && b.action !== 'checkout' && !/^(gfx_tick|gfx_retry|gfx_edit)$/.test(b.action) && !/^[0-9a-f-]{36}$/i.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
  try { return send(200, await act(jwt, b)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._queue = queue;
module.exports._kick = kick;
module.exports._loop = loop;
module.exports._brief = brief;
module.exports._image = image;
module.exports._spec = spec;
module.exports._steps = RUN;
module.exports._toWebp = toWebp;
module.exports._gfx = G;
module.exports._craft = { keys, cron, craftRun, claudeStream, craftCall, cleanHtml, craftBrief, relink, stepCraft, DESIGNER };

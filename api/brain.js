// Founders AI OS Brain: the founder's context layer.
// Files are read in the browser and stored as searchable passages (RLS, per workspace).
// This endpoint does the parts a browser cannot: Google Docs and links, studying the whole library, and building with it.
const { bad, clip, q, open, sb, rpc, jf } = require('./_lib');
const Vault = require('./_vault');
const VaultBriefs = require('../js/vault');

const AI_SYS = 'You work inside Founders AI OS for one founder. You only use what the founder wrote or said. Plain words, short sentences, no em dashes, no exclamation points, no emojis, no hype, no filler, no formulaic contrast lines.';

/* ---------- AI: Claude first, then OpenAI. Null when neither is connected. ---------- */
async function aiKeys(jwt, ws) {
  const out = {};
  try { out.claude = JSON.parse(open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'claude' }))).key; } catch { /* not connected */ }
  try { out.openai = open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'openai' })); } catch { out.openai = null; /* every workspace brings its own key */ }
  try { const raw = open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'perplexity' })); let v = raw; try { v = JSON.parse(raw); } catch { /* plain key */ } out.perplexity = (v && v.key) || (typeof v === 'string' ? v : null); } catch { out.perplexity = null; }
  out.any = !!(out.claude || out.openai || out.perplexity);
  return out;
}
const MODELS = {
  'claude-fable-5-2': { p: 'claude', name: 'Claude Fable 5.2' },
  'claude-opus-5-5': { p: 'claude', name: 'Claude Opus 5.5' },
  'claude-sonnet-5-5': { p: 'claude', name: 'Claude Sonnet 5.5' },
  'claude-haiku-5-5': { p: 'claude', name: 'Claude Haiku 5.5' },
  'gpt-6-astra': { p: 'openai', name: 'GPT-6 Astra' },
  'gpt-6.1-sol': { p: 'openai', name: 'GPT-6.1 Sol' },
  'gpt-6.1-terra': { p: 'openai', name: 'GPT-6.1 Terra' },
  'gpt-6-luna': { p: 'openai', name: 'GPT-6 Luna' },
  // Only through a Perplexity key: one key reaches every lab.
  'gemini-4-carbon': { p: 'perplexity', name: 'Gemini 4 Carbon', id: 'google/gemini-4-carbon' },
  'grok-4.7': { p: 'perplexity', name: 'Grok 4.7', id: 'xai/grok-4.7' },
};
// The Perplexity Agent API names every model by its lab. Terra is not offered there, Sol stands in.
const pplxId = (m) => { const x = MODELS[m]; if (x && x.id) return x.id; if (x && x.p === 'claude') return 'anthropic/' + m; if (x && x.p === 'openai') return 'openai/' + (m === 'gpt-6.1-terra' ? 'gpt-6.1-sol' : m); return 'anthropic/claude-sonnet-5-5'; };
const PROVIDER = { claude: 'Claude', openai: 'OpenAI', perplexity: 'Perplexity' };
// Which provider runs a model for this workspace: its own lab's key first, then the Perplexity key.
function route(keys, model) {
  keys = keys || {};
  const pick = model && MODELS[model] ? model : null;
  if (pick) {
    const p = MODELS[pick].p;
    if (p !== 'perplexity' && keys[p]) return { p, m: pick, key: keys[p] };
    if (keys.perplexity) return { p: 'perplexity', m: pick, key: keys.perplexity, id: pplxId(pick) };
    throw bad('Connect ' + (p === 'perplexity' ? 'Perplexity' : PROVIDER[p] + ' or Perplexity') + ' in Connections to use ' + modelName(pick) + '.', 409);
  }
  if (keys.claude) return { p: 'claude', m: DEFAULT.claude, key: keys.claude };
  if (keys.openai) return { p: 'openai', m: DEFAULT.openai, key: keys.openai };
  if (keys.perplexity) return { p: 'perplexity', m: DEFAULT.claude, key: keys.perplexity, id: pplxId(DEFAULT.claude) };
  throw bad('Connect Claude, OpenAI or Perplexity in Connections. Your AI writes with your own key.', 409);
}
const canUse = (keys, model) => { try { route(keys, model); return true; } catch { return false; } };
const hasAI = (keys) => !!(keys && (keys.claude || keys.openai || keys.perplexity));
const DEFAULT = { claude: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', openai: process.env.OPENAI_MODEL || 'gpt-6.1-sol' };
const modelName = (id) => (MODELS[id] && MODELS[id].name) || id;
const clean = (t) => String(t || '').trim().replace(/\u2014/g, ',');
// user is a string, or { text, images: [{ media_type, data(base64) }] } when screenshots come along
function userBlocks(user, p) {
  if (!user || typeof user !== 'object' || !Array.isArray(user.images) || !user.images.length) return typeof user === 'object' && user ? String(user.text || '') : user;
  if (p === 'claude') return [...user.images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })), { type: 'text', text: String(user.text || '') }];
  return [{ role: 'user', content: [...user.images.map((im) => ({ type: 'input_image', image_url: `data:${im.media_type};base64,${im.data}` })), { type: 'input_text', text: String(user.text || '') }] }];
}
// Claude 5.x thinks on its own when the input is long, and thinking spends the output budget.
// Sonnet 5.5 can skip it. The others get room for it on top of the answer.
const noThink = (model, max) => (/sonnet-5-5/.test(model) ? { max_tokens: max, thinking: { type: 'between_tools' } } : { max_tokens: max + 4000 });
async function claude(key, model, system, user, max, timeout = 55000) {
  const j = await jf('Claude', 'https://api.anthropic.com/v1/messages', { method: 'POST', timeout, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model, ...noThink(model, max), system, messages: [{ role: 'user', content: userBlocks(user, 'claude') }] }) });
  const t = (j.content || []).filter((x) => x.type === 'text').map((x) => x.text || '').join('').trim(); return t ? { text: clean(t), by: modelName(model), model } : null;
}
async function openai(key, model, system, user, max, timeout = 55000) {
  const j = await jf('OpenAI', 'https://api.openai.com/v1/responses', { method: 'POST', timeout, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions: system, input: userBlocks(user, 'openai'), max_output_tokens: max + 6000, reasoning: { effort: 'low' } }) });
  const t = j.output_text || (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  return t ? { text: clean(t), by: modelName(model), model } : null;
}
// Perplexity Agent API: one key, models from every lab. Optional built-in tools such as web_search.
const pplxText = (j) => String(j.output_text || (j.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text || '').join('')).trim();
async function pplx(key, model, system, user, max, timeout = 55000, extra = {}) {
  const id = MODELS[model] ? pplxId(model) : model;
  const j = await jf('Perplexity', 'https://api.perplexity.ai/v1/agent', { method: 'POST', timeout, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: id, instructions: system, input: userBlocks(user, 'openai'), max_output_tokens: max + 4000, ...extra }) });
  const t = pplxText(j); return t ? { text: clean(t), by: modelName(model), model, raw: j } : null;
}
// opts.model picks one exact model; without it Claude goes first, then OpenAI, then Perplexity.
async function ai(keys, system, user, max = 1800, opts = {}) {
  const want = opts.model && MODELS[opts.model] ? opts.model : null;
  if (want) {
    const r = route(keys, want);
    if (r.p === 'perplexity') return pplx(r.key, want, system, user, max, opts.timeout);
    return r.p === 'claude' ? claude(keys.claude, want, system, user, max, opts.timeout) : openai(keys.openai, want, system, user, max, opts.timeout);
  }
  if (keys.claude) {
    try { const r = await claude(keys.claude, DEFAULT.claude, system, user, max, opts.timeout); if (r) return r; } catch (e) { if (!keys.openai && !keys.perplexity) throw e; }
  }
  if (keys.openai) {
    try { const r = await openai(keys.openai, DEFAULT.openai, system, user, max, opts.timeout); if (r) return r; } catch (e) { if (!keys.perplexity) throw e; }
  }
  if (keys.perplexity) return pplx(keys.perplexity, DEFAULT.claude, system, user, max, opts.timeout);
  return null;
}
const jsonOut = (t) => { const m = String(t || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

/* ---------- links: Google Docs, Slides, Sheets, Drive files and web pages ---------- */
const GKIND = { document: ['gdoc', 'text/plain'], presentation: ['gslides', 'text/plain'], spreadsheets: ['gsheet', 'text/csv'] };
function strip(html) {
  const title = clip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 160);
  const body = html.replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<h([1-3])[^>]*>/gi, '\n\n## ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return { title: title ? title.replace(/&amp;/g, '&') : null, text: body };
}
async function driveToken(jwt, ws) { try { const C = require('./connect.js'); const c = await C._creds(jwt, ws, 'gdrive'); return await C._gAccess(c); } catch { return null; } }
async function importLink(jwt, ws, url) {
  let u; try { u = new URL(String(url || '').trim()); } catch { throw bad('Paste a full link, starting with https://'); }
  if (!/^https?:$/.test(u.protocol)) throw bad('Only web links work here');
  const g = u.hostname === 'docs.google.com' && u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
  const dfile = (u.hostname === 'drive.google.com' && (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1]) || (u.hostname === 'drive.google.com' && u.searchParams.get('id'));
  if (g || dfile) {
    const tok = await driveToken(jwt, ws); const id = g ? g[2] : dfile;
    if (tok) {
      const H = { Authorization: 'Bearer ' + tok };
      const meta = await jf('Google Drive', `https://www.googleapis.com/drive/v3/files/${q(id)}?fields=name,mimeType,webViewLink,modifiedTime&supportsAllDrives=true`, { headers: H }).catch((e) => { throw bad(/404|not found/i.test(e.message) ? 'Google Drive cannot see that file with the connected account.' : e.message, 422); });
      const gk = meta.mimeType.startsWith('application/vnd.google-apps.') ? meta.mimeType.split('.').pop() : null;
      const map = { document: GKIND.document, presentation: GKIND.presentation, spreadsheet: GKIND.spreadsheets };
      if (gk && map[gk]) {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${q(id)}/export?mimeType=${q(map[gk][1])}`, { headers: H });
        if (!r.ok) throw bad('Google could not export that file (' + r.status + ').', 502);
        return { title: clip(meta.name, 200), kind: map[gk][0], text: await r.text(), url: meta.webViewLink || u.href, source: 'Google Drive' };
      }
      if (gk) throw bad('That Google file type cannot be read as text. Docs, Slides and Sheets work.', 415);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${q(id)}?alt=media&supportsAllDrives=true`, { headers: H });
      if (!r.ok) throw bad('Google Drive did not return the file (' + r.status + ').', 502);
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 3.2e6) throw bad('That file is over 3 MB, too big to pass through a link. Download it and drop it in Files instead.', 413);
      return { title: clip(meta.name, 200), mime: meta.mimeType, file: buf.toString('base64'), url: meta.webViewLink || u.href, source: 'Google Drive' };
    }
    if (!g) throw bad('Connect Google Drive in Connections to read Drive files, or upload the file here.', 409);
    const exp = g[1] === 'document' ? `/document/d/${id}/export?format=txt` : g[1] === 'presentation' ? `/presentation/d/${id}/export/txt` : `/spreadsheets/d/${id}/export?format=csv`;
    const r = await fetch('https://docs.google.com' + exp, { redirect: 'follow' }); const t = await r.text();
    if (!r.ok || /<html/i.test(t.slice(0, 400))) throw bad('That doc is private. Connect Google Drive in Connections, or set sharing to anyone with the link.', 403);
    return { title: null, kind: GKIND[g[1]][0], text: t, url: u.href, source: 'Google link' };
  }
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
  let r; try { r = await fetch(u.href, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoundersAIOS/1.0)', Accept: 'text/html,application/pdf,text/plain,*/*' }, redirect: 'follow', signal: ctl.signal }); } catch { clearTimeout(tm); throw bad('That page could not be reached.', 502); }
  clearTimeout(tm);
  if (!r.ok) throw bad('That page answered with ' + r.status + '.', 502);
  const ct = String(r.headers.get('content-type') || '');
  if (/pdf|officedocument|msword|presentation/.test(ct)) { const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 3.2e6) throw bad('That file is over 3 MB, too big to pass through a link. Download it and drop it in Files instead.', 413); return { title: clip(decodeURIComponent(u.pathname.split('/').pop() || u.hostname), 200), mime: ct.split(';')[0], file: buf.toString('base64'), url: u.href, source: u.hostname }; }
  const raw = (await r.text()).slice(0, 3e6);
  if (/text\/(plain|markdown)/.test(ct)) return { title: clip(u.pathname.split('/').pop() || u.hostname, 200), kind: 'md', text: raw, url: u.href, source: u.hostname };
  const s = strip(raw); if (s.text.length < 200) throw bad('That page has almost no readable text. It may need a login or load with JavaScript.', 422);
  return { title: s.title || u.hostname, kind: 'web', text: s.text, url: u.href, source: u.hostname.replace(/^www\./, '') };
}

/* ---------- study: what the library says about the founder ---------- */
const STOP = new Set('the a an and or but if then so to of in on for with at by from as is are was were be been being it its this that these those i you he she we they me my your our their them us his her not no yes do does did done have has had can could will would should may might must just than too very also about into over under more most some any all each every other such only own same out up down off again further once here there when where why how what which who whom whose because while during before after above below between both few nor now get got make made like one two three really thing things way lot lots much many well even still back going go know want need see think say said dont im ive youre its thats theres cant wont lets yeah okay ok gonna wanna kind sort right actually something someone people time year years day days week'.split(' '));
function rulesProfile(docs, text) {
  const words = (text.toLowerCase().match(/[a-z][a-z'’-]{1,}/g) || []).map((w) => w.replace(/[’']/g, ''));
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  const freq = {}; words.forEach((w) => { if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([w, n]) => ({ w, n }));
  const grams = {}; for (let i = 0; i < words.length - 2; i++) { const a = words[i], b = words[i + 1], c = words[i + 2]; if (STOP.has(a) || STOP.has(c) || a.length < 3 || c.length < 3) continue; const k = a + ' ' + b + ' ' + c; grams[k] = (grams[k] || 0) + 1; }
  for (let i = 0; i < words.length - 1; i++) { const a = words[i], b = words[i + 1]; if (STOP.has(a) || STOP.has(b) || a.length < 4 || b.length < 4) continue; const k = a + ' ' + b; grams[k] = (grams[k] || 0) + 1; }
  const phrases = Object.entries(grams).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([p, n]) => ({ p, n }));
  const prices = []; const seen = new Set(); (text.match(/[^.\n]{0,70}(?:[$€£]\s?\d[\d,.]*(?:k|K)?|\d[\d,.]*\s?(?:USD|EUR|dollars|euros))[^.\n]{0,50}/g) || []).forEach((m) => { const a = (m.match(/[$€£]\s?\d[\d,.]*(?:k|K)?|\d[\d,.]*\s?(?:USD|EUR|dollars|euros)/) || [])[0]; if (a && !seen.has(a) && prices.length < 12) { seen.add(a); prices.push({ amount: a, context: clip(m, 140) }); } });
  const W = words.length || 1; const S = sentences.length || 1;
  const syll = (w) => Math.max(1, (w.replace(/e$/, '').match(/[aeiouy]+/g) || []).length);
  const grade = Math.max(1, Math.round((0.39 * (W / S) + 11.8 * (words.reduce((s, w) => s + syll(w), 0) / W) - 15.59) * 10) / 10);
  const count = (rx) => (text.match(rx) || []).length;
  const byCat = docs.reduce((m, d) => ((m[d.category] = (m[d.category] || 0) + 1), m), {});
  return {
    stats: { docs: docs.length, words: W, avg_sentence_words: Math.round((W / S) * 10) / 10, reading_grade: grade, you_per_100: Math.round((words.filter((w) => w === 'you' || w === 'your').length / W) * 1000) / 10, i_per_100: Math.round((words.filter((w) => w === 'i' || w === 'my' || w === 'me').length / W) * 1000) / 10, questions_pct: Math.round((sentences.filter((s) => /\?$/.test(s)).length / S) * 100), exclaims_pct: Math.round((sentences.filter((s) => /!$/.test(s)).length / S) * 100), em_dashes: count(/\u2014/g), by_category: byCat },
    keywords, phrases, prices,
  };
}
async function study(jwt, b) {
  const ws = b.workspace_id;
  const docs = await sb(jwt, `/rest/v1/brain_docs?workspace_id=eq.${ws}&status=eq.ready&category=neq.reference&select=id,title,category,kind,words,summary&order=created_at.desc&limit=200`);
  if (!docs.length) throw bad('Add a few documents first. The OS studies what you upload.', 409);
  const chunks = await sb(jwt, `/rest/v1/brain_chunks?workspace_id=eq.${ws}&select=doc_id,idx,heading,body,brain_docs!inner(category)&brain_docs.category=neq.reference&order=doc_id,idx&limit=4000`);
  const per = {}; chunks.forEach((c) => (per[c.doc_id] = per[c.doc_id] || []).push(c));
  const all = chunks.map((c) => c.body).join('\n').slice(0, 1.2e6);
  const rules = rulesProfile(docs, all);
  const keys = await aiKeys(jwt, ws); let prof = { ...rules }; let method = 'rules';
  const fb = factsBlock(await approvedFacts(jwt, ws));
  if (hasAI(keys)) {
    const budget = 90000; const share = Math.max(1200, Math.floor(budget / docs.length));
    const sample = docs.map((d) => `### ${d.title} [${d.category}]\n` + (per[d.id] || []).map((c) => c.body).join('\n').slice(0, share)).join('\n\n').slice(0, budget);
    const r = await ai(keys, AI_SYS + ' Return JSON only.', `Study this founder's own material and describe them so other AI agents can write and build exactly like them.\n\nReturn one JSON object with these keys:\n"summary": 2 or 3 sentences on who they are and what they sell,\n"voice": {"tone": [3-6 words], "do": [5-8 short rules seen in their writing], "dont": [4-6 things they never do], "signature_phrases": [up to 8 phrases they actually use, quoted from the text]},\n"audience": [3-6 short descriptions of who they serve and what those people want],\n"offers": [{"name": "", "price": "", "promise": ""}] only offers named in the material,\n"beliefs": [4-8 positions they hold],\n"stories": [up to 6 personal stories or examples they reuse, one line each],\n"topics": [6-12 topics they talk about],\n"proof": [results, numbers and credentials they cite],\n"gaps": [3-5 things the material does not say that agents would need].\nOnly use what is in the material. If something is missing, leave the list empty. Where the founder facts below say something, they are correct and the profile must agree with them.\n\n${fb ? fb + '\n\n' : ''}MATERIAL:\n${sample}`, 2600);
    const j = r && jsonOut(r.text); if (j) { prof = { ...rules, ...j }; method = r.by; }
  }
  const row = { workspace_id: ws, profile: prof, method, doc_count: docs.length, studied_at: new Date().toISOString() };
  await sb(jwt, '/rest/v1/brain_profile?on_conflict=workspace_id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });
  let proposed = 0; try { proposed = (await propose(jwt, { workspace_id: ws, _keys: keys })).added; } catch { /* facts are optional */ }
  return { ok: true, method, profile: prof, doc_count: docs.length, proposed };
}


/* ---------- Founder Algorithm: approved facts every AI reads first ---------- */
const FACT_CATS = { identity: 'Who I am', offers: 'What I sell', revenue: 'How I make money', audience: 'Who I serve', voice: 'How I talk', beliefs: 'What I believe', proof: 'Proof and results', goals: 'Where I am going', stack: 'How I run it', never: 'Never' };
const fkey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function factsBlock(rows) {
  const ok = (rows || []).filter((f) => f.status === undefined || f.status === 'approved');
  if (!ok.length) return '';
  const by = {}; ok.forEach((f) => (by[f.category] = by[f.category] || []).push(f));
  const parts = Object.keys(FACT_CATS).filter((c) => by[c]).map((c) => FACT_CATS[c] + ':\n' + by[c].sort((a, b) => (b.weight || 2) - (a.weight || 2)).map((f) => '- ' + f.statement + ((f.weight || 2) >= 3 ? ' (core)' : '')).join('\n'));
  return 'FOUNDER FACTS. Approved by the founder and always true. If anything else in this prompt disagrees, these win. Never contradict them. Never invent offers, prices, numbers, clients or results beyond them. Everything under Never is a hard rule.\n\n' + parts.join('\n\n');
}
async function approvedFacts(jwt, ws) { try { return await sb(jwt, `/rest/v1/brain_facts?workspace_id=eq.${ws}&status=eq.approved&select=category,statement,weight&order=weight.desc,approved_at.asc&limit=400`); } catch { return []; } }

// Rules fallback: first-person statements from the founder's own documents, sorted into categories by keywords.
const RX = [
  ['never', /^(i|we) (never|don'?t|do not|won'?t|will not|refuse)\b/i],
  ['offers', /[$€£]\s?\d|\b(price|priced|costs?|per month|a month|program|course|coaching|membership|bundle|kit|offer|package)\b/i],
  ['audience', /\b(i|we) (help|serve|work with|teach|coach)\b|\b(for|my) (founders|coaches|creators|solopreneurs|agencies|owners|students|clients|customers)\b/i],
  ['revenue', /\b(affiliate|commission|recurring|revenue|mrr|income|retainer|clients pay|customers pay|streams?)\b/i],
  ['proof', /\b\d[\d,.]*\+?\s?(students|clients|customers|members|subscribers|funnels|sites|websites|sales|people|founders|countries)\b|\b(built|sold|generated|helped)\b.*\d/i],
  ['goals', /\b(goal|by 20\d\d|this year|next year|aim|plan to|want to (reach|hit|build|grow))\b/i],
  ['stack', /\b(highlevel|gohighlevel|ghl|lovable|claude|chatgpt|stripe|zapier|notion|vercel|supabase|kajabi|clickfunnels)\b/i],
  ['beliefs', /\b(i believe|we believe|the truth is|most people|should|always|the best way)\b/i],
  ['identity', /^(i am|i'm|my name|i founded|i started|i run|i built|i live|i'?ve been)\b/i],
];
function rulesFacts(chunks, docTitle) {
  const out = []; const seen = new Set();
  for (const c of chunks) {
    const sents = String(c.body).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
    for (let s of sents) {
      s = s.trim().replace(/^[-*>\d.)\s]+/, '').replace(/\u2014/g, ',');
      const w = s.split(/\s+/).length; if (w < 5 || w > 32 || /\?$/.test(s) || /https?:/.test(s)) continue;
      if (!/^(i|i'm|i've|i'll|my|we|we're|our)\b/i.test(s)) continue;
      const hit = RX.find(([, rx]) => rx.test(s)); if (!hit) continue;
      const k = fkey(s); if (seen.has(k)) continue; seen.add(k);
      out.push({ category: hit[0], statement: s.replace(/[.!]+$/, '') + '.', evidence: null, doc_title: docTitle[c.doc_id] || null });
    }
  }
  const per = {}; return out.filter((f) => ((per[f.category] = (per[f.category] || 0) + 1) <= 5)).slice(0, 36);
}
async function propose(jwt, b) {
  const ws = b.workspace_id;
  const docs = await sb(jwt, `/rest/v1/brain_docs?workspace_id=eq.${ws}&status=eq.ready&category=neq.reference&select=id,title,category&order=created_at.desc&limit=200`);
  if (!docs.length) throw bad('Add a few documents first. The OS proposes facts from what you upload.', 409);
  const chunks = await sb(jwt, `/rest/v1/brain_chunks?workspace_id=eq.${ws}&select=doc_id,idx,body,brain_docs!inner(category)&brain_docs.category=neq.reference&order=doc_id,idx&limit=4000`);
  const existing = await sb(jwt, `/rest/v1/brain_facts?workspace_id=eq.${ws}&select=category,statement,status&limit=1000`);
  const have = new Set(existing.map((f) => fkey(f.statement)));
  const title = Object.fromEntries(docs.map((d) => [d.id, d.title]));
  const keys = b._keys || await aiKeys(jwt, ws); let found = []; let method = 'patterns';
  if (hasAI(keys)) {
    const per = {}; chunks.forEach((c) => (per[c.doc_id] = per[c.doc_id] || []).push(c.body));
    const share = Math.max(1500, Math.floor(80000 / docs.length));
    const sample = docs.map((d) => `### ${d.title}\n` + (per[d.id] || []).join('\n').slice(0, share)).join('\n\n').slice(0, 80000);
    const known = existing.filter((f) => f.status !== 'proposed').map((f) => `- [${f.status}] ${f.statement}`).join('\n').slice(0, 8000);
    const r = await ai(keys, AI_SYS + ' Return JSON only.', `Read this founder's own material and pull out facts about them and their business that every AI writing for them must get right.\n\nRules for each fact:\n- One short statement, first person, present tense, under 30 words. Example: "I sell the App Builder Kit for $497, one payment."\n- Only what the material says. Keep exact names, prices and numbers.\n- Pick one category: ${Object.entries(FACT_CATS).map(([k, v]) => k + ' (' + v + ')').join(', ')}.\n- "never" is for things they refuse to do or say.\n- Skip anything already known below, approved or rejected.\n- 15 to 40 facts, the most important first.\n\nReturn {"facts":[{"category":"","statement":"","evidence":"short quote from the material","doc":"document title"}]}\n\nALREADY KNOWN:\n${known || 'nothing yet'}\n\nMATERIAL:\n${sample}`, 3200);
    const j = r && jsonOut(r.text);
    if (j && Array.isArray(j.facts)) { method = r.by; found = j.facts.filter((f) => f && FACT_CATS[f.category] && typeof f.statement === 'string').map((f) => ({ category: f.category, statement: clip(f.statement.replace(/\u2014/g, ','), 480), evidence: f.evidence ? clip(String(f.evidence), 500) : null, doc_title: f.doc ? clip(String(f.doc), 200) : null })); }
  }
  if (!found.length) found = rulesFacts(chunks, title);
  const fresh = []; found.forEach((f) => { const k = fkey(f.statement); if (k.length > 2 && !have.has(k)) { have.add(k); fresh.push(f); } });
  const rows = fresh.slice(0, 40).map((f) => ({ workspace_id: ws, ...f, status: 'proposed', source: method === 'patterns' ? 'Patterns in your docs' : 'Studied by ' + method }));
  let added = 0;
  if (rows.length) {
    try { await sb(jwt, '/rest/v1/brain_facts', { method: 'POST', body: rows, prefer: 'return=minimal' }); added = rows.length; }
    catch { for (const r of rows) { try { await sb(jwt, '/rest/v1/brain_facts', { method: 'POST', body: r, prefer: 'return=minimal' }); added++; } catch { /* duplicate */ } } }
  }
  return { ok: true, method, added, found: found.length };
}

/* ---------- build: drafts written from the founder's own context ---------- */
const BUILDS = {
  'youtube-script': ['YouTube script', 'A YouTube video script: a hook for the first 15 seconds, the promise, 3 to 5 sections with examples from my own stories, and a call to action to the right offer. Mark B-roll ideas in brackets.', 'Film it, then schedule in HighLevel'],
  email: ['Email', 'A broadcast email to my list: subject line, preview text and body. One idea, one story, one call to action.', 'Schedule as a HighLevel email campaign'],
  'sales-page': ['Sales page', 'Sales page copy: headline, subhead, the problem, the offer stack, proof, guarantee, FAQs and calls to action. Use only offers, prices and proof from my material.', 'Build the page in HighLevel Funnels'],
  'social-post': ['Social posts', 'Five short social posts for LinkedIn, X and Instagram captions, each from a different angle of the topic, in my voice.', 'Queue in HighLevel Social Planner'],
  offer: ['Offer outline', 'An offer outline: who it is for, the promise, the timeline, the deliverables, bonuses, price anchor and a guarantee, built from what I already sell and say.', 'Add the product in HighLevel Payments'],
  'lead-magnet': ['Lead magnet', 'A lead magnet: title options, the outline, the opt-in page headline and bullets, and the thank-you page next step to my core offer.', 'Build the opt-in funnel in HighLevel'],
};
async function build(jwt, b) {
  const ws = b.workspace_id; const t = BUILDS[b.type]; if (!t) throw bad('Pick what to build');
  const topic = clip(b.topic, 400); if (!topic) throw bad('Say what it is about');
  const keys = await aiKeys(jwt, ws); if (!hasAI(keys)) throw bad('Connect Claude, OpenAI or Perplexity in Connections. The OS writes with your key.', 409);
  const [pr] = await sb(jwt, `/rest/v1/brain_profile?workspace_id=eq.${ws}&select=profile`);
  const hits = await rpc(jwt, 'brain_search', { p_ws: ws, p_q: topic + ' ' + (b.extra || ''), p_limit: 16 }).then((h) => (h || []).filter((x) => x.category !== 'reference').slice(0, 10)).catch(() => []);
  const offer = await Vault.ownOffer(jwt, ws, b.item_id);
  const selectedOffer = offer ? 'SELECTED OWN OFFER, CURRENT SAVED RECORD:\n' + JSON.stringify(offer).slice(0, 10000) : '';
  const p = (pr && pr.profile) || {};
  const fb = (await dnaBody(jwt, ws)) || factsBlock(await approvedFacts(jwt, ws));
  const ctx = [fb,p.summary ? 'WHO I AM: ' + p.summary : '', p.voice ? 'MY VOICE: ' + JSON.stringify(p.voice) : '', p.offers && p.offers.length ? 'MY OFFERS: ' + JSON.stringify(p.offers) : '', p.audience && p.audience.length ? 'MY AUDIENCE: ' + p.audience.join('; ') : '', p.stories && p.stories.length ? 'MY STORIES: ' + p.stories.join('; ') : '', p.proof && p.proof.length ? 'MY PROOF: ' + p.proof.join('; ') : '',
    hits.length ? 'FROM MY DOCS:\n' + hits.map((h) => `[${h.title}] ${h.body}`).join('\n---\n').slice(0, 24000) : '', selectedOffer].filter(Boolean).join('\n\n');
  if (!ctx) throw bad('The Brain is empty. Upload a few documents or approve a few facts first.', 409);
  const inspiration = await Vault.context(jwt, ws, topic + ' ' + (b.extra || ''), b.type === 'offer' ? 'offers' : b.type === 'email' ? 'emails' : 'copy', b.inspiration_ids);
  const r = await ai(keys, AI_SYS + ' Write as the founder, in first person, in their voice. Use their stories, offers and proof from the context. The founder facts are always right. Never invent prices, results or clients. New offer terms are proposals, never established facts. ' + VaultBriefs.RULE, `Write: ${t[1]}\nTopic: ${topic}\n${b.extra ? 'CURRENT NOTES: ' + VaultBriefs.text(b.extra, 5000) + '\n' : ''}${b.inspo ? '\nEXTERNAL STRUCTURE REFERENCE:\n' + clip(b.inspo, 4000) + '\n' : ''}\nCURRENT CONTEXT ABOUT ME:\n${ctx}\n\n${inspiration.text}`, 3000);
  if (!r) throw bad('The AI did not answer. Try again.', 502);
  const production = b.type === 'offer' && b.destination === 'offers' && inspiration.notes.length > 0;
  const [d] = await sb(jwt, '/rest/v1/os_drafts', { method: 'POST', prefer: 'return=representation', body: { workspace_id: ws, kind: production ? 'Offer' : t[0], title: clip(t[0] + ': ' + topic, 200), body: r.text, source: 'Brain · ' + r.by, status: 'waiting', action: production ? 'Develop this offer plan. It is not an approved product.' : t[2],
    meta: { inspiration: inspiration.notes, ...(production ? { production: true, why: 'A draft from your saved vault inspiration and current brief.' } : {}) } } });
  return { draft: d, destination: production ? 'offers' : 'approvals', inspiration: inspiration.notes, used: hits.slice(0, 6).map((h) => h.title).filter((x, i, a) => a.indexOf(x) === i), by: r.by };
}

/* ---------- Brand DNA: offers and funnels from HighLevel, compiled with facts and proven content ---------- */
async function dnaBody(jwt, ws) {
  let body = '';
  try { const [d] = await sb(jwt, `/rest/v1/brand_dna?workspace_id=eq.${ws}&select=body`); body = d?.body?.trim() || ''; } catch { /* Approved facts remain available. */ }
  // Learning is appended as provisional content guidance, never written into DNA.
  const [learning,strategy] = await Promise.all([require('./_learning-store').context(jwt, ws),require('./_strategy').rows(jwt,ws)]);
  if (!body && !strategy.length) return '';
  if (!body) body = factsBlock(await approvedFacts(jwt, ws));
  return [require('./_strategy').context(body,strategy), require('./_learning').prompt(learning)].filter(Boolean).join('\n\n');
}
async function dnaSync(jwt, b) {
  const ws = b.workspace_id; let c;
  try { c = JSON.parse(open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'highlevel' }), 'HighLevel')); } catch { throw bad('Connect HighLevel first. Offers and funnels are read from it.', 409); }
  const cat = await require('./_dna.js').catalog(c);
  if (!cat.kinds.length) throw bad(cat.errors[0] || 'HighLevel did not return offers or funnels', 502);
  const saved = await rpc(jwt, 'dna_sync_save', { p_ws: ws, p_items: cat.items, p_kinds: cat.kinds });
  const dna = await rpc(jwt, 'dna_rebuild', { p_ws: ws });
  return { ok: true, saved, errors: cat.errors, offers: cat.items.filter((i) => i.kind === 'offer').length, funnels: cat.items.filter((i) => i.kind === 'funnel').length, dna };
}
// Remix: a proven post rewritten for this founder. Rules always work. With Claude or OpenAI connected, the AI writes it from the full DNA.
async function remix(jwt, b) {
  const ws = b.workspace_id; const post = b.post || {};
  if (!post.title) throw bad('Pick a proven post to remix');
  const R = require('../js/remix.js');
  const items = await sb(jwt, `/rest/v1/founder_strategy?workspace_id=eq.${ws}&lifecycle=eq.live&select=kind,name,price,currency,price_note,summary,url`);
  const dnaObj = { offers: items.filter((i) => i.kind === 'offer'), funnels: items.filter((i) => i.kind === 'funnel') };
  const rules = R.brief(post, dnaObj, b.pool || []);
  let text = R.text(rules, post); let by = 'Rules';
  if (b.ai !== false) {
    const keys = await aiKeys(jwt, ws);
    if (hasAI(keys)) {
      const body = await dnaBody(jwt, ws);
      const r = await ai(keys, AI_SYS + ' Write as the founder, in first person, in their voice.', `${body}\n\nA post that already worked for someone else:\nTitle: ${post.title}\nCreator: ${post.author || 'unknown'}\nResult: ${post.views || '?'} views, ${post.outlier || '?'}x their own median\nPlatform: ${post.platform || ''} ${post.format || ''}\nPattern: ${rules.pattern.name}\n\nWrite my version. Keep the pattern that made it work, change everything else so it is mine: my topic, my stories, my proof. Point it at ${rules.offer ? rules.offer.name : 'my best fitting offer'}${rules.funnel ? ' through the ' + rules.funnel.name + ' funnel' : ''}. Only use offers, prices and facts from the Brand DNA above.\n\nGive me, in plain text: 3 title options, the hook for the first 15 seconds, a 6 beat outline ending in the call to action, and one line on why this should work for my audience.`, 1400).catch(() => null);
      if (r && r.text) { text = `Remix of "${post.title}" by ${post.author || 'a creator'}\nPattern: ${rules.pattern.name}. Proof: ${rules.proof}\n\n` + r.text; by = r.by; }
    }
  }
  let draft = null;
  if (b.save !== false) {
    [draft] = await sb(jwt, '/rest/v1/os_drafts', { method: 'POST', prefer: 'return=representation', body: { workspace_id: ws, kind: 'Remix', title: clip('Remix: ' + rules.titles[0], 200), body: text, source: 'Proven · ' + by, status: 'waiting', action: rules.format === 'short' ? 'Film it, then queue in HighLevel Social Planner' : 'Film it, then add to the content calendar' } });
  }
  return { ok: true, by, brief: rules, text, draft };
}


/* ---------- Ideas: remix a proven post into chosen formats, and the morning run. Both land in Ideas to approve. ---------- */
const IDEAS = require('./_ideas.js');
const aiFn = (keys) => (hasAI(keys) ? (sys, user, max) => ai(keys, sys, user, max) : null);
const ROWSEL = 'id,title,stage,channel,format,publish_at,position,meta,created_at,updated_at';
async function remixIdeas(jwt, b) {
  const ws = b.workspace_id; const post = b.post || {};
  if (!post.title) throw bad('Pick a proven post to remix');
  const formats = (Array.isArray(b.formats) ? b.formats : []).map(String).slice(0, 6);
  if (!formats.length) throw bad('Pick at least one format');
  const inputs = await require('./_strategy').liveInput(jwt,ws,await rpc(jwt, 'idea_inputs', { p_ws: ws }));
  inputs.learning = await require('./_learning-store').context(jwt, ws);
  const keys = b.ai === false ? {} : await aiKeys(jwt, ws);
  const p = { id: clip(post.id, 80), title: clip(post.title, 300), author: clip(post.author, 120), views: Number(post.views) || 0, outlier: Number(post.outlier) || 0, platform: clip(post.platform, 30), format: clip(post.format, 30), url: clip(post.url, 500) };
  const r = await IDEAS.remix(p, formats, inputs, aiFn(keys), inputs.proven || []);
  const rows = await sb(jwt, '/rest/v1/content_items?select=' + ROWSEL, { method: 'POST', prefer: 'return=representation', body: r.items.map((x, k) => ({ workspace_id: ws, ...x, position: -Date.now() / 1e6 - k / 1e9 })) });
  return { ok: true, by: r.by, rows };
}
async function morningIdeas(jwt, b) {
  throw bad('Set an idea cadence in the Newsfeed, or run a task from Agents. The fixed daily batch has been retired.',410);
}

/* ---------- Remix one of the founder's own YouTube videos: same topic, new angle, new hook, new title ---------- */
async function ytRemix(jwt, b) {
  const ws = b.workspace_id; const v = b.video || {};
  if (!v.title) throw bad('Pick one of your videos to remix');
  const R = require('../js/remix.js');
  const items = await sb(jwt, `/rest/v1/founder_strategy?workspace_id=eq.${ws}&lifecycle=eq.live&select=kind,name,price,currency,price_note,summary,url,stream`);
  const dnaObj = { offers: items.filter((i) => i.kind === 'offer'), funnels: items.filter((i) => i.kind === 'funnel') };
  const videos = (Array.isArray(b.videos) ? b.videos : []).slice(0, 50).map((x) => ({ title: clip(String(x.title || ''), 200), x: Number(x.x) || 0, views: Number(x.views) || 0 }));
  const rules = R.remixOwn(v, dnaObj, videos, 4);
  const keys = await aiKeys(jwt, ws);
  if (!hasAI(keys)) return { ok: true, by: 'Rules', remix: rules };
  // the video itself: description and tags say what the topic really is
  let desc = ''; let tags = [];
  const yk = process.env.YOUTUBE_API_KEY;
  if (yk && /^[\w-]{11}$/.test(String(v.id || ''))) {
    try { const j = await jf('YouTube', `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${q(v.id)}&key=${q(yk)}`, { timeout: 8000 }); const sn = ((j.items || [])[0] || {}).snippet || {}; desc = clip(sn.description || '', 1800); tags = (sn.tags || []).slice(0, 15); } catch { /* title is enough */ }
  }
  const body = await dnaBody(jwt, ws);
  const perf = rules.perf.length ? rules.perf.map((p) => `- ${p.name}: ${p.n} videos, average ${p.avg}x my median`).join('\n') : '- not enough uploads synced yet';
  const top = videos.slice().sort((a, c) => c.x - a.x).slice(0, 8).map((x) => `- ${x.title} (${x.x}x)`).join('\n');
  const r = await ai(keys, AI_SYS + ' Write as the founder, in first person, in their voice. Return JSON only.',
    `${body}\n\nMY VIDEO TO REMIX\nTitle: ${v.title}\nResult: ${v.views || '?'} views, ${v.x || '?'}x my channel median, ${v.likes || '?'} likes, ${v.comments || '?'} comments\nCurrent angle: ${rules.source.pattern.name}\n${tags.length ? 'Tags: ' + tags.join(', ') + '\n' : ''}${desc ? 'Description:\n' + desc + '\n' : ''}\nHOW TITLE ANGLES DO ON MY CHANNEL\n${perf}\n\nMY BEST RECENT VIDEOS\n${top || '- none synced'}\n\nGive me 4 new videos on the same topic as this one. Each needs a different angle from the original and from each other: a new frame, a new hook, a new title. Keep the topic and what my audience already showed they want. Favor angles that do well on my channel, and say why with my numbers when you can. Titles in my style, under 70 characters. Hooks are the first 15 seconds, spoken, in my voice. Point the call to action at the best fitting offer from my Brand DNA, and only use offers, prices and facts that are in it.\n\nReturn one JSON object: {"topic": "the topic in 2 to 5 words", "ideas": [{"angle": "short angle name", "title": "...", "alts": ["another title", "another title"], "hook": "...", "outline": ["5 or 6 beats, the last is the call to action"], "why": "one line on why this should work, with my numbers when possible"}]}`, 2200).catch(() => null);
  const j = r && jsonOut(r.text);
  const ideas = j && Array.isArray(j.ideas) ? j.ideas.filter((i) => i && i.title).slice(0, 6).map((i) => ({
    pattern: { id: R.pattern(i.title).id, name: clip(clean(i.angle || R.pattern(i.title).name), 60) }, title: clip(clean(i.title), 140),
    alts: (Array.isArray(i.alts) ? i.alts : []).map((t) => clip(clean(t), 140)).filter(Boolean).slice(0, 3), hook: clip(clean(i.hook), 600),
    outline: (Array.isArray(i.outline) ? i.outline : []).map((t) => clip(clean(t), 240)).filter(Boolean).slice(0, 8), why: clip(clean(i.why), 300), evidence: '' })) : null;
  if (!ideas || !ideas.length) return { ok: true, by: 'Rules', remix: rules, note: 'The AI answer could not be read, so these come from your channel patterns.' };
  return { ok: true, by: r.by, remix: { ...rules, topic: clip(clean(j.topic || rules.topic), 80), ideas } };
}

/* ---------- How I write: the AI studies pieces the founder wrote and writes the style guide agents follow ---------- */
const VP = require('../js/voiceprint.js');
async function voiceStudy(jwt, b) {
  const ws = b.workspace_id;
  const xs = await sb(jwt, `/rest/v1/writing_samples?workspace_id=eq.${ws}&select=title,kind,body,words,pinned&order=pinned.desc,created_at.desc&limit=60`);
  if (!xs.length) throw bad('Paste something you wrote first.', 409);
  const keys = await aiKeys(jwt, ws);
  if (!hasAI(keys)) throw bad('Connect Claude, OpenAI or Perplexity in Connections to study your writing with AI.', 409);
  const p = VP.analyze(xs); const rules = VP.guide(p);
  const budget = 70000; const share = Math.max(1500, Math.floor(budget / xs.length));
  const pieces = xs.map((x, i) => `### ${i + 1}. ${x.title} [${x.kind}]\n${String(x.body).slice(0, share)}`).join('\n\n').slice(0, budget);
  const r = await ai(keys, AI_SYS + ' Return JSON only.',
    `These are pieces the founder wrote themself. Study them so other AI agents can write new content that reads as if the founder wrote it.\n\nMeasured from the text:\n${rules.map((g) => '- ' + g).join('\n')}\n\nReturn one JSON object with one key, "guide": an array of 10 to 14 short, concrete instructions an AI writer can follow. Cover rhythm and sentence length, how pieces open, how they build an argument or story, how they close and ask for action, tone and attitude, typical structures, signature phrases and words (quote them), punctuation habits, and what this founder never does. Every point must come from the pieces, never generic writing advice. Write each point as an instruction, under 35 words.\n\nPIECES\n${pieces}`, 1600);
  const j = r && jsonOut(r.text);
  const guide = j && Array.isArray(j.guide) ? j.guide.map((g) => clip(clean(String(g)), 400)).filter(Boolean).slice(0, 16) : null;
  if (!guide || !guide.length) throw bad('The AI did not return a style guide. Try again in a moment.', 502);
  const row = { workspace_id: ws, profile: p || {}, guide: rules, ai_guide: guide, ai_by: r.by, ai_samples: xs.length, ai_at: new Date().toISOString(), samples: xs.length, words: xs.reduce((a, x) => a + (x.words || 0), 0), studied_at: new Date().toISOString() };
  const [style] = await sb(jwt, '/rest/v1/writing_style?on_conflict=workspace_id', { method: 'POST', prefer: 'return=representation,resolution=merge-duplicates', body: row });
  return { ok: true, by: r.by, style };
}

/* ---------- Written posts from a video that beat its median, in the founder's voice ---------- */
const ytIdOf = (s) => { s = String(s || ''); if (/^[\w-]{11}$/.test(s)) return s; const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ''; };
async function transcriptOf(jwt, ws, id) {
  let tok; try { tok = open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'apify' })); } catch { return ''; }
  try { const j = JSON.parse(tok); tok = j.token || j.key || tok; } catch { /* plain token */ }
  try {
    const rows = await jf('Apify', `https://api.apify.com/v2/acts/pintostudio~youtube-transcript-scraper/run-sync-get-dataset-items?token=${q(tok)}&timeout=35`, { method: 'POST', timeout: 40000, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: 'https://www.youtube.com/watch?v=' + id }) });
    const segs = (Array.isArray(rows) ? rows : []).flatMap((r) => (Array.isArray(r.data) ? r.data : []));
    return segs.map((s) => String(s.text || '').replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')).join(' ').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}
async function postWrite(jwt, b) {
  const ws = b.workspace_id; const src = b.video || {};
  if (!src.title) throw bad('Pick a video to write from');
  const PW = require('../js/post-writer.js');
  const id = ytIdOf(src.id || src.url);
  const v = { id, url: src.url || (id ? 'https://www.youtube.com/watch?v=' + id : ''), title: clip(String(src.title), 200), author: clip(String(src.author || ''), 120), views: Number(src.views) || 0, x: Number(src.x || src.outlier) || 0, own: !!src.own, platform: src.platform || 'youtube' };
  const items = await sb(jwt, `/rest/v1/founder_strategy?workspace_id=eq.${ws}&lifecycle=eq.live&select=kind,name,price,currency,price_note,summary,url`);
  const own = { offers: items.filter((i) => i.kind === 'offer'), funnels: items.filter((i) => i.kind === 'funnel') };
  let transcript = id ? await transcriptOf(jwt, ws, id) : '';
  let description = '';
  const yk = process.env.YOUTUBE_API_KEY;
  if (id && yk && transcript.length < 400) {
    try { const j = await jf('YouTube', `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${q(id)}&key=${q(yk)}`, { timeout: 8000 }); description = clip(((((j.items || [])[0] || {}).snippet) || {}).description || '', 2000); } catch { /* title is enough */ }
  }
  const fb = PW.rules({ video: v, transcript, offers: own.offers, funnels: own.funnels });
  let posts = fb.posts; let by = 'Rules';
  const keys = await aiKeys(jwt, ws);
  if (hasAI(keys)) {
    const dna = await dnaBody(jwt, ws);
    let guide = '';
    try { const [st] = await sb(jwt, `/rest/v1/writing_style?workspace_id=eq.${ws}&select=ai_guide,guide`); const g = st && ((st.ai_guide && st.ai_guide.length ? st.ai_guide : st.guide) || []); if (g.length) guide = 'HOW I WRITE\n' + g.map((x) => '- ' + x).join('\n'); } catch { /* DNA has the voice */ }
    const user = [dna, guide, b.note ? 'MY NOTE FOR THIS ONE: ' + clip(String(b.note), 600) : '', PW.prompt({ video: v, transcript, description, pattern: fb.pattern && fb.pattern.name, max: 14000 })].filter(Boolean).join('\n\n');
    const r = await ai(keys, AI_SYS + ' Write as the founder, in first person, in their voice. Return JSON only.', user, 2400).catch(() => null);
    const got = r && PW.parse(r.text);
    if (got) { posts = got; by = r.by; }
  }
  const drafts = [];
  for (const p of posts) {
    const [d] = await sb(jwt, '/rest/v1/os_drafts', { method: 'POST', prefer: 'return=representation', body: { workspace_id: ws, kind: 'Post', title: clip(p.title || v.title, 200), body: p.body, source: clip('Outlier · ' + v.title + ' · ' + by, 300), status: 'waiting', action: 'Approve to add it to the content board',
      meta: { video_id: id, url: v.url, video: v.title, author: v.author, views: v.views, x: v.x, own: v.own, format: p.format, angle: p.angle, offer: p.offer || fb.offer || null, by, transcript: transcript.length > 400 } } });
    drafts.push(d);
  }
  return { ok: true, by, transcript: transcript.length > 400, words: transcript ? transcript.split(' ').length : 0, drafts };
}
// One post, rewritten with a note from the founder. Needs Claude or OpenAI.
async function postRewrite(jwt, b) {
  const ws = b.workspace_id; const PW = require('../js/post-writer.js');
  const [d] = await sb(jwt, `/rest/v1/os_drafts?id=eq.${q(b.draft_id)}&workspace_id=eq.${ws}&select=id,title,body,meta`);
  if (!d) throw bad('That post is gone', 404);
  const keys = await aiKeys(jwt, ws);
  if (!hasAI(keys)) throw bad('Connect Claude, OpenAI or Perplexity in Connections to rewrite posts.', 409);
  const dna = await dnaBody(jwt, ws);
  const body = clip(String(b.body || d.body), 5000);
  const r = await ai(keys, AI_SYS + ' Write as the founder, in first person, in their voice. Return JSON only.', `${dna}\n\nA post I am about to publish, written from my video "${(d.meta || {}).video || d.title}":\n\n${body}\n\nRewrite it. ${b.note ? 'What I want changed: ' + clip(String(b.note), 600) : 'Make the hook sharper and the lines tighter. Keep the facts.'}\nKeep it in my voice. No hashtags, no emojis, no em dashes, no exclamation points. Never invent results.\nReturn JSON only: {"posts":[{"format":"${(d.meta || {}).format || 'long'}","angle":"...","title":"...","body":"...","offer":null}]}`, 1600);
  const got = r && PW.parse(r.text);
  if (!got) throw bad('The AI did not answer. Try again.', 502);
  const [u] = await sb(jwt, `/rest/v1/os_drafts?id=eq.${q(d.id)}&workspace_id=eq.${ws}`, { method: 'PATCH', prefer: 'return=representation', body: { body: got[0].body, meta: { ...(d.meta || {}), by: r.by, rewritten: true } } });
  return { ok: true, by: r.by, draft: u };
}

/* ---------- emails: a library sequence rewritten for one funnel or offer ---------- */
const EL = require('../js/email-library.js');
const EW = require('../js/email-writer.js');
async function emailWrite(jwt, b) {
  const ws = b.workspace_id; let seq = EL.byId(String(b.sequence || ''));
  // A morning email is a saved single draft, not another universal library
  // sequence. Rewrites use its actual text and never add it to the library.
  if (!seq && b.sequence === 'morning-email' && b.set_id) {
    const [saved] = await sb(jwt, `/rest/v1/email_sets?id=eq.${q(b.set_id)}&workspace_id=eq.${ws}&select=sequence,title,emails`);
    if (saved && saved.sequence === 'morning-email' && Array.isArray(saved.emails) && saved.emails.length === 1) {
      seq = { id: 'morning-email', title: saved.title, intro: 'A single email drafted from the founder’s morning briefing. Preserve its purpose; no mandatory offer or pitch.', count: 1, emails: saved.emails };
    }
  }
  if (!seq) throw bad('Pick a sequence');
  const context = clip(String(b.context || ''), 6000);
  let item = null;
  if (b.item_id && /^[0-9a-f-]{36}$/i.test(String(b.item_id))) { try { [item] = await sb(jwt, `/rest/v1/founder_strategy?id=eq.${q(b.item_id)}&workspace_id=eq.${ws}&lifecycle=eq.live&select=kind,name,price,currency,price_note,summary,url`); } catch { item = null; } }
  const offerName = clip(String((item && item.name) || b.offer_name || ''), 160);
  if (!offerName && context.length < 20) throw bad('Pick an offer or funnel, or describe it in the context box');
  let prev = null;
  if (b.set_id) { [prev] = await sb(jwt, `/rest/v1/email_sets?id=eq.${q(b.set_id)}&workspace_id=eq.${ws}&select=id,emails,context,item_name`); if (!prev) throw bad('That set is gone', 404); }
  const founder = clip(String(b.founder || '').trim().split(/\s+/)[0] || 'NAME', 40);
  let emails = EW.fill(seq, { offer: offerName, founder, item }); let by = 'Template fill';
  const keys = await aiKeys(jwt, ws);
  if (hasAI(keys)) {
    const [dna, facts] = await Promise.all([dnaBody(jwt, ws), approvedFacts(jwt, ws)]);
    let guide = '';
    try { const [st] = await sb(jwt, `/rest/v1/writing_style?workspace_id=eq.${ws}&select=ai_guide,guide`); const g = st && ((st.ai_guide && st.ai_guide.length ? st.ai_guide : st.guide) || []); if (g.length) guide = 'HOW I WRITE\n' + g.map((x) => '- ' + x).join('\n'); } catch { /* DNA has the voice */ }
    const inspiration = await Vault.context(jwt, ws, offerName + ' ' + context, 'emails', b.inspiration_ids);
    const user = [dna && clip(dna, 14000), factsBlock(facts), guide, inspiration.text, EW.prompt({ seq, item, offer: offerName, context, founder, prev: prev && prev.emails, note: b.note ? clip(String(b.note), 800) : '' })].filter(Boolean).join('\n\n');
    const r = await ai(keys, AI_SYS + ' You write email sequences for HighLevel as the founder, in first person, in their voice. Return JSON only. ' + VaultBriefs.RULE, user, seq.emails.length * 650 + 600, { timeout: 105000 });
    const got = r && EW.parse(r.text, seq);
    if (!got) throw bad('The AI did not return the emails. Try again.', 502);
    emails = got; by = r.by;
  }
  const row = { workspace_id: ws, sequence: seq.id, title: clip(seq.title + (offerName ? ' for ' + offerName : ''), 200), item_name: offerName || null, context, emails, by, updated_at: new Date().toISOString() };
  const [saved] = prev
    ? await sb(jwt, `/rest/v1/email_sets?id=eq.${q(prev.id)}&workspace_id=eq.${ws}`, { method: 'PATCH', prefer: 'return=representation', body: row })
    : await sb(jwt, '/rest/v1/email_sets', { method: 'POST', prefer: 'return=representation', body: row });
  return { ok: true, by, set: saved };
}

/* ---------- swipe file: read a funnel or offer someone else sells ---------- */
const SW = require('../js/swipe.js');
const IMG_OK = /^image\/(jpeg|png|webp|gif)$/;
async function fetchPage(url) {
  let u; try { u = new URL(String(url || '').trim()); } catch { return { error: 'That link does not look complete.' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'Only web links work here.' };
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u.href, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FoundersAIOS/1.0)', Accept: 'text/html,*/*' }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { error: 'The page answered with ' + r.status + '.' };
    const raw = (await r.text()).slice(0, 3e6);
    const meta = (n) => { const m = raw.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i')); const c = m && m[0].match(/content=["']([^"']*)["']/i); return c ? c[1].replace(/&amp;/g, '&').trim() : null; };
    const st = strip(raw); let og = meta('og:image'); try { if (og) og = new URL(og, u.href).href; } catch { og = null; }
    const desc = meta('og:description') || meta('description');
    return { title: meta('og:title') || st.title, site: meta('og:site_name'), text: [desc, st.text].filter(Boolean).join('\n\n').slice(0, 40000), og, thin: st.text.length < 300 };
  } catch { return { error: 'The page could not be reached in time.' }; } finally { clearTimeout(tm); }
}
async function fetchImg(url, headers) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal }); if (!r.ok) return null;
    const ct = String(r.headers.get('content-type') || '').split(';')[0].trim(); if (!IMG_OK.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 4.5e6) return null;
    return { media_type: ct, data: buf.toString('base64') };
  } catch { return null; } finally { clearTimeout(tm); }
}
async function swipeRead(jwt, b) {
  const ws = b.workspace_id; const { SUPABASE_URL, SUPABASE_KEY } = require('./_lib');
  const [it] = await sb(jwt, `/rest/v1/swipe_items?id=eq.${q(b.id)}&workspace_id=eq.${ws}&select=*`);
  if (!it) throw bad('That swipe is gone.', 404);
  const patch = {}; let note = null;
  if (it.url && (b.refetch || !it.page_text)) {
    const pg = await fetchPage(it.url);
    if (pg.error) note = pg.error + ' Paste the page text or add screenshots so the OS can still read it.';
    else {
      patch.page_text = pg.text || null; if (!it.title && pg.title) patch.title = clip(pg.title, 200); if (!it.brand && pg.site) patch.brand = clip(pg.site, 80);
      if (pg.thin) note = 'The page loads most of its text with JavaScript, so only a little came through. Screenshots fill the gap.';
      if (pg.og && !(it.images || []).some((x) => x.og)) patch.images = [...(it.images || []), { og: true, url: pg.og }];
    }
  }
  const cur = { ...it, ...patch };
  const imgs = [];
  for (const im of (cur.images || []).slice(0, 6)) {
    if (imgs.length >= 4) break;
    const got = im.path ? await fetchImg(`${SUPABASE_URL}/storage/v1/object/brain/${im.path.split('/').map(encodeURIComponent).join('/')}`, { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + jwt })
      : im.url && !(cur.images || []).some((x) => x.path) ? await fetchImg(im.url, { 'User-Agent': 'Mozilla/5.0 (compatible; FoundersAIOS/1.0)' }) : null;
    if (got) imgs.push(got);
  }
  if (!cur.body && !cur.page_text && !imgs.length && !cur.notes) throw bad(note || 'Add a link, some text or a screenshot first.', 422);
  const keys = await aiKeys(jwt, ws); let analysis = null, by = 'Rules';
  if (hasAI(keys)) {
    const dna = await dnaBody(jwt, ws);
    const r = await ai(keys, SW.SYS, { text: SW.prompt(cur, dna), images: imgs }, 4500, { model: b.model });
    analysis = r && SW.parse(r.text); if (analysis) by = r.by;
  }
  if (!analysis) analysis = SW.rules(cur);
  if (note) analysis.note = note;
  analysis.images_read = imgs.length;
  Object.assign(patch, { analysis, analyzed_by: by, analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (!cur.title && analysis.name) patch.title = analysis.name;
  if (!cur.brand && analysis.brand) patch.brand = analysis.brand;
  const [u] = await sb(jwt, `/rest/v1/swipe_items?id=eq.${q(it.id)}&workspace_id=eq.${ws}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
  let dna = null; try { dna = await rpc(jwt, 'dna_rebuild', { p_ws: ws }); } catch { /* DNA catches up next rebuild */ }
  return { ok: true, by, item: u, dna };
}

// Call review: the member check runs with the user's session, the reading and saving with the server secret.
async function callsReview(jwt, b) {
  const ws = b.workspace_id;
  const before = await rpc(jwt, 'calls_status', { p_ws: ws });
  if (b.status_only) return { status: before };
  if (!process.env.CRON_SECRET) throw bad('Call review needs CRON_SECRET. Add it in Vercel (Settings, then Environment Variables), redeploy, then open Settings in the app once so the setup check registers it.', 500);
  const keys = await aiKeys(jwt, ws);
  const id = /^[0-9a-f-]{36}$/i.test(String(b.recording_id || '')) ? b.recording_id : null;
  const r = await require('./_calls.js').reviewNext({ secret: process.env.CRON_SECRET, ws, keys, id });
  return { ...r, status: await rpc(jwt, 'calls_status', { p_ws: ws }) };
}

const ACTIONS = { ...require('./_programs').actions, ...Vault.service({ ai, aiKeys, dnaBody }), ...require('./_content-funnel').service({ ai, aiKeys, dnaBody }), 'email-write': emailWrite, 'calls-review': callsReview, 'remix-ideas': remixIdeas, 'morning-ideas': morningIdeas, 'swipe-read': swipeRead, 'post-write': postWrite, 'post-rewrite': postRewrite, 'dna-sync': dnaSync, 'voice-study': voiceStudy, remix, 'yt-remix': ytRemix, propose, 'import-link': (jwt, b) => importLink(jwt, b.workspace_id, b.url), study, build, builds: async () => ({ builds: Object.entries(BUILDS).map(([id, [name]]) => ({ id, name })) }) };

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  const act = ACTIONS[b.action]; if (!act) return send(400, { error: 'Unknown action' });
  if (!jwt) return send(401, { error: 'Sign in first' });
  if (!/^[0-9a-f-]{36}$/i.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
  try { return send(200, await act(jwt, b)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._rulesProfile = rulesProfile;
module.exports._strip = strip;
module.exports._ai = ai;
module.exports._aiKeys = aiKeys;
module.exports._route = route;
module.exports._canUse = canUse;
module.exports._hasAI = hasAI;
module.exports._pplx = pplx;
module.exports._pplxId = pplxId;
module.exports._pplxText = pplxText;
module.exports._transcriptOf = transcriptOf;
module.exports._noThink = noThink;
module.exports._MODELS = MODELS;
module.exports._DEFAULT_MODELS = DEFAULT;
module.exports._factsBlock = factsBlock;
module.exports._FACT_CATS = FACT_CATS;
module.exports._modelName = modelName;
module.exports._dnaBody = dnaBody;

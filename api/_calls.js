// Call review: reads one call transcript with the founder's Brand DNA and suggests what to keep.
// Promises the founder made, things others owe, decisions, objections, wins, member questions and content ideas.
// Everything is saved as a suggestion. The founder keeps or dismisses each one in Memory and on the Content board.
const { rpc, jf, clip } = require('./_lib');

const SYS = `You review one recorded call for a founder who runs a coaching community, digital products, software and affiliate offers.
Read the transcript and pull out only what was actually said. Quote the words. Never invent names, dates or numbers.
Plain words, short sentences. No em dashes, no exclamation points, no emojis, no hype.
Return JSON only, with this shape:
{"summary": "two or three sentences on what the call covered",
 "promises": [{"text": "what the founder said they will do, as a task starting with a verb", "who": "who it is for, if named", "due": "YYYY-MM-DD if a day was said, else null", "at_s": seconds, "quote": "exact words"}],
 "waiting": [{"text": "what someone else said they will send or do for the founder", "who": "name", "due": null, "at_s": seconds, "quote": "exact words"}],
 "decisions": [{"text": "a decision the founder stated", "at_s": seconds, "quote": "exact words"}],
 "objections": [{"text": "a doubt, fear or reason not to buy or act, in the member's words", "who": "name", "at_s": seconds, "quote": "exact words"}],
 "wins": [{"text": "a result a member or client reported, with the number if said", "who": "name", "at_s": seconds, "quote": "exact words"}],
 "questions": [{"text": "a question a member asked that others likely have too", "who": "name", "at_s": seconds}],
 "ideas": [{"title": "a video or post title in the founder's voice", "format": "long|short|post|carousel|email", "why": "the moment in the call that proves people want this", "at_s": seconds, "quote": "exact words"}]}
Rules: at most 8 promises, 6 waiting, 4 decisions, 6 objections, 6 wins, 6 questions, 6 ideas. Skip small talk, greetings and logistics like "I'll share my screen".
A promise counts only when the founder commits to something after the call. Ideas must come from real questions, objections or wins in this call.`;

const ts = (s) => { const n = Math.max(0, Number(s) || 0); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(Math.floor(n % 60)).padStart(2, '0'); };
const scrub = (t) => String(t == null ? '' : t).replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, '-').replace(/!/g, '.').replace(/\s+/g, ' ').trim();
const atS = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const json = (t) => { const m = String(t || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

// transcripts run long, so this has its own longer timeout. Claude first, OpenAI as the fallback.
async function think(keys, user) {
  let claudeErr = null;
  if (keys.claude) {
    try {
      const j = await jf('Claude', 'https://api.anthropic.com/v1/messages', { method: 'POST', timeout: +(process.env.CALLS_TIMEOUT || 100000), headers: { 'x-api-key': keys.claude, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', ...require('./brain.js')._noThink(process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', 6000), system: SYS, messages: [{ role: 'user', content: user }] }) });
      const t = (j.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
      if (t) return { text: t, by: 'Claude' };
    } catch (e) { if (!keys.openai && !keys.perplexity) throw e; claudeErr = e; }
  }
  if (keys.openai) {
    let j; try { j = await jf('OpenAI', 'https://api.openai.com/v1/responses', { method: 'POST', timeout: 100000, headers: { Authorization: 'Bearer ' + keys.openai, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6.1-sol', instructions: SYS, input: user, max_output_tokens: 5000 }) }); } catch (e) { if (!keys.perplexity) throw claudeErr || e; claudeErr = claudeErr || e; }
    const t = !j ? '' : j.output_text || (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
    if (t) return { text: t, by: 'OpenAI' };
  }
  if (keys.perplexity) {
    const r = await require('./brain.js')._pplx(keys.perplexity, process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', SYS, user, 8000, 100000);
    if (r && r.text) return { text: r.text, by: 'Perplexity' };
  }
  if (claudeErr) throw claudeErr;
  return null;
}

// turn the model's answer into rows for Memory and the Content board
function shape(out) {
  const L = (k, n) => (Array.isArray(out[k]) ? out[k] : []).filter((x) => x && (x.text || x.title)).slice(0, n);
  const row = (kind, x, tag) => ({ kind, text: clip(scrub(x.text), 600), who: x.who ? clip(scrub(x.who), 120) : null, due: day(x.due), at_s: atS(x.at_s), quote: x.quote ? clip(scrub(x.quote), 400) : null, tag: tag || null });
  const items = [
    ...L('promises', 8).map((x) => row('commitment', x)),
    ...L('waiting', 6).map((x) => row('waiting', x)),
    ...L('decisions', 4).map((x) => row('decision', x)),
    ...L('objections', 6).map((x) => row('note', x, 'objection')),
    ...L('wins', 6).map((x) => row('note', x, 'win')),
    ...L('questions', 6).map((x) => row('note', x, 'question')),
  ].filter((x) => x.text.length >= 3);
  const ideas = L('ideas', 6).map((x) => ({ title: clip(scrub(x.title || x.text), 200), format: ['long', 'short', 'post', 'carousel', 'email'].includes(x.format) ? x.format : 'long', channel: x.format === 'post' || x.format === 'carousel' ? 'instagram' : x.format === 'email' ? 'email' : 'youtube', why: x.why ? clip(scrub(x.why), 600) : null, quote: x.quote ? clip(scrub(x.quote), 400) : null, at_s: atS(x.at_s) })).filter((x) => x.title.length >= 3);
  const counts = { promises: items.filter((x) => x.kind === 'commitment').length, waiting: items.filter((x) => x.kind === 'waiting').length, decisions: items.filter((x) => x.kind === 'decision').length, objections: items.filter((x) => x.tag === 'objection').length, wins: items.filter((x) => x.tag === 'win').length, questions: items.filter((x) => x.tag === 'question').length, ideas: ideas.length };
  return { summary: clip(scrub(out.summary), 800), items, ideas, counts };
}

// Review the next unreviewed call, or one call by id. secret is the server's shared secret.
async function reviewNext({ secret, ws, keys, id = null, by = null }) {
  if (!keys || (!(keys.claude || keys.openai || keys.perplexity))) { const e = new Error('Connect Claude, OpenAI or Perplexity in Connections so Founders AI OS can read your calls.'); e.code = 409; throw e; }
  const list = await rpc(null, 'cron_calls_pending', { p_secret: secret, p_ws: ws, p_limit: 1, p_id: id });
  const call = (list || [])[0];
  if (!call) return { done: true };
  let dna = '';
  try { const inp = await rpc(null, 'cron_idea_inputs', { p_secret: secret, p_ws: ws }); dna = String((inp && inp.dna) || '').slice(0, 6000); } catch { /* reviews still work without it */ }
  const transcript = String(call.transcript || '');
  const body = transcript.length > 110000 ? transcript.slice(0, 80000) + '\n[...]\n' + transcript.slice(-30000) : transcript;
  const when = call.started_at ? String(call.started_at).slice(0, 10) : '';
  const user = `${dna ? 'The founder\'s Brand DNA, for names of offers and who the audience is:\n' + dna + '\n\n' : ''}Call: ${call.title}${when ? ', ' + when : ''}${call.minutes ? ', ' + call.minutes + ' minutes' : ''}.\nDates like "Friday" mean the first such day after ${when || 'the call'}.\n\nTranscript, each line starts with [mm:ss]:\n${body}`;
  const r = await think(keys, user);
  const out = r && json(r.text);
  if (!out) { const e = new Error('The AI did not return a readable review. Try again.'); e.code = 502; throw e; }
  const s = shape(out);
  const review = { summary: s.summary, counts: s.counts, by: r.by, at: new Date().toISOString(), stamps: s.items.filter((x) => x.at_s != null).slice(0, 3).map((x) => ts(x.at_s)) };
  const saved = await rpc(null, 'cron_calls_save', { p_secret: secret, p_ws: ws, p_rec: call.id, p_review: review, p_items: s.items, p_ideas: s.ideas, p_by: by });
  return { done: false, id: call.id, title: call.title, started_at: call.started_at, summary: s.summary, counts: s.counts, saved, by: r.by };
}

module.exports = { reviewNext, _shape: shape, _SYS: SYS };

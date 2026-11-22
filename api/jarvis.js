// Founders AI OS: the Jarvis brain. One conversation that knows the founder's account and can go and look things up.
// Every turn starts from saved Brand DNA, current Live/Planned strategy and the connected sources
// and their newest numbers, so it is never trained once and left to go stale. When it needs more it calls tools:
// HighLevel leads, calls and deals, YouTube research on any creator or topic, the workspace search (calls, Brain,
// offers, creators, research, memory), the content board, goals and the web. It runs on the founder's own
// Claude, OpenAI or Perplexity key. It never reads or sends messages; conversations stay in HighLevel.
const { bad, clip, q, sb, rpc, jf, TZ: OWNER_TZ } = require('./_lib');
const B = require('./brain.js');
const Strategy = require('./_strategy');

const DAY = 864e5;
const YT_KEY = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '';
const TZ = OWNER_TZ;
const num = (n) => (n == null ? null : +n >= 1e6 ? (+n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : +n >= 1e3 ? (+n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(+n)));
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return 0; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const isoDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

/* ---------- tools ---------- */
const TOOLS = [
  { name: 'highlevel_leads', description: 'New contacts (leads) added in HighLevel between two dates, with total, count per source and the latest names. Use for any question about leads, signups, opt-ins or new contacts. For "this week" use Monday of this week as since.', parameters: { type: 'object', properties: { since: { type: 'string', description: 'Start date, YYYY-MM-DD, inclusive' }, until: { type: 'string', description: 'End date, YYYY-MM-DD, inclusive. Defaults to today.' } }, required: ['since'] } },
  { name: 'affiliate_referrals', description: 'People who signed up through the founder\'s HighLevel affiliate link, from HighLevel affiliate postbacks: step-one leads, trials, first payments, commissions and cancellations, with plan, sub ID (which channel or video sent them) and the tags added for bonus emails. Use for questions about affiliate signups, trials, referrals or bonuses. Dates are YYYY-MM-DD.', parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } } },
  { name: 'highlevel_calls_and_deals', description: 'Booked calls in HighLevel calendars for the next 7 days and open opportunities with their pipeline stage and when they last moved.', parameters: { type: 'object', properties: {} } },
  { name: 'youtube_research', description: 'Live YouTube research. Give a channel (name, @handle or link) to get its size, median views and its best and most recent videos with how far each beat the channel median. Or give a topic to find the most viewed recent videos on it across YouTube. Use whenever the founder asks to research a creator, a channel or what works on YouTube.', parameters: { type: 'object', properties: { channel: { type: 'string', description: 'Creator or channel, like Alex Hormozi or @AlexHormozi' }, topic: { type: 'string', description: 'A topic or search phrase' }, days: { type: 'integer', description: 'Look back this many days. Default 365 for a channel, 90 for a topic.' } } } },
  { name: 'search_workspace', description: 'Searches everything the founder has in the OS: Zoom call transcripts, Brain documents, approved facts, offers, funnels, tracked creator posts, research runs, drafts and memory. Use for questions about what they said, wrote, sell or decided.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'proven_content', description: 'Posts and videos from the creators the founder tracks that beat their own median views. Use for content ideas that already worked for others.', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'content_board', description: 'The founder\'s content board: pieces by stage (suggested, approved, planned, production, published) with channel and publish date.', parameters: { type: 'object', properties: { stage: { type: 'string', enum: ['suggested', 'approved', 'planned', 'production', 'published', 'all'] } } } },
  { name: 'memory', description: 'The founder\'s goals, promises, waiting-on items, decisions, people notes and ideas stored in the OS.', parameters: { type: 'object', properties: { kind: { type: 'string', description: 'goal, commit, waiting, decision, person, idea or all' } } } },
  { name: 'remember', description: 'Save something to the founder\'s memory when they ask you to remember, note or capture it.', parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['idea', 'decision', 'commit', 'waiting', 'person', 'note'] }, text: { type: 'string' } }, required: ['kind', 'text'] } },
  { name: 'source_details', description: 'The latest synced numbers and recent items from one connected source, like youtube, instagram, gcal, zoom, stripe or ga4.', parameters: { type: 'object', properties: { provider: { type: 'string' } }, required: ['provider'] } },
];

async function ytj(path) { if (!YT_KEY()) throw bad('YouTube research is not switched on for this server.', 503); return jf('YouTube', 'https://www.googleapis.com/youtube/v3/' + path + (path.includes('?') ? '&' : '?') + 'key=' + q(YT_KEY())); }
async function ytVideos(ids) {
  const out = []; for (let i = 0; i < ids.length; i += 50) { const j = await ytj('videos?part=snippet,statistics,contentDetails&id=' + ids.slice(i, i + 50).join(',')); out.push(...(j.items || [])); }
  return out.map((v) => { const d = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec((v.contentDetails || {}).duration || '') || []; const secs = (+d[1] || 0) * 3600 + (+d[2] || 0) * 60 + (+d[3] || 0);
    return { id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, at: v.snippet.publishedAt, views: +((v.statistics || {}).viewCount || 0), likes: +((v.statistics || {}).likeCount || 0), comments: +((v.statistics || {}).commentCount || 0), short: secs > 0 && secs <= 180, mins: Math.round(secs / 60), url: 'https://www.youtube.com/watch?v=' + v.id }; });
}
async function ytChannel(s) {
  s = String(s || '').trim(); let m; let id = null;
  if ((m = /(UC[\w-]{22})/.exec(s))) id = m[1];
  else if ((m = /@([\w.\-]{2,100})/.exec(s))) { const j = await ytj('channels?part=id&forHandle=' + q('@' + m[1])); id = ((j.items || [])[0] || {}).id || null; }
  if (!id) { const j = await ytj('search?part=snippet&type=channel&maxResults=3&q=' + q(s)); id = (((j.items || [])[0] || {}).id || {}).channelId || null; }
  if (!id) return null;
  const j = await ytj('channels?part=snippet,statistics,contentDetails&id=' + id); return (j.items || [])[0] || null;
}
async function youtubeResearch(a) {
  if (a.channel) {
    const ch = await ytChannel(a.channel); if (!ch) return { found: false, note: 'No YouTube channel matches ' + a.channel };
    const up = ch.contentDetails.relatedPlaylists.uploads; let ids = []; let page = '';
    for (let i = 0; i < 3; i++) { const j = await ytj(`playlistItems?part=contentDetails&maxResults=50&playlistId=${up}${page ? '&pageToken=' + page : ''}`); ids.push(...(j.items || []).map((x) => x.contentDetails.videoId)); page = j.nextPageToken; if (!page) break; }
    const since = Date.now() - (Math.min(+a.days || 365, 1500)) * DAY;
    const vids = (await ytVideos(ids)).filter((v) => Date.parse(v.at) >= since);
    const longs = vids.filter((v) => !v.short), shorts = vids.filter((v) => v.short);
    const medL = median(longs.map((v) => v.views)), medS = median(shorts.map((v) => v.views));
    const tag = (v) => ({ title: v.title, views: num(v.views), x_median: +(v.views / ((v.short ? medS : medL) || 1)).toFixed(1), published: isoDay(v.at), format: v.short ? 'short' : 'long, ' + v.mins + ' min', url: v.url });
    return { channel: ch.snippet.title, handle: ch.snippet.customUrl || null, subscribers: num(ch.statistics.subscriberCount), total_views: num(ch.statistics.viewCount), videos_total: +ch.statistics.videoCount, looked_at: vids.length + ' most recent uploads, back to ' + (vids.length ? isoDay(vids[vids.length - 1].at) : isoDay(since)), median_views_long: num(medL), median_views_shorts: num(medS),
      best: [...vids].sort((x, y) => y.views / ((y.short ? medS : medL) || 1) - x.views / ((x.short ? medS : medL) || 1)).slice(0, 8).map(tag),
      latest: vids.slice(0, 6).map(tag), url: 'https://www.youtube.com/channel/' + ch.id };
  }
  if (a.topic) {
    const since = new Date(Date.now() - (Math.min(+a.days || 90, 730)) * DAY).toISOString();
    const j = await ytj(`search?part=snippet&type=video&order=viewCount&maxResults=15&publishedAfter=${q(since)}&q=${q(a.topic)}`);
    const vids = await ytVideos((j.items || []).map((x) => x.id.videoId).filter(Boolean));
    return { topic: a.topic, since: since.slice(0, 10), videos: vids.sort((x, y) => y.views - x.views).slice(0, 12).map((v) => ({ title: v.title, channel: v.channel, views: num(v.views), published: isoDay(v.at), format: v.short ? 'short' : 'long, ' + v.mins + ' min', url: v.url })) };
  }
  return { note: 'Give a channel or a topic.' };
}

async function hlLeads(jwt, ws, a) {
  const I = require('./inbox.js'); let c; try { c = await I._hlCreds(jwt, ws); } catch { return { connected: false, note: 'HighLevel is not connected.' }; }
  const today = isoDay(Date.now()); const from = /^\d{4}-\d{2}-\d{2}$/.test(a.since || '') ? a.since : today; const to = /^\d{4}-\d{2}-\d{2}$/.test(a.until || '') ? a.until : today;
  const gte = Date.parse(from + 'T00:00:00+02:00'), lte = Date.parse(to + 'T23:59:59+02:00');
  let list = [], total = null;
  try {
    const r = await I._hl(c, '/contacts/search', { method: 'POST', body: { locationId: c.location_id, pageLimit: 100, filters: [{ field: 'dateAdded', operator: 'range', value: { gte: new Date(gte).toISOString(), lte: new Date(lte).toISOString() } }], sort: [{ field: 'dateAdded', direction: 'desc' }] } });
    list = r.contacts || []; total = r.total != null ? r.total : list.length;
  } catch (e) {
    const r = await I._hl(c, `/contacts/?locationId=${q(c.location_id)}&limit=100`);
    list = (r.contacts || []).filter((x) => { const t = Date.parse(x.dateAdded); return t >= gte && t <= lte; }); total = list.length >= 100 ? '100 or more' : list.length;
  }
  const src = {}; list.forEach((x) => { const k = clip(x.source, 60) || 'Direct'; src[k] = (src[k] || 0) + 1; });
  const tags = {}; list.forEach((x) => (x.tags || []).slice(0, 6).forEach((t) => { tags[t] = (tags[t] || 0) + 1; }));
  return { from, to, total, by_source: Object.entries(src).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, n]) => ({ name, n })), top_tags: Object.entries(tags).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
    latest: list.slice(0, 10).map((x) => ({ name: clip(x.contactName || [x.firstName, x.lastName].filter(Boolean).join(' ') || x.email, 80) || 'Unknown', source: clip(x.source, 60) || null, added: isoDay(x.dateAdded) })) };
}
async function hlBrief(jwt, ws) { const I = require('./inbox.js'); let c; try { c = await I._hlCreds(jwt, ws); } catch { return { connected: false, note: 'HighLevel is not connected.' }; } const r = await I._briefFor(c); return { calls_next_7_days: r.calls || [], deals: r.deals || null }; }

async function runTool(name, a, ctx) {
  const { jwt, ws } = ctx; a = a || {};
  if (name === 'highlevel_leads') return hlLeads(jwt, ws, a);
  if (name === 'highlevel_calls_and_deals') return hlBrief(jwt, ws);
  if (name === 'affiliate_referrals') {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(a.from || '') ? a.from : isoDay(new Date(Date.now() - 30 * 864e5)); const to = /^\d{4}-\d{2}-\d{2}$/.test(a.to || '') ? a.to : null;
    const rows = await sb(jwt, `/rest/v1/affiliate_events?workspace_id=eq.${ws}&status=neq.test&created_at=gte.${from}${to ? '&created_at=lt.' + to + 'T23:59:59Z' : ''}&select=kind,name,email,plan,amount,sub_id,tags,status,created_at&order=created_at.desc&limit=200`).catch(() => null);
    if (!rows) return { connected: false, note: 'Affiliate bonuses are not set up yet. HighLevel, then Set up affiliate bonuses.' };
    const by = {}; const via = {}; rows.forEach((r) => { by[r.kind] = (by[r.kind] || 0) + 1; if (r.sub_id && r.kind === 'trial') via[r.sub_id] = (via[r.sub_id] || 0) + 1; });
    return { from, to: to || 'today', counts: by, founder_plan_trials: rows.filter((r) => r.kind === 'trial' && (r.tags || []).some((t) => / founder$/.test(t))).length, trials_by_sub_id: via, not_tagged: rows.filter((r) => r.status === 'error').length, latest: rows.slice(0, 12).map((r) => ({ kind: r.kind, name: r.name || r.email, plan: r.plan, via: r.sub_id, at: String(r.created_at).slice(0, 10) })) };
  }
  if (name === 'youtube_research') return youtubeResearch(a);
  if (name === 'search_workspace') {
    const query = clip(a.query, 300) || '';
    const [rows, strategy] = await Promise.all([
      rpc(jwt, 'chat_search', { p_ws: ws, p_q: query, p_kinds: null, p_limit: 10 }).catch(() => []),
      Strategy.rows(jwt, ws),
    ]);
    const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2);
    const curated = strategy.filter(r => /\b(?:offers?|funnels?|sell|selling|products?|launch(?:es)?)\b/i.test(query) ||
      terms.some(t => `${r.name} ${r.summary || ''}`.toLowerCase().includes(t))).map(r => ({
      kind: r.kind, title: r.name, at: r.updated_at ? String(r.updated_at).slice(0, 10) : null,
      source: 'Founder strategy', status: r.lifecycle,
      text: clip(`${r.lifecycle === 'live' ? 'Founder-confirmed live.' : 'Future plan only. Not currently available.'} ${r.summary || ''}\n${JSON.stringify({ price: r.price, currency: r.currency, url: r.url, details: r.details })}`, 700),
    }));
    const other = (rows || []).filter(r => !['offer', 'funnel'].includes(r.kind)).map(r => ({
      kind: r.kind, title: r.title, at: r.at ? String(r.at).slice(0, 10) : null,
      text: clip(String((r.extra && r.extra.body) || r.snippet || '').replace(/<<|>>/g, ''), 700),
    }));
    return [...curated, ...other].slice(0, 10);
  }
  if (name === 'proven_content') { const rows = await rpc(jwt, 'proven_content', { p_ws: ws, p_limit: Math.min(+a.limit || 12, 25), p_min: 1.5 }).catch(() => []); return (rows || []).map((r) => ({ title: r.title, by: r.author, platform: r.platform, views: num(r.views), x_median: r.outlier, posted: r.posted_at ? String(r.posted_at).slice(0, 10) : null })); }
  if (name === 'content_board') { const st = a.stage && a.stage !== 'all' ? `&stage=eq.${q(a.stage)}` : '&stage=neq.passed'; const rows = await sb(jwt, `/rest/v1/content_items?workspace_id=eq.${ws}${st}&select=title,stage,channel,format,publish_at&order=updated_at.desc&limit=60`).catch(() => []); const by = {}; (rows || []).forEach((r) => { (by[r.stage] = by[r.stage] || []).push(r.title + (r.publish_at ? ' (' + r.publish_at + ', ' + r.channel + ')' : ' (' + r.channel + ')')); }); return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { count: v.length, items: v.slice(0, 12) }])); }
  if (name === 'memory') { const k = a.kind && a.kind !== 'all' ? `&kind=eq.${q(a.kind)}` : ''; const rows = await sb(jwt, `/rest/v1/memory_items?workspace_id=eq.${ws}${k}&status=neq.archived&select=kind,text,due,status,meta,created_at&order=created_at.desc&limit=40`).catch(() => []); return (rows || []).map((r) => ({ kind: r.kind, text: clip(r.text, 300), due: r.due, status: r.status, ...(r.kind === 'goal' && r.meta ? { category: r.meta.cat || r.meta.area || null, means: r.meta.meaning || null, current: r.meta.current ?? null, target: r.meta.target ?? null, unit: r.meta.unit || null, steps: Array.isArray(r.meta.steps) ? r.meta.steps.map((x) => (x.done ? '[done] ' : '[ ] ') + x.t) : undefined } : {}) })); }
  if (name === 'remember') { const text = clip(a.text, 2000); if (!text) return { saved: false }; const kind = ['idea', 'decision', 'commit', 'waiting', 'person'].includes(a.kind) ? a.kind : 'idea'; await sb(jwt, '/rest/v1/memory_items', { method: 'POST', body: { workspace_id: ws, kind, text, meta: { via: 'jarvis-voice' } }, prefer: 'return=minimal' }); ctx.changed = true; return { saved: true, kind, text }; }
  if (name === 'source_details') { const p = String(a.provider || '').toLowerCase().replace(/[^a-z0-9-]/g, ''); const r = (ctx.conns || []).find((c) => c.provider === p || c.provider.startsWith(p)); if (!r) return { connected: false }; const f = (r.meta && r.meta.feed) || {}; return { source: r.account_label || r.provider, synced: r.meta && r.meta.last_sync_at, metrics: f.metrics || [], recent: (f.items || []).slice(0, 15) }; }
  return { error: 'Unknown tool' };
}

/* ---------- context: rebuilt every turn, so it is always current ---------- */
async function context(jwt, ws, b) {
  const [dna, conns, prof, strategy] = await Promise.all([
    sb(jwt, `/rest/v1/brand_dna?workspace_id=eq.${ws}&select=body,version,built_at`).then((r) => r && r[0]).catch(() => null),
    sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${ws}&status=eq.connected&select=provider,account_label,meta`).catch(() => []),
    sb(jwt, `/rest/v1/workspaces?id=eq.${ws}&select=name`).then((r) => r && r[0]).catch(() => null),
    Strategy.rows(jwt, ws),
  ]);
  const lines = (conns || []).filter((c) => !['claude', 'openai', 'elevenlabs', 'apify', 'perplexity'].includes(c.provider)).map((c) => { const m = ((c.meta && c.meta.feed && c.meta.feed.metrics) || []).map((x) => x.l + ' ' + x.v).join(', '); return '- ' + c.provider + (c.account_label ? ' (' + clip(c.account_label, 60) + ')' : '') + (m ? ': ' + m : ''); });
  return { dna, strategy, conns: conns || [], ws: prof && prof.name, sources: lines.join('\n') };
}
function brandContext(cx, limit) {
  const dna = Strategy.cleanDNA(cx.dna?.body || '');
  const strategy = Strategy.context('', cx.strategy);
  const budget = dna ? Math.min(strategy.length, Math.floor(limit / 2)) : limit;
  const note = '\nStrategy details shortened. Search the workspace for specific offers; do not infer missing details.';
  const current = strategy.length > budget ? clip(strategy, budget - note.length) + note : strategy;
  return [current, clip(dna, limit - current.length - 2)].filter(Boolean).join('\n\n');
}
function system(cx, b) {
  const now = new Date(); const day = now.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monday = new Date(now); const wd = (now.getUTCDay() + 6) % 7; monday.setUTCDate(now.getUTCDate() - wd);
  const voice = b.mode !== 'text';
  return [
    `You are Jarvis, the AI chief of staff inside Founders AI OS for ${b.name || 'the founder'}${cx.ws ? ', workspace ' + cx.ws : ''}. You know this business from its Brand DNA below and you can look things up with your tools. Today is ${day} (${isoDay(now)}), ${TZ} time. This week started on Monday ${isoDay(monday)}.`,
    'How you work:',
    '- For numbers, leads, calls, deals, videos, content, goals or anything about this account, call a tool and answer from what it returns. Never guess a number. If a tool says a source is not connected, say so and name the connection to add.',
    '- When asked to research a creator or a topic on YouTube, use youtube_research and pull out what is working: the best videos, how far they beat the median, the patterns in titles and formats, and one or two ideas the founder could make from it in their own voice and pointed at their own offers.',
    '- When asked to brainstorm, think with them like a sharp business partner. Build on their idea, push back when something is weak, bring in their offers, audience, numbers and what already works. Ask one good question at a time when it helps. No tools needed unless facts would make the idea better.',
    '- For general knowledge or current events, use web search if you have it.',
    '- You never read, send or summarize messages or conversations. Those stay in HighLevel.',
    voice ? '- You are speaking out loud. Talk like a person on a call: short sentences, usually two to four, longer only when brainstorming or when asked for detail. No markdown, no lists, no headings, no links, no URLs. Round numbers the way people say them. Give the answer first.' : '- Write plainly in short paragraphs. No headings.',
    '- No em dashes, no exclamation points, no emojis, no filler, no "great question", no formulaic contrast lines.',
    cx.sources ? 'Connected sources and their latest synced numbers:\n' + cx.sources : 'No business sources are connected yet.',
    `CURRENT FOUNDER CONTEXT${cx.dna?.version ? ', saved DNA version ' + cx.dna.version : ''}. Approved facts define the brand; current strategy defines offer and funnel availability:\n` + brandContext(cx, 16000),
    b.local ? 'What the app shows right now:\n' + clip(b.local, 1500) : '',
  ].filter(Boolean).join('\n');
}

/* ---------- the loop: Claude first, OpenAI as the fallback ---------- */
const CLAUDE_FAST = process.env.JARVIS_CLAUDE_MODEL || B._DEFAULT_MODELS.claude;
const OPENAI_FAST = process.env.JARVIS_OPENAI_MODEL || B._DEFAULT_MODELS.openai;
const clean = (t) => String(t || '').replace(/\s*\u2014\s*/g, ', ').replace(/\*\*/g, '').trim();

async function viaClaude(key, sys, msgs, ctx, web = true) {
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  if (web) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 2 });
  const messages = msgs.map((m) => ({ role: m.role, content: m.text }));
  for (let round = 0; round < 5; round++) {
    let j;
    try { j = await jf('Claude', 'https://api.anthropic.com/v1/messages', { method: 'POST', timeout: 45000, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: CLAUDE_FAST, max_tokens: 900, system: sys, tools, messages }) }); }
    catch (e) { if (web && /web_search|tool/i.test(e.message)) return viaClaude(key, sys, msgs, ctx, false); throw e; }
    const uses = (j.content || []).filter((c) => c.type === 'tool_use');
    if (j.stop_reason !== 'tool_use' || !uses.length) { const t = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' '); return { text: clean(t), by: B._modelName ? B._modelName(CLAUDE_FAST) : CLAUDE_FAST }; }
    messages.push({ role: 'assistant', content: j.content });
    const results = await Promise.all(uses.map(async (u) => { ctx.used.push(u.name); let out; try { out = await runTool(u.name, u.input, ctx); } catch (e) { out = { error: clip(e.message, 200) }; } return { type: 'tool_result', tool_use_id: u.id, content: clip(JSON.stringify(out), 12000) }; }));
    messages.push({ role: 'user', content: results });
  }
  return { text: 'That took more steps than I can do in one go. Try a narrower question.', by: CLAUDE_FAST };
}
async function viaOpenAI(key, sys, msgs, ctx, web = true) {
  const tools = TOOLS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }));
  if (web) tools.push({ type: 'web_search' });
  let input = msgs.map((m) => ({ role: m.role, content: m.text })); let prev = null;
  for (let round = 0; round < 5; round++) {
    let j;
    try { j = await jf('OpenAI', 'https://api.openai.com/v1/responses', { method: 'POST', timeout: 45000, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: OPENAI_FAST, instructions: sys, input, tools, max_output_tokens: 4000, reasoning: { effort: 'low' }, ...(prev ? { previous_response_id: prev } : {}) }) }); }
    catch (e) { if (web && /web_search|tool/i.test(e.message)) return viaOpenAI(key, sys, msgs, ctx, false); throw e; }
    const calls = (j.output || []).filter((o) => o.type === 'function_call');
    if (!calls.length) { const t = j.output_text || (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join(''); return { text: clean(t), by: B._modelName ? B._modelName(OPENAI_FAST) : OPENAI_FAST }; }
    prev = j.id;
    input = await Promise.all(calls.map(async (c) => { ctx.used.push(c.name); let a = {}; try { a = JSON.parse(c.arguments || '{}'); } catch {} let out; try { out = await runTool(c.name, a, ctx); } catch (e) { out = { error: clip(e.message, 200) }; } return { type: 'function_call_output', call_id: c.call_id, output: clip(JSON.stringify(out), 12000) }; }));
  }
  return { text: 'That took more steps than I can do in one go. Try a narrower question.', by: OPENAI_FAST };
}

// One Perplexity key: Claude Sonnet through the Agent API, its web search, and Jarvis's own tools.
async function viaPerplexity(key, sys, msgs, ctx, web = true) {
  const model = B._pplxId(CLAUDE_FAST);
  const tools = TOOLS.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters, strict: false }));
  if (web) tools.push({ type: 'web_search', search_type: 'fast', max_results: 6 });
  const input = msgs.map((m) => ({ type: 'message', role: m.role, content: m.text }));
  for (let round = 0; round < 5; round++) {
    let j;
    try { j = await jf('Perplexity', 'https://api.perplexity.ai/v1/agent', { method: 'POST', timeout: 45000, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, instructions: sys, input, tools, max_steps: 3, max_output_tokens: 4000 }) }); }
    catch (e) { if (web && /web_search|tool/i.test(e.message)) return viaPerplexity(key, sys, msgs, ctx, false); throw e; }
    const calls = (j.output || []).filter((o) => o.type === 'function_call');
    if (!calls.length) return { text: clean(B._pplxText(j)), by: B._modelName(CLAUDE_FAST) };
    for (const c of calls) {
      input.push({ type: 'function_call', call_id: c.call_id, name: c.name, arguments: c.arguments, ...(c.thought_signature ? { thought_signature: c.thought_signature } : {}) });
      ctx.used.push(c.name); let a = {}; try { a = JSON.parse(c.arguments || '{}'); } catch {} let out; try { out = await runTool(c.name, a, ctx); } catch (e) { out = { error: clip(e.message, 200) }; }
      input.push({ type: 'function_call_output', call_id: c.call_id, output: clip(JSON.stringify(out), 12000) });
    }
  }
  return { text: 'That took more steps than I can do in one go. Try a narrower question.', by: B._modelName(CLAUDE_FAST) };
}

async function ask(jwt, b) {
  const ws = b.workspace_id; const question = clip(b.q, 2000); if (!question) throw bad('Say or type something first');
  const [keys, cx] = await Promise.all([B._aiKeys(jwt, ws).catch(() => ({})), context(jwt, ws, b)]);
  if (!(keys.claude || keys.openai || keys.perplexity)) throw bad('Jarvis needs a brain. Connect Claude, OpenAI or Perplexity in Connections and it can research, count and brainstorm with you.', 409);
  const hist = (Array.isArray(b.history) ? b.history : []).slice(-12).flatMap((t) => [t.q ? { role: 'user', text: clip(t.q, 1500) } : null, t.a ? { role: 'assistant', text: clip(t.a, 2000) } : null]).filter(Boolean);
  const msgs = [...hist, { role: 'user', text: question }];
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const merged = []; msgs.forEach((m) => { const l = merged[merged.length - 1]; if (l && l.role === m.role) l.text += '\n' + m.text; else merged.push({ ...m }); });
  const sys = system(cx, b); const ctx = { jwt, ws, conns: cx.conns, used: [] };
  let r = null, err = null;
  if (keys.claude) { try { r = await viaClaude(keys.claude, sys, merged, ctx); } catch (e) { err = e; } }
  if (!r && keys.openai) { try { r = await viaOpenAI(keys.openai, sys, merged, ctx); } catch (e) { err = e; } }
  if (!r && keys.perplexity) { try { r = await viaPerplexity(keys.perplexity, sys, merged, ctx); } catch (e) { err = e; } }
  if (!r) throw bad('Your AI model did not answer: ' + clip((err && err.message) || 'no reply', 200), 502);
  return { answer: r.text || 'I came up empty on that one. Try asking another way.', by: r.by, tools: [...new Set(ctx.used)], changed: !!ctx.changed, dna_version: cx.dna ? cx.dna.version : null };
}

// What Jarvis knows going into a live voice session: used for Eleven Realtime instructions.
async function brief(jwt, b) { const cx = await context(jwt, b.workspace_id, b); return { dna: brandContext(cx, 5000), sources: cx.sources }; }

const ACTIONS = { ask, brief };
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
module.exports._ask = ask;
module.exports._brief = brief;
module.exports._runTool = runTool;
module.exports._youtubeResearch = youtubeResearch;

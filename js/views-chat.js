// Founders AI OS: AI Chat. One conversation over everything the OS holds: call recordings, the Brain,
// offers and funnels, creator posts, research, drafts and memory. Every answer shows the passages it used,
// and a recording citation opens the exact moment in the transcript.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const wsId = () => ctx().ws && ctx().ws.id;
  Object.assign(VS, { chScope: VS.chScope && VS.chScope !== 'agents' ? VS.chScope : 'all', chThread: VS.chThread || null, chDraft: VS.chDraft || '' });

  const SCOPES = [['all', 'All'], ['agents', 'Agents'], ['programs', 'Programs'], ['recordings', 'Recordings'], ['brain', 'Brain'], ['offers', 'Offers and funnels'], ['content', 'Content and research'], ['memory', 'Memory']];
  const SUGGEST = [
    ['Summarize my last coaching call', 'recordings'],
    ['What questions come up most on my calls?', 'recordings'],
    ['What did I say about Claude on recent calls?', 'recordings'],
    ['Which offers and funnels do I have for low ticket?', 'offers'],
    ['Which proven hooks fit my AI offers?', 'content'],
    ['What did my competitor research find?', 'content'],
  ];
  const KIND_ICON = { recording: 'calls', doc: 'brain', fact: 'brain', offer: 'offers', funnel: 'funnels', post: 'creators', research: 'research', draft: 'approvals', memory: 'memory', channel: 'connect' };
  const MODELS = [
    ['claude', 'Anthropic', [['claude-fable-5-2', 'Claude Fable 5.2', 'Deepest reasoning'], ['claude-opus-5-5', 'Claude Opus 5.5', 'Long, careful work'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'Fast and sharp'], ['claude-haiku-5-5', 'Claude Haiku 5.5', 'Fastest']]],
    ['openai', 'OpenAI', [['gpt-6-astra', 'GPT-6 Astra', 'Most capable'], ['gpt-6.1-sol', 'GPT-6.1 Sol', 'Balanced'], ['gpt-6.1-terra', 'GPT-6.1 Terra', 'Fast, natural writing'], ['gpt-6-luna', 'GPT-6 Luna', 'Fastest']]],
    ['perplexity', 'Through Perplexity', [['gemini-4-carbon', 'Gemini 4 Carbon', 'Google, through your Perplexity key'], ['grok-4.7', 'Grok 4.7', 'xAI, through your Perplexity key']]],
  ];
  const MODEL = Object.fromEntries(MODELS.flatMap(([p, , ms]) => ms.map(([id, name, note]) => [id, { p, name, note }])));
  const MKEY = 'fos-chat-model';
  VS.chModel = VS.chModel || (() => { try { return localStorage.getItem(MKEY) || 'auto'; } catch (e) { return 'auto'; } })();
  if (VS.chModel !== 'auto' && !MODEL[VS.chModel]) VS.chModel = 'auto';
  const RKEY = 'fos-chat-room';
  if (VS.chRoom == null) VS.chRoom = (() => { try { return localStorage.getItem(RKEY) === '1'; } catch (e) { return false; } })();
  const CKEY = 'fos-chat-coach';
  if (VS.chCoach == null) VS.chCoach = (() => { try { return localStorage.getItem(CKEY) === '1'; } catch (e) { return false; } })();
  if (VS.chCoach && VS.chRoom) VS.chRoom = false;
  const FKEY = 'fos-chat-funnel';
  if (VS.chFunnel == null) VS.chFunnel = (() => { try { return localStorage.getItem(FKEY) === '1'; } catch (e) { return false; } })();
  if (VS.chFunnel) { VS.chRoom = false; VS.chCoach = false; }
  // One mode at a time: plain chat, the AI Coach, CMO Room or Funnel Agent.
  // The coach's name comes from COACH_NAME in Vercel ("Avery Cole" shows as Avery AI). Without it: AI Coach.
  const CG = () => window.CoachGuard || {};
  const coachLabel = () => (CG().coachLabel ? CG().coachLabel() : 'AI Coach');
  const coachFirst = () => (CG().coachName ? CG().coachName.split(' ')[0] : 'the coach');
  const coachOwn = () => (CG().coachName ? CG().coachName.split(' ')[0] + '\u2019s' : 'the coach\u2019s');
  function setMode(m) {
    VS.chCoach = m === 'coach'; VS.chRoom = m === 'room'; VS.chFunnel = m === 'funnel';
    try { localStorage.setItem(CKEY, VS.chCoach ? '1' : '0'); localStorage.setItem(RKEY, VS.chRoom ? '1' : '0'); localStorage.setItem(FKEY, VS.chFunnel ? '1' : '0'); } catch (e) { /* private mode */ }
  }
  const COACH_SUGGEST = [
    'How do I write a headline for my low ticket offer?',
    'Walk me through the 17Ps of funnel sections',
    'How do I close clients in DMs without sales calls?',
    'What should my offer stack include?',
  ];
  const ROOM_SUGGEST = [
    'Should my next YouTube series be about AI agents or funnels?',
    'What is the strongest launch angle for my low ticket offer?',
    'Which content pillar should I double down on this quarter?',
    'How should I price my next digital product?',
  ];
  const SEAT = { strategist: { name: 'Strategist', model: 'Claude', note: 'Brand, positioning, the long game' }, challenger: { name: 'Challenger', model: 'GPT', note: 'Angles, numbers, what works now' } };
  const FORMAT_NAME = { long: 'Long video', short: 'Short', carousel: 'Carousel', post: 'Post', email: 'Email', live: 'Live' };
  const S = { loaded: false, loading: false, counts: null, threads: [], model: null, zoom: false, msgs: {}, busy: false, ingest: null, ingested: false, err: null };
  const workspaceKey = () => [isLive() ? 'live' : 'demo', wsId() || 'local', ctx().userId || 'local'].join(':');
  function ensureWorkspace() {
    const key = workspaceKey(); if (!S.key) S.key = key;
    if (S.key !== key) {
      S.controller?.abort(); clearInterval(S.stageT);
      Object.assign(S, { key, loaded: false, loading: false, counts: null, threads: [], model: null, providers: {}, zoom: false, msgs: {}, draftMsgs: null, busy: false, ingest: null, ingested: false, err: null, controller: null });
      Object.assign(VS, { chThread: null, chDraft: '', chProgramId: null, chProgramUpdate: false, chMaterials: [] });
    }
    return key;
  }

  async function api(action, body = {}, signal) {
    const workspace = wsId();
    const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, workspace_id: workspace, ...body }), signal });
    let j = {}; try { j = await r.json(); } catch (e) { if (signal?.aborted) throw e; j = {}; }
    if (!r.ok) throw new Error(j.error || 'That did not work. Try again.');
    return j;
  }
  // Same request, but the server reports each step as it happens (one JSON object per line).
  async function apiStream(action, body, signal, onEvent) {
    const workspace = wsId();
    const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, workspace_id: workspace, stream: true, ...body }), signal });
    if (!/ndjson/.test(r.headers.get('content-type') || '') || !r.body) {
      let j = {}; try { j = await r.json(); } catch (e) { if (signal?.aborted) throw e; j = {}; }
      if (!r.ok) throw new Error(j.error || 'That did not work. Try again.');
      return j;
    }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', result = null;
    const line = (t) => { t = t.trim(); if (!t) return; let e; try { e = JSON.parse(t); } catch { return; }
      if (e.type === 'done') result = e.result; else if (e.type === 'error') throw new Error(e.error || 'That did not work. Try again.'); else if (e.type !== 'ping' && e.type !== 'start') onEvent(e); };
    for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const t = buf.slice(0, i); buf = buf.slice(i + 1); line(t); } }
    line(buf);
    if (!result) throw new Error('The connection closed before the answer arrived. Try again.');
    return result;
  }

  /* ---------- the live workflow: what AI Chat is doing while you wait ---------- */
  const FLOW = [['understand', 'Understanding your request'], ['context', 'Reading your context'], ['work', 'Working on it'], ['review', 'Checking against your facts and brand'], ['write', 'Writing the reply']];
  const FLOW_AT = Object.fromEntries(FLOW.map(([id], i) => [id, i]));
  const newFlow = () => ({ stage: 'understand', at: 0, skills: [], items: {}, step: 0, reached: { understand: true }, started: Date.now() });
  const flowTime = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function flowState(f, id) { const i = FLOW_AT[id]; if (i === f.at) return 'on'; if (i > f.at) return 'wait'; return f.reached[id] ? 'done' : 'skip'; }
  function flowSub(f, id) {
    if (id === 'understand') return f.skills.length ? 'Skills: ' + f.skills.map((x) => x.name).join(', ') : '';
    if (id === 'work' && f.at === FLOW_AT.work && f.step > 1) return 'Thinking, step ' + f.step;
    if (id === 'review' && flowState(f, id) === 'skip') return 'Not needed for this one';
    return '';
  }
  function flowItems(f, id) { const all = f.items[id] || []; return all.slice(-6); }
  function flowNode(f, id, label) {
    const st = flowState(f, id), list = flowItems(f, id), more = (f.items[id] || []).length - list.length;
    return `<li class="chf-n is-${st}" data-n="${id}"><span class="chf-dot" aria-hidden="true"></span><div class="chf-c"><p class="chf-t">${esc(label)}</p>`
      + `<p class="chf-sub meta">${esc(flowSub(f, id))}</p>`
      + `<ul class="chf-items" data-count="${list.length}">${more > 0 ? `<li class="chf-more meta">${more} earlier</li>` : ''}${list.map((x) => `<li class="${x.ok === false ? 'is-no' : ''}">${esc(x.label)}</li>`).join('')}</ul></div></li>`;
  }
  function flowView(m) {
    const f = m.flow;
    return `<div class="ch-msg ai"><div class="ch-avatar" aria-hidden="true">${icon('jarvis')}</div><div class="ch-body"><div class="chf" id="chflow">
      <div class="chf-head"><span class="chf-title">${m.by ? 'Working with ' + esc(m.by) : 'Working on it'}</span><span class="chf-time meta" aria-hidden="true">${flowTime(Date.now() - f.started)}</span></div>
      <p class="sr-only" role="status" aria-live="polite">${esc(FLOW[f.at][1])}</p>
      <ol class="chf-list">${FLOW.map(([id, label]) => flowNode(f, id, label)).join('')}</ol>
      <p class="chf-note meta">Good answers can take several minutes. It reads your facts, brand and data first, works with the skills this needs, then checks the draft before you see it.</p></div></div></div>`;
  }
  // Patch the open workflow in place so nothing restarts or jumps while events arrive.
  function patchFlow(f) {
    const root = document.getElementById('chflow'); if (!root) return;
    const sr = root.querySelector('[role=status]'); if (sr && sr.textContent !== FLOW[f.at][1]) sr.textContent = FLOW[f.at][1];
    for (const [id] of FLOW) {
      const li = root.querySelector(`.chf-n[data-n="${id}"]`); if (!li) continue;
      const cls = 'chf-n is-' + flowState(f, id); if (li.className !== cls) li.className = cls;
      const sub = li.querySelector('.chf-sub'), txt = flowSub(f, id); if (sub.textContent !== txt) sub.textContent = txt;
      const ul = li.querySelector('.chf-items'), all = f.items[id] || [], shown = +(ul.dataset.total || ul.dataset.count || 0);
      if (all.length === shown) continue;
      for (const x of all.slice(shown)) { const el = document.createElement('li'); el.className = 'chf-in' + (x.ok === false ? ' is-no' : ''); el.textContent = x.label; ul.appendChild(el); }
      ul.dataset.total = all.length;
      const rows = [...ul.querySelectorAll('li:not(.chf-more)')]; const extra = rows.length - 6;
      if (extra > 0) { rows.slice(0, extra).forEach((r) => r.remove()); let mo = ul.querySelector('.chf-more'); if (!mo) { mo = document.createElement('li'); mo.className = 'chf-more meta'; ul.prepend(mo); } mo.textContent = (all.length - 6) + ' earlier'; }
    }
    scrollEnd();
  }
  function onFlow(m, e) {
    const f = m.flow; if (!f) return;
    const go = (id) => { if (FLOW_AT[id] === undefined || FLOW_AT[id] < f.at) return; f.at = FLOW_AT[id]; f.stage = id; f.reached[id] = true; };
    if (e.type === 'stage') go(e.id);
    else if (e.type === 'skills') { f.skills = e.skills || []; go('context'); }
    else if (e.type === 'action' && e.label) { const id = FLOW_AT[e.stage] !== undefined ? e.stage : f.stage; go(id); const arr = f.items[id] = f.items[id] || []; if (arr.length < 60) arr.push({ label: e.label, ok: e.ok }); }
    else if (e.type === 'think') f.step = e.step || 0;
    patchFlow(f);
  }
  // The sample workspace walks through the same steps with sample data.
  async function demoFlow(m, q, signal) {
    const sk = [/research|find|look up|compare|competitor|creator/i.test(q) && { id: 'research', name: 'Research' }, /write|copy|email|headline|post|caption|hook/i.test(q) && { id: 'copy', name: 'Copywriting' }, { id: 'strategy', name: 'Strategy' }].filter(Boolean).slice(0, 3);
    const steps = [[500, { type: 'skills', skills: sk }], [350, { type: 'action', stage: 'context', label: 'Read your approved facts' }], [300, { type: 'action', stage: 'context', label: 'Read Brand DNA' }], [300, { type: 'action', stage: 'context', label: 'Searched your memory' }], [300, { type: 'action', stage: 'context', label: 'Read your offers and funnels' }],
      [500, { type: 'stage', id: 'work' }], [600, { type: 'action', stage: 'work', label: 'Searched your OS' }], [700, { type: 'think', step: 2 }], [600, { type: 'stage', id: 'review' }], [900, { type: 'stage', id: 'write' }], [300, null]];
    for (const [ms, e] of steps) { await demoWait(ms, signal); if (e) onFlow(m, e); }
  }

  const rerender = () => {
    if (VS.view !== 'chat') return;
    const log = document.querySelector('.ch-log'); const top = log?.scrollTop || 0;
    const open = [...document.querySelectorAll('#chlog details[open]')].map((d) => [...document.querySelectorAll('#chlog details')].indexOf(d));
    window.App.render(true);
    const next = document.querySelector('.ch-log'); if (next) next.scrollTop = top;
    const details = document.querySelectorAll('#chlog details'); open.forEach((i) => { if (details[i]) details[i].open = true; });
  };

  async function load(force) {
    const key = ensureWorkspace();
    if (S.loading || (S.loaded && !force)) return; S.loading = true;
    try { const r = await api('sources'); if (key !== workspaceKey()) return; Object.assign(S, { counts: r.counts, threads: r.threads || [], model: r.model, providers: r.providers || {}, defaults: r.defaults || {}, zoom: r.zoom, loaded: true, err: null }); }
    catch (e) { if (key !== workspaceKey()) return; S.err = e.message; S.loaded = true; }
    S.loading = false; rerender();
    if (S.zoom && !S.ingested) { S.ingested = true; readCalls([0], true); }
    if (VS.chThread && !S.msgs[VS.chThread]) openThread(VS.chThread);
  }
  async function readCalls(months, quiet) {
    if (S.ingest) return; S.ingest = { months }; rerender();
    try {
      const r = await api('ingest', { months, max: 10 });
      S.ingest = null; await load(true);
      if (!quiet) U.toast(r.added ? `${r.added} recording${r.added === 1 ? '' : 's'} read${r.pending ? ', ' + r.pending + ' more next time' : ''}` : 'No new recordings in that range');
      if (r.pending && quiet) readCalls(months, true);
    } catch (e) { S.ingest = null; rerender(); if (!quiet) U.toast(e.message); }
  }
  async function openThread(id) {
    const key = ensureWorkspace();
    VS.chThread = id; rerender();
    if (!isLive() || S.msgs[id]) return;
    try { const r = await api('thread', { thread_id: id }); if (key !== workspaceKey()) return; S.msgs[id] = (r.messages || []).map((m) => (m.team ? { ...m, actions: m.team.actions || [], connection: m.team.connection || null, handoff: m.team.handoff || null, flow: m.team.flow || null, graphic: m.team.graphic || null, images: m.team.images || null, web: m.team.web || null } : m)); } catch (e) { if (key !== workspaceKey()) return; U.toast(e.message); S.msgs[id] = []; }
    rerender(); scrollEnd();
  }

  /* ---------- demo: a small local library so the page can be toured ---------- */
  const DEMO_CALLS = [
    { id: 'dr1', title: 'Live Coaching Call · 6 Nov 2026', minutes: 58, at: '2026-11-06T16:00:00Z', lines: [
      [65, 'Avery Cole: Today we build a low ticket funnel live. Front end at 27, one order bump at 17, then the upsell into the membership.'],
      [402, 'Avery Cole: The question I get the most is how do I get my first client. Build the thing first, record a two minute walkthrough, send it. Nobody can say no to something already built for them.'],
      [911, 'Student, Mia: Should I use Claude or ChatGPT for the sales page copy?'],
      [930, 'Avery Cole: Claude for long copy, every time. I give it my brand DNA, the offer and three proven hooks, and ask for the 17P outline first.'],
      [1720, 'Avery Cole: Pricing. The AI Starter Bundle sits at 497. If someone is not ready, the 27 dollar starter kit is the door.'],
      [2610, 'Avery Cole: Homework this week: one remix of a proven video, filmed, and the funnel published in HighLevel.'] ] },
    { id: 'dr2', title: 'Live Coaching Call · 3 Nov 2026', minutes: 47, at: '2026-11-03T16:00:00Z', lines: [
      [120, 'Avery Cole: We look at outliers today. A video that does three times your median is a pattern you can borrow.'],
      [744, 'Student, Jon: How many videos a week do I need?'],
      [760, 'Avery Cole: Two long videos and daily shorts cut from them. Consistency beats volume.'],
      [1505, 'Avery Cole: Claude Code with a CLAUDE.md file is how I keep every build on brand. Same rules every time.'],
      [2240, 'Avery Cole: HighLevel has a 14 day trial. That is the link I send when someone asks what to host on.'] ] },
    { id: 'dr3', title: 'Client call, Northwind Physio · 30 Oct 2026', minutes: 31, at: '2026-10-30T10:00:00Z', lines: [
      [90, 'Clinic owner: We want more bookings without hiring another receptionist.'],
      [610, 'Avery Cole: I will build the booking dashboard first and show it to you on Friday. 197 a month after that.'],
      [1400, 'Avery Cole: I promised a proposal by Monday with the three page funnel and the reminder sequence.'] ] },
  ];
  const STOP = new Set('say said says tell talk talked mention mentioned a an and are as at be but by can could did do does for from had has have how i if in into is it its me my of on or our so that the their them then there these they this to was we were what when where which who why will with would you your about tell give show find any all just more most some than too very also should need want like know get got make made over out up down one two last latest recent today yesterday week month call calls'.split(' '));
  const terms = (s) => [...new Set(String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
  const stem = (t) => (t.length > 5 ? t.slice(0, t.length - 2) : t);
  const mmss = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  function demoCorpus() {
    const d = window.DNA.data(); const out = [];
    DEMO_CALLS.forEach((c) => c.lines.forEach(([s, body], i) => out.push({ kind: 'recording', title: c.title, body, at: c.at, t: mmss(s), ref: c.id + '#' + i, url: null })));
    (d.items || []).filter((x) => x.included).forEach((x) => out.push({ kind: x.kind, title: x.name, body: [x.price != null ? x.price + ' ' + (x.currency || '') : '', x.price_note, x.summary].filter(Boolean).join(' · ') || x.name, at: x.ext_updated_at, ref: x.id }));
    (d.proven || []).slice(0, 30).forEach((p, i) => out.push({ kind: 'post', title: p.author + ' on ' + (p.platform === 'youtube' ? 'YouTube' : 'Instagram'), body: p.title + ' · ' + (p.outlier || '?') + 'x their median', at: p.posted_at, ref: 'p' + i, url: p.url }));
    ((window.Store.s.brain && window.Store.s.brain.facts) || []).filter((f) => f.status === 'approved').forEach((f, i) => out.push({ kind: 'fact', title: f.category || 'Fact', body: f.statement, ref: 'f' + i }));
    return out;
  }
  const DEMO_SCOPE = { all: null, recordings: ['recording'], brain: ['doc', 'fact'], offers: ['offer', 'funnel'], content: ['post', 'research', 'draft'], memory: ['memory', 'draft'] };
  function demoAsk(q, scope) {
    const ks = DEMO_SCOPE[scope]; const ts = terms(q).map(stem);
    const recap = /\b(summar|recap|overview|last|latest)\b/i.test(q) && /\b(call|recording|coaching|meeting)/i.test(q) && (!ks || ks.includes('recording'));
    if (recap) {
      const c = DEMO_CALLS[0];
      return { answer: `**${c.title}**, ${c.minutes} minutes.\n\nHow the call moved:\n${c.lines.map(([s, b]) => `- At ${mmss(s)}: ${b.replace(/^[^:]{2,40}:\s+/, '')}`).join('\n')}\n\nAsk about a topic from the call and I will find the exact moment.`, sources: [{ n: 0, kind: 'recording', label: 'Recording', title: c.title, snippet: 'Full transcript, ' + c.minutes + ' minutes', at: c.at, full: true, ref: c.id + '#0' }], model: 'sources' };
    }
    const hits = demoCorpus().filter((x) => !ks || ks.includes(x.kind)).map((x) => { const hay = (x.title + ' ' + x.body).toLowerCase(); const n = ts.filter((t) => hay.includes(t)).length; return { ...x, score: n / Math.max(ts.length, 1) + (x.kind === 'recording' ? 0.05 : 0) }; })
      .filter((x) => x.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 6);
    const mark = (s) => { let o = esc(s); ts.forEach((t) => { o = o.replace(new RegExp('\\b(' + t.replace(/[^a-z0-9]/g, '') + '\\w*)', 'gi'), '<<$1>>'); }); return o.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); };
    const sources = hits.map((h, i) => ({ n: i + 1, kind: h.kind, label: h.kind, title: h.title, snippet: mark(h.body), at: h.at, t: h.t || null, url: h.url || null, ref: h.ref }));
    if (!sources.length) return { answer: 'Nothing in the sample recordings, offers, funnels, creators or facts mentions that. Try other words, or switch the scope to All.', sources: [], model: 'sources' };
    return { answer: 'Here is what your sources say about that:\n' + sources.map((s) => `- **${s.title}**${s.t ? ' at ' + s.t : ''}: ${s.snippet.replace(/<<|>>/g, '**')} [${s.n}]`).join('\n'), sources, model: 'sources' };
  }

  /* ---------- rendering ---------- */
  function md(text, sources) {
    const nums = new Set((sources || []).map((s) => String(s.n)));
    const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[(\d{1,2}|R)\]/g, (m, n) => { const k = n === 'R' ? '0' : n; return nums.has(k) ? `<button class="ch-cite" data-action="ch-src" data-n="${k}" aria-label="Open source ${n}">${n === 'R' ? 'T' : n}</button>` : ''; });
    return String(text || '').split(/\n{2,}/).map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l) || !l.trim())) return `<ul>${lines.filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      if (lines.some((l) => /^\s*[-*]\s+/.test(l))) { const head = lines.filter((l) => !/^\s*[-*]\s+/.test(l)); const items = lines.filter((l) => /^\s*[-*]\s+/.test(l)); return `${head.length ? `<p>${head.map(inline).join('<br>')}</p>` : ''}<ul>${items.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`; }
      if (/^#{1,3}\s/.test(block)) return `<h3>${inline(block.replace(/^#{1,3}\s/, ''))}</h3>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('');
  }
  const snip = (s) => esc(String(s || '')).replace(/&lt;&lt;/g, '<mark>').replace(/&gt;&gt;/g, '</mark>');
  const when = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const KNAME = { recording: 'Recording', doc: 'Brain', fact: 'Fact', offer: 'Offer', funnel: 'Funnel', post: 'Creator post', research: 'Research', draft: 'Draft', memory: 'Memory', channel: 'Channel' };
  function srcCards(m, mi) {
    const ss = (m.sources || []); if (!ss.length) return '';
    return `<details class="ch-sources"><summary>${icon('data')}<span>${ss.length} ${ss.length === 1 ? 'source' : 'sources'}</span>${icon('chevron')}</summary><div class="ch-srcs" aria-label="Sources">${ss.slice(0, 8).map((s) => `<button class="ch-card" data-action="ch-src" data-n="${s.n}" data-m="${mi}">
      <span class="ch-ck">${icon(KIND_ICON[s.kind] || 'data')}<span>${esc(KNAME[s.kind] || s.label || s.kind)}${s.t ? ' · ' + esc(s.t) : ''}</span><i>${s.full ? 'T' : s.n}</i></span>
      <b>${esc(s.title || '')}</b><span class="meta">${when(s.at)}</span></button>`).join('')}</div></details>`;
  }
  function seatCard(x, m, solo) {
    const s = SEAT[x.id] || { name: x.name };
    return `<article class="rm-seat rm-${esc(x.id)}"><header><span class="rm-badge" aria-hidden="true">${esc(s.name[0])}</span><div class="grow"><b>${esc(x.name)}</b><span class="meta">${esc(x.by || s.model)}</span></div>${solo ? '<span class="meta">Answering you</span>' : ''}</header>
      <div class="ch-text">${md(x.take, m.sources)}</div>
      ${x.push ? `<details class="rm-push"><summary>${icon('chevron')}<span>Pushback on the ${x.id === 'strategist' ? 'Challenger' : 'Strategist'}</span></summary><div class="ch-text">${md(x.push, m.sources)}</div></details>` : ''}</article>`;
  }
  function verdictCard(v, mi) {
    const sent = v.sent || {};
    return `<section class="rm-verdict" aria-label="Verdict">
      <p class="rm-call">${esc(v.call)}</p>${v.by ? `<p class="meta rm-chair">Chaired by ${esc(v.by)}</p>` : ''}${v.why ? `<p class="rm-why">${esc(v.why)}</p>` : ''}
      <div class="rm-grid">
        ${v.agree && v.agree.length ? `<div><p class="rm-h">Both agree</p><ul>${v.agree.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${v.split ? `<div><p class="rm-h">Still split</p><p>${esc(v.split)}</p></div>` : ''}
        ${v.proof ? `<div><p class="rm-h">What would prove it wrong</p><p>${esc(v.proof)}</p></div>` : ''}
      </div>
      ${v.next && v.next.length ? `<div><p class="rm-h">Next steps</p><ol class="rm-next">${v.next.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
      ${v.ideas && v.ideas.length ? `<div class="rm-ideas"><p class="rm-h">Content out of this</p>${v.ideas.map((x, i) => `<div class="rm-idea"><span class="tag">${esc(FORMAT_NAME[x.format] || 'Long video')}</span><span class="grow">${esc(x.title)}</span>${sent[i] ? `<span class="meta rm-sent">${icon('check')}On the board</span>` : `<button class="btn sm" data-action="rm-idea" data-m="${mi}" data-i="${i}">${icon('plus')}<span>Content board</span></button>`}</div>`).join('')}</div>` : ''}
    </section>`;
  }
  function roomMessage(m, mi) {
    const r = m.room; const last = mi === msgs().length - 1; const pair = (r.seats || []).length === 2;
    return `<div class="ch-msg ai room"><div class="ch-avatar" aria-hidden="true">${icon('room')}</div><div class="ch-body rm-body">
      <p class="rm-label meta">${r.mode === 'seat' ? 'CMO Room, one seat' : r.mode === 'round' ? 'CMO Room, another round' : r.mode === 'decide' ? 'CMO Room, the verdict' : 'CMO Room'}${r.single ? ' · one AI in both seats' : ''}</p>
      <div class="rm-seats ${pair ? '' : 'solo'}">${(r.seats || []).map((x) => seatCard(x, m, !pair)).join('')}</div>
      ${r.verdict ? verdictCard(r.verdict, mi) : ''}
      ${srcCards(m, mi)}
      ${m.notice ? `<p class="meta ch-notice">${icon('alert')}<span>${esc(m.notice)}</span></p>` : ''}
      <div class="ch-foot">${last && !S.busy ? `<button class="btn sm ghost" data-action="rm-go" data-q="Another round">${icon('room')}<span>Another round</span></button>${pair && !r.verdict ? `<button class="btn sm ghost" data-action="rm-go" data-q="Decide">${icon('check')}<span>Decide</span></button>` : ''}` : ''}
        <span class="grow"></span><button class="linkish meta" data-action="ch-copy" data-m="${mi}">Copy</button>${last ? '<button class="linkish meta" data-action="ch-save" data-m="' + mi + '">Save to Memory</button>' : ''}</div></div></div>`;
  }
  function message(m, mi) {
    if (m.grok) return window.Grok ? window.Grok.chatCard(m, mi) : '';
    if (m.error) return `<div class="ch-msg ch-error${m.stopped ? ' stopped' : ''}" role="${m.stopped ? 'status' : 'alert'}"><div class="ch-avatar" aria-hidden="true">${icon(m.stopped ? 'stop' : 'alert')}</div><div class="ch-body"><p>${esc(m.body)}</p><button class="btn sm ghost" data-action="ch-retry" data-m="${mi}">${icon('refresh')}Retry</button></div></div>`;
    if (m.role !== 'user' && m.room && !m.pending) return roomMessage(m, mi) + (VS.chScope === 'programs' && mi === msgs().length - 1 ? '<div class="ch-program-next"><button class="btn sm ghost" data-action="ch-program-plan">Prepare a program proposal</button></div>' : '');
    if (m.role !== 'user' && !m.pending && m.model === 'coach-ai') return coachMessage(m, mi);
    if (m.pending && m.coach) return `<div class="ch-msg ai coach"><div class="ch-avatar co-avatar" aria-hidden="true">${icon('coach')}</div><div class="ch-body"><p class="ch-think">${U.spin}<span>${esc(coachLabel())} is thinking it through</span></p></div></div>`;
    if (m.role === 'user') return `<div class="ch-msg user"><div class="ch-bubble">${esc(m.body).replace(/\n/g, '<br>')}${window.ChatAttach ? window.ChatAttach.sent(m.files || (m.sources || []).filter((x) => x && x.kind === 'file')) : ''}</div></div>`;
    if (m.pending && m.room) return `<div class="ch-msg ai room"><div class="ch-avatar" aria-hidden="true">${icon('room')}</div><div class="ch-body"><p class="ch-think rm-think">${U.spin}<span>${esc(ROOM_STAGE[Math.min(S.stage || 0, ROOM_STAGE.length - 1)](m.room))}</span></p></div></div>`;
    if (m.pending && m.flow) return flowView(m);
    if (m.pending) return `<div class="ch-msg ai"><div class="ch-avatar" aria-hidden="true">${icon('jarvis')}</div><div class="ch-body"><p class="ch-think">${U.spin}<span>${m.by ? 'Working on it with ' + esc(m.by) : 'Reading ' + esc(m.pending)}</span></p></div></div>`;
    const by = m.model && m.model !== 'sources' ? m.model : null;
    return `<div class="ch-msg ai"><div class="ch-avatar" aria-hidden="true">${icon('jarvis')}</div><div class="ch-body">
      <div class="ch-text">${md(m.body, m.sources)}</div>${srcCards(m, mi)}${usedTools(m, mi)}${handoffCard(m, mi)}${gfxCard(m)}${imageStrip(m)}${webLinks(m)}${m.connection ? `<div class="tx-confirm tx-connreq"><p><b>Run ${esc(m.connection.title || m.connection.tool)} on ${esc(m.connection.name)}?</b> ${m.connection.why ? esc(m.connection.why) + ' ' : ''}You check the exact inputs before it runs once.</p><div class="tx-act"><button class="btn sm" data-action="ch-conn" data-m="${mi}">${icon('external')}Review and run</button></div></div>` : ''}${programProposal(m.program_proposal)}${m.agent_proposal?`<section class="ch-program-proposal"><h3>${esc(m.agent_proposal.title||'Agent proposal')}</h3><p>Review the role, task instructions and schedules before creating this agent.</p><button class="btn sm" data-action="ag-review" data-id="${esc(m.agent_proposal.id)}">Review agent proposal</button></section>`:''}
      ${m.notice ? `<p class="meta ch-notice">${icon('alert')}<span>${esc(m.notice)}</span></p>` : ''}
      <div class="ch-foot"><span class="meta">${by ? ((m.actions || []).length ? 'Done by ' + esc(by) : 'Written by ' + esc(by) + ' from your sources') : 'Quoted from your sources'}</span><button class="linkish meta" data-action="ch-copy" data-m="${mi}">Copy</button>${mi === msgs().length - 1 ? '<button class="linkish meta" data-action="ch-save" data-m="' + mi + '">Save to Memory</button>' : ''}${mi === msgs().length - 1 && !S.busy && window.Grok ? '<button class="linkish meta" data-action="grok-from" data-m="' + mi + '">Hand to Grok</button>' : ''}</div></div></div>`;
  }
  // What AI Chat used for this reply, with Undo next to anything it changed.
  function flowNote(m) {
    const f = m.flow; if (!f || (!f.skills?.length && !f.context?.length && !f.reviewed)) return '';
    const bits = [];
    if (f.context?.length) bits.push('Read ' + f.context.length + ' context ' + (f.context.length === 1 ? 'layer' : 'layers'));
    if (f.skills?.length) bits.push('Skills: ' + f.skills.join(', '));
    if (f.reviewed) bits.push('Checked before sending');
    return `<p class="chf-done meta" title="${esc((f.context || []).join(', '))}">${icon('check')}<span>${esc(bits.join(' · '))}</span></p>`;
  }
  function usedTools(m, mi) {
    const acts = (m.actions || []).filter((x) => x && x.label); if (!acts.length) return flowNote(m);
    const seen = new Set(); const items = [];
    for (const x of acts) { const k = x.label + (x.change_id || ''); if (seen.has(k)) continue; seen.add(k);
      items.push(`<li class="${x.ok === false ? 'is-no' : ''}">${esc(x.label)}${x.ok === false ? ' <span class="meta">(not done)</span>' : ''}${x.change_id ? (x.undone ? ' <span class="meta">Undone</span>' : ` <button class="tx-undo" data-action="ch-undo" data-m="${mi}" data-id="${esc(x.change_id)}">Undo</button>`) : ''}</li>`); }
    return flowNote(m) + `<details class="tx-used"${acts.some((x) => x.undone) ? ' open' : ''}><summary>${icon('bolt')}<span>Used ${items.length} ${items.length === 1 ? 'tool' : 'tools'}</span></summary><ul>${items.join('')}</ul></details>`;
  }
  const STUDIO_NAME = { graphics: 'Graphics', emails: 'Emails', video: 'Video', funnel: 'Funnel Agent' };
  // Images made in the chat: the set is saved under Graphics; the card shows it as it renders.
  const GX = { sets: {}, kit: null, kitFor: null, timer: null, tick: {} };
  const gxSrc = (set, name) => { if (!name) return ''; if (/^(assets\/|data:|https:)/.test(name)) return name; const k = (GX.kit && GX.kit.kit) || {}; return k.asset_key ? `/g/${set.workspace_id}/${k.asset_key}/${name}` : ''; };
  const gxBusy = (s) => s && (s.status === 'running' || s.status === 'queued');
  async function gxPull(id) {
    if (!isLive() || !window.Auth || !window.Auth.gfx) return;
    try {
      const s = await window.Auth.gfx.get(id); GX.sets[id] = s;
      if (GX.kitFor !== s.workspace_id) { GX.kitFor = s.workspace_id; GX.kit = await window.Auth.gfx.kit(s.workspace_id).catch(() => null); }
      if (gxBusy(s) && (!GX.tick[id] || Date.now() - GX.tick[id] > 25e3)) { GX.tick[id] = Date.now(); window.Auth.gfx.api('gfx_tick', { id }).catch(() => {}); }
    } catch (e) { GX.sets[id] = { failed: true }; }
    rerender();
  }
  function gxWatch() {
    if (GX.timer) return;
    GX.timer = setInterval(() => {
      const live = Object.keys(GX.sets).filter((id) => gxBusy(GX.sets[id]));
      if (!live.length || !document.querySelector('.ch-gfx')) { clearInterval(GX.timer); GX.timer = null; return; }
      live.forEach(gxPull);
    }, 5000);
  }
  function gfxCard(m) {
    const g = m.graphic; if (!g || !g.id) return '';
    const s = GX.sets[g.id];
    if (s === undefined && isLive()) { GX.sets[g.id] = null; gxPull(g.id).then(gxWatch); }
    if (s && s.failed) return `<div class="tx-confirm ch-gfx"><p><b>The images could not be loaded here.</b> They are saved under Graphics.</p><div class="tx-act"><a class="btn sm" href="#graphics">${icon('arrow')}Open Graphics</a></div></div>`;
    const slides = (s && s.slides) || []; const done = slides.filter((x) => x.asset || x.src).length;
    const state = !s ? 'Starting' : s.status === 'failed' || s.error ? 'Stopped' : gxBusy(s) ? (s.step === 'plan' || !slides.length ? 'Planning the design' : `Rendering ${done} of ${slides.length}`) : 'Ready';
    const tiles = slides.length ? slides.map((x, i) => { const u = gxSrc(s, x.src || x.asset); return u ? `<a class="ch-gfx-tile" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Image ${i + 1}" loading="lazy"></a>` : `<span class="ch-gfx-tile ch-gfx-wait">${U.spin}</span>`; }).join('') : `<span class="ch-gfx-tile ch-gfx-wait">${U.spin}</span>`;
    const err = s && (s.status === 'failed' || s.error) ? `<p class="meta">${esc(String(s.error || 'Rendering stopped.').slice(0, 200))} Open Graphics to retry, or check OpenRouter under <a href="#connect">Connections</a>.</p>` : '';
    return `<div class="tx-confirm ch-gfx"><p><b>${esc(g.title || 'Your graphic')}</b> <span class="meta">${esc(state)}</span></p><div class="ch-gfx-grid">${tiles}</div>${err}<div class="tx-act"><a class="btn sm" href="#graphics">${icon('arrow')}Open in Graphics</a></div></div>`;
  }
  function imageStrip(m) {
    const ims = (m.images || []).filter((x) => x && /^https:/.test(x.url)); if (!ims.length) return '';
    return `<div class="ch-imgs" aria-label="Images found on the web">${ims.slice(0, 8).map((x) => `<a href="${esc(x.page || x.url)}" target="_blank" rel="noopener" title="${esc(x.title || '')}"><img src="${esc(x.url)}" alt="${esc(x.title || 'Image from the web')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>`).join('')}</div>`;
  }
  function webLinks(m) {
    const ws = (m.web || []).filter((x) => x && /^https?:/.test(x.url)); if (!ws.length) return '';
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    return `<details class="ch-sources ch-web"><summary>${icon('data')}<span>${ws.length} web ${ws.length === 1 ? 'page' : 'pages'}</span>${icon('chevron')}</summary><ul>${ws.slice(0, 12).map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || x.url)}</a> <span class="meta">${esc(host(x.url))}</span></li>`).join('')}</ul></details>`;
  }
  function handoffCard(m, mi) {
    const h = m.handoff; if (!h || !STUDIO_NAME[h.studio]) return '';
    return `<div class="tx-confirm ch-handoff"><p><b>${esc(STUDIO_NAME[h.studio])} brief is ready.</b> It opens with the brief filled in. Nothing is made until you press generate there.</p><div class="tx-act"><button class="btn sm" data-action="ch-studio" data-m="${mi}">${icon('arrow')}Open ${esc(STUDIO_NAME[h.studio])}</button></div></div>`;
  }
  ACT['ch-undo'] = async (el) => {
    const m = msgs()[+el.dataset.m]; const x = m && (m.actions || []).find((y) => y.change_id === el.dataset.id); if (!x) return;
    el.disabled = true;
    try { if (isLive()) await api('team_undo', { change_id: x.change_id }); x.undone = true; U.toast('Change undone'); rerender(); }
    catch (e) { el.disabled = false; U.toast(e.message || 'That change could not be undone'); }
  };
  ACT['ch-studio'] = (el) => {
    const m = msgs()[+el.dataset.m]; const h = m && m.handoff; if (!h) return;
    if (h.studio === 'funnel') { setMode('funnel'); VS.chDraft = h.brief; rerender(); U.toast('Funnel agent: your brief is in the box. Send it to start.'); return; }
    VS.studioPrompt = h.brief; VS.studioFormat = h.format || null; location.hash = h.studio;
  };
  ACT['ch-conn'] = (el) => {
    const m = msgs()[+el.dataset.m]; const c = m && m.connection; if (!c) return;
    if (!isLive()) { U.toast('Demo workspace: your own MCP connections run from Connections.'); return; }
    const C = window.CustomConnections; if (C && C.operate) C.operate(c.id, 'tool', c.tool, c.arguments || {}); else { VS.cxMode = 'custom'; location.hash = '#connect'; }
  };
  const ROOM_STAGE = [
    (r) => (r === 'seat' ? 'One seat is thinking it through' : r === 'decide' ? 'The chair is weighing both sides' : 'Both seats are thinking on their own'),
    (r) => (r === 'seat' ? 'Writing the answer' : r === 'decide' ? 'Writing the verdict' : 'They are reading each other and pushing back'),
    (r) => (r === 'seat' ? 'Almost there' : 'The chair is writing the verdict'),
  ];
  const msgs = () => (VS.chThread && S.msgs[VS.chThread]) || S.draftMsgs || [];

  function rail() {
    const c = S.counts || {}; const live = isLive();
    const row = (k, label, n, go) => `<a class="ch-row" href="#${go}"><span>${icon(k)}</span><span class="grow">${label}</span><b class="tnum">${n == null ? '\u2013' : n}</b></a>`;
    const demo = !live; const d = demo ? window.DNA.data() : null;
    const counts = demo ? { recordings: DEMO_CALLS.length, docs: 4, facts: ((window.Store.s.brain && window.Store.s.brain.facts) || []).filter((f) => f.status === 'approved').length, offers: d.items.filter((x) => x.kind === 'offer' && x.included).length, funnels: d.items.filter((x) => x.kind === 'funnel' && x.included).length, posts: (d.proven || []).length, research: 6, memory: 12 } : c;
    const threads = live ? S.threads : (S.demoThreads || []);
    const calls = live ? (S.ingest ? `<p class="meta ch-note">${U.spin}Reading Zoom recordings</p>` : S.zoom ? `<button class="btn sm ghost" data-action="ch-older">Read older calls</button>` : `<button class="btn sm ghost" data-action="go" data-go="connect">Connect Zoom</button>`) : '';
    return `<aside class="ch-rail" id="chat-context" aria-label="Chat history and workspace context" ${VS.chRail ? '' : 'hidden'}>
      <section class="panel ch-panel"><header><h2>Chat history</h2><button class="btn icon ghost" data-action="ch-history" aria-label="Close history">${icon('close')}</button></header>
        ${threads.length ? `<div class="ch-threads">${threads.slice(0, 14).map((t) => `<div class="ch-th ${t.id === VS.chThread ? 'on' : ''}"><button class="grow" data-action="ch-open" data-id="${esc(t.id)}"><span>${esc(t.title)}</span><span class="meta">${when(t.updated_at)}</span></button>${live ? `<button class="ch-x" data-action="ch-del" data-id="${esc(t.id)}" aria-label="Delete chat">${icon('close')}</button>` : ''}</div>`).join('')}</div>` : '<p class="meta">Your chats are saved here.</p>'}
      </section>
      <section class="panel ch-panel"><header><h2>What it reads</h2></header>
        <div class="ch-rows">
          ${row('calls', 'Call recordings', counts.recordings, 'calls')}
          ${row('brain', 'Brain documents', counts.docs, 'brain')}
          ${row('brain', 'Approved facts', counts.facts, 'brain')}
          ${row('offers', 'Offers', counts.offers, 'dna')}
          ${row('funnels', 'Funnels', counts.funnels, 'dna')}
          ${row('creators', 'Creator posts', counts.posts, 'creators')}
          ${row('research', 'Research runs', counts.research, 'research')}
          ${row('memory', 'Memory', counts.memory, 'memory')}
        </div>
        ${live && c.latest_recording ? `<p class="meta ch-note">Newest call: ${esc(c.latest_recording.title)}</p>` : ''}
        <div class="ch-act">${calls}</div>
      </section></aside>`;
  }
  // Which model will answer: the picked one, or for Auto the default of the first connected provider.
  function activeModel() {
    if (VS.chModel !== 'auto') return VS.chModel;
    const p = S.providers || {}; const d = S.defaults || {};
    if (!isLive()) return 'claude-sonnet-5-5';
    return p.claude ? d.claude || 'claude-sonnet-5-5' : p.openai ? d.openai || 'gpt-6.1-sol' : p.perplexity ? d.claude || 'claude-sonnet-5-5' : null;
  }
  function modelPicker() {
    const live = isLive(); const p = S.providers || {};
    const off = (prov) => live && S.loaded && !p[prov] && !p.perplexity; // one Perplexity key unlocks every model
    const a = activeModel();
    const autoLabel = 'Auto' + (a && MODEL[a] ? ' · ' + MODEL[a].name : live && S.loaded ? ' · Source quotes' : '');
    return `<label class="ch-model" title="Choose the AI model that writes the answer">${icon('agents')}<select data-action="ch-model" aria-label="AI model" ${S.busy ? 'disabled' : ''}>
      <option value="auto" ${VS.chModel === 'auto' ? 'selected' : ''}>${esc(autoLabel)}</option>
      ${MODELS.map(([prov, label, ms]) => `<optgroup label="${label}${off(prov) ? ', connect a key to use' : ''}">${ms.map(([id, name, note]) => `<option value="${id}" ${VS.chModel === id ? 'selected' : ''} ${off(prov) ? 'disabled' : ''} title="${esc(note)}">${esc(name)}</option>`).join('')}</optgroup>`).join('')}
    </select></label>`;
  }
  // V2: no mode buttons. Ask for a funnel, the AI Coach, the CMO Room, a graphic, an email or a video edit, and the
  // chat switches to the right agent or opens the right tool. A small chip shows the active agent and leads back.
  const TOOL_SUGGEST = [['Make a YouTube thumbnail for my next video', ''], ['Write a welcome email for new members', ''], ['Build a funnel for my low ticket offer', ''], ['Ask the coach how to price a $27 offer', '']];
  const MODE_NAME = { get coach() { return coachLabel(); }, room: 'CMO Room', funnel: 'Funnel agent' };
  function modeChip() {
    const m = VS.chCoach ? 'coach' : VS.chRoom ? 'room' : VS.chFunnel ? 'funnel' : null; if (!m) return '';
    return `<span class="ch-mode-chip">${esc(MODE_NAME[m])}<button type="button" class="btn sm ghost" data-action="ch-mode-off" ${S.busy || window.ChatFunnel?.busy() ? 'disabled' : ''}>Back to chat</button></span>`;
  }
  function intentOf(q) {
    const t = String(q || '').toLowerCase();
    const nm = CG().coachName ? CG().coachName.split(' ')[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    if (/\b(ai coach|ask (?:the |my )?coach|coach me|what would (?:the|my) coach)\b/.test(t) || (nm && new RegExp('\\b(' + nm + ' ai|ask ' + nm + '|what would ' + nm + ')\\b').test(t))) return 'coach';
    if (/\b(cmo room|cmo|debate (this|it)|argue (this|it) out)\b/.test(t)) return 'room';
    // Requests that need research or several steps stay in the chat; AI Chat does the work and hands the studio a brief.
    if (/\b(research|find|look ?up|search|analy[sz]e|compare|study|based on|from (my|our) (data|numbers|channel)|and then|after that|also)\b/.test(t)) return null;
    const make = /\b(make|create|design|generate|build|plan|draft|write|need|do)\b/.test(t);
    if (make && /\b(funnel|landing page|sales page|opt-?in page|squeeze page|webinar page)\b/.test(t) && !/\bemails?\b/.test(t)) return 'funnel';
    if (make && /\b(thumbnails?|graphics?|carousels?|banners?|images?|visuals?|ad creatives?|cover image)\b/.test(t)) return 'graphics';
    if (make && /\b(emails?|newsletters?|email sequence|broadcast)\b/.test(t)) return 'emails';
    if (/\b(edit|cut|trim|storyboard|tighten)\b/.test(t) && /\b(video|recording|clip|tella)\b/.test(t)) return 'video';
    return null;
  }
  ACT['ch-mode-off'] = () => { if (S.busy || window.ChatFunnel?.busy()) return; setMode('chat'); rerender(); };
  function roomToggle() {
    return `<button type="button" class="ch-room-t" data-action="ch-room" aria-pressed="${VS.chRoom ? 'true' : 'false'}" ${S.busy ? 'disabled' : ''} title="Claude and GPT consider the question independently, challenge each other and give a verdict">${icon('room')}<span>CMO Room</span><i aria-hidden="true"></i></button>`;
  }
  function funnelToggle() {
    const off = S.busy || window.ChatFunnel?.busy();
    return `<button type="button" class="ch-room-t" data-action="ch-funnel" aria-pressed="${VS.chFunnel ? 'true' : 'false'}" ${off ? 'disabled' : ''} title="Plan a funnel for one of your offers, then the Funnel Agent builds it">${icon('funnel-agent')}<span>Funnel Agent</span><i aria-hidden="true"></i></button>`;
  }
  function coachToggle() {
    return `<button type="button" class="ch-room-t" data-action="ch-coach" aria-pressed="${VS.chCoach ? 'true' : 'false'}" ${S.busy ? 'disabled' : ''} title="Ask ${esc(coachLabel())}, a coach trained on ${esc(coachOwn())} frameworks, coaching calls and videos">${icon('coach')}<span>${esc(coachLabel())}</span><i aria-hidden="true"></i></button>`;
  }
  function coachSources(m) {
    const ss = m.sources || []; if (!ss.length) return '';
    return `<details class="ch-sources"><summary>${icon('coach')}<span>From ${ss.length === 1 ? '1 lesson' : ss.length + ' lessons'}</span>${icon('chevron')}</summary><ul class="co-srcs">${ss.map((s) => `<li><span class="meta">${esc(s.label || 'Library')}</span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : `<span>${esc(s.title)}</span>`}</li>`).join('')}</ul></details>`;
  }
  function coachMessage(m, mi) {
    return `<div class="ch-msg ai coach"><div class="ch-avatar co-avatar" aria-hidden="true">${icon('coach')}</div><div class="ch-body">
      <p class="rm-label meta">${esc(coachLabel())}</p><div class="ch-text">${md(m.body, [])}</div>${coachSources(m)}
      ${m.notice ? `<p class="meta ch-notice">${icon('alert')}<span>${esc(m.notice)}</span></p>` : ''}
      <div class="ch-foot"><span class="meta">AI coach trained on ${esc(coachOwn())} teaching</span><button class="linkish meta" data-action="ch-copy" data-m="${mi}">Copy</button>${mi === msgs().length - 1 ? '<button class="linkish meta" data-action="ch-save" data-m="' + mi + '">Save to Memory</button>' : ''}</div></div></div>`;
  }
  function roomSeats() {
    return `<div class="rm-seatpills" aria-label="Seats">${Object.entries(SEAT).map(([id, x]) => `<span class="rm-pill rm-${id}" title="${esc(x.note)}"><b>${esc(x.model)}</b>${esc(x.name)}</span>`).join('')}</div>`;
  }
  function programProposal(p) {
    if (!p) return '';
    return `<section class="ch-program-proposal"><h3>${esc(p.title || 'Program proposal')}</h3><p>${p.status === 'applied' ? 'Your approved program is saved and editable.' : p.status === 'dismissed' ? 'This proposal was dismissed. No changes were applied.' : p.target_id ? 'Proposed changes only. Your saved program is unchanged.' : 'Proposed outline only. No program has been created.'}</p><button class="btn sm" data-action="${p.status === 'applied' && p.result_id ? 'pg-result' : 'pg-review'}" data-id="${esc(p.status === 'applied' && p.result_id ? p.result_id : p.id)}">${p.status === 'applied' ? 'Open program' : p.status === 'dismissed' ? 'View proposal' : 'Review proposal'}</button></section>`;
  }
  function programTools() {
    if (VS.chScope !== 'programs' || !window.OSPrograms) return '';
    window.OSPrograms.load();
    const rows = window.OSPrograms.list().filter(p => !p.archived);
    const state = window.OSPrograms.state();
    if (state.loaded && !state.loading && !state.err && VS.chProgramId && !rows.some(p => p.id === VS.chProgramId)) {
      VS.chProgramId = null; VS.chProgramUpdate = false;
    }
    return `<div class="ch-program-tools"><label>Program<select data-action="ch-program-context" aria-label="Program context" ${S.busy ? 'disabled' : ''}><option value="">New program</option>${rows.map(p => `<option value="${p.id}" ${VS.chProgramId === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
      ${VS.chProgramId ? `<label><input type="checkbox" data-action="ch-program-update" ${VS.chProgramUpdate ? 'checked' : ''} ${S.busy ? 'disabled' : ''}>Propose changes</label>` : ''}
      <button class="btn sm ghost" type="button" data-action="ch-program-materials" ${S.busy ? 'disabled' : ''}>${icon('file')}Materials${VS.chMaterials?.length ? ' (' + VS.chMaterials.length + ')' : ''}</button>
      <p>${VS.chProgramId && !VS.chProgramUpdate ? 'Reference only. AI cannot change this program.' : 'AI drafts a proposal. You review and confirm before anything is built or changed.'}</p></div>`;
  }
  function coachNote() {
    const st = S.coach || {}; const n = st.stats; const live = isLive();
    const size = n && (n.docs || n.calls || n.videos) ? `Trained on ${[n.docs ? n.docs + ' frameworks' : '', n.calls ? n.calls + ' coaching calls' : '', n.videos ? n.videos + ' videos' : ''].filter(Boolean).join(', ')}.` : live && st.loaded ? 'The Coach library is being prepared.' : '';
    const key = live && S.loaded && !S.model ? ` <button class="linkish" data-action="go" data-go="connect">Connect Claude, OpenAI or Perplexity</button> to ask.` : '';
    return `<p class="meta ch-mode">${size ? esc(size) + ' ' : ''}It coaches you and keeps ${esc(coachOwn())} private life and numbers private.${key}${st.admin ? ` <button class="linkish" type="button" data-action="co-lib">Coach library</button> <a class="linkish" href="#playbook">Playbook</a>` : ''}</p>`;
  }
  // Files go with plain chat and the CMO Room. Programs has its own Materials, and the AI Coach answers from its library.
  const canAttach = () => !!window.ChatAttach && (VS.chCoach || (VS.chScope !== 'programs' && VS.chScope !== 'agents'));
  window.ChatAttach?.on((k) => { if (k === 'chat') rerender(); });
  function composer() {
    const live = isLive();
    const note = VS.chRoom ? (live && S.loaded && !S.model ? `<p class="meta ch-mode">The CMO Room needs an AI. <button class="linkish" data-action="go" data-go="connect">Connect Claude and OpenAI, or one Perplexity key,</button> and each takes a seat.</p>` : live && S.loaded && S.providers && !S.providers.perplexity && !(S.providers.claude && S.providers.openai) ? `<p class="meta ch-mode">Only ${S.providers.claude ? 'Claude' : 'OpenAI'} is connected, so it plays both seats. <button class="linkish" data-action="go" data-go="connect">Connect ${S.providers.claude ? 'OpenAI' : 'Claude'}</button> for two different models.</p>` : '') : live && S.loaded && !S.model && VS.chModel === 'auto' ? `<p class="meta ch-mode">Answers quote your sources word for word. <button class="linkish" data-action="go" data-go="connect">Connect Claude, OpenAI or Perplexity</button> to pick a model and get written answers that cite the same sources.</p>` : '';
    const attach = canAttach();
    return `<form class="ch-compose" data-chform${attach ? ' data-ca-key="chat"' : ''}>
      <div class="ch-box">${attach ? window.ChatAttach.chips('chat') : ''}<textarea name="q" rows="2" placeholder="${VS.chCoach ? 'Ask ' + esc(coachFirst()) + ' about offers, copy, funnels or getting clients' : VS.chRoom ? 'Bring the room a decision, or ask @Claude or @GPT' : 'Ask anything about your business'}" aria-label="Message" ${S.busy ? 'disabled' : ''}>${esc(VS.chDraft)}</textarea>
        <div class="ch-compose-tools"><div class="ch-input-options">
          ${attach ? window.ChatAttach.button('chat', S.busy) : ''}
          ${VS.chCoach ? '' : `<label class="ch-scope" title="Choose which workspace sources to use">${icon('data')}<select data-action="ch-scope" aria-label="Source scope" ${S.busy ? 'disabled' : ''}>${SCOPES.map(([v, l]) => `<option value="${v}" ${VS.chScope === v ? 'selected' : ''}>${v === 'all' ? 'All context' : esc(l)}</option>`).join('')}</select>${icon('chevron')}</label>`}
          ${VS.chRoom ? '<span class="ch-room-models">Claude + GPT</span>' : modelPicker()}
        </div>${S.busy ? `<button class="btn primary ch-send ch-stop" type="button" data-action="ch-stop" aria-label="Stop waiting" title="Stop waiting for this response">${icon('stop')}</button>` : `<button class="btn primary ch-send" type="submit" aria-label="Send message">${icon('send')}</button>`}</div>
      </div>${VS.chCoach ? coachNote() : (window.CustomConnections?.attachments() || '') + programTools() + note}
      ${VS.chCoach ? '' : `<div class="ch-extra-tools"><button class="btn sm ghost" type="button" data-action="cc-chat-tools" ${S.busy ? 'disabled' : ''}>${icon('connect')}Tools &amp; skills</button></div>`}</form>`;
  }
  function view() {
    ensureWorkspace();
    const live = isLive(); if (live) load();
    const ms = msgs();
    const head = U.title('AI Chat', '', `${modeChip()}${VS.chFunnel ? '' : `<button class="btn ghost ch-history-button" data-action="ch-history" aria-expanded="${!!VS.chRail}" aria-controls="chat-context">${icon('chat')}<span>History</span></button>`}<button class="btn ghost" data-action="ch-new" ${S.busy ? 'disabled' : ''}>${icon('plus')}<span>${VS.chFunnel ? 'New funnel' : 'New chat'}</span></button>`);
    if (VS.chFunnel && window.ChatFunnel) return head + window.ChatFunnel.view();
    if (live && VS.chCoach) loadCoach();
    const intro = VS.chCoach ? `<div class="ch-empty"><h2>Ask ${esc(coachLabel())}.</h2><p>Coaching on offers, copy, funnels and getting clients,<br>from ${esc(coachOwn())} frameworks, calls and videos.</p></div>` : VS.chRoom ? `<div class="ch-empty"><h2>Bring the room a decision.</h2><p>Claude finds the strategy. GPT challenges it.<br>Both work from your business context.</p></div>` : `<div class="ch-empty"><h2>What are we working on?</h2><p>Your ideas, with your business in mind.</p></div>`;
    const suggestions = VS.chCoach ? COACH_SUGGEST.map((t) => `<button class="ch-chip" data-action="ch-ask" data-q="${esc(t)}">${icon('arrow')}<span>${esc(t)}</span></button>`).join('') : VS.chRoom ? ROOM_SUGGEST.map((t) => `<button class="ch-chip" data-action="ch-ask" data-q="${esc(t)}">${icon('arrow')}<span>${esc(t)}</span></button>`).join('') : [SUGGEST[0], ...TOOL_SUGGEST, SUGGEST[3]].map(([t, s]) => `<button class="ch-chip" data-action="ch-ask" data-q="${esc(t)}"${s ? ` data-s="${s}"` : ''}>${icon('arrow')}<span>${esc(t)}</span></button>`).join('');
    const err = S.err ? `<p class="auth-msg">${esc(S.err)}</p>` : '';
    U.after(() => { const ta = document.querySelector('[data-chform] textarea'); if (ta) grow(ta); });
    return `${head}<div class="ch${VS.chRail ? ' has-rail' : ''}">
      <section class="ch-main${ms.length ? ' has-messages' : ' is-empty'}">${err}${ms.length ? `<div class="ch-log" id="chlog" role="log" aria-label="Conversation" aria-live="polite">${ms.map(message).join('')}</div>${composer()}` : `<div class="ch-welcome${VS.chRoom ? ' rm-empty' : ''}" id="chlog">${intro}${composer()}<div class="ch-sugg" aria-label="Suggested questions">${suggestions}</div>${VS.chCoach ? '' : `<p class="ch-context-note">${icon('dna')}<span>Researches the web and works across your whole OS, grounded in your DNA</span></p>`}</div>`}</section>
      ${rail()}</div>`;
  }
  window.ChatHooks = { msgs: () => msgs(), rerender: () => rerender(), scrollEnd: () => scrollEnd() };
  V.chat = () => view();
  V.chat.live = () => view();
  V.chat.after = () => { const ta = document.querySelector('[data-chform] textarea'); if (ta) grow(ta); };

  function scrollEnd() { requestAnimationFrame(() => { const l = document.getElementById('chlog'); if (l) l.scrollTop = l.scrollHeight; const ta = document.querySelector('[data-chform] textarea'); if (ta) { grow(ta); if (!S.busy && window.innerWidth > 720) ta.focus({ preventScroll: true }); } }); }
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; };
  const demoWait = (ms, signal) => new Promise((resolve, reject) => {
    const stop = () => { clearTimeout(timer); reject(new DOMException('Stopped waiting', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
    if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true });
  });

  async function loadCoach() {
    const key = workspaceKey(); if (S.coach && S.coach.key === key) return; S.coach = { key, loaded: false };
    try { const r = await api('coach-stats'); if (key !== workspaceKey()) return; S.coach = { key, loaded: true, stats: r.stats, admin: !!r.admin }; } catch (e) { S.coach = { key, loaded: true, stats: null, admin: false }; }
    rerender();
  }
  function demoCoach(q) {
    const why = window.CoachGuard && window.CoachGuard.blocked(q);
    if (why) return { answer: window.CoachGuard.REFUSAL[why], sources: [], model: 'coach-ai' };
    return { model: 'coach-ai', notice: 'Demo workspace: a sample answer. In your workspace ' + coachLabel() + ' answers from the Coach library with your own AI.', sources: [{ n: 1, kind: 'coach', label: 'Framework', title: 'The 17P\'s of Funnel Sections' }, { n: 2, kind: 'coach', label: 'Framework', title: 'Copywriting Headline Examples' }],
      answer: 'Start with the promise, not the product. Your headline has one job: make the right person feel this is for them and that the result is within reach.\n\n1. **Name the outcome** they want in their words.\n2. **Add a timeframe or a removed obstacle**, like "without sales calls" or "in a weekend".\n3. **Keep it to one idea.** If you need a comma, move the second idea to the subheadline.\n\nNext step: write five versions, read them out loud, and keep the one you would click.' };
  }
  async function send(q, scope, force, previousRequest, retryFiles) {
    const key = ensureWorkspace();
    if (S.busy) return;
    const CA = window.ChatAttach; const attaching = !retryFiles && canAttach() && CA;
    if (attaching && CA.busy('chat')) { U.toast('Still reading your files. Send again in a moment.'); return; }
    const files = retryFiles || (attaching ? CA.payload('chat') : null);
    q = String(q || '').trim(); if (!q && files) q = files.length === 1 ? 'Look at the attached file.' : 'Look at the attached files.';
    if (!q) return;
    const it = !force && !scope && !files && !VS.chRoom && !VS.chCoach && !VS.chFunnel ? intentOf(q) : null;
    if (it === 'coach' || it === 'room') { setMode(it); VS.chDraft = ''; rerender(); return send(q, null, it); }
    if (it === 'funnel') { setMode('funnel'); VS.chDraft = ''; rerender(); U.toast('Funnel agent: pick the offer, answer a few questions, then it builds a preview link.'); return; }
    if (it) { VS.studioPrompt = q; VS.chDraft = ''; location.hash = it; return; }
    if (scope) VS.chScope = scope;
    if (window.Programs?.intent(q) && !VS.chRoom && !scope) VS.chScope = 'programs';
    // Agent design is per message. The scope never stays on Agents, so the next plain question gets a normal answer.
    const scopeBefore = VS.chScope === 'agents' ? 'all' : VS.chScope;
    if (window.AgentSchema?.intent(q) && !VS.chRoom && !scope) VS.chScope = 'agents';
    const programRequest = previousRequest || { request_id: window.Programs?.uuid(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, program_id: VS.chScope === 'programs' ? VS.chProgramId || null : null, update_requested: VS.chScope === 'programs' && VS.chProgramUpdate === true, material_ids: VS.chScope === 'programs' ? VS.chMaterials || [] : [], ...(window.CustomConnections?.request() || {}) };
    // "Add this in HighLevel" goes to Grok Bot as a task card. Nothing is sent until the founder presses Send to Grok.
    if (!VS.chRoom && !VS.chCoach && !scope && window.Grok?.intent(q)) {
      const list0 = VS.chThread ? (S.msgs[VS.chThread] = S.msgs[VS.chThread] || []) : (S.draftMsgs = S.draftMsgs || []);
      const prev = [...list0].reverse().find((x) => x.role !== 'user' && x.body && !x.error);
      VS.chDraft = ''; list0.push({ role: 'user', body: q }, { role: 'assistant', grok: window.Grok.draft(q, prev && prev.body) });
      window.Grok.load(); rerender(); scrollEnd(); return;
    }
    const live = isLive(); S.busy = true; VS.chDraft = '';
    if (attaching && files) CA.clear('chat');
    const sentFiles = files ? files.map((f) => ({ name: f.name, kind: f.kind })) : null;
    const fileBody = files ? { files } : {};
    const controller = S.controller = new AbortController();
    const list = VS.chThread ? (S.msgs[VS.chThread] = S.msgs[VS.chThread] || []) : (S.draftMsgs = []);
    list.push({ role: 'user', body: q, files: sentFiles });
    const label = { recordings: 'your recordings', brain: 'your Brain', offers: 'your offers and funnels', content: 'your content and research', memory: 'your memory' }[VS.chScope] || 'everything';
    const room = force === 'room' || (force !== 'chat' && force !== 'coach' && VS.chRoom);
    const coach = !room && (force === 'coach' || (force !== 'chat' && VS.chCoach));
    const rmode = /^@/.test(q) ? 'seat' : /^(decide|verdict)\b/i.test(q) ? 'decide' : 'debate';
    if (room) { list.push({ role: 'assistant', pending: label, room: rmode }); S.stage = 0; clearInterval(S.stageT); S.stageT = setInterval(() => { S.stage++; if (S.stage >= ROOM_STAGE.length) clearInterval(S.stageT); rerender(); }, rmode === 'debate' ? 11000 : 8000); }
    else if (coach) list.push({ role: 'assistant', pending: label, coach: true });
    else list.push({ role: 'assistant', pending: label, flow: VS.chScope === 'programs' || VS.chScope === 'agents' ? null : newFlow(), by: activeModel() && MODEL[activeModel()] && (live ? S.providers && (S.providers[MODEL[activeModel()].p] || S.providers.perplexity) : true) ? MODEL[activeModel()].name : null });
    rerender(); scrollEnd();
    const pend = list[list.length - 1];
    if (pend.flow) { clearInterval(S.flowT); S.flowT = setInterval(() => { const el = document.querySelector('#chflow .chf-time'); if (el && pend.flow) el.textContent = flowTime(Date.now() - pend.flow.started); }, 1000); }
    try {
      let r;
      if (room && live) r = await api('room', { q, scope: VS.chScope, thread_id: VS.chThread, ...programRequest, ...fileBody }, controller.signal);
      else if (room) { await demoWait(1400, controller.signal); r = demoRoom(q, list); r.thread_id = VS.chThread || 'demo-' + Date.now(); }
      else if (coach && live) r = await api('coach', { q, thread_id: VS.chThread, model: VS.chModel === 'auto' ? null : VS.chModel, ...fileBody }, controller.signal);
      else if (coach) { await demoWait(900, controller.signal); r = demoCoach(q); r.thread_id = VS.chThread || 'demo-' + Date.now(); }
      else if (live && pend.flow) r = await apiStream('ask', { q, scope: VS.chScope, thread_id: VS.chThread, model: VS.chModel === 'auto' ? null : VS.chModel, ...programRequest, ...fileBody }, controller.signal, (e) => onFlow(pend, e));
      else if (live) r = await api('ask', { q, scope: VS.chScope, thread_id: VS.chThread, model: VS.chModel === 'auto' ? null : VS.chModel, ...programRequest, ...fileBody }, controller.signal);
      else if (VS.chScope === 'programs') r = { thread_id: VS.chThread || 'demo-' + Date.now(), answer: 'Use your live workspace to brainstorm programs with your own connected AI. You can create and edit an outline manually in Programs now. Nothing has been created or changed.', sources: [], model: 'sources' };
      else { if (pend.flow) await demoFlow(pend, q, controller.signal); else await demoWait(650, controller.signal); r = demoAsk(q, VS.chScope); if (pend.flow) r.flow = { skills: pend.flow.skills.map((x) => x.name), context: (pend.flow.items.context || []).map((x) => x.label), reviewed: true }; r.thread_id = VS.chThread || 'demo-' + Date.now(); const dm = activeModel(); if (dm && MODEL[dm]) r.notice = 'Demo workspace: answers quote sample sources. In your workspace ' + MODEL[dm].name + ' writes the answer from them.'; }
      if (key !== workspaceKey()) return;
      if (files && !live) r.notice = 'Demo workspace: files are read in your live workspace, where your AI answers from them.';
      window.CustomConnections?.consumed();
      list.pop(); list.push({ role: 'assistant', body: r.answer, sources: r.sources, model: r.model, room: r.room || null, notice: r.notice || null, program_proposal: r.program_proposal || null, agent_proposal: r.agent_proposal || null, actions: r.actions || [], connection: r.connection || null, handoff: r.handoff || null, flow: r.flow || null, graphic: r.graphic || null, images: r.images || null, web: r.web || null });
      if (r.grok && window.Grok) { list.push({ role: 'assistant', grok: { ...r.grok, state: 'draft' } }); window.Grok.load(); }
      if (r.program_proposal) window.OSPrograms?.load(true);
      if (!VS.chThread) {
        VS.chThread = r.thread_id; S.msgs[r.thread_id] = list; S.draftMsgs = null;
        const t = { id: r.thread_id, title: q.slice(0, 80), updated_at: new Date().toISOString() };
        if (live) S.threads.unshift(t); else (S.demoThreads = S.demoThreads || []).unshift(t);
      } else { const arr = live ? S.threads : (S.demoThreads || []); const t = arr.find((x) => x.id === VS.chThread); if (t) { t.updated_at = new Date().toISOString(); arr.splice(arr.indexOf(t), 1); arr.unshift(t); } }
    } catch (e) {
      if (key !== workspaceKey()) return;
      const stopped = controller.signal.aborted;
      list.pop(); list.push({ role: 'assistant', error: true, stopped, body: stopped ? (live ? 'Stopped waiting. This request may still finish in the background.' : 'Response stopped.') : 'That did not go through: ' + e.message, retry: { q, scope: VS.chScope, force: room ? 'room' : coach ? 'coach' : 'chat', programRequest, files } });
      VS.chDraft = q;
    } finally {
      if (key !== workspaceKey()) return;
      if (VS.chScope === 'agents') VS.chScope = scopeBefore;
      clearInterval(S.stageT); clearInterval(S.flowT); S.controller = null; S.busy = false; rerender(); scrollEnd();
    }
  }

  document.addEventListener('submit', (e) => { const f = e.target.closest('[data-chform]'); if (!f) return; e.preventDefault(); send(f.elements.q.value); });
  document.addEventListener('input', (e) => { const ta = e.target.closest('[data-chform] textarea'); if (!ta) return; VS.chDraft = ta.value; grow(ta); });
  document.addEventListener('keydown', (e) => { const ta = e.target.closest && e.target.closest('[data-chform] textarea'); if (!ta || e.key !== 'Enter' || e.shiftKey || e.isComposing) return; e.preventDefault(); send(ta.value); });

  ACT['ch-model'] = (el) => { VS.chModel = el.value; try { localStorage.setItem(MKEY, el.value); } catch (e) { /* private mode */ } rerender(); };
  ACT['ch-ask'] = (el) => send(el.dataset.q, el.dataset.s || null);
  ACT['ch-stop'] = () => { if (S.busy && S.controller) S.controller.abort(); };
  ACT['ch-retry'] = (el) => {
    if (S.busy) return;
    const list = msgs(), i = +el.dataset.m, retry = list[i]?.retry; if (!retry) return;
    if (list[i - 1]?.role === 'user' && list[i - 1].body === retry.q) list.splice(i - 1, 2); else list.splice(i, 1);
    send(retry.q, retry.scope, retry.force, retry.programRequest, retry.files || null);
  };
  ACT['ch-scope'] = (el) => { VS.chScope = el.value; VS.chProgramUpdate = false; rerender(); };
  ACT['ch-program-context'] = el => { VS.chProgramId = el.value || null; VS.chProgramUpdate = false; rerender(); };
  ACT['ch-program-update'] = el => { VS.chProgramUpdate = el.checked; rerender(); };
  ACT['ch-program-plan'] = () => { VS.chRoom = false; send('Prepare a program proposal based on our discussion. I will review and confirm before it is built.', 'programs', 'chat'); };
  ACT['ch-program-materials'] = async () => {
    const key = ensureWorkspace(); await window.OSPrograms.load(); if (key !== workspaceKey()) return;
    const ms = window.OSPrograms.materials().filter(m => !m.removal_pending), selected = new Set(VS.chMaterials || []);
    U.drawer(`<div class="pg-editor"><h2>Program materials</h2><p>Select up to 12 files or notes for this conversation. With none selected, AI uses material from the selected program.</p>${ms.length ? ms.map(m => `<label class="ch-material-choice"><input type="checkbox" data-chmaterial="${m.id}" ${selected.has(m.id) ? 'checked' : ''}><span>${esc(m.title)}${m.read_state === 'attachment' ? '<small class="meta"> · Notes only; original is not read by AI</small>' : ''}</span></label>`).join('') : '<p class="meta">Add your existing material in Programs first.</p>'}<div class="actions"><button class="btn" data-action="drawer-close">Done</button><button class="btn ghost" data-action="go" data-go="programs">Open Programs</button></div></div>`, { label: 'Program materials' });
  };
  document.addEventListener('change', e => { if (!e.target.matches('[data-chmaterial]')) return; const ids = new Set(VS.chMaterials || []); if (e.target.checked && ids.size >= 12) { e.target.checked = false; U.toast('Select up to 12 materials.'); return; } if (e.target.checked) ids.add(e.target.dataset.chmaterial); else ids.delete(e.target.dataset.chmaterial); VS.chMaterials = [...ids]; rerender(); });
  ACT['ch-history'] = () => { VS.chRail = !VS.chRail; rerender(); requestAnimationFrame(() => { const b = document.querySelector(VS.chRail ? '#chat-context [data-action="ch-history"]' : '.ch-history-button'); if (b) b.focus({ preventScroll: true }); }); };
  ACT['ch-new'] = () => { if (S.busy) return; if (VS.chFunnel && window.ChatFunnel) { if (window.ChatFunnel.busy()) return; window.ChatFunnel.open({}); return; } VS.chThread = null; S.draftMsgs = null; VS.chDraft = ''; VS.chRail = false; rerender(); scrollEnd(); };
  ACT['ch-open'] = (el) => { if (S.busy) return U.toast('Stop waiting before switching chats'); if (window.innerWidth <= 980) VS.chRail = false; openThread(el.dataset.id).then(scrollEnd); };
  ACT['ch-del'] = async (el) => {
    if (S.busy) return U.toast('Stop waiting before deleting this chat');
    const id = el.dataset.id; if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.classList.add('sure'); el.title = 'Click again to delete'; U.toast('Click again to delete this chat'); return; }
    try { await api('delete', { thread_id: id }); S.threads = S.threads.filter((t) => t.id !== id); delete S.msgs[id]; if (VS.chThread === id) VS.chThread = null; rerender(); U.toast('Chat deleted'); } catch (e) { U.toast(e.message); }
  };
  ACT['ch-older'] = () => { const done = S.olderStep || 0; const steps = [[1, 2], [3, 4, 5], [6, 7, 8]]; if (done >= steps.length) { U.toast('All recordings from the last nine months are read'); return; } S.olderStep = done + 1; readCalls(steps[done]); };
  ACT['ch-copy'] = (el) => { const m = msgs()[+el.dataset.m]; if (m && !m.error) U.copy(m.body.replace(/\*\*/g, '').replace(/\s*\[(\d+|R)\]/g, '')); };
  ACT['ch-save'] = async (el) => {
    const m = msgs()[+el.dataset.m]; const qm = msgs()[+el.dataset.m - 1]; if (!m || m.error) return;
    const text = (qm ? qm.body + '\n\n' : '') + m.body.replace(/\*\*/g, '').replace(/\s*\[(\d+|R)\]/g, '');
    try {
      if (isLive()) { await window.Auth.memory.add(wsId(), { kind: 'note', text: text.slice(0, 1990), meta: { from: 'chat' } }); if (window.OSMemory) window.OSMemory.reset(); }
      else if (window.OSMemory) window.OSMemory.items().unshift({ id: 'm' + Date.now(), kind: 'note', text, meta: { from: 'chat' }, status: 'open', created_at: new Date().toISOString() });
      U.toast('Saved to Memory');
    } catch (e) { U.toast(e.message); }
  };


  /* ---------- CMO Room ---------- */
  // Demo: a worked debate built from the sample DNA, so the room can be toured without keys.
  function demoRoom(q, list) {
    const d = window.DNA.data(); const offers = (d.items || []).filter((x) => x.kind === 'offer' && x.included && x.price != null).sort((a, b) => a.price - b.price);
    const lo = offers[0] || { name: 'your starter kit', price: 27 }; const hi = offers[offers.length - 1] || { name: 'your flagship program', price: 497 };
    const top = (d.proven || []).slice().sort((a, b) => (b.outlier || 0) - (a.outlier || 0))[0];
    const sources = [{ n: 1, kind: 'offer', label: 'Offer', title: lo.name, snippet: (lo.price != null ? lo.price + ' ' + (lo.currency || '') : '') + (lo.summary ? ' · ' + lo.summary : '') }, { n: 2, kind: 'offer', label: 'Offer', title: hi.name, snippet: (hi.price != null ? hi.price + ' ' + (hi.currency || '') : '') + (hi.summary ? ' · ' + hi.summary : '') }];
    if (top) sources.push({ n: 3, kind: 'post', label: 'Creator post', title: top.author + ' on YouTube', snippet: top.title + ' · ' + (top.outlier || '?') + 'x their median', url: top.url });
    const prevRoom = [...list].reverse().find((m) => m.room && m.room.seats && m.room.seats.length === 2);
    const at = q.match(/^@(claude|strategist|gpt|chatgpt|openai|challenger)\b[\s,:]*/i);
    const S1 = { id: 'strategist', name: 'Strategist', by: 'Claude Sonnet 5.5' }, S2 = { id: 'challenger', name: 'Challenger', by: 'GPT-6.1 Sol' };
    const tk = { strategist: `**Build it around the offer ladder you already have.**\n\nYour brand is one person running the whole business on HighLevel, and that story is what people buy into. Whatever you pick should send people to ${lo.name} first [1] and give buyers a clear next step into ${hi.name} [2]. That way one piece of content feeds products, clients and affiliate at the same time.\n\nI would keep the promise narrow and personal: what you built, what it made, what you would do again.\n\nRisk: a slower start, because a personal story takes a few pieces before it compounds.`,
      challenger: `**Lead with the angle that is already proven, then make it yours.**\n\n${top ? `${top.author}'s "${top.title}" ran ${top.outlier}x their median [3]. ` : ''}That is attention you can borrow on day one. Most founders skip testing and commit to a whole series on gut feel. Run two pieces against each other with the same call to action to ${lo.name} [1] and let purchases decide, not views.\n\nRisk: the borrowed angle pulls curious viewers who never buy.` };
    const push = { strategist: `They are right that a test beats a gut call, and I would adopt it. Where I disagree: copying the outlier's framing puts you in the same lane as everyone else. Keep their structure and tell it with your numbers and your HighLevel setup.`,
      challenger: `They are right that the ladder matters, and pointing at ${lo.name} first is the cleanest signal. But "narrow and personal" alone is slow to find an audience. Pair the personal story with the proven hook so the first piece gets seen.` };
    const verdict = { call: `Test two pieces this week, one built on the proven angle and one on your own story, both pointing to ${lo.name}, and let purchases pick the direction.`, why: `Both seats want the offer ladder in every piece [1][2]. The Challenger's test settles what the Strategist is guessing about, and the Strategist's point keeps the winner sounding like you.`, agree: [`${lo.name} is the first call to action in every piece`, 'Judge on purchases, not views', 'One piece should feed every revenue stream'], split: 'How much to borrow from the outlier. The Challenger wants the hook as is, the Strategist wants it retold with your numbers.', proof: `If neither piece sells ${lo.name} within 14 days of publishing, the topic is wrong, not the angle.`, next: ['Write both titles and pick thumbnails for each', `Add a tracked link to ${lo.name} on both`, 'Publish both within seven days and compare purchases per 1,000 views'], ideas: [{ title: top ? 'My version of: ' + top.title : 'How I run my whole business on HighLevel alone', format: 'long' }, { title: `What ${lo.name} actually does in 60 seconds`, format: 'short' }], by: 'Claude Sonnet 5.5' };
    let room;
    if (at) { const id = /claude|strategist/i.test(at[1]) ? 'strategist' : 'challenger'; room = { mode: 'seat', seats: [{ ...(id === 'strategist' ? S1 : S2), take: id === 'strategist' ? `**Keep it personal and tie it to the ladder.**\n\nFor that I would open with what happened in your own business, then show the one step a viewer can copy, and end on ${lo.name} [1].` : `**Borrow the proven structure.**\n\nTitle it the way the outlier did, then swap in your own result${top ? ` [3]` : ''}. Send everyone to ${lo.name} [1].`, push: '' }], verdict: null }; }
    else if (/^(decide|verdict)\b/i.test(q) && prevRoom) room = { mode: 'decide', seats: prevRoom.room.seats, verdict };
    else if (/^(argue|another round|go again)\b/i.test(q) && prevRoom) room = { mode: 'round', seats: [{ ...S1, take: `I accept the test. I still hold that the winning piece has to be retold with your own numbers, or it trains your audience to expect someone else's story. What would settle it: which piece brings more replies to the welcome email.`, push: '' }, { ...S2, take: `Agreed on retelling it with your numbers. I still want the first piece out this week on the proven hook, because waiting for the perfect personal story is the bigger risk. Settle it on purchases per 1,000 views.`, push: '' }], verdict };
    else room = { mode: 'debate', seats: [{ ...S1, take: tk.strategist, push: push.strategist }, { ...S2, take: tk.challenger, push: push.challenger }], verdict };
    room.question = q;
    const text = room.verdict ? '**The call:** ' + room.verdict.call + '\n\n' + room.verdict.why + '\n\nNext:\n' + room.verdict.next.map((x) => '- ' + x).join('\n') : room.seats.map((x) => x.name + ': ' + x.take).join('\n\n');
    return { answer: text, sources, model: 'cmo-room', room, notice: 'Demo workspace: a sample debate from the sample DNA. In your workspace Claude and GPT argue your real question.' };
  }
  ACT['ch-funnel'] = () => { if (S.busy || window.ChatFunnel?.busy()) return; setMode(VS.chFunnel ? 'chat' : 'funnel'); rerender(); requestAnimationFrame(() => document.querySelector('[data-action="ch-funnel"]')?.focus({ preventScroll: true })); };
  ACT['ch-coach'] = () => { if (S.busy || window.ChatFunnel?.busy()) return; setMode(VS.chCoach ? 'chat' : 'coach'); rerender(); requestAnimationFrame(() => document.querySelector('[data-action="ch-coach"]')?.focus({ preventScroll: true })); };
  ACT['co-lib'] = () => window.CoachLibrary?.open(api);
  ACT['ch-room'] = () => { if (S.busy || window.ChatFunnel?.busy()) return; setMode(VS.chRoom ? 'chat' : 'room'); rerender(); requestAnimationFrame(() => document.querySelector('[data-action="ch-room"]')?.focus({ preventScroll: true })); };
  ACT['rm-go'] = (el) => send(el.dataset.q, null, 'room');
  ACT['rm-idea'] = async (el) => {
    const m = msgs()[+el.dataset.m]; const v = m && m.room && m.room.verdict; const x = v && v.ideas[+el.dataset.i]; if (!x || !window.OSBoard) return;
    el.disabled = true;
    try {
      const fmt = { short: 'short', carousel: 'carousel', post: 'post', email: 'email' }[x.format] || 'long'; const channel = x.format === 'short' ? 'short' : x.format === 'carousel' ? 'carousel' : x.format === 'post' ? 'post' : x.format === 'email' ? 'email' : 'youtube';
      await window.OSBoard.add({ title: x.title, stage: 'approved', channel, format: fmt, meta: { from: 'cmo-room', sources: ['CMO ROOM'], why: 'From the CMO Room: ' + v.call } });
      v.sent = { ...(v.sent || {}), [el.dataset.i]: true }; U.toast('Added to the Content board'); rerender();
    } catch (e) { el.disabled = false; U.toast(window.Auth && window.Auth.friendly ? window.Auth.friendly(e) : e.message); }
  };

  /* ---------- full transcript drawer ---------- */
  const TX = { chunks: [], title: '' };
  const txLine = (line) => { const m = line.match(/^([^:]{2,40}):\s+(.*)$/); return m ? `<span class="ch-sp">${esc(m[1])}:</span> ${esc(m[2])}` : esc(line); };
  function showTranscript(head, chunks, focus, info) {
    TX.chunks = chunks; TX.title = info.title || 'Transcript';
    const words = info.words || chunks.reduce((n, c) => n + (c.body.match(/\S+/g) || []).length, 0);
    const meta = [info.minutes ? info.minutes + ' minutes' : '', Number(words).toLocaleString('en-US') + ' words', chunks.length + ' passages'].filter(Boolean).join(' · ');
    const link = info.url ? `<a class="btn sm" href="${esc(info.url)}" target="_blank" rel="noopener">${icon('out')}<span>Open in Zoom</span></a>` : '';
    U.drawer(`${head}<p class="meta">Full transcript · ${meta}</p>
      <div class="ch-txbar"><label class="ch-find">${icon('search')}<input type="search" placeholder="Find in transcript" aria-label="Find in transcript" data-chfind></label><span class="meta tnum" data-chfound></span>
        <button class="btn sm ghost" data-action="ch-txcopy">${icon('copy')}<span>Copy</span></button><button class="btn sm ghost" data-action="ch-txdl">${icon('download')}<span>Download</span></button>${link}</div>
      <div class="dsec ch-tx" data-chtx>${chunks.map((c) => `<div class="ch-tl ${c.idx === focus ? 'focus' : ''}" data-idx="${c.idx}"><span class="tnum meta">${esc(c.t)}</span><p>${c.body.split('\n').map(txLine).join('<br>')}</p></div>`).join('')}</div>
      ${info.note ? `<p class="meta">${esc(info.note)}</p>` : ''}`, { label: 'Transcript', wide: true });
    requestAnimationFrame(() => {
      const f = document.querySelector('#drawer .ch-tl.focus'); if (f) f.scrollIntoView({ block: 'center' });
      const inp = document.querySelector('#drawer [data-chfind]'); if (inp) inp.addEventListener('input', () => findTx(inp.value));
    });
  }
  function findTx(q) {
    q = q.trim().toLowerCase(); const out = document.querySelector('#drawer [data-chfound]'); let n = 0, first = null;
    document.querySelectorAll('#drawer .ch-tl').forEach((el) => {
      const c = TX.chunks.find((x) => String(x.idx) === el.dataset.idx); if (!c) return;
      const hit = !q || c.body.toLowerCase().includes(q); el.hidden = !hit;
      let html = c.body.split('\n').map(txLine).join('<br>');
      if (q && hit) { n++; first = first || el; const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); html = html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(re, '<mark>$1</mark>')); }
      el.querySelector('p').innerHTML = html;
    });
    if (out) out.textContent = q ? (n ? n + (n === 1 ? ' passage' : ' passages') : 'No match') : '';
    if (first) first.scrollIntoView({ block: 'nearest' });
  }
  const txText = () => TX.title + '\n\n' + TX.chunks.map((c) => `[${c.t}]\n${c.body}`).join('\n\n');
  ACT['ch-txcopy'] = () => U.copy(txText());
  ACT['ch-txdl'] = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txText()], { type: 'text/plain' })); a.download = TX.title.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 80) + '.txt'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  ACT['ch-src'] = async (el) => {
    const card = el.closest('.ch-msg'); const all = [...document.querySelectorAll('#chlog .ch-msg')]; const mi = el.dataset.m != null ? +el.dataset.m : all.indexOf(card);
    const m = msgs()[mi]; if (!m) return; const s = (m.sources || []).find((x) => String(x.n) === String(el.dataset.n)); if (!s) return;
    if (s.kind === 'program-material') return ACT['pg-material-open']({ dataset: { id: s.ref } });
    const head = `<div><p class="meta">${esc(KNAME[s.kind] || s.kind)}${s.at ? ' · ' + when(s.at) : ''}</p><h2>${esc(s.title || '')}</h2></div>`;
    const link = s.url ? `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">${icon('out')}<span>${s.kind === 'recording' ? 'Open in Zoom' : 'Open'}</span></a>` : '';
    if (s.kind === 'recording' && isLive()) {
      U.drawer(`${head}<p class="meta">${U.spin}Loading the transcript</p>`, { label: 'Source', wide: true });
      const [rid, idx] = String(s.ref || '').split('#');
      try {
        const r = await api('passage', { recording_id: rid, idx: +idx || 0 });
        showTranscript(head, r.chunks.map((c) => ({ idx: c.idx, t: c.t, body: c.body })), s.full ? null : r.focus, { url: s.url, title: s.title || r.rec.title, minutes: r.rec.minutes, words: r.rec.words });
      } catch (e) { U.drawer(`${head}<p class="auth-msg">${esc(e.message)}</p>`, { label: 'Source' }); }
      return;
    }
    if (s.kind === 'recording') {
      const [rid, idx] = String(s.ref || '').split('#'); const c = DEMO_CALLS.find((x) => x.id === rid);
      if (c) { showTranscript(head, c.lines.map(([sec, body], i) => ({ idx: i, t: mmss(sec), body })), s.full ? null : +idx || 0, { title: c.title, minutes: c.minutes, note: 'Sample transcript. Connect Zoom in your workspace to read your real calls.' }); return; }
    }
    const go = { offer: 'dna', funnel: 'dna', post: 'proven', research: 'research', doc: 'brain', fact: 'brain', memory: 'memory', draft: 'approvals', channel: 'connect', recording: 'calls' }[s.kind];
    U.drawer(`${head}${s.t ? `<p class="meta">At ${esc(s.t)}</p>` : ''}<div class="dsec"><p class="ch-quote">${snip(s.snippet)}</p></div><div class="actions">${link}${go ? `<button class="btn ghost" data-action="go" data-go="${go}">Open ${esc({ dna: 'Brand DNA', proven: 'Proven', research: 'Research', brain: 'Brain', memory: 'Memory', approvals: 'Newsfeed', connect: 'Connections', calls: 'Calls' }[go] || go)}</button>` : ''}</div>`, { label: 'Source' });
  };

  window.ChatOS = { load, send, demoAsk, md, setMode, prepareWorkspace: ensureWorkspace, clearDraft: () => { S.draftMsgs = null; },
    programStatus: (id, status, resultId) => { for (const list of [...Object.values(S.msgs), S.draftMsgs || []]) for (const m of list) if (m.program_proposal?.id === id) Object.assign(m.program_proposal, { status, result_id: resultId || null }); rerender(); } };
})();

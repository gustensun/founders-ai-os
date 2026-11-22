// AI Team: a messenger with every agent. Pick an agent on the left, talk to it in the middle, see what it does on
// the right. OS agents answer from the workspace through /api/chat, the AI Coach coaches, Grok agents work in Grok Bot
// after the founder confirms each task, and Coding runs in Claude and Codex through AI access.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, { esc, icon } = U;
  const T = window.TeamAgents, M = window.Mascots;
  const live = () => !!window.App?.isLive();
  const wsId = () => window.App?.liveCtx?.().ws?.id;
  const key = () => (live() ? 'live:' : 'demo:') + (wsId() || '');
  const RUNS = { os: 'Founders OS', grok: 'Grok Bot', code: 'Claude and Codex', get coach() { return (window.CoachGuard && window.CoachGuard.coachLabel ? window.CoachGuard.coachLabel() : 'AI Coach'); } };
  const S = { key: null, loaded: false, loading: false, err: '', last: {}, threads: [], msgs: {}, cur: {}, draft: {}, busy: null, pending: {}, demo: {}, mine: {}, conn: {} };

  const mine = (id) => { const s = S.mine[id]; return s && (s.instructions || s.context) ? s : null; };
  const CAN = ['Reads and updates anything in your OS when you ask', 'Researches the web and reads pages', 'Reads your YouTube channels, videos and channel numbers', 'Reads HighLevel contacts, deals, payments, subscriptions and calls, never conversations', 'Reads revenue, affiliate numbers and every other connection', 'Sets up recurring tasks you confirm', 'Saves deliverables to the Newsfeed', 'Brings in teammates', 'Hands outside work to Grok Bot, after you confirm'];
  const mascot = (id, size, label) => M.svg(id, { size, label: label === undefined ? false : label });
  const who = (a) => `${M.name(a.id)} · ${a.name}`;
  const agent = () => T.get(VS.tmAgent) || T.get('coo');
  const ago = (iso) => { if (!iso) return ''; const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 604800) return Math.floor(s / 86400) + 'd'; return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  const plain = (s) => String(s || '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '').replace(/\[(\d{1,2}|R)\]/g, '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- seen markers ---------- */
  const seenKey = () => 'fos-tm-seen:' + key();
  const seen = () => { try { return JSON.parse(localStorage.getItem(seenKey()) || '{}'); } catch (e) { return {}; } };
  const markSeen = (id) => { const s = seen(); s[id] = new Date().toISOString(); try { localStorage.setItem(seenKey(), JSON.stringify(s)); } catch (e) { /* private mode */ } };

  /* ---------- data ---------- */
  function scope() {
    const k = key(); if (S.key === k) return;
    Object.assign(S, { key: k, loaded: false, loading: false, err: '', last: {}, threads: [], msgs: {}, cur: {}, draft: {}, busy: null, pending: {}, demo: {}, mine: {}, conn: {} });
    if (!live()) { seedDemo(); try { S.mine = JSON.parse(localStorage.getItem('fos-tm-mine:' + k) || '{}'); } catch (e) { S.mine = {}; } }
  }
  async function api(action, body = {}) {
    const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, workspace_id: wsId(), ...body }) });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || 'That did not work. Try again.');
    return j;
  }
  async function load(force) {
    scope(); window.Grok?.load();
    if (!live()) { S.loaded = true; return; }
    if (S.loading || (S.loaded && !force)) return; S.loading = true; const k = S.key;
    try { const r = await api('team'); if (k !== S.key) return; S.last = r.last || {}; S.threads = r.threads || []; S.mine = r.settings || {}; S.err = ''; }
    catch (e) { if (k === S.key) S.err = e.message; }
    finally { if (k === S.key) { S.loading = false; S.loaded = true; paint(); openThread(); } }
  }
  // Which conversation is open for an agent: the one picked, else the latest.
  const curThread = (id) => (id in S.cur ? S.cur[id] : (S.last[id] && S.last[id].thread_id) || null);
  async function openThread() {
    const a = agent(); if (!live()) return;
    const t = curThread(a.id); if (!t || S.msgs[t]) return;
    S.msgs[t] = 'loading'; paint();
    try { const r = await api('thread', { thread_id: t }); S.msgs[t] = (r.messages || []).map((m) => ({ role: m.role, body: m.body, at: m.created_at, files: m.role === 'user' ? (m.sources || []).filter((x) => x && x.kind === 'file') : null, proposal: !!(m.program_proposal || m.agent_proposal), actions: (m.team && m.team.actions) || [], connection: (m.team && m.team.connection) || null })); }
    catch (e) { S.msgs[t] = [{ role: 'assistant', body: 'This chat could not load. ' + e.message, at: null, error: true }]; }
    paint(true);
  }
  function messages(a) {
    if (!live()) return S.demo[a.id] || [];
    const t = curThread(a.id); const m = t ? S.msgs[t] : S.newFor === a.id ? S.msgs.__new : [];
    return Array.isArray(m) ? m : [];
  }
  const grokTasks = (id) => ((window.Grok && window.Grok.state().tasks) || []).filter((t) => (t.agent || 'automations') === id);

  // Preview line and time for the list.
  function preview(a) {
    const lc = live() ? S.last[a.id] : null;
    if (a.runs === 'grok' && !(lc && lc.body)) {
      const t = grokTasks(a.id)[0]; if (!t) return { text: a.job, at: null, faint: true };
      const label = { sent: 'Sent', started: 'Working on it', done: 'Done', needs_you: 'Needs you', failed: 'Failed', cancelled: 'Cancelled' }[t.status] || t.status;
      return { text: label + ': ' + (t.summary ? plain(t.summary) : t.title), at: t.updated_at || t.created_at, report: ['done', 'needs_you', 'failed'].includes(t.status) };
    }
    if (!live()) { const m = (S.demo[a.id] || []).filter((x) => x.role === 'assistant').pop(); return m ? { text: plain(m.body), at: m.at, report: true } : { text: a.job, at: null, faint: true }; }
    const l = S.last[a.id]; return l && l.body ? { text: l.body, at: l.at, report: true } : { text: a.job, at: null, faint: true };
  }
  const unread = (a, p) => p.report && p.at && a.id !== VS.tmAgent && (!seen()[a.id] || new Date(p.at) > new Date(seen()[a.id]));

  /* ---------- demo conversations ---------- */
  function seedDemo() {
    const h = 3600e3, at = (d) => new Date(Date.now() - d).toISOString();
    S.demo = {
      coo: [
        { role: 'user', body: 'What should I focus on today?', at: at(2.2 * h) },
        { role: 'assistant', body: 'Three things move revenue today:\n\n- **Approve the two ideas** waiting in the Newsfeed so Content can schedule this week.\n- **Answer Support**: two refund questions are waiting on you in Grok Bot.\n- **Follow up the warm leads** from Tuesday\u2019s webinar. Ask Sales for the list.\n\nEverything else can wait until tomorrow.', at: at(2.1 * h) },
      ],
      content: [
        { role: 'user', body: 'Give me three video ideas for this week', at: at(26 * h) },
        { role: 'assistant', body: 'From your proven posts, these three angles keep winning:\n\n1. **The $27 offer that paid for my ads**: walk through the order bump math.\n2. **I rebuilt a funnel live in 20 minutes**: screen recording, one cut.\n3. **What I would do with zero followers**: answer the comment that got 140 replies.\n\nSay the word and I will send them to the Newsfeed.', at: at(25.9 * h) },
      ],
      sales: [
        { role: 'user', body: 'Prep me for my next sales call', at: at(50 * h) },
        { role: 'assistant', body: 'Your next call is with a coach who joined the Free Community last month and watched the webinar twice. On calls like this the objection is usually time, not price. Lead with the done-with-you setup and the 30 day timeline.', at: at(49.9 * h) },
      ],
    };
  }
  function demoActions(q) {
    const out = [{ label: 'Read the brief', ok: true }];
    if (/\b(research|competitor|market|trend|news|web|look up|find out)\b/i.test(q)) out.push({ label: 'Searched the web', ok: true });
    if (/\b(post|email|script|copy|idea|hook|content)\b/i.test(q)) out.push({ label: 'Read Brand DNA', ok: true }, { label: 'Read proven content', ok: true });
    if (/\b(pipeline|crm|lead|buyer|sales|call)\b/i.test(q)) out.push({ label: 'Read the CRM board', ok: true });
    if (/\b(daily|weekly|every (day|week|morning)|recurring)\b/i.test(q)) out.push({ label: 'Drafted routine for your review', ok: true });
    return out;
  }
  function demoReply(a, q) {
    if (a.runs === 'coach') return 'Demo workspace: in your workspace ' + (window.CoachGuard && window.CoachGuard.coachLabel ? window.CoachGuard.coachLabel() : 'AI Coach') + ' answers from the approved Playbook and the teaching library, in the coach\u2019s frameworks.';
    const r = window.ChatOS ? window.ChatOS.demoAsk(q, a.scope || 'all') : null;
    const body = r && r.answer && !/^Nothing in the sample/.test(r.answer) ? r.answer.replace(/\s*\[\d{1,2}\]/g, '') : `I am ${who(a)}. In your workspace I answer from your recordings, Brain, offers and research once Claude, OpenAI or Perplexity is connected. Here I only have the sample data, and nothing in it covers that yet.`;
    return body;
  }

  /* ---------- render ---------- */
  function row(a, lead) {
    const p = preview(a); const on = a.id === (VS.tmAgent || 'coo'); const dot = unread(a, p);
    return `<button class="tx-row${lead ? ' tx-lead' : ''}${on ? ' is-on' : ''}" data-action="tm-pick" data-agent="${a.id}" ${on ? 'aria-current="true"' : ''}>
      ${mascot(a.id, lead ? 48 : 38)}<span class="tx-row-t"><span class="tx-row-n"><b>${esc(M.name(a.id))}</b><span>${esc(a.name)}</span>${a.runs === 'grok' ? '<span class="tx-tag">Grok</span>' : ''}${p.at ? `<time>${esc(ago(p.at))}</time>` : ''}</span>
      <span class="tx-row-p${p.faint ? ' faint' : ''}">${esc(p.text)}</span></span>${dot ? '<span class="tx-dot" aria-label="New"></span>' : ''}</button>`;
  }
  function list() {
    const f = String(VS.tmFind || '').toLowerCase();
    const match = (a) => !f || (M.name(a.id) + ' ' + a.name + ' ' + a.job).toLowerCase().includes(f);
    const rest = T.list.filter((a) => !a.lead && match(a));
    return `<aside class="tx-list" aria-label="Agents">
      <div class="tx-list-h"><h1>AI Team</h1><button class="btn icon ghost" data-action="tm-find" aria-label="Find an agent">${icon('search')}</button></div>
      ${VS.tmFindOn ? `<label class="tx-find"><input type="search" data-tmfind placeholder="Find an agent" value="${esc(VS.tmFind || '')}" autocomplete="off"></label>` : ''}
      ${match(T.get('coo')) ? row(T.get('coo'), true) : ''}
      <div class="tx-rows">${rest.map((a) => row(a)).join('') || '<p class="muted tx-none">No agent matches that.</p>'}</div>
    </aside>`;
  }
  // What the agent used for this reply: one quiet line, with Undo next to anything it changed.
  function used(m, i) {
    const acts = (m.actions || []).filter((x) => x && x.label); if (!acts.length) return '';
    const seen = new Set(); const items = [];
    for (const x of acts) { const k = x.label + (x.change_id || ''); if (seen.has(k)) continue; seen.add(k);
      items.push(`<li class="${x.ok === false ? 'is-no' : ''}">${esc(x.label)}${x.ok === false ? ' <span class="meta">(not done)</span>' : ''}${x.change_id ? (x.undone ? ' <span class="meta">Undone</span>' : ` <button class="tx-undo" data-action="tm-undo" data-i="${i}" data-id="${esc(x.change_id)}">Undo</button>`) : ''}</li>`); }
    return `<details class="tx-used"${acts.some((x) => x.undone) ? ' open' : ''}><summary>${icon('bolt')}<span>Used ${items.length} ${items.length === 1 ? 'tool' : 'tools'}</span></summary><ul>${items.join('')}</ul></details>`;
  }
  function connCard(c, i) {
    return `<div class="tx-confirm tx-connreq"><p><b>Run ${esc(c.title || c.tool)} on ${esc(c.name)}?</b> ${c.why ? esc(c.why) + ' ' : ''}You check the exact inputs before it runs once.</p><div class="tx-act"><button class="btn sm" data-action="tm-conn" data-i="${i}">${icon('external')}Review and run</button></div></div>`;
  }
  function bubble(a, m, i) {
    if (m.role === 'user') return `<div class="tx-msg is-me"><div class="tx-b">${esc(m.body).replace(/\n/g, '<br>')}${window.ChatAttach ? window.ChatAttach.sent(m.files) : ''}</div></div>`;
    const body = m.error ? `<p class="neg">${esc(m.body)}</p>` : window.ChatOS ? window.ChatOS.md(m.body, []) : esc(m.body);
    return `<div class="tx-msg">${mascot(a.id, 30)}<div class="tx-b">${body}${used(m, i)}${m.connection ? connCard(m.connection, i) : ''}${m.proposal ? `<div class="tx-act"><button class="btn sm" data-action="tm-inchat" data-i="${i}">${icon('arrow')}Review routine in AI Chat</button></div>` : ''}</div></div>`;
  }
  function grokLog(a) {
    const G = window.Grok; const st = G ? G.state() : { loaded: false };
    const out = (a.runs === 'grok' ? grokTasks(a.id) : []).slice().reverse().map((t) => {
      const pill = { sent: ['Sent', 'acc'], started: ['Working', 'warn'], done: ['Done', 'pos'], needs_you: ['Needs you', 'warn'], failed: ['Failed', 'neg'], cancelled: ['Cancelled', 'out'], draft: ['Draft', 'out'] }[t.status] || [t.status, 'out'];
      const links = (t.links || []).filter((l) => /^https:\/\//.test(l.url || '')).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${icon('arrow')}${esc(l.label || l.url)}</a></li>`).join('');
      const said = t.summary ? window.ChatOS ? window.ChatOS.md(t.summary, []) : esc(t.summary) : `<p class="muted">${t.status === 'started' ? 'Working on it in Grok Bot.' : t.status === 'sent' ? 'Got it. Starting in Grok Bot.' : ''}</p>`;
      return `<div class="tx-msg is-me"><div class="tx-b"><b>${esc(t.title)}</b>${t.instruction && t.instruction !== t.title ? '<br>' + esc(String(t.instruction).slice(0, 600)).replace(/\n/g, '<br>') : ''}</div></div>
        <div class="tx-msg">${mascot(a.id, 30)}<div class="tx-b"><p class="tx-st"><span class="pill ${pill[1]}">${esc(pill[0])}</span><span class="meta">${esc(ago(t.updated_at || t.created_at))}</span></p>${said}${links ? `<ul class="gk-links">${links}</ul>` : ''}
          ${t.status === 'needs_you' ? `<div class="tx-act"><button class="btn sm" data-action="tm-answer" data-id="${esc(t.id)}">Answer</button><button class="btn sm ghost" data-action="grok-close" data-id="${esc(t.id)}" data-status="done">Mark done</button></div>` : ''}
          ${t.status === 'failed' ? `<div class="tx-act"><button class="btn sm" data-action="grok-resend" data-id="${esc(t.id)}">Send again</button></div>` : ''}</div></div>`;
    }).join('');
    const p = S.pending[a.id];
    const confirm = p ? `<div class="tx-msg">${mascot(a.id, 30)}<form class="tx-b tx-confirm" data-tmgrok>
        <p><b>Send this to Grok Bot?</b> ${esc(M.name(p.target || a.id))} does the work in Grok and reports back here. Nothing goes out until you press Send.</p>
        <label class="field"><span>Title</span><input name="title" value="${esc(p.title)}" maxlength="140" required></label>
        <label class="field"><span>Instruction</span><textarea name="instruction" rows="4" required>${esc(p.instruction)}</textarea></label>
        ${p.error ? `<p class="neg">${esc(p.error)}</p>` : ''}
        <div class="tx-act"><button class="btn primary sm" ${p.sending ? 'disabled' : ''}>${p.sending ? U.spin + 'Sending' : icon('send') + 'Send to Grok'}</button><button type="button" class="btn sm ghost" data-action="tm-nosend">Don\u2019t send</button></div></form></div>` : '';
    const conn = a.runs === 'grok' && st.loaded && !st.conn ? `<div class="tx-note">${icon('grok')}<span>Connect your Grok Bot routine once, then tasks you confirm here go straight to Grok.</span><button class="btn sm" data-action="grok-conn">Connect Grok Bot</button></div>` : '';
    return { html: out + confirm, tasks: out, confirm, conn, any: !!(out || confirm) };
  }
  function empty(a) {
    const starters = (a.starters || []).map((s) => `<button class="tx-start" data-action="tm-ask" data-q="${esc(s)}">${esc(s)}</button>`).join('');
    return `<div class="tx-empty">${mascot(a.id, 88)}<h2>${esc(who(a))}</h2><p>${esc(a.job)}</p>${starters ? `<div class="tx-starts">${starters}</div>` : ''}</div>`;
  }
  // Every agent reads files, the AI Coach included (it reviews the member's own copy, offers and pages).
  const canAttach = () => !!window.ChatAttach;
  window.ChatAttach?.on((k) => { if (String(k).startsWith('team:')) paint(true); });
  function center(a) {
    const head = `<header class="tx-top"><button class="tx-pill" data-action="tm-panel" aria-expanded="${VS.tmPanel !== false}" aria-label="About ${esc(who(a))}">${mascot(a.id, 24)}<span>${esc(who(a))}</span></button>
      <span class="tx-top-act">${a.runs !== 'coach' ? `<button class="btn sm ghost tx-teach" data-action="tm-teach" title="Your instructions and context for ${esc(M.name(a.id))}">${mine(a.id) ? 'Instructions on' : 'Instructions'}</button>` : ''}${messages(a).length ? `<button class="btn icon ghost tx-clear" data-action="tm-clear" aria-label="Clear chat" title="Clear chat">${icon('trash')}</button>` : ''}<button class="btn icon ghost tx-new" data-action="tm-new" aria-label="New chat" title="New chat">${icon('edit')}</button></span></header>`;
    let log = '', extra = '';
    const g = grokLog(a); if (a.runs === 'grok') extra = g.conn;
    const t = curThread(a.id);
    if (live() && t && S.msgs[t] === 'loading') log = `<p class="muted tx-wait">${U.spin}Loading</p>`;
    else { const ms = messages(a); const chat = ms.map((m, i) => bubble(a, m, i)).join(''); log = (a.runs === 'grok' ? g.tasks : '') + chat; if (!log) log = empty(a); }
    if (S.busy === a.id) log += `<div class="tx-msg">${mascot(a.id, 30)}<div class="tx-b tx-typing" aria-label="${esc(M.name(a.id))} is working"><i></i><i></i><i></i></div></div>`;
    log += g.confirm;
    const busy = S.busy === a.id || (S.pending[a.id] && S.pending[a.id].sending);
    return `<section class="tx-main">${head}<div class="tx-log" data-txlog>${log}</div>
      <form class="tx-compose" data-tmform${canAttach(a) ? ` data-ca-key="team:${esc(a.id)}"` : ''}>${extra}${canAttach(a) ? window.ChatAttach.chips('team:' + a.id) : ''}<div class="tx-box">${canAttach(a) ? window.ChatAttach.button('team:' + a.id, busy) : ''}<textarea name="q" rows="1" placeholder="Message ${esc(who(a))}" aria-label="Message ${esc(who(a))}">${esc(S.draft[a.id] || '')}</textarea>
      ${a.runs === 'grok' ? `<button type="button" class="btn icon ghost" data-action="tm-togrok" aria-label="Hand this message to Grok Bot" title="Hand to Grok Bot">${icon('grok')}</button>` : ''}<button class="btn primary icon" aria-label="Send" ${busy ? 'disabled' : ''}>${icon('send')}</button></div>
      ${a.runs === 'grok' ? `<p class="meta tx-hint">Work that needs Grok Bot comes back as a card you send yourself.</p>` : a.private ? '<p class="meta tx-hint">Private to you.</p>' : ''}</form></section>`;
  }
  function panel(a) {
    if (VS.tmPanel === false) return '';
    const tab = VS.tmTab === 'chats' ? 'chats' : VS.tmTab === 'tasks' && a.runs === 'grok' ? 'tasks' : 'about';
    const chips = (a.screens || []).map(([v, l]) => `<a class="tx-chip" href="#${esc(v)}">${esc(l)}</a>`).join('');
    const starters = (a.starters || []).map((s) => `<button class="tx-sug" data-action="tm-ask" data-q="${esc(s)}"><span>${esc(s)}</span>${icon('arrow')}</button>`).join('');
    const where = a.runs === 'grok' ? 'Works inside Founders AI OS, and in Grok Bot for outside work you confirm. Grok reports back here.' : a.runs === 'code' ? 'Works inside Founders AI OS, and in Claude Code or Codex through AI access for full builds.' : a.runs === 'coach' ? 'Coaching from the approved Playbook and the teaching library.' : 'Works inside Founders AI OS, with your Brain, offers, recordings, research and connections.';
    const s = mine(a.id);
    const teach = a.runs === 'coach' ? '' : `<h3>Your instructions</h3>${s ? `<p class="tx-mine">${esc(String(s.instructions || s.context).slice(0, 220))}${String(s.instructions || s.context).length > 220 ? '\u2026' : ''}</p>${s.instructions && s.context ? '<p class="meta">Plus context you added.</p>' : ''}` : `<p class="tx-where">Tell ${esc(M.name(a.id))} how you want the work done, or give it context only it needs.</p>`}<button class="btn sm" data-action="tm-teach">${icon('edit')}${s ? 'Edit instructions' : 'Add instructions'}</button>`;
    const can = a.runs === 'coach' ? '' : `<h3>Can do</h3><ul class="tx-can">${CAN.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const code = a.runs === 'code' ? (() => { const G = window.Grok; const mcp = (G && G.MCP) || location.origin + '/api/mcp';
      return `<h3>Claude Code and Codex</h3><p class="tx-where">Add Founders AI OS as a connector with this URL and a token from AI access.</p><div class="code-row"><code>${esc(mcp)}?key=YOUR_TOKEN</code><button class="btn sm" data-action="grok-copy" data-v="${esc(mcp)}?key=">Copy</button></div><div class="tx-act"><a class="btn sm" href="#mcp">${icon('mcp')}AI access</a></div>`; })() : '';
    let body;
    if (tab === 'about') {
      body = `<p class="tx-job">${esc(a.job)}</p>
        ${chips ? `<h3>Works in</h3><div class="tx-chips">${chips}</div>` : ''}
        ${starters ? `<h3>Suggested</h3><div class="tx-sugs">${starters}</div>` : ''}
        ${teach}${can}
        <h3>Runs in</h3><p class="tx-where">${esc(where)}</p>${code}
        ${a.runs === 'grok' ? `<button class="btn sm" data-action="grok-conn">${icon('grok')}${window.Grok && window.Grok.connected() ? 'Grok Bot settings' : 'Connect Grok Bot'}</button>` : ''}`;
    } else if (a.runs === 'grok' && tab === 'tasks') {
      const ts = grokTasks(a.id);
      body = ts.length ? `<ul class="tx-threads">${ts.map((t) => `<li><span class="tx-th">${esc(t.title)}</span><span class="meta">${esc(ago(t.updated_at || t.created_at))}</span></li>`).join('')}</ul>${live() ? `<button class="btn sm ghost" data-action="tm-refresh">${icon('refresh')}Refresh</button>` : ''}` : '<p class="muted">No tasks yet.</p>';
    } else {
      const ts = live() ? S.threads.filter((t) => t.agent === a.id) : (S.demo[a.id] || []).length ? [{ id: 'demo', title: (S.demo[a.id][0] || {}).body, updated_at: (S.demo[a.id].slice(-1)[0] || {}).at }] : [];
      const cur = curThread(a.id) || (live() ? null : 'demo');
      body = `<button class="btn sm" data-action="tm-new">${icon('plus')}New chat</button>${ts.length ? `<ul class="tx-threads">${ts.map((t) => `<li><button data-action="tm-thread" data-id="${esc(t.id)}" ${t.id === cur ? 'aria-current="true"' : ''}><span class="tx-th">${esc(t.title || 'Chat')}</span><span class="meta">${esc(ago(t.updated_at))}</span></button></li>`).join('')}</ul>${ts.length > 1 ? `<button class="btn sm ghost tx-clear-all" data-action="tm-clear" data-all="1">${icon('trash')}Clear all chats</button>` : ''}` : '<p class="muted">No chats yet.</p>'}`;
    }
    return `<aside class="tx-side" aria-label="About ${esc(who(a))}"><button class="btn icon ghost tx-x" data-action="tm-panel" aria-label="Close">${icon('close')}</button>
      <div class="tx-id">${mascot(a.id, 84)}<h2>${esc(M.name(a.id))}</h2><p>${esc(a.name)}${a.private ? ' · Private' : ''}</p></div>
      <div class="tx-tabs" role="tablist"><button role="tab" aria-selected="${tab === 'about'}" data-action="tm-tab" data-v="about">About</button><button role="tab" aria-selected="${tab === 'chats'}" data-action="tm-tab" data-v="chats">Chats</button>${a.runs === 'grok' ? `<button role="tab" aria-selected="${tab === 'tasks'}" data-action="tm-tab" data-v="tasks">Grok</button>` : ''}</div>
      <div class="tx-tab">${body}</div></aside>`;
  }
  function shell() {
    const a = agent();
    return `<div class="tx${VS.tmPanel === false ? '' : ' has-side'}${VS.tmMobile === 'chat' ? ' on-chat' : ''}" data-tx>${list()}<div class="tx-center">${VS.tmMobile === 'chat' ? `<button class="btn sm ghost tx-back" data-action="tm-back">${icon('arrow')}All agents</button>` : ''}${center(a)}</div>${panel(a)}</div>`;
  }

  function view() {
    scope(); if (!VS.tmAgent || !T.get(VS.tmAgent)) VS.tmAgent = 'coo';
    if (VS.tmPanel === undefined) VS.tmPanel = window.innerWidth > 1180;
    load();
    setTimeout(() => { after(); openThread(); }, 0);
    markSeen(VS.tmAgent);
    return shell();
  }
  function after(keepFocus) {
    const log = document.querySelector('[data-txlog]'); if (log) log.scrollTop = log.scrollHeight;
    const ta = document.querySelector('[data-tmform] textarea'); if (ta) { grow(ta); if (keepFocus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  }
  function paint(keepFocus) {
    if (VS.view !== 'team') return;
    const root = document.querySelector('[data-tx]'); if (!root) return;
    const had = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-tmform]');
    const tmp = document.createElement('div'); tmp.innerHTML = shell(); root.replaceWith(tmp.firstElementChild);
    after(keepFocus || had);
  }
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; };
  V.team = view; V.team.live = view; V.team.after = () => after();

  /* ---------- sending ---------- */
  async function send(q) {
    const a = agent(); q = String(q || '').trim();
    if (S.busy) return;
    const CA = canAttach(a) ? window.ChatAttach : null; const k = 'team:' + a.id;
    if (CA && CA.busy(k)) { U.toast('Still reading your files. Send again in a moment.'); return; }
    const files = CA ? CA.payload(k) : null;
    if (!q && files) q = files.length === 1 ? 'Look at the attached file.' : 'Look at the attached files.';
    if (!q) return;
    if (files) CA.clear(k);
    const sentFiles = files ? files.map((f) => ({ name: f.name, kind: f.kind })) : null;
    S.draft[a.id] = ''; S.busy = a.id;
    if (!live()) {
      (S.demo[a.id] = S.demo[a.id] || []).push({ role: 'user', body: q, files: sentFiles, at: new Date().toISOString() }); paint(true);
      await new Promise((r) => setTimeout(r, 600));
      S.demo[a.id].push({ role: 'assistant', body: demoReply(a, q) + (files ? '\n\nDemo workspace: files are read in your live workspace, where your AI works from them.' : ''), at: new Date().toISOString(), actions: a.runs === 'coach' ? [] : demoActions(q) });
      S.busy = null; markSeen(a.id); paint(true); return;
    }
    let t = curThread(a.id); if (t && !Array.isArray(S.msgs[t])) S.msgs[t] = [];
    const local = t ? S.msgs[t] : []; local.push({ role: 'user', body: q, files: sentFiles, at: new Date().toISOString() });
    if (!t) { S.msgs.__new = local; S.newFor = a.id; }
    paint(true);
    try {
      const r = await api(a.runs === 'coach' ? 'coach' : 'ask', { q, thread_id: t || undefined, agent: a.id, ...(files ? { files } : {}) });
      const reply = { role: 'assistant', body: r.answer || '', at: new Date().toISOString(), proposal: !!(r.program_proposal || r.agent_proposal), actions: r.actions || [], connection: r.connection || null };
      if (r.grok && r.grok.title) S.pending[a.id] = { title: r.grok.title, instruction: r.grok.instruction || r.grok.title, target: r.grok.agent };
      if (r.notice) reply.body += '\n\n' + r.notice;
      local.push(reply);
      if (!t && r.thread_id) { t = r.thread_id; S.msgs[t] = local; delete S.msgs.__new; S.newFor = null; S.cur[a.id] = t; S.threads.unshift({ id: t, title: q.slice(0, 80), agent: a.id, updated_at: reply.at }); }
      else { const th = S.threads.find((x) => x.id === t); if (th) th.updated_at = reply.at; }
      S.last[a.id] = { thread_id: t, body: plain(reply.body).slice(0, 140), at: reply.at };
    } catch (e) { local.push({ role: 'assistant', body: e.message || 'That did not go through.', error: true, at: null }); if (!t) S.cur[a.id] = null; }
    S.busy = null; markSeen(a.id); paint(true);
  }

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-tmform]'); if (!f) return; e.preventDefault();
    const ta = f.querySelector('textarea'); const q = ta.value; const k = f.dataset.caKey; if (!q.trim() && !(k && window.ChatAttach?.has(k))) return; ta.value = ''; send(q);
  }, true);
  document.addEventListener('keydown', (e) => {
    const ta = e.target.closest && e.target.closest('[data-tmform] textarea'); if (!ta || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault(); ta.form.requestSubmit();
  });
  document.addEventListener('input', (e) => {
    const ta = e.target.closest && e.target.closest('[data-tmform] textarea'); if (ta) { S.draft[agent().id] = ta.value; grow(ta); return; }
    const fi = e.target.closest && e.target.closest('[data-tmfind]'); if (fi) { VS.tmFind = fi.value; const pos = fi.selectionStart; paint(); const n = document.querySelector('[data-tmfind]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  // Confirmed Grok task.
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-tmgrok]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const a = agent(); const p = S.pending[a.id]; if (!p || p.sending) return;
    const v = Object.fromEntries(new FormData(f)); Object.assign(p, { title: String(v.title || '').trim(), instruction: String(v.instruction || '').trim(), sending: true, error: '' }); paint();
    try {
      const G = window.Grok; let t;
      const to = p.target || (a.runs === 'grok' ? a.id : 'automations');
      if (live()) t = await window.Auth.inboxApi('grok-send', { workspace_id: wsId(), title: p.title, instruction: p.instruction, agent: to });
      else { await new Promise((r) => setTimeout(r, 400)); const now = new Date().toISOString(); t = { id: 'demo-' + Date.now(), agent: to, title: p.title, instruction: p.instruction, status: 'sent', summary: null, links: [], updates: [], sent_at: now, created_at: now, updated_at: now };
        setTimeout(() => { const x = G && G.state().tasks.find((y) => y.id === t.id); if (x) { Object.assign(x, { status: 'done', summary: 'Demo workspace: in your workspace Grok Bot does the work and its report lands here.', updated_at: new Date().toISOString() }); paint(); } }, 2500); }
      if (G) G.state().tasks.unshift(t);
      delete S.pending[a.id]; U.toast('Sent to Grok Bot'); if (live() && G) setTimeout(() => G.load(true), 20000);
    } catch (ex) { Object.assign(p, { sending: false, error: ex.message || 'That did not go through' }); }
    paint();
  }, true);

  /* ---------- actions ---------- */
  ACT['tm-pick'] = (el) => { VS.tmAgent = el.dataset.agent; VS.tmTab = 'about'; VS.tmMobile = 'chat'; if (window.innerWidth <= 1180) VS.tmPanel = false; markSeen(VS.tmAgent); paint(); openThread(); };
  ACT['tm-back'] = () => { VS.tmMobile = 'list'; paint(); };
  ACT['tm-panel'] = () => { VS.tmPanel = VS.tmPanel === false; paint(); };
  ACT['tm-tab'] = (el) => { VS.tmTab = el.dataset.v; paint(); };
  ACT['tm-find'] = () => { VS.tmFindOn = !VS.tmFindOn; if (!VS.tmFindOn) VS.tmFind = ''; paint(); const n = document.querySelector('[data-tmfind]'); if (n) n.focus(); };
  ACT['tm-ask'] = (el) => send(el.dataset.q);
  // The founder's own instructions and context for one agent. Saved per workspace; the agent follows them over its defaults.
  ACT['tm-teach'] = async () => {
    const a = agent(); if (a.runs === 'coach') return; const s = S.mine[a.id] || {};
    const v = await U.dialog({ title: `Instructions for ${M.name(a.id)}`, body: `${esc(M.name(a.id))} follows these in every chat, after the house rules. Leave both empty to go back to the defaults.`,
      fields: [{ name: 'instructions', label: 'How to work', type: 'textarea', rows: 6, value: s.instructions || '', placeholder: 'For example: Always end with one next step. Keep reports under 200 words. Check the Newsfeed before suggesting new ideas.' },
        { name: 'context', label: 'Context only this agent needs', type: 'textarea', rows: 7, value: s.context || '', placeholder: 'For example: This quarter the focus is the membership launch. My assistant handles refunds.' }], ok: 'Save' });
    if (!v) return;
    const instructions = String(v.instructions || '').trim().slice(0, 8000), context = String(v.context || '').trim().slice(0, 20000);
    try {
      if (live()) { const r = await api('team_save', { agent: a.id, instructions, context }); if (r.settings) S.mine[a.id] = r.settings; else delete S.mine[a.id]; }
      else { if (instructions || context) S.mine[a.id] = { agent_id: a.id, instructions, context, updated_at: new Date().toISOString() }; else delete S.mine[a.id]; try { localStorage.setItem('fos-tm-mine:' + S.key, JSON.stringify(S.mine)); } catch (e) { /* private mode */ } }
      U.toast(instructions || context ? 'Instructions saved' : 'Back to defaults'); paint();
    } catch (e) { U.toast(e.message || 'That did not save'); }
  };
  ACT['tm-undo'] = async (el) => {
    const a = agent(); const ms = messages(a); const m = ms[+el.dataset.i]; const x = m && (m.actions || []).find((y) => y.change_id === el.dataset.id); if (!x) return;
    el.disabled = true;
    try { if (live()) await api('team_undo', { change_id: x.change_id }); x.undone = true; U.toast('Change undone'); paint(); }
    catch (e) { el.disabled = false; U.toast(e.message || 'That change could not be undone'); }
  };
  ACT['tm-conn'] = (el) => {
    const m = messages(agent())[+el.dataset.i]; const c = m && m.connection; if (!c) return;
    if (!live()) { U.toast('Demo workspace: your own MCP connections run from Connections.'); return; }
    const C = window.CustomConnections; if (C && C.operate) C.operate(c.id, 'tool', c.tool, c.arguments || {}); else { VS.cxMode = 'custom'; location.hash = '#connect'; }
  };
  ACT['tm-togrok'] = () => {
    const a = agent(); const ta = document.querySelector('[data-tmform] textarea'); const q = String((ta && ta.value) || S.draft[a.id] || '').trim();
    if (!q) { U.toast('Write the task first'); return; }
    const first = q.split(/[.\n]/)[0].trim();
    S.pending[a.id] = { title: (first.length > 90 ? first.slice(0, 88).replace(/\s+\S*$/, '') : first).replace(/^./, (c) => c.toUpperCase()), instruction: q, target: a.id };
    S.draft[a.id] = ''; paint();
  };
  ACT['tm-new'] = () => { const a = agent(); S.cur[a.id] = null; if (S.newFor === a.id) { S.newFor = null; delete S.msgs.__new; } if (!live()) S.demo[a.id] = []; VS.tmTab = 'about'; paint(true); };
  // Clear the open conversation, or every conversation with this agent. Asks first; nothing the agent saved is removed.
  ACT['tm-clear'] = async (el) => {
    const a = agent(); const all = el.dataset.all === '1'; const name = M.name(a.id);
    if (S.busy === a.id) { U.toast(`Wait for ${name} to finish first`); return; }
    const t = live() ? curThread(a.id) : null;
    const n = live() ? S.threads.filter((x) => x.agent === a.id).length : 1;
    if (!all && !messages(a).length) return;
    const v = await U.dialog({ title: all ? `Clear all chats with ${name}?` : `Clear this chat with ${name}?`,
      body: `${all ? `All ${n} chats with ${esc(name)} are deleted for good.` : 'The messages in this chat are deleted for good.'} Anything ${esc(name)} already saved in your OS stays.`, ok: all ? 'Clear all chats' : 'Clear chat', danger: true });
    if (!v) return;
    try {
      if (live()) {
        if (all || t) {
          await api('team_clear', all ? { agent: a.id, all: true } : { agent: a.id, thread_id: t });
          const gone = S.threads.filter((x) => x.agent === a.id && (all || x.id === t)).map((x) => x.id);
          S.threads = S.threads.filter((x) => !gone.includes(x.id)); gone.forEach((id) => delete S.msgs[id]);
          if (S.last[a.id] && (all || S.last[a.id].thread_id === t)) delete S.last[a.id];
        }
        if (S.newFor === a.id) { S.newFor = null; delete S.msgs.__new; }
        S.cur[a.id] = null;
      } else S.demo[a.id] = [];
      delete S.pending[a.id];
      U.toast(all ? 'Chats cleared' : 'Chat cleared'); paint(true);
      if (live() && !all) load(true);
    } catch (e) { U.toast(e.message || 'That chat could not be cleared'); }
  };
  ACT['tm-thread'] = (el) => { const a = agent(); if (el.dataset.id !== 'demo') S.cur[a.id] = el.dataset.id; paint(); openThread(); };
  ACT['tm-nosend'] = () => { delete S.pending[agent().id]; paint(); };
  ACT['tm-answer'] = (el) => { const a = agent(); const t = grokTasks(a.id).find((x) => x.id === el.dataset.id); if (!t) return; S.draft[a.id] = `Follow-up on "${t.title}" (task ${t.id}). My answer: `; paint(true); };
  ACT['tm-inchat'] = () => { const t = curThread(agent().id); if (!t) return; Object.assign(VS, { chRoom: false, chCoach: false, chFunnel: false, chThread: t }); location.hash = '#chat'; };
  ACT['tm-refresh'] = () => window.Grok?.load(true);
  // Kept for other screens that link a Grok handoff straight into this messenger.
  ACT['tm-hand'] = (el) => { VS.tmAgent = T.get(el.dataset.agent) ? el.dataset.agent : 'automations'; VS.tmMobile = 'chat'; if (VS.view !== 'team') location.hash = '#team'; else paint(true); };

  document.addEventListener('visibilitychange', () => { if (!document.hidden && VS.view === 'team' && live()) load(true); });
  window.TeamChat = { state: () => S, paint, send };
})();

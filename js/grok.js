// Grok Bot handoffs. The founder asks in AI Chat ("add this in HighLevel"), checks the task card and presses Send to Grok.
// The OS posts it to the founder's own Grok Bot routine webhook. Grok builds it and reports back through the
// Founders AI OS MCP connector (grok_task_update), and the result shows in AI Chat and on the AI Team page.
// Nothing is sent without the founder pressing Send.
(() => {
  const U = window.UI, ACT = window.ACT, VS = window.VS, { esc, icon } = U;
  const live = () => !!window.App?.isLive(), ws = () => window.App?.liveCtx().ws?.id, key = () => [live() ? 'live' : 'demo', ws()].join(':');
  const api = (action, body = {}) => window.Auth.inboxApi(action, { workspace_id: ws(), ...body });
  const S = { key: null, loaded: false, loading: false, conn: null, tasks: [], err: '', timer: null };
  const MCP = (location.protocol.startsWith('http') ? location.origin : 'https://your-app.vercel.app') + '/api/mcp';
  // One standing instruction so Grok sends what it makes without being asked each time.
  const STANDING = 'Every time you make a PDF, graphic, piece of copy or content for me, call grok_deliver in the Founders AI OS connector right after, with the type, a title, the full text and a public https link to any file or image. Do this on your own, every time. If it came from a Founders OS task, include the task_id.';

  const AGENTS = {
    automations: { name: 'Automations', note: 'Builds in HighLevel and your other software' },
    support: { name: 'Support', note: 'Checks inboxes and drafts replies' },
    qa: { name: 'QA', note: 'Scans projects and gives feedback' },
    accounting: { name: 'Accounting', note: 'Files receipts and invoices' },
  };
  const STATUS = { draft: ['Draft', 'out'], sent: ['Sent', 'acc'], started: ['Working', 'warn'], done: ['Done', 'pos'], failed: ['Failed', 'neg'], needs_you: ['Needs you', 'warn'], cancelled: ['Cancelled', 'out'] };
  const pill = (s) => { const [l, c] = STATUS[s] || [s, 'out']; return `<span class="pill ${c} gk-pill">${esc(l)}</span>`; };

  /* ---------- state ---------- */
  function scope() { const k = key(); if (S.key !== k) { Object.assign(S, { key: k, loaded: false, loading: false, conn: null, tasks: [], err: '' }); } return k; }
  async function load(force = false) {
    const k = scope(); if (S.loading || (S.loaded && !force)) return; S.loading = true;
    try {
      if (live()) { const r = await api('grok-status'); if (k !== key()) return; S.conn = r.connection; S.tasks = r.tasks || []; }
      else if (!S.loaded) { S.conn = { account_label: 'Founders OS tasks', meta: { host: 'sample' }, demo: true }; S.tasks = demoTasks(); }
      S.loaded = true; S.err = '';
    } catch (e) { if (k === key()) { S.err = e.message || 'Could not load Grok tasks'; S.loaded = true; } }
    finally { if (k === key()) { S.loading = false; refresh(); poll(); } }
  }
  const open = () => S.tasks.filter((t) => ['sent', 'started', 'needs_you'].includes(t.status));
  // While something is out with Grok and the founder is looking, check every 20 seconds for the report back.
  function poll() {
    clearTimeout(S.timer);
    if (!live() || !open().length) return;
    S.timer = setTimeout(() => { if (['chat', 'team'].includes(VS.view) && !document.hidden) load(true); else poll(); }, 20000);
  }
  function refresh() { if (['chat', 'team', 'connect'].includes(VS.view)) window.App.render(true); }
  const task = (id) => S.tasks.find((t) => t.id === id);

  function demoTasks() {
    const h = 3600e3, now = Date.now(), iso = (d) => new Date(now - d).toISOString();
    return [
      { id: 'demo-g1', agent: 'automations', title: 'Build the $27 AI Bundle order form in HighLevel', instruction: 'Create a one-step order form for the $27 AI Starter Bundle with the Reply Scripts order bump at $17.', status: 'done', summary: 'Built the order form and order bump in the Northpeak Studio sub-account. Product, price and bump are set. Nothing is published yet.', links: [{ label: 'Order form in HighLevel', url: 'https://app.gohighlevel.com/' }], updates: [], sent_at: iso(26 * h), created_at: iso(26 * h), updated_at: iso(25 * h) },
      { id: 'demo-g2', agent: 'support', title: 'Draft replies to support emails from this week', instruction: 'Read the support inbox and draft replies for anything older than a day. Leave every reply as a draft.', status: 'needs_you', summary: 'Two people asked for a refund after 30 days. Should I offer store credit or decline?', links: [], updates: [], sent_at: iso(5 * h), created_at: iso(5 * h), updated_at: iso(4 * h) },
      { id: 'demo-g3', agent: 'qa', title: 'Check the Founder Snapshot funnel on mobile', instruction: 'Open every page of the Founder Snapshot funnel on a phone-sized screen and list anything broken.', status: 'started', summary: null, links: [], updates: [], sent_at: iso(0.4 * h), created_at: iso(0.4 * h), updated_at: iso(0.3 * h) },
    ];
  }

  /* ---------- turning a chat request into a task ---------- */
  // Explicit asks only: "@grok ...", "send to grok", or a build verb aimed at HighLevel.
  const INTENT = [/^@?grok\b/i, /\b(send|hand|give)\s+(this\s+|it\s+)?(to|over to)\s+grok\b/i, /\b(add|build|create|set ?up|make|put|wire|connect|install|update)\b[\s\S]{0,140}\b(in|into|inside|on|to)\s+(my\s+)?(high ?level|ghl)\b/i];
  const intent = (q) => INTENT.some((r) => r.test(String(q || '')));
  function guessAgent(q) {
    if (/\b(receipt|invoice|expense|bookkeep|accounting)\b/i.test(q)) return 'accounting';
    if (/\b(support|inbox|reply|replies|customer email|refund)\b/i.test(q)) return 'support';
    if (/\b(qa|test|check|audit|review|scan|broken|bug)\b/i.test(q) && !/\b(build|create|add|set ?up)\b/i.test(q)) return 'qa';
    return 'automations';
  }
  function draft(q, previous) {
    const ask = String(q || '').replace(/^@?grok[:,]?\s*/i, '').trim();
    const first = ask.split(/[.\n]/)[0].trim();
    const title = (first.length > 90 ? first.slice(0, 88).replace(/\s+\S*$/, '') : first).replace(/^./, (c) => c.toUpperCase()) || 'Task for Grok';
    const ctx = previous && /\b(this|that|it|these|above)\b/i.test(ask) ? String(previous).replace(/\[(\d+)\]/g, '').trim().slice(0, 2500) : '';
    const instruction = ask + (ctx ? '\n\nWhat "this" refers to, from my Founders AI OS chat:\n' + ctx : '');
    return { title, instruction, agent: guessAgent(ask), state: 'draft' };
  }

  /* ---------- chat card ---------- */
  function chatCard(m, mi) {
    const g = m.grok; const t = g.task_id ? task(g.task_id) : null;
    const head = `<p class="rm-label meta">Grok Bot · ${esc((AGENTS[g.agent] || AGENTS.automations).name)} agent</p>`;
    if (g.state === 'sent' || g.state === 'cancelled') {
      const st = t ? t.status : g.state === 'cancelled' ? 'cancelled' : 'sent';
      const body = g.state === 'cancelled' ? '<p class="muted">Not sent. Nothing went to Grok.</p>'
        : `<h3 class="gk-title">${esc(t ? t.title : g.title)}</h3>${resultHtml(t || { status: 'sent' })}`;
      return `<div class="ch-msg ai gk-msg"><div class="ch-avatar" aria-hidden="true">${icon('grok')}</div><div class="ch-body">${head}<div class="gk-card is-sent">${g.state === 'cancelled' ? '' : `<div class="gk-row">${pill(st)}<span class="meta">${t && t.updated_at ? 'Updated ' + ago(t.updated_at) : ''}</span></div>`}${body}</div></div></div>`;
    }
    const conn = S.conn; const busy = g.state === 'sending';
    const setup = !conn && S.loaded ? `<p class="meta gk-warn">${icon('alert')}<span>Grok Bot is not connected yet. <button class="linkish" type="button" data-action="grok-conn">Connect Grok Bot</button> first, then send.</span></p>` : '';
    return `<div class="ch-msg ai gk-msg"><div class="ch-avatar" aria-hidden="true">${icon('grok')}</div><div class="ch-body">${head}
      <form class="gk-card" data-gkform data-m="${mi}">
        <p class="muted gk-lead">Check the task, then send it. Grok builds it in your accounts and reports back here when it is done.</p>
        <label class="field"><span>Task</span><input name="title" value="${esc(g.title)}" maxlength="160" ${busy ? 'disabled' : ''}></label>
        <label class="field"><span>What Grok should do</span><textarea name="instruction" rows="5" maxlength="8000" ${busy ? 'disabled' : ''}>${esc(g.instruction)}</textarea></label>
        <label class="field gk-agent"><span>Agent</span><select name="agent" ${busy ? 'disabled' : ''}>${Object.entries(AGENTS).map(([k, a]) => `<option value="${k}" ${g.agent === k ? 'selected' : ''}>${esc(a.name)}: ${esc(a.note)}</option>`).join('')}</select></label>
        <p class="meta gk-rules">Grok reads your offers, prices and voice from the Founders AI OS connector. It leaves emails and messages as drafts and never reads HighLevel conversations.</p>
        ${g.error ? `<p class="auth-msg">${esc(g.error)}</p>` : ''}${setup}
        <div class="row-actions"><button class="btn primary" type="submit" ${busy || (!conn && S.loaded) ? 'disabled' : ''}>${busy ? U.spin + 'Sending' : icon('send') + 'Send to Grok'}</button><button class="btn ghost" type="button" data-action="grok-cancel" data-m="${mi}" ${busy ? 'disabled' : ''}>Don't send</button></div>
      </form></div></div>`;
  }
  function resultHtml(t) {
    const st = t.status;
    const note = st === 'sent' ? 'Grok Bot started the run. The result shows here when Grok reports back.' : st === 'started' ? 'Grok is working on it.' : '';
    return `${t.summary ? `<p class="gk-summary">${esc(t.summary).replace(/\n/g, '<br>')}</p>` : note ? `<p class="muted">${note}</p>` : ''}
      ${t.send_error ? `<p class="auth-msg">${esc(t.send_error)}</p>` : ''}
      ${(t.links || []).length ? `<ul class="gk-links">${t.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${icon('external')}<span>${esc(l.label || l.url)}</span></a></li>`).join('')}</ul>` : ''}`;
  }
  const ago = (t) => { const m = Math.max(0, (Date.now() - new Date(t)) / 6e4); if (m < 1) return 'just now'; if (m < 60) return Math.round(m) + 'm ago'; if (m < 1440) return Math.round(m / 60) + 'h ago'; return Math.round(m / 1440) + 'd ago'; };

  /* ---------- handoff list (AI Team page) ---------- */
  function list({ limit = 12 } = {}) {
    if (!S.loaded) return `<p class="muted">${U.spin}Loading handoffs</p>`;
    if (S.err) return `<p class="auth-msg">${esc(S.err)}</p>`;
    if (!S.tasks.length) return `<p class="muted gk-none">Nothing handed to Grok yet. In AI Chat, ask for something like "add this in HighLevel" and confirm the task card.</p>`;
    return `<ol class="gk-list">${S.tasks.slice(0, limit).map((t) => `<li class="gk-item">
      <div class="gk-row">${pill(t.status)}<span class="meta">${esc((AGENTS[t.agent] || { name: 'Grok' }).name)} · ${esc(ago(t.updated_at || t.created_at))}</span></div>
      <details><summary><b>${esc(t.title)}</b>${icon('chevron')}</summary><p class="gk-instr">${esc(t.instruction).replace(/\n/g, '<br>')}</p></details>
      ${resultHtml(t)}
      ${['failed', 'needs_you', 'sent', 'started'].includes(t.status) ? `<div class="row-actions">${t.status === 'needs_you' ? `<button class="btn sm" data-action="grok-reply" data-id="${esc(t.id)}">Answer Grok</button>` : t.status === 'failed' ? `<button class="btn sm" data-action="grok-resend" data-id="${esc(t.id)}">Resend</button>` : ''}<button class="btn sm ghost" data-action="grok-close" data-id="${esc(t.id)}" data-status="done">Mark done</button><button class="btn sm ghost" data-action="grok-close" data-id="${esc(t.id)}" data-status="cancelled">Close</button></div>` : ''}
    </li>`).join('')}</ol>`;
  }

  /* ---------- connection drawer ---------- */
  function connDrawer() {
    const on = live() ? S.conn : null; const dis = live() ? '' : 'disabled';
    U.drawer(`<div><p class="meta">Connections · Agents</p><h2>Grok Bot</h2></div>
      ${on ? `<div class="dsec"><h3>Connected</h3><p>Routine: ${esc(on.account_label || 'Founders OS tasks')}${on.meta && on.meta.host ? ` <span class="meta">(${esc(on.meta.host)})</span>` : ''}</p><div class="actions" style="margin-top:10px"><button class="btn" data-action="grok-test">Send a test ping</button><button class="btn ghost" data-action="grok-disconnect">Disconnect</button></div></div>` : ''}
      <div class="dsec"><h3>What it does</h3><p class="muted">Your Automations, Support, QA and Accounting agents run in Grok Bot. When you confirm a task in AI Chat, Founders AI OS sends it to one routine in your Grok Bot. Grok does the work and reports back here through the Founders AI OS connector.</p></div>
      <div class="dsec"><h3>1. Create the routine in Grok Bot</h3><p class="muted">Ask Grok Bot:</p><div class="code-row wrap"><code>Create a routine called Founders OS tasks with a webhook trigger. When it runs, do the task in the instruction field of the payload, follow the rules, and report back with grok_task_update as the payload says.</code><button class="btn sm" data-action="grok-copy" data-v="Create a routine called Founders OS tasks with a webhook trigger. When it runs, do the task in the instruction field of the payload, follow the rules, and report back with grok_task_update as the payload says.">Copy</button></div><p class="meta" style="margin-top:8px">Grok Bot shows a webhook URL and a key. Paste both below.</p></div>
      <div class="dsec"><h3>2. Add the Founders AI OS connector in Grok</h3><ol class="steps"><li>Create a token under <a class="lnk" href="#mcp">AI access</a> with write access.</li><li>In Grok, open Connectors, choose New Connector, then Custom.</li><li>Paste this URL with your token at the end:</li></ol><div class="code-row"><code>${MCP}?key=YOUR_TOKEN</code><button class="btn sm" data-action="grok-copy" data-v="${MCP}?key=">Copy</button></div></div>
      <div class="dsec"><h3>3. Send everything Grok makes to the OS</h3><p class="muted">Paste this into Grok Bot's custom instructions once. Then every PDF, graphic, copy and content it makes for you shows up on the <a class="lnk" href="#grok-made">From Grok</a> page to approve.</p><div class="code-row wrap"><code>${esc(STANDING)}</code><button class="btn sm" data-action="grok-copy" data-v="${esc(STANDING)}">Copy</button></div></div>
      ${live() ? '' : '<p class="auth-msg">Demo workspace: this form is switched off. Open your private workspace to connect Grok Bot.</p>'}
      <form class="fd" data-gkconn><label class="field"><span>Routine webhook URL</span><input name="url" type="url" placeholder="https://..." autocomplete="off"></label><label class="field"><span>Webhook key</span><input name="key" type="password" autocomplete="new-password"></label><label class="field"><span>Routine name</span><input name="routine" value="Founders OS tasks" autocomplete="off"></label><div class="actions end"><button class="btn primary" ${dis}>${on ? 'Replace connection' : 'Connect Grok Bot'}</button></div></form>`, { label: 'Connect Grok Bot' });
  }
  ACT['grok-conn'] = () => { connDrawer(); if (!S.loaded) load().then(() => { if (document.querySelector('[data-gkconn]')) connDrawer(); }); };
  ACT['grok-copy'] = (el) => U.copy(el.dataset.v);
  ACT['grok-test'] = async (el) => {
    el.disabled = true; el.innerHTML = U.spin + 'Sending';
    try { await api('grok-test'); U.toast('Test sent. Grok Bot started the routine.'); } catch (e) { U.toast(e.message); }
    el.disabled = false; el.textContent = 'Send a test ping';
  };
  ACT['grok-disconnect'] = async () => {
    const ok = await U.dialog({ title: 'Disconnect Grok Bot?', body: 'Founders AI OS stops sending tasks to the routine. Tasks already sent keep running in Grok.', ok: 'Disconnect', danger: true }); if (!ok) return;
    try { await api('grok-disconnect'); S.conn = null; await window.App.reloadConns?.(); U.closeDrawer(); U.toast('Grok Bot disconnected'); window.App.render(true); } catch (e) { U.toast(e.message); }
  };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-gkconn]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    if (!live()) return U.toast('Connections go live in your private workspace, never in the demo.');
    const v = Object.fromEntries(new FormData(f)); const b = f.querySelector('button.primary'); b.disabled = true; b.innerHTML = U.spin + 'Saving';
    try { await api('grok-connect', v); await window.App.reloadConns?.(); await load(true); U.closeDrawer(); U.toast('Grok Bot connected. Send a test ping to check the routine.'); window.App.render(true); }
    catch (ex) { b.disabled = false; b.textContent = 'Connect Grok Bot'; U.toast(ex.message || 'That did not work'); }
  }, true);

  /* ---------- chat actions ---------- */
  const hook = () => window.ChatHooks;
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-gkform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const h = hook(); const m = h && h.msgs()[+f.dataset.m]; if (!m || !m.grok || m.grok.state === 'sending') return;
    const v = Object.fromEntries(new FormData(f));
    Object.assign(m.grok, { title: String(v.title || '').trim(), instruction: String(v.instruction || '').trim(), agent: v.agent, state: 'sending', error: '' }); h.rerender();
    try {
      let t;
      if (live()) t = await api('grok-send', { title: m.grok.title, instruction: m.grok.instruction, agent: m.grok.agent });
      else { await new Promise((r) => setTimeout(r, 500)); t = { id: 'demo-' + Date.now(), agent: m.grok.agent, title: m.grok.title, instruction: m.grok.instruction, status: 'sent', summary: null, links: [], updates: [], sent_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setTimeout(() => { const x = task(t.id); if (x) { Object.assign(x, { status: 'done', summary: 'Demo workspace: in your workspace Grok Bot does the work and its report lands here.', updated_at: new Date().toISOString() }); refresh(); } }, 2500); }
      S.tasks.unshift(t); Object.assign(m.grok, { state: 'sent', task_id: t.id });
      U.toast('Sent to Grok Bot'); poll();
    } catch (ex) { Object.assign(m.grok, { state: 'draft', error: ex.message || 'That did not go through' }); if (live()) load(true); }
    h.rerender();
  }, true);
  ACT['grok-cancel'] = (el) => { const h = hook(); const m = h && h.msgs()[+el.dataset.m]; if (!m || !m.grok) return; m.grok.state = 'cancelled'; h.rerender(); };
  // Turn any AI Chat answer into a task card.
  ACT['grok-from'] = (el) => {
    const h = hook(); if (!h) return; const list = h.msgs(); const m = list[+el.dataset.m]; if (!m) return;
    const q = [...list.slice(0, +el.dataset.m)].reverse().find((x) => x.role === 'user');
    list.push({ role: 'assistant', grok: draft('Build this in HighLevel: ' + (q ? q.body : 'the plan above'), m.body) }); load(); h.rerender(); h.scrollEnd?.();
  };
  ACT['grok-resend'] = async (el) => {
    el.disabled = true;
    try { const t = live() ? await api('grok-resend', { id: el.dataset.id }) : { ...task(el.dataset.id), status: 'sent', send_error: null }; Object.assign(task(el.dataset.id) || {}, t); U.toast('Sent to Grok Bot again'); poll(); }
    catch (e) { U.toast(e.message); if (live()) await load(true); }
    refresh();
  };
  // Grok asked a question: answer it as a follow-up task that points at the original.
  ACT['grok-reply'] = (el) => {
    const t = task(el.dataset.id); if (!t) return;
    Object.assign(VS, { chRoom: false, chCoach: false, chFunnel: false, chDraft: `@grok Follow-up on "${t.title}" (task ${t.id}). My answer: ` });
    location.hash = '#chat';
    setTimeout(() => { const ta = document.querySelector('[data-chform] textarea'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 80);
  };
  ACT['grok-close'] = async (el) => {
    try { const t = live() ? await api('grok-close', { id: el.dataset.id, status: el.dataset.status }) : { status: el.dataset.status }; Object.assign(task(el.dataset.id) || {}, { status: t.status }); } catch (e) { U.toast(e.message); }
    refresh();
  };

  window.Grok = { load, intent, draft, chatCard, list, state: () => S, open, connected: () => !!S.conn, AGENTS, MCP, STANDING, connDrawer };
})();

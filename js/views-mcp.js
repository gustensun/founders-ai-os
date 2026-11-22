// Founders AI OS: AI access. The MCP server that lets Claude, Codex and other AI clients use the OS.
// Also the live Approvals queue, which is where drafts from those clients land.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const render = () => window.App.render(true);
  const URL_ = (location.protocol.startsWith('http') ? location.origin : 'https://your-app.vercel.app') + '/api/mcp';

  const TOOLS = [
    ['get_founder_facts', 'read', 'Your Founder Algorithm: approved facts that always win'],
    ['get_brand_dna', 'read', 'The compiled Brand DNA: facts, how you write, offers, funnels and what works in your space'],
    ['get_my_writing', 'read', 'Pieces you wrote yourself and the style guide studied from them'],
    ['get_brief', 'read', 'Revenue by stream, calls today, approvals, late promises and this week\u2019s priorities'],
    ['get_revenue', 'read', 'Revenue for 1 to 365 days by stream, against the period before'],
    ['get_goals', 'read', 'Freedom number, quarterly goals and the weekly review'],
    ['search_memory', 'read', 'Promises, waiting-on, decisions, ideas and people notes'],
    ['get_brand_profile', 'read', 'Your voice, audience, offers and stories, studied from your Brain'],
    ['search_brain', 'read', 'Passages from your uploaded docs, slides and pages'],
    ['reply_in_my_voice', 'read', 'Your facts, voice, offers and closest passages for any reply'],
    ['list_open_loops', 'read', 'What you promised and what you are waiting on, late first'],
    ['list_approvals', 'read', 'Drafts waiting for you, with scores and evidence'],
    ['get_content_pipeline', 'read', 'Scored content ideas by stage'],
    ['get_offers_and_funnels', 'read', 'Offer ladder and funnel conversion, with the biggest leak'],
    ['get_contact', 'read', 'One-page read on a person, with open promises to them'],
    ['list_agents', 'read', 'The agent team, schedules, runs and hours saved'],
    ['get_creator_content', 'read', 'Top Reels, carousels, videos and Shorts from the creators you track, filtered by views'],
    ['get_research', 'read', 'Apify research: outlier videos, buying-intent comments and search results'],
    ['get_scores', 'read', 'OS score and the next step for each part'],
    ['os_sections', 'read', 'Map of every section in the OS, with what can be edited'],
    ['os_read', 'read', 'Read any section: content, programs, offers, emails, vault, agents, playbook and more'],
    ['crm_board', 'read', 'Your HighLevel pipelines and the people in each stage'],
    ['propose_fact', 'write', 'Suggest a fact. It waits in the Brain until you approve it'],
    ['capture', 'write', 'File anything into Memory. Kind and due date are read from the text'],
    ['log_decision', 'write', 'Record a decision, the reason and a review date'],
    ['complete_item', 'write', 'Mark a promise or waiting-on item done'],
    ['submit_draft', 'write', 'Put a draft in the Newsfeed. It is never sent from here'],
    ['run_agent', 'write', 'Ask an OS agent to draft now'],
    ['os_write', 'write', 'Create, edit or delete anything in the OS. Every change is logged'],
    ['os_undo', 'write', 'Put back any change made through AI access'],
    ['crm_move', 'write', 'Move someone forward in a HighLevel pipeline, never back'],
    ['crm_place', 'write', 'Place people by email in a pipeline stage'],
  ];
  const CLIENTS = [['claude-code', 'Claude Code'], ['claude-app', 'Claude app'], ['codex', 'Codex'], ['hl-agent', 'HighLevel AI Agents'], ['other', 'Other clients']];
  VS.mcpClient = VS.mcpClient || 'claude-code';

  /* ---------- tokens (private workspaces) ---------- */
  const TK = { ws: null, rows: [], loading: false, error: '', fresh: null, at: 0 };
  function tokens() {
    const w = ctx().ws; if (!w || !w.id) return [];
    if ((TK.ws !== w.id || Date.now() - TK.at > 4000) && !TK.loading) {
      TK.loading = true; TK.error = '';
      Auth.tokens.list(w.id).then((r) => { TK.rows = r; }).catch((e) => { TK.error = Auth.friendly(e); TK.rows = []; }).finally(() => { TK.ws = w.id; TK.at = Date.now(); TK.loading = false; if (VS.view === 'mcp') render(); });
    }
    return TK.ws === w.id ? TK.rows : [];
  }
  const shownToken = () => (isLive() ? (TK.fresh && (VS.mcpClient !== 'hl-agent' || TK.fresh.row.scope === 'agent') ? TK.fresh.token : VS.mcpClient === 'hl-agent' ? 'YOUR_AGENT_TOKEN' : 'YOUR_TOKEN') : 'demo');
  const when = (iso) => { if (!iso) return 'Never'; const d = (Date.now() - Date.parse(iso)) / 6e4; if (d < 2) return 'Just now'; if (d < 60) return Math.round(d) + ' min ago'; if (d < 1440) return Math.round(d / 60) + ' h ago'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

  function snippet(client, t) {
    if (client === 'claude-code') return { label: 'Run in your terminal', code: `claude mcp add --transport http founders-ai-os ${URL_} \\\n  --header "Authorization: Bearer ${t}"`, after: 'Then type /mcp inside Claude Code to check it is connected. Add --scope user to use it in every project.' };
    if (client === 'claude-app') return { label: 'Paste as the connector URL', code: `${URL_}?key=${t}`, after: 'In Claude, open Settings, then Connectors, then Add custom connector. Name it Founders AI OS and paste the URL. The key is in the URL, so treat the URL like a password.' };
    if (client === 'codex') return { label: 'Add to ~/.codex/config.toml', code: `[mcp_servers.founders-ai-os]\nurl = "${URL_}"\nbearer_token_env_var = "FOUNDERS_OS_TOKEN"`, after: `Then set the token in your shell: export FOUNDERS_OS_TOKEN=${t}. The Codex CLI, IDE extension and app all read the same config. Run /mcp in Codex to check.` };
    if (client === 'hl-agent') return { label: 'In HighLevel: a workflow, the AI Agent action, then MCP servers, Add', code: `Name: Founders OS\nServer URL: ${URL_}\nTransport: Streamable HTTP\nHeader: Authorization = Bearer ${t}`, after: 'Use a HighLevel AI Agent token, never a read and write token. HighLevel agents talk to your leads and customers, so this token only shares your business profile, live offers with prices and links, and approved answers. Revenue, CRM, Memory, calls, contacts and private notes are never available to it.' };
    return { label: 'Any client that speaks MCP over HTTP', code: JSON.stringify({ mcpServers: { 'founders-ai-os': { type: 'http', url: URL_, headers: { Authorization: 'Bearer ' + t } } } }, null, 2), after: 'Cursor, Windsurf, VS Code and most agent frameworks accept this shape. Transport is Streamable HTTP.' };
  }

  V.mcp = () => {
    const live = isLive();
    const rows = live ? tokens() : [];
    const activeRows = rows.filter((r) => !r.revoked_at);
    const calls = rows.reduce((s, r) => s + (r.calls || 0), 0);
    const s = snippet(VS.mcpClient, shownToken());
    const reads = TOOLS.filter((t) => t[1] === 'read').length;
    return `${U.title('AI access', 'Connect Claude, Codex or any MCP client to this workspace. They read your brief, Memory and goals, file captures back and put drafts in the Newsfeed. Nothing reaches a customer until you approve it.')}
    ${U.kpis([{ label: 'Server', value: 'Live', delta: 'Streamable HTTP' }, { label: 'Tools', value: String(TOOLS.length), delta: reads + ' read, ' + (TOOLS.length - reads) + ' write' }, { label: live ? 'Active tokens' : 'Token', value: live ? String(activeRows.length) : 'demo', delta: live ? calls + ' calls so far' : 'Opens the sample workspace' }, { label: 'Sending', value: 'Never', delta: 'Drafts wait in the Newsfeed' }])}
    <div class="layout" style="margin-top:var(--gap)"><section class="panel">
      <header><h2>Connect a client</h2>${U.seg('mcpClient', VS.mcpClient, CLIENTS)}</header>
      <p class="meta" style="margin:4px 0 8px">${esc(s.label)}</p>
      <div class="code-block"><pre class="mono">${esc(s.code)}</pre><button class="btn sm" data-action="mcp-snippet">${icon('copy')}Copy</button></div>
      <p class="muted" style="margin-top:10px">${esc(s.after)}</p>
      ${live && !TK.fresh ? `<p class="meta" style="margin-top:10px"><span class="pill warn">Token needed</span> Create a token on the right and the snippets fill it in for you.</p>` : ''}
      ${!live ? `<p class="meta" style="margin-top:10px"><span class="pill acc">Demo</span> The token <span class="mono">demo</span> works right now and returns this sample workspace. Writes are classified and echoed back, not saved.</p>` : ''}
      <h3 class="sub-h" style="margin-top:22px">Tools</h3>
      <div class="rows">${TOOLS.map(([n, k, d]) => `<div class="row"><div class="grow"><b class="mono">${n}</b><p class="meta">${esc(d)}</p></div><span class="pill ${k === 'read' ? 'out' : 'acc'}">${k === 'read' ? 'Read only' : 'Writes to OS'}</span></div>`).join('')}</div>
      <h3 class="sub-h" style="margin-top:22px">Try asking</h3>
      <ul class="plain-list">${['What needs me today? Use Founders AI OS.', 'Which promises are late, and draft the follow-ups into my Newsfeed.', 'Compare software and affiliate revenue for the last 90 days.', 'Which competitor videos are outliers this week, and what would my version be?', 'Remember that I promised Anna the workshop outline by Friday.', 'Write a YouTube script from my top-scored idea and send it to the Newsfeed.'].map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
    </section>
    <aside class="rail">
      <h2 class="out">Endpoint</h2>
      <section class="panel tight"><div class="code-row"><code>${URL_}</code><button class="btn sm" data-action="mcp-url">Copy</button></div>
        <p class="meta" style="margin-top:10px">Send the token as <span class="mono">Authorization: Bearer</span>, or as <span class="mono">?key=</span> for apps that only take a URL.</p></section>
      <h2 class="out">Tokens</h2>
      <section class="panel tight">${live ? tokenPanel(rows) : `<p class="muted">Private workspaces create their own tokens here, one per client, each revocable. In the demo, use <span class="mono">demo</span>.</p><div class="code-row" style="margin-top:10px"><code>demo</code><button class="btn sm" data-action="mcp-demo-token">Copy</button></div>`}</section>
      <h2 class="out">How it stays safe</h2>
      <section class="panel tight"><ul class="plain-list">
        <li>Tokens are stored as SHA-256 hashes. The full token is shown once.</li>
        <li>Each token reaches one workspace and stops working the moment you revoke it or leave the workspace.</li>
        <li>Read and write tokens can view and edit everything in the OS. Read only tokens can view everything and change nothing. HighLevel AI Agent tokens see only your public profile, live offers and approved answers.</li>
        <li>Every AI edit is logged with what it was before and can be undone. Tokens, connection keys and HighLevel conversations are never shared.</li>
        <li>Nothing is sent, published or approved from here. People only move forward in HighLevel pipelines.</li>
        <li>Every call is counted, with the client name and last use.</li>
      </ul></section>
    </aside></div>`;
  };
  function tokenPanel(rows) {
    const fresh = TK.fresh ? `<div class="token-fresh"><p class="meta"><b>Copy this now.</b> It will not be shown again.</p><div class="code-row" style="margin-top:6px"><code class="mono">${esc(TK.fresh.token)}</code><button class="btn sm" data-action="mcp-fresh-copy">Copy</button></div></div>` : '';
    const list = TK.loading && !rows.length ? `<p class="meta">${U.spin}Loading tokens</p>` : TK.error ? `<p class="meta">${esc(TK.error)}</p>` : rows.length ? `<div class="rows">${rows.map((r) => `<div class="row"><div class="grow"><b>${esc(r.name)}</b> <span class="pill out">${r.scope === 'agent' ? 'HighLevel AI Agent' : r.scope === 'read' ? 'Read only' : 'Read and write'}</span><p class="meta"><span class="mono">${esc(r.prefix)}\u2026</span> \u00b7 ${r.revoked_at ? 'Revoked' : (r.calls || 0) + ' calls \u00b7 ' + when(r.last_used_at)}${r.last_client ? ' \u00b7 ' + esc(r.last_client) : ''}</p></div>${r.revoked_at ? '<span class="pill">Revoked</span>' : `<button class="btn sm ghost" data-action="mcp-revoke" data-id="${r.id}">Revoke</button>`}</div>`).join('')}</div>` : `<p class="muted">No tokens yet. Make one per client so you can revoke them separately.</p>`;
    return `${fresh}${list}<div class="actions" style="margin-top:12px"><button class="btn primary" data-action="mcp-create">New token</button></div>`;
  }
  V.mcp.live = () => V.mcp();

  ACT['mcp-snippet'] = () => U.copy(snippet(VS.mcpClient, shownToken()).code);
  ACT['mcp-url'] = () => U.copy(URL_);
  ACT['mcp-demo-token'] = () => U.copy('demo');
  ACT['mcp-fresh-copy'] = () => TK.fresh && U.copy(TK.fresh.token);
  ACT['mcp-create'] = async () => {
    const name = { 'claude-code': 'Claude Code', 'claude-app': 'Claude app', codex: 'Codex', 'hl-agent': 'HighLevel AI Agent', other: 'AI client' }[VS.mcpClient];
    const r = await U.dialog({ title: 'New token', body: 'Name it after the client that will use it.', fields: [{ name: 'name', label: 'Name', value: name, required: true }, { name: 'scope', label: 'Access', type: 'select', value: VS.mcpClient === 'hl-agent' ? 'agent' : 'write', options: [['write', 'Read and write: capture, propose facts, send drafts to the Newsfeed'], ['read', 'Read only: reads everything, changes nothing'], ['agent', 'HighLevel AI Agent: public profile, live offers and approved answers only']] }], ok: 'Create token' });
    if (!r) return;
    try { const out = await Auth.tokens.create(ctx().ws.id, r.name.trim().slice(0, 60), r.scope === 'read' || r.scope === 'agent' ? r.scope : 'write'); TK.fresh = out; TK.rows = [out.row, ...TK.rows]; U.toast('Token created. Copy it now.'); } catch (e) { U.toast(Auth.friendly(e)); }
    render();
  };
  ACT['mcp-revoke'] = async (el) => {
    const t = TK.rows.find((x) => x.id === el.dataset.id); if (!t) return;
    const ok = await U.dialog({ title: 'Revoke ' + t.name + '?', body: 'Any client using it loses access at once. This cannot be undone.', ok: 'Revoke', danger: true });
    if (!ok) return;
    try { await Auth.tokens.revoke(t.id); t.revoked_at = new Date().toISOString(); if (TK.fresh && TK.fresh.row.id === t.id) TK.fresh = null; U.toast('Revoked'); } catch (e) { U.toast(Auth.friendly(e)); }
    render();
  };

  /* ---------- live Approvals: drafts from AI clients and agents ---------- */
  const DR = { ws: null, rows: [], loading: false, error: '', at: 0 };
  function drafts(fresh) {
    const w = ctx().ws; if (!w || !w.id) return [];
    if ((DR.ws !== w.id || (fresh && Date.now() - DR.at > 4000)) && !DR.loading) {
      DR.loading = true; DR.error = '';
      Auth.drafts.list(w.id).then((r) => { DR.rows = (r || []).filter((d) => d.source !== 'Grok Bot'); }).catch((e) => { DR.error = Auth.friendly(e); DR.rows = []; }).finally(() => { DR.ws = w.id; DR.at = Date.now(); DR.loading = false; if (VS.view === 'approvals') render(); window.App.refreshCounts && window.App.refreshCounts(); });
    }
    return DR.ws === w.id ? DR.rows : [];
  }
  const baseCounts = window.OSCounts;
  window.OSCounts = () => { const c = baseCounts ? baseCounts() : {}; if (isLive()) { if (!DR.ws && !DR.loading && ctx().ws && ctx().ws.id) drafts(); c.approvals = DR.rows.length || ''; } return c; };
  if (V.approvals) V.approvals.live = () => {
    const rows = drafts(true);
    const body = DR.loading && !rows.length ? `<p class="meta">${U.spin}Loading drafts</p>` : DR.error ? U.empty('Drafts could not load', esc(DR.error)) : rows.length ? `<div class="rows">${rows.map((d) => `<div class="row click" data-action="draft-open" data-id="${d.id}"><div class="grow"><b>${esc(d.title)}</b><p class="meta">${esc(d.kind)} \u00b7 from ${esc(d.source || 'app')} \u00b7 ${when(d.created_at)}</p></div>${d.stream ? `<span class="pill out">${esc(d.stream)}</span>` : ''}</div>`).join('')}</div>` : U.empty('Nothing waiting', 'Drafts appear here when an agent or a connected AI client like Claude or Codex sends one. Nothing is sent until you approve it.', '<a class="btn" href="#mcp">Connect an AI client</a>');
    return `${U.title('Approvals', 'Drafts waiting for you. Approve to hand them to HighLevel, or reject to drop them.')}
      <section class="panel"><header><h2>Waiting</h2><span class="meta">${rows.length} draft${rows.length === 1 ? '' : 's'}</span></header>${body}</section>`;
  };
  ACT['draft-open'] = (el) => {
    const d = DR.rows.find((x) => x.id === el.dataset.id); if (!d) return;
    U.drawer(`<div><p class="meta">${esc(d.kind)} \u00b7 from ${esc(d.source || 'app')}</p><h2>${esc(d.title)}</h2></div>
      <div class="dsec"><h3>Draft</h3><div class="draft-body">${esc(d.body).replace(/\n/g, '<br>')}</div></div>
      ${d.action ? `<div class="dsec"><h3>On approval</h3><p>${esc(d.action)}</p></div>` : ''}
      <div class="actions"><button class="btn primary" data-action="draft-decide" data-v="approved" data-id="${d.id}">Approve</button><button class="btn" data-action="draft-copy" data-id="${d.id}">Copy text</button><button class="btn ghost" data-action="draft-decide" data-v="rejected" data-id="${d.id}">Reject</button></div>`, { wide: true });
  };
  ACT['draft-copy'] = (el) => { const d = DR.rows.find((x) => x.id === el.dataset.id); d && U.copy(d.body); };
  ACT['draft-decide'] = async (el) => {
    const id = el.dataset.id, v = el.dataset.v;
    const dd = DR.rows.find((x) => x.id === id);
    try { if (v === 'approved' && dd && dd.kind === 'Post' && window.OSPosts) await window.OSPosts.toBoard(dd, dd.body); await Auth.drafts.decide(id, v); window.OSPosts && window.OSPosts.reset(); DR.rows = DR.rows.filter((x) => x.id !== id); U.closeDrawer(); U.toast(v === 'approved' && dd && dd.kind === 'Post' ? 'Approved and added to the content board' : v === 'approved' ? 'Approved. Copy it into HighLevel to send until the HighLevel connection is live.' : 'Rejected'); } catch (e) { U.toast(Auth.friendly(e)); }
    render(); window.App.refreshCounts && window.App.refreshCounts();
  };
})();

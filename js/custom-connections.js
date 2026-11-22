// Inbound MCP and text-only design skills. All credentials and execution stay on
// the server; this module keeps neither secrets nor tool outputs in localStorage.
(() => {
  const U = window.UI, { esc, icon } = U, VS = window.VS, ACT = window.ACT;
  const live = () => !!window.App?.isLive();
  const ctx = () => window.App?.liveCtx() || {};
  const key = () => [live(), ctx().ws?.id || '', ctx().userId || ''].join(':');
  const S = { key: '', rows: [], loaded: false, loading: false, error: '', detail: null, turn: 0, selected: [] };
  const PRESETS = [
    { id: 'taste', name: 'Taste Skill', host: 'tasteskill.dev', docs: 'https://www.tasteskill.dev/docs', description: 'Art direction, composition and page guidance.' },
    { id: 'impeccable', name: 'Impeccable', host: 'impeccable.style', docs: 'https://impeccable.style/docs/', description: 'Design critique, typography and interface finishing.' }
  ];
  const render = () => window.App?.render(true);
  function ensure() {
    if (S.key !== key()) Object.assign(S, { key: key(), rows: [], loaded: false, loading: false, error: '', detail: null, approval: null, operation: null, turn: S.turn + 1, selected: [] });
    return S.key;
  }
  async function api(action, body = {}) {
    if (!live()) throw new Error('Open your private workspace to connect a real server or add a skill.');
    const ws = ctx().ws?.id, session = await window.Auth.session();
    if (!session) throw new Error('Sign in first.');
    const response = await fetch('/api/custom', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ action, workspace_id: ws, ...body }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'This connection could not be loaded. Try again.');
    return result;
  }
  async function load(force = false) {
    const k = ensure();
    if (!live() || S.loading || (S.loaded && !force)) return;
    S.loading = true; S.error = '';
    try { const result = await api('list'); if (k !== key()) return; S.rows = result.connections || []; S.loaded = true; }
    catch (e) { if (k === key()) { S.error = e.message; S.loaded = true; } }
    finally { if (k === key()) { S.loading = false; if (['connect', 'chat'].includes(VS.view)) render(); } }
  }
  const stamp = date => date ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not checked';
  const state = r => !r.enabled ? 'Paused' : r.kind === 'skill' ? 'Guidance added' : 'Connected';
  function view() {
    ensure(); load();
    const rows = S.rows;
    return `<div class="cc-work"><section class="cc-main" aria-label="Custom connections">
      <div class="cc-section-head"><div><h2>Your connections</h2><p class="muted">Bring tools into the OS, or add design guidance to your AI.</p></div>
        <button class="btn ghost" data-action="cc-import">${icon('file')}Import skill</button></div>
      ${S.loading && !rows.length ? `<p class="cc-state" role="status">${U.spin}Loading your connections</p>` : S.error ? `<div class="cc-state" role="alert"><p>${esc(S.error)}</p><button class="btn" data-action="cc-retry">Try again</button></div>` : rows.length ?
      `<div class="cc-list">${rows.map(r => `<button class="cc-row" data-action="cc-open" data-id="${r.id}">
        <span class="cc-row-main"><strong>${esc(r.name)}</strong><span>${r.kind === 'mcp' ? esc(r.meta.endpoint) : esc(r.meta.homepage || 'Your Markdown guidance')}</span></span>
        <span class="cc-row-kind">${r.kind === 'mcp' ? `${r.meta.catalog?.tools?.length || 0} tools` : 'Skill'}</span>
        <span class="cc-row-state" data-enabled="${r.enabled}">${state(r)}</span>${icon('chevron')}</button>`).join('')}</div>` :
      `<div class="cc-empty"><h3>Add the tools you work with.</h3><p>Connect a public HTTPS MCP server to discover its tools, resources and prompts. You review every request before it runs.</p>
        <button class="btn" data-action="cc-add">${icon('plus')}Add MCP server</button>${!live() ? '<p class="meta">Sign in to save real connections. No sample connections or credentials are added here.</p>' : ''}</div>`}
      <section class="cc-presets"><h2>Design skills</h2><p class="muted">Official Markdown guidance, imported from the author’s repository. These are skills, not hosted MCP servers.</p>
        ${PRESETS.map(p => { const installed = rows.find(r => r.meta.preset === p.id); return `<div class="cc-preset"><div><h3>${p.name}</h3><p>${p.description}</p><a href="${p.docs}" class="lnk" target="_blank" rel="noopener noreferrer">${p.host}${icon('arrow')}</a></div>
          <button class="btn" data-action="${installed ? 'cc-open' : 'cc-preset'}" data-id="${installed?.id || p.id}">${installed ? 'Manage' : 'Add guidance'}</button></div>`; }).join('')}
      </section></section>
      <aside class="cc-aside"><h2>What connects here</h2><dl><dt>MCP servers</dt><dd>Public Streamable HTTP endpoints. No authentication, bearer tokens or a custom API-key header. Local commands, legacy SSE endpoints and browser OAuth are not supported.</dd>
      <dt>Design skills</dt><dd>Guidance for design questions in AI Chat and future Funnel Agent runs. Your Brand DNA and manual work take priority. Local scripts and browser checks do not run inside the OS.</dd>
      <dt>You stay in control</dt><dd>Keys are encrypted server-side. Only the inputs you review are sent to a custom server. Connecting a server does not give it your Brain, keys or programs.</dd></dl>
      <div class="cc-outbound"><h2>Use the OS from other AI</h2><p>Connect Claude or Codex to your workspace with the existing AI-access server.</p><a class="lnk" href="#mcp">Open AI access${icon('arrow')}</a></div></aside></div>`;
  }
  // The built-in skill library AI Chat draws on next to the founder's own skills. Names only; the content stays on the server.
  function libraryView() {
    const L = window.SKILL_LIBRARY; if (!L) return '';
    return `<section class="cxs cc-lib" aria-labelledby="cc-lib-h"><header><h2 id="cc-lib-h">AI Chat skill library</h2>
      <p class="muted">${L.count} marketing, writing and research skills from public MIT licensed libraries. AI Chat picks the ones each request needs and uses them next to your own skills. Your skills, facts and Brand DNA win where they overlap. Nothing to set up.</p></header>
      ${L.groups.map((g) => `<div class="cc-lib-g"><h3>${esc(g.name)}</h3><ul>${g.skills.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}
      <p class="meta cc-lib-src">From ${L.sources.map(([n, u]) => `<a class="lnk" href="${u}" target="_blank" rel="noopener noreferrer">${esc(n)}</a>`).join(', ')}. Live trend research on Reddit, X, YouTube and TikTok uses your Perplexity key. Hacker News works without one.</p></section>`;
  }
  const guard = () => { if (!live()) { U.toast('Open your private workspace to save real connections.'); return false; } return true; };
  function drawer(html, label, options = {}) { S.turn++; U.drawer(`<div class="cc-drawer">${html}</div>`, { label, ...options }); return S.turn; }
  function error(form, message) { const target = form.querySelector('[data-cc-error]'); if (target) { target.hidden = false; target.textContent = message; } else U.toast(message); }
  const errorSlot = '<p class="auth-msg" data-cc-error role="alert" hidden></p>';
  const flags = meta => `<div class="cc-options"><label><input type="checkbox" name="use_chat" ${meta?.use_chat !== false ? 'checked' : ''}>Use for design questions in AI Chat</label><label><input type="checkbox" name="use_funnels" ${meta?.use_funnels !== false ? 'checked' : ''}>Use in future Funnel Agent runs</label></div>`;
  function editMcp(r = null) {
    if (!guard()) return;
    ensure(); S.editing = r;
    drawer(`<h2>${r ? 'Edit connection' : 'Add MCP server'}</h2><p class="muted">Paste the server’s MCP endpoint, not its website homepage. We test the connection before saving it.</p>
      <form class="fd" data-ccform="mcp" autocomplete="off">
      <label class="field"><span>Name</span><input name="name" maxlength="100" required value="${esc(r?.name || '')}" placeholder="My design tools"></label>
      <label class="field"><span>HTTPS endpoint</span><input name="endpoint" type="url" required value="${esc(r?.meta.endpoint || '')}" placeholder="https://your-server.com/mcp" spellcheck="false"></label>
      <label class="field"><span>Authentication</span><select name="auth" data-cc-auth>${[['none', 'No authentication'], ['bearer', 'Bearer token'], ['header', 'API-key header']].map(([v, l]) => `<option value="${v}" ${r?.meta.auth === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field" data-cc-header ${r?.meta.auth === 'header' ? '' : 'hidden'}><span>Header name</span><input name="header" value="${esc(r?.meta.header || 'X-API-Key')}" spellcheck="false"></label>
      <label class="field" data-cc-secret ${r?.meta.auth && r.meta.auth !== 'none' ? '' : 'hidden'}><span>Credential</span><input name="secret" type="password" autocomplete="new-password" placeholder="${r ? 'Leave blank only when keeping the saved credential' : 'Sent once, stored encrypted'}" maxlength="8192"></label>
      ${r ? '<label class="cc-check"><input type="checkbox" name="keep_credentials" checked>Keep the saved authentication and endpoint</label>' : ''}
      <p class="meta">Supports Streamable HTTP. No local commands, private networks or automatic tool execution.</p>${errorSlot}
      <div class="actions end"><button class="btn primary" type="submit">Test &amp; ${r ? 'save' : 'connect'}</button></div></form>`, r ? 'Edit MCP connection' : 'Add MCP server');
  }
  function skillForm(preset, r = null, files = []) {
    if (!guard()) return;
    ensure(); S.editing = r; const p = PRESETS.find(x => x.id === preset);
    drawer(`<h2>${r ? 'Edit skill' : p ? 'Add ' + p.name : 'Import a skill'}</h2>
      <p class="muted">${p ? 'Import the full skill folder from the latest official release. The saved copy stays pinned to that version until you refresh it.' : 'Upload or paste a Markdown skill. It becomes design reference material, not executable code or permission to act.'}</p>
      <form class="fd" data-ccform="skill" data-preset="${esc(preset || '')}">
      <label class="field"><span>Name</span><input name="name" maxlength="100" required value="${esc(r?.name || p?.name || '')}" placeholder="My design guidance"></label>
      ${p ? `<p class="meta">Official setup: <a href="${p.docs}" class="lnk" target="_blank" rel="noopener noreferrer">${p.host}</a></p>` :
      `<label class="field"><span>Markdown file</span><input type="file" name="file" accept=".md,.txt,text/markdown,text/plain" data-cc-file></label>
      <label class="field"><span>Guidance</span><textarea name="body" rows="12" maxlength="240000" required placeholder="Paste the contents of SKILL.md">${esc(files[0]?.body || '')}</textarea></label>`}
      ${flags(r?.meta)}<p class="meta">Text guidance only. Browser inspection, terminal scripts and the complete local skill runtime require installation in your coding agent. This does not change any existing page or program.</p>
      ${errorSlot}<div class="actions end"><button class="btn primary" type="submit">${r ? 'Save skill' : 'Add guidance'}</button></div></form>`, p ? 'Add ' + p.name : 'Import a skill');
  }
  function examples(item, type) {
    if (type === 'resource') return {};
    if (type === 'prompt') return Object.fromEntries((item.arguments || []).map(a => [a.name, '']));
    const schema = item.inputSchema || {}, properties = schema.properties || {}, required = schema.required || [];
    return Object.fromEntries(Object.entries(properties).filter(([k]) => required.includes(k)).map(([k, p]) => [k,
      p.enum?.[0] ?? (p.type === 'boolean' ? false : ['integer', 'number'].includes(p.type) ? 1 : p.type === 'array' ? [] : p.type === 'object' ? {} : '')]));
  }
  async function open(id) {
    if (!guard()) return;
    const k = ensure(); S.detail = null; const turn = drawer(`<h2>Connection</h2><p role="status">${U.spin}Loading details</p>`, 'Connection');
    try { const data = await api('detail', { id }); if (k !== key() || turn !== S.turn || !document.querySelector('#drawer.open')) return; S.detail = data; showDetail(); }
    catch (e) { if (k === key() && turn === S.turn) drawer(`<h2>Could not load this connection</h2><p role="alert">${esc(e.message)}</p><button class="btn" data-action="cc-open" data-id="${esc(id)}">Try again</button>`, 'Connection unavailable'); }
  }
  function showDetail() {
    const data = S.detail; if (!data) return;
    const r = data.connection, m = r.meta, cat = m.catalog || {};
    const sections = r.kind === 'mcp' ? ['tools', 'resources', 'prompts'].map(type => {
      const rows = cat[type] || []; if (!rows.length) return '';
      const singular = { tools: 'tool', resources: 'resource', prompts: 'prompt' }[type];
      return `<section class="cc-detail-section"><h3>${type[0].toUpperCase() + type.slice(1)} <span class="meta">${rows.length}</span></h3><div class="cc-tools">${rows.map(item => `<button class="cc-tool" data-action="cc-operation" data-type="${singular}" data-name="${esc(singular === 'resource' ? item.uri : item.name)}" ${r.enabled ? '' : 'disabled'}><strong>${esc(item.title || item.name)}</strong><span>${esc(item.description || (singular === 'resource' ? item.uri : 'Review the inputs before running.'))}</span>${singular === 'tool' ? `<small>${item.readOnly ? 'Server marks this read-only' : 'May change data'} · approval required</small>` : ''}</button>`).join('')}</div></section>`;
    }).join('') : `<form class="fd cc-usage" data-ccform="usage">${flags(m)}<button class="btn" type="submit">Save usage</button>${errorSlot}</form>
      <section class="cc-detail-section"><h3>Imported files</h3><p class="meta">${m.version ? 'Release v' + esc(m.version) + ' · ' : ''}${m.commit ? 'Repository snapshot ' + esc(m.commit.slice(0, 12)) : 'Founder-provided guidance'}${(data.files || []).length > 1 ? ' · ' + data.files.length + ' files' : ''} · ${esc(stamp(m.imported_at))}${m.license ? ' · ' + esc(m.license) : ''}</p>
      ${(data.files || []).map(f => `<details class="cc-file"><summary>${esc(f.name)}<span class="meta">${f.body.length.toLocaleString()} characters</span></summary>${f.url ? `<a class="lnk" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">Original file</a>` : ''}<pre>${esc(f.body)}</pre></details>`).join('')}
      <p class="meta">The original text may refer to scripts or browser checks. Those are not installed or executed here.</p></section>
      ${m.install ? `<section class="cc-detail-section"><h3>Use the full skill locally</h3><p class="meta">Run this in your coding project for the author’s complete runtime.</p><div class="code-row"><code>${esc(m.install)}</code><button class="btn sm" data-action="cc-copy-install">Copy</button></div><a href="${esc(m.docs)}" class="lnk" target="_blank" rel="noopener noreferrer">Official installation guide</a></section>` : ''}`;
    drawer(`<h2>${esc(r.name)}</h2><p class="cc-detail-status">${r.kind === 'mcp' ? 'MCP server' : 'Design skill'} · ${state(r)}</p>
      <p class="cc-endpoint">${esc(m.endpoint || m.homepage || 'Your Markdown guidance')}</p>
      <div class="actions"><button class="btn" data-action="cc-toggle">${r.enabled ? 'Pause' : 'Enable'}</button>
      <button class="btn ghost" data-action="cc-edit">Edit</button>${r.kind === 'mcp' || m.preset ? '<button class="btn ghost" data-action="cc-refresh">Refresh</button>' : ''}
      <button class="btn ghost" data-action="cc-remove">Remove</button></div>
      ${r.kind === 'mcp' ? `<p class="meta">Checked ${esc(stamp(m.checked_at))}. ${esc(cat.server?.name || '')}${cat.protocol ? ' · MCP ' + esc(cat.protocol) : ''}</p>
      ${cat.limited ? '<p class="meta">This server’s catalog was capped at 60 entries per category. Only the listed items can run.</p>' : ''}${!cat.tools?.length && !cat.resources?.length && !cat.prompts?.length ? '<p class="meta">The connection is valid, but the server exposed no supported tools, resources or prompts.</p>' : ''}` : ''}
      ${sections}${r.kind === 'mcp' ? `<section class="cc-detail-section"><h3>Recent requests</h3>${data.runs?.length ? data.runs.map(run => `<details class="cc-file"><summary>${esc(run.label)}<span class="meta">${esc(run.status)} · ${esc(stamp(run.started_at))}</span></summary>${resultHTML(run)}</details>`).join('') : '<p class="meta">Nothing has run. Connecting only reads the server’s catalog.</p>'}</section>` : ''}`, r.name);
  }
  function resultHTML(run) {
    return `<div class="cc-result">${run.status === 'running' ? '<p class="meta">This request was already submitted. Refresh later; do not repeat it if the server may have acted.</p>' : ''}
      <pre>${esc(run.result?.text || '')}</pre>${run.result?.truncated ? '<p class="meta">The result was limited to 80,000 characters.</p>' : ''}
      ${run.status === 'done' ? `<button class="btn" data-action="cc-to-chat" data-id="${run.id}" data-label="${esc(run.label)}">Use result in AI Chat${icon('arrow')}</button>` : ''}</div>`;
  }
  function operation(type, name) {
    const r = S.detail?.connection; if (!r?.enabled) return;
    const cat = r.meta.catalog, list = cat[{ tool: 'tools', resource: 'resources', prompt: 'prompts' }[type]] || [];
    const item = list.find(x => (type === 'resource' ? x.uri : x.name) === name); if (!item) return;
    S.operation = { id: r.id, type, name }; S.approval = null;
    drawer(`<h2>${esc(item.title || item.name)}</h2><p class="muted">${esc(item.description || 'Choose the inputs for this request.')}</p>
      <p class="meta">${esc(r.name)} · ${esc(new URL(r.meta.endpoint).host)}</p>
      <form class="fd" data-ccform="operation">${type === 'resource' ? `<p class="cc-endpoint">${esc(item.uri)}</p>` :
      `<label class="field"><span>${type === 'tool' ? 'Tool arguments' : 'Prompt arguments'} (JSON)</span><textarea class="mono" name="arguments" rows="10" spellcheck="false" required>${esc(JSON.stringify(examples(item, type), null, 2))}</textarea></label>
      <details class="cc-file"><summary>Input definition</summary><pre>${esc(JSON.stringify(type === 'tool' ? item.inputSchema : item.arguments, null, 2))}</pre></details>`}
      <p class="meta">No Brand DNA, files or other workspace context is attached. Only these inputs will be sent. The server may charge for use or change external data.</p>${errorSlot}
      <div class="actions end"><button class="btn primary" type="submit">Review request</button></div></form>`, item.title || item.name, { push: true });
  }
  function approvalView(data) {
    S.approval = data;
    drawer(`<h2>Review this request</h2><dl class="cc-review"><dt>Connection</dt><dd>${esc(data.connection)}</dd><dt>Destination</dt><dd>${esc(data.endpoint)}</dd><dt>Operation</dt><dd>${esc(data.plan.name)}</dd></dl>
      <h3>Exact inputs</h3><pre class="cc-json">${esc(JSON.stringify(data.plan.type === 'resource' ? { uri: data.plan.name } : data.plan.arguments, null, 2))}</pre>
      <p>${data.plan.readOnly ? 'The server describes this operation as read-only. That is a server declaration, not a guarantee.' : 'This tool may change external data.'} It may also incur usage charges.</p>
      <p class="meta">This approval is for one request and expires in five minutes. Nothing is published or changed in your OS automatically.</p>
      <div class="actions end"><button class="btn" data-action="cc-cancel-run">Cancel</button><button class="btn primary" data-action="cc-run">Approve &amp; run once</button></div>`, 'Review MCP request');
  }
  const busy = (el, value) => { el.dataset.original = el.innerHTML; el.disabled = true; el.innerHTML = U.spin + value; };
  const done = el => { if (el?.isConnected) { el.disabled = false; el.innerHTML = el.dataset.original || 'Try again'; } };
  async function saved(result, k, message, turn) {
    if (k !== key()) return;
    if (result.connection) S.rows = S.rows.some(r => r.id === result.connection.id) ? S.rows.map(r => r.id === result.connection.id ? result.connection : r) : [...S.rows, result.connection];
    S.loaded = true; render(); U.toast(message);
    if (result.connection && (turn === undefined || turn === S.turn) && document.querySelector('#drawer.open')) await open(result.connection.id);
  }
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-ccform]'); if (!form) return;
    event.preventDefault(); event.stopPropagation();
    const k = ensure(), turn = S.turn, button = form.querySelector('button[type=submit]'), type = form.dataset.ccform;
    busy(button, type === 'mcp' ? 'Testing connection' : type === 'operation' ? 'Preparing request' : 'Saving');
    const existing = S.editing;
    try {
      if (type === 'mcp') {
        const result = await api('connect', { id: existing?.id, revision: existing?.revision, name: form.elements.name.value,
          keep_credentials: !!form.elements.keep_credentials?.checked,
          config: { endpoint: form.elements.endpoint.value, auth: form.elements.auth.value, header: form.elements.header.value, secret: form.elements.secret.value } });
        form.elements.secret.value = ''; await saved(result, k, 'MCP connection verified and saved.', turn);
      } else if (type === 'skill') {
        const result = await api('add-skill', { id: existing?.id, revision: existing?.revision, preset: form.dataset.preset || undefined,
          name: form.elements.name.value, body: form.elements.body?.value, use_chat: form.elements.use_chat.checked, use_funnels: form.elements.use_funnels.checked });
        await saved(result, k, 'Design guidance added. No scripts were installed.', turn);
      } else if (type === 'usage') {
        const r = S.detail.connection;
        await saved(await api('update', { id: r.id, revision: r.revision, use_chat: form.elements.use_chat.checked, use_funnels: form.elements.use_funnels.checked }), k, 'Skill usage saved.', turn);
      } else if (type === 'operation') {
        let args; try { args = JSON.parse(form.elements.arguments?.value || '{}'); } catch { throw new Error('Use a valid JSON object for the inputs.'); }
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be a JSON object.');
        const plan = { ...S.operation, arguments: args };
        const data = await api('prepare', plan);
        if (k === key() && turn === S.turn && document.querySelector('#drawer.open')) { S.operation = plan; approvalView(data); }
      }
    } catch (e) { if (k === key() && turn === S.turn) error(form, e.message); }
    finally { done(button); }
  }, true);
  document.addEventListener('change', async event => {
    const el = event.target, form = el.closest('[data-ccform]'); if (!form) return;
    if (form.dataset.ccform === 'mcp' && ['auth', 'endpoint'].includes(el.name)) {
      if (form.elements.keep_credentials) form.elements.keep_credentials.checked = false;
      form.querySelector('[data-cc-header]').hidden = form.elements.auth.value !== 'header';
      form.querySelector('[data-cc-secret]').hidden = form.elements.auth.value === 'none';
    }
    if (el.matches('[data-cc-file]')) {
      const file = el.files[0], k = ensure(), turn = S.turn; if (!file) return;
      if (file.size > 960000 || !/\.(md|txt)$/i.test(file.name)) { error(form, 'Choose a Markdown or text file under 960 KB.'); el.value = ''; return; }
      const body = await file.text();
      if (k !== key() || turn !== S.turn || !form.isConnected) return;
      if (body.length > 240000) return error(form, 'This skill is too long. Import the relevant guidance, up to 240,000 characters.');
      form.elements.body.value = body;
      if (!form.elements.name.value) form.elements.name.value = file.name.replace(/\.(md|txt)$/i, '').slice(0, 100);
    }
  });
  ACT['cc-add'] = () => editMcp();
  ACT['cc-import'] = () => skillForm();
  ACT['cc-preset'] = el => skillForm(el.dataset.id);
  ACT['cc-retry'] = () => { load(true); render(); };
  ACT['cc-open'] = el => open(el.dataset.id);
  ACT['cc-edit'] = () => { const d = S.detail; if (!d) return; d.connection.kind === 'mcp' ? editMcp(d.connection) : skillForm(d.connection.meta.preset, d.connection, d.files); };
  ACT['cc-copy-install'] = () => U.copy(S.detail?.connection.meta.install || '');
  ACT['cc-operation'] = el => operation(el.dataset.type, el.dataset.name);
  ACT['cc-cancel-run'] = () => { S.approval = null; showDetail(); };
  ACT['cc-toggle'] = async el => {
    const k = ensure(), r = S.detail?.connection, turn = S.turn; if (!r) return;
    busy(el, 'Saving');
    try { await saved(await api('update', { id: r.id, revision: r.revision, enabled: !r.enabled }), k, r.enabled ? 'Connection paused.' : 'Connection enabled.', turn); }
    catch (e) { if (k === key()) U.toast(e.message); } finally { done(el); }
  };
  ACT['cc-refresh'] = async el => {
    const k = ensure(), r = S.detail?.connection, turn = S.turn; if (!r) return;
    busy(el, 'Refreshing');
    try {
      const result = r.kind === 'mcp' ? await api('connect', { id: r.id, revision: r.revision, name: r.name, keep_credentials: true }) :
        await api('add-skill', { id: r.id, revision: r.revision, name: r.name, preset: r.meta.preset });
      await saved(result, k, r.kind === 'mcp' ? 'Server catalog refreshed.' : 'Guidance refreshed from its official repository.', turn);
    } catch (e) { if (k === key()) U.toast(e.message); } finally { done(el); }
  };
  ACT['cc-remove'] = async () => {
    const k = ensure(), r = S.detail?.connection; if (!r) return;
    const yes = await U.dialog({ title: 'Remove ' + r.name + '?', body: 'This removes its saved credentials or guidance and its request history from this workspace. It does not undo any action already taken on the external server.', ok: 'Remove connection', danger: true });
    if (!yes || k !== key()) return;
    try { await api('remove', { id: r.id, revision: r.revision, confirm: true }); if (k !== key()) return; S.rows = S.rows.filter(x => x.id !== r.id); S.detail = null; S.approval = null; S.selected = []; U.closeDrawer(); render(); U.toast('Connection removed.'); }
    catch (e) { if (k === key()) U.toast(e.message); }
  };
  ACT['cc-run'] = async el => {
    const k = ensure(), approval = S.approval, operation = S.operation, turn = S.turn;
    if (!approval || !operation) return;
    busy(el, 'Running once');
    try {
      const result = await api('run', { ...operation, ticket: approval.ticket, confirm: true });
      if (k !== key() || turn !== S.turn || !document.querySelector('#drawer.open')) return;
      S.approval = null;
      drawer(`<h2>${esc(approval.plan.title)}</h2><p class="meta">${esc(result.run.status)} · ${esc(approval.connection)}</p>${resultHTML(result.run)}
        <button class="btn ghost" data-action="cc-open" data-id="${operation.id}">Back to connection</button>`, 'MCP result');
    } catch (e) { if (k === key() && turn === S.turn) U.toast(e.message + ' If it was submitted, check Recent requests before trying again.'); }
    finally { done(el); }
  };
  ACT['cc-to-chat'] = el => {
    ensure();
    if (!S.selected.some(r => r.id === el.dataset.id)) S.selected = [...S.selected, { id: el.dataset.id, label: el.dataset.label }].slice(-3);
    window.ChatOS?.prepareWorkspace();
    VS.chRoom = false; VS.chScope = 'all';
    if (!VS.chDraft) VS.chDraft = 'Use this tool result with my brand context. ';
    U.closeDrawer(); location.hash = '#chat'; VS.view = 'chat'; render();
    requestAnimationFrame(() => document.querySelector('[data-chform] textarea')?.focus());
  };
  ACT['cc-chat-remove'] = el => { ensure(); S.selected = S.selected.filter(r => r.id !== el.dataset.id); render(); };
  ACT['cc-chat-tools'] = () => { ensure(); VS.cxShow = 'all'; location.hash = '#connect'; };
  function attachments() {
    ensure();
    return S.selected.length ? `<div class="cc-chat-results" aria-label="Tool results attached to next message">${S.selected.map(r => `<span>${icon('file')}${esc(r.label)}<button type="button" data-action="cc-chat-remove" data-id="${r.id}" aria-label="Remove ${esc(r.label)}">${icon('x')}</button></span>`).join('')}</div>` : '';
  }
  // Opened from an AI Team card: the connection, the tool and the agent's suggested inputs, ready for review.
  async function operate(id, type, name, args) {
    await open(id); if (!S.detail || S.detail.connection.id !== id) return;
    operation(type, name);
    const ta = document.querySelector('[data-ccform="operation"] textarea[name="arguments"]');
    if (ta && args && typeof args === 'object' && Object.keys(args).length) ta.value = JSON.stringify(args, null, 2);
  }
  // The switch on a Connections card: pause or enable without opening the drawer.
  async function setEnabled(id, enabled) {
    const k = ensure(), r = S.rows.find(x => x.id === id); if (!r || r.enabled === enabled) return;
    const result = await api('update', { id: r.id, revision: r.revision, enabled });
    if (k !== key()) return;
    if (result.connection) S.rows = S.rows.map(x => x.id === id ? result.connection : x);
    render(); U.toast(enabled ? r.name + ' enabled.' : r.name + ' paused.');
  }
  window.CustomConnections = { view, library: libraryView, load, open, operate, setEnabled, state: () => (ensure(), S), attachments,
    request: () => (ensure(), { connection_runs: S.selected.map(r => r.id) }),
    consumed: () => { ensure(); S.selected = []; }, reset: () => { S.key = ''; ensure(); } };
})();

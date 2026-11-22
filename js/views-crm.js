// CRM: one HighLevel pipeline as a board. HighLevel stays the source of truth; every move is written straight back.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, { esc, icon } = U;
  const live = () => !!window.App?.isLive(), ws = () => window.App?.liveCtx().ws?.id, key = () => [live() ? 'live' : 'demo', ws()].join(':');
  const S = { key: null, loaded: false, loading: false, error: '', board: null, pipeline: '', status: 'open', q: '', busy: {}, place: null };
  const onView = () => VS.view === 'crm';
  const render = () => { if (onView()) window.App.render(true); };
  const api = (action, body = {}) => window.Auth.inboxApi(action, { workspace_id: ws(), ...body });
  const STATUSES = [['open', 'Open'], ['won', 'Won'], ['lost', 'Lost'], ['abandoned', 'Abandoned']];

  /* ---------- demo: a sample Founder Pipeline so the screen can be explored without HighLevel ---------- */
  const DEMO_STAGES = [['d1', 'Freebie Leads'], ['d2', 'Free Community'], ['d3', '$37 Low Ticket Offer'], ['d4', '$297 Mid Ticket'], ['d5', '$997/97/m Membership'], ['d6', '$5K DFY']].map(([id, name]) => ({ id, name }));
  const DEMO_PEOPLE = [['Maya Lindqvist', 'd1', 0, 1], ['Tom Okafor', 'd1', 0, 3], ['Sara Virtanen', 'd1', 0, 6], ['Leo Brandt', 'd2', 0, 2], ['Ines Duarte', 'd2', 0, 9], ['Kai Nakamura', 'd2', 0, 12], ['Noah Petersen', 'd3', 37, 4], ['Amira Haddad', 'd3', 37, 8], ['Jonas Berg', 'd4', 297, 5], ['Elena Rossi', 'd4', 297, 15], ['Daniel Kim', 'd5', 997, 11], ['Freya Holm', 'd6', 5000, 20]];
  function demoBoard() {
    const now = Date.now();
    const pipe = { id: 'demo-founder', name: 'Founder Pipeline', stages: DEMO_STAGES };
    return { demo: true, location_id: '', pipelines: [pipe], pipeline: pipe, status: 'open', at: new Date().toISOString(),
      opportunities: DEMO_PEOPLE.map(([name, st, v, d], i) => { const email = name.toLowerCase().replace(/\s+/g, '.') + '@example.com'; return { id: 'demo' + i, name, stage_id: st, pipeline_id: pipe.id, status: 'open', value: v, source: i % 3 ? 'Funnel' : 'YouTube', created_at: new Date(now - (d + 10) * 864e5).toISOString(), stage_at: new Date(now - d * 864e5).toISOString(), contact: { id: 'c' + i, name, email, phone: '', company: '', tags: i % 2 ? ['freebie'] : ['youtube'] } }; }) };
  }

  function scope() { const k = key(); if (S.key !== k) Object.assign(S, { key: k, loaded: false, loading: false, error: '', board: null, pipeline: '', status: 'open', q: '', busy: {}, place: null }); return k; }
  async function load(force = false, quiet = false) {
    const k = scope(); if (S.loading) { if (force) S.again = true; return; } if (S.loaded && !force) return; S.loading = true; if (force && !quiet) render();
    try {
      const board = live() ? await api('crm-board', { pipeline_id: S.pipeline || undefined, status: S.status, q: S.q.trim() || undefined }) : (S.board && S.board.demo ? S.board : demoBoard());
      if (k !== key()) return; S.board = board; S.pipeline = board.pipeline ? board.pipeline.id : ''; S.loaded = true; S.error = '';
    } catch (e) { if (k === key()) { S.error = e.message || 'Could not load the pipeline'; S.loaded = true; } }
    finally { if (k === key()) { S.loading = false; if (S.again) { S.again = false; return load(true, true); } render(); } }
  }

  const ago = (t) => { if (!t) return ''; const m = Math.max(0, (Date.now() - new Date(t)) / 6e4); if (m < 60) return Math.round(m) + 'm'; if (m < 1440) return Math.round(m / 60) + 'h'; const d = Math.round(m / 1440); return d < 60 ? d + 'd' : Math.round(d / 30) + 'mo'; };
  const hlUrl = () => S.board && S.board.location_id ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(S.board.location_id)}/opportunities/list` : '';
  const contactUrl = (o) => S.board && S.board.location_id && o.contact.id ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(S.board.location_id)}/contacts/detail/${encodeURIComponent(o.contact.id)}` : '';
  const count = (sid) => { const c = S.board?.counts?.[sid]; return c ? c.total : (S.board?.opportunities || []).filter((o) => o.stage_id === sid && (S.status === 'all' || o.status === S.status)).length; };
  const bump = (sid, n) => { const c = S.board?.counts?.[sid]; if (c) c.total = Math.max(0, c.total + n); };
  const find = (id) => (S.board?.opportunities || []).find((o) => o.id === id);
  const stages = () => S.board?.pipeline?.stages || [];
  const matches = (o) => { const q = S.q.trim().toLowerCase(); if (S.status !== 'all' && o.status !== S.status) return false; return !q || !S.board.demo || [o.name, o.contact.name, o.contact.email, o.contact.phone, ...(o.contact.tags || [])].join(' ').toLowerCase().includes(q); };

  function card(o) {
    const sub = o.contact.email || o.contact.phone || '';
    const opts = stages().map((s) => `<option value="${esc(s.id)}" ${s.id === o.stage_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    return `<article class="crm-card${S.busy[o.id] ? ' busy' : ''}${o.status !== 'open' ? ' closed' : ''}" draggable="true" data-crm-card="${esc(o.id)}">
      <button class="crm-open" data-action="crm-open" data-id="${esc(o.id)}"><b>${esc(o.contact.name || o.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</button>
      <div class="crm-meta">${o.status !== 'open' ? `<span class="crm-status ${esc(o.status)}">${esc(o.status)}</span>` : ''}${(o.contact.tags || []).slice(0, 2).map((t) => `<span class="crm-tag">${esc(t)}</span>`).join('')}<span class="crm-age" title="Time in this stage">${esc(ago(o.stage_at))}</span></div>
      <label class="crm-move"><span class="sr-only">Move ${esc(o.contact.name || o.name)} to</span><select data-action="crm-stage" data-id="${esc(o.id)}" ${S.busy[o.id] ? 'disabled' : ''}>${opts}</select></label>
    </article>`;
  }

  function more(sid, shown) {
    const c = S.board?.counts?.[sid]; if (!c || !c.next) return '';
    const left = Math.max(0, c.total - shown);
    return `<button class="btn sm ghost crm-more" data-action="crm-more" data-stage="${esc(sid)}" ${S.busy['more:' + sid] ? 'disabled' : ''}>${S.busy['more:' + sid] ? U.spin + 'Loading' : `Load more${left ? ` · ${left.toLocaleString()} left` : ''}`}</button>`;
  }
  function boardHtml() {
    const opps = (S.board.opportunities || []).filter(matches);
    return `<div class="crm-board" role="list">${stages().map((s) => { const list = opps.filter((o) => o.stage_id === s.id); return `<section class="crm-col" role="listitem" data-crm-col="${esc(s.id)}" aria-label="${esc(s.name)}">
      <header><h2 title="${esc(s.name)}">${esc(s.name)}</h2><span class="crm-count">${count(s.id).toLocaleString()}</span><button class="btn icon ghost sm" data-action="crm-place" data-stage="${esc(s.id)}" aria-label="Add people to ${esc(s.name)} by email" title="Add by email">${icon('plus')}</button></header>
      <div class="crm-list">${list.map(card).join('') || `<p class="crm-none">${S.q.trim() ? 'No matches' : 'Nobody here yet'}</p>`}${more(s.id, list.length)}</div></section>`; }).join('')}</div>`;
  }

  function view() {
    scope(); if (!S.loaded && !S.loading) setTimeout(() => load(), 0);
    const b = S.board, url = hlUrl();
    const actions = `${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open in HighLevel</a>` : ''}<button class="btn" data-action="crm-refresh" ${S.loading ? 'disabled' : ''}>${S.loading ? U.spin + 'Refreshing' : 'Refresh'}</button><button class="btn primary" data-action="crm-place" ${b && b.pipeline ? '' : 'disabled'}>Add by email</button>`;
    const head = U.title('CRM', live() ? 'Your HighLevel pipeline as a board. Drag a card or pick a stage and HighLevel updates right away.' : 'Sample data. Connect HighLevel and this board shows your real pipeline.', actions);
    if (S.error) return head + `<section class="panel">${U.empty('The pipeline did not load', esc(S.error), `<div class="row-actions"><button class="btn" data-action="crm-refresh">Try again</button><button class="btn ghost" data-action="go" data-go="connect">Connections</button></div>`)}</section>`;
    if (!b) return head + `<section class="panel"><p class="muted">${U.spin}Loading your pipeline</p></section>`;
    if (!b.pipeline) return head + `<section class="panel">${U.empty('No pipelines in HighLevel yet', 'Create a pipeline in HighLevel under Opportunities, then refresh.')}</section>`;
    const total = b.total != null ? b.total : (b.opportunities || []).filter((o) => S.status === 'all' || o.status === S.status).length;
    const bar = `<div class="crm-bar">
      <label class="crm-field"><span>Pipeline</span><select data-action="crm-pipeline">${b.pipelines.map((p) => `<option value="${esc(p.id)}" ${p.id === b.pipeline.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="crm-field"><span>Show</span><select data-action="crm-status">${[...STATUSES, ['all', 'All']].map(([k, n]) => `<option value="${k}" ${S.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="crm-field grow"><span>Search</span><input type="search" id="crm-q" value="${esc(S.q)}" placeholder="Name, email or tag" autocomplete="off"></label>
      <span class="meta crm-total">${total.toLocaleString()} ${total === 1 ? 'person' : 'people'}${S.q.trim() && !b.demo ? ' found' : ''}${b.demo ? ' · sample' : ''}</span></div>`;
    return head + bar + boardHtml();
  }
  V.crm = view; V.crm.live = view;

  /* ---------- moves ---------- */
  async function move(id, patch) {
    const o = find(id); if (!o || S.busy[id]) return;
    const before = { stage_id: o.stage_id, status: o.status };
    if (patch.stage_id === o.stage_id && (!patch.status || patch.status === o.status)) return;
    const shown = (x) => S.status === 'all' || x === S.status;
    const recount = (from, to, sign) => { if (shown(from.status)) bump(from.stage_id, -sign); if (shown(to.status)) bump(to.stage_id, sign); if (S.board.total != null) S.board.total += sign * ((shown(to.status) ? 1 : 0) - (shown(from.status) ? 1 : 0)); };
    const after = { stage_id: patch.stage_id || o.stage_id, status: patch.status || o.status };
    recount(before, after, 1);
    Object.assign(o, patch, { stage_at: patch.stage_id && patch.stage_id !== o.stage_id ? new Date().toISOString() : o.stage_at });
    if (S.board.demo) { render(); refreshDrawer(id); return U.toast(patch.status && patch.status !== 'open' ? `Marked ${patch.status}` : 'Moved'); }
    S.busy[id] = true; render(); refreshDrawer(id);
    try {
      const r = await api('crm-move', { id, pipeline_id: S.board.pipeline.id, stage_id: patch.stage_id, status: patch.status });
      if (r.opportunity) Object.assign(o, { stage_id: r.opportunity.stage_id || o.stage_id, status: r.opportunity.status || o.status, stage_at: r.opportunity.stage_at || o.stage_at });
      U.toast(patch.status && patch.status !== 'open' ? `Marked ${patch.status} in HighLevel` : 'Moved in HighLevel');
    } catch (e) { recount(before, after, -1); Object.assign(o, before); U.toast(e.message || 'HighLevel did not accept the move'); }
    finally { delete S.busy[id]; render(); refreshDrawer(id); }
  }

  function drawerHtml(o) {
    const st = stages().find((s) => s.id === o.stage_id), cu = contactUrl(o);
    const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
    return `<div class="crm-drawer" data-crm-drawer="${esc(o.id)}"><p class="eyebrow">${esc(S.board.pipeline.name)}</p><h2>${esc(o.contact.name || o.name)}</h2>
      <dl class="crm-dl">${row('Email', o.contact.email ? `<a href="mailto:${esc(o.contact.email)}">${esc(o.contact.email)}</a>` : '')}${row('Phone', esc(o.contact.phone))}${row('Company', esc(o.contact.company))}${row('Stage', esc(st ? st.name : 'Unknown'))}${row('In stage', esc(ago(o.stage_at)))}${row('Source', esc(o.source))}${row('Value', o.value ? esc('$' + Number(o.value).toLocaleString()) : '')}${row('Tags', (o.contact.tags || []).map((t) => `<span class="crm-tag">${esc(t)}</span>`).join(' '))}${row('Opportunity', esc(o.name))}</dl>
      <label class="os-field wide"><span>Stage</span><select data-action="crm-stage" data-id="${esc(o.id)}" ${S.busy[o.id] ? 'disabled' : ''}>${stages().map((s) => `<option value="${esc(s.id)}" ${s.id === o.stage_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <div class="crm-statuses" role="group" aria-label="Status">${STATUSES.map(([k, n]) => `<button class="btn sm${o.status === k ? ' primary' : ''}" data-action="crm-set-status" data-id="${esc(o.id)}" data-status="${k}" ${S.busy[o.id] ? 'disabled' : ''} aria-pressed="${o.status === k}">${n}</button>`).join('')}</div>
      ${cu ? `<p><a class="btn" href="${esc(cu)}" target="_blank" rel="noopener">Open contact in HighLevel</a></p>` : ''}</div>`;
  }
  function refreshDrawer(id) { const d = document.querySelector('#drawer.open [data-crm-drawer]'); if (d && d.dataset.crmDrawer === id) { const o = find(id); if (o) U.drawer(drawerHtml(o), { label: 'Contact' }); } }

  /* ---------- add by email ---------- */
  function placeHtml() {
    const p = S.place;
    return `<form class="crm-place" data-nosubmit><p class="eyebrow">${esc(S.board.pipeline.name)}</p><h2>Add people by email</h2>
      <p class="muted">Paste emails, one per line or separated by commas. People already in this pipeline move to the stage; contacts without an opportunity get one. Founders OS sends nothing itself, but any HighLevel workflow you trigger on stage changes still runs.</p>
      <label class="os-field wide"><span>Stage</span><select id="crm-place-stage">${stages().map((s) => `<option value="${esc(s.id)}" ${s.id === p.stage ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="os-field wide"><span>Emails</span><textarea id="crm-place-emails" rows="8" placeholder="name@example.com" data-autofocus ${p.busy ? 'disabled' : ''}>${esc(p.text)}</textarea></label>
      <label class="crm-check"><input type="checkbox" id="crm-place-create" ${p.create ? 'checked' : ''}><span>Create a contact in HighLevel for emails it does not know yet</span></label>
      <p><button type="button" class="btn primary" data-action="crm-place-go" ${p.busy ? 'disabled' : ''}>${p.busy ? U.spin + 'Updating HighLevel' : 'Place in stage'}</button></p>
      ${p.results ? `<ul class="crm-results">${p.results.map((r) => `<li class="${esc(r.result)}"><span>${esc(r.email)}</span><b>${esc(LABEL[r.result] || r.result)}</b>${r.error ? `<small>${esc(r.error)}</small>` : ''}</li>`).join('')}</ul>` : ''}</form>`;
  }
  const LABEL = { moved: 'Moved', created: 'Added to pipeline', 'created-contact': 'New contact added', already: 'Already there', 'no-contact': 'Not in HighLevel', error: 'Failed' };
  const parseEmails = (t) => [...new Set(String(t || '').toLowerCase().split(/[\s,;<>"']+/).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

  ACT['crm-refresh'] = () => load(true);
  ACT['crm-more'] = async (el) => {
    const sid = el.dataset.stage, c = S.board?.counts?.[sid]; if (!c || !c.next || S.busy['more:' + sid]) return;
    const k = key(); S.busy['more:' + sid] = true; render();
    try {
      const r = await api('crm-stage', { pipeline_id: S.board.pipeline.id, stage_id: sid, status: S.status, q: S.q.trim() || undefined, next: c.next });
      if (k !== key()) return;
      const have = new Set(S.board.opportunities.map((o) => o.id));
      (r.opportunities || []).forEach((o) => { if (!have.has(o.id)) S.board.opportunities.push(o); });
      c.next = r.next; c.total = r.total;
    } catch (e) { U.toast(e.message || 'Could not load more'); }
    finally { delete S.busy['more:' + sid]; render(); }
  };
  ACT['crm-pipeline'] = (el) => { S.pipeline = el.value; S.board = null; S.loaded = false; load(true); };
  ACT['crm-status'] = (el) => { S.status = el.value; if (S.board && S.board.demo) return render(); S.loaded = false; load(true); };
  ACT['crm-stage'] = (el) => move(el.dataset.id, { stage_id: el.value, status: 'open' });
  ACT['crm-set-status'] = (el) => move(el.dataset.id, { status: el.dataset.status });
  ACT['crm-open'] = (el) => { const o = find(el.dataset.id); if (o) U.drawer(drawerHtml(o), { label: 'Contact' }); };
  ACT['crm-place'] = (el) => { if (!S.board?.pipeline) return; S.place = { stage: el.dataset.stage || stages()[0]?.id, text: '', create: false, busy: false, results: null }; U.drawer(placeHtml(), { label: 'Add by email' }); };
  ACT['crm-place-go'] = async () => {
    const p = S.place; if (!p || p.busy) return;
    p.stage = document.getElementById('crm-place-stage').value; p.text = document.getElementById('crm-place-emails').value; p.create = document.getElementById('crm-place-create').checked;
    const emails = parseEmails(p.text);
    if (!emails.length) return U.toast('Add at least one email');
    p.busy = true; p.results = null; U.drawer(placeHtml(), { label: 'Add by email' });
    const out = [];
    try {
      if (S.board.demo) {
        emails.forEach((email) => { const o = S.board.opportunities.find((x) => x.contact.email === email); if (o) { const same = o.stage_id === p.stage; o.stage_id = p.stage; o.status = 'open'; if (!same) o.stage_at = new Date().toISOString(); out.push({ email, result: same ? 'already' : 'moved' }); } else if (p.create) { const name = email.split('@')[0]; S.board.opportunities.push({ id: 'demo' + Math.random().toString(36).slice(2), name, stage_id: p.stage, pipeline_id: S.board.pipeline.id, status: 'open', value: null, source: 'Founders OS CRM', created_at: new Date().toISOString(), stage_at: new Date().toISOString(), contact: { id: '', name, email, phone: '', company: '', tags: [] } }); out.push({ email, result: 'created-contact' }); } else out.push({ email, result: 'no-contact' }); });
      } else {
        for (let i = 0; i < emails.length; i += 40) { const r = await api('crm-place', { pipeline_id: S.board.pipeline.id, stage_id: p.stage, emails: emails.slice(i, i + 40), create_contacts: p.create }); out.push(...(r.results || [])); p.results = out.slice(); if (S.place === p) U.drawer(placeHtml(), { label: 'Add by email' }); }
      }
      const n = (k) => out.filter((r) => r.result === k).length, done = n('moved') + n('created') + n('created-contact');
      U.toast(`${done} placed${n('already') ? `, ${n('already')} already there` : ''}${n('no-contact') ? `, ${n('no-contact')} not in HighLevel` : ''}`);
    } catch (e) { U.toast(e.message || 'HighLevel did not respond'); }
    finally { p.busy = false; p.results = out; if (S.place === p) U.drawer(placeHtml(), { label: 'Add by email' }); if (!S.board.demo) { S.loaded = false; load(true); } else render(); }
  };

  /* ---------- search and drag and drop (delegated once) ---------- */
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'crm-q') return; S.q = e.target.value;
    if (S.board && !S.board.demo) { clearTimeout(S.qt); S.qt = setTimeout(() => { S.loaded = false; load(true, true).then(() => { const q = document.getElementById('crm-q'); if (q && (document.activeElement === document.body || !document.activeElement)) { q.focus(); const n = q.value.length; try { q.setSelectionRange(n, n); } catch (err) { /* search */ } } }); }, 350); return; }
    const pos = e.target.selectionStart; const b = document.querySelector('.crm-board'); if (!b) return;
    b.outerHTML = boardHtml();
    const q = document.getElementById('crm-q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (err) { /* search inputs */ } }
  });
  let dragId = null;
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-crm-card]'); if (!c) return; dragId = c.dataset.crmCard; c.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* old browsers */ } });
  document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.crm-card.dragging,.crm-col.over').forEach((x) => x.classList.remove('dragging', 'over')); });
  document.addEventListener('dragover', (e) => { const col = dragId && e.target.closest && e.target.closest('[data-crm-col]'); if (!col) return; e.preventDefault(); document.querySelectorAll('.crm-col.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); });
  document.addEventListener('drop', (e) => { const col = dragId && e.target.closest && e.target.closest('[data-crm-col]'); if (!col) return; e.preventDefault(); const id = dragId; dragId = null; col.classList.remove('over'); move(id, { stage_id: col.dataset.crmCol, status: 'open' }); });

  window.OSCrm = { state: S, load };
})();

// HighLevel sync: every way Founders OS writes into or reads from HighLevel, in one place.
// Nothing is sent without a click and a confirm. Conversations are never read.
(() => {
  const U = window.UI, ACT = window.ACT, { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const wsId = () => (isLive() && ctx().ws ? ctx().ws.id : null);
  const api = (action, body = {}) => window.Auth.hlApi(action, { workspace_id: wsId(), ...body });
  const hlOn = () => (isLive() ? (ctx().conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected') : true);
  const ago = (iso) => (window.DNA && window.DNA.ago && iso ? window.DNA.ago(iso) : '');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const needHL = () => { if (hlOn()) return false; U.toast('Connect HighLevel first. Settings, Connections, HighLevel.'); return true; };
  const fail = (e) => U.toast((window.Auth && window.Auth.friendly ? window.Auth.friendly(e) : e.message) || 'HighLevel did not accept that');
  const busy = (el, txt) => { if (!el) return () => {}; const h = el.innerHTML; el.disabled = true; el.innerHTML = U.spin + esc(txt); return () => { el.disabled = false; el.innerHTML = h; }; };

  /* ---------- demo data, so every flow can be tried without a key ---------- */
  const DEMO = {
    accounts: [{ id: 'd-li', name: 'Avery Cole', platform: 'linkedin' }, { id: 'd-ig', name: 'averycole', platform: 'instagram' }, { id: 'd-fb', name: 'Avery Cole', platform: 'facebook' }, { id: 'd-yt', name: 'Avery Cole', platform: 'youtube' }],
    blogs: [{ id: 'd-blog', name: 'Avery Cole Blog' }],
    forms: { days: 30, forms: [{ id: 'f1', name: 'Founder Snapshot opt-in', submissions: 214 }, { id: 'f2', name: 'Book a call', submissions: 37 }, { id: 'f3', name: 'Affiliate bonus claim', submissions: 19 }], surveys: [{ id: 's1', name: 'Founder Path quiz', submissions: 88 }], total: 358 },
    events: [
      { type: 'ContactCreate', name: 'Maria L.', source: 'Founder Snapshot opt-in', at: new Date(Date.now() - 12 * 6e4).toISOString(), via: 'app' },
      { type: 'AppointmentCreate', name: 'Jon P.', title: 'Strategy call', at: new Date(Date.now() - 58 * 6e4).toISOString(), via: 'app' },
      { type: 'OpportunityStageUpdate', name: 'Sara K.', stage: 'stage moved', at: new Date(Date.now() - 3 * 36e5).toISOString(), via: 'workflow' },
      { type: 'FormSubmitted', name: 'Alex T.', source: 'Book a call', at: new Date(Date.now() - 5 * 36e5).toISOString(), via: 'workflow' },
    ],
  };

  /* ---------- status and the sync hub ---------- */
  const S = { status: null, at: 0, forms: null, formsAt: 0, formsLoading: false, formsErr: '', days: 30 };
  async function status(fresh) {
    if (!isLive()) return { connected: true, location: 'Demo sub-account', via: 'token', app: false, redirect_uri: location.origin + '/api/highlevel?oauth=hl', webhook_url: location.origin + '/api/highlevel?hook=app', workflows: { status: 'connected', count: 41 }, events: DEMO.events };
    if (S.status && !fresh && Date.now() - S.at < 60e3) return S.status;
    S.status = await api('status'); S.at = Date.now(); return S.status;
  }
  const EV = { ContactCreate: 'New contact', ContactUpdate: 'Contact updated', ContactTagUpdate: 'Tag changed', AppointmentCreate: 'Call booked', AppointmentUpdate: 'Call updated', OpportunityCreate: 'New deal', OpportunityStageUpdate: 'Deal moved forward', OpportunityStatusUpdate: 'Deal status changed', OrderCreate: 'New order', InvoicePaid: 'Invoice paid', FormSubmitted: 'Form submitted', SurveySubmitted: 'Survey submitted' };
  const evLabel = (t) => EV[t] || String(t || 'Event').replace(/([a-z])([A-Z])/g, '$1 $2');
  // Amounts stay out of this feed on purpose. Revenue lives on its own page.
  const evRow = (e) => `<div class="hs-ev"><span class="hs-ev-t">${esc(evLabel(e.type))}</span><span class="grow">${esc([e.name, e.title, e.source].filter(Boolean).join(' · ') || '')}</span><span class="meta">${esc(ago(e.at))}${e.via === 'workflow' ? ' · workflow' : ''}</span></div>`;

  const CONNS = [
    ['Approved posts', 'Content board: Send to Social Planner. Draft or scheduled, plus an optional blog draft.', '#content'],
    ['Funnel Agent builds', 'Funnel, HighLevel tab: products and prices, page images to the Media Library, email templates.', '#funnel-agent'],
    ['Programs', 'Programs: Send to HighLevel. Imports a draft course with every module and lesson.', '#programs'],
    ['Brand DNA', 'Custom values named FOS, so every funnel, email and workflow reads the same offer, price and link.', null],
    ['Form results', 'Submissions for the last 30 days, on the Funnels page.', '#funnels'],
    ['HighLevel AI Agents', 'Add Founders OS as an MCP server, with a token that only shares public business facts.', '#mcp'],
    ['AI Team', 'Agents read HighLevel live over its MCP server when you ask about contacts, deals, calls or payments. Read only. Conversations are blocked.', '#team'],
    ['Live events', 'New contacts, booked calls, deals and form submissions arrive here as they happen.', null],
  ];

  async function hub() {
    U.drawer(`<div><p class="meta">Connections · HighLevel</p><h2>HighLevel sync</h2></div><div class="dsec" role="status"><p class="meta">${U.spin}Checking HighLevel</p></div>`, { label: 'HighLevel sync', push: true, wide: true });
    let s; try { s = await status(true); } catch (e) { s = { connected: hlOn(), error: e.message, events: [] }; }
    const conn = s.connected ? `<p>${esc(s.location || 'HighLevel sub-account')} <span class="pill out">${s.via === 'app' ? 'HighLevel app' : 'Private Integration'}</span></p>` : '<p class="muted">Not connected yet.</p>';
    const appBlock = s.app
      ? `<p class="muted">Sign in with HighLevel instead of pasting a token. Access refreshes on its own, and events arrive the moment they happen.</p><div class="actions" style="margin-top:10px"><button class="btn ${s.via === 'app' ? '' : 'primary'}" data-action="hs-oauth" ${isLive() ? '' : 'disabled'}>${s.via === 'app' ? 'Reconnect with HighLevel' : 'Connect with HighLevel'}</button></div>`
      : `<p class="muted">One-click sign-in and instant events need a HighLevel Marketplace app. Create one in the HighLevel developer portal, then set HL_APP_CLIENT_ID and HL_APP_CLIENT_SECRET on the server.</p>
         <div class="code-row" style="margin-top:8px"><code class="mono">${esc(s.redirect_uri || '')}</code><button class="btn sm" data-action="hs-copy" data-v="${esc(s.redirect_uri || '')}">Copy</button></div><p class="meta">Redirect URL</p>
         <div class="code-row" style="margin-top:8px"><code class="mono">${esc(s.webhook_url || '')}</code><button class="btn sm" data-action="hs-copy" data-v="${esc(s.webhook_url || '')}">Copy</button></div><p class="meta">Webhook URL</p>`;
    const evs = (s.events || []).slice(0, 12);
    U.drawer(`<div><p class="meta">Connections · HighLevel</p><h2>HighLevel sync</h2></div>
      <div class="dsec"><h3>Connection</h3>${conn}${s.error ? `<p class="meta">${esc(s.error)}</p>` : ''}${!s.connected ? `<div class="actions" style="margin-top:10px"><button class="btn primary" data-action="hl-conn">Connect HighLevel</button></div>` : ''}</div>
      <div class="dsec"><h3>What syncs</h3><div class="hs-list">${CONNS.map(([t, d, href]) => `<div class="hs-item"><div class="grow"><b>${esc(t)}</b><p class="meta">${esc(d)}</p></div>${t === 'Brand DNA' ? `<button class="btn sm" data-action="hl-values">Preview</button>` : href ? `<a class="btn sm ghost" href="${href}" data-action="hs-go">Open</a>` : ''}</div>`).join('')}</div></div>
      <div class="dsec"><h3>Live events</h3>${evs.length ? `<div class="hs-evs">${evs.map(evRow).join('')}</div>` : `<p class="muted">No events yet. ${s.workflows ? 'Workflow webhooks are set up and waiting.' : 'Turn on HighLevel workflow events under Connections, or connect the HighLevel app.'}</p>`}${s.workflows && s.workflows.count ? `<p class="meta" style="margin-top:6px">${s.workflows.count} workflow events received${s.workflows.last ? ', last ' + esc(ago(s.workflows.last)) : ''}.</p>` : ''}</div>
      <div class="dsec"><h3>HighLevel app</h3>${appBlock}</div>
      <div class="dsec"><h3>What never happens</h3><ul class="plain-list"><li>Conversations, messages and emails are never read.</li><li>Nothing is published or sent to a customer from here. Posts land as drafts unless you pick a time.</li><li>People only move forward in pipelines.</li><li>Only custom values named FOS are ever changed.</li></ul></div>`, { label: 'HighLevel sync', wide: true });
  }
  ACT['hl-sync'] = hub;
  ACT['hs-copy'] = (el) => U.copy(el.dataset.v);
  ACT['hs-go'] = () => U.closeDrawer();
  ACT['hs-oauth'] = async (el) => {
    const done = busy(el, 'Opening HighLevel');
    try { const r = await api('oauth-start'); location.href = r.url; } catch (e) { done(); fail(e); }
  };

  // HighLevel sends people back to #connect?hl_code=... Capture it before anything cleans the address bar.
  const RET = /^#connect\?.*hl_(code|error)=/.test(location.hash) ? new URLSearchParams(location.hash.split('?')[1]) : null;
  if (RET) {
    history.replaceState(null, '', location.pathname + '#connect');
    (async () => {
      if (RET.get('hl_error')) return setTimeout(() => U.toast('HighLevel sign-in was cancelled: ' + RET.get('hl_error')), 600);
      for (let i = 0; i < 60 && !wsId(); i++) await wait(500);
      if (!wsId()) return U.toast('Sign in to Founders OS, then connect HighLevel again.');
      try { const r = await api('oauth-finish', { code: RET.get('hl_code'), state: RET.get('hl_state') }); await window.App.reloadConns(); window.App.render(true); U.toast('HighLevel connected: ' + r.location); } catch (e) { fail(e); }
    })();
  }

  /* ---------- Social Planner and blog ---------- */
  async function social({ text = '', title = '', when = '' } = {}) {
    if (!String(text).trim()) return U.toast('Write the post first');
    if (needHL()) return;
    U.drawer(`<div><p class="meta">HighLevel · Social Planner</p><h2>Send to Social Planner</h2></div><div class="dsec" role="status"><p class="meta">${U.spin}Loading your accounts</p></div>`, { label: 'Send to Social Planner', push: true });
    let accts = [], blogs = [], err = '';
    try {
      if (isLive()) { const [a, b] = await Promise.all([api('social-accounts'), api('blog-sites').catch(() => ({ blogs: [] }))]); accts = a.accounts || []; blogs = b.blogs || []; }
      else { accts = DEMO.accounts; blogs = DEMO.blogs; }
    } catch (e) { err = e.message; }
    const local = when ? new Date(when) : null; const pre = local && local > new Date(Date.now() + 6 * 60e3) ? new Date(local - local.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
    U.drawer(`<div><p class="meta">HighLevel · Social Planner</p><h2>Send to Social Planner</h2></div>
      <form class="fd hs-social" data-hsform="social">
        <label class="field"><span>Post</span><textarea name="text" rows="8">${esc(text)}</textarea></label>
        <div class="field"><span>Accounts</span>${err ? `<p class="meta">${esc(err)}</p>` : accts.length ? `<div class="hs-accts">${accts.map((a) => `<label class="hs-acct"><input type="checkbox" name="acct" value="${esc(a.id)}" ${a.expired ? 'disabled' : ''}><span>${esc(a.name)}</span><span class="meta">${esc(a.platform || '')}${a.expired ? ' · reconnect in HighLevel' : ''}</span></label>`).join('')}</div>` : '<p class="meta">No social accounts are connected in HighLevel yet. A draft still works.</p>'}</div>
        <div class="field"><span>When</span><div class="hs-when"><label><input type="radio" name="mode" value="draft" ${pre ? '' : 'checked'}> Save as a draft</label><label><input type="radio" name="mode" value="schedule" ${pre ? 'checked' : ''}> Schedule</label><input type="datetime-local" name="at" value="${esc(pre)}" aria-label="Schedule time"></div></div>
        <label class="field"><span>Image or video URL, optional</span><input name="media" type="url" placeholder="https://"></label>
        <div class="actions end"><button class="btn primary" type="submit">Send to HighLevel</button></div>
      </form>
      ${blogs.length ? `<div class="dsec"><h3>Also as a blog draft</h3><form class="fd" data-hsform="blog"><input type="hidden" name="text" value="${esc(text)}"><label class="field"><span>Title</span><input name="title" value="${esc(title)}"></label><label class="field"><span>Blog</span><select name="blog">${blogs.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></label><div class="actions end"><button class="btn" type="submit">Save blog draft</button></div></form></div>` : ''}
      <p class="meta">Drafts wait in HighLevel until you publish them there. Scheduled posts go out at the time you pick.</p>`, { label: 'Send to Social Planner' });
  }
  async function sendSocial(f) {
    const v = new FormData(f); const ids = v.getAll('acct'); const sched = v.get('mode') === 'schedule'; const at = v.get('at');
    if (sched && !at) return U.toast('Pick a time to schedule');
    if (sched && !ids.length) return U.toast('Pick at least one account to schedule on');
    const label = sched ? `Schedule for ${new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} on ${ids.length} account${ids.length === 1 ? '' : 's'}?` : 'Save this post as a draft in Social Planner?';
    if (!await U.dialog({ title: label, body: sched ? 'HighLevel will publish it at that time. You can still edit or delete it in Social Planner before then.' : 'Nothing is published. It waits in Social Planner as a draft.', ok: sched ? 'Schedule' : 'Save draft' })) return;
    const done = busy(f.querySelector('button[type=submit]'), 'Sending');
    try {
      if (isLive()) await api('social-post', { text: v.get('text'), account_ids: ids, schedule_at: sched ? new Date(at).toISOString() : null, media_url: v.get('media') || null });
      else await wait(400);
      U.closeDrawer(); U.toast(sched ? 'Scheduled in HighLevel Social Planner' : 'Saved as a draft in HighLevel Social Planner');
    } catch (e) { done(); fail(e); }
  }
  async function sendBlog(f) {
    const v = new FormData(f);
    if (!await U.dialog({ title: 'Save as a blog draft?', body: 'It lands in HighLevel as a draft. Nothing is published.', ok: 'Save draft' })) return;
    const done = busy(f.querySelector('button[type=submit]'), 'Saving');
    try { if (isLive()) await api('blog-post', { blog_id: v.get('blog'), title: v.get('title'), text: v.get('text') }); else await wait(400); done(); U.toast('Blog draft saved in HighLevel'); } catch (e) { done(); fail(e); }
  }
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-hsform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    if (f.dataset.hsform === 'social') sendSocial(f); else if (f.dataset.hsform === 'blog') sendBlog(f);
  }, true);

  /* ---------- Brand DNA to custom values ---------- */
  const money = (n, cur) => { const x = Number(n); if (!Number.isFinite(x) || !x) return ''; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: x % 1 ? 2 : 0 }).format(x); } catch { return '$' + x; } };
  async function facts() {
    if (!isLive()) return ((window.Store && window.Store.s.brain && window.Store.s.brain.facts) || []).filter((f) => !f.status || f.status === 'approved');
    try { return (await window.Auth.facts.list(wsId())).filter((f) => f.status === 'approved'); } catch { return []; }
  }
  async function valueItems() {
    const d = window.DNA ? window.DNA.data() : { items: [] }; const live = (d.items || []).filter((i) => i.included);
    const offers = live.filter((i) => i.kind === 'offer').slice(0, 3); const funnel = live.find((i) => i.kind === 'funnel' && i.url);
    const fx = await facts(); const first = (cat) => (fx.find((f) => f.category === cat) || {}).statement || '';
    const ws = isLive() ? (ctx().ws || {}).name : 'Avery Cole';
    const out = [['FOS Business Name', ws]];
    offers.forEach((o, i) => { const n = i + 1; out.push([`FOS Offer ${n} Name`, o.name], [`FOS Offer ${n} Price`, money(o.price, o.currency)], [`FOS Offer ${n} Link`, o.url || ''], [`FOS Offer ${n} Promise`, o.summary || '']); });
    if (funnel) out.push(['FOS Main Funnel Link', funnel.url]);
    out.push(['FOS Founder Bio', first('identity')], ['FOS Audience', first('audience')], ['FOS Proof', first('proof')]);
    return out.filter(([, v]) => String(v || '').trim()).map(([name, value]) => ({ name, value: String(value).trim().slice(0, 1000) }));
  }
  const OP = { create: 'New', update: 'Changes', same: 'Same' };
  async function values() {
    if (needHL()) return;
    U.drawer(`<div><p class="meta">HighLevel · Custom values</p><h2>Brand DNA to HighLevel</h2></div><div class="dsec" role="status"><p class="meta">${U.spin}Comparing with HighLevel</p></div>`, { label: 'Brand DNA to HighLevel', push: true, wide: true });
    let items, rows;
    try {
      items = await valueItems(); if (!items.length) throw new Error('Add a live offer or approve a few facts first.');
      rows = isLive() ? (await api('values-preview', { items })).rows : items.map((x, i) => ({ ...x, op: i % 4 === 1 ? 'update' : i % 4 === 2 ? 'same' : 'create', before: i % 4 === 1 ? 'Old value' : i % 4 === 2 ? x.value : null, key: '{{ custom_values.' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + ' }}' }));
    } catch (e) { return U.drawer(`<div><p class="meta">HighLevel · Custom values</p><h2>Brand DNA to HighLevel</h2></div><div class="dsec"><p>${esc(e.message)}</p></div>`, { label: 'Brand DNA to HighLevel', wide: true }); }
    S.values = items; const changes = rows.filter((r) => r.op !== 'same').length;
    U.drawer(`<div><p class="meta">HighLevel · Custom values</p><h2>Brand DNA to HighLevel</h2></div>
      <div class="dsec"><p class="muted">Funnels, emails and workflows in HighLevel can read these as custom values. Only values named FOS are written. Your other custom values are never touched.</p></div>
      <div class="hs-values">${rows.map((r) => `<div class="hs-val" data-op="${r.op}"><div class="hs-val-h"><b>${esc(r.name)}</b><span class="pill ${r.op === 'same' ? 'out' : 'acc'}">${OP[r.op]}</span></div>${r.op === 'update' ? `<p class="meta hs-before">${esc(String(r.before || '').slice(0, 200))}</p>` : ''}<p>${esc(r.value.slice(0, 300))}</p>${r.key ? `<p class="meta mono">${esc(r.key)}</p>` : ''}</div>`).join('')}</div>
      <div class="actions end"><button class="btn primary" data-action="hs-values-apply" ${changes ? '' : 'disabled'}>${changes ? `Apply ${changes} change${changes === 1 ? '' : 's'}` : 'Already in sync'}</button></div>`, { label: 'Brand DNA to HighLevel', wide: true });
  }
  ACT['hl-values'] = values;
  ACT['hs-values-apply'] = async (el) => {
    if (!S.values) return;
    if (!await U.dialog({ title: 'Update HighLevel custom values?', body: 'New FOS values are created and changed ones are updated. Anything using them in HighLevel shows the new text right away.', ok: 'Apply' })) return;
    const done = busy(el, 'Updating HighLevel');
    try { const r = isLive() ? await api('values-apply', { items: S.values }) : (await wait(400), { done: S.values }); U.closeDrawer(); U.toast(`HighLevel custom values updated (${(r.done || []).filter((x) => x.op !== 'same').length || (r.done || []).length})`); } catch (e) { done(); fail(e); }
  };

  /* ---------- Programs to Courses ---------- */
  async function course(program) {
    if (needHL()) return;
    const mods = (program.modules || []).filter((m) => m.title); const lessons = mods.reduce((n, m) => n + (m.lessons || []).length, 0);
    if (!mods.length) return U.toast('Add at least one module first');
    let pv = { title: program.title, modules: mods.length, lessons };
    try { if (isLive()) pv = await api('course-preview', { program }); } catch (e) { return fail(e); }
    if (!await U.dialog({ title: 'Send to HighLevel Courses?', body: `${esc(pv.title)}: ${pv.modules} module${pv.modules === 1 ? '' : 's'} and ${pv.lessons} lesson${pv.lessons === 1 ? '' : 's'} are imported as a new draft course. Nobody sees it until you publish it in HighLevel. Sending again creates another copy.`, ok: 'Import draft course' })) return;
    try { if (isLive()) await api('course-import', { program }); else await wait(400); U.toast('Draft course created in HighLevel Memberships'); } catch (e) { fail(e); }
  }

  /* ---------- Funnel Agent build to HighLevel ---------- */
  async function funnel(id, el) {
    if (needHL()) return;
    const stop = busy(el, 'Checking');
    let p;
    try { p = isLive() ? await window.Auth.funnel.api('hl_plan', { id, workspace_id: wsId() }) : { products: [{ name: 'Main offer', price: 297, currency: 'USD', done: false }, { name: 'Order bump', price: 27, currency: 'USD', done: false }], images: [{ name: 'Hero image', done: false }], emails: [{ name: 'Welcome', when: 'Right after purchase', done: false }, { name: 'Day 2', when: 'Day 2', done: false }] }; } catch (e) { stop(); return fail(e); }
    stop();
    const part = (k, label, list, fmt) => list.length ? `<label class="hs-part"><input type="checkbox" name="${k}" ${list.every((x) => x.done) ? '' : 'checked'}><span><b>${label}</b><span class="meta"> ${list.map(fmt).join(', ')}</span></span></label>` : '';
    const body = `<div class="hs-parts">${part('products', 'Products and prices', p.products || [], (x) => esc(x.name) + (x.price ? ' ' + money(x.price, x.currency) : '') + (x.done ? ' (sent)' : ''))}${part('images', 'Page images to Media Library', p.images || [], (x) => esc(x.name) + (x.done ? ' (sent)' : ''))}${part('emails', 'Email templates', p.emails || [], (x) => esc(x.name) + (x.done ? ' (sent)' : ''))}</div><span class="meta">Anything already sent is skipped. Nothing is published or emailed.</span>`;
    const ok = await U.dialog({ title: 'Send this funnel to HighLevel?', body, ok: 'Send to HighLevel' });
    if (!ok) return;
    const parts = { products: ok.products === 'on', images: ok.images === 'on', emails: ok.emails === 'on' };
    if (!parts.products && !parts.images && !parts.emails) return U.toast('Nothing selected');
    const stop2 = busy(el, 'Sending to HighLevel');
    try {
      const r = isLive() ? await window.Auth.funnel.api('hl_send', { id, workspace_id: wsId(), parts }) : (await wait(500), { errors: [] });
      stop2(); const errs = r.errors || [];
      U.toast(errs.length ? `Sent with ${errs.length} issue${errs.length === 1 ? '' : 's'}: ${errs[0]}` : 'Sent to HighLevel. Products, images and email templates are ready there.');
    } catch (e) { stop2(); fail(e); }
  }
  ACT['hl-funnel'] = (el) => funnel(el.dataset.id, el);

  /* ---------- Forms and surveys on Funnels ---------- */
  function loadForms() {
    if (S.formsLoading) return; S.formsLoading = true; S.formsErr = '';
    const p = isLive() ? api('form-stats', { days: S.days }) : wait(150).then(() => DEMO.forms);
    p.then((r) => { S.forms = r; }).catch((e) => { S.formsErr = e.message; }).finally(() => { S.formsLoading = false; S.formsAt = Date.now(); S.formsWs = wsId(); const el = document.querySelector('.hs-forms-panel'); if (el) el.outerHTML = formsPanel(); });
  }
  function formsPanel() {
    if (!hlOn()) return '';
    if ((!S.formsAt || S.formsWs !== wsId() || Date.now() - S.formsAt > 10 * 60e3) && !S.formsLoading) loadForms();
    const f = S.forms; const rows = f ? [...(f.forms || []), ...(f.surveys || [])].filter((x) => x.submissions).sort((a, b) => b.submissions - a.submissions).slice(0, 6) : [];
    const body = S.formsErr ? `<p class="meta">${esc(S.formsErr)}</p>` : !f ? `<p class="meta">${U.spin}Reading forms from HighLevel</p>` : rows.length ? `<div class="hs-forms">${rows.map((x) => `<div class="hs-form"><span>${esc(x.name)}</span><b class="tnum">${x.submissions.toLocaleString()}</b></div>`).join('')}</div>` : '<p class="meta">No submissions in this period.</p>';
    return `<section class="hs-forms-panel" aria-label="HighLevel form submissions"><header><h3>Form submissions</h3><span class="meta">${f ? `${(f.total || 0).toLocaleString()} in the last ${f.days} days, from HighLevel` : 'From HighLevel'}</span><button class="btn sm ghost" data-action="hs-forms-refresh" aria-label="Refresh form submissions">${icon('refresh')}</button></header>${body}</section>`;
  }
  ACT['hs-forms-refresh'] = () => { S.formsAt = 0; S.forms = null; const el = document.querySelector('.hs-forms-panel'); loadForms(); if (el) el.outerHTML = formsPanel(); };

  window.HLSync = { hub, social, values, course, funnel, formsPanel, status, _valueItems: valueItems };
})();

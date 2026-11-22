// Founder OS shell: login, sidebar, router, delegated actions and Ask the OS.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { $, $$, esc, eur, int, icon } = U;
  const T = St.T, SEED = St.SEED;
  const qp = new URLSearchParams(location.search);
  const LOGO = `<span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 1.5C12.8 7.7 16.3 11.2 22.5 12C16.3 12.8 12.8 16.3 12 22.5C11.2 16.3 7.7 12.8 1.5 12C7.7 11.2 11.2 7.7 12 1.5Z" fill="currentColor"/><circle cx="19.2" cy="4.8" r="1.9" fill="var(--accent)"/></svg></span><b>Founders OS</b>`;
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // One-click demo: sample data only, no account, nothing reaches HighLevel or the shared database.
  const DEMO_KEY = 'fos-demo';
  const demoOn = () => { try { return sessionStorage.getItem(DEMO_KEY) === '1'; } catch (e) { return false; } };
  const demoSet = (on) => { try { on ? sessionStorage.setItem(DEMO_KEY, '1') : sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* private mode */ } };
  if (qp.has('demo')) demoSet(true);
  const mem = { in: demoOn(), real: null, conns: [], access: [] };
  const live = () => !!(mem.real && mem.real.workspace && mem.real.workspace.kind === 'live');
  const liveCtx = () => { const r = mem.real || {}; return { ws: r.workspace || { name: 'Workspace' }, workspaces: r.workspaces || [], name: (r.profile && r.profile.full_name) || '', email: (r.profile && r.profile.email) || '', conns: mem.conns, setupHidden: !!(r.profile && r.profile.onboarded), userId: r.user && r.user.id, demoId: ((r.workspaces || []).find((w) => w.kind === 'demo') || {}).id }; };
  // The theme sticks: saved on this device for an instant first paint, and on the account so it follows you.
  // ?theme= in the address is a one-off preview and is not saved.
  const THEME_KEY = 'fos-theme';
  const setTheme = (t) => { document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'; };
  if (qp.get('theme')) setTheme(qp.get('theme'));
  let themeSynced = !!qp.get('theme');
  function syncTheme() {
    if (themeSynced || !mem.real || !mem.real.profile) return; themeSynced = true;
    const t = mem.real.profile.theme; if (t !== 'light' && t !== 'dark') return;
    setTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* private mode */ }
  }
  function chooseTheme(t) {
    setTheme(t); themeSynced = true;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* private mode */ }
    const r = mem.real; if (r && r.user && r.profile) { r.profile.theme = t; window.Auth.saveTheme(r.user.id, t).catch((e) => console.error(e)); }
  }

  // V2: fewer pages. Related screens live as tabs inside one page, and the creative tools (graphics, emails,
  // video, funnel builds) open from AI Chat instead of the menu.
  const NAV = [
    ['Command', [['jarvis', 'Jarvis'], ['chat', 'AI Chat'], ['approvals', 'Newsfeed']]],
    ['Build', [['content', 'Content'], ['dna', 'Brand'], ['offers', 'Funnels'], ['programs', 'Programs']]],
    ['Run', [['revenue', 'Revenue'], ['crm', 'CRM'], ['calls', 'Calls'], ['agents', 'Systems']]],
  ];
  // Tabs inside a page. The first tab is the page itself. Every tab keeps its own address, so old links still land.
  const HUBS = {
    content: [['content', 'Board'], ['research', 'Research'], ['creators', 'Creators'], ['content-funnel', 'Content funnel'], ['proven', 'Proven'], ['posts', 'Posts']],
    dna: [['dna', 'DNA'], ['brain', 'Brain'], ['grok-made', 'From Grok'], ['brand', 'Brand'], ['memory', 'Memory']],
    offers: [['offers', 'Funnels'], ['swipe', 'Vault']],
    revenue: [['revenue', 'Revenue'], ['affiliate', 'Affiliate']],
    agents: [['agents', 'Agents'], ['routines', 'Routines'], ['connect', 'Connections'], ['mcp', 'AI access'], ['data', 'Data'], ['score', 'Score']],
    settings: [['settings', 'Settings'], ['access', 'Access', 'admin'], ['playbook', 'Playbook', 'admin']],
  };
  const PARENT = {}; Object.entries(HUBS).forEach(([h, tabs]) => tabs.forEach(([id]) => { PARENT[id] = h; }));
  // Opened from AI Chat when you ask for them. Not in the menu.
  const STUDIO = { graphics: 'Graphics', emails: 'Emails', video: 'Video', 'funnel-agent': 'Funnel builds' };
  Object.keys(STUDIO).forEach((id) => { PARENT[id] = 'chat'; });
  const STUDIO_FIELD = { graphics: '[data-gxf="brief"]', emails: '[data-emf="context"]' };
  // Screens V2 dropped. Old links go somewhere sensible.
  const GONE = { team: 'chat', goals: 'jarvis', funnels: 'offers', newsfeed: 'approvals' };
  const NAMES = { team: 'AI Team', crm: 'CRM', playbook: 'Playbook', video: 'Video', programs: 'Programs', swipe: 'Vault', chat: 'AI Chat', dna: 'Brand', proven: 'Proven', posts: 'Posts', emails: 'Emails', graphics: 'Graphics', access: 'Access', goals: 'Goals', memory: 'Memory', routines: 'Routines', connect: 'Connections', mcp: 'AI access', research: 'Research', creators: 'Creators', jarvis: 'Jarvis', revenue: 'Revenue', affiliate: 'Affiliate', calls: 'Calls', approvals: 'Newsfeed', brand: 'Brand', content: 'Content', 'content-funnel': 'Content funnel', offers: 'Funnels', 'funnel-agent': 'Funnel builds', funnels: 'Funnels', agents: 'Systems', brain: 'Brain', 'grok-made': 'From Grok', data: 'Data', score: 'Score', settings: 'Settings' };
  function hubTabs(view) {
    const h = PARENT[view]; if (!h || !HUBS[h]) return '';
    const tabs = HUBS[h].filter(([, , who]) => who !== 'admin' || isAdmin()); if (tabs.length < 2) return ''; const c = counts();
    return `<nav class="hub-tabs" aria-label="${esc(NAMES[h])}">${tabs.map(([id, label]) => `<a href="#${id}" class="hub-tab" ${id === view ? 'aria-current="page"' : ''}>${esc(label)}${id === h ? '' : `<span class="count" data-count="${id}">${c[id] || ''}</span>`}</a>`).join('')}</nav>`;
  }
  function studioBar(view) { return STUDIO[view] ? `<div class="studio-bar"><a class="btn sm ghost" href="#chat">${icon('arrow')}<span>Back to AI Chat</span></a><span class="meta">${esc(STUDIO[view])}, opened from AI Chat</span></div>` : ''; }
  const isAdmin = () => !!(mem.real && mem.real.access && mem.real.access.is_admin);
  const counts = () => Object.assign(isAdmin() ? { access: mem.access.filter((a) => a.status === 'pending').length, settings: mem.access.filter((a) => a.status === 'pending').length } : {}, live() ? {} : ({ calls: SEED.upcoming.filter((u) => u.day === T).length, data: St.s.sources.filter((s) => s.status !== 'green').length, brain: St.s.brain.gaps.length }), window.OSCounts ? window.OSCounts() : {}, { approvals: window.OSBoard?.summary().suggested || 0 });

  // Sidebar order is personal. Saved per account (and in this browser), merged with NAV so new screens still show up.
  const NAV_KEY = 'fos-nav-v2';
  function navLayout() {
    let saved = null;
    if (!saved) { try { saved = JSON.parse(localStorage.getItem(NAV_KEY) || 'null'); } catch (e) { saved = null; } }
    if (saved && !Array.isArray(saved)) saved = saved.order;
    const known = new Set(NAV.flatMap(([, items]) => items.map(([id]) => id)));
    if (!Array.isArray(saved)) return NAV.map(([g, items]) => [g, items.map(([id]) => id)]);
    const seen = new Set();
    const out = saved.filter((x) => Array.isArray(x) && typeof x[0] === 'string' && Array.isArray(x[1]))
      .map(([g, ids]) => [g, ids.filter((id) => known.has(id) && !seen.has(id) && seen.add(id))]);
    NAV.forEach(([g, items]) => { items.forEach(([id]) => { if (seen.has(id)) return; let grp = out.find((x) => x[0] === g); if (!grp) { grp = [g, []]; out.push(grp); } grp[1].push(id); seen.add(id); }); });
    return out;
  }
  function navHidden() {
    let saved = null;
    if (!saved) { try { saved = JSON.parse(localStorage.getItem(NAV_KEY) || 'null'); } catch (e) { saved = null; } }
    return new Set(saved && Array.isArray(saved.hidden) ? saved.hidden : []);
  }
  function readNav() {
    const order = []; $$('#nav-list > .group-label, #nav-list > .nav-item').forEach((el) => { if (el.classList.contains('group-label')) order.push([el.dataset.group, []]); else if (order.length) order[order.length - 1][1].push(el.dataset.nav); });
    return { order, hidden: $$('#nav-list > .nav-item.is-hidden').map((el) => el.dataset.nav) };
  }
  let navTimer = null;
  function saveNav(layout) {
    try { if (layout) localStorage.setItem(NAV_KEY, JSON.stringify(layout)); else localStorage.removeItem(NAV_KEY); } catch (e) { /* private mode */ }
    if (false) {
      clearTimeout(navTimer); navTimer = setTimeout(() => Auth.saveNav(mem.real.user.id, layout).catch(() => U.toast('Saved in this browser. Syncing to your account failed.')), 400);
    }
  }
  // Move with a short FLIP so neighbours slide instead of jumping.
  function flipMove(fn) {
    const els = $$('#nav-list > *'); const before = new Map(els.map((el) => [el, el.getBoundingClientRect().top]));
    fn();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    els.forEach((el) => { if (el.classList.contains('dragging')) return; const d = before.get(el) - el.getBoundingClientRect().top; if (!d) return; el.style.transition = 'none'; el.style.transform = `translateY(${d}px)`; requestAnimationFrame(() => { el.style.transition = 'transform 180ms cubic-bezier(.2,.7,.3,1)'; el.style.transform = ''; }); });
  }
  function navGroups() {
    let lab = null, any = false; const close = () => { if (lab) lab.classList.toggle('all-hidden', !any && lab !== $('#nav-list > .group-label')); };
    $$('#nav-list > *').forEach((el) => { if (el.classList.contains('group-label')) { close(); lab = el; any = false; } else if (!el.classList.contains('is-hidden')) any = true; });
    close();
  }
  function navToggleHide(it) {
    const h = it.classList.toggle('is-hidden'); const b = it.querySelector('.nav-hide');
    b.setAttribute('aria-pressed', String(h)); b.setAttribute('aria-label', (h ? 'Show ' : 'Hide ') + NAMES[it.dataset.nav]); b.title = h ? 'Show in menu' : 'Hide from menu';
    b.innerHTML = icon(h ? 'eye-off' : 'eye'); navGroups(); saveNav(readNav());
  }
  function navEditing(on) {
    const sb = $('#sidebar'); if (!sb) return;
    sb.classList.toggle('editing', on);
    $('#nav-edit-bar').hidden = !on;
    const b = $('[data-action=nav-edit]'); if (b) b.setAttribute('aria-pressed', String(on));
    $$('#nav-list > .nav-item').forEach((a) => { a.setAttribute('aria-roledescription', on ? 'movable item' : ''); if (!on) a.removeAttribute('aria-roledescription'); });
  }
  function navDragSetup() {
    const list = $('#nav-list'); if (!list) return;
    let drag = null, startY = 0, moved = false;
    list.addEventListener('click', (e) => { if ($('#sidebar').classList.contains('editing') && e.target.closest('.nav-item')) { e.preventDefault(); e.stopPropagation(); if (e.target.closest('.nav-hide')) navToggleHide(e.target.closest('.nav-item')); } }, true);
    list.addEventListener('pointerdown', (e) => {
      if (!$('#sidebar').classList.contains('editing') || e.button !== 0) return;
      const it = e.target.closest('.nav-item'); if (!it || e.target.closest('.nav-hide')) return;
      drag = it; startY = e.clientY; moved = false; it.setPointerCapture(e.pointerId); e.preventDefault();
    });
    list.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!moved && Math.abs(e.clientY - startY) < 4) return;
      if (!moved) { moved = true; drag.classList.add('dragging'); }
      const sb = $('#sidebar'), sr = sb.getBoundingClientRect(); if (e.clientY > sr.bottom - 48) sb.scrollTop += 10; else if (e.clientY < sr.top + 48) sb.scrollTop -= 10;
      const els = $$('#nav-list > .group-label, #nav-list > .nav-item').filter((el) => el !== drag);
      let target = null; for (const el of els) { const r = el.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { target = el; break; } }
      if (target === els[0]) target = els[1] || null; // nothing goes above the first group label
      const cur = drag.nextElementSibling === target || (!target && !drag.nextElementSibling);
      if (!cur) flipMove(() => (target ? list.insertBefore(drag, target) : list.appendChild(drag)));
    });
    const end = () => { if (!drag) return; drag.classList.remove('dragging'); if (moved) saveNav(readNav()); drag = null; };
    list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
    list.addEventListener('keydown', (e) => {
      if (!$('#sidebar').classList.contains('editing')) return;
      const it = e.target.closest('.nav-item'); if (!it) return;
      if (e.key === 'h' || e.key === 'H' || e.key === ' ') { e.preventDefault(); navToggleHide(it); return; }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const all = $$('#nav-list > *'); const i = all.indexOf(it);
      if (e.key === 'ArrowUp' && i > 1) flipMove(() => list.insertBefore(it, all[i - 1]));
      if (e.key === 'ArrowDown' && i < all.length - 1) flipMove(() => list.insertBefore(it, all[i + 1].nextSibling));
      it.focus(); saveNav(readNav());
    });
  }
  ACT['nav-edit'] = () => navEditing(!$('#sidebar').classList.contains('editing'));
  ACT['nav-done'] = () => { navEditing(false); U.toast('Menu saved'); };
  ACT['nav-reset'] = () => { saveNav(null); flipMove(() => { $('#nav-list').innerHTML = navItems(counts()); }); navGroups(); const v0 = (location.hash || '#jarvis').slice(1); const v = PARENT[v0] || v0; $$('#nav-list [data-nav]').forEach((a) => a.dataset.nav === v && a.setAttribute('aria-current', 'page')); navEditing(true); U.toast('Back to the default order'); };

  const navItems = (c, hid = navHidden()) => `${navLayout().map(([g, ids], gi) => `<div class="group-label" data-group="${esc(g)}"><span>${esc(g)}</span>${gi === 0 ? `<button class="nav-edit" data-action="nav-edit" aria-pressed="false" title="Move or hide menu items">${icon('edit')}<span>Edit</span></button>` : ''}</div>${ids.map((id) => `<a class="nav-item${hid.has(id) ? ' is-hidden' : ''}" href="#${id}" data-nav="${id}">${icon(id)}<span>${NAMES[id]}</span><span class="count" data-count="${id}">${c[id] || ''}</span><span class="nav-hide" role="button" aria-pressed="${hid.has(id)}" aria-label="${hid.has(id) ? 'Show' : 'Hide'} ${NAMES[id]}" title="${hid.has(id) ? 'Show in menu' : 'Hide from menu'}">${icon(hid.has(id) ? 'eye-off' : 'eye')}</span><span class="grip" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg></span></a>`).join('')}`).join('')}`;
  function shell() {
    const c = counts();
    $('#root').innerHTML = `<div class="app">
      <nav class="sidebar" id="sidebar" aria-label="Main">
        <div class="brand">${LOGO}<button class="btn icon ghost menu-toggle" data-action="menu-close" aria-label="Close menu" style="margin-left:auto;margin-right:12px">${icon('close')}</button></div>
        <div class="nav-edit-bar" id="nav-edit-bar" hidden><span class="meta">Move or hide</span><button class="btn sm ghost" data-action="nav-reset">Reset</button><button class="btn sm primary" data-action="nav-done">Done</button></div>
        <div class="nav-list" id="nav-list">${navItems(c)}</div>
        <div class="side-bottom">
          <a class="nav-item" href="#settings" data-nav="settings">${icon('settings')}<span>Settings</span><span class="count" data-count="settings" title="People waiting for access">${c.settings || ''}</span></a>
          <label class="theme-row"><span>Light mode</span><input type="checkbox" class="switch" id="theme" ${document.documentElement.dataset.theme === 'light' ? 'checked' : ''}></label>
          <div class="who"><span class="avatar">${esc(U.initials(St.s.settings.name))}</span><div><div>${esc(St.s.settings.name)}</div><div class="sub">${mem.real ? (live() ? "Private workspace" : "Demo workspace") : "Demo, no account"}</div></div><button class="btn sm ghost" data-action="logout" style="margin-left:auto">${mem.real ? "Log out" : "Exit"}</button></div>
        </div>
      </nav>
      <div class="main">
        <header class="topbar">
          <button class="btn icon ghost menu-toggle" data-action="menu-open" aria-label="Open menu">${icon('menu')}</button>
          <button class="ask" data-action="ask-open">${icon('search')}<span>Ask your workspace</span><kbd>⌘K</kbd></button>
          <button class="btn icon talk-btn" data-action="voice-open" aria-label="Talk to Jarvis" title="Talk to Jarvis (⌘J)">${icon('mic')}</button>
          <span class="dna-slot" id="dnapill">${window.DNA ? window.DNA.pill() : ''}</span><span class="sync" id="topsync">${syncChip()}</span>
          <div class="ws-wrap"><button class="switcher" data-action="ws-menu" aria-haspopup="menu" aria-expanded="false"><span class="avatar" style="width:26px;height:26px">${esc(U.initials(St.s.settings.workspace || "FF").toUpperCase())}</span><span class="txt"><div>${esc(St.s.settings.workspace)}</div><div class="sub">${mem.real ? (live() ? 'Private workspace' : 'Demo workspace') : 'Demo, no account'}</div></span>${icon('chevron')}</button>
          <div class="ws-menu" id="ws-menu" role="menu" hidden>${mem.real ? mem.real.workspaces.map((w) => `<button role="menuitem" data-action="ws-switch" data-id="${w.id}" aria-current="${w.id === mem.real.workspace.id}"><span class="dot ${w.id === mem.real.workspace.id ? '' : 'off'}"></span><span class="grow"><b>${esc(w.name)}</b><span class="meta">${w.kind === 'demo' ? 'Sample data' : 'Your real data'}</span></span>${w.id === mem.real.workspace.id ? '<span class="pill">Current</span>' : ''}</button>`).join('') : '<p class="meta" style="padding:10px 12px;margin:0">Create an account to get a private workspace next to this demo.</p><button role="menuitem" data-action="ws-signup"><span class="grow"><b>Create account</b></span></button>'}</div></div>
        </header>
        <div class="demo-bar" id="demo-bar">${live() ? "Private workspace. Only your real data appears here, and nothing is sample data." : mem.real ? "Demo workspace with sample data. Your private workspace is one click away in the top bar." : "Demo workspace with sample data. Writes to HighLevel are simulated and logged in Settings."}</div>
        <main class="canvas" id="canvas" tabindex="-1"></main>
      </div>
    </div>`;
    navDragSetup(); navGroups();
    $('#theme').addEventListener('change', (e) => { chooseTheme(e.target.checked ? 'light' : 'dark'); render(true); });
  }

  let current = null;
  function syncChip() {
    if (!live()) return '<span class="dot"></span>HighLevel synced 07:02';
    const hl = (mem.conns || []).find((c) => c.provider === 'highlevel' && c.status === 'connected');
    return hl ? `<span class="dot"></span>HighLevel connected` : `<button class="sync-cta" data-action="ib-conn" data-id="highlevel"><span class="dot off"></span>Connect HighLevel</button>`;
  }
  function render(keepDrawer) {
    syncTheme();
    const view = V[VS.view] ? VS.view : 'jarvis';
    if (!keepDrawer && current !== view) U.closeDrawer();
    const scroll = current === view ? window.scrollY : 0;
    if (view === 'emails' && VS.studioPrompt) VS.emTab = 'write';
    let html;
    try { html = live() ? V.live(view) : V[view](); html = studioBar(view) + hubTabs(view) + html; } catch (err) { console.error(err); html = `${U.title(NAMES[view])}<section class="panel">${U.empty('This screen could not load', 'Something in the sample data broke it. Reset the demo in Settings or reload.', '<button class="btn" data-action="reload">Reload</button>')}</section>`; }
    const ts = $('#topsync'); if (ts) ts.innerHTML = syncChip();
    const dp = $('#dnapill'); if (dp && window.DNA) dp.innerHTML = window.DNA.pill();
    $('#canvas').dataset.view = view;
    $('#canvas').innerHTML = `<div class="view ${current === view ? 'same' : ''}">${html}</div>`;
    const navOn = PARENT[view] || view;
    $$('[data-nav]').forEach((a) => a.dataset.nav === navOn ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    document.title = NAMES[view] + ' · Founders AI OS';
    U.runAfter();
    // A request typed in AI Chat lands in the tool's own prompt box. Nothing runs until you press its button.
    if (STUDIO[view] && VS.studioPrompt) {
      const q = VS.studioPrompt; VS.studioPrompt = null;
      requestAnimationFrame(() => {
        if (view === 'graphics' && ACT['gx-new'] && !$('#canvas [data-gxf="brief"]')) ACT['gx-new']();
        if (view === 'graphics') { const f = VS.studioFormat || (/thumbnail/i.test(q) ? 'thumb' : /carousel/i.test(q) ? 'carousel' : /\bads?\b|ad creative/i.test(q) ? 'ad' : /story|reel/i.test(q) ? 'story' : /linkedin/i.test(q) ? 'linkedin' : /instagram|\bpost\b/i.test(q) ? 'ig_post' : null); VS.studioFormat = null; const b = f && $(`#canvas [data-action="gx-fmt"][data-v="${f}"]`); if (b) b.click(); }
        requestAnimationFrame(() => {
          const ta = $('#canvas ' + (STUDIO_FIELD[view] || 'textarea')) || $('#canvas textarea');
          if (ta && !ta.value.trim()) { ta.value = q; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus({ preventScroll: true }); }
        });
      });
    }
    if (window.JarvisOrb) window.JarvisOrb.scan();
    if (window.Voice && window.Voice.mount) window.Voice.mount();
    if (window.BrainAlgo) window.BrainAlgo.scan();
    if (!live() && V[view].after) V[view].after();
    $('#sidebar').classList.remove('open');
    if (current !== view) { window.scrollTo(0, 0); current = view; } else window.scrollTo(0, scroll);
    refreshCounts();
  }
  function refreshCounts() { const c = counts(); $$('[data-count]').forEach((el) => { el.textContent = c[el.dataset.count] || ''; }); }

  // #newsfeed is the public name of the idea queue; the screen keeps its original id so saved sidebar orders still match.
  function route() { const h = (location.hash || '#jarvis').slice(1).split('?')[0]; if (GONE[h]) { location.replace('#' + GONE[h]); return; } VS.view = h; if (mem.in) render(); }

  /* ---------- login and onboarding ---------- */
  const PATHS = { login: '/login', signup: '/signup', forgot: '/forgot', reset: '/reset', check: '/signup' };
  const TITLES = { login: 'Log in', signup: 'Create your account', forgot: 'Reset your password', reset: 'Set a new password', check: 'Check your inbox' };
  function login(mode, extra) {
    mode = mode || (/signup|register/.test(location.pathname) ? 'signup' : /forgot/.test(location.pathname) ? 'forgot' : 'login');
    const up = mode === 'signup', tabs = mode === 'login' || mode === 'signup';
    if (location.protocol.startsWith('http')) history.replaceState(null, '', PATHS[mode] + location.search);
    document.title = TITLES[mode] + ' · Founders AI OS';
    const H = { login: ['Welcome back.', 'Log in to see what your agents did overnight and what needs you today.'], signup: ['Start your AI OS.', 'The intelligence layer on top of HighLevel. It learns your voice, reads all four revenue streams and drafts the work for your approval.'], forgot: ['Reset your password.', 'Enter the email on your account and we will send a link to set a new password.'], reset: ['Set a new password.', 'Choose a password with at least 8 characters. You will stay logged in on this device.'], check: ['Check your inbox.', `We sent a confirmation link to ${esc(extra || 'your email')}. Open it to confirm your email. After that, your account waits for approval.`] }[mode];
    const field = (n, t, ac, ph) => `<input class="input" name="${n}" type="${t}" autocomplete="${ac}" placeholder="${ph}" aria-label="${ph}" required>`;
    const fields = { login: field('email', 'email', 'email', 'Email') + field('password', 'password', 'current-password', 'Password'), signup: field('name', 'text', 'name', 'Your name') + field('email', 'email', 'email', 'Email') + field('password', 'password', 'new-password', 'Create a password, 8 characters or more'), forgot: field('email', 'email', 'email', 'Email'), reset: field('password', 'password', 'new-password', 'New password, 8 characters or more'), check: '' }[mode];
    const cta = { login: 'Log in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save password', check: '' }[mode];
    $('#root').innerHTML = `<div class="login"><form class="card" id="login" novalidate data-mode="${mode}">
      <div class="brand" style="border:0;margin:0;padding:0;height:auto">${LOGO}</div>
      ${tabs ? `<div class="segmented auth-tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-pressed="${!up}">Log in</button><button type="button" role="tab" data-mode="signup" aria-pressed="${up}">Create account</button></div>` : ''}
      <h1>${H[0]}</h1><p class="muted">${H[1]}</p>
      ${fields}
      ${mode === 'login' ? '<button type="button" class="linkish" data-mode="forgot">Forgot password?</button>' : ''}
      <p class="auth-msg" id="auth-msg" role="status" hidden></p>
      ${cta ? `<button class="btn primary" type="submit" id="auth-go">${cta}</button>` : ''}
      ${tabs ? '<button type="button" class="btn" id="auth-demo" data-demo>Try the demo</button><p class="or">Sample workspace, no account needed.</p>' : ''}
      ${mode === 'forgot' || mode === 'check' ? '<button type="button" class="btn" data-mode="login">Back to log in</button>' : ''}
      ${up ? '<p class="or">Every new account is approved by hand. You will get in as soon as yours is approved.</p>' : ''}
      <p class="or legal"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
    </form></div>`;
    $('#auth-demo')?.addEventListener('click', () => { demoSet(true); St.A.setSetting('name', 'Demo user'); St.A.setSetting('email', ''); St.A.setSetting('workspace', 'Demo workspace'); enter(); });
    $$('#login [data-mode]').forEach((b) => { if (b.tagName === 'BUTTON') b.addEventListener('click', () => login(b.dataset.mode)); });
    const say = (t, bad) => { const m = $('#auth-msg'); m.hidden = !t; m.textContent = t || ''; m.classList.toggle('bad', !!bad); };
    const setupMsg = () => { const m = $('#auth-msg'); m.hidden = false; m.classList.add('bad'); m.innerHTML = esc(Auth.setupProblem || 'Setup is not finished. In Vercel, add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY under Settings, Environment Variables, then redeploy.') + ' <a class="fix-link" data-fix href="https://vercel.com/dashboard" target="_blank" rel="noopener">Open Vercel</a>'; };
    if (window.Auth && !Auth.configured) { if (cta) setupMsg(); }
    else if (!window.Auth || !Auth.ready) { if (cta) say('Accounts are offline right now. Reload the page in a minute. If it keeps happening, check your connection or turn off content blockers for this site.', true); }
    $('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, go = $('#auth-go'); if (!go || go.disabled) return;
      const v = (n) => (f[n] ? f[n].value.trim() : '');
      const email = v('email'), pw = f.password ? f.password.value : '';
      let err = '';
      if (mode === 'signup' && !v('name')) err = 'Add your name.';
      else if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err = 'Enter a valid email address.';
      else if (f.password && pw.length < 8) err = 'Passwords need at least 8 characters.';
      if (err) return say(err, true);
      if (window.Auth && !Auth.configured) return setupMsg();
      if (!window.Auth || !Auth.ready) return say('Accounts are offline right now. Reload the page in a minute. If it keeps happening, check your connection or turn off content blockers for this site.', true);
      const label = go.textContent; go.disabled = true; go.textContent = 'One moment'; say('');
      try {
        if (mode === 'signup') { const d = await Auth.signUp(v('name'), email, pw); if (d.session) return enterReal(); return login('check', email); }
        if (mode === 'login') { await Auth.signIn(email, pw); return enterReal(); }
        if (mode === 'forgot') { await Auth.forgot(email); say(`If ${email} has an account, a reset link is on its way.`); go.textContent = 'Sent'; return; }
        if (mode === 'reset') { await Auth.setPassword(pw); U.toast('Password updated'); return enterReal(); }
      } catch (ex) { say(Auth.friendly(ex), true); }
      go.disabled = false; go.textContent = label;
    });
    f0(mode === 'signup' ? 'name' : mode === 'reset' ? 'password' : 'email');
  }
  const f0 = (n) => { const el = document.querySelector(`#login [name=${n}]`); if (el && matchMedia('(min-width: 861px)').matches) el.focus(); };
  function enter() { mem.in = true; if (location.protocol.startsWith('http') && location.pathname !== '/') history.replaceState(null, '', '/' + location.search + location.hash); document.title = 'Founders AI OS'; shell(); route(); }
  function waiting(acc) {
    const denied = acc.access.status === 'denied';
    if (location.protocol.startsWith('http')) history.replaceState(null, '', '/');
    document.title = (denied ? 'No access' : 'Waiting for approval') + ' · Founders AI OS';
    $('#root').innerHTML = `<div class="login"><div class="card wait-card">
      <div class="brand" style="border:0;margin:0;padding:0;height:auto">${LOGO}</div>
      <h1>${denied ? 'This account does not have access.' : 'You are on the list.'}</h1>
      <p class="muted">${denied ? 'Access to Founders AI OS was not approved for ' + esc(acc.user.email) + '. If you think that is a mistake, contact the person who invited you.' : 'Your account for ' + esc(acc.user.email) + ' is set up. Every new account is approved by hand, and this page opens the OS as soon as yours is.'}</p>
      ${denied ? '' : '<button class="btn primary" type="button" id="wait-check">Check again</button>'}
      <button class="btn${denied ? ' primary' : ''}" type="button" id="wait-out">Log out</button>
    </div></div>`;
    const chk = $('#wait-check'); if (chk) chk.addEventListener('click', async () => { chk.disabled = true; chk.textContent = 'Checking'; await enterReal(); const again = $('#wait-check'); if (again) { again.disabled = false; again.textContent = 'Check again'; U.toast('Not approved yet'); } });
    $('#wait-out').addEventListener('click', async () => { try { await Auth.signOut(); } catch (e) { console.error(e); } login('login'); });
  }
  async function enterReal() {
    demoSet(false);
    let acc = null;
    try { acc = await Auth.account(); } catch (e) { console.error(e); }
    if (!acc) return login('login');
    if (acc.access.status !== 'approved') return waiting(acc);
    mem.real = acc;
    mem.access = [];
    if (acc.access.is_admin) { try { mem.access = await Auth.admin.list(); } catch (e) { console.error(e); } }
    St.A.setSetting('name', acc.profile.full_name || acc.user.email.split('@')[0]);
    St.A.setSetting('email', acc.profile.email || acc.user.email);
    if (acc.workspace) St.A.setSetting('workspace', acc.workspace.kind === 'demo' ? 'Northpeak Studio' : acc.workspace.name);
    try { mem.conns = acc.workspace ? await Auth.connections(acc.workspace.id) : []; } catch (e) { mem.conns = []; }
    enter();
    if (window.Conn) window.Conn.boot();
    if (acc.access.is_admin) setupCheck();
    const waitingN = mem.access.filter((a) => a.status === 'pending').length;
    if (waitingN) setTimeout(() => U.toast(`${waitingN} ${waitingN === 1 ? 'person is' : 'people are'} waiting for access. Open Access in the sidebar.`), 600);
  }
  // Admins: register CRON_SECRET and the time zone with the database, and flag missing install settings.
  async function setupCheck() {
    try {
      const s = await Auth.session(); if (!s) return;
      const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'setup' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setTimeout(() => U.toast(j.error || 'The setup check did not run. Open Settings to see what is missing.'), 1200); return; }
      mem.setup = j;
      const miss = (j.checks || []).filter((c) => !c.ok && c.need === 'required');
      if (miss.length) setTimeout(() => U.toast(miss[0].fix), 1200);
      if (location.hash === '#settings') render();
    } catch (e) { console.error(e); }
  }
  /* ---------- Ask the OS ---------- */
  const askd = () => $('#askd');
  const SUGG = ['What needs me today?', 'What did each stream make in October?', 'Which video made the most money?', 'Who is hot right now?', 'What should I film next?', 'Which clients might churn?', 'What do the agents cost?', 'Which deals stalled?', 'Tell me about Theo Johansson'];
  const cite = (label, action, id) => `<button class="pill out cite" data-action="${action}" data-id="${id || ''}">${esc(label)}</button>`;
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function answer(q) {
    const os = window.OSAnswer && window.OSAnswer(q); if (os) return os;
    if (live()) {
      const n = mem.conns.filter((c) => c.status === 'connected').length;
      return { fallback: true, a: n ? 'I could not match that to a connected source. Ask about a source by name, like YouTube, your calendar or Stripe, or connect Perplexity for web answers.' : 'Your private workspace has no data yet, so I will not guess. Connect HighLevel and YouTube in Settings and I will answer from your real numbers. Switch to the Demo workspace to hear what that sounds like.', c: [cite('Connections', 'go', 'connect')] };
    }
    const r = demoAnswer(q);
    if (VS.prio && r && /needs? me|need from me|what should i do|waiting on me/.test(q.toLowerCase())) r.a = 'This week\u2019s three come first: ' + VS.prio.map((p, i) => (i + 1) + ', ' + p.replace(/\.$/, '')).join('. ') + '. ' + r.a;
    return r;
  }
  function demoAnswer(q) {
    const s = q.toLowerCase();
    if (/needs? me|need from me|what should i do|priorit|waiting on me/.test(s)) {
      const up = SEED.upcoming.filter((x) => x.day === T); const ap = St.s.approvals; const gaps = St.s.brain.gaps.length; const bad = St.s.sources.filter((x) => x.status !== 'green');
      const first = up[0] ? St.contactById[up[0].contactId] : null;
      return { a: `${ap.length} drafts wait for approval, starting with "${ap[0] ? ap[0].title : 'none'}". ${up.length} calls today${first ? ', first at ' + up[0].time + ' with ' + first.name : ''}. ${gaps} Brain questions are open and ${bad.length} feeds need a fix${bad[0] ? ', starting with ' + bad[0].name : ''}. Clear the Newsfeed first: they hold work your agents already finished.`, c: [cite('Newsfeed', 'go', 'approvals'), ...(up[0] ? [cite('Dossier · ' + first.name, 'dossier', up[0].id)] : []), cite('Brain', 'go', 'brain'), cite('Data', 'go', 'data')] };
    }
    const nameHit = SEED.contacts.find((c) => s.includes(c.name.toLowerCase()) || (s.includes(c.last.toLowerCase()) && c.last.length > 4 && s.includes(c.first.toLowerCase())));
    if (nameHit) {
      const r = St.contactRead(nameHit)[0];
      return { a: `${nameHit.name} from ${nameHit.company} is worth ${eur(nameHit.ltv)} across ${nameHit.roles.map(U.sname).join(', ').toLowerCase()}. ${r ? r.text : ''}`, c: [cite('Contact · ' + nameHit.name, 'contact', nameHit.id)] };
    }
    if (/stream|revenue|made|earn|money in|month|sales/.test(s) && !/video/.test(s)) {
      const mi = MONTHS.findIndex((m) => s.includes(m) || s.includes(m.slice(0, 3) + ' '));
      let key, label;
      if (mi >= 0) { key = (mi >= 10 ? '2025-' : '2026-') + String(mi + 1).padStart(2, '0'); if (mi === 10) key = '2026-11'; label = MONTHS[mi][0].toUpperCase() + MONTHS[mi].slice(1); }
      if (/last 30|this month|30 days/.test(s) || !key) { const r = St.range(30).cur; return { a: `The last 30 days brought in ${eur(St.total(r))}: software ${eur(r.software)}, services ${eur(r.services)}, products ${eur(r.products)} and affiliate ${eur(r.affiliate)}.`, c: [cite('Revenue', 'go', 'revenue'), cite('HighLevel payments', 'go', 'data')] }; }
      const evs = SEED.events.filter((e) => e.date.startsWith(key)); const r = St.byStream(evs);
      if (!evs.length) return { a: `No revenue recorded for ${label} yet.`, c: [cite('Revenue', 'go', 'revenue')] };
      return { a: `${label} brought in ${eur(St.total(r))}: software ${eur(r.software)}, services ${eur(r.services)}, products ${eur(r.products)} and affiliate ${eur(r.affiliate)}.`, c: [cite('Revenue · ' + label, 'go', 'revenue'), cite(evs.length + ' payments', 'go', 'revenue')] };
    }
    if (/video|youtube|outlier/.test(s)) {
      const top = SEED.videos.map((v) => [v, St.videoRev[v.id] || 0]).sort((a, b) => b[1] - a[1])[0];
      const out = [...SEED.videos].sort((a, b) => b.outlier - a.outlier)[0];
      return { a: `"${top[0].title}" made the most, ${eur(top[1])} across streams. The biggest outlier is "${out.title}" at ${out.outlier.toFixed(1)}x your median.`, c: [cite(top[0].title, 'video', top[0].id), cite(out.title, 'video', out.id)] };
    }
    if (/hot|intent|warm/.test(s)) {
      const h = St.hotContacts().slice(0, 3);
      return { a: `${h.length} people are warm right now. ${h.map((c) => { const d = St.T - c.lastDay; return `${c.name} has watched ${c.watchCount} videos and was last active ${d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'}`; }).join('. ')}.`, c: h.map((c) => cite(c.name, 'contact', c.id)) };
    }
    if (/film|idea|next video|content/.test(s)) {
      const i = St.s.ideas.filter((x) => x.col !== 'published').sort((a, b) => b.score - a.score)[0];
      return { a: `Film "${i.title}" next. It scores ${i.score.toFixed(1)} and serves ${i.streams.map(U.sname).join(' and ').toLowerCase()}. ${i.why}`, c: [cite('Idea · ' + i.title, 'idea', i.id), cite('Content board', 'go', 'content')] };
    }
    if (/churn|risk|cancel|quiet|health/.test(s)) {
      const r = St.clientHealth().filter((h) => h.c.saas && h.c.logins30 < 4);
      return { a: `${r.length} software clients look at risk, worth ${eur(St.sum(r, (h) => h.mrr))} a month. Lowest health: ${r.slice(0, 3).map((h) => h.c.name).join(', ')}.`, c: [...r.slice(0, 3).map((h) => cite(h.c.name, 'contact', h.c.id)), cite('Client health', 'go', 'revenue')] };
    }
    if (/agent|cost|spend|hours/.test(s)) {
      const t = St.agentTotals();
      return { a: `Agents ran ${int(t.runs)} times in 30 days for ${U.eur2(t.spent)} and saved about ${Math.round(t.hours)} hours, so ${U.eur2(t.spent / t.hours)} per hour saved.`, c: [cite('Agents', 'go', 'agents')] };
    }
    if (/stall|deal|pipeline|proposal/.test(s)) {
      const d = St.stalledDeals();
      return { a: `${d.length} deals stalled, worth ${eur(St.sum(d, (x) => x.value))}. The oldest is ${d.sort((a, b) => b.days - a.days)[0].c.name}, quiet ${d[0].days} days.`, c: d.slice(0, 3).map((x) => cite(x.c.name, 'contact', x.c.id)) };
    }
    if (/call|meeting|today/.test(s)) {
      const u = SEED.upcoming.filter((x) => x.day === T);
      return { a: `${u.length} calls today: ${u.map((x) => x.time + ' with ' + St.contactById[x.contactId].name).join(', ')}.`, c: u.map((x) => cite('Dossier · ' + St.contactById[x.contactId].name, 'dossier', x.id)) };
    }
    if (/score|ready|how am i/.test(s)) { const sc = St.score(); const low = [...sc.parts].sort((a, b) => a.v - b.v)[0]; return { a: `Your OS score is ${sc.total} of 100. The weakest part is ${low.label.toLowerCase()}: ${low.next}.`, c: [cite('Score', 'go', 'score')] }; }
    return null;
  }
  function askRender(q) {
    const body = $('#ask-body');
    if (!q) { body.innerHTML = `<p class="meta" style="margin-bottom:4px">Try</p>${SUGG.map((x) => `<button class="sugg" data-action="ask-q" data-q="${esc(x)}">${esc(x)}</button>`).join('')}`; return; }
    body.innerHTML = `<p class="meta">${esc(q)}</p><p class="answer muted">${U.spin} Reading HighLevel, YouTube and Stripe</p>`;
    setTimeout(async () => {
      let r = answer(q);
      if (/\bgoals?\b|on track|off track|at risk|behind on/i.test(q) && window.OSGoals2) {
        const G2 = window.OSGoals2; const gs = G2.all();
        if (!gs.length) r = { a: 'No goals are set yet. Add one per channel, offer or funnel on the Goals page.', c: [cite('Goals', 'go', 'goals')] };
        else { const bad = gs.filter((g) => g.st === 'off' || g.st === 'risk'); const on = gs.filter((g) => g.st === 'on' || g.st === 'done');
          const say = (g) => `${g.label} for ${G2.forLabel(g).replace(/^[^·]+· /, '')} is ${g.st === 'off' ? 'off track' : 'at risk'} at ${G2.val(g, g.now)}`;
          r = { a: `${on.length} of ${gs.length} goals are on track.${bad.length ? ' ' + bad.slice(0, 3).map(say).join('. ') + '.' : ' Nothing is behind.'}`, c: [cite('Goals', 'go', 'goals')] }; }
      }
      const own = window.Facts && /\b(my|i|me|mine)\b/i.test(q) ? window.Facts.match(q, 3, 5) : [];
      if (own.length) r = { a: own.map((f) => window.Facts.you(f.statement)).join(' '), c: [cite('Your Algorithm', 'go', 'brain')], brain: true };
      if ((!r || r.fallback) && window.Facts) { const fx = window.Facts.match(q, 3); if (fx.length) r = { a: fx.map((f) => window.Facts.you(f.statement)).join(' '), c: [cite('Your Algorithm', 'go', 'brain')], brain: true }; }
      if (live() && r && r.fallback && window.Conn) {
        const C2 = window.Conn; const ql = q.toLowerCase();
        const SRC = [['youtube', /youtube|channel|video|views|subscri/], ['youtube-2', /youtube|channel|video|views|subscri/], ['gcal', /calendar|meeting|call|today|tomorrow/], ['instagram', /instagram|reel|\big\b/], ['tiktok', /tiktok/], ['x', /\bx\b|twitter|tweet/], ['linkedin', /linkedin/], ['stripe', /stripe/], ['paypal', /paypal/], ['affiliate', /affiliate|commission/], ['ga4', /analytics|sessions|traffic|site/], ['gsc', /search console|seo|queries|google search/], ['meta-ads', /meta ads|facebook ads|\bads?\b|cpl|cost per lead/], ['google-ads', /google ads|adwords/], ['fathom', /fathom|call notes/], ['granola', /granola|notes/], ['zoom', /zoom|recording/], ['notion', /notion/], ['gdrive', /drive|docs?\b/], ['bank', /bank|balance|cash/], ['accounting', /xero|invoice|expense|accounting/], ['tella', /tella/]];
        const hit = SRC.filter(([k, rx]) => rx.test(ql) && C2.on(k) && (C2.meta(k).feed || {}).metrics);
        if (hit.length) {
          const parts = hit.slice(0, 2).map(([k]) => { const m = C2.meta(k); const f = m.feed; const nm = (C2.row(k) && C2.row(k).account_label) || k; return nm + ': ' + f.metrics.map((x) => x.l + ' ' + x.v).join(', ') + '.' + (f.items && f.items[0] ? ' Latest: ' + f.items[0].t + (f.items[0].s ? ' (' + f.items[0].s + ')' : '') + '.' : '') + (m.last_sync_at ? ' Synced ' + C2.ago(m.last_sync_at) + '.' : ''); });
          r = { a: parts.join(' '), c: hit.slice(0, 2).map(([k]) => cite(((window.OSData && window.OSData.cx(k)) || [k, k])[1], 'cx', k)) };
        }
        if (!hit.length && window.BrainCtx && (/\b(my|me|i|our|we|mine)\b/.test(ql) || !C2.on('perplexity'))) {
          try { const bh = await window.BrainCtx.search(q, 3); if (bh.length) { const top = bh[0]; r = { a: 'From your Brain, ' + top.title + (top.heading ? ' (' + top.heading + ')' : '') + ': ' + String(top.body).replace(/\s+/g, ' ').slice(0, 420) + (String(top.body).length > 420 ? '...' : ''), c: bh.filter((x, i, arr) => arr.findIndex((y) => y.title === x.title) === i).map((x) => cite('Brain · ' + x.title, 'go', 'brain')), brain: true }; } } catch (e) { /* fall through */ }
        }
        if (!hit.length && !(r && r.brain) && C2.on('perplexity')) {
          body.innerHTML = `<p class="meta">${esc(q)}</p><p class="answer muted">${U.spin} Searching the web with Perplexity</p>`;
          try { const w = await C2.api('ask', { q }); r = { a: w.answer, c: (w.citations || []).slice(0, 4).map((u) => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep */ } return `<a class="pill out cite" href="${esc(u)}" target="_blank" rel="noopener">${esc(h)}</a>`; }) }; }
          catch (e) { r = { a: 'Perplexity did not answer: ' + e.message, c: [] }; }
        }
      }
      body.innerHTML = r ? `<p class="meta">${esc(q)}</p><p class="answer">${esc(r.a)}</p><div class="cites">${r.c.join('')}</div><button class="sugg" data-action="ask-back">Ask something else</button>`
        : `<p class="meta">${esc(q)}</p><p class="answer">I could not match that to your data yet. These work today:</p>${SUGG.slice(0, 5).map((x) => `<button class="sugg" data-action="ask-q" data-q="${esc(x)}">${esc(x)}</button>`).join('')}`;
    }, 450);
  }
  function openAsk() { askRender(); $('#ask-input').value = ''; askd().showModal(); $('#ask-input').focus(); }

  /* ---------- delegated actions ---------- */
  Object.assign(ACT, {
    'menu-open': () => $('#sidebar').classList.add('open'),
    'menu-close': () => $('#sidebar').classList.remove('open'),
    logout: async () => { if(window.VideoEditor&&!await VideoEditor.allowLeave())return;window.VideoEditor?.reset();const real = mem.real; mem.in = false; mem.real = null; demoSet(false); U.closeDrawer(); if (window.Voice) Voice.stop(); if (real) { try { await Auth.signOut(); } catch (e) { console.error(e); } } login('login'); },
    'ask-open': openAsk,
    'ws-menu': (el) => { const m = $('#ws-menu'); const show = m.hidden; m.hidden = !show; el.setAttribute('aria-expanded', String(show)); if (show) { const f = m.querySelector('button'); if (f) f.focus(); } },
    'ws-signup': () => { mem.in = false; login('signup'); },
    'ws-switch': async (el) => {
      const r = mem.real; if (!r) return; const w = r.workspaces.find((x) => x.id === el.dataset.id); if (!w) return;
      const go = el.dataset.go;
      if (w.id !== r.workspace.id) {
        if(window.VideoEditor&&!await VideoEditor.allowLeave())return;
        window.VideoEditor?.reset();
        r.workspace = w;
        St.A.setSetting('workspace', w.kind === 'demo' ? 'Northpeak Studio' : w.name);
        try { await Auth.useWorkspace(r.user.id, w.id); } catch (e) { console.error(e); }
        try { mem.conns = await Auth.connections(w.id); } catch (e) { mem.conns = []; }
        U.toast(w.kind === 'demo' ? 'Switched to the Demo workspace' : 'Switched to ' + w.name);
      }
      U.closeDrawer(); shell(); if (go) location.hash = '#' + go; route(); render();
      if (window.Conn) window.Conn.boot();
    },
    'ask-close': () => askd().close(),
    'ask-q': (el) => { $('#ask-input').value = el.dataset.q; askRender(el.dataset.q); },
    'ask-back': () => { $('#ask-input').value = ''; askRender(); $('#ask-input').focus(); },
    go: (el) => { if (askd().open) askd().close(); U.closeDrawer(); location.hash = '#' + (el.dataset.go || el.dataset.id); },
    'drawer-close': () => U.closeDrawer(),
    'drawer-back': () => U.drawerBack(),
    seg: (el) => { const k = el.dataset.seg; const v = el.dataset.v; VS[k] = isNaN(+v) ? v : +v; render(); },
    reload: () => location.reload(),
  });
  const closeAskFirst = (el) => { if (askd().open && el.closest('#askd') && !/^ask/.test(el.dataset.action)) askd().close(); };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = ACT[el.dataset.action]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    closeAskFirst(el);
    fn(el, e);
  });
  document.addEventListener('input', (e) => { if (!e.target.matches || !e.target.matches('[data-dz-input]')) return; const b = e.target.form && e.target.form.querySelector('[data-dz-go]'); if (b) b.disabled = e.target.value.trim().toLowerCase() !== 'delete'; });
  document.addEventListener('change', (e) => { const el = e.target.closest('select[data-action]'); if (el && ACT[el.dataset.action]) ACT[el.dataset.action](el, e); });
  document.addEventListener('submit', (e) => {
    if (e.target.closest('[data-jcmd]')) { e.preventDefault(); const q = $('#jv-q').value.trim(); if (q) { window.App.ask(q); $('#jv-q').value = ''; } return; }
    const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (f.dataset.form === 'account-delete') {
      const b = f.querySelector('[data-dz-go]'); const inp = f.querySelector('[data-dz-input]');
      if ((d.confirm || '').trim().toLowerCase() !== 'delete') { U.toast('Type delete to confirm'); if (inp) inp.focus(); return; }
      b.disabled = true; inp.disabled = true; b.textContent = 'Deleting';
      (async () => {
        try {
          if (window.VideoEditor) window.VideoEditor.reset();
          await Auth.deleteAccount('delete');
          mem.in = false; mem.real = null; U.closeDrawer(); if (window.Voice) Voice.stop();
          login('login'); U.toast('Your account and its data are deleted');
        } catch (err) { b.textContent = 'Delete account'; inp.disabled = false; b.disabled = false; U.toast(Auth.friendly(err) || 'That did not work'); }
      })();
      return;
    }
    if (f.dataset.form === 'account' && mem.real) { const n = (d.full_name || '').trim(); if (!n) return; Auth.saveName(mem.real.user.id, n).then(() => { mem.real.profile.full_name = n; St.A.setSetting('name', n); U.toast('Saved'); shell(); render(); }).catch((ex) => U.toast(Auth.friendly(ex))); return; }
    if (f.dataset.form === 'note') { St.A.note(f.dataset.id, d.note); U.toast('Note saved, queued for HighLevel'); ACT.contact({ dataset: { id: f.dataset.id } }); }
    if (f.dataset.form === 'profile' || f.dataset.form === 'schedules') { Object.entries(d).forEach(([k, v]) => St.A.setSetting(k, v)); St.log('Updated settings', Object.keys(d).join(', '), 'settings'); U.toast('Saved'); shell(); render(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && mem.in) { e.preventDefault(); openAsk(); }
    if (e.key === 'Escape' && $('#drawer').classList.contains('open') && !askd().open && !$('#formd').open) U.closeDrawer();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-action]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Enter' && e.target.id === 'ask-input' && e.target.value.trim()) askRender(e.target.value.trim());
  });
  $('#scrim').addEventListener('click', U.closeDrawer);
  const wsClose = () => { const m = $('#ws-menu'); if (m && !m.hidden) { m.hidden = true; const b = document.querySelector('.switcher'); if (b) b.setAttribute('aria-expanded', 'false'); } };
  document.addEventListener('click', (e) => { if (!e.target.closest('.ws-wrap')) wsClose(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') wsClose(); });
  askd().addEventListener('click', (e) => { if (e.target === askd()) askd().close(); });

  // drag and drop on the content board
  document.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-drag]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.drag); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) c.classList.remove('dragging'); $$('.col.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); $$('.col.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); });
  document.addEventListener('drop', (e) => { const col = e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const i = St.A.moveIdea(id, col.dataset.drop); if (i) U.toast('Moved to ' + col.querySelector('h3').firstChild.textContent.trim()); render(); });

  window.addEventListener('hashchange', route);
  window.App = { isAdmin, setup: () => mem.setup || null, access: () => mem.access, reloadAccess: async () => { try { mem.access = await Auth.admin.list(); } catch (e) { console.error(e); } refreshCounts(); return mem.access; }, render, refreshCounts, answer, liveCtx, isLive: live, reloadConns: async () => { const w = liveCtx().ws; if (w && w.id) { try { mem.conns = await Auth.connections(w.id); } catch (e) { /* keep last */ } } return mem.conns; }, hideSetup: async (v) => { const r = mem.real; if (!r) return; r.profile.onboarded = v; try { await Auth.onboarded(r.user.id, v); } catch (e) { console.error(e); } }, ask: (q) => { openAsk(); $('#ask-input').value = q; askRender(q); } };
  async function boot() {
    if (mem.in) { shell(); route(); return; }
    if (window.Auth && Auth.ready) {
      const recovery = Auth.recovering || /\/reset/.test(location.pathname);
      let sess = null; try { sess = await Auth.session(); } catch (e) { console.error(e); }
      if (recovery && sess) return login('reset');
      if (sess) return enterReal();
      Auth.onChange((ev) => { if (ev === 'PASSWORD_RECOVERY') login('reset'); });
    }
    login();
  }
  boot();
})();

// Founders OS: brain tools.
// 1. AI edit history: every change an AI makes through AI Chat or a connected AI is logged in
//    mcp_changes with a before and after copy. This lists them on Brand DNA, Offers and Funnels
//    and puts the earlier version back on request. Your own edits are never logged or touched here.
// 2. Used in: which funnels, sales pages and email sequences use each offer.
// 3. Download my Brain: Brand DNA, offers, funnels and the Playbook as Markdown files in one zip.
(() => {
  const U = window.UI, ACT = window.ACT, { esc, icon } = U;
  const live = () => !!window.App?.isLive();
  const ws = () => window.App?.liveCtx?.().ws?.id;
  const key = () => (live() ? 'live:' + ws() : 'demo');
  const repaint = () => window.App?.render(true);
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  /* ---------------- AI edit history ---------------- */
  const SECTIONS = {
    dna: ['facts', 'brain_profile', 'writing', 'writing_style', 'brand_board', 'dna_items', 'strategy'],
    offer: ['strategy', 'dna_items'],
    funnel: ['strategy', 'dna_items'],
  };
  const TABLE = { facts: 'brain_facts', brain_profile: 'brain_profile', writing: 'writing_samples', writing_style: 'writing_style', brand_board: 'graphic_kits', dna_items: 'dna_items', strategy: 'founder_strategy' };
  const ONE = { brain_profile: 1, writing_style: 1, brand_board: 1 };
  const WHAT = { facts: 'fact', brain_profile: 'founder profile', writing: 'writing sample', writing_style: 'writing style', brand_board: 'Brand board', dna_items: 'inventory record' };
  const SKIP = new Set(['id', 'workspace_id', 'created_at', 'updated_at', 'created_by', 'revision', 'approved_at', 'words', 'studied_at', 'ext_id', 'ext_updated_at', 'source', 'inventory_id', 'lease_until', 'kind']);
  const LABEL = { statement: 'Statement', category: 'Category', status: 'Status', name: 'Name', summary: 'Summary', price: 'Price', currency: 'Currency', price_note: 'Payment terms', url: 'Link', lifecycle: 'Status', details: 'Details', linked_offer_id: 'Connected offer', body: 'Text', title: 'Title', guide: 'Style guide', profile: 'Profile', palette: 'Palette', fonts: 'Fonts', style: 'Style', handle: 'Handle', included: 'In DNA', pinned: 'Pinned', steps: 'Steps', evidence: 'Evidence', weight: 'Weight' };
  const H = { key: null, rows: [], loading: false, loaded: false, error: '', busy: null, more: {} };

  function demoRows() {
    const offers = (window.OSStrategy?.list() || []).filter((x) => x.kind === 'offer');
    const o = offers.find((x) => /studio kit/i.test(x.name)) || offers[0] || { id: 'demo-o1', name: 'App Builder Kit', price: 497, kind: 'offer', currency: 'USD', summary: 'Twelve AI app blueprints for HighLevel agencies.' };
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    return [
      { id: 'demo-c1', section: 'strategy', row_id: o.id, op: 'update', client: 'AI Team', at: ago(2), before: { ...o, price: 397, summary: 'Twelve blueprints for agencies.' }, after: { ...o }, demo: true },
      { id: 'demo-c2', section: 'facts', row_id: 'f-demo', op: 'create', client: 'Claude', at: ago(26), before: null, after: { statement: 'Built 300+ funnels for founders and agencies.', category: 'proof', status: 'proposed' }, demo: true },
      { id: 'demo-c3', section: 'writing_style', row_id: 'w-demo', op: 'update', client: 'AI Team', at: ago(50), before: { guide: 'Short sentences. Plain words.' }, after: { guide: 'Short sentences. Plain words. Open with the result, then the steps.' }, demo: true },
    ];
  }
  function scopeH() { const k = key(); if (H.key !== k) Object.assign(H, { key: k, rows: [], loading: false, loaded: false, error: '', busy: null, more: {} }); return k; }
  async function loadHistory(force = false) {
    const k = scopeH(); if (H.loading || (H.loaded && !force)) return; H.loading = true;
    try {
      const rows = live() ? await window.Auth.changes.list(ws(), SECTIONS.dna) : (H.rows.length ? H.rows : demoRows());
      if (k !== key()) return; H.rows = rows; H.error = ''; H.loaded = true;
    } catch (e) { if (k === key()) { H.error = window.Auth.friendly ? window.Auth.friendly(e) : e.message; H.loaded = true; } }
    finally { if (k === key()) { H.loading = false; repaint(); } }
  }
  const snap = (c) => c.after || c.before || {};
  const rowName = (c) => { const s = snap(c); return s.name || s.title || s.statement || WHAT[c.section] || 'record'; };
  const kindOf = (c) => (c.section === 'strategy' || c.section === 'dna_items' ? (snap(c).kind === 'funnel' ? 'funnel' : 'offer') : null);
  const who = (c) => (/^ai team$/i.test(c.client || '') ? 'AI Chat' : c.client || 'A connected AI');
  const fmt = (v) => { if (v == null || v === '') return 'empty'; if (typeof v === 'object') return 'updated'; const s = String(v); return s.length > 60 ? s.slice(0, 57) + '...' : s; };
  function diff(c) {
    if (c.op !== 'update' || !c.before || !c.after) return [];
    return Object.keys(c.after).filter((k) => !SKIP.has(k) && JSON.stringify(c.before[k]) !== JSON.stringify(c.after[k])).slice(0, 4)
      .map((k) => ({ k, label: LABEL[k] || k.replace(/_/g, ' '), from: fmt(c.before[k]), to: fmt(c.after[k]), obj: typeof c.after[k] === 'object' && c.after[k] !== null }));
  }
  const when = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d < 30 ? d + ' d ago' : new Date(iso).toLocaleDateString(); };
  function verb(c) {
    const what = c.section === 'strategy' || c.section === 'dna_items' ? (c.section === 'dna_items' ? 'inventory ' : '') + kindOf(c) : WHAT[c.section] || 'record';
    return { create: 'added the ' + what, update: 'changed the ' + what, delete: 'removed the ' + what }[c.op] || 'changed the ' + what;
  }
  function entry(c) {
    const d = diff(c), name = ONE[c.section] ? '' : `<b>${esc(rowName(c))}</b>`;
    const restore = c.undone_at ? '<span class="pill">Restored</span>'
      : `<button class="btn sm" data-action="bt-restore" data-id="${esc(c.id)}" ${H.busy ? 'disabled' : ''}>${H.busy === c.id ? U.spin + 'Restoring' : c.op === 'create' ? 'Remove' : 'Restore'}</button>`;
    return `<li class="bt-entry${c.undone_at ? ' is-undone' : ''}"><div class="bt-what"><p>${esc(who(c))} ${verb(c)} ${name}</p>
      ${d.length ? `<ul class="bt-diff">${d.map((x) => `<li><span>${esc(x.label)}</span>${x.obj ? 'edited' : `<s>${esc(x.from)}</s><i aria-hidden="true">→</i><span class="sr-only">to</span>${esc(x.to)}`}</li>`).join('')}</ul>` : ''}
      <p class="meta">${when(c.at)}${c.op === 'create' ? ' · Removing deletes what the AI added' : c.op === 'delete' ? ' · Restoring brings it back' : ''}</p></div>${restore}</li>`;
  }
  // scope: 'dna' | 'offer' | 'funnel'; rowId narrows to one record (the offer editor)
  function historyPanel(scope, rowId) {
    scopeH(); if (!H.loaded && !H.loading) queueMicrotask(() => loadHistory());
    const secs = SECTIONS[scope] || SECTIONS.dna;
    let rows = H.rows.filter((c) => c.op !== 'undo' && secs.includes(c.section));
    if (scope !== 'dna') rows = rows.filter((c) => kindOf(c) === scope);
    if (rowId) rows = rows.filter((c) => String(c.row_id) === String(rowId));
    const id = scope + (rowId || ''), all = H.more[id], shown = all ? rows : rows.slice(0, 5);
    const sub = rowId ? 'Changes AI made to this ' + scope + '.' : 'Changes made by AI Chat or a connected AI. Your own edits are not listed here.';
    const body = H.loading && !H.loaded ? `<p class="meta">${U.spin} Loading history</p>`
      : H.error ? `<p class="os-error" role="alert">${esc(H.error)} <button class="btn sm" data-action="bt-hreload">Retry</button></p>`
      : rows.length ? `<ul class="bt-list">${shown.map(entry).join('')}</ul>${rows.length > 5 ? `<button class="btn sm ghost" data-action="bt-more" data-id="${esc(id)}">${all ? 'Show fewer' : 'Show all ' + rows.length}</button>` : ''}`
      : `<p class="meta">No AI edits yet. When AI changes something here, it shows up with a way to put it back.</p>`;
    return `<section class="panel bt-history" aria-label="AI edit history"><header><h2>AI edit history</h2><span class="meta">${esc(sub)}</span></header>${body}</section>`;
  }
  const same = (a, b, keys) => keys.every((k) => JSON.stringify(a?.[k] ?? null) === JSON.stringify(b?.[k] ?? null));
  ACT['bt-more'] = (el) => { H.more[el.dataset.id] = !H.more[el.dataset.id]; repaint(); };
  ACT['bt-hreload'] = () => loadHistory(true);
  ACT['bt-restore'] = async (el) => {
    const c = H.rows.find((x) => x.id === el.dataset.id); if (!c || H.busy || c.undone_at) return;
    let warn = '';
    if (live() && c.op === 'update') {
      try {
        const cur = await window.Auth.changes.current(ws(), c.section, c.row_id);
        const keys = Object.keys(c.after || {}).filter((k) => !SKIP.has(k));
        if (cur && !same(cur, c.after, keys)) warn = 'This was edited again after the AI change. Restoring puts back the version from before the AI edit and replaces those later edits.';
        if (!cur) return U.toast('That record no longer exists.');
      } catch (e) { /* fall through to the plain confirm */ }
    }
    const later = H.rows.some((x) => x !== c && x.op !== 'undo' && !x.undone_at && x.section === c.section && String(x.row_id) === String(c.row_id) && new Date(x.at) > new Date(c.at));
    if (later && !warn) warn = 'AI changed this again afterwards. Restoring puts back the version from before this edit and replaces the later AI change too.';
    const verbTxt = c.op === 'create' ? 'Remove what the AI added?' : 'Restore the earlier version?';
    const ok = await U.dialog({ title: verbTxt, body: esc(warn || (c.op === 'create' ? 'This deletes "' + rowName(c) + '", which the AI added.' : 'This puts "' + rowName(c) + '" back the way it was before the AI edit.')), ok: c.op === 'create' ? 'Remove' : 'Restore', danger: c.op === 'create' || !!warn });
    if (!ok) return;
    H.busy = c.id; repaint();
    try {
      if (live()) {
        const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'team_undo', workspace_id: ws(), change_id: c.id }) });
        let j = {}; try { j = await r.json(); } catch { j = {}; }
        if (!r.ok) throw new Error(j.error || 'That change could not be restored');
        c.undone_at = new Date().toISOString();
        H.busy = null;
        await Promise.all([loadHistory(true), window.DNA?.load?.(true), window.OSStrategy?.load?.(true)].map((p) => Promise.resolve(p).catch(() => {})));
      } else {
        c.undone_at = new Date().toISOString();
        if (c.section === 'strategy' && c.before) { const r = (window.OSStrategy?.list() || []).find((x) => x.id === c.row_id); if (r) Object.assign(r, c.before); }
      }
      U.toast(c.op === 'create' ? 'Removed' : 'Restored');
    } catch (e) { U.toast(e.message || 'That change could not be restored'); }
    H.busy = null; repaint();
  };

  /* ---------------- Used in ---------------- */
  const UI_ = { key: null, pages: [], emails: [], loading: false, loaded: false };
  async function loadUsage(force = false) {
    const k = key(); if (UI_.key !== k) Object.assign(UI_, { key: k, pages: [], emails: [], loading: false, loaded: false });
    if (UI_.loading || (UI_.loaded && !force)) return; UI_.loading = true;
    try {
      let pages, emails;
      if (live()) [pages, emails] = await Promise.all([window.Auth.funnel.list(ws()).catch(() => []), window.Auth.emails.list(ws()).catch(() => [])]);
      else { const F = window.OSFunnelView; if (F) { F.full(''); pages = F.rows(); } emails = (window.Store?.s?.emailSets) || []; }
      if (k !== key()) return; UI_.pages = pages || []; UI_.emails = emails || []; UI_.loaded = true;
    } finally { if (k === key()) { UI_.loading = false; repaint(); } }
  }
  // Offers: funnels that sell it, its sales pages and email sequences.
  // Funnels: the offer it sells, sales pages for the funnel or that offer, and email sequences written for the funnel.
  function usage(item, rows) {
    if (!item) return { offers: [], funnels: [], pages: [], emails: [] };
    rows = rows || [];
    const isFunnel = item.kind === 'funnel', linked = isFunnel && item.linked_offer_id ? rows.find((r) => r.id === item.linked_offer_id) : null;
    const pageOffer = (b) => norm(b.offer_name || b.offer?.name || '');
    const pagesFor = (x, byTitle) => { const n = norm(x.name), ids = [x.id, x.inventory_id].filter(Boolean).map(String); return UI_.pages.filter((b) => ids.includes(String(b.offer_ref || '')) || (n && pageOffer(b) === n) || (byTitle && n && norm(b.title) === n)); };
    const pages = isFunnel ? [...pagesFor(item, true), ...(linked ? pagesFor(linked, false) : [])].filter((b, i, a) => a.findIndex((y) => y.id === b.id) === i) : pagesFor(item, false);
    const n = norm(item.name);
    return {
      offers: linked ? [linked] : [],
      funnels: isFunnel ? [] : rows.filter((r) => r.kind === 'funnel' && r.linked_offer_id === item.id),
      pages,
      emails: UI_.emails.filter((e) => n && norm(e.item_name) === n),
    };
  }
  function usedIn(item, rows) {
    const k = key(); if (UI_.key !== k || (!UI_.loaded && !UI_.loading)) queueMicrotask(() => loadUsage());
    const u = usage(item, rows), total = u.offers.length + u.funnels.length + u.pages.length + u.emails.length, isFunnel = item?.kind === 'funnel';
    if (!UI_.loaded) return '';
    if (!total) return `<div class="bt-used is-empty"><span>Used in</span><span>${isFunnel ? 'Not connected to an offer, sales page or email sequence yet.' : 'Not used in a funnel, sales page or email sequence yet.'}</span></div>`;
    const link = (label, a) => `<button type="button" class="bt-chip" ${a}>${esc(label)}</button>`;
    const chips = [
      ...u.offers.map((o) => link(o.name, `data-action="bt-goto" data-to="offers"`)),
      ...u.funnels.map((f) => link(f.name, `data-action="bt-goto" data-to="funnels"`)),
      ...u.pages.map((b) => link(b.title || 'Sales page', `data-action="bt-goto" data-to="funnel-agent" data-id="${esc(b.id)}"`)),
      ...u.emails.map((e) => link(e.title || 'Email sequence', `data-action="bt-goto" data-to="emails"`)),
    ];
    const parts = [[u.offers.length, 'offer'], [u.funnels.length, 'funnel'], [u.pages.length, 'sales page'], [u.emails.length, 'email sequence']].filter(([c]) => c).map(([c, w]) => c + ' ' + w + (c > 1 ? 's' : ''));
    return `<div class="bt-used"><span>Used in</span><span class="meta">${parts.join(', ')}</span><div class="bt-chips">${chips.join('')}</div></div>`;
  }
  // Funnel builds (sales pages): the offer it sells, funnels for that offer, its other sales pages and email sequences.
  let stratAsked = null;
  function buildUsedIn(b) {
    if (!b) return '';
    const k = key(); if (UI_.key !== k || (!UI_.loaded && !UI_.loading)) queueMicrotask(() => loadUsage());
    const OS = window.OSStrategy, st = OS?.state?.();
    if (OS && st && !st.loaded && !st.loading && stratAsked !== k) { stratAsked = k; Promise.resolve(OS.load()).then(repaint).catch(() => {}); }
    if (!UI_.loaded) return '';
    const rows = OS?.list() || [], on = norm(b.offer_name || b.offer?.name || '');
    const offer = rows.find((r) => r.kind === 'offer' && [r.id, r.inventory_id].filter(Boolean).map(String).includes(String(b.offer_ref || ''))) || (on ? rows.find((r) => r.kind === 'offer' && norm(r.name) === on) : null);
    const u = offer ? usage(offer, rows) : { funnels: [], pages: UI_.pages.filter((x) => on && norm(x.offer_name || x.offer?.name) === on), emails: UI_.emails.filter((e) => on && norm(e.item_name) === on) };
    const t = norm(b.title), pages = u.pages.filter((x) => x.id !== b.id), emails = [...u.emails, ...UI_.emails.filter((e) => t && norm(e.item_name) === t)].filter((e, i, a) => a.indexOf(e) === i);
    const link = (label, a) => `<button type="button" class="bt-chip" ${a}>${esc(label)}</button>`;
    const chips = [
      ...(offer ? [link(offer.name, 'data-action="bt-goto" data-to="offers"')] : []),
      ...u.funnels.map((f) => link(f.name, 'data-action="bt-goto" data-to="offers"')),
      ...pages.map((x) => link(x.title || 'Sales page', `data-action="fa-sel" data-id="${esc(x.id)}"`)),
      ...emails.map((e) => link(e.title || 'Email sequence', 'data-action="bt-goto" data-to="emails"')),
    ];
    if (!chips.length) return `<div class="bt-used is-empty fa-used"><span>Used in</span><span>${on ? 'This offer is not in your strategy yet, and no email sequences use it.' : 'Not connected to an offer or email sequence yet.'}</span></div>`;
    const parts = [[offer ? 1 : 0, 'offer'], [u.funnels.length, 'funnel'], [pages.length, 'other sales page'], [emails.length, 'email sequence']].filter(([c]) => c).map(([c, w]) => c + ' ' + w + (c > 1 ? 's' : ''));
    return `<div class="bt-used fa-used"><span>Used in</span><span class="meta">${parts.join(', ')}</span><div class="bt-chips">${chips.join('')}</div></div>`;
  }
  ACT['bt-goto'] = (el) => { if (el.dataset.id && window.OSFunnelView) window.OSFunnelView.select(el.dataset.id); location.hash = '#' + el.dataset.to; };

  /* ---------------- Download my Brain ---------------- */
  const slug = (s) => (String(s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'untitled');
  const line = (k, v) => (v == null || v === '' ? '' : `- ${k}: ${String(v).replace(/\n+/g, ' ')}\n`);
  function offerMd(o, rows) {
    const P = window.StrategySchema, d = o.details || {}, isOffer = o.kind === 'offer';
    const fields = (isOffer ? P?.offerFields : P?.funnelFields) || [];
    const linked = !isOffer && o.linked_offer_id ? (rows.find((x) => x.id === o.linked_offer_id) || {}).name : '';
    let md = `# ${o.name}\n\n` + line('Status', P?.statuses?.[o.lifecycle] || o.lifecycle) + (isOffer && o.price != null ? line('Price', `${o.currency || 'USD'} ${o.price}${o.price_note ? ', ' + o.price_note : ''}`) : '') +
      line('Link', o.url) + line('Connected offer', linked) + line('Revenue stream', d.stream) + line('Launch or review date', d.launch_date) + '\n';
    if (o.summary) md += `## Summary\n\n${o.summary}\n\n`;
    fields.forEach(([k, n]) => { if (d[k]) md += `## ${n}\n\n${d[k]}\n\n`; });
    if (d.notes) md += `## Private strategy notes\n\n${d.notes}\n\n`;
    {
      const u = usage(o, rows), list = [...u.offers.map((x) => 'Offer: ' + x.name), ...u.funnels.map((f) => 'Funnel: ' + f.name), ...u.pages.map((b) => 'Sales page: ' + (b.title || 'Untitled')), ...u.emails.map((e) => 'Email sequence: ' + (e.title || e.item_name))];
      md += `## Used in\n\n${list.length ? list.map((x) => '- ' + x).join('\n') : 'Not used yet.'}\n`;
    }
    return md;
  }
  async function collect() {
    const files = [], date = new Date().toISOString().slice(0, 10), add = (path, body) => { if (body && String(body).trim()) files.push([path, String(body).trim() + '\n']); };
    await Promise.all([window.OSStrategy?.load?.(), loadUsage()].map((p) => Promise.resolve(p).catch(() => {})));
    const d = window.DNA?.data?.() || {}, dna = d.dna, rows = window.OSStrategy?.list() || [];
    add('brand-dna.md', dna ? `# Brand DNA\n\nVersion ${dna.version || 1}. This is the brief AI reads before it drafts anything.\n\n${dna.body || ''}` : '');
    rows.filter((r) => r.kind === 'offer').forEach((o) => add(`offers/${slug(o.name)}.md`, offerMd(o, rows)));
    rows.filter((r) => r.kind === 'funnel').forEach((o) => add(`funnels/${slug(o.name)}.md`, offerMd(o, rows)));
    let pbNote = '';
    if (live()) {
      const id = ws(), A = window.Auth;
      const [facts, samples, style, profile, kit] = await Promise.all([A.facts.list(id), A.writing.list(id), A.writing.style(id), A.brain.profile(id), A.gfx.kit(id)].map((p) => p.catch(() => null)));
      if (facts?.length) {
        const ok = facts.filter((f) => f.status === 'approved'), by = {};
        ok.forEach((f) => (by[f.category || 'other'] = by[f.category || 'other'] || []).push(f.statement));
        add('facts.md', `# Approved founder facts\n\n${Object.entries(by).map(([c, xs]) => `## ${c[0].toUpperCase() + c.slice(1)}\n\n${xs.map((x) => '- ' + x).join('\n')}`).join('\n\n')}`);
      }
      if (profile?.profile) add('founder-profile.md', `# Founder profile\n\n${typeof profile.profile === 'string' ? profile.profile : '```json\n' + JSON.stringify(profile.profile, null, 2) + '\n```'}`);
      if (style?.guide || style?.profile) add('writing/style-guide.md', `# Writing style\n\n${style.guide || ''}${style.profile ? '\n\n## Profile\n\n```json\n' + JSON.stringify(style.profile, null, 2) + '\n```' : ''}`);
      (samples || []).forEach((s) => add(`writing/samples/${slug(s.title)}.md`, `# ${s.title}\n\n${s.kind ? '- Kind: ' + s.kind + '\n\n' : ''}${s.body || ''}`));
      if (kit) add('brand-board.md', `# Brand board\n\n\`\`\`json\n${JSON.stringify({ palette: kit.palette, fonts: kit.fonts, style: kit.style, handle: kit.handle }, null, 2)}\n\`\`\``);
      if (window.App?.isAdmin?.()) {
        try {
          const s = await A.session();
          const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'playbook-list', workspace_id: id }) });
          const j = r.ok ? await r.json() : {}, items = (j.items || []).filter((x) => x.status === 'approved');
          const by = {}; items.forEach((x) => (by[x.topic || 'General'] = by[x.topic || 'General'] || []).push(x));
          Object.entries(by).forEach(([t, xs]) => add(`playbook/${slug(t)}.md`, `# Playbook: ${t}\n\n${xs.map((x) => `## ${x.question}\n\n${x.answer || ''}${x.keywords ? '\n\nKeywords: ' + x.keywords : ''}`).join('\n\n')}`));
          pbNote = items.length ? `- playbook/: ${items.length} approved Playbook answers by topic\n` : '';
        } catch { /* Playbook is optional */ }
      }
    }
    const list = files.map(([p]) => p);
    const sum = (pre) => list.filter((p) => p.startsWith(pre)).length;
    add('README.md', `# My Brain\n\nExported from Founders OS on ${date}${live() ? '' : ' (sample workspace)'}.\n\n` +
      line('brand-dna.md', list.includes('brand-dna.md') ? 'the compiled brief AI reads first' : '') + line('facts.md', list.includes('facts.md') ? 'approved founder facts' : '') +
      line('offers/', sum('offers/') ? sum('offers/') + ' offers with positioning and where each is used' : '') + line('funnels/', sum('funnels/') ? sum('funnels/') + ' funnels' : '') +
      line('writing/', sum('writing/') ? 'your style guide and writing samples' : '') + pbNote +
      '\nDrop these files into any AI tool to give it the same context Founders OS uses.');
    return files.sort((a, b) => (a[0] === 'README.md' ? -1 : b[0] === 'README.md' ? 1 : 0));
  }
  // Minimal store-only zip writer. Markdown is small; no compression needed.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files, root) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    for (const [path, text] of files) {
      const name = enc.encode(root + '/' + path), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, tm, 2], [12, dt, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, s]) => (s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, tm, 2], [14, dt, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, s]) => (s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      parts.push(h, name, data); central.push(c, name); off += 30 + name.length + data.length;
    }
    const size = central.reduce((s, x) => s + (x.byteLength ?? x.length), 0), e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, s]) => (s === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true)));
    return new Blob([...parts, ...central, e], { type: 'application/zip' });
  }
  let exporting = false;
  ACT['brain-download'] = async (el) => {
    if (exporting) return; exporting = true; const label = el.innerHTML; el.disabled = true; el.innerHTML = U.spin + 'Preparing';
    try {
      const files = await collect(), root = 'my-brain-' + new Date().toISOString().slice(0, 10);
      const a = document.createElement('a'); a.href = URL.createObjectURL(zip(files, root)); a.download = root + '.zip';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      window.BrainTools.last = files;
      U.toast(files.length + ' Markdown files downloaded');
    } catch (e) { U.toast(e.message || 'The export could not be prepared'); }
    finally { exporting = false; el.disabled = false; el.innerHTML = label; }
  };

  window.BrainTools = { historyPanel, loadHistory, usedIn, buildUsedIn, loadUsage, usage, collect, zip, last: null };
})();

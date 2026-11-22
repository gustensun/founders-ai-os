// Founders AI OS: Funnel Agent mode in AI Chat.
// Pick one offer, add context and say what you want. The chat keeps a build brief up to date,
// and Build hands it to the Funnel Agent, which researches, writes, designs and publishes the page.
// The preview opens in a new tab. After the build, messages become change requests for the page.
(() => {
  const U = window.UI, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const wsKey = () => (isLive() ? (ctx().ws && ctx().ws.id) || 'live' : 'demo');
  const SKEY = 'fos-funnel-chat:';
  const FIELDS = [
    ['audience', 'Who it is for', 'Who buys it and where they are stuck'],
    ['promise', 'Result and timeline', 'The outcome and a realistic timeline'],
    ['price', 'Price and payment options', 'For example $497, or 3 payments of $177'],
    ['angle', 'Angle', 'The big idea the page leads with'],
    ['sections', 'Page sections', 'Hero, story, offer stack, guarantee, FAQ'],
    ['proof', 'Proof the page can use', 'Only real results, numbers and named testimonials'],
    ['notes', 'Must say or avoid', 'Bonuses, deadlines, words to avoid, style'],
  ];
  const ENG = [['os', 'Founders OS', 'Your AI plans, the OS codes'], ['claude', 'Claude Opus 5.5', 'Hand-coded by Claude'], ['codex', 'GPT-5.3 Codex', 'Hand-coded by Codex'], ['gemini', 'Gemini 4 Carbon', 'Hand-coded by Gemini, needs OpenRouter']];
  const engName = (e) => (ENG.find((x) => x[0] === e) || ENG[0])[1];
  const SCOPES = [['', 'No workspace context'], ['all', 'All context'], ['brain', 'Brain'], ['recordings', 'Recordings'], ['offers', 'Offers and funnels'], ['content', 'Content and research'], ['memory', 'Memory']];
  const IMG = [['mix', 'My photos and AI images'], ['mine', 'Only my photos'], ['ai', 'Only AI images']];
  const TEXT_EXT = /\.(md|markdown|txt|csv|json|html?|xml|ya?ml)$/i;
  const STEP_NAME = { intake: 'Questions', research: 'Market research', offer: 'Final offer', copy: 'Sales copy', brand: 'Brand kit', visuals: 'Visuals', design: 'Page design', build: 'Build', publish: 'Publish', revise: 'Revising', recraft: 'Editing the code', images: 'Drawing new images', sync: 'Syncing from GitHub' };
  const STEPS = ['intake', 'research', 'offer', 'copy', 'brand', 'visuals', 'design', 'build', 'publish'];
  const blank = () => ({ offer: null, msgs: [], answers: {}, engine: 'os', engines: ['os'], builds: [], files: [], scope: '', materials: [], look: { palette_id: '', font_set_id: '', image_mode: 'mix', photos: null }, website: '', build: null, inspiration_ids: [], inspiration_title: '', context: '', ready: false });
  let F = blank(), key = null, busy = false, draft = '', full = {}, timer = null, lastTick = 0, controller = null;

  /* ---------- session, one per workspace ---------- */
  function sync() {
    const k = wsKey(); if (k === key) return;
    key = k; busy = false; draft = ''; full = {}; clearTimeout(timer); controller?.abort();
    try { F = { ...blank(), ...(JSON.parse(localStorage.getItem(SKEY + k) || 'null') || {}) }; } catch (e) { F = blank(); }
    if (!Array.isArray(F.engines) || !F.engines.length) F.engines = [F.engine || 'os'];
    if (!Array.isArray(F.builds)) F.builds = F.build ? [{ id: F.build, engine: F.engine || 'os' }] : [];
    if (!isLive()) { const ok = (id) => id && /^demo-/.test(id) && window.OSFunnelView?.full(id); F = { ...F, builds: F.builds.filter((x) => ok(x.id)), build: ok(F.build) ? F.build : null }; if (!F.build && F.builds[0]) F.build = F.builds[0].id; }
  }
  function persist() {
    try { localStorage.setItem(SKEY + key, JSON.stringify({ ...F, msgs: F.msgs.filter((m) => !m.pending && !m.error).slice(-40) })); } catch (e) { /* private mode */ }
  }
  const rerender = () => { if (VS.view === 'chat' && VS.chFunnel) { const log = document.querySelector('#chlog'); const top = log ? log.scrollTop : 0; window.App.render(true); const n = document.querySelector('#chlog'); if (n) n.scrollTop = top; } };
  const scrollEnd = () => requestAnimationFrame(() => { const l = document.getElementById('chlog'); if (l) l.scrollTop = l.scrollHeight; const ta = document.querySelector('[data-fcform] textarea'); if (ta && !busy && window.innerWidth > 720) ta.focus({ preventScroll: true }); });
  const offers = () => (window.OSFunnelView ? window.OSFunnelView.offers() : []);
  const money = (o) => (o.price ? window.OSFunnel.money(+o.price, o.currency || 'USD') : '');

  /* ---------- the build this chat started ---------- */
  const running = (b) => b && (b.status === 'running' || b.status === 'queued');
  const byId = (id) => (id ? (isLive() ? full[id] : window.OSFunnelView?.full(id)) : null);
  const buildOf = () => byId(F.build);
  const ids = () => (F.builds.length ? F.builds.map((x) => x.id) : F.build ? [F.build] : []);
  async function pull(id) {
    if (!isLive()) return buildOf();
    await Promise.all((id ? [id] : ids()).map(async (x) => { try { full[x] = await window.Auth.funnel.get(x); } catch (e) { /* keep the last copy */ } }));
    return buildOf();
  }
  function watch() {
    clearTimeout(timer); const list = ids(); if (!list.length || list.every((x) => byId(x) && !running(byId(x)))) return;
    timer = setTimeout(async () => {
      const before = Object.fromEntries(list.map((x) => [x, running(byId(x))])); await pull();
      for (const x of list) {
        const b2 = byId(x);
        if (isLive() && b2 && running(b2) && Date.now() - lastTick > 25e3) { window.Auth.funnel.api('tick', { id: x }).catch(() => {}); }
        if (b2 && before[x] && b2.status === 'done') U.toast(`${optName(x)} is ready. Open the preview to see it.`);
      }
      if (Date.now() - lastTick > 25e3) lastTick = Date.now();
      paintBuild(); watch();
    }, isLive() ? 5000 : 1000);
  }
  const optName = (id) => { const i = F.builds.findIndex((x) => x.id === id); const e = i >= 0 ? F.builds[i].engine : (byId(id) || {}).engine; return F.builds.length > 1 ? `Option ${'ABCD'[i] || i + 1}, ${engName(e)}` : (byId(id) || {}).title || 'The funnel'; };
  function paintBuild() {
    document.querySelectorAll('[data-fcbuild]').forEach((el) => { el.outerHTML = buildCards(); });
    const ta = document.querySelector('[data-fcform] textarea'); if (ta) ta.placeholder = placeholder();
  }
  // One card per option. With several builders, pick the one to keep editing.
  function buildCards() {
    const list = F.builds.length ? F.builds : F.build ? [{ id: F.build }] : [];
    if (list.length < 2) return buildCard(buildOf());
    return `<div class="fc-options" data-fcbuild><p class="meta">${list.length} options, one per builder. Open each preview, then keep editing the one you like.</p>${list.map((x) => buildCard(byId(x.id), x.id, true)).join('')}</div>`;
  }
  function buildCard(b, id, multi) {
    if (!b) return `<section class="fc-build" ${multi ? '' : 'data-fcbuild'}><p class="ch-think">${U.spin}<span>Starting ${multi ? esc(optName(id)) : 'the Funnel Agent'}</span></p></section>`;
    const active = !multi || b.id === F.build;
    const done = STEPS.filter((k) => b.steps && b.steps[k] && b.steps[k].state === 'done').length;
    const pill = b.status === 'done' ? '<span class="pill pos">Ready</span>' : b.status === 'failed' ? '<span class="pill neg">Stopped</span>' : `<span class="pill acc">${U.spin}${esc(STEP_NAME[b.step] || 'Working')}</span>`;
    const pv = b.links && b.links.preview;
    const links = [
      pv ? `<a class="btn sm primary" href="${esc(pv)}" target="_blank" rel="noopener">${icon('out')}Open preview</a>` : !isLive() && b.html ? `<button class="btn sm primary" data-action="fc-demo-preview" data-id="${esc(b.id)}">${icon('out')}Open preview</button>` : '',
      multi && !active ? `<button class="btn sm" data-action="fc-pick" data-id="${esc(b.id)}">Keep editing this one</button>` : '',
      b.deploy && b.deploy.url ? `<a class="btn sm" href="${esc(b.deploy.url)}" target="_blank" rel="noopener">${icon('out')}Live page</a>` : '',
      `<button class="btn sm ghost" data-action="fc-page" data-id="${esc(b.id)}">Open in Funnel Agent</button>`,
    ].filter(Boolean).join('');
    const note = b.status === 'failed' ? `<p class="meta">${esc(b.error || 'The agent stopped.')} <button class="linkish" data-action="fc-retry" data-id="${esc(b.id)}">Pick up where it stopped</button></p>`
      : running(b) ? `<p class="meta">${b.version ? 'Version ' + b.version + ' is live in the preview while the agent works.' : pv ? 'The preview tab shows the page as soon as the build step finishes. You can leave this chat.' : 'You can leave this chat. The agent keeps going.'}</p>`
      : multi && !active ? `<p class="meta">Version ${b.version || 1}.</p>`
      : `<p class="meta">Version ${b.version || 1}. Write below to change ${multi ? 'this option' : 'the page'}. Each change publishes a new version.</p>`;
    return `<section class="fc-build${multi && active ? ' is-active' : ''}" ${multi ? '' : 'data-fcbuild'}><header><div><b>${esc(multi ? optName(b.id) : b.title)}</b>${multi && active ? '<span class="pill">Editing</span>' : ''}<span class="meta">${done} of ${STEPS.length} steps${b.version ? ' · Version ' + b.version : ''}</span></div>${pill}</header>${note}<div class="actions">${links}</div></section>`;
  }

  /* ---------- AI suggest: drafts the empty brief fields, never touches what the founder wrote ---------- */
  if (window.AISuggest) window.AISuggest.register('fc-brief', {
    kind: 'brief',
    before: () => { if (document.querySelector('[data-fcbrief]')) readBrief(); },
    fields: () => FIELDS.map(([k, l, h]) => ({ key: k, label: l, hint: h, value: String(F.answers[k] || ''), proof: k === 'proof' })),
    ctx: () => { const o = F.offer || {}; return { offer_id: o.id || null, offer_name: o.name || null, title: o.name || null, price: money(o) || '', context: F.msgs.filter((m) => m.role === 'user' && m.body).map((m) => m.body).slice(-4).join('\n') || null }; },
    apply: (values) => {
      if (document.querySelector('[data-fcbrief]')) readBrief();
      const got = FIELDS.map(([k]) => k).filter((k) => values[k] && !String(F.answers[k] || '').trim());
      got.forEach((k) => { F.answers[k] = values[k]; });
      if (got.length) { F.briefOpen = true; persist(); rerender(); got.forEach((k) => { const el = document.querySelector(`[data-fcbrief="${k}"]`); if (el) { el.classList.add('sg-new'); el.addEventListener('input', () => el.classList.remove('sg-new'), { once: true }); } }); }
      return got.length;
    },
  });

  /* ---------- planning ---------- */
  function demoPlan() {
    const base = window.OSFunnelDemo.build().answers || {}; const o = F.offer || {};
    const said = F.msgs.filter((m) => m.role === 'user').map((m) => m.body);
    const answers = { audience: base.audience || '', promise: base.promise || o.summary || '', price: money(o) || base.price || '', angle: 'Show the finished result first, then the shortest path to it', sections: 'Hero, problem, method, offer stack, bonuses, guarantee, FAQ, final call', ...F.answers };
    if (said.length) answers.notes = [F.answers.notes, said[said.length - 1]].filter(Boolean).join('\n').slice(0, 1500);
    const reply = !said.length ? `I have ${o.name || 'this offer'}${money(o) ? ' at ' + money(o) : ''} from your Brand DNA. What should this funnel do, and who is it for? Tell me anything the page must say or avoid.`
      : said.length === 1 ? 'Got it. I added that to the brief. Do you have real proof the page can use, like a named result? If not, I will leave proof out.' : 'The brief is ready. Check it below, then press Build.';
    return { answers, reply, ready: said.length > 1, by: null, notice: 'Demo workspace: sample planning. In your workspace your own Claude, OpenAI or Perplexity plans with you.' };
  }
  async function plan(q) {
    sync(); if (busy || !F.offer) return; const k = key;
    if (q) F.msgs.push({ role: 'user', body: q });
    F.msgs.push({ role: 'assistant', pending: true }); busy = true; draft = ''; rerender(); scrollEnd();
    controller = new AbortController();
    try {
      let r;
      if (isLive()) r = await window.Auth.funnel.api('plan', { workspace_id: ctx().ws.id, offer_id: F.offer.id || null, offer_name: F.offer.id ? null : F.offer.name, messages: F.msgs.filter((m) => !m.pending && !m.error && !m.build).map(({ role, body }) => ({ role, body })), answers: { ...F.answers }, context: F.context, inspiration_ids: F.inspiration_ids, engines: F.engines, ...extras() });
      else { await new Promise((res) => setTimeout(res, 700)); r = demoPlan(); }
      if (k !== key) return;
      F.msgs.pop(); F.answers = { ...F.answers, ...(r.answers || {}) }; F.ready = !!r.ready;
      F.msgs.push({ role: 'assistant', body: r.reply, by: r.by || null, ready: !!r.ready, notice: r.notice || null });
    } catch (e) {
      if (k !== key) return; F.msgs.pop(); F.msgs.push({ role: 'assistant', error: true, body: 'That did not go through: ' + (window.Auth?.friendly ? window.Auth.friendly(e) : e.message), q });
      if (q) draft = q;
    } finally { if (k === key) { busy = false; controller = null; persist(); rerender(); scrollEnd(); } }
  }
  async function revise(q) {
    const b = buildOf(); if (!b) return;
    if (running(b)) { draft = q; rerender(); return U.toast('The agent is still working. Send the change when this version is done.'); }
    F.msgs.push({ role: 'user', body: q }); busy = true; draft = ''; rerender(); scrollEnd();
    try {
      if (isLive()) { await window.Auth.funnel.api('revise', { id: b.id, request: q }); await pull(); }
      else window.OSFunnelView.demoRevise(b.id, q);
      F.msgs.push({ role: 'assistant', body: `Sent to the Funnel Agent. Version ${(b.version || 0) + 1} publishes on its own, and the preview tab shows it after a refresh.` });
    } catch (e) { F.msgs.pop(); draft = q; U.toast(window.Auth?.friendly ? window.Auth.friendly(e) : e.message); }
    busy = false; persist(); rerender(); scrollEnd(); watch();
  }
  async function build() {
    sync(); if (busy || !F.offer || F.build) return;
    readBrief();
    const answers = { ...F.answers }; if (F.website) answers.website = F.website;
    if (answers.checkout_url && !/^https:\/\//.test(answers.checkout_url)) return U.toast('The order form link should start with https://');
    const engines = F.engines.length ? F.engines : ['os']; const many = engines.length > 1;
    const title = F.offer.name + ' sales page'; busy = true; rerender();
    const made = []; let err = null;
    for (const engine of engines) {
      const t = many ? `${title}, ${engName(engine)}` : title;
      try {
        if (isLive()) {
          const r = await window.Auth.funnel.api('start', { workspace_id: ctx().ws.id, offer_id: F.offer.id || null, offer_name: F.offer.id ? null : F.offer.name, title: t, answers, engine, inspiration_ids: F.inspiration_ids, brand_pick: pick(), ...extras() });
          made.push({ id: r.id, engine });
        } else made.push({ id: window.OSFunnelView.demoStart(answers, t, engine), engine });
      } catch (e) { err = e; }
    }
    if (made.length) {
      F.builds = made; F.build = made[0].id; F.engine = made[0].engine;
      if (isLive()) { await pull(); window.OSFunnelView?.reset(); }
      F.msgs.push({ role: 'assistant', build: true });
      U.toast(many ? `The Funnel Agent is building ${made.length} options. Each preview opens in a new tab.` : 'The Funnel Agent is building. The preview opens in a new tab.');
    }
    if (err) U.toast((made.length ? 'One builder did not start: ' : '') + (window.Auth?.friendly ? window.Auth.friendly(err) : err.message));
    busy = false; persist(); rerender(); scrollEnd(); watch();
  }
  function readBrief() {
    document.querySelectorAll('[data-fcbrief]').forEach((el) => { const k = el.dataset.fcbrief; if (k === 'website') F.website = el.value.trim(); else F.answers[k] = el.value; });
    document.querySelectorAll('[data-fclook]').forEach((el) => { F.look[el.dataset.fclook] = el.value; });
  }
  // Files, workspace scope and program materials go with both planning and the build.
  const extras = () => ({ files: F.files.map(({ name, text }) => ({ name, text })), scope: F.scope || null, material_ids: F.materials });
  const brandBoard = () => { try { return window.OSBrandKit ? window.OSBrandKit.board() : null; } catch (e) { return null; } };
  function pick() {
    const k = brandBoard(); if (!k) return null; const L = F.look || {};
    const photos = k.photos.map((p) => p.name).filter((n) => !Array.isArray(L.photos) || L.photos.includes(n));
    return { palette_id: L.palette_id || (k.palettes.find((x) => x.default) || {}).id || null, font_set_id: L.font_set_id || (k.font_sets.find((x) => x.default) || {}).id || null, image_mode: L.image_mode || 'mix', photos: photos.slice(0, 20) };
  }

  /* ---------- view ---------- */
  const placeholder = () => { const b = buildOf(); return !F.offer ? 'Name the offer, or pick one above' : b ? (running(b) ? 'The agent is building. Write a change to send when it is done' : 'Ask for changes to the page') : 'Add context and tell the agent what you want'; };
  function message(m, i) {
    if (m.build) return buildCards();
    if (m.role === 'user') return `<div class="ch-msg user"><div class="ch-bubble">${esc(m.body).replace(/\n/g, '<br>')}</div></div>`;
    if (m.pending) return `<div class="ch-msg ai"><div class="ch-avatar" aria-hidden="true">${icon('funnel-agent')}</div><div class="ch-body"><p class="ch-think">${U.spin}<span>Reading the offer, Brand DNA and your notes</span></p></div></div>`;
    if (m.error) return `<div class="ch-msg ch-error" role="alert"><div class="ch-avatar" aria-hidden="true">${icon('alert')}</div><div class="ch-body"><p>${esc(m.body)}</p><button class="btn sm ghost" data-action="fc-retry-plan" data-m="${i}">${icon('refresh')}Retry</button></div></div>`;
    const md = window.ChatOS ? window.ChatOS.md(m.body || '', []) : esc(m.body || '');
    const last = i === F.msgs.length - 1;
    return `<div class="ch-msg ai"><div class="ch-avatar" aria-hidden="true">${icon('funnel-agent')}</div><div class="ch-body"><div class="ch-text">${md}</div>
      ${m.notice ? `<p class="meta ch-notice">${icon('alert')}<span>${esc(m.notice)}</span></p>` : ''}
      ${m.ready && last && !F.build ? `<div class="actions"><button class="btn sm primary" data-action="fc-build">${icon('sparkle')}Build the funnel</button></div>` : ''}
      <div class="ch-foot"><span class="meta">Funnel Agent${m.by ? ', planned with ' + esc(m.by) : ''}</span></div></div></div>`;
  }
  function briefPanel() {
    if (!F.offer || F.build) return '';
    const filled = FIELDS.filter(([k]) => String(F.answers[k] || '').trim()).length;
    const extra = Object.keys(F.answers).filter((k) => !FIELDS.some(([f]) => f === k) && !['checkout_url', 'website'].includes(k));
    const field = (k, label, hint) => `<label class="field"><span>${esc(label)}</span><textarea class="input" rows="2" data-fcbrief="${esc(k)}" placeholder="${esc(hint || '')}">${esc(F.answers[k] || '')}</textarea></label>`;
    const open = F.briefOpen != null ? F.briefOpen : F.ready; const n = F.engines.length;
    return `<section class="fc-brief"><div class="fc-brief-top"><button type="button" class="fc-brief-t" data-action="fc-brief" aria-expanded="${open}">${icon('chevron')}<b>Build brief</b><span class="fc-meter" aria-hidden="true"><i style="width:${Math.round(filled / FIELDS.length * 100)}%"></i></span><span class="meta">${filled} of ${FIELDS.length}${F.inspiration_title ? ' · Using ' + esc(F.inspiration_title) : ''}</span></button>${window.AISuggest ? window.AISuggest.button('fc-brief') : ''}<button type="button" class="btn sm primary" data-action="fc-build" ${busy ? 'disabled' : ''}>${icon('sparkle')}${n > 1 ? 'Build ' + n + ' options' : 'Build the funnel'}</button></div>
      ${open ? `<div class="fc-brief-body">${FIELDS.map(([k, l, h]) => field(k, l, h)).join('')}${extra.map((k) => field(k, k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), '')).join('')}
        <div class="fc-row"><label class="field"><span>HighLevel order form link</span><input class="input" type="url" data-fcbrief="checkout_url" value="${esc(F.answers.checkout_url || '')}" placeholder="https://your-domain.com/order"></label>
        <label class="field"><span>Your website, for colors and fonts</span><input class="input" type="url" data-fcbrief="website" value="${esc(F.website)}" placeholder="https://yourdomain.com"></label></div>
        ${builders()}${look()}
        <p class="meta">The agent researches the market, writes the page, emails and HighLevel setup, designs it and publishes to your GitHub and Vercel. The preview opens in a new tab. Proof stays empty unless you add real proof.</p></div>` : ''}</section>`;
  }
  function builders() {
    return `<fieldset class="fc-set"><legend>Build with</legend><p class="meta">Pick one, or several to get a few options side by side. Each builder is a full build on your own keys.</p>
      <div class="fc-chips">${ENG.map(([v, l, h]) => `<label class="fc-chip" title="${esc(h)}"><input type="checkbox" data-fcengine="${v}" ${F.engines.includes(v) ? 'checked' : ''}><span><b>${esc(l)}</b><small class="meta">${esc(h)}</small></span></label>`).join('')}</div></fieldset>`;
  }
  function look() {
    const k = brandBoard(); const L = F.look || {};
    if (!k) return '';
    const pal = L.palette_id && k.palettes.some((x) => x.id === L.palette_id) ? L.palette_id : (k.palettes.find((x) => x.default) || k.palettes[0] || {}).id;
    const fs = L.font_set_id && k.font_sets.some((x) => x.id === L.font_set_id) ? L.font_set_id : (k.font_sets.find((x) => x.default) || k.font_sets[0] || {}).id;
    const sel = (v) => !Array.isArray(L.photos) || L.photos.includes(v);
    const p = k.palettes.find((x) => x.id === pal);
    const dots = p ? `<span class="fc-dots" aria-hidden="true">${Object.values(p.colors).slice(0, 6).map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</span>` : '';
    return `<fieldset class="fc-set"><legend>Brand board</legend>
      <div class="fc-row"><label class="field"><span>Color palette ${dots}</span><select class="input" data-fclook="palette_id">${k.palettes.map((x) => `<option value="${esc(x.id)}" ${x.id === pal ? 'selected' : ''}>${esc(x.name)}${x.default ? ' (default)' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Fonts</span><select class="input" data-fclook="font_set_id">${k.font_sets.map((x) => `<option value="${esc(x.id)}" ${x.id === fs ? 'selected' : ''}>${esc(x.name)}: ${esc(x.display)}${x.body && x.body !== x.display ? ' and ' + esc(x.body) : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Images</span><select class="input" data-fclook="image_mode">${IMG.map(([v, l]) => `<option value="${v}" ${(L.image_mode || 'mix') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      ${k.photos.length ? `<div class="fc-photos" role="group" aria-label="Photos the page can use">${k.photos.map((x) => `<label class="fc-photo"><input type="checkbox" data-fcphoto="${esc(x.name)}" ${sel(x.name) ? 'checked' : ''}><img src="${esc(x.src)}" alt="" loading="lazy"></label>`).join('')}</div><p class="meta">${k.photos.filter((x) => sel(x.name)).length} of ${k.photos.length} photos selected. <button type="button" class="linkish" data-action="fc-board">Edit brand board</button></p>`
        : `<p class="meta">No photos on your brand board yet. Add up to 20 so pages use real photos of you. <button type="button" class="linkish" data-action="fc-board">Edit brand board</button></p>`}</fieldset>`;
  }
  function attachments() {
    const mats = (window.OSPrograms ? window.OSPrograms.materials() || [] : []);
    const chips = [
      ...F.files.map((f, i) => `<span class="fc-att">${icon('upload')}<span>${esc(f.name)}</span><button type="button" class="fc-att-x" data-action="fc-unfile" data-i="${i}" aria-label="Remove ${esc(f.name)}">×</button></span>`),
      ...F.materials.map((id) => { const m = mats.find((x) => x.id === id); return `<span class="fc-att">${icon('programs')}<span>${esc(m ? m.title : 'Program material')}</span><button type="button" class="fc-att-x" data-action="fc-unmat" data-id="${esc(id)}" aria-label="Remove material">×</button></span>`; }),
    ];
    return chips.length ? `<div class="fc-atts">${chips.join('')}</div>` : '';
  }
  function picker() {
    const list = offers().slice(0, 12);
    return `<div class="ch-empty"><h2>Which offer is this funnel for?</h2><p>Pick an offer, add context and tell the agent what you want.<br>It builds the sales page, emails and HighLevel setup.</p></div>
      ${list.length ? `<div class="fc-offers">${list.map((o) => `<button class="fc-offer" data-action="fc-offer" data-id="${esc(o.id)}"><b>${esc(o.name)}</b><span class="meta">${esc(money(o) || 'No price yet')}</span></button>`).join('')}</div>` : ''}
      <form class="fc-fresh" data-fcfresh><input class="input" name="name" maxlength="120" placeholder="Or name a new offer" aria-label="New offer name"><button class="btn sm primary">${icon('plus')}Start</button></form>`;
  }
  function composer() {
    const b = buildOf();
    return `<form class="ch-compose" data-fcform><div class="ch-box">${F.build ? '' : attachments()}<textarea name="q" rows="2" placeholder="${esc(placeholder())}" aria-label="Message" ${busy ? 'disabled' : ''}>${esc(draft)}</textarea>
      <div class="ch-compose-tools"><div class="ch-input-options">${F.build ? `<span class="fc-offer-now">${icon('offers')}<span>${esc(F.offer.name)}</span></span>` : `<button type="button" class="fc-offer-now is-btn" data-action="fc-change" title="Change offer">${icon('offers')}<span>${esc(F.offer.name)}</span><em>Change</em></button>
        <label class="btn sm ghost fc-attach" title="Attach text files: md, txt, csv, json, html">${icon('upload')}Files<input type="file" multiple accept=".md,.markdown,.txt,.csv,.json,.html,.htm,.xml,.yml,.yaml,text/*" data-fcfiles hidden></label>
        <button type="button" class="btn sm ghost" data-action="fc-materials">${icon('programs')}Materials${F.materials.length ? ' (' + F.materials.length + ')' : ''}</button>
        <label class="ch-scope" title="Workspace context for this funnel">${icon('data')}<select data-fcscope aria-label="Workspace context">${SCOPES.map(([v, l]) => `<option value="${v}" ${(F.scope || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`}</div>
      <button class="btn primary ch-send" type="submit" aria-label="Send message" ${busy ? 'disabled' : ''}>${icon('send')}</button></div></div>
      ${b && !running(b) ? '<p class="meta ch-mode">Messages now go to the agent as page changes. Press New funnel to plan another one.</p>' : ''}</form>`;
  }
  let boardFor = null;
  function view() {
    sync();
    if (isLive() && window.OSBrandKit && boardFor !== key) { boardFor = key; window.OSBrandKit.load().then(() => { if (F.offer && !F.build) rerender(); }).catch(() => {}); }
    if (F.build && isLive() && !full[F.build]) pull().then(() => { rerender(); watch(); }); else watch();
    if (!F.offer) return `<div class="ch"><section class="ch-main is-empty"><div class="ch-welcome" id="chlog">${picker()}</div></section></div>`;
    return `<div class="ch"><section class="ch-main has-messages"><div class="ch-log" id="chlog" role="log" aria-label="Funnel conversation" aria-live="polite">${F.msgs.length ? F.msgs.map(message).join('') : `<div class="fc-intro"><h2>A funnel for ${esc(F.offer.name)}</h2><p>Tell the agent who it is for and what the page must say or avoid. Or open the brief below and build straight away.</p><button type="button" class="btn sm" data-action="fc-start">${icon('sparkle')}Start planning</button></div>`}</div>${briefPanel()}${composer()}</section></div>`;
  }

  /* ---------- entry points ---------- */
  function choose(o, extra = {}) {
    F = { ...blank(), offer: { id: o.id || null, name: o.name, price: o.price || null, currency: o.currency || null, summary: o.summary || '' }, context: extra.context || '', inspiration_ids: extra.inspiration_ids || [], inspiration_title: extra.inspiration_title || '' };
    if (extra.context) F.answers.notes = extra.context;
    persist(); plan(null);
  }
  // Open AI Chat with Funnel Agent mode on. With an offer, a new funnel conversation starts right away.
  async function open(opts = {}) {
    sync();
    if (opts.fresh !== false && F.offer && !F.build && F.msgs.some((m) => m.role === 'user') && !await U.dialog({ title: 'Start a new funnel?', body: 'The plan in AI Chat is cleared. Builds you already started stay in the Funnel Agent.', ok: 'Start new' })) { go(); return; }
    if (opts.fresh !== false) { F = blank(); persist(); }
    go();
    const o = opts.offerId ? offers().find((x) => String(x.id) === String(opts.offerId)) : null;
    if (o || opts.name) choose(o || { name: opts.name }, opts);
  }
  function go() { window.ChatOS?.setMode('funnel'); if (location.hash.slice(1).split('?')[0] !== 'chat') location.hash = 'chat'; else rerender(); }
  function reset() { sync(); F = blank(); draft = ''; clearTimeout(timer); persist(); rerender(); }

  ACT['fc-offer'] = (el) => { const o = offers().find((x) => String(x.id) === el.dataset.id); if (o) { choose(o); } };
  ACT['fc-change'] = () => { if (busy) return; F = { ...blank() }; persist(); rerender(); };
  ACT['fc-build'] = () => build();
  ACT['fc-start'] = () => plan(null);
  ACT['fc-brief'] = () => { readBrief(); F.briefOpen = !(F.briefOpen != null ? F.briefOpen : F.ready); persist(); rerender(); };
  ACT['fc-retry-plan'] = (el) => { const m = F.msgs[+el.dataset.m]; F.msgs.splice(+el.dataset.m, 1); const q = m && m.q; if (q) F.msgs.splice(F.msgs.map((x) => x.role === 'user' && x.body).lastIndexOf(q), 1); plan(q || null); };
  ACT['fc-page'] = (el) => { const id = (el && el.dataset.id) || F.build; if (id) window.OSFunnelView?.select(id); location.hash = 'funnel-agent'; };
  ACT['fc-retry'] = async (el) => { const id = (el && el.dataset.id) || F.build; if (!id) return; if (!isLive()) return U.toast('In your workspace this picks up the build on the server.'); try { await window.Auth.funnel.api('retry', { id }); await pull(id); paintBuild(); watch(); } catch (e) { U.toast(window.Auth.friendly(e)); } };
  ACT['fc-pick'] = (el) => { const x = F.builds.find((b) => b.id === el.dataset.id); if (!x || busy) return; F.build = x.id; F.engine = x.engine; persist(); rerender(); U.toast(`Changes now go to ${optName(x.id)}.`); };
  ACT['fc-board'] = () => { readBrief(); persist(); if (window.OSBrandKit) window.OSBrandKit.open(); };
  ACT['fc-unfile'] = (el) => { F.files.splice(+el.dataset.i, 1); persist(); rerender(); };
  ACT['fc-unmat'] = (el) => { F.materials = F.materials.filter((x) => x !== el.dataset.id); persist(); rerender(); };
  ACT['fc-materials'] = async () => {
    if (!window.OSPrograms) return; try { await window.OSPrograms.load(); } catch (e) { /* show what is loaded */ }
    const ms = (window.OSPrograms.materials() || []).filter((m) => !m.removal_pending); const on = new Set(F.materials);
    U.drawer(`<div class="pg-editor"><h2>Program materials</h2><p>Select up to 12 files or notes for this funnel. The agent reads them while it plans and builds.</p>${ms.length ? ms.map((m) => `<label class="ch-material-choice"><input type="checkbox" data-fcmaterial="${esc(m.id)}" ${on.has(m.id) ? 'checked' : ''}><span>${esc(m.title)}</span></label>`).join('') : '<p class="meta">Add your existing material in Programs first.</p>'}<div class="actions"><button class="btn" data-action="drawer-close">Done</button></div></div>`, { label: 'Program materials' });
  };
  async function addFiles(list) {
    const skipped = [];
    for (const f of list) {
      if (F.files.length >= 6) { skipped.push(f.name); continue; }
      if (!TEXT_EXT.test(f.name) && !/^text\//.test(f.type)) { skipped.push(f.name); continue; }
      if (f.size > 2e6) { skipped.push(f.name); continue; }
      const text = (await f.text()).replace(/\u0000/g, '').slice(0, 12000);
      if (text.trim()) F.files.push({ name: f.name.slice(0, 120), text, size: f.size });
    }
    if (skipped.length) U.toast(`Not added: ${skipped.slice(0, 3).join(', ')}. Use up to 6 text files (md, txt, csv, json, html). For PDF or Word, add it to Programs and pick it under Materials.`);
    persist(); rerender();
  }
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t || !t.matches) return;
    if (t.matches('[data-fcfiles]')) { addFiles([...t.files]); t.value = ''; return; }
    if (t.matches('[data-fcscope]')) { F.scope = t.value; persist(); return; }
    if (t.matches('[data-fcengine]')) { const on = new Set(F.engines); if (t.checked) on.add(t.dataset.fcengine); else on.delete(t.dataset.fcengine); if (!on.size) { t.checked = true; return U.toast('Pick at least one builder.'); } F.engines = ENG.map((x) => x[0]).filter((x) => on.has(x)); readBrief(); persist(); rerender(); return; }
    if (t.matches('[data-fclook]')) { readBrief(); persist(); if (t.dataset.fclook === 'palette_id') rerender(); return; }
    if (t.matches('[data-fcphoto]')) { const k = brandBoard(); if (!k) return; const all = k.photos.map((p) => p.name); const on = new Set(Array.isArray(F.look.photos) ? F.look.photos : all); if (t.checked) on.add(t.dataset.fcphoto); else on.delete(t.dataset.fcphoto); F.look.photos = all.filter((n) => on.has(n)); readBrief(); persist(); rerender(); return; }
    if (t.matches('[data-fcmaterial]')) { const on = new Set(F.materials); if (t.checked && on.size >= 12) { t.checked = false; return U.toast('Select up to 12 materials.'); } if (t.checked) on.add(t.dataset.fcmaterial); else on.delete(t.dataset.fcmaterial); F.materials = [...on]; persist(); rerender(); }
  });
  ACT['fc-demo-preview'] = (el) => { const b = (el && el.dataset.id && byId(el.dataset.id)) || buildOf(); if (!b || !b.html) return; const w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(b.html); w.document.close(); } };

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.matches && f.matches('[data-fcfresh]')) { e.preventDefault(); const n = f.elements.name.value.trim(); if (!n) return f.elements.name.focus(); choose({ name: n }); return; }
    if (!f.matches || !f.matches('[data-fcform]')) return;
    e.preventDefault(); const q = f.elements.q.value.trim(); if (!q || busy) return; readBrief();
    if (F.build) revise(q); else plan(q);
  });
  document.addEventListener('input', (e) => {
    const ta = e.target.closest && e.target.closest('[data-fcform] textarea'); if (ta) { draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; return; }
    if (e.target.closest && e.target.closest('[data-fcbrief]')) { readBrief(); persist(); }
  });
  document.addEventListener('keydown', (e) => {
    const ta = e.target.closest && e.target.closest('[data-fcform] textarea'); if (!ta || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault(); ta.form.requestSubmit();
  });

  window.ChatFunnel = { view, open, reset, state: () => ({ ...F, busy, key }), busy: () => busy };
})();

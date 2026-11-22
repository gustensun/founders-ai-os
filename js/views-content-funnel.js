// Content Funnel. Start from what you give away and what you sell, and work back to the content that leads
// people there. Top gets the view, middle gets the email, bottom gets the sale. Picked ideas go to Ideas to
// approve. This page never publishes anything and never shows prices.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, { esc } = U;
  const F = () => window.ContentFunnel;
  const live = () => !!window.App?.isLive(), ws = () => window.App?.liveCtx().ws?.id, key = () => [live() ? 'live' : 'demo', ws()].join(':');
  const S = { key: null, loaded: false, loading: false, error: '', freebies: [], strategy: [], plans: {}, sel: null, picks: new Set(), busy: '' };
  const onView = () => VS.view === 'content-funnel';
  const render = () => { if (onView()) window.App.render(true); };
  function scope() { const k = key(); if (S.key !== k) Object.assign(S, { key: k, loaded: false, loading: false, error: '', freebies: [], strategy: [], plans: {}, sel: null, picks: new Set(), busy: '' }); return k; }

  /* ---------- sample data for the demo ---------- */
  const SAMPLE = [
    ['Clinic website checklist', 'Shows a clinic owner the 12 things their website needs before they pay for ads.', /website plus hosting/i],
    ['AI Studio starter prompts', 'Ten prompts that get a first working app out of AI Studio.', /app builder kit/i],
    ['Funnel template pack', 'Three funnel layouts ready to copy into HighLevel.', /funnel kit/i],
    ['HighLevel setup checklist', 'The first hour inside a new HighLevel account, step by step.', /highlevel starter/i],
    ['Founder weekly planner', 'One page to plan a founder week around content and sales.', null],
  ];
  const KEEP = /app builder kit|funnel kit|studio membership|group coaching|website plus hosting|highlevel starter/i;
  function demo() {
    const items = (window.DNA?.data().items || []);
    const strategy = items.filter((x) => (x.kind === 'offer' ? KEEP.test(x.name) && x.included : true)).map((x) => ({ id: x.id, kind: x.kind, name: x.name, lifecycle: x.included ? 'live' : 'planned', summary: x.kind === 'funnel' ? x.summary || '' : '', url: '', linked_offer_id: null }));
    const freebies = SAMPLE.map(([name, summary, re], i) => ({ id: 'cf-demo-' + (i + 1), kind: 'freebie', name, summary, url: '', leads_to: (re && (strategy.find((s) => s.kind === 'offer' && re.test(s.name)) || {}).id) || null, position: i + 1 }));
    const plans = {}; const f = freebies[0]; const offer = strategy.find((s) => s.id === f.leads_to);
    if (offer) {
      const c = F().context(f, freebies, strategy); const cta = (st) => F().ctaFor(c, st);
      const a = (id, st, topic, angle, v, w, s) => ({ id, topic, angle, cta: cta(st), ideas: { video: { title: v[0], hook: v[1] }, written: { title: w[0], hook: w[1] }, short: { title: s[0], hook: s[1] } } });
      plans[f.id] = { v: 1, by: 'Rules', at: new Date().toISOString(), stages: {
        top: [
          a('demotop1', 'top', 'Why clinic sites lose patients', 'Show the three places a clinic website loses a booking, using real screens.', ['Why your clinic website is losing patients', 'Most clinic websites lose the booking in the first ten seconds.'], ['Three leaks on every clinic website', 'I look at clinic websites every week. The same three leaks show up.'], ['Your booking button is hiding', 'Open your clinic site on a phone. Can you book in one tap?']),
          a('demotop2', 'top', 'Ads before the site is ready', 'Explain why paying for ads before the site converts wastes the budget.', ['Do not run ads to your clinic site yet', 'If your site cannot book a patient, ads only make the problem more expensive.'], ['Fix the site before the ads', 'A clinic owner asked me why their ads were not working.'], ['Ads will not fix this', 'Ads send people. Your site has to book them.']),
        ],
        middle: [
          a('demomid1', 'middle', 'The checklist on a real site', 'Run the checklist on one real clinic site, start to finish.', ['I audited a clinic website in 12 steps', 'I am going to open a real clinic website and check it against 12 points.'], ['The 12 checks I run on a clinic site', 'Before I touch a clinic website, I run 12 checks.'], ['Check 3 fails most often', 'Most clinic sites fail check number three.']),
          a('demomid2', 'middle', 'Before and after', 'Show one clinic page before and after the checklist.', ['One clinic page, before and after', 'Same clinic, same page. One checklist between the two versions.'], ['What changed after the checklist', 'I rebuilt one clinic page using only the checklist.'], ['Before. After. 12 checks.', 'This is the same page.']),
        ],
        bottom: [
          a('demobot1', 'bottom', 'What the build includes', `Show everything inside ${offer.name} on screen.`, [`Inside the ${offer.name.toLowerCase()}`, 'I will show you everything you get, so you can decide.'], ['What you get when I build your site', 'People ask what the build includes. Here is the list.'], ['What the build includes', 'This is what I build for a clinic.']),
          a('demobot2', 'bottom', 'Checklist or done for you', 'Say when the free checklist is enough and when the build makes sense.', ['Do it yourself or have it built', 'The checklist is enough for some clinics. Here is how to tell.'], ['When the checklist is enough', 'You may not need me to build your site.'], ['Do you need the build?', 'You might not need me.']),
        ],
      } };
    }
    return { freebies, strategy, plans };
  }

  /* ---------- loading ---------- */
  async function load(force = false) {
    const k = scope(); if (S.loading || (S.loaded && !force)) return; S.loading = true;
    try {
      let d;
      if (live()) { const [r] = await Promise.all([window.Auth.brainApi('cf-list', { workspace_id: ws() }), Promise.resolve(window.OSBoard?.load()).catch(() => null)]); d = { freebies: r.freebies || [], strategy: r.strategy || [], plans: { ...(r.plans || {}) } }; d.freebies.forEach((f) => { if (f.plan) d.plans[f.id] = f.plan; }); }
      else { await null; d = S.freebies.length || S.strategy.length ? { freebies: S.freebies, strategy: S.strategy, plans: S.plans } : demo(); }
      if (k !== key()) return;
      Object.assign(S, d, { loaded: true, error: '' });
      if (!find(S.sel)) S.sel = first();
    } catch (e) { if (k === key()) { S.error = window.Auth?.friendly ? window.Auth.friendly(e) : e.message; S.loaded = true; } }
    finally { if (k === key()) { S.loading = false; render(); } }
  }
  const offers = () => S.strategy.filter((x) => x.kind === 'offer'), funnels = () => S.strategy.filter((x) => x.kind === 'funnel');
  const first = () => { const x = S.freebies[0] || offers()[0] || funnels()[0]; return x ? { kind: x.kind, id: x.id } : null; };
  const find = (sel) => !sel ? null : sel.kind === 'freebie' ? S.freebies.find((x) => x.id === sel.id) || null : S.strategy.find((x) => x.id === sel.id && x.kind === sel.kind) || null;
  const ctxOf = (src) => F().context(src, S.freebies, S.strategy);
  const board = () => window.OSBoard?.all() || [];
  const sentRows = () => { const m = {}; board().forEach((r) => { const k = r.meta?.funnel?.key; if (!k || r.stage === 'passed') return; m[k] = r; }); return m; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------- the page ---------- */
  const chip = (x) => { const on = S.sel && S.sel.id === x.id && S.sel.kind === x.kind; return `<button type="button" class="chip" data-action="cf-pick" data-kind="${x.kind}" data-id="${esc(x.id)}" aria-pressed="${on}"><span>${esc(x.name)}</span>${x.lifecycle === 'planned' ? '<span class="cf-chip-note">Planned</span>' : ''}</button>`; };
  function chooser() {
    const add = `<button type="button" class="chip cf-plus" data-action="cf-add">Add</button>`;
    const row = (h, inner) => `<div class="cf-row"><h2>${h}</h2><div class="cf-chips">${inner}</div></div>`;
    return `<section class="cf-pick" aria-label="What the content leads to">
      ${row('Freebies', S.freebies.map(chip).join('') + add)}
      ${row('Offers', offers().length ? offers().map(chip).join('') : '<p class="meta">No offers yet. Add what you sell in <a class="lnk" href="#offers">Offers</a>.</p>')}
      ${row('Funnels', funnels().length ? funnels().map(chip).join('') : '<p class="meta">No funnels yet. Add them in <a class="lnk" href="#funnels">Funnels</a>.</p>')}
    </section>`;
  }
  function headLine(src, c, plan) {
    const bits = [F().KINDS[src.kind]];
    if (src.kind === 'freebie') bits.push(c.offer ? `Leads to ${esc(c.offer.name)}${c.offer.lifecycle === 'planned' ? ' (planned)' : ''}` : 'No offer chosen yet');
    else {
      if (src.lifecycle === 'planned') bits.push('Planned, not available yet');
      if (src.kind === 'funnel' && c.offer) bits.push(`Sells ${esc(c.offer.name)}`);
      bits.push(c.feeds.length ? `Fed by ${c.feeds.slice(0, 3).map((f) => esc(f.name)).join(', ')}${c.feeds.length > 3 ? ' and ' + (c.feeds.length - 3) + ' more' : ''}` : 'No freebie leads here yet');
    }
    const n = F().count(plan); if (n) bits.push(plural(n, 'angle') + (live() ? `, written by ${plan.by === 'Rules' ? 'the built-in rules' : esc(plan.by)}` : ''));
    return bits.join(' · ');
  }
  function idea(src, stage, a, f, sent) {
    const k = F().ideaKey(src.id, a.id, f.id), it = a.ideas[f.id], row = sent[k];
    const text = `<span class="cf-idea-t"><b>${esc(it.title)}</b>${it.hook ? `<span>${esc(it.hook)}</span>` : ''}</span>`;
    if (row) return `<li class="cf-idea is-sent"><span class="cf-done" aria-hidden="true">${U.icon('check')}</span><span class="tag">${f.name}</span>${text}<button type="button" class="lnk meta" data-action="cf-open" data-id="${esc(row.id)}">${esc(F().stateName(row.stage) || 'In Ideas')}</button></li>`;
    return `<li><label class="cf-idea"><input type="checkbox" data-action="cf-toggle" data-stage="${stage}" data-angle="${esc(a.id)}" data-format="${f.id}" data-key="${esc(k)}" ${S.picks.has(k) ? 'checked' : ''} ${S.busy ? 'disabled' : ''}><span class="tag">${f.name}</span>${text}</label></li>`;
  }
  function angle(src, stage, a, sent) {
    return `<article class="cf-angle"><header><h3>${esc(a.topic)}</h3><button type="button" class="lnk meta" data-action="cf-angle-remove" data-angle="${esc(a.id)}" ${S.busy ? 'disabled' : ''} aria-label="Remove the angle ${esc(a.topic)}">Remove</button></header>
      ${a.angle ? `<p class="cf-angle-line">${esc(a.angle)}</p>` : ''}
      <ul class="cf-ideas">${F().FORMATS.map((f) => idea(src, stage, a, f, sent)).join('')}</ul>
      ${a.cta ? `<p class="cf-ends">Ends with: ${esc(a.cta)}</p>` : ''}</article>`;
  }
  function tier(src, c, plan, st, sent, cov) {
    const list = (plan && plan.stages[st.id]) || []; let body;
    if (st.id === 'bottom' && !c.sale) body = `<div class="cf-need"><p>${src.kind === 'freebie' ? 'Choose the offer this freebie leads to. The bottom stage is then written for that offer.' : 'Connect this funnel to an offer in Funnels and the bottom stage is written for it.'}</p>${src.kind === 'freebie' ? '<button type="button" class="btn sm" data-action="cf-edit">Choose the offer</button>' : '<a class="btn sm" href="#funnels">Open Funnels</a>'}</div>`;
    else if (!list.length) body = `<p class="cf-need meta">${plan ? 'No angles here yet. More angles adds one.' : esc(st.job)}</p>`;
    else body = `<p class="cf-cov meta">${plural(cov.angles, 'angle')} · ${cov.sent} of ${cov.ideas} ideas sent to Ideas</p>${list.map((a) => angle(src, st.id, a, sent)).join('')}`;
    const hint = st.id === 'middle' && src.kind !== 'freebie' && !c.feeds.length && list.length ? `<p class="cf-hint meta">No freebie leads here yet, so these end with your email list. <button type="button" class="lnk" data-action="cf-add" data-leads="${esc(src.kind === 'offer' ? src.id : (c.offer && c.offer.id) || '')}">Add a freebie for it</button></p>` : '';
    return `<section class="cf-tier" data-stage="${st.id}" aria-label="${st.name}"><div class="cf-shape"><div><b>${st.name}</b><span>${st.goal}</span></div></div><div class="cf-body">${hint}${body}</div></section>`;
  }
  function selected() {
    const src = find(S.sel); if (!src) return '';
    const c = ctxOf(src), plan = S.plans[src.id] || null, has = F().count(plan) > 0, sent = sentRows(), sentState = Object.fromEntries(Object.entries(sent).map(([k, r]) => [k, r.stage])), cov = F().coverage(plan, src.id, sentState);
    const working = S.busy === 'plan';
    const tools = (src.kind === 'freebie' ? `<button type="button" class="btn ghost" data-action="cf-remove" ${S.busy ? 'disabled' : ''}>Remove</button><button type="button" class="btn" data-action="cf-edit" ${S.busy ? 'disabled' : ''}>Edit</button>` : `<a class="btn" href="#${src.kind === 'offer' ? 'offers' : 'funnels'}">Open in ${src.kind === 'offer' ? 'Offers' : 'Funnels'}</a>`)
      + `<button type="button" class="btn${has ? '' : ' primary'}" data-action="cf-plan" ${S.busy ? 'disabled' : ''}>${working ? U.spin + 'Writing' : has ? 'More angles' : 'Write the funnel'}</button>`;
    const note = !live() ? '<p class="os-notice">Sample freebies and a sample plan for the demo. In your private workspace this page starts from your own freebies, offers and funnels.</p>'
      : has && plan.by === 'Rules' ? '<p class="os-notice">These angles come from the built-in rules. Connect Claude, OpenAI or Perplexity in <a class="lnk" href="#connect">Connections</a> and new angles are written from your Brand DNA, in your voice.</p>' : '';
    return `<section class="cf-sel"><header class="cf-head"><div><h2>${esc(src.name)}</h2><p class="meta">${headLine(src, c, plan)}</p>${src.summary ? `<p class="cf-sum">${esc(src.summary)}</p>` : ''}</div><div class="actions">${tools}</div></header>
      ${note}${S.error ? `<p class="os-error" role="alert">${esc(S.error)}</p>` : ''}
      <div class="cf-funnel" ${working ? 'aria-busy="true"' : ''}>${F().STAGES.map((st) => tier(src, c, plan, st, sent, cov[st.id])).join('')}</div>
      ${bar()}</section>`;
  }
  const barText = () => `${S.picks.size} selected`;
  function bar() {
    const n = S.picks.size;
    return `<div class="cf-bar" role="region" aria-label="Selected ideas" ${n ? '' : 'hidden'}><span data-cf-count role="status">${barText()}</span><button type="button" class="lnk meta" data-action="cf-clear" ${S.busy ? 'disabled' : ''}>Clear</button><button type="button" class="btn primary" data-action="cf-send" ${S.busy ? 'disabled' : ''}>${S.busy === 'send' ? U.spin + 'Sending' : 'Remix to Ideas'}</button></div>`;
  }
  function view() {
    scope();
    const head = U.title('Content Funnel', 'Start from what you give away and what you sell. Work back to the videos, posts and shorts that lead people there.', S.loaded && !S.error ? '<button type="button" class="btn" data-action="cf-add">Add freebies</button>' : '');
    if (!S.loaded) { load(); return head + `<p class="meta" role="status">${U.spin}Loading your content funnel</p>`; }
    if (S.error && !S.freebies.length && !S.strategy.length) return head + `<p class="os-error" role="alert">${esc(S.error)}</p><button type="button" class="btn" data-action="cf-reload">Try again</button>`;
    if (!S.freebies.length && !S.strategy.length) return head + U.empty('Start with what you give away', 'Paste the freebies you already have, one per line. Each one gets a top, middle and bottom plan with video, written and short ideas.', '<button type="button" class="btn primary" data-action="cf-add">Add freebies</button>');
    return head + chooser() + selected();
  }
  V['content-funnel'] = view; V['content-funnel'].live = view;
  window.OSContentFunnel = { state: () => ({ loaded: S.loaded, loading: S.loading, busy: S.busy, error: S.error, picks: S.picks.size, sel: S.sel, freebies: S.freebies.length }), reset: () => { S.key = null; } };

  /* ---------- choosing and selecting ---------- */
  ACT['cf-reload'] = () => { S.loaded = false; S.error = ''; render(); };
  ACT['cf-pick'] = (el) => { if (S.busy) return; S.sel = { kind: el.dataset.kind, id: el.dataset.id }; S.picks = new Set(); S.error = ''; render(); };
  function syncBar() {
    const b = document.querySelector('.cf-bar'); if (!b) return;
    b.hidden = !S.picks.size; const c = b.querySelector('[data-cf-count]'); if (c) c.textContent = barText();
  }
  ACT['cf-toggle'] = (el) => {
    const k = el.dataset.key; if (!k) return;
    if (el.checked && S.picks.size >= F().MAX_PICKS) { el.checked = false; U.toast(`Send up to ${F().MAX_PICKS} ideas at a time`); return; }
    if (el.checked) S.picks.add(k); else S.picks.delete(k);
    syncBar();
  };
  ACT['cf-clear'] = () => { S.picks = new Set(); document.querySelectorAll('.cf-idea input:checked').forEach((x) => { x.checked = false; }); syncBar(); };
  ACT['cf-open'] = async (el) => { try { await window.OSBoard.open(el.dataset.id); } catch (e) { U.toast(e.message); } };

  /* ---------- freebies ---------- */
  const offerOptions = (none) => [['', none]].concat(offers().map((o) => [o.id, o.name + (o.lifecycle === 'planned' ? ' (planned)' : '')]));
  ACT['cf-add'] = async (el) => {
    if (S.busy) return;
    const lead = el.dataset.leads || '';
    const v = await U.dialog({ title: 'Add freebies', body: 'One per line. Paste your whole list, you can link each one to an offer later.', fields: [
      { name: 'names', label: 'Freebies you give away', type: 'textarea', rows: 7, required: true, placeholder: 'Funnel template pack\nYouTube title vault' },
      ...(offers().length ? [{ name: 'leads_to', label: 'Offer they lead to', type: 'select', options: offerOptions('Choose later'), value: lead }] : []),
    ], ok: 'Add freebies' });
    if (!v) return;
    const names = F().parseNames(v.names); if (!names.length) return U.toast('Add at least one freebie');
    const k = key(); S.busy = 'save'; S.error = ''; render();
    try {
      let added;
      if (live()) { const r = await window.Auth.brainApi('cf-save', { workspace_id: ws(), names, leads_to: v.leads_to || null }); added = r.freebies || []; }
      else {
        const have = new Set(S.freebies.map((x) => F().norm(x.name)));
        added = names.filter((n) => !have.has(F().norm(n))).map((name, i) => ({ id: 'cf-demo-' + Date.now().toString(36) + i, kind: 'freebie', name, summary: '', url: '', leads_to: v.leads_to || null, position: S.freebies.length + i + 1 }));
        if (!added.length) throw new Error('Those freebies are already on the list.');
        if (S.freebies.length + added.length > F().MAX_FREEBIES) throw new Error(`Keep the list to ${F().MAX_FREEBIES} freebies.`);
      }
      if (k !== key()) return;
      S.freebies = S.freebies.concat(added); if (added[0]) { S.sel = { kind: 'freebie', id: added[0].id }; S.picks = new Set(); }
      U.toast(`${plural(added.length, 'freebie')} added`);
    } catch (e) { if (k === key()) U.toast(e.message || 'Could not add the freebies'); }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };
  ACT['cf-edit'] = async () => {
    const f = find(S.sel); if (!f || f.kind !== 'freebie' || S.busy) return;
    const v = await U.dialog({ title: 'Edit freebie', body: F().count(S.plans[f.id]) && f.leads_to ? 'Changing the offer clears the bottom stage, so it can be written again for the new offer.' : '', fields: [
      { name: 'name', label: 'Name', value: f.name, required: true },
      { name: 'summary', label: 'What it helps people do', type: 'textarea', rows: 3, value: f.summary || '', placeholder: 'One or two lines. The clearer this is, the better the angles.' },
      { name: 'url', label: 'Link to the signup page', value: f.url || '', placeholder: 'https://' },
      { name: 'leads_to', label: 'Offer it leads to', type: 'select', options: offerOptions('No offer yet'), value: f.leads_to || '' },
    ], ok: 'Save freebie' });
    if (!v) return;
    let n; try { n = F().normalizeFreebie({ ...v, leads_to: v.leads_to || null }); } catch (e) { return U.toast(e.message); }
    if (v.url && !n.url) return U.toast('The link needs to start with https://');
    if (v.leads_to && !n.leads_to && live()) return U.toast('Choose an offer from the list');
    if (!live()) n.leads_to = v.leads_to || null;
    const k = key(); S.busy = 'save'; S.error = ''; render();
    try {
      if (live()) { const r = await window.Auth.brainApi('cf-save', { workspace_id: ws(), id: f.id, freebie: n }); if (k !== key()) return; const row = (r.freebies || [])[0]; Object.assign(f, row); if (row.plan) S.plans[f.id] = row.plan; }
      else { const changed = (f.leads_to || null) !== (n.leads_to || null); Object.assign(f, n); if (changed && S.plans[f.id]) S.plans[f.id] = { ...S.plans[f.id], stages: { ...S.plans[f.id].stages, bottom: [] } }; }
      S.picks = new Set(); U.toast('Freebie saved');
    } catch (e) { if (k === key()) U.toast(e.message || 'Could not save the freebie'); }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };
  ACT['cf-remove'] = async () => {
    const f = find(S.sel); if (!f || f.kind !== 'freebie' || S.busy) return;
    const ok = await U.dialog({ title: `Remove ${f.name}?`, body: 'Its funnel plan is removed with it. Ideas you already sent stay in Ideas and Content.', ok: 'Remove freebie', danger: true });
    if (!ok) return;
    const k = key(); S.busy = 'save'; render();
    try {
      if (live()) await window.Auth.brainApi('cf-remove', { workspace_id: ws(), id: f.id });
      if (k !== key()) return;
      S.freebies = S.freebies.filter((x) => x.id !== f.id); delete S.plans[f.id]; S.sel = first(); S.picks = new Set(); U.toast('Freebie removed');
    } catch (e) { if (k === key()) U.toast(e.message || 'Could not remove the freebie'); }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };

  /* ---------- the plan ---------- */
  ACT['cf-plan'] = async () => {
    const src = find(S.sel); if (!src || S.busy) return;
    const k = key(), id = src.id; S.busy = 'plan'; S.error = ''; render();
    try {
      let plan, added, by;
      if (live()) { const r = await window.Auth.brainApi('cf-plan', { workspace_id: ws(), source: { kind: src.kind, id } }); plan = r.plan; added = r.added; by = r.by; }
      else {
        const c = ctxOf(src), had = S.plans[id]; const fresh = F().rules(c, 2, had);
        if (F().count(had)) F().stagesFor(c).forEach((st) => { if (had.stages[st].length) fresh[st] = fresh[st].slice(0, 1); });
        const m = F().merge(had, fresh, 'Rules'); if (!m.added) throw new Error(`Each stage holds up to ${F().MAX_ANGLES} angles. Remove one to make room.`);
        plan = m.plan; added = m.added; by = 'Rules';
      }
      if (k !== key()) return;
      S.plans[id] = plan; if (src.kind === 'freebie') src.plan = plan;
      U.toast(`${plural(added, 'angle')} added${by && by !== 'Rules' ? ', written by ' + by : ''}`);
    } catch (e) { if (k === key()) S.error = e.message || 'The funnel could not be written. Try again.'; }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };
  ACT['cf-angle-remove'] = async (el) => {
    const src = find(S.sel); if (!src || S.busy) return; const plan = S.plans[src.id]; if (!plan) return;
    const a = F().STAGES.map((s) => F().findAngle(plan, s.id, el.dataset.angle)).find(Boolean); if (!a) return;
    const ok = await U.dialog({ title: `Remove the angle "${a.topic}"?`, body: 'Its three ideas leave this plan. Ideas you already sent stay in Ideas and Content.', ok: 'Remove angle', danger: true });
    if (!ok) return;
    const k = key(), id = src.id; S.busy = 'save'; render();
    try {
      let next;
      if (live()) next = (await window.Auth.brainApi('cf-angle-remove', { workspace_id: ws(), source: { kind: src.kind, id }, angle_id: a.id })).plan; else next = F().removeAngle(plan, a.id);
      if (k !== key()) return;
      S.plans[id] = next; [...S.picks].forEach((p) => { if (p.split(':')[1] === a.id) S.picks.delete(p); });
    } catch (e) { if (k === key()) U.toast(e.message || 'Could not remove the angle'); }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };

  /* ---------- remix to Ideas ---------- */
  ACT['cf-send'] = async () => {
    const src = find(S.sel); if (!src || S.busy || !S.picks.size) return; const plan = S.plans[src.id]; if (!plan) return;
    const picks = [...document.querySelectorAll('.cf-idea input:checked')].map((x) => ({ stage: x.dataset.stage, angle_id: x.dataset.angle, format: x.dataset.format })).filter((p) => F().findAngle(plan, p.stage, p.angle_id));
    if (!picks.length) { S.picks = new Set(); return syncBar(); }
    const k = key(); S.busy = 'send'; S.error = ''; render();
    try {
      let n = 0, by = null;
      if (live()) {
        const r = await window.Auth.brainApi('cf-ideas', { workspace_id: ws(), source: { kind: src.kind, id: src.id }, picks });
        if (k !== key()) return;
        window.OSBoard.inject && window.OSBoard.inject(r.rows || []); window.OSBoard.reset && window.OSBoard.reset(); n = (r.rows || []).length; by = r.by;
      } else {
        const c = ctxOf(src);
        for (const p of picks) { const a = F().findAngle(plan, p.stage, p.angle_id); await window.OSBoard.add(F().row(c, p.stage, a, p.format, F().expand(c, p.stage, a, p.format), 'Rules')); n++; }
      }
      S.picks = new Set();
      U.toast(n ? `${plural(n, 'idea')} in Ideas to approve${by && by !== 'Rules' ? ', written by ' + by : ''}` : 'Those ideas are already waiting in Ideas');
    } catch (e) { if (k === key()) S.error = e.message || 'The ideas could not be sent. Try again.'; }
    finally { if (k === key()) { S.busy = ''; render(); } }
  };
})();

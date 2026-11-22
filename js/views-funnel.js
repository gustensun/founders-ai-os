// Founders AI OS: Funnel Agent. One offer in, a live sales page out.
// New funnels start in AI Chat with Funnel Agent mode on: pick an offer, add context, say what you want.
// Build hands the brief to the agent, which runs every step on the server without stopping:
// research, offer, copy, brand kit, visuals, design, build and publish to your own GitHub and Vercel.
// The preview opens in its own tab. Ask for changes here or in the chat; every revision becomes a new version.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const F = window.OSFunnel, D = window.OSFunnelDemo;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const onView = () => location.hash.slice(1).split('?')[0] === 'funnel-agent';
  const conn = (p) => isLive() && (ctx().conns || []).some((c) => c.provider === p && c.status === 'connected');
  const aiOn = () => conn('claude') || conn('openai') || conn('perplexity');
  const ago = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso)) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : Math.round(d / 1440) + ' d ago'; };
  const took = (a, b) => { if (!a || !b) return ''; const s = Math.max(1, Math.round((new Date(b) - new Date(a)) / 1000)); return s < 60 ? s + 's' : Math.round(s / 60) + ' min'; };

  const STEPS = [
    ['intake', 'Questions', 'Your answers, prefilled from the offer and Brand DNA'],
    ['research', 'Market research', 'Competitors, prices, buyer words and angles'],
    ['offer', 'Final offer', 'Promise, mechanism, stack, price and guarantee'],
    ['copy', 'Sales copy', 'Every section, plus emails for HighLevel'],
    ['brand', 'Brand kit', 'Palette, Google Fonts and art direction'],
    ['visuals', 'Visuals', 'Hero, story and offer images'],
    ['design', 'Page design', 'Layout, hero and section order'],
    ['build', 'Build', 'One HTML page, checked for quality'],
    ['publish', 'Publish', 'Your GitHub repo and a live Vercel link'],
  ];
  Object.assign(VS, { faTab: VS.faTab || 'overview', faDev: VS.faDev || 'desktop' });
  const S = { rows: [], full: {}, at: 0, ws: null, loading: false, error: '', sel: null, intake: null, busy: {}, timer: null, lastTick: 0, demo: null };

  /* ---------- demo ---------- */
  function demoSeed() {
    if (S.demo) return; const b = D.build(); b.html = F.render(D.spec(b), { base: '' });
    b.links = { ...b.links, preview: '' }; S.demo = [b]; S.sel = S.sel || b.id;
  }
  const rows = () => (isLive() ? S.rows : S.demo || []);
  const full = (id) => (isLive() ? S.full[id] : (S.demo || []).find((b) => b.id === id));
  function demoRun(answers, title, engine) {
    const base = D.build(); const id = 'demo-fb-' + Date.now().toString(36);
    const b = { ...base, id, engine: ENG[engine] ? engine : 'os', title: title || base.title, status: 'running', step: 'research', version: 0, versions: [], revisions: [], html: null, qa: null, answers: { ...base.answers, ...answers }, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      steps: { intake: { state: 'done', at: new Date().toISOString(), done_at: new Date().toISOString(), note: 'Answers saved' } } };
    S.demo.unshift(b); S.sel = id; let i = 1;
    const next = () => {
      if (!S.demo.includes(b)) return; const k = STEPS[i][0]; const at = new Date().toISOString();
      b.steps[k] = { state: 'running', at }; b.step = k; paint();
      setTimeout(() => {
        b.steps[k] = { state: 'done', at, done_at: new Date().toISOString(), note: base.steps[k].note };
        if (k === 'build') { b.html = F.render(D.spec(b), { base: '' }); b.qa = base.qa; b.version = 1; b.versions = [{ v: 1, at: new Date().toISOString(), note: 'First build', by: b.engine === 'os' ? 'Funnel Agent' : ENG[b.engine] }]; if (b.engine !== 'os') b.steps.build.note = 'Version 1, hand-built by ' + ENG_MODEL[b.engine] + '.'; }
        i += 1; b.updated_at = new Date().toISOString();
        if (i < STEPS.length) next(); else { b.status = 'done'; b.step = 'done'; paint(); U.toast('Sample build finished. In your workspace it publishes to your GitHub and Vercel.'); }
        paint();
      }, k === 'copy' || k === 'research' ? 1500 : 900);
    };
    next(); return id;
  }
  function demoRevise(b, request) {
    b.revisions = [...(b.revisions || []), { at: new Date().toISOString(), request, state: 'queued' }]; b.status = 'running'; b.step = 'revise'; paint();
    setTimeout(() => { const v = (b.version || 0) + 1; b.revisions[b.revisions.length - 1] = { ...b.revisions[b.revisions.length - 1], state: 'done', v, summary: 'Sample workspace: in your workspace the agent rewrites the parts you named and publishes version ' + v + '.' }; b.version = v; b.versions = [...(b.versions || []), { v, at: new Date().toISOString(), note: 'Revision: ' + request.slice(0, 120), by: 'Funnel Agent' }]; b.status = 'done'; b.step = 'done'; paint(); U.toast('Version ' + v + ' is ready'); }, 1800);
  }

  /* ---------- live data ---------- */
  function load(force) {
    if (!isLive()) return; const ws = ctx().ws.id;
    if (S.loading || (!force && S.at && S.ws === ws && Date.now() - S.at < 30e3)) return;
    S.loading = true; if (S.ws !== ws) { S.rows = []; S.full = {}; S.sel = null; } S.ws = ws;
    window.Auth.funnel.list(ws).then((r) => { S.rows = r; S.error = ''; if (!S.sel && r[0]) S.sel = r[0].id; if (S.sel) return pull(S.sel); })
      .catch((e) => { S.error = /funnel_builds/.test(e.message || '') ? 'The Funnel Agent is being set up. Refresh in a minute.' : window.Auth.friendly(e); })
      .finally(() => { S.loading = false; S.at = Date.now(); if (onView()) window.App.render(true); watch(); });
  }
  async function pull(id) {
    try {
      const b = await window.Auth.funnel.get(id); S.full[id] = b;
      const i = S.rows.findIndex((r) => r.id === id); const lite = { id: b.id, title: b.title, offer_ref: b.offer_ref, status: b.status, step: b.step, version: b.version, links: b.links, repo: b.repo, deploy: b.deploy, error: b.error, created_at: b.created_at, updated_at: b.updated_at, offer_name: b.offer && b.offer.name };
      if (i === -1) S.rows.unshift(lite); else S.rows[i] = lite;
      return b;
    } catch (e) { console.error(e); return null; }
  }
  const running = (b) => b && (b.status === 'running' || b.status === 'queued');
  // While a build runs, read it every few seconds. Every 25 seconds also nudge the server, which resumes a run that stopped.
  function watch() {
    clearTimeout(S.timer); if (!isLive()) return;
    const live = S.rows.filter(running); if (!live.length) return;
    S.timer = setTimeout(async () => {
      if (!onView() && document.hidden) return watch();
      const ids = live.map((r) => r.id); const before = ids.map((id) => (S.full[id] || {}).version);
      await Promise.all(ids.map(pull));
      if (Date.now() - S.lastTick > 25e3) { S.lastTick = Date.now(); ids.forEach((id) => window.Auth.funnel.api('tick', { id }).catch(() => {})); }
      ids.forEach((id, i) => { const b = S.full[id]; if (b && b.status === 'done' && before[i] !== undefined) U.toast(`${b.title} is ready${b.deploy && b.deploy.url ? ' and live' : ''}`); });
      if (onView()) paint(); watch();
    }, 4000);
  }
  // Repaint without losing the revision text or the preview scroll.
  function paint() {
    if (!onView()) return; const ta = document.querySelector('[data-farev]'); const keep = ta ? ta.value : null;
    window.App.render(true); if (keep != null) { const n = document.querySelector('[data-farev]'); if (n) n.value = keep; }
  }

  /* ---------- pieces ---------- */
  const ENG = { os: 'Founders OS', claude: 'Claude', codex: 'Codex', gemini: 'Gemini' };
  const ENG_MODEL = { os: 'the OS page builder', claude: 'Claude Opus 5.5', codex: 'GPT-5.3 Codex', gemini: 'Gemini 4 Carbon' };
  const eng = (b) => (b && ENG[b.engine] ? b.engine : 'os');
  const statusPill = (b) => b.status === 'done' ? '<span class="pill pos">Live preview</span>' : b.status === 'failed' ? '<span class="pill neg">Stopped</span>' : `<span class="pill acc">${U.spin}${esc(stepName(b.step, b))}</span>`;
  const stepName = (k, b) => (k === 'build' && b && eng(b) !== 'os' ? ENG[eng(b)] + ' is building' : k === 'recraft' && b ? ENG[eng(b)] + ' is editing' : null) || ({ revise: 'Revising', recraft: 'Editing the code', images: 'Drawing new images', sync: 'Syncing from GitHub', done: 'Done' })[k] || (STEPS.find((s) => s[0] === k) || [k, k])[1];
  const builder = (b) => { const e = eng(b); const others = ['claude', 'codex', 'gemini', 'os'].filter((x) => x !== e); const off = running(b) || !b.version;
    return `<div class="fa-eng"><div class="fa-eng-now"><span class="meta">Builder</span><b>${esc(ENG[e])}</b><span class="meta">${e === 'os' ? 'Planned by your AI, coded by the OS' : 'Hand-coded by ' + esc(ENG_MODEL[e])}</span></div><div class="actions">${others.map((x) => `<button type="button" class="btn sm${x === 'os' ? ' ghost' : ''}" data-action="fa-rebuild" data-engine="${x}" data-id="${esc(b.id)}" ${off ? 'disabled' : ''}>${x === 'os' ? icon('refresh') : icon('sparkle')}Build with ${esc(ENG[x])}</button>`).join('')}</div></div>`; };
  function timeline(b) {
    const st = b.steps || {};
    return `<ol class="fa-steps">${STEPS.map(([k, name, what], i) => {
      const s = st[k] || {}; const cur = b.step === k && running(b);
      const state = s.state === 'done' && !cur ? 'done' : cur || s.state === 'running' ? (b.status === 'failed' ? 'failed' : 'run') : s.state === 'failed' ? 'failed' : 'todo';
      return `<li class="fa-step ${state}"><span class="fa-dot">${state === 'done' ? icon('check') : state === 'run' ? '<i></i>' : state === 'failed' ? '!' : i + 1}</span>
        <div><b>${esc(k === 'build' && eng(b) !== 'os' ? 'Build with ' + ENG[eng(b)] : name)}</b><span class="meta">${s.note ? esc(s.note) : state === 'run' ? (k === 'build' && eng(b) !== 'os' ? ENG_MODEL[eng(b)] + ' is writing the page code. This takes 3 to 5 minutes.' : 'Working on it') : esc(k === 'build' && eng(b) !== 'os' ? ENG_MODEL[eng(b)] + ' hand-codes the page' : what)}</span></div>${s.done_at ? `<span class="fa-took">${took(s.at, s.done_at)}</span>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  function links(b) {
    const out = [];
    if (b.deploy && b.deploy.url) out.push(`<a class="btn sm primary" href="${esc(b.deploy.url)}" target="_blank" rel="noopener">${icon('out')}Live page</a>`);
    if (b.deploy && b.deploy.external_url && b.deploy.external_url !== b.deploy.url) out.push(`<a class="btn sm" href="${esc(b.deploy.external_url)}" target="_blank" rel="noopener">${icon('out')}Latest from your AI</a>`);
    if (isLive() && b.links && b.links.preview && b.version) out.push(`<a class="btn sm${b.deploy && b.deploy.url ? '' : ' primary'}" href="${esc(b.links.preview)}" target="_blank" rel="noopener">${icon('out')}Open preview</a>`);
    if (!isLive() && b.html) out.push(`<button class="btn sm primary" data-action="fa-open">${icon('out')}Open preview</button>`);
    if (b.repo && b.repo.url) out.push(`<a class="btn sm" href="${esc(b.repo.url)}" target="_blank" rel="noopener">${icon('stack')}GitHub</a>`);
    return out.join('');
  }
  // The page opens in its own tab. Nothing is embedded here.
  function previewNote(b) {
    const ready = isLive() ? b.links && b.links.preview && b.version : b.html;
    return `<span class="meta fa-pv-note">${ready ? 'Opens in a new tab' + (running(b) ? '. Refresh it after this version finishes.' : '.') : running(b) ? 'The preview link appears when the build step is done.' : 'No page yet.'}</span>`;
  }
  function publishNote(b) {
    if (!isLive()) return '<p class="fa-note">In your workspace the page is pushed to a private GitHub repo and published on Vercel, both in your own accounts. Until then the preview link works on its own.</p>';
    const gh = conn('github'), vc = conn('vercel'); const errs = [b.repo && b.repo.error && 'GitHub: ' + b.repo.error, b.deploy && b.deploy.error && 'Vercel: ' + b.deploy.error].filter(Boolean);
    if (errs.length) return `<p class="fa-note warn">${esc(errs.join(' · '))} <button class="linkish" data-action="fa-publish" data-id="${esc(b.id)}">Publish again</button></p>`;
    if (gh && vc) return '';
    return `<p class="fa-note">Connect ${!gh && !vc ? 'GitHub and Vercel' : !gh ? 'GitHub' : 'Vercel'} in <a href="#connect">Connections</a> to publish to your own accounts. ${b.status === 'done' ? `<button class="linkish" data-action="fa-publish" data-id="${esc(b.id)}">Publish now</button>` : 'The agent publishes as soon as they are connected.'}</p>`;
  }
  const li = (xs) => (xs && xs.length ? `<ul class="fa-ul">${xs.map((x) => `<li>${esc(typeof x === 'string' ? x : x.name || x.title || JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="meta">Not ready yet</p>');
  function overview(b) {
    const r = b.research || {}; const o = b.offer || {}; const br = b.brand || {}; const pr = o.price || {}; const pal = br.palette || {};
    const total = F.stackTotal ? F.stackTotal(o) : 0;
    return `<div class="fa-cards">
      <section class="fa-card"><h3>Market research${r.method ? `<span class="meta">${esc({ perplexity: 'Perplexity, cited', web: 'Web search, cited', internal: 'Your own data' }[r.method] || '')}</span>` : ''}</h3>
        ${r.summary ? `<p>${esc(r.summary)}</p>` : '<p class="meta">Not ready yet</p>'}
        ${(r.angles || []).length ? `<h4>Angles</h4>${li(r.angles.slice(0, 4))}` : ''}
        ${(r.competitors || []).length ? `<h4>Competitors</h4><ul class="fa-ul">${r.competitors.slice(0, 5).map((c) => `<li><b>${esc(c.name)}</b>${c.price ? ' · ' + esc(c.price) : ''}${c.angle ? `<span class="meta"> ${esc(c.angle)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        ${(r.sources || []).length ? `<details class="fa-src"><summary>${r.sources.length} sources</summary>${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(String(s.title || s.url).slice(0, 90))}</a>`).join('')}</details>` : ''}</section>
      <section class="fa-card"><h3>Final offer</h3>
        ${o.name ? `<p class="fa-offer"><b>${esc(o.name)}</b>${pr.amount ? `<span>${esc(F.money(pr.amount, pr.currency))}${pr.compare_at ? ` <s>${esc(F.money(pr.compare_at, pr.currency))}</s>` : ''}</span>` : ''}</p><p>${esc(o.promise || o.one_liner || '')}</p>
        ${o.mechanism && o.mechanism.name ? `<h4>${esc(o.mechanism.name)}</h4><ol class="fa-ol">${(o.mechanism.steps || []).map((s) => `<li>${esc(s.name)}</li>`).join('')}</ol>` : ''}
        <h4>Stack${total ? ` · ${esc(F.money(total, pr.currency))} in value` : ''}</h4>${li((o.stack || []).map((x) => x.name + (x.value ? ' (' + F.money(x.value, pr.currency) + ')' : '')))}
        ${o.guarantee && o.guarantee.name ? `<p class="meta">${esc(o.guarantee.name)}${o.guarantee.days ? ', ' + o.guarantee.days + ' days' : ''}</p>` : ''}${o.changes ? `<p class="meta">${esc(o.changes)}</p>` : ''}` : '<p class="meta">Not ready yet</p>'}</section>
      <section class="fa-card"><h3>Brand kit</h3>
        ${pal.bg ? `<div class="fa-sw">${['bg', 'surface', 'ink', 'muted', 'accent', 'deep'].map((k) => `<span title="${k} ${esc(pal[k])}" style="background:${esc(pal[k])}"></span>`).join('')}</div>
        <p class="fa-fonts"><b>${esc((br.fonts || {}).display)}</b> for headlines, <b>${esc((br.fonts || {}).body)}</b> for text</p>${br.notes ? `<p class="meta">${esc(br.notes)}</p>` : ''}${(br.voice || []).length ? li(br.voice) : ''}` : '<p class="meta">Not ready yet</p>'}</section>
    </div>`;
  }
  function emails(b) {
    const es = b.emails || [];
    return es.length ? `<div class="fa-mails">${es.map((e, i) => `<details class="fa-mail" ${i === 0 ? 'open' : ''}><summary><span class="pill out">${esc(e.when)}</span><b>${esc(e.subject)}</b></summary><p>${esc(e.body).replace(/\n/g, '<br>')}</p><button class="btn sm ghost" data-action="fa-copy" data-what="email" data-i="${i}" data-id="${esc(b.id)}">${icon('copy')}Copy</button></details>`).join('')}</div>` : U.empty('No emails yet', 'They are written with the copy.');
  }
  function handoff(b) {
    const h = b.handoff || {}; const pr = (b.offer || {}).price || {}; const m = (v) => F.money(v, pr.currency || 'USD');
    if (!h.products) return U.empty('Not ready yet', 'The HighLevel setup is written with the copy.');
    return `<div class="fa-hl">
      <section><h4>Products to create</h4>${li((h.products || []).map((p) => `${p.name}: ${m(p.price)} (${p.type || 'one-time'})`))}</section>
      <section><h4>Order form</h4><p>${esc(h.order_form || '')}</p></section>
      ${h.bump ? `<section><h4>Order bump</h4><p><b>${esc(h.bump.name)}</b>, ${esc(m(h.bump.price))}. ${esc(h.bump.copy || '')}</p></section>` : ''}
      ${h.upsell ? `<section><h4>Upsell</h4><p><b>${esc(h.upsell.name)}</b>, ${esc(m(h.upsell.price))}${h.upsell.every ? ' ' + esc(h.upsell.every) : ''}. ${esc(h.upsell.copy || '')}</p></section>` : ''}
      <section><h4>Purchase workflow</h4><ol class="fa-ol">${(h.workflow || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
      <div class="actions"><button class="btn sm primary" data-action="hl-funnel" data-id="${esc(b.id)}" ${b.status === 'running' ? 'disabled' : ''}>${icon('upload')}Send to HighLevel</button>${b.links && b.links.hl && b.links.hl.at ? `<span class="meta">Sent ${esc(window.DNA.ago(b.links.hl.at))}</span>` : ''}<button class="btn sm" data-action="fa-copy" data-what="handoff" data-id="${esc(b.id)}">${icon('copy')}Copy the HighLevel setup</button><button class="btn sm ghost" data-action="fa-copy" data-what="html" data-id="${esc(b.id)}">${icon('copy')}Copy the page HTML</button></div>
      <p class="fa-note">To host it on HighLevel, import the GitHub repo into AI Studio, or paste the page HTML into a custom code element on a funnel step. Then point the buttons at your order form below.</p>
    </div>`;
  }
  function versions(b) {
    const vs = (b.versions || []).slice().reverse(); const rv = (b.revisions || []).slice().reverse();
    return `<div class="fa-vers">${vs.length ? `<ol class="fa-vlist">${vs.map((v) => `<li><span class="pill ${v.v === b.version ? 'acc' : 'out'}">v${v.v}</span><div><b>${esc(v.note || '')}</b><span class="meta">${esc(v.by || 'Funnel Agent')} · ${ago(v.at)}</span></div>${v.url ? `<a class="btn sm ghost" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('out')}</a>` : ''}</li>`).join('')}</ol>` : '<p class="meta">The first version appears after the build step.</p>'}
      ${rv.length ? `<h4>Revision requests</h4><ol class="fa-vlist">${rv.map((r) => `<li><span class="pill ${r.state === 'done' ? 'pos' : r.state === 'open' ? 'warn' : 'acc'}">${r.state === 'done' ? 'v' + r.v : r.state === 'open' ? 'For your AI' : 'Working'}</span><div><b>${esc(r.request)}</b>${r.summary ? `<span class="meta">${esc(r.summary)}</span>` : ''}</div></li>`).join('')}</ol>` : ''}</div>`;
  }
  // The 17P outline next to the preview: which of the founder's 17 Ps this page uses, where, and what is left out.
  function p17(b) {
    if (!b.copy || !F.outline) return U.empty('Not ready yet', 'The outline fills in when the sales copy is written.');
    const rows = F.outline({ brand: b.brand, design: b.design, offer: b.offer, copy: b.copy });
    const on = rows.filter((r) => r.on).length;
    const pv = isLive() ? (b.links && b.links.preview && b.version ? b.links.preview : '') : b.html ? 'demo' : '';
    const view = (r) => !r.on || !pv ? '' : pv === 'demo'
      ? `<button type="button" class="btn sm ghost" data-action="fa-open" data-anchor="${esc(r.anchor)}" aria-label="View ${esc(r.name)} in the preview">${icon('out')}View</button>`
      : `<a class="btn sm ghost" href="${esc(pv)}#${esc(r.anchor)}" target="_blank" rel="noopener" aria-label="View ${esc(r.name)} in the preview">${icon('out')}View</a>`;
    const add = (r) => r.on || running(b) ? '' : `<button type="button" class="btn sm ghost" data-action="fa-p17-add" data-n="${r.n}">${icon('plus')}Ask for it</button>`;
    return `<div class="fa-p17">
      <p class="fa-p17-sum"><b>${on} of 17</b><span class="meta">Not every P belongs on every page. The agent picks the ones that fit this offer and its price point. Ask for any that are missing.</span></p>
      <ol class="fa-p17-list">${rows.map((r) => `<li class="${r.on ? 'on' : 'off'}">
        <span class="fa-p17-n">${r.n}</span>
        <div class="fa-p17-t"><b>${esc(r.name)}</b><span class="meta">${esc(r.what)}</span></div>
        <div class="fa-p17-x">${r.on ? `<span class="fa-p17-sec">${esc(r.section)}</span><span>${esc(r.excerpt)}</span>` : `<span class="meta">${esc(r.why)}</span>`}</div>
        <div class="fa-p17-a">${view(r)}${add(r)}</div></li>`).join('')}</ol></div>`;
  }
  function agentPrompt(b) {
    const url = location.origin + '/mcp';
    return `You are the Funnel Agent working on a sales page that lives in Founders AI OS.

1. Connect to my Founders AI OS over MCP at ${url} with my access token from the AI access screen.
2. Call funnel_get with id ${b.id}. It returns the offer, research, copy, brand kit, design, emails, the HighLevel handoff, the current page HTML and any open revision requests.
3. ${b.repo && b.repo.full_name ? `Clone github.com/${b.repo.full_name}. index.html is the whole page, assets/ holds the images.` : 'Write the page as a single index.html with an assets/ folder.'}
4. Make the changes I ask for below, plus any open revision requests. Keep the brand kit, Google Fonts only, no em dashes, no exclamation points, no invented testimonials or numbers. Keep every conversion section.
5. ${b.repo && b.repo.full_name ? 'Commit and push to the repo.' : 'Push it to a new private GitHub repo and deploy it to Vercel.'}
6. Call funnel_update with id ${b.id}, the full new index.html, a one-line note of what changed and the live preview URL if you deployed one. The OS saves it as a new version${b.repo ? ' and publishes it again' : ''}.

My changes:
`;
  }
  function buildPanel(b) {
    const tabs = [['overview', 'Overview'], ['p17', '17P outline'], ['emails', 'Emails'], ['handoff', 'HighLevel'], ['versions', 'Versions' + (b.versions && b.versions.length ? ' ' + b.versions.length : '')], ['ai', 'Build with your AI']];
    const tab = VS.faTab;
    const body = tab === 'p17' ? p17(b) : tab === 'emails' ? emails(b) : tab === 'handoff' ? handoff(b) : tab === 'versions' ? versions(b) : tab === 'ai' ? `<div class="fa-ai"><p>Prefer to build in Claude Code, Codex or another agent? Copy this prompt. Your AI reads the build over MCP, edits the page in the GitHub repo and sends the new version back here.</p><pre>${esc(agentPrompt(b))}</pre><div class="actions"><button class="btn sm primary" data-action="fa-copy" data-what="prompt" data-id="${esc(b.id)}">${icon('copy')}Copy the prompt</button><a class="btn sm" href="#mcp">${icon('mcp')}AI access</a>${b.repo && b.repo.full_name ? `<button class="btn sm" data-action="fa-sync" data-id="${esc(b.id)}">${icon('refresh')}Sync from GitHub</button>` : ''}</div></div>` : overview(b);
    const qa = b.qa || {}; const qIssues = (qa.issues || []);
    const ck = (b.links || {}).checkout || (b.answers || {}).checkout_url || '';
    const completed = STEPS.filter(([k]) => b.steps?.[k]?.state === 'done').length;
    return `<section class="panel fa-main">
      <header class="fa-head"><div><h2>${esc(b.title)}</h2><p class="meta">${esc(b.offer && b.offer.name ? b.offer.name : 'Sales page')}${b.version ? ' · Version ' + b.version : ''}${eng(b) !== 'os' ? ' · Built with ' + esc(ENG[eng(b)]) : ''}</p></div><div class="actions">${statusPill(b)}</div></header>${window.BrainTools ? window.BrainTools.buildUsedIn(b) : ''}
      ${b.status === 'failed' ? `<div class="fa-fail"><b>The agent stopped at ${esc(stepName(b.step, b))}.</b><span>${esc(b.error || '')}</span><button class="btn sm primary" data-action="fa-retry" data-id="${esc(b.id)}">${icon('refresh')}Pick up where it stopped</button></div>` : ''}
      <div class="fa-split">
        <details class="fa-process" ${running(b) || b.status === 'failed' ? 'open' : ''}><summary><span>Build progress</span><span class="meta">${completed} of ${STEPS.length} steps complete</span>${icon('chevron')}</summary><div class="fa-process-body">${timeline(b)}${qa.words ? `<p class="fa-qa">${qa.ok ? icon('check') : icon('alert')}<span>${qa.words} words, ${qa.sections} sections, ${qa.ctas} buttons${qIssues.length ? '. ' + esc(qIssues.join('. ')) : ''}</span></p>` : ''}</div></details>
        <div class="fa-right">
          <div class="fa-bar"><div class="actions">${links(b)}</div>${previewNote(b)}</div>
          ${publishNote(b)}
          <form class="fa-rev" data-farevform data-id="${esc(b.id)}"><label for="fa-rev-${esc(b.id)}">Ask for changes</label>
            <textarea class="input" id="fa-rev-${esc(b.id)}" rows="3" data-farev placeholder="Shorter hero headline, move the guarantee above the story, warmer photos, add a 3-payment plan" ${running(b) ? 'disabled' : ''}></textarea>
            <div class="actions"><button class="btn primary sm" ${running(b) || S.busy.rev ? 'disabled' : ''}>${S.busy.rev ? U.spin + 'Sending' : icon('send') + 'Send revision'}</button><button type="button" class="btn sm" data-action="fa-images" data-id="${esc(b.id)}" ${running(b) ? 'disabled' : ''}>New images</button><span class="meta">${running(b) ? 'You can send changes when this run is done.' : eng(b) === 'os' ? 'Each revision becomes a new version and is published again.' : esc(ENG[eng(b)]) + ' edits its own code for each revision.'}</span></div></form>
          ${builder(b)}
          <form class="fa-ck" data-fackform data-id="${esc(b.id)}"><label for="fa-ck-${esc(b.id)}">HighLevel order form link</label><div class="fa-ckrow"><input class="input" id="fa-ck-${esc(b.id)}" type="url" placeholder="https://your-domain.com/order" value="${esc(ck)}" ${running(b) ? 'disabled' : ''}><button class="btn sm" ${running(b) ? 'disabled' : ''}>Save and republish</button></div></form>
        </div>
      </div>
      <div class="fa-tabs">${U.seg('faTab', tab, tabs)}</div>${body}
      <div class="actions fa-foot"><button class="btn sm ghost" data-action="fa-del" data-id="${esc(b.id)}">Delete build</button></div>
    </section>`;
  }
  function offersList() {
    const d = window.DNA ? window.DNA.data() : { items: [] }; const items = (d.items || []).filter((i) => i.kind === 'offer');
    const sorted = items.slice().sort((a, b) => (b.included - a.included) || ((+b.price || 0) - (+a.price || 0)));
    return sorted;
  }
  function startPanel(compact) {
    const offers = offersList().slice(0, compact ? 6 : 12);
    return `<section class="panel fa-start"><header><h2>${compact ? 'Build another sales page' : 'Pick an offer to turn into a sales page'}</h2></header>
      ${offers.length ? `<div class="fa-offers">${offers.map((o) => `<button class="fa-o" data-action="fa-chat" data-id="${esc(o.id)}"><b>${esc(o.name)}</b><span class="meta">${o.price ? esc(F.money(+o.price, o.currency || 'USD')) : 'No price yet'}${o.included ? '' : ' · not in DNA'}</span><span class="fa-o-go">${icon('sparkle')}Build sales page</span></button>`).join('')}</div>` : '<p class="meta">No offers yet. Add them in Offers, or sync them from HighLevel.</p>'}
      <form class="fa-fresh" data-fafresh><input class="input" name="name" maxlength="120" placeholder="Or name a new offer, for example: 30-Day Content Sprint"><button class="btn sm">${icon('plus')}Start</button></form></section>`;
  }
  function view() {
    const live = isLive(); if (live) load(); else demoSeed();
    const rs = rows(); const sel = S.sel && full(S.sel) ? full(S.sel) : null;
    const head = U.title('Funnel Agent', 'Plan a funnel for one of your offers in AI Chat. The agent builds it and you review the preview in a new tab.',
      `<button class="btn" data-action="vi-open">Vault inspiration</button><button class="btn primary" data-action="fa-pick">${icon('plus')}<span>New funnel</span></button>`);
    if (S.error) return head + `<section class="panel"><p class="auth-msg">${esc(S.error)}</p></section>`;
    if (live && S.loading && !S.at) return head + `<section class="panel">${U.empty('Loading your builds', 'One moment.')}</section>`;
    if (!rs.length) return head + startPanel(false);
    const list = `<aside class="fa-list" aria-label="Builds"><h2 class="workspace-list-title">Your pages</h2>${rs.map((r) => `<button class="fa-li${r.id === S.sel ? ' on' : ''}" data-action="fa-sel" data-id="${esc(r.id)}" aria-pressed="${r.id === S.sel}"><b>${esc(r.title)}</b><span class="meta">${r.version ? 'v' + r.version + ' · ' : ''}${esc(ago(r.updated_at))}</span>${statusPill(r)}</button>`).join('')}</aside>`;
    const main = sel ? buildPanel(sel) : `<section class="panel">${U.empty('Loading the build', 'One moment.')}</section>`;
    return head + `<div class="fa-layout">${list}<div class="fa-col">${main}</div></div>`;
  }
  V['funnel-agent'] = view; V['funnel-agent'].live = view;

  /* ---------- actions ---------- */
  ACT['fa-sel'] = async (el) => { S.sel = el.dataset.id; S.pick = false; if (isLive() && !S.full[S.sel]) { window.App.render(true); await pull(S.sel); } window.App.render(true); watch(); };
  // New funnels start in AI Chat with Funnel Agent mode on.
  const chat = (opts) => window.ChatFunnel ? window.ChatFunnel.open(opts || {}) : (location.hash = 'chat');
  ACT['fa-pick'] = () => chat({});
  ACT['fa-chat'] = (el) => chat({ offerId: el.dataset.id });
  // Other screens can send an offer here, for example the Vault with a saved reference.
  V['funnel-agent'].start = (offerId, extra = {}) => chat({ offerId, name: extra.name, context: extra.context || '', inspiration_ids: extra.inspiration_ids || [], inspiration_title: extra.inspiration_title || '' });
  ACT['fa-open'] = (el) => { const b = full(S.sel); if (!b || !b.html) return; const w = window.open('', '_blank'); if (!w) return; w.document.open(); w.document.write(b.html); w.document.close();
    const a = el && el.dataset && el.dataset.anchor; if (a) setTimeout(() => { const t = w.document.getElementById(a); if (t) t.scrollIntoView({ block: 'start' }); }, 250); };
  // Fills the change request with the missing P. Nothing is sent until the founder presses Send revision.
  ACT['fa-p17-add'] = (el) => { const b = full(S.sel); if (!b || !F.outline) return; const r = F.outline({ design: b.design, offer: b.offer, copy: b.copy })[(+el.dataset.n || 1) - 1]; const ta = document.querySelector('[data-farev]'); if (!r || !ta) return;
    const line = `Add the ${r.name} section (${r.what.toLowerCase()}), using only real facts.`; ta.value = ta.value.trim() ? ta.value.trim() + '\n' + line : line; ta.focus(); ta.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  ACT['fa-copy'] = (el) => {
    const b = full(el.dataset.id); if (!b) return; const w = el.dataset.what;
    if (w === 'prompt') return U.copy(agentPrompt(b));
    if (w === 'html') return b.html ? U.copy(b.html) : U.toast('The page is not built yet');
    if (w === 'email') { const e = (b.emails || [])[+el.dataset.i]; return e && U.copy(`Subject: ${e.subject}\n\n${e.body}`); }
    if (w === 'handoff') { const h = b.handoff || {}; const pr = (b.offer || {}).price || {}; const m = (v) => F.money(v, pr.currency || 'USD'); return U.copy([`HighLevel setup for ${(b.offer || {}).name || b.title}`, '', 'Products:', ...(h.products || []).map((p) => `- ${p.name}: ${m(p.price)} (${p.type || 'one-time'})`), '', 'Order form: ' + (h.order_form || ''), h.bump ? `Order bump: ${h.bump.name}, ${m(h.bump.price)}. ${h.bump.copy || ''}` : '', h.upsell ? `Upsell: ${h.upsell.name}, ${m(h.upsell.price)}${h.upsell.every ? ' ' + h.upsell.every : ''}. ${h.upsell.copy || ''}` : '', '', 'Workflow:', ...(h.workflow || []).map((x, i) => `${i + 1}. ${x}`), '', 'Emails:', ...(b.emails || []).map((e) => `\n[${e.when}] ${e.subject}\n${e.body}`)].join('\n')); }
  };
  const call = async (action, id, extra, msg) => {
    const b = full(id); if (!b) return;
    if (!isLive()) return U.toast('In your workspace this runs on the server and publishes the new version.');
    try { await window.Auth.funnel.api(action, { id, ...(extra || {}) }); U.toast(msg); await pull(id); } catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render(true); watch();
  };
  ACT['fa-retry'] = (el) => call('retry', el.dataset.id, null, 'Picking up where it stopped');
  ACT['fa-publish'] = (el) => call('publish', el.dataset.id, null, 'Publishing to your accounts');
  ACT['fa-images'] = (el) => call('images', el.dataset.id, null, 'Drawing new images. The page republishes on its own.');
  ACT['fa-rebuild'] = (el) => {
    const e = el.dataset.engine; const b = full(el.dataset.id); if (!b || !ENG[e]) return;
    if (isLive()) return call('rebuild', b.id, { engine: e }, e === 'os' ? 'Rebuilding with the OS builder' : ENG[e] + ' is building the page. It publishes when done, usually in 3 to 5 minutes.');
    b.engine = e; b.status = 'running'; b.step = 'build'; const at = new Date().toISOString(); b.steps = { ...b.steps, build: { state: 'running', at } }; window.App.render(true);
    setTimeout(() => { const v = (b.version || 0) + 1; b.version = v; b.versions = [...(b.versions || []), { v, at: new Date().toISOString(), note: 'Rebuilt with ' + ENG[e], by: e === 'os' ? 'Funnel Agent' : ENG[e] }];
      b.steps.build = { state: 'done', at, done_at: new Date().toISOString(), note: `Version ${v}, ${e === 'os' ? 'built by the OS page builder' : 'hand-built by ' + ENG_MODEL[e]}.` }; b.status = 'done'; b.step = 'done'; b.updated_at = new Date().toISOString();
      if (S.sel === b.id) window.App.render(true); U.toast('Sample rebuild finished. In your workspace ' + ENG[e] + ' writes the full page code and it publishes again.'); }, 2200);
  };
  ACT['fa-sync'] = (el) => call('sync', el.dataset.id, null, 'Reading the latest page from GitHub');
  ACT['fa-del'] = async (el) => {
    const b = full(el.dataset.id) || rows().find((r) => r.id === el.dataset.id); if (!b) return;
    const ok = await U.dialog({ title: 'Delete this build?', body: 'The build, its versions and images leave the OS. Your GitHub repo and Vercel project stay in your accounts.', ok: 'Delete', danger: true }); if (!ok) return;
    try { if (isLive()) { await window.Auth.funnel.remove(b.id); S.rows = S.rows.filter((r) => r.id !== b.id); delete S.full[b.id]; } else S.demo = S.demo.filter((r) => r.id !== b.id); }
    catch (e) { return U.toast(window.Auth.friendly(e)); }
    S.sel = (rows()[0] || {}).id || null; if (S.sel && isLive()) await pull(S.sel); U.toast('Deleted'); window.App.render(true);
  };

  document.addEventListener('submit', async (e) => {
    const f = e.target; if (!f.matches) return;
    if (f.matches('[data-fafresh]')) { e.preventDefault(); const n = f.elements.name.value.trim(); if (!n) return f.elements.name.focus(); return chat({ name: n }); }
    if (f.matches('[data-farevform]')) {
      e.preventDefault(); const id = f.dataset.id; const ta = f.querySelector('[data-farev]'); const request = ta.value.trim(); if (!request) return ta.focus();
      const b = full(id); if (!b) return;
      if (!isLive()) {
        ta.value = ''; demoRevise(b, request);
        return;
      }
      S.busy.rev = true; paint();
      try { await window.Auth.funnel.api('revise', { id, request }); ta.value = ''; U.toast('Revising. The new version publishes on its own.'); await pull(id); }
      catch (ex) { U.toast(window.Auth.friendly(ex)); }
      S.busy.rev = false; const n = document.querySelector('[data-farev]'); if (n) n.value = ''; window.App.render(true); watch(); return;
    }
    if (f.matches('[data-fackform]')) {
      e.preventDefault(); const url = f.querySelector('input').value.trim();
      if (url && !/^https:\/\//.test(url)) return U.toast('Paste the full link, starting with https://');
      if (!isLive()) { const b = full(f.dataset.id); b.links = { ...(b.links || {}), checkout: url }; b.html = F.render({ ...D.spec(b), links: b.links }, { base: '' }); paint(); return U.toast(url ? 'Buttons now go to your order form' : 'Buttons scroll to the offer'); }
      return call('checkout', f.dataset.id, { url }, url ? 'Buttons now go to your order form. Publishing.' : 'Checkout link removed');
    }
  });

  window.OSFunnelView = { reset: () => { S.at = 0; }, start: (id, extra) => V['funnel-agent'].start(id, extra), rows, offers: offersList,
    full: (id) => { if (!isLive()) demoSeed(); return full(id); },
    demoStart: (answers, title, engine) => { demoSeed(); return demoRun(answers, title, engine); },
    demoRevise: (id, request) => { const b = full(id); if (b) demoRevise(b, request); },
    select: (id) => { S.sel = id; S.at = 0; } };
})();

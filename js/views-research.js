// Founders AI OS: Research through the founder's own Apify account.
// Competitor channels, outlier videos, comments with buying intent, Instagram, TikTok and Google results.
// Good finds become ideas on the Content board (demo) or ideas in Memory (private workspace).
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const render = () => window.App.render(true);
  const CONSOLE = 'https://console.apify.com/settings/integrations';

  // mirrors api/apify.js presets
  const PRESETS = [
    ['yt-channels', 'Competitor channels', 'Latest videos from channels you watch, ranked by how far each beats that channel\u2019s median.', 'Channel URLs, one per line', 'https://www.youtube.com/@channel', 'Latest videos per channel', 20, 50],
    ['yt-search', 'YouTube search', 'What is winning this month for a topic, ranked by views and outlier score.', 'Search terms, one per line', 'highlevel ai studio', 'Videos per term', 20, 50],
    ['yt-comments', 'YouTube comments', 'Comments on any video, with buying-intent questions pulled to the top.', 'Video URLs, one per line', 'https://www.youtube.com/watch?v=', 'Comments per video', 100, 500],
    ['ig-profiles', 'Instagram', 'Recent posts from profiles, ranked against each profile\u2019s median.', 'Profile URLs or @handles', '@handle', 'Posts per profile', 12, 50],
    ['tt-profiles', 'TikTok', 'Recent videos from creators, ranked by plays against their median.', 'Usernames, one per line', '@username', 'Videos per profile', 20, 50],
    ['x-search', 'X search', 'Top posts on X for a topic or from @handles, ranked by reactions against each author\u2019s median.', 'Search terms or @handles, one per line', 'solopreneur', 'Posts per term', 50, 200],
    ['google', 'Google', 'Organic results for offer, competitor and keyword research.', 'Search queries, one per line', 'funnel builder for clinics', 'Results per query', 10, 50],
    ['custom', 'Any actor', 'Run any actor from the Apify Store with your own input.', 'Actor ID', 'apify/website-content-crawler', '', 0, 0],
  ];
  const P = (id) => PRESETS.find((p) => p[0] === id) || PRESETS[0];
  VS.rsPreset = VS.rsPreset || 'yt-channels';

  /* ---------- demo data ---------- */
  const DEMO_CH = ['Funnel Lab', 'Solo Systems', 'Agency Unfiltered', 'Build With AI Daily'];
  const DEMO_TITLES = [
    ['I replaced my agency stack with HighLevel AI Studio', 412000, 'Funnel Lab'], ['The $27 offer that pays for my ads', 188000, 'Solo Systems'], ['Claude built my client portal in 40 minutes', 356000, 'Build With AI Daily'],
    ['Why most funnel builders stay broke', 96000, 'Agency Unfiltered'], ['My weekly content system as a one-person business', 61000, 'Solo Systems'], ['HighLevel vs Kajabi for course creators', 74000, 'Funnel Lab'],
    ['Selling software to dentists, a full breakdown', 142000, 'Agency Unfiltered'], ['Vibe coding a booking app live', 48000, 'Build With AI Daily'], ['How I price done-for-you funnels', 52000, 'Agency Unfiltered'],
    ['Five automations every coach needs', 39000, 'Funnel Lab'], ['The email I send after every sales call', 33000, 'Solo Systems'], ['AI receptionist for a physio clinic', 58000, 'Build With AI Daily'],
  ];
  const DEMO_COMMENTS = [
    ['How much would you charge to build this for my clinic?', '@drmaria', 14, 'buying'], ['Is there a template for the follow-up email?', '@coachben', 22, 'buying'], ['Can you do a video on the affiliate side of HighLevel?', '@sami.k', 31, null],
    ['Where can I get the App Builder Kit you mentioned?', '@jonas_builds', 9, 'buying'], ['This saved me a week of setup, thank you', '@lena.fit', 41, null], ['Do you offer done for you setup for agencies?', '@agencyowner', 6, 'buying'],
    ['Would love a deep dive on pricing software for vets', '@petclinicpro', 18, null], ['The part at 7:40 is gold', '@tom.r', 12, null],
  ];
  function demoItems(preset) {
    if (preset === 'yt-comments') return DEMO_COMMENTS.map(([t, a, l, i]) => ({ title: t, author: a, likes: l, url: 'https://www.youtube.com/', ...(i ? { intent: i } : {}), extra: 'I built a full SaaS inside HighLevel AI Studio in one day' }));
    if (preset === 'x-search') return [['Most people do not need more ideas. They need fewer, finished.', 'thejustinwelsh', 4210], ['Your offer is confusing if you need a call to explain it.', 'SahilBloom', 2890], ['Write the post you wish someone had sent you five years ago.', 'thedankoe', 6120], ['I post once a day and work 4 hours. This is the whole system.', 'thejustinwelsh', 1180], ['You do not need a niche. You need a point of view.', 'thedankoe', 1540], ['The 3 numbers I check every Monday morning.', 'SahilBloom', 760]]
      .map(([t, a, v], i) => ({ title: t, author: a, views: v, likes: Math.round(v * 0.82), comments: Math.round(v * 0.1), date: '2026-11-0' + (8 - i), url: 'https://x.com/' + a, outlier: [3.6, 2.9, 4.1, 1.0, 1.1, 0.8][i], extra: Math.round(v * 70) + ' views on X' }));
    if (preset === 'google') return ['Funnel builder for clinics | Templates and pricing', 'Best patient booking funnels in 2026', 'How clinics get more bookings online', 'HighLevel for healthcare, a review', 'Clinic marketing agencies compared'].map((t, i) => ({ title: t, url: 'https://example.com/' + i, author: ['agencyreview.example', 'clinicgrowth.example', 'medmarketing.example', 'saasreviews.example', 'agencylist.example'][i], extra: 'Organic result ' + (i + 1) }));
    const med = {}; DEMO_CH.forEach((c) => { const v = DEMO_TITLES.filter((x) => x[2] === c).map((x) => x[1]).sort((a, b) => a - b); med[c] = v[v.length >> 1]; });
    return DEMO_TITLES.map(([t, v, c], i) => ({ title: t, author: c, views: v, likes: Math.round(v * 0.04), comments: Math.round(v * 0.003), date: '2026-10-' + String(28 - i * 2 > 0 ? 28 - i * 2 : 1).padStart(2, '0'), url: 'https://www.youtube.com/', outlier: Math.round((v / med[c]) * 10) / 10 })).sort((a, b) => b.outlier - a.outlier);
  }
  let DEMO = null;
  const demoRuns = () => (DEMO = DEMO || [
    { id: 'rs1', preset: 'yt-channels', label: 'Competitor channels: 4 channels', status: 'succeeded', items: demoItems('yt-channels'), item_count: 48, cost_usd: 0.19, created_at: '2026-11-04T02:00:00Z' },
    { id: 'rs2', preset: 'yt-comments', label: 'YouTube comments: your AI Studio video', status: 'succeeded', items: demoItems('yt-comments'), item_count: 312, cost_usd: 0.08, created_at: '2026-11-03T21:10:00Z' },
    { id: 'rs3', preset: 'google', label: 'Google: funnel builder for clinics', status: 'succeeded', items: demoItems('google'), item_count: 10, cost_usd: 0.03, created_at: '2026-11-02T09:30:00Z' },
  ]);

  /* ---------- live state ---------- */
  const R = { ws: null, rows: [], loading: false, error: '' };
  function liveRuns() {
    const w = ctx().ws; if (!w || !w.id) return [];
    if (R.ws !== w.id && !R.loading) {
      R.loading = true; R.error = '';
      Auth.research.list(w.id).then((r) => { R.rows = r; }).catch((e) => { R.error = Auth.friendly(e); R.rows = []; }).finally(() => { R.ws = w.id; R.loading = false; schedule(); if (VS.view === 'research') render(); });
    }
    return R.ws === w.id ? R.rows : [];
  }
  const runs = () => (isLive() ? liveRuns() : demoRuns());
  const conn = () => (isLive() ? (ctx().conns || []).find((c) => c.provider === 'apify' && c.status === 'connected') || null : { account_label: 'northpeak · Personal', meta: { username: 'northpeak', plan: 'Personal', usage_usd: 11.4, limit_usd: 49 } });
  const pending = (r) => r.status === 'starting' || r.status === 'running';

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    if (!isLive() || !R.rows.some(pending)) return;
    timer = setTimeout(async () => {
      const w = ctx().ws; let changed = false;
      for (const r of R.rows.filter(pending)) {
        try { const out = await Auth.apify('poll', { workspace_id: w.id, id: r.id }); Object.assign(r, out.run); if (!pending(out.run)) { changed = true; if (out.run.status === 'succeeded') U.toast(out.run.label + ' finished with ' + (out.run.items || []).length + ' results'); else U.toast(out.run.label + ' stopped: ' + (out.run.error || out.run.status)); } }
        catch (e) { r.status = 'failed'; r.error = e.message; changed = true; if (await stale(e)) break; }
      }
      if (VS.view === 'research') render(); else if (changed) { /* results wait on the page */ }
      schedule();
    }, 4000);
  }

  /* ---------- page ---------- */
  const fmtN = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));
  const when = (iso) => { if (!iso) return ''; const d = (Date.now() - Date.parse(iso)) / 6e4; if (!isLive()) return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); if (d < 2) return 'Just now'; if (d < 60) return Math.round(d) + ' min ago'; if (d < 1440) return Math.round(d / 60) + ' h ago'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const pill = (r) => r.status === 'succeeded' ? `<span class="pill pos">${(r.items || []).length} results</span>` : pending(r) ? `<span class="pill acc">${U.spin}Running</span>` : `<span class="pill neg">${r.status === 'timed_out' ? 'Timed out' : r.status === 'aborted' ? 'Stopped' : 'Failed'}</span>`;
  VS.rsSaved = VS.rsSaved || {};

  V.research = () => {
    const live = isLive(), c = conn(), list = runs();
    const sel = list.find((r) => r.id === VS.rsRun) || list.find((r) => r.status === 'succeeded') || list[0];
    const p = P(VS.rsPreset);
    const done = list.filter((r) => r.status === 'succeeded');
    const outl = done.reduce((s, r) => s + (r.items || []).filter((x) => x.outlier >= 2).length, 0);
    const intentN = done.reduce((s, r) => s + (r.items || []).filter((x) => x.intent).length, 0);
    const spend = list.reduce((s, r) => s + (+r.cost_usd || 0), 0);
    const m = (c && c.meta) || {};
    const form = `<form data-form="research" autocomplete="off" class="rs-form">
        <p class="muted">${esc(p[2])}</p>
        ${p[0] === 'custom' ? `<label class="field"><span>Actor ID</span><input name="actor" required placeholder="apify/website-content-crawler"></label><label class="field"><span>Input JSON</span><textarea name="json" rows="5" class="mono" placeholder='{ "startUrls": [{ "url": "https://example.com" }] }'></textarea></label>`
        : `<label class="field"><span>${esc(p[3])}</span><textarea name="targets" rows="3" required placeholder="${esc(p[4])}"></textarea></label>
        <label class="field rs-limit"><span>${esc(p[5])}</span><input name="limit" type="number" min="1" max="${p[7]}" value="${p[6]}"></label>`}
        <div class="actions"><button class="btn primary" type="submit">${c ? 'Run on Apify' : staleRow() ? 'Reconnect Apify to run' : 'Connect Apify to run'}</button><span class="meta">${live ? 'Runs on your Apify credit. Capped at a few hundred results per run.' : 'Demo runs return sample results.'}</span></div>
      </form>`;
    const results = !sel ? U.empty('No runs yet', c ? 'Pick a research type above and run it. Results land here and can become ideas.' : staleRow() ? 'Apify needs a new token before research can run.' : 'Connect Apify, then run your first research.', c ? '' : `<button class="btn primary" data-action="apify-open">${staleRow() ? 'Reconnect Apify' : 'Connect Apify'}</button>`)
      : pending(sel) ? `<div class="empty"><b>${U.spin}${esc(sel.label)}</b><p class="muted">Apify is gathering results. Most runs finish in one to three minutes. You can leave this page.</p></div>`
      : sel.status !== 'succeeded' ? U.empty('This run did not finish', esc(sel.error || 'Apify stopped the run. Check the input and your Apify credit, then run it again.'))
      : resultsTable(sel);
    return `${U.title('Research', 'Competitor channels, outlier videos, comments with buying intent and search results, gathered through your own Apify account. Save the good finds as ideas.', `<button class="btn" data-action="apify-open">${icon('connect')}${c ? 'Apify account' : staleRow() ? 'Reconnect Apify' : 'Connect Apify'}</button>`)}
    ${U.kpis([{ label: 'Apify', value: c ? 'Connected' : 'Not connected', delta: c ? esc(m.username || c.account_label || '') + (live ? '' : ', sample') : 'Add your API token' }, { label: 'Outliers found', value: String(outl), delta: '2x or more over the median' }, { label: 'Buying-intent comments', value: String(intentN), delta: 'Price, setup or done-for-you questions' }, { label: 'Spend on these runs', value: '$' + spend.toFixed(2), delta: m.usage_usd != null ? '$' + (+m.usage_usd).toFixed(2) + ' of $' + (+m.limit_usd || 0).toFixed(0) + ' this month' : 'From Apify' }])}
    <div class="layout" style="margin-top:var(--gap)"><div class="stack">
      <section class="panel"><header><h2>New run</h2></header><div class="rs-seg">${U.seg('rsPreset', VS.rsPreset, PRESETS.map((x) => [x[0], x[1]]))}</div>${form}</section>
      <section class="panel" id="rs-results"><header><h2>${sel ? esc(sel.label) : 'Results'}</h2>${sel && sel.status === 'succeeded' ? `<span class="meta">${(sel.items || []).length} shown of ${sel.item_count || (sel.items || []).length} \u00b7 ${when(sel.created_at)}</span>` : ''}</header>${results}</section>
    </div>
    <aside class="rail">
      <h2 class="out">Runs</h2>
      <section class="panel tight">${R.loading && live && !list.length ? `<p class="meta">${U.spin}Loading runs</p>` : list.length ? `<div class="rows">${list.map((r) => `<div class="row click ${sel && r.id === sel.id ? 'on' : ''}" data-action="rs-pick" data-id="${r.id}"><div class="grow"><div class="t">${esc(r.label)}</div><div class="s">${when(r.created_at)}${r.cost_usd != null ? ' \u00b7 $' + (+r.cost_usd).toFixed(2) : ''}</div></div>${pill(r)}</div>`).join('')}</div>` : '<p class="muted">Nothing run yet.</p>'}</section>
      <h2 class="out">Where it goes</h2>
      <section class="panel tight"><ul class="plain-list"><li>Outliers feed Nightly Ideation and the Content board.</li><li>Buying-intent comments become warm leads for Follow-Up Drafter.</li><li>Your Apify token is encrypted on the server and never sent back to the browser.</li></ul></section>
    </aside></div>`;
  };
  V.research.live = () => V.research();
  window.OSResearch = { demoRuns, presets: PRESETS };

  function resultsTable(r) {
    const items = r.items || []; if (!items.length) return U.empty('No results', 'The run finished but returned nothing. Check the URLs or terms.');
    const yt = /yt-|ig-|tt-|x-/.test(r.preset) && r.preset !== 'yt-comments'; const xs = r.preset === 'x-search';
    return `<div class="rows rs-rows">${items.slice(0, 60).map((x, i) => {
      const key = r.id + ':' + i; const saved = VS.rsSaved[key];
      const meta = [x.author, x.views != null ? fmtN(x.views) + (xs ? ' reactions' : ' views') : null, x.likes != null ? fmtN(x.likes) + ' likes' : null, x.date ? String(x.date).slice(0, 10) : null, r.preset === 'yt-comments' && x.extra ? 'on ' + x.extra : (r.preset === 'google' || xs) && x.extra ? x.extra : null].filter(Boolean).map(esc).join(' \u00b7 ');
      return `<div class="row tl"><div class="grow"><div class="wrap">${x.url ? `<a class="lnk" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title || x.url)}</a>` : esc(x.title)}</div><div class="s wrap">${meta}</div></div>
        ${yt && x.outlier ? `<span class="pill ${x.outlier >= 2 ? 'acc' : 'out'} num">${x.outlier}x</span>` : ''}${x.intent ? '<span class="pill acc">Buying intent</span>' : ''}
        <button class="btn sm ${saved ? '' : 'ghost'}" data-action="rs-save" data-run="${r.id}" data-i="${i}" ${saved ? 'disabled' : ''}>${saved ? 'Saved' : r.preset === 'yt-comments' ? 'Save to Memory' : 'Save idea'}</button></div>`;
    }).join('')}</div>`;
  }

  /* ---------- actions ---------- */
  ACT['rs-pick'] = (el) => { VS.rsRun = el.dataset.id; render(); const res = U.$('#rs-results'); if (res && window.innerWidth < 900) res.scrollIntoView({ block: 'start' }); };
  ACT['rs-save'] = async (el) => {
    const r = runs().find((x) => x.id === el.dataset.run); const x = r && (r.items || [])[+el.dataset.i]; if (!x) return;
    const key = r.id + ':' + el.dataset.i; const comment = r.preset === 'yt-comments';
    const why = x.outlier ? `${x.outlier}x the median on ${x.author}, found by Apify research.` : comment ? `Comment by ${x.author || 'a viewer'}${x.extra ? ' on "' + x.extra + '"' : ''}.` : 'Found by Apify research.';
    try {
      if (isLive()) {
        await Auth.memory.add(ctx().ws.id, { kind: comment ? 'note' : 'idea', text: comment ? `${x.author || 'Viewer'} asked: ${x.title}` : x.title, meta: { source: 'Apify, ' + P(r.preset)[1], url: x.url || null, why, outlier: x.outlier || null, intent: x.intent || null } });
        window.OSMemory && window.OSMemory.reset && window.OSMemory.reset();
      } else if (comment) {
        U.toast('Saved to Memory'); VS.rsSaved[key] = true; return render();
      } else St.A.addIdea({ title: x.title, why, sources: ['OUTLIER'], score: Math.min(9.6, 7 + (x.outlier || 1) * 0.3) });
      VS.rsSaved[key] = true; U.toast(comment ? 'Saved to Memory' : isLive() ? 'Saved as an idea in Memory' : 'Added to the Content board'); render();
    } catch (e) { U.toast(Auth.friendly(e)); }
  };

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form="research"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (!conn()) return ACT['apify-open']();
    const fields = Object.fromEntries(new FormData(f).entries());
    const p = P(VS.rsPreset); const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.innerHTML = U.spin + 'Starting';
    if (!isLive()) {
      const t = String(fields.targets || fields.actor || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
      const run = { id: 'rs' + Date.now(), preset: p[0], label: p[1] + ': ' + (t.slice(0, 2).join(', ').replace(/https?:\/\/(www\.)?/g, '') || 'sample'), status: 'running', items: [], created_at: new Date().toISOString(), cost_usd: null };
      demoRuns().unshift(run); VS.rsRun = run.id; render();
      setTimeout(() => { const items = p[0] === 'custom' ? demoItems('google') : demoItems(p[0] === 'yt-search' || p[0] === 'ig-profiles' || p[0] === 'tt-profiles' ? 'yt-channels' : p[0]); Object.assign(run, { status: 'succeeded', items, item_count: items.length, cost_usd: 0.05 }); St.log && St.log('Ran research', run.label, 'research'); if (VS.view === 'research') render(); U.toast('Sample run finished. Connect Apify in a private workspace for real results.'); }, 1800);
      return;
    }
    try { const out = await Auth.apify('run', { workspace_id: ctx().ws.id, preset: p[0], fields }); R.rows.unshift(out.run); VS.rsRun = out.run.id; U.toast('Run started on Apify'); schedule(); }
    catch (err) { if (!(await stale(err))) U.toast(err.message); }
    render();
  }, true);

  /* ---------- connect drawer ---------- */
  // The saved token stopped working on Apify's side: say it once, refresh the connection state and open the token step.
  const staleRow = () => (isLive() ? (ctx().conns || []).find((x) => x.provider === 'apify' && x.status === 'error') || null : null);
  let staleBusy = null;
  async function stale(e) {
    if (!e || e.reconnect !== 'apify') return false;
    if (!staleBusy) staleBusy = (async () => { try { await window.App.reloadConns(); } catch (x) { /* the drawer still opens */ } U.toast(e.message); ACT['apify-open'](); render(); if (VS.view !== 'research' && window.App.render) window.App.render(); })().finally(() => { setTimeout(() => { staleBusy = null; }, 1500); });
    await staleBusy; return true;
  }
  window.ApifyConn = { stale, staleRow };
  ACT['apify-open'] = () => {
    const live = isLive(), c = conn(), m = (c && c.meta) || {}; const old = !c && staleRow();
    const usage = m.usage_usd != null && m.limit_usd ? `<div class="dsec"><h3>This month</h3><div class="meter"><span style="width:${Math.min(100, (m.usage_usd / m.limit_usd) * 100).toFixed(1)}%"></span></div><p class="meta" style="margin-top:6px">$${(+m.usage_usd).toFixed(2)} of $${(+m.limit_usd).toFixed(0)} usage limit</p></div>` : '';
    const body = !live ? `<div class="dsec"><p>The demo shows a sample Apify account. In your private workspace, paste your own Apify API token and research runs on your account and credit.</p></div>${usage}<div class="actions"><button class="btn primary" data-action="rs-go">Open Research</button></div>`
      : c ? `<div class="dsec"><h3>Account</h3><p>${esc(m.username || c.account_label)}${m.plan ? ' <span class="pill out">' + esc(m.plan) + '</span>' : ''}</p><p class="meta">Connected ${c.connected_at ? new Date(c.connected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}. The token is encrypted on the server.</p></div>${usage}
        <div class="actions"><button class="btn primary" data-action="rs-go">Open Research</button><button class="btn" data-action="apify-refresh">Refresh usage</button><button class="btn ghost" data-action="apify-disconnect">Disconnect</button></div>`
      : `${old ? `<div class="dsec"><h3>Your saved token stopped working</h3><p>Apify no longer accepts the token saved${old.connected_at ? ' on ' + new Date(old.connected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}. That happens when a token is deleted, regenerated or expires in Apify. Your creators, their posts and past research are all still here.</p></div>` : ''}<div class="dsec"><h3>${old ? 'Paste a new token' : 'Connect in a minute'}</h3><ol class="steps"><li>Open <a class="lnk" href="${CONSOLE}" target="_blank" rel="noopener">Apify Console, Settings, API and Integrations</a>.</li><li>Copy your Personal API token. It starts with apify_api_.</li><li>Paste it below. It is checked with Apify, encrypted and stored on the server.</li></ol></div>
        <form data-form="apify-connect" autocomplete="off" class="dsec"><label class="field"><span>Apify API token</span><input name="token" type="password" required autocomplete="off" spellcheck="false" placeholder="apify_api_..." data-autofocus></label><div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">${old ? 'Reconnect Apify' : 'Connect Apify'}</button></div><p class="meta" id="apify-msg" style="margin-top:8px" role="status"></p></form>`;
    U.drawer(`<div><p class="meta">Research \u00b7 Apify API token</p><h2>Apify</h2><p style="margin-top:8px">${c ? '<span class="pill pos">Connected</span>' : old ? '<span class="pill neg">Needs a new token</span>' : '<span class="pill">Not connected</span>'}</p></div>
      <div class="dsec"><h3>Reads</h3><p>Competitor channels, outlier videos, public comments, Instagram and TikTok profiles, Google results and any Apify actor you choose.</p></div>
      <div class="dsec"><h3>Writes</h3><p>Nothing. Research results stay in the OS.</p></div>${body}`, { label: 'Apify' });
  };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form="apify-connect"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const btn = f.querySelector('[type=submit]'); const msg = U.$('#apify-msg'); btn.disabled = true; btn.innerHTML = U.spin + 'Checking with Apify'; msg.textContent = '';
    try { const out = await Auth.apify('connect', { workspace_id: ctx().ws.id, token: f.elements.token.value.trim() }); f.elements.token.value = ''; await window.App.reloadConns(); U.toast('Apify connected as ' + out.account.username); ACT['apify-open'](); render(); }
    catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = staleRow() ? 'Reconnect Apify' : 'Connect Apify'; }
  }, true);
  ACT['rs-go'] = () => { U.closeDrawer(); if (location.hash !== '#research') location.hash = '#research'; else render(); };
  ACT['apify-refresh'] = async (el) => { el.disabled = true; el.innerHTML = U.spin + 'Refreshing'; try { await Auth.apify('status', { workspace_id: ctx().ws.id }); await window.App.reloadConns(); ACT['apify-open'](); render(); } catch (e) { if (await stale(e)) return; U.toast(e.message); el.disabled = false; el.textContent = 'Refresh usage'; } };
  ACT['apify-disconnect'] = async () => {
    const ok = await U.dialog({ title: 'Disconnect Apify?', body: 'The token is deleted from the server. Past research results stay.', ok: 'Disconnect', danger: true }); if (!ok) return;
    try { await Auth.apify('disconnect', { workspace_id: ctx().ws.id }); await window.App.reloadConns(); U.closeDrawer(); U.toast('Apify disconnected'); render(); } catch (e) { U.toast(e.message); }
  };
})();

// Founders AI OS: the content board. One place for every piece of content, from an idea the OS found in
// something that already worked, through your approval, the plan, production and publishing, to the numbers
// each piece earned. Private workspaces store pieces in content_items; the demo keeps them in memory.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const DAY = 864e5;
  const render = () => window.App.render(true);

  const STAGES = [
    ['approved', 'Approved', 'Give it a format and a date.'],
    ['planned', 'Planned', 'Dated and ready to make.'],
    ['production', 'In production', 'Script, film, edit, thumbnail, upload.'],
    ['published', 'Published', 'Numbers refresh when you open the board.'],
  ];
  const SNAME = Object.fromEntries(STAGES.map(([id, n]) => [id, n]));
  // Content is sorted by format. The six main formats are always offered; email, podcast and community stay
  // available in the editor. Older items saved as instagram, linkedin or x read as the matching format.
  const MAIN = [['youtube', 'YouTube'], ['short', 'YouTube Shorts'], ['reel', 'Instagram Reels'], ['carousel', 'Instagram Carousels'], ['tiktok', 'TikTok'], ['post', 'Written Posts']];
  const CHANNELS = MAIN.concat([['email', 'Email'], ['podcast', 'Podcast'], ['community', 'Community']]);
  const CNAME = { ...Object.fromEntries(CHANNELS), instagram: 'Instagram Reels', linkedin: 'Written Posts', x: 'Written Posts' };
  const fmtOf = (it) => it.channel === 'instagram' ? (it.format === 'carousel' ? 'carousel' : 'reel') : it.channel === 'linkedin' || it.channel === 'x' ? 'post' : it.channel;
  const formatFor = (ch) => ({ youtube: 'long', short: 'short', reel: 'short', tiktok: 'short', carousel: 'carousel', post: 'post', email: 'email', podcast: 'long', community: 'post' })[ch] || 'long';
  const FORMATS = [['long', 'Long video'], ['short', 'Short or Reel'], ['carousel', 'Carousel'], ['post', 'Post'], ['email', 'Email'], ['live', 'Live']];
  const STEPS = [['script', 'Script'], ['film', 'Film'], ['edit', 'Edit'], ['thumb', 'Thumbnail'], ['upload', 'Upload']];
  const isYT = (ch) => ch === 'youtube' || ch === 'short';

  Object.assign(VS, { bChan: VS.bChan || 'all', bView: VS.bView || 'board', bQ: VS.bQ || '', bMore: VS.bMore || false });

  const fmtN = (n) => { const x = Number(n) || 0; return x >= 1e6 ? (Math.round(x / 1e5) / 10) + 'M' : x >= 1e4 ? Math.round(x / 1e3) + 'K' : x >= 1e3 ? (Math.round(x / 100) / 10) + 'K' : String(Math.round(x)); };
  const full = (n) => (Number(n) || 0).toLocaleString('en-US');
  const dayISO = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const parseDay = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return y ? new Date(y, m - 1, d).getTime() : null; };
  const nice = (s) => { const t = parseDay(s); if (t == null) return ''; const dd = Math.round((t - today0()) / DAY); if (dd === 0) return 'Today'; if (dd === 1) return 'Tomorrow'; if (dd === -1) return 'Yesterday'; return new Date(t).toLocaleDateString('en-GB', { weekday: dd > 0 && dd < 7 ? 'short' : undefined, day: 'numeric', month: 'short' }); };
  const xFmt = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + 'x';
  const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2));
  const sim = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let k = 0; A.forEach((w) => { if (B.has(w)) k++; }); return k / Math.min(A.size, B.size); };
  const ytIdOf = (s) => { const v = String(s || '').trim(); const m = v.match(/(?:v=|shorts\/|youtu\.be\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : null; };

  /* ---------- the YouTube connection (live) or the sample channel (demo) ---------- */
  function channel() {
    if (isLive()) { const c = (ctx().conns || []).find((x) => x.provider === 'youtube' && x.status === 'connected'); return c && c.meta ? { videos: c.meta.videos || [], median: c.meta.median_views || 0, connected: true } : { videos: [], median: 0, connected: false }; }
    const vids = St.SEED.videos; const s = vids.map((v) => v.views).sort((a, b) => a - b); const med = s[s.length >> 1] || 1;
    return { videos: vids.slice().sort((a, b) => b.day - a.day).slice(0, 25).map((v) => ({ id: v.id, title: v.title, views: v.views, likes: v.likes, comments: v.comments, at: new Date(Date.now() - (St.T - v.day) * DAY).toISOString(), x: v.views / med })), median: med, connected: true };
  }

  /* ---------- storage ---------- */
  const B = { ws: null, at: 0, items: [], busy: false, pending: null, err: null, statsAt: 0, statsBusy: false, migrated: false, ticket: 0 };
  const D = { items: null }; // demo

  function demoItems() {
    if (D.items) return D.items;
    const ch = channel(); const byId = Object.fromEntries(St.SEED.videos.map((v) => [v.id, v]));
    const t0 = today0(); let plannedK = 0;
    D.items = St.s.ideas.map((i, k) => {
      let stage = i.col === 'ideas' ? (i.vote === 'up' || (i.fromDoc && k % 3 === 0) ? 'approved' : 'suggested') : i.col === 'developing' ? 'production' : i.col === 'ready' ? 'planned' : 'published';
      if (i.vote === 'down') stage = 'passed';
      const meta = { why: i.why, score: i.score, sources: i.sources, offer: i.sells || null, demoIdea: i.id, steps: {} };
      let publish_at = null;
      if (stage === 'planned') publish_at = dayISO(t0 + (2 + plannedK++ * 3) * DAY);
      if (stage === 'production') { publish_at = dayISO(t0 + (1 + (k % 4) * 2) * DAY); meta.steps = { script: true, film: k % 2 === 0, edit: k % 4 === 0 }; }
      if (stage === 'published') {
        const v = i.videoId && byId[i.videoId];
        if (v) { meta.video_id = v.id; meta.stats = { views: v.views, likes: v.likes, comments: v.comments, at: new Date().toISOString() }; meta.x = v.views / ch.median; meta.published_at = new Date(Date.now() - (St.T - v.day) * DAY).toISOString(); meta.ctr = v.ctr; meta.subs = v.subsGained; meta.hist = [0.35, 0.62, 0.8, 0.9, 1].map((f, j) => ({ d: dayISO(Date.parse(meta.published_at) + [1, 3, 7, 14, 28][j] * DAY), v: Math.round(v.views * f) })); }
        publish_at = meta.published_at ? meta.published_at.slice(0, 10) : null; meta.steps = { script: true, film: true, edit: true, thumb: true, upload: true };
      }
      return { id: i.id, title: i.title, stage, channel: i.format === 'shorts' ? 'short' : 'youtube', format: i.format === 'shorts' ? 'short' : 'long', publish_at, position: k, meta, created_at: i.created };
    });
    D.items = demoMorning().concat(D.items);
    return D.items;
  }

  // the sample workspace's morning run: 10 ideas per format from the sample proven posts
  function demoMorning() {
    if (!window.OSIdeas || !window.DNA) return [];
    const d = window.DNA.data(); const at = new Date(today0() + 7 * 36e5 + 2 * 6e4).toISOString();
    return window.OSIdeas.morning(window.DNA.demoProven(), window.DNA.offersFor(d), { day: dayISO(Date.now()) }).map((x, k) => ({ id: 'm' + k + Math.random().toString(36).slice(2, 6), publish_at: null, position: -1e6 + k, created_at: at, ...x }));
  }

  function load(force) {
    const w = ctx().ws; if (!w || !w.id) return;
    if (B.ws !== w.id) Object.assign(B, { ws: w.id, at: 0, items: [], busy: false, pending: null, err: null, statsAt: 0, statsBusy: false, migrated: false, ticket: B.ticket + 1 });
    if (B.busy) return force ? B.pending.then(() => load(true)) : B.pending;
    if (!force && B.ws === w.id && Date.now() - B.at < 30000) return;
    B.busy = true;
    const ticket = ++B.ticket, current = () => isLive() && ctx().ws?.id === w.id && B.ws === w.id && B.ticket === ticket;
    return B.pending = window.Auth.content.list(w.id)
      .then(async (rows) => { if (!current()) return; B.items = rows; B.err = null; if (!B.migrated) { B.migrated = true; await migrateMemoryIdeas(w.id, current).catch(() => {}); } })
      .catch((e) => { if (current()) B.err = window.Auth.friendly(e); })
      .finally(() => { if (!current()) return; B.at = Date.now(); B.busy = false; B.pending = null; if (['content','approvals','jarvis'].includes(VS.view)) render(); if (VS.view === 'content') refreshStats(); });
  }
  // Ideas saved to Memory before the board existed move onto it once, as approved.
  async function migrateMemoryIdeas(wsId, current) {
    const mem = await window.Auth.memory.list(wsId);
    const old = mem.filter((m) => m.kind === 'idea' && m.status === 'open' && !(m.meta && m.meta.board));
    for (const m of old) {
      if (!current()) return;
      const row = await window.Auth.content.add(wsId, { title: m.text.slice(0, 300), stage: 'suggested', channel: 'youtube', meta: { ...(m.meta || {}), from_memory: m.id } });
      if (current()) B.items.unshift(row);
      await window.Auth.memory.update(m.id, { meta: { ...(m.meta || {}), board: row.id } });
    }
  }
  const items = () => (isLive() ? B.ws === ctx().ws?.id ? B.items : [] : demoItems());
  const find = (id) => items().find((x) => x.id === id) || null;

  async function patch(it, p, manual = false, expectedAt) {
    const before = { ...it };
    Object.assign(it, p); if (p.meta) it.meta = p.meta;
    if (!isLive()) { syncDemoIdea(it); return true; }
    try {
      const saved = manual ? await window.Auth.content.edit(ctx().ws.id, it.id, p, expectedAt || before.updated_at) : await window.Auth.content.update(it.id, p);
      if (saved) Object.assign(it, saved);
      window.ContentLearning?.invalidate(); return true;
    } catch (e) { Object.assign(it, before); U.toast(window.Auth.friendly(e)); return false; }
  }
  // keep the demo's idea list (used by Jarvis and the drafts drawer) in step with the board
  function syncDemoIdea(it) {
    const i = St.s.ideas.find((x) => x.id === (it.meta && it.meta.demoIdea)); if (!i) return;
    i.col = { suggested: 'ideas', approved: 'ideas', planned: 'ready', production: 'developing', published: 'published' }[it.stage] || i.col;
    i.title = it.title;
  }
  async function create(item) {
    if (!isLive()) { const it = { id: 'c' + Math.random().toString(36).slice(2, 9), stage: 'approved', channel: 'youtube', format: 'long', publish_at: null, position: -Date.now(), meta: {}, created_at: new Date().toISOString(), ...item }; demoItems().unshift(it); return it; }
    const row = await window.Auth.content.add(ctx().ws.id, { position: -Date.now() / 1e6, ...item }); B.items.unshift(row); window.ContentLearning?.invalidate(); return row;
  }

  /* ---------- fresh numbers for published YouTube pieces ---------- */
  async function refreshStats(force) {
    if (!isLive() || B.statsBusy) return;
    if (!force && Date.now() - B.statsAt < 10 * 6e4) return;
    const linked = B.items.filter((x) => x.meta && x.meta.video_id); if (!linked.length) { B.statsAt = Date.now(); return; }
    B.statsBusy = true;
    try {
      const r = await window.Conn.api('yt-videos', { ids: linked.map((x) => x.meta.video_id) });
      const by = Object.fromEntries((r.videos || []).map((v) => [v.id, v])); const med = channel().median;
      for (const it of linked) {
        const v = by[it.meta.video_id]; if (!v) continue;
        const m = { ...it.meta }; const prev = m.stats || {};
        m.stats = { views: v.views, likes: v.likes, comments: v.comments, at: r.at };
        m.thumb = v.thumb || m.thumb; m.published_at = v.at || m.published_at; m.video_title = v.title;
        if (med) m.x = v.views / med;
        const d = dayISO(Date.now()); const h = Array.isArray(m.hist) ? m.hist.slice(-89) : [];
        if (!h.length || h[h.length - 1].d !== d) h.push({ d, v: v.views }); else h[h.length - 1].v = v.views; m.hist = h;
        if (prev.views !== v.views || prev.likes !== v.likes || prev.comments !== v.comments || !prev.at || (Array.isArray(it.meta.hist) ? it.meta.hist.length : 0) !== h.length) await patch(it, { meta: m });
      }
    } catch (e) { B.statsErr = e.message; }
    B.statsAt = Date.now(); B.statsBusy = false;
    if (VS.view === 'content') render();
  }

  /* ---------- suggestions: the best proven posts not yet on the board ---------- */
  // Ideas to approve are stored rows now (the morning run and remixes), so nothing is invented on the fly.
  function suggestions() {
    return [];
    let all = []; try { all = window.OSProven.annotated().all; } catch (e) { return []; }
    const used = new Set(B.items.map((x) => x.meta && x.meta.post_id).filter(Boolean));
    const fresh = all.filter((p) => !used.has(p.id) && p.outlier >= 1.5).sort((a, b) => b.outlier - a.outlier).slice(0, 12);
    const d = window.DNA.data(); const own = window.DNA.offersFor(d);
    return fresh.map((p) => {
      let b = null; try { b = window.Remix.brief(p, own, all); } catch (e) { b = null; }
      return { id: 'sg:' + p.id, virtual: true, post: p, title: (b && b.titles[0]) || p.title, stage: 'suggested', channel: p.kind === 'short' ? 'short' : p.platform === 'instagram' ? (p.kind === 'carousel' ? 'carousel' : 'reel') : p.platform === 'tiktok' ? 'tiktok' : 'youtube', format: p.kind === 'short' ? 'short' : p.kind === 'carousel' ? 'carousel' : 'long', publish_at: null,
        meta: { post_id: p.id, from: p.title, author: p.author, source_url: p.url || null, outlier: p.outlier, views_src: p.views, pattern: b ? b.pattern.name : p.pat && p.pat.name, proof: b ? b.proof : '', offer: b && b.offer ? b.offer.name : null, funnel: b && b.funnel ? b.funnel.name : null, hook: b ? b.hook : '', outline: b ? b.outline : [] } };
    });
  }
  const findAny = (id) => find(id) || suggestions().find((x) => x.id === id) || null;

  /* ---------- analytics helpers ---------- */
  function statsOf(it) {
    const m = it.meta || {}; const s = m.stats || m.manual || null; if (!s) return null;
    const views = Number(s.views) || 0; const eng = views ? ((Number(s.likes) || 0) + (Number(s.comments) || 0)) / views : 0;
    return { views, likes: Number(s.likes) || 0, comments: Number(s.comments) || 0, clicks: Number((m.manual || {}).clicks) || 0, leads: Number((m.manual || {}).leads) || 0, eng, x: m.x || null, at: s.at };
  }
  function autoMatch(it) {
    if (!isYT(it.channel) || (it.meta && it.meta.video_id)) return null;
    const vids = channel().videos; let best = null, bs = 0;
    vids.forEach((v) => { if (items().some((o) => o.meta && o.meta.video_id === v.id)) return; const s = sim(it.title, v.title); if (s > bs) { bs = s; best = v; } });
    return bs >= 0.6 ? best : null;
  }

  /* ---------- card ---------- */
  function card(it) {
    const m = it.meta || {}; const st = statsOf(it);
    const date = it.publish_at ? `<span class="cb-date${it.stage !== 'published' && parseDay(it.publish_at) < today0() ? ' late' : ''}">${esc(nice(it.publish_at))}</span>` : '';
    const score = m.outlier ? `<span class="cb-x" title="The original beat its creator's median by this much">${xFmt(m.outlier)}</span>` : m.score ? `<span class="cb-sc">${Number(m.score).toFixed(1)}</span>` : '';
    let body = '';
    if (it.stage === 'suggested') body = m.from === 'call' ? `<p class="cb-why">${esc('From your call' + (m.recording ? ', ' + m.recording : '') + (m.why ? '. ' + m.why : ''))}</p>` : `<p class="cb-why">${esc(m.author ? 'From ' + m.author + (m.pattern ? ' · ' + m.pattern : '') : m.pattern || m.why || '')}</p>`;
    if (it.stage === 'production') { const done = STEPS.filter(([k]) => m.steps && m.steps[k]).length; body = `<div class="cb-steps" title="${done} of ${STEPS.length} steps done">${STEPS.map(([k, n]) => `<i class="${m.steps && m.steps[k] ? 'on' : ''}" title="${n}"></i>`).join('')}<span>${STEPS.find(([k]) => !(m.steps && m.steps[k])) ? 'Next: ' + STEPS.find(([k]) => !(m.steps && m.steps[k]))[1] : 'Ready to publish'}</span></div>`; }
    if (it.stage === 'published') body = st ? `<div class="cb-num"><b>${fmtN(st.views)}</b><span>views</span>${st.x ? `<span class="cb-x${st.x >= 1.5 ? ' hot' : st.x < 0.7 ? ' low' : ''}" title="Compared with your median video">${xFmt(st.x)}</span>` : ''}<span class="cb-eng">${fmtN(st.likes)} likes · ${fmtN(st.comments)} comments</span></div>` : `<p class="cb-why warn">${isYT(it.channel) ? 'Link the video to see its numbers' : 'Add the numbers when they are in'}</p>`;
    const match = it.stage !== 'published' && it.stage !== 'suggested' ? autoMatch(it) : null;
    const sells = '';
    const foot = it.stage === 'suggested'
      ? `<div class="cb-act"><button class="btn sm primary" data-action="cb-approve" data-id="${esc(it.id)}">Approve</button><button class="btn sm ghost" data-action="cb-pass" data-id="${esc(it.id)}">Pass</button></div>`
      : match ? `<button class="cb-hint" data-action="cb-match" data-id="${esc(it.id)}" data-v="${esc(match.id)}">Went out as "${esc(match.title.slice(0, 48))}"? Link it</button>` : '';
    return `<article class="cb-card s-${it.stage}" ${it.virtual ? '' : `draggable="true" data-cdrag="${esc(it.id)}"`} tabindex="0" role="button" data-action="cb-open" data-id="${esc(it.id)}" aria-label="${esc(it.title)}">
      <div class="cb-top"><span class="cb-ch">${esc(CNAME[fmtOf(it)] || it.channel)}</span>${date}${score}</div>
      ${it.stage === 'published' && m.thumb ? `<img class="cb-thumb" src="${esc(m.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="remove">` : ''}
      <h4>${esc(it.title)}</h4>${body}${it.stage !== 'suggested' ? sells : ''}${foot}</article>`;
  }

  /* ---------- views ---------- */
  function filtered(list) {
    const q = VS.bQ.trim().toLowerCase();
    return list.filter((x) => !['passed','suggested'].includes(x.stage) && (VS.bChan === 'all' || fmtOf(x) === VS.bChan) && (!q || x.title.toLowerCase().includes(q) || String((x.meta || {}).offer || '').toLowerCase().includes(q)));
  }
  function columns(list) {
    return `<div class="cboard" role="list">${STAGES.map(([id, n, hint]) => {
      let col = list.filter((x) => x.stage === id);
      if (id === 'published') col.sort((a, b) => String(b.publish_at || '').localeCompare(String(a.publish_at || '')));
      else if (id === 'planned' || id === 'production') col.sort((a, b) => String(a.publish_at || '9').localeCompare(String(b.publish_at || '9')));
      else if (id === 'suggested') col.sort((a, b) => ((b.meta || {}).outlier || (b.meta || {}).score || 0) - ((a.meta || {}).outlier || (a.meta || {}).score || 0));
      const cap = !VS.bMore && col.length > 10 ? 8 : col.length;
      const fresh = id === 'suggested' ? `<button class="btn sm cb-fresh" data-action="cb-morning" ${M.busy ? 'disabled' : ''}>${M.busy ? U.spin + 'Writing' : icon('refresh') + 'Write today\u2019s ideas now'}</button>` : '';
      return `<div class="ccol" data-cdrop="${id}" role="listitem"><h3><span>${n}</span><span class="cn">${col.length}</span></h3><p class="ccol-sub">${hint}</p>${fresh}
        <div class="cards">${col.slice(0, cap).map(card).join('') || `<p class="meta dropzone">${id === 'suggested' ? (isLive() ? 'Nothing new right now. Add creators or run Research and new proven ideas land here.' : 'All caught up') : 'Drop a card here'}</p>`}
        ${cap < col.length ? `<button class="btn sm more" data-action="cb-more">Show ${col.length - cap} more</button>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  function calendar(list) {
    const t0 = today0(); const dow = (new Date(t0).getDay() + 6) % 7; const start = t0 - dow * DAY - 7 * DAY;
    const days = Array.from({ length: 35 }, (_, k) => start + k * DAY);
    const dated = list.filter((x) => x.publish_at && x.stage !== 'suggested');
    const undated = list.filter((x) => !x.publish_at && (x.stage === 'approved' || x.stage === 'planned' || x.stage === 'production'));
    return `<div class="ccal-wrap"><div class="ccal" role="grid" aria-label="Content calendar">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="ccal-h" role="columnheader">${d}</div>`).join('')}
      ${days.map((t) => { const iso = dayISO(t); const here = dated.filter((x) => String(x.publish_at).slice(0, 10) === iso); return `<div class="ccal-d${t === t0 ? ' today' : ''}${t < t0 ? ' past' : ''}" data-cdate="${iso}" role="gridcell"><span class="ccal-n">${new Date(t).getDate() === 1 || t === start ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : new Date(t).getDate()}</span>
        ${here.map((x) => `<button class="ccal-i s-${x.stage}" draggable="true" data-cdrag="${esc(x.id)}" data-action="cb-open" data-id="${esc(x.id)}" title="${esc(SNAME[x.stage])}"><i></i><span>${esc(x.title)}</span></button>`).join('')}</div>`; }).join('')}</div>
      <aside class="ccal-side"><h3>Not dated yet <span class="meta">${undated.length}</span></h3><p class="meta">Drag one onto a day to plan it.</p><div class="ccal-list">${undated.map((x) => `<button class="ccal-i s-${x.stage}" draggable="true" data-cdrag="${esc(x.id)}" data-action="cb-open" data-id="${esc(x.id)}"><i></i><span>${esc(x.title)}</span></button>`).join('') || '<p class="meta">Everything approved has a date.</p>'}</div></aside></div>`;
  }

  function page() {
    const live = isLive(); if (live) load();
    const own = live ? B.items : demoItems();
    const all = [...suggestions(), ...own];
    const list = filtered(all);
    const t0 = today0(); const ch = channel();
    const waiting = all.filter((x) => x.stage === 'suggested').length;
    const soon = own.filter((x) => (x.stage === 'planned' || x.stage === 'production') && x.publish_at && parseDay(x.publish_at) >= t0 && parseDay(x.publish_at) < t0 + 14 * DAY).length;
    const prod = own.filter((x) => x.stage === 'production').length;
    const pub30 = own.filter((x) => x.stage === 'published' && x.publish_at && parseDay(x.publish_at) >= t0 - 30 * DAY);
    const views30 = pub30.reduce((s, x) => s + ((statsOf(x) || {}).views || 0), 0);
    const best = own.filter((x) => x.stage === 'published' && (x.meta || {}).x).sort((a, b) => b.meta.x - a.meta.x)[0];
    const kp = U.kpis([
      { label: 'Ideas waiting for you', value: String(waiting), delta: '<a href="#approvals">Review in the Newsfeed</a>' },
      { label: 'Going out in 14 days', value: String(soon), delta: soon >= 4 ? '<span class="up">On a twice a week pace</span>' : `<span class="down">${Math.max(0, 4 - soon)} short of twice a week</span>` },
      { label: 'In production', value: String(prod), delta: prod ? own.filter((x) => x.stage === 'production' && STEPS.every(([k]) => x.meta && x.meta.steps && x.meta.steps[k])).length + ' ready to publish' : 'Nothing being made' },
      { label: 'Published, 30 days', value: String(pub30.length), delta: views30 ? fmtN(views30) + ' views on them' : 'Link videos to see views' },
      { label: 'Best piece', value: best ? xFmt(best.meta.x) : '\u2013', delta: best ? esc(best.title.slice(0, 40)) + (best.title.length > 40 ? '\u2026' : '') : 'Compared with your median' },
    ]);
    const chans = MAIN.map((x) => x[0]).concat([...new Set(all.map(fmtOf))].filter((c) => !MAIN.some((x) => x[0] === c)));
    if (VS.bChan !== 'all' && !chans.includes(VS.bChan)) VS.bChan = 'all';
    const head = U.title('Content', 'Approved work, from planning through production to the results it earned. New suggestions wait in the Newsfeed until you choose them.',
      `<a class="btn" href="#approvals">Review ideas</a><a class="btn" href="#proven">${icon('proven')}<span>Proven</span></a><button class="btn primary" data-action="cb-new">${icon('plus')}<span>New content</span></button>`);
    const tabs = `<div class="segmented" role="group" aria-label="View">${[['board', 'Board'], ['calendar', 'Calendar'], ['learning', 'Learning']].map(([v, l]) => `<button data-action="cb-view" data-v="${v}" aria-pressed="${VS.bView === v}">${l}</button>`).join('')}</div>`;
    if (VS.bView === 'learning' && window.ContentLearning) return `${head}<div class="cb-tools cl-tabs">${tabs}</div>${window.ContentLearning.view()}`;
    const tools = `<div class="cb-tools">${tabs}
      <label class="sel"><span>Format</span><select data-action="cb-chan"><option value="all">All formats</option>${chans.map((c) => `<option value="${c}" ${VS.bChan === c ? 'selected' : ''}>${esc(CNAME[c] || c)}</option>`).join('')}</select></label>
      <label class="cb-search"><span class="sr">Search</span>${icon('search')}<input type="search" data-cbq placeholder="Search titles" value="${esc(VS.bQ)}"></label>
      <span class="meta">${live && B.busy && !B.at ? 'Loading your board' : `${morningNote(own)}${list.length} pieces · drag cards between ${VS.bView === 'board' ? 'columns' : 'days'}`}${live && !ch.connected ? ' · <a class="lnk" href="#connect">Connect YouTube</a> for automatic numbers' : ''}</span></div>`;
    const err = B.err && live ? `<p class="auth-msg">${esc(B.err)}</p>` : '';
    const proven = window.OSProven ? window.OSProven.homePanel(3) : '';
    return `${head}${kp}${tools}${err}${VS.bView === 'calendar' ? calendar(list) : columns(list)}<div style="margin-top:var(--gap)">${proven}</div>`;
  }

  // when today's ideas were written, and by what
  const M = { busy: false };
  function morningNote(own) {
    const xs = own.filter((x) => x.stage === 'suggested' && x.meta && x.meta.morning); if (!xs.length) return '';
    const day = xs.map((x) => x.meta.morning).sort().pop(); const by = (xs.find((x) => x.meta.by && x.meta.by !== 'Rules') || xs[0]).meta.by;
    const when = day === dayISO(Date.now()) ? 'This morning' : nice(day);
    return `${when}: ${xs.filter((x) => x.meta.morning === day).length} ideas${by && by !== 'Rules' ? ' by ' + esc(by) : ''} · `;
  }

  V.content = page;
  V.content.live = page;

  /* ---------- drawer ---------- */
  function spark(hist) {
    if (!Array.isArray(hist) || hist.length < 2) return '';
    const w = 280, h = 56, max = Math.max(...hist.map((p) => p.v), 1);
    const pts = hist.map((p, k) => `${(k / (hist.length - 1)) * w},${h - 4 - (p.v / max) * (h - 10)}`).join(' ');
    return `<figure class="cb-spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><figcaption class="meta">Views since ${esc(nice(hist[0].d))}, ${hist.length} readings</figcaption></figure>`;
  }
  function analytics(it) {
    const m = it.meta || {}; const st = statsOf(it); const ch = channel();
    const linkUI = isYT(it.channel) ? (() => {
      const vids = ch.videos.filter((v) => !items().some((o) => o !== it && o.meta && o.meta.video_id === v.id));
      const sorted = vids.slice().sort((a, b) => sim(it.title, b.title) - sim(it.title, a.title));
      return `<form class="cb-link" data-cbform="link" data-id="${esc(it.id)}"><label class="field"><span>${m.video_id ? 'Linked video' : 'Which video is this?'}</span>
        ${sorted.length ? `<select name="pick"><option value="">${m.video_id ? 'Keep the current link' : 'Pick from your latest uploads'}</option>${sorted.map((v) => `<option value="${esc(v.id)}" ${m.video_id === v.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}</select>` : ''}
        <input name="url" placeholder="Or paste the video link" value=""></label><div class="actions"><button class="btn sm" type="submit">${m.video_id ? 'Update link' : 'Link video'}</button>${m.video_id && !String(m.video_id).startsWith('v') ? `<a class="btn sm ghost" href="https://www.youtube.com/watch?v=${esc(m.video_id)}" target="_blank" rel="noopener">Open on YouTube</a>` : ''}</div></form>`;
    })() : '';
    const man = m.manual || {};
    const manual = !isYT(it.channel) || !m.video_id ? `<form class="cb-man" data-cbform="manual" data-id="${esc(it.id)}"><p class="meta">${isYT(it.channel) ? 'No link yet? Type the numbers in for now.' : 'Add the numbers from ' + esc(CNAME[it.channel] || 'the platform') + '.'} Self-reported numbers stay separate from connected results.</p>${fmtOf(it) === 'post' ? `<label class="field"><span>Published on</span><select name="platform"><option value="">Choose the platform for comparisons</option>${[['linkedin', 'LinkedIn'], ['facebook', 'Facebook'], ['x', 'X'], ['instagram', 'Instagram'], ['other', 'Other']].map(([id, label]) => `<option value="${id}" ${man.platform === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}<label class="field"><span>Publishing account</span><input name="account" maxlength="120" placeholder="Your account name or handle" value="${esc(man.account || '')}"><small class="meta">Used to keep each account’s results separate.</small></label><div class="cb-mgrid">${[['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['clicks', 'Link clicks'], ['leads', 'Leads']].map(([k, l]) => `<label class="field"><span>${l}</span><input name="${k}" inputmode="numeric" value="${esc(man[k] != null ? man[k] : '')}"></label>`).join('')}</div><div class="actions"><button class="btn sm" type="submit">Save numbers</button></div></form>` : '';
    const grid = st ? `<div class="cb-stats">${[
      ['Views', full(st.views)], st.x ? ['Against your median', xFmt(st.x)] : null, ['Likes', full(st.likes)], ['Comments', full(st.comments)], ['Engagement', st.views ? (st.eng * 100).toFixed(1) + '%' : '\u2013'],
      m.published_at ? ['Live for', Math.max(1, Math.round((Date.now() - Date.parse(m.published_at)) / DAY)) + ' days'] : null,
      st.clicks ? ['Link clicks', full(st.clicks)] : null, st.leads ? ['Leads', full(st.leads)] : null, m.ctr ? ['Click-through', m.ctr + '%'] : null, m.subs ? ['Subscribers gained', full(m.subs)] : null,
    ].filter(Boolean).map(([l, v]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>${spark(m.hist)}<p class="meta">${st.at ? 'Updated ' + esc(window.DNA.ago(st.at)) : ''}${st.x ? `. Your median video gets ${full(ch.median)} views.` : ''}</p>` : '';
    const verdict = st && st.x ? `<p class="evidence">${st.x >= 2 ? 'An outlier for you. The pattern behind it is worth repeating soon, with a new angle.' : st.x >= 1 ? 'Above your median. A solid piece for this pattern.' : 'Below your median so far. Check the title and thumbnail before the pattern itself.'}${m.pattern ? ' Pattern: ' + esc(m.pattern) + '.' : ''}</p>` : '';
    return `<div class="dsec"><h3>How it performed</h3>${grid}${verdict}${linkUI}${manual}${it.stage === 'published' && st && st.x >= 1.5 ? `<div class="actions"><button class="btn sm" data-action="cb-again" data-id="${esc(it.id)}">Plan a follow-up</button></div>` : ''}</div>`;
  }
  function open(id) {
    const it = findAny(id); if (!it) return;
    if (['suggested','passed'].includes(it.stage) && window.Approvals) return window.Approvals.open(id);
    const m = it.meta || {}; const d = window.DNA.data(); const own = window.DNA.offersFor(d);
    const offers = own.offers.map((o) => o.name);
    if (!isLive()) St.s.offers && St.s.offers.forEach((o) => { if (!offers.includes(o.name)) offers.push(o.name); });
    if (m.offer && !offers.includes(m.offer)) offers.unshift(m.offer);
    const steps = it.stage === 'production' || it.stage === 'planned' ? `<div class="dsec"><h3>Production</h3><div class="cb-check">${STEPS.map(([k, n]) => `<label><input type="checkbox" data-cbstep="${k}" data-id="${esc(it.id)}" ${m.steps && m.steps[k] ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>` : '';
    const source = m.from || m.why ? `<div class="dsec pv-src"><p class="meta">Why it should work</p>${m.from ? `<p><b>${esc(m.from)}</b></p><p class="meta">${esc(m.author || '')}${m.views_src ? ' · ' + fmtN(m.views_src) + ' views' : ''}${m.outlier ? ` · <span class="pv-mult">${xFmt(m.outlier)}</span> ${m.source_type === 'own_content' ? 'similarly aged comparison group' : 'their median'}` : ''}${m.source_url ? ` · <a class="lnk" href="${esc(m.source_url)}" target="_blank" rel="noopener">Open the original</a>` : ''}</p>` : ''}
      ${m.pattern || m.proof || m.why ? `<p class="evidence" style="margin-top:8px">${m.pattern ? `<b>${esc(m.pattern)}.</b> ` : ''}${esc(m.proof || m.why || '')}</p>` : ''}</div>` : '';
    const outline = Array.isArray(m.outline) && m.outline.length ? `<div class="dsec"><h3>Outline</h3><ol class="pv-ol">${m.outline.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>` : '';
    const drafts = m.demoIdea ? `<button class="btn sm" data-action="idea" data-id="${esc(m.demoIdea)}">${icon('edit')}Write drafts</button>` : '';
    const form = it.virtual ? '' : `<form class="dsec cb-form" data-cbform="plan" data-id="${esc(it.id)}" data-updated-at="${esc(it.updated_at || '')}"><h3>Plan</h3>
      <label class="field"><span>Title</span><input name="title" required maxlength="300" value="${esc(it.title)}"></label>
      <div class="cb-row"><label class="field"><span>Format</span><select name="channel">${CHANNELS.map(([v, l]) => `<option value="${v}" ${fmtOf(it) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>${it.stage === 'published' ? 'Published on' : 'Goes out on'}</span><input type="date" name="publish_at" value="${esc(it.publish_at ? String(it.publish_at).slice(0, 10) : '')}"></label></div>
      ${m.post_body != null || m.draft_body != null ? `<label class="field"><span>Written draft</span><textarea name="post_body" rows="12" class="cb-post">${esc(m.post_body ?? m.draft_body)}</textarea></label>` : ''}
      ${m.caption != null ? `<label class="field"><span>Caption</span><textarea name="caption" rows="3">${esc(m.caption)}</textarea></label>` : ''}
      <label class="field"><span>${m.post_body != null ? 'First line' : it.channel === 'carousel' ? 'Cover slide' : it.channel === 'youtube' ? 'Hook, first 15 seconds' : 'Hook, first 2 seconds'}</span><textarea name="hook" rows="2" placeholder="What makes someone stay">${esc(m.hook || '')}</textarea></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Shots, b-roll, the call to action">${esc(m.notes || '')}</textarea></label>
      <div class="actions"><button class="btn sm primary" type="submit">Save</button>${m.post_body != null ? `<button class="btn sm" type="button" data-action="cb-copypost" data-id="${esc(it.id)}">${icon('copy')}Copy post</button>` : ''}${!['suggested','passed'].includes(it.stage) && (m.post_body != null || m.draft_body != null || m.caption != null) ? `<button class="btn sm" type="button" data-action="hl-social" data-id="${esc(it.id)}">${icon('upload')}Send to Social Planner</button>` : ''}${drafts}</div></form>`;
    const stepper = it.virtual || it.stage === 'suggested'
      ? `<div class="actions"><button class="btn primary" data-action="cb-approve" data-id="${esc(it.id)}" data-autofocus>Approve</button><button class="btn ghost" data-action="cb-pass" data-id="${esc(it.id)}">Pass</button>${m.source_url ? `<a class="btn ghost" href="${esc(m.source_url)}" target="_blank" rel="noopener">Open the original</a>` : ''}</div>`
      : `<div class="cb-stepper" role="group" aria-label="Stage">${STAGES.map(([id, n]) => `<button data-action="cb-stage" data-id="${esc(it.id)}" data-v="${id}" aria-pressed="${it.stage === id}">${n}</button>`).join('')}</div>`;
    U.drawer(`<div class="tags"><span class="tag">${esc(CNAME[fmtOf(it)] || it.channel)}</span><span class="pill">${esc(SNAME[it.stage] || it.stage)}</span>${m.morning ? `<span class="pill">Morning ideas, ${esc(nice(m.morning))}</span>` : m.remix ? '<span class="pill">Remix</span>' : ''}</div>
      <div><h2>${esc(it.title)}</h2>${it.publish_at ? `<p class="meta" style="margin-top:6px">${it.stage === 'published' ? 'Published' : 'Goes out'} ${esc(nice(it.publish_at))}</p>` : ''}</div>
      ${stepper}${it.stage === 'published' || (m.video_id) ? analytics(it) : ''}${source}${m.learning?.enabled && (m.learning.signals || m.learning.followups) ? `<section class="dsec"><h3>Learning context</h3><p class="meta">Created with ${Number(m.learning.signals) || 0} repeated observations and ${Number(m.learning.followups) || 0} follow-up candidates. Brand DNA and approved writing rules take priority.</p><button class="btn sm ghost" data-action="cl-open">Inspect content learning${icon('arrow')}</button></section>` : ''}${outline}${steps}${form}
      ${it.stage !== 'published' && !it.virtual && !m.video_id && it.stage === 'production' ? analytics(it) : ''}
      ${it.virtual ? '' : `<div class="dsec"><div class="actions"><button class="btn sm ghost danger" data-action="cb-del" data-id="${esc(it.id)}">Remove from the board</button></div></div>`}`, { label: 'Content piece', wide: true });
  }

  /* ---------- actions ---------- */
  ACT['cb-open'] = (el, e) => { if (e && e.target.closest('button') && e.target.closest('button') !== el) return; open(el.dataset.id); };
  ACT['hl-social'] = (el) => { const f = el.closest('form'); if (!f || !window.HLSync) return; const v = (n) => { const x = f.querySelector(`[name="${n}"]`); return x ? x.value : ''; };
    const it = findAny(el.dataset.id); window.HLSync.social({ text: v('post_body') || v('caption'), title: v('title') || (it && it.title) || '', when: v('publish_at') }); };
  ACT['cb-copypost'] = (el) => { const f = el.closest('form'); const t = f && f.querySelector('[name="post_body"]'); if (t) U.copy(t.value); };
  ACT['cb-more'] = () => { VS.bMore = !VS.bMore; render(); };
  ACT['cb-view'] = (el) => { VS.bView = el.dataset.v; render(); };
  ACT['cb-chan'] = (el) => { VS.bChan = el.value; render(); };
  ACT['cb-approve'] = async (el, e) => {
    if (e) e.stopPropagation();
    if (window.Approvals) return window.Approvals.open(el.dataset.id);
    const it = findAny(el.dataset.id); if (!it) return;
    if (it.virtual) {
      el.disabled = true;
      try { const row = await create({ title: it.title, stage: 'approved', channel: it.channel, format: it.format, meta: { ...it.meta, approved_at: new Date().toISOString() } }); U.toast('Approved. Give it a date when you are ready.'); if (U.$('#drawer').classList.contains('open')) open(row.id); }
      catch (ex) { U.toast(window.Auth.friendly(ex)); el.disabled = false; }
    } else { if (!await patch(it, { stage: 'approved', meta: { ...it.meta, approved_at: new Date().toISOString() } })) return; St.log && St.log('Approved idea', it.title, 'idea'); U.toast('Approved'); if (U.$('#drawer').classList.contains('open')) open(it.id); }
    render();
  };
  ACT['cb-pass'] = async (el, e) => {
    if (e) e.stopPropagation();
    if (window.Approvals) return window.Approvals.open(el.dataset.id);
    const it = findAny(el.dataset.id); if (!it) return;
    const r = await U.dialog({ title: 'Pass on this idea', body: 'Optional. A reason helps the OS find better ideas for you.', fields: [{ name: 'quick', label: 'Quick reasons', type: 'chips', options: ['Done it before', 'Off brand', 'Low intent topic', 'Too much work'] }, { name: 'reason', label: 'Reason', type: 'textarea', rows: 2 }], ok: 'Pass' });
    if (!r) return;
    const reason = [r.quick, r.reason].filter(Boolean).join('. ');
    try {
      if (it.virtual) await create({ title: it.title, stage: 'passed', channel: it.channel, format: it.format, meta: { ...it.meta, passed_reason: reason } });
      else { if (!await patch(it, { stage: 'passed', meta: { ...it.meta, passed_reason: reason } })) return; const i = !isLive() && St.s.ideas.find((x) => x.id === it.meta.demoIdea); if (i) St.A.vote(i.id, 'down', reason); }
      U.toast('Passed. The OS will look for something closer to your brand.'); U.closeDrawer(); render();
    } catch (ex) { U.toast(window.Auth.friendly(ex)); }
  };
  async function move(it, stage, date) {
    if (!it || it.virtual) return;
    if (['suggested','passed'].includes(it.stage)) { U.toast('Review this idea in the Newsfeed first.'); return null; }
    const p = { stage }; const m = { ...(it.meta || {}) };
    if (date) p.publish_at = date;
    if (stage === 'planned' && !it.publish_at && !date) { p.publish_at = nextFree(); }
    if (stage === 'published') { m.steps = Object.fromEntries(STEPS.map(([k]) => [k, true])); if (!it.publish_at && !date) p.publish_at = dayISO(Date.now()); const mt = autoMatch(it); if (mt) { m.video_id = mt.id; m.thumb = mt.thumb || null; m.published_at = mt.at; p.publish_at = String(mt.at).slice(0, 10); m.stats = { views: mt.views, likes: mt.likes, comments: mt.comments, at: new Date().toISOString() }; const med = channel().median; if (med) m.x = mt.views / med; } }
    p.meta = m; if (!await patch(it, p)) return null;
    return p;
  }
  // the next day with nothing going out, starting tomorrow
  function nextFree() { const taken = new Set(items().filter((x) => x.publish_at && x.stage !== 'published').map((x) => String(x.publish_at).slice(0, 10))); for (let k = 1; k < 60; k++) { const d = dayISO(today0() + k * DAY); if (!taken.has(d)) return d; } return dayISO(today0() + DAY); }
  ACT['cb-stage'] = async (el) => {
    const it = find(el.dataset.id); if (!it || it.stage === el.dataset.v) return;
    if (el.dataset.v === 'suggested') return U.toast('Approved ideas stay approved. Pass on it to take it off the board.');
    const p = await move(it, el.dataset.v); if (!p) return; U.toast('Moved to ' + SNAME[el.dataset.v] + (p.publish_at && el.dataset.v === 'planned' ? ', ' + nice(p.publish_at) : ''));
    open(it.id); render(); if (el.dataset.v === 'published') refreshStats(true);
  };
  ACT['cb-match'] = async (el, e) => {
    if (e) e.stopPropagation();
    const it = find(el.dataset.id); const v = channel().videos.find((x) => x.id === el.dataset.v); if (!it || !v) return;
    const med = channel().median;
    if (!await patch(it, { stage: 'published', publish_at: String(v.at).slice(0, 10), meta: { ...it.meta, video_id: v.id, thumb: v.thumb || null, published_at: v.at, video_title: v.title, x: med ? v.views / med : null, stats: { views: v.views, likes: v.likes, comments: v.comments, at: new Date().toISOString() }, steps: Object.fromEntries(STEPS.map(([k]) => [k, true])) } })) return;
    U.toast('Linked and moved to Published'); render(); refreshStats(true);
  };
  ACT['cb-again'] = async (el) => {
    const it = find(el.dataset.id); if (!it) return;
    const row = await create({ title: 'Follow-up: ' + it.title, stage: 'suggested', channel: it.channel, format: it.format, meta: { why: `${it.title} did ${xFmt(it.meta.x)} your median. Same pattern, a new angle.`, pattern: it.meta.pattern || null, follow_of: it.id } });
    U.toast('Follow-up added to the Newsfeed'); open(row.id); render();
  };
  ACT['cb-del'] = async (el) => {
    const it = find(el.dataset.id); if (!it) return;
    const ok = await U.dialog({ title: 'Remove this piece', body: 'It comes off the board along with its plan and numbers.', ok: 'Remove', danger: true }); if (!ok) return;
    if (isLive()) { try { await window.Auth.content.remove(it.id); B.items = B.items.filter((x) => x !== it); } catch (ex) { return U.toast(window.Auth.friendly(ex)); } }
    else D.items = D.items.filter((x) => x !== it);
    U.closeDrawer(); U.toast('Removed'); render();
  };
  // Compatibility for old idea links. Only the founder's configured cadences run.
  ACT['cb-morning'] = () => { location.hash='#approvals';window.Approvals?.tab('cadences'); };
  ACT['cb-new'] = async () => {
    const d = window.DNA.data(); const offers = window.DNA.offersFor(d).offers.map((o) => o.name);
    if (!isLive()) St.s.offers && St.s.offers.forEach((o) => { if (!offers.includes(o.name)) offers.push(o.name); });
    const r = await U.dialog({ title: 'New idea', fields: [{ name: 'title', label: 'Title', required: true, placeholder: 'What I would build for a dentist in a weekend' }, { name: 'why', label: 'Why it should work', type: 'textarea', rows: 2, placeholder: 'Three clients asked me this last week' }, { name: 'channel', label: 'Format', type: 'select', value: 'youtube', options: CHANNELS }], ok: 'Add to Approved' });
    if (!r) return;
    try { const row = await create({ title: r.title.trim().slice(0, 300), stage: 'approved', channel: r.channel, format: formatFor(r.channel), meta: { why: r.why || 'Added by you.', sources: ['YOU'] } }); U.toast('Added to Approved'); render(); open(row.id); }
    catch (ex) { U.toast(window.Auth.friendly(ex)); }
  };

  // forms inside the drawer
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-cbform]'); if (!f) return; e.preventDefault();
    const it = find(f.dataset.id); if (!it) return; const d = Object.fromEntries(new FormData(f));
    if (f.dataset.cbform === 'plan') {
      const title = String(d.title || '').trim(); if (!title) return;
      const p = { title: title.slice(0, 300), channel: d.channel, format: formatFor(d.channel), publish_at: d.publish_at || null, meta: { ...it.meta, hook: d.hook || '', notes: d.notes || '', ...(d.post_body != null ? { post_body: String(d.post_body) } : {}), ...(d.caption != null ? { caption: String(d.caption) } : {}) } };
      if (it.stage === 'approved' && p.publish_at) p.stage = 'planned';
      const btn = f.querySelector('[type=submit]'); if (btn.disabled) return; btn.disabled = true;
      if (!await patch(it, p, true, f.dataset.updatedAt)) { btn.disabled = false; return; }
      U.toast(p.stage === 'planned' ? 'Saved and planned for ' + nice(p.publish_at) : 'Saved'); open(it.id); render();
    }
    if (f.dataset.cbform === 'link') {
      const id = ytIdOf(d.url) || d.pick; if (!id) return U.toast('Pick a video or paste its link');
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.innerHTML = U.spin + 'Linking';
      const m = { ...it.meta, video_id: id };
      const v = channel().videos.find((x) => x.id === id);
      if (v) { m.thumb = v.thumb || null; m.published_at = v.at; m.video_title = v.title; m.stats = { views: v.views, likes: v.likes, comments: v.comments, at: new Date().toISOString() }; const med = channel().median; if (med) m.x = v.views / med; }
      const p = { meta: m }; if (it.stage !== 'published') p.stage = 'published'; if (v) p.publish_at = String(v.at).slice(0, 10);
      if (!await patch(it, p)) { btn.disabled = false; btn.textContent = 'Link video'; return; } B.statsAt = 0; if (isLive()) await refreshStats(true);
      U.toast('Video linked'); open(it.id); render();
    }
    if (f.dataset.cbform === 'manual') {
      const man = {}; ['views', 'likes', 'comments', 'clicks', 'leads'].forEach((k) => { const n = String(d[k] || '').replace(/[^\d]/g, ''); if (n) man[k] = +n; });
      man.at = new Date().toISOString();
      if (d.platform) man.platform = d.platform;
      if (d.account) man.account = String(d.account).trim().slice(0, 120);
      const m = { ...it.meta, manual: man }; const med = isYT(it.channel) ? channel().median : 0; if (med && man.views) m.x = man.views / med;
      const h = Array.isArray(m.hist) ? m.hist.slice(-89) : []; if (man.views) { const dd = dayISO(Date.now()); if (h.length && h[h.length - 1].d === dd) h[h.length - 1].v = man.views; else h.push({ d: dd, v: man.views }); m.hist = h; }
      if (!await patch(it, { meta: m })) return; U.toast('Numbers saved'); open(it.id); render();
    }
  });
  document.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-cbstep]'); if (!c) return;
    const it = find(c.dataset.id); if (!it) return;
    const steps = { ...((it.meta || {}).steps || {}), [c.dataset.cbstep]: c.checked };
    const p = { meta: { ...it.meta, steps } };
    if (c.checked && (it.stage === 'approved' || it.stage === 'planned')) p.stage = 'production';
    if (!await patch(it, p)) { c.checked = !c.checked; return; }
    if (STEPS.every(([k]) => steps[k])) U.toast('All steps done. Move it to Published when it is live.');
    render();
  });
  let qT = null;
  document.addEventListener('input', (e) => {
    const q = e.target.closest('[data-cbq]'); if (!q) return;
    clearTimeout(qT); qT = setTimeout(() => { VS.bQ = q.value; const pos = q.selectionStart; render(); const n = document.querySelector('[data-cbq]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* fine */ } } }, 180);
  });

  // drag and drop: columns change the stage, calendar days change the date
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-cdrag]'); if (!c) return; e.dataTransfer.setData('text/x-cb', c.dataset.cdrag); e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('[data-cdrag]'); if (c) c.classList.remove('dragging'); document.querySelectorAll('.ccol.over,.ccal-d.over').forEach((x) => x.classList.remove('over')); });
  document.addEventListener('dragover', (e) => { const t = e.target.closest && e.target.closest('[data-cdrop],[data-cdate]'); if (!t || !e.dataTransfer.types.includes('text/x-cb')) return; e.preventDefault(); document.querySelectorAll('.ccol.over,.ccal-d.over').forEach((x) => x !== t && x.classList.remove('over')); t.classList.add('over'); });
  document.addEventListener('drop', async (e) => {
    const t = e.target.closest && e.target.closest('[data-cdrop],[data-cdate]'); if (!t) return; const id = e.dataTransfer.getData('text/x-cb'); if (!id) return; e.preventDefault();
    const it = find(id); if (!it) return;
    if (t.dataset.cdate) { const stage = it.stage === 'approved' ? 'planned' : it.stage; if (!await move(it, stage, t.dataset.cdate)) return; U.toast('Goes out ' + nice(t.dataset.cdate)); }
    else if (t.dataset.cdrop !== it.stage) { if (t.dataset.cdrop === 'suggested') { U.toast('Approved ideas stay approved'); render(); return; } const p = await move(it, t.dataset.cdrop); if (!p) return; U.toast('Moved to ' + SNAME[t.dataset.cdrop] + (p.publish_at && t.dataset.cdrop === 'planned' ? ', ' + nice(p.publish_at) : '')); if (t.dataset.cdrop === 'published') refreshStats(true); }
    render();
  });

  // other screens add pieces through this
  window.OSBoard = {
    load: (force=false) => isLive() ? load(force) : Promise.resolve(demoItems()),
    all: items,
    status: () => ({ loading: B.busy, error: B.err }),
    edit: async (id,p,expectedAt) => { const it=find(id);if(!it)throw new Error('Idea not found. Reload your queue.');return patch(it,p,true,expectedAt); },
    decide: async (id,stage,expectedAt) => {
      const it=find(id);if(!it)throw new Error('Idea not found. Reload your queue.');
      if(!['approved','passed','suggested'].includes(stage)||!['suggested','passed'].includes(it.stage))throw new Error('Review an idea in the Newsfeed before moving it.');
      if(isLive()){const k=ctx().ws.id;const row=await window.Auth.content.decide(k,id,stage,expectedAt||it.updated_at);if(ctx().ws.id!==k)return null;Object.assign(it,row);}
      else {it.stage=stage;it.updated_at=new Date().toISOString();it.meta={...it.meta,...(stage==='approved'?{approved_at:it.updated_at}:{}),decision:stage};}
      window.ContentLearning?.invalidate();return it;
    },
    add: (item) => create(item),
    open: async (id) => {
      if (isLive()) await load(true);
      if (!find(id)) throw new Error('That content piece is no longer available.');
      const queued=['suggested','passed'].includes(find(id).stage);
      VS.bView = 'board';
      VS.view = queued?'approvals':'content'; location.hash = '#'+VS.view; window.App.render(true);
      open(id);
    },
    inject: (rows) => { if (!isLive()) return; const have = new Set(B.items.map((x) => x.id)); B.items = rows.filter((r) => !have.has(r.id)).concat(B.items); },
    items: () => items().filter((x) => x.stage !== 'passed'),
    reset: () => { B.at = 0; },
    summary: () => { const l = items().filter((x) => x.stage !== 'passed'); return Object.fromEntries([['suggested'],...STAGES].map(([id]) => [id, l.filter((x) => x.stage === id).length])); },
  };
})();

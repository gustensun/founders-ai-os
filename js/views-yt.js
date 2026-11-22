// YouTube card for the Jarvis front page: channel totals, this month's uploads, how the latest videos
// compare with the channel median, and progress on a subscriber goal. Reads the YouTube connection's
// last sync. Before a channel is connected it shows the paste-a-link form.
(() => {
  const U = window.UI; const { esc } = U;
  const DAY = 864e5;
  const n = (v) => { const x = Number(v) || 0; return x >= 1e6 ? (Math.round(x / 1e5) / 10) + 'M' : x >= 1e4 ? (Math.round(x / 100) / 10) + 'K' : x.toLocaleString('en-US'); };
  const full = (v) => (Number(v) || 0).toLocaleString('en-US');
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (!Number.isFinite(m)) return ''; if (m < 60) return Math.max(1, m) + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d < 14 ? d + 'd ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const DEMO = { label: 'Avery Cole', meta: { last_sync_at: new Date(Date.now() - 2 * 36e5).toISOString(), median_views: 1992, channel: { subs: 12480, views: 1184300, videos: 186 }, analytics: { views: 58240, minutes: 341000 }, videos: [
    { id: "0Sjx3LW4uY4", title: "Highlevel Just Announced 300+ Feature Updates, These 5 Are The Biggest", views: 1702, x: 0.85, likes: 48, comments: 6, duration: 'PT18M42S', at: new Date(Date.now() - 11 * DAY).toISOString() },
    { id: "tRVSwxTJxDU", title: "How I'd Make $10,000/m if I Started Over in 2027", views: 1082, x: 0.54, likes: 25, comments: 2, duration: 'PT21M5S', at: new Date(Date.now() - 19 * DAY).toISOString() },
    { id: "pvs2YvFyke8", title: "The ONLY Grok Bot Tutorial You Need in 2026", views: 2762, x: 1.39, likes: 71, comments: 14, duration: 'PT16M20S', at: new Date(Date.now() - 22 * DAY).toISOString() },
    { id: "mfqKg8C774I", title: "AI Studio + GitHub NOW FINALLY LIVE in Highlevel!", views: 1007, x: 0.51, likes: 31, comments: 5, duration: 'PT12M8S', at: new Date(Date.now() - 26 * DAY).toISOString() },
    { id: "77NPS4qzUl0", title: "HIGHLEVEL JUST CHANGED THE GAME!! (again)", views: 1507, x: 0.76, likes: 40, comments: 9, duration: 'PT14M51S', at: new Date(Date.now() - 32 * DAY).toISOString() },
    { id: "OtdGngHM5MU", title: "1 Money Model + Highlevel = $10,000/m Business", views: 1453, x: 0.73, likes: 52, comments: 7, duration: 'PT19M30S', at: new Date(Date.now() - 33 * DAY).toISOString() },
    { id: "dFdULRWj_Qs", title: "Start This AI Business BEFORE 2027", views: 22113, x: 11.1, likes: 812, comments: 96, duration: 'PT23M12S', at: new Date(Date.now() - 39 * DAY).toISOString() },
    { id: "P91sYgrVlik", title: "How I Make $10K+ Per Month as an Affiliate", views: 1441, x: 0.72, likes: 44, comments: 8, duration: 'PT17M2S', at: new Date(Date.now() - 42 * DAY).toISOString() },
    { id: "DnN6J2-t72o", title: "Claude Opus 5.5 vs GPT Astra 6... INSANE!", views: 1168, x: 0.59, likes: 30, comments: 11, duration: 'PT13M40S', at: new Date(Date.now() - 46 * DAY).toISOString() },
    { id: "ZpC11khI4Dw", title: "GPT-6 Astra is Vibe Coding $10,000 Apps", views: 1527, x: 0.77, likes: 46, comments: 6, duration: 'PT20M18S', at: new Date(Date.now() - 60 * DAY).toISOString() },
    { id: "VwqNhhxP1LM", title: "I Designed This for Iman Gadhzi in 5 Mins w. GPT-6 Astra", views: 3830, x: 1.92, likes: 120, comments: 19, duration: 'PT11M45S', at: new Date(Date.now() - 63 * DAY).toISOString() },
    { id: "jlzrQ-Z4Pow", title: "GPT 6 ASTRA IS AMAZING AT WEB DESIGN!", views: 8772, x: 4.4, likes: 301, comments: 47, duration: 'PT15M33S', at: new Date(Date.now() - 64 * DAY).toISOString() },
  ] } };


  const REAL = (id) => /^[\w-]{11}$/.test(String(id || ''));
  const thumbOf = (v, big) => (big && REAL(v.id) ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : v.thumb || (REAL(v.id) ? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` : null));
  const xTag = (x) => { x = Number(x); return Number.isFinite(x) && x > 0 ? `<span class="yt-x${x >= 1.5 ? ' hot' : ''}" title="Views compared with your median video">${x >= 10 ? Math.round(x) : Math.round(x * 10) / 10}x</span>` : ''; };
  const img = (v, cls, big) => { const t = thumbOf(v, big); return t ? `<img class="${cls}" src="${esc(t)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="ph:${cls} ph">` : `<span class="${cls} ph" aria-hidden="true"></span>`; };
  function row(v) {
    return `<button type="button" class="row yt-v" data-action="yt-open" data-id="${esc(v.id)}">${img(v, 'yt-th')}<span class="grow"><span class="yt-vt">${esc(v.title || 'Untitled')}</span><span class="meta">${full(v.views)} views · ${ago(v.at)}</span></span>${xTag(v.x)}</button>`;
  }

  function subsGoal() {
    try { return (window.OSGoals2.all() || []).find((g) => g.area === 'channel' && g.ref === 'youtube' && g.metric === 'subs' && !g.done) || null; } catch { return null; }
  }
  function body(meta, label) {
    const ch = meta.channel || {}; const vids = Array.isArray(meta.videos) ? meta.videos : [];
    const month = vids.filter((v) => v.at && Date.now() - Date.parse(v.at) < 30 * DAY);
    const an = meta.analytics && !meta.analytics.error && meta.analytics.views != null ? meta.analytics : null;
    const recentViews = month.reduce((s, v) => s + (v.views || 0), 0);
    const stats = [
      ['Subscribers', n(ch.subs), full(ch.subs) + ' subscribers'],
      [an ? 'Views, 28 days' : 'Total views', n(an ? an.views : ch.views), ''],
      [an ? 'Watch hours, 28 days' : 'Videos', an ? n(Math.round(an.minutes / 60)) : n(ch.videos), ''],
      ['Uploads, 30 days', String(month.length), month.length ? full(recentViews) + ' views on them so far' : ''],
    ];
    const g = subsGoal();
    const goal = g ? `<div class="yt-goal"><div class="yt-goal-t"><span>${esc(g.label)}</span><span class="meta">${full(Math.max(0, g.target - g.now))} to go${g.daysLeft != null && g.daysLeft >= 0 ? ' · ' + g.daysLeft + ' days left' : ''}</span></div>${window.OSGoals.bar(g.p, g.elapsed)}</div>` : '';
    const list = vids.slice(0, 4).map((v) => row(v)).join('');
    return `<div class="yt-stats">${stats.map(([l, v, t]) => `<div${t ? ` title="${esc(t)}"` : ''}><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      ${goal}
      ${list ? `<h3 class="yt-sub"><span>Latest uploads${meta.median_views ? ` <span class="meta">· median ${full(meta.median_views)} views</span>` : ''}</span>${vids.length > 4 ? `<button class="linkish meta" data-action="yt-all">All ${vids.length} uploads</button>` : ''}</h3><div class="rows">${list}</div>` : ''}
      ${meta.sync_error ? `<p class="auth-msg">${esc(meta.sync_error)}</p>` : ''}`;
  }
  // live: from the workspace connection; demo: the sample channel
  function card(opts) {
    const live = !!(opts && opts.live);
    const c = live ? (window.App.liveCtx().conns || []).find((x) => x.provider === 'youtube') : { status: 'connected', account_label: DEMO.label, meta: DEMO.meta };
    const head = (right) => `<header><h2>YouTube${c && c.account_label ? ' · ' + esc(c.account_label) : ''}</h2>${right || ''}</header>`;
    if (!c || c.status !== 'connected' || !c.meta || !c.meta.channel) {
      const ready = window.Conn && window.Conn.ytReady && window.Conn.ytReady();
      if (!ready && window.Conn && window.Conn.catalog) window.Conn.catalog().then(() => { if (window.Conn.ytReady() && document.querySelector('.yt-card [data-yt-wait]')) window.App.render(true); }).catch(() => {});
      return `<section class="panel yt-card">${head()}<p class="muted">Paste your channel link and Jarvis keeps subscribers, views and every new upload here, with your best videos flagged.</p>${ready ? window.Conn.ytForm('youtube', true) : '<p class="meta" data-yt-wait>One moment.</p>'}</section>`;
    }
    const m = c.meta;
    return `<section class="panel yt-card">${head(`<button class="linkish meta" data-action="${live ? 'cx' : 'go'}" data-${live ? 'id' : 'go'}="${live ? 'youtube' : 'brand'}">${m.last_sync_at ? 'Synced ' + esc(ago(m.last_sync_at)) : 'Details'}</button>`)}${body(m, c.account_label)}</section>`;
  }

  /* ---------- the video card: one upload, every number we have, and the way to remix it ---------- */
  const ACT = window.ACT; const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const extra = {}; // video id -> { description, tags, duration, views, likes, comments } fetched on open
  const RX = {}; // video id -> { remix, by, page, note }
  function conn() { return isLive() ? (ctx().conns || []).find((x) => x.provider === 'youtube' && x.status === 'connected') : { meta: DEMO.meta, account_label: DEMO.label }; }
  function allVideos() { const c = conn(); return c && c.meta && Array.isArray(c.meta.videos) ? c.meta.videos : []; }
  const find = (id) => allVideos().find((v) => String(v.id) === String(id));
  const dur = (iso) => { const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m) return ''; const h = +m[1] || 0, mi = +m[2] || 0, se = +m[3] || 0; return h ? `${h}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}` : `${mi}:${String(se).padStart(2, '0')}`; };
  const isShort = (iso) => { const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m && !m[1] && (+m[2] || 0) * 60 + (+m[3] || 0) <= 180; };
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const R = () => window.Remix;
  const aiOn = () => isLive() && (ctx().conns || []).some((c) => (c.provider === 'claude' || c.provider === 'openai' || c.provider === 'perplexity') && c.status === 'connected');

  function bars(vids, cur, med) {
    const list = vids.filter((v) => v.at).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    if (list.length < 3) return '';
    const max = Math.max(...list.map((v) => v.views || 0), 1); const h = (n) => Math.max(3, Math.round(Math.sqrt((n || 0) / max) * 100));
    return `<div class="yt-bars" role="list" aria-label="Views on your last ${list.length} uploads, oldest first">${med ? `<span class="yt-med" style="bottom:${h(med)}%" title="Your median, ${full(med)} views"></span>` : ''}${list.map((v) => `<button type="button" role="listitem" class="yt-bar${String(v.id) === String(cur.id) ? ' on' : ''}${Number(v.x) >= 2 ? ' hot' : ''}" style="height:${h(v.views)}%" data-action="yt-open" data-id="${esc(v.id)}" data-swap="1" title="${esc(v.title)}: ${full(v.views)} views" aria-label="${esc(v.title)}, ${full(v.views)} views"></button>`).join('')}</div>
      <p class="meta yt-bars-l"><span>Your last ${list.length} uploads by views, oldest first</span>${med ? `<span>Line: median ${full(med)}</span>` : ''}</p>`;
  }
  function videoCard(v) {
    const c = conn(); const m = (c && c.meta) || {}; const vids = allVideos(); const e = extra[v.id] || {};
    const views = e.views != null ? e.views : v.views; const likes = e.likes != null ? e.likes : v.likes; const comments = e.comments != null ? e.comments : v.comments;
    const days = v.at ? Math.max(1, (Date.now() - Date.parse(v.at)) / DAY) : null;
    const rank = vids.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).findIndex((x) => String(x.id) === String(v.id)) + 1;
    const len = dur(e.duration || v.duration);
    const pat = R() ? R().pattern(v.title) : null;
    const perf = R() && pat ? R().channelPatterns(vids).find((p) => p.id === pat.id) : null;
    const tiles = [
      ['Views', full(views), m.median_views ? (Number(v.x) ? (Math.round(v.x * 10) / 10) + 'x your median' : '') : ''],
      ['Likes', full(likes), views ? pct(likes, views) + '% of viewers' : ''],
      ['Comments', full(comments), views ? Math.round((comments / views) * 10000) / 10 + ' per 1,000 views' : ''],
      ['Views per day', days ? full(Math.round(views / days)) : '\u2013', days ? 'over ' + Math.round(days) + ' days' : ''],
      ['Rank', rank ? '#' + rank : '\u2013', rank ? 'of your last ' + vids.length + ' uploads' : ''],
      ['Length', len || '\u2013', len ? (isShort(e.duration || v.duration) ? 'Short' : 'Long form') : ''],
    ];
    const verdict = Number(v.x) >= 2 ? 'An outlier for you. The topic already proved itself, so a new angle on it is the safest next video.' : Number(v.x) >= 1 ? 'Above your median. The topic works; a sharper angle could take it further.' : Number(v.x) > 0 ? 'Below your median. The topic may still be good. Remix tries it with a different angle and hook.' : '';
    const href = REAL(v.id) ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}` : null;
    return `<div class="yt-hero">${href ? `<a class="yt-big" href="${href}" target="_blank" rel="noopener" aria-label="Watch on YouTube">${img(v, 'yt-bigimg', true)}<span class="yt-play" aria-hidden="true"></span>${len ? `<span class="yt-len">${esc(len)}</span>` : ''}</a>` : `<div class="yt-big">${img(v, 'yt-bigimg', true)}</div>`}</div>
      <div><p class="meta">${v.at ? 'Published ' + new Date(v.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + (/ago$/.test(ago(v.at)) ? ' · ' + ago(v.at) : '') : 'Your upload'}</p><h2 class="yt-dt">${esc(v.title || 'Untitled')}</h2></div>
      <div class="actions yt-acts"><button class="btn primary" data-action="yt-remix" data-id="${esc(v.id)}" data-autofocus>${U.icon('refresh')}Remix</button>${href ? `<a class="btn" href="${href}" target="_blank" rel="noopener">Open on YouTube</a>` : ''}</div>
      <div class="yt-tiles">${tiles.map(([l, val, sub]) => `<div><span class="meta">${esc(l)}</span><b>${esc(val)}</b>${sub ? `<span class="meta">${esc(sub)}</span>` : ''}</div>`).join('')}</div>
      ${verdict ? `<p class="evidence">${esc(verdict)}</p>` : ''}
      ${bars(vids, v, m.median_views)}
      ${pat ? `<div class="dsec"><h3>Angle</h3><p><b>${esc(pat.name)}.</b> ${esc(pat.why)}</p>${perf ? `<p class="meta">${perf.n} of your last ${vids.length} uploads use this angle. They average ${perf.avg}x your median.</p>` : ''}</div>` : ''}
      ${e.description ? `<div class="dsec"><h3>Description</h3><p class="yt-desc">${esc(e.description)}</p></div>` : ''}
      ${e.tags && e.tags.length ? `<div class="dsec"><h3>Tags</h3><div class="yt-tags">${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${!isLive() ? '<p class="meta">Sample numbers. Your connected channel shows its own.</p>' : e.at ? `<p class="meta">Numbers fresh from YouTube ${esc(ago(e.at))}.</p>` : '<p class="meta" data-yt-fresh>Getting fresh numbers from YouTube.</p>'}`;
  }
  function openVideo(id, swap) {
    const v = find(id); if (!v) return;
    U.drawer(videoCard(v), { label: 'Video', wide: true, push: false });
    if (!isLive() || extra[id] || !REAL(id) || !window.Conn) return;
    window.Conn.api('yt-videos', { ids: [id] }).then((r) => {
      const x = (r.videos || [])[0]; if (!x) return;
      extra[id] = { description: x.description || '', tags: x.tags || [], duration: x.duration, views: x.views, likes: x.likes, comments: x.comments, at: r.at };
      const d = document.querySelector('#drawer.open'); if (d && d.querySelector(`[data-action="yt-remix"][data-id="${CSS.escape(id)}"]`)) U.drawer(videoCard(v), { label: 'Video', wide: true });
    }).catch(() => { const f = document.querySelector('#drawer [data-yt-fresh]'); if (f) f.textContent = 'Showing the numbers from the last sync.'; });
  }
  function allDrawer() {
    const vids = allVideos();
    U.drawer(`<div><p class="meta">YouTube</p><h2>Your last ${vids.length} uploads</h2><p class="muted">Open any video for its numbers, or remix it into new videos on the same topic.</p></div>
      <div class="yt-grid">${vids.map((v) => `<button type="button" class="yt-gi" data-action="yt-open" data-id="${esc(v.id)}">${img(v, 'yt-gimg')}<span class="yt-gt">${esc(v.title || 'Untitled')}</span><span class="meta">${n(v.views)} views · ${ago(v.at)} ${xTag(v.x)}</span></button>`).join('')}</div>`, { label: 'Uploads', wide: true });
  }

  /* ---------- Remix: same topic, new angle, new hook, new title ---------- */
  function own() { try { const d = window.DNA.data(); return window.DNA.offersFor(d); } catch { return { offers: [], funnels: [] }; } }
  function rulesRemix(v, page) { const all = R().remixOwn(v, own(), allVideos(), 8); const p = page % 2; return { ...all, ideas: all.ideas.slice(p * 4, p * 4 + 4) }; }
  function ideaCard(v, it, k) {
    return `<article class="yt-idea"><header><span class="tag">${esc(it.pattern.name)}</span><span class="meta">Idea ${k + 1}</span></header>
      <h3>${esc(it.title)}</h3>${it.alts && it.alts.length ? `<p class="meta">Or: ${it.alts.map(esc).join(' · ')}</p>` : ''}
      <p class="yt-hook"><span class="meta">Hook</span>${esc(it.hook)}</p>
      ${it.outline && it.outline.length ? `<details><summary>Outline, ${it.outline.length} beats</summary><ol class="pv-ol">${it.outline.map((b) => `<li>${esc(b)}</li>`).join('')}</ol></details>` : ''}
      ${it.why || it.evidence ? `<p class="meta">${esc([it.why, it.evidence].filter(Boolean).join(' '))}</p>` : ''}
      <div class="actions"><button class="btn sm" data-action="yt-idea" data-id="${esc(v.id)}" data-k="${k}">Send to Ideas</button><button class="btn sm ghost" data-action="yt-copy1" data-id="${esc(v.id)}" data-k="${k}">Copy</button></div></article>`;
  }
  function remixHtml(v, st) {
    const r = st.remix;
    return `<div><p class="meta">Remix · same topic, new angle</p><h2>${esc(r.topic.charAt(0).toUpperCase() + r.topic.slice(1))}</h2></div>
      <div class="yt-src">${img(v, 'yt-th')}<span class="grow"><span class="yt-vt">${esc(v.title)}</span><span class="meta">${esc(r.source.pattern.name)}${r.source.stat ? ' · ' + esc(r.source.stat) : ''}</span></span></div>
      ${st.note ? `<p class="evidence">${esc(st.note)}</p>` : ''}
      <div class="yt-ideas">${r.ideas.map((it, k) => ideaCard(v, it, k)).join('')}</div>
      <p class="meta">${st.by && st.by !== 'Rules' ? 'Written by ' + esc(st.by) + ' from your Brand DNA, how you write, and how each angle does on your channel.' : isLive() && !aiOn() ? 'Built from your channel patterns. Connect Claude, OpenAI or Perplexity and Remix writes these in your voice from your Brand DNA.' : 'Built from your channel patterns and your Brand DNA.'}${r.cta ? ' Sells ' + esc(r.cta) + '.' : ''}</p>
      <div class="actions"><button class="btn primary" data-action="yt-ideas-all" data-id="${esc(v.id)}">Send all ${r.ideas.length} to Ideas</button><button class="btn" data-action="yt-remix" data-id="${esc(v.id)}" data-again="1">New angles</button><button class="btn ghost" data-action="yt-copy" data-id="${esc(v.id)}">Copy all</button></div>`;
  }
  async function remix(v, again) {
    const prev = RX[v.id]; const page = again && prev ? (prev.page || 0) + 1 : 0;
    if (!again && prev) { U.drawer(remixHtml(v, prev), { label: 'Remix', wide: true, push: true }); return; }
    if (!aiOn()) { RX[v.id] = { remix: rulesRemix(v, page), by: 'Rules', page }; U.drawer(remixHtml(v, RX[v.id]), { label: 'Remix', wide: true, push: !again }); return; }
    U.drawer(`<div><p class="meta">Remix · same topic, new angle</p><h2>${esc(v.title)}</h2></div><div class="yt-wait">${U.spin}<span>Writing ${again ? 'four more' : 'four'} new angles in your voice. This takes about half a minute.</span></div>`, { label: 'Remix', wide: true, push: !again });
    try {
      const vids = allVideos().map((x) => ({ title: x.title, x: x.x, views: x.views }));
      const r = await window.Auth.brainApi('yt-remix', { workspace_id: ctx().ws.id, video: { id: v.id, title: v.title, views: v.views, likes: v.likes, comments: v.comments, x: v.x, at: v.at }, videos: vids, again: !!again });
      RX[v.id] = { remix: r.remix, by: r.by, page, note: r.note || null };
    } catch (e) { RX[v.id] = { remix: rulesRemix(v, page), by: 'Rules', page, note: 'The AI could not answer just now (' + window.Auth.friendly(e) + '). These come from your channel patterns.' }; }
    const d = document.querySelector('#drawer.open'); if (d && d.querySelector('.yt-wait')) U.drawer(remixHtml(v, RX[v.id]), { label: 'Remix', wide: true });
  }
  async function toBoard(v, it) {
    const st = RX[v.id];
    return window.OSBoard.add({ title: it.title, stage: 'suggested', channel: 'youtube', format: 'long', meta: { hook: it.hook, outline: it.outline, pattern: it.pattern.name, alts: it.alts, why: [it.why, it.evidence].filter(Boolean).join(' '), from: v.title, source_video: REAL(v.id) ? v.id : null, source_url: REAL(v.id) ? 'https://www.youtube.com/watch?v=' + v.id : null, remix_of: 'own', by: st && st.by, offer: st && st.remix.offer ? st.remix.offer.name : null } });
  }
  const oneText = (v, it) => [it.title, it.alts && it.alts.length ? 'Or: ' + it.alts.join(' / ') : '', 'Angle: ' + it.pattern.name, 'Hook: ' + it.hook, ...(it.outline || []).map((b, j) => `${j + 1}. ${b}`), it.why ? 'Why: ' + it.why : '', 'Remix of: ' + v.title].filter(Boolean).join('\n');
  if (ACT) {
    ACT['yt-open'] = (el) => openVideo(el.dataset.id, !!el.dataset.swap);
    ACT['yt-all'] = () => allDrawer();
    ACT['yt-remix'] = (el) => { const v = find(el.dataset.id); if (v) remix(v, !!el.dataset.again); };
    ACT['yt-idea'] = async (el) => {
      const v = find(el.dataset.id); const st = RX[el.dataset.id]; const it = st && st.remix.ideas[+el.dataset.k]; if (!v || !it) return;
      el.disabled = true;
      try { await toBoard(v, it); el.textContent = 'In Ideas'; U.toast('In Ideas to approve on the content board'); } catch (e) { el.disabled = false; U.toast(window.Auth.friendly(e)); }
    };
    ACT['yt-ideas-all'] = async (el) => {
      const v = find(el.dataset.id); const st = RX[el.dataset.id]; if (!v || !st) return;
      el.disabled = true; el.innerHTML = U.spin + 'Adding';
      try { for (const it of st.remix.ideas.slice().reverse()) await toBoard(v, it); document.querySelectorAll('#drawer [data-action="yt-idea"]').forEach((b) => { b.disabled = true; b.textContent = 'In Ideas'; }); el.textContent = 'All in Ideas'; U.toast(st.remix.ideas.length + ' ideas in Ideas to approve'); }
      catch (e) { el.disabled = false; el.textContent = 'Send all to Ideas'; U.toast(window.Auth.friendly(e)); }
    };
    ACT['yt-copy1'] = (el) => { const v = find(el.dataset.id); const st = RX[el.dataset.id]; const it = st && st.remix.ideas[+el.dataset.k]; if (v && it) U.copy(oneText(v, it)); };
    ACT['yt-copy'] = (el) => { const st = RX[el.dataset.id]; if (st) U.copy(R().ownText(st.remix)); };
  }
  window.OSYT = { card, open: openVideo, videos: () => allVideos(), remix: (id) => { const v = find(id); if (v) remix(v); } };
  // A channel connected from this card: redraw the page with the numbers.
  document.addEventListener('submit', (e) => { if (e.target.closest('.yt-card [data-ytform]')) setTimeout(() => window.App.render(true), 50); });
})();

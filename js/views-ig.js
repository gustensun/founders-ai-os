// Instagram card for the Jarvis front page, next to YouTube: followers, 30-day reach, impressions and new
// followers from HighLevel Social Planner, who the audience is, and the latest posts from the public profile.
// Reads the Instagram connection's last sync. Before it is connected it points to Connections.
(() => {
  const U = window.UI; const { esc } = U;
  const DAY = 864e5;
  const n = (v) => { const x = Number(v) || 0; return x >= 1e6 ? (Math.round(x / 1e5) / 10) + 'M' : x >= 1e4 ? (Math.round(x / 100) / 10) + 'K' : x.toLocaleString('en-US'); };
  const full = (v) => (Number(v) || 0).toLocaleString('en-US');
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (!Number.isFinite(m)) return ''; if (m < 60) return Math.max(1, m) + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d < 14 ? d + 'd ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const DEMO = { label: '@averycole · through HighLevel', meta: { via: 'highlevel', last_sync_at: new Date(Date.now() - 3 * 36e5).toISOString(),
    profile: { username: 'averycole', followers: 6920, posts: 410, new_followers_30d: 168, reach_30d: 18400, impressions_30d: 49800, engagement_30d: 1960, audience: '68% men, most are 25-34' },
    posts: [
      { t: 'The 3 pages every one-person business needs before it runs a single ad', likes: 1240, comments: 86, at: new Date(Date.now() - 1 * DAY).toISOString(), type: 'Video', url: 'https://www.instagram.com/' },
      { t: 'I rebuilt a client funnel in HighLevel in 40 minutes. Here is the order I do it in', likes: 860, comments: 41, at: new Date(Date.now() - 4 * DAY).toISOString(), type: 'Sidecar', url: 'https://www.instagram.com/' },
      { t: 'Stop selling your time. Sell the system you already use', likes: 2310, comments: 142, at: new Date(Date.now() - 8 * DAY).toISOString(), type: 'Video', url: 'https://www.instagram.com/' },
      { t: 'What a $27 offer actually does for a high-ticket business', likes: 640, comments: 33, at: new Date(Date.now() - 12 * DAY).toISOString(), type: 'Image', url: 'https://www.instagram.com/' },
    ] } };

  const kind = (t) => (t === 'Video' ? 'Reel' : t === 'Sidecar' ? 'Carousel' : 'Post');
  const img = (p) => p.thumb ? `<img class="yt-th ig-th" src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="ph:yt-th ig-th ph">` : '<span class="yt-th ig-th ph" aria-hidden="true"></span>';
  function row(p, avg) {
    const hot = avg && p.likes >= avg * 1.5;
    return `<a class="row yt-v" href="${esc(p.url || 'https://www.instagram.com/')}" target="_blank" rel="noopener">${img(p)}<span class="grow"><span class="yt-vt">${esc(p.t || kind(p.type))}</span><span class="meta">${kind(p.type)} · ${full(p.likes)} likes · ${full(p.comments)} comments · ${ago(p.at)}</span></span>${hot ? `<span class="yt-x hot" title="Likes compared with your average post">${Math.round((p.likes / avg) * 10) / 10}x</span>` : ''}</a>`;
  }
  function followGoal() {
    try { return (window.OSGoals2.all() || []).find((g) => g.area === 'channel' && g.ref === 'instagram' && g.metric === 'followers' && !g.done) || null; } catch { return null; }
  }
  function body(meta) {
    const p = meta.profile || {}; const posts = (Array.isArray(meta.posts) ? meta.posts : []).filter((x) => !x.pinned).concat((meta.posts || []).filter((x) => x.pinned)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const avg = posts.length ? posts.reduce((s, x) => s + (x.likes || 0), 0) / posts.length : 0;
    const stats = [
      p.followers != null ? ['Followers', n(p.followers), full(p.followers) + ' followers'] : ['Posts, 30 days', String(posts.filter((x) => Date.now() - Date.parse(x.at) < 30 * DAY).length), ''],
      ['Reach, 30 days', n(p.reach_30d), full(p.reach_30d) + ' accounts reached'],
      ['Impressions, 30 days', n(p.impressions_30d), full(p.impressions_30d) + ' impressions'],
      ['New followers, 30 days', n(p.new_followers_30d), ''],
    ];
    const g = followGoal();
    const goal = g ? `<div class="yt-goal"><div class="yt-goal-t"><span>${esc(g.label)}</span><span class="meta">${full(Math.max(0, g.target - g.now))} to go${g.daysLeft != null && g.daysLeft >= 0 ? ' · ' + g.daysLeft + ' days left' : ''}</span></div>${window.OSGoals.bar(g.p, g.elapsed)}</div>` : '';
    const line = [p.engagement_30d != null ? full(p.engagement_30d) + ' likes, comments and shares in 30 days' : null, p.audience ? 'audience ' + p.audience : null].filter(Boolean).join(' · ');
    return `<div class="yt-stats">${stats.map(([l, v, t]) => `<div${t ? ` title="${esc(t)}"` : ''}><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      ${line ? `<p class="meta ig-line">${esc(line.charAt(0).toUpperCase() + line.slice(1))}</p>` : ''}
      ${goal}
      ${posts.length ? `<h3 class="yt-sub"><span>Latest posts</span></h3><div class="rows">${posts.slice(0, 4).map((x) => row(x, avg)).join('')}</div>` : '<p class="meta">Connect Apify to see your follower count and latest posts here.</p>'}
      ${meta.sync_error ? `<p class="auth-msg">${esc(meta.sync_error)}</p>` : ''}`;
  }
  function card(opts) {
    const live = !!(opts && opts.live);
    const c = live ? (window.App.liveCtx().conns || []).find((x) => x.provider === 'instagram') : { status: 'connected', account_label: DEMO.label, meta: DEMO.meta };
    const handle = c && c.meta && ((c.meta.profile && c.meta.profile.username) || c.meta.username);
    const head = (right) => `<header><h2>Instagram${handle ? ' · @' + esc(handle) : ''}</h2>${right || ''}</header>`;
    if (!c || c.status !== 'connected' || !c.meta || !c.meta.profile) {
      return `<section class="panel yt-card ig-card">${head()}<p class="muted">Connect Instagram and Jarvis keeps followers, reach and your latest posts here. If it is already in HighLevel Social Planner, no Meta app is needed.</p><button class="btn" data-action="go" data-go="connect">Connect Instagram</button></section>`;
    }
    const m = c.meta;
    return `<section class="panel yt-card ig-card">${head(`<button class="linkish meta" data-action="${live ? 'cx' : 'go'}" data-${live ? 'id' : 'go'}="${live ? 'instagram' : 'brand'}">${m.last_sync_at ? 'Synced ' + esc(ago(m.last_sync_at)) : 'Details'}</button>`)}${body(m)}</section>`;
  }
  window.OSIG = { card, demo: () => DEMO.meta };
})();

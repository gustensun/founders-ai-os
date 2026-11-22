// Founders AI OS: Creators. A watchlist of the creators the founder learns from on Instagram, YouTube,
// X, LinkedIn, Facebook and newsletters. Video posts rank by views, written posts by reactions, both by outlier score. Posts come from the founder's own Apify account. The demo uses sample numbers.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const render = () => window.App.render(true);
  const DAY = 864e5;

  const FMT = { reel: 'Reels', carousel: 'Carousels', photo: 'Photos', video: 'Videos', short: 'Shorts', x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', newsletter: 'Newsletters' };
  const ONE = { reel: 'Reel', carousel: 'Carousel', photo: 'Photo', video: 'Video', short: 'Short', post: 'Post', essay: 'Essay' };
  const PNAME = { instagram: 'Instagram', youtube: 'YouTube', x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', newsletter: 'their newsletter' };
  // On the Written tab the "format" filter picks the channel, since every written post is a post.
  const PLAT_FMTS = { instagram: ['reel', 'carousel', 'photo'], youtube: ['video', 'short'], written: ['x', 'linkedin', 'facebook', 'newsletter'] };
  const WRITTEN = ['x', 'linkedin', 'facebook', 'newsletter'];
  const isW = (p) => WRITTEN.includes(p.platform);
  const viewsFmt = (f) => f !== 'carousel' && f !== 'photo' && f !== 'post' && f !== 'essay';
  const reactions = (p) => { const t = (p.likes || 0) + (p.comments || 0) + (p.shares || 0); return p.likes == null && p.comments == null && p.shares == null ? null : t; };
  const REACT_STEPS = [[0, 'Any'], [100, '100+'], [500, '500+'], [1e3, '1K+'], [5e3, '5K+']];
  const VIEW_STEPS = [[0, 'Any'], [1e5, '100K+'], [5e5, '500K+'], [1e6, '1M+'], [5e6, '5M+']];
  const LIKE_STEPS = [[0, 'Any'], [1e4, '10K+'], [5e4, '50K+'], [1e5, '100K+'], [5e5, '500K+']];
  const fmtN = (n) => (n == null ? '\u2013' : n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n)));
  const dur = (s) => (s == null ? '' : s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: Date.now() - Date.parse(iso) > 300 * DAY ? 'numeric' : undefined }) : '');
  const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  Object.assign(VS, { crPlat: VS.crPlat || 'instagram', crFmt: VS.crFmt || 'all', crMin: VS.crMin || 0, crPeriod: VS.crPeriod == null ? 365 : VS.crPeriod, crSort: VS.crSort || 'views', crWho: VS.crWho || 'all', crPicks: VS.crPicks || 0 });
  VS.crSaved = VS.crSaved || {};
  // Where each channel lives on a creator row, and which run preset refreshes it.
  const CH = {
    instagram: { key: 'ig_handle', at: 'ig_synced_at', fol: 'ig_followers', folTxt: 'followers', preset: 'creator-ig', link: (c) => 'https://www.instagram.com/' + c.ig_handle + '/', show: (c) => '@' + c.ig_handle },
    youtube: { key: 'yt_url', at: 'yt_synced_at', fol: 'yt_subscribers', folTxt: 'subscribers', preset: 'creator-yt', link: (c) => c.yt_url, show: (c) => c.yt_url.replace(/^https:\/\/(www\.|m\.)?youtube\.com\//, '') },
    x: { key: 'x_handle', at: 'x_synced_at', fol: 'x_followers', folTxt: 'followers', preset: 'creator-x', link: (c) => 'https://x.com/' + c.x_handle, show: (c) => '@' + c.x_handle },
    linkedin: { key: 'li_url', at: 'li_synced_at', preset: 'creator-li', link: (c) => c.li_url, show: (c) => c.li_url.replace(/^https:\/\/www\.linkedin\.com\//, '').replace(/\/$/, '') },
    facebook: { key: 'fb_url', at: 'fb_synced_at', preset: 'creator-fb', link: (c) => c.fb_url, show: (c) => c.fb_url.replace(/^https:\/\/www\.facebook\.com\//, '') },
    newsletter: { key: 'news_url', at: 'news_synced_at', preset: 'creator-news', link: (c) => c.news_url, show: (c) => c.news_url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '') },
  };
  const channelsOf = (c) => Object.keys(CH).filter((k) => c[CH[k].key]);
  const hasPlat = (c, plat) => (plat === 'written' ? WRITTEN.some((k) => c[CH[k].key]) : !!c[CH[plat].key]);

  /* ---------- demo: sample creators and numbers ---------- */
  const DEMO_CREATORS = [
    ['Alex Hormozi', 'hormozi', 'https://www.youtube.com/@AlexHormozi', 1.0],
    ['Gary Vaynerchuk', 'garyvee', 'https://www.youtube.com/@garyvee', 0.55],
    ['Leila Hormozi', 'leilahormozi', 'https://www.youtube.com/@LeilaHormozi', 0.38],
    ['Codie Sanchez', 'codiesanchez', 'https://www.youtube.com/@CodieSanchezCT', 0.42],
    ['Iman Gadzhi', 'imangadzhi', 'https://www.youtube.com/@ImanGadzhi', 0.5],
  ];
  // Writers who mostly publish text. Sample handles and sample numbers only.
  const DEMO_WRITERS = [
    ['Justin Welsh', { x_handle: 'thejustinwelsh', li_url: 'https://www.linkedin.com/in/justinwelsh/', news_url: 'https://justinwelsh.me/', news_kind: 'rss', x_followers: 594000 }, 1.0],
    ['Sahil Bloom', { x_handle: 'SahilBloom', li_url: 'https://www.linkedin.com/in/sahilbloom/', news_url: 'https://www.sahilbloom.com/newsletter', news_kind: 'substack', x_followers: 1100000 }, 0.85],
    ['Dan Koe', { x_handle: 'thedankoe', news_url: 'https://thedankoe.com/letters/', news_kind: 'rss', x_followers: 820000 }, 0.7],
  ];
  const W_HOOKS = [
    'Most people do not need more ideas. They need fewer, finished.', 'I wrote online for 7 years. Here is what actually moved the needle.', 'Your first product should take a weekend to build.',
    'The best time to raise your prices was last month.', 'A one-person business is a set of systems, not a person working harder.', 'Write the post you wish someone had sent you five years ago.',
    'Stop asking what to post. Ask what you keep explaining in DMs.', 'I turned down a $1M offer. The reason surprised me.', 'Consistency is a scheduling problem, not a willpower problem.',
    'Nobody remembers your post. They remember how often you showed up.', 'The 3 numbers I check every Monday morning.', 'Build an audience before you build a product. Here is the order I used.',
    'You do not need a niche. You need a point of view.', 'Simple beats clever in every sales page I have tested.', 'The hardest part of working alone is deciding what not to do.',
    'I post once a day and work 4 hours. This is the whole system.', 'If your content sounds like everyone else, it reads like nobody.', 'Here is the template I use for every long post.',
    'Most advice is someone describing their own luck.', 'One newsletter a week built my whole business.', 'The real cost of saying yes to every client.',
    'Your offer is confusing if you need a call to explain it.', 'I keep a list of every question my audience asks. It writes my content.', 'Rest is part of the work. Schedule it first.',
  ];
  const W_LINES = ['Here is what I learned:', 'Three things changed everything:', 'Most people skip this part.', 'It sounds simple. It is not easy.', 'The fix took me ten minutes.', 'Save this for later.'];
  const HOOKS = [
    'How to price your first offer', 'The one skill that pays forever', 'Why your business is stuck at 10K a month', 'Stop doing this if you want to scale', 'What I would do with 1,000 dollars today',
    'The real reason most people never start', 'How to make your offer impossible to refuse', 'Hiring your first employee, the honest version', 'The content strategy I wish I knew at 25', 'Lead magnets that actually convert',
    'Do the boring work for longer', 'How to sell without being salesy', 'Volume beats talent until talent works', 'Three numbers every founder should know', 'Raise your prices and keep your customers',
    'The fastest way to get your first 10 clients', 'Your first 100K, step by step', 'Burnout is a pricing problem', 'Why I would never buy a franchise', 'Build the business you would want to buy',
    'Patience is a competitive advantage', 'How to run a one-person business that feels calm', 'The difference between busy and productive', 'Give away the secrets, sell the implementation', 'What rich people do with their mornings',
    'How to grow on Instagram from zero', 'The hook formula behind my biggest videos', 'Why consistency beats virality', 'Buy a boring business', 'Your network is a lagging indicator',
    'Negotiate like you can walk away', 'The two-hour content day', 'Retention is the new acquisition', 'Make more offers', 'Stop chasing motivation',
  ];
  const CAROUSEL_HOOKS = ['7 lessons from 10 years in business', 'The offer checklist', 'How I plan a week', 'Pricing in one slide', 'The hiring scorecard', '10 hooks you can steal', 'The money model, explained', 'What to do in your first 90 days', 'Books that changed how I sell', 'My content workflow'];
  let SEED = 7; const rnd = () => ((SEED = (SEED * 16807) % 2147483647) - 1) / 2147483646;
  const logn = (med, spread) => Math.round(med * Math.exp((rnd() + rnd() + rnd() - 1.5) * spread));
  let DEMO = null;
  function demo() {
    if (DEMO) return DEMO;
    SEED = 7; const now = Date.now(); const creators = [], posts = [];
    DEMO_CREATORS.forEach(([name, ig, yt, k], ci) => {
      const id = 'cr' + ci; creators.push({ id, name, ig_handle: ig, yt_url: yt, ig_synced_at: new Date(now - (ci + 2) * 36e5).toISOString(), yt_synced_at: new Date(now - (ci + 5) * 36e5).toISOString() });
      for (let i = 0; i < 34; i++) {
        const r = rnd(); const format = r < 0.62 ? 'reel' : r < 0.9 ? 'carousel' : 'photo';
        const views = format === 'reel' ? logn(900000 * k, 2.1) : null; const likes = format === 'reel' ? Math.round(views * (0.02 + rnd() * 0.03)) : logn(60000 * k, 1.6);
        const title = format === 'carousel' ? CAROUSEL_HOOKS[(i + ci * 3) % CAROUSEL_HOOKS.length] : HOOKS[(i * 3 + ci * 5) % HOOKS.length];
        posts.push({ id: `${id}i${i}`, creator_id: id, platform: 'instagram', format, ext_id: `${id}i${i}`, url: 'https://www.instagram.com/' + ig + '/', title, views, likes, comments: Math.round(likes * (0.006 + rnd() * 0.02)), duration_s: format === 'reel' ? 15 + Math.round(rnd() * 70) : null, posted_at: new Date(now - (i * 6 + rnd() * 5 + 1) * DAY * (1 + ci * 0.05)).toISOString(), picked: false });
      }
      for (let i = 0; i < 30; i++) {
        const format = i % 3 === 2 ? 'video' : rnd() < 0.55 ? 'short' : 'video';
        const views = format === 'video' ? logn(420000 * k, 1.5) : logn(1100000 * k, 2.0);
        posts.push({ id: `${id}y${i}`, creator_id: id, platform: 'youtube', format, ext_id: `${id}y${i}`, url: yt, title: HOOKS[(i * 7 + ci * 2 + 3) % HOOKS.length], views, likes: Math.round(views * (0.025 + rnd() * 0.02)), comments: Math.round(views * (0.0008 + rnd() * 0.002)), duration_s: format === 'short' ? 20 + Math.round(rnd() * 40) : 480 + Math.round(rnd() * 2400), posted_at: new Date(now - (i * 9 + rnd() * 6 + 1) * DAY).toISOString(), picked: false });
      }
    });
    DEMO_WRITERS.forEach(([name, ch, k], wi) => {
      const id = 'cw' + wi; creators.push({ id, name, ...ch, x_synced_at: new Date(now - (wi + 1) * 36e5).toISOString(), li_synced_at: ch.li_url ? new Date(now - (wi + 3) * 36e5).toISOString() : null, news_synced_at: new Date(now - (wi + 4) * 36e5).toISOString() });
      const body = (h, i) => [h, '', W_LINES[(i + wi) % W_LINES.length], '', '1. ' + HOOKS[(i * 2 + wi) % HOOKS.length] + '.', '2. ' + HOOKS[(i * 5 + wi + 3) % HOOKS.length] + '.', '3. ' + HOOKS[(i * 7 + wi + 1) % HOOKS.length] + '.', '', 'Do the boring work for longer than feels normal.'].join('\n');
      for (let i = 0; i < 28; i++) {
        const h = W_HOOKS[(i * 5 + wi * 7) % W_HOOKS.length]; const likes = logn(1400 * k, 1.7); const comments = Math.round(likes * (0.05 + rnd() * 0.12)); const shares = Math.round(likes * (0.04 + rnd() * 0.1));
        posts.push({ id: `${id}x${i}`, creator_id: id, platform: 'x', format: 'post', ext_id: `${id}x${i}`, url: 'https://x.com/' + ch.x_handle, title: h, body: i % 3 ? h : body(h, i), views: Math.round(likes * (45 + rnd() * 60)), likes, comments, shares, posted_at: new Date(now - (i * 2.5 + rnd() * 2 + 0.3) * DAY).toISOString(), picked: false });
      }
      if (ch.li_url) for (let i = 0; i < 16; i++) {
        const h = W_HOOKS[(i * 7 + wi * 3 + 2) % W_HOOKS.length]; const likes = logn(900 * k, 1.4);
        posts.push({ id: `${id}l${i}`, creator_id: id, platform: 'linkedin', format: 'post', ext_id: `${id}l${i}`, url: ch.li_url, title: h, body: body(h, i), views: null, likes, comments: Math.round(likes * (0.2 + rnd() * 0.6)), shares: Math.round(likes * (0.01 + rnd() * 0.03)), posted_at: new Date(now - (i * 4 + rnd() * 3 + 0.5) * DAY).toISOString(), picked: false });
      }
      for (let i = 0; i < 10; i++) {
        const h = W_HOOKS[(i * 3 + wi * 11 + 5) % W_HOOKS.length].replace(/\.$/, ''); const sub = ch.news_kind === 'substack'; const likes = sub ? logn(700 * k, 1.2) : null;
        posts.push({ id: `${id}n${i}`, creator_id: id, platform: 'newsletter', format: 'essay', ext_id: `${id}n${i}`, url: ch.news_url, title: h, body: W_LINES[(i + wi) % W_LINES.length] + ' ' + HOOKS[(i * 3 + wi) % HOOKS.length] + '.', views: null, likes, comments: sub ? Math.round(likes * 0.08) : null, shares: sub ? Math.round(likes * 0.06) : null, posted_at: new Date(now - (i * 7 + 1) * DAY).toISOString(), picked: false });
      }
    });
    posts.find((p) => p.platform === 'instagram' && p.format === 'reel').picked = true;
    return (DEMO = { creators, posts, runs: [] });
  }

  /* ---------- live state ---------- */
  const L = { ws: null, creators: [], posts: [], runs: [], loading: false, error: '', at: 0 };
  function load(force) {
    const w = ctx().ws; if (!w || !w.id || L.loading) return;
    if (!force && L.ws === w.id && Date.now() - L.at < 6000) return;
    L.loading = true; L.error = '';
    Promise.all([Auth.creators.list(w.id), Auth.creators.posts(w.id), Auth.creators.runs(w.id)])
      .then(([c, p, r]) => { L.creators = c; L.posts = p; L.runs = r; })
      .catch((e) => { L.error = Auth.friendly(e); })
      .finally(() => { L.ws = w.id; L.at = Date.now(); L.loading = false; schedule(); if (VS.view === 'creators' || VS.view === 'approvals') render(); });
  }
  const data = () => { if (!isLive()) return demo(); const w = ctx().ws; if (w && w.id && (L.ws !== w.id || Date.now() - L.at > 30000)) load(); return L; };
  const conn = () => (isLive() ? (ctx().conns || []).find((c) => c.provider === 'apify' && c.status === 'connected') || null : { meta: { username: 'northpeak' } });
  const pending = (r) => r.status === 'starting' || r.status === 'running';
  // Apify refused the saved token: Research owns the reconnect step, so hand over to it.
  const stale = async (e) => !!(window.ApifyConn && await window.ApifyConn.stale(e));
  const staleRow = () => (isLive() && window.ApifyConn ? window.ApifyConn.staleRow() : null);
  const syncing = (cid, plat) => data().runs.some((r) => pending(r) && r.creator_id === cid && (!plat || (plat === 'written' ? WRITTEN.some((k) => r.preset === CH[k].preset) : r.preset === CH[plat].preset)));

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    if (!isLive() || !L.runs.some(pending)) return;
    timer = setTimeout(async () => {
      const w = ctx().ws; let done = 0;
      for (const r of L.runs.filter(pending)) {
        try { const out = await Auth.apify('poll', { workspace_id: w.id, id: r.id }); Object.assign(r, out.run); if (!pending(out.run)) { done++; U.toast(out.run.status === 'succeeded' ? `${out.run.label}: ${out.run.item_count || 0} posts updated` : `${out.run.label} stopped: ${out.run.error || out.run.status}`); } }
        catch (e) { r.status = 'failed'; r.error = e.message; done++; if (await stale(e)) break; }
      }
      if (done) load(true); else { if (VS.view === 'creators') render(); schedule(); }
    }, 5000);
  }

  /* ---------- ranking ---------- */
  // Video ranks on views, carousels and photos on likes, written posts on reactions (likes, replies, reposts).
  const metric = (p) => (isW(p) ? reactions(p) : viewsFmt(p.format) ? p.views : p.likes);
  const mkey = (p) => p.creator_id + ':' + (isW(p) ? 'r' : viewsFmt(p.format) ? 'v' : 'l') + ':' + p.platform;
  function scored(posts) {
    const groups = {};
    posts.forEach((p) => { (groups[mkey(p)] = groups[mkey(p)] || []).push(metric(p)); });
    const med = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, median(v)]));
    return posts.map((p) => { const m = med[mkey(p)]; const v = metric(p); return { ...p, react: isW(p) ? v : null, outlier: v != null && m ? Math.round((v / m) * 10) / 10 : null, eng: p.views && !isW(p) ? ((p.likes || 0) + (p.comments || 0)) / p.views : null }; });
  }
  const SORTS = { views: ['Views', (p) => (p.views != null ? p.views : -1)], reactions: ['Reactions', (p) => (p.react != null ? p.react : -1)], outlier: ['Outlier', (p) => (p.outlier != null ? p.outlier : -1)], likes: ['Likes', (p) => (p.likes != null ? p.likes : -1)], comments: ['Comments', (p) => (p.comments != null ? p.comments : -1)], eng: ['Engagement', (p) => (p.eng != null ? p.eng : -1)], newest: ['Newest', (p) => Date.parse(p.posted_at || 0) || 0] };
  function inPeriod(p) { return !VS.crPeriod || (p.posted_at && Date.now() - Date.parse(p.posted_at) <= VS.crPeriod * DAY); }

  function view() {
    const d = data(); const plat = VS.crPlat; const fmts = PLAT_FMTS[plat];
    if (VS.crFmt !== 'all' && !fmts.includes(VS.crFmt)) VS.crFmt = 'all';
    const byId = Object.fromEntries(d.creators.map((c) => [c.id, c]));
    const W = plat === 'written';
    const base = scored(d.posts.filter((p) => (W ? isW(p) : p.platform === plat) && byId[p.creator_id]));
    // A creator picked on another tab may not publish here. Fall back to everyone instead of an empty list.
    if (VS.crWho !== 'all' && !(byId[VS.crWho] && (hasPlat(byId[VS.crWho], plat) || base.some((p) => p.creator_id === VS.crWho)))) VS.crWho = 'all';
    const scope = base.filter((p) => inPeriod(p) && (VS.crWho === 'all' || p.creator_id === VS.crWho));
    const likeMode = !W && (VS.crFmt === 'carousel' || VS.crFmt === 'photo');
    const steps = W ? REACT_STEPS : likeMode ? LIKE_STEPS : VIEW_STEPS; const min = steps[Math.min(VS.crMin, steps.length - 1)][0];
    const fmtOk = (p) => VS.crFmt === 'all' || (W ? p.platform === VS.crFmt : p.format === VS.crFmt);
    let list = scope.filter((p) => fmtOk(p) && (!VS.crPicks || p.picked));
    if (min) list = list.filter((p) => (W ? p.react : likeMode ? p.likes : p.views) >= min);
    const sortKey = W ? (VS.crSort === 'views' || VS.crSort === 'eng' ? 'reactions' : VS.crSort) : likeMode && VS.crSort === 'views' ? 'likes' : VS.crSort === 'reactions' ? 'views' : VS.crSort;
    const f = (SORTS[sortKey] || SORTS.views)[1]; list.sort((a, b) => f(b) - f(a) || Date.parse(b.posted_at || 0) - Date.parse(a.posted_at || 0));
    return { d, plat, W, fmts, byId, base, scope, list, likeMode, steps, min, sortKey };
  }

  /* ---------- page ---------- */
  V.creators = () => {
    const live = isLive(), c = conn(); const s = view(); const { d, plat, W, fmts, byId, scope, list, likeMode } = s;
    if (live && L.loading && L.ws !== (ctx().ws || {}).id) return `${U.title('Creators', 'Loading your creators.')}<p class="meta">${U.spin}Loading</p>`;
    // A hit is 1M views on video, 1K reactions on a written post.
    const HIT = W ? 1e3 : 1e6, HIT_TXT = W ? '1K reactions' : '1M', unit = W ? 'reactions' : 'views';
    const val = (p) => (W ? p.react : p.views);
    const vids = scope.filter((p) => (W ? p.react != null : viewsFmt(p.format)));
    const hits = vids.filter((p) => val(p) >= HIT);
    const inFmt = (p, f) => (W ? p.platform === f : p.format === f);
    const fmtStats = fmts.map((f) => { const ps = scope.filter((p) => inFmt(p, f)); const vf = W ? ps.some((p) => p.react != null) || !ps.length : viewsFmt(f); const h = vf ? ps.filter((p) => val(p) >= HIT).length : 0; return { f, n: ps.length, med: median(ps.map(metric)), hits: h, rate: vf && ps.length ? h / ps.length : null, vf }; })
      .filter((x) => !W || x.n || d.creators.some((cr) => cr[CH[x.f].key]));
    const best = fmtStats.filter((x) => x.vf && x.n >= 3).sort((a, b) => b.rate - a.rate || b.med - a.med)[0];
    const crs = d.creators.filter((cr) => hasPlat(cr, plat) || s.base.some((p) => p.creator_id === cr.id));
    const board = crs.map((cr) => { const ps = s.base.filter((p) => p.creator_id === cr.id && inPeriod(p)); const v = ps.filter((p) => val(p) != null && (W || viewsFmt(p.format))); return { cr, n: ps.length, med: median(v.map(val)), hits: v.filter((p) => val(p) >= HIT).length }; }).sort((a, b) => (b.med || 0) - (a.med || 0));
    const topCr = board.find((b) => b.med);
    const periodTxt = VS.crPeriod ? (VS.crPeriod === 365 ? 'last year' : 'last ' + VS.crPeriod + ' days') : 'all time';

    const head = U.title('Creators', 'Track the creators you learn from, then rank their videos, Reels, carousels and written posts by what actually performed.', `${live && d.creators.length ? `<button class="btn" data-action="cr-sync-all">${icon('refresh')}Refresh all</button>` : ''}<button class="btn primary" data-action="cr-add">${icon('plus')}Add creator</button>`);
    const notice = !live ? '<p class="cr-note">Sample creators and sample numbers for the demo. In your private workspace, videos and social posts come through your Apify account and newsletters straight from their public archive or RSS feed.</p>'
      : !c && staleRow() ? `<div class="cr-banner"><div><b>Apify needs a new token</b><p class="muted">Apify stopped accepting your saved token, so social posts cannot refresh. Your creators and their posts are still here, and newsletters keep working.</p></div><button class="btn primary" data-action="apify-open">Reconnect Apify</button></div>`
      : !c ? `<div class="cr-banner"><div><b>Connect Apify to pull posts</b><p class="muted">Creators you add are saved now. Instagram, YouTube, X, LinkedIn and Facebook posts are fetched through your own Apify account. Newsletters work without it.</p></div><button class="btn primary" data-action="apify-open">Connect Apify</button></div>` : '';

    if (live && !d.creators.length) {
      return `${head}${notice}<section class="panel"><div class="empty cr-empty"><b>Add the creators you study</b><p class="muted">Add any mix of Instagram, YouTube, X, LinkedIn, Facebook or a newsletter. Then refresh to rank their posts by views or reactions and by how far each beats their usual numbers.</p>
        <div class="cr-quick"><button class="btn" data-action="cr-add" data-name="Alex Hormozi" data-ig="hormozi" data-yt="@AlexHormozi">${icon('plus')}Alex Hormozi</button><button class="btn" data-action="cr-add" data-name="Justin Welsh" data-x="thejustinwelsh" data-li="justinwelsh" data-news="justinwelsh.me">${icon('plus')}Justin Welsh</button><button class="btn" data-action="cr-add" data-name="Gary Vaynerchuk" data-ig="garyvee" data-yt="@garyvee">${icon('plus')}Gary Vaynerchuk</button><button class="btn ghost" data-action="cr-add">Someone else</button></div></div></section>`;
    }

    const kpis = U.kpis([
      { label: W ? 'Written posts tracked' : plat === 'instagram' ? 'Posts tracked' : 'Videos tracked', value: String(scope.length), delta: crs.length + ' creator' + (crs.length === 1 ? '' : 's') + ', ' + periodTxt },
      { label: 'Over ' + HIT_TXT + (W ? '' : ' views'), value: String(hits.length), delta: vids.length ? Math.round((hits.length / vids.length) * 100) + '% of ' + (W ? 'posts with public numbers' : plat === 'instagram' ? 'Reels' : 'videos and Shorts') : W ? 'No reaction counts yet' : 'No view counts yet' },
      { label: W ? 'Best channel for 1K+' : 'Best format for 1M+', value: best ? FMT[best.f] : '\u2013', delta: best ? Math.round(best.rate * 100) + '% cross ' + (W ? '1K' : '1M') + ', median ' + fmtN(best.med) : 'Needs a few posts' },
      { label: 'Highest median ' + unit, value: topCr ? esc(topCr.cr.name) : '\u2013', delta: topCr ? fmtN(topCr.med) + ' per post' : 'Refresh a creator' },
    ]);

    const chips = `<div class="cr-chips" role="group" aria-label="Creators"><button class="cr-chip" data-action="cr-who" data-id="all" aria-pressed="${VS.crWho === 'all'}">All creators</button>${crs.map((cr) => `<button class="cr-chip" data-action="cr-who" data-id="${cr.id}" aria-pressed="${VS.crWho === cr.id}"><span class="cr-av">${esc(U.initials(cr.name))}</span>${esc(cr.name)}${syncing(cr.id) ? U.spin : ''}</button>`).join('')}</div>`;
    const sorts = Object.entries(SORTS).filter(([k]) => (W ? k !== 'views' && k !== 'eng' : k !== 'reactions' && !(likeMode && (k === 'views' || k === 'eng'))));
    const filters = `<div class="cr-filters">
        <div class="cr-f"><span class="cr-fl">${W ? 'Channel' : 'Format'}</span>${U.seg('crFmt', VS.crFmt, [['all', 'All'], ...fmtStats.map((x) => [x.f, FMT[x.f]])])}</div>
        <div class="cr-f"><span class="cr-fl">${W ? 'Reactions' : likeMode ? 'Likes' : 'Views'}</span>${U.seg('crMin', Math.min(VS.crMin, s.steps.length - 1), s.steps.map((x, i) => [i, x[1]]))}</div>
        <div class="cr-f"><span class="cr-fl">Posted</span>${U.seg('crPeriod', VS.crPeriod, [[30, '30 days'], [90, '90 days'], [365, '1 year'], [0, 'All']])}</div>
        <div class="cr-f"><span class="cr-fl">Rank by</span><label class="cr-sort"><select data-cr="sort" aria-label="Rank by">${sorts.map(([k, v]) => `<option value="${k}" ${k === s.sortKey ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
          <button class="cr-chip sm" data-action="cr-picks" aria-pressed="${!!VS.crPicks}">${icon('star')}My picks</button></div>
      </div>`;
    const igNote = plat === 'instagram' && VS.crFmt === 'all' && s.min ? '<p class="cr-note">Instagram does not show view counts on carousels and photos, so view filters only keep Reels. Pick Carousels to rank them by likes.</p>'
      : W ? '<p class="cr-note">Written posts rank on reactions: likes, replies and reposts added up. Substack shows them for every essay. Newsletters on other platforms only share their RSS feed, so those essays list by date without numbers.</p>' : '';
    const rows = list.length ? `<ol class="cr-list">${list.slice(0, 100).map((p, i) => postRow(p, i, byId)).join('')}</ol>${list.length > 100 ? `<p class="meta" style="margin-top:10px">Showing the top 100 of ${list.length}.</p>` : ''}`
      : U.empty(scope.length ? 'Nothing matches these filters' : W ? 'No written posts yet' : 'No posts yet', scope.length ? 'Lower the threshold, widen the date range or switch ' + (W ? 'channel.' : 'format.') : W ? 'Add an X handle, a LinkedIn profile, a Facebook page or a newsletter to a creator, then refresh.' : live ? (c ? 'Refresh a creator to pull their latest posts.' : staleRow() ? 'Reconnect Apify, then refresh a creator.' : 'Connect Apify, then refresh a creator.') : 'Pick another creator or format.');

    const fmtPanel = `<h2 class="out">${W ? 'Channels' : 'Formats'}, ${esc(periodTxt)}</h2><section class="panel tight"><div class="cr-fmts">${fmtStats.map((x) => `<button class="cr-fmt" data-action="seg" data-seg="crFmt" data-v="${x.f}" aria-pressed="${VS.crFmt === x.f}"><div class="cr-fmt-h"><b>${FMT[x.f]}</b><span class="meta">${x.n} post${x.n === 1 ? '' : 's'}</span></div>
        ${x.vf ? `<div class="meter"><span style="width:${x.rate != null ? Math.max(2, x.rate * 100).toFixed(0) : 0}%"></span></div><p class="meta">${x.hits} over ${W ? '1K' : '1M'}${x.rate != null && x.n ? ', ' + Math.round(x.rate * 100) + '%' : ''} \u00b7 median ${fmtN(x.med)} ${unit}</p>` : W ? '<p class="meta">RSS only \u00b7 no public reactions</p>' : `<p class="meta">Median ${fmtN(x.med)} likes \u00b7 no public view count</p>`}</button>`).join('')}</div></section>`;
    const boardPanel = `<h2 class="out">Creators by median ${unit}</h2><section class="panel tight"><div class="rows">${board.map((b, i) => `<div class="row click cr-brow ${VS.crWho === b.cr.id ? 'on' : ''}" data-action="cr-open" data-id="${b.cr.id}" tabindex="0" role="button"><span class="cr-rank num">${i + 1}</span><div class="grow"><div class="t">${esc(b.cr.name)}</div><div class="s">${b.n ? (b.med != null ? `${fmtN(b.med)} median \u00b7 ${b.hits} over ${W ? '1K' : '1M'}` : b.n + ' posts, no public numbers') : syncing(b.cr.id) ? 'Fetching posts' : 'No posts yet'}</div></div>${syncing(b.cr.id, plat) ? `<span class="pill acc">${U.spin}Syncing</span>` : `<span class="meta">${handle(b.cr, plat)}</span>`}</div>`).join('') || '<p class="meta" style="padding:12px 14px">No creators on this platform yet.</p>'}</div></section>`;

    return `${head}${notice}${kpis}
      <div class="cr-plat">${U.seg('crPlat', plat, [['instagram', 'Instagram'], ['youtube', 'YouTube'], ['written', 'Written']])}</div>
      ${chips}
      <div class="layout" style="margin-top:var(--gap)"><div class="stack">
        <section class="panel" id="cr-ranked"><header><h2>${VS.crPicks ? 'My picks' : 'Top ' + (VS.crFmt === 'all' ? (W ? 'written posts' : plat === 'instagram' ? 'posts' : 'videos') : W ? 'posts on ' + FMT[VS.crFmt].replace(/s$/, '') : FMT[VS.crFmt].toLowerCase())}</h2><span class="meta">${list.length} ranked by ${esc(SORTS[s.sortKey][0].toLowerCase())}</span></header>${filters}${igNote}${rows}</section>
      </div><aside class="rail">${fmtPanel}${boardPanel}</aside></div>`;
  };
  V.creators.live = () => V.creators();

  function handle(cr, plat) {
    if (plat === 'written') { const k = WRITTEN.find((x) => cr[CH[x].key]); return k ? esc(CH[k].show(cr)) : 'No written channel'; }
    return cr[CH[plat].key] ? esc(CH[plat].show(cr)) : 'No ' + PNAME[plat];
  }
  const GLYPH = { x: 'X', linkedin: 'in', facebook: 'f', newsletter: 'Aa' };
  function postRow(p, i, byId) {
    const cr = byId[p.creator_id]; const w = isW(p); const vf = viewsFmt(p.format); const key = p.id; const saved = VS.crSaved[key];
    const thumb = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="remove">` : '';
    const main = w ? (p.react != null ? `<b class="num">${fmtN(p.react)}</b><span>reactions</span>` : '<span>RSS, no public numbers</span>') : vf ? `<b class="num">${fmtN(p.views)}</b><span>views</span>` : `<b class="num">${fmtN(p.likes)}</b><span>likes</span>`;
    const sub = (w ? [p.likes != null ? fmtN(p.likes) + ' likes' : null, p.comments != null ? fmtN(p.comments) + (p.platform === 'x' ? ' replies' : ' comments') : null, p.shares ? fmtN(p.shares) + (p.platform === 'newsletter' ? ' restacks' : ' reposts') : null, p.platform === 'x' && p.views ? fmtN(p.views) + ' views' : null]
      : [vf && p.likes != null ? fmtN(p.likes) + ' likes' : null, p.comments != null ? fmtN(p.comments) + ' comments' : null]).filter(Boolean).join(' \u00b7 ');
    const rest = w && p.body ? String(p.body).replace(String(p.title || ''), '').replace(/\s+/g, ' ').trim() : '';
    const where = w ? FMT[p.platform].replace(/s$/, '') : p.platform === 'instagram' ? 'Instagram' : 'YouTube';
    const tile = w ? `<a class="cr-thumb f-text f-${p.platform}" href="${esc(p.url || '#')}" target="_blank" rel="noopener" aria-label="Open on ${where}"><span class="cr-glyph cr-wglyph" aria-hidden="true">${GLYPH[p.platform]}</span><span class="cr-tl">${p.format === 'essay' ? 'Essay' : 'Post'}</span>${p.platform === 'linkedin' || p.platform === 'newsletter' ? thumb : ''}</a>`
      : `<a class="cr-thumb f-${p.format}" href="${esc(p.url || '#')}" target="_blank" rel="noopener" aria-label="Open on ${where}"><span class="cr-glyph" aria-hidden="true">${icon(p.format === 'carousel' ? 'stack' : p.format === 'photo' ? 'image' : 'play')}</span><span class="cr-tl">${ONE[p.format]}${p.duration_s ? ' \u00b7 ' + dur(p.duration_s) : ''}</span>${thumb}</a>`;
    return `<li class="cr-post"><span class="cr-rank num">${i + 1}</span>
      ${tile}
      <div class="cr-body"><a class="cr-title" href="${esc(p.url || '#')}" target="_blank" rel="noopener">${esc(p.title || 'Untitled ' + (ONE[p.format] || 'post').toLowerCase())}</a>
        ${rest ? `<p class="cr-snip">${esc(rest.slice(0, 220))}</p>` : ''}
        <p class="meta">${esc(cr ? cr.name : '')}${w ? ' \u00b7 ' + esc(where) : ''} \u00b7 ${day(p.posted_at)}${p.eng != null ? ' \u00b7 ' + (p.eng * 100).toFixed(1) + '% engagement' : ''}</p>
</div>
      <div class="cr-nums"><div class="cr-main">${main}</div><p class="meta">${sub}</p>${p.outlier != null ? `<span class="pill ${p.outlier >= 2 ? 'acc' : 'out'} num" title="Compared with this creator's median">${p.outlier}x their median</span>` : ''}</div>
<div class="cr-acts"><button class="btn sm ${saved ? '' : 'ghost'}" data-action="cr-save" data-id="${p.id}" ${saved ? 'disabled' : ''}>${saved ? 'Saved' : 'Save idea'}</button><button class="btn sm ghost cr-pick" data-action="cr-pick" data-id="${p.id}" aria-pressed="${!!p.picked}" aria-label="${p.picked ? 'Remove from my picks' : 'Add to my picks'}">${icon('star')}${p.picked ? 'Picked' : 'Pick'}</button></div></li>`;
  }

  /* ---------- actions ---------- */
  ACT['cr-who'] = (el) => { VS.crWho = el.dataset.id; render(); };
  ACT['cr-picks'] = () => { VS.crPicks = VS.crPicks ? 0 : 1; render(); };
  document.addEventListener('change', (e) => { const s = e.target.closest('[data-cr="sort"]'); if (!s) return; VS.crSort = s.value; render(); });
  const findPost = (id) => data().posts.find((p) => p.id === id);

  ACT['cr-pick'] = async (el) => {
    const p = findPost(el.dataset.id); if (!p) return; const v = !p.picked;
    try { if (isLive()) await Auth.creators.pick(p.id, v); p.picked = v; U.toast(v ? 'Added to my picks' : 'Removed from my picks'); render(); } catch (e) { U.toast(Auth.friendly(e)); }
  };
  ACT['cr-save'] = async (el) => {
    const p0 = findPost(el.dataset.id); if (!p0) return; const p = scored(data().posts.filter((x) => x.creator_id === p0.creator_id && x.platform === p0.platform)).find((x) => x.id === p0.id) || p0;
    const cr = data().creators.find((c) => c.id === p.creator_id) || { name: 'a creator' };
    const w = isW(p);
    const stat = w ? (p.react != null ? fmtN(p.react) + ' reactions' : 'a spot in their archive') : viewsFmt(p.format) ? fmtN(p.views) + ' views' : fmtN(p.likes) + ' likes';
    const why = `${cr.name}'s ${(ONE[p.format] || 'post').toLowerCase()} on ${PNAME[p.platform]} with ${stat}${p.outlier ? ', ' + p.outlier + 'x their median' : ''}. Remix the angle for your audience.`;
    const title = 'Remix: ' + String(p.title || ONE[p.format]).split('\n')[0].slice(0, 120);
    const channel = w ? 'post' : /short|reel/.test(p.format || '') ? 'short' : 'youtube', format = w ? 'post' : /short|reel/.test(p.format || '') ? 'short' : 'long';
    try {
      if (isLive()) { await window.OSBoard.add({ title, stage: 'suggested', channel, format, meta: { source: 'Creators, ' + cr.name, source_url: p.url || null, from: p.title || null, body_src: w && p.body ? String(p.body).slice(0, 2000) : null, platform: p.platform, author: cr.name, why, views_src: w ? p.react : p.views, likes: p.likes } }); window.OSMemory && window.OSMemory.reset && window.OSMemory.reset(); }
      else window.OSBoard.add({ title, stage: 'suggested', channel, format, meta: { why, sources: ['OUTLIER'], author: cr.name, from: p.title || null, outlier: p.outlier || null } });
      VS.crSaved[p.id] = true; U.toast('In Ideas to approve on the content board'); render();
    } catch (e) { U.toast(Auth.friendly(e)); }
  };

  function parseIg(v) { v = String(v || '').trim(); if (!v) return null; const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(v); const h = (m ? m[1] : v).replace(/^@/, '').replace(/\/.*$/, ''); return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : undefined; }
  function parseYt(v) {
    v = String(v || '').trim(); if (!v) return null;
    if (/^@[\w.-]{2,}$/.test(v)) return 'https://www.youtube.com/' + v;
    const m = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/((?:@[\w.-]+|channel\/[\w-]+|c\/[\w.-]+|user\/[\w.-]+))/i.exec(v);
    if (m) return 'https://www.youtube.com/' + m[1];
    if (/^[\w.-]{3,}$/.test(v)) return 'https://www.youtube.com/@' + v;
    return undefined;
  }
  function parseX(v) { v = String(v || '').trim(); if (!v) return null; const m = /(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i.exec(v); const h = (m ? m[1] : v).replace(/^@/, ''); return /^[A-Za-z0-9_]{1,15}$/.test(h) && !/^(home|search|i|intent)$/i.test(h) ? h : undefined; }
  function parseLi(v) {
    v = String(v || '').trim(); if (!v) return null;
    const m = /linkedin\.com\/(in|company)\/([^/?#\s]+)/i.exec(v); if (m) return `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}/`;
    return /^[A-Za-z0-9-_%.]{2,100}$/.test(v) ? `https://www.linkedin.com/in/${v}/` : undefined;
  }
  function parseFb(v) {
    v = String(v || '').trim(); if (!v) return null;
    const m = /facebook\.com\/([^?#\s]+)/i.exec(v); const path = (m ? m[1] : v).replace(/^@/, '').replace(/\/+$/, '');
    return /^[A-Za-z0-9.\-_/]{2,120}$/.test(path) && !/^(home|watch|groups\/?$)/i.test(path) ? 'https://www.facebook.com/' + path : undefined;
  }
  function parseNews(v) {
    v = String(v || '').trim(); if (!v) return null;
    if (!/[./]/.test(v) && /^[a-z0-9-]{2,60}$/i.test(v)) return 'https://' + v.toLowerCase() + '.substack.com/';
    let u; try { u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); } catch { return undefined; }
    if (!u.hostname.includes('.')) return undefined;
    u.protocol = 'https:'; u.hash = ''; const out = u.href; return out.length <= 300 ? out : undefined;
  }
  async function editCreator(cr, preset) {
    const pv = (k) => (cr ? cr[k] || '' : (preset && preset[k]) || '');
    const r = await U.dialog({ title: cr ? 'Edit creator' : 'Add a creator', body: cr ? '' : 'Add the channels they publish on. Leave the rest empty. Written channels show under Written.', ok: cr ? 'Save' : 'Add creator', fields: [
      { name: 'name', label: 'Name', required: true, value: cr ? cr.name : (preset && preset.name) || '', placeholder: 'Justin Welsh' },
      { name: 'ig', label: 'Instagram handle or profile URL', value: cr ? cr.ig_handle || '' : (preset && preset.ig) || '', placeholder: '@hormozi' },
      { name: 'yt', label: 'YouTube channel URL or @handle', value: cr ? (cr.yt_url || '').replace('https://www.youtube.com/', '') : (preset && preset.yt) || '', placeholder: '@AlexHormozi' },
      { name: 'x', label: 'X handle or profile URL', value: cr ? cr.x_handle || '' : (preset && preset.x) || '', placeholder: '@thejustinwelsh' },
      { name: 'li', label: 'LinkedIn profile URL', value: cr ? (cr.li_url || '').replace(/^https:\/\/www\.linkedin\.com\/in\//, '').replace(/\/$/, '') : (preset && preset.li) || '', placeholder: 'linkedin.com/in/justinwelsh' },
      { name: 'fb', label: 'Facebook page URL', value: cr ? (cr.fb_url || '').replace('https://www.facebook.com/', '') : pv('fb'), placeholder: 'facebook.com/pagename' },
      { name: 'news', label: 'Newsletter, Substack or RSS feed URL', value: cr ? (cr.news_url || '').replace(/^https:\/\//, '') : (preset && preset.news) || '', placeholder: 'justinwelsh.me or name.substack.com' },
    ] });
    if (!r) return null;
    const name = r.name.trim().slice(0, 80), ig = parseIg(r.ig), yt = parseYt(r.yt), x = parseX(r.x), li = parseLi(r.li), fb = parseFb(r.fb), news = parseNews(r.news);
    if (!name) { U.toast('Add a name'); return null; }
    if (ig === undefined) { U.toast('That Instagram handle does not look right'); return null; }
    if (yt === undefined) { U.toast('Use a YouTube channel URL or an @handle'); return null; }
    if (x === undefined) { U.toast('That X handle does not look right. It is up to 15 letters, numbers or underscores.'); return null; }
    if (li === undefined) { U.toast('Use a LinkedIn profile link, like linkedin.com/in/name'); return null; }
    if (fb === undefined) { U.toast('Use a Facebook page link, like facebook.com/pagename'); return null; }
    if (news === undefined) { U.toast('That newsletter link does not look right'); return null; }
    if (!ig && !yt && !x && !li && !fb && !news) { U.toast('Add at least one channel'); return null; }
    const row = { name, ig_handle: ig, yt_url: yt, x_handle: x, li_url: li, fb_url: fb, news_url: news };
    if (cr && cr.news_url !== news) row.news_kind = null;
    return row;
  }
  const same = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();
  ACT['cr-add'] = async (el) => {
    const ds = el && el.dataset; const preset = ds && ds.name ? { name: ds.name, ig: ds.ig, yt: ds.yt, x: ds.x, li: ds.li, news: ds.news } : null;
    const row = await editCreator(null, preset); if (!row) return;
    const d = data();
    if (d.creators.some((c) => ['ig_handle', 'yt_url', 'x_handle', 'li_url', 'fb_url', 'news_url'].some((k) => same(row[k], c[k])))) { U.toast(row.name + ' is already on your list'); return; }
    try {
      let cr;
      if (isLive()) { cr = await Auth.creators.add(ctx().ws.id, row); L.creators.push(cr); }
      else { cr = { id: 'cr' + Date.now(), ...row }; d.creators.push(cr); St.log && St.log('Added creator', row.name, 'research'); }
      VS.crWho = cr.id; if (!hasPlat(cr, VS.crPlat === 'written' ? 'written' : VS.crPlat)) VS.crPlat = cr.ig_handle ? 'instagram' : cr.yt_url ? 'youtube' : 'written'; render();
      const social = channelsOf(cr).some((k) => k !== 'newsletter');
      if (isLive() && (conn() || !social)) { U.toast(row.name + ' added. Fetching posts.'); syncCreator(cr, null); }
      else if (isLive() && staleRow()) { U.toast(row.name + ' added. Reconnect Apify to fetch social posts.'); if (cr.news_url) syncCreator(cr, 'newsletter'); }
      else if (!isLive()) { U.toast(row.name + ' added. The demo fetches sample posts.'); demoSync(cr); }
      else { U.toast(row.name + ' added. Connect Apify to fetch social posts.'); if (cr.news_url) syncCreator(cr, 'newsletter'); }
    } catch (e) { U.toast(Auth.friendly(e)); }
  };

  function demoSync(cr) {
    const d = demo(); const run = { id: 'run' + Date.now(), preset: 'creator-ig', creator_id: cr.id, status: 'running' }; d.runs.push(run); render();
    setTimeout(() => {
      run.status = 'succeeded'; const now = Date.now(); const chs = channelsOf(cr); const n = d.creators.indexOf(cr);
      const src = d.posts.filter((p) => chs.includes(p.platform) && p.creator_id === (isW(p) ? 'cw' + (n % 3) : 'cr' + (n % 5)));
      src.forEach((p, i) => { if (!d.posts.some((x) => x.id === cr.id + 'p' + i)) d.posts.push({ ...p, id: cr.id + 'p' + i, ext_id: cr.id + 'p' + i, creator_id: cr.id, picked: false, views: p.views != null ? Math.round(p.views * 0.6) : null, likes: p.likes != null ? Math.round(p.likes * 0.6) : null, posted_at: new Date(now - (i * 5 + 1) * DAY).toISOString() }); });
      if (VS.view === 'creators') render(); U.toast('Sample posts ready for ' + cr.name);
    }, 1600);
  }
  const newsBusy = new Set();
  async function syncCreator(cr, plat, mode) {
    const w = ctx().ws; const plats = plat ? [plat] : channelsOf(cr).filter((k) => k === 'newsletter' || conn());
    let started = 0, dead = false;
    for (const p of plats) {
      if (dead && p !== 'newsletter') continue;
      if (p === 'newsletter') {
        if (newsBusy.has(cr.id)) continue; newsBusy.add(cr.id); if (VS.view === 'creators') render();
        Auth.apify('creator-news', { workspace_id: w.id, creator_id: cr.id })
          .then((out) => { U.toast(`${cr.name}: ${out.count} essays from ${out.kind === 'substack' ? 'Substack' : 'the RSS feed'}`); })
          .catch((e) => U.toast(cr.name + ': ' + e.message))
          .finally(() => { newsBusy.delete(cr.id); load(true); });
        started++; continue;
      }
      if (syncing(cr.id, p)) continue;
      try { const out = await Auth.apify('creator-sync', { workspace_id: w.id, creator_id: cr.id, platform: p, mode: mode || 'latest' }); L.runs.unshift(out.run); started++; }
      catch (e) { if (await stale(e)) { dead = true; continue; } U.toast(e.message); }
    }
    schedule(); if (VS.view === 'creators') render();
    return { started, dead };
  }
  const busy = (cid, pl) => (pl === 'newsletter' ? newsBusy.has(cid) : syncing(cid, pl));
  const REFRESH = {
    instagram: [['latest', 'Refresh latest posts', 1], ['reels', 'Reels only']],
    youtube: [['latest', 'Refresh latest', 1], ['top', 'Most popular']],
    x: [['latest', 'Refresh latest posts', 1]], linkedin: [['latest', 'Refresh latest posts', 1]], facebook: [['latest', 'Refresh latest posts', 1]], newsletter: [['latest', 'Refresh essays', 1]],
  };
  ACT['cr-open'] = (el) => {
    const d = data(); const cr = d.creators.find((c) => c.id === el.dataset.id); if (!cr) return;
    VS.crWho = cr.id; render();
    const live = isLive(), c = conn();
    const order = channelsOf(cr); const missing = Object.keys(CH).filter((k) => !cr[CH[k].key]).map((k) => (k === 'newsletter' ? 'Newsletter' : PNAME[k]));
    const stats = order.map((pl) => {
      const C = CH[pl]; const nm = pl === 'newsletter' ? 'Newsletter' : PNAME[pl];
      const ps = scored(d.posts.filter((p) => p.creator_id === cr.id && p.platform === pl)); const w = WRITTEN.includes(pl);
      const v = ps.filter((p) => (w ? p.react != null : viewsFmt(p.format))); const vals = v.map((p) => (w ? p.react : p.views)); const H = w ? 1e3 : 1e6;
      const fol = C.fol && cr[C.fol]; const at = cr[C.at];
      const line = ps.length ? (v.length ? `${ps.length} ${pl === 'newsletter' ? 'essays' : 'posts'} \u00b7 median ${fmtN(median(vals))} ${w ? 'reactions' : 'views'} \u00b7 ${vals.filter((x) => x >= H).length} over ${w ? '1K' : '1M'}` : `${ps.length} essays \u00b7 RSS feed, no public reactions`) : 'No posts yet';
      const needsApify = pl !== 'newsletter';
      const btns = !live ? '' : busy(cr.id, pl) ? `<span class="pill acc">${U.spin}Fetching posts</span>` : needsApify && !c ? '' : REFRESH[pl].map(([m, label, main]) => `<button class="btn sm ${main ? '' : 'ghost'}" data-action="cr-sync" data-id="${cr.id}" data-p="${pl}" data-m="${m}">${label}</button>`).join('');
      return `<div class="dsec"><h3>${nm}${pl === 'newsletter' && cr.news_kind ? ` <span class="pill out">${cr.news_kind === 'substack' ? 'Substack' : 'RSS'}</span>` : ''}</h3><p><a class="lnk" href="${esc(C.link(cr))}" target="_blank" rel="noopener">${esc(C.show(cr))}</a>${fol ? ' \u00b7 ' + fmtN(fol) + ' ' + C.folTxt : ''}</p>
        <p class="meta">${line}${at ? ' \u00b7 updated ' + day(at) : ''}</p>${btns ? `<div class="actions" style="margin-top:10px">${btns}</div>` : ''}</div>`;
    }).join('') + (missing.length ? `<div class="dsec"><p class="meta">Not added yet: ${esc(missing.join(', '))}. Edit the creator to add any of them.</p></div>` : '');
    U.drawer(`<div><p class="meta">Creator</p><h2>${esc(cr.name)}</h2></div>${stats}
      ${live && !c && channelsOf(cr).some((k) => k !== 'newsletter') ? `<div class="dsec"><p>${staleRow() ? 'Apify needs a new token before social posts can refresh for this creator.' : 'Connect Apify to fetch social posts for this creator.'} Newsletters refresh without it.</p><div class="actions" style="margin-top:10px"><button class="btn primary" data-action="apify-open">${staleRow() ? 'Reconnect Apify' : 'Connect Apify'}</button></div></div>` : ''}
      ${live ? '<div class="dsec"><p class="meta">Social refreshes run on your Apify credit: Instagram up to 50 posts, YouTube up to 40 videos and 40 Shorts, X up to 100 posts, LinkedIn up to 40, Facebook up to 30. Newsletters are read from the public Substack archive or RSS feed at no cost.</p></div>' : '<div class="dsec"><p class="meta">Sample data in the demo. In a private workspace, social refreshes run through your Apify account and newsletters are read for free.</p></div>'}
      <div class="actions"><button class="btn" data-action="cr-edit" data-id="${cr.id}">Edit</button><button class="btn ghost" data-action="cr-remove" data-id="${cr.id}">Remove</button></div>`, { label: cr.name });
  };
  ACT['cr-sync'] = async (el) => { const cr = data().creators.find((c) => c.id === el.dataset.id); if (!cr) return; if (!isLive()) return U.toast('The demo uses sample posts'); if (el.dataset.p !== 'newsletter' && !conn()) return ACT['apify-open'](); el.disabled = true; el.innerHTML = U.spin + 'Starting'; const r = await syncCreator(cr, el.dataset.p, el.dataset.m); if (r.dead) return; U.toast('Fetching posts for ' + cr.name); ACT['cr-open']({ dataset: { id: cr.id } }); };
  ACT['cr-sync-all'] = async () => {
    const d = data(); const c = conn();
    const runs = d.creators.reduce((s, cr) => s + (c ? channelsOf(cr).filter((k) => k !== 'newsletter').length : 0), 0); const news = d.creators.filter((cr) => cr.news_url).length;
    if (!runs && !news) return c ? U.toast('No channels to refresh') : ACT['apify-open']();
    const parts = [runs ? `starts ${runs} Apify run${runs === 1 ? '' : 's'} on your account, one per creator and channel` : '', news ? `reads ${news} newsletter${news === 1 ? '' : 's'} for free` : ''].filter(Boolean);
    const ok = await U.dialog({ title: 'Refresh all creators?', body: `This ${parts.join(' and ')}. Most finish in a few minutes.${!c ? (staleRow() ? ' Reconnect Apify to include social channels.' : ' Connect Apify to include social channels.') : ''}`, ok: 'Refresh all' }); if (!ok) return;
    let dead = false; for (const cr of d.creators) { if (dead) { if (cr.news_url) await syncCreator(cr, 'newsletter'); continue; } const r = await syncCreator(cr, null); if (r.dead) dead = true; }
    if (!dead) U.toast('Refreshing ' + d.creators.length + ' creators');
  };
  ACT['cr-edit'] = async (el) => {
    const d = data(); const cr = d.creators.find((c) => c.id === el.dataset.id); if (!cr) return;
    const row = await editCreator(cr); if (!row) return;
    try { if (isLive()) Object.assign(cr, await Auth.creators.update(cr.id, row)); else Object.assign(cr, row); U.toast('Saved'); ACT['cr-open']({ dataset: { id: cr.id } }); } catch (e) { U.toast(Auth.friendly(e)); }
  };
  ACT['cr-remove'] = async (el) => {
    const d = data(); const cr = d.creators.find((c) => c.id === el.dataset.id); if (!cr) return;
    const ok = await U.dialog({ title: 'Remove ' + cr.name + '?', body: 'Their saved posts and picks are removed too. Ideas you saved stay in Memory.', ok: 'Remove', danger: true }); if (!ok) return;
    try { if (isLive()) await Auth.creators.remove(cr.id); d.creators.splice(d.creators.indexOf(cr), 1); for (let i = d.posts.length - 1; i >= 0; i--) if (d.posts[i].creator_id === cr.id) d.posts.splice(i, 1); if (VS.crWho === cr.id) VS.crWho = 'all'; U.closeDrawer(); U.toast(cr.name + ' removed'); render(); } catch (e) { U.toast(Auth.friendly(e)); }
  };

  window.OSCreators = { data, load, scored, demo, viewsFmt, FMT, median, reactions, isW, parseX, parseLi, parseFb, parseNews };
})();

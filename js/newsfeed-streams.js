// Newsfeed streams (V2): your own posts from every connected channel in one feed, and every post from the
// creators you follow in another. Each post has one action, Remix to Ideas, which opens the same remix drawer
// as Proven. The remixed ideas land in the Ideas tab to approve or deny. Nothing here posts anywhere.
(() => {
  const U = window.UI, VS = window.VS, ACT = window.ACT, { esc, icon } = U;
  const DAY = 864e5, PAGE = 20;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const PLAT = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', newsletter: 'Newsletter' };
  const ONE = { video: 'Video', short: 'Short', reel: 'Reel', carousel: 'Carousel', photo: 'Photo', post: 'Post', essay: 'Essay' };
  const REAL = (id) => /^[\w-]{11}$/.test(String(id || ''));
  const ytId = (u) => { const m = String(u || '').match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/); return m ? m[1] : null; };
  const n = (v) => { v = Number(v) || 0; return v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(v); };
  const ago = (iso) => { const t = Date.parse(iso); if (!t) return ''; const d = Math.floor((Date.now() - t) / DAY); return d < 1 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const median = (a) => { const s = a.filter((x) => x > 0).sort((x, y) => x - y); if (!s.length) return 0; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const isShort = (iso) => { const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return !!(m && !m[1] && (+m[2] || 0) * 60 + (+m[3] || 0) <= 180); };
  const safe = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const S = { plat: { mine: 'all', creators: 'all' }, who: 'all', sort: { mine: 'new', creators: 'new' }, limit: { mine: PAGE, creators: PAGE }, cache: {} };

  /* ---------- your own channels ---------- */
  // Demo only: a few written posts so the mixed feed shows more than two channels.
  const DEMO_WRITTEN = [
    ['linkedin', 'I stopped offering ten services. One buyer, one promise, one tool. Revenue went up and my calendar emptied out.', 412, 58, 2],
    ['x', 'Your funnel is not broken. Your offer is unclear. Fix the offer first, then the pages.', 288, 31, 3],
    ['linkedin', 'The three pages every one-person business needs before it runs a single ad. Most skip the second one.', 655, 92, 6],
    ['x', 'HighLevel AI Studio plus GitHub is the most underrated combo for solo founders right now.', 190, 24, 9],
  ];
  function mine() {
    const out = [], founder = (isLive() ? ctx().name : window.Store && window.Store.s.settings.name) || 'You';
    const vids = (list, label) => { const med = median((list || []).map((v) => v.views)); (list || []).forEach((v) => { if (!v || !v.title) return;
      out.push({ id: 'my-yt-' + v.id, title: v.title, author: label || founder, platform: 'youtube', format: isShort(v.duration) ? 'short' : 'video', url: REAL(v.id) ? 'https://www.youtube.com/watch?v=' + v.id : safe(v.url), thumb: v.thumb || (REAL(v.id) ? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` : ''), views: v.views, likes: v.likes, comments: v.comments, at: v.at || v.published_at, outlier: Number(v.x) || (med && v.views ? Math.round((v.views / med) * 10) / 10 : null), own: true }); }); };
    const posts = (list, plat, label) => { const med = median((list || []).map((p) => p.views || p.likes)); (list || []).forEach((p, i) => { const t = p.t || p.title || p.text || p.caption; if (!t) return;
      const f = plat === 'instagram' ? (p.type === 'Video' ? 'reel' : p.type === 'Sidecar' ? 'carousel' : 'photo') : p.format || 'post';
      const m = p.views || p.likes; out.push({ id: `my-${plat}-${p.id || p.ext_id || i}-${Date.parse(p.at || p.posted_at) || i}`, title: String(t).slice(0, 300), body: p.body || '', author: label || founder, platform: plat, format: f, url: safe(p.url), thumb: safe(p.thumb), views: p.views, likes: p.likes, comments: p.comments, at: p.at || p.posted_at, outlier: med && m ? Math.round((m / med) * 10) / 10 : null, own: true }); }); };
    if (isLive()) {
      (ctx().conns || []).filter((c) => c.status === 'connected' && c.meta).forEach((c) => {
        if (/^youtube/.test(c.provider)) vids(c.meta.videos, c.account_label);
        else if (PLAT[c.provider] && Array.isArray(c.meta.posts)) posts(c.meta.posts, c.provider, c.account_label);
      });
    } else {
      vids(window.OSYT && window.OSYT.videos ? window.OSYT.videos() : [], founder);
      posts(window.OSIG && window.OSIG.demo ? window.OSIG.demo().posts : [], 'instagram', founder);
      DEMO_WRITTEN.forEach(([plat, t, likes, comments, d]) => posts([{ t, likes, comments, at: new Date(Date.now() - d * DAY).toISOString() }], plat, founder));
      // Written demo posts each sit alone, so give them a reading against each other.
      const w = out.filter((p) => p.platform === 'linkedin' || p.platform === 'x'), wm = median(w.map((p) => p.likes)); w.forEach((p) => { p.outlier = wm ? Math.round((p.likes / wm) * 10) / 10 : null; });
    }
    const seen = new Set(); return out.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  }

  /* ---------- creators you follow ---------- */
  function creators() {
    const C = window.OSCreators; if (!C || !C.data) return { list: [], who: [], loading: false };
    const d = C.data(), byId = Object.fromEntries((d.creators || []).map((c) => [c.id, c]));
    const list = (C.scored ? C.scored(d.posts || []) : d.posts || []).filter((p) => byId[p.creator_id] && p.title).map((p) => ({
      id: 'cr-' + p.id, title: String(p.title).slice(0, 300), body: p.body || '', author: byId[p.creator_id].name || 'Creator', creator_id: p.creator_id, platform: p.platform, format: p.format,
      url: safe(p.url), thumb: safe(p.thumb) || (ytId(p.url) ? `https://i.ytimg.com/vi/${ytId(p.url)}/mqdefault.jpg` : ''), views: p.views, likes: p.likes, comments: p.comments, at: p.posted_at, outlier: p.outlier, own: false }));
    return { list, who: (d.creators || []).filter((c) => list.some((p) => p.creator_id === c.id)), loading: !!d.loading, error: d.error || '' };
  }

  /* ---------- thumbnails ---------- */
  // Each card tries its image sources in order. Long videos start with the 1280px image so the wide
  // frame stays sharp. A creator's Short starts with the 640px image: the vertical frame sits between
  // blurred side bars, and .nfs-frame scales it so the frame fills the box. Your own short videos are
  // only known by length, so they use the original-aspect image, which also suits a sideways video.
  // Everything falls back to the stored image, then to hqdefault, which every video has.
  const BAD = new Set();
  const ytImg = (id, f) => `https://i.ytimg.com/vi/${id}/${f}.jpg`;
  function thumbs(p) {
    const id = p.platform === 'youtube' ? ytId(p.url) : null;
    const first = !id ? [] : p.format !== 'short' ? [ytImg(id, 'hq720')] : p.own ? [ytImg(id, 'oar2')] : [ytImg(id, 'sddefault')];
    // The 320px mqdefault is only a stand-in when nothing better was stored, and hqdefault beats it.
    const stored = id && /\/mqdefault\.jpg/.test(p.thumb || '') ? '' : p.thumb;
    const list = [...first, stored, id ? ytImg(id, 'hqdefault') : ''].filter((u, i, a) => u && a.indexOf(u) === i && !BAD.has(u));
    return { list, frame: !!id && p.format === 'short' && !p.own };
  }
  // YouTube answers a missing size with a 120 by 90 grey placeholder instead of an error, so that counts
  // as a miss too. When no source loads, the card drops the image box and shows the text on its own.
  function miss(img) {
    BAD.add(img.getAttribute('src'));
    const next = (img.dataset.fb || '').split(' ').filter((u) => u && !BAD.has(u));
    if (next.length) { img.dataset.fb = next.slice(1).join(' '); img.src = next[0]; return; }
    const body = img.closest('.nfs-body'); if (body) body.classList.remove('nfs-split', 'nfs-wide', 'nfs-frame');
    const box = img.closest('.nfs-thumb'); if (box) box.remove();
  }
  const isYt = (u) => { try { return /(^|\.)ytimg\.com$/.test(new URL(u).hostname); } catch { return false; } };
  const onImg = (e) => {
    const img = e.target; if (!img || img.tagName !== 'IMG' || !img.closest('.nfs-thumb')) return;
    if (e.type === 'error' || (img.naturalWidth <= 120 && isYt(img.currentSrc || img.src))) miss(img);
  };
  document.addEventListener('error', onImg, true);
  document.addEventListener('load', onImg, true);

  /* ---------- the feed ---------- */
  const metric = (p) => (p.views ? `${n(p.views)} views` : p.likes != null ? `${n(p.likes)} likes` : '');
  function card(p) {
    const wide = p.platform === 'youtube' && p.format !== 'short';
    const line = [PLAT[p.platform] || p.platform, ONE[p.format] && ONE[p.format] !== 'Post' ? ONE[p.format] : '', ago(p.at)].filter(Boolean).join(' \u00b7 ');
    const stats = [metric(p), p.views && p.likes ? `${n(p.likes)} likes` : '', p.comments ? `${n(p.comments)} comments` : ''].filter(Boolean);
    const T = thumbs(p);
    const th = T.list.length ? `<img src="${esc(T.list[0])}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"${T.list.length > 1 ? ` data-fb="${esc(T.list.slice(1).join(' '))}"` : ''}>` : '';
    const rest = String(p.body || '').startsWith(p.title) ? String(p.body).slice(p.title.length).trim() : String(p.body || '').trim();
    const text = rest ? `<p class="nfs-text">${esc(rest)}</p>` : '';
    // Class names stay prefixed: the plain .split class belongs to the revenue bar and sets a 10px height.
    const layout = !th ? '' : wide ? ' nfs-wide' : ' nfs-split' + (T.frame ? ' nfs-frame' : '');
    return `<article class="nf-post nfs-post" data-nfs="${esc(p.id)}" aria-label="${esc(p.title)}">
      <header class="nf-head"><span class="nf-av">${esc(U.initials(p.author))}</span><div><b>${esc(p.author)}</b><span>${esc(line)}</span></div></header>
      <div class="nfs-body${layout}">${th ? `<a class="nfs-thumb" href="${esc(p.url || '#')}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${th}</a>` : ''}
        <div class="nfs-copy"><h2>${esc(p.title)}</h2>${text}
        <p class="nfs-stats">${stats.map((s) => `<span>${esc(s)}</span>`).join('')}${p.outlier ? `<span class="nfs-x${p.outlier >= 2 ? ' hot' : ''}" title="${esc(p.own ? 'Against your usual result on this channel' : 'Against this creator\u2019s usual result')}">${p.outlier}x ${p.own ? 'your' : 'their'} median</span>` : ''}</p></div></div>
      <footer class="nf-actions"><button class="btn sm primary" data-action="nfs-remix" data-id="${esc(p.id)}">${icon('sparkle')}<span>Remix to Ideas</span></button>${p.url ? `<a class="btn sm ghost" href="${esc(p.url)}" target="_blank" rel="noopener">Open original${icon('arrow')}</a>` : ''}</footer></article>`;
  }
  function chips(tab, base) {
    const counts = base.reduce((m, p) => ((m[p.platform] = (m[p.platform] || 0) + 1), m), {});
    if (S.plat[tab] !== 'all' && !counts[S.plat[tab]]) S.plat[tab] = 'all';
    const c = (id, name, k) => `<button data-action="nfs-plat" data-tab="${tab}" data-v="${id}" aria-pressed="${S.plat[tab] === id}">${esc(name)}<span>${k}</span></button>`;
    return `<div class="nf-chips" role="group" aria-label="Channel">${c('all', 'All', base.length)}${Object.keys(PLAT).filter((k) => counts[k]).map((k) => c(k, PLAT[k], counts[k])).join('')}</div>`;
  }
  function render(tab) {
    const C = tab === 'creators' ? creators() : { list: mine(), who: [] };
    const base = C.list;
    if (tab === 'creators' && S.who !== 'all' && !C.who.some((c) => c.id === S.who)) S.who = 'all';
    const list = base.filter((p) => (S.plat[tab] === 'all' || p.platform === S.plat[tab]) && (tab !== 'creators' || S.who === 'all' || p.creator_id === S.who))
      .sort(S.sort[tab] === 'top' ? (a, b) => (b.outlier || 0) - (a.outlier || 0) : (a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    S.cache[tab] = list;
    const shown = list.slice(0, S.limit[tab]);
    const sort = `<div class="segmented nfs-sort" role="group" aria-label="Order">${[['new', 'Latest'], ['top', 'Top performers']].map(([k, l]) => `<button data-action="nfs-sort" data-tab="${tab}" data-v="${k}" aria-pressed="${S.sort[tab] === k}">${l}</button>`).join('')}</div>`;
    const who = tab === 'creators' && C.who.length > 1 ? `<label class="nfs-who"><span class="sr">Creator</span><select data-action="nfs-who"><option value="all">All creators</option>${C.who.map((c) => `<option value="${esc(c.id)}" ${S.who === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : '';
    const note = isLive() ? '' : `<p class="meta nfs-note">${tab === 'mine' ? 'Sample posts for the demo. In your workspace this is every post from the channels you connect.' : 'Sample posts for the demo. In your workspace this is every post from the creators you follow.'}</p>`;
    if (!base.length) {
      if (C.loading) return U.empty('Loading the feed', 'Reading the latest posts.');
      return tab === 'mine'
        ? U.empty('No posts from your channels yet', 'Connect YouTube or Instagram and your posts show up here, newest first, ready to remix.', '<a class="btn" href="#connect">Open Connections</a>')
        : U.empty('No creators yet', 'Follow the creators you learn from and every new post of theirs shows up here.', '<a class="btn" href="#creators">Add creators</a>');
    }
    return `${note}<div class="nf-bar nfs-bar">${chips(tab, base)}<div class="nfs-tools">${who}${sort}</div></div>
      ${C.error ? `<p class="os-error" role="alert">${esc(C.error)}</p>` : ''}
      ${list.length ? `<div class="nf-list">${shown.map(card).join('')}</div>${list.length > shown.length ? `<div class="nf-next"><button class="btn" data-action="nfs-more" data-tab="${tab}">Show ${Math.min(PAGE, list.length - shown.length)} more</button></div>` : '<p class="meta nf-end">That is everything for now. Remixes wait in Ideas for your yes or no.</p>'}`
        : U.empty('Nothing on this channel', 'Pick another channel.')}`;
  }
  const rerender = () => window.App.render(true);
  ACT['nfs-plat'] = (el) => { S.plat[el.dataset.tab] = el.dataset.v; S.limit[el.dataset.tab] = PAGE; rerender(); };
  ACT['nfs-sort'] = (el) => { S.sort[el.dataset.tab] = el.dataset.v; S.limit[el.dataset.tab] = PAGE; rerender(); };
  ACT['nfs-who'] = (el) => { S.who = el.value; S.limit.creators = PAGE; rerender(); };
  ACT['nfs-more'] = (el) => { S.limit[el.dataset.tab] += PAGE; rerender(); };
  ACT['nfs-remix'] = (el) => {
    const p = [...(S.cache.mine || []), ...(S.cache.creators || [])].find((x) => x.id === el.dataset.id); if (!p) return;
    if (!window.OSProven || !window.OSProven.remix) return U.toast('Remix is not ready yet. Try again in a moment.');
    window.OSProven.remix(p);
  };
  window.NFStreams = { render, mine, creators, refresh: () => { if (isLive() && window.OSCreators && window.OSCreators.load) window.OSCreators.load(true); } };
})();

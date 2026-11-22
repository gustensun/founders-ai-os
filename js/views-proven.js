// Founders AI OS: Proven. Posts that already worked for someone else, ranked by how far each beat that
// creator's own median, grouped by the pattern behind it. One click writes the founder's version from the
// Brand DNA and points it at one of their offers and funnels.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const R = () => window.Remix;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const fmtN = (n) => (n == null ? '\u2013' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return 0; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const KIND = (p) => (p.format === 'post' || p.format === 'essay' || /^(x|linkedin|facebook|newsletter)$/.test(p.platform || '') ? 'written' : /short|reel/.test(p.format) ? 'short' : p.format === 'carousel' || p.format === 'photo' ? 'carousel' : 'long');
  const KINDS = { long: 'Long videos', short: 'Shorts and Reels', carousel: 'Carousels', written: 'Written posts' };
  const PLAT = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', newsletter: 'Newsletter' };
  const ytId = (u) => { const m = String(u || '').match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/); return m ? m[1] : null; };
  const thumbOf = (p) => p.thumb || (ytId(p.url) ? `https://i.ytimg.com/vi/${ytId(p.url)}/mqdefault.jpg` : null);

  Object.assign(VS, { pvPlat: VS.pvPlat || 'all', pvKind: VS.pvKind || 'all', pvMin: VS.pvMin || 2, pvPat: VS.pvPat || 'all' });
  const remixes = {}; // post id -> brief, so the drawer keeps the offer you picked

  function annotated() {
    const d = window.DNA.data();
    return { d, all: (d.proven || []).map((p) => ({ ...p, pat: R().pattern(p.title), kind: KIND(p) })) };
  }
  function patterns(list) {
    const g = {};
    list.forEach((p) => { (g[p.pat.id] = g[p.pat.id] || { ...p.pat, posts: [] }).posts.push(p); });
    return Object.values(g).map((x) => ({ ...x, n: x.posts.length, med: Math.round(median(x.posts.map((p) => p.outlier)) * 10) / 10, views: x.posts.reduce((s, p) => s + (p.views || 0), 0) }))
      .sort((a, b) => (b.n > 1) - (a.n > 1) || b.med - a.med || b.n - a.n);
  }

  function view() {
    const { d, all } = annotated();
    const dna = d.dna; const own = window.DNA.offersFor(d);
    const title = U.title('Proven', 'Content that already worked for someone else, ranked by how far it beat that creator\u2019s own median. Pick one, choose the formats, and the OS writes your version of each from your Brand DNA. The ideas wait for you on the content board.',
      `<a class="btn" href="#creators">${icon('creators')}<span>Creators</span></a><a class="btn" href="#research">${icon('research')}<span>Research</span></a>`);
    if (d.loading) return title + `<section class="panel">${U.empty('Reading your creators and research', 'One moment.')}</section>`;
    if (!all.length) return title + `<section class="panel">${U.empty('Nothing proven yet', 'Add the creators you watch on the Creators page, or run a channel outlier search in Research. Every post that beats its creator\u2019s median by 1.5x or more lands here, with the pattern behind it.', '<div class="actions" style="justify-content:center;margin-top:14px"><a class="btn primary" href="#creators">Add creators</a><a class="btn" href="#research">Run research</a></div>')}</section>`;

    const plats = [...new Set(all.map((p) => p.platform))];
    if (VS.pvPlat !== 'all' && !plats.includes(VS.pvPlat)) VS.pvPlat = 'all';
    const scope = all.filter((p) => (VS.pvPlat === 'all' || p.platform === VS.pvPlat) && (VS.pvKind === 'all' || p.kind === VS.pvKind) && p.outlier >= VS.pvMin);
    const pats = patterns(scope);
    if (VS.pvPat !== 'all' && !pats.some((x) => x.id === VS.pvPat)) VS.pvPat = 'all';
    const list = scope.filter((p) => VS.pvPat === 'all' || p.pat.id === VS.pvPat).sort((a, b) => b.outlier - a.outlier);
    const best = pats[0]; const kinds = Object.keys(KINDS).map((k) => ({ k, xs: scope.filter((p) => p.kind === k) })).filter((x) => x.xs.length).sort((a, b) => median(b.xs.map((p) => p.outlier)) - median(a.xs.map((p) => p.outlier)));
    const authors = [...new Set(scope.map((p) => p.author))];
    const kp = U.kpis([
      { label: 'Proven posts', value: String(scope.length), delta: `${VS.pvMin}x or more their median` },
      { label: 'Strongest pattern', value: best ? esc(best.name) : '\u2013', delta: best ? `${best.med}x median over ${best.n} post${best.n === 1 ? '' : 's'}` : '' },
      { label: 'Best format', value: kinds[0] ? KINDS[kinds[0].k] : '\u2013', delta: kinds[0] ? `${Math.round(median(kinds[0].xs.map((p) => p.outlier)) * 10) / 10}x median` : '' },
      { label: 'Sources', value: String(authors.length), delta: 'creators and channels' },
    ]);
    const maxMed = Math.max(...pats.map((x) => x.med), 1);
    const patPanel = `<section class="panel pv-pats"><header><h2>Patterns that win in your space</h2><span class="meta">Median multiplier per pattern</span></header>
      <div class="pv-bars" role="group" aria-label="Filter by pattern">${pats.map((x) => `<button class="pv-bar" data-action="pv-pat" data-id="${x.id}" aria-pressed="${VS.pvPat === x.id}">
        <span class="pv-bn">${esc(x.name)}</span><span class="pv-bt"><span class="pv-bf" style="width:${Math.max(6, (x.med / maxMed) * 100)}%"></span></span><span class="pv-bv">${x.med}x</span><span class="pv-bc">${x.n}</span></button>`).join('')}</div>
      ${VS.pvPat !== 'all' ? `<p class="meta pv-why">${esc((pats.find((x) => x.id === VS.pvPat) || {}).why || '')} <button class="lnk" data-action="pv-pat" data-id="all">Show all patterns</button></p>` : ''}</section>`;
    const dnaCard = `<section class="panel pv-dna"><header><h2>Your version is written from</h2></header>
      <a class="pv-dnav" href="#dna">${icon('dna')}<div><b>Brand DNA${dna ? ' v' + dna.version : ''}</b><span class="meta">${dna ? 'Rebuilt ' + window.DNA.ago(dna.built_at) : 'Not built yet'}</span></div></a>
      <div class="rows">${[['Founder facts', (dna && dna.counts && dna.counts.facts) || 0], ['Pieces of your writing', (dna && dna.counts && dna.counts.writing) || 0], ['Offers and funnels it knows', own.offers.length + own.funnels.length]].map(([l, n]) => `<div class="row"><div class="grow">${l}</div><b class="num">${n}</b></div>`).join('')}</div>
</section>`;

    const filters = `<div class="pv-filters">
      ${plats.length > 1 ? U.seg('pvPlat', VS.pvPlat, [['all', 'All platforms'], ...plats.map((p) => [p, PLAT[p] || p])]) : ''}
      ${U.seg('pvKind', VS.pvKind, [['all', 'All formats'], ...Object.entries(KINDS).filter(([k]) => all.some((p) => p.kind === k))])}
      ${U.seg('pvMin', VS.pvMin, [[1.5, '1.5x'], [2, '2x'], [3, '3x'], [5, '5x']])}
    </div>`;
    const rows = list.length ? `<ol class="pv-list">${list.slice(0, 60).map((p, i) => {
      const th = thumbOf(p);
      return `<li class="pv-post"><span class="pv-rank">${i + 1}</span>
        <a class="pv-thumb ${p.kind}" href="${esc(p.url || '#')}" target="_blank" rel="noopener" aria-label="Open the original">${th ? `<img src="${esc(th)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="remove">` : `<span class="pv-ph">${esc(U.initials(p.author || '?'))}</span>`}<span class="pv-plat">${esc(PLAT[p.platform] || p.platform)}</span></a>
        <div class="pv-body"><div class="pv-t">${esc(p.title)}</div>
          <div class="pv-m"><span>${esc(p.author)}</span><span>${esc(KINDS[p.kind].replace(/s$/, '').replace('Shorts and Reel', 'Short'))}</span>${p.views ? `<span>${fmtN(p.views)} ${I().unitOf(p)}</span>` : ''}<span class="tag">${esc(p.pat.name)}</span></div></div>
        <div class="pv-x"><span class="pv-mult ${p.outlier >= 5 ? 'hot' : ''}" title="Beat ${esc(p.author)}'s own median by ${p.outlier}x">${p.outlier}x</span><button class="btn sm primary" data-action="pv-remix" data-id="${esc(p.id)}">Remix</button></div></li>`; }).join('')}</ol>`
      : U.empty('No posts at this bar', 'Lower the multiplier or clear the pattern filter.');
    const note = isLive() ? '' : '<p class="cr-note">Sample posts for the demo. In your private workspace this list comes from the creators you track and the channel research you run.</p>';
    return `${title}${note}${kp}<div class="pv-top">${patPanel}${dnaCard}</div><section class="panel"><header><h2>${list.length} proven post${list.length === 1 ? '' : 's'}</h2><span class="meta">Highest multiplier first</span></header>${filters}${rows}</section>`;
  }
  V.proven = view; V.proven.live = view;

  /* ---------- remix drawer: pick one or more formats, Remix to Ideas, approve on the content board ---------- */
  const I = () => window.OSIdeas;
  const picks = {}; // post id -> chosen formats
  const extra = {}; // posts opened from the Newsfeed streams, not in the proven list
  function findPost(id) { return extra[id] || annotated().all.find((p) => p.id === id); }
  function briefFor(p) {
    const d = window.DNA.data(); const own = window.DNA.offersFor(d);
    const b = R().brief(p, own, annotated().all, { topic: window.OSIdeas ? window.OSIdeas.topicOf(p) : (R().postTopic(p.title) || undefined) });
    remixes[p.id] = b; return b;
  }
  function chosen(p) { return picks[p.id] || (picks[p.id] = [I().nativeOf(p)]); }
  function drawer(p, b) {
    const d = window.DNA.data(); const dna = d.dna; const sel = chosen(p);
    const beats = b.outline.filter((x) => !/^call to action/i.test(x));
    U.drawer(`<div><p class="meta">Remix for your brand</p><h2>${esc(b.titles[0])}</h2></div>
      <div class="dsec pv-src"><p class="meta">${p.own ? 'Your post' : 'What already worked'}</p><p><b>${esc(p.title)}</b></p><p class="meta">${esc(p.author)} \u00b7 ${esc(PLAT[p.platform] || p.platform)} \u00b7 ${p.views ? fmtN(p.views) + ' ' + I().unitOf(p) + ' \u00b7 ' : ''}${p.outlier ? `<span class="pv-mult">${p.outlier}x</span> ${p.own ? 'your' : 'their'} median` : ''}</p>
        <p class="evidence" style="margin-top:10px"><b>${esc(b.pattern.name)}.</b> ${esc(b.why)}</p><p class="meta">${esc(b.proof)}</p></div>
      <div class="dsec"><h3>Title options</h3><ol class="pv-ol">${b.titles.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <div class="dsec"><h3>Hook</h3><p>${esc(b.hook)}</p></div>
      <div class="dsec"><h3>Outline</h3><ol class="pv-ol">${beats.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <div class="dsec"><h3>Remix into</h3><p class="meta" style="margin-bottom:10px">Pick one or more. Each format becomes its own idea, written for that format.</p>
        <div class="rx-fmts" role="group" aria-label="Formats">${I().FORMATS.map((f) => `<button type="button" class="rx-fmt" data-action="pv-fmt" data-id="${esc(p.id)}" data-f="${f.id}" aria-pressed="${sel.includes(f.id)}"><span class="rx-box" aria-hidden="true"></span>${esc(f.name)}</button>`).join('')}</div>
        <div class="actions" style="margin-top:8px"><button class="lnk" data-action="pv-fmt-all" data-id="${esc(p.id)}">${sel.length === I().IDS.length ? 'Clear' : 'Pick all six'}</button></div></div>
      <div class="dsec"><p class="meta">Written from Brand DNA${dna ? ' v' + dna.version : ''}${isLive() ? '. With Claude, OpenAI or Perplexity connected, each format is written in your voice from the full DNA.' : '.'} The ideas wait in Ideas to approve on the content board.</p></div>
      <div class="actions"><button class="btn primary" data-action="pv-ideas" data-id="${esc(p.id)}" ${sel.length ? '' : 'disabled'}>Remix to Ideas${sel.length > 1 ? ' (' + sel.length + ')' : ''}</button><button class="btn ghost" data-action="pv-copy" data-id="${esc(p.id)}">Copy</button></div>`, { label: 'Remix', wide: true });
  }
  ACT['pv-pat'] = (el) => { VS.pvPat = VS.pvPat === el.dataset.id ? 'all' : el.dataset.id; window.App.render(true); };
  ACT['pv-remix'] = (el) => { const p = findPost(el.dataset.id); if (!p) return; drawer(p, remixes[p.id] || briefFor(p)); };
  ACT['pv-fmt'] = (el) => {
    const p = findPost(el.dataset.id); if (!p) return; const sel = chosen(p); const f = el.dataset.f;
    picks[p.id] = sel.includes(f) ? sel.filter((x) => x !== f) : sel.concat(f);
    const on = picks[p.id].includes(f); el.setAttribute('aria-pressed', on);
    const btn = document.querySelector(`#drawer [data-action="pv-ideas"][data-id="${CSS.escape(p.id)}"]`); const n = picks[p.id].length;
    if (btn) { btn.disabled = !n; btn.textContent = 'Remix to Ideas' + (n > 1 ? ' (' + n + ')' : ''); }
    const all = document.querySelector(`#drawer [data-action="pv-fmt-all"]`); if (all) all.textContent = n === I().IDS.length ? 'Clear' : 'Pick all six';
  };
  ACT['pv-fmt-all'] = (el) => { const p = findPost(el.dataset.id); if (!p) return; picks[p.id] = chosen(p).length === I().IDS.length ? [] : I().IDS.slice(); drawer(p, remixes[p.id] || briefFor(p)); };
  ACT['pv-copy'] = (el) => { const p = findPost(el.dataset.id); if (!p) return; const b = remixes[p.id] || briefFor(p); U.copy(R().text({ ...b, outline: b.outline.filter((x) => !/^call to action/i.test(x)) }, p).replace(/\n\nSells: .*$/, '')); };
  ACT['pv-ideas'] = async (el) => {
    const p = findPost(el.dataset.id); if (!p) return; const sel = chosen(p).slice(); if (!sel.length) return U.toast('Pick at least one format');
    const n = sel.length; const done = (by) => { U.closeDrawer(); window.OSBoard.reset && window.OSBoard.reset(); U.toast(`${n} idea${n === 1 ? '' : 's'} in Ideas to approve${by && by !== 'Rules' ? ', written by ' + by : ''}`); if (VS.view === 'content' || VS.view === 'approvals') window.App.render(true); };
    if (isLive()) {
      el.disabled = true; el.innerHTML = U.spin + (n > 1 ? 'Writing ' + n + ' formats' : 'Writing');
      try {
        const r = await Auth.brainApi('remix-ideas', { workspace_id: ctx().ws.id, post: { id: p.id, title: p.title, author: p.author, views: p.views, outlier: p.outlier, platform: p.platform, format: p.format, url: p.url }, formats: sel });
        window.OSBoard.inject && window.OSBoard.inject(r.rows || []); done(r.by);
      } catch (e) { U.toast(Auth.friendly(e)); el.disabled = false; el.textContent = 'Remix to Ideas' + (n > 1 ? ' (' + n + ')' : ''); }
      return;
    }
    const own = window.DNA.offersFor(window.DNA.data()); const pool = annotated().all;
    for (const f of sel) { const x = I().row(I().fromPost(p, f, own, pool, 0), f, p, { remix: true, by: 'Rules' }); await window.OSBoard.add(x); }
    done('Rules');
  };

  // Home panel: the freshest posts that beat their creator's median, each one click from a remix.
  function homePanel(n = 4) {
    let all; try { all = annotated().all; } catch (e) { return ''; }
    if (!all.length) return isLive() ? `<section class="panel pv-home"><header><h2>Proven this week</h2><a class="linkish meta" href="#creators">Add creators</a></header><p class="meta">Add the creators you watch and the posts that beat their own median show up here, ready to remix for your brand.</p></section>` : '';
    const now = Date.now(); const fresh = all.filter((p) => p.posted_at && now - Date.parse(p.posted_at) < 30 * 864e5);
    const pick = (fresh.length >= n ? fresh : all).slice().sort((a, b) => b.outlier - a.outlier).slice(0, n);
    return `<section class="panel pv-home"><header><h2>Proven this week</h2><a class="linkish meta" href="#proven">All ${all.length} proven posts</a></header><ol class="pv-list">${pick.map((p) => { const th = thumbOf(p); return `<li class="pv-post">
      <a class="pv-thumb ${p.kind}" href="${esc(p.url || '#')}" target="_blank" rel="noopener" aria-label="Open the original">${th ? `<img src="${esc(th)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="remove">` : `<span class="pv-ph">${esc(U.initials(p.author || '?'))}</span>`}<span class="pv-plat">${esc(PLAT[p.platform] || p.platform)}</span></a>
      <div class="pv-body"><div class="pv-t">${esc(p.title)}</div><div class="pv-m"><span>${esc(p.author)}</span>${p.views ? `<span>${fmtN(p.views)} ${I().unitOf(p)}</span>` : ''}<span class="tag">${esc(p.pat.name)}</span></div></div>
      <div class="pv-x"><span class="pv-mult ${p.outlier >= 5 ? 'hot' : ''}">${p.outlier}x</span><button class="btn sm" data-action="pv-remix" data-id="${esc(p.id)}">Remix</button></div></li>`; }).join('')}</ol></section>`;
  }

  // The Newsfeed streams open the same remix drawer for any post: your own or one from a creator you follow.
  function remixAny(post) { const p = { ...post, pat: R().pattern(post.title), kind: KIND(post) }; extra[p.id] = p; drawer(p, remixes[p.id] || briefFor(p)); }
  window.OSProven = { annotated, patterns, thumbOf, fmtN, homePanel, remix: remixAny };
})();

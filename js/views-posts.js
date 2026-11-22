// Founders AI OS: Posts. Videos that beat their median, written up as posts in the founder's voice.
// Pick an outlier (your own upload or a proven one from a creator you track). The OS reads the transcript
// through Apify, writes two long posts and one short one from it with your Brand DNA, and holds them
// here for you. Edit, rewrite or pass. Approve one and it lands on the content board under Written Posts.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const REAL = (id) => /^[\w-]{11}$/.test(String(id || ''));
  const ytId = (u) => { const s = String(u || ''); if (REAL(s)) return s; const m = s.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : null; };
  const fmtN = (n) => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n); };
  const xFmt = (x) => { x = Number(x) || 0; return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + 'x'; };
  const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
  const FMT = { long: 'Long post', short: 'Short post' };

  Object.assign(VS, { psSrc: VS.psSrc || 'mine' });
  const P = { rows: [], at: 0, loading: false, error: '', busy: {}, ws: null };

  /* ---------- the videos to write from ---------- */
  function mine() {
    const out = [];
    const add = (vids, label) => (vids || []).forEach((v) => { if (v && v.title) out.push({ id: v.id, url: REAL(v.id) ? 'https://www.youtube.com/watch?v=' + v.id : v.url || '', title: v.title, author: label, views: v.views, x: Number(v.x) || 0, own: true, platform: 'youtube', at: v.at }); });
    if (isLive()) {
      (ctx().conns || []).filter((c) => /^youtube/.test(c.provider) && c.status === 'connected').forEach((c) => add(c.meta && c.meta.videos, c.account_label || 'My channel'));
    } else add(window.OSYT && window.OSYT.videos ? window.OSYT.videos() : [], 'Avery Cole');
    const seen = new Set();
    return out.filter((v) => (seen.has(v.id) ? false : seen.add(v.id))).sort((a, b) => b.x - a.x);
  }
  function proven() {
    const d = window.DNA && window.DNA.data ? window.DNA.data() : { proven: [] };
    return (d.proven || []).filter((p) => p && p.title).map((p) => ({ id: ytId(p.url) || p.id, url: p.url || '', title: p.title, author: p.author || '', views: p.views, x: Number(p.outlier) || 0, own: false, platform: p.platform || 'youtube', format: p.format }))
      .sort((a, b) => b.x - a.x);
  }
  const list = () => (VS.psSrc === 'proven' ? proven() : mine());
  const keyOf = (v) => String(v.id || v.title);

  /* ---------- drafts ---------- */
  function load() {
    if (!isLive()) return;
    const ws = ctx().ws.id;
    if (P.loading || (P.at && P.ws === ws && Date.now() - P.at < 60e3)) return;
    P.loading = true; P.ws = ws;
    window.Auth.drafts.list(ws, 'waiting').then((rows) => { P.rows = (rows || []).filter((d) => d.kind === 'Post'); P.error = ''; })
      .catch((e) => { P.error = window.Auth.friendly(e); })
      .finally(() => { P.loading = false; P.at = Date.now(); if (location.hash.slice(1) === 'posts') window.App.render(); });
  }
  const aiOn = () => isLive() && (ctx().conns || []).some((c) => (c.provider === 'claude' || c.provider === 'openai' || c.provider === 'perplexity') && c.status === 'connected');
  const apifyOn = () => isLive() && (ctx().conns || []).some((c) => c.provider === 'apify' && c.status === 'connected');

  // Demo: one sample transcript so the posts read like they came from a real video.
  const DEMO_T = "I want to show you the AI business I would start before 2027. Most people are still trying to build an agency with ten services and nobody knows what they sell. I did the opposite. I picked one buyer, local service businesses that already run ads, and I built one tool for them. The tool answers every lead within sixty seconds. That one promise is easy to sell because the owner already knows what a missed lead costs. I charged $497 to set it up and $97 a month to keep it running. My first three clients came from my own content, not cold outreach. The reason it works is that you sell an outcome they already measure. You do not need to code any of this. I built the whole thing inside HighLevel with AI Studio in one afternoon. If you only take one thing from this video, pick the buyer before you pick the tool.";
  function demoWrite(v) {
    const own = window.DNA && window.DNA.offersFor ? window.DNA.offersFor(window.DNA.data()) : { offers: [], funnels: [] };
    const t = v.own && /AI Business/i.test(v.title) ? DEMO_T : '';
    const r = window.PostWriter.rules({ video: v, transcript: t, offers: own.offers, funnels: own.funnels });
    return r.posts.map((p, i) => ({ id: 'dp' + Date.now().toString(36) + i, kind: 'Post', title: p.title, body: p.body, status: 'waiting', created_at: new Date().toISOString(), source: 'Outlier · ' + v.title + ' · Rules',
      meta: { video_id: v.id, url: v.url, video: v.title, author: v.author, views: v.views, x: v.x, own: v.own, format: p.format, angle: p.angle, offer: r.offer, by: 'Rules', transcript: !!t } }));
  }
  function demoSeed() {
    if (P.seeded) return; P.seeded = true;
    const v = mine().find((x) => /AI Business/i.test(x.title)) || mine()[0];
    if (v) P.rows = demoWrite(v);
  }

  /* ---------- screen ---------- */
  function videoRow(v) {
    const id = REAL(v.id) ? v.id : ytId(v.url);
    const th = id ? `<img class="yt-th" src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="ph:yt-th ph">` : '<span class="yt-th ph"></span>';
    const k = keyOf(v); const busy = P.busy[k]; const n = P.rows.filter((d) => String((d.meta || {}).video_id || (d.meta || {}).video) === String(v.id || v.title)).length;
    return `<div class="ps-v">${th}<div class="grow"><b class="ps-vt">${esc(v.title)}</b><span class="meta">${esc(v.author || '')}${v.views ? ' · ' + fmtN(v.views) + ' views' : ''}</span></div>
      <span class="yt-x${v.x >= 1.5 ? ' hot' : ''}" title="Views against the channel median">${xFmt(v.x)}</span>
      <button class="btn sm${n ? '' : ' primary'}" data-action="ps-write" data-k="${esc(k)}" ${busy ? 'disabled' : ''}>${busy ? U.spin + 'Writing' : n ? 'Write again' : icon('edit') + 'Write posts'}</button></div>`;
  }
  function card(d) {
    const m = d.meta || {};
    const busy = P.busy['d' + d.id];
    return `<article class="ps-card" data-id="${esc(d.id)}">
      <div class="ps-tags"><span class="tag">${esc(FMT[m.format] || 'Post')}</span>${m.angle ? `<span class="pill">${esc(m.angle)}</span>` : ''}<span class="meta ps-from">From ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.video || 'a video')}</a>` : esc(m.video || 'a video')}${m.x ? ` · <span class="pv-mult">${xFmt(m.x)}</span>` : ''}</span></div>
      <textarea class="ps-body" data-psbody="${esc(d.id)}" rows="${Math.min(20, Math.max(4, String(d.body || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 85)), 0) + 1))}" aria-label="Post text">${esc(d.body)}</textarea>
      <div class="ps-foot"><span class="meta" data-pswc="${esc(d.id)}">${words(d.body)} words · ${String(d.body || '').length} characters</span><span class="meta">${esc(m.by && m.by !== 'Rules' ? 'Written by ' + m.by + (m.transcript ? ' from the transcript' : '') : m.transcript ? 'Lines pulled from the transcript' : 'Built from the title and your DNA')}</span></div>
      <div class="ps-rw" hidden><input type="text" class="input" data-psnote="${esc(d.id)}" maxlength="400" placeholder="What should change? Shorter, more personal, a different offer"><button class="btn sm" data-action="ps-rewrite" data-id="${esc(d.id)}" ${busy ? 'disabled' : ''}>${busy ? U.spin + 'Rewriting' : 'Rewrite'}</button></div>
      <div class="actions"><button class="btn sm primary" data-action="ps-approve" data-id="${esc(d.id)}">Send to Ideas</button><button class="btn sm" data-action="ps-rwopen" data-id="${esc(d.id)}">Rewrite</button><button class="btn sm" data-action="ps-copy" data-id="${esc(d.id)}">${icon('copy')}Copy</button><button class="btn sm ghost" data-action="ps-pass" data-id="${esc(d.id)}">Pass</button></div>
    </article>`;
  }

  function view() {
    const live = isLive();
    if (live) load(); else demoSeed();
    const vids = list(); const out = vids.filter((v) => v.x >= 1.3); const shown = (out.length ? out : vids).slice(0, 12);
    const onBoard = window.OSBoard ? window.OSBoard.items().filter((x) => x.channel === 'post').length : 0;
    const head = U.title('Posts', 'Videos that beat their median, written up as posts in your voice from what was actually said in them. Send the ones you like to Ideas and approve them on the content board with everything else.',
      `<a class="btn" href="#content">${icon('content')}<span>Content board</span></a>`);
    const writer = live ? (aiOn() ? 'Claude, OpenAI or Perplexity' : 'Rules') : 'Rules';
    const kp = U.kpis([
      { label: 'Outliers to write from', value: String(out.length), delta: VS.psSrc === 'proven' ? 'proven posts, 1.3x or more' : 'your uploads, 1.3x your median or more' },
      { label: 'Waiting for you', value: String(P.rows.length), delta: P.rows.length ? 'posts to read' : 'nothing to read' },
      { label: 'Written posts on the board', value: String(onBoard), delta: 'approved and planned' },
      { label: 'Written by', value: writer, delta: live ? (apifyOn() ? 'transcripts through Apify' : 'connect Apify for transcripts') : 'sample workspace' },
    ]);
    const tabs = U.seg('psSrc', VS.psSrc, [['mine', 'My videos'], ['proven', 'Proven']]);
    const left = `<section class="panel ps-queue"><header><h2>Drafts</h2><span class="meta">${P.rows.length ? P.rows.length + ' post' + (P.rows.length === 1 ? '' : 's') : ''}</span></header>
      ${P.error ? `<p class="auth-msg">${esc(P.error)}</p>` : ''}
      ${live && P.loading && !P.at ? U.empty('Reading your drafts', 'One moment.') : P.rows.length ? `<div class="ps-list">${P.rows.map(card).join('')}</div>` : U.empty('No posts waiting', 'Pick a video on the right and press Write posts. You get two long posts and one short one, written from the transcript in your voice.')}</section>`;
    const right = `<section class="panel ps-src"><header><h2>Write from</h2>${tabs}</header>
      ${shown.length ? `${out.length ? '' : '<p class="meta ps-note">Nothing beat its median by 1.3x yet, so these are your best performers.</p>'}<div class="ps-vids">${shown.map(videoRow).join('')}</div>` : VS.psSrc === 'proven'
        ? U.empty('Nothing proven yet', 'Track creators on the Creators page or run a channel search in Research. Their outliers show up here.')
        : U.empty('No channel connected', 'Connect your YouTube channel in Connections and your uploads show up here, ranked by how far they beat your median.')}
      ${live && !apifyOn() ? '<p class="meta ps-note">Connect Apify in Connections so the posts are written from each video\u2019s transcript, not just its title.</p>' : ''}
      ${!live ? '<p class="meta ps-note">Sample workspace. In your own workspace Claude, OpenAI or Perplexity writes these from the transcript with your Brand DNA.</p>' : ''}</section>`;
    return head + kp + `<div class="ps-grid">${left}${right}</div>`;
  }
  V.posts = view; V.posts.live = view;

  /* ---------- actions ---------- */
  const findD = (id) => P.rows.find((d) => String(d.id) === String(id));
  const bodyOf = (id) => { const t = document.querySelector(`[data-psbody="${CSS.escape(String(id))}"]`); return t ? t.value : (findD(id) || {}).body || ''; };
  async function toBoard(d, body) {
    const m = d.meta || {}; const first = String(body).split('\n').find((l) => l.trim()) || d.title;
    return window.OSBoard.add({ title: String(d.title || first).slice(0, 300), stage: 'suggested', channel: 'post', format: 'post',
      meta: { post_body: body, hook: first.slice(0, 300), from: m.video, author: m.author, outlier: m.x, views_src: m.views, source_url: m.url, angle: m.angle, by: m.by, draft_id: d.id, length: m.format } });
  }

  ACT['ps-write'] = async (el) => {
    const v = list().find((x) => keyOf(x) === el.dataset.k); if (!v) return;
    const k = keyOf(v); P.busy[k] = true; window.App.render();
    try {
      if (!isLive()) { await new Promise((r) => setTimeout(r, 700)); P.rows = demoWrite(v).concat(P.rows); U.toast('3 posts written. Read them on the left.'); }
      else {
        U.toast(apifyOn() ? 'Reading the transcript and writing in your voice. About half a minute.' : 'Writing in your voice. About half a minute.');
        const r = await window.Auth.brainApi('post-write', { workspace_id: ctx().ws.id, video: v });
        P.rows = (r.drafts || []).filter(Boolean).concat(P.rows);
        U.toast(`${(r.drafts || []).length} posts written${r.transcript ? ' from the transcript' : ''}${r.by && r.by !== 'Rules' ? ' by ' + r.by : ''}`);
        window.App.refreshCounts && window.App.refreshCounts();
      }
    } catch (e) { U.toast(window.Auth.friendly(e)); }
    delete P.busy[k]; window.App.render();
  };
  ACT['ps-approve'] = async (el) => {
    const d = findD(el.dataset.id); if (!d) return; const body = bodyOf(d.id).trim(); if (!body) return U.toast('The post is empty');
    el.disabled = true;
    try {
      if (isLive()) { if (body !== d.body) await window.Auth.drafts.save(d.id, { body }); await toBoard(d, body); await window.Auth.drafts.decide(d.id, 'approved'); }
      else await toBoard(d, body);
      P.rows = P.rows.filter((x) => x !== d); U.toast('In Ideas to approve on the content board');
      window.App.refreshCounts && window.App.refreshCounts();
    } catch (e) { el.disabled = false; U.toast(window.Auth.friendly(e)); }
    window.App.render();
  };
  ACT['ps-pass'] = async (el) => {
    const d = findD(el.dataset.id); if (!d) return;
    try { if (isLive()) await window.Auth.drafts.decide(d.id, 'rejected'); P.rows = P.rows.filter((x) => x !== d); U.toast('Passed'); window.App.refreshCounts && window.App.refreshCounts(); }
    catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render();
  };
  ACT['ps-copy'] = (el) => U.copy(bodyOf(el.dataset.id));
  ACT['ps-rwopen'] = (el) => {
    if (!isLive()) return U.toast('In your own workspace, Claude, OpenAI or Perplexity rewrites the post with your note.');
    if (!aiOn()) return U.toast('Connect Claude, OpenAI or Perplexity in Connections to rewrite posts.');
    const c = el.closest('.ps-card'); const r = c && c.querySelector('.ps-rw'); if (!r) return; r.hidden = !r.hidden; if (!r.hidden) r.querySelector('input').focus();
  };
  ACT['ps-rewrite'] = async (el) => {
    const d = findD(el.dataset.id); if (!d) return;
    const note = (document.querySelector(`[data-psnote="${CSS.escape(String(d.id))}"]`) || {}).value || '';
    P.busy['d' + d.id] = true; el.disabled = true; el.innerHTML = U.spin + 'Rewriting';
    try { const r = await window.Auth.brainApi('post-rewrite', { workspace_id: ctx().ws.id, draft_id: d.id, note, body: bodyOf(d.id) }); const u = Array.isArray(r.draft) ? r.draft[0] : r.draft; if (u) Object.assign(d, { body: u.body, meta: u.meta || d.meta }); U.toast('Rewritten by ' + r.by); }
    catch (e) { U.toast(window.Auth.friendly(e)); }
    delete P.busy['d' + d.id]; window.App.render();
  };
  // edits: live word count, saved when the field loses focus
  document.addEventListener('input', (e) => { const t = e.target.closest && e.target.closest('[data-psbody]'); if (!t) return; const w = document.querySelector(`[data-pswc="${CSS.escape(t.dataset.psbody)}"]`); if (w) w.textContent = `${words(t.value)} words · ${t.value.length} characters`; });
  document.addEventListener('change', async (e) => {
    const t = e.target.closest && e.target.closest('[data-psbody]'); if (!t) return; const d = findD(t.dataset.psbody); if (!d || t.value === d.body) return;
    d.body = t.value; if (isLive()) { try { await window.Auth.drafts.save(d.id, { body: t.value }); } catch (ex) { U.toast(window.Auth.friendly(ex)); } }
  });
  document.addEventListener('keydown', (e) => { const i = e.target.closest && e.target.closest('[data-psnote]'); if (i && e.key === 'Enter') { e.preventDefault(); const b = i.parentElement.querySelector('[data-action="ps-rewrite"]'); b && b.click(); } });

  window.OSPosts = { toBoard, reset: () => { P.at = 0; } };
})();

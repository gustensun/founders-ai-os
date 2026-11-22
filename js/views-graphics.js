// Founders AI OS: Graphics. Social posts, carousels, stories, paid ads and YouTube thumbnails
// made from the founder's context, brand kit and graphics that already work for other creators.
// Claude art-directs and writes the copy. GPT-Image-2.6 Sunburst renders each image with the references attached.
(() => {
  const U = window.UI, V = window.V, ACT = window.ACT;
  const { esc, icon } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const onView = () => location.hash.slice(1).split('?')[0] === 'graphics';
  const conn = (p) => isLive() && (ctx().conns || []).some((c) => c.provider === p && c.status === 'connected');
  const ago = (iso) => { if (!iso) return ''; const d = (Date.now() - new Date(iso)) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : Math.round(d / 1440) + ' d ago'; };
  const compact = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));

  const FORMATS = [
    { id: 'carousel', label: 'Carousel', sub: 'Instagram or LinkedIn, 3 to 10 slides', aspects: ['4:5', '1:1'], multi: true },
    { id: 'ig_post', label: 'Instagram post', sub: 'One image for the feed', aspects: ['4:5', '1:1'] },
    { id: 'ad', label: 'Paid ad', sub: 'Meta static ad with ad copy', aspects: ['1:1', '4:5', '9:16'] },
    { id: 'story', label: 'Story or Reel cover', sub: 'Full screen, safe zones kept', aspects: ['9:16'] },
    { id: 'linkedin', label: 'LinkedIn post', sub: 'One image for the feed', aspects: ['4:5', '1:1'] },
    { id: 'thumb', label: 'YouTube thumbnail', sub: 'Readable at phone size', aspects: ['16:9'] },
  ];
  const FMT = Object.fromEntries(FORMATS.map((f) => [f.id, f]));
  window.AISuggest && window.AISuggest.register('graphic', { kind: 'graphic', ctx: () => {
    const f = S.form || {}; const o = (offersList() || []).find((x) => String(x.id) === String(f.offer_id)); const fm = FMT[f.format] || {};
    return { title: fm.name || fm.label || f.format || null, offer_id: o && /^[0-9a-f-]{36}$/i.test(String(o.id)) ? o.id : null, offer_name: o ? o.name : null, context: `Format: ${fm.name || fm.label || f.format || 'graphic'}. Draft what it is about in one or two sentences: the idea, who it is for and the takeaway.${o ? ' It points to ' + o.name + '.' : ' Value only, no offer.'}` };
  } });
  const MODELS = [
    ['openai/gpt-image-2.6-sunburst', 'GPT-Image-2.6 Sunburst', 'Best quality and text. Recommended.'],
    ['google/gemini-nano-banana-2.1', 'Nano Banana 2.1', 'Strong text, a different look.'],
    ['openai/gpt-image-2.6-flare', 'GPT-Image-2.6 Flare', 'Fast drafts.'],
  ];
  const MODEL_NAME = Object.fromEntries(MODELS.map((m) => [m[0], m[1]]));
  const MODES = [['layout', 'Borrow the layout'], ['style', 'Match the style'], ['loose', 'Loose inspiration']];
  const PAL = [['bg', 'Background'], ['ink', 'Ink'], ['accent', 'Accent'], ['deep', 'Deep'], ['soft', 'Soft']];
  const FALLBACK = { bg: '#f6f2ea', ink: '#151311', accent: '#c85f24', deep: '#1d1b18', soft: '#e9e1d3' };
  const RATIO = { '4:5': '4 / 5', '1:1': '1 / 1', '9:16': '9 / 16', '16:9': '16 / 9' };

  const S = { rows: [], at: 0, ws: null, loading: false, error: '', sel: null, compose: false, kit: null, refs: null, refsLoading: false, timer: null, lastTick: 0, busy: {}, demo: null, demoKit: null,
    form: { format: 'carousel', aspect: '4:5', slides: 7, count: 2, brief: '', cta: '', offer_id: '', source: null, picks: [], uploads: [], ref_mode: 'layout', model: MODELS[0][0], use_logo: true, use_photo: true, plat: 'all' } };

  /* ---------- demo ---------- */
  function demoSeed() {
    if (S.demo) return; const D = window.OSGraphicsDemo; S.demo = D ? D.sets() : []; S.demoKit = D ? D.kit() : { kit: { palette: {}, fonts: {}, photos: [] } }; S.sel = S.sel || (S.demo[0] || {}).id || null;
  }
  const rows = () => (isLive() ? S.rows : S.demo || []);
  const find = (id) => rows().find((r) => r.id === id);
  const kit = () => (isLive() ? S.kit : S.demoKit) || { kit: { palette: {}, fonts: {}, photos: [] } };
  // Where an image lives: private per-workspace link in a real workspace, a bundled file in the sample one.
  const src = (name, set) => {
    if (!name) return '';
    if (/^(assets\/|data:|https:)/.test(name)) return name;
    const k = kit().kit || {}; const ws = (set && set.workspace_id) || (isLive() && ctx().ws.id);
    return ws && k.asset_key ? `/g/${ws}/${k.asset_key}/${name}` : '';
  };
  function brand() {
    const K = kit(); const k = K.kit || {}; const fb = K.funnel_brand || {}; const fp = fb.palette || {}; const p = k.palette || {};
    const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : null);
    return {
      palette: { bg: hex(p.bg) || hex(fp.bg) || FALLBACK.bg, ink: hex(p.ink) || hex(fp.ink) || FALLBACK.ink, accent: hex(p.accent) || hex(fp.accent) || FALLBACK.accent, deep: hex(p.deep) || hex(fp.deep) || FALLBACK.deep, soft: hex(p.soft) || hex(fp.surface) || FALLBACK.soft },
      fonts: { display: (k.fonts || {}).display || (fb.fonts || {}).display || 'Bricolage Grotesque', body: (k.fonts || {}).body || (fb.fonts || {}).body || 'Hanken Grotesk' },
      style: k.style || '', handle: k.handle || '', logo: k.logo || null, photos: k.photos || [], saved: !!(k.palette && k.palette.bg),
    };
  }

  /* ---------- live data ---------- */
  function load(force) {
    const ws = ctx().ws.id; if (!ws) return;
    if (S.loading || (!force && S.at && S.ws === ws && Date.now() - S.at < 30e3)) return;
    S.loading = true; if (S.ws !== ws) { S.rows = []; S.sel = null; S.kit = null; S.kitFor = null; S.refs = null; } S.ws = ws;
    Promise.all([window.Auth.gfx.list(ws), window.Auth.gfx.kit(ws)])
      .then(([r, k]) => { S.rows = r; S.kit = k; S.kitFor = ws; S.error = ''; if (!S.sel && r[0]) S.sel = r[0].id; if (!r.length) S.compose = true; })
      .catch((e) => { S.error = /graphic_/.test(e.message || '') ? 'Graphics is being set up. Refresh in a minute.' : window.Auth.friendly(e); })
      .finally(() => { S.loading = false; S.at = Date.now(); if (onView()) window.App.render(true); watch(); });
  }
  async function pull(id) {
    try { const s = await window.Auth.gfx.get(id); const i = S.rows.findIndex((r) => r.id === id); if (i === -1) S.rows.unshift(s); else S.rows[i] = s; return s; } catch (e) { console.error(e); return null; }
  }
  function loadRefs() {
    if (S.refs || S.refsLoading) return; S.refsLoading = true;
    const done = (list) => { S.refs = list; S.refsLoading = false; if (onView()) paint(); };
    if (!isLive()) return done((window.OSGraphicsDemo ? window.OSGraphicsDemo.refs() : []));
    window.Auth.gfx.refs(ctx().ws.id).then((rs) => {
      // Rank each post against its own creator's median, the same way Proven ranks content.
      const by = {}; rs.forEach((r) => { const k = (r.creators && r.creators.name) || 'x'; (by[k] = by[k] || []).push(r.likes || 0); });
      const med = Object.fromEntries(Object.entries(by).map(([k, v]) => { const s = v.slice().sort((a, b) => a - b); return [k, s[Math.floor(s.length / 2)] || 1]; }));
      done(rs.map((r) => { const a = (r.creators && r.creators.name) || ''; return { id: r.id, platform: r.platform, format: r.format, url: r.url, thumb: r.thumb, title: (r.title || '').split('\n')[0].slice(0, 140), likes: r.likes, views: r.views, author: a, x: r.likes ? Math.round((r.likes / Math.max(1, med[a || 'x'])) * 10) / 10 : 0 }; }).sort((a, b) => b.x - a.x));
    }).catch(() => done([]));
  }
  const running = (s) => s && (s.status === 'running' || s.status === 'queued');
  function watch() {
    clearTimeout(S.timer); if (!isLive()) return;
    const live = S.rows.filter(running); if (!live.length) return;
    S.timer = setTimeout(async () => {
      if (!onView() && document.hidden) return watch();
      const ids = live.map((r) => r.id);
      await Promise.all(ids.map(pull));
      if (Date.now() - S.lastTick > 25e3) { S.lastTick = Date.now(); ids.forEach((id) => window.Auth.gfx.api('gfx_tick', { id }).catch(() => {})); }
      ids.forEach((id) => { const s = find(id); if (s && s.status === 'done') U.toast(`${s.title} is ready`); });
      if (onView()) paint(); watch();
    }, 3500);
  }
  // Repaint without losing what the founder is typing.
  function paint() {
    if (!onView()) return;
    const keep = [...document.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, el.value]);
    const y = window.scrollY; window.App.render(true);
    keep.forEach(([k, v]) => { const n = document.querySelector(`[data-keep="${k}"]`); if (n) n.value = v; });
    window.scrollTo(0, y);
  }

  /* ---------- pieces ---------- */
  const state = (s) => s.status === 'failed' ? '<span class="pill neg">Stopped</span>' : running(s) ? `<span class="pill acc">${U.spin}${s.step === 'plan' ? 'Art direction' : 'Rendering'}</span>` : '<span class="pill pos">Ready</span>';
  function thumbOf(s) { const d = (s.slides || []).find((x) => x.asset || x.src); return d ? src(d.src || d.asset, s) : ''; }
  function listHtml() {
    return `<aside class="gx-list" aria-label="Your graphics"><h2 class="workspace-list-title">Your graphics</h2>${rows().map((r) => { const t = thumbOf(r); return `<button class="gx-li${r.id === S.sel && !S.compose ? ' on' : ''}" data-action="gx-sel" data-id="${esc(r.id)}" aria-pressed="${r.id === S.sel && !S.compose}">
      <span class="gx-li-img" style="aspect-ratio:${RATIO[r.aspect] || '1 / 1'}">${t ? `<img src="${esc(t)}" alt="" loading="lazy">` : ''}</span>
      <span class="gx-li-t"><b>${esc(r.title)}</b><span class="meta">${esc((FMT[r.format] || {}).label || r.format)} · ${(r.slides || []).length || ''} ${FMT[r.format] && FMT[r.format].multi ? 'slides' : 'image' + ((r.slides || []).length > 1 ? 's' : '')}</span>${state(r)}</span></button>`; }).join('')}</aside>`;
  }

  function kitStrip() {
    const b = brand(); const K = kit(); const k = K.kit || {};
    return `<div class="gx-kit">
      <div class="gx-sw">${PAL.map(([key, l]) => `<span title="${l} ${b.palette[key]}" style="background:${b.palette[key]}"></span>`).join('')}</div>
      <div class="gx-kit-t"><b>${esc(b.fonts.display)} and ${esc(b.fonts.body)}</b><span class="meta">${b.saved ? 'Your brand board' : K.funnel_brand ? 'From your latest sales page. Open it to make it yours.' : 'Starter kit. Open it to set your colours, fonts, logo and photos.'}${b.handle ? ' · ' + esc(b.handle) : ''}</span></div>
      <div class="gx-kit-media">${b.logo ? `<img src="${esc(src(b.logo))}" alt="Logo" class="gx-logo">` : ''}${(b.photos || []).slice(0, 3).map((p) => `<img src="${esc(src(p))}" alt="Founder photo" class="gx-face">`).join('')}</div>
      <button type="button" class="btn sm" data-action="gx-kit">${icon('edit')}<span>Brand board</span></button>
    </div>${k && (b.logo || (b.photos || []).length) ? `<div class="gx-checks">${b.logo ? `<label class="gx-check"><input type="checkbox" data-gxf="use_logo" ${S.form.use_logo ? 'checked' : ''}> Put my logo on it</label>` : ''}${(b.photos || []).length ? `<label class="gx-check"><input type="checkbox" data-gxf="use_photo" ${S.form.use_photo ? 'checked' : ''}> Use my photos where a person helps</label>` : ''}</div>` : ''}`;
  }

  function refsHtml() {
    loadRefs(); const f = S.form;
    const all = S.refs || []; const plats = [...new Set(all.map((r) => r.platform))];
    const list = all.filter((r) => f.plat === 'all' || r.platform === f.plat).slice(0, 36);
    const picked = new Set(f.picks.map((p) => p.id));
    const n = f.picks.length + f.uploads.length;
    const up = f.uploads.map((u) => `<span class="gx-up"><img src="${esc(u.preview || src(u.name))}" alt="Uploaded reference"><button type="button" class="gx-x" data-action="gx-unup" data-name="${esc(u.name)}" aria-label="Remove">×</button></span>`).join('');
    const links = f.picks.filter((p) => p.pasted).map((p) => `<span class="gx-up"><img src="${esc(p.thumb)}" alt="Linked reference" data-onerr="dim"><button type="button" class="gx-x" data-action="gx-unpick" data-id="${esc(p.id)}" aria-label="Remove">×</button></span>`).join('');
    return `<div class="gx-refs">
      <div class="gx-refs-h"><div class="seg-wrap" role="group" aria-label="Platform">${['all', ...plats].map((p) => `<button type="button" class="chip" aria-pressed="${f.plat === p}" data-action="gx-plat" data-v="${esc(p)}">${esc({ all: 'All', youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', x: 'X', facebook: 'Facebook' }[p] || p)}</button>`).join('')}</div><span class="meta">${n ? `${n} of 8 picked` : 'Pick up to 8'}</span></div>
      ${S.refsLoading && !S.refs ? `<p class="meta">${U.spin} Reading the graphics your creators posted</p>` : list.length ? `<div class="gx-grid">${list.map((r) => `<button type="button" class="gx-ref${picked.has(r.id) ? ' on' : ''}" data-action="gx-pick" data-id="${esc(r.id)}" aria-pressed="${picked.has(r.id)}" title="${esc(r.title)}">
        <img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="gone:.gx-ref">
        <span class="gx-ref-m"><b>${esc(r.author || r.platform)}</b><span>${r.x >= 1.5 ? `<em>${r.x}x</em> ` : ''}${r.likes ? compact(r.likes) + ' likes' : r.views ? compact(r.views) + ' views' : esc(r.format)}</span></span>
        <span class="gx-tick" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div>` : `<p class="meta">No creator graphics yet. Add the creators you watch on the <a href="#creators">Creators</a> page, or upload references below.</p>`}
      <div class="gx-add">
        <label class="btn sm gx-file">${icon('upload')}<span>Upload images</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple data-gxup="ref" hidden></label>
        <div class="gx-link" data-gxlink><input type="url" placeholder="Or paste an image link" aria-label="Image link" data-keep="gx-link"><button type="button" class="btn sm ghost" data-action="gx-link">Add</button></div>
        <label class="gx-mode"><span class="meta">How to use them</span><select data-gxf="ref_mode">${MODES.map(([v, l]) => `<option value="${v}" ${f.ref_mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      ${up || links ? `<div class="gx-ups">${up}${links}</div>` : ''}
    </div>`;
  }

  function offersList() { const d = window.DNA ? window.DNA.data() : { items: [] }; return (d.items || []).filter((i) => i.kind === 'offer').sort((a, b) => (b.included - a.included) || ((+b.price || 0) - (+a.price || 0))); }
  function provenList() { try { return (window.DNA.data().proven || []).slice(0, 30); } catch (e) { return []; } }

  function composer() {
    const f = S.form; const fm = FMT[f.format]; const offers = offersList(); const pv = provenList();
    if (!fm.aspects.includes(f.aspect)) f.aspect = fm.aspects[0];
    const can = !isLive() || conn('openrouter');
    return `<section class="panel gx-new" aria-label="New graphics">
      <header><h2>New graphics</h2>${rows().length ? '<button type="button" class="btn sm ghost" data-action="gx-close">Cancel</button>' : ''}</header>
      <form data-gxform>
      <div class="gx-step"><span class="gx-n">1</span><div class="gx-body"><h3>Format</h3>
        <div class="gx-formats" role="radiogroup" aria-label="Format">${FORMATS.map((x) => `<button type="button" role="radio" aria-checked="${x.id === f.format}" class="gx-fmt${x.id === f.format ? ' on' : ''}" data-action="gx-fmt" data-v="${x.id}"><span class="gx-shape" style="aspect-ratio:${RATIO[x.aspects[0]]}"></span><b>${x.label}</b><span class="meta">${x.sub}</span></button>`).join('')}</div>
        <div class="gx-opts">
          ${fm.aspects.length > 1 ? `<div class="gx-opt"><span class="meta">Size</span><div class="segmented" role="group">${fm.aspects.map((a) => `<button type="button" data-action="gx-aspect" data-v="${a}" aria-pressed="${a === f.aspect}">${a}</button>`).join('')}</div></div>` : `<div class="gx-opt"><span class="meta">Size</span><b>${f.aspect}</b></div>`}
          ${fm.multi ? `<label class="gx-opt"><span class="meta">Slides</span><input type="range" min="3" max="10" value="${f.slides}" data-gxf="slides" aria-label="Slides"><b data-gxout="slides">${f.slides}</b></label>` : `<div class="gx-opt"><span class="meta">${f.format === 'ad' ? 'Angles' : 'Variations'}</span><div class="segmented" role="group">${[1, 2, 3, 4].map((n) => `<button type="button" data-action="gx-count" data-v="${n}" aria-pressed="${n === f.count}">${n}</button>`).join('')}</div></div>`}
        </div></div></div>

      <div class="gx-step" data-sg-scope="graphic"><span class="gx-n">2</span><div class="gx-body"><div class="sg-head"><h3>What is it about</h3>${window.AISuggest ? window.AISuggest.button('graphic') : ''}</div>
        <textarea rows="3" data-gxf="brief" data-keep="gx-brief" placeholder="${f.format === 'ad' ? 'Who it is for and what you are selling. The OS adds the angles.' : 'The idea, in your words. Leave it empty and the OS picks the strongest angle from your Brand DNA and proven content.'}">${esc(f.brief)}</textarea>
        <div class="gx-row">
          <label class="gx-opt grow"><span class="meta">Start from content that worked</span><select data-gxf="source"><option value="">Nothing, use my brief</option>${pv.map((p, i) => `<option value="${i}" ${f.source && f.source.i === i ? 'selected' : ''}>${esc((p.title || '').slice(0, 80))}${p.author ? ' · ' + esc(p.author) : ''}${p.outlier ? ' · ' + p.outlier + 'x' : ''}</option>`).join('')}</select></label>
          <label class="gx-opt grow"><span class="meta">Points to</span><select data-gxf="offer_id"><option value="">No offer, value only</option>${offers.map((o) => `<option value="${esc(o.id)}" ${String(f.offer_id) === String(o.id) ? 'selected' : ''}>${esc(o.name)}${o.price ? ' · ' + esc(o.currency || 'USD') + ' ' + Math.round(o.price) : ''}</option>`).join('')}</select></label>
        </div>
        <input type="text" data-gxf="cta" data-keep="gx-cta" value="${esc(f.cta)}" placeholder="Call to action (optional), for example: Comment FUNNEL for the link" aria-label="Call to action">
      </div></div>

      <div class="gx-step"><span class="gx-n">3</span><div class="gx-body"><h3>References</h3><p class="meta">Graphics from the creators you track, ranked by how far they beat that creator's median. Claude studies why they work and borrows the mechanics, never the words or faces.</p>${refsHtml()}</div></div>

      <div class="gx-step"><span class="gx-n">4</span><div class="gx-body"><h3>Brand</h3>${kitStrip()}</div></div>

      <div class="gx-step"><span class="gx-n">5</span><div class="gx-body"><h3>Model</h3>
        <div class="gx-models" role="radiogroup">${MODELS.map(([v, l, d]) => `<label class="gx-model${f.model === v ? ' on' : ''}"><input type="radio" name="model" value="${v}" ${f.model === v ? 'checked' : ''} data-gxf="model"><b>${l}</b><span class="meta">${d}</span></label>`).join('')}</div>
      </div></div>

      <div class="actions gx-go"><button class="btn primary" ${S.busy.start ? 'disabled' : ''}>${S.busy.start ? U.spin + 'Starting' : icon('sparkle') + `Make ${fm.multi ? 'the carousel' : f.count > 1 ? f.count + ' ' + (f.format === 'ad' ? 'ads' : 'images') : 'it'}`}</button>
        <span class="meta">${isLive() ? (can ? `Art direction by ${conn('claude') ? 'Claude Opus 5.5' : conn('openai') ? 'OpenAI' : 'your AI'}. Images by ${MODEL_NAME[f.model]} through your OpenRouter. ${fm.multi ? 'About 2 minutes for the set.' : 'About a minute.'}` : 'Connect OpenRouter in <a href="#connect">Connections</a> to render images.') : 'Sample workspace: this shows how a set comes together. In your workspace it renders with your keys.'}</span></div>
      </form>
    </section>`;
  }

  function slideCard(s, x) {
    const n = (s.slides || []).length; const url = src(x.src || x.asset, s); const busy = x.state === 'running' || x.state === 'queued';
    const fname = `${(s.title || 'graphic').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${x.i + 1}.jpg`;
    return `<figure class="gx-slide${busy ? ' busy' : ''}${x.state === 'failed' ? ' failed' : ''}" style="--ar:${RATIO[s.aspect] || '1 / 1'}">
      <button type="button" class="gx-img" data-action="gx-open" data-id="${esc(s.id)}" data-i="${x.i}" aria-label="Open image ${x.i + 1}" ${url ? '' : 'disabled'}>
        ${url ? `<img src="${esc(url)}" alt="${esc(x.headline || 'Graphic ' + (x.i + 1))}" loading="lazy">` : ''}
        ${busy ? `<span class="gx-wait"><span>${U.spin}${x.edit ? 'Editing' : x.state === 'queued' ? (s.format === 'carousel' && x.i > 0 && !(s.slides[0] || {}).asset ? 'Waits for slide 1' : 'Queued') : 'Rendering'}</span></span>` : ''}
        ${x.state === 'failed' ? `<span class="gx-wait err"><span>${esc(x.error || 'Did not render')}</span></span>` : ''}
      </button>
      <figcaption><span class="meta">${n > 1 ? (s.format === 'carousel' ? `${x.i + 1}/${n}` : (s.format === 'ad' ? 'Angle ' : 'Option ') + (x.i + 1)) : ''}${x.v > 1 ? ' · v' + x.v : ''}</span>
        <span class="gx-acts">${url && !busy ? `<a class="btn xs ghost" href="${esc(url + (isLive() ? '?dl=' + fname : ''))}" download="${esc(fname)}" aria-label="Download">${icon('download')}</a>` : ''}
        <button type="button" class="btn xs ghost" data-action="gx-open" data-id="${esc(s.id)}" data-i="${x.i}" ${url && !busy ? '' : 'disabled'} aria-label="Edit">${icon('edit')}</button>
        <button type="button" class="btn xs ghost" data-action="gx-redo" data-id="${esc(s.id)}" data-i="${x.i}" ${busy ? 'disabled' : ''} aria-label="Redo">${icon('refresh')}</button></span>
      </figcaption></figure>`;
  }

  function copyBlock(label, text, key) { return text ? `<div class="gx-copy"><div class="gx-copy-h"><span class="meta">${label}</span><button type="button" class="btn xs ghost" data-action="gx-copy" data-k="${esc(key)}">Copy</button></div><p>${esc(text).replace(/\n/g, '<br>')}</p></div>` : ''; }

  function setPanel(s) {
    const f = FMT[s.format] || { label: s.format }; const slides = s.slides || []; const done = slides.filter((x) => x.state === 'done').length;
    const plan = s.plan || {}; const c = s.copy || {}; const refs = ((s.input || {}).ref_assets) || [];
    const progress = running(s) ? `<div class="gx-prog"><span class="gx-bar"><span style="width:${s.step === 'plan' ? 8 : Math.max(12, Math.round((done / Math.max(1, slides.length)) * 100))}%"></span></span><span class="meta">${s.step === 'plan' ? 'Claude is studying the references and your context, then writing the copy and one prompt per image.' : `${done} of ${slides.length} rendered with ${esc(MODEL_NAME[s.model] || 'your image model')}.${s.format === 'carousel' && !done ? ' Slide 1 goes first so the rest can match it.' : ''}`}</span></div>` : '';
    const hashtags = (c.hashtags || []).map((h) => '#' + h).join(' ');
    return `<section class="panel gx-set">
      <header class="gx-set-h"><div><h2>${esc(s.title)}</h2><span class="meta">${esc(f.label)} · ${esc(s.aspect)} · ${esc(MODEL_NAME[s.model] || s.model || '')} · ${esc(ago(s.created_at))}</span></div>
        <div class="actions">${state(s)}${done ? `<button type="button" class="btn sm" data-action="gx-dlall" data-id="${esc(s.id)}">${icon('download')}<span>Download ${done > 1 ? 'all' : ''}</span></button>` : ''}</div></header>
      ${progress}
      ${s.status === 'failed' || s.error ? `<div class="gx-err"><p>${esc(s.error || 'This set stopped.')}</p>${s.status === 'failed' || slides.some((x) => x.state === 'failed') ? `<button type="button" class="btn sm" data-action="gx-retry" data-id="${esc(s.id)}">Try again</button>` : ''}</div>` : ''}
      ${slides.length ? `<div class="gx-slides${s.format === 'carousel' ? ' strip' : ''}" data-ar="${esc(s.aspect)}">${slides.map((x) => slideCard(s, x)).join('')}</div>` : `<div class="gx-plan-wait">${U.spin}<span>Planning the set</span></div>`}
      ${c.ad ? `<div class="gx-sec"><h3>Ad copy</h3>${(c.ad.primary || []).map((t, i) => copyBlock('Primary text ' + (i + 1), t, `ad.primary.${i}`)).join('')}<div class="gx-copy"><div class="gx-copy-h"><span class="meta">Headlines</span><button type="button" class="btn xs ghost" data-action="gx-copy" data-k="ad.headlines">Copy</button></div><ul>${(c.ad.headlines || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div><div class="gx-kv"><span><span class="meta">Description</span>${esc(c.ad.description || '')}</span><span><span class="meta">Button</span>${esc(c.ad.cta || '')}</span></div></div>` : ''}
      ${c.caption ? `<div class="gx-sec"><h3>Caption</h3>${copyBlock('Ready to post', c.caption + (hashtags ? '\n\n' + hashtags : ''), 'caption')}</div>` : ''}
      ${plan.read && plan.read.length ? `<div class="gx-sec"><h3>Why the references work</h3><ol class="gx-read">${plan.read.map((r, i) => { const ra = refs[i]; return `<li>${ra ? `<img src="${esc(src(ra.name, s))}" alt="Reference ${i + 1}">` : `<span class="gx-rn">${esc(r.ref || 'R' + (i + 1))}</span>`}<div><p>${esc(r.why || '')}</p>${r.borrow ? `<p class="meta">Borrowed: ${esc(r.borrow)}</p>` : ''}</div></li>`; }).join('')}</ol></div>` : ''}
      ${plan.art && plan.art.look ? `<div class="gx-sec"><h3>Art direction</h3><dl class="gx-art">${[['Look', plan.art.look], ['Type', plan.art.type], ['Layout', plan.art.layout], ['System', plan.art.system]].filter((x) => x[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>` : ''}
      ${slides.some((x) => x.headline) ? `<div class="gx-sec"><h3>Words on the images</h3><ol class="gx-words">${slides.map((x) => `<li><b>${esc(x.headline)}</b>${x.body ? `<span>${esc(x.body)}</span>` : ''}</li>`).join('')}</ol></div>` : ''}
      <div class="actions gx-foot"><button type="button" class="btn sm" data-action="gx-again" data-id="${esc(s.id)}">${icon('plus')}<span>Make another like this</span></button><button type="button" class="btn sm ghost" data-action="gx-del" data-id="${esc(s.id)}">Delete set</button></div>
    </section>`;
  }

  function view() {
    const live = isLive(); if (live) load(); else demoSeed();
    const rs = rows(); const sel = S.sel ? find(S.sel) : null;
    const head = U.title('Graphics', 'Create carousels, posts, ads and thumbnails from your brand and proven references.',
      `<button class="btn" data-action="gx-kit">${icon('edit')}<span>Brand board</span></button><button class="btn primary" data-action="gx-new">${icon('plus')}<span>New graphics</span></button>`);
    if (S.error) return head + `<section class="panel"><p class="auth-msg">${esc(S.error)}</p></section>`;
    if (live && S.loading && !S.at) return head + `<section class="panel">${U.empty('Loading your graphics', 'One moment.')}</section>`;
    if (!rs.length) return head + composer();
    const main = S.compose || !sel ? composer() : setPanel(sel);
    return head + `<div class="gx-layout">${listHtml()}<div class="gx-col">${main}</div></div>`;
  }
  V.graphics = view; V.graphics.live = view;

  /* ---------- images in ---------- */
  function shrinkFile(file, max, mime) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onerror = () => rej(new Error('Could not read that file'));
      r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('That file is not an image')); im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const g = c.getContext('2d'); if (mime === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(im, 0, 0, c.width, c.height);
        const url = c.toDataURL(mime, 0.88); res({ url, b64: url.slice(url.indexOf(',') + 1) }); }; im.src = r.result; };
      r.readAsDataURL(file);
    });
  }
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  async function uploadOne(file, kind) {
    const png = kind === 'logo' && /png|webp/.test(file.type);
    const mime = png ? 'image/png' : 'image/jpeg'; const ext = png ? 'png' : 'jpg';
    const im = await shrinkFile(file, kind === 'logo' ? 800 : 1600, mime);
    const name = (kind === 'ref' ? 'ref-' : 'kit-' + kind + '-') + rid() + '.' + ext;
    if (isLive()) await window.Auth.gfx.upload(ctx().ws.id, name, mime, im.b64);
    return { name, preview: im.url };
  }

  /* ---------- brand board drawer: palettes, font pairings, custom fonts, logo and photos ---------- */
  const MAX_PHOTOS = 20;
  const kid = () => 'p' + Math.random().toString(36).slice(2, 8);
  // The editable copy of the board. Opened from the saved kit, kept while the drawer is open.
  function kitState() {
    if (S.kitPrev && S.kitPrev.palettes) return S.kitPrev;
    const b = brand(); const k = kit().kit || {}; const prev = S.kitPrev || {};
    const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : d);
    const pals = (Array.isArray(k.palettes) ? k.palettes : []).filter((x) => x && x.colors).map((x) => ({ id: x.id || kid(), name: x.name || 'Palette', default: !!x.default, slides: !!x.slides, slides_logo: x.slides_logo !== false, slides_design: /^(tech|editorial|clean)$/.test(x.slides_design) ? x.slides_design : null, slides_brand_colors: x.slides_brand_colors === true, slides_brand_fonts: x.slides_brand_fonts === true, colors: Object.fromEntries(PAL.map(([c]) => [c, hex(x.colors[c], b.palette[c])])) }));
    if (!pals.length) pals.push({ id: 'main', name: 'Main', default: true, colors: { ...b.palette } });
    if (!pals.some((x) => x.default)) pals[0].default = true;
    const sets = (Array.isArray(k.font_sets) ? k.font_sets : []).filter((x) => x && x.display).map((x) => ({ id: x.id || kid(), name: x.name || 'Pairing', default: !!x.default, slides: !!x.slides, display: x.display, body: x.body || x.display }));
    if (!sets.length) sets.push({ id: 'main', name: 'Main', default: true, display: b.fonts.display, body: b.fonts.body });
    if (!sets.some((x) => x.default)) sets[0].default = true;
    const sp = pals.find((x) => x.slides) || pals.find((x) => x.default) || pals[0], sf = sets.find((x) => x.slides) || sets.find((x) => x.default) || sets[0];
    S.kitPrev = { ...prev, slides: prev.slides || { pal: sp.slides && sp.slides_brand_colors ? sp.id : 'design', fs: sp.slides && sp.slides_brand_fonts ? sf.id : 'design', logo: pals.some((x) => x.slides) ? sp.slides_logo !== false : true, design: (pals.some((x) => x.slides) && sp.slides_design) || 'clean' }, palettes: pals, font_sets: sets, custom_fonts: (Array.isArray(k.custom_fonts) ? k.custom_fonts : []).map((f) => ({ ...f })), photos: prev.photos || b.photos.map((p) => ({ name: p })) };
    return S.kitPrev;
  }
  // Custom fonts show in their own face inside the app.
  function fontFaces(list) {
    let el = document.getElementById('gx-fontfaces'); if (!el) { el = document.createElement('style'); el.id = 'gx-fontfaces'; document.head.appendChild(el); }
    el.textContent = (list || []).filter((f) => f.family && (f.preview || f.file)).map((f) => `@font-face{font-family:"${String(f.family).replace(/["\\<>]/g, '')}";src:url("${f.preview || src(f.file)}");font-display:swap}`).join('');
    // Google Fonts used in the pairings, so each sample line shows the real face.
    const fams = [...new Set((S.kitPrev && S.kitPrev.font_sets || []).flatMap((x) => [x.display, x.body]))].filter((n) => n && !(list || []).some((f) => f.family === n) && /^[A-Za-z0-9 ]{2,40}$/.test(n));
    let ln = document.getElementById('gx-fontlink'); if (!ln) { ln = document.createElement('link'); ln.id = 'gx-fontlink'; ln.rel = 'stylesheet'; document.head.appendChild(ln); }
    const href = fams.length ? 'https://fonts.googleapis.com/css2?' + fams.map((n) => 'family=' + n.replace(/ /g, '+')).join('&') + '&display=swap' : '';
    if (ln.getAttribute('href') !== href) { if (href) ln.href = href; else ln.removeAttribute('href'); }
  }
  // Slides: which palette, pairing and logo Make slides starts from. Stored as markers on the palette and pairing.
  function slidesTheme(K, prev, b) {
    const SL = window.ProgramSlides; if (!SL) return null; const C = K.slides || {};
    const D = (SL.DESIGNS || []).find((x) => x.id === C.design) || (SL.DESIGNS || [])[2] || {};
    const own = C.pal === 'design' || !K.palettes.some((x) => x.id === C.pal), ownF = C.fs === 'design' || !K.font_sets.some((x) => x.id === C.fs);
    const p = own ? { name: D.name + ' colours', colors: D.colors } : K.palettes.find((x) => x.id === C.pal);
    const f = ownF ? { display: D.display, body: D.body } : K.font_sets.find((x) => x.id === C.fs);
    const logo = C.logo && !(prev && prev.logoGone) ? (prev && prev.logo && prev.logo.preview) || (b.logo ? src(b.logo) : '') : '';
    const d = /^(tech|editorial|clean)$/.test(C.design) ? C.design : 'clean';
    return { ...SL.tones(p.colors), grad: own && D.grad ? D.grad : null, design: d, display: f.display, body: f.body, mono: d === 'tech' ? 'Geist Mono' : f.body, logo: logo || null, handle: b.handle || '', name: p.name };
  }
  function slidesPreview(K, prev, b) {
    const SL = window.ProgramSlides, t = slidesTheme(K, prev, b); if (!t) return '';
    SL.styleTag(); SL.loadFonts(t);
    return `<div class="psl-pv">${SL.slideHtml({ type: 'cover', title: 'Your program title', subtitle: 'A short promise for the people taking it.', meta: [['Modules', '6'], ['Lessons', '24']] }, t, 0, 0)}${SL.slideHtml({ type: 'content', layout: 'statement', title: 'One idea per slide, in your headline font', em: 'One idea per slide', module: 'Module name', program: 'Your program title' }, t, 2, 12)}${SL.slideHtml({ type: 'content', layout: 'steps', title: 'A lesson in three steps', module: 'Module name', program: 'Your program title', items: [{ head: 'Body font', text: 'Text in your body font' }, { head: 'Accent', text: 'Marks in your accent colour' }, { head: 'Space', text: 'Room around every idea' }] }, t, 3, 12)}${SL.slideHtml({ type: 'content', layout: 'points', title: 'A lesson slide', module: 'Module name', program: 'Your program title', bullets: ['Points in your body font', 'Markers in your accent colour', 'Headings in your headline font'] }, t, 4, 12)}</div>`;
  }
  function slidesSec(K, prev, b) {
    if (!window.ProgramSlides) return ''; const C = K.slides = K.slides || {};
    if (C.pal !== 'design' && !K.palettes.some((p) => p.id === C.pal)) C.pal = 'design';
    if (C.fs !== 'design' && !K.font_sets.some((f) => f.id === C.fs)) C.fs = 'design';
    if (C.logo == null) C.logo = true;
    const hasLogo = !!((prev && prev.logo && !prev.logoGone && prev.logo.preview) || (b.logo && !(prev && prev.logoGone)));
    return `<div class="dsec gx-slides"><h3>Slides</h3><div class="gx-slides-body"><p class="meta">Make slides in Programs starts from these. Each design has its own colours and fonts, or use your brand's. You can still pick another look for a single deck.</p>
      <div class="gx-row"><label class="gx-opt grow"><span class="meta">Design</span><select data-gxsl="design">${(window.ProgramSlides.DESIGNS || []).map((d) => `<option value="${d.id}" ${d.id === (C.design || 'clean') ? 'selected' : ''}>${esc(d.name)}: ${esc(d.note)}</option>`).join('')}</select></label></div>
      <div class="gx-row"><label class="gx-opt grow"><span class="meta">Colours</span><select data-gxsl="pal"><option value="design" ${C.pal === 'design' ? 'selected' : ''}>The design's own colours</option>${K.palettes.map((p) => `<option value="${esc(p.id)}" ${p.id === C.pal ? 'selected' : ''}>${esc(p.name || 'Palette')}</option>`).join('')}</select></label>
      <label class="gx-opt grow"><span class="meta">Fonts</span><select data-gxsl="fs"><option value="design" ${C.fs === 'design' ? 'selected' : ''}>The design's own fonts</option>${K.font_sets.map((f) => `<option value="${esc(f.id)}" ${f.id === C.fs ? 'selected' : ''}>${esc(f.name || 'Pairing')} (${esc(f.display)}${f.body !== f.display ? ', ' + esc(f.body) : ''})</option>`).join('')}</select></label></div>
      ${hasLogo ? `<label class="gx-check"><input type="checkbox" data-gxsl="logo" ${C.logo ? 'checked' : ''}><span>Logo on the cover slide</span></label>` : ''}
      <div data-gxsl-preview>${slidesPreview(K, prev, b)}</div></div></div>`;
  }
  function kitDrawer() {
    const b = brand(); const D = window.OSFunnel || {}; const K = kitState();
    const customs = K.custom_fonts.map((f) => f.family);
    const opts = (list, v) => { const l = [...new Set([...customs, ...(list || [])])]; if (v && !l.includes(v)) l.unshift(v); return l.map((x) => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x)}${customs.includes(x) ? ' (your font)' : ''}</option>`).join(''); };
    fontFaces(K.custom_fonts);
    const prev = S.kitPrev || {};
    U.drawer(`<div><p class="meta">Graphics and the Funnel Agent use this</p><h2>Brand board</h2></div>
      <form class="gx-kitform" data-gxkit>
        <div class="dsec"><div class="gx-sechead"><h3>Color palettes</h3><button type="button" class="btn sm ghost" data-action="gx-paladd" ${K.palettes.length >= 12 ? 'disabled' : ''}>${icon('plus')}<span>Add palette</span></button></div>
          <div class="gx-sets">${K.palettes.map((p, i) => `<div class="gx-set" data-i="${i}"><div class="gx-sethead"><input class="gx-setname" data-gxpalname="${i}" value="${esc(p.name)}" aria-label="Palette name" maxlength="40"><label class="gx-def"><input type="radio" data-gxpaldef="${i}" ${p.default ? 'checked' : ''}><span>Default</span></label>${K.palettes.length > 1 ? `<button type="button" class="gx-x inline" data-action="gx-palrm" data-i="${i}" aria-label="Remove ${esc(p.name)}">×</button>` : ''}</div>
            <div class="gx-pal">${PAL.map(([k, l]) => `<label><input type="color" data-gxpal="${i}" data-k="${k}" value="${p.colors[k]}" aria-label="${esc(p.name)} ${l}"><span>${l}</span><code>${p.colors[k]}</code></label>`).join('')}</div></div>`).join('')}</div>
          <p class="meta">The default palette is what Graphics uses. Pick any palette when you build a funnel.</p></div>
        <div class="dsec"><div class="gx-sechead"><h3>Font pairings</h3><button type="button" class="btn sm ghost" data-action="gx-fsadd" ${K.font_sets.length >= 12 ? 'disabled' : ''}>${icon('plus')}<span>Add pairing</span></button></div>
          <div class="gx-sets">${K.font_sets.map((f, i) => `<div class="gx-set" data-i="${i}"><div class="gx-sethead"><input class="gx-setname" data-gxfsname="${i}" value="${esc(f.name)}" aria-label="Pairing name" maxlength="40"><label class="gx-def"><input type="radio" data-gxfsdef="${i}" ${f.default ? 'checked' : ''}><span>Default</span></label>${K.font_sets.length > 1 ? `<button type="button" class="gx-x inline" data-action="gx-fsrm" data-i="${i}" aria-label="Remove ${esc(f.name)}">×</button>` : ''}</div>
            <div class="gx-row"><label class="gx-opt grow"><span class="meta">Headlines</span><select data-gxfs="${i}" data-k="display">${opts(D.DISPLAY || [], f.display)}</select></label><label class="gx-opt grow"><span class="meta">Body</span><select data-gxfs="${i}" data-k="body">${opts(D.BODY || [], f.body)}</select></label></div>
            <p class="gx-sample" style="--fd:'${esc(f.display).replace(/'/g, '')}';--fb:'${esc(f.body).replace(/'/g, '')}'"><b>Build the business once.</b> <span>Then let it run while you live.</span></p></div>`).join('')}</div></div>
        <div class="dsec"><h3>Your fonts</h3><div class="gx-fonts">${K.custom_fonts.map((f, i) => `<div class="gx-font"><input class="gx-setname" data-gxcfname="${i}" value="${esc(f.family)}" aria-label="Font family name" maxlength="40" style="font-family:'${esc(f.family).replace(/'/g, '')}',system-ui"><span class="meta">${esc((f.file || '').split('.').pop().toUpperCase())}</span><button type="button" class="gx-x inline" data-action="gx-cfrm" data-i="${i}" aria-label="Remove ${esc(f.family)}">×</button></div>`).join('')}
          ${K.custom_fonts.length < 12 ? `<label class="btn sm gx-file">${icon('upload')}<span>Upload font</span><input type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" multiple data-gxup="font" hidden></label>` : ''}</div>
          <p class="meta">WOFF2, WOFF, TTF or OTF, up to 3 MB each. Uploaded fonts show up in the pairings above and load on your funnel pages.</p></div>
        <div class="dsec"><h3>Look</h3><textarea name="style" rows="3" placeholder="For example: calm editorial, lots of space, real objects in side light, no gradients">${esc(b.style)}</textarea>
          <label class="gx-opt"><span class="meta">Handle on every image (optional)</span><input name="handle" value="${esc(b.handle)}" placeholder="@yourhandle"></label></div>
        <div class="dsec"><h3>Logo</h3><div class="gx-ups">${prev.logo || b.logo ? `<span class="gx-up logo"><img src="${esc(prev.logo ? prev.logo.preview : src(b.logo))}" alt="Logo"><button type="button" class="gx-x" data-action="gx-kitrm" data-k="logo" aria-label="Remove logo">×</button></span>` : ''}<label class="btn sm gx-file">${icon('upload')}<span>${b.logo || prev.logo ? 'Replace' : 'Upload'} logo</span><input type="file" accept="image/png,image/jpeg,image/webp" data-gxup="logo" hidden></label></div><p class="meta">A PNG with a transparent background works best.</p></div>
        ${slidesSec(K, prev, b)}
        <div class="dsec"><div class="gx-sechead"><h3>Your photos</h3><span class="meta">${K.photos.length} of ${MAX_PHOTOS}</span></div><div class="gx-ups">${K.photos.map((p) => `<span class="gx-up"><img src="${esc(p.preview || src(p.name))}" alt="Brand photo"><button type="button" class="gx-x" data-action="gx-kitrm" data-k="photo" data-name="${esc(p.name)}" aria-label="Remove photo">×</button></span>`).join('')}${K.photos.length < MAX_PHOTOS ? `<label class="btn sm gx-file">${icon('upload')}<span>Add photos</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple data-gxup="photo" hidden></label>` : ''}</div><p class="meta">Up to ${MAX_PHOTOS} photos of you and your world. The Funnel Agent can put them on your pages instead of AI images. Graphics use the first 4 to get your likeness right.</p></div>
        <div class="actions"><button class="btn primary">Save brand board</button></div>
      </form>`, { label: 'Brand board' });
  }
  // board(): the saved palettes, font pairings and photos, for the Funnel Agent brief.
  const board = () => { if (!isLive()) demoSeed(); const keepPrev = S.kitPrev; S.kitPrev = null; const K = kitState(); S.kitPrev = keepPrev; return { palettes: K.palettes, font_sets: K.font_sets, custom_fonts: K.custom_fonts, photos: K.photos.map((p) => ({ name: p.name, src: p.preview || src(p.name) })) }; };
  // The kit is cached per workspace, so another screen never draws with the last workspace's colours or photos.
  const kitLoad = () => { if (!isLive()) return Promise.resolve(kit()); const w = ctx().ws.id; if (S.kit && (S.kitFor === w || (!S.kitFor && S.ws === w))) { S.kitFor = w; return Promise.resolve(S.kit); } return window.Auth.gfx.kit(w).then((k) => { if (ctx().ws.id === w) { S.kit = k; S.kitFor = w; } return k; }); };
  // brand(): the default palette, fonts and photos for screens that draw with them. Null until this workspace's kit is loaded.
  const brandNow = () => { if (!isLive()) { demoSeed(); return brand(); } const w = ctx().ws && ctx().ws.id; return S.kit && w && (S.kitFor === w || (!S.kitFor && S.ws === w)) ? brand() : null; };
  window.OSBrandKit = { open: () => { S.kitPrev = null; kitDrawer(); }, board, kit: () => kit(), src: (n) => src(n), load: kitLoad, brand: brandNow };
  ACT['gx-paladd'] = () => { const K = kitState(); const base = (K.palettes.find((p) => p.default) || K.palettes[0]).colors; K.palettes.push({ id: kid(), name: 'Palette ' + (K.palettes.length + 1), default: false, colors: { ...base } }); rekit(); };
  ACT['gx-palrm'] = (el) => { const K = kitState(); const [gone] = K.palettes.splice(+el.dataset.i, 1); if (gone && gone.default && K.palettes[0]) K.palettes[0].default = true; rekit(); };
  ACT['gx-fsadd'] = () => { const K = kitState(); const base = K.font_sets.find((p) => p.default) || K.font_sets[0]; K.font_sets.push({ id: kid(), name: 'Pairing ' + (K.font_sets.length + 1), default: false, display: base.display, body: base.body }); rekit(); };
  ACT['gx-fsrm'] = (el) => { const K = kitState(); const [gone] = K.font_sets.splice(+el.dataset.i, 1); if (gone && gone.default && K.font_sets[0]) K.font_sets[0].default = true; rekit(); };
  ACT['gx-cfrm'] = (el) => { const K = kitState(); const [gone] = K.custom_fonts.splice(+el.dataset.i, 1); if (gone && isLive() && gone.file) window.Auth.gfx.unupload(ctx().ws.id, gone.file).catch(() => {}); rekit(); };
  // Board edits update the editable copy right away, so a redraw never loses them.
  document.addEventListener('input', (e) => {
    const el = e.target; if (!el.closest || !el.closest('[data-gxkit]')) return; const K = S.kitPrev; if (!K || !K.palettes) return;
    if (el.dataset.gxpal != null) { const p = K.palettes[+el.dataset.gxpal]; if (p) { p.colors[el.dataset.k] = el.value; const c = el.parentElement.querySelector('code'); if (c) c.textContent = el.value; } }
    else if (el.dataset.gxpalname != null) { const p = K.palettes[+el.dataset.gxpalname]; if (p) p.name = el.value; }
    else if (el.dataset.gxfsname != null) { const p = K.font_sets[+el.dataset.gxfsname]; if (p) p.name = el.value; }
    else if (el.dataset.gxcfname != null) {
      const f = K.custom_fonts[+el.dataset.gxcfname]; if (!f) return; const old = f.family; f.family = el.value;
      K.font_sets.forEach((x) => { if (x.display === old) x.display = el.value; if (x.body === old) x.body = el.value; });
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target; if (!el.closest || !el.closest('[data-gxkit]')) return; const K = S.kitPrev; if (!K || !K.palettes) return;
    if (el.dataset.gxsl != null) { K.slides = K.slides || {}; K.slides[el.dataset.gxsl] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.gxsl === 'design') K.slides.designTouched = true; const pv = document.querySelector('[data-gxsl-preview]'); if (pv) pv.innerHTML = slidesPreview(K, S.kitPrev, brand()); return; }
    if (el.dataset.gxpaldef != null) { K.palettes.forEach((p, i) => { p.default = i === +el.dataset.gxpaldef; }); rekit(); }
    else if (el.dataset.gxfsdef != null) { K.font_sets.forEach((p, i) => { p.default = i === +el.dataset.gxfsdef; }); rekit(); }
    else if (el.dataset.gxfs != null) { const f = K.font_sets[+el.dataset.gxfs]; if (f) { f[el.dataset.k] = el.value; rekit(); } }
    else if (el.dataset.gxcfname != null) rekit();
  });
  async function uploadFont(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext)) throw new Error('Use a WOFF2, WOFF, TTF or OTF font file');
    if (file.size > 3 * 1024 * 1024) throw new Error(file.name + ' is over 3 MB');
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error('Could not read that file')); r.onload = () => res(String(r.result).slice(String(r.result).indexOf(',') + 1)); r.readAsDataURL(file); });
    const name = 'kit-font-' + rid() + '.' + ext;
    if (isLive()) await window.Auth.gfx.upload(ctx().ws.id, name, 'font/' + ext, b64);
    const family = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_](regular|bold|medium|light|semibold|black|italic|variable|vf|webfont)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'My font';
    return { family, file: name, preview: isLive() ? '' : URL.createObjectURL(file) };
  }

  /* ---------- actions ---------- */
  ACT['gx-new'] = () => { S.compose = true; window.App.render(true); document.querySelector('.gx-new [data-gxf="brief"]')?.focus({ preventScroll: true }); };
  ACT['gx-close'] = () => { S.compose = false; window.App.render(true); };
  ACT['gx-sel'] = async (el) => { S.sel = el.dataset.id; S.compose = false; window.App.render(true); };
  ACT['gx-fmt'] = (el) => { S.form.format = el.dataset.v; const f = FMT[S.form.format]; if (!f.aspects.includes(S.form.aspect)) S.form.aspect = f.aspects[0]; if (S.form.format === 'ad' && S.form.count < 2) S.form.count = 2; paint(); };
  ACT['gx-aspect'] = (el) => { S.form.aspect = el.dataset.v; paint(); };
  ACT['gx-count'] = (el) => { S.form.count = +el.dataset.v; paint(); };
  ACT['gx-plat'] = (el) => { S.form.plat = el.dataset.v; paint(); };
  ACT['gx-pick'] = (el) => {
    const id = el.dataset.id; const f = S.form; const i = f.picks.findIndex((p) => p.id === id);
    if (i >= 0) f.picks.splice(i, 1); else { if (f.picks.length + f.uploads.length >= 8) return U.toast('Eight references is the most that helps'); const r = (S.refs || []).find((x) => x.id === id); if (r) f.picks.push(r); }
    paint();
  };
  ACT['gx-unpick'] = (el) => { S.form.picks = S.form.picks.filter((p) => p.id !== el.dataset.id); paint(); };
  ACT['gx-unup'] = (el) => { const n = el.dataset.name; S.form.uploads = S.form.uploads.filter((u) => u.name !== n); if (isLive()) window.Auth.gfx.unupload(ctx().ws.id, n).catch(() => {}); paint(); };
  ACT['gx-kit'] = () => { S.kitPrev = null; kitDrawer(); };
  ACT['gx-kitrm'] = (el) => { kitState(); if (el.dataset.k === 'logo') S.kitPrev.logo = { name: '', preview: '' }, S.kitPrev.logoGone = true; else S.kitPrev.photos = S.kitPrev.photos.filter((p) => p.name !== el.dataset.name); rekit(); };
  function rekit() { const f = document.querySelector('[data-gxkit]'); const vals = f ? Object.fromEntries([...f.elements].filter((x) => x.name && x.type !== 'radio' && x.type !== 'file').map((x) => [x.name, x.value])) : {}; kitDrawer(); const n = document.querySelector('[data-gxkit]'); if (n) Object.entries(vals).forEach(([k, v]) => { if (n.elements[k]) n.elements[k].value = v; }); if (S.kitPrev && S.kitPrev.logoGone) { const l = n && n.querySelector('.gx-up.logo'); if (l) l.remove(); } }
  ACT['gx-open'] = (el) => {
    const s = find(el.dataset.id); const x = s && s.slides[+el.dataset.i]; if (!x) return;
    const url = src(x.src || x.asset, s); const hist = (x.history || []).slice().reverse();
    U.drawer(`<div><p class="meta">${esc(s.title)} · ${s.format === 'carousel' ? 'Slide ' + (x.i + 1) : 'Image ' + (x.i + 1)}${x.v ? ' · v' + x.v : ''}${x.model ? ' · ' + esc(MODEL_NAME[x.model] || x.model) : ''}</p><h2>${esc(x.headline || 'Graphic')}</h2></div>
      <div class="gx-big" style="aspect-ratio:${RATIO[s.aspect]}"><img src="${esc(url)}" alt="${esc(x.headline || '')}"></div>
      <form class="dsec gx-editform" data-gxedit data-id="${esc(s.id)}" data-i="${x.i}"><h3>Change something</h3><textarea rows="3" data-keep="gx-edit" placeholder="For example: make the headline bigger, swap the glass for a laptop, use the deep colour as the background"></textarea>
        <div class="actions"><button class="btn primary">${icon('sparkle')}Edit this image</button><button type="button" class="btn ghost" data-action="gx-redo" data-id="${esc(s.id)}" data-i="${x.i}">Redo from scratch</button></div>
        <p class="meta">Edits keep everything you did not mention. Each edit becomes a new version.</p></form>
      ${hist.length ? `<div class="dsec"><h3>Earlier versions</h3><div class="gx-hist">${hist.map((h) => `<a href="${esc(src(h.asset, s))}" target="_blank" rel="noopener"><img src="${esc(src(h.asset, s))}" alt="Version ${h.v}"><span class="meta">v${h.v}${h.edit ? ' · ' + esc(h.edit.slice(0, 40)) : ''}</span></a>`).join('')}</div></div>` : ''}
      ${x.prompt ? `<details class="dsec"><summary>The prompt</summary><p class="meta gx-prompt">${esc(x.prompt)}</p></details>` : ''}`, { label: 'Graphic', wide: true });
  };
  async function slideAct(id, i, mode, request) {
    const s = find(id); if (!s) return; const x = s.slides[i];
    if (!isLive()) {
      Object.assign(x, { state: 'running', edit: mode === 'edit' ? request : null }); s.status = 'running'; s.step = 'render'; paint();
      setTimeout(() => { Object.assign(x, { state: 'done', edit: null, v: (x.v || 1) + 1 }); s.status = 'done'; paint(); U.toast('Sample workspace: in your workspace the image is re-rendered with your keys.'); }, 1800);
      return;
    }
    try { await window.Auth.gfx.api('gfx_edit', { id, i, mode, request }); Object.assign(x, { state: 'queued', edit: mode === 'edit' ? request : null }); s.status = 'running'; s.step = 'render'; paint(); watch(); }
    catch (e) { U.toast(window.Auth.friendly(e)); }
  }
  ACT['gx-redo'] = (el) => { U.closeDrawer(); slideAct(el.dataset.id, +el.dataset.i, 'redo'); };
  ACT['gx-retry'] = async (el) => {
    const id = el.dataset.id; if (!isLive()) return U.toast('Sample workspace');
    try { await window.Auth.gfx.api('gfx_retry', { id }); await pull(id); paint(); watch(); } catch (e) { U.toast(window.Auth.friendly(e)); }
  };
  ACT['gx-copy'] = (el) => {
    const s = find(S.sel); if (!s) return; const c = s.copy || {}; const k = el.dataset.k;
    const t = k === 'caption' ? c.caption + ((c.hashtags || []).length ? '\n\n' + c.hashtags.map((h) => '#' + h).join(' ') : '') : k === 'ad.headlines' ? (c.ad.headlines || []).join('\n') : (c.ad.primary || [])[+k.split('.')[2]] || '';
    U.copy(t);
  };
  ACT['gx-dlall'] = async (el) => {
    const s = find(el.dataset.id); if (!s) return; const base = (s.title || 'graphic').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const list = (s.slides || []).filter((x) => x.asset || x.src);
    for (const x of list) { const a = document.createElement('a'); const fn = `${base}-${x.i + 1}.jpg`; a.href = src(x.src || x.asset, s) + (isLive() ? '?dl=' + fn : ''); a.download = fn; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 400)); }
    U.toast(`Downloading ${list.length} image${list.length > 1 ? 's' : ''}`);
  };
  ACT['gx-again'] = (el) => {
    const s = find(el.dataset.id); if (!s) return; const I = s.input || {};
    Object.assign(S.form, { format: s.format, aspect: s.aspect, brief: I.brief || '', cta: I.cta || '', offer_id: I.offer_id || '', ref_mode: I.ref_mode || 'layout', slides: I.slides || 7, count: I.count || 2, model: s.model || MODELS[0][0], picks: (I.picks || []).map((p, k) => ({ ...p, id: p.id || 'again-' + k, pasted: true })) });
    S.compose = true; window.App.render(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  ACT['gx-del'] = async (el) => {
    const id = el.dataset.id; if (!confirm('Delete this set and its images?')) return;
    if (isLive()) { try { await window.Auth.gfx.remove(id); } catch (e) { return U.toast(window.Auth.friendly(e)); } S.rows = S.rows.filter((r) => r.id !== id); } else S.demo = S.demo.filter((r) => r.id !== id);
    S.sel = (rows()[0] || {}).id || null; if (!S.sel) S.compose = true; U.toast('Deleted'); window.App.render(true);
  };

  /* ---------- form events ---------- */
  document.addEventListener('input', (e) => {
    const el = e.target; const k = el.dataset && el.dataset.gxf; if (!k) return;
    if (k === 'slides') { S.form.slides = +el.value; const o = document.querySelector('[data-gxout="slides"]'); if (o) o.textContent = el.value; return; }
    if (k === 'brief' || k === 'cta') S.form[k] = el.value;
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.gxf) {
      const k = el.dataset.gxf;
      if (k === 'use_logo' || k === 'use_photo') S.form[k] = el.checked;
      else if (k === 'source') { const p = provenList()[+el.value]; S.form.source = el.value === '' || !p ? null : { i: +el.value, kind: 'proven', title: p.title, author: p.author, text: p.body || '' }; }
      else if (k === 'model' || k === 'ref_mode' || k === 'offer_id') { S.form[k] = el.value; if (k === 'model') paint(); }
      return;
    }
    if (el.dataset && el.dataset.gxup) {
      const kind = el.dataset.gxup; const files = [...el.files].slice(0, kind === 'ref' ? 8 : kind === 'font' ? 12 : MAX_PHOTOS); if (!files.length) return;
      try {
        U.toast('Uploading');
        if (kind === 'ref') {
          const room = 8 - S.form.picks.length - S.form.uploads.length; if (room <= 0) return U.toast('Eight references is the most that helps');
          for (const f of files.slice(0, room)) S.form.uploads.push(await uploadOne(f, 'ref'));
          paint(); return U.toast('Added');
        }
        const K = kitState();
        if (kind === 'logo') { K.logo = await uploadOne(files[0], 'logo'); K.logoGone = false; }
        else if (kind === 'font') { for (const f of files) { if (K.custom_fonts.length >= 12) break; K.custom_fonts.push(await uploadFont(f)); } }
        else { if (K.photos.length + files.length > MAX_PHOTOS) U.toast(`Up to ${MAX_PHOTOS} photos. The first ${MAX_PHOTOS - K.photos.length} were added.`); for (const f of files) { if (K.photos.length >= MAX_PHOTOS) break; K.photos.push(await uploadOne(f, 'photo')); } }
        rekit(); U.toast('Uploaded. Save the brand board to keep it.');
      } catch (ex) { U.toast(window.Auth && window.Auth.friendly ? window.Auth.friendly(ex) : ex.message); }
    }
  });
  function addLink(box) {
    const inp = box.querySelector('input'); const u = inp.value.trim();
    if (!/^https:\/\//.test(u)) return U.toast('Paste the full image link, starting with https://');
    if (S.form.picks.length + S.form.uploads.length >= 8) return U.toast('Eight references is the most that helps');
    S.form.picks.push({ id: 'link-' + rid(), thumb: u, url: u, title: 'Linked image', pasted: true }); inp.value = ''; paint();
  }
  ACT['gx-link'] = (el) => addLink(el.closest('[data-gxlink]'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-gxlink]')) { e.preventDefault(); addLink(e.target.closest('[data-gxlink]')); } });
  document.addEventListener('submit', async (e) => {
    const f = e.target; if (!f.matches) return;
    if (f.matches('[data-gxkit]')) {
      e.preventDefault(); const v = Object.fromEntries([...f.elements].filter((x) => x.name).map((x) => [x.name, x.value]));
      const b = brand(); const P = kitState();
      // The settings live on one marked palette; with the design's own colours that is the default palette.
      const SC = P.slides || {}, bc = P.palettes.some((p) => p.id === SC.pal), bf = P.font_sets.some((x) => x.id === SC.fs);
      const spal = bc ? SC.pal : (P.palettes.find((p) => p.default) || P.palettes[0]).id, sfs = bf ? SC.fs : null;
      const pals = P.palettes.map((p, i) => ({ id: p.id, name: (p.name || '').trim() || 'Palette ' + (i + 1), default: !!p.default, ...(p.id === spal ? { slides: true, slides_logo: SC.logo !== false, slides_design: /^(tech|editorial|clean)$/.test(SC.design) ? SC.design : 'clean', slides_brand_colors: bc, slides_brand_fonts: bf } : {}), colors: { ...p.colors } }));
      const sets = P.font_sets.map((f, i) => ({ id: f.id, name: (f.name || '').trim() || 'Pairing ' + (i + 1), default: !!f.default, ...(f.id === sfs ? { slides: true } : {}), display: f.display, body: f.body }));
      const dp = pals.find((p) => p.default) || pals[0]; const df = sets.find((f) => f.default) || sets[0];
      const patch = { palette: dp.colors, fonts: { display: df.display, body: df.body }, palettes: pals, font_sets: sets, custom_fonts: P.custom_fonts.map((f) => ({ family: (f.family || '').trim() || 'My font', file: f.file })), style: v.style.trim(), handle: v.handle.trim() };
      if (P.logo) patch.logo = P.logoGone ? '' : P.logo.name; patch.photos = P.photos.map((p) => p.name);
      if (!isLive()) { const k = S.demoKit.kit; Object.assign(k, patch, { custom_fonts: P.custom_fonts.map((f) => ({ ...f })), logo: P.logo ? (P.logoGone ? null : P.logo.preview) : k.logo, photos: P.photos.map((p) => p.preview || p.name) }); if (window.ProgramSlides) { window.ProgramSlides.forget(); if (SC.designTouched && window.ProgramSlides.setPageDesign) window.ProgramSlides.setPageDesign(SC.design); } U.closeDrawer(); U.toast('Brand board saved for this sample session'); return window.App.render(true); }
      try { const k = await window.Auth.gfx.kitSave(ctx().ws.id, patch); S.kit = { ...(S.kit || {}), kit: k }; if (window.ProgramSlides) { window.ProgramSlides.forget(); if (SC.designTouched && window.ProgramSlides.setPageDesign) window.ProgramSlides.setPageDesign(SC.design); } U.closeDrawer(); U.toast('Brand board saved'); window.App.render(true); }
      catch (ex) { U.toast(window.Auth.friendly(ex)); }
      void b; return;
    }
    if (f.matches('[data-gxedit]')) {
      e.preventDefault(); const t = f.querySelector('textarea'); const request = t.value.trim(); if (!request) return t.focus();
      U.closeDrawer(); return slideAct(f.dataset.id, +f.dataset.i, 'edit', request);
    }
    if (f.matches('[data-gxform]')) {
      e.preventDefault(); if (S.busy.start) return; const F = S.form; const fm = FMT[F.format];
      F.brief = (f.querySelector('[data-gxf="brief"]') || {}).value || F.brief; F.cta = (f.querySelector('[data-gxf="cta"]') || {}).value || '';
      if (!isLive()) return demoRun();
      if (!conn('openrouter')) return U.toast('Connect OpenRouter in Connections to render images.');
      if (!conn('claude') && !conn('openai') && !conn('perplexity')) return U.toast('Connect Claude, OpenAI or Perplexity in Connections so the OS can art-direct.');
      S.busy.start = true; paint();
      try {
        const r = await window.Auth.gfx.api('gfx_start', { workspace_id: ctx().ws.id, format: F.format, aspect: F.aspect, model: F.model, brief: F.brief, cta: F.cta, offer_id: F.offer_id || null, source: F.source, picks: F.picks.map((p) => ({ thumb: p.thumb, url: p.url, title: p.title, author: p.author, platform: p.platform, format: p.format, likes: p.likes, views: p.views })), uploads: F.uploads.map((u) => u.name), ref_mode: F.ref_mode, slides: F.slides, count: F.count, use_logo: F.use_logo, use_photo: F.use_photo });
        S.sel = r.id; S.compose = false; await pull(r.id);
        U.toast(fm.multi ? 'Claude is art-directing the carousel. Slides appear as they render.' : 'Claude is art-directing. Images appear as they render.');
        S.form.brief = ''; S.form.cta = ''; S.form.source = null; S.form.picks = []; S.form.uploads = [];
      } catch (ex) { U.toast(window.Auth.friendly(ex)); }
      S.busy.start = false; window.App.render(true); watch();
    }
  });

  // Sample workspace: show the flow with the bundled set.
  function demoRun() {
    const F = S.form; const D = window.OSGraphicsDemo; const base = D.sets()[0]; const id = 'demo-gx-' + rid();
    const n = FMT[F.format].multi ? F.slides : F.count;
    const pool = base.slides; const s = { ...base, id, title: (F.brief || 'New ' + FMT[F.format].label.toLowerCase()).slice(0, 60), format: F.format, aspect: F.aspect, model: F.model, status: 'running', step: 'plan', created_at: new Date().toISOString(), copy: F.format === 'ad' ? (D.sets()[1] || base).copy : base.copy,
      slides: Array.from({ length: n }, (_, i) => ({ ...pool[i % pool.length], i, state: 'queued', v: 1 })) };
    S.demo.unshift(s); S.sel = id; S.compose = false; window.App.render(true);
    setTimeout(() => { s.step = 'render'; paint(); s.slides.forEach((x, i) => setTimeout(() => { x.state = 'running'; paint(); setTimeout(() => { x.state = 'done'; if (s.slides.every((y) => y.state === 'done')) { s.status = 'done'; U.toast('Sample set ready. In your workspace every image is rendered fresh for you.'); } paint(); }, 900); }, i * 500)); }, 1400);
  }

  window.OSGraphicsView = { reset: () => { S.at = 0; }, rows };
})();

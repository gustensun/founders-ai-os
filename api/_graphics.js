// Founders AI OS Graphics: social posts, carousels, stories, paid ads and thumbnails.
// Claude reads the founder's context and the reference graphics, explains why the references work, writes the copy
// and one exact prompt per image. GPT-Image-2.6 Sunburst renders each image with the references attached.
// Carousels render slide 1 first, then the rest with slide 1 attached, so the set looks like one system.
// Runs on the server with a lease and hands itself the next run, like the Funnel Agent.
module.exports = function make(D) {
  const { keys, cron, llm, jsonOut, scrub, later, clip, bad, jf, rpc, sb, q, APP_URL, SECRET, claudeStream } = D;
  const now = () => new Date().toISOString();
  const BUDGET = 170000;
  const save = (id, patch) => cron('cron_gfx_save', { p_id: id, p_patch: patch });
  const slideSave = (id, i, s) => cron('cron_gfx_slide', { p_id: id, p_i: i, p_slide: s });

  const FORMATS = {
    ig_post: { label: 'Instagram post', aspects: ['4:5', '1:1'], multi: false },
    carousel: { label: 'Carousel', aspects: ['4:5', '1:1'], multi: true },
    story: { label: 'Story or Reel cover', aspects: ['9:16'], multi: false },
    ad: { label: 'Paid ad', aspects: ['1:1', '4:5', '9:16'], multi: false },
    linkedin: { label: 'LinkedIn post', aspects: ['4:5', '1:1'], multi: false },
    thumb: { label: 'YouTube thumbnail', aspects: ['16:9'], multi: false },
  };
  const MODELS = {
    'openai/gpt-image-2.6-sunburst': 'GPT-Image-2.6 Sunburst',
    'google/gemini-nano-banana-2.1': 'Nano Banana 2.1',
    'openai/gpt-image-2.6-flare': 'GPT-Image-2.6 Flare',
  };
  const CHAIN = ['openai/gpt-image-2.6-sunburst', 'google/gemini-nano-banana-2.1', 'openai/gpt-image-2'];
  // Sunburst renders 3:4, not 4:5. The art is composed with safe margins and cropped to an exact 4:5.
  const RENDER = { '4:5': '3:4', '1:1': '1:1', '9:16': '9:16', '16:9': '16:9' };
  const SIZE = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920], '16:9': [1280, 720] };
  const PX = { '4:5': '1080 x 1350', '1:1': '1080 x 1080', '9:16': '1080 x 1920', '16:9': '1280 x 720' };

  /* ---------- images in and out ---------- */
  const sharp = () => require('sharp');
  async function shrink(buf, max = 1024) {
    try { const out = await sharp()(buf).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 86 }).toBuffer(); return out; } catch { return null; }
  }
  // The final file: exact platform size, JPEG, ready to post.
  async function finish(b64, aspect) {
    const [W, H] = SIZE[aspect] || SIZE['1:1'];
    const out = await sharp()(Buffer.from(b64, 'base64')).resize({ width: W, height: H, fit: 'cover', position: 'centre' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return out.toString('base64');
  }
  function okUrl(u) {
    try { const x = new URL(u); if (x.protocol !== 'https:') return false; const h = x.hostname; if (/^(localhost|.*\.local|.*\.internal)$/i.test(h) || /^[0-9.]+$/.test(h) || h.includes(':')) return false; return true; } catch { return false; }
  }
  async function fetchImage(url) {
    if (!okUrl(url)) return null;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'image/*' } });
      if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) return null;
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 12e6) return null;
      return await shrink(buf);
    } catch { return null; } finally { clearTimeout(t); }
  }
  const getAsset = async (ws, name) => { const a = await cron('cron_gfx_asset_get', { p_ws: ws, p_name: name }).catch(() => null); return a && a.data ? a : null; };

  async function render(K, model, prompt, aspect, refs) {
    if (!K.openrouter || !K.openrouter.key) throw bad('Connect OpenRouter in Connections to make graphics.', 409);
    const list = [model, ...CHAIN].filter((m, i, a) => m && a.indexOf(m) === i);
    let last;
    for (const m of list) {
      try {
        const body = { model: m, prompt, aspect_ratio: RENDER[aspect] || '1:1', resolution: '1K', n: 1, ...(/gpt-image/.test(m) ? { quality: 'high' } : {}) };
        if (refs.length) body.input_references = refs.slice(0, 16).map((r) => ({ type: 'image_url', image_url: { url: 'data:' + r.mime + ';base64,' + r.data } }));
        const j = await jf('OpenRouter images', 'https://openrouter.ai/api/v1/images', { method: 'POST', timeout: 175000, headers: { Authorization: 'Bearer ' + K.openrouter.key, 'Content-Type': 'application/json', 'HTTP-Referer': APP_URL, 'X-Title': 'Founders AI OS' }, body: JSON.stringify(body) });
        const d = j && j.data && j.data[0];
        let b64 = d && d.b64_json;
        if (!b64 && d && d.url && /^data:image\//.test(d.url)) b64 = d.url.slice(d.url.indexOf(',') + 1);
        if (b64) return { b64: await finish(b64, aspect), model: m };
        last = bad(m + ' sent no image', 502);
      } catch (e) {
        last = e;
        if (e.status === 402 || /credit|insufficient|balance/i.test(e.message || '')) throw bad('OpenRouter is out of credits. Top up and press Try again.', 402);
        if (e.status === 401) throw bad('OpenRouter rejected the key. Update it in Connections.', 401);
      }
    }
    throw last || bad('No image model answered', 502);
  }

  /* ---------- the brand kit ---------- */
  const FALLBACK = { bg: '#f6f2ea', ink: '#151311', accent: '#c85f24', deep: '#1d1b18', soft: '#e9e1d3' };
  function kitOf(k) {
    const kit = (k && k.kit) || {}; const fb = (k && k.funnel_brand) || {}; const fp = fb.palette || {};
    const hex = (v) => /^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : null;
    const p = kit.palette || {};
    const palette = { bg: hex(p.bg) || hex(fp.bg) || FALLBACK.bg, ink: hex(p.ink) || hex(fp.ink) || FALLBACK.ink, accent: hex(p.accent) || hex(fp.accent) || FALLBACK.accent, deep: hex(p.deep) || hex(fp.deep) || FALLBACK.deep, soft: hex(p.soft) || hex(fp.surface) || hex(fp.line) || FALLBACK.soft };
    const fonts = { display: clip((kit.fonts || {}).display, 60) || (fb.fonts || {}).display || 'Bricolage Grotesque', body: clip((kit.fonts || {}).body, 60) || (fb.fonts || {}).body || 'Hanken Grotesk' };
    return { palette, fonts, style: clip(kit.style, 1200) || clip(fb.notes, 600) || '', handle: clip(kit.handle, 60) || '', logo: kit.logo || null, photos: Array.isArray(kit.photos) ? kit.photos.slice(0, 4) : [] }; // the first four are the likeness references for image models
  }

  /* ---------- context ---------- */
  function context(inp, s) {
    const I = s.input || {};
    const offers = (inp.offers || []).filter((o) => o.kind === 'offer').slice(0, 14).map((o) => `- ${o.name}${o.price ? ' (' + o.price + ' ' + (o.currency || 'USD') + (o.price_note ? ', ' + o.price_note : '') + ')' : ''}${o.summary ? ': ' + clip(o.summary, 220) : ''}${o.url ? ' ' + o.url : ''}`).join('\n');
    const offer = I.offer_id ? (inp.offers || []).find((o) => String(o.id) === String(I.offer_id)) : null;
    const proven = (inp.proven || []).slice(0, 12).map((p) => `- "${clip(p.title, 140)}" by ${p.author || 'a creator'} on ${p.platform}, ${p.outlier}x their median`).join('\n');
    const facts = (inp.facts || []).slice(0, 30).map((f) => `- ${f.statement}`).join('\n');
    const voice = inp.voice ? clip(inp.voice.ai_guide || inp.voice.guide, 2500) : '';
    const w = inp.workspace || {};
    return `FOUNDER: ${w.owner || 'the founder'}, brand "${w.name || ''}"
${inp.dna ? 'BRAND DNA (the founder\'s own context, always true):\n' + clip(typeof inp.dna === 'string' ? inp.dna : JSON.stringify(inp.dna), 7000) : ''}
${offers ? '\nOFFERS (only use these names and prices):\n' + offers : ''}
${offer ? `\nTHIS PIECE POINTS TO: ${offer.name}${offer.price ? ' (' + offer.price + ' ' + (offer.currency || 'USD') + ')' : ''}. ${clip(offer.summary, 600) || ''} ${offer.url || ''}` : ''}
${facts ? '\nFOUNDER FACTS (approved, use them as proof, never invent others):\n' + facts : ''}
${voice ? '\nHOW THE FOUNDER WRITES:\n' + voice : ''}
${proven ? '\nCONTENT THAT ALREADY WORKS IN THIS NICHE (outliers from tracked creators, borrow the angle, never the words):\n' + proven : ''}`;
  }

  const SYS = 'You are the art director and copy chief for one founder inside Founders AI OS. You make scroll-stopping social graphics and paid ads that look like a top studio made them for this founder\'s brand. You start from what already works: you study the reference graphics and explain exactly why they stop the scroll, then you apply those mechanics to the founder\'s own message. Copy rules: plain words, short lines, specific numbers only when they are in the founder\'s facts, the reader\'s own language. Never use em dashes, exclamation points, emojis, hype words (game-changer, unlock, supercharge, revolutionize, skyrocket, seamless, effortless, elevate), formulaic contrast lines ("it is not X, it is Y"), rhetorical triplets or filler. Never invent testimonials, customer counts, revenue figures, results or logos. Never copy a reference\'s words, logo, face or brand name.';

  function shape(f, n, aspect, kit) {
    const isAd = f === 'ad'; const multi = FORMATS[f].multi;
    return `{"title":"short name for this set","read":[{"ref":"R1","why":"one sentence on why it stops the scroll","borrow":"the mechanics to borrow: layout, hierarchy, contrast, pacing"}],"art":{"look":"two sentences on the look","type":"the type treatment","layout":"the grid and margins","system":"${multi ? 'what repeats on every slide so the set reads as one system' : 'what makes it unmistakably this founder'}"},"slides":[${Array.from({ length: Math.min(n, 2) }, (_, i) => `{"role":"${multi ? (i === 0 ? 'hook' : 'point') : isAd ? 'angle' : 'post'}","headline":"words on the image, max 9","body":"supporting words on the image, max 28, or empty","prompt":"the full image prompt"}`).join(',')}${n > 2 ? ',...' : ''}],"caption":"${isAd ? 'empty' : 'the post caption in the founder\'s voice, 60 to 160 words, ends with a clear next step'}","hashtags":[${isAd || f === 'thumb' ? '' : '"5 to 8 specific hashtags without #"'}],"ad":${isAd ? '{"primary":["3 primary texts, 40 to 120 words each, different hooks"],"headlines":["5 headlines, max 40 characters"],"description":"max 30 characters","cta":"Learn More or Sign Up or Shop Now or Download or Book Now"}' : 'null'},"alt":"alt text for the first image"}
Exactly ${n} slides. Aspect ${aspect} (${PX[aspect]}).`;
  }

  function promptRules(f, aspect, kit, refN, hasLogo, photoN) {
    const P = kit.palette;
    return `Rules for every "prompt" (it goes straight to GPT-Image-2.6, a model that renders text well and follows layout instructions literally):
- Start with the format: "${FORMATS[f].label}, ${aspect} ${aspect === '4:5' ? 'portrait (it is cropped from 3:4, keep every word and key element inside the middle 90 percent of the height)' : ''}".
- Quote every word that appears on the image exactly, in double quotes, and say where it sits and how big. Say "no other text". Headline max 9 words. Keep it legible on a phone.
- Typography: describe it, do not just name it. Headline in the style of ${kit.fonts.display} (say weight, case, tracking, size relative to the canvas). Supporting text in the style of ${kit.fonts.body}.
- Colours by hex from this brand kit: background ${P.bg}, ink ${P.ink}, accent ${P.accent} used sparingly, deep ${P.deep}, soft ${P.soft}. One dominant background per image.
- Describe the composition: grid, margins, focal point, what the eye reads first, second and third. Describe the visual element (photo, object, diagram, chart, screenshot-style card, icon) in concrete physical terms.
${kit.handle ? `- Put "${kit.handle}" small in the same corner of every image.\n` : ''}${refN ? `- The renderer gets ${refN} reference image${refN > 1 ? 's' : ''} (R1 to R${refN}). Say which reference mechanics to borrow, for example "same split layout and oversized number as R1". Never copy their words, logos, faces or brand.\n` : ''}${hasLogo ? '- The renderer gets the founder\'s logo. Say where it sits, small.\n' : ''}${photoN ? `- The renderer gets ${photoN} photo${photoN > 1 ? 's' : ''} of the founder. Use the founder where a person helps (hooks, thumbnails, ads) and say "the founder from the attached photo, exact likeness". Never invent another face.\n` : '- No real people\'s faces unless they are generic and not the focus.\n'}- No fake UI text, no lorem ipsum, no watermarks, no stock-photo clichés, no glowing brains or robots.
${f === 'carousel' ? '- Carousel: slide 1 is the hook and has a small swipe cue. Middle slides each carry one idea. The last slide is the call to action pointing to the offer or a comment keyword. Every slide carries a small page marker like "2/7". Same margins, type sizes and background system on every slide.\n' : ''}${f === 'thumb' ? '- Thumbnail: max 4 words on the image, huge, high contrast, one face or object, readable at 120 px wide.\n' : ''}${f === 'ad' ? '- Paid ad: each slide is a different angle (pain, outcome, proof, offer). Text on the image stays under 20 percent of the area. Clear product or offer visual.\n' : ''}${f === 'story' ? '- Story: keep the top 250 px and bottom 300 px free of text for the platform UI.\n' : ''}`;
  }

  /* ---------- step: plan ---------- */
  async function stepPlan(s, inp, K, kit) {
    const I = s.input || {};
    // Bring in the references once, so later runs never depend on links that expire.
    const refs = [];
    const have = Array.isArray(I.ref_assets) ? I.ref_assets : null;
    if (have) {
      for (const r of have) { const a = await getAsset(s.workspace_id, r.name); if (a) refs.push({ ...r, mime: a.mime, data: a.data }); }
    } else {
      for (const name of (I.uploads || []).slice(0, 8)) { const a = await getAsset(s.workspace_id, name); if (a) refs.push({ name, label: 'Uploaded reference', mime: a.mime, data: a.data }); }
      const picks = (I.picks || []).slice(0, 8);
      const got = await Promise.all(picks.map((p) => fetchImage(p.thumb || p.url)));
      for (let i = 0; i < picks.length; i++) {
        if (!got[i] || refs.length >= 8) continue;
        const p = picks[i]; const name = `ref-${s.id.slice(0, 8)}-${i + 1}.jpg`; const data = got[i].toString('base64');
        await cron('cron_gfx_asset_put', { p_ws: s.workspace_id, p_set: s.id, p_name: name, p_mime: 'image/jpeg', p_data: data });
        refs.push({ name, label: [p.platform, p.format, p.author ? 'by ' + p.author : '', p.likes ? p.likes + ' likes' : '', p.views ? p.views + ' views' : '', p.title ? '"' + clip(p.title, 120) + '"' : ''].filter(Boolean).join(' '), mime: 'image/jpeg', data });
      }
    }
    const n = FORMATS[s.format].multi ? Math.max(3, Math.min(10, Number(I.slides) || 7)) : Math.max(1, Math.min(4, Number(I.count) || 1));
    const hasLogo = !!kit.logo && I.use_logo !== false; const photoN = I.use_photo === false ? 0 : kit.photos.length;
    const src = I.source && I.source.title ? `\nSTART FROM THIS (${I.source.kind || 'idea'}): "${clip(I.source.title, 200)}"${I.source.text ? '\n' + clip(I.source.text, 2500) : ''}${I.source.author ? '\nBy ' + I.source.author + '. Borrow the angle and structure, write it new for this founder.' : ''}` : '';
    const mode = { style: 'Match the references closely in style: layout, type treatment, colour blocking and pacing, in the founder\'s brand colours.', layout: 'Borrow the references\' layout and hierarchy, but the look is the founder\'s brand kit.', loose: 'Use the references as loose inspiration only.' }[I.ref_mode] || 'Borrow the references\' layout and hierarchy, but the look is the founder\'s brand kit.';
    const task = `${context(inp, s)}

BRAND KIT: palette ${JSON.stringify(kit.palette)}; headline font ${kit.fonts.display}; body font ${kit.fonts.body}${kit.style ? '; look: ' + kit.style : ''}${kit.handle ? '; handle ' + kit.handle : ''}.

MAKE: ${FORMATS[s.format].label}, ${n} ${FORMATS[s.format].multi ? 'slides' : n > 1 ? 'variations, each a different angle' : 'image'}, aspect ${s.aspect}.
BRIEF FROM THE FOUNDER: ${clip(I.brief, 2500) || 'Pick the strongest angle from the context and the proven content.'}${src}
${I.cta ? 'CALL TO ACTION: ' + clip(I.cta, 200) : ''}
${refs.length ? `REFERENCES: ${refs.length} image${refs.length > 1 ? 's' : ''} attached as R1 to R${refs.length}. ${mode}` : 'No reference images. Use what works in the proven content and the brand kit.'}

${promptRules(s.format, s.aspect, kit, refs.length, hasLogo, photoN)}
Return only this JSON:
${shape(s.format, n, s.aspect, kit)}`;
    let j = null; let by = '';
    if (K.claude && K.claude.key) {
      const content = [];
      refs.forEach((r, i) => { content.push({ type: 'text', text: `R${i + 1}: ${r.label || 'reference'}` }); content.push({ type: 'image', source: { type: 'base64', media_type: r.mime, data: r.data } }); });
      content.push({ type: 'text', text: task });
      const out = await claudeStream(K.claude.key, SYS, [{ role: 'user', content }], Date.now() + 150000);
      j = jsonOut(out.text); by = 'claude-opus-5-5';
    }
    if (!j) { const r = await llm(K, SYS, task + (refs.length ? '\n(You cannot see the references here. Use the labels above.)' : '') + '\n\nReturn only one JSON object.', 7000); j = jsonOut(r.text); by = r.by; }
    if (!j || !Array.isArray(j.slides) || !j.slides.length) throw bad('The art director did not return a usable plan. Retrying.', 502);
    j = scrub(j);
    const slides = j.slides.slice(0, n).map((x, i) => ({ i, role: clip(x.role, 20) || '', headline: clip(x.headline, 160) || '', body: clip(x.body, 400) || '', prompt: clip(x.prompt, 4000) || '', state: 'queued', v: 0 }));
    const copy = { caption: clip(j.caption, 3000) || '', hashtags: (Array.isArray(j.hashtags) ? j.hashtags : []).map((h) => String(h).replace(/^#/, '').replace(/\s+/g, '')).filter(Boolean).slice(0, 10), ad: j.ad && typeof j.ad === 'object' ? { primary: (j.ad.primary || []).slice(0, 3), headlines: (j.ad.headlines || []).slice(0, 5), description: clip(j.ad.description, 60) || '', cta: clip(j.ad.cta, 30) || 'Learn More' } : null, alt: clip(j.alt, 300) || '' };
    const plan = { read: (j.read || []).slice(0, 8), art: j.art || {}, by };
    return { title: clip(j.title, 120), plan, slides, copy, ref_assets: refs.map((r) => ({ name: r.name, label: r.label })) };
  }

  /* ---------- step: render ---------- */
  function suffix(slide, n, refN, hasLogo, photoN, chain) {
    let k = 0; const parts = [];
    if (refN) { parts.push(`Input images ${k + 1}${refN > 1 ? ' to ' + (k + refN) : ''} are reference graphics from other creators (R1${refN > 1 ? ' to R' + refN : ''}). Borrow only their layout, hierarchy, contrast and pacing. Do not copy their words, logos, faces or brand.`); k += refN; }
    if (hasLogo) { k++; parts.push(`Input image ${k} is the founder's logo. Reproduce it faithfully, small.`); }
    if (photoN) { parts.push(`Input image${photoN > 1 ? 's' : ''} ${k + 1}${photoN > 1 ? ' to ' + (k + photoN) : ''} ${photoN > 1 ? 'are photos' : 'is a photo'} of the founder. If a person appears, it is this exact person with an accurate likeness.`); k += photoN; }
    if (chain) { k++; parts.push(`Input image ${k} is slide 1 of this carousel. Match its design system exactly: background, margins, type sizes, colours and page marker style.`); }
    return `${slide.prompt}\n\n${parts.join(' ')}\nRender every quoted word exactly as written, spelled correctly. No other text. ${n > 1 && slide.role !== 'angle' ? `This is image ${slide.i + 1} of ${n}.` : ''}`.trim();
  }
  async function loadRefs(s, kit) {
    const I = s.input || {};
    const style = []; for (const r of (I.ref_assets || []).slice(0, 8)) { const a = await getAsset(s.workspace_id, r.name); if (a) style.push(a); }
    const logo = kit.logo && I.use_logo !== false ? await getAsset(s.workspace_id, kit.logo) : null;
    const photos = []; if (I.use_photo !== false) for (const p of kit.photos) { const a = await getAsset(s.workspace_id, p); if (a) photos.push(a); }
    return { style, logo, photos };
  }
  async function renderOne(s, K, R, slide, first) {
    const n = (s.slides || []).length; const chain = s.format === 'carousel' && slide.i > 0 && first;
    let refs; let prompt;
    if (slide.edit && slide.asset) {
      const cur = await getAsset(s.workspace_id, slide.asset);
      refs = [cur, ...(R.logo ? [R.logo] : []), ...R.photos.slice(0, 2)].filter(Boolean);
      prompt = `Edit input image 1. Change only this: ${slide.edit}\nKeep everything else exactly as it is: layout, all other text, colours, typography, people and margins. Render every word correctly spelled.${R.logo ? ' Input image 2 is the founder\'s logo.' : ''}${R.photos.length ? ' The other input images are photos of the founder; keep the founder\'s exact likeness.' : ''}`;
    } else {
      refs = [...R.style, ...(R.logo ? [R.logo] : []), ...R.photos, ...(chain ? [first] : [])];
      prompt = suffix(slide, n, R.style.length, !!R.logo, R.photos.length, chain);
    }
    const t0 = Date.now();
    const img = await render(K, s.model || CHAIN[0], prompt, s.aspect, refs);
    const v = (slide.v || 0) + 1; const name = `s-${s.id.slice(0, 8)}-${slide.i + 1}-v${v}.jpg`;
    await cron('cron_gfx_asset_put', { p_ws: s.workspace_id, p_set: s.id, p_name: name, p_mime: 'image/jpeg', p_data: img.b64 });
    const history = [...(slide.history || []), ...(slide.asset ? [{ asset: slide.asset, v: slide.v, edit: slide.last_edit || null }] : [])].slice(-6);
    const done = { state: 'done', asset: name, v, model: img.model, secs: Math.round((Date.now() - t0) / 1000), history, edit: null, last_edit: slide.edit || null, error: null, at: now() };
    await slideSave(s.id, slide.i, done);
    return { ...slide, ...done, b64: img.b64 };
  }

  /* ---------- the loop ---------- */
  async function loop(id) {
    const t0 = Date.now();
    let s = await cron('cron_gfx_claim', { p_id: id, p_secs: 295 }); if (!s) return { busy: true };
    if (s.status === 'done' || s.status === 'failed') { await save(id, { release: true }); return { done: true }; }
    let K; let inp; let kit;
    try { [K, inp, kit] = await Promise.all([keys(s.workspace_id), cron('cron_funnel_inputs', { p_ws: s.workspace_id }).then(x=>require('./_strategy').cronInput(s.workspace_id,x)), cron('cron_gfx_kit', { p_ws: s.workspace_id }).then(kitOf)]); }
    catch (e) { await save(id, { status: 'failed', error: clip(e.message, 300), release: true }); return { error: e.message }; }
    try {
      if (s.step === 'plan') {
        await save(id, { status: 'running' });
        let p; try { p = await stepPlan(s, inp, K, kit); } catch (e) { if (e.code === 409) throw e; p = await stepPlan({ ...s, input: s.input }, inp, K, kit); }
        await save(id, { title: p.title || s.title, plan: p.plan, slides: p.slides, copy: p.copy, input_merge: { ref_assets: p.ref_assets }, step: 'render', status: 'running', error: null });
        s = await cron('cron_gfx_get', { p_id: id });
      }
      if (s.step === 'render') {
        if (!K.openrouter || !K.openrouter.key) throw bad('Connect OpenRouter in Connections to make graphics.', 409);
        const R = await loadRefs(s, kit);
        for (let round = 0; round < 6; round++) {
        const slides = s.slides || [];
        const pending = () => slides.filter((x) => x.state === 'queued' || x.state === 'running' || x.state === 'failed' && (x.tries || 0) < 2);
        let first = null;
        if (s.format === 'carousel') { const f = slides[0]; if (f && f.state === 'done' && f.asset) first = await getAsset(s.workspace_id, f.asset); }
        while (pending().length && Date.now() - t0 < BUDGET) {
          let batch = pending();
          // Carousel: slide 1 sets the system. Render it alone first, then the rest in parallel with it attached.
          if (s.format === 'carousel' && !first && !slides[0].edit) batch = batch.filter((x) => x.i === 0).slice(0, 1);
          if (!batch.length) batch = pending().slice(0, 1);
          batch.forEach((x) => { x.state = 'running'; });
          await Promise.all(batch.map((x) => slideSave(id, x.i, { state: 'running', at: now() })));
          const res = await Promise.allSettled(batch.map((x) => renderOne(s, K, R, x, first)));
          for (let k = 0; k < batch.length; k++) {
            const x = batch[k]; const r = res[k];
            if (r.status === 'fulfilled') { Object.assign(x, r.value); if (s.format === 'carousel' && x.i === 0) first = { mime: 'image/jpeg', data: r.value.b64 }; delete x.b64; }
            else {
              const e = r.reason || {}; if (e.code === 402 || e.code === 401 || e.code === 409) throw e;
              x.state = 'failed'; x.tries = (x.tries || 0) + 1; x.error = clip(e.message, 200);
              await slideSave(id, x.i, { state: 'failed', tries: x.tries, error: x.error });
            }
          }
        }
        if (pending().length) { await save(id, { release: true }); await kick(id); return { more: true }; }
        // An edit can arrive while this run works. Pick it up before closing.
        const fresh = await cron('cron_gfx_get', { p_id: id });
        if ((fresh.slides || []).some((x) => x.state === 'queued')) {
          if (Date.now() - t0 > BUDGET) { await save(id, { release: true }); await kick(id); return { more: true }; }
          s = fresh; continue;
        }
        s = fresh;
        const bad1 = (s.slides || []).filter((x) => x.state !== 'done');
        const all = (s.slides || []).length;
        await save(id, { step: 'done', status: bad1.length === all ? 'failed' : 'done', error: bad1.length ? `${bad1.length} of ${all} images did not render. Press Redo on ${bad1.length > 1 ? 'them' : 'it'}.` : null, release: true });
        return { ok: true };
        }
        await save(id, { release: true }); await kick(id); return { more: true };
      }
      await save(id, { status: 'done', release: true }); return { ok: true };
    } catch (e) {
      await save(id, { status: 'failed', error: clip(e.message, 300), release: true });
      return { error: e.message };
    }
  }
  async function kick(id) {
    try { await jf('Graphics', APP_URL + '/api/funnel', { method: 'POST', timeout: 9000, headers: { 'Content-Type': 'application/json', 'x-fos-secret': SECRET() }, body: JSON.stringify({ action: 'run', kind: 'gfx', id }) }); return true; } catch { return false; }
  }

  /* ---------- member actions ---------- */
  async function mine(jwt, id) {
    if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw bad('Missing set');
    const rows = await sb(jwt, `/rest/v1/graphic_sets?id=eq.${q(id)}&select=id,workspace_id,status,step,lease_until,slides,format`);
    if (!rows || !rows[0]) throw bad('Set not found', 404); return rows[0];
  }
  const busy = (r) => (r.status === 'running' || r.status === 'queued') && r.lease_until && new Date(r.lease_until) > new Date();
  const A = {
    async gfx_start(jwt, b) {
      const f = FORMATS[b.format] ? b.format : null; if (!f) throw bad('Pick a format');
      const aspect = FORMATS[f].aspects.includes(b.aspect) ? b.aspect : FORMATS[f].aspects[0];
      const model = MODELS[b.model] ? b.model : CHAIN[0];
      const s = b.source && typeof b.source === 'object' ? { kind: clip(b.source.kind, 20), title: clip(b.source.title, 300), text: clip(b.source.text, 3000), author: clip(b.source.author, 80) } : null;
      const picks = (Array.isArray(b.picks) ? b.picks : []).slice(0, 8).filter((p) => p && okUrl(p.thumb || p.url)).map((p) => ({ thumb: clip(p.thumb, 1500), url: clip(p.url, 600), title: clip(p.title, 200), author: clip(p.author, 80), platform: clip(p.platform, 20), format: clip(p.format, 20), likes: Number(p.likes) || null, views: Number(p.views) || null }));
      const uploads = (Array.isArray(b.uploads) ? b.uploads : []).filter((n) => /^ref-[a-z0-9-]{4,60}\.(jpg|png|webp)$/.test(n)).slice(0, 8);
      const input = { brief: clip(b.brief, 3000) || '', cta: clip(b.cta, 300) || '', offer_id: clip(b.offer_id, 120) || null, source: s, picks, uploads, ref_mode: ['style', 'layout', 'loose'].includes(b.ref_mode) ? b.ref_mode : 'layout', slides: Math.max(3, Math.min(10, Number(b.slides) || 7)), count: Math.max(1, Math.min(4, Number(b.count) || 1)), use_logo: b.use_logo !== false, use_photo: b.use_photo !== false };
      const title = clip(b.title, 120) || clip((s && s.title) || b.brief, 70) || FORMATS[f].label;
      const r = await rpc(jwt, 'gfx_create', { p_ws: b.workspace_id, p_title: title, p_format: f, p_aspect: aspect, p_model: model, p_input: input });
      const w = later(loop(r.id)); if (w) await w;
      return r;
    },
    async gfx_tick(jwt, b) {
      const r = await mine(jwt, b.id);
      if ((r.status === 'running' || r.status === 'queued') && !busy(r)) { const w = later(loop(r.id)); if (w) await w; return { resumed: true }; }
      return { resumed: false, status: r.status };
    },
    async gfx_retry(jwt, b) {
      const r = await mine(jwt, b.id); if (busy(r)) return { status: r.status };
      const slides = (r.slides || []).map((x) => x.state === 'done' ? x : { ...x, state: 'queued', tries: 0, error: null });
      await save(r.id, { status: 'running', step: r.step === 'done' ? 'render' : r.step, slides, error: null, release: true });
      const w = later(loop(r.id)); if (w) await w; return { status: 'running' };
    },
    async gfx_edit(jwt, b) {
      const r = await mine(jwt, b.id); const i = Number(b.i); const sl = (r.slides || [])[i];
      if (!sl) throw bad('Pick an image'); if (busy(r) && r.step !== 'render') throw bad('This set is still being planned', 409);
      const request = clip(b.request, 1200);
      if (b.mode === 'edit' && !request) throw bad('Write what to change');
      if (b.mode === 'edit' && !sl.asset) throw bad('Wait for this image to render first', 409);
      await slideSave(r.id, i, { state: 'queued', tries: 0, error: null, edit: b.mode === 'edit' ? request : null });
      if (!busy(r)) { await save(r.id, { status: 'running', step: 'render', error: null, release: true }); const w = later(loop(r.id)); if (w) await w; }
      else { await kick(r.id); }
      return { status: 'running' };
    },
  };

  /* ---------- images for the app ---------- */
  async function asset(req, res, qs) {
    const ws = qs.get('gws'); const k = qs.get('k'); const a = qs.get('a');
    const no = () => { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain'); res.end('Not found'); };
    if (!/^[0-9a-f-]{36}$/i.test(ws || '') || !/^[0-9a-f]{20,80}$/i.test(k || '') || !/^(ref|kit|s)-[a-z0-9-]{1,70}\.(jpg|png|webp|woff2|woff|ttf|otf)$/.test(a || '')) return no();
    const r = await rpc(null, 'gfx_asset', { p_ws: ws, p_key: k, p_name: a }).catch(() => null);
    if (!r || !r.data) return no();
    res.statusCode = 200; res.setHeader('Content-Type', r.mime || 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=31536000, immutable'); res.setHeader('X-Robots-Tag', 'noindex');
    if (qs.get('dl')) res.setHeader('Content-Disposition', `attachment; filename="${String(qs.get('dl')).replace(/[^a-z0-9._-]/gi, '-').slice(0, 80)}"`);
    return res.end(Buffer.from(r.data, 'base64'));
  }

  return { A, loop, kick, asset, FORMATS, MODELS, _render: render, _kitOf: kitOf, _plan: stepPlan };
};

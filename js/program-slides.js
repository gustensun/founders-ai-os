/* Founders AI OS: turn a program's modules and lessons into branded slides.
   Live workspaces write each module with the founder's own AI key (Claude, OpenAI or Perplexity).
   The sample workspace builds slides from the outline itself, so nothing needs a key.
   Slides are kept in this browser per program. The program itself is never changed. */
(function () {
  const U = window.UI, esc = U.esc, icon = U.icon, ACT = window.ACT;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const wsId = () => (isLive() ? window.App.liveCtx().ws.id : 'demo');
  const PG = () => window.OSPrograms;
  const KEY = (pid) => `fos-slides:${wsId()}:${pid}`;
  // The design new decks start from, picked on the Programs page or the Brand board, whichever was changed last.
  const DKEY = () => `fos-slides-design:${wsId()}`;
  const pageDesign = () => { try { const v = localStorage.getItem(DKEY()); return /^(tech|editorial|clean)$/.test(v || '') ? v : null; } catch (e) { return null; } };
  function setPageDesign(id) {
    if (!/^(tech|editorial|clean)$/.test(id || '')) return;
    try { localStorage.setItem(DKEY(), id); } catch (e) { /* the Brand board default still applies */ }
    // Options already open for a program without a saved deck follow the new pick.
    if (S.opts && !saved(S.opts.pid)) S.opts.design = id;
  }
  const S = { view: 'opts', i: 0, busy: false, kit: null, kitFor: null, deck: null, opts: null, status: '', error: null, failed: [] };

  // Three designs. Each is a full slide system (type, grid, furniture and ten layouts), not just colours.
  // The rules behind them come from Taste Skill and Impeccable: one idea per slide, scale contrast,
  // hairlines instead of boxes, no eyebrow labels, emphasis on a few words only.
  const DESIGNS = [
    { id: 'tech', name: 'Tech', note: 'Dark gradient, precise and engineered', colors: { bg: '#07080d', ink: '#eef0f6', accent: '#9aa8ff' }, grad: { from: '#07080d', to: '#121530', glow: '#262c5c' }, display: 'Geist', body: 'Geist', mono: 'Geist Mono' },
    { id: 'editorial', name: 'Editorial', note: 'Warm paper, serif headlines and rules', colors: { bg: '#f2e8d8', ink: '#2b1d14', accent: '#b5432a' }, display: 'Instrument Serif', body: 'Instrument Sans', mono: 'Instrument Sans' },
    { id: 'clean', name: 'Clean', note: 'Light, professional and high-end', colors: { bg: '#ffffff', ink: '#0f172a', accent: '#1e4fd8' }, display: 'Inter Tight', body: 'Inter Tight', mono: 'Inter Tight' },
  ];
  const design = (id) => DESIGNS.find((d) => d.id === id) || DESIGNS[2];
  const PRESETS = [
    { id: 'p-white', name: 'Clean white', colors: { bg: '#ffffff', ink: '#111111', accent: '#111111' }, display: 'Geist', body: 'Geist' },
    { id: 'p-ink', name: 'Ink', colors: { bg: '#0f0f10', ink: '#f4f4f2', accent: '#c8f169' }, display: 'Geist', body: 'Geist' },
    { id: 'p-ivory', name: 'Ivory and green', colors: { bg: '#f7f3ea', ink: '#1d2b22', accent: '#2f5d46' }, display: 'Fraunces', body: 'Inter' },
    { id: 'p-navy', name: 'Navy', colors: { bg: '#0d1b33', ink: '#f2f5fa', accent: '#5cc8ff' }, display: 'Bricolage Grotesque', body: 'Hanken Grotesk' },
    { id: 'p-sand', name: 'Sand', colors: { bg: '#f3ede4', ink: '#2b2420', accent: '#c4532d' }, display: 'DM Serif Display', body: 'DM Sans' },
  ];
  const FONTS = ['Geist', 'Inter', 'Inter Tight', 'DM Sans', 'Hanken Grotesk', 'Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Bricolage Grotesque', 'Outfit', 'Sora', 'Work Sans', 'IBM Plex Sans', 'Instrument Sans', 'Fraunces', 'DM Serif Display', 'Playfair Display', 'Instrument Serif', 'Lora', 'Libre Baskerville'];
  const MODELS = [['claude', 'Claude', [['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-fable-5-2', 'Claude Fable 5.2'], ['claude-haiku-5-5', 'Claude Haiku 5.5']]],
    ['openai', 'OpenAI', [['gpt-6.1-sol', 'GPT-6.1 Sol'], ['gpt-6-astra', 'GPT-6 Astra'], ['gpt-6.1-terra', 'GPT-6.1 Terra'], ['gpt-6-luna', 'GPT-6 Luna']]]];
  const DEPTHS = [['brief', 'Brief'], ['standard', 'Standard'], ['detailed', 'Detailed']];
  const LAYOUTS = ['points', 'statement', 'steps', 'grid', 'compare', 'stat', 'quote'];
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : null);
  const fontOk = (n) => /^[A-Za-z0-9 ]{2,40}$/.test(String(n || '').trim());

  /* ---------- colour maths: keep every slide readable ---------- */
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, w) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - w) + parseInt(b.slice(i, i + 2), 16) * w).toString(16).padStart(2, '0')).join('');
  function tones(c) {
    const bg = hex(c.bg) || '#ffffff', ink0 = hex(c.ink) || '#111111', accent = hex(c.accent) || ink0;
    const ink = contrast(ink0, bg) >= 4.5 ? ink0 : (lum(bg) > 0.4 ? '#111111' : '#f5f5f5');
    const secInk = contrast(bg, accent) >= contrast(ink, accent) ? bg : ink;
    const sec = contrast(secInk, accent) >= 4.5 ? { bg: accent, ink: secInk } : { bg: ink, ink: bg };
    let w = 0.4, muted = mix(ink, bg, w); while (contrast(muted, bg) < 4.6 && w > 0) { w -= 0.05; muted = mix(ink, bg, Math.max(0, w)); }
    // Accent as text only where it stays readable at display sizes; otherwise the ink carries it.
    const hi = contrast(accent, bg) >= 3 ? accent : ink;
    return { bg, ink, accent, mark: contrast(accent, bg) >= 2 ? accent : ink, hi, muted, line: mix(bg, ink, 0.16), surface: mix(bg, ink, 0.045),
      secBg: sec.bg, secInk: sec.ink, invHi: contrast(accent, ink) >= 3 ? accent : bg, invMuted: mix(bg, ink, 0.32) };
  }

  /* ---------- branding: the Brand board first, then presets, then custom ---------- */
  async function loadKit() {
    const key = wsId(); if (S.kitFor === key && S.kit) return S.kit;
    let K = null; const BK = window.OSBrandKit;
    try {
      if (BK && !isLive()) { BK.board(); K = BK.kit(); }
      else K = BK ? await BK.load() : isLive() ? await window.Auth.gfx.kit(key) : (window.OSGraphicsDemo && window.OSGraphicsDemo.kit());
    } catch (e) { K = null; }
    const k = (K && K.kit) || {}, out = { palettes: [], fonts: [], logo: null, handle: k.handle || '' };
    // The Brand board marks the palette and pairing slides start from; without a mark, its defaults.
    const pals = Array.isArray(k.palettes) && k.palettes.length ? k.palettes : k.palette && hex(k.palette.bg) ? [{ id: 'main', name: 'Main', colors: k.palette }] : [];
    const pmark = pals.some((p) => p && p.slides);
    pals.forEach((p, i) => { const c = (p && p.colors) || {}; if (hex(c.bg)) out.palettes.push({ id: 'bb-' + (p.id || i), name: 'Brand board: ' + (p.name || 'Palette'), colors: { bg: c.bg, ink: c.ink, accent: c.accent || c.deep }, def: pmark ? !!p.slides : !!p.default }); });
    const sets = Array.isArray(k.font_sets) && k.font_sets.length ? k.font_sets : k.fonts && k.fonts.display ? [{ id: 'main', name: 'Main', ...k.fonts }] : [];
    const fmark = sets.some((f) => f && f.slides);
    sets.forEach((f, i) => { if (f && fontOk(f.display)) out.fonts.push({ id: 'bb-' + (f.id || i), name: 'Brand board: ' + (f.name || 'Pairing'), display: f.display, body: fontOk(f.body) ? f.body : f.display, def: fmark ? !!f.slides : !!f.default }); });
    const marked = pals.find((p) => p && p.slides); out.logoDefault = marked ? marked.slides_logo !== false : true; out.marked = pmark || fmark;
    // Each design brings its own colours and fonts. The Brand board only overrides them when it says so.
    out.brandColors = !!(marked && marked.slides_brand_colors === true); out.brandFonts = !!(marked && marked.slides_brand_fonts === true);
    out.design = (marked && DESIGNS.some((d) => d.id === marked.slides_design)) ? marked.slides_design : null;
    if (k.logo) out.logo = /^(assets\/|data:|https:|blob:)/.test(k.logo) ? k.logo : k.asset_key && isLive() ? `/g/${key}/${k.asset_key}/${k.logo}` : null;
    S.kit = out; S.kitFor = key; return out;
  }
  function looks(o = S.opts) { const k = S.kit || { palettes: [] }, d = design(o && o.design); return [{ id: 'design', name: d.name + ' colours', colors: d.colors, display: d.display, body: d.body }, ...k.palettes, ...PRESETS]; }
  function fontSets() { const k = S.kit || { fonts: [] }; return k.fonts; }
  function theme(o = S.opts) {
    const d = design(o.design), look = looks(o).find((x) => x.id === o.look) || looks(o)[0];
    const colors = o.look === 'custom' ? o.custom : look.colors;
    let display, body;
    if (o.fonts === 'custom') { display = fontOk(o.display) ? o.display.trim() : d.display; body = fontOk(o.body) ? o.body.trim() : display; }
    else if (o.fonts === 'design') { display = d.display; body = d.body; }
    else { const f = fontSets().find((x) => x.id === o.fonts); display = f ? f.display : (look.display || d.display); body = f ? f.body : (look.body || d.body); }
    const grad = o.look === 'design' && d.grad ? d.grad : null;
    return { ...tones(colors), grad, design: d.id, display, body, mono: d.id === 'tech' ? d.mono : body, logo: o.logo && S.kit ? S.kit.logo : null, handle: S.kit ? S.kit.handle : '', name: o.look === 'custom' ? 'Custom' : look.name };
  }
  // Google Fonts refuses a whole request when one weight is missing, so each family loads on its own and falls back.
  const SPEC = { 'Instrument Serif': 'ital@0;1', 'DM Serif Display': 'ital@0;1', 'Libre Baskerville': 'ital,wght@0,400;0,700;1,400' };
  const fontUrl = (f, spec) => 'https://fonts.googleapis.com/css2?family=' + f.trim().replace(/ /g, '+') + (spec ? ':' + spec : '') + '&display=swap';
  const specFor = (f) => SPEC[f] || 'ital,wght@0,400;0,500;0,600;0,700;1,400';
  const loaded = new Map();
  function loadFonts(t) {
    [t.display, t.body, t.mono].filter((f) => fontOk(f) && !loaded.has(f)).forEach((f) => {
      loaded.set(f, specFor(f));
      const tries = [specFor(f), 'wght@400;700', ''];
      const add = (n) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = fontUrl(f, tries[n]); l.onerror = () => { l.remove(); if (n + 1 < tries.length) { loaded.set(f, tries[n + 1]); add(n + 1); } }; document.head.appendChild(l); };
      add(0);
    });
  }
  const fontLinks = (t) => [...new Set([t.display, t.body, t.mono])].filter(fontOk).map((f) => `<link rel="stylesheet" href="${fontUrl(f, loaded.has(f) ? loaded.get(f) : specFor(f))}">`).join('');

  /* ---------- slides as HTML: one system for the app, presenting and PDF ---------- */
  const CSS = `.sl{container-type:inline-size;position:relative;aspect-ratio:16/9;width:100%;overflow:hidden;background:var(--s-bg);color:var(--s-ink);font-family:var(--s-body),system-ui,sans-serif;font-size:1.6cqw;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal}
.sl *{box-sizing:border-box}
.sl{background:var(--s-grad,var(--s-bg))}
.sl h1,.sl h2,.sl p,.sl ul,.sl ol,.sl dl,.sl dd,.sl dt,.sl blockquote,.sl figure{margin:0;padding:0}
.sl ul,.sl ol{list-style:none}
.sl h1,.sl h2,.sl .stm,.sl .q p,.sl .stt-v,.sl .s-num{font-family:var(--s-display),system-ui,sans-serif;text-wrap:balance}
.sl p,.sl li{text-wrap:pretty}
.sl em{font-style:normal;color:var(--s-hi)}
.sl b{font-weight:600}
.sl-in{position:absolute;inset:var(--pt) var(--px) var(--pb);display:flex;flex-direction:column;min-height:0}
.sl-head,.sl-foot{position:absolute;left:var(--px);right:var(--px);display:flex;justify-content:space-between;align-items:center;gap:2cqw;font-size:1cqw;line-height:1.2;color:var(--s-muted);z-index:2;white-space:nowrap}
.sl-head span,.sl-foot span{overflow:hidden;text-overflow:ellipsis}
.sl-n{font-variant-numeric:tabular-nums}
.sl-logo{max-height:3.4cqw;max-width:14cqw;object-fit:contain}
.sl .sub{color:var(--s-muted);font-size:1.7cqw;line-height:1.45;max-width:60ch}
.sl h2{font-size:3.6cqw;line-height:1.04;max-width:78%}
.sl.is-long h2{font-size:2.9cqw}
.d-tech.is-long h1,.d-clean.is-long h1{font-size:4.8cqw}.d-editorial.is-long h1{font-size:6cqw}
.sl.l-cover.is-long .sub{font-size:1.45cqw}
.sl .p-list li,.sl .rc-list li{position:relative}
.sl .c-meta{display:flex;gap:4.5cqw}
.sl .c-meta dt{font-size:1cqw;color:var(--s-muted)}
.sl .c-meta dd{font-size:2.2cqw;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:.5cqw}
.sl .st-list,.sl .g-list{display:grid;grid-template-columns:repeat(var(--n),1fr)}
.sl .st-list b,.sl .g-list b{display:block;font-family:var(--s-display),system-ui,sans-serif;font-size:2.1cqw;line-height:1.15;font-weight:600;text-wrap:balance}
.sl .st-list span,.sl .g-list p{display:block;color:var(--s-muted);font-size:1.5cqw;line-height:1.42;margin-top:.8cqw}
.sl .cp{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0}
.sl .cp b{display:block;font-size:1.1cqw;font-weight:600}
.sl .cp li{font-size:1.95cqw;line-height:1.3;padding:1.1cqw 0;border-top:1px solid var(--s-line)}
.sl .cp-a li{color:var(--s-muted)}
.sl .stt{display:grid;grid-template-columns:auto 1fr;gap:5cqw;align-items:end;flex:1}
.sl .stt-v{font-size:16cqw;line-height:.82;letter-spacing:-.05em;color:var(--s-hi);font-variant-numeric:tabular-nums;white-space:nowrap}
.sl .stt-l{font-size:1.9cqw;line-height:1.3;margin-top:2cqw;max-width:30cqw}
.sl .stt-side .p-list li{font-size:1.6cqw}
.sl .q{flex:1;display:flex;flex-direction:column;justify-content:center}
.sl .q p{font-size:3.6cqw;line-height:1.16;max-width:84%}
.sl .q cite{font-style:normal;font-size:1.3cqw;color:var(--s-muted);margin-top:2.6cqw;display:block}
.sl .stm{font-size:4.8cqw;line-height:1.08;max-width:84%}
.sl.is-long .stm{font-size:3.8cqw}
.sl .l-mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.sl .stm + .sub{margin-top:2.6cqw;max-width:52%}
.sl .rc-list{display:grid;grid-template-columns:1fr 1fr;column-gap:4cqw;margin-top:auto}
.sl .rc-list li{font-size:1.8cqw;line-height:1.3;padding:1.3cqw 0 1.3cqw 3.4cqw;border-top:1px solid var(--s-line)}
.sl .rc-list svg{position:absolute;left:0;top:1.45cqw;width:1.8cqw;height:1.8cqw;color:var(--s-mark)}

/* Tech: a blueprint frame, mono measurement text, signal bars */
.d-tech{--px:6.6cqw;--pt:9.6cqw;--pb:8cqw;letter-spacing:-.006em}
.d-tech .sl-frame{position:absolute;inset:2.8cqw;border:1px solid var(--s-line);pointer-events:none}
.d-tech .sl-frame::before,.d-tech .sl-frame::after{content:"";position:absolute;width:1.6cqw;height:1.6cqw;border:0 solid var(--s-mark)}
.d-tech .sl-frame::before{top:-1px;left:-1px;border-top-width:.28cqw;border-left-width:.28cqw}
.d-tech .sl-frame::after{bottom:-1px;right:-1px;border-bottom-width:.28cqw;border-right-width:.28cqw}
.d-tech .sl-head,.d-tech .sl-foot,.d-tech .c-meta dt,.d-tech .st-n,.d-tech .cp b,.d-tech .q cite,.d-tech .stt-l,.d-tech .s-lab{font-family:var(--s-mono),ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}
.d-tech .sl-head{top:4.3cqw;font-size:.92cqw}.d-tech .sl-foot{bottom:4.3cqw;font-size:.92cqw}
.d-tech h1,.d-tech h2,.d-tech .stm,.d-tech .q p,.d-tech .s-num{font-weight:600;letter-spacing:-.035em}
.d-tech .c-art{position:absolute;right:6.6cqw;top:10cqw;width:24cqw;display:grid;gap:.95cqw}
.d-tech .c-art i{display:block;height:.42cqw;background:var(--s-line)}
.d-tech .c-art i:nth-child(1){width:62%}.d-tech .c-art i:nth-child(2){width:88%}.d-tech .c-art i:nth-child(3){width:40%;background:var(--s-mark)}.d-tech .c-art i:nth-child(4){width:100%}.d-tech .c-art i:nth-child(5){width:74%}.d-tech .c-art i:nth-child(6){width:30%}.d-tech .c-art i:nth-child(7){width:92%}.d-tech .c-art i:nth-child(8){width:55%}
.d-tech.l-cover .sl-in{justify-content:flex-end}
.d-tech h1{font-size:6.6cqw;line-height:.98;max-width:72%}
.d-tech.l-cover .sub{margin-top:2cqw;max-width:52%}
.d-tech .c-meta{margin-top:3.6cqw;padding-top:1.6cqw;border-top:1px solid var(--s-line);max-width:60%}
.d-tech .c-meta dt{font-size:.9cqw}
.d-tech.l-section .sl-in{flex-direction:row;align-items:flex-end;gap:4cqw}
.d-tech .s-num{font-size:23cqw;line-height:.74;color:var(--s-hi);letter-spacing:-.06em;font-variant-numeric:tabular-nums}
.d-tech .s-main{padding-bottom:.6cqw;min-width:0}
.d-tech .s-lab{font-size:1cqw;color:var(--s-muted);display:block;margin-bottom:1.6cqw}
.d-tech.l-section h2{font-size:4.6cqw;max-width:none}
.d-tech.l-section .sub{margin-top:1.6cqw}
.d-tech .p-list{display:grid;grid-template-columns:1fr 1fr;column-gap:4cqw;margin-top:auto}
.d-tech .p-list.one{grid-template-columns:1fr;max-width:72%}
.d-tech .p-list li{font-size:1.85cqw;line-height:1.3;padding:1.35cqw 0 1.35cqw 2.6cqw;border-top:1px solid var(--s-line)}
.d-tech .p-list li::before{content:"";position:absolute;left:0;top:1.95cqw;width:.75cqw;height:.75cqw;background:var(--s-mark)}
.d-tech .p-head .sub{margin-top:1.2cqw}
.d-tech .st-list{margin-top:auto;column-gap:2.2cqw}
.d-tech .st-list li{border-top:1px solid var(--s-line);padding-top:2.2cqw;position:relative}
.d-tech .st-list li::before{content:"";position:absolute;top:-.5cqw;left:0;width:1cqw;height:1cqw;background:var(--s-mark)}
.d-tech .st-n{display:block;font-size:.95cqw;color:var(--s-hi);margin-bottom:1.2cqw}
.d-tech .g-list{margin-top:auto;border-top:1px solid var(--s-line);border-left:1px solid var(--s-line)}
.d-tech .g-list>div{border-right:1px solid var(--s-line);border-bottom:1px solid var(--s-line);padding:2.2cqw 2cqw 2.4cqw}
.d-tech .g-list>div:first-child{background:var(--s-surface)}
.d-tech .g-list .st-n{margin-bottom:2.4cqw}
.d-tech .cp{gap:2cqw;margin-top:auto;flex:0 0 auto}
.d-tech .cp>div{border:1px solid var(--s-line);padding:2.2cqw 2.4cqw}
.d-tech .cp-b{border-color:var(--s-mark)!important}
.d-tech .cp b{font-size:.95cqw;color:var(--s-muted);margin-bottom:1.2cqw}.d-tech .cp-b b{color:var(--s-hi)}
.d-tech .cp li:first-of-type{border-top:0}
.d-tech .stm{font-size:5cqw;max-width:80%}
.d-tech .q p{font-weight:500}
.d-tech .q p::before{content:"\\201C";color:var(--s-hi);margin-right:.08em}
.d-tech .stt-l{font-size:1.1cqw;color:var(--s-muted)}
.d-tech .stt-side h2{font-size:2.8cqw;max-width:none;margin-bottom:2cqw}

/* Editorial: running head, serif display, rules and columns */
.d-editorial{--px:7cqw;--pt:10.4cqw;--pb:8cqw}
.d-editorial .sl-head{top:3.8cqw;padding-bottom:1.1cqw;border-bottom:1px solid var(--s-ink);color:var(--s-ink);font-size:1cqw;letter-spacing:.01em}
.d-editorial .sl-head .sl-n,.d-editorial .s-num,.d-editorial .st-n,.d-editorial .rc-n{font-family:var(--s-display),Georgia,serif;font-style:italic}
.d-editorial .sl-head .sl-n{font-size:1.5cqw}
.d-editorial .sl-foot{bottom:3.6cqw}
.d-editorial h1,.d-editorial h2,.d-editorial .stm,.d-editorial .q p,.d-editorial .stt-v,.d-editorial .st-list b,.d-editorial .g-list b{font-weight:400;letter-spacing:-.015em}
.d-editorial em{font-style:italic}
.d-editorial h2{font-size:4.6cqw;line-height:1}
.d-editorial.is-long h2{font-size:3.6cqw}
.d-editorial.l-cover .sl-in{justify-content:flex-end}
.d-editorial .c-main{border-top:.5cqw solid var(--s-ink);padding-top:2.4cqw;display:grid;grid-template-columns:1fr 28%;gap:4cqw;align-items:end}
.d-editorial h1{font-size:8.6cqw;line-height:.92;letter-spacing:-.025em}
.d-editorial.l-cover .sub{font-size:1.55cqw;padding-bottom:.8cqw}
.d-editorial .c-meta{position:absolute;top:0;left:0;gap:3cqw}
.d-editorial .c-meta dd{font-family:var(--s-display),Georgia,serif;font-size:2.6cqw}
.d-editorial.l-section{background:var(--s-ink);color:var(--s-bg)}
.d-editorial.l-section .sl-head{color:var(--s-bg);border-color:var(--s-bg)}
.d-editorial.l-section .sub{color:var(--s-inv-muted)}
.d-editorial.l-section .sl-in{flex-direction:row;align-items:flex-end;gap:5cqw}
.d-editorial .s-num{font-size:31cqw;line-height:.72;color:var(--s-inv-hi);font-weight:400;letter-spacing:-.04em}
.d-editorial .s-lab{display:none}
.d-editorial.l-section h2{font-size:5.6cqw;max-width:none}
.d-editorial.l-section .sub{margin-top:1.8cqw}
.d-editorial .s-main{padding-bottom:1.6cqw;min-width:0}
.d-editorial.l-points .sl-in,.d-editorial.l-recap .sl-in{flex-direction:row;gap:5cqw}
.d-editorial .p-head{width:40%;flex:none;display:flex;flex-direction:column}
.d-editorial .p-head h2{max-width:none}
.d-editorial .p-head .sub{margin-top:auto;font-size:1.5cqw}
.d-editorial .p-list{flex:1;border-top:1px solid var(--s-ink);align-self:flex-start}
.d-editorial .p-list li{font-size:1.95cqw;line-height:1.3;padding:1.45cqw 0;border-bottom:1px solid var(--s-line)}
.d-editorial.is-dense .p-list li{font-size:1.65cqw;padding:1.1cqw 0}
.d-editorial .st-list,.d-editorial .g-list{margin-top:auto;border-top:1px solid var(--s-ink)}
.d-editorial .st-list li,.d-editorial .g-list>div{padding:1.8cqw 2.2cqw 0;border-left:1px solid var(--s-line)}
.d-editorial .st-list li:first-child,.d-editorial .g-list>div:first-child{padding-left:0;border-left:0}
.d-editorial .st-n{display:block;font-size:4.6cqw;line-height:1;color:var(--s-hi);margin-bottom:1.2cqw}
.d-editorial .st-list b,.d-editorial .g-list b{font-size:2.3cqw;line-height:1.08}
.d-editorial .g-list b{font-style:italic}
.d-editorial .cp{margin-top:3.4cqw;border-top:1px solid var(--s-ink)}
.d-editorial .cp>div{padding-top:1.8cqw}
.d-editorial .cp-a{padding-right:3cqw}
.d-editorial .cp-b{padding-left:3cqw;border-left:1px solid var(--s-ink)}
.d-editorial .cp b{font-family:var(--s-display),Georgia,serif;font-weight:400;font-style:italic;font-size:2.6cqw;margin-bottom:1cqw}
.d-editorial .cp-b b{color:var(--s-hi)}
.d-editorial .stm{font-size:5.8cqw;line-height:1.02;max-width:86%}
.d-editorial.is-long .stm{font-size:4.6cqw}
.d-editorial .q{padding-left:9cqw;position:relative}
.d-editorial .q::before{content:"\\201C";position:absolute;left:0;top:50%;transform:translateY(-62%);font-family:var(--s-display),Georgia,serif;font-size:20cqw;line-height:1;color:var(--s-hi)}
.d-editorial .q p{font-size:4.2cqw;font-style:italic;line-height:1.1}
.d-editorial .stt-v{font-size:19cqw;font-style:italic;letter-spacing:-.04em}
.d-editorial .stt-l{font-family:var(--s-display),Georgia,serif;font-size:2.2cqw;line-height:1.15}
.d-editorial .stt-side h2{font-size:3cqw;max-width:none;margin-bottom:2cqw}
.d-editorial .rc-list{flex:1;margin-top:0;align-self:flex-start;border-top:1px solid var(--s-ink)}
.d-editorial .rc-list li{padding-left:3.2cqw;border-top:0;border-bottom:1px solid var(--s-line)}
.d-editorial .rc-n{position:absolute;left:0;top:1.15cqw;font-size:2cqw;line-height:1;color:var(--s-hi)}
.d-editorial.l-recap .p-head{width:34%}

/* Clean: wide margins, tight large type, one accent, hairlines only */
.d-clean{--px:7.6cqw;--pt:10cqw;--pb:8.6cqw}
.d-clean .sl-head{top:4.2cqw;justify-content:flex-end}
.d-clean .sl-head .sl-prog{display:none}
.d-clean .sl-foot{bottom:4.2cqw}
.d-clean h1,.d-clean h2,.d-clean .stm,.d-clean .q p,.d-clean .st-list b,.d-clean .g-list b{font-weight:500;letter-spacing:-.032em}
.d-clean.l-cover .sl-in{justify-content:space-between}
.d-clean .c-main::before{content:"";display:block;width:1cqw;height:1cqw;border-radius:50%;background:var(--s-mark);margin-bottom:3.4cqw}
.d-clean h1{font-size:6.6cqw;line-height:1;max-width:74%}
.d-clean.l-cover .sub{margin-top:2.2cqw;max-width:50%}
.d-clean .c-meta{padding-top:1.8cqw;border-top:1px solid var(--s-line);gap:0}
.d-clean .c-meta>div{flex:0 0 22%}
.d-clean .c-meta dd{font-weight:400;letter-spacing:-.02em}
.d-clean.l-section .sl-in{justify-content:flex-end}
.d-clean .s-num{font-size:12cqw;line-height:.8;font-weight:400;color:var(--s-muted);letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.d-clean .s-lab{display:none}
.d-clean .s-main{margin-top:3.4cqw;padding-top:2.4cqw;border-top:1px solid var(--s-line);position:relative}
.d-clean .s-main::before{content:"";position:absolute;top:-.45cqw;left:0;width:.9cqw;height:.9cqw;border-radius:50%;background:var(--s-mark)}
.d-clean.l-section h2{font-size:5cqw;max-width:80%}
.d-clean.l-section .sub{margin-top:1.4cqw}
.d-clean.l-points .sl-in{display:grid;grid-template-columns:5fr 7fr;gap:6cqw;align-items:start}
.d-clean .p-head h2{max-width:none;font-size:3.4cqw}
.d-clean .p-head .sub{margin-top:1.6cqw;font-size:1.5cqw}
.d-clean .p-list li{font-size:1.95cqw;line-height:1.3;padding:1.55cqw 0;border-top:1px solid var(--s-line)}
.d-clean .p-list li:last-child{border-bottom:1px solid var(--s-line)}
.d-clean.is-dense .p-list li{font-size:1.65cqw;padding:1.15cqw 0}
.d-clean .st-list,.d-clean .g-list{margin-top:auto;column-gap:3cqw}
.d-clean .st-list li{border-top:1px solid var(--s-line);padding-top:1.8cqw}
.d-clean .st-n{display:block;font-size:4.2cqw;line-height:1;color:var(--s-muted);letter-spacing:-.04em;margin-bottom:2.6cqw;font-variant-numeric:tabular-nums}
.d-clean .st-list li:first-child .st-n{color:var(--s-hi)}
.d-clean .g-list{row-gap:0}
.d-clean .g-list>div{border-top:1px solid var(--s-line);padding:1.8cqw 0 0}
.d-clean .g-list .st-n{font-size:1.1cqw;letter-spacing:0;margin-bottom:1.4cqw}
.d-clean .cp{margin-top:auto;flex:0 0 auto;gap:0}
.d-clean .cp-a{padding:2.8cqw 3cqw 2.8cqw 0}
.d-clean .cp-b{padding:2.8cqw 3cqw;background:var(--s-surface);border-radius:1.2cqw}
.d-clean .cp b{color:var(--s-muted);margin-bottom:1cqw}.d-clean .cp-b b{color:var(--s-hi)}
.d-clean .cp li:first-of-type{border-top:0}
.d-clean .stm{font-size:4.6cqw;line-height:1.08;max-width:78%}
.d-clean .q p{font-size:3.4cqw;font-weight:400;line-height:1.2}
.d-clean .q cite::before{content:"";display:inline-block;width:2.4cqw;height:1px;background:var(--s-mark);vertical-align:middle;margin-right:1cqw}
.d-clean .stt-v{font-weight:400;font-size:15cqw}
.d-clean .stt-l{color:var(--s-muted)}
.d-clean .stt-side h2{font-size:2.8cqw;max-width:none;margin-bottom:2cqw}
.d-clean .rc-list li{border-top:1px solid var(--s-line)}`;
  function styleTag() { let s = document.getElementById('sl-css'); if (!s) { s = document.createElement('style'); s.id = 'sl-css'; document.head.appendChild(s); } if (s.textContent !== CSS) s.textContent = CSS; }
  const vars = (t) => `--s-bg:${t.bg};--s-ink:${t.ink};--s-accent:${t.accent};--s-mark:${t.mark};--s-hi:${t.hi || t.mark};--s-muted:${t.muted || t.ink};--s-line:${t.line || t.ink};--s-surface:${t.surface || t.bg};--s-inv-hi:${t.invHi || t.bg};--s-inv-muted:${t.invMuted || t.bg};--s-display:'${t.display}';--s-body:'${t.body}';--s-mono:'${t.mono || t.body}'${t.grad ? `;--s-grad:radial-gradient(90% 120% at 100% 0%,${t.grad.glow} 0%,transparent 60%),linear-gradient(155deg,${t.grad.from} 30%,${t.grad.to} 100%)` : ''}`;
  const pad = (n) => String(n).padStart(2, '0');
  // Highlight the AI's chosen words inside a line, escaped either side.
  function emph(text, em) {
    const s = String(text || ''), w = String(em || '').trim(); if (!w || w.length >= s.length) return esc(s);
    const i = s.toLowerCase().indexOf(w.toLowerCase()); if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<em>' + esc(s.slice(i, i + w.length)) + '</em>' + esc(s.slice(i + w.length));
  }
  const CHECK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="8.4"/><path d="M6.4 10.3l2.4 2.4 4.8-5"/></svg>';
  function layoutOf(x) { if (x.type === 'cover' || x.type === 'section' || x.type === 'recap') return x.type; return LAYOUTS.includes(x.layout) ? x.layout : 'points'; }
  function slideHtml(x, t, n, total) {
    const D = t.design || 'clean', L = layoutOf(x), sub = (v) => (v ? `<p class="sub">${esc(v)}</p>` : '');
    const bullets = (x.bullets || []).slice(0, 6), items = (x.items || []).slice(0, 5);
    const dense = bullets.length > 4 || bullets.join('').length > 300;
    const long = String(x.title || '').length > (L === 'statement' ? 90 : L === 'cover' ? 34 : 56);
    const head = `<div class="sl-head"><span class="sl-prog">${esc(L === 'cover' ? t.handle || '' : x.program || '')}</span><span class="sl-n">${n && L !== 'cover' ? pad(n) + ' / ' + pad(total) : ''}</span></div>`;
    const foot = `<div class="sl-foot"><span>${esc(L === 'cover' || L === 'section' ? '' : x.module || '')}</span>${t.logo && L === 'cover' ? `<img class="sl-logo" src="${esc(t.logo)}" alt="">` : ''}</div>`;
    const h2 = `<h2>${emph(x.title, x.em)}</h2>`;
    const plist = (arr, cls = '') => (arr.length ? `<ul class="p-list${cls}">${arr.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '');
    let inner;
    if (L === 'cover') {
      const meta = (x.meta || []).filter((m) => m[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
      inner = D === 'editorial'
        ? `<div class="c-main"><h1>${emph(x.title, x.em)}</h1>${sub(x.subtitle)}</div>${meta ? `<dl class="c-meta">${meta}</dl>` : ''}`
        : `<div class="c-main"><h1>${emph(x.title, x.em)}</h1>${sub(x.subtitle)}</div>${meta ? `<dl class="c-meta">${meta}</dl>` : ''}`;
      if (D === 'tech') inner = `<div class="c-main"><h1>${emph(x.title, x.em)}</h1>${sub(x.subtitle)}${meta ? `<dl class="c-meta">${meta}</dl>` : ''}</div>`;
      inner = `<div class="sl-in">${inner}</div>${D === 'tech' ? '<div class="c-art" aria-hidden="true">' + '<i></i>'.repeat(8) + '</div>' : ''}`;
    } else if (L === 'section') {
      inner = `<div class="sl-in"><div class="s-num">${esc(pad(x.num || 1))}</div><div class="s-main"><span class="s-lab">Module ${esc(pad(x.num || 1))}</span>${h2}${sub(x.subtitle)}</div></div>`;
    } else if (L === 'statement') {
      inner = `<div class="sl-in"><div class="l-mid"><p class="stm">${emph(x.title, x.em)}</p>${sub(x.subtitle)}</div></div>`;
    } else if (L === 'quote') {
      const q = x.quote || { text: x.title };
      inner = `<div class="sl-in"><blockquote class="q"><p>${esc(q.text)}</p>${q.who ? `<cite>${esc(q.who)}</cite>` : ''}</blockquote></div>`;
    } else if (L === 'stat') {
      const st = x.stat || {};
      inner = `<div class="sl-in"><div class="stt"><div><div class="stt-v">${esc(st.value)}</div><p class="stt-l">${esc(st.label || '')}</p></div><div class="stt-side">${h2}${plist(bullets.slice(0, 3), ' one')}</div></div></div>`;
    } else if (L === 'steps' || L === 'grid') {
      const n2 = items.length || 1, cols = L === 'grid' && n2 === 4 && D !== 'editorial' ? 2 : n2;
      const cells = items.map((it, i) => (L === 'steps'
        ? `<li><span class="st-n">${D === 'editorial' ? i + 1 : pad(i + 1)}</span><b>${esc(it.head)}</b>${it.text ? `<span>${esc(it.text)}</span>` : ''}</li>`
        : `<div>${D === 'editorial' ? '' : `<span class="st-n">${pad(i + 1)}</span>`}<b>${esc(it.head)}</b>${it.text ? `<p>${esc(it.text)}</p>` : ''}</div>`)).join('');
      inner = `<div class="sl-in"><div class="p-head">${h2}${sub(x.subtitle)}</div>${L === 'steps' ? `<ol class="st-list" style="--n:${n2}">${cells}</ol>` : `<div class="g-list" style="--n:${cols}">${cells}</div>`}</div>`;
    } else if (L === 'compare') {
      const side = (s, c) => `<div class="${c}"><b>${esc(s.label || '')}</b><ul>${(s.items || []).map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>`;
      inner = `<div class="sl-in"><div class="p-head">${h2}</div><div class="cp">${side(x.left || {}, 'cp-a')}${side(x.right || {}, 'cp-b')}</div></div>`;
    } else if (L === 'recap') {
      const list = `<ol class="rc-list">${bullets.map((b, i) => `<li>${D === 'editorial' ? `<span class="rc-n">${i + 1}</span>` : CHECK}${esc(b)}</li>`).join('')}</ol>`;
      inner = `<div class="sl-in"><div class="p-head">${h2}</div>${list}</div>`;
    } else {
      inner = `<div class="sl-in"><div class="p-head">${h2}${sub(x.subtitle)}</div>${plist(bullets, D === 'tech' && bullets.length <= 3 ? ' one' : '')}</div>`;
    }
    const frame = D === 'tech' ? '<div class="sl-frame" aria-hidden="true"></div>' : '';
    return `<div class="sl d-${D} l-${L}${dense ? ' is-dense' : ''}${long ? ' is-long' : ''}" style="${vars(t)}" role="img" aria-label="${esc('Slide ' + (n || 1) + ': ' + (x.title || (x.quote && x.quote.text) || ''))}">${frame}${head}${inner}${foot}</div>`;
  }
  // Cover first, then every module in program order.
  function flat(d) {
    if (!d) return [];
    const lessons = new Set(); d.modules.forEach((m) => m.slides.forEach((x) => { if (x.lesson_id) lessons.add(x.lesson_id); }));
    const meta = [['Modules', d.modules.length ? String(d.modules.length) : ''], ['Lessons', lessons.size ? String(lessons.size) : '']];
    const out = [{ type: 'cover', title: d.title, subtitle: d.description || '', meta }];
    d.modules.forEach((m, mi) => m.slides.forEach((x) => out.push({ ...x, module: m.title, program: d.title, num: m.num || mi + 1, kick: x.type === 'section' ? 'Module ' + (m.num || mi + 1) : '' })));
    return out;
  }

  /* ---------- storage: last deck per program, in this browser ---------- */
  // Decks made before designs existed open in the Clean design with the same colours.
  const upgrade = (d) => { if (d && d.theme && !d.theme.hi) d.theme = { ...d.theme, ...tones({ bg: d.theme.bg, ink: d.theme.ink, accent: d.theme.accent }), design: d.theme.design || 'clean', mono: d.theme.mono || d.theme.body }; return d; };
  const saved = (pid) => { try { return upgrade(JSON.parse(localStorage.getItem(KEY(pid)) || 'null')); } catch (e) { return null; } };
  function keep(d) { try { localStorage.setItem(KEY(d.pid), JSON.stringify(d)); return true; } catch (e) { U.toast('The slides are ready but too large to keep in this browser. Download them now so they are not lost.'); return false; } }

  /* ---------- options ---------- */
  const program = () => (PG() && PG().state().program) || null;
  const modules = (p) => ((p && p.data && p.data.stages) || []);
  function aiReady() {
    if (!isLive()) return { ok: true, providers: [] };
    const on = (window.App.liveCtx().conns || []).filter((c) => c.status === 'connected').map((c) => c.provider);
    const providers = ['claude', 'openai', 'perplexity'].filter((p) => on.includes(p));
    return { ok: providers.length > 0, providers };
  }
  function defaults(p, prev) {
    const k = S.kit || { palettes: [], fonts: [] };
    const pal = k.palettes.find((x) => x.def) || k.palettes[0], fs = k.fonts.find((x) => x.def) || k.fonts[0];
    const o = { v: 2, design: pageDesign() || k.design || 'clean', look: k.brandColors && pal ? pal.id : 'design', fonts: k.brandFonts && fs ? fs.id : 'look', custom: { bg: '#ffffff', ink: '#111111', accent: '#2f5d46' }, display: 'Geist', body: 'Geist', depth: 'standard', notes: true, model: 'auto', logo: !!k.logo && k.logoDefault !== false, stages: modules(p).filter((m) => (m.cards || []).length).map((m) => m.id) };
    // Decks saved before the designs had their own colours start again from the design's colours.
    const fresh = prev && prev.v >= 2;
    // A program that already has a deck keeps its design; new decks start from the pick above.
    const own = ['depth', 'notes', 'model', 'design'].concat(k.marked ? [] : ['logo'], fresh && !(k.brandColors && pal) ? ['look'] : [], fresh && !(k.brandFonts && fs) ? ['fonts', 'display', 'body'] : []);
    if (prev) { own.forEach((f) => { if (prev[f] != null) o[f] = prev[f]; }); if (fresh && prev.custom) o.custom = { ...prev.custom }; }
    if (!DESIGNS.some((d) => d.id === o.design)) o.design = 'clean';
    if (o.look !== 'custom' && !looks(o).some((x) => x.id === o.look)) o.look = 'design';
    if (o.fonts !== 'custom' && o.fonts !== 'look' && o.fonts !== 'design' && !fontSets().some((x) => x.id === o.fonts)) o.fonts = 'look';
    return o;
  }
  // A sample of the layouts the AI picks from, filled with this program's own titles.
  function samples(p) {
    const m = modules(p).find((x) => (x.cards || []).length) || { title: 'Module', cards: [{ title: 'First lesson' }, { title: 'Second lesson' }, { title: 'Third lesson' }] };
    const cards = (m.cards || []).slice(0, 3), first = (c) => (sentences(c.body)[0] || '').split(' ').slice(0, 9).join(' ');
    return [
      { type: 'cover', title: p ? p.data.title : 'Program', subtitle: p ? String(p.data.description || '').slice(0, 110) : '', meta: [['Modules', String(modules(p).length || 1)], ['Lessons', String(modules(p).reduce((a, x) => a + (x.cards || []).length, 0) || 3)]] },
      { type: 'content', layout: 'statement', title: 'One idea per slide, said in a single clear line', em: 'One idea per slide', module: m.title, program: p ? p.data.title : '' },
      { type: 'content', layout: 'steps', title: m.title, module: m.title, program: p ? p.data.title : '', items: cards.map((c) => ({ head: c.title, text: first(c) })) },
      { type: 'content', layout: 'compare', title: 'Before and after this module', em: 'after', module: m.title, program: p ? p.data.title : '', left: { label: 'Before', items: ['Notes in five places', 'Slides built by hand'] }, right: { label: 'After', items: ['One outline', 'Slides in your brand'] } },
    ];
  }
  function preview() {
    const p = program(), t = theme(); loadFonts(t);
    return `<div class="psl-pv">${samples(p).map((x, i) => slideHtml(x, t, i ? i + 1 : 0, 12)).join('')}</div>`;
  }
  function designsHtml() {
    const o = S.opts, p = program(), cover = samples(p)[1];
    return `<div class="psl-designs" role="radiogroup" aria-label="Slide design">${DESIGNS.map((d) => { const t = theme({ ...o, design: d.id }); loadFonts(t); return `<label class="psl-design"><input type="radio" name="psl-design" value="${d.id}" data-psl="design" ${o.design === d.id ? 'checked' : ''}><span class="psl-thumb" aria-hidden="true">${slideHtml(cover, t, 2, 12)}</span><span class="psl-dn"><strong>${esc(d.name)}</strong><span class="meta">${esc(d.note)}</span></span></label>`; }).join('')}</div>`;
  }
  function optsHtml() {
    const p = program(), o = S.opts, ready = aiReady(), last = saved(p.id), mods = modules(p);
    const looksHtml = [...looks(), { id: 'custom', name: 'Custom', colors: o.custom }].map((l) => { const c = tones(l.colors || {}); return `<label class="psl-look"><input type="radio" name="psl-look" value="${esc(l.id)}" data-psl="look" ${o.look === l.id ? 'checked' : ''}><span class="psl-sw" aria-hidden="true"><i style="background:${c.bg}"></i><i style="background:${c.ink}"></i><i style="background:${c.accent}"></i></span><span>${esc(l.name)}</span></label>`; }).join('');
    const dz = design(o.design);
    const fontOpts = [['look', 'Match the look'], ['design', dz.name + ' fonts (' + dz.display + (dz.body !== dz.display ? ', ' + dz.body : '') + ')'], ...fontSets().map((f) => [f.id, f.name + ' (' + f.display + (f.body !== f.display ? ', ' + f.body : '') + ')']), ['custom', 'Custom Google Fonts']];
    const models = ready.providers.length ? `<label class="field"><span>AI model</span><select data-psl="model"><option value="auto"${o.model === 'auto' ? ' selected' : ''}>Auto</option>${MODELS.filter(([pr]) => ready.providers.includes(pr)).map(([, n, ms]) => `<optgroup label="${n}">${ms.map(([id, name]) => `<option value="${id}"${o.model === id ? ' selected' : ''}>${name}</option>`).join('')}</optgroup>`).join('')}</select></label>` : '';
    const nokey = isLive() && !ready.ok ? `<div class="psl-need" role="note"><p><strong>Add your AI key to make slides.</strong> Slides are written by your own AI model. Add a Claude, OpenAI or Perplexity API key in Connections. It takes a minute, and you only do it once.</p><button type="button" class="btn sm primary" data-action="fix-go" data-to="connect" data-id="claude">${icon('connect')}<span>Add API key</span></button></div>` : '';
    const err = S.error ? `<div class="psl-err" role="alert" data-nofix><p>${esc(S.error.message)}</p>${window.Fix ? window.Fix.html(S.error.message, S.error.status) : ''}</div>` : '';
    return `<div class="pg-editor psl-opts" data-psl-root><h2>Make slides</h2>
      <p>Turn modules and lessons into designed teaching slides in your brand. ${isLive() ? 'Your AI model writes the points and speaker notes from your lesson notes and attached materials.' : 'In the sample workspace the slides come straight from the outline.'} The program itself does not change.</p>
      ${nokey}
      ${last ? `<p class="meta psl-last">Last slides: ${esc(new Date(last.at).toLocaleString())}. <button type="button" class="linkbtn" data-action="psl-view">Open them</button></p>` : ''}
      <fieldset class="psl-fs"><legend>Modules</legend><div class="psl-mods">${mods.map((m, i) => { const n = (m.cards || []).length; return `<label class="psl-mod${n ? '' : ' is-off'}"><input type="checkbox" data-psl="stage" value="${esc(m.id)}" ${o.stages.includes(m.id) ? 'checked' : ''} ${n ? '' : 'disabled'}><span>${i + 1}. ${esc(m.title)}</span><span class="meta">${n ? n + (n === 1 ? ' lesson' : ' lessons') : 'No lessons yet'}</span></label>`; }).join('') || '<p class="meta">This program has no modules yet. Add a module with lessons first.</p>'}</div>
        ${mods.length > 1 ? `<div class="psl-modall"><button type="button" class="linkbtn" data-action="psl-all" data-v="1">Select all</button><button type="button" class="linkbtn" data-action="psl-all" data-v="0">Clear</button></div>` : ''}</fieldset>
      <fieldset class="psl-fs"><legend>Design</legend><p class="meta psl-span">Each design is its own slide system. Your AI model picks a layout per slide, like a statement, steps, a comparison or a big number, and writes to fit it.</p>${designsHtml()}</fieldset>
      <fieldset class="psl-fs"><legend>Colours and fonts</legend><div class="psl-looks">${looksHtml}</div>
        ${o.look === 'custom' ? `<div class="psl-colors">${[['bg', 'Background'], ['ink', 'Text'], ['accent', 'Accent']].map(([k, l]) => `<label class="field"><span>${l}</span><span class="psl-color"><input type="color" data-psl="c-${k}" value="${esc(hex(o.custom[k]) || '#000000')}"><input type="text" data-psl="c-${k}" value="${esc(o.custom[k])}" maxlength="7" spellcheck="false" aria-label="${l} hex"></span></label>`).join('')}</div>` : ''}
        <label class="field"><span>Fonts</span><select data-psl="fonts">${fontOpts.map(([v, l]) => `<option value="${esc(v)}"${o.fonts === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        ${o.fonts === 'custom' ? `<div class="psl-colors"><label class="field"><span>Heading font</span><input type="text" list="psl-fonts" data-psl="display" value="${esc(o.display)}" placeholder="Fraunces"></label><label class="field"><span>Body font</span><input type="text" list="psl-fonts" data-psl="body" value="${esc(o.body)}" placeholder="Inter"></label><datalist id="psl-fonts">${FONTS.map((f) => `<option value="${f}">`).join('')}</datalist><p class="meta psl-span">Any family name from Google Fonts works.</p></div>` : ''}
        ${S.kit && S.kit.logo ? `<label class="psl-check"><input type="checkbox" data-psl="logo" ${o.logo ? 'checked' : ''}><span>Put my Brand board logo on the cover</span></label>` : ''}
        ${S.kit && S.kit.palettes.length && window.OSBrandKit ? `<p class="meta">Starts from the slide look on your Brand board. <button type="button" class="linkbtn" data-action="psl-brand">Change the default</button></p>` : ''}
        ${!S.kit || !S.kit.palettes.length ? `<p class="meta">Want your own colours and fonts here every time? <button type="button" class="linkbtn" data-action="fix-go" data-to="brand">Set up your Brand board</button></p>` : ''}
        <div data-psl-preview>${preview()}</div></fieldset>
      <fieldset class="psl-fs"><legend>Content</legend>
        <div class="field"><span>Detail per lesson</span><div class="segmented" role="group" aria-label="Detail per lesson">${DEPTHS.map(([v, l]) => `<button type="button" data-action="psl-depth" data-v="${v}" aria-pressed="${o.depth === v}">${l}</button>`).join('')}</div></div>
        <label class="psl-check"><input type="checkbox" data-psl="notes" ${o.notes ? 'checked' : ''}><span>Write speaker notes</span></label>
        ${models}</fieldset>
      ${err}
      <p class="meta psl-status" role="status" aria-live="polite">${esc(S.status)}</p>
      <div class="actions pg-editor-actions"><button type="button" class="btn primary" data-action="psl-make" ${S.busy || (isLive() && !ready.ok) || !o.stages.length ? 'disabled' : ''}>${S.busy ? 'Writing slides…' : 'Make slides'}</button><button type="button" class="btn" data-action="drawer-close">${S.busy ? 'Hide' : 'Cancel'}</button></div></div>`;
  }

  /* ---------- viewer ---------- */
  function viewHtml() {
    const d = S.deck, list = flat(d), t = d.theme; loadFonts(t);
    S.i = Math.max(0, Math.min(S.i, list.length - 1)); const x = list[S.i];
    const failed = S.failed.length ? `<div class="psl-err" role="alert" data-nofix><p>${S.failed.length === 1 ? 'One module' : S.failed.length + ' modules'} could not be written: ${esc(S.failed.map((f) => f.title).join(', '))}. ${esc(S.failed[0].message)}</p>${window.Fix ? window.Fix.html(S.failed[0].message, S.failed[0].status) : ''}<button type="button" class="btn sm" data-action="psl-retry">${icon('refresh')}<span>Write the missing modules</span></button></div>` : '';
    return `<div class="pg-editor psl-view" data-psl-root>
      <div class="psl-head"><div><h2>${esc(d.title)}</h2><p class="meta">${list.length} slides · ${esc(design(t.design).name)} · ${esc(String(t.name).replace(/^Brand board: /, ""))} · ${esc(d.by || 'From the outline')} · ${esc(new Date(d.at).toLocaleDateString())}</p></div>
        <div class="actions"><button type="button" class="btn sm ghost" data-action="psl-opts">${icon('edit')}<span>New version</span></button><button type="button" class="btn sm ghost" data-action="psl-present">${icon('play')}<span>Present</span></button><button type="button" class="btn sm ghost" data-action="psl-pptx">${icon('download')}<span>PowerPoint</span></button><button type="button" class="btn sm ghost" data-action="psl-pdf">${icon('download')}<span>PDF</span></button></div></div>
      ${failed}
      <div class="psl-stage" data-psl-stage tabindex="-1">${slideHtml(x, t, S.i + 1, list.length)}</div>
      <div class="psl-nav"><button type="button" class="btn sm ghost" data-action="psl-go" data-d="-1" ${S.i ? '' : 'disabled'} aria-label="Previous slide">${icon('arrowleft')}</button><span class="meta" aria-live="polite">${S.i + 1} / ${list.length}</span><button type="button" class="btn sm ghost" data-action="psl-go" data-d="1" ${S.i < list.length - 1 ? '' : 'disabled'} aria-label="Next slide">${icon('arrow')}</button></div>
      ${x.notes ? `<div class="psl-notes"><h3>Speaker notes</h3><p>${esc(x.notes)}</p></div>` : ''}
      <ol class="psl-strip">${list.map((s, i) => `<li><button type="button" data-action="psl-at" data-i="${i}" ${i === S.i ? 'aria-current="true"' : ''}><span class="psl-n">${i + 1}</span><span>${esc(s.type === 'section' ? s.kick + ': ' + s.title : s.title || (s.quote && s.quote.text) || '')}</span></button></li>`).join('')}</ol>
      <p class="meta">Slides are kept in this browser for this program. Download them to keep a copy or edit them in PowerPoint, Keynote or Google Slides.</p></div>`;
  }

  function paint() { const html = S.view === 'view' && S.deck ? viewHtml() : optsHtml(); U.drawer(html, { label: 'Program slides', wide: true }); }
  function repaintPreview() { const el = document.querySelector('[data-psl-preview]'); if (el) el.innerHTML = preview(); }
  function repaintIfOpen() { if (document.querySelector('#drawer.open [data-psl-root]')) { const y = document.getElementById('drawer').scrollTop; paint(); document.getElementById('drawer').scrollTop = y; } }

  /* ---------- generation ---------- */
  const sentences = (t) => String(t || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.replace(/[.!?]+$/, '').trim()).filter((x) => x.length > 3 && x.length < 140);
  // The sample workspace has no AI, so the outline is laid out with the same rhythm the AI is asked for.
  function fromOutline(m, depth) {
    const per = depth === 'brief' ? 1 : depth === 'detailed' ? 3 : 2;
    const cards = m.cards || [];
    const out = [{ type: 'section', title: m.title, subtitle: cards.length + (cards.length === 1 ? ' lesson' : ' lessons'), bullets: [], notes: 'Introduce ' + m.title + ' and what people will be able to do after it.' }];
    cards.forEach((c, ci) => {
      const pts = sentences(c.body), notes = String(c.body || '').slice(0, 400), base = { type: 'content', lesson_id: c.id, notes };
      const short = pts.filter((x) => x.split(' ').length <= 16);
      const list = [];
      if (short[0]) list.push({ ...base, layout: 'statement', title: short[0], subtitle: c.title, em: '' });
      const rest = pts.filter((x) => x !== short[0]);
      const num = rest.find((x) => /\b\d[\d,.]*\s?(%|percent|x|days|weeks|minutes|hours|people|clients|members|steps)\b/i.test(x));
      if (rest.length >= 3 && rest.slice(0, 4).every((x) => x.split(' ').length <= 9)) list.push({ ...base, layout: ci % 2 ? 'steps' : 'grid', title: c.title, items: rest.slice(0, 4).map((x) => ({ head: x, text: '' })) });
      else list.push({ ...base, layout: 'points', title: c.title, bullets: (rest.length ? rest : pts).slice(0, 4).map((x) => x.split(' ').slice(0, 12).join(' ')) });
      if (num) { const v = num.match(/\d[\d,.]*\s?(%|x)?/)[0].trim(); list.push({ ...base, layout: 'stat', title: c.title, stat: { value: v, label: num.replace(v, '').split(' ').filter(Boolean).slice(0, 8).join(' ') }, bullets: [] }); }
      if (!list.length || !list.some((x) => x.layout === 'points' && x.bullets.length) && !list.some((x) => x.layout === 'steps')) list.push({ ...base, layout: 'points', title: c.title, bullets: ['Add lesson notes to fill this slide'] });
      list.slice(0, Math.max(1, per)).forEach((x) => out.push(x));
    });
    out.push({ type: 'recap', title: 'What you can do now', bullets: cards.slice(0, 6).map((c) => c.title), notes: 'Recap the lessons and point to the next module.' });
    return out;
  }
  async function writeModule(p, m) {
    if (!isLive()) return { slides: fromOutline(m, S.opts.depth), by: 'From the outline' };
    const r = await window.Auth.brainApi('program-slides', { workspace_id: wsId(), id: p.id, stage_id: m.id, design: S.opts.design, depth: S.opts.depth, notes: S.opts.notes, model: S.opts.model === 'auto' ? null : S.opts.model });
    return { slides: r.slides || [], by: r.model };
  }
  const STOP = /api key|connections|sign in|credit|quota|billing|rate limit|too many/i;
  async function make(onlyIds) {
    const p = program(); if (!p || S.busy) return;
    if (isLive() && !aiReady().ok) { S.error = { message: 'Slides are written by your own AI model. Add your Claude, OpenAI or Perplexity API key in Connections, then try again.', status: 409 }; repaintIfOpen(); return; }
    const order = modules(p).map((m) => m.id);
    const ids = (onlyIds || S.opts.stages).filter((id) => order.includes(id));
    const todo = order.filter((id) => ids.includes(id)).map((id) => modules(p).find((m) => m.id === id)).filter((m) => (m.cards || []).length);
    if (!todo.length) { S.error = { message: 'Pick at least one module that has lessons.' }; repaintIfOpen(); return; }
    S.busy = true; S.error = null; const t = theme();
    const base = onlyIds && S.deck ? S.deck : { pid: p.id, title: p.data.title, description: String(p.data.description || '').slice(0, 200), modules: [], theme: t, opts: { ...S.opts, stages: [...S.opts.stages] }, by: '' };
    const failed = []; const models = new Set(base.by ? [base.by] : []);
    for (let n = 0; n < todo.length; n++) {
      const m = todo[n]; S.status = `Writing module ${n + 1} of ${todo.length}: ${m.title}`; repaintIfOpen();
      try {
        const r = await writeModule(p, m); if (r.by) models.add(r.by);
        base.modules = base.modules.filter((x) => x.stage_id !== m.id);
        base.modules.push({ stage_id: m.id, title: m.title, num: order.indexOf(m.id) + 1, slides: r.slides });
      } catch (e) {
        failed.push({ id: m.id, title: m.title, message: e.message || 'This module could not be written.', status: e.status });
        if (STOP.test(e.message || '') || [401, 402, 403, 409, 429].includes(e.status)) { todo.slice(n + 1).forEach((r) => failed.push({ id: r.id, title: r.title, message: e.message, status: e.status })); break; }
      }
    }
    base.modules.sort((a, b) => order.indexOf(a.stage_id) - order.indexOf(b.stage_id));
    S.busy = false; S.status = '';
    if (!base.modules.length) { S.error = failed[0] || { message: 'No slides were written.' }; S.failed = []; S.view = 'opts'; repaintIfOpen(); if (!document.querySelector('#drawer.open [data-psl-root]')) U.toast(S.error.message, { status: S.error.status }); return; }
    base.at = Date.now(); base.by = [...models].join(', ') || 'From the outline';
    S.deck = base; S.failed = failed; S.view = 'view'; S.i = onlyIds ? S.i : 0; keep(base);
    if (document.querySelector('#drawer.open [data-psl-root]')) paint(); else U.toast(failed.length ? 'Slides are ready, with some modules missing. Open Make slides to see why.' : 'Your slides are ready. Open Make slides to see them.');
  }

  /* ---------- exports ---------- */
  function script(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('The download helper could not load. Check your internet connection, then try again.')); document.head.appendChild(s); }); }
  const fname = (d, ext) => (window.Programs && window.Programs.filename ? window.Programs.filename(d.title) : String(d.title).replace(/[^\w-]+/g, '-')) + '-slides.' + ext;
  async function dataUrl(src) { try { const r = await fetch(src); if (!r.ok) return null; const b = await r.blob(); return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => ok(null); f.readAsDataURL(b); }); } catch (e) { return null; } }
  // PowerPoint draws the same three designs with native text, so every word stays editable.
  async function pptx() {
    const d = S.deck; if (!d) return;
    if (!window.PptxGenJS) await script('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');
    const t = upgrade(d).theme, D = t.design || 'clean', c = (h) => String(h || '#000000').replace('#', '');
    const I = (v) => v * 0.13333, pt = (cqw) => Math.max(7, Math.round(cqw * 9.6)), H = 56.25;
    const P = { tech: { px: 6.6, pt: 9.6, pb: 8 }, editorial: { px: 7, pt: 10.4, pb: 8 }, clean: { px: 7.6, pt: 10, pb: 8.6 } }[D];
    const ed = D === 'editorial', tech = D === 'tech';
    const pres = new window.PptxGenJS(); pres.layout = 'LAYOUT_WIDE'; pres.title = d.title;
    const logo = t.logo ? await dataUrl(t.logo) : null; const list = flat(d);
    // PowerPoint has no CSS gradients, so the Tech gradient is painted once and used as the slide background.
    const gradBg = t.grad ? (() => { try { const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const g = cv.getContext('2d');
      const lin = g.createLinearGradient(0, 0, 1600 * 0.42, 900); lin.addColorStop(0.3, t.grad.from); lin.addColorStop(1, t.grad.to); g.fillStyle = lin; g.fillRect(0, 0, 1600, 900);
      g.save(); g.translate(1600, 0); g.scale(1, 1.33); const rad = g.createRadialGradient(0, 0, 0, 0, 0, 1600 * 0.6); rad.addColorStop(0, t.grad.glow); rad.addColorStop(1, t.grad.glow + '00'); g.fillStyle = rad; g.fillRect(-1600, 0, 1600, 900); g.restore();
      return cv.toDataURL('image/png').replace(/^data:/, ''); } catch (e) { return null; } })() : null;
    const W = 100 - 2 * P.px, dispBold = !ed && D !== 'clean', dispW = ed ? false : true;
    list.forEach((x, i) => {
      const s = pres.addSlide(), L = layoutOf(x), sec = ed && L === 'section';
      const bg = sec ? t.ink : t.bg, ink = sec ? t.bg : t.ink, muted = sec ? t.invMuted : t.muted, hi = sec ? t.invHi : t.hi;
      s.background = gradBg && !sec ? { data: gradBg } : { color: c(bg) };
      const box = (txt, x0, y0, w, h, o = {}) => s.addText(txt, { x: I(x0), y: I(y0), w: I(w), h: I(h), margin: 0, fontFace: o.face || t.body, fontSize: pt(o.size || 1.6), color: c(o.color || ink), bold: !!o.bold, italic: !!o.italic, align: o.align || 'left', valign: o.valign || 'top', lineSpacingMultiple: o.lh || 1.12, fit: o.fit === false ? undefined : 'shrink', charSpacing: o.cs });
      const rule = (x0, y0, w, color = t.line, wt = 0.75) => s.addShape(pres.ShapeType.line, { x: I(x0), y: I(y0), w: I(w), h: 0, line: { color: c(color), width: wt } });
      const vrule = (x0, y0, h, color = t.line) => s.addShape(pres.ShapeType.line, { x: I(x0), y: I(y0), w: 0, h: I(h), line: { color: c(color), width: 0.75 } });
      const rect = (x0, y0, w, h, fill, line) => s.addShape(pres.ShapeType.rect, { x: I(x0), y: I(y0), w: I(w), h: I(h), fill: fill ? { color: c(fill) } : { type: 'none' }, line: line ? { color: c(line), width: 0.75 } : { type: 'none' } });
      const runs = (text, em, o = {}) => { const v = String(text || ''), w = String(em || '').trim(), k = w ? v.toLowerCase().indexOf(w.toLowerCase()) : -1; if (k < 0 || w.length >= v.length) return v; return [{ text: v.slice(0, k) }, { text: v.slice(k, k + w.length), options: { color: c(hi), italic: ed || o.italic } }, { text: v.slice(k + w.length) }].filter((r) => r.text); };
      const title = (text, em, x0, y0, w, h, size, o = {}) => box(runs(text, em), x0, y0, w, h, { face: t.display, size, bold: dispBold && dispW, lh: o.lh || 1.02, valign: o.valign, color: o.color, italic: o.italic });
      const mono = tech ? t.mono : t.body, cap = (v) => (tech ? String(v).toUpperCase() : String(v));
      // Furniture: the frame, running head and folio of each design.
      if (tech) { rect(2.8, 2.8, 94.4, H - 5.6, null, t.line); rect(2.8, 2.8, 1.6, 0.28, t.mark); rect(2.8, 2.8, 0.28, 1.6, t.mark); rect(97.2 - 1.6, H - 2.8 - 0.28, 1.6, 0.28, t.mark); rect(97.2 - 0.28, H - 2.8 - 1.6, 0.28, 1.6, t.mark); }
      const headY = tech ? 3.8 : ed ? 2.9 : 3.6, prog = L === 'cover' ? t.handle || '' : x.program || '', num = L === 'cover' ? '' : pad(i + 1) + ' / ' + pad(list.length);
      if (prog && D !== 'clean') box(cap(prog), P.px, headY, W * 0.7, 1.4, { face: mono, size: tech ? 0.92 : 1, color: ed ? ink : muted, cs: tech ? 1 : 0, valign: 'middle' });
      if (num) box(num, P.px + W * 0.6, headY, W * 0.4, 1.4, { face: ed ? t.display : mono, italic: ed, size: ed ? 1.5 : tech ? 0.92 : 1, color: ed ? ink : muted, align: 'right', valign: 'middle' });
      if (ed) rule(P.px, headY + 2, W, ink);
      if (L !== 'cover' && L !== 'section' && x.module) box(cap(x.module), P.px, H - (tech ? 5.6 : 5), W * 0.7, 1.4, { face: mono, size: tech ? 0.92 : 1, color: muted, cs: tech ? 1 : 0, valign: 'middle' });
      const top = P.pt, bot = H - P.pb, ih = bot - top;
      const items = (x.items || []).slice(0, 5), bullets = (x.bullets || []).slice(0, 6);
      const rows = (arr, x0, y0, w, h, o = {}) => { const n = arr.length || 1, rh = Math.min(h / n, o.max || 6.2); arr.forEach((v, k) => { const y = y0 + k * rh; rule(x0, y, w, o.strong && !k ? ink : t.line); if (tech && o.mark !== false) rect(x0, y + rh / 2 - 0.4, 0.75, 0.75, t.mark); box(v, x0 + (tech && o.mark !== false ? 2.6 : o.indent || 0), y, w - (tech ? 2.6 : o.indent || 0), rh, { size: o.size || 1.9, valign: 'middle', color: o.color || ink, lh: 1.2 }); }); if (o.closed) rule(x0, y0 + n * rh, w); return n * rh; };
      if (L === 'cover') {
        const meta = (x.meta || []).filter((m) => m[1]);
        if (D === 'clean') {
          s.addShape(pres.ShapeType.ellipse, { x: I(P.px), y: I(top), w: I(1), h: I(1), fill: { color: c(t.mark) }, line: { type: 'none' } });
          title(x.title, x.em, P.px, top + 4.4, W * 0.76, 18, 6.6);
          if (x.subtitle) box(x.subtitle, P.px, top + 23, W * 0.5, 6, { size: 1.7, color: muted, lh: 1.4 });
          if (meta.length) { rule(P.px, bot - 6, W); meta.forEach(([k, v], j) => { box(k, P.px + j * (W / 3), bot - 4.6, W / 3, 1.4, { size: 1, color: muted }); box(v, P.px + j * (W / 3), bot - 3, W / 3, 3, { size: 2.2 }); }); }
        } else if (ed) {
          if (meta.length) meta.forEach(([k, v], j) => { box(k, P.px + j * 9, top, 9, 1.4, { size: 1, color: muted }); box(v, P.px + j * 9, top + 1.5, 9, 3, { face: t.display, size: 2.6 }); });
          const y0 = bot - 19; s.addShape(pres.ShapeType.rect, { x: I(P.px), y: I(y0), w: I(W), h: I(0.5), fill: { color: c(ink) }, line: { type: 'none' } });
          title(x.title, x.em, P.px, y0 + 2.4, W * 0.68, 16.6, 8.6, { lh: 0.92, valign: 'bottom' });
          if (x.subtitle) box(x.subtitle, P.px + W * 0.72, y0 + 2.4, W * 0.28, 16.6, { size: 1.55, color: muted, valign: 'bottom', lh: 1.4 });
        } else {
          [62, 88, 40, 100, 74, 30, 92, 55].forEach((w, k) => rect(100 - 6.6 - 24, 10 + k * 1.37, 24 * w / 100, 0.42, k === 2 ? t.mark : t.line));
          const y0 = bot - (meta.length ? 7 : 0) - (x.subtitle ? 6.5 : 0) - 15;
          title(x.title, x.em, P.px, y0, W * 0.72, 15, 6.6, { lh: 0.98, valign: 'bottom' });
          if (x.subtitle) box(x.subtitle, P.px, y0 + 16, W * 0.52, 5.5, { size: 1.7, color: muted, lh: 1.4 });
          if (meta.length) { rule(P.px, bot - 6, W * 0.6); meta.forEach(([k, v], j) => { box(cap(k), P.px + j * 12, bot - 4.6, 12, 1.3, { face: mono, size: 0.9, color: muted }); box(v, P.px + j * 12, bot - 3, 12, 3, { size: 2.2 }); }); }
        }
        if (logo) s.addImage({ data: logo, x: I(100 - P.px - 14), y: I(H - 6.8), w: I(14), h: I(3.4), sizing: { type: 'contain', w: I(14), h: I(3.4) } });
      } else if (L === 'section') {
        const n = pad(x.num || 1);
        if (D === 'clean') {
          box(n, P.px, bot - 24, 30, 11, { face: t.display, size: 12, color: muted, valign: 'bottom', lh: 0.85 });
          rule(P.px, bot - 11.6, W); s.addShape(pres.ShapeType.ellipse, { x: I(P.px), y: I(bot - 12.05), w: I(0.9), h: I(0.9), fill: { color: c(t.mark) }, line: { type: 'none' } });
          title(x.title, x.em, P.px, bot - 9.4, W * 0.8, 6.5, 5);
          if (x.subtitle) box(x.subtitle, P.px, bot - 2.6, W * 0.7, 2.6, { size: 1.7, color: muted });
        } else {
          const nw = ed ? 34 : 30;
          box(n, P.px, top, nw, ih, { face: t.display, size: ed ? 31 : 23, italic: ed, bold: tech, color: hi, valign: 'bottom', lh: 0.8 });
          if (tech) box(cap('Module ' + n), P.px + nw + 4, bot - 16, W - nw - 4, 1.4, { face: mono, size: 1, color: muted });
          title(x.title, x.em, P.px + nw + 4, bot - 14, W - nw - 4, 9.5, ed ? 5.6 : 4.6, { valign: 'bottom', color: ink });
          if (x.subtitle) box(x.subtitle, P.px + nw + 4, bot - 3.6, W - nw - 4, 3.6, { size: 1.7, color: muted });
        }
      } else if (L === 'statement') {
        title(x.title, x.em, P.px, top, W * (ed ? 0.86 : 0.8), ih - (x.subtitle ? 7 : 0), ed ? 5.8 : tech ? 5 : 4.6, { valign: 'middle', lh: ed ? 1.02 : 1.08 });
        if (x.subtitle) box(x.subtitle, P.px, bot - 6, W * 0.52, 5, { size: 1.7, color: muted, lh: 1.4 });
      } else if (L === 'quote') {
        const q = x.quote || { text: x.title }, qx = ed ? P.px + 9 : P.px;
        if (ed) box('\u201C', P.px - 0.5, top + 2, 9, 18, { face: t.display, size: 20, color: hi, lh: 1 });
        box((tech ? '\u201C' : '') + q.text, qx, top, W * 0.84, ih - 5, { face: t.display, size: ed ? 4.2 : tech ? 3.6 : 3.4, italic: ed, bold: tech, valign: 'middle', lh: 1.14 });
        if (q.who) box(cap(q.who), qx, bot - 3.6, W * 0.6, 2, { face: mono, size: 1.3, color: muted });
      } else if (L === 'stat') {
        const st = x.stat || {};
        box(st.value || '', P.px, top, 46, ih - 8, { face: t.display, size: ed ? 19 : D === 'clean' ? 15 : 16, italic: ed, bold: tech, color: hi, valign: 'bottom', lh: 0.85 });
        box(cap(st.label || ''), P.px, bot - 6.5, 40, 6.5, { face: ed ? t.display : mono, size: tech ? 1.1 : ed ? 2.2 : 1.9, color: ed ? ink : muted, lh: 1.2 });
        title(x.title, x.em, 54, top + ih * 0.3, 100 - P.px - 54, 9, ed ? 3 : 2.8, { valign: 'bottom' });
        if (bullets.length) rows(bullets.slice(0, 3), 54, top + ih * 0.3 + 10, 100 - P.px - 54, ih * 0.7 - 10, { size: 1.6, max: 4.6 });
      } else if (L === 'steps' || L === 'grid') {
        const n = items.length || 1, grid4 = L === 'grid' && n === 4 && !ed, cols = grid4 ? 2 : n, rws = grid4 ? 2 : 1;
        title(x.title, x.em, P.px, top, W * 0.8, 9, ed ? 4.6 : tech ? 3.6 : 3.4);
        const y0 = top + (ih > 30 ? 13 : 11), gap = tech ? 2.2 : ed ? 0 : 3, cw = (W - gap * (cols - 1)) / cols, rh = (bot - y0) / rws;
        if (ed) rule(P.px, y0, W, ink);
        items.forEach((it, k) => {
          const cx = P.px + (k % cols) * (cw + gap), cy = y0 + Math.floor(k / cols) * rh, pad2 = ed && k % cols ? 2.2 : 0, inner = tech && L === 'grid' ? 2 : 0;
          if (tech && L === 'grid') rect(cx, cy, cw, rh, k ? null : t.surface, t.line);
          else if (!ed) rule(cx, cy, cw);
          if (ed && k % cols) vrule(cx, cy, rh);
          if (tech && L === 'steps') rect(cx, cy - 0.5, 1, 1, t.mark);
          let y = cy + (tech ? 2.2 : 1.8);
          const label = L === 'steps' ? (ed ? String(k + 1) : pad(k + 1)) : (ed ? '' : pad(k + 1));
          if (label) { const big = (ed && L === 'steps') || (D === 'clean' && L === 'steps'); box(label, cx + pad2 + inner, y, cw - pad2 - inner * 2, big ? 5 : 1.6, { face: big ? t.display : mono, italic: ed, size: big ? (ed ? 4.6 : 4.2) : 1, color: D === 'clean' && L === 'steps' && k ? muted : hi }); y += big ? 6.4 : 3; }
          box(it.head, cx + pad2 + inner, y, cw - pad2 - inner * 2 - 1, 5, { face: t.display, size: ed ? 2.3 : 1.9, bold: !ed, italic: ed && L === 'grid', lh: 1.1 });
          if (it.text) box(it.text, cx + pad2 + inner, y + 5.2, cw - pad2 - inner * 2 - 1, Math.max(3, rh - (y - cy) - 6), { size: 1.4, color: muted, lh: 1.35 });
        });
      } else if (L === 'compare') {
        title(x.title, x.em, P.px, top, W * 0.8, 8, ed ? 4.6 : tech ? 3.6 : 3.4);
        const y0 = top + 11.4, gap = tech ? 2 : 0, cw = (W - gap) / 2, h = bot - y0;
        if (ed) { rule(P.px, y0, W, ink); vrule(P.px + cw, y0, h, ink); }
        if (tech) { rect(P.px, y0, cw, h, null, t.line); rect(P.px + cw + gap, y0, cw, h, null, t.mark); }
        if (D === 'clean') s.addShape(pres.ShapeType.roundRect, { x: I(P.px + cw), y: I(y0), w: I(cw), h: I(h), rectRadius: 0.16, fill: { color: c(t.surface) }, line: { type: 'none' } });
        [[x.left || {}, 0], [x.right || {}, 1]].forEach(([sd, k]) => {
          const ix = P.px + k * (cw + gap) + (tech ? 2.4 : ed ? (k ? 3 : 0) : (k ? 3 : 0)), iw = cw - (tech ? 4.8 : 3), y = y0 + (tech || D === 'clean' ? 2.6 : 1.8);
          box(ed ? sd.label || '' : cap(sd.label || ''), ix, y, iw, ed ? 3.4 : 1.6, { face: ed ? t.display : mono, italic: ed, size: ed ? 2.6 : tech ? 0.95 : 1.1, bold: D === 'clean', color: k ? hi : muted });
          rows((sd.items || []).slice(0, 4), ix, y + (ed ? 4.4 : 3), iw, h - (ed ? 7 : 7), { size: 1.8, mark: false, color: k ? ink : muted, max: 4.8 });
        });
      } else if (L === 'recap') {
        if (ed) { title(x.title, x.em, P.px, top, W * 0.3, ih, 4.6); rows(bullets.map((b, k) => (k + 1) + '   ' + b), P.px + W * 0.36, top, W * 0.64, ih, { size: 1.8, mark: false, max: 5.4, strong: true, closed: true }); }
        else {
          title(x.title, x.em, P.px, top, W * 0.8, 8, tech ? 3.6 : 3.4);
          const half = Math.ceil(bullets.length / 2), cw = (W - 4) / 2, y0 = top + 12;
          [bullets.slice(0, half), bullets.slice(half)].forEach((col, k) => rows(col.map((b) => '\u2713  ' + b), P.px + k * (cw + 4), y0, cw, bot - y0, { size: 1.8, mark: false, max: 5.6 }));
        }
      } else {
        if (ed) { title(x.title, x.em, P.px, top, W * 0.38, ih - (x.subtitle ? 8 : 0), 4.6); if (x.subtitle) box(x.subtitle, P.px, bot - 7, W * 0.38, 7, { size: 1.5, color: muted, valign: 'bottom', lh: 1.4 }); rows(bullets, P.px + W * 0.44, top, W * 0.56, ih, { size: bullets.length > 4 ? 1.65 : 1.95, mark: false, strong: true, closed: true, max: 6 }); }
        else if (D === 'clean') { title(x.title, x.em, P.px, top, W * 0.38, 12, 3.4); if (x.subtitle) box(x.subtitle, P.px, top + 13, W * 0.38, 8, { size: 1.5, color: muted, lh: 1.4 }); rows(bullets, P.px + W * 0.45, top, W * 0.55, ih, { size: bullets.length > 4 ? 1.65 : 1.95, closed: true, max: 6 }); }
        else {
          title(x.title, x.em, P.px, top, W * 0.78, 9, 3.6); if (x.subtitle) box(x.subtitle, P.px, top + 9.4, W * 0.7, 3, { size: 1.7, color: muted });
          const one = bullets.length <= 3, half = one ? bullets.length : Math.ceil(bullets.length / 2), cw = one ? W * 0.72 : (W - 4) / 2, rh = 6, y0 = bot - half * rh;
          [bullets.slice(0, half), one ? [] : bullets.slice(half)].forEach((col, k) => col.length && rows(col, P.px + k * (cw + 4), y0, cw, half * rh, { size: 1.85 }));
        }
      }
      if (x.notes) s.addNotes(x.notes);
    });
    await pres.writeFile({ fileName: fname(d, 'pptx') });
  }
  function pdf() {
    const d = S.deck; if (!d) return; const t = upgrade(d).theme, list = flat(d);
    const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title>${fontLinks(t)}<style>${CSS}@page{size:13.333in 7.5in;margin:0}html,body{margin:0;padding:0}.sl{width:13.333in;page-break-after:always;break-after:page}</style></head><body>${list.map((x, i) => slideHtml(x, t, i + 1, list.length)).join('')}</body></html>`;
    f.onload = async () => { try { await Promise.race([f.contentDocument.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { U.toast('The PDF could not open. Allow printing for this site, or use PowerPoint instead.'); } setTimeout(() => f.remove(), 60000); };
    document.body.appendChild(f);
  }

  /* ---------- actions ---------- */
  async function openSlides() {
    const p = program(); if (!p) return;
    U.drawer('<div class="pg-editor"><h2>Make slides</h2><p role="status">Loading your brand…</p></div>', { label: 'Program slides', wide: true });
    styleTag(); await loadKit();
    const last = saved(p.id);
    if (!S.opts || S.opts.pid !== p.id) { S.opts = { ...defaults(p, last && last.opts), pid: p.id }; S.error = null; S.failed = []; }
    if (S.deck && S.deck.pid !== p.id) S.deck = null;
    if (!S.deck && last) S.deck = last;
    S.view = S.deck && !S.busy ? 'view' : 'opts'; paint();
  }
  ACT['pg-slides'] = openSlides;
  ACT['psl-opts'] = () => { S.view = 'opts'; paint(); };
  ACT['psl-view'] = () => { const p = program(); S.deck = S.deck || saved(p.id); if (S.deck) { S.view = 'view'; S.i = 0; paint(); } };
  ACT['psl-make'] = () => make();
  ACT['psl-brand'] = () => { if (window.OSBrandKit) window.OSBrandKit.open(); };
  ACT['psl-retry'] = () => { const ids = S.failed.map((f) => f.id); S.failed = []; S.view = 'opts'; S.opts.stages = [...new Set([...S.opts.stages, ...ids])]; make(ids); };
  ACT['psl-depth'] = (el) => { S.opts.depth = el.dataset.v; el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); };
  ACT['psl-all'] = (el) => { const p = program(); S.opts.stages = el.dataset.v === '1' ? modules(p).filter((m) => (m.cards || []).length).map((m) => m.id) : []; repaintIfOpen(); };
  ACT['psl-go'] = (el) => { S.i += Number(el.dataset.d); paint(); const b = document.querySelector(`[data-action="psl-go"][data-d="${el.dataset.d}"]:not([disabled])`); if (b) b.focus(); };
  ACT['psl-at'] = (el) => { S.i = Number(el.dataset.i); paint(); const st = document.querySelector('[data-psl-stage]'); if (st) st.focus({ preventScroll: false }); };
  ACT['psl-pptx'] = async (el) => { el.disabled = true; try { await pptx(); U.toast('PowerPoint downloaded'); } catch (e) { U.toast(e.message || 'The PowerPoint file could not be made. Check your internet connection, then try again.'); } el.disabled = false; };
  ACT['psl-pdf'] = () => pdf();
  ACT['psl-present'] = async () => { const st = document.querySelector('[data-psl-stage]'); if (!st) return; try { await st.requestFullscreen(); st.focus(); } catch (e) { U.toast('Full screen is blocked in this browser. Use the PDF to present instead.'); } };
  const onField = (e) => {
    const el = e.target.closest && e.target.closest('[data-psl]'); if (!el || !S.opts) return; const k = el.dataset.psl, o = S.opts;
    if (k === 'design') { o.design = el.value; S.error = null; return repaintIfOpen(); }
    if (k === 'look') { o.look = el.value; S.error = null; return repaintIfOpen(); }
    if (k === 'fonts') { o.fonts = el.value; return repaintIfOpen(); }
    if (k === 'stage') { const set = new Set(o.stages); el.checked ? set.add(el.value) : set.delete(el.value); o.stages = [...set]; const b = document.querySelector('[data-action="psl-make"]'); if (b && !S.busy) b.disabled = !o.stages.length || (isLive() && !aiReady().ok); return; }
    if (k === 'notes') { o.notes = el.checked; return; }
    if (k === 'logo') { o.logo = el.checked; return repaintPreview(); }
    if (k === 'model') { o.model = el.value; return; }
    if (k === 'display' || k === 'body') { o[k] = el.value; return repaintPreview(); }
    if (k.startsWith('c-')) { const f = k.slice(2), v = hex(el.value.startsWith('#') ? el.value : '#' + el.value); if (!v) return; o.custom[f] = v; document.querySelectorAll(`[data-psl="${k}"]`).forEach((x) => { if (x !== el) x.value = v; }); repaintPreview(); }
  };
  document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#drawer [data-psl-root]') && !/^(design|look|fonts|stage|notes|logo|model)$/.test(e.target.dataset.psl || '')) onField(e); });
  document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('#drawer [data-psl-root]')) onField(e); });
  document.addEventListener('keydown', (e) => {
    if (!document.querySelector('#drawer.open .psl-view') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : 0; if (!d) return;
    const max = flat(S.deck).length - 1, ni = Math.max(0, Math.min(max, S.i + d)); if (ni === S.i) return; e.preventDefault(); S.i = ni;
    const fs = document.fullscreenElement && document.fullscreenElement.matches('[data-psl-stage]');
    if (fs) { const list = flat(S.deck); document.fullscreenElement.innerHTML = slideHtml(list[S.i], S.deck.theme, S.i + 1, list.length); } else paint();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.querySelector('#drawer.open .psl-view')) paint(); });

  // forget(): the Brand board changed, so the next Make slides starts from the new look.
  const forget = () => { S.kit = null; S.kitFor = null; S.opts = null; };
  // The Programs page control: three designs, each with its own colours.
  function pagePicker() {
    const cur = pageDesign() || (S.kit && S.kit.design) || 'clean';
    return `<div class="pg-design" role="radiogroup" aria-label="Slide design for new decks"><span class="meta">New slides</span>${DESIGNS.map((d) => `<button type="button" role="radio" aria-checked="${d.id === cur}" data-action="psl-page-design" data-design="${d.id}" title="${esc(d.note)}"><i aria-hidden="true" style="background:${d.grad ? `linear-gradient(155deg,${d.grad.from},${d.grad.glow})` : d.colors.bg}"><b style="background:${d.colors.accent}"></b></i>${esc(d.name)}</button>`).join('')}</div>`;
  }
  ACT['psl-page-design'] = (el) => { setPageDesign(el.dataset.design); if (window.App && window.App.render) window.App.render(true); U.toast(design(el.dataset.design).name + ' is now the design for new slides'); };
  // Load the Brand board quietly so the page shows its default before anyone picks.
  function warmKit() { if (!S.kit || S.kitFor !== wsId()) loadKit().then(() => { if (!pageDesign() && S.kit && S.kit.design && document.querySelector('.pg-design') && window.App) window.App.render(true); }).catch(() => {}); }
  window.ProgramSlides = { open: openSlides, pagePicker, warmKit, setPageDesign, pageDesign, state: () => S, theme, tones, contrast, flat, slideHtml, DESIGNS, LAYOUTS, samples, emph, fromOutline, styleTag, loadFonts, forget, reset: () => { S.deck = null; S.opts = null; S.error = null; S.failed = []; S.view = 'opts'; } };
})();

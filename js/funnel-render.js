// Founders AI OS: the Funnel Agent's page renderer.
// One spec in (brand kit, design choices, final offer, sales copy, image names), one complete sales page out.
// The same file runs in the browser (demo preview, live preview) and on the server (GitHub and Vercel publish).
(function (root) {
  const DISPLAY = ['Instrument Serif', 'Fraunces', 'DM Serif Display', 'Playfair Display', 'Cormorant Garamond', 'Libre Caslon Display', 'Bricolage Grotesque', 'Space Grotesk', 'Syne', 'Archivo', 'Sora', 'Manrope', 'Outfit', 'Plus Jakarta Sans', 'Unbounded', 'Familjen Grotesk', 'Hanken Grotesk', 'Inter Tight', 'Newsreader', 'Young Serif'];
  const BODY = ['Inter', 'Hanken Grotesk', 'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Figtree', 'Work Sans', 'Source Sans 3', 'IBM Plex Sans', 'Geist', 'Outfit', 'Sora', 'Instrument Sans', 'Public Sans', 'Onest'];
  const SERIFS = ['Instrument Serif', 'Fraunces', 'DM Serif Display', 'Playfair Display', 'Cormorant Garamond', 'Libre Caslon Display', 'Newsreader', 'Young Serif'];
  const SECTIONS = ['hero', 'proofbar', 'problem', 'story', 'mechanism', 'compare', 'outcomes', 'stack', 'bonuses', 'proof', 'who', 'guarantee', 'about', 'urgency', 'faq', 'final'];
  const SECTION_NAMES = { hero: 'Hero', proofbar: 'Proof bar', problem: 'Problem and pain', story: 'Story', mechanism: 'How it works', compare: 'Old way and new way', outcomes: 'Outcomes', stack: 'Offer stack and price', bonuses: 'Bonuses', proof: 'Testimonials', who: 'Who it is for', guarantee: 'Guarantee', about: 'About the founder', urgency: 'Why now', faq: 'FAQ', final: 'Final call' };

  /* ---------- text ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // House rules for every word on the page: no em dashes, no exclamation points, no leftover placeholders.
  const clean = (s) => String(s == null ? '' : s).replace(/\s*\u2014\s*/g, ', ').replace(/\s+\u2013\s+/g, ', ').replace(/!+/g, '.').replace(/\.\.(?!\.)/g, '.').replace(/\s{2,}/g, ' ').trim();
  const t = (s) => esc(clean(s));
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((v) => v != null && v !== '');
  const has = (x) => Array.isArray(x) ? x.length > 0 : !!(x && String(x).trim());

  /* ---------- colour ---------- */
  const hex = (h, d) => { const m = String(h || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return d; let v = m[1]; if (v.length === 3) v = v.split('').map((c) => c + c).join(''); return '#' + v.toLowerCase(); };
  const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const lum = (h) => { const [r, g, b] = rgb(h).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, p) => { const A = rgb(a), B = rgb(b); return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * p).toString(16).padStart(2, '0')).join(''); };
  const readable = (fg, bg, min) => { if (contrast(fg, bg) >= min) return fg; const dark = lum(bg) > 0.4; for (let p = 0.1; p <= 1; p += 0.1) { const c = mix(fg, dark ? '#0b0b0b' : '#ffffff', p); if (contrast(c, bg) >= min) return c; } return dark ? '#0b0b0b' : '#ffffff'; };
  const onColor = (bg) => contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111';

  function palette(p) {
    p = p || {};
    const bg = hex(p.bg, '#faf8f4');
    const ink = readable(hex(p.ink, '#141210'), bg, 10);
    const accent = hex(p.accent, '#d9692f');
    const deep = hex(p.deep, lum(bg) > 0.4 ? '#161412' : '#f4efe6');
    const out = {
      bg, ink, accent, deep,
      surface: hex(p.surface, mix(bg, lum(bg) > 0.4 ? '#ffffff' : '#000000', 0.55)),
      muted: readable(hex(p.muted, mix(ink, bg, 0.38)), bg, 4.8),
      line: hex(p.line, mix(ink, bg, 0.86)),
      accent_ink: hex(p.accent_ink, null) && contrast(hex(p.accent_ink), accent) >= 4.5 ? hex(p.accent_ink) : onColor(accent),
      deep_ink: readable(hex(p.deep_ink, onColor(deep)), deep, 10),
    };
    out.accent_text = readable(accent, bg, 3.2); // accent used as text on the page background
    out.deep_muted = readable(mix(out.deep_ink, deep, 0.3), deep, 4.6);
    out.deep_accent = readable(accent, deep, 3.2);
    return out;
  }
  const pickFont = (f, list, d) => { const x = String(f || '').trim().toLowerCase(); return list.find((n) => n.toLowerCase() === x) || d; };
  function fontsLink(display, body) {
    const fam = (n, w) => 'family=' + n.replace(/ /g, '+') + w;
    const dw = SERIFS.includes(display) ? (/Instrument Serif|DM Serif Display|Libre Caslon Display|Young Serif/.test(display) ? ':ital@0;1' : ':ital,wght@0,400;0,500;0,600;1,400') : ':wght@500;600;700';
    const parts = [fam(display, dw)]; if (body !== display) parts.push(fam(body, ':wght@400;500;600;700'));
    return 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap';
  }

  /* ---------- money ---------- */
  const SYM = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', AUD: 'A$', CAD: 'C$', SEK: 'kr ', NOK: 'kr ', DKK: 'kr ' };
  function money(n, cur) {
    if (n == null || n === '' || isNaN(+n)) return '';
    const v = +n; const s = v % 1 ? v.toFixed(2) : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const c = String(cur || 'USD').toUpperCase(); const sym = SYM[c];
    return sym ? (c === 'EUR' ? sym + s : sym + s) : s + ' ' + c;
  }

  /* ---------- icons ---------- */
  const I = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.6c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.8 12 2.2 2.2 4.3-4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.8 5.5 13.2H11l-1 8 7.5-10.4H12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    quote: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6C6.5 7.2 5 9.6 5 13v5h5v-5H7.6c.1-2.1 1-3.6 2.9-4.6zm9 0c-3 1.2-4.5 3.6-4.5 7v5h5v-5h-2.4c.1-2.1 1-3.6 2.9-4.6z" fill="currentColor"/></svg>',
  };

  /* ---------- artwork when there is no generated image ---------- */
  const short = (x, n) => { x = String(x || ''); if (x.length <= n) return x; const cut = x.slice(0, n); const sp = cut.lastIndexOf(' '); return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.:;-]+$/, '') + '\u2026'; };
  function art(kind, s, P) {
    const o = s.offer || {}; const name = clean(o.name || s.brand.name || 'Your offer');
    const items = arr(o.stack).slice(0, 4).map((x) => clean(x.name)).filter(Boolean);
    const words = name.split(/\s+/); const l1 = []; const l2 = []; words.forEach((w) => ((l1.join(' ') + ' ' + w).length < 18 && !l2.length ? l1 : l2).push(w));
    if (kind === 'hero') {
      return `<svg class="art" viewBox="0 0 640 520" role="img" aria-label="${esc(name)}">
        <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.deep}"/><stop offset="1" stop-color="${mix(P.deep, P.accent, 0.35)}"/></linearGradient>
        <radialGradient id="g2" cx="0.8" cy="0.15" r="0.7"><stop offset="0" stop-color="${P.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${P.accent}" stop-opacity="0"/></radialGradient></defs>
        <rect x="0" y="0" width="640" height="520" rx="28" fill="${mix(P.bg, P.accent, 0.1)}"/>
        <circle cx="560" cy="70" r="190" fill="url(#g2)"/>
        <g transform="translate(150 70) rotate(-6 170 190)"><rect width="320" height="380" rx="22" fill="${mix(P.surface, P.ink, 0.04)}" stroke="${P.line}"/></g>
        <g transform="translate(120 60)"><rect width="360" height="400" rx="24" fill="url(#g1)"/>
          <rect x="30" y="30" width="64" height="8" rx="4" fill="${P.accent}"/>
          <text x="30" y="112" fill="${P.deep_ink}" font-family="var(--fd)" font-size="40" font-weight="600">${esc(l1.join(' '))}</text>
          ${l2.length ? `<text x="30" y="158" fill="${P.deep_ink}" font-family="var(--fd)" font-size="40" font-weight="600">${esc(l2.join(' ').slice(0, 22))}</text>` : ''}
          ${items.map((x, i) => `<g transform="translate(30 ${204 + i * 36})"><circle cx="9" cy="9" r="9" fill="${P.accent}"/><path d="m5 9.5 2.7 2.7L13.2 6.5" stroke="${P.accent_ink}" stroke-width="2" fill="none" stroke-linecap="round"/><text x="30" y="14" fill="${P.deep_muted}" font-family="var(--fb)" font-size="15">${esc(short(x, 27))}</text></g>`).join('')}
        </g>
        <g transform="translate(400 392)"><rect width="190" height="100" rx="18" fill="${P.surface}" stroke="${P.line}"/><text x="22" y="40" fill="${P.muted}" font-family="var(--fb)" font-size="14">Total value</text><text x="22" y="76" fill="${P.ink}" font-family="var(--fd)" font-size="30" font-weight="600">${esc(stackTotal(o) ? money(stackTotal(o), (o.price || {}).currency) : 'Inside')}</text></g>
      </svg>`;
    }
    if (kind === 'story') {
      return `<svg class="art" viewBox="0 0 560 600" role="img" aria-label="">
        <rect width="560" height="600" rx="28" fill="${P.deep}"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="280" cy="300" r="${60 + i * 42}" fill="none" stroke="${i === 2 ? P.accent : P.deep_muted}" stroke-opacity="${i === 2 ? 0.9 : 0.25}" stroke-width="${i === 2 ? 3 : 1.4}"/>`).join('')}
        <circle cx="${280 + 144 * Math.cos(-0.7)}" cy="${300 + 144 * Math.sin(-0.7)}" r="10" fill="${P.accent}"/>
        <text x="280" y="312" text-anchor="middle" fill="${P.deep_ink}" font-family="var(--fd)" font-size="34">${esc(clean((s.brand || {}).name || name).slice(0, 18))}</text>
      </svg>`;
    }
    return `<svg class="art" viewBox="0 0 600 400" role="img" aria-label=""><rect width="600" height="400" rx="24" fill="${mix(P.bg, P.accent, 0.12)}"/><path d="M0 300 C150 220 260 360 400 260 S560 180 600 200 V400 H0Z" fill="${P.accent}" fill-opacity="0.25"/><path d="M0 330 C170 280 290 380 420 300 S560 250 600 260 V400 H0Z" fill="${P.deep}"/></svg>`;
  }
  const stackTotal = (o) => arr(o.stack).concat(arr(o.bonuses)).reduce((n, x) => n + (+x.value || 0), 0);

  /* ---------- sections ---------- */
  function cta(label, href, cls) { return `<a class="btn ${cls || ''}" href="${esc(href)}" data-cta>${t(label || 'Get instant access')}${I.arrow}</a>`; }
  function trust(s) {
    const g = (s.offer || {}).guarantee || {};
    const xs = [[I.lock, 'Secure checkout'], g.days ? [I.shield, g.days + '-day guarantee'] : g.name ? [I.shield, clean(g.name)] : null, [I.bolt, clean(((s.copy || {}).hero || {}).trust || 'Instant access')]].filter(Boolean);
    return `<ul class="trust">${xs.map(([i, l]) => `<li>${i}<span>${esc(l)}</span></li>`).join('')}</ul>`;
  }
  function img(s, slot, alt, P, cls) {
    const a = (s.assets || {})[slot];
    if (a) return `<img class="${cls || ''}" src="${esc(s.__base + a)}" alt="${t(alt || '')}" ${slot === 'hero' ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    return art(slot, s, P);
  }
  const head = (eyebrow, title, intro, center) => `<div class="head${center ? ' center' : ''}">${eyebrow ? `<p class="eyebrow">${t(eyebrow)}</p>` : ''}${title ? `<h2>${hl(title)}</h2>` : ''}${intro ? `<p class="lede">${t(intro)}</p>` : ''}</div>`;
  // *word* in a headline becomes the accent phrase.
  const hl = (s) => t(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const R = {
    hero(s, P) {
      const h = (s.copy || {}).hero || {}; const o = s.offer || {}; const pr = o.price || {};
      const price = money(pr.amount, pr.currency); const anchor = money(pr.compare_at, pr.currency);
      const split = (s.design || {}).hero !== 'centered';
      let headline = hl(h.headline || o.promise || o.name);
      if (h.highlight && !/<em>/.test(headline)) { const hh = t(h.highlight); headline = headline.includes(hh) ? headline.replace(hh, '<em>' + hh + '</em>') : headline; }
      return `<section class="hero ${split ? 'split' : 'centered'}${(s.design || {}).hero_tone === 'deep' ? ' tone-deep' : ''}" id="top"><div class="wrap">
        <div class="hero-copy">
          ${h.eyebrow ? `<p class="pill">${t(h.eyebrow)}</p>` : ''}
          <h1>${headline}</h1>
          ${h.sub ? `<p class="sub">${t(h.sub)}</p>` : ''}
          <div class="hero-cta">${cta(h.cta || o.cta, s.__checkout, 'lg')}${price ? `<p class="price-chip">${anchor ? `<s>${anchor}</s>` : ''}<b>${price}</b>${pr.note ? `<span>${t(pr.note)}</span>` : ''}</p>` : ''}</div>
          ${trust(s)}
        </div>
        <figure class="hero-media reveal">${img(s, 'hero', o.name, P)}</figure>
      </div></section>`;
    },
    proofbar(s) {
      const items = arr(((s.copy || {}).proofbar || {}).items).slice(0, 4); if (!items.length) return '';
      return `<section class="proofbar"><div class="wrap"><ul>${items.map((x) => `<li><b>${t(x.n || x.value)}</b><span>${t(x.label)}</span></li>`).join('')}</ul></div></section>`;
    },
    problem(s) {
      const p = (s.copy || {}).problem || {}; if (!has(p.bullets) && !p.title) return '';
      return `<section class="problem"><div class="wrap two">
        <div class="sticky">${head(p.eyebrow, p.title, p.intro)}</div>
        <div><ul class="pains">${arr(p.bullets).map((b) => `<li class="reveal">${I.x}<span>${t(b)}</span></li>`).join('')}</ul>${p.close ? `<p class="close">${t(p.close)}</p>` : ''}</div>
      </div></section>`;
    },
    story(s, P) {
      const p = (s.copy || {}).story || {}; if (!has(p.paragraphs)) return '';
      return `<section class="story"><div class="wrap two media-left">
        <figure class="story-media reveal">${img(s, 'story', (s.brand || {}).name, P)}</figure>
        <div>${head(p.eyebrow, p.title)}<div class="prose">${arr(p.paragraphs).map((x) => `<p>${t(x)}</p>`).join('')}</div></div>
      </div></section>`;
    },
    mechanism(s) {
      const m = (s.copy || {}).mechanism || {}; const mo = (s.offer || {}).mechanism || {}; const steps = arr(mo.steps).slice(0, 5); if (!steps.length) return '';
      return `<section class="mechanism"><div class="wrap">
        ${head(m.eyebrow || (mo.name ? (/^the\s/i.test(mo.name) ? mo.name : 'The ' + mo.name) : 'How it works'), m.title || mo.name, m.intro, true)}
        <ol class="steps n${steps.length}">${steps.map((x, i) => `<li class="reveal"><span class="num">${String(i + 1).padStart(2, '0')}</span><h3>${t(x.name)}</h3><p>${t(x.what)}</p></li>`).join('')}</ol>
      </div></section>`;
    },
    compare(s) {
      const c = (s.copy || {}).compare || {}; if (!has(c.old) || !has(c.new)) return '';
      return `<section class="compare"><div class="wrap">${head(c.eyebrow, c.title, c.intro, true)}
        <div class="cmp"><div class="cmp-old reveal"><h3>${t(c.old_label || 'The old way')}</h3><ul>${arr(c.old).map((x) => `<li>${I.x}<span>${t(x)}</span></li>`).join('')}</ul></div>
        <div class="cmp-new reveal"><h3>${t(c.new_label || 'With ' + ((s.offer || {}).name || 'this'))}</h3><ul>${arr(c.new).map((x) => `<li>${I.check}<span>${t(x)}</span></li>`).join('')}</ul></div></div>
      </div></section>`;
    },
    outcomes(s) {
      const c = (s.copy || {}).outcomes || {}; const items = arr(c.items).slice(0, 6); if (!items.length) return '';
      return `<section class="outcomes"><div class="wrap">${head(c.eyebrow, c.title, c.intro)}
        <div class="grid g${items.length % 3 === 0 ? 3 : items.length === 4 ? 2 : 3}">${items.map((x) => `<article class="card reveal"><span class="tick">${I.check}</span><h3>${t(x.title)}</h3><p>${t(x.body)}</p></article>`).join('')}</div>
      </div></section>`;
    },
    stack(s, P) {
      const c = (s.copy || {}).stack || {}; const o = s.offer || {}; const pr = o.price || {}; const items = arr(o.stack); if (!items.length) return '';
      const total = stackTotal({ stack: items, bonuses: o.bonuses }); const plans = arr(pr.plans);
      return `<section class="stack tone-deep" id="offer"><div class="wrap">
        ${head(c.eyebrow || 'Everything you get', c.title || ('Introducing ' + (o.name || '')), c.intro, true)}
        <div class="stack-box reveal">
          <div class="stack-media">${(s.assets || {}).stack ? img(s, 'stack', o.name, P) : (s.assets || {}).hero ? img(s, 'hero', o.name, P) : art('hero', s, P)}</div>
          <div class="stack-list"><ul>${items.map((x) => `<li><span class="ck">${I.check}</span><div><b>${t(x.name)}</b>${x.what ? `<p>${t(x.what)}</p>` : ''}</div>${+x.value ? `<span class="val">${money(x.value, pr.currency)} value</span>` : ''}</li>`).join('')}
          ${arr(o.bonuses).map((x, i) => `<li class="bonus"><span class="ck">${I.plus}</span><div><b>Bonus ${i + 1}: ${t(x.name)}</b>${x.what ? `<p>${t(x.what)}</p>` : ''}</div>${+x.value ? `<span class="val">${money(x.value, pr.currency)} value</span>` : ''}</li>`).join('')}</ul>
          <div class="price-box">
            ${total ? `<p class="total">${t(c.total_label || 'Total value')} <s>${money(total, pr.currency)}</s></p>` : ''}
            <p class="today"><span>${t(c.today_label || 'Today')}</span><b>${money(pr.amount, pr.currency)}</b>${pr.note ? `<em>${t(pr.note)}</em>` : ''}</p>
            ${plans.length ? `<ul class="plans">${plans.map((x) => `<li>${t(x.label)}${x.amount ? ' \u00b7 ' + money(x.amount, pr.currency) + (x.every ? ' ' + t(x.every) : '') : ''}</li>`).join('')}</ul>` : ''}
            ${cta(c.cta || o.cta, s.__checkout, 'lg block')}
            ${trust(s)}
            ${c.note ? `<p class="fine">${t(c.note)}</p>` : ''}
          </div></div>
        </div>
      </div></section>`;
    },
    bonuses(s) {
      const c = (s.copy || {}).bonuses || {}; const xs = arr((s.offer || {}).bonuses); if (!xs.length || !c.title) return '';
      const cur = ((s.offer || {}).price || {}).currency;
      return `<section class="bonuses"><div class="wrap">${head(c.eyebrow, c.title, c.intro, true)}
        <div class="grid g${Math.min(3, xs.length)}">${xs.map((x, i) => `<article class="card bonus-card reveal"><p class="tag">Bonus ${i + 1}${+x.value ? ' \u00b7 ' + money(x.value, cur) + ' value' : ''}</p><h3>${t(x.name)}</h3><p>${t(x.what)}</p></article>`).join('')}</div></div></section>`;
    },
    proof(s) {
      const c = (s.copy || {}).proof || {}; const xs = arr(c.items).filter((x) => x && x.quote); if (!xs.length) return '';
      return `<section class="proof"><div class="wrap">${head(c.eyebrow, c.title, c.intro, true)}
        <div class="grid g${Math.min(3, xs.length)}">${xs.slice(0, 6).map((x) => `<figure class="card quote reveal">${I.quote}${x.result ? `<p class="result">${t(x.result)}</p>` : ''}<blockquote>${t(x.quote)}</blockquote><figcaption><span class="av">${esc(clean(x.name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><span><b>${t(x.name)}</b>${x.role ? `<em>${t(x.role)}</em>` : ''}</span></figcaption></figure>`).join('')}</div></div></section>`;
    },
    who(s) {
      const c = (s.copy || {}).who || {}; if (!has(c.for)) return '';
      return `<section class="who"><div class="wrap">${head(c.eyebrow, c.title || 'Is this for you?', c.intro, true)}
        <div class="cmp"><div class="cmp-new reveal"><h3>${t(c.for_label || 'This is for you if')}</h3><ul>${arr(c.for).map((x) => `<li>${I.check}<span>${t(x)}</span></li>`).join('')}</ul></div>
        ${has(c.not_for) ? `<div class="cmp-old reveal"><h3>${t(c.not_label || 'It is not for you if')}</h3><ul>${arr(c.not_for).map((x) => `<li>${I.x}<span>${t(x)}</span></li>`).join('')}</ul></div>` : ''}</div></div></section>`;
    },
    guarantee(s, P) {
      const c = (s.copy || {}).guarantee || {}; const g = (s.offer || {}).guarantee || {}; if (!c.body && !g.terms) return '';
      const label = (g.days ? g.days + ' DAY ' : '') + 'GUARANTEE \u00b7 ' + (g.days ? g.days + ' DAY ' : '') + 'GUARANTEE \u00b7 ';
      return `<section class="guarantee"><div class="wrap"><div class="g-box reveal">
        <svg class="seal" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="sc" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0"/></defs><circle cx="100" cy="100" r="96" fill="${P.accent}"/><circle cx="100" cy="100" r="58" fill="none" stroke="${P.accent_ink}" stroke-opacity=".5"/><text fill="${P.accent_ink}" font-family="var(--fb)" font-size="13" font-weight="700" letter-spacing="3"><textPath href="#sc">${esc(label)}</textPath></text><text x="100" y="${g.days ? 112 : 108}" text-anchor="middle" fill="${P.accent_ink}" font-family="var(--fd)" font-size="${g.days ? 44 : 24}" font-weight="600">${g.days ? esc(String(g.days)) : 'Safe'}</text></svg>
        <div>${head(c.eyebrow, c.title || g.name || 'Our guarantee')}<p class="lede">${t(c.body || g.terms)}</p></div>
      </div></div></section>`;
    },
    about(s) {
      const c = (s.copy || {}).about || {}; if (!has(c.paragraphs)) return '';
      const pic = (s.assets || {}).about;
      const inner = `${head(c.eyebrow || 'Who is behind this', c.title)}
        <div class="prose">${arr(c.paragraphs).map((x) => `<p>${t(x)}</p>`).join('')}</div>
        ${has(c.creds) ? `<ul class="creds">${arr(c.creds).map((x) => `<li>${t(x)}</li>`).join('')}</ul>` : ''}`;
      return pic ? `<section class="about"><div class="wrap about-grid"><figure class="about-media reveal">${img(s, 'about', (s.brand || {}).name || 'The founder')}</figure><div>${inner}</div></div></section>` : `<section class="about"><div class="wrap narrow">${inner}</div></section>`;
    },
    urgency(s) {
      const c = (s.copy || {}).urgency || {}; if (!c.body) return '';
      return `<section class="urgency"><div class="wrap"><div class="u-box reveal"><div><h2>${hl(c.title || 'Why now')}</h2><p>${t(c.body)}</p></div>${cta(c.cta || (s.offer || {}).cta, s.__checkout)}</div></div></section>`;
    },
    faq(s) {
      const c = (s.copy || {}).faq || {}; const xs = arr(c.items).filter((x) => x && x.q); if (!xs.length) return '';
      return `<section class="faq"><div class="wrap two">
        <div class="sticky">${head(c.eyebrow || 'Questions', c.title || 'Questions people ask before they join', c.intro)}</div>
        <div class="qa">${xs.map((x, i) => `<details${i === 0 ? ' open' : ''}><summary><span>${t(x.q)}</span>${I.plus}</summary><p>${t(x.a)}</p></details>`).join('')}</div>
      </div></section>`;
    },
    final(s) {
      const c = (s.copy || {}).final || {}; const o = s.offer || {}; const pr = o.price || {};
      return `<section class="final tone-deep"><div class="wrap narrow center">
        <h2>${hl(c.title || o.promise || o.name)}</h2>${c.body ? `<p class="lede">${t(c.body)}</p>` : ''}
        <div class="final-cta">${cta(c.cta || o.cta, s.__checkout, 'lg')}${pr.amount ? `<p class="price-chip">${pr.compare_at ? `<s>${money(pr.compare_at, pr.currency)}</s>` : ''}<b>${money(pr.amount, pr.currency)}</b></p>` : ''}</div>
        ${trust(s)}
        ${(s.copy || {}).ps ? `<p class="ps"><b>P.S.</b> ${t(String((s.copy || {}).ps).replace(/^\s*p\.?\s*s\.?[\s:]*/i, ''))}</p>` : ''}
      </div></section>`;
    },
  };

  /* ---------- styles ---------- */
  function css(P, F, d) {
    const r = Math.max(0, Math.min(28, +((d || {}).radius != null ? d.radius : 16)));
    const pill = (d || {}).button !== 'soft';
    const serif = SERIFS.includes(F.display);
    return `:root{--bg:${P.bg};--surface:${P.surface};--ink:${P.ink};--muted:${P.muted};--line:${P.line};--accent:${P.accent};--accent-ink:${P.accent_ink};--accent-text:${P.accent_text};--deep:${P.deep};--deep-ink:${P.deep_ink};--deep-muted:${P.deep_muted};--deep-accent:${P.deep_accent};--r:${r}px;--fd:'${F.display}',${serif ? 'serif' : 'sans-serif'};--fb:'${F.body}',sans-serif;--w:1160px}
*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.65 var(--fb);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img,svg{display:block;max-width:100%}a{color:inherit}h1,h2,h3{font-family:var(--fd);font-weight:${serif ? 400 : 650};letter-spacing:${serif ? '-0.01em' : '-0.025em'};line-height:1.06;margin:0;text-wrap:balance}
h1{font-size:clamp(2.55rem,5.6vw,${serif ? '5.1rem' : '4.4rem'})}h2{font-size:clamp(2rem,3.8vw,${serif ? '3.4rem' : '2.9rem'})}h3{font-size:${serif ? '1.45rem' : '1.2rem'};line-height:1.25;letter-spacing:-0.01em}
h1 em,h2 em{font-style:${serif ? 'italic' : 'normal'};color:var(--accent-text)}p{margin:0}.wrap{width:min(var(--w),100% - 40px);margin:0 auto}.narrow{max-width:760px}.center{text-align:center}
section{padding:clamp(72px,10vw,128px) 0}.tone-deep{background:var(--deep);color:var(--deep-ink)}.tone-deep .lede,.tone-deep .eyebrow,.tone-deep p{color:var(--deep-muted)}.tone-deep h2 em,.tone-deep h1 em{color:var(--deep-accent)}
.eyebrow{font:600 13px/1.2 var(--fb);letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:16px}.head{margin-bottom:clamp(36px,5vw,56px);max-width:720px}.head.center{margin-left:auto;margin-right:auto;text-align:center}.lede{font-size:clamp(1.05rem,1.5vw,1.2rem);color:var(--muted);margin-top:18px;max-width:62ch}.head.center .lede{margin-left:auto;margin-right:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--accent);color:var(--accent-ink);text-decoration:none;font:600 16px/1 var(--fb);padding:16px 26px;border-radius:${pill ? '999px' : 'calc(var(--r) * .7)'};transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 10px 24px -12px ${P.accent}}
.btn svg{width:18px;height:18px;transition:transform .18s ease}.btn:hover{transform:translateY(-1px);filter:brightness(1.04)}.btn:hover svg{transform:translateX(3px)}.btn:focus-visible,summary:focus-visible{outline:3px solid var(--ink);outline-offset:3px}.btn.lg{padding:19px 30px;font-size:17px}.btn.block{width:100%}
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid transparent;transition:border-color .2s}.nav.scrolled{border-color:var(--line)}.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:68px}.logo{font:${serif ? 400 : 700} 22px/1 var(--fd);letter-spacing:-0.01em;text-decoration:none;display:flex;align-items:center;gap:10px}.logo i{width:10px;height:10px;border-radius:50%;background:var(--accent);display:inline-block}.nav .btn{padding:11px 18px;font-size:14px}
.hero{padding:clamp(40px,6vw,84px) 0 clamp(64px,8vw,104px)}.hero.split .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(32px,5vw,72px);align-items:center}.hero.centered .wrap{text-align:center;max-width:960px}.hero.centered .hero-copy{display:flex;flex-direction:column;align-items:center}.hero.centered .hero-media{margin-top:56px}
.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface);padding:7px 14px 7px 12px;border-radius:999px;font:600 13px/1.2 var(--fb);color:var(--muted);margin-bottom:24px}.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent)}
.sub{font-size:clamp(1.1rem,1.6vw,1.28rem);color:var(--muted);margin-top:24px;max-width:56ch}.hero-cta,.final-cta{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-top:34px}.hero.centered .hero-cta,.final-cta{justify-content:center}
.price-chip{display:flex;align-items:baseline;gap:10px;font-family:var(--fb)}.price-chip s{color:var(--muted);font-size:17px}.price-chip b{font:${serif ? 400 : 700} 30px/1 var(--fd)}.price-chip span{color:var(--muted);font-size:14px}.tone-deep .price-chip s{color:var(--deep-muted)}
.trust{list-style:none;padding:0;margin:26px 0 0;display:flex;gap:22px;flex-wrap:wrap;font-size:14px;color:var(--muted)}.hero.centered .trust,.final .trust{justify-content:center}.trust li{display:flex;align-items:center;gap:8px}.trust svg{width:18px;height:18px;color:var(--accent-text)}.tone-deep .trust{color:var(--deep-muted)}.tone-deep .trust svg{color:var(--deep-accent)}
.hero-media{margin:0;border-radius:calc(var(--r) * 1.6);overflow:hidden;box-shadow:0 40px 80px -40px rgba(0,0,0,.35)}.hero-media img{width:100%;aspect-ratio:4/3.3;object-fit:cover}.hero-media .art{width:100%;height:auto}
.proofbar{padding:0 0 clamp(56px,7vw,88px)}.proofbar ul{list-style:none;margin:0;padding:28px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.proofbar li{padding:4px 24px;border-left:1px solid var(--line)}.proofbar li:first-child{border-left:0;padding-left:0}.proofbar b{display:block;font:${serif ? 400 : 700} clamp(1.8rem,3vw,2.5rem)/1.1 var(--fd)}.proofbar span{color:var(--muted);font-size:15px}
.two{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(36px,6vw,96px);align-items:start}.media-left{grid-template-columns:.9fr 1.1fr;align-items:center}.sticky{position:sticky;top:100px}
.pains{list-style:none;margin:0;padding:0;display:grid;gap:12px}.pains li{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;font-size:17px}.pains svg{flex:none;width:22px;height:22px;padding:3px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent-text);margin-top:2px}.close{margin-top:24px;font:${serif ? 'italic 400 1.5rem' : '600 1.2rem'}/1.4 var(--fd);color:var(--ink)}
.story{background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.story-media{margin:0;border-radius:calc(var(--r) * 1.4);overflow:hidden}.about-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(28px,5vw,72px);align-items:center}.about-media{margin:0;border-radius:calc(var(--r) * 1.4);overflow:hidden}.about-media img{width:100%;aspect-ratio:4/5;object-fit:cover;object-position:50% 25%}@media (max-width:820px){.about-grid{grid-template-columns:minmax(0,1fr)}.about-media{max-width:420px}}.story-media img{width:100%;aspect-ratio:1/1.05;object-fit:cover}.prose p{margin-top:18px;font-size:18px;max-width:62ch}.prose p:first-child{margin-top:0}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;counter-reset:s}.steps.n2{grid-template-columns:repeat(2,1fr)}.steps.n4{grid-template-columns:repeat(4,1fr)}.steps.n5{grid-template-columns:repeat(5,1fr)}.steps li{position:relative;padding:28px;border:1px solid var(--line);border-radius:calc(var(--r) * 1.2);background:var(--surface)}.num{display:inline-block;font:600 13px/1 var(--fb);letter-spacing:.12em;color:var(--accent-text);margin-bottom:40px}.steps h3{margin-bottom:10px}.steps p{color:var(--muted);font-size:16px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:980px;margin:0 auto}.cmp>div{border-radius:calc(var(--r) * 1.2);padding:32px;border:1px solid var(--line)}.cmp h3{margin-bottom:20px}.cmp ul{list-style:none;padding:0;margin:0;display:grid;gap:14px}.cmp li{display:flex;gap:12px;align-items:flex-start}.cmp svg{flex:none;width:20px;height:20px;margin-top:3px}.cmp-old{background:transparent;color:var(--muted)}.cmp-old svg{color:var(--muted)}.cmp-new{background:var(--surface);border-color:color-mix(in srgb,var(--accent) 55%,var(--line))!important;box-shadow:0 24px 48px -32px ${P.accent}}.cmp-new svg{color:var(--accent-text)}
.grid{display:grid;gap:20px}.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g1{grid-template-columns:1fr;max-width:640px;margin:0 auto}.card{background:var(--surface);border:1px solid var(--line);border-radius:calc(var(--r) * 1.2);padding:28px}.card h3{margin-bottom:10px}.card p{color:var(--muted);font-size:16px}.tick{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--accent-ink);margin-bottom:22px}.tick svg{width:18px;height:18px}
.stack-box{display:grid;grid-template-columns:.85fr 1.15fr;gap:0;background:var(--bg);color:var(--ink);border-radius:calc(var(--r) * 1.6);overflow:hidden;box-shadow:0 50px 100px -50px rgba(0,0,0,.6)}.stack-box p{color:var(--muted)}.stack-media{background:color-mix(in srgb,var(--accent) 10%,var(--bg));display:grid;place-items:start center;padding:28px}.stack-media>*{position:sticky;top:28px}.stack-media img{border-radius:var(--r);width:100%;aspect-ratio:4/5;object-fit:cover}.stack-media .art{width:100%;height:auto}.stack-list{padding:clamp(24px,4vw,44px)}.stack-list>ul{list-style:none;margin:0;padding:0}.stack-list>ul>li{display:grid;grid-template-columns:28px 1fr auto;gap:14px;padding:16px 0;border-bottom:1px solid var(--line);align-items:start}.stack-list>ul>li p{font-size:15px;margin-top:3px}.ck{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent-text)}.ck svg{width:15px;height:15px}.val{font-size:14px;color:var(--muted);white-space:nowrap;padding-top:2px}.bonus b{color:var(--accent-text)}
.price-box{padding-top:26px}.total{font-size:16px;color:var(--muted)}.total s{margin-left:6px}.today{display:flex;align-items:baseline;gap:12px;margin:6px 0 20px;flex-wrap:wrap}.today span{font-size:16px;color:var(--muted)}.today b{font:${serif ? 400 : 700} clamp(2.6rem,5vw,3.6rem)/1 var(--fd);color:var(--ink)}.today em{font-style:normal;color:var(--muted);font-size:15px}.plans{list-style:none;margin:-8px 0 18px;padding:0;color:var(--muted);font-size:14px}.price-box .trust{color:var(--muted);justify-content:center}.price-box .trust svg{color:var(--accent-text)}.fine{font-size:13px;margin-top:14px;text-align:center}
.bonus-card .tag{font:600 12px/1 var(--fb);letter-spacing:.1em;text-transform:uppercase;color:var(--accent-text)!important;margin-bottom:18px}
.quote svg{width:28px;height:28px;color:var(--accent-text);margin-bottom:16px}.quote blockquote{margin:0;font:${serif ? '400 1.3rem' : '500 1.05rem'}/1.5 ${serif ? 'var(--fd)' : 'var(--fb)'};color:var(--ink)}.quote .result{font:600 14px/1.3 var(--fb);color:var(--accent-text)!important;margin-bottom:10px}.quote figcaption{display:flex;gap:12px;align-items:center;margin-top:22px}.av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--deep);color:var(--deep-ink);font:600 14px/1 var(--fb)}.quote figcaption b{display:block;font-size:15px}.quote figcaption em{font-style:normal;color:var(--muted);font-size:14px}
.g-box{display:grid;grid-template-columns:200px 1fr;gap:clamp(28px,5vw,64px);align-items:center;max-width:980px;margin:0 auto;padding:clamp(28px,5vw,56px);border:1px solid var(--line);border-radius:calc(var(--r) * 1.6);background:var(--surface)}.g-box .head{margin:0}.seal{width:200px;height:200px;animation:spin 40s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.about .prose p{font-size:19px}.creds{list-style:none;padding:0;margin:28px 0 0;display:flex;flex-wrap:wrap;gap:10px}.creds li{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 14px;font-size:14px;font-weight:500}
.urgency{padding-top:0}.u-box{display:flex;gap:28px;align-items:center;justify-content:space-between;padding:clamp(28px,4vw,44px);border-radius:calc(var(--r) * 1.4);background:color-mix(in srgb,var(--accent) 12%,var(--bg));border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line))}.u-box h2{font-size:clamp(1.6rem,2.6vw,2.2rem)}.u-box p{color:var(--muted);margin-top:10px;max-width:60ch}
.qa details{border-bottom:1px solid var(--line)}.qa details:first-child{border-top:1px solid var(--line)}.qa summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;padding:22px 0;font:600 18px/1.4 var(--fb)}.qa summary::-webkit-details-marker{display:none}.qa summary svg{flex:none;width:22px;height:22px;transition:transform .2s ease;color:var(--accent-text)}.qa details[open] summary svg{transform:rotate(45deg)}.qa details p{color:var(--muted);padding:0 0 24px;max-width:64ch}
.final h2{font-size:clamp(2.3rem,4.6vw,4rem)}.final .lede{margin:22px auto 0}.ps{margin-top:44px;font-size:16px;max-width:60ch;margin-left:auto;margin-right:auto}.ps b{color:var(--deep-ink)}
footer{padding:36px 0;border-top:1px solid var(--line);color:var(--muted);font-size:14px}footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}footer a{text-decoration:none}footer nav{display:flex;gap:20px}
.bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:30;display:none;align-items:center;justify-content:space-between;gap:12px;padding:10px 10px 10px 18px;border-radius:999px;background:var(--deep);color:var(--deep-ink);box-shadow:0 20px 40px -16px rgba(0,0,0,.5);transform:translateY(140%);transition:transform .3s ease}.bar.on{transform:none}.bar b{font:600 15px/1.2 var(--fb);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar .btn{flex:none}.bar .btn{padding:12px 18px;font-size:15px}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .55s ease-out,transform .55s ease-out}.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.seal{animation:none}html{scroll-behavior:auto}}
@media (max-width:960px){.hero.split .wrap,.two,.media-left,.stack-box,.g-box{grid-template-columns:1fr}.sticky{position:static}.steps,.steps.n4,.steps.n5,.g3{grid-template-columns:1fr 1fr}.hero-media{order:2}.g-box{justify-items:start}.seal{width:150px;height:150px}}
@media (max-width:640px){body{font-size:16px}.steps,.steps.n2,.steps.n4,.steps.n5,.g2,.g3,.cmp{grid-template-columns:1fr}.proofbar ul{grid-template-columns:1fr 1fr;gap:18px 0}.proofbar li{border-left:0;padding:0 12px 0 0}.u-box{flex-direction:column;align-items:flex-start}.bar{display:flex}.nav .btn{display:none}.hero-cta{gap:14px}.stack-list>ul>li{grid-template-columns:28px 1fr}.val{grid-column:2}}
${String((d || {}).custom_css || '').replace(/<\/?style[^>]*>/gi, '').replace(/@import[^;]+;/gi, '').slice(0, 6000)}`;
  }

  /* ---------- the page ---------- */
  function render(spec, opt) {
    opt = opt || {};
    const s = JSON.parse(JSON.stringify(spec || {}));
    s.brand = s.brand || {}; s.design = s.design || {}; s.copy = s.copy || {}; s.offer = s.offer || {}; s.assets = s.assets || {};
    const P = palette(s.brand.palette);
    // Custom font files from the brand board load with @font-face from the page's own assets.
    const CF = arr((s.brand.fonts || {}).custom).filter((f) => f && f.family && /^[a-z0-9-]{1,48}\.(woff2|woff|ttf|otf)$/.test(f.file || '')).slice(0, 4);
    const own = (n) => CF.find((f) => f.family === n);
    const F = { display: own((s.brand.fonts || {}).display) ? s.brand.fonts.display : pickFont((s.brand.fonts || {}).display, DISPLAY, 'Instrument Serif'), body: own((s.brand.fonts || {}).body) ? s.brand.fonts.body : pickFont((s.brand.fonts || {}).body, BODY, 'Hanken Grotesk') };
    s.__base = opt.base != null ? opt.base : 'assets/';
    s.__checkout = clean((s.links || {}).checkout) || '#offer';
    if (!/^(https?:\/\/|#|\/)/.test(s.__checkout)) s.__checkout = '#offer';
    const order = (arr(s.design.order).filter((x) => SECTIONS.includes(x)));
    const seq = order.length ? (order.includes('hero') ? order : ['hero', ...order]) : SECTIONS;
    const meta = s.copy.meta || {};
    const name = clean(s.brand.logo_text || s.brand.name || s.offer.name || 'Sales page');
    const title = clean(meta.title || ((s.offer.name || name) + (s.offer.one_liner ? ' | ' + s.offer.one_liner : '')));
    const desc = clean(meta.description || (s.copy.hero || {}).sub || s.offer.promise || '');
    const og = s.assets.hero ? (opt.absolute || '') + s.__base + s.assets.hero : '';
    const body = seq.map((k) => { try { const h = R[k] ? R[k](s, P) : ''; return /^<section [^>]*\bid=/.test(h) ? h : h.replace(/^<section /, `<section id="${anchorOf(k)}" `); } catch (e) { return ''; } }).join('\n');
    const pr = s.offer.price || {};
    const year = new Date().getFullYear();
    const fl = s.copy.footer || {};
    return `<!doctype html>
<html lang="${esc(opt.lang || s.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc.slice(0, 300))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc.slice(0, 300))}">
<meta property="og:type" content="website">${og ? `\n<meta property="og:image" content="${esc(og)}">` : ''}
<meta name="theme-color" content="${P.bg}">
<meta name="generator" content="Founders AI OS Funnel Agent">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${P.deep}"/><circle cx="16" cy="16" r="6" fill="${P.accent}"/></svg>`)}">
${own(F.display) && own(F.body) ? '' : `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${own(F.display) ? fontsLink(F.body, F.body) : own(F.body) ? fontsLink(F.display, F.display) : fontsLink(F.display, F.body)}">`}
<style>${CF.filter((f) => f.family === F.display || f.family === F.body).map((f) => `@font-face{font-family:"${esc(f.family).replace(/"/g, '')}";src:url("${esc(s.__base + f.file)}") format("${({ woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' })[f.format || f.file.split('.').pop()] || 'woff2'}");font-display:swap}`).join('')}${css(P, F, s.design)}</style>
</head>
<body>
<header class="nav" id="nav"><div class="wrap"><a class="logo" href="#top"><i></i>${esc(name)}</a>${cta(s.offer.cta || 'Get access', s.__checkout)}</div></header>
<main>
${body}
</main>
<footer><div class="wrap"><span>\u00a9 ${year} ${esc(clean(fl.owner || s.brand.name || name))}${fl.line ? '. ' + t(fl.line) : ''}</span><nav>${(s.links || {}).support ? `<a href="mailto:${esc(s.links.support)}">${esc(s.links.support)}</a>` : ''}<a href="${esc((s.links || {}).terms || '#')}">Terms</a><a href="${esc((s.links || {}).privacy || '#')}">Privacy</a></nav></div></footer>
<div class="bar" id="bar" aria-hidden="true"><b>${esc(clean(s.offer.name || name))}${pr.amount ? ' \u00b7 ' + money(pr.amount, pr.currency) : ''}</b>${cta(String(s.offer.cta || '').length > 16 ? 'Get access' : (s.offer.cta || 'Get access'), s.__checkout)}</div>
<script>(function(){var n=document.getElementById('nav'),b=document.getElementById('bar'),h=document.getElementById('top');addEventListener('scroll',function(){var y=scrollY;n.classList.toggle('scrolled',y>8);if(b&&h){var on=y>h.offsetHeight*.8&&(innerHeight+y)<document.body.scrollHeight-260;b.classList.toggle('on',on);b.setAttribute('aria-hidden',on?'false':'true')}},{passive:true});var els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(e,i){e.style.transitionDelay=Math.min(i%4,3)*60+'ms';io.observe(e)})})();</script>
</body>
</html>
`;
  }

  /* ---------- checks before anything ships ---------- */
  function qa(html, spec) {
    const issues = []; const s = spec || {}; const text = String(html || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    if (/\u2014/.test(text)) issues.push('Em dash in the copy');
    if (/!/.test(text.replace(/<!--[\s\S]*?-->/g, ''))) issues.push('Exclamation point in the copy');
    if (/lorem ipsum|\bTBD\b|\[insert|\{\{|\bXX\b/i.test(text)) issues.push('Placeholder text left in the copy');
    if (!((s.copy || {}).hero || {}).headline) issues.push('No hero headline');
    if (!((s.offer || {}).price || {}).amount) issues.push('No price on the page');
    if (!arr((s.offer || {}).stack).length) issues.push('No offer stack');
    const ck = (s.links || {}).checkout; if (!ck || !/^https?:\/\//.test(ck)) issues.push('Buttons point to the offer section until a HighLevel order form link is added');
    if (/(as seen on|featured in)/i.test(text) && !arr(((s.copy || {}).proofbar || {}).items).length) issues.push('Media mention without proof');
    const words = text.split(/\s+/).filter(Boolean).length;
    const ctas = (String(html).match(/data-cta/g) || []).length;
    return { ok: !issues.filter((x) => !/^Buttons point/.test(x)).length, issues, words, ctas, sections: SECTIONS.filter((k) => new RegExp('<section[^>]*class="' + k + '[ "]|data-section="' + k + '"').test(html)).length };
  }

  /* ---------- the 17P outline ---------- */
  // The founder's 17P sales page outline, mapped onto the page sections. Not every P belongs on every page:
  // a P is on the page when the spec has real content for it, otherwise it was left out for this offer.
  const P17 = [
    ['Promise', 'The outcome they desire', 'hero', 'Not used on this page'],
    ['Problem', 'What causes a desire for change', 'problem', 'Not used on this page'],
    ['Pain Points', 'Relatable symptoms', 'problem', 'Not used on this page'],
    ['Proof of Results', 'Why you are a credible source', 'proofbar', 'No true numbers to show yet'],
    ['Personal Epiphany', 'How you discovered this idea', 'story', 'Not used on this page'],
    ['Process to Solution', 'The vehicle that gets the result', 'mechanism', 'Not used on this page'],
    ['Positioning of Offer', 'Better than the other options', 'compare', 'Not used on this page'],
    ['Price Anchor', 'The no-brainer deal', 'stack', 'No anchor value above the price'],
    ['Pricing Tables', 'Several plans, if there are any', 'stack', 'One price, no plans'],
    ['Product BTS Breakdown', 'What is inside', 'outcomes', 'Not used on this page'],
    ['Product Bonuses', 'What else they get', 'bonuses', 'No bonuses in this offer'],
    ['Proof of Recommendations', 'Reviews, testimonials, external trust', 'proof', 'Add real testimonials to fill this'],
    ['Perfect Persona', 'Who it is for and not for', 'who', 'Not used on this page'],
    ['Project Spotlight', 'Case studies', 'proof', 'Shows when a testimonial has a result'],
    ['Pushback Reflex', 'Risk reversal', 'guarantee', 'No guarantee in this offer'],
    ['Priority', 'Why act now', 'urgency', 'No real deadline, so no urgency'],
    ['Promotional Bar', 'Announcement at the top, final call at the bottom', 'final', 'Not used on this page'],
  ];
  const anchorOf = (k) => (k === 'hero' ? 'top' : k === 'stack' ? 'offer' : 's-' + k);
  function outline(spec) {
    const s = spec || {}; const c = s.copy || {}; const o = s.offer || {}; const pr = o.price || {};
    const g = (k) => c[k] || {}; const first = (...xs) => clean(xs.map((x) => (Array.isArray(x) ? x[0] : x)).find((x) => has(x) && typeof x === 'string') || '');
    const quotes = arr(g('proof').items).filter((x) => x && x.quote && x.name); const spot = quotes.filter((x) => has(x.result));
    const total = stackTotal(o); const order = arr((s.design || {}).order);
    const found = [
      first(g('hero').headline, o.promise),
      first(g('problem').title, g('problem').intro),
      arr(g('problem').bullets).length ? first(g('problem').bullets) : '',
      arr(g('proofbar').items).length ? arr(g('proofbar').items).map((x) => clean([x.n || x.value, x.label].filter(Boolean).join(' '))).slice(0, 3).join(' · ') : '',
      first(g('story').title, g('story').paragraphs),
      first(g('mechanism').title, (o.mechanism || {}).name),
      arr(g('compare').new).length || arr(g('compare').old).length ? first(g('compare').title, g('compare').new) : '',
      pr.amount && (+pr.compare_at > +pr.amount || total > +pr.amount) ? money(pr.compare_at || total, pr.currency) + ' in value, ' + money(pr.amount, pr.currency) + ' today' : '',
      arr(pr.plans).length ? arr(pr.plans).length + ' plan' + (arr(pr.plans).length === 1 ? '' : 's') + ' besides the full price' : '',
      arr(g('outcomes').items).length ? first(g('outcomes').title, (arr(g('outcomes').items)[0] || {}).title) : arr(o.stack).length ? arr(o.stack).length + ' items in the stack' : '',
      arr(o.bonuses).length ? arr(o.bonuses).map((x) => clean(x.name)).slice(0, 2).join(', ') : '',
      quotes.length ? quotes.length + ' testimonial' + (quotes.length === 1 ? '' : 's') + ', first from ' + clean(quotes[0].name) : '',
      arr(g('who').for).length ? first(g('who').for) : '',
      spot.length ? clean(spot[0].name) + ': ' + clean(spot[0].result) : '',
      (o.guarantee || {}).name || g('guarantee').title ? first((o.guarantee || {}).name, g('guarantee').title) + ((o.guarantee || {}).days ? ', ' + o.guarantee.days + ' days' : '') : '',
      first(g('urgency').title, g('urgency').body),
      g('hero').eyebrow || g('final').title ? [g('hero').eyebrow, g('final').title].filter(has).map((x) => clean(String(x).replace(/\*/g, ''))).join(' / ') : '',
    ];
    return P17.map(([name, what, sec, why], i) => {
      const off = order.length && !order.includes(sec) && sec !== 'hero';
      const raw = String(found[i] || '').replace(/\*/g, ''); const text = off ? '' : raw;
      return { n: i + 1, name, what, sec, section: SECTION_NAMES[sec] || sec, anchor: anchorOf(sec), on: !!text, excerpt: text.length > 110 ? text.slice(0, 108).replace(/\s+\S*$/, '') + '...' : text, why: raw && off ? 'Written, but the section is turned off in the design' : why };
    });
  }

  // Deep merge for revisions: objects merge, arrays and values replace.
  function merge(a, b) {
    if (b === undefined) return a; if (b === null) return null;
    if (Array.isArray(b) || typeof b !== 'object' || typeof a !== 'object' || a == null || Array.isArray(a)) return b;
    const o = { ...a }; Object.keys(b).forEach((k) => { o[k] = merge(a[k], b[k]); }); return o;
  }

  const API = { render, qa, merge, outline, P17, palette, contrast, clean, money, DISPLAY, BODY, SECTIONS, SECTION_NAMES, stackTotal };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.OSFunnel = API;
})(typeof window !== 'undefined' ? window : globalThis);

// Founder OS UI helpers: formatting, icons, toast, drawer, dialog and small render pieces.
(() => {
  const C = window.Charts, St = window.Store;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = C.fmt.money('EUR'), int = C.fmt.int, compact = C.fmt.compact;
  const eur2 = (v) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
  const MINUS = '\u2212';
  const change = (now, was) => { if (!was) return '<span class="meta">new</span>'; const r = now / was - 1; return `<span class="${r >= 0 ? 'up' : 'down'}">${r >= 0 ? '+' : MINUS}${Math.abs(r * 100).toFixed(1)}%</span>`; };
  const shade = { software: 'var(--accent)', services: 'var(--chart-2)', products: 'var(--chart-3)', affiliate: 'var(--chart-muted)' };
  const sname = (id) => (St.streamById[id] || { name: id }).name;

  const P = {
    dna: '<path d="M7 3c0 4.5 10 6.5 10 11s-10 2.5-10 7M17 3c0 4.5-10 6.5-10 11s10 2.5 10 7"/><path d="M8.5 6.5h7M8 17.5h8M10 10.5h4"/>',
    emails: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    posts: '<path d="M5 4h14v16H5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
    graphics: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
    proven: '<path d="M3 17l5.5-5.5 4 4L21 7"/><path d="M15 7h6v6"/>',
    revenue: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    affiliate: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    programs: '<path d="M4 4.5h6.5a2 2 0 0 1 2 2V21a3 3 0 0 0-3-2H4zM20 4.5h-5.5a2 2 0 0 0-2 2V21a3 3 0 0 1 3-2H20z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    calls: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'eye-off': '<path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.5 7.2A15.7 15.7 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4"/><path d="m3.5 3.5 17 17"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    playbook: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/><path d="m9.5 10 1.8 1.8L15 8"/>',
    access: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    approvals: '<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/>',
    jarvis: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
    brand: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    'content-funnel': '<path d="M3.5 5h17l-6.5 7.6V19l-4-2v-4.4z"/>',
    content: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    offers: '<path d="M20 12 12 20 4 12V4h8z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
    funnels: '<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
    'funnel-agent': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h6M7 16h4"/><path d="m17 12.5.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
    room: '<path d="M4 5.5h10a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H8.5L5 17v-2.5H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M18 9h1.5A1.5 1.5 0 0 1 21 10.5v6a1.5 1.5 0 0 1-1.5 1.5H19v2.5L15.5 18h-4a1.5 1.5 0 0 1-1.5-1.5"/>',
    agents: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12v1M15 12v1"/>',
    brain: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h5"/>',
    data: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    score: '<circle cx="12" cy="12" r="8"/><path d="M12 12 16 8"/><path d="M12 4v2M4 12h2M18 12h2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8"/>',
    memory: '<path d="M12 3.5c.6 4.6 3.1 7.1 7.7 7.7-4.6.6-7.1 3.1-7.7 7.7-.6-4.6-3.1-7.1-7.7-7.7 4.6-.6 7.1-3.1 7.7-7.7z"/><path d="M19 17.5v3M17.5 19h3"/>',
    routines: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
    research: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>',
    creators: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/>',
    coach: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-3.5 3.3-5.4 6.5-5.4s5.8 1.9 6.5 5.4"/><path d="m18.5 3.5.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z"/>',
    star: '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>',
    stack: '<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    image: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9.5" cy="9.5" r="1.5"/><path d="m20 15-4.5-4.5L6 20"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5M20 4v4.5h-4.5"/>',
    mcp: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
    connect: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    arrowleft: '<path d="M19 12H5m7-7-7 7 7 7"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>',
    down: '<path d="M17 13V4h3v9zM17 13l-4 8c-1.5 0-2.5-1-2.5-2.5V15H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 4H17"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    out: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 15.6v.1"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    swipe: '<rect x="3.5" y="6" width="12" height="14" rx="2"/><path d="M8 3.5h10.5a2 2 0 0 1 2 2V17"/><path d="M7 11h5M7 14.5h5"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 6 3-6 3zM7 5v14M17 5v14"/>',
    arrowup:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
    arrowdown:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    crm: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    team: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="16" r="2.5"/><circle cx="19" cy="16" r="2.5"/><path d="M12 10v3M12 13l-5 1.5M12 13l5 1.5"/>',
    grok: '<path d="M5 19 19 5"/><path d="M9.5 5.5A7 7 0 0 1 18.5 14.5"/><path d="M5.5 9.5A7 7 0 0 0 14.5 18.5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    paperclip: '<path d="m20.5 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16v4M16.5 18h4"/>',
    play: '<path d="M7 5v14l12-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    chat: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
    sort: '<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  function toast(msg, opts) {
    if (msg && typeof msg === 'object') { opts = { ...(opts || {}), status: msg.status }; msg = (window.Auth && window.Auth.friendly ? window.Auth.friendly(msg) : msg.message) || 'Something went wrong.'; }
    const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t);
    if (opts && typeof opts.undo === 'function') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-undo'; b.textContent = 'Undo';
      b.onclick = async () => { b.disabled = true; t.classList.remove('show'); try { await opts.undo(); } catch (e) { console.error(e); } };
      t.appendChild(b);
    }
    // Errors carry their next step: what to do, and a link to where it is done.
    const F = window.Fix; let fix = false;
    if (F && !(opts && opts.undo) && !(opts && opts.nofix) && F.isError(msg)) { const h = F.html(msg, opts && opts.status); if (h) { t.insertAdjacentHTML('beforeend', h); fix = true; } }
    t.classList.toggle('has-fix', fix); t.setAttribute('role', fix ? 'alert' : 'status');
    toast.t = setTimeout(() => t.classList.remove('show'), opts && opts.undo ? 6000 : fix ? 9000 : 2600);
  }

  // one drawer at a time, with a back stack so a contact opened from a call can return to it
  const stack = [];
  let lastFocus = null;
  function drawer(html, { label = 'Details', push = false, wide = false } = {}) {
    const d = $('#drawer');
    if (!d.classList.contains('open')) { lastFocus = document.activeElement; stack.length = 0; }
    else if (push) stack.push({ html: d.innerHTML, label: d.getAttribute('aria-label') });
    d.setAttribute('aria-label', label); d.classList.toggle('wide', wide);
    d.innerHTML = `<div class="dhead">${stack.length ? `<button class="btn sm ghost" data-action="drawer-back">Back</button>` : ''}<button class="btn icon ghost" data-action="drawer-close" aria-label="Close">${icon('close')}</button></div>${html}`;
    d.scrollTop = 0;
    d.classList.add('open'); $('#scrim').classList.add('open');
    requestAnimationFrame(() => {
      if (!d.classList.contains('open') || d.contains(document.activeElement)) return;
      const f = d.querySelector('[data-autofocus]') || d.querySelector('.dhead .btn:last-child');
      f && f.focus();
    });
    runAfter();
  }
  function drawerBack() { const p = stack.pop(); if (!p) return closeDrawer(); const d = $('#drawer'); d.innerHTML = p.html; d.setAttribute('aria-label', p.label); bindAfterRestore(); }
  function bindAfterRestore() { /* drawers are static HTML plus delegated actions, so nothing to rebind */ }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); stack.length = 0; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  // modal dialog that resolves with form values, or null
  function dialog({ title, body = '', fields = [], ok = 'Save', danger = false }) {
    return new Promise((resolve) => {
      const dl = $('#formd');
      dl.innerHTML = `<form method="dialog" class="fd"><h2>${esc(title)}</h2>${body ? `<p class="muted">${body}</p>` : ''}
        ${fields.map((f) => `<label class="field"><span>${esc(f.label)}</span>${f.type === 'textarea' ? `<textarea name="${f.name}" rows="${f.rows || 4}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>` : f.type === 'select' ? `<select name="${f.name}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] === f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : f.type === 'chips' ? `<span class="chips">${f.options.map((o) => `<button type="button" class="chip" data-chip="${f.name}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</span><input type="hidden" name="${f.name}">` : `<input name="${f.name}" value="${esc(f.value || '')}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}">`}</label>`).join('')}
        <div class="actions end"><button type="button" class="btn" value="cancel">Cancel</button><button type="submit" class="btn primary ${danger ? 'danger' : ''}" value="ok">${esc(ok)}</button></div></form>`;
      const form = dl.querySelector('form');
      form.querySelector('button[value="cancel"]').addEventListener('click', () => dl.close('cancel'));
      dl.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('click', () => {
        const inp = form.elements[b.dataset.chip]; const on = b.getAttribute('aria-pressed') !== 'true';
        dl.querySelectorAll(`[data-chip="${b.dataset.chip}"]`).forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', String(on)); inp.value = on ? b.dataset.v : '';
        const ta = form.querySelector('textarea'); if (ta && on && !ta.value) ta.value = b.dataset.v;
      }));
      const done = () => { dl.removeEventListener('close', done); if (dl.returnValue !== 'ok') return resolve(null); resolve(Object.fromEntries(new FormData(form))); };
      dl.addEventListener('close', done);
      dl.returnValue = ''; dl.showModal();
      const first = form.querySelector('input:not([type=hidden]), textarea, select'); first && first.focus();
    });
  }

  // render hooks that need the DOM (charts)
  const afters = [];
  const after = (fn) => { afters.push(fn); return ''; };
  function runAfter() { while (afters.length) { try { afters.shift()(); } catch (e) { console.error(e); } } }

  const title = (h, sub, actions = '') => `<div class="title-row"><div><h1>${h}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  const kpis = (items) => `<div class="kpis">${items.map((k, i) => `<div class="kpi ${i === 0 ? 'lead' : ''}"><div class="kpi-label">${k.dot ? `<span class="sw" style="background:${k.dot}"></span>` : ''}${k.label}</div><div class="kpi-value">${k.value}</div>${k.delta != null ? `<div class="delta">${k.delta}</div>` : ''}</div>`).join('')}</div>`;
  const who = (id, extra = '') => { const c = St.contactById[id]; if (!c) return ''; return `<button class="lnk" data-action="contact" data-id="${id}">${esc(c.name)}</button>${extra}`; };
  const vid = (id) => { const v = St.videoById[id]; return v ? `<button class="lnk" data-action="video" data-id="${id}">${esc(v.title)}</button>` : ''; };
  const initials = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const empty = (h, p, action = '') => `<div class="empty"><b>${h}</b><p class="muted">${p}</p>${action}</div>`;
  const statusPill = (s) => ({ green: '<span class="pill pos">Healthy</span>', orange: '<span class="pill warn">Partial</span>', red: '<span class="pill neg">Disconnected</span>' }[s] || `<span class="pill">${esc(s)}</span>`);
  const seg = (name, value, opts) => `<div class="segmented" role="group">${opts.map(([v, l]) => `<button data-action="seg" data-seg="${name}" data-v="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`).join('')}</div>`;
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy is blocked in this browser'); } ta.remove(); } }
  const spin = '<span class="spin" aria-hidden="true"></span>';

  window.UI = { $, $$, esc, eur, eur2, int, compact, pct, change, shade, sname, icon, toast, drawer, drawerBack, closeDrawer, dialog, after, runAfter, title, kpis, who, vid, initials, empty, statusPill, seg, copy, spin, MINUS };
})();
// view registry, view state and action registry shared by the views and the shell
window.V = {};
window.VS = { rev: 6, revStream: 'all', approval: null, apKind: 'all', apStream: 'all', editing: false, brandSort: 'day', brandDir: -1, cStream: 'all', cSource: 'all', cStage: 'all', cPillar: 'all', cFormat: 'all', brainTab: 'docs', callsTab: 'upcoming', running: {} };
window.ACT = {};

// Dropdown chevrons sit as far from the right edge as the text sits from the left.
(() => {
  const fit = (el) => { if (el.dataset.selx || el.multiple || el.size > 1) return; const pl = parseFloat(getComputedStyle(el).paddingLeft) || 0; el.style.setProperty('--sel-x', Math.min(18, Math.max(6, pl)) + 'px'); el.dataset.selx = '1'; };
  const scan = (root) => { if (root.tagName === 'SELECT') fit(root); else if (root.querySelectorAll) root.querySelectorAll('select:not([data-selx])').forEach(fit); };
  const start = () => { scan(document.body); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n)))).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

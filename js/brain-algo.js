// Algorithm core: the Founder Algorithm drawn live, in the same visual language as the Jarvis core.
// Three tilted rings are the three strands of one founder: you, your brand, your offers and money.
// Every dot on a ring is an approved fact (orange glow = core). Hollow dots outside are suggestions waiting for approval.
// Squares on the outer orbit are Brain documents. Pulses run from facts into the core: the AI reading them before it writes.
// It syncs on every render: new approvals fly from the waiting orbit onto their ring, removals fade out, the core flashes.
(() => {
  const TAU = Math.PI * 2;
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STRANDS = [
    { key: 'you', name: 'You', cats: ['identity', 'beliefs', 'goals', 'never'], rad: 0.74, phi: 0, rgb: '246,240,230', spin: 0.11 },
    { key: 'brand', name: 'Your brand', cats: ['voice', 'audience', 'proof'], rad: 0.88, phi: TAU / 3, rgb: '214,200,182', spin: -0.08, dash: true },
    { key: 'offers', name: 'Offers and money', cats: ['offers', 'revenue', 'stack'], rad: 1.02, phi: (2 * TAU) / 3, rgb: '239,138,76', spin: 0.065 },
  ];
  const STRAND_OF = {}; STRANDS.forEach((s, i) => s.cats.forEach((c) => (STRAND_OF[c] = i)));
  const ORDER = ['identity', 'beliefs', 'goals', 'never', 'voice', 'audience', 'proof', 'offers', 'revenue', 'stack'];
  const TILT = 1.08;
  STRANDS.forEach((s) => {
    const u = [Math.cos(s.phi), 0, Math.sin(s.phi)], w = [-Math.sin(s.phi), 0, Math.cos(s.phi)];
    s.u = u; s.v = [w[0] * Math.cos(TILT), Math.sin(TILT), w[2] * Math.cos(TILT)];
  });
  const ringPt = (s, a, r) => [(Math.cos(a) * s.u[0] + Math.sin(a) * s.v[0]) * r, (Math.cos(a) * s.u[1] + Math.sin(a) * s.v[1]) * r, (Math.cos(a) * s.u[2] + Math.sin(a) * s.v[2]) * r];

  // small dotted globe at the centre
  const globe = []; { const n = 220, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = g * i; globe.push([Math.cos(t) * r * 0.3, y * 0.3, Math.sin(t) * r * 0.3]); } }
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  /* ---------- state, kept across re-renders ---------- */
  const S = { el: null, ctx: null, stage: null, tip: null, w: 0, h: 0, dpr: 1, raf: 0, last: 0, t: 0, yaw: 0.35, pitch: -0.36, tx: 0, ty: 0, px: 0, py: 0,
    spin: [0, 0, 0], energy: 0.3, busy: false, nodes: new Map(), waits: new Map(), docs: 0, pulses: [], flash: 0, synced: false, hover: null, visible: true, ro: null, io: null, proj: [] };

  function sync() {
    const F = window.Facts; if (!F) return;
    const ap = F.approved(), ps = F.proposed(); const now = S.t;
    const seenA = new Set(), seenP = new Set();
    const by = STRANDS.map(() => []);
    ap.forEach((f) => { const i = STRAND_OF[f.category]; if (i != null) by[i].push(f); });
    by.forEach((list, si) => {
      list.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || (b.weight || 2) - (a.weight || 2) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
      list.forEach((f, i) => {
        seenA.add(f.id); const ta = (i / Math.max(1, list.length)) * TAU + si * 0.4;
        let n = S.nodes.get(f.id);
        if (!n || n.si !== si) {
          const w = S.waits.get(f.id); const from = n ? n.pos : w ? w.pos : null;
          n = { id: f.id, si, a: ta, born: S.synced && !reduce() ? now : -9, from: S.synced ? from : null, pos: null, gone: null };
          S.nodes.set(f.id, n); if (S.synced) S.flash = 1;
        }
        n.ta = ta; n.core = (f.weight || 2) >= 3; n.cat = f.category; n.text = f.statement; n.gone = null;
      });
    });
    S.nodes.forEach((n, id) => { if (!seenA.has(id) && n.gone == null) n.gone = now; });
    ps.forEach((f) => { seenP.add(f.id); const w = S.waits.get(f.id) || { id: f.id, h: hash(f.id + f.statement), born: S.synced && !reduce() ? now : -9, pos: null }; w.text = f.statement; w.cat = f.category; w.gone = null; S.waits.set(f.id, w); });
    S.waits.forEach((w, id) => { if (!seenP.has(id) && w.gone == null) w.gone = now; });
    S.busy = !!(F.busy && F.busy());
    S.synced = true;
    label();
  }

  function size() {
    if (!S.el) return; const r = S.el.getBoundingClientRect(); S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height); S.el.width = Math.round(S.w * S.dpr); S.el.height = Math.round(S.h * S.dpr);
    S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); if (reduce()) frame(0);
  }

  function bind(el) {
    S.docs = +el.dataset.docs || 0;
    if (S.el === el) { sync(); return; }
    unbind(); S.el = el; S.ctx = el.getContext('2d'); S.stage = el.closest('.orb-stage'); S.tip = S.stage.querySelector('.al-tip');
    const st = S.stage;
    st.addEventListener('pointermove', (e) => { const r = st.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; S.tx = (x / r.width - 0.5) * 2; S.ty = (y / r.height - 0.5) * 2; pick(x, y); });
    st.addEventListener('pointerleave', () => { S.tx = 0; S.ty = 0; S.hover = null; tip(); });
    st.addEventListener('click', () => { if (!S.hover || !S.hover.cat) return; const sec = document.getElementById('fx-' + S.hover.cat); if (!sec) return; sec.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }); sec.classList.remove('fx-ping'); void sec.offsetWidth; sec.classList.add('fx-ping'); });
    if (window.ResizeObserver) { S.ro = new ResizeObserver(size); S.ro.observe(el); }
    if (window.IntersectionObserver) { S.io = new IntersectionObserver((en) => { S.visible = en[0].isIntersecting; if (S.visible) start(); }); S.io.observe(el); }
    sync(); size(); start();
  }
  function unbind() { if (S.ro) S.ro.disconnect(); if (S.io) S.io.disconnect(); S.ro = S.io = null; S.el = S.ctx = S.stage = S.tip = null; S.hover = null; cancelAnimationFrame(S.raf); S.raf = 0; }
  function start() { if (!S.el || S.raf) return; if (reduce()) { frame(0); return; } S.last = performance.now(); S.raf = requestAnimationFrame(loop); }
  function loop(t) {
    S.raf = 0; if (!S.el || !S.el.isConnected) { unbind(); return; }
    if (document.hidden || !S.visible) return;
    const dt = Math.min(0.05, (t - S.last) / 1000); S.last = t; frame(dt); S.raf = requestAnimationFrame(loop);
  }

  function pick(x, y) {
    let best = null, bd = 14 * 14;
    for (const p of S.proj) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    S.hover = best; if (S.stage) S.stage.classList.toggle('al-on', !!(best && best.cat)); tip(); if (reduce()) frame(0);
  }
  function tip() {
    const t = S.tip; if (!t) return; const h = S.hover;
    if (!h) { t.hidden = true; return; }
    const F = window.Facts; const cat = h.cat ? (F ? F.name(h.cat) : h.cat) : 'Document';
    t.innerHTML = `<b>${h.kind === 'wait' ? 'Waiting for you · ' : h.core ? 'Core · ' : ''}${U().esc(cat)}</b><span>${U().esc(String(h.text || '').slice(0, 140))}${String(h.text || '').length > 140 ? '...' : ''}</span>`;
    t.hidden = false; const left = Math.min(S.w - 220, Math.max(12, h.x + 14)); const top = h.y > S.h * 0.6 ? h.y - t.offsetHeight - 12 : h.y + 14;
    t.style.left = left + 'px'; t.style.top = Math.max(10, top) + 'px';
  }
  const U = () => window.UI;

  /* ---------- drawing ---------- */
  function frame(dt) {
    const c = S.ctx; if (!c) return; S.t += dt; const t = S.t; const w = S.w, h = S.h, cx = w / 2, cy = h / 2 + h * 0.01;
    const R = Math.min(w, h) * 0.3;
    const target = S.busy ? 0.95 : S.hover ? 0.55 : 0.32;
    S.energy += (target - S.energy) * Math.min(1, dt * 2.5);
    S.yaw += dt * (0.05 + S.energy * 0.08);
    STRANDS.forEach((s, i) => { S.spin[i] += dt * s.spin * (0.6 + S.energy * 1.4); });
    S.px += (S.tx - S.px) * Math.min(1, dt * 3); S.py += (S.ty - S.py) * Math.min(1, dt * 3);
    S.flash = Math.max(0, S.flash - dt * 0.9);
    const pitch = S.pitch + S.py * 0.22, yaw = S.yaw + S.px * 0.4;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), FD = R * 3.6;
    const P = (p) => { const x1 = p[0] * cyw - p[2] * syw, z1 = p[0] * syw + p[2] * cyw; const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp; const k = FD / (FD + z2 * R); return [cx + x1 * R * k, cy + y2 * R * k, z2, k]; };
    const front = (z) => (1 - Math.max(-1.4, Math.min(1.4, z)) / 1.4) / 2;
    const hs = S.hover && S.hover.si;
    c.clearRect(0, 0, w, h);

    const halo = c.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.7);
    halo.addColorStop(0, `rgba(239,138,76,${0.1 + S.energy * 0.08 + S.flash * 0.12})`); halo.addColorStop(0.5, 'rgba(239,138,76,0.025)'); halo.addColorStop(1, 'rgba(239,138,76,0)');
    c.fillStyle = halo; c.fillRect(0, 0, w, h);

    // outer documents orbit (flat HUD ring with sources on it)
    c.save(); c.translate(cx, cy);
    const ro = R * 1.36; c.strokeStyle = 'rgba(246,240,230,0.08)'; c.lineWidth = 1; c.setLineDash([2, 6]); c.beginPath(); c.arc(0, 0, ro, 0, TAU); c.stroke(); c.setLineDash([]);
    const ticks = 96; for (let i = 0; i < ticks; i++) { const a = (i / ticks) * TAU - S.yaw * 0.15, long = i % 8 === 0, r0 = R * 1.45, r1 = r0 + (long ? 7 : 3); c.strokeStyle = long ? 'rgba(246,240,230,0.22)' : 'rgba(246,240,230,0.08)'; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); }
    if (S.busy) { const sw = t * 1.6; c.lineCap = 'round'; c.lineWidth = 2; c.strokeStyle = 'rgba(239,138,76,0.8)'; c.beginPath(); c.arc(0, 0, ro, sw, sw + 0.9); c.stroke(); }
    c.restore();
    const docPts = []; const nd = Math.min(S.docs, 24);
    for (let i = 0; i < nd; i++) { const a = (i / nd) * TAU - S.yaw * 0.15 + 0.2; docPts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]); }
    for (const [x, y] of docPts) { c.fillStyle = 'rgba(246,240,230,0.55)'; c.fillRect(x - 2.5, y - 2.5, 5, 5); c.strokeStyle = 'rgba(246,240,230,0.18)'; c.strokeRect(x - 5, y - 5, 10, 10); }

    // core globe
    const gp = globe.map(P).sort((a, b) => b[2] - a[2]);
    for (const [x, y, z, k] of gp) { const f = front(z * 3); const s = (0.7 + f * 1.3) * k; c.fillStyle = `rgba(246,240,230,${(0.06 + Math.pow(f, 1.6) * 0.6).toFixed(3)})`; c.fillRect(x - s / 2, y - s / 2, s, s); }

    c.globalCompositeOperation = 'lighter';
    // rings
    STRANDS.forEach((s, si) => {
      const dim = hs != null && hs !== si ? 0.45 : 1; const hot = hs === si ? 1.6 : 1;
      c.lineWidth = s.key === 'offers' ? 1.1 : 0.9; if (s.dash) c.setLineDash([3, 5]);
      const seg = 120; let prev = null;
      for (let i = 0; i <= seg; i++) { const p = P(ringPt(s, (i / seg) * TAU, s.rad)); if (prev) { const f = front((prev[2] + p[2]) / 2); c.strokeStyle = `rgba(${s.rgb},${(((s.dash ? 0.1 : 0.06) + f * (s.dash ? 0.34 : 0.26)) * dim * hot).toFixed(3)})`; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(p[0], p[1]); c.stroke(); } prev = p; }
      c.setLineDash([]);
    });

    // approved facts on their rings
    S.proj = [];
    const pos = new Map();
    S.nodes.forEach((n, id) => {
      const s = STRANDS[n.si];
      n.a += (n.ta - n.a) * Math.min(1, dt * 3);
      const ring = ringPt(s, n.a + S.spin[n.si], s.rad);
      let p3 = ring;
      if (n.born > -1 && n.from) { const k = ease((t - n.born) / 1.3); p3 = [n.from[0] + (ring[0] - n.from[0]) * k, n.from[1] + (ring[1] - n.from[1]) * k, n.from[2] + (ring[2] - n.from[2]) * k]; }
      else if (n.born > -1) { const k = ease((t - n.born) / 1.1); const r = 1.55 - (1.55 - 1) * k; p3 = ring.map((v) => v * r); }
      n.pos = p3;
      let alpha = n.born > -1 ? Math.min(1, (t - n.born) / 0.4) : 1;
      if (n.gone != null) { alpha = 1 - (t - n.gone) / 0.6; if (alpha <= 0) { S.nodes.delete(id); return; } }
      pos.set(id, { p: P(p3), n, s, alpha, landed: n.born > -1 ? (t - n.born) : 9 });
    });
    // spokes into the core
    pos.forEach(({ p, n, s, alpha }) => { const f = front(p[2]); const dim = hs != null && hs !== n.si ? 0.35 : 1; c.strokeStyle = `rgba(${s.rgb},${((0.025 + f * 0.06 + S.energy * 0.03) * alpha * dim).toFixed(3)})`; c.lineWidth = 0.6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(p[0], p[1]); c.stroke(); });
    // nodes back to front
    [...pos.values()].sort((a, b) => b.p[2] - a.p[2]).forEach(({ p, n, s, alpha, landed }) => {
      const [x, y, z, k] = p; const f = front(z); const isH = S.hover && S.hover.id === n.id; const dim = hs != null && hs !== n.si ? 0.5 : 1;
      const r = (n.core ? 3.1 : 2.1) * k * (0.8 + f * 0.5) * (isH ? 1.6 : 1);
      if (n.core || isH) { const g = c.createRadialGradient(x, y, 0, x, y, r * 5); g.addColorStop(0, `rgba(239,138,76,${(0.5 * alpha * dim).toFixed(3)})`); g.addColorStop(1, 'rgba(239,138,76,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 5, 0, TAU); c.fill(); }
      if (landed < 0.9) { const q = landed / 0.9; c.strokeStyle = `rgba(255,214,176,${(1 - q) * 0.9})`; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r + q * 16, 0, TAU); c.stroke(); }
      c.fillStyle = n.core ? `rgba(255,222,192,${(0.95 * alpha * dim).toFixed(3)})` : `rgba(${s.rgb},${((0.35 + f * 0.6) * alpha * dim).toFixed(3)})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (alpha > 0.5) S.proj.push({ x, y, id: n.id, si: n.si, cat: n.cat, text: n.text, core: n.core, kind: 'fact' });
    });

    // suggestions waiting outside the rings
    S.waits.forEach((wt, id) => {
      const a = wt.h * TAU + t * 0.06, el = (wt.h * 7 % 1 - 0.5) * 0.9, bob = Math.sin(t * 0.9 + wt.h * 9) * 0.03;
      const r = 1.24 + bob; const p3 = [Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r]; wt.pos = p3;
      let alpha = wt.born > -1 ? Math.min(1, (t - wt.born) / 0.6) : 1;
      if (wt.gone != null) { alpha = 1 - (t - wt.gone) / 0.5; if (alpha <= 0) { S.waits.delete(id); return; } }
      const [x, y, z, k] = P(p3); const f = front(z); const isH = S.hover && S.hover.id === id; const blink = 0.55 + Math.sin(t * 2.2 + wt.h * 6) * 0.25;
      c.setLineDash([1, 4]); c.strokeStyle = `rgba(239,138,76,${(0.16 * alpha).toFixed(3)})`; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(cx + (x - cx) * 0.72, cy + (y - cy) * 0.72); c.stroke(); c.setLineDash([]);
      c.strokeStyle = `rgba(243,160,112,${((0.4 + f * 0.5) * blink * alpha).toFixed(3)})`; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, (3.2 + (isH ? 2 : 0)) * k, 0, TAU); c.stroke();
      if (alpha > 0.5) S.proj.push({ x, y, id, si: STRAND_OF[wt.cat], cat: wt.cat, text: wt.text, kind: 'wait' });
    });

    // pulses: documents feed the core while studying, facts are read into the core all the time
    const nodesArr = [...pos.values()];
    const want = Math.round(3 + S.energy * 14 + S.flash * 10);
    while (S.pulses.length < want && (nodesArr.length || docPts.length)) {
      const fromDoc = docPts.length && (S.busy ? Math.random() < 0.6 : Math.random() < 0.15);
      if (fromDoc) S.pulses.push({ doc: (Math.random() * docPts.length) | 0, p: 0, v: 0.5 + Math.random() * 0.5 });
      else if (nodesArr.length) { const q = nodesArr[(Math.random() * nodesArr.length) | 0]; S.pulses.push({ id: q.n.id, p: 0, v: 0.45 + Math.random() * 0.7 }); } else break;
    }
    if (S.pulses.length > want + 6) S.pulses.length = want + 6;
    S.pulses = S.pulses.filter((q) => { q.p += dt * q.v * (0.5 + S.energy); return q.p < 1; });
    for (const q of S.pulses) {
      let x0, y0, rgb = '239,138,76';
      if (q.doc != null) { const d = docPts[q.doc]; if (!d) continue; [x0, y0] = d; rgb = '246,240,230'; }
      else { const o = pos.get(q.id); if (!o) continue; x0 = o.p[0]; y0 = o.p[1]; rgb = o.s.key === 'offers' ? '239,138,76' : '255,214,176'; }
      const u = ease(q.p); const x = x0 + (cx - x0) * u, y = y0 + (cy - y0) * u; const fade = Math.sin(q.p * Math.PI);
      const g = c.createRadialGradient(x, y, 0, x, y, 6); g.addColorStop(0, `rgba(${rgb},${(0.9 * fade).toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
    }

    // sync flash and core
    if (S.flash > 0) { const q = 1 - S.flash; c.strokeStyle = `rgba(255,214,176,${(S.flash * 0.6).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R * (0.3 + q * 1.1), 0, TAU); c.stroke(); }
    const breathe = reduce() ? 0 : Math.sin(t / 1.7) * 0.5 + 0.5;
    const cr = R * (0.12 + breathe * 0.02 + S.energy * 0.03 + S.flash * 0.05);
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.6);
    core.addColorStop(0, 'rgba(255,250,242,0.98)'); core.addColorStop(0.14, 'rgba(255,214,176,0.85)'); core.addColorStop(0.4, `rgba(239,138,76,${0.3 + S.flash * 0.3})`); core.addColorStop(1, 'rgba(239,138,76,0)');
    c.fillStyle = core; c.beginPath(); c.arc(cx, cy, cr * 2.6, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
    for (const [i, [x, y]] of docPts.entries()) S.proj.push({ x, y, id: 'doc' + i, text: (S.titles[i] || 'Brain document'), kind: 'doc' });
  }
  S.titles = [];

  function label() {
    const st = S.stage; if (!st) return; const F = window.Facts; const ap = F ? F.approved().length : 0, ps = F ? F.proposed().length : 0;
    st.dataset.state = S.busy ? 'thinking' : 'idle';
    const l = st.querySelector('[data-algo-state]');
    if (l) l.textContent = S.busy ? 'Studying your documents' : ps ? ps + ' waiting for you' : ap ? 'Synced · ' + ap + ' facts' : 'Waiting for your first fact';
  }

  window.BrainAlgo = {
    STRANDS,
    strand: (cat) => STRANDS[STRAND_OF[cat]],
    html(docs) {
      const list = (docs || []).map((d) => d.title || d.name || 'Brain document'); S.titles = list;
      return `<div class="orb-stage al-stage" data-state="idle">
        <canvas data-algo data-docs="${list.length}" aria-hidden="true"></canvas>
        <span class="orb-tag tl">Founder Algorithm</span>
        <span class="orb-tag tr al-key">${STRANDS.map((s) => `<span><i class="k-${s.key}"></i>${s.name.split(' ')[0] === 'Your' ? 'Brand' : s.name.split(' ')[0]}</span>`).join('')}</span>
        <span class="orb-tag bl"><i></i><span data-algo-state>Syncing</span></span>
        <span class="orb-tag br">${list.length} ${list.length === 1 ? 'source' : 'sources'}</span>
        <div class="al-tip" role="status" hidden></div>
      </div>`;
    },
    scan() { const el = document.querySelector('canvas[data-algo]'); if (el) bind(el); else if (S.el && !S.el.isConnected) unbind(); },
    sync() { if (S.el) { sync(); start(); } },
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
})();

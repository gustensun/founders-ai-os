// Jarvis core: a real-time 3D orb drawn on a 2D canvas (no libraries).
// Layers, back to front: dot floor and orbits, wires to the floating tiles, dotted globe, geodesic shell, shards,
// inner neural net with pulses, warm core. The band is always night so the light reads in both themes.
// One animation loop for the whole app. It follows whichever <canvas data-orb> is on screen, keeps its rotation
// across re-renders, pauses when hidden or off screen, and draws a single still frame under reduced motion.
(() => {
  const TAU = Math.PI * 2;
  const motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => motion && motion.matches;
  // Keep the original night palette intact. Daylight uses ink, not inverted glow,
  // so the same geometry remains legible against the white workspace.
  const PALETTE = {
    dark: { ink: '246,240,230', vertex: '255,248,238', network: '243,170,120', node: '255,236,218',
      accent: '239,138,76', spark: '255,214,176', core: '255,250,242', blend: 'lighter' },
    light: { ink: '40,47,54', vertex: '30,35,40', network: '151,108,71', node: '93,76,62',
      accent: '184,100,42', spark: '182,93,35', core: '255,249,235', blend: 'source-over' },
  };
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- geometry, built once ---------- */
  const globe = []; { const n = 460, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = g * i; globe.push([Math.cos(t) * r, y, Math.sin(t) * r]); } }

  // icosahedron subdivided once: 42 vertices, 120 edges
  const geo = (() => {
    const p = (1 + Math.sqrt(5)) / 2; let v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
    v = v.map(norm); const mid = {}; const m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] == null) { v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); mid[k] = v.length - 1; } return mid[k]; };
    const nf = []; f.forEach(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }); f = nf;
    const es = new Set(); const e = []; f.forEach(([a, b, c]) => [[a, b], [b, c], [c, a]].forEach(([x, y]) => { const k = x < y ? x + '_' + y : y + '_' + x; if (!es.has(k)) { es.add(k); e.push([x, y]); } }));
    return { v, e };
  })();

  // outer shards: a loose polytope well outside the globe
  const shard = (() => {
    const v = []; for (let i = 0; i < 9; i++) { const u = rnd() * 2 - 1, t = rnd() * TAU, r = Math.sqrt(1 - u * u), s = 1.3 + rnd() * 0.22; v.push([Math.cos(t) * r * s, u * s * 0.86, Math.sin(t) * r * s]); }
    const e = []; const has = (a, b) => e.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    v.forEach((a, i) => { const d = v.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]); d.slice(0, 3).forEach(([j]) => { if (!has(i, j)) e.push([i, j]); }); });
    return { v, e };
  })();

  // inner neural network
  const net = (() => {
    const v = []; for (let i = 0; i < 96; i++) { const u = rnd() * 2 - 1, t = rnd() * TAU, r = Math.sqrt(1 - u * u), s = 0.12 + Math.pow(rnd(), 0.7) * 0.74; v.push([Math.cos(t) * r * s, u * s, Math.sin(t) * r * s]); }
    const e = []; const deg = v.map(() => 0);
    v.forEach((a, i) => v.forEach((b, j) => { if (j <= i || deg[i] > 4 || deg[j] > 4) return; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.34) { e.push([i, j]); deg[i]++; deg[j]++; } }));
    return { v, e };
  })();
  const rays = []; for (let i = 0; i < 7; i++) { const u = rnd() * 2 - 1, t = rnd() * TAU, r = Math.sqrt(1 - u * u); rays.push([Math.cos(t) * r, u, Math.sin(t) * r, 1.25 + rnd() * 0.6]); }

  /* ---------- state ---------- */
  const S = { el: null, ctx: null, w: 0, h: 0, dpr: 1, raf: 0, last: 0, yaw: 0.6, yaw2: 0, pitch: -0.32, tx: 0, ty: 0, px: 0, py: 0,
    state: 'idle', level: 0, lvTarget: 0, energy: 0.3, pulses: [], visible: true, ro: null, io: null, wide: false, tiles: [] };
  const ENERGY = { idle: 0.3, thinking: 0.85, listening: 0.6, speaking: 0.7 };
  const LABEL = { idle: 'Online', thinking: 'Reading your business', listening: 'Listening', speaking: 'Speaking' };

  function size() {
    if (!S.el) return; const r = S.el.getBoundingClientRect(); S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height); S.el.width = Math.round(S.w * S.dpr); S.el.height = Math.round(S.h * S.dpr);
    S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); if (reduce()) frame(performance.now(), 0);
  }

  function bind(el) {
    if (S.el === el) return; unbind(); S.el = el; S.ctx = el.getContext('2d');
    const stage = el.closest('.orb-stage') || el.parentElement;
    S.wide = stage.classList.contains('orb-wide');
    S.tiles = [...stage.querySelectorAll('.eng-tile')].map((t, k) => ({ el: t, side: +t.dataset.side, i: +t.dataset.i, phase: k * 1.7, hit: 0, flow: [], x: 0, y: 0, d: 1, size: 54 }));
    stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); S.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; S.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; });
    stage.addEventListener('pointerleave', () => { S.tx = 0; S.ty = 0; });
    if (window.ResizeObserver) { S.ro = new ResizeObserver(size); S.ro.observe(el); }
    if (window.IntersectionObserver) { S.io = new IntersectionObserver((en) => { S.visible = en[0].isIntersecting; if (S.visible) start(); }); S.io.observe(el); }
    size(); label(); start();
  }
  function unbind() { if (S.ro) S.ro.disconnect(); if (S.io) S.io.disconnect(); S.ro = S.io = null; S.el = null; S.ctx = null; cancelAnimationFrame(S.raf); S.raf = 0; }

  function start() { if (!S.el || S.raf) return; if (reduce()) { frame(performance.now(), 0); return; } S.last = performance.now(); S.raf = requestAnimationFrame(loop); }
  function loop(t) {
    S.raf = 0; if (!S.el || !S.el.isConnected) { unbind(); return; }
    if (document.hidden || !S.visible) return;
    const dt = Math.min(0.05, (t - S.last) / 1000); S.last = t; frame(t, dt); S.raf = requestAnimationFrame(loop);
  }

  /* ---------- drawing ---------- */
  function frame(t, dt) {
    S.dt = dt || 0;
    const c = S.ctx; if (!c) return; const w = S.w, h = S.h, cx = w / 2, cy = h / 2;
    // The engine band is always night, in light and dark mode, so the glow reads the same everywhere.
    const color = PALETTE.dark;
    const wide = S.wide;
    const R = wide ? Math.min(h * 0.25, w * 0.15) : Math.min(w, h) * 0.29;
    S.energy += ((ENERGY[S.state] || 0.3) - S.energy) * Math.min(1, dt * 2.5);
    S.level += (S.lvTarget - S.level) * Math.min(1, dt * 10);
    S.yaw += dt * (0.1 + S.energy * 0.32); S.yaw2 -= dt * (0.05 + S.energy * 0.1);
    S.px += (S.tx - S.px) * Math.min(1, dt * 3); S.py += (S.ty - S.py) * Math.min(1, dt * 3);
    const breathe = reduce() ? 0 : Math.sin(t / 1600) * 0.5 + 0.5;
    const pitch = S.pitch + S.py * 0.28, yawOff = S.px * 0.45;
    const F = R * 3.4;
    const mk = (yaw) => { const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      return (p, s) => { const x = p[0] * s, y = p[1] * s, z = p[2] * s; const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; const k = F / (F + z2 * R); return [cx + x1 * R * k, cy + y2 * R * k, z2, k]; }; };
    const P = mk(S.yaw + yawOff), P2 = mk(S.yaw2 + yawOff * 0.6);
    c.clearRect(0, 0, w, h);

    // soft halo behind everything
    const halo = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.9);
    halo.addColorStop(0, `rgba(${color.accent},${0.10 + S.energy * 0.06 + S.level * 0.1})`); halo.addColorStop(0.45, `rgba(${color.accent},0.025)`); halo.addColorStop(1, `rgba(${color.accent},0)`);
    c.fillStyle = halo; c.fillRect(0, 0, w, h);
    if (wide) { floor(c, t, w, h, cx, cy, R); links(c, t, dt, w, h, cx, cy, R, color); }

    // HUD rings (flat, screen space)
    c.save(); c.translate(cx, cy);
    c.strokeStyle = `rgba(${color.ink},0.09)`; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, R * 1.24, 0, TAU); c.stroke();
    if (!wide) { c.setLineDash([2, 6]); c.beginPath(); c.arc(0, 0, R * 1.36, 0, TAU); c.stroke(); c.setLineDash([]); }
    const ticks = wide ? 0 : 120, rot = S.yaw * 0.18;
    for (let i = 0; i < ticks; i++) { const a = (i / ticks) * TAU + rot, long = i % 10 === 0, r0 = R * 1.47, r1 = r0 + (long ? 9 : 4);
      c.strokeStyle = long ? `rgba(${color.ink},0.28)` : `rgba(${color.ink},0.1)`; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); }
    c.lineWidth = 2; c.strokeStyle = `rgba(${color.accent},${0.45 + S.energy * 0.4})`; c.lineCap = 'round';
    const sw = -S.yaw * 0.55; c.beginPath(); c.arc(0, 0, R * 1.24, sw, sw + 0.5 + S.energy * 0.6); c.stroke();
    c.strokeStyle = `rgba(${color.ink},0.35)`; c.beginPath(); c.arc(0, 0, R * 1.24, sw + Math.PI, sw + Math.PI + 0.22); c.stroke();
    c.restore();

    // dotted globe, back half first so the front reads as solid
    const gp = globe.map((p) => P(p, 1)).sort((a, b) => b[2] - a[2]);
    for (const [x, y, z, k] of gp) { const front = (1 - z) / 2; const a = 0.07 + Math.pow(front, 1.6) * 0.78; const s = (0.8 + front * 1.7) * k;
      c.fillStyle = `rgba(${color.ink},${a.toFixed(3)})`; c.fillRect(x - s / 2, y - s / 2, s, s); }

    c.globalCompositeOperation = color.blend;
    // geodesic shell
    const gv = geo.v.map((p) => P(p, 1.015)); c.lineWidth = 0.8;
    for (const [i, j] of geo.e) { const a = gv[i], b = gv[j]; const front = (2 - a[2] - b[2]) / 4; c.strokeStyle = `rgba(${color.ink},${(0.035 + Math.pow(front, 2) * 0.3).toFixed(3)})`; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    for (const [x, y, z] of gv) { const front = (1 - z) / 2; if (front < 0.45) continue; c.fillStyle = `rgba(${color.vertex},${(front * 0.85).toFixed(3)})`; c.beginPath(); c.arc(x, y, 1.1 + front * 1.1, 0, TAU); c.fill(); }

    // outer shards and dashed rays
    const sv = shard.v.map((p) => P2(p, 1)); c.lineWidth = 0.8;
    for (const [i, j] of shard.e) { const a = sv[i], b = sv[j]; c.strokeStyle = `rgba(${color.ink},${(0.08 + (2 - a[2] - b[2]) * 0.04).toFixed(3)})`; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    for (const [x, y, z] of sv) { c.fillStyle = `rgba(${color.vertex},${(0.45 + (1 - z) * 0.25).toFixed(3)})`; c.beginPath(); c.arc(x, y, 1.7, 0, TAU); c.fill(); }
    c.setLineDash([1, 5]); c.strokeStyle = `rgba(${color.ink},0.14)`;
    for (const r of rays) { const a = P2(r, 1.02), b = P2(r, r[3]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.setLineDash([]);

    // inner network
    const nv = net.v.map((p) => P(p, 1)); c.lineWidth = 0.7;
    for (const [i, j] of net.e) { const a = nv[i], b = nv[j]; c.strokeStyle = `rgba(${color.network},${(0.07 + S.energy * 0.08).toFixed(3)})`; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    for (const [x, y, z] of nv) { const front = (1 - z) / 2; c.fillStyle = `rgba(${color.node},${(0.18 + front * 0.5).toFixed(3)})`; c.beginPath(); c.arc(x, y, 0.8 + front * 0.9, 0, TAU); c.fill(); }

    // pulses travelling along the net
    const want = Math.round(4 + S.energy * 20 + S.level * 18);
    while (S.pulses.length < want && net.e.length) { const e = net.e[(Math.random() * net.e.length) | 0]; S.pulses.push({ e, p: 0, v: 0.6 + Math.random() * 1.3, rev: Math.random() < 0.5 }); }
    if (S.pulses.length > want + 6) S.pulses.length = want + 6;
    S.pulses = S.pulses.filter((q) => { q.p += dt * q.v * (0.6 + S.energy); return q.p < 1; });
    for (const q of S.pulses) { const [i, j] = q.rev ? [q.e[1], q.e[0]] : q.e; const a = nv[i], b = nv[j], u = q.p; const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      const g = c.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, `rgba(${color.spark},0.95)`); g.addColorStop(0.35, `rgba(${color.accent},0.45)`); g.addColorStop(1, `rgba(${color.accent},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }

    // core
    const cr = R * (0.2 + breathe * 0.03 + S.energy * 0.04 + S.level * 0.16);
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.4);
    core.addColorStop(0, `rgba(${color.core},0.98)`); core.addColorStop(0.12, `rgba(${color.spark},0.85)`); core.addColorStop(0.38, `rgba(${color.accent},${0.32 + S.level * 0.3})`); core.addColorStop(1, `rgba(${color.accent},0)`);
    c.fillStyle = core; c.beginPath(); c.arc(cx, cy, cr * 2.4, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
  }


  /* ---------- engine band: floor, orbit rings, floating tiles and the light that flows between them ---------- */
  // Left side flows in, right side flows out. Fixed set: it never depends on what is connected.
  const IN = [['dna', 'Context'], ['crm', 'Leads'], ['calls', 'Calls'], ['creators', 'Creators'], ['research', 'Research']];
  const OUT = [['content', 'Content'], ['funnels', 'Funnels'], ['mail', 'Emails'], ['team', 'Agents'], ['revenue', 'Revenue']];
  const DEPTH = [0.88, 1, 0.92, 1, 0.86];
  const bez = (a, b, c2, d, u) => { const v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c2[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c2[1] + u * u * u * d[1]]; };

  function place(t, w, h, cx, cy, R) {
    const narrow = w < 640, n = narrow ? 3 : 5, size = narrow ? 40 : 54;
    const live = []; const still = reduce();
    S.tiles.forEach((tl) => {
      const on = tl.i < n; if (tl.el.hidden === on) tl.el.hidden = !on; if (!on) return;
      // Three loose columns per side so neighbours never stack: ends outside, middle tile nearest the core.
      const f = n === 1 ? 0.5 : tl.i / (n - 1);
      const col = n === 3 ? [0, 1, 0][tl.i] : [0, 1, 2, 1, 0][tl.i];
      const dx = narrow ? 30 : Math.min(96, Math.max(72, w * 0.068));
      let x = Math.max(size / 2 + 14, (narrow ? 0.05 : 0.075) * w) + col * dx; if (tl.side > 0) x = w - x;
      let y = (0.15 + f * 0.6) * h;
      const d = DEPTH[tl.i];
      if (!still) { y += Math.sin(t / 1900 + tl.phase) * 5 * d; x += Math.cos(t / 2600 + tl.phase) * 2.5 * d; }
      x += S.px * 10 * d; y += S.py * 6 * d;
      tl.x = x; tl.y = y; tl.d = d; tl.size = size;
      tl.hit = still ? 0 : Math.max(0, tl.hit - S.dt * 1.6);
      tl.el.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px, 0) scale(${d})`;
      tl.el.style.opacity = (0.6 + 0.4 * d).toFixed(2);
      tl.el.style.setProperty('--hit', tl.hit.toFixed(3));
      live.push(tl);
    });
    return live;
  }
  function path(tl, cx, cy, R) {
    // From the inner edge of the tile to the rim of the core, leaving and arriving horizontally.
    const a = [tl.x - tl.side * (tl.size / 2) * tl.d, tl.y];
    const ang = Math.atan2(tl.y - cy, tl.x - cx); const e = [cx + Math.cos(ang) * R * 1.12, cy + Math.sin(ang) * R * 1.12];
    const dx = Math.abs(e[0] - a[0]);
    return [a, [a[0] - tl.side * dx * 0.55, a[1]], [e[0] + tl.side * dx * 0.35, e[1] + (a[1] - e[1]) * 0.15], e];
  }
  function links(c, t, dt, w, h, cx, cy, R, color) {
    const live = place(t, w, h, cx, cy, R);
    c.globalCompositeOperation = 'lighter';
    for (const tl of live) {
      const [a, b, c2, d] = path(tl, cx, cy, R); tl.path = [a, b, c2, d];
      const g = c.createLinearGradient(a[0], a[1], d[0], d[1]);
      g.addColorStop(0, `rgba(${color.ink},0.16)`); g.addColorStop(0.6, `rgba(${color.ink},0.08)`); g.addColorStop(1, `rgba(${color.accent},${0.32 + S.energy * 0.25})`);
      c.strokeStyle = g; c.lineWidth = 1;
      c.beginPath(); c.moveTo(a[0], a[1]); c.bezierCurveTo(b[0], b[1], c2[0], c2[1], d[0], d[1]); c.stroke();
      c.fillStyle = `rgba(${color.vertex},0.55)`; c.beginPath(); c.arc(a[0], a[1], 1.8, 0, TAU); c.fill();
      c.fillStyle = `rgba(${color.accent},0.8)`; c.beginPath(); c.arc(d[0], d[1], 1.6, 0, TAU); c.fill();
      // light travelling the wire: inbound on the left, outbound on the right
      if (!reduce()) {
        const rate = 0.22 + S.energy * 0.9 + S.level * 1.2;
        if (Math.random() < rate * dt && tl.flow.length < 3) { tl.flow.push({ u: 0, v: 0.32 + Math.random() * 0.22 }); if (tl.side < 0) tl.hit = Math.max(tl.hit, 0.55); }
        tl.flow = tl.flow.filter((q) => { q.u += dt * q.v * (0.8 + S.energy * 0.8); if (q.u >= 1) { if (tl.side > 0) tl.hit = 1; return false; } return true; });
      } else if (!tl.flow.length) tl.flow = [{ u: 0.55, v: 0 }];
      for (const q of tl.flow) {
        const u = tl.side < 0 ? q.u : 1 - q.u;
        for (let k = 6; k >= 0; k--) {
          const uu = Math.max(0, Math.min(1, u + (tl.side < 0 ? -1 : 1) * k * 0.018)); const [x, y] = bez(a, b, c2, d, uu);
          const r = k === 0 ? 6 : 3.2 - k * 0.35; const al = k === 0 ? 0.9 : 0.32 - k * 0.04;
          const gg = c.createRadialGradient(x, y, 0, x, y, r);
          gg.addColorStop(0, `rgba(${color.spark},${al})`); gg.addColorStop(1, `rgba(${color.accent},0)`);
          c.fillStyle = gg; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        }
      }
    }
    c.globalCompositeOperation = 'source-over';
  }
  function floor(c, t, w, h, cx, cy, R) {
    // A perspective dot floor that fades out at the sides, and two tilted orbits around the core.
    const top = cy + R * 0.95, rows = 8;
    for (let k = 0; k < rows; k++) {
      const f = (k + 1) / rows, y = top + (h - top + 12) * Math.pow(f, 1.7), gap = 16 + 34 * f;
      const off = (S.yaw * 6 * f) % gap;
      for (let x = cx - Math.floor(cx / gap + 1) * gap + off; x < w + gap; x += gap) {
        const fx = Math.abs(x - cx) / (w * 0.52); if (fx >= 1) continue;
        const a = (0.05 + 0.13 * f) * (1 - fx * fx); const s = 0.8 + f * 1.1;
        c.fillStyle = `rgba(246,240,230,${a.toFixed(3)})`; c.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    const tilt = 0.2;
    [[1.85, 0.11, false], [2.45, 0.07, true]].forEach(([k, al, dash], i) => {
      const rx = R * k, ry = rx * tilt, oy = cy + R * 0.08;
      if (dash) c.setLineDash([1, 6]);
      c.strokeStyle = `rgba(246,240,230,${al})`; c.lineWidth = 1; c.beginPath(); c.ellipse(cx, oy, rx, ry, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      const ang = (reduce() ? 0.6 : t / (i ? 5200 : 3400)) * (i ? -1 : 1) + i * 2;
      const x = cx + Math.cos(ang) * rx, y = oy + Math.sin(ang) * ry, front = (Math.sin(ang) + 1) / 2;
      const gg = c.createRadialGradient(x, y, 0, x, y, 9); gg.addColorStop(0, `rgba(255,214,176,${0.35 + front * 0.6})`); gg.addColorStop(1, 'rgba(239,138,76,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
    });
  }

  function label() {
    const st = S.el && S.el.closest('.orb-stage'); if (!st) return;
    st.dataset.state = S.state; const l = st.querySelector('[data-orb-state]'); if (l) l.textContent = LABEL[S.state] || 'Online';
  }

  window.JarvisOrb = {
    html(cls) {
      const ic = (n) => (window.UI && window.UI.icon ? window.UI.icon(n) : '');
      const tile = (side) => ([k, l], i) => `<span class="eng-tile" data-side="${side}" data-i="${i}">${ic(k)}<b>${l}</b></span>`;
      return `<div class="orb-stage orb-wide ${cls || ''}" data-state="${S.state}">
        <canvas data-orb aria-hidden="true"></canvas>
        <div class="eng-tiles" aria-hidden="true">${IN.map(tile(-1)).join('')}${OUT.map(tile(1)).join('')}</div>
        <span class="orb-tag tl">Jarvis core</span>
        <span class="orb-tag bl"><i></i><span data-orb-state>${LABEL[S.state]}</span></span>
        <button class="orb-hit" data-action="voice-open" aria-label="Talk to Jarvis"><span class="orb-tag br">Tap to talk</span></button>
      </div>`;
    },
    scan() { const el = document.querySelector('canvas[data-orb]'); if (el) bind(el); else if (S.el && !S.el.isConnected) unbind(); },
    setState(s) { if (!LABEL[s]) s = 'idle'; if (S.state === s) return; S.state = s; label(); if (reduce()) frame(performance.now(), 0); },
    setLevel(v) { S.lvTarget = Math.max(0, Math.min(1, +v || 0)); },
    get state() { return S.state; },
  };
  // A paused/reduced-motion canvas still needs one redraw when the theme changes.
  if (window.MutationObserver) new MutationObserver(() => {
    if (S.el && S.el.isConnected) frame(performance.now(), 0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (motion && motion.addEventListener) motion.addEventListener('change', () => {
    cancelAnimationFrame(S.raf); S.raf = 0;
    if (S.el && S.el.isConnected) start();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
})();

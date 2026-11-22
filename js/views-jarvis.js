// Jarvis: the command view over every agent and department.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, eur, eur2, int, pct, icon } = U;
  const T = St.T, SEED = St.SEED;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DEPTS = [
    { id: 'Revenue and sales', short: 'Sales', go: 'revenue' },
    { id: 'Brand and content', short: 'Content', go: 'content' },
    { id: 'Offers and funnels', short: 'Offers', go: 'offers' },
    { id: 'Data and learning', short: 'Data', go: 'data' },
  ];
  const deptOf = (agentId) => (St.s.agents.find((a) => a.id === agentId) || {}).dept;
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(Math.round(m % 60));
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const todayLabel = () => new Date(SEED.iso(T) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const pick = (arr, k) => arr[Math.abs(k) % arr.length];

  /* ---------- geometry of the operations map ---------- */
  const R = { core: 78, dial: 112, spokeIn: 90, band: 184, node: 232, label: 250 };
  function layout() {
    const slots = St.s.agents.length + DEPTS.length; const step = 360 / slots;
    let k = 0; const nodes = []; const arcs = [];
    DEPTS.forEach((d) => {
      const list = St.s.agents.filter((a) => a.dept === d.id);
      const first = -90 + (k + 0.5) * step;
      list.forEach((a) => { nodes.push({ a, deg: -90 + (k + 0.5) * step }); k++; });
      const last = -90 + (k - 0.5) * step;
      arcs.push({ d, from: first - step * 0.42, to: last + step * 0.42, mid: (first + last) / 2, list });
      k++; // gap between departments
    });
    return { nodes, arcs };
  }
  const pt = (deg, r) => { const t = deg * Math.PI / 180; return [Math.cos(t) * r, Math.sin(t) * r]; };
  const f1 = (n) => n.toFixed(1);
  function arcPath(from, to, r, reverse) {
    const [x1, y1] = pt(reverse ? to : from, r), [x2, y2] = pt(reverse ? from : to, r);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M${f1(x1)} ${f1(y1)}A${r} ${r} 0 ${large} ${reverse ? 0 : 1} ${f1(x2)} ${f1(y2)}`;
  }

  function mapSVG() {
    const { nodes, arcs } = layout(); const sc = St.score().total;
    const circ = 2 * Math.PI * R.core;
    const ticks = Array.from({ length: 72 }, (_, i) => { const deg = i * 5; const long = i % 6 === 0; const [x1, y1] = pt(deg, R.dial); const [x2, y2] = pt(deg, R.dial + (long ? 9 : 4)); return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${long ? 'tk l' : 'tk'}"/>`; }).join('');
    const bands = arcs.map(({ d, from, to, mid, list }, i) => {
      const bottom = Math.sin(mid * Math.PI / 180) > 0.05;
      const warn = list.some((a) => a.status !== 'ok' && !a.paused);
      return `<g class="dept-arc ${warn ? 'warn' : ''}" data-dept="${esc(d.id)}">
        <path d="${arcPath(from, to, R.band)}" class="band"/>
        <path id="dl${i}" d="${arcPath(from, to, bottom ? R.band - 9 : R.band - 17, bottom)}" fill="none" stroke="none"/>
        <text class="dlabel"><textPath href="#dl${i}" startOffset="50%" text-anchor="middle">${esc(d.short.toUpperCase())}</textPath></text></g>`;
    }).join('');
    const spokes = nodes.map(({ a, deg }) => { const [x1, y1] = pt(deg, R.spokeIn), [x2, y2] = pt(deg, R.node - 10); return `<line class="spoke" data-spoke="${a.id}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`; }).join('');
    const ns = nodes.map(({ a, deg }) => {
      const [x, y] = pt(deg, R.node); const [lx, ly] = pt(deg, R.label); const c = Math.cos(deg * Math.PI / 180); const s = Math.sin(deg * Math.PI / 180);
      const right = c >= -0.001; const anchor = right ? 'start' : 'end'; const rot = right ? deg : deg + 180; void s;
      const st = a.paused ? 'paused' : VS.running[a.id] ? 'running' : a.status !== 'ok' ? 'warn' : 'ok';
      return `<g class="node ${st}" data-node="${a.id}" data-action="agent" data-id="${a.id}" tabindex="0" role="button" aria-label="${esc(a.name)}, ${st === 'ok' ? 'healthy' : st}">
        <title>${esc(a.name)} · ${esc(a.schedule)}</title>
        <circle class="halo" cx="${f1(x)}" cy="${f1(y)}" r="9"/>
        <circle class="hit" cx="${f1(x)}" cy="${f1(y)}" r="16"/>
        <circle class="dot" cx="${f1(x)}" cy="${f1(y)}" r="${a.mode === 'Acts' ? 6.5 : 5}"/>
        <text class="lbl" x="${f1(lx)}" y="${f1(ly)}" dy="0.34em" text-anchor="${anchor}" transform="rotate(${f1(rot)} ${f1(lx)} ${f1(ly)})">${esc(a.name)}</text></g>`;
    }).join('');
    return `<svg class="jv-map" viewBox="-400 -400 800 800" role="img" aria-label="Operations map of ${St.s.agents.length} agents in four departments">
      <circle r="${R.node}" class="orbit"/>
      <circle r="${R.band + 22}" class="orbit faint"/>
      <circle r="${R.dial}" class="orbit"/><g class="dial">${ticks}</g>
      ${reduce ? '' : `<g class="sweep"><line x1="0" y1="0" x2="0" y2="${-R.node + 14}"/></g>`}
      ${bands}${spokes}
      <g class="pulses"></g>
      <g class="core" id="jv-core">
        <circle r="${R.core}" class="core-bg"/>
        <circle r="${R.core}" class="core-track"/>
        <circle r="${R.core}" class="core-score" stroke-dasharray="${f1(circ * sc / 100)} ${f1(circ)}" transform="rotate(-90)"/>
        <text y="-24" class="core-eyebrow">JARVIS</text>
        <text y="16" class="core-num">${sc}</text>
        <text y="38" class="core-sub">OS score</text>
      </g>
      ${ns}
    </svg>`;
  }

  /* ---------- live feed ---------- */
  function line(id, k) {
    const c = SEED.contacts; const v = SEED.videos; const latest = [...v].sort((a, b) => b.day - a.day)[0];
    const bad = St.s.sources.filter((s) => s.status !== 'green').length; const stalled = St.stalledDeals();
    const risk = St.clientHealth().filter((x) => x.health < 50).length; const up = SEED.upcoming.filter((u) => u.day === T);
    const hot = St.hotContacts();
    const m = {
      nightly: () => `Read ${30 + (k % 40)} new comments on "${pick(v.slice(-8), k).title}" and scored 3 new ideas.`,
      draft: () => `Wrote two script variants for "${pick(St.s.ideas.filter((i) => i.col !== 'published'), k).title}".`,
      repurpose: () => `Cut 4 shorts and a newsletter from "${latest.title}".`,
      offerlab: () => `Compared kit conversion this week against the last four.`,
      funnel: () => `Checked page copy on ${pick(St.s.funnels, k).name} against your voice guide.`,
      briefing: () => `Rewrote today's briefing with ${up.length} calls and ${St.s.approvals.length} drafts waiting.`,
      dossier: () => up.length ? `Prepared the dossier for ${St.contactById[pick(up, k).contactId].name}, ${pick(up, k).time}.` : 'No calls left today.',
      coach: () => `Graded yesterday's calls. Talk time held under 45%.`,
      followup: () => stalled.length ? `${stalled.length} deals have gone quiet. Drafted a nudge for ${pick(stalled, k).c.name}.` : 'No quiet deals.',
      health: () => `Scored ${St.clientHealth().length} SaaS clients. ${risk} are below 50.`,
      monitor: () => `Checked ${St.s.sources.length} feeds. ${bad ? bad + ' need attention.' : 'All healthy.'}`,
      fixer: () => `Matched ${4 + (k % 9)} affiliate clicks to the videos that sent them.`,
      enricher: () => `Filled company and role for ${pick(c, k * 7).name}.`,
      outcome: () => `Linked ${2 + (k % 5)} new payments to their first video.`,
      ask: () => hot.length ? `Flagged ${pick(hot, k).name} as warm after another video view.` : 'Nothing new to flag.',
    };
    return (m[id] || (() => (window.ContentAgents && window.ContentAgents.line(id)) || 'Finished a run.'))();
  }
  function seedFeed() {
    const now = nowMin(); const items = [];
    const sched = St.s.agents.filter((a) => /^Daily \d/.test(a.schedule)).map((a) => ({ a, t: toMin(a.schedule.slice(6)) }));
    sched.forEach(({ a, t }, i) => items.push({ t: t <= now ? t : t - 1440, id: a.id, text: line(a.id, i) }));
    for (let h = 1; h <= 3; h++) items.push({ t: Math.floor(now / 60) * 60 - (h - 1) * 60, id: 'monitor', text: line('monitor', h) });
    items.push({ t: now - 4, id: 'enricher', text: line('enricher', 3) });
    items.push({ t: now - 11, id: 'ask', text: line('ask', 1) });
    return items.sort((a, b) => b.t - a.t).slice(0, 9).map((x) => ({ ...x, time: hm((x.t + 1440) % 1440) }));
  }
  const feedRow = (x, fresh) => { const a = St.s.agents.find((y) => y.id === x.id); return `<li class="${fresh ? 'fresh' : ''}" data-feed-agent="${x.id}"><span class="t">${x.time}</span><div><b>${esc(a ? a.name : 'Jarvis')}</b><span>${esc(x.text)}</span></div></li>`; };

  /* ---------- today's shift ---------- */
  function shift() {
    const up = SEED.upcoming.filter((u) => u.day === T);
    const ev = [];
    St.s.agents.forEach((a) => {
      const d = /^Daily (\d\d:\d\d)/.exec(a.schedule); if (d) ev.push({ t: toMin(d[1]), a });
      if (/2 h before each call/.test(a.schedule)) up.forEach((u) => ev.push({ t: toMin(u.time) - 120, a, for: u }));
      if (/After each call/.test(a.schedule)) up.forEach((u) => ev.push({ t: toMin(u.time) + 45, a, for: u }));
    });
    const triggers = St.s.agents.filter((a) => /^On /.test(a.schedule));
    return { ev: ev.sort((x, y) => x.t - y.t), calls: up, triggers };
  }
  function shiftHTML() {
    const { ev, calls, triggers } = shift(); const now = nowMin();
    const next = ev.filter((e) => e.t > now && !e.a.paused).slice(0, 3);
    const done = ev.filter((e) => e.t <= now).length;
    const x = (t) => (t / 1440 * 100).toFixed(2) + '%';
    return `<section class="panel jv-shift"><header><div><h2>Today's shift</h2><p class="muted small">${done} scheduled runs done, ${ev.length - done} to go. Data Monitor also checks every hour.</p></div>
      <div class="jv-next">${next.length ? next.map((e) => `<div><span class="t">${hm(e.t)}</span><b>${esc(e.a.name)}</b><span class="muted">${e.for ? esc(St.contactById[e.for.contactId].name) : esc(e.a.dept)}</span></div>`).join('') : '<div class="muted">Nothing else scheduled today</div>'}</div></header>
      <div class="track" aria-hidden="true">
        <div class="lane"><span class="lane-l">Agents</span><div class="rail-x">${Array.from({ length: 24 }, (_, h) => `<i class="hour" style="left:${x(h * 60)}"></i>`).join('')}${ev.map((e) => `<button class="mk ${e.t <= now ? 'done' : ''} ${e.a.paused ? 'off' : ''}" style="left:${x(e.t)}" data-action="agent" data-id="${e.a.id}" title="${hm(e.t)} · ${esc(e.a.name)}${e.for ? ' · ' + esc(St.contactById[e.for.contactId].name) : ''}" tabindex="-1"></button>`).join('')}<span class="now" style="left:${x(now)}"><b>${hm(now)}</b></span></div></div>
        <div class="lane"><span class="lane-l">Calls</span><div class="rail-x">${calls.map((u) => `<button class="call ${toMin(u.time) + 45 <= now ? 'done' : ''}" style="left:${x(toMin(u.time))};width:${x(45)}" data-action="dossier" data-id="${u.id}" title="${u.time} · ${esc(St.contactById[u.contactId].name)}" tabindex="-1"></button>`).join('')}<span class="now" style="left:${x(now)}"></span></div></div>
        <div class="hours">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<span style="left:${x(h * 60)}">${pad(h % 24)}</span>`).join('')}</div>
      </div>
      <p class="muted small jv-trig">On trigger: ${triggers.map((a) => `<button class="lnk" data-action="agent" data-id="${a.id}">${esc(a.name)}</button> <span class="faint">${esc(a.schedule.replace(/^On /, 'on ').toLowerCase())}</span>`).join(', ')}.</p>
    </section>`;
  }

  /* ---------- departments ---------- */
  function deptCards() {
    const r30 = St.range(30); const cur = St.total(r30.cur); const prev = St.total(r30.prev || {}) || 0;
    const up = SEED.upcoming.filter((u) => u.day === T);
    const pipe = St.s.ideas.filter((i) => i.col !== 'published').length; const ready = St.s.ideas.filter((i) => i.col === 'ready').length;
    const out30 = SEED.videos.filter((v) => v.day > T - 30).length;
    const live = St.s.funnels.filter((f) => f.status === 'live').length;
    const sc = St.score(); const dataV = sc.parts.find((p) => p.id === 'data').v;
    const facts = {
      'Revenue and sales': { big: up.length + (up.length === 1 ? ' call today' : ' calls today'), sub: 'Revenue figures stay on the Revenue page', rows: [[St.s.approvals.filter((x) => deptOf(x.agent) === 'Revenue and sales').length, 'drafts to approve'], [St.stalledDeals().length, 'quiet deals'], [St.clientHealth().filter((x) => x.health < 50).length, 'clients at risk']] },
      'Brand and content': { big: out30 + ' videos', sub: 'Published, last 30 days', rows: [[pipe, 'ideas in the pipeline'], [ready, 'ready to film'], [St.s.ideas.filter((i) => i.col === 'developing').length, 'in development']] },
      'Offers and funnels': { big: live + ' funnels live', sub: 'Hosted in HighLevel', rows: [[St.s.packages.length, 'funnel packages'], [St.s.offerDrafts.length, 'Offer Lab drafts'], [SEED.OFFERS.length, 'offers on the ladder']] },
      'Data and learning': { big: pct(dataV, 0) + ' coverage', sub: St.s.sources.filter((s) => s.status === 'green').length + ' of ' + St.s.sources.length + ' feeds healthy', rows: [[St.s.brain.gaps.length, 'Brain gaps'], [St.s.sources.filter((s) => s.status !== 'green').length, 'feeds to fix'], [St.s.brain.decisions.length, 'decisions learned']] },
    };
    return `<div class="jv-depts">${DEPTS.map((d) => {
      const list = St.s.agents.filter((a) => a.dept === d.id); const f = facts[d.id];
      const waiting = St.s.approvals.filter((x) => deptOf(x.agent) === d.id).length;
      const days = Array.from({ length: 14 }, (_, i) => St.s.runs.filter((r) => r.day === T - 14 + i && list.some((a) => a.id === r.agent)).length);
      const mx = Math.max(1, ...days);
      const look = list.filter((a) => a.paused || a.status !== 'ok');
      return `<article class="panel jv-dept" data-dept-card="${esc(d.id)}">
        <header><h3>${esc(d.id)}</h3><button class="btn sm ghost" data-action="go" data-go="${d.go}">Open ${icon('arrow')}</button></header>
        <p class="big">${f.big}</p><p class="muted small">${f.sub}</p>
        <ul class="facts">${f.rows.map(([n, l]) => `<li><b>${n}</b><span>${l}</span></li>`).join('')}</ul>
        <div class="crew">${list.map((a) => `<button class="mate" data-action="agent" data-id="${a.id}" title="${esc(a.name)}"><span class="dot ${a.paused ? 'off' : a.status === 'ok' ? '' : 'warn'}"></span>${esc(a.name)}</button>`).join('')}</div>
        <footer><svg class="spark" viewBox="0 0 140 28" preserveAspectRatio="none" aria-label="Runs per day, last 14 days">${days.map((n, i) => `<rect x="${i * 10 + 1}" y="${f1(28 - Math.max(2, n / mx * 26))}" width="7" height="${f1(Math.max(2, n / mx * 26))}" rx="1.5"/>`).join('')}</svg>
          <span class="small ${waiting ? '' : 'muted'}">${waiting ? `<button class="lnk" data-action="go" data-go="approvals">${waiting} waiting on you</button>` : look.length ? look.map((a) => a.name).join(', ') + ' need a look' : 'Nothing waiting'}</span></footer>
      </article>`;
    }).join('')}</div>`;
  }

  /* ---------- the view ---------- */
  V.jarvis = () => {
    if (!VS.jfeed) VS.jfeed = seedFeed();
    const h = new Date().getHours(); const greet = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = (St.s.settings.name || 'Avery').split(' ')[0];
    const ag = St.s.agents; const look = ag.filter((a) => !a.paused && a.status !== 'ok'); const paused = ag.filter((a) => a.paused);
    const last24 = St.s.runs.filter((r) => r.day >= T - 1);
    const hrs = last24.reduce((s, r) => s + r.minutes, 0) / 60;
    const holding = ag.filter((a) => a.mode === 'Acts').every((a) => a.paused);
    const up = SEED.upcoming.filter((u) => u.day === T);
    const waits = [
      { n: St.s.approvals.length, l: 'drafts to approve', go: 'approvals' },
      { n: up.length, l: 'calls today', go: 'calls' },
      { n: St.s.brain.gaps.length, l: 'Brain questions', go: 'brain' },
      { n: St.s.sources.filter((s) => s.status !== 'green').length, l: 'feeds to fix', go: 'data' },
    ];
    return `<div class="jv">
      <section class="jv-head has-orb"><div class="jv-copy">
        <h1>${greet}, ${esc(name)}.</h1>
        <p class="home-meta"><span class="live"></span>Jarvis online<span class="sep"></span>${todayLabel()}<span class="sep"></span><span id="jv-clock" class="tnum">${new Date().toTimeString().slice(0, 8)}</span></p>
        <p class="jv-sum">${ag.length - paused.length} of ${ag.length} agents are on shift across four departments. In the last 24 hours they ran ${last24.length} times, did ${hrs.toFixed(1)} hours of work and left ${St.s.approvals.length} drafts for you.${look.length ? ` ${look.map((a) => a.name).join(' and ')} ${look.length > 1 ? 'need' : 'needs'} a look.` : ' Every agent is healthy.'}${paused.length ? ` ${paused.length} paused.` : ''}</p>
        <form class="jv-cmd" data-jcmd>
          ${icon('search')}<input id="jv-q" name="q" autocomplete="off" placeholder="Tell Jarvis what you need. Try: who is hot right now?" aria-label="Ask Jarvis">
          <button class="btn sm talk" type="button" data-action="voice-open" aria-label="Talk to Jarvis">${icon('mic')}<span>Talk</span></button><button class="btn primary sm" type="submit">Ask</button>
        </form>
        <div class="jv-chips">
          <button class="chip" data-action="jv-cycle" id="jv-cycle">${icon('play')}Run the morning cycle</button>
          <button class="chip" data-action="jv-ask" data-q="What needs me today?">What needs me today?</button>
          <button class="chip" data-action="jv-ask" data-q="Which clients might churn?">Which clients might churn?</button>
          <button class="chip" data-action="jv-ask" data-q="What did each stream make in October?">What did each stream make in October?</button>
          <button class="chip" data-action="jv-hold">${icon(holding ? 'play' : 'pause')}${holding ? 'Resume drafting agents' : 'Hold all drafting agents'}</button>
        </div>
        <div class="vc-slot"></div>
      </div>${window.JarvisOrb ? window.JarvisOrb.html('jv-orb') : ''}
      </section>
      ${window.Morning ? window.Morning.home() : ''}
      <div class="jv-grid">
        <section class="panel jv-ops"><header><h2>Operations</h2><div class="jv-legend small muted"><span><i class="lg ok"></i>Healthy</span><span><i class="lg warn"></i>Needs a look</span><span><i class="lg run"></i>Running</span><span><i class="lg off"></i>Paused</span></div></header>
          ${mapSVG()}
          <p class="muted small jv-hint">Larger dots draft work for approval. Smaller dots read and report. Select any agent to open it.</p>
        </section>
        <div class="jv-side">
          <section class="panel jv-wait"><header><h2>Waiting on you</h2></header>
            <div class="wgrid">${waits.map((w) => `<button class="w ${w.n ? '' : 'zero'}" data-action="go" data-go="${w.go}"><b>${w.n}</b><span>${w.l}</span></button>`).join('')}</div>
          </section>
          <section class="panel jv-feed"><header><h2>Live</h2><span class="small muted"><span class="live"></span>Streaming from your agents</span></header>
            <ul id="jv-feed">${VS.jfeed.map((x) => feedRow(x)).join('')}</ul>
          </section>
        </div>
      </div>
      <div class="hm-pair">${window.OSYT ? window.OSYT.card() : ''}
      ${window.OSIG ? window.OSIG.card() : ''}</div>
      <div class="hm-pair">${window.OSProven ? window.OSProven.homePanel(4) : ''}</div>
      ${shiftHTML()}
      <h2 class="dept">Departments</h2>
      ${deptCards()}
    </div>`;
  };

  /* ---------- motion ---------- */
  function pulse(id, strong) {
    const svg = document.querySelector('.jv-map'); if (!svg) return;
    const sp = svg.querySelector(`[data-spoke="${id}"]`); if (!sp) return;
    const x1 = +sp.getAttribute('x2'), y1 = +sp.getAttribute('y2'), x0 = +sp.getAttribute('x1'), y0 = +sp.getAttribute('y1');
    sp.classList.add('lit'); setTimeout(() => sp.classList.remove('lit'), strong ? 900 : 700);
    if (reduce) return;
    const g = svg.querySelector('.pulses'); const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', strong ? 3.4 : 2.6); c.setAttribute('class', 'pulse'); g.appendChild(c);
    const dur = 760; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; c.setAttribute('cx', x1 + (x0 - x1) * e); c.setAttribute('cy', y1 + (y0 - y1) * e); if (p < 1) requestAnimationFrame(step); else { c.remove(); const core = document.getElementById('jv-core'); if (core) { core.classList.add('ping'); setTimeout(() => core.classList.remove('ping'), 260); } } };
    requestAnimationFrame(step);
  }
  function pushFeed(id, text) {
    const x = { id, text, time: new Date().toTimeString().slice(0, 5) };
    VS.jfeed.unshift(x); VS.jfeed = VS.jfeed.slice(0, 9);
    const ul = document.getElementById('jv-feed'); if (!ul) return;
    ul.insertAdjacentHTML('afterbegin', feedRow(x, true));
    while (ul.children.length > 9) ul.lastElementChild.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => { const li = ul.firstElementChild; if (li) li.classList.remove('fresh'); }));
  }
  function setNode(id, cls) { const n = document.querySelector(`.jv-map [data-node="${id}"]`); if (!n) return; n.classList.remove('ok', 'warn', 'running', 'paused'); n.classList.add(cls); }

  let k = 0;
  V.jarvis.after = () => {
    clearInterval(VS.jtimer); let tick = 0;
    VS.jtimer = setInterval(() => {
      if (VS.view !== 'jarvis' || !document.querySelector('.jv')) { clearInterval(VS.jtimer); return; }
      const clock = document.getElementById('jv-clock'); if (clock) clock.textContent = new Date().toTimeString().slice(0, 8);
      tick++;
      if (tick % 30 === 0) document.querySelectorAll('.jv-shift .now').forEach((n) => { n.style.left = (nowMin() / 1440 * 100).toFixed(2) + '%'; const b = n.querySelector('b'); if (b) b.textContent = hm(nowMin()); });
      if (VS.jcycle) return;
      if (tick % 3 === 0) { const live = St.s.agents.filter((a) => !a.paused); if (live.length) pulse(pick(live, k * 5 + 3).id); }
      if (tick % 7 === 0) { const live = St.s.agents.filter((a) => !a.paused && a.id !== 'ask' || a.id === 'ask' && !a.paused); if (live.length) { const a = pick(live, k * 11 + 2); k++; pulse(a.id, true); pushFeed(a.id, line(a.id, k)); } }
    }, 1000);
  };

  /* ---------- commands ---------- */
  ACT['jv-ask'] = (el) => window.App.ask(el.dataset.q);
  ACT['jv-hold'] = () => {
    const acts = St.s.agents.filter((a) => a.mode === 'Acts'); const holding = acts.every((a) => a.paused);
    acts.forEach((a) => { if (a.paused === holding) St.A.togglePause(a.id); });
    U.toast(holding ? 'Drafting agents resumed' : acts.length + ' drafting agents on hold. Watchers keep reading.');
    window.App.render(true);
  };
  ACT['jv-cycle'] = async (el) => {
    if (VS.jcycle) return; VS.jcycle = true; if (window.JarvisOrb) window.JarvisOrb.setState('thinking');
    const order = ['monitor', 'fixer', 'enricher', 'health', 'followup', 'dossier', 'briefing'].filter((id) => !St.s.agents.find((a) => a.id === id).paused);
    el.disabled = true; el.innerHTML = U.spin + 'Running the cycle';
    pushFeed('briefing', 'Starting the morning cycle: ' + order.length + ' agents in sequence.');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let added = 0;
    for (const id of order) {
      if (!document.querySelector('.jv')) break;
      VS.running[id] = true; setNode(id, 'running'); pulse(id, true);
      await wait(reduce ? 200 : 820);
      VS.running[id] = false; St.A.runAgent(id);
      if (id === 'followup' && St.stalledDeals().length) {
        const d = St.stalledDeals()[0];
        St.A.addApproval({ kind: 'Email', title: 'Follow-up to ' + d.c.name, agent: 'followup', stream: d.c.roles[0] || 'services', contactId: d.c.id, rubric: 'rb-email', scores: [8.7, 8.9, 8.4, 8.6], action: 'Send email from HighLevel', body: 'Hi ' + d.c.first + ',\n\nI kept your slot open. Want me to hold it for next week, or should I let it go?\n\nAvery', evidence: 'Quiet ' + d.days + ' days after the last step.' });
        added++;
      }
      setNode(id, 'ok'); pushFeed(id, line(id, ++k)); window.App.refreshCounts();
    }
    VS.jcycle = false; if (window.JarvisOrb) window.JarvisOrb.setState("idle");
    U.toast(`Morning cycle finished. ${order.length} agents ran${added ? ', ' + added + ' new draft in the Newsfeed' : ''}.`);
    window.App.render(true);
  };
})();

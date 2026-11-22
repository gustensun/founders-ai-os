// Run: Today, Revenue, Calls, Approvals, plus the contact, dossier and call coach drawers.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, C = window.Charts;
  const { esc, eur, int, pct, change, shade, sname, icon, title, kpis, who, vid } = U;
  const T = St.T, SEED = St.SEED;
  const STREAMS = SEED.STREAMS;

  /* ---------- shared bits ---------- */
  function chainNumbers(days) {
    const from = T - days;
    const vids = SEED.videos.filter((v) => v.day >= from - 30);
    const evs = St.evIn(from, T - 1, (e) => e.source === 'youtube');
    const buyers = new Set(evs.map((e) => e.contactId));
    const ytContacts = new Set(SEED.contacts.filter((c) => c.source === 'youtube').map((c) => c.id));
    const calls = SEED.pastCalls.filter((p) => p.day >= from && ytContacts.has(p.contactId)).length + SEED.upcoming.filter((p) => ytContacts.has(p.contactId)).length;
    const views = St.sum(vids, (v) => v.views), eng = St.sum(vids, (v) => v.likes + v.comments), leads = St.sum(vids, (v) => v.leads);
    return { vids: vids.length, views, eng, leads, calls, buyers: buyers.size, revenue: St.sum(evs), byStream: St.byStream(evs) };
  }
  function chainHtml(n, full) {
    const steps = full
      ? [['Videos', n.vids, ''], ['Views', n.views, ''], ['Engagements', n.eng, pct(n.eng / n.views, 1) + ' of views'], ['Leads', n.leads, pct(n.leads / n.views, 2) + ' of views'], ['Calls', n.calls, pct(n.calls / n.leads, 1) + ' of leads'], ['Buyers', n.buyers, ''], ['Revenue', eur(n.revenue), eur(n.revenue / Math.max(1, n.buyers)) + ' each']]
      : [['Views', n.views, ''], ['Leads', n.leads, pct(n.leads / n.views, 2) + ' of views'], ['Buyers', n.buyers, pct(n.buyers / Math.max(1, n.leads), 1) + ' of leads'], ['Revenue', eur(n.revenue), eur(n.revenue / Math.max(1, n.buyers)) + ' each']];
    return `<div class="chain ${full ? 'full' : ''}">${steps.map(([l, v, r]) => `<div class="link"><div class="v">${typeof v === 'number' ? int(v) : v}</div><div class="l">${l}</div><div class="rate">${r || '&nbsp;'}</div></div>`).join('')}</div>
      <div class="split" aria-hidden="true">${STREAMS.map((s) => `<span style="flex:${n.byStream[s.id] || 0.0001};background:${shade[s.id]}"></span>`).join('')}</div>
      <ul class="legend">${STREAMS.map((s) => `<li><span><span class="sw" style="background:${shade[s.id]}"></span>${s.name}</span><span class="amt">${eur(n.byStream[s.id])}</span></li>`).join('')}</ul>`;
  }
  V.chainNumbers = chainNumbers; V.chainHtml = chainHtml;

  const scoreBars = (sc, withNext) => `<div class="score-bars">${sc.parts.map((p) => `<div><div class="sbar ${p.v < 0.8 ? 'low' : ''}"><span>${p.label}</span><span class="track"><span class="fill" style="width:${Math.round(p.v * 100)}%"></span></span><span class="v">${Math.round(p.v * 100)}</span></div>${withNext ? `<button class="next" data-action="go" data-go="${p.go}">${esc(p.next)} ${icon('arrow')}</button>` : ''}</div>`).join('')}</div>`;
  V.scoreBars = scoreBars;

  function avgScore(a) {
    const rb = St.s.brain.rubrics.find((r) => r.id === a.rubric);
    if (!rb) return a.scores.reduce((x, y) => x + y, 0) / a.scores.length;
    return rb.criteria.reduce((s, [, w], i) => s + w * (a.scores[i] || 0), 0) / rb.criteria.reduce((s, [, w]) => s + w, 0);
  }
  V.avgScore = avgScore;
  const fmtScore = (a) => (a.scores.length ? avgScore(a).toFixed(1) : a.kind === 'Field update' ? 'Data' : 'Plan');

  /* ---------- Revenue ---------- */
  // opts lets the live Revenue page reuse this as its Demo mode: own currency, scale, header actions and a note.
  V.revenue = (opts = {}) => {
    const money = opts.money || eur;
    const n = VS.rev, months = St.monthly(n);
    const days = n * 30, r = St.range(days);
    const sel = VS.revStream;
    const offers = St.offerPerf();
    const offerRows = offers.map((o) => ({ label: o.name, value: n === 12 ? o.rev12 : St.sum(SEED.events.filter((e) => e.offerId === o.id && e.day >= T - days)) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
    const srcLabel = { youtube: 'YouTube', referral: 'Referral', outreach: 'Outreach', direct: 'Direct', ads: 'Ads', community: 'Community', partner: 'Partner' };
    const srcRows = St.bySource(days).map(([k, v]) => ({ label: srcLabel[k] || k, value: v }));
    const winV = SEED.videos.map((v) => ({ v, rev: St.videoRev[v.id] || 0 })).sort((a, b) => b.rev - a.rev).slice(0, 4);
    const avgV = St.sum(SEED.videos, (v) => St.videoRev[v.id] || 0) / SEED.videos.length;
    const winC = [...SEED.contacts].sort((a, b) => b.ltv - a.ltv).slice(0, 4);
    const avgC = St.sum(SEED.contacts, (c) => c.ltv) / SEED.contacts.length;
    const avgO = St.sum(offers, (o) => o.rev12) / offers.length;
    const health = St.clientHealth();
    const mrr = St.sum(health, (h) => h.mrr);

    U.after(() => {
      const series = sel === 'all' ? STREAMS.map((s) => ({ name: s.name, values: months.map((m) => m[s.id]) })) : [{ name: sname(sel), values: months.map((m) => m[sel]) }];
      C.line(U.$('#rev-line'), { labels: months.map((m) => m.label), series, format: money, height: 240, legend: U.$('#rev-legend') });
      C.barList(U.$('#rev-offers'), offerRows, { format: money });
      C.barList(U.$('#rev-sources'), srcRows, { format: money });
    });

    return `${title('Revenue', opts.sub || 'Every euro across software, services, products and affiliate, read from HighLevel payments and Stripe.', (opts.actions || '') + U.seg('rev', n, [[3, '3 months'], [6, '6 months'], [12, '12 months']]))}${opts.note || ''}
    ${kpis([opts.monthly ? { label: 'Per month', value: money(St.sum(months.slice(-3), (m) => m.total) / 3), delta: 'Last 3 months · ' + money(St.total(r.cur)) + ' over ' + n } : { label: 'Revenue, ' + n + ' months', value: money(St.total(r.cur)), delta: n < 12 ? change(St.total(r.cur), St.total(r.prev)) + ' vs the ' + n + ' before' : 'Since 5 Nov 2025' }, ...STREAMS.map((s) => ({ label: s.name, dot: shade[s.id], value: money(r.cur[s.id]), delta: pct(r.cur[s.id] / St.total(r.cur)) + ' of total' })), { label: 'Software MRR', value: money(mrr), delta: health.filter((h) => h.mrr).length + ' active clients' }])}
    <section class="panel" style="margin-top:var(--gap)"><header><h2>By stream, per month</h2><div class="actions"><span id="rev-legend"></span>${U.seg('revStream', sel, [['all', 'All'], ...STREAMS.map((s) => [s.id, s.name])])}</div></header><div id="rev-line"></div></section>
    <div class="grid2" style="margin-top:var(--gap)">
      <section class="panel"><header><h2>By offer</h2><span class="meta">${n} months</span></header><div id="rev-offers"></div></section>
      <section class="panel"><header><h2>By source</h2><span class="meta">Where the buyer first came from</span></header><div id="rev-sources"></div></section>
    </div>
    <h2 class="dept">Winners across streams</h2>
    <div class="grid3">
      <section class="panel"><header><h2>Videos</h2><span class="meta">vs the average video</span></header><div class="rows">${winV.map((w) => `<div class="row"><div class="grow"><div class="t">${vid(w.v.id)}</div><div class="s">${money(w.rev)} · ${int(w.v.views)} views</div></div><span class="pill acc">${(w.rev / avgV).toFixed(1)}x</span></div>`).join('')}</div></section>
      <section class="panel"><header><h2>Offers</h2><span class="meta">vs the average offer</span></header><div class="rows">${offers.slice(0, 4).map((o) => `<div class="row"><div class="grow"><div class="t">${esc(o.name)}</div><div class="s">${money(o.rev12)} · ${o.buyers} buyers</div></div><span class="pill acc">${(o.rev12 / avgO).toFixed(1)}x</span></div>`).join('')}</div></section>
      <section class="panel"><header><h2>Contacts</h2><span class="meta">Lifetime value vs average</span></header><div class="rows">${winC.map((c) => `<div class="row"><div class="grow"><div class="t">${who(c.id)}</div><div class="s">${money(c.ltv)} · ${c.roles.map(sname).join(', ')}</div></div><span class="pill acc">${(c.ltv / avgC).toFixed(1)}x</span></div>`).join('')}</div></section>
    </div>
    <section class="panel" style="margin-top:var(--gap)"><header><h2>Client health</h2><span class="meta">Software and service clients, lowest first · Client Health agent, daily 06:00</span></header>
      <div class="table-wrap"><table><thead><tr><th>Client</th><th>Plan</th><th class="n">Health</th><th class="n">Logins, 30 d</th><th>Flags</th><th>Upsell</th></tr></thead><tbody>
      ${health.slice(0, 14).map((h) => `<tr><td>${who(h.c.id)}<span class="sub">${esc(h.c.company)}</span></td><td class="muted">${h.c.saas && !h.c.saas.churnAt ? St.offerById[h.c.saas.plan].name.split(', ')[1] + ' · ' + money(h.mrr) : 'Services'}</td><td class="n"><span class="hbar"><span style="width:${h.health}%" class="${h.health < 45 ? 'bad' : h.health < 65 ? 'mid' : ''}"></span></span>${h.health}</td><td class="n">${h.c.saas ? h.c.logins30 : U.MINUS}</td><td>${h.flags.map((f) => `<span class="pill ${/Low|Quiet/.test(f) ? 'warn' : ''}">${f}</span>`).join(' ') || '<span class="meta">None</span>'}</td><td>${h.upsell ? `<span class="pill acc">${h.upsell}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="panel" style="margin-top:var(--gap)"><header><h2>Per month</h2><span class="meta">${opts.unit || 'Euros'}</span></header>
      <div class="table-wrap"><table><thead><tr><th>Month</th>${STREAMS.map((s) => `<th class="n">${s.name}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>
      ${[...months].reverse().map((m) => `<tr><td>${m.label}</td>${STREAMS.map((s) => `<td class="n">${money(m[s.id])}</td>`).join('')}<td class="n"><b>${money(m.total)}</b></td></tr>`).join('')}
      <tr class="tot"><td>Total</td>${STREAMS.map((s) => `<td class="n">${money(St.sum(months, (m) => m[s.id]))}</td>`).join('')}<td class="n"><b>${money(St.sum(months, (m) => m.total))}</b></td></tr>
      </tbody></table></div></section>`;
  };

  /* ---------- Calls ---------- */
  const callTargets = { talk: [45, 'Talk under 45%'], questions: [8, '8 or more questions'], silence: [3, '3 s silence after price'] };
  V.calls = () => {
    const tab = VS.callsTab;
    const past = SEED.pastCalls;
    const avg = (k) => St.sum(past, (p) => p[k]) / past.length;
    const won = past.filter((p) => p.outcome === 'won');
    const metrics = St.s.metrics;
    U.after(() => metrics.forEach((m) => { const el = U.$('#met-' + m.id); if (el && m.values.length) C.bars(el, { labels: m.values.map((_, i) => 'Call ' + (i + 1)), values: m.values, height: 110, highlight: m.values.length - 1, format: (v) => v.toFixed(1) + ' ' + m.unit }); }));
    return `${title('Calls', 'Every call gets a dossier before and a coach after. Recordings come from HighLevel and Zoom.', U.seg('callsTab', tab, [['upcoming', 'Upcoming ' + SEED.upcoming.length], ['past', 'Graded ' + past.length]]))}
    ${kpis([{ label: 'Close rate, 30 days', value: pct(won.length / past.length), delta: won.length + ' of ' + past.length + ' calls won' }, { label: 'Pipeline booked', value: eur(St.sum(SEED.upcoming, (u) => u.value)), delta: SEED.upcoming.length + ' upcoming calls' }, { label: 'You talk', value: Math.round(avg('talk')) + '%', delta: 'Target under 45%' }, { label: 'Silence after price', value: avg('silence').toFixed(1) + ' s', delta: 'Target 3 s or more' }, { label: 'Coach score', value: avg('score').toFixed(1), delta: 'Call rubric, out of 10' }])}
    <div class="layout" style="margin-top:var(--gap)"><div class="stack">
    ${tab === 'upcoming' ? `<section class="panel"><header><h2>Upcoming</h2><span class="meta">Dossiers written 2 hours before each call</span></header><div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Call</th><th class="n">Value</th><th></th></tr></thead><tbody>
      ${SEED.upcoming.map((u) => `<tr><td>${u.day === T ? 'Today' : u.day === T + 1 ? 'Tomorrow' : St.fmtDay(u.day)}<span class="sub">${u.time}</span></td><td>${who(u.contactId)}<span class="sub">${esc(St.contactById[u.contactId].company)}</span></td><td>${esc(u.kind)}<span class="sub">${sname(u.stream)}</span></td><td class="n">${eur(u.value)}</td><td class="n"><button class="btn sm" data-action="dossier" data-id="${u.id}">Dossier</button></td></tr>`).join('')}
      </tbody></table></div></section>`
    : `<section class="panel"><header><h2>Graded by Call Coach</h2><span class="meta">Orange marks a miss against your target</span></header><div class="table-wrap"><table><thead><tr><th>Call</th><th class="n">Talk</th><th class="n">Questions</th><th class="n">Silence</th><th>Discount</th><th>Next step</th><th>Outcome</th><th class="n">Score</th></tr></thead><tbody>
      ${past.map((p) => `<tr class="click" data-action="coach" data-id="${p.id}"><td>${who(p.contactId)}<span class="sub">${esc(p.kind)} · ${St.fmtDay(p.day)}</span></td><td class="n ${p.talk > 45 ? 'miss' : ''}">${p.talk}%</td><td class="n ${p.questions < 8 ? 'miss' : ''}">${p.questions}</td><td class="n ${p.silence < 3 ? 'miss' : ''}">${p.silence.toFixed(1)} s</td><td>${p.discount ? '<span class="pill warn">Offered</span>' : '<span class="meta">No</span>'}</td><td>${p.nextStep ? '<span class="pill pos">Set</span>' : '<span class="pill warn">Missing</span>'}</td><td>${p.outcome === 'won' ? '<span class="pill pos">Won</span>' : p.outcome === 'lost' ? '<span class="pill neg">Lost</span>' : '<span class="pill">Open</span>'}</td><td class="n"><b>${p.score.toFixed(1)}</b></td></tr>`).join('')}
      </tbody></table></div></section>`}
    </div><aside class="rail">
      <h2 class="out">Tracked on every call</h2>
      ${metrics.map((m) => `<section class="panel"><header><h2>${esc(m.name)}</h2><span class="meta">${esc(m.target)}</span></header>${m.values.length ? `<div id="met-${m.id}"></div>` : '<p class="meta">Starts with your next graded call.</p>'}</section>`).join('')}
      <section class="panel"><p class="muted">Call Coach can track anything it hears. Pick a metric from a graded call, or write your own.</p><div class="actions" style="margin-top:12px"><button class="btn sm" data-action="track-new">Track a new metric</button></div></section>
    </aside></div>`;
  };
  ACT['track-new'] = async () => {
    const r = await U.dialog({ title: 'Track a new call metric', body: 'Call Coach will score this on every graded call from now on.', fields: [{ name: 'name', label: 'What to track', required: true, placeholder: 'Asks for the budget before the price' }, { name: 'target', label: 'Target', placeholder: 'Every call', value: 'Every call' }], ok: 'Start tracking' });
    if (!r) return; St.A.trackMetric(r.name, r.target, ''); U.toast('Call Coach now tracks: ' + r.name); window.App.render();
  };

  function callFlags(p) {
    const f = [];
    if (p.talk > 45) f.push(['Talk ratio', p.talk + '% of the call was you. Ask one more question before each answer.', 'Talk under 45%']);
    if (p.questions < 8) f.push(['Questions', 'Only ' + p.questions + ' questions. Your won calls average 10.', '8 or more questions']);
    if (p.silence < 3) f.push(['Silence after price', p.silence.toFixed(1) + ' seconds before you kept talking. Hold for 3.', 'Silence after price']);
    if (p.discount) f.push(['Discount', 'Offered a discount before an objection came up.', 'No discount before an objection']);
    if (!p.nextStep) f.push(['Next step', 'The call ended without a booked next step.', 'Book the next step on the call']);
    return f;
  }
  ACT.coach = (el) => {
    const p = SEED.pastCalls.find((x) => x.id === el.dataset.id); const c = St.contactById[p.contactId];
    const flags = callFlags(p);
    U.drawer(`<div><p class="meta">Call Coach · ${St.fmtDay(p.day)} · ${p.minutes} min</p><h2>${esc(p.kind)} with ${who(c.id)}</h2></div>
      <div class="kv4"><div><span>Score</span><b>${p.score.toFixed(1)}</b></div><div><span>Talk</span><b class="${p.talk > 45 ? 'miss' : ''}">${p.talk}%</b></div><div><span>Questions</span><b class="${p.questions < 8 ? 'miss' : ''}">${p.questions}</b></div><div><span>Silence</span><b class="${p.silence < 3 ? 'miss' : ''}">${p.silence.toFixed(1)} s</b></div></div>
      <div class="dsec"><h3>What to change</h3>${flags.length ? flags.map(([h, t, metric]) => `<div class="flag"><div><b>${h}</b><p class="muted">${t}</p></div><button class="btn sm" data-action="track-metric" data-name="${esc(metric)}">Track this on every call</button></div>`).join('') : '<p class="muted">Clean call. Nothing to change.</p>'}</div>
      <div class="dsec"><h3>Moments</h3><div class="rows">
        <div class="row"><span class="time">04:12</span><div class="grow wrap">Asked about their current site and who maintains it.</div></div>
        <div class="row"><span class="time">${String(Math.round(p.minutes * 0.6)).padStart(2, '0')}:30</span><div class="grow wrap">Price stated: ${eur(p.value)}. ${p.silence < 3 ? 'You filled the silence after ' + p.silence.toFixed(1) + ' s.' : 'You held the silence.'}</div></div>
        <div class="row"><span class="time">${String(p.minutes - 3).padStart(2, '0')}:05</span><div class="grow wrap">${p.nextStep ? 'Booked the next step in HighLevel calendar.' : 'Ended with "I will send you something".'}</div></div>
      </div></div>
      <p class="evidence">Graded against your Call rubric in the Brain. Transcript from Zoom.</p>`, { label: 'Call coach' });
  };
  ACT['track-metric'] = (el) => {
    const name = el.dataset.name;
    if (St.s.metrics.some((m) => m.name === name)) return U.toast('Already tracked on every call');
    St.A.trackMetric(name, 'Every call', ''); el.textContent = 'Tracked'; el.disabled = true; U.toast('Call Coach now tracks: ' + name);
  };

  ACT.dossier = (el) => {
    const u = SEED.upcoming.find((x) => x.id === el.dataset.id); const c = St.contactById[u.contactId];
    const tl = St.contactTimeline(c.id).slice(0, 5);
    const reads = St.contactRead(c);
    const pitch = c.roles.includes('software') ? 'They already pay for the software. Lead with the build plus hosting so the site lives on their plan.' : c.roles.includes('products') ? 'They bought a product. Bridge to the next rung: Coaching at 1,997 or the Workshop.' : 'New relationship. Diagnose first, quote only after they name the cost of doing nothing.';
    U.drawer(`<div><p class="meta">Pre-Call Dossier · ${u.day === T ? 'Today' : St.fmtDay(u.day)} at ${u.time}</p><h2>${esc(u.kind)}</h2><p class="muted" style="margin-top:4px">${who(c.id)} · ${esc(c.company)} · ${esc(c.country)}</p></div>
      <div class="kv4"><div><span>Deal value</span><b>${eur(u.value)}</b></div><div><span>Lifetime</span><b>${eur(c.ltv)}</b></div><div><span>Videos watched</span><b>${c.watchCount}</b></div><div><span>Health</span><b>${c.health}</b></div></div>
      <p class="evidence">${esc(u.note)}</p>
      <div class="dsec"><h3>Read</h3>${reads.map((r) => `<p class="read ${r.tone}">${esc(r.text)}</p>`).join('') || '<p class="muted">No signals yet.</p>'}</div>
      <div class="dsec"><h3>Angle for this call</h3><p>${esc(pitch)}</p></div>
      <div class="dsec"><h3>Questions to ask</h3><ol class="qs"><li>What does a new client cost you to get today?</li><li>Who touches the website now, and how often?</li><li>If this worked, what would you stop doing?</li><li>What would make this a no?</li></ol></div>
      <div class="dsec"><h3>Recent history</h3><div class="rows">${tl.map(tlRow).join('')}</div></div>
      <div class="actions"><button class="btn primary" data-action="contact" data-id="${c.id}" data-push="1">Full contact</button><button class="btn" data-action="hl" data-what="appointment">Open in HighLevel</button></div>`, { label: 'Pre-call dossier' });
  };

  const tlIcon = { money: 'revenue', call: 'calls', next: 'calls', video: 'brand' };
  const tlRow = (i) => `<div class="row tl"><span class="tli">${icon(tlIcon[i.kind])}</span><div class="grow"><div class="t wrap">${i.kind === 'video' ? `<button class="lnk" data-action="video" data-id="${i.ref}" data-push="1">${esc(i.text)}</button>` : esc(i.text)}${i.count ? ' · ' + i.count + ' payouts' : ''}</div><div class="s">${i.day >= T ? (i.day === T ? 'Today' : St.fmtDay(i.day)) : St.fmtDay(i.day)}${i.stream ? ' · ' + sname(i.stream) : ''}</div></div>${i.amount ? `<span class="num right">${eur(i.amount)}</span>` : ''}</div>`;

  ACT.contact = (el) => {
    const c = St.contactById[el.dataset.id]; if (!c) return;
    const tl = St.contactTimeline(c.id);
    const reads = St.contactRead(c);
    const by = Object.entries(c.ltvBy).sort((a, b) => b[1] - a[1]);
    const notes = St.s.notes[c.id] || [];
    U.drawer(`<div class="chead"><span class="avatar lg">${U.initials(c.name)}</span><div><h2>${esc(c.name)}</h2><p class="muted">${esc(c.company)} · ${esc(c.country)} · ${esc(c.email)}</p></div></div>
      <div class="tags">${c.roles.map((r) => `<span class="pill" style="--sw:${shade[r]}"><span class="sw" style="background:${shade[r]}"></span>${sname(r)}</span>`).join('')}<span class="pill out">Source: ${esc(c.source)}</span></div>
      <div class="kv4"><div><span>Lifetime value</span><b>${eur(c.ltv)}</b></div><div><span>Health</span><b>${c.health}</b></div><div><span>First seen</span><b>${St.fmtDay(c.firstDay)}</b></div><div><span>Last active</span><b>${c.lastDay >= T - 1 ? 'Yesterday' : St.fmtDay(c.lastDay)}</b></div></div>
      <div class="dsec"><h3>AI read</h3>${reads.map((r) => `<p class="read ${r.tone}">${esc(r.text)}</p>`).join('') || '<p class="muted">Not enough activity to read yet.</p>'}</div>
      ${by.length ? `<div class="dsec"><h3>Value by stream</h3>${by.map(([s, v]) => `<div class="sbar"><span>${sname(s)}</span><span class="track"><span class="fill" style="width:${(v / c.ltv) * 100}%;background:${shade[s]}"></span></span><span class="v">${eur(v)}</span></div>`).join('')}</div>` : ''}
      ${c.missing.length ? `<div class="dsec"><h3>Missing in HighLevel</h3><p class="muted">${c.missing.join(', ')}. Enricher can fill these from the website and LinkedIn.</p><button class="btn sm" data-action="enrich" data-id="${c.id}">Ask Enricher</button></div>` : ''}
      <div class="dsec"><h3>Timeline</h3><div class="rows">${tl.slice(0, 12).map(tlRow).join('')}</div></div>
      <div class="dsec"><h3>Notes</h3>${notes.map((n) => `<p class="note"><span class="meta">${n.at}</span> ${esc(n.text)}</p>`).join('')}<form class="inline" data-form="note" data-id="${c.id}"><input name="note" placeholder="Add a note for HighLevel" aria-label="Note" required><button class="btn sm">Add</button></form></div>
      <div class="actions"><button class="btn" data-action="hl" data-what="contact ${esc(c.hlId)}">${icon('out')}Open in HighLevel</button></div>`, { label: 'Contact', push: el.dataset.push === '1' || U.$('#drawer').classList.contains('open') });
  };
  ACT.enrich = (el) => { const c = St.contactById[el.dataset.id]; St.log('Enricher queued', c.name + ' · ' + c.missing.join(', '), 'agent', 'OS'); el.disabled = true; el.textContent = 'Queued for tonight'; U.toast('Enricher will fill ' + c.missing.join(', ') + ' tonight'); };
  ACT.hl = (el) => { St.log('Opened HighLevel', el.dataset.what + ' · demo deep link', 'system'); U.toast('In live mode this opens the ' + el.dataset.what.split(' ')[0] + ' in HighLevel'); };
  V.tlRow = tlRow;

  /* ---------- Approvals ---------- */
  V.approvals = () => {
    const all = St.s.approvals;
    const list = all.filter((a) => (VS.apKind === 'all' || a.kind === VS.apKind) && (VS.apStream === 'all' || a.stream === VS.apStream));
    const a = list.find((x) => x.id === VS.approval) || list[0];
    if (a) VS.approval = a.id;
    const kinds = [...new Set(all.map((x) => x.kind))];
    const head = title('Approvals', 'Nothing leaves the OS without you. Approved items go to HighLevel as drafts or scheduled sends.', `<span class="meta">${St.s.history.approved} approved · ${St.s.history.rejected} rejected this month</span>`);
    if (!all.length) return head + `<section class="panel">${U.empty('All clear', 'Every draft has been reviewed. New ones arrive as agents run.', '<a class="btn" href="#agents">See agents</a>')}</section>`;
    const filt = `<div class="filters"><label class="sel"><span>Kind</span><select data-action="filter" data-key="apKind"><option value="all">All kinds</option>${kinds.map((k) => `<option ${VS.apKind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="sel"><span>Stream</span><select data-action="filter" data-key="apStream"><option value="all">All streams</option>${STREAMS.map((s) => `<option value="${s.id}" ${VS.apStream === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label></div>`;
    let detail = U.empty('Nothing matches', 'Clear a filter to see the rest of the queue.');
    if (a) {
      const rb = St.s.brain.rubrics.find((r) => r.id === a.rubric);
      const sc = avgScore(a); const min = rb ? rb.min : 8;
      detail = `<header><div><p class="meta">${a.kind} · drafted by ${(St.s.agents.find((g) => g.id === a.agent) || { name: a.agent }).name} · ${sname(a.stream)}</p><h2 style="font-size:18px;margin-top:4px">${esc(a.title)}</h2></div>${a.scores.length ? `<span class="pill ${sc >= min ? 'pos' : 'warn'}">${sc.toFixed(1)} of 10</span>` : '<span class="pill">Data change</span>'}</header>
        <p class="meta" style="margin-bottom:8px">On approve: ${esc(a.action)}${a.contactId ? ' · ' + who(a.contactId) : ''}</p>
        ${VS.editing ? `<textarea class="editor" id="ap-edit" aria-label="Edit draft">${esc(a.body)}</textarea>` : `<div class="well doc">${esc(a.body)}</div>`}
        <div class="grid2" style="margin-top:18px">
          <div><p class="meta" style="margin-bottom:10px">${rb ? rb.applies + ' rubric · minimum ' + rb.min.toFixed(1) : a.kind === 'Field update' ? 'No rubric. Field updates are checked against HighLevel before they write.' : 'No rubric. Approving saves the plan, nothing is sent.'}</p><div class="score-bars">${(rb ? rb.criteria : []).map(([l, w], i) => { const v = a.scores[i] || 0; return `<div class="sbar wide ${v < min ? 'low' : ''}"><span>${l}<span class="meta"> · ${Math.round(w * 100)}%</span></span><span class="track"><span class="fill" style="width:${v * 10}%"></span></span><span class="v">${v.toFixed(1)}</span></div>`; }).join('')}</div>${rb && rb.criteria.some((_, i) => a.scores[i] < min) ? `<p class="miss-note">Below your minimum on ${rb.criteria.filter((_, i) => a.scores[i] < min).map((c) => c[0].toLowerCase()).join(', ')}.</p>` : ''}</div>
          <div><p class="meta" style="margin-bottom:10px">Source context</p><p class="evidence">${esc(a.evidence)}</p>${a.antithesis ? '<p class="meta" style="margin-top:8px">Uses its one allowed contrarian line.</p>' : ''}</div>
        </div>
        <div class="actions" style="margin-top:22px">${VS.editing ? `<button class="btn primary" data-action="ap-save" data-id="${a.id}">Save and approve</button><button class="btn" data-action="ap-cancel">Cancel</button>` : `<button class="btn primary" data-action="approve" data-id="${a.id}">Approve</button><button class="btn" data-action="ap-edit">Edit</button><button class="btn ghost" data-action="reject" data-id="${a.id}">Reject with reason</button>`}</div>`;
    }
    return `${head}${filt}<div class="split-view">
      <section class="panel tight queue"><div class="rows">${list.map((x) => `<div class="row" role="button" tabindex="0" data-action="pick-approval" data-id="${x.id}" aria-selected="${a && x.id === a.id}"><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${x.kind} · ${sname(x.stream)} · ${x.age === 'now' ? 'just now' : x.age + ' ago'}</div></div><span class="num right ${x.scores.length && avgScore(x) < 8 ? 'miss' : ''}">${fmtScore(x)}</span></div>`).join('') || '<p class="meta" style="padding:16px 0">Nothing matches these filters.</p>'}</div></section>
      <section class="panel">${detail}</section></div>`;
  };
  ACT['pick-approval'] = (el) => { VS.approval = el.dataset.id; VS.editing = false; window.App.render(); };
  ACT['go-approval'] = (el) => { VS.approval = el.dataset.id; VS.apKind = 'all'; VS.apStream = 'all'; VS.editing = false; U.closeDrawer(); location.hash = '#approvals'; window.App.render(); };
  ACT['ap-edit'] = () => { VS.editing = true; window.App.render(); const t = U.$('#ap-edit'); t && t.focus(); };
  ACT['ap-cancel'] = () => { VS.editing = false; window.App.render(); };
  const afterDecision = (id) => { const i = St.s.approvals.findIndex((x) => x.id === id); return (St.s.approvals[i + 1] || St.s.approvals[i - 1] || {}).id; };
  ACT['ap-save'] = (el) => { const body = U.$('#ap-edit').value; const next = afterDecision(el.dataset.id); St.A.approve(el.dataset.id, body); VS.approval = next; VS.editing = false; U.toast('Approved with your edits. The edit trains the rubric.'); window.App.render(); };
  ACT.approve = (el) => { const next = afterDecision(el.dataset.id); const a = St.A.approve(el.dataset.id); VS.approval = next; U.toast('Approved. ' + a.action + ' (simulated)'); window.App.render(); };
  ACT.reject = async (el) => {
    const r = await U.dialog({ title: 'Why not?', body: 'The reason goes into the Brain so the next draft avoids it.', fields: [{ name: 'quick', label: 'Quick reasons', type: 'chips', options: ['Not my voice', 'Wrong offer', 'Too long', 'Bad timing', 'Facts are off'] }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, rows: 3 }], ok: 'Reject' });
    if (!r) return; const next = afterDecision(el.dataset.id); St.A.reject(el.dataset.id, r.reason); VS.approval = next; U.toast('Rejected. Saved to Brain decisions.'); window.App.render();
  };
})();

// Founder OS store: in-memory state over the seed, derived metrics and simulated write-backs.
// Nothing persists between reloads by design (the preview host blocks browser storage).
(() => {
  const SEED = window.SEED;
  const T = SEED.TODAY;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const sum = (arr, f = (e) => e.amount) => arr.reduce((a, e) => a + f(e), 0);
  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const contactById = byId(SEED.contacts);
  const videoById = byId(SEED.videos);
  const streamById = byId(SEED.STREAMS);
  const offerById = SEED.offerById;

  let st, seq = 1000;
  const uid = (p) => p + (++seq);
  const nowLabel = () => { const d = new Date(); return '4 Nov ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function init() {
    st = {
      ideas: clone(SEED.ideas),
      approvals: clone(SEED.approvals),
      agents: clone(SEED.agents),
      runs: clone(SEED.runs),
      brain: clone(SEED.brain),
      metrics: clone(SEED.metrics),
      audit: clone(SEED.audit),
      funnels: clone(SEED.funnels),
      offerDrafts: clone(SEED.offerDrafts),
      sources: clone(SEED.sources),
      writing: clone(SEED.writing || []),
      packages: [],
      history: { approved: 41, rejected: 6, edited: 9 },
      notes: {},
      settings: {
        name: 'Avery Cole', email: 'avery@example.com', workspace: 'Northpeak Studio', tz: 'Europe/Berlin',
        briefing: '07:00', ideation: '02:00', digest: 'Friday 16:00',
        rules: { noDash: true, noHype: true, oneCta: true, antithesis: true, numbersFirst: false },
        approval: { emailMin: 8, scriptMin: 8, autoSchedule: false, twoStepOffers: true },
        connections: [
          { id: 'hl', name: 'HighLevel', how: 'Private Integration Token, sub-account scope', status: 'demo' },
          { id: 'yt', name: 'YouTube', how: 'OAuth, Analytics and comments read-only', status: 'demo' },
          { id: 'stripe', name: 'Stripe', how: 'Restricted key, read-only', status: 'demo' },
          { id: 'apify', name: 'Apify', how: 'API token for competitor channels', status: 'demo' },
          { id: 'claude', name: 'Claude', how: 'API key for every agent', status: 'demo' },
        ],
      },
    };
    // three draft packages exist already, built from live offers
    st.packages.push(makePackage({ id: 'o-kit', name: 'App Builder Kit', price: 497, stream: 'products', promise: 'Build a client-ready AI Studio app in a weekend.', guarantee: '30-day refund if you build nothing.' }, 'Live in HighLevel', 'f3'));
    st.packages[0].created = '12 Sep'; st.packages[0].checklist.forEach((c) => { c[1] = true; });
  }

  /* ---------- revenue ---------- */
  const evIn = (from, to, f) => SEED.events.filter((e) => e.day >= from && e.day <= to && (!f || f(e)));
  const byStream = (evs) => { const o = { software: 0, services: 0, products: 0, affiliate: 0 }; evs.forEach((e) => { o[e.stream] += e.amount; }); return o; };
  const range = (days) => { const to = T - 1, from = T - days; return { cur: byStream(evIn(from, to)), prev: byStream(evIn(from - days, from - 1)) }; };
  const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthly(n) {
    const keys = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(2026, 9 - i, 1)); keys.push(d.toISOString().slice(0, 7)); }
    const out = keys.map((k) => ({ key: k, label: MONTHS[+k.slice(5) - 1] + (k.endsWith('-01') ? ' ' + k.slice(2, 4) : ''), software: 0, services: 0, products: 0, affiliate: 0 }));
    const ix = Object.fromEntries(keys.map((k, i) => [k, i]));
    SEED.events.forEach((e) => { const i = ix[e.date.slice(0, 7)]; if (i != null) out[i][e.stream] += e.amount; });
    out.forEach((m) => { m.total = m.software + m.services + m.products + m.affiliate; });
    return out;
  }
  function daily(days, stream) {
    const out = [];
    for (let d = T - days; d < T; d++) out.push({ day: d, label: fmtDay(d), value: sum(SEED.events.filter((e) => e.day === d && (!stream || e.stream === stream))) });
    return out;
  }
  const fmtDay = (d) => { const x = SEED.dateOf(d); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; };

  const videoRev = {}, videoBuyers = {};
  SEED.events.forEach((e) => { if (e.videoId) { videoRev[e.videoId] = (videoRev[e.videoId] || 0) + e.amount; (videoBuyers[e.videoId] = videoBuyers[e.videoId] || new Set()).add(e.contactId); } });
  function videoStats(v) {
    const evs = SEED.events.filter((e) => e.videoId === v.id);
    const buyers = videoBuyers[v.id] ? videoBuyers[v.id].size : 0;
    const contacts = SEED.contacts.filter((c) => c.firstVideo === v.id || c.lastVideo === v.id);
    const calls = SEED.pastCalls.filter((c) => contacts.some((x) => x.id === c.contactId)).length + SEED.upcoming.filter((c) => contacts.some((x) => x.id === c.contactId)).length;
    return { revenue: videoRev[v.id] || 0, buyers, byStream: byStream(evs), contacts, calls, engagement: (v.likes + v.comments) / Math.max(1, v.views) };
  }

  function offerPerf() {
    return SEED.OFFERS.map((o) => {
      const all = SEED.events.filter((e) => e.offerId === o.id);
      const l30 = all.filter((e) => e.day >= T - 30);
      const p30 = all.filter((e) => e.day >= T - 60 && e.day < T - 30);
      return { ...o, rev12: sum(all), rev30: sum(l30), prev30: sum(p30), buyers30: new Set(l30.map((e) => e.contactId)).size, buyers: new Set(all.map((e) => e.contactId)).size };
    }).sort((a, b) => b.rev12 - a.rev12);
  }
  function bySource(days) {
    const o = {};
    evIn(T - days, T - 1).forEach((e) => { o[e.source] = (o[e.source] || 0) + e.amount; });
    return Object.entries(o).sort((a, b) => b[1] - a[1]);
  }

  /* ---------- contacts ---------- */
  function contactTimeline(id) {
    const c = contactById[id]; const items = [];
    SEED.events.filter((e) => e.contactId === id).forEach((e) => items.push({ day: e.day, kind: 'money', stream: e.stream, text: (offerById[e.offerId] || {}).name + (e.note ? ' · ' + e.note : ''), amount: e.amount }));
    SEED.pastCalls.filter((p) => p.contactId === id).forEach((p) => items.push({ day: p.day, kind: 'call', stream: p.stream, text: p.kind + ' · ' + p.minutes + ' min · ' + p.outcome, ref: p.id }));
    SEED.upcoming.filter((p) => p.contactId === id).forEach((p) => items.push({ day: p.day, kind: 'next', stream: p.stream, text: p.kind + ' at ' + p.time, ref: p.id }));
    if (c.firstVideo) { const v = videoById[c.firstVideo]; items.push({ day: Math.max(v.day, c.firstDay - 2), kind: 'video', text: 'Watched ' + v.title, ref: v.id }); }
    if (c.lastVideo) { const v = videoById[c.lastVideo]; items.push({ day: v.day + 1, kind: 'video', text: 'Watched ' + v.title, ref: v.id }); }
    // collapse monthly SaaS rows into one per plan
    const out = []; let saasCount = 0, saasLast = null;
    items.sort((a, b) => b.day - a.day).forEach((i) => {
      if (i.kind === 'money' && i.stream === 'software' && /Monthly/.test(i.text)) { saasCount++; if (!saasLast) { saasLast = i; out.push(i); } return; }
      if (i.kind === 'money' && i.stream === 'affiliate' && out.some((o) => o.stream === 'affiliate' && o.kind === 'money')) { const a = out.find((o) => o.stream === 'affiliate' && o.kind === 'money'); a.count = (a.count || 1) + 1; return; }
      out.push(i);
    });
    if (saasLast && saasCount > 1) saasLast.text += ' · ' + saasCount + ' payments';
    return out;
  }
  function contactRead(c) {
    const out = [];
    if (c.saas && !c.saas.churnAt) {
      if (c.logins30 < 4) out.push({ tone: 'neg', text: 'Momentum dropping. ' + c.logins30 + ' logins in 30 days on ' + offerById[c.saas.plan].name + '.' });
      else if (c.saas.mrr < 297 && c.logins30 > 14) out.push({ tone: 'pos', text: 'Ready for a SaaS upgrade. Heavy use on the ' + offerById[c.saas.plan].name.split(', ')[1] + ' plan.' });
      else out.push({ tone: '', text: 'Steady SaaS client. ' + c.logins30 + ' logins in 30 days.' });
    }
    if (c.saas && c.saas.churnAt) out.push({ tone: 'warn', text: 'Cancelled SaaS on ' + fmtDay(c.saas.churnAt) + '. Worth a win-back once the next feature ships.' });
    if (c.roles.includes('products') && !c.roles.includes('software')) out.push({ tone: 'acc', text: 'Product buyer with no software yet. Fits the Launch Workshop segment.' });
    if (c.roles.includes('affiliate') && c.roles.length === 1) out.push({ tone: '', text: 'Joined HighLevel through your link. Never bought from you directly.' });
    if (T - c.lastDay > 60) out.push({ tone: 'warn', text: 'No activity in ' + (T - c.lastDay) + ' days.' });
    if (c.watchCount >= 4) out.push({ tone: 'pos', text: 'Watched ' + c.watchCount + ' of your videos. High intent.' });
    return out.slice(0, 3);
  }
  function clientHealth() {
    return SEED.contacts.filter((c) => (c.saas && !c.saas.churnAt) || (c.roles.includes('services') && c.lastDay > T - 120)).map((c) => {
      const flags = [];
      if (c.saas && !c.saas.churnAt && c.logins30 < 4) flags.push('Low logins');
      if (c.missing.length) flags.push('Missing ' + c.missing[0]);
      if (T - c.lastDay > 40) flags.push('Quiet ' + (T - c.lastDay) + ' d');
      const upsell = c.saas && c.saas.mrr < 297 && c.logins30 > 14 ? 'Upgrade to ' + (c.saas.mrr === 97 ? 'Growth' : 'Pro') : !c.saas && c.roles.includes('services') ? 'Hosting on SaaS plan' : '';
      return { c, health: c.health, flags, upsell, mrr: c.saas && !c.saas.churnAt ? c.saas.mrr : 0 };
    }).sort((a, b) => a.health - b.health);
  }
  function stalledDeals() {
    return SEED.contacts.filter((c) => c.roles.includes('services') && T - c.lastDay > 20 && T - c.lastDay < 120).slice(0, 6).map((c, i) => ({
      c, value: [2500, 6000, 3500, 2500, 6000, 1997][i], stage: ['Proposal sent', 'Call booked, no-show', 'Proposal sent', 'Waiting on content', 'Verbal yes', 'Follow-up due'][i], days: T - c.lastDay,
    }));
  }
  const hotContacts = () => SEED.contacts.filter((c) => c.watchCount >= 3 && T - c.lastDay < 14).sort((a, b) => (b.watchCount + (14 - (T - b.lastDay)) * 2) - (a.watchCount + (14 - (T - a.lastDay)) * 2) || b.ltv - a.ltv).slice(0, 8);

  /* ---------- agents and score ---------- */
  function agentStats(a) {
    const r = st.runs.filter((x) => x.agent === a.id && x.day >= T - 30);
    return { runs: r.length, spent: sum(r, (x) => x.cost), saved: sum(r, (x) => x.minutes) / 60, avg: (() => { const g = r.filter((x) => x.score != null); return g.length ? sum(g, (x) => x.score) / g.length : null; })(), last: st.runs.find((x) => x.agent === a.id), fails: r.filter((x) => x.status !== 'ok').length };
  }
  function agentTotals() {
    const all = st.agents.map((a) => ({ a, ...agentStats(a) }));
    return { all, hours: sum(all, (x) => x.saved), spent: sum(all, (x) => x.spent), runs: sum(all, (x) => x.runs), look: all.filter((x) => x.a.status !== 'ok' || x.fails > 2).length };
  }
  function score() {
    const brain = Math.min(1, 0.7 + 0.06 * (SEED.brain.gaps.length - st.brain.gaps.length) + 0.008 * st.brain.decisions.length);
    const val = { green: 1, orange: 0.5, red: 0 };
    const data = sum(st.sources, (s) => val[s.status]) / st.sources.length;
    const live = st.agents.filter((a) => !a.paused && a.status === 'ok').length / st.agents.length;
    const h = st.history; const appr = h.approved / Math.max(1, h.approved + h.rejected);
    const hours = Math.min(1, agentTotals().hours / 200);
    const parts = [
      { id: 'brain', label: 'Brain coverage', v: brain, next: st.brain.gaps.length ? 'Answer ' + st.brain.gaps.length + ' interview questions in Brain' : 'Brain is complete for now', go: 'brain' },
      { id: 'data', label: 'Data coverage', v: data, next: st.sources.filter((s) => s.status !== 'green').length + ' feeds need a fix in Data', go: 'data' },
      { id: 'agents', label: 'Agents live', v: live, next: st.agents.filter((a) => a.paused || a.status !== 'ok').map((a) => a.name).join(', ') + ' need a look' || 'All agents healthy', go: 'agents' },
      { id: 'appr', label: 'Approval rate', v: appr, next: 'Approve or edit the ' + st.approvals.length + ' waiting items', go: 'approvals' },
      { id: 'hours', label: 'Hours saved', v: hours, next: Math.round(agentTotals().hours) + ' of 200 hours a month. Turn on Repurposer for every video', go: 'agents' },
    ];
    if (!st.agents.some((a) => a.paused || a.status !== 'ok')) parts[2].next = 'All agents healthy';
    return { parts, total: Math.round(sum(parts, (p) => p.v) / parts.length * 100) };
  }

  /* ---------- actions (simulated write-backs) ---------- */
  function log(what, detail, kind = 'system', who = 'Avery') { st.audit.unshift({ at: nowLabel(), who, what, detail, kind }); }
  const A = {
    approve(id, body) {
      const i = st.approvals.findIndex((x) => x.id === id); if (i < 0) return;
      const a = st.approvals[i]; const edited = body != null && body !== a.body;
      st.approvals.splice(i, 1); st.history.approved++; if (edited) st.history.edited++;
      log('Approved ' + a.kind.toLowerCase() + (edited ? ' with edits' : ''), a.action + ' · simulated, no HighLevel token yet', 'approve');
      return a;
    },
    reject(id, reason) {
      const i = st.approvals.findIndex((x) => x.id === id); if (i < 0) return;
      const a = st.approvals[i]; st.approvals.splice(i, 1); st.history.rejected++;
      st.brain.decisions.unshift({ date: '4 Nov', text: 'Rejected "' + a.title + '": ' + reason });
      log('Rejected ' + a.kind.toLowerCase(), reason, 'reject');
      return a;
    },
    edit(id, body) { const a = st.approvals.find((x) => x.id === id); if (a) { a.body = body; a.edited = true; } },
    addApproval(a) { const x = { id: uid('a'), age: 'now', antithesis: false, ...a }; st.approvals.unshift(x); log('New approval', x.title + ' · from ' + x.agent, 'agent', 'OS'); return x; },
    addIdea(i) { const x = { id: uid('i'), col: 'ideas', score: 7.5, sources: ['YOU'], streams: ['products'], stage: 'TOF', why: 'Added by you.', videoId: null, created: '2026-11-04', vote: null, fresh: true, ...i }; st.ideas.unshift(x); log('Added idea', x.title, 'idea'); return x; },
    moveIdea(id, col) { const i = st.ideas.find((x) => x.id === id); if (i && i.col !== col) { i.col = col; log('Moved idea', i.title + ' to ' + col, 'idea'); } return i; },
    vote(id, dir, reason) {
      const i = st.ideas.find((x) => x.id === id); if (!i) return;
      i.vote = i.vote === dir ? null : dir;
      if (i.vote) st.brain.decisions.unshift({ date: '4 Nov', text: (dir === 'up' ? 'More like: "' : 'Less like: "') + i.title + '"' + (reason ? '. ' + reason : '') });
      return i;
    },
    runIdeation() {
      const pool = [
        ['I rebuilt a clinic website live in 40 minutes', ['OUTLIER', 'COMMENT'], ['services', 'software'], 'Structure from your 5.7x outlier, asked in 9 comments this week.'],
        ['What AI Studio cannot do yet (and what I use instead)', ['COMPETITOR', 'COMMENT'], ['affiliate', 'products'], 'Two competitor videos on this topic hit 4x in 10 days.'],
        ['My first 10 SaaS clients came from one email', ['CALL', 'REVENUE'], ['software'], 'Mentioned on 4 sales calls. Email outreach drove 9,800 euros this year.'],
        ['The 47 euro kit that pays for my ads', ['REVENUE'], ['products'], 'Funnel Kit buyers upgrade to the App Builder Kit at 18 percent.'],
        ['Answering the 5 questions every physio asks me', ['COMMUNITY', 'CALL'], ['software', 'services'], 'Repeated in community threads and 6 calls.'],
      ];
      const n = st.ideas.filter((x) => x.sources.includes('NEW')).length;
      const pick = pool.filter((p) => !st.ideas.some((x) => x.title === p[0])).slice(0, 3);
      const added = pick.map((p, k) => { const x = { id: uid('i'), col: 'ideas', title: p[0], score: +(8.9 - k * 0.4 - n * 0.05).toFixed(1), sources: p[1], streams: p[2], pillar: /AI Studio|SaaS|physio|clinic/.test(p[0]) ? 'hl' : 'funnels', format: /live|Answering/.test(p[0]) ? 'tutorial' : 'edu', stage: 'TOF', why: p[3], videoId: null, created: '2026-11-04', vote: null, fresh: true }; st.ideas.unshift(x); return x; });
      st.runs.unshift({ id: uid('r'), agent: 'nightly', day: T - 1, date: '2026-11-04', time: nowLabel().slice(6), cost: 0.58, minutes: 41, score: 8.6, status: 'ok', tokens: 51000, manual: true });
      log('Ran Nightly Ideation', added.length + ' new ideas scored', 'agent', 'OS');
      return added;
    },
    runAgent(id) {
      const a = st.agents.find((x) => x.id === id); const base = SEED.runs.find((r) => r.agent === id) || { cost: 0.2, minutes: 10, tokens: 20000 };
      const r = { id: uid('r'), agent: id, day: T - 1, date: '2026-11-04', time: nowLabel().slice(6), cost: base.cost, minutes: base.minutes, score: a.mode === 'Acts' ? 8.5 : null, status: 'ok', tokens: base.tokens, manual: true };
      st.runs.unshift(r); if (a.status !== 'ok') a.status = 'ok'; log('Ran ' + a.name, 'Manual run · ' + base.minutes + ' min of work', 'agent', 'OS'); return r;
    },
    togglePause(id) { const a = st.agents.find((x) => x.id === id); a.paused = !a.paused; log((a.paused ? 'Paused ' : 'Resumed ') + a.name, a.schedule, 'agent'); return a; },
    trackMetric(name, target, unit) { const m = { id: uid('m'), name, target, values: [], unit, created: '4 Nov' }; st.metrics.push(m); log('Tracking a new call metric', name, 'system'); return m; },
    answerGap(id, answer) {
      const i = st.brain.gaps.findIndex((g) => g.id === id); if (i < 0) return;
      const g = st.brain.gaps[i]; st.brain.gaps.splice(i, 1);
      st.brain.decisions.unshift({ date: '4 Nov', text: 'Interview: ' + answer });
      log('Closed a Brain gap', g.text, 'brain'); return g;
    },
    reconnect(id) { const s = st.sources.find((x) => x.id === id); s.status = 'green'; s.detail = 'Reconnected just now · demo'; s.rows24 = s.rows24 || 12; log('Reconnected ' + s.name, 'Simulated in demo', 'data'); return s; },
    fix(id) { const s = st.sources.find((x) => x.id === id); s.status = 'green'; s.detail = 'Repaired by Data Fixer just now'; log('Data Fixer repaired ' + s.name, 'Simulated in demo', 'agent', 'OS'); return s; },
    buildPackage(draftId) {
      const d = st.offerDrafts.find((x) => x.id === draftId) || SEED.OFFERS.find((x) => x.id === draftId);
      const p = makePackage(d, 'Ready to build'); st.packages.unshift(p);
      log('Built a funnel package', d.name, 'funnel', 'OS');
      st.approvals.unshift({ id: uid('a'), kind: 'Funnel copy', title: d.name + ' sales page copy', agent: 'funnel', stream: d.stream, contactId: null, age: 'now', rubric: 'rb-offer', scores: [8.8, 8.4, 8.9, 8.1], action: 'Paste into HighLevel AI Studio as a new funnel', body: p.page.map(([h, t]) => h.toUpperCase() + '\n' + t).join('\n\n'), evidence: d.priceLogic || 'Built from your live offer and ' + (d.demand || ['sales calls']).join(', ') + '.', antithesis: false });
      return p;
    },
    checkStep(pid, i, on) { const p = st.packages.find((x) => x.id === pid); p.checklist[i][1] = on; if (p.checklist.every((c) => c[1])) p.status = 'Built in HighLevel'; },
    setRule(k, v) { st.settings.rules[k] = v; log('Writing rule ' + (v ? 'on' : 'off'), k, 'settings'); },
    setApproval(k, v) { st.settings.approval[k] = v; log('Approval rule changed', k + ' = ' + v, 'settings'); },
    setSetting(k, v) { st.settings[k] = v; },
    testConnection(id) { const c = st.settings.connections.find((x) => x.id === id); log('Tested ' + c.name, 'Demo mode, no key stored', 'settings'); return c; },
    note(contactId, text) { (st.notes[contactId] = st.notes[contactId] || []).unshift({ at: nowLabel(), text }); log('Added a note', contactById[contactId].name + ' · queued for HighLevel', 'note'); },
  };

  function makePackage(d, status, funnelId) {
    const price = d.price, name = d.name;
    return {
      id: uid('p'), offerId: d.id, name, stream: d.stream, status, funnelId, created: '4 Nov',
      page: [
        ['Headline', d.promise || 'Get the result without starting from zero.'],
        ['Subhead', 'Built by a founder who runs ' + (d.stream === 'products' ? 'the same system on his own business' : 'this for 68 clinics') + '. Here is exactly what you get.'],
        ['Proof', '68 clinics on the software, 9 seats sold in the last cohort, and the videos you already watched.'],
        ['What you get', (d.stack || ['The full system', 'Templates', 'Support']).join('\n')],
        ['Price', price.toLocaleString('en') + ' euros' + (d.unit === 'month' ? ' a month' : '') + '. ' + (d.priceLogic ? d.priceLogic.split('.')[0] + '.' : '')],
        ['Guarantee', d.guarantee || '30 days to try it.'],
        ['Call to action', 'Join now'],
      ],
      bump: { name: 'Funnel Kit', price: 47, copy: 'Add the 12 funnel templates I use with clients. One click, 47 euros.' },
      upsell: { name: 'Membership, first month free', price: 47, copy: 'Keep building with me every week. First month free, then 47 euros a month.' },
      emails: [
        ['Day 0', 'You are in. Here is your first step', 'Welcome and the one thing to do in the next hour.'],
        ['Day 1', 'The setup most people skip', 'Walkthrough of the boring part that makes money.'],
        ['Day 3', 'What Daniel built in 9 days', 'Case study with numbers.'],
        ['Day 5', 'Your question, answered', 'Top question from comments, with a short video.'],
        ['Day 7', 'Ready for the next step?', 'Soft offer for the next rung on the ladder.'],
      ],
      prompt: 'Build a 3-page funnel in HighLevel for "' + name + '" priced at ' + price + ' euros. Page 1 sales page using the copy blocks below in order. Page 2 order form with a 47 euro order bump (Funnel Kit). Page 3 one-click upsell (Membership, first month free) and a thank-you section. Colours: off-white #f6f4ef background, near-black text, accent #c85f24 on buttons only. Font: Hanken Grotesk. Mobile first, one call to action per section, no countdown timers.',
      checklist: [['Create the product and price in HighLevel Payments', false], ['Paste the AI Studio prompt and generate the funnel', false], ['Add the order bump and upsell products', false], ['Load the email sequence as a workflow', false], ['Add the UTM and SubID tracking script', false], ['Run a test purchase', false]],
    };
  }

  init();
  window.Store = {
    get s() { return st; }, A, init, T, SEED, sum, byId, contactById, videoById, streamById, offerById,
    evIn, byStream, range, total, monthly, daily, fmtDay, videoStats, videoRev, offerPerf, bySource,
    contactTimeline, contactRead, clientHealth, stalledDeals, hotContacts, agentStats, agentTotals, score, log,
  };
})();

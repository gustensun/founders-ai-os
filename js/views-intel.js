// Intelligence: Agents, Brain, Data, Score, plus Settings.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, C = window.Charts;
  const { esc, eur, eur2, int, pct, icon, title, kpis } = U;
  const T = St.T, SEED = St.SEED;

  /* ---------- Agents ---------- */
  V.agents = () => {
    const t = St.agentTotals();
    const allDepts = [...new Set(St.s.agents.map((a) => a.dept))];
    const dsel = VS.agDept && allDepts.includes(VS.agDept) ? VS.agDept : 'all';
    const depts = dsel === 'all' ? allDepts : [dsel];
    const byId = Object.fromEntries(St.s.agents.map((a) => [a.id, a]));
    const PIPES = {
      'Brand and content': ['Content pipeline', 'One idea moves left to right. Every draft stops in the Newsfeed, and HighLevel sends or schedules it.', [['Research', ['trends', 'nightly', 'comments']], ['Plan', ['planner', 'titles']], ['Write', ['draft', 'hooks']], ['Publish', ['upload', 'shorts']], ['Distribute', ['social', 'newsletter', 'repurpose']], ['Convert and learn', ['leadmagnet', 'casestudy', 'analyst']]]],
      'Offers and funnels': ['Offer and funnel pipeline', 'From what buyers say to what they buy. Agents design and test. HighLevel hosts the pages, checkout and workflows.', [['Listen', ['objections', 'offerspy', 'ladder']], ['Design', ['offerlab', 'pricing', 'bumps']], ['Build', ['funnel', 'sequence']], ['Drive traffic', ['adangles']], ['Optimize', ['leak', 'audit', 'splittest', 'recovery']]]],
    };
    const pipeFor = (d) => { const P = PIPES[d]; if (!P) return ''; const [h, sub, PIPE] = P; return `<section class="panel ag-pipe"><header><div><h2>${h}</h2><p class="meta">${sub}</p></div></header>
      <ol class="pipe" style="--n:${PIPE.length}">${PIPE.map(([stage, ids], i) => `<li><span class="pipe-n">${i + 1}</span><b>${stage}</b>${ids.filter((id) => byId[id]).map((id) => `<button class="mate" data-action="agent" data-id="${id}"><span class="dot ${byId[id].paused ? 'off' : byId[id].status === 'ok' ? '' : 'warn'}"></span>${esc(byId[id].name)}</button>`).join('')}</li>`).join('')}</ol></section>`; };
    return `${title('Agents', St.s.agents.length + ' agents on Claude. Watchers read and report. Actors draft, then wait for your approval.')}
    ${kpis([{ label: 'Hours saved, 30 days', value: Math.round(t.hours) + ' h', delta: 'About ' + eur(t.hours * 45) + ' at 45 euros an hour' }, { label: 'Spent on models', value: eur2(t.spent), delta: eur2(t.spent / Math.max(1, t.hours)) + ' per hour saved' }, { label: 'Runs', value: int(t.runs), delta: 'Last 30 days' }, { label: 'Need a look', value: t.look, delta: t.all.filter((x) => x.a.status !== 'ok' || x.fails > 2).map((x) => x.a.name).join(', ') || 'None' }])}
    <div class="ag-filter">${U.seg('agDept', dsel, [['all', 'All ' + St.s.agents.length], ...allDepts.map((d) => [d, d + ' ' + St.s.agents.filter((a) => a.dept === d).length])])}</div>
    ${depts.map((d) => `<h2 class="dept">${d}</h2>${pipeFor(d)}<div class="grid3">${t.all.filter((x) => x.a.dept === d).map(({ a, runs, spent, saved, last }) => `<article class="agent click" data-action="agent" data-id="${a.id}" tabindex="0" role="button">
      <div class="hd"><span class="dot ${a.paused ? 'off' : a.status === 'ok' ? '' : 'warn'}"></span><h3>${a.name}</h3><span class="pill ${a.mode === 'Acts' ? 'acc' : ''}">${a.paused ? 'Paused' : a.mode}</span></div>
      <p>${esc(a.does)}</p>
      <dl><div><dt>Last run</dt><dd>${last ? (last.day === T - 1 ? last.time : St.fmtDay(last.day)) : U.MINUS}</dd></div><div><dt>Spent</dt><dd>${eur2(spent)}</dd></div><div><dt>Saved</dt><dd>${saved.toFixed(1)} h</dd></div></dl></article>`).join('')}</div>`).join('')}`;
  };
  ACT.agent = (el, e) => {
    const a = St.s.agents.find((x) => x.id === el.dataset.id); const s = St.agentStats(a);
    const runs = St.s.runs.filter((r) => r.agent === a.id).slice(0, 12);
    const running = VS.running[a.id];
    U.drawer(`<div><p class="meta">${a.dept} · ${a.mode === 'Acts' ? 'Drafts, then waits for approval' : 'Reads and reports'}</p><h2>${a.name}</h2><p class="muted" style="margin-top:6px">${esc(a.does)}</p></div>
      <div class="kv4"><div><span>Runs, 30 d</span><b>${s.runs}</b></div><div><span>Spent</span><b>${eur2(s.spent)}</b></div><div><span>Saved</span><b>${s.saved.toFixed(1)} h</b></div><div><span>Avg score</span><b>${s.avg == null ? U.MINUS : s.avg.toFixed(1)}</b></div></div>
      <div class="dsec"><h3>Schedule</h3><div class="row"><div class="grow">${esc(a.schedule)}</div><label class="theme-row" style="padding:0;gap:10px"><span>${a.paused ? 'Paused' : 'Active'}</span><input type="checkbox" class="switch" data-action="pause" data-id="${a.id}" ${a.paused ? '' : 'checked'} aria-label="Agent active"></label></div></div>
      <div class="dsec"><h3>Sub-jobs</h3><div class="tags">${a.jobs.map((j) => `<span class="pill out">${esc(j)}</span>`).join('')}</div></div>
      <div class="dsec"><h3>Run history</h3><div class="table-wrap"><table><thead><tr><th>When</th><th class="n">Minutes</th><th class="n">Cost</th><th class="n">Score</th><th>Status</th></tr></thead><tbody>${runs.map((r) => `<tr><td>${St.fmtDay(r.day)} ${r.time}${r.manual ? ' <span class="tag">MANUAL</span>' : ''}</td><td class="n">${r.minutes}</td><td class="n">${eur2(r.cost)}</td><td class="n">${r.score == null ? U.MINUS : r.score.toFixed(1)}</td><td>${r.status === 'ok' ? '<span class="pill pos">Done</span>' : r.status === 'retry' ? '<span class="pill warn">Retried</span>' : '<span class="pill neg">Failed</span>'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="actions"><button class="btn primary" data-action="run-agent" data-id="${a.id}" ${running || a.paused ? 'disabled' : ''}>${running ? U.spin + 'Running' : icon('play') + 'Run now'}</button></div>`, { label: 'Agent', wide: true });
  };
  ACT.pause = (el, e) => { e.stopPropagation(); const a = St.A.togglePause(el.dataset.id); U.toast(a.paused ? a.name + ' paused' : a.name + ' resumed'); window.App.render(true); ACT.agent({ dataset: { id: a.id } }); };
  ACT['run-agent'] = (el) => {
    const id = el.dataset.id; VS.running[id] = true; ACT.agent({ dataset: { id } });
    setTimeout(() => {
      VS.running[id] = false; St.A.runAgent(id);
      const a = St.s.agents.find((x) => x.id === id);
      if (id === 'nightly') St.A.runIdeation();
      const made = window.ContentAgents && window.ContentAgents.run(id); if (made) { U.toast(a.name + ' finished. ' + made.kind + ' is waiting in the Newsfeed.'); window.App.render(true); if (U.$('#drawer').classList.contains('open')) ACT.agent({ dataset: { id } }); window.App.refreshCounts(); return; }
      if (id === 'followup') St.A.addApproval({ kind: 'Email', title: 'Follow-up to ' + St.stalledDeals()[0].c.name, agent: 'followup', stream: 'services', contactId: St.stalledDeals()[0].c.id, rubric: 'rb-email', scores: [8.8, 8.9, 8.3, 8.6], action: 'Send email from HighLevel', body: 'Hi ' + St.stalledDeals()[0].c.first + ',\n\nI held your slot for the redesign. Want me to keep it for next week, or should I let it go?\n\nAvery', evidence: 'Proposal sent, quiet ' + St.stalledDeals()[0].days + ' days.' });
      U.toast(a.name + ' finished'); window.App.render(true); if (U.$('#drawer').classList.contains('open')) ACT.agent({ dataset: { id } }); window.App.refreshCounts();
    }, 1600);
  };

  /* ---------- Brain ---------- */
  V.brain = () => {
    const b = St.s.brain, tab = VS.brainTab;
    const words = St.sum(b.docs, (d) => d.words);
    const tabs = [['docs', 'Docs ' + b.docs.length], ['skills', 'Skills ' + b.skills.length], ['rubrics', 'Rubrics ' + b.rubrics.length], ['voice', 'Voice ' + b.voice.length], ['decisions', 'Decisions ' + b.decisions.length]];
    let body = '';
    if (tab === 'docs') body = `<div class="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>Learned from</th><th class="n">Words</th><th class="n">Updated</th></tr></thead><tbody>${b.docs.map((d) => `<tr class="click" data-action="doc" data-id="${d.id}"><td><button class="lnk" data-action="doc" data-id="${d.id}">${esc(d.name)}</button></td><td class="muted">${d.kind}</td><td class="muted clip">${esc(d.source)}</td><td class="n">${int(d.words)}</td><td class="n muted">${d.updated}</td></tr>`).join('')}</tbody></table></div>`;
    if (tab === 'skills') body = `<div class="table-wrap"><table><thead><tr><th>Skill</th><th class="n">Used, 30 days</th><th class="n">Updated</th></tr></thead><tbody>${b.skills.map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${s.uses}</td><td class="n muted">${s.updated}</td></tr>`).join('')}</tbody></table></div>`;
    if (tab === 'rubrics') body = `<div class="grid2">${b.rubrics.map((r) => `<div class="well"><div class="dh"><b>${r.applies}</b><span class="meta">Minimum ${r.min.toFixed(1)}</span></div><div class="score-bars" style="margin-top:12px">${r.criteria.map(([l, w]) => `<div class="sbar wide"><span>${esc(l)}</span><span class="track"><span class="fill" style="width:${w * 100 / 0.4}%"></span></span><span class="v">${Math.round(w * 100)}%</span></div>`).join('')}</div></div>`).join('')}</div>`;
    if (tab === 'voice') body = `<div class="rows">${b.voice.map((v) => `<div class="row"><div class="grow"><p class="quote">${esc(v.text)}</p><div class="s">${esc(v.from)}</div></div></div>`).join('')}</div>`;
    if (tab === 'decisions') body = `<div class="rows">${b.decisions.map((d) => `<div class="row"><span class="time">${d.date}</span><div class="grow wrap">${esc(d.text)}</div></div>`).join('')}</div>`;
    const sc = St.score().parts[0];
    const top = VS.brTab === 'library' ? 'library' : 'algorithm'; const nWait = window.Facts ? window.Facts.proposed().length : 0;
    const tabsTop = U.seg('brTab', top, [['algorithm', 'Algorithm' + (nWait ? ' <span class="fx-dot" aria-label="' + nWait + ' waiting"></span>' : '')], ['library', 'Library ' + b.docs.length]]);
    if (top === 'algorithm' && window.Facts) return `${title('Brain', 'Your Founder Algorithm. Facts about you and the business that you wrote or approved. Every AI in the OS reads them first, and they win over anything else.', tabsTop)}${window.Facts.view('demo', b.docs.length, b.docs)}`;
    return `${title('Brain', 'What the OS knows about you. Every agent reads from here before it writes.', (b.gaps.length ? `<button class="btn primary" data-action="interview">Fill a gap: interview mode</button>` : '') + tabsTop)}
    ${kpis([{ label: 'Brain coverage', value: Math.round(sc.v * 100) + '%', delta: b.gaps.length + ' gaps open' }, { label: 'Words learned', value: int(words), delta: b.docs.length + ' documents' }, { label: 'Decisions', value: b.decisions.length, delta: 'From thumbs, rejections and interviews' }, { label: 'Voice samples', value: b.voice.length, delta: 'Quoted by Draft Studio' }])}
    <div class="layout" style="margin-top:var(--gap)"><section class="panel"><header>${U.seg('brainTab', tab, tabs)}</header>${body}</section>
      <aside class="rail"><h2 class="out">Gaps found</h2><section class="panel tight"><div class="rows">${b.gaps.map((g) => `<div class="row"><span class="dot warn"></span><div class="grow wrap">${esc(g.text)}</div><button class="btn sm" data-action="interview" data-id="${g.id}">Answer</button></div>`).join('') || U.empty('No gaps', 'Every agent has what it needs. New gaps appear when drafts score low.')}</div></section></aside></div>`;
  };
  ACT.doc = (el, e) => { e.stopPropagation(); const d = St.s.brain.docs.find((x) => x.id === el.dataset.id); U.drawer(`<div><p class="meta">${d.kind} · ${int(d.words)} words · updated ${d.updated}</p><h2>${esc(d.name)}</h2><p class="muted" style="margin-top:6px">${esc(d.source)}</p></div>${d.body.map(([h, t]) => `<div class="dsec"><h3>${esc(h)}</h3><p class="doc">${esc(t)}</p></div>`).join('')}<p class="evidence">Read by every agent that writes in your name. Update it by answering interview questions or rejecting drafts with a reason.</p>`, { label: 'Document' }); };
  ACT.interview = async (el) => {
    const gaps = St.s.brain.gaps; const g = gaps.find((x) => x.id === el.dataset.id) || gaps[0]; if (!g) return;
    const r = await U.dialog({ title: 'Interview', body: esc(g.text) + '<br><br><b>' + esc(g.q) + '</b>', fields: [{ name: 'answer', label: 'Your answer', type: 'textarea', rows: 5, required: true, placeholder: 'Talk like you would on a call. The OS rewrites it into the Brain.' }], ok: 'Save to Brain' });
    if (!r) return; St.A.answerGap(g.id, r.answer); U.toast('Saved. Brain coverage is now ' + Math.round(St.score().parts[0].v * 100) + '%'); window.App.render();
  };

  /* ---------- Data ---------- */
  V.data = () => {
    const src = St.s.sources;
    const sc = St.score().parts[1];
    const flowing = src.filter((s) => s.status === 'green').length;
    const log = [
      ['07:02', 'HighLevel contacts and tags', 'Synced 148 changed contacts', 'ok'],
      ['06:00', 'HighLevel payments and subscriptions', '23 payments, 1 failed card on Lindqvist Dental', 'warn'],
      ['05:30', 'Affiliate SubIDs per video', '14 links missing SubIDs since 22 Oct', 'warn'],
      ['04:10', 'HighLevel Communities', 'Token expired. 0 rows read', 'bad'],
      ['03:00', 'YouTube Analytics', '60 videos refreshed', 'ok'],
      ['02:00', 'Competitor channels (Apify)', '12 channels, 2 new outliers', 'ok'],
    ];
    return `${title('Data', 'Every feed the OS reads, how fresh it is and what is missing. Data Monitor checks hourly. Data Fixer repairs what it can.', `<button class="btn" data-action="full-check">Run a full check</button>`)}
    ${kpis([{ label: 'Data coverage', value: Math.round(sc.v * 100) + '%', delta: 'Green counts fully, orange half' }, { label: 'Feeds flowing', value: flowing + ' of ' + src.length, delta: src.filter((s) => s.status === 'red').length + ' disconnected' }, { label: 'Rows written, 24 h', value: int(St.sum(src, (s) => s.rows24)), delta: 'Into the OS warehouse' }, { label: 'Contacts missing fields', value: SEED.contacts.filter((c) => c.missing.length).length, delta: 'Enricher fills these nightly' }])}
    <div class="layout" style="margin-top:var(--gap)"><section class="panel"><header><h2>Feeds</h2><span class="meta">Read-only unless marked</span></header>
      <div class="table-wrap"><table><thead><tr><th>Source</th><th>System</th><th>Status</th><th class="n">Rows, 24 h</th><th></th></tr></thead><tbody>
      ${src.map((s) => `<tr><td>${esc(s.name)}<span class="sub">${esc(s.detail)}</span></td><td class="muted">${esc(s.system)}</td><td>${U.statusPill(s.status)}</td><td class="n">${int(s.rows24)}</td><td class="n">${s.status === 'red' ? `<button class="btn sm" data-action="reconnect" data-id="${s.id}">Reconnect</button>` : s.status === 'orange' ? `<button class="btn sm" data-action="fix" data-id="${s.id}">Let Fixer repair</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>
      <aside class="rail"><h2 class="out">Monitor log</h2><section class="panel tight"><div class="rows">${log.map(([t, n, d, s]) => `<div class="row"><span class="time">${t}</span><div class="grow"><div class="t">${esc(n)}</div><div class="s wrap">${esc(d)}</div></div><span class="dot ${s === 'ok' ? '' : s}"></span></div>`).join('')}</div></section></aside></div>`;
  };
  ACT.reconnect = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Connecting'; setTimeout(() => { const s = St.A.reconnect(el.dataset.id); U.toast(s.name + ' reconnected (demo)'); window.App.render(); }, 1100); };
  ACT.fix = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Repairing'; setTimeout(() => { const s = St.A.fix(el.dataset.id); U.toast('Data Fixer repaired ' + s.name); window.App.render(); }, 1300); };
  ACT['full-check'] = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Checking 14 feeds'; setTimeout(() => { St.A.runAgent('monitor'); U.toast('Full check done. ' + St.s.sources.filter((s) => s.status !== 'green').length + ' feeds need attention.'); window.App.render(); }, 1500); };

  /* ---------- Score ---------- */
  V.score = () => {
    const sc = St.score();
    U.after(() => C.ring(U.$('#score-ring'), { value: sc.total / 100, label: String(sc.total), sub: 'of 100', size: 168 }));
    const tier = sc.total >= 85 ? 'Running on its own' : sc.total >= 70 ? 'Mostly automated' : sc.total >= 50 ? 'Half built' : 'Getting started';
    return `${title('OS score', 'How much of the business the OS can see, understand and run for you. It doubles as the workshop diagnostic.')}
    <div class="layout"><section class="panel"><header><h2>Five parts</h2><span class="meta">Each one has a next step</span></header>${V.scoreBars(sc, true)}</section>
      <aside class="rail"><section class="panel center"><div id="score-ring"></div><p class="serif-lede" style="margin-top:12px">${tier}</p><p class="muted">The score moves as you close Brain gaps, fix feeds, keep agents running and approve drafts.</p></section>
      <section class="panel"><h2 style="margin-bottom:10px">What each part means</h2><dl class="dl"><dt>Brain coverage</dt><dd>Docs, voice and decisions agents can read before writing.</dd><dt>Data coverage</dt><dd>Feeds flowing from HighLevel, YouTube, Stripe and Apify.</dd><dt>Agents live</dt><dd>Agents active and healthy.</dd><dt>Approval rate</dt><dd>Drafts you approve against those you reject.</dd><dt>Hours saved</dt><dd>Work done by agents against a target of 200 hours a month.</dd></dl></section></aside></div>`;
  };

  /* ---------- Settings ---------- */
  V.settings = () => {
    const s = St.s.settings;
    const rules = [['noDash', 'No em dashes'], ['noHype', 'No hype words (game-changer, unlock, supercharge)'], ['oneCta', 'One call to action per piece'], ['antithesis', 'Allow one contrarian line per piece'], ['numbersFirst', 'Lead with a number when one exists']];
    return `${title('Settings', 'Workspace, connections, schedules and the rules every agent follows.', `<button class="btn" data-action="export">Export workspace JSON</button><button class="btn ghost" data-action="reset">Reset demo</button>`)}
    <div class="grid2">
      <section class="panel"><header><h2>Profile and workspace</h2></header><form class="form" data-form="profile">
        <label class="field"><span>Name</span><input name="name" value="${esc(s.name)}"></label><label class="field"><span>Email</span><input name="email" type="email" value="${esc(s.email)}"></label>
        <label class="field"><span>Workspace</span><input name="workspace" value="${esc(s.workspace)}"></label><label class="field"><span>Time zone</span><select name="tz">${['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Australia/Sydney', 'UTC'].map((z) => `<option ${z === s.tz ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
        <div class="actions"><button class="btn primary">Save</button></div></form></section>
      <section class="panel"><header><h2>Schedules</h2><span class="meta">${esc(s.tz)}</span></header><form class="form" data-form="schedules">
        <label class="field"><span>Morning briefing</span><input name="briefing" type="time" value="${s.briefing}"></label><label class="field"><span>Nightly ideation</span><input name="ideation" type="time" value="${s.ideation}"></label>
        <label class="field"><span>Weekly digest</span><input name="digest" value="${esc(s.digest)}"></label><div class="actions"><button class="btn primary">Save schedules</button></div></form></section>
    </div>
    <section class="panel" style="margin-top:var(--gap)"><header><h2>Connections</h2><div class="actions"><span class="pill acc">Demo mode · no keys stored</span><button class="btn sm" data-action="go" data-go="connect">All 35 connections</button></div></header><div class="rows">
      ${s.connections.map((c) => `<div class="row"><div class="grow"><div class="t">${c.name}</div><div class="s">${c.how}</div></div><span class="pill out">Sample data</span><button class="btn sm" data-action="test-conn" data-id="${c.id}">Test</button></div>`).join('')}
    </div><p class="meta" style="margin-top:12px">When you go live, each key is pasted once into the server, never into the browser. HighLevel stays the system of record.</p></section>
    <div class="grid2" style="margin-top:var(--gap)">
      <section class="panel"><header><h2>Writing rules</h2><span class="meta">Every agent checks these before a draft reaches you</span></header><div class="rows">${rules.map(([k, l]) => `<label class="row"><span class="grow">${l}</span><input type="checkbox" class="switch" data-action="rule" data-k="${k}" ${s.rules[k] ? 'checked' : ''}></label>`).join('')}</div></section>
      <section class="panel"><header><h2>Approval rules</h2></header><div class="rows">
        <label class="row"><span class="grow">Minimum score for emails</span><select data-action="appr-min" data-k="emailMin">${[7, 7.5, 8, 8.5, 9].map((v) => `<option ${v === s.approval.emailMin ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="row"><span class="grow">Minimum score for scripts</span><select data-action="appr-min" data-k="scriptMin">${[7, 7.5, 8, 8.5, 9].map((v) => `<option ${v === s.approval.scriptMin ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="row"><span class="grow">Schedule approved posts automatically</span><input type="checkbox" class="switch" data-action="appr" data-k="autoSchedule" ${s.approval.autoSchedule ? 'checked' : ''}></label>
        <label class="row"><span class="grow">Offers and prices need a second look</span><input type="checkbox" class="switch" data-action="appr" data-k="twoStepOffers" ${s.approval.twoStepOffers ? 'checked' : ''}></label>
      </div></section>
    </div>
    <section class="panel" style="margin-top:var(--gap)"><header><h2>Audit log</h2><span class="meta">Every write the OS would make in HighLevel</span></header><div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead><tbody>${St.s.audit.slice(0, 30).map((a) => `<tr><td class="muted">${a.at}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td class="muted clip">${esc(a.detail)}</td></tr>`).join('')}</tbody></table></div></section>`;
  };
  ACT.rule = (el) => { St.A.setRule(el.dataset.k, el.checked); U.toast('Writing rule saved'); };
  ACT.appr = (el) => { St.A.setApproval(el.dataset.k, el.checked); U.toast('Approval rule saved'); };
  ACT['appr-min'] = (el) => { St.A.setApproval(el.dataset.k, +el.value); U.toast('Minimum set to ' + el.value); };
  ACT['test-conn'] = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Testing'; setTimeout(() => { const c = St.A.testConnection(el.dataset.id); el.disabled = false; el.textContent = 'Test'; U.toast(c.name + ': sample data responds. Add a key to go live.'); }, 900); };
  ACT.export = () => {
    const data = { exported: new Date().toISOString(), workspace: St.s.settings.workspace, ideas: St.s.ideas, approvals: St.s.approvals, brain: St.s.brain, metrics: St.s.metrics, packages: St.s.packages, settings: St.s.settings, audit: St.s.audit };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'founder-os-workspace.json'; document.body.appendChild(a); a.click(); a.remove();
    St.log('Exported workspace', 'JSON download', 'settings'); U.toast('Workspace exported');
  };
  ACT.reset = async () => { const r = await U.dialog({ title: 'Reset the demo?', body: 'Every change you made in this session goes back to the sample data.', ok: 'Reset', danger: true }); if (!r) return; St.init(); if (window.OSMemory) window.OSMemory.reset(); Object.assign(VS, { approval: null, apKind: 'all', apStream: 'all', editing: false, cStream: 'all', cSource: 'all', cStage: 'all', cPillar: 'all', cFormat: 'all' }); U.toast('Demo reset'); window.App.render(); window.App.refreshCounts(); };
})();

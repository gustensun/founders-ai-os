// Affiliate: the HighLevel affiliate program as a dashboard, built from the portal's CSV exports.
// Drop the Referrals export, the Commissions export, or both. The file is read in the browser and only
// the summary is saved (Connections > Affiliate dashboards). Money follows the Revenue Demo/Live switch.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, C = window.Charts;
  const { esc, int, title, kpis } = U;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const usd = (cur = 'USD') => { const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }); return (v) => f.format(Math.round(+v || 0)); };
  const pc = (x) => Math.round((+x || 0) * 100) + '%';
  const ym = (d) => d.toISOString().slice(0, 7);
  const lastMonths = (n, end) => { const out = []; const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); for (let i = n - 1; i >= 0; i--) out.push(ym(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)))); return out; };
  const mLabel = (k, i) => MON[+k.slice(5) - 1] + (i === 0 || k.endsWith('-01') ? ' ' + k.slice(2, 4) : '');
  const ago = (iso) => { if (!iso) return ''; const d = Math.round((Date.now() - Date.parse(iso)) / 864e5); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 45 ? d + ' days ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const mode = () => VS.revMode || 'demo';

  // Sample program for the demo workspace and Demo mode. Shaped like a real HighLevel affiliate account.
  let demoCache = null;
  function demoData() {
    if (demoCache) return demoCache;
    const now = new Date(); const keys = lastMonths(30, now);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const byMonthC = {}, byMonthR = {};
    keys.forEach((k, i) => {
      const base = 9200 + i * 210 + Math.sin(i / 2.3) * 900 + rnd() * 600;
      byMonthC[k] = Math.round(i === keys.length - 1 ? base * (now.getUTCDate() / 30) : base);
      byMonthR[k] = { s: Math.round(38 + rnd() * 30 + Math.sin(i / 3) * 10), c: Math.round(9 + rnd() * 8) };
    });
    const names = ['northpeak.example', 'clinicgrowth.example', 'maya@example.com', 'leadloop.example', 'oakandember.example', 'jonas@example.net', 'trailhead.example', 'hello@example.org', 'peakreach.example', 'atlasleads.example'];
    const full = keys.slice(-13, -1); const avg12 = Math.round(full.reduce((s, k) => s + byMonthC[k], 0) / full.length);
    const days = [2, 5, 9, 12, 17, 21, 26];
    demoCache = {
      demo: true,
      commissions: {
        kind: 'commissions', file: 'commissions-sample.csv', uploaded_at: new Date(Date.now() - 2 * 864e5).toISOString(), currency: 'USD',
        total: Object.values(byMonthC).reduce((s, v) => s + v, 0), rows: 6120, accounts: 612, paying: 284, last30: Math.round(avg12 * 1.04), prev30: Math.round(avg12 * 0.97), avg12, byMonth: byMonthC,
        peak: Object.entries(byMonthC).reduce((p, [k, v]) => (v > p.v ? { k, v } : p), { k: null, v: 0 }),
        bySub: [{ name: 'yt-founder-plan', amount: 61200, n: 1460 }, { name: 'yt-ai-studio', amount: 38800, n: 912 }, { name: 'newsletter', amount: 22100, n: 640 }, { name: 'No SubID', amount: 146000, n: 3108 }],
        byPlan: [{ name: 'Agency Pro', amount: 141000, n: 2410 }, { name: 'Founder', amount: 72500, n: 1880 }, { name: 'Starter', amount: 54600, n: 1830 }],
        topAccounts: names.map((n, i) => ({ name: n, amount: 4200 - i * 310, n: 30 - i, last: new Date(Date.now() - (i + 2) * 864e5).toISOString() })),
      },
      referrals: {
        kind: 'referrals', file: 'referrals-sample.csv', uploaded_at: new Date(Date.now() - 2 * 864e5).toISOString(),
        total: 1874, active: 284, trialsNow: days.length, trials: 41, leads: 905, cancelled: 644, everCustomers: 928, retention: 0.31, conversion: 0.5,
        last30: { signups: 61, customers: 14 }, prev30: { signups: 54, customers: 11 }, byMonth: byMonthR,
        bySub: [{ name: 'yt-founder-plan', n: 402, active: 88, ever: 210 }, { name: 'yt-ai-studio', n: 266, active: 51, ever: 131 }, { name: 'newsletter', n: 140, active: 22, ever: 60 }],
        byCountry: [['US', 168], ['GB', 24], ['CA', 21], ['AU', 17], ['DE', 9], ['FI', 7], ['NZ', 6]].map(([name, n]) => ({ name, n, active: n })),
        trialList: days.map((d, i) => ({ email: names[(i + 3) % names.length].replace(/^([^@]+)$/, 'team@$1'), at: new Date(Date.now() - d * 864e5).toISOString(), day: d, sub: i % 2 ? 'yt-founder-plan' : '' })),
        recentCustomers: names.slice(0, 8).map((n, i) => ({ email: n.includes('@') ? n : 'hi@' + n, at: new Date(Date.now() - (i * 3 + 1) * 864e5).toISOString(), state: 'active', sub: i % 3 ? '' : 'yt-ai-studio' })),
      },
    };
    return demoCache;
  }

  function stored() {
    const C2 = window.Conn; const m = C2 && C2.meta ? C2.meta('affiliate') : null;
    const a = m && m.aff; if (!a) return null;
    if (!a.referrals && !a.commissions && a.byMonth) return { commissions: { kind: 'commissions', legacy: true, total: a.total, last30: a.last30, rows: a.rows, byMonth: a.byMonth, bySub: a.bySub, file: a.file, currency: 'USD', avg12: 0, accounts: 0, paying: 0 } };
    return (a.referrals || a.commissions) ? a : null;
  }

  // ---------- upload ----------
  async function upload(files) {
    files = [...(files || [])].filter(Boolean);
    if (!files.length) return;
    if (!isLive()) { U.toast('The demo workspace shows sample data. Sign in to your own workspace to upload your exports.'); return; }
    const done = [];
    for (const f of files) {
      if (f.size > 25e6) { U.toast(f.name + ' is over 25 MB. Export a shorter date range.'); continue; }
      let rep;
      try { rep = window.AffReport.read(await f.text(), { filename: f.name }); } catch (e) { U.toast(f.name + ': ' + e.message); continue; }
      try { await window.Conn.api('csv-upload', { report: rep, filename: f.name }); done.push(rep); } catch (e) { U.toast(e.message); }
    }
    if (!done.length) return;
    VS.revMode = 'live';
    await window.App.reloadConns();
    if ((location.hash || '').slice(1) !== 'affiliate') location.hash = 'affiliate'; else window.App.render();
    U.toast(done.map((r) => r.kind === 'referrals' ? int(r.total) + ' referrals read' : int(r.rows) + ' commissions read').join(', ') + '. Dashboard updated.');
  }
  window.AffDash = { upload, demo: demoData };

  const pickBtn = (label = 'Upload export', cls = 'btn') => `<label class="${cls} affd-pick">${U.icon ? U.icon('upload') : ''}<span>${label}</span><input type="file" accept=".csv,text/csv" multiple data-affd-file hidden></label>`;
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-affd-file]'); if (el) { upload(el.files); el.value = ''; } });
  document.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('.affd-drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('.affd-drop'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', (e) => { const z = e.target.closest && e.target.closest('.affd-drop'); if (z) { e.preventDefault(); z.classList.remove('over'); upload(e.dataTransfer.files); } });

  const HOW = `<ol class="affd-how">
    <li><b>Open the affiliate portal</b><span>In HighLevel, go to your affiliate dashboard (the FirstPromoter portal you log in to for payouts).</span></li>
    <li><b>Export Referrals</b><span>Referrals tab, then Export. This file gives trials, customers, cancellations and countries.</span></li>
    <li><b>Export Commissions</b><span>Commissions or Rewards tab, then Export. This file gives the money per month and per account.</span></li>
    <li><b>Drop both here</b><span>The OS works out which file is which. Upload a fresh export whenever you want the numbers updated.</span></li></ol>`;

  function emptyLive() {
    return `${title('Affiliate', 'Your HighLevel affiliate program as a dashboard, read from the portal exports.', `<button class="btn ghost" data-action="aff-open">Affiliate bonuses</button>`)}
      <section class="panel affd-drop affd-hero"><div class="affd-drop-in">
        <h2>Drop your affiliate exports here</h2>
        <p class="muted">Commissions and referrals fill in here by themselves as postbacks arrive. To add your history from before, drop the Referrals and Commissions exports here once. The file is read on this device and only the totals are saved.</p>
        <div class="actions">${pickBtn('Choose files', 'btn primary')}</div>
      </div>${HOW}</section>`;
  }

  // Stripe plan IDs mean nothing on screen. Show the tail of the ID and the average commission instead.
  const planName = (x, money) => /^(plan|price|prod)_/i.test(x.name) ? 'Plan …' + x.name.slice(-4) + ' · ' + money(x.amount / Math.max(1, x.n)) + ' per commission' : x.name;

  // ---------- people ----------
  const PF = [['all', 'Everyone'], ['active', 'Active'], ['trial', 'In trial'], ['cancelled', 'Cancelled'], ['lead', 'Email only']];
  const PS = () => (VS.affPeople = VS.affPeople || { f: 'cancelled', q: '', n: 50 });
  function peopleRows(d) {
    const R = d.referrals, Cm = d.commissions; if (!R || !R.people) return [];
    const by = (Cm && Cm.byEmail) || {};
    return R.people.map(([email, st, created, since, sub, cc]) => { const c = by[String(email).toLowerCase()] || null; return { email, st, created, since, sub, cc, paid: c ? c[0] : 0, n: c ? c[1] : 0, last: c ? c[2] : '' }; });
  }
  function filtered(d) {
    const s = PS(); const q = s.q.trim().toLowerCase();
    let l = peopleRows(d).filter((p) => s.f === 'all' || (s.f === 'active' && p.st === 'active') || (s.f === 'trial' && (p.st === 'signup' || /trial/.test(p.st))) || (s.f === 'cancelled' && p.st === 'cancelled') || (s.f === 'lead' && p.st === 'subscribed'));
    if (q) l = l.filter((p) => (p.email + ' ' + p.sub + ' ' + p.cc).toLowerCase().includes(q));
    const key = s.f === 'cancelled' ? (p) => p.last || p.since || p.created : (p) => p.since || p.created;
    return l.sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
  }
  const ST = { active: ['pos', 'Active'], cancelled: ['neg', 'Cancelled'], signup: ['warn', 'Trial'], subscribed: ['', 'Email only'] };
  const dShort = (iso) => iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  function peopleBody(d, money) {
    const l = filtered(d); const s = PS(); const hasC = !!(d.commissions && d.commissions.byEmail);
    const rows = l.slice(0, s.n).map((p) => { const [cls, lab] = ST[p.st] || ['', p.st]; return `<tr><td><span class="affd-mail">${esc(p.email)}</span>${p.sub ? `<span class="sub">${esc(p.sub)}</span>` : ''}</td><td><span class="pill ${cls}">${esc(p.st === 'cancelled' && !p.since ? 'Cancelled in trial' : lab)}</span></td><td class="muted">${dShort(p.created)}</td><td class="muted">${dShort(p.since)}</td>${hasC ? `<td class="muted">${p.st === 'cancelled' && p.last ? 'Last paid ' : ''}${dShort(p.last)}</td><td class="n">${p.paid ? `<b>${money(p.paid)}</b>` : '<span class="muted">0</span>'}</td>` : ''}<td class="muted">${esc(p.cc)}</td></tr>`; }).join('');
    const more = l.length > s.n ? `<div class="actions" style="margin-top:12px"><button class="btn sm" data-action="affd-more">Show ${int(Math.min(100, l.length - s.n))} more of ${int(l.length - s.n)}</button></div>` : '';
    return `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>Referred</th><th>Customer since</th>${hasC ? '<th>Last commission</th><th class="n">Paid you</th>' : ''}<th>Country</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="muted">Nobody matches.</td></tr>`}</tbody></table></div>${more}<p class="meta affd-foot">${int(l.length)} ${l.length === 1 ? 'person' : 'people'}${s.q ? ' matching “' + esc(s.q) + '”' : ''}.</p>`;
  }
  function peopleSection(d, money) {
    const R = d.referrals; if (!R) return '';
    if (!R.people) return `<section class="panel affd-drop affd-strip"><p>Upload the Referrals export again to see every person with their email, including who cancelled.</p>${pickBtn('Upload export', 'btn sm')}</section>`;
    const s = PS(); const all = peopleRows(d);
    const count = (f) => all.filter((p) => f === 'all' || (f === 'active' && p.st === 'active') || (f === 'trial' && (p.st === 'signup' || /trial/.test(p.st))) || (f === 'cancelled' && p.st === 'cancelled') || (f === 'lead' && p.st === 'subscribed')).length;
    const canc = all.filter((p) => p.st === 'cancelled'); const lost = canc.reduce((t, p) => t + p.paid, 0);
    const hasC = !!(d.commissions && d.commissions.byEmail);
    const recentLost = canc.filter((p) => p.last).sort((a, b) => (b.last > a.last ? 1 : -1)).slice(0, 6);
    return `<section class="panel affd-people" style="margin-top:var(--gap)"><header><h2>People</h2><div class="actions"><button class="btn sm ghost" data-action="affd-csv">Download CSV</button></div></header>
      ${s.f === 'cancelled' ? `<p class="muted affd-lead">${int(canc.length)} cancelled. ${int(canc.filter((p) => p.since).length)} of them paid before leaving${hasC ? `, worth ${money(lost)} in commissions to you` : ''}. The rest left during the trial.${recentLost.length ? ` Most recent: ${recentLost.slice(0, 3).map((p) => esc(p.email) + ' (last paid ' + dShort(p.last) + ')').join(', ')}.` : ''}</p>` : ''}
      ${!hasC && d.commissions ? '<p class="meta affd-lead">Upload the Commissions export again to add what each person paid you.</p>' : ''}
      <div class="affd-ptools"><div class="segmented" role="group">${PF.map(([v, l]) => `<button data-action="affd-f" data-v="${v}" aria-pressed="${s.f === v}">${l} <span class="meta">${int(count(v))}</span></button>`).join('')}</div>
      <input class="affd-q" type="search" placeholder="Search email, SubID or country" value="${esc(s.q)}" data-affd-q aria-label="Search people"></div>
      <div id="affd-ptab">${peopleBody(d, money)}</div></section>`;
  }
  let curData = null, curMoney = usd();
  ACT['affd-f'] = (el) => { const s = PS(); s.f = el.dataset.v; s.n = 50; window.App.render(); };
  ACT['affd-more'] = () => { PS().n += 100; const t = U.$('#affd-ptab'); if (t && curData) t.innerHTML = peopleBody(curData, curMoney); };
  ACT['affd-csv'] = () => {
    if (!curData) return; const l = filtered(curData); const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = ['email,status,referred,customer_since,last_commission,commissions_paid,sub_id,country'].concat(l.map((p) => [p.email, p.st, p.created, p.since, p.last, p.paid, p.sub, p.cc].map(q).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'affiliate-' + PS().f + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  document.addEventListener('input', (e) => { const el = e.target.closest('[data-affd-q]'); if (!el || !curData) return; const s = PS(); s.q = el.value; s.n = 50; const t = U.$('#affd-ptab'); if (t) t.innerHTML = peopleBody(curData, curMoney); });

  // ---------- dashboard ----------
  function page(d, opts) {
    const R = d.referrals, Cm = d.commissions;
    const cur = (Cm && Cm.currency) || 'USD'; const money = usd(cur); curData = d; curMoney = money;
    const now = new Date();
    const head = title('Affiliate', opts.sub, opts.actions);
    const files = [R, Cm].filter((x) => x && x.file).map((x) => `${x.kind === 'referrals' ? 'Referrals' : 'Commissions'}: ${esc(x.file || 'export.csv')}${x.uploaded_at ? ' · uploaded ' + ago(x.uploaded_at) : ''}`).join('<span class="sep"> · </span>');
    const missing = !R ? 'Add the Referrals export to see trials, active customers and churn.' : !Cm ? 'Add the Commissions export to see what the program pays you each month.' : '';

    const k = [];
    if (Cm) {
      k.push({ label: 'Commissions, last 30 days', value: money(Cm.last30), delta: Cm.prev30 ? U.change(Cm.last30, Cm.prev30) + ' vs the 30 days before' : 'From ' + int(Cm.rows) + ' commissions' });
      if (Cm.avg12) k.push({ label: 'Monthly average', value: money(Cm.avg12), delta: Cm.peak && Cm.peak.k ? 'Best month ' + mLabel(Cm.peak.k, 0) + ', ' + money(Cm.peak.v) : 'Last 12 full months' });
    }
    if (R) {
      k.push({ label: 'Active customers', value: int(R.active), delta: pc(R.retention) + ' of the ' + int(R.everCustomers) + ' who ever paid are still on' });
      k.push({ label: 'In trial now', value: int(R.trialsNow || 0), delta: int(R.last30.signups) + ' new referrals in 30 days, ' + int(R.last30.customers) + ' converted' });
    } else if (Cm) {
      k.push({ label: 'Paying accounts', value: int(Cm.paying), delta: 'Earned you a commission last month' });
      k.push({ label: 'Lifetime in file', value: money(Cm.total), delta: int(Cm.accounts) + ' accounts' });
    }

    const keys = lastMonths(24, now);
    U.after(() => {
      if (Cm && U.$('#affd-c')) C.bars(U.$('#affd-c'), { labels: keys.map(mLabel), values: keys.map((x) => (Cm.byMonth || {})[x] || 0), format: money, height: 230, highlight: keys.length - 1 });
      if (R && U.$('#affd-r')) C.line(U.$('#affd-r'), { labels: keys.map(mLabel), series: [{ name: 'New referrals', values: keys.map((x) => ((R.byMonth || {})[x] || {}).s || 0) }, { name: 'New customers', values: keys.map((x) => ((R.byMonth || {})[x] || {}).c || 0) }], height: 230, legend: U.$('#affd-r-legend') });
      if (R && U.$('#affd-funnel')) C.barList(U.$('#affd-funnel'), [{ label: 'Referred', value: R.total }, { label: 'Started a trial', value: Math.max(0, R.total - R.leads) }, { label: 'Became a customer', value: R.everCustomers }, { label: 'Still active', value: R.active }]);
      if (R && U.$('#affd-cc') && (R.byCountry || []).length) C.barList(U.$('#affd-cc'), R.byCountry.slice(0, 8).map((x) => ({ label: x.name, value: x.active || x.n })), { thin: true });
      if (Cm && U.$('#affd-sub') && (Cm.bySub || []).length) C.barList(U.$('#affd-sub'), Cm.bySub.slice(0, 8).map((x) => ({ label: x.name, value: x.amount })), { format: money, thin: true });
      if (Cm && U.$('#affd-plan') && (Cm.byPlan || []).length) C.barList(U.$('#affd-plan'), Cm.byPlan.map((x) => ({ label: planName(x, money), value: x.amount })), { format: money, thin: true });
    });

    const subNote = (() => {
      if (!R) return '';
      const tagged = (R.bySub || []).reduce((s, x) => s + x.n, 0);
      if (tagged / Math.max(1, R.total) >= 0.2) return '';
      return `<section class="panel affd-tip"><div><b>${int(tagged)} of ${int(R.total)} referrals carry a SubID</b><p class="muted">Add a SubID to the link in each video and email, for example <code>?fp_ref=yourname&amp;fp_sid=yt-video-name</code>. Then this page shows which piece of content brings customers, and the Content screen can rank ideas by what actually converts.</p></div></section>`;
    })();

    const trialRows = R ? (R.trialList || []).filter((t) => t.day != null && t.day <= 30) : [];
    return `${head}
      ${opts.note || ''}
      ${kpis(k)}
      ${missing && !opts.demo ? `<section class="panel affd-drop affd-strip"><p>${missing}</p>${pickBtn('Upload export', 'btn sm')}</section>` : ''}
      ${Cm ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Commissions per month</h2><span class="meta">Last 24 months · ${esc(cur)}</span></header><div id="affd-c"></div></section>` : ''}
      ${R ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Referrals and new customers</h2><div class="actions"><span id="affd-r-legend"></span></div></header><div id="affd-r"></div></section>` : ''}
      ${R ? `<div class="grid2" style="margin-top:var(--gap)">
        <section class="panel"><header><h2>Referral funnel</h2><span class="meta">All time · ${pc(R.conversion)} became customers</span></header><div id="affd-funnel"></div>
          <p class="meta affd-foot">${int(R.leads)} only gave an email at step one. ${int(R.cancelled)} cancelled. ${int(Math.max(0, (R.trials || 0) - (R.trialsNow || 0)))} signed up long ago and never paid.</p></section>
        <section class="panel"><header><h2>In trial now</h2><span class="meta">Signed up in the last 30 days</span></header>
          ${trialRows.length ? `<div class="rows">${trialRows.map((t) => `<div class="row"><div class="grow"><div class="t">${esc(t.email)}</div><div class="s">Day ${t.day} of the trial${t.sub ? ' · ' + esc(t.sub) : ''}</div></div><span class="pill ${t.day >= 10 ? 'warn' : 'acc'}">${t.day >= 10 ? 'Trial ending' : 'New'}</span></div>`).join('')}</div>` : U.empty('Nobody in trial right now', 'New trials from your link show up here after the next export.')}</section>
      </div>` : ''}
      ${subNote}
      <div class="grid2" style="margin-top:var(--gap)">
        ${R ? `<section class="panel"><header><h2>Newest customers</h2><span class="meta">${R.file ? (R.live ? "Exports and postbacks" : "From the Referrals export") : "From postbacks"}</span></header>${(R.recentCustomers || []).length ? `<div class="rows">${R.recentCustomers.slice(0, 8).map((x) => `<div class="row"><div class="grow"><div class="t">${esc(x.email)}</div><div class="s">Became a customer ${ago(x.at)}${x.sub ? ' · ' + esc(x.sub) : ''}</div></div><span class="pill ${x.state === 'active' ? 'pos' : 'neg'}">${x.state === 'active' ? 'Active' : 'Cancelled'}</span></div>`).join('')}</div>` : U.empty('No customers yet', '')}</section>` : ''}
        ${R && (R.byCountry || []).length ? `<section class="panel"><header><h2>Customers by country</h2><span class="meta">Billing country</span></header><div id="affd-cc"></div></section>` : ''}
        ${Cm && (Cm.bySub || []).length ? `<section class="panel"><header><h2>Commissions by SubID</h2><span class="meta">All time</span></header><div id="affd-sub"></div></section>` : ''}
        ${Cm && (Cm.byPlan || []).length ? `<section class="panel"><header><h2>By plan</h2><span class="meta">All time</span></header><div id="affd-plan"></div></section>` : ''}
      </div>
      ${peopleSection(d, money)}
      ${Cm && (Cm.topAccounts || []).length ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Accounts that paid you the most</h2><span class="meta">${int(Cm.accounts)} accounts in the file</span></header>
        <div class="table-wrap"><table><thead><tr><th>Account</th><th class="n">Commissions</th><th>Last one</th><th class="n">Total</th></tr></thead><tbody>
        ${Cm.topAccounts.slice(0, 10).map((a) => `<tr><td>${esc(a.name)}</td><td class="n">${int(a.n)}</td><td class="muted">${ago(a.last)}</td><td class="n"><b>${money(a.amount)}</b></td></tr>`).join('')}
        </tbody></table></div></section>` : ''}
      ${Cm && Object.keys(Cm.byMonth || {}).length ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Per month</h2><span class="meta">${esc(cur)}</span></header>
        <div class="table-wrap"><table><thead><tr><th>Month</th>${R ? '<th class="n">New referrals</th><th class="n">New customers</th>' : ''}<th class="n">Commissions</th></tr></thead><tbody>
        ${Object.keys(Cm.byMonth).sort().reverse().slice(0, 18).map((m) => `<tr><td>${mLabel(m, 0)}</td>${R ? `<td class="n">${int(((R.byMonth || {})[m] || {}).s || 0)}</td><td class="n">${int(((R.byMonth || {})[m] || {}).c || 0)}</td>` : ''}<td class="n"><b>${money(Cm.byMonth[m])}</b></td></tr>`).join('')}
        </tbody></table></div></section>` : ''}
      <p class="meta rev-foot">${files}${d.live && !opts.demo ? `${files ? '<span class="sep"> · </span>' : ''}Live from postbacks: ${int(d.live.events)} ${d.live.events === 1 ? 'event' : 'events'}${d.live.last ? ', latest ' + esc(dShort(d.live.last)) : ''}` : ''}</p>`;
  }

  const modeSeg = () => U.seg('revMode', mode(), [['demo', 'Demo'], ['live', 'Live']]);
  const SUB = 'Your HighLevel affiliate program, read from the portal exports.';

  // Demo workspace: sample program.
  V.affiliate = () => page(demoData(), { demo: true, sub: SUB, actions: `${pickBtn()}<button class="btn ghost" data-action="aff-open">Affiliate bonuses</button>`, note: '<p class="rev-note"><span class="pill acc">Sample data</span><span>This is the demo workspace. In your own workspace, drop the portal exports and this page fills with your real program.</span></p>' });

  // Postbacks since the last export: commissions and each referral's current status. Read once per visit, then every 5 minutes.
  const LG = { ws: null, data: null, at: 0, busy: false };
  function ledger() {
    if (!isLive() || !window.Auth || !window.Auth.affiliate) return null;
    const c = window.App.liveCtx(); const ws = c && c.ws && c.ws.id; if (!ws) return null;
    if (!LG.busy && (LG.ws !== ws || Date.now() - LG.at > 5 * 60e3)) {
      LG.busy = true; if (LG.ws !== ws) LG.data = null; LG.ws = ws; LG.at = Date.now();
      window.Auth.affiliate.api('ledger', { workspace_id: ws })
        .then((d) => { LG.data = d; if ((location.hash || '').slice(1) === 'affiliate') window.App.render(); })
        .catch(() => null).finally(() => { LG.busy = false; });
    }
    return LG.ws === ws ? LG.data : null;
  }

  // Private workspace: real exports plus live postbacks, with the same Demo/Live switch as Revenue for screen shares.
  V.affiliate.live = () => {
    const d = window.AffLive ? window.AffLive.merge(stored(), ledger()) : stored();
    if (!d) return emptyLive();
    const actions = `${pickBtn()}<button class="btn ghost" data-action="aff-open">Affiliate bonuses</button>${modeSeg()}`;
    if (mode() !== 'live') return page(demoData(), { demo: true, sub: SUB, actions, note: '<p class="rev-note"><span class="pill acc">Demo data</span><span>Sample numbers, safe for tutorials and screen shares. Switch to Live to see your uploaded exports.</span></p>' });
    return page(d, { sub: 'Your real HighLevel affiliate program. Postbacks keep it current; exports add the history from before. Nothing here is sample data.', actions });
  };
})();

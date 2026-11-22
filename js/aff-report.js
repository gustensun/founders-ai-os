/* Affiliate report reader. Takes a HighLevel (FirstPromoter) export, works out which one it is,
   and boils it down to the numbers the Affiliate screen draws. Runs in the browser, so the raw
   file never leaves the device. Only the summary is saved. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AffReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 864e5;

  function parseCsv(text) {
    const s = String(text || '').replace(/^\uFEFF/, '');
    const first = s.split(/\r?\n/, 1)[0] || '';
    const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length]);
    const D = counts.sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', inq = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inq) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += ch; }
      else if (ch === '"') inq = true;
      else if (ch === D) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim()));
  }

  const norm = (h) => String(h || '').trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
  function finder(h) {
    return (...tests) => {
      for (const t of tests) {
        const i = h.findIndex((x) => (typeof t === 'function' ? t(x) : t.test(x)));
        if (i >= 0) return i;
      }
      return -1;
    };
  }
  // "2025-11-20 21:24:34 UTC", "11/20/2025", "2025-11-20T21:24:34Z", "20.11.2025"
  function toTime(v) {
    const s = String(v || '').trim(); if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return Date.UTC(+m[3], +m[1] - 1, +m[2]);
    const d = Date.parse(s); return isNaN(d) ? null : d;
  }
  function toNum(v) {
    let s = String(v == null ? '' : v).trim(); if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s); return isNaN(n) ? NaN : (neg ? -n : n);
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  const month = (t) => new Date(t).toISOString().slice(0, 7);
  const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const top = (map, n) => Object.values(map).sort((a, b) => (b.amount || b.n) - (a.amount || a.n)).slice(0, n);

  function detect(h) {
    const f = finder(h);
    const amount = f(/^(commission|reward|payout|earnings?)( amount)?( \(.*\))?$/, (x) => /commission|reward|payout|earning/.test(x) && !/rate|percent|%|\bid$|type|status|plan|date|count/.test(x), /^(amount|net amount|value)( \(.*\))?$/, (x) => /amount/.test(x) && !/sale|order|revenue|price|gross/.test(x));
    const state = f(/^(state|lead state|referral state|customer state)$/);
    const since = f(/customer since|converted|first payment/);
    if (amount >= 0) return 'commissions';
    if (state >= 0 || since >= 0) return 'referrals';
    return null;
  }

  function referrals(rows, h, now) {
    const f = finder(h);
    const ci = { email: f(/^(email|lead email|referral email|customer email)$/, /email/), state: f(/^(state|lead state|referral state|customer state)$/, /status/), created: f(/^(created at|created|signup date|date)$/, /created|signed up|date/), since: f(/customer since|converted|first payment/), sub: f(/^sub ?id$/, /sub ?id|campaign|tracking|utm/), country: f(/country/), plan: f(/^plan/) };
    const states = {}, byMonth = {}, bySub = {}, byCountry = {}, trials = [], recent = [], people = [];
    let total = 0, ever = 0, l30s = 0, p30s = 0, l30c = 0, p30c = 0, first = null, last = null;
    for (const r of rows) {
      const st = clip(r[ci.state], 30).toLowerCase() || 'unknown';
      const created = toTime(r[ci.created]); const since = ci.since >= 0 ? toTime(r[ci.since]) : null;
      total++; states[st] = (states[st] || 0) + 1;
      const isCust = !!since || st === 'active';
      if (isCust) ever++;
      if (created) {
        first = first == null ? created : Math.min(first, created); last = last == null ? created : Math.max(last, created);
        const k = month(created); (byMonth[k] = byMonth[k] || { s: 0, c: 0 }).s++;
        if (now - created < 30 * DAY) l30s++; else if (now - created < 60 * DAY) p30s++;
      }
      if (since) {
        const k = month(since); (byMonth[k] = byMonth[k] || { s: 0, c: 0 }).c++;
        if (now - since < 30 * DAY) l30c++; else if (now - since < 60 * DAY) p30c++;
      }
      const sub = clip(r[ci.sub], 60);
      if (sub) { const g = (bySub[sub] = bySub[sub] || { name: sub, n: 0, active: 0, ever: 0 }); g.n++; if (st === 'active') g.active++; if (isCust) g.ever++; }
      const cc = clip(r[ci.country], 40).toUpperCase() || '';
      if (cc) { const g = (byCountry[cc] = byCountry[cc] || { name: cc, n: 0, active: 0 }); g.n++; if (st === 'active') g.active++; }
      const email = clip(r[ci.email], 120);
      if (people.length < 8000) people.push([email, st, created ? new Date(created).toISOString().slice(0, 10) : '', since ? new Date(since).toISOString().slice(0, 10) : '', sub, cc]);
      if (st === 'signup' || /trial/.test(st)) trials.push({ email, at: created ? new Date(created).toISOString() : '', day: created ? Math.max(1, Math.ceil((now - created) / DAY)) : null, sub });
      if (since) recent.push({ email, at: new Date(since).toISOString(), state: st, sub });
    }
    trials.sort((a, b) => (b.at > a.at ? 1 : -1));
    recent.sort((a, b) => (b.at > a.at ? 1 : -1));
    const active = states.active || 0;
    return {
      kind: 'referrals', total, states, active, trials: trials.length, leads: states.subscribed || 0, cancelled: states.cancelled || 0,
      everCustomers: ever, retention: ever ? r2(active / ever) : 0, conversion: total ? r2(ever / total) : 0,
      last30: { signups: l30s, customers: l30c }, prev30: { signups: p30s, customers: p30c },
      byMonth, bySub: top(bySub, 12), byCountry: top(byCountry, 10),
      people, cancelledPaid: people.filter((x) => x[1] === 'cancelled' && x[3]).length, trialsNow: trials.filter((t) => t.day != null && t.day <= 30).length, trialList: trials.slice(0, 40), recentCustomers: recent.slice(0, 20),
      range: { from: first ? new Date(first).toISOString() : null, to: last ? new Date(last).toISOString() : null },
    };
  }

  function commissions(rows, h, now) {
    const f = finder(h);
    const ci = {
      amount: f(/^(commission|reward|payout|earnings?)( amount)?( \(.*\))?$/, (x) => /commission|reward|payout|earning/.test(x) && !/rate|percent|%|\bid$|type|status|plan|date|count/.test(x), /^(amount|net amount|value)( \(.*\))?$/, (x) => /amount/.test(x) && !/sale|order|revenue|price|gross/.test(x)),
      date: f(/^(created at|created|date|commission date|reward date)$/, /created|date|paid|period/),
      status: f(/^(status|state|reward status|commission status)$/, /status/),
      email: f(/^(lead email|referral email|customer email|referral|customer)$/, (x) => /email/.test(x) && !/promoter|affiliate|partner/.test(x), /customer|referr?al|lead|name/),
      sub: f(/^sub ?id$/, /sub ?id|campaign|tracking|utm|source/),
      plan: f(/^(plan|plan name|product)$/, /plan|product/),
      sale: f(/sale amount|sale|order amount|revenue/),
      cur: f(/^currency$/),
    };
    const cents = /cents/.test(h[ci.amount] || '');
    const byMonth = {}, byStatus = {}, bySub = {}, accounts = {}, byPlan = {}, recent = [];
    let total = 0, n = 0, skipped = 0, l30 = 0, p30 = 0, currency = '';
    for (const r of rows) {
      let a = toNum(r[ci.amount]); if (isNaN(a) || !a) { skipped++; continue; }
      if (cents) a = a / 100;
      const st = clip(r[ci.status], 30).toLowerCase();
      byStatus[st || 'none'] = r2((byStatus[st || 'none'] || 0) + a);
      if (/declin|reject|denied|void|cancel/.test(st)) { skipped++; continue; }
      const t = toTime(r[ci.date]);
      total += a; n++;
      if (!currency && ci.cur >= 0) currency = clip(r[ci.cur], 5).toUpperCase();
      if (t) { const k = month(t); byMonth[k] = r2((byMonth[k] || 0) + a); if (now - t < 30 * DAY) l30 += a; else if (now - t < 60 * DAY) p30 += a; }
      const sub = clip(r[ci.sub], 60) || 'No SubID';
      const g = (bySub[sub] = bySub[sub] || { name: sub, amount: 0, n: 0 }); g.amount += a; g.n++;
      const who = clip(r[ci.email], 120) || 'Unknown';
      const ac = (accounts[who] = accounts[who] || { name: who, amount: 0, n: 0, last: '' }); ac.amount += a; ac.n++;
      if (t) { const iso = new Date(t).toISOString(); if (iso > ac.last) ac.last = iso; }
      const pl = clip(r[ci.plan], 60); if (pl) { const p = (byPlan[pl] = byPlan[pl] || { name: pl, amount: 0, n: 0 }); p.amount += a; p.n++; }
      recent.push({ who, amount: r2(a), at: t ? new Date(t).toISOString() : '', status: st, sub: sub === 'No SubID' ? '' : sub });
    }
    recent.sort((a, b) => (b.at > a.at ? 1 : -1));
    const keys = Object.keys(byMonth).sort();
    const thisMonth = month(now);
    const full = keys.filter((k) => k < thisMonth).slice(-12);
    const avg12 = full.length ? r2(full.reduce((s, k) => s + byMonth[k], 0) / full.length) : 0;
    const peak = keys.reduce((p, k) => (byMonth[k] > p.v ? { k, v: byMonth[k] } : p), { k: null, v: 0 });
    // Accounts that earned in the latest full month are the ones still paying.
    const lastFull = full[full.length - 1];
    const paying = lastFull ? Object.values(accounts).filter((a) => a.last && a.last.slice(0, 7) >= lastFull).length : 0;
    const rnd = (l) => l.map((x) => ({ ...x, amount: r2(x.amount) }));
    const byEmail = {}; Object.values(accounts).slice(0, 8000).forEach((a) => { if (a.name && a.name !== 'Unknown') byEmail[a.name.toLowerCase()] = [r2(a.amount), a.n, (a.last || '').slice(0, 10)]; });
    return {
      kind: 'commissions', total: r2(total), rows: n, skipped, currency: currency || 'USD', cents,
      last30: r2(l30), prev30: r2(p30), avg12, peak, paying, accounts: Object.keys(accounts).length,
      byMonth, byStatus, byEmail, bySub: rnd(top(bySub, 12)), byPlan: rnd(top(byPlan, 8)), topAccounts: rnd(top(accounts, 15)), recent: recent.slice(0, 15),
      range: { from: keys[0] || null, to: keys[keys.length - 1] || null },
    };
  }

  function read(text, opts = {}) {
    const now = opts.now || Date.now();
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('That file has no rows. Export it as CSV and try again.');
    const h = rows[0].map(norm);
    const kind = detect(h);
    if (!kind) throw new Error('This does not look like an affiliate export. Columns found: ' + rows[0].slice(0, 8).join(', ') + '. Upload the Referrals or Commissions export from the HighLevel affiliate portal.');
    const body = rows.slice(1);
    const out = kind === 'referrals' ? referrals(body, h, now) : commissions(body, h, now);
    out.file = clip(opts.filename, 80) || kind + '.csv';
    out.asOf = new Date(now).toISOString();
    out.columns = rows[0].slice(0, 20).map((c) => clip(c, 40));
    return out;
  }

  return { read, parseCsv, toTime, toNum, detect: (hdr) => detect(hdr.map(norm)) };
});

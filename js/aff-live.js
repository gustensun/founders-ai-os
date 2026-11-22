// Affiliate page, live: the portal exports plus every postback since. The exports cover the past up to the day they
// were uploaded; postbacks add each commission and status change after that, so nothing needs uploading again.
// Works with no export at all: the page is then built from postbacks alone.
(function () {
  const DAY = 864e5;
  const r2 = (x) => Math.round((+x || 0) * 100) / 100;
  const ym = (iso) => String(iso || '').slice(0, 7);
  const ST = { trial: 'signup', active: 'active', cancelled: 'cancelled', lead: 'subscribed' };

  function commissions(Cm, L, now) {
    const cur = (Cm && Cm.currency) || 'USD';
    const cut = Cm ? Date.parse(Cm.asOf || Cm.uploaded_at || '') || 0 : 0;
    const pb = ((L && L.commissions) || []).map((c) => ({ ...c, t: Date.parse(c.at) })).filter((c) => Number.isFinite(c.t) && c.t > cut && String(c.currency || 'USD').toUpperCase() === cur && c.amount);
    if (!Cm && !pb.length) return null;
    const base = Cm || { kind: 'commissions', currency: cur, total: 0, rows: 0, accounts: 0, paying: 0, byMonth: {}, byEmail: {}, bySub: [], byPlan: [], topAccounts: [] };
    if (!pb.length) return base;
    const byMonth = { ...(base.byMonth || {}) }; const byEmail = { ...(base.byEmail || {}) };
    for (const c of pb) {
      const k = ym(c.at); byMonth[k] = r2((byMonth[k] || 0) + c.amount);
      if (c.email) { const e = (byEmail[c.email] || [0, 0, '']).slice(); e[0] = r2(e[0] + c.amount); if (c.amount > 0) { e[1]++; const d = c.at.slice(0, 10); if (d > e[2]) e[2] = d; } byEmail[c.email] = e; }
    }
    // The export's own 30-day totals end on its date. Keep the part of them still inside each window, then add postbacks.
    const ov = (a, z, lo, hi) => Math.max(0, Math.min(z, hi) - Math.max(a, lo)) / (30 * DAY);
    const part = (a, z) => (Cm && cut ? (+base.last30 || 0) * ov(a, z, cut - 30 * DAY, cut) + (+base.prev30 || 0) * ov(a, z, cut - 60 * DAY, cut - 30 * DAY) : 0);
    const win = (a, z) => pb.filter((c) => c.t > a && c.t <= z).reduce((s, c) => s + c.amount, 0);
    const last30 = r2(win(now - 30 * DAY, now) + part(now - 30 * DAY, now));
    const prev30 = r2(win(now - 60 * DAY, now - 30 * DAY) + part(now - 60 * DAY, now - 30 * DAY));
    const keys = Object.keys(byMonth).sort(); const thisMonth = ym(new Date(now).toISOString());
    const full = keys.filter((k) => k < thisMonth).slice(-12);
    const avg12 = full.length ? r2(full.reduce((s, k) => s + byMonth[k], 0) / full.length) : 0;
    const peak = keys.reduce((p, k) => (byMonth[k] > p.v ? { k, v: byMonth[k] } : p), { k: null, v: 0 });
    const emails = new Set(pb.map((c) => c.email).filter(Boolean));
    return { ...base, byMonth, byEmail, avg12, peak, last30, prev30, total: r2((+base.total || 0) + pb.reduce((s, c) => s + c.amount, 0)), rows: (+base.rows || 0) + pb.length,
      accounts: Math.max(+base.accounts || 0, Object.keys(byEmail).length), paying: Cm ? base.paying : emails.size, postbacks: pb.length, live: true };
  }

  function referrals(R, L, now) {
    const lp = (L && L.people) || [];
    if (!R && !lp.length) return null;
    const cutDay = R ? new Date(Date.parse(R.asOf || R.uploaded_at || '') || 0).toISOString().slice(0, 10) : '';
    const base = R || { kind: 'referrals', total: 0, states: {}, people: [], byMonth: {}, last30: { signups: 0, customers: 0 }, prev30: { signups: 0, customers: 0 }, bySub: [], byCountry: [], trialList: [], recentCustomers: [], everCustomers: 0, trials: 0 };
    const people = (base.people || []).map((x) => x.slice()); const idx = {}; people.forEach((x, i) => { idx[String(x[0]).toLowerCase()] = i; });
    const byMonth = JSON.parse(JSON.stringify(base.byMonth || {}));
    const l30 = { ...(base.last30 || { signups: 0, customers: 0 }) }, p30 = { ...(base.prev30 || { signups: 0, customers: 0 }) };
    const bump = (iso, f) => { if (!iso) return; const t = Date.parse(iso + 'T12:00:00Z'); const k = ym(iso); (byMonth[k] = byMonth[k] || { s: 0, c: 0 })[f]++; if (t > now - 30 * DAY) l30[f === 's' ? 'signups' : 'customers']++; else if (t > now - 60 * DAY) p30[f === 's' ? 'signups' : 'customers']++; };
    let addedEver = 0; const recent = [], trials = [];
    for (const p of lp) {
      if (p.last < cutDay) continue; // nothing new since the export
      const st = ST[p.state] || 'subscribed'; const i = idx[p.email];
      if (i == null) {
        people.push([p.email, st, p.first, p.since, p.sub || '', '']); idx[p.email] = people.length - 1;
        if (!R || p.first >= cutDay) bump(p.first, 's');
        if (p.since) { addedEver++; bump(p.since, 'c'); }
      } else {
        const x = people[i];
        x[1] = st; if (p.since && !x[3]) { x[3] = p.since; addedEver++; bump(p.since, 'c'); }
        if (!x[4] && p.sub) x[4] = p.sub;
      }
      if (p.since && p.since >= cutDay) recent.push({ email: p.email, at: p.since + 'T12:00:00Z', state: st === 'active' ? 'active' : 'cancelled', sub: p.sub || '' });
      if (st === 'signup') { const at = p.trial_at || p.first; const day = Math.max(0, Math.floor((now - Date.parse(at + 'T00:00:00Z')) / DAY)); trials.push({ email: p.email, at: at + 'T12:00:00Z', day, sub: p.sub || '' }); }
    }
    const states = {}; people.forEach((x) => { states[x[1]] = (states[x[1]] || 0) + 1; });
    const live = new Set(lp.map((p) => p.email));
    const trialList = trials.concat((base.trialList || []).filter((t) => !live.has(String(t.email).toLowerCase()) && (people[idx[String(t.email).toLowerCase()]] || [])[1] !== 'active')).sort((a, b) => (b.at > a.at ? 1 : -1));
    const active = states.active || 0; const ever = (+base.everCustomers || 0) + addedEver; const total = Math.max(people.length, (+base.total || 0) + (people.length - (base.people || []).length));
    return { ...base, people, states, byMonth, last30: l30, prev30: p30, active, cancelled: states.cancelled || 0, leads: states.subscribed || 0, total,
      everCustomers: ever, retention: ever ? r2(active / ever) : 0, conversion: total ? r2(ever / total) : 0,
      cancelledPaid: people.filter((x) => x[1] === 'cancelled' && x[3]).length, trialList, trialsNow: trialList.filter((t) => t.day != null && t.day <= 30).length,
      trials: Math.max(+base.trials || 0, trialList.length), recentCustomers: recent.sort((a, b) => (b.at > a.at ? 1 : -1)).concat(base.recentCustomers || []).slice(0, 20), live: true };
  }

  function merge(stored, L, now = Date.now()) {
    const s = stored || {}; if (!L) return stored || null;
    const commissionsOut = commissions(s.commissions || null, L, now); const referralsOut = referrals(s.referrals || null, L, now);
    if (!commissionsOut && !referralsOut) return stored || null;
    return { ...s, commissions: commissionsOut, referrals: referralsOut, live: { events: L.events || 0, last: (L.people && L.people[0] && L.people[0].last) || null, commissions: (L.commissions || []).length } };
  }

  const api = { merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AffLive = api;
})();

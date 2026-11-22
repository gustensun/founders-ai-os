// Founders AI OS: one revenue picture from HighLevel payments, Stripe and affiliate commissions.
// HighLevel takes its payments through the founder's own Stripe account, so the same charge can sit in both places.
// A Stripe charge that HighLevel already holds (same payment intent or charge id) is counted once, under HighLevel.
// Everything is summarised here. Raw charges never leave the server.
const HL = 'https://services.leadconnectorhq.com';
const STRIPE = 'https://api.stripe.com/v1';
const DAY = 864e5;
const ZERO = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const r2 = (n) => Math.round((+n || 0) * 100) / 100;
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const cur = (c) => String(c || 'usd').toUpperCase();
const q = encodeURIComponent;

function span(months, now) {
  const d = new Date(now); const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1));
  const keys = Array.from({ length: months }, (_, i) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  return { start, keys };
}

/* ---------- affiliate postbacks ---------- */
// HighLevel's affiliate program runs on FirstPromoter. Its "New Commission" postback carries the commission itself.
// FirstPromoter sends money in cents (v1 reward_created, v2 commission.created and commission.updated).
// Returns the signed commission in dollars, or null when the event is not a cash commission we should count.
const UNDO = /refund|revers|declin|denied|reject|void|delet|chargeback/;
function commissionOf(p) {
  if (!p || typeof p !== 'object') return null;
  const evo = p.event && typeof p.event === 'object' ? p.event : null;
  const ev = String((evo && (evo.type || evo.name)) || p.event_type || (typeof p.event === 'string' ? p.event : '') || p.type || '').toLowerCase();
  const fp = !!((evo && evo.type) || p.event_type);
  const d = p.data && typeof p.data === 'object' ? p.data : p;
  if (d.unit && String(d.unit).toLowerCase() !== 'cash') return null;
  const c = d.amount_cents != null ? d.amount_cents : d.commission_cents;
  let a = c != null ? +c / 100 : +(d.amount != null ? d.amount : d.commission != null ? d.commission : d.commission_amount);
  if (!Number.isFinite(a) || !a) return null;
  if (c == null && fp) a = a / 100;
  let sign = 1; let when = d.created_at || (evo && evo.created_at) || p.timestamp;
  if (/updated/.test(ev)) {
    // Only a status change in or out of a reversal moves money. Other updates repeat a commission already counted.
    const ch = p.changes && p.changes.status; if (!Array.isArray(ch)) return null;
    const was = UNDO.test(String(ch[0] || '').toLowerCase()); const now = UNDO.test(String(ch[1] || '').toLowerCase());
    if (was === now) return null; sign = now ? -1 : 1; when = p.timestamp || d.status_updated_at || when;
  } else if (UNDO.test(ev)) sign = -1;
  else if (UNDO.test(String(d.status || '').toLowerCase())) return null;
  const t = Date.parse(when || '');
  return { amount: r2(sign * Math.abs(a)), currency: cur(d.original_sale_currency || d.currency || 'USD'), at: Number.isFinite(t) ? new Date(t).toISOString() : null };
}

/* ---------- readers ---------- */
async function hlTx(c, months, now = Date.now()) {
  const { start } = span(months, now);
  const get = async (p) => {
    const r = await fetch(HL + p, { headers: { Authorization: 'Bearer ' + c.token, Version: '2021-07-28', Accept: 'application/json' } });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
    if (!r.ok) {
      const m = j && (Array.isArray(j.message) ? j.message.join(', ') : j.message || j.error);
      const e = new Error(r.status === 401 ? 'HighLevel did not accept the saved token. Reconnect HighLevel in Connections.' : r.status === 403 || /scope/i.test(m || '') ? 'Your HighLevel connection needs the payments/transactions.readonly scope. Add it and reconnect.' : 'HighLevel payments could not be read right now.');
      e.code = r.status; throw e;
    }
    return j || {};
  };
  const base = `/payments/transactions?altId=${q(c.location_id)}&altType=location&startAt=${start.toISOString()}&endAt=${new Date(now).toISOString()}&limit=500`;
  const first = await get(base + '&offset=0');
  const total = Math.min(first.totalCount || 0, 6000); const offs = []; for (let o = 500; o < total; o += 500) offs.push(o);
  const rest = [];
  for (let i = 0; i < offs.length; i += 6) rest.push(...await Promise.all(offs.slice(i, i + 6).map((o) => get(base + '&offset=' + o).then((j) => j.data || []))));
  const seen = new Set();
  return [...(first.data || []), ...rest.flat()].filter((x) => x && x._id && !seen.has(x._id) && seen.add(x._id));
}

// One lane per month, so a busy account still loads in a couple of seconds.
async function stripeCharges(key, months, now = Date.now()) {
  const { start, keys } = span(months, now);
  const get = async (p) => {
    const r = await fetch(STRIPE + p, { headers: { Authorization: 'Bearer ' + key } });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const e = new Error(r.status === 401 ? 'Stripe did not accept the saved key. Reconnect Stripe in Connections.' : r.status === 403 ? 'The Stripe key needs read access to Charges. Update the restricted key and reconnect.' : r.status === 429 ? 'Stripe is rate limiting right now. Try again in a minute.' : 'Stripe could not be read right now.');
      e.code = r.status; throw e;
    }
    return j || {};
  };
  let capped = false;
  const lane = async (i) => {
    const a = i === 0 ? start : new Date(keys[i] + '-01T00:00:00Z'); const z = i === keys.length - 1 ? new Date(now + 1000) : new Date(keys[i + 1] + '-01T00:00:00Z');
    let all = []; let after = null;
    for (let n = 0; n < 15; n++) {
      const j = await get(`/charges?limit=100&created[gte]=${Math.floor(a / 1000)}&created[lt]=${Math.floor(z / 1000)}${after ? '&starting_after=' + q(after) : ''}`);
      all = all.concat(j.data || []);
      if (!j.has_more || !(j.data || []).length) return all;
      after = j.data[j.data.length - 1].id;
    }
    capped = true; return all;
  };
  const out = []; for (let i = 0; i < keys.length; i += 6) out.push(...await Promise.all(keys.slice(i, i + 6).map((_, k) => lane(i + k))));
  return { list: out.flat(), capped };
}

/* ---------- names for Stripe charges that HighLevel does not hold ---------- */
const WALLET = /^auto-?recharge for sub-?account\s*-\s*(.+?)\s+of\s+[A-Z]{3}\b/i;
function stripeSource(c) {
  const d = clip(c.description, 120);
  if (/^auto-?recharge for sub-?account/i.test(d)) return 'Sub-account wallet recharges';
  if (/^subscription (update|creation)/i.test(d) || c.invoice) return 'Stripe subscriptions';
  if (/^(payment for invoice|invoice)\b/i.test(d)) return 'Stripe invoices';
  return d ? clip(d.replace(/\s*[-·:]?\s*(USD|EUR|GBP)?\s*[\d.,]+\s*$/i, ''), 60) || 'Stripe payments' : 'Stripe payments';
}
function stripeWho(c) {
  const b = c.billing_details || {}; const w = WALLET.exec(clip(c.description, 200));
  const email = clip(b.email || c.receipt_email, 120).toLowerCase();
  return { name: clip(b.name, 80) || (w && clip(w[1], 80)) || email || 'Stripe customer', email };
}
const stripeRecurring = (c) => !!c.invoice || /^subscription (update|creation)/i.test(clip(c.description, 60));

/* ---------- the merge ---------- */
function combine({ now = Date.now(), months = 12, hl = null, stripe = null, affiliate = null, postbacks = null, errors = {}, capped = false } = {}) {
  const { keys } = span(months, now); const first = keys[0];
  const month = (ms) => new Date(ms).toISOString().slice(0, 7);
  const count = (list, f) => Object.entries(list.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

  const hlLive = (hl || []).filter((x) => x.liveMode !== false);
  const stLive = ((stripe && stripe.list) || stripe || []).filter((c) => c && c.livemode !== false);
  const C = affiliate && affiliate.byMonth ? affiliate : null;
  const top = count(hlLive.filter((x) => x.status === 'succeeded'), (x) => cur(x.currency))[0] || count(stLive.filter((c) => c.paid), (c) => cur(c.currency))[0];
  const currency = top ? top[0] : C ? cur(C.currency) : 'USD';

  // Every id HighLevel holds for a charge, test mode and other currencies included, so nothing of theirs is added twice.
  const held = new Set();
  for (const x of hl || []) {
    const s = x.chargeSnapshot || {};
    [x.chargeId, s.id, s.latest_charge, s.payment_intent].forEach((v) => { if (typeof v === 'string' && v) held.add(v); });
    ((s.charges && s.charges.data) || []).forEach((ch) => ch && ch.id && held.add(ch.id));
  }

  const P = [];
  const srcHL = (x) => x.entitySourceName || (x.entitySourceType ? String(x.entitySourceType).replace(/_/g, ' ') : '') || 'Direct';
  for (const x of hlLive) {
    if (cur(x.currency) !== currency) continue;
    const at = Date.parse(x.createdAt); if (!Number.isFinite(at)) continue;
    const status = x.status === 'partially_refunded' ? 'refunded' : x.status;
    P.push({ via: 'highlevel', at, amount: +x.amount || 0, status, name: x.contactName || x.contactEmail || 'Unknown', email: String(x.contactEmail || '').toLowerCase(), source: srcHL(x), recurring: !!x.subscriptionId });
  }
  let dupes = 0; let otherSt = 0;
  for (const c of stLive) {
    if (held.has(c.id) || (c.payment_intent && held.has(typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent.id))) { dupes++; continue; }
    if (cur(c.currency) !== currency) { otherSt++; continue; }
    const div = ZERO.has(currency) ? 1 : 100; const at = (+c.created || 0) * 1000; if (!at) continue;
    const who = stripeWho(c); const base = { via: 'stripe', at, name: who.name, email: who.email, source: stripeSource(c), recurring: stripeRecurring(c) };
    const back = (+c.amount_refunded || 0) / div; const net = (+c.amount || 0) / div - back;
    if (c.status === 'failed') { P.push({ ...base, amount: (+c.amount || 0) / div, status: 'failed' }); continue; }
    if (c.status === 'pending') { P.push({ ...base, amount: (+c.amount || 0) / div, status: 'pending' }); continue; }
    if (!c.paid || c.status !== 'succeeded') continue;
    if (net > 0) P.push({ ...base, amount: r2(net), status: 'succeeded' });
    if (back > 0) P.push({ ...base, amount: r2(back), status: 'refunded' });
  }
  const otherHL = hlLive.length - hlLive.filter((x) => cur(x.currency) === currency).length;

  const inWin = P.filter((p) => month(p.at) >= first);
  const paid = inWin.filter((p) => p.status === 'succeeded'); const refunded = inWin.filter((p) => p.status === 'refunded'); const failed = inWin.filter((p) => p.status === 'failed');
  const sum = (l) => r2(l.reduce((s, p) => s + p.amount, 0));
  const inDays = (p, a, z) => p.at >= now - a * DAY && p.at < now - z * DAY;
  // Affiliate commissions: the uploaded export covers everything up to its date, postbacks add every commission after it.
  const affOn = !!C && cur(C.currency) === currency;
  const cut = C ? Date.parse(C.asOf || C.uploaded_at || '') || 0 : 0;
  const PB = ((postbacks && postbacks.list) || []).map((e) => ({ at: Date.parse(e.at), amount: +e.amount || 0, currency: cur(e.currency) })).filter((e) => Number.isFinite(e.at) && e.amount && e.at > cut);
  const pbIn = PB.filter((e) => e.currency === currency); const pbOther = PB.length - pbIn.length;
  const pbSum = (a, z) => r2(pbIn.filter((e) => e.at > a && e.at <= z).reduce((s, e) => s + e.amount, 0));
  // The export's share of a window. Exact when the export has daily totals, otherwise spread evenly over its 30-day windows.
  let estimated = false;
  const expPart = (a, z) => {
    if (!affOn) return 0; const hi = Math.min(z, cut); if (hi <= a) return 0;
    if (C.byDay) return r2(Object.entries(C.byDay).reduce((s, [d, v]) => { const t = Date.parse(d + 'T12:00:00Z'); return t > a && t <= hi ? s + (+v || 0) : s; }, 0));
    let out = 0;
    for (const [lo, up, v] of [[cut - 30 * DAY, cut, +C.last30 || 0], [cut - 60 * DAY, cut - 30 * DAY, +C.prev30 || 0]]) {
      const o = Math.min(up, hi) - Math.max(lo, a); if (o <= 0) continue;
      if (o < up - lo - 1000) estimated = true; out += v * (o / (up - lo));
    }
    return r2(out);
  };
  const affM = (k) => r2((affOn ? +(C.byMonth || {})[k] || 0 : 0) + pbIn.filter((e) => month(e.at) === k).reduce((s, e) => s + e.amount, 0));
  // With no commission after the export yet, the export's own 30-day windows stand, and the page says which date they end on.
  const expOnly = !pbIn.length;
  const aff30 = expOnly ? (affOn ? r2(C.last30) : 0) : r2(expPart(now - 30 * DAY, now) + pbSum(now - 30 * DAY, now));
  const affPrev = expOnly ? (affOn ? r2(C.prev30) : 0) : r2(expPart(now - 60 * DAY, now - 30 * DAY) + pbSum(now - 60 * DAY, now - 30 * DAY));
  const pbLast = PB.length ? new Date(Math.max(...PB.map((e) => e.at))).toISOString() : (postbacks && postbacks.last_commission) || null;

  const byMonth = keys.map((k) => {
    const l = paid.filter((p) => month(p.at) === k); const h = sum(l.filter((p) => p.via === 'highlevel')); const s = sum(l.filter((p) => p.via === 'stripe')); const a = affM(k);
    return { month: k, gross: r2(h + s + a), highlevel: h, stripe: s, affiliate: a, count: l.length, recurring: sum(l.filter((p) => p.recurring)), refunds: sum(refunded.filter((p) => month(p.at) === k)) };
  });
  const group = (l, f) => Object.values(l.reduce((m, p) => { const k = f(p) || 'Other'; (m[k] = m[k] || { name: k, amount: 0, count: 0, via: p.via, email: p.email || '', label: p.name }); m[k].amount += p.amount; m[k].count++; if (!m[k].email && p.email) m[k].email = p.email; return m; }, {})).map((g) => ({ ...g, amount: r2(g.amount) })).sort((a, b) => b.amount - a.amount);
  const stream = (id) => { const l = paid.filter((p) => p.via === id); return { last30: sum(l.filter((p) => inDays(p, 30, 0))), prev30: sum(l.filter((p) => inDays(p, 60, 30))), count30: l.filter((p) => inDays(p, 30, 0)).length, total: sum(l) }; };
  const affTotal = r2(keys.reduce((s, k) => s + affM(k), 0));
  const streams = [
    { id: 'highlevel', name: 'HighLevel', on: !!hl, error: errors.highlevel || null, ...stream('highlevel') },
    { id: 'stripe', name: 'Stripe', on: !!stripe, error: errors.stripe || null, ...stream('stripe'), already_in_highlevel: dupes },
    { id: 'affiliate', name: 'Affiliate commissions', on: !!C || PB.length > 0 || !!(postbacks && postbacks.wired), error: C && !affOn ? `Commissions are in ${cur(C.currency)}, so they are not added to the ${currency} total.` : null, last30: aff30, prev30: affPrev, count30: pbIn.filter((e) => e.at > now - 30 * DAY && e.amount > 0).length || null, total: affTotal, as_of: C ? C.asOf || C.uploaded_at || null : null,
      postbacks: { wired: !!(postbacks && postbacks.wired) || PB.length > 0, after_export: pbIn.length, last_commission: pbLast, other_currency: pbOther }, estimated },
  ];
  const bySource = group(paid, (p) => p.source).map((g) => ({ name: g.name, amount: g.amount, count: g.count, via: g.via }));
  if (affTotal) bySource.push({ name: 'Affiliate commissions', amount: affTotal, count: null, via: 'affiliate' });
  bySource.sort((a, b) => b.amount - a.amount);

  return {
    currency, months, combined: true, streams,
    other_currencies: otherHL + otherSt + pbOther, capped: !!capped || !!(stripe && stripe.capped),
    last30: r2(sum(paid.filter((p) => inDays(p, 30, 0))) + aff30), prev30: r2(sum(paid.filter((p) => inDays(p, 60, 30))) + affPrev),
    count30: paid.filter((p) => inDays(p, 30, 0)).length,
    refunds30: sum(refunded.filter((p) => inDays(p, 30, 0))), failed30: failed.filter((p) => inDays(p, 30, 0)).length, failed30_amount: sum(failed.filter((p) => inDays(p, 30, 0))),
    payments12: sum(paid), recurring12: sum(paid.filter((p) => p.recurring)),
    byMonth, bySource: bySource.slice(0, 10),
    customers: group(paid, (p) => p.email || p.name).slice(0, 8).map((g) => ({ name: g.label, email: g.email, amount: g.amount, count: g.count })),
    recent: inWin.slice().sort((a, b) => b.at - a.at).slice(0, 20).map((p) => ({ at: new Date(p.at).toISOString(), name: p.name, amount: p.amount, status: p.status, source: p.source, recurring: p.recurring, via: p.via })),
  };
}

// Read whatever is connected and merge it. A source that fails is reported on its own row, and the rest still load.
async function read({ hl = null, stripeKey = null, affiliate = null, postbacks = null, months = 12, now = Date.now() } = {}) {
  const errors = {};
  const [tx, ch] = await Promise.all([
    hl ? hlTx(hl, months, now).catch((e) => { errors.highlevel = e.message; return null; }) : null,
    stripeKey ? stripeCharges(stripeKey, months, now).catch((e) => { errors.stripe = e.message; return null; }) : null,
  ]);
  const out = combine({ now, months, hl: tx, stripe: ch, affiliate, postbacks, errors });
  out.streams.forEach((s) => { if (s.id === 'highlevel' && hl) s.on = true; if (s.id === 'stripe' && stripeKey) s.on = true; });
  return out;
}

module.exports = { combine, read, hlTx, stripeCharges, span, commissionOf };

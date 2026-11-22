// HighLevel affiliate postbacks. HighLevel's affiliate program (run on FirstPromoter) calls this URL when someone
// uses the founder's link: step one of the form, trial started, first payment, commission, cancellation.
// Each event tags the person in the founder's own HighLevel sub-account. A HighLevel workflow on that tag sends the
// bonus email, so the email stays editable in HighLevel. Every event is logged once, so resends never double-tag.
//
// The plan they chose (Starter, Unlimited, Founder) gets its own tag, so each plan can have its own bonus workflow.
// Plan tags only ever move up. A first Founder tag can also invite the person to the founder's Skool groups.
//
//   POST /api/affiliate?k=<workspace token>[&e=trial]   postback from HighLevel (no session)
//   POST /api/affiliate  {action:'info'|'rotate'|'rules'|'skool'|'preview'|'ledger', workspace_id}   signed-in founder
const { rpc, sb, open, seal, clip, crypto, q } = require('./_lib');

const HL = 'https://services.leadconnectorhq.com';
const KINDS = ['lead', 'trial', 'customer', 'commission', 'cancelled'];
const PLANS = ['starter', 'unlimited', 'founder'];   // lowest to highest
const DEFAULT_RULES = {
  prefix: 'hl referral',
  starter: 'starter|97|970',                     // words in the plan name, separated by |
  unlimited: 'unlimited|297|2970',
  founder: 'founder|497|4970|agency pro|saas pro',
  starter_price: '97, 970',                      // monthly and yearly price, used when HighLevel only sends an amount
  unlimited_price: '297, 2970',
  founder_price: '497, 4970',
  commission: 40,                                // commission percent, used when only the commission amount is sent
  trial_plan: 'starter',                         // plan to assume when a trial starts without a plan. '' waits for the first payment
  extra: '',                                     // optional extra tag on every referral
};

// Map whatever FirstPromoter sends (v1 or v2 webhooks) to one of our kinds.
function kindOf(p, hint) {
  if (KINDS.includes(hint)) return hint;
  const ev = String((p.event && (p.event.type || p.event.name)) || p.event_type || p.type || p.trigger || p.event || '').toLowerCase();
  const st = String(find(p, ['state', 'status']) || '').toLowerCase();
  if (/cancel/.test(ev)) return 'cancelled';
  if (/reward|commission/.test(ev)) return 'commission';
  if (/becomes_referral|new_customer|customer|first_payment/.test(ev)) return 'customer';
  if (/subscribed/.test(ev)) return 'lead';
  if (/signup|referral\.created|new_referral|trial/.test(ev)) return 'trial';
  if (/cancel/.test(st)) return 'cancelled';
  if (/active|customer/.test(st)) return 'customer';
  if (/signup|trial/.test(st)) return 'trial';
  if (/subscribed|lead/.test(st)) return 'lead';
  return 'other';
}

// Depth-first search for the first matching key, skipping the promoter (that is the founder, not the referral).
function find(o, keys, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 5) return null;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '' && typeof o[k] !== 'object') return o[k];
  for (const [k, v] of Object.entries(o)) {
    if (/^(promoter|promoter_campaign|promoters|promotion|affiliate|campaign|profile)$/i.test(k)) continue;
    if (v && typeof v === 'object') { const r = find(v, keys, depth + 1); if (r !== null) return r; }
  }
  return null;
}

function normalize(p, hint) {
  const kind = kindOf(p, hint);
  const email = String(find(p, ['email', 'lead_email', 'customer_email']) || '').trim().toLowerCase();
  const first = find(p, ['first_name', 'firstName']); const last = find(p, ['last_name', 'lastName']);
  const name = clip([first, last].filter(Boolean).join(' ') || find(p, ['name', 'full_name']) || '', 120);
  const plan = clip(find(p, ['plan_name', 'plan_id', 'plan', 'product_name']) || '', 120);
  const sub = clip(find(p, ['visitor_sub_id', 'sub_id', 'subid', 'sid']) || '', 120);
  // FirstPromoter (behind HighLevel's affiliate program) always sends money in cents. Other senders get the old guess.
  const fp = !!((p.event && typeof p.event === 'object' && p.event.type) || p.event_type);
  const cents = find(p, ['sale_amount_cents', 'amount_cents']);
  let amount = cents != null ? +cents / 100 : find(p, ['sale_amount', 'amount', 'price']);
  amount = amount == null || amount === '' || !Number.isFinite(+amount) ? null : +amount;
  if (amount != null && cents == null && (fp || (Number.isInteger(amount) && amount >= 1000))) amount = amount / 100;
  // On commission events FirstPromoter sends the commission as "amount" and the payment it came from separately.
  const saleCents = find(p, ['sale_amount_cents']);
  let sale = saleCents != null ? +saleCents / 100 : find(p, ['conversion_amount', 'sale_amount', 'original_sale_amount', 'event_sale_amount']);
  sale = sale == null || sale === '' || !Number.isFinite(+sale) ? null : +sale;
  if (sale != null && saleCents == null && fp) sale = sale / 100;
  const id = find(p, ['event_id']) || (p.event && p.event.id) || p.id || null;
  const key = id ? 'fp:' + id : 'h:' + crypto.createHash('sha256').update([kind, email, plan, amount, find(p, ['created_at', 'timestamp']) || ''].join('|')).digest('hex').slice(0, 32);
  // The commission itself, for Revenue. Signed: a refunded or denied commission comes back negative.
  const cm = kind === 'commission' ? require('./_revenue').commissionOf(p) : null;
  return { kind, email, name, plan, sub_id: sub, amount, sale, event_key: key, commission: cm ? cm.amount : null, currency: cm ? cm.currency : null, at: cm ? cm.at : null };
}

const rulesOf = (rules) => ({ ...DEFAULT_RULES, ...(rules || {}) });
const prefixOf = (r) => String(r.prefix || DEFAULT_RULES.prefix).trim().toLowerCase();
const rxEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "starter|97|970" matches whole words only, so 97 never matches inside 297 or 497.
function wordsHit(list, text) {
  const words = String(list || '').split('|').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const t = String(text || '').toLowerCase();
  return words.some((w) => new RegExp('(^|[^a-z0-9])' + rxEsc(w) + '($|[^a-z0-9])').test(t));
}
const pricesOf = (v) => String(v == null ? '' : v).split(/[,|;\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
// The sender may use dollars or cents, so both are tried against the price list.
function priceHit(prices, value) {
  if (value == null || !Number.isFinite(+value)) return false;
  return prices.some((p) => Math.abs(+value - p) <= 1.5 || Math.abs(+value / 100 - p) <= 1.5);
}

// Which plan does this event point to? Plan name first, then the payment amount, then the commission amount.
function planOf(e, rules) {
  const r = rulesOf(rules);
  if (e.plan) for (const k of [...PLANS].reverse()) if (wordsHit(r[k] || DEFAULT_RULES[k], e.plan)) return { plan: k, by: 'name' };
  const prices = Object.fromEntries(PLANS.map((k) => [k, pricesOf(r[k + '_price'] || DEFAULT_RULES[k + '_price'])]));
  const paid = e.sale != null ? e.sale : e.kind === 'commission' ? null : e.amount;
  if (paid != null) for (const k of PLANS) if (priceHit(prices[k], paid)) return { plan: k, by: 'amount' };
  const rate = +r.commission > 0 && +r.commission <= 100 ? +r.commission / 100 : 0.4;
  if (e.kind === 'commission' && e.sale == null && e.amount != null) for (const k of PLANS) if (priceHit(prices[k], e.amount / rate)) return { plan: k, by: 'commission' };
  if (e.kind === 'trial' && PLANS.includes(String(r.trial_plan || '').toLowerCase())) return { plan: String(r.trial_plan).toLowerCase(), by: 'default' };
  return { plan: null, by: null };
}

function tagsFor(e, rules) {
  const r = rulesOf(rules); const pre = prefixOf(r);
  const t = [];
  if (e.kind === 'other') return t;
  t.push(pre + ' ' + e.kind);
  // No plan tag before a trial exists or once the account has closed.
  const plan = e.kind === 'lead' || e.kind === 'cancelled' ? null : planOf(e, r).plan;
  if (plan) t.push(pre + ' ' + plan);
  if (e.sub_id) t.push(pre + ' via ' + String(e.sub_id).toLowerCase().replace(/[^a-z0-9 _-]/g, '').slice(0, 40));
  if (r.extra) String(r.extra).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 3).forEach((x) => t.push(x));
  return [...new Set(t)];
}

// Plan tags only move up: someone already tagged Founder is never re-tagged Starter after a downgrade.
function planStep(tags, existing, rules) {
  const pre = prefixOf(rulesOf(rules));
  const rank = (list) => Math.max(-1, ...(list || []).map((x) => PLANS.indexOf(String(x).toLowerCase().startsWith(pre + ' ') ? String(x).toLowerCase().slice(pre.length + 1) : '')));
  const have = rank(existing); const want = rank(tags);
  if (want < 0) return { tags, plan: null, fresh: false };
  if (want <= have) return { tags: tags.filter((x) => !PLANS.some((k) => x === pre + ' ' + k)), plan: PLANS[want], fresh: false };
  return { tags, plan: PLANS[want], fresh: true };
}

// Skool has no public API. Each group's Webhook plugin gives one private address that invites an email.
function skoolUrl(u) {
  let x; try { x = new URL(String(u || '').trim()); } catch { return null; }
  if (x.protocol !== 'https:' || !/(^|\.)skool\.com$/i.test(x.hostname) || x.username || x.port) return null;
  x.searchParams.delete('email'); x.hash = '';
  return x.toString();
}
const skoolName = (u) => { try { const m = /\/groups\/([^/]+)/.exec(new URL(u).pathname); return m ? decodeURIComponent(m[1]) : 'Skool group'; } catch { return 'Skool group'; } };
function skoolList(settings) {
  if (!settings || !settings.skool) return [];
  try { const l = JSON.parse(open(settings.skool, 'Skool')); return Array.isArray(l) ? l.map(skoolUrl).filter(Boolean).slice(0, 2) : []; } catch { return []; }
}
async function skoolInvite(urls, email) {
  const done = [], failed = [];
  for (const u of urls) {
    const x = new URL(u); x.searchParams.set('email', email);
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(x.toString(), { method: 'POST', signal: ctl.signal }).finally(() => clearTimeout(timer));
      if (!r.ok) throw new Error('Skool answered ' + r.status);
      done.push(skoolName(u));
    } catch (err) { failed.push(skoolName(u) + ' (' + clip(err.name === 'AbortError' ? 'no answer' : err.message, 60) + ')'); }
  }
  return { done, failed };
}

async function hl(c, path, opt = {}) {
  const r = await fetch(HL + path, { ...opt, headers: { Authorization: 'Bearer ' + c.token, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' } });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) { const m = (j && (j.message || j.error)) || r.status; const e = new Error(Array.isArray(m) ? m.join(', ') : String(m)); e.status = r.status; throw e; }
  return j;
}

// Upsert by email, then add tags (adding never removes existing tags, and it fires "Tag added" workflows).
async function applyToHL(c, e, tags, rules) {
  const parts = (e.name || '').split(' ');
  const up = await hl(c, '/contacts/upsert', { method: 'POST', body: JSON.stringify({ locationId: c.location_id, email: e.email, ...(parts[0] ? { firstName: parts[0] } : {}), ...(parts.length > 1 ? { lastName: parts.slice(1).join(' ') } : {}), source: 'HighLevel affiliate link' }) });
  const id = (up.contact && up.contact.id) || up.id; if (!id) throw new Error('HighLevel did not return a contact');
  const step = planStep(tags, (up.contact && up.contact.tags) || [], rules); tags = step.tags;
  if (tags.length) await hl(c, `/contacts/${q(id)}/tags`, { method: 'POST', body: JSON.stringify({ tags }) });
  const line = { lead: 'Filled in step one of the HighLevel signup through your affiliate link.', trial: 'Started a HighLevel trial through your affiliate link.', customer: 'Became a paying HighLevel customer through your affiliate link.', commission: 'A HighLevel commission was created for this referral.', cancelled: 'Their HighLevel account closed.' }[e.kind];
  const extra = [e.plan && 'Plan: ' + e.plan, e.amount != null && 'Amount: $' + e.amount, e.sub_id && 'Link sub ID: ' + e.sub_id].filter(Boolean).join('. ');
  try { await hl(c, `/contacts/${q(id)}/notes`, { method: 'POST', body: JSON.stringify({ body: `${line}${extra ? ' ' + extra + '.' : ''} (Founders AI OS)` }) }); } catch { /* notes are a nice-to-have */ }
  return { id, tags, plan: step.plan, fresh: step.fresh };
}

function bodyOf(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = Object.fromEntries(new URLSearchParams(b)); } }
  if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString('utf8')); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

async function postback(req, res, send, url) {
  const token = String(url.searchParams.get('k') || '');
  if (!/^[0-9a-f]{48}$/.test(token)) return send(404, { error: 'Unknown webhook' });
  const secret = process.env.CRON_SECRET;
  const rows = await rpc(null, 'affiliate_resolve', { p_secret: secret, p_token: token });
  const hook = rows && rows[0]; if (!hook) return send(404, { error: 'Unknown webhook' });
  const p = bodyOf(req);
  // HighLevel's "Test Postback" may send an empty or sample body. Answer 200 so the test passes.
  const e = normalize(p, String(url.searchParams.get('e') || '').toLowerCase());
  let tags = tagsFor(e, hook.settings);
  const raw = JSON.parse(JSON.stringify(p, (k, v) => (/token|password|auth/i.test(k) ? undefined : v)).slice(0, 20000) || '{}');
  const sample = /@(example\.(com|org|net)|test\.com|email\.com|domain\.com|firstpromoter\.com|postback\.com)$/i.test(e.email) || /^test-email@/i.test(e.email) || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e.email);
  // A real commission still counts toward Revenue when FirstPromoter leaves out the lead. Nothing is tagged.
  const realId = p.event_id || (p.data && typeof p.data === 'object' && p.data.id);
  if (!e.email && e.kind === 'commission' && e.commission != null && realId) {
    await rpc(null, 'affiliate_log', { p_secret: secret, p_ws: hook.workspace_id, p_e: { ...e, tags: [], status: 'ok', note: 'Commission without a referral email. Counted in Revenue, nobody tagged.', raw } }).catch(() => null);
    return send(200, { ok: true, kind: e.kind, tags: [] });
  }
  if (!e.email || sample) {
    await rpc(null, 'affiliate_log', { p_secret: secret, p_ws: hook.workspace_id, p_e: { ...e, tags, status: 'test', note: e.email ? 'Sample email ' + e.email + ', so nothing was tagged. Real referrals are tagged.' : 'No referral email in this request. HighLevel test postbacks look like this.', raw } }).catch(() => null);
    return send(200, { ok: true, test: true, kind: e.kind });
  }
  const fresh = await rpc(null, 'affiliate_log', { p_secret: secret, p_ws: hook.workspace_id, p_e: { ...e, tags, status: 'pending', raw } });
  if (!fresh) return send(200, { ok: true, duplicate: true });
  let status = 'ok', note = null, contact = null, applied = tags;
  try {
    if (!hook.ciphertext) throw Object.assign(new Error('HighLevel is not connected in Founders AI OS'), { status: 409 });
    const c = JSON.parse(open(hook.ciphertext, 'HighLevel'));
    const out = await applyToHL(c, e, tags, hook.settings);
    contact = out.id; applied = out.tags;
    // The first time someone reaches the Founder plan, invite them to the founder's Skool groups.
    const groups = out.fresh && out.plan === 'founder' ? skoolList(hook.settings) : [];
    if (groups.length) {
      const sk = await skoolInvite(groups, e.email);
      if (sk.failed.length) { status = 'skool'; note = clip('Skool invite did not go through for ' + sk.failed.join(', ') + '. Invite them by hand in Skool.' + (sk.done.length ? ' Invited to ' + sk.done.join(', ') + '.' : ''), 240); }
      else note = clip('Invited to Skool: ' + sk.done.join(', ') + '.', 240);
    }
  } catch (err) {
    status = 'error'; note = clip(err.status === 401 || err.status === 403 ? 'HighLevel refused the write. Add the contacts.write scope to the Private Integration.' : err.message, 240);
  }
  tags = applied;
  await rpc(null, 'affiliate_done', { p_secret: secret, p_ws: hook.workspace_id, p_key: e.event_key, p_contact: contact, p_tags: tags, p_status: status, p_note: note }).catch(() => null);
  // Always 200 once logged: a retry would not fix a scope problem, and the founder sees the error in the app.
  return send(200, { ok: status !== 'error', kind: e.kind, tags, contact_id: contact, note });
}

// Everything the Affiliate page needs from the postbacks: each commission, and each referral's current status.
// Test postbacks are left out by the query. The latest event per email decides the status. A reversed commission
// takes money off the month but does not make anyone active.
function ledger(rows, now = Date.now()) {
  const commissions = []; const by = {};
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const list = (rows || []).filter((r) => r && KINDS.includes(r.kind)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const r of list) {
    const t = Date.parse(r.created_at); if (!Number.isFinite(t)) continue;
    const email = String(r.email || '').trim().toLowerCase();
    let cm = null;
    if (r.kind === 'commission') {
      cm = require('./_revenue').commissionOf(r.raw);
      if (cm) commissions.push({ at: cm.at || new Date(t).toISOString(), amount: cm.amount, currency: cm.currency, email: email || null });
    }
    if (!email) continue;
    const p = by[email] || (by[email] = { email, name: '', plan: '', sub: '', state: 'lead', first: day(t), since: '', last: day(t), paid: 0, n: 0, last_paid: '' });
    if (r.name && !p.name) p.name = clip(r.name, 80);
    if (r.sub_id && !p.sub) p.sub = clip(r.sub_id, 60);
    const pl = String(r.plan || '').toLowerCase(); if (PLANS.includes(pl) && PLANS.indexOf(pl) > PLANS.indexOf(p.plan)) p.plan = pl;
    p.last = day(t);
    if (r.kind === 'trial') { p.state = 'trial'; if (!p.trial_at) p.trial_at = day(t); }
    else if (r.kind === 'cancelled') p.state = 'cancelled';
    else if (r.kind === 'customer' || (r.kind === 'commission' && (!cm || cm.amount > 0))) { p.state = 'active'; if (!p.since) p.since = day(t); }
    if (cm) { p.paid = Math.round((p.paid + cm.amount) * 100) / 100; if (cm.amount > 0) { p.n++; p.last_paid = day(Date.parse(cm.at) || t); } }
  }
  const people = Object.values(by).sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : 0));
  return { commissions, people, events: list.length, as_of: new Date(now).toISOString() };
}

async function founder(req, send, jwt, url) {
  const b = bodyOf(req); const ws = String(b.workspace_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(ws)) return send(400, { error: 'Missing workspace' });
  const base = require('./_lib').APP_URL + '/api/affiliate?k=';
  if (b.action === 'ledger') {
    const rows = await sb(jwt, `/rest/v1/affiliate_events?workspace_id=eq.${q(ws)}&status=neq.test&select=kind,email,name,plan,sub_id,raw,created_at&order=created_at.desc&limit=5000`);
    return send(200, ledger(rows));
  }
  if (b.action === 'preview') { const e = normalize(b.sample || {}, b.kind); return send(200, { event: e, plan: planOf(e, b.rules).plan, tags: tagsFor(e, b.rules) }); }
  let settings = null;
  if (b.action === 'rules' || b.action === 'skool') {
    // Saving replaces the whole settings object, so read it first and keep what this action does not touch.
    const cur = await rpc(jwt, 'affiliate_hook', { p_ws: ws, p_rotate: false, p_settings: null });
    settings = { ...((cur && cur[0] && cur[0].settings) || {}) };
    if (b.action === 'rules') {
      for (const [k, v] of Object.entries(b.rules || {})) if (k in DEFAULT_RULES) settings[k] = clip(v, 120);
      const tp = String(settings.trial_plan || '').toLowerCase(); settings.trial_plan = PLANS.includes(tp) ? tp : (b.rules && 'trial_plan' in b.rules ? '' : DEFAULT_RULES.trial_plan);
    } else {
      const given = (Array.isArray(b.urls) ? b.urls : []).map((u) => String(u || '').trim()).filter(Boolean).slice(0, 2);
      const urls = given.map(skoolUrl);
      if (urls.some((u) => !u)) return send(400, { error: 'That is not a Skool webhook address. Copy it from the group: Settings, Plugins, Webhook.' });
      if (urls.length) settings.skool = seal(JSON.stringify(urls)); else delete settings.skool;
    }
  }
  const rows = await rpc(jwt, 'affiliate_hook', { p_ws: ws, p_rotate: b.action === 'rotate', p_settings: settings });
  const h = rows && rows[0]; if (!h) return send(500, { error: 'Could not create the webhook' });
  // The Skool addresses are secrets: the app only ever gets the group names back.
  const { skool, ...plain } = h.settings || {};
  return send(200, { url: base + h.token, rules: { ...DEFAULT_RULES, ...plain }, skool: skoolList({ skool }).map(skoolName), kinds: KINDS, plans: PLANS });
}

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  const url = new URL(req.url, 'http://x');
  try {
    if (url.searchParams.get('k')) {
      if (req.method === 'GET' || req.method === 'HEAD') return send(200, { ok: true, ready: true }); // URL checks
      if (req.method !== 'POST') return send(405, { error: 'Use POST' });
      return await postback(req, res, send, url);
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
    const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
    if (!jwt) return send(401, { error: 'Sign in first' });
    return await founder(req, send, jwt, url);
  } catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._normalize = normalize;
module.exports._ledger = ledger;
module.exports._tagsFor = tagsFor;
module.exports._planOf = planOf;
module.exports._planStep = planStep;
module.exports._skoolUrl = skoolUrl;
module.exports._skoolName = skoolName;
module.exports._skoolInvite = skoolInvite;
module.exports.PLANS = PLANS;
module.exports.DEFAULT_RULES = DEFAULT_RULES;

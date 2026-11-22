// Shared HighLevel client for the sync features: version fallback, friendly errors, OAuth refresh and webhook signatures.
// Private Integration tokens keep working. A Marketplace app (OAuth) is used only when HL_APP_CLIENT_ID and HL_APP_CLIENT_SECRET are set.
const crypto = require('crypto');
const { rpc, seal, bad, APP_URL } = require('./_lib');

const HL = 'https://services.leadconnectorhq.com';
// HighLevel's published Ed25519 key for X-GHL-Signature (Webhook Integration Guide). An env var can replace it if it rotates.
const GHL_ED25519 = process.env.HL_WEBHOOK_PUBLIC_KEY || 'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=';

// The scopes a Marketplace app asks for. Conversations are not in the list, on purpose.
const APP_SCOPES = [
  'locations.readonly', 'contacts.readonly', 'contacts.write', 'opportunities.readonly', 'opportunities.write',
  'calendars.readonly', 'calendars/events.readonly', 'payments/transactions.readonly', 'payments/subscriptions.readonly',
  'products.readonly', 'products.write', 'products/prices.readonly', 'products/prices.write', 'funnels/funnel.readonly', 'funnels/page.readonly',
  'socialplanner/account.readonly', 'socialplanner/post.write', 'socialplanner/post.readonly', 'blogs/post.write', 'blogs/list.readonly', 'blogs/author.readonly', 'blogs/category.readonly',
  'locations/customValues.readonly', 'locations/customValues.write', 'courses.write', 'medias.write', 'medias.readonly',
  'emails/builder.write', 'emails/builder.readonly', 'forms.readonly', 'surveys.readonly', 'users.readonly',
];
// Scopes a Private Integration token needs for every sync. Shown in the connection drawer.
const PIT_SCOPES = APP_SCOPES.filter((s) => !/opportunities\.write|subscriptions/.test(s));

const appOn = () => !!(process.env.HL_APP_CLIENT_ID && process.env.HL_APP_CLIENT_SECRET);
const redirectUri = () => `${APP_URL}/api/highlevel?oauth=hl`;

async function call(c, p, { method = 'GET', body, form, version = '2021-07-28', alt = 'v3' } = {}) {
  const go = async (v) => {
    const headers = { Authorization: 'Bearer ' + c.token, Version: v, Accept: 'application/json' };
    if (!form) headers['Content-Type'] = 'application/json';
    const r = await fetch(HL + p, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
    return { r, j };
  };
  let { r, j } = await go(version);
  const msgOf = (x) => { const m = x && (x.message || x.error); return Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : ''; };
  if (!r.ok && alt && alt !== version && (r.status === 400 || r.status === 404 || r.status === 422) && /version/i.test(msgOf(j))) ({ r, j } = await go(alt));
  if (!r.ok) {
    const m = msgOf(j);
    throw bad(r.status === 401 ? 'HighLevel did not accept the connection. Reconnect HighLevel in Connections.'
      : r.status === 403 ? 'The HighLevel connection is missing a scope for this' + (m ? ': ' + m : '') + '. Add it to the Private Integration and reconnect.'
      : r.status === 404 ? 'HighLevel could not find that' + (m ? ': ' + m : '')
      : 'HighLevel: ' + (m || r.status), r.status === 401 || r.status === 403 ? 422 : r.status === 404 ? 404 : 502);
  }
  return j;
}

/* ---------- Marketplace app OAuth ---------- */
async function token(params) {
  const r = await fetch(HL + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: process.env.HL_APP_CLIENT_ID, client_secret: process.env.HL_APP_CLIENT_SECRET, ...params }).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw bad('HighLevel sign-in did not finish: ' + (j.error_description || j.message || j.error || r.status), 502);
  return { token: j.access_token, refresh: j.refresh_token, expires_at: Date.now() + (Number(j.expires_in) || 86399) * 1000, location_id: j.locationId || null, user_id: j.userId || null, company_id: j.companyId || null, oauth: true };
}
const exchange = (code) => token({ grant_type: 'authorization_code', code, user_type: 'Location', redirect_uri: redirectUri() });

// Refresh an OAuth connection when it is close to expiring and save it back sealed. Private Integration tokens pass straight through.
async function fresh(c, ws, within = 15 * 60e3) {
  if (!c || !c.oauth || !c.refresh || !appOn()) return c;
  if (c.expires_at && c.expires_at - Date.now() > within) return c;
  const n = await token({ grant_type: 'refresh_token', refresh_token: c.refresh, user_type: 'Location', redirect_uri: redirectUri() });
  const next = { ...c, ...n, location_id: c.location_id || n.location_id, user_id: n.user_id || c.user_id };
  if (ws && process.env.CRON_SECRET) await rpc(null, 'cron_reseal', { p_secret: process.env.CRON_SECRET, p_ws: ws, p_provider: 'highlevel', p_cipher: seal(JSON.stringify(next)) }).catch(() => null);
  return next;
}

/* ---------- webhook signatures ---------- */
function verify(raw, sig) {
  if (!sig) return false;
  try {
    const der = /BEGIN PUBLIC KEY/.test(GHL_ED25519) ? GHL_ED25519 : { key: Buffer.from(GHL_ED25519, 'base64'), format: 'der', type: 'spki' };
    return crypto.verify(null, Buffer.from(raw, 'utf8'), crypto.createPublicKey(der), Buffer.from(String(sig), 'base64'));
  } catch { return false; }
}

module.exports = { HL, APP_SCOPES, PIT_SCOPES, appOn, redirectUri, call, exchange, fresh, verify };

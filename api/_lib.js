// Shared server helpers for Founders AI OS functions. Files starting with an underscore are not deployed as endpoints.
const crypto = require('crypto');

// Every install sets its own values in Vercel: Settings, then Environment Variables. SETUP.md lists them all.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const PROD_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const APP_URL = String(process.env.APP_URL || (PROD_HOST ? 'https://' + PROD_HOST : 'http://localhost:3000')).trim().replace(/\/+$/, '');
const validTz = (z) => { try { if (!z) return ''; new Intl.DateTimeFormat('en-US', { timeZone: z }).format(); return z; } catch { return ''; } };
// The owner's time zone for daily briefs, schedules and "today". Set FOS_TZ, for example America/New_York.
const TZ = validTz(String(process.env.FOS_TZ || '').trim()) || 'UTC';
const DB_SETUP_HELP = 'The database is missing part of the Founders AI OS schema. In Supabase, open the SQL Editor, paste the file in supabase/migrations and run it. SETUP.md step 2 walks through it.';
const VERCEL_ENV_HELP = 'In Vercel, open your project, then Settings, then Environment Variables. Add it, then redeploy. SETUP.md lists every value.';

// A secret Supabase key must never reach the browser. Refuse it here so a copy-paste slip cannot leak it.
function keyProblem(k = SUPABASE_KEY) {
  if (!k) return 'SUPABASE_PUBLISHABLE_KEY is missing.';
  if (/^sb_secret_/.test(k)) return 'SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the publishable key from Supabase, Project Settings, API Keys.';
  if (/^eyJ/.test(k)) { try { const role = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role; if (role && role !== 'anon') return 'SUPABASE_PUBLISHABLE_KEY holds the service role key. Use the publishable (or legacy anon) key instead.'; } catch { return 'SUPABASE_PUBLISHABLE_KEY does not look like a Supabase key.'; } }
  return '';
}
function setupProblem() {
  if (!SUPABASE_URL) return 'SUPABASE_URL is missing. ' + VERCEL_ENV_HELP;
  if (!/^https:\/\/[^/]+$/.test(SUPABASE_URL)) return 'SUPABASE_URL should look like https://your-project.supabase.co. ' + VERCEL_ENV_HELP;
  const kp = keyProblem(); if (kp) return kp + ' ' + VERCEL_ENV_HELP;
  return '';
}

function bad(m, code = 400) { const e = new Error(m); e.code = code; return e; }
const clip = (s, n) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim().slice(0, n));
const q = encodeURIComponent;

function key() { const k = process.env.FOS_ENC_KEY; if (!k) throw bad('FOS_ENC_KEY is missing, so saved keys cannot be locked or read. ' + VERCEL_ENV_HELP, 500); const b = Buffer.from(k, 'base64'); if (b.length !== 32) throw bad('FOS_ENC_KEY must be 32 random bytes in base64. SETUP.md has the one-line command that makes one. ' + VERCEL_ENV_HELP, 500); return b; }
function seal(plain) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return 'v1.' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64'); }
function open(sealed, what = 'This account') { if (!sealed || !sealed.startsWith('v1.')) throw bad(what + ' is not connected', 409); const b = Buffer.from(sealed.slice(3), 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); }
function sign(obj) { const p = Buffer.from(JSON.stringify(obj)).toString('base64url'); return p + '.' + crypto.createHmac('sha256', key()).update(p).digest('base64url'); }
function unsign(s) { const [p, m] = String(s || '').split('.'); if (!p || !m) throw bad('Sign-in link expired. Try again.'); const ok = crypto.createHmac('sha256', key()).update(p).digest('base64url'); if (ok.length !== m.length || !crypto.timingSafeEqual(Buffer.from(ok), Buffer.from(m))) throw bad('Sign-in link expired. Try again.'); const o = JSON.parse(Buffer.from(p, 'base64url').toString()); if (o.exp < Date.now()) throw bad('Sign-in link expired. Try again.'); return o; }
const peek = (s) => { try { return JSON.parse(Buffer.from(String(s || '').split('.')[0], 'base64url').toString()); } catch { return {}; } };

async function sb(jwt, pathName, { method = 'GET', body, prefer } = {}) {
  const sp = setupProblem(); if (sp) throw bad(sp, 500);
  const r = await fetch(SUPABASE_URL + pathName, { method, headers: { apikey: SUPABASE_KEY, ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok && j && /^(PGRST202|PGRST205|42P01|3F000)$/.test(String(j.code || ''))) { const e = bad(DB_SETUP_HELP + ' Missing: ' + String(j.message || j.code).slice(0, 160), 500); e.pg = j.code; throw e; }
  if (!r.ok) { const e = new Error((j && (j.message || j.msg)) || 'Database error'); e.code = r.status === 401 || /JWT/i.test(e.message) ? 401 : /not allowed/.test(e.message) ? 403 : 502; throw e; }
  return j;
}
const rpc = (jwt, fn, args) => sb(jwt, '/rest/v1/rpc/' + fn, { method: 'POST', body: args });

// JSON fetch with a clear error that names the provider.
async function jf(name, url, opt = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opt.timeout || 15000);
  let r; try { r = await fetch(url, { ...opt, signal: ctl.signal }); } catch (e) { clearTimeout(t); throw bad(name + ' could not be reached right now. Try again in a minute.', 502); }
  clearTimeout(t);
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) {
    const m = j && (typeof j === 'object') ? (j.error && (j.error.message || j.error_description || (typeof j.error === 'string' ? j.error : '')) || j.message || j.detail || j.error_description || j.msg || (j.errors && j.errors[0] && (j.errors[0].message || j.errors[0].detail)) || j.title) : String(txt || '').slice(0, 160);
    const e = bad(r.status === 401 || r.status === 403 ? name + ' did not accept these credentials' + (m ? ': ' + String(m).slice(0, 200) : '.') : name + ': ' + (String(m || r.status).slice(0, 220)), r.status === 401 || r.status === 403 ? 422 : r.status === 404 ? 404 : 502);
    e.status = r.status; throw e;
  }
  return j;
}

module.exports = { encKey: key, SUPABASE_URL, SUPABASE_KEY, APP_URL, TZ, validTz, keyProblem, setupProblem, VERCEL_ENV_HELP, DB_SETUP_HELP, bad, clip, q, seal, open, sign, unsign, peek, sb, rpc, jf, crypto };

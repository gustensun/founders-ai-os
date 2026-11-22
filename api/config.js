// Founders AI OS: browser settings and the admin setup check.
// GET /config.js (vercel.json sends it here) returns window.FOS_CONFIG: the Supabase URL, the publishable key,
// the app URL and the coach name. These are public values. Secret keys never leave the server.
// POST /api/config { action: 'setup' } with an admin sign-in token registers CRON_SECRET and the time zone with
// the database, then reports which settings are still missing and what to do about each one.
const { SUPABASE_URL, SUPABASE_KEY, APP_URL, TZ, setupProblem, rpc, crypto, VERCEL_ENV_HELP } = require('./_lib');

const VERCEL = 'https://vercel.com/dashboard';
const SUPA = 'https://supabase.com/dashboard';
const has = (k) => !!String(process.env[k] || '').trim();

function encKeyOk() {
  const k = String(process.env.FOS_ENC_KEY || '').trim(); if (!k) return false;
  try { return Buffer.from(k, 'base64').length === 32; } catch { return false; }
}

function publicConfig() {
  const problem = setupProblem();
  return {
    supabaseUrl: problem ? '' : SUPABASE_URL,
    supabaseKey: problem ? '' : SUPABASE_KEY,
    appUrl: has('APP_URL') ? APP_URL : '',
    coachName: String(process.env.COACH_NAME || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    setup: problem,
  };
}

// Every check says what is wrong, why it matters and where to fix it.
function checks(reg) {
  const out = [];
  const add = (key, ok, need, label, fix, href) => out.push({ key, ok: !!ok, need, label, fix: ok ? '' : fix, href: ok ? '' : href });
  add('enc_key', encKeyOk(), 'required', 'FOS_ENC_KEY', has('FOS_ENC_KEY')
    ? 'FOS_ENC_KEY is set but is not 32 bytes. Run openssl rand -base64 32, paste the result into FOS_ENC_KEY in Vercel and redeploy. Without it, keys you save in Connections cannot be locked or read.'
    : 'Add FOS_ENC_KEY in Vercel. Run openssl rand -base64 32 to make one, then redeploy. Without it, keys you save in Connections cannot be locked or read.', VERCEL);
  add('cron_secret', has('CRON_SECRET') && reg.cron_registered, 'required', 'CRON_SECRET', has('CRON_SECRET')
    ? 'CRON_SECRET is set but the database did not accept it. Run the latest file in supabase/migrations in the Supabase SQL Editor, then reload this page.'
    : 'Add CRON_SECRET in Vercel (any long random text, for example the output of openssl rand -hex 32) and redeploy. The scheduled agents and the morning brief run only with it.', has('CRON_SECRET') ? SUPA : VERCEL);
  add('timezone', has('FOS_TZ'), 'recommended', 'FOS_TZ', 'Daily briefs and schedules use UTC. Add FOS_TZ in Vercel with your time zone, for example America/New_York or Europe/London, and redeploy.', VERCEL);
  add('coach_name', has('COACH_NAME'), 'recommended', 'COACH_NAME', 'The coach is called AI Coach. Add COACH_NAME in Vercel with your name (for example Avery Cole) so it speaks as you and knows your name in coaching call transcripts.', VERCEL);
  add('youtube_key', has('YOUTUBE_API_KEY') || has('GOOGLE_API_KEY'), 'optional', 'YOUTUBE_API_KEY', 'YouTube research, outliers and creator tracking need a YouTube Data API key. Create one in Google Cloud, add it as YOUTUBE_API_KEY in Vercel and redeploy.', 'https://console.cloud.google.com/apis/library/youtube.googleapis.com');
  add('google_oauth', has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET'), 'optional', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET', 'Sign in with Google for YouTube Analytics, Calendar, Drive, Google Analytics, Search Console and Google Ads needs your own Google OAuth app. SETUP.md, optional step B, shows how.', 'https://console.cloud.google.com/apis/credentials');
  add('hl_app', has('HL_APP_CLIENT_ID') && has('HL_APP_CLIENT_SECRET'), 'optional', 'HL_APP_CLIENT_ID and HL_APP_CLIENT_SECRET', 'One-click HighLevel sign-in needs your own HighLevel Marketplace app. Without it, HighLevel still connects with a Private Integration token in Connections.', 'https://marketplace.gohighlevel.com/');
  return out;
}

async function setup(jwt) {
  const problem = setupProblem(); if (problem) { const e = new Error(problem); e.code = 500; throw e; }
  const secret = String(process.env.CRON_SECRET || '').trim();
  const hash = secret ? crypto.createHash('sha256').update(secret).digest('hex') : null;
  const reg = await rpc(jwt, 'fos_setup', { p_cron_hash: hash, p_timezone: TZ });
  if (!reg || !reg.admin) return { admin: false };
  return { admin: true, timezone: reg.timezone || TZ, checks: checks(reg) };
}

module.exports = async (req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const body = 'window.FOS_CONFIG = ' + JSON.stringify(publicConfig()).replace(/</g, '\\u003c') + ';\n';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=60');
    return res.end(req.method === 'HEAD' ? '' : body);
  }
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Use GET or POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  if (!jwt) return send(401, { error: 'Sign in first' });
  if (b.action !== 'setup') return send(400, { error: 'Unknown action' });
  try { return send(200, await setup(jwt)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || ('The setup check did not run. ' + VERCEL_ENV_HELP) }); }
};
module.exports._checks = checks;
module.exports._publicConfig = publicConfig;

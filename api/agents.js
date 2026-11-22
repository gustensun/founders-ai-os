const A = require('./_agents'), C = require('./_custom');
const { crypto } = require('./_lib');
function cronOK(header, secret) {
  const a = Buffer.from(String(header || '')), b = Buffer.from('Bearer ' + (secret || ''));
  return !!secret && a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = async (req, res) => {
  const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
  try {
    if (req.method === 'GET') {
      if (!cronOK(req.headers.authorization, process.env.CRON_SECRET)) return send(401, { error: 'Not authorized.' });
      return send(200, await A.tick());
    }
    if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Invalid JSON.' }); } }
    if (!b || typeof b !== 'object' || Array.isArray(b) || Buffer.byteLength(JSON.stringify(b)) > 250000) return send(400, { error: 'Invalid request.' });
    const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
    if (!jwt) return send(401, { error: 'Sign in first.' });
    await C.member(jwt, b.workspace_id);
    const fn = Object.hasOwn(A.ACTIONS, b.action) && A.ACTIONS[b.action];
    if (!fn) return send(400, { error: 'Unknown action.' });
    return send(200, await fn(jwt, b));
  } catch (e) { return send(e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'The agent request could not be completed. Try again.' }); }
};
module.exports._cronOK = cronOK;

const C = require('./_custom');
module.exports = async (req, res) => {
  const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST.' }); }
  let b = req.body;
  try { if (typeof b === 'string') b = JSON.parse(b); } catch { return send(400, { error: 'Invalid JSON.' }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return send(400, { error: 'Invalid request.' });
  if (Buffer.byteLength(JSON.stringify(b)) > 550000) return send(413, { error: 'This request is too large.' });
  if (b.action === 'catalog') return send(200, { presets: Object.entries(C.PRESETS).map(([id, p]) => ({ id, ...p })),
    transport: 'Streamable HTTP', authentication: ['none', 'bearer', 'header'] });
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  if (!jwt) return send(401, { error: 'Sign in first.' });
  try {
    const fn = Object.prototype.hasOwnProperty.call(C.ACTIONS, b.action) && C.ACTIONS[b.action];
    if (!fn) return send(400, { error: 'Unknown action.' });
    await C.member(jwt, b.workspace_id); // Before DNS, HTTP, decryption or any write.
    return send(200, await fn(jwt, b));
  } catch (e) { return send(e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'The connection request could not be completed. Try again.' }); }
};

// Readable, workspace-scoped learning. This endpoint does not call an AI provider.
const { rpc, bad } = require('./_lib');
const Store = require('./_learning-store');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports = async (req, res) => {
  const send = (code, value) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); return res.end(JSON.stringify(value)); };
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
    const jwt = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
    if (!jwt) return send(401, { error: 'Sign in first' });
    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return send(400, { error: 'Bad JSON' });
    if (!UUID.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
    if (!['read', 'settings', 'mute'].includes(b.action)) return send(400, { error: 'Unknown action' });
    // Membership is checked in every RPC before any workspace data is read.
    if (b.action === 'settings') {
      if (typeof b.enabled !== 'boolean') throw bad('Choose whether learning is enabled.');
      await rpc(jwt, 'content_learning_settings', { p_ws: b.workspace_id, p_enabled: b.enabled });
    }
    if (b.action === 'mute') {
      if (typeof b.muted !== 'boolean' || typeof b.key !== 'string' || b.key.length > 240) throw bad('Choose an observation to ignore or restore.');
      const before = await Store.member(jwt, b.workspace_id);
      const known = [...before.insights, ...before.followups].some((s) => s.key === b.key) || before.settings.muted_keys.includes(b.key);
      if (!known) throw bad('This observation is no longer available. Refresh learning.', 409);
      await rpc(jwt, 'content_learning_settings', { p_ws: b.workspace_id, p_key: b.key, p_muted: b.muted });
    }
    return send(200, await Store.member(jwt, b.workspace_id));
  } catch (e) {
    const code = Number(e.code) >= 400 && Number(e.code) < 600 ? Number(e.code) : 500;
    return send(code, { error: code < 500 ? e.message : 'Content learning could not be read. Your content and decisions are safe. Try again.' });
  }
};

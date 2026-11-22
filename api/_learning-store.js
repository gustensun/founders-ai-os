const { rpc } = require('./_lib');
const L = require('./_learning');

async function member(jwt, ws) {
  const input = await rpc(jwt, 'content_learning_read', { p_ws: ws });
  return L.analyze(input);
}
async function server(ws, secret) {
  const input = await rpc(null, 'cron_content_learning_read', { p_ws: ws, p_secret: secret });
  return L.analyze(input);
}
async function context(jwt, ws) {
  try { return L.compact(await member(jwt, ws)); }
  catch { return { enabled: false, unavailable: true, insights: [], winners: [], recent_passes: [] }; }
}
async function cronContext(ws, secret) {
  try { return L.compact(await server(ws, secret)); }
  catch { return { enabled: false, unavailable: true, insights: [], winners: [], recent_passes: [] }; }
}
module.exports = { member, server, context, cronContext };

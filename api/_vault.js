const V = require('../js/vault');
const { sb, rpc, bad, q } = require('./_lib');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = 'id,workspace_id,title,purpose,body,context,sources,by,dna_version,enabled,pinned,archived,revision,created_at,updated_at';
function ids(value, max = 4) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max || value.some((id) => !UUID.test(String(id)))) throw bad('Choose valid saved references');
  return [...new Set(value.map((v) => v.toLowerCase()))];
}
async function member(jwt, ws) {
  const rows = await sb(jwt, `/rest/v1/workspaces?id=eq.${q(ws)}&select=id`);
  if (!rows || !rows.length) throw bad('not allowed', 403);
}
async function ownOffer(jwt, ws, value) {
  if (!value) return null;
  const [id] = ids([value]);
  const [offer] = await sb(jwt, `/rest/v1/founder_strategy?workspace_id=eq.${q(ws)}&id=eq.${q(id)}&kind=eq.offer&lifecycle=eq.live&select=id,name,summary,price,currency,price_note,url`);
  if (!offer) throw bad('The selected offer is no longer available in this workspace. Choose an offer again.', 409);
  return offer;
}
async function context(jwt, ws, query, purpose, selected) {
  const chosen = ids(selected);
  try {
    const notes = await rpc(jwt, 'vault_context', { p_ws: ws, p_query: V.text(query, 1800), p_purpose: V.purpose(purpose), p_ids: chosen });
    return { text: V.context(notes), notes: (notes || []).map((n) => ({ id: n.id, title: n.title, revision: n.revision })) };
  } catch (e) {
    if (chosen.length) throw e;
    // An unavailable optional reference library must not block other drafting.
    return { text: '', notes: [] };
  }
}
function service({ ai, aiKeys, dnaBody }) {
  async function list(jwt, b) {
    await member(jwt, b.workspace_id);
    const offset = Math.floor(Math.max(0, Math.min(100000, Number(b.offset) || 0)));
    const notes = await sb(jwt, `/rest/v1/vault_notes?workspace_id=eq.${q(b.workspace_id)}&select=${fields}&order=pinned.desc,updated_at.desc,id.asc&limit=101&offset=${offset}`);
    return { notes: notes.slice(0, 100), next: notes.length > 100 ? offset + 100 : null };
  }
  async function summarize(jwt, b) {
    const ws = b.workspace_id, chosen = ids(b.source_ids, V.MAX_SOURCES);
    if (!chosen.length) throw bad('Choose at least one saved example');
    if (!UUID.test(String(b.request_id || ''))) throw bad('Missing summary request');
    await member(jwt, ws);
    const [existing] = await sb(jwt, `/rest/v1/vault_notes?workspace_id=eq.${q(ws)}&id=eq.${q(b.request_id)}&select=${fields}`);
    if (existing) return { saved: true, note: existing, reused: true };
    const found = await sb(jwt, `/rest/v1/swipe_items?workspace_id=eq.${q(ws)}&id=in.(${chosen.join(',')})&select=*`);
    if (found.length !== chosen.length) throw bad('An example was removed or belongs to another workspace. Reload the vault.', 404);
    const rows = chosen.map((id) => found.find((r) => r.id === id));
    if (rows.every((r) => V.coverage(r) === 'limited')) throw bad('These examples need more readable material. Add page text or screenshots, read them again, then summarize.', 422);
    const brief = { context: V.text(b.context, 5000), purpose: V.purpose(b.purpose) };
    const [keys, own, dna] = await Promise.all([
      aiKeys(jwt, ws), dnaBody(jwt, ws),
      sb(jwt, `/rest/v1/brand_dna?workspace_id=eq.${q(ws)}&select=version`).then((r) => r[0] || {}).catch(() => ({})),
    ]);
    const sources = rows.map(V.source);
    let result, by = 'Saved breakdowns';
    if (keys.claude || keys.openai || keys.perplexity) {
      // Leave room for a second configured provider and the durable save inside
      // the Brain endpoint's 120-second request limit.
      const out = await ai(keys, V.SYS, V.prompt(rows, own, brief), 5200, { timeout: 45000 });
      result = out && V.fromJSON(out.text, sources);
      if (!result) throw bad('The AI did not return a usable, source-linked summary. Your examples are unchanged. Try again.', 502);
      by = out.by;
    } else result = V.fallback(rows, brief);
    if (!result) throw bad('There is not enough material for a useful summary yet. Add page text or screenshots.', 422);
    const note = { ...result, ...brief, id: b.request_id, workspace_id: ws, sources, by, dna_version: dna.version || null, enabled: true, pinned: false, archived: false, revision: 0 };
    try {
      const saved = await rpc(jwt, 'vault_note_create', { p_ws: ws, p_id: note.id, p_note: note });
      return { saved: true, note: saved };
    } catch (e) {
      // Preserve generated work and let the client retry only the save. No
      // second model call, and never announce an unsaved brief as saved.
      return { saved: false, note, save_error: e.message || 'The summary could not be saved. Retry saving it.' };
    }
  }
  async function save(jwt, b) {
    const ws = b.workspace_id;
    if (!UUID.test(String(b.id || ''))) throw bad('Missing brief');
    await member(jwt, ws);
    if (b.create) {
      const n = b.note || {};
      if (!V.one(n.title, 160) || V.text(n.body, 24000).length < 20) throw bad('Add a title and summary');
      const sources = Array.isArray(n.sources) ? n.sources : [];
      ids(sources.map((s) => s.id), V.MAX_SOURCES);
      return { note: await rpc(jwt, 'vault_note_create', { p_ws: ws, p_id: b.id, p_note: { title: V.one(n.title, 160), body: V.text(n.body, 24000), context: V.text(n.context, 5000), purpose: V.purpose(n.purpose), sources, by: V.one(n.by, 100), dna_version: Number.isInteger(n.dna_version) ? n.dna_version : null } }) };
    }
    if (!Number.isInteger(b.revision) || b.revision < 1) throw bad('Reload this brief before saving');
    const patch = {};
    for (const key of ['enabled', 'pinned', 'archived']) if (typeof (b.patch || {})[key] === 'boolean') patch[key] = b.patch[key];
    if (b.patch && 'title' in b.patch) { patch.title = V.one(b.patch.title, 160); if (!patch.title) throw bad('Add a title'); }
    if (b.patch && 'body' in b.patch) { patch.body = V.text(b.patch.body, 24000); if (patch.body.length < 20) throw bad('Keep at least a short summary'); }
    if (b.patch && 'context' in b.patch) patch.context = V.text(b.patch.context, 5000);
    if (b.patch && 'purpose' in b.patch) patch.purpose = V.purpose(b.patch.purpose);
    if (!Object.keys(patch).length) throw bad('Nothing to save');
    return { note: await rpc(jwt, 'vault_note_update', { p_ws: ws, p_id: b.id, p_revision: b.revision, p_patch: patch }) };
  }
  return { 'vault-list': list, 'vault-summarize': summarize, 'vault-save': save };
}
module.exports = { service, context, ownOffer, ids, member, fields };

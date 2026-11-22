// Founders AI OS daily job. Vercel Cron calls this at 05:00 UTC. Change the schedule in vercel.json.
// It syncs every connection in every private workspace, writes the morning content ideas, sends the morning brief to Telegram and Slack,
// and on Fridays sends the email digest. Credentials stay sealed; the database only unlocks them for this job.
const { rpc, open, seal, clip } = require('./_lib');
const C = require('./connect.js');
const inbox = require('./inbox.js');
const B = require('./brain.js');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || '');
  if (!secret || auth !== 'Bearer ' + secret) { res.statusCode = 401; return res.end('no'); }
  const started = Date.now(); const P = C._P; const report = {};
  const rows = await rpc(null, 'cron_connections', { p_secret: secret });
  const byWs = rows.reduce((m, r) => ((m[r.workspace_id] = m[r.workspace_id] || []).push(r), m), {});
  const onlyBrief = new URL(req.url, 'http://x').searchParams.get('brief') === '1';

  await Promise.all(Object.entries(byWs).map(async ([ws, list]) => {
    const out = (report[ws] = { synced: {}, sent: {} });
    const credsOf = {}; list.forEach((r) => { try { credsOf[r.provider] = JSON.parse(open(r.ciphertext, r.provider)); } catch (e) { credsOf[r.provider] = null; } });
    const metaOf = Object.fromEntries(list.map((r) => [r.provider, r.meta || {}]));
    // HighLevel Marketplace app tokens last a day, so the daily job always renews them.
    if (credsOf.highlevel && credsOf.highlevel.oauth) { try { credsOf.highlevel = await require('./_hl').fresh(credsOf.highlevel, ws, 23 * 3600e3); } catch { /* keeps the old token */ } }
    if (!onlyBrief) {
      await Promise.all(list.filter((r) => P[r.provider] && P[r.provider].sync && credsOf[r.provider]).map(async (r) => {
        try {
          const ig = r.provider === 'instagram' && credsOf.instagram && (credsOf.instagram.via === 'highlevel' || !credsOf.instagram.token);
          const ctx = ig ? { hl: credsOf.highlevel || null, apify: (() => { const a = list.find((x) => x.provider === 'apify'); if (!a) return null; try { const t = open(a.ciphertext, 'apify'); try { const j = JSON.parse(t); return (j && (j.token || j.key)) || (typeof j === 'string' ? j : t); } catch { return t; } } catch { return null; } })() } : {};
          const m = await C._syncOne(r.provider, credsOf[r.provider], r.meta || {}, { ctx, reseal: (nc) => rpc(null, 'cron_reseal', { p_secret: secret, p_ws: ws, p_provider: r.provider, p_cipher: seal(JSON.stringify(nc)) }) });
          metaOf[r.provider] = { ...metaOf[r.provider], ...m };
          await rpc(null, 'cron_meta', { p_secret: secret, p_ws: ws, p_provider: r.provider, p_meta: m, p_status: 'connected' }); out.synced[r.provider] = 'ok';
        } catch (e) { out.synced[r.provider] = clip(e.message, 120); await rpc(null, 'cron_meta', { p_secret: secret, p_ws: ws, p_provider: r.provider, p_meta: { sync_error: clip(e.message, 240), last_try_at: new Date().toISOString() }, p_status: 'error' }).catch(() => {}); }
      }));
    }
    // Brand DNA: refresh offers and funnels from HighLevel. The database recompiles the DNA on save.
    if (!onlyBrief && credsOf.highlevel) {
      try { const cat = await require('./_dna.js').catalog(credsOf.highlevel); if (cat.kinds.length) { await rpc(null, 'cron_dna_save', { p_secret: secret, p_ws: ws, p_items: cat.items, p_kinds: cat.kinds }); out.synced.dna = 'ok'; } }
      catch (e) { out.synced.dna = clip(e.message, 120); }
    }
    // Call recordings: new Zoom transcripts become searchable passages for the chat.
    if (!onlyBrief && credsOf.zoom) {
      try { const known = new Set(await rpc(null, 'cron_recording_known', { p_secret: secret, p_ws: ws })); const r = await require('./_rec.js').ingestZoom(credsOf.zoom, { known, months: [0, 1, 2], max: 10, deadline: started + 50000, save: (rec, cs) => rpc(null, 'cron_recording_store', { p_secret: secret, p_ws: ws, p_rec: rec, p_chunks: cs }) }); out.synced.recordings = r.added + ' new'; }
      catch (e) { out.synced.recordings = clip(e.message, 120); }
    }
    // Goals: every goal tied to a channel, offer, funnel or OS feature gets today's value.
    if (!onlyBrief) {
      try { const inputs = await rpc(null, 'cron_goal_inputs', { p_secret: secret, p_ws: ws }); inputs.conns = (inputs.conns || []).map((c) => (metaOf[c.provider] ? { ...c, meta: metaOf[c.provider] } : c)); const g = await require('./goals.js')._trackAll(inputs, credsOf.highlevel, (id, meta) => rpc(null, 'cron_goal_save', { p_secret: secret, p_ws: ws, p_id: id, p_meta: meta })); out.synced.goals = g.length + ' tracked'; }
      catch (e) { out.synced.goals = clip(e.message, 120); }
    }
    const wants = ['telegram', 'slack'].filter((k) => credsOf[k] && (k !== 'telegram' || credsOf[k].chat_id));
    const friday = new Date().getUTCDay() === 5 && credsOf['email-digest'];
    if (!wants.length && !friday) return;
    let hlb = null; if (credsOf.highlevel) { try { hlb = await inbox._briefFor(credsOf.highlevel); } catch { hlb = null; } }
    const counts = await rpc(null, 'cron_workspace', { p_secret: secret, p_ws: ws }).catch(() => ({}));
    const name = ''; const events = (metaOf.gcal && metaOf.gcal.events) || [];
    const text = C._briefText({ name, hlb, events, counts });
    for (const k of wants) {
      try { await P[k].send(credsOf[k], text); out.sent[k] = 'ok'; await rpc(null, 'cron_meta', { p_secret: secret, p_ws: ws, p_provider: k, p_meta: { last_sent_at: new Date().toISOString() } }); }
      catch (e) { out.sent[k] = clip(e.message, 120); }
    }
    if (friday) {
      try {
        if (!credsOf['email-digest'].key) throw new Error('Add a Resend key to the email digest');
        await C._sendDigest(credsOf['email-digest'], text, list[0].workspace_name); out.sent['email-digest'] = 'ok';
        await rpc(null, 'cron_meta', { p_secret: secret, p_ws: ws, p_provider: 'email-digest', p_meta: { last_sent_at: new Date().toISOString() } });
      } catch (e) { out.sent['email-digest'] = clip(e.message, 120); }
    }
  }));
  // Content ideation is scheduled only by founder-configured agents/cadences.
  // Daily connection upkeep and call review remain independent.
  if (!onlyBrief) {
    const all = await rpc(null, 'cron_workspaces', { p_secret: secret }).catch(() => []);
    const ids = (all || []).map((x) => (typeof x === 'string' ? x : x.cron_workspaces || x.id)).filter(Boolean);
    await Promise.all(ids.map(async (ws) => {
      const out = (report[ws] = report[ws] || { synced: {}, sent: {} });
      // Call review: new calls become suggested promises, objections, wins and content ideas. Two a day at most.
      try {
        const keys = {}; (byWs[ws] || []).forEach((r) => { if (r.provider !== 'claude' && r.provider !== 'openai' && r.provider !== 'perplexity') return; try { const raw = open(r.ciphertext, r.provider); let k = raw; try { const j = JSON.parse(raw); k = (j && j.key) || (typeof j === 'string' ? j : raw); } catch { /* plain key */ } keys[r.provider] = k; } catch { /* sealed with another key */ } });
        if (!(keys.claude || keys.openai || keys.perplexity)) { out.synced.calls = 'no AI key'; return; }
        let n = 0;
        while (n < 2 && Date.now() - started < 170000) { const r = await require('./_calls.js').reviewNext({ secret, ws, keys }); if (r.done) break; n++; }
        out.synced.calls = n + ' reviewed';
      } catch (e) { out.synced.calls = clip(e.message, 120); }
    }));
  }
  res.statusCode = 200; res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, ms: Date.now() - started, workspaces: Object.keys(byWs).length, report }));
};

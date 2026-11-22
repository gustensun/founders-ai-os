// Founders AI OS: the HighLevel connection, the Jarvis home brief and live revenue.
// Conversations are never read. They stay in HighLevel, and email stays wherever the founder already reads it.
// Credentials are checked with the provider, sealed with a server-only key (AES-256-GCM) and never sent back.
// The Google OAuth return for Connections also lands here (?oauth=google), because that is the registered redirect.
const crypto = require('crypto');

const { APP_URL, sb: sharedSb, encKey } = require('./_lib');
const HL = 'https://services.leadconnectorhq.com';

function bad(m, code = 400) { const e = new Error(m); e.code = code; return e; }
const clip = (s, n) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim().slice(0, n));

/* ---------- crypto ---------- */
function key() { return encKey(); }
function seal(plain) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return 'v1.' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64'); }
function open(sealed, what = 'This account') { if (!sealed || !sealed.startsWith('v1.')) throw bad(what + ' is not connected', 409); const b = Buffer.from(sealed.slice(3), 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); }

/* ---------- Supabase as the signed-in user ---------- */
const sb = sharedSb;
const rpc = (jwt, fn, args) => sb(jwt, '/rest/v1/rpc/' + fn, { method: 'POST', body: args });
const q = encodeURIComponent;


/* ---------- HighLevel ---------- */
async function hlCreds(jwt, ws) { if (jwt && typeof jwt === 'object' && jwt.creds) return jwt.creds; const raw = open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'highlevel' }), 'HighLevel'); return require('./_hl').fresh(JSON.parse(raw), ws); }
async function hl(c, p, { method = 'GET', body, version = '2021-07-28' } = {}) {
  const r = await fetch(HL + p, { method, headers: { Authorization: 'Bearer ' + c.token, Version: version, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) {
    const msg = j && (j.message || j.error); const m = Array.isArray(msg) ? msg.join(', ') : msg;
    throw bad(r.status === 401 ? 'HighLevel did not accept this token. Create a Private Integration token in the sub-account with the scopes listed.' : r.status === 403 ? 'This token is missing a scope: ' + (m || 'check conversations, contacts and opportunities') : r.status === 404 ? 'HighLevel could not find that ' + (/locations/.test(p) ? 'location ID' : 'item') : 'HighLevel: ' + (m || r.status), r.status === 401 || r.status === 403 ? 422 : 502);
  }
  return j;
}

/* ---------- Grok Bot routine webhook ---------- */
function grokUrl(url) {
  let u; try { u = new URL(url); } catch { throw bad('Paste the routine webhook URL from Grok Bot. It starts with https://'); }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') throw bad('The webhook URL must be a plain https:// address.');
  if (h === 'localhost' || /\.(local|internal|localhost)$/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || !h.includes('.')) throw bad('Use the public webhook URL Grok Bot gave you.');
  return u;
}
async function grokCreds(jwt, ws) { return JSON.parse(open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'grok-bot' }), 'Grok Bot')); }
async function grokPost(c, body) {
  grokUrl(c.url);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  let r;
  try { r = await fetch(c.url, { method: 'POST', redirect: 'error', signal: ctl.signal, headers: { Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { throw bad(e.name === 'AbortError' ? 'Grok Bot did not answer within 20 seconds.' : 'Grok Bot could not be reached.', 502); }
  finally { clearTimeout(t); }
  if (r.status === 401 || r.status === 403) throw bad('Grok Bot did not accept the webhook key. Copy it again from the routine and reconnect.', 502);
  if (r.status === 404) throw bad('Grok Bot does not know this webhook URL. The routine may have been deleted.', 502);
  if (!r.ok) throw bad('Grok Bot answered ' + r.status + '.', 502);
  return { status: r.status };
}
// What the routine receives. Grok has the Founders AI OS connector, so it pulls context itself and reports back with task_id.
function grokPayload(t) {
  return {
    kind: 'task', source: 'Founders AI OS', task_id: t.id, agent: t.agent, title: t.title, instruction: t.instruction,
    context: 'Use the Founders AI OS connector. Call get_brief and get_brand_dna first for offers, prices, funnels and voice. Never invent prices or claims.',
    rules: ['Build only what the instruction asks. Do not delete or overwrite existing work unless the instruction says so.', 'Do not send emails, SMS or messages to contacts. Leave anything outbound as a draft.', 'Never read or summarise HighLevel conversations.', 'If you need a decision from the founder, stop and report needs_you with the question.'],
    report_back: `When you start, call grok_task_update with task_id "${t.id}" and status "started". When you finish, call grok_task_update with task_id "${t.id}", status "done", a short plain summary of what you built and https links to it. If you are blocked use status "needs_you" with the question, or "failed" with the reason.`,
    deliver: `For every PDF, graphic, piece of copy or content you make, also call grok_deliver with task_id "${t.id}", the type, a title, the full text and public https links. It waits on the From Grok page until the founder approves it.`,
  };
}

async function briefFor(c) {
    const L = q(c.location_id); const now = Date.now(); const DAY = 86400e3;

    const safe = (pr) => pr.catch((e) => ({ __err: e.message }));
    const [contacts, cals, opps, pipes] = await Promise.all([
      safe(hl(c, `/contacts/?locationId=${L}&limit=100`)),
      safe(hl(c, `/calendars/?locationId=${L}`, { version: '2021-04-15' })),
      safe(hl(c, `/opportunities/search?location_id=${L}&status=open&limit=8&order=updated_at_desc`)),
      safe(hl(c, `/opportunities/pipelines?locationId=${L}`)),
    ]);
    const out = { errors: [] };
    if (contacts.__err) out.errors.push('contacts'); else {
      const list = (contacts.contacts || []).filter((x) => x.dateAdded && now - Date.parse(x.dateAdded) < 7 * DAY);
      const src = {}; list.forEach((x) => { const k = clip(x.source, 60) || 'Direct'; src[k] = (src[k] || 0) + 1; });
      out.leads = { week: list.length, capped: list.length >= 100, today: list.filter((x) => now - Date.parse(x.dateAdded) < DAY).length, total: (contacts.meta && contacts.meta.total) || null,
        sources: Object.entries(src).sort((a, b2) => b2[1] - a[1]).slice(0, 4).map(([name, n]) => ({ name, n })),
        latest: list.slice(0, 5).map((x) => ({ name: clip(x.contactName || [x.firstName, x.lastName].filter(Boolean).join(' ') || x.email, 80) || 'Unknown', source: clip(x.source, 60), at: x.dateAdded })) };
    }
    if (cals.__err) out.errors.push('calendars'); else {
      const active = (cals.calendars || []).filter((x) => x.isActive !== false).slice(0, 25);
      const evs = await Promise.all(active.map((cal) => hl(c, `/calendars/events?locationId=${L}&calendarId=${q(cal.id)}&startTime=${now - 2 * 3600e3}&endTime=${now + 7 * DAY}`, { version: '2021-04-15' }).then((r) => (r.events || []).map((e) => ({ ...e, cal: cal.name }))).catch(() => [])));
      out.calls = evs.flat().filter((e) => !/cancel|invalid|noshow/i.test(e.appointmentStatus || '')).sort((a, b2) => Date.parse(a.startTime) - Date.parse(b2.startTime)).slice(0, 8)
        .map((e) => ({ title: clip(e.title, 100) || 'Call', start: e.startTime, end: e.endTime, calendar: clip(e.cal, 80), status: e.appointmentStatus || null }));
    }
    if (opps.__err) out.errors.push('opportunities'); else {
      const stages = {}; const pnames = {}; ((pipes && pipes.pipelines) || []).forEach((pp) => { pnames[pp.id] = pp.name; (pp.stages || []).forEach((st) => { stages[st.id] = st.name; }); });
      out.deals = { open: (opps.meta && opps.meta.total) || (opps.opportunities || []).length,
        moved: (opps.opportunities || []).map((o) => ({ name: clip(o.name || (o.contact && o.contact.name), 80) || 'Deal', pipeline: pnames[o.pipelineId] || null, stage: stages[o.pipelineStageId] || null, at: o.lastStageChangeAt || o.updatedAt })) };
    }
    out.at = new Date().toISOString();
    return out;
}

const ACTIONS = {
  async status(jwt, b) {
    const ws = b.workspace_id;
    const conns = await sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${ws}&provider=eq.highlevel&select=status,account_label,meta`);
    return { highlevel: conns[0] && conns[0].status === 'connected' ? conns[0] : null };
  },
  async 'hl-connect'(jwt, b) {
    const token = String(b.token || '').trim(); const loc = String(b.location_id || '').trim();
    if (!/^pit-[\w-]{20,}$/i.test(token) && token.length < 30) throw bad('Paste a Private Integration token. In HighLevel it starts with pit-.');
    if (!/^[A-Za-z0-9]{12,40}$/.test(loc)) throw bad('Add the sub-account location ID. Find it in Settings, Business Profile.');
    const c = { token, location_id: loc };
    const l = await hl(c, `/locations/${q(loc)}`); const name = (l.location && l.location.name) || 'HighLevel sub-account';
    await hl(c, `/contacts/?locationId=${q(loc)}&limit=1`);
    let pipelines = []; try { pipelines = ((await hl(c, `/opportunities/pipelines?locationId=${q(loc)}`)).pipelines || []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s) => ({ id: s.id, name: s.name })) })); } catch { /* scope may be missing */ }
    const row = await rpc(jwt, 'connection_save', { p_ws: b.workspace_id, p_provider: 'highlevel', p_cipher: seal(JSON.stringify(c)), p_label: name, p_meta: { location_id: loc, location: name, pipelines: pipelines.length } });
    return { ...row, location: name, pipelines };
  },
  async 'ai-connect'(jwt, b) {
    const key = String(b.key || '').trim();
    if (!/^sk-[\w-]{20,}$/.test(key)) throw bad('Paste an OpenAI API key. It starts with sk-.');
    const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key } });
    if (r.status === 401) throw bad('OpenAI did not accept this key. Create a new one at platform.openai.com, API keys.');
    if (!r.ok) throw bad('OpenAI could not be reached right now. Try again in a minute.', 502);
    return rpc(jwt, 'connection_save', { p_ws: b.workspace_id, p_provider: 'openai', p_cipher: seal(key), p_label: 'OpenAI key ending ' + key.slice(-4), p_meta: { model: process.env.OPENAI_MODEL || 'gpt-6.1-sol' } });
  },
  // The Jarvis home brief: new leads, booked calls and deal movement. Counts and names only, no money.
  async brief(jwt, b) { return briefFor(await hlCreds(jwt, b.workspace_id)); },
  // Revenue lives below. briefFor is shared with the daily job.
  // Live revenue from HighLevel payments, Stripe and affiliate commissions, merged in ./_revenue.js.
  // Summarised there so the browser never receives raw charge data, and a charge HighLevel took through Stripe counts once.
  async revenue(jwt, b) {
    const ws = b.workspace_id; const months = Math.min(24, Math.max(3, +b.months || 12));
    const secret = (p) => rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: p }).catch(() => null);
    const R = require('./_revenue');
    const since = new Date(Date.now() - (months + 1) * 31 * 864e5).toISOString();
    const [hlRaw, stRaw, aff, pbRows, pbAny] = await Promise.all([
      secret('highlevel'), secret('stripe'),
      sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${q(ws)}&provider=eq.affiliate&status=eq.connected&select=commissions:meta->aff->commissions`).catch(() => []),
      // Commission postbacks from HighLevel's affiliate program. Test postbacks are left out.
      sb(jwt, `/rest/v1/affiliate_events?workspace_id=eq.${q(ws)}&kind=eq.commission&status=neq.test&created_at=gte.${q(since)}&select=raw,created_at&order=created_at.desc&limit=5000`).catch(() => []),
      sb(jwt, `/rest/v1/affiliate_events?workspace_id=eq.${q(ws)}&select=created_at&order=created_at.desc&limit=1`).catch(() => []),
    ]);
    const pbList = (pbRows || []).map((x) => { const c = R.commissionOf(x.raw); return c ? { ...c, at: c.at || x.created_at } : null; }).filter(Boolean);
    const postbacks = { list: pbList, wired: !!(pbAny && pbAny.length) };
    const errors = {}; let hlc = null; let stripeKey = null;
    if (hlRaw) { try { hlc = await require('./_hl').fresh(JSON.parse(open(hlRaw, 'HighLevel')), ws); } catch (e) { errors.highlevel = e.message; } }
    if (stRaw) { try { const j = JSON.parse(open(stRaw, 'Stripe')); stripeKey = (j && j.key) || null; } catch (e) { errors.stripe = e.message; } }
    const commissions = (aff && aff[0] && aff[0].commissions) || null;
    if (!hlRaw && !stRaw && !commissions && !pbList.length) throw bad('Connect HighLevel or Stripe, or add the affiliate commission postback, to see live revenue.', 409);
    const out = await R.read({ hl: hlc, stripeKey, affiliate: commissions, postbacks, months });
    out.streams.forEach((s) => { if (errors[s.id]) { s.on = true; s.error = s.error || errors[s.id]; } });
    return out;
  },
  async disconnect(jwt, b) { return rpc(jwt, 'connection_remove', { p_ws: b.workspace_id, p_provider: 'highlevel' }); },

  /* ---------- Grok Bot: confirmed handoffs to the founder's own Grok Bot routine. Grok reports back over MCP. ---------- */
  async 'grok-status'(jwt, b) {
    const [conn, tasks] = await Promise.all([
      sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${b.workspace_id}&provider=eq.grok-bot&select=status,account_label,meta,connected_at`),
      sb(jwt, `/rest/v1/grok_tasks?workspace_id=eq.${b.workspace_id}&select=id,agent,title,instruction,status,summary,links,updates,send_error,sent_at,created_at,updated_at&order=created_at.desc&limit=40`),
    ]);
    return { connection: conn[0] && conn[0].status === 'connected' ? conn[0] : null, tasks };
  },
  async 'grok-connect'(jwt, b) {
    const url = String(b.url || '').trim(); const secret = String(b.key || '').trim();
    const u = grokUrl(url);
    if (secret.length < 8 || secret.length > 500 || /\s/.test(secret)) throw bad('Paste the webhook key Grok Bot showed when you created the routine.');
    const meta = { host: u.host, routine: clip(b.routine, 80) || 'Founders OS tasks' };
    return rpc(jwt, 'connection_save', { p_ws: b.workspace_id, p_provider: 'grok-bot', p_cipher: seal(JSON.stringify({ url: u.href, key: secret })), p_label: meta.routine, p_meta: meta });
  },
  async 'grok-disconnect'(jwt, b) { return rpc(jwt, 'connection_remove', { p_ws: b.workspace_id, p_provider: 'grok-bot' }); },
  // A ping so the founder can see the routine fire. Grok is told it is a test and to do nothing.
  async 'grok-test'(jwt, b) {
    const c = await grokCreds(jwt, b.workspace_id);
    const r = await grokPost(c, { kind: 'test', source: 'Founders AI OS', message: 'Connection test from Founders AI OS. Do nothing else. If you can, reply that the Founders OS tasks routine is connected.' });
    return { ok: true, status: r.status };
  },
  // Save the confirmed task, post it to the routine, record whether the run started. Nothing is sent without this call.
  async 'grok-send'(jwt, b) {
    const title = clip(b.title, 160); const instruction = String(b.instruction || '').trim().slice(0, 8000);
    const agent = ['automations', 'support', 'qa', 'accounting'].includes(b.agent) ? b.agent : 'automations';
    if (!title) throw bad('Give the task a short title.');
    if (instruction.length < 10) throw bad('Write what Grok should do.');
    const c = await grokCreds(jwt, b.workspace_id);
    const [row] = await sb(jwt, '/rest/v1/grok_tasks', { method: 'POST', prefer: 'return=representation', body: { workspace_id: b.workspace_id, agent, title, instruction } });
    let patch;
    try {
      await grokPost(c, grokPayload(row));
      patch = { status: 'sent', sent_at: new Date().toISOString(), send_error: null };
    } catch (e) { patch = { status: 'failed', send_error: clip(e.message, 300) }; }
    patch.updated_at = new Date().toISOString();
    const [out] = await sb(jwt, `/rest/v1/grok_tasks?id=eq.${row.id}&workspace_id=eq.${b.workspace_id}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
    if (patch.status === 'failed') throw bad('Grok Bot did not take the task: ' + patch.send_error + ' It is saved in the handoff list so you can resend it.', 502);
    return out;
  },
  async 'grok-resend'(jwt, b) {
    const id = String(b.id || ''); if (!/^[0-9a-f-]{36}$/i.test(id)) throw bad('Missing task');
    const [row] = await sb(jwt, `/rest/v1/grok_tasks?id=eq.${id}&workspace_id=eq.${b.workspace_id}&select=*`);
    if (!row) throw bad('That task is gone', 404);
    const c = await grokCreds(jwt, b.workspace_id);
    let patch;
    try { await grokPost(c, grokPayload(row)); patch = { status: 'sent', sent_at: new Date().toISOString(), send_error: null }; }
    catch (e) { patch = { status: 'failed', send_error: clip(e.message, 300) }; }
    patch.updated_at = new Date().toISOString();
    const [out] = await sb(jwt, `/rest/v1/grok_tasks?id=eq.${id}&workspace_id=eq.${b.workspace_id}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
    if (patch.status === 'failed') throw bad('Grok Bot did not take the task: ' + patch.send_error, 502);
    return out;
  },
  async 'grok-close'(jwt, b) {
    const id = String(b.id || ''); if (!/^[0-9a-f-]{36}$/i.test(id)) throw bad('Missing task');
    const status = b.status === 'done' ? 'done' : 'cancelled';
    const [out] = await sb(jwt, `/rest/v1/grok_tasks?id=eq.${id}&workspace_id=eq.${b.workspace_id}`, { method: 'PATCH', prefer: 'return=representation', body: { status, updated_at: new Date().toISOString() } });
    return out || { id, status };
  },

  /* ---------- CRM: one HighLevel pipeline as a board. HighLevel stays the source of truth. ---------- */
  // The board: every pipeline with its stages, and the opportunities in the chosen one (open by default).
  async 'crm-board'(jwt, b) {
    const c = await hlCreds(jwt, b.workspace_id); const L = q(c.location_id);
    let pipes;
    try { pipes = ((await hl(c, `/opportunities/pipelines?locationId=${L}`)).pipelines || []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).sort((x, y) => (x.position || 0) - (y.position || 0)).map((st) => ({ id: st.id, name: st.name })) })); }
    catch (e) { if (e.code === 403 || /scope/i.test(e.message)) throw bad('Your HighLevel token needs the opportunities.readonly and opportunities.write scopes. Add them to the Private Integration and reconnect.', 403); throw e; }
    const want = String(b.pipeline_id || '');
    const pipe = pipes.find((p) => p.id === want) || pipes.find((p) => /founder pipeline/i.test(p.name)) || pipes[0] || null;
    const status = ['open', 'won', 'lost', 'abandoned', 'all'].includes(b.status) ? b.status : 'open';
    const term = clip(String(b.q || '').trim(), 120);
    const per = Math.min(Math.max(+b.per || 40, 10), 100);
    // One page per stage, so every column shows its real total and loads more on its own.
    const opps = [], counts = {};
    if (pipe) await Promise.all(pipe.stages.map(async (st) => {
      const r = await crmPage(c, { pipe: pipe.id, stage: st.id, status, term, per });
      counts[st.id] = { total: r.total, next: r.next }; r.cards.forEach((o) => opps.push(o));
    }));
    const total = Object.values(counts).reduce((n, x) => n + x.total, 0);
    return { location_id: c.location_id, pipelines: pipes, pipeline: pipe, status, q: term, total, counts, opportunities: opps, at: new Date().toISOString() };
  },
  // The next page of one column.
  async 'crm-stage'(jwt, b) {
    const c = await hlCreds(jwt, b.workspace_id);
    if (!b.pipeline_id || !b.stage_id || !b.next) throw bad('Pick a stage');
    const status = ['open', 'won', 'lost', 'abandoned', 'all'].includes(b.status) ? b.status : 'open';
    const r = await crmPage(c, { pipe: String(b.pipeline_id), stage: String(b.stage_id), status, term: clip(String(b.q || '').trim(), 120), per: Math.min(Math.max(+b.per || 40, 10), 100), next: b.next });
    return { stage_id: String(b.stage_id), total: r.total, next: r.next, opportunities: r.cards };
  },
  // Move one opportunity to another stage, or mark it won, lost or abandoned.
  async 'crm-move'(jwt, b) {
    const c = await hlCreds(jwt, b.workspace_id);
    if (!/^[A-Za-z0-9]{8,40}$/.test(String(b.id || ''))) throw bad('Pick an opportunity');
    const body = {};
    if (b.pipeline_id) body.pipelineId = String(b.pipeline_id);
    if (b.stage_id) body.pipelineStageId = String(b.stage_id);
    if (['open', 'won', 'lost', 'abandoned'].includes(b.status)) body.status = b.status;
    if (!Object.keys(body).length) throw bad('Nothing to change');
    const r = await hl(c, `/opportunities/${q(b.id)}`, { method: 'PUT', body });
    return { opportunity: crmCard(r.opportunity || r) };
  },
  // Place contacts by email in a stage. Existing opportunities in this pipeline move; new ones are created.
  // Missing contacts are only created when the founder asks for it.
  async 'crm-place'(jwt, b) {
    const c = await hlCreds(jwt, b.workspace_id); const L = c.location_id;
    const pid = String(b.pipeline_id || ''), sid = String(b.stage_id || '');
    if (!pid || !sid) throw bad('Pick a pipeline and a stage');
    const emails = [...new Set((Array.isArray(b.emails) ? b.emails : []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 40);
    if (!emails.length) throw bad('Add at least one email');
    const add = b.create_contacts === true;
    // up_only (used by AI access): a card already further along stays where it is.
    let order = null;
    if (b.up_only) { const p = ((await hl(c, `/opportunities/pipelines?locationId=${q(L)}`)).pipelines || []).find((x) => x.id === pid); order = p ? (p.stages || []).slice().sort((x, y) => (x.position || 0) - (y.position || 0)).map((x) => x.id) : []; if (!order.includes(sid)) throw bad('That stage is not in this pipeline'); }
    const one = async (email) => {
      try {
        let ct = (await hl(c, `/contacts/search/duplicate?locationId=${q(L)}&email=${q(email)}`)).contact || null;
        if (!ct && !add) return { email, result: 'no-contact' };
        let made = false;
        if (!ct) { ct = (await hl(c, '/contacts/', { method: 'POST', body: { locationId: L, email, source: 'Founders OS CRM' } })).contact; made = true; }
        const name = clip(ct.contactName || [ct.firstName, ct.lastName].filter(Boolean).join(' ') || ct.name, 120) || email;
        const found = ((await hl(c, `/opportunities/search?location_id=${q(L)}&pipeline_id=${q(pid)}&contact_id=${q(ct.id)}&limit=5`)).opportunities || [])[0];
        if (found) {
          if (found.pipelineStageId === sid && found.status === 'open') return { email, name, result: 'already', id: found.id };
          if (order && order.indexOf(found.pipelineStageId) > order.indexOf(sid)) return { email, name, result: 'already-further', id: found.id };
          await hl(c, `/opportunities/${q(found.id)}`, { method: 'PUT', body: { pipelineStageId: sid, status: 'open' } });
          return { email, name, result: 'moved', id: found.id };
        }
        const r = await hl(c, '/opportunities/', { method: 'POST', body: { pipelineId: pid, locationId: L, name, pipelineStageId: sid, status: 'open', contactId: ct.id, source: 'Founders OS CRM' } });
        return { email, name, result: made ? 'created-contact' : 'created', id: (r.opportunity || r).id };
      } catch (e) { return { email, result: 'error', error: clip(e.message, 200) }; }
    };
    const out = [];
    for (let i = 0; i < emails.length; i += 4) out.push(...await Promise.all(emails.slice(i, i + 4).map(one)));
    return { results: out };
  },
};
async function crmPage(c, { pipe, stage, status, term, per, next }) {
  let u = `/opportunities/search?location_id=${q(c.location_id)}&pipeline_id=${q(pipe)}&pipeline_stage_id=${q(stage)}&limit=${per}`;
  if (status !== 'all') u += '&status=' + status;
  if (term) u += '&q=' + q(term);
  if (next && next.a && next.id) u += `&startAfter=${q(String(next.a))}&startAfterId=${q(String(next.id))}`;
  const r = await hl(c, u), list = r.opportunities || [], m = r.meta || {};
  return { total: +m.total || list.length, cards: list.map(crmCard), next: list.length === per && m.startAfterId ? { a: m.startAfter, id: m.startAfterId } : null };
}
function crmCard(o) {
  const ct = o.contact || {};
  return { id: o.id, name: clip(o.name || ct.name, 120) || 'Opportunity', stage_id: o.pipelineStageId, pipeline_id: o.pipelineId, status: o.status || 'open',
    value: o.monetaryValue != null ? +o.monetaryValue || 0 : null, source: clip(o.source, 80), created_at: o.createdAt || null, stage_at: o.lastStageChangeAt || o.updatedAt || null, updated_at: o.updatedAt || null,
    contact: { id: o.contactId || ct.id || null, name: clip(ct.name, 120), email: clip(ct.email, 200), phone: clip(ct.phone, 40), company: clip(ct.companyName, 120), tags: (ct.tags || []).slice(0, 8).map((t) => clip(t, 40)) } };
}

/* ---------- inbound: the Google OAuth return for Connections ---------- */
async function inbound(req, res, qs) {
  if (qs.get('oauth') === 'google') {
    const dest = APP_URL + '/#connect' + (qs.get('code') ? '?g_code=' + q(qs.get('code')) + '&g_state=' + q(qs.get('state') || '') : '?g_error=' + q(qs.get('error') || 'cancelled'));
    res.statusCode = 302; res.setHeader('Location', dest); return res.end();
  }
  res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end('Use POST');
}

module.exports = async (req, res) => {
  const qs = new URL(req.url, 'http://x').searchParams;
  if (qs.get('oauth')) return inbound(req, res, qs);
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  const act = ACTIONS[b.action];
  if (!act) return send(400, { error: 'Unknown action' });
  if (!jwt) return send(401, { error: 'Sign in first' });
  if (!/^[0-9a-f-]{36}$/i.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
  try { return send(200, await act(jwt, b)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._briefFor = briefFor;
module.exports._hl = hl;
module.exports._hlCreds = hlCreds;
// MCP: run a CRM action with credentials the server opened from the token's workspace.
module.exports._crm = (sealed, action, body) => {
  if (!['crm-board', 'crm-stage', 'crm-move', 'crm-place'].includes(action)) throw bad('Unknown CRM action');
  return ACTIONS[action]({ creds: JSON.parse(open(sealed, 'HighLevel')) }, body || {});
};
module.exports._crmCard = crmCard; module.exports._creds = (sealed) => JSON.parse(open(sealed, 'HighLevel'));

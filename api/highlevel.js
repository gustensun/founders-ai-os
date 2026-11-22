// Founders AI OS: everything that syncs with HighLevel beyond reading.
// Every write here runs only when the founder presses a confirm button in the app. Nothing sends to contacts.
// Posts land in Social Planner as drafts (or scheduled when the founder picks a time), blog posts as drafts,
// Brand DNA only touches custom values whose names start with "FOS ", and programs import as draft courses.
// Conversations are never read. Marketplace app sign-in and live webhooks work when the app env vars are set.
const { rpc, sb, seal, sign, unsign, bad, clip, q, APP_URL } = require('./_lib');
const H = require('./_hl');
const IB = require('./inbox.js');

const PREFIX = 'FOS ';
const isUrl = (u) => /^https:\/\/[^\s"'<>]{4,600}$/.test(String(u || ''));
const L = (c) => q(c.location_id);
const creds = (jwt, ws) => IB._hlCreds(jwt, ws);
const member = async (jwt, ws) => { const r = await sb(jwt, `/rest/v1/workspaces?id=eq.${ws}&select=id,kind`); if (!r || !r[0]) throw bad('Workspace not found', 404); return r[0]; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const toHtml = (t) => String(t || '').trim().split(/\n{2,}/).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('\n');
const day = (t) => new Date(t).toISOString().slice(0, 10);

/* ---------- custom values ---------- */
function cleanValues(items) {
  if (!Array.isArray(items) || !items.length) throw bad('Nothing to sync');
  return items.slice(0, 40).map((x) => ({ name: clip(x && x.name, 80) || '', value: String((x && x.value) || '').slice(0, 4000).trim() }))
    .filter((x) => x.name.startsWith(PREFIX) && x.name.length > PREFIX.length && x.value);
}
async function valuesPlan(c, items) {
  const want = cleanValues(items); if (!want.length) throw bad('Nothing to sync. Only values named "FOS ..." are written.');
  const have = ((await H.call(c, `/locations/${L(c)}/customValues`)) || {}).customValues || [];
  return want.map((w) => { const h = have.find((x) => String(x.name).trim().toLowerCase() === w.name.toLowerCase()); return { ...w, id: h ? h.id : null, key: h ? h.fieldKey : null, before: h ? h.value : null, op: !h ? 'create' : String(h.value) === w.value ? 'same' : 'update' }; });
}

/* ---------- forms and surveys, last N days ---------- */
async function formStats(c, days = 30) {
  const end = Date.now(); const start = end - days * 864e5; const out = { days, forms: [], surveys: [], errors: [] };
  const safe = (p) => p.catch((e) => ({ __err: e.message }));
  const [forms, surveys] = await Promise.all([safe(H.call(c, `/forms/?locationId=${L(c)}&limit=50`)), safe(H.call(c, `/surveys/?locationId=${L(c)}&limit=50`))]);
  const count = async (kind, id) => { const r = await H.call(c, `/${kind}/submissions?locationId=${L(c)}&${kind === 'forms' ? 'formId' : 'surveyId'}=${q(id)}&startAt=${day(start)}&endAt=${day(end)}&limit=1&page=1`).catch(() => null); return r && r.meta ? (r.meta.total ?? null) : null; };
  if (forms.__err) out.errors.push('forms'); else out.forms = await Promise.all(((forms.forms || []).slice(0, 30)).map(async (f) => ({ id: f.id, name: clip(f.name, 120) || 'Form', submissions: await count('forms', f.id) })));
  if (surveys.__err) out.errors.push('surveys'); else out.surveys = await Promise.all(((surveys.surveys || []).slice(0, 30)).map(async (f) => ({ id: f.id, name: clip(f.name, 120) || 'Survey', submissions: await count('surveys', f.id) })));
  out.total = [...out.forms, ...out.surveys].reduce((n, f) => n + (f.submissions || 0), 0);
  out.at = new Date().toISOString();
  return out;
}

/* ---------- courses ---------- */
function coursePayload(c, p) {
  const title = clip(p && p.title, 200); if (!title) throw bad('The program needs a title');
  const mods = (Array.isArray(p.modules) ? p.modules : []).slice(0, 40).map((m, i) => ({
    title: clip(m && m.title, 200) || 'Module ' + (i + 1), visibility: 'draft',
    posts: (Array.isArray(m && m.lessons) ? m.lessons : []).slice(0, 60).map((l, j) => ({ title: clip(l && l.title, 200) || 'Lesson ' + (j + 1), visibility: 'draft', contentType: 'video', description: String((l && l.description) || '').slice(0, 4000) })),
  }));
  if (!mods.length) throw bad('Add at least one module before sending it to HighLevel');
  return { locationId: c.location_id, ...(c.user_id ? { userId: c.user_id } : {}), products: [{ title, description: String(p.description || '').slice(0, 4000), ...(isUrl(p.image) ? { imageUrl: p.image } : {}), ...(p.instructor ? { instructorDetails: { name: clip(p.instructor, 120), description: '' } } : {}), categories: mods }] };
}

/* ---------- social planner ---------- */
async function accounts(c) {
  const j = await H.call(c, `/social-media-posting/${L(c)}/accounts`);
  return ((j && j.results && j.results.accounts) || []).filter((a) => !a.deleted).map((a) => ({ id: a.id, name: clip(a.name, 80), platform: a.platform, type: a.type || null, avatar: isUrl(a.avatar) ? a.avatar : null, expired: !!a.isExpired }));
}

const ACTIONS = {
  async status(jwt, b) {
    const rows = await sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${b.workspace_id}&provider=in.(highlevel,hl-webhooks)&select=provider,status,account_label,meta,updated_at`);
    const hl = (rows || []).find((r) => r.provider === 'highlevel' && r.status === 'connected'); const wh = (rows || []).find((r) => r.provider === 'hl-webhooks');
    const evs = [...((hl && hl.meta && hl.meta.events) || []).map((e) => ({ ...e, via: 'app' })), ...((wh && wh.meta && wh.meta.events) || []).map((e) => ({ ...e, via: 'workflow' }))]
      .sort((a, c) => String(c.at).localeCompare(String(a.at))).slice(0, 30);
    return { connected: !!hl, location: hl ? hl.account_label : null, via: hl && hl.meta && hl.meta.via === 'app' ? 'app' : hl ? 'token' : null,
      app: H.appOn(), redirect_uri: H.redirectUri(), webhook_url: `${APP_URL}/api/highlevel?hook=app`, scopes: H.PIT_SCOPES,
      workflows: wh ? { status: wh.status, count: (wh.meta && wh.meta.event_count) || 0, last: wh.meta && wh.meta.last_event_at } : null, events: evs };
  },

  /* Marketplace app sign-in */
  async 'oauth-start'(jwt, b) {
    if (!H.appOn()) throw bad('One-click HighLevel sign-in needs a HighLevel Marketplace app. Until then, connect with a Private Integration token.', 409);
    await member(jwt, b.workspace_id);
    const state = sign({ ws: b.workspace_id, exp: Date.now() + 15 * 60e3, p: 'hl' });
    const u = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    u.search = new URLSearchParams({ response_type: 'code', redirect_uri: H.redirectUri(), client_id: process.env.HL_APP_CLIENT_ID, scope: H.APP_SCOPES.join(' '), state }).toString();
    return { url: u.href };
  },
  async 'oauth-finish'(jwt, b) {
    if (!H.appOn()) throw bad('One-click HighLevel sign-in needs HL_APP_CLIENT_ID and HL_APP_CLIENT_SECRET in Vercel (SETUP.md, optional step C). Until then, connect HighLevel with a Private Integration token in Connections.', 409);
    const st = unsign(b.state); if (st.ws !== b.workspace_id || st.p !== 'hl') throw bad('This sign-in belongs to another workspace. Try again.');
    const c = await H.exchange(String(b.code || '').slice(0, 400));
    if (!c.location_id) throw bad('Pick a sub-account, not the agency, when HighLevel asks.');
    let name = 'HighLevel sub-account'; try { const l = await H.call(c, `/locations/${L(c)}`); name = (l.location && l.location.name) || name; } catch { /* scope may be missing */ }
    await rpc(jwt, 'connection_save', { p_ws: b.workspace_id, p_provider: 'highlevel', p_cipher: seal(JSON.stringify(c)), p_label: name, p_meta: { location_id: c.location_id, location: name, via: 'app' } });
    return { location: name };
  },

  /* Social Planner and blog */
  async 'social-accounts'(jwt, b) { return { accounts: await accounts(await creds(jwt, b.workspace_id)) }; },
  async 'social-post'(jwt, b) {
    const c = await creds(jwt, b.workspace_id);
    const text = String(b.text || '').trim().slice(0, 5000); if (!text) throw bad('The post is empty');
    const ids = (Array.isArray(b.account_ids) ? b.account_ids : []).map((x) => clip(x, 80)).filter(Boolean).slice(0, 12);
    const when = b.schedule_at ? Date.parse(b.schedule_at) : NaN; const scheduled = Number.isFinite(when);
    if (scheduled && when < Date.now() + 5 * 60e3) throw bad('Pick a time at least five minutes from now');
    if (scheduled && !ids.length) throw bad('Pick at least one account to schedule on');
    const media = isUrl(b.media_url) ? [{ url: b.media_url, type: /\.mp4($|\?)/i.test(b.media_url) ? 'video/mp4' : /\.png($|\?)/i.test(b.media_url) ? 'image/png' : 'image/jpeg' }] : [];
    const all = ids.length ? await accounts(c) : []; const plats = new Set(all.filter((a) => ids.includes(a.id)).map((a) => a.platform));
    const body = { type: 'post', summary: text, media, status: scheduled ? 'scheduled' : 'draft', ...(ids.length ? { accountIds: ids } : {}), ...(scheduled ? { scheduleDate: new Date(when).toISOString() } : {}),
      ...(c.user_id ? { userId: c.user_id } : {}), ...(plats.has('instagram') ? { instagramPostDetails: { type: 'post' } } : {}), ...(plats.has('facebook') ? { facebookPostDetails: { type: 'post' } } : {}) };
    const r = await H.call(c, `/social-media-posting/${L(c)}/posts`, { method: 'POST', body, version: 'v3', alt: '2021-07-28' });
    const post = (r && r.results && r.results.post) || (r && r.post) || r || {};
    return { ok: true, id: post._id || post.id || null, status: body.status, when: scheduled ? body.scheduleDate : null };
  },
  async 'blog-sites'(jwt, b) {
    const c = await creds(jwt, b.workspace_id);
    const j = await H.call(c, `/blogs/site/all?locationId=${L(c)}&skip=0&limit=20`);
    return { blogs: ((j && (j.data || j.blogs || j.sites)) || []).map((x) => ({ id: x._id || x.id, name: clip(x.name || x.title, 120) || 'Blog' })) };
  },
  async 'blog-post'(jwt, b) {
    const c = await creds(jwt, b.workspace_id);
    const blogId = clip(b.blog_id, 80); if (!blogId) throw bad('Pick a blog');
    const title = clip(b.title, 200) || 'Draft'; const text = String(b.text || '').trim(); if (!text) throw bad('The post is empty');
    const body = { locationId: c.location_id, blogId, title, rawHTML: toHtml(text), status: 'DRAFT', description: clip(text, 160), urlSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80), categories: [], tags: [] };
    const r = await H.call(c, '/blogs/posts', { method: 'POST', body, version: 'v3', alt: '2021-07-28' });
    return { ok: true, id: (r && r.data && (r.data._id || r.data.id)) || null, status: 'DRAFT' };
  },

  /* Brand DNA to custom values */
  async 'values-preview'(jwt, b) { const c = await creds(jwt, b.workspace_id); return { prefix: PREFIX, rows: await valuesPlan(c, b.items) }; },
  async 'values-apply'(jwt, b) {
    const c = await creds(jwt, b.workspace_id); const plan = await valuesPlan(c, b.items); const done = [];
    for (const r of plan) {
      if (r.op === 'same') { done.push({ name: r.name, op: 'same', key: r.key }); continue; }
      if (r.op === 'update') { const j = await H.call(c, `/locations/${L(c)}/customValues/${q(r.id)}`, { method: 'PUT', body: { name: r.name, value: r.value } }); done.push({ name: r.name, op: 'updated', key: (j && j.customValue && j.customValue.fieldKey) || r.key }); continue; }
      const j = await H.call(c, `/locations/${L(c)}/customValues`, { method: 'POST', body: { name: r.name, value: r.value } });
      done.push({ name: r.name, op: 'created', key: j && j.customValue && j.customValue.fieldKey });
    }
    return { done };
  },

  /* Programs to Courses */
  async 'course-preview'(jwt, b) { const c = await creds(jwt, b.workspace_id); const p = coursePayload(c, b.program || {}); const k = p.products[0]; return { title: k.title, modules: k.categories.length, lessons: k.categories.reduce((n, m) => n + m.posts.length, 0) }; },
  async 'course-import'(jwt, b) {
    const c = await creds(jwt, b.workspace_id); const body = coursePayload(c, b.program || {});
    await H.call(c, '/courses/courses-exporter/public/import', { method: 'POST', body, version: 'v3', alt: '2021-07-28' });
    const k = body.products[0];
    return { ok: true, title: k.title, modules: k.categories.length, lessons: k.categories.reduce((n, m) => n + m.posts.length, 0), at: new Date().toISOString() };
  },

  /* Funnel and form results */
  async 'form-stats'(jwt, b) { return formStats(await creds(jwt, b.workspace_id), [7, 30, 90].includes(+b.days) ? +b.days : 30); },

  /* HighLevel MCP, read only */
  async 'mcp-tools'(jwt, b) { const M = require('./_hlmcp'); const c = await creds(jwt, b.workspace_id); const t = await M.client(c).tools(); return { tools: t.map((x) => ({ name: x.name, description: clip(x.description, 200) })) }; },
};

/* ---------- inbound: OAuth return and Marketplace webhooks ---------- */
const readRaw = (req) => new Promise((ok, no) => { let d = ''; req.setEncoding('utf8'); req.on('data', (c) => { d += c; if (d.length > 2e6) { no(new Error('too big')); req.destroy(); } }); req.on('end', () => ok(d)); req.on('error', no); });
function eventOf(e) {
  const t = String(e.type || ''); if (/message|conversation|email|sms|call/i.test(t)) return null;
  const name = clip(e.name || e.contactName || e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.title, 80);
  const amount = e.amount != null ? +e.amount : e.totalAmount != null ? +e.totalAmount : e.monetaryValue != null ? +e.monetaryValue : null;
  return { type: clip(t, 60) || 'Event', name, source: clip(e.source, 60), title: clip(e.title || (e.appointment && e.appointment.title), 100), stage: clip(e.pipelineStageId ? 'stage moved' : null, 40), amount: Number.isFinite(amount) ? amount : null, status: clip(e.status || e.appointmentStatus, 30) };
}
async function inbound(req, res, qs) {
  if (qs.get('oauth') === 'hl') {
    const dest = APP_URL + '/#connect' + (qs.get('code') ? '?hl_code=' + q(qs.get('code')) + '&hl_state=' + q(qs.get('state') || '') : '?hl_error=' + q(qs.get('error_description') || qs.get('error') || 'cancelled'));
    res.statusCode = 302; res.setHeader('Location', dest); return res.end();
  }
  if (qs.get('hook') === 'app') {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
    let raw = ''; try { raw = await readRaw(req); } catch { res.statusCode = 400; return res.end(); }
    if (!H.verify(raw, req.headers['x-ghl-signature'])) { res.statusCode = 401; return res.end('bad signature'); }
    let e = {}; try { e = JSON.parse(raw); } catch { res.statusCode = 400; return res.end(); }
    const ev = eventOf(e); const loc = clip(e.locationId || (e.location && e.location.id), 60);
    if (ev && loc && process.env.CRON_SECRET) await rpc(null, 'hl_app_ingest', { p_secret: process.env.CRON_SECRET, p_location: loc, p_event: ev }).catch(() => null);
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); return res.end('{"ok":true}');
  }
  res.statusCode = 404; return res.end('not found');
}

module.exports = async (req, res) => {
  const qs = new URL(req.url, 'http://x').searchParams;
  if (qs.get('oauth') || qs.get('hook')) return inbound(req, res, qs);
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
module.exports._valuesPlan = valuesPlan; module.exports._coursePayload = coursePayload; module.exports._eventOf = eventOf; module.exports._PREFIX = PREFIX;

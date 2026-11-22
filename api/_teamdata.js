// What AI Team agents can read from the founder's connected accounts. Everything here is read only.
// YouTube (both channels), every other connection's synced data, and HighLevel straight from its API:
// contacts, deals, payments, orders, subscriptions, appointments, products, funnels, forms and more.
// HighLevel conversations and messages are never read: there is no route to them in this file.
const { sb, rpc, seal, clip } = require('./_lib');
const HLC = require('./_hl');

const q = encodeURIComponent;
const DAY = 864e5;
const int = (v, lo, hi, d) => { const n = Math.round(+v); return isNaN(n) ? d : Math.min(hi, Math.max(lo, n)); };
const day = (t) => new Date(t).toISOString().slice(0, 10);
const round2 = (n) => Math.round((+n || 0) * 100) / 100;
const ago = (iso) => { const t = Date.parse(iso || ''); if (!t) return null; const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago'; };
const NAMES = { youtube: 'YouTube', 'youtube-2': 'Second YouTube channel', instagram: 'Instagram', highlevel: 'HighLevel', gcal: 'Google Calendar', zoom: 'Zoom', tella: 'Tella', affiliate: 'Affiliate exports', stripe: 'Stripe', paypal: 'PayPal', ga4: 'Google Analytics', gsc: 'Search Console', linkedin: 'LinkedIn', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', apify: 'Apify', github: 'GitHub', vercel: 'Vercel', elevenlabs: 'ElevenLabs', claude: 'Claude', openai: 'OpenAI', openrouter: 'OpenRouter', 'hl-webhooks': 'HighLevel workflow webhooks', 'grok-bot': 'Grok Bot', gmail: 'Gmail', whatsapp: 'WhatsApp', telegram: 'Telegram', 'email-digest': 'Email digest' };
const nameOf = (p) => NAMES[p] || String(p || '').replace(/-/g, ' ');
const YT = ['youtube', 'youtube-2'];

/* ---------- connections ---------- */
async function conns(ctx) {
  if (!ctx.conns) ctx.conns = (await sb(ctx.jwt, `/rest/v1/workspace_connections?workspace_id=eq.${ctx.ws}&select=provider,status,account_label,connected_at,meta`).catch(() => [])) || [];
  return ctx.conns;
}
const on = (r) => r && (r.status === 'connected' || r.status === 'error');
// Settings that hold addresses or keys never go to a model, whatever a connection stores later.
const PRIVATE = /(token|secret|password|passwd|api_?key|cipher|webhook|skool|signature|postback|credential|hook_?url)/i;
// Keep any value small enough for a model to read: short strings, short lists, limited depth.
function shrink(v, { arr = 25, str = 400, depth = 5 } = {}, d = 0) {
  if (v == null) return undefined;
  if (typeof v === 'string') return v.length > str ? v.slice(0, str) + '...' : v;
  if (typeof v !== 'object') return v;
  if (d >= depth) return Array.isArray(v) ? `[${v.length} items]` : '{...}';
  if (Array.isArray(v)) { const out = v.slice(0, arr).map((x) => shrink(x, { arr, str, depth }, d + 1)).filter((x) => x !== undefined); if (v.length > arr) out.push(`and ${v.length - arr} more`); return out; }
  const out = {};
  for (const [k, x] of Object.entries(v).slice(0, 60)) { if (/^(thumb|avatar|preview|__label)$/.test(k) || PRIVATE.test(k)) continue; const s = shrink(x, { arr, str, depth }, d + 1); if (s !== undefined && !(Array.isArray(s) && !s.length)) out[k] = s; }
  return out;
}
// Fresh numbers before an answer, never holding it up for long. When the agent asked for a refresh it runs the
// same sync as the Sync button. When the data is only old it reads quietly: a failed read keeps the stored
// numbers and leaves the connection as it was.
async function refresh(ctx, row, asked) {
  try {
    const C = require('./connect.js'); if (!C._P[row.provider] || !C._P[row.provider].sync) return false;
    const meta = { ...(row.meta || {}), __label: row.account_label };
    const work = (async () => {
      const c = await C._creds(ctx.jwt, ctx.ws, row.provider);
      if (asked) return C._syncAndStore(ctx.jwt, ctx.ws, row.provider, c, meta);
      const m = await C._syncOne(row.provider, c, meta, { reseal: (nc) => rpc(ctx.jwt, 'connection_reseal', { p_ws: ctx.ws, p_provider: row.provider, p_cipher: seal(JSON.stringify(nc)) }) });
      await rpc(ctx.jwt, 'connection_status', { p_ws: ctx.ws, p_provider: row.provider, p_status: 'connected', p_meta: m });
      return { ok: true, meta: m };
    })();
    work.catch(() => null);
    const r = await Promise.race([work, new Promise((res) => setTimeout(() => res(null), 20000))]);
    if (r && r.ok && r.meta) { row.meta = { ...(row.meta || {}), ...r.meta }; row.status = 'connected'; return true; }
  } catch { /* stored data still answers */ }
  return false;
}
const lastSync = (row) => (row.meta && row.meta.last_sync_at) || null;
const staleFor = (row, hours) => { const t = Date.parse(lastSync(row) || ''); return !t || Date.now() - t > hours * 3600e3; };

/* ---------- YouTube ---------- */
const iso8601 = (d) => { const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(d || '')); if (!m) return null; const s = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : s + 's'; };
async function youtube(ctx, a) {
  const rows = (await conns(ctx)).filter((r) => YT.includes(r.provider) && on(r));
  if (!rows.length) return { connected: false, message: 'No YouTube channel is connected. The founder connects one under Connections with a channel link.' };
  const want = String(a.channel || '').toLowerCase().trim();
  let pick = rows;
  if (want && !/^(both|all|any)$/.test(want)) {
    pick = rows.filter((r) => (/^(main|first|1|youtube)$/.test(want) && r.provider === 'youtube') || (/^(second|2|youtube-2)$/.test(want) && r.provider === 'youtube-2') || String((r.meta && r.meta.channel && r.meta.channel.title) || r.account_label || '').toLowerCase().includes(want));
    if (!pick.length) pick = rows;
  }
  await Promise.all(pick.map((r) => (a.refresh || staleFor(r, 6) ? refresh(ctx, r, !!a.refresh) : null)));
  const limit = int(a.limit, 1, 25, 15); const sort = ['recent', 'views', 'outliers', 'comments', 'likes'].includes(a.sort) ? a.sort : 'recent';
  const find = String(a.search || '').toLowerCase().trim();
  const channels = pick.map((r) => {
    const m = r.meta || {}; const ch = m.channel || {}; const an = m.analytics;
    let vs = (m.videos || []).slice();
    if (find) vs = vs.filter((v) => String(v.title || '').toLowerCase().includes(find));
    const key = { views: 'views', comments: 'comments', likes: 'likes', outliers: 'x' }[sort];
    vs.sort(key ? (x, y) => (y[key] || 0) - (x[key] || 0) : (x, y) => Date.parse(y.at || 0) - Date.parse(x.at || 0));
    return { connection: r.provider, channel: ch.title || r.account_label, subscribers: ch.subs == null ? null : ch.subs, total_views: ch.views == null ? null : ch.views, videos_published: ch.videos == null ? null : ch.videos,
      synced: ago(lastSync(r)), median_views_last_25: m.median_views == null ? null : m.median_views,
      last_28_days: an && !an.error ? { views: an.views, watch_hours: Math.round((an.minutes || 0) / 60), subscribers_gained: an.subs_gained, subscribers_lost: an.subs_lost, average_view_seconds: an.avg_view_s } : null,
      ...(an && !an.error ? {} : { last_28_days_note: an && an.error ? 'Watch time could not be read: ' + clip(an.error, 120) : 'Watch time, 28 day views and subscriber growth need the founder to sign in with Google on this channel under Connections. Public numbers are shown.' }),
      videos: vs.slice(0, limit).map((v) => ({ title: v.title, url: 'https://youtu.be/' + v.id, published: v.at ? day(v.at) : null, views: v.views, likes: v.likes, comments: v.comments, times_median: v.x || null, length: iso8601(v.duration) })),
      videos_listed: Math.min(limit, vs.length), videos_available: (m.videos || []).length };
  });
  return { connected: true, channels, note: 'The latest 25 uploads per channel are kept. times_median compares a video with the median of those 25; 2 or more is an outlier.' };
}

/* ---------- any other connection ---------- */
function affiliate(m) {
  const a = m.aff || {}; const r = a.referrals, c = a.commissions; const months = (o) => Object.fromEntries(Object.entries(o || {}).sort().slice(-13));
  return {
    referrals: r ? shrink({ as_of: r.asOf, range: r.range, total_referred: r.total, leads: r.leads, trials_ever: r.trials, trials_now: r.trialsNow, active_customers: r.active, ever_customers: r.everCustomers, cancelled: r.cancelled, cancelled_after_paying: r.cancelledPaid, trial_to_customer: r.conversion, retention: r.retention,
      last_30_days: r.last30, previous_30_days: r.prev30, by_state: r.states, by_plan: r.bySub, by_country: r.byCountry, by_month: months(r.byMonth), current_trials: (r.trialList || []).slice(0, 15), recent_customers: (r.recentCustomers || []).slice(0, 15) }) : null,
    commissions: c ? shrink({ as_of: c.asOf, range: c.range, currency: c.currency, total_earned: c.total, last_30_days: c.last30, previous_30_days: c.prev30, average_last_12_months: c.avg12, best_month: c.peak, paying_accounts: c.paying, accounts: c.accounts,
      by_status: c.byStatus, by_plan: c.byPlan, by_product: c.bySub, by_month: months(c.byMonth), top_accounts: c.topAccounts, recent: c.recent }) : null,
    note: !r && !c ? 'No affiliate export has been uploaded yet.' : 'From the affiliate exports the founder uploaded, plus live referral events when postbacks are set up.',
  };
}
function detail(row) {
  const m = row.meta || {}; const p = row.provider;
  if (p === 'instagram') return { profile: shrink(m.profile), audience: shrink(m.audience), recent_posts: (m.posts || []).slice(0, 12).map((x) => ({ caption: clip(x.t, 200), type: x.type, posted: x.at ? day(x.at) : null, likes: x.likes, comments: x.comments, views: x.views, url: x.url })), ...(m.posts && m.posts.length ? {} : { posts_note: 'Recent posts and follower count come through Apify. They are empty until Apify is connected with a working token.' }) };
  if (p === 'gcal') return { calendar: m.calendar, timezone: m.tz, events: (m.events || []).slice(0, 40).map((e) => ({ title: e.title, start: e.start, end: e.end, all_day: !!e.all_day, attendees: Array.isArray(e.attendees) ? e.attendees.slice(0, 8) : [], with_people_outside_the_team: !!e.external, link: e.link || e.url || null })) };
  if (p === 'zoom') return { recordings: (m.recordings || []).slice(0, 30).map((r) => ({ title: r.t, start: r.start, minutes: r.minutes, has_transcript: !!r.transcript })), upcoming: shrink(m.upcoming), transcripts: m.transcripts || null, note: 'Search inside call transcripts with search_everything; list them with get_recordings.' };
  if (p === 'tella') return { videos: (m.videos || []).slice(0, 25).map((v) => ({ title: v.t, recorded: v.at ? day(v.at) : null, minutes: v.minutes, views: v.views, url: v.url })) };
  if (p === 'affiliate') return affiliate(m);
  if (p === 'highlevel') return { location: m.location, pipelines: m.pipelines, default_pipeline: m.pipeline, open_opportunities: m.opportunities, note: 'Read live records with highlevel_data.' };
  if (p === 'elevenlabs') return { characters: m.chars || null, voice: m.voice_name || null, voices_available: (m.voices || []).length };
  const rest = { ...m }; ['feed', '__label', 'sync_error', 'last_sync_at', 'last_try_at'].forEach((k) => delete rest[k]);
  return shrink(rest, { arr: 20, str: 300, depth: 4 });
}
function head(row) {
  const m = row.meta || {}; const f = m.feed || {};
  return { connection: row.provider, name: nameOf(row.provider), status: row.status === 'connected' ? 'connected' : row.status === 'error' ? 'needs a fix' : row.status, account: row.account_label || null, synced: ago(lastSync(row)), ...(m.sync_error ? { sync_problem: clip(m.sync_error, 200) } : {}),
    numbers: (f.metrics || []).slice(0, 12).map((x) => x.l + ': ' + x.v + (x.s ? ' (' + x.s + ')' : '')) };
}
async function connection(ctx, a) {
  const rows = await conns(ctx); const want = String(a.source || '').toLowerCase().trim();
  if (!want) return { connections: rows.map(head), note: 'Pass source to read one connection in full.' };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const alias = { ghl: 'highlevel', gohighlevel: 'highlevel', calendar: 'gcal', googlecalendar: 'gcal', ig: 'instagram', yt: 'youtube', youtube2: 'youtube-2', secondyoutube: 'youtube-2', affiliates: 'affiliate', referrals: 'affiliate', commissions: 'affiliate', analytics: 'ga4', googleanalytics: 'ga4', searchconsole: 'gsc', eleven: 'elevenlabs', twitter: 'x' }[norm(want)];
  const row = rows.find((r) => r.provider === want || r.provider === alias) || rows.find((r) => norm(nameOf(r.provider)) === norm(want)) || rows.find((r) => norm(nameOf(r.provider)).includes(norm(want)) || norm(r.account_label).includes(norm(want)));
  if (!row || !on(row)) return { connected: false, message: `${nameOf(alias || want)} is not connected. The founder connects it under Connections.`, connected_now: rows.filter(on).map((r) => r.provider) };
  if (YT.includes(row.provider)) return youtube(ctx, { channel: row.provider, refresh: a.refresh, limit: 25 });
  if (a.refresh) await refresh(ctx, row, true);
  return { connected: true, ...head(row), recent: (((row.meta || {}).feed || {}).items || []).slice(0, 25).map((i) => ({ title: i.t, detail: i.s || null, at: i.at || null, url: i.url || null })), data: detail(row) };
}

/* ---------- HighLevel, read only ---------- */
const WHAT = ['overview', 'contacts', 'contact', 'pipelines', 'opportunities', 'payments', 'orders', 'subscriptions', 'appointments', 'calendars', 'products', 'funnels', 'forms', 'form_submissions', 'surveys', 'tags', 'custom_values', 'workflows', 'email_templates', 'social_posts', 'users', 'location'];
const person = (x) => clip(x.contactName || [x.firstName, x.lastName].filter(Boolean).join(' ') || x.name || x.email || '', 80) || 'Unknown';
const contactOut = (x) => ({ id: x.id, name: person(x), email: x.email || null, phone: x.phone || null, company: x.companyName || x.businessName || null, tags: (x.tags || []).slice(0, 20), source: clip(x.source, 80) || null, country: x.country || null, added: x.dateAdded ? day(x.dateAdded) : null, last_activity: x.lastActivity ? day(x.lastActivity) : null });
const money = (rows, ok) => { const t = {}; rows.filter(ok).forEach((r) => { const c = String(r.currency || '').toUpperCase() || 'USD'; t[c] = round2((t[c] || 0) + (+r.amount || 0)); }); return t; };
const top = (rows, key, n = 8) => { const m = {}; rows.forEach((r) => { const k = clip(key(r), 80) || 'Other'; const c = String(r.currency || '').toUpperCase() || 'USD'; m[k] = m[k] || { name: k, count: 0, amount: 0, currency: c }; m[k].count++; m[k].amount = round2(m[k].amount + (+r.amount || 0)); }); return Object.values(m).sort((x, y) => y.amount - x.amount || y.count - x.count).slice(0, n); };
const PAID = /^(succeeded|paid|completed|success)$/i;

async function hlCreds(ctx) { if (ctx.hl === null || ctx.hl === undefined) { try { ctx.hl = await require('./inbox.js')._hlCreds(ctx.jwt, ctx.ws); } catch { ctx.hl = false; } } return ctx.hl || null; }
// Every page of a paged list, up to a cap, so totals are real totals.
async function pages(c, path, pick, { cap = 500, size = 100 } = {}) {
  const out = []; let total = null;
  for (let offset = 0; offset < cap; offset += size) {
    const j = await HLC.call(c, `${path}&limit=${size}&offset=${offset}`); const rows = pick(j) || []; out.push(...rows);
    total = j.totalCount != null ? j.totalCount : total; if (rows.length < size) break;
  }
  return { rows: out, total: total == null ? out.length : total, capped: total != null && total > out.length };
}
async function pipelines(c, L) { const j = await HLC.call(c, `/opportunities/pipelines?locationId=${L}`); return (j.pipelines || []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s) => ({ id: s.id, name: s.name })) })); }

async function highlevel(ctx, a) {
  const c = await hlCreds(ctx); if (!c) return { connected: false, message: 'HighLevel is not connected. The founder connects it under Connections.' };
  const what = String(a.what || 'overview').toLowerCase().replace(/[\s-]+/g, '_');
  if (/conversation|message|inbox|sms|chat|email_thread/.test(what)) return { error: 'Conversations and messages are never read here.' };
  if (!WHAT.includes(what)) return { error: 'Unknown lookup. Use one of: ' + WHAT.join(', ') + '.' };
  const L = q(c.location_id); const limit = int(a.limit, 1, 100, 25); const days = int(a.days, 1, 730, 30); const now = Date.now(); const find = String(a.query || '').trim();
  if (what === 'overview') {
    const b = await require('./inbox.js')._briefFor(c); const pl = await pipelines(c, L).catch(() => []);
    return { connected: true, location: c.location_name || null, new_leads: b.leads || null, calls_next_7_days: b.calls || [], open_deals: b.deals || null, pipelines: pl.map((p) => ({ name: p.name, stages: p.stages.map((s) => s.name) })), could_not_read: b.errors || [], next: 'Use what = contacts, opportunities, payments, subscriptions, orders or appointments for the records.' };
  }
  if (what === 'contacts') {
    const body = { locationId: c.location_id, pageLimit: limit, page: 1, sort: [{ field: 'dateAdded', direction: 'desc' }] };
    if (find) body.query = find;
    const f = []; if (a.tag) f.push({ field: 'tags', operator: 'contains', value: String(a.tag).toLowerCase() });
    if (a.added_within_days) f.push({ field: 'dateAdded', operator: 'range', value: { gte: new Date(now - int(a.added_within_days, 1, 3650, 30) * DAY).toISOString(), lte: new Date(now).toISOString() } });
    if (f.length) body.filters = f;
    const j = await HLC.call(c, '/contacts/search', { method: 'POST', body });
    return { total_matching: j.total == null ? null : j.total, shown: (j.contacts || []).length, newest_first: true, contacts: (j.contacts || []).map(contactOut) };
  }
  if (what === 'contact') {
    let id = /^[A-Za-z0-9]{12,40}$/.test(String(a.id || '')) ? String(a.id) : null;
    if (!id) { const key = String(a.email || find || '').trim(); if (!key) return { error: 'Pass id, email or query for the person.' }; const j = await HLC.call(c, '/contacts/search', { method: 'POST', body: { locationId: c.location_id, pageLimit: 5, page: 1, query: key } }); const hit = (j.contacts || [])[0]; if (!hit) return { found: false, message: 'No contact matches ' + clip(key, 80) + '.' }; id = hit.id; }
    const [one, opps] = await Promise.all([HLC.call(c, `/contacts/${q(id)}`), HLC.call(c, `/opportunities/search?location_id=${L}&contact_id=${q(id)}&limit=20`).catch(() => ({ opportunities: [] }))]);
    const x = one.contact || one; const pl = await pipelines(c, L).catch(() => []); const st = {}; pl.forEach((p) => p.stages.forEach((s) => { st[s.id] = [p.name, s.name]; }));
    return { found: true, contact: { ...contactOut(x), city: x.city || null, website: x.website || null, timezone: x.timezone || null, do_not_disturb: !!x.dnd, first_source: clip((x.attributionSource || {}).sessionSource || (x.attributionSource || {}).medium, 80) || null },
      deals: (opps.opportunities || []).map((o) => ({ name: clip(o.name, 100), value: o.monetaryValue || 0, status: o.status, pipeline: (st[o.pipelineStageId] || [])[0] || null, stage: (st[o.pipelineStageId] || [])[1] || null, updated: o.updatedAt ? day(o.updatedAt) : null })) };
  }
  if (what === 'pipelines') return { pipelines: await pipelines(c, L) };
  if (what === 'opportunities') {
    const pl = await pipelines(c, L); const names = {}; pl.forEach((p) => p.stages.forEach((s) => { names[s.id] = [p.name, s.name]; }));
    const pw = String(a.pipeline || '').toLowerCase().trim(); const p = pw ? pl.find((x) => x.id === a.pipeline || x.name.toLowerCase() === pw) || pl.find((x) => x.name.toLowerCase().includes(pw)) : null;
    if (pw && !p) return { error: 'No pipeline matches that.', pipelines: pl.map((x) => x.name) };
    const sw = String(a.stage || '').toLowerCase().trim(); const s = sw && p ? p.stages.find((x) => x.id === a.stage || x.name.toLowerCase() === sw) || p.stages.find((x) => x.name.toLowerCase().includes(sw)) : null;
    const status = ['open', 'won', 'lost', 'abandoned', 'all'].includes(a.status) ? a.status : 'open';
    const qs = `/opportunities/search?location_id=${L}&limit=${limit}&order=updated_at_desc${status === 'all' ? '' : '&status=' + status}${p ? '&pipeline_id=' + q(p.id) : ''}${s ? '&pipeline_stage_id=' + q(s.id) : ''}${find ? '&q=' + q(find) : ''}`;
    const j = await HLC.call(c, qs); const rows = j.opportunities || [];
    const by = {}; rows.forEach((o) => { const k = (names[o.pipelineStageId] || ['', 'Unknown stage']).join(' / '); by[k] = by[k] || { stage: k, deals: 0, value: 0 }; by[k].deals++; by[k].value = round2(by[k].value + (+o.monetaryValue || 0)); });
    return { status, pipeline: p ? p.name : 'all pipelines', total_matching: (j.meta && j.meta.total) != null ? j.meta.total : rows.length, shown: rows.length, value_shown: round2(rows.reduce((t, o) => t + (+o.monetaryValue || 0), 0)), by_stage_shown: Object.values(by),
      deals: rows.map((o) => ({ id: o.id, name: clip(o.name || (o.contact && o.contact.name), 100), contact: o.contact ? clip(o.contact.name || o.contact.email, 80) : null, email: (o.contact && o.contact.email) || null, value: o.monetaryValue || 0, status: o.status, pipeline: (names[o.pipelineStageId] || [])[0] || null, stage: (names[o.pipelineStageId] || [])[1] || null, source: clip(o.source, 60) || null, created: o.createdAt ? day(o.createdAt) : null, last_stage_change: o.lastStageChangeAt ? day(o.lastStageChangeAt) : null })),
      note: 'Sorted by latest update. For the whole board in stage order use crm_board.' };
  }
  if (what === 'payments' || what === 'orders') {
    const path = what === 'payments' ? '/payments/transactions' : '/payments/orders';
    const span = `&startAt=${day(now - days * DAY)}&endAt=${day(now + DAY)}`;
    const cur = await pages(c, `${path}?altId=${L}&altType=location${span}${find ? '&search=' + q(find) : ''}`, (j) => j.data, { cap: 1000 });
    const live = cur.rows.filter((r) => r.liveMode !== false); const ok = (r) => PAID.test(what === 'payments' ? r.status : r.paymentStatus || r.status);
    const prev = find ? null : await pages(c, `${path}?altId=${L}&altType=location&startAt=${day(now - 2 * days * DAY)}&endAt=${day(now - days * DAY)}`, (j) => j.data, { cap: 1000 }).catch(() => null);
    const src = (r) => r.entitySourceName || r.sourceName || r.entitySourceType || r.sourceType;
    return { days, from: day(now - days * DAY), count: live.length, paid_count: live.filter(ok).length, paid_total_by_currency: money(live, ok), refunded_by_currency: what === 'payments' ? money(live.map((r) => ({ ...r, amount: r.amountRefunded || 0 })), (r) => r.amount > 0) : undefined,
      previous_period_paid_by_currency: prev ? money(prev.rows.filter((r) => r.liveMode !== false), ok) : undefined, by_status: live.reduce((m, r) => { const k = (what === 'payments' ? r.status : r.paymentStatus || r.status) || 'unknown'; m[k] = (m[k] || 0) + 1; return m; }, {}),
      top_sources: top(live.filter(ok), src), ...(cur.capped ? { note: `Totals cover the latest ${cur.rows.length} of ${cur.total} records. Use fewer days for exact totals.` } : {}),
      latest: live.slice(0, limit).map((r) => ({ date: r.createdAt ? day(r.createdAt) : null, who: clip(r.contactName, 80) || null, email: r.contactEmail || null, amount: r.amount, currency: String(r.currency || '').toUpperCase(), status: what === 'payments' ? r.status : r.paymentStatus || r.status, for: clip(src(r), 100) || null, ...(what === 'payments' && r.subscriptionId ? { subscription: true } : {}) })) };
  }
  if (what === 'subscriptions') {
    const all = await pages(c, `/payments/subscriptions?altId=${L}&altType=location${find ? '&search=' + q(find) : ''}`, (j) => j.data, { cap: 1000 });
    const live = all.rows.filter((r) => r.liveMode !== false); const active = live.filter((r) => /^(active|trialing)$/i.test(r.status));
    return { count: live.length, by_status: live.reduce((m, r) => { m[r.status || 'unknown'] = (m[r.status || 'unknown'] || 0) + 1; return m; }, {}), active_count: active.length, active_recurring_by_currency: money(active, () => true), by_product_active: top(active, (r) => r.entitySourceName || (r.recurringProduct && r.recurringProduct.name)),
      ...(all.capped ? { note: `Covers ${all.rows.length} of ${all.total} subscriptions.` } : {}), note_amounts: 'Amounts are per billing period as stored in HighLevel, not normalised to monthly.',
      latest: live.slice(0, limit).map((r) => ({ who: clip(r.contactName, 80) || null, email: r.contactEmail || null, amount: r.amount, currency: String(r.currency || '').toUpperCase(), status: r.status, product: clip(r.entitySourceName || (r.recurringProduct && r.recurringProduct.name), 100) || null, started: r.subscriptionStartDate ? day(r.subscriptionStartDate) : r.createdAt ? day(r.createdAt) : null, trial_ends: r.trialEndDate ? day(r.trialEndDate) : undefined })) };
  }
  if (what === 'calendars' || what === 'appointments') {
    const cals = ((await HLC.call(c, `/calendars/?locationId=${L}`, { version: '2021-04-15' })).calendars || []).filter((x) => x.isActive !== false);
    if (what === 'calendars') return { calendars: cals.map((x) => ({ id: x.id, name: x.name, type: x.calendarType || x.eventType || null, slot_minutes: x.slotDuration || null })) };
    const back = int(a.days_back, 0, 365, 0), ahead = int(a.days_ahead == null ? (back ? 0 : 14) : a.days_ahead, 0, 180, 14);
    const evs = (await Promise.all(cals.slice(0, 25).map((cal) => HLC.call(c, `/calendars/events?locationId=${L}&calendarId=${q(cal.id)}&startTime=${now - back * DAY - 2 * 3600e3}&endTime=${now + ahead * DAY}`, { version: '2021-04-15' }).then((r) => (r.events || []).map((e) => ({ ...e, cal: cal.name }))).catch(() => [])))).flat();
    evs.sort((x, y) => Date.parse(x.startTime) - Date.parse(y.startTime));
    return { from: day(now - back * DAY), to: day(now + ahead * DAY), count: evs.length, by_status: evs.reduce((m, e) => { const k = e.appointmentStatus || 'unknown'; m[k] = (m[k] || 0) + 1; return m; }, {}),
      appointments: evs.slice(0, limit).map((e) => ({ title: clip(e.title, 120) || 'Appointment', start: e.startTime, end: e.endTime, calendar: clip(e.cal, 80), status: e.appointmentStatus || null, contact_id: e.contactId || null })) };
  }
  if (what === 'products') {
    const j = await HLC.call(c, `/products/?locationId=${L}&limit=${Math.min(limit, 50)}${find ? '&search=' + q(find) : ''}`); const list = j.products || [];
    const prices = await Promise.all(list.slice(0, 20).map((p) => HLC.call(c, `/products/${q(p._id)}/price?locationId=${L}&limit=10`).then((r) => (r.prices || []).map((x) => ({ name: clip(x.name, 80), amount: x.amount, currency: x.currency, type: x.type, every: x.recurring ? `${x.recurring.intervalCount || 1} ${x.recurring.interval}` : null }))).catch(() => null)));
    return { total: ((j.total || [])[0] || {}).total != null ? j.total[0].total : list.length, products: list.map((p, i) => ({ id: p._id, name: clip(p.name, 120), type: p.productType || null, in_store: !!p.availableInStore, description: clip(String(p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), 200) || null, updated: p.updatedAt ? day(p.updatedAt) : null, prices: prices[i] || undefined })) };
  }
  if (what === 'funnels') { const j = await HLC.call(c, `/funnels/funnel/list?locationId=${L}&limit=${limit}${find ? '&name=' + q(find) : ''}`); return { total: j.count == null ? null : j.count, funnels: (j.funnels || []).map((f) => ({ id: f._id, name: clip(f.name, 120), type: f.type || null, steps: (f.steps || []).map((s) => clip(s.name, 80)).filter(Boolean), url: f.url || null, updated: f.dateUpdated || f.updatedAt ? day(f.dateUpdated || f.updatedAt) : null })) }; }
  if (what === 'forms' || what === 'surveys') { const j = await HLC.call(c, `/${what}/?locationId=${L}&limit=${Math.min(limit, 50)}`); return { total: j.total == null ? null : j.total, [what]: (j[what] || []).map((f) => ({ id: f.id, name: clip(f.name, 120) })) }; }
  if (what === 'form_submissions') {
    const j = await HLC.call(c, `/forms/submissions?locationId=${L}&limit=${Math.min(limit, 100)}${a.id ? '&formId=' + q(a.id) : ''}${find ? '&q=' + q(find) : ''}&startAt=${day(now - days * DAY)}&endAt=${day(now + DAY)}`);
    return { days, total: (j.meta && j.meta.total) != null ? j.meta.total : (j.submissions || []).length, submissions: (j.submissions || []).map((s) => ({ form_id: s.formId, name: clip(s.name, 80) || null, email: s.email || null, at: s.createdAt ? day(s.createdAt) : null, answers: shrink(Object.fromEntries(Object.entries(s.others || {}).filter(([k, v]) => v != null && v !== '' && typeof v !== 'object' && !/^(eventData|sessionId|fieldsOriInput|signatureHash|ip|timeSpent|formId|location_id|disclaimer|submissionId|submissionCurrency|Timezone)$/i.test(k)).slice(0, 15)), { str: 200 }) })) };
  }
  if (what === 'tags') { const j = await HLC.call(c, `/locations/${L}/tags`); const t = (j.tags || []).map((x) => x.name).filter((n) => !find || n.toLowerCase().includes(find.toLowerCase())); return { total: t.length, tags: t.slice(0, 300) }; }
  if (what === 'custom_values') { const j = await HLC.call(c, `/locations/${L}/customValues`); return { custom_values: (j.customValues || []).slice(0, 100).map((x) => ({ name: x.name, key: x.fieldKey, value: clip(x.value, 300) })) }; }
  if (what === 'workflows') { const j = await HLC.call(c, `/workflows/?locationId=${L}`); const w = (j.workflows || []).filter((x) => !find || String(x.name || '').toLowerCase().includes(find.toLowerCase())); return { total: w.length, by_status: w.reduce((m, x) => { m[x.status || 'unknown'] = (m[x.status || 'unknown'] || 0) + 1; return m; }, {}), workflows: w.sort((x, y) => Date.parse(y.updatedAt || 0) - Date.parse(x.updatedAt || 0)).slice(0, limit).map((x) => ({ id: x.id, name: clip(x.name, 120), status: x.status, updated: x.updatedAt ? day(x.updatedAt) : null })), note: 'Names and status only. Workflow steps are not available through the HighLevel API.' }; }
  if (what === 'email_templates') { const j = await HLC.call(c, `/emails/builder?locationId=${L}&limit=${Math.min(limit, 50)}${find ? '&name=' + q(find) : ''}`); return { total: ((j.total || [])[0] || {}).total != null ? j.total[0].total : (j.builders || []).length, templates: (j.builders || []).map((t) => ({ id: t.id, name: clip(t.name, 120), updated: t.lastUpdated ? day(t.lastUpdated) : null, type: t.templateType || null })) }; }
  if (what === 'social_posts') {
    const j = await HLC.call(c, `/social-media-posting/${L}/posts/list`, { method: 'POST', body: { skip: '0', limit: String(Math.min(limit, 50)), fromDate: new Date(now - days * DAY).toISOString(), toDate: new Date(now + 60 * DAY).toISOString(), includeUsers: 'false' } });
    const r = (j.results || {}); return { days, total: r.count == null ? null : r.count, posts: (r.posts || []).map((p) => ({ status: p.status, platform: p.platform || null, text: clip(p.summary || p.caption || '', 240), scheduled: p.scheduleDate || p.displayDate || null, published: p.publishedAt || null })) };
  }
  if (what === 'users') { const j = await HLC.call(c, `/users/?locationId=${L}`); return { users: (j.users || []).filter((u) => !u.deleted).map((u) => ({ id: u.id, name: u.name, email: u.email, role: (u.roles && u.roles.role) || null })) }; }
  const j = await HLC.call(c, `/locations/${L}`); const l = j.location || j; const b = l.business || {};
  return { location: { name: l.name, business: b.name || null, website: l.website || b.website || null, email: l.email || b.email || null, country: l.country || null, city: l.city || null, timezone: l.timezone || null, currency: l.currency || null, domain: l.domain || null, social: shrink(l.social) } };
}

/* ---------- what is connected, for the agent's instructions ---------- */
const HOW = { youtube: 'youtube_data', 'youtube-2': 'youtube_data', highlevel: 'highlevel_data, crm_board, get_revenue', instagram: 'connection_data', gcal: 'connection_data', zoom: 'get_recordings, search_everything, connection_data', tella: 'connection_data', affiliate: 'connection_data, get_revenue', stripe: 'get_revenue, connection_data', paypal: 'get_revenue, connection_data', apify: 'get_creator_content, get_research' };
async function connectedBlock(ctx) {
  const rows = (await conns(ctx)).filter(on); if (!rows.length) return 'CONNECTED RIGHT NOW\nNothing is connected yet. When the founder asks about channel, CRM or revenue numbers, say which connection is missing and that they add it under Connections.';
  const quiet = /^(claude|openai|openrouter|elevenlabs|grok-bot|hl-webhooks|email-digest)$/;
  const lines = rows.filter((r) => !quiet.test(r.provider)).map((r) => `- ${nameOf(r.provider)}${r.account_label ? ' (' + clip(r.account_label, 60) + ')' : ''}${r.status === 'error' ? ', needs a fix' : ''}: read with ${HOW[r.provider] || 'connection_data'}`);
  const missing = ['youtube', 'highlevel', 'instagram', 'gcal', 'zoom', 'stripe'].filter((p) => !rows.some((r) => r.provider === p)).map(nameOf);
  return `CONNECTED RIGHT NOW\n${lines.join('\n')}${missing.length ? '\nNot connected: ' + missing.join(', ') + '.' : ''}\nThese are live accounts you can read this minute. When a question touches them, read the data first and answer with the real numbers. Never say you cannot access something that is listed here.`;
}

const obj = (props = {}, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const TOOLS = [
  { name: 'youtube_data', description: 'The founder\u2019s own YouTube channels (main and second channel when connected): subscribers, total views, the latest 25 uploads with views, likes, comments, length and how each compares with the channel median, plus 28 day watch time and subscriber growth when the channel is signed in with Google. Refreshes itself when the numbers are more than a few hours old.',
    input: obj({ channel: { type: 'string', maxLength: 80, description: 'main, second, both, or part of a channel name. Default both.' }, sort: { type: 'string', enum: ['recent', 'views', 'outliers', 'comments', 'likes'] }, search: { type: 'string', maxLength: 80, description: 'Only videos whose title contains this' }, limit: { type: 'integer', minimum: 1, maximum: 25 }, refresh: { type: 'boolean', description: 'Read fresh numbers from YouTube first' } }),
    label: (a) => 'Read YouTube' + (a.channel && !/^(both|all)$/i.test(a.channel) ? ' (' + clip(a.channel, 30) + ')' : '') },
  { name: 'connection_data', description: 'Everything one connected account has synced into Founders AI OS: Instagram (profile, reach, audience, recent posts), Google Calendar (events), Zoom (recordings, upcoming), Tella (videos), affiliate exports (referrals, trials, customers, commissions by month and plan), Stripe, PayPal, Google Analytics and any other connection. Without source it lists every connection with its headline numbers.',
    input: obj({ source: { type: 'string', maxLength: 60, description: 'For example instagram, gcal, zoom, tella, affiliate, stripe, ga4' }, refresh: { type: 'boolean', description: 'Sync this connection first' } }),
    label: (a) => (a.source ? 'Read ' + nameOf(String(a.source).toLowerCase()) : 'Checked connections') },
  { name: 'highlevel_data', description: 'Read live records from the founder\u2019s HighLevel account. what = overview (new leads, calls this week, open deals, pipelines), contacts (search by name, email, phone or tag, newest first), contact (one person with their deals), pipelines, opportunities (filter by pipeline, stage, status, text), payments (transactions with paid totals, comparison with the period before and top products), orders, subscriptions (active count and recurring amounts), appointments, calendars, products (with prices), funnels, forms, form_submissions, surveys, tags, custom_values, workflows, email_templates, social_posts, users, location. Read only. Conversations and messages are never available.',
    input: obj({ what: { type: 'string', enum: WHAT }, query: { type: 'string', maxLength: 120, description: 'Name, email, phone or text to search for' }, tag: { type: 'string', maxLength: 80, description: 'contacts: only people with this tag' }, added_within_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'contacts: only people added in the last N days' },
      id: { type: 'string', maxLength: 40, description: 'contact: the contact id. form_submissions: a form id' }, email: { type: 'string', maxLength: 160 }, pipeline: { type: 'string', maxLength: 80, description: 'opportunities: pipeline name or id' }, stage: { type: 'string', maxLength: 80, description: 'opportunities: stage name, with pipeline' }, status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned', 'all'] },
      days: { type: 'integer', minimum: 1, maximum: 730, description: 'payments, orders, form_submissions, social_posts: look back this many days. Default 30.' }, days_back: { type: 'integer', minimum: 0, maximum: 365, description: 'appointments: include this many past days' }, days_ahead: { type: 'integer', minimum: 0, maximum: 180, description: 'appointments: include this many coming days. Default 14.' }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, ['what']),
    label: (a) => 'Read HighLevel ' + String(a.what || 'overview').replace(/_/g, ' ') + (a.query ? ': ' + clip(a.query, 40) : '') },
];
async function run(ctx, name, a) {
  if (name === 'youtube_data') return youtube(ctx, a);
  if (name === 'connection_data') return connection(ctx, a);
  if (name === 'highlevel_data') return highlevel(ctx, a);
  return { error: 'Unknown tool' };
}

module.exports = { TOOLS, run, connectedBlock, conns, WHAT, _shrink: shrink, _highlevel: highlevel, _youtube: youtube, _connection: connection };

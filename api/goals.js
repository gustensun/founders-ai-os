// Founders AI OS goal tracker. Every goal names an area (channel, offer, funnel, stream, brand, business or an OS
// feature) and a measure. This reads the matching source, writes the current value and one history point a day.
// Sources: YouTube, Instagram, TikTok, LinkedIn and X from their last sync; HighLevel payments, subscriptions,
// contacts and calendars; and the OS itself (drafts, promises, recordings, Brain, research, chat).
// The app calls it when Goals opens; the daily job calls it for every workspace after the morning sync.
const { sb, rpc, open, bad, clip, q } = require('./_lib');

const HL = 'https://services.leadconnectorhq.com';
const DAY = 864e5;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const like = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

async function hl(c, p, version = '2021-07-28') {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(HL + p, { headers: { Authorization: 'Bearer ' + c.token, Version: version, Accept: 'application/json' }, signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = bad(r.status === 401 ? 'HighLevel did not accept the token' : r.status === 403 ? 'The HighLevel token is missing a scope for ' + p.split('?')[0] : 'HighLevel ' + r.status, r.status); throw e; }
    return j || {};
  } finally { clearTimeout(t); }
}

/* ---------- HighLevel, read once per run and only when a goal needs it ---------- */
function hlReader(creds) {
  const memo = {};
  const once = (k, fn) => (memo[k] = memo[k] || fn().catch((e) => ({ __err: clip(e.message, 160) })));
  const L = () => q(creds.location_id);
  return {
    tx: () => once('tx', async () => {
      const now = new Date(); const start = new Date(Date.now() - 62 * DAY);
      const base = `/payments/transactions?altId=${L()}&altType=location&startAt=${start.toISOString()}&endAt=${now.toISOString()}&limit=500`;
      const first = await hl(creds, base + '&offset=0'); const total = Math.min(first.totalCount || 0, 3000); const all = [...(first.data || [])];
      for (let o = 500; o < total; o += 500) all.push(...((await hl(creds, base + '&offset=' + o)).data || []));
      const live = all.filter((x) => x && x.liveMode !== false);
      const cur = Object.entries(live.reduce((m, x) => ((m[(x.currency || 'usd').toUpperCase()] = (m[(x.currency || 'usd').toUpperCase()] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0];
      const currency = cur ? cur[0] : 'USD';
      return { currency, paid: live.filter((x) => x.status === 'succeeded' && (x.currency || 'usd').toUpperCase() === currency), refunded: live.filter((x) => /refund/.test(x.status || '')) };
    }),
    subs: () => once('subs', async () => { const j = await hl(creds, `/payments/subscriptions?altId=${L()}&altType=location&limit=100`); return (j.data || []).filter((x) => /active|trialing/i.test(x.status || '')); }),
    contacts: () => once('contacts', async () => {
      const out = []; let after = '', afterId = '', total = null;
      for (let i = 0; i < 10; i++) {
        const j = await hl(creds, `/contacts/?locationId=${L()}&limit=100${after ? '&startAfter=' + q(after) + '&startAfterId=' + q(afterId) : ''}`);
        if (total == null) total = (j.meta && j.meta.total) || null;
        const list = j.contacts || []; out.push(...list);
        const last = list[list.length - 1]; if (!last || list.length < 100 || Date.now() - Date.parse(last.dateAdded) > 31 * DAY) break;
        after = (j.meta && j.meta.startAfter) || ''; afterId = (j.meta && j.meta.startAfterId) || ''; if (!after) break;
      }
      return { total, recent: out.filter((x) => x.dateAdded && Date.now() - Date.parse(x.dateAdded) < 30 * DAY) };
    }),
    calls: () => once('calls', async () => {
      const cals = (await hl(creds, `/calendars/?locationId=${L()}`, '2021-04-15')).calendars || [];
      let n = 0; const s = Date.now() - 30 * DAY, e = Date.now();
      for (const c of cals.slice(0, 12)) { try { const j = await hl(creds, `/calendars/events?locationId=${L()}&calendarId=${q(c.id)}&startTime=${s}&endTime=${e}`, '2021-04-15'); n += (j.events || []).filter((x) => !/cancel|invalid|noshow/i.test(x.appointmentStatus || x.status || '')).length; } catch { /* one calendar can fail without stopping the rest */ } }
      return { n };
    }),
  };
}

/* ---------- one goal ---------- */
const within = (x, days) => Date.now() - Date.parse(x.createdAt) < days * DAY;
const sum = (l) => Math.round(l.reduce((s, x) => s + (+x.amount || 0), 0) * 100) / 100;
const txName = (x) => [x.entitySourceName, x.name, x.productName, x.description, (x.entitySourceMeta || {}).name].filter(Boolean).join(' ');

async function measure(g, cx) {
  const m = g.meta || {}; const area = m.area || 'business'; const metric = m.metric || 'custom'; const ref = m.ref || '';
  const conn = (id) => cx.conns.find((c) => c.provider === id && c.status === 'connected' && c.meta);
  const out = (v, source, extra) => (v == null || !Number.isFinite(+v) ? null : { v: Math.round(+v * 100) / 100, source, ...(extra || {}) });

  if (area === 'os') { const v = cx.os[metric]; return v == null ? null : out(v, 'Founders AI OS'); }

  if (area === 'channel') {
    if (ref === 'youtube' || ref === 'youtube-2') {
      const c = conn(ref); if (!c) return { need: ref }; const mm = c.meta; const ch = mm.channel || {}; const an = mm.analytics && !mm.analytics.error ? mm.analytics : null;
      if (metric === 'subs') return out(ch.subs, 'YouTube');
      if (metric === 'views') return out(ch.views, 'YouTube');
      if (metric === 'long-w') return out((mm.videos || []).filter((v) => v.at && Date.now() - Date.parse(v.at) < 7 * DAY).length, 'YouTube, last 7 days');
      if (metric === 'views-m') return an ? out(an.views, 'YouTube Analytics, last 28 days') : out((mm.videos || []).filter((v) => v.at && Date.now() - Date.parse(v.at) < 30 * DAY).reduce((s, v) => s + (v.views || 0), 0), 'YouTube, views on uploads from the last 30 days');
      if (metric === 'watch-m') return an ? out(Math.round(an.minutes / 60), 'YouTube Analytics, last 28 days') : { need: ref, why: 'Watch hours need Sign in with Google on the YouTube connection.' };
      return null;
    }
    if (['instagram', 'tiktok', 'linkedin', 'x'].includes(ref)) {
      const c = conn(ref); if (!c) return { need: ref }; const p = c.meta.profile || {};
      if (metric === 'followers') return out(p.followers, c.meta.__label || ref);
      return null;
    }
    if (ref === 'email' && (metric === 'subs' || metric === 'new-m')) {
      if (!cx.hl) return { need: 'highlevel' }; const r = await cx.hl.contacts(); if (r.__err) return { error: r.__err };
      return metric === 'subs' ? out(r.total, 'HighLevel contacts') : out(r.recent.filter((x) => x.email).length, 'HighLevel, new contacts with an email, last 30 days');
    }
    return null;
  }

  const needHL = ['offer', 'funnel', 'business', 'brand'].includes(area) || (area === 'stream');
  if (needHL && !cx.hl) return ['rev-m', 'sales-m', 'customers', 'mrr', 'leads-m', 'clients', 'calls-m', 'profit-m', 'email', 'refund'].includes(metric) ? { need: 'highlevel' } : null;

  if (area === 'offer' || area === 'funnel') {
    const item = cx.items.find((i) => i.id === ref) || null; const name = (item && item.name) || m.refName || '';
    if (!name) return null;
    const t = await cx.hl.tx(); if (t.__err) return { error: t.__err };
    const mine = (l) => l.filter((x) => area === 'funnel' ? ((item && item.ext_id && x.entitySourceId === item.ext_id) || (/funnel|website/i.test(x.entitySourceType || '') && like(x.entitySourceName, name))) : like(txName(x), name) || (item && item.ext_id && (x.entityId === item.ext_id || x.productId === item.ext_id)));
    const paid30 = mine(t.paid).filter((x) => within(x, 30));
    if (metric === 'sales-m') return out(paid30.length, `HighLevel payments matched to ${name}, last 30 days`);
    if (metric === 'rev-m') return out(sum(paid30), `HighLevel payments matched to ${name}, last 30 days`, { currency: t.currency });
    if (metric === 'customers') return out(new Set(mine(t.paid).map((x) => x.contactId || x.contactEmail)).size, `HighLevel, buyers of ${name} in the last 60 days`);
    if (metric === 'refund') { const r = mine(t.refunded).filter((x) => within(x, 30)).length; return out(paid30.length ? (r / paid30.length) * 100 : 0, `HighLevel refunds on ${name}, last 30 days`); }
    if (metric === 'mrr') { const s = await cx.hl.subs(); if (s.__err) return { error: s.__err }; const l = s.filter((x) => like(txName(x), name)); return out(l.reduce((a, x) => a + (+x.amount || +(x.recurringAmount || 0) || 0), 0), `HighLevel subscriptions for ${name}`, { currency: t.currency }); }
    if (metric === 'leads-m' && area === 'funnel') { const c = await cx.hl.contacts(); if (c.__err) return { error: c.__err }; return out(c.recent.filter((x) => like(x.source, name) || (item && item.url && JSON.stringify(x.attributionSource || {}).includes(String(item.url).replace(/^https?:\/\//, '').split('/')[0]))).length, `HighLevel contacts from ${name}, last 30 days`); }
    return null;
  }

  if (area === 'business' || area === 'brand' || area === 'stream') {
    if (metric === 'rev-m' && area !== 'stream') { const t = await cx.hl.tx(); if (t.__err) return { error: t.__err }; return out(sum(t.paid.filter((x) => within(x, 30))), 'HighLevel payments, last 30 days', { currency: t.currency }); }
    if (metric === 'clients') { const s = await cx.hl.subs(); if (s.__err) return { error: s.__err }; return out(new Set(s.map((x) => x.contactId)).size, 'HighLevel, contacts with an active subscription'); }
    if (metric === 'calls-m') { const c = await cx.hl.calls(); if (c.__err) return { error: c.__err }; return out(c.n, 'HighLevel calendars, last 30 days'); }
    if (metric === 'email') { const c = await cx.hl.contacts(); if (c.__err) return { error: c.__err }; return out(c.total, 'HighLevel contacts'); }
    if (metric === 'audience') {
      let n = 0; const from = [];
      ['youtube', 'youtube-2'].forEach((id) => { const c = conn(id); if (c && c.meta.channel) { n += c.meta.channel.subs || 0; from.push('YouTube'); } });
      ['instagram', 'tiktok', 'linkedin', 'x'].forEach((id) => { const c = conn(id); if (c && c.meta.profile && c.meta.profile.followers) { n += c.meta.profile.followers; from.push(id === 'x' ? 'X' : id[0].toUpperCase() + id.slice(1)); } });
      const c = await cx.hl.contacts(); if (!c.__err && c.total) { n += c.total; from.push('HighLevel contacts'); }
      return from.length ? out(n, [...new Set(from)].join(', ')) : { need: 'youtube' };
    }
    return null;
  }
  return null;
}

/* ---------- a whole workspace ---------- */
async function trackAll(inputs, creds, save) {
  const cx = { conns: inputs.conns || [], items: inputs.items || [], os: inputs.os || {}, hl: creds && creds.token && creds.location_id ? hlReader(creds) : null };
  const today = isoDay(Date.now()); const results = [];
  for (let g of inputs.goals || []) {
    const m = { ...(g.meta || {}) };
    // An older goal with no area: a YouTube subscriber goal becomes a YouTube channel goal.
    if (!m.area && /youtube|\byt\b/i.test(g.text || '') && /sub/i.test((g.text || '') + ' ' + (m.unit || ''))) Object.assign(m, { area: 'channel', ref: 'youtube', metric: 'subs', unit: 'subscribers', kind: 'total', named: true, start: Number.isFinite(+m.start) ? +m.start : (Number.isFinite(+m.current) ? +m.current : 0) });
    g = { ...g, meta: m };
    let r = null; try { r = await measure(g, cx); } catch (e) { r = { error: clip(e.message, 160) }; }
    const was = JSON.stringify(g.meta === m ? (inputs.goals.find((x) => x.id === g.id) || {}).meta : m);
    if (r && r.v != null) {
      m.current = r.v; m.tracked = true; m.source = r.source; m.tracked_at = new Date().toISOString(); delete m.track_error; delete m.needs;
      if (r.currency) m.currency = r.currency;
      const h = Array.isArray(m.history) ? m.history.filter((x) => x && x.d !== today) : []; h.push({ d: today, v: r.v }); m.history = h.slice(-180);
    } else if (r && r.need) { m.tracked = false; m.needs = r.need; m.needs_why = r.why || null; delete m.track_error; }
    else if (r && r.error) { m.track_error = r.error; m.tracked_at_try = new Date().toISOString(); }
    else { m.tracked = false; delete m.needs; delete m.track_error; }
    if (JSON.stringify(m) !== was) { await save(g.id, m); }
    results.push({ id: g.id, meta: m });
  }
  return results;
}

/* ---------- shape: a goal in the founder's own words becomes a measure and a checklist ---------- */
// The founder types a goal into one of six categories. Claude (or OpenAI) reads it with Brand DNA and every
// goal and correction they made before, so words like "stack" or "freedom" mean what this founder means.
const CAT_SYS = 'You help one founder set goals inside Founders AI OS, which sits on top of HighLevel. Read the goal the founder typed and say what they mean by it in their own terms, then break it into the concrete milestones that get them there. Use their Brand DNA, offers, funnels and earlier goals. When earlier goals carry a meaning the founder corrected, follow that meaning. Steps are milestones they can tick off when they hit them, not advice. Each step is one short line, starts with a verb or a number, names their real offers, funnels or channels when it fits, and has no em dashes, emojis, exclamation points or hype. Return JSON only.';
async function shape(jwt, ws, b) {
  const B = require('./brain.js');
  const text = clip(b.text, 500); if (!text) throw bad('Type the goal first');
  const cat = clip(b.cat, 40), label = clip(b.label, 60), about = clip(b.about, 160);
  const known = (Array.isArray(b.known) ? b.known : []).slice(0, 12).map((k) => ({ id: clip(k.id, 30), label: clip(k.label, 60), unit: clip(k.unit, 20) }));
  const keys = await B._aiKeys(jwt, ws);
  if (!(keys.claude || keys.openai || keys.perplexity)) throw bad('Connect Claude, OpenAI or Perplexity in Connections so Jarvis can read your goals.', 409);
  const [dna, goals] = await Promise.all([
    B._dnaBody(jwt, ws),
    sb(jwt, `/rest/v1/memory_items?workspace_id=eq.${ws}&kind=eq.goal&status=neq.archived&select=text,due,meta&order=created_at.desc&limit=40`).catch(() => []),
  ]);
  const past = (goals || []).map((g) => { const m = g.meta || {}; return `- [${m.cat || m.area || 'goal'}] ${clip(g.text, 160)}${m.meaning ? ' | means: ' + clip(m.meaning, 240) + (m.taught ? ' (the founder wrote this meaning)' : '') : ''}${Array.isArray(m.steps) && m.steps.length ? ' | steps: ' + m.steps.slice(0, 8).map((x) => clip(x.t, 80)).join('; ') : ''}`; }).join('\n');
  const goal = b.goal && typeof b.goal === 'object' ? b.goal : null;
  const today = new Date().toISOString().slice(0, 10);
  const user = `Today is ${today}.\nCategory: ${label} (${about}).\n\nBrand DNA:\n${clip(typeof dna === 'string' ? dna : JSON.stringify(dna), 9000) || '(not built yet)'}\n\nEarlier goals:\n${past || '(none yet)'}\n\n` +
    (goal ? `The founder already has this goal: "${clip(goal.title, 200)}". Meaning: ${clip(goal.meaning, 400) || 'not set'}. Steps so far: ${(goal.steps || []).slice(0, 20).map((x) => clip(x, 100)).join('; ') || 'none'}.\nSuggest 3 to 5 more steps that are missing, in order. Return {"steps": ["..."]}.`
      : `The founder typed: "${text}"\n\nMeasures the OS can track by itself in this category: ${known.length ? known.map((k) => `${k.id} = ${k.label} (${k.unit})`).join(', ') : 'none'}.\nReturn JSON with these keys:\n{"title": short goal name in their words, under 70 characters,\n "meaning": one or two sentences on what this goal means for this founder and what counts as hitting it,\n "metric": one of the tracked ids above when the goal is about that number, "custom" when it is about another number, or "none" when it is a set of milestones,\n "label": what is counted when metric is custom (for example "Profit margin"), "unit": unit such as %, €, hours, weeks, "dir": "up" or "down",\n "target": number or null, "start": number they gave or null,\n "name": the offer or funnel name if the goal is about one, else null,\n "due": YYYY-MM-DD if they gave or implied a date, else null,\n "steps": 4 to 7 milestones in the order they will hit them}`);
  const r = await B._ai(keys, CAT_SYS, user, 1400);
  const j = r && (() => { const m = String(r.text || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } })();
  if (!j) throw bad('Jarvis could not read that goal. Try saying it another way.', 502);
  const steps = (Array.isArray(j.steps) ? j.steps : []).map((x) => clip(String(typeof x === 'string' ? x : x && x.t || '').replace(/\u2014/g, ',').replace(/^\s*(?:[-*\u2022]\s+|\d+[.)]\s+)/, ''), 160)).filter(Boolean).slice(0, 8);
  if (goal) return { steps, by: r.by };
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? null : +v);
  return {
    title: clip(String(j.title || text).replace(/\u2014/g, ','), 120), meaning: clip(String(j.meaning || '').replace(/\u2014/g, ','), 600),
    metric: known.some((k) => k.id === j.metric) ? j.metric : j.metric === 'custom' && num(j.target) != null ? 'custom' : 'steps',
    label: clip(j.label, 60), unit: clip(j.unit, 20), dir: j.dir === 'down' ? 'down' : 'up', target: num(j.target), start: num(j.start),
    name: j.name ? clip(j.name, 120) : null, due: /^\d{4}-\d{2}-\d{2}$/.test(j.due || '') && j.due >= today ? j.due : null, steps, by: r.by,
  };
}

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  const jwt = (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1];
  if (!jwt) return send(401, { error: 'Sign in first' });
  const ws = String(b.workspace_id || ''); if (!/^[0-9a-f-]{36}$/i.test(ws)) return send(400, { error: 'Missing workspace' });
  try {
    if (b.action === 'shape') return send(200, await shape(jwt, ws, b));
    if (b.action !== 'track') throw bad('Unknown action');
    const inputs = await rpc(jwt, 'goal_inputs', { p_ws: ws });
    let creds = null; if ((inputs.conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected')) { try { creds = JSON.parse(open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'highlevel' }), 'HighLevel')); } catch { creds = null; } }
    const goals = await trackAll(inputs, creds, (id, meta) => sb(jwt, `/rest/v1/memory_items?id=eq.${id}&workspace_id=eq.${ws}`, { method: 'PATCH', body: { meta, updated_at: new Date().toISOString() }, prefer: 'return=minimal' }));
    return send(200, { goals, at: new Date().toISOString() });
  } catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._trackAll = trackAll;
module.exports._shape = shape;
module.exports._hl = hlReader;

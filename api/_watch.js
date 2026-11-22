// Web watches: Perplexity Monitor runs a search or checks pages on a schedule, on the founder's own key.
// The OS keeps the list in the Perplexity connection's meta (no tables of its own) and, when the founder
// opens the Newsfeed or asks in AI Chat, turns new findings into ideas waiting for a yes or no.
const { bad, clip, q, open, sb, rpc, jf } = require('./_lib');

const API = 'https://api.perplexity.ai/v1/monitors';
const EVERY = { '6h': '6h', '1d': '1d', daily: '1d', '1w': '1w', weekly: '1w' };
const MAX_WATCHES = 10;
const FIX = 'Connect Perplexity in Connections to watch the web. One key covers it, each check costs a tenth of a cent.';

async function key(jwt, ws) {
  let raw; try { raw = open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'perplexity' })); } catch { throw bad(FIX, 409); }
  let v = raw; try { v = JSON.parse(raw); } catch { /* plain key */ }
  const k = (v && v.key) || (typeof v === 'string' ? v : null); if (!k) throw bad(FIX, 409);
  return k;
}
async function meta(jwt, ws) {
  const r = await sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${q(ws)}&provider=eq.perplexity&select=meta`).catch(() => []);
  return (r && r[0] && r[0].meta) || {};
}
const saveList = (jwt, ws, watches) => rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: 'perplexity', p_meta: { watches } });
const call = (k, path, opt = {}) => jf('Perplexity Monitor', API + path, { timeout: 20000, ...opt, headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' } });
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const okUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) && !/^(localhost|127\.|10\.|192\.168\.)/.test(x.hostname) && !x.username; } catch { return false; } };

async function list(jwt, ws) {
  const m = await meta(jwt, ws);
  return { watches: (Array.isArray(m.watches) ? m.watches : []).map(({ seen, ...w }) => w) };
}

async function create(jwt, ws, a = {}) {
  const k = await key(jwt, ws);
  const m = await meta(jwt, ws); const watches = Array.isArray(m.watches) ? m.watches : [];
  if (watches.length >= MAX_WATCHES) throw bad(`You already have ${MAX_WATCHES} web watches. Stop one in the Newsfeed first.`, 409);
  const urls = (Array.isArray(a.urls) ? a.urls : []).map((u) => String(u || '').trim()).filter(okUrl).slice(0, 10);
  const query = clip(a.query, 900);
  if (!urls.length && !query) throw bad('Say what to watch: a topic to search for, or the pages to check.');
  const every = EVERY[a.every] || '1d';
  const name = clip(a.name, 80) || clip(query, 80) || 'Pages: ' + urls.map(host).filter(Boolean).join(', ').slice(0, 70);
  const domains = (Array.isArray(a.domains) ? a.domains : []).map((d) => String(d || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()).filter(Boolean).slice(0, 20);
  const targets = urls.length ? urls.map((url) => ({ type: 'page', url }))
    : [{ type: 'search', query, max_results: 10, ...(domains.length ? { filters: { include_domains: domains } } : {}) }];
  const body = { name, targets, schedule: { type: 'interval', interval: every }, ...(a.goal ? { goal: clip(a.goal, 900) } : {}), metadata: { app: 'founders-os', ws } };
  const mon = await call(k, '', { method: 'POST', body: JSON.stringify(body) });
  const w = { id: mon.id, name, kind: urls.length ? 'pages' : 'search', query: query || null, urls: urls.length ? urls : null, goal: a.goal ? clip(a.goal, 300) : null, every, created_at: new Date().toISOString(), seen: [] };
  await saveList(jwt, ws, [...watches, w]);
  const { seen, ...out } = w; return { watch: out };
}

async function stop(jwt, ws, id) {
  const m = await meta(jwt, ws); const watches = Array.isArray(m.watches) ? m.watches : [];
  const w = watches.find((x) => x.id === id); if (!w) throw bad('That watch is not in this workspace. Open the Newsfeed to see your watches.', 404);
  try { const k = await key(jwt, ws); await call(k, '/' + encodeURIComponent(id), { method: 'DELETE' }); }
  catch (e) { if (!/404|not found/i.test(e.message || '')) throw e; }
  await saveList(jwt, ws, watches.filter((x) => x.id !== id));
  return { ok: true, stopped: w.name };
}

// New findings from finished runs become ideas in the Newsfeed. Each run is read once.
async function pull(jwt, ws, { limit = 12 } = {}) {
  const m = await meta(jwt, ws); const watches = Array.isArray(m.watches) ? m.watches : [];
  if (!watches.length) return { added: 0, watches: [] };
  const k = await key(jwt, ws);
  const rows = []; let changed = false; const status = [];
  for (const w of watches) {
    let runs = [];
    try { runs = ((await call(k, '/' + encodeURIComponent(w.id) + '/runs?limit=5')).data) || []; }
    catch (e) { status.push({ id: w.id, name: w.name, error: clip(e.message, 160) }); continue; }
    const seen = new Set(Array.isArray(w.seen) ? w.seen : []);
    for (const r of runs) {
      if (r.status !== 'succeeded' || seen.has(r.id)) continue;
      seen.add(r.id); changed = true;
      for (const c of (r.changes || []).slice(0, 6)) {
        if (rows.length >= limit) break;
        const url = c.url || null; const title = clip(c.title, 150) || (url ? host(url) : 'A change on a page you watch');
        const what = c.type === 'page_change' ? 'Changed on a page you watch' : 'New on the web';
        rows.push({ workspace_id: ws, title: clip(title, 180), stage: 'suggested', channel: 'linkedin', position: 0,
          meta: { idea_format: 'post', platform: 'linkedin', from: 'watch', watch_id: w.id, watch: w.name, source_url: url, published_at: c.published_at || null,
            body: `${clip(c.snippet || c.summary || c.diff || '', 700)}${url ? '\n\nSource: ' + url : ''}`,
            why: `${what} for your watch "${w.name}". Worth a post if it fits your audience.` } });
      }
    }
    w.seen = [...seen].slice(-30);
    status.push({ id: w.id, name: w.name, last: runs[0] ? runs[0].status : 'waiting for its first run' });
  }
  if (rows.length) await sb(jwt, '/rest/v1/content_items', { method: 'POST', body: rows, prefer: 'return=minimal' });
  if (changed) await saveList(jwt, ws, watches);
  return { added: rows.length, watches: status };
}

module.exports = { list, create, stop, pull, MAX_WATCHES };

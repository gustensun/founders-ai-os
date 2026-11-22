// HighLevel's own MCP server behind the AI Team, read only.
// Only lookups on contacts, opportunities, calendars, payments and the location are allowed.
// Conversation and message tools are blocked by name, and anything that creates, changes or sends is refused.
const { HL } = require('./_hl');

const URL_MCP = HL + '/mcp/';
const AREA = /^(contacts|opportunities|calendars|payments|locations)[_-]/i;
const READ = /(get|list|search|find)/i;
const BLOCK = /(conversation|message|email|sms|send|create|update|upsert|delete|remove|add|cancel|book|tag|note|task|post|publish|write|refund|void)/i;
const allowed = (name) => { const n = String(name || ''); return AREA.test(n) && READ.test(n) && !BLOCK.test(n.replace(/^[a-z]+[_-]/i, '')) && !/conversation|message/i.test(n); };

function parse(text) {
  const t = String(text || '').trim(); if (!t) return null;
  if (t[0] === '{' || t[0] === '[') { try { return JSON.parse(t); } catch { return null; } }
  const data = t.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
  for (let i = data.length - 1; i >= 0; i--) { try { const j = JSON.parse(data[i]); if (j && (j.result || j.error)) return j; } catch { /* next */ } }
  return null;
}

function client(c, { timeout = 12000 } = {}) {
  let sid = null; let n = 0;
  const post = async (method, params, note) => {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(URL_MCP, { method: 'POST', signal: ctl.signal, headers: { Authorization: 'Bearer ' + c.token, locationId: c.location_id, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
        body: JSON.stringify(note ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++n, method, params }) });
      if (r.headers.get('mcp-session-id')) sid = r.headers.get('mcp-session-id');
      if (note) return null;
      const j = parse(await r.text());
      if (!r.ok || !j) throw new Error('HighLevel MCP answered ' + r.status);
      if (j.error) throw new Error(j.error.message || 'HighLevel MCP error');
      return j.result;
    } finally { clearTimeout(tm); }
  };
  let ready = null;
  const init = () => (ready = ready || (async () => {
    await post('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'Founders AI OS', version: '1.0.0' } });
    await post('notifications/initialized', {}, true).catch(() => null);
  })());
  return {
    async tools() { await init(); const r = await post('tools/list', {}); return ((r && r.tools) || []).filter((t) => allowed(t.name)); },
    async call(name, args) {
      if (!allowed(name)) throw new Error('That HighLevel tool is not allowed here. Founders AI OS only reads contacts, deals, calendars and payments, and never conversations.');
      await init(); const r = await post('tools/call', { name, arguments: args || {} });
      return ((r && r.content) || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n');
    },
  };
}

// Fill a tool's arguments from what is known: location, a search term, a limit and a recent date window.
function fill(tool, c, want) {
  const props = (tool.inputSchema && tool.inputSchema.properties) || {}; const req = (tool.inputSchema && tool.inputSchema.required) || []; const out = {};
  const now = Date.now();
  for (const [k, p] of Object.entries(props)) {
    const t = p && p.type;
    if (/location_?id$/i.test(k) || /(^|_)altId$/.test(k)) out[k] = c.location_id;
    else if (/(^|_)altType$/.test(k)) out[k] = 'location';
    else if (/limit|pagelimit/i.test(k)) out[k] = t === 'string' ? '10' : 10;
    else if (want.query && /(^|_)(query|q|search|searchterm)$/i.test(k)) out[k] = want.query;
    else if (!req.includes(k) && /(start|end)(date|time|at)?$/i.test(k)) continue;
    else if (/start(date|time|at)?$/i.test(k) && /start/i.test(k)) out[k] = t === 'number' || t === 'integer' ? now - 30 * 864e5 : new Date(now - 30 * 864e5).toISOString().slice(0, 10);
    else if (/end(date|time|at)?$/i.test(k) && /end/i.test(k)) out[k] = t === 'number' || t === 'integer' ? now + 7 * 864e5 : new Date(now + 7 * 864e5).toISOString().slice(0, 10);
  }
  const missing = req.filter((k) => out[k] == null);
  return missing.length ? null : out;
}

const INTENTS = [
  { re: /\b(deal|deals|pipeline|opportunit|stage|won|lost)\b/i, pick: /opportunit.*search|search.*opportunit/i },
  { re: /\b(payment|payments|transaction|sale|sales|paid|revenue|order|orders|refund)\b/i, pick: /transaction|payments.*list/i },
  { re: /\b(contact|contacts|lead|leads|who is|customer|buyer|member)\b/i, pick: /contacts.*get-contacts|contacts.*search|search.*contacts/i },
  { re: /\b(call|calls|appointment|appointments|calendar|booked|booking|meeting)\b/i, pick: /calendar.*event/i },
];
const wants = (q) => INTENTS.filter((i) => i.re.test(String(q || '')));

// Live read-only context for an AI Team answer. Returns null when the question is not about HighLevel data.
async function teamContext(c, question) {
  const hits = wants(question); if (!hits.length || !c) return null;
  const name = (String(question).match(/\b(?:about|for|named|called)\s+([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/) || [])[1] || null;
  try {
    const m = client(c); const list = await m.tools(); const parts = [];
    for (const h of hits.slice(0, 3)) {
      const tool = list.find((t) => h.pick.test(t.name)); if (!tool) continue;
      const args = fill(tool, c, { query: name }); if (!args) continue;
      const text = await m.call(tool.name, args).catch(() => '');
      if (text) parts.push(`${tool.name}:\n${text.slice(0, 3500)}`);
    }
    return parts.length ? { via: 'HighLevel MCP', text: parts.join('\n\n').slice(0, 9000) } : null;
  } catch { return null; }
}

// HighLevel's MCP answers with large raw JSON. Keep what a model needs: drop empty values, ids of no use,
// long blobs and deep nesting, and cap long lists, so a lookup fits in one tool result.
function compact(text, max = 11000) {
  const t = String(text || ''); let j; try { j = JSON.parse(t); } catch { return t.slice(0, max); }
  const DROP = /^(locationId|altId|altType|traceId|fingerprint|customFields|attributions?|attributionSource|lastAttributionSource|followers|internalSource|searchAfter|sort|chargeSnapshot|paymentProvider|meta_data|profilePhoto|__v|_id|deleted|createdBy|updatedBy|lastUpdatedBy)$/;
  const walk = (v, d, arr) => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'string') return v.length > 240 ? v.slice(0, 240) + '...' : v;
    if (typeof v !== 'object') return v;
    if (d > 5) return undefined;
    if (Array.isArray(v)) { const out = v.slice(0, arr).map((x) => walk(x, d + 1, arr)).filter((x) => x !== undefined); if (v.length > arr) out.push(`and ${v.length - arr} more`); return out.length ? out : undefined; }
    const o = {}; for (const [k, x] of Object.entries(v)) { if (DROP.test(k)) continue; const y = walk(x, d + 1, arr); if (y !== undefined) o[k] = y; }
    return Object.keys(o).length ? o : undefined;
  };
  for (const arr of [25, 12, 6, 3]) { const s = JSON.stringify(walk(j, 0, arr) || {}); if (s.length <= max || arr === 3) return s.slice(0, max); }
  return '';
}

module.exports = { allowed, client, fill, teamContext, wants, compact };

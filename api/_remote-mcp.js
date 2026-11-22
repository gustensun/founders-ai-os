// A bounded, server-side MCP client. No subprocesses, redirects, local-network
// access, ambient credentials, automatic tool calls or server-requested sampling.
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const { bad, crypto } = require('./_lib');
const MODERN = '2026-07-28';
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'];
const CLIENT = { name: 'founders-ai-os', version: '1.0.0' };
const MAX_RESPONSE = 1048576;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const text = (v, n = 2000) => typeof v === 'string' ? v.slice(0, n) : '';

function endpoint(value) {
  let u;
  try { u = new URL(String(value || '').trim()); } catch { throw bad('Enter the HTTPS URL of an MCP server.'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.search)
    throw bad('Use an HTTPS URL without a query, fragment or embedded password. Put credentials in the authentication fields.');
  if (u.port && u.port !== '443') throw bad('Use a public HTTPS endpoint on port 443.');
  if (net.isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || host.endsWith('.') ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host) ||
      host === 'metadata.google.internal' || host.endsWith('.ts.net') || u.href.length > 2048)
    throw bad('Use a public server hostname. Local and private-network endpoints are not supported.');
  return u;
}
function publicIPv4(address) {
  if (net.isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
async function addresses(host, lookup = dns.lookup) {
  const rows = await lookup(host, { all: true, family: 4, verbatim: true }).catch(() => { throw bad('The server hostname could not be resolved.', 422); });
  if (!rows.length || rows.some(r => !publicIPv4(r.address))) throw bad('This endpoint resolves to a private or reserved network. It cannot be connected.');
  return rows;
}
function credentials(input = {}) {
  const auth = ['none', 'bearer', 'header'].includes(input.auth) ? input.auth : 'none';
  const out = { endpoint: endpoint(input.endpoint).href, auth };
  if (auth !== 'none') {
    const value = String(input.secret || '').trim();
    if (!value || value.length > 8192 || /[^\x20-\x7e]/.test(value)) throw bad('Enter a valid credential without line breaks.');
    out.secret = value;
  }
  if (auth === 'header') {
    const name = String(input.header || '').trim();
    if (!TOKEN.test(name) || name.length > 80 ||
        /^(host|connection|content-.+|transfer-.+|accept.*|origin|referer|cookie|forwarded|via|upgrade|te|trailer|expect|proxy-.+|sec-.+|mcp-.+|x-forwarded-.+)$/i.test(name))
      throw bad('Use a credential header such as X-API-Key, not a transport or forwarding header.');
    out.header = name;
  }
  return out;
}
function authHeaders(config) {
  return config.auth === 'bearer' ? { Authorization: 'Bearer ' + config.secret } :
    config.auth === 'header' ? { [config.header]: config.secret } : {};
}
function redact(value, config) {
  let s = typeof value === 'string' ? value : JSON.stringify(value);
  for (const token of [config?.secret, config?.session]) if (token) s = s.split(token).join('[credential removed]');
  return s;
}
function parsePacket(packet, id) {
  let data;
  try { data = JSON.parse(packet); } catch { return null; }
  const rows = Array.isArray(data) ? data : [data];
  const reply = rows.find(r => r && r.jsonrpc === '2.0' && r.id === id && (object(r.result) || object(r.error)));
  return reply || null;
}
function sseFrame(frame, id) {
  const payload = frame.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).replace(/^ /, '')).join('\n');
  return payload ? parsePacket(payload, id) : null;
}
async function request(config, message, opts = {}) {
  const url = endpoint(config.endpoint);
  const remaining = Math.min(opts.timeout || 12000, (opts.deadline || Date.now() + 12000) - Date.now());
  if (remaining < 200) throw bad('The server took too long. Try again later.', 504);
  // Both DNS and the socket share one absolute timeout. Pin the resolved address
  // in lookup so a second DNS answer cannot rebind the connection to a private IP.
  let timer;
  const controller = new AbortController();
  const abort = () => controller.abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  if (opts.signal?.aborted) abort();
  const work = (async () => {
    const resolved = await addresses(url.hostname, opts.lookup);
    if (controller.signal.aborted) throw bad('The server took too long.', 504);
    const pinned = resolved[0];
    return new Promise((resolve, reject) => {
      let finished = false, bytes = 0, all = '', buffer = '';
      const body = message == null ? '' : JSON.stringify(message);
      const done = (error, result) => {
        if (finished) return;
        finished = true;
        if (error) reject(error); else resolve(result);
        req.destroy();
      };
      const req = https.request(url, {
        method: opts.method || 'POST', agent: false, family: 4,
        lookup: (_hostname, options, callback) => {
          if (typeof options === 'function') { callback = options; options = {}; }
          if (options?.all) callback(null, [pinned]); else callback(null, pinned.address, 4);
        },
        headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
          'User-Agent': 'FoundersAIOS-MCP/1.0', ...authHeaders(config),
          ...(config.session ? { 'Mcp-Session-Id': config.session } : {}),
          ...(opts.headers || {}), ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) }
      }, res => {
        const status = res.statusCode;
        if (status >= 300 && status < 400) return done(bad('The endpoint redirects. Enter its final HTTPS MCP URL; credentials were not forwarded.', 422));
        if (status === 401 || status === 403) return done(bad('The server did not accept this authentication. Use its bearer token or API key. Browser OAuth sign-in is not supported here yet.', 422));
        if (status === 429) return done(bad('The server is rate limiting requests. Try again later.', 429));
        if (!opts.raw && (message?.id === undefined || opts.method === 'DELETE') && status >= 200 && status < 300)
          return done(null, { status, result: {}, session: res.headers['mcp-session-id'] });
        const stream = /^text\/event-stream\b/i.test(String(res.headers['content-type'] || ''));
        res.setEncoding('utf8');
        res.on('data', chunk => {
          bytes += Buffer.byteLength(chunk);
          if (bytes > MAX_RESPONSE) return done(bad('The server response exceeds the 1 MB safety limit.', 422));
          all += chunk;
          if (!stream) return;
          buffer += chunk;
          let match;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            const frame = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            const found = sseFrame(frame, message?.id);
            if (found) return done(null, { status, packet: found, session: res.headers['mcp-session-id'] });
          }
        });
        res.on('end', () => {
          if (opts.raw) return status >= 200 && status < 300 ?
            done(null, { status, text: all, contentType: String(res.headers['content-type'] || '') }) :
            done(bad('The public file could not be read (HTTP ' + status + ').', 422));
          const packet = stream ? sseFrame(buffer, message?.id) : parsePacket(all, message?.id);
          if (packet) return done(null, { status, packet, session: res.headers['mcp-session-id'] });
          const error = bad(status === 404 || status === 405 ? 'No Streamable HTTP MCP endpoint was found at this URL. A website homepage or local stdio command is not an MCP endpoint.' : 'The server did not return a valid MCP response.', 422);
          error.http = status;
          done(error);
        });
        res.on('error', () => done(bad('The server response was interrupted. A tool request may already have run.', 502)));
      });
      controller.signal.addEventListener('abort', () => done(bad('The server took too long. A tool request may already have run.', 504)), { once: true });
      if (controller.signal.aborted) return done(bad('The server took too long.', 504));
      req.on('error', () => done(bad('The HTTPS server could not be reached. Check its URL and certificate.', 502)));
      req.setTimeout(remaining, () => done(bad('The server took too long. A tool request may already have run.', 504)));
      req.end(body);
    });
  })();
  // The outer timer also bounds DNS, which https socket timeouts do not cover.
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(bad('The server took too long. A tool request may already have run.', 504)); }, remaining);
    })]);
  } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', abort); }
}
function headerValue(value) {
  const s = String(value);
  return /[^\x20-\x7e]/.test(s) || s !== s.trim() || /^=\?base64\?.*\?=$/.test(s) ?
    '=?base64?' + Buffer.from(s).toString('base64') + '?=' : s;
}
function parameterHeaders(schema, args) {
  const out = {}, names = new Set();
  function walk(s, value, reachable = true, depth = 0) {
    if (!object(s) || depth > 24) return;
    if (s['x-mcp-header'] !== undefined) {
      const name = s['x-mcp-header'];
      if (!reachable || typeof name !== 'string' || !TOKEN.test(name) || name.length > 80 ||
          names.has(name.toLowerCase()) || !['string', 'integer', 'boolean'].includes(s.type))
        throw bad('This tool has an unsupported HTTP parameter-header definition.', 422);
      names.add(name.toLowerCase());
      if (value !== undefined) {
        if ((s.type === 'integer' && !Number.isSafeInteger(value)) || (s.type !== 'integer' && typeof value !== s.type))
          throw bad('A tool parameter does not match its declared type.');
        const encoded = headerValue(value);
        if (encoded.length > 8192) throw bad('A tool parameter header is too long.');
        out['Mcp-Param-' + name] = encoded;
      }
    }
    for (const [key, child] of Object.entries(s)) {
      if (key === 'properties' && object(child)) {
        for (const [property, sub] of Object.entries(child)) walk(sub, object(value) ? value[property] : undefined, reachable, depth + 1);
      } else if (key !== 'x-mcp-header' && object(child)) walk(child, undefined, false, depth + 1);
      else if (Array.isArray(child)) child.forEach(sub => walk(sub, undefined, false, depth + 1));
    }
  }
  walk(schema, args);
  return out;
}
function safeJSON(value, max = 32768) {
  if (!object(value)) throw bad('Arguments must be a JSON object.');
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > max) throw bad('Arguments are too large.');
  function inspect(v, depth = 0) {
    if (depth > 24) throw bad('Arguments are nested too deeply.');
    if (v && typeof v === 'object') for (const [k, val] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw bad('That property name is not supported.');
      inspect(val, depth + 1);
    }
  }
  inspect(value); return value;
}
function normalizeCatalog(type, rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 60).filter(object).flatMap(row => {
    const name = text(row.name, 256), uri = text(row.uri, 2048);
    if (!name || (type === 'resources' && !uri)) return [];
    const base = { name, title: text(row.title, 240), description: text(row.description, 2000) };
    if (type === 'tools') {
      const schema = object(row.inputSchema) ? row.inputSchema : { type: 'object', properties: {} };
      if (Buffer.byteLength(JSON.stringify(schema)) > 32768) return [];
      try { safeJSON(schema); parameterHeaders(schema, {}); } catch { return []; }
      return [{ ...base, inputSchema: schema, readOnly: row.annotations?.readOnlyHint === true }];
    }
    if (type === 'resources') return [{ ...base, uri, mimeType: text(row.mimeType, 120) }];
    return [{ ...base, arguments: (Array.isArray(row.arguments) ? row.arguments : []).slice(0, 30).filter(object).map(a => ({
      name: text(a.name, 100), description: text(a.description, 500), required: a.required === true
    })).filter(a => a.name) }];
  });
}
class Client {
  constructor(config, options = {}) {
    this.config = { ...config }; this.version = MODERN; this.deadline = options.deadline || Date.now() + 40000;
    this.transport = options.transport || request; this.server = {}; this.capabilities = {};
  }
  async rpc(method, params = {}, extraHeaders = {}) {
    const modern = this.version === MODERN;
    const data = { ...params };
    if (modern) data._meta = { 'io.modelcontextprotocol/protocolVersion': this.version,
      'io.modelcontextprotocol/clientInfo': CLIENT, 'io.modelcontextprotocol/clientCapabilities': {} };
    const packet = { jsonrpc: '2.0', id: crypto.randomUUID(), method, params: data };
    const headers = { 'MCP-Protocol-Version': this.version, ...(modern ? { 'Mcp-Method': method,
      ...(params.name || params.uri ? { 'Mcp-Name': headerValue(params.name || params.uri) } : {}) } : {}), ...extraHeaders };
    const response = await this.transport(this.config, packet, { deadline: this.deadline, headers });
    if (response.session) {
      if (!/^[\x21-\x7e]{1,1024}$/.test(response.session)) throw bad('The server returned an invalid session identifier.', 422);
      this.config.session = response.session;
    }
    const r = response.packet;
    if (r?.error) {
      const e = bad('The MCP server rejected this request' + (r.error.code ? ' (code ' + Number(r.error.code) + ')' : '') + '.', 422);
      e.rpcCode = r.error.code; e.http = response.status; e.supported = r.error.data?.supported; throw e;
    }
    if (!r || !object(r.result)) throw bad('The server returned an invalid MCP result.', 422);
    if (r.result.inputRequests) throw bad('This tool needs interactive input or sampling that is not supported here. It was not retried.', 422);
    return r.result;
  }
  async start() {
    let modern;
    try { modern = await this.rpc('server/discover'); }
    catch (e) {
      if (e.rpcCode === -32022 && Array.isArray(e.supported) && !e.supported.some(v => LEGACY.includes(v)))
        throw bad('This server requires an MCP version not supported by the OS yet.', 422);
      if (![-32601, -32600, -32602, -32000, -32001, -32002, -32022].includes(e.rpcCode) &&
          ![400, 404, 405, 406].includes(e.http)) throw e;
    }
    if (modern) {
      this.server = modern.serverInfo || {}; this.capabilities = modern.capabilities || {};
      return this;
    }
    this.version = LEGACY[0]; delete this.config.session;
    const r = await this.rpc('initialize', { protocolVersion: this.version, capabilities: {}, clientInfo: CLIENT });
    if (!LEGACY.includes(r.protocolVersion)) throw bad('The server requires an unsupported MCP protocol version.', 422);
    this.version = r.protocolVersion; this.server = r.serverInfo || {}; this.capabilities = r.capabilities || {};
    await this.transport(this.config, { jsonrpc: '2.0', method: 'notifications/initialized' }, {
      deadline: this.deadline, headers: { 'MCP-Protocol-Version': this.version }
    });
    return this;
  }
  async discover() {
    const catalog = { tools: [], resources: [], prompts: [], limited: false };
    for (const type of ['tools', 'resources', 'prompts']) {
      if (this.version !== MODERN && !this.capabilities[type]) continue;
      let cursor;
      for (let page = 0; page < 3; page++) {
        let result;
        try { result = await this.rpc(type + '/list', cursor ? { cursor } : {}); }
        catch (e) { if (e.rpcCode === -32601) break; throw e; }
        catalog[type].push(...normalizeCatalog(type, result[type]));
        cursor = typeof result.nextCursor === 'string' ? result.nextCursor.slice(0, 4096) : '';
        if (!cursor || catalog[type].length >= 60) { if (cursor) catalog.limited = true; break; }
        if (page === 2) catalog.limited = true;
      }
      catalog[type] = [...new Map(catalog[type].map(r => [type === 'resources' ? r.uri : r.name, r])).values()].slice(0, 60);
    }
    return { ...catalog, server: { name: text(this.server.name, 160), version: text(this.server.version, 100) }, protocol: this.version };
  }
  async close() {
    if (!this.config.session || Date.now() > this.deadline) return;
    try { await this.transport(this.config, null, { method: 'DELETE', timeout: 1500, deadline: this.deadline,
      headers: { 'MCP-Protocol-Version': this.version } }); } catch { /* session cleanup is best effort; never replay a call */ }
  }
}
function plan(catalog, input) {
  const type = input.type;
  if (!['tool', 'resource', 'prompt'].includes(type)) throw bad('Choose a tool, resource or prompt.');
  const key = type === 'tool' ? 'tools' : type === 'resource' ? 'resources' : 'prompts';
  const item = (catalog?.[key] || []).find(r => (type === 'resource' ? r.uri : r.name) === input.name);
  if (!item) throw bad('This item is not in the saved server catalog. Refresh the connection first.', 409);
  const args = safeJSON(input.arguments || {});
  if (type === 'prompt') for (const a of item.arguments || []) {
    if (a.required && !(a.name in args)) throw bad('Missing prompt argument: ' + a.name);
    if (a.name in args && typeof args[a.name] !== 'string') throw bad('Prompt arguments must be text.');
  }
  if (type === 'tool') for (const name of item.inputSchema.required || []) if (!(name in args)) throw bad('Missing tool argument: ' + name);
  return { type, name: input.name, title: item.title || item.name, arguments: args,
    method: type === 'tool' ? 'tools/call' : type === 'resource' ? 'resources/read' : 'prompts/get',
    params: type === 'resource' ? { uri: item.uri } : { name: item.name, arguments: args },
    headers: type === 'tool' ? parameterHeaders(item.inputSchema, args) : {},
    readOnly: type !== 'tool' || item.readOnly, schemaDigest: hash(item) };
}
function resultText(result, config) {
  const parts = [];
  function content(c) {
    if (!object(c)) return;
    if (typeof c.text === 'string') parts.push(c.text);
    else if (c.type === 'resource' && c.resource) content(c.resource);
    else if (c.type === 'image' || c.type === 'audio' || c.blob) parts.push('[Binary attachment omitted. This view uses text only.]');
  }
  (result.content || result.contents || []).forEach(content);
  (result.messages || []).forEach(m => content(m.content));
  if (result.structuredContent) parts.push(JSON.stringify(result.structuredContent, null, 2));
  if (!parts.length) parts.push('The server returned no text.');
  const joined = redact(parts.join('\n\n'), config);
  return { text: joined.slice(0, 80000), truncated: joined.length > 80000, is_error: result.isError === true };
}
module.exports = { Client, request, endpoint, publicIPv4, addresses, credentials, authHeaders, redact, parsePacket, sseFrame,
  parameterHeaders, headerValue, normalizeCatalog, safeJSON, plan, resultText, hash, object, MODERN, LEGACY };

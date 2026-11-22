// What Grok Bot makes for the founder (PDFs, graphics, copy, content) waits on the From Grok page.
// Stored as waiting rows in os_drafts with source "Grok Bot" so no new table is needed. The founder
// approves each one in the app, and only then does it go into the Brain. Nothing here trains anything.
const SOURCE = 'Grok Bot';
const TYPES = ['pdf', 'graphic', 'copy', 'content', 'other'];
const LABEL = { pdf: 'PDF', graphic: 'Graphic', copy: 'Copy', content: 'Content', other: 'File' };
const noDash = (t) => String(t || '').replace(/\s*\u2014\s*/g, ', ');
const isUrl = (u) => { try { return /^https:$/.test(new URL(String(u)).protocol); } catch { return false; } };

function guess(urls, text) {
  const u = (urls[0] || '').toLowerCase().split('?')[0];
  if (/\.pdf$/.test(u)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(u) || /imgur|grok\.com\/.*image|x\.ai\/.*image/.test(u)) return 'graphic';
  if (String(text || '').split(/\s+/).length > 60 && !urls.length) return 'copy';
  return 'content';
}

function row(a, client) {
  a = a || {};
  const urls = (Array.isArray(a.urls) ? a.urls : []).map((x) => String(typeof x === 'object' && x ? x.url : x).trim()).filter(isUrl).slice(0, 10);
  const text = noDash(a.text).slice(0, 20000).trim();
  const title = noDash(a.title).replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!title) return { ok: false, message: 'Give it a short title.' };
  if (!text && !urls.length) return { ok: false, message: 'Send the full text, or a public https link to the file or image.' };
  const type = TYPES.includes(a.type) ? a.type : guess(urls, text);
  if ((type === 'pdf' || type === 'graphic') && !urls.length) return { ok: false, message: 'Add a public https link to the ' + LABEL[type].toLowerCase() + ' in urls so the founder can see it.' };
  const task = /^[0-9a-f-]{36}$/i.test(String(a.task_id || '')) ? a.task_id : null;
  return { ok: true, data: { kind: 'Grok ' + LABEL[type].toLowerCase(), title, body: text || null, source: SOURCE, status: 'waiting', meta: { grok: { type, urls, task_id: task, client: String(client || 'Grok').slice(0, 60), at: new Date().toISOString() } } } };
}

// A finished task with links becomes one waiting item, unless Grok already sent it with grok_deliver.
async function fromTask(hash, who, taskId, summary, links, rpc) {
  const urls = links.map((l) => (l && l.url) || l).filter(isUrl);
  if (!urls.length) return 0;
  const r = await rpc('mcp_os_read', { p_hash: hash, p_section: 'approvals', p_id: null, p_query: null, p_filter: { source: SOURCE }, p_limit: 100, p_offset: 0 });
  if (((r && r.rows) || []).some((x) => x.meta && x.meta.grok && x.meta.grok.task_id === taskId)) return 0;
  const task = await rpc('mcp_grok_tasks', { p_hash: hash, p_status: 'all' }).then((t) => (t || []).find((x) => (x.task_id || x.id) === taskId)).catch(() => null);
  const title = (task && task.title) || (links.find((l) => l && l.label) || {}).label || 'Made by Grok Bot';
  const one = row({ title, text: summary || '', urls, task_id: taskId }, who && who.client);
  if (!one.ok) return 0;
  await rpc('mcp_os_write', { p_hash: hash, p_section: 'approvals', p_op: 'create', p_id: null, p_data: one.data, p_client: (who && who.client) || 'Grok' });
  return 1;
}

module.exports = { SOURCE, TYPES, LABEL, row, guess, fromTask };

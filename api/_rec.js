// Founders AI OS: call recordings as searchable passages.
// Zoom transcripts (WebVTT) are read once, split into passages of about 900 characters with the time each
// passage starts and who spoke, and stored per workspace. The chat and MCP search those passages.
const { clip, jf, TZ } = require('./_lib');

const DAY = 864e5;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const tsec = (s) => { const m = String(s).match(/(?:(\d+):)?(\d+):(\d+)(?:[.,](\d+))?/); if (!m) return 0; return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3]; };

// WebVTT to cues: [{ s, who, text }]
function vtt(raw) {
  const out = []; const blocks = String(raw || '').replace(/\r/g, '').split(/\n\n+/);
  for (const b of blocks) {
    const lines = b.split('\n').filter(Boolean); const ti = lines.findIndex((l) => l.includes('-->')); if (ti < 0) continue;
    const s = tsec(lines[ti].split('-->')[0].trim()); let text = lines.slice(ti + 1).join(' ').trim(); if (!text) continue;
    let who = ''; const m = text.match(/^([^:]{2,60}):\s+(.*)$/); if (m) { who = m[1].trim(); text = m[2]; }
    const last = out[out.length - 1];
    if (last && last.who === who && s - last.e < 6 && last.text.length < 400) { last.text += ' ' + text; last.e = s; } else out.push({ s, e: s, who, text });
  }
  return out;
}
// Cues to passages of about 900 characters, never cutting a cue in half.
function chunks(cues, size = 900) {
  const out = []; let cur = null;
  for (const c of cues) {
    const line = (c.who ? c.who + ': ' : '') + c.text;
    if (cur && cur.body.length + line.length > size) { out.push(cur); cur = null; }
    if (!cur) cur = { at_s: c.s, who: new Set(), body: '' };
    cur.body += (cur.body ? '\n' : '') + line; if (c.who) cur.who.add(c.who);
  }
  if (cur) out.push(cur);
  return out.map((x, i) => ({ idx: i, at_s: x.at_s, speakers: [...x.who].slice(0, 6).join(', ') || null, body: x.body }));
}

async function zoomToken(c) {
  const j = await jf('Zoom', 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(c.account_id), { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.client_id + ':' + c.client_secret).toString('base64') } });
  return j.access_token;
}
const when = (iso) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }); } catch { return ''; } };

// Read Zoom recordings from `months` windows back, store the ones not stored yet.
// known: Set of ext_ids already stored. save(rec, chunks) persists one recording.
async function ingestZoom(c, { known = new Set(), save, months = [0], max = 8, deadline = Date.now() + 40000 } = {}) {
  const tok = await zoomToken(c); const H = { headers: { Authorization: 'Bearer ' + tok } };
  const found = []; let added = 0, skipped = 0, failed = 0, pending = 0;
  for (const back of months) {
    const to = Date.now() - back * 30 * DAY; const from = to - 30 * DAY;
    const j = await jf('Zoom', `https://api.zoom.us/v2/users/me/recordings?page_size=60&from=${isoDay(from)}&to=${isoDay(to)}`, H);
    for (const m of j.meetings || []) found.push(m);
  }
  const seen = new Set();
  for (const m of found.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))) {
    const ext = m.uuid || String(m.id); if (seen.has(ext)) continue; seen.add(ext);
    if (known.has(ext)) { skipped++; continue; }
    const f = (m.recording_files || []).find((x) => x.file_type === 'TRANSCRIPT' && x.status === 'completed');
    const rec = { source: 'zoom', ext_id: ext, title: clip((m.topic || 'Zoom call') + ' · ' + when(m.start_time), 200), started_at: m.start_time, minutes: m.duration || null, url: m.share_url || null };
    if (!f) { await save({ ...rec, status: 'no_transcript', words: 0 }, []); added++; continue; }
    if (added >= max || Date.now() > deadline) { pending++; continue; }
    try {
      const r = await fetch(f.download_url, { headers: { Authorization: 'Bearer ' + tok }, redirect: 'follow' });
      if (!r.ok) throw new Error('Zoom returned ' + r.status + ' for the transcript');
      const cs = chunks(vtt(await r.text()));
      const words = cs.reduce((n, x) => n + x.body.split(/\s+/).length, 0);
      await save({ ...rec, status: cs.length ? 'ready' : 'no_transcript', words }, cs); added++;
    } catch (e) { failed++; await save({ ...rec, status: 'error', error: clip(e.message, 240), words: 0 }, []).catch(() => {}); }
  }
  return { found: seen.size, added, skipped, failed, pending };
}

module.exports = { vtt, chunks, ingestZoom };

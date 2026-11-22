// Founders AI OS: every connection on the Connections page.
// Each provider is checked against its real API before anything is saved. Credentials are sealed on the server
// (AES-256-GCM) and never sent back to the browser. Sync results are stored as small summaries the screens read.
const L = require('./_lib');
const AffReport = require('../js/aff-report.js');
const { APP_URL, bad, clip, q, seal, open, sign, unsign, rpc, sb, jf, crypto } = L;

const DAY = 864e5;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const num = (v) => (v == null || v === '' || isNaN(+v) ? 0 : +v);
const r2 = (n) => Math.round(n * 100) / 100;
const median = (a) => { const s = a.slice().sort((x, y) => x - y); if (!s.length) return 0; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const short = (n) => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); };
const money = (n, c = 'USD') => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n); } catch { return Math.round(n) + ' ' + c; } };
const feed = (metrics, items, extra = {}) => ({ feed: { metrics: metrics.filter(Boolean), items: (items || []).slice(0, 25) }, ...extra });
const need = (v, msg) => { if (!String(v || '').trim()) throw bad(msg); return String(v).trim(); };

/* ---------- Google ---------- */
const GSCOPE = {
  youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
  'youtube-2': ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
  gcal: ['https://www.googleapis.com/auth/calendar.readonly'],
  gdrive: ['https://www.googleapis.com/auth/drive.readonly'],
  meet: ['https://www.googleapis.com/auth/drive.readonly'],
  ga4: ['https://www.googleapis.com/auth/analytics.readonly'],
  gsc: ['https://www.googleapis.com/auth/webmasters.readonly'],
  'google-ads': ['https://www.googleapis.com/auth/adwords'],
};
const gReady = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
async function gAccess(c) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: c.refresh_token, grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.access_token) throw bad('Google access expired. Connect it again.', 422); return j.access_token;
}
const gget = (tok, url, opt = {}) => jf('Google', url, { ...opt, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', ...(opt.headers || {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
const gNeedApi = (e, api) => { if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(e.message)) throw bad('The ' + api + ' is not switched on for this Google project yet.', 503); throw e; };
// YouTube by channel link: public numbers through the YouTube Data API with the server key, no Google sign-in.
// It works for any public channel, so a founder can connect in one step and add sign-in later for analytics.
const YT_KEY = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '';
const ytget = (c, tok, url) => c && c.public ? jf('YouTube', url + (url.includes('?') ? '&' : '?') + 'key=' + q(YT_KEY())).catch((e) => gNeedApi(e, 'YouTube Data API')) : gget(tok, url).catch((e) => gNeedApi(e, 'YouTube Data API'));
async function ytResolve(link) {
  if (!YT_KEY()) throw bad('Channel links are not switched on for this server yet. Use Sign in with Google for now.', 503);
  let s = String(link || '').trim(); if (!s) throw bad('Paste your channel link or @handle.');
  s = s.replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)/i, '');
  const base = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails';
  const one = async (qs) => ((await ytget({ public: true }, null, base + '&' + qs)).items || [])[0] || null;
  let m, ch = null;
  if ((m = /(?:^|\/)(UC[\w-]{22})(?:[/?#]|$)/.exec(s))) ch = await one('id=' + m[1]);
  else if ((m = /^(?:youtube\.com\/)?@([\w.\-\u00C0-\uFFFF]{2,100})/i.exec(s)) || (m = /^@?([\w.\-]{3,100})$/.exec(s))) ch = await one('forHandle=' + q('@' + m[1]));
  else if ((m = /^youtube\.com\/user\/([\w.\-]+)/i.exec(s))) ch = await one('forUsername=' + q(m[1]));
  else if ((m = /^(?:youtube\.com\/c\/|youtube\.com\/)([^/?#]+)/i.exec(s))) { ch = await one('forHandle=' + q('@' + decodeURIComponent(m[1]))); if (!ch) { const r = await ytget({ public: true }, null, 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=' + q(decodeURIComponent(m[1]))); const id = (((r.items || [])[0] || {}).id || {}).channelId; if (id) ch = await one('id=' + id); } }
  else if ((m = /^(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/shorts\/)([\w-]{11})/i.exec(s))) { const v = ((await ytget({ public: true }, null, 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + m[1])).items || [])[0]; if (v) ch = await one('id=' + v.snippet.channelId); }
  if (!ch) throw bad('No YouTube channel matches that. Paste the link from your channel page, like youtube.com/@yourname.', 404);
  return ch;
}

/* ---------- small fetch helpers per provider ---------- */
const bearer = (t) => ({ Authorization: 'Bearer ' + t });
const META = 'https://graph.facebook.com/v21.0';
async function zoomToken(c) {
  const j = await jf('Zoom', 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + q(c.account_id), { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.client_id + ':' + c.client_secret).toString('base64') } });
  return j.access_token;
}
async function paypalToken(c) {
  const base = c.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const j = await jf('PayPal', base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.client_id + ':' + c.client_secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  return { tok: j.access_token, base };
}
function ebJwt(c) {
  const h = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: c.app_id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3000 })).toString('base64url');
  let sig; try { sig = crypto.createSign('RSA-SHA256').update(h + '.' + p).sign(c.private_key, 'base64url'); } catch { throw bad('That private key could not be read. Paste the whole .pem file, including the BEGIN and END lines.'); }
  return h + '.' + p + '.' + sig;
}
const eb = (c, path, opt = {}) => jf('Enable Banking', 'https://api.enablebanking.com' + path, { ...opt, headers: { Authorization: 'Bearer ' + ebJwt(c), 'Content-Type': 'application/json' }, body: opt.body ? JSON.stringify(opt.body) : undefined });
async function xeroRefresh(c) {
  const j = await jf('Xero', 'https://identity.xero.com/connect/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.client_id + ':' + c.client_secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token }) });
  c.refresh_token = j.refresh_token || c.refresh_token; c.__rotated = true; return j.access_token;
}
const XERO_SCOPES = process.env.XERO_SCOPES || 'openid offline_access accounting.settings.read accounting.reports.read accounting.transactions.read';

function parseCsv(text) {
  const rows = []; let row = [], cell = '', inq = false; const s = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += ch; }
    else if (ch === '"') inq = true; else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

/* ---------- the brief, shared by Telegram, Slack, email and the daily job ---------- */
const TZ = L.TZ;
const hhmm = (iso) => new Date(Date.parse(iso)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
function briefText({ name, hlb, events, counts }) {
  const lines = []; const first = (name || '').split(' ')[0];
  lines.push('Good morning' + (first ? ', ' + first : '') + '.');
  const today = (events || []).filter((e) => isoDay(Date.parse(e.start)) === isoDay(Date.now()));
  const calls = (hlb && hlb.calls ? hlb.calls.filter((c) => isoDay(Date.parse(c.start)) === isoDay(Date.now())) : []);
  const n = today.length + calls.length;
  if (n) lines.push(n + (n === 1 ? ' meeting' : ' meetings') + ' today' + ((today[0] || calls[0]) ? ', first at ' + hhmm((today[0] || calls[0]).start) + ', ' + clip((today[0] || calls[0]).title, 60) : '') + '.');
  else lines.push('No meetings on the calendar today.');
  if (hlb && hlb.leads) lines.push(hlb.leads.week + ' new leads this week, ' + hlb.leads.today + ' today' + (hlb.leads.sources && hlb.leads.sources[0] ? '. Most from ' + hlb.leads.sources[0].name : '') + '.');
  if (hlb && hlb.deals && hlb.deals.moved && hlb.deals.moved[0]) lines.push('Latest deal movement: ' + hlb.deals.moved[0].name + (hlb.deals.moved[0].stage ? ' to ' + hlb.deals.moved[0].stage : '') + '.');
  if (counts) {
    if (counts.drafts) lines.push(counts.drafts + ' drafts wait for approval' + (counts.top_draft ? ', starting with "' + clip(counts.top_draft, 70) + '"' : '') + '.');
    if (counts.late) lines.push(counts.late + (counts.late === 1 ? ' promise is' : ' promises are') + ' due today or late.');
  }
  lines.push(APP_URL);
  return lines.join('\n');
}

/* ---------- ElevenLabs: each workspace's own key, its own voices ---------- */
const ELEVEN_CAT = { cloned: 'Your cloned voice', professional: 'Your professional clone', generated: 'Designed voice', premade: 'ElevenLabs voice', famous: 'ElevenLabs voice', high_quality: 'Voice Library' };
const ELEVEN_DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
async function elevenVoices(key) {
  const j = await jf('ElevenLabs', 'https://api.elevenlabs.io/v2/voices?page_size=100', { headers: { 'xi-api-key': key } });
  return (j.voices || []).map((v) => ({ id: v.voice_id, name: clip(v.name, 60), category: v.category || null, accent: (v.labels && (v.labels.accent || v.labels.language)) || null, preview: v.preview_url || null }))
    .sort((a, b) => (a.category === 'premade') - (b.category === 'premade') || a.name.localeCompare(b.name)).slice(0, 120);
}
// Jarvis talks with the real-time model; spoken briefs use the full one. Older keys fall back to Flash.
const ELEVEN_MODELS = { live: [process.env.ELEVEN_MODEL || 'eleven_v4_turbo', 'eleven_flash_v2_5'], brief: [process.env.ELEVEN_BRIEF_MODEL || 'eleven_v4', 'eleven_v4_turbo', 'eleven_flash_v2_5'] };
async function elevenSpeak(key, voice, text, mode) {
  let last = null;
  for (const model of ELEVEN_MODELS[mode === 'brief' ? 'brief' : 'live']) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${q(voice)}?output_format=mp3_44100_64`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: model }) });
    if (r.ok) return { audio: Buffer.from(await r.arrayBuffer()).toString('base64'), type: 'audio/mpeg', model };
    const t = (await r.text()).slice(0, 400); last = { status: r.status, t };
    if (r.status === 401 || r.status === 429 || /voice_not_found|quota|credits|character/i.test(t)) break;
  }
  const msg = last && /quota|credits|character/i.test(last.t) ? 'Your ElevenLabs account is out of characters for this month.' : last && last.status === 401 ? 'ElevenLabs no longer accepts this key. Reconnect it in Connections.' : last && /voice_not_found/i.test(last.t) ? 'voice_not_found' : 'ElevenLabs: ' + ((last && last.t) || 'no answer').slice(0, 160);
  throw bad(msg, last && last.status === 401 ? 401 : 502);
}

// Eleven Realtime: speech in, speech out, one model. Jarvis keeps its own answers through the ask_os tool.
const RT_MODELS = ['eleven_realtime_v1_mini', 'eleven_realtime_v1_max'];
const RT_RULES = [
  'You are Jarvis, the voice of Founders AI OS and the founder\'s AI chief of staff. You speak, you do not write. Sound like a sharp, warm business partner on a call.',
  'Keep replies short and spoken: usually two to four plain sentences. Go longer only when brainstorming or when asked for detail. No lists, no markdown, no filler, no em dashes, no exclamation points.',
  'Call ask_os for anything that needs facts or live data: leads, calls, deals, YouTube numbers, researching a creator or topic on YouTube, the content board, goals, memory, what they said on a call, what is in their Brain, current events, or to open a screen, run the morning cycle, hold agents or remember something. Pass their request in their words. ask_os has tools and the full account, so trust its answer and say it in your own voice. Never guess or invent a number.',
  'When a lookup will take a moment, say a few words first, like: let me check, or: give me a second, I am pulling his channel.',
  'When they want to brainstorm, think out loud with them from the Brand DNA below: their offers, audience, voice and what works for them. Build on ideas, push back on weak ones, ask one good question at a time. Call ask_os if a fact or a quick bit of research would make the idea better.',
  'You never read or send messages. Conversations and replies stay in HighLevel.',
];
const RT_TOOLS = [{ type: 'function', name: 'ask_os', description: 'The founder\'s full account with live tools: HighLevel leads, calls and deals, YouTube research on any creator or topic, their own channel and sources, Zoom calls, Brain documents, offers, funnels, the content board, proven content, goals, memory and web search. Also opens screens, runs the morning cycle and saves things to memory. Can take a few seconds for research.', parameters: { type: 'object', properties: { question: { type: 'string', description: 'The founder\'s request in their own words, with any context from the conversation needed to answer it' } }, required: ['question'] } }];
async function elevenRealtime(key, { model, voice, instructions }) {
  const body = (v) => JSON.stringify({ session: { type: 'realtime', model, instructions, output_modalities: ['audio'], tools: RT_TOOLS, tool_choice: 'auto', max_duration_seconds: 1800,
    audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'semantic_vad', eagerness: 'medium' } }, output: { format: { type: 'audio/pcm' }, voice: v } } }, expires_after: { anchor: 'created_at', seconds: 120 } });
  let last = null;
  for (const v of [voice, 'brian'].filter((x, i, a) => x && a.indexOf(x) === i)) {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/realtime/client_secrets', { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: body(v) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (r.ok && j && j.value) return { value: j.value, expires_at: j.expires_at || null, model, voice: v, fallback_voice: v !== voice };
    last = { status: r.status, t: t.slice(0, 400) };
    if (!/voice/i.test(last.t) || r.status === 401) break;
  }
  const off = /not available for this workspace|not enabled|realtime/i.test(last.t) && last.status !== 401 && last.status !== 429;
  const perm = /permission|missing|not allowed|scope|convai/i.test(last.t);
  const msg = last.status === 401 || last.status === 403 ? (perm ? 'This ElevenLabs key does not have ElevenAgents access, which Eleven Realtime needs. In ElevenLabs, open API keys, give the key ElevenAgents access (or create a new key with it), and paste it again in Connections.' : 'ElevenLabs did not accept this key for Eleven Realtime (' + last.t.slice(0, 120) + '). Check the key has ElevenAgents access.') : /quota|credits|character|balance/i.test(last.t) ? 'Your ElevenLabs account is out of credits for this month.' : off ? 'Eleven Realtime is not switched on for your ElevenLabs account yet.' : 'ElevenLabs: ' + last.t.slice(0, 160);
  const e = bad(msg, last.status === 401 || last.status === 403 ? 403 : off ? 409 : 502); e.realtime_off = off; e.realtime_fail = true; throw e;
}

/* ---------- provider registry ---------- */
// kind: key (paste credentials), google (Google sign-in), oauth (your own app, then sign-in), webhook, csv, builtin, bank.
const P = {
  'hl-webhooks': {
    kind: 'webhook', name: 'HighLevel workflows',
    help: ['Click Create webhook URL below.', 'In HighLevel, open Automation, pick a workflow and add a Webhook action.', 'Paste the URL, method POST. Every run lands here as an event, and runs with a draft_title field become drafts in the Newsfeed.'],
    async test() { return { label: 'Workflow webhook', meta: {} }; },
    async sync(c, m) { const ev = (m && m.events) || []; return feed([{ l: 'Events received', v: short((m && m.event_count) || 0) }, { l: 'Last event', v: m && m.last_event_at ? new Date(m.last_event_at).toISOString().slice(0, 10) : 'None yet' }], ev.slice(0, 20).map((e) => ({ t: e.type || 'Workflow event', s: [e.name, e.email].filter(Boolean).join(' · '), at: e.at }))); },
  },
  youtube: {
    kind: 'google', name: 'YouTube', docs: 'https://myaccount.google.com/permissions',
    help: ['Paste your channel link or @handle and press Connect channel. Subscribers, views and your latest 25 uploads come in straight away, and refresh every morning.', 'Want watch time and subscriber growth as well? Sign in with Google using the account that owns the channel. You can do this now or later.'],
    async test(c, tok) { const j = await ytget(c, tok, 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&' + (c.public ? 'id=' + q(c.channel_id) : 'mine=true')); const ch = (j.items || [])[0]; if (!ch) throw bad('This Google account has no YouTube channel. Sign in with the account that owns it.', 422); return { label: ch.snippet.title, meta: { channel_id: ch.id } }; },
    async sync(c, m, tok) {
      const j = await ytget(c, tok, 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&' + (c.public ? 'id=' + q(c.channel_id) : 'mine=true')); const ch = (j.items || [])[0]; if (!ch) throw bad('No channel found', 404);
      const up = ch.contentDetails.relatedPlaylists.uploads;
      const pl = await ytget(c, tok, `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${q(up)}`);
      const ids = (pl.items || []).map((x) => x.contentDetails.videoId);
      const vs = ids.length ? (await ytget(c, tok, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`)).items || [] : [];
      const med = median(vs.map((v) => v.statistics?.viewCount).filter((v) => v != null).map(num));
      const videos = vs.map((v) => ({ id: v.id, title: clip(v.snippet.title, 120), at: v.snippet.publishedAt, views: v.statistics?.viewCount == null ? null : num(v.statistics.viewCount), likes: v.statistics?.likeCount == null ? null : num(v.statistics.likeCount), comments: v.statistics?.commentCount == null ? null : num(v.statistics.commentCount), thumb: ((v.snippet.thumbnails || {}).medium || {}).url || null, duration: (v.contentDetails || {}).duration || null, x: med ? r2(num(v.statistics?.viewCount) / med) : 0 }));
      let an = null;
      if (!c.public) try { const rr = await gget(tok, `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${isoDay(Date.now() - 28 * DAY)}&endDate=${isoDay(Date.now())}&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration`); const row = (rr.rows || [])[0]; if (row) an = { views: row[0], minutes: row[1], subs_gained: row[2], subs_lost: row[3], avg_view_s: row[4] }; } catch (e) { an = { error: clip(e.message, 160) }; }
      const st = ch.statistics;
      return { mode: c.public ? 'link' : 'google', channel_id: ch.id, channel: { id: ch.id, title: ch.snippet.title, subs: num(st.subscriberCount), views: num(st.viewCount), videos: num(st.videoCount) }, videos, median_views: med, analytics: an,
        ...feed([{ l: 'Subscribers', v: short(st.subscriberCount) }, an && !an.error ? { l: 'Views, 28 days', v: short(an.views) } : { l: 'Total views', v: short(st.viewCount) }, an && !an.error ? { l: 'Watch hours, 28 days', v: short(an.minutes / 60) } : null, { l: 'Median views, last 25', v: short(med) }, { l: 'Outliers', v: String(videos.filter((v) => v.x >= 2).length), s: '2x median or more' }],
          videos.map((v) => ({ t: v.title, s: short(v.views) + ' views · ' + short(v.comments) + ' comments', at: v.at, url: 'https://youtu.be/' + v.id, tag: v.x >= 2 ? v.x.toFixed(1) + 'x' : null }))) };
    },
  },
  gcal: {
    kind: 'google', name: 'Google Calendar',
    help: ['Click Sign in with Google and pick the calendar account you book calls on.', 'Approve read-only calendar access.', 'The next 14 days of events land on Jarvis, Today and Calls, and every external meeting gets a dossier.'],
    async test(c, tok) { const j = await gget(tok, 'https://www.googleapis.com/calendar/v3/calendars/primary').catch((e) => gNeedApi(e, 'Google Calendar API')); return { label: j.summary || j.id, meta: { calendar: j.id, tz: j.timeZone } }; },
    async sync(c, m, tok) {
      const j = await gget(tok, `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=60&timeMin=${q(new Date(Date.now() - 6 * 3600e3).toISOString())}&timeMax=${q(new Date(Date.now() + 14 * DAY).toISOString())}`).catch((e) => gNeedApi(e, 'Google Calendar API'));
      const me = (m && m.calendar) || ''; const dom = me.split('@')[1] || '';
      const events = (j.items || []).filter((e) => e.status !== 'cancelled' && e.start).map((e) => { const at = (e.attendees || []).filter((a) => !a.self && !a.resource).map((a) => a.email); return { title: clip(e.summary, 120) || 'Busy', start: e.start.dateTime || e.start.date, end: (e.end && (e.end.dateTime || e.end.date)) || null, all_day: !e.start.dateTime, attendees: at.slice(0, 8), external: at.some((x) => dom && !x.endsWith('@' + dom)), link: e.hangoutLink || (e.conferenceData && e.conferenceData.entryPoints && (e.conferenceData.entryPoints.find((p) => p.entryPointType === 'video') || {}).uri) || null, url: e.htmlLink }; });
      const t0 = isoDay(Date.now()); const wk = Date.now() + 7 * DAY;
      return { events, ...feed([{ l: 'Today', v: String(events.filter((e) => String(e.start).slice(0, 10) === t0).length) }, { l: 'Next 7 days', v: String(events.filter((e) => Date.parse(e.start) < wk).length) }, { l: 'With outside people', v: String(events.filter((e) => e.external).length), s: 'Get a dossier' }],
        events.map((e) => ({ t: e.title, s: (e.all_day ? 'All day' : new Date(e.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }) + ' ' + hhmm(e.start)) + (e.attendees.length ? ' · ' + e.attendees.slice(0, 3).join(', ') : ''), at: e.start, url: e.url, tag: e.external ? 'External' : null }))) };
    },
  },
  gdrive: {
    kind: 'google', name: 'Google Drive and Docs', fields: [['folder', 'Folder link or ID (optional)', 'https://drive.google.com/drive/folders/…', 'text', true]],
    help: ['Paste the link of the folder that holds your offer docs, scripts and SOPs. Leave it empty to read your most recent docs.', 'Sign in with Google and approve read-only Drive access.', 'Brain reads the docs in that folder, nothing else.'],
    async test(c, tok) { const j = await gget(tok, 'https://www.googleapis.com/drive/v3/about?fields=user').catch((e) => gNeedApi(e, 'Google Drive API')); return { label: (j.user && j.user.emailAddress) || 'Google Drive', meta: { folder: c.folder || null } }; },
    async sync(c, m, tok) {
      const f = c.folder ? String(c.folder).replace(/.*folders\//, '').replace(/[?#].*$/, '') : '';
      const qq = (f ? `'${f}' in parents and ` : '') + "trashed=false and mimeType != 'application/vnd.google-apps.folder'";
      const j = await gget(tok, `https://www.googleapis.com/drive/v3/files?pageSize=30&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)&q=${q(qq)}`).catch((e) => gNeedApi(e, 'Google Drive API'));
      const files = (j.files || []).map((x) => ({ id: x.id, name: clip(x.name, 120), type: x.mimeType.replace('application/vnd.google-apps.', ''), at: x.modifiedTime, url: x.webViewLink }));
      return { files, ...feed([{ l: f ? 'Docs in the folder' : 'Recent docs', v: String(files.length) }, { l: 'Updated this week', v: String(files.filter((x) => Date.now() - Date.parse(x.at) < 7 * DAY).length) }], files.map((x) => ({ t: x.name, s: x.type, at: x.at, url: x.url }))) };
    },
  },
  meet: {
    kind: 'google', name: 'Google Meet',
    help: ['Turn on transcripts in Google Meet. They save to Drive automatically.', 'Sign in with Google and approve read-only Drive access.', 'Call Coach and Memory read the transcripts after each call.'],
    async test(c, tok) { const j = await gget(tok, 'https://www.googleapis.com/drive/v3/about?fields=user').catch((e) => gNeedApi(e, 'Google Drive API')); return { label: (j.user && j.user.emailAddress) || 'Google Meet', meta: {} }; },
    async sync(c, m, tok) {
      const qq = "trashed=false and mimeType='application/vnd.google-apps.document' and (name contains 'Transcript' or name contains 'Notes by Gemini')";
      const j = await gget(tok, `https://www.googleapis.com/drive/v3/files?pageSize=25&orderBy=createdTime desc&fields=files(id,name,createdTime,webViewLink)&q=${q(qq)}`).catch((e) => gNeedApi(e, 'Google Drive API'));
      const files = (j.files || []).map((x) => ({ id: x.id, name: clip(x.name, 140), at: x.createdTime, url: x.webViewLink }));
      return { transcripts: files, ...feed([{ l: 'Transcripts found', v: String(files.length) }, { l: 'Last 7 days', v: String(files.filter((x) => Date.now() - Date.parse(x.at) < 7 * DAY).length) }], files.map((x) => ({ t: x.name, s: 'Meet transcript', at: x.at, url: x.url }))) };
    },
  },
  ga4: {
    kind: 'google', name: 'Google Analytics 4', fields: [['property', 'Property ID (optional)', '123456789', 'text', true]],
    help: ['Find the property ID in GA4 under Admin, Property details. Leave it empty to use your first property.', 'Sign in with Google and approve read-only Analytics access.', 'Funnels read sessions, key events and top pages for the last 28 days.'],
    async test(c, tok) {
      let prop = String(c.property || '').replace(/\D/g, ''); let name = '';
      if (!prop) { const j = await gget(tok, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50').catch((e) => gNeedApi(e, 'Google Analytics Admin API')); const ps = (j.accountSummaries || []).flatMap((a) => a.propertySummaries || []); if (!ps.length) throw bad('No GA4 property found on this Google account.', 422); prop = ps[0].property.split('/')[1]; name = ps[0].displayName; }
      c.property = prop; return { label: name || 'GA4 property ' + prop, meta: { property: prop } };
    },
    async sync(c, m, tok) {
      const prop = c.property || (m && m.property); const url = `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`;
      const tot = await gget(tok, url, { method: 'POST', body: { dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }, { startDate: '56daysAgo', endDate: '29daysAgo' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }] } }).catch((e) => gNeedApi(e, 'Google Analytics Data API'));
      const pages = await gget(tok, url, { method: 'POST', body: { dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'keyEvents' }], limit: 15, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] } });
      const rows = tot.rows || []; const cur = rows.find((r) => (r.dimensionValues || []).some((d) => d.value === 'date_range_0')) || rows[0]; const prev = rows.find((r) => (r.dimensionValues || []).some((d) => d.value === 'date_range_1'));
      const v = (r, i) => (r ? num(r.metricValues[i].value) : 0);
      const list = (pages.rows || []).map((r) => ({ path: r.dimensionValues[0].value, views: num(r.metricValues[0].value), conv: num(r.metricValues[1].value) }));
      return { ga: { sessions: v(cur, 0), users: v(cur, 1), key_events: v(cur, 2), prev_sessions: v(prev, 0), pages: list }, ...feed([{ l: 'Sessions, 28 days', v: short(v(cur, 0)), s: prev ? (v(cur, 0) >= v(prev, 0) ? 'Up ' : 'Down ') + short(Math.abs(v(cur, 0) - v(prev, 0))) : '' }, { l: 'Users', v: short(v(cur, 1)) }, { l: 'Key events', v: short(v(cur, 2)) }], list.map((p) => ({ t: p.path, s: short(p.views) + ' views · ' + short(p.conv) + ' key events' }))) };
    },
  },
  gsc: {
    kind: 'google', name: 'Search Console', fields: [['site', 'Site (optional)', 'sc-domain:example.com or https://example.com/', 'text', true]],
    help: ['Leave Site empty to use the first verified property on the account.', 'Sign in with Google and approve read-only Search Console access.', 'Trend Watcher reads the top search queries for the last 28 days.'],
    async test(c, tok) {
      let site = String(c.site || '').trim();
      if (!site) { const j = await gget(tok, 'https://www.googleapis.com/webmasters/v3/sites').catch((e) => gNeedApi(e, 'Search Console API')); const s = (j.siteEntry || []).find((x) => x.permissionLevel !== 'siteUnverifiedUser'); if (!s) throw bad('No verified Search Console property on this Google account.', 422); site = s.siteUrl; }
      c.site = site; return { label: site, meta: { site } };
    },
    async sync(c, m, tok) {
      const site = c.site || (m && m.site);
      const j = await gget(tok, `https://www.googleapis.com/webmasters/v3/sites/${q(site)}/searchAnalytics/query`, { method: 'POST', body: { startDate: isoDay(Date.now() - 30 * DAY), endDate: isoDay(Date.now() - 2 * DAY), dimensions: ['query'], rowLimit: 20 } }).catch((e) => gNeedApi(e, 'Search Console API'));
      const rows = (j.rows || []).map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      const clicks = rows.reduce((s, r) => s + r.clicks, 0); const imp = rows.reduce((s, r) => s + r.impressions, 0);
      return { queries: rows, ...feed([{ l: 'Clicks, top 20 queries', v: short(clicks) }, { l: 'Impressions', v: short(imp) }, { l: 'Queries tracked', v: String(rows.length) }], rows.map((r) => ({ t: r.query, s: short(r.clicks) + ' clicks · ' + short(r.impressions) + ' impressions · position ' + r.position.toFixed(1) }))) };
    },
  },
  'google-ads': {
    kind: 'google', name: 'Google Ads', fields: [['developer_token', 'Developer token', 'From Google Ads, Tools, API Center', 'secret'], ['customer_id', 'Customer ID', '123-456-7890', 'text'], ['login_customer_id', 'Manager account ID (optional)', 'Only if you sign in through a manager account', 'text', true]],
    help: ['In Google Ads, open Tools, API Center and copy your developer token.', 'Add the customer ID of the ads account, and your manager account ID if you use one.', 'Sign in with Google and approve read-only Ads access. Spend and conversions per campaign show on Funnels.'],
    async test(c, tok) { const j = await gAds(c, tok, 'SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1'); const r = (j.results || [])[0] || {}; return { label: (r.customer && r.customer.descriptiveName) || 'Google Ads ' + c.customer_id, meta: { currency: r.customer && r.customer.currencyCode } }; },
    async sync(c, m, tok) {
      const j = await gAds(c, tok, 'SELECT campaign.name, metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions FROM campaign WHERE segments.date DURING LAST_30_DAYS ORDER BY metrics.cost_micros DESC LIMIT 15');
      const cur = (m && m.currency) || 'USD'; const rows = (j.results || []).map((r) => ({ name: r.campaign.name, spend: num(r.metrics.costMicros) / 1e6, conv: num(r.metrics.conversions), clicks: num(r.metrics.clicks), imp: num(r.metrics.impressions) }));
      const spend = rows.reduce((s, r) => s + r.spend, 0); const conv = rows.reduce((s, r) => s + r.conv, 0);
      return { ads: { spend: r2(spend), conversions: conv, currency: cur, campaigns: rows }, ...feed([{ l: 'Spend, 30 days', v: money(spend, cur) }, { l: 'Conversions', v: short(conv) }, { l: 'Cost per conversion', v: conv ? money(spend / conv, cur) : 'None yet' }], rows.map((r) => ({ t: r.name, s: money(r.spend, cur) + ' · ' + short(r.conv) + ' conversions · ' + short(r.clicks) + ' clicks' }))) };
    },
  },
  instagram: {
    kind: 'key', name: 'Instagram', fields: [['token', 'Access token (optional)', 'Leave empty to read Instagram through HighLevel', 'secret', true], ['ig_user_id', 'Instagram account ID (optional)', 'Found automatically', 'text', true]],
    help: ['If your Instagram is connected to Social Planner in HighLevel, leave both fields empty and press Connect. The OS reads reach, impressions, engagement, new followers and audience from HighLevel.', 'With Apify connected, the OS also reads your follower count and latest posts from your public profile.', 'Prefer Meta directly? Paste a long-lived Instagram Graph API token from Meta for Developers instead.'],
    async test(c, ctx = {}) {
      if (!String(c.token || '').trim()) {
        if (!ctx.hl) throw bad('Connect HighLevel first, or paste a Meta token. Instagram is read through HighLevel Social Planner.', 409);
        const a = await hlIgAccount(ctx.hl, c.account_id);
        c.via = 'highlevel'; c.account_id = a.profileId; c.username = a.name; delete c.token; delete c.ig_user_id;
        return { label: '@' + a.name + ' · through HighLevel', meta: { via: 'highlevel', username: a.name, avatar: a.avatar || null } };
      }
      let id = String(c.ig_user_id || '').trim();
      if (!id) { const j = await jf('Meta', `${META}/me/accounts?fields=name,instagram_business_account&access_token=${q(c.token)}`); const pg = (j.data || []).find((x) => x.instagram_business_account); if (!pg) throw bad('No Instagram business account is linked to a Page this token can see. Add the account ID by hand.', 422); id = pg.instagram_business_account.id; }
      const u = await jf('Meta', `${META}/${id}?fields=username,followers_count,media_count&access_token=${q(c.token)}`); c.ig_user_id = id; return { label: '@' + u.username, meta: { ig_user_id: id } };
    },
    async sync(c, m, tok, ctx = {}) {
      if (c.via === 'highlevel') return igViaHighLevel(c, ctx);
      const u = await jf('Meta', `${META}/${c.ig_user_id}?fields=username,followers_count,media_count&access_token=${q(c.token)}`);
      const md = await jf('Meta', `${META}/${c.ig_user_id}/media?fields=caption,like_count,comments_count,timestamp,permalink,media_type&limit=20&access_token=${q(c.token)}`);
      const posts = (md.data || []).map((p) => ({ t: clip(p.caption, 90) || p.media_type, likes: num(p.like_count), comments: num(p.comments_count), at: p.timestamp, url: p.permalink, type: p.media_type }));
      return { profile: { username: u.username, followers: num(u.followers_count), posts: num(u.media_count) }, ...feed([{ l: 'Followers', v: short(u.followers_count) }, { l: 'Posts', v: short(u.media_count) }, { l: 'Average likes, last 20', v: short(posts.length ? posts.reduce((s, p) => s + p.likes, 0) / posts.length : 0) }], posts.map((p) => ({ t: p.t, s: short(p.likes) + ' likes · ' + short(p.comments) + ' comments', at: p.at, url: p.url, tag: p.type === 'VIDEO' ? 'Reel' : null }))) };
    },
  },
  linkedin: {
    kind: 'key', name: 'LinkedIn', fields: [['token', 'Access token', 'From the LinkedIn developer token generator', 'secret']],
    help: ['Create an app at linkedin.com/developers and add Sign In with LinkedIn using OpenID Connect.', 'Use the OAuth token generator in the app to create a token with openid and profile, and paste it here.', 'Follower and post analytics need LinkedIn Community Management access on the app. The OS reads them when the token has it.'],
    async test(c) { const u = await jf('LinkedIn', 'https://api.linkedin.com/v2/userinfo', { headers: bearer(c.token) }); return { label: u.name || u.email || 'LinkedIn', meta: { name: u.name } }; },
    async sync(c, m) {
      const u = await jf('LinkedIn', 'https://api.linkedin.com/v2/userinfo', { headers: bearer(c.token) });
      let followers = null; try { const f = await jf('LinkedIn', 'https://api.linkedin.com/rest/memberFollowersCount?q=me', { headers: { ...bearer(c.token), 'LinkedIn-Version': process.env.LINKEDIN_VERSION || '202510', 'X-Restli-Protocol-Version': '2.0.0' } }); followers = f.elements && f.elements[0] ? f.elements[0].memberFollowersCount : null; } catch { followers = null; }
      return { profile: { name: u.name, followers }, ...feed([{ l: 'Profile', v: clip(u.name, 30) || 'Connected' }, { l: 'Followers', v: followers == null ? 'Needs analytics access' : short(followers) }], []) };
    },
  },
  x: {
    kind: 'key', name: 'X', fields: [['token', 'Bearer token', 'From the X developer portal, Keys and tokens', 'secret'], ['username', 'Your handle', 'yourhandle', 'text']],
    help: ['In the X developer portal, open your app, Keys and tokens, and copy the Bearer token.', 'Add your handle without the @.', 'Followers and recent post metrics show on Brand. Recent posts need the Basic API tier or higher.'],
    async test(c) { const u = await jf('X', `https://api.x.com/2/users/by/username/${q(String(c.username).replace(/^@/, ''))}?user.fields=public_metrics`, { headers: bearer(c.token) }); if (!u.data) throw bad('X could not find that handle.', 404); c.user_id = u.data.id; return { label: '@' + u.data.username, meta: { user_id: u.data.id } }; },
    async sync(c) {
      const u = await jf('X', `https://api.x.com/2/users/by/username/${q(String(c.username).replace(/^@/, ''))}?user.fields=public_metrics`, { headers: bearer(c.token) }); const pm = (u.data && u.data.public_metrics) || {};
      let posts = []; let note = null; try { const t = await jf('X', `https://api.x.com/2/users/${u.data.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at`, { headers: bearer(c.token) }); posts = (t.data || []).map((p) => ({ t: clip(p.text, 100), s: short(p.public_metrics.impression_count || 0) + ' views · ' + short(p.public_metrics.like_count) + ' likes · ' + short(p.public_metrics.reply_count) + ' replies', at: p.created_at, url: `https://x.com/${u.data.username}/status/${p.id}` })); } catch (e) { note = 'Recent posts need a paid X API tier.'; }
      return { profile: { followers: pm.followers_count, posts: pm.tweet_count }, note, ...feed([{ l: 'Followers', v: short(pm.followers_count) }, { l: 'Posts', v: short(pm.tweet_count) }, { l: 'Following', v: short(pm.following_count) }], posts) };
    },
  },
  tiktok: {
    kind: 'key', name: 'TikTok', fields: [['token', 'User access token', 'From TikTok for Developers with user.info.stats and video.list', 'secret']],
    help: ['Create an app at developers.tiktok.com with Login Kit and the scopes user.info.basic, user.info.stats and video.list.', 'Authorise your own account and paste the user access token here.', 'Followers, likes and views per video show on Brand. Tokens last 24 hours unless you add the refresh token flow in your app.'],
    async test(c) { const j = await jf('TikTok', 'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count', { headers: bearer(c.token) }); const u = j.data && j.data.user; if (!u) throw bad('TikTok returned no profile for this token.', 422); return { label: u.display_name, meta: {} }; },
    async sync(c) {
      const j = await jf('TikTok', 'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count', { headers: bearer(c.token) }); const u = j.data.user;
      let vids = []; try { const v = await jf('TikTok', 'https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,comment_count,create_time,share_url', { method: 'POST', headers: { ...bearer(c.token), 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20 }) }); vids = ((v.data && v.data.videos) || []).map((x) => ({ t: clip(x.title, 100) || 'Video', s: short(x.view_count) + ' views · ' + short(x.like_count) + ' likes', at: new Date(x.create_time * 1000).toISOString(), url: x.share_url })); } catch { vids = []; }
      return { profile: { followers: u.follower_count, likes: u.likes_count, videos: u.video_count }, ...feed([{ l: 'Followers', v: short(u.follower_count) }, { l: 'Likes', v: short(u.likes_count) }, { l: 'Videos', v: short(u.video_count) }], vids) };
    },
  },
  notion: {
    kind: 'key', name: 'Notion', fields: [['token', 'Internal integration secret', 'ntn_…', 'secret']],
    help: ['Go to notion.so/profile/integrations and create an internal integration with read content access.', 'Copy the secret and paste it here.', 'In Notion, open each page or database you want Brain to read, then Connections, and add the integration.'],
    async test(c) { const j = await jf('Notion', 'https://api.notion.com/v1/users/me', { headers: { ...bearer(c.token), 'Notion-Version': '2022-06-28' } }); return { label: (j.bot && j.bot.workspace_name) || j.name || 'Notion', meta: {} }; },
    async sync(c) {
      const j = await jf('Notion', 'https://api.notion.com/v1/search', { method: 'POST', headers: { ...bearer(c.token), 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ page_size: 25, sort: { direction: 'descending', timestamp: 'last_edited_time' } }) });
      const title = (p) => { const props = p.properties || {}; const t = Object.values(props).find((x) => x.type === 'title'); return (t && t.title && t.title.map((x) => x.plain_text).join('')) || (p.title && p.title.map((x) => x.plain_text).join('')) || 'Untitled'; };
      const pages = (j.results || []).map((p) => ({ t: clip(title(p), 120), s: p.object === 'database' ? 'Database' : 'Page', at: p.last_edited_time, url: p.url }));
      return { pages, ...feed([{ l: 'Pages shared with the OS', v: String(pages.length) }, { l: 'Edited this week', v: String(pages.filter((p) => Date.now() - Date.parse(p.at) < 7 * DAY).length) }], pages) };
    },
  },
  slack: {
    kind: 'key', name: 'Slack', fields: [['token', 'Bot token', 'xoxb-…', 'secret'], ['channel', 'Channel ID', 'C0123ABCD', 'text']],
    help: ['Create a Slack app at api.slack.com/apps, add the chat:write and channels:read bot scopes and install it to your workspace.', 'Copy the Bot User OAuth Token, then invite the bot to the channel you want the brief in.', 'Paste the channel ID. Find it in the channel details, at the bottom.'],
    async test(c) {
      const sl = async (m, body) => { const j = await jf('Slack', 'https://slack.com/api/' + m, { method: 'POST', headers: { ...bearer(c.token), 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body || {}) }); if (!j.ok) throw bad('Slack: ' + j.error, 422); return j; };
      const a = await sl('auth.test'); const ch = await sl('conversations.info', { channel: c.channel }); return { label: a.team + ' · #' + ch.channel.name, meta: { team: a.team, channel_name: ch.channel.name } };
    },
    async sync(c, m) { return feed([{ l: 'Workspace', v: (m && m.team) || 'Slack' }, { l: 'Brief channel', v: '#' + ((m && m.channel_name) || c.channel) }, { l: 'Last brief', v: m && m.last_sent_at ? isoDay(m.last_sent_at) : 'Not sent yet' }], []); },
    async send(c, text) { const j = await jf('Slack', 'https://slack.com/api/chat.postMessage', { method: 'POST', headers: { ...bearer(c.token), 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: c.channel, text }) }); if (!j.ok) throw bad('Slack: ' + j.error, 422); },
  },
  zoom: {
    kind: 'key', name: 'Zoom', fields: [['account_id', 'Account ID', '', 'text'], ['client_id', 'Client ID', '', 'text'], ['client_secret', 'Client secret', '', 'secret']],
    help: ['In the Zoom App Marketplace, choose Develop, Build App, Server-to-Server OAuth.', 'Add the scopes cloud_recording:read:list_user_recordings:admin, meeting:read:list_meetings:admin and user:read:user:admin, then activate the app.', 'Paste the account ID, client ID and secret here.'],
    async test(c) { const tok = await zoomToken(c); const u = await jf('Zoom', 'https://api.zoom.us/v2/users/me', { headers: bearer(tok) }); return { label: u.email || 'Zoom', meta: {} }; },
    async sync(c) {
      const tok = await zoomToken(c);
      const rec = await jf('Zoom', `https://api.zoom.us/v2/users/me/recordings?page_size=30&from=${isoDay(Date.now() - 30 * DAY)}&to=${isoDay(Date.now())}`, { headers: bearer(tok) });
      let up = { meetings: [] }; try { up = await jf('Zoom', 'https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=20', { headers: bearer(tok) }); } catch { /* scope may be missing */ }
      const recs = (rec.meetings || []).map((x) => ({ t: clip(x.topic, 120) || 'Zoom call', start: x.start_time, minutes: x.duration, transcript: (x.recording_files || []).some((f) => f.file_type === 'TRANSCRIPT'), url: x.share_url }));
      return { recordings: recs, upcoming: (up.meetings || []).map((x) => ({ title: x.topic, start: x.start_time, minutes: x.duration, url: x.join_url })), ...feed([{ l: 'Recordings, 30 days', v: String(recs.length) }, { l: 'With transcript', v: String(recs.filter((r) => r.transcript).length) }, { l: 'Upcoming meetings', v: String((up.meetings || []).length) }], recs.map((r) => ({ t: r.t, s: r.minutes + ' min' + (r.transcript ? ' · transcript ready' : ''), at: r.start, url: r.url, tag: r.transcript ? 'Transcript' : null }))) };
    },
  },
  fathom: {
    kind: 'key', name: 'Fathom', fields: [['key', 'API key', 'From Fathom, Settings, API Access', 'secret']],
    help: ['In Fathom, open User Settings, API Access and generate a key.', 'Paste it here.', 'Call summaries and action items flow into Calls and Memory.'],
    async test(c) { await jf('Fathom', 'https://api.fathom.ai/external/v1/meetings', { headers: { 'X-Api-Key': c.key } }); return { label: 'Fathom', meta: {} }; },
    async sync(c) {
      const j = await jf('Fathom', `https://api.fathom.ai/external/v1/meetings?include_action_items=true&created_after=${q(new Date(Date.now() - 30 * DAY).toISOString())}`, { headers: { 'X-Api-Key': c.key } });
      const ms = (j.items || []).map((x) => ({ t: clip(x.title || x.meeting_title, 120) || 'Call', at: x.recording_start_time || x.created_at, url: x.share_url || x.url, actions: (x.action_items || []).length, people: (x.calendar_invitees || []).filter((p) => p.is_external).map((p) => p.name || p.email).slice(0, 3) }));
      return { meetings: ms, ...feed([{ l: 'Calls, 30 days', v: String(ms.length) }, { l: 'Action items', v: String(ms.reduce((s, x) => s + x.actions, 0)) }], ms.map((x) => ({ t: x.t, s: [x.people.join(', '), x.actions ? x.actions + ' action items' : ''].filter(Boolean).join(' · '), at: x.at, url: x.url }))) };
    },
  },
  granola: {
    kind: 'key', name: 'Granola', fields: [['key', 'API key', 'grn_…', 'secret']],
    help: ['Open the Granola desktop app, Settings, Connectors, API keys. The API needs a Business or Enterprise plan.', 'Create a key with Personal notes access and paste it here.', 'Meeting notes and summaries flow into Memory and Calls.'],
    async test(c) { await jf('Granola', 'https://public-api.granola.ai/v1/notes?page_size=1', { headers: bearer(c.key) }); return { label: 'Granola', meta: {} }; },
    async sync(c) {
      const j = await jf('Granola', `https://public-api.granola.ai/v1/notes?page_size=25&created_after=${q(new Date(Date.now() - 30 * DAY).toISOString())}`, { headers: bearer(c.key) });
      const notes = (j.notes || []).map((n) => ({ t: clip(n.title, 120) || 'Meeting', at: n.created_at || n.meeting_at, url: n.web_url || n.url || null }));
      return { notes, ...feed([{ l: 'Notes, 30 days', v: String(notes.length) }], notes.map((n) => ({ t: n.t, s: 'Granola note', at: n.at, url: n.url }))) };
    },
  },
  stripe: {
    kind: 'key', name: 'Stripe', fields: [['key', 'Restricted key', 'rk_live_…', 'secret']],
    help: ['In Stripe, open Developers, API keys and create a restricted key.', 'Give it read access to Charges, Balance and Disputes. Everything else can stay None.', 'Paste it here. Payments outside HighLevel join the Revenue page.'],
    async test(c) { if (!/^(rk|sk)_(live|test)_/.test(c.key)) throw bad('Paste a Stripe restricted key. It starts with rk_live_.'); const b = await jf('Stripe', 'https://api.stripe.com/v1/balance', { headers: bearer(c.key) }); return { label: 'Stripe ' + (b.livemode ? 'live' : 'test') + ' · key ending ' + c.key.slice(-4), meta: { livemode: b.livemode } }; },
    async sync(c) {
      const since = Math.floor((Date.now() - 90 * DAY) / 1000); let all = []; let after = null;
      for (let i = 0; i < 6; i++) { const j = await jf('Stripe', `https://api.stripe.com/v1/charges?limit=100&created[gte]=${since}${after ? '&starting_after=' + after : ''}`, { headers: bearer(c.key) }); all = all.concat(j.data || []); if (!j.has_more) break; after = j.data[j.data.length - 1].id; }
      const ok = all.filter((x) => x.paid && x.status === 'succeeded');
      const cnt = ok.reduce((m, x) => ((m[x.currency] = (m[x.currency] || 0) + 1), m), {}); const cur = (Object.entries(cnt).sort((a, b) => b[1] - a[1])[0] || ['usd'])[0];
      const mine = ok.filter((x) => x.currency === cur); const amt = (x) => (x.amount - (x.amount_refunded || 0)) / 100;
      const inD = (x, a, z) => x.created * 1000 >= Date.now() - a * DAY && x.created * 1000 < Date.now() - z * DAY;
      let disputes = 0; try { const d = await jf('Stripe', 'https://api.stripe.com/v1/disputes?limit=20', { headers: bearer(c.key) }); disputes = (d.data || []).filter((x) => !/won|lost/.test(x.status)).length; } catch { disputes = null; }
      const C = cur.toUpperCase(); const sum = (l) => r2(l.reduce((s, x) => s + amt(x), 0));
      const months = {}; mine.forEach((x) => { const k = new Date(x.created * 1000).toISOString().slice(0, 7); months[k] = r2((months[k] || 0) + amt(x)); });
      const rev = { currency: C, last30: sum(mine.filter((x) => inD(x, 30, 0))), prev30: sum(mine.filter((x) => inD(x, 60, 30))), count30: mine.filter((x) => inD(x, 30, 0)).length, refunds30: r2(mine.filter((x) => inD(x, 30, 0)).reduce((s, x) => s + (x.amount_refunded || 0) / 100, 0)), disputes, byMonth: months,
        recent: mine.slice(0, 12).map((x) => ({ at: new Date(x.created * 1000).toISOString(), name: (x.billing_details && (x.billing_details.name || x.billing_details.email)) || x.receipt_email || 'Customer', amount: amt(x), desc: clip(x.description, 80) })) };
      return { revenue: rev, ...feed([{ l: 'Last 30 days', v: money(rev.last30, C), s: (rev.last30 >= rev.prev30 ? 'Up ' : 'Down ') + money(Math.abs(rev.last30 - rev.prev30), C) }, { l: 'Payments', v: String(rev.count30) }, { l: 'Refunded', v: money(rev.refunds30, C) }, { l: 'Open disputes', v: disputes == null ? 'No access' : String(disputes) }], rev.recent.map((x) => ({ t: x.name, s: money(x.amount, C) + (x.desc ? ' · ' + x.desc : ''), at: x.at }))) };
    },
  },
  paypal: {
    kind: 'key', name: 'PayPal', fields: [['client_id', 'Client ID', '', 'text'], ['client_secret', 'Secret', '', 'secret'], ['mode', 'Mode', 'live', 'select:live,sandbox']],
    help: ['At developer.paypal.com, open Apps and Credentials, Live, and create an app.', 'Under the app features, tick Transaction search.', 'Paste the client ID and secret here. It can take a few hours after enabling Transaction search before PayPal returns data.'],
    async test(c) { await paypalToken(c); return { label: 'PayPal ' + (c.mode === 'sandbox' ? 'sandbox' : 'live') + ' · ' + String(c.client_id).slice(0, 6), meta: { mode: c.mode || 'live' } }; },
    async sync(c) {
      const { tok, base } = await paypalToken(c);
      const get = (a, z) => jf('PayPal', `${base}/v1/reporting/transactions?start_date=${new Date(Date.now() - a * DAY).toISOString().slice(0, 19)}Z&end_date=${new Date(Date.now() - z * DAY).toISOString().slice(0, 19)}Z&fields=transaction_info,payer_info&page_size=200`, { headers: bearer(tok) });
      const [cur, prev] = await Promise.all([get(30, 0), get(60, 30).catch(() => ({ transaction_details: [] }))]);
      const pick = (j) => (j.transaction_details || []).filter((t) => /^T00/.test(t.transaction_info.transaction_event_code) && num(t.transaction_info.transaction_amount.value) > 0);
      const a = pick(cur), b = pick(prev); const C = (a[0] && a[0].transaction_info.transaction_amount.currency_code) || 'USD';
      const sum = (l) => r2(l.filter((t) => t.transaction_info.transaction_amount.currency_code === C).reduce((s, t) => s + num(t.transaction_info.transaction_amount.value), 0));
      const rev = { currency: C, last30: sum(a), prev30: sum(b), count30: a.length, recent: a.slice(-12).reverse().map((t) => ({ at: t.transaction_info.transaction_initiation_date, name: (t.payer_info && t.payer_info.payer_name && (t.payer_info.payer_name.alternate_full_name || t.payer_info.payer_name.given_name)) || (t.payer_info && t.payer_info.email_address) || 'Customer', amount: num(t.transaction_info.transaction_amount.value) })) };
      return { revenue: rev, ...feed([{ l: 'Last 30 days', v: money(rev.last30, C) }, { l: 'Payments', v: String(rev.count30) }], rev.recent.map((x) => ({ t: x.name, s: money(x.amount, C), at: x.at }))) };
    },
  },
  affiliate: {
    kind: 'csv', name: 'Affiliate dashboards',
    help: ['In the HighLevel affiliate portal, export Referrals or Commissions as CSV. Either works, and both together give the full picture.', 'Drop the file here. The OS works out which export it is and builds the Affiliate dashboard from it.', 'Upload a fresh export any time. Totals per SubID show on Revenue next to the videos that drove them.'],
    async test(c) { return { label: 'Commission export', meta: {} }; },
    async sync(c, m) { return { ...(m && m.aff ? feed(m.aff.metrics, m.aff.items) : feed([{ l: 'Rows', v: '0' }], [])) }; },
  },
  bank: {
    kind: 'bank', name: 'Bank feed', fields: [['app_id', 'Enable Banking application ID', '', 'text'], ['private_key', 'Private key (.pem)', '-----BEGIN PRIVATE KEY-----', 'textarea'], ['bank', 'Bank name', 'Your bank, as Enable Banking lists it', 'text'], ['country', 'Country code', 'Two letters, for example GB', 'text']],
    help: ['Create a free account at enablebanking.com and register an application. Add ' + APP_URL + '/api/connect?oauth=bank as the redirect URL.', 'Download the private key when you create the app, then link your own accounts in the control panel to activate it.', 'Paste the application ID and key here, pick your bank, and approve read-only access at the bank. Consent lasts up to 180 days.'],
    async test(c) { await eb(c, '/application'); if (!/^[A-Za-z]{2}$/.test(String(c.country || '').trim())) throw L.bad('Add the two letter country code of your bank, for example GB or DE, then test again.'); return { label: c.bank + ' · ' + String(c.country).trim().toUpperCase(), meta: {} }; },
    async sync(c) {
      if (!c.accounts || !c.accounts.length) throw bad('Finish the bank approval first.', 409);
      const out = [];
      for (const a of c.accounts.slice(0, 6)) {
        const bal = await eb(c, `/accounts/${a.uid}/balances`).catch(() => ({ balances: [] }));
        const tx = await eb(c, `/accounts/${a.uid}/transactions?date_from=${isoDay(Date.now() - 30 * DAY)}`).catch(() => ({ transactions: [] }));
        const b0 = (bal.balances || []).find((x) => /CLAV|ITAV|XPCD|CLBD/.test(x.balance_type)) || (bal.balances || [])[0];
        const t = (tx.transactions || []).map((x) => ({ at: x.booking_date || x.value_date, amount: num(x.transaction_amount && x.transaction_amount.amount) * (x.credit_debit_indicator === 'DBIT' ? -1 : 1), cur: x.transaction_amount && x.transaction_amount.currency, who: clip((x.creditor && x.creditor.name) || (x.debtor && x.debtor.name) || (x.remittance_information || []).join(' '), 80) }));
        out.push({ name: a.name || a.iban || 'Account', balance: b0 ? num(b0.balance_amount.amount) : null, cur: b0 ? b0.balance_amount.currency : (t[0] && t[0].cur) || 'EUR', tx: t });
      }
      const C = (out[0] && out[0].cur) || 'EUR'; const tx = out.flatMap((a) => a.tx); const inn = tx.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0); const outv = tx.filter((x) => x.amount < 0).reduce((s, x) => s - x.amount, 0);
      return { bankdata: { currency: C, balance: r2(out.reduce((s, a) => s + (a.balance || 0), 0)), in30: r2(inn), out30: r2(outv), accounts: out.map((a) => ({ name: a.name, balance: a.balance, cur: a.cur })) }, ...feed([{ l: 'Balance', v: money(out.reduce((s, a) => s + (a.balance || 0), 0), C) }, { l: 'In, 30 days', v: money(inn, C) }, { l: 'Out, 30 days', v: money(outv, C) }], tx.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20).map((x) => ({ t: x.who || 'Transaction', s: money(x.amount, x.cur || C), at: x.at }))) };
    },
  },
  accounting: {
    kind: 'oauth', name: 'Accounting', fields: [['client_id', 'Xero client ID', '', 'text'], ['client_secret', 'Xero client secret', '', 'secret']],
    help: ['At developer.xero.com, create a Web app. Set the redirect URI to ' + APP_URL + '/api/connect?oauth=xero.', 'Paste the client ID and secret here, then sign in to Xero and pick your organisation.', 'Profit and loss for this month and last, plus unpaid invoices, show in the money review.'],
    authUrl(c, state) { return 'https://login.xero.com/identity/connect/authorize?' + new URLSearchParams({ response_type: 'code', client_id: c.client_id, redirect_uri: APP_URL + '/api/connect?oauth=xero', scope: XERO_SCOPES, state }); },
    async finish(c, code) {
      const j = await jf('Xero', 'https://identity.xero.com/connect/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.client_id + ':' + c.client_secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: APP_URL + '/api/connect?oauth=xero' }) });
      c.refresh_token = j.refresh_token; const cons = await jf('Xero', 'https://api.xero.com/connections', { headers: bearer(j.access_token) }); const t = cons[0]; if (!t) throw bad('No Xero organisation was shared. Try again and pick one.', 422);
      c.tenant_id = t.tenantId; return { label: t.tenantName, meta: { tenant: t.tenantName } };
    },
    async sync(c) {
      const tok = await xeroRefresh(c); const H = { ...bearer(tok), 'xero-tenant-id': c.tenant_id, Accept: 'application/json' };
      const now = new Date(); const m0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const m1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const pl = async (a, z) => { const j = await jf('Xero', `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${isoDay(a)}&toDate=${isoDay(z)}`, { headers: H }); const rows = ((j.Reports || [])[0] || {}).Rows || []; const find = (rx) => { for (const s of rows) for (const r of s.Rows || []) { const c0 = (r.Cells || [])[0]; if (c0 && rx.test(c0.Value || '')) return num(((r.Cells || [])[1] || {}).Value); } return 0; }; return { income: find(/^Total (Income|Trading Income|Revenue)/i), expenses: find(/^Total (Operating )?Expenses/i), net: find(/^Net Profit/i) }; };
      const [cur, prev] = await Promise.all([pl(m0, now), pl(m1, new Date(m0.getTime() - DAY))]);
      let due = 0, n = 0; try { const inv = await jf('Xero', 'https://api.xero.com/api.xro/2.0/Invoices?Statuses=AUTHORISED&where=' + q('Type=="ACCREC"') + '&summaryOnly=true', { headers: H }); (inv.Invoices || []).forEach((x) => { due += num(x.AmountDue); n++; }); } catch { /* scope may be missing */ }
      return { books: { this_month: cur, last_month: prev, unpaid: r2(due), unpaid_count: n }, ...feed([{ l: 'Income this month', v: short(cur.income) }, { l: 'Expenses this month', v: short(cur.expenses) }, { l: 'Net last month', v: short(prev.net) }, { l: 'Unpaid invoices', v: n + ' · ' + short(due) }], []) };
    },
  },
  'meta-ads': {
    kind: 'key', name: 'Meta Ads', fields: [['token', 'Access token', 'System user token with ads_read', 'secret'], ['ad_account', 'Ad account ID', 'act_1234567890', 'text']],
    help: ['In Meta Business Settings, create a system user, give it access to the ad account and generate a token with ads_read.', 'Copy the ad account ID from Ads Manager. It starts with act_.', 'Spend, cost per lead and the best creatives show on Funnels. The OS never changes ads.'],
    async test(c) { const id = /^act_/.test(c.ad_account) ? c.ad_account : 'act_' + String(c.ad_account).replace(/\D/g, ''); c.ad_account = id; const j = await jf('Meta', `${META}/${id}?fields=name,currency,account_status&access_token=${q(c.token)}`); return { label: j.name, meta: { currency: j.currency } }; },
    async sync(c, m) {
      const cur = (m && m.currency) || 'USD';
      const ins = await jf('Meta', `${META}/${c.ad_account}/insights?date_preset=last_30d&fields=spend,impressions,clicks,actions&access_token=${q(c.token)}`);
      const camp = await jf('Meta', `${META}/${c.ad_account}/insights?date_preset=last_30d&level=campaign&fields=campaign_name,spend,actions,clicks&limit=15&sort=spend_descending&access_token=${q(c.token)}`).catch(() => ({ data: [] }));
      const leadsOf = (r) => ((r && r.actions) || []).filter((a) => /lead/.test(a.action_type)).reduce((s, a) => Math.max(s, num(a.value)), 0);
      const t = (ins.data || [])[0] || {}; const spend = num(t.spend); const leads = leadsOf(t);
      const rows = (camp.data || []).map((r) => ({ name: r.campaign_name, spend: num(r.spend), leads: leadsOf(r), clicks: num(r.clicks) }));
      return { ads: { spend, leads, currency: cur, campaigns: rows }, ...feed([{ l: 'Spend, 30 days', v: money(spend, cur) }, { l: 'Leads', v: short(leads) }, { l: 'Cost per lead', v: leads ? money(spend / leads, cur) : 'None yet' }, { l: 'Clicks', v: short(t.clicks) }], rows.map((r) => ({ t: r.name, s: money(r.spend, cur) + ' · ' + r.leads + ' leads' + (r.leads ? ' · ' + money(r.spend / r.leads, cur) + ' each' : '') }))) };
    },
  },
  perplexity: {
    kind: 'key', name: 'Perplexity', fields: [['key', 'API key', 'pplx-…', 'secret']],
    help: ['At perplexity.ai/account/api, create an API key and add credit.', 'Paste it here.', 'One key runs AI Chat on Claude, GPT, Gemini and Grok, with live web research, image search and web watches that drop new findings into your Newsfeed. You pay Perplexity directly for what you use.'],
    async test(c) { await jf('Perplexity', 'https://api.perplexity.ai/chat/completions', { method: 'POST', headers: { ...bearer(c.key), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sonar', max_tokens: 5, messages: [{ role: 'user', content: 'Reply with OK.' }] }) }); return { label: 'Perplexity key ending ' + c.key.slice(-4), meta: {} }; },
    async sync(c, m) { return feed([{ l: 'Status', v: 'Ready' }, { l: 'Questions asked', v: String((m && m.asked) || 0) }], []); },
  },
  tella: {
    kind: 'key', name: 'Tella', fields: [['key', 'API key', 'tella_pk_…', 'secret']],
    help: ['In Tella, open Settings, API keys and create a key.', 'Paste it here.', 'Recordings and transcripts feed the Repurposer, Content and the Video editor. The editor only changes a copy of a video, after you approve its storyboard.'],
    async test(c) { await jf('Tella', 'https://api.tella.com/v1/videos?limit=1', { headers: bearer(c.key) }); return { label: 'Tella key ending ' + c.key.slice(-4), meta: {} }; },
    async sync(c) {
      const j = await jf('Tella', 'https://api.tella.com/v1/videos?limit=25', { headers: bearer(c.key) });
      const vs = (j.videos || []).map((v) => ({ id: v.id, t: clip(v.name, 120) || 'Video', views: num(v.views), at: v.createdAt, minutes: Math.round(num(v.durationSeconds) / 60), url: v.links && v.links.viewPage }));
      return { videos: vs, ...feed([{ l: 'Videos', v: String(vs.length) }, { l: 'Views', v: short(vs.reduce((s, v) => s + v.views, 0)) }], vs.map((v) => ({ t: v.t, s: v.minutes + ' min · ' + short(v.views) + ' views', at: v.at, url: v.url }))) };
    },
  },
  telegram: {
    kind: 'key', name: 'Telegram', fields: [['token', 'Bot token', '123456:ABC…', 'secret']],
    help: ['In Telegram, message @BotFather, send /newbot and follow the steps.', 'Paste the bot token here.', 'Open the link the OS gives you and press Start. From then on the brief arrives every morning at 07:00 and only your chat can talk to the bot.'],
    async test(c) { const j = await jf('Telegram', `https://api.telegram.org/bot${c.token}/getMe`); if (!j.ok) throw bad('Telegram did not accept this token.', 422); c.bot = j.result.username; c.code = c.code || crypto.randomBytes(6).toString('hex'); return { label: '@' + j.result.username, meta: { bot: j.result.username, start_link: `https://t.me/${j.result.username}?start=${c.code}` }, pending: !c.chat_id }; },
    async sync(c, m) { if (!c.chat_id) return { ...feed([{ l: 'Bot', v: '@' + c.bot }, { l: 'Chat', v: 'Press Start in Telegram' }], []) }; return feed([{ l: 'Bot', v: '@' + c.bot }, { l: 'Chat', v: c.chat_name || 'Linked' }, { l: 'Last brief', v: m && m.last_sent_at ? isoDay(m.last_sent_at) : 'Not sent yet' }], []); },
    async send(c, text) { if (!c.chat_id) throw bad('Open the start link in Telegram and press Start first.', 409); const j = await jf('Telegram', `https://api.telegram.org/bot${c.token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: c.chat_id, text, disable_web_page_preview: true }) }); if (!j.ok) throw bad('Telegram: ' + j.description, 422); },
  },
  'email-digest': {
    kind: 'key', name: 'Email digest', fields: [['key', 'Resend API key', 're_...', 'password'], ['to', 'Send to', 'you@yourdomain.com', 'text'], ['from', 'Send from (optional)', 'Jarvis <jarvis@yourdomain.com>', 'text', true]],
    help: ['Create a free account at resend.com and make an API key with sending access.', 'Paste it here with the address the digest should go to. Until you verify your own domain in Resend, the digest can only go to the address you signed up to Resend with.', 'Every Friday morning you get the week in one email: leads, calls, drafts waiting and promises due.'],
    async test(c) {
      if (!/^re_[A-Za-z0-9_]{10,}$/.test(c.key || '')) throw bad('That does not look like a Resend key. It starts with re_.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.to || '')) throw bad('Add the address the digest should go to.');
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + c.key } }); const j = await r.json().catch(() => ({}));
      if (!r.ok && j.name !== 'restricted_api_key') throw bad('Resend did not accept this key.', 422);
      return { label: 'Fridays to ' + c.to, meta: { to: c.to } };
    },
    async sync(c, m) { return feed([{ l: 'Sends to', v: c.to }, { l: 'Schedule', v: 'Fridays, 07:00' }, { l: 'Last sent', v: m && m.last_sent_at ? isoDay(m.last_sent_at) : 'Not sent yet' }], []); },
    async send(c, text, ws) { return sendDigest(c, text, ws); },
  },
  claude: {
    kind: 'key', name: 'Claude', fields: [['key', 'Anthropic API key', 'sk-ant-…', 'secret']],
    help: ['At console.anthropic.com, open API keys and create one.', 'Paste it here.', 'Drafting agents use Claude for scripts, remixes and follow-ups. If OpenAI is also connected, it is the backup when Claude is busy.'],
    async test(c) { if (!/^sk-ant-/.test(c.key)) throw bad('Paste an Anthropic key. It starts with sk-ant-.'); await jf('Anthropic', 'https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': c.key, 'anthropic-version': '2023-06-01' } }); return { label: 'Anthropic key ending ' + c.key.slice(-4), meta: { model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' } }; },
    async sync(c, m) { return feed([{ l: 'Status', v: 'Ready' }, { l: 'Model', v: (m && m.model) || 'claude-sonnet-5-5' }], []); },
  },
  github: {
    kind: 'key', name: 'GitHub', fields: [['key', 'Personal access token', 'ghp_… or github_pat_…', 'secret']],
    help: ['On github.com, open Settings, Developer settings, Personal access tokens. Create a classic token with the repo scope, or a fine-grained token with Administration and Contents set to read and write.', 'Paste it here. It belongs to this workspace only.', 'The Funnel Agent creates one private repository per sales page in your account and pushes every new version to it.'],
    async test(c) {
      const u = await jf('GitHub', 'https://api.github.com/user', { headers: { Authorization: 'Bearer ' + c.key, Accept: 'application/vnd.github+json', 'User-Agent': 'FoundersAIOS' } });
      return { label: 'GitHub @' + u.login, meta: { login: u.login } };
    },
    async sync(c, m) { return feed([{ l: 'Account', v: '@' + ((m && m.login) || 'connected') }, { l: 'Used by', v: 'Funnel Agent' }], []); },
  },
  openrouter: {
    kind: 'key', name: 'OpenRouter', fields: [['key', 'API key', 'sk-or-v1-…', 'secret'], ['model', 'Image model (optional)', 'openai/gpt-image-2, google/gemini-3-pro-image, black-forest-labs/flux-3-image', 'text', true]],
    help: ['On openrouter.ai, open Settings, Keys and create a key. Add credits to the account.', 'Paste it here. Leave the model empty to use GPT Image 2 first, then Gemini 3 Pro Image and FLUX 3 if one is busy.', 'The Funnel Agent draws the hero, story and offer images for every sales page with it.'],
    async test(c) {
      const k = await jf('OpenRouter', 'https://openrouter.ai/api/v1/key', { headers: bearer(c.key) });
      const d = (k && k.data) || {};
      if (c.model && !/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(c.model)) throw bad('Write the model as provider/model, for example openai/gpt-image-2');
      return { label: 'OpenRouter' + (d.label ? ' ' + String(d.label).slice(0, 40) : ''), meta: { model: c.model || null, limit: d.limit == null ? null : d.limit, usage: d.usage == null ? null : d.usage } };
    },
    async sync(c, m) { return feed([{ l: 'Image model', v: (m && m.model) || 'GPT Image 2, then Gemini 3 Pro Image, then FLUX 3' }, { l: 'Used by', v: 'Funnel Agent graphics' }], []); },
  },
  vercel: {
    kind: 'key', name: 'Vercel', fields: [['key', 'Access token', 'From vercel.com/account/tokens', 'secret'], ['team', 'Team ID or slug (optional)', 'Leave empty for your personal account', 'text', true]],
    help: ['On vercel.com, open Account settings, Tokens and create a token with access to the team you want to publish to.', 'Paste it here. Add the team ID or slug if your pages should live in a team.', 'The Funnel Agent publishes every sales page as its own Vercel project and sends the live link back to the OS.'],
    async test(c) {
      const H = { headers: { Authorization: 'Bearer ' + c.key } };
      const u = await jf('Vercel', 'https://api.vercel.com/v2/user', H);
      let team = null; if (c.team) { const t = await jf('Vercel', 'https://api.vercel.com/v2/teams/' + q(c.team), H); team = t.slug || t.name; c.team = t.id || c.team; }
      return { label: 'Vercel ' + (team ? team : (u.user && (u.user.username || u.user.email)) || 'account'), meta: { user: u.user && u.user.username, team } };
    },
    async sync(c, m) { return feed([{ l: 'Account', v: (m && (m.team || m.user)) || 'Connected' }, { l: 'Used by', v: 'Funnel Agent' }], []); },
  },
  elevenlabs: {
    kind: 'key', name: 'ElevenLabs', fields: [['key', 'API key', 'sk_…', 'secret'], ['voice_id', 'Voice ID (optional)', 'Pick from your voices after connecting, or paste one', 'text', true]],
    help: ['At elevenlabs.io, open Developers, then API keys, and create a key. Give it Text to Speech and ElevenAgents access for the live conversation, and Voices read so the OS can list your voices.', 'Paste it here. The key belongs to this workspace only and usage is billed to your own ElevenLabs account.', 'Then pick the voice Jarvis speaks with, your own cloned voice included, and press Test voice.'],
    async test(c) {
      if (!c.key || c.key.length < 20) throw bad('Paste the full ElevenLabs API key. New keys start with sk_.');
      let voices = null;
      try { voices = await elevenVoices(c.key); } catch (e) {
        if (e.status !== 401 && e.status !== 403) throw e;
        try { await jf('ElevenLabs', 'https://api.elevenlabs.io/v1/models', { headers: { 'xi-api-key': c.key } }); } catch { throw bad('ElevenLabs did not accept this key. Check that it is active and has Text to Speech access.', 401); }
      }
      const v = voices && c.voice_id ? voices.find((x) => x.id === c.voice_id) : null;
      return { label: 'ElevenLabs key ending ' + c.key.slice(-4), meta: { voice_id: c.voice_id || null, voice_name: v ? v.name : null, voices: voices || [], voices_note: voices ? null : 'This key cannot list voices. Paste a voice ID, or add Voices read to the key.' } };
    },
    async sync(c, m) {
      let voices = Array.isArray(m.voices) ? m.voices : []; let note = null;
      try { voices = await elevenVoices(c.key); } catch (e) { if (e.status === 401 || e.status === 403) note = 'This key cannot list voices. Paste a voice ID, or add Voices read to the key.'; else throw e; }
      let sub = null; try { sub = await jf('ElevenLabs', 'https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': c.key } }); } catch { /* key without User read */ }
      const id = m.voice_id || c.voice_id || null; const v = id ? voices.find((x) => x.id === id) : null;
      const chars = sub && sub.character_limit ? { used: num(sub.character_count), limit: num(sub.character_limit), reset_at: sub.next_character_count_reset_unix ? new Date(sub.next_character_count_reset_unix * 1000).toISOString() : null, tier: sub.tier || null } : null;
      return { voices, voices_note: note, voice_id: id, voice_name: v ? v.name : (id ? 'Voice ' + id.slice(0, 6) : null), chars,
        ...feed([{ l: 'Voice', v: v ? v.name : id ? 'Custom voice' : 'Default voice' }, { l: 'Jarvis runs on', v: m && m.realtime === false ? 'Eleven v4 Turbo' : m && m.realtime_model === 'eleven_realtime_v1_max' ? 'Realtime Max' : 'Realtime Mini', s: m && m.realtime === false ? 'Live conversation off' : 'Eleven Realtime' }, chars ? { l: 'Characters left', v: short(Math.max(0, chars.limit - chars.used)), s: 'of ' + short(chars.limit) + (chars.tier ? ' · ' + chars.tier : '') } : null, { l: 'Voices on the account', v: String(voices.length) }],
          voices.filter((x) => x.category !== 'premade').concat(voices.filter((x) => x.category === 'premade')).slice(0, 8).map((x) => ({ t: x.name, s: ELEVEN_CAT[x.category] || x.category || 'Voice', tag: x.id === id ? 'Jarvis' : null }))) };
    },
  },
};
// A second channel. Same reads, its own sign-in, so a founder with two channels sees both.
P['youtube-2'] = { ...P.youtube, name: 'Second YouTube channel',
  help: ['Paste the link or @handle of your second channel and press Connect channel.', 'For watch time and subscriber growth, sign in with Google and pick the second channel when Google asks.'] };
const YT = ['youtube', 'youtube-2'];
async function gAds(c, tok, query) {
  const cid = String(c.customer_id || '').replace(/\D/g, ''); if (!cid) throw bad('Add the Google Ads customer ID.');
  const h = { Authorization: 'Bearer ' + tok, 'developer-token': c.developer_token, 'Content-Type': 'application/json' }; const lc = String(c.login_customer_id || '').replace(/\D/g, ''); if (lc) h['login-customer-id'] = lc;
  return jf('Google Ads', `https://googleads.googleapis.com/${process.env.GOOGLE_ADS_VERSION || 'v21'}/customers/${cid}/googleAds:search`, { method: 'POST', headers: h, body: JSON.stringify({ query }) }).catch((e) => gNeedApi(e, 'Google Ads API'));
}

/* ---------- Instagram through HighLevel Social Planner, plus the public profile through Apify ---------- */
const HLB = 'https://services.leadconnectorhq.com';
const hlH = (hl) => ({ Authorization: 'Bearer ' + hl.token, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' });
async function hlIgAccount(hl, want) {
  const j = await jf('HighLevel', `${HLB}/social-media-posting/${q(hl.location_id)}/accounts`, { headers: hlH(hl) });
  const list = ((j.results && j.results.accounts) || []).filter((a) => a.platform === 'instagram' && !a.deleted);
  const a = list.find((x) => x.profileId === want) || list.find((x) => x.active && !x.isExpired) || list[0];
  if (!a) throw bad('No Instagram account is connected in HighLevel Social Planner. Connect it there first, then press Connect here.', 404);
  if (a.isExpired) throw bad('The Instagram connection in HighLevel has expired. Reconnect it in Social Planner, then sync again.', 409);
  return a;
}
const pctTxt = (v) => { const n = parseFloat(v); return isFinite(n) && n !== 0 ? (n > 0 ? '+' : '') + Math.round(n) + '%' : null; };
async function igViaHighLevel(c, ctx) {
  if (!ctx.hl) throw bad('HighLevel is not connected, so Instagram cannot be read. Reconnect HighLevel.', 409);
  const a = await hlIgAccount(ctx.hl, c.account_id);
  const now = Date.now(), D = DAY, iso = (t) => new Date(t).toISOString();
  const body = { profileIds: [a.profileId], platforms: ['instagram'], currentRange: { startDate: iso(now - 30 * D), endDate: iso(now) }, prevRange: { startDate: iso(now - 60 * D), endDate: iso(now - 30 * D) } };
  const st = ((await jf('HighLevel', `${HLB}/social-media-posting/statistics?locationId=${q(ctx.hl.location_id)}`, { method: 'POST', headers: hlH(ctx.hl), body: JSON.stringify(body) })) || {}).results || {};
  const br = st.breakdowns || {}, tot = st.totals || {}, eng = (br.engagement && br.engagement.instagram) || {};
  const imp = num(br.impressions && br.impressions.total), reach = num(br.reach && br.reach.total), gained = num(tot.followers);
  const engaged = num(eng.likes) + num(eng.comments) + num(eng.shares);
  const g = ((st.demographics || {}).gender || {}).totals || {}, ages = ((st.demographics || {}).age || {}).totals || {};
  const topG = Object.entries(g).filter(([k]) => k !== 'unknown').sort((x, y) => num(y[1].total) - num(x[1].total))[0];
  const topA = Object.entries(ages).sort((x, y) => num(y[1]) - num(x[1]))[0];
  const audience = topG || topA ? [topG ? Math.round(topG[1].percentage) + '% ' + (topG[0] === 'male' ? 'men' : 'women') : null, topA ? 'most are ' + topA[0] : null].filter(Boolean).join(', ') : null;
  // Follower count and recent posts come from the public profile when Apify is connected. Best effort.
  let pub = null;
  if (ctx.apify && (c.username || a.name)) {
    try {
      const r = await jf('Apify', `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=60&token=${q(ctx.apify)}`, { method: 'POST', timeout: 70000, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [c.username || a.name] }) });
      pub = Array.isArray(r) && r[0] && r[0].username ? r[0] : null;
    } catch { pub = null; }
  }
  const posts = ((pub && pub.latestPosts) || []).map((p) => ({ t: clip(p.caption, 90) || p.type, likes: num(p.likesCount), comments: num(p.commentsCount), views: num(p.videoViewCount || p.videoPlayCount), at: p.timestamp, url: p.url, type: p.type, thumb: p.displayUrl || null, pinned: !!p.isPinned }));
  const chg = (v) => { const x = parseFloat(v); return isFinite(x) ? Math.round(x * 10) / 10 : null; };
  const profile = { username: (pub && pub.username) || a.name, followers: pub ? num(pub.followersCount) : null, posts: pub ? num(pub.postsCount) : null, new_followers_30d: gained, reach_30d: reach, impressions_30d: imp, engagement_30d: engaged, reach_change: chg(br.reach && br.reach.totalChange), impressions_change: chg(br.impressions && br.impressions.totalChange), engagement_change: chg(eng.change), audience };
  const ch = (x) => pctTxt(x) ? ' (' + pctTxt(x) + ')' : '';
  return {
    via: 'highlevel', profile, audience: { gender: g, age: ages }, posts: posts.slice(0, 12).map((p) => ({ ...p, t: clip(p.t, 140) })),
    ...feed([
      pub ? { l: 'Followers', v: short(pub.followersCount) } : null,
      { l: 'Reach, 30 days', v: short(reach) + ch(br.reach && br.reach.totalChange) },
      { l: 'Impressions, 30 days', v: short(imp) + ch(br.impressions && br.impressions.totalChange) },
      { l: 'Likes, comments and shares', v: short(engaged) + ch(eng.change) },
      { l: 'New followers, 30 days', v: short(gained) },
      audience ? { l: 'Audience', v: audience } : null,
    ], posts.map((p) => ({ t: p.t, s: (p.views ? short(p.views) + ' views · ' : '') + short(p.likes) + ' likes · ' + short(p.comments) + ' comments', at: p.at, url: p.url, tag: p.type === 'Video' ? 'Reel' : null }))),
  };
}

/* ---------- core operations, used by the browser and by the daily job ---------- */
async function syncOne(id, c, meta, { reseal, ctx } = {}) {
  const p = P[id]; if (!p || !p.sync) return null;
  const tok = p.kind === 'google' && !c.public ? await gAccess(c) : null;
  const out = await p.sync(c, meta || {}, tok, ctx || {});
  if (c.__rotated && reseal) { delete c.__rotated; await reseal(c); }
  return { ...out, last_sync_at: new Date().toISOString(), sync_error: null };
}
const errMeta = (e) => ({ sync_error: clip(e.message, 240), last_try_at: new Date().toISOString() });

async function creds(jwt, ws, id) { return JSON.parse(open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: id }), P[id] ? P[id].name : id)); }
async function connRow(jwt, ws, id) { const r = await sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${ws}&provider=eq.${q(id)}&select=provider,status,account_label,meta`); return r[0] || null; }
async function save(jwt, ws, id, c, label, meta, status = 'connected') {
  // Web watches live in the Perplexity connection's meta; a new key keeps the list so no watch is left running unseen.
  if (id === 'perplexity') { try { const old = await connRow(jwt, ws, id); if (old && old.meta && Array.isArray(old.meta.watches)) meta = { ...(meta || {}), watches: old.meta.watches }; } catch { /* first connect */ } }
  const row = await rpc(jwt, 'connection_save', { p_ws: ws, p_provider: id, p_cipher: seal(JSON.stringify(c)), p_label: label, p_meta: meta || {} });
  if (status !== 'connected') await rpc(jwt, 'connection_status', { p_ws: ws, p_provider: id, p_status: status, p_meta: {} });
  return { ...row, status };
}
// Extra credentials a provider reads through another connection. Instagram through HighLevel uses both.
async function ctxFor(jwt, ws, id, c) {
  if (!(id === 'instagram' && c && (c.via === 'highlevel' || !c.token))) return {};
  const [hl, ap] = await Promise.all([
    rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'highlevel' }).then((s) => (s ? JSON.parse(open(s, 'HighLevel')) : null)).catch(() => null),
    rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'apify' }).then((s) => (s ? apifyTok(open(s, 'apify')) : null)).catch(() => null),
  ]);
  return { hl, apify: ap };
}
const apifyTok = (t) => { try { const j = JSON.parse(t); return (j && (j.token || j.key)) || (typeof j === 'string' ? j : t); } catch { return t; } };
async function syncAndStore(jwt, ws, id, c, meta) {
  try {
    const m = await syncOne(id, c, meta, { ctx: await ctxFor(jwt, ws, id, c), reseal: (nc) => rpc(jwt, 'connection_reseal', { p_ws: ws, p_provider: id, p_cipher: seal(JSON.stringify(nc)) }) });
    if (id === 'zoom') { try { const rows = await sb(jwt, `/rest/v1/recordings?workspace_id=eq.${ws}&status=neq.error&select=ext_id`); m.transcripts = await require('./_rec.js').ingestZoom(c, { known: new Set((rows || []).map((r) => r.ext_id)), max: 6, deadline: Date.now() + 25000, save: (rec, cs) => rpc(jwt, 'recording_store', { p_ws: ws, p_rec: rec, p_chunks: cs }) }); } catch (e) { m.transcripts = { error: clip(e.message, 160) }; } }
    await rpc(jwt, 'connection_status', { p_ws: ws, p_provider: id, p_status: 'connected', p_meta: m }); return { ok: true, meta: m };
  } catch (e) { await rpc(jwt, 'connection_status', { p_ws: ws, p_provider: id, p_status: 'error', p_meta: errMeta(e) }).catch(() => {}); return { ok: false, error: e.message }; }
}

async function gatherBrief(jwt, ws) {
  const inbox = require('./inbox.js');
  const [hlb, cal, prof, drafts, late] = await Promise.all([
    rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'highlevel' }).then((s) => (s ? inbox._briefFor(JSON.parse(open(s, 'HighLevel'))) : null)).catch(() => null),
    connRow(jwt, ws, 'gcal').catch(() => null),
    sb(jwt, '/auth/v1/user').catch(() => ({})),
    sb(jwt, `/rest/v1/os_drafts?workspace_id=eq.${ws}&status=eq.waiting&source=neq.Grok%20Bot&select=title&order=created_at.desc&limit=50`).catch(() => []),
    sb(jwt, `/rest/v1/memory_items?workspace_id=eq.${ws}&kind=eq.commitment&status=eq.open&due=lte.${isoDay(Date.now())}&select=id`).catch(() => []),
  ]);
  const name = (prof && prof.user_metadata && prof.user_metadata.full_name) || '';
  return briefText({ name, hlb, events: (cal && cal.meta && cal.meta.events) || [], counts: { drafts: drafts.length, top_draft: drafts[0] && drafts[0].title, late: late.length } });
}
function digestHtml(text, ws) {
  const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1916;max-width:560px"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a0522d">${esc(ws || 'Founders AI OS')} · weekly digest</p>${text.split('\n').map((l) => /^https?:/.test(l) ? `<p><a href="${l}" style="color:#1c1916">Open Founders AI OS</a></p>` : `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}</div>`;
}
async function sendDigest(c, text, ws) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: c.from || 'Founders AI OS <onboarding@resend.dev>', to: [c.to], subject: 'Your week in Founders AI OS', text, html: digestHtml(text, ws) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw bad('Resend: ' + (j.message || 'the digest was not sent'), 422);
}

/* ---------- actions from the browser ---------- */
const pub = (id) => { const p = P[id]; return { id, kind: p.kind, name: p.name, fields: (p.fields || []).map(([k, label, ph, type, optional]) => ({ k, label, ph, type: type || 'text', optional: !!optional })), help: p.help || [], google_ready: p.kind === 'google' ? gReady() : undefined, can_send: !!p.send || id === 'email-digest' }; };
const ACTIONS = {
  async catalog() { return { providers: Object.keys(P).map(pub), google_ready: gReady(), yt_link_ready: !!YT_KEY(), app_url: APP_URL }; },
  // Connect a YouTube channel from its link or @handle. One step, no Google sign-in, works for every public channel.
  async 'youtube-link'(jwt, b) {
    const id = YT.includes(b.provider) ? b.provider : 'youtube'; const ws = b.workspace_id;
    const ch = await ytResolve(b.link);
    const other = await connRow(jwt, ws, YT.find((x) => x !== id)).catch(() => null);
    if (other && other.status === 'connected' && other.meta && (other.meta.channel_id || (other.meta.channel || {}).id) === ch.id) throw bad(ch.snippet.title + ' is already connected as your ' + (id === 'youtube' ? 'second' : 'main') + ' channel.', 409);
    const c = { public: true, channel_id: ch.id, handle: ch.snippet.customUrl || null };
    const label = ch.snippet.title; const meta = { channel_id: ch.id, mode: 'link', __label: label };
    const row = await save(jwt, ws, id, c, label, meta);
    const s = await syncAndStore(jwt, ws, id, c, meta);
    return { ...row, provider: id, name: P[id].name, label, synced: s.ok, sync_error: s.error || null };
  },
  // Fresh numbers for the videos on the content board, by video id or link. Public data, any channel.
  async 'yt-videos'(jwt, b) {
    if (!YT_KEY()) throw bad('Video stats are not switched on for this server yet.', 503);
    await sb(jwt, '/auth/v1/user');
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map((s) => { const v = String(s || '').trim(); const m = v.match(/(?:v=|shorts\/|youtu\.be\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : null; }).filter(Boolean))].slice(0, 50);
    if (!ids.length) return { videos: [] };
    const vs = (await ytget({ public: true }, null, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`)).items || [];
    return { at: new Date().toISOString(), videos: vs.map((v) => ({ id: v.id, title: clip(v.snippet.title, 160), channel: clip(v.snippet.channelTitle, 80), at: v.snippet.publishedAt, views: num(v.statistics.viewCount), likes: num(v.statistics.likeCount), comments: num(v.statistics.commentCount), thumb: ((v.snippet.thumbnails || {}).medium || {}).url || null, duration: v.contentDetails.duration, description: clip(v.snippet.description || '', 700), tags: (v.snippet.tags || []).slice(0, 12) })) };
  },
  async connect(jwt, b) {
    const id = b.provider; const p = P[id]; if (!p) throw bad('Unknown connection');
    const ws = b.workspace_id; const f = b.fields || {}; const c = {};
    for (const [k, label, , type, optional] of p.fields || []) { const v = String(f[k] == null ? '' : f[k]).trim(); if (!v && !optional && !/^select/.test(type || '')) throw bad('Add the ' + label.toLowerCase() + '.'); c[k] = v || (/^select:/.test(type || '') ? type.split(':')[1].split(',')[0] : ''); }
    if (p.kind === 'google') {
      if (!gReady()) throw bad('Google sign-in needs your own Google OAuth app first. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy. SETUP.md, optional step B, shows how to create them.', 409);
      const u = await sb(jwt, '/auth/v1/user'); const state = sign({ p: id, ws, uid: u.id, exp: Date.now() + 10 * 6e4 });
      if ((p.fields || []).length) await save(jwt, ws, id, { ...c, pending: true }, p.name + ' · waiting for Google', {}, 'pending');
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: APP_URL + '/api/inbox?oauth=google', response_type: 'code', scope: ['openid', 'email', ...GSCOPE[id]].join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state });
      return { redirect: url };
    }
    if (p.kind === 'oauth') {
      const u = await sb(jwt, '/auth/v1/user'); const state = sign({ p: id, ws, uid: u.id, exp: Date.now() + 15 * 6e4 });
      await save(jwt, ws, id, c, p.name + ' · waiting for sign-in', {}, 'pending'); return { redirect: p.authUrl(c, state) };
    }
    if (p.kind === 'bank') {
      await p.test(c); const u = await sb(jwt, '/auth/v1/user'); const state = sign({ p: id, ws, uid: u.id, exp: Date.now() + 30 * 6e4 });
      const a = await eb(c, '/auth', { method: 'POST', body: { access: { valid_until: new Date(Date.now() + 179 * DAY).toISOString() }, aspsp: { name: c.bank, country: String(c.country || '').trim().toUpperCase() }, state, redirect_url: APP_URL + '/api/connect?oauth=bank', psu_type: 'personal' } });
      await save(jwt, ws, id, c, c.bank + ' · waiting for the bank', {}, 'pending'); return { redirect: a.url };
    }
    if (p.kind === 'webhook') {
      const k = crypto.randomBytes(24).toString('base64url'); c.hook = k;
      await save(jwt, ws, id, c, p.name, {}); await rpc(jwt, 'connection_hook_set', { p_ws: ws, p_provider: id, p_hash: crypto.createHash('sha256').update(k).digest('hex') });
      const m = await syncOne(id, c, {}); await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: id, p_meta: m });
      return { status: 'connected', webhook_url: `${APP_URL}/api/connect?hook=hl&w=${ws}&k=${k}` };
    }
    if (p.kind === 'csv') return ACTIONS['csv-upload'](jwt, b);
    const t = await p.test(c, await ctxFor(jwt, ws, id, c));
    const row = await save(jwt, ws, id, c, t.label, { ...(t.meta || {}), __label: t.label }, t.pending ? 'pending' : 'connected');
    if (t.pending) return { ...row, meta: t.meta, pending: true };
    const s = await syncAndStore(jwt, ws, id, c, { ...(t.meta || {}), __label: t.label });
    return { ...row, synced: s.ok, sync_error: s.error || null };
  },
  // Google sign-in comes back here for every Google source except Gmail.
  async 'google-finish'(jwt, b) {
    const st = L.unsign(b.state); const ws = b.workspace_id; const u = await sb(jwt, '/auth/v1/user'); if (u.id !== st.uid || st.ws !== ws) throw bad('This sign-in belongs to another workspace', 403);
    const id = st.p; const p = P[id]; if (!p || p.kind !== 'google') throw bad('Unknown connection');
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: b.code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: APP_URL + '/api/inbox?oauth=google', grant_type: 'authorization_code' }) });
    const j = await r.json(); if (!r.ok || !j.refresh_token) throw bad('Google did not return access. Try again and approve every box.', 422);
    const granted = String(j.scope || ''); const missing = GSCOPE[id].filter((s) => !granted.includes(s)); if (missing.length) throw bad('Google access was approved without ' + missing.map((s) => s.split('/').pop()).join(', ') + '. Connect again and tick every box.', 422);
    let c = {}; if ((p.fields || []).length) { try { c = await creds(jwt, ws, id); } catch { c = {}; } } delete c.pending; c.refresh_token = j.refresh_token;
    const t = await p.test(c, j.access_token);
    if (YT.includes(id)) { const other = await connRow(jwt, ws, YT.find((x) => x !== id)).catch(() => null); if (other && other.status !== 'not_connected' && other.meta && (other.meta.channel_id || (other.meta.channel || {}).id) === (t.meta || {}).channel_id) throw bad('That is ' + t.label + ', which is already connected. Sign in again and pick your other channel.', 409); }
    const row = await save(jwt, ws, id, c, t.label, { ...(t.meta || {}), __label: t.label });
    const s = await syncAndStore(jwt, ws, id, c, { ...(t.meta || {}), __label: t.label });
    return { ...row, provider: id, name: p.name, synced: s.ok, sync_error: s.error || null };
  },
  // Your own Xero app and the bank come back here.
  async 'oauth-finish'(jwt, b) {
    const st = L.unsign(b.state); const ws = b.workspace_id; const u = await sb(jwt, '/auth/v1/user'); if (u.id !== st.uid || st.ws !== ws) throw bad('This sign-in belongs to another workspace', 403);
    const id = st.p; const p = P[id]; const c = await creds(jwt, ws, id); let t;
    if (id === 'bank') { const s = await eb(c, '/sessions', { method: 'POST', body: { code: b.code } }); c.session_id = s.session_id; c.accounts = (s.accounts || []).map((a) => ({ uid: a.uid, name: a.name || (a.account_id && a.account_id.iban) || a.product, iban: a.account_id && a.account_id.iban })); if (!c.accounts.length) throw bad('The bank shared no accounts. Try again and tick the accounts you want.', 422); t = { label: c.bank + ' · ' + c.accounts.length + (c.accounts.length === 1 ? ' account' : ' accounts'), meta: { accounts: c.accounts.length, valid_until: s.access && s.access.valid_until } }; }
    else t = await p.finish(c, b.code);
    const row = await save(jwt, ws, id, c, t.label, { ...(t.meta || {}), __label: t.label });
    const s = await syncAndStore(jwt, ws, id, c, { ...(t.meta || {}), __label: t.label });
    return { ...row, provider: id, name: p.name, synced: s.ok, sync_error: s.error || null };
  },
  async 'telegram-check'(jwt, b) {
    const ws = b.workspace_id; const c = await creds(jwt, ws, 'telegram');
    const j = await jf('Telegram', `https://api.telegram.org/bot${c.token}/getUpdates?limit=50&allowed_updates=${q('["message"]')}`);
    const m = (j.result || []).map((x) => x.message).filter(Boolean).reverse().find((x) => String(x.text || '').trim() === '/start ' + c.code);
    if (!m) return { linked: false };
    c.chat_id = m.chat.id; c.chat_name = [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.username || 'Your chat';
    const row = await save(jwt, ws, 'telegram', c, '@' + c.bot + ' · ' + c.chat_name, { bot: c.bot, __label: '@' + c.bot });
    await P.telegram.send(c, 'Jarvis is linked to this chat. Your brief arrives here every morning at 07:00.');
    await syncAndStore(jwt, ws, 'telegram', c, { bot: c.bot }); return { linked: true, ...row };
  },
  async 'send-test'(jwt, b) {
    const ws = b.workspace_id; const id = b.provider; const text = await gatherBrief(jwt, ws);
    if (id === 'email-digest') { const [w] = await sb(jwt, `/rest/v1/workspaces?id=eq.${ws}&select=name`); await sendDigest(await creds(jwt, ws, id), text, w && w.name); }
    else { const p = P[id]; if (!p || !p.send) throw bad('This connection does not send messages'); await p.send(await creds(jwt, ws, id), text); }
    await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: id, p_meta: { last_sent_at: new Date().toISOString() } });
    return { sent: true, preview: text };
  },
  async sync(jwt, b) {
    const ws = b.workspace_id; const ids = b.provider ? [b.provider] : Object.keys(P);
    const rows = await sb(jwt, `/rest/v1/workspace_connections?workspace_id=eq.${ws}&status=in.(connected,error)&select=provider,meta,account_label`);
    const stale = b.stale_hours ? Date.now() - b.stale_hours * 3600e3 : Infinity;
    const todo = rows.filter((r) => ids.includes(r.provider) && P[r.provider] && P[r.provider].sync && !(b.stale_hours && r.meta && Date.parse(r.meta.last_sync_at || r.meta.last_try_at || 0) > stale)).slice(0, 12);
    const res = await Promise.all(todo.map(async (r) => { let c; try { c = await creds(jwt, ws, r.provider); } catch (e) { return [r.provider, { ok: false, error: e.message }]; } return [r.provider, await syncAndStore(jwt, ws, r.provider, c, { ...(r.meta || {}), __label: r.account_label })]; }));
    return { synced: Object.fromEntries(res.map(([k, v]) => [k, v.ok ? 'ok' : v.error])) };
  },
  // Affiliate exports. The browser reads the CSV and sends a summary; a raw CSV still works for older clients.
  // Referrals and commissions are kept side by side, so a new upload of one never wipes the other.
  async 'csv-upload'(jwt, b) {
    const ws = b.workspace_id; let rep = b.report;
    if (!rep && b.csv) { try { rep = AffReport.read(String(b.csv).slice(0, 4e6), { filename: b.filename }); } catch (e) { throw bad(e.message); } }
    if (!rep || !/^(referrals|commissions)$/.test(rep.kind)) throw bad('Upload the Referrals or Commissions export from the HighLevel affiliate portal.');
    if (JSON.stringify(rep).length > 2e6) throw bad('That summary is too large. Export a shorter date range.');
    const prev = await connRow(jwt, ws, 'affiliate').catch(() => null);
    const old = (prev && prev.meta && prev.meta.aff) || {};
    const aff = { referrals: old.referrals || null, commissions: old.commissions || null, [rep.kind]: { ...rep, uploaded_at: new Date().toISOString() } };
    const R = aff.referrals, C = aff.commissions;
    const metrics = [C && { l: 'Last 30 days', v: money(C.last30, C.currency) }, C && { l: 'Monthly average', v: money(C.avg12, C.currency) }, R && { l: 'Active customers', v: String(R.active) }, R && { l: 'In trial now', v: String(R.trialsNow || 0) }, R && { l: 'Referrals', v: short(R.total) }];
    const items = C ? (C.bySub || []).map((g) => ({ t: g.name, s: money(g.amount, C.currency) + ' from ' + g.n + (g.n === 1 ? ' commission' : ' commissions') })) : (R.recentCustomers || []).slice(0, 10).map((x) => ({ t: x.email, s: 'Became a customer', at: x.at }));
    aff.metrics = metrics.filter(Boolean); aff.items = items;
    const label = [R && 'Referrals', C && 'Commissions'].filter(Boolean).join(' and ') + ' export';
    await save(jwt, ws, 'affiliate', { kind: 'csv' }, label, { ...((prev && prev.meta) || {}), aff, __label: label });
    await rpc(jwt, 'connection_status', { p_ws: ws, p_provider: 'affiliate', p_status: 'connected', p_meta: { ...feed(aff.metrics, aff.items), last_sync_at: new Date().toISOString(), sync_error: null } });
    return { status: 'connected', kind: rep.kind, rows: rep.kind === 'referrals' ? rep.total : rep.rows, total: rep.total, aff };
  },
  async 'hook-url'(jwt, b) { const c = await creds(jwt, b.workspace_id, 'hl-webhooks'); return { webhook_url: `${APP_URL}/api/connect?hook=hl&w=${b.workspace_id}&k=${c.hook}` }; },
  async disconnect(jwt, b) { if (!P[b.provider]) throw bad('Unknown connection'); return rpc(jwt, 'connection_remove', { p_ws: b.workspace_id, p_provider: b.provider }); },
  // Jarvis speaks with ElevenLabs when it is connected.
  async tts(jwt, b) {
    const ws = b.workspace_id; const c = await creds(jwt, ws, 'elevenlabs'); const text = clip(b.text, 900); if (!text) throw bad('Nothing to say');
    const row = await connRow(jwt, ws, 'elevenlabs'); const m = (row && row.meta) || {};
    const voice = m.voice_id || c.voice_id || process.env.ELEVEN_VOICE || ELEVEN_DEFAULT_VOICE;
    try { return await elevenSpeak(c.key, voice, text, b.mode); } catch (e) {
      if (e.message !== 'voice_not_found') throw e;
      const alt = (Array.isArray(m.voices) && m.voices[0] && m.voices[0].id) || ELEVEN_DEFAULT_VOICE; if (alt === voice) throw bad('That voice is not on your ElevenLabs account. Pick another in Connections.', 404);
      return elevenSpeak(c.key, alt, text, b.mode);
    }
  },
  // A short-lived Eleven Realtime session for Jarvis. The browser never sees the workspace key.
  async 'realtime-session'(jwt, b) {
    const ws = b.workspace_id; const c = await creds(jwt, ws, 'elevenlabs');
    const row = await connRow(jwt, ws, 'elevenlabs'); const m = (row && row.meta) || {};
    if (m.realtime === false) throw bad('Realtime is off for Jarvis. Turn it on in Connections, ElevenLabs.', 409);
    const model = RT_MODELS.includes(m.realtime_model) ? m.realtime_model : RT_MODELS.includes(process.env.ELEVEN_REALTIME_MODEL) ? process.env.ELEVEN_REALTIME_MODEL : RT_MODELS[0];
    const voice = m.voice_id || c.voice_id || process.env.ELEVEN_VOICE || ELEVEN_DEFAULT_VOICE;
    const who = [b.name ? 'The founder\'s first name is ' + clip(b.name, 40) + '.' : '', b.workspace ? 'The workspace is ' + clip(b.workspace, 80) + '.' : '', 'Today is ' + new Date().toISOString().slice(0, 10) + '.'].filter(Boolean).join(' ');
    const ctx = clip(String(b.context || '').replace(/\u2014/g, ','), 2400);
    const bf = await require('./jarvis.js')._brief(jwt, { workspace_id: ws }).catch(() => ({}));
    const instructions = [...RT_RULES, who, bf.sources ? 'Connected sources and their latest numbers:\n' + clip(bf.sources, 1200) : '', bf.dna ? 'BRAND DNA, the founder\'s approved facts, offers, funnels and voice. Use it to brainstorm and to sound like you know the business:\n' + bf.dna : '', ctx ? 'What the app shows right now:\n' + ctx : ''].filter(Boolean).join('\n');
    try {
      const r = await elevenRealtime(c.key, { model, voice, instructions });
      if (m.realtime_error) await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: 'elevenlabs', p_meta: { realtime_error: null, realtime_ok_at: new Date().toISOString() } });
      return r;
    } catch (e) {
      if (e.realtime_off || e.realtime_fail) await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: 'elevenlabs', p_meta: { realtime_error: e.message, realtime_try_at: new Date().toISOString() } }).catch(() => {});
      throw e;
    }
  },
  // Realtime on or off, Mini or Max.
  async 'eleven-realtime'(jwt, b) {
    const ws = b.workspace_id; await creds(jwt, ws, 'elevenlabs');
    const p = {}; if (typeof b.on === 'boolean') p.realtime = b.on; if (RT_MODELS.includes(b.model)) p.realtime_model = b.model;
    if (!Object.keys(p).length) throw bad('Nothing to change');
    const row = await connRow(jwt, ws, 'elevenlabs'); const m = { ...((row && row.meta) || {}), ...p }; const f = m.feed;
    if (f && Array.isArray(f.metrics)) p.feed = { ...f, metrics: f.metrics.map((x) => (x.l === 'Jarvis runs on' ? { ...x, v: m.realtime === false ? 'Eleven v4 Turbo' : m.realtime_model === 'eleven_realtime_v1_max' ? 'Realtime Max' : 'Realtime Mini', s: m.realtime === false ? 'Live conversation off' : 'Eleven Realtime' } : x)) };
    await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: 'elevenlabs', p_meta: p }); return p;
  },
  // The voice Jarvis speaks with, picked from the founder's own ElevenLabs voices.
  async 'eleven-voice'(jwt, b) {
    const ws = b.workspace_id; const id = String(b.voice_id || '').trim(); if (!/^[A-Za-z0-9]{8,40}$/.test(id)) throw bad('Pick a voice, or paste a voice ID from ElevenLabs.');
    await creds(jwt, ws, 'elevenlabs');
    const row = await connRow(jwt, ws, 'elevenlabs'); const v = row && Array.isArray(row.meta && row.meta.voices) ? row.meta.voices.find((x) => x.id === id) : null;
    const name = v ? v.name : 'Voice ' + id.slice(0, 6);
    const items = row && row.meta && row.meta.feed ? row.meta.feed.items || [] : [];
    const metrics = row && row.meta && row.meta.feed ? (row.meta.feed.metrics || []).map((x) => (x.l === 'Voice' ? { ...x, v: name } : x)) : [];
    await rpc(jwt, 'connection_meta', { p_ws: ws, p_provider: 'elevenlabs', p_meta: { voice_id: id, voice_name: name, feed: { metrics, items: items.map((x) => ({ ...x, tag: x.t === name ? 'Jarvis' : null })) } } });
    return { voice_id: id, voice_name: name };
  },
  // Cited web answers for Jarvis and Research.
  async ask(jwt, b) {
    const c = await creds(jwt, b.workspace_id, 'perplexity'); const question = clip(b.q, 800); if (!question) throw bad('Ask a question');
    const j = await jf('Perplexity', 'https://api.perplexity.ai/chat/completions', { method: 'POST', headers: { ...bearer(c.key), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.PPLX_MODEL || 'sonar', max_tokens: 500, messages: [{ role: 'system', content: 'Answer for a founder in plain, direct sentences. No em dashes. Keep it under 120 words.' }, { role: 'user', content: question }] }) });
    const row = await connRow(jwt, b.workspace_id, 'perplexity'); await rpc(jwt, 'connection_meta', { p_ws: b.workspace_id, p_provider: 'perplexity', p_meta: { asked: ((row && row.meta && row.meta.asked) || 0) + 1 } });
    return { answer: String((j.choices && j.choices[0] && j.choices[0].message.content) || '').replace(/\u2014/g, ','), citations: (j.citations || (j.search_results || []).map((s) => s.url) || []).slice(0, 6) };
  },
};

/* ---------- inbound: OAuth returns and webhooks ---------- */
async function inbound(req, res, qs) {
  if (qs.get('oauth')) {
    const st = L.peek(qs.get('state')); const p = qs.get('oauth') === 'xero' ? 'accounting' : qs.get('oauth') === 'bank' ? 'bank' : st.p || '';
    const dest = APP_URL + '/#connect' + (qs.get('code') ? '?c_code=' + q(qs.get('code')) + '&c_state=' + q(qs.get('state') || '') + '&c_p=' + q(p) : '?c_error=' + q(qs.get('error_description') || qs.get('error') || 'cancelled') + '&c_p=' + q(p));
    res.statusCode = 302; res.setHeader('Location', dest); return res.end();
  }
  if (qs.get('hook') === 'hl') {
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
    const cd = b.customData || b.custom_data || {};
    const ev = { type: clip((b.workflow && b.workflow.name) || cd.event || b.type || b.event || 'Workflow event', 80), name: clip(b.full_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || b.contact_name, 80), email: clip(b.email, 120), tags: Array.isArray(b.tags) ? b.tags.slice(0, 6) : clip(b.tags, 120), contact_id: clip(b.contact_id || b.contactId, 40),
      ...(cd.draft_title ? { draft_title: clip(cd.draft_title, 200), draft_body: String(cd.draft_body || '').slice(0, 8000), draft_kind: clip(cd.draft_kind, 40), stream: clip(cd.stream, 20) } : {}) };
    try { await rpc(null, 'connection_hook_ingest', { p_ws: qs.get('w'), p_provider: 'hl-webhooks', p_key: qs.get('k'), p_event: ev }); } catch { res.statusCode = 403; return res.end('no'); }
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
  if (b.action === 'catalog') return send(200, await act());
  if (!jwt) return send(401, { error: 'Sign in first' });
  if (!/^[0-9a-f-]{36}$/i.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
  try { return send(200, await act(jwt, b)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.' }); }
};
module.exports._P = P;
module.exports._actions = ACTIONS;
module.exports._syncOne = syncOne;
module.exports._syncAndStore = syncAndStore;
module.exports._briefText = briefText;
module.exports._sendDigest = sendDigest;
module.exports._parseCsv = parseCsv;
module.exports._creds = creds;
module.exports._gAccess = gAccess;
module.exports._elevenSpeak = elevenSpeak;
module.exports._elevenRealtime = elevenRealtime;

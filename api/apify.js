// Founders AI OS: Apify connection and research runs.
// The browser sends its Supabase session. The Apify token is checked with Apify, encrypted with a
// server-only key (AES-256-GCM) and stored in a private schema. The browser never reads it back.
const crypto = require('crypto');

const { sb: sharedSb, encKey } = require('./_lib');
const APIFY = 'https://api.apify.com/v2';

/* ---------- presets: one form, one actor, one shape of results ---------- */
const lines = (s) => String(s || '').split(/[\n,]+/).map((x) => x.trim()).filter(Boolean).slice(0, 25);
const urlish = (s) => /^https?:\/\//i.test(s) ? s : null;
const num = (v) => (v == null || v === '' || isNaN(+v) ? null : +v);
// Written platforms rank on reactions (likes, replies, reposts). View counts are missing or inflated there.
const written = (x) => { const t = (num(x.likeCount) || 0) + (num(x.replyCount) || 0) + (num(x.retweetCount) || 0) + (num(x.quoteCount) || 0); return t || null; };
const PRESETS = {
  'yt-channels': {
    label: 'Competitor channels', actor: 'streamers~youtube-scraper', cap: 400,
    fields: [['targets', 'Channel URLs, one per line'], ['limit', 'Latest videos per channel', 20]],
    input: (f) => { const u = lines(f.targets).map(urlish).filter(Boolean); if (!u.length) throw bad('Add at least one channel URL'); return { startUrls: u.map((url) => ({ url })), maxResults: clamp(f.limit, 1, 50, 20), maxResultsShorts: 0, maxResultStreams: 0, sortVideosBy: 'NEWEST' }; },
    map: (x) => ({ title: x.title, url: x.url, author: x.channelName, date: x.date, views: num(x.viewCount), likes: num(x.likes), comments: num(x.commentsCount), extra: x.duration || null, thumb: x.thumbnailUrl || null }),
    outliers: true,
  },
  'yt-search': {
    label: 'YouTube search', actor: 'streamers~youtube-scraper', cap: 200,
    fields: [['targets', 'Search terms, one per line'], ['limit', 'Videos per term', 20]],
    input: (f) => { const q = lines(f.targets); if (!q.length) throw bad('Add at least one search term'); return { searchQueries: q, maxResults: clamp(f.limit, 1, 50, 20), maxResultsShorts: 0, maxResultStreams: 0, dateFilter: 'month', sortingOrder: 'views' }; },
    map: (x) => ({ title: x.title, url: x.url, author: x.channelName, date: x.date, views: num(x.viewCount), likes: num(x.likes), comments: num(x.commentsCount), extra: x.duration || null, thumb: x.thumbnailUrl || null }),
    outliers: true,
  },
  'yt-comments': {
    label: 'YouTube comments', actor: 'streamers~youtube-comments-scraper', cap: 500,
    fields: [['targets', 'Video URLs, one per line'], ['limit', 'Comments per video', 100]],
    input: (f) => { const u = lines(f.targets).map(urlish).filter(Boolean); if (!u.length) throw bad('Add at least one video URL'); return { startUrls: u.map((url) => ({ url, method: 'GET' })), maxComments: clamp(f.limit, 10, 500, 100) }; },
    map: (x) => ({ title: x.comment, url: x.pageUrl, author: x.author, date: x.date || x.publishedTimeText || null, likes: num(x.voteCount), comments: num(x.replyCount), extra: x.title || null, intent: intent(x.comment) }),
  },
  'ig-profiles': {
    label: 'Instagram profiles', actor: 'apify~instagram-scraper', cap: 200,
    fields: [['targets', 'Profile URLs, one per line'], ['limit', 'Posts per profile', 12]],
    input: (f) => { const u = lines(f.targets).map((s) => urlish(s) || 'https://www.instagram.com/' + s.replace(/^@/, '') + '/'); if (!u.length) throw bad('Add at least one profile'); return { directUrls: u, resultsType: 'posts', resultsLimit: clamp(f.limit, 1, 50, 12), addParentData: false }; },
    map: (x) => ({ title: (x.caption || '').slice(0, 280), url: x.url, author: x.ownerUsername, date: x.timestamp, views: num(x.videoViewCount || x.videoPlayCount), likes: num(x.likesCount), comments: num(x.commentsCount), extra: x.type || null }),
    outliers: true,
  },
  'tt-profiles': {
    label: 'TikTok profiles', actor: 'clockworks~tiktok-scraper', cap: 200,
    fields: [['targets', 'Usernames, one per line'], ['limit', 'Videos per profile', 20]],
    input: (f) => { const p = lines(f.targets).map((s) => s.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/\/.*$/, '')).filter(Boolean); if (!p.length) throw bad('Add at least one username'); return { profiles: p, resultsPerPage: clamp(f.limit, 1, 50, 20), shouldDownloadVideos: false, shouldDownloadCovers: false }; },
    map: (x) => ({ title: (x.text || '').slice(0, 280), url: x.webVideoUrl, author: (x.authorMeta && x.authorMeta.name) || null, date: x.createTimeISO || null, views: num(x.playCount), likes: num(x.diggCount), comments: num(x.commentCount), extra: null }),
    outliers: true,
  },
  'x-search': {
    label: 'X search', actor: 'apidojo~tweet-scraper', cap: 200,
    fields: [['targets', 'Search terms or @handles, one per line'], ['limit', 'Posts per term', 50]],
    input: (f) => { const q = lines(f.targets); if (!q.length) throw bad('Add at least one search term'); return { searchTerms: q.map((t) => /^@\w{1,15}$/.test(t) ? 'from:' + t.slice(1) + ' -filter:replies' : t + ' -filter:replies'), maxItems: clamp(f.limit, 50, 200, 50), sort: 'Top' }; },
    expand: (x) => (x.isRetweet || x.isReply || x.noResults ? [] : [x]),
    map: (x) => ({ title: (x.fullText || x.text || '').slice(0, 400), url: x.url, author: (x.author && x.author.userName) || null, date: x.createdAt ? new Date(x.createdAt).toISOString() : null, views: written(x), likes: num(x.likeCount), comments: num(x.replyCount), extra: num(x.viewCount) != null ? num(x.viewCount) + ' views on X' : null }),
    outliers: true,
  },
  'google': {
    label: 'Google results', actor: 'apify~google-search-scraper', cap: 100,
    fields: [['targets', 'Search queries, one per line'], ['limit', 'Results per query', 10]],
    input: (f) => { const q = lines(f.targets); if (!q.length) throw bad('Add at least one query'); return { queries: q.join('\n'), resultsPerPage: clamp(f.limit, 10, 50, 10), maxPagesPerQuery: 1 }; },
    expand: (x) => (x.organicResults || []).map((o) => ({ ...o, _q: x.searchQuery && x.searchQuery.term })),
    map: (x) => ({ title: x.title, url: x.url, author: x.displayedUrl || null, date: x.date || null, extra: (x.description || '').slice(0, 280), query: x._q || null }),
  },
  'custom': {
    label: 'Any actor', actor: null, cap: 200,
    fields: [['actor', 'Actor ID, for example apify/website-content-crawler'], ['json', 'Input JSON']],
    input: (f) => { if (!f.json || !String(f.json).trim()) return {}; try { const j = JSON.parse(f.json); if (typeof j !== 'object' || Array.isArray(j)) throw 0; return j; } catch { throw bad('Input must be a JSON object'); } },
    map: (x) => ({ title: String(x.title || x.name || x.text || x.caption || x.comment || x.url || JSON.stringify(x).slice(0, 140)).slice(0, 280), url: x.url || x.link || null, author: x.author || x.channelName || x.ownerUsername || null, date: x.date || x.timestamp || null, views: num(x.viewCount || x.views || x.playCount), likes: num(x.likes || x.likesCount), comments: num(x.commentsCount), extra: null }),
  },
};
function clamp(v, lo, hi, d) { const n = Math.round(+v); return isNaN(n) ? d : Math.min(hi, Math.max(lo, n)); }
function bad(m) { const e = new Error(m); e.code = 400; return e; }
const INTENT = /\b(price|pricing|cost|how much|hire|done for you|dfy|do you (offer|sell|build)|can you (build|make|help)|course|coaching|template|link|where (can|do) i (get|buy)|sign ?up|trial|affiliate)\b/i;
function intent(t) { return INTENT.test(String(t || '')) ? 'buying' : null; }

/* ---------- crypto ---------- */
function key() { return encKey(); }
function seal(plain) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return 'v1.' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64'); }
function open(sealed) { if (!sealed || !sealed.startsWith('v1.')) throw bad('Apify is not connected'); const b = Buffer.from(sealed.slice(3), 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); }

/* ---------- Supabase as the signed-in user ---------- */
const sb = sharedSb;
const rpc = (jwt, fn, args) => sb(jwt, '/rest/v1/rpc/' + fn, { method: 'POST', body: args });

/* ---------- Apify ---------- */
async function apify(token, p, opt = {}) {
  const r = await fetch(APIFY + p, { method: opt.method || 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: opt.body === undefined ? undefined : JSON.stringify(opt.body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) {
    const msg = (j && j.error && (j.error.message || j.error.type)) || 'Apify returned ' + r.status;
    const e = new Error(r.status === 401 ? 'Apify did not accept this token. Copy it again from Apify Console, Settings, API and Integrations.' : r.status === 404 ? 'Apify could not find that actor or run.' : r.status === 402 ? 'Your Apify account is out of credit for this run.' : msg);
    e.code = r.status === 401 ? 422 : r.status === 404 ? 404 : 502; if (r.status === 401) e.auth = true; throw e;
  }
  return j;
}
async function account(token) {
  const me = (await apify(token, '/users/me')).data || {};
  let usage = null, limit = null;
  try { const l = (await apify(token, '/users/me/limits')).data || {}; usage = l.current ? num(l.current.monthlyUsageUsd) : null; limit = l.limits ? num(l.limits.maxMonthlyUsageUsd) : null; } catch { /* limits are optional */ }
  const plan = me.plan ? (me.plan.id || me.plan.tier || null) : null;
  return { username: me.username || 'Apify account', plan, usage_usd: usage, limit_usd: limit, checked_at: new Date().toISOString() };
}
async function tokenFor(jwt, ws) { try { return open(await rpc(jwt, 'connection_secret', { p_ws: ws, p_provider: 'apify' })); } catch (e) { if (e.code === 400) e.reconnect = 'apify'; throw e; } }
// A saved token Apify no longer accepts (deleted, regenerated or expired on their side). Flag the connection once so
// every screen offers a new token, and answer with one clear message, not the same failure for each creator.
const STALE = 'Apify no longer accepts your saved token. Paste a new one to keep fetching posts.';
async function withToken(jwt, ws, fn, have) {
  const t = have || await tokenFor(jwt, ws);
  try { return await fn(t); }
  catch (e) {
    if (!e.auth) throw e;
    await rpc(jwt, 'connection_status', { p_ws: ws, p_provider: 'apify', p_status: 'error', p_meta: { error: 'token_rejected', error_at: new Date().toISOString() } }).catch(() => {});
    const x = new Error(STALE); x.code = 422; x.reconnect = 'apify'; throw x;
  }
}

function median(a) { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function shape(preset, raw) {
  const P = PRESETS[preset];
  let rows = raw; if (P.expand) rows = rows.flatMap(P.expand);
  let items = rows.map(P.map).filter((x) => x && (x.title || x.url)).map((x) => { const o = {}; for (const [k, v] of Object.entries(x)) if (v != null && v !== '') o[k] = typeof v === 'string' ? v.slice(0, 400) : v; return o; });
  if (P.outliers) {
    const by = {}; items.forEach((x) => { (by[x.author || '?'] = by[x.author || '?'] || []).push(x.views); });
    const med = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, median(v)]));
    items.forEach((x) => { const m = med[x.author || '?']; if (x.views != null && m) x.outlier = Math.round((x.views / m) * 10) / 10; });
    items.sort((a, b) => (b.outlier || 0) - (a.outlier || 0) || (b.views || 0) - (a.views || 0));
  } else if (preset === 'yt-comments') items.sort((a, b) => (b.intent ? 1 : 0) - (a.intent ? 1 : 0) || (b.likes || 0) - (a.likes || 0));
  return items.slice(0, 150);
}
/* ---------- creators: watched accounts on video and written platforms ---------- */
const CREATOR_CAP = { 'creator-ig': 120, 'creator-yt': 160, 'creator-x': 150, 'creator-li': 80, 'creator-fb': 60 };
const PRESET_PLATFORM = { 'creator-ig': 'instagram', 'creator-yt': 'youtube', 'creator-x': 'x', 'creator-li': 'linkedin', 'creator-fb': 'facebook' };
function secs(d) { if (d == null) return null; if (typeof d === 'number') return Math.round(d); const p = String(d).split(':').map(Number); if (p.some(isNaN)) return null; return p.reduce((s, x) => s * 60 + x, 0); }
const iso = (d) => { if (d == null || d === '') return null; const t = new Date(typeof d === 'number' && d < 1e12 ? d * 1000 : d); return isNaN(t) ? null : t.toISOString(); };
const clip = (t, n) => { const s = String(t || '').replace(/\r/g, '').trim(); return s ? s.slice(0, n) : null; };
const firstLine = (t) => clip(String(t || '').split(/\n+/).find((l) => l.trim()) || '', 400);
function igPost(x) {
  const id = x.shortCode || x.id; if (!id) return null;
  const format = x.productType === 'clips' || x.type === 'Video' ? 'reel' : x.type === 'Sidecar' || x.productType === 'carousel_container' ? 'carousel' : 'photo';
  return { platform: 'instagram', format, ext_id: String(id), url: x.url || 'https://www.instagram.com/p/' + id + '/', thumb: x.displayUrl || null, title: (x.caption || '').slice(0, 400) || null,
    views: format === 'reel' ? num(x.videoPlayCount != null ? x.videoPlayCount : x.videoViewCount) : null, likes: num(x.likesCount) != null && x.likesCount >= 0 ? num(x.likesCount) : null, comments: num(x.commentsCount),
    duration_s: secs(x.videoDuration), posted_at: x.timestamp || null };
}
function ytPost(x) {
  if (!x.id || !x.url) return null; const d = secs(x.duration);
  const format = /\/shorts\//.test(x.url) || /short/i.test(String(x.type || '')) ? 'short' : 'video';
  return { platform: 'youtube', format, ext_id: String(x.id), url: x.url, thumb: x.thumbnailUrl || null, title: (x.title || '').slice(0, 400) || null, views: num(x.viewCount), likes: num(x.likes), comments: num(x.commentsCount), duration_s: d, posted_at: x.date ? new Date(x.date).toISOString() : null };
}
// Written posts: the hook is the first line, the full text goes in body so remixes can study the structure.
function xPost(x) {
  if (!x || !x.id || x.isRetweet || x.isReply || x.noResults) return null; const text = x.fullText || x.text; if (!text) return null;
  const media = x.extendedEntities && x.extendedEntities.media && x.extendedEntities.media[0];
  return { platform: 'x', format: 'post', ext_id: String(x.id), url: x.url || x.twitterUrl, thumb: (media && media.media_url_https) || null, title: firstLine(text), body: clip(text, 8000),
    views: num(x.viewCount), likes: num(x.likeCount), comments: num(x.replyCount), shares: (num(x.retweetCount) || 0) + (num(x.quoteCount) || 0) || null, duration_s: null, posted_at: iso(x.createdAt) };
}
function liPost(x) {
  if (!x || !x.id || !x.content || x.type === 'repost') return null; const e = x.engagement || {};
  return { platform: 'linkedin', format: 'post', ext_id: String(x.id), url: x.linkedinUrl || x.shareLinkedinUrl, thumb: (x.postImages && x.postImages[0] && x.postImages[0].url) || null, title: firstLine(x.content), body: clip(x.content, 8000),
    views: null, likes: num(e.likes), comments: num(e.comments), shares: num(e.shares), duration_s: null, posted_at: iso(x.postedAt && (x.postedAt.date || x.postedAt.timestamp)) };
}
function fbPost(x) {
  if (!x || x.error || !x.text) return null; const id = x.postId || x.id || x.url; if (!id) return null;
  return { platform: 'facebook', format: 'post', ext_id: String(id), url: x.url || x.topLevelUrl, thumb: (x.media && x.media[0] && (x.media[0].thumbnail || (x.media[0].photo_image && x.media[0].photo_image.uri))) || null, title: firstLine(x.text), body: clip(x.text, 8000),
    views: num(x.viewsCount), likes: num(x.likes), comments: num(x.comments), shares: num(x.shares), duration_s: null, posted_at: iso(x.time || x.timestamp) };
}
const MAPPERS = { 'creator-ig': igPost, 'creator-yt': ytPost, 'creator-x': xPost, 'creator-li': liPost, 'creator-fb': fbPost };
const COLS = ['platform', 'format', 'ext_id', 'url', 'thumb', 'title', 'body', 'views', 'likes', 'comments', 'shares', 'duration_s', 'posted_at'];
async function creatorRow(jwt, ws, id) {
  const rows = await sb(jwt, `/rest/v1/creators?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(ws)}&select=*`);
  if (!rows || !rows[0]) { const e = new Error('Creator not found'); e.code = 404; throw e; } return rows[0];
}
async function upsertPosts(jwt, ws, creatorId, posts) {
  const now = new Date().toISOString(); const seen = new Set();
  const uniq = posts.filter((p) => p && p.ext_id && p.url && !seen.has(p.ext_id) && seen.add(p.ext_id))
    .map((p) => { const o = { workspace_id: ws, creator_id: creatorId, updated_at: now }; COLS.forEach((k) => { o[k] = p[k] == null ? null : p[k]; }); return o; });
  if (uniq.length) await sb(jwt, '/rest/v1/creator_posts?on_conflict=workspace_id,platform,ext_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: uniq });
  return uniq.length;
}
async function storeCreatorPosts(jwt, row, raw) {
  const map = MAPPERS[row.preset]; if (!map) return 0;
  const n = await upsertPosts(jwt, row.workspace_id, row.creator_id, raw.map(map));
  const now = new Date().toISOString(); const patch = {};
  if (row.preset === 'creator-ig') { patch.ig_synced_at = now; const f = raw.map((x) => num(x.followersCount || (x.owner && x.owner.followersCount))).find((v) => v != null); if (f != null) patch.ig_followers = f; }
  else if (row.preset === 'creator-yt') { patch.yt_synced_at = now; const subs = raw.map((x) => num(x.numberOfSubscribers)).find((v) => v != null); if (subs != null) patch.yt_subscribers = subs; }
  else if (row.preset === 'creator-x') { patch.x_synced_at = now; const f = raw.map((x) => num(x.author && x.author.followers)).find((v) => v != null); if (f != null) patch.x_followers = f; }
  else if (row.preset === 'creator-li') patch.li_synced_at = now;
  else if (row.preset === 'creator-fb') patch.fb_synced_at = now;
  await sb(jwt, `/rest/v1/creators?id=eq.${encodeURIComponent(row.creator_id)}`, { method: 'PATCH', body: patch });
  return n;
}

/* ---------- newsletters: Substack has a public archive with reactions, everything else has RSS ---------- */
const UA = 'Mozilla/5.0 (compatible; FoundersAIOS/1.0)';
function safeUrl(u) {
  let x; try { x = new URL(u); } catch { throw bad('That newsletter link is not a valid URL'); }
  if (x.protocol !== 'https:') throw bad('Use the https link of the newsletter');
  const h = x.hostname.toLowerCase();
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || /\.(local|internal|lan)$/.test(h) || !h.includes('.')) throw bad('Use the public link of the newsletter');
  return x;
}
async function grab(u, accept) {
  safeUrl(u);
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: accept || '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (r.url) safeUrl(r.url);
  const t = await r.text(); return { ok: r.ok, status: r.status, url: r.url || u, type: r.headers.get('content-type') || '', text: t.slice(0, 3e6) };
}
const unent = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const strip = (h) => unent(h).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|h\d|li)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
function tag(block, names) { for (const n of names) { const m = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i').exec(block); if (m && m[1].trim()) return m[1].trim(); } return null; }
function parseFeed(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return items.slice(0, 60).map((b) => {
    let link = tag(b, ['link']); if (!link || /^\s*$/.test(link)) { const m = /<link[^>]*href="([^"]+)"[^>]*\/?>/i.exec(b); link = m && m[1]; }
    link = unent(link || '').trim(); const title = strip(tag(b, ['title']) || '');
    const body = strip(tag(b, ['content:encoded', 'content', 'description', 'summary']) || '');
    const img = /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(b) || /<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i.exec(b) || /<img[^>]*src="([^"]+)"/i.exec(unent(b));
    if (!link || !title) return null;
    return { platform: 'newsletter', format: 'essay', ext_id: unent(tag(b, ['guid', 'id']) || link).trim().slice(0, 300), url: link, thumb: img ? img[1] : null, title: title.slice(0, 400), body: clip(body, 3000),
      views: null, likes: null, comments: null, shares: null, duration_s: null, posted_at: iso(unent(tag(b, ['pubDate', 'published', 'updated', 'dc:date']) || '')) };
  }).filter(Boolean);
}
function subPost(p, origin) {
  if (!p || !p.id || !p.title) return null;
  return { platform: 'newsletter', format: 'essay', ext_id: 'ss-' + p.id, url: p.canonical_url || origin + '/p/' + p.slug, thumb: p.cover_image || null, title: clip(p.title, 400), body: clip([p.subtitle || p.description, p.truncated_body_text].filter(Boolean).join('\n\n'), 8000),
    views: null, likes: num(p.reaction_count), comments: num(p.comment_count), shares: num(p.restacks), duration_s: null, posted_at: iso(p.post_date) };
}
async function substack(origin) {
  const out = [];
  for (const sort of ['top', 'new']) {
    let cursor = null;
    for (let page = 0; page < (sort === 'top' ? 2 : 1); page++) {
      const r = await grab(`${origin}/api/v1/archive?sort=${sort}&limit=25` + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), 'application/json');
      if (!r.ok || !/json/.test(r.type)) return page === 0 && sort === 'top' ? null : out;
      let j; try { j = JSON.parse(r.text); } catch { return out.length ? out : null; }
      const posts = Array.isArray(j) ? j : j.posts || []; posts.forEach((p) => out.push(subPost(p, origin)));
      cursor = !Array.isArray(j) && j.nextCursor; if (!cursor || posts.length < 25) break;
    }
  }
  return out.filter(Boolean);
}
async function newsletter(url) {
  const u = safeUrl(url); const origin = u.origin;
  const ss = /\.substack\.com$/i.test(u.hostname) ? await substack(origin) : null;
  if (ss && ss.length) return { kind: 'substack', posts: ss };
  // Not a substack.com address: the page tells us if it runs on Substack or which feed it publishes.
  const home = await grab(u.href, 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml');
  if (/<(rss|feed)[\s>]/i.test(home.text.slice(0, 2000))) { const posts = parseFeed(home.text); if (posts.length) return { kind: 'rss', feed: home.url, posts }; }
  if (/substackcdn\.com|substack\.com\/api/i.test(home.text)) { const s2 = await substack(new URL(home.url).origin); if (s2 && s2.length) return { kind: 'substack', posts: s2 }; }
  const alt = [...home.text.matchAll(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*>/gi)].map((m) => (/href="([^"]+)"/i.exec(m[0]) || [])[1]).filter(Boolean);
  const tries = [...alt.map((h) => new URL(unent(h), home.url).href), ...['/rss.xml', '/feed', '/feed.xml', '/rss', '/atom.xml', '/index.xml'].map((p) => origin + p)];
  for (const f of [...new Set(tries)].slice(0, 8)) {
    try { const r = await grab(f, 'application/rss+xml,application/atom+xml,application/xml,text/xml'); if (r.ok && /<(rss|feed)[\s>]/i.test(r.text.slice(0, 3000))) { const posts = parseFeed(r.text); if (posts.length) return { kind: 'rss', feed: r.url, posts }; } } catch (e) { if (e.code === 400) throw e; }
  }
  throw bad('No public archive or RSS feed found at that address. Paste the Substack link or the feed URL.');
}

const STATUS = { READY: 'running', RUNNING: 'running', SUCCEEDED: 'succeeded', FAILED: 'failed', ABORTING: 'aborted', ABORTED: 'aborted', 'TIMING-OUT': 'timed_out', 'TIMED-OUT': 'timed_out' };

/* ---------- actions ---------- */
const ACTIONS = {
  presets: async () => ({ presets: Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, actor: p.actor, fields: p.fields })) }),
  async connect(jwt, b) {
    const token = String(b.token || '').trim();
    if (!/^apify_api_[A-Za-z0-9]{20,}$/.test(token)) throw bad('That does not look like an Apify API token. It starts with apify_api_.');
    const acc = await account(token);
    const row = await rpc(jwt, 'connection_save', { p_ws: b.workspace_id, p_provider: 'apify', p_cipher: seal(token), p_label: acc.username + (acc.plan ? ' · ' + acc.plan : ''), p_meta: acc });
    return { ...row, account: acc };
  },
  async status(jwt, b) { const acc = await withToken(jwt, b.workspace_id, (t) => account(t)); await rpc(jwt, 'connection_meta', { p_ws: b.workspace_id, p_provider: 'apify', p_meta: acc }); return { account: acc }; },
  async disconnect(jwt, b) { return rpc(jwt, 'connection_remove', { p_ws: b.workspace_id, p_provider: 'apify' }); },
  async run(jwt, b) {
    const P = PRESETS[b.preset]; if (!P) throw bad('Unknown research type');
    const f = b.fields || {};
    let actor = P.actor;
    if (b.preset === 'custom') { actor = String(f.actor || '').trim().replace(/^https?:\/\/apify\.com\//, '').replace('/', '~'); if (!/^[\w.-]+~[\w.-]+$/.test(actor)) throw bad('Actor ID looks like username/actor-name'); }
    const input = P.input(f);
    const run = (await withToken(jwt, b.workspace_id, (t) => apify(t, `/acts/${encodeURIComponent(actor)}/runs?maxItems=${P.cap}`, { method: 'POST', body: input }))).data;
    const label = b.preset === 'custom' ? actor.replace('~', '/') : P.label + ': ' + lines(f.targets).slice(0, 2).map((s) => s.replace(/^https?:\/\/(www\.)?/, '')).join(', ') + (lines(f.targets).length > 2 ? ' +' + (lines(f.targets).length - 2) : '');
    const rows = await sb(jwt, '/rest/v1/research_runs', { method: 'POST', prefer: 'return=representation', body: { workspace_id: b.workspace_id, preset: b.preset, label: label.slice(0, 160), actor_id: actor, input, run_id: run.id, dataset_id: run.defaultDatasetId, status: STATUS[run.status] || 'running' } });
    return { run: rows[0] };
  },
  async 'creator-sync'(jwt, b) {
    const c = await creatorRow(jwt, b.workspace_id, b.creator_id);
    const pf = b.platform || 'youtube';
    const need = { instagram: ['ig_handle', 'an Instagram handle'], youtube: ['yt_url', 'a YouTube channel'], x: ['x_handle', 'an X handle'], linkedin: ['li_url', 'a LinkedIn profile'], facebook: ['fb_url', 'a Facebook page'] }[pf];
    if (!need) throw bad('Unknown platform');
    if (!c[need[0]]) throw bad('Add ' + need[1] + ' to this creator first');
    let preset, actor, input, where;
    if (pf === 'instagram') { preset = 'creator-ig'; actor = 'apify~instagram-scraper'; where = 'Instagram'; input = { directUrls: ['https://www.instagram.com/' + c.ig_handle + '/'], resultsType: b.mode === 'reels' ? 'reels' : 'posts', resultsLimit: clamp(b.limit, 5, 120, 50), addParentData: false }; }
    else if (pf === 'youtube') { const limit = clamp(b.limit, 5, 80, 40); preset = 'creator-yt'; actor = 'streamers~youtube-scraper'; where = 'YouTube'; input = { startUrls: [{ url: c.yt_url }], maxResults: limit, maxResultsShorts: b.shorts === false ? 0 : Math.min(limit, 40), maxResultStreams: 0, sortVideosBy: b.mode === 'top' ? 'POPULAR' : 'NEWEST' }; }
    else if (pf === 'x') { preset = 'creator-x'; actor = 'apidojo~tweet-scraper'; where = 'X'; input = { twitterHandles: [c.x_handle], maxItems: clamp(b.limit, 50, 150, 100), sort: 'Latest' }; }
    else if (pf === 'linkedin') { preset = 'creator-li'; actor = 'harvestapi~linkedin-profile-posts'; where = 'LinkedIn'; input = { targetUrls: [c.li_url], maxPosts: clamp(b.limit, 10, 80, 40), includeReposts: false, includeQuotePosts: false }; }
    else { preset = 'creator-fb'; actor = 'apify~facebook-posts-scraper'; where = 'Facebook'; input = { startUrls: [{ url: c.fb_url }], resultsLimit: clamp(b.limit, 10, 60, 30) }; }
    const run = (await withToken(jwt, b.workspace_id, (t) => apify(t, `/acts/${actor}/runs?maxItems=${CREATOR_CAP[preset]}`, { method: 'POST', body: input }))).data;
    const label = c.name + ' on ' + where + (b.mode === 'top' ? ', most popular' : b.mode === 'reels' ? ', Reels' : ', latest');
    const rows = await sb(jwt, '/rest/v1/research_runs', { method: 'POST', prefer: 'return=representation', body: { workspace_id: b.workspace_id, preset, label: label.slice(0, 160), actor_id: actor, input, run_id: run.id, dataset_id: run.defaultDatasetId, status: STATUS[run.status] || 'running', creator_id: c.id } });
    return { run: rows[0] };
  },
  // Newsletters need no Apify account: Substack archives and RSS feeds are public, so this runs right away.
  async 'creator-news'(jwt, b) {
    const c = await creatorRow(jwt, b.workspace_id, b.creator_id);
    if (!c.news_url) throw bad('Add a newsletter link to this creator first');
    const r = await newsletter(c.news_url);
    const n = await upsertPosts(jwt, b.workspace_id, c.id, r.posts);
    await sb(jwt, `/rest/v1/creators?id=eq.${encodeURIComponent(c.id)}`, { method: 'PATCH', body: { news_synced_at: new Date().toISOString(), news_kind: r.kind } });
    return { count: n, kind: r.kind, feed: r.feed || null };
  },
  async poll(jwt, b) {
    const rows = await sb(jwt, `/rest/v1/research_runs?id=eq.${encodeURIComponent(b.id)}&workspace_id=eq.${encodeURIComponent(b.workspace_id)}&select=*`);
    const row = rows && rows[0]; if (!row) { const e = new Error('Run not found'); e.code = 404; throw e; }
    if (['succeeded', 'failed', 'aborted', 'timed_out'].includes(row.status)) return { run: row };
    const t = await tokenFor(jwt, b.workspace_id);
    const r = (await withToken(jwt, b.workspace_id, () => apify(t, '/actor-runs/' + encodeURIComponent(row.run_id)), t)).data;
    const status = STATUS[r.status] || 'running';
    const patch = { status, cost_usd: r.usageTotalUsd != null ? Math.round(r.usageTotalUsd * 1e4) / 1e4 : null };
    if (status === 'succeeded') {
      const cr = CREATOR_CAP[row.preset];
      const raw = await apify(t, `/datasets/${encodeURIComponent(r.defaultDatasetId)}/items?clean=1&limit=${cr || PRESETS[row.preset].cap}`);
      const list = Array.isArray(raw) ? raw : [];
      if (cr) { const n = row.creator_id ? await storeCreatorPosts(jwt, row, list) : 0; Object.assign(patch, { items: [], item_count: n, finished_at: new Date().toISOString() }); }
      else Object.assign(patch, { items: shape(row.preset, list), item_count: list.length, finished_at: new Date().toISOString() });
    } else if (status !== 'running') Object.assign(patch, { finished_at: new Date().toISOString(), error: r.statusMessage ? String(r.statusMessage).slice(0, 300) : null });
    const up = await sb(jwt, `/rest/v1/research_runs?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
    return { run: up[0] };
  },
};

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return send(400, { error: 'Bad JSON' }); } }
  b = b || {};
  const auth = String(req.headers.authorization || ''); const jwt = (/^Bearer\s+(.+)$/i.exec(auth) || [])[1];
  const act = ACTIONS[b.action];
  if (!act) return send(400, { error: 'Unknown action' });
  if (b.action !== 'presets') {
    if (!jwt) return send(401, { error: 'Sign in first' });
    if (!/^[0-9a-f-]{36}$/i.test(String(b.workspace_id || ''))) return send(400, { error: 'Missing workspace' });
  }
  try { return send(200, await act(jwt, b)); }
  catch (e) { return send(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || 'Something went wrong on our side. Try again in a minute. If it keeps happening, check that your tools are still connected in Connections.', ...(e.reconnect ? { reconnect: e.reconnect } : {}) }); }
};
module.exports.PRESETS = PRESETS;
module.exports._actions = ACTIONS;
module.exports._shape = shape;
module.exports._igPost = igPost;
module.exports._ytPost = ytPost;
module.exports._xPost = xPost;
module.exports._liPost = liPost;
module.exports._fbPost = fbPost;
module.exports._parseFeed = parseFeed;
module.exports._newsletter = newsletter;

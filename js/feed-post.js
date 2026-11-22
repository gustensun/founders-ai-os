// Newsfeed helpers: how an idea reads as the post it would become.
// Pure functions, shared by the browser view and the unit tests.
(function (root) {
  const tidy = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const hash = (s) => { let h = 2166136261; for (const c of String(s || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  // Which layout a format gets in the feed.
  const KIND = { youtube: 'video', short: 'vertical', reel: 'vertical', tiktok: 'vertical', carousel: 'carousel', post: 'text', email: 'mail', newsletter: 'mail', article: 'article', podcast: 'audio' };
  const kind = (fmt) => KIND[fmt] || 'text';
  // Short names for the filter row.
  const CHIP = { youtube: 'YouTube', short: 'Shorts', reel: 'Reels', tiktok: 'TikTok', carousel: 'Carousels', post: 'Written', email: 'Emails', newsletter: 'Newsletters', article: 'Articles', podcast: 'Podcast' };

  // Thumbnail words: the saved ones, else a short title whole, else the first clause of a long title when it stands on its own.
  function thumbText(x) {
    const m = (x && x.meta) || {}; const given = tidy(m.thumb_text); if (given) return given.slice(0, 60);
    const title = tidy(x && x.title); if (!title) return '';
    const cut = /[:;!?](?=\s)|[.,](?=\s)|\s[-\u2013\u2014|]\s|\s\(/.exec(title);
    if (title.length <= 44) return title;
    if (cut && cut.index > 0) {
      const clause = title.slice(0, cut.index) + (cut[0] === '?' ? '?' : ''); const words = clause.split(' ').length;
      if (words >= 3 && words <= 10 && clause.length <= 58) return clause;
    }
    if (title.length <= 80) return title;
    const lead = cut && cut.index > 0 && cut.index <= 80 ? title.slice(0, cut.index) : '';
    return lead || title.slice(0, 64).replace(/\s+\S*$/, '') + '\u2026';
  }
  // Type size step for a thumbnail, from how much there is to fit.
  const fit = (text) => { const n = tidy(text).length; return n <= 14 ? 'xl' : n <= 26 ? 'l' : n <= 44 ? 'm' : n <= 70 ? 's' : 'xs'; };

  // Carousel slides from the outline, without the "Slide 2:" labels the writer adds.
  function slides(x) {
    const m = (x && x.meta) || {}; const lines = (Array.isArray(m.outline) ? m.outline : []).map(tidy).filter(Boolean);
    const strip = (s) => s.replace(/^(?:cover|hook|slide\s*\d+|(?:last|final|closing)\s+slide|cta)\s*[:.)\u2013-]\s*/i, '');
    const out = lines.map(strip).filter(Boolean);
    if (!lines.length || !/^(?:cover|hook|slide\s*1\b)/i.test(lines[0])) out.unshift(tidy(x && x.title));
    return out.filter(Boolean).slice(0, 12);
  }

  // "2h", "3d", then a date. A feed timestamp, not a log line.
  function ago(iso, now) {
    const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
    const min = Math.max(0, ((now || Date.now()) - t) / 6e4);
    if (min < 1) return 'now'; if (min < 60) return Math.floor(min) + 'm'; if (min < 1440) return Math.floor(min / 60) + 'h';
    if (min < 10080) return Math.floor(min / 1440) + 'd'; if (min < 40320) return Math.floor(min / 10080) + 'w';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  // One quiet line on where the idea came from. Evidence about the source, never a promise about this post.
  function evidence(x) {
    const m = (x && x.meta) || {}; const o = Number(m.outlier); const times = o > 0 ? String(Math.round(o * 10) / 10) + 'x' : '';
    if (m.source_type === 'own_content') return 'Based on your own post' + (times ? ' \u00b7 ' + times + ' your usual' : '');
    if (m.from === 'watch') return 'From your web watch' + (m.watch ? ', ' + tidy(m.watch).slice(0, 60) : '');
    if (m.from === 'call' || m.recording) return 'From your call' + (m.recording ? ', ' + tidy(m.recording).slice(0, 60) : '');
    if (m.author) return 'Based on ' + tidy(m.author).slice(0, 60) + (times ? ' \u00b7 ' + times + ' their usual' : '');
    if (m.funnel) return 'From your Content Funnel';
    if (m.remix) return 'Remixed from a proven post';
    if (m.agent_id) return 'From one of your agents';
    if (m.task_id) return 'From an idea cadence';
    if (m.from_memory) return 'From your memory';
    if (m.legacy_draft) return 'An earlier draft';
    return m.why ? 'Why this idea' : '';
  }

  /* ---------- brand colours for the drawn thumbnails ---------- */
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const c = rgb(h); if (!c) return 0; const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Text colour for a ground: a brand colour when it reads, else plain white or near black.
  function inkOn(ground, palette) {
    const p = palette || {}; const own = [p.bg, p.ink].filter(rgb).sort((a, b) => contrast(b, ground) - contrast(a, ground))[0];
    if (own && contrast(own, ground) >= 4.5) return own;
    const best = contrast('#ffffff', ground) >= contrast('#111111', ground) ? '#ffffff' : '#111111';
    // A mid-tone ground can miss 4.5:1 with both; pure black or white always clears it.
    return contrast(best, ground) >= 4.5 ? best : contrast('#000000', ground) >= contrast('#ffffff', ground) ? '#000000' : '#ffffff';
  }
  // The grounds a thumbnail can sit on, each with text that passes contrast.
  function grounds(palette) {
    const p = palette || {}; const seen = new Set();
    const list = [p.deep, p.ink, p.soft].filter((c) => rgb(c) && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
    if (!list.length) list.push('#141414');
    return list.map((ground) => ({ ground, text: inkOn(ground, p), dark: lum(ground) < 0.4 }));
  }
  // Newest day first, and inside a day the formats take turns, so the feed reads like a feed and not a batch.
  function mix(list, fmtOf) {
    const days = new Map();
    for (const x of list) { const d = String(x.created_at || '').slice(0, 10); if (!days.has(d)) days.set(d, []); days.get(d).push(x); }
    const out = [];
    for (const xs of days.values()) {
      const by = new Map(); for (const x of xs) { const f = fmtOf(x); if (!by.has(f)) by.set(f, []); by.get(f).push(x); }
      const lanes = [...by.values()]; for (let i = 0; lanes.some((q) => q.length > i); i++) for (const q of lanes) if (q[i]) out.push(q[i]);
    }
    return out;
  }
  const pick = (list, id, salt) => (list && list.length ? list[hash(String(id) + (salt || '')) % list.length] : null);

  const api = { tidy, hash, kind, CHIP, thumbText, fit, slides, ago, evidence, contrast, inkOn, grounds, pick, mix };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FeedPost = api;
})(typeof window !== 'undefined' ? window : globalThis);

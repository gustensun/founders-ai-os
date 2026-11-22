// Founders AI OS ideas engine. Turns content that already worked for someone else into ideas for one or more
// formats, from long videos to written posts. Every idea lands in Ideas to approve on the content board, the
// one place the founder approves content. The morning run writes 10 ideas per format from the proven posts.
// Rules always work without a key. With Claude, OpenAI or Perplexity connected the server writes them from the Brand DNA.
// Runs in the browser (window.OSIdeas) and on the server (require).
(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('./remix.js') : root.Remix;

  // id, board name, short name, what the AI should write for it
  const FORMATS = [
    ['youtube', 'YouTube', 'Long video', 'A long YouTube video, 10 to 20 minutes. Title under 70 characters, a spoken hook for the first 15 seconds, and 5 or 6 outline beats.'],
    ['short', 'YouTube Shorts', 'Short', 'A YouTube Short under 45 seconds. Title, a hook that lands in the first 2 seconds, and 3 or 4 beats that end by looping back to the first line.'],
    ['reel', 'Instagram Reels', 'Reel', 'An Instagram Reel under 45 seconds. Title, the on-screen hook for the first 2 seconds, 3 or 4 beats, and a caption of 1 to 3 short lines.'],
    ['carousel', 'Instagram Carousels', 'Carousel', 'An Instagram carousel of 7 to 9 slides. Title is the cover slide. The outline is one line per slide, the last slide asks them to save or share it.'],
    ['tiktok', 'TikTok', 'TikTok', 'A TikTok under 60 seconds. Title, a hook for the first 2 seconds, and 3 or 4 beats told straight to camera.'],
    ['post', 'Written Posts', 'Written post', 'A written post for LinkedIn, Facebook or X, 80 to 200 words. Title is an internal name, the hook is the first line and must stand alone, and the body is the whole post with short lines.'],
  ];
  const IDS = FORMATS.map((f) => f[0]);
  const NAME = Object.fromEntries(FORMATS.map((f) => [f[0], f[1]]));
  const formatFor = (ch) => ({ youtube: 'long', short: 'short', reel: 'short', tiktok: 'short', carousel: 'carousel', post: 'post' })[ch] || 'long';
  // the board format that matches where the original lived
  // Written platforms report reactions (likes, replies, reposts) in the views column.
  const unitOf = (p) => (/^(x|linkedin|facebook|newsletter)$/.test((p && p.platform) || '') ? 'reactions' : 'views');
  function nativeOf(p) {
    const f = String(p.format || ''); const pl = p.platform || '';
    if (pl === 'instagram') return f === 'carousel' || f === 'photo' ? 'carousel' : 'reel';
    if (pl === 'tiktok') return 'tiktok';
    if (pl === 'linkedin' || pl === 'x' || pl === 'facebook' || pl === 'newsletter' || f === 'post' || f === 'essay' || f === 'text') return 'post';
    return /short|reel/.test(f) ? 'short' : 'youtube';
  }

  const tidy = (s) => String(s || '').replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/!+/g, '.').replace(/[ \t]+/g, ' ').trim();
  const end = (s) => { s = tidy(s); return !s || /[.?:]$/.test(s) ? s : s + '.'; };
  const first = (s) => { const m = tidy(s).match(/^[^.?]+[.?]?/); return m ? m[0].trim() : tidy(s); };
  const noCta = (xs) => (xs || []).filter((x) => !/^call to action/i.test(x));

  // One idea for one format from one proven post. v picks the angle: the original pattern's three titles
  // first, then the other angles on the same topic, so ten ideas from a few posts stay different.
  const OWN = ['funnels', 'HighLevel', 'AI', 'Claude', 'content', 'digital products'];
  function topicOf(post) {
    const h = String(post.id || post.title || '').split('').reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
    return R.postTopic(post.title) || OWN[h % OWN.length];
  }
  function fromPost(post, fmt, dna, pool, v) {
    v = v || 0; dna = dna || {};
    const topic = topicOf(post);
    const b = R.brief(post, dna, pool || [], { topic });
    let title, hook, beats, pat = b.pattern.name, why = b.why;
    if (v < b.titles.length) { title = b.titles[v]; hook = b.hook; beats = noCta(b.outline); }
    else {
      const alt = R.remixOwn({ title: b.topic }, dna, [], 11).ideas.filter((i) => i.pattern.id !== b.pattern.id);
      const a = alt[(v - b.titles.length) % Math.max(1, alt.length)];
      if (!a) { title = b.titles[v % b.titles.length]; hook = b.hook; beats = noCta(b.outline); }
      else { title = a.alts && a.alts[0] && v - b.titles.length >= alt.length ? a.alts[0] : a.title; hook = a.hook; beats = noCta(a.outline); pat = a.pattern.name; why = a.why; }
    }
    title = tidy(title);
    const proof = post.own ? `${Number(post.views).toLocaleString('en-US')} views on your connected channel. ${post.outlier}x a similarly aged comparison group. ${post.comparison || ''} An observation to test, not a promise.` : b.proof;
    const base = { title, pattern: pat, proof, why: post.own ? 'A new angle on a measured result from your own channel. Test the idea against your current Brand DNA.' : why };
    if (fmt === 'youtube') return { ...base, hook: tidy(hook), outline: beats.concat(['Close with the one next step to take today']) };
    const shortBeats = [`On screen: ${title}`, end(beats[1] || beats[0]), end(beats[3] || beats[2] || beats[0]), 'Loop back to the first line'];
    if (fmt === 'short' || fmt === 'tiktok') return { ...base, hook: first(hook), outline: shortBeats };
    if (fmt === 'reel') return { ...base, hook: first(hook), outline: shortBeats, caption: end(first(hook)) + ' Save this for later.' };
    if (fmt === 'carousel') return { ...base, hook: title, outline: [`Cover: ${title}`, `Slide 2: ${end(first(hook))}`, ...beats.map((x, i) => `Slide ${i + 3}: ${end(x)}`), 'Last slide: save this and send it to a founder who needs it'] };
    // written post: the whole post, ready to edit
    const body = [end(first(hook)), '', ...beats.slice(0, 4).map((x, i) => `${i + 1}. ${end(x)}`), '', 'Which one would you start with?'].join('\n');
    return { ...base, hook: end(first(hook)), outline: beats.slice(0, 4), post_body: body };
  }

  // A board row for an idea. Remixes and the morning run use the same shape.
  function row(idea, fmt, post, extra) {
    return {
      title: tidy(idea.title).slice(0, 300) || 'Untitled idea', stage: 'suggested', channel: fmt, format: formatFor(fmt),
      meta: {
        hook: idea.hook || '', outline: Array.isArray(idea.outline) ? idea.outline : [], ...(idea.caption ? { caption: idea.caption } : {}), ...(idea.thumb ? { thumb_text: idea.thumb } : {}), ...(idea.post_body != null ? { post_body: idea.post_body } : {}),
        pattern: idea.pattern || null, proof: idea.proof || '', why: idea.why || '',
        ...(post ? { post_id: post.id || null, from: post.title, author: post.author || null, source_url: post.url || null, outlier: post.outlier || null, views_src: post.views || null,
          ...(post.own ? { source_type: 'own_content', comparison: post.comparison, observed_at: post.observed_at } : {}) } : {}),
        ...(extra || {}),
      },
    };
  }

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  // The morning run without AI: for each format, the strongest proven posts, native ones first, rotated by day.
  function morning(proven, dna, opts) {
    opts = opts || {}; const n = opts.per || 10; const formats = opts.formats || IDS;
    const taken0 = (opts.taken || []).map(norm); const day = opts.day || new Date().toISOString().slice(0, 10);
    const seed = Number(day.replace(/-/g, '')) || 0;
    const posts = (proven || []).filter((p) => p && p.title).slice();
    if (!opts.preserveOrder) posts.sort((a, b) => (b.outlier || 0) - (a.outlier || 0));
    posts.splice(40);
    if (!posts.length) return [];
    const out = [];
    formats.forEach((fmt) => {
      const taken = new Set(taken0);
      const native = posts.filter((p) => nativeOf(p) === fmt); const rest = posts.filter((p) => nativeOf(p) !== fmt);
      const order = opts.preserveOrder ? posts : native.concat(rest);
      const preferred = opts.preserveOrder ? order.slice(0, Math.max(1, n - Math.ceil(n * .2))) : [];
      const others = order.slice(preferred.length), shift = seed % Math.max(1, others.length);
      const list = preferred.concat(others.slice(shift), others.slice(0, shift));
      let k = 0; let tries = 0;
      while (out.filter((x) => x.channel === fmt).length < n && tries < list.length * 16) {
        const p = list[k % list.length]; const v = Math.floor(k / list.length) + (seed % 3); k++; tries++;
        const idea = fromPost(p, fmt, dna, posts, v); const key = norm(idea.title);
        if (taken.has(key)) continue; taken.add(key);
        out.push(row(idea, fmt, p, { morning: day, by: 'Rules' }));
      }
    });
    return out;
  }

  /* ---------- what the AI is asked for ---------- */
  const RULES = 'Write as me, in my voice from HOW I WRITE. Keep the pattern that made the original work and change everything else so it is mine: my topic, my stories, my proof. Never claim another creator\'s results. No offers, prices or sales pitch, these are content ideas. No hashtags, no emojis, no em dashes, no exclamation points, no "here\'s the thing", no "let that sink in", no "it\'s not X, it\'s Y" lines.';
  const SHAPE = '{"title":"...","hook":"...","outline":["..."],"thumb":"2 to 5 words for the thumbnail or cover","caption":"Reels only","body":"Written Posts only, the whole post","why":"one line on why it should work, naming the original"}';
  function remixPrompt(post, formats) {
    return [
      'A POST THAT ALREADY WORKED FOR SOMEONE ELSE',
      `Title: ${post.title}`, `Creator: ${post.author || 'unknown'}`, `Result: ${post.views || '?'} ${unitOf(post)}, ${post.outlier || '?'}x their own median`, `Platform: ${post.platform || ''} ${post.format || ''}`, `Pattern: ${R.pattern(post.title).name}`, '',
      'Remix it into one idea for each of these formats:',
      ...formats.map((f) => `- ${f}: ${(FORMATS.find((x) => x[0] === f) || [])[3]}`), '', RULES, '',
      `Return JSON only: {"ideas":[{"format":"one of ${formats.join(', ')}", ...${SHAPE}}]}`,
    ].join('\n');
  }
  function morningPrompt(fmt, proven, taken, n) {
    const spec = (FORMATS.find((x) => x[0] === fmt) || [])[3];
    return [
      'RESEARCH AND MY OWN MEASURED RESULTS (numbered; each comparison is labeled)',
      ...proven.slice(0, 30).map((p, i) => `${i + 1}. "${p.title}" by ${p.author || '?'}, ${p.outlier}x ${p.own ? 'a similarly aged comparison group on my own channel. ' + (p.comparison || '') : 'their own median'}, ${Number(p.views || 0).toLocaleString('en-US')} ${unitOf(p)} (${p.platform || ''} ${p.format || ''})`), '',
      taken.length ? 'ALREADY ON MY BOARD, do not repeat these:\n' + taken.slice(0, 60).map((t) => '- ' + t).join('\n') + '\n' : '',
      `Give me ${n} new ideas for this format: ${NAME[fmt]}. ${spec}`,
      `Each idea starts from one of the supplied posts above, by its number. Use at least ${Math.min(6, proven.length)} different posts. Each idea needs a different angle.`, RULES, '',
      `Return JSON only: {"ideas":[{"from":1, ...${SHAPE}}]}`,
    ].filter(Boolean).join('\n');
  }
  // A long answer can stop mid idea. Keep every idea that closed.
  function salvage(t) {
    for (let i = t.lastIndexOf('},'); i > 0; i = t.lastIndexOf('},', i - 1)) {
      try { return JSON.parse(t.slice(0, i + 1) + ']}'); } catch { /* try the idea before */ }
    }
    return null;
  }
  function parse(text, allowed, fallbackFmt) {
    const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    let j; try { j = JSON.parse(m[0]); } catch { j = salvage(String(text).slice(String(text).indexOf('{'))); } if (!j) return null;
    const xs = (Array.isArray(j.ideas) ? j.ideas : []).filter((i) => i && i.title);
    const ok = new Set(allowed || IDS);
    const out = xs.map((i) => {
      const fmt = ok.has(i.format) ? i.format : fallbackFmt; if (!fmt) return null;
      const outline = (Array.isArray(i.outline) ? i.outline : []).map((t) => tidy(t).slice(0, 260)).filter(Boolean).slice(0, 10);
      return { format: fmt, from: Number(i.from) || null, title: tidy(i.title).slice(0, 200), hook: tidy(i.hook).slice(0, 600), outline, ...(fmt === 'reel' && i.caption ? { caption: tidy(i.caption).slice(0, 600) } : {}), ...(fmt === 'post' ? { post_body: String(i.body || '').replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/!+/g, '.').trim().slice(0, 4000) } : {}), why: tidy(i.why).slice(0, 300), ...(i.thumb && tidy(i.thumb).split(' ').length <= 8 ? { thumb: tidy(i.thumb).replace(/[.!]+$/, '').slice(0, 60) } : {}) };
    }).filter(Boolean);
    return out.length ? out : null;
  }

  const api = { FORMATS: FORMATS.map(([id, name, short]) => ({ id, name, short })), IDS, NAME, formatFor, nativeOf, unitOf, topicOf, fromPost, row, morning, remixPrompt, morningPrompt, parse, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OSIdeas = api;
})(typeof window !== 'undefined' ? window : globalThis);

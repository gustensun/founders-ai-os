// Founders AI OS post writer: turns a video that beat its median into written posts.
// With Claude, OpenAI or Perplexity connected the server writes them from the transcript and the Brand DNA, in the
// founder's voice. This file holds the prompt and the fallback that works with no AI key: it pulls the
// strongest lines out of the transcript (or builds from the remix brief) and shapes them into posts.
// Runs in the browser (window.PostWriter) and on the server (require).
(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('./remix.js') : root.Remix;
  const STOP = new Set('a an and or but if then so to of in on for with at by from as is are was were be been it its this that these those i you he she we they me my your our their them us not no do does did have has had can could will would should just like really very gonna wanna um uh yeah okay ok right so actually basically literally'.split(' '));

  // Plain text the founder would actually type: no em dashes, no exclamation points, no emojis.
  function tidy(s) {
    return String(s || '')
      .replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s--\s/g, ', ')
      .replace(/!+/g, '.').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/[ \t]+/g, ' ').replace(/ ?, ?,/g, ',').replace(/\.{2,}(?!\.)/g, '.').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  const words = (s) => (String(s || '').toLowerCase().match(/[a-z0-9$%']+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
  const cap = (s) => { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const end = (s) => { s = String(s || '').trim(); return /[.?]$/.test(s) ? s : s + '.'; };

  function sentencesOf(t) {
    const flat = String(t || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    return flat.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/).map((s) => s.trim()).filter((s) => { const n = s.split(' ').length; return n >= 7 && n <= 34; });
  }
  // Lines worth quoting: on topic, concrete (numbers, names, first person), not filler.
  function strongLines(transcript, title, n = 6) {
    const S = sentencesOf(transcript); if (!S.length) return [];
    const tw = new Set(words(title));
    const scored = S.map((s, i) => {
      const w = words(s); let sc = 0;
      w.forEach((x) => { if (tw.has(x)) sc += 2; });
      if (/\$?\d/.test(s)) sc += 2;
      if (/^(i|i'm|i've|my|we|when i|if i|the first|the biggest|the one|here's|this is)\b/i.test(s)) sc += 1.5;
      if (/\b(because|so that|which means|the reason|that's why|instead)\b/i.test(s)) sc += 1;
      if (/\b(subscribe|like this video|comment below|link in the description|sponsor|let's get into it|welcome back|in this video)\b/i.test(s)) sc -= 6;
      if (/\b(um|uh|you know|kind of|sort of)\b/i.test(s)) sc -= 1;
      if ((s.match(/"/g) || []).length % 2) sc -= 5;
      if (/\b(i said|i mean|i think i made a mistake|as i said|like i said)\b/i.test(s)) sc -= 3;
      return { s, i, sc: sc + Math.min(w.length, 14) / 14 };
    }).filter((x) => x.sc > 1.5);
    const pick = []; const seen = [];
    scored.sort((a, b) => b.sc - a.sc).forEach((x) => {
      if (pick.length >= n) return;
      const ws = new Set(words(x.s)); if (seen.some((o) => { let k = 0; ws.forEach((w) => { if (o.has(w)) k++; }); return k / Math.max(1, ws.size) > 0.5; })) return;
      seen.push(ws); pick.push(x);
    });
    return pick.sort((a, b) => a.i - b.i).map((x) => end(cap(tidy(x.s.replace(/\b(uh|um|you know|like,)\s+/gi, '').replace(/^(and|so|but|okay|alright)\s+/i, '')))));
  }

  function ctaFor(offer, funnel) {
    if (!offer) return '';
    const m = R && R.money ? R.money(offer) : '';
    return `If you want the full system behind this, it's inside ${offer.name}${m ? ' (' + m + ')' : ''}. Link in the comments.`;
  }

  // The fallback: two long posts with different angles and one short post.
  function rules(o) {
    const v = o.video || {}; const own = { offers: o.offers || [], funnels: o.funnels || [] };
    const b = R.brief({ title: v.title, author: v.author, views: v.views, outlier: v.x || v.outlier, platform: 'youtube', format: 'long' }, own, o.pool || []);
    const lines = strongLines(o.transcript, v.title, 7);
    const cta = ctaFor(b.offer, b.funnel);
    const steps = b.outline.filter((x) => !/^call to action/i.test(x)).slice(0, 4);
    const fromVideo = lines.length >= 3;
    const longA = [
      end(fromVideo ? lines[0] : b.hook), '',
      ...(fromVideo ? lines.slice(1, 5) : steps.map((x, i) => `${i + 1}. ${end(x)}`)), '',
      fromVideo ? end(lines[5] || 'Most people skip this part. It is the part that matters') : 'Most people skip step one. That is where it falls apart.', '',
      cta,
    ];
    const lesson = fromVideo ? lines.slice(-3) : steps.slice(-3).map(end);
    const longB = [
      end(fromVideo ? 'The part of this video people keep asking me about' : (b.titles[1] || b.titles[0])), '',
      `I made a video on this and it did ${v.x ? Math.round(v.x * 10) / 10 + 'x' : 'better than'} my usual numbers. Here's the short version.`, '',
      ...lesson.map((x) => '- ' + x.replace(/^\d+\.\s*/, '')), '',
      'Save this for the next time you sit down to build.', '',
      cta,
    ];
    const short = [end(fromVideo ? (lines[1] || lines[0]) : (b.titles[2] || b.titles[0])), '', end(fromVideo ? lines[lines.length-1] : b.hook), cta ? '\n' + cta : ''];
    const mk = (format, angle, title, body) => ({ format, angle, title: tidy(title).slice(0, 140), body: tidy(body.join('\n')) });
    return {
      by: 'Rules', pattern: b.pattern, offer: b.offer ? b.offer.name : null, used_transcript: fromVideo,
      posts: [mk('long', 'The plan', fromVideo ? v.title : b.titles[0], longA), mk('long', 'The lesson', fromVideo ? 'Lesson: ' + v.title : (b.titles[1] || b.titles[0]), longB), mk('short', 'One line', fromVideo ? 'Short: ' + v.title : (b.titles[2] || b.titles[0]), short)],
    };
  }

  // What the AI is asked for. The Brand DNA (voice, offers, funnels, facts) goes in front of this.
  function prompt(o) {
    const v = o.video || {};
    const t = String(o.transcript || '').slice(0, o.max || 16000);
    return [
      'A VIDEO THAT BEAT ITS USUAL NUMBERS',
      `Title: ${v.title}`,
      `Channel: ${v.author || 'my channel'}${v.own ? ' (this is my own video)' : ' (another creator, use the idea and the structure, never their story as mine)'}`,
      `Result: ${v.views || '?'} views, ${v.x || v.outlier || '?'}x the channel's median`,
      o.pattern ? `Pattern behind it: ${o.pattern}` : '',
      o.description ? `Description:\n${String(o.description).slice(0, 1500)}` : '',
      t ? `Transcript${t.length >= (o.max || 16000) ? ' (first part)' : ''}:\n${t}` : 'No transcript. Work from the title, the pattern and what you know about me from the DNA.',
      '',
      'Write three written posts from this video, as me, in my voice as described under HOW I WRITE.',
      '1. A long post for LinkedIn, Facebook or my community, 150 to 260 words. Angle: the plan or the steps.',
      '2. A second long post, 120 to 220 words, with a different angle: the lesson, the mistake or the story.',
      '3. A short post for X or Threads, under 280 characters.',
      'Rules: first line is the hook and must stand alone. Short lines, white space between ideas. Use real details, numbers and examples from the transcript or my DNA, never invent results. ' + (v.own ? 'This is my video, so my stories in it are mine to tell.' : 'This is someone else\'s video, so take the idea, make it mine, and never claim their results.') + ' Where it fits, end with one soft call to action to the one offer from my DNA that matches the topic, by its exact name. No hashtags, no emojis, no disclaimers, no em dashes, no exclamation points, no "here\'s the thing", no "let that sink in", no "it\'s not X, it\'s Y" lines.',
      'Return JSON only: {"posts":[{"format":"long"|"short","angle":"two or three words","title":"a short internal name","body":"the post","offer":"offer name or null"}]}',
    ].filter(Boolean).join('\n');
  }

  function parse(text) {
    const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    let j; try { j = JSON.parse(m[0]); } catch { return null; }
    const posts = (Array.isArray(j.posts) ? j.posts : []).filter((p) => p && p.body).slice(0, 4).map((p) => ({ format: p.format === 'short' ? 'short' : 'long', angle: tidy(p.angle || '').slice(0, 40), title: tidy(p.title || p.body.split('\n')[0]).slice(0, 140), body: tidy(p.body).slice(0, 4000), offer: p.offer && p.offer !== 'null' ? tidy(p.offer).slice(0, 120) : null }));
    return posts.length ? posts : null;
  }

  const api = { rules, prompt, parse, tidy, strongLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PostWriter = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Founders AI OS voiceprint: studies writing the founder pasted in and turns it into rules an agent can follow.
// Pure functions, no network. Runs in the browser and in Node.
(function (root) {
  const STOP = new Set(('a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves im ive id ill youre youve youll dont doesnt didnt cant wont isnt arent wasnt thats theres heres whats lets get got go going one two also really thing things way much many even still make made like know want need see say said back well right yeah ok okay every lot something anything').split(' '));
  const SLOP = ['delve', 'unlock', 'unleash', 'elevate', 'leverage', 'game-changer', 'seamless', 'robust', 'tapestry', 'landscape', 'navigate', 'empower', 'furthermore', 'moreover', 'harness', 'realm', 'embark', 'supercharge', 'cutting-edge', 'revolutionize', 'testament', 'pivotal', 'synergy', 'holistic'];
  const KINDS = { email: 'Email', post: 'Post', script: 'Script', caption: 'Caption', page: 'Sales page', newsletter: 'Newsletter', message: 'Message', other: 'Other' };

  const clean = (t) => String(t || '').replace(/\r/g, '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  const wordsOf = (t) => (clean(t).match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || []);
  const count = (t) => wordsOf(t).length;
  function sentences(t) {
    return clean(t).split(/\n+/).flatMap((line) => line.replace(/^\s*([-*\u2022]|\d+[.)])\s+/, '').split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/)).map((s) => s.trim()).filter((s) => count(s) > 0);
  }
  function syllables(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
  }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const per = (a, b, n) => (b ? Math.round((a / b) * n * 10) / 10 : 0);
  const top = (m, n, min = 1) => Object.entries(m).filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, n);

  function analyze(samples) {
    const xs = (samples || []).filter((s) => s && s.body && s.body.trim());
    const all = xs.map((s) => clean(s.body)).join('\n\n');
    const W = wordsOf(all), nW = W.length;
    if (nW < 20) return null;
    const S = xs.flatMap((s) => sentences(s.body));
    const lens = S.map(count).sort((a, b) => a - b);
    const nS = S.length || 1;
    const avg = Math.round((lens.reduce((a, b) => a + b, 0) / nS) * 10) / 10;
    const median = lens[Math.floor(lens.length / 2)] || 0;
    const paras = xs.flatMap((s) => clean(s.body).split(/\n\s*\n/)).map((p) => p.trim()).filter((p) => count(p) > 0 && !/^\s*([-*\u2022]|\d+[.)])\s/.test(p));
    const pSent = paras.map((p) => sentences(p).length);
    const syl = W.reduce((a, w) => a + syllables(w), 0);
    const grade = Math.max(1, Math.round((0.39 * (nW / nS) + 11.8 * (syl / nW) - 15.59) * 10) / 10);
    const lower = W.map((w) => w.toLowerCase());
    const has = (re) => lower.filter((w) => re.test(w)).length;
    const lines = all.split('\n').filter((l) => l.trim());
    const stats = {
      words: nW, samples: xs.length, sentences: S.length,
      avg_sentence: avg, median_sentence: median,
      short_pct: pct(lens.filter((l) => l <= 8).length, nS), long_pct: pct(lens.filter((l) => l >= 25).length, nS),
      para_sentences: pSent.length ? Math.round((pSent.reduce((a, b) => a + b, 0) / pSent.length) * 10) / 10 : 0,
      one_line_pct: pct(pSent.filter((n) => n === 1).length, pSent.length),
      grade,
      question_pct: pct(S.filter((s) => /\?["')\]]*$/.test(s)).length, nS),
      exclaim_per100: per((all.match(/!/g) || []).length, nS, 100),
      emdash_per1k: per((all.match(/\u2014|\s--\s/g) || []).length, nW, 1000),
      ellipsis_per1k: per((all.match(/\.\.\.|\u2026/g) || []).length, nW, 1000),
      contraction_per100: per(has(/^[a-z]+'(s|t|re|ve|ll|d|m)$/), nW, 100),
      you_per100: per(has(/^(you|your|yours|you're|you've|you'll|yourself)$/), nW, 100),
      i_per100: per(has(/^(i|me|my|mine|i'm|i've|i'll|i'd|myself)$/), nW, 100),
      we_per100: per(has(/^(we|our|us|we're|we've)$/), nW, 100),
      list_pct: pct(lines.filter((l) => /^\s*([-*\u2022]|\d+[.)])\s+/.test(l)).length, lines.length),
      caps_per1k: per(W.filter((w) => w.length > 2 && /^[A-Z]+$/.test(w) && !/^(AI|CEO|SEO|USD|CTA|VSL|SOP|API|MCP|GHL|DM|YT|ROI|KPI|SaaS)$/.test(w)).length, nW, 1000),
      emoji_per1k: per((all.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length, nW, 1000),
    };
    // how sentences start
    const op = {}; S.forEach((s) => { const w = (wordsOf(s)[0] || '').toLowerCase(); if (w) op[w] = (op[w] || 0) + 1; });
    const openers = top(op, 8, 2).filter(([w]) => !/^(the|a|an|it|this|that|i)$/.test(w)).slice(0, 6).map(([w, n]) => ({ w, share: pct(n, nS) }));
    // phrases that come back, counted once per sample so one long piece cannot fake a habit
    const grams = {}, inSamples = {};
    xs.forEach((s, k) => {
      const ws = wordsOf(s.body).map((w) => w.toLowerCase()); const seen = new Set();
      for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= ws.length; i++) {
        const g = ws.slice(i, i + n); const content = g.filter((w) => !STOP.has(w.replace(/'/g, ''))).length;
        if (n === 2 ? content < 2 : content < 1 || /^(the|a|an|of|and|to|in)$/.test(g[0]) || STOP.has(g[n - 1].replace(/'/g, '')) && content < 2) continue;
        if (g.some((w) => /^\d+$/.test(w))) continue;
        const key = g.join(' '); grams[key] = (grams[key] || 0) + 1; if (!seen.has(key)) { seen.add(key); inSamples[key] = (inSamples[key] || 0) + 1; }
      }
    });
    const minS = xs.length >= 3 ? 2 : 1;
    let phrases = Object.keys(grams).filter((g) => grams[g] >= 2 && inSamples[g] >= minS && g.split(' ').length >= 2)
      .sort((a, b) => (grams[b] * b.split(' ').length) - (grams[a] * a.split(' ').length));
    // stitch overlapping pieces back into the full phrase: "copy what works make" + "works make it yours"
    const pool = phrases.slice(0, 60); let merged = true; const joined = xs.map((s) => ' ' + wordsOf(s.body).map((w) => w.toLowerCase()).join(' ') + ' ');
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
        if (i === j) continue; const a = pool[i].split(' '), b = pool[j].split(' ');
        for (let k = Math.min(a.length, b.length) - 1; k >= 1; k--) {
          if (a.slice(-k).join(' ') === b.slice(0, k).join(' ')) {
            const m = a.concat(b.slice(k)).join(' ');
            if (m.split(' ').length <= 7 && joined.some((t) => t.includes(' ' + m + ' '))) {
              grams[m] = Math.min(grams[pool[i]], grams[pool[j]]); pool.splice(Math.max(i, j), 1); pool.splice(Math.min(i, j), 1, m); merged = true; break outer;
            }
          }
        }
      }
    }
    phrases = pool.filter((g, i) => !pool.slice(0, i).some((h) => h.includes(g) || g.includes(h))).slice(0, 8).map((p) => ({ p, n: grams[p] }));
    const fw = {}; lower.forEach((w) => { const k = w.replace(/'/g, ''); if (k.length > 3 && !STOP.has(k) && !/^\d+$/.test(k)) fw[k] = (fw[k] || 0) + 1; });
    const words = top(fw, 14, 2).map(([w, n]) => ({ w, n }));
    const never = SLOP.filter((w) => !lower.some((x) => x.startsWith(w.replace(/-/g, '')) || x === w));
    const kinds = {}; xs.forEach((s) => { kinds[s.kind || 'other'] = (kinds[s.kind || 'other'] || 0) + 1; });
    return { stats, openers, phrases, words, never, kinds };
  }

  function guide(p) {
    if (!p) return [];
    const s = p.stats, g = [];
    g.push(`Sentences average ${s.avg_sentence} words${s.short_pct >= 30 ? `, and ${s.short_pct}% are eight words or fewer. Use short, punchy lines and let a longer one carry the explanation` : s.long_pct >= 25 ? `. Longer, flowing sentences are normal here, ${s.long_pct}% run past 25 words` : '. Keep a steady, plain rhythm'}.`);
    if (s.para_sentences) g.push(s.one_line_pct >= 40 ? `Paragraphs are short. ${s.one_line_pct}% are a single line, so give each idea its own line.` : `Paragraphs hold about ${s.para_sentences} sentences.`);
    g.push(`Reads at about grade ${Math.round(s.grade)}. ${s.grade <= 7 ? 'Plain, everyday words.' : s.grade <= 10 ? 'Clear words, a few precise terms where they help.' : 'Comfortable with denser, more technical language.'}`);
    if (s.you_per100 >= 2.5 && s.you_per100 >= s.i_per100) g.push(`Talks straight to the reader as "you" (${s.you_per100} per 100 words)${s.i_per100 >= 1.5 ? ', and brings in "I" for my own stories and results' : ''}.`);
    else if (s.i_per100 >= 2) g.push(`Writes from "I", first person, with personal experience up front (${s.i_per100} per 100 words)${s.you_per100 >= 1 ? ', then turns it to "you"' : ''}.`);
    if (s.we_per100 >= 1.5) g.push(`Uses "we" and "our" often (${s.we_per100} per 100 words).`);
    g.push(s.contraction_per100 >= 2 ? `Uses contractions (I'm, don't, you'll). It should sound spoken.` : s.contraction_per100 < 0.6 ? 'Few contractions. Slightly more formal than speech.' : 'Some contractions, used naturally.');
    if (s.question_pct >= 8) g.push(`Asks the reader questions, about ${s.question_pct}% of sentences.`);
    g.push(s.emdash_per1k < 0.3 ? 'No em dashes. Use a period or a comma instead.' : `Uses dashes now and then (${s.emdash_per1k} per 1,000 words).`);
    g.push(s.exclaim_per100 < 1 ? 'Almost never uses exclamation points.' : s.exclaim_per100 >= 8 ? `Energetic, with exclamation points in about ${Math.round(s.exclaim_per100)} of every 100 sentences.` : 'An exclamation point only when it really matters.');
    if (s.emoji_per1k >= 2) g.push('Uses emojis.'); else g.push('No emojis.');
    if (s.list_pct >= 15) g.push('Breaks steps and points into short lists.');
    if (s.caps_per1k >= 2) g.push('Puts the odd word in CAPS for emphasis.');
    if (p.openers && p.openers.length) g.push(`Often starts sentences with ${p.openers.slice(0, 5).map((o) => '"' + o.w.charAt(0).toUpperCase() + o.w.slice(1) + '"').join(', ')}.`);
    if (p.phrases && p.phrases.length) g.push(`Signature phrases: ${p.phrases.slice(0, 6).map((x) => '"' + x.p + '"').join(', ')}.`);
    if (p.words && p.words.length) g.push(`Leans on these words: ${p.words.slice(0, 10).map((x) => x.w).join(', ')}.`);
    if (p.never && p.never.length) g.push(`Never uses ${p.never.slice(0, 10).join(', ')}. Keep them out.`);
    return g;
  }

  // The same DNA section the database writes, for the demo.
  function dnaSection(samples, g) {
    const xs = (samples || []).filter((s) => s && s.body); if (!xs.length) return '';
    const words = xs.reduce((a, s) => a + (s.words || count(s.body)), 0);
    const ex = xs.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)).slice(0, 3)
      .map((s) => `--- ${(KINDS[s.kind] || 'Other').replace(/^Sales page$/, 'Page')}: ${s.title}\n${s.body.length > 900 ? s.body.slice(0, 900) + ' [...]' : s.body}`);
    return [`HOW I WRITE (studied from ${xs.length} piece${xs.length === 1 ? '' : 's'} I wrote myself, ${words.toLocaleString('en-US')} words). Write like this. Match the rhythm, the moves and the word choice. Never copy my lines word for word.`,
      ...(g || []).map((x) => '- ' + x), '', 'EXAMPLES OF MY OWN WRITING', ex.join('\n\n')].join('\n');
  }

  const api = { analyze, guide, dnaSection, count, KINDS, SLOP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Voiceprint = api;
})(typeof window !== 'undefined' ? window : globalThis);

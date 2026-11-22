// Founders AI OS remix engine. Reads a post that already worked for someone else, names the pattern behind it,
// and writes the founder's own version pointed at one of their offers and funnels. Works without any AI key.
// The same file runs in the browser (window.Remix) and on the server (require).
(function (root) {
  const STOP = new Set('a an and or but if then so to of in on for with at by from as is are was were be been it its this that these those i you he she we they me my your our their them us not no do does did have has had can could will would should just how what why when who which into out up about over than more most very really get got make made use using here there all any every one two three four five six seven eight nine ten new best ever like only'.split(' '));

  const PATTERNS = [
    ['start-over', 'Start-over plan', /if i (had to )?start(ed)? over|from scratch|if i were starting|starting over|start again/i, 'Shows the exact plan the viewer would follow, from zero.'],
    ['challenge', 'Time-boxed challenge', /\bin \d+ (days?|hours?|minutes?|weeks?)\b|\bcan i\b|\bi tried\b.*\bfor \d+/i, 'A deadline and a real attempt make people stay to see the result.'],
    ['time-trade', 'Time trade promise', /give me \d+|in \d+ minutes|\d+ hours of/i, 'Promises a big payoff for a small, named amount of time.'],
    ['list', 'Numbered list', /(^|\s)\d+\s+(\w+\s){0,3}(ways|things|lessons|mistakes|tools|steps|ideas|rules|habits|reasons|signs|skills|apps|prompts|hacks|secrets|truths|questions)\b|^\d+\s/i, 'A number sets a clear promise and makes the content easy to scan.'],
    ['comparison', 'Comparison', /\bvs\.?\b|\bversus\b|\bor\b.*\?$/i, 'Two named options give the viewer a decision to make.'],
    ['how-i', 'Personal case study', /^(how )?i (built|made|replaced|use|used|grew|went|spent|tried|got|turned|run)\b|^how i\b|^my\b/i, 'First-person proof. The viewer gets to copy what already worked.'],
    ['how-to', 'How-to', /^how to\b|\bstep by step\b|\btutorial\b|\bguide\b/i, 'A clear outcome and a promise of the steps.'],
    ['callout', 'Direct call-out', /^if you\b|\bif you (have|are|want)\b|\bplease\b|\bfor people who\b/i, 'Speaks to one kind of person so they feel picked out.'],
    ['news', 'News and update', /\bjust (changed|dropped|launched|released|got)\b|\bupdate\b|\bnew\b.*\b(feature|update|model)\b|\bforever\b/i, 'Timing. People want to know what changed before everyone else.'],
    ['contrarian', 'Contrarian take', /\bstop\b|\bnever\b|\bdon'?t\b|\bdumb\b|\bwrong\b|\blies?\b|\bmyth\b|\bnobody\b|\btruth\b|\boverrated\b|\bbroke\b|\bquit\b/i, 'Pushes against what the audience already believes, so they want to hear why.'],
    ['question', 'Question hook', /\?\s*$/, 'Opens a question the viewer wants answered.'],
  ];
  const STATEMENT = ['statement', 'Bold statement', null, 'One confident claim, then the proof.'];
  function pattern(title) { const t = String(title || ''); const p = PATTERNS.find((x) => x[2].test(t)) || STATEMENT; return { id: p[0], name: p[1], why: p[3] }; }

  const words = (s) => (String(s || '').toLowerCase().replace(/[^a-z0-9$ ]+/g, ' ').match(/[a-z0-9$]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
  const num = (t) => { const m = String(t || '').match(/\b(\d{1,3})\b/); return m ? +m[1] : null; };

  // What the founder talks about, in two or three words, picked from the offer and the post.
  const TOPICS = [[/highlevel|gohighlevel|ghl/i, 'HighLevel'], [/claude/i, 'Claude'], [/youtube/i, 'YouTube'], [/funnel/i, 'funnels'], [/low.?ticket/i, 'low ticket offers'], [/\bai\b|artificial/i, 'AI'], [/vibe cod/i, 'vibe coding'], [/brand/i, 'a personal brand'], [/lead/i, 'lead generation'], [/outreach|client|closing|dm/i, 'getting clients'], [/course|academy|university/i, 'online courses'], [/template/i, 'funnel templates'], [/saas|software/i, 'software']];
  function topicOf(offer, post) {
    const hay = [offer && offer.name, offer && offer.summary].filter(Boolean).join(' ');
    const hit = TOPICS.find(([rx]) => rx.test(hay)) || TOPICS.find(([rx]) => rx.test(String(post && post.title || '')));
    return hit ? hit[1] : (offer && offer.name) || 'my business';
  }
  function outcomeOf(offer) {
    const s = String((offer && (offer.name + ' ' + (offer.summary || ''))) || '').toLowerCase();
    if (/client|outreach|clos|lead/.test(s)) return 'get clients';
    if (/funnel|template|conversion/.test(s)) return 'sell online';
    if (/youtube|brand|content/.test(s)) return 'grow a personal brand';
    if (/ai|claude|vibe/.test(s)) return 'build with AI';
    if (/course|academy|university|product|bundle/.test(s)) return 'launch a digital product';
    return 'grow a one-person business';
  }

  function match(post, offers, funnels) {
    const pw = new Set(words(post.title + ' ' + (post.author || '')));
    const score = (o) => words(o.name + ' ' + (o.summary || '')).reduce((n, w) => n + (pw.has(w) ? 1 : 0), 0);
    const live = (offers || []).filter((o) => o.included !== false);
    const ranked = live.map((o) => ({ o, s: score(o) })).sort((a, b) => b.s - a.s || (b.o.price || 0) - (a.o.price || 0));
    // No word overlap: point at the founder's own core offer, the middle of the ladder, never an affiliate link.
    const own = live.filter((o) => !/affiliate|via (your|my) link|commission|recurring to me|i earn/i.test([o.name, o.summary, o.price_note, o.stream].join(' ')));
    const core = (own.length ? own : live).slice().sort((a, b) => (a.price || 0) - (b.price || 0));
    const offer = ranked.length ? (ranked[0].s ? ranked[0].o : core[Math.floor((core.length - 1) / 2)]) : null;
    const fl = (funnels || []).filter((f) => f.included !== false);
    let funnel = null;
    if (fl.length) {
      const ow = new Set(words(offer ? offer.name : post.title));
      funnel = fl.map((f) => ({ f, s: words(f.name).reduce((n, w) => n + (ow.has(w) ? 1 : 0), 0) })).sort((a, b) => b.s - a.s)[0].f;
    }
    return { offer, funnel };
  }

  const TITLES = {
    'start-over': (x, n, o) => [`How I would ${o} with ${x} if I had to start over`, `Starting ${x} from zero in 2027: my exact plan`, `If I lost everything, this is how I would use ${x} again`],
    challenge: (x, n, o) => [`Can I ${o} with ${x} in 7 days?`, `I gave myself 48 hours to ${o} with ${x}`, `${cap(x)} from zero to first sale in 30 days`],
    'time-trade': (x, n, o) => [`Give me 20 minutes and I will show you everything I know about ${x}`, `${cap(x)} in 15 minutes: everything that matters`, `The 20-minute ${x} course I wish I had`],
    list: (x, n, o) => [`${n || 7} ways I use ${x} to ${o}`, `${n || 5} ${x} mistakes that cost me money`, `${n || 7} things I would set up first with ${x}`],
    comparison: (x, n, o) => [`${cap(x)} or doing it by hand: the real numbers`, `I tested ${x} against my old setup. Here is what won`, `${cap(x)} compared: which one I would pay for`],
    'how-i': (x, n, o) => [`How I use ${x} to ${o}`, `I rebuilt my business around ${x}. Here is what happened`, `My exact ${x} setup, start to finish`],
    'how-to': (x, n, o) => [`How to ${o} with ${x}, step by step`, `How to set up ${x} in one afternoon`, `The beginner guide to ${x} for founders`],
    callout: (x, n, o) => [`If you want to ${o}, learn ${x} next`, `If you are a solo founder, please look at ${x}`, `For founders who feel behind on ${x}`],
    news: (x, n, o) => [`${cap(x)} just changed. What it means for founders`, `The new ${x} update, tested on my business`, `What changed in ${x} this month, and what I am doing about it`],
    contrarian: (x, n, o) => [`Most ${x} advice is too complicated`, `The ${x} advice I am glad I ignored`, `Why I stopped overthinking ${x}`],
    question: (x, n, o) => [`Do you need ${x} to ${o}?`, `Is ${x} worth it in 2027?`, `What would you build first with ${x}?`],
    statement: (x, n, o) => [`${cap(x)} is the skill every founder needs in 2027`, `${cap(x)} paid for my year. Here is how`, `The simplest way to ${o} with ${x}`],
  };
  const BEATS = {
    'start-over': ['The result I have today, on screen', 'Day 1: the one thing I would set up first', 'Weeks 1 to 4: the offer and the page', 'Months 2 and 3: content that sells it', 'The mistake I would skip this time'],
    challenge: ['The rule and the deadline, stated in 10 seconds', 'Start: what I had and what I did not', 'The build, sped up, with the hard parts kept in', 'The result, with real numbers', 'What I would do differently'],
    'time-trade': ['The promise: what they will know at the end', 'Part 1: the basics nobody explains well', 'Part 2: the setup, live', 'Part 3: the advanced move most people skip', 'Where to go next'],
    list: ['The payoff of the whole list, in one line', 'Items 1 to 3: quick wins', 'The middle items: the ones that make money', 'The last item, the one I use most', 'Which one to start with'],
    comparison: ['The decision the viewer is trying to make', 'Option A, tested', 'Option B, tested', 'The numbers side by side', 'My pick, and who should pick the other one'],
    'how-i': ['The result first', 'Where I started and why it was not working', 'The setup, step by step', 'What it costs and what it brings in', 'How they can copy it'],
    'how-to': ['The finished result on screen', 'What you need before you start', 'Steps, one screen at a time', 'The step most people get wrong', 'The next step'],
    callout: ['Name the person this is for', 'The problem they have right now', 'What I would tell a friend in their spot', 'One example from my own business', 'The first move to make today'],
    news: ['What changed, in one sentence', 'Why it matters for founders', 'Tested live on my own account', 'What I am changing because of it', 'What to do this week'],
    contrarian: ['The common advice, stated fairly', 'Where it broke for me', 'What I do now, with proof', 'An example they can check', 'The simple version to start with'],
    question: ['The question, and the short answer', 'The case for yes', 'The case for no', 'What I decided and why', 'How to decide for yourself'],
    statement: ['The claim', 'Proof from my own numbers', 'How it works', 'Who it is for and who should skip it', 'The first step'],
  };
  const HOOKS = {
    'start-over': (x) => `If I had to start over tomorrow with nothing but ${x}, this is exactly what I would do.`,
    challenge: (x) => `I gave myself one week and ${x}. Here is what happened.`,
    'time-trade': (x) => `Give me the next few minutes and you will understand ${x} better than most people who sell it.`,
    list: (x, n) => `These are the ${n || 7} ${x} setups I use every week, with the numbers on screen.`,
    comparison: (x) => `I ran ${x} side by side with my old setup for a month. One of them clearly won.`,
    'how-i': (x) => `This is the exact ${x} setup I run my business on.`,
    'how-to': (x) => `By the end of this you will have ${x} set up and working.`,
    callout: (x) => `If you are a founder and ${x} still feels confusing, this one is for you.`,
    news: (x) => `${cap(x)} changed this week, and it matters more than it looks.`,
    contrarian: (x) => `Most of what you hear about ${x} makes it harder than it needs to be.`,
    question: (x) => `Do you actually need ${x}? I will give you my honest answer in the first minute.`,
    statement: (x) => `${cap(x)} is the best skill I picked up this year, and I can prove it.`,
  };
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  const money = (o) => (o && o.price != null ? (o.currency === 'EUR' ? '€' : o.currency === 'GBP' ? '£' : '$') + Number(o.price).toLocaleString('en-US', { maximumFractionDigits: 0 }) + (o.price_note ? ' ' + o.price_note : '') : '');
  const unitOf = (p) => (/^(x|linkedin|facebook|newsletter)$/.test((p && p.platform) || '') ? 'reactions' : 'views');
  const fmtV = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));

  // post: { title, author, views, outlier, platform, format, url }. dna: { offers, funnels }. pool: other proven posts, to count the pattern.
  function brief(post, dna, pool, opts) {
    dna = dna || {}; const p = pattern(post.title); const { offer, funnel } = match(post, dna.offers, dna.funnels);
    const x = (opts && opts.topic) || topicOf(offer, post); const o = outcomeOf(offer); const n = num(post.title);
    const same = (pool || []).filter((q) => q !== post && pattern(q.title).id === p.id);
    const fmt = /short|reel/.test(post.format || '') ? 'short' : post.platform === 'instagram' && post.format === 'carousel' ? 'carousel' : 'video';
    return {
      pattern: p, offer, funnel, topic: x, format: fmt,
      titles: (TITLES[p.id] || TITLES.statement)(x, n, o),
      hook: (HOOKS[p.id] || HOOKS.statement)(x, n),
      outline: (BEATS[p.id] || BEATS.statement).concat(offer ? [`Call to action: ${offer.name}${money(offer) ? ' (' + money(offer) + ')' : ''}${funnel ? ', through ' + funnel.name : ''}`] : ['Call to action: one link, one next step']),
      cta: offer ? `Point viewers to ${offer.name}${money(offer) ? ' at ' + money(offer) : ''}${funnel ? ' through the ' + funnel.name + ' funnel' + (funnel.url ? ' (' + funnel.url + ')' : '') : ''}.` : 'Add an offer to your Brand DNA so every remix points somewhere.',
      proof: `${post.author || 'The creator'}${post.views ? ' got ' + fmtV(post.views) + ' ' + unitOf(post) : ' got this result'}${post.outlier ? ', ' + post.outlier + 'x their usual' : ''}.${same.length ? ' ' + same.length + ' other proven post' + (same.length === 1 ? '' : 's') + ' here use the same pattern.' : ''}`,
      why: p.why,
    };
  }
  function text(b, post) {
    return [`Remix of "${post.title}" by ${post.author || 'a creator'}`, `Pattern: ${b.pattern.name}. ${b.why}`, `Proof: ${b.proof}`, '', 'Title options:', ...b.titles.map((t, i) => `${i + 1}. ${t}`), '', 'Hook:', b.hook, '', 'Outline:', ...b.outline.map((t, i) => `${i + 1}. ${t}`), '', 'Sells: ' + b.cta].join('\n');
  }

  /* ---------- Remix one of the founder's own videos: same topic, new angle, new hook, new title ---------- */
  const OWN_TOPICS = [[/ai business/i, 'an AI business'], [/\$\s?10,?000|\$?10k\b|\/m\b|per month|a month/i, 'a $10K a month business'], [/ai studio/i, 'HighLevel AI Studio'], [/claude code/i, 'Claude Code'], [/money model/i, 'money models'], [/affiliate/i, 'affiliate income'], [/grok/i, 'Grok bots'], [/perplexity/i, 'Perplexity Computer'], [/gpt|astra/i, 'GPT-6 Astra'], [/opus|fable|claude design/i, 'designing with Claude'], [/lovable/i, 'Lovable apps'], [/web ?design|websites?|\bsites?\b/i, 'AI web design'], [/vibe cod/i, 'vibe coding'], [/apps?\b/i, 'AI apps']].concat(TOPICS);
  function ownTopic(title) {
    const t = String(title || ''); const hit = OWN_TOPICS.find(([rx]) => rx.test(t));
    if (hit) return hit[1];
    const w = words(t).filter((x) => !/^\d+$/.test(x) && !/^(insane|amazing|awesome|finally|just|now|game|changed|again|only|need)$/.test(x));
    return w.slice(0, 3).join(' ') || 'this topic';
  }
  // x is a noun phrase taken from the founder's own title, so every slot below reads with any topic.
  const OWN = {
    contrarian: (x) => [[`What everyone gets wrong about ${x}`, `The ${x} advice I stopped following`], `Most advice about ${x} makes it harder than it needs to be. Here is what I do instead.`],
    challenge: (x) => [[`${cap(x)}: a 7 day challenge, start to finish`, `I gave myself 48 hours with ${x}. Here is what happened`], `I gave myself seven days and one rule: ${x}, from zero, on camera.`],
    'start-over': (x) => [[`Starting over with ${x}: my exact plan for 2027`, `If I lost everything, this is how I would use ${x}`], `If I lost everything tomorrow, this is how I would use ${x} to get it back.`],
    comparison: (x) => [[`${cap(x)} vs the old way: the real numbers`, `I tested ${x} against my old setup. One clearly won`], `I ran ${x} side by side with how I used to do it. One of them clearly won.`],
    list: (x, n) => [[`${n && n < 20 ? n : 7} things I wish I knew about ${x}`, `${n && n < 20 ? n : 5} ${x} mistakes I made so you do not have to`], `These are the things about ${x} that took me the longest to learn.`],
    'how-i': (x) => [[`How I actually use ${x}, start to finish`, `My exact ${x} setup, with the numbers`], `This is exactly how I use ${x} in my own business, with the numbers on screen.`],
    question: (x) => [[`Is ${x} still worth it in 2027?`, `Do you really need ${x}? My honest answer`], `Is ${x} still worth your time? My honest answer is in the first minute.`],
    callout: (x) => [[`If you are new to ${x}, start here`, `For founders who feel behind on ${x}`], `If ${x} still feels confusing, this is the video I wish I had on day one.`],
    'how-to': (x) => [[`${cap(x)} for beginners, step by step`, `How to get ${x} working in one afternoon`], `By the end of this video you will have ${x} working for you.`],
    'time-trade': (x) => [[`Everything I know about ${x} in 15 minutes`, `The 15 minute ${x} course I wish I had`], `Give me 15 minutes and you will know everything I learned about ${x}.`],
    news: (x) => [[`What just changed in ${x}, and what I am doing about it`, `${cap(x)} this month: what matters and what to ignore`], `Something changed in ${x} this week, and it matters more than it looks.`],
    statement: (x) => [[`${cap(x)} is the best bet a founder can make in 2027`, `Why I am going all in on ${x}`], `${cap(x)} is the best bet I made this year, and I can show you the numbers.`],
  };
  const ANGLE_ORDER = ['contrarian', 'challenge', 'start-over', 'comparison', 'list', 'how-i', 'question', 'callout', 'how-to', 'time-trade', 'news', 'statement'];
  // How each title pattern does on the founder's own channel, from the synced uploads.
  function channelPatterns(videos) {
    const by = {};
    (videos || []).forEach((v) => { const id = pattern(v.title).id; const x = Number(v.x) || 0; (by[id] = by[id] || { id, n: 0, sum: 0 }); by[id].n++; by[id].sum += x; });
    return Object.values(by).map((r) => ({ id: r.id, n: r.n, avg: Math.round((r.sum / r.n) * 10) / 10, name: (PATTERNS.find((p) => p[0] === r.id) || STATEMENT)[1] })).sort((a, b) => b.avg - a.avg || b.n - a.n);
  }
  // video: { id, title, views, x }. dna: { offers, funnels }. videos: the founder's synced uploads.
  function remixOwn(video, dna, videos, count) {
    dna = dna || {}; const src = pattern(video.title); const x = ownTopic(video.title);
    const { offer, funnel } = match({ title: video.title }, dna.offers, dna.funnels);
    const n = src.id === 'list' ? num(video.title) : null;
    const perf = channelPatterns(videos); const pf = Object.fromEntries(perf.map((p) => [p.id, p]));
    // patterns that beat your median first, then the ones you have not tried, then the rest
    const order = ANGLE_ORDER.filter((id) => id !== src.id).sort((a, b) => {
      const sa = pf[a] ? (pf[a].avg >= 1 ? 2 + pf[a].avg : pf[a].avg) : 1.5; const sb2 = pf[b] ? (pf[b].avg >= 1 ? 2 + pf[b].avg : pf[b].avg) : 1.5;
      return sb2 - sa || ANGLE_ORDER.indexOf(a) - ANGLE_ORDER.indexOf(b);
    });
    const ideas = order.slice(0, count || 4).map((id) => {
      const p = PATTERNS.find((q) => q[0] === id) || STATEMENT; const [ts, hook] = (OWN[id] || OWN.statement)(x, n);
      const s = pf[id];
      return { pattern: { id, name: p[1] }, title: ts[0], alts: ts.slice(1), hook, outline: (BEATS[id] || BEATS.statement).slice(), why: p[3],
        evidence: s ? `${s.n} of your recent videos use this angle and average ${s.avg}x your median.` : 'You have not used this angle in your recent uploads. A fresh frame on a topic your audience already watched.' };
    });
    const stat = video.views ? `${fmtV(video.views)} views${video.x ? ', ' + video.x + 'x your median' : ''}` : '';
    return { source: { title: video.title, pattern: src, stat }, topic: x, offer, funnel, ideas, perf,
      cta: offer ? `${offer.name}${money(offer) ? ' (' + money(offer) + ')' : ''}${funnel ? ' through ' + funnel.name : ''}` : null };
  }
  function ownText(r) {
    return [`Remix of my video "${r.source.title}"${r.source.stat ? ' (' + r.source.stat + ')' : ''}`, `Topic: ${r.topic}. Original angle: ${r.source.pattern.name}.`, '',
      ...r.ideas.flatMap((i, k) => [`${k + 1}. ${i.title}`, `Angle: ${i.pattern.name}. ${i.why}`, `Hook: ${i.hook}`, ...(i.outline || []).map((b, j) => `   ${j + 1}) ${b}`), '']),
      r.cta ? 'Sells: ' + r.cta : ''].join('\n').trim();
  }

  // The topic a proven post is about, when the title names one. Null when it does not.
  function postTopic(title) {
    // Tools and themes first, money claims never: "the exact $10K a month business setup" reads badly.
    const t = String(title || ''); const list = [[/claude/i, 'Claude']].concat(OWN_TOPICS.slice(2));
    const hit = list.find(([rx]) => rx.test(t)); return hit ? hit[1].replace(/^(a|an|the)\s+/i, '') : null;
  }

  const api = { postTopic, pattern, brief, text, match, remixOwn, ownText, ownTopic, channelPatterns, PATTERNS: PATTERNS.map((p) => ({ id: p[0], name: p[1] })).concat([{ id: STATEMENT[0], name: STATEMENT[1] }]), fmtV, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Remix = api;
})(typeof window !== 'undefined' ? window : globalThis);

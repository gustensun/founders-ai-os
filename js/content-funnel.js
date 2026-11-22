// Founders AI OS Content Funnel. Starts from what the founder gives away and sells, and works back to the
// content that leads people there: top of funnel gets the view, middle gets the email, bottom gets the sale.
// A plan is a set of angles per stage. Each angle carries one video, one written and one short idea.
// Picked ideas land in Ideas to approve on the content board. Nothing is published from here.
// Rules always work without a key. With Claude, OpenAI or Perplexity connected the server writes from the Brand DNA.
// Runs in the browser (window.ContentFunnel) and on the server (require).
(function (root) {
  const I = typeof module !== 'undefined' && module.exports ? require('./ideas.js') : root.OSIdeas;

  const STAGES = [
    { id: 'top', name: 'Top of funnel', short: 'Top', goal: 'Get the view', who: 'People who have never heard of me. They have the problem and are not looking for my product yet.', job: 'Earn attention with a useful idea on the wider topic. No pitch.' },
    { id: 'middle', name: 'Middle of funnel', short: 'Middle', goal: 'Get the email', who: 'People who know the problem and are comparing ways to solve it.', job: 'Show my method in use so the free resource is the obvious next step.' },
    { id: 'bottom', name: 'Bottom of funnel', short: 'Bottom', goal: 'Get the sale', who: 'People who already trust me and are deciding whether to buy.', job: 'Answer the questions people ask before buying and show what is inside.' },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const FORMATS = [
    { id: 'video', name: 'Video', channel: 'youtube', spec: 'A long YouTube video, 8 to 20 minutes. Title under 70 characters, a spoken hook for the first 15 seconds, and 5 or 6 outline beats.' },
    { id: 'written', name: 'Written', channel: 'post', spec: 'A written post for LinkedIn, Facebook, X or the community, 80 to 200 words. Title is an internal name, the hook is the first line and must stand alone, and the body is the whole post with short lines.' },
    { id: 'short', name: 'Short', channel: 'short', spec: 'A vertical short under 45 seconds. Title, a hook that lands in the first 2 seconds, and 3 or 4 beats.' },
  ];
  const FORMAT = Object.fromEntries(FORMATS.map((f) => [f.id, f]));
  const KINDS = { freebie: 'Freebie', offer: 'Offer', funnel: 'Funnel' };
  const MAX_ANGLES = 8, MAX_FREEBIES = 60, MAX_PICKS = 12;

  const tidy = (s) => String(s == null ? '' : s).replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/!+/g, '.').replace(/[ \t\r\n]+/g, ' ').trim();
  const cut = (s, n) => tidy(s).slice(0, n);
  const end = (s) => { s = tidy(s); return !s || /[.?:]$/.test(s) ? s : s + '.'; };
  const cap = (s) => { s = tidy(s); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const uid = () => 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const isId = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
  const safeUrl = (s) => { s = String(s || '').trim().slice(0, 2000); return /^https?:\/\/[^\s<>"']+$/i.test(s) ? s : ''; };

  /* ---------- freebies ---------- */
  function normalizeFreebie(x) {
    x = x || {};
    const name = cut(x.name, 200); if (!name) throw new Error('Give the freebie a name.');
    return { name, summary: cut(x.summary, 2000), url: safeUrl(x.url), leads_to: isId(x.leads_to) ? String(x.leads_to) : null };
  }
  // Paste a list, one freebie per line. Bullets and numbering are dropped, repeats are kept once.
  function parseNames(text) {
    const seen = new Set(); const out = [];
    String(text || '').split(/\r?\n/).forEach((line) => {
      const name = cut(line.replace(/^\s*(?:[-*\u2022]+|\d{1,2}[.)])\s+/, ''), 200); const k = norm(name);
      if (!name || !k || seen.has(k)) return; seen.add(k); out.push(name);
    });
    return out.slice(0, MAX_FREEBIES);
  }

  // What a freebie or offer is about, in a few plain words, so the rules can talk about it.
  const CONTAINER = /\b(the|my|your|free|ultimate|complete|unlimited|copy[- ]paste|bundle|vault|library|kit|pack|checklist|cheat ?sheet|swipe ?file|guide|playbook|blueprint|toolkit|files?|app|pdf|download|mini[- ]course|sales page|waitlist)\b/gi;
  function subjectOf(name) {
    const raw = tidy(name).replace(/\(.*?\)/g, ' ').replace(/\b\d+[+,.\d]*\b\+?/g, ' ').replace(/[+:|/]/g, ' ');
    const s = raw.replace(CONTAINER, ' ').replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();
    return s.length >= 3 ? s : tidy(name);
  }

  /* ---------- who leads where ---------- */
  // source is a freebie row or a strategy row with kind. Returns everything a writer needs about it.
  function context(source, freebies, strategy) {
    freebies = freebies || []; strategy = (strategy || []).filter((x) => x && ['live', 'planned'].includes(x.lifecycle || 'live'));
    const byId = (id) => strategy.find((x) => x.id === id) || null;
    const slim = (x) => x && ({ id: x.id, kind: x.kind, name: tidy(x.name), summary: cut(x.summary, 600), lifecycle: x.lifecycle || 'live', url: safeUrl(x.url), details: x.details || {} });
    const src = { id: source.id, kind: source.kind, name: tidy(source.name), summary: cut(source.summary, 600), url: safeUrl(source.url), lifecycle: source.lifecycle || 'live', details: source.details || {} };
    let offer = null, feeds = [];
    if (src.kind === 'freebie') offer = slim(byId(source.leads_to));
    else {
      const linked = src.kind === 'funnel' ? byId(source.linked_offer_id) : null;
      offer = src.kind === 'offer' ? slim(source) : slim(linked);
      const targets = new Set([source.id, linked && linked.id].filter(Boolean));
      feeds = freebies.filter((f) => targets.has(f.leads_to)).map((f) => ({ id: f.id, name: tidy(f.name), summary: cut(f.summary, 400) }));
    }
    const freebie = src.kind === 'freebie' ? { id: src.id, name: src.name, summary: src.summary } : feeds[0] || null;
    // the place a buyer ends up: the funnel itself, or the offer
    const sale = src.kind === 'funnel' ? src : offer;
    return { source: src, offer, sale, freebie, feeds, subject: subjectOf(src.kind === 'freebie' ? src.name : (offer || src).name) };
  }
  // The honest call to action for a stage. Planned offers are never sold as available.
  function ctaFor(ctx, stage) {
    const f = ctx.freebie, s = ctx.sale;
    if (stage === 'top') return f ? `Mention ${f.name} once at the end. No pitch.` : 'Point to a deeper video on the same topic. No pitch.';
    if (stage === 'middle') return f ? `Get ${f.name} free. The link is below.` : 'Invite them to join your email list for the next part.';
    if (!s) return '';
    return s.lifecycle === 'planned' ? `Join the waitlist for ${s.name}. It is not open yet.` : `${s.name}. The link is below.`;
  }
  // Which stages can be written for this source. A freebie with no offer has no honest bottom stage.
  const stagesFor = (ctx) => STAGES.map((s) => s.id).filter((id) => id !== 'bottom' || !!ctx.sale);

  /* ---------- rules: angles without AI ---------- */
  const T = {
    top: [
      (c) => ({ topic: 'The common mistake', angle: `Name the mistake most people make with ${c.subject} and show the fix.`, video: [`The ${c.subject} mistake I see every week`, `Most people start ${c.subject} in the wrong place. I did too.`], written: [`The mistake I made with ${c.subject}`, `I got ${c.subject} wrong for a long time. One change fixed it.`], short: [`Stop doing this with ${c.subject}`, `If you do this with ${c.subject}, stop.`] }),
      (c) => ({ topic: 'Starting from zero', angle: `Show how you would start with ${c.subject} today if you had nothing.`, video: [`How I would start with ${c.subject} from zero`, `If I lost everything, this is the first thing I would set up.`], written: [`Day one with ${c.subject}`, `If I started ${c.subject} again tomorrow, I would do three things.`], short: [`Start here with ${c.subject}`, `New to ${c.subject}? Do this first.`] }),
      (c) => ({ topic: 'The plain explainer', angle: `Explain ${c.subject} in plain words for someone who has never tried it.`, video: [`${cap(c.subject)} explained in plain words`, `Nobody explained ${c.subject} to me simply. So I will.`], written: [`${cap(c.subject)} in five lines`, `${cap(c.subject)} sounds harder than it is.`], short: [`${cap(c.subject)} in 30 seconds`, `Here is ${c.subject} in one breath.`] }),
      (c) => ({ topic: 'What changed', angle: `Show what changed with ${c.subject} this year and what still works.`, video: [`What changed with ${c.subject} this year`, `The old advice on ${c.subject} stopped working. This is what I do now.`], written: [`What I stopped doing with ${c.subject}`, `I dropped three habits around ${c.subject} this year.`], short: [`This no longer works for ${c.subject}`, `This used to work for ${c.subject}. It does not now.`] }),
      (c) => ({ topic: 'The honest numbers', angle: `Share the real time and effort ${c.subject} takes, with no hype.`, video: [`The honest truth about ${c.subject}`, `Here is what ${c.subject} actually takes, from someone who does it every week.`], written: [`What nobody says about ${c.subject}`, `The part of ${c.subject} people leave out.`], short: [`The truth about ${c.subject}`, `Nobody tells you this about ${c.subject}.`] }),
    ],
    middle: [
      (c) => ({ topic: 'Use it on screen', angle: `Open ${c.give} and use it on one real example from start to finish.`, video: [`Watch me use ${c.give} step by step`, `I am going to open ${c.give} and use it on a real example.`], written: [`How I use ${c.give}`, `This is the exact way I use ${c.give} each week.`], short: [`What is inside ${c.give}`, `Here is what you get inside ${c.give}.`] }),
      (c) => ({ topic: 'The method behind it', angle: `Teach the method that ${c.give} is built on, then hand them the shortcut.`, video: [`The method behind ${c.give}`, `There is a simple method behind ${c.give}. Here it is.`], written: [`The three steps behind ${c.give}`, `${cap(c.give)} follows three steps.`], short: [`The method in 30 seconds`, `Three steps. That is the whole method.`] }),
      (c) => ({ topic: 'Before and after', angle: `Show one piece of work before and after using ${c.give}.`, video: [`Before and after ${c.give}`, `Same project, two versions. Only one thing changed.`], written: [`What changed when I used ${c.give}`, `I ran the same project twice. Once with ${c.give}, once without.`], short: [`Before and after`, `Before. After. One change.`] }),
      (c) => ({ topic: 'The part people skip', angle: `Name the step people skip and show where ${c.give} covers it.`, video: [`The step most people skip with ${c.subject}`, `Most people skip one step. It is the one that matters.`], written: [`The step I used to skip`, `I skipped this step for years.`], short: [`Do not skip this step`, `Everyone skips this step.`] }),
    ],
    bottom: [
      (c) => ({ topic: 'What you get', angle: `Show everything inside ${c.sell} on screen, plainly.`, video: [`Inside ${c.sell}: a full walkthrough`, `I will show you everything inside ${c.sell}, so you can decide.`], written: [`What is inside ${c.sell}`, `People ask what they get with ${c.sell}. Here is the list.`], short: [`Inside ${c.sell}`, `This is what is inside ${c.sell}.`] }),
      (c) => ({ topic: 'Who it is for', angle: `Say who ${c.sell} is for and who should skip it.`, video: [`Who ${c.sell} is for, and who should skip it`, `${cap(c.sell)} is not for everyone. Here is how to tell.`], written: [`Do not get ${c.sell} if this is you`, `${cap(c.sell)} is the wrong fit for some people.`], short: [`Is ${c.sell} for you?`, `Skip ${c.sell} if this is you.`] }),
      (c) => ({ topic: 'Questions before buying', angle: `Answer the questions people ask before they buy ${c.sell}.`, video: [`Your questions about ${c.sell}, answered`, `These are the questions I get most before someone joins.`], written: [`The question I get most about ${c.sell}`, `One question comes up every week about ${c.sell}.`], short: [`The top question about ${c.sell}`, `The question I get most.`] }),
      (c) => ({ topic: 'Free versus paid', angle: c.free ? `Show what ${c.free} gives for free and where ${c.sell} takes over.` : `Show what you can do for free and where ${c.sell} takes over.`, video: [c.free ? `${cap(c.free)} or ${c.sell}: which one you need` : `Free or paid: when ${c.sell} is worth it`, `You can go a long way for free. Here is where that stops.`], written: [`When the free version is enough`, `The free route is enough for some people.`], short: [`Free or paid?`, `Free works until this point.`] }),
    ],
  };
  const vars = (ctx) => ({ subject: ctx.subject, give: ctx.freebie ? ctx.freebie.name : 'my free resource', free: ctx.freebie ? ctx.freebie.name : '', sell: ctx.sale ? ctx.sale.name : '' });
  function angleFrom(t, stage, ctx) {
    const pair = (p) => ({ title: cut(p[0], 200), hook: cut(p[1], 400) });
    return { id: uid(), topic: cut(t.topic, 120), angle: cut(t.angle, 400), cta: ctaFor(ctx, stage), ideas: { video: pair(t.video), written: pair(t.written), short: pair(t.short) } };
  }
  // n angles per stage, skipping the angles a plan already has.
  function rules(ctx, n, existing) {
    n = Math.max(1, Math.min(3, n || 2)); const v = vars(ctx); const out = {};
    stagesFor(ctx).forEach((stage) => {
      const have = new Set(((existing && existing.stages && existing.stages[stage]) || []).map((a) => norm(a.topic)));
      out[stage] = T[stage].map((f) => f(v)).filter((t) => !have.has(norm(t.topic))).slice(0, n).map((t) => angleFrom(t, stage, ctx));
    });
    return out;
  }

  /* ---------- AI: what it is asked for ---------- */
  const SYS = 'You work inside Founders AI OS for one founder. You plan content that leads people to what the founder gives away and sells. You only use what the founder wrote or said. Plain words, short sentences, no em dashes, no exclamation points, no emojis, no hype, no filler, no formulaic contrast lines. Write as the founder, in first person, in their voice. Return JSON only.';
  const RULES = 'Use only facts, stories, numbers and proof found in MY BRAND DNA. Never invent results, client names or numbers. No prices. Never present a planned offer as available. No hashtags, no emojis, no em dashes, no exclamation points. Video titles stay under 70 characters. Each angle must be clearly different from the others and from the ones already in the plan.';
  const detail = (x, keys) => keys.map((k) => x && x.details && x.details[k] ? `${k.replace(/_/g, ' ')}: ${cut(x.details[k], 300)}` : '').filter(Boolean);
  function describe(ctx) {
    const s = ctx.source, o = ctx.offer, lines = [];
    lines.push(`WHAT THIS CONTENT LEADS TO (${KINDS[s.kind].toLowerCase()})`, `Name: ${s.name}`);
    if (s.summary) lines.push(`What it helps with: ${s.summary}`);
    if (s.kind !== 'freebie') { lines.push(`Status: ${s.lifecycle === 'planned' ? 'Planned. Not available yet, talk about a waitlist only.' : 'Live'}`); lines.push(...detail(s, s.kind === 'offer' ? ['audience', 'transformation', 'objections', 'content_angles'] : ['goal', 'audience', 'cta', 'content_angles'])); }
    if (s.kind === 'freebie') {
      if (o) { lines.push('', 'THE OFFER THIS FREEBIE LEADS TO', `Name: ${o.name}`, o.summary ? `What it is: ${o.summary}` : '', `Status: ${o.lifecycle === 'planned' ? 'Planned. Not available yet, talk about a waitlist only.' : 'Live'}`, ...detail(o, ['audience', 'transformation', 'objections'])); }
      else lines.push('', 'No offer is linked to this freebie yet, so there is no bottom stage.');
    } else {
      if (s.kind === 'funnel' && o) lines.push('', 'THE OFFER THIS FUNNEL SELLS', `Name: ${o.name}`, o.summary ? `What it is: ${o.summary}` : '', ...detail(o, ['audience', 'transformation', 'objections']));
      lines.push('', ctx.feeds.length ? 'FREEBIES THAT LEAD HERE\n' + ctx.feeds.slice(0, 8).map((f) => `- ${f.name}${f.summary ? ': ' + f.summary : ''}`).join('\n') : 'No freebie leads here yet. The middle stage ends with an invitation to join the email list.');
    }
    return lines.filter((x) => x !== '').join('\n').replace(/\n(THE OFFER|FREEBIES|No offer|No freebie)/g, '\n\n$1');
  }
  const SHAPE = '{"topic":"2 to 4 words naming the angle","angle":"one sentence on what the content says and why it pulls this viewer forward","video":{"title":"...","hook":"the first spoken line"},"written":{"title":"...","hook":"the first line of the post"},"short":{"title":"...","hook":"the first two seconds"}}';
  function planPrompt(ctx, n, existing) {
    const stages = stagesFor(ctx);
    const have = stages.flatMap((id) => ((existing && existing.stages && existing.stages[id]) || []).map((a) => `- ${STAGE[id].short}: ${a.topic}. ${a.angle}`));
    return [
      describe(ctx), '',
      'THE THREE STAGES',
      ...stages.map((id) => `${id}: ${STAGE[id].name}. Goal: ${STAGE[id].goal.toLowerCase()}. ${STAGE[id].who} ${STAGE[id].job} Every piece ends with: ${ctaFor(ctx, id)}`), '',
      have.length ? 'ALREADY IN THE PLAN, do not repeat these angles:\n' + have.slice(0, 40).join('\n') + '\n' : null,
      `Work backwards from what this leads to. Give me ${n} new angle${n === 1 ? '' : 's'} for each stage. Each angle has one long video idea, one written post idea and one short idea that all make the same point.`,
      RULES, '',
      `Return JSON only: {${stages.map((id) => `"${id}":[${SHAPE}]`).join(',')}}`,
    ].filter((x) => x != null).join('\n');
  }
  function parseJson(text) {
    const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
  // Keeps every well formed angle. Returns null when nothing usable came back.
  function parsePlan(text, ctx, n) {
    const j = parseJson(text); if (!j || typeof j !== 'object') return null;
    const out = {}; let total = 0;
    stagesFor(ctx).forEach((stage) => {
      out[stage] = (Array.isArray(j[stage]) ? j[stage] : []).map((a) => {
        if (!a || typeof a !== 'object') return null;
        const idea = (x) => (x && typeof x === 'object' && tidy(x.title) ? { title: cut(x.title, 200), hook: cut(x.hook, 400) } : null);
        const ideas = { video: idea(a.video), written: idea(a.written), short: idea(a.short) };
        if (!tidy(a.topic) || !ideas.video || !ideas.written || !ideas.short) return null;
        return { id: uid(), topic: cut(a.topic, 120), angle: cut(a.angle, 400), cta: ctaFor(ctx, stage), ideas };
      }).filter(Boolean).slice(0, n || 3);
      total += out[stage].length;
    });
    return total ? out : null;
  }

  /* ---------- the saved plan ---------- */
  function normalizePlan(p) {
    if (!p || typeof p !== 'object' || !p.stages || typeof p.stages !== 'object') return null;
    const stages = {};
    STAGES.forEach(({ id }) => {
      stages[id] = (Array.isArray(p.stages[id]) ? p.stages[id] : []).map((a) => {
        if (!a || typeof a !== 'object' || !a.ideas) return null;
        const ideas = {};
        for (const f of FORMATS) { const x = a.ideas[f.id]; if (!x || !tidy(x.title)) return null; ideas[f.id] = { title: cut(x.title, 200), hook: cut(x.hook, 400) }; }
        return { id: /^[a-z0-9]{4,24}$/i.test(String(a.id || '')) ? String(a.id) : uid(), topic: cut(a.topic, 120) || 'Angle', angle: cut(a.angle, 400), cta: cut(a.cta, 300), ideas };
      }).filter(Boolean).slice(0, MAX_ANGLES);
    });
    return { v: 1, by: cut(p.by, 60) || 'Rules', at: typeof p.at === 'string' ? p.at.slice(0, 40) : new Date().toISOString(), stages };
  }
  // Adds new angles after the ones already there. Never replaces or reorders what is saved.
  function merge(plan, add, by) {
    const base = normalizePlan(plan) || { v: 1, by: by || 'Rules', at: new Date().toISOString(), stages: { top: [], middle: [], bottom: [] } };
    let added = 0;
    STAGES.forEach(({ id }) => {
      const have = new Set(base.stages[id].flatMap((a) => [norm(a.topic), norm(a.ideas.video.title)]));
      ((add && add[id]) || []).forEach((a) => {
        if (base.stages[id].length >= MAX_ANGLES || have.has(norm(a.topic)) || have.has(norm(a.ideas.video.title))) return;
        have.add(norm(a.topic)); have.add(norm(a.ideas.video.title)); base.stages[id].push(a); added++;
      });
    });
    return { plan: { ...base, by: by || base.by, at: new Date().toISOString() }, added };
  }
  function removeAngle(plan, angleId) {
    const base = normalizePlan(plan); if (!base) return null;
    STAGES.forEach(({ id }) => { base.stages[id] = base.stages[id].filter((a) => a.id !== angleId); });
    return base;
  }
  const findAngle = (plan, stage, angleId) => ((plan && plan.stages && plan.stages[stage]) || []).find((a) => a.id === angleId) || null;
  const count = (plan) => STAGES.reduce((n, { id }) => n + (((plan && plan.stages && plan.stages[id]) || []).length), 0);

  /* ---------- from a picked idea to a full idea on the board ---------- */
  const ideaKey = (sourceId, angleId, fmt) => [sourceId, angleId, fmt].join(':');
  const BEATS = {
    top: (c) => ['Open with the problem in one line, no intro', 'Show what most people do and why it stalls', 'Teach the fix in three steps, on screen', 'Share one real example from my own work'],
    middle: (c) => ['Open with the result this gets', `Show ${c.give} on screen and what is inside`, 'Use it live on one real example', 'Name the one step people skip'],
    bottom: (c) => ['Open with who this is for', `Show what is inside ${c.sell || 'the offer'}, on screen`, 'Answer the three questions people ask before buying', 'Say who should not buy it'],
  };
  function expand(ctx, stage, angle, fmt) {
    const it = angle.ideas[fmt]; const v = vars(ctx); const cta = angle.cta || ctaFor(ctx, stage); const beats = BEATS[stage](v);
    const why = `${STAGE[stage].name} idea for ${ctx.source.name}. ${end(angle.angle || angle.topic)}`;
    const base = { title: it.title, hook: it.hook, why: cut(why, 300), pattern: null, proof: '' };
    if (fmt === 'video') return { ...base, outline: beats.concat([`Close: ${cta}`]) };
    if (fmt === 'short') return { ...base, outline: [`On screen: ${it.title}`, end(beats[1]), end(beats[2]), `Last line: ${cta}`] };
    const body = [end(it.hook), '', ...beats.slice(1).map((x, i) => `${i + 1}. ${end(x)}`), '', cta].join('\n');
    return { ...base, outline: beats.slice(1), post_body: body };
  }
  // The board row for one picked idea. The funnel block is how the page knows it was sent.
  function row(ctx, stage, angle, fmt, idea, by) {
    const f = FORMAT[fmt]; const cta = angle.cta || ctaFor(ctx, stage);
    const r = I.row(idea, f.channel, null, {
      by: by || 'Rules', tags: [STAGE[stage].name], cta,
      funnel: { key: ideaKey(ctx.source.id, angle.id, fmt), source_id: ctx.source.id, source_kind: ctx.source.kind, source: ctx.source.name, stage, angle: angle.topic, cta, leads_to: stage === 'bottom' ? (ctx.sale && ctx.sale.name) || null : (ctx.freebie && ctx.freebie.name) || null },
    });
    return r;
  }
  function ideasPrompt(ctx, picks) {
    return [
      describe(ctx), '',
      'IDEAS I PICKED FROM MY CONTENT FUNNEL (numbered)',
      ...picks.map((p, i) => `${i + 1}. Stage: ${STAGE[p.stage].name} (${STAGE[p.stage].goal.toLowerCase()}). Angle: ${p.angle.topic}. ${p.angle.angle} Format: ${FORMAT[p.format].channel}. Title: "${p.angle.ideas[p.format].title}". Hook: "${p.angle.ideas[p.format].hook}". Ends with: ${p.angle.cta || ctaFor(ctx, p.stage)}`), '',
      'THE FORMATS',
      ...[...new Set(picks.map((p) => p.format))].map((f) => `- ${FORMAT[f].channel}: ${FORMAT[f].spec}`), '',
      'Turn each picked idea into a full idea I can film or post. Keep my title and hook unless a small edit makes them clearer. The last outline beat, or the last line of a written post, is the ending given for that idea.',
      RULES, '',
      'Return JSON only: {"ideas":[{"from":1,"format":"youtube, post or short","title":"...","hook":"...","outline":["..."],"body":"post only, the whole post","why":"one line on why it fits this stage"}]}',
    ].join('\n');
  }
  // Full ideas from the AI answer, matched to the picks by number. Missing ones fall back to rules.
  function parseIdeas(text, ctx, picks) {
    const got = I.parse(text, FORMATS.map((f) => f.channel), 'youtube') || [];
    return picks.map((p, i) => {
      const fall = expand(ctx, p.stage, p.angle, p.format); const f = FORMAT[p.format];
      const g = got.find((x) => x.from === i + 1) || (got.length === picks.length && !got.some((x) => x.from) ? got[i] : null);
      if (!g || !g.title || !g.outline.length) return { idea: fall, ai: false };
      const idea = { title: g.title, hook: g.hook || fall.hook, outline: g.outline, why: g.why || fall.why, pattern: null, proof: '' };
      if (f.channel === 'post') idea.post_body = g.post_body || fall.post_body;
      return { idea, ai: true };
    });
  }

  // Where each idea of a plan stands on the board: null, or 'suggested', 'approved', 'published' and so on.
  function sentMap(boardRows) {
    const m = {};
    (boardRows || []).forEach((r) => { const k = r && r.meta && r.meta.funnel && r.meta.funnel.key; if (!k) return; if (r.stage === 'passed' && m[k]) return; if (!m[k] || m[k] === 'passed') m[k] = r.stage; });
    return m;
  }
  const stateName = (stage) => ({ suggested: 'In Ideas', approved: 'Approved', planned: 'Planned', production: 'In production', published: 'Published' })[stage] || '';
  function coverage(plan, sourceId, sent) {
    const out = {};
    STAGES.forEach(({ id }) => {
      const angles = (plan && plan.stages && plan.stages[id]) || []; let made = 0;
      angles.forEach((a) => FORMATS.forEach((f) => { const s = sent[ideaKey(sourceId, a.id, f.id)]; if (s && s !== 'passed') made++; }));
      out[id] = { angles: angles.length, ideas: angles.length * FORMATS.length, sent: made };
    });
    return out;
  }

  const api = { STAGES, STAGE, FORMATS, FORMAT, KINDS, MAX_ANGLES, MAX_FREEBIES, MAX_PICKS, SYS, isId, safeUrl, tidy, norm, normalizeFreebie, parseNames, subjectOf, context, ctaFor, stagesFor, rules, planPrompt, parsePlan, normalizePlan, merge, removeAngle, findAngle, count, ideaKey, expand, row, ideasPrompt, parseIdeas, sentMap, stateName, coverage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ContentFunnel = api;
})(typeof window !== 'undefined' ? window : globalThis);

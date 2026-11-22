// Swipe file reader: turns a funnel or offer someone else sells into its parts.
// Runs in the browser (demo, and when no AI is connected) and on the server (prompt, parse, fallback).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OSSwipe = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const KINDS = [['funnel', 'Funnel'], ['offer', 'Offer'], ['page', 'Sales page'], ['ad', 'Ad'], ['email', 'Email'], ['other', 'Other']];
  const kindName = (k) => (KINDS.find((x) => x[0] === k) || KINDS[5])[1];
  const tidy = (s) => String(s || '').replace(/\u2014|\u2013/g, ', ').replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  const cut = (s, n) => { s = tidy(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : s; };
  const uniq = (a) => { const seen = new Set(); return a.filter((x) => { const k = String(x).toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };

  const PRICE = /(?:[$€£]\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?[kKmM]\b)?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|dollars|euros)\b)/g;
  const toNum = (p) => { const m = String(p).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s?([kKmM])?/); return m ? parseFloat(m[1]) * (m[2] ? (/m/i.test(m[2]) ? 1e6 : 1000) : 1) : null; };

  const PROOFY = /\b(?:revenue|went from|made|earned|generated|clients? (?:have|made)|students? (?:have|made)|case stud|added|per year in sales|in sales|doing|already)\b/i;
  function lines(text) {
    return String(text || '').split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map((l) => tidy(l.replace(/^#+\s*/, ''))).filter((l) => l.length > 2 && l.length < 400);
  }
  const STEPS = [
    [/opt[\s-]?in|free (?:guide|training|download|checklist|ebook|class)|lead magnet|get instant access/i, 'Opt-in page with a free lead magnet'],
    [/webinar|masterclass|live training|workshop|challenge/i, 'Training event: webinar, workshop or challenge'],
    [/\bvsl\b|watch (?:the|this) video|video below/i, 'Video sales letter'],
    [/order form|checkout|secure (?:checkout|order)|complete (?:your )?order/i, 'Order form'],
    [/order bump|add (?:this|it) to (?:your )?order|yes,? add|one[\s-]time (?:only )?add/i, 'Order bump on the checkout'],
    [/upsell|one[\s-]time offer|\boto\b|special offer|upgrade (?:your|to)/i, 'One-time offer after purchase'],
    [/downsell|no thanks|instead/i, 'Downsell for people who say no'],
    [/apply|application|book (?:a|your) call|strategy call|discovery call|schedule (?:a|your) call/i, 'Application or booked call'],
    [/thank you|you'?re in|check your (?:inbox|email)/i, 'Thank-you page with a next step'],
    [/membership|community|monthly|per month|\/mo\b/i, 'Recurring membership or community'],
  ];

  // No-AI reading: prices, promise, stack, bonuses, guarantee, urgency, steps and what to borrow.
  function rules(input) {
    const text = [input.title, input.page_text, input.body, input.notes].filter(Boolean).join('\n');
    const L = lines(text);
    const prices = [];
    L.forEach((l) => {
      const found = l.match(PRICE); if (!found) return;
      if (PROOFY.test(l)) return; // results and case studies are proof, not prices
      found.slice(0, 3).forEach((p) => {
        const label = cut(l.replace(PRICE, ' ').replace(/[:|()]+/g, ' ').replace(/(?:\s(?:only|just|for|at|now|value|worth|valued|price|is|of|,))+\s*$/i, ' ').replace(/^\s*(?:yes,?|one[\s-]time offer:?|only|just|today only|now)\s*/i, ''), 60) || 'Price';
        prices.push({ label, price: tidy(p).replace(/^([$€£])\s+/, '$1'), n: toNum(p), worth: /worth|value|regular|normally|retail/i.test(l) });
      });
    });
    const sold = prices.filter((p) => !p.worth);
    const price_points = uniq((sold.length ? sold : prices).map((p) => p.price)).slice(0, 6).map((pp) => { const p = (sold.length ? sold : prices).find((x) => x.price === pp); return { label: p.label, price: p.price }; });
    const has = (rx) => L.filter((l) => rx.test(l));
    const headline = cut(input.title || L.find((l) => l.split(' ').length >= 4 && l.length < 140) || L[0] || '', 140);
    const promise = cut(has(/\b(?:how to|you(?:'ll| will)|get|without|in (?:\d+|30|7|14|90) days|step[\s-]by[\s-]step|finally)\b/i).find((l) => l !== headline && l.length < 220) || '', 220);
    const audience = cut(has(/\b(?:for (?:coaches|consultants|founders|creators|agencies|beginners|busy|anyone|people|you if)|if you(?:'re| are)|this is for|perfect for|designed for)\b/i)[0] || '', 200);
    const bonuses = uniq(has(/\bbonus\b|\bfree gift\b|\bfast[\s-]?action\b/i).map((l) => cut(l, 140))).slice(0, 6);
    const stack = uniq(has(/\b(?:worth|value|valued at|module|templates?|swipe|course|lessons?|coaching|calls?|community)\b/i).filter((l) => !/bonus/i.test(l) && l.length < 180 && l !== headline && l !== tidy(input.title || '') && !/^(?:get|join|start|buy|claim|enroll|book|apply|yes|grab|reserve|download|watch|register|unlock|try)\b/i.test(l)).map((l) => cut(l, 140))).slice(0, 8);
    const guarantee = cut(has(/guarantee|refund|money[\s-]back|risk[\s-]free|no questions asked/i)[0] || '', 200);
    const urgency = cut(has(/\blimited\b|\bspots?\b|\bonly \d+\b|\bends\b|\bdeadline\b|\bexpires?\b|\btoday only\b|\bclosing\b|\blast chance\b|\bprice goes up\b|\btimer\b/i)[0] || '', 180);
    const ctas = has(/^(?:get|join|start|buy|claim|enroll|book|apply|yes|grab|reserve|download|watch|register|unlock|try)\b/i).filter((l) => l.length < 70);
    const ctaOk = ctas.filter((l) => !/^yes\b/i.test(l) && !new RegExp(PRICE.source).test(l) && l !== headline); const cta = cut(ctaOk.find((l) => l.split(' ').length <= 5) || ctaOk[0] || ctas[0] || '', 70);
    const proof = uniq(has(/\b(?:reviews?|testimonials?|case stud(?:y|ies)|rated|stars?|trusted by|as seen|featured)\b|\b\d[\d,.]*\+?\s?(?:k\s)?(?:people|students|members|customers|clients|founders|coaches|businesses|buyers)\b|\b(?:went from|made|earned|generated|added)\b[^.]*\d/i).filter((l) => l !== headline && l !== promise).map((l) => cut(l, 140))).slice(0, 4);
    const funnel_steps = STEPS.filter(([rx]) => rx.test(text)).map(([, s]) => s);
    const ladder = sold.map((p) => p.n).filter((n) => n != null).sort((a, b) => a - b);

    const why = [];
    if (price_points.length >= 2) why.push(`A price ladder (${price_points.slice(0, 4).map((p) => p.price).join(', ')}) lets a buyer start small and climb.`);
    else if (price_points.length === 1) why.push(`One clear price (${price_points[0].price}) keeps the decision simple.`);
    if (prices.some((p) => p.worth) && sold.length) why.push('It shows what everything is worth next to what you pay, so the price feels small.');
    if (bonuses.length) why.push(bonuses.length === 1 ? 'A bonus makes saying yes now feel better than waiting.' : `${bonuses.length} bonuses make saying yes now feel better than waiting.`);
    if (guarantee) why.push('A guarantee moves the risk off the buyer.');
    if (urgency) why.push('A real reason to act now: limited spots, a deadline or a price rise.');
    if (proof.length) why.push('Proof from other people carries the claims, so the seller does not have to.');
    if (funnel_steps.some((s) => /bump|one-time/i.test(s))) why.push('Extra offers after the first yes raise what each buyer is worth.');
    if (promise) why.push('The promise names an outcome and how fast it comes.');
    if (!why.length) why.push('Add the page text or a screenshot so the OS can see the offer itself.');

    const borrow = [];
    if (ladder.length >= 2) borrow.push({ idea: 'Line your offers up as a ladder with an entry price, a core offer and a premium step.', for: 'offer' });
    if (funnel_steps.some((s) => /bump/i.test(s))) borrow.push({ idea: 'Add a small order bump on your checkout that finishes the job of the main offer.', for: 'funnel' });
    if (funnel_steps.some((s) => /one-time/i.test(s))) borrow.push({ idea: 'Show a one-time offer straight after purchase, while the buyer is still warm.', for: 'funnel' });
    if (bonuses.length) borrow.push({ idea: 'Turn one of your templates or tools into a fast-action bonus with a clear deadline.', for: 'offer' });
    if (guarantee) borrow.push({ idea: 'Write a guarantee in plain words that names exactly what happens if it does not work.', for: 'offer' });
    if (promise) borrow.push({ idea: 'Rewrite your headline as one outcome plus a time frame, the way this one does.', for: 'page' });
    if (proof.length) borrow.push({ idea: 'Put one named result from a customer right under your headline.', for: 'page' });
    if (!borrow.length) borrow.push({ idea: 'Save the page text or a screenshot. Then the OS can pull out the parts worth borrowing.', for: 'offer' });

    return {
      name: cut(input.title || headline || (input.url ? hostOf(input.url) : 'Untitled'), 90),
      brand: input.brand || (input.url ? hostOf(input.url) : ''),
      headline, promise, audience, mechanism: why[0] || '', price_points, stack, bonuses, guarantee, urgency, cta, proof, funnel_steps,
      why_it_works: why.slice(0, 6), borrow: borrow.slice(0, 5),
    };
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

  const SYS = 'You read funnels and offers that other people sell, for one founder who wants to learn from them. You describe what is there and why it works, then show how the founder could borrow the structure for their own offers. Never copy wording, names, claims or prices into suggestions for the founder. Plain words, short sentences, no em dashes, no exclamation points, no emojis, no hype.';
  function prompt(input, dna) {
    const parts = [];
    parts.push('Read this ' + kindName(input.kind).toLowerCase() + ' someone else sells. Screenshots may be attached.');
    if (input.url) parts.push('URL: ' + input.url);
    if (input.title) parts.push('Title: ' + input.title);
    if (input.brand) parts.push('Seller: ' + input.brand);
    if (input.notes) parts.push('What the founder noticed: ' + String(input.notes).slice(0, 1200));
    if (input.body) parts.push('PASTED TEXT\n' + String(input.body).slice(0, 14000));
    if (input.page_text) parts.push('TEXT FROM THE PAGE\n' + String(input.page_text).slice(0, 16000));
    if (dna) parts.push('THE FOUNDER (Brand DNA, use it only for the borrow ideas)\n' + String(dna).slice(0, 7000));
    parts.push(`Return only JSON with these keys:
{"name": "short name of the offer or funnel", "brand": "who sells it", "headline": "their main headline", "promise": "the outcome they promise, in one sentence", "audience": "who it is for", "mechanism": "the main reason it sells, one sentence", "price_points": [{"label": "what it is", "price": "the price as shown"}], "stack": ["what you get"], "bonuses": ["bonus"], "guarantee": "", "urgency": "", "cta": "the button or call to action", "proof": ["kind of proof they use"], "funnel_steps": ["step in order, like opt-in, webinar, order form, order bump, upsell, call"], "why_it_works": ["3 to 6 plain reasons"], "borrow": [{"idea": "a specific way the founder could use this structure for one of their own offers or funnels, named from the Brand DNA", "for": "offer|funnel|page|content"}]}
Leave a field empty when it is not visible. Keep every string under 30 words, list at most 8 prices and 8 stack items. Give 3 to 5 borrow ideas.`);
    return parts.join('\n\n');
  }
  function parse(t) {
    const m = String(t || '').match(/\{[\s\S]*\}/); if (!m) return null; let j; try { j = JSON.parse(m[0]); } catch { return null; }
    const arr = (x, n) => (Array.isArray(x) ? x : []).map((v) => (typeof v === 'string' ? tidy(v) : v)).filter(Boolean).slice(0, n);
    return {
      name: cut(j.name, 90), brand: cut(j.brand, 60), headline: cut(j.headline, 160), promise: cut(j.promise, 240), audience: cut(j.audience, 200), mechanism: cut(j.mechanism, 240),
      price_points: arr(j.price_points, 8).filter((p) => p && typeof p === 'object').map((p) => ({ label: cut(p.label, 70), price: cut(p.price, 30) })).filter((p) => p.price || p.label),
      stack: arr(j.stack, 10).map((s) => cut(s, 160)), bonuses: arr(j.bonuses, 8).map((s) => cut(s, 160)), guarantee: cut(j.guarantee, 220), urgency: cut(j.urgency, 200), cta: cut(j.cta, 80),
      proof: arr(j.proof, 6).map((s) => cut(s, 160)), funnel_steps: arr(j.funnel_steps, 10).map((s) => cut(s, 90)), why_it_works: arr(j.why_it_works, 6).map((s) => cut(s, 220)),
      borrow: arr(j.borrow, 6).filter((b) => b && typeof b === 'object' && b.idea).map((b) => ({ idea: cut(b.idea, 260), for: /^(offer|funnel|page|content)$/.test(b.for) ? b.for : 'offer' })),
    };
  }
  return { KINDS, kindName, rules, prompt, parse, SYS, hostOf, tidy };
});

// Offer and funnel agents: what each one drafts when it runs, and its line in the Jarvis feed.
(() => {
  const St = window.Store;
  const F = () => St.s.funnels.filter((f) => f.status === 'live');
  const weakest = () => [...F()].sort((a, b) => a.conv - b.conv)[0] || { name: 'App Builder Kit sales page', visits: 2210, conv: 0.019, stream: 'products' };
  const pc = (x) => (x * 100).toFixed(1) + '%';
  const eur = (n) => '\u20ac' + Math.round(n).toLocaleString('en-GB');

  const OUT = {
    pricing: () => ({ kind: 'Price test', title: 'Price test: App Builder Kit at 497 vs 3 x 177', stream: 'products', rubric: 'rb-offer', scores: [8.6, 9.0, 8.4, 7.9],
      action: 'Save the test plan. You set the second price in HighLevel Payments when you start it',
      body: 'TEST\nA. 497 once (today)\nB. 3 payments of 177\n\nWHY\n38 percent of checkout visitors who leave do it on the payment step. Payment plans lifted your Coaching cohort checkout from 2.1 to 3.4 percent last spring.\n\nTHE MATH, 30 DAYS\nToday: 2,210 visits x 1.9% x 497 = ' + eur(2210 * 0.019 * 497) + '\nIf B reaches 2.6%: 2,210 x 2.6% x 531 = ' + eur(2210 * 0.026 * 531) + '\nBreak-even for B: 1.78%, so the downside is small.\n\nSTOP RULE\nRun until 400 checkout visits per side or 21 days, whichever comes first. Watch refunds at 14 days.',
      evidence: 'Checkout step data from HighLevel, refund reasons from the last 90 days, and the Coaching cohort payment plan test.' }),
    bumps: () => ({ kind: 'Bump and upsell', title: 'Order bump and upsell for the Funnel Kit', stream: 'products', rubric: 'rb-offer', scores: [8.8, 8.5, 9.1, 8.2],
      action: 'Add to the Funnel Kit checkout in HighLevel as an order bump and a one-time offer page',
      body: 'ORDER BUMP, 17\nAI Skill Pack for funnels. The 12 prompts I use to write every page in this kit.\nCheckbox line: Yes, add the prompts that write the pages for me.\n\nONE-TIME OFFER, 197 (normally 497)\nApp Builder Kit. Build the funnel inside HighLevel in an afternoon, with the templates already done.\nWhy now: you just bought the copy. This is the build.\n\nDOWNSELL, 47 a month\nStudio Membership, first month free. Live builds every week, so you never build alone.\n\nWhy this order: 18 percent of Funnel Kit buyers buy the App Builder Kit within 60 days. Offering it at checkout moves that forward.',
      evidence: 'Ladder Mapper: buyer paths after the Funnel Kit over the last 180 days.' }),
    sequence: () => ({ kind: 'Email sequence', title: '5 email welcome sequence for the HighLevel trial funnel', stream: 'affiliate', rubric: 'rb-email', scores: [8.7, 8.8, 8.3, 8.0],
      action: 'Paste into a HighLevel workflow triggered by the tag hl-trial-start',
      body: 'DAY 0  Your trial is live. Do these 3 things first\nThe three setup steps that decide if a trial sticks, with a 4 minute video for each.\n\nDAY 1  The snapshot I would install today\nYour bonus snapshot, with the one setting most people miss.\n\nDAY 3  What I would build first if I were you\nOne client dashboard, one funnel, one workflow. Nothing else this week.\n\nDAY 7  Halfway. Here is where most people stall\nThe objection from your calls: "I do not have time to learn it." Answer: the 20 minute build.\n\nDAY 12  Two days left on your trial\nWhat you keep, what you lose, and the live build this Thursday.\n\nTEXTS\nDay 1 and day 12 only. Short, one link each.',
      evidence: 'Trial-to-paid is 41 percent for people who finish setup in 3 days against 12 percent for those who do not.' }),
    adangles: () => ({ kind: 'Ad angles', title: '5 ad angles for the Launch Workshop', stream: 'products', rubric: 'rb-ad', scores: [8.9, 8.6, 8.4],
      action: 'Save to the ad library. You launch them in HighLevel Ad Manager or Meta',
      body: '1. RESULT\nHook: "I built a client dashboard in 20 minutes. Here is the whole thing."\n\n2. OBJECTION\nHook: "You do not need to code. You need one afternoon and a template."\n\n3. MONEY\nHook: "Stop selling websites for 2,500 once. Sell the dashboard for 197 a month."\n\n4. PROOF\nHook: "31 new bookings in 30 days for a two-chair dental clinic."\n\n5. CONTRARIAN\nHook: "Most funnels fail on page two. Nobody looks there."\n\nSCRIPT FOR ANGLE 1, 30 SECONDS\n0 to 3 s: Finished dashboard on screen, your voice over the hook.\n3 to 20 s: Three fast cuts of the build.\n20 to 30 s: "The workshop is Thursday. Link below."',
      evidence: 'Angles 1 and 3 come from your two best videos by revenue. Angle 2 is the top objection from Objection Miner.' }),
    audit: () => { const f = weakest(); return { kind: 'Page fix', title: 'Page audit: ' + f.name, stream: f.stream, rubric: 'rb-page', scores: [8.7, 8.9, 8.2],
      action: 'Send the fixes to HighLevel AI Studio as an edit prompt for this funnel',
      body: 'SCORE: 61 of 100 on your CONVERSIONS checklist\n\nWEAKEST SECTIONS\n1. Above the fold (4 of 10). The headline names the product, not the result. Fix: "Build the funnel clients pay you for, inside HighLevel, this afternoon."\n2. Proof (5 of 10). Testimonials sit below the price. Fix: move the 3 strongest to right after the first button.\n3. Objections (5 of 10). "Do I need HighLevel already?" is asked on 1 in 4 calls and answered nowhere. Fix: a two-line FAQ under the price.\n\nKEEP\nThe value stack and the guarantee score 9 of 10. Leave them.\n\nEXPECTED\nFixing the fold alone is worth about 0.4 points of conversion on this traffic.',
      evidence: f.name + ': ' + f.visits.toLocaleString('en-GB') + ' visits, ' + pc(f.conv) + ' conversion in 30 days. Objections from Objection Miner.' }; },
    splittest: () => { const f = weakest(); return { kind: 'Split test', title: 'A/B test: new headline on ' + f.name, stream: f.stream, rubric: null, scores: [],
      action: 'Save the test plan. You create the variant in HighLevel funnel split testing',
      body: 'HYPOTHESIS\nA result-led headline beats the product-led one, because 64 percent of visitors leave without scrolling.\n\nA. Current: "The App Builder Kit"\nB. "Build the funnel clients pay you for, this afternoon"\n\nSPLIT\n50 / 50 on the first page only.\n\nWINNER RULE\nAt least 300 visitors per side and 95 percent confidence. If neither wins after 21 days, keep A and test the proof section next.\n\nRUNNING NOW\nHighLevel review and bonus page, CTA colour test. Day 9, B ahead by 0.6 points, not yet significant. Leave it running.',
      evidence: 'Scroll depth and step conversion from the last 30 days.' }; },
    recovery: () => ({ kind: 'Checkout recovery', title: 'Abandoned checkout: 3 emails and 1 text', stream: 'products', rubric: 'rb-email', scores: [8.8, 9.0, 8.5, 8.7],
      action: 'Paste into the HighLevel abandoned checkout workflow',
      body: 'AFTER 1 HOUR, EMAIL\nSubject: Your kit is still in the cart\nYou were one click away. If something stopped you, reply and tell me. I read these myself.\n\nAFTER 1 DAY, EMAIL\nSubject: "Do I need HighLevel already?"\nThe question people ask most before buying. Short answer: no, the kit includes a trial link and the setup video.\n\nAFTER 3 DAYS, EMAIL\nSubject: Last note on this\nThe guarantee is 30 days. Build one funnel. If it does not work for you, I refund it.\n\nAFTER 2 HOURS, TEXT\nHi {{contact.first_name}}, Avery here. Your App Builder Kit is saved. Want the link again?',
      evidence: '23 abandoned checkouts in 30 days. The top refund and call objection is about needing HighLevel first.' }),
  };

  const LINES = {
    offerspy: () => 'A competitor raised their HighLevel course to 997 and added a done-for-you bonus.',
    objections: () => '"Do I need HighLevel already?" came up on 3 calls this week. Mapped it to the kit FAQ.',
    ladder: () => 'Gap found between the 47 Funnel Kit and the 497 App Builder Kit. A 197 offer would fill it.',
    pricing: () => 'Drafted a payment plan test for the App Builder Kit. Break-even is 1.78 percent.',
    bumps: () => 'Wrote a 17 euro order bump and a one-time offer for the Funnel Kit checkout.',
    sequence: () => 'Wrote a 5 email welcome sequence for the HighLevel trial funnel.',
    adangles: () => 'Wrote 5 ad angles for the Launch Workshop from your two best videos.',
    leak: () => { const f = weakest(); return 'Biggest leak: ' + f.name + ' at ' + pc(f.conv) + '. 64 percent leave without scrolling.'; },
    audit: () => 'Audited ' + weakest().name + '. 61 of 100, the fold scores lowest.',
    splittest: () => 'CTA test on the HighLevel review page is on day 9. B leads, not yet significant.',
    recovery: () => 'Recovered 2 of 5 abandoned checkouts since yesterday.',
  };

  window.ContentAgents.add(OUT, LINES);
})();

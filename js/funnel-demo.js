// Founders AI OS: the sample Funnel Agent build shown in the Demo workspace.
// It is a complete build: answers, research, final offer, copy, brand kit, design, emails and the HighLevel handoff.
(function (root) {
  const offer = {
    name: 'App Builder Kit',
    one_liner: 'Launch client-ready AI apps inside HighLevel in a weekend',
    promise: 'Build and sell your first AI app inside HighLevel in 7 days, without writing code.',
    audience: 'Agency owners and freelancers on HighLevel who sell websites and funnels and want a higher-value AI offer',
    mechanism: { name: 'Build-First Method', steps: [
      { name: 'Pick a proven app', what: 'Start from one of 12 app blueprints that agencies already sell, matched to the niches you serve.' },
      { name: 'Build it in AI Studio', what: 'Paste the prompt pack, connect the client account and ship a working version in one sitting.' },
      { name: 'Sell it before you finish', what: 'Show the demo on a short call with the pitch script and price it as a monthly add-on.' },
    ] },
    price: { amount: 497, currency: 'USD', compare_at: 997, note: 'one payment, lifetime updates', plans: [{ label: 'Or 3 payments', amount: 177, every: 'a month' }] },
    stack: [
      { name: '12 app blueprints', what: 'Booking assistants, review responders, quote builders and 9 more, each with a niche and a price.', value: 1200 },
      { name: 'AI Studio prompt pack', what: 'The exact prompts for each blueprint, tested on live client accounts.', value: 497 },
      { name: 'Pitch and pricing scripts', what: 'The 15-minute demo call, the follow-up email and the pricing sheet.', value: 297 },
      { name: 'Snapshot templates', what: 'Import the pages, workflows and pipelines that sit around each app.', value: 397 },
    ],
    bonuses: [
      { name: 'Live build replays', what: 'Six recorded sessions where three apps are built from a blank account.', value: 297 },
      { name: 'Client onboarding kit', what: 'Intake form, kickoff checklist and the handover video script.', value: 147 },
    ],
    guarantee: { name: 'Build-it guarantee', days: 30, terms: 'Build one app from the kit within 30 days. If it does not work the way the page says, email us and you get every cent back.' },
    cta: 'Get the App Builder Kit',
    urgency: 'The launch price goes up to $997 when the next six blueprints are added in December.',
  };
  const copy = {
    meta: { title: 'App Builder Kit | Build and sell AI apps inside HighLevel', description: 'Twelve app blueprints, the prompt pack and the pitch scripts to sell your first AI app inside HighLevel in 7 days.' },
    hero: { eyebrow: 'For HighLevel agencies and freelancers', headline: 'Sell your first *AI app* inside HighLevel this week', sub: 'Twelve app blueprints, the prompts that build them and the script that sells them. Even if you have never written a line of code.', cta: 'Get the App Builder Kit', trust: 'Instant access' },
    proofbar: { items: [{ n: '12', label: 'App blueprints agencies sell' }, { n: '7 days', label: 'From kit to first demo' }, { n: '$297', label: 'Typical monthly add-on price' }, { n: '1,400+', label: 'Agencies on the waitlist' }] },
    problem: { eyebrow: 'Sound familiar', title: 'Clients want AI. You are still selling *pages*.', intro: 'Every client call ends with the same question: can you add AI to this? Most agencies say yes and then stall.', bullets: ['You open AI Studio, stare at a blank prompt and close the tab.', 'You build something clever that no client asked for.', 'You quote a one-off fee when the work should pay you every month.', 'You watch a competitor pitch the same client an AI assistant and win.'], close: 'The tools are ready. What is missing is a list of apps people already pay for.' },
    story: { eyebrow: 'Why this exists', title: 'I stopped guessing which apps to build', paragraphs: ['After 300 funnels I could build anything in HighLevel. The problem was knowing what to build so a client would say yes on the first call.', 'So I tracked every AI app our clients paid for over a year. Twelve kept coming back, across dentists, roofers, coaches and clinics.', 'This kit is those twelve, written down so you can copy them.'] },
    mechanism: { title: 'How the *Build-First Method* works', intro: 'Three steps, in this order. You show a working app before you ask for money.' },
    compare: { title: 'The old way and the *build-first* way', old_label: 'Pitching AI from a slide', new_label: 'Pitching AI from a working demo', old: ['Weeks of discovery before anything exists', 'Custom quotes that clients sit on', 'One-off project fees', 'Starting from a blank prompt every time'], new: ['A working demo on the first call', 'A clear monthly price on one sheet', 'Recurring revenue per client', 'Blueprints and prompts you reuse'] },
    outcomes: { eyebrow: 'What changes', title: 'What you walk away with', items: [{ title: 'A new monthly offer', body: 'An AI add-on you can price at $197 to $497 a month on top of the work you already do.' }, { title: 'A demo that sells', body: 'A live app you can show on a call, built in the client account before you pitch it.' }, { title: 'A repeatable build', body: 'The same blueprint works for the next client in the niche, so the second build takes an hour.' }] },
    stack: { title: 'Everything inside the *App Builder Kit*', intro: 'Built from apps agencies already sell. Use it inside your own HighLevel account.', today_label: 'Launch price', note: 'Taxes may apply. You get access the moment you check out.' },
    bonuses: { title: 'Two bonuses for launch week', intro: 'Included at no extra cost while the launch price lasts.' },
    proof: { title: 'What early users said', items: [] },
    who: { title: 'Is this kit for you?', for: ['You run an agency or freelance on HighLevel', 'You already sell websites, funnels or automations', 'You want a monthly offer clients understand in one call'], not_for: ['You want a done-for-you service', 'You do not have a HighLevel account yet', 'You are looking for a coding course'] },
    guarantee: { title: 'Build one app or get your money back' },
    about: { eyebrow: 'Who built this', title: 'Avery Cole', paragraphs: ['I have built more than 300 funnels for coaches, clinics and agencies, most of them inside HighLevel.', 'I wrote this kit for agencies who are good at the work and tired of guessing what to sell next.'], creds: ['300+ funnels built', 'Builds in HighLevel every week', 'Runs the Offer Lab'] },
    urgency: { title: 'The price goes up in *December*', body: 'Six more blueprints land next month and the kit moves to $997. Everyone who joins now gets them free.' },
    faq: { items: [{ q: 'Do I need to know how to code?', a: 'No. Every blueprint is built with prompts inside HighLevel AI Studio. If you can build a funnel, you can build these.' }, { q: 'Which HighLevel plan do I need?', a: 'Any plan with AI Studio access. The snapshots import into the agency or sub-account you choose.' }, { q: 'How fast can I sell the first app?', a: 'Most people build their first demo in a weekend and pitch it the following week.' }, { q: 'Can I resell the apps to clients?', a: 'Yes. Build them in client accounts and charge whatever you like. The only thing you cannot resell is the kit itself.' }, { q: 'What if it is not for me?', a: 'Build one app within 30 days. If it does not work the way this page says, email us and you get a full refund.' }] },
    final: { title: 'Your next client offer is *already written*', body: 'Twelve apps people pay for, the prompts that build them and the script that sells them.' },
    ps: 'The kit pays for itself with one client on the smallest blueprint. Everything after that is margin.',
    footer: { owner: 'Northpeak Studio' },
  };
  const brand = {
    name: 'Northpeak Studio', logo_text: 'App Builder Kit',
    palette: { bg: '#f7f4ee', surface: '#fffdf9', ink: '#141210', muted: '#5f5a52', line: '#e4ddd1', accent: '#d9692f', deep: '#151311', deep_ink: '#f5f0e7' },
    fonts: { display: 'Instrument Serif', body: 'Hanken Grotesk' },
    radius: 16, voice: ['Plain words', 'Short sentences', 'Specific numbers', 'No hype'],
    notes: 'Calm off-white with one warm orange accent, the same family as the founder brand. Serif headlines, sans body.',
  };
  const design = { hero: 'split', hero_tone: 'light', button: 'pill', radius: 16, order: ['hero', 'proofbar', 'problem', 'story', 'mechanism', 'compare', 'outcomes', 'stack', 'bonuses', 'who', 'guarantee', 'about', 'urgency', 'faq', 'final'], why: 'Warm traffic from YouTube, mid-ticket price. Proof and the working demo carry the page, so the mechanism and the stack get the most room.' };
  const research = {
    summary: 'Agencies on HighLevel are being asked for AI by clients but sell it as one-off projects. Courses on AI Studio teach features, not offers. A kit priced between a template pack and a coaching program has room.',
    audience: { who: 'HighLevel agency owners and freelancers, 1 to 10 clients, selling sites and funnels', pains: ['Clients ask for AI and they do not know what to build', 'One-off fees and no recurring revenue', 'Blank-prompt paralysis in AI Studio'], desires: ['A monthly AI add-on', 'Something to show on a sales call', 'Reusable builds'], objections: ['I am not technical', 'My clients are not ready for AI', 'I already bought too many courses'], words: ['add AI to my site', 'recurring revenue', 'snapshot', 'AI employee'] },
    competitors: [{ name: 'Generic AI Studio courses', offer: 'Feature walkthroughs', price: '$97 to $297', angle: 'Learn the tool' }, { name: 'Done-for-you AI agencies', offer: 'Custom builds', price: '$2,000+', angle: 'We build it for you' }, { name: 'Snapshot marketplaces', offer: 'Templates', price: '$47 to $197', angle: 'Import and go' }],
    price_range: '$297 to $997 for kits with templates and scripts',
    angles: ['Sell the demo, not the deck', 'Twelve apps people already pay for', 'Recurring revenue on top of the work you already do'],
    proven: ['How I would sell AI to my first 10 clients (8.6x the creator median)', '10 HighLevel offers clients actually pay for (5.2x)'],
    sources: [{ title: 'Demo workspace sample research', url: '#' }],
  };
  const emails = [
    { when: 'Right after purchase', subject: 'You are in. Start with blueprint one.', body: 'Your App Builder Kit is ready. Open the members area, pick the blueprint closest to your best client and watch the first replay. Most people build their first demo the same weekend.' },
    { when: 'Day 1', subject: 'Which client gets the first app?', body: 'Pick one client you already have. Match them to a blueprint and book a 15-minute call for next week. The pitch script is in module three.' },
    { when: 'Day 3', subject: 'Build it before you pitch it', body: 'The demo is the pitch. Build the app inside their account, then show it working. Here is the one-page checklist.' },
    { when: 'Day 7', subject: 'How to price it', body: 'Price it as a monthly add-on, not a project. The pricing sheet has three tiers that agencies use.' },
    { when: 'Cart left, 1 hour', subject: 'Your kit is still waiting', body: 'You left the checkout open. The launch price is still there for now.' },
    { when: 'Cart left, 24 hours', subject: 'One question before you decide', body: 'What would stop you from building one app this month? Reply and tell me. Most of the time the answer is already in the kit.' },
  ];
  const handoff = {
    products: [{ name: 'App Builder Kit', price: 497, currency: 'USD', type: 'one-time' }, { name: 'App Builder Kit, 3 payments', price: 177, currency: 'USD', type: 'payment plan, 3 months' }],
    order_form: 'Two-step order form. Left: name, email, card. Right: the stack with values and the 30-day guarantee.',
    bump: { name: 'Done-with-you build call', price: 97, copy: 'Add a 45-minute build call and we build your first app together.' },
    upsell: { name: 'Blueprint Vault', price: 47, every: 'month', copy: 'Two new app blueprints every month, with the prompts and the pitch.' },
    workflow: ['Trigger: Order form submission, product App Builder Kit', 'Add tag: kit-buyer', 'Grant membership: App Builder Kit', 'Send email: You are in', 'Wait 1 day, send Day 1 email', 'Wait 2 days, send Day 3 email', 'Wait 4 days, send Day 7 email'],
  };
  const steps = ['intake', 'research', 'offer', 'copy', 'brand', 'visuals', 'design', 'build', 'publish'];
  const notes = {
    intake: '5 answers saved. Offer and Brand DNA prefilled the rest.',
    research: '3 competitor types, 3 angles and 2 proven posts on the topic.',
    offer: 'Price kept at $497 with a 3-payment plan. 4 stack items, 2 bonuses, 30-day guarantee.',
    copy: '15 sections, 1,240 words, 6 emails for HighLevel.',
    brand: 'Instrument Serif and Hanken Grotesk on warm off-white with one orange accent.',
    visuals: 'Brand artwork drawn for the hero, story and stack.',
    design: 'Split hero, light tone, stack and mechanism get the most room.',
    build: 'Page built. Quality checks passed.',
    publish: 'Preview ready. Connect GitHub and Vercel to publish your own builds.',
  };
  function build() {
    const at = Date.now() - 36e5;
    return {
      id: 'demo-fb-1', title: 'App Builder Kit sales page', offer_ref: 'o-kit', status: 'done', step: 'done', version: 2, demo: true,
      created_at: new Date(at).toISOString(), updated_at: new Date(at + 6e5).toISOString(),
      answers: { audience: offer.audience, promise: offer.promise, price: '$497, or 3 payments of $177', proof: '300+ funnels built, builds in HighLevel every week. No customer testimonials yet.', checkout_url: '', notes: 'Keep it calm and specific.' },
      steps: Object.fromEntries(steps.map((k, i) => [k, { state: 'done', at: new Date(at + i * 50e3).toISOString(), done_at: new Date(at + i * 50e3 + 40e3).toISOString(), note: notes[k] }])),
      research, offer, copy, brand, design, emails, handoff, visuals: { method: 'svg', images: [] }, assets: {}, links: { checkout: '', support: 'support@example.com' },
      qa: { ok: true, issues: ['Buttons point to the offer section until a HighLevel order form link is added'], words: 1240, ctas: 6, sections: 15 },
      versions: [{ v: 1, at: new Date(at + 5e5).toISOString(), note: 'First build' }, { v: 2, at: new Date(at + 6e5).toISOString(), note: 'Revision: made the hero headline shorter and moved the guarantee above the founder story' }],
      revisions: [{ at: new Date(at + 55e4).toISOString(), request: 'Make the hero headline shorter and move the guarantee higher.', summary: 'Shortened the headline to nine words and moved the guarantee above the founder story.', state: 'done', v: 2 }],
      repo: null, deploy: null,
    };
  }
  const spec = (b) => ({ brand: b.brand, design: b.design, offer: b.offer, copy: b.copy, assets: b.assets || {}, links: b.links || {} });
  const API = { build, spec, steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.OSFunnelDemo = API;
})(typeof window !== 'undefined' ? window : globalThis);

// Founder OS demo seed. Deterministic: the same business every load.
// 12 months of revenue events, 200 contacts, 60 videos, 30 ideas, 15 upcoming calls, agent runs and a starter Brain.
(() => {
  let s = 1104;
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const round2 = (v) => Math.round(v * 100) / 100;

  // Day 0 = 5 Nov 2025, day 364 = 3 Nov 2026 (yesterday). Today is Wed 4 Nov 2026 (day 365).
  const START = Date.UTC(2025, 10, 5), DAY = 86400000, TODAY = 365;
  const dateOf = (d) => new Date(START + d * DAY);
  const iso = (d) => dateOf(d).toISOString().slice(0, 10);

  const STREAMS = [
    { id: 'software', name: 'Software', note: 'White-label HighLevel SaaS for clinics' },
    { id: 'services', name: 'Services', note: 'Website, funnel and AI builds' },
    { id: 'products', name: 'Products', note: 'Kits, membership and coaching' },
    { id: 'affiliate', name: 'Affiliate', note: 'HighLevel recurring commissions' },
  ];

  const OFFERS = [
    { id: 'o-saas97', name: 'Clinic Software, Starter', stream: 'software', price: 97, unit: 'month', status: 'live', hl: 'SaaS plan · Starter' },
    { id: 'o-saas197', name: 'Clinic Software, Growth', stream: 'software', price: 197, unit: 'month', status: 'live', hl: 'SaaS plan · Growth' },
    { id: 'o-saas297', name: 'Clinic Software, Pro', stream: 'software', price: 297, unit: 'month', status: 'live', hl: 'SaaS plan · Pro' },
    { id: 'o-build', name: 'Website plus hosting build', stream: 'services', price: 2500, unit: 'project', status: 'live', hl: 'Invoice template · Build' },
    { id: 'o-aibuild', name: 'AI agent build', stream: 'services', price: 6000, unit: 'project', status: 'live', hl: 'Invoice template · AI build' },
    { id: 'o-kit', name: 'App Builder Kit', stream: 'products', price: 497, unit: 'once', status: 'live', hl: 'Product · App Builder Kit' },
    { id: 'o-funnelkit', name: 'Funnel Kit bundle', stream: 'products', price: 47, unit: 'once', status: 'live', hl: 'Product · Funnel Kit' },
    { id: 'o-skill', name: 'AI Skill Pack', stream: 'products', price: 27, unit: 'once', status: 'live', hl: 'Product · Skill Pack' },
    { id: 'o-member', name: 'Studio Membership', stream: 'products', price: 47, unit: 'month', status: 'live', hl: 'Membership · Studio' },
    { id: 'o-coach', name: 'Group Coaching cohort', stream: 'products', price: 1997, unit: 'cohort', status: 'live', hl: 'Product · Coaching' },
    { id: 'o-hl97', name: 'HighLevel Starter via your link', stream: 'affiliate', price: 38.8, unit: 'month', status: 'live', hl: 'Affiliate · 40% of 97' },
    { id: 'o-hl297', name: 'HighLevel Unlimited via your link', stream: 'affiliate', price: 118.8, unit: 'month', status: 'live', hl: 'Affiliate · 40% of 297' },
    { id: 'o-hl497', name: 'HighLevel Pro via your link', stream: 'affiliate', price: 198.8, unit: 'month', status: 'live', hl: 'Affiliate · 40% of 497' },
  ];
  const offerById = Object.fromEntries(OFFERS.map((o) => [o.id, o]));

  /* ---------- videos ---------- */
  const TITLES = [
    'My honest HighLevel review after 6 years', 'Build a clinic website in HighLevel in 30 minutes', 'How I price white-label SaaS', 'The funnel I would build if I started today',
    'Stop building funnels from scratch', '5 HighLevel automations every clinic needs', 'I asked Claude to write my sales page', 'How to get your first SaaS client',
    'The free redesign offer that gets replies', 'HighLevel vs ClickFunnels in 2026', 'My one-person business tech stack', 'How I host 40 websites on one account',
    'Turn a course into software', 'The DM I send to local businesses', 'Snapshots explained for beginners', 'What I would charge for a dental website',
    'Building an AI receptionist in HighLevel', 'Why most agencies stay small', 'My morning routine as a founder', 'Selling hosting without being salesy',
    'Reviewing your funnels live', 'How I plan a month of YouTube in one day', 'Claude Code for non-coders', 'Recurring revenue beats launches',
    'I rebuilt a gym website in 20 minutes', 'HighLevel Communities vs Skool', 'The offer ladder I use', 'AI Studio first look',
    'Why I stopped selling one-off websites', 'How to niche down without losing sleep', 'Client onboarding in 10 minutes', 'My biggest pricing mistake',
    'From freelancer to founder in 12 months', 'Booking calls from YouTube', 'Writing emails people answer', 'The 3 funnels every founder needs',
    'How I use Perplexity for research', 'Selling a 47 euro product to 1,000 people', 'Building a membership in HighLevel', 'Affiliate income explained honestly',
    'How I prep for sales calls with AI', 'What 68 SaaS clients taught me', 'HighLevel workflows I use daily', 'My content system for 2026',
    'How clinics actually buy software', 'Pricing a coaching cohort', 'Live build: booking funnel for a physio', 'The 17P sales page outline',
    'Tools I cancelled this year', 'Why I moved my community to HighLevel', 'The founder path in 12 minutes', 'How I host 68 clinic websites on one account',
    'Building AI agents for small businesses', 'HighLevel AI Studio vs Lovable', 'Getting clients without ads', 'I built a full SaaS inside HighLevel AI Studio in one day',
    'My founder dashboard, explained', 'The real cost of running a one-person SaaS', 'Answering your HighLevel questions', 'How I review a funnel in 5 minutes',
  ];
  const videos = TITLES.map((title, i) => {
    const day = title.startsWith('I built a full SaaS') ? 354 : Math.min(363, Math.round(i * 6.05) + between(0, 2));
    return { id: 'v' + (i + 1), title, day, date: iso(day) };
  });
  videos.sort((a, b) => a.day - b.day);
  // views: a steady channel with a few outliers; the AI Studio video is the recent breakout
  const special = { 'My honest HighLevel review after 6 years': 22400, 'How I host 40 websites on one account': 15800, 'AI Studio first look': 16900,
    'HighLevel AI Studio vs Lovable': 13100, 'I built a full SaaS inside HighLevel AI Studio in one day': 18420, 'How I host 68 clinic websites on one account': 9800,
    'The founder path in 12 minutes': 6100, 'What 68 SaaS clients taught me': 11200 };
  videos.forEach((v, k) => {
    const age = TODAY - v.day, growth = 0.55 + k / videos.length * 0.9;
    let views = special[v.title] || Math.round((2600 + rnd() * 4200) * growth);
    if (age < 7) views = Math.round(views * (0.35 + age * 0.09));
    v.views = views;
    v.likes = Math.round(views * (0.035 + rnd() * 0.02));
    v.comments = Math.round(views * (0.004 + rnd() * 0.004));
    v.watchMin = Math.round(views * (4.2 + rnd() * 3.1));
    v.ctr = round2(3.8 + rnd() * 4.4);
    v.subsGained = Math.round(views * (0.008 + rnd() * 0.006));
    v.leads = Math.round(views * (0.0032 + rnd() * 0.0028));
  });
  videos.forEach((v, k) => {
    const prev = videos.slice(Math.max(0, k - 30), k).map((x) => x.views).sort((a, b) => a - b);
    const med = prev.length ? prev[Math.floor(prev.length / 2)] : v.views;
    v.outlier = round2(v.views / med);
  });
  const videoByTitle = Object.fromEntries(videos.map((v) => [v.title, v]));

  /* ---------- contacts ---------- */
  const FIRST = ['Maria', 'Daniel', 'Sofia', 'Anna', 'Jonas', 'Elin', 'Mikael', 'Laura', 'Oskar', 'Emma', 'Lucas', 'Ida', 'Noah', 'Sara', 'Elias', 'Hanna', 'Leo', 'Julia', 'Aleksi', 'Nora', 'Viktor', 'Aino', 'Samuel', 'Klara', 'Marcus', 'Lina', 'David', 'Emilia', 'Theo', 'Olivia', 'Felix', 'Amira', 'Rafael', 'Priya', 'Tomás', 'Chloe', 'Kenji', 'Zara', 'Mateo', 'Freya', 'Isaac', 'Leila', 'Hugo', 'Nina', 'Arjun', 'Maja', 'Ben', 'Carmen', 'Erik', 'Ruby'];
  const LAST = ['Lindqvist', 'Okafor', 'Brandt', 'Rautio', 'Berg', 'Nyström', 'Koskinen', 'Svensson', 'Hughes', 'Moreau', 'Silva', 'Novak', 'Laine', 'Holm', 'Andersen', 'Varga', 'Ricci', 'Kowalski', 'Mäkelä', 'Dubois', 'Fischer', 'Ahmed', 'Patel', 'García', 'Johansson', 'Virtanen', 'Murphy', 'Costa', 'Nielsen', 'Eklund'];
  const COUNTRIES = ['Finland', 'Sweden', 'Norway', 'Denmark', 'Germany', 'United Kingdom', 'Netherlands', 'United States', 'Canada', 'Australia', 'Ireland', 'Spain'];
  const BIZ = { software: ['Dental', 'Physio', 'Chiropractic', 'Aesthetics', 'Veterinary', 'Optician', 'Dermatology', 'Fertility'], other: ['Coaching', 'Consulting', 'Studio', 'Agency', 'Fitness', 'Academy', 'Media', 'Digital'] };
  const kindOfBiz = { Dental: 'clinic', Physio: 'clinic', Chiropractic: 'clinic', Aesthetics: 'clinic', Veterinary: 'clinic', Optician: 'clinic', Dermatology: 'clinic', Fertility: 'clinic' };

  const contacts = [];
  const used = new Set();
  for (let i = 0; i < 200; i++) {
    let first, last; do { first = pick(FIRST); last = pick(LAST); } while (used.has(first + last)); used.add(first + last);
    const roles = new Set();
    if (i < 77) roles.add('software');
    if (i < 21 || (i >= 77 && i < 87)) roles.add('services');
    if ((i >= 87 && i < 177) || i < 11) roles.add('products');
    if (i >= 147 && i < 200 && i < 177 + 23) roles.add('affiliate');
    const clinic = roles.has('software') || (roles.has('services') && rnd() < 0.6);
    const bizWord = clinic ? pick(BIZ.software) : pick(BIZ.other);
    const company = roles.size || rnd() < 0.7 ? `${last} ${bizWord}` : '';
    const sourceRoll = rnd();
    const source = sourceRoll < 0.56 ? 'youtube' : sourceRoll < 0.71 ? 'outreach' : sourceRoll < 0.83 ? 'referral' : sourceRoll < 0.93 ? 'community' : 'direct';
    contacts.push({
      id: 'c' + (i + 1), first, last, name: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@${(company ? company.split(' ')[0] : 'mail').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${pick(['fi', 'se', 'com', 'co.uk', 'de', 'io'])}`,
      company, kind: clinic ? kindOfBiz[bizWord] || 'clinic' : bizWord.toLowerCase(), country: rnd() < 0.86 ? pick(COUNTRIES) : '', title: rnd() < 0.7 ? pick(['Owner', 'Founder', 'Clinic manager', 'Practice owner', 'Director', 'Coach', 'Marketing lead']) : '',
      roles: [...roles], source, firstVideo: null, hlId: 'hl_' + (90210 + i * 37).toString(36), tags: [], watchCount: source === 'youtube' ? between(2, 26) : between(0, 6),
    });
  }

  /* ---------- revenue events ---------- */
  const events = [];
  let evn = 0;
  const addEv = (day, stream, amount, offerId, contactId, note) => { if (day < 0 || day > 364) return; events.push({ id: 'e' + (++evn), day, date: iso(day), stream, amount: round2(amount), offerId, contactId, note: note || '' }); };

  // first activity day per contact, then attribution to a video published before it
  const firstDay = {};
  const firstVideoFor = (day, c) => {
    const pool = videos.filter((v) => v.day <= day - 1 && v.day >= day - 120);
    if (!pool.length) return null;
    const w = pool.map((v) => v.views * (1 + (v.title.includes('AI Studio') && day > 320 ? 6 : 0)) / (1 + (day - v.day) / 40));
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < pool.length; k++) { r -= w[k]; if (r <= 0) return pool[k].id; }
    return pool[pool.length - 1].id;
  };

  // Software: 30 active at the start, 47 sign-ups over the year (faster lately), 9 churn
  const saasPlan = {};
  contacts.slice(0, 77).forEach((c, i) => {
    const plan = i % 9 === 0 ? 'o-saas297' : i % 3 === 0 ? 'o-saas197' : 'o-saas97';
    saasPlan[c.id] = plan;
    const signup = i < 30 ? -between(10, 300) : Math.round(Math.pow((i - 29) / 47, 0.8) * 355) + between(0, 6) - 4;
    const churnAt = [3, 8, 14, 22, 33, 41, 48, 55, 61].includes(i) ? between(Math.max(signup + 40, 60), 340) : Infinity;
    c.saas = { plan, signup, churnAt: churnAt === Infinity ? null : churnAt, mrr: offerById[plan].price };
    for (let d = signup; d <= 364; d += 30) { if (d >= churnAt) break; addEv(d, 'software', offerById[plan].price, plan, c.id, d === signup ? 'First month' : 'Monthly'); }
    firstDay[c.id] = Math.max(0, signup);
  });
  // Services: deposit and delivery, about three projects a month
  contacts.filter((c) => c.roles.includes('services')).forEach((c, i) => {
    const n = i % 5 === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const big = i % 7 === 3 && k === 0;
      const value = big ? 6000 : pick([1500, 2000, 2500, 2500, 3000, 3500]);
      const start = c.roles.includes('software') && k === 0 && c.saas.signup > 30 ? c.saas.signup - between(10, 25) : Math.min(350, Math.round(((i * 2 + k) / 62) * 345) + between(0, 12));
      addEv(start, 'services', value / 2, big ? 'o-aibuild' : 'o-build', c.id, 'Deposit');
      addEv(start + between(18, 30), 'services', value / 2, big ? 'o-aibuild' : 'o-build', c.id, 'On delivery');
      firstDay[c.id] = Math.min(firstDay[c.id] ?? 999, start);
    }
  });
  // Products: kit after the September launch, funnel kit all year, skill pack, membership, two coaching cohorts
  contacts.filter((c) => c.roles.includes('products')).forEach((c, i) => {
    const d0 = i < 30 ? between(300, 362) : between(5, 360);
    const lateBoost = d0 > 323 && d0 < 335;
    if (rnd() < 0.55) addEv(d0, 'products', 47, 'o-funnelkit', c.id);
    if (rnd() < 0.35) addEv(d0 + between(0, 9), 'products', 27, 'o-skill', c.id);
    if (d0 >= 300 && (rnd() < 0.45 || lateBoost)) addEv(Math.max(d0, 302), 'products', 497, 'o-kit', c.id);
    if (rnd() < 0.42) { const m0 = d0 + between(1, 20); c.member = { since: m0, until: rnd() < 0.25 ? m0 + between(60, 200) : null }; for (let d = m0; d <= 364; d += 30) { if (c.member.until && d > c.member.until) break; addEv(d, 'products', 47, 'o-member', c.id, 'Membership'); } }
    if (i % 11 === 2) addEv(rnd() < 0.5 ? between(118, 124) : between(300, 306), 'products', 1997, 'o-coach', c.id, 'Cohort seat');
    firstDay[c.id] = Math.min(firstDay[c.id] ?? 999, d0);
  });
  // Affiliate: 40 anonymous accounts at the start, 12 more anonymous plus 53 linked contacts over the year
  const affAccounts = [];
  for (let k = 0; k < 52; k++) affAccounts.push({ id: 'acct' + (k + 1), contactId: null, start: k < 40 ? -between(10, 600) : between(20, 360), plan: rnd() < 0.62 ? 'o-hl97' : rnd() < 0.8 ? 'o-hl297' : 'o-hl497', churn: k % 13 === 5 ? between(100, 300) : null });
  contacts.filter((c) => c.roles.includes('affiliate')).forEach((c, k) => { const st = Math.round(Math.pow((k + 1) / 53, 0.7) * 350) + between(0, 8); affAccounts.push({ id: 'acct' + (60 + k), contactId: c.id, start: st, plan: rnd() < 0.6 ? 'o-hl97' : rnd() < 0.85 ? 'o-hl297' : 'o-hl497', churn: k % 17 === 4 ? st + between(60, 150) : null }); firstDay[c.id] = Math.min(firstDay[c.id] ?? 999, st); });
  affAccounts.forEach((a) => { const first = a.start < 0 ? ((a.start % 30) + 30) % 30 : a.start; for (let d = first; d <= 364; d += 30) { if (a.churn && d >= a.churn) break; if (d < a.start) continue; addEv(d, 'affiliate', offerById[a.plan].price, a.plan, a.contactId, a.contactId ? 'Commission' : 'Commission · ' + a.id); } });

  // attribution: youtube contacts get the video that brought them in
  contacts.forEach((c) => {
    const d = firstDay[c.id] ?? between(200, 360);
    c.firstDay = d;
    if (c.source === 'youtube' && d >= 25) c.firstVideo = firstVideoFor(d, c);
  });
  // the breakout video gets the late buyers it actually drove
  const breakout = videoByTitle['I built a full SaaS inside HighLevel AI Studio in one day'];
  contacts.slice(120, 128).forEach((c, k) => { addEv(355 + k, 'products', 497, 'o-kit', c.id, 'Bought after the AI Studio video'); c.lastVideo = breakout.id; });
  [74, 75, 76].forEach((i) => { contacts[i].lastVideo = breakout.id; });
  contacts.filter((c) => c.firstDay >= breakout.day).forEach((c) => { c.source = 'youtube'; c.firstVideo = breakout.id; });
  const vday = Object.fromEntries(videos.map((v) => [v.id, v.day]));
  const cById = Object.fromEntries(contacts.map((c) => [c.id, c]));
  events.forEach((e) => {
    const c = e.contactId && cById[e.contactId];
    e.source = c ? (c.lastVideo && e.day >= breakout.day ? 'youtube' : c.source) : 'direct';
    e.videoId = !c ? null : c.lastVideo && e.day >= breakout.day ? c.lastVideo : c.source === 'youtube' && c.firstVideo && vday[c.firstVideo] <= e.day ? c.firstVideo : null;
  });
  events.sort((a, b) => a.day - b.day);

  /* ---------- contact roll-ups ---------- */
  const byContact = {};
  events.forEach((e) => { if (!e.contactId) return; (byContact[e.contactId] ||= []).push(e); });
  contacts.forEach((c) => {
    const ev = byContact[c.id] || [];
    c.ltv = round2(ev.reduce((a, e) => a + e.amount, 0));
    c.ltvBy = {}; ev.forEach((e) => { c.ltvBy[e.stream] = round2((c.ltvBy[e.stream] || 0) + e.amount); });
    c.lastDay = ev.length ? ev[ev.length - 1].day : c.firstDay;
    if (c.saas) {
      const active = !c.saas.churnAt;
      const logins = active ? between(2, 30) : 0;
      c.health = active ? Math.max(18, Math.min(98, Math.round(42 + logins * 1.7 + (c.watchCount > 8 ? 8 : 0) - (c.id.endsWith('7') ? 30 : 0)))) : 0;
      c.logins30 = logins;
    }
    c.tags = [...c.roles.map((r) => r), c.source === 'youtube' ? 'yt-lead' : c.source];
    c.missing = ['company', 'country', 'title'].filter((k) => !c[k]);
  });

  /* ---------- calls ---------- */
  const callKinds = [
    ['Website redesign call', 'services', 3500], ['SaaS onboarding', 'software', 197], ['Coaching enrollment', 'products', 1997], ['Client check-in', 'software', 97], ['AI agent build scoping', 'services', 6000], ['SaaS upgrade review', 'software', 297], ['Discovery call', 'services', 2500],
  ];
  const callNotes = ['Watched 4 of your videos this month. Opened the proposal twice.', 'Trial ends Friday. Has not connected the calendar yet.', 'Asked about payment plans in the community.', 'Health score dropped from 71 to 48 in two weeks.', 'Referred by an existing clinic client.', 'Bought the App Builder Kit on 27 Oct.', 'Replied to the free redesign DM within an hour.', 'On Starter for 9 months, using reviews heavily.'];
  const upcoming = [];
  const callSlots = [[0, '10:30'], [0, '14:00'], [0, '16:45'], [1, '09:30'], [1, '13:00'], [2, '11:00'], [2, '15:30'], [5, '10:00'], [5, '14:30'], [6, '09:00'], [7, '12:00'], [8, '10:30'], [8, '16:00'], [9, '11:30'], [12, '13:30']];
  const callPeople = [0, 15, 95, 22, 101, 4, 78, 40, 120, 9, 83, 61, 130, 18, 88];
  callSlots.forEach(([dd, t], k) => {
    const c = contacts[callPeople[k]], [kind, stream, value] = callKinds[k % callKinds.length];
    upcoming.push({ id: 'call' + (k + 1), day: TODAY + dd, date: iso(TODAY + dd), time: t, contactId: c.id, kind, stream, value, note: callNotes[k % callNotes.length] });
  });
  const pastCalls = [];
  for (let k = 0; k < 14; k++) {
    const c = contacts[[2, 6, 11, 17, 25, 33, 52, 79, 84, 90, 99, 104, 141, 160][k]], [kind, stream, value] = callKinds[(k + 2) % callKinds.length];
    const talk = between(38, 72), qs = between(4, 17), silence = round2(0.6 + rnd() * 4.2), discount = rnd() < 0.3, next = rnd() < 0.64;
    const won = next && rnd() < 0.6;
    const scoreRaw = 10 - Math.max(0, talk - 45) / 6 - (qs < 8 ? 1.2 : 0) - (silence < 2 ? 1 : 0) - (discount ? 1.4 : 0) + (next ? 0.4 : -0.8);
    pastCalls.push({ id: 'pc' + (k + 1), day: 362 - k * 3, date: iso(362 - k * 3), contactId: c.id, kind, stream, value, minutes: between(22, 58), talk, questions: qs, silence, discount, nextStep: next, outcome: won ? 'won' : next ? 'follow-up' : 'lost', score: round2(Math.max(4.2, Math.min(9.6, scoreRaw))) });
  }

  /* ---------- comments ---------- */
  const COMMENT_POOL = [
    ['question', 'How do you handle hosting when a client wants to leave?'], ['buying', 'Is the kit still available? I want the clinic version.'], ['question', 'What would you charge a physio for this?'],
    ['praise', 'This saved me a weekend. Thank you.'], ['objection', 'Feels like a lot of work for 97 a month.'], ['buying', 'Do you offer this as a done-for-you service?'],
    ['question', 'Can AI Studio connect to my own Claude key?'], ['praise', 'Best HighLevel channel on YouTube right now.'], ['question', 'How many clients before this makes sense?'],
    ['buying', 'Where do I sign up for the cohort?'], ['objection', 'I tried this and my clients never logged in.'], ['question', 'What do you use for the thumbnails?'],
  ];
  const commentsFor = (videoId) => { const v = videos.find((x) => x.id === videoId); const n = Math.min(6, 2 + Math.floor(v.comments / 25)); const out = []; for (let k = 0; k < n; k++) { const [intent, text] = COMMENT_POOL[(parseInt(videoId.slice(1)) * 3 + k * 5) % COMMENT_POOL.length]; out.push({ intent, text, author: `@${FIRST[(k * 7 + parseInt(videoId.slice(1))) % FIRST.length].toLowerCase()}${(k * 13) % 97}`, likes: (k * 17 + 3) % 41 }); } return out; };

  /* ---------- ideas ---------- */
  const IDEAS = [
    ['ideas', 'The 3 numbers I check every morning as a founder', 9.1, ['CALL', 'COMMENT'], ['software', 'products'], 'MOF', 'Asked on 5 calls and in 23 comments in October.'],
    ['ideas', 'HighLevel AI Studio vs Lovable for client apps', 8.8, ['OUTLIER'], ['affiliate', 'software'], 'TOF', 'Two competitor videos on this hit 6x and 9x their medians.'],
    ['ideas', 'Why clinics churn from SaaS in month three', 8.5, ['REVENUE', 'CALL'], ['software'], 'BOF', '6 of your 9 churned clients left between day 60 and 100.'],
    ['ideas', 'Pricing a white-label SaaS for dentists', 7.6, ['COMMUNITY'], ['software'], 'BOF', '14 community questions about price this month.'],
    ['ideas', 'I let Claude run my business for a week', 8.2, ['OUTLIER'], ['products', 'affiliate'], 'TOF', 'Experiment format averages 5.4x across 12 channels you track.'],
    ['ideas', 'The free redesign DM, line by line', 7.9, ['CALL', 'REVENUE'], ['services', 'software'], 'MOF', 'Outreach contacts convert to SaaS at 41%.'],
    ['ideas', 'What I would build with 1,000 euros and HighLevel', 7.4, ['COMMENT'], ['affiliate', 'products'], 'TOF', '9 comments asked a version of this.'],
    ['ideas', 'Membership or cohort: what I learned from both', 7.1, ['REVENUE'], ['products'], 'MOF', 'Membership churn is 3x cohort refund rate.'],
    ['ideas', 'Answering the 10 most asked AI Studio questions', 7.8, ['COMMENT', 'COMMUNITY'], ['affiliate', 'products'], 'TOF', 'Your AI Studio video has 141 unanswered questions.'],
    ['ideas', 'How I onboard a clinic in 20 minutes', 8.0, ['CALL'], ['software', 'services'], 'BOF', 'Onboarding came up on every check-in call this month.'],
    ['developing', 'I rebuilt a dentist website in 20 minutes', 8.4, ['OUTLIER', 'CALL'], ['services', 'software'], 'TOF', 'Structure proven at 7.2x. Script waiting in the Newsfeed.'],
    ['developing', 'My full founder tech stack for 2027', 8.0, ['COMMENT', 'REVENUE'], ['affiliate', 'products'], 'TOF', 'Stack videos drive 38% of affiliate revenue.'],
    ['developing', 'Why I stopped selling one-off websites, part 2', 7.7, ['CALL'], ['software', 'services'], 'MOF', 'Part 1 drove 6 SaaS sign-ups.'],
    ['developing', 'The founder scorecard (free template)', 8.3, ['REVENUE', 'COMMENT'], ['products'], 'MOF', 'Lead magnet for the Launch Workshop waitlist.'],
    ['developing', 'Building an AI receptionist for a physio, live', 8.1, ['OUTLIER'], ['services', 'affiliate'], 'TOF', 'Live builds average 3.1x on your channel.'],
    ['developing', 'Client health: the one metric I watch for SaaS', 7.5, ['REVENUE'], ['software'], 'BOF', 'Pairs with the churn idea for a two-part series.'],
    ['developing', 'Snapshot vs template vs AI Studio', 7.0, ['COMMUNITY'], ['affiliate'], 'TOF', 'Most common beginner confusion in Communities.'],
    ['ready', 'Selling hosting to local clinics: the DM I send', 8.6, ['CALL', 'REVENUE'], ['software', 'services'], 'BOF', 'Filmed. Thumbnail A and B ready in HighLevel media.'],
    ['ready', 'My HighLevel affiliate numbers, 12 months in', 8.2, ['REVENUE'], ['affiliate'], 'MOF', 'Script approved 29 Oct. Recording booked Thursday.'],
    ['ready', 'Claude Skills for funnel builders', 7.9, ['OUTLIER', 'COMMENT'], ['products'], 'TOF', 'Supports the AI Skill Pack.'],
    ['ready', 'The 5-minute funnel audit', 7.3, ['CALL'], ['services'], 'MOF', 'Filmed with two real funnels, permissions signed.'],
    ['ready', 'Launch Workshop: what you will build in 14 days', 7.6, ['REVENUE'], ['products'], 'BOF', 'Waits for the offer to be approved.'],
    ['published', 'I built a full SaaS inside HighLevel AI Studio in one day', 9.4, ['OUTLIER'], ['software', 'products', 'affiliate', 'services'], 'TOF', ''],
    ['published', 'My founder dashboard, explained', 7.9, ['COMMENT'], ['products', 'software'], 'MOF', ''],
    ['published', 'The real cost of running a one-person SaaS', 8.0, ['REVENUE'], ['software'], 'MOF', ''],
    ['published', 'Answering your HighLevel questions', 6.9, ['COMMENT', 'COMMUNITY'], ['affiliate'], 'TOF', ''],
    ['published', 'How I review a funnel in 5 minutes', 7.2, ['CALL'], ['services'], 'MOF', ''],
    ['published', 'The founder path in 12 minutes', 7.8, ['COMMENT'], ['products'], 'MOF', ''],
    ['published', 'How I host 68 clinic websites on one account', 8.1, ['REVENUE'], ['software', 'services'], 'BOF', ''],
    ['published', 'HighLevel AI Studio vs Lovable', 8.6, ['OUTLIER'], ['affiliate', 'software'], 'TOF', ''],
  ];

  // The demo owner's YouTube plan. Pillars and formats are a starting point; scores and fit notes are demo estimates.
  const PILLARS = [['funnels', 'Funnels and digital products'], ['ai', 'AI, agents and vibe coding'], ['brand', 'Personal branding'], ['hl', 'HighLevel and white-label SaaS']];
  const FORMATS = [['tutorial', 'Tutorials, reviews and news'], ['edu', 'Business education'], ['mmo', 'Make money online inspiration']];
  const YT_PLAN = { title: 'YouTube plan 2027', goal: 'The path to 25,000 subscribers and $30,000 a month from products and commissions', principle: 'Give more free value than anyone else in the niche.', pillars: PILLARS, formats: FORMATS, docUrl: '' };
  const DOC_IDEAS = [
    ['3 Businesses AI Makes Easier to Start, Not Harder', 8.6, 'funnels', 'mmo', ['products', 'software'], 'TOF', 'Wide entry point. Each business maps to one of your streams, so the end screen can route to the Launch Workshop.', ['3 businesses AI makes easier to start', 'EASIER NOW', 'I ranked 3 businesses AI helps the most. One surprised me', 'RANKED']],
    ['The Side Project I Would Start With $0 Tonight', 8.4, 'ai', 'mmo', ['products', 'affiliate'], 'TOF', 'Inspiration format with a clear first step. Pair the reveal with the HighLevel trial link.', ['The $0 side project I would start tonight', '$0 START', 'What I would build tonight if I had no budget', 'NO BUDGET']],
    ['Why Your Personal Brand Matters More in 2027', 8.2, 'brand', 'edu', ['products'], 'TOF', 'Opens the personal brand pillar. Good lead-in for the Launch Workshop waitlist.', ['Your personal brand is the one asset AI cannot copy', 'BUILD IT NOW', 'Why I would build a personal brand before a business in 2027', 'BRAND FIRST']],
    ['Every New HighLevel Feature This Month, Shown on Screen', 8.9, 'hl', 'tutorial', ['affiliate', 'software'], 'TOF', 'News plus tutorial on a launch moment. Your HighLevel videos already drive the most affiliate trials.', ['The HighLevel update, feature by feature', 'NEW THIS MONTH', 'I tested the new HighLevel features for a week. This is what matters', 'WHAT MATTERS']],
    ['10 HighLevel Offers Clients Actually Pay For', 8.6, 'hl', 'edu', ['software', 'services', 'affiliate'], 'MOF', 'List format that touches three streams. Each offer can link to a funnel or template.', ['10 HighLevel offers clients pay for', '10 OFFERS', 'How I would sell HighLevel to my first 10 clients', 'FIRST 10']],
    ['The Founder Path, Step by Step', 8.5, 'funnels', 'edu', ['products', 'software'], 'MOF', 'Direct pitch for the membership. Sequel to "The founder path in 12 minutes".', ['The exact path I would copy to a founder business', 'COPY THIS', 'From zero to your first product: the founder path', 'STEP BY STEP']],
    ['HighLevel for Beginners: The Complete Walkthrough', 8.5, 'hl', 'tutorial', ['affiliate'], 'TOF', 'Evergreen search video. Long watch time and a steady trial source all year.', ['HighLevel for beginners: the complete walkthrough', 'FULL TUTORIAL', 'Learn HighLevel in one sitting', 'ONE SITTING']],
    ['Claude Plus HighLevel for Bigger Client Projects', 8.8, 'ai', 'tutorial', ['services', 'affiliate'], 'MOF', 'Combines your two strongest topics. Shows the AI agent build on screen.', ['How I use Claude and HighLevel for bigger client projects', 'BIGGER PROJECTS', 'I built a client project with Claude and HighLevel', 'LIVE BUILD']],
    ['A Full Tour of My AI Operating System', 8.3, 'ai', 'edu', ['products', 'software'], 'MOF', 'Shows this dashboard. Natural reveal for a product or waitlist.', ['I built an AI operating system for my business. Full tour', 'FOUNDER OS', 'The dashboard that runs my one-person business', 'MY OS']],
    ['Why I Sell Software Instead of AI Agency Services', 8.6, 'hl', 'edu', ['software', 'affiliate'], 'TOF', 'Contrarian take. Matches your September shift in view, so update the Brain answer first.', ['Why I moved from AI agency work to software', 'SOFTWARE', 'Why I stopped pitching AI agency services', 'SELL SAAS']],
    ['The One-Person Business Model I Would Start in 2027', 8.2, 'funnels', 'mmo', ['products'], 'TOF', 'Broad inspiration. Works as the entry video for the one-person business series.', ['The one-person business model I would start in 2027', '1 PERSON', 'This one-person business runs without a team', 'NO TEAM']],
    ['Give Me 20 Minutes and I Will Build Your First Offer', 8.6, 'funnels', 'tutorial', ['products', 'software'], 'TOF', 'Build-along promise with a time box. Live build formats average 3.1x on your channel.', ['20 minutes from idea to an offer you can sell', '20 MIN', 'Watch me build an offer from scratch in 20 minutes', 'FROM SCRATCH']],
    ['Starting From Zero in 2027? Exactly What I Would Do', 8.1, 'brand', 'edu', ['products'], 'TOF', 'Story-led. Uses the founder story doc in Brain.', ['Starting from zero in 2027? Exactly what I would do', 'START OVER', 'If I started again tomorrow, this is the business I would build', 'DAY 1']],
    ['No Clients Yet? Start With This One Offer', 8.4, 'hl', 'edu', ['services', 'software'], 'MOF', 'Answers the most common beginner block. Leads into the free redesign outreach method.', ['No clients yet? Start with this one offer', 'NO CLIENTS?', 'How I would get my first client with zero portfolio', 'CLIENT #1']],
    ['How to Turn What You Know Into a Product', 7.9, 'brand', 'edu', ['products'], 'MOF', 'Core productize idea from the founder path. Strong for the membership.', ['How to turn what you know into a product people buy', 'PRODUCTIZE', 'Stop selling your time. Productize what you know', 'YOU = PRODUCT']],
    ['Lovable or HighLevel AI Studio for Client Apps?', 8.7, 'ai', 'tutorial', ['affiliate', 'software'], 'TOF', 'Review with a reason to click. Follows your AI Studio vs Lovable video.', ['Which AI builder I use for client apps, and why', 'MY PICK', 'Lovable vs HighLevel AI Studio: what I use now', 'I SWITCHED']],
    ['The AI Workflows I Use Every Single Day', 7.8, 'ai', 'mmo', ['products'], 'TOF', 'Personality piece. Best as a short series opener or a community post first.', ['The AI workflows I use every day', 'DAILY AI', 'The AI workflows that save me hours each week', 'HOURS SAVED']],
    ['A Beginner AI Business You Can Test This Week', 8.3, 'ai', 'mmo', ['products', 'software'], 'TOF', 'Specific first step hook. Show the setup and the first week of results.', ['The beginner AI business you can test this week', 'TEST IT', 'I tested a beginner AI business for 7 days', '7 DAYS']],
  ];
  const guessPillar = (t) => /highlevel|saas|clinic|white-label|snapshot|hosting|affiliate/i.test(t) ? 'hl' : /claude|\bai\b|agent|lovable|receptionist|skills/i.test(t) ? 'ai' : /brand|founder|story/i.test(t) ? 'brand' : 'funnels';
  const guessFormat = (t) => /vs|how|tutorial|build|audit|answer|snapshot|onboard/i.test(t) ? 'tutorial' : /numbers|cost|\$|euros/i.test(t) ? 'mmo' : 'edu';
  const ideas = IDEAS.map(([col, title, score, sources, streams, stage, why], k) => {
    const v = col === 'published' ? videoByTitle[title] : null;
    return { id: 'i' + (k + 1), col, title, score, sources, streams, stage, why, pillar: guessPillar(title), format: guessFormat(title), videoId: v ? v.id : null, created: iso(364 - (k % 9) * 2), vote: null };
  });
  DOC_IDEAS.forEach(([title, score, pillar, format, streams, stage, why, alts], k) => ideas.push({ alts, id: 'i' + (31 + k), col: 'ideas', title, score, sources: ['YOUR PLAN'], streams, stage, why, pillar, format, videoId: null, created: iso(365), vote: null, fromDoc: true }));

  /* ---------- agents and runs ---------- */
  const AGENTS = [
    ['proven', 'Proven Finder', 'Brand and content', 'Watches only', 'Daily 05:00', 0.04, 30, 'Reads every creator and channel you track, finds posts that beat that creator\u2019s own median by 2x or more, and names the pattern behind each.', []],
    ['remix', 'Remix Writer', 'Brand and content', 'Acts', 'On proven pick', 0.12, 40, 'Rewrites a proven post as your version: same pattern, your story, your proof, pointed at the offer and funnel that fit.', []],
    ['nightly', 'Nightly Ideation', 'Brand and content', 'Acts', 'Daily 02:00', 0.62, 44, 'Finds outliers, reads comments, calls, community and sales, then scores new ideas.', ['/ideate-outliers', '/ideate-comments', '/ideate-calls', '/ideate-community', '/ideate-revenue']],
    ['draft', 'Draft Studio', 'Brand and content', 'Acts', 'On approved idea', 0.29, 28, 'Writes two variants in your voice plus one proven structure, each graded.', []],
    ['repurpose', 'Repurposer', 'Brand and content', 'Acts', 'On publish', 0.24, 26, 'Turns one video into posts, an email, a lead magnet idea and a community prompt.', []],
    ['trends', 'Trend Watcher', 'Brand and content', 'Watches only', 'Daily 06:00', 0.07, 15, 'Reads HighLevel release notes, AI launches and your niche on YouTube, and flags anything worth filming within 48 hours.', ['/hl-changelog', '/ai-launches', '/niche-outliers']],
    ['planner', 'Content Planner', 'Brand and content', 'Acts', 'Sundays 17:00', 0.21, 40, 'Plans the next two weeks of videos and posts across your four pillars, weighted toward the stream that is behind on its goal.', ['/plan-long', '/plan-shorts', '/plan-posts']],
    ['titles', 'Title and Thumbnail Lab', 'Brand and content', 'Acts', 'On approved idea', 0.18, 35, 'Writes 10 titles and 3 thumbnail concepts for each idea, scored against what earns clicks on your channel.', ['/titles', '/thumbnail-concepts', '/ctr-check']],
    ['hooks', 'Hook Doctor', 'Brand and content', 'Acts', '48 h after publish', 0.11, 20, 'Reads the retention graph, finds where viewers leave in the first minute, and rewrites the opening for the next video.', ['/retention-read', '/hook-rewrite']],
    ['shorts', 'Shorts Cutter', 'Brand and content', 'Acts', 'On publish', 0.19, 45, 'Picks the 4 strongest moments in each long video, with timestamps, captions and an opening line for each short.', ['/find-moments', '/captions', '/short-hooks']],
    ['upload', 'Upload Packager', 'Brand and content', 'Acts', 'On upload', 0.09, 25, 'Writes the description, chapters, tags and pinned comment, with tracked links to the right offer and affiliate SubID.', ['/description', '/chapters', '/subid-links']],
    ['social', 'Social Writer', 'Brand and content', 'Acts', 'Mon, Wed, Fri 07:30', 0.14, 30, 'Turns calls, videos and client wins into LinkedIn, X and Instagram posts in your voice.', ['/linkedin', '/x-thread', '/ig-caption']],
    ['newsletter', 'Newsletter Writer', 'Brand and content', 'Acts', 'Fridays 08:00', 0.17, 50, 'Writes the weekly email from the week\u2019s video, one lesson and one offer, ready to send from HighLevel.', ['/weekly-email', '/subject-lines']],
    ['comments', 'Comment Replier', 'Brand and content', 'Acts', 'Every 3 hours', 0.05, 8, 'Drafts replies to new YouTube comments and flags buying questions as warm leads in HighLevel.', ['/reply-drafts', '/lead-flag']],
    ['casestudy', 'Case Study Writer', 'Brand and content', 'Acts', 'On client milestone', 0.26, 60, 'Turns a client win in HighLevel into a case study, a testimonial request and a video idea.', ['/case-study', '/testimonial-ask']],
    ['leadmagnet', 'Lead Magnet Maker', 'Brand and content', 'Acts', '1st of the month 10:00', 0.34, 90, 'Builds a checklist or template from your best video of the month, with opt-in page copy for HighLevel.', ['/magnet-outline', '/optin-copy']],
    ['analyst', 'Video Analyst', 'Brand and content', 'Watches only', 'Mondays 08:00', 0.08, 25, 'Reviews every video at 7 days: click rate, retention, leads and revenue per 1,000 views, against your median.', ['/ctr', '/retention', '/revenue-per-view']],
    ['offerlab', 'Offer Lab', 'Offers and funnels', 'Acts', 'Mondays 09:00', 0.81, 95, 'Researches demand and drafts offers with price logic and a value stack.', []],
    ['funnel', 'Funnel Builder', 'Offers and funnels', 'Acts', 'On approved offer', 1.6, 180, 'Packages page copy, emails, an AI Studio prompt and a setup checklist for HighLevel.', []],
    ['offerspy', 'Offer Spy', 'Offers and funnels', 'Watches only', 'Thursdays 07:00', 0.12, 30, 'Tracks competitor offers, prices, bonuses and guarantees in your niche, and flags changes worth answering.', ['/competitor-pages', '/price-changes', '/bonus-stacks']],
    ['objections', 'Objection Miner', 'Offers and funnels', 'Watches only', 'After each call', 0.06, 12, 'Pulls objections from calls, comments, refunds and DMs, ranks them, and maps each one to the page section that should answer it.', ['/call-objections', '/refund-reasons', '/comment-doubts']],
    ['ladder', 'Ladder Mapper', 'Offers and funnels', 'Watches only', 'Mondays 08:30', 0.07, 20, 'Maps where buyers go after each offer, finds the gaps in your value ladder and names the next offer to build.', ['/buyer-paths', '/ladder-gaps']],
    ['pricing', 'Price Tester', 'Offers and funnels', 'Acts', 'Mondays 10:00', 0.15, 35, 'Proposes price and payment plan tests from conversion and refund data, with the revenue math for each.', ['/price-elasticity', '/payment-plans']],
    ['bumps', 'Bump and Upsell Writer', 'Offers and funnels', 'Acts', 'On approved offer', 0.18, 40, 'Writes the order bump, one-time offer and downsell for each checkout, priced from what buyers take next.', ['/order-bump', '/oto', '/downsell']],
    ['sequence', 'Sequence Writer', 'Offers and funnels', 'Acts', 'On new funnel', 0.31, 75, 'Writes welcome, nurture and cart-close emails and texts, ready to paste into HighLevel workflows.', ['/welcome', '/nurture', '/cart-close']],
    ['adangles', 'Ad Angle Writer', 'Offers and funnels', 'Acts', 'Tuesdays 09:00', 0.16, 35, 'Turns your best videos and the top objections into ad hooks, angles and scripts for Meta and YouTube ads.', ['/hooks', '/angles', '/ad-scripts']],
    ['leak', 'Leak Finder', 'Offers and funnels', 'Watches only', 'Daily 05:30', 0.05, 15, 'Reads every funnel step by step and names the biggest drop-off, with what it costs you each month.', ['/step-dropoff', '/leak-cost']],
    ['audit', 'Page Auditor', 'Offers and funnels', 'Acts', 'Wednesdays 09:00', 0.22, 45, 'Audits funnel pages against your CONVERSIONS checklist and drafts fixes for the weakest sections.', ['/conversions-audit', '/section-fixes']],
    ['splittest', 'Split Test Manager', 'Offers and funnels', 'Acts', 'Daily 08:00', 0.09, 18, 'Proposes A/B tests to run in HighLevel, watches the ones running and calls a winner only when the result holds.', ['/test-ideas', '/significance']],
    ['recovery', 'Checkout Recovery', 'Offers and funnels', 'Acts', 'On abandoned checkout', 0.04, 6, 'Drafts abandoned checkout emails and texts for HighLevel, matched to the objection most likely behind the drop.', ['/cart-email', '/cart-sms']],
    ['briefing', 'Today Briefing', 'Revenue and sales', 'Watches only', 'Daily 07:00', 0.09, 16, 'Writes the morning briefing across all four streams, with every claim linked.', []],
    ['dossier', 'Pre-Call Dossier', 'Revenue and sales', 'Watches only', '2 h before each call', 0.16, 20, 'Builds a one-page brief with history across every stream.', []],
    ['coach', 'Call Coach', 'Revenue and sales', 'Watches only', 'After each call', 0.44, 25, 'Grades calls on talk ratio, questions, silence after price and next steps.', []],
    ['followup', 'Follow-Up Drafter', 'Revenue and sales', 'Acts', 'Daily 06:45', 0.08, 17, 'Drafts personal follow-ups for stalled deals and quiet buyers.', []],
    ['health', 'Client Health', 'Revenue and sales', 'Watches only', 'Daily 06:30', 0.06, 10, 'Scores SaaS and service clients and flags churn risk and upsell readiness.', []],
    ['dnakeeper', 'DNA Keeper', 'Data and learning', 'Acts', 'On every change', 0.01, 10, 'Rebuilds your Brand DNA whenever a fact, offer, funnel or proven post changes, and syncs offers and funnels from HighLevel every night.', []],
    ['monitor', 'Data Monitor', 'Data and learning', 'Watches only', 'Hourly', 0.02, 4, 'Checks every feed ran and wrote real rows.', []],
    ['fixer', 'Data Fixer', 'Data and learning', 'Acts', 'On monitor alert', 0.05, 12, 'Repairs known failures from a pre-approved fix list.', []],
    ['enricher', 'Enricher', 'Data and learning', 'Acts', 'Daily 05:00', 0.12, 9, 'Fills missing company, country and title and proposes HighLevel field updates.', []],
    ['outcome', 'Outcome Tracker', 'Data and learning', 'Watches only', 'Daily 04:00', 0.05, 6, 'Records results at 1, 7 and 30 days and updates scores and rubrics.', []],
    ['ask', 'Ask the OS', 'Data and learning', 'Watches only', 'On question', 0.15, 10, 'Answers questions across your data and Brain, with citations. Read-only.', []],
  ];
  const agents = AGENTS.map(([id, name, dept, mode, schedule, cost, minutes, does, jobs]) => ({ id, name, dept, mode, schedule, costPerRun: cost, minutesPerRun: minutes, does, jobs, paused: false, status: id === 'health' || id === 'monitor' ? 'warn' : 'ok' }));
  const runs = [];
  let rn = 0;
  agents.forEach((a) => {
    const perDay = { monitor: 24, coach: 0.45, dossier: 1.2, draft: 1.3, repurpose: 0.9, offerlab: 1 / 7, funnel: 0.1, ask: 2.1, comments: 4, shorts: 0.9, upload: 0.4, titles: 1.3, hooks: 0.4, social: 3 / 7, newsletter: 1 / 7, planner: 1 / 7, casestudy: 0.1, leadmagnet: 1 / 30, analyst: 1 / 7, offerspy: 1 / 7, objections: 0.45, ladder: 1 / 7, pricing: 1 / 7, bumps: 0.1, sequence: 0.1, adangles: 1 / 7, leak: 1, audit: 1 / 7, splittest: 1, recovery: 1.6 }[a.id] ?? 1;
    for (let d = 364; d >= 335; d--) {
      const n = perDay >= 1 ? Math.round(perDay) : rnd() < perDay ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const failed = (a.id === 'monitor' && d === 363 && k === 3) || rnd() < 0.015;
        const cost = round2(a.costPerRun * (0.75 + rnd() * 0.5));
        runs.push({ id: 'r' + (++rn), agent: a.id, day: d, date: iso(d), time: a.schedule.match(/\d\d:\d\d/) ? a.schedule.match(/\d\d:\d\d/)[0] : `${String(between(7, 21)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`, cost, minutes: failed ? 0 : Math.round(a.minutesPerRun * (0.85 + rnd() * 0.3)), score: a.mode === 'Acts' ? round2(7.2 + rnd() * 2.3) : null, status: failed ? 'failed' : 'ok', tokens: Math.round(cost / 0.000009) });
      }
    }
  });

  /* ---------- Brain ---------- */
  const brain = {
    facts: [
      ['identity', 'I am Avery Cole, a founder who builds funnels and AI tools. I have built more than 300 funnels.', 3, 'Founder story and beliefs'],
      ['identity', 'My business is Northpeak Studio. Everything I sell is hosted on HighLevel.', 2, 'Offer ladder and playbook'],
      ['offers', 'AI Skill Pack costs $27, one payment.', 2, 'Offer ladder and playbook'],
      ['offers', 'Funnel Kit bundle costs $47, one payment.', 2, 'Offer ladder and playbook'],
      ['offers', 'Studio Membership is $47 a month.', 2, 'Offer ladder and playbook'],
      ['offers', 'App Builder Kit costs $497, one payment, with a 30-day refund if you build nothing.', 3, 'Offer ladder and playbook'],
      ['offers', 'Group Coaching cohort is $1,997.', 2, 'Offer ladder and playbook'],
      ['offers', 'Website builds start at $2,500 and AI agent builds at $6,000. Every build includes the SaaS plan for hosting.', 2, 'Offer ladder and playbook'],
      ['revenue', 'I make money four ways at once: clinic software, builds, products and HighLevel affiliate commissions.', 3, 'Founder story and beliefs'],
      ['revenue', 'Clinic software is white-label HighLevel at $97, $197 or $297 a month.', 2, 'Offer ladder and playbook'],
      ['revenue', 'I earn 40% recurring commission on HighLevel plans sold through my link.', 2, 'Offer ladder and playbook'],
      ['audience', 'My software clients are owner-operators of dental, physio and aesthetics clinics with 2 to 12 staff in the Nordics, UK and Germany.', 2, 'Ideal customer: local clinic owner'],
      ['audience', 'My students are founders who want several revenue streams from one personal brand.', 2, 'Content strategy'],
      ['voice', 'I write short sentences with real numbers from my own business.', 2, 'Voice and content guide'],
      ['voice', 'I say founder, never entrepreneur.', 2, 'Voice and content guide'],
      ['beliefs', 'A founder owns several revenue streams that feed each other. The brand is the engine.', 3, 'Founder story and beliefs'],
      ['beliefs', 'Give more free value than anyone else.', 2, 'YouTube plan for 2027'],
      ['proof', 'I have built more than 300 funnels and host 77 clinic clients on my software.', 2, 'Ideal customer: local clinic owner'],
      ['goals', 'I am working toward 100,000 YouTube subscribers and $100,000 a month from products and commissions.', 3, 'YouTube plan for 2027'],
      ['stack', 'HighLevel is my system of record for contacts, pipelines, payments, funnels and email.', 2, 'Offer ladder and playbook'],
      ['never', 'I never use the words game-changer, unlock, supercharge, crushing it or hustle.', 3, 'Voice and content guide'],
      ['never', 'I never use em dashes.', 3, 'Voice and content guide'],
    ].map(([category, statement, weight, doc], i) => ({ id: 'f' + (i + 1), category, statement, weight, status: 'approved', source: 'You', doc_title: doc, evidence: null, approved_at: '2026-10-' + String(10 + (i % 18)).padStart(2, '0') })).concat([
      { id: 'f90', category: 'offers', statement: 'Studio Membership includes one live build a month.', weight: 2, status: 'proposed', source: 'Studied by Claude', doc_title: 'Content strategy', evidence: 'Two videos a week. One live build a month.' },
      { id: 'f91', category: 'audience', statement: 'Clinic owners stop buying because of bad experiences with agencies and fear of monthly fees.', weight: 2, status: 'proposed', source: 'Studied by Claude', doc_title: 'Ideal customer: local clinic owner', evidence: 'Bad experiences with agencies. Fear of monthly fees. No time to learn software.' },
      { id: 'f92', category: 'voice', statement: 'I open with the result and show the screen within 20 seconds.', weight: 2, status: 'proposed', source: 'Studied by Claude', doc_title: 'Voice and content guide', evidence: 'Open with the result, show the screen within 20 seconds, one story, one lesson, one call to action.' },
      { id: 'f93', category: 'offers', statement: 'I price websites at 800 euros.', weight: 2, status: 'proposed', source: 'Patterns in your docs', doc_title: 'Voice samples', evidence: 'I charged 800 euros for a site that took me three weeks. That was the last time.' },
    ]),
    docs: [
      { id: 'b7', name: 'YouTube plan for 2027', kind: 'Strategy', words: 236, updated: 'Today', source: 'Your Google Doc "Youtube Videos to Crush 2027"', body: [
        ['Goal', 'The path to 100K subscribers and $100k a month with products and commissions.'],
        ['Rule', 'Give more free value than anyone else. Period.'],
        ['Categories', 'Funnels and digital products. AI, agents and vibe coding. Personal branding. HighLevel and selling white-label SaaS.'],
        ['Formats', 'Tutorials, reviews and news. Business education. Make money online inspiration.'],
        ['Ideas', '18 video ideas, now on the Content board tagged YOUR PLAN.'],
      ] },
      { id: 'b1', name: 'Voice and content guide', kind: 'Guide', words: 4820, updated: '2 Nov', source: 'Derived from 60 videos, 2025-11 to 2026-11, and 60 sent emails', body: [
        ['How I sound', 'Direct, warm and specific. I talk like I am sitting next to the viewer at their desk. Short sentences. Real numbers from my own business.'],
        ['Words I use', '"Here is exactly what I do", "hop on", "the boring part that makes money", "founder" instead of "entrepreneur".'],
        ['Words I never use', 'Game-changer, unlock, supercharge, crushing it, hustle. No em dashes.'],
        ['Structure', 'Open with the result, show the screen within 20 seconds, one story, one lesson, one call to action.'],
      ] },
      { id: 'b2', name: 'Offer ladder and playbook', kind: 'Strategy', words: 1940, updated: '28 Oct', source: 'HighLevel products, Stripe history, 48 sales calls', body: [
        ['Ladder', 'Skill Pack 27, Funnel Kit 47, Membership 47 per month, App Builder Kit 497, Coaching 1,997, builds 1,500 to 6,000, SaaS 97 to 297 per month.'],
        ['Rule', 'Every offer must point to the next rung. Builds always include the SaaS plan for hosting.'],
      ] },
      { id: 'b3', name: 'Ideal customer: local clinic owner', kind: 'Audience', words: 2310, updated: '30 Oct', source: '48 sales calls, 77 SaaS clients', body: [
        ['Who', 'Owner-operator of a dental, physio or aesthetics clinic, 2 to 12 staff, Nordics, UK and Germany.'],
        ['What they want', 'More booked appointments without hiring. A website they do not have to think about.'],
        ['What stops them', 'Bad experiences with agencies. Fear of monthly fees. No time to learn software.'],
      ] },
      { id: 'b4', name: 'Objection library', kind: 'Sales', words: 3150, updated: 'Yesterday', source: 'Call Coach, 14 graded calls', body: [
        ['"It is too expensive"', 'Compare against one lost patient per month. At 97 a month, one extra booking pays for it.'],
        ['"I tried software before"', 'I set it up with you on the call. You leave with it working.'],
      ] },
      { id: 'b5', name: 'Founder story and beliefs', kind: 'Identity', words: 2680, updated: '14 Oct', source: '3 interviews', body: [
        ['Story', 'Built 300+ funnels, then moved from one-off projects to recurring software and products.'],
        ['Belief', 'A founder owns several revenue streams that feed each other. The brand is the engine.'],
      ] },
      { id: 'b6', name: 'Content strategy', kind: 'Strategy', words: 1720, updated: '1 Nov', source: 'YouTube Analytics, 60 videos', body: [
        ['Mix', '50% top of funnel builds and reviews, 30% founder lessons, 20% offer-led content.'],
        ['Cadence', 'Two videos a week. One live build a month.'],
      ] },
    ],
    skills: [
      { name: 'Write a YouTube hook', uses: 41, updated: '1 Nov' }, { name: 'Clinic follow-up email', uses: 52, updated: '30 Oct' }, { name: 'Price a service build', uses: 9, updated: '12 Oct' },
      { name: 'Turn a call into a script', uses: 17, updated: '28 Oct' }, { name: 'Write a community post', uses: 26, updated: '2 Nov' }, { name: '17P sales page outline', uses: 6, updated: '20 Oct' },
      { name: 'AI Studio build prompt', uses: 4, updated: '31 Oct' }, { name: 'Pre-call dossier', uses: 38, updated: '3 Nov' },
    ],
    rubrics: [
      { id: 'rb-script', applies: 'Script', min: 8, criteria: [['Hook lands in 5 seconds', 0.3], ['Matches a proven structure', 0.25], ['Serves 2 or more streams', 0.15], ['Sounds like you', 0.3]] },
      { id: 'rb-email', applies: 'Email', min: 8, criteria: [['Sounds like you', 0.35], ['One clear ask', 0.3], ['Specific to the contact', 0.2], ['Under 120 words', 0.15]] },
      { id: 'rb-title', applies: 'Title', min: 7.5, criteria: [['Curiosity without clickbait', 0.4], ['Under 60 characters', 0.2], ['Contains the result', 0.4]] },
      { id: 'rb-offer', applies: 'Offer', min: 7.5, criteria: [['Promise is measurable', 0.3], ['Price backed by data', 0.25], ['Fits the ladder', 0.25], ['Objections handled', 0.2]] },
      { id: 'rb-short', applies: 'Short', min: 7.5, criteria: [['Hook in the first second', 0.4], ['One idea, no setup', 0.3], ['Sounds like you', 0.3]] },
      { id: 'rb-upload', applies: 'Upload package', min: 8, criteria: [['Tracked link to the right offer', 0.35], ['Chapters match the video', 0.25], ['Result in the first line', 0.4]] },
      { id: 'rb-ad', applies: 'Ad', min: 7.5, criteria: [['Hook in the first line', 0.4], ['Matches the page promise', 0.3], ['Claims you can prove', 0.3]] },
      { id: 'rb-page', applies: 'Page fix', min: 7.5, criteria: [['Fixes the biggest leak', 0.4], ['One clear next step', 0.3], ['Sounds like you', 0.3]] },
      { id: 'rb-post', applies: 'Community post', min: 7.5, criteria: [['Sounds like you', 0.4], ['Invites replies', 0.35], ['Accurate', 0.25]] },
      { id: 'rb-call', applies: 'Sales call', min: 7, criteria: [['Talk ratio under 45%', 0.3], ['8 or more questions', 0.2], ['3 seconds of silence after price', 0.25], ['Next step booked', 0.25]] },
    ],
    voice: [
      { from: 'Video · How I host 40 websites on one account', text: 'Here is the boring part that makes money. Every site I build lives on one account, and every one of them pays me every month.' },
      { from: 'Email · follow-up, 12 Oct', text: 'Quick one before Friday. If you would rather do it together, reply with a time and I will hop on.' },
      { from: 'Video · My biggest pricing mistake', text: 'I charged 800 euros for a site that took me three weeks. That was the last time.' },
      { from: 'Community post, 2 Nov', text: 'Drop your win below, even the small ones. I read every single one on Friday.' },
    ],
    decisions: [
      { date: '28 Oct', text: 'Builds always include hosting on the SaaS plan. No exceptions under 2,000 euros.' },
      { date: '14 Oct', text: 'Community moves from Skool to HighLevel Communities by December.' },
      { date: '2 Oct', text: 'No paid ads until organic content covers 80% of new revenue.' },
      { date: '19 Sep', text: 'App Builder Kit launched at 497. Revisit after 30 sales.' },
    ],
    gaps: [
      { id: 'g1', text: 'No case study for the 14-day Launch Workshop promise.', q: 'Tell me about one person who got a result in 14 days or less. What did they build and what changed?' },
      { id: 'g2', text: 'Your view on AI agencies changed in September. Two docs still hold the old one.', q: 'What do you believe about AI agencies now, and what changed your mind?' },
      { id: 'g3', text: 'Pricing for services above 6,000 euros is not written down.', q: 'How do you price a build above 6,000 euros? What makes it worth that?' },
    ],
  };

  /* ---------- approvals ---------- */
  const approvals = [
    { id: 'a1', kind: 'Email', title: 'Trial follow-up to 4 SaaS trials ending Friday', agent: 'followup', stream: 'software', contactId: contacts[15].id, age: '2 h', rubric: 'rb-email',
      scores: [9.1, 9.0, 8.6, 8.2], action: 'Send email from HighLevel to 4 contacts',
      body: `Hi ${contacts[15].first},\n\nQuick one before your trial ends on Friday. You set up the booking page but never connected your calendar, so no appointments can land yet.\n\nIt takes about two minutes. I recorded a 90-second walkthrough for exactly this step: [video link]\n\nIf you would rather do it together, reply with a time today and I will hop on.\n\nAvery`,
      evidence: 'Calendar not connected (HighLevel, 3 Nov). Booking page published 29 Oct. You used "hop on" in 41 of 60 sent follow-ups.', antithesis: false },
    { id: 'a2', kind: 'YouTube script', title: 'Script: I rebuilt a dentist website in 20 minutes', agent: 'draft', stream: 'services', ideaId: 'i11', age: '5 h', rubric: 'rb-script',
      scores: [8.9, 8.6, 8.0, 8.1], action: 'Save script to the Content board as Ready to film',
      body: 'Hook: This dentist paid 6,000 euros for a website nobody books from. I rebuilt it in 20 minutes, live.\n\nStory: Walk through the old site on screen. Point out the three places a patient gives up.\n\nProof: Show the new page in HighLevel, the booking widget and the speed score.\n\nCall to action: If you want this for your clinic, the link to book a free redesign is below.',
      evidence: 'Structure taken from an outlier at 7.2x its channel median. Antithesis budget used once: the script argues against expensive agencies, which you said on 3 calls.', antithesis: true },
    { id: 'a3', kind: 'Offer', title: 'Launch Workshop: price and promise', agent: 'offerlab', stream: 'products', offerId: 'o-workshop', age: '1 d', rubric: 'rb-offer',
      scores: [8.4, 7.6, 8.1, 6.9], action: 'Create product "Launch Workshop" in HighLevel as a draft',
      body: 'Promise: Launch your first white-label software offer in 14 days, with a working funnel on HighLevel.\n\nPrice: 1,997 euros, or 3 payments of 697.\n\nIncluded: 6 live sessions, the App Builder Kit, a done-with-you funnel review and 30 days of chat support.',
      evidence: '11 prospects asked about a cohort on October calls. 1,997 sits between the 497 kit and the 6,000 build. Weak spot: no testimonial yet for the 14-day claim.', antithesis: false },
    { id: 'a4', kind: 'Community post', title: 'Weekly win thread for the Founder community', agent: 'repurpose', stream: 'products', age: '1 d', rubric: 'rb-post',
      scores: [8.5, 8.4, 7.7], action: 'Post to HighLevel Communities · Studio Membership',
      body: 'Win of the week: Anna signed her second dental client on the hosting plan. Total time from first DM to signed: 9 days.\n\nDrop your win below, even the small ones. I read every single one on Friday.',
      evidence: 'Win taken from Anna R. in HighLevel Communities, 2 Nov. Approve only after she confirms her name can be used.', antithesis: false },
    { id: 'a5', kind: 'Email', title: `Upsell: ${contacts[4].name} is ready for the Growth plan`, agent: 'health', stream: 'software', contactId: contacts[4].id, age: '3 h', rubric: 'rb-email',
      scores: [8.3, 8.8, 9.0, 7.4], action: 'Send email and add tag "upsell-growth" in HighLevel',
      body: `Hi ${contacts[4].first},\n\nYour clinic sent 212 review requests last month. That is the most of any Starter account I host.\n\nThe Growth plan adds the AI receptionist, so after-hours calls turn into bookings instead of voicemails. It is 100 euros more a month, and I will switch it on for you this week if you want it.\n\nWant me to?\n\nAvery`,
      evidence: '212 review requests in October (HighLevel, sub-account usage). 31 missed calls after 18:00. Length 81 words, under the 120 limit, but scored lower on tone: "the most of any" reads as a sales line.', antithesis: false },
    { id: 'a6', kind: 'Field update', title: 'Enricher: add company and country to 12 contacts', agent: 'enricher', stream: 'services', age: '6 h', rubric: null, scores: [], action: 'Update custom fields on 12 HighLevel contacts',
      body: contacts.filter((c) => c.missing.length).slice(0, 12).map((c) => `${c.name}: ${c.missing.map((m) => m === 'company' ? `company → ${c.last} Clinic` : m === 'country' ? 'country → Germany' : 'title → Owner').join(', ')}`).join('\n'),
      evidence: 'Matched from public business registries and LinkedIn profile names. 2 matches below 80% confidence are left out.', antithesis: false },
    { id: 'a7', kind: 'Email', title: `Win-back for ${contacts[33].name} (cancelled membership)`, agent: 'followup', stream: 'products', contactId: contacts[33].id, age: '1 d', rubric: 'rb-email',
      scores: [7.2, 8.0, 6.8, 9.1], action: 'Send email from HighLevel',
      body: `Hi ${contacts[33].first},\n\nNoticed you left the membership last month. No hard feelings at all.\n\nIf it was the price, I would love to know. If it was the content, I would love to know that even more.\n\nOne line reply is plenty.\n\nAvery`,
      evidence: 'Cancelled 6 Oct after 4 months. Failed criteria: "Specific to the contact" (6.8) because it does not mention what they used.', antithesis: true },
    { id: 'a8', kind: 'Titles', title: 'Titles and thumbnails: My HighLevel affiliate numbers', agent: 'draft', stream: 'affiliate', ideaId: 'i19', age: '2 d', rubric: 'rb-title',
      scores: [8.1, 9.0, 8.4], action: 'Save title A as primary in the Content board',
      body: 'A: My HighLevel affiliate income, 12 months of real numbers\nB: What 112 referrals actually pay me\nC: I promoted one software for a year. Here is the money.\n\nThumbnail: the monthly payout chart, last bar circled, face on the right.',
      evidence: 'Title A mirrors your top title pattern ("real numbers", 4 of top 10). B scored highest on curiosity in the title rubric.', antithesis: false },
  ];

  /* ---------- offer lab drafts and funnels ---------- */
  const offerDrafts = [
    { id: 'o-workshop', name: 'Launch Workshop', stream: 'products', price: 1997, unit: 'cohort', status: 'draft', promise: 'Launch your first white-label software offer in 14 days, with a working funnel on HighLevel.',
      priceLogic: 'Sits between the 497 kit and the 6,000 build. 11 prospects asked for a cohort on October calls. The last cohort sold 9 seats at 1,997.',
      stack: ['6 live build sessions', 'App Builder Kit (497 value)', 'Done-with-you funnel review', '30 days of chat support', 'Clinic outreach scripts'],
      guarantee: 'Ship your offer in 14 days or keep coming to the next cohort free.', segment: 'App Builder Kit buyers who have not started SaaS (38 contacts)', demand: ['11 call mentions', '23 comments', '2 competitor cohorts sold out'], score: 7.9 },
    { id: 'o-hostingplus', name: 'Hosting Plus for clinics', stream: 'software', price: 397, unit: 'month', status: 'draft', promise: 'Your website, booking, reviews and AI receptionist, managed for you.',
      priceLogic: '14 Pro clients asked for done-for-you changes. At 397, 10 upgrades add 1,000 euros MRR above Pro.',
      stack: ['Everything in Pro', '2 hours of changes per month', 'Monthly report call', 'AI receptionist tuned to the clinic'], guarantee: 'Cancel any month.', segment: 'Pro and Growth clients with health above 70 (19 contacts)', demand: ['14 change requests', '6 call mentions'], score: 8.2 },
  ];
  const funnels = [
    { id: 'f1', name: 'Free clinic website redesign', goal: 'Book a redesign call', stream: 'services', visits: 1840, conv: 0.046, status: 'live', pages: 3 },
    { id: 'f2', name: 'App Builder Kit sales page', goal: 'Buy the kit', stream: 'products', visits: 2210, conv: 0.019, status: 'live', pages: 4 },
    { id: 'f3', name: 'HighLevel review and bonus', goal: 'Start a trial', stream: 'affiliate', visits: 3920, conv: 0.051, status: 'live', pages: 2 },
    { id: 'f4', name: 'Studio Membership', goal: 'Join the membership', stream: 'products', visits: 980, conv: 0.033, status: 'live', pages: 3 },
    { id: 'f5', name: 'Launch Workshop waitlist', goal: 'Join the waitlist', stream: 'products', visits: 0, conv: 0, status: 'package', pages: 2, offerId: 'o-workshop' },
  ];

  /* ---------- data feeds ---------- */
  const sources = [
    { id: 's1', name: 'HighLevel contacts and tags', system: 'HighLevel', status: 'green', rows24: 148, detail: '4,812 contacts · synced 07:02' },
    { id: 's2', name: 'HighLevel opportunities and pipelines', system: 'HighLevel', status: 'green', rows24: 37, detail: '3 pipelines · synced 07:02' },
    { id: 's3', name: 'HighLevel appointments', system: 'HighLevel', status: 'green', rows24: 15, detail: '15 upcoming · synced 07:02' },
    { id: 's5', name: 'HighLevel payments and subscriptions', system: 'HighLevel', status: 'green', rows24: 22, detail: 'Orders and subscriptions' },
    { id: 's6', name: 'Stripe (read-only)', system: 'Stripe', status: 'green', rows24: 19, detail: 'Until LC Payments migration' },
    { id: 's7', name: 'HighLevel affiliate payouts', system: 'HighLevel', status: 'orange', rows24: 0, detail: 'Backfilled monthly from export. No live API.' },
    { id: 's8', name: 'Affiliate SubIDs per video', system: 'HighLevel', status: 'orange', rows24: 41, detail: '31% of clicks missing a video SubID' },
    { id: 's9', name: 'YouTube Analytics', system: 'YouTube', status: 'green', rows24: 60, detail: '60 videos · synced 06:00' },
    { id: 's10', name: 'YouTube comments', system: 'YouTube', status: 'green', rows24: 96, detail: 'Read with intent tags' },
    { id: 's11', name: 'Call transcripts', system: 'HighLevel Meetings', status: 'green', rows24: 3, detail: 'Newest yesterday 17:20' },
    { id: 's12', name: 'Competitor channels (Apify)', system: 'Apify', status: 'green', rows24: 240, detail: '24 channels · nightly' },
    { id: 's13', name: 'HighLevel Communities', system: 'HighLevel', status: 'red', rows24: 0, detail: 'Token expired 2 Nov · reconnect' },
    { id: 's14', name: 'Course progress', system: 'HighLevel', status: 'orange', rows24: 0, detail: 'Backfilled to 1 Oct. Webhook not live yet.' },
  ];

  const metrics = [
    { id: 'm1', name: 'Silence after price', target: '3 s or more', values: pastCalls.slice(0, 8).map((c) => c.silence).reverse(), unit: 's', created: '12 Oct' },
    { id: 'm2', name: 'Talk ratio', target: 'Under 45%', values: pastCalls.slice(0, 8).map((c) => c.talk).reverse(), unit: '%', created: '3 Oct' },
  ];

  const audit = [
    { at: '3 Nov 17:42', who: 'Avery', what: 'Approved email', detail: 'Follow-up to Lindqvist Dental · sent from HighLevel', kind: 'approve' },
    { at: '3 Nov 11:05', who: 'Avery', what: 'Rejected draft', detail: 'Title set for "Tools I cancelled" · "Too clickbait"', kind: 'reject' },
    { at: '2 Nov 09:12', who: 'Data Fixer', what: 'Repaired feed', detail: 'YouTube comments re-synced after quota error', kind: 'system' },
    { at: '1 Nov 14:30', who: 'Avery', what: 'Approved field update', detail: '9 contacts enriched in HighLevel', kind: 'approve' },
  ];

  // Demo writing samples: pieces the founder wrote, pasted into Brand DNA > How you write.
  const writing = [
    { id: 'wr1', kind: 'email', title: 'Monday email: the funnel that paid my rent', pinned: true, created_at: '2026-11-03T08:10:00Z', body: "Quick story.\n\nMy first funnel made $0. My second one made $400. The third one paid my rent, and I still remember refreshing Stripe at 2 am like a crazy person.\n\nSo what changed between funnel one and funnel three?\n\nI stopped guessing. I looked at what was already working for other people, and I made my own version of it. Same structure. My story, my offer, my proof.\n\nThat's the whole game. Copy what works, make it yours, ship it.\n\nMost founders I talk to are stuck on step zero. They want a perfect idea before they build anything. You don't need a perfect idea. You need one idea that already worked for someone else, and the guts to put your name on it this week.\n\nHere's your homework: find one video in your niche that did 3x the creator's normal views. Write down why it worked. Then make yours.\n\nTalk soon,\nAvery" },
    { id: 'wr2', kind: 'post', title: 'LinkedIn post: one-person business', pinned: false, created_at: '2026-11-01T15:40:00Z', body: "I run my business with almost no team meetings.\n\nNot because I'm against people. Because I built systems first.\n\nHere's what runs without me:\n- Funnels in HighLevel that sell while I'm at the gym\n- AI agents that turn one video into 30 posts\n- An inbox that drafts replies in my voice, and I just approve them\n\nI didn't invent any of this. I copied what works and made it mine.\n\nIf you're a founder and your calendar is full of stuff a system could do, that's your next project. Start with one thing. Automate it. Then the next one." },
    { id: 'wr3', kind: 'script', title: 'YouTube intro: AI funnels in 20 minutes', pinned: false, created_at: '2026-10-28T11:05:00Z', body: "In the next 20 minutes I'm going to build a full funnel with AI. Opt-in page, sales page, emails, the whole thing.\n\nAnd I'm not going to skip anything. You'll see every prompt I use.\n\nWhy? Because most funnel tutorials show you the finished thing and none of the work. That's useless. You can't copy a result. You can copy a process. Copy what works and make it yours.\n\nSo here's the process. Step one, we find an offer that's already selling. Step two, we write the page with Claude using my exact framework. Step three, we put it live in HighLevel.\n\nLet's go." },
  ];

  window.SEED = { writing, STREAMS, OFFERS, offerById, videos, contacts, events, upcoming, pastCalls, commentsFor, ideas, YT_PLAN, agents, runs, brain, approvals, offerDrafts, funnels, sources, metrics, audit, TODAY, iso, dateOf };
})();

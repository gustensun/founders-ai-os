// Founders AI OS: flexible goals. A goal belongs to a channel, an offer, a funnel, a revenue stream,
// the personal brand or the business as a whole, and measures one metric from a start value to a target
// by a date. Channel goals fill in by themselves from connected YouTube, Instagram, TikTok, LinkedIn and X.
// Private workspaces save goals to Memory (kind 'goal'); the demo keeps its own sample set.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, eur, icon } = U;
  const OG = window.OSGoals;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const DAY = 86400000;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- catalog ---------- */
  const AREAS = [['channel', 'Channel'], ['offer', 'Offer'], ['funnel', 'Funnel'], ['stream', 'Revenue stream'], ['brand', 'Personal brand'], ['business', 'Business'], ['os', 'OS features']];
  const AREA_NAME = Object.fromEntries(AREAS);
  const CHANNELS = [['youtube', 'YouTube'], ['youtube-2', 'YouTube, second channel'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['facebook', 'Facebook'], ['threads', 'Threads'], ['email', 'Email list'], ['podcast', 'Podcast'], ['community', 'Community']];
  const CH_NAME = Object.fromEntries(CHANNELS);
  const STREAMS = [['software', 'Software'], ['services', 'Services'], ['products', 'Digital products'], ['affiliate', 'Affiliate commissions']];
  const ST_NAME = Object.fromEntries(STREAMS);
  // [id, label, unit, kind ('total' or 'rate'), direction]
  const YT = [['subs', 'Subscribers', 'subscribers', 'total', 'up'], ['views-m', 'Views a month', 'views', 'rate', 'up'], ['watch-m', 'Watch hours a month', 'hours', 'rate', 'up'], ['long-w', 'Videos a week', 'videos', 'rate', 'up'], ['views', 'Total channel views', 'views', 'total', 'up'], ['clicks-m', 'Clicks to a funnel a month', 'clicks', 'rate', 'up']];
  const SOCIAL = [['followers', 'Followers', 'followers', 'total', 'up'], ['posts-w', 'Posts a week', 'posts', 'rate', 'up'], ['reach-m', 'Reach a month', 'views', 'rate', 'up'], ['eng', 'Engagement rate', '%', 'total', 'up'], ['clicks-m', 'Clicks to a funnel a month', 'clicks', 'rate', 'up']];
  const EMAIL = [['subs', 'Subscribers', 'subscribers', 'total', 'up'], ['new-m', 'New subscribers a month', 'subscribers', 'rate', 'up'], ['open', 'Open rate', '%', 'total', 'up'], ['click', 'Click rate', '%', 'total', 'up'], ['sends-w', 'Emails a week', 'emails', 'rate', 'up']];
  const POD = [['dl-m', 'Downloads a month', 'downloads', 'rate', 'up'], ['eps-w', 'Episodes a week', 'episodes', 'rate', 'up'], ['followers', 'Followers', 'followers', 'total', 'up']];
  const COMM = [['members', 'Members', 'members', 'total', 'up'], ['active', 'Weekly active members', 'members', 'total', 'up'], ['posts-w', 'Posts a week', 'posts', 'rate', 'up']];
  const METRICS = {
    offer: [['sales-m', 'Sales a month', 'sales', 'rate', 'up'], ['rev-m', 'Revenue a month', '€', 'rate', 'up'], ['customers', 'Customers', 'customers', 'total', 'up'], ['mrr', 'Monthly recurring revenue', '€', 'total', 'up'], ['conv', 'Checkout conversion', '%', 'total', 'up'], ['refund', 'Refund rate', '%', 'total', 'down']],
    funnel: [['leads-m', 'Leads a month', 'leads', 'rate', 'up'], ['visits-m', 'Visitors a month', 'visitors', 'rate', 'up'], ['optin', 'Opt-in rate', '%', 'total', 'up'], ['conv', 'Sales conversion', '%', 'total', 'up'], ['sales-m', 'Sales a month', 'sales', 'rate', 'up'], ['cpl', 'Cost per lead', '€', 'total', 'down']],
    stream: [['rev-m', 'Revenue a month', '€', 'rate', 'up'], ['new-m', 'New customers a month', 'customers', 'rate', 'up'], ['active', 'Active customers', 'customers', 'total', 'up']],
    brand: [['audience', 'Total audience', 'people', 'total', 'up'], ['email', 'Email list', 'subscribers', 'total', 'up'], ['stages', 'Podcast and stage appearances', 'appearances', 'total', 'up'], ['collabs', 'Collaborations', 'collabs', 'total', 'up']],
    os: [['drafts-w', 'Drafts approved a week', 'drafts', 'rate', 'up'], ['promises-m', 'Promises kept a month', 'promises', 'rate', 'up'], ['calls-m', 'Calls recorded a month', 'calls', 'rate', 'up'], ['research-m', 'Research runs a month', 'runs', 'rate', 'up'], ['chat-w', 'Questions asked a week', 'questions', 'rate', 'up'], ['facts', 'Approved Brain facts', 'facts', 'total', 'up'], ['docs', 'Brain documents', 'documents', 'total', 'up'], ['creators', 'Creators tracked', 'creators', 'total', 'up']],
    business: [['rev-m', 'Revenue a month', '€', 'rate', 'up'], ['profit-m', 'Profit a month', '€', 'rate', 'up'], ['calls-m', 'Sales calls booked a month', 'calls', 'rate', 'up'], ['clients', 'Active clients', 'clients', 'total', 'up'], ['hours-w', 'Hours worked a week', 'hours', 'rate', 'down']],
  };
  const metricsFor = (area, ref) => area === 'channel' ? (ref === 'youtube' || ref === 'youtube-2' ? YT : ref === 'email' ? EMAIL : ref === 'podcast' ? POD : ref === 'community' ? COMM : SOCIAL) : (METRICS[area] || []);
  // Which measures track themselves, and from where. [source label, connection id or '' for the OS itself]
  const HLM = { offer: ['sales-m', 'rev-m', 'customers', 'mrr', 'refund'], funnel: ['sales-m', 'leads-m'], business: ['rev-m', 'clients', 'calls-m'], brand: ['email'] };
  function tracker(d) {
    if (d.area === 'os') return METRICS.os.some((x) => x[0] === d.metric) ? ['Founders AI OS', ''] : null;
    if (d.area === 'channel') {
      if (d.ref === 'youtube' || d.ref === 'youtube-2') return ['subs', 'views', 'long-w', 'views-m', 'watch-m'].includes(d.metric) ? ['YouTube', d.ref] : null;
      if (['instagram', 'tiktok', 'linkedin', 'x'].includes(d.ref)) return d.metric === 'followers' ? [CH_NAME[d.ref], d.ref] : null;
      if (d.ref === 'email') return ['subs', 'new-m'].includes(d.metric) ? ['HighLevel contacts', 'highlevel'] : null;
      return null;
    }
    if (d.area === 'brand' && d.metric === 'audience') return ['your channels and HighLevel', 'youtube'];
    if ((d.area === 'offer' || d.area === 'funnel') && d.ref === '' && !d.refName) return null;
    return (HLM[d.area] || []).includes(d.metric) ? ['HighLevel', 'highlevel'] : null;
  }
  const DUES = [['month', 'End of this month'], ['quarter', 'End of this quarter'], ['year', 'End of this year'], ['d30', 'In 30 days'], ['d90', 'In 90 days'], ['d180', 'In 6 months'], ['date', 'Pick a date']];
  const FILTERS = [['all', 'All'], ['channel', 'Channels'], ['offer', 'Offers'], ['funnel', 'Funnels'], ['stream', 'Revenue'], ['brand', 'Brand'], ['business', 'Business'], ['os', 'OS']];

  /* ---------- the six goal categories ---------- */
  // Every goal lives in one of six areas a founder grows at the same time. Tracked measures map to a source;
  // anything else is typed in plain words, read by Jarvis and broken into steps to tick off.
  // known: [id, label, unit, area, ref, metric, kind, dir]
  const CATS = [
    { id: 'youtube', name: 'YouTube Growth', about: 'Subscribers, views and videos', ph: 'Reach 100,000 subscribers by next summer', area: 'channel', ref: 'youtube',
      starts: [['Subscribers', 'Reach 50,000 subscribers', '50,000'], ['Views', 'Get 200,000 views a month', '200,000'], ['Videos', 'Publish 2 videos a week', '2']],
      known: [['subs', 'Subscribers', 'subscribers', 'channel', 'youtube', 'subs', 'total', 'up'], ['views-m', 'Views a month', 'views', 'channel', 'youtube', 'views-m', 'rate', 'up'], ['long-w', 'Videos a week', 'videos', 'channel', 'youtube', 'long-w', 'rate', 'up']] },
    { id: 'offers', name: 'Offer Stack', about: 'Low ticket, mid ticket and high ticket', ph: 'A $27 starter kit, a $997 program and $5k coaching', area: 'offer', ref: '',
      starts: [['Low ticket', 'Launch a $27 low-ticket offer', '$27'], ['Mid ticket', 'Launch a $997 mid-ticket offer', '$997'], ['High ticket', 'Sign 5 high-ticket clients at $5,000', '5']],
      known: [['offer-sales', 'Sales a month for one offer', 'sales', 'offer', '', 'sales-m', 'rate', 'up'], ['offer-rev', 'Revenue a month for one offer', '€', 'offer', '', 'rev-m', 'rate', 'up']] },
    { id: 'funnels', name: 'Funnels Launched', about: 'Website, freebies and paid offers', ph: 'Launch the free website audit funnel this month', area: 'funnel', ref: '',
      starts: [['Website', 'Launch the new website', 'new website'], ['Freebies', 'Launch 2 freebie funnels', '2'], ['Paid offers', 'Launch 1 paid offer funnel', '1']],
      known: [['funnel-leads', 'Leads a month for one funnel', 'leads', 'funnel', '', 'leads-m', 'rate', 'up'], ['funnel-optin', 'Opt-in rate for one funnel', '%', 'funnel', '', 'optin', 'total', 'up'], ['email-subs', 'Email subscribers', 'subscribers', 'channel', 'email', 'subs', 'total', 'up']] },
    { id: 'money', name: 'Revenue & Profit', about: 'Sales, expenses and profit margin', ph: 'Get profit margin to 60 percent', area: 'business', ref: '',
      starts: [['Sales', 'Reach €20,000 in sales a month', '€20,000'], ['Expenses', 'Keep expenses under €3,000 a month', '€3,000'], ['Profit margin', 'Get profit margin to 60 percent', '60']],
      known: [['rev-m', 'Revenue a month', '€', 'business', '', 'rev-m', 'rate', 'up'], ['profit-m', 'Profit a month', '€', 'business', '', 'profit-m', 'rate', 'up']] },
    { id: 'freedom', name: 'Lifestyle Freedom', about: 'Working hours, calendar freedom and vacations', ph: 'Work 30 hours a week with Fridays off', area: 'business', ref: '',
      starts: [['Working hours', 'Work 30 hours a week', '30'], ['Calendar', 'Keep Fridays free of calls', 'Fridays'], ['Vacations', 'Take 6 weeks of vacation next year', '6']],
      known: [['hours-w', 'Hours worked a week', 'hours', 'business', '', 'hours-w', 'rate', 'down']] },
    { id: 'hlos', name: 'HighLevel OS', about: 'Systems, automations and domains', ph: 'Every new lead gets a follow-up automation', area: 'os', ref: '',
      starts: [['Systems', 'Set up the client onboarding system', 'client onboarding'], ['Automations', 'Build 5 core automations', '5'], ['Domains', 'Connect and warm up 2 sending domains', '2']],
      known: [] },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
  function catOf(m) {
    if (m.cat && CAT[m.cat]) return m.cat;
    if (m.area === 'channel') return m.ref === 'email' ? 'funnels' : 'youtube';
    if (m.area === 'brand') return 'youtube';
    if (m.area === 'offer') return 'offers';
    if (m.area === 'funnel') return 'funnels';
    if (m.area === 'os') return 'hlos';
    if (m.area === 'business' && m.metric === 'hours-w') return 'freedom';
    return 'money';
  }
  const STEPS = {
    youtube: ['Pick 5 video ideas from Proven that already worked for others', 'Publish 2 long videos a week for 4 weeks', 'Cut 3 Shorts from every long video', 'Remix the best performer into a follow-up video', 'Review which videos brought subscribers and double down'],
    offers: ['Write the promise and price of the low-ticket offer', 'Launch the low-ticket offer in HighLevel', 'Package the mid-ticket offer and its bonuses', 'Sell the first 5 mid-ticket spots', 'Write the high-ticket application page', 'Close the first high-ticket client'],
    funnels: ['Map the funnel: page, offer and follow-up', 'Build the pages in HighLevel', 'Connect the form or checkout and test it end to end', 'Write the follow-up emails', 'Send the first traffic to it', 'Review the numbers after 14 days'],
    money: ['List every income stream and its monthly number', 'List every monthly expense', 'Cancel or replace one tool you do not need', 'Set the monthly target for each stream', 'Hit the target for one month', 'Hold it three months in a row'],
    freedom: ['Write down the hours you work now, week by week', 'Block one day a week with no calls', 'Hand off or automate one recurring task', 'Book the vacation dates in the calendar', 'Take the first week fully off', 'Hold the new rhythm for a month'],
    hlos: ['Connect and verify the main domain in HighLevel', 'Set up and warm the sending domain', 'Build the lead nurture automation', 'Build booking reminders and no-show follow-up', 'Build the post-purchase onboarding workflow', 'Save the account as a snapshot'],
  };

  /* ---------- numbers ---------- */
  const today = () => OG.todayMs();
  const toIso = (m) => OG.iso(m);
  const parseNum = (s) => { if (s == null) return NaN; let t = String(s).trim().replace(/[\s\u00a0€$%]/g, ''); if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ''); else t = t.replace(',', '.'); const n = parseFloat(t.replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : NaN; };
  const nfmt = (v) => { const n = Number(v) || 0; return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 10) / 10); };
  const money = (g, v) => { const c = (g.currency || 'EUR').toUpperCase(); if (c === 'EUR') return eur(Math.round(Number(v) || 0)); try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0)); } catch { return eur(Math.round(Number(v) || 0)); } };
  const val = (g, v) => g.unit === '€' ? money(g, v) : g.unit === '%' ? nfmt(v) + '%' : nfmt(v) + (g.unit ? ' ' + g.unit : '');
  const dshort = (isoDate) => { if (!isoDate) return ''; const x = new Date(OG.ms(isoDate)); const y = x.getUTCFullYear(), ty = new Date(today()).getUTCFullYear(); return x.getUTCDate() + ' ' + MON[x.getUTCMonth()] + (y !== ty ? ' ' + y : ''); };
  function dueFrom(kind, picked) {
    const d = new Date(today()); const y = d.getUTCFullYear(), mo = d.getUTCMonth();
    if (kind === 'month') return toIso(Date.UTC(y, mo + 1, 0));
    if (kind === 'quarter') return toIso(Date.UTC(y, Math.floor(mo / 3) * 3 + 3, 0));
    if (kind === 'year') return toIso(Date.UTC(y, 11, 31));
    if (kind === 'd30') return toIso(today() + 30 * DAY);
    if (kind === 'd90') return toIso(today() + 90 * DAY);
    if (kind === 'd180') return toIso(today() + 182 * DAY);
    return /^\d{4}-\d{2}-\d{2}$/.test(picked || '') ? picked : null;
  }

  /* ---------- goal model ---------- */
  // Older goals only had {target, current, unit}. They read as business goals with a custom metric.
  function norm(row) {
    const m = { ...(row.meta || {}) };
    // An older goal with no area: a YouTube subscriber goal becomes a YouTube channel goal so it can track itself.
    if (!m.area && /youtube|\byt\b/i.test(row.text || '') && /sub/i.test((row.text || '') + ' ' + (m.unit || ''))) Object.assign(m, { area: 'channel', ref: 'youtube', metric: 'subs', unit: 'subscribers', kind: 'total', named: true });
    const area = AREA_NAME[m.area] ? m.area : 'business';
    const g = {
      id: row.id, text: row.text, due: row.due || null, status: row.status, created: row.created_at,
      area, ref: m.ref || '', refName: m.refName || (area === 'channel' ? CH_NAME[m.ref] : area === 'stream' ? ST_NAME[m.ref] : '') || '',
      metric: m.metric || 'custom', mlabel: m.mlabel || '', unit: m.unit === 'euros' || m.unit === 'eur' ? '€' : (m.unit || ''), kind: m.kind || 'total', dir: m.dir === 'down' ? 'down' : 'up',
      start: Number.isFinite(+m.start) ? +m.start : 0, current: Number.isFinite(+m.current) ? +m.current : 0, target: Number.isFinite(+m.target) ? +m.target : 0,
      startDate: m.startDate || (row.created_at ? String(row.created_at).slice(0, 10) : toIso(today())), auto: m.auto !== false, note: m.note || '', history: Array.isArray(m.history) ? m.history : [],
      who: m.agent || '', next: m.next || '', named: !!m.named, currency: m.currency || '',
      cat: catOf({ ...m, area }), meaning: m.meaning || '', taught: !!m.taught, steps: Array.isArray(m.steps) ? m.steps.filter((x) => x && x.t) : [],
      srv: { tracked: !!m.tracked, source: m.source || '', at: m.tracked_at || '', needs: m.needs || '', why: m.needs_why || '', err: m.track_error || '' },
    };
    if (!g.mlabel) { const mt = metricsFor(g.area, g.ref).find((x) => x[0] === g.metric); g.mlabel = mt ? mt[1] : ''; }
    if (g.metric === 'steps') { g.unit = 'steps'; g.mlabel = 'Steps'; g.start = 0; g.target = g.steps.length; g.current = g.steps.filter((x) => x.done).length; g.kind = 'total'; g.dir = 'up'; }
    const a = g.auto && g.metric !== 'steps' ? autoValue(g) : null;
    g.live = a; g.now = a ? a.v : g.current;
    return calc(g);
  }
  function calc(g) {
    const span = g.dir === 'down' ? g.start - g.target : g.target - g.start;
    const moved = g.dir === 'down' ? g.start - g.now : g.now - g.start;
    g.p = span > 0 ? moved / span : (g.dir === 'down' ? (g.now <= g.target ? 1 : 0) : (g.now >= g.target ? 1 : 0));
    g.done = g.dir === 'down' ? g.now <= g.target : g.now >= g.target;
    if (g.metric === 'steps') { g.p = g.target ? g.now / g.target : 0; g.done = g.target > 0 && g.now >= g.target; }
    const s = OG.ms(g.startDate), e = g.due ? OG.ms(g.due) : null;
    g.elapsed = e && e > s ? Math.max(0, Math.min(1, (today() - s) / (e - s))) : null;
    g.daysLeft = e ? Math.round((e - today()) / DAY) : null;
    g.st = g.done ? 'done' : g.elapsed == null ? 'open' : g.daysLeft < 0 ? 'off' : g.p >= g.elapsed - 0.05 ? 'on' : g.p >= g.elapsed - 0.2 ? 'risk' : 'off';
    const left = g.dir === 'down' ? g.now - g.target : g.target - g.now;
    g.left = Math.max(0, left);
    if (g.metric === 'steps' && !g.done && g.elapsed == null) g.st = 'open';
    g.perWeek = g.metric !== 'steps' && g.kind === 'total' && g.dir === 'up' && g.unit !== '%' && g.daysLeft > 0 && g.left > 0 ? g.left / Math.max(1, g.daysLeft / 7) : null;
    g.label = goalName(g);
    return g;
  }
  function forName(g) {
    if (g.area === 'channel') return g.refName || CH_NAME[g.ref] || 'a channel';
    if (g.area === 'stream') return g.refName || ST_NAME[g.ref] || 'a revenue stream';
    if (g.area === 'brand') return 'Personal brand';
    if (g.area === 'business') return 'Business';
    return g.refName || (g.area === 'offer' ? 'An offer' : 'A funnel');
  }
  const bare = (g, v) => g.unit === '€' || g.unit === '%' ? val(g, v) : nfmt(v);
  const shortName = (g) => `${g.mlabel || 'Goal'} ${g.dir === 'down' ? 'down to' : 'to'} ${bare(g, g.target)}`;
  const autoText = (g) => `${shortName(g)}, ${forName(g)}`;
  // The page groups goals by what they are for, so an unnamed goal shows only its measure and target.
  function goalName(g) { return g.named && g.text && g.text.trim() ? g.text.trim() : shortName(g); }

  /* ---------- live numbers from connected channels ---------- */
  const DEMO_CONN = {
    youtube: { label: 'Avery Cole', meta: { channel: { subs: 12480, views: 1184300, videos: 186 }, analytics: { views: 58240, minutes: 341000 }, videos: [4, 2, 1].map((d) => ({ at: new Date(OG.DEMO_TODAY - d * DAY).toISOString() })) } },
    instagram: { label: '@averycole', meta: { profile: { followers: 6920, posts: 410 } } },
    tiktok: { label: '@averycole', meta: { profile: { followers: 3410, videos: 140 } } },
    linkedin: { label: 'Avery Cole', meta: { profile: { followers: 2180 } } },
    highlevel: { label: 'Northpeak Studio', meta: {} },
  };
  const connFor = (id) => {
    if (!isLive()) return DEMO_CONN[id] ? { status: 'connected', account_label: DEMO_CONN[id].label, meta: DEMO_CONN[id].meta } : null;
    return (ctx().conns || []).find((c) => c.provider === id && c.status === 'connected' && c.meta) || null;
  };
  const PROVIDER = { youtube: 'YouTube', 'youtube-2': 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X' };
  const DEMO_OS = { 'drafts-w': 14, 'promises-m': 9, 'calls-m': 11, 'research-m': 6, 'chat-w': 23, facts: 148, docs: 37, creators: 64 };
  function autoValue(g) {
    if (g.srv && g.srv.tracked && g.srv.source && Number.isFinite(+g.current)) {
      const near = channelValue(g); if (near) return { ...near, at: g.srv.at };
      return { v: +g.current, from: g.srv.source, at: g.srv.at };
    }
    if (g.area === 'os' && !isLive() && DEMO_OS[g.metric] != null) return { v: DEMO_OS[g.metric], from: 'Founders AI OS' };
    if (!isLive() && g.id) { const t = tracker(g); if (t && t[1] === 'highlevel') return { v: g.current, from: t[0], at: new Date(Date.now() - 3 * 3600000).toISOString() }; }
    return channelValue(g);
  }
  function channelValue(g) {
    if (g.area !== 'channel' || !PROVIDER[g.ref]) return null;
    const c = connFor(g.ref); if (!c) return null; const m = c.meta || {};
    const out = (v, how) => (Number.isFinite(+v) && v !== null ? { v: +v, from: `${PROVIDER[g.ref]}${how ? ', ' + how : ''}` } : null);
    if (g.ref === 'youtube' || g.ref === 'youtube-2') {
      const ch = m.channel || {}, an = m.analytics || {};
      if (g.metric === 'subs') return out(ch.subs);
      if (g.metric === 'views') return out(ch.views);
      if (g.metric === 'views-m' && an.views != null) return out(an.views, 'last 28 days');
      if (g.metric === 'watch-m' && an.minutes != null) return out(Math.round(an.minutes / 60), 'last 28 days');
      if (g.metric === 'long-w' && Array.isArray(m.videos)) return out(m.videos.filter((v) => v.at && Date.parse(v.at) >= today() - 7 * DAY).length, 'last 7 days');
      return null;
    }
    const p = m.profile || {};
    if (g.metric === 'followers') return out(p.followers);
    return null;
  }
  const chLabel = (id) => { const c = connFor(id); return c && c.account_label ? `${CH_NAME[id]} · ${c.account_label}` : CH_NAME[id]; };

  /* ---------- the two goal stores ---------- */
  let DG = null;
  function demoRows() {
    if (DG) return DG;
    const G = OG.goals(); const by = (id) => G.g.find((x) => x.id === id);
    const qs = '2026-10-01', qe = '2026-12-31', ye = '2026-12-31';
    const h = (pts) => pts.map(([d, v]) => ({ d, v }));
    const r = (id, text, meta, due) => ({ id, kind: 'goal', text, due: due || qe, status: 'open', created_at: qs + 'T08:00:00Z', meta: { startDate: qs, ...meta } });
    const sw = by('g1'), pr = by('g2'), af = by('g3');
    DG = [
      r('dg1', '', { area: 'channel', ref: 'youtube', refName: 'YouTube · Avery Cole', metric: 'subs', mlabel: 'Subscribers', unit: 'subscribers', kind: 'total', start: 10900, target: 15000, current: 12480, history: h([['2026-10-01', 10900], ['2026-10-15', 11350], ['2026-11-01', 12050]]), steps: [{ t: 'Reach 12,000 subscribers', done: true }, { t: 'Reach 13,000 subscribers', done: false }, { t: 'Remix the two outliers from Proven into follow-ups', done: false }, { t: 'Reach 14,000 subscribers', done: false }, { t: 'Hit 15,000 subscribers', done: false }], agent: 'Video Analyst', next: 'The last two outlier videos brought 61 percent of new subscribers. Film the next two remix ideas from Proven.' }, ye),
      r('dg2', '', { area: 'channel', ref: 'youtube', refName: 'YouTube · Avery Cole', metric: 'long-w', mlabel: 'Videos a week', unit: 'videos', kind: 'rate', start: 1, target: 2, current: 3, agent: 'Content Planner', next: 'Three this week. Keep two in the plan for next week so the pace holds.' }),
      r('dg3', '', { area: 'channel', ref: 'instagram', refName: 'Instagram · @averycole', metric: 'followers', mlabel: 'Followers', unit: 'followers', kind: 'total', start: 5900, target: 10000, current: 6920, agent: 'Social Writer', next: 'Reels cut from YouTube outliers grow followers 3x faster than carousels. Two are ready in Content.' }),
      r('dg4', '', { area: 'channel', ref: 'email', refName: 'Email list', metric: 'subs', mlabel: 'Subscribers', unit: 'subscribers', kind: 'total', start: 11800, target: 15000, current: 12960, agent: 'Funnel Builder', next: 'The free website redesign funnel adds most subscribers. Link it in the next two video descriptions.' }),
      r('dg5', '', { area: 'offer', ref: 'dn-o-kit', refName: 'App Builder Kit', metric: 'sales-m', mlabel: 'Sales a month', unit: 'sales', kind: 'rate', start: 22, target: 60, current: 31, agent: 'Funnel Builder', next: pr ? pr.next : 'Fix the order bump on the kit checkout.' }),
      r('dg6', '', { area: 'offer', ref: 'dn-o-member', refName: 'Studio Membership', metric: 'mrr', mlabel: 'Monthly recurring revenue', unit: '€', kind: 'total', start: 4200, target: 9000, current: 5350, agent: 'Client Health', next: 'Three members have not logged in for 14 days. Check-in drafts are waiting in the Newsfeed.' }),
      r('dg7', '', { area: 'funnel', ref: 'dn-f3', refName: 'HighLevel review and bonus', metric: 'optin', mlabel: 'Opt-in rate', unit: '%', kind: 'total', start: 18, target: 30, current: 21.4, agent: 'Funnel Builder', next: 'Visitors from YouTube opt in at 27 percent, cold traffic at 12. Move the bonus stack above the fold.' }),
      r('dg8', '', { area: 'funnel', ref: 'dn-f1', refName: 'Free clinic website redesign', metric: 'cpl', mlabel: 'Cost per lead', unit: '€', kind: 'total', dir: 'down', start: 38, target: 22, current: 29, agent: 'Outcome Tracker', next: 'The before and after ad keeps the cheapest leads. Shift budget from the two weaker ads.' }),
      r('dg9', '', { area: 'stream', ref: 'software', refName: 'Software', metric: 'rev-m', mlabel: 'Revenue a month', unit: '€', kind: 'rate', start: sw ? sw.start : 12000, target: sw ? sw.target : 20000, current: sw ? sw.cur : 15000, auto: false, agent: 'Client Health', next: sw ? sw.next : '' }),
      r('dg10', '', { area: 'stream', ref: 'affiliate', refName: 'Affiliate commissions', metric: 'rev-m', mlabel: 'Revenue a month', unit: '€', kind: 'rate', start: af ? af.start : 3000, target: af ? af.target : 6000, current: af ? af.cur : 3600, auto: false, agent: 'Outcome Tracker', next: af ? af.next : '' }),
      r('dg11', '', { area: 'business', ref: '', refName: 'Business', metric: 'hours-w', mlabel: 'Hours worked a week', unit: 'hours', kind: 'rate', dir: 'down', start: 52, target: 35, current: 44, auto: false, agent: 'Jarvis', next: 'Reviewing drafts takes 6 hours a week. Let Draft Studio auto-approve replies under 40 words that match your voice.' }),
      r('dg13', 'Full offer stack: low, mid and high ticket', { cat: 'offers', area: 'offer', metric: 'steps', named: true, meaning: 'One offer at each price point so a buyer can start at $27 and climb to coaching. Hit when all three sell in the same month.', steps: [{ t: 'Launch the $27 App Builder Kit in HighLevel', done: true }, { t: 'Add the $47 order bump and the $97 upsell', done: true }, { t: 'Package Funnel Sprint at $997 with the build-along bonus', done: false }, { t: 'Sell the first 5 Funnel Sprint seats', done: false }, { t: 'Write the Group Coaching application page', done: false }, { t: 'Close the first two $5,000 coaching clients', done: false }], agent: 'Offer Architect', next: 'Funnel Sprint is the gap. Three buyers of the kit asked for help building, so it already has demand.' }),
      r('dg14', 'Launch 3 funnels this quarter', { cat: 'funnels', area: 'funnel', metric: 'steps', named: true, meaning: 'The new website, one freebie funnel and one paid offer funnel, each live with follow-up connected.', steps: [{ t: 'Rebuild the main website on the new brand', done: true }, { t: 'Launch the free website redesign funnel', done: true }, { t: 'Write the 5-email follow-up for the freebie', done: false }, { t: 'Build the Funnel Sprint sales page and checkout', done: false }, { t: 'Send YouTube traffic to the paid funnel', done: false }, { t: 'Review all three after 14 days', done: false }] }),
      r('dg15', '', { cat: 'money', area: 'business', metric: 'custom', mlabel: 'Profit margin', unit: '%', kind: 'total', start: 48, target: 60, current: 54, named: false, history: h([['2026-10-01', 48], ['2026-10-20', 51], ['2026-11-05', 54]]), steps: [{ t: 'List every monthly expense', done: true }, { t: 'Cancel three tools HighLevel already covers', done: true }, { t: 'Reach 57%', done: false }, { t: 'Raise the kit price to $37', done: false }, { t: 'Hit 60%', done: false }], next: 'Tool spend is down €410 a month. The price test on the kit is the next lever.' }),
      r('dg16', 'Six weeks of vacation in 2027', { cat: 'freedom', area: 'business', metric: 'steps', named: true, meaning: 'Six full weeks off with no calls and no Slack, spread over the year, while sales keep running.', steps: [{ t: 'Block the dates in Google Calendar', done: true }, { t: 'Automate the weekly content cycle', done: false }, { t: 'Hand client check-ins to the onboarding automation', done: false }, { t: 'Take the first week off in February', done: false }, { t: 'Take two weeks off in July', done: false }] }, '2027-12-31'),
      r('dg17', 'Fridays free of calls', { cat: 'freedom', area: 'business', metric: 'steps', named: true, steps: [{ t: 'Close Friday on every booking calendar', done: true }, { t: 'Move the coaching call to Thursday', done: true }, { t: 'Four Fridays in a row with no calls', done: false }] }),
      r('dg18', 'HighLevel OS: systems, automations and domains', { cat: 'hlos', area: 'os', metric: 'steps', named: true, meaning: 'Every lead, buyer and client runs through HighLevel without manual work, on our own domains.', steps: [{ t: 'Connect and verify the main domain', done: true }, { t: 'Set up and warm the sending domain', done: true }, { t: 'Build the lead nurture automation', done: false }, { t: 'Build booking reminders and no-show follow-up', done: false }, { t: 'Build the post-purchase onboarding workflow', done: false }, { t: 'Save the account as a snapshot', done: false }], agent: 'Funnel Builder', next: 'The sending domain has warmed for 21 days. The nurture automation can go live this week.' }),
    ];
    return DG;
  }
  const rows = () => (isLive() ? OG.items().filter((x) => x.kind === 'goal' && x.status !== 'archived') : demoRows());
  const all = () => rows().map(norm);
  const find = (id) => rows().find((x) => x.id === id);

  async function saveRow(row, patch) {
    Object.assign(row, patch);
    if (!isLive()) return;
    await window.Auth.memory.update(row.id, patch);
  }
  // Ask the server to measure every goal from its source. Runs when Goals opens (at most every 10 minutes)
  // and right after a goal is added or a channel connects. The daily job does the same each morning.
  let lastTrack = 0, tracking = null;
  async function track(force) {
    if (!isLive() || tracking || (!force && Date.now() - lastTrack < 600000)) return tracking;
    lastTrack = Date.now();
    tracking = (async () => {
      try {
        const s = await window.Auth.session(); if (!s) return;
        const r = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'track', workspace_id: ctx().ws.id }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Tracking failed');
        let changed = false;
        (j.goals || []).forEach((x) => { const row = find(x.id); if (row && JSON.stringify(row.meta) !== JSON.stringify(x.meta)) { row.meta = x.meta; changed = true; } });
        if (changed && window.VS.view === 'goals') window.App.render(true);
      } catch (e) { console.error(e); } finally { tracking = null; }
    })();
    return tracking;
  }
  const ago = (t) => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return !Number.isFinite(m) ? '' : m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  // Keep a connected channel goal's stored value and history in step with the platform, once a day.
  const synced = new Set();
  function syncAuto(list) {
    if (!isLive()) return;
    list.forEach((g) => {
      if (!g.live || synced.has(g.id) || g.live.v === g.current) return; synced.add(g.id);
      const row = find(g.id); if (!row) return; const d = toIso(today());
      const hist = (g.history || []).filter((x) => x.d !== d).concat({ d, v: g.live.v }).slice(-120);
      saveRow(row, { meta: { ...(row.meta || {}), current: g.live.v, history: hist } }).catch((e) => console.error(e));
    });
  }

  /* ---------- render pieces ---------- */
  const pill = (s, g) => g && g.metric === 'steps' && s === 'open' ? `<span class="pill out">${g.now} of ${g.target}</span>` : s === 'done' ? '<span class="pill pos">Reached</span>' : s === 'open' ? '<span class="pill out">No date</span>' : OG.stPill(s);
  const paceLine = (g) => {
    if (g.done) return g.metric === 'steps' ? 'Every step done' : 'Target reached';
    if (g.metric === 'steps') return g.daysLeft == null ? '' : g.daysLeft < 0 ? 'past the date' : g.daysLeft === 0 ? 'due today' : `${g.daysLeft} days left`;
    const bits = [];
    if (g.perWeek != null) bits.push(`about ${val(g, g.perWeek < 10 ? Math.round(g.perWeek * 10) / 10 : Math.round(g.perWeek))} a week to get there`);
    else if (g.left > 0) bits.push(`${val(g, g.left)} to go`);
    if (g.daysLeft != null) bits.push(g.daysLeft < 0 ? 'past the date' : g.daysLeft === 0 ? 'due today' : `${g.daysLeft} days left`);
    return bits.join(' · ');
  };
  const forLabel = (g) => g.area === 'brand' || g.area === 'business' ? AREA_NAME[g.area] : `${AREA_NAME[g.area]} · ${forName(g)}`;
  const row = (g) => `<div class="row goal click" data-action="g2" data-id="${esc(g.id)}" tabindex="0" role="button"><div class="grow">
      <div class="dh"><span class="t">${esc(g.label)}</span>${pill(g.st, g)}</div>
      ${OG.bar(g.p, g.elapsed)}
      <div class="s g2-s"><span>${g.metric === 'steps' ? `<b class="g2-now">${g.now} of ${g.target}</b> steps done` : `<b class="g2-now">${val(g, g.now)}</b> now`}${g.due ? ' · by ' + dshort(g.due) : ''}</span><span>${esc(paceLine(g))}</span>${tagFor(g)}</div>
    </div></div>`;
  function tagFor(g) {
    if (g.live) return `<span class="g2-live">${icon('check')}Tracked from ${esc(g.live.from)}${g.live.at ? ' · ' + esc(ago(g.live.at)) : ''}</span>`;
    const t = tracker(g); if (!t) return '';
    if (g.srv.err) return `<span class="g2-warn">Could not read ${esc(t[0])}: ${esc(g.srv.err)}</span>`;
    if (t[1] && !connFor(t[1])) return `<span class="g2-warn">Connect ${esc(t[1] === 'highlevel' ? 'HighLevel' : CH_NAME[t[1]] || t[1])} to track this</span>`;
    return '';
  }
  function groups(list) {
    const m = new Map();
    list.forEach((g) => { const k = g.area + '|' + (g.area === 'brand' || g.area === 'business' ? '' : forName(g)); if (!m.has(k)) m.set(k, { area: g.area, name: forLabel(g), ref: g.ref, list: [] }); m.get(k).list.push(g); });
    const order = AREAS.map((a) => a[0]);
    const pos = (g) => { const l = g.area === 'channel' ? CHANNELS : g.area === 'stream' ? STREAMS : null; const i = l ? l.findIndex((x) => x[0] === g.ref) : -1; return i < 0 ? 99 : i; };
    return [...m.values()].sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area) || pos(a) - pos(b) || a.name.localeCompare(b.name));
  }
  function counts(list) { const c = { on: 0, risk: 0, off: 0, done: 0 }; list.forEach((g) => { if (c[g.st] != null) c[g.st]++; }); return c; }
  VS.gFilter = VS.gFilter || 'all';
  function panel(list) {
    const f = VS.gFilter;
    const have = new Set(list.map((g) => g.area));
    const opts = FILTERS.filter(([v]) => v === 'all' || have.has(v) || v === f);
    const shown = f === 'all' ? list : list.filter((g) => g.area === f);
    const c = counts(list);
    const head = `<header class="g2-head"><div><h2>Goals</h2><span class="meta">${list.length} goal${list.length === 1 ? '' : 's'} · ${c.on} on track · ${c.risk} at risk · ${c.off} off track${c.done ? ' · ' + c.done + ' reached' : ''}. The line marks where you should be today.</span></div>${list.length ? U.seg('gFilter', f, opts) : ''}</header>`;
    if (!list.length) return `<section class="panel">${head}${U.empty('No goals yet', 'Set a goal for a channel, an offer, a funnel, a revenue stream, an OS feature or the whole business. Goals tied to a connection track themselves.')}<div class="actions" style="justify-content:center;margin-top:4px"><button class="btn primary" data-action="g2-new">Add a goal</button></div></section>`;
    return `<section class="panel g2">${head}${groups(shown).map((gr) => `<div class="g2-group"><h3 class="g2-gh"><span>${esc(gr.name)}</span><button class="btn sm ghost" data-action="g2-new" data-area="${gr.area}" data-ref="${esc(gr.ref || '')}" aria-label="Add a goal for ${esc(gr.name)}">${icon('plus')}<span>Goal</span></button></h3><div class="rows">${gr.list.map(row).join('')}</div></div>`).join('') || U.empty('Nothing here', 'No goals in this group yet.')}</section>`;
  }

  /* ---------- six category cards ---------- */
  const stepsLine = (g) => g.steps.length ? `${g.steps.filter((x) => x.done).length} of ${g.steps.length} steps` : '';
  const stepBtn = (g, x, i) => `<li><button type="button" class="gc-step" data-action="g2-step" data-id="${esc(g.id)}" data-i="${i}" aria-pressed="${!!x.done}"><span class="gc-box" aria-hidden="true">${icon('check')}</span><span class="gc-t">${esc(x.t)}</span></button></li>`;
  const stepTools = (g, i) => `<span class="gc-tools"><button type="button" class="gc-tool" data-action="g2-step-edit" data-id="${esc(g.id)}" data-i="${i}" aria-label="Edit step" title="Edit step">${icon('edit')}</button><button type="button" class="gc-tool" data-action="g2-step-del" data-id="${esc(g.id)}" data-i="${i}" aria-label="Remove step" title="Remove step">${icon('close')}</button></span>`;
  const stepLi = (g, x, i) => `<li class="gc-li">${stepBtn(g, x, i).replace(/^<li>|<\/li>$/g, '')}${stepTools(g, i)}</li>`;
  function item(g) {
    const show = g.steps.slice(0, 6); const more = g.steps.length - show.length;
    const list = g.steps.length ? `<ul class="gc-steps" aria-label="Steps for ${esc(g.label)}">${show.map((x, i) => stepLi(g, x, i)).join('')}${more > 0 ? `<li><button type="button" class="gc-more" data-action="g2" data-id="${esc(g.id)}">${more} more step${more === 1 ? '' : 's'}</button></li>` : ''}</ul>`
      : `<div class="gc-nosteps"><button type="button" class="btn sm ghost" data-action="g2-suggest" data-id="${esc(g.id)}">${icon('sparkle')}<span>Suggest steps</span></button></div>`;
    const tools = `<div class="gc-gtools"><button type="button" class="linkish" data-action="g2-addstep" data-id="${esc(g.id)}">${icon('plus')}Add step</button><button type="button" class="linkish" data-action="${g.metric === 'steps' ? 'g2-steps-edit' : 'g2-edit'}" data-id="${esc(g.id)}">${icon('edit')}Edit goal</button><button type="button" class="linkish danger" data-action="g2-archive" data-id="${esc(g.id)}">${icon('close')}Remove goal</button></div>`;
    return `<div class="gc-item${g.metric === 'steps' ? ' is-steps' : ''}">${row(g)}${list}${tools}</div>`;
  }
  const PENDING = {};
  function card(c, list) {
    const mine = list.filter((g) => g.cat === c.id);
    const n = mine.reduce((a, g) => a + g.steps.length, 0), d = mine.reduce((a, g) => a + g.steps.filter((x) => x.done).length, 0);
    const busy = PENDING[c.id];
    return `<section class="panel gc" id="gc-${c.id}" data-cat="${c.id}">
      <header class="gc-head"><div><h2>${esc(c.name)}</h2><span class="meta">${esc(c.about)}</span></div><span class="meta gc-count">${mine.length ? `${mine.length} goal${mine.length === 1 ? '' : 's'}${n ? ` · ${d} of ${n} steps` : ''}` : ''}</span></header>
      ${mine.length || busy ? `<div class="gc-list">${mine.map(item).join('')}${busy ? `<div class="gc-pending" role="status">${U.spin}<span>Jarvis is reading \u201c${esc(busy)}\u201d</span></div>` : ''}</div>` : `<p class="muted gc-empty">No goals here yet. Say one in your own words and Jarvis turns it into steps.</p>`}
      <form class="gc-add" data-gcat="${c.id}" autocomplete="off"><label class="sr" for="gc-in-${c.id}">Add a ${esc(c.name)} goal</label><input class="input" id="gc-in-${c.id}" name="t" maxlength="400" placeholder="${esc(c.ph)}" ${busy ? 'disabled' : ''}><button class="btn sm primary" type="submit" ${busy ? 'disabled' : ''}>Add</button></form>
      <div class="gc-starts">${c.starts.map(([l, t, sel]) => `<button type="button" class="chip" data-action="gc-start" data-cat="${c.id}" data-t="${esc(t)}" data-sel="${esc(sel)}">${esc(l)}</button>`).join('')}${c.known.length ? `<button type="button" class="chip ghost" data-action="g2-new" data-area="${c.known[0][3]}" data-ref="${esc(c.known[0][4])}" data-cat="${c.id}">Exact number goal</button>` : ''}</div>
    </section>`;
  }
  function cards(list) {
    return `<div class="gc-grid">${CATS.map((c) => card(c, list)).join('')}</div>`;
  }
  function summary(list) {
    const c = counts(list); const n = list.reduce((a, g) => a + g.steps.length, 0), d = list.reduce((a, g) => a + g.steps.filter((x) => x.done).length, 0);
    return list.length ? `${list.length} goal${list.length === 1 ? '' : 's'} across six areas · ${c.on} on track · ${c.risk} at risk${c.off ? ' · ' + c.off + ' off track' : ''}${c.done ? ' · ' + c.done + ' reached' : ''}${n ? ` · ${d} of ${n} steps done` : ''}.` : '';
  }

  /* ---------- the pages ---------- */
  const demoGoals = V.goals;
  V.goals = () => {
    const html = demoGoals();
    const list = all();
    const start = html.indexOf('<div class="layout"');
    const end = html.indexOf('<section class="panel review"', start);
    const body = start > -1 && end > -1 ? html.slice(0, start) + `<p class="meta gc-sum">${esc(summary(list))}</p>` + cards(list) + '\n    ' + html.slice(end) : html;
    return body.replace('Where the quarter is heading, measured from live numbers. Jarvis writes the weekly review every Sunday at 18:00.', 'Six areas you grow at the same time. Say a goal in your own words and Jarvis reads it with your Brand DNA, learns what you mean and lays out the steps. Anything a connection can measure tracks itself.');
  };
  V.goals.live = () => {
    if (OG.loadingLive()) { OG.items(); return `${U.title('Goals', 'Every channel, offer and funnel, measured.')}<section class="panel">${U.empty('Opening your goals', 'One moment.')}</section>`; }
    const list = all(); syncAuto(list); track(false);
    return `${U.title('Goals', 'Six areas you grow at the same time. Say a goal in your own words and Jarvis reads it with your Brand DNA, learns what you mean and lays out the steps. Anything a connection can measure tracks itself.')}
    ${list.length ? `<p class="meta gc-sum">${esc(summary(list))}</p>` : ''}${cards(list)}
    <div class="grid2" style="margin-top:var(--gap)"><section class="panel"><header><h2>Weekly review</h2></header><p class="muted">Every Sunday at 18:00 Jarvis drafts what went well, what slipped and next week\u2019s three priorities, from your goals, connected sources and Memory. Goals that are at risk lead the list.</p></section>
    <section class="panel"><header><h2>Freedom number</h2></header><p class="muted">The monthly profit that buys your time back. It needs revenue from HighLevel and your costs, so it switches on with the HighLevel connection.</p></section></div>`;
  };

  /* ---------- detail drawer ---------- */
  function spark(g) {
    const pts = (g.history || []).map((x) => ({ t: OG.ms(x.d), v: +x.v })).filter((x) => Number.isFinite(x.v));
    if (!pts.some((x) => x.t === today())) pts.push({ t: today(), v: g.now });
    pts.unshift({ t: OG.ms(g.startDate), v: g.start }); pts.sort((a, b) => a.t - b.t);
    if (pts.length < 2) return '';
    const t0 = pts[0].t, t1 = g.due ? Math.max(OG.ms(g.due), pts[pts.length - 1].t) : pts[pts.length - 1].t;
    const vs = pts.map((p) => p.v).concat(g.target); const lo = Math.min(...vs), hi = Math.max(...vs); const W = 320, H = 96, P = 6;
    const x = (t) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P), y = (v) => H - P - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 2 * P);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const ideal = g.due ? `<path d="M${x(OG.ms(g.startDate)).toFixed(1)} ${y(g.start).toFixed(1)} L${x(OG.ms(g.due)).toFixed(1)} ${y(g.target).toFixed(1)}" class="g2-ideal"/>` : '';
    return `<svg class="g2-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress from ${val(g, g.start)} toward ${val(g, g.target)}">${ideal}<path d="${line}" class="g2-line"/>${pts.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6" class="g2-dot"/>`).join('')}</svg><p class="meta">Solid line is where you are. Dashed line is the pace that lands the target on the date.</p>`;
  }
  function openGoal(id) {
    const r = find(id); if (!r) return; const g = norm(r);
    const hist = [...(g.history || [])].reverse().slice(0, 8);
    const S = g.metric === 'steps';
    if (S) {
      U.drawer(`<div><p class="meta">${esc(CAT[g.cat].name)}${g.who ? ' · watched by ' + esc(g.who) : ''}</p><h2>${esc(g.label)}</h2></div>
      <div class="kv4"><div><span>Done</span><b>${g.now}</b></div><div><span>Steps</span><b>${g.target}</b></div><div><span>Progress</span><b>${Math.round(Math.max(0, Math.min(1, g.p)) * 100)}%</b></div><div><span>By</span><b>${g.due ? dshort(g.due) : 'No date'}</b></div></div>
      ${g.due ? `<div class="dsec"><h3>Pace</h3><p>${pill(g.st, g)} <span class="muted">${esc(paceLine(g))}</span></p>${OG.bar(g.p, g.elapsed)}</div>` : ''}
      ${stepsBlock(g)}${meaningBlock(g)}
      ${g.next ? `<div class="dsec"><h3>Next move</h3><p>${esc(g.next)}</p></div>` : ''}
      ${g.note ? `<div class="dsec"><h3>Why it matters</h3><p>${esc(g.note)}</p></div>` : ''}
      <div class="actions"><button class="btn" data-action="g2-steps-edit" data-id="${esc(g.id)}">Edit goal</button><button class="btn ghost" data-action="g2-archive" data-id="${esc(g.id)}">Remove goal</button></div>`, { label: 'Goal' });
      return;
    }
    U.drawer(`<div><p class="meta">${esc(CAT[g.cat].name)} · ${esc(forLabel(g))}${g.who ? ' · watched by ' + esc(g.who) : ''}</p><h2>${esc(g.label)}</h2></div>
      <div class="kv4"><div><span>Now</span><b>${bare(g, g.now)}</b></div><div><span>Target</span><b>${bare(g, g.target)}</b></div><div><span>Progress</span><b>${Math.round(Math.max(0, Math.min(1, g.p)) * 100)}%</b></div><div><span>${g.due ? 'By' : 'Started'}</span><b>${g.due ? dshort(g.due) : dshort(g.startDate)}</b></div></div>
      <div class="dsec"><h3>Pace</h3><p>${pill(g.st)} <span class="muted">${esc(paceLine(g) || 'Set a date to see the pace.')}</span></p>${spark(g)}</div>
      ${stepsBlock(g)}
      ${g.next ? `<div class="dsec"><h3>Next move</h3><p>${esc(g.next)}</p></div>` : ''}
      ${meaningBlock(g)}
      ${g.note ? `<div class="dsec"><h3>Why it matters</h3><p>${esc(g.note)}</p></div>` : ''}
      <div class="dsec"><h3>Check in</h3>${g.live ? `<p class="muted">This number comes from ${esc(g.live.from)}${g.live.at ? ', last read ' + esc(ago(g.live.at)) : ''}. It updates every morning and when you open Goals. You can still log a number by hand.</p>` : `<p class="muted">${g.mlabel ? esc(g.mlabel) + ' is' : 'This is'} not read from a connection yet, so log where you are each week.</p>`}
        <form class="inline g2-check" data-goalcheck="${esc(g.id)}" autocomplete="off"><input name="v" inputmode="decimal" required aria-label="Where you are now" placeholder="Where you are now" value="${esc(nfmt(g.now))}"><button class="btn primary">Log it</button></form></div>
      ${hist.length ? `<div class="dsec"><h3>History</h3><div class="rows">${hist.map((x) => `<div class="row"><div class="grow"><div class="t">${val(g, x.v)}</div></div><span class="meta">${dshort(x.d)}</span></div>`).join('')}</div></div>` : ''}
      <div class="actions"><button class="btn" data-action="g2-edit" data-id="${esc(g.id)}">Edit goal</button><button class="btn ghost" data-action="g2-archive" data-id="${esc(g.id)}">Remove goal</button></div>`, { label: 'Goal' });
  }
  ACT.g2 = (el) => openGoal(el.dataset.id);

  /* ---------- editor ---------- */
  let F = null;
  function offerOpts(kind) {
    try { const d = window.DNA.data(); const o = window.DNA.offersFor(d); return (kind === 'offer' ? o.offers : o.funnels).map((x) => [String(x.id), x.name]); } catch { return []; }
  }
  function refOpts(area) {
    if (area === 'channel') return CHANNELS.map(([id]) => [id, chLabel(id)]);
    if (area === 'stream') return STREAMS;
    if (area === 'offer' || area === 'funnel') return offerOpts(area).concat([['other', area === 'offer' ? 'Another offer' : 'Another funnel']]);
    return [];
  }
  function blank(area, ref) {
    const a = AREA_NAME[area] ? area : 'channel';
    const ro = refOpts(a); const r = ref && ro.some((x) => x[0] === ref) ? ref : ro[0] ? ro[0][0] : '';
    const mt = metricsFor(a, r)[0] || ['custom', '', '', 'total', 'up'];
    return { id: null, area: a, ref: r, refName: '', metric: mt[0], mlabel: '', unit: mt[2], kind: mt[3], dir: mt[4], start: '', target: '', dueKind: 'quarter', due: '', text: '', note: '', auto: true };
  }
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;
  function draft() {
    // a normalised goal from the form state, used for the auto value and the preview line
    const mt = metricsFor(F.area, F.ref).find((x) => x[0] === F.metric);
    const refName = F.area === 'channel' ? chLabel(F.ref) : F.area === 'stream' ? ST_NAME[F.ref] : F.area === 'offer' || F.area === 'funnel' ? (F.ref === 'other' ? F.refName : (refOpts(F.area).find((x) => x[0] === F.ref) || [])[1] || '') : AREA_NAME[F.area];
    return { area: F.area, ref: F.ref, refName, metric: F.metric, mlabel: mt ? mt[1] : F.mlabel, unit: mt ? mt[2] : F.unit, kind: mt ? mt[3] : F.kind, dir: mt ? mt[4] : F.dir };
  }
  function form() {
    const d = draft(); const ro = refOpts(F.area); const ms = metricsFor(F.area, F.ref);
    const live = autoValue({ ...d });
    const refLabel = { channel: 'Which channel', offer: 'Which offer', funnel: 'Which funnel', stream: 'Which stream' }[F.area];
    const startVal = F.start !== '' ? F.start : live ? String(live.v) : '';
    const tgt = parseNum(F.target), st = parseNum(startVal), due = dueFrom(F.dueKind, F.due);
    let preview = '';
    if (Number.isFinite(tgt)) {
      const g = calc({ ...d, text: '', start: Number.isFinite(st) ? st : 0, now: Number.isFinite(st) ? st : 0, current: 0, target: tgt, due, startDate: toIso(today()), history: [] });
      preview = `${autoText(g)}${due ? ' by ' + dshort(due) : ''}.${g.perWeek != null && Number.isFinite(st) ? ' That is about ' + val(g, g.perWeek < 10 ? Math.round(g.perWeek * 10) / 10 : Math.round(g.perWeek)) + ' a week from today.' : ''}`;
    }
    return `<form class="gform" data-goalform autocomplete="off">
      <div><p class="meta">${F.id ? 'Edit goal' : 'New goal'}</p><h2>${F.id ? 'Edit this goal' : 'Add a goal'}</h2></div>
      <div class="field"><span>What it is for</span><div class="chips">${AREAS.map(([v, l]) => `<button type="button" class="chip" data-action="gf-area" data-v="${v}" aria-pressed="${v === F.area}">${l}</button>`).join('')}</div></div>
      ${ro.length ? `<label class="field"><span>${refLabel}</span><select name="ref" data-action="gf-set">${ro.map(([v, l]) => opt(v, l, F.ref)).join('')}</select></label>` : ''}
      ${(F.area === 'offer' || F.area === 'funnel') && ro.length === 1 ? `<p class="meta g2-hint">No ${F.area}s in Brand DNA yet. They sync in from HighLevel, or type the name below.</p>` : ''}
      ${F.ref === 'other' ? `<label class="field"><span>${F.area === 'offer' ? 'Offer' : 'Funnel'} name</span><input name="refName" maxlength="120" required value="${esc(F.refName)}" placeholder="${F.area === 'offer' ? 'Group Coaching cohort' : 'Webinar registration'}"></label>` : ''}
      <label class="field"><span>Measure</span><select name="metric" data-action="gf-set">${ms.map(([v, l]) => opt(v, l, F.metric)).join('')}${opt('custom', 'Something else', F.metric)}</select></label>
      ${F.metric === 'custom' ? `<div class="g2-grid"><label class="field"><span>What you count</span><input name="mlabel" maxlength="60" required value="${esc(F.mlabel)}" placeholder="Workshop seats sold"></label><label class="field"><span>Unit</span><input name="unit" maxlength="20" value="${esc(F.unit)}" placeholder="seats, €, %"></label><label class="field"><span>Better when it goes</span><select name="dir">${opt('up', 'Up', F.dir)}${opt('down', 'Down', F.dir)}</select></label></div>` : ''}
      <div class="g2-grid"><label class="field"><span>${F.id ? 'Started at' : 'Where you are now'}</span><input name="start" inputmode="decimal" value="${esc(startVal)}" placeholder="0"></label><label class="field"><span>Target</span><input name="target" inputmode="decimal" required value="${esc(F.target)}" placeholder="${d.unit === '%' ? '30' : d.unit === '€' ? '10000' : '50000'}"></label></div>
      ${hint(d, live)}
      <div class="g2-grid"><label class="field"><span>By</span><select name="dueKind" data-action="gf-set">${DUES.map(([v, l]) => opt(v, l, F.dueKind)).join('')}</select></label>${F.dueKind === 'date' ? `<label class="field"><span>Date</span><input type="date" name="due" required value="${esc(F.due)}" min="${toIso(today())}"></label>` : `<div class="field"><span>Date</span><p class="g2-date">${due ? dshort(due) : ''}</p></div>`}</div>
      <label class="field"><span>Name it (optional)</span><input name="text" maxlength="160" value="${esc(F.text)}" placeholder="${esc(Number.isFinite(tgt) ? autoText({ ...d, target: tgt }) : 'Subscribers to 50,000, YouTube')}"></label>
      <label class="field"><span>Why it matters (optional)</span><textarea name="note" rows="2" maxlength="600" placeholder="What it unlocks, or what moves it">${esc(F.note)}</textarea></label>
      ${preview ? `<p class="g2-preview">${esc(preview)}</p>` : ''}
      <div class="actions end"><button type="button" class="btn" data-action="drawer-close">Cancel</button><button class="btn primary" type="submit">${F.id ? 'Save changes' : 'Add goal'}</button></div>
    </form>`;
  }
  function hint(d, live) {
    if (live) return `<p class="meta g2-hint">${icon('check')} Tracks itself from ${esc(live.from)}. Right now: ${val(d, live.v)}.</p>`;
    const t = tracker(d);
    if (!t) return `<p class="meta g2-hint">No connection measures this, so you log it in a few seconds each week.</p>`;
    if (!t[1] || connFor(t[1])) return `<p class="meta g2-hint">${icon('check')} Tracks itself from ${esc(t[0])}. The first number arrives right after you save.</p>`;
    if (t[1] === 'youtube' || t[1] === 'youtube-2') return `<p class="meta g2-hint">Paste your channel link below the form and this goal tracks itself.</p>`;
    return `<p class="meta g2-hint">Connect ${esc(t[1] === 'highlevel' ? 'HighLevel' : CH_NAME[t[1]] || t[1])} in Connections and this goal tracks itself.</p>`;
  }
  // The YouTube link form sits outside the goal form, since forms cannot nest.
  function ytBlock() {
    if (!F) return ''; const t = tracker(draft());
    if (!t || !(t[1] === 'youtube' || t[1] === 'youtube-2') || connFor(t[1])) return '';
    if (!isLive()) return `<div class="dsec g2-yt"><h3>Connect YouTube</h3><p class="muted">In your own workspace you paste a channel link here. Nothing to approve.</p></div>`;
    if (!(window.Conn && window.Conn.ytReady && window.Conn.ytReady())) { if (window.Conn && window.Conn.catalog) window.Conn.catalog().then(() => { if (window.Conn.ytReady() && document.querySelector('form[data-goalform]')) { readForm(); show(); } }).catch(() => {}); return ''; }
    return `<div class="dsec g2-yt"><h3>Connect ${esc(CH_NAME[t[1]])}</h3>${window.Conn.ytForm(t[1], true)}<p class="meta">Public numbers only, so nothing to approve. Keep your goal details above, they stay as you typed them.</p></div>`;
  }
  function readForm() {
    const f = document.querySelector('form[data-goalform]'); if (!f) return;
    const d = Object.fromEntries(new FormData(f));
    ['ref', 'refName', 'metric', 'mlabel', 'unit', 'dir', 'start', 'target', 'dueKind', 'due', 'text', 'note'].forEach((k) => { if (d[k] != null) F[k] = String(d[k]); });
  }
  function show(focus) {
    U.drawer(form() + ytBlock(), { label: F.id ? 'Edit goal' : 'Add a goal' });
    const el = focus && document.querySelector(`form[data-goalform] [name="${focus}"]`); if (el) el.focus();
  }
  ACT['g2-new'] = (el) => { F = blank(el && el.dataset ? el.dataset.area : 'channel', el && el.dataset ? el.dataset.ref : ''); F.cat = el && el.dataset && CAT[el.dataset.cat] ? el.dataset.cat : ''; show(); };
  ACT['goal-add'] = ACT['g2-new'];
  ACT['gf-area'] = (el) => { readForm(); const keep = { start: '', target: F.target, dueKind: F.dueKind, due: F.due, note: F.note, id: F.id }; F = { ...blank(el.dataset.v), ...keep }; show(); };
  ACT['gf-set'] = (el) => {
    const prev = { ref: F.ref, metric: F.metric }; readForm();
    if (el.name === 'ref' && F.ref !== prev.ref) { const ms = metricsFor(F.area, F.ref); if (!ms.some((x) => x[0] === F.metric) && F.metric !== 'custom') F.metric = (ms[0] || ['custom'])[0]; if (!F.id) F.start = ''; }
    if (el.name === 'metric' && F.metric !== prev.metric && !F.id) F.start = '';
    show(el.name === 'dueKind' && F.dueKind === 'date' ? 'due' : el.name);
  };
  ACT['g2-edit'] = (el) => {
    const r = find(el.dataset.id); if (!r) return; const g = norm(r);
    F = { id: g.id, area: g.area, ref: g.ref, refName: g.area === 'offer' || g.area === 'funnel' ? g.refName : '', metric: g.metric, mlabel: g.metric === 'custom' ? g.mlabel : '', unit: g.unit, kind: g.kind, dir: g.dir, start: nfmt(g.start).replace(/,/g, ''), target: nfmt(g.target).replace(/,/g, ''), dueKind: g.due ? 'date' : 'quarter', due: g.due || '', text: g.named ? r.text || '' : '', note: g.note, auto: g.auto };
    if ((g.area === 'offer' || g.area === 'funnel') && !refOpts(g.area).some((x) => x[0] === g.ref)) F.ref = 'other';
    show();
  };
  ACT['g2-archive'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return;
    const ok = await U.dialog({ title: 'Remove this goal?', body: 'It leaves the Goals page and its steps go with it. Its history stays in Memory.', ok: 'Remove' }); if (!ok) return;
    try {
      if (isLive()) { await window.Auth.memory.update(r.id, { status: 'archived' }); r.status = 'archived'; } else DG = DG.filter((x) => x.id !== r.id);
      U.closeDrawer(); U.toast('Goal removed');
    } catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render(true);
  };

  document.addEventListener('submit', async (e) => {
    const add = e.target.closest('form[data-gcat]');
    if (add) { e.preventDefault(); const t = add.t.value.trim(); if (!t) { add.t.focus(); return; } addFromWords(add.dataset.gcat, t); return; }
    const se = e.target.closest('form[data-stepedit]');
    if (se) { e.preventDefault(); const id = se.dataset.stepedit, i = +se.dataset.i; const t = se.t.value.trim(); if (!t) { se.t.focus(); return; } await setSteps(id, (st) => { if (st[i]) st[i].t = t.slice(0, 160); return st; }); window.App.render(true); if (se.dataset.drawer) openGoal(id); U.toast('Step saved'); return; }
    const ns = e.target.closest('form[data-goalstep]');
    if (ns) {
      e.preventDefault(); const t = ns.t.value.trim(); if (!t) return; const id = ns.dataset.goalstep; const card = !!ns.dataset.card;
      await setSteps(id, (st) => st.concat({ t: t.slice(0, 160), done: false })); window.App.render(true);
      if (card) { const b = document.querySelector(`.gc-item [data-action="g2-addstep"][data-id="${CSS.escape(id)}"]`); if (b) ACT['g2-addstep'](b); U.toast('Step added'); return; }
      openGoal(id); const i2 = document.querySelector('#drawer form[data-goalstep] input'); if (i2) i2.focus(); return;
    }
    const mf = e.target.closest('form[data-goalmean]');
    if (mf) { e.preventDefault(); const r = find(mf.dataset.goalmean); if (!r) return; const m = mf.m.value.trim().slice(0, 600); try { await saveRow(r, { meta: { ...(r.meta || {}), meaning: m, taught: !!m } }); U.toast('Saved. Jarvis will use this from now on.'); } catch (ex) { U.toast(window.Auth.friendly(ex)); } window.App.render(true); openGoal(r.id); return; }
    const chk = e.target.closest('form[data-goalcheck]');
    if (chk) {
      e.preventDefault(); const id = chk.dataset.goalcheck; const r = find(id); if (!r) return;
      const v = parseNum(chk.v.value); if (!Number.isFinite(v)) { U.toast('Type a number'); return; }
      const d = toIso(today()); const m = r.meta || {};
      const hist = (Array.isArray(m.history) ? m.history : []).filter((x) => x.d !== d).concat({ d, v }).slice(-120);
      try { await saveRow(r, { meta: { ...m, current: v, history: hist } }); U.toast('Logged'); } catch (ex) { U.toast(window.Auth.friendly(ex)); }
      window.App.render(true); openGoal(id); return;
    }
    const f = e.target.closest('form[data-goalform]'); if (!f) return;
    e.preventDefault(); readForm();
    const d = draft(); const tgt = parseNum(F.target); const live = autoValue({ ...d });
    const st = F.start !== '' ? parseNum(F.start) : live ? live.v : 0;
    if (!Number.isFinite(tgt)) { U.toast('Type a target number'); return; }
    if (!Number.isFinite(st)) { U.toast('Type where you are now as a number'); return; }
    if (F.metric === 'custom' && !F.mlabel.trim()) { U.toast('Say what you count'); return; }
    if (F.ref === 'other' && !F.refName.trim()) { U.toast(`Name the ${F.area}`); return; }
    const due = dueFrom(F.dueKind, F.due); if (F.dueKind === 'date' && !due) { U.toast('Pick a date'); return; }
    const mt = metricsFor(F.area, F.ref).find((x) => x[0] === F.metric);
    const base = F.id ? (find(F.id) || {}).meta || {} : {};
    const meta = {
      ...base, v: 2, area: F.area, ref: F.ref === 'other' ? '' : F.ref, refName: d.refName || '', metric: F.metric,
      mlabel: mt ? mt[1] : F.mlabel.trim(), unit: mt ? mt[2] : F.unit.trim(), kind: mt ? mt[3] : 'total', dir: mt ? mt[4] : (F.dir === 'down' ? 'down' : 'up'),
      start: st, target: tgt, startDate: base.startDate || toIso(today()), note: F.note.trim(), cat: F.cat || base.cat || catOf({ area: F.area, ref: F.ref === 'other' ? '' : F.ref, metric: F.metric }), auto: base.auto !== false, named: !!F.text.trim() && F.text.trim() !== autoText({ ...d, target: tgt }),
    };
    if (!F.id) { meta.current = live ? live.v : st; meta.history = [{ d: toIso(today()), v: meta.current }]; }
    const text = F.text.trim() || autoText({ ...meta, target: tgt });
    try {
      if (F.id) { const r = find(F.id); await saveRow(r, { text, due, meta }); U.toast('Goal saved'); }
      else if (isLive()) { const row = await window.Auth.memory.add(ctx().ws.id, { kind: 'goal', text, due, meta }); OG.LM.items.unshift(row); U.toast('Goal added'); }
      else { demoRows().unshift({ id: 'dg' + Date.now(), kind: 'goal', text, due, status: 'open', created_at: new Date().toISOString(), meta }); U.toast('Goal added'); }
      const id = F.id; F = null; U.closeDrawer(); window.App.render(true); if (id) openGoal(id);
      if (isLive() && tracker(meta)) track(true);
    } catch (ex) { U.toast(window.Auth.friendly(ex)); }
  });

  /* ---------- goals in plain words, steps to tick off ---------- */
  async function api(body) {
    const s2 = await window.Auth.session(); if (!s2) throw new Error('Sign in first');
    const r = await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s2.access_token }, body: JSON.stringify({ ...body, workspace_id: ctx().ws.id }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'Jarvis could not read that'); e.status = r.status; throw e; } return j;
  }
  // Without an AI key (or in the demo) the goal is read here: a number, a date and the steps a founder usually hits.
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function localDue(t) {
    const d = new Date(today()); const y = d.getUTCFullYear(), mo = d.getUTCMonth(); const x = t.toLowerCase();
    const m = x.match(/\b(?:by|before|in|until)\s+(?:the\s+end\s+of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    if (m) { const i = MONTHS.indexOf(m[1]); return toIso(Date.UTC(i < mo ? y + 1 : y, i + 1, 0)); }
    if (/this month/.test(x)) return dueFrom('month'); if (/this quarter|\bq[1-4]\b/.test(x)) return dueFrom('quarter');
    if (/this year|end of (the )?year/.test(x)) return dueFrom('year'); if (/next year/.test(x)) return toIso(Date.UTC(y + 1, 11, 31));
    if (/next summer|by summer/.test(x)) return toIso(Date.UTC(mo > 7 ? y + 1 : y, 7, 31)); if (/90 days|3 months/.test(x)) return dueFrom('d90'); if (/30 days/.test(x)) return dueFrom('d30');
    return null;
  }
  function localNum(t) {
    const m = String(t).replace(/(\d),(\d{3})/g, '$1$2').match(/([€$]?)\s*(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?\b(\s*(?:%|percent))?/i); if (!m) return null;
    let n = parseFloat(m[2]); const k = (m[3] || '').toLowerCase(); if (k === 'k' || k === 'thousand') n *= 1e3; if (k === 'm' || k === 'million') n *= 1e6;
    return { n, unit: m[4] ? '%' : m[1] ? '€' : '' };
  }
  function localShape(c, text) {
    const t = text.toLowerCase(); const num = localNum(text);
    const pick = (id) => c.known.find((k) => k[0] === id);
    let k = null;
    if (c.id === 'youtube') k = /sub/.test(t) ? pick('subs') : /view/.test(t) ? pick('views-m') : /(video|upload|publish).*(week)|a week/.test(t) ? pick('long-w') : null;
    if (c.id === 'funnels') k = /lead/.test(t) ? pick('funnel-leads') : /opt.?in/.test(t) ? pick('funnel-optin') : /email|list/.test(t) && /subscri/.test(t) ? pick('email-subs') : null;
    if (c.id === 'money') k = /margin/.test(t) ? null : /profit/.test(t) ? pick('profit-m') : /revenue|sales|income/.test(t) ? pick('rev-m') : null;
    if (c.id === 'freedom') k = /hour/.test(t) ? pick('hours-w') : null;
    let metric = 'steps', label = '', unit = '', dir = 'up';
    if (k && num) metric = k[0];
    else if (num && c.id === 'money' && /margin/.test(t)) { metric = 'custom'; label = 'Profit margin'; unit = '%'; }
    else if (num && c.id === 'money' && /expense|cost|spend/.test(t)) { metric = 'custom'; label = 'Expenses a month'; unit = '€'; dir = 'down'; }
    const title = text.trim().replace(/\s+/g, ' ').replace(/^./, (x) => x.toUpperCase()).slice(0, 120);
    return { title, meaning: '', metric, label, unit, dir, target: num && metric !== 'steps' ? num.n : null, start: null, name: null, due: localDue(text), steps: STEPS[c.id].slice(), by: '' };
  }
  // Number goals get milestones on the way: a quarter, half, three quarters, then the target.
  function milestones(g, unit, label) {
    if (!Number.isFinite(g.start) || !Number.isFinite(g.target) || g.start === g.target) return [];
    const span = g.target - g.start; const nice = (v) => { const a = Math.abs(span); const r = a >= 10000 ? 1000 : a >= 1000 ? 100 : a >= 100 ? 10 : 1; return Math.round(v / r) * r; };
    const f = (v) => unit === '€' ? eur(v) : unit === '%' ? nfmt(v) + '%' : nfmt(v) + ' ' + (unit || label.toLowerCase());
    return [0.25, 0.5, 0.75].map((p) => nice(g.start + span * p)).filter((v, i, a) => a.indexOf(v) === i && v !== g.start && v !== g.target).map((v) => (g.dir === 'down' ? 'Get down to ' : 'Reach ') + f(v)).concat((g.dir === 'down' ? 'Get down to ' : 'Hit ') + f(g.target));
  }
  async function addFromWords(cat, text) {
    const c = CAT[cat]; if (!c || PENDING[cat]) return;
    PENDING[cat] = text; window.App.render(true);
    let r = null, note = '';
    try {
      if (isLive()) r = await api({ action: 'shape', cat, label: c.name, about: c.about, text, known: c.known.map((k) => ({ id: k[0], label: k[1], unit: k[2] })) });
    } catch (e) { note = e.status === 409 ? 'Connect Claude, OpenAI or Perplexity in Connections so Jarvis can read goals for you. Steps below are a starting point.' : (e.message || 'Jarvis could not read that') + '. Steps below are a starting point.'; }
    if (!r) r = localShape(c, text);
    try {
      const k = c.known.find((x) => x[0] === r.metric);
      const meta = { v: 2, cat, named: true, meaning: r.meaning || '', by: r.by || '', startDate: toIso(today()), auto: true, steps: [] };
      if (k) Object.assign(meta, { area: k[3], ref: k[4], refName: r.name || (k[3] === 'channel' ? chLabel(k[4]) : ''), metric: k[5], mlabel: k[1], unit: k[2], kind: k[6], dir: k[7] });
      else if (r.metric === 'custom') Object.assign(meta, { area: c.area, ref: c.ref, refName: r.name || '', metric: 'custom', mlabel: r.label || 'Progress', unit: r.unit || '', kind: 'total', dir: r.dir === 'down' ? 'down' : 'up' });
      else Object.assign(meta, { area: c.area, ref: c.ref, refName: r.name || '', metric: 'steps', mlabel: 'Steps', unit: 'steps', kind: 'total', dir: 'up' });
      if (meta.metric !== 'steps') {
        const live = autoValue({ ...meta, srv: {} });
        meta.target = Number.isFinite(+r.target) ? +r.target : 0;
        meta.start = live ? live.v : Number.isFinite(+r.start) ? +r.start : 0; meta.current = meta.start; meta.history = [{ d: toIso(today()), v: meta.current }];
      }
      let steps = (r.steps || []).filter(Boolean);
      if (meta.metric !== 'steps' && !(r.by)) { const ms = milestones(meta, meta.unit, meta.mlabel); if (ms.length) steps = ms.concat(steps.slice(0, 3)); }
      meta.steps = steps.slice(0, 8).map((t) => ({ t, done: false }));
      const due = r.due || null; const textName = r.title || text;
      if (isLive()) { const row = await window.Auth.memory.add(ctx().ws.id, { kind: 'goal', text: textName, due, meta }); OG.LM.items.unshift(row); }
      else demoRows().unshift({ id: 'dg' + Date.now(), kind: 'goal', text: textName, due, status: 'open', created_at: new Date().toISOString(), meta });
      U.toast(note || `Added with ${meta.steps.length} steps${r.by ? ', read by ' + r.by : ''}`);
      if (isLive() && tracker(meta)) track(true);
    } catch (e) { U.toast(window.Auth.friendly ? window.Auth.friendly(e) : e.message); }
    finally { delete PENDING[cat]; window.App.render(true); }
  }
  ACT['gc-start'] = (el) => {
    const f = document.querySelector(`form[data-gcat="${el.dataset.cat}"] input`); if (!f) return;
    f.value = el.dataset.t; f.focus(); const i = f.value.indexOf(el.dataset.sel); if (i > -1) f.setSelectionRange(i, i + el.dataset.sel.length);
  };
  async function setSteps(id, fn) {
    const r = find(id); if (!r) return; const m = r.meta || {};
    const steps = fn((Array.isArray(m.steps) ? m.steps : []).map((x) => ({ ...x })));
    try { await saveRow(r, { meta: { ...m, steps } }); } catch (e) { U.toast(window.Auth.friendly(e)); }
  }
  ACT['g2-step'] = async (el) => {
    const id = el.dataset.id, i = +el.dataset.i; const on = el.getAttribute('aria-pressed') !== 'true';
    el.setAttribute('aria-pressed', String(on));
    let all3 = false;
    await setSteps(id, (st) => { if (st[i]) { st[i].done = on; st[i].at = on ? new Date().toISOString() : null; } all3 = st.length && st.every((x) => x.done); return st; });
    if (on && all3) U.toast('Every step done. Goal reached.');
    const inDrawer = el.closest('#drawer'); window.App.render(true); if (inDrawer) openGoal(id);
  };
  ACT['g2-step-del'] = async (el) => {
    const id = el.dataset.id, i = +el.dataset.i; const inDrawer = !!el.closest('#drawer'); const r = find(id); const gone = r && (r.meta.steps || [])[i];
    await setSteps(id, (st) => st.filter((_, k) => k !== i)); window.App.render(true); if (inDrawer) openGoal(id);
    if (gone) U.toast('Step removed', { undo: async () => { await setSteps(id, (st) => { st.splice(Math.min(i, st.length), 0, gone); return st; }); window.App.render(true); if (inDrawer) openGoal(id); } });
  };
  // edit a step in place: the text turns into a field, Enter saves, Escape cancels
  ACT['g2-step-edit'] = (el) => {
    const id = el.dataset.id, i = +el.dataset.i; const r = find(id); const st = r && (r.meta.steps || [])[i]; if (!st) return;
    const li = el.closest('li'); const inDrawer = !!el.closest('#drawer');
    li.innerHTML = `<form class="gc-editstep" data-stepedit="${esc(id)}" data-i="${i}" data-drawer="${inDrawer ? 1 : ''}" autocomplete="off"><input class="input" name="t" maxlength="160" value="${esc(st.t)}" aria-label="Step"><button class="btn sm primary">Save</button><button type="button" class="btn sm ghost" data-action="g2-step-cancel" data-id="${esc(id)}" data-drawer="${inDrawer ? 1 : ''}">Cancel</button></form>`;
    const inp = li.querySelector('input'); inp.focus(); inp.select();
  };
  ACT['g2-step-cancel'] = (el) => { const id = el.dataset.id; window.App.render(true); if (el.dataset.drawer) openGoal(id); };
  // add a step right on the card
  ACT['g2-addstep'] = (el) => {
    const item = el.closest('.gc-item'); if (!item) return; let f = item.querySelector('form[data-goalstep]');
    if (!f) { item.querySelector('.gc-gtools').insertAdjacentHTML('beforebegin', `<form class="inline gc-addstep on-card" data-goalstep="${esc(el.dataset.id)}" data-card="1" autocomplete="off"><input class="input" name="t" maxlength="160" placeholder="Add a step" aria-label="Add a step"><button class="btn sm">Add</button></form>`); f = item.querySelector('form[data-goalstep]'); }
    f.querySelector('input').focus();
  };
  ACT['g2-suggest'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return; const g = norm(r); const c = CAT[g.cat];
    el.disabled = true; const keep = el.innerHTML; el.innerHTML = U.spin + '<span>Thinking</span>';
    let add = null, note = '';
    try { if (isLive()) add = (await api({ action: 'shape', cat: g.cat, label: c.name, about: c.about, text: g.label, goal: { title: g.label, meaning: g.meaning, steps: g.steps.map((x) => x.t) } })).steps; }
    catch (e) { note = e.status === 409 ? 'Connect Claude, OpenAI or Perplexity in Connections for steps written for you.' : e.message; }
    if (!add) { const have = new Set(g.steps.map((x) => x.t)); add = (g.metric !== 'steps' && !g.steps.length ? milestones(g, g.unit, g.mlabel) : []).concat(STEPS[g.cat].filter((t) => !have.has(t))).slice(0, 5); }
    const have = new Set(g.steps.map((x) => x.t.toLowerCase()));
    add = add.filter((t) => t && !have.has(t.toLowerCase()));
    await setSteps(g.id, (st) => st.concat(add.map((t) => ({ t, done: false }))).slice(0, 20));
    U.toast(note || (add.length ? `${add.length} step${add.length === 1 ? '' : 's'} added` : 'No new steps to add'));
    const inDrawer = el.closest('#drawer'); el.innerHTML = keep; el.disabled = false; window.App.render(true); if (inDrawer) openGoal(g.id);
  };
  ACT['g2-steps-edit'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return; const g = norm(r);
    const d = await U.dialog({ title: 'Edit goal', fields: [{ name: 'text', label: 'Goal', value: r.text || '', required: true }, { name: 'due', label: 'By (YYYY-MM-DD, optional)', value: r.due || '' }, { name: 'note', label: 'Why it matters (optional)', type: 'textarea', rows: 2, value: g.note }], ok: 'Save' });
    if (!d) return; const due = /^\d{4}-\d{2}-\d{2}$/.test(String(d.due || '').trim()) ? String(d.due).trim() : null;
    if (String(d.due || '').trim() && !due) { U.toast('Use a date like 2026-12-31'); return; }
    try { await saveRow(r, { text: String(d.text).trim().slice(0, 160), due, meta: { ...(r.meta || {}), note: String(d.note || '').trim(), named: true } }); U.toast('Goal saved'); } catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render(true); openGoal(r.id);
  };
  function stepsBlock(g) {
    return `<div class="dsec"><h3>Steps${g.steps.length ? ` <span class="meta">${stepsLine(g)}</span>` : ''}</h3>
      ${g.steps.length ? `<ul class="gc-steps in-drawer">${g.steps.map((x, i) => stepLi(g, x, i)).join('')}</ul>` : '<p class="muted">No steps yet.</p>'}
      <form class="inline gc-addstep" data-goalstep="${esc(g.id)}" autocomplete="off"><input class="input" name="t" maxlength="160" placeholder="Add a step" aria-label="Add a step"><button class="btn sm">Add</button></form>
      <div class="actions"><button type="button" class="btn sm ghost" data-action="g2-suggest" data-id="${esc(g.id)}">${icon('sparkle')}<span>Suggest more steps</span></button></div></div>`;
  }
  function meaningBlock(g) {
    return `<div class="dsec"><h3>${g.taught ? 'What you told Jarvis it means' : 'What Jarvis understood'}</h3>
      <form class="gc-mean" data-goalmean="${esc(g.id)}"><textarea class="input" name="m" rows="3" maxlength="600" placeholder="Say what hitting this goal looks like for you. Jarvis uses it the next time you set a goal and when you ask about it.">${esc(g.meaning)}</textarea><div class="actions"><button class="btn sm">Save meaning</button></div></form></div>`;
  }

  // After a channel connects from inside the goal form, redraw the form so it shows the live number.
  function afterConnect() {
    if (F && document.querySelector('form[data-goalform]')) { readForm(); show(); }
    if (isLive()) track(true);
  }
  window.OSGoals2 = { all, norm, val, forLabel, paceLine, afterConnect, track, tracker };
})();

// Founders AI OS Brand DNA. One compiled brief of who the founder is, what they sell and what already works
// in their space. In a private workspace the database rebuilds it on every change and HighLevel offers and
// funnels sync in. The demo builds the same thing from the sample data.
(() => {
  const DAY = 864e5;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();

  /* ---------- demo: posts that beat their creator's own median ---------- */
  const P = [
    ['The best business model is the one you can run from a laptop for 20 years.', 'Justin Welsh', 'x', 'post', 4820, 6.1, 3, 'creators'],
    ['Most people never launch because they build in secret for 6 months.', 'Justin Welsh', 'linkedin', 'post', 2310, 4.7, 2, 'creators'],
    ['I quit a $500K job to work alone. Here is the math I ran first.', 'Sahil Bloom', 'newsletter', 'essay', 1890, 3.9, 8, 'creators'],
    ['Your content is not boring. Your opinions are hidden.', 'Dan Koe', 'x', 'post', 6150, 5.4, 4, 'creators'],
    ['If I Had to Start Over With AI in 2027, I Would Do This', 'Iman Gadzhi', 'youtube', 'video', 2140000, 6.8, 6, 'research'],
    ['I Built a $10K/Month Business With Claude in 30 Days', 'Nick Saraev', 'youtube', 'video', 1320000, 7.4, 4, 'research'],
    ['Do I Have Dumb People or Dumb Systems?', 'Alex Hormozi', 'youtube', 'short', 3480000, 9.9, 5, 'creators'],
    ['7 GoHighLevel Automations That Run My Agency While I Sleep', 'Robb Bailey', 'youtube', 'video', 186000, 5.2, 9, 'research'],
    ['Stop Building Funnels Like It Is 2019', 'Russell Brunson', 'youtube', 'video', 412000, 4.6, 12, 'research'],
    ['Give Me 26 Minutes, I Will Give You 10,000 Hours of Claude Knowledge', 'Iman Gadzhi', 'youtube', 'video', 1875000, 4.4, 15, 'research'],
    ['If You Have Multiple Interests, Please Take Advantage of the Next 10 Years', 'Dan Koe', 'youtube', 'video', 905000, 5.9, 18, 'creators'],
    ['How I Would Build a $10M Service Business If I Had to Start Over', 'Alex Hormozi', 'youtube', 'video', 1467000, 4.6, 21, 'creators'],
    ['Can I Save This Failing Business in 90 Days?', 'Alex Hormozi', 'youtube', 'video', 1832000, 5.7, 24, 'creators'],
    ['Comment WIN to get my free scaling roadmap', 'Alex Hormozi', 'instagram', 'reel', 1669000, 4.1, 3, 'creators'],
    ['The 1 Person Business Model That Will Replace Your Job', 'Dan Koe', 'youtube', 'video', 1240000, 3.9, 27, 'creators'],
    ['5 Proven Ways to Make Money With AI, No Experience', 'Iman Gadzhi', 'youtube', 'video', 1670000, 3.9, 30, 'research'],
    ['Claude Code vs Cursor: I Tested Both for a Month', 'Nick Saraev', 'youtube', 'video', 640000, 3.6, 11, 'research'],
    ['HighLevel Just Changed Everything for Agencies', 'Robb Bailey', 'youtube', 'video', 98000, 3.4, 7, 'research'],
    ['How to Sell a $2,000 Offer Without a Sales Call', 'Leila Hormozi', 'instagram', 'reel', 720000, 3.8, 10, 'creators'],
    ['My Exact Content System: 1 Video, 30 Posts', 'Dan Koe', 'instagram', 'carousel', 88000, 3.2, 14, 'creators'],
    ['Why Most Low Ticket Offers Lose Money', 'Codie Sanchez', 'youtube', 'short', 2210000, 3.5, 8, 'creators'],
    ['How I Replaced 6 Tools With One AI Agent', 'Dan Martell', 'youtube', 'video', 1110000, 3.3, 16, 'research'],
    ['10 Hooks You Can Steal for Your Next Video', 'Codie Sanchez', 'instagram', 'carousel', 64000, 3.1, 19, 'creators'],
    ['Nobody Tells You This About Recurring Revenue', 'Leila Hormozi', 'youtube', 'short', 1560000, 3.0, 20, 'creators'],
    ['I Tried Vibe Coding a SaaS in 48 Hours', 'Nick Saraev', 'youtube', 'video', 510000, 2.9, 33, 'research'],
    ['How to Price Your First Digital Product', 'Alex Hormozi', 'instagram', 'reel', 1180000, 2.7, 26, 'creators'],
    ['The Personal Brand Playbook for Founders Who Hate Being on Camera', 'Dan Martell', 'youtube', 'video', 890000, 2.6, 40, 'research'],
    ['How to Get Your First 10 Clients With AI Outreach', 'Iman Gadzhi', 'youtube', 'short', 2480000, 2.5, 35, 'research'],
    ['What I Would Do With $1,000 and HighLevel Today', 'Robb Bailey', 'youtube', 'video', 71000, 2.4, 44, 'research'],
    ['Build the Business You Would Want to Buy', 'Codie Sanchez', 'youtube', 'video', 760000, 2.3, 48, 'creators'],
    ['Funnels vs Websites: Which One Actually Sells?', 'Russell Brunson', 'youtube', 'video', 205000, 2.2, 52, 'research'],
    ['3 Numbers Every Founder Should Know', 'Leila Hormozi', 'instagram', 'carousel', 52000, 2.1, 31, 'creators'],
    ['How to Write a Sales Page With Claude in 20 Minutes', 'Nick Saraev', 'youtube', 'short', 980000, 2.0, 38, 'research'],
    ['The Lazy Way to Post Every Day', 'Dan Koe', 'instagram', 'reel', 410000, 1.8, 57, 'creators'],
  ];
  let PROVEN = null;
  function demoProven() {
    if (PROVEN) return PROVEN;
    const now = Date.parse('2026-11-04T09:00:00Z');
    PROVEN = P.map(([title, author, platform, format, views, outlier, ago, src], i) => ({ id: 'pv' + i, title, author, platform, format, views, outlier, src,
      url: platform === 'youtube' ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(title) : 'https://www.instagram.com/',
      thumb: null, posted_at: new Date(now - ago * DAY).toISOString() }));
    return PROVEN;
  }

  /* ---------- the compiled text, same shape the database writes ---------- */
  const money = (o) => (o.price != null ? '$' + Number(o.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) + (o.price_note ? ' ' + o.price_note : '') : 'price not set');
  function compile({ facts, offers, funnels, proven, profile, writing }) {
    const out = ['BRAND DNA. Read this before writing anything for this founder. Approved founder facts take precedence. Write in the founder’s own voice as described under HOW I WRITE. Only live strategy records describe current offers and funnels. Planned work is not available yet. Content can educate, entertain or build trust without a sales pitch. Use measured patterns when the evidence supports them.'];
    if (facts.length) {
      out.push('', 'FOUNDER FACTS (approved, always true)');
      const by = {}; facts.forEach((f) => { (by[f.category] = by[f.category] || []).push(f.statement || f.text); });
      Object.keys(by).forEach((c) => { out.push(c.toUpperCase()); by[c].forEach((t) => out.push('- ' + t)); });
    }
    if (writing) out.push('', writing);
    if (profile && (profile.summary || (profile.phrases || []).length)) {
      out.push('', 'STUDIED FROM MY OWN MATERIAL');
      if (profile.summary) out.push('Summary: ' + profile.summary);
      if ((profile.phrases || []).length) out.push('Phrases I repeat: ' + profile.phrases.join(', '));
    }
    const on = (a) => a.filter((x) => x.included);
    if (on(offers).length) { out.push('', 'MY OFFERS'); on(offers).forEach((o) => out.push(`- ${o.name}: ${money(o)}${o.summary ? '. ' + o.summary : ''}`)); }
    if (on(funnels).length) { out.push('', 'MY FUNNELS (hosted on HighLevel)'); on(funnels).forEach((f) => out.push(`- ${f.name}${f.steps ? ', ' + f.steps + ' steps' : ''}${f.summary ? '. Goal: ' + f.summary : ''}${f.url ? ' (' + f.url + ')' : ''}`)); }
    if (proven.length) { out.push('', "PROVEN IN MY SPACE (posts that beat their creator's own median)"); proven.slice(0, 12).forEach((p) => out.push(`- "${p.title}" by ${p.author}, ${p.outlier}x their median, ${Number(p.views || 0).toLocaleString('en-US')} views (${p.platform} ${p.format})`)); }
    return out.join('\n');
  }

  /* ---------- demo DNA from the sample workspace ---------- */
  let DEMO = null;
  const NOTE = { month: 'a month', project: 'per project', cohort: 'per seat', once: 'one payment' };
  function demoDNA() {
    const St = window.Store, SEED = window.SEED;
    if (!DEMO) {
      const off = SEED.OFFERS.map((o, i) => ({ id: 'dn-' + o.id, kind: 'offer', source: 'highlevel', name: o.name, price: o.stream === 'affiliate' ? Math.round(o.price / 0.4) : o.price, currency: 'USD', price_note: o.stream === 'affiliate' ? 'a month, I earn 40% recurring' : NOTE[o.unit] || '', summary: o.hl, stream: o.stream, included: o.status === 'live', user_set: false, ext_updated_at: new Date(Date.parse('2026-11-03T10:00:00Z') - i * 3 * DAY).toISOString() }));
      const fun = SEED.funnels.map((f, i) => ({ id: 'dn-' + f.id, kind: 'funnel', source: 'highlevel', name: f.name, summary: f.goal, steps: f.pages, stream: f.stream, url: null, included: f.status === 'live', user_set: false, ext_updated_at: new Date(Date.parse('2026-11-02T10:00:00Z') - i * 5 * DAY).toISOString() }));
      DEMO = { version: 14, built_at: new Date(Date.now() - 4 * 6e4).toISOString(), synced_at: new Date(Date.now() - 2 * 36e5).toISOString(), items: off.concat(fun) };
    }
    const facts = ((St.s.brain && St.s.brain.facts) || []).filter((f) => f.status === 'approved');
    const offers = DEMO.items.filter((x) => x.kind === 'offer'), funnels = DEMO.items.filter((x) => x.kind === 'funnel');
    const proven = demoProven().slice().sort((a, b) => b.outlier - a.outlier);
    const docs = ((St.s.brain && St.s.brain.docs) || []).length;
    const ws = St.s.writing || []; const VP = window.Voiceprint;
    const writing = VP && ws.length ? VP.dnaSection(ws, VP.guide(VP.analyze(ws))) : '';
    const body = compile({ facts, offers, funnels, proven, profile: null, writing });
    return { dna: { version: DEMO.version, built_at: DEMO.built_at, body, counts: { facts: facts.length, offers: offers.filter((o) => o.included).length, funnels: funnels.filter((f) => f.included).length, proven: Math.min(12, proven.length), docs, writing: ws.length } }, items: DEMO.items, proven, synced_at: DEMO.synced_at, loading: false, error: '' };
  }
  function demoBump() { if (DEMO) { DEMO.version++; DEMO.built_at = new Date().toISOString(); } }

  /* ---------- live state ---------- */
  const L = { ws: null, dna: null, items: [], proven: [], at: 0, loading: false, error: '', syncing: false, tried: null };
  const VIEWS = new Set(['dna', 'proven', 'jarvis', 'content']);
  function load(force) {
    const w = ctx().ws; if (!w || !w.id || L.loading || !window.Auth) return Promise.resolve();
    if (!force && L.ws === w.id && Date.now() - L.at < 8000) return Promise.resolve();
    L.loading = true; L.error = '';
    const active=()=>isLive()&&ctx().ws?.id===w.id;
    if(L.ws!==w.id){L.dna=null;L.items=[];L.proven=[];L.at=0;L.ws=w.id;}
    return Promise.all([Auth.dna.get(w.id), Auth.strategy.list(w.id), Auth.dna.proven(w.id, 200, 1.5)])
      .then(([d, it, pv]) => { if(!active())return;L.dna = d; L.items = it.map(x=>({...x,included:x.lifecycle==='live',source:'founder',stream:x.details?.stream})); L.proven = (pv || []).map((p, i) => ({ id: 'pv' + i, ...p })); })
      .catch((e) => { if(active())L.error = Auth.friendly(e); })
      .finally(() => { L.loading=false;if(!active())return;L.at = Date.now(); window.dispatchEvent(new CustomEvent('fos-dna')); if (VIEWS.has(window.VS.view)) window.App.render(true); });
  }
  const hlOn = () => (ctx().conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected');
  const lastSync = () => L.items.filter((i) => i.source === 'highlevel').reduce((m, i) => Math.max(m, Date.parse(i.synced_at) || 0), 0);
  function autoSync() {
    const w = ctx().ws; if (!w || L.tried === w.id || !hlOn()) return;
    if (Date.now() - lastSync() < 6 * 36e5) return;
    L.tried = w.id; sync(true);
  }
  async function sync(quiet) {
    const w = ctx().ws; if (!w || L.syncing) return null;
    L.syncing = true; if (VIEWS.has(window.VS.view)) window.App.render(true);
    try { const r = await Auth.brainApi('dna-sync', { workspace_id: w.id }); if (!quiet) window.UI.toast(`Synced ${r.offers} offers and ${r.funnels} funnels from HighLevel`); return r; }
    catch (e) { if (!quiet) window.UI.toast(Auth.friendly(e)); return null; }
    finally { L.syncing = false; await load(true); }
  }
  function data() {
    if (!isLive()) return demoDNA();
    const w = ctx().ws; if (w && w.id && (L.ws !== w.id || Date.now() - L.at > 60000)) load();
    if(L.ws!==w?.id)return {dna:null,items:[],proven:[],loading:true,error:''};
    const dna=L.dna?{...L.dna,body:window.StrategySchema.context(L.dna.body,L.items),counts:{...L.dna.counts,offers:L.items.filter(x=>x.kind==='offer'&&x.included).length,funnels:L.items.filter(x=>x.kind==='funnel'&&x.included).length}}:null;
    return { dna, items: L.items, proven: L.proven, synced_at: null, loading: L.loading && !L.at, error: L.error, syncing: L.syncing };
  }

  /* ---------- small helpers shared by the views ---------- */
  function ago(iso) {
    if (!iso) return 'never';
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
    const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : d + ' days ago';
  }
  function pill() {
    const d = data(); const v = d.dna;
    if (!v) return `<a class="dna-pill" href="#dna" title="Brand DNA">${window.UI.icon('dna')}<span>Brand DNA</span></a>`;
    return `<a class="dna-pill" href="#dna" title="Brand DNA v${v.version}, rebuilt ${ago(v.built_at)}">${window.UI.icon('dna')}<span>DNA v${v.version}</span><span class="dna-pill-t">${ago(v.built_at)}</span></a>`;
  }
  const offersFor = (d) => ({ offers: d.items.filter((i) => i.kind === 'offer' && i.included), funnels: d.items.filter((i) => i.kind === 'funnel' && i.included) });

  window.DNA = { data, load, sync, demoProven, demoDNA, demoBump, compile, ago, pill, offersFor, L };
})();

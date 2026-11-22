// Grow: Brand, Content, Offers, Funnels, plus the idea and video drawers.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, C = window.Charts;
  const { esc, eur, int, pct, shade, sname, icon, title, kpis, who, vid } = U;
  const T = St.T, SEED = St.SEED, STREAMS = SEED.STREAMS;
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  /* ---------- Brand ---------- */
  V.brand = () => {
    const vids = SEED.videos.map((v) => ({ ...v, ...St.videoStats(v) }));
    const k = VS.brandSort, dir = VS.brandDir;
    vids.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir);
    const last90 = SEED.videos.filter((v) => v.day >= T - 90), prev90 = SEED.videos.filter((v) => v.day < T - 90 && v.day >= T - 180);
    const subs = St.sum(SEED.videos, (v) => v.subsGained);
    const chain = V.chainNumbers(90);
    const monthsV = St.monthly(12).map((m) => ({ label: m.label, views: St.sum(SEED.videos.filter((v) => v.date.startsWith(m.key)), (v) => v.views), leads: St.sum(SEED.videos.filter((v) => v.date.startsWith(m.key)), (v) => v.leads) }));
    U.after(() => C.line(U.$('#brand-line'), { labels: monthsV.map((m) => m.label), series: [{ name: 'Views', values: monthsV.map((m) => m.views) }], format: int, tickFormat: U.compact, height: 210 }));
    const th = (key, label, n = true) => `<th class="${n ? 'n' : ''}"><button class="sortb" data-action="sort" data-k="${key}" aria-sort="${k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${k === key ? (dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
    return `${title('Brand', 'Your YouTube channel as a revenue source. Every video traced to the leads, calls and buyers it created.', '<button class="btn" data-action="hl" data-what="YouTube Studio">Open YouTube Studio</button>')}
    ${kpis([{ label: 'Views, 90 days', value: int(St.sum(last90, (v) => v.views)), delta: U.change(St.sum(last90, (v) => v.views), St.sum(prev90, (v) => v.views)) + ' vs the 90 before' }, { label: 'Leads, 90 days', value: int(St.sum(last90, (v) => v.leads)), delta: pct(St.sum(last90, (v) => v.leads) / St.sum(last90, (v) => v.views), 2) + ' of views' }, { label: 'Subscribers gained', value: int(subs), delta: 'Last 12 months' }, { label: 'Revenue from YouTube', value: eur(St.sum(Object.values(St.videoRev), (x) => x)), delta: 'All streams, 12 months' }, { label: 'Videos', value: SEED.videos.length, delta: (SEED.videos.length / 52).toFixed(1) + ' a week' }])}
    <div class="grid2" style="margin-top:var(--gap)">
      <section class="panel"><header><h2>Views per month</h2><span class="meta">By publish month</span></header><div id="brand-line"></div></section>
      <section class="panel"><header><h2>The full chain</h2><span class="meta">Last 90 days</span></header>${V.chainHtml(chain, true)}</section>
    </div>
    <section class="panel" style="margin-top:var(--gap)"><header><h2>All videos</h2><span class="meta">Outlier is views against your channel median for that month · click a title for comments and revenue</span></header>
      <div class="table-wrap"><table class="sortable"><thead><tr>${th('title', 'Video', false)}${th('day', 'Published')}${th('views', 'Views')}${th('outlier', 'Outlier')}${th('ctr', 'CTR')}${th('leads', 'Leads')}${th('buyers', 'Buyers')}${th('revenue', 'Revenue')}</tr></thead><tbody>
      ${vids.map((v) => `<tr><td class="clip">${vid(v.id)}</td><td class="n muted">${St.fmtDay(v.day)}</td><td class="n">${int(v.views)}</td><td class="n">${v.outlier >= 2.5 ? `<span class="pill acc">${v.outlier.toFixed(1)}x</span>` : v.outlier.toFixed(1) + 'x'}</td><td class="n">${v.ctr.toFixed(1)}%</td><td class="n">${v.leads}</td><td class="n">${v.buyers}</td><td class="n">${v.revenue ? eur(v.revenue) : U.MINUS}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  };
  ACT.sort = (el) => { const k = el.dataset.k; if (VS.brandSort === k) VS.brandDir *= -1; else { VS.brandSort = k; VS.brandDir = k === 'title' ? 1 : -1; } window.App.render(); };

  ACT.video = (el) => {
    const v = St.videoById[el.dataset.id]; const s = St.videoStats(v);
    const comments = SEED.commentsFor(v.id);
    const intentPill = { buying: 'acc', question: '', praise: 'pos', objection: 'warn', idea: 'out' };
    const contacts = s.contacts.slice(0, 6);
    U.drawer(`<div><p class="meta">Published ${St.fmtDay(v.day)} · ${v.outlier.toFixed(1)}x your median</p><h2>${esc(v.title)}</h2></div>
      <div class="kv4"><div><span>Views</span><b>${int(v.views)}</b></div><div><span>Engagement</span><b>${pct(s.engagement, 1)}</b></div><div><span>Leads</span><b>${v.leads}</b></div><div><span>Revenue</span><b>${eur(s.revenue)}</b></div></div>
      <div class="kv4"><div><span>CTR</span><b>${v.ctr.toFixed(1)}%</b></div><div><span>Watch hours</span><b>${int(v.watchMin / 60)}</b></div><div><span>Subscribers</span><b>+${v.subsGained}</b></div><div><span>Buyers</span><b>${s.buyers}</b></div></div>
      ${s.revenue ? `<div class="dsec"><h3>Revenue it drove</h3>${STREAMS.filter((x) => s.byStream[x.id]).map((x) => `<div class="sbar"><span>${x.name}</span><span class="track"><span class="fill" style="width:${(s.byStream[x.id] / s.revenue) * 100}%;background:${shade[x.id]}"></span></span><span class="v">${eur(s.byStream[x.id])}</span></div>`).join('')}</div>` : '<p class="muted">No attributed revenue yet. Affiliate SubIDs for this video are being added by Data Fixer.</p>'}
      ${contacts.length ? `<div class="dsec"><h3>People it brought in</h3><div class="rows">${contacts.map((c) => `<div class="row"><div class="grow"><div class="t"><button class="lnk" data-action="contact" data-id="${c.id}" data-push="1">${esc(c.name)}</button></div><div class="s">${c.roles.map(sname).join(', ')}</div></div><span class="num right">${eur(c.ltv)}</span></div>`).join('')}</div></div>` : ''}
      <div class="dsec"><h3>Comments, tagged by intent</h3><div class="rows">${comments.map((c) => `<div class="row"><div class="grow"><div class="t wrap">${esc(c.text)}</div><div class="s">${esc(c.author)} · ${c.likes} likes</div></div><span class="pill ${intentPill[c.intent] || ''}">${c.intent}</span></div>`).join('')}</div></div>
      <div class="dsec"><h3>Repurpose</h3><p class="muted">Repurposer drafts a community post, a newsletter email and 3 shorts from the transcript and the top comments. They land in the Newsfeed.</p>
      <div class="actions" style="margin-top:10px"><button class="btn primary" data-action="repurpose" data-id="${v.id}">Repurpose this video</button><button class="btn" data-action="video-idea" data-id="${v.id}">Make a follow-up idea</button></div></div>`, { label: 'Video', push: el.dataset.push === '1' });
  };
  ACT.repurpose = (el) => {
    const v = St.videoById[el.dataset.id];
    const base = { agent: 'repurpose', stream: 'products', contactId: null, evidence: 'From the transcript of "' + v.title + '" and its ' + v.comments + ' comments.' };
    St.A.addApproval({ ...base, kind: 'Community post', title: 'Community post: ' + v.title, rubric: 'rb-post', scores: [8.9, 8.6, 8.8], action: 'Post to HighLevel Communities', body: 'I just posted a breakdown of ' + v.title.toLowerCase() + '.\n\nThe short version: start with one clinic, build it on the SaaS plan, and let the hosting pay for the next one.\n\nWhat would you build first? Reply with your niche and I will answer every one.' });
    St.A.addApproval({ ...base, kind: 'Email', title: 'Newsletter: ' + v.title, rubric: 'rb-email', scores: [8.7, 9, 8.4, 8.2], action: 'Schedule broadcast in HighLevel to 4,812 contacts', body: 'Subject: ' + v.title + '\n\nHi {{first_name}},\n\nHere is exactly what I did, step by step, with the numbers on screen.\n\nWatch it here: {{video_link}}\n\nAvery' });
    St.A.addApproval({ ...base, kind: 'Shorts plan', title: '3 shorts from ' + v.title, rubric: 'rb-script', scores: [8.6, 8.8, 8.1, 8.9], action: 'Add to the HighLevel social planner as drafts', body: 'Short 1 (0:00 to 0:40): the result first, then the one setting that made it work.\nShort 2 (3:10 to 3:55): the price question from the comments, answered.\nShort 3 (7:20 to 8:00): the boring part that makes money.' });
    el.disabled = true; el.textContent = '3 drafts in the Newsfeed'; U.toast('3 drafts sent to the Newsfeed'); window.App.refreshCounts();
  };
  ACT['video-idea'] = (el) => {
    const v = St.videoById[el.dataset.id];
    const i = St.A.addIdea({ title: 'Follow-up: ' + v.title.replace(/^I /, 'How I '), score: Math.min(9.4, 7.6 + v.outlier * 0.3), sources: ['OUTLIER'], streams: ['products', 'software'], why: 'Follow-up to a ' + v.outlier.toFixed(1) + 'x video. Viewers asked for part two in the comments.', videoId: v.id });
    el.disabled = true; el.textContent = 'Added to Ideas'; U.toast('Added to Content: ' + i.title);
  };

  /* ---------- Content ---------- */
  const PL = () => SEED.YT_PLAN; const pname = (id) => (PL().pillars.find((p) => p[0] === id) || [, ''])[1]; const fname = (id) => (PL().formats.find((p) => p[0] === id) || [, ''])[1];
  const PSHORT = { funnels: 'Funnels', ai: 'AI', brand: 'Brand', hl: 'HighLevel' };
  const COLS = [['ideas', 'Ideas'], ['developing', 'Developing'], ['ready', 'Ready to film'], ['published', 'Published']];
  V.ideaCard = (i) => `<article class="idea ${i.fresh ? 'fresh' : ''}" draggable="true" data-drag="${i.id}" tabindex="0" role="button" data-action="idea" data-id="${i.id}" aria-label="${esc(i.title)}">
      <div class="top">${i.sources.map((s) => `<span class="tag">${s}</span>`).join('')}<span class="sc ${i.score >= 9 ? 'hi' : ''}">${i.score.toFixed(1)}</span></div>
      <h4>${esc(i.title)}</h4><p class="why">${esc(i.why)}</p>${i.sells ? `<p class="sells">Sells ${esc(i.sells)}</p>` : ''}
      <div class="foot"><span>${i.pillar ? `<b class="pl">${PSHORT[i.pillar]}</b>` : ''}${i.streams.map(sname).join(' · ')}</span><span class="thumbs"><button class="thumb" data-action="vote" data-id="${i.id}" data-v="up" aria-label="More like this" aria-pressed="${i.vote === 'up'}">${icon('up')}</button><button class="thumb" data-action="vote" data-id="${i.id}" data-v="down" aria-label="Fewer like this" aria-pressed="${i.vote === 'down'}">${icon('down')}</button></span></div>
    </article>`;

  function planPanel() {
    const P = PL(); const live = St.s.ideas.filter((i) => i.col !== 'published');
    const fromDoc = St.s.ideas.filter((i) => i.fromDoc);
    return `<section class="panel plan" style="margin-top:var(--gap)"><header><div><p class="meta">Your 2027 plan${P.docUrl ? ` · <a class="lnk" href="${esc(P.docUrl)}" target="_blank" rel="noopener">Open the doc</a>` : ''}</p><h2 class="plan-goal">${esc(P.goal)}</h2><p class="muted small">${esc(P.principle)} ${fromDoc.length} ideas from the doc are on the board, tagged YOUR PLAN.</p></div>
      <button class="btn sm" data-action="plan-only">${VS.cSource === 'YOUR PLAN' ? 'Show all ideas' : 'Show plan ideas only'}</button></header>
      <div class="plan-grid">${P.pillars.map(([id, n]) => { const c = live.filter((i) => i.pillar === id); const f = P.formats.map(([fid, fn]) => [fn, c.filter((i) => i.format === fid).length]); return `<button class="pcell ${VS.cPillar === id ? 'on' : ''}" data-action="pillar" data-id="${id}"><span class="meta">${esc(n)}</span><b>${c.length}</b><span class="small muted">in the pipeline</span><span class="fmix">${f.map(([fn, k]) => `<i style="flex:${k || 0.001}" title="${esc(fn)}: ${k}"></i>`).join('')}</span></button>`; }).join('')}</div>
      <p class="small muted plan-key"><span><i class="k1"></i>Tutorials, reviews and news</span><span><i class="k2"></i>Business education</span><span><i class="k3"></i>Make money online inspiration</span></p>
    </section>`;
  }
  ACT['col-more'] = () => { VS.cMore = !VS.cMore; window.App.render(); };
  ACT.pillar = (el) => { VS.cPillar = VS.cPillar === el.dataset.id ? 'all' : el.dataset.id; window.App.render(); };
  ACT['plan-only'] = () => { VS.cSource = VS.cSource === 'YOUR PLAN' ? 'all' : 'YOUR PLAN'; window.App.render(); };

  ACT['offer-team'] = () => { VS.agDept = 'Offers and funnels'; location.hash = '#agents'; };
  ACT['content-team'] = () => { VS.agDept = 'Brand and content'; location.hash = '#agents'; };
  V.content = () => {
    const ideas = St.s.ideas.filter((i) => (VS.cStream === 'all' || i.streams.includes(VS.cStream)) && (VS.cSource === 'all' || i.sources.includes(VS.cSource)) && (VS.cStage === 'all' || i.stage === VS.cStage) && (!VS.cPillar || VS.cPillar === 'all' || i.pillar === VS.cPillar) && (!VS.cFormat || VS.cFormat === 'all' || i.format === VS.cFormat));
    const out30 = SEED.videos.filter((v) => v.day >= T - 30);
    const eng = St.sum(out30, (v) => v.likes + v.comments) / Math.max(1, St.sum(out30, (v) => v.views));
    const perWeek = out30.length / (30 / 7);
    const sources = [...new Set(St.s.ideas.flatMap((i) => i.sources))].sort();
    const running = VS.running.nightly;
    return `${title('Content', 'Every idea starts from something that already worked in your space, rewritten from your Brand DNA and pointed at one of your offers. Your thumbs teach the scorer.', `<a class="btn" href="#proven">${icon('proven')}<span>Proven</span></a><button class="btn" data-action="content-team">Content agents</button><button class="btn" data-action="new-idea">${icon('plus')}New idea</button><button class="btn primary" data-action="run-ideation" ${running ? 'disabled' : ''}>${running ? U.spin + 'Reading 6 sources' : 'Run ideation now'}</button>`)}
    ${kpis([{ label: 'Videos out, 30 days', value: out30.length, delta: 'Target 2 a week' }, { label: 'Velocity', value: perWeek.toFixed(1) + ' a week', delta: perWeek >= 2 ? '<span class="up">On target</span>' : '<span class="down">' + (2 - perWeek).toFixed(1) + ' under target</span>' }, { label: 'Engagement', value: pct(eng, 1), delta: 'Likes and comments per view' }, { label: 'In the pipeline', value: St.s.ideas.filter((i) => i.col !== 'published').length, delta: St.s.ideas.filter((i) => i.col === 'ready').length + ' ready to film' }])}
    ${window.OSProven ? window.OSProven.homePanel(3) : ''}
    ${planPanel()}
    <div class="filters" style="margin-top:var(--gap)">
      <label class="sel"><span>Stream</span><select data-action="filter" data-key="cStream"><option value="all">All streams</option>${STREAMS.map((s) => `<option value="${s.id}" ${VS.cStream === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>
      <label class="sel"><span>Source</span><select data-action="filter" data-key="cSource"><option value="all">All sources</option>${sources.map((s) => `<option ${VS.cSource === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="sel"><span>Funnel stage</span><select data-action="filter" data-key="cStage"><option value="all">All stages</option>${['TOF', 'MOF', 'BOF'].map((s) => `<option ${VS.cStage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="sel"><span>Category</span><select data-action="filter" data-key="cPillar"><option value="all">All categories</option>${PL().pillars.map(([id, n]) => `<option value="${id}" ${VS.cPillar === id ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="sel"><span>Format</span><select data-action="filter" data-key="cFormat"><option value="all">All formats</option>${PL().formats.map(([id, n]) => `<option value="${id}" ${VS.cFormat === id ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="meta">${ideas.length} of ${St.s.ideas.length} ideas · drag cards between columns</span>
    </div>
    <div class="board">${COLS.map(([id, n]) => { const list = ideas.filter((i) => i.col === id).sort((a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || b.score - a.score); const cap = id === 'ideas' && !VS.cMore && list.length > 14 ? 12 : list.length; return `<div class="col" data-drop="${id}"><h3>${n} <span>${list.length}</span></h3><div class="cards">${list.slice(0, cap).map(V.ideaCard).join('') || '<p class="meta dropzone">Drop an idea here</p>'}${cap < list.length ? `<button class="btn sm more" data-action="col-more">Show ${list.length - cap} more</button>` : id === 'ideas' && VS.cMore && list.length > 14 ? '<button class="btn sm more" data-action="col-more">Show top 12</button>' : ''}</div></div>`; }).join('')}</div>`;
  };
  ACT.filter = (el) => { VS[el.dataset.key] = el.value; VS.approval = null; window.App.render(); };
  ACT.vote = async (el, e) => {
    e.stopPropagation();
    const i = St.s.ideas.find((x) => x.id === el.dataset.id); const dir = el.dataset.v;
    let reason = '';
    if (i.vote !== dir) {
      const r = await U.dialog({ title: dir === 'up' ? 'More ideas like this' : 'Fewer ideas like this', body: 'Optional. A reason makes the scorer learn faster.', fields: [{ name: 'quick', label: 'Quick reasons', type: 'chips', options: dir === 'up' ? ['Serves two streams', 'My audience asks for this', 'Proven structure', 'Easy to film'] : ['Done it before', 'Off brand', 'Low intent topic', 'Too much work'] }, { name: 'reason', label: 'Reason', type: 'textarea', rows: 2 }], ok: 'Save' });
      if (!r) return; reason = r.reason;
    }
    St.A.vote(i.id, dir, reason);
    U.toast(i.vote ? 'Saved to Brain decisions. The scorer will adjust tonight.' : 'Vote removed'); window.App.render(true);
  };
  ACT['new-idea'] = async () => {
    const r = await U.dialog({ title: 'New idea', fields: [{ name: 'title', label: 'Title', required: true, placeholder: 'What I would build for a dentist in a weekend' }, { name: 'why', label: 'Why now', type: 'textarea', rows: 2, placeholder: 'A client asked me this on Monday' }, { name: 'stream', label: 'Main stream', type: 'select', value: 'products', options: STREAMS.map((s) => [s.id, s.name]) }, { name: 'stage', label: 'Funnel stage', type: 'select', value: 'TOF', options: [['TOF', 'Top: reach'], ['MOF', 'Middle: trust'], ['BOF', 'Bottom: buy']] }, { name: 'pillar', label: 'Category', type: 'select', value: 'funnels', options: PL().pillars }, { name: 'format', label: 'Format', type: 'select', value: 'edu', options: PL().formats }], ok: 'Add idea' });
    if (!r) return; const i = St.A.addIdea({ title: r.title, why: r.why || 'Added by you.', streams: [r.stream], stage: r.stage, pillar: r.pillar, format: r.format, score: 7.8 }); i.fresh = true;
    U.toast('Added. The scorer grades it tonight.'); window.App.render();
  };
  ACT['run-ideation'] = () => {
    VS.running.nightly = true; window.App.render();
    setTimeout(() => { const added = St.A.runIdeation(); VS.running.nightly = false; U.toast(added.length ? added.length + ' new ideas scored and added' : 'No new ideas above your bar tonight'); if (location.hash === '#content') window.App.render(); }, 1800);
  };
  ACT.move = (el, e) => { e.stopPropagation(); St.A.moveIdea(el.dataset.id, el.dataset.col); U.toast('Moved to ' + COLS.find((c) => c[0] === el.dataset.col)[1]); U.closeDrawer(); window.App.render(); };

  // drafts: three graded variants per format
  const FORMATS = [['title', 'Title and thumbnail'], ['outline', 'Outline'], ['script', 'Full script'], ['post', 'Community post'], ['email', 'Email'], ['shorts', 'Shorts plan']];
  function drafts(i, f) {
    const t = i.title, low = t.charAt(0).toLowerCase() + t.slice(1);
    const outlier = [...SEED.videos].sort((a, b) => b.outlier - a.outlier)[0];
    const T3 = {
      title: i.alts ? [t, `${i.alts[0]}\nThumbnail: ${i.alts[1]}`, `${i.alts[2]}\nThumbnail: ${i.alts[3]}`] : [t, `${t}: what I learned doing it`, `${t} (in under 10 minutes)`],
      outline: [
        `1. The result on screen in the first 10 seconds\n2. The 3 numbers that prove it\n3. Walkthrough inside HighLevel\n4. What it cost and what it pays\n5. One next step: the App Builder Kit`,
        `1. A client call that started this\n2. What I told them, and why it surprised them\n3. The build, live\n4. The lesson in one line\n5. Invite to the membership`,
        `Structure from "${outlier.title}" (${outlier.outlier.toFixed(1)}x):\n1. Bold claim with proof\n2. Before and after\n3. Step by step on screen\n4. The catch nobody mentions\n5. Call to action`],
      script: [
        `HOOK: ${t}. Here is exactly what I do, with the numbers on screen.\n\nINTRO: I run software for 68 clinics, and this is the part most people skip.\n\nSTEP 1: Open HighLevel and go to the sub-account.\nSTEP 2: Set the one thing that makes it pay every month.\nSTEP 3: Show the result.\n\nCTA: The full setup is in the App Builder Kit. Link below.`,
        `HOOK: Last week a physio asked me a question I could not stop thinking about.\n\nSTORY: She asked why her website cost her money every month and gave nothing back.\n\nTURN: So I rebuilt it live. ${t}.\n\nLESSON: The boring part that makes money is the hosting.\n\nCTA: Book a free redesign call if you want me to look at yours.`,
        `Transplanted from "${outlier.title}":\nCLAIM (0:00): ${t}.\nPROOF (0:15): Dashboard on screen.\nBUILD (1:00 to 7:00): Step by step.\nCATCH (7:30): What I would not do again.\nCTA (8:30): One link, one action.`],
      post: [`${t}.\n\nThree numbers from this week: 68 clinics live, 9 new kit buyers, 1 cancellation.\n\nWhat is your number to watch? Reply below.`, `A client asked me this on Monday and I gave a bad answer.\n\nHere is the better one: ${low}.\n\nWhat would you add?`, `New video is up: ${t}.\n\nIf you only watch one part, skip to the 3-minute mark.`],
      email: [`Subject: ${t}\n\nHi {{first_name}},\n\nQuick one. Here is exactly what I do, with the numbers.\n\n{{video_link}}\n\nAvery`, `Subject: The question a physio asked me\n\nHi {{first_name}},\n\nShe asked something I could not stop thinking about. My answer is in today's video: ${low}.\n\n{{video_link}}\n\nAvery`, `Subject: ${t} (part of the 5-day series)\n\nHi {{first_name}},\n\nDay 3. Today we build the part that pays every month.\n\nAvery`],
      shorts: [`Short 1: the result in 30 seconds\nShort 2: the one setting that matters\nShort 3: what it costs, what it pays`, `Short 1: the client question\nShort 2: the build in fast forward\nShort 3: the lesson`, `Short 1: claim plus proof\nShort 2: the catch nobody mentions\nShort 3: answer to the top comment`],
    }[f];
    const h = hash(i.id + f);
    const sc = (k) => +(8 + (Math.abs(h >> (k * 3)) % 15) / 10).toFixed(1);
    const labels = f === 'title' && i.fromDoc ? [['Your title', 'As written in your 2027 plan'], ['Voice A', 'Direct, numbers first'], ['Voice B', 'Story first']] : [['Voice A', 'Direct, numbers first'], ['Voice B', 'Story first, uses the one contrarian line'], ['Structure transplant', 'From your best outlier']];
    return labels.map(([label, note], k) => ({ label, note, text: T3[k], score: sc(k) }));
  }
  ACT.idea = (el, e) => {
    if (e && e.target.closest('.thumb')) return;
    const i = St.s.ideas.find((x) => x.id === el.dataset.id); if (!i) return;
    const f = el.dataset.format || 'title';
    const ds = drafts(i, f);
    const vidRef = i.videoId ? `<p class="meta">Published as ${vid(i.videoId)}</p>` : '';
    U.drawer(`<div class="tags">${i.sources.map((s) => `<span class="tag">${s}</span>`).join('')}<span class="pill out">${i.stage}</span><span class="pill">${COLS.find((c) => c[0] === i.col)[1]}</span></div>
      <div><h2>${esc(i.title)}</h2><p class="muted" style="margin-top:6px">Score ${i.score.toFixed(1)} · serves ${i.streams.map(sname).join(', ')}</p>${i.pillar ? `<p class="meta" style="margin-top:4px">${esc(pname(i.pillar))} · ${esc(fname(i.format))}${i.fromDoc ? ' · from your 2027 plan' : ''}</p>` : ''}${vidRef}</div>
      <p class="evidence">${esc(i.why)}</p>
      <div class="formats" role="tablist">${FORMATS.map(([id, n]) => `<button role="tab" class="chip" aria-pressed="${id === f}" data-action="idea" data-id="${i.id}" data-format="${id}">${n}</button>`).join('')}</div>
      ${ds.map((d, k) => `<div class="draft"><div class="dh"><b>${d.label}</b><span class="meta">${d.note}</span><span class="pill ${d.score >= 8.5 ? 'pos' : 'warn'}">${d.score.toFixed(1)}</span></div><p class="doc">${esc(d.text)}</p><div class="actions"><button class="btn sm" data-action="copy-draft" data-k="${k}">${icon('copy')}Copy</button><button class="btn sm" data-action="send-draft" data-id="${i.id}" data-format="${f}" data-k="${k}">${icon('send')}Send to approvals</button></div></div>`).join('')}
      <div class="dsec"><h3>Move to</h3><div class="actions">${COLS.filter((c) => c[0] !== i.col).map(([id, n]) => `<button class="btn sm" data-action="move" data-id="${i.id}" data-col="${id}">${n}</button>`).join('')}</div></div>`, { label: 'Idea drafts' });
    U.$('#drawer')._drafts = ds;
  };
  ACT['copy-draft'] = (el) => U.copy(U.$('#drawer')._drafts[+el.dataset.k].text);
  ACT['send-draft'] = (el) => {
    const i = St.s.ideas.find((x) => x.id === el.dataset.id); const d = U.$('#drawer')._drafts[+el.dataset.k]; const f = FORMATS.find((x) => x[0] === el.dataset.format);
    const kind = { title: 'Title', outline: 'Outline', script: 'Script', post: 'Community post', email: 'Email', shorts: 'Shorts plan' }[f[0]];
    const rb = { title: 'rb-title', script: 'rb-script', outline: 'rb-script', post: 'rb-post', email: 'rb-email', shorts: 'rb-script' }[f[0]];
    const rub = St.s.brain.rubrics.find((r) => r.id === rb);
    const h = hash(i.id + f[0] + d.label);
    St.A.addApproval({ kind, title: f[1] + ': ' + i.title, agent: 'draft', stream: i.streams[0], contactId: null, rubric: rb, scores: rub.criteria.map((_, k) => +(7.6 + ((h >> k) % 18) / 10).toFixed(1)), action: f[0] === 'email' ? 'Schedule broadcast in HighLevel' : f[0] === 'post' ? 'Post to HighLevel Communities' : 'Save to the content calendar', body: d.text, evidence: d.label + ' variant. ' + i.why, antithesis: d.label === 'Voice B' });
    if (i.col === 'ideas') i.col = 'developing';
    el.disabled = true; el.textContent = 'In the Newsfeed'; U.toast('Sent to the Newsfeed'); window.App.refreshCounts();
  };

  /* ---------- Offers ---------- */
  V.offers = () => {
    const perf = St.offerPerf();
    const drafts = St.s.offerDrafts;
    return `${title('Offers', 'One ladder across four streams. Offer Lab proposes from calls, comments and sales. You decide. HighLevel sells.', `<button class="btn" data-action="offer-team">Offer agents</button><button class="btn" data-action="offerlab">Ask Offer Lab for another</button><a class="btn primary" href="#funnel-agent">Build a sales page</a>`)}
    <div class="layout"><div class="stack">
      <section class="panel"><header><h2>Live offers</h2><span class="meta">Computed from HighLevel payments</span></header>
      <div class="table-wrap"><table><thead><tr><th>Offer</th><th>Stream</th><th class="n">Price</th><th class="n">Buyers, 30 d</th><th class="n">Revenue, 30 d</th><th class="n">Change</th><th class="n">12 months</th></tr></thead><tbody>
      ${perf.map((o) => `<tr><td>${esc(o.name)}<span class="sub">${esc(o.hl)}</span></td><td class="muted"><span class="sw" style="background:${shade[o.stream]}"></span>${sname(o.stream)}</td><td class="n">${eur(o.price)}${o.unit === 'month' ? '/mo' : ''}</td><td class="n">${o.buyers30 || U.MINUS}</td><td class="n">${o.rev30 ? eur(o.rev30) : U.MINUS}</td><td class="n">${o.rev30 ? U.change(o.rev30, o.prev30) : o.prev30 ? '<span class="meta">No sales</span>' : ''}</td><td class="n">${eur(o.rev12)}</td></tr>`).join('')}
      </tbody></table></div></section>
    </div><aside class="rail"><h2 class="out">Offer Lab drafts</h2>
      ${drafts.map((d) => `<section class="panel offer-draft"><header><h2>${esc(d.name)}</h2><span class="pill ${d.score >= 8 ? 'pos' : 'warn'}">${d.score.toFixed(1)}</span></header>
        <p class="serif-lede">${esc(d.promise)}</p>
        <dl class="dl"><dt>Price</dt><dd>${eur(d.price)} ${d.unit === 'month' ? 'a month' : 'per ' + d.unit}. ${esc(d.priceLogic)}</dd><dt>Stack</dt><dd>${d.stack.map(esc).join(' · ')}</dd><dt>Guarantee</dt><dd>${esc(d.guarantee)}</dd><dt>Segment</dt><dd>${esc(d.segment)}</dd><dt>Demand</dt><dd>${d.demand.map((x) => `<span class="pill">${esc(x)}</span>`).join(' ')}</dd></dl>
        <div class="actions" style="margin-top:14px">${St.s.packages.some((p) => p.offerId === d.id) ? `<a class="btn sm" href="#funnels">Package built</a>` : `<button class="btn sm primary" data-action="build-package" data-id="${d.id}">Build funnel package</button>`}<button class="btn sm ghost" data-action="offer-pass" data-id="${d.id}">Not now</button></div></section>`).join('') || `<section class="panel">${U.empty('No drafts', 'Ask Offer Lab for a new one.')}</section>`}
    </aside></div>`;
  };
  ACT['build-package'] = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Funnel Builder is writing'; setTimeout(() => { const p = St.A.buildPackage(el.dataset.id); U.toast('Package ready. Page copy also went to the Newsfeed.'); VS.pkg = p.id; location.hash = '#funnels'; }, 1200); };
  ACT['offer-pass'] = (el) => { const i = St.s.offerDrafts.findIndex((d) => d.id === el.dataset.id); const d = St.s.offerDrafts.splice(i, 1)[0]; St.s.brain.decisions.unshift({ date: '4 Nov', text: 'Passed on offer: ' + d.name }); St.log('Passed on an offer', d.name, 'offer'); U.toast('Saved to Brain as a passed offer'); window.App.render(); };
  ACT.offerlab = (el) => {
    if (St.s.offerDrafts.some((d) => d.id === 'o-hostplus')) return U.toast('Offer Lab has nothing new above your bar today');
    el.disabled = true; el.innerHTML = U.spin + 'Reading 48 calls';
    setTimeout(() => {
      St.s.offerDrafts.push({ id: 'o-hostplus', name: 'Hosting Plus for service clients', stream: 'software', price: 147, unit: 'month', status: 'draft', promise: 'Your website, booking and reviews kept up to date every month, on the same software your competitors pay double for.', priceLogic: 'Sits between Starter at 97 and Growth at 197. 14 service clients pay nothing monthly after their build.', stack: ['Hosting on the SaaS plan', 'Monthly edits, up to 2 hours', 'Review requests', 'Quarterly report'], guarantee: 'Cancel any month. Keep the site.', segment: 'Service clients with no software plan (14 contacts)', demand: ['14 clients without hosting', '6 asked about edits'], score: 8.4 });
      St.log('Offer Lab drafted an offer', 'Hosting Plus for service clients', 'agent', 'OS'); U.toast('Offer Lab drafted Hosting Plus'); window.App.render();
    }, 1400);
  };

  /* ---------- Funnels ---------- */
  V.funnels = () => {
    const pk = St.s.packages;
    return `${title('Funnels', 'Built and hosted in HighLevel. The OS writes the package. AI Studio builds the pages.', '<button class="btn" data-action="offer-team">Optimization agents</button><a class="btn" href="#offers">From an offer</a>')}
    <h2 class="dept" style="margin-top:0">Packages</h2>
    <section class="panel">${pk.length ? `<div class="table-wrap"><table><thead><tr><th>Package</th><th>Stream</th><th>Status</th><th class="n">Checklist</th><th></th></tr></thead><tbody>
      ${pk.map((p) => `<tr class="click" data-action="package" data-id="${p.id}"><td>${esc(p.name)}<span class="sub">Created ${p.created}</span></td><td class="muted">${sname(p.stream)}</td><td>${/Live|Built/.test(p.status) ? `<span class="pill pos">${p.status}</span>` : `<span class="pill acc">${p.status}</span>`}</td><td class="n">${p.checklist.filter((c) => c[1]).length} of ${p.checklist.length}</td><td class="n"><button class="btn sm" data-action="package" data-id="${p.id}">Open</button></td></tr>`).join('')}
      </tbody></table></div>` : U.empty('No packages yet', 'Build one from an Offer Lab draft.', '<a class="btn" href="#offers">Go to Offers</a>')}</section>
    <h2 class="dept">Live in HighLevel</h2>
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Funnel</th><th>Goal</th><th>Stream</th><th class="n">Visits, 30 d</th><th class="n">Conversion</th><th>Status</th><th></th></tr></thead><tbody>
    ${St.s.funnels.map((f) => `<tr><td>${esc(f.name)}<span class="sub">${f.pages} pages</span></td><td class="muted">${esc(f.goal)}</td><td class="muted">${sname(f.stream)}</td><td class="n">${f.visits ? int(f.visits) : U.MINUS}</td><td class="n">${f.visits ? pct(f.conv, 1) : U.MINUS}</td><td>${f.status === 'live' ? '<span class="pill pos">Live</span>' : `<span class="pill acc">${f.status === 'package' ? 'Being built' : esc(f.status)}</span>`}</td><td class="n"><button class="btn sm" data-action="hl" data-what="funnel ${esc(f.name)}">${icon('out')}HighLevel</button></td></tr>`).join('')}
    </tbody></table></div></section>`;
  };
  V.funnels.after = () => { if (VS.pkg) { const id = VS.pkg; VS.pkg = null; ACT.package({ dataset: { id } }); } };
  ACT.package = (el, e) => {
    if (e) e.stopPropagation();
    const p = St.s.packages.find((x) => x.id === el.dataset.id);
    U.drawer(`<div><p class="meta">Funnel package · ${sname(p.stream)}</p><h2>${esc(p.name)}</h2></div>
      <div class="dsec"><h3>Sales page copy</h3>${p.page.map(([h, t]) => `<div class="block"><span class="meta">${h}</span><p class="doc">${esc(t)}</p></div>`).join('')}</div>
      <div class="grid2"><div class="well"><span class="meta">Order bump · ${eur(p.bump.price)}</span><p><b>${esc(p.bump.name)}</b></p><p class="muted">${esc(p.bump.copy)}</p></div><div class="well"><span class="meta">Upsell · ${eur(p.upsell.price)}</span><p><b>${esc(p.upsell.name)}</b></p><p class="muted">${esc(p.upsell.copy)}</p></div></div>
      <div class="dsec"><h3>Email sequence</h3><div class="rows">${p.emails.map(([d, s, n]) => `<div class="row"><span class="time">${d}</span><div class="grow"><div class="t">${esc(s)}</div><div class="s">${esc(n)}</div></div></div>`).join('')}</div></div>
      <div class="dsec"><h3>AI Studio prompt</h3><p class="well doc small">${esc(p.prompt)}</p><div class="actions" style="margin-top:10px"><button class="btn sm" data-action="copy-prompt" data-id="${p.id}">${icon('copy')}Copy prompt</button></div></div>
      <div class="dsec"><h3>Setup in HighLevel</h3><div class="checks">${p.checklist.map(([t, on], k) => `<label class="check"><input type="checkbox" data-action="check" data-id="${p.id}" data-k="${k}" ${on ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div></div>
      <div class="actions"><button class="btn primary" data-action="hl" data-what="funnel builder">${icon('out')}Open in HighLevel</button></div>`, { label: 'Funnel package', wide: true });
  };
  ACT['copy-prompt'] = (el) => U.copy(St.s.packages.find((x) => x.id === el.dataset.id).prompt);
  ACT.check = (el, e) => { e.stopPropagation(); St.A.checkStep(el.dataset.id, +el.dataset.k, el.checked); const p = St.s.packages.find((x) => x.id === el.dataset.id); if (p.status === 'Built in HighLevel') U.toast('All steps done. Marked as built.'); window.App.render(true); };
})();

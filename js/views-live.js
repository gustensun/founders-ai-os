// Founders AI OS private workspace: real account, no sample data. Every screen says what feeds it.
(() => {
  const U = window.UI, V = window.V, ACT = window.ACT;
  const { esc, icon } = U;

  const SOURCES = {
    highlevel: ['HighLevel', 'Contacts, payments, subscriptions, calendars and pipelines. Conversations are never read. Read first, approved drafts written back.'],
    youtube: ['YouTube', 'Channel analytics, video stats and outliers for your own channel.'],
    'youtube-2': ['Second YouTube channel', 'The same reads for a second channel you own.'],
    gcal: ['Google Calendar', 'Upcoming calls, so every meeting gets a dossier.'],
    instagram: ['Instagram', 'Followers, reach, engagement and audience, read through HighLevel.'],
    linkedin: ['LinkedIn', 'Your profile and recent posts.'],
    x: ['X', 'Followers and recent posts with impressions.'],
    tiktok: ['TikTok', 'Followers, likes and views per video.'],
    zoom: ['Zoom', 'Cloud recordings and transcripts for the Call Coach.'],
    fathom: ['Fathom', 'Call summaries and action items.'],
    granola: ['Granola', 'Meeting notes from Granola.'],
    meet: ['Google Meet', 'Meet transcripts saved in Drive.'],
    gdrive: ['Google Drive', 'Offer docs, scripts and SOPs from the folder you choose.'],
    notion: ['Notion', 'Pages shared with the integration.'],
    stripe: ['Stripe', 'Payments outside HighLevel, refunds and disputes.'],
    paypal: ['PayPal', 'Payments and refunds.'],
    affiliate: ['Affiliate commissions', 'Commission exports, grouped by SubID and month.'],
    ga4: ['Google Analytics 4', 'Sessions and conversions on pages outside HighLevel.'],
    gsc: ['Search Console', 'The searches that bring people to your site.'],
    'meta-ads': ['Meta Ads', 'Spend, leads and cost per lead per campaign.'],
    'google-ads': ['Google Ads', 'Spend and conversions per campaign.'],
    tella: ['Tella', 'Recordings and drafts for content you film.'],
    perplexity: ['Perplexity', 'AI Chat on every model, web research and web watches.'],
    github: ['GitHub', 'Where the Funnel Agent pushes each sales page.'],
    vercel: ['Vercel', 'Where the Funnel Agent publishes each sales page live.'],
    openrouter: ['OpenRouter', 'Image models that draw the graphics for each sales page.'],
    'hl-webhooks': ['HighLevel workflows', 'Events your workflows send, turned into drafts.'],
    slack: ['Slack', 'Where Jarvis posts the morning brief.'],
    telegram: ['Telegram', 'Jarvis on your phone: the morning brief and alerts.'],
  };
  const FEEDS = {
    jarvis: ['highlevel', 'youtube', 'gcal'],
    revenue: ['highlevel', 'stripe', 'paypal', 'affiliate'],
    calls: ['gcal', 'zoom', 'fathom', 'granola', 'meet', 'highlevel'],
    approvals: ['highlevel', 'hl-webhooks'],
    brand: ['youtube', 'instagram', 'linkedin', 'x', 'tiktok'],
    content: ['youtube', 'tella', 'instagram', 'tiktok'],
    offers: ['highlevel', 'stripe'],
    funnels: ['ga4', 'gsc', 'meta-ads', 'google-ads', 'highlevel'],
    agents: ['highlevel', 'youtube', 'gcal'],
    brain: ['gdrive', 'notion', 'fathom', 'granola', 'zoom'],
    data: Object.keys(SOURCES),
    score: ['highlevel', 'youtube', 'affiliate', 'ga4'],
  };
  const WHAT = {
    revenue: 'All four streams side by side: software, services, products and affiliate, traced to the content and calls that drove them.',
    calls: 'Every booked call with a dossier before it and a coaching read after it.',
    approvals: 'Drafts your agents finish: follow-ups, offers, scripts and posts. Nothing sends until you approve it.',
    brand: 'Your channel read like a business: outliers, retention, and the leads and buyers each video created.',
    content: 'Ideas scored every night from outliers, comments, calls and revenue, on a board you film from.',
    offers: 'Your offer ladder with conversion and revenue per offer, plus gaps worth filling.',
    funnels: 'Funnel and page performance read from HighLevel, with fixes ranked by revenue impact.',
    agents: 'The 15 agents that run your departments. They stay in watch mode until their sources are connected.',
    brain: 'Your voice guide, offer ladder and rubrics, learned from your videos, emails and calls.',
    data: 'Every connected source with its sync health.',
    score: 'One OS score across sales, content, offers and data, with the next move that lifts it most.',
  };
  const NAMES = { playbook: 'Playbook', access: 'Access', mcp: 'AI access', research: 'Research', creators: 'Creators', jarvis: 'Jarvis', revenue: 'Revenue', calls: 'Calls', approvals: 'Newsfeed', brand: 'Brand', content: 'Content', offers: 'Offers', funnels: 'Funnels', agents: 'Agents', brain: 'Brain', data: 'Data', score: 'Score', settings: 'Settings' };

  const statusOf = (ctx, k) => (ctx.conns.find((c) => c.provider === k) || {}).status || 'not_connected';
  const pill = (st) => st === 'connected' ? '<span class="pill pos">Connected</span>' : st === 'pending' ? '<span class="pill warn">Pending</span>' : st === 'error' ? '<span class="pill neg">Needs a fix</span>' : '<span class="pill out">Not connected</span>';
  const connRows = (ctx, keys) => `<div class="rows">${keys.map((k) => `<div class="row click" data-action="cx" data-id="${k}" tabindex="0" role="button"><span class="dot ${statusOf(ctx, k) === 'connected' ? '' : 'off'}"></span><div class="grow"><div>${SOURCES[k][0]}</div><div class="meta">${SOURCES[k][1]}</div></div>${pill(statusOf(ctx, k))}</div>`).join('')}</div>`;
  const demoBtn = (view) => ctx0().demoId ? `<button class="btn" data-action="ws-switch" data-id="${ctx0().demoId}" data-go="${view}">See it in the Demo workspace</button>` : '';
  const ctx0 = () => window.App.liveCtx();

  function greet(name) {
    const h = new Date().getHours(); const f = (name || '').split(' ')[0];
    return `${h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${f ? ', ' + esc(f) : ''}.`;
  }

  // Setup lives inside the dashboard now: a checklist on the home screen, never a wall before it.
  const has = (ctx, ...ks) => ctx.conns.some((c) => ks.includes(c.provider) && c.status === 'connected');
  const SETUP = [
    ['highlevel', 'HighLevel', 'Leads, buyers, pipeline, revenue by stream and call prep', (c) => has(c, 'highlevel'), 'data-action="ib-conn" data-id="highlevel"', '2 min'],
    ['claude', 'Claude', 'Drafts, replies and Brain builds written in your voice', (c) => has(c, 'claude'), 'data-action="cx" data-id="claude"', '1 min'],
    ['openai', 'OpenAI', 'Summaries and research write-ups on your own key', (c) => has(c, 'openai'), 'data-action="ai-conn"', '1 min'],
    ['youtube', 'YouTube', 'Outliers, content ideas and video to revenue tracing', (c) => has(c, 'youtube'), 'data-action="cx" data-id="youtube"', '1 min'],
    ['calendar', 'Google Calendar', 'A dossier before every booked call', (c) => has(c, 'calendar', 'gcal'), 'data-action="cx" data-id="gcal"', '1 min'],
  ];
  // A small side card on the home screen. It never replaces the home screen and it goes away once everything is connected or hidden.
  V.setupCard = (ctx) => {
    const rows = SETUP.map((x) => [...x, x[3](ctx)]); const done = rows.filter((r) => r[6]).length;
    if (done === rows.length || ctx.setupHidden) return '';
    const next = rows.find((r) => !r[6]);
    return `<aside class="panel setup" aria-labelledby="setup-h">
      <header><h2 id="setup-h">Connect your tools</h2><span class="setup-n"><b>${done}</b>/${rows.length}</span></header>
      <div class="setup-bar" role="progressbar" aria-label="Tools connected" aria-valuemin="0" aria-valuemax="${rows.length}" aria-valuenow="${done}">${rows.map((r) => `<span class="${r[6] ? 'on' : ''}"></span>`).join('')}</div>
      <ol class="setup-list">${rows.map((r) => `<li class="${r[6] ? 'done' : r === next ? 'is-next' : ''}" title="${r[2]}">
        <span class="setup-ck" aria-hidden="true">${r[6] ? '<svg viewBox="0 0 24 24" width="12" height="12"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <span class="setup-t">${r[1]}</span>
        ${r[6] ? '<span class="meta">Done</span>' : `<button class="btn sm ${r === next ? 'primary' : ''}" ${r[4]} aria-label="Connect ${r[1]}">Connect</button>`}
      </li>`).join('')}</ol>
      <footer class="setup-f"><button class="linkish" data-action="setup-hide">Hide</button></footer>
    </aside>`;
  };
  ACT['setup-hide'] = async () => { await window.App.hideSetup(true); window.App.render(); U.toast('Hidden. Connect the rest any time from Connections.'); };

  V.live = (view) => {
    if (V[view] && V[view].live) return V[view].live();
    const ctx = ctx0();
    const connected = ctx.conns.filter((c) => c.status === 'connected').length;
    if (view === 'jarvis') {
      const side = V.setupCard(ctx);
      return `<div class="lv-home${side ? ' has-side' : ''}"><div class="lv-main"><section class="lv-hero has-orb"><div class="lv-copy">
        <h1 class="lv-h">${greet(ctx.name)}</h1>
        <p class="home-meta"><span class="dot"></span>${esc(ctx.ws.name)} · private</p>
        <p class="lv-sub">${connected ? `${connected} of ${Object.keys(SOURCES).length} sources connected. Jarvis reads them every morning.` : 'Your private workspace is ready and empty on purpose. Nothing here is sample data. Connect a source and Jarvis starts reading your real business.'}</p>
        <div class="lv-actions"><button class="btn primary" data-action="go" data-go="connect">Connect your sources</button><button class="btn" data-action="voice-open">${icon('mic')}<span>Talk to Jarvis</span></button>${demoBtn('jarvis')}</div>
        <div class="vc-slot"></div>
      </div>${window.JarvisOrb ? window.JarvisOrb.html('lv-orb') : ''}</section>
      <div class="grid2">
        <section class="panel"><header><h2>Start here</h2><span class="meta">In this order</span></header>${connRows(ctx, ['highlevel', 'youtube', 'gcal'])}</section>
        <section class="panel"><header><h2>What switches on</h2></header><div class="rows">
          ${[['HighLevel', 'Revenue by stream, hot contacts, client health, call dossiers'], ['YouTube', 'Outliers, content scoring and video to revenue tracing'], ['Gmail and Calendar', 'Morning brief, follow-up drafts and meeting prep'], ['All four', 'The OS score and the full morning cycle']].map(([a, b]) => `<div class="row"><div class="grow"><div>${a}</div><div class="meta">${b}</div></div></div>`).join('')}
        </div></section>
      </div></div>${side}</div>`;
    }
    if (view === 'settings') return V.liveSettings();
    const feeds = FEEDS[view] || [];
    const C2 = window.Conn;
    const live = C2 ? feeds.filter((k) => k !== 'highlevel' && /^(connected|error)$/.test(statusOf(ctx, k))) : [];
    if (live.length) {
      const rest = feeds.filter((k) => !live.includes(k) && statusOf(ctx, k) !== 'connected');
      return `${U.title(NAMES[view] || 'Workspace', WHAT[view] || '')}
        <div class="grid2 lv-feeds">${live.map((k) => { const m = C2.meta(k); const f = C2.feed(k, { items: 6 }); return `<section class="panel"><header><h2>${esc(SOURCES[k][0])}</h2><button class="btn sm ghost" data-action="cx" data-id="${k}">${m.last_sync_at ? 'Synced ' + esc(C2.ago(m.last_sync_at)) : 'Details'}</button></header>${m.sync_error ? `<p class="auth-msg">${esc(m.sync_error)}</p>` : ''}${f || '<p class="muted">Connected. The first read has not finished yet.</p>'}</section>`; }).join('')}</div>
        ${rest.length ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Also feeds this screen</h2></header>${connRows(ctx, rest.slice(0, 6))}</section>` : ''}`;
    }
    return `${U.title(NAMES[view] || 'Workspace', WHAT[view] || '')}
      <section class="panel lv-empty">
        <div class="lv-empty-head"><span class="lv-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 1.5C12.8 7.7 16.3 11.2 22.5 12C16.3 12.8 12.8 16.3 12 22.5C11.2 16.3 7.7 12.8 1.5 12C7.7 11.2 11.2 7.7 12 1.5Z" fill="currentColor"/><circle cx="19.2" cy="4.8" r="1.9" fill="var(--accent)"/></svg></span>
        <div><h2>No data here yet</h2><p class="muted">${esc(NAMES[view])} fills in from ${feeds.map((k) => SOURCES[k][0]).slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Connect ${feeds.length > 1 ? 'them' : 'it'} and this screen reads your real numbers.</p></div></div>
        ${connRows(ctx, feeds.slice(0, 6))}
        <div class="lv-actions"><button class="btn primary" data-action="go" data-go="connect">Open connections</button>${demoBtn(view)}</div>
      </section>`;
  };

  // Danger zone: permanent account deletion, gated by typing "delete". Admin accounts cannot delete themselves here.
  const dangerZone = () => {
    const admin = window.App && window.App.isAdmin && window.App.isAdmin();
    return `<section class="panel dz" aria-labelledby="dz-h"><header><h2 id="dz-h">Danger zone</h2></header>
      <div class="dz-box">
        <div class="dz-copy"><div class="dz-t">Delete account</div>
          <p class="meta">Permanently deletes your login and every workspace you own, including your Brain, DNA, calls, content, funnels, Programs, connections and uploaded files. This cannot be undone.</p></div>
        ${admin ? '<p class="meta dz-note">Admin accounts cannot be deleted from Settings.</p>' : `<form class="dz-form" data-form="account-delete" autocomplete="off">
          <label class="field"><span>Type <b>delete</b> to confirm</span><input name="confirm" data-dz-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="delete" aria-describedby="dz-h"></label>
          <button class="btn danger" type="submit" data-dz-go disabled>Delete account</button>
        </form>`}
      </div>
    </section>`;
  };

  V.liveSettings = () => {
    const ctx = ctx0();
    return `${U.title('Settings', 'Your account, workspaces and connections.')}
    <div class="grid2">
      <section class="panel"><header><h2>Account</h2></header><form class="form" data-form="account">
        <label class="field"><span>Name</span><input name="full_name" value="${esc(ctx.name)}" required maxlength="80"></label>
        <label class="field"><span>Email</span><input value="${esc(ctx.email)}" disabled></label>
        <div><button class="btn primary" type="submit">Save</button></div>
      </form></section>
      <section class="panel"><header><h2>Workspaces</h2><span class="meta">Same login, separate data</span></header><div class="rows">
        ${ctx.workspaces.map((w) => `<div class="row"><span class="dot ${w.id === ctx.ws.id ? '' : 'off'}"></span><div class="grow"><div>${esc(w.name)}</div><div class="meta">${w.kind === 'demo' ? 'Sample business, safe to explore and present' : 'Private. Your real data only'}</div></div>${w.id === ctx.ws.id ? '<span class="pill">Current</span>' : `<button class="btn sm" data-action="ws-switch" data-id="${w.id}">Switch</button>`}</div>`).join('')}
      </div></section>
    </div>
    <section class="panel"><header><h2>Connections</h2><span class="meta">${ctx.conns.filter((c) => c.status === 'connected').length} of ${Object.keys(SOURCES).length} connected</span></header>
      ${connRows(ctx, Object.keys(SOURCES))}
      <p class="meta" style="margin-top:14px">Click any source to connect, sync or disconnect it. Each one is read-only unless it says otherwise, keys are stored encrypted on the server, and everything syncs again every morning.</p>
    </section>
    ${setupPanel()}
    ${dangerZone()}`;
  };
  // Admins only: which install settings are in place, and how to add the rest.
  function setupPanel() {
    const st = window.App && window.App.setup ? window.App.setup() : null;
    if (!st || !st.admin || !Array.isArray(st.checks)) return '';
    const open = st.checks.filter((c) => !c.ok).length;
    return `<section class="panel"><header><h2>Setup check</h2><span class="meta">${open ? open + ' to finish' : 'All set'} · only admins see this</span></header><div class="rows">
      ${st.checks.map((c) => `<div class="row"><span class="dot ${c.ok ? '' : 'off'}"></span><div class="grow"><div>${esc(c.label)} <span class="meta">${esc(c.need)}</span></div><div class="meta">${c.ok ? 'In place' : esc(c.fix)}</div></div>${c.ok ? '<span class="pill">Ready</span>' : `<a class="btn sm" href="${esc(c.href)}" target="_blank" rel="noopener">Open</a>`}</div>`).join('')}
    </div><p class="meta" style="margin-top:14px">Time zone for daily briefs: ${esc(st.timezone || 'UTC')}. Change FOS_TZ in Vercel to move it.</p></section>`;
  }
})();

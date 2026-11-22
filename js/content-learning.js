// An inspectable learning view inside Content. No separate approval queue.
(() => {
  const U = window.UI, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const live = () => !!window.App?.isLive();
  const workspace = () => live() ? window.App.liveCtx().ws?.id : 'demo';
  const S = { ws: null, data: null, at: 0, busy: false, changing: false, error: '', pending: null, retry: null, ticket: 0, focus: null };
  const showing = () => VS.view === 'content' && VS.bView === 'learning';
  const number = (n) => n === null || n === undefined || !Number.isFinite(Number(n)) ? 'Not available' : Number(n).toLocaleString('en-US');
  const when = (t) => Number.isFinite(Date.parse(t)) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not recorded';
  const url = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const actionName = { approve: 'Approved', pass: 'Passed', dismiss: 'Not now', edit: 'Edited' };
  function render() {
    if (!showing()) return;
    const active = document.activeElement, focused = active?.dataset;
    const action = focused?.action, key = focused?.key;
    if (action?.startsWith('cl-')) S.focus = { action, key };
    else if (active && active !== document.body && active.id !== 'canvas') S.focus = null;
    const target = S.focus;
    window.App.render(true);
    if (target) {
      const control = [...document.querySelectorAll('.content-learning [data-action]')].find((e) => e.dataset.action === target.action && (!target.key || e.dataset.key === target.key));
      if (control && !control.disabled && control.getClientRects().length) control.focus({ preventScroll: true });
      else if (!S.busy && !S.changing) document.querySelector('#cl-heading')?.focus({ preventScroll: true });
    }
    if (!S.busy && !S.changing) S.focus = null;
  }
  function reset() {
    const id = workspace();
    if (S.ws !== id) Object.assign(S, { ws: id, data: null, at: 0, busy: false, changing: false, error: '', pending: null, retry: null, ticket: S.ticket + 1, focus: null });
    return id;
  }
  async function api(action, body = {}, ws = workspace()) {
    const session = await window.Auth.session();
    if (!session) throw new Error('Sign in again to read content learning.');
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch('/api/learning', { method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ ...body, action, workspace_id: ws }) });
      let j; try { j = await r.json(); } catch { throw new Error('Content learning could not be reached. Try again.'); }
      if (!r.ok) throw new Error(j.error || 'Content learning could not be read. Try again.');
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Content learning took too long to respond. Your decisions are safe. Try again.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  function load(force = false) {
    const id = reset();
    if (!live() || !id) return Promise.resolve();
    if (S.changing) return Promise.resolve(S.data);
    if (S.busy) return S.pending;
    if (!force && Date.now() - S.at < 60000) return Promise.resolve(S.data);
    S.busy = true;
    const ticket = ++S.ticket, current = () => workspace() === id && S.ws === id && S.ticket === ticket;
    S.pending = api('read', {}, id).then((data) => {
      if (!current()) return;
      S.data = data; S.error = ''; S.retry = null; S.at = Date.now(); return data;
    }).catch((e) => { if (current()) { S.error = e.message; S.retry = null; S.at = Date.now(); } })
      .finally(() => { if (current()) { S.busy = false; S.pending = null; render(); } });
    return S.pending;
  }
  async function change(action, body) {
    const id = reset();
    if (!live() || S.changing || S.busy) return false;
    const ticket = ++S.ticket, current = () => workspace() === id && S.ws === id && S.ticket === ticket;
    S.changing = true; S.error = ''; S.retry = null; render();
    try {
      const data = await api(action, body, id);
      if (!current()) return false;
      S.data = data; S.at = Date.now();
      U.toast(action === 'settings' ? data.settings.enabled ? 'Learning resumed' : 'Learning paused. Your content is unchanged.'
        : body.muted ? 'Observation ignored' : 'Observation restored');
      return true;
    } catch (e) { if (current()) { S.error = e.message; S.retry = { ws: id, action, body: { ...body } }; } return false; }
    finally { if (current()) { S.changing = false; render(); } }
  }
  function demo() {
    return { settings: { enabled: true, muted_keys: [] }, stats: { approved: 0, passed: 0, dismissed: 0, decisions: 0, edits: 0, measured: 0, comparable: 0 },
      insights: [], followups: [], recent: [], measurements: [], generated_at: null };
  }
  function item(key) { return [...(S.data?.insights || []), ...(S.data?.followups || [])].find((s) => s.key === key); }
  function controls(x) {
    return `<div class="cl-row-actions"><button class="btn sm ghost" data-action="cl-detail" data-key="${esc(x.key)}" aria-label="Inspect ${esc(x.title)}">Inspect${icon('chevron')}</button>
      ${live() ? `<button class="btn sm ghost" data-action="cl-mute" data-key="${esc(x.key)}" data-muted="${!x.muted}" ${S.changing ? 'disabled' : ''} aria-label="${x.muted ? 'Restore' : 'Ignore'} ${esc(x.title)}">${x.muted ? 'Restore' : 'Ignore'}</button>` : ''}</div>`;
  }
  function row(x, followup = false) {
    return `<article class="cl-row"><div class="cl-row-copy"><h3>${esc(x.title)}</h3><p>${esc(followup
      ? `${number(x.views)} cumulative views, ${Number(x.ratio).toFixed(1)}x the median of ${x.peer_count} similarly aged pieces. A follow-up to test, not a new rule.`
      : x.summary)}</p><span class="cl-meta">${esc(followup ? x.source === 'manual' ? 'Self-reported numbers' : 'Connected YouTube data' : x.confidence)}${x.account_name ? ' · ' + esc(x.account_name) : ''}${followup ? ' · Measured ' + esc(when(x.observed_at)) : ' · ' + number(x.sample_size) + ' pieces'}${x.muted ? ' · Ignored' : !S.data?.settings.enabled ? ' · Paused' : ''}</span></div>${controls(x)}</article>`;
  }
  function view() {
    reset();
    if (live()) load();
    const d = live() ? S.data : demo(), stats = d?.stats || {};
    const busy = S.busy || S.changing;
    if (!d) return `<section class="content-learning" aria-busy="${S.busy}"><div class="cl-loading" role="${S.error ? 'alert' : 'status'}">${S.error ? esc(S.error) : U.spin + 'Reading your decisions and available results'}</div>
      ${S.error ? '<button class="btn" data-action="cl-retry">Try again</button>' : ''}</section>`;
    const on = d.settings.enabled, insights = d.insights.filter((x) => !x.muted), followups = d.followups.filter((x) => !x.muted);
    const ignored = [...d.insights, ...d.followups].filter((x) => x.muted);
    const known = new Set(ignored.map((x) => x.key));
    const previous = d.settings.muted_keys.filter((k) => !known.has(k));
    return `<section class="content-learning" aria-labelledby="cl-heading" aria-busy="${busy}">
      <header class="cl-head"><div><h2 id="cl-heading" tabindex="-1">Learning from your content</h2><p>Your choices, edits and results help shape the next draft. Your Brand DNA stays yours.</p></div>
        ${live() ? `<div class="cl-actions"><button class="btn sm ghost" data-action="cl-refresh" ${busy ? 'disabled' : ''}>${S.busy ? U.spin : icon('refresh')}Refresh learning</button><button class="btn sm" data-action="cl-toggle" ${busy ? 'disabled' : ''}>${on ? 'Pause learning' : 'Resume learning'}</button></div>` : '<span class="meta">Local sample workspace</span>'}</header>
      ${S.error ? `<div class="cl-error" role="alert"><p>${esc(S.error)}</p><button class="btn sm" data-action="cl-retry" ${busy ? 'disabled' : ''}>${S.retry ? 'Retry save' : 'Try again'}</button></div>` : ''}
      <p class="cl-state" role="status">${on ? 'Learning is on. Active observations guide future ideas and content drafts.' : 'Learning is paused. New decisions are not recorded and learning is not used in new drafts.'}</p>
      <ul class="cl-counts" aria-label="Learning evidence"><li><strong>${number(stats.decisions || 0)}</strong> reviewed ideas</li><li><strong>${number(stats.edits || 0)}</strong> pieces you edited</li><li><strong>${number(stats.measured || 0)}</strong> measured pieces</li><li><strong>${number(stats.comparable || 0)}</strong> ready to compare</li></ul>
      <div class="cl-sections">
        <section class="cl-section"><h2>What you prefer</h2><p class="cl-intro">Repeated approvals, passes and manual edits from the last 90 days. These are editorial preferences, not audience results.</p>
          ${insights.filter((x) => x.type !== 'performance').map((x) => row(x)).join('') || `<div class="cl-empty"><h3>${stats.decisions || stats.edits ? 'Still looking for a repeated preference' : 'Start with your next decision'}</h3><p>Approve or pass on ideas as you work. Save your edits on the Content board. A pattern needs at least three different pieces before it guides new drafts.</p><button class="btn sm" data-action="cl-board">Review content ideas${icon('arrow')}</button></div>`}</section>
        <section class="cl-section"><h2>What your audience responds to</h2><p class="cl-intro">We compare the same account, platform and format at similar ages. One strong video is a follow-up candidate, not a rule for everything you create.</p>
          ${insights.filter((x) => x.type === 'performance').map((x) => row(x)).join('')}${followups.map((x) => row(x, true)).join('') || (!insights.some((x) => x.type === 'performance') ? `<div class="cl-empty"><h3>${stats.measured ? 'Building a fair comparison' : 'Bring in your first results'}</h3><p>${stats.measured ? 'The available readings do not yet show a clear follow-up candidate. Each piece needs three similarly aged peers, enough views and fresh numbers.' : 'Connect YouTube for automatic readings, or add your published content and its numbers to the Content board. Missing metrics are never guessed.'}</p>${!stats.measured ? '<a class="btn sm" href="#connect">Open Connections</a>' : ''}</div>` : '')}</section>
      </div>
      ${ignored.length || previous.length ? `<details class="cl-disclosure"><summary>Ignored observations <span>${ignored.length + previous.length}</span></summary>${ignored.map((x) => row(x, !!x.ratio)).join('')}${previous.map((key) => `<div class="cl-row"><div class="cl-row-copy"><h3>Earlier observation</h3><p>This observation is no longer supported by the current evidence. Its ignore setting is still saved.</p></div><button class="btn sm ghost" data-action="cl-mute" data-key="${esc(key)}" data-muted="false" ${busy ? 'disabled' : ''}>Clear ignore setting</button></div>`).join('')}</details>` : ''}
      <details class="cl-disclosure"><summary>Recent decisions and edits <span>${d.recent.length}</span></summary><div class="cl-activity">
        ${d.recent.map((e) => `<button class="cl-activity-row" data-action="cl-event" data-id="${esc(e.id)}"><span>${esc(actionName[e.action] || e.action)}</span><span>${esc(e.title)}</span><time>${esc(when(e.at))}</time>${icon('chevron')}</button>`).join('') || '<p class="cl-intro">New decisions will appear here. Past approvals and edits are not invented or reconstructed.</p>'}</div></details>
      <details class="cl-disclosure"><summary>Tracked results <span>${number(stats.measured || 0)}</span></summary><p class="cl-intro">${stats.last_metrics_at ? 'Latest source reading: ' + esc(when(stats.last_metrics_at)) + '. Refresh learning uses saved source readings; sync Connections to fetch new platform numbers.' : 'No saved readings yet.'}</p>
        ${d.measurements.map((m) => `<article class="cl-measure"><div><h3>${url(m.url) ? `<a href="${esc(url(m.url))}" target="_blank" rel="noopener noreferrer">${esc(m.title)}</a>` : esc(m.title)}</h3><p>${esc(m.comparison || m.note || '')}</p><span class="cl-meta">${m.source === 'manual' ? 'Self-reported' : 'Connected YouTube'} · Measured ${esc(when(m.observed_at))}</span></div><span class="cl-number">${number(m.views)}<small>views</small></span></article>`).join('')}</details>
      <details class="cl-disclosure"><summary>How learning works</summary><ul class="cl-method"><li>Three distinct pieces are needed for an editorial pattern. Timing, effort and “done it before” passes do not suppress an entire topic.</li><li>Only edits you save yourself count as editing preferences. AI drafts, number refreshes and date changes do not.</li><li>Results need three similarly aged peers, fresh measurements and enough views. Short videos, long videos, platforms and accounts stay separate.</li><li>Views, likes and comments do not establish sales, retention or click-through. Self-reported numbers stay separate from connected data.</li><li>Ignore any observation to keep it out of future generation. Pausing stops new decision capture and removes learning from generation.</li><li>Learning provides context to your models. It does not retrain them, change approved facts, publish a post or send an email.</li></ul></details>
      <footer class="cl-foot">Used by morning ideas, remixes and content drafting. ${d.generated_at ? 'Reviewed ' + esc(when(d.generated_at)) + '.' : 'Sample workspace controls do not save to an account.'}</footer>
    </section>`;
  }
  function evidence(e) {
    const link = url(e.url);
    const metric = e.type === 'performance';
    return `<article class="cl-evidence"><h3>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>` : esc(e.title)}</h3>
      <p class="cl-meta">${metric ? `${e.source === 'manual' ? 'Self-reported' : 'Connected YouTube'}${e.account_name ? ' · ' + esc(e.account_name) : ''} · Measured ${when(e.observed_at)}` : `${esc(actionName[e.action] || e.action)} · ${when(e.at)}`}</p>
      ${metric ? `<dl class="cl-evidence-numbers"><div><dt>Views</dt><dd>${number(e.views)}</dd></div><div><dt>Likes</dt><dd>${number(e.likes)}</dd></div><div><dt>Comments</dt><dd>${number(e.comments)}</dd></div></dl>${e.ratio ? `<p>${Number(e.ratio).toFixed(1)}x the median of ${number(e.peer_count)} peers (${number(e.peer_median)} views).</p><p>${esc(e.comparison || '')}</p>` : `<p>${esc(e.note || '')}</p>`}` : e.reason ? `<p>${esc(e.reason)}</p>` : ''}
      ${e.peers?.length ? `<details class="cl-disclosure"><summary>Comparison group</summary>${e.peers.map((p) => `<p>${url(p.url) ? `<a href="${esc(url(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>` : esc(p.title)}<br><span class="cl-meta">${number(p.views)} views · ${Math.round(p.age_days)} days old when measured on ${esc(when(p.observed_at))}</span></p>`).join('')}${e.peer_count > e.peers.length ? `<p class="cl-meta">Showing ${e.peers.length} of ${e.peer_count} comparison pieces.</p>` : ''}</details>` : ''}
      ${e.before && e.after ? `<div class="cl-diff">${[['Before your edit', e.before], ['Your saved version', e.after]].map(([label, value]) => `<section><h4>${label}</h4>${['title', 'hook', 'body', 'caption'].filter((k) => value[k] && e.before[k] !== e.after[k]).map((k) => `<p class="cl-diff-label">${esc({ title: 'Title', hook: 'Opening', body: 'Body', caption: 'Caption' }[k])}</p><div class="cl-diff-text">${esc(value[k])}</div>`).join('') || '<p class="cl-meta">Text removed in this version.</p>'}</section>`).join('')}</div>` : ''}
      ${e.content_id ? `<button class="btn sm" data-action="cl-piece" data-id="${esc(e.content_id)}">Open on Content board${icon('arrow')}</button>` : ''}</article>`;
  }
  ACT['cl-detail'] = (el) => {
    const x = item(el.dataset.key); if (!x) return;
    const followup = !!x.ratio;
    U.drawer(`<div class="cl-detail"><h2>${esc(x.title)}</h2><p>${esc(x.summary || 'A possible follow-up based on your own measured results. Test a new angle rather than repeating the original.')}</p>
      <p class="cl-meta">${x.muted ? 'Ignored in future generation' : S.data.settings.enabled ? x.type === 'editing' ? 'Available to guide draft style' : 'Available to future ideas and content drafts' : 'Learning is paused'}</p>
      <section class="dsec"><h3>Evidence you can check</h3>${(followup ? [x] : x.evidence || []).map(evidence).join('')}</section>
      <p class="cl-intro">This does not change your Brand DNA or approved writing rules. New drafts still need your review.</p>
      ${live() ? `<button class="btn" data-action="cl-detail-mute" data-key="${esc(x.key)}" data-muted="${!x.muted}" ${S.changing ? 'disabled' : ''}>${x.muted ? 'Restore observation' : 'Ignore observation'}</button>` : ''}</div>`, { label: 'Content learning evidence', wide: true });
  };
  ACT['cl-event'] = (el) => {
    const e = S.data?.recent.find((x) => x.id === el.dataset.id); if (!e) return;
    U.drawer(`<div class="cl-detail"><h2>${esc(actionName[e.action] || 'Saved decision')}</h2>${evidence(e)}<p class="cl-intro">One decision is evidence, not a permanent rule. Repeated patterns are reviewed in Learning.</p></div>`, { label: 'Saved content decision', wide: true });
  };
  ACT['cl-piece'] = async (el) => { try { await window.OSBoard.open(el.dataset.id); } catch (e) { U.toast(e.message); } };
  ACT['cl-open'] = () => { U.closeDrawer(); VS.bView = 'learning'; VS.view = 'content'; location.hash = '#content'; window.App.render(true); };
  ACT['cl-board'] = () => { VS.bView = 'board'; window.App.render(true); };
  ACT['cl-refresh'] = () => { const p = load(true); render(); return p; };
  ACT['cl-retry'] = () => {
    const id = reset(), retry = S.retry;
    return retry?.ws === id ? change(retry.action, retry.body) : ACT['cl-refresh']();
  };
  ACT['cl-toggle'] = () => change('settings', { enabled: !S.data?.settings.enabled });
  ACT['cl-mute'] = (el) => change('mute', { key: el.dataset.key, muted: el.dataset.muted === 'true' });
  ACT['cl-detail-mute'] = async (el) => {
    el.disabled = true;
    const saved = await change('mute', { key: el.dataset.key, muted: el.dataset.muted === 'true' });
    if (!saved) { el.disabled = false; if (S.error) U.toast(S.error); } else U.closeDrawer();
  };
  window.ContentLearning = { view, load, reset: () => Object.assign(S, { ws: null, data: null, at: 0, busy: false, changing: false, error: '', pending: null, retry: null, ticket: S.ticket + 1, focus: null }), invalidate: () => { S.at = 0; } };
})();

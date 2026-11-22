// Revenue in a private workspace: Demo by default (safe for tutorials and screen shares), Live on request.
// Demo reuses the sample Revenue screen in US dollars, scaled to about $51,273 a month.
// Live reads HighLevel payments, Stripe and affiliate commissions through /api/inbox (action "revenue"),
// merged and summarised server side so a charge HighLevel took through Stripe is counted once.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT, C = window.Charts;
  const { esc, int, pct, title, kpis } = U;
  const DEMO_MONTH = 51273;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cache = { at: 0, data: null, err: null, busy: false, ws: null };

  const fmt = (cur, dp = 0) => { const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp }); return (v) => f.format(Math.round((+v || 0) * 10 ** dp) / 10 ** dp); };
  const usd = fmt('USD');
  let factor = null;
  const demoFactor = () => { if (factor) return factor; const m = St.monthly(3); const avg = m.reduce((s, x) => s + x.total, 0) / m.length; factor = avg ? DEMO_MONTH / avg : 1; return factor; };
  const mode = () => VS.revMode || 'demo';
  const modeSeg = () => '<button class="btn ghost" data-action="aff-open">Affiliate bonuses</button>' + U.seg('revMode', mode(), [['demo', 'Demo'], ['live', 'Live']]);
  const ctx = () => window.App.liveCtx();
  const hlOn = () => (ctx().conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected');
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d < 8 ? d + 'd ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const monthLabel = (k) => MON[+k.slice(5) - 1] + (k.endsWith('-01') ? ' ' + k.slice(2, 4) : '');

  function demo() {
    const f = demoFactor(); const money = (v) => usd(v * f);
    return V.revenue({
      money, unit: 'US dollars', monthly: true,
      sub: 'Every dollar across software, services, products and affiliate, read from HighLevel payments and Stripe.',
      actions: modeSeg(),
      note: `<p class="rev-note"><span class="pill acc">Demo data</span><span>Sample numbers, safe for tutorials and screen shares. ${anyOn() ? 'Switch to Live for your real numbers.' : 'Connect HighLevel or Stripe and switch to Live for your real numbers.'}</span></p>`,
    });
  }

  async function load(force) {
    const ws = ctx().ws.id;
    if (cache.busy || (!force && cache.ws === ws && cache.data && Date.now() - cache.at < 5 * 6e4)) return;
    cache.busy = true; cache.err = null; cache.ws = ws;
    try { cache.data = await window.Auth.inboxApi('revenue', { workspace_id: ws, months: 12 }); cache.at = Date.now(); }
    catch (e) { cache.err = e.message || 'Revenue could not be read'; }
    cache.busy = false;
    if (mode() === 'live' && (location.hash || '').slice(1) === 'revenue') window.App.render();
  }

  // Sources that are synced in Connections but not added to the totals: they are balances or books, or cannot be matched to a payment yet.
  const OUT = [['paypal', 'PayPal'], ['bank', 'Bank'], ['accounting', 'Accounting']];
  function outside() {
    const C2 = window.Conn; if (!C2) return '';
    const on = OUT.filter(([k]) => C2.on(k) || (C2.row(k) && C2.row(k).status === 'error'));
    if (!on.length) return '';
    return `<h2 class="out" style="margin:var(--gap) 0 12px">Not added to the totals</h2><div class="grid2">${on.map(([k, n]) => { const m = C2.meta(k); return `<section class="panel"><header><h2>${n}</h2><button class="btn sm ghost" data-action="cx" data-id="${k}">${m.last_sync_at ? 'Synced ' + esc(C2.ago(m.last_sync_at)) : 'Details'}</button></header>${m.sync_error ? `<p class="auth-msg">${esc(m.sync_error)}</p>` : ''}${C2.feed(k, { items: 5 }) || '<p class="muted">Nothing read yet.</p>'}</section>`; }).join('')}</div>`;
  }
  const connOn = (k) => !!(window.Conn && window.Conn.on(k));
  const anyOn = () => hlOn() || connOn('stripe') || connOn('affiliate');
  const day = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; };
  const VIA = { highlevel: 'HighLevel', stripe: 'Stripe', affiliate: 'Affiliate' };
  const STREAM_SUB = { highlevel: 'Funnel orders, invoices and subscriptions', stripe: 'Payments taken outside this HighLevel sub-account', affiliate: 'Commissions from HighLevel postbacks' };
  const CONNECT = { highlevel: ['ib-conn', 'Connect'], stripe: ['cx', 'Connect'], affiliate: ['aff-open', 'Set up postbacks'] };

  // Where the affiliate number comes from: commission postbacks, the uploaded export, or both.
  function affSub(x) {
    const pb = x.postbacks || {}; const exp = x.as_of ? esc(day(x.as_of)) : '';
    if (pb.last_commission) return `Live from HighLevel postbacks, last commission ${esc(ago(pb.last_commission))}${exp ? `, plus your export up to ${exp}` : ''}`;
    if (pb.wired) return exp ? `Export up to ${exp}. Postbacks add new commissions as they come in` : 'Postbacks are set up. Waiting for the first commission';
    return exp ? `From your export, read ${exp}. Add the New Commission postback to keep it current` : STREAM_SUB.affiliate;
  }

  function affFoot(a) {
    if (!a) return '';
    const pb = a.postbacks || {}; const n = pb.after_export || 0; const exp = a.as_of ? esc(day(a.as_of)) : '';
    if (n && exp) return `Affiliate commissions are your export up to ${exp} plus the ${int(n)} commission ${n === 1 ? 'postback' : 'postbacks'} HighLevel sent since.${a.estimated ? ' Until 30 days of postbacks are in, the export part of the last 30 days is spread evenly over its dates.' : ''}`;
    if (n) return 'Affiliate commissions come from the commission postbacks HighLevel sends, so they update on their own.';
    if (pb.wired && exp) return `Affiliate commissions come from the export you uploaded on ${exp}. New commissions are added as HighLevel sends them.`;
    if (exp) return `Affiliate commissions come from the export you uploaded on ${exp}, so their last 30 days end on that date. Add the New Commission postback under Affiliate bonuses and they update on their own.`;
    return '';
  }

  // One row per stream: what it is, where it stands, and how much of the year it carried.
  function streamRows(d, money) {
    const total = d.streams.reduce((s, x) => s + (x.total || 0), 0);
    return d.streams.map((x) => {
      const dupes = x.id === 'stripe' && x.already_in_highlevel ? `${int(x.already_in_highlevel)} ${x.already_in_highlevel === 1 ? 'charge' : 'charges'} HighLevel took through Stripe ${x.already_in_highlevel === 1 ? 'is' : 'are'} counted once, under HighLevel` : '';
      const sub = x.error ? `<span class="rev-warn">${esc(x.error)}</span>` : !x.on ? 'Not connected' : x.id === 'affiliate' ? affSub(x) : dupes || STREAM_SUB[x.id];
      const off = !x.on; const [act, lab] = CONNECT[x.id];
      return `<tr><td>${esc(x.name)}<span class="sub">${sub}</span></td>${off
        ? `<td class="n" colspan="3"><button class="btn sm" data-action="${act}" data-id="${x.id}">${lab}</button></td>`
        : `<td class="n">${money(x.last30)}</td><td class="n">${money(x.total)}</td><td class="n muted">${total ? (x.total > 0 && x.total / total < 0.005 ? 'Under 1%' : pct((x.total || 0) / total)) : '0%'}</td>`}</tr>`;
    }).join('');
  }

  function live() { return live0() + outside(); }
  function live0() {
    const head = title('Revenue', 'HighLevel payments, Stripe and affiliate commissions in one place. Nothing here is sample data.', `${cache.data ? '<button class="btn" data-action="rev-reload">Refresh</button>' : ''}${modeSeg()}`);
    if (!anyOn()) return `${head}<section class="panel">${U.empty('Connect a revenue source first', 'Live revenue adds up the payments in your HighLevel sub-account, the Stripe charges HighLevel does not hold, and your affiliate commissions. One of them is enough to start.', '<div class="actions" style="margin-top:14px"><button class="btn primary" data-action="ib-conn" data-id="highlevel">Connect HighLevel</button><button class="btn" data-action="cx" data-id="stripe">Connect Stripe</button></div>')}</section>`;
    if (!cache.data && !cache.err) { load(); return `${head}<section class="panel rev-loading"><p class="muted">${U.spin}Reading your payments and commissions. The first load takes a few seconds.</p></section>`; }
    if (cache.err && !cache.data) return `${head}<section class="panel">${U.empty('Revenue did not load', esc(cache.err), '<div class="actions" style="margin-top:14px"><button class="btn" data-action="rev-reload">Try again</button></div>')}</section>`;
    const d = cache.data; const money = fmt(d.currency); const money2 = fmt(d.currency, 2);
    const streams = d.streams || []; const used = streams.filter((x) => x.on && !x.error && x.total > 0); const many = used.length > 1;
    const total12 = d.byMonth.reduce((s, m) => s + m.gross, 0);
    const full = d.byMonth.slice(0, -1); const avg = full.length ? full.reduce((s, m) => s + m.gross, 0) / full.length : 0;
    const rec12 = d.recurring12 != null ? d.recurring12 : d.byMonth.reduce((s, m) => s + m.recurring, 0);
    const pay12 = d.payments12 != null ? d.payments12 : total12;
    const delta = d.prev30 ? U.change(d.last30, d.prev30) + ' vs the 30 days before' : d.count30 + (d.count30 === 1 ? ' payment' : ' payments');
    const series = many
      ? [{ name: 'Total', values: d.byMonth.map((m) => m.gross) }, ...used.map((x) => ({ name: VIA[x.id], dash: x.id === 'affiliate', values: d.byMonth.map((m) => m[x.id] || 0) }))]
      : [{ name: 'Collected', values: d.byMonth.map((m) => m.gross) }, { name: 'Recurring', values: d.byMonth.map((m) => m.recurring) }];
    U.after(() => {
      C.line(U.$('#rl-line'), { labels: d.byMonth.map((m) => monthLabel(m.month)), series, format: money, height: 240, legend: U.$('#rl-legend') });
      C.barList(U.$('#rl-src'), d.bySource.map((s) => ({ label: s.name, value: s.amount })), { format: money });
    });
    const bad = streams.filter((x) => x.error);
    if (!d.byMonth.some((m) => m.gross) && !d.recent.length) return `${head}<section class="panel">${bad.length ? U.empty('Revenue did not load', esc(bad.map((x) => x.name + ': ' + x.error).join(' ')), '<div class="actions" style="margin-top:14px"><button class="btn" data-action="rev-reload">Try again</button></div>') : U.empty('No payments in the last 12 months', 'Your sources are connected, but none of them holds a live payment or commission yet. Demo mode shows what this page looks like with data.')}</section>`;
    const aff = streams.find((x) => x.id === 'affiliate' && x.on && !x.error);
    const st = streams.find((x) => x.id === 'stripe' && x.on && !x.error);
    const cols = many ? used : [];
    const foot = [
      `Totals are in ${esc(d.currency)}.`,
      st && st.already_in_highlevel ? 'HighLevel takes its payments through your Stripe account, so each of those charges is counted once, under HighLevel. Stripe adds only what HighLevel does not hold.' : '',
      affFoot(aff),
      d.other_currencies ? `${int(d.other_currencies)} ${d.other_currencies === 1 ? 'payment in another currency is' : 'payments in other currencies are'} not counted here.` : '',
      d.capped ? 'Stripe returned more charges than one read can hold, so the oldest months may be short.' : '',
    ].filter(Boolean).join(' ');
    return `${head}
      ${kpis([
        { label: 'Last 30 days', value: money(d.last30), delta },
        { label: 'Monthly average', value: money(avg), delta: 'Last ' + full.length + ' full months' },
        { label: 'Recurring share', value: pay12 ? pct(rec12 / pay12) : '0%', delta: many ? money(rec12) + ' of ' + money(pay12) + ' in payments, 12 months' : money(rec12) + ' from subscriptions, 12 months' },
        { label: 'Refunds, 30 days', value: money(d.refunds30), delta: d.failed30 ? d.failed30 + (d.failed30 === 1 ? ' failed payment worth ' : ' failed payments worth ') + money(d.failed30_amount) : 'No failed payments' },
      ])}
      <section class="panel"><header><h2>By stream</h2><span class="meta">${esc(d.currency)}</span></header>
        <div class="table-wrap"><table class="rev-streams"><thead><tr><th>Stream</th><th class="n">Last 30 days</th><th class="n">12 months</th><th class="n">Share</th></tr></thead><tbody>${streamRows(d, money)}
        <tr class="tot"><td>Total</td><td class="n"><b>${money(d.last30)}</b></td><td class="n"><b>${money(total12)}</b></td><td class="n"></td></tr></tbody></table></div></section>
      <section class="panel" style="margin-top:var(--gap)"><header><h2>Collected per month</h2><div class="actions"><span id="rl-legend"></span></div></header><div id="rl-line"></div></section>
      <div class="grid2" style="margin-top:var(--gap)">
        <section class="panel"><header><h2>By funnel or source</h2><span class="meta">12 months</span></header><div id="rl-src"></div></section>
        <section class="panel"><header><h2>Top customers</h2><span class="meta">12 months</span></header>${d.customers.length ? `<div class="rows">${d.customers.map((c) => `<div class="row"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.email ? esc(c.email) + ' · ' : ''}${c.count} ${c.count === 1 ? 'payment' : 'payments'}</div></div><b class="tnum">${money(c.amount)}</b></div>`).join('')}</div>` : '<p class="muted">No customer payments in this period.</p>'}</section>
      </div>
      ${d.recent.length ? `<section class="panel" style="margin-top:var(--gap)"><header><h2>Latest payments</h2><span class="meta">Read ${ago(new Date(cache.at).toISOString())}</span></header>
        <div class="table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Source</th>${many ? '<th>From</th>' : ''}<th>Status</th><th class="n">Amount</th></tr></thead><tbody>
        ${d.recent.map((r) => `<tr><td>${ago(r.at)}</td><td>${esc(r.name)}${r.recurring ? '<span class="sub">Subscription</span>' : ''}</td><td class="muted">${esc(r.source)}</td>${many ? `<td class="muted">${VIA[r.via] || ''}</td>` : ''}<td>${r.status === 'succeeded' ? '<span class="pill pos">Paid</span>' : r.status === 'failed' ? '<span class="pill neg">Failed</span>' : r.status === 'refunded' ? '<span class="pill warn">Refunded</span>' : `<span class="pill">${esc(r.status)}</span>`}</td><td class="n">${money2(r.amount)}</td></tr>`).join('')}
        </tbody></table></div></section>` : ''}
      <section class="panel" style="margin-top:var(--gap)"><header><h2>Per month</h2><span class="meta">${esc(d.currency)}</span></header>
        <div class="table-wrap"><table><thead><tr><th>Month</th><th class="n">Payments</th>${cols.length ? cols.map((x) => `<th class="n">${VIA[x.id]}</th>`).join('') : '<th class="n">Recurring</th>'}<th class="n">Refunds</th><th class="n">Collected</th></tr></thead><tbody>
        ${[...d.byMonth].reverse().map((m) => `<tr><td>${monthLabel(m.month)}</td><td class="n">${int(m.count)}</td>${cols.length ? cols.map((x) => `<td class="n">${money(m[x.id] || 0)}</td>`).join('') : `<td class="n">${money(m.recurring)}</td>`}<td class="n">${money(m.refunds)}</td><td class="n"><b>${money(m.gross)}</b></td></tr>`).join('')}
        <tr class="tot"><td>Total</td><td class="n">${int(d.byMonth.reduce((s, m) => s + m.count, 0))}</td>${cols.length ? cols.map((x) => `<td class="n">${money(d.byMonth.reduce((s, m) => s + (m[x.id] || 0), 0))}</td>`).join('') : `<td class="n">${money(rec12)}</td>`}<td class="n">${money(d.byMonth.reduce((s, m) => s + m.refunds, 0))}</td><td class="n"><b>${money(total12)}</b></td></tr>
        </tbody></table></div></section>
      <p class="meta rev-foot">${foot}</p>`;
  }

  const BAR_LIVE = 'Private workspace. Only your real data appears here, and nothing is sample data.';
  V.revenue.live = () => {
    const isDemo = mode() !== 'live';
    U.after(() => { const b = U.$('#demo-bar'); if (b) b.textContent = isDemo ? 'Revenue is showing demo numbers. Everything else in this workspace is your real data.' : BAR_LIVE; });
    return isDemo ? demo() : live();
  };
  // Put the bar back when leaving Revenue.
  window.addEventListener('hashchange', () => { if ((location.hash || '').slice(1) !== 'revenue' && window.App && window.App.isLive && window.App.isLive()) { const b = U.$('#demo-bar'); if (b) b.textContent = BAR_LIVE; } });
  ACT['rev-reload'] = async (el) => { if (el) { el.disabled = true; el.innerHTML = U.spin + 'Refreshing'; } cache.data = null; cache.err = null; await load(true); window.App.render(); };
})();

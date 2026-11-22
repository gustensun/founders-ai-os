// Affiliate bonuses: HighLevel's affiliate program calls one private URL when someone uses the founder's link.
// Founders AI OS tags that person in the founder's HighLevel and logs it here. A HighLevel workflow on the tag
// sends the bonus email, so emails stay in HighLevel where the founder edits them. Each plan (Starter, Unlimited,
// Founder) has its own tag and workflow. The first Founder tag can also invite the person to two Skool groups.
(() => {
  const U = window.UI, ACT = window.ACT;
  const { esc } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const wsId = () => ctx().ws && ctx().ws.id;
  const hlOn = () => isLive() && (ctx().conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected');
  const S = { hook: null, events: null, err: null, ws: null, busy: false };

  // Matches HighLevel's own postback guide: Affiliate Portal, Promoter Reports, Postbacks.
  const POST = [
    ['trial', '2 - Trial Signup', 'New Referral', 'Started a trial through your link. Their plan bonuses go out here.', true],
    ['customer', '3 - First Payment Customer', 'New Customer', 'Paid for the first time. Fires once per person.', true],
    ['commission', '4 - New Commission', 'New Commission', 'Every commissionable payment. It confirms the plan, moves people up after an upgrade, and adds the commission to Revenue, so you never upload a report.', true],
    ['cancelled', '5 - Cancelled Customer', 'Lead Cancelled', 'Account closed. Use it to remove bonus access.', true],
    ['lead', '1 - Lead Subscribed', 'Lead Subscribed', 'Filled in step one but did not start the trial. Good for a nudge.', false],
  ];
  const PLAN = [['starter', 'Starter', '$97'], ['unlimited', 'Unlimited', '$297'], ['founder', 'Founder', '$497']];
  const RULES = { prefix: 'hl referral', starter: 'starter|97|970', unlimited: 'unlimited|297|2970', founder: 'founder|497|4970|agency pro|saas pro', starter_price: '97, 970', unlimited_price: '297, 2970', founder_price: '497, 4970', commission: 40, trial_plan: 'starter', extra: '' };
  const KIND = { lead: 'Step one', trial: 'Trial', customer: 'Customer', commission: 'Commission', cancelled: 'Cancelled', other: 'Other' };
  const DEMO = [
    { kind: 'trial', name: 'Sara Lind', email: 'sara@example.com', plan: 'Founder Plan', sub_id: 'youtube', tags: ['hl referral trial', 'hl referral founder', 'hl referral via youtube'], status: 'ok', created_at: new Date(Date.now() - 2 * 36e5).toISOString() },
    { kind: 'trial', name: 'Marco Ruiz', email: 'marco@example.net', plan: 'Unlimited', sub_id: 'instagram', tags: ['hl referral trial', 'hl referral unlimited', 'hl referral via instagram'], status: 'ok', created_at: new Date(Date.now() - 26 * 36e5).toISOString() },
    { kind: 'customer', name: 'Ana Costa', email: 'ana@example.com', plan: 'Founder Plan', tags: ['hl referral customer', 'hl referral founder'], status: 'ok', note: 'Invited to Skool: northpeak-community, northpeak-builders.', created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
    { kind: 'trial', name: 'Jon Berg', email: 'jon@example.org', plan: 'Starter', tags: ['hl referral trial', 'hl referral starter'], status: 'ok', created_at: new Date(Date.now() - 5 * 864e5).toISOString() },
  ];

  const url = (k) => (S.hook ? S.hook.url + (k ? '&e=' + k : '') : '');
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d < 8 ? d + 'd ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const tagChips = (t) => (t || []).map((x) => `<span class="pill out">${esc(x)}</span>`).join(' ');

  async function load(force) {
    if (!isLive()) return;
    const ws = wsId(); if (S.busy || (!force && S.ws === ws && S.hook)) return;
    S.busy = true; S.err = null; S.ws = ws;
    try { const [h, ev] = await Promise.all([window.Auth.affiliate.api('info', { workspace_id: ws }), window.Auth.affiliate.events(ws)]); S.hook = h; S.events = ev; }
    catch (e) { S.err = e.message || 'Could not load the webhook'; }
    S.busy = false;
  }

  function rows(list) {
    if (!list.length) return `<p class="muted">Nothing yet. Send a test postback from HighLevel and it shows up here within seconds.</p>`;
    return `<div class="rows aff-log">${list.map((e) => `<div class="row"><div class="grow"><div class="t">${esc(e.name || e.email || 'Test postback')}${e.status === 'error' ? ' <span class="pill neg">Not tagged</span>' : e.status === 'skool' ? ' <span class="pill warn">Skool invite failed</span>' : e.status === 'test' ? ' <span class="pill out">Test</span>' : e.status === 'pending' ? ' <span class="pill warn">Working</span>' : ''}</div>
      <div class="s">${esc(KIND[e.kind] || e.kind)}${e.plan ? ' · ' + esc(e.plan) : ''}${e.sub_id ? ' · via ' + esc(e.sub_id) : ''} · ${ago(e.created_at)}</div>
      ${e.note ? `<div class="s">${esc(e.note)}</div>` : ''}${e.tags && e.tags.length && e.status !== 'test' ? `<div class="aff-tags">${tagChips(e.tags)}</div>` : ''}</div></div>`).join('')}</div>`;
  }

  function body() {
    const demo = !isLive();
    const rules = { ...RULES, ...((S.hook && S.hook.rules) || {}) };
    const skool = (S.hook && S.hook.skool) || [];
    const pre = esc(rules.prefix || 'hl referral');
    const head = `<div><p class="meta">HighLevel · Affiliate bonuses</p><h2>Affiliate bonuses</h2></div>
      <div class="dsec"><p>When someone signs up through your HighLevel affiliate link, HighLevel calls your private URL. Founders AI OS finds or creates that person in your HighLevel, adds tags and a note, and logs it below. A workflow on the tag sends the bonus email.</p></div>`;
    if (demo) return head + `<p class="auth-msg">Demo workspace: sample referrals. Open your private workspace to get your own URL.</p><div class="dsec"><h3>Latest referrals</h3>${rows(DEMO)}</div>`;
    if (!hlOn()) return head + `<div class="dsec">${U.empty('Connect HighLevel first', 'The tags are written to your own HighLevel sub-account, so it needs to be connected. Add the contacts.write scope to the Private Integration.', '<div class="actions" style="margin-top:12px"><button class="btn primary" data-action="hl-conn">Connect HighLevel</button></div>')}</div>`;
    if (S.err && !S.hook) return head + `<div class="dsec">${U.empty('The webhook did not load', esc(S.err), '<div class="actions" style="margin-top:12px"><button class="btn" data-action="aff-reload">Try again</button></div>')}</div>`;
    if (!S.hook) { load().then(() => { if (U.$('.aff-drawer')) draw(); }); return head + `<p class="muted">${U.spin}Creating your private URL</p>`; }
    const list = S.events || [];
    return head + `
      <div class="dsec"><h3>1. Add postbacks in HighLevel</h3>
        <ol class="steps"><li>In your agency account, open the sub-account you use for affiliates, then Affiliate Portal, Promoter Reports, Postbacks.</li><li>Create a postback for each row below. Campaign: HighLevel Affiliate Program. Paste the matching URL.</li><li>Click Test Postback. A test row appears under Latest referrals.</li></ol>
        <div class="aff-posts">${POST.map(([k, n, trig, why, main]) => `<div class="aff-post${main ? '' : ' opt'}"><div class="aff-ph"><b>${esc(n)}</b><span class="meta">Trigger: ${esc(trig)}${main ? '' : ' · optional'}</span></div><p class="muted">${esc(why)} Adds <span class="mono">${pre} ${k}</span>.</p><div class="code-row"><code class="mono">${esc(url(k))}</code><button class="btn sm" data-action="aff-copy" data-k="${k}">${U.icon('copy')}Copy</button></div></div>`).join('')}</div>
      </div>
      <div class="dsec"><h3>2. One workflow for each plan</h3>
        <p class="muted">Every referral gets the tag of the plan they chose. Build three workflows in the same sub-account, one for each tag, each sending that plan's bonus email.</p>
        <div class="aff-posts">${PLAN.map(([k, n, price]) => `<div class="aff-post"><div class="aff-ph"><b>${n} plan bonuses</b><span class="meta">${price} a month</span></div><p class="muted">Trigger: Contact Tag, tag added. Action: Send Email with the ${n} bonuses.</p><div class="code-row"><code class="mono">${pre} ${k}</code><button class="btn sm" data-action="aff-copytag" data-t="${pre} ${k}">${U.icon('copy')}Copy</button></div></div>`).join('')}</div>
        <ol class="steps" style="margin-top:12px"><li>Publish each workflow and turn off re-entry, so a resend never emails twice.</li><li>Plan tags only move up. Someone who starts on Starter and later pays for Founder gets the Founder tag then. A downgrade never sends a lower plan's email.</li><li>On <span class="mono">${pre} cancelled</span>, remove course access or send a win-back email.</li></ol>
        <p class="meta">Links with a sub ID also get <span class="mono">${pre} via youtube</span> and similar, so you can see which channel brought each trial.</p>
      </div>
      <div class="dsec"><h3>3. Skool groups for the Founder plan</h3>
        <p class="muted">The first time someone gets <span class="mono">${pre} founder</span>, Founders AI OS asks Skool to invite them to up to two groups. Skool emails them the invite. In each group open Settings, Plugins, Webhook, switch it on and copy the address. Skool needs the Pro plan for this.</p>
        ${skool.length ? `<div class="rows" style="margin-top:10px">${skool.map((g) => `<div class="row"><div class="grow"><div class="t">${esc(g)}</div><div class="s">Founder plan referrals are invited</div></div><span class="pill pos">On</span></div>`).join('')}</div>` : ''}
        <form class="fd" data-affskool style="margin-top:12px"><label class="field"><span>${skool.length ? 'Replace the first group address' : 'First group webhook address'}</span><input name="u1" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="400" placeholder="https://api.skool.com/groups/..."></label>
        <label class="field"><span>${skool.length ? 'Replace the second group address' : 'Second group webhook address'}</span><input name="u2" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="400" placeholder="https://api.skool.com/groups/..."></label>
        <div class="actions end">${skool.length ? '<button type="button" class="btn ghost" data-action="aff-skool-off">Stop inviting</button>' : ''}<button class="btn">Save groups</button></div>
        <small class="meta">The addresses are stored encrypted and never shown again. Skool cannot remove a member from outside, so remove cancelled accounts by hand.</small></form>
      </div>
      <div class="dsec"><h3>Plan rules</h3>
        <form class="fd" data-affrules><label class="field"><span>Tag prefix</span><input name="prefix" value="${esc(rules.prefix || '')}" maxlength="40"></label>
        ${PLAN.map(([k, n]) => `<div class="aff-plan"><label class="field"><span>${n} plan names</span><input name="${k}" value="${esc(rules[k] || '')}" maxlength="120"></label><label class="field"><span>${n} prices</span><input name="${k}_price" value="${esc(rules[k + '_price'] || '')}" maxlength="40" inputmode="decimal"></label></div>`).join('')}
        <small class="meta">Names are words in the plan name, separated by |. Prices are the monthly and yearly price, used when HighLevel sends an amount and no plan name.</small>
        <label class="field"><span>When a trial starts and HighLevel does not say which plan</span><select name="trial_plan">${[['starter', 'Starter, then up when they pay'], ['unlimited', 'Unlimited, then up when they pay'], ['founder', 'Founder right away'], ['', 'Wait for the first payment']].map(([v, l]) => `<option value="${v}"${String(rules.trial_plan || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Extra tag on every referral (optional)</span><input name="extra" value="${esc(rules.extra || '')}" maxlength="80" placeholder="For example affiliateghl"></label>
        <div class="actions end"><button class="btn">Save rules</button></div></form>
      </div>
      <div class="dsec"><h3>Latest referrals</h3><div class="actions" style="margin-bottom:10px"><button class="btn sm ghost" data-action="aff-reload">Refresh</button></div>${rows(list)}</div>
      <div class="dsec"><h3>Your URL</h3><p class="muted">Anyone with this URL can post referrals to your HighLevel. If it leaks, make a new one and update the postbacks.</p><div class="actions" style="margin-top:10px"><button class="btn ghost" data-action="aff-rotate">Make a new URL</button></div></div>`;
  }
  function draw(first) { U.drawer(`<div class="aff-drawer">${body()}</div>`, { label: 'Affiliate bonuses', push: !!first }); }

  ACT['aff-open'] = async () => { draw(true); if (isLive() && hlOn()) { await load(true); if (U.$('.aff-drawer')) draw(); } };
  ACT['aff-reload'] = async (el) => { if (el) { el.disabled = true; el.innerHTML = U.spin + 'Refreshing'; } await load(true); draw(); };
  ACT['aff-copy'] = (el) => U.copy(url(el.dataset.k));
  ACT['aff-copytag'] = (el) => U.copy(el.dataset.t);
  ACT['aff-skool-off'] = async (el) => {
    if (!(await U.dialog({ title: 'Stop inviting to Skool', body: 'New Founder plan referrals will no longer be invited. People already in your groups stay.', ok: 'Stop inviting', danger: true }))) return;
    el.disabled = true; try { S.hook = await window.Auth.affiliate.api('skool', { workspace_id: wsId(), urls: [] }); U.toast('Skool invites are off'); } catch (e) { U.toast(e.message); } draw();
  };
  ACT['aff-rotate'] = async (el) => {
    if (!(await U.dialog({ title: 'Make a new URL', body: 'The old URL stops working right away, so update every postback in HighLevel.', ok: 'Make a new URL', danger: true }))) return;
    el.disabled = true; try { S.hook = await window.Auth.affiliate.api('rotate', { workspace_id: wsId() }); U.toast('New URL ready. Update your postbacks.'); } catch (e) { U.toast(e.message); } draw();
  };
  document.addEventListener('submit', async (ev) => {
    const k = ev.target.closest && ev.target.closest('form[data-affskool]');
    if (k) {
      ev.preventDefault(); const d = Object.fromEntries(new FormData(k)); const urls = [d.u1, d.u2].map((x) => String(x || '').trim()).filter(Boolean);
      if (!urls.length) { U.toast('Paste at least one Skool webhook address'); return; }
      const btn = k.querySelector('button:not([type=button])'); btn.disabled = true;
      try { S.hook = await window.Auth.affiliate.api('skool', { workspace_id: wsId(), urls }); U.toast(urls.length > 1 ? 'Both Skool groups saved' : 'Skool group saved'); draw(); }
      catch (e) { U.toast(e.message); btn.disabled = false; }
      return;
    }
    const f = ev.target.closest && ev.target.closest('form[data-affrules]'); if (!f) return;
    ev.preventDefault(); const d = Object.fromEntries(new FormData(f));
    const btn = f.querySelector('button'); btn.disabled = true;
    try { S.hook = await window.Auth.affiliate.api('rules', { workspace_id: wsId(), rules: { ...((S.hook && S.hook.rules) || {}), ...d } }); U.toast('Plan rules saved'); draw(); }
    catch (e) { U.toast(e.message); btn.disabled = false; }
  });

  // Summary for Revenue and Jarvis.
  window.Affiliate = {
    async summary() { if (!isLive()) return null; try { const ev = await window.Auth.affiliate.events(wsId(), 200); const since = Date.now() - 30 * 864e5; const r = ev.filter((e) => Date.parse(e.created_at) >= since && e.status !== 'test'); const n = (k) => r.filter((e) => e.kind === k).length; return { trials: n('trial'), founder: r.filter((e) => (e.tags || []).some((t) => / founder$/.test(t)) && e.kind === 'trial').length, customers: n('customer'), cancelled: n('cancelled'), errors: r.filter((e) => e.status === 'error').length, total: ev.length }; } catch { return null; } },
  };
})();

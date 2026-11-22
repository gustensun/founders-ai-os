// HighLevel and OpenAI connection drawers. Conversations are never read: they stay in HighLevel.
(() => {
  const U = window.UI, ACT = window.ACT;
  const { esc } = U;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const hlConn = () => (isLive() ? (ctx().conns || []).find((c) => c.provider === 'highlevel' && c.status === 'connected') : null);
  const SCOPES = ['locations.readonly', 'contacts.readonly', 'contacts.write', 'opportunities.readonly', 'calendars.readonly', 'calendars/events.readonly', 'payments/transactions.readonly',
    'products.readonly', 'products.write', 'products/prices.readonly', 'products/prices.write', 'funnels/funnel.readonly', 'funnels/page.readonly',
    'socialplanner/account.readonly', 'socialplanner/post.write', 'socialplanner/post.readonly', 'blogs/post.write', 'blogs/list.readonly', 'blogs/author.readonly', 'blogs/category.readonly',
    'locations/customValues.readonly', 'locations/customValues.write', 'courses.write', 'medias.write', 'medias.readonly', 'emails/builder.write', 'emails/builder.readonly', 'forms.readonly', 'surveys.readonly', 'users.readonly'];
  const lock = () => (isLive() ? '' : '<p class="auth-msg">Demo workspace: these forms are switched off. Open your private workspace from the top bar to connect real accounts.</p>');
  const field = (name, label, ph = '', type = 'text') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" placeholder="${esc(ph)}" autocomplete="${type === 'password' ? 'new-password' : 'off'}"></label>`;

  function hlDrawer() {
    const on = hlConn(); const dis = isLive() ? '' : 'disabled';
    U.drawer(`<div><p class="meta">Connections · HighLevel</p><h2>HighLevel</h2></div>
      ${on ? `<div class="dsec"><h3>Connected</h3><p>${esc(on.account_label || 'HighLevel sub-account')}</p><div class="actions" style="margin-top:10px"><button class="btn ghost" data-action="ib-disconnect" data-id="highlevel">Disconnect</button></div></div>` : ''}
      <div class="dsec"><h3>What Jarvis reads</h3><p class="muted">New leads, booked calls, deals that moved and payments by revenue stream. Conversations are never read. They stay in HighLevel, where you reply to them.</p></div>
      <div class="dsec"><h3>Sync with HighLevel</h3><p class="muted">Send approved posts, funnels, programs and Brand DNA into HighLevel, see form submissions and live events. Every send waits for your click.</p><div class="actions" style="margin-top:10px"><button class="btn" data-action="hl-sync">Open HighLevel sync</button></div></div>
      <div class="dsec"><h3>Affiliate bonuses</h3><p class="muted">Tag people who sign up through your HighLevel affiliate link, so a workflow sends their bonus email.</p><div class="actions" style="margin-top:10px"><button class="btn" data-action="aff-open">Set up affiliate bonuses</button></div></div>
      <div class="dsec"><h3>How to connect</h3><ol class="steps"><li>In the HighLevel sub-account, open Settings, then Private Integrations, and create a new integration.</li><li>Give it these scopes: <span class="mono">${SCOPES.join(', ')}</span>.</li><li>Copy the token and the location ID from Settings, Business Profile.</li><li>Already connected? Add any missing scopes to the same Private Integration, then replace the connection here.</li><li>contacts.write is only used to tag affiliate referrals. Everything else is read-only.</li></ol></div>
      ${lock()}<form class="fd ib-form" data-ibform="hl">${field('token', 'Private Integration token', 'pit-...', 'password')}${field('location_id', 'Location ID', 'For example ve9EPM428h8vShlRW1KT')}<div class="actions end"><button class="btn primary" ${dis}>${on ? 'Replace connection' : 'Connect HighLevel'}</button></div></form>`, { label: 'Connect HighLevel', push: true });
  }
  ACT['ib-conn'] = hlDrawer;
  ACT['hl-conn'] = hlDrawer;

  ACT['ai-conn'] = () => {
    const on = isLive() && (ctx().conns || []).find((c) => c.provider === 'openai' && c.status === 'connected');
    U.drawer(`<div><p class="meta">Connections · AI model</p><h2>OpenAI</h2></div>
      ${on ? `<div class="dsec"><h3>Connected</h3><p>${esc(on.account_label || 'OpenAI key')}. Jarvis writes summaries and Brain builds with it.</p></div>` : ''}
      <div class="dsec"><h3>What it does</h3><p class="muted">Jarvis uses your own OpenAI key for summaries, research write-ups and Brain builds, so the cost sits on your account. Claude is used first when both are connected.</p></div>
      <div class="dsec"><h3>How to connect</h3><ol class="steps"><li>Open platform.openai.com, then API keys.</li><li>Create a key for Founders AI OS and paste it below. It is stored encrypted on the server, never in the browser.</li></ol></div>
      ${lock()}<form class="fd ib-form" data-ibform="ai">${field('key', 'OpenAI API key', 'sk-...', 'password')}<div class="actions end"><button class="btn primary" ${isLive() ? '' : 'disabled'}>${on ? 'Replace key' : 'Connect OpenAI'}</button></div></form>`, { label: 'Connect OpenAI' });
  };

  const formBusy = (f, on, txt) => { const b = f.querySelector('button.primary'); if (!b) return; if (on) { b.dataset.t = b.textContent; b.disabled = true; b.innerHTML = U.spin + txt; } else { b.disabled = false; b.textContent = b.dataset.t || 'Save'; } };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-ibform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    if (!isLive()) return U.toast('Connections go live in your private workspace, never in the demo.');
    const kind = f.dataset.ibform; const v = Object.fromEntries(new FormData(f)); const ws = ctx().ws.id;
    try {
      if (kind === 'hl') { formBusy(f, true, 'Checking with HighLevel'); const r = await window.Auth.inboxApi('hl-connect', { workspace_id: ws, ...v }); await window.App.reloadConns(); U.closeDrawer(); U.toast('HighLevel connected: ' + r.location); window.App.render(true); }
      if (kind === 'ai') { formBusy(f, true, 'Checking the key'); await window.Auth.inboxApi('ai-connect', { workspace_id: ws, key: v.key }); await window.App.reloadConns(); U.toast('OpenAI connected'); U.closeDrawer(); window.App.render(true); }
    } catch (ex) { formBusy(f, false); U.toast(ex.message || 'That did not work'); }
  }, true);

  ACT['ib-disconnect'] = async () => {
    const ok = await U.dialog({ title: 'Disconnect HighLevel?', body: 'Jarvis stops reading leads, calls, deals and revenue from it. Nothing changes inside HighLevel.', ok: 'Disconnect', danger: true }); if (!ok) return;
    try { await window.Auth.inboxApi('disconnect', { workspace_id: ctx().ws.id }); await window.App.reloadConns(); U.toast('HighLevel disconnected'); U.closeDrawer(); window.App.render(true); } catch (e) { U.toast(e.message); }
  };
  ACT['ib-copy'] = (el) => U.copy(el.dataset.v);
})();

/* Founders AI OS: every error says what to do next and links there.
   Fix.of(message) reads an error and returns { say, label, to, id }.
   Toasts and inline alerts across the app get the next step added automatically. */
(function () {
  const PROVIDERS = [
    [/openrouter/i, 'openrouter', 'OpenRouter'], [/elevenlabs|eleven labs/i, 'elevenlabs', 'ElevenLabs'], [/\btella\b/i, 'tella', 'Tella'],
    [/perplexity/i, 'perplexity', 'Perplexity'], [/highlevel|\bghl\b|location id|private integration/i, 'highlevel', 'HighLevel'], [/stripe/i, 'stripe', 'Stripe'],
    [/paypal/i, 'paypal', 'PayPal'], [/google drive|google docs|\bdrive\b/i, 'gdrive', 'Google Drive'], [/calendar/i, 'gcal', 'Google Calendar'],
    [/youtube/i, 'youtube', 'YouTube'], [/apify/i, 'apify', 'Apify'], [/fathom/i, 'fathom', 'Fathom'], [/granola/i, 'granola', 'Granola'],
    [/resend|email digest/i, 'email-digest', 'Email digest'], [/telegram/i, 'telegram', 'Telegram'], [/grok/i, 'grok-bot', 'Grok Bot'],
    [/notion/i, 'notion', 'Notion'], [/slack/i, 'slack', 'Slack'], [/zoom/i, 'zoom', 'Zoom'], [/github/i, 'github', 'GitHub'], [/vercel/i, 'vercel', 'Vercel'],
    [/instagram/i, 'instagram', 'Instagram'], [/linkedin/i, 'linkedin', 'LinkedIn'], [/tiktok/i, 'tiktok', 'TikTok'],
    [/openai|gpt-|chatgpt/i, 'openai', 'OpenAI'], [/claude|anthropic/i, 'claude', 'Claude'],
  ];
  const provider = (m) => { const hit = PROVIDERS.find(([re]) => re.test(m)); return hit ? { id: hit[1], name: hit[2] } : null; };
  const AI = /(claude or openai|openai or claude|api key|ai model|ai connection|own (ai )?key|your key|no model|connect (claude|openai)|model provider)/i;

  // Order matters: the most specific reason wins.
  function of(input, status) {
    const m = String((input && input.message) || input || '').trim(); const code = Number(status || (input && input.status) || 0);
    if (!m && !code) return null;
    const p = provider(m);
    // Install settings: the owner fixes these in Vercel or Supabase, not inside the app.
    if (/supabase\/migrations|founders ai os schema|sql editor/i.test(m))
      return { say: 'The database needs the Founders AI OS schema. In Supabase, open the SQL Editor, paste the file from supabase/migrations and run it.', label: 'Open Supabase', href: 'https://supabase.com/dashboard' };
    if (/FOS_ENC_KEY|CRON_SECRET|SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|FOS_TZ|COACH_NAME|YOUTUBE_API_KEY|GOOGLE_CLIENT_|HL_APP_CLIENT_|environment variables?/i.test(m))
      return { say: 'In Vercel, open your project, then Settings, then Environment Variables. Add the value, then redeploy.', label: 'Open Vercel', href: 'https://vercel.com/dashboard' };
    if (/sign in first|not signed in|jwt|session (has )?expired|refresh token|log ?in again/i.test(m) || code === 401 && !p)
      return { say: 'Your session ended. Sign in again, then repeat the step.', label: 'Sign in again', to: 'login' };
    if (/did not accept|invalid (api )?key|incorrect api key|unauthori[sz]ed|key was (refused|rejected)|authentication failed|revoked/i.test(m) && p)
      return { say: `${p.name} refused the saved key. Paste a new key in Connections.`, label: `Update ${p.name} key`, to: 'connect', id: p.id };
    if (/credit balance|insufficient|quota|billing|out of credit|payment required/i.test(m) || code === 402)
      return { say: `${p ? p.name : 'The provider'} account is out of credit. Add credit with the provider, or connect another AI model in Connections.`, label: 'Open Connections', to: 'connect', id: p && p.id };
    if (/rate limit|too many requests|overloaded/i.test(m) || code === 429 || code === 529)
      return { say: 'The service is busy right now. Wait a minute, then try again. You can also pick another model.', label: 'Open Connections', to: 'connect' };
    if (/on our side/i.test(m)) return { say: 'Try again in a minute.', label: 'Check Connections', to: 'connect', generic: true };
    if (/claude, openai or perplexity|claude or perplexity|openai or perplexity/i.test(m))
      return { say: 'This needs your own AI model. Add a Claude, OpenAI or Perplexity API key in Connections. One Perplexity key runs every model.', label: 'Add API key', to: 'connect', id: 'perplexity' };
    if (AI.test(m) && !/(elevenlabs|openrouter|perplexity|tella|apify|fathom|granola|resend|stripe)/i.test(m))
      return { say: 'This needs your own AI model. Add a Claude, OpenAI or Perplexity API key in Connections.', label: 'Add API key', to: 'connect', id: /openai/i.test(m) && !/claude/i.test(m) ? 'openai' : 'claude' };
    if (/connections?\b|not connected|connect (it|your|the)|reconnect|disconnected|expired.*(token|connection)/i.test(m) && p)
      return { say: `Connect ${p.name} in Connections, then try again.`, label: `Open ${p.name}`, to: 'connect', id: p.id };
    if (/in connections|connections first|connect .* first/i.test(m))
      return { say: 'Connect the tool in Connections, then try again.', label: 'Open Connections', to: 'connect' };
    if (/brand board/i.test(m)) return { say: 'Set up your Brand board first.', label: 'Open Brand board', to: 'brand' };
    if (/not allowed|permission|forbidden|admin only|owner only|access (is )?(not allowed|denied)/i.test(m) || code === 403)
      return { say: 'Your account does not have access to this. Ask the workspace owner, or check your access settings.', label: 'Open access', to: 'access' };
    if (/failed to fetch|networkerror|network error|could not reach|load failed|offline|timed? ?out|timeout|aborted/i.test(m) || code === 504)
      return { say: 'The connection dropped. Check your internet, then try again.', label: 'Reload page', to: 'reload' };
    if (/too (large|long|much text)|payload|413/i.test(m) || code === 413) return { say: 'This is too large for one request. Shorten it or split it, then try again.' };
    if (/changed (since|elsewhere|by someone)|out of date|newer version|reload/i.test(m) || code === 409)
      return { say: 'Someone or something changed this since you opened it. Reload to get the latest version.', label: 'Reload page', to: 'reload' };
    if (/not found|no longer (there|exists|available)|was (removed|deleted)/i.test(m) || code === 404)
      return { say: 'It may have been moved or removed. Reload the page to see the latest version.', label: 'Reload page', to: 'reload' };
    if (/did ?n[o']t work|didn.t work|went wrong|failed|could ?n[o']t|cannot|can.t|unable|error|not available|unavailable|try again/i.test(m) || code >= 500)
      return { say: 'If it happens again, check that your tools are still connected.', label: 'Check Connections', to: 'connect', generic: true };
    return null;
  }
  const isError = (m) => !!m && /(did ?n[o']t|didn.t|went wrong|failed|fail\b|could ?n[o']t|cannot|can.t|unable|error|not allowed|refused|denied|expired|invalid|missing|not connected|connect .* (first|in connections)|add your .* key|sign in|too many|overloaded|busy|rate limit|timed? ?out|unavailable|not found|no longer)/i.test(m);

  function go(f) {
    if (!f) return;
    if (f.href) { window.open(f.href, '_blank', 'noopener'); return; }
    if (f.to === 'reload') return location.reload();
    if (f.to === 'login') { const out = () => { location.href = '/login'; }; try { Promise.resolve(window.Auth && window.Auth.signOut && window.Auth.signOut()).then(out, out); } catch (e) { out(); } return; }
    try { window.UI && window.UI.closeDrawer && window.UI.closeDrawer(); } catch (e) { /* none open */ }
    const d = document.getElementById('formd'); if (d && d.open) d.close('cancel');
    location.hash = '#' + f.to;
    if (f.to === 'connect' && f.id) setTimeout(() => { try { window.ACT && window.ACT.cx && window.ACT.cx({ dataset: { id: f.id } }); } catch (e) { /* page still opens */ } }, 250);
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Text already telling people where to go only gets the link; vague text also gets the next step.
  const vague = (m) => !/(connections|settings|brand board|sign in|add |paste |open |choose |pick |reload|shorten|ask |check |connect |try a |wait |vercel|supabase)/i.test(m);
  function html(msg, status) {
    const f = of(msg, status); if (!f) return '';
    const say = f.say && (vague(String(msg)) || !f.label) ? `<span class="fix-say">${esc(f.say)}</span>` : '';
    const link = f.href && f.label ? `<a class="fix-link" href="${esc(f.href)}" target="_blank" rel="noopener">${esc(f.label)}</a>`
      : f.label ? `<button type="button" class="fix-link" data-action="fix-go" data-to="${esc(f.to)}"${f.id ? ` data-id="${esc(f.id)}"` : ''}>${esc(f.label)}</button>` : '';
    return say || link ? `<span class="fix" data-fix>${say}${link}</span>` : '';
  }
  // Inline alerts anywhere in the app: add the next step once.
  const SEL = '[role="alert"], .auth-msg, .pg-form-error, .os-error, .err-msg, .fa-err, .is-error';
  function patch(root) {
    (root.querySelectorAll ? root.querySelectorAll(SEL) : []).forEach((el) => {
      if (el.hidden || el.closest('[data-nofix]') || el.querySelector('[data-fix], .fix-link, [data-action]')) return;
      const t = (el.textContent || '').trim(); if (!t || !isError(t)) return;
      const h = html(t); if (!h) return;
      el.insertAdjacentHTML('beforeend', ' ' + h);
    });
  }
  let queued = false;
  const obs = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; patch(document.body); }); });
  function start() { patch(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.Fix = { of, html, go, isError, patch };
  window.ACT = window.ACT || {};
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="fix-go"]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); go({ to: b.dataset.to, id: b.dataset.id });
  }, true);
})();

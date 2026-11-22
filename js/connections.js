// Founders AI OS connections in a private workspace: real forms, real sign-ins, real syncs.
// Every provider is described by /api/connect (catalog). Credentials go to the server once and are sealed there.
(() => {
  const U = window.UI, ACT = window.ACT;
  const { esc } = U;
  const st = { cat: null, booted: null, reconnect: {} };
  const ctx = () => window.App.liveCtx();
  const wsId = () => ctx().ws && ctx().ws.id;

  async function api(action, body = {}) {
    const s = action === 'catalog' ? null : await window.Auth.session();
    if (action !== 'catalog' && !s) throw new Error('Sign in first');
    const r = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.access_token } : {}) }, body: JSON.stringify({ action, workspace_id: wsId(), ...body }) });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) { const e = new Error(j.error || 'That did not work. Try again.'); e.status = r.status; throw e; }
    return j;
  }
  async function catalog() { if (!st.cat) st.cat = await api('catalog'); return st.cat; }
  const prov = (id) => (st.cat && st.cat.providers.find((p) => p.id === id)) || null;
  const row = (id) => (ctx().conns || []).find((c) => c.provider === id) || null;
  const meta = (id) => (row(id) && row(id).meta) || {};
  const on = (id) => { const r = row(id); return !!(r && r.status === 'connected'); };

  const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (isNaN(m)) return ''; if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d + 'd ago'; };
  const pill = (s) => s === 'connected' ? '<span class="pill pos">Connected</span>' : s === 'error' ? '<span class="pill neg">Needs a fix</span>' : s === 'pending' ? '<span class="pill warn">Pending</span>' : '<span class="pill out">Not connected</span>';

  // Metrics and recent items that a sync stored on the connection.
  function feed(id, { items = 6, title = true } = {}) {
    const m = meta(id); const f = m.feed || {}; const mets = f.metrics || []; const its = (f.items || []).slice(0, items);
    if (!mets.length && !its.length) return '';
    return `${title ? '' : ''}${mets.length ? `<div class="cx-mets">${mets.slice(0, 4).map((x) => `<div class="cx-met"><span class="meta">${esc(x.l)}</span><b>${esc(x.v)}</b>${x.s ? `<span class="meta">${esc(x.s)}</span>` : ''}</div>`).join('')}</div>` : ''}
      ${its.length ? `<div class="rows">${its.map((x) => `<div class="row"><div class="grow"><div class="cx-clip">${x.url ? `<a class="lnk" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.t)}</a>` : esc(x.t)}</div>${x.s ? `<div class="meta cx-clip">${esc(x.s)}</div>` : ''}</div>${x.tag ? `<span class="pill out">${esc(x.tag)}</span>` : ''}${x.at ? `<span class="meta">${esc(ago(x.at) || '')}</span>` : ''}</div>`).join('')}</div>` : ''}`;
  }

  const input = (f) => {
    const name = `name="${esc(f.k)}"`; const ph = `placeholder="${esc(f.ph || '')}"`;
    if (/^select:/.test(f.type)) return `<label class="field"><span>${esc(f.label)}</span><select ${name}>${f.type.split(':')[1].split(',').map((o) => `<option value="${esc(o)}">${esc(o[0].toUpperCase() + o.slice(1))}</option>`).join('')}</select></label>`;
    if (f.type === 'textarea') return `<label class="field"><span>${esc(f.label)}</span><textarea ${name} ${ph} rows="5" spellcheck="false" class="mono"></textarea></label>`;
    return `<label class="field"><span>${esc(f.label)}</span><input ${name} ${ph} type="${f.type === 'secret' ? 'password' : 'text'}" autocomplete="${f.type === 'secret' ? 'new-password' : 'off'}" ${f.optional ? '' : 'required'}></label>`;
  };
  const cta = (p) => p.kind === 'google' ? 'Sign in with Google' : p.kind === 'oauth' ? 'Continue to Xero' : p.kind === 'bank' ? 'Continue to your bank' : p.kind === 'webhook' ? 'Create webhook URL' : p.kind === 'csv' ? 'Upload export' : p.kind === 'builtin' ? 'Switch on' : 'Connect';

  const YTS = ['youtube', 'youtube-2'];
  // YouTube connects from a channel link in one step. Google sign-in stays as the optional extra for analytics.
  const ytForm = (id, compact) => `<form class="fd yt-link" data-ytform="${esc(id)}" autocomplete="off"><label class="field"><span>${id === 'youtube-2' ? 'Second channel link or @handle' : 'Channel link or @handle'}</span><input name="link" required placeholder="youtube.com/@yourname" spellcheck="false" autocapitalize="off"></label><div class="actions end"><button class="btn primary" type="submit">Connect channel</button></div>${compact ? '' : '<p class="meta">Public numbers only, nothing to approve. Works for any channel.</p>'}</form>`;
  function form(p) {
    if (YTS.includes(p.id) && st.cat && st.cat.yt_link_ready) return `${ytForm(p.id)}${p.google_ready ? `<div class="dsec"><h3>Add watch time and growth</h3><p class="muted">Optional. Sign in with the Google account that owns the channel to add watch hours, subscribers gained and lost, and average view duration.</p><form class="fd" data-cxform="${esc(p.id)}"><div class="actions"><button class="btn" type="submit">Sign in with Google</button></div></form></div>` : ''}`;
    if (p.kind === 'google' && !p.google_ready) return '<p class="auth-msg">Google sign-in needs your own Google OAuth app first. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">Vercel</a> and redeploy. SETUP.md, optional step B, shows how to create them.</p>';
    const fields = (p.fields || []).map(input).join('');
    const file = p.kind === 'csv' ? '<label class="field"><span>Referrals or Commissions export (.csv). Pick one or both.</span><input type="file" name="csv" accept=".csv,text/csv" multiple required></label>' : '';
    return `<form class="fd" data-cxform="${esc(p.id)}">${fields}${file}<div class="actions end"><button class="btn primary" type="submit">${cta(p)}</button></div></form>`;
  }

  async function open(id, cx) {
    U.drawer(`<div><p class="meta">Connections</p><h2>${esc(cx ? cx[1] : id)}</h2></div><p class="meta">${U.spin}Loading</p>`, { label: cx ? cx[1] : 'Connection' });
    try { await catalog(); } catch (e) { U.drawer(`<div><h2>${esc(cx ? cx[1] : id)}</h2></div><p class="auth-msg">${esc(e.message)}</p>`, { label: 'Connection' }); return; }
    const p = prov(id); if (!p) { U.toast('This connection is not available here'); return; }
    const r = row(id); const m = (r && r.meta) || {}; const s = r ? r.status : 'not_connected';
    const live = s === 'connected' || s === 'error';
    const showForm = !live || st.reconnect[id];
    const tgPending = id === 'telegram' && s === 'pending' && m.start_link;
    const status = live ? `<div class="dsec"><h3>Status</h3><p>${esc(r.account_label || p.name)}</p>
        <p class="meta">${m.last_sync_at ? 'Synced ' + esc(ago(m.last_sync_at)) : r.connected_at ? 'Connected ' + esc(ago(r.connected_at)) : ''}${m.last_sent_at ? ' · last message sent ' + esc(ago(m.last_sent_at)) : ''}${m.event_count ? ' · ' + m.event_count + ' events received' : ''}</p>
        ${m.sync_error ? `<p class="auth-msg" style="margin-top:8px">${esc(m.sync_error)}</p>` : ''}</div>` : '';
    const data = live ? feed(id, { items: 8 }) : '';
    const voiceSec = id === 'elevenlabs' && s === 'connected' ? elevenSection(m) : '';
    const btns = live ? `<div class="actions">
        ${id !== 'hl-webhooks' && id !== 'affiliate' && id !== 'email-digest' ? `<button class="btn" data-action="cx-sync" data-id="${id}">Sync now</button>` : ''}
        ${p.can_send ? `<button class="btn" data-action="cx-send" data-id="${id}">Send a test brief</button>` : ''}
        ${id === 'hl-webhooks' ? `<button class="btn" data-action="cx-hook" data-id="${id}">Show webhook URL</button>` : ''}
        ${!st.reconnect[id] ? `<button class="btn ghost" data-action="cx-re" data-id="${id}">${p.kind === 'csv' ? 'Upload a newer export' : 'Reconnect'}</button>` : ''}
        <button class="btn ghost" data-action="cx-off" data-id="${id}">Disconnect</button></div>` : '';
    const tg = tgPending ? `<div class="dsec"><h3>Link your chat</h3><ol class="steps"><li>Open <a class="lnk" href="${esc(m.start_link)}" target="_blank" rel="noopener">@${esc(m.bot || 'your bot')} in Telegram</a> and press Start.</li><li>Come back here and confirm.</li></ol><div class="actions" style="margin-top:10px"><a class="btn" href="${esc(m.start_link)}" target="_blank" rel="noopener">Open Telegram</a><button class="btn primary" data-action="cx-tg" data-id="telegram">I pressed Start</button></div></div>` : '';
    const waiting = s === 'pending' && !tgPending ? '<p class="meta">Waiting for the sign-in to finish. If you closed that window, start again below.</p>' : '';
    U.drawer(`<div><p class="meta">${esc(cx ? cx[2] + ' · ' + cx[5] : p.name)}</p><h2>${esc(cx ? cx[1] : p.name)}</h2><p style="margin-top:8px">${pill(s)}</p></div>
      ${status}${voiceSec}${data ? `<div class="dsec"><h3>Latest read</h3>${data}</div>` : ''}${btns}${tg}
      ${cx ? `<div class="dsec"><h3>Reads</h3><p>${esc(cx[3])}</p></div><div class="dsec"><h3>Writes</h3><p>${esc(cx[4])}</p></div><div class="dsec"><h3>Used by</h3><p class="muted">${esc(cx[6])}</p></div>` : ''}
      ${showForm && !tgPending ? `<div class="dsec"><h3>${live ? 'Reconnect' : 'How it connects'}</h3>${p.help.length ? `<ol class="steps">${p.help.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${waiting}</div>${form(p)}` : ''}
      <p class="meta" style="margin-top:6px">Keys are sent once and stored encrypted on the server. The browser never keeps them.</p>`, { label: p.name });
  }
  const reopen = (id) => { const cx = (window.OSData && window.OSData.cx(id)) || null; return open(id, cx); };

  async function after(id, msg) { await window.App.reloadConns(); window.App.render(); if (msg) U.toast(msg); if (id && document.querySelector('#drawer.open')) reopen(id); }

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-cxform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const id = f.dataset.cxform; const p = prov(id); const btn = f.querySelector('button[type=submit]'); const label = btn.textContent;
    btn.disabled = true; btn.innerHTML = U.spin + (p.kind === 'google' || p.kind === 'oauth' || p.kind === 'bank' ? 'Opening sign-in' : 'Checking');
    try {
      let r;
      if (p.kind === 'csv') { const files = [...f.querySelector('input[type=file]').files]; if (!files.length) throw new Error('Choose the CSV file first'); delete st.reconnect[id]; window.UI.closeDrawer(); await window.AffDash.upload(files); return; }
      else { const fields = {}; (p.fields || []).forEach((x) => { const el = f.elements[x.k]; fields[x.k] = el ? el.value : ''; }); r = await api('connect', { provider: id, fields }); }
      if (r.redirect) { location.href = r.redirect; return; }
      delete st.reconnect[id];
      if (r.webhook_url) { await after(null); showHook(r.webhook_url); return; }
      await after(id, r.pending ? 'Almost there. Link your chat to finish.' : r.sync_error ? p.name + ' connected. First read failed: ' + r.sync_error : r.rows ? `${r.rows} rows read from the export` : p.name + ' connected');
    } catch (err) { btn.disabled = false; btn.textContent = label; U.toast(err.message); }
  }, true);

  async function ytConnect(id, link) {
    const r = await api('youtube-link', { provider: id, link });
    delete st.reconnect[id];
    await after(YTS.includes(id) && document.querySelector('#drawer.open [data-ytform]') && !document.querySelector('#drawer form[data-goalform]') ? id : null, r.sync_error ? `${r.label} connected. First read failed: ${r.sync_error}` : `${r.label} connected`);
    return r;
  }
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-ytform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const btn = f.querySelector('button[type=submit]'); const label = btn.textContent; btn.disabled = true; btn.innerHTML = U.spin + 'Finding your channel';
    try { await ytConnect(f.dataset.ytform, f.elements.link.value); if (window.OSGoals2 && window.OSGoals2.afterConnect) window.OSGoals2.afterConnect(f.dataset.ytform); }
    catch (err) { btn.disabled = false; btn.textContent = label; U.toast(err.message); }
  }, true);

  function showHook(url) {
    U.drawer(`<div><p class="meta">Connections · HighLevel workflows</p><h2>Your webhook URL</h2></div>
      <div class="dsec"><p>Add a Webhook action to any HighLevel workflow and paste this URL. Method POST.</p><div class="code-row" style="margin-top:10px"><code class="cx-clip">${esc(url)}</code><button class="btn sm" data-action="cx-copy" data-url="${esc(url)}">Copy</button></div></div>
      <div class="dsec"><h3>What it can do</h3><ol class="steps"><li>Every event shows up in Connections and in Jarvis, with the contact and the workflow name.</li><li>Add custom data <span class="mono">draft_title</span> and <span class="mono">draft_body</span> and the event becomes a draft in the Newsfeed. Optional: <span class="mono">draft_kind</span>, <span class="mono">stream</span>.</li><li>Treat the URL like a password. Reconnect to get a new one; the old one stops working.</li></ol></div>`, { label: 'Webhook URL', push: true });
  }

  const busy = (el, t) => { el.disabled = true; el.dataset.l = el.textContent; el.innerHTML = U.spin + t; };
  const done = (el) => { el.disabled = false; el.textContent = el.dataset.l || 'Done'; };

  /* ---------- ElevenLabs: pick the voice Jarvis speaks with, hear it, test it ---------- */
  const EL_SAMPLE = 'Hi, this is Jarvis. This is the voice I will use for your answers and your morning brief.';
  function elevenSection(m) {
    const vs = Array.isArray(m.voices) ? m.voices : []; const cur = m.voice_id || '';
    const mine = vs.filter((v) => v.category && v.category !== 'premade'); const lib = vs.filter((v) => !v.category || v.category === 'premade');
    const opt = (v) => `<option value="${esc(v.id)}" ${v.id === cur ? 'selected' : ''}>${esc(v.name)}${v.accent ? ' · ' + esc(v.accent) : ''}</option>`;
    const known = vs.some((v) => v.id === cur);
    const picker = vs.length ? `<label class="field"><span>Jarvis speaks with</span><select data-elvoice>${!cur ? '<option value="">Default voice (George)</option>' : ''}${cur && !known ? `<option value="${esc(cur)}" selected>${esc(m.voice_name || 'Custom voice')}</option>` : ''}${mine.length ? `<optgroup label="Your voices">${mine.map(opt).join('')}</optgroup>` : ''}${lib.length ? `<optgroup label="ElevenLabs voices">${lib.map(opt).join('')}</optgroup>` : ''}</select></label>` : '';
    const paste = `<label class="field"><span>${vs.length ? 'Or paste a voice ID' : 'Voice ID'}</span><input data-elpaste placeholder="From your ElevenLabs Voice Library" autocomplete="off" spellcheck="false"></label>`;
    const ch = m.chars ? `<p class="meta">${Math.max(0, m.chars.limit - m.chars.used).toLocaleString('en-US')} of ${m.chars.limit.toLocaleString('en-US')} characters left this month${m.chars.reset_at ? ', resets ' + new Date(m.chars.reset_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}. A spoken answer uses about 200.</p>` : '';
    return `<div class="dsec el-voice"><h3>Voice</h3>
      ${!mine.length && vs.length ? '<p class="meta">Clone your own voice in ElevenLabs and it shows up here at the top after the next sync.</p>' : ''}
      ${m.voices_note ? `<p class="meta">${esc(m.voices_note)}</p>` : ''}
      <div class="fd">${picker}${paste}</div>${ch}
      <div class="actions"><button class="btn primary" data-action="el-test">Test voice</button>${vs.length ? '<button class="btn" data-action="el-hear">Hear sample</button>' : ''}<button class="btn ghost" data-action="el-save">Use this voice</button></div>
      <p class="meta">Hear sample is free. Test voice uses about 100 characters. Spoken briefs use Eleven v4.</p>
      ${rtSection(m)}</div>`;
  }
  function rtSection(m) {
    const on = m.realtime !== false; const max = m.realtime_model === 'eleven_realtime_v1_max';
    return `<div class="el-rt">
      <div class="row"><div><strong>Live conversation</strong><p class="meta">${on ? 'Jarvis runs on Eleven Realtime: you talk, it answers in about half a second, and you can interrupt mid-sentence. Billed to your ElevenLabs account per minute.' : 'Off. Jarvis listens through the browser and answers with Eleven v4 Turbo.'}</p></div>
        <button class="btn sm" data-action="el-rt" aria-pressed="${on}">${on ? 'Turn off' : 'Turn on'}</button></div>
      ${on ? `<label class="field"><span>Realtime model</span><select data-elrt><option value="eleven_realtime_v1_mini" ${max ? '' : 'selected'}>Realtime v1 Mini · fastest, lowest cost</option><option value="eleven_realtime_v1_max" ${max ? 'selected' : ''}>Realtime v1 Max · reasons before it answers</option></select></label>` : ''}
      ${m.realtime_error ? `<p class="meta">${esc(m.realtime_error)} ElevenLabs is rolling Realtime out account by account. Until it reaches yours, Jarvis uses Eleven v4 Turbo.</p>` : ''}
    </div>`;
  }
  ACT['el-rt'] = async (el) => { const on = meta('elevenlabs').realtime !== false; busy(el, on ? 'Turning off' : 'Turning on'); try { await api('eleven-realtime', { on: !on }); await window.App.reloadConns(); done(el); reopen('elevenlabs'); } catch (e) { done(el); U.toast(e.message); } };
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest && e.target.closest('[data-elrt]'); if (!sel) return;
    try { await api('eleven-realtime', { model: sel.value }); await window.App.reloadConns(); U.toast(sel.value === 'eleven_realtime_v1_max' ? 'Jarvis now uses Realtime v1 Max' : 'Jarvis now uses Realtime v1 Mini'); } catch (err) { U.toast(err.message); }
  });
  const elChoice = () => { const d = document.querySelector('#drawer'); const p = d && d.querySelector('[data-elpaste]'); const sel = d && d.querySelector('[data-elvoice]'); return (p && p.value.trim()) || (sel ? sel.value : ''); };
  async function elSave(silent) {
    const id = elChoice(); const m = meta('elevenlabs');
    if (!id || id === (m.voice_id || '')) return false;
    await api('eleven-voice', { voice_id: id }); await window.App.reloadConns(); if (!silent) U.toast('Jarvis now speaks with this voice'); return true;
  }
  let elAudio = null;
  const play = (src) => { if (elAudio) { try { elAudio.pause(); } catch (e) {} } elAudio = new Audio(src); return elAudio.play(); };
  ACT['el-save'] = async (el) => { busy(el, 'Saving'); try { const ch = await elSave(); if (!ch) U.toast('That voice is already in use'); done(el); reopen('elevenlabs'); } catch (e) { done(el); U.toast(e.message); } };
  ACT['el-hear'] = (el) => {
    const id = elChoice(); const v = (meta('elevenlabs').voices || []).find((x) => x.id === id) || (meta('elevenlabs').voices || [])[0];
    if (!v || !v.preview) return U.toast('No free sample for this voice. Use Test voice.');
    play(v.preview).catch(() => U.toast('The browser blocked the sample. Click again.'));
  };
  ACT['el-test'] = async (el) => {
    busy(el, 'Speaking');
    try { await elSave(true); const r = await api('tts', { text: EL_SAMPLE, mode: 'live' }); await play('data:' + r.type + ';base64,' + r.audio).catch(() => {}); done(el); U.toast('Playing with ' + (r.model === 'eleven_v4_turbo' ? 'Eleven v4 Turbo' : r.model)); if (elAudio) elAudio.onended = () => reopen('elevenlabs'); }
    catch (e) { done(el); U.toast(e.message); }
  };
  ACT['cx-sync'] = async (el) => { const id = el.dataset.id; busy(el, 'Syncing'); try { const r = await api('sync', { provider: id }); const v = r.synced[id]; await after(id, v === 'ok' ? 'Synced' : v ? 'Sync failed: ' + v : 'Nothing to sync'); } catch (e) { done(el); U.toast(e.message); } };
  ACT['cx-send'] = async (el) => { const id = el.dataset.id; busy(el, 'Sending'); try { await api('send-test', { provider: id }); await after(id, 'Sent. Check ' + (id === 'email-digest' ? 'your inbox' : id === 'slack' ? 'the Slack channel' : 'Telegram')); } catch (e) { done(el); U.toast(e.message); } };
  ACT['cx-hook'] = async (el) => { busy(el, 'Loading'); try { const r = await api('hook-url'); done(el); showHook(r.webhook_url); } catch (e) { done(el); U.toast(e.message); } };
  ACT['cx-copy'] = (el) => U.copy(el.dataset.url);
  ACT['cx-re'] = (el) => { st.reconnect[el.dataset.id] = true; reopen(el.dataset.id); };
  ACT['cx-tg'] = async (el) => { busy(el, 'Checking Telegram'); try { const r = await api('telegram-check'); if (!r.linked) { done(el); U.toast('No Start from your chat yet. Press Start in Telegram, wait a few seconds and try again.'); return; } await after('telegram', 'Telegram linked. A welcome message is in your chat.'); } catch (e) { done(el); U.toast(e.message); } };
  ACT['cx-off'] = async (el) => {
    const id = el.dataset.id; const p = prov(id);
    if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.textContent = 'Click again to disconnect'; return; }
    busy(el, 'Disconnecting'); try { await api('disconnect', { provider: id }); delete st.reconnect[id]; await after(id, p.name + ' disconnected. Its key is deleted.'); } catch (e) { done(el); U.toast(e.message); }
  };

  // Sign-ins come back to #connect with a code. Finish them once, then clean the address bar.
  async function finishReturn() {
    const h = location.hash; if (!/^#connect\?/.test(h) || st.booted === h) return; st.booted = h;
    const q = new URLSearchParams(h.split('?')[1] || ''); history.replaceState(null, '', location.pathname + '#connect');
    const err = q.get('c_error') || q.get('g_error'); if (err) { U.toast(err === 'access_denied' ? 'Google only lets approved addresses in while Founders AI OS is in review. Add the address under Test users in Google Cloud, then connect again.' : 'Sign-in was cancelled or refused: ' + err); return; }
    try {
      await catalog();
      const r = q.get('g_code') ? await api('google-finish', { code: q.get('g_code'), state: q.get('g_state') }) : q.get('c_code') ? await api('oauth-finish', { code: q.get('c_code'), state: q.get('c_state') }) : null;
      if (!r) return; await after(r.provider, r.sync_error ? r.name + ' connected. First read failed: ' + r.sync_error : r.name + ' connected and synced'); reopen(r.provider);
    } catch (e) { U.toast(e.message); await window.App.reloadConns(); window.App.render(); }
  }

  // Keep feeds fresh: anything older than three hours is read again when the app opens.
  let autoAt = 0;
  async function autoSync() {
    if (!window.App.isLive() || !wsId() || Date.now() - autoAt < 30 * 6e4) return; autoAt = Date.now();
    const syncable = (ctx().conns || []).filter((c) => /^(connected|error)$/.test(c.status) && !/^(highlevel|openai|apify|gmail|whatsapp|hl-webhooks|affiliate|email-digest)$/.test(c.provider));
    if (!syncable.length) return;
    try { const r = await api('sync', { stale_hours: 3 }); if (Object.keys(r.synced || {}).length) { await window.App.reloadConns(); window.App.render(); } } catch (e) { /* quiet: the drawer shows sync errors */ }
  }

  function boot() { if (!window.App || !window.App.isLive()) return; finishReturn(); autoSync(); }
  window.addEventListener('hashchange', () => { if (/^#connect\?/.test(location.hash)) boot(); });

  window.Conn = { open, reopen, feed, row, meta, on, ago, pill, catalog, api, boot, autoSync, ytForm, ytConnect, ytReady: () => !!(st.cat && st.cat.yt_link_ready) };
})();

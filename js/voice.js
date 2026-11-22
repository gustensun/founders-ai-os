// Founders AI OS voice: talk to Jarvis.
// With ElevenLabs connected, Jarvis runs on Eleven Realtime: one live conversation, interrupt any time.
// Without it, or if Realtime is not on for the account, the browser listens and Eleven v4 Turbo or the browser voice answers.
(() => {
  const U = window.UI, ACT = window.ACT, VS = window.VS;
  const { $, esc } = U;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const canHear = !!Rec, canSpeak = !!synth && typeof window.SpeechSynthesisUtterance === 'function';

  const st = { rt: false, rtOff: '', rtInfo: null, micOff: false, open: false, state: 'idle', handsFree: false, muted: false, rec: null, heard: '', voiceURI: '', level: 0, raf: 0, stream: null, ctx: null, an: null, utter: null, turns: [] };

  const PREF = [/Daniel/i, /Google UK English Male/i, /Arthur/i, /Oliver/i, /Microsoft Ryan/i, /Microsoft Guy/i, /Alex/i, /Google US English/i];
  function voices() { return canSpeak ? synth.getVoices().filter((v) => /^en/i.test(v.lang)) : []; }
  function pickVoice() {
    const vs = voices(); if (!vs.length) return null;
    if (st.voiceURI) { const v = vs.find((x) => x.voiceURI === st.voiceURI); if (v) return v; }
    for (const re of PREF) { const v = vs.find((x) => re.test(x.name)); if (v) return v; }
    return vs[0];
  }

  /* ---------- view ---------- */
  const LABEL = { idle: 'Tap to talk', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', connecting: 'Connecting', paused: 'Mic paused. Tap to talk', off: 'Voice input is not available in this browser' };
  const lab = (s) => LABEL[st.rt || canHear ? s : 'off'];
  // Voice lives in the page. On the home and Jarvis screens it sits under the hero next to the orb;
  // anywhere else it docks in the corner, so a conversation carries on while you move around.
  let host = null;
  function dlg() {
    if (!host) {
      host = document.createElement('section'); host.id = 'voiced'; host.className = 'vdock'; host.hidden = true; host.setAttribute('aria-label', 'Talk to Jarvis');
      host.addEventListener('click', onClick);
      host.addEventListener('submit', onSubmit);
      host.addEventListener('change', (e) => { if (e.target.id === 'vc-voice') { st.voiceURI = e.target.value; speak('This is how I sound now.'); } });
    }
    return host;
  }
  function mount() {
    const d = dlg(); const slot = document.querySelector('.vc-slot');
    const target = slot || document.body;
    d.classList.toggle('inline', !!slot); d.classList.toggle('float', !slot);
    if (d.parentNode !== target) target.appendChild(d);
    d.hidden = !st.open; d.dataset.open = st.open ? '1' : '';
    syncButtons();
  }
  function syncButtons() {
    document.querySelectorAll('[data-action="voice-open"]').forEach((b) => {
      b.setAttribute('aria-pressed', st.open ? 'true' : 'false');
      if (!b.dataset.vlabel) b.dataset.vlabel = b.getAttribute('aria-label') || 'Talk to Jarvis';
      b.setAttribute('aria-label', st.open ? 'Turn Jarvis voice off' : b.dataset.vlabel);
      const sp = b.querySelector(':scope > span:not(.orb-tag)'); if (sp) { if (!b.dataset.vtext) b.dataset.vtext = sp.textContent; sp.textContent = st.open ? 'Voice on' : b.dataset.vtext; }
      const tag = b.querySelector('.orb-tag.br'); if (tag) tag.textContent = st.open ? 'Tap to turn off' : 'Tap to talk';
    });
  }
  function talkText() {
    if (st.rt) return st.state === 'speaking' ? 'Interrupt' : st.micOff ? 'Resume mic' : 'Pause mic';
    return st.state === 'listening' ? 'Stop' : st.state === 'speaking' ? 'Interrupt' : 'Talk';
  }
  function draw() {
    const d = dlg();
    const vs = voices(), cur = pickVoice();
    const last = st.turns[st.turns.length - 1];
    d.innerHTML = `<div class="vc-top">
        <span class="vc-tag"><span class="dot ${st.state === 'listening' && !st.micOff ? 'on' : ''}"></span><span class="vc-state" aria-live="polite">${lab(shown())}</span></span>
        <div class="vc-tools">
          ${st.rt ? `<span class="vc-live" title="${esc(st.rtInfo && st.rtInfo.model === 'eleven_realtime_v1_max' ? 'Eleven Realtime v1 Max' : 'Eleven Realtime v1 Mini')}">Eleven Realtime</span>` : `<button class="btn sm ${st.handsFree ? 'primary' : ''}" data-v="hands" aria-pressed="${st.handsFree}" title="Keep listening after each answer">Hands-free</button>`}
          <button class="btn sm" data-v="talk" aria-label="${coreLabel()}" ${canHear || st.rt ? '' : 'disabled'}>${talkText()}</button>
          <button class="btn sm" data-v="mute" aria-pressed="${st.muted}">${st.muted ? 'Unmute' : 'Mute'}</button>
          ${!st.rt && !eleven() && vs.length > 1 ? `<label class="vc-sel"><span class="sr">Voice</span><select id="vc-voice" class="select sm">${vs.map((v) => `<option value="${esc(v.voiceURI)}" ${cur && v.voiceURI === cur.voiceURI ? 'selected' : ''}>${esc(v.name.replace(/\s*\(.*\)/, ''))}</option>`).join('')}</select></label>` : ''}
          <button class="btn sm ghost" data-v="close" aria-label="Turn Jarvis voice off">Turn off</button>
        </div>
      </div>
      <p class="vc-heard" id="vc-heard">${esc(st.rt || canHear ? 'Ask about revenue, buyers, videos, clients or agents. Or say "run the morning cycle".' : 'Type below and Jarvis will answer out loud.')}</p>
      ${last && /<button/.test(last.c || '') ? `<div class="vc-answer"><div class="cites">${last.c}</div></div>` : ''}
      <form class="vc-type" data-vform><input class="input" id="vc-q" placeholder="${canHear || st.rt ? 'Or type to Jarvis' : 'Type to Jarvis'}" aria-label="Type to Jarvis" autocomplete="off"><button class="btn primary sm" type="submit">Send</button></form>
      <p class="vc-fine">${fine()}</p>`;
    tick();
  }
  function setState(s) {
    st.state = s;
    if (window.JarvisOrb) window.JarvisOrb.setState(s === 'off' ? 'idle' : s === 'connecting' ? 'thinking' : s);
    const d = host; if (!d || !st.open) return;
    const t = d.querySelector('[data-v=talk]'); if (t) { t.textContent = talkText(); t.setAttribute('aria-label', coreLabel()); }
    const l = d.querySelector('.vc-state'); if (l) l.textContent = lab(shown());
    const dot = d.querySelector('.vc-tag .dot'); if (dot) dot.classList.toggle('on', s === 'listening' && !st.micOff);
    d.dataset.state = s;
  }

  const shown = () => (st.rt && st.micOff && st.state === 'listening' ? 'paused' : st.state);
  function coreLabel() { if (st.rt) return st.state === 'speaking' ? 'Interrupt Jarvis' : st.micOff ? 'Unpause the microphone' : 'Pause the microphone'; return st.state === 'listening' ? 'Stop listening' : 'Start talking'; }
  function fine() {
    if (st.rt) return 'Live on Eleven Realtime with your ElevenLabs account. Just talk, and interrupt whenever you like. Tap the orb to pause the mic.';
    const note = st.rtOff ? esc(st.rtOff) + ' Using ' + (eleven() ? 'Eleven v4 Turbo' : 'the browser voice') + ' for now. ' : '';
    return note + (canHear ? 'Space to talk. Speech is processed by your browser\u2019s speech service.' : 'Voice input works in Chrome, Edge and Safari.') + (canSpeak || eleven() ? '' : ' Spoken replies are not available here.');
  }

  /* ---------- mic level, drives the rings ---------- */
  async function meterOn() {
    if (st.an || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const AC = window.AudioContext || window.webkitAudioContext; st.ctx = new AC();
      const src = st.ctx.createMediaStreamSource(st.stream); st.an = st.ctx.createAnalyser(); st.an.fftSize = 512; src.connect(st.an);
    } catch (e) { st.an = null; }
  }
  function meterOff() {
    if (st.stream) st.stream.getTracks().forEach((t) => t.stop());
    if (st.ctx) st.ctx.close().catch(() => {});
    st.stream = st.ctx = st.an = null; st.level = 0;
  }
  const buf = new Uint8Array(256);
  function tick() {
    cancelAnimationFrame(st.raf);
    const d = host; if (!d || !st.open) return;
    let target = 0;
    if (st.rt && window.Realtime) target = window.Realtime.level();
    else if (st.state === 'listening' && st.an) { st.an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; } target = Math.min(1, Math.sqrt(sum / buf.length) * 5); }
    else if (st.state === 'speaking') target = 0.25 + 0.2 * Math.abs(Math.sin(performance.now() / 260));
    st.level += (target - st.level) * 0.25;
    d.style.setProperty('--lv', st.level.toFixed(3));
    if (window.JarvisOrb) window.JarvisOrb.setLevel(st.level);
    st.raf = requestAnimationFrame(tick);
  }

  /* ---------- speech ---------- */
  // ElevenLabs speaks when it is connected in a private workspace; the browser voice is the fallback.
  const eleven = () => window.App && window.App.isLive && window.App.isLive() && window.Conn && window.Conn.on('elevenlabs');
  function speak(text, then) {
    const done = () => { st.utter = null; st.audio = null; setState('idle'); if (then) then(); };
    if (st.muted || !text) return done();
    if (eleven()) {
      const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); const my = (st.say = (st.say || 0) + 1);
      setState('thinking');
      window.Conn.api('tts', { text: clean, mode: 'live' }).then((r) => {
        if (my !== st.say) return;
        const a = new Audio('data:' + r.type + ';base64,' + r.audio); st.audio = a; st.utter = a;
        a.onended = done; a.onerror = done; setState('speaking'); a.play().catch(done);
      }).catch(() => { if (my !== st.say) return; browserSpeak(text, done); });
      return;
    }
    browserSpeak(text, done);
  }
  function browserSpeak(text, done) {
    if (!canSpeak) return done();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, '').replace(/€/g, ' euros ').replace(/\s+/g, ' ').replace(/(\d) euros ([\d,.]+)/g, '$1 $2 euros'));
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 1.02; u.pitch = 0.95;
    u.onend = done; u.onerror = done;
    st.utter = u; setState('speaking'); synth.speak(u);
  }
  function hush() { if (canSpeak) synth.cancel(); st.say = (st.say || 0) + 1; if (st.audio) { try { st.audio.pause(); } catch (e) {} st.audio = null; } st.utter = null; }

  function listen() {
    if (!canHear) return;
    hush();
    if (st.rec) { try { st.rec.abort(); } catch (e) {} }
    const r = new Rec(); st.rec = r;
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = '';
    r.onstart = () => { st.heard = ''; setState('listening'); meterOn(); };
    r.onresult = (e) => {
      let interim = ''; final = '';
      for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else interim += t; }
      st.heard = (final || interim).trim();
    };
    r.onerror = (e) => {
      st.rec = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { st.heard = 'Microphone access is blocked. Allow it in your browser settings, or type below.'; st.handsFree = false; draw(); }
      setState('idle');
    };
    r.onend = () => {
      st.rec = null;
      const q = (final || st.heard || '').trim();
      if (q && st.open) handle(q); else if (st.open && st.state === 'listening') setState('idle');
    };
    try { r.start(); } catch (e) { setState('idle'); }
  }
  function stopListening() { if (st.rec) { try { st.rec.stop(); } catch (e) {} } }

  /* ---------- understanding ---------- */
  const VIEWS = { chat: /\bai chat\b|open (the )?chat|chat page/, dna: /brand dna|\bdna\b/, proven: /proven|outliers?|what(.s| is)? working|what worked|went viral|remix/, goals: /goals?|quarter|weekly review|freedom/, memory: /memory|second brain|promises|loops|decisions/, routines: /routines?|automations?/, mcp: /ai access|mcp|claude|codex/, graphics: /graphics?|thumbnails?|ad creatives?|static ads?|design (a |an )?(post|carousel|ad)/, creators: /creators?|top reels|carousels?|swipe file|hormozi|gary ?vee/, research: /research|apify|competitors?/, connect: /connections?|integrations?|tools/, jarvis: /jarvis|command|home|today|briefing/, revenue: /revenue|money|sales/, calls: /calls?|meetings?/, approvals: /news ?feed|\bfeed\b|approvals?|drafts?/, brand: /brand|channel|youtube/, content: /content|ideas?|board/, 'funnel-agent': /funnel agent|sales page/, offers: /offers?|products?/, funnels: /funnels?/, agents: /agents?/, brain: /brain|knowledge/, data: /data|feeds?|sources?|health/, score: /score/, settings: /settings/ };
  function command(q) {
    const s = q.toLowerCase().replace(/^(hey |ok |okay )?jarvis[, ]*/, '').trim();
    if (/^(stop|cancel|never ?mind|goodbye|bye|that'?s all|close)\b/.test(s)) return { a: 'Standing by.', end: true };
    if (/morning cycle|run (the )?(morning|daily) ?(cycle|routine|shift)?|start the day/.test(s)) { setTimeout(() => { if (ACT['jv-cycle']) { if (!/^#?jarvis/.test(location.hash)) location.hash = '#jarvis'; setTimeout(() => ACT['jv-cycle'](document.querySelector('[data-action="jv-cycle"]') || document.createElement('button')), 120); } }, 900); return { a: 'Running the morning cycle. Seven agents, in order. I will put anything that needs you in the Newsfeed.', soft: true }; }
    if (/(hold|pause) (the )?(drafting )?agents|stop drafting/.test(s)) { if (ACT['jv-hold']) ACT['jv-hold'](); return { a: 'Drafting agents are on hold. Watchers keep running. Say resume agents when you want them back.', soft: true }; }
    if (/resume (the )?(drafting )?agents|unpause/.test(s)) { if (VS.jhold && ACT['jv-hold']) ACT['jv-hold'](); return { a: 'Drafting agents are back on.', soft: true }; }
    if (/(who|what)('s| is| do i| should i)? ?(needs?|need|waiting|have to|got to)? ?(a |to )?(reply|replies|answer|respond)|ready to buy|buying signals?|any (new )?messages/.test(s)) return { a: 'I do not read your conversations. Replies and messages stay in HighLevel.', soft: true };
    const nav = s.match(/^(open|go to|show( me)?|take me to|switch to)\s+(the\s+)?(.+)$/);
    if (nav) { const k = Object.keys(VIEWS).find((v) => VIEWS[v].test(nav[4])); if (k) { location.hash = '#' + k; return { a: `Opening ${k === 'jarvis' ? 'the command view' : k}.`, soft: true }; } }
    if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(s) && s.split(' ').length < 4) return { a: greet() };
    if (/^(what can you do|help)\b/.test(s) && window.App.isLive && window.App.isLive()) return { a: 'Ask me anything about the business. How many leads came in this week, what calls are booked, how your last videos did. I can research any creator or topic on YouTube and tell you what is working, search your calls and Brain, check your goals, or just brainstorm with you. Say remember that, and I will file it.' };
    if (/what can you do|help\b/.test(s)) return { a: 'Ask what needs you today, what each stream made, which video made the most money, who is hot right now, what to film next or which clients might churn. You can also say remember that, followed by a promise, decision or idea, and I will file it. Or run the morning cycle, hold agents, or open any screen.' };
    return null;
  }
  function greet() {
    const h = new Date().getHours(); const name = ((window.Store && Store.s.settings.name) || '').split(' ')[0];
    return `${h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${name ? ', ' + name : ''}. What do you need?`;
  }
  // The OS answers from the workspace. Realtime calls this as its ask_os tool; the standard voice calls it directly.
  function answerFor(q) {
      let r = command(q);
      if (!r && window.Facts) { const qq = q.replace(/^(hey |ok |okay )?jarvis[, ]*/i, ''); const a0 = window.App.answer(qq); const strong = /\b(my|i|me|mine)\b/i.test(qq) ? window.Facts.match(qq, 2, 5) : []; const fx = strong.length ? strong : (!a0 || a0.fallback) ? window.Facts.match(qq, 2) : []; if (fx.length) r = { a: fx.map((f) => window.Facts.you(f.statement)).join(' '), c: '' }; }
      if (!r) { const a = window.App.answer(q.replace(/^(hey |ok |okay )?jarvis[, ]*/i, '')) || { a: 'I did not catch that. Try asking again.' }; r = { a: (a.a || '').replace(/<[^>]+>/g, ''), c: a.c }; }
      return r;
  }
  // In a private workspace every question goes to the Jarvis brain: the founder's own Claude, OpenAI or Perplexity key,
  // the latest Brand DNA and live tools (HighLevel, YouTube research, the workspace, memory, the web).
  // Screen commands still run right here in the app. The demo answers from its sample data.
  const brainOn = () => !!(window.App && window.App.isLive && window.App.isLive());
  const TOOLNAME = { highlevel_leads: 'HighLevel leads', highlevel_calls_and_deals: 'HighLevel calls and deals', youtube_research: 'YouTube', search_workspace: 'your workspace', proven_content: 'Proven', content_board: 'the content board', memory: 'Memory', remember: 'Memory', source_details: 'your sources', web_search: 'the web' };
  async function brain(q) {
    const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
    const lc = (window.App.liveCtx && window.App.liveCtx()) || {}; const ws = lc.ws || {};
    const name = ((window.Store && Store.s.settings.name) || '').split(' ')[0];
    const history = st.turns.filter((t) => t.a).slice(-10).map((t) => ({ q: t.q || '', a: t.a || '' }));
    const r = await fetch('/api/jarvis', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'ask', workspace_id: ws.id, q, history, name, mode: 'voice', local: osContext() }) });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) { const e = new Error(j.error || 'Jarvis could not answer right now.'); e.status = r.status; throw e; }
    if (j.changed) U.toast('Saved to Memory');
    return { a: j.answer, c: j.tools && j.tools.length ? '<span class="meta">Checked ' + j.tools.map((t) => TOOLNAME[t] || t).filter((x, i, a) => a.indexOf(x) === i).join(', ') + '</span>' : '', by: j.by };
  }
  // The answer for one question: a local command, the brain, or the sample data in the demo.
  async function think(q) {
    const local = command(q); if (local) return local;
    if (!brainOn()) return answerFor(q);
    try { return await brain(q); }
    catch (e) { if (e.status === 409) return { a: e.message, c: '<button class="chip" data-action="go" data-go="connect">Connections</button>' }; return { a: (e.message || 'Jarvis could not answer right now') + ' Try again in a moment.' }; }
  }
  function handle(q) {
    if (st.rt) return rtSay(q);
    st.heard = q; setState('thinking');
    const my = (st.ask = (st.ask || 0) + 1);
    const slow = setTimeout(() => { const l = host && host.querySelector('.vc-state'); if (l && st.state === 'thinking' && my === st.ask) l.textContent = 'Looking into it'; }, 1800);
    think(q).then((r) => {
      clearTimeout(slow); if (my !== st.ask || !st.open) return;
      st.turns.push({ q, a: r.a, c: r.c || '' }); st.heard = '';
      draw(); setState('thinking');
      speak(r.a, () => { if (r.end) return close(); if (st.handsFree && st.open) setTimeout(() => { if (st.open && st.state === 'idle') listen(); }, 250); });
    });
  }

  /* ---------- Eleven Realtime ---------- */
  const rtWanted = () => eleven() && window.Realtime && window.Realtime.supported() && !st.rtOff && (window.Conn.meta('elevenlabs') || {}).realtime !== false;
  function osContext() {
    try { const a = window.App.answer('what needs me today'); return a && !a.fallback ? String(a.a || '').replace(/<[^>]+>/g, '').slice(0, 900) : ''; } catch (e) { return ''; }
  }
  function lastTurn() { return st.turns[st.turns.length - 1]; }
  function paintTurn() {
    const t = lastTurn(); if (host && t && /<button/.test(t.c || '') && !host.querySelector('.vc-answer')) draw();
  }
  async function rtStart() {
    const lc = (window.App.liveCtx && window.App.liveCtx()) || {}; const ws = lc.ws || {};
    const name = ((window.Store && Store.s.settings.name) || '').split(' ')[0];
    st.rt = true; st.micOff = false; st.turns = st.turns.slice(-6); draw(); setState('connecting');
    try {
      st.rtInfo = await window.Realtime.start({
        mint: () => window.Conn.api('realtime-session', { name, workspace: ws.name || '', context: osContext() }),
        onState: (s) => { if (st.open) setState(s); },
        onReady: () => {},
        onUser: (text, final, delta) => {
          if (!final && !text && !delta) { st.heard = ''; return; }
          if (delta) { st.heard = (st.heard + text).trimStart(); return; }
          if (final && text.trim()) { const t = lastTurn(); if (t && t.live && !t.q && !t.done) t.q = text.trim(); else st.turns.push({ q: text.trim(), a: '', c: '', live: true }); st.heard = ''; paintTurn(); }
        },
        onText: (text, final) => {
          let t = lastTurn(); if (!t || (t.done && !t.tool)) { t = { q: '', a: '', c: '', live: true }; st.turns.push(t); }
          if (t.tool) { t.tool = false; t.a = ''; }
          if (final) { if (text) t.a = text; t.done = true; } else t.a += text;
          paintTurn();
        },
        onTool: async (nm, args) => {
          const q = String((args && args.question) || '').trim(); if (!q) return 'No question was given.';
          let t = lastTurn(); if (!t || t.done || t.a) { t = { q, a: '', c: '', live: true }; st.turns.push(t); } else if (!t.q) t.q = q;
          const r = await think(q); t.c = r.c || ''; t.tool = true;
          if (r.end) setTimeout(() => close(), 2600);
          return r.a;
        },
        onError: (m) => { console.warn('Eleven Realtime:', m); },
        onEnd: (e) => { if (!st.open) return; st.rt = false; if (e.code === 'off') st.rtOff = e.message; draw(); setState('idle'); if (e.code !== 'done') U.toast(e.code === 'off' ? e.message : 'The live voice session ended. Tap the orb to talk again.'); },
      });
      if (!st.open) { window.Realtime.stop(); return; }
      if (st.muted) window.Realtime.setMuted(true);
      draw(); setState('listening');
      window.Realtime.greet(greet());
    } catch (e) {
      window.Realtime.stop(); st.rt = false;
      if (!st.open) return;
      if (e.code === 'mic') { st.heard = 'Microphone access is blocked. Allow it in your browser settings, or type below.'; draw(); setState('idle'); return; }
      st.rtOff = e.status === 401 || e.status === 403 ? e.message : e.code === 'off' || e.status === 409 ? e.message : e.code === 'unsupported' ? e.message : 'Eleven Realtime could not start (' + (e.message || 'no answer') + ').';
      draw(); setState('idle');
      classicOpen();
    }
  }
  function rtSay(q) {
    st.turns.push({ q, a: '', c: '', live: true }); st.heard = ''; draw();
    if (!window.Realtime.say(q)) { st.turns.pop(); st.rt = false; handle(q); }
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const b = e.target.closest('[data-v]');
    if (b) {
      const v = b.dataset.v;
      if (v === 'talk' && st.rt) { if (st.state === 'speaking') { window.Realtime.interrupt(); setState('listening'); } else { st.micOff = !st.micOff; window.Realtime.setMic(st.micOff); setState(st.state); } return; }
      if (v === 'talk' && !canHear && eleven() && !st.rtOff && window.Realtime && window.Realtime.supported()) { rtStart(); return; }
      if (v === 'talk') { if (st.state === 'listening') stopListening(); else if (st.state === 'speaking') { hush(); setState('idle'); listen(); } else listen(); }
      if (v === 'hands') { st.handsFree = !st.handsFree; draw(); if (st.handsFree && st.state === 'idle') listen(); }
      if (v === 'mute') { st.muted = !st.muted; if (st.muted) hush(); if (st.rt) window.Realtime.setMuted(st.muted); draw(); }
      if (v === 'close') close();
      return;
    }
  }
  function onSubmit(e) {
    if (!e.target.closest('[data-vform]')) return;
    e.preventDefault(); const i = $('#vc-q'); const q = i.value.trim(); if (!q) return; i.value = ''; if (!st.rt) stopListening(); handle(q);
  }
  document.addEventListener('keydown', (e) => {
    if (!st.open) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j' && document.querySelector('.app')) { e.preventDefault(); open(); } return; }
    if (e.key === 'Escape' && !document.querySelector('#drawer.open, dialog[open]')) { close(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); close(); return; }
    if (e.code === 'Space' && !e.target.closest('input, select, textarea, button, [contenteditable]')) { e.preventDefault(); onClick({ target: dlg().querySelector('[data-v=talk]') }); }
  });
  if (canSpeak && 'onvoiceschanged' in synth) synth.onvoiceschanged = () => { if (st.open) { const sel = $('#vc-voice'); if (!sel && voices().length > 1) draw(); } };

  function open(opts) {
    if (st.open) return; dlg(); st.open = true; st.heard = ''; draw(); mount();
    if (rtWanted()) { rtStart(); return; }
    classicOpen(opts);
  }
  function classicOpen(opts) {
    if (!st.open) return;
    if (!canHear) { setTimeout(() => { const i = $('#vc-q'); if (i) i.focus(); }, 50); return; }
    if (opts && opts.silent) { listen(); return; }
    const g = greet(); st.turns = st.turns.slice(-6);
    speak(g, () => { if (st.open) listen(); });
  }
  function close(keepNav) {
    st.open = false; hush(); if (window.Realtime) window.Realtime.stop(); st.rt = false; st.micOff = false; if (st.rec) { try { st.rec.abort(); } catch (e) {} st.rec = null; }
    meterOff(); cancelAnimationFrame(st.raf); setState('idle'); if (window.JarvisOrb) window.JarvisOrb.setLevel(0);
    mount();
  }
  ACT['voice-open'] = () => (st.open ? close() : open());
  window.Voice = { open, close, mount, get open_() { return st.open; }, stop: close, handle, answerFor, get state() { return st.state; }, get realtime() { return st.rt; }, get fallbackNote() { return st.rtOff; }, canHear, canSpeak };
})();

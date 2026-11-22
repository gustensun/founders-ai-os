// Eleven Realtime for Jarvis: one WebSocket to ElevenLabs, microphone in and voice out as PCM16 at 24 kHz.
// The session is minted on the server with the workspace's own ElevenLabs key; the browser only sees a two-minute secret.
(() => {
  const URL_RT = 'wss://api.elevenlabs.io/v1/convai/realtime';
  const RATE = 24000;
  const AC = window.AudioContext || window.webkitAudioContext;
  const supported = () => !!(window.WebSocket && AC && window.AudioWorkletNode && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // Resamples whatever rate the device runs at down to 24 kHz, sends about 100 ms per message, and reports the mic level.

  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  let S = null;

  async function start(h) {
    if (S) stop();
    if (!supported()) throw Object.assign(new Error('This browser cannot stream audio. Jarvis will use the standard voice.'), { code: 'unsupported' });
    // The audio context must be created inside the click that opened Jarvis, before anything async.
    const ctx = new AC();
    const s = S = { ctx, h, ws: null, srcs: new Set(), next: 0, mic: null, node: null, out: null, an: null, micLv: 0, micOff: false, ready: false, closed: false, speaking: false, pending: false, calls: new Set() };
    const fail = (e) => { if (S === s) stop(); throw e; };
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch (e) { /* resumes on first audio */ }
    let mint, stream;
    try {
      [mint, stream] = await Promise.all([
        h.mint(),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }),
      ]);
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) e.code = 'mic';
      return fail(e);
    }
    if (S !== s) { stream.getTracks().forEach((t) => t.stop()); return null; }
    s.mic = stream; s.model = mint.model; s.voice = mint.voice;
    try {
      await ctx.audioWorklet.addModule('/js/fos-cap-worklet.js');
    } catch (e) { return fail(Object.assign(new Error('Audio streaming is blocked in this browser.'), { code: 'unsupported' })); }
    const src = ctx.createMediaStreamSource(stream);
    const node = s.node = new AudioWorkletNode(ctx, 'fos-cap');
    const sink = ctx.createGain(); sink.gain.value = 0; src.connect(node); node.connect(sink); sink.connect(ctx.destination);
    s.out = ctx.createGain(); s.an = ctx.createAnalyser(); s.an.fftSize = 512; s.out.connect(s.an); s.an.connect(ctx.destination);
    node.port.onmessage = (ev) => {
      const d = ev.data; if (d.lv != null) { s.micLv = d.lv; return; }
      if (d.pcm && s.ready && !s.micOff && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64(d.pcm) }));
    };

    await new Promise((resolve, reject) => {
      let opened = false;
      const ws = s.ws = new WebSocket(URL_RT, ['realtime', 'openai-insecure-api-key.' + mint.value]);
      const t0 = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) {} reject(Object.assign(new Error('Eleven Realtime did not answer in time.'), { code: 'timeout' })); } }, 9000);
      ws.onopen = () => { opened = true; clearTimeout(t0); s.ready = true; resolve(); };
      ws.onerror = () => { if (!opened) { clearTimeout(t0); reject(Object.assign(new Error('Could not reach Eleven Realtime.'), { code: 'network' })); } };
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onEvent(s, m); };
      ws.onclose = (ev) => {
        clearTimeout(t0); const was = s.ready; s.ready = false;
        const code = ev.code === 4003 ? 'off' : ev.code === 4001 ? 'expired' : ev.code === 1000 ? 'done' : 'closed';
        const msg = code === 'off' ? 'Eleven Realtime is not switched on for your ElevenLabs account yet.' : code === 'expired' ? 'The voice session expired.' : ev.reason || 'The voice session ended.';
        if (!opened) { reject(Object.assign(new Error(msg), { code })); return; }
        if (S === s && !s.closed) { stop(); if (h.onEnd) h.onEnd({ code, message: msg, was }); }
      };
    }).catch(fail);
    if (h.onState) h.onState('listening');
    return { model: s.model, voice: s.voice };
  }

  function send(s, m) { if (s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(m)); }

  function play(s, delta) {
    const pcm = new Int16Array(unb64(delta)); if (!pcm.length) return;
    const f = new Float32Array(pcm.length); for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 0x8000;
    const buf = s.ctx.createBuffer(1, f.length, RATE); buf.copyToChannel(f, 0);
    const node = s.ctx.createBufferSource(); node.buffer = buf; node.connect(s.out);
    const at = Math.max(s.ctx.currentTime + 0.03, s.next); node.start(at); s.next = at + buf.duration;
    s.srcs.add(node);
    node.onended = () => { s.srcs.delete(node); if (!s.srcs.size && !s.pending) { s.speaking = false; if (s.h.onState && !s.closed) s.h.onState('listening'); } };
    if (!s.speaking) { s.speaking = true; if (s.h.onState) s.h.onState('speaking'); }
  }
  function interrupt(s) {
    s = s || S; if (!s) return;
    s.srcs.forEach((n) => { try { n.onended = null; n.stop(); } catch (e) {} }); s.srcs.clear(); s.next = 0; s.speaking = false;
  }

  async function runCalls(s, calls) {
    for (const c of calls) {
      if (s.calls.has(c.call_id)) continue; s.calls.add(c.call_id);
      let args = {}; try { args = JSON.parse(c.arguments || '{}'); } catch (e) {}
      let out = '';
      try { out = s.h.onTool ? await s.h.onTool(c.name, args) : ''; } catch (e) { out = 'The OS could not answer that: ' + (e.message || 'error'); }
      if (s.closed) return;
      send(s, { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: c.call_id, output: String(out || 'No answer found in the workspace.').slice(0, 4000) } });
    }
    if (!s.closed) { s.pending = true; send(s, { type: 'response.create' }); }
  }

  function onEvent(s, m) {
    const h = s.h; const t = m.type || '';
    if (t === 'session.created' || t === 'session.updated') { if (t === 'session.created' && h.onReady) h.onReady(m.session || {}); return; }
    if (t === 'input_audio_buffer.speech_started') { interrupt(s); if (h.onUser) h.onUser('', false); if (h.onState) h.onState('listening'); return; }
    if (t === 'input_audio_buffer.speech_stopped') { if (h.onState) h.onState('thinking'); return; }
    if (t === 'conversation.item.input_audio_transcription.delta') { if (h.onUser) h.onUser(m.delta || '', false, true); return; }
    if (t === 'conversation.item.input_audio_transcription.completed') { if (h.onUser) h.onUser(m.transcript || '', true); return; }
    if (t === 'response.created') { s.pending = true; return; }
    if (t === 'response.output_audio.delta' || t === 'response.audio.delta') { if (m.delta) play(s, m.delta); return; }
    if (t === 'response.output_audio_transcript.delta' || t === 'response.audio_transcript.delta' || t === 'response.output_text.delta') { if (h.onText) h.onText(m.delta || '', false); return; }
    if (t === 'response.output_audio_transcript.done' || t === 'response.audio_transcript.done' || t === 'response.output_text.done') { if (h.onText) h.onText(m.transcript || m.text || '', true); return; }
    if (t === 'response.done') {
      s.pending = false;
      const out = (m.response && m.response.output) || [];
      const calls = out.filter((o) => o && o.type === 'function_call' && o.call_id);
      if (calls.length) { if (h.onState) h.onState('thinking'); runCalls(s, calls); return; }
      if (m.response && m.response.status === 'failed' && h.onError) h.onError(((m.response.status_details || {}).error || {}).message || 'That answer did not come through.');
      if (!s.srcs.size && h.onState) { s.speaking = false; h.onState('listening'); }
      return;
    }
    if (t === 'error') { if (h.onError) h.onError((m.error && m.error.message) || 'Eleven Realtime reported an error.'); }
  }

  function say(text) { const s = S; if (!s || !s.ready || !text) return false; interrupt(s); send(s, { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }); s.pending = true; send(s, { type: 'response.create' }); if (s.h.onState) s.h.onState('thinking'); return true; }
  function greet(line) { const s = S; if (!s || !s.ready) return; s.pending = true; send(s, { type: 'response.create', response: { instructions: 'Greet the founder in one short sentence, close to: ' + line } }); }
  function setMic(off) { if (S) { S.micOff = !!off; if (off) S.micLv = 0; } }
  function setMuted(m) { if (S && S.out) { S.out.gain.value = m ? 0 : 1; if (m) interrupt(S); } }
  const buf = new Uint8Array(256);
  function level() {
    const s = S; if (!s) return 0;
    if (s.speaking && s.an) { s.an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; } return Math.min(1, Math.sqrt(sum / buf.length) * 4); }
    return s.micOff ? 0 : Math.min(1, s.micLv * 5);
  }
  function stop() {
    const s = S; if (!s) return; S = null; s.closed = true; s.ready = false;
    interrupt(s);
    if (s.ws) { try { s.ws.onclose = null; s.ws.close(1000); } catch (e) {} }
    if (s.node) { try { s.node.port.onmessage = null; s.node.disconnect(); } catch (e) {} }
    if (s.mic) s.mic.getTracks().forEach((t) => t.stop());
    try { s.ctx.close(); } catch (e) {}
  }

  window.Realtime = { supported, start, stop, say, greet, interrupt: () => interrupt(), setMic, setMuted, level, get active() { return !!(S && S.ready); }, get info() { return S ? { model: S.model, voice: S.voice } : null }, _onEvent: (m) => S && onEvent(S, m) };
})();

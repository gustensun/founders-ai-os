// Founders AI OS: file uploads for AI Chat, the CMO Room and AI Team agents.
// Files are read in the browser with the same reader the Brain uses (PDF, Word, slides, sheets, text, HTML),
// and images are resized so they fit in one request. Only the text and the resized image go to the server,
// for this one message. The file itself is not stored. The thread keeps the file names and a short excerpt
// so follow-up questions still know what was shared.
(() => {
  const U = window.UI, ACT = window.ACT, { esc, icon } = U;
  const MAX_FILES = 8, MAX_IMAGES = 4, MAX_READ = 30 * 1024 * 1024, MAX_TEXT = 60000, MAX_TOTAL_TEXT = 150000, MAX_IMAGE_BYTES = 3200000, EDGE = 1568;
  const TEXT_EXT = /^(md|markdown|txt|pdf|docx|pptx|xlsx|csv|tsv|html|htm|json|rtf|srt|vtt|xml|yaml|yml|js|ts|css|py|sql)$/;
  const IMG_EXT = /^(png|jpe?g|gif|webp|bmp)$/;
  const ACCEPT = '.pdf,.docx,.pptx,.xlsx,.csv,.tsv,.txt,.md,.markdown,.html,.htm,.json,.rtf,.srt,.vtt,.xml,.yaml,.yml,.js,.ts,.css,.py,.sql,image/png,image/jpeg,image/gif,image/webp';
  const S = {}; const hooks = [];
  const list = (k) => S[k] || (S[k] = []);
  const changed = (k) => hooks.forEach((fn) => { try { fn(k); } catch (e) { /* view not open */ } });
  const size = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const ext = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const kindOf = (f) => { const e = ext(f.name); if (IMG_EXT.test(e) || /^image\/(png|jpeg|gif|webp|bmp)$/.test(f.type)) return 'image'; if (TEXT_EXT.test(e) || /^text\//.test(f.type) || window.BrainFiles?.fromMime(f.type)) return 'text'; return null; };
  const uid = () => Math.random().toString(36).slice(2, 10);

  function shrink(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const r = Math.min(1, EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * r)), h = Math.max(1, Math.round(img.naturalHeight * r));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        let q = 0.88, out = c.toDataURL('image/jpeg', q);
        while (out.length > 1400000 && q > 0.5) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        ok({ media_type: 'image/jpeg', data: out.split(',')[1], preview: c.toDataURL('image/jpeg', 0.5) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error('This image could not be opened.')); };
      img.src = url;
    });
  }
  async function readOne(k, it, file) {
    try {
      if (it.kind === 'image') Object.assign(it, await shrink(file));
      else {
        if (file.size > MAX_READ) throw new Error('Over 30 MB. Attach a smaller export.');
        let e = ext(file.name) || window.BrainFiles?.fromMime(file.type) || 'txt';
        if (/^(xml|yaml|yml|js|ts|css|py|sql)$/.test(e) || (!TEXT_EXT.test(e) && /^text\//.test(file.type))) e = 'txt';
        const r = window.BrainFiles ? await window.BrainFiles.read(await file.arrayBuffer(), e, file.name) : { text: await file.text() };
        const text = String(r.text || '').replace(/\u0000/g, '').trim();
        if (!text) throw new Error('No readable text in this file.');
        it.text = text.slice(0, MAX_TEXT); it.cut = text.length > MAX_TEXT;
      }
      it.status = 'ready';
    } catch (e) { it.status = 'error'; it.err = e.message || 'Could not read this file.'; }
    changed(k);
  }
  function add(k, files) {
    const L = list(k); let skipped = 0;
    for (const f of [...files]) {
      const kind = kindOf(f);
      if (!kind) { U.toast(f.name + ': this file type is not supported yet.'); continue; }
      if (L.length >= MAX_FILES) { skipped++; continue; }
      if (kind === 'image' && L.filter((x) => x.kind === 'image').length >= MAX_IMAGES) { U.toast('Up to ' + MAX_IMAGES + ' images per message.'); continue; }
      const it = { id: uid(), name: f.name || (kind === 'image' ? 'Pasted image.png' : 'File'), size: f.size, kind, status: 'reading' };
      L.push(it); readOne(k, it, f);
    }
    if (skipped) U.toast('Up to ' + MAX_FILES + ' files per message.');
    changed(k);
  }
  const busy = (k) => list(k).some((x) => x.status === 'reading');
  const has = (k) => list(k).some((x) => x.status === 'ready');
  // What goes with the next message. Text is capped in total; images are capped by size so the request fits.
  function payload(k) {
    const ready = list(k).filter((x) => x.status === 'ready'); if (!ready.length) return null;
    let room = MAX_TOTAL_TEXT, bytes = 0; const out = [];
    for (const x of ready) {
      if (x.kind === 'image') { if (bytes + x.data.length > MAX_IMAGE_BYTES) continue; bytes += x.data.length; out.push({ name: x.name, kind: 'image', media_type: x.media_type, data: x.data }); }
      else { if (room <= 0) continue; const t = x.text.slice(0, room); room -= t.length; out.push({ name: x.name, kind: 'text', text: t, cut: x.cut || t.length < x.text.length }); }
    }
    return out.length ? out : null;
  }
  // The names shown on the sent message.
  const names = (k) => list(k).filter((x) => x.status === 'ready').map((x) => ({ name: x.name, kind: x.kind }));
  const clear = (k) => { S[k] = []; changed(k); };

  function button(k, disabled) {
    return `<button type="button" class="ca-pick" data-action="ca-pick" data-k="${esc(k)}" aria-label="Attach files" title="Attach files: PDF, Word, slides, sheets, text or images" ${disabled ? 'disabled' : ''}>${icon('paperclip')}</button><input type="file" multiple hidden data-ca-input="${esc(k)}" accept="${ACCEPT}">`;
  }
  function chips(k) {
    const L = list(k); if (!L.length) return '';
    return `<div class="ca-chips" aria-label="Files attached to the next message">${L.map((x) => `<span class="ca-chip${x.status === 'error' ? ' is-error' : ''}" title="${esc(x.err || x.name)}">${x.kind === 'image' && x.preview ? `<img src="${x.preview}" alt="">` : icon(x.kind === 'image' ? 'image' : 'file')}<span class="ca-name">${esc(x.name)}</span><span class="ca-meta">${x.status === 'reading' ? 'Reading' : x.status === 'error' ? esc(x.err) : x.cut ? 'First part read' : size(x.size)}</span><button type="button" data-action="ca-remove" data-k="${esc(k)}" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">${icon('close')}</button></span>`).join('')}</div>`;
  }
  // Files on a sent message, from the live send or from saved history.
  function sent(files) {
    const fs = (files || []).filter((f) => f && f.name); if (!fs.length) return '';
    return `<span class="ca-sent">${fs.map((f) => `<span class="ca-sent-f">${icon(f.kind === 'image' ? 'image' : 'file')}${esc(f.name)}</span>`).join('')}</span>`;
  }

  ACT['ca-pick'] = (el) => { const i = el.parentElement.querySelector(`[data-ca-input="${CSS.escape(el.dataset.k)}"]`) || document.querySelector(`[data-ca-input="${CSS.escape(el.dataset.k)}"]`); if (i) i.click(); };
  ACT['ca-remove'] = (el) => { const k = el.dataset.k; S[k] = list(k).filter((x) => x.id !== el.dataset.id); changed(k); };
  document.addEventListener('change', (e) => { const i = e.target.closest && e.target.closest('[data-ca-input]'); if (!i || !i.files || !i.files.length) return; add(i.dataset.caInput, i.files); i.value = ''; });
  // Paste a screenshot or drop files onto a composer.
  const formKey = (el) => { const f = el && el.closest && el.closest('[data-ca-key]'); return f ? f.dataset.caKey : null; };
  document.addEventListener('paste', (e) => {
    const k = formKey(e.target); if (!k) return;
    const fs = [...(e.clipboardData?.files || [])]; if (!fs.length) return;
    e.preventDefault(); add(k, fs);
  });
  document.addEventListener('dragover', (e) => { const k = formKey(e.target); if (!k || ![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); e.target.closest('[data-ca-key]').classList.add('ca-drop'); });
  document.addEventListener('dragleave', (e) => { const f = e.target.closest && e.target.closest('[data-ca-key]'); if (f && !f.contains(e.relatedTarget)) f.classList.remove('ca-drop'); });
  document.addEventListener('drop', (e) => { const k = formKey(e.target); if (!k || !e.dataTransfer?.files?.length) return; e.preventDefault(); e.target.closest('[data-ca-key]').classList.remove('ca-drop'); add(k, e.dataTransfer.files); });

  window.ChatAttach = { button, chips, sent, add, payload, names, busy, has, clear, on: (fn) => hooks.push(fn), _state: S };
})();

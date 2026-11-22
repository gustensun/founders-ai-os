// Private program outlines, editable module boards, source materials and explicit AI approvals.
(() => {
  const U = window.UI, P = window.Programs, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const live = () => !!window.App?.isLive();
  const scope = () => { const c = window.App?.liveCtx() || {}; return [live() ? 'live' : 'demo', c.ws?.id || 'local', c.userId || 'local'].join(':'); };
  const fresh = () => ({ key: scope(), rows: [], proposals: [], materials: [], program: null, id: null, loaded: false, loading: false, busy: false, err: '', pending: null, saveError: '', filter: 'all', query: '', tab: 'outline', jobs: [], selected: new Set(), edit: null, review: null, sequence: 0, drawerSequence: 0, drawerLoading: false });
  let S;
  const originalFiles = new Map();
  const state = () => { if (!S || S.key !== scope()) S = fresh(); return S; };
  const current = s => S === s && s.key === scope();
  const render = () => { if (['programs', 'chat'].includes(VS.view)) window.App.render(true); };
  const summary = p => ({ id: p.id, workspace_id: p.workspace_id, ...p.data, stages: undefined, revision: p.revision, archived: p.archived, origin: p.origin, updated_at: p.updated_at });
  const busy = s => s.busy ? 'disabled' : '';
  const label = p => (p.kind === 'coaching' ? 'Coaching' : 'Course') + ' · ' + (p.access === 'paid' ? 'Paid' : 'Free');
  const button = (action, text, ico = '', attrs = '') => `<button type="button" class="btn sm ghost" data-action="${action}" ${attrs}>${ico ? icon(ico) : ''}<span>${text}</span></button>`;
  const select = (name, value, choices, extra = '') => `<select name="${name}" ${extra}>${choices.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  function demo(s) {
    if (s.demo) return s.demo;
    try { s.demo = JSON.parse(localStorage.getItem('fos-programs:' + s.key) || '{"programs":[],"materials":[],"proposals":[]}'); }
    catch { s.demo = { programs: [], materials: [], proposals: [] }; }
    return s.demo;
  }
  async function api(action, body = {}, s = state()) {
    if (s.key.startsWith('live:')) return window.Auth.brainApi('program-' + action, { ...body, workspace_id: s.key.split(':')[1] });
    const d = P.copy(demo(s)), item = d.programs.find(x => x.id === body.id), material = d.materials.find(x => x.id === body.id);
    if (action === 'list') return { programs: d.programs.map(summary), proposals: d.proposals.filter(p => p.status === 'pending') };
    if (action === 'get') { if (!item) throw new Error('Program not found.'); return { program: item }; }
    if (action === 'materials') return { materials: d.materials };
    if (action === 'material') { if (!material) throw new Error('Material not found.'); return { material }; }
    let out;
    if (action === 'save') {
      if (item && item.revision !== body.revision) {
        if (item.revision === body.revision + 1 && item.archived === !!body.archived && JSON.stringify(item.data) === JSON.stringify(body.data)) return { program: item };
        throw new Error('Program changed. Reload it before saving.');
      }
      const p = { ...item, id: body.id, data: P.copy(body.data), revision: (item?.revision || 0) + 1, archived: !!body.archived, origin: item?.origin || 'manual', updated_at: new Date().toISOString() };
      d.programs = [p, ...d.programs.filter(x => x.id !== p.id)]; out = { program: p };
    } else if (action === 'material-save') {
      if (material && material.revision !== body.revision) throw new Error('Material changed. Reload it before saving.');
      const m = { ...material, ...P.copy(body.material), id: body.id, revision: (material?.revision || 0) + 1, chars: body.material.body?.length || material?.chars || 0, updated_at: new Date().toISOString() };
      d.materials = [m, ...d.materials.filter(x => x.id !== m.id)]; out = { material: m };
    } else if (action === 'material-remove') {
      if (d.programs.some(p => p.data.stages.some(st => st.cards.some(c => c.material_ids.includes(body.id))))) throw new Error('Unlink this material from its lessons before removing it.');
      d.materials = d.materials.filter(x => x.id !== body.id); out = { removed: true };
    } else throw new Error('AI proposals use your live workspace and your own connected AI.');
    localStorage.setItem('fos-programs:' + s.key, JSON.stringify(d)); s.demo = d; return out;
  }
  function accept(p, s = state()) {
    s.program = p; s.id = p.id; s.rows = [summary(p), ...s.rows.filter(x => x.id !== p.id)];
  }
  async function load(force = false) {
    const s = state(); if (s.loading || (s.loaded && !force)) return;
    s.loading = true; s.err = '';
    try {
      const [r, m] = await Promise.all([api('list', {}, s), api('materials', {}, s)]);
      if (!current(s)) return;
      s.rows = r.programs || []; s.proposals = r.proposals || []; s.materials = m.materials || []; s.loaded = true;
      if (!s.id && s.tab !== 'materials') s.id = s.rows.find(p => !p.archived)?.id || null;
      if (s.id && !s.edit && !s.pending && !s.review && !s.drawerLoading) await open(s.id, false);
    } catch (e) { if (current(s)) { s.err = e.message; s.loaded = true; } }
    finally { if (current(s)) { s.loading = false; render(); } }
  }
  async function open(id, paint = true) {
    const s = state(); if (s.busy || !allowLeave()) return;
    const seq = ++s.sequence; s.id = id; s.program = null; s.programError = ''; if (paint) render();
    try { const r = await api('get', { id }, s); if (current(s) && s.sequence === seq) s.program = r.program; }
    catch (e) { if (current(s) && s.sequence === seq) s.programError = e.message; }
    if (current(s) && paint) render();
  }
  function allowLeave() {
    const s = state();
    if (s.busy) { U.toast('Wait for this save to finish.'); return false; }
    if ((s.edit?.dirty || s.pending) && !window.confirm('Discard the unsaved program changes?')) return false;
    s.edit = null; s.pending = null; s.saveError = ''; s.review = null; s.drawerLoading = false; s.drawerSequence++; return true;
  }
  function formError(message) {
    const el = document.querySelector('#drawer .pg-form-error'); if (el) { el.textContent = message || ''; el.hidden = !message; }
  }
  async function save(payload, close = false) {
    const s = state(); if (s.busy) return false;
    s.pending = P.copy(payload); s.busy = true; s.saveError = ''; formError('');
    const form = document.querySelector('#drawer [data-pgform]'); if (form) form.querySelectorAll('button[type="submit"]').forEach(x => x.disabled = true);
    render();
    try {
      const r = await api('save', payload, s); if (!current(s)) return false;
      accept(r.program, s); s.pending = null; s.edit = null;
      if (close) U.closeDrawer(); U.toast('Program saved'); return true;
    } catch (e) {
      if (current(s)) { s.saveError = e.message; formError(e.message + ' Your changes are still here.'); }
      return false;
    } finally {
      if (current(s)) { s.busy = false; if (form) form.querySelectorAll('button[type="submit"]').forEach(x => x.disabled = false); render(); }
    }
  }
  async function change(data, s = state()) {
    if (!s.program || s.program.archived) return false;
    return save({ id: s.program.id, revision: s.program.revision, data: P.normalize(data), archived: false });
  }
  function library(s) {
    const rows = s.rows.filter(p => (s.filter === 'archived' ? p.archived : !p.archived) &&
      (!['free', 'paid'].includes(s.filter) || p.access === s.filter) &&
      (!['course', 'coaching'].includes(s.filter) || p.kind === s.filter) &&
      (p.title + ' ' + p.description).toLowerCase().includes(s.query.toLowerCase()));
    return `<aside class="pg-library" aria-label="Program library">
      <label class="pg-search">${icon('search')}<input type="search" data-pgsearch value="${esc(s.query)}" placeholder="Find a program" aria-label="Find a program"></label>
      ${select('filter', s.filter, [['all', 'All programs'], ['free', 'Free'], ['paid', 'Paid'], ['course', 'Courses'], ['coaching', 'Coaching'], ['archived', 'Archived']], 'data-action="pg-filter" aria-label="Filter programs"')}
      <div class="pg-program-list">${rows.map(p => `<button class="pg-program ${s.id === p.id ? 'on' : ''}" data-action="pg-open" data-id="${p.id}" aria-current="${s.id === p.id ? 'true' : 'false'}"><span>${esc(p.title)}</span><small>${esc(label(p))}${p.archived ? ' · Archived' : ''}</small></button>`).join('') || `<p class="meta pg-list-empty">${s.loading ? 'Loading programs…' : s.err ? 'The library could not load.' : s.rows.length ? 'No programs match this filter.' : 'Your programs will appear here.'}</p>`}</div>
      ${s.proposals.length ? `<div class="pg-pending"><h3>Awaiting your approval</h3>${s.proposals.map(p => `<button data-action="pg-review" data-id="${p.id}"><span>${esc(p.title)}</span><small>${p.target_id ? 'Proposed changes' : 'New program'}</small></button>`).join('')}</div>` : ''}
    </aside>`;
  }
  function board(p, s) {
    const locked = p.archived || s.busy; const counts = P.count(p.data);
    return `<div class="pg-board-note"><span>${counts.stages} modules · ${counts.cards} lessons and sessions · ${counts.ready} ready</span><span>${locked ? p.archived ? 'Archived programs are read-only.' : 'Saving…' : 'Drag lessons to move them. Open a lesson for keyboard controls.'}</span></div>
      <div class="pg-board" aria-label="Program module board" tabindex="0">${p.data.stages.map((st, index) => `<section class="pg-module" data-pgstage="${st.id}" aria-label="${esc(st.title)}">
        <header><button class="pg-module-title" data-action="pg-module-edit" data-id="${st.id}" ${locked ? 'disabled' : ''} title="Rename ${esc(st.title)}">${esc(st.title)}${icon('edit')}</button><span class="meta tnum">${st.cards.length}</span></header>
        <div class="pg-module-tools">${button('pg-module-move', 'Earlier', 'arrow', `data-id="${st.id}" data-dir="-1" ${locked || !index ? 'disabled' : ''} aria-label="Move ${esc(st.title)} earlier"`)}${button('pg-module-move', 'Later', 'arrow', `data-id="${st.id}" data-dir="1" ${locked || index === p.data.stages.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(st.title)} later"`)}</div>
        <div class="pg-cards" data-pgdrop="${st.id}">${st.cards.map(c => `<button class="pg-card" data-action="pg-card" data-id="${c.id}" data-pgcard="${c.id}" draggable="${!locked}" ${s.busy ? 'disabled' : ''}><span class="pg-card-type">${esc(P.KINDS[c.kind])}<span class="pg-state" data-status="${c.status}">${esc(P.STATES[c.status])}</span></span><strong>${esc(c.title)}</strong>${c.body ? `<span class="pg-card-note">${esc(c.body)}</span>` : ''}${c.material_ids.length ? `<span class="pg-card-materials">${icon('file')}${c.material_ids.length} material${c.material_ids.length === 1 ? '' : 's'}</span>` : ''}</button>`).join('')}
        ${!locked ? `<button class="pg-add-lesson" data-action="pg-card-add" data-stage="${st.id}">${icon('plus')}Add lesson or session</button>` : !st.cards.length ? '<p class="meta">No lessons in this module.</p>' : ''}</div>
        ${!locked ? button('pg-module-remove', 'Remove module', '', `data-id="${st.id}"`) : ''}
      </section>`).join('')}${!locked ? `<div class="pg-add-column"><button class="btn ghost" data-action="pg-module-add">${icon('plus')}Add module</button>${!p.data.stages.length ? '<p class="meta">Name each column after a module, stage or week.</p>' : ''}</div>` : ''}</div>`;
  }
  function materialStatus(m) {
    if (m.removal_pending) return 'Removal pending. Retry to finish.';
    if (m.read_state === 'attachment' || m.read_state === 'note') return m.notes ? 'Notes available' : 'Needs notes for AI';
    return Number(m.chars || 0).toLocaleString() + ' characters';
  }
  function materialList(s) {
    const rows = s.materials.filter(m => !s.id || !m.program_id || m.program_id === s.id);
    return `<section class="pg-materials"><div class="pg-material-heading"><div><h2>Materials</h2><p>Upload what you already have. Select material to bring it into AI Chat.</p></div><div class="actions">${button('pg-material-note', 'Note or link', 'plus')}<label class="btn sm">${icon('upload')}<span>Upload files</span><input type="file" multiple data-pgfiles hidden></label></div></div>
      <p class="meta pg-file-note">PDF, Word, slides, spreadsheets and text up to 50 MB can provide readable AI context. Images, audio, video and other files are attachments; add notes or a transcript for AI. Originals can be up to 500 MB.</p>
      ${s.jobs.length ? `<div class="pg-jobs" role="status">${s.jobs.map(j => `<div><span>${esc(j.file.name)}</span><span class="${j.error ? 'pg-error-text' : 'meta'}">${esc(j.error || j.status)}</span>${j.error ? button('pg-upload-retry', 'Retry', '', `data-id="${j.id}"`) : ''}</div>`).join('')}</div>` : ''}
      ${rows.length ? `<div class="pg-material-table">${rows.map(m => `<div class="pg-material-row"><input type="checkbox" data-pgselect="${m.id}" ${s.selected.has(m.id) ? 'checked' : ''} ${m.removal_pending ? 'disabled' : ''} aria-label="Use ${esc(m.title)} in AI Chat"><button data-action="pg-material-open" data-id="${m.id}"><strong>${esc(m.title)}</strong><span>${esc(m.filename || (m.url ? 'Saved link' : 'Note'))}</span></button><span class="meta">${esc(materialStatus(m))}</span>${button('pg-material-open', 'Open', '', `data-id="${m.id}" aria-label="Open ${esc(m.title)}"`)}</div>`).join('')}</div>` : `<div class="pg-material-empty"><h3>Start with your existing work.</h3><p>Bring in lesson notes, worksheets, recordings or past program outlines. You can keep materials here before deciding which program they belong to.</p></div>`}
      <div class="pg-material-footer">${button('pg-chat', s.selected.size ? `Brainstorm with ${s.selected.size} selected` : 'Brainstorm with AI', 'chat')}<span class="meta">${s.selected.size ? 'Only your selected materials will be added.' : 'AI can reference material assigned to the selected program.'}</span></div></section>`;
  }
  function view() {
    const s = state(); if (!s.loaded && !s.loading) load();
    const SLD = window.ProgramSlides; if (SLD && SLD.warmKit) SLD.warmKit();
    const header = U.title('Programs', 'Map your courses and coaching programs.', `${SLD && SLD.pagePicker ? SLD.pagePicker() : ''}${button('pg-library-materials', 'All materials', 'file')}<button class="btn primary" data-action="pg-new" ${busy(s)}>${icon('plus')}New program</button>`);
    const error = s.err ? `<div class="pg-error" role="alert"><span>${esc(s.err)}</span>${button('pg-reload', 'Retry loading', 'refresh')}</div>` : '';
    const saveError = s.saveError ? `<div class="pg-error" role="alert"><span>${esc(s.saveError)} Your unsaved changes are retained.</span><div class="actions">${button('pg-retry', 'Retry save', 'refresh')}${button('pg-copy-unsaved', 'Copy unsaved outline', 'copy')}${button('pg-reload', 'Reload saved version')}</div></div>` : '';
    let body = '';
    if (s.loading && !s.loaded && !s.program) body = `<div class="pg-empty" role="status"><p>${U.spin} Loading your programs and materials…</p></div>`;
    else if (s.err && !s.program && !s.rows.length) body = '<section class="pg-empty"><h2>Programs unavailable</h2><p>Your saved programs and materials could not be loaded. Retry loading to continue. Nothing has been changed.</p></section>';
    else if (s.tab === 'materials' && !s.id) body = materialList(s);
    else if (s.program) {
      const p = s.program;
      body = `<section class="pg-work"><div class="pg-program-head"><div><h2>${esc(p.data.title)}</h2><p class="meta">${esc(label(p.data))} · ${p.origin === 'ai' ? 'Created from an approved AI proposal' : 'Created manually'}${p.archived ? ' · Archived' : ''}</p></div><div class="actions">${!p.archived ? button('pg-details', 'Edit details', 'edit', busy(s)) : ''}${window.ProgramSlides ? button('pg-slides', 'Make slides', 'play') : ''}${button('pg-export', 'Export', 'download')}${!p.archived && window.HLSync ? button('pg-hl', 'Send to HighLevel', 'upload', busy(s)) : ''}${button('pg-archive', p.archived ? 'Restore' : 'Archive', '', busy(s))}</div></div>
        ${p.data.description ? `<details class="pg-description"><summary>Program notes</summary><p>${esc(p.data.description)}</p></details>` : ''}
        <div class="pg-work-tabs"><div role="group" aria-label="Program view"><button data-action="pg-tab" data-tab="outline" aria-pressed="${s.tab !== 'materials'}">Outline</button><button data-action="pg-tab" data-tab="materials" aria-pressed="${s.tab === 'materials'}">Materials</button></div>${button('pg-chat', 'Brainstorm with AI', 'chat')}</div>
        ${s.tab === 'materials' ? materialList(s) : board(p, s) + history(p, s)}</section>`;
    } else if (s.id) body = `<div class="pg-empty" role="${s.programError ? 'alert' : 'status'}"><p>${s.programError ? esc(s.programError) : U.spin + ' Loading this program…'}</p>${s.programError ? button('pg-open', 'Retry', 'refresh', `data-id="${s.id}"`) : ''}</div>`;
    else body = `<section class="pg-empty"><h2>Give your next program a place to take shape.</h2><p>Build a course or coaching program one module at a time. Or bring your material into AI Chat and review an outline before creating anything.</p><div class="actions"><button class="btn primary" data-action="pg-new">${icon('plus')}New program</button>${button('pg-chat', 'Brainstorm in AI Chat', 'chat')}</div><p class="meta">Free or paid. Fully editable. AI always asks for approval.</p></section>`;
    return `${header}${error}${saveError}<div class="pg">${library(s)}${body}</div>`;
  }
  V.programs = view; V.programs.live = view;
  // Programs to HighLevel Courses: a draft course, only after the founder confirms.
  ACT['pg-hl'] = () => { const s = state(); const p = s && s.program; if (!p || !window.HLSync) return;
    window.HLSync.course({ title: p.data.title, description: p.data.description || '', modules: p.data.stages.map((st) => ({ title: st.title, lessons: st.cards.map((c) => ({ title: c.title, description: c.body || '' })) })) }); };
  // AI suggest drafts empty notes in the open drawer only. It never edits a saved program on its own.
  window.AISuggest?.register('program', { kind: 'program', ctx: () => {
    const f = document.querySelector('[data-sg-scope="program"]'); const s = state(); const p = s && s.program;
    const t = f && f.querySelector('[name="title"]'); const k = f && f.querySelector('[name="kind"]');
    const stage = f && f.querySelector('[name="stage_id"]'); const st = stage && stage.selectedOptions[0];
    return { title: (t && t.value) || null, context: [p && s.edit && s.edit.type === 'card' ? `Program: ${p.title}${p.description ? '. ' + p.description : ''}` : '', st ? 'Module: ' + st.textContent : '', k ? 'Format: ' + (k.selectedOptions[0] || {}).textContent : ''].filter(Boolean).join('\n') || null };
  } });

  function showForm(type, data, extra = {}) {
    const s = state(); if (!allowLeave()) return;
    const p = s.program;
    s.edit = { type, data: P.copy(data), base: p ? P.copy(p) : null, dirty: false, ...extra };
    if (type === 'material' && data.removal_pending) {
      U.drawer(`<div class="pg-editor"><h2>${esc(data.title)}</h2><p>Removal is pending. This record stays here until its original file has been removed. It is no longer available for AI context or new lessons.</p><p class="pg-form-error" role="alert" hidden></p>${button('pg-material-remove', 'Retry removal', 'refresh', `data-id="${data.id}"`)}</div>`, { label: 'Pending material removal' });
      return;
    }
    let fields = '';
    if (type === 'details' || type === 'new') fields = `<label class="field"><span>Program name</span><input name="title" maxlength="200" value="${esc(data.title)}" required data-autofocus></label><div class="pg-form-pair"><label class="field"><span>Format</span>${select('kind', data.kind, [['course', 'Course'], ['coaching', 'Coaching program']])}</label><label class="field"><span>Access</span>${select('access', data.access, [['free', 'Free'], ['paid', 'Paid']])}</label></div><label class="field"><span>Audience, outcome and planning notes</span><textarea name="description" rows="6" maxlength="6000">${esc(data.description)}</textarea></label>`;
    if (type === 'card') fields = `<label class="field"><span>Lesson or session name</span><input name="title" maxlength="200" value="${esc(data.title)}" required data-autofocus></label><div class="pg-form-pair"><label class="field"><span>Type</span>${select('kind', data.kind, Object.entries(P.KINDS))}</label><label class="field"><span>Status</span>${select('status', data.status, Object.entries(P.STATES))}</label></div><label class="field"><span>Module</span>${select('stage_id', extra.stageId, p.data.stages.map(st => [st.id, st.title]))}</label><label class="field"><span>Teaching points, script or notes</span><textarea name="body" rows="13" maxlength="20000">${esc(data.body)}</textarea></label><fieldset class="pg-attachments"><legend>Linked materials</legend>${s.materials.some(m => !m.removal_pending) ? s.materials.filter(m => !m.removal_pending).map(m => `<label><input name="material" type="checkbox" value="${m.id}" ${data.material_ids.includes(m.id) ? 'checked' : ''}>${esc(m.title)}</label>`).join('') : '<p class="meta">Upload materials from the Materials tab.</p>'}</fieldset>`;
    if (type === 'material') fields = `<label class="field"><span>Material name</span><input name="title" maxlength="200" value="${esc(data.title)}" required data-autofocus></label><label class="field"><span>Program</span>${select('program_id', data.program_id || '', [['', 'Unassigned'], ...s.rows.map(p => [p.id, p.title])])}</label>${!data.revision ? '<label class="field"><span>Link (optional)</span><input name="url" type="url" placeholder="https://"></label>' : ''}<label class="field"><span>${data.revision ? 'Your notes or transcript for AI' : 'Paste your notes, outline or transcript'}</span><textarea name="notes" rows="12" maxlength="12000">${esc(data.notes || '')}</textarea></label>${data.body ? `<details class="pg-extracted"><summary>Extracted text (${Number(data.chars || data.body.length).toLocaleString()} characters)</summary><pre>${esc(data.body)}</pre></details>` : data.read_state === 'attachment' ? '<p class="meta">This file is stored as an attachment. AI uses the notes you add here, not its original bytes.</p>' : ''}`;
    const heading = type === 'new' ? 'New program' : type === 'details' ? 'Program details' : type === 'card' ? extra.isNew ? 'New lesson or session' : 'Edit lesson or session' : data.revision ? 'Material' : 'Add a note or link';
    const original = type === 'material' && (data.storage_path || originalFiles.has(s.key + ':' + data.id)) ? button('pg-material-download', 'Download original', 'download', `data-id="${data.id}"`) : '';
    const url = type === 'material' && P.safeUrl(data.url) ? `<a class="btn sm ghost" href="${esc(P.safeUrl(data.url))}" target="_blank" rel="noopener noreferrer">${icon('out')}Open link</a>` : '';
    U.drawer(`<div class="pg-editor"><h2>${heading}</h2><form data-pgform="${type}" ${type !== 'material' ? 'data-sg-scope="program"' : ''}>${fields}<p class="pg-form-error" role="alert" hidden></p><div class="actions pg-editor-actions"><button class="btn primary" type="submit">${type === 'new' ? 'Create program' : 'Save changes'}</button>${type !== 'material' && window.AISuggest ? window.AISuggest.button('program') : ''}${original}${url}${type === 'card' && !extra.isNew ? button('pg-card-remove', 'Remove lesson', '', `data-id="${data.id}"`) : type === 'material' && data.revision ? button('pg-material-remove', 'Remove material', '', `data-id="${data.id}"`) : ''}</div></form>${type === 'card' && !extra.isNew ? `<div class="pg-reorder">${button('pg-card-reorder', 'Move earlier in module', 'arrow', 'data-dir="-1"')}${button('pg-card-reorder', 'Move later in module', 'arrow', 'data-dir="1"')}<p class="meta">Save your edits before reordering.</p></div>` : ''}</div>`, { label: heading, wide: true });
  }
  async function submit(form) {
    const s = state(), e = s.edit; if (!e || s.busy) return;
    const f = Object.fromEntries(new FormData(form)); let payload;
    try {
      if (e.type === 'material') {
        s.busy = true; form.querySelector('[type="submit"]').disabled = true;
        const m = { ...e.data, title: f.title, notes: f.notes, program_id: f.program_id || null, ...(e.data.revision ? {} : { url: f.url || null, body: '', read_state: 'note' }) };
        const r = await api('material-save', { id: e.data.id, revision: e.data.revision || 0, material: m }, s);
        if (current(s)) { s.materials = [r.material, ...s.materials.filter(x => x.id !== r.material.id)]; s.edit = null; U.closeDrawer(); U.toast('Material saved'); }
        return;
      }
      if (e.type === 'new') payload = { id: e.id, revision: 0, data: P.normalize({ ...f, stages: [] }), archived: false };
      if (e.type === 'details') payload = { id: e.base.id, revision: e.base.revision, data: P.normalize({ ...e.base.data, ...f }), archived: false };
      if (e.type === 'card') {
        let data = P.copy(e.base.data); const target = data.stages.find(st => st.id === f.stage_id);
        if (!target) throw new Error('Choose a module for this lesson.');
        const c = P.card({ ...e.data, ...f, material_ids: new FormData(form).getAll('material') });
        const source = data.stages.find(st => st.cards.some(x => x.id === c.id));
        if (source) { const index = source.cards.findIndex(x => x.id === c.id); source.cards[index] = c; if (source.id !== target.id) data = P.move(data, c.id, target.id); }
        else target.cards.push(c);
        payload = { id: e.base.id, revision: e.base.revision, data: P.normalize(data), archived: false };
      }
      await save(payload, true);
    } catch (error) { if (current(s)) formError(error.message); }
    finally { if (current(s)) { s.busy = false; const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = false; render(); } }
  }
  async function uploadJob(j, s = state()) {
    if (!current(s) || j.working) return;
    j.working = true; j.error = ''; j.status = 'Reading'; render();
    try {
      if (j.file.size > P.MAX_FILE) throw new Error('Over 500 MB. Split the file or add a link.');
      if (!j.material) {
        let body = '', note = '';
        const ext = window.BrainFiles.ext(j.file.name) || window.BrainFiles.fromMime(j.file.type);
        const readable = /^(md|markdown|txt|pdf|docx|pptx|xlsx|csv|tsv|html|htm|json|rtf|srt|vtt)$/.test(ext);
        if (readable && j.file.size <= 50 * 1024 * 1024) {
          try { body = (await window.BrainFiles.read(await j.file.arrayBuffer(), ext, j.file.name)).text || ''; }
          catch (e) { note = 'Automatic text reading was not available: ' + e.message; }
        } else if (readable) note = 'Original stored. Add a text export below 50 MB for automatic reading.';
        if (body.length > P.MAX_TEXT) note = 'Only the first 250,000 characters are available as AI text. The original file is retained.';
        if (!body.trim() && !note) note = 'Original stored. Add notes or a transcript for AI.';
        j.material = { title: j.file.name.replace(/\.[^.]+$/, '').slice(0, 200) || j.file.name, filename: j.file.name, mime: j.file.type, size: j.file.size, body: body.slice(0, P.MAX_TEXT), notes: '', program_id: j.programId, read_state: body.trim() ? 'text' : 'attachment' };
        j.readNote = note;
      }
      if (!current(s)) return;
      if (s.key.startsWith('live:') && !j.uploaded) {
        j.status = 'Uploading original'; render();
        j.path = `${s.key.split(':')[1]}/programs/${j.id}/${P.filename(j.file.name)}`;
        await window.Auth.programFiles.upload(j.path, j.file); j.uploaded = true;
      } else if (!s.key.startsWith('live:')) originalFiles.set(s.key + ':' + j.id, j.file);
      if (!current(s)) return;
      j.status = 'Saving material'; render();
      const result = await api('material-save', { id: j.id, revision: 0, material: { ...j.material, storage_path: j.path || null } }, s);
      if (current(s)) { s.materials = [result.material, ...s.materials.filter(x => x.id !== j.id)]; j.status = j.readNote || (j.path ? 'Saved with readable text' : 'Saved in this demo; original is available for this session'); }
    } catch (e) { if (current(s)) { j.error = e.message; j.status = 'Not saved'; } }
    finally { j.working = false; if (current(s)) render(); }
  }
  async function upload(files) {
    const s = state(); const list = [...files].slice(0, 20);
    if (files.length > 20) U.toast('Upload up to 20 files at a time.');
    const jobs = list.map(file => ({ id: P.uuid(), file, programId: s.id || null, status: 'Waiting' })); s.jobs.push(...jobs); render();
    for (const j of jobs) { if (!current(s)) break; await uploadJob(j, s); }
  }
  async function review(id) {
    const s = state(); if (!allowLeave()) return;
    const sequence = ++s.drawerSequence; s.drawerLoading = true;
    U.drawer('<div class="pg-editor"><h2>Review program proposal</h2><p role="status">Loading the proposed outline…</p></div>', { label: 'Review program proposal', wide: true });
    try {
      const r = await api('proposal', { id }, s); if (!current(s) || sequence !== s.drawerSequence) return; const p = r.proposal; s.review = p; s.drawerLoading = false;
      const counts = P.count(p.data);
      U.drawer(`<div class="pg-editor pg-review"><h2>${esc(p.data.title)}</h2><p>${p.target_id ? 'Review the requested changes to your existing program.' : 'Review this new program before creating it.'} Nothing is applied until you confirm.</p><p class="meta">${esc(label(p.data))} · ${counts.stages} modules · ${counts.cards} lessons and sessions</p>
        ${p.target_id ? `<section class="pg-change-list"><h3>Proposed changes</h3><ul>${p.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="meta">Based on saved revision ${p.expected_revision}. If you edit the program first, this proposal cannot overwrite it.</p></section>` : ''}
        ${p.data.description ? `<p class="pg-review-description">${esc(p.data.description)}</p>` : ''}
        <div class="pg-review-outline">${p.data.stages.map(st => `<section><h3>${esc(st.title)}</h3>${st.cards.map(c => `<details><summary>${esc(c.title)}<span>${esc(P.KINDS[c.kind])}</span></summary><div class="pg-review-lesson">${esc(c.body || 'No teaching notes yet.')}</div></details>`).join('')}</section>`).join('')}</div>
        ${p.status === 'pending' ? `<form data-pgconfirm><label class="pg-consent"><input name="confirm" type="checkbox" required><span>${p.target_id ? 'I approve these changes to this program.' : 'I approve this outline. Create this program.'}</span></label><p class="pg-form-error" role="alert" hidden></p><div class="actions"><button type="submit" class="btn primary" disabled>${p.target_id ? 'Confirm changes' : 'Confirm and create'}</button>${button('pg-dismiss', 'Dismiss proposal', '', `data-id="${p.id}"`)}</div></form>` : `<p class="pg-proposal-state">${p.status === 'applied' ? 'This proposal has already been applied.' : 'This proposal was dismissed.'}</p>${p.result_id ? button('pg-result', 'Open program', 'arrow', `data-id="${p.result_id}"`) : ''}`}</div>`, { label: 'Review program proposal', wide: true });
    } catch (e) { if (current(s) && sequence === s.drawerSequence) { s.drawerLoading = false; U.drawer(`<div class="pg-editor"><h2>Proposal unavailable</h2><p role="alert">${esc(e.message)}</p>${button('pg-review', 'Retry', 'refresh', `data-id="${id}"`)}</div>`, { label: 'Proposal unavailable' }); } }
  }
  async function confirm(form) {
    const s = state(), p = s.review; if (!p || s.busy || !form.elements.confirm.checked) return;
    s.busy = true; form.querySelector('[type="submit"]').disabled = true; formError('');
    try {
      const r = await api('confirm', { id: p.id, digest: p.digest, confirm: true }, s); if (!current(s)) return;
      accept(r.program, s); s.proposals = s.proposals.filter(x => x.id !== p.id); s.review = null; s.tab = 'outline';
      window.ChatOS?.programStatus?.(p.id, 'applied', r.program.id);
      U.closeDrawer(); location.hash = '#programs'; U.toast(r.already_applied ? 'This proposal was already applied' : p.target_id ? 'Confirmed changes saved' : 'Program created');
    } catch (e) { if (current(s)) formError(e.message + ' No extra program will be created by retrying this same confirmation.'); }
    finally { if (current(s)) { s.busy = false; form.querySelector('[type="submit"]').disabled = false; render(); } }
  }
  async function brainstorm() {
    const s = state(); if (!allowLeave()) return;
    window.ChatOS?.prepareWorkspace?.();
    VS.chScope = 'programs'; VS.chProgramId = s.id; VS.chProgramUpdate = false; VS.chMaterials = [...s.selected];
    VS.chDraft = s.selected.size ? 'Help me brainstorm a program using the selected material.' : s.program ? 'Help me think through this program. Do not change it yet.' : 'Help me brainstorm a new program.';
    VS.chRoom = false; VS.chThread = null; window.ChatOS?.clearDraft?.(); U.closeDrawer(); location.hash = '#chat';
  }
  function download(text, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(typeof text === 'string' ? new Blob([text], { type: 'text/markdown' }) : text);
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ACT['pg-new'] = () => showForm('new', { title: '', kind: 'course', access: 'free', description: '' }, { id: P.uuid() });
  ACT['pg-details'] = () => { const s = state(); if (s.program && !s.program.archived) showForm('details', s.program.data); };
  ACT['pg-open'] = e => { const s = state(); s.tab = 'outline'; open(e.dataset.id); };
  ACT['pg-tab'] = e => { if (allowLeave()) { state().tab = e.dataset.tab; render(); } };
  ACT['pg-filter'] = e => { state().filter = e.value; render(); };
  ACT['pg-reload'] = () => { if (allowLeave()) { U.closeDrawer(); load(true); } };
  ACT['pg-retry'] = () => { const s = state(); if (s.pending) save(s.pending, !!s.edit); };
  ACT['pg-copy-unsaved'] = () => { const s = state(); if (s.pending) U.copy(P.markdown(s.pending.data)); };
  ACT['pg-library-materials'] = () => { if (allowLeave()) { const s = state(); s.id = null; s.program = null; s.tab = 'materials'; render(); } };
  ACT['pg-chat'] = brainstorm;
  ACT['pg-export'] = () => { const p = state().program; if (p) download(P.markdown(p.data), P.filename(p.data.title) + '.md'); };
  ACT['pg-archive'] = async () => {
    const s = state(), p = s.program; if (!p || !allowLeave()) return;
    if (!await U.dialog({ title: p.archived ? 'Restore program?' : 'Archive program?', body: p.archived ? 'The program will be editable again.' : 'The outline and materials are kept. You can restore it from the Archived filter.', ok: p.archived ? 'Restore' : 'Archive' })) return;
    if (current(s)) await save({ id: p.id, revision: p.revision, data: p.data, archived: !p.archived });
  };
  ACT['pg-module-add'] = async () => {
    const s = state(), p = s.program; if (!p || s.busy || p.archived) return;
    const r = await U.dialog({ title: 'Add module', fields: [{ name: 'title', label: 'Module or stage name', required: true, placeholder: 'Module name' }], ok: 'Add module' });
    if (r && current(s)) try { const d = P.copy(p.data); d.stages.push(P.stage({ title: r.title })); await change(d, s); } catch (e) { U.toast(e.message); }
  };
  ACT['pg-module-edit'] = async e => {
    const s = state(), p = s.program, st = p?.data.stages.find(x => x.id === e.dataset.id); if (!st || s.busy || p.archived) return;
    const r = await U.dialog({ title: 'Rename module', fields: [{ name: 'title', label: 'Module or stage name', value: st.title, required: true }] });
    if (r && current(s)) { const d = P.copy(p.data); d.stages.find(x => x.id === st.id).title = r.title; try { await change(d, s); } catch (e) { U.toast(e.message); } }
  };
  ACT['pg-module-move'] = e => { const s = state(), p = s.program; if (!p || s.busy) return; const d = P.copy(p.data), i = d.stages.findIndex(x => x.id === e.dataset.id), j = i + Number(e.dataset.dir); if (i >= 0 && j >= 0 && j < d.stages.length) { [d.stages[i], d.stages[j]] = [d.stages[j], d.stages[i]]; change(d, s); } };
  ACT['pg-module-remove'] = async e => {
    const s = state(), p = s.program, st = p?.data.stages.find(x => x.id === e.dataset.id); if (!st || s.busy) return;
    if (await U.dialog({ title: 'Remove this module?', body: `${esc(st.title)} and its ${st.cards.length} lesson${st.cards.length === 1 ? '' : 's'} will be removed. Uploaded materials are kept.`, ok: 'Remove module', danger: true }) && current(s)) await change({ ...P.copy(p.data), stages: p.data.stages.filter(x => x.id !== st.id) }, s);
  };
  ACT['pg-card-add'] = e => { if (!state().program?.archived) showForm('card', { id: P.uuid(), title: '', body: '', kind: state().program?.data.kind === 'coaching' ? 'session' : 'lesson', status: 'idea', material_ids: [] }, { stageId: e.dataset.stage, isNew: true }); };
  ACT['pg-card'] = e => {
    const s = state(), st = s.program?.data.stages.find(x => x.cards.some(c => c.id === e.dataset.id)), c = st?.cards.find(x => x.id === e.dataset.id); if (!c) return;
    if (s.program.archived) { U.drawer(`<div class="pg-editor"><h2>${esc(c.title)}</h2><p class="meta">Archived program. Restore it to edit.</p><div class="pg-review-lesson">${esc(c.body)}</div></div>`, { label: c.title, wide: true }); return; }
    showForm('card', c, { stageId: st.id, isNew: false });
  };
  ACT['pg-card-remove'] = async () => {
    const s = state(), e = s.edit; if (!e || s.busy) return;
    if (!await U.dialog({ title: 'Remove this lesson?', body: 'The lesson notes will be removed from the program. Linked material files are kept.', ok: 'Remove lesson', danger: true }) || !current(s)) return;
    const d = P.copy(e.base.data); d.stages.forEach(st => st.cards = st.cards.filter(c => c.id !== e.data.id));
    await save({ id: e.base.id, revision: e.base.revision, data: d, archived: false }, true);
  };
  ACT['pg-card-reorder'] = async el => {
    const s = state(), e = s.edit; if (!e || s.busy) return;
    if (e.dirty) { U.toast('Save your edits before reordering.'); return; }
    const d = P.copy(e.base.data), st = d.stages.find(st => st.cards.some(c => c.id === e.data.id)), i = st.cards.findIndex(c => c.id === e.data.id), j = i + Number(el.dataset.dir);
    if (j < 0 || j >= st.cards.length) { U.toast(j < 0 ? 'Already first in this module' : 'Already last in this module'); return; }
    [st.cards[i], st.cards[j]] = [st.cards[j], st.cards[i]]; await save({ id: e.base.id, revision: e.base.revision, data: d, archived: false }, true);
  };
  ACT['pg-material-note'] = () => showForm('material', { id: P.uuid(), title: '', notes: '', program_id: state().id, read_state: 'note' });
  ACT['pg-material-open'] = async el => {
    const s = state(); if (!allowLeave()) return;
    const sequence = ++s.drawerSequence;
    try { const r = await api('material', { id: el.dataset.id }, s); if (current(s) && sequence === s.drawerSequence) showForm('material', r.material); } catch (e) { if (current(s) && sequence === s.drawerSequence) U.toast(e.message); }
  };
  ACT['pg-material-download'] = async el => {
    const s = state(), m = s.materials.find(x => x.id === el.dataset.id); if (!m) return;
    const file = originalFiles.get(s.key + ':' + m.id); if (file) return download(file, m.filename || m.title);
    try { const url = await window.Auth.programFiles.url(m.storage_path, m.filename || m.title); if (current(s)) { const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.target = '_blank'; a.click(); } } catch (e) { U.toast(e.message); }
  };
  ACT['pg-material-remove'] = async el => {
    const s = state(), m = s.materials.find(x => x.id === el.dataset.id); if (!m || s.busy) return;
    if (!await U.dialog({ title: 'Remove this material?', body: 'The saved material and original upload will be removed. Materials linked to lessons must be unlinked first.', ok: 'Remove material', danger: true }) || !current(s)) return;
    s.busy = true;
    try { await api('material-remove', { id: m.id, revision: m.revision }, s); if (current(s)) { s.materials = s.materials.filter(x => x.id !== m.id); s.selected.delete(m.id); originalFiles.delete(s.key + ':' + m.id); s.edit = null; U.closeDrawer(); U.toast('Material removed'); } }
    catch (e) { if (current(s)) { if (/Removal is pending/.test(e.message)) { m.removal_pending = true; s.selected.delete(m.id); } formError(e.message); } }
    finally { if (current(s)) { s.busy = false; render(); } }
  };
  ACT['pg-upload-retry'] = el => { const s = state(), j = s.jobs.find(x => x.id === el.dataset.id); if (j) uploadJob(j, s); };
  ACT['pg-review'] = el => review(el.dataset.id);
  ACT['pg-result'] = async el => { U.closeDrawer(); await open(el.dataset.id); state().tab = 'outline'; location.hash = '#programs'; render(); };
  ACT['pg-dismiss'] = async el => {
    const s = state(); if (s.busy) return;
    try { await api('dismiss', { id: el.dataset.id }, s); if (current(s)) { s.proposals = s.proposals.filter(x => x.id !== el.dataset.id); window.ChatOS?.programStatus?.(el.dataset.id, 'dismissed'); s.review = null; U.closeDrawer(); render(); } } catch (e) { formError(e.message); }
  };
  document.addEventListener('submit', e => { if (e.target.matches('[data-pgform]')) { e.preventDefault(); submit(e.target); } if (e.target.matches('[data-pgconfirm]')) { e.preventDefault(); confirm(e.target); } });
  document.addEventListener('input', e => {
    if (e.target.matches('[data-pgsearch]')) { const s = state(); s.query = e.target.value; const start = e.target.selectionStart; render(); const input = document.querySelector('[data-pgsearch]'); input?.focus(); try { input?.setSelectionRange(start, start); } catch {} }
    if (e.target.closest('[data-pgform]') && state().edit) state().edit.dirty = true;
  });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-pgfiles]')) upload(e.target.files);
    if (e.target.matches('[data-pgselect]')) { const s = state(); if (e.target.checked && s.selected.size >= 12) { e.target.checked = false; U.toast('Select up to 12 materials for one conversation.'); return; } if (e.target.checked) s.selected.add(e.target.dataset.pgselect); else s.selected.delete(e.target.dataset.pgselect); render(); }
    if (e.target.closest('[data-pgform]') && state().edit) state().edit.dirty = true;
    if (e.target.closest('[data-pgconfirm]')) e.target.form.querySelector('[type="submit"]').disabled = !e.target.form.elements.confirm.checked;
  });
  let dragging = null;
  document.addEventListener('dragstart', e => { const c = e.target.closest('[data-pgcard]'); if (!c || state().busy || state().program?.archived) return; dragging = { id: c.dataset.pgcard, key: scope(), revision: state().program.revision }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging.id); c.classList.add('dragging'); });
  document.addEventListener('dragover', e => { const target = e.target.closest('[data-pgdrop]'); if (target && dragging?.key === scope()) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; target.classList.add('drop-target'); } });
  document.addEventListener('dragleave', e => { const target = e.target.closest('[data-pgdrop]'); if (target && !target.contains(e.relatedTarget)) target.classList.remove('drop-target'); });
  document.addEventListener('drop', e => { const target = e.target.closest('[data-pgdrop]'), s = state(); if (!target || !dragging || dragging.key !== s.key) return; e.preventDefault(); const drag = dragging; dragging = null; if (s.program?.revision !== drag.revision || s.busy) return; try { const before = e.target.closest('[data-pgcard]')?.dataset.pgcard; change(P.move(s.program.data, drag.id, target.dataset.pgdrop, before), s); } catch (err) { U.toast(err.message); } });
  document.addEventListener('dragend', () => { dragging = null; document.querySelectorAll('.drop-target,.dragging').forEach(x => x.classList.remove('drop-target', 'dragging')); });
  document.addEventListener('click', e => {
    const s = S; if (!s || !current(s)) return;
    const el = e.target.closest('[data-action],a[href^="#"],#scrim');
    if (!el || !(['drawer-close', 'ws-switch', 'logout', 'go'].includes(el.dataset.action) || el.matches('a[href^="#"],#scrim'))) return;
    if (!allowLeave()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S && current(S) && !document.querySelector('dialog[open]')) { if (!allowLeave()) { e.preventDefault(); e.stopImmediatePropagation(); } } }, true);
  window.addEventListener('beforeunload', e => { if (S && current(S) && (S.edit?.dirty || S.pending || S.jobs.some(j => j.working))) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', e => { if (S && current(S) && (S.edit?.dirty || S.pending) && location.hash.split('?')[0] !== '#programs' && !allowLeave()) { e.stopImmediatePropagation(); history.replaceState(null, '', '#programs'); } });
  /* AI edit history for one program: approved AI Chat proposals plus direct changes from a connected AI. */
  const H = { key: null, rows: [], loading: false, err: '', busy: null, all: false };
  const pstat = d => ({ title: d?.title || '', modules: (d?.stages || []).length, lessons: (d?.stages || []).reduce((n, st) => n + (st.cards || []).length, 0), names: (d?.stages || []).map(st => st.title) });
  const same = (a, b) => !!a && !!b && JSON.stringify(P.normalize(a)) === JSON.stringify(P.normalize(b));
  function hdiff(a, b) {
    if (!a || !b) return [];
    const x = pstat(a), y = pstat(b), out = [];
    if (x.title !== y.title) out.push(['Title', x.title, y.title]);
    if (x.modules !== y.modules) out.push(['Modules', x.modules, y.modules]);
    if (x.lessons !== y.lessons) out.push(['Lessons', x.lessons, y.lessons]);
    const added = y.names.filter(n => !x.names.includes(n)), gone = x.names.filter(n => !y.names.includes(n));
    if (added.length) out.push(['Added', null, added.slice(0, 3).join(', ') + (added.length > 3 ? ' and ' + (added.length - 3) + ' more' : '')]);
    if (gone.length) out.push(['Removed', null, gone.slice(0, 3).join(', ') + (gone.length > 3 ? ' and ' + (gone.length - 3) + ' more' : '')]);
    if (!out.length && JSON.stringify(a) !== JSON.stringify(b)) out.push(['Lessons', null, 'details edited']);
    return out;
  }
  function demoHistory(p) {
    const d = p.data, ago = h => new Date(Date.now() - h * 3600e3).toISOString(), rows = [];
    if (d.stages.length > 1) rows.push({ id: 'demo-ph1', src: 'proposal', op: 'update', who: 'AI Chat', approved: true, at: ago(3), before: { ...P.copy(d), stages: P.copy(d.stages.slice(0, -1)) }, after: P.copy(d) });
    rows.push({ id: 'demo-ph2', src: 'proposal', op: 'create', who: 'AI Chat', approved: true, at: ago(72), before: null, after: P.copy(d) });
    return rows;
  }
  async function loadHistory(p, force = false) {
    const k = state().key + ':' + p.id; if (H.loading || (H.key === k && !force)) return;
    Object.assign(H, { key: k, loading: true, err: '', all: false }); if (!force) H.rows = [];
    try {
      let rows;
      if (!live()) rows = demoHistory(p);
      else {
        const r = await window.Auth.changes.program(state().key.split(':')[1], p.id);
        const ver = Object.fromEntries(r.versions.map(v => [v.revision, v]));
        rows = [
          ...r.proposals.map(x => ({ id: x.id, src: 'proposal', op: x.target_id ? 'update' : 'create', who: 'AI Chat', approved: true, at: x.applied_at, rev: x.expected_revision, before: x.target_id ? ver[x.expected_revision]?.data || null : null, missing: !!x.target_id && !ver[x.expected_revision], after: x.data })),
          ...r.changes.filter(c => c.op !== 'undo').map(c => ({ id: c.id, src: 'mcp', op: c.op, who: /^ai team$/i.test(c.client || '') ? 'AI Chat' : c.client || 'A connected AI', at: c.at, before: c.before?.data || null, after: c.after?.data || null, undone: !!c.undone_at })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at));
      }
      if (H.key === k) H.rows = rows;
    } catch (e) { if (H.key === k) H.err = window.Auth?.friendly ? window.Auth.friendly(e) : e.message; }
    finally { if (H.key === k) { H.loading = false; render(); } }
  }
  const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 60) return Math.max(m, 1) + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d < 30 ? d + ' d ago' : new Date(iso).toLocaleDateString(); };
  function hstate(r, p) {
    if (r.op === 'create') return p.archived ? '<span class="pill">Archived</span>' : r.src === 'mcp' && !r.undone ? 'remove' : 'archive';
    if (r.undone || (r.before && same(p.data, r.before))) return '<span class="pill">Restored</span>';
    if (r.missing || !r.before) return '<span class="meta">Earlier version no longer kept</span>';
    return 'restore';
  }
  function history(p, s) {
    if (H.key !== s.key + ':' + p.id && !H.loading) queueMicrotask(() => loadHistory(p));
    const rows = H.key === s.key + ':' + p.id ? H.rows : [], shown = H.all ? rows : rows.slice(0, 5);
    const entry = r => {
      const st = hstate(r, p), d = r.op === 'update' ? hdiff(r.before, r.after) : [];
      const act = st === 'restore' ? 'Restore' : st === 'archive' ? 'Archive' : st === 'remove' ? 'Remove' : '';
      const what = r.op === 'create' ? 'created this program' : r.op === 'delete' ? 'removed this program' : 'changed this program';
      return `<li class="bt-entry${st.includes('Restored') || st.includes('Archived') ? ' is-undone' : ''}"><div class="bt-what"><p>${esc(r.who)} ${what}${r.approved ? ' <span class="meta">after you approved it</span>' : ''}</p>
        ${d.length ? `<ul class="bt-diff">${d.map(([k, a, b]) => `<li><span>${esc(k)}</span>${a == null ? '' : `<s>${esc(String(a))}</s><i aria-hidden="true">→</i><span class="sr-only">to</span>`}${esc(String(b))}</li>`).join('')}</ul>` : ''}
        <p class="meta">${ago(r.at)}${st === 'archive' ? ' · Archiving keeps it, read-only' : ''}</p></div>
        ${act ? `<button class="btn sm" data-action="pg-hrestore" data-id="${esc(r.id)}" ${H.busy || s.busy || (p.archived && st !== 'remove') ? 'disabled' : ''}>${H.busy === r.id ? U.spin + 'Working' : act}</button>` : st.startsWith('<') ? st : ''}</li>`;
    };
    const body = H.loading && !rows.length ? `<p class="meta">${U.spin} Loading history</p>`
      : H.err ? `<p class="os-error" role="alert">${esc(H.err)} <button class="btn sm" data-action="pg-hreload">Retry</button></p>`
      : rows.length ? `<ul class="bt-list">${shown.map(entry).join('')}</ul>${rows.length > 5 ? `<button class="btn sm ghost" data-action="pg-hmore">${H.all ? 'Show fewer' : 'Show all ' + rows.length}</button>` : ''}`
      : '<p class="meta">No AI edits on this program yet. When AI creates or changes it, that shows up here with a way to put it back.</p>';
    return `<section class="panel bt-history pg-history" aria-label="AI edit history"><header><h2>AI edit history</h2><span class="meta">AI proposals you approved and changes from a connected AI. Your own edits are not listed.</span></header>${body}</section>`;
  }
  ACT['pg-hmore'] = () => { H.all = !H.all; render(); };
  ACT['pg-hreload'] = () => { const p = state().program; if (p) loadHistory(p, true); };
  ACT['pg-hrestore'] = async el => {
    const s = state(), p = s.program, r = H.rows.find(x => x.id === el.dataset.id); if (!p || !r || H.busy || s.busy) return;
    const st = hstate(r, p);
    let warn = '';
    if (st === 'restore') {
      if (r.src === 'proposal' && r.rev && p.revision > r.rev + 1) warn = 'This program was edited again after the AI change. Restoring puts back the version from before the AI change and replaces those later edits.';
      if (r.src === 'mcp' && r.after && !same(p.data, r.after)) warn = 'This program was edited again after the AI change. Restoring puts back the version from before the AI change and replaces those later edits.';
    }
    const txt = { restore: ['Restore the earlier version?', warn || 'This puts the program back the way it was before the AI change. The current version is kept in its version history.', 'Restore'],
      archive: ['Archive this program?', 'The program stays in your library under Archived and becomes read-only. Nothing is deleted.', 'Archive'],
      remove: ['Remove this program?', 'This deletes the program the AI created.', 'Remove'] }[st];
    if (!txt || !(await U.dialog({ title: txt[0], body: esc(txt[1]), ok: txt[2], danger: st === 'remove' || !!warn }))) return;
    H.busy = r.id; render();
    try {
      if (r.src === 'mcp' && live()) {
        const ss = await window.Auth.session(); if (!ss) throw new Error('Sign in first');
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ss.access_token }, body: JSON.stringify({ action: 'team_undo', workspace_id: s.key.split(':')[1], change_id: r.id }) });
        let j = {}; try { j = await res.json(); } catch { j = {}; }
        if (!res.ok) throw new Error(j.error || 'That change could not be restored');
        r.undone = true; H.busy = null;
        if (st === 'remove') { s.id = null; s.program = null; await load(true); } else { await load(true); await open(p.id); }
        U.toast(st === 'remove' ? 'Program removed' : 'Restored');
      } else {
        H.busy = null;
        const ok = await save({ id: p.id, revision: p.revision, data: P.normalize(st === 'restore' ? r.before : p.data), archived: st === 'archive' });
        if (ok) U.toast(st === 'archive' ? 'Program archived' : 'Restored');
      }
    } catch (e) { U.toast(e.message || 'That change could not be restored'); }
    H.busy = null; render();
  };
  window.OSPrograms = { load, state, api, open, review, upload, reset: () => { S = fresh(); }, list: () => state().rows,
    materials: () => state().materials, launch: brainstorm };
})();

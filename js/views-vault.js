// A reference notebook inside the vault. Saved and provisional are distinct states.
(() => {
  const U = window.UI, ACT = window.ACT, VS = window.VS, B = window.VaultBriefs;
  const { esc, icon } = U;
  const live = () => !!window.App?.isLive();
  const workspace = () => live() ? window.App.liveCtx().ws?.id || '' : 'demo';
  const currentRoute = () => location.hash.slice(1).split('?')[0] === 'swipe';
  const render = () => { if (currentRoute()) window.App.render(true); };
  const friendly = (e) => window.Auth?.friendly ? window.Auth.friendly(e) : e.message;
  const uid = () => crypto.randomUUID();
  let epoch = 0;
  let N;
  function sync() {
    const key = workspace();
    if (!N || N.key !== key) {
      epoch++;
      N = { key, rows: [], selected: null, at: 0, loading: false, error: '', next: null, search: '', filter: 'active', compose: null, edit: null, use: null, busy: false, retry: null, saveError: '', unsaved: null };
      if (!live()) {
        try { N.rows = JSON.parse(localStorage.getItem('founders-vault-demo') || '[]'); } catch { N.rows = []; }
        if (!Array.isArray(N.rows)) N.rows = [];
        N.at = Date.now(); N.selected = N.rows[0]?.id || null;
      }
    }
    return N;
  }
  function persistDemo() { if (!live()) { try { localStorage.setItem('founders-vault-demo', JSON.stringify(N.rows)); } catch { /* the current page still works */ } } }
  const sources = () => window.OSSwipeView?.rows() || [];
  const selectedNote = () => N.unsaved || N.rows.find((n) => n.id === N.selected);
  const request = (action, body = {}, key = N.key) => window.Auth.brainApi(action, { workspace_id: key, ...body });
  const valid = (key, ticket) => workspace() === key && N.key === key && epoch === ticket;
  function hasUnsavedWork() {
    const note = selectedNote();
    return !!(N.unsaved || N.edit && (N.edit.title !== note?.title || N.edit.body !== note?.body) ||
      N.compose && (N.compose.ids.length || N.compose.context.trim()) ||
      N.use && !N.use.result && (N.use.topic.trim() || N.use.context.trim() || N.use.offer));
  }
  async function canLeave() {
    if (N.busy) return false;
    if (!hasUnsavedWork()) return true;
    const key = N.key, ticket = epoch;
    const answer = await U.dialog({
      title: 'Leave without saving?',
      body: N.unsaved ? 'This generated brief has not been saved. Cancel to retry saving or copy it first.' : 'Your current work has not been saved. Cancel to keep working, or discard it to continue.',
      ok: 'Discard and continue', danger: true,
    });
    return !!answer && valid(key, ticket);
  }
  function clearWorking() {
    N.compose = null; N.edit = null; N.use = null; N.unsaved = null; N.retry = null; N.saveError = '';
  }
  function upsert(note) {
    N.rows = [note, ...N.rows.filter((n) => n.id !== note.id)].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at) - new Date(a.updated_at));
    N.selected = note.id; persistDemo();
  }
  async function load(force = false, more = false) {
    sync();
    if (!live() || !N.key || N.loading || (!force && N.at && Date.now() - N.at < 60000)) return;
    const key = N.key, ticket = epoch, offset = more ? N.next : 0;
    if (more && offset == null) return;
    N.loading = true; N.error = ''; render();
    try {
      const result = await request('vault-list', { offset }, key);
      if (!valid(key, ticket)) return;
      N.rows = more ? [...N.rows, ...result.notes.filter((n) => !N.rows.some((r) => r.id === n.id))] : result.notes;
      N.next = result.next; N.selected = N.rows.some((n) => n.id === N.selected) ? N.selected : N.rows.find((n) => !n.archived)?.id || null;
    } catch (e) { if (valid(key, ticket)) N.error = friendly(e); }
    finally { if (valid(key, ticket)) { N.loading = false; N.at = Date.now(); render(); } }
  }
  function tabs(count, more) {
    sync(); load();
    const tab = VS.vaultTab || 'examples';
    const known = N.rows.length > 0 || N.at && !N.error && !N.loading;
    return `<div class="vi-tabs" role="group" aria-label="Vault view">
      <button class="${tab === 'examples' ? 'on' : ''}" data-action="vi-tab" data-tab="examples" aria-pressed="${tab === 'examples'}">Examples <span>${count}${more ? '+' : ''}</span></button>
      <button class="${tab === 'inspiration' ? 'on' : ''}" data-action="vi-tab" data-tab="inspiration" aria-pressed="${tab === 'inspiration'}">Inspiration${known ? ` <span>${N.rows.filter((n) => !n.archived).length}${N.next != null ? '+' : ''}</span>` : ''}</button>
    </div>`;
  }
  function notice(text, retry) {
    return text ? `<div class="vi-error" role="alert"><p>${esc(text)}</p>${retry ? `<button class="btn sm" data-action="${retry}" ${N.busy ? 'disabled' : ''}>${retry === 'vi-retry-save' ? 'Retry saving' : 'Try again'}</button>` : ''}</div>` : '';
  }
  function noteList() {
    const query = N.search.toLowerCase().trim();
    const rows = N.rows.filter((n) => (N.filter === 'archived' ? n.archived : !n.archived) &&
      (!query || [n.title, n.body, n.context, n.purpose, ...(n.sources || []).map((s) => s.title)].join(' ').toLowerCase().includes(query)));
    return `<aside class="vi-list" aria-label="Saved inspiration">
      <label class="vi-search">${icon('search')}<input class="input" type="search" value="${esc(N.search)}" data-vi-search placeholder="${N.next != null ? 'Search loaded briefs' : 'Search inspiration'}" aria-label="Search inspiration"></label>
      <div class="vi-filters" role="group" aria-label="Saved or archived"><button data-action="vi-filter" data-filter="active" aria-pressed="${N.filter === 'active'}">Saved</button><button data-action="vi-filter" data-filter="archived" aria-pressed="${N.filter === 'archived'}">Archived</button></div>
      <div class="vi-note-list">${rows.map((n) => `<button class="vi-note ${!N.unsaved && N.selected === n.id ? 'on' : ''}" data-action="vi-select" data-id="${esc(n.id)}" aria-pressed="${!N.unsaved && N.selected === n.id}">
        <span class="vi-note-name">${n.pinned ? icon('star') : ''}${esc(n.title)}</span><span class="meta">${esc(B.purposeName(n.purpose))} · ${(n.sources || []).length} reference${n.sources?.length === 1 ? '' : 's'}</span>
      </button>`).join('') || `<p class="meta vi-list-empty">${query ? 'No matching briefs in this list.' : N.filter === 'archived' ? 'Nothing archived.' : 'Your saved briefs will appear here.'}</p>`}</div>
      ${N.next != null ? `<button class="btn sm vi-more" data-action="vi-more" ${N.loading ? 'disabled' : ''}>${N.loading ? 'Loading' : 'Load more briefs'}</button>` : ''}
    </aside>`;
  }
  function bodyHTML(note) {
    const refs = new Set((note.sources || []).map((s) => s.ref));
    const inline = (value) => esc(value).replace(/\[(S\d+)\]/g, (all, ref) => refs.has(ref) ? `<button class="vi-cite" data-action="vi-source" data-ref="${ref}" aria-label="Open reference ${ref}">${ref}</button>` : all);
    return String(note.body || '').split(/\n{2,}/).map((part) => {
      if (part.startsWith('### ')) return '<h4>' + inline(part.slice(4)) + '</h4>';
      if (part.startsWith('## ')) return '<h3>' + inline(part.slice(3)) + '</h3>';
      if (part.startsWith('# ')) return '<h3>' + inline(part.slice(2)) + '</h3>';
      if (part.startsWith('- ')) return '<ul>' + part.split(/\n(?=- )/).map((p) => '<li>' + inline(p.replace(/^- /, '')) + '</li>').join('') + '</ul>';
      return '<p>' + inline(part).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function sourceState(source) {
    const state = window.OSSwipeView?.state(), row = sources().find((r) => r.id === source.id);
    if (row) return B.fingerprint(row) !== source.fingerprint ? 'Example changed since this summary' : source.coverage === 'limited' ? 'Limited material' : '';
    return state?.at && !state.more && !state.error && !state.loading ? 'Original removed; reference kept' : '';
  }
  function sourceHTML(note) {
    return `<section class="vi-sources"><h3>Saved references</h3>${(note.sources || []).map((s) => `<div class="vi-source-row">
      <span class="vi-source-label">${esc(s.ref)}</span><div class="grow"><button class="linkish" data-action="vi-source" data-ref="${esc(s.ref)}">${esc(s.title)}</button>
      <span class="meta">${esc([s.brand, sourceState(s)].filter(Boolean).join(' · '))}</span></div>
      ${B.url(s.url) ? `<a href="${esc(B.url(s.url))}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" aria-label="Visit ${esc(s.title)}">${icon('out')}</a>` : ''}
    </div>`).join('')}</section>`;
  }
  function detail() {
    const note = selectedNote();
    if (!note) return `<section class="vi-empty"><h2>Keep more than the link.</h2><p>Turn the examples you save into a brief you can use again. Compare offer structures, copy angles and funnel steps, then adapt them to your own business.</p><button class="btn primary" data-action="vi-new">${icon('sparkle')}Create an inspiration brief</button><p class="meta">Your Brand DNA stays yours. Other businesses stay references.</p></section>`;
    if (N.edit) return editForm(note);
    if (N.use) return useForm(note);
    const unsaved = !!N.unsaved;
    return `<article class="vi-document">
      <div class="vi-document-head"><h2>${esc(note.title)}</h2><p class="meta">${esc(B.purposeName(note.purpose))} · ${unsaved ? 'Not saved yet' : note.archived ? 'Archived' : 'Saved inspiration'} · ${esc(note.by || 'Saved breakdowns')}</p></div>
      ${notice(N.saveError, N.retry ? 'vi-retry-save' : null)}
      ${note.archived ? '<p class="vi-status">Archived briefs are never added to AI context.</p>' : ''}
      <div class="actions vi-document-actions">
        ${!unsaved && !note.archived ? '<button class="btn primary" data-action="vi-use">Use this brief</button>' : ''}
        <button class="btn" data-action="vi-copy">${icon('copy')}Copy</button>
        ${!unsaved ? `<div class="vi-note-tools"><button class="btn ghost" data-action="vi-edit" ${N.busy ? 'disabled' : ''}>${icon('edit')}Edit</button><button class="btn ghost" data-action="vi-pin" aria-pressed="${!!note.pinned}" ${N.busy ? 'disabled' : ''}>${icon('star')}${note.pinned ? 'Unpin' : 'Pin'}</button></div>` : ''}
      </div>
      ${!unsaved && !note.archived ? `<label class="vi-auto"><input type="checkbox" data-vi-enabled ${note.enabled ? 'checked' : ''} ${N.busy ? 'disabled' : ''}><span>Use automatically when relevant<span class="meta">Offers, sales copy, email sequences and Funnel Agent can draw from this brief.</span></span></label>` : ''}
      ${note.context ? `<details class="vi-context"><summary>The context you supplied</summary><p>${esc(note.context).replace(/\n/g, '<br>')}</p></details>` : ''}
      <div class="vi-prose">${bodyHTML(note)}</div>
      ${sourceHTML(note)}
      ${!unsaved ? `<footer class="vi-document-foot"><span class="meta">Reference ideas, not approved founder facts${note.dna_version ? ' · Created with DNA v' + Number(note.dna_version) : ''}</span><button class="linkish" data-action="vi-archive" ${N.busy ? 'disabled' : ''}>${note.archived ? 'Restore brief' : 'Archive brief'}</button><button class="linkish" data-action="vi-resummarize" ${N.busy || note.archived ? 'disabled' : ''}>Create an updated brief</button></footer>` : ''}
    </article>`;
  }
  function createForm() {
    const c = N.compose, query = c.query.toLowerCase().trim(), state = window.OSSwipeView?.state();
    const rows = sources().filter((r) => !query || [r.title, r.brand, r.notes].join(' ').toLowerCase().includes(query));
    return `<section class="vi-compose">
      <button class="linkish vi-back" data-action="vi-back" ${N.busy ? 'disabled' : ''}>${icon('arrowleft')}Back to inspiration</button>
      <h2>What do you want to take from these?</h2><p class="vi-intro">Choose one example or compare several. The brief separates what is on the page from ideas you could try with your own offers.</p>
      <form data-vi-compose><fieldset ${N.busy ? 'disabled' : ''}>
        <div class="vi-compose-grid"><div class="vi-source-picker">
          <div class="vi-picker-head"><h3>Examples <span class="meta">${c.ids.length} of ${B.MAX_SOURCES} selected</span></h3><button type="button" class="linkish" data-action="vi-select-visible">Select visible</button></div>
          <label class="vi-search">${icon('search')}<input class="input" type="search" data-vi-source-search value="${esc(c.query)}" placeholder="Find an example" aria-label="Find an example"></label>
          <div class="vi-source-options">${rows.map((r) => `<label class="vi-source-option"><input type="checkbox" data-vi-source-id="${esc(r.id)}" ${c.ids.includes(r.id) ? 'checked' : ''} ${!c.ids.includes(r.id) && c.ids.length >= B.MAX_SOURCES ? 'disabled' : ''}>
            <span><b>${esc(r.title || r.analysis?.name || 'Untitled example')}</b><span class="meta">${esc([r.brand, B.coverage(r) === 'limited' ? 'Needs more page text or screenshots' : r.kind].filter(Boolean).join(' · '))}</span></span></label>`).join('') || `<p class="meta">${state?.loading ? 'Loading your examples' : 'No examples match. Save an example in the Examples tab first.'}</p>`}</div>
          ${state?.error ? notice(state.error, 'sw-retry') : ''}
          ${state?.more ? '<button class="btn sm vi-more" type="button" data-action="sw-more">Load more examples</button>' : ''}
        </div><div class="vi-brief-fields">
          <label class="field"><span>Save this for</span><select name="purpose" data-vi-field="purpose">${B.PURPOSES.map(([id, title]) => `<option value="${id}" ${c.purpose === id ? 'selected' : ''}>${title}</option>`).join('')}</select></label>
          <label class="field"><span>Your context <span class="meta">optional</span></span><textarea rows="8" name="context" data-vi-field="context" maxlength="5000" placeholder="What are you creating? What caught your eye? Which parts should the summary focus on?">${esc(c.context)}</textarea></label>
          <p class="vi-context-note">${icon('dna')}<span>Uses your current <a href="#dna">Brand DNA</a>, offers and writing context. References are never saved as your own facts.</span></p>
          <p class="meta">Up to 12 examples per brief. Uses saved text and readings, so no pages are reread or AI calls made until you press the button.</p>
        </div></div>
        ${notice(c.error)}
        <div class="actions vi-compose-actions"><button class="btn primary" type="submit" ${!c.ids.length ? 'disabled' : ''}>${N.busy ? U.spin + 'Summarizing and saving' : icon('sparkle') + 'Summarize and save'}</button><span class="meta" role="status">${N.busy ? 'Your original examples stay unchanged.' : live() ? 'Saved privately to this workspace' : 'Sample workspace; no provider calls'}</span></div>
      </fieldset></form>
    </section>`;
  }
  function editForm(note) {
    const e = N.edit;
    return `<section class="vi-document"><button class="linkish vi-back" data-action="vi-back" ${N.busy ? 'disabled' : ''}>${icon('arrowleft')}Back to brief</button>
      <h2>Edit inspiration</h2><form data-vi-edit><fieldset ${N.busy ? 'disabled' : ''}>
        <label class="field"><span>Title</span><input required maxlength="160" name="title" data-vi-edit-field="title" value="${esc(e.title)}"></label>
        <label class="field"><span>The brief</span><textarea class="vi-editor" rows="23" name="body" required minlength="20" maxlength="24000" data-vi-edit-field="body">${esc(e.body)}</textarea></label>
        <p class="meta">Keep [S1], [S2] and the other reference markers beside the observations they support. Your edits guide future drafts, not Brand DNA.</p>
        ${notice(N.saveError, N.retry ? 'vi-retry-save' : null)}<div class="actions"><button class="btn primary">${N.busy ? U.spin + 'Saving' : 'Save changes'}</button><button type="button" class="btn ghost" data-action="vi-copy-edit">Copy edited text</button></div>
      </fieldset></form></section>`;
  }
  const TYPES = [['offer', 'Offer outline'], ['sales-page', 'Sales page copy'], ['email', 'Email draft'], ['lead-magnet', 'Lead magnet'], ['funnel', 'Funnel Agent']];
  function useForm(note) {
    const f = N.use, offers = (window.DNA?.data()?.items || []).filter((o) => o.kind === 'offer' && o.included);
    return `<section class="vi-document vi-use"><button class="linkish vi-back" data-action="vi-back" ${N.busy ? 'disabled' : ''}>${icon('arrowleft')}Back to brief</button>
      <h2>Make it yours.</h2><p class="vi-intro">Use “${esc(note.title)}” as a reference, with your current Brand DNA and the context below.</p>
      <form data-vi-use><fieldset ${N.busy ? 'disabled' : ''}>
        <label class="field"><span>Create</span><select name="type" data-vi-use-field="type">${TYPES.map(([id, title]) => `<option value="${id}" ${f.type === id ? 'selected' : ''}>${title}</option>`).join('')}</select></label>
        <label class="field"><span>Existing offer <span class="meta">optional</span></span><select name="offer" data-vi-use-field="offer"><option value="">New idea or no specific offer</option>${offers.map((o) => `<option value="${esc(o.id)}" ${f.offer === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
        <label class="field"><span>${f.type === 'funnel' ? 'Offer or page name' : 'What are you creating?'}</span><input name="topic" required minlength="4" maxlength="200" data-vi-use-field="topic" value="${esc(f.topic)}" placeholder="A starter offer for my audience"></label>
        <label class="field"><span>Context for this draft</span><textarea rows="7" name="context" maxlength="5000" data-vi-use-field="context" placeholder="Your audience, the result, what to borrow, and what to leave out. Add confirmed terms here if they are not yet in Brand DNA.">${esc(f.context)}</textarea></label>
        <p class="vi-context-note">${icon('dna')}<span>The latest own context is read again when you create. Another seller’s proof, prices and identity are not yours to reuse.</span></p>
        ${notice(f.error)}<div class="actions"><button class="btn primary">${N.busy ? U.spin + 'Writing your draft' : f.type === 'funnel' ? 'Open Funnel Agent' : 'Create draft'}</button><span class="meta">${f.type === 'funnel' ? 'Review the intake before the build starts' : f.type === 'offer' ? 'Saves to Offers, in production' : 'Saves to the Newsfeed; nothing publishes'}</span></div>
      </fieldset></form>
      ${f.result ? `<section class="vi-result" role="status"><h3>Your draft is ready.</h3><p>${esc(f.result.draft?.title || 'Draft')}</p><div class="actions"><a class="btn primary" href="#${f.result.destination || 'approvals'}">Review in ${f.result.destination === 'offers' ? 'Offers' : 'the Newsfeed'}</a><button class="btn" data-action="vi-copy-result">${icon('copy')}Copy draft</button></div></section>` : ''}
    </section>`;
  }
  function view() {
    sync();
    if (N.compose) return createForm();
    if (N.error && !N.rows.length && !selectedNote()) return notice(N.error, 'vi-reload');
    if (N.loading && !N.at) return '<section class="vi-empty" role="status"><h2>Loading your inspiration</h2><p>Your saved briefs will appear here.</p></section>';
    return notice(N.error, 'vi-reload') + `<div class="vi-workspace">${noteList()}${detail()}</div>`;
  }
  async function compose(chosen = [], purpose = 'general', context = '') {
    sync(); if (!await canLeave()) return;
    clearWorking();
    N.compose = { ids: chosen.slice(0, B.MAX_SOURCES), purpose: B.purpose(purpose), context, query: '', error: '', requestId: uid() };
    VS.vaultTab = 'inspiration';
    U.closeDrawer(); location.hash = '#swipe'; render();
    requestAnimationFrame(() => document.querySelector('[data-vi-source-search]')?.focus());
  }
  async function generate() {
    const c = N.compose; if (!c || N.busy || !c.ids.length) return;
    const key = N.key, ticket = epoch;
    N.busy = true; c.error = ''; render();
    try {
      const payload = { source_ids: c.ids.slice(), purpose: c.purpose, context: c.context, request_id: c.requestId };
      let result;
      if (live()) result = await request('vault-summarize', payload, key);
      else {
        const rows = c.ids.map((id) => sources().find((r) => r.id === id)).filter(Boolean);
        const body = B.fallback(rows, c); if (!body) throw new Error('These examples need more page text or screenshots before they can be summarized.');
        result = { saved: true, note: { ...body, id: c.requestId, sources: rows.map(B.source), purpose: c.purpose, context: c.context, by: 'Sample saved breakdowns', revision: 1, enabled: true, pinned: false, archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
      }
      if (!valid(key, ticket)) return;
      N.compose = null; N.unsaved = result.saved ? null : result.note;
      if (result.saved) { upsert(result.note); N.retry = null; U.toast('Inspiration saved'); }
      else {
        N.saveError = result.save_error || 'The summary is ready but could not be saved.';
        N.retry = { id: result.note.id, create: true, note: result.note };
      }
    } catch (e) { if (valid(key, ticket)) c.error = friendly(e); }
    finally { if (valid(key, ticket)) { N.busy = false; render(); } }
  }
  async function save(payload) {
    if (N.busy) return;
    const key = N.key, ticket = epoch;
    N.busy = true; N.saveError = ''; N.retry = payload; render();
    try {
      let result;
      if (live()) result = await request('vault-save', payload, key);
      else {
        const old = N.rows.find((n) => n.id === payload.id) || N.unsaved;
        result = { note: { ...old, ...(payload.patch || {}), revision: (old?.revision || 0) + 1, updated_at: new Date().toISOString() } };
      }
      if (!valid(key, ticket)) return;
      upsert(result.note); N.unsaved = null; N.retry = null; N.edit = null; U.toast('Brief saved');
    } catch (e) { if (valid(key, ticket)) N.saveError = friendly(e); }
    finally { if (valid(key, ticket)) { N.busy = false; render(); } }
  }
  function patch(changes) {
    const note = selectedNote(); if (!note || N.unsaved) return;
    return save({ id: note.id, revision: note.revision, patch: changes });
  }
  async function createDraft() {
    const note = selectedNote(), f = N.use;
    if (!note || !f || N.busy) return;
    const offer = (window.DNA?.data()?.items || []).find((o) => o.id === f.offer);
    const extra = [offer ? 'Focus on my own offer: ' + offer.name : '', f.context].filter(Boolean).join('\n\n');
    if (f.type === 'funnel') {
      return window.V['funnel-agent'].start(f.offer || null, { name: f.topic, context: extra, inspiration_ids: [note.id], inspiration_title: note.title });
    }
    if (!live()) { f.error = 'Draft generation uses your connected AI in your private workspace. This sample does not make provider calls.'; return render(); }
    const key = N.key, ticket = epoch;
    N.busy = true; f.error = ''; f.result = null; render();
    try {
      const result = await request('build', { type: f.type, topic: f.topic, extra, item_id: f.offer || null, inspiration_ids: [note.id], destination: f.type === 'offer' ? 'offers' : 'approvals' }, key);
      if (!valid(key, ticket)) return;
      f.result = result; window.App.refreshCounts?.();
      if (result.destination === 'offers') ACT['mb-offer-retry']?.();
    } catch (e) { if (valid(key, ticket)) f.error = friendly(e); }
    finally { if (valid(key, ticket)) { N.busy = false; render(); } }
  }
  ACT['vi-tab'] = (el) => { sync(); VS.vaultTab = el.dataset.tab; render(); };
  ACT['vi-open'] = () => { sync(); VS.vaultTab = 'inspiration'; location.hash = '#swipe'; render(); };
  ACT['vi-new'] = () => compose();
  ACT['vi-from-source'] = (el) => compose([el.dataset.id]);
  ACT['vi-reload'] = () => load(true);
  ACT['vi-more'] = () => load(true, true);
  ACT['vi-filter'] = (el) => { N.filter = el.dataset.filter; render(); };
  ACT['vi-select'] = async (el) => { const id = el.dataset.id; if (!await canLeave()) return; clearWorking(); N.selected = id; render(); };
  ACT['vi-select-visible'] = () => {
    const c = N.compose; if (!c || N.busy) return;
    const visible = sources().filter((r) => !c.query || [r.title, r.brand, r.notes].join(' ').toLowerCase().includes(c.query.toLowerCase())).map((r) => r.id);
    c.ids = [...new Set([...c.ids, ...visible])].slice(0, B.MAX_SOURCES); c.requestId = uid(); render();
  };
  ACT['vi-back'] = async () => { if (!await canLeave()) return; clearWorking(); render(); };
  ACT['vi-copy'] = () => { const n = selectedNote(); if (n) U.copy(B.exportText(n)); };
  ACT['vi-copy-edit'] = () => { if (N.edit) U.copy(N.edit.title + '\n\n' + N.edit.body); };
  ACT['vi-copy-result'] = () => { if (N.use?.result?.draft) U.copy(N.use.result.draft.body); };
  ACT['vi-edit'] = () => { if (N.busy) return; const n = selectedNote(); if (n) { N.edit = { title: n.title, body: n.body }; N.saveError = ''; render(); } };
  ACT['vi-use'] = () => { const n = selectedNote(); if (!n || N.busy) return; N.use = { type: n.purpose === 'offers' ? 'offer' : n.purpose === 'funnels' ? 'funnel' : n.purpose === 'emails' ? 'email' : 'sales-page', offer: '', topic: '', context: '', error: '' }; N.saveError = ''; window.DNA?.load?.().then(render).catch(() => {}); render(); };
  ACT['vi-pin'] = () => { const n = selectedNote(); if (n) patch({ pinned: !n.pinned }); };
  ACT['vi-archive'] = () => { const n = selectedNote(); if (n) patch({ archived: !n.archived }); };
  ACT['vi-resummarize'] = () => { const n = selectedNote(); if (n) compose(n.sources.map((s) => s.id).filter((id) => sources().some((r) => r.id === id)), n.purpose, n.context); };
  ACT['vi-retry-save'] = () => { if (N.retry) save(N.retry); };
  ACT['vi-source'] = async (el) => {
    const note = selectedNote(), ref = note?.sources?.find((s) => s.ref === el.dataset.ref);
    if (!ref) return;
    try { if (!await window.OSSwipeView.openSource(ref.id)) U.toast('The original was removed. Its saved reference and web link remain in this brief.'); }
    catch (e) { U.toast(friendly(e)); }
  };
  document.addEventListener('submit', (e) => {
    if (e.target.matches('[data-vi-compose]')) { e.preventDefault(); generate(); }
    if (e.target.matches('[data-vi-edit]')) { e.preventDefault(); patch({ title: N.edit.title, body: N.edit.body }); }
    if (e.target.matches('[data-vi-use]')) { e.preventDefault(); createDraft(); }
  });
  const redrawInput = (node, selector) => {
    const pos = node.selectionStart; render();
    const next = document.querySelector(selector); if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch { /* some input types have no text selection */ } }
  };
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-vi-search]')) { N.search = t.value; redrawInput(t, '[data-vi-search]'); }
    if (t.matches('[data-vi-source-search]') && N.compose) { N.compose.query = t.value; redrawInput(t, '[data-vi-source-search]'); }
    if (t.dataset.viField && N.compose) { N.compose[t.dataset.viField] = t.value; N.compose.requestId = uid(); }
    if (t.dataset.viEditField && N.edit) N.edit[t.dataset.viEditField] = t.value;
    if (t.dataset.viUseField && N.use) N.use[t.dataset.viUseField] = t.value;
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.viSourceId && N.compose && !N.busy) {
      const c = N.compose, id = t.dataset.viSourceId;
      c.ids = t.checked ? [...new Set([...c.ids, id])].slice(0, B.MAX_SOURCES) : c.ids.filter((x) => x !== id); c.requestId = uid(); render();
    }
    if (t.matches('[data-vi-enabled]')) patch({ enabled: t.checked });
    if (t.dataset.viField && N.compose) { N.compose[t.dataset.viField] = t.value; N.compose.requestId = uid(); }
    if (t.dataset.viUseField && N.use) { N.use[t.dataset.viUseField] = t.value; if (t.dataset.viUseField === 'type') render(); }
  });
  window.addEventListener('beforeunload', (e) => {
    if (N && (N.busy || hasUnsavedWork())) { e.preventDefault(); e.returnValue = ''; }
  });
  window.OSVault = { tabs, view, compose, load, reset: () => { N = null; sync(); }, state: () => N };
})();

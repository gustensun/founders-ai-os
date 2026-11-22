// Founders AI OS: Playbook, admin only. The core answers the AI Coach uses first. The admin corrects and approves
// each one; approved answers become the backbone whenever a member asks something close to it. Drafts are
// never shown to members. The database enforces admin access, this screen only asks.
(() => {
  const BOT = () => (window.CoachGuard && window.CoachGuard.coachLabel ? window.CoachGuard.coachLabel() : 'AI Coach');
  const U = window.UI, V = window.V, ACT = window.ACT;
  const { esc, icon } = U;
  const VS = () => (window.VS = window.VS || {});
  const S = { items: null, topics: [], loading: false, err: null, open: null, q: '', dirty: {}, busy: null };
  const ws = () => { const c = window.App.liveCtx && window.App.liveCtx(); return c && c.ws && c.ws.id; };

  async function api(action, body = {}) {
    const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, workspace_id: ws(), ...body }) });
    let j = {}; try { j = await r.json(); } catch { j = {}; }
    if (!r.ok) throw new Error(j.error || 'That did not work. Try again.');
    return j;
  }
  async function load(force) {
    if (S.loading || (S.items && !force)) return;
    S.loading = true; S.err = null; paint();
    try { const r = await api('playbook-list'); S.items = r.items || []; S.topics = r.topics || []; }
    catch (e) { S.err = e.message; }
    S.loading = false; paint();
  }
  const root = () => document.querySelector('[data-pb]');
  function paint() { const el = root(); if (el) el.innerHTML = body(); }

  const words = (t) => (String(t || '').trim() ? String(t).trim().split(/\s+/).length : 0);
  const match = (it) => { const q = S.q.trim().toLowerCase(); return !q || (it.question + ' ' + it.keywords + ' ' + it.answer + ' ' + it.topic).toLowerCase().includes(q); };
  const val = (it, k) => (S.dirty[it.id] && k in S.dirty[it.id] ? S.dirty[it.id][k] : it[k]);

  function editor(it) {
    const topics = [...new Set([...(S.topics || []), it.topic].filter(Boolean))];
    const approved = it.status === 'approved'; const busy = S.busy === it.id;
    const src = val(it, 'sources'); const srcTxt = Array.isArray(src) ? src.join(', ') : src || '';
    return `<div class="pb-edit" data-pbedit="${it.id}">
      <div class="pb-grid">
        <label class="field"><span>Question</span><input name="question" value="${esc(val(it, 'question'))}" maxlength="300"></label>
        <label class="field"><span>Topic</span><select name="topic">${topics.map((t) => `<option ${t === val(it, 'topic') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span>Answer, in your voice</span><textarea name="answer" rows="9" maxlength="8000">${esc(val(it, 'answer'))}</textarea></label>
      <div class="pb-grid">
        <label class="field"><span>Other ways people ask it</span><input name="keywords" value="${esc(val(it, 'keywords'))}" maxlength="400" placeholder="Words members use for this question"></label>
        <label class="field"><span>Sources</span><input name="sources" value="${esc(srcTxt)}" placeholder="Framework titles, separated by commas"></label>
      </div>
      <div class="pb-foot">
        <span class="meta" data-pbwords>${words(val(it, 'answer'))} words</span>
        <span class="grow"></span>
        ${it.id !== 'new' ? `<button class="btn sm ghost" data-action="pb-del" data-id="${it.id}" ${busy ? 'disabled' : ''}>Delete</button>` : ''}
        ${approved ? `<button class="btn sm" data-action="pb-save" data-id="${it.id}" data-v="draft" ${busy ? 'disabled' : ''}>Back to draft</button>
          <button class="btn sm primary" data-action="pb-save" data-id="${it.id}" data-v="approved" ${busy ? 'disabled' : ''}>${busy ? U.spin : ''}Save</button>`
        : `<button class="btn sm" data-action="pb-save" data-id="${it.id}" data-v="draft" ${busy ? 'disabled' : ''}>Save draft</button>
          <button class="btn sm primary" data-action="pb-save" data-id="${it.id}" data-v="approved" ${busy ? 'disabled' : ''}>${busy ? U.spin : ''}Approve</button>`}
      </div>
    </div>`;
  }
  function row(it) {
    const open = S.open === it.id; const approved = it.status === 'approved';
    return `<div class="pb-row${open ? ' open' : ''}" data-pbrow="${it.id}">
      <button class="pb-head" data-action="pb-open" data-id="${it.id}" aria-expanded="${open}">
        <span class="pb-dot ${approved ? 'on' : ''}" aria-hidden="true"></span>
        <span class="pb-q">${esc(it.question)}</span>
        <span class="pb-st meta">${approved ? 'Approved' : S.dirty[it.id] ? 'Unsaved edits' : 'Draft'}</span>
        ${icon('chevron')}
      </button>
      ${open ? editor(it) : ''}
    </div>`;
  }

  function body() {
    if (S.err) return `<section class="panel">${U.empty('The Playbook did not load', esc(S.err), '<button class="btn" data-action="pb-reload">Try again</button>')}</section>`;
    if (!S.items) return `<p class="meta pb-load">${U.spin}Loading the Playbook</p>`;
    const all = S.items; const ok = all.filter((x) => x.status === 'approved').length;
    if (!all.length && S.open !== 'new') return `<section class="panel">${U.empty('The Playbook is empty', 'Start with 100 starter answers built on the coach frameworks: the 17Ps, the Funnel Formula, the 11 Step Conversion Checklist, offers, content and closing. They go live for ' + esc(BOT()) + ' right away, and you can edit, move back to draft or delete any of them.', `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:center"><button class="btn primary" data-action="pb-import" ${S.busy === 'import' ? 'disabled' : ''}>${S.busy === 'import' ? U.spin + 'Adding 100 answers' : 'Add the starter answers'}</button><button class="btn" data-action="pb-add">Write your own</button></div>`)}</section>`;
    const tab = VS().pbTab || 'all';
    const shown = all.filter((x) => (tab === 'all' || x.status === tab) && match(x));
    const pct = all.length ? Math.round((ok / all.length) * 100) : 0;
    const groups = []; for (const it of shown) { let g = groups.find((x) => x.t === it.topic); if (!g) groups.push(g = { t: it.topic, rows: [] }); g.rows.push(it); }
    const draft = S.open === 'new' ? { id: 'new', topic: (S.topics || [])[0] || 'General', question: '', keywords: '', answer: '', sources: [], status: 'draft' } : null;
    return `<div class="pb-progress"><div class="pb-count"><b>${ok}</b> of ${all.length} approved</div><div class="pb-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>
      <div class="pb-tools">${U.seg('pbTab', tab, [['all', `All <span class="meta">${all.length}</span>`], ['draft', `Drafts <span class="meta">${all.length - ok}</span>`], ['approved', `Approved <span class="meta">${ok}</span>`]])}
        <label class="pb-search">${icon('search')}<input type="search" data-pbq placeholder="Search questions and answers" value="${esc(S.q)}" aria-label="Search the Playbook"></label></div>
      ${draft ? `<section class="pb-group"><h2 class="out">New question</h2><div class="pb-row open" data-pbrow="new">${editor(draft)}</div></section>` : ''}
      ${groups.length ? groups.map((g) => `<section class="pb-group"><h2 class="out">${esc(g.t)} <span class="meta">${g.rows.filter((x) => x.status === 'approved').length} of ${g.rows.length}</span></h2><div class="pb-list">${g.rows.map(row).join('')}</div></section>`).join('')
        : `<section class="panel">${U.empty(S.q ? 'Nothing matches' : tab === 'approved' ? 'Nothing approved yet' : 'No drafts left', S.q ? 'Try other words.' : tab === 'approved' ? 'Open a draft, correct it and approve it. It goes live for ' + BOT() + ' right away.' : 'Every answer is approved.')}</section>`}`;
  }

  V.playbook = () => V.playbook.live();
  V.playbook.live = () => {
    const App = window.App;
    if (!App.isAdmin || !App.isAdmin()) return `${U.title('Playbook')}<section class="panel">${U.empty('Admins only', 'Only an admin can edit the answers ' + BOT() + ' uses.')}</section>`;
    if (!S.items && !S.loading && !S.err) setTimeout(() => load(), 0);
    return `${U.title('Playbook', 'The core answers ' + BOT() + ' uses first. When a member asks something close to an approved answer, it becomes the backbone of the reply, with a few library passages for detail. Drafts are never shown to members.', '<button class="btn" data-action="pb-add">' + icon('plus') + 'Add question</button>')}
      <div class="pb" data-pb>${body()}</div>`;
  };

  // Keep edits while the admin moves between questions.
  function capture(id) {
    const f = document.querySelector(`[data-pbedit="${id}"]`); if (!f) return null;
    const get = (n) => f.querySelector(`[name="${n}"]`).value;
    return { topic: get('topic'), question: get('question'), keywords: get('keywords'), answer: get('answer'), sources: get('sources') };
  }
  document.addEventListener('input', (e) => {
    const q = e.target.closest('[data-pbq]');
    if (q) { S.q = q.value; const pos = q.selectionStart; paint(); const n = document.querySelector('[data-pbq]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* search inputs */ } } return; }
    const f = e.target.closest('[data-pbedit]'); if (!f) return;
    const id = f.dataset.pbedit; S.dirty[id] = capture(id);
    const w = f.querySelector('[data-pbwords]'); if (w) w.textContent = words(S.dirty[id].answer) + ' words';
    const st = document.querySelector(`[data-pbrow="${id}"] .pb-st`); if (st) st.textContent = 'Unsaved edits';
  });
  document.addEventListener('change', (e) => { const f = e.target.closest('[data-pbedit]'); if (f) S.dirty[f.dataset.pbedit] = capture(f.dataset.pbedit); });

  ACT['pb-reload'] = () => { S.items = null; S.err = null; load(true); };
  ACT['pb-open'] = (el) => {
    const id = el.dataset.id; S.open = S.open === id ? null : id; paint();
    if (S.open) { const r = document.querySelector(`[data-pbrow="${id}"]`); if (r) { const t = r.querySelector('textarea'); if (t) t.style.height = Math.max(t.scrollHeight + 2, 180) + 'px'; const top = r.getBoundingClientRect().top; if (top < 70 || top > innerHeight - 120) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }
  };
  ACT['pb-add'] = () => { if (!S.items) return; S.open = 'new'; S.q = ''; VS().pbTab = 'all'; paint(); const i = document.querySelector('[data-pbrow="new"] [name="question"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } };
  ACT['pb-save'] = async (el) => {
    const id = el.dataset.id; const v = el.dataset.v;
    const cur = id === 'new' ? {} : S.items.find((x) => x.id === id) || {};
    const edits = capture(id) || S.dirty[id] || {};
    const item = { ...cur, ...edits, id: id === 'new' ? null : id, status: v };
    if (!String(item.question || '').trim()) { U.toast('Write the question first'); return; }
    if (v === 'approved' && words(item.answer) < 4) { U.toast('Write an answer before approving'); return; }
    S.busy = id; S.dirty[id] = edits; paint();
    try {
      const r = await api('playbook-save', { item });
      const saved = { ...item, ...r.item, id: r.id, approved_at: v === 'approved' ? cur.approved_at || new Date().toISOString() : null };
      if (id === 'new') S.items.push(saved); else S.items = S.items.map((x) => (x.id === id ? { ...x, ...saved } : x));
      delete S.dirty[id];
      const hadNote = r.item && edits.answer && r.item.answer !== edits.answer.trim();
      U.toast(hadNote ? 'Saved. A sentence with private details was removed.' : v === 'approved' ? (cur.status === 'approved' ? 'Saved. ' + BOT() + ' uses the new version now.' : 'Approved. ' + BOT() + ' uses this answer now.') : cur.status === 'approved' ? 'Back to draft. ' + BOT() + ' stops using it.' : 'Draft saved');
      if (v === 'approved' && cur.status !== 'approved') { const tab = VS().pbTab || 'all'; const list = S.items.filter((x) => (tab === 'all' || x.status === tab) && match(x)); const i = list.findIndex((x) => x.id === saved.id); const next = list.slice(i + 1).find((x) => x.status !== 'approved'); S.open = next ? next.id : null; }
      else S.open = id === 'new' ? saved.id : S.open;
    } catch (e) { U.toast(e.message); }
    S.busy = null; paint();
  };
  ACT['pb-import'] = async () => {
    if (S.busy) return; S.busy = 'import'; paint();
    try {
      const r = await api('playbook-import', { status: 'approved' });
      U.toast(r.failed ? `Added ${r.added} answers. ${r.failed} did not save, open the Playbook again to see what is there.` : `Added ${r.added} answers. ${BOT()} uses them now.`);
      S.busy = null; S.items = null; await load(true);
    } catch (e) { S.busy = null; paint(); U.toast(e.message); }
  };
  ACT['pb-del'] = async (el) => {
    const id = el.dataset.id; const it = S.items.find((x) => x.id === id); if (!it) return;
    if (!(await U.dialog({ title: 'Delete this question?', body: BOT() + ' stops using it. This cannot be undone.', ok: 'Delete', danger: true }))) return;
    try { await api('playbook-delete', { id }); S.items = S.items.filter((x) => x.id !== id); delete S.dirty[id]; S.open = null; paint(); U.toast('Deleted'); }
    catch (e) { U.toast(e.message); }
  };
  window.Playbook = { reload: () => ACT['pb-reload']() };
})();

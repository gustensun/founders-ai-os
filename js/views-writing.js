// Founders AI OS: How you write. The founder pastes in pieces they wrote themself. The OS studies them into a
// voiceprint, and the voiceprint plus a few real examples go into the Brand DNA that every agent reads first.
(() => {
  const St = window.Store, U = window.UI, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const VP = () => window.Voiceprint;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const KINDS = [['email', 'Email'], ['post', 'Post'], ['script', 'Script'], ['caption', 'Caption'], ['newsletter', 'Newsletter'], ['page', 'Sales page'], ['message', 'Message'], ['other', 'Other']];
  const KN = Object.fromEntries(KINDS);
  const MIN = 40, MAX = 60000;
  VS.wrDraft = VS.wrDraft || { title: '', kind: 'email', body: '' };

  /* ---------- state ---------- */
  const L = { ws: null, samples: [], style: null, at: 0, loading: false, err: '', saving: false, studying: false };
  const aiOn = () => isLive() && (ctx().conns || []).some((c) => /^(claude|openai|perplexity)$/.test(c.provider) && c.status === 'connected');
  function load(force) {
    const w = isLive() && ctx().ws; if (!w || !w.id || L.loading || !window.Auth) return Promise.resolve();
    if (!force && L.ws === w.id && Date.now() - L.at < 15000) return Promise.resolve();
    L.loading = true;
    return Promise.all([Auth.writing.list(w.id), Auth.writing.style(w.id)])
      .then(([s, y]) => { L.samples = s; L.style = y; L.err = ''; })
      .catch((e) => { L.err = Auth.friendly(e); })
      .finally(() => { L.ws = w.id; L.at = Date.now(); L.loading = false; if (VS.view === 'dna') window.App.render(true); });
  }
  function samples() {
    if (!isLive()) return St.s.writing || (St.s.writing = []);
    const w = ctx().ws; if (w && w.id && (L.ws !== w.id || Date.now() - L.at > 60000)) load();
    return L.samples;
  }
  const sorted = (xs) => xs.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  // The voiceprint is always recomputed from every sample, so it matches the set exactly.
  function print(xs) { const p = VP().analyze(xs); return { profile: p, guide: VP().guide(p) }; }
  function aiFresh(xs) { const y = L.style; return !!(isLive() && y && y.ai_guide && y.ai_guide.length && y.ai_samples === xs.length); }
  async function restyle() {
    const xs = L.samples; const { profile, guide } = print(xs);
    L.style = await Auth.writing.saveStyle(ctx().ws.id, { profile: profile || {}, guide, samples: xs.length, words: xs.reduce((a, s) => a + (s.words || 0), 0) });
    if (window.DNA) window.DNA.load(true);
  }
  async function study(quiet) {
    if (!isLive() || L.studying || !L.samples.length) return;
    if (!aiOn()) { if (!quiet) U.toast('Connect Claude, OpenAI or Perplexity in Connections to study your writing with AI'); return; }
    L.studying = true; if (VS.view === 'dna') window.App.render(true);
    try { const r = await Auth.brainApi('voice-study', { workspace_id: ctx().ws.id }); L.style = r.style || L.style; if (!quiet) U.toast(`${r.by || 'AI'} studied ${L.samples.length} piece${L.samples.length === 1 ? '' : 's'}`); if (window.DNA) window.DNA.load(true); }
    catch (e) { if (!quiet) U.toast(Auth.friendly(e)); }
    finally { L.studying = false; if (VS.view === 'dna') window.App.render(true); }
  }

  /* ---------- view ---------- */
  const int = (n) => Math.round(+n || 0).toLocaleString('en-US');
  const date = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  function stats(p) {
    const s = p.stats;
    const tiles = [['Words per sentence', s.avg_sentence, s.short_pct + '% are 8 words or fewer'], ['Reading grade', Math.round(s.grade), s.grade <= 7 ? 'Plain, everyday words' : s.grade <= 10 ? 'Clear and direct' : 'Dense, technical'],
      ['"You" per 100 words', s.you_per100, '"I" ' + s.i_per100 + ' per 100'], ['Single-line paragraphs', s.one_line_pct + '%', 'About ' + s.para_sentences + ' sentences each']];
    return `<div class="wr-stats">${tiles.map(([l, v, d]) => `<div class="wr-stat"><span class="meta">${esc(l)}</span><b class="num">${esc(String(v))}</b><span class="meta">${esc(d)}</span></div>`).join('')}</div>`;
  }
  function panel() {
    const xs = sorted(samples()); const live = isLive();
    const words = xs.reduce((a, s) => a + (s.words || VP().count(s.body)), 0);
    const { profile, guide } = print(xs);
    const fresh = aiFresh(xs); const rules = fresh ? L.style.ai_guide : guide;
    const by = fresh ? (L.style.ai_by || 'AI') : 'the OS';
    const dr = VS.wrDraft; const n = VP().count(dr.body);
    const form = `<form class="wr-form" data-wrform="add">
        <div class="wr-row"><label class="field grow"><span>Title</span><input name="title" value="${esc(dr.title)}" maxlength="200" placeholder="Monday email, launch post, video intro" autocomplete="off" data-wrin="title"></label>
          <label class="field"><span>Type</span><select name="kind" data-wrin="kind">${KINDS.map(([v, l]) => `<option value="${v}" ${dr.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <label class="field"><span>Paste something you wrote yourself</span><textarea name="body" rows="9" maxlength="${MAX}" required placeholder="An email you sent, a post that did well, a script you recorded. Your words, not AI drafts. The more you add, the closer it gets." data-wrin="body">${esc(dr.body)}</textarea></label>
        <div class="wr-foot"><span class="meta" data-wrcount>${n ? int(n) + ' words' : 'At least a few sentences. Three or more pieces of different types work best.'}</span>
          <button class="btn primary" ${L.saving ? 'disabled' : ''}>${L.saving ? U.spin + 'Saving' : 'Save and study'}</button></div>
      </form>`;
    const print_ = profile ? `${stats(profile)}
        <div class="wr-guide"><p class="meta">What every agent is told about your writing${fresh ? ', written by ' + esc(by) : ''}</p><ol>${rules.map((g) => `<li>${esc(g)}</li>`).join('')}</ol></div>
        `
      : `<div class="wr-empty">${U.empty('No voiceprint yet', 'Save one piece you wrote and the OS studies it right away: rhythm, sentence length, reading level, how you open, the phrases you repeat and the words you never use.')}</div>`;
    const aiBtn = live && xs.length ? `<button class="btn sm" data-action="wr-study" ${L.studying ? 'disabled' : ''}>${L.studying ? U.spin + 'Studying' : fresh ? 'Study again with AI' : 'Study with AI'}</button>` : '';
    const aiNote = live ? (aiOn() ? (xs.length && !fresh && !L.studying ? '<p class="meta wr-note">AI study runs on its own after every save. The rules above are the instant version.</p>' : '') : '<p class="meta wr-note">Studied by rules in your browser right now. Connect Claude, OpenAI or Perplexity in Connections and the AI writes a deeper style guide from the same pieces.</p>')
      : '<p class="meta wr-note">Demo: three sample pieces. In your private workspace this studies what you paste and the AI writes the guide.</p>';
    const list = xs.length ? `<div class="rows wr-list">${xs.map((s) => `<div class="row click wr-item" data-action="wr-open" data-id="${esc(s.id)}" role="button" tabindex="0">
        <span class="tag">${esc((KN[s.kind] || 'Other').toUpperCase())}</span>
        <div class="grow"><div class="t">${esc(s.title)}</div><div class="s">${int(s.words || VP().count(s.body))} words \u00b7 ${esc(date(s.created_at))}${s.pinned ? ' \u00b7 Example in the DNA' : ''}</div></div>
        <button class="btn icon ghost sm wr-pin${s.pinned ? ' on' : ''}" data-action="wr-pin" data-id="${esc(s.id)}" aria-pressed="${!!s.pinned}" aria-label="${s.pinned ? 'Stop using' : 'Use'} ${esc(s.title)} as an example">${icon('star')}</button>
        <button class="btn icon ghost sm" data-action="wr-del" data-id="${esc(s.id)}" aria-label="Delete ${esc(s.title)}">${icon('close')}</button></div>`).join('')}</div>` : '';
    return `<section class="panel wr" id="dna-writing">
      <header><h2>How you write</h2><span class="meta">${xs.length ? `${xs.length} piece${xs.length === 1 ? '' : 's'} \u00b7 ${int(words)} words` : 'Teach the OS your voice'}</span>${aiBtn}</header>
      ${live && L.err ? `<p class="meta wr-err">${esc(L.err)}</p>` : ''}
      <div class="wr-grid"><div class="wr-left">${form}${list}</div><div class="wr-right">${print_}${aiNote}</div></div>
    </section>`;
  }

  /* ---------- actions ---------- */
  const rerender = () => window.App.render(true);
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-wrin]'); if (!el) return;
    VS.wrDraft[el.dataset.wrin] = el.value;
    if (el.dataset.wrin === 'body') { const c = document.querySelector('[data-wrcount]'); if (c) { const n = VP().count(el.value); c.textContent = n ? int(n) + ' words' : 'At least a few sentences.'; } }
  });
  document.addEventListener('change', (e) => { const el = e.target.closest('select[data-wrin]'); if (el) VS.wrDraft[el.dataset.wrin] = el.value; });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-wrform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const v = Object.fromEntries(new FormData(f)); const body = String(v.body || '').replace(/\r/g, '').trim();
    if (body.length < MIN || VP().count(body) < 8) { U.toast('Paste a bit more, at least a few full sentences'); return; }
    const title = (String(v.title || '').trim() || body.split('\n')[0].slice(0, 60) || 'Untitled').slice(0, 200);
    const row = { title, kind: KN[v.kind] ? v.kind : 'other', body: body.slice(0, MAX), words: VP().count(body) };
    if (!isLive()) {
      St.s.writing.unshift({ id: 'wr' + Date.now(), pinned: false, created_at: new Date().toISOString(), ...row });
      VS.wrDraft = { title: '', kind: row.kind, body: '' }; if (window.DNA) window.DNA.demoBump();
      U.toast('Saved. The voiceprint and the DNA are updated'); rerender(); return;
    }
    L.saving = true; rerender();
    try {
      const s = await Auth.writing.add(ctx().ws.id, row); L.samples.unshift(s);
      VS.wrDraft = { title: '', kind: row.kind, body: '' };
      await restyle(); U.toast('Saved. The voiceprint and the DNA are updated');
      if (aiOn()) study(true);
    } catch (ex) { U.toast(Auth.friendly(ex)); }
    finally { L.saving = false; rerender(); }
  }, true);

  const find = (id) => samples().find((s) => String(s.id) === String(id));
  ACT['wr-open'] = (el, e) => {
    if (e && e.target.closest('[data-action="wr-pin"],[data-action="wr-del"]')) return;
    const s = find(el.dataset.id); if (!s) return;
    U.drawer(`<div class="dbody wr-d"><p class="meta">${esc(KN[s.kind] || 'Other')} \u00b7 ${int(s.words || VP().count(s.body))} words \u00b7 saved ${esc(date(s.created_at))}</p>
      <h2>${esc(s.title)}</h2>
      <form class="wr-form" data-wredit="${esc(s.id)}">
        <label class="field"><span>Title</span><input name="title" value="${esc(s.title)}" maxlength="200" autocomplete="off"></label>
        <label class="field"><span>Type</span><select name="kind">${KINDS.map(([v, l]) => `<option value="${v}" ${s.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Text</span><textarea name="body" rows="16" maxlength="${MAX}" required>${esc(s.body)}</textarea></label>
        <label class="wr-check"><input type="checkbox" class="switch" name="pinned" ${s.pinned ? 'checked' : ''}><span>Use as an example in the Brand DNA. Up to three pieces are quoted, pinned ones first.</span></label>
        <div class="actions"><button class="btn primary">Save changes</button><button type="button" class="btn ghost" data-action="wr-del" data-id="${esc(s.id)}">Delete</button></div>
      </form></div>`, { label: s.title, wide: true });
  };
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-wredit]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const s = find(f.dataset.wredit); if (!s) return;
    const v = Object.fromEntries(new FormData(f)); const body = String(v.body || '').trim();
    if (body.length < MIN) { U.toast('Paste a bit more, at least a few full sentences'); return; }
    const patch = { title: (String(v.title || '').trim() || s.title).slice(0, 200), kind: KN[v.kind] ? v.kind : s.kind, body: body.slice(0, MAX), words: VP().count(body), pinned: !!v.pinned };
    if (!isLive()) { Object.assign(s, patch); if (window.DNA) window.DNA.demoBump(); U.closeDrawer(); U.toast('Saved'); rerender(); return; }
    try { const r = await Auth.writing.update(s.id, patch); Object.assign(s, r); await restyle(); U.closeDrawer(); U.toast('Saved. The voiceprint and the DNA are updated'); if (aiOn()) study(true); }
    catch (ex) { U.toast(Auth.friendly(ex)); }
    rerender();
  }, true);
  ACT['wr-pin'] = async (el, e) => {
    if (e) e.stopPropagation(); const s = find(el.dataset.id); if (!s) return;
    const v = !s.pinned; s.pinned = v;
    if (!isLive()) { if (window.DNA) window.DNA.demoBump(); U.toast(v ? 'Quoted in the DNA as an example' : 'No longer quoted as an example'); rerender(); return; }
    try { await Auth.writing.update(s.id, { pinned: v }); if (window.DNA) window.DNA.load(true); U.toast(v ? 'Quoted in the DNA as an example' : 'No longer quoted as an example'); }
    catch (ex) { s.pinned = !v; U.toast(Auth.friendly(ex)); }
    rerender();
  };
  ACT['wr-del'] = async (el, e) => {
    if (e) e.stopPropagation(); const s = find(el.dataset.id); if (!s) return;
    const ok = await U.dialog({ title: 'Delete ' + s.title + '?', body: 'The voiceprint is studied again without it.', ok: 'Delete', danger: true }); if (!ok) return;
    if (!isLive()) { St.s.writing.splice(St.s.writing.indexOf(s), 1); if (window.DNA) window.DNA.demoBump(); U.closeDrawer(); rerender(); return; }
    try { await Auth.writing.remove(s.id); L.samples = L.samples.filter((x) => x.id !== s.id); await restyle(); U.closeDrawer(); U.toast('Deleted'); if (aiOn() && L.samples.length) study(true); }
    catch (ex) { U.toast(Auth.friendly(ex)); }
    rerender();
  };
  ACT['wr-study'] = () => study(false);

  window.Writing = { panel, load, samples, print, L };
})();

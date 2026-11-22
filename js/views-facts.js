// Founder Algorithm: short statements about the founder, grouped by category, that the founder writes or approves.
// Approved facts go first into every AI prompt in the OS and win over anything else. Proposed facts wait here.
// Works on the demo store and on a private workspace (Supabase, RLS) through the same functions.
(() => {
  const U = window.UI, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;

  const CATS = [
    ['identity', 'Who I am', 'Your name, your business, where you are and how you got here.', ['What is your name, and what is your business called?', 'Where are you based, and what did you do before this?']],
    ['offers', 'What I sell', 'Every offer with its exact price and terms. The AI never quotes a price that is not here.', ['What do you sell, and at what price?', 'What is your guarantee or refund policy?']],
    ['revenue', 'How I make money', 'Every stream at once: clients, customers, software and affiliate commissions.', ['Which revenue streams do you run right now?', 'Which affiliate programs pay you, and how much?']],
    ['audience', 'Who I serve', 'Who buys, what they want and what stops them.', ['Who buys from you? Be as specific as you can.', 'What do they want most, and what stops them from buying?']],
    ['voice', 'How I talk', 'Words, rhythm and habits that make a draft sound like you.', ['How would a friend describe the way you talk?', 'Which words or phrases do you use all the time?']],
    ['beliefs', 'What I believe', 'Positions you hold and repeat.', ['What do you believe that most people in your space do not?']],
    ['proof', 'Proof and results', 'Numbers and results the AI is allowed to cite.', ['What results can you prove with numbers?', 'Which clients or students can you name?']],
    ['goals', 'Where I am going', 'Targets with numbers and dates.', ['What are you working toward this year, in numbers?']],
    ['stack', 'How I run it', 'The tools behind the business and what each is for.', ['Which tools run your business, and what is each one for?']],
    ['never', 'Never', 'Hard rules. Words, claims and tactics the AI must never use.', ['What should the AI never say, promise or do in your name?']],
  ];
  const CAT = Object.fromEntries(CATS.map(([k, n]) => [k, n]));
  const OPTS = CATS.map(([k, n]) => [k, n]);
  const MORE_DEMO = [
    { category: 'proof', statement: 'My funnels have run for clients in more than 20 countries.', doc_title: 'Founder story and beliefs', evidence: 'Built 300+ funnels, then moved from one-off projects to recurring software and products.' },
    { category: 'goals', statement: 'I publish two videos a week and one live build a month.', doc_title: 'Content strategy', evidence: 'Two videos a week. One live build a month.' },
    { category: 'never', statement: 'I never send a client email without one clear ask.', doc_title: 'Objection library', evidence: 'One clear ask.' },
  ];

  const L = { ws: null, loaded: false, loading: false, err: null, items: [], editing: null, adding: null, proposing: false, mode: null };
  const isLive = () => L.mode === 'live';
  const wsId = () => (window.App.liveCtx && (window.App.liveCtx().ws || {}).id) || null;
  const render = () => window.App.render(true);
  const demoItems = () => { const b = window.Store.s.brain; b.facts = b.facts || []; return b.facts; };
  const items = () => (isLive() ? L.items : demoItems());
  const approved = () => items().filter((f) => f.status === 'approved');
  const proposed = () => items().filter((f) => f.status === 'proposed');
  const now = () => new Date().toISOString();
  const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const ago = (t) => { if (!t) return 'never'; const s = (Date.now() - new Date(t)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : d + ' days ago'; };

  async function load(force) {
    const id = wsId(); if (!id || (L.loading && !force)) return;
    L.loading = true; L.ws = id; L.err = null;
    try { L.items = await Auth.facts.list(id); L.loaded = true; } catch (e) { L.err = (Auth.friendly ? Auth.friendly(e) : e.message); }
    L.loading = false;
    if (location.hash.replace('#', '').split('?')[0] === 'brain') render();
  }
  function ensure(mode) {
    L.mode = mode;
    if (mode === 'live') { const id = wsId(); if (L.ws !== id) { L.items = []; L.loaded = false; L.editing = null; L.adding = null; load(); } }
  }

  /* ---------- writes, the same for demo and live ---------- */
  async function add(row) {
    if (items().some((f) => key(f.statement) === key(row.statement))) throw new Error('That fact is already in your Algorithm.');
    if (isLive()) { const r = await Auth.facts.add(L.ws, row); L.items.push(r); return r; }
    const r = { id: 'f' + Date.now().toString(36), weight: 2, source: 'You', evidence: null, doc_title: null, created_at: now(), ...row }; demoItems().push(r); return r;
  }
  async function patch(id, p) {
    const f = items().find((x) => x.id === id); if (!f) return null;
    if (p.statement && items().some((x) => x.id !== id && key(x.statement) === key(p.statement))) throw new Error('That fact is already in your Algorithm.');
    if (isLive()) { const r = await Auth.facts.update(id, p); Object.assign(f, r); return f; }
    Object.assign(f, p); return f;
  }
  async function remove(id) {
    if (isLive()) await Auth.facts.remove(id);
    const arr = items(); const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1);
  }

  /* ---------- the block every AI reads first ---------- */
  function block(list) {
    const ok = (list || approved()).filter((f) => !f.status || f.status === 'approved'); if (!ok.length) return '';
    const parts = CATS.map(([k, n]) => { const fs = ok.filter((f) => f.category === k).sort((a, b) => (b.weight || 2) - (a.weight || 2)); return fs.length ? n + ':\n' + fs.map((f) => '- ' + f.statement + ((f.weight || 2) >= 3 ? ' (core)' : '')).join('\n') : ''; }).filter(Boolean);
    return 'FOUNDER FACTS. Approved by the founder and always true. If anything else in this prompt disagrees, these win. Never contradict them. Never invent offers, prices, numbers, clients or results beyond them. Everything under Never is a hard rule.\n\n' + parts.join('\n\n');
  }

  // Jarvis asks here first: the approved facts that best match a question.
  const STOP = new Set('what which when where does have your with that this about from they them into much many more most will would could should there their just like make made also then than only very what how who why can are was for the and you my me our we is it of to in on a i'.split(' '));
  const HINT = { offers: /price|cost|charge|sell|offer|product|kit|course|coaching|membership/, revenue: /money|revenue|income|stream|affiliate|commission|earn/, audience: /who.*(serve|buy|help)|audience|customer|client|niche/, voice: /voice|tone|talk|write|sound|phrase/, beliefs: /believe|belief|think|opinion/, proof: /proof|result|case|testimonial|numbers/, goals: /goal|target|aim|working toward/, stack: /tool|stack|software|use for/, never: /never|avoid|don.?t say|banned/, identity: /who am i|about me|my story|my name|based/ };
  function match(q, n = 3, min = 3) {
    const ql = String(q || '').toLowerCase(); const words = (ql.match(/[a-z0-9$€]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
    const hint = Object.entries(HINT).filter(([, rx]) => rx.test(ql)).map(([k]) => k);
    const ap = approved(); const df = Object.fromEntries(words.map((w) => [w, ap.filter((f) => f.statement.toLowerCase().includes(w)).length]));
    const hits = ap.map((f) => { const s = f.statement.toLowerCase(); let sc = words.filter((w) => s.includes(w)).reduce((a, w) => a + (df[w] <= 2 ? 4 : df[w] <= 5 ? 2 : 1), 0); if (hint.includes(f.category)) sc += 3; sc += (f.weight || 2) >= 3 ? 0.5 : 0; return { f, sc }; })
      .filter((x) => x.sc >= min).sort((a, b) => b.sc - a.sc);
    const top = hits.length ? hits[0].sc : 0;
    return hits.filter((x) => x.sc >= top * 0.85).slice(0, n).map((x) => x.f);
  }

  /* ---------- view ---------- */
  function fact(f) {
    if (L.editing === f.id) return `<li class="fx-f editing"><form class="fx-edit" data-fxform="edit" data-id="${f.id}">
      <textarea name="statement" rows="2" required maxlength="500" aria-label="Fact">${esc(f.statement)}</textarea>
      <div class="fx-erow"><select name="category" aria-label="Category">${OPTS.map(([k, n]) => `<option value="${k}" ${k === f.category ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <span class="grow"></span><button type="button" class="btn ghost sm" data-action="fx-cancel">Cancel</button><button class="btn primary sm">${f.status === 'proposed' ? 'Save and approve' : 'Save'}</button></div></form></li>`;
    const core = (f.weight || 2) >= 3;
    return `<li class="fx-f${core ? ' core' : ''}">
      <button class="fx-star" data-action="fx-core" data-id="${f.id}" aria-pressed="${core}" title="${core ? 'Core fact. Every AI reads it first.' : 'Mark as core'}" aria-label="${core ? 'Unmark core fact' : 'Mark as core fact'}">${icon('star')}</button>
      <span class="fx-s">${esc(f.statement)}</span>
      <span class="fx-acts"><button class="btn ghost sm" data-action="fx-edit" data-id="${f.id}">Edit</button><button class="btn ghost sm" data-action="fx-del" data-id="${f.id}" aria-label="Remove fact">Remove</button></span></li>`;
  }
  function category([k, name, desc, qs]) {
    const fs = approved().filter((f) => f.category === k).sort((a, b) => (b.weight || 2) - (a.weight || 2));
    const adding = L.adding === k;
    return `<section class="fx-cat" id="fx-${k}"><header><div><h3>${esc(name)} <span class="fx-n">${fs.length || ''}</span></h3><p class="meta">${esc(desc)}</p></div>${adding ? '' : `<button class="btn ghost sm" data-action="fx-add" data-cat="${k}">${icon('plus')}Add</button>`}</header>
      ${fs.length ? `<ul class="fx-list">${fs.map(fact).join('')}</ul>` : ''}
      ${adding ? `<form class="fx-new" data-fxform="add" data-cat="${k}"><textarea name="statement" rows="2" required maxlength="500" placeholder="${esc(k === 'never' ? 'I never promise income results.' : k === 'offers' ? 'I sell the App Builder Kit for $497, one payment.' : 'Write it as one short sentence, the way you would say it.')}" aria-label="New fact for ${esc(name)}"></textarea><div class="fx-erow"><span class="meta grow">Saved as approved. Every AI uses it right away.</span><button type="button" class="btn ghost sm" data-action="fx-cancel">Cancel</button><button class="btn primary sm">Save fact</button></div></form>` : ''}
      ${!fs.length && !adding ? `<div class="fx-qs">${qs.map((q, i) => `<button class="fx-q" data-action="fx-q" data-cat="${k}" data-i="${i}"><span>${esc(q)}</span>${icon('arrow')}</button>`).join('')}</div>` : ''}
    </section>`;
  }
  function waiting() {
    const ps = proposed(); if (!ps.length) return '';
    return `<section class="panel fx-wait"><header><div><h2>Waiting for your approval</h2><p class="meta">Suggested from your documents and AI access. Not used until you approve.</p></div><button class="btn sm" data-action="fx-approve-all">Approve all ${ps.length}</button></header>
      <ul class="fx-plist">${ps.map((f) => L.editing === f.id ? fact(f) : `<li class="fx-p">
        <div class="fx-ph"><select class="fx-pcat" data-action="fx-pcat" data-id="${f.id}" aria-label="Category">${OPTS.map(([k, n]) => `<option value="${k}" ${k === f.category ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><span class="meta">${esc(f.source || 'Suggested')}${f.doc_title ? ' · ' + esc(f.doc_title) : ''}</span></div>
        <p class="fx-s">${esc(f.statement)}</p>
        ${f.evidence ? `<p class="evidence">${esc(f.evidence)}</p>` : ''}
        <div class="fx-pa"><button class="btn primary sm" data-action="fx-approve" data-id="${f.id}">Approve</button><button class="btn sm" data-action="fx-edit" data-id="${f.id}">Edit</button><button class="btn ghost sm" data-action="fx-reject" data-id="${f.id}">Reject</button></div></li>`).join('')}</ul></section>`;
  }
  function rail(docCount, aiOn) {
    const b = block(); const rej = items().filter((f) => f.status === 'rejected').length;
    return `<aside class="rail">
      <h2 class="out">Suggest from my Brain</h2><section class="panel tight fx-side">
        <p class="muted">The OS reads your documents and suggests facts for you to check. It skips anything you already approved or rejected.</p>
        <div class="actions"><button class="btn primary sm" data-action="fx-propose" ${L.proposing || (!docCount && isLive()) ? 'disabled' : ''}>${L.proposing ? U.spin + 'Reading your documents' : 'Suggest facts'}</button></div>
        <p class="meta">${isLive() ? (!docCount ? 'Add documents in Library first.' : aiOn ? 'Claude, OpenAI or Perplexity reads all ' + docCount + ' documents with your key.' : 'Reads first-person sentences in your ' + docCount + ' documents. Connect Claude, OpenAI or Perplexity for sharper suggestions.') : 'Demo: suggests from the sample documents.'}</p>
        ${rej ? `<p class="meta">${rej} rejected ${rej === 1 ? 'fact is' : 'facts are'} kept so ${rej === 1 ? 'it is' : 'they are'} never suggested again.</p>` : ''}
      </section>
      <h2 class="out">What every AI reads first</h2><section class="panel tight fx-side">
        ${b ? `<pre class="fx-pre" tabindex="0" aria-label="Founder facts as the AI sees them">${esc(b)}</pre><div class="actions"><button class="btn sm" data-action="fx-copy">${icon('copy')}Copy</button></div>` : '<p class="muted">Nothing yet. Approve or write a few facts and they show up here exactly as the AI receives them.</p>'}
        <p class="meta">Goes in front of your Brain passages in Build and Study, and to Claude or ChatGPT through AI access with get_founder_facts and reply_in_my_voice.</p>
      </section></aside>`;
  }

  // The hero: the Algorithm core on the right, the three strands it is made of on the left.
  function hero(ap, ps, docs, last) {
    const A = window.BrainAlgo; const core = ap.filter((f) => (f.weight || 2) >= 3).length;
    const strands = (A ? A.STRANDS : []).map((s) => {
      const fs = ap.filter((f) => s.cats.includes(f.category)); const have = s.cats.filter((c) => fs.some((f) => f.category === c));
      const gap = s.cats.find((c) => !have.includes(c));
      return `<li class="al-s"><i class="k-${s.key}" aria-hidden="true"></i><div class="grow"><div class="al-sh"><b>${esc(s.name)}</b><span class="meta">${fs.length} ${fs.length === 1 ? 'fact' : 'facts'}</span></div>
        <div class="al-cats">${s.cats.map((c) => `<a href="#brain" class="al-c${have.includes(c) ? ' on' : ''}" data-action="fx-jump" data-cat="${c}">${esc(CAT[c])}</a>`).join('')}</div>
        ${gap ? `<p class="meta">Missing: ${esc(CAT[gap].toLowerCase())}</p>` : ''}</div></li>`;
    }).join('');
    const head = ap.length ? `${ap.length} approved ${ap.length === 1 ? 'fact' : 'facts'} about you, your brand and your offers` : 'Start with one true sentence about you';
    return `<section class="al-hero${A ? ' has-orb' : ''}"><div class="al-copy">
      <h2 class="al-h">${esc(head)}</h2>
      <p class="muted">Each ring is a strand of the business. Every dot is a fact you approved, and the glowing ones are core. Hollow dots outside are suggestions waiting for you. The pulses are the AI reading your facts before it writes anything.</p>
      <ul class="al-strands">${strands}</ul>
      <p class="meta al-foot">${docs.length} ${docs.length === 1 ? 'document' : 'documents'} studied · ${core} core · ${ps.length} waiting · last approved ${last ? ago(last) : 'not yet'}</p>
    </div>${A ? A.html(docs) : ''}</section>`;
  }

  function view(mode, docCount = 0, docs = []) {
    ensure(mode);
    if (isLive() && !L.loaded) return L.err ? `<section class="panel">${U.empty('Your Algorithm could not load', esc(L.err), '<button class="btn" data-action="fx-reload">Try again</button>')}</section>` : `<section class="panel"><p class="meta">${U.spin}Loading your Algorithm</p></section>`;
    const ap = approved(); const ps = proposed();
    const covered = CATS.filter(([k]) => ap.some((f) => f.category === k));
    const missing = CATS.filter(([k]) => !ap.some((f) => f.category === k));
    const last = ap.map((f) => f.approved_at || f.updated_at || f.created_at).filter(Boolean).sort().pop();
    const aiOn = isLive() && (window.App.liveCtx().conns || []).some((c) => /^(claude|openai|perplexity)$/.test(c.provider) && c.status === 'connected');
    const kp = hero(ap, ps, docs, last);
    return `${kp}<div class="layout" style="margin-top:var(--gap)"><div class="br-main">
      ${waiting()}
      <section class="panel"><header><div><h2>Your algorithm</h2><p class="meta">Short statements that are always true. Edit them any time. The AI follows the latest version.</p></div></header>
        <div class="fx-cats">${CATS.map(category).join('')}</div></section></div>
      ${rail(docCount, aiOn)}</div>`;
  }

  /* ---------- actions ---------- */
  const run = async (fn, ok) => { try { await fn(); if (ok) U.toast(ok); } catch (e) { U.toast(e.message || 'That did not save'); } render(); };
  ACT['fx-reload'] = () => { L.ws = null; L.loaded = false; ensure('live'); render(); };
  ACT['fx-add'] = (el) => { L.adding = el.dataset.cat; L.editing = null; render(); requestAnimationFrame(() => { const t = document.querySelector(`[data-fxform="add"] textarea`); if (t) t.focus(); }); };
  ACT['fx-edit'] = (el) => { L.editing = el.dataset.id; L.adding = null; render(); requestAnimationFrame(() => { const t = document.querySelector(`[data-fxform="edit"] textarea`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }); };
  ACT['fx-cancel'] = () => { L.editing = null; L.adding = null; render(); };
  ACT['fx-approve'] = (el) => run(() => patch(el.dataset.id, { status: 'approved', approved_at: now() }), 'Approved. Every AI uses it now.');
  ACT['fx-reject'] = (el) => run(() => patch(el.dataset.id, { status: 'rejected' }), 'Rejected. It will not be suggested again.');
  ACT['fx-approve-all'] = async () => {
    const ps = proposed(); if (!ps.length) return;
    const ok = await U.dialog({ title: 'Approve all ' + ps.length + ' facts', body: 'Every AI in the OS will treat them as true. You can edit or remove any of them later.', ok: 'Approve all' }); if (!ok) return;
    run(async () => { const t = now(); if (isLive()) await Auth.facts.updateMany(ps.map((f) => f.id), { status: 'approved', approved_at: t }); ps.forEach((f) => { f.status = 'approved'; f.approved_at = t; }); }, ps.length + ' facts approved');
  };
  ACT['fx-core'] = (el) => { const f = items().find((x) => x.id === el.dataset.id); if (!f) return; const core = (f.weight || 2) >= 3; run(() => patch(f.id, { weight: core ? 2 : 3 }), core ? 'No longer core' : 'Marked core. It goes first in every prompt.'); };
  ACT['fx-pcat'] = (el) => { const f = items().find((x) => x.id === el.dataset.id); if (f && f.category !== el.value) run(() => patch(f.id, { category: el.value }), 'Moved to ' + CAT[el.value]); };
  ACT['fx-del'] = async (el) => {
    const f = items().find((x) => x.id === el.dataset.id); if (!f) return;
    const ok = await U.dialog({ title: 'Remove this fact', body: esc(f.statement) + '<br><br>The AI stops using it right away.', ok: 'Remove', danger: true }); if (!ok) return;
    run(() => remove(f.id), 'Removed');
  };
  ACT['fx-q'] = async (el) => {
    const c = CATS.find(([k]) => k === el.dataset.cat); if (!c) return; const q = c[3][+el.dataset.i];
    const r = await U.dialog({ title: c[1], body: esc(q), fields: [{ name: 'answer', label: 'Your answer, one fact per line', type: 'textarea', rows: 5, required: true, placeholder: c[0] === 'offers' ? 'App Builder Kit is $497, one payment.\nCoaching is $1,997 for 8 weeks.' : 'Write it the way you would say it' }], ok: 'Save facts' });
    if (!r || !r.answer.trim()) return;
    const lines = r.answer.split(/\n+/).map((s) => s.trim().replace(/^[-*\u2022]\s*/, '').replace(/\u2014/g, ',')).filter((s) => s.length >= 3);
    let n = 0; await run(async () => { for (const s of lines) { try { await add({ category: c[0], statement: s.slice(0, 500), status: 'approved', approved_at: now(), source: 'You' }); n++; } catch (e) { if (lines.length === 1) throw e; } } });
    if (n) U.toast(n === 1 ? 'Saved. Every AI uses it now.' : n + ' facts saved');
  };
  ACT['fx-jump'] = (el, e) => { if (e && e.preventDefault) e.preventDefault(); const sec = document.getElementById('fx-' + el.dataset.cat); if (!sec) return; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); sec.classList.remove('fx-ping'); void sec.offsetWidth; sec.classList.add('fx-ping'); };
  ACT['fx-copy'] = () => U.copy(block());
  ACT['fx-propose'] = async () => {
    L.proposing = true; render();
    { const st = document.querySelector('.al-stage'); if (st) { const r = st.getBoundingClientRect(); if (r.top < 40 || r.bottom > innerHeight) st.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); } }
    try {
      if (isLive()) {
        const r = await Auth.brainApi('propose', { workspace_id: L.ws }); await load(true);
        U.toast(r.added ? r.added + ' new ' + (r.added === 1 ? 'fact' : 'facts') + ' to review' : 'No new facts found. Add more documents, or write facts yourself.');
      } else {
        await new Promise((ok) => setTimeout(ok, 2400)); let n = 0;
        MORE_DEMO.forEach((m) => { if (!demoItems().some((f) => key(f.statement) === key(m.statement))) { demoItems().push({ id: 'f' + Date.now().toString(36) + n, weight: 2, status: 'proposed', source: 'Studied by Claude', ...m }); n++; } });
        U.toast(n ? n + ' new facts to review' : 'No new facts found in the sample documents');
      }
    } catch (e) { U.toast(e.message); }
    L.proposing = false; render();
  };

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-fxform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const v = Object.fromEntries(new FormData(f)); const st = String(v.statement || '').trim().replace(/\s+/g, ' ').replace(/\u2014/g, ','); if (st.length < 3) return U.toast('Write a little more');
    const btn = f.querySelector('button.primary'); if (btn) { btn.disabled = true; btn.innerHTML = U.spin + 'Saving'; }
    if (f.dataset.fxform === 'add') { await run(async () => { await add({ category: f.dataset.cat, statement: st, status: 'approved', approved_at: now(), source: 'You' }); L.adding = null; }, 'Saved. Every AI uses it now.'); return; }
    const x = items().find((i) => i.id === f.dataset.id); if (!x) return;
    const p = { statement: st, category: v.category || x.category }; if (x.status === 'proposed') { p.status = 'approved'; p.approved_at = now(); }
    await run(async () => { await patch(x.id, p); L.editing = null; }, x.status === 'approved' && p.status ? 'Approved. Every AI uses it now.' : 'Saved. Every AI follows the new version.');
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[data-fxform] textarea'); if (!t) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.form.requestSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); ACT['fx-cancel'](); }
  });

  // Jarvis speaks to the founder, so first person becomes second person.
  const you = (t) => { const o = String(t).replace(/\bI am\b/g, 'you are').replace(/\bI'm\b/g, "you're").replace(/\bI've\b/g, "you've").replace(/\bI'll\b/g, "you'll").replace(/\bI was\b/g, 'you were').replace(/\bI\b/g, 'you').replace(/\bmyself\b/gi, 'yourself').replace(/\bmine\b/gi, 'yours').replace(/\bmy\b/g, 'your').replace(/\bMy\b/g, 'Your').replace(/\bme\b/g, 'you'); return o.charAt(0).toUpperCase() + o.slice(1); };
  window.Facts = { busy: () => L.proposing, you, view, block, match, approved, proposed, ensure, load, CATS, name: (k) => CAT[k] || k };
})();

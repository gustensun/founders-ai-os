// Founders AI OS: Emails. The library of 51 emails in 13 sequences, and a simple writer that turns any
// sequence into one for a specific funnel or offer. It reads the Brand DNA, approved Brain facts, the
// voiceprint, the offer you pick and the context you type in first. Sets are saved per workspace.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const LIB = () => window.EmailLib, EW = () => window.EmailWriter;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const FORM_KEY = 'fos-em-form';
  Object.assign(VS, { emTab: VS.emTab || 'write', emSeq: VS.emSeq || 'freebie-introduction-emails' });

  const S = { ws: null, sets: [], at: 0, loading: false, pending: null, err: '', busy: false, writeError: '', writeCount: 0, busySet: {}, rwError: {}, rwNote: {}, open: {}, rw: {}, email: {} };
  const F = (() => { let f = {}; try { f = JSON.parse(localStorage.getItem(FORM_KEY) || '{}') || {}; } catch (e) { f = {}; } return Object.assign({ sequence: 'abandon-cart-emails', item: '', offer: '', context: '' }, f); })();
  const saveForm = () => { try { localStorage.setItem(FORM_KEY, JSON.stringify(F)); } catch (e) { /* private mode */ } };
  const aiOn = () => isLive() && (ctx().conns || []).some((c) => /^(claude|openai|perplexity)$/.test(c.provider) && c.status === 'connected');
  const founder = () => (isLive() ? String(ctx().name || '').trim().split(/\s+/)[0] : 'Avery') || 'NAME';

  function load(force) {
    if (!isLive()) return;
    const w = ctx().ws; if (!w || !w.id) return;
    if (S.loading) return force ? S.pending.then(() => load(true)) : S.pending;
    if (!force && S.ws === w.id && Date.now() - S.at < 60e3) return;
    S.loading = true; S.ws = w.id;
    return S.pending = window.Auth.emails.list(w.id).then((r) => { S.sets = r; S.err = ''; }).catch((e) => { S.err = window.Auth.friendly(e); })
      .finally(() => { S.loading = false; S.pending = null; S.at = Date.now(); if (VS.view === 'emails') window.App.render(true); });
  }
  const sets = () => (isLive() ? S.sets : St.s.emailSets || (St.s.emailSets = []));
  function offers() {
    const d = window.DNA && window.DNA.data ? window.DNA.data() : { items: [] };
    return (d.items || []).filter((i) => (i.kind === 'offer' || i.kind === 'funnel') && i.included !== false);
  }

  /* ---------- rendering an email ---------- */
  function richBody(t) {
    return String(t || '').split(/\n{2,}/).map((p) => {
      const h = esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{\{contact\.first_name\}\}/g, '<span class="em-tag">{{contact.first_name}}</span>');
      if (/^\[BUTTON:/.test(p.trim())) return h.split('\n').map((l) => `<p class="em-btnline">${l.replace(/^\[BUTTON:\s*(.+?)\]$/, '<span class="em-btn">$1</span>')}</p>`).join('');
      if (/^TESTIMONIAL HERE/.test(p.trim())) return `<blockquote class="em-quote">${h.replace(/^TESTIMONIAL HERE:\s*/, '')}<span class="meta">Testimonial slot</span></blockquote>`;
      return `<p>${h.replace(/\n/g, '<br>').replace(/\[BUTTON:\s*(.+?)\]/g, '<span class="em-btn">$1</span>')}</p>`;
    }).join('');
  }
  const words = (t) => (String(t || '').match(/\S+/g) || []).length;

  window.AISuggest && window.AISuggest.register('emails', { kind: 'emails', ctx: () => {
    const seq = LIB().byId(F.sequence) || LIB().SEQUENCES[0]; const it = offers().find((i) => String(i.id) === String(F.item));
    return { title: seq ? seq.title : null, offer_id: it && /^[0-9a-f-]{36}$/i.test(String(it.id)) ? it.id : null, offer_name: it ? it.name : F.offer || null, price: it && it.price ? (it.currency || 'USD') + ' ' + it.price : '', context: seq ? `Email sequence: ${seq.title}, ${seq.count} emails. Draft the context the writer needs: who it is for, what is included, price, dates, bonus, a story. Only real facts.` : null };
  } });
  /* ---------- write tab ---------- */
  function writeTab() {
    const lib = LIB().SEQUENCES; const seq = LIB().byId(F.sequence) || lib[0]; const items = offers(); const live = isLive();
    const d = window.DNA && window.DNA.data ? window.DNA.data() : {}; const dna = d.dna;
    const opts = items.map((i) => `<option value="${esc(i.id)}"${String(F.item) === String(i.id) ? ' selected' : ''}>${esc(i.name)}${i.kind === 'funnel' ? ' (funnel)' : ''}</option>`).join('');
    const chips = [['Who it is for', 'Who it is for: '], ['Price', 'Price: '], ['Dates', 'Dates and deadline: '], ['Bonus', 'Bonus: '], ['Guarantee', 'Guarantee: '], ['A story', 'A story to use: '], ['Testimonial', 'Real testimonial: ']];
    const form = `<section class="panel em-form" data-sg-scope="emails"><header><h2>New sequence</h2><span class="meta">${esc(seq.count)} emails</span></header>
      <label class="field"><span>Sequence</span><select data-emf="sequence">${lib.map((s) => `<option value="${esc(s.id)}"${s.id === seq.id ? ' selected' : ''}>${esc(s.title)} (${s.count})</option>`).join('')}</select></label>
      <label class="field"><span>Offer or funnel</span><select data-emf="item"><option value=""${F.item ? '' : ' selected'}>${items.length ? 'Describe a different offer' : 'Describe your offer below'}</option>${opts}</select></label>
      ${!F.item ? `<label class="field"><span>Name</span><input data-emf="offer" type="text" maxlength="160" value="${esc(F.offer)}" placeholder="Your offer, webinar or promotion"></label>` : ''}
      <label class="field"><span>Your context <span class="em-optional">Add what matters for this sequence</span></span><textarea data-emf="context" rows="6" maxlength="6000" placeholder="Who it is for, what is included, price, dates, a story or proof you want to use.">${esc(F.context)}</textarea></label>
      <div class="chips em-chips">${window.AISuggest ? window.AISuggest.button('emails') : ''}${chips.map(([l, v]) => `<button class="chip" data-action="em-chip" data-v="${esc(v)}">${icon('plus')}${esc(l)}</button>`).join('')}</div>
      <p class="meta em-uses">${icon('dna')}<span>Also reads ${dna ? `Brand DNA v${esc(dna.version)}` : 'your Brand DNA'}, your approved Brain facts and how you write.${live && !dna ? ' <a href="#dna">Build your DNA</a> first for emails that sound like you.' : ''}</span></p>
      ${S.writeError ? `<p class="em-error" role="alert">${icon('alert')}<span>${esc(S.writeError)} Your brief is still here.</span></p>` : ''}
      <div class="actions"><button class="btn primary" data-action="em-write" ${S.busy ? 'disabled' : ''}>${S.busy ? U.spin + 'Writing' : S.writeError ? icon('refresh') + 'Retry' : icon('sparkle') + 'Write ' + seq.count + ' emails'}</button>
        <button class="btn ghost" data-action="em-peek" data-seq="${esc(seq.id)}">See the template</button></div>
      ${live && !aiOn() ? '<p class="meta em-note">Connect Claude, OpenAI or Perplexity in Connections and the OS rewrites every email from your context. Without one it fills in the names and price it knows.</p>' : ''}
      ${!live ? '<p class="meta em-note">Sample workspace. In your own workspace your AI writes these from your DNA and context.</p>' : ''}
      <p class="meta em-note">Nothing sends from here. Copy the emails into your HighLevel workflow.</p></section>`;
    const xs = sets();
    const progress = S.busy ? `<div class="em-progress" role="status" aria-live="polite">${U.spin}<div><h2>${live && !aiOn() ? 'Preparing' : 'Writing'} ${S.writeCount} emails</h2><p>${live && !aiOn() ? 'Filling the sequence with the offer details you supplied.' : 'Using your offer, business context and writing style.'} Your brief stays here while this runs.</p></div></div>` : '';
    const list = S.err ? `<p class="auth-msg">${esc(S.err)}</p>` : live && S.loading && !S.at ? U.empty('Reading your emails', 'One moment.')
      : xs.length ? xs.map(setCard).join('') : S.busy ? '' : S.writeError ? `<div class="em-blank">${icon('emails')}<h2>No emails were added.</h2><p>Your offer and context are still in the brief.<br>Choose Retry when you are ready.</p></div>` : `<div class="em-blank">${icon('emails')}<h2>Your words. Your offer.</h2><p>Choose a sequence and add your context.<br>Your emails will be here, ready to edit and copy.</p></div>`;
    return `<div class="em-grid">${form}<section class="em-sets" aria-label="Your email sequences" aria-busy="${S.busy}">${progress}${list}</section></div>`;
  }
  function setCard(s) {
    const open = S.open[s.id] != null ? S.open[s.id] : s === sets()[0]; const busy = S.busySet[s.id]; const ems = s.emails || [];
    const selected = Math.min(S.email[s.id] || 0, Math.max(0, ems.length - 1)); const sid = esc(s.id);
    const when = s.updated_at || s.created_at; const dt = when ? new Date(when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    return `<article class="panel em-set${open ? ' open' : ''}" data-set="${esc(s.id)}">
      <header><button class="em-set-h" data-action="em-toggle" data-id="${esc(s.id)}" aria-expanded="${open}"><span class="grow"><b>${esc(s.title)}</b><span class="meta">${ems.length} emails · ${esc(s.by || '')}${dt ? ' · ' + esc(dt) : ''}</span></span>${icon('chevron')}</button></header>
      ${open ? `${s.context ? `<details class="em-ctx"><summary class="meta">${icon('chevron')}<span>Context you gave</span></summary><p class="meta">${esc(s.context).replace(/\n/g, '<br>')}</p></details>` : ''}
      <div class="em-email-tabs" role="tablist" aria-label="Emails in this sequence">${ems.map((e, i) => `<button role="tab" id="em-tab-${sid}-${i}" aria-controls="em-pane-${sid}" aria-selected="${i === selected}" tabindex="${i === selected ? 0 : -1}" data-action="em-email" data-id="${sid}" data-i="${i}" title="${esc(e.subject)}">Email ${i + 1}</button>`).join('')}</div>
      <div class="em-list" id="em-pane-${sid}" role="tabpanel" aria-labelledby="em-tab-${sid}-${selected}">${ems[selected] ? emailEdit(s, ems[selected], selected) : ''}</div>
      <div class="em-rw" ${S.rw[s.id] ? '' : 'hidden'}><input type="text" class="input" data-emnote="${esc(s.id)}" value="${esc(S.rwNote[s.id] || '')}" maxlength="800" placeholder="What should change? Warmer, shorter, add the bonus, mention the deadline"><button class="btn sm" data-action="em-rewrite" data-id="${esc(s.id)}" ${busy ? 'disabled' : ''}>${busy ? U.spin + 'Rewriting' : S.rwError[s.id] ? 'Retry rewrite' : 'Rewrite'}</button></div>
      ${S.rwError[s.id] ? `<p class="em-error" role="alert">${icon('alert')}<span>${esc(S.rwError[s.id])} Your emails and rewrite note are unchanged.</span></p>` : ''}
      <div class="actions"><button class="btn sm primary" data-action="em-copyall" data-id="${esc(s.id)}">${icon('copy')}Copy all</button><button class="btn sm" data-action="em-rwopen" data-id="${esc(s.id)}">Rewrite</button><button class="btn sm ghost" data-action="em-del" data-id="${esc(s.id)}">Delete</button></div>` : ''}
    </article>`;
  }
  function emailEdit(s, e, i) {
    const id = esc(s.id);
    return `<div class="em-e"><div class="em-e-h"><span class="tag">Email ${i + 1}</span><span class="meta">${esc(e.when)}</span><button class="btn sm ghost" data-action="em-copy1" data-id="${id}" data-i="${i}">${icon('copy')}Copy</button></div>
      <label class="em-l"><span class="meta">Subject</span><input class="input em-in" data-emedit="${id}" data-i="${i}" data-k="subject" value="${esc(e.subject)}"></label>
      <label class="em-l"><span class="meta">Preview</span><input class="input em-in" data-emedit="${id}" data-i="${i}" data-k="preview" value="${esc(e.preview)}"></label>
      <textarea class="ps-body em-body" data-emedit="${id}" data-i="${i}" data-k="body" rows="${Math.min(22, Math.max(6, String(e.body || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 80)), 0) + 1))}" aria-label="Email ${i + 1} body">${esc(e.body)}</textarea>
      <span class="meta">${words(e.body)} words${e.note ? ' · ' + esc(e.note) : ''}</span></div>`;
  }

  /* ---------- library tab ---------- */
  function libraryTab() {
    const lib = LIB().SEQUENCES; const seq = LIB().byId(VS.emSeq) || lib[0];
    const nav = `<section class="panel em-seqs"><header><h2>Sequences</h2><span class="meta">${lib.reduce((a, s) => a + s.count, 0)} emails</span></header><div class="rows">${lib.map((s) => `<button class="row em-seq${s.id === seq.id ? ' on' : ''}" data-action="em-seq" data-id="${esc(s.id)}" aria-pressed="${s.id === seq.id}"><span class="grow">${esc(s.title)}</span><span class="meta">${s.count}</span></button>`).join('')}</div>
      <p class="meta em-note">Swap NAME, OFFER NAME, DATE and the other words in capitals for your own. TESTIMONIAL HERE marks a slot for a real quote.</p></section>`;
    const body = `<section class="panel em-tpl"><header><h2>${esc(seq.title)}</h2><div class="actions"><button class="btn sm" data-action="em-copyseq" data-id="${esc(seq.id)}">${icon('copy')}Copy sequence</button><button class="btn sm primary" data-action="em-use" data-id="${esc(seq.id)}">${icon('sparkle')}Write mine from this</button></div></header>
      <p class="meta em-intro">${esc(seq.intro.replace(/\*\*|`/g, ''))}</p>
      ${seq.emails.map((e, i) => `<article class="em-card"><div class="em-e-h"><span class="tag">Email ${i + 1}</span><span class="meta">${esc(e.when)}</span><button class="btn sm ghost" data-action="em-copytpl" data-id="${esc(seq.id)}" data-i="${i}">${icon('copy')}Copy</button></div>
        <h3 class="em-subj">${esc(e.subject)}</h3><p class="meta em-prev">${esc(e.preview)}</p><div class="em-rich">${richBody(e.body)}</div>${e.note ? `<p class="meta em-note">${esc(e.note.replace(/\*\*/g, ''))}</p>` : ''}</article>`).join('')}</section>`;
    return `<div class="em-lib">${nav}${body}</div>`;
  }

  function view() {
    if (isLive()) load();
    const lib = LIB(); const total = lib.SEQUENCES.reduce((a, s) => a + s.count, 0);
    const head = U.title('Emails', `${total} emails. ${lib.SEQUENCES.length} sequences. Written for your offer, in your voice.`,
      U.seg('emTab', VS.emTab, [['write', 'Write for me'], ['library', 'Library']]));
    return head + (VS.emTab === 'library' ? libraryTab() : writeTab());
  }
  V.emails = view; V.emails.live = view;

  /* ---------- actions ---------- */
  const findSet = (id) => sets().find((s) => String(s.id) === String(id));
  ACT['em-chip'] = (el) => {
    const ta = document.querySelector('[data-emf="context"]'); if (!ta) return;
    const v = el.dataset.v; ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + v; F.context = ta.value; saveForm();
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  };
  ACT['em-seq'] = (el) => { VS.emSeq = el.dataset.id; window.App.render(); };
  ACT['em-use'] = (el) => { F.sequence = el.dataset.id; saveForm(); VS.emTab = 'write'; window.App.render(); };
  ACT['em-peek'] = (el) => { VS.emSeq = el.dataset.seq; VS.emTab = 'library'; window.App.render(); };
  ACT['em-toggle'] = (el) => { const s = findSet(el.dataset.id); if (!s) return; const cur = S.open[s.id] != null ? S.open[s.id] : s === sets()[0]; S.open[s.id] = !cur; window.App.render(true); };
  ACT['em-email'] = (el) => { S.email[el.dataset.id] = +el.dataset.i; window.App.render(true); document.getElementById(`em-tab-${el.dataset.id}-${el.dataset.i}`)?.focus({ preventScroll: true }); };
  document.addEventListener('keydown', (ev) => {
    const tab = ev.target.closest?.('[data-action="em-email"]'); if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')]; const i = tabs.indexOf(tab);
    const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    ev.preventDefault(); ACT['em-email'](tabs[next]);
  });
  ACT['em-copy1'] = (el) => { const s = findSet(el.dataset.id); const e = s && s.emails[+el.dataset.i]; if (e) U.copy(EW().asText(e)); };
  ACT['em-copyall'] = (el) => { const s = findSet(el.dataset.id); if (s) U.copy(EW().setText(s.title, s.emails)); };
  ACT['em-copytpl'] = (el) => { const q = LIB().byId(el.dataset.id); const e = q && q.emails[+el.dataset.i]; if (e) U.copy(EW().asText(e)); };
  ACT['em-copyseq'] = (el) => { const q = LIB().byId(el.dataset.id); if (q) U.copy(EW().setText(q.title, q.emails)); };
  ACT['em-rwopen'] = (el) => { S.rw[el.dataset.id] = !S.rw[el.dataset.id]; window.App.render(true); const i = document.querySelector(`[data-emnote="${CSS.escape(el.dataset.id)}"]`); if (i) i.focus(); };
  ACT['em-del'] = async (el) => {
    const s = findSet(el.dataset.id); if (!s) return;
    if (!isLive()) { St.s.emailSets = sets().filter((x) => x !== s); window.App.render(true); return U.toast('Deleted'); }
    try { await window.Auth.emails.remove(s.id); S.sets = S.sets.filter((x) => x !== s); U.toast('Deleted'); } catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render(true);
  };

  function demoWrite(seq, item, offer, prevSet) {
    const emails = EW().fill(seq, { offer, founder: founder(), item });
    const row = { id: prevSet ? prevSet.id : 'em' + Date.now().toString(36), sequence: seq.id, title: seq.title + (offer ? ' for ' + offer : ''), item_name: offer, context: F.context, emails, by: 'Sample', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (prevSet) Object.assign(prevSet, row); else St.s.emailSets = [row].concat(sets());
    return prevSet || row;
  }
  ACT['em-write'] = async () => {
    if (S.busy) return;
    const seq = LIB().byId(F.sequence); if (!seq) return U.toast('Pick a sequence');
    const it = offers().find((i) => String(i.id) === String(F.item)) || null; const offer = it ? it.name : F.offer.trim();
    if (!offer && F.context.trim().length < 20) return U.toast('Pick an offer or funnel, or describe it in the context box');
    S.busy = true; S.writeError = ''; S.writeCount = seq.count; window.App.render(true);
    try {
      let row;
      if (!isLive()) { await new Promise((r) => setTimeout(r, 700)); row = demoWrite(seq, it, offer); U.toast(`${seq.count} emails written`); }
      else {
        const r = await window.Auth.brainApi('email-write', { workspace_id: ctx().ws.id, sequence: seq.id, item_id: it ? it.id : null, offer_name: offer, context: F.context, founder: founder() });
        row = r.set; S.sets = [row].concat(S.sets.filter((x) => x.id !== row.id)); U.toast(`${(row.emails || []).length} emails written by ${r.by}`);
      }
      S.open = {}; S.open[row.id] = true;
    } catch (e) { S.writeError = window.Auth.friendly(e); }
    S.busy = false; window.App.render(true);
    const first = document.querySelector('.em-set'); if (!S.writeError && first && matchMedia('(max-width: 980px)').matches) first.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  ACT['em-rewrite'] = async (el) => {
    const s = findSet(el.dataset.id); if (!s || S.busySet[s.id]) return; const seq = LIB().byId(s.sequence) || (s.sequence === 'morning-email' ? { id: s.sequence } : null); if (!seq) return;
    const inp = document.querySelector(`[data-emnote="${CSS.escape(String(s.id))}"]`); const note = inp ? inp.value.trim() : '';
    if (!note) return U.toast('Say what should change first');
    if (!isLive()) return U.toast('Rewrites run on your AI in your own workspace');
    if (!aiOn()) return U.toast('Connect Claude, OpenAI or Perplexity in Connections to rewrite emails');
    S.busySet[s.id] = true; S.rwNote[s.id] = note; delete S.rwError[s.id]; window.App.render(true);
    try {
      U.toast('Rewriting with your note. About a minute.');
      const r = await window.Auth.brainApi('email-write', { workspace_id: ctx().ws.id, set_id: s.id, sequence: seq.id, offer_name: s.item_name || '', context: s.context || '', note, founder: founder() });
      S.sets = S.sets.map((x) => (x.id === s.id ? r.set : x)); S.rw[s.id] = false; delete S.rwNote[s.id]; U.toast('Rewritten by ' + r.by);
    } catch (e) { S.rwError[s.id] = window.Auth.friendly(e); }
    delete S.busySet[s.id]; window.App.render(true);
  };

  window.OSEmails = {
    open: async (id) => {
      if (isLive()) await load(true);
      const set = findSet(id); if (!set) throw new Error('That email draft is no longer available.');
      VS.emTab = 'write';
      S.open = Object.fromEntries(sets().map((s) => [s.id, s.id === id]));
      VS.view = 'emails'; location.hash = '#emails'; window.App.render(true);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-set="${CSS.escape(String(id))}"]`);
        el?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        el?.querySelector('.em-set-h')?.focus({ preventScroll: true });
      });
    },
  };

  /* ---------- typing: the form remembers itself, edits save on their own ---------- */
  const timers = {};
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset && t.dataset.emnote) { S.rwNote[t.dataset.emnote] = t.value; return; }
    if (t.dataset && t.dataset.emf) {
      const k = t.dataset.emf; F[k] = t.value; saveForm();
      if (k === 'sequence' || k === 'item') window.App.render(true);
      return;
    }
    if (t.dataset && t.dataset.emedit) {
      const s = findSet(t.dataset.emedit); if (!s) return; const e = s.emails[+t.dataset.i]; if (!e) return;
      e[t.dataset.k] = t.value;
      if (!isLive()) return;
      clearTimeout(timers[s.id]); timers[s.id] = setTimeout(() => { window.Auth.emails.save(s.id, s.emails).catch((err) => U.toast(window.Auth.friendly(err))); }, 700);
    }
  });
})();

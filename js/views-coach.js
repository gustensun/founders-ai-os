// Founders AI OS: Coach library, admin only. Pick which frameworks, coaching calls and latest videos the AI Coach
// learns from, preview what the privacy filter removes, and publish cleaned copies to the shared library.
(() => {
  const U = window.UI, ACT = window.ACT; const { esc, icon } = U;
  const S = { api: null, data: null, loading: false, err: null, picked: new Set(), busy: null, report: null };
  const keyOf = (r) => r.kind + ':' + r.ref;
  const WHY = { money: 'Income or sales claim', finance: 'Finances', personal: 'Personal life', beliefs: 'Beliefs', 'private question': 'Private question', 'private answer': 'Private answer' };
  const mins = (s) => (s ? Math.round(s / 60) + ' min' : '');
  const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

  function row(r) {
    const p = r.published; const on = S.picked.has(keyOf(r));
    const meta = [r.kind === 'youtube' ? day(r.at) + (r.seconds ? ' · ' + mins(r.seconds) : '') : r.kind === 'recording' ? (r.minutes ? r.minutes + ' min' : '') : '', p ? `In the Coach · ${p.passages} passages${p.removed ? ' · ' + p.removed + ' removed' : ''}` : 'Not in the Coach'].filter(Boolean).join(' · ');
    return `<li class="co-row${p ? ' is-live' : ''}"><label class="co-pick"><input type="checkbox" data-action="co-pick" data-k="${esc(keyOf(r))}" ${on ? 'checked' : ''} ${S.busy ? 'disabled' : ''}><span class="grow"><b>${esc(r.title)}</b><span class="meta">${esc(meta)}</span></span></label>
      <span class="co-acts">${r.kind !== 'youtube' ? `<button class="linkish meta" type="button" data-action="co-preview" data-k="${esc(keyOf(r))}" ${S.busy ? 'disabled' : ''}>Preview</button>` : ''}${p ? `<button class="linkish meta" type="button" data-action="co-remove" data-id="${esc(p.id)}" ${S.busy ? 'disabled' : ''}>Remove</button>` : ''}</span></li>`;
  }
  function section(title, note, rows) {
    if (!rows.length) return `<section class="co-sec"><h3>${esc(title)}</h3><p class="meta">${esc(note)}</p><p class="meta">Nothing here yet.</p></section>`;
    return `<section class="co-sec"><h3>${esc(title)}</h3><p class="meta">${esc(note)}</p><ul class="co-list">${rows.map(row).join('')}</ul></section>`;
  }
  function html() {
    const d = S.data;
    const top = `<div class="dbody co"><h2>Coach library</h2><p class="meta">${U.esc((window.CoachGuard && window.CoachGuard.coachLabel ? window.CoachGuard.coachLabel() : 'AI Coach'))} learns from cleaned copies of these sources. Income, sales, finances, personal life and member names are removed before anything is published, and members only ever see short passages in answers.</p>`;
    if (S.err) return top + `<p class="auth-msg">${esc(S.err)}</p></div>`;
    if (!d) return top + `<p class="meta">${U.spin} Loading your sources</p></div>`;
    const all = [...d.docs, ...d.recordings, ...d.videos];
    const n = all.filter((r) => S.picked.has(keyOf(r))).length;
    const live = all.filter((r) => r.published).length;
    const rep = S.report ? `<section class="co-report" role="status"><h3>${S.report.ok} published${S.report.failed ? ', ' + S.report.failed + ' did not' : ''}</h3><p class="meta">${S.report.removed} private ${S.report.removed === 1 ? 'sentence' : 'sentences'} removed.</p>${S.report.errors.length ? `<ul class="co-errs">${S.report.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}${S.report.preview.length ? `<details><summary>See what was removed</summary><ul class="co-removed">${S.report.preview.map((x) => `<li><span class="meta">${esc(WHY[x.why] || x.why)}</span>${esc(x.text)}</li>`).join('')}</ul></details>` : ''}</section>` : '';
    return top + `${rep}
      ${section('Frameworks and resources', 'From your Brain. Programs, course structures, your funnels and offers library stay out.', d.docs)}
      ${section('Coaching calls', 'Only your own words are kept, and member names become "a member".', d.recordings)}
      ${section('Latest videos' + (d.channel ? ', ' + d.channel : ''), 'Your 10 newest business videos. Transcripts use your Apify connection.', d.videos)}
      <div class="co-foot"><span class="meta grow">${S.busy ? U.spin + ' ' + esc(S.busy) : `${n} selected · ${live} in the Coach`}</span><button class="btn primary" type="button" data-action="co-publish" ${S.busy || !n ? 'disabled' : ''}>Publish selected</button></div></div>`;
  }
  const paint = () => { const d = document.getElementById('drawer'); if (d && d.classList.contains('open') && d.querySelector('.co')) U.drawer(html(), { label: 'Coach library', wide: true }); };

  async function load() {
    S.loading = true; S.err = null;
    try {
      S.data = await S.api('coach-library');
      S.picked = new Set([...S.data.docs, ...S.data.recordings, ...S.data.videos].filter((r) => r.published || (r.suggested && !S.data.published.length)).map(keyOf));
    } catch (e) { S.err = e.message; }
    S.loading = false; paint();
  }
  function open(api) { S.api = api; S.report = null; U.drawer(html(), { label: 'Coach library', wide: true }); load(); }

  ACT['co-pick'] = (el) => { const k = el.dataset.k; if (el.checked) S.picked.add(k); else S.picked.delete(k); paint(); };
  ACT['co-preview'] = async (el) => {
    const [kind, ref] = el.dataset.k.split(':'); el.disabled = true;
    try {
      const r = await S.api('coach-preview', { item: { kind, ref } });
      U.drawer(`<div class="dbody co"><h2>What gets published</h2><p class="meta">${r.passages} ${r.passages === 1 ? 'passage' : 'passages'}. ${r.removed.length} ${r.removed.length === 1 ? 'sentence' : 'sentences'} removed by the privacy filter.</p>
        ${r.removed.length ? `<h3>Removed</h3><ul class="co-removed">${r.removed.map((x) => `<li><span class="meta">${esc(WHY[x.why] || x.why)}</span>${esc(x.text)}</li>`).join('')}</ul>` : '<p class="meta">Nothing personal or financial was found.</p>'}
        ${r.sample.length ? `<h3>First passage</h3><p class="co-sample">${esc(r.sample[0])}</p>` : ''}</div>`, { label: 'Coach preview', push: true, wide: true });
    } catch (e) { U.toast(e.message); el.disabled = false; }
  };
  ACT['co-remove'] = async (el) => {
    if (!(await U.dialog({ title: 'Remove from the Coach?', body: (window.CoachGuard && window.CoachGuard.coachLabel ? window.CoachGuard.coachLabel() : 'AI Coach') + ' stops using this source. Your original stays where it is.', ok: 'Remove', danger: true }))) return;
    S.busy = 'Removing'; paint();
    try { await S.api('coach-remove', { id: el.dataset.id }); } catch (e) { U.toast(e.message); }
    S.busy = null; await load();
  };
  ACT['co-publish'] = async () => {
    const d = S.data; if (!d || S.busy) return;
    const byKey = new Map([...d.docs, ...d.recordings, ...d.videos].map((r) => [keyOf(r), r]));
    const items = [...S.picked].map((k) => byKey.get(k)).filter(Boolean).map((r) => ({ kind: r.kind, ref: r.ref, title: r.title, at: r.at }));
    const text = items.filter((i) => i.kind !== 'youtube'); const vids = items.filter((i) => i.kind === 'youtube');
    const batches = []; for (let i = 0; i < text.length; i += 6) batches.push(text.slice(i, i + 6)); for (let i = 0; i < vids.length; i += 2) batches.push(vids.slice(i, i + 2));
    const rep = { ok: 0, failed: 0, removed: 0, errors: [], preview: [] }; let done = 0;
    for (const b of batches) {
      S.busy = `Publishing ${Math.min(done + b.length, items.length)} of ${items.length}`; paint();
      try {
        const r = await S.api('coach-publish', { items: b });
        for (const x of r.results) { const t = byKey.get(x.kind + ':' + x.ref)?.title || x.ref; if (x.ok) { rep.ok++; rep.removed += x.removed; rep.preview.push(...(x.preview || []).slice(0, 8)); } else { rep.failed++; rep.errors.push(t + ': ' + x.error); } }
      } catch (e) { rep.failed += b.length; rep.errors.push(e.message); }
      done += b.length;
    }
    S.busy = null; S.report = rep; await load();
  };
  window.CoachLibrary = { open };
})();

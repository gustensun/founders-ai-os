// AI suggest: drafts the empty fields of a form from the founder's own context.
// It never overwrites text the founder typed. Clear a field and press it again to get a new draft.
(() => {
  const U = window.UI, ACT = window.ACT;
  const { esc, icon } = U;
  const REG = {}; // scope -> { kind, fields?, apply?, ctx? }
  const busy = new Set();
  const live = () => !!(window.App && window.App.isLive && window.App.isLive());
  const wsId = () => { try { return window.App.liveCtx().ws.id; } catch (e) { return null; } };

  function button(scope, opt = {}) {
    const on = busy.has(scope);
    return `<button type="button" class="btn sm ${opt.primary ? '' : 'ghost '}ai-sg" data-action="ai-suggest" data-sg="${esc(scope)}" title="Drafts every empty field from your offer, Brand DNA and approved facts. Your own text is never replaced." ${on ? 'disabled aria-busy="true"' : ''}>${on ? U.spin + 'Suggesting' : icon('sparkle') + esc(opt.label || 'AI suggest')}</button>`;
  }
  function register(scope, spec) { REG[scope] = spec; }

  // Fields straight from the form: every textarea plus inputs marked data-sg. Skip anything marked data-sg-skip.
  const keyOf = (el, i) => el.dataset.sgKey || el.name || el.dataset.fcbrief || el.dataset.emf || el.dataset.gxf || 'field_' + i;
  function labelOf(el) {
    const l = el.closest('label');
    const s = l && (l.querySelector('span') || l);
    let t = s ? (s.childNodes[0] && s.childNodes[0].nodeType === 3 ? s.childNodes[0].textContent : s.textContent) : '';
    if (!t.trim()) { const h = el.closest('section, .gx-body, .dsec'); const hh = h && h.querySelector('h3, h2'); t = (hh && hh.textContent) || el.getAttribute('aria-label') || ''; }
    return t.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function domFields(root) {
    return [...root.querySelectorAll('textarea, input[data-sg]')].filter((el) => !el.disabled && !el.readOnly && !el.closest('[data-sg-skip]') && el.dataset.sgSkip == null)
      .map((el, i) => { const key = keyOf(el, i); const label = labelOf(el) || key; return { el, key, label, hint: el.getAttribute('placeholder') || '', value: el.value || '', proof: /proof|testimonial/i.test(key + ' ' + label) }; });
  }
  function domApply(fields, values) {
    let n = 0;
    fields.forEach((f) => {
      const v = values[f.key]; if (!v || !f.el || !f.el.isConnected || f.el.value.trim()) return; // the founder typed in the meantime: keep it
      f.el.value = v; f.el.classList.add('sg-new'); n++;
      f.el.dispatchEvent(new Event('input', { bubbles: true }));
      f.el.addEventListener('input', () => f.el.classList.remove('sg-new'), { once: true });
    });
    return n;
  }

  // Demo workspace: sample drafts built from the offer name and price. Real workspaces use the founder's own model.
  function demo(fields, c) {
    const name = c.offer_name || c.title || 'this offer'; const price = c.price || '';
    const T = [
      [/proof|testimonial/i, ''],
      [/who|audience/i, `Founders and coaches who already sell something but have no simple system to turn content into buyers for ${name}.`],
      [/result|outcome|transformation|promise|goal/i, `A finished, working ${name} setup in 30 days, with the first sales coming from content they already make.`],
      [/price|payment/i, price],
      [/angle|positioning|difference/i, 'Show the finished result first, then the shortest path to it. One founder, one system, hosted on HighLevel.'],
      [/section|steps|journey/i, 'Hero, problem, method, offer stack, bonuses, guarantee, FAQ, final call'],
      [/deliver|timeline/i, 'Self-paced lessons plus one live build call a week for four weeks.'],
      [/includ/i, '1. Core training\n2. Templates and prompts\n3. Weekly live build call\n4. Private community'],
      [/guarantee|terms/i, ''],
      [/objection/i, 'No time, not technical, tried courses before that did not get finished.'],
      [/content|angles/i, 'Behind the scenes of a live build, before and after of a page, the one mistake that kills a funnel.'],
      [/traffic/i, 'YouTube, Instagram reels and the email list.'],
      [/call to action|cta/i, `Join ${name}`],
      [/follow/i, 'Five emails over seven days: welcome, story, proof, objections, last call.'],
      [/measure/i, 'Opt-in rate, checkout conversion, cost per buyer.'],
      [/next/i, 'Write the offer stack and review it on Friday.'],
      [/avoid|must say|notes/i, 'Keep it plain and specific. No hype words, no fake urgency.'],
      [/what you sell|summary|what this funnel does|description|about|context|brief|idea/i, `${name}: a guided program that helps founders build and launch one offer with a working funnel on HighLevel.${price ? ' Price ' + price + '.' : ''}`],
      [/teaching|script/i, 'Open with the outcome of this lesson. Show the one step on screen. End with the action to take before the next lesson.'],
    ];
    const out = {};
    fields.forEach((f) => { if (String(f.value || '').trim()) return; const hit = T.find(([re]) => re.test(f.key + ' ' + f.label)); if (hit && hit[1]) out[f.key] = hit[1]; });
    return out;
  }

  async function run(scope, btn) {
    if (busy.has(scope)) return;
    const spec = REG[scope] || {};
    const root = document.querySelector(`[data-sg-scope="${CSS.escape(scope)}"]`);
    if (spec.before) spec.before();
    const fields = spec.fields ? spec.fields() : root ? domFields(root) : [];
    if (!fields.length) return U.toast('Nothing here to fill in yet.');
    const empty = fields.filter((f) => !String(f.value || '').trim());
    if (!empty.length) return U.toast('Every field already has your text. Clear one to get a new suggestion.');
    const c = (spec.ctx ? spec.ctx() : {}) || {};
    busy.add(scope); const label = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.innerHTML = U.spin + 'Suggesting'; }
    try {
      let values;
      if (live()) {
        const draft = {}; fields.filter((f) => String(f.value || '').trim()).forEach((f) => { draft[f.key] = f.value; });
        const r = await window.Auth.funnel.api('suggest', { workspace_id: wsId(), kind: spec.kind || 'offer', title: c.title || null, offer_id: c.offer_id || null, offer_name: c.offer_name || null, context: c.context || null, draft: { ...(c.draft || {}), ...draft }, fields: fields.map(({ key, label, hint, value, proof }) => ({ key, label, hint, value, proof })) });
        values = r.values || {};
      } else { await new Promise((res) => setTimeout(res, 500)); values = demo(fields, c); }
      const n = spec.apply ? spec.apply(values, fields) : domApply(fields, values);
      const skipped = empty.length - n;
      U.toast(n ? `Filled ${n} empty field${n === 1 ? '' : 's'}. Review and edit before you save.${skipped ? ' ' + skipped + ' left empty where there was nothing real to use.' : ''}` : 'No suggestions this time. Add a little more context and try again.');
    } catch (e) {
      U.toast('AI suggest did not go through: ' + (window.Auth && window.Auth.friendly ? window.Auth.friendly(e) : e.message));
    } finally {
      busy.delete(scope);
      const b = btn && btn.isConnected ? btn : document.querySelector(`[data-action="ai-suggest"][data-sg="${CSS.escape(scope)}"]`);
      if (b) { b.disabled = false; b.removeAttribute('aria-busy'); b.innerHTML = label && !/Suggesting/.test(label) ? label : icon('sparkle') + 'AI suggest'; }
    }
  }
  ACT['ai-suggest'] = (el) => run(el.dataset.sg, el);

  window.AISuggest = { button, register, run, demo, _fields: domFields };
})();

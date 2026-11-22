// Shared Programs data rules. AI produces proposals; only a separate human confirmation applies them.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Programs = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const uuid = () => globalThis.crypto.randomUUID();
  const isId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  const text = (v, max = 200) => String(v == null ? '' : v).replace(/\0/g, '').trim().slice(0, max);
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const KINDS = { lesson: 'Lesson', session: 'Coaching session', exercise: 'Exercise', resource: 'Resource' };
  const STATES = { idea: 'Idea', draft: 'Draft', ready: 'Ready' };
  const MAX_FILE = 500 * 1024 * 1024;
  const MAX_TEXT = 250000;
  function card(v = {}, fresh = false) {
    if (!text(v.title)) throw new Error('Give every lesson or session a title.');
    return { id: !fresh && isId(v.id) ? v.id : uuid(), title: text(v.title), body: text(v.body, 20000),
      kind: KINDS[v.kind] ? v.kind : 'lesson', status: STATES[v.status] ? v.status : 'idea',
      material_ids: fresh ? [] : [...new Set((Array.isArray(v.material_ids) ? v.material_ids : []).filter(isId))].slice(0, 30) };
  }
  function stage(v = {}, fresh = false) {
    if (!text(v.title)) throw new Error('Give every module a name.');
    if (!Array.isArray(v.cards || []) || (v.cards || []).length > 100) throw new Error('A module can hold up to 100 lessons.');
    return { id: !fresh && isId(v.id) ? v.id : uuid(), title: text(v.title), cards: (v.cards || []).map(c => card(c, fresh)) };
  }
  function normalize(v = {}, fresh = false) {
    if (!text(v.title)) throw new Error('Give the program a name.');
    if (!Array.isArray(v.stages || []) || (v.stages || []).length > 24) throw new Error('A program can hold up to 24 modules.');
    const out = { title: text(v.title), description: text(v.description, 6000),
      kind: v.kind === 'coaching' ? 'coaching' : 'course', access: v.access === 'paid' ? 'paid' : 'free',
      stages: (v.stages || []).map(s => stage(s, fresh)) };
    const ids = out.stages.flatMap(s => [s.id, ...s.cards.map(c => c.id)]);
    if (new Set(ids).size !== ids.length) throw new Error('A module or lesson appears more than once.');
    if (count(out).cards > 300 || JSON.stringify(out).length > 600000) throw new Error('This program is too large. Split it into smaller programs.');
    return out;
  }
  function count(data) {
    const stages = data?.stages || [];
    const cards = stages.flatMap(s => s.cards || []);
    return { stages: stages.length, cards: cards.length, ready: cards.filter(c => c.status === 'ready').length };
  }
  function move(data, cardId, stageId, beforeId = null) {
    const next = copy(data), target = next.stages.find(s => s.id === stageId);
    const source = next.stages.find(s => s.cards.some(c => c.id === cardId));
    if (!target || !source) throw new Error('That lesson or module is no longer here.');
    if (beforeId === cardId) return next;
    const item = source.cards.splice(source.cards.findIndex(c => c.id === cardId), 1)[0];
    const at = beforeId ? target.cards.findIndex(c => c.id === beforeId) : -1;
    target.cards.splice(at < 0 ? target.cards.length : at, 0, item);
    return normalize(next);
  }
  function applyChanges(data, changes) {
    if (!Array.isArray(changes) || !changes.length || changes.length > 60) throw new Error('The AI did not return a usable set of changes.');
    let next = copy(data); const labels = [];
    for (const x of changes) {
      const s = next.stages.find(s => s.id === x.stage_id);
      const host = next.stages.find(s => s.cards.some(c => c.id === x.card_id));
      const c = host?.cards.find(c => c.id === x.card_id);
      if (x.type === 'add_module') {
        const added = stage({ title: x.title, cards: x.cards || [] }, true); next.stages.push(added);
        labels.push('Add module: ' + added.title + ' (' + added.cards.length + ' lessons)');
      } else if (x.type === 'rename_module' && s && text(x.title)) {
        labels.push('Rename module: ' + s.title + ' → ' + text(x.title)); s.title = text(x.title);
      } else if (x.type === 'add_lesson' && s) {
        const added = card(x, true); s.cards.push(added); labels.push('Add to ' + s.title + ': ' + added.title);
      } else if (x.type === 'edit_lesson' && c) {
        const fields = ['title', 'body', 'kind', 'status'].filter(k => Object.hasOwn(x, k));
        if (!fields.length) throw new Error('A lesson edit has no changed fields.');
        const updated = card({ ...c, ...Object.fromEntries(fields.map(k => [k, x[k]])) });
        host.cards[host.cards.indexOf(c)] = updated; labels.push('Edit ' + c.title + ': ' + fields.join(', '));
      } else if (x.type === 'move_lesson' && c && s) {
        next = move(next, c.id, s.id); labels.push('Move ' + c.title + ' to ' + s.title);
      } else if (x.type === 'edit_details') {
        const fields = ['title', 'description', 'kind', 'access'].filter(k => Object.hasOwn(x, k));
        if (!fields.length) throw new Error('A program edit has no changed fields.');
        for (const k of fields) next[k] = x[k]; labels.push('Edit program details: ' + fields.join(', '));
      } else throw new Error('A proposed change refers to a missing lesson, module or unsupported action. Nothing was changed.');
    }
    return { data: normalize(next), changes: labels };
  }
  function parse(raw) {
    const clean = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('The AI did not return a readable proposal. Nothing was created.');
    const v = JSON.parse(clean.slice(a, b + 1));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('The proposal was not an object.');
    return v;
  }
  const intent = q => /\b(programs?|courses?|curricul(?:um|a)|coaching packages?)\b/i.test(q) && /\b(build|create|outline|map|plan|design|draft|update|edit|change|rework)\b/i.test(q);
  const filename = s => text(s, 160).replace(/[^\w.\- ]+/g, '').replace(/\.{2,}/g, '').replace(/\s+/g, '-') || 'material';
  const safeUrl = value => { try { const u = new URL(String(value)); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  function markdown(data) {
    return '# ' + data.title + '\n\n' + [data.kind === 'coaching' ? 'Coaching program' : 'Course', data.access === 'paid' ? 'Paid' : 'Free'].join(' · ') + '\n\n' + (data.description || '') + '\n\n' +
      data.stages.map(s => '## ' + s.title + '\n\n' + s.cards.map(c => '### ' + c.title + '\n\n' + KINDS[c.kind] + ' · ' + STATES[c.status] + '\n\n' + (c.body || '')).join('\n\n')).join('\n\n');
  }
  return { uuid, isId, text, copy, card, stage, normalize, count, move, applyChanges, parse, intent, filename, safeUrl, markdown, KINDS, STATES, MAX_FILE, MAX_TEXT };
});

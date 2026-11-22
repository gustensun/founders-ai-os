// Founders AI OS: the Content Funnel on the server. Freebies and plans are saved per workspace under the
// signed-in member's own access. With Claude, OpenAI or Perplexity connected the plan is written from the Brand DNA,
// otherwise the rules write it. Picked ideas are added to the content board as suggestions to approve.
const { bad, sb, q } = require('./_lib');
const F = require('../js/content-funnel.js');

const COLS = 'id,kind,strategy_id,name,summary,url,leads_to,plan,position,updated_at';
const ROWSEL = 'id,title,stage,channel,format,publish_at,position,meta,created_at,updated_at';
const uuid = (v, what) => { if (!F.isId(v)) throw bad((what || 'That item') + ' is not valid.'); return String(v); };

async function load(jwt, ws) {
  const [rows, strategy] = await Promise.all([
    sb(jwt, `/rest/v1/content_funnel?workspace_id=eq.${q(ws)}&select=${COLS}&order=position.asc,created_at.asc&limit=400`),
    require('./_strategy').rows(jwt, ws),
  ]);
  return { rows: rows || [], freebies: (rows || []).filter((r) => r.kind === 'freebie'), strategy: strategy || [] };
}
// Prices and private notes stay on the Offers and Funnels pages. This page only needs names and status.
const slim = (x) => ({ id: x.id, kind: x.kind, name: x.name, lifecycle: x.lifecycle, summary: String(x.summary || '').slice(0, 600), url: x.url || '', linked_offer_id: x.linked_offer_id || null });
const freebieOut = ({ id, name, summary, url, leads_to, plan, position, updated_at }) => ({ id, kind: 'freebie', name, summary, url, leads_to, plan: F.normalizePlan(plan), position, updated_at });

function service({ ai, aiKeys, dnaBody }) {
  const writer = async (jwt, ws, off) => { if (off) return null; const keys = await aiKeys(jwt, ws); return keys.claude || keys.openai || keys.perplexity ? (sys, user, max) => ai(keys, sys, user, max) : null; };

  async function list(jwt, b) {
    const d = await load(jwt, b.workspace_id); const plans = {};
    d.rows.filter((r) => r.kind !== 'freebie' && r.strategy_id).forEach((r) => { const p = F.normalizePlan(r.plan); if (p) plans[r.strategy_id] = p; });
    return { freebies: d.freebies.map(freebieOut), plans, strategy: d.strategy.map(slim) };
  }

  // One freebie, or a pasted list of names.
  async function save(jwt, b) {
    const ws = b.workspace_id; const d = await load(jwt, ws);
    const target = (v) => { if (v == null || v === '') return null; const id = uuid(v, 'That offer'); if (!d.strategy.some((x) => x.id === id)) throw bad('That offer is no longer in Offers or Funnels.', 404); return id; };
    if (b.id) {
      const id = uuid(b.id, 'That freebie'); const f = F.normalizeFreebie(b.freebie);
      const old = d.freebies.find((x) => x.id === id); if (!old) throw bad('That freebie is gone.', 404);
      const leads = target(f.leads_to); const patch = { name: f.name, summary: f.summary, url: f.url, leads_to: leads, updated_at: new Date().toISOString() };
      // the bottom stage was written for the old offer, so it is cleared to be written again
      const plan = F.normalizePlan(old.plan); if (plan && (old.leads_to || null) !== leads && plan.stages.bottom.length) patch.plan = { ...plan, stages: { ...plan.stages, bottom: [] } };
      const rows = await sb(jwt, `/rest/v1/content_funnel?id=eq.${q(id)}&workspace_id=eq.${q(ws)}&kind=eq.freebie&select=${COLS}`, { method: 'PATCH', prefer: 'return=representation', body: patch });
      if (!rows || !rows[0]) throw bad('That freebie is gone.', 404);
      return { freebies: rows.map(freebieOut) };
    }
    const have = new Set(d.freebies.map((x) => F.norm(x.name)));
    const leads = target(b.leads_to != null ? b.leads_to : b.freebie && b.freebie.leads_to);
    let fresh = Array.isArray(b.names) ? F.parseNames(b.names.map(String).join('\n')).map((name) => ({ name, summary: '', url: '' })) : [F.normalizeFreebie(b.freebie)];
    const skipped = fresh.filter((x) => have.has(F.norm(x.name))).length;
    fresh = fresh.filter((x) => { const k = F.norm(x.name); if (have.has(k)) return false; have.add(k); return true; });
    if (!fresh.length) { if (skipped) throw bad(skipped === 1 ? 'That freebie is already on the list.' : 'Those freebies are already on the list.', 409); throw bad('Add at least one freebie.'); }
    if (d.freebies.length + fresh.length > F.MAX_FREEBIES) throw bad(`Keep the list to ${F.MAX_FREEBIES} freebies. Remove one you no longer give away first.`, 409);
    const start = d.freebies.reduce((m, x) => Math.max(m, Number(x.position) || 0), 0) + 1;
    const rows = await sb(jwt, `/rest/v1/content_funnel?select=${COLS}`, { method: 'POST', prefer: 'return=representation', body: fresh.map((x, i) => ({ workspace_id: ws, kind: 'freebie', name: x.name, summary: x.summary || '', url: x.url || '', leads_to: leads, position: start + i })) });
    return { freebies: (rows || []).map(freebieOut), skipped };
  }

  async function remove(jwt, b) {
    const id = uuid(b.id, 'That freebie');
    await sb(jwt, `/rest/v1/content_funnel?id=eq.${q(id)}&workspace_id=eq.${q(b.workspace_id)}&kind=eq.freebie`, { method: 'DELETE', prefer: 'return=minimal' });
    return { ok: true };
  }

  // The freebie, offer or funnel a request is about, with everything a writer needs.
  function find(d, source) {
    const kind = String((source && source.kind) || ''); const id = uuid(source && source.id);
    if (kind === 'freebie') {
      const f = d.freebies.find((x) => x.id === id); if (!f) throw bad('That freebie is gone.', 404);
      return { ctx: F.context({ ...f, kind: 'freebie' }, d.freebies, d.strategy), row: f, plan: F.normalizePlan(f.plan) };
    }
    const s = d.strategy.find((x) => x.id === id && x.kind === kind); if (!s) throw bad('That is no longer in Offers or Funnels.', 404);
    const row = d.rows.find((r) => r.strategy_id === id) || null;
    return { ctx: F.context(s, d.freebies, d.strategy), row, plan: row ? F.normalizePlan(row.plan) : null, strategy: s };
  }
  async function store(jwt, ws, found, plan) {
    const body = { plan, updated_at: new Date().toISOString() };
    if (found.row) { await sb(jwt, `/rest/v1/content_funnel?id=eq.${q(found.row.id)}&workspace_id=eq.${q(ws)}`, { method: 'PATCH', prefer: 'return=minimal', body }); return; }
    const s = found.strategy;
    try { await sb(jwt, '/rest/v1/content_funnel', { method: 'POST', prefer: 'return=minimal', body: { workspace_id: ws, kind: s.kind, strategy_id: s.id, plan } }); }
    catch (e) { // another tab saved the first plan a moment ago
      await sb(jwt, `/rest/v1/content_funnel?strategy_id=eq.${q(s.id)}&workspace_id=eq.${q(ws)}`, { method: 'PATCH', prefer: 'return=minimal', body });
    }
  }

  // Writes the first plan, or adds angles to a saved one. Saved angles are never replaced.
  async function plan(jwt, b) {
    const ws = b.workspace_id; const d = await load(jwt, ws); const found = find(d, b.source);
    const stages = F.stagesFor(found.ctx); const size = (id) => (found.plan ? found.plan.stages[id].length : 0);
    // a stage with nothing in it gets two angles, a stage that already has some gets one more
    const need = (id) => (size(id) ? 1 : 2); const n = Math.max(...stages.map(need));
    if (stages.every((id) => size(id) >= F.MAX_ANGLES)) throw bad(`Each stage holds up to ${F.MAX_ANGLES} angles. Remove one to make room.`, 409);
    let fresh = null, by = 'Rules';
    const write = await writer(jwt, ws, b.ai === false);
    if (write) {
      try {
        const dna = await dnaBody(jwt, ws);
        const r = await write(F.SYS, [dna ? 'MY BRAND DNA\n' + dna : '', F.planPrompt(found.ctx, n, found.plan)].filter(Boolean).join('\n\n'), 1400 + n * 1500);
        const got = r && F.parsePlan(r.text, found.ctx, n);
        if (got) { fresh = got; by = r.by; }
      } catch { /* the rules still write the plan */ }
    }
    const rules = F.rules(found.ctx, n, found.plan);
    if (!fresh) fresh = rules;
    else stages.forEach((id) => { if (!(fresh[id] || []).length) fresh[id] = rules[id]; });
    stages.forEach((id) => { fresh[id] = (fresh[id] || []).slice(0, need(id)); });
    const merged = F.merge(found.plan, fresh, by);
    if (!merged.added) throw bad('No new angles came back. Try again in a moment.', 409);
    await store(jwt, ws, found, merged.plan);
    return { ok: true, by, added: merged.added, plan: merged.plan };
  }

  async function angleRemove(jwt, b) {
    const ws = b.workspace_id; const d = await load(jwt, ws); const found = find(d, b.source);
    if (!found.plan || !found.row) throw bad('There is no plan to edit yet.', 404);
    const next = F.removeAngle(found.plan, String(b.angle_id || ''));
    await store(jwt, ws, found, next);
    return { ok: true, plan: next };
  }

  // Picked ideas become full ideas waiting in Ideas to approve. An idea already waiting is not added twice.
  async function ideas(jwt, b) {
    const ws = b.workspace_id; const d = await load(jwt, ws); const found = find(d, b.source);
    if (!found.plan) throw bad('Write the funnel first.', 409);
    const seen = new Set();
    let picks = (Array.isArray(b.picks) ? b.picks : []).slice(0, 40).map((p) => {
      const stage = String((p && p.stage) || ''), format = String((p && p.format) || '');
      if (!F.STAGE[stage] || !F.FORMAT[format]) return null;
      const angle = F.findAngle(found.plan, stage, String(p.angle_id || '')); if (!angle) return null;
      const key = F.ideaKey(found.ctx.source.id, angle.id, format); if (seen.has(key)) return null; seen.add(key);
      return { stage, format, angle, key };
    }).filter(Boolean);
    if (!picks.length) throw bad('Pick at least one idea.');
    if (picks.length > F.MAX_PICKS) throw bad(`Send up to ${F.MAX_PICKS} ideas at a time.`);
    const waiting = await sb(jwt, `/rest/v1/content_items?workspace_id=eq.${q(ws)}&stage=neq.passed&meta->funnel->>source_id=eq.${q(found.ctx.source.id)}&select=key:meta->funnel->>key&limit=1000`);
    const have = new Set((waiting || []).map((x) => x.key));
    const skipped = picks.filter((p) => have.has(p.key)).length; picks = picks.filter((p) => !have.has(p.key));
    if (!picks.length) return { ok: true, by: null, rows: [], skipped };
    let out = picks.map((p) => ({ idea: F.expand(found.ctx, p.stage, p.angle, p.format), ai: false })); let by = 'Rules';
    const write = await writer(jwt, ws, b.ai === false);
    if (write) {
      const dna = await dnaBody(jwt, ws).catch(() => '');
      const groups = []; for (let i = 0; i < picks.length; i += 4) groups.push(picks.slice(i, i + 4));
      const done = await Promise.all(groups.map(async (g) => {
        try {
          const r = await write(F.SYS, [dna ? 'MY BRAND DNA\n' + dna : '', F.ideasPrompt(found.ctx, g)].filter(Boolean).join('\n\n'), 700 + g.length * 800);
          return r ? { list: F.parseIdeas(r.text, found.ctx, g), by: r.by } : null;
        } catch { return null; }
      }));
      out = done.flatMap((x, i) => x ? x.list.map((o) => ({ ...o, by: o.ai ? x.by : 'Rules' })) : groups[i].map((p) => ({ idea: F.expand(found.ctx, p.stage, p.angle, p.format), ai: false, by: 'Rules' })));
      by = (out.find((o) => o.ai) || {}).by || 'Rules';
    }
    const body = picks.map((p, k) => ({ workspace_id: ws, ...F.row(found.ctx, p.stage, p.angle, p.format, out[k].idea, out[k].ai ? out[k].by || by : 'Rules'), position: -Date.now() / 1e6 - k / 1e9 }));
    const rows = await sb(jwt, '/rest/v1/content_items?select=' + ROWSEL, { method: 'POST', prefer: 'return=representation', body });
    return { ok: true, by, rows: rows || [], skipped };
  }

  return { 'cf-list': list, 'cf-save': save, 'cf-remove': remove, 'cf-plan': plan, 'cf-angle-remove': angleRemove, 'cf-ideas': ideas };
}

module.exports = { service };

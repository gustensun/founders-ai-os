// Brand DNA helpers: read offers and funnels from HighLevel so the DNA always lists what is really for sale.
// Read-only. Nothing is written back to HighLevel.
const { clip, q } = require('./_lib');
const HL = 'https://services.leadconnectorhq.com';

async function hl(c, p) {
  const r = await fetch(HL + p, { headers: { Authorization: 'Bearer ' + c.token, Version: '2021-07-28', Accept: 'application/json' } });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  if (!r.ok) { const e = new Error(r.status === 401 ? 'HighLevel did not accept the token' : r.status === 403 ? 'The HighLevel token is missing the products or funnels read scope' : 'HighLevel answered ' + r.status); e.status = r.status; throw e; }
  return j || {};
}
const strip = (h) => clip(String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' '), 600);
const JUNK_OFFER = /\b(test|travel fee|nmi)\b/i;
const JUNK_FUNNEL = /^(ai generated funnel|test|untitled|copy of)\b|\(clone\)|\btest\b/i;
const DAY = 864e5;

async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } })); return out; }

async function catalog(c) {
  const L = q(c.location_id); const items = []; const kinds = [];
  // products and their prices
  try {
    let products = []; for (let off = 0; off < 400; off += 100) { const j = await hl(c, `/products/?locationId=${L}&limit=100&offset=${off}`); const p = j.products || []; products = products.concat(p); if (p.length < 100) break; }
    const prices = await pool(products, 6, (p) => hl(c, `/products/${q(p._id)}/price?locationId=${L}`).then((j) => (j.prices || []).filter((x) => !x.deleted)));
    products.forEach((p, k) => {
      const pr = (prices[k] || []).slice().sort((a, b) => (a.type === 'one_time' ? 0 : 1) - (b.type === 'one_time' ? 0 : 1) || (b.amount || 0) - (a.amount || 0))[0];
      const rec = pr && pr.type === 'recurring' && pr.recurring ? '/ ' + (pr.recurring.intervalCount > 1 ? pr.recurring.intervalCount + ' ' : '') + pr.recurring.interval : null;
      const fresh = Date.now() - Date.parse(p.updatedAt || p.createdAt || 0) < 540 * DAY;
      items.push({ kind: 'offer', ext_id: p._id, name: clip(p.name, 200), price: pr ? pr.amount : null, currency: pr ? pr.currency : null, price_note: rec, summary: strip(p.description), url: null, steps: null,
        included: p.availableInStore === true && !JUNK_OFFER.test(p.name || '') && fresh, ext_updated_at: p.updatedAt || p.createdAt || null });
    });
    kinds.push('offer');
  } catch (e) { items.err_offer = e.message; }
  // funnels and websites
  try {
    let funnels = []; for (let off = 0; off < 600; off += 100) { const j = await hl(c, `/funnels/funnel/list?locationId=${L}&limit=100&offset=${off}`); const f = j.funnels || []; funnels = funnels.concat(f); if (f.length < 100) break; }
    funnels.filter((f) => !f.deleted).forEach((f) => {
      const steps = (f.steps || []).length; const upd = f.dateUpdated || f.updatedAt || f.dateAdded;
      items.push({ kind: 'funnel', ext_id: f._id, name: clip(f.name, 200), url: f.url || null, steps, summary: clip((f.steps || []).map((s) => s.name).filter(Boolean).slice(0, 5).join(', '), 300), price: null,
        included: steps > 0 && !JUNK_FUNNEL.test(f.name || '') && Date.now() - Date.parse(upd || 0) < 120 * DAY, ext_updated_at: upd || null });
    });
    kinds.push('funnel');
  } catch (e) { items.err_funnel = e.message; }
  return { items: items.filter((i) => i.name), kinds, errors: [items.err_offer, items.err_funnel].filter(Boolean) };
}

module.exports = { catalog };

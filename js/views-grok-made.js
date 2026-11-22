// From Grok. Every PDF, graphic, piece of copy and content Grok Bot makes for the founder lands here on its own,
// through the grok_deliver tool and from finished Grok tasks with links. Nothing trains the Brain until the founder
// approves it. Approve adds it to the Brain library (and, if asked, to writing samples for voice). Dismiss drops it.
// Items are waiting rows in os_drafts with source "Grok Bot", so the Newsfeed and AI access lists skip them.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const live = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ws = () => (window.App.liveCtx().ws || {}).id;
  const render = () => window.App.render(true);
  const SOURCE = 'Grok Bot';
  const TYPE = { pdf: 'PDF', graphic: 'Graphic', copy: 'Copy', content: 'Content', other: 'File' };
  const words = (t) => (String(t || '').match(/\S+/g) || []).length;
  const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
  const g = (d) => (d.meta && d.meta.grok) || {};
  const typeOf = (d) => (TYPE[g(d).type] ? g(d).type : 'other');
  const isImg = (u) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(String(u || ''));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

  Object.assign(VS, { gmTab: VS.gmTab || 'waiting', gmType: VS.gmType || 'all' });
  const S = { key: null, rows: { waiting: [], approved: [], rejected: [] }, loading: false, loaded: false, err: '', busy: {}, timer: null };

  /* ---------- data ---------- */
  const key = () => (live() ? 'live:' : 'demo:') + (ws() || '');
  async function load(force) {
    const k = key();
    if (S.key !== k) Object.assign(S, { key: k, rows: { waiting: [], approved: [], rejected: [] }, loaded: false, err: '' });
    if (S.loading || (S.loaded && !force)) return;
    if (!live()) { S.rows = demo(); S.loaded = true; return; }
    S.loading = true;
    try {
      const [w, a, r] = await Promise.all(['waiting', 'approved', 'rejected'].map((st) => window.Auth.drafts.list(ws(), st)));
      if (k !== key()) return;
      const mine = (list) => (list || []).filter((d) => d.source === SOURCE);
      S.rows = { waiting: mine(w), approved: mine(a), rejected: mine(r) }; S.err = '';
    } catch (e) { if (k === key()) S.err = window.Auth.friendly ? window.Auth.friendly(e) : e.message; }
    finally { if (k === key()) { S.loading = false; S.loaded = true; if (VS.view === 'grok-made') render(); window.App.refreshCounts && window.App.refreshCounts(); poll(); } }
  }
  // While the page is open, check for new work from Grok every 30 seconds.
  function poll() {
    clearTimeout(S.timer); if (!live()) return;
    S.timer = setTimeout(() => { if (VS.view === 'grok-made' && !document.hidden) load(true); else poll(); }, 30000);
  }
  const find = (id) => ['waiting', 'approved', 'rejected'].map((k) => S.rows[k].find((d) => d.id === id)).find(Boolean);
  function move(d, to) { ['waiting', 'approved', 'rejected'].forEach((k) => { S.rows[k] = S.rows[k].filter((x) => x.id !== d.id); }); d.status = to; S.rows[to].unshift(d); }

  function demo() {
    const h = 3600e3, now = Date.now(), iso = (x) => new Date(now - x).toISOString();
    const row = (id, type, title, body, urls, at, task) => ({ id, kind: 'Grok ' + TYPE[type].toLowerCase(), title, body, source: SOURCE, status: 'waiting', created_at: iso(at), meta: { grok: { type, urls, task_id: task || null } } });
    return {
      waiting: [
        row('demo-gm1', 'graphic', 'Carousel cover: Your funnel leaks at the offer', 'Cover slide for the five-slide Instagram carousel on offer leaks. Warm ivory, serif headline, one accent word in copper. Made for the 17P sales page launch.', ['assets/demo-graphics/carousel-1.jpg'], 0.6 * h),
        row('demo-gm2', 'copy', 'Email: the $27 bundle is live', 'Subject: The AI Starter Bundle is open\n\nHey {{first_name}},\n\nI put every prompt, template and agent I use to run a one-person business into one bundle.\n\nIt is $27 today. You get the App Builder Kit, my 17P sales page outline and the reply scripts.\n\nGrab it here: {{link}}\n\nAvery', [], 2 * h, 'demo-g1'),
        row('demo-gm3', 'pdf', 'Lead magnet: The Founder OS checklist', 'A two-page checklist that walks a founder through setting up their own AI operating system in one afternoon. Made from my FOUNDER method.', ['https://example.com/founder-os-checklist.pdf'], 5 * h),
        row('demo-gm4', 'content', 'YouTube script: How I run my business with 6 AI agents', 'Hook: I have no team. Six AI agents run my business while I am at the gym.\n\n1. The one rule: nothing publishes without me.\n2. Agent one writes my emails from my own past emails.\n3. Agent two turns every video into five posts.\n4. Agent three checks every funnel on mobile.\n\nClose: the free Founder OS checklist in the description.', [], 26 * h),
      ],
      approved: [row('demo-gm5', 'copy', 'Instagram caption: build once, sell forever', 'Build the funnel once. Let it sell while you sleep. Here is the three-page funnel I use for every $27 offer.', [], 72 * h)].map((d) => ({ ...d, status: 'approved', meta: { grok: { ...d.meta.grok, doc_id: 'demo' } } })),
      rejected: [],
    };
  }

  /* ---------- view ---------- */
  function thumb(d) {
    const t = typeOf(d); const u = (g(d).urls || [])[0];
    if (t === 'graphic' && u) return `<span class="gm-thumb"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`;
    return `<span class="gm-thumb gm-${t}" aria-hidden="true">${t === 'pdf' ? '<b>PDF</b>' : icon(t === 'copy' ? 'mail' : 'file')}</span>`;
  }
  function excerpt(d) {
    const b = String(d.body || '').replace(/\s+/g, ' ').trim();
    if (b) return esc(b.slice(0, 180)) + (b.length > 180 ? '...' : '');
    const u = (g(d).urls || [])[0]; return u ? esc(host(u)) : '';
  }
  function row(d) {
    const t = typeOf(d); const tab = VS.gmTab; const busy = S.busy[d.id];
    const acts = tab === 'waiting'
      ? `<button class="btn sm primary" data-action="gm-approve" data-id="${esc(d.id)}" ${busy ? 'disabled' : ''}>${busy === 'approve' ? U.spin + 'Adding' : 'Approve'}</button><button class="btn sm ghost" data-action="gm-dismiss" data-id="${esc(d.id)}" ${busy ? 'disabled' : ''}>Dismiss</button>`
      : tab === 'approved' ? `<a class="btn sm ghost" href="#brain" data-action="gm-brain">In your Brain</a>`
        : `<button class="btn sm ghost" data-action="gm-restore" data-id="${esc(d.id)}" ${busy ? 'disabled' : ''}>Restore</button>`;
    return `<div class="row gm-row">${thumb(d)}<div class="grow"><button type="button" class="gm-open" data-action="gm-open" data-id="${esc(d.id)}"><span class="t">${esc(d.title)}</span></button>
      <p class="s">${esc(TYPE[t])} · ${esc(ago(d.created_at))}${g(d).task_id ? ' · from a task' : ''}</p><p class="gm-ex">${excerpt(d)}</p></div><div class="gm-acts">${acts}</div></div>`;
  }
  function setup() {
    const on = window.Grok && window.Grok.connected && window.Grok.connected();
    return `<section class="panel gm-setup"><header><h2>${on ? 'Grok Bot is connected' : 'Connect Grok Bot'}</h2></header>
      <p class="muted">${on ? 'Paste this into Grok Bot\u2019s custom instructions once, so it sends everything it makes without being asked.' : 'Connect Grok Bot and paste this into its custom instructions once. Everything it makes then lands here on its own.'}</p>
      <div class="code-row wrap"><code>${esc((window.Grok && window.Grok.STANDING) || '')}</code><button class="btn sm" data-action="grok-copy" data-v="${esc((window.Grok && window.Grok.STANDING) || '')}">Copy</button></div>
      ${on ? '' : '<div class="actions" style="margin-top:12px"><button class="btn" data-action="grok-conn">Connect Grok Bot</button></div>'}</section>`;
  }
  function page() {
    if (S.key !== key() || !S.loaded) load();
    if (window.Grok && !window.Grok.state().loaded) window.Grok.load();
    const n = { waiting: S.rows.waiting.length, approved: S.rows.approved.length, rejected: S.rows.rejected.length };
    const tabs = U.seg('gmTab', VS.gmTab, [['waiting', 'Waiting ' + n.waiting], ['approved', 'Approved ' + n.approved], ['rejected', 'Dismissed ' + n.rejected]]);
    const sub = 'PDFs, graphics, copy and content Grok Bot makes for you arrive here on their own. Nothing trains your Brain or brand until you approve it.';
    const all = S.rows[VS.gmTab] || [];
    const counts = {}; all.forEach((d) => { const t = typeOf(d); counts[t] = (counts[t] || 0) + 1; });
    const types = Object.keys(TYPE).filter((t) => counts[t]);
    const list = VS.gmType === 'all' ? all : all.filter((d) => typeOf(d) === VS.gmType);
    const filter = types.length > 1 ? U.seg('gmType', types.includes(VS.gmType) ? VS.gmType : 'all', [['all', 'All'], ...types.map((t) => [t, TYPE[t] + (t === 'other' ? 's' : t === 'copy' || t === 'content' ? '' : 's')])]) : '';
    let body;
    if (S.loading && !S.loaded) body = `<p class="meta">${U.spin}Loading what Grok made</p>`;
    else if (S.err) body = U.empty('This list could not load', esc(S.err), '<button class="btn" data-action="gm-reload">Try again</button>');
    else if (!list.length) body = VS.gmTab === 'waiting' ? U.empty('Nothing waiting', 'When Grok Bot makes a PDF, graphic, copy or content for you, it shows up here to approve.') : VS.gmTab === 'approved' ? U.empty('Nothing approved yet', 'Approved items go into your Brain and show here.') : U.empty('Nothing dismissed', 'Dismissed items stay here in case you change your mind.');
    else body = `<div class="rows">${list.map(row).join('')}</div>`;
    const showSetup = live() ? !(window.Grok && window.Grok.connected()) || (!n.waiting && !n.approved && !n.rejected) : false;
    return `${U.title('From Grok', sub, tabs)}
      ${showSetup ? setup() : ''}
      <section class="panel"><header><h2>${VS.gmTab === 'waiting' ? 'Waiting for you' : VS.gmTab === 'approved' ? 'Training your Brain' : 'Dismissed'}</h2>${filter || `<span class="meta">${list.length} item${list.length === 1 ? '' : 's'}</span>`}</header>${body}</section>
      ${live() || VS.gmTab !== 'waiting' ? '' : '<p class="meta gm-note">Sample workspace. In your workspace these come from your own Grok Bot.</p>'}`;
  }
  V['grok-made'] = () => page();
  V['grok-made'].live = () => page();

  /* ---------- drawer ---------- */
  function drawer(d) {
    const t = typeOf(d); const urls = g(d).urls || []; const waiting = d.status === 'waiting';
    const cats = (window.BrainSave && window.BrainSave.cats) || [];
    const img = t === 'graphic' ? urls.filter(isImg).concat(urls.filter((u) => !isImg(u))).slice(0, 1) : [];
    const preview = img.length ? `<div class="gm-img"><img src="${esc(img[0])}" alt="${esc(d.title)}" referrerpolicy="no-referrer"></div>` : '';
    const linkList = urls.length ? `<ul class="gm-links">${urls.map((u) => `<li><a class="lnk" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t === 'pdf' ? 'Open the PDF' : t === 'graphic' ? 'Open full size' : host(u) || 'Open the link')}</a></li>`).join('')}</ul>` : '';
    const text = waiting ? `<label class="field"><span>${t === 'graphic' || t === 'pdf' ? 'What it is' : 'Text'}</span><textarea name="body" rows="${t === 'copy' || t === 'content' ? 12 : 4}">${esc(d.body || '')}</textarea></label>` : d.body ? `<div class="draft-body">${esc(d.body).replace(/\n/g, '<br>')}</div>` : '';
    U.drawer(`<div><p class="meta">${esc(TYPE[t])} · from Grok Bot · ${esc(ago(d.created_at))}</p><h2>${esc(d.title)}</h2></div>
      <form class="fd" data-gmform="${esc(d.id)}">
        ${preview || linkList ? `<div class="dsec"><h3>${t === 'graphic' ? 'Graphic' : 'Links'}</h3>${preview}${linkList}</div>` : ''}
        ${text ? `<div class="dsec"><h3>${waiting ? 'Check it before it trains your Brain' : 'Text'}</h3>${text}</div>` : ''}
        ${waiting ? `<div class="dsec"><h3>Where it goes</h3>
          <label class="field"><span>Brain section</span><select name="cat"><option value="auto">Pick for me</option>${cats.map(([v, l]) => `<option value="${v}" ${t === 'graphic' && v === 'brand' ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          ${t === 'copy' || t === 'content' ? '<label class="gx-check"><input type="checkbox" name="voice"><span>Also use it to teach my writing voice</span></label>' : ''}
          ${t === 'pdf' ? '<p class="meta">The OS reads the PDF from the link. If Grok\u2019s link is private, the description is saved instead.</p>' : ''}</div>
          <div class="actions"><button class="btn primary" type="submit">Approve and add to my Brain</button>${d.body ? `<button class="btn" type="button" data-action="gm-copy" data-id="${esc(d.id)}">Copy text</button>` : ''}<button class="btn ghost" type="button" data-action="gm-dismiss" data-id="${esc(d.id)}">Dismiss</button></div>`
        : `<div class="actions">${d.status === 'rejected' ? `<button class="btn" type="button" data-action="gm-restore" data-id="${esc(d.id)}">Restore</button>` : '<a class="btn" href="#brain" data-action="gm-brain">Open my Brain</a>'}${d.body ? `<button class="btn ghost" type="button" data-action="gm-copy" data-id="${esc(d.id)}">Copy text</button>` : ''}</div>`}
      </form>`, { label: d.title, wide: t === 'graphic' || t === 'copy' || t === 'content' });
  }

  /* ---------- approve: into the Brain ---------- */
  async function approve(d, opt = {}) {
    const meta = g(d); const t = typeOf(d); const urls = meta.urls || [];
    const body = opt.body != null ? String(opt.body).trim() : String(d.body || '').trim();
    if (!live()) { await new Promise((r) => setTimeout(r, 300)); d.body = body; d.meta = { grok: { ...meta, doc_id: 'demo' } }; move(d, 'approved'); return { note: 'Sample workspace: in your workspace this goes into your Brain.' }; }
    const B = window.BrainSave; if (!B) throw new Error('Open the Brain once, then try again.');
    let item = null; let note = '';
    const fromLink = t === 'pdf' || (t !== 'graphic' && words(body) < 40);
    if (fromLink && urls[0] && !isImg(urls[0])) {
      try { item = await B.fromLink(urls[0]); } catch (e) { note = 'Grok\u2019s link could not be read, so the description went in instead. Ask Grok for a public link to add the full file.'; if (words(body) < 5) throw new Error((e && e.message ? e.message + ' ' : '') + 'Ask Grok Bot for a public link, or download it and add it under Brain, Library.'); }
    }
    if (!item) {
      const head = t === 'graphic' ? 'A graphic Grok Bot made for my brand, which I approved.' : t === 'pdf' ? 'A PDF Grok Bot made for me, which I approved.' : '';
      const text = ['# ' + d.title, head, body, urls.length ? 'Links:\n' + urls.join('\n') : ''].filter(Boolean).join('\n\n');
      item = { kind: t === 'graphic' ? 'image' : t === 'pdf' ? 'pdf' : 'note', text, url: urls[0] || null, meta: {} };
    }
    const doc = await B.save({ ...item, title: d.title, source: SOURCE, category: opt.cat || (t === 'graphic' ? 'brand' : 'auto'), meta: { ...(item.meta || {}), from_grok: d.id, grok_type: t } });
    if (opt.voice && body.length >= 40) {
      const kind = /^subject:|\bemail\b/i.test(body + ' ' + d.title) ? 'email' : /script/i.test(d.title) ? 'script' : /caption/i.test(d.title) ? 'caption' : /page/i.test(d.title) ? 'page' : 'post';
      await window.Auth.writing.add(ws(), { title: d.title.slice(0, 200), kind, body }).catch(() => { note = 'Added to your Brain. The writing sample did not save, so add it under Brand, Writing if you want it.'; });
    }
    const nextMeta = { ...(d.meta || {}), grok: { ...meta, doc_id: doc.id, approved_at: new Date().toISOString() } };
    await window.Auth.drafts.save(d.id, { body: body || null, meta: nextMeta });
    await window.Auth.drafts.decide(d.id, 'approved');
    d.body = body; d.meta = nextMeta; move(d, 'approved');
    return { note, words: doc.words };
  }

  ACT['gm-open'] = (el) => { const d = find(el.dataset.id); if (d) drawer(d); };
  ACT['gm-reload'] = () => { S.err = ''; load(true); render(); };
  ACT['gm-brain'] = () => { VS.brTab = 'library'; window.BrainSave && window.BrainSave.forget(); location.hash = '#brain'; };
  ACT['gm-copy'] = (el) => { const d = find(el.dataset.id); if (d) U.copy(d.body || ''); };
  async function run(el, id, what, fn) {
    const d = find(id); if (!d || S.busy[id]) return; S.busy[id] = what; render();
    try { await fn(d); } catch (e) { U.toast(e); } finally { delete S.busy[id]; render(); window.App.refreshCounts && window.App.refreshCounts(); }
  }
  ACT['gm-approve'] = (el) => run(el, el.dataset.id, 'approve', async (d) => { const r = await approve(d); U.toast(r.note || 'Approved and added to your Brain'); });
  ACT['gm-dismiss'] = (el) => run(el, el.dataset.id, 'dismiss', async (d) => {
    if (live()) await window.Auth.drafts.decide(d.id, 'rejected'); move(d, 'rejected'); U.closeDrawer(); U.toast('Dismissed. It stays under Dismissed if you change your mind.');
  });
  ACT['gm-restore'] = (el) => run(el, el.dataset.id, 'restore', async (d) => {
    if (live()) await window.Auth.drafts.decide(d.id, 'waiting'); move(d, 'waiting'); U.closeDrawer(); U.toast('Back in Waiting');
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-gmform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const d = find(f.dataset.gmform); if (!d || S.busy[d.id]) return;
    const v = Object.fromEntries(new FormData(f)); const b = f.querySelector('button[type=submit]');
    b.disabled = true; b.innerHTML = U.spin + 'Adding to your Brain'; S.busy[d.id] = 'approve';
    try { const r = await approve(d, { body: v.body, cat: v.cat, voice: !!v.voice }); U.closeDrawer(); U.toast(r.note || 'Approved and added to your Brain'); }
    catch (ex) { b.disabled = false; b.textContent = 'Approve and add to my Brain'; U.toast(ex); }
    finally { delete S.busy[d.id]; render(); window.App.refreshCounts && window.App.refreshCounts(); }
  }, true);

  // Waiting count for the Brand hub tab and the sidebar.
  const base = window.OSCounts;
  window.OSCounts = () => { const c = base ? base() : {}; if (S.key !== key() && !S.loading) load(); const n = S.key === key() ? S.rows.waiting.length : 0; if (n) { c['grok-made'] = n; c.dna = (+c.dna || 0) + n; } return c; };
  window.GrokMade = { load, state: () => S, approve, SOURCE };
})();

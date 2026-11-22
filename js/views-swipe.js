// Founders AI OS: Swipe file. Funnels and offers other people sell, saved for inspiration.
// Paste a link, the page text or screenshots. The OS reads what they sell, why it works and what
// you could borrow for your own offers. Inspiration stays separate from founder facts.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const SW = window.OSSwipe;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();
  const aiOn = () => isLive() && (ctx().conns || []).some((c) => (c.provider === 'claude' || c.provider === 'openai' || c.provider === 'perplexity') && c.status === 'connected');
  const onSwipe = () => location.hash.slice(1).split('?')[0] === 'swipe';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const ago = (iso) => { const d = (Date.now() - new Date(iso)) / 6e4; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' h ago' : Math.round(d / 1440) + ' d ago'; };
  const MAX_IMG = 6;

  Object.assign(VS, { swKind: VS.swKind || 'all', swNew: VS.swNew || 'funnel' });
  const S = { rows: [], at: 0, ws: null, loading: false, error: '', urls: {}, busy: {}, form: { url: '', body: '', notes: '' }, pending: [], q: '', saving: false, open: null, more: false, token: 0 };

  /* ---------- demo ---------- */
  const DEMO = [
    { kind: 'funnel', title: 'The 7-Day Funnel Sprint', brand: 'Sprint Lab', url: 'https://example.com/funnel-sprint', notes: 'The $27 front end with a $97 upgrade right after checkout.',
      page_text: 'The 7-Day Funnel Sprint\nBuild a funnel that sells in 7 days, without hiring a designer\nThis is for coaches and consultants who are tired of fighting tech\nHere is everything you get:\nModule 1: Your offer in a day (value $497)\nSwipe file of 40 page templates, worth $297\nTotal value $1,291\nToday only $27\nBonus 1: The ad hook vault\nFast action bonus: a live Q&A call\nYes, add the done-for-you email pack for $17\nOne time offer: Funnel Sprint Pro for $97\n30-day money back guarantee, no questions asked\nOnly 50 spots at this price\nGet instant access\nOver 4,000 students have joined' },
    { kind: 'offer', title: 'Client Engine Accelerator', brand: 'Northbound Coaching', url: 'https://example.com/client-engine', notes: 'Application first, then a call. No price on the page.',
      page_text: 'Client Engine Accelerator\nSign 5 high-ticket clients in the next 90 days or we keep working with you for free\nDesigned for consultants already doing $10k a month\nWeekly group coaching calls\nPrivate community with 600 members\nDone-with-you offer build\nOutreach scripts and templates\nBonus: Sales call teardown library\nApply now\nBook your strategy call\nLimited to 20 new members a month\nOur clients have added $2.4M in new revenue\nCase study: Maria went from $8k to $31k a month' },
    { kind: 'email', title: 'Cart closes tonight email', brand: 'Paper & Pixel', notes: 'Short, one link, real deadline.',
      body: 'Subject: Doors close at midnight\nQuick one.\nThe Template Club closes tonight at midnight and the price goes up to $49 a month after that.\nRight now it is $19 a month, locked in for as long as you stay.\nYou get 300 Canva templates, new ones every week, and the members-only community.\nIf it is not for you, cancel in one click.\nJoin before midnight' },
  ];
  function demoSeed() {
    if (S.seeded) return; S.seeded = true;
    S.rows = DEMO.map((d, i) => { const r = { id: 'ds' + i, images: [], pinned: i === 0, tags: [], created_at: new Date(Date.now() - (i + 1) * 86400e3 * 2).toISOString(), ...d }; r.analysis = SW.rules(r); r.analyzed_by = 'Rules'; r.analyzed_at = r.created_at; return r; });
  }

  /* ---------- live data ---------- */
  function load(force, more = false) {
    if (!isLive()) return; const ws = ctx().ws.id;
    if (!ws) return;
    if (S.ws !== ws) {
      S.pending.forEach((p) => URL.revokeObjectURL(p.local));
      Object.assign(S, { rows: [], urls: {}, ws, loading: false, at: 0, more: false, error: '', open: null, pending: [], form: { url: '', body: '', notes: '' }, q: '' });
    }
    if (S.loading || (!force && S.at && Date.now() - S.at < 60e3)) return S.promise;
    const token = ++S.token, offset = more ? S.rows.length : 0;
    const current = () => isLive() && ctx().ws.id === ws && S.token === token;
    S.loading = true;
    return S.promise = window.Auth.swipe.list(ws, offset).then(async (rows) => {
      if (!current()) return;
      S.rows = more ? [...S.rows, ...rows.filter((r) => !S.rows.some((x) => x.id === r.id))] : rows;
      S.more = rows.length === 200; S.error = ''; await signUrls(rows, ws);
    }).catch((e) => { if (current()) S.error = window.Auth.friendly(e); })
      .finally(() => { if (current()) { S.loading = false; S.at = Date.now(); if (onSwipe()) window.App.render(true); } });
  }
  async function signUrls(rows, workspace = S.ws) {
    const need = []; rows.forEach((r) => (r.images || []).forEach((im) => { if (im.path && !S.urls[im.path]) need.push(im.path); }));
    if (!need.length) return; try { const urls = await window.Auth.swipe.urls(need); if (workspace === S.ws) Object.assign(S.urls, urls); } catch (e) { console.error(e); }
  }
  const imgSrc = (im) => (im.local ? im.local : im.path ? S.urls[im.path] : im.url) || '';
  const thumbOf = (r) => { const shots = (r.images || []).filter((x) => !x.og); const im = shots[0] || (r.images || [])[0]; return im ? imgSrc(im) : ''; };

  /* ---------- screenshots: pick, drop or paste, shrunk to 1600px JPEG in the browser ---------- */
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that image'))), 'image/jpeg', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not an image the browser can read')); };
      img.src = url;
    });
  }
  async function addFiles(files, target) {
    const list = [...files].filter((f) => /^image\//.test(f.type)); if (!list.length) return U.toast('Screenshots only here. PNG, JPG or WebP.');
    if (target) return addToItem(target, list);
    const room = MAX_IMG - S.pending.length; if (room <= 0) return U.toast(`Up to ${MAX_IMG} screenshots per swipe`);
    for (const f of list.slice(0, room)) { try { const b = await shrink(f); S.pending.push({ blob: b, local: URL.createObjectURL(b) }); } catch (e) { U.toast(e.message); } }
    if (list.length > room) U.toast(`Kept the first ${room}. Up to ${MAX_IMG} per swipe.`);
    window.App.render(); focusZone();
  }
  const focusZone = () => requestAnimationFrame(() => { const z = document.querySelector('.sw-drop'); z && z.scrollIntoView({ block: 'nearest' }); });
  async function uploadAll(ws, id, blobs) {
    const out = [];
    for (const b of blobs) { const path = `${ws}/swipe/${id}/${uid()}.jpg`; await window.Auth.swipe.upload(path, b); out.push({ path }); }
    return out;
  }
  async function addToItem(r, files) {
    const shots = (r.images || []).filter((x) => !x.og).length; const room = MAX_IMG - shots; if (room <= 0) return U.toast(`Up to ${MAX_IMG} screenshots per swipe`);
    const blobs = []; for (const f of files.slice(0, room)) { try { blobs.push(await shrink(f)); } catch (e) { U.toast(e.message); } }
    if (!blobs.length) return;
    try {
      if (isLive()) { const add = await uploadAll(ctx().ws.id, r.id, blobs); const u = await window.Auth.swipe.update(r.id, { images: [...(r.images || []), ...add] }); Object.assign(r, u); await signUrls([r]); }
      else r.images = [...(r.images || []), ...blobs.map((b) => ({ local: URL.createObjectURL(b) }))];
      U.toast(`${blobs.length} screenshot${blobs.length === 1 ? '' : 's'} added. Read it again to use ${blobs.length === 1 ? 'it' : 'them'}.`);
    } catch (e) { U.toast(window.Auth.friendly(e)); }
    openItem(r.id); window.App.render(true);
  }

  /* ---------- screen ---------- */
  const KIND_FILTER = [['all', 'All'], ['funnel', 'Funnels'], ['offer', 'Offers'], ['page', 'Sales pages'], ['ad', 'Ads'], ['email', 'Emails']];
  function shown() {
    const q = S.q.trim().toLowerCase();
    return S.rows.filter((r) => (VS.swKind === 'all' || r.kind === VS.swKind) && (!q || [r.title, r.brand, r.url, r.notes, (r.analysis || {}).promise, (r.analysis || {}).mechanism].join(' ').toLowerCase().includes(q)));
  }
  function addPanel() {
    const f = S.form;
    const kinds = SW.KINDS.filter((k) => k[0] !== 'other').map(([v, l]) => `<button type="button" class="chip" data-action="sw-kind" data-v="${v}" aria-pressed="${VS.swNew === v}">${esc(l)}</button>`).join('');
    const pend = S.pending.map((p, i) => `<figure class="sw-pend"><img src="${esc(p.local)}" alt="Screenshot ${i + 1}"><button type="button" class="sw-pend-x" data-action="sw-unpend" data-i="${i}" aria-label="Remove screenshot ${i + 1}">${icon('close')}</button></figure>`).join('');
    return `<section class="panel sw-add" aria-label="Save a funnel or offer"><header><h2>Save something you saw</h2><span class="meta">Any mix of a link, text and screenshots</span></header>
      <form class="sw-form" data-swform autocomplete="off">
        <div class="sw-kinds" role="group" aria-label="What is it">${kinds}</div>
        <label class="sw-field"><span>Link</span><input class="input" name="url" type="url" inputmode="url" placeholder="https://their-funnel.com/offer" value="${esc(f.url)}" data-swf="url"></label>
        <label class="sw-field"><span>Text</span><textarea class="input" name="body" rows="5" placeholder="Paste the headline, the offer stack, the prices, an email. Whatever you copied." data-swf="body">${esc(f.body)}</textarea></label>
        <div class="sw-field"><span>Screenshots</span>
          <div class="sw-drop${S.pending.length ? ' has' : ''}" data-swdrop tabindex="0" role="button" aria-label="Add screenshots. Drop files, click to choose, or paste">
            ${pend}<div class="sw-drop-hint">${icon('image')}<b>Drop screenshots here</b><span>or click to choose, or paste with ${/Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+V anywhere on this page</span></div>
            <input type="file" accept="image/*" multiple hidden data-swfile>
          </div></div>
        <label class="sw-field"><span>What caught your eye <em class="meta">optional</em></span><input class="input" name="notes" maxlength="600" placeholder="The $27 front end, the upsell, the guarantee wording" value="${esc(f.notes)}" data-swf="notes"></label>
        <div class="actions"><button class="btn primary" ${S.saving ? 'disabled' : ''}>${S.saving ? U.spin + 'Saving' : icon('sparkle') + 'Save and read it'}</button>${f.url || f.body || f.notes || S.pending.length ? '<button type="button" class="btn ghost" data-action="sw-clear">Clear</button>' : ''}</div>
      </form></section>`;
  }
  function card(r) {
    const a = r.analysis || {}; const th = thumbOf(r); const busy = S.busy[r.id];
    const prices = (a.price_points || []).slice(0, 3).map((p) => `<span class="pill">${esc(p.price || p.label)}</span>`).join('');
    const name = r.title || a.name || (r.url ? SW.hostOf(r.url) : 'Untitled');
    return `<button type="button" class="sw-card" data-action="sw-open" data-id="${esc(r.id)}">
      <span class="sw-th">${th ? `<img src="${esc(th)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerr="remove">` : `<span class="sw-th-t">${esc(r.brand || a.brand || (r.url ? SW.hostOf(r.url) : name))}</span>`}<span class="sw-th-k">${esc(SW.kindName(r.kind))}</span>${r.pinned ? `<span class="sw-pin" title="Pinned">${icon('star')}</span>` : ''}</span>
      <span class="sw-body"><b class="sw-name">${esc(name)}</b><span class="meta">${esc([r.brand || a.brand, ago(r.created_at)].filter(Boolean).join(' · '))}</span>
      ${busy ? `<span class="sw-reading">${U.spin}Reading</span>` : a.mechanism ? `<span class="sw-why">${esc(a.mechanism)}</span>` : r.analyzed_at ? '' : '<span class="sw-why muted">Not read yet</span>'}
      ${prices ? `<span class="sw-prices">${prices}</span>` : ''}</span></button>`;
  }
  function view() {
    const live = isLive();
    if (live) load();
    else {
      if (S.ws !== 'demo') { S.token++; Object.assign(S, { ws: 'demo', seeded: false, rows: [], at: 0, loading: false, more: false, error: '', open: null, urls: {} }); }
      demoSeed();
    }
    const rows = shown(); const read = S.rows.filter((r) => r.analyzed_at).length;
    const head = U.title('Vault', 'Save examples. Find the useful patterns. Make something of your own.',
      `<button class="btn" data-action="sw-toggle-add">${icon('plus')}Add example</button><button class="btn primary" data-action="vi-new" ${window.OSVault?.state()?.busy ? 'disabled' : ''}>${icon('sparkle')}Summarize examples</button>`);
    const tabs = window.OSVault ? window.OSVault.tabs(S.rows.length, S.more) : '';
    if (VS.vaultTab === 'inspiration' && window.OSVault) return head + tabs + window.OSVault.view();
    const tools = `<div class="sw-tools">${U.seg('swKind', VS.swKind, KIND_FILTER)}<label class="sw-search">${icon('search')}<input class="input" type="search" placeholder="Search saved swipes" value="${esc(S.q)}" data-swq aria-label="Search saved swipes"></label></div>`;
    const list = S.error ? `<p class="auth-msg" role="alert">${esc(S.error)} <button class="linkish" data-action="sw-retry">Try again</button></p>` : live && S.loading && !S.at ? U.empty('Reading your saved examples', 'One moment.')
      : rows.length ? `<div class="sw-grid">${rows.map(card).join('')}</div>`
      : S.rows.length ? U.empty('Nothing matches', 'Try another filter or search.') : U.empty('Your swipe file is empty', 'When you see a funnel, offer or email that sells, save it here. Over time the OS learns what works in your space.');
    const add = VS.swAdd || (!S.rows.length && !S.loading);
    return head + tabs + `<div class="${add ? 'sw-layout' : 'sw-library-only'}">${add ? addPanel() : ''}<section class="sw-lib" aria-label="Saved examples">${tools}${list}${S.more ? '<button class="btn vi-more" data-action="sw-more">Load more examples</button>' : ''}</section></div>`;
  }
  V.swipe = view; V.swipe.live = view;

  /* ---------- the drawer: what it is, why it works, what to borrow ---------- */
  const find = (id) => S.rows.find((r) => String(r.id) === String(id));
  const sec = (h, inner) => (inner ? `<section class="sw-sec"><h3>${h}</h3>${inner}</section>` : '');
  const ul = (a) => (a && a.length ? `<ul class="sw-ul">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const para = (t) => (t ? `<p>${esc(t)}</p>` : '');
  function inspo(r) {
    const a = r.analysis || {};
    return [a.name && 'What it is: ' + a.name + ' (' + SW.kindName(r.kind) + ')', a.promise && 'Promise: ' + a.promise, a.audience && 'For: ' + a.audience,
      (a.price_points || []).length && 'Price ladder: ' + a.price_points.map((p) => (p.label ? p.label + ' ' : '') + p.price).join(', '),
      (a.stack || []).length && 'Stack: ' + a.stack.join('; '), (a.bonuses || []).length && 'Bonuses: ' + a.bonuses.join('; '),
      a.guarantee && 'Guarantee: ' + a.guarantee, a.urgency && 'Urgency: ' + a.urgency, (a.funnel_steps || []).length && 'Funnel: ' + a.funnel_steps.join(' > '),
      (a.why_it_works || []).length && 'Why it works: ' + a.why_it_works.join(' '), (a.borrow || []).length && 'Ideas to borrow: ' + a.borrow.map((b) => b.idea).join(' '), r.notes && 'What I noticed: ' + r.notes].filter(Boolean).join('\n');
  }
  function openItem(id) {
    const r = find(id); if (!r) return; S.open = r.id; const a = r.analysis || {}; const busy = S.busy[r.id];
    const imgs = (r.images || []).filter((x) => imgSrc(x));
    const gal = imgs.length ? `<div class="sw-gal">${imgs.map((im, i) => `<figure><a href="${esc(imgSrc(im))}" target="_blank" rel="noopener"><img src="${esc(imgSrc(im))}" alt="${im.og ? 'Page preview' : 'Screenshot ' + (i + 1)}" loading="lazy" referrerpolicy="no-referrer"></a>${im.og ? '<figcaption>Page preview</figcaption>' : `<button type="button" class="sw-pend-x" data-action="sw-img-del" data-id="${esc(r.id)}" data-i="${(r.images || []).indexOf(im)}" aria-label="Remove screenshot">${icon('close')}</button>`}</figure>`).join('')}</div>` : '';
    const prices = (a.price_points || []).length ? `<div class="sw-ladder">${a.price_points.map((p) => `<div><b>${esc(p.price || '')}</b><span>${esc(p.label || '')}</span></div>`).join('')}</div>` : '';
    const steps = (a.funnel_steps || []).length ? `<ol class="sw-steps">${a.funnel_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '';
    const borrow = (a.borrow || []).length ? `<ul class="sw-borrow">${a.borrow.map((b) => `<li><span class="tag">${esc({ offer: 'Offer', funnel: 'Funnel', page: 'Page', content: 'Content' }[b.for] || 'Offer')}</span><span>${esc(b.idea)}</span></li>`).join('')}</ul>` : '';
    const name = r.title || a.name || 'Untitled';
    const html = `<div class="dbody sw-d">
      <h2 class="sw-dt">${esc(name)}</h2>
      <p class="meta">${esc(SW.kindName(r.kind))}${r.brand || a.brand ? ' · ' + esc(r.brand || a.brand) : ''}</p>
      ${r.url ? `<a class="sw-url" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${icon('out')}${esc(r.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70))}</a>` : ''}
      ${a.note ? `<p class="sw-note">${esc(a.note)}</p>` : ''}
      ${gal}
      <div class="actions sw-dact">
        <button class="btn sm primary" data-action="sw-read" data-id="${esc(r.id)}" ${busy ? 'disabled' : ''}>${busy ? U.spin + 'Reading' : icon('sparkle') + (r.analyzed_at ? 'Read it again' : 'Read it')}</button>
        <button class="btn sm" data-action="sw-addimg" data-id="${esc(r.id)}">${icon('image')}Add screenshots</button>
        <button class="btn sm" data-action="sw-pin" data-id="${esc(r.id)}">${icon('star')}${r.pinned ? 'Unpin' : 'Pin'}</button>
        <input type="file" accept="image/*" multiple hidden data-switemfile="${esc(r.id)}">
      </div>
      ${a.headline || a.promise ? sec('The pitch', `${a.headline ? `<p class="sw-head">${esc(a.headline)}</p>` : ''}${para(a.promise && a.promise !== a.headline ? a.promise : '')}${a.audience ? `<p class="meta">For: ${esc(a.audience)}</p>` : ''}`) : ''}
      ${sec('Prices', prices)}
      ${sec('What you get', ul(a.stack))}
      ${sec('Bonuses', ul(a.bonuses))}
      ${a.guarantee || a.urgency || a.cta ? sec('Risk, urgency and the ask', `${a.guarantee ? `<p><b>Guarantee.</b> ${esc(a.guarantee)}</p>` : ''}${a.urgency ? `<p><b>Urgency.</b> ${esc(a.urgency)}</p>` : ''}${a.cta ? `<p><b>Button.</b> ${esc(a.cta)}</p>` : ''}`) : ''}
      ${sec('Funnel steps', steps)}
      ${sec('Proof they use', ul(a.proof))}
      ${sec('Possible reasons to test', ul(a.why_it_works))}
      <p class="meta">This is a reading of saved material, not verified conversion performance.</p>
      <section class="sw-sec"><h3>Keep the useful parts</h3><p>Save a reusable brief, add your own context, and use it for offers, copy or a new funnel.</p><button class="btn primary" data-action="vi-from-source" data-id="${esc(r.id)}">${icon('sparkle')}Save as inspiration</button></section>
      ${borrow ? `<section class="sw-sec sw-borrowsec"><h3>What you could borrow</h3>${borrow}
        <div class="actions"><button class="btn sm primary" data-action="sw-build" data-id="${esc(r.id)}" data-type="offer">${icon('edit')}Write my offer outline from this</button><button class="btn sm" data-action="sw-build" data-id="${esc(r.id)}" data-type="sales-page">Write my sales page from this</button><button class="btn sm ghost" data-action="sw-copy" data-id="${esc(r.id)}">${icon('copy')}Copy the breakdown</button></div></section>` : ''}
      <section class="sw-sec"><h3>Your notes</h3><textarea class="input" rows="3" data-swnotes="${esc(r.id)}" placeholder="What you want to remember about it">${esc(r.notes || '')}</textarea>
        <label class="sw-kindsel"><span class="meta">Saved as</span><select class="input" data-swkindsel="${esc(r.id)}">${SW.KINDS.map(([v, l]) => `<option value="${v}" ${r.kind === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></section>
      ${r.body ? `<details class="sw-raw"><summary>Text you pasted</summary><pre>${esc(r.body)}</pre></details>` : ''}
      ${r.page_text ? `<details class="sw-raw"><summary>Text read from the page</summary><pre>${esc(String(r.page_text).slice(0, 8000))}</pre></details>` : ''}
      <p class="meta">${r.analyzed_at ? `Read by ${esc(r.analyzed_by || 'Rules')} ${ago(r.analyzed_at)}${a.images_read ? `, ${a.images_read} image${a.images_read === 1 ? '' : 's'} included` : ''}.` : 'Not read yet.'} Saved ${ago(r.created_at)}.</p>
      <div class="actions"><button class="btn sm ghost sw-delbtn" data-action="sw-del" data-id="${esc(r.id)}">Delete</button></div>
    </div>`;
    U.drawer(html, { label: 'Swipe', wide: true });
  }

  /* ---------- actions ---------- */
  async function readItem(r, quiet) {
    S.busy[r.id] = true; if (S.open === r.id && document.querySelector('#drawer.open')) openItem(r.id); window.App.render(true);
    try {
      if (!isLive()) { await new Promise((ok) => setTimeout(ok, 600)); r.analysis = SW.rules(r); r.analyzed_by = 'Rules'; r.analyzed_at = new Date().toISOString(); if (!r.title) r.title = r.analysis.name; }
      else {
        if (!quiet) U.toast(aiOn() ? 'Reading it with your Brand DNA. Up to a minute with screenshots.' : 'Reading it');
        const res = await window.Auth.brainApi('swipe-read', { workspace_id: ctx().ws.id, id: r.id, refetch: !!r._refetch });
        const u = Array.isArray(res.item) ? res.item[0] : res.item; if (u) Object.assign(r, u); delete r._refetch; await signUrls([r]);
        U.toast(`Read by ${res.by}${r.analysis && r.analysis.note ? '. ' + r.analysis.note : ''}`);
        window.DNA && window.DNA.load && window.DNA.load(true).catch(() => {});
      }
    } catch (e) { U.toast(window.Auth.friendly(e)); }
    delete S.busy[r.id]; window.App.render(true); if (S.open === r.id && document.querySelector('#drawer.open')) openItem(r.id);
  }
  ACT['sw-kind'] = (el) => { VS.swNew = el.dataset.v; document.querySelectorAll('[data-action="sw-kind"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); };
  ACT['sw-unpend'] = (el) => { const p = S.pending.splice(+el.dataset.i, 1)[0]; if (p) URL.revokeObjectURL(p.local); window.App.render(true); };
  ACT['sw-clear'] = () => { S.form = { url: '', body: '', notes: '' }; S.pending.forEach((p) => URL.revokeObjectURL(p.local)); S.pending = []; window.App.render(true); };
  ACT['sw-open'] = (el) => openItem(el.dataset.id);
  ACT['sw-read'] = (el) => { const r = find(el.dataset.id); if (r) { r._refetch = true; readItem(r); } };
  ACT['sw-addimg'] = (el) => { const i = document.querySelector(`[data-switemfile="${CSS.escape(el.dataset.id)}"]`); i && i.click(); };
  ACT['sw-img-del'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return; const i = +el.dataset.i; const im = (r.images || [])[i]; if (!im) return;
    const images = r.images.filter((_, k) => k !== i);
    try { if (isLive()) { const u = await window.Auth.swipe.update(r.id, { images }); Object.assign(r, u); if (im.path) window.Auth.swipe.removeFile(im.path); } else r.images = images; } catch (e) { return U.toast(window.Auth.friendly(e)); }
    openItem(r.id); window.App.render(true);
  };
  ACT['sw-pin'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return;
    try { if (isLive()) { Object.assign(r, await window.Auth.swipe.update(r.id, { pinned: !r.pinned })); window.Auth.dna && window.Auth.dna.rebuild && window.Auth.dna.rebuild(ctx().ws.id).catch(() => {}); } else r.pinned = !r.pinned; }
    catch (e) { return U.toast(window.Auth.friendly(e)); }
    S.rows.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)));
    U.toast(r.pinned ? 'Pinned in your vault' : 'Unpinned'); openItem(r.id); window.App.render(true);
  };
  ACT['sw-copy'] = (el) => { const r = find(el.dataset.id); if (r) U.copy(inspo(r)); };
  ACT['sw-build'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return; const type = el.dataset.type;
    if (window.OSVault) return window.OSVault.compose([r.id], type === 'offer' ? 'offers' : 'copy');
    if (!isLive()) return U.toast('In your own workspace this writes your version with your offers and Brand DNA, and puts it in the Newsfeed.');
    if (!aiOn()) return U.toast('Connect Claude, OpenAI or Perplexity in Connections to write your version.');
    el.disabled = true; const label = el.innerHTML; el.innerHTML = U.spin + 'Writing';
    try {
      const a = r.analysis || {};
      const res = await window.Auth.brainApi('build', { workspace_id: ctx().ws.id, type, topic: `My own ${type === 'offer' ? 'offer' : 'sales page'}, using the structure of ${a.name || r.title || 'a swipe'} as inspiration`, inspo: inspo(r) });
      U.toast(`${res.draft ? res.draft.title : 'Draft'} is waiting in the Newsfeed`); window.App.refreshCounts && window.App.refreshCounts();
    } catch (e) { U.toast(window.Auth.friendly(e)); }
    el.disabled = false; el.innerHTML = label;
  };
  ACT['sw-del'] = async (el) => {
    const r = find(el.dataset.id); if (!r) return;
    const ok = await U.dialog({ title: 'Delete this example?', body: 'The screenshots go with it. Saved inspiration briefs keep their reference and link, but this original will no longer be available here.', ok: 'Delete', danger: true }); if (!ok) return;
    try { if (isLive()) { await window.Auth.swipe.remove(r); window.Auth.dna && window.Auth.dna.rebuild && window.Auth.dna.rebuild(ctx().ws.id).catch(() => {}); } S.rows = S.rows.filter((x) => x !== r); U.closeDrawer(); U.toast('Deleted'); }
    catch (e) { U.toast(window.Auth.friendly(e)); }
    window.App.render(true);
  };

  async function save(form) {
    const url = S.form.url.trim(), body = S.form.body.trim(), notes = S.form.notes.trim();
    if (url && !/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) { U.toast('Paste the full link, starting with https://'); form.url.focus(); return; }
    if (!url && !body && !S.pending.length) { U.toast('Add a link, some text or a screenshot'); form.url.focus(); return; }
    S.saving = true; window.App.render(true);
    const kind = VS.swNew || 'funnel'; let r;
    try {
      if (isLive()) {
        const ws = ctx().ws.id; const id = uid();
        const images = S.pending.length ? await uploadAll(ws, id, S.pending.map((p) => p.blob)) : [];
        r = await window.Auth.swipe.add(ws, { id, kind, url: url || null, body: body || null, notes: notes || null, images });
        await signUrls([r]);
      } else r = { id: 'ds' + Date.now().toString(36), kind, url: url || null, body: body || null, notes: notes || null, title: null, brand: url ? SW.hostOf(url) : null, images: S.pending.map((p) => ({ local: p.local })), pinned: false, created_at: new Date().toISOString(),
        page_text: url && !body ? '' : null };
      S.rows.unshift(r); S.pending = []; S.form = { url: '', body: '', notes: '' };
    } catch (e) { S.saving = false; window.App.render(true); return U.toast(window.Auth.friendly(e)); }
    S.saving = false; window.App.render(true);
    if (!isLive() && url && !body && !r.images.length) { r.analysis = SW.rules(r); r.analysis.note = 'Sample workspace. In your own workspace the OS opens the link and reads the page.'; r.analyzed_by = 'Rules'; r.analyzed_at = new Date().toISOString(); window.App.render(true); return; }
    readItem(r, false);
  }

  /* ---------- events ---------- */
  ACT['sw-toggle-add'] = () => { VS.vaultTab = 'examples'; VS.swAdd = !VS.swAdd; window.App.render(true); };
  ACT['sw-retry'] = () => load(true);
  ACT['sw-more'] = () => load(true, true);
  window.OSSwipeView = { reset: () => { S.at = 0; }, rows: () => S.rows, state: () => S, load, open: openItem, async openSource(id) {
    let r = find(id);
    if (!r && isLive()) {
      const workspace = ctx().ws.id; r = await window.Auth.swipe.get(workspace, id);
      if (ctx().ws.id !== workspace || !r) return false;
      S.rows.push(r); await signUrls([r], workspace);
    }
    if (!r) return false; openItem(r.id); return true;
  } };
  document.addEventListener('submit', (e) => { const f = e.target.closest && e.target.closest('form[data-swform]'); if (!f) return; e.preventDefault(); save(f); });
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.closest) return;
    if (t.dataset.swf) { S.form[t.dataset.swf] = t.value; return; }
    if (t.matches('[data-swq]')) { S.q = t.value; clearTimeout(S.qt); S.qt = setTimeout(() => { const pos = t.selectionStart; window.App.render(true); const n = document.querySelector('[data-swq]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 160); }
  });
  document.addEventListener('change', async (e) => {
    const t = e.target; if (!t.closest) return;
    if (t.matches('[data-swfile]')) { await addFiles(t.files); t.value = ''; return; }
    if (t.matches('[data-switemfile]')) { const r = find(t.dataset.switemfile); if (r) await addFiles(t.files, r); t.value = ''; return; }
    if (t.matches('[data-swnotes]')) { const r = find(t.dataset.swnotes); if (!r || t.value === (r.notes || '')) return; try { if (isLive()) Object.assign(r, await window.Auth.swipe.update(r.id, { notes: t.value })); else r.notes = t.value; U.toast('Notes saved'); } catch (ex) { U.toast(window.Auth.friendly(ex)); } return; }
    if (t.matches('[data-swkindsel]')) { const r = find(t.dataset.swkindsel); if (!r) return; try { if (isLive()) Object.assign(r, await window.Auth.swipe.update(r.id, { kind: t.value })); else r.kind = t.value; window.App.render(true); openItem(r.id); } catch (ex) { U.toast(window.Auth.friendly(ex)); } }
  });
  document.addEventListener('click', (e) => { const z = e.target.closest && e.target.closest('[data-swdrop]'); if (!z || e.target.closest('button')) return; const i = z.querySelector('[data-swfile]'); i && i.click(); });
  document.addEventListener('keydown', (e) => { const z = e.target.closest && e.target.closest('[data-swdrop]'); if (z && (e.key === 'Enter' || e.key === ' ') && e.target === z) { e.preventDefault(); z.querySelector('[data-swfile]').click(); } });
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { const z = e.target.closest && e.target.closest('[data-swdrop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); }));
  document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-swdrop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    if (!onSwipe()) return; const z = e.target.closest && e.target.closest('[data-swdrop]'); const d = e.target.closest && e.target.closest('#drawer.open');
    if (!z && !d) return; e.preventDefault(); if (z) z.classList.remove('over');
    const files = e.dataTransfer && e.dataTransfer.files; if (!files || !files.length) return;
    if (d && S.open) { const r = find(S.open); if (r) addFiles(files, r); } else addFiles(files);
  });
  // paste a screenshot anywhere on the page. Into an open swipe if one is showing, otherwise into the form.
  document.addEventListener('paste', (e) => {
    if (!onSwipe()) return; const items = [...((e.clipboardData && e.clipboardData.items) || [])]; const files = items.filter((i) => i.kind === 'file' && /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); const open = document.querySelector('#drawer.open .sw-d') && S.open ? find(S.open) : null; addFiles(files, open || undefined); return; }
    const t = e.target; if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    const txt = (e.clipboardData && e.clipboardData.getData('text')) || ''; if (!txt.trim()) return; e.preventDefault();
    if (/^https?:\/\/\S+$/i.test(txt.trim())) S.form.url = txt.trim(); else S.form.body = (S.form.body ? S.form.body + '\n\n' : '') + txt.trim();
    window.App.render(true); U.toast(/^https?:/i.test(txt.trim()) ? 'Link added' : 'Text added');
  });
})();

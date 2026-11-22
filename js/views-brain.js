// Founders AI OS Brain, private workspace: the founder's context layer.
// Files are read in the browser (Markdown, text, PDF, Word, PowerPoint, Excel, CSV, HTML), split into passages
// and stored per workspace with RLS. Google Docs, Slides, Sheets and links come in through /api/brain.
// Study turns the library into a profile every agent reads before it writes. Build drafts from it into the Newsfeed.
(() => {
  const U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, icon } = U;
  const ctx = () => window.App.liveCtx();
  const render = () => window.App.render(true);
  const ws = () => (ctx().ws || {}).id;

  const CATS = [['voice', 'Voice and writing'], ['offers', 'Offers and pricing'], ['audience', 'Audience'], ['story', 'Story and bio'], ['brand', 'Brand'], ['frameworks', 'Frameworks'], ['sop', 'Process and SOPs'], ['research', 'Research'], ['reference', 'Skills and references'], ['other', 'Other']];
  const CAT = Object.fromEntries(CATS);
  const BUILDS = [['youtube-script', 'YouTube script'], ['email', 'Email'], ['sales-page', 'Sales page'], ['social-post', 'Social posts'], ['offer', 'Offer outline'], ['lead-magnet', 'Lead magnet']];
  const ACCEPT = '.md,.markdown,.txt,.pdf,.docx,.pptx,.xlsx,.csv,.tsv,.html,.htm,.json,.rtf,.srt,.vtt';
  const MAX = 500 * 1024 * 1024; const KEEP = 50 * 1024 * 1024;
  const KIND_NAME = { md: 'Markdown', txt: 'Text', pdf: 'PDF', docx: 'Word', pptx: 'Slides', xlsx: 'Sheet', csv: 'CSV', html: 'Web page', web: 'Web page', json: 'JSON', note: 'Note', image: 'Graphic', gdoc: 'Google Doc', gslides: 'Google Slides', gsheet: 'Google Sheet', srt: 'Transcript', vtt: 'Transcript', rtf: 'Text' };

  const L = { ws: null, loading: false, err: null, docs: [], profile: null, jobs: [], hits: null, q: '', studying: false, building: false, lastBuild: null };
  VS.brAdd = VS.brAdd || 'files';
  VS.brCat = VS.brCat || 'all';

  async function load(force) {
    const id = ws(); if (!id || (L.loading && !force)) return;
    L.loading = true; L.ws = id; L.err = null;
    try { const [d, p] = await Promise.all([Auth.brain.docs(id), Auth.brain.profile(id).catch(() => null)]); L.docs = d; L.profile = p; }
    catch (e) { L.err = Auth.friendly ? Auth.friendly(e) : e.message; }
    L.loading = false; if (window.App.liveCtx().ws && window.App.liveCtx().ws.id === id && location.hash.replace('#', '').split('?')[0] === 'brain') render();
    autoStudy();
  }
  // The profile follows the library. When documents were added since the last study, study again once, on its own.
  function autoStudy() {
    const id = ws(); if (!id || L.ws !== id || L.studying || !L.docs.length) return;
    if (L.profile && L.profile.doc_count === L.docs.length) return;
    const k = id + ':' + L.docs.length; if (L.autoKey === k) return; L.autoKey = k;
    if (ACT['br-study']) ACT['br-study']({ auto: true });
  }

  /* ---------- reading files in the browser ---------- */
  const libs = {};
  const script = (src) => libs[src] || (libs[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => { delete libs[src]; no(new Error('A file reader could not load. Check your connection and try again.')); }; document.head.appendChild(s); }));
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const MAMMOTH = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
  const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  const ext = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const fromMime = (m) => ({ 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'text/markdown': 'md', 'text/plain': 'txt', 'text/csv': 'csv', 'text/html': 'html', 'application/json': 'json' })[String(m || '').split(';')[0]] || '';
  const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  function htmlText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,svg,nav,footer').forEach((n) => n.remove());
    const out = [];
    const walk = (n) => {
      if (n.nodeType === 3) { out.push(n.textContent); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName; const h = /^H[1-4]$/.test(t);
      if (h) out.push('\n\n' + '#'.repeat(+t[1]) + ' ');
      if (t === 'LI') out.push('\n- ');
      if (t === 'BR') out.push('\n');
      n.childNodes.forEach(walk);
      if (h || /^(P|DIV|LI|TR|SECTION|ARTICLE|BLOCKQUOTE|TABLE|UL|OL)$/.test(t)) out.push('\n');
      if (t === 'TD' || t === 'TH') out.push(' | ');
    };
    walk(doc.body || doc.documentElement);
    return { title: (doc.title || '').trim(), text: out.join('').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
  }
  async function zipXml(buf, rx) {
    await script(JSZIP); const z = await window.JSZip.loadAsync(buf);
    const names = Object.keys(z.files).filter((n) => rx.test(n)).sort((a, b) => (+(a.match(/(\d+)\.xml$/) || [])[1] || 0) - (+(b.match(/(\d+)\.xml$/) || [])[1] || 0));
    return { z, names };
  }
  async function read(buf, kind, name) {
    const text = () => new TextDecoder('utf-8').decode(buf);
    if (kind === 'pdf') {
      await script(PDFJS); const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise; const parts = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 1500); i++) {
        const pg = await pdf.getPage(i); const c = await pg.getTextContent(); let line = ''; let lastY = null; const lines = [];
        c.items.forEach((it) => { const y = it.transform ? Math.round(it.transform[5]) : 0; if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; } line += (line && !line.endsWith(' ') && !String(it.str).startsWith(' ') ? ' ' : '') + it.str; lastY = y; });
        lines.push(line); const t = lines.map((l) => l.trim()).filter(Boolean).join('\n');
        if (t) parts.push('## Page ' + i + '\n' + t);
      }
      return { text: parts.join('\n\n'), meta: { pages: pdf.numPages } };
    }
    if (kind === 'docx') { await script(MAMMOTH); const r = await window.mammoth.convertToHtml({ arrayBuffer: buf }); return { text: htmlText(r.value).text }; }
    if (kind === 'pptx') {
      const { z, names } = await zipXml(buf, /^ppt\/slides\/slide\d+\.xml$/); const parts = [];
      for (const n of names) {
        const no = (n.match(/(\d+)\.xml$/) || [])[1]; const x = await z.file(n).async('string');
        const paras = x.split(/<\/a:p>/).map((p) => decodeXml((p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, '')).join(''))).map((s) => s.trim()).filter(Boolean);
        const nf = z.file('ppt/notesSlides/notesSlide' + no + '.xml'); let notes = '';
        if (nf) { const nx = await nf.async('string'); notes = decodeXml((nx.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, '')).join(' ')).replace(/\s+/g, ' ').trim().replace(/^\d+$/, ''); }
        if (paras.length || notes) parts.push('## Slide ' + no + (paras[0] ? ': ' + paras[0] : '') + '\n' + paras.slice(1).join('\n') + (notes ? '\nSpeaker notes: ' + notes : ''));
      }
      return { text: parts.join('\n\n'), meta: { slides: names.length } };
    }
    if (kind === 'xlsx') {
      const { z, names } = await zipXml(buf, /^xl\/worksheets\/sheet\d+\.xml$/);
      const ssf = z.file('xl/sharedStrings.xml'); const ss = ssf ? (await ssf.async('string')).split(/<\/si>/).map((s) => decodeXml((s.match(/<t[^>]*>([^<]*)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))) : [];
      const parts = [];
      for (const n of names.slice(0, 12)) {
        const x = await z.file(n).async('string'); const rows = [];
        (x.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []).slice(0, 3000).forEach((r) => {
          const cells = (r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map((c) => { const v = (c.match(/<v>([^<]*)<\/v>/) || [])[1]; const is = (c.match(/<t[^>]*>([^<]*)<\/t>/) || [])[1]; if (/t="s"/.test(c) && v != null) return ss[+v] || ''; return decodeXml(is != null ? is : v || ''); });
          if (cells.some((c) => c)) rows.push(cells.join(' | '));
        });
        if (rows.length) parts.push('## Sheet ' + (n.match(/(\d+)\.xml$/) || [])[1] + '\n' + rows.join('\n'));
      }
      return { text: parts.join('\n\n') };
    }
    if (kind === 'html' || kind === 'htm') { const h = htmlText(text()); return { text: h.text, title: h.title }; }
    if (kind === 'json') { try { return { text: JSON.stringify(JSON.parse(text()), null, 1) }; } catch (e) { return { text: text() }; } }
    if (kind === 'srt' || kind === 'vtt') return { text: text().replace(/^WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+ --> [\d:.,]+.*$/gm, '').replace(/<[^>]+>/g, '').replace(/\n{2,}/g, '\n').trim() };
    if (kind === 'rtf') return { text: text().replace(/\\par[d]?/g, '\n').replace(/\{\\[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/gi, '').trim() };
    if (['md', 'markdown', 'txt', 'csv', 'tsv', ''].includes(kind)) {
      const t = text(); if (/\u0000/.test(t.slice(0, 2000))) throw new Error(name + ' is not a text file this reader knows.');
      return { text: t };
    }
    throw new Error('Files ending in .' + kind + ' cannot be read yet. Save it as PDF, Word or Markdown.');
  }

  /* ---------- passages, categories, summaries ---------- */
  function chunk(text) {
    const out = []; let head = null; let buf = '';
    const push = () => { const b = buf.trim(); if (b) out.push({ heading: head, body: b }); buf = ''; };
    text.replace(/\r\n?/g, '\n').split(/\n{2,}|\n(?=#{1,4} )/).forEach((para) => {
      const p = para.trim(); if (!p) return;
      const m = p.match(/^(#{1,4})\s+(.+?)(?:\n([\s\S]*))?$/);
      if (m) { push(); head = m[2].trim().slice(0, 160); if (m[3]) buf = m[3].trim(); return; }
      if (buf.length + p.length > 1400) push();
      if (p.length > 2400) { for (let i = 0; i < p.length; i += 1400) { buf = p.slice(i, i + 1400); push(); } return; }
      buf += (buf ? '\n\n' : '') + p;
    });
    push();
    return out.slice(0, 800);
  }
  const RULES = [
    ['frameworks', /\b(framework|step \d|pillar|principle|module|lesson|method|formula|blueprint|students?|teach)\b/gi],
    ['offers', /\b(offer|pricing|price|checkout|upsell|order bump|guarantee|bonus|package|tier|\$\d|€\d|per month|\/mo)\b/gi],
    ['voice', /\b(voice|tone|caption|newsletter|email|script|post|hook|headline|copy|subject line)\b/gi],
    ['audience', /\b(avatar|audience|persona|ideal client|customer|pain point|survey|icp|niche|they want|struggle)\b/gi],
    ['story', /\b(my story|about me|bio|biography|i grew up|i started|journey|origin|when i was|i quit|my first)\b/gi],
    ['brand', /\b(brand|logo|colou?r|palette|typography|font|mission|values|positioning|tagline|style guide)\b/gi],
    ['sop', /\b(sop|process|checklist|step \d|workflow|procedure|how to|onboarding|template)\b/gi],
    ['research', /\b(research|competitor|market|study|report|data|trend|analysis|benchmark|interview)\b/gi],
  ];
  function guessCat(name, text) {
    const n = name.toLowerCase();
    const byName = [['voice', /voice|tone|style|script|email|post|caption|newsletter|transcript/], ['offers', /offer|pricing|price|sales|stack|checkout/], ['audience', /avatar|audience|persona|icp|customer|survey/], ['story', /story|about|bio|journey/], ['brand', /brand|guideline|logo|identity/], ['frameworks', /framework|curriculum|course|module|lesson|workshop|training|masterclass|method|blueprint|syllabus|summit|keynote|talk|slides|deck/], ['sop', /sop|process|checklist|playbook|how-to/], ['research', /research|competitor|market|report/]];
    for (const [c, rx] of byName) if (rx.test(n)) return c;
    const s = text.slice(0, 12000); let best = 'other'; let top = 2;
    RULES.forEach(([c, rx]) => { const k = (s.match(rx) || []).length; if (k > top) { top = k; best = c; } });
    return best;
  }
  const summarize = (text) => { const s = text.replace(/^#+ .*$/gm, '').replace(/\s+/g, ' ').trim().split(/(?<=[.?!])\s+/).filter((x) => x.split(' ').length > 4).slice(0, 2).join(' '); return s.slice(0, 320) || null; };
  const pretty = (n) => { const t = String(n).replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : 'Untitled'; };
  const wordCount = (t) => (t.match(/\S+/g) || []).length;
  const safe = (n) => String(n).replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(0, 120) || 'file';
  const b64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  async function save({ title, kind, source, text, category, file, url, meta }) {
    const id = ws(); text = String(text || '').replace(/\u0000/g, '').trim();
    if (wordCount(text) < 5) throw new Error('There is no readable text in ' + title + '. Scanned PDFs need text recognition first.');
    const parts = chunk(text);
    const doc = await Auth.brain.addDoc(id, { title: String(title).slice(0, 200), kind, source: source || 'Upload', category: category && category !== 'auto' ? category : guessCat(title, text), chars: text.length, words: wordCount(text), summary: summarize(text), status: 'ready', url: url || null, meta: meta || {} });
    try { await Auth.brain.addChunks(parts.map((p, i) => ({ doc_id: doc.id, workspace_id: id, idx: i, heading: p.heading, body: p.body }))); }
    catch (e) { await Auth.brain.removeDoc(doc).catch(() => {}); throw e; }
    if (file && file.size <= KEEP) {
      try { const path = `${id}/${doc.id}/${safe(file.name || title)}`; await Auth.brain.upload(path, file); await Auth.brain.updateDoc(doc.id, { storage_path: path }); doc.storage_path = path; }
      catch (e) { console.warn('original not stored', e); }
    }
    L.docs.unshift(doc); return doc;
  }

  async function addFiles(files) {
    const cat = (document.querySelector('[name="br-cat"]') || {}).value || 'auto';
    const list = [...files];
    list.forEach((f) => L.jobs.unshift({ id: Math.random().toString(36).slice(2), name: f.name, size: f.size, state: 'wait', f }));
    render();
    for (const j of L.jobs.filter((x) => x.state === 'wait')) {
      j.state = 'read'; render();
      try {
        if (j.size > MAX) throw new Error('Over 500 MB. Split it or export the text.');
        const k = ext(j.name) || fromMime(j.f.type);
        const r = await read(await j.f.arrayBuffer(), k, j.name);
        j.state = 'save'; render();
        const d = await save({ title: (r.title && k === 'html' ? r.title : pretty(j.name)), kind: KIND_NAME[k] ? k : 'txt', source: 'Upload', text: r.text, category: cat, file: j.f, meta: { file: j.name, size: j.size, ...(r.meta || {}) } });
        j.state = 'done'; j.words = d.words; j.cat = d.category;
      } catch (e) { j.state = 'error'; j.err = e.message || String(e); }
      delete j.f; render();
    }
    const ok = list.length - L.jobs.filter((x) => x.state === 'error').length;
    if (ok > 0) { U.toast(ok === 1 ? 'Added to your Brain. Studying it now.' : ok + ' documents added to your Brain. Studying them now.'); autoStudy(); }
  }

  /* ---------- view ---------- */
  const ago = (t) => { if (!t) return ''; const s = (Date.now() - new Date(t)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const int = (n) => Number(n || 0).toLocaleString('en-US');
  const sel = (name, val, opts, extra = '') => `<select name="${name}" ${extra}>${opts.map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

  function addPanel() {
    const t = VS.brAdd; const drive = (ctx().conns || []).find((c) => c.provider === 'gdrive' && /^(connected|sample)$/.test(c.status));
    let body = '';
    if (t === 'files') body = `<label class="br-drop" data-brdrop>
        <input type="file" multiple accept="${ACCEPT}" data-brfile hidden>
        <span class="br-drop-i">${icon('plus')}</span>
        <b>Drop files here, or choose files</b>
        <span class="meta">Markdown, PDF, Word, PowerPoint, Excel, CSV, text, HTML and transcripts. Up to 500 MB each.</span>
      </label>`;
    if (t === 'link') body = `<form class="br-form" data-brform="link">
        <label class="field"><span>Google Doc, Slides, Sheet, Drive file or any web page</span><input name="url" type="url" required placeholder="https://docs.google.com/document/d/..." autocomplete="off"></label>
        <p class="meta">${drive ? 'Google Drive is connected, so private files you can open work too.' : 'Public links work now. For private Google files, connect Google Drive in Connections.'}</p>
        <div class="actions"><button class="btn primary">Import</button></div></form>`;
    if (t === 'note') body = `<form class="br-form" data-brform="note">
        <label class="field"><span>Title</span><input name="title" required placeholder="How I explain my offer on calls" autocomplete="off"></label>
        <label class="field"><span>Write or paste anything: a story, how you price, phrases you use, what you never say</span><textarea name="body" rows="7" required></textarea></label>
        <div class="actions"><button class="btn primary">Save to Brain</button></div></form>`;
    const jobs = L.jobs.slice(0, 8);
    return `<section class="panel"><header><h2>Add to your Brain</h2>${U.seg('brAdd', t, [['files', 'Files'], ['link', 'Google or link'], ['note', 'Write a note']])}</header>
      <div class="br-cat-row"><span class="meta">File as</span>${sel('br-cat', VS.brNewCat || 'auto', [['auto', 'Let the OS decide'], ...CATS], 'data-action="br-newcat" class="br-sel"')}</div>
      ${body}
      ${jobs.length ? `<div class="rows br-jobs">${jobs.map((j) => `<div class="row"><span class="dot ${j.state === 'done' ? '' : j.state === 'error' ? 'bad' : 'warn'}"></span><div class="grow"><div class="t">${esc(j.name)}</div><div class="s">${j.state === 'done' ? int(j.words) + ' words · filed under ' + esc(CAT[j.cat] || j.cat) : j.state === 'error' ? esc(j.err) : j.state === 'save' ? 'Saving passages' : j.state === 'read' ? 'Reading' : 'Waiting'}</div></div>${j.state === 'read' || j.state === 'save' ? U.spin : ''}</div>`).join('')}</div>` : ''}
    </section>`;
  }

  function library() {
    const docs = L.docs.filter((d) => VS.brCat === 'all' || d.category === VS.brCat);
    const cats = CATS.filter(([c]) => L.docs.some((d) => d.category === c));
    const hits = L.hits;
    return `<section class="panel"><header><h2>Library</h2><form class="br-search" data-brform="search" role="search"><span class="br-si">${icon('search')}</span><input name="q" value="${esc(L.q)}" placeholder="Search everything you added" autocomplete="off" aria-label="Search the Brain">${L.q ? '<button type="button" class="btn ghost sm" data-action="br-clear">Clear</button>' : ''}</form></header>
      ${hits ? (hits.length ? `<div class="rows br-hits">${hits.map((h) => `<button class="row br-hit" data-action="br-doc" data-id="${h.doc_id}"><div class="grow"><div class="t">${esc(h.title)}${h.heading ? ' <span class="meta">· ' + esc(h.heading) + '</span>' : ''}</div><div class="s br-snip">${esc(String(h.body).slice(0, 260))}${String(h.body).length > 260 ? '...' : ''}</div></div><span class="pill out">${esc(CAT[h.category] || h.category)}</span></button>`).join('')}</div>`
        : `<p class="muted br-pad">Nothing matches "${esc(L.q)}". Try fewer or different words.</p>`) : ''}
      ${!hits ? `${cats.length > 1 ? `<div class="br-filter">${U.seg('brCat', VS.brCat, [['all', 'All ' + L.docs.length], ...cats.map(([c, l]) => [c, l.split(' ')[0] + ' ' + L.docs.filter((d) => d.category === c).length])])}</div>` : ''}
      ${VS.brCat === 'reference' ? '<p class="meta br-pad">Third-party skills and references. Searchable here and in AI Chat, but never studied as your voice, your facts or your writing.</p>' : ''}
      <div class="table-wrap"><table class="br-tbl"><thead><tr><th>Document</th><th>Filed under</th><th class="n">Words</th><th class="n">Added</th><th></th></tr></thead><tbody>
      ${docs.map((d) => `<tr class="click" data-action="br-doc" data-id="${d.id}"><td><span class="br-dt">${esc(d.title)}</span><span class="sub">${esc(KIND_NAME[d.kind] || d.kind)} · ${esc(d.source || 'Upload')}</span></td>
        <td>${sel('cat', d.category, CATS, `data-action="br-cat" data-id="${d.id}" class="br-sel" aria-label="Category for ${esc(d.title)}"`)}</td>
        <td class="n">${int(d.words)}</td><td class="n muted">${ago(d.created_at)}</td>
        <td class="n"><button class="btn ghost sm" data-action="br-del" data-id="${d.id}" aria-label="Remove ${esc(d.title)}">Remove</button></td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </section>`;
  }

  const list = (arr, n = 8) => (Array.isArray(arr) ? arr : []).slice(0, n).map((x) => (typeof x === 'string' ? x : x && (x.name || x.title || x.text || x.p || x.w || JSON.stringify(x))));
  function profilePanel() {
    const p = L.profile && L.profile.profile; const m = L.profile && L.profile.method;
    const stale = L.profile && L.docs.length !== L.profile.doc_count;
    const btn = `<button class="btn ${p && !stale ? '' : 'primary'} sm" data-action="br-study" ${L.studying || !L.docs.length ? 'disabled' : ''}>${L.studying ? U.spin + 'Studying' : p ? 'Study again' : 'Study my Brain'}</button>`;
    if (!p) return `<h2 class="out">What the OS knows about you</h2><section class="panel tight br-prof"><p class="muted">${L.docs.length ? 'Your documents are searchable now. Study them and the OS writes a profile of your voice, audience, offers and stories that every agent reads first.' : 'Add a few documents and press Study. The more you add, the closer drafts sound like you.'}</p><div class="actions">${btn}</div></section>`;
    const v = p.voice || {}; const st = p.stats || {};
    const sec = (h, items) => items && items.length ? `<div class="br-ps"><h3>${h}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const offers = (p.offers || []).slice(0, 6).map((o) => (typeof o === 'string' ? o : [o.name, o.price, o.promise || o.for].filter(Boolean).join(' · ')));
    const gaps = list(p.gaps, 5);
    return `<h2 class="out">What the OS knows about you</h2><section class="panel tight br-prof">
      <div class="br-ph"><span class="meta">${m && m !== 'rules' ? 'Studied by ' + esc(m) : 'Studied from patterns'} · ${ago(L.profile.studied_at)} · ${int(L.profile.doc_count)} docs</span>${btn}</div>
      ${stale ? '<p class="meta br-stale">You added or removed documents since the last study.</p>' : ''}
      ${p.summary ? `<p class="br-sum">${esc(p.summary)}</p>` : ''}
      ${v.tone && v.tone.length ? `<div class="tags br-tone">${list(v.tone, 6).map((t) => `<span class="pill acc">${esc(t)}</span>`).join('')}</div>` : ''}
      ${sec('Your voice does', list(v.do, 6))}${sec('Your voice avoids', list(v.dont || v.avoid, 5))}
      ${sec('Phrases you use', list(v.phrases || v.signature_phrases, 6).length ? list(v.phrases || v.signature_phrases, 6) : list(p.phrases, 6))}
      ${sec('Who you serve', list(p.audience, 4))}${sec('Your offers', offers)}${sec('Beliefs you repeat', list(p.beliefs, 4))}${sec('Stories you tell', list(p.stories, 4))}${sec('Topics', list(p.topics, 8))}
      ${!p.summary && p.keywords ? `<div class="br-ps"><h3>Words you use most</h3><div class="tags">${p.keywords.slice(0, 14).map((k) => `<span class="pill out">${esc(k.w)}</span>`).join('')}</div></div>` : ''}
      ${st.words ? `<dl class="dl br-stats"><dt>Words studied</dt><dd>${int(st.words)}</dd><dt>Average sentence</dt><dd>${st.avg_sentence_words} words</dd><dt>Reading grade</dt><dd>${st.reading_grade}</dd><dt>"You" per 100 words</dt><dd>${st.you_per_100}</dd></dl>` : ''}
      ${!m || m === 'rules' ? '<p class="meta br-note">Connect Claude, OpenAI or Perplexity in Connections and study again for a full voice, audience and offer profile.</p>' : ''}
      ${gaps.length ? `<div class="br-ps"><h3>What it still needs from you</h3>${gaps.map((g, i) => `<div class="br-gap"><span>${esc(g)}</span><button class="btn ghost sm" data-action="br-gap" data-i="${i}">Answer</button></div>`).join('')}</div>` : ''}
    </section>`;
  }

  function buildPanel() {
    const ai = (ctx().conns || []).some((c) => /^(claude|openai|perplexity)$/.test(c.provider) && c.status === 'connected');
    const lb = L.lastBuild;
    return `<h2 class="out">Build with my context</h2><section class="panel tight"><form class="br-form" data-brform="build">
      <label class="field"><span>What to build</span>${sel('type', VS.brType || 'youtube-script', BUILDS)}</label>
      <label class="field"><span>About</span><input name="topic" required placeholder="Why most funnels leak at the checkout" autocomplete="off"></label>
      <div class="actions"><button class="btn primary" ${L.building || !L.docs.length ? 'disabled' : ''}>${L.building ? U.spin + 'Writing' : 'Build draft'}</button></div>
      <p class="meta">${!L.docs.length ? 'Add documents first.' : ai ? 'Written in your voice from your profile and the closest passages, then sent to the Newsfeed.' : 'Needs Claude, OpenAI or Perplexity, connected in Connections with your own key.'}</p>
      ${lb ? `<div class="well br-lb"><b>${esc(lb.title)}</b><span class="meta">Used ${lb.used.length ? esc(lb.used.slice(0, 3).join(', ')) : 'your profile'} · ${esc(lb.by)}</span><button type="button" class="btn sm" data-action="go" data-view="approvals">Open in the Newsfeed</button></div>` : ''}
    </form></section>`;
  }

  V.brain.live = () => {
    const id = ws();
    if (L.ws !== id) { L.docs = []; L.profile = null; L.hits = null; L.q = ''; L.jobs = []; L.lastBuild = null; load(); }
    const fx = window.Facts; const tab = VS.brTab === 'library' ? 'library' : 'algorithm';
    const nFx = fx ? fx.approved().length : 0; const nWait = fx ? fx.proposed().length : 0;
    const tabs = U.seg('brTab', tab, [['algorithm', 'Algorithm' + (nWait ? ' <span class="fx-dot" aria-label="' + nWait + ' waiting"></span>' : '')], ['library', 'Library ' + L.docs.length]]);
    if (tab === 'algorithm' && fx) return `${U.title('Brain', 'Your Founder Algorithm. Facts about you and the business that you wrote or approved. Every AI in the OS reads them first, and they win over anything else.', tabs)}${fx.view('live', L.docs.length, L.docs)}`;
    const sub = 'Your context layer. Upload what you have written, said and sold. Every agent reads it before it writes, so the OS gets more like you with each document.';
    if (L.loading && !L.docs.length) return `${U.title('Brain', sub, tabs)}<section class="panel"><p class="meta">${U.spin}Loading your Brain</p></section>`;
    if (L.err) return `${U.title('Brain', sub)}<section class="panel">${U.empty('The Brain could not load', esc(L.err), '<button class="btn" data-action="br-reload">Try again</button>')}</section>`;
    const words = L.docs.reduce((s, d) => s + (d.words || 0), 0);
    const covered = new Set(L.docs.map((d) => d.category).filter((c) => c !== 'other')).size;
    const kp = U.kpis([{ label: 'Documents', value: int(L.docs.length), delta: L.docs.length ? 'Last added ' + ago(L.docs[0].created_at) : 'None yet' }, { label: 'Words learned', value: int(words), delta: 'Searchable by every agent' }, { label: 'Areas covered', value: covered + ' of 7', delta: covered < 7 ? 'Missing: ' + CATS.filter(([c]) => c !== 'other' && !L.docs.some((d) => d.category === c)).slice(0, 2).map(([, l]) => l.split(' ')[0].toLowerCase()).join(', ') : 'Every area has a document' }, { label: 'Profile', value: L.profile ? (L.profile.method === 'rules' ? 'Patterns' : 'Full') : 'Not studied', delta: L.profile ? 'Studied ' + ago(L.profile.studied_at) : 'Press Study after uploading' }]);
    return `${U.title('Brain', sub, tabs)}${kp}
      <div class="layout" style="margin-top:var(--gap)"><div class="br-main">${addPanel()}${L.docs.length ? library() : `<section class="panel">${U.empty('Your Brain is empty', 'Start with three things: a few scripts or emails you wrote, your offer and pricing doc, and your story or bio. Transcripts of your calls and videos work well too.', '')}</section>`}</div>
        <aside class="rail">${profilePanel()}${buildPanel()}</aside></div>`;
  };

  /* ---------- actions ---------- */
  ACT['br-reload'] = () => { L.ws = null; render(); };
  ACT['br-newcat'] = (el) => { VS.brNewCat = el.value; };
  ACT['br-clear'] = () => { L.q = ''; L.hits = null; render(); };
  ACT['br-cat'] = async (el, e) => { if (e) e.stopPropagation(); const d = L.docs.find((x) => x.id === el.dataset.id); if (!d) return; try { await Auth.brain.updateDoc(d.id, { category: el.value }); d.category = el.value; U.toast('Filed under ' + CAT[el.value]); } catch (ex) { U.toast(ex.message); render(); } };
  ACT['br-del'] = async (el, e) => {
    if (e) e.stopPropagation(); const d = L.docs.find((x) => x.id === el.dataset.id); if (!d) return;
    const ok = await U.dialog({ title: 'Remove from Brain', body: esc(d.title) + ' and its ' + int(d.words) + ' words will be deleted. Agents stop using it right away.', ok: 'Remove', danger: true }); if (!ok) return;
    try { await Auth.brain.removeDoc(d); L.docs = L.docs.filter((x) => x.id !== d.id); if (L.hits) L.hits = L.hits.filter((h) => h.doc_id !== d.id); U.closeDrawer(); U.toast('Removed'); render(); } catch (ex) { U.toast(ex.message); }
  };
  ACT['br-doc'] = async (el, e) => {
    if (e && e.target.closest('select,button:not([data-action="br-doc"])')) return;
    const d = L.docs.find((x) => x.id === el.dataset.id); if (!d) return;
    U.drawer(`<div><p class="meta">${esc(KIND_NAME[d.kind] || d.kind)} · ${int(d.words)} words · ${esc(CAT[d.category] || d.category)}</p><h2>${esc(d.title)}</h2></div><div class="br-read"><p class="meta">${U.spin}Loading</p></div>`);
    try {
      const ch = await Auth.brain.chunks(d.id, 60); const box = document.querySelector('.br-read'); if (!box) return;
      const url = d.storage_path ? await Auth.brain.fileUrl(d.storage_path).catch(() => null) : null;
      box.innerHTML = `<div class="actions">${url ? `<a class="btn sm" href="${url}" target="_blank" rel="noopener">Download original</a>` : ''}${d.url ? `<a class="btn sm" href="${esc(d.url)}" target="_blank" rel="noopener">Open source</a>` : ''}<button class="btn ghost sm" data-action="br-del" data-id="${d.id}">Remove</button></div>
        ${ch.map((c) => `${c.heading ? `<h3>${esc(c.heading)}</h3>` : ''}<p>${esc(c.body).replace(/\n/g, '<br>')}</p>`).join('')}${ch.length >= 60 ? '<p class="meta">Showing the first 60 passages. Agents read all of it.</p>' : ''}`;
    } catch (ex) { const box = document.querySelector('.br-read'); if (box) box.innerHTML = `<p class="muted">${esc(ex.message)}</p>`; }
  };
  ACT['br-study'] = async () => {
    L.studying = true; render();
    try { const r = await Auth.brainApi('study', { workspace_id: ws() }); L.profile = { profile: r.profile, method: r.method, doc_count: r.doc_count, studied_at: new Date().toISOString() }; const fxn = r.proposed ? ' ' + r.proposed + ' new facts wait under Algorithm.' : ''; U.toast((r.method === 'rules' ? 'Studied. Connect Claude, OpenAI or Perplexity for the full profile.' : 'Studied by ' + r.method + '. Agents use the new profile now.') + fxn); if (r.proposed && window.Facts) window.Facts.load(true); }
    catch (e) { U.toast(e.message); }
    L.studying = false; render();
  };
  ACT['br-gap'] = async (el) => {
    const g = list(L.profile.profile.gaps, 5)[+el.dataset.i]; if (!g) return;
    const r = await U.dialog({ title: 'Teach the OS', body: esc(g), fields: [{ name: 'answer', label: 'Your answer', type: 'textarea', rows: 6, required: true, placeholder: 'Write it the way you would say it' }], ok: 'Save to Brain' });
    if (!r || !r.answer.trim()) return;
    try { await save({ title: g.slice(0, 120), kind: 'note', source: 'Answer', text: g + '\n\n' + r.answer.trim() }); U.toast('Saved. Study again to update your profile.'); render(); } catch (e) { U.toast(e.message); }
  };

  document.addEventListener('change', (e) => { const f = e.target.closest('[data-brfile]'); if (f && f.files.length) { addFiles(f.files); f.value = ''; } });
  document.addEventListener('dragover', (e) => { const z = e.target.closest('[data-brdrop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-brdrop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', (e) => { const z = e.target.closest('[data-brdrop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-brform]'); if (!f) return; e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.brform; const v = Object.fromEntries(new FormData(f)); const btn = f.querySelector('button.primary');
    const busy = (t) => { if (btn) { btn.disabled = true; btn.innerHTML = U.spin + t; } };
    const cat = VS.brNewCat || 'auto';
    if (kind === 'search') {
      L.q = (v.q || '').trim(); if (!L.q) { L.hits = null; return render(); }
      try { L.hits = await Auth.brain.search(ws(), L.q, 12); } catch (ex) { U.toast(ex.message); }
      render(); const i = document.querySelector('.br-search input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      return;
    }
    if (kind === 'note') {
      busy('Saving');
      try { await save({ title: v.title.trim(), kind: 'note', source: 'Note', text: '# ' + v.title.trim() + '\n\n' + v.body, category: cat }); U.toast('Saved to your Brain'); render(); } catch (ex) { U.toast(ex.message); render(); }
      return;
    }
    if (kind === 'link') {
      busy('Importing');
      try {
        const r = await Auth.brainApi('import-link', { workspace_id: ws(), url: v.url });
        let text = r.text; let meta = { url: r.url };
        if (r.file) { const k = fromMime(r.mime) || ext(r.title); const x = await read(b64(r.file), k, r.title); text = x.text; meta = { ...meta, ...(x.meta || {}) }; r.kind = k; }
        const title = (r.title || v.url).replace(/\.[a-z0-9]{2,5}$/i, '');
        const d = await save({ title, kind: r.kind || 'web', source: r.source || 'Link', text, category: cat, url: r.url, meta });
        U.toast(int(d.words) + ' words added from ' + (r.source || 'the link')); render();
      } catch (ex) { U.toast(ex.message); render(); }
      return;
    }
    if (kind === 'build') {
      VS.brType = v.type; L.building = true; render();
      try { const r = await Auth.brainApi('build', { workspace_id: ws(), type: v.type, topic: v.topic }); L.lastBuild = { title: r.draft ? r.draft.title : 'Draft', used: r.used || [], by: r.by }; U.toast('Draft is waiting in the Newsfeed'); window.App.refreshCounts && window.App.refreshCounts(); }
      catch (ex) { U.toast(ex.message); }
      L.building = false; render();
    }
  });

  // Other parts of the app (Jarvis, Inbox) ask the Brain through this.
  window.BrainCtx = { facts: (q, n) => (window.Facts ? window.Facts.match(q, n) : []), search: (q, n = 4) => (ws() ? Auth.brain.search(ws(), q, n) : Promise.resolve([])), docs: () => L.docs, reload: () => load(true) };
  window.BrainFiles = { read, ext, fromMime };
  // From Grok approves items into the library through the same path as uploads and links.
  async function fromLink(url) {
    const r = await Auth.brainApi('import-link', { workspace_id: ws(), url });
    let text = r.text; let meta = { url: r.url };
    if (r.file) { const k = fromMime(r.mime) || ext(r.title); const x = await read(b64(r.file), k, r.title); text = x.text; meta = { ...meta, ...(x.meta || {}) }; r.kind = k; }
    return { title: (r.title || url).replace(/\.[a-z0-9]{2,5}$/i, ''), kind: r.kind || 'web', source: r.source || 'Link', text, url: r.url, meta };
  }
  window.BrainSave = { save, fromLink, cats: CATS, forget: () => { L.ws = null; } };
})();

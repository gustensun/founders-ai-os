// Founders AI OS auth: Supabase email and password accounts, profile and workspace.
(() => {
  // Each install sets its own Supabase project in Vercel. /config.js passes the public values to the browser.
  const CFG = window.FOS_CONFIG || {};
  const URL_ = String(CFG.supabaseUrl || '');
  const KEY = String(CFG.supabaseKey || '');
  const configured = !!(URL_ && KEY);
  // Storage can be blocked in embedded previews. Fall back to memory so the page still works.
  const memStore = {};
  let storage;
  try { const t = '__fos'; window.localStorage.setItem(t, '1'); window.localStorage.removeItem(t); storage = window.localStorage; }
  catch (e) { storage = { getItem: (k) => (k in memStore ? memStore[k] : null), setItem: (k, v) => { memStore[k] = String(v); }, removeItem: (k) => { delete memStore[k]; } }; }

  const ok = configured && !!(window.supabase && window.supabase.createClient);
  const sb = ok ? window.supabase.createClient(URL_, KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;
  const origin = String(CFG.appUrl || (location.protocol.startsWith('http') ? location.origin : '')).replace(/\/+$/, '');

  const MSG = {
    'Invalid login credentials': 'That email and password do not match an account.',
    'Email not confirmed': 'Confirm your email first. The link is in your inbox.',
    'User already registered': 'An account with this email already exists. Log in instead.',
    'Password should be at least 8 characters.': 'Passwords need at least 8 characters.',
    'For security purposes, you can only request this after': 'Wait a minute before asking again.',
    'Email rate limit exceeded': 'Too many emails sent in a short time. Try again in a few minutes.',
    'New password should be different from the old password.': 'Choose a password you have not used here before.',
  };
  const friendly = (err) => {
    if (!err) return '';
    const m = err.message || String(err);
    const hit = Object.keys(MSG).find((k) => m.startsWith(k));
    if (hit) return MSG[hit];
    if (/fetch|network/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
    return m;
  };

  // Leaked password check (Have I Been Pwned, k-anonymity): only the first 5 characters of the SHA-1 hash leave the browser.
  // If the service cannot be reached the check is skipped, so sign-up never gets stuck.
  async function leaked(pw) {
    try {
      if (!(window.crypto && crypto.subtle)) return 0;
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw)))).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('https://api.pwnedpasswords.com/range/' + h.slice(0, 5), { headers: { 'Add-Padding': 'true' }, signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) return 0;
      const line = (await r.text()).split('\n').find((l) => l.startsWith(h.slice(5) + ':'));
      return line ? parseInt(line.split(':')[1], 10) || 0 : 0;
    } catch (e) { return 0; }
  }
  const LEAKED = 'This password has appeared in a known data breach. Choose a different one.';

  let recovering = /type=recovery/.test(location.hash);
  const listeners = [];
  if (sb) sb.auth.onAuthStateChange((ev, session) => { if (ev === 'PASSWORD_RECOVERY') recovering = true; listeners.forEach((f) => f(ev, session)); });

  async function account(user) {
    const [{ data: profile }, { data: list }, { data: access }] = await Promise.all([
      sb.from('profiles').select('full_name,email,onboarded,current_workspace,nav_layout,theme').eq('id', user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,plan,kind,created_at').order('created_at'),
      sb.from('user_access').select('status,is_admin').eq('user_id', user.id).maybeSingle(),
    ]);
    const workspaces = (list || []).sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'live' ? -1 : 1));
    const cur = workspaces.find((w) => profile && w.id === profile.current_workspace) || workspaces[0] || null;
    return { user, profile: profile || { full_name: (user.user_metadata || {}).full_name || user.email.split('@')[0], email: user.email, onboarded: false }, workspaces, workspace: cur, access: access || { status: 'pending', is_admin: false } };
  }

  window.Auth = {
    ready: ok,
    configured,
    setupProblem: String(CFG.setup || ''),
    get recovering() { return recovering; },
    onChange: (f) => listeners.push(f),
    friendly,
    leaked,
    async session() {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    account: async () => { const s = await window.Auth.session(); return s ? account(s.user) : null; },
    async signUp(name, email, password) {
      if (await leaked(password)) throw new Error(LEAKED);
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: origin + '/login' } });
      if (error) throw error;
      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error('User already registered');
      return data;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async forgot(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset' });
      if (error) throw error;
    },
    async setPassword(password) {
      if (await leaked(password)) throw new Error(LEAKED);
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      recovering = false;
    },
    async useWorkspace(uid, wsId) { const { error } = await sb.from('profiles').update({ current_workspace: wsId }).eq('id', uid); if (error) throw error; },
    async connections(wsId) { const { data } = await sb.from('workspace_connections').select('provider,status,account_label,connected_at,meta').eq('workspace_id', wsId); return data || []; },
    async saveTheme(id, theme) { const { error } = await sb.from('profiles').update({ theme }).eq('id', id); if (error) throw error; },
    async saveNav(id, layout) { const { error } = await sb.from('profiles').update({ nav_layout: layout }).eq('id', id); if (error) throw error; },
    async onboarded(id, v = true) { await sb.from('profiles').update({ onboarded: v }).eq('id', id); },
    async saveName(id, full_name) { const { error } = await sb.from('profiles').update({ full_name }).eq('id', id); if (error) throw error; },
    // Second brain items for a workspace: captures, commitments, decisions, people notes and goals.
    async apify(action, body = {}) {
      const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
      const r = await fetch('/api/apify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (!r.ok) { const e = new Error(j.error || 'Apify request failed'); e.status = r.status; if (j.reconnect) e.reconnect = j.reconnect; throw e; }
      return j;
    },
    affiliate: {
      async api(action, body = {}) {
        const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
        const r = await fetch('/api/affiliate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
        let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
        if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
        return j;
      },
      async events(wsId, limit = 40) { const { data, error } = await sb.from('affiliate_events').select('id,kind,email,name,plan,amount,sub_id,tags,status,note,created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(limit); if (error) throw error; return data || []; },
    },
    async hlApi(action, body = {}) {
      const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
      const r = await fetch('/api/highlevel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
      return j;
    },
    async inboxApi(action, body = {}) {
      const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
      const r = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (!r.ok) { const e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; }
      return j;
    },
    admin: {
      async list() { const { data, error } = await sb.rpc('admin_access_list'); if (error) throw error; return data || []; },
      async set(id, status) { const { data, error } = await sb.rpc('admin_access_set', { p_user: id, p_status: status }); if (error) throw error; return data; },
    },
    facts: {
      async list(wsId) { const { data, error } = await sb.from('brain_facts').select('id,category,statement,status,source,evidence,doc_title,weight,approved_at,created_at,updated_at').eq('workspace_id', wsId).order('created_at', { ascending: true }).limit(1000); if (error) throw error; return data || []; },
      async add(wsId, row) { const { data, error } = await sb.from('brain_facts').insert({ workspace_id: wsId, ...row }).select('id,category,statement,status,source,evidence,doc_title,weight,approved_at,created_at,updated_at').single(); if (error) { if (error.code === '23505') throw new Error('That fact is already in your Algorithm.'); throw error; } return data; },
      async update(id, patch) { const { data, error } = await sb.from('brain_facts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id,category,statement,status,source,evidence,doc_title,weight,approved_at,created_at,updated_at').single(); if (error) { if (error.code === '23505') throw new Error('That fact is already in your Algorithm.'); throw error; } return data; },
      async updateMany(ids, patch) { const { error } = await sb.from('brain_facts').update({ ...patch, updated_at: new Date().toISOString() }).in('id', ids); if (error) throw error; },
      async remove(id) { const { error } = await sb.from('brain_facts').delete().eq('id', id); if (error) throw error; },
    },
    brain: {
      async docs(wsId) { const { data, error } = await sb.from('brain_docs').select('id,title,kind,source,category,chars,words,summary,status,error,storage_path,url,meta,created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(500); if (error) throw error; return data || []; },
      async addDoc(wsId, row) { const { data, error } = await sb.from('brain_docs').insert({ workspace_id: wsId, ...row }).select('id,title,kind,source,category,chars,words,summary,status,error,storage_path,url,meta,created_at').single(); if (error) throw error; return data; },
      async updateDoc(id, patch) { const { error } = await sb.from('brain_docs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
      async addChunks(rows) { for (let i = 0; i < rows.length; i += 100) { const { error } = await sb.from('brain_chunks').insert(rows.slice(i, i + 100)); if (error) throw error; } },
      async chunks(docId, limit = 40) { const { data, error } = await sb.from('brain_chunks').select('idx,heading,body').eq('doc_id', docId).order('idx').limit(limit); if (error) throw error; return data || []; },
      async removeDoc(doc) { if (doc.storage_path) { await sb.storage.from('brain').remove([doc.storage_path]).catch(() => {}); } const { error } = await sb.from('brain_docs').delete().eq('id', doc.id); if (error) throw error; },
      async upload(path, file) { const { error } = await sb.storage.from('brain').upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' }); if (error) throw error; return path; },
      async fileUrl(path) { const { data, error } = await sb.storage.from('brain').createSignedUrl(path, 300); if (error) throw error; return data.signedUrl; },
      async search(wsId, q, limit = 8) { const { data, error } = await sb.rpc('brain_search', { p_ws: wsId, p_q: q, p_limit: limit }); if (error) throw error; return data || []; },
      async profile(wsId) { const { data, error } = await sb.from('brain_profile').select('profile,method,doc_count,studied_at').eq('workspace_id', wsId).maybeSingle(); if (error) throw error; return data; },
    },
    swipe: {
      async list(wsId, offset = 0) { const { data, error } = await sb.from('swipe_items').select('*').eq('workspace_id', wsId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).order('id').range(offset, offset + 199); if (error) throw error; return data || []; },
      async get(wsId, id) { const { data, error } = await sb.from('swipe_items').select('*').eq('workspace_id', wsId).eq('id', id).maybeSingle(); if (error) throw error; return data; },
      async add(wsId, row) { const { data, error } = await sb.from('swipe_items').insert({ workspace_id: wsId, ...row }).select('*').single(); if (error) throw error; return data; },
      async update(id, patch) { const { data, error } = await sb.from('swipe_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(); if (error) throw error; return data; },
      async remove(item) { const paths = (item.images || []).map((x) => x.path).filter(Boolean); if (paths.length) await sb.storage.from('brain').remove(paths).catch(() => {}); const { error } = await sb.from('swipe_items').delete().eq('id', item.id); if (error) throw error; },
      async upload(path, blob) { const { error } = await sb.storage.from('brain').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' }); if (error) throw error; return path; },
      async urls(paths) { if (!paths.length) return {}; const { data, error } = await sb.storage.from('brain').createSignedUrls(paths, 3600); if (error) throw error; const m = {}; (data || []).forEach((x) => { if (x.signedUrl) m[x.path] = x.signedUrl; }); return m; },
      async removeFile(path) { await sb.storage.from('brain').remove([path]).catch(() => {}); },
    },
    programFiles: {
      async upload(path, file) { const { error } = await sb.storage.from('brain').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' }); if (error && !/already exists/i.test(error.message)) throw error; },
      async url(path, name) { const { data, error } = await sb.storage.from('brain').createSignedUrl(path, 300, { download: name }); if (error) throw error; return data.signedUrl; },
    },
    async brainApi(action, body = {}) {
      const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
      const r = await fetch('/api/brain', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
      let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
      if (!r.ok) { const e = new Error(j.error || 'Brain request failed'); e.status = r.status; throw e; }
      return j;
    },
    funnel: {
      COLS: 'id,workspace_id,title,offer_ref,status,step,steps,answers,research,offer,copy,emails,handoff,brand,visuals,design,assets,links,qa,version,versions,revisions,repo,deploy,preview_key,engine,error,lease_until,created_at,updated_at',
      async list(wsId) { const { data, error } = await sb.from('funnel_builds').select('id,title,offer_ref,status,step,version,links,repo,deploy,error,created_at,updated_at,offer_name:offer->>name').eq('workspace_id', wsId).order('updated_at', { ascending: false }).limit(50); if (error) throw error; return data || []; },
      async get(id) { const { data, error } = await sb.from('funnel_builds').select(window.Auth.funnel.COLS).eq('id', id).single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('funnel_builds').delete().eq('id', id); if (error) throw error; },
      async api(action, body = {}) {
        const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
        const r = await fetch('/api/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
        let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
        if (!r.ok) { const e = new Error(j.error || 'Funnel Agent request failed'); e.status = r.status; throw e; }
        return j;
      },
    },
    gfx: {
      COLS: 'id,workspace_id,title,format,aspect,model,input,plan,slides,copy,status,step,error,lease_until,created_at,updated_at',
      async list(wsId) { const { data, error } = await sb.from('graphic_sets').select(window.Auth.gfx.COLS).eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(60); if (error) throw error; return data || []; },
      async get(id) { const { data, error } = await sb.from('graphic_sets').select(window.Auth.gfx.COLS).eq('id', id).single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('graphic_sets').delete().eq('id', id); if (error) throw error; },
      async kit(wsId) { const { data, error } = await sb.rpc('gfx_kit', { p_ws: wsId }); if (error) throw error; return data; },
      async kitSave(wsId, patch) { const { data, error } = await sb.rpc('gfx_kit_save', { p_ws: wsId, p_patch: patch }); if (error) throw error; return data; },
      async upload(wsId, name, mime, b64) { const { data, error } = await sb.rpc('gfx_upload', { p_ws: wsId, p_name: name, p_mime: mime, p_data: b64 }); if (error) throw error; return data; },
      async unupload(wsId, name) { const { error } = await sb.rpc('gfx_unupload', { p_ws: wsId, p_name: name }); if (error) throw error; },
      async refs(wsId) { const { data, error } = await sb.from('creator_posts').select('id,platform,format,url,thumb,title,views,likes,comments,posted_at,creators(name)').eq('workspace_id', wsId).not('thumb', 'is', null).order('likes', { ascending: false, nullsFirst: false }).limit(400); if (error) throw error; return data || []; },
      async api(action, body = {}) {
        const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
        const r = await fetch('/api/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action, ...body }) });
        let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
        if (!r.ok) { const e = new Error(j.error || 'Graphics request failed'); e.status = r.status; throw e; }
        return j;
      },
    },
    research: {
      async list(wsId) { const { data, error } = await sb.from('research_runs').select('*').eq('workspace_id', wsId).not('preset', 'like', 'creator-%').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data || []; },
      async remove(id) { const { error } = await sb.from('research_runs').delete().eq('id', id); if (error) throw error; },
    },
    emails: {
      COLS: 'id,sequence,title,item_name,context,emails,by,created_at,updated_at',
      async list(wsId) { const { data, error } = await sb.from('email_sets').select(window.Auth.emails.COLS).eq('workspace_id', wsId).order('updated_at', { ascending: false }).limit(100); if (error) throw error; return data || []; },
      async save(id, emails) { const { data, error } = await sb.from('email_sets').update({ emails, updated_at: new Date().toISOString() }).eq('id', id).select(window.Auth.emails.COLS).single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('email_sets').delete().eq('id', id); if (error) throw error; },
    },
    writing: {
      async list(wsId) { const { data, error } = await sb.from('writing_samples').select('id,title,kind,body,words,pinned,created_at,updated_at').eq('workspace_id', wsId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(200); if (error) throw error; return data || []; },
      async add(wsId, row) { const { data, error } = await sb.from('writing_samples').insert({ workspace_id: wsId, ...row }).select('id,title,kind,body,words,pinned,created_at,updated_at').single(); if (error) throw error; return data; },
      async update(id, patch) { const { data, error } = await sb.from('writing_samples').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id,title,kind,body,words,pinned,created_at,updated_at').single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('writing_samples').delete().eq('id', id); if (error) throw error; },
      async style(wsId) { const { data, error } = await sb.from('writing_style').select('*').eq('workspace_id', wsId).maybeSingle(); if (error) throw error; return data; },
      async saveStyle(wsId, row) { const { data, error } = await sb.from('writing_style').upsert({ workspace_id: wsId, ...row, studied_at: new Date().toISOString() }, { onConflict: 'workspace_id' }).select('*').single(); if (error) throw error; return data; },
    },
    changes: {
      TABLE: { facts: 'brain_facts', brain_profile: 'brain_profile', writing: 'writing_samples', writing_style: 'writing_style', brand_board: 'graphic_kits', dna_items: 'dna_items', strategy: 'founder_strategy' },
      async list(wsId, sections, limit = 60) { const { data, error } = await sb.from('mcp_changes').select('id,section,row_id,op,before,after,client,undone_at,at').eq('workspace_id', wsId).in('section', sections).order('at', { ascending: false }).limit(limit); if (error) throw error; return data || []; },
      async program(wsId, pid) {
        const [pr, mc] = await Promise.all([
          sb.from('program_proposals').select('id,target_id,result_id,expected_revision,data,applied_at').eq('workspace_id', wsId).eq('status', 'applied').eq('result_id', pid).order('applied_at', { ascending: false }).limit(30),
          sb.from('mcp_changes').select('id,section,row_id,op,before,after,client,undone_at,at').eq('workspace_id', wsId).eq('section', 'programs').eq('row_id', pid).order('at', { ascending: false }).limit(30),
        ]);
        if (pr.error) throw pr.error; if (mc.error) throw mc.error;
        const revs = (pr.data || []).filter((x) => x.target_id).map((x) => x.expected_revision);
        let versions = [];
        if (revs.length) { const v = await sb.from('program_versions').select('revision,data,archived,created_at').eq('workspace_id', wsId).eq('program_id', pid).in('revision', revs); if (v.error) throw v.error; versions = v.data || []; }
        return { proposals: pr.data || [], changes: mc.data || [], versions };
      },
      async current(wsId, section, rowId) { const t = window.Auth.changes.TABLE[section]; if (!t) return null; let q = sb.from(t).select('*').eq('workspace_id', wsId); if (!['brain_profile', 'writing_style', 'graphic_kits'].includes(t)) q = q.eq('id', rowId); const { data, error } = await q.maybeSingle(); if (error) throw error; return data; },
    },
    dna: {
      async get(wsId) { const { data, error } = await sb.from('brand_dna').select('*').eq('workspace_id', wsId).maybeSingle(); if (error) throw error; return data; },
      async items(wsId) { const { data, error } = await sb.from('dna_items').select('*').eq('workspace_id', wsId).order('kind').order('included', { ascending: false }).order('ext_updated_at', { ascending: false, nullsFirst: false }); if (error) throw error; return data || []; },
      async include(id, included) { const { error } = await sb.from('dna_items').update({ included, user_set: true }).eq('id', id); if (error) throw error; },
      async add(wsId, row) { const { data, error } = await sb.from('dna_items').insert({ workspace_id: wsId, source: 'you', ext_id: 'you-' + Date.now().toString(36), included: true, user_set: true, ...row }).select('*').single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('dna_items').delete().eq('id', id).eq('source', 'you'); if (error) throw error; },
      async rebuild(wsId) { const { data, error } = await sb.rpc('dna_rebuild', { p_ws: wsId }); if (error) throw error; return data; },
      async proven(wsId, limit = 200, min = 1.5) { const { data, error } = await sb.rpc('proven_content', { p_ws: wsId, p_limit: limit, p_min: min }); if (error) throw error; return data || []; },
    },
    creators: {
      async list(wsId) { const { data, error } = await sb.from('creators').select('*').eq('workspace_id', wsId).order('created_at'); if (error) throw error; return data || []; },
      async add(wsId, row) { const { data, error } = await sb.from('creators').insert({ workspace_id: wsId, ...row }).select('*').single(); if (error) throw error; return data; },
      async update(id, patch) { const { data, error } = await sb.from('creators').update(patch).eq('id', id).select('*').single(); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('creators').delete().eq('id', id); if (error) throw error; },
      async posts(wsId) { const { data, error } = await sb.from('creator_posts').select('id,creator_id,platform,format,ext_id,url,thumb,title,body,views,likes,comments,shares,duration_s,posted_at,picked').eq('workspace_id', wsId).order('views', { ascending: false, nullsFirst: false }).limit(3000); if (error) throw error; return data || []; },
      async pick(id, picked) { const { error } = await sb.from('creator_posts').update({ picked }).eq('id', id); if (error) throw error; },
      async runs(wsId) { const { data, error } = await sb.from('research_runs').select('id,preset,label,status,item_count,cost_usd,error,creator_id,created_at').eq('workspace_id', wsId).like('preset', 'creator-%').order('created_at', { ascending: false }).limit(40); if (error) throw error; return data || []; },
    },
    tokens: {
      async list(wsId) { const { data, error } = await sb.from('mcp_tokens').select('id,name,prefix,scope,calls,last_used_at,last_client,revoked_at,created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }); if (error) throw error; return data || []; },
      async create(wsId, name, scope = 'write') {
        const raw = crypto.getRandomValues(new Uint8Array(32));
        const token = 'fos_' + btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
        const { data, error } = await sb.from('mcp_tokens').insert({ workspace_id: wsId, name: name || 'AI client', token_hash: hash, prefix: token.slice(0, 10), scope: scope === 'read' || scope === 'agent' ? scope : 'write' }).select('id,name,prefix,scope,calls,last_used_at,last_client,revoked_at,created_at').single();
        if (error) throw error; return { token, row: data };
      },
      async revoke(id) { const { error } = await sb.from('mcp_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
    },
    drafts: {
      async list(wsId, status = 'waiting') { const { data, error } = await sb.from('os_drafts').select('id,kind,title,body,stream,action,source,status,created_at,meta').eq('workspace_id', wsId).eq('status', status).order('created_at', { ascending: false }).limit(200); if (error) throw error; return data || []; },
      async save(id, patch) { const { error } = await sb.from('os_drafts').update(patch).eq('id', id); if (error) throw error; },
      async decide(id, status) { const { error } = await sb.from('os_drafts').update({ status, decided_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
    },
    memory: {
      async list(wsId) { const { data, error } = await sb.from('memory_items').select('id,kind,text,meta,due,status,created_at').eq('workspace_id', wsId).neq('status', 'archived').order('created_at', { ascending: false }).limit(500); if (error) throw error; return data || []; },
      async add(wsId, item) { const { data, error } = await sb.from('memory_items').insert({ workspace_id: wsId, kind: item.kind, text: item.text, meta: item.meta || {}, due: item.due || null }).select('id,kind,text,meta,due,status,created_at').single(); if (error) throw error; return data; },
      async update(id, patch) { const { error } = await sb.from('memory_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; },
      async remove(id) { const { error } = await sb.from('memory_items').delete().eq('id', id); if (error) throw error; },
    },
    video: {
      async url(path,download=false) { const {data,error}=await sb.storage.from('video-editor').createSignedUrl(path,43200,download?{download}:{});if(error)throw error;return data.signedUrl; },
      async upload(path,blob,mime,onProgress=()=>{},signal) {
        if(!window.tus)throw new Error('The upload helper did not load. Reload the editor and try again.');
        const session=await window.Auth.session();if(!session)throw new Error('Sign in first.');
        return new Promise((resolve,reject)=>{
          const stopped=()=>{upload.abort().catch(()=>{});reject(new DOMException('Upload stopped. Select the same file to resume.','AbortError'));};
          const done=(err)=>{signal?.removeEventListener('abort',stopped);if(err)reject(err);else resolve(path);};
          const upload=new window.tus.Upload(blob,{
            endpoint:URL_+'/storage/v1/upload/resumable',retryDelays:[0,1000,3000,5000],chunkSize:6*1024*1024,
            fingerprint:async()=>['founders-video',session.user?.id||'',path,blob.name||'',blob.size,blob.lastModified||0].join(':'),
            headers:{Authorization:'Bearer '+session.access_token,apikey:KEY,'x-upsert':'false'},
            uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
            metadata:{bucketName:'video-editor',objectName:path,contentType:mime||blob.type||'application/octet-stream',cacheControl:'3600'},
            async onBeforeRequest(request){const fresh=await window.Auth.session();if(!fresh)throw new Error('Sign in to continue the upload.');request.setHeader('Authorization','Bearer '+fresh.access_token);},
            onProgress:(sent,total)=>onProgress({phase:'Uploading',ratio:sent/total,bytes:sent,total}),
            onSuccess:()=>done(),onError:e=>done(new Error('Upload interrupted. Check your connection and select the same file to retry. '+(e?.message?.includes('413')?'The storage limit is 500 MB.':'')))
          });
          if(signal?.aborted)return stopped();signal?.addEventListener('abort',stopped,{once:true});
          upload.findPreviousUploads().then(xs=>{if(signal?.aborted)return;const prior=xs.find(x=>x.metadata?.bucketName==='video-editor'&&x.metadata?.objectName===path&&x.size===blob.size);if(prior)upload.resumeFromPreviousUpload(prior);upload.start();}).catch(done);
        });
      }
    },
    strategy: {
      async list(wsId) { const { data, error } = await sb.from('founder_strategy').select('*').eq('workspace_id', wsId).order('updated_at', { ascending: false }).limit(500); if (error) throw error; return data || []; },
      async save(wsId, id, row, revision) { const { data, error } = await sb.rpc('strategy_save', { p_ws: wsId, p_id: id, p_data: row, p_revision: revision }); if (error) throw error; return data; },
    },
    content: {
      async decide(ws,id,stage,at) { const {data,error}=await sb.rpc('content_decide',{p_ws:ws,p_id:id,p_stage:stage,p_expected_at:at});if(error)throw error;return data; },
      async list(wsId) { const { data, error } = await sb.from('content_items').select('id,title,stage,channel,format,publish_at,position,meta,created_at,updated_at').eq('workspace_id', wsId).order('position', { ascending: true }).order('created_at', { ascending: false }).limit(1000); if (error) throw error; return data || []; },
      async add(wsId, item) { const { data, error } = await sb.from('content_items').insert({ workspace_id: wsId, title: item.title, stage: item.stage || 'approved', channel: item.channel || 'youtube', format: item.format || null, publish_at: item.publish_at || null, position: item.position || 0, meta: item.meta || {} }).select('id,title,stage,channel,format,publish_at,position,meta,created_at,updated_at').single(); if (error) throw error; return data; },
      async update(id, patch) { const { data, error } = await sb.from('content_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id,title,stage,channel,format,publish_at,position,meta,created_at,updated_at').single(); if (error) throw error; return data; },
      async edit(wsId, id, patch, expectedAt) { const { data, error } = await sb.rpc('content_learning_edit', { p_ws: wsId, p_id: id, p_patch: patch, p_expected_at: expectedAt }); if (error) throw error; return data; },
      async remove(id) { const { error } = await sb.from('content_items').delete().eq('id', id); if (error) throw error; },
    },
    async signOut() { if (sb) await sb.auth.signOut(); },
    // Permanent account deletion. Stored files go first through the Storage API (so nothing is left in the buckets),
    // then the database removes every workspace the user owns and the login itself.
    async deleteAccount(confirm) {
      if (String(confirm || '').trim().toLowerCase() !== 'delete') throw new Error('Type delete to confirm.');
      const s = await window.Auth.session(); if (!s) throw new Error('Sign in first');
      const { data: owned, error } = await sb.from('workspaces').select('id').eq('owner_id', s.user.id);
      if (error) throw error;
      const files = async (bucket, prefix, out, depth = 0) => {
        if (depth > 6) return out;
        for (let offset = 0; ; offset += 1000) {
          const { data, error: e } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
          if (e || !data || !data.length) break;
          for (const it of data) { const path = prefix + '/' + it.name; if (it.id) out.push(path); else await files(bucket, path, out, depth + 1); }
          if (data.length < 1000) break;
        }
        return out;
      };
      for (const w of owned || []) {
        for (const bucket of ['brain', 'video-editor']) {
          const list = await files(bucket, w.id, []);
          for (let i = 0; i < list.length; i += 100) await sb.storage.from(bucket).remove(list.slice(i, i + 100));
        }
      }
      const { data, error: e2 } = await sb.rpc('account_delete', { p_confirm: 'delete' });
      if (e2) throw e2;
      try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* the login no longer exists */ }
      return data;
    },
  };
})();

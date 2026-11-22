// Jarvis home for a private workspace: a morning brief read from real data, never a setup screen.
// HighLevel feeds new leads, booked calls and deal movement (action "brief"). Conversations are never read.
// No money on this screen, so it is safe to show in tutorials. Setup lives in the small side card only.
(() => {
  const U = window.UI, V = window.V, ACT = window.ACT;
  const { esc, icon } = U;
  const cache = { ws: null, at: 0, brief: null, err: null, busy: false };
  const ctx = () => window.App.liveCtx();
  const hlOn = () => (ctx().conns || []).some((c) => c.provider === 'highlevel' && c.status === 'connected');
  const orb = (st) => { if (window.JarvisOrb && !(window.Voice && window.Voice.state !== 'idle' && window.Voice.state !== 'off')) window.JarvisOrb.setState(st); };
  const onHome = () => { const h = (location.hash || '').slice(1); return !h || h === 'jarvis'; };

  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 6e4); if (m < 60) return Math.max(1, m) + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago'; const d = Math.round(h / 24); return d < 14 ? d + 'd ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const when = (iso) => {
    const d = new Date(iso); const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = new Date(); day.setHours(0, 0, 0, 0); const diff = Math.floor((d - day) / 864e5);
    return diff === 0 ? 'Today ' + t : diff === 1 ? 'Tomorrow ' + t : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + t;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  async function load(force) {
    const ws = ctx().ws && ctx().ws.id; if (!ws || cache.busy) return;
    if (!force && cache.ws === ws && Date.now() - cache.at < 5 * 6e4) return;
    cache.busy = true; cache.ws = ws; cache.err = null; orb('thinking');
    const jobs = [];
    jobs.push(hlOn() ? window.Auth.inboxApi('brief', { workspace_id: ws }).then((r) => { cache.brief = r; }).catch((e) => { cache.err = e.message || 'HighLevel could not be read'; }) : Promise.resolve(cache.brief = null));
    await Promise.all(jobs);
    cache.at = Date.now(); cache.busy = false; orb('idle');
    if (onHome() && window.App.isLive()) window.App.render();
  }

  function sentence() {
    const b = cache.brief; const bits = [];
    if (b && b.calls) { const today = b.calls.filter((c) => new Date(c.start).toDateString() === new Date().toDateString()).length; bits.push(today ? `${plural(today, 'call')} today.` : b.calls.length ? `Next call ${when(b.calls[0].start).replace(/^Today|^Tomorrow/, (m) => m.toLowerCase())}.` : 'No calls booked this week.'); }
    if (!(b && b.calls) && window.Conn && window.Conn.on('gcal')) { const t = (window.Conn.meta('gcal').events || []).filter((e) => !e.all_day && new Date(e.start).toDateString() === new Date().toDateString() && Date.parse(e.start) > Date.now()).length; bits.push(t ? `${plural(t, 'meeting')} still ahead today.` : 'Nothing else on the calendar today.'); }
    if (b && b.leads) bits.push(`${b.leads.capped ? '100+' : b.leads.week} new ${b.leads.week === 1 ? 'lead' : 'leads'} this week${b.leads.today ? `, ${b.leads.today} today` : ''}.`);
    return bits.join(' ');
  }

  const empty = (text, btn) => `<div class="hm-empty"><p class="muted">${text}</p>${btn || ''}</div>`;
  const spin = '<div class="rev-loading"><span class="spin" aria-hidden="true"></span><span>Reading HighLevel</span></div>';
  const hlBtn = '<button class="btn sm" data-action="ib-conn" data-id="highlevel">Connect HighLevel</button>';

  // HighLevel bookings and Google Calendar events in one list. Same meeting in both shows once.
  function calls() {
    const C2 = window.Conn; const gOn = !!(C2 && C2.on('gcal'));
    const gev = gOn ? ((C2.meta('gcal').events) || []).filter((e) => !e.all_day && Date.parse(e.end || e.start) > Date.now()).map((e) => ({ title: e.title, calendar: e.attendees && e.attendees.length ? e.attendees.slice(0, 2).join(', ') : 'Google Calendar', start: e.start })) : [];
    if (!hlOn() && !gOn) return empty('Booked calls from HighLevel and Google Calendar, each with a dossier before it starts.', '<button class="btn sm" data-action="cx" data-id="gcal">Connect Google Calendar</button>');
    const b = cache.brief; if (hlOn() && !b && !gev.length) return cache.err ? empty(esc(cache.err)) : spin;
    const seen = new Set(); const all = [...((b && b.calls) || []), ...gev].sort((x, y) => Date.parse(x.start) - Date.parse(y.start)).filter((c) => { const k = Math.round(Date.parse(c.start) / 6e4) + '|' + String(c.title).toLowerCase().slice(0, 12); if (seen.has(k)) return false; seen.add(k); return true; });
    if (!all.length) return empty('No calls booked in the next 7 days.', '<button class="btn sm" data-action="go" data-go="calls">Open Calls</button>');
    return `<div class="rows">${all.slice(0, 5).map((c) => `<div class="row"><div class="grow"><div>${esc(c.title)}</div><div class="meta">${esc(c.calendar || '')}</div></div><span class="meta">${when(c.start)}</span></div>`).join('')}</div>`;
  }
  function leads() {
    if (!hlOn()) return empty('New contacts from your funnels and forms, and which lead magnet brought them in.');
    const b = cache.brief; if (!b) return cache.err ? empty(esc(cache.err)) : spin;
    const l = b.leads; if (!l) return empty('Contacts could not be read with this token.');
    const max = Math.max(1, ...l.sources.map((s) => s.n));
    return `<div class="hm-stat"><b>${l.capped ? '100+' : l.week}</b><span class="meta">this week${l.today ? ` · ${l.today} today` : ''}</span></div>
      ${l.sources.length ? `<div class="hm-src">${l.sources.map((s) => `<div class="hm-bar"><span class="hm-fill" style="width:${Math.round((s.n / max) * 100)}%"></span><span class="hm-l">${esc(s.name)}</span><span class="meta">${s.n}</span></div>`).join('')}</div>` : ''}
      ${l.latest.length ? `<div class="rows">${l.latest.slice(0, 4).map((x) => `<div class="row"><div class="grow"><div>${esc(x.name)}</div><div class="meta">${esc(x.source || 'Direct')}</div></div><span class="meta">${ago(x.at)}</span></div>`).join('')}</div>` : empty('No new contacts in the last 7 days.')}`;
  }
  function deals() {
    if (!hlOn()) return empty('Deals that moved in your HighLevel pipelines, and the ones that went quiet.');
    const b = cache.brief; if (!b) return cache.err ? empty(esc(cache.err)) : spin;
    const d = b.deals; if (!d) return empty('Opportunities could not be read with this token.');
    if (!d.moved.length) return empty('No open deals yet.');
    const seen = {}; const moved = []; d.moved.forEach((o) => { const k = (o.name || '').toLowerCase(); if (seen[k]) { if (o.pipeline && !seen[k].pipeline.includes(o.pipeline)) seen[k].pipeline += ', ' + o.pipeline; return; } seen[k] = { ...o, pipeline: o.pipeline || '' }; moved.push(seen[k]); });
    return `<div class="rows">${moved.slice(0, 5).map((o) => `<div class="row"><div class="grow"><div>${esc(o.name)}</div><div class="meta">${esc((o.pipeline.includes(',') ? [o.pipeline] : [o.pipeline, o.stage]).filter(Boolean).join(' · '))}</div></div><span class="meta">${ago(o.at)}</span></div>`).join('')}</div>`;
  }

  // Other connected sources that have something to show on the home screen. Money stays on Revenue.
  const HOME_SRC = [['youtube-2', 'Your second channel', 'brand'], ['hl-webhooks', 'HighLevel workflows', 'connect'], ['fathom', 'Latest calls', 'calls'], ['granola', 'Meeting notes', 'calls'], ['ga4', 'Your site', 'funnels']];
  function extra() {
    const C2 = window.Conn; if (!C2) return '';
    return HOME_SRC.filter(([k]) => C2.on(k) && C2.feed(k)).slice(0, 2).map(([k, h, go]) => `<section class="panel"><header><h2>${h}</h2><button class="linkish meta" data-action="go" data-go="${go}">${C2.meta(k).last_sync_at ? 'Synced ' + esc(C2.ago(C2.meta(k).last_sync_at)) : 'Open'}</button></header>${C2.feed(k, { items: 4 })}</section>`).join('');
  }
  V.jarvis.live = () => {
    load();
    const c = ctx(); const side = V.setupCard(c); const s = sentence();
    const nothing = !hlOn() && !(window.Conn && window.Conn.on('gcal'));
    const sub = nothing ? 'Connect HighLevel and Jarvis starts reading your leads, calls and deals every morning.' : (s || 'Reading your business.');
    const panel = (h, meta, body, go) => `<section class="panel"><header><h2>${h}</h2>${go ? `<button class="linkish meta" data-action="go" data-go="${go}">${meta}</button>` : `<span class="meta">${meta}</span>`}</header>${body}</section>`;
    return `<div class="lv-home${side ? ' has-side' : ''}"><div class="lv-main"><section class="lv-hero has-orb"><div class="lv-copy">
        <h1 class="lv-h">${greetLine(c.name)}</h1>
        <p class="home-meta"><span class="dot"></span>${esc(c.ws.name)} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p class="lv-sub">${esc(sub)}</p>
        <div class="lv-actions"><button class="btn primary" data-action="voice-open">${icon('mic')}<span>Talk to Jarvis</span></button><button class="btn" data-action="ask-open">${icon('search')}<span>Ask a question</span></button>${cache.brief ? `<button class="btn ghost" data-action="hm-reload" aria-label="Refresh the brief">Refresh</button>` : ''}</div>
        <div class="vc-slot"></div>
      </div>${window.JarvisOrb ? window.JarvisOrb.html('lv-orb') : ''}</section>
      ${window.Morning ? window.Morning.home() : ''}
      <div class="hm-pair">${window.OSYT ? window.OSYT.card({ live: true }) : ''}
      ${window.OSIG ? window.OSIG.card({ live: true }) : ''}</div>
      <div class="hm-pair">${window.OSProven ? window.OSProven.homePanel(4) : ''}</div>
      <div class="grid2 hm-grid">
        ${panel('Coming up', 'Next 7 days', calls())}
        ${panel('New leads', 'Last 7 days', leads())}
        ${panel('Deals that moved', cache.brief && cache.brief.deals ? `${cache.brief.deals.open.toLocaleString('en-US')} open` : 'Pipelines', deals())}
        ${extra()}
      </div>
      ${cache.brief && cache.brief.at ? `<p class="rev-foot">Read from HighLevel ${ago(cache.brief.at)}. Revenue figures stay on the Revenue page.</p>` : ''}
    </div>${side}</div>`;
  };
  function greetLine(name) {
    const h = new Date().getHours(); const f = (name || '').split(' ')[0];
    return `${h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${f ? ', ' + esc(f) : ''}.`;
  }

  ACT['hm-reload'] = () => { cache.at = 0; load(true); U.toast('Reading HighLevel again'); };
})();

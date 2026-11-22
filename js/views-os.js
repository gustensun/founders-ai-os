// Founders AI OS: Goals, Memory (second brain), Connections and Routines.
// Demo workspaces read sample data. Private workspaces save Memory and Goals to Supabase.
(() => {
  const St = window.Store, U = window.UI, V = window.V, VS = window.VS, ACT = window.ACT;
  const { esc, eur, int, icon } = U;
  const SEED = St.SEED;
  const isLive = () => !!(window.App && window.App.isLive && window.App.isLive());
  const ctx = () => window.App.liveCtx();

  /* ---------- dates ---------- */
  const DEMO_TODAY = Date.UTC(2026, 10, 4);
  const DAY = 86400000;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayMs = () => { if (!isLive()) return DEMO_TODAY; const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const ms = (isoDate) => { const [y, m, d] = isoDate.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const rel = (n) => iso(todayMs() + n * DAY);
  const fmt = (isoDate) => { if (!isoDate) return ''; const x = new Date(ms(isoDate)); return WD[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()]; };
  const daysTo = (isoDate) => Math.round((ms(isoDate) - todayMs()) / DAY);
  const dueLabel = (isoDate) => { if (!isoDate) return ''; const n = daysTo(isoDate); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n < 0 ? Math.abs(n) + ' days late' : fmt(isoDate); };
  const duePill = (it) => { if (it.status === 'done') return '<span class="pill out">Done</span>'; if (!it.due) return ''; const n = daysTo(it.due); return `<span class="pill ${n < 0 ? 'neg' : n <= 1 ? 'warn' : 'out'}">${dueLabel(it.due)}</span>`; };

  /* ---------- capture: read one thought, file it ---------- */
  function parseDue(s) {
    const t = s.toLowerCase();
    if (/\btoday\b|\btonight\b/.test(t)) return rel(0);
    if (/\btomorrow\b/.test(t)) return rel(1);
    if (/\bnext week\b/.test(t)) return rel(7);
    if (/\bend of (the )?month\b/.test(t)) { const d = new Date(todayMs()); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); }
    const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].findIndex((w) => t.includes(w));
    if (wd >= 0) { const cur = new Date(todayMs()).getUTCDay(); let add = (wd - cur + 7) % 7; if (add === 0) add = 7; return rel(add); }
    const m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
    if (m) { const y = new Date(todayMs()).getUTCFullYear(); let d = Date.UTC(y, MON.findIndex((x) => x.toLowerCase() === m[2]), +m[1]); if (d < todayMs() - 30 * DAY) d = Date.UTC(y + 1, MON.findIndex((x) => x.toLowerCase() === m[2]), +m[1]); return iso(d); }
    const n = t.match(/\bin (\d{1,2}) days?\b/); if (n) return rel(+n[1]);
    return null;
  }
  function findContact(s) {
    if (isLive()) return null;
    const t = s.toLowerCase();
    return SEED.contacts.find((c) => t.includes(c.name.toLowerCase())) || SEED.contacts.find((c) => c.last.length > 4 && new RegExp('\\b' + c.first.toLowerCase() + '\\b').test(t) && t.includes(c.last.toLowerCase())) || null;
  }
  function classify(text) {
    const t = text.toLowerCase();
    let kind = 'note';
    if (/\b(decided|decision|we('| a)re going with|going with|from now on|no longer|we will stop|stop doing|settled on)\b/.test(t)) kind = 'decision';
    else if (/\b(waiting (on|for)|they('ll| will)|(he|she)('ll| will) (send|get|reply|confirm)|owes me|expecting)\b/.test(t)) kind = 'waiting';
    else if (/\b(i('ll| will)|i promised|promised|remind me|follow up|i owe|i need to|need to|todo|to do|send|call back)\b/.test(t)) kind = 'commitment';
    else if (/\b(idea|video (about|on)|what if|film|post about|newsletter about|hook)\b/.test(t)) kind = 'idea';
    const c = findContact(text);
    if (kind === 'note' && c) kind = 'person';
    const due = kind === 'commitment' || kind === 'waiting' ? parseDue(text) || (kind === 'commitment' ? rel(3) : rel(5)) : kind === 'decision' ? rel(30) : null;
    return { kind, due, contactId: c ? c.id : null, who: c ? c.name : '' };
  }
  const KIND = { note: 'Note', idea: 'Idea', decision: 'Decision', commitment: 'Promise', waiting: 'Waiting on', person: 'Person note', goal: 'Goal' };
  const receipt = (it) => `Filed as ${it.kind === 'commitment' ? 'a promise' : it.kind === 'waiting' ? 'waiting on' : it.kind === 'idea' ? 'an idea' : 'a ' + KIND[it.kind].toLowerCase()}${it.due ? (it.kind === 'decision' ? ', review on ' + fmt(it.due) : ', due ' + fmt(it.due)) : ''}${it.meta && it.meta.who ? ', linked to ' + it.meta.who : ''}${it.kind === 'idea' && !isLive() ? ', and added to the Content board' : ''}.`;

  /* ---------- demo memory ---------- */
  let DM = null;
  function demoMemory() {
    if (DM) return DM;
    const up = SEED.upcoming.slice(0, 6).map((u) => St.contactById[u.contactId]);
    const stalled = St.stalledDeals().slice(0, 3).map((d) => d.c);
    const hot = St.hotContacts().slice(0, 4);
    const pc = (c, i) => c || SEED.contacts[i];
    const a = pc(up[0], 3), b = pc(up[1], 5), c = pc(stalled[0], 7), d = pc(hot[0], 9), e = pc(up[2], 11), f = pc(stalled[1], 13), g = pc(hot[1], 15);
    let n = 0; const id = () => 'm' + (++n);
    const it = (kind, text, due, meta = {}, status = 'open', created = rel(-2)) => ({ id: id(), kind, text, due, meta, status, created_at: created });
    DM = [
      it('commitment', `Send ${a.first} the AI Studio build scope and a fixed price`, rel(-1), { who: a.name, contactId: a.id, source: 'Call, 2 Nov' }, 'open', rel(-2)),
      it('commitment', `Record a Loom walkthrough of the booking widget for ${b.first}`, rel(0), { who: b.name, contactId: b.id, source: 'Email, 3 Nov' }),
      it('commitment', `Intro ${d.first} to the HighLevel partner team`, rel(2), { who: d.name, contactId: d.id, source: 'Call, 30 Oct' }, 'open', rel(-5)),
      it('commitment', 'Publish the Founder Plan affiliate page with the new bonuses', rel(3), { source: 'Weekly review, 1 Nov' }, 'open', rel(-3)),
      it('commitment', `Reply to ${g.first} about a white-label licence`, rel(-3), { who: g.name, contactId: g.id, source: 'YouTube comment, 31 Oct' }, 'open', rel(-4)),
      it('commitment', 'Film the AI Studio vs Lovable video', rel(5), { source: 'Voice capture, 3 Nov' }),
      it('commitment', `Send ${e.first} the case study PDF`, rel(-6), { who: e.name, contactId: e.id, source: 'Call, 27 Oct' }, 'done', rel(-8)),
      it('waiting', `${c.first} to confirm the second-phase budget`, rel(-2), { who: c.name, contactId: c.id, source: 'Call, 28 Oct' }, 'open', rel(-7)),
      it('waiting', 'Editor to deliver cuts for the Jarvis video', rel(1), { who: 'Video editor', source: 'Slack, 2 Nov' }),
      it('waiting', `${f.first} to send login details for their HighLevel sub-account`, rel(-1), { who: f.name, contactId: f.id, source: 'Email, 30 Oct' }, 'open', rel(-5)),
      it('waiting', 'HighLevel to approve the bonus webhook for affiliate sign-ups', rel(4), { who: 'HighLevel partner team', source: 'Email, 3 Nov' }),
      it('decision', 'Founder Path is one path. Clients, products and affiliate grow together, never as separate tracks.', rel(26), { why: 'Every founder runs several streams. Splitting them made the plan feel like a menu instead of a system.', alts: 'Three tracks to choose from; agency-only focus', source: 'Planning session, 30 Oct', owner: 'Avery' }, 'open', '2026-10-30'),
      it('decision', 'Raise App Builder Kit from 297 to 497 euros', rel(-1), { why: 'Refund rate under 2 percent and buyers rate it 9.1. Price was the cheapest lever.', alts: 'Add a payment plan; keep 297 and add an upsell', source: 'Revenue review, 5 Oct', owner: 'Avery', review: 'Compare 30-day conversion before and after' }, 'open', '2026-10-05'),
      it('decision', 'Two long videos a week, shorts only from outliers', rel(6), { why: 'Shorts from outliers brought 3x the subscribers per hour of editing.', alts: 'Daily shorts; one long video a week', source: 'Content review, 12 Oct', owner: 'Avery' }, 'open', '2026-10-12'),
      it('decision', 'Keep sending, sequences and pipelines inside HighLevel. The OS drafts, HighLevel delivers.', rel(57), { why: 'One system of record, no duplicated workflows, and every send is auditable where clients already live.', alts: 'Send from the OS directly', source: 'Architecture call, 1 Nov', owner: 'Avery' }, 'open', '2026-11-01'),
      it('decision', 'Stop offering monthly retainers under 1,500 euros', rel(18), { why: 'Small retainers took 40 percent of call time and 9 percent of services revenue.', alts: 'Raise to 1,000; productise into a kit', source: 'Call Coach report, 22 Oct', owner: 'Avery' }, 'open', '2026-10-22'),
      it('person', `${a.first} cares most about speed to launch. Mentioned twice that their last agency took four months.`, null, { who: a.name, contactId: a.id, source: 'Call, 2 Nov' }),
      it('person', `${d.first} has a team of three and wants to resell the build to their own clients.`, null, { who: d.name, contactId: d.id, source: 'Call, 30 Oct' }),
      it('person', `${c.first} prefers short voice notes over email. Decides with a business partner.`, null, { who: c.name, contactId: c.id, source: 'Call, 28 Oct' }),
      it('note', 'Clinic owners keep asking for a done-for-you booking widget. Third time this month.', null, { source: 'Voice capture, 3 Nov' }),
      it('idea', 'Video: I let my AI chief of staff run my week. Here is what it got wrong.', null, { source: 'Voice capture, 2 Nov' }),
      ...((cm) => [
        it('commitment', 'Send the group the AI Studio snapshot link', rel(1), { ...cm, at_s: 1312, quote: 'I will drop the snapshot link in the group chat tomorrow.' }, 'suggested', rel(-1)),
        it('commitment', 'Record a walkthrough of the affiliate bridge page for the members', null, { ...cm, at_s: 2208, quote: 'Let me record that for you so you can copy it.' }, 'suggested', rel(-1)),
        it('waiting', 'Anna to send her offer page for a teardown', null, { ...cm, who: 'Anna', at_s: 2654, quote: 'I will send you the link after the call.' }, 'suggested', rel(-1)),
        it('note', 'I do not have an audience yet, so who would I even sell to?', null, { ...cm, tag: 'objection', who: 'Mikael', at_s: 1840, quote: 'I have like 200 followers, who would buy from me?' }, 'suggested', rel(-1)),
        it('note', 'First three sales of the 27 euro kit in week one', null, { ...cm, tag: 'win', who: 'Sara', at_s: 960, quote: 'I got three sales this week from the kit, my first ever.' }, 'suggested', rel(-1)),
        it('note', 'How do I price a done-for-you funnel for a local business?', null, { ...cm, tag: 'question', who: 'Jonas', at_s: 3011 }, 'suggested', rel(-1)),
      ])({ from: 'call', source: 'Call, Live Coaching Call, 3 Nov', recording_id: 'demo-call-1', recording: 'Live Coaching Call w Avery, 3 Nov', call_at: rel(-1) }),
    ];
    return DM;
  }

  /* ---------- private memory (Supabase) ---------- */
  const LM = { ws: null, items: [], loading: false, error: '' };
  function liveItems() {
    const w = ctx().ws; if (!w || !w.id) return [];
    if (LM.ws !== w.id && !LM.loading) {
      LM.loading = true; LM.error = '';
      Auth.memory.list(w.id).then((rows) => { LM.items = rows; LM.ws = w.id; }).catch((e) => { LM.error = Auth.friendly(e); LM.ws = w.id; LM.items = []; }).finally(() => { LM.loading = false; window.App.render(true); });
    }
    return LM.ws === w.id ? LM.items : [];
  }
  const items = () => (isLive() ? liveItems() : demoMemory());
  const loadingLive = () => isLive() && LM.ws !== (ctx().ws || {}).id;

  async function addItem(text, forceKind) {
    const c = classify(text);
    const kind = forceKind || c.kind;
    const meta = { source: 'Capture, ' + fmt(rel(0)).replace(/^\w+ /, '') };
    if (c.who) { meta.who = c.who; meta.contactId = c.contactId; }
    let due = c.due; if (forceKind && forceKind !== c.kind) due = forceKind === 'decision' ? rel(30) : forceKind === 'commitment' || forceKind === 'waiting' ? parseDue(text) || rel(3) : null;
    if (isLive()) {
      const row = await Auth.memory.add(ctx().ws.id, { kind, text, meta, due });
      LM.items.unshift(row); return row;
    }
    const row = { id: 'm' + Date.now(), kind, text, due, meta, status: 'open', created_at: rel(0) };
    demoMemory().unshift(row);
    if (kind === 'idea') St.A.addIdea({ title: text.replace(/^(idea|video)( about| on)?:?\s*/i, '').replace(/^./, (x) => x.toUpperCase()), why: 'Captured by you. Jarvis scores it tonight with the rest.' });
    if (kind === 'person' && c.contactId) St.A.note(c.contactId, text);
    St.log('Captured to Memory', KIND[kind] + ' · ' + text.slice(0, 60), 'memory');
    return row;
  }
  async function setStatus(id, status) {
    const it = items().find((x) => x.id === id); if (!it) return;
    it.status = status;
    if (isLive()) await Auth.memory.update(id, { status });
  }

  /* ---------- small render pieces ---------- */
  const whoLink = (it) => it.meta && it.meta.contactId && !isLive() ? U.who(it.meta.contactId) : it.meta && it.meta.who ? esc(it.meta.who) : '';
  const src = (it) => it.meta && it.meta.source ? esc(it.meta.source) : it.created_at ? 'Added ' + fmt(String(it.created_at).slice(0, 10)) : '';
  const bar = (v, mark) => `<span class="pbar"><span class="fill" style="width:${Math.max(0, Math.min(1, v)) * 100}%"></span>${mark != null ? `<span class="mark" style="left:${Math.max(0, Math.min(1, mark)) * 100}%"></span>` : ''}</span>`;
  const capForm = (ph) => `<form class="cap" data-form="capture" autocomplete="off"><span class="cap-ic" aria-hidden="true">${icon('plus')}</span><input name="text" maxlength="2000" required placeholder="${esc(ph)}" aria-label="Capture a thought"><button type="button" class="btn icon ghost" data-action="voice-open" aria-label="Capture by voice" title="Say: remember that...">${icon('mic')}</button><button class="btn primary" type="submit">File it</button></form><p class="meta cap-hint" id="cap-receipt" aria-live="polite">Type or say it the way you would to an assistant. Promises, waiting-on, decisions, people and ideas get filed on their own.</p>`;

  /* ---------- Memory ---------- */
  VS.memTab = VS.memTab || 'loops';
  V.memory = () => {
    if (loadingLive()) { items(); return `${U.title('Memory', 'Your second brain.')}<section class="panel">${U.empty('Opening your memory', 'One moment.')}</section>`; }
    const live = isLive();
    const all = items();
    const open = (k) => all.filter((x) => x.kind === k && x.status === 'open');
    const mine = open('commitment'), wait = open('waiting'), decs = all.filter((x) => x.kind === 'decision' && x.status !== 'archived');
    const late = mine.filter((x) => x.due && daysTo(x.due) < 0);
    const reviewDue = decs.filter((x) => x.due && daysTo(x.due) <= 7);
    const people = [...new Map(all.filter((x) => x.meta && x.meta.who && x.meta.contactId).map((x) => [x.meta.contactId, x.meta])).values()];
    const sugg = all.filter((x) => x.status === 'suggested');
    if (live && !CS.loaded) loadCalls();
    const tab = VS.memTab;
    const tabs = [['calls', 'From calls ' + sugg.length], ['loops', 'Open loops ' + (mine.length + wait.length)], ['decisions', 'Decisions ' + decs.length], ['people', 'People ' + people.length], ['all', 'Everything ' + (all.length - sugg.length)]];
    let body = '';
    const loopRow = (x) => `<div class="row"><button class="chk" data-action="mem-done" data-id="${x.id}" aria-label="Mark done" ${x.status === 'done' ? 'aria-pressed="true"' : ''}></button><div class="grow"><div class="wrap ${x.status === 'done' ? 'struck' : ''}">${esc(x.text)}</div><div class="s">${[whoLink(x), src(x)].filter(Boolean).join(' · ')}</div></div>${duePill(x)}${x.kind === 'commitment' && x.status === 'open' && x.meta && x.meta.contactId && !isLive() ? `<button class="btn sm" data-action="mem-draft" data-id="${x.id}">Draft it</button>` : x.kind === 'waiting' && x.status === 'open' && !isLive() ? `<button class="btn sm" data-action="mem-nudge" data-id="${x.id}">Nudge</button>` : ''}</div>`;
    if (tab === 'loops') {
      const sorted = (arr) => [...arr].sort((p, q) => (p.due || '9') < (q.due || '9') ? -1 : 1);
      const done = all.filter((x) => (x.kind === 'commitment' || x.kind === 'waiting') && x.status === 'done').slice(0, 4);
      body = `<div class="grid2 flush"><div><h3 class="sub-h">You promised <span class="meta">${mine.length}</span></h3><div class="rows">${sorted(mine).map(loopRow).join('') || U.empty('Nothing promised', 'Say "remember I will send the proposal Friday" and it lands here.')}</div></div>
        <div><h3 class="sub-h">Waiting on others <span class="meta">${wait.length}</span></h3><div class="rows">${sorted(wait).map(loopRow).join('') || U.empty('Nobody owes you anything', 'Say "waiting on Anna for the budget" and Jarvis tracks it.')}</div></div></div>
        ${done.length ? `<h3 class="sub-h" style="margin-top:18px">Closed recently</h3><div class="rows">${done.map(loopRow).join('')}</div>` : ''}`;
    }
    if (tab === 'decisions') body = `<div class="rows">${[...decs].sort((p, q) => (p.due || '9') < (q.due || '9') ? -1 : 1).map((x) => `<div class="row click" data-action="mem-decision" data-id="${x.id}" tabindex="0" role="button"><span class="time">${esc(fmt(String(x.created_at).slice(0, 10)).replace(/^\w+ /, ''))}</span><div class="grow"><div class="wrap">${esc(x.text)}</div><div class="s wrap">${x.meta && x.meta.why ? esc(x.meta.why) : src(x)}</div></div>${x.status === 'done' ? '<span class="pill out">Reviewed</span>' : x.due ? `<span class="pill ${daysTo(x.due) <= 0 ? 'warn' : daysTo(x.due) <= 7 ? 'acc' : 'out'}">${daysTo(x.due) <= 0 ? 'Review now' : 'Review ' + fmt(x.due).replace(/^\w+ /, '')}</span>` : ''}</div>`).join('') || U.empty('No decisions logged', 'Say "we decided to..." or use Log a decision. Each one gets a review date so you learn from it.')}</div>`;
    if (tab === 'people') body = people.length ? `<div class="grid2 flush">${people.map((p) => { const notes = all.filter((x) => x.meta && x.meta.contactId === p.contactId); const c = St.contactById[p.contactId]; const loops = notes.filter((x) => (x.kind === 'commitment' || x.kind === 'waiting') && x.status === 'open'); return `<article class="well person"><div class="dh"><span class="avatar">${esc(U.initials(p.who))}</span><div class="grow"><b>${whoLink(notes[0])}</b><div class="meta">${c ? esc([c.title, c.company].filter(Boolean).join(', ')) : ''}</div></div>${loops.length ? `<span class="pill warn">${loops.length} open</span>` : ''}</div><ul class="plain">${notes.slice(0, 3).map((x) => `<li><span class="meta">${KIND[x.kind]}</span> ${esc(x.text)}</li>`).join('')}</ul></article>`; }).join('')}</div><p class="meta" style="margin-top:12px">People come from HighLevel contacts. Memory adds what they said and what you owe each other. Contact details are still edited in HighLevel.</p>` : U.empty('No people yet', isLive() ? 'Mention someone in a capture and they get a card here. Once HighLevel is connected, every contact is matched.' : 'Mention a contact by name in a capture.');
    if (tab === 'all') body = `<div class="rows">${all.filter((x) => x.status !== 'suggested').map((x) => `<div class="row"><span class="pill out kind">${KIND[x.kind]}</span><div class="grow"><div class="wrap">${esc(x.text)}</div><div class="s">${[whoLink(x), src(x)].filter(Boolean).join(' · ')}</div></div>${duePill(x)}<button class="btn sm ghost" data-action="mem-archive" data-id="${x.id}" aria-label="Archive">Archive</button></div>`).join('') || U.empty('Your memory is empty', 'Capture the first thing on your mind above.')}</div>`;
    if (tab === 'calls') body = callsBody(sugg);
    return `${U.title('Memory', 'Your second brain. Promises, decisions and people from calls, email and voice, so nothing you said goes missing.', `<button class="btn" data-action="mem-log-decision">Log a decision</button>`)}
    ${capForm('Remember that... I promised Theo the proposal by Friday')}
    ${LM.error && live ? `<p class="meta" style="color:var(--negative)">${esc(LM.error)}</p>` : ''}
    ${U.kpis([{ label: 'You promised', value: mine.length, delta: late.length ? late.length + ' late' : 'None late' }, { label: 'Waiting on others', value: wait.length, delta: wait.filter((x) => x.due && daysTo(x.due) < 0).length + ' overdue' }, { label: 'Decisions to review', value: reviewDue.length, delta: 'Next 7 days' }, { label: 'Captured', value: all.length - sugg.length, delta: live ? 'Saved to your workspace' : 'Calls, email, voice and you' }])}
    <div class="layout" style="margin-top:var(--gap)"><section class="panel"><header>${U.seg('memTab', tab, tabs)}</header>${body}</section>
      <aside class="rail"><h2 class="out">How it fills</h2><section class="panel tight"><div class="rows">
        ${[['Calls', 'Every call is read for promises, waiting-on items, decisions, objections, wins and questions. You keep what counts.', live ? 'zoom' : null], ['HighLevel', 'Replies where you said "I will send" or "I will call" become promises with a date.', live ? 'highlevel' : null], ['Voice', 'Say "remember that" to Jarvis anywhere in the app.', null], ['You', 'The capture bar on this page, from any device.', null]].map(([a, b]) => `<div class="row"><div class="grow"><div class="t">${a}</div><div class="s wrap">${b}</div></div></div>`).join('')}
      </div></section>
      <h2 class="out">Ask your memory</h2><section class="panel tight"><div class="rows">${['What did I promise this week?', 'Who am I waiting on?', 'What did we decide about pricing?'].map((q) => `<button class="row lnk-row" data-action="mem-ask" data-q="${esc(q)}"><span class="grow">${esc(q)}</span>${icon('arrow')}</button>`).join('')}</div></section></aside></div>`;
  };
  V.memory.live = () => V.memory();

  /* ---------- From calls: suggestions the founder keeps or dismisses ---------- */
  const CS = { loaded: false, ws: null, status: null, running: false, progress: '' };
  const TAG = { objection: 'Objection', win: 'Win', question: 'Question' };
  const sugLabel = (x) => (x.kind === 'note' && x.meta && TAG[x.meta.tag]) || KIND[x.kind];
  const mmss = (s) => (s == null ? '' : String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'));
  function loadCalls() {
    const w = ctx().ws; if (!w || !w.id || CS.ws === w.id) return;
    CS.ws = w.id; CS.loaded = true;
    Auth.brainApi('calls-review', { workspace_id: w.id, status_only: true }).then((r) => { CS.status = r.status; if (VS.view === 'memory') window.App.render(true); }).catch(() => { CS.status = null; });
  }
  function callsBody(sugg) {
    const live = isLive(); const st = live ? CS.status : { calls: 1, reviewed: 1, ideas: 2 };
    const groups = [...sugg.reduce((m, x) => { const k = (x.meta && x.meta.recording_id) || 'other'; if (!m.has(k)) m.set(k, []); m.get(k).push(x); return m; }, new Map()).values()]
      .sort((a, b) => String((b[0].meta || {}).call_at || '').localeCompare(String((a[0].meta || {}).call_at || '')));
    const order = { commitment: 0, waiting: 1, decision: 2, note: 3, idea: 4 };
    const head = `<div class="row" style="border:0;padding-top:0"><div class="grow"><div>${st ? `${int(st.reviewed || 0)} of ${int(st.calls || 0)} calls reviewed${st.ideas ? ` · ${int(st.ideas)} content ideas wait on the Content board` : ''}` : 'Every Zoom call is read for promises, waiting-on items, decisions, objections, wins and member questions.'}</div><div class="s">${CS.running ? esc(CS.progress) : 'Nothing counts until you keep it. New calls are reviewed every morning.'}</div></div>
      ${st && st.ideas ? `<button class="btn sm" data-action="go" data-go="content">Open Content</button>` : ''}${live ? `<button class="btn sm ${st && st.calls > st.reviewed ? 'primary' : ''}" data-action="calls-review" ${CS.running || (st && st.calls <= st.reviewed) ? 'disabled' : ''}>${CS.running ? U.spin + 'Reviewing' : 'Review new calls'}</button>` : ''}</div>`;
    if (!groups.length) return head + U.empty('Nothing waiting from your calls', live && st && !st.calls ? 'Connect Zoom and your recorded calls show up here after the morning sync.' : 'Everything from your calls is kept or dismissed.');
    return head + groups.map((g) => { const m = g[0].meta || {}; const ids = g.map((x) => x.id).join(',');
      return `<div class="sub-h" style="margin-top:18px;display:flex;align-items:center;gap:8px"><span class="grow">${esc(m.recording || 'Call')} <span class="meta">${g.length}</span></span><button class="btn sm ghost" data-action="sug-all" data-ids="${ids}" data-to="archived">Dismiss all</button><button class="btn sm" data-action="sug-all" data-ids="${ids}" data-to="open">Keep all</button></div>
      <div class="rows">${[...g].sort((a, b) => (order[a.kind] - order[b.kind]) || ((a.meta || {}).at_s || 0) - ((b.meta || {}).at_s || 0)).map((x) => { const xm = x.meta || {};
        return `<div class="row sug-row"><span class="pill out kind">${esc(sugLabel(x))}</span><div class="grow"><div class="wrap">${esc(x.text)}</div><div class="s">${[xm.who ? esc(xm.who) : '', xm.at_s != null ? 'at ' + mmss(xm.at_s) : '', xm.quote ? '\u201c' + esc(xm.quote) + '\u201d' : ''].filter(Boolean).join(' · ')}</div></div><span class="sug-act">${x.due ? duePill({ ...x, status: 'open' }) : ''}<button class="btn sm ghost" data-action="sug-set" data-id="${x.id}" data-to="archived">Dismiss</button><button class="btn sm" data-action="sug-set" data-id="${x.id}" data-to="open">Keep</button></span></div>`; }).join('')}</div>`; }).join('');
  }
  async function setSug(ids, to) {
    const list = items().filter((x) => ids.includes(x.id)); if (!list.length) return;
    list.forEach((x) => { x.status = to; });
    if (isLive()) { await Promise.all(list.map((x) => Auth.memory.update(x.id, { status: to }))); if (to === 'archived') LM.items = LM.items.filter((x) => !ids.includes(x.id)); }
    else if (to === 'archived') DM = DM.filter((x) => !ids.includes(x.id));
  }
  ACT['sug-set'] = async (el) => { try { await setSug([el.dataset.id], el.dataset.to); U.toast(el.dataset.to === 'open' ? 'Kept in Memory' : 'Dismissed'); } catch (e) { U.toast(Auth.friendly(e)); } window.App.render(true); window.App.refreshCounts(); };
  ACT['sug-all'] = async (el) => { const ids = el.dataset.ids.split(','); try { await setSug(ids, el.dataset.to); U.toast((el.dataset.to === 'open' ? 'Kept ' : 'Dismissed ') + ids.length); } catch (e) { U.toast(Auth.friendly(e)); } window.App.render(true); window.App.refreshCounts(); };
  ACT['calls-review'] = async () => {
    const w = ctx().ws; if (!w || CS.running) return;
    CS.running = true; let n = 0; CS.progress = 'Reading the newest call'; window.App.render(true);
    try {
      for (let i = 0; i < 20; i++) {
        const r = await Auth.brainApi('calls-review', { workspace_id: w.id });
        CS.status = r.status; if (r.done) break; n++;
        CS.progress = `Reviewed ${r.title}. ${r.status.calls - r.status.reviewed} to go.`; if (VS.view === 'memory') window.App.render(true);
      }
      LM.ws = null; U.toast(n ? `Reviewed ${n} call${n === 1 ? '' : 's'}. Keep what matters.` : 'Every call is already reviewed');
    } catch (e) { U.toast(e.message || 'Could not review the calls'); }
    CS.running = false; window.App.render(true);
  };

  ACT['mem-done'] = async (el) => { const it = items().find((x) => x.id === el.dataset.id); if (!it) return; try { await setStatus(it.id, it.status === 'done' ? 'open' : 'done'); U.toast(it.status === 'done' ? 'Closed' : 'Reopened'); } catch (e) { U.toast(Auth.friendly(e)); } window.App.render(true); window.App.refreshCounts(); };
  ACT['mem-archive'] = async (el) => { try { await setStatus(el.dataset.id, 'archived'); if (isLive()) LM.items = LM.items.filter((x) => x.id !== el.dataset.id); else DM = DM.filter((x) => x.id !== el.dataset.id); U.toast('Archived'); } catch (e) { U.toast(Auth.friendly(e)); } window.App.render(true); window.App.refreshCounts(); };
  ACT['mem-ask'] = (el) => window.App.ask(el.dataset.q);
  ACT['mem-draft'] = (el) => {
    const it = items().find((x) => x.id === el.dataset.id); const c = St.contactById[it.meta.contactId];
    St.A.addApproval({ kind: 'Email', title: 'Promise kept: ' + it.text, agent: 'followup', stream: 'services', contactId: c.id, rubric: 'rb-email', scores: [8.7, 8.9, 8.4, 8.6], action: 'Send email from HighLevel', body: `Hi ${c.first},\n\nAs promised, here it is. ${it.text.replace(/^send /i, '').replace(/^./, (x) => x.toUpperCase())}.\n\nIf anything is unclear, reply here and I will sort it today.\n\nAvery` });
    el.disabled = true; el.textContent = 'In the Newsfeed'; U.toast('Draft sent to the Newsfeed'); window.App.refreshCounts();
  };
  ACT['mem-nudge'] = (el) => {
    const it = items().find((x) => x.id === el.dataset.id);
    if (it.meta && it.meta.contactId) { const c = St.contactById[it.meta.contactId]; St.A.addApproval({ kind: 'Email', title: 'Nudge ' + c.name, agent: 'followup', stream: 'services', contactId: c.id, rubric: 'rb-email', scores: [8.6, 8.8, 8.2, 8.5], action: 'Send email from HighLevel', body: `Hi ${c.first},\n\nQuick one. Any news on this? ${it.text.replace(c.first + ' to ', '').replace(/^./, (x) => x.toUpperCase())}.\n\nNo rush if it is still moving.\n\nAvery` }); U.toast('Nudge drafted in the Newsfeed'); }
    else U.toast('Jarvis will raise it in tomorrow\u2019s brief');
    el.disabled = true; el.textContent = 'Nudged'; window.App.refreshCounts();
  };
  ACT['mem-decision'] = (el) => {
    const x = items().find((y) => y.id === el.dataset.id); if (!x) return; const m = x.meta || {};
    U.drawer(`<div><p class="meta">Decision · ${esc(fmt(String(x.created_at).slice(0, 10)))}${m.owner ? ' · ' + esc(m.owner) : ''}</p><h2 class="serif-h">${esc(x.text)}</h2></div>
      ${m.why ? `<div class="dsec"><h3>Why</h3><p>${esc(m.why)}</p></div>` : ''}
      ${m.alts ? `<div class="dsec"><h3>Considered instead</h3><p class="muted">${esc(m.alts)}</p></div>` : ''}
      <div class="dsec"><h3>Review</h3><p>${x.due ? fmt(x.due) + (m.review ? '. ' + esc(m.review) : '. Jarvis brings it up in the brief that morning.') : 'No review date.'}</p>${m.outcome ? `<p class="muted" style="margin-top:6px">Outcome: ${esc(m.outcome)}</p>` : ''}</div>
      <div class="dsec"><h3>Source</h3><p class="muted">${src(x)}</p></div>
      ${x.status === 'done' ? '' : `<div class="actions"><button class="btn primary" data-action="mem-review" data-id="${x.id}">Record the outcome</button></div>`}`, { label: 'Decision' });
  };
  ACT['mem-review'] = async (el) => {
    const x = items().find((y) => y.id === el.dataset.id);
    const r = await U.dialog({ title: 'How did it go?', body: esc(x.text), fields: [{ name: 'outcome', label: 'Outcome', type: 'textarea', rows: 4, required: true, placeholder: 'What happened, and would you decide the same again?' }], ok: 'Save outcome' });
    if (!r) return; x.meta = { ...(x.meta || {}), outcome: r.outcome }; x.status = 'done';
    try { if (isLive()) await Auth.memory.update(x.id, { meta: x.meta, status: 'done' }); U.toast('Outcome saved. Agents read it before the next similar call.'); } catch (e) { U.toast(Auth.friendly(e)); }
    U.closeDrawer(); window.App.render(true);
  };
  ACT['mem-log-decision'] = async () => {
    const r = await U.dialog({ title: 'Log a decision', fields: [{ name: 'text', label: 'What did you decide?', required: true, placeholder: 'Raise the kit to 497 euros' }, { name: 'why', label: 'Why', type: 'textarea', rows: 3, placeholder: 'The numbers or the feeling behind it' }, { name: 'alts', label: 'What you considered instead' }, { name: 'review', label: 'Review in', type: 'select', options: [['2 weeks', '2 weeks'], ['30 days', '30 days'], ['90 days', '90 days']], value: '30 days' }], ok: 'Log it' });
    if (!r) return;
    const days = { '2 weeks': 14, '30 days': 30, '90 days': 90 }[r.review] || 30;
    const meta = { why: r.why, alts: r.alts, owner: (ctx().name || 'Avery').split(' ')[0], source: 'Logged by you' };
    try {
      if (isLive()) LM.items.unshift(await Auth.memory.add(ctx().ws.id, { kind: 'decision', text: r.text, meta, due: rel(days) }));
      else demoMemory().unshift({ id: 'm' + Date.now(), kind: 'decision', text: r.text, due: rel(days), meta, status: 'open', created_at: rel(0) });
      VS.memTab = 'decisions'; U.toast('Logged. Review on ' + fmt(rel(days)));
    } catch (e) { U.toast(Auth.friendly(e)); }
    if (VS.view === 'memory') window.App.render(true);
  };

  /* ---------- Goals ---------- */
  const COSTS = [['HighLevel Agency Unlimited', 297, 'Software'], ['Video editor', 600, 'People'], ['Claude and OpenAI', 0, 'AI models'], ['ElevenLabs', 22, 'AI models'], ['Apify', 49, 'Research'], ['Tella', 19, 'Content'], ['Google Workspace', 14, 'Software'], ['Vercel and Supabase', 45, 'Software'], ['Canva', 12, 'Content']];
  VS.freedom = VS.freedom || 15000;
  function goals() {
    const r = St.range(30).cur; const tot = St.total(r);
    const spend = St.agentTotals().spent;
    const costs = COSTS.map(([n, v, k]) => [n, n.startsWith('Claude') ? Math.round(spend) : v, k]);
    const cost = St.sum(costs, (c) => c[1]);
    const qStart = Date.UTC(2026, 9, 1), qEnd = Date.UTC(2026, 11, 31);
    const elapsed = (DEMO_TODAY - qStart) / (qEnd - qStart);
    const recent = SEED.videos.filter((v) => v.day >= St.T - 28).length / 4;
    const brainV = St.score().parts[0].v;
    const mk = (id, name, unit, cur, start, target, stream, agent, next) => { const p = (cur - start) / (target - start); const st = p >= elapsed - 0.08 ? 'on' : p >= elapsed - 0.25 ? 'risk' : 'off'; return { id, name, unit, cur, start, target, p, st, stream, agent, next }; };
    const g = [
      mk('g1', 'Software revenue a month', 'eur', r.software, Math.round(r.software * 0.82 / 100) * 100, Math.ceil(r.software * 1.22 / 500) * 500, 'software', 'Client Health', 'Two trials end this week. Dossiers are ready for both onboarding calls.'),
      mk('g2', 'Product sales a month', 'eur', r.products, Math.round(r.products * 0.7 / 100) * 100, Math.ceil(r.products * 1.18 / 500) * 500, 'products', 'Funnel Builder', 'The kit checkout loses 31 percent at the order bump. A cleaner bump is in the Newsfeed.'),
      mk('g3', 'Affiliate commissions a month', 'eur', r.affiliate, Math.round(r.affiliate * 0.9 / 50) * 50, Math.ceil(r.affiliate * 1.7 / 250) * 250, 'affiliate', 'Outcome Tracker', '14 video links have no SubID, so commissions cannot be traced. Data Fixer can repair 11.'),
      mk('g4', 'Long videos a week', 'n', Math.round(recent * 10) / 10, 1, 2, 'brand', 'Content Planner', 'Film the top two scored ideas this week to stay on pace.'),
      mk('g5', 'Brain coverage', 'pct', Math.round(brainV * 100), 55, 90, 'brain', 'Draft Studio', St.s.brain.gaps.length + ' Brain questions are open. Ten minutes of interview mode closes most of them.'),
    ];
    return { r, tot, costs, cost, profit: tot - cost, elapsed, g, weeksLeft: Math.ceil((qEnd - DEMO_TODAY) / (7 * DAY)) };
  }
  const gv = (g, v) => g.unit === 'eur' ? eur(v) : g.unit === 'pct' ? v + '%' : String(v);
  const stPill = (s) => s === 'on' ? '<span class="pill pos">On track</span>' : s === 'risk' ? '<span class="pill warn">At risk</span>' : '<span class="pill neg">Off track</span>';
  VS.reviewDone = VS.reviewDone || false;
  VS.prio = VS.prio || null;
  function review(G) {
    const w = St.range(7); const wt = St.total(w.cur), wp = St.total(w.prev);
    const h = St.s.history; const m = demoMemory();
    const kept = m.filter((x) => x.kind === 'commitment' && x.status === 'done').length;
    const late = m.filter((x) => x.kind === 'commitment' && x.status === 'open' && x.due && daysTo(x.due) < 0);
    const top = [...SEED.videos].sort((a, b) => b.outlier - a.outlier)[0];
    const risk = G.g.filter((x) => x.st !== 'on');
    return {
      label: 'Week 44 · 26 Oct to 1 Nov',
      wins: [`Revenue ${eur(wt)}, ${wt >= wp ? 'up' : 'down'} ${Math.abs(Math.round((wt / Math.max(1, wp) - 1) * 100))} percent on the week before.`, `"${top.title}" is running at ${top.outlier.toFixed(1)}x your median views.`, `${h.approved} drafts approved and ${h.edited} edited, so agents are learning your voice.`],
      misses: [late.length ? `${late.length} promises slipped past their date, starting with "${late[0].text}".` : 'No promises slipped.', ...risk.slice(0, 2).map((x) => `${x.name} is ${x.st === 'risk' ? 'at risk' : 'off track'}: ${gv(x, x.cur)} against ${gv(x, x.target)}.`)],
      learned: ['Shorts cut from outliers keep beating planned shorts. The decision from 12 Oct is holding up.', `Calls booked from YouTube close faster than outreach calls.`],
      prio: [risk[0] ? risk[0].next : 'Keep the pace on every goal.', late[0] ? 'Close the late promises before Wednesday, starting with ' + (late[0].meta.who || 'the oldest') + '.' : 'Film two long videos.', 'Publish the Founder Plan affiliate page and send the launch email from HighLevel.'],
      kept,
    };
  }
  V.goals = () => {
    const G = goals(); const R = review(G);
    const fp = G.profit / VS.freedom;
    const prio = VS.prio || R.prio;
    return `${U.title('Goals', 'Where the quarter is heading, measured from live numbers. Jarvis writes the weekly review every Sunday at 18:00.', `<button class="btn" data-action="goal-freedom">Set freedom number</button>`)}
    <section class="panel freedom">
      <div class="fr-main"><h2>Freedom number</h2><p class="fr-big">${eur(G.profit)}<span class="muted"> of ${eur(VS.freedom)} a month</span></p>${bar(fp)}<p class="meta" style="margin-top:8px">Profit over the last 30 days: ${eur(G.tot)} in, ${eur(G.cost)} out. ${fp >= 1 ? 'You are there. Raise the number or buy back time.' : Math.round(fp * 100) + ' percent of the way.'}</p></div>
      <div class="fr-side">${['software', 'services', 'products', 'affiliate'].map((s) => `<div><span class="meta"><span class="sw" style="background:${U.shade[s]}"></span>${U.sname(s)}</span><b>${eur(G.r[s])}</b></div>`).join('')}</div>
    </section>
    ${VS.prio ? `<section class="panel prio"><header><h2>This week\u2019s three</h2><span class="meta">Set from the weekly review. Jarvis leads with them whenever you ask what needs you.</span></header><ol class="prio-list">${prio.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>` : ''}
    <div class="layout" style="margin-top:var(--gap)">
      <section class="panel"><header><h2>Q4 goals</h2><span class="meta">${G.weeksLeft} weeks left · the line marks where you should be today</span></header><div class="rows">
        ${G.g.map((g) => `<div class="row goal click" data-action="goal" data-id="${g.id}" tabindex="0" role="button"><div class="grow"><div class="dh"><span class="t">${esc(g.name)}</span>${stPill(g.st)}</div>${bar(g.p, G.elapsed)}<div class="s">${gv(g, g.cur)} now · target ${gv(g, g.target)} · ${esc(g.agent)} watches it</div></div></div>`).join('')}
      </div></section>
      <aside class="rail"><h2 class="out">Operating rhythm</h2><section class="panel tight"><div class="rows">
        ${[['Daily', 'Morning brief', St.s.settings.briefing + ', every day'], ['Nightly', 'Ideation and scoring', St.s.settings.ideation + ', every night'], ['Weekly', 'Review and three priorities', 'Sunday 18:00'], ['Monthly', 'Money review and tool spend', '1st of the month, 09:00'], ['Quarterly', 'Goals and offer ladder', 'Last Friday of the quarter']].map(([a, b, c]) => `<div class="row"><span class="time" style="min-width:72px">${a}</span><div class="grow"><div class="t">${b}</div><div class="s">${c}</div></div></div>`).join('')}
      </div></section>
      <h2 class="out">Monthly costs</h2><section class="panel tight"><div class="rows">${G.costs.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, v, k]) => `<div class="row"><div class="grow"><div class="t">${esc(n)}</div><div class="s">${k}</div></div><span class="num">${eur(v)}</span></div>`).join('')}</div></section></aside>
    </div>
    <section class="panel review" style="margin-top:var(--gap)"><header><div><h2>Weekly review</h2><span class="meta">${R.label} · drafted by Jarvis from revenue, calls, content and Memory</span></div><div class="actions">${VS.reviewDone ? '<span class="pill pos">Reviewed</span>' : `<button class="btn" data-action="goal-edit-prio">Change priorities</button><button class="btn primary" data-action="goal-approve">Approve and set priorities</button>`}</div></header>
      <div class="grid3 flush">${[['Went well', R.wins], ['Slipped', R.misses], ['Learned', R.learned]].map(([h, l]) => `<div><h3 class="sub-h">${h}</h3><ul class="plain">${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      <h3 class="sub-h" style="margin-top:18px">Next week\u2019s three</h3><ol class="prio-list">${prio.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    </section>`;
  };
  V.goals.live = () => {
    if (loadingLive()) { items(); return `${U.title('Goals', 'Your quarter, measured.')}<section class="panel">${U.empty('Opening your goals', 'One moment.')}</section>`; }
    const gs = items().filter((x) => x.kind === 'goal' && x.status !== 'archived');
    return `${U.title('Goals', 'Set the quarter here. Progress fills in from HighLevel and YouTube once they are connected, and you can update it by hand until then.', `<button class="btn primary" data-action="goal-add">Add a goal</button>`)}
    <section class="panel"><header><h2>This quarter</h2><span class="meta">${gs.length} goals · saved to your workspace</span></header>
      ${gs.length ? `<div class="rows">${gs.map((g) => { const m = g.meta || {}; const p = m.target ? ((+m.current || 0) / +m.target) : 0; return `<div class="row goal"><div class="grow"><div class="dh"><span class="t">${esc(g.text)}</span><span class="pill out">${m.target ? Math.round(p * 100) + '%' : 'No target'}</span></div>${bar(p)}<div class="s">${esc(String(m.current || 0))} of ${esc(String(m.target || U.MINUS))} ${esc(m.unit || '')}${g.due ? ' · by ' + fmt(g.due) : ''}</div></div><button class="btn sm" data-action="goal-update" data-id="${g.id}">Update</button><button class="btn sm ghost" data-action="mem-archive" data-id="${g.id}">Archive</button></div>`; }).join('')}</div>` : U.empty('No goals yet', 'Three to five goals a quarter is plenty. Tie each to a number you can read every week: revenue per stream, videos published, calls booked.', `<button class="btn primary" data-action="goal-add">Add your first goal</button>`)}
    </section>
    <div class="grid2" style="margin-top:var(--gap)"><section class="panel"><header><h2>Weekly review</h2></header><p class="muted">Every Sunday at 18:00 Jarvis drafts what went well, what slipped and next week\u2019s three priorities, from your connected sources and Memory. The first one arrives after your first full week with HighLevel connected.</p></section>
    <section class="panel"><header><h2>Freedom number</h2></header><p class="muted">The monthly profit that buys your time back. It needs revenue from HighLevel and your costs, so it switches on with the HighLevel connection.</p></section></div>`;
  };
  ACT.goal = (el) => {
    const G = goals(); const g = G.g.find((x) => x.id === el.dataset.id);
    U.drawer(`<div><p class="meta">Q4 goal · watched by ${esc(g.agent)}</p><h2>${esc(g.name)}</h2></div>
      <div class="kv4"><div><span>Now</span><b>${gv(g, g.cur)}</b></div><div><span>Target</span><b>${gv(g, g.target)}</b></div><div><span>Progress</span><b>${Math.round(Math.max(0, g.p) * 100)}%</b></div><div><span>Quarter gone</span><b>${Math.round(G.elapsed * 100)}%</b></div></div>
      <div class="dsec"><h3>Status</h3><p>${stPill(g.st)}</p></div>
      <div class="dsec"><h3>Next move</h3><p>${esc(g.next)}</p></div>
      <div class="dsec"><h3>Read from</h3><p class="muted">${g.unit === 'eur' ? 'HighLevel payments and subscriptions, plus affiliate dashboards, tagged by stream.' : g.unit === 'pct' ? 'The Brain coverage score.' : 'YouTube Data API, your own channel.'}</p></div>
      <div class="actions"><button class="btn primary" data-action="go" data-go="${g.unit === 'eur' ? 'revenue' : g.unit === 'pct' ? 'brain' : 'content'}">Open ${g.unit === 'eur' ? 'Revenue' : g.unit === 'pct' ? 'Brain' : 'Content'}</button></div>`, { label: 'Goal' });
  };
  ACT['goal-approve'] = () => { const R = review(goals()); VS.prio = VS.prio || R.prio; VS.reviewDone = true; St.log('Approved weekly review', 'Week 44, three priorities set', 'goals'); U.toast('Review saved. Jarvis now leads with your three priorities.'); window.App.render(true); };
  ACT['goal-edit-prio'] = async () => { const cur = VS.prio || review(goals()).prio; const r = await U.dialog({ title: 'Next week\u2019s three', fields: cur.map((p, i) => ({ name: 'p' + i, label: 'Priority ' + (i + 1), value: p, required: true })), ok: 'Save priorities' }); if (!r) return; VS.prio = [r.p0, r.p1, r.p2]; U.toast('Priorities updated'); window.App.render(true); };
  ACT['goal-freedom'] = async () => { const r = await U.dialog({ title: 'Freedom number', body: 'The monthly profit that would let you work only on what you choose.', fields: [{ name: 'v', label: 'Euros a month', value: String(VS.freedom), required: true }], ok: 'Save' }); if (!r) return; const v = Math.round(+String(r.v).replace(/[^\d.]/g, '')); if (v > 0) { VS.freedom = v; U.toast('Freedom number set to ' + eur(v)); window.App.render(true); } };
  ACT['goal-add'] = async () => {
    const r = await U.dialog({ title: 'Add a goal', fields: [{ name: 'text', label: 'Goal', required: true, placeholder: 'Software revenue a month' }, { name: 'target', label: 'Target number', required: true, placeholder: '15000' }, { name: 'current', label: 'Where you are now', placeholder: '0' }, { name: 'unit', label: 'Unit', placeholder: 'euros, videos, calls' }, { name: 'by', label: 'By', type: 'select', options: [['End of quarter', 'End of quarter'], ['End of month', 'End of month'], ['End of year', 'End of year']], value: 'End of quarter' }], ok: 'Add goal' });
    if (!r) return; const d = new Date(todayMs()); const y = d.getUTCFullYear(), mo = d.getUTCMonth();
    const due = r.by === 'End of month' ? iso(Date.UTC(y, mo + 1, 0)) : r.by === 'End of year' ? iso(Date.UTC(y, 11, 31)) : iso(Date.UTC(y, Math.floor(mo / 3) * 3 + 3, 0));
    try { LM.items.unshift(await Auth.memory.add(ctx().ws.id, { kind: 'goal', text: r.text, due, meta: { target: +String(r.target).replace(/[^\d.]/g, '') || 0, current: +String(r.current || 0).replace(/[^\d.]/g, '') || 0, unit: r.unit || '' } })); U.toast('Goal added'); } catch (e) { U.toast(Auth.friendly(e)); }
    window.App.render(true);
  };
  ACT['goal-update'] = async (el) => {
    const g = LM.items.find((x) => x.id === el.dataset.id); if (!g) return;
    const r = await U.dialog({ title: g.text, fields: [{ name: 'current', label: 'Where you are now', value: String((g.meta || {}).current || 0), required: true }], ok: 'Update' });
    if (!r) return; g.meta = { ...(g.meta || {}), current: +String(r.current).replace(/[^\d.]/g, '') || 0 };
    try { await Auth.memory.update(g.id, { meta: g.meta }); U.toast('Updated'); } catch (e) { U.toast(Auth.friendly(e)); } window.App.render(true);
  };

  window.OSGoals = { goals, review, bar, stPill, LM, items, loadingLive, todayMs, iso, ms, fmt, daysTo, DEMO_TODAY };

  /* ---------- Connections ---------- */
  // [id, name, category, reads, writes, method, agents, demoStatus, liveProvider]
  const CX = [
    ['highlevel', 'HighLevel', 'Core', 'Contacts, payments, subscriptions, calendars, pipelines, funnels and courses. Never conversations', 'Notes, tags, opportunity stage and approved emails or SMS, sent from HighLevel', 'Official HighLevel MCP server or Private Integration Token', 'Every agent', 'on', 'highlevel'],
    ['hl-webhooks', 'HighLevel workflows', 'Core', 'Events you choose: call booked, payment failed, form submitted, tag added', 'Nothing. Workflows call the OS, the OS answers with a draft', 'Webhook action in a HighLevel workflow', 'Routines', 'on', null],
    ['youtube', 'YouTube Data', 'Audience', 'Your videos, titles, descriptions and comments', 'Replies you approve', 'Google OAuth, read-only by default', 'Nightly Ideation, Comment Replier, Video Analyst', 'on', 'youtube'],
    ['yt-analytics', 'YouTube Analytics', 'Audience', 'Views, retention, traffic sources and subscribers per video', 'Nothing', 'Google OAuth, Analytics scope', 'Brand, Outcome Tracker', 'on', 'youtube'],
    ['youtube-2', 'Second YouTube channel', 'Audience', 'A second channel you own: its videos, titles, descriptions and comments', 'Replies you approve', 'Google OAuth, read-only by default', 'Nightly Ideation, Comment Replier, Video Analyst', 'off', 'youtube-2'],
    ['instagram', 'Instagram', 'Audience', 'Followers, reach, impressions, engagement, audience and your latest posts', 'Nothing. Posting stays in HighLevel Social Planner', 'Through HighLevel Social Planner, no Meta app needed', 'Social Writer', 'off', null],
    ['linkedin', 'LinkedIn', 'Audience', 'Post impressions and follower growth', 'Nothing. Posting stays in HighLevel Social Planner', 'LinkedIn OAuth', 'Social Writer', 'off', null],
    ['x', 'X', 'Audience', 'Post impressions, replies and profile visits', 'Nothing', 'X API key', 'Social Writer', 'off', null],
    ['tiktok', 'TikTok', 'Audience', 'Video views and follower growth', 'Nothing', 'TikTok OAuth', 'Social Writer', 'off', null],
    ['gcal', 'Google Calendar', 'Context', 'Upcoming calls and free focus time', 'Focus blocks you approve', 'Google OAuth', 'Dossier, Briefing', 'on', 'calendar'],
    ['gdrive', 'Google Drive and Docs', 'Context', 'Docs you point it at: offer docs, scripts, SOPs', 'New docs in one folder', 'Google OAuth, chosen folders only', 'Brain', 'on', null],
    ['notion', 'Notion', 'Context', 'Pages and databases you share with the integration', 'Nothing', 'Notion integration token', 'Brain', 'off', null],
    ['slack', 'Slack', 'Context', 'Channels you invite the bot to', 'The morning brief and approval cards', 'Slack app', 'Briefing', 'off', 'slack'],
    ['zoom', 'Zoom', 'Meetings', 'Cloud recordings and transcripts', 'Nothing', 'Zoom OAuth', 'Call Coach, Memory', 'on', 'zoom'],
    ['meet', 'Google Meet', 'Meetings', 'Transcripts saved to Drive', 'Nothing', 'Google OAuth', 'Call Coach, Memory', 'off', null],
    ['fathom', 'Fathom', 'Meetings', 'Call summaries, action items and transcripts', 'Nothing', 'Fathom API key', 'Call Coach, Memory', 'off', null],
    ['granola', 'Granola', 'Meetings', 'Meeting notes and transcripts', 'Nothing', 'Granola MCP', 'Memory', 'off', null],
    ['stripe', 'Stripe', 'Money', 'Payments outside HighLevel, refunds and disputes', 'Nothing', 'Restricted key, read-only', 'Outcome Tracker', 'on', 'stripe'],
    ['paypal', 'PayPal', 'Money', 'Payments and refunds', 'Nothing', 'PayPal REST app, read-only', 'Outcome Tracker', 'off', null],
    ['affiliate', 'Affiliate dashboards', 'Money', 'HighLevel affiliate and partner commissions by SubID', 'Nothing', 'Partner exports or API where offered', 'Outcome Tracker, Data Fixer', 'on', 'affiliate'],
    ['bank', 'Bank feed', 'Money', 'Balances and transactions for the profit view', 'Nothing. Never moves money', 'Open banking (PSD2), read-only consent', 'Money review', 'off', null],
    ['accounting', 'Accounting', 'Money', 'Expenses and invoices from Xero, Procountor or similar', 'Nothing', 'Accounting OAuth', 'Money review', 'off', null],
    ['meta-ads', 'Meta Ads', 'Ads and web', 'Spend, cost per lead and creative results', 'Nothing. You change ads in Ads Manager', 'Meta Marketing API', 'Funnel Builder', 'off', null],
    ['google-ads', 'Google Ads', 'Ads and web', 'Spend and conversions per campaign', 'Nothing', 'Google Ads API', 'Funnel Builder', 'off', null],
    ['ga4', 'Google Analytics 4', 'Ads and web', 'Sessions and conversions on pages outside HighLevel', 'Nothing', 'Google OAuth', 'Funnel Builder', 'off', null],
    ['gsc', 'Search Console', 'Ads and web', 'Search queries that bring people to your site', 'Nothing', 'Google OAuth', 'Trend Watcher', 'off', null],
    ['apify', 'Apify', 'Research', 'Competitor channels, outlier videos and public comments', 'Nothing', 'Apify API token', 'Trend Watcher, Research', 'on', 'apify'],
    ['perplexity', 'Perplexity', 'Research', 'One key for AI Chat on every model, live web research, image search and web watches', 'Nothing', 'API key', 'AI Chat, Jarvis, Funnel Agent, Newsfeed', 'off', null],
    ['tella', 'Tella', 'Research', 'Recordings and transcripts of videos you film', 'Nothing', 'Tella API', 'Repurposer', 'off', 'tella'],
    ['telegram', 'Telegram', 'Channels', 'Voice notes and replies you send to Jarvis', 'The morning brief, approval buttons and alerts', 'Private bot, your chat only', 'Briefing, Jarvis', 'on', 'telegram'],
    ['grok-bot', 'Grok Bot', 'Channels', 'Reports back through the Founders AI OS connector when a task is done', 'Only tasks you confirm, sent to your own Grok Bot routine', 'Routine webhook URL and key', 'AI Team: Automations, Support, QA, Accounting', 'off', null],
    ['email-digest', 'Email digest', 'Channels', 'Nothing', 'A Friday digest to your own address', 'Resend API key', 'Briefing', 'on', null],
    ['github', 'GitHub', 'Publishing', 'Your account name and the repositories the Funnel Agent creates', 'One private repository per sales page, and every new version', 'Personal access token, repo scope', 'Funnel Agent', 'off', null],
    ['vercel', 'Vercel', 'Publishing', 'Deploy status of the pages it publishes', 'A Vercel project per sales page, published to a live link', 'Vercel access token', 'Funnel Agent', 'off', null],
    ['claude', 'Claude', 'AI models', 'The prompts agents send', 'Nothing', 'Anthropic API key', 'Every drafting agent', 'on', null],
    ['openai', 'OpenAI', 'AI models', 'Writing when Claude is busy, and embeddings for Memory search', 'Nothing', 'OpenAI API key', 'Every drafting agent, Memory', 'off', null],
    ['openrouter', 'OpenRouter', 'AI models', 'Nothing', 'Nothing. Draws the hero, story and offer images for sales pages', 'OpenRouter API key', 'Funnel Agent graphics', 'off', null],
    ['elevenlabs', 'ElevenLabs', 'AI models', 'Your voices and character balance', 'Nothing. Runs Jarvis live on Eleven Realtime and speaks briefs in the voice you pick', 'Your own ElevenLabs API key', 'Jarvis live voice, spoken briefs', 'off', null],
  ];
  const CATS = ['Core', 'Audience', 'Context', 'Meetings', 'Money', 'Ads and web', 'Research', 'Publishing', 'Channels', 'AI models'];
  VS.cxCat = VS.cxCat || 'all';
  // Which stored connection answers for a row. YouTube Analytics rides on YouTube.
  const cxProv = (id) => ({ 'yt-analytics': 'youtube' })[id] || id;
  const cxStatus = (c) => {
    if (!isLive()) return c[7] === 'on' ? 'sample' : 'available';
    const x = ctx();
    const row = x.conns.find((r) => r.provider === cxProv(c[0])); return row ? row.status : 'not_connected';
  };
  const cxPill = (s) => s === 'sample' ? '<span class="pill acc">Sample data</span>' : s === 'connected' ? '<span class="pill pos">Connected</span>' : s === 'error' ? '<span class="pill neg">Needs a fix</span>' : s === 'pending' ? '<span class="pill warn">Pending</span>' : s === 'available' ? '<span class="pill out">Available</span>' : '<span class="pill out">Not connected</span>';
  const MCP_URL = (location.protocol.startsWith('http') ? location.origin : 'https://your-app.vercel.app') + '/api/mcp';
  // One page: biggest categories first, every tool as a card with its mark, a connect button and a switch.
  const ORDER = ['Core', 'AI models', 'Audience', 'Money', 'Meetings', 'Context', 'Channels', 'Research', 'Publishing', 'Ads and web'];
  const CAT_LINE = {
    'Core': 'HighLevel is the system of record. Everything else sits around it.',
    'AI models': 'Your own keys for writing, voice and images.',
    'Audience': 'Channels and numbers your content and ideas learn from.',
    'Money': 'Payments, commissions and the profit view. Read only.',
    'Meetings': 'Calls and transcripts for coaching, memory and follow-ups.',
    'Context': 'Calendars, docs and notes your agents can read.',
    'Channels': 'Where the brief reaches you, and where Grok Bot reports back.',
    'Research': 'Competitors, outliers and recordings for new ideas.',
    'Publishing': 'Where the Funnel Agent ships sales pages.',
    'Ads and web': 'Ad spend and traffic outside HighLevel.',
  };
  const DESC = {
    highlevel: 'Contacts, pipelines, payments, calendars, funnels and courses.', 'hl-webhooks': 'Workflow events that start routines and drafts.',
    youtube: 'Your videos, titles and comments.', 'yt-analytics': 'Views, retention and traffic per video.', 'youtube-2': 'A second channel you own.',
    instagram: 'Reach, engagement and your latest posts.', linkedin: 'Post impressions and follower growth.', x: 'Impressions, replies and profile visits.', tiktok: 'Video views and follower growth.',
    gcal: 'Upcoming calls and free focus time.', gdrive: 'Offer docs, scripts and SOPs you choose.', notion: 'Pages and databases you share.', slack: 'The morning brief and approval cards.',
    zoom: 'Cloud recordings and transcripts.', meet: 'Transcripts saved to Drive.', fathom: 'Call summaries and action items.', granola: 'Meeting notes and transcripts.',
    stripe: 'Payments, refunds and disputes outside HighLevel.', paypal: 'Payments and refunds.', affiliate: 'Partner commissions by SubID.', bank: 'Balances and transactions, never moves money.', accounting: 'Expenses and invoices from Xero or similar.',
    'meta-ads': 'Spend, cost per lead and creative results.', 'google-ads': 'Spend and conversions per campaign.', ga4: 'Sessions and conversions on outside pages.', gsc: 'Search queries that find your site.',
    apify: 'Competitor channels and outlier videos.', perplexity: 'Every AI model in one key, live web research and web watches.', tella: 'Recordings and transcripts you film.',
    telegram: 'Jarvis and the brief on your phone.', 'grok-bot': 'Hands outside work to your Grok Bot routine.', 'email-digest': 'A Friday digest to your own inbox.',
    github: 'A private repository per sales page.', vercel: 'Publishes sales pages to a live link.',
    claude: 'Drafting for every agent.', openai: 'Backup writing and Memory search.', openrouter: 'Hero, story and offer images.', elevenlabs: 'Jarvis live voice and spoken briefs.',
  };
  VS.cxShow = VS.cxShow || 'all'; VS.cxQ = VS.cxQ || '';
  const isOn = (s) => s === 'sample' || s === 'connected' || s === 'error';
  const cxLine = (c, s) => {
    if (s === 'sample') return 'Sample data in the demo';
    if (s === 'error') return 'Needs a fix';
    if (s === 'pending') return 'Finishing sign-in';
    if (s === 'connected') { const r = (ctx().conns || []).find((x) => x.provider === cxProv(c[0])); const m = (r && r.meta) || {}; const ago = window.Conn && m.last_sync_at ? window.Conn.ago(m.last_sync_at) : ''; return 'Connected' + (r && r.account_label ? ' as ' + r.account_label : '') + (ago ? ' · synced ' + ago : ''); }
    return 'Not connected';
  };
  const hay = (...xs) => xs.join(' ').toLowerCase().replace(/"/g, '');
  const card = (c) => {
    const s = cxStatus(c); const on = isOn(s); const L = window.BrandLogos;
    return `<article class="cxc${s === 'error' ? ' is-err' : ''}" data-cxcard data-on="${on}" data-q="${esc(hay(c[1], c[2], DESC[c[0]] || '', c[3]))}">
      <div class="cxc-top" data-action="cx" data-id="${c[0]}">${L ? L.tile(c[0], c[1]) : ''}<h3>${esc(c[1])}</h3><p>${esc(DESC[c[0]] || c[3])}</p><span class="cxc-st${on ? ' is-on' : ''}">${esc(cxLine(c, s))}</span></div>
      <div class="cxc-foot"><button class="btn sm" data-action="cx" data-id="${c[0]}">${icon(on ? 'settings' : 'link')}${on ? 'Manage' : 'Connect'}</button>
        <input type="checkbox" class="switch" data-cxtoggle="${c[0]}" ${on ? 'checked' : ''} aria-label="${esc(c[1])} ${on ? 'on' : 'off'}"></div></article>`;
  };
  const customCard = (r) => {
    const on = !!r.enabled; const mcp = r.kind === 'mcp'; const L = window.BrandLogos;
    return `<article class="cxc" data-cxcard data-on="${on}" data-q="${esc(hay(r.name, mcp ? 'mcp server custom' : 'skill guidance custom', r.meta.endpoint || r.meta.homepage || ''))}">
      <div class="cxc-top" data-action="cc-open" data-id="${r.id}">${L ? L.tile('custom-' + r.id, r.name) : ''}<h3>${esc(r.name)}</h3><p>${mcp ? esc(r.meta.endpoint || 'MCP server') + ` · ${(r.meta.catalog && r.meta.catalog.tools || []).length} tools` : 'Design guidance for AI Chat and the Funnel Agent'}</p><span class="cxc-st${on ? ' is-on' : ''}">${on ? (mcp ? 'Connected' : 'Guidance added') : 'Paused'}</span></div>
      <div class="cxc-foot"><button class="btn sm" data-action="cc-open" data-id="${r.id}">${icon('settings')}Manage</button>
        <input type="checkbox" class="switch" data-cctoggle="${r.id}" ${on ? 'checked' : ''} aria-label="${esc(r.name)} ${on ? 'on' : 'off'}"></div></article>`;
  };
  V.connect = () => {
    const live = isLive(); const CC = window.CustomConnections;
    const custom = CC && live ? (CC.load(), CC.state().rows || []) : [];
    const ccState = CC && live ? CC.state() : null;
    const show = VS.cxShow; const q = VS.cxQ.trim().toLowerCase();
    const keep = (on, h) => (show === 'all' || (show === 'on') === on) && (!q || h.includes(q));
    const counts = { all: CX.length + custom.length, on: CX.filter((c) => isOn(cxStatus(c))).length + custom.filter((r) => r.enabled).length };
    counts.off = counts.all - counts.on;
    const sections = ORDER.map((cat) => {
      const rows = CX.filter((c) => c[2] === cat && keep(isOn(cxStatus(c)), hay(c[1], c[2], DESC[c[0]] || '', c[3])));
      return rows.length ? `<section class="cxs" data-cxsec><header><h2>${esc(cat)}</h2><p class="muted">${esc(CAT_LINE[cat] || '')}</p></header><div class="cxg">${rows.map(card).join('')}</div></section>` : '';
    }).join('');
    const customRows = custom.filter((r) => keep(!!r.enabled, hay(r.name, r.kind === 'mcp' ? 'mcp server custom' : 'skill guidance custom', r.meta.endpoint || r.meta.homepage || '')));
    const addCard = show !== 'on' && (!q || 'custom connection mcp server skill add'.includes(q) || q.length < 2) ? `<button class="cxc cxc-add" data-action="cx-custom"><span class="cxl is-add" aria-hidden="true">${icon('plus')}</span><h3>Custom connection</h3><p>Any MCP server, or design guidance as a skill.</p><span class="cxc-st">Add your own</span></button>` : '';
    const customSec = customRows.length || addCard ? `<section class="cxs" data-cxsec><header><h2>Custom</h2><p class="muted">Your own MCP servers and skills. You review every request before it runs.</p></header>
      ${ccState && ccState.error ? `<p class="auth-msg">${esc(ccState.error)} <button class="btn sm ghost" data-action="cc-retry">Try again</button></p>` : ''}
      <div class="cxg">${customRows.map(customCard).join('')}${addCard}</div></section>` : '';
    const none = !sections && !customSec ? `<p class="muted cxs-none">${q ? 'Nothing matches “' + esc(VS.cxQ) + '”.' : show === 'on' ? 'Nothing is connected yet.' : 'Everything is connected.'}</p>` : '';
    return `${U.title('Connections', live ? 'Connect your tools and give your agents the context they need.' : 'Demo workspace. Sample feeds only, no keys stored.', `<button class="btn primary" data-action="cx-custom">${icon('plus')}Custom connection</button>`)}
      <div class="cxbar"><div class="segmented" role="group" aria-label="Show">${[['all', 'All connections'], ['on', 'Connected'], ['off', 'Disconnected']].map(([v, l]) => `<button data-action="seg" data-seg="cxShow" data-v="${v}" aria-pressed="${show === v}">${l} <span class="cxn">${counts[v]}</span></button>`).join('')}</div>
        <label class="cxsearch">${icon('search')}<input type="search" data-cxq placeholder="Search connections" value="${esc(VS.cxQ)}" aria-label="Search connections"></label></div>
      <div class="cxwrap">${sections}${customSec}${none}<p class="cxs-none" data-cxnone hidden>Nothing matches.</p>
      ${CC && CC.library ? CC.library() : ''}
      <section class="cxs cx-other"><header><h2>Use the OS from other AI</h2><p class="muted">Claude, Codex and any MCP client can read your brief, Memory and goals, and send drafts to the Newsfeed.</p></header>
        <div class="code-row"><code>${MCP_URL}</code><button class="btn sm" data-action="mcp-copy">Copy</button><a class="btn sm ghost" href="#mcp">Set up AI access</a></div></section></div>`;
  };
  V.connect.live = () => V.connect();
  // Search filters in place so typing keeps focus.
  document.addEventListener('input', (e) => {
    if (!e.target.matches || !e.target.matches('[data-cxq]')) return;
    VS.cxQ = e.target.value; const q = VS.cxQ.trim().toLowerCase(); let any = false;
    document.querySelectorAll('[data-cxsec]').forEach((sec) => { let n = 0; sec.querySelectorAll('[data-cxcard]').forEach((c) => { const hit = !q || c.dataset.q.includes(q); c.hidden = !hit; if (hit) n++; }); const add = sec.querySelector('.cxc-add'); if (add) { add.hidden = !!q && q.length >= 2 && !'custom connection mcp server skill add'.includes(q); if (!add.hidden) n++; } sec.hidden = !n; if (n) any = true; });
    const none = document.querySelector('[data-cxnone]'); if (none) none.hidden = any;
  });
  // The switch is a shortcut: on opens the sign-in, off disconnects after a yes.
  const SPECIAL_OFF = ['highlevel', 'openai', 'claude', 'apify', 'grok-bot', 'affiliate'];
  document.addEventListener('change', async (e) => {
    const t = e.target; if (!t.matches) return;
    if (t.matches('[data-cctoggle]')) {
      const want = t.checked; t.checked = !want;
      if (!isLive()) return U.toast('Custom connections save in your private workspace.');
      try { t.disabled = true; await window.CustomConnections.setEnabled(t.dataset.cctoggle, want); } catch (err) { U.toast(err.message); } finally { t.disabled = false; }
      return;
    }
    if (!t.matches('[data-cxtoggle]')) return;
    const id = t.dataset.cxtoggle; const c = CX.find((x) => x[0] === id); const want = t.checked; t.checked = !want;
    if (!isLive()) return U.toast(want ? 'Connections go live in your private workspace, never in the demo.' : 'Demo feeds stay on so the sample data makes sense.');
    if (want || SPECIAL_OFF.includes(id) || !window.Conn) return ACT.cx({ dataset: { id } });
    const prov = cxProv(id);
    const yes = await U.dialog({ title: 'Disconnect ' + c[1] + '?', body: (prov !== id ? 'This also disconnects ' + ((CX.find((x) => x[0] === prov) || [])[1] || prov) + '. ' : '') + 'Its key is deleted and agents stop reading it. You can connect again any time.', ok: 'Disconnect', danger: true });
    if (!yes) return;
    try { t.disabled = true; await window.Conn.api('disconnect', { provider: prov }); await window.App.reloadConns(); window.App.render(); U.toast(c[1] + ' disconnected'); }
    catch (err) { t.disabled = false; U.toast(err.message); }
  });
  ACT['cx-custom'] = () => {
    U.drawer(`<div><p class="meta">Connections</p><h2>Custom connection</h2><p class="muted" style="margin-top:6px">Bring in a tool the list does not cover, or give your AI design guidance.</p></div>
      <div class="cx-pick">
        <button class="cx-pick-o" data-action="cc-add">${icon('link')}<span><b>MCP server</b><span class="meta">Any public HTTPS MCP endpoint, with a token or key header if it needs one. Its tools show up for AI Chat and the AI Team, and nothing runs until you approve the exact inputs.</span></span></button>
        <button class="cx-pick-o" data-action="cc-import">${icon('file')}<span><b>Skill from a file</b><span class="meta">Import Markdown guidance your AI follows for design questions and future Funnel Agent runs.</span></span></button>
        <button class="cx-pick-o" data-action="cc-preset" data-id="impeccable">${icon('sparkle')}<span><b>Impeccable</b><span class="meta">Design critique, typography and interface finishing, from impeccable.style.</span></span></button>
        <button class="cx-pick-o" data-action="cc-preset" data-id="taste">${icon('sparkle')}<span><b>Taste Skill</b><span class="meta">Art direction, composition and page guidance, from tasteskill.dev.</span></span></button>
      </div>
      <p class="meta" style="margin-top:6px">Keys are encrypted on the server. A custom server never gets your Brain, keys or programs.</p>`, { label: 'Custom connection' });
  };
  function briefData() {
    const ap = St.s.approvals; const up = SEED.upcoming.filter((u) => u.day === St.T); const r = St.range(1).cur; const m = demoMemory();
    const late = m.filter((x) => x.kind === 'commitment' && x.status === 'open' && x.due && daysTo(x.due) <= 0).length;
    return { rev: St.total(St.range(7).cur), calls: up.length, first: up[0] ? up[0].time + ' ' + St.contactById[up[0].contactId].first : '', ap: ap.length, top: ap[0] ? ap[0].title : '', late, y: St.total(r) };
  }
  function phone(b) {
    const msgs = b ? [`Good morning. ${eur(b.rev)} came in over the last 7 days.`, `${b.calls} calls today${b.first ? ', first at ' + b.first : ''}. Dossiers are ready.`, `${b.late} promises are due today or late. ${b.ap} drafts wait for you, starting with "${b.top}".`] : ['Good morning. HighLevel is not connected yet, so this is all I can say.', 'Connect it and this message carries your real numbers every day at 07:00.'];
    return `<div class="phone" aria-label="Telegram preview"><div class="ph-top"><span class="ph-av">${'<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 1.5C12.8 7.7 16.3 11.2 22.5 12C16.3 12.8 12.8 16.3 12 22.5C11.2 16.3 7.7 12.8 1.5 12C7.7 11.2 11.2 7.7 12 1.5Z" fill="currentColor"/></svg>'}</span><div><b>Jarvis</b><div class="meta">bot · 07:00</div></div></div>
      <div class="ph-body">${msgs.map((m) => `<p class="ph-msg">${esc(m)}</p>`).join('')}${b ? `<div class="ph-btns"><span>Open approvals</span><span>Hold drafting</span><span>Play as voice</span></div>` : ''}</div></div>
      <p class="meta" style="margin-top:10px">Telegram for the brief and one-tap approvals. Slack works the same way. Client conversations stay in HighLevel.</p>`;
  }
  ACT.cx = (el) => {
    if (el.dataset.id === 'apify' && window.ACT['apify-open']) return window.ACT['apify-open']();
    if (el.dataset.id === 'highlevel' && window.ACT['hl-conn']) return window.ACT['hl-conn']();
    if (el.dataset.id === 'openai' && window.ACT['ai-conn']) return window.ACT['ai-conn']();
    if (el.dataset.id === 'grok-bot' && window.ACT['grok-conn']) return window.ACT['grok-conn']();
    if (isLive() && window.Conn) { const c0 = CX.find((x) => x[0] === el.dataset.id); return window.Conn.open(cxProv(el.dataset.id), c0); }
    const c = CX.find((x) => x[0] === el.dataset.id); const s = cxStatus(c); const live = isLive();
    const steps = /MCP/.test(c[5]) ? ['Open HighLevel and go to Settings, then Private Integrations or the MCP server page.', 'Choose the sub-accounts the OS may read.', 'Paste the token here once. It is stored server side, never in the browser.', 'The OS runs a first read and shows what it found before any agent uses it.'] : /OAuth/.test(c[5]) ? ['Click Connect and sign in with the account you use for ' + c[1] + '.', 'Approve the read scopes shown. Write scopes are asked for separately, later.', 'The first read runs in the background and the Data page shows its health.'] : /Webhook/.test(c[5]) ? ['In a HighLevel workflow, add a Webhook action.', 'Paste your workspace webhook URL and pick the event.', 'The matching routine runs and its draft lands in the Newsfeed.'] : ['Create a key in ' + c[1] + ' with the narrowest scope it offers.', 'Paste it here once. It is stored server side, never in the browser.', 'Test it, then turn on the agents that use it.'];
    U.drawer(`<div><p class="meta">${esc(c[2])} · ${esc(c[5])}</p><h2>${esc(c[1])}</h2><p style="margin-top:8px">${cxPill(s)}</p></div>
      <div class="dsec"><h3>Reads</h3><p>${esc(c[3])}</p></div>
      <div class="dsec"><h3>Writes</h3><p>${esc(c[4])}</p></div>
      <div class="dsec"><h3>Used by</h3><p class="muted">${esc(c[6])}</p></div>
      <div class="dsec"><h3>How it connects</h3><ol class="steps">${steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <div class="actions">${live ? `<button class="btn primary" data-action="cx-request" data-id="${c[0]}">Connect</button>` : s === 'sample' ? `<button class="btn" data-action="cx-test" data-id="${c[0]}">Test sample feed</button>` : `<button class="btn" data-action="cx-request" data-id="${c[0]}">Connect</button>`}</div>`, { label: c[1] });
  };
  ACT['cx-test'] = (el) => { el.disabled = true; el.innerHTML = U.spin + 'Testing'; setTimeout(() => { el.disabled = false; el.textContent = 'Test sample feed'; U.toast('Sample feed responds. Add a key in your private workspace to go live.'); }, 800); };
  ACT['cx-request'] = () => U.toast('Connections go live in your private workspace, never in the demo. Switch workspace from the top bar.');
  ACT['mcp-copy'] = () => U.copy(MCP_URL);

  /* ---------- Routines ---------- */
  // [id, name, trigger type, trigger, steps, output, tier, agent ids, runs30, cost30]
  const RT = [
    ['r1', 'Morning cycle', 'Schedule', 'Every day at 07:00', ['Data Monitor checks every feed', 'Data Fixer repairs what it can', 'Enricher fills missing contact fields', 'Client Health scores software clients', 'Follow-up drafts for quiet deals', 'Dossiers for today\u2019s calls', 'Briefing writes the brief'], 'Brief on Jarvis and Telegram', 'auto', 30, 6.4],
    ['r2', 'After every sales call', 'HighLevel event', 'Appointment marked showed, recording ready in Zoom', ['Call Coach scores the call', 'Promises and decisions go to Memory', 'Follow-up email drafted in your voice'], 'Follow-up in the Newsfeed', 'ask', 48, 4.1],
    ['r3', 'Before every call', 'Calendar', '2 hours before a booked call', ['Dossier reads HighLevel, Gmail and Memory', 'Lists open promises with that person', 'Suggests three questions'], 'Dossier on the call', 'auto', 52, 2.2],
    ['r4', 'Outlier video', 'YouTube', 'A video passes 2x your median views in 48 hours', ['Shorts Cutter picks four shorts from the transcript', 'Newsletter Writer drafts an email from the same idea', 'Nightly Ideation adds two follow-up ideas'], 'Drafts in the Newsfeed', 'batch', 3, 1.9],
    ['r5', 'Buying-intent comment', 'YouTube', 'A comment asks about price, setup or done-for-you', ['Comment Miner matches the person to a HighLevel contact', 'Tags them warm in HighLevel', 'Drafts a reply'], 'Tag now, reply in the Newsfeed', 'batch', 21, 0.8],
    ['r6', 'Failed payment', 'HighLevel event', 'Payment failed on a subscription', ['Client Health checks usage and history', 'Drafts a personal note, never a dunning template'], 'Note in the Newsfeed', 'ask', 4, 0.3],
    ['r7', 'Deal gone quiet', 'Schedule', 'Every 6 hours, by stage silence limit', ['Follow-up reads the last thread and notes', 'Drafts a short human nudge'], 'Nudge in the Newsfeed', 'ask', 120, 2.6],
    ['r8', 'Nightly ideation', 'Schedule', 'Every night at 02:00', ['Nightly Ideation reads outliers, comments, calls and revenue', 'Scores ten ideas against your rubric'], 'Ideas on the Content board', 'auto', 30, 3.8],
    ['r9', 'Weekly review', 'Schedule', 'Sunday at 18:00', ['Briefing reads the week across streams', 'Pulls slipped promises and decisions due', 'Proposes three priorities'], 'Review on Goals', 'batch', 4, 0.6],
    ['r10', 'Monthly money review', 'Schedule', '1st of the month at 09:00', ['Outcome Tracker closes the month by stream', 'Totals tool and model spend', 'Updates the freedom number'], 'Report on Goals', 'auto', 1, 0.4],
    ['r11', 'Decision check-in', 'Memory', 'A logged decision reaches its review date', ['Reads what changed since the decision', 'Asks you for the outcome in the brief'], 'Question in the brief', 'auto', 6, 0.1],
    ['r12', 'Missing SubID', 'Data', 'An affiliate link has no SubID', ['Data Fixer matches it to the right video', 'Writes the corrected link list'], 'Fix log on Data', 'auto', 9, 0.2],
  ];
  const TIER = { auto: ['Runs on its own', 'pos'], batch: ['Daily batch review', 'acc'], ask: ['Always asks first', 'warn'] };
  VS.rtOff = VS.rtOff || {};
  VS.cap = VS.cap || 60;
  V.routines = () => {
    const t = St.agentTotals();
    const used = t.spent / VS.cap;
    const active = RT.filter((r) => !VS.rtOff[r[0]]).length;
    return `${U.title('Routines', 'What the OS does on its own, when, and how much it may do without you. Sending, sequences and pipelines still run in HighLevel workflows.')}
    ${U.kpis([{ label: 'Routines on', value: active + ' of ' + RT.length, delta: 'Schedules and events' }, { label: 'Runs, 30 days', value: int(St.sum(RT, (r) => r[8])), delta: 'Across all routines' }, { label: 'Model spend this month', value: U.eur2(t.spent), delta: Math.round(used * 100) + '% of the ' + eur(VS.cap) + ' cap' }, { label: 'Always ask first', value: RT.filter((r) => r[6] === 'ask').length, delta: 'Anything that reaches a person' }])}
    <div class="layout" style="margin-top:var(--gap)"><section class="panel"><header><h2>Routines</h2><span class="meta">Trigger, steps, then where the result goes</span></header><div class="rows">
      ${RT.map((r) => `<div class="row click" data-action="rt" data-id="${r[0]}" tabindex="0" role="button"><span class="dot ${VS.rtOff[r[0]] ? 'off' : ''}"></span><div class="grow"><div class="t">${esc(r[1])}</div><div class="s">${esc(r[2])} · ${esc(r[3])}</div></div><span class="pill ${TIER[r[6]][1]}">${TIER[r[6]][0]}</span><span class="pill out rt-out">${esc(r[5])}</span></div>`).join('')}
    </div></section>
    <aside class="rail"><h2 class="out">How much it may do alone</h2><section class="panel tight"><div class="rows tiers">
      <div class="row"><span class="pill pos">Runs on its own</span><div class="grow"><div class="s wrap">Reading, scoring, tagging, summaries and fixes that can be undone.</div></div></div>
      <div class="row"><span class="pill acc">Daily batch</span><div class="grow"><div class="s wrap">Content drafts and replies. One review a day clears them together.</div></div></div>
      <div class="row"><span class="pill warn">Always asks</span><div class="grow"><div class="s wrap">Anything a client sees, prices, offers, public posts and money.</div></div></div>
    </div></section>
    <h2 class="out">Model budget</h2><section class="panel tight"><div class="dh"><b>${U.eur2(t.spent)}</b><span class="meta">of ${eur(VS.cap)} this month</span></div>${bar(used)}
      <label class="row" style="margin-top:10px"><span class="grow">Monthly cap</span><select data-action="rt-cap" aria-label="Monthly cap">${[40, 60, 100, 150, 250].map((v) => `<option value="${v}" ${v === VS.cap ? 'selected' : ''}>${eur(v)}</option>`).join('')}</select></label>
      <p class="meta" style="margin-top:6px">At 80 percent Jarvis tells you in the brief. At the cap, drafting agents pause and watchers keep reading.</p>
      <div class="rows" style="margin-top:8px">${t.all.sort((a, b) => b.spent - a.spent).slice(0, 4).map((x) => `<div class="row"><div class="grow"><div class="t">${esc(x.a.name)}</div></div><span class="num">${U.eur2(x.spent)}</span></div>`).join('')}</div></section>
    </aside></div>`;
  };
  V.routines.live = () => `${U.title('Routines', 'What the OS does on its own, when, and how much it may do without you.')}
    <section class="panel lv-empty"><div class="lv-empty-head"><div><h2>Routines wait for their sources</h2><p class="muted">Each routine needs the source that triggers it. The morning cycle needs HighLevel, the after-call routine needs Zoom or Fathom, and outlier alerts need YouTube. They stay off until those are connected, and anything a client would see always waits for your approval.</p></div></div>
    <div class="rows">${RT.slice(0, 6).map((r) => `<div class="row"><span class="dot off"></span><div class="grow"><div class="t">${esc(r[1])}</div><div class="s">${esc(r[3])}</div></div><span class="pill ${TIER[r[6]][1]}">${TIER[r[6]][0]}</span></div>`).join('')}</div>
    <div class="lv-actions"><button class="btn primary" data-action="go" data-go="connect">Open connections</button>${ctx().demoId ? `<button class="btn" data-action="ws-switch" data-id="${ctx().demoId}" data-go="routines">See it in the Demo workspace</button>` : ''}</div></section>`;
  ACT.rt = (el) => {
    const r = RT.find((x) => x[0] === el.dataset.id); const off = !!VS.rtOff[r[0]];
    U.drawer(`<div><p class="meta">${esc(r[2])} routine</p><h2>${esc(r[1])}</h2></div>
      <div class="kv4"><div><span>Runs, 30 d</span><b>${r[8]}</b></div><div><span>Cost, 30 d</span><b>${U.eur2(r[9])}</b></div><div><span>Approval</span><b>${TIER[r[6]][0].replace('Always asks first', 'Asks first')}</b></div><div><span>Status</span><b>${off ? 'Off' : 'On'}</b></div></div>
      <div class="dsec"><h3>When</h3><p>${esc(r[3])}</p></div>
      <div class="dsec"><h3>Steps</h3><ol class="steps">${r[4].map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <div class="dsec"><h3>Result</h3><p>${esc(r[5])}</p></div>
      <div class="dsec"><h3>Approval</h3><select data-action="rt-tier" data-id="${r[0]}" aria-label="Approval tier">${Object.entries(TIER).map(([k, v]) => `<option value="${k}" ${k === r[6] ? 'selected' : ''} ${k === 'auto' && /Newsfeed/.test(r[5]) && r[6] === 'ask' ? 'disabled' : ''}>${v[0]}</option>`).join('')}</select><p class="meta" style="margin-top:6px">Routines that reach a client can not be set to run on their own.</p></div>
      <div class="actions"><button class="btn primary" data-action="rt-run" data-id="${r[0]}" ${off ? 'disabled' : ''}>${icon('play')}Run now</button><button class="btn" data-action="rt-toggle" data-id="${r[0]}">${off ? 'Turn on' : 'Turn off'}</button></div>`, { label: 'Routine' });
  };
  ACT['rt-toggle'] = (el) => { const id = el.dataset.id; VS.rtOff[id] = !VS.rtOff[id]; const r = RT.find((x) => x[0] === id); St.log((VS.rtOff[id] ? 'Turned off ' : 'Turned on ') + r[1], 'Routine', 'agent'); U.toast(r[1] + (VS.rtOff[id] ? ' is off' : ' is on')); window.App.render(true); ACT.rt({ dataset: { id } }); };
  ACT['rt-tier'] = (el) => { const r = RT.find((x) => x[0] === el.dataset.id); r[6] = el.value; U.toast(r[1] + ': ' + TIER[el.value][0].toLowerCase()); window.App.render(true); };
  ACT['rt-cap'] = (el) => { VS.cap = +el.value; U.toast('Monthly cap set to ' + eur(VS.cap)); window.App.render(true); };
  ACT['rt-run'] = (el) => {
    const r = RT.find((x) => x[0] === el.dataset.id); el.disabled = true; el.innerHTML = U.spin + 'Running';
    setTimeout(() => {
      r[8] += 1;
      if (r[0] === 'r1' && ACT['jv-cycle']) { U.closeDrawer(); location.hash = '#jarvis'; setTimeout(() => ACT['jv-cycle'](document.querySelector('[data-action="jv-cycle"]') || document.createElement('button')), 200); return; }
      if (r[0] === 'r7' && St.stalledDeals()[0]) { const d = St.stalledDeals()[0]; St.A.addApproval({ kind: 'Email', title: 'Nudge ' + d.c.name, agent: 'followup', stream: 'services', contactId: d.c.id, rubric: 'rb-email', scores: [8.6, 8.8, 8.2, 8.5], action: 'Send email from HighLevel', body: `Hi ${d.c.first},\n\nStill keen to get this moving? I can hold a build slot for next week if that helps.\n\nAvery` }); }
      if (r[0] === 'r8') St.A.runIdeation();
      St.log('Ran ' + r[1], 'Manual run', 'agent', 'OS');
      U.toast(r[1] + ' finished. Result: ' + r[5].toLowerCase()); window.App.refreshCounts(); window.App.render(true); ACT.rt({ dataset: { id: r[0] } });
    }, 1200);
  };

  /* ---------- capture form ---------- */
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form="capture"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const inp = f.elements.text; const text = inp.value.trim(); if (!text) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { const it = await addItem(text); inp.value = ''; VS.memTab = it.kind === 'decision' ? 'decisions' : it.kind === 'person' ? 'people' : it.kind === 'commitment' || it.kind === 'waiting' ? 'loops' : 'all'; window.App.render(true); const rc = U.$('#cap-receipt'); if (rc) { rc.textContent = receipt(it); rc.classList.add('ok'); } window.App.refreshCounts(); }
    catch (err) { U.toast(Auth.friendly(err)); btn.disabled = false; }
  }, true);

  /* ---------- Jarvis and Ask: memory, goals and capture by voice ---------- */
  const cite = (label, action, id) => `<button class="pill out cite" data-action="${action}" data-id="${id || ''}">${esc(label)}</button>`;
  window.OSAnswer = (q) => {
    const s = q.toLowerCase().trim();
    const cap = s.match(/^(?:jarvis,?\s+)?(remember|note|capture|log|save)(?: that| this)?[,:]?\s+(.{4,})$/);
    if (cap) {
      const text = q.trim().replace(/^(?:jarvis,?\s+)?(remember|note|capture|log|save)(?: that| this)?[,:]?\s+/i, '');
      const c = classify(text);
      const shown = { kind: c.kind, due: c.due, meta: { who: c.who } };
      addItem(text).then(() => { window.App.refreshCounts(); if (VS.view === 'memory') window.App.render(true); }).catch((e) => U.toast(Auth.friendly(e)));
      return { a: 'Got it. ' + receipt(shown), c: [cite('Memory', 'go', 'memory')], soft: true };
    }
    if (isLive() && loadingLive()) items();
    const all = items();
    if (/promis|i owe|owe anyone|open loop|commitment|what did i say i/.test(s)) {
      const mine = all.filter((x) => x.kind === 'commitment' && x.status === 'open').sort((p, r) => (p.due || '9') < (r.due || '9') ? -1 : 1);
      const late = mine.filter((x) => x.due && daysTo(x.due) < 0);
      if (!mine.length) return { a: 'You have no open promises in Memory. Say "remember I will..." and I will track it.', c: [cite('Memory', 'go', 'memory')] };
      return { a: `You have ${mine.length} open promises${late.length ? ', ' + late.length + ' of them late' : ''}. First up: ${mine.slice(0, 2).map((x) => `"${x.text}", ${dueLabel(x.due).toLowerCase()}`).join('. Then ')}.`, c: [cite('Memory · open loops', 'go', 'memory')] };
    }
    if (/waiting (on|for)|who owes|owes me/.test(s)) {
      const w = all.filter((x) => x.kind === 'waiting' && x.status === 'open');
      if (!w.length) return { a: 'Nobody owes you anything in Memory right now.', c: [cite('Memory', 'go', 'memory')] };
      return { a: `You are waiting on ${w.length}: ${w.slice(0, 3).map((x) => x.text).join('; ')}.`, c: [cite('Memory · waiting on', 'go', 'memory')] };
    }
    if (/decid|decision/.test(s)) {
      const d = all.filter((x) => x.kind === 'decision');
      if (!d.length) return { a: 'No decisions logged yet. Say "remember we decided..." and I will log it with a review date.', c: [cite('Memory', 'go', 'memory')] };
      const topic = s.replace(/.*(about|on)\s+/, '').replace(/[?.]/g, '').trim();
      const hit = topic && topic.length > 2 && !/decid|decision/.test(topic) ? d.find((x) => x.text.toLowerCase().includes(topic) || ((x.meta || {}).why || '').toLowerCase().includes(topic)) : null;
      if (hit) return { a: `On ${topic}: ${hit.text}${hit.meta && hit.meta.why ? ' Why: ' + hit.meta.why : ''}`, c: [cite('Decision', 'mem-decision', hit.id)] };
      const due = d.filter((x) => x.status === 'open' && x.due && daysTo(x.due) <= 7);
      return { a: `${d.length} decisions are logged. The latest: ${d[0].text} ${due.length ? due.length + ' are due for review this week, starting with "' + due[0].text + '".' : ''}`, c: [cite('Decisions', 'go', 'memory')] };
    }
    if (isLive()) return null;
    if (/goal|on track|freedom number|quarter|q4/.test(s)) {
      const G = goals(); const off = G.g.filter((g) => g.st !== 'on');
      return { a: `Profit is ${eur(G.profit)} a month against a freedom number of ${eur(VS.freedom)}. ${G.g.length - off.length} of ${G.g.length} Q4 goals are on track${off.length ? '. Watch ' + off.map((g) => g.name.toLowerCase()).join(' and ') + '. ' + off[0].next : '.'}`, c: [cite('Goals', 'go', 'goals')] };
    }
    if (/weekly review|last week|how was (my|the) week|retro|priorit(y|ies) this week|this week.s three/.test(s)) {
      const R = review(goals()); const p = VS.prio || R.prio;
      return { a: `Last week: ${R.wins[0]} ${R.misses[0]} This week's three: ${p.map((x, i) => (i + 1) + ', ' + x.replace(/\.$/, '')).join('. ')}.`, c: [cite('Weekly review', 'go', 'goals')] };
    }
    if (/routine|automat|on (its|their) own|budget|cap/.test(s)) {
      const on = RT.filter((r) => !VS.rtOff[r[0]]).length; const t = St.agentTotals();
      return { a: `${on} of ${RT.length} routines are on. Model spend is ${U.eur2(t.spent)} against a ${eur(VS.cap)} cap. Anything a client would see still waits for you.`, c: [cite('Routines', 'go', 'routines')] };
    }
    if (/connect|integrat|tools? (do|are)|data sources?/.test(s)) {
      const on = CX.filter((c) => c[7] === 'on').length;
      return { a: `${on} of ${CX.length} connections feed the demo. HighLevel is the core. YouTube, Gmail, Calendar, Zoom, Stripe and affiliate data sit around it, and Telegram carries the brief to your phone.`, c: [cite('Connections', 'go', 'connect')] };
    }
    return null;
  };
  window.OSCounts = () => { const all = isLive() ? (LM.ws === (ctx().ws || {}).id ? LM.items : []) : demoMemory(); const late = all.filter((x) => (x.kind === 'commitment') && x.status === 'open' && x.due && daysTo(x.due) <= 0).length; return { memory: late || '' }; };
  window.OSData = { goals, review, briefData, demoMemory, classify, receipt, connectors: () => CX, routines: () => RT, cx: (id) => CX.find((x) => x[0] === id || cxProv(x[0]) === id) || null };
  window.OSMemory = { items, classify, receipt, reset: () => { DM = null; LM.ws = null; LM.items = []; } };
})();

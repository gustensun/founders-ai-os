// Shared validation for agent proposals, recurring jobs and the scheduling UI.
(function (root) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const formats = [
    ['youtube', 'YouTube video', ['youtube']], ['short', 'YouTube Short', ['youtube']],
    ['reel', 'Instagram Reel', ['instagram']], ['tiktok', 'TikTok video', ['tiktok']],
    ['carousel', 'Carousel', ['instagram', 'linkedin']], ['post', 'Written post', ['linkedin', 'facebook', 'x', 'instagram', 'community']],
    ['email', 'Nurture email', ['email']], ['newsletter', 'Newsletter', ['email']],
    ['article', 'Article', ['website', 'linkedin']], ['podcast', 'Podcast', ['podcast']]
  ].map(([id, name, platforms]) => ({ id, name, platforms }));
  const platforms = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook', x: 'X', community: 'Community', email: 'Email', website: 'Website', podcast: 'Podcast' };
  const cadences = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly' };
  const uuid = () => globalThis.crypto?.randomUUID?.() || (typeof require === 'function' ? require('node:crypto').randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
  function fail(message) { throw new Error(message); }
  const str = (value, max, label, required = false) => {
    if (value != null && typeof value !== 'string') fail(label + ' must be text.');
    const v = (value || '').trim();
    if ((required && !v) || v.length > max || /\u0000/.test(v)) fail(label + ' must be ' + (required ? '1 to ' : 'under ') + max.toLocaleString() + ' characters.');
    return v;
  };
  const id = value => UUID.test(value || '') ? value : fail('That ID is not valid.');
  function timezone(value) { try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return value; } catch { return fail('Choose a valid IANA time zone, such as America/New_York.'); } }
  function schedule(input = {}) {
    if (!Object.hasOwn(cadences, input.cadence)) fail('Choose daily, weekdays, weekly or monthly.');
    if (!/^(0\d|1\d|2[0-3]):[0-5]\d$/.test(input.time || '')) fail('Choose a valid local time.');
    if (!input.timezone || typeof input.timezone !== 'string' || input.timezone.length > 80) fail('Choose a time zone.');
    const weekday = Number(input.weekday ?? 1), month_day = Number(input.month_day ?? 1);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) fail('Choose a weekday.');
    if (!Number.isInteger(month_day) || month_day < 1 || month_day > 28) fail('Choose a day from 1 to 28.');
    return { cadence: input.cadence, time: input.time, timezone: timezone(input.timezone), weekday, month_day };
  }
  function tags(value) {
    const xs = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();
    return xs.map(x => str(x, 40, 'Each tag')).filter(x => {
      const key = x.toLocaleLowerCase(); if (!x || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 12);
  }
  function task(input = {}) {
    const kind = input.output === 'ideas' ? 'ideas' : input.output === 'brief' ? 'brief' : fail('Choose a brief or ideas deliverable.');
    const format = input.format || 'post', f = formats.find(f => f.id === format);
    if (!f) fail('Choose a supported content format.');
    const platform = input.platform || f.platforms[0];
    if (!f.platforms.includes(platform)) fail('Choose a platform supported by this format.');
    const count = Number(input.count ?? 5);
    if (!Number.isInteger(count) || count < 1 || count > 10) fail('Choose between 1 and 10 ideas per run.');
    return { id: input.id ? id(input.id) : uuid(), name: str(input.name, 140, 'Task name', true),
      instructions: str(input.instructions, 12000, 'Task instructions'), deliverable: str(input.deliverable, 2000, 'Deliverable', true),
      output: kind, format, platform, count, tags: tags(input.tags), schedule: schedule(input.schedule),
      enabled: input.enabled !== false };
  }
  function agent(input = {}) {
    if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > 12) fail('Add between 1 and 12 recurring tasks.');
    const tasks = input.tasks.map(task);
    if (new Set(tasks.map(t => t.id)).size !== tasks.length) fail('Each task needs its own ID.');
    return { id: input.id ? id(input.id) : uuid(), name: str(input.name, 100, 'Agent name', true),
      role: str(input.role, 240, 'Role', true), instructions: str(input.instructions, 16000, 'Agent instructions', true),
      model: str(input.model || '', 100, 'Model'), enabled: input.enabled !== false,
      tasks };
  }
  // Model output is trimmed to fit before it is checked, so a long role or a stray format never sinks a proposal.
  function fit(input = {}, tz = 'UTC') {
    const cut = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\u0000/g, '').replace(/\s*\u2014\s*/g, ', ').trim().slice(0, n).trim();
    const whole = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    const tasks = (Array.isArray(input.tasks) ? input.tasks : []).slice(0, 12).map(t => {
      t = t && typeof t === 'object' ? t : {};
      const f = formats.find(x => x.id === t.format) || formats.find(x => x.id === 'post');
      const sc = t.schedule && typeof t.schedule === 'object' ? t.schedule : t;
      const time = /^(0\d|1\d|2[0-3]):[0-5]\d$/.test(sc.time || '') ? sc.time : /^\d:[0-5]\d$/.test(sc.time || '') ? '0' + sc.time : '08:00';
      let zone = tz; try { zone = timezone(sc.timezone || tz); } catch { zone = tz; }
      return { ...(t.id ? { id: t.id } : {}), name: cut(t.name, 140) || 'Recurring task', instructions: cut(t.instructions, 12000),
        deliverable: cut(t.deliverable, 2000) || cut(t.name, 2000) || 'A short brief', output: t.output === 'ideas' ? 'ideas' : 'brief',
        format: f.id, platform: f.platforms.includes(t.platform) ? t.platform : f.platforms[0], count: whole(t.count, 1, 10, 5),
        tags: (Array.isArray(t.tags) ? t.tags : []).filter(x => typeof x === 'string').map(x => cut(x, 40)).filter(Boolean).slice(0, 12), enabled: t.enabled !== false,
        schedule: { cadence: Object.hasOwn(cadences, sc.cadence) ? sc.cadence : 'weekly', time, timezone: zone, weekday: whole(sc.weekday, 0, 6, 1), month_day: whole(sc.month_day, 1, 28, 1) } };
    });
    return { ...(input.id ? { id: input.id } : {}), name: cut(input.name, 100) || 'New agent', role: cut(input.role, 240) || cut(input.name, 240) || 'Recurring work for the founder',
      instructions: cut(input.instructions, 16000) || 'Work from the founder\u2019s own context. Say what is missing instead of guessing.', model: cut(input.model, 100), enabled: input.enabled !== false, tasks };
  }
  const intent = q => /\b(create|build|set up|make|add|schedule)\b.{0,80}\b(agent|recurring task|recurring job)\b|\b(agent)\b.{0,60}\b(every|daily|weekly|recurring|each morning)\b/i.test(q || '');
  const scheduleLabel = s => `${cadences[s.cadence] || 'Unscheduled'}${s.cadence === 'weekly' ? ', ' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][s.weekday] : s.cadence === 'monthly' ? ', day ' + s.month_day : ''} at ${s.time} · ${s.timezone}`;
  function nextRunLabel(value, scheduled, locale) {
    if (!value) return 'Not scheduled yet';
    try {
      const zone = timezone(scheduled.timezone);
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zone, timeZoneName: 'shortOffset' }).format(new Date(value)) + ' · ' + zone;
    } catch { return 'Schedule time unavailable'; }
  }
  const api = { formats, platforms, cadences, uuid, id, str, tags, timezone, schedule, task, agent, intent, scheduleLabel, nextRunLabel, fit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AgentSchema = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Founders AI OS: email writer. Turns a library sequence into one written for a specific funnel or offer.
// fill() swaps the placeholders it can be sure of (no AI). prompt() and parse() are what the AI path uses.
(function (root) {
  // The offer placeholder each sequence is built around. The offer or funnel the founder picks goes here.
  const MAIN = {
    'freebie-introduction-emails': 'FREEBIE NAME', 'nurture-story-emails': 'PRODUCT NAME', 'abandon-cart-emails': 'PRODUCT NAME',
    'customer-ascension-emails': 'PRODUCT NAME', 'upsell-reminder-emails': 'UPSELL NAME', 'booked-call-reminders': 'SERVICE NAME',
    'client-onboarding-emails': 'SERVICE NAME', 'affiliate-signup-emails': 'TOOL NAME', 'list-activation-emails': '',
    'webinar-challenge-promo-emails': 'EVENT NAME', 'webinar-challenge-registration-emails': 'EVENT NAME',
    'webinar-challenge-follow-up-emails': 'OFFER NAME', 'live-launch-promo-emails': 'PROGRAM NAME',
  };
  const CUR = { EUR: '€', USD: '$', GBP: '£' };
  const priceOf = (it) => { if (!it || it.price == null || it.price === '') return ''; const n = Number(it.price); if (!isFinite(n) || n <= 0) return ''; const c = CUR[String(it.currency || 'USD').toUpperCase()] || ''; return (c ? c : '') + (n % 1 ? n.toFixed(2) : n.toLocaleString('en-US')) + (c ? '' : ' ' + (it.currency || '')) + (it.price_note ? ' ' + it.price_note : ''); };
  const clean = (t) => String(t == null ? '' : t).replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, '-').replace(/!+/g, '.').replace(/\.\.+/g, '.').trim();
  // NAME alone is the founder. OFFER NAME, CUSTOMER NAME and the rest are left for their own swaps.
  const swapName = (t, who) => String(t).replace(/(?<![A-Z]+ )\bNAME\b/g, who);

  function fill(seq, o = {}) {
    const main = MAIN[seq.id]; const offer = String(o.offer || '').trim(); const who = String(o.founder || '').trim() || 'NAME'; const price = priceOf(o.item);
    const sw = (t) => { let s = String(t || ''); if (offer && main) s = s.split(main).join(offer); if (price && main) s = s.replace(/\bPRICE\b/g, price); return swapName(s, who); };
    return seq.emails.map((e) => ({ when: e.when, subject: sw(e.subject), preview: sw(e.preview), body: sw(e.body), note: e.note || '' }));
  }

  function itemBlock(it, offer) {
    if (!it) return offer ? 'THE OFFER OR FUNNEL: ' + offer : '';
    const p = priceOf(it);
    return ['THE OFFER OR FUNNEL THIS SEQUENCE IS FOR (' + (it.kind === 'funnel' ? 'a funnel' : 'an offer') + ')', 'Name: ' + it.name, p ? 'Price: ' + p : '', it.summary ? 'What it is: ' + it.summary : '', it.url ? 'Page: ' + it.url : ''].filter(Boolean).join('\n');
  }
  function prompt({ seq, item, offer, context, founder, prev, note }) {
    const tpl = seq.emails.map((e, i) => `EMAIL ${i + 1} (${e.when})\nSubject: ${e.subject}\nPreview: ${e.preview}\n${e.body}`).join('\n\n---\n\n');
    const words = seq.emails.map((e) => (e.body.match(/\S+/g) || []).length);
    return [
      itemBlock(item, offer),
      context ? 'CONTEXT I ADDED FOR THESE EMAILS. Treat it as true and use it:\n' + context : 'I did not add extra context. Use the offer and my Brand DNA.',
      `THE TEMPLATE: "${seq.title}". ${seq.intro.replace(/\*\*/g, '')}\nUse it for the structure, the send timing, the job of each email and the length. Rewrite every line for my offer, my audience and my voice.\n\n${tpl}`,
      prev && prev.length ? 'THE VERSION YOU WROTE LAST TIME:\n' + prev.map((e, i) => `EMAIL ${i + 1}\nSubject: ${e.subject}\n${e.body}`).join('\n\n') + '\n\nWHAT I WANT CHANGED: ' + (note || 'Make it sharper and more specific to my offer.') : '',
      `RULES
- Write exactly ${seq.emails.length} emails with the same send timing as the template, in the same order.
- Keep each email close to the template length (${words.join(', ')} words), within about 20 percent.
- Write as me, first person. Sign every email "${founder || 'NAME'}". Greet with "Hey {{contact.first_name}},".
- Keep every [BUTTON: text] line, and rewrite the button text for my offer.
- Only use prices, dates, deadlines, bonuses, guarantees, numbers and results that appear in the context, the offer or my facts. When one is missing, leave the placeholder in capitals (PRICE, DATE, TIME, DAYS, BONUS NAME) so I can fill it in.
- Only quote testimonials I gave you. Otherwise keep a line that starts with TESTIMONIAL HERE: followed by short Lorem ipsum text and " - CUSTOMER NAME".
- If the context says there is no deadline, guarantee or bonus, leave that part out.
- Plain words, short lines, one idea per email. No em dashes, no exclamation points, no emojis, no hype, no "it's not X, it's Y" lines, no income claims I did not give you.
- Subject lines short and specific, lower stakes than clickbait. Preview text under 60 characters.

Return JSON only: {"emails":[{"when":"Send ...","subject":"...","preview":"...","body":"..."}]}. Body is plain text with blank lines between paragraphs.`,
    ].filter(Boolean).join('\n\n');
  }
  function parse(text, seq) {
    const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    let j; try { j = JSON.parse(m[0]); } catch { return null; }
    const xs = Array.isArray(j) ? j : j && Array.isArray(j.emails) ? j.emails : null;
    if (!xs || !xs.length) return null;
    const out = xs.slice(0, seq.emails.length).map((e, i) => ({ when: clean(e.when || (seq.emails[i] || {}).when || ''), subject: clean(e.subject).slice(0, 200), preview: clean(e.preview).slice(0, 200), body: clean(e.body).replace(/\n{3,}/g, '\n\n').slice(0, 8000), note: (seq.emails[i] || {}).note || '' }))
      .filter((e) => e.subject && e.body.length > 40);
    return out.length >= Math.max(1, seq.emails.length - 1) ? out : null;
  }
  // One email as plain text for pasting into HighLevel.
  const plain = (t) => String(t || '').replace(/\*\*(.+?)\*\*/g, '$1');
  const asText = (e) => `Subject: ${e.subject}\nPreview: ${e.preview}\n\n${plain(e.body)}`;
  const setText = (title, emails) => `${title}\n\n` + emails.map((e, i) => `EMAIL ${i + 1}: ${e.when}\n${asText(e)}`).join('\n\n----------\n\n');

  const api = { MAIN, fill, prompt, parse, asText, setText, priceOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EmailWriter = api;
})(typeof window !== 'undefined' ? window : globalThis);

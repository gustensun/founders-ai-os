// The Founders OS crew: one small character per agent. All share one body, a soft clay version of the
// Founders OS spark, with a dipped tip in a second colour and a prop for the job (clipboard, magnet, gear).
// Rendered once in 3D and shipped as small WebP files in assets/mascots. Mascots.svg(id, { size, disc })
// still returns an <svg class="mascot"> so every caller and style keeps working.
(function (root) {
  // id: [name, colour, disc tint]
  const CREW = {
    coo: ['Captain', '#2f4b7c', '#e3e9f4'],
    cmo: ['Coco', '#ef7b5c', '#fbe7e1'],
    research: ['Hoot', '#2a9d8f', '#dff2ef'],
    creator: ['Telly', '#8b7cf6', '#ece9fe'],
    content: ['Spark', '#f6c343', '#fdf3d6'],
    copy: ['Inky', '#4c7df0', '#e2eafd'],
    design: ['Drip', '#ec6fa8', '#fce4ef'],
    funnel: ['Flo', '#f28c38', '#fde9d8'],
    crm: ['Deck', '#5aa9e6', '#e1f0fb'],
    leadgen: ['Maggie', '#e5484d', '#fbe3e3'],
    sales: ['Penny', '#22b07d', '#dcf3ea'],
    analytics: ['Graph', '#6366f1', '#e6e7fd'],
    automations: ['Cog', '#64748b', '#e6eaef'],
    support: ['Puff', '#6fbbe8', '#e0f1fb'],
    qa: ['Peek', '#3fbf9f', '#dcf4ee'],
    accounting: ['Tally', '#c9b27f', '#f8f1e2'],
    coding: ['Byte', '#2a2f3d', '#e4e6ec'],
    coach: ['Ace', '#1f4d3a', '#e4eee8'],
  };
  const src = (id) => `assets/mascots/${CREW[id] ? id : 'coo'}.webp`;
  let seq = 0;
  function svg(id, o = {}) {
    const c = CREW[id] || CREW.coo; const size = o.size || 40; const disc = o.disc !== false;
    const label = o.label === false ? 'aria-hidden="true"' : `role="img" aria-label="${o.label || c[0]}"`;
    const k = 'mc' + (++seq);
    // Small discs frame a portrait (face centred, feet below the edge); large ones show the full body and prop.
    const inner = disc
      ? `<defs><clipPath id="${k}"><circle cx="40" cy="40" r="40"/></clipPath></defs><g clip-path="url(#${k})"><circle cx="40" cy="40" r="40" fill="${c[2]}"/><image href="${src(id)}" ${size >= 64 ? 'x="4" y="8" width="72" height="72"' : 'x="-11" y="3" width="102" height="102"'} preserveAspectRatio="xMidYMid meet"/></g>`
      : `<image href="${src(id)}" x="0" y="0" width="80" height="80" preserveAspectRatio="xMidYMid meet"/>`;
    return `<svg class="mascot" viewBox="0 0 80 80" width="${size}" height="${size}" ${label}>${inner}</svg>`;
  }
  const api = { svg, src, CREW, name: (id) => (CREW[id] || CREW.coo)[0], color: (id) => (CREW[id] || CREW.coo)[1] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Mascots = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Runs first, before the app. Sets the saved theme without a flash and handles the small markup behaviors
// that used to be inline handlers, so the security policy can block every inline script.
(() => {
  try { const t = localStorage.getItem('fos-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* private mode */ }
  document.addEventListener('submit', (e) => { if (e.target && e.target.matches && e.target.matches('form[data-nosubmit]')) e.preventDefault(); }, true);
  document.addEventListener('error', (e) => {
    const el = e.target; const how = el && el.dataset && el.dataset.onerr; if (!how) return;
    if (how === 'remove') return el.remove();
    if (how === 'dim') { el.style.opacity = '.2'; return; }
    if (how.startsWith('gone:')) { const box = el.closest(how.slice(5)); if (box) box.classList.add('gone'); return; }
    if (how.startsWith('ph:')) { const s = document.createElement('span'); s.className = how.slice(3); el.replaceWith(s); }
  }, true);
  // Sample previews (iframe src="/frame" data-frame="key") ask for their HTML once they load.
  window.__frames = window.__frames || {};
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'fos-frame-ready') return;
    const f = [...document.querySelectorAll('iframe[data-frame]')].find((x) => x.contentWindow === e.source);
    const html = f && window.__frames[f.dataset.frame];
    if (typeof html === 'string') e.source.postMessage({ type: 'fos-frame', html }, '*');
  });
})();

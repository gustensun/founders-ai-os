// Sample page previews. This page runs in a sandboxed iframe with its own policy, receives the page HTML from the app
// once, and writes it in. Nothing here can reach the app's session.
(() => {
  window.addEventListener('message', function take(e) {
    if (e.source !== window.parent || !e.data || e.data.type !== 'fos-frame' || typeof e.data.html !== 'string') return;
    window.removeEventListener('message', take);
    document.open(); document.write(e.data.html); document.close();
  });
  window.parent.postMessage({ type: 'fos-frame-ready' }, '*');
})();

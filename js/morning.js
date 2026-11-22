// Jarvis previews the same queue as the Newsfeed. No parallel approval workflow.
(() => {
  window.Morning={
    home:()=>window.Approvals?.home()||'',
    load:force=>window.OSBoard?.load(force),
    open:id=>window.Approvals?.open(id),
    reset:()=>window.OSBoard?.reset()
  };
})();

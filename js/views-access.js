// Founders AI OS: Access. Admins approve, deny or revoke accounts. The database enforces it, this screen only asks.
(() => {
  const U = window.UI, V = window.V, ACT = window.ACT;
  const { esc } = U;

  const ago = (iso) => {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.round(h / 24); if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const VS = () => (window.VS = window.VS || {});

  function row(a, me) {
    const self = a.user_id === me;
    const name = a.full_name || a.email.split('@')[0];
    const acts = self ? '<span class="pill">You</span>'
      : a.status === 'pending' ? `<button class="btn sm" data-action="acc-set" data-id="${a.user_id}" data-v="denied">Deny</button><button class="btn sm primary" data-action="acc-set" data-id="${a.user_id}" data-v="approved">Approve</button>`
      : a.status === 'approved' ? `<button class="btn sm" data-action="acc-set" data-id="${a.user_id}" data-v="denied" data-confirm="1">Remove access</button>`
      : `<button class="btn sm" data-action="acc-set" data-id="${a.user_id}" data-v="approved">Approve</button>`;
    return `<div class="acc-row">
      <span class="avatar">${esc(U.initials(name).toUpperCase())}</span>
      <div class="grow"><div class="acc-n">${esc(name)}${a.is_admin ? ' <span class="pill acc">Admin</span>' : ''}</div>
        <div class="meta">${esc(a.email)}</div><div class="meta">${a.status === 'pending' ? `Signed up ${ago(a.requested_at)} · ${a.confirmed ? 'email confirmed' : 'email not confirmed yet'}` : `Last login ${ago(a.last_sign_in)}`}</div></div>
      <div class="acc-act">${acts}</div>
    </div>`;
  }

  V.access = () => V.access.live();
  V.access.live = () => {
    const App = window.App;
    if (!App.isAdmin || !App.isAdmin()) return `${U.title('Access')}<section class="panel">${U.empty('Admins only', 'Only an admin can approve new accounts.')}</section>`;
    const all = App.access() || []; const me = (App.liveCtx() || {}).userId;
    const tab = VS().accTab || 'pending';
    const by = { pending: all.filter((a) => a.status === 'pending'), approved: all.filter((a) => a.status === 'approved'), denied: all.filter((a) => a.status === 'denied') };
    const list = by[tab];
    const empty = { pending: ['Nobody is waiting', 'New sign-ups land here first. They cannot see anything until you approve them.'], approved: ['No approved accounts', 'Approved people show up here.'], denied: ['Nobody denied', 'Accounts you deny or remove show up here, and you can approve them later.'] }[tab];
    return `${U.title('Access', 'Everyone who signs up waits here until you approve them. Until then they see a waiting page and the database returns nothing.', '<button class="btn" data-action="acc-reload">Refresh</button>')}
      <div class="acc-top">${U.seg('accTab', tab, [['pending', `Waiting${by.pending.length ? ' <span class="n">' + by.pending.length + '</span>' : ''}`], ['approved', `Approved <span class="meta">${by.approved.length}</span>`], ['denied', `Denied <span class="meta">${by.denied.length}</span>`]])}</div>
      <section class="panel acc-list">${list.length ? list.map((a) => row(a, me)).join('') : U.empty(empty[0], empty[1])}</section>
      <p class="meta acc-note">Approving gives someone their own private workspace, with nothing shared between accounts. Removing access signs them out of every screen and stops their AI access tokens from working.</p>`;
  };

  ACT['acc-reload'] = async (el) => { if (el) { el.disabled = true; el.innerHTML = U.spin + 'Refreshing'; } await window.App.reloadAccess(); window.App.render(); };
  ACT['acc-set'] = async (el) => {
    const a = (window.App.access() || []).find((x) => x.user_id === el.dataset.id); if (!a) return;
    const v = el.dataset.v;
    if (el.dataset.confirm) { const ok = await U.dialog({ title: 'Remove access for ' + (a.full_name || a.email) + '?', body: 'They lose access right away. Their workspace stays in place, so approving them again restores everything.', ok: 'Remove access', danger: true }); if (!ok) return; }
    el.disabled = true; el.innerHTML = U.spin;
    try {
      await window.Auth.admin.set(a.user_id, v);
      await window.App.reloadAccess();
      U.toast(v === 'approved' ? `${a.full_name || a.email} is approved. They can log in now.` : v === 'denied' ? `${a.full_name || a.email} has no access.` : 'Updated');
      window.App.render();
    } catch (e) { U.toast(e.message || 'That did not work'); el.disabled = false; el.textContent = v === 'approved' ? 'Approve' : 'Deny'; }
  };
})();

// Curated strategy supplies live/planned business context. Inventory stays separate.
(() => {
  const U=window.UI,V=window.V,ACT=window.ACT,{esc,icon}=U,D=()=>window.DNA;
  const isLive=()=>!!window.App?.isLive(),ctx=()=>window.App.liveCtx();
  function list(items,kind){
    const xs=items.filter(x=>x.kind===kind&&(x.included||x.lifecycle==='planned'));
    return xs.map(x=>`<div class="row dn-item"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.summary||'')}</div></div><span class="pill ${x.included?'pos':''}">${x.included?'Live':'Planned'}</span></div>`).join('')||'<p class="meta dn-none">No curated '+kind+' strategy yet.</p>';
  }
  function view(){
    const d=D().data(),dna=d.dna,c=dna?.counts||{};
    const title=U.title('Brand DNA','Your approved facts, writing voice, current strategy and saved evidence. AI reads this shared brief before drafting, with planned offers kept separate from what is live.',
      `<button class="btn" data-action="hl-values">${icon('upload')}Sync to HighLevel</button><button class="btn" data-action="dn-rebuild">Refresh DNA</button><button class="btn" data-action="dn-copy" ${dna?'':'disabled'}>${icon('copy')}Copy DNA</button><button class="btn" data-action="brain-download">${icon('download')}Download my Brain</button>`);
    if(d.loading&&!dna)return title+U.empty('Loading your DNA','Reading your current workspace context.');
    if(d.error&&!dna)return title+U.empty('The DNA could not load',esc(d.error),'<button class="btn" data-action="dn-rebuild">Try again</button>');
    const strands=[['Approved facts',c.facts||0,'brain'],['Live offers',c.offers||0,'offers'],['Live funnels',c.funnels||0,'funnels'],['Proven posts',c.proven||0,'proven'],['Writing samples',c.writing||0,'writing']];
    return title+(!isLive()?'<p class="os-notice">Illustrative DNA from the sample workspace.</p>':'')+
      `<section class="panel dn-hero"><div class="dn-ver"><h2>Current brief</h2><p class="meta">${dna?'Version '+dna.version+' · Rebuilt '+D().ago(dna.built_at):'Not compiled yet'}</p><p class="meta">Saving approved facts, writing or strategy refreshes this brief. Imported HighLevel records are not treated as live strategy.</p></div>
      <div class="dn-strands">${strands.map(([n,v,r])=>`<a class="dn-strand" href="#${r}"><b class="num">${v}</b><span>${n}</span></a>`).join('')}</div></section>`+
      (window.Writing?window.Writing.panel():'')+
      `<div class="grid2 dn-grid"><section class="panel"><header><h2>Offer strategy</h2><a class="btn sm" href="#offers">Manage offers</a></header>${list(d.items,'offer')}</section>
      <section class="panel"><header><h2>Funnel strategy</h2><a class="btn sm" href="#funnels">Manage funnels</a></header>${list(d.items,'funnel')}</section></div>
      <section class="panel"><header><h2>What AI reads</h2><span class="meta">${(dna?.body||'').length.toLocaleString()} characters</span></header>${dna?`<pre class="dn-body">${esc(dna.body||'')}</pre>`:U.empty('Nothing compiled yet','Approve a fact, add your writing or save a live offer to build your shared context.')}</section>`+(window.BrainTools?window.BrainTools.historyPanel('dna'):'');
  }
  V.dna=view;V.dna.live=view;
  ACT['dn-copy']=()=>{const d=D().data();if(d.dna)U.copy(d.dna.body||'');};
  ACT['dn-rebuild']=async()=>{if(!isLive()){U.toast('This is the sample DNA.');return;}try{await window.Auth.dna.rebuild(ctx().ws.id);await D().load(true);U.toast('DNA refreshed.');}catch(e){U.toast(window.Auth.friendly(e));}};
  ACT['dn-sync']=()=>{location.hash='#offers';U.toast('Import inventory from Offers or Funnels. Choose its strategy status before it becomes live context.');};
})();

(() => {
  const U=window.UI,V=window.V,VS=window.VS,ACT=window.ACT,P=window.StrategySchema,{esc,icon}=U;
  const live=()=>!!window.App?.isLive(), ws=()=>window.App?.liveCtx().ws?.id, key=()=>[live()?'live':'demo',ws()].join(':');
  const S={key:null,loaded:false,loading:false,rows:[],inventory:[],error:'',tab:'live',q:'',editor:null,busy:false};
  const uid=()=>crypto.randomUUID();
  const current=()=>VS.view==='funnels'?'funnel':'offer';
  const onView=()=>['offers','funnels'].includes(VS.view);
  const render=()=>{if(onView())window.App.render(true);};
  function scope(){const k=key();if(S.key!==k)Object.assign(S,{key:k,loaded:false,loading:false,rows:[],inventory:[],error:'',editor:null,busy:false,tab:'live',q:''});return k;}
  async function load(force=false){
    const k=scope();if(S.loading||(S.loaded&&!force))return;S.loading=true;
    try{
      let rows,inventory;
      if(live())[rows,inventory]=await Promise.all([window.Auth.strategy.list(ws()),window.Auth.dna.items(ws())]);
      else {
        rows=S.rows.length?S.rows:window.DNA.data().items.slice(0,7).map((x,i)=>({...x,id:uid(),lifecycle:i%3===0?'planned':'live',revision:1,details:{audience:'Independent founders',next_step:'Review the positioning before the next launch.'},currency:'USD',price_note:x.price_note||'',url:x.url||'',summary:x.summary||''}));
        inventory=window.DNA.data().items;
      }
      if(k!==key())return;S.rows=rows;S.inventory=inventory;S.loaded=true;S.error='';
    }catch(e){if(k===key()){S.error=window.Auth.friendly(e);S.loaded=true;}}
    finally{if(k===key()){S.loading=false;render();}}
  }
  const price=x=>x.price!=null?`${x.currency||'USD'} ${Number(x.price).toLocaleString(undefined,{maximumFractionDigits:2})}${x.price_note?' · '+x.price_note:''}`:'Price not set';
  const field=(name,label,value='',type='text',wide=false)=>`<label class="os-field${wide?' wide':''}"><span>${esc(label)}</span>${type==='textarea'?`<textarea name="${name}" rows="${wide?4:3}" maxlength="${name==='details.notes'?10000:4000}">${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" max="1000000000" step="any"':''} ${name==='name'?'required maxlength="200"':''}>`}</label>`;
  function editor(){
    const e=S.editor,d=e.data,isOffer=d.kind==='offer';
    return U.title(e.revision?'Edit '+d.name:'New '+d.kind,'Your strategy stays separate from imported inventory. Saved changes inform the next AI request without rewriting your DNA.',
      `<button class="btn" data-action="st-back" ${S.busy?'disabled':''}>Back</button>${window.AISuggest?window.AISuggest.button('strategy',{primary:true}):''}<button class="btn primary" data-action="st-save" ${S.busy?'disabled':''}>${S.busy?U.spin+'Saving':'Save '+d.kind}</button>`) +
      `<form id="strategy-form" class="os-editor" data-nosubmit data-sg-scope="strategy"><div class="os-form-intro"><h2>${isOffer?'The offer':'The funnel'}</h2><p>Choose Live only for something currently available. Planned work is visible to AI as a future idea, never something you already sell.</p></div>
      <div class="os-fields">${field('name','Name',d.name)}<label class="os-field"><span>Status</span><select name="lifecycle">${Object.entries(P.statuses).map(([k,n])=>`<option value="${k}" ${d.lifecycle===k?'selected':''}>${n}</option>`).join('')}</select></label>
      ${field('summary',isOffer?'What you sell, in your own words':'What this funnel does',d.summary,'textarea',true)}
      ${field('url',isOffer?'Live offer / checkout link':'Live funnel link',d.url,'url',true)}
      ${isOffer?field('price','Price',d.price??'','number')+field('currency','Currency',d.currency||'USD')+field('price_note','Payment terms',d.price_note):`<label class="os-field wide"><span>Connected offer</span><select name="linked_offer_id"><option value="">No connected offer</option>${S.rows.filter(x=>x.kind==='offer').map(x=>`<option value="${x.id}" ${d.linked_offer_id===x.id?'selected':''}>${esc(x.name)} (${P.statuses[x.lifecycle]})</option>`).join('')}</select></label>`}
      <label class="os-field"><span>Revenue stream</span><select name="details.stream">${[['','Not set'],['products','Digital products'],['services','Services'],['coaching','Coaching'],['software','Software'],['affiliate','Affiliate'],['multiple','Multiple streams']].map(([k,n])=>`<option value="${k}" ${d.details.stream===k?'selected':''}>${n}</option>`).join('')}</select></label>
      ${field('details.launch_date','Launch / next review date',d.details.launch_date,'date')}</div>
      <div class="os-form-intro"><h2>${isOffer?'Positioning & delivery':'The customer journey'}</h2><p>Keep the details you want your research, content and copy agents to use. AI suggest drafts the empty ones from your Brand DNA and approved facts. Review them before you save.</p></div>
      <div class="os-fields">${(isOffer?P.offerFields:P.funnelFields).map(([k,n])=>field('details.'+k,n,d.details[k],'textarea')).join('')}${field('details.notes','Private strategy notes',d.details.notes,'textarea',true).replace('<label class="os-field','<label data-sg-skip class="os-field')}</div>
      ${S.error?`<p class="os-error" role="alert">${esc(S.error)}</p>`:''}
      <footer class="os-editor-foot"><span class="meta">${e.revision?'Saved revision '+e.revision:'Not saved yet'}${d.inventory_id?' · Copied from inventory; HighLevel is unchanged.':''}</span><button type="button" class="btn primary" data-action="st-save" ${S.busy?'disabled':''}>${S.busy?'Saving':'Save '+d.kind}</button></footer></form>`+(e.revision&&window.BrainTools?`<section class="panel bt-usedpanel"><header><h2>Used in</h2></header>${window.BrainTools.usedIn(S.rows.find(r=>r.id===e.id)||d,S.rows)}</section>`+window.BrainTools.historyPanel(d.kind,e.id):'');
  }
  function view(){
    scope();if(!S.loaded&&!S.loading)queueMicrotask(()=>load());
    if(S.editor&&S.editor.data.kind===current())return editor();
    const kind=current(),name=kind==='offer'?'Offers':'Funnels',base=S.rows.filter(x=>x.kind===kind),inv=S.tab==='inventory';
    const list=(inv?S.inventory.filter(x=>x.kind===kind):base.filter(x=>x.lifecycle===S.tab)).filter(x=>[x.name,x.summary,JSON.stringify(x.details||{})].join(' ').toLowerCase().includes(S.q.toLowerCase()));
    return U.title(name,kind==='offer'?'What you sell now, and what you are building next. Your decisions, not a product catalogue.':'Your live customer journeys and the ones you are planning. HighLevel remains the host.',
      `${kind==='funnel'?'<a class="btn" href="#funnel-agent">Funnel Agent</a>':''}<button class="btn primary" data-action="st-new" data-kind="${kind}">${icon('plus')}Add ${kind}</button>`) +
      (!live()?'<p class="os-notice">Sample strategy for the demo. Nothing here changes your real workspace.</p>':'')+
      `<div class="os-toolbar"><div class="os-tabs" role="group" aria-label="${name} status">${Object.entries(P.statuses).map(([k,n])=>`<button data-action="st-tab" data-v="${k}" aria-pressed="${S.tab===k}">${n}<span>${base.filter(x=>x.lifecycle===k).length}</span></button>`).join('')}<button data-action="st-tab" data-v="inventory" aria-pressed="${inv}">Import from inventory</button></div><label class="os-search"><span class="sr-only">Search ${name.toLowerCase()}</span><input type="search" data-action="st-search" value="${esc(S.q)}" placeholder="Search ${name.toLowerCase()}"></label></div>
      ${inv?'<p class="os-notice">These are reference records from HighLevel and your earlier DNA entries. Nothing is treated as live until you add it to your strategy and choose its status.</p>':''}
      ${S.loading&&!S.loaded?U.empty('Loading your strategy','One moment.'):S.error?`<div class="os-error" role="alert">${esc(S.error)} <button class="btn sm" data-action="st-reload">Retry</button></div>`:''}
      ${kind==='funnel'&&!inv&&window.HLSync?window.HLSync.formsPanel():''}<div class="strategy-list">${list.map(x=>{
        const used=S.rows.find(r=>r.inventory_id===x.id);
        return `<article class="strategy-row"><div class="strategy-main"><div class="strategy-name"><h2>${esc(x.name)}</h2>${!inv?`<span class="pill ${x.lifecycle==='live'?'pos':''}">${P.statuses[x.lifecycle]}</span>`:`<span class="tag">${x.source==='you'?'Earlier DNA entry':'HighLevel inventory'}</span>`}</div>
        <p>${esc(x.summary||'Add the positioning, audience and next action for this '+kind+'.')}</p><div class="strategy-meta">${kind==='offer'?`<span>${esc(price(x))}</span>`:''}${x.details?.goal?`<span>${esc(x.details.goal)}</span>`:''}${x.details?.launch_date?`<span>${x.lifecycle==='planned'?'Target launch':'Review'} ${esc(x.details.launch_date)}</span>`:''}</div>
        ${x.details?.next_step?`<p class="strategy-next"><span>Next</span>${esc(x.details.next_step)}</p>`:''}${!inv&&window.BrainTools?window.BrainTools.usedIn(x,S.rows):''}</div>
        <div class="strategy-actions">${!inv&&x.url?`<a class="btn sm ghost" href="${esc(P.url(x.url))}" target="_blank" rel="noopener noreferrer">Open page ${icon('external')}</a>`:''}
        <button class="btn sm" data-action="${inv?'st-import':'st-edit'}" data-id="${x.id}" ${inv&&used?'disabled':''}>${inv?(used?'Added to strategy':'Use in strategy'):'Edit strategy'}</button></div></article>`;
      }).join('')||(!S.loading&&!S.error?U.empty(inv?'No inventory to import':'No '+P.statuses[S.tab].toLowerCase()+' '+name.toLowerCase(),inv?'You can still enter your strategy manually.':S.q?'Try a different search.':`Add a ${kind} and choose ${S.tab==='live'?'Live when it is currently available':'Planned while you develop it'}.`,`<button class="btn" data-action="st-new" data-kind="${kind}">Add ${kind}</button>`):'')}</div>`+(!inv&&window.BrainTools?window.BrainTools.historyPanel(kind):'');
  }
  window.AISuggest?.register('strategy',{get kind(){return S.editor?.data.kind==='funnel'?'funnel':'offer';},before:()=>capture(),
    ctx:()=>{const d=S.editor?.data||{},linked=d.kind==='funnel'&&d.linked_offer_id?S.rows.find(x=>x.id===d.linked_offer_id):null,o=d.kind==='offer'?d:linked;
      return {title:d.name||null,offer_id:o&&o.revision?o.id:null,offer_name:o?.name||d.name||null,price:o&&o.price!=null&&o.price!==''?`${o.currency||'USD'} ${o.price}`:'',draft:{name:d.name,status:d.lifecycle,price:o&&o.price!=null?`${o.currency||'USD'} ${o.price}${o.price_note?', '+o.price_note:''}`:'',connected_offer:linked?.name||'',stream:d.details?.stream||''}};}});
  V.offers=view;V.offers.live=view;V.funnels=view;V.funnels.live=view;
  function capture(){const f=document.getElementById('strategy-form');if(!f||!S.editor)return;for(const [k,v]of new FormData(f)){if(k.startsWith('details.'))S.editor.data.details[k.slice(8)]=v;else S.editor.data[k]=v;}}
  function start(kind,row=null,inventory=false){scope();S.error='';S.editor={id:inventory?uid():row?.id||uid(),revision:inventory?0:row?.revision||0,data:{kind,name:'',lifecycle:'planned',summary:'',price:null,currency:'USD',price_note:'',url:'',details:{},...(row?JSON.parse(JSON.stringify(row)):{}),...(inventory?{lifecycle:'planned',inventory_id:row.id,linked_offer_id:null}:{} )}};S.editor.data.details||={};render();}
  ACT['st-new']=el=>start(el.dataset.kind);
  ACT['st-edit']=el=>{const r=S.rows.find(x=>x.id===el.dataset.id);if(r)start(r.kind,r);};
  ACT['st-import']=el=>{const r=S.inventory.find(x=>x.id===el.dataset.id);if(r)start(r.kind,r,true);};
  ACT['st-back']=async()=>{if(S.busy)return;capture();const yes=await U.dialog({title:'Leave this edit?',body:'Unsaved changes will be discarded. Saved strategy and your HighLevel inventory are unchanged.',ok:'Discard changes'});if(yes){S.editor=null;S.error='';render();}};
  ACT['st-save']=async()=>{
    if(S.busy||!S.editor)return;const f=document.getElementById('strategy-form');if(f&&!f.reportValidity())return;capture();const k=key(),e=S.editor;let data;
    try{data=P.normalize(e.data);}catch(err){S.error=err.message;render();return;}
    S.busy=true;S.error='';render();
    try{const row=live()?await window.Auth.strategy.save(ws(),e.id,data,e.revision):{...data,id:e.id,revision:e.revision+1,updated_at:new Date().toISOString()};
      if(k!==key())return;S.rows=[row,...S.rows.filter(x=>x.id!==row.id)];S.editor=null;S.tab=row.lifecycle;U.toast('Strategy saved. '+(row.lifecycle==='live'?'Live context is updated.':'AI will treat this as '+row.lifecycle+'.'));window.DNA?.load(true);}
    catch(err){if(k===key())S.error=window.Auth.friendly(err);}
    finally{if(k===key()){S.busy=false;render();}}
  };
  ACT['st-tab']=el=>{S.tab=el.dataset.v;S.q='';render();};
  ACT['st-search']=el=>{S.q=el.value;const pos=el.selectionStart;render();const n=document.querySelector('[data-action="st-search"]');n?.focus();try{n?.setSelectionRange(pos,pos);}catch{}};
  ACT['st-reload']=()=>load(true);
  document.addEventListener('input',e=>{if(e.target.closest('#strategy-form'))capture();});
  window.OSStrategy={load,list:()=>S.rows,state:()=>S,reset:()=>{S.key=null;scope();},start};
})();

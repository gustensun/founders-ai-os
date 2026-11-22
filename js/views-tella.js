// Tella mode of the Video editor: import a recording, approve the storyboard, then Founders OS edits a copy in Tella.
(() => {
  const U=window.UI,ACT=window.ACT,VS=window.VS,T=window.TellaSchema,{esc,icon}=U;
  const live=()=>!!window.App?.isLive(),ws=()=>window.App?.liveCtx().ws?.id,key=()=>[live()?'live':'demo',ws()].join(':');
  const MODE='fos-video-mode';
  const initial=()=>({key:key(),loaded:false,loading:false,edits:[],edit:null,plan:null,approvals:[],models:{},tab:'storyboard',dirty:false,busy:'',error:'',picker:null,model:'auto',brief:'',agent:null,accounts:null,polling:false});
  let S={...initial(),key:null};
  const mode=()=>{try{return localStorage.getItem(MODE)==='render'?'render':'tella';}catch{return 'tella';}};
  const draw=()=>{if(VS.view==='video')window.App.render(true);};
  function scope(){const k=key();if(S.key!==k)S={...initial(),key:k};return k;}
  async function api(action,data={}){
    const session=await window.Auth.session();if(!session)throw new Error('Sign in first.');
    const r=await fetch('/api/video',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,workspace_id:ws(),...data})});
    let j={};try{j=await r.json();}catch{}if(!r.ok){const e=new Error(j.error||'The Tella request failed. Try again.');e.status=r.status;throw e;}return j;
  }
  async function work(label,fn){
    if(S.busy)return;const k=key();S.busy=label;S.error='';draw();
    try{await fn(k);}catch(e){if(k===key())S.error=e.message;}finally{if(k===key()){S.busy='';draw();}}
  }
  async function load(force=false){
    const k=scope();if(!live()||S.loading||(S.loaded&&!force))return;S.loading=true;
    try{const r=await api('tella_list');if(k!==key())return;S.edits=r.edits;S.models=r.models||{};}
    catch(e){if(k===key())S.error=e.message;}finally{if(k===key()){S.loaded=true;S.loading=false;draw();}}
  }
  function take(r){
    if(r.edit){S.edit=r.edit;S.plan=r.edit.plan?JSON.parse(JSON.stringify(r.edit.plan)):null;S.dirty=false;
      const i=S.edits.findIndex(x=>x.id===r.edit.id),row={id:r.edit.id,title:r.edit.title,tella_video_id:r.edit.tella_video_id,revision:r.edit.revision,updated_at:r.edit.updated_at,status:r.edit.run?.status||null,run_revision:r.edit.run?.revision??null};
      if(i>=0)S.edits[i]=row;else S.edits.unshift(row);}
    if(r.approvals)S.approvals=r.approvals;else if(r.approval)S.approvals=[r.approval,...S.approvals.filter(a=>a.id!==r.approval.id)];
  }
  async function open(id){
    if(S.dirty&&!await U.dialog({title:'Discard storyboard changes?',body:'Your unsaved storyboard edits will be lost.',ok:'Discard',danger:true}))return;
    await work('Opening edit',async k=>{const r=await api('tella_detail',{id});if(k!==key())return;take(r);const run=runOf();S.tab=run&&['review','exporting','exported'].includes(run.status)?'finish':run?'apply':'storyboard';S.agent=null;});
    if(runOf()?.status==='exporting')poll();
  }
  const E=()=>S.edit,src=()=>S.edit?.source,rev=()=>S.edit?.revision;
  const runOf=()=>{const r=S.edit?.run;return r&&Number(r.revision)===rev()?r:null;};
  const approved=kind=>!!S.edit&&!S.dirty&&S.approvals.some(a=>a.kind===kind&&a.edit_revision===rev());
  const at=(clip,word)=>T.stamp(T.at(src(),clip,word));
  const line=(clip,word)=>T.sentenceAt(src(),clip,word)?.t||'';
  const span=(clip,from,to)=>(src().clips[clip]?.sentences||[]).filter(s=>s.l>=from&&s.f<=to).map(s=>s.t).join(' ');
  const clipName=c=>src().clips.length>1?`<small>Clip ${c+1}</small>`:'';

  /* ---------- picker ---------- */
  async function picker(query='',cursor=null){
    S.picker={...(S.picker||{}),open:true,query,loading:true,error:''};draw();
    try{const r=await api('tella_videos',{query,cursor});S.picker={open:true,query,loading:false,videos:cursor?[...(S.picker.videos||[]),...r.videos]:r.videos,next:r.next,imported:r.imported};}
    catch(e){S.picker={open:true,query,loading:false,videos:[],error:e.message,connect:e.status===409};}
    draw();
  }
  function pickerHTML(){
    const p=S.picker;if(!p?.open)return '';
    return `<section class="tl-picker" aria-label="Choose a Tella recording"><div class="os-section-head"><h2>Your Tella videos</h2><button class="btn sm ghost" data-action="tl-picker-close">Close</button></div>
      <form id="tl-search" data-nosubmit class="tl-search"><input name="q" type="search" placeholder="Search titles and transcripts" value="${esc(p.query||'')}" aria-label="Search Tella videos"><button class="btn sm" data-action="tl-search">Search</button></form>
      ${p.error?`<p class="os-error" role="alert">${esc(p.error)}${p.connect?' <button class="linkish" data-action="go" data-go="connect">Open Connections</button>':''}</p>`:''}
      ${p.loading&&!p.videos?.length?`<p class="meta">${U.spin||''}Reading your Tella library</p>`:''}
      <div class="tl-videos">${(p.videos||[]).map(v=>{const done=p.imported?.[v.id];return `<div class="tl-video"><div><b>${esc(v.name)}</b><small>${v.created_at?new Date(v.created_at).toLocaleDateString():''}${v.aspect?' · '+esc(v.aspect):''}</small></div>
        ${done?`<button class="btn sm" data-action="tl-open" data-id="${done}">Open edit</button>`:`<button class="btn sm primary" data-action="tl-import" data-id="${esc(v.id)}" ${S.busy?'disabled':''}>Import</button>`}</div>`;}).join('')||(!p.loading&&!p.error?'<p class="meta">No videos found.</p>':'')}</div>
      ${p.next?`<button class="btn sm ghost" data-action="tl-more">Load more</button>`:''}</section>`;
  }

  /* ---------- shell ---------- */
  function switcher(){return `<div class="os-tabs tl-mode" role="group" aria-label="Editing engine"><button data-action="ve-mode" data-v="tella" aria-pressed="${mode()==='tella'}">Tella</button><button data-action="ve-mode" data-v="render" aria-pressed="${mode()==='render'}">Upload and render</button></div>`;}
  function shell(){
    scope();if(live()&&!S.loaded&&!S.loading)queueMicrotask(()=>load());
    const head=U.title('Video editor','Plan the edit from your Tella recording and approve the storyboard. Founders OS then edits a copy in Tella. Nothing publishes without your yes.',
      switcher()+(live()?'<button class="btn primary" data-action="tl-pick">Import from Tella</button>':''));
    if(!live())return head+'<p class="os-notice">Sign in to edit your Tella recordings. Each workspace connects its own Tella API key.</p>';
    return head+pickerHTML()+`<div class="ve-layout"><aside class="ve-library" aria-label="Tella edits"><div class="os-section-head"><h2>Your edits</h2><button class="btn icon sm ghost" data-action="tl-refresh" aria-label="Refresh Tella edits">${icon('refresh')}</button></div>
      ${S.edits.map(x=>`<button class="ve-project ${S.edit?.id===x.id?'active':''}" data-action="tl-open" data-id="${x.id}" aria-pressed="${S.edit?.id===x.id}"><span>${esc(x.title)}</span><small>${statusText(x)}</small></button>`).join('')||`<p class="meta">${S.loading?'Loading':'No edits yet'}</p>`}
      </aside><div class="ve-work">${S.error?`<div class="os-error" role="alert">${esc(S.error)}</div>`:''}${S.busy?`<p class="meta tl-busy" role="status">${U.spin||''}${esc(S.busy)}</p>`:''}
      ${S.edit?editView():empty()}</div></div>`;
  }
  function statusText(x){const r=Number(x.run_revision)===x.revision?x.status:null;return 'Revision '+x.revision+(r==='exported'?' · Exported':r==='exporting'?' · Exporting':r==='review'?' · Ready to review':r==='applying'?' · Editing in Tella':r==='error'?' · Needs attention':'');}
  function empty(){
    return `<section class="ve-empty"><div class="ve-empty-frame">${icon('video')}</div><h2>Record in Tella. Edit here.</h2>
      <p>Import a recording and Founders OS reads the Tella transcript. Claude, OpenAI or Perplexity drafts a storyboard: the hook, cuts, layout changes, on-screen graphics, subtle sound design and chapters. You edit and approve it. Only then does Founders OS make a copy in Tella and apply exactly what you approved.</p>
      <button class="btn primary" data-action="tl-pick">Import from Tella</button></section>`;
  }
  function editView(){
    const e=E(),run=runOf();
    const state=S.dirty?'Unsaved changes':approved('final')?'Finished edit approved':run?.status==='review'?'Applied in Tella, ready to review':run?'Editing in Tella':approved('storyboard')?'Storyboard approved':S.plan?'Storyboard not approved':'No storyboard yet';
    return `<header class="ve-heading"><div><h2>${esc(e.title)}</h2><p class="meta">Revision ${e.revision} · ${state}${e.source.video.link?` · <a href="${esc(e.source.video.link)}" target="_blank" rel="noopener">Original in Tella</a>`:''}</p></div>
      ${S.plan?`<button class="btn" data-action="tl-save" ${S.busy||!S.dirty?'disabled':''}>${S.dirty?'Save changes':'Saved'}</button>`:''}</header>
      <div class="os-tabs ve-tabs" role="group" aria-label="Tella workflow">${[['storyboard','1. Storyboard'],['apply','2. Edit in Tella'],['finish','3. Export and publish']].map(([id,n])=>`<button data-action="tl-tab" data-v="${id}" aria-pressed="${S.tab===id}">${n}</button>`).join('')}</div>
      ${S.tab==='storyboard'?story():S.tab==='apply'?applyView():finishView()}`;
  }

  /* ---------- storyboard ---------- */
  const check=(path,v,label)=>`<label class="os-check"><input type="checkbox" data-p="${path}" ${v?'checked':''} ${S.busy?'disabled':''}>${label}</label>`;
  const select=(path,v,opts,label)=>`<label class="os-field"><span>${label}</span><select data-p="${path}" ${S.busy?'disabled':''}>${opts.map(([k,n])=>`<option value="${esc(k)}" ${String(k)===String(v)?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
  const input=(path,v,label,max=140)=>`<label class="os-field"><span>${label}</span><input data-p="${path}" value="${esc(v||'')}" maxlength="${max}" ${S.busy?'disabled':''}></label>`;
  const row=(list,i,x,body)=>`<div class="tl-item ${x.on===false?'off':''}">${x.on!==undefined?`<input type="checkbox" class="tl-on" data-p="${list}.${i}.on" ${x.on!==false?'checked':''} aria-label="Include" ${S.busy?'disabled':''}>`:'<span></span>'}<span class="tl-time">${at(x.clip,x.at??x.from)}</span><div class="tl-body">${clipName(x.clip)}${body}</div><button class="btn sm ghost" data-action="tl-remove" data-list="${list}" data-i="${i}" ${S.busy?'disabled':''}>Remove</button></div>`;
  function generator(){
    const models=Object.entries(S.models||{});
    return `<section class="tl-gen"><label class="os-field"><span>${S.plan?'What should change?':'What should this edit do?'}</span><textarea id="tl-brief" rows="4" placeholder="${S.plan?'Tighter intro, more screen time in the demo, fewer sounds':'Audience, goal, target length, what to keep or drop, the feel you want'}">${esc(S.plan?E().notes:S.brief)}</textarea></label>
      <div class="ve-plan-actions">${models.length?`<label class="os-field"><span>Model</span><select data-action="tl-model"><option value="auto">Best available</option>${models.map(([k,m])=>`<option value="${k}" ${S.model===k?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>`:''}
      <button class="btn primary" data-action="tl-generate" ${S.busy?'disabled':''}>${S.plan?'Revise storyboard':'Generate storyboard'}</button>${S.plan?'':'<button class="btn" data-action="tl-blank" '+(S.busy?'disabled':'')+'>Start blank</button>'}</div>
      <p class="meta">The model reads the Tella transcript and your Brain. It does not watch the footage, so check layouts against what is on screen.</p></section>`;
  }
  function story(){
    const p=S.plan,s=src();if(!p)return generator()+transcriptView();
    const sounds=[['','Choose a sound'],...s.assets.sounds.map(x=>[x.id,x.name+(x.category?' · '+x.category:'')])];
    const presets=[['','Tella default'],...s.assets.text.map(x=>[x.id,x.name])];
    const music=[['','No music'],...s.assets.music.map(x=>[x.id,x.name])];
    const c=T.counts(p);
    return `<form id="tl-story" data-nosubmit class="ve-form">
      <section class="tl-summary">${input('title',p.title,'Working title',180)}${p.summary?`<p>${esc(p.summary)}</p>`:''}${p.hook?`<p class="meta"><b>Hook.</b> ${esc(p.hook)}</p>`:''}
        <p class="meta">${c.cuts} cuts · ${c.layouts} layout changes · ${c.graphics} graphics · ${c.sounds} sounds · ${c.chapters} chapters</p></section>
      <section><h3>Cleanup</h3><div class="tl-grid">${check('cleanup.studio_sound',p.cleanup.studio_sound,'Studio sound')}${check('cleanup.fillers',p.cleanup.fillers,'Remove filler words')}
        ${select('cleanup.silences',p.cleanup.silences,[['off','Keep pauses'],['natural','Natural, over 0.8s'],['fast','Fast, over 0.5s'],['faster','Faster, over 0.3s']],'Pauses')}
        ${select('cleanup.zooms',p.cleanup.zooms,[['off','No automatic zooms'],['gentle','Gentle'],['subtle','Subtle'],['moderate','Moderate'],['focused','Focused']],'Zoom on screen clicks')}</div></section>
      <section><h3>Cuts</h3>${p.cuts.map((x,i)=>row('cuts',i,x,`<p class="tl-cut">${esc(span(x.clip,x.from,x.to).slice(0,420))}</p>${x.reason?`<small>${esc(x.reason)}</small>`:''}`)).join('')||'<p class="meta">No cuts. Add them from the transcript below.</p>'}</section>
      <section><h3>Layouts</h3>${p.layouts.map((x,i)=>row('layouts',i,x,`<div class="tl-fields">${select(`layouts.${i}.kind`,x.kind,Object.entries(T.LAYOUTS),'Layout')}${T.POSITIONS[x.kind]?select(`layouts.${i}.position`,x.position,T.POSITIONS[x.kind].map(v=>[v,v.replace('-',' ')]),'Position'):''}</div><small>${esc(line(x.clip,x.at).slice(0,160))}${x.reason?' · '+esc(x.reason):''}</small>`)).join('')||'<p class="meta">Tella keeps its own layout.</p>'}</section>
      <section><h3>Graphics</h3>${p.graphics.map((x,i)=>row('graphics',i,x,`<div class="tl-fields">${select(`graphics.${i}.kind`,x.kind,Object.entries(T.GRAPHICS),'Type')}${x.kind==='motion'?'':select(`graphics.${i}.preset`,x.preset||'',presets,'Style')}<label class="os-field"><span>Seconds</span><input type="number" min="0.6" max="20" step="0.5" data-p="graphics.${i}.ms" data-scale="1000" value="${x.ms/1000}" ${S.busy?'disabled':''}></label></div>
          <label class="os-field tl-wide"><span>${x.kind==='motion'?'Animation brief':'On-screen text'}</span><input data-p="graphics.${i}.text" value="${esc(x.text)}" maxlength="${x.kind==='motion'?600:140}" ${S.busy?'disabled':''}></label><small>${esc(line(x.clip,x.at).slice(0,160))}</small>`)).join('')||'<p class="meta">No graphics.</p>'}
        ${p.graphics.some(x=>x.kind==='motion')?check('motion_agent',p.motion_agent,'Let the Tella Agent build the animated graphics. This uses your Tella AI credits.'):''}</section>
      <section><h3>Sound design</h3>${p.sounds.map((x,i)=>row('sounds',i,x,`<div class="tl-fields">${select(`sounds.${i}.preset`,x.preset,sounds,'Sound')}<label class="os-field"><span>Volume</span><input type="range" min="0.05" max="1" step="0.05" data-p="sounds.${i}.volume" value="${x.volume}" ${S.busy?'disabled':''}></label></div><small>${esc(line(x.clip,x.at).slice(0,160))}</small>`)).join('')||'<p class="meta">No sound cues.</p>'}
        <div class="tl-grid">${select('music.preset',p.music.on?p.music.preset:'',music,'Background music')}${p.music.on?`<label class="os-field"><span>Music volume</span><input type="range" min="0.02" max="0.6" step="0.02" data-p="music.volume" value="${p.music.volume}"></label>`:''}</div></section>
      <section><h3>Chapters</h3>${p.chapters.map((x,i)=>row('chapters',i,x,input(`chapters.${i}.title`,x.title,'Title',90))).join('')||'<p class="meta">No chapters. YouTube needs at least three.</p>'}</section>
      <section><h3>Export</h3><div class="tl-grid">${select('export.resolution',p.export.resolution,[['4k','4K'],['1080p','1080p']],'Resolution')}${select('export.fps',p.export.fps,[[30,'30 fps'],[60,'60 fps']],'Frame rate')}${check('export.captions',p.export.captions,'Burn in captions')}</div>
        <p class="meta">4K needs a paid Tella plan. On Tella Pro, 60 fps is limited to videos up to 5 minutes.</p></section>
      ${p.limitations.length?`<section class="ve-limits"><h3>Check before approving</h3><ul>${p.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
      </form>${transcriptView()}${generator()}
      <section class="ve-approval"><h3>${approved('storyboard')?'This storyboard is approved':'Approve before editing'}</h3>
        <p>Approval covers this exact revision. Founders OS will copy the recording in Tella and apply only what is switched on above. Your original recording is never changed, and any saved change needs a fresh approval.</p>
        ${approved('storyboard')?`<button class="btn primary" data-action="tl-apply" ${S.busy?'disabled':''}>${runOf()?'Continue in Tella':'Apply in Tella'}</button>`:`<label class="os-check"><input id="tl-approve-check" type="checkbox" ${S.busy?'disabled':''}>I approve this storyboard for editing in Tella.</label><button class="btn primary" data-action="tl-approve" ${S.busy?'disabled':''}>${S.dirty?'Save and approve':'Approve storyboard'}</button>`}</section>`;
  }
  function transcriptView(){
    const s=src();const n=s.clips.reduce((a,c)=>a+c.sentences.length,0);
    return `<details class="tl-transcript"><summary>Transcript · ${n} lines${S.plan?' · add cuts, graphics, sounds and chapters':''}</summary>
      ${s.clips.map((c,ci)=>`${s.clips.length>1?`<h4>Clip ${ci+1} · ${esc(c.name)}</h4>`:''}${c.sentences.map(x=>`<p><span>${T.stamp(T.at(s,ci,x.f))}</span><span class="tl-line">${esc(x.t)}</span>${S.plan?`<span class="tl-add"><button class="linkish" data-action="tl-add" data-k="cuts" data-c="${ci}" data-f="${x.f}" data-l="${x.l}">Cut</button><button class="linkish" data-action="tl-add" data-k="graphics" data-c="${ci}" data-f="${x.f}">Graphic</button><button class="linkish" data-action="tl-add" data-k="sounds" data-c="${ci}" data-f="${x.f}">Sound</button><button class="linkish" data-action="tl-add" data-k="chapters" data-c="${ci}" data-f="${x.f}">Chapter</button><button class="linkish" data-action="tl-add" data-k="layouts" data-c="${ci}" data-f="${x.f}">Layout</button></span>`:''}</p>`).join('')}`).join('')}</details>`;
  }
  function setPath(path,el){
    const xs=path.split('.'),last=xs.pop();let o=S.plan;for(const k of xs)o=o[k];
    let v=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='number'||el.type==='range'||last==='fps')v=Number(v)*(Number(el.dataset.scale)||1);
    if(path==='music.preset'){S.plan.music.preset=v||null;S.plan.music.on=!!v;S.plan.music.name=src().assets.music.find(x=>x.id===v)?.name||'';return true;}
    if(last==='preset'&&xs[0]==='graphics')v=v||null;
    if(last==='preset'&&xs[0]==='sounds'){const m=src().assets.sounds.find(x=>x.id===v);o.name=m?.name||o.name;o.ms=m?.ms||o.ms;}
    o[last]=v;return last==='kind'||last==='on'&&xs[0]!=='cuts'?true:false;
  }
  function markDirty(){S.dirty=true;const h=document.querySelector('.ve-heading .meta');if(h)h.firstChild.textContent='Revision '+rev()+' · Unsaved changes';
    const b=document.querySelector('[data-action="tl-save"]');if(b){b.disabled=false;b.textContent='Save changes';}
    const a=document.querySelector('.ve-approval');if(a&&approved('storyboard')===false&&a.querySelector('[data-action="tl-apply"]'))draw();}
  function addItem(el){
    const c=Number(el.dataset.c),f=Number(el.dataset.f),l=Number(el.dataset.l),k=el.dataset.k,id=k.slice(0,3)+Date.now().toString(36);
    const sound=src().assets.sounds[0];
    const item={cuts:{id,clip:c,from:f,to:l,reason:'Added by you',on:true},graphics:{id,clip:c,at:f,ms:3500,kind:'lower_third',text:line(c,f).slice(0,80),notes:'',preset:null,on:true},
      sounds:sound?{id,clip:c,at:f,preset:sound.id,name:sound.name,volume:.4,ms:sound.ms||800,on:true}:null,chapters:{id,clip:c,at:f,title:line(c,f).slice(0,60),description:''},
      layouts:{id,clip:c,at:f,until:null,kind:'camera-only',position:null,reason:'Added by you',on:true}}[k];
    if(!item)return U.toast('Tella returned no sound library for this video. Re-import it to load sounds.');
    S.plan[k].push(item);if(k==='chapters')S.plan.chapters.sort((a,b)=>a.clip-b.clip||a.at-b.at);S.dirty=true;draw();U.toast('Added to the storyboard. Save to keep it.');
  }
  async function save(){
    if(!S.dirty)return;const r=await api('tella_save',{id:E().id,revision:rev(),plan:S.plan,title:S.plan?.title});take(r);
  }

  /* ---------- apply ---------- */
  const STEP={duplicate:'Copy the recording',verify:'Check the transcript matches',studio:'Studio sound',cuts:'Approved cuts',fillers:'Remove filler words',silences:'Tighten pauses',zooms:'Zoom on clicks',edits:'Layouts, graphics and sounds',chapters:'Chapters',music:'Background music',motion:'Animated graphics (Tella Agent)',preview:'Review link'};
  const stepName=k=>{const [a,n]=k.split(':');return STEP[a]+(n!=null&&src().clips.length>1?' · clip '+(Number(n)+1):'');};
  async function apply(restart=false){
    if(!approved('storyboard'))return U.toast('Approve this storyboard first.');
    S.tab='apply';
    await work('Editing in Tella. Keep this tab open.',async k=>{
      let first=true;
      for(let guard=0;guard<200;guard++){
        const r=await api('tella_step',{id:E().id,revision:rev(),restart:restart&&first});first=false;if(k!==key())return;take(r);draw();
        if(r.done)break;
      }
      if(runOf()?.status==='review')U.toast('Applied in Tella. Watch the review link, then approve or request changes.');
    });
  }
  function applyView(){
    const run=runOf();
    if(!approved('storyboard')&&!run)return '<p class="meta">Approve the storyboard first. Nothing changes in Tella until you do.</p>';
    if(!run)return `<section class="tl-apply"><p>Founders OS will copy the recording in Tella, then apply the approved storyboard step by step. Each step is logged here and can be retried.</p><button class="btn primary" data-action="tl-apply" ${S.busy?'disabled':''}>Apply in Tella</button></section>`;
    const done=run.log.filter(l=>l.ok).length;
    return `<section class="tl-apply"><div class="ve-progress"><progress max="${run.steps.length}" value="${done}" aria-label="Apply progress"></progress><div><span>${done} of ${run.steps.length} steps</span></div></div>
      <ol class="tl-steps">${run.steps.map(k=>{const l=run.log.find(x=>x.k===k);return `<li class="${l?l.ok?'ok':'bad':''}"><b>${esc(stepName(k))}</b>${l?`<small>${esc(l.note)}</small>`:''}</li>`;}).join('')}</ol>
      ${run.status==='error'?`<p class="os-error" role="alert">${esc(run.error||'A step failed.')}</p><div class="ve-plan-actions"><button class="btn primary" data-action="tl-apply" ${S.busy?'disabled':''}>Retry from this step</button><button class="btn" data-action="tl-restart" ${S.busy?'disabled':''}>Start over with a fresh copy</button></div>`:''}
      ${run.status==='applying'&&!S.busy?`<button class="btn primary" data-action="tl-apply">Continue</button>`:''}
      ${run.agent?`<div class="tl-agent"><h3>Tella Agent</h3><p class="meta">${S.agent?esc(S.agent.status+(S.agent.reply?' · '+S.agent.reply:'')):'Building the animated graphics in the background.'}</p><button class="btn sm" data-action="tl-agent">Check progress</button>${run.agent.url?` <a class="btn sm ghost" href="${esc(run.agent.url)}" target="_blank" rel="noopener">Open in Tella</a>`:''}</div>`:''}
      ${run.status!=='applying'&&run.status!=='error'?reviewHTML(run):''}</section>`;
  }
  function reviewHTML(run){
    const expired=!run.preview||Date.parse(run.preview.expires_at)<Date.now();
    return `<section class="ve-approval"><h3>Review the edit</h3>
      <p>Watch the review player. It shows the edited copy in Tella and updates a moment after any change. You can also fine-tune that copy directly in Tella before approving.</p>
      <div class="ve-plan-actions">${expired?`<button class="btn" data-action="tl-preview" ${S.busy?'disabled':''}>Get a new review link</button>`:`<a class="btn" href="${esc(run.preview.url)}" target="_blank" rel="noopener">Open review player</a>`}${run.view_link?`<a class="btn ghost" href="${esc(run.view_link)}" target="_blank" rel="noopener">Open the copy in Tella</a>`:''}</div>
      ${approved('final')?'<p><b>Finished edit approved.</b> Export it on the next step.</p>':`<label class="os-check"><input id="tl-final-check" type="checkbox" ${S.busy?'disabled':''}>I watched this edit and approve it for export.</label>
      <div class="ve-plan-actions"><button class="btn primary" data-action="tl-final" ${S.busy?'disabled':''}>Approve finished edit</button><button class="btn" data-action="tl-changes" ${S.busy?'disabled':''}>Request changes</button></div>`}</section>`;
  }

  /* ---------- export and publish ---------- */
  function finishView(){
    const run=runOf();if(!run||!approved('final'))return '<p class="meta">Apply the storyboard and approve the finished edit first. Export and publishing unlock after that.</p>';
    const x=run.export,p=S.plan,pub=run.publication;
    return `<section class="tl-finish"><h3>Export</h3><p class="meta">${esc(p.export.resolution.toUpperCase())} · ${p.export.fps} fps${p.export.captions?' · captions burned in':''}. Exports render on Tella's servers.</p>
      ${!x||x.status==='failed'?`${x?'<p class="os-error">The last export failed. Try again.</p>':''}<button class="btn primary" data-action="tl-export" ${S.busy?'disabled':''}>Start export</button>`:
        x.status==='completed'&&x.url?`<div class="ve-export"><div><h4>Export ready</h4><p class="meta">${esc(x.resolution||'')} · ${new Date(x.at).toLocaleString()}</p></div><a class="btn primary" href="${esc(x.url)}" target="_blank" rel="noopener" download>Download video</a></div>`:
        `<div class="ve-progress"><progress max="100" value="${x.progress||0}" aria-label="Export progress"></progress><div><span>${esc(x.status)} · ${Math.round(x.progress||0)}%</span><button class="btn sm ghost" data-action="tl-export-check">Check now</button></div></div>`}
      </section><section class="tl-finish"><h3>Publish to YouTube</h3>
      ${pub&&!['failed','cancelled'].includes(pub.status)?`<p>Sent to YouTube as ${esc(pub.privacy)}${pub.account?' on '+esc(pub.account):''}. Status: ${esc(pub.status)}.${pub.url?` <a href="${esc(pub.url)}" target="_blank" rel="noopener">Open on YouTube</a>`:''}</p>`:
      `<p class="meta">Optional. Tella uploads the finished edit through the YouTube account connected in Tella. This only happens when you confirm below.</p>
      ${S.accounts===null?`<button class="btn" data-action="tl-accounts" ${S.busy?'disabled':''}>Choose YouTube account</button>`:!S.accounts.length?'<p class="meta">No YouTube account is connected in Tella. Connect one in Tella Settings, Connections, or download the video and upload it yourself.</p>':
      `<form id="tl-publish" data-nosubmit class="ve-form">${select('_account','',S.accounts.map(a=>[a.id,a.name]),'YouTube account').replace('data-p="_account"','name="account"')}
        <label class="os-field"><span>Title</span><input name="title" maxlength="100" value="${esc(p.publish.title||p.title)}"></label>
        <label class="os-field"><span>Description</span><textarea name="description" rows="6">${esc(p.publish.description)}</textarea></label>
        <label class="os-field"><span>Visibility</span><select name="privacy">${[['private','Private'],['unlisted','Unlisted'],['public','Public']].map(([k,n])=>`<option value="${k}" ${p.publish.privacy===k?'selected':''}>${n}</option>`).join('')}</select></label>
        <label class="os-check"><input id="tl-publish-check" type="checkbox">I approve uploading this video to YouTube with these settings.</label>
        <button class="btn primary" data-action="tl-publish" ${S.busy?'disabled':''}>Upload to YouTube</button></form>`}`}</section>`;
  }
  async function poll(){
    if(S.polling)return;S.polling=true;const k=key(),id=E()?.id;
    try{
      for(let i=0;i<240;i++){
        await new Promise(r=>setTimeout(r,8000));
        if(k!==key()||E()?.id!==id||VS.view!=='video'||runOf()?.status!=='exporting')break;
        try{const r=await api('tella_export_status',{id,revision:rev()});take(r);draw();}catch(e){S.error=e.message;draw();break;}
      }
    }finally{S.polling=false;}
  }

  /* ---------- actions ---------- */
  ACT['ve-mode']=async el=>{if(el.dataset.v===mode())return;if(el.dataset.v==='render'&&S.dirty&&!await U.dialog({title:'Leave this storyboard?',body:'Unsaved storyboard changes will be lost.',ok:'Leave',danger:true}))return;
    if(el.dataset.v==='tella'&&window.VideoEditor&&!await window.VideoEditor.allowLeave(true))return;try{localStorage.setItem(MODE,el.dataset.v);}catch{}draw();};
  ACT['tl-pick']=()=>picker();ACT['tl-picker-close']=()=>{S.picker=null;draw();};
  ACT['tl-search']=()=>{const q=document.querySelector('#tl-search [name=q]')?.value||'';picker(q.trim());};
  ACT['tl-more']=()=>picker(S.picker.query,S.picker.next);
  ACT['tl-refresh']=()=>load(true);ACT['tl-open']=el=>{S.picker=null;open(el.dataset.id);};
  ACT['tl-import']=el=>work('Importing the recording and transcript from Tella',async k=>{const r=await api('tella_import',{video_id:el.dataset.id});if(k!==key())return;S.picker=null;S.approvals=[];take(r);S.tab='storyboard';if(r.existed)await open(r.edit.id);});
  ACT['tl-tab']=el=>{S.tab=el.dataset.v;draw();if(S.tab==='finish'&&runOf()?.status==='exporting')poll();};
  ACT['tl-model']=el=>{S.model=el.value;};
  ACT['tl-generate']=()=>{const t=document.getElementById('tl-brief')?.value||'';
    if(S.dirty)return U.toast('Save or discard your storyboard changes first.');
    work(S.plan?'Revising the storyboard':'Drafting the storyboard from the transcript. This can take a minute.',async k=>{
      const r=await api('tella_storyboard',{id:E().id,revision:rev(),model:S.model,brief:S.plan?'':t,notes:S.plan?t:''});if(k!==key())return;S.brief='';take(r);U.toast('Storyboard ready for your review.');});};
  ACT['tl-blank']=()=>work('Starting a blank storyboard',async()=>{take(await api('tella_save',{id:E().id,revision:rev(),plan:{title:E().title}}));});
  ACT['tl-save']=()=>work('Saving the storyboard',save);
  ACT['tl-remove']=el=>{S.plan[el.dataset.list].splice(Number(el.dataset.i),1);S.dirty=true;draw();};
  ACT['tl-add']=addItem;
  ACT['tl-approve']=()=>{if(!document.getElementById('tl-approve-check')?.checked)return U.toast('Tick the approval box first.');
    work('Approving this storyboard',async()=>{await save();take(await api('tella_approve',{id:E().id,revision:rev(),kind:'storyboard',confirm:true}));U.toast('Approved. Apply it in Tella when you are ready.');});};
  ACT['tl-apply']=()=>apply(false);
  ACT['tl-restart']=async()=>{if(await U.dialog({title:'Start over with a fresh copy?',body:'Founders OS makes a new copy of the original recording in Tella and applies the approved storyboard again. The earlier copy stays in your Tella library.',ok:'Start over'}))apply(true);};
  ACT['tl-preview']=()=>work('Getting a review link',async()=>{take(await api('tella_preview',{id:E().id,revision:rev()}));});
  ACT['tl-agent']=()=>work('Checking the Tella Agent',async()=>{S.agent=(await api('tella_agent',{id:E().id})).chat||{status:'not found'};});
  ACT['tl-final']=()=>{if(!document.getElementById('tl-final-check')?.checked)return U.toast('Tick the approval box first.');
    work('Approving the finished edit',async()=>{take(await api('tella_approve',{id:E().id,revision:rev(),kind:'final',confirm:true}));S.tab='finish';});};
  ACT['tl-changes']=async()=>{const r=await U.dialog({title:'What should change?',body:'Founders OS revises the storyboard with your notes. You approve the new version, and it is applied to a fresh copy in Tella.',fields:[{name:'notes',label:'Notes',type:'textarea',rows:6,required:true,value:E().notes||''}],ok:'Revise storyboard'});
    if(!r)return;S.tab='storyboard';work('Revising the storyboard with your notes',async k=>{const x=await api('tella_storyboard',{id:E().id,revision:rev(),model:S.model,notes:r.notes});if(k!==key())return;take(x);U.toast('Revised. Review and approve the new version.');});};
  ACT['tl-export']=()=>work('Starting the export in Tella',async()=>{take(await api('tella_export',{id:E().id,revision:rev()}));poll();});
  ACT['tl-export-check']=()=>work('Checking the export',async()=>{take(await api('tella_export_status',{id:E().id,revision:rev()}));});
  ACT['tl-accounts']=()=>work('Reading YouTube accounts connected in Tella',async()=>{S.accounts=(await api('tella_accounts')).accounts;});
  ACT['tl-publish']=()=>{const f=document.getElementById('tl-publish');if(!f)return;if(!document.getElementById('tl-publish-check')?.checked)return U.toast('Tick the approval box first.');
    const d=Object.fromEntries(new FormData(f));
    work('Sending to YouTube through Tella',async()=>{take(await api('tella_approve',{id:E().id,revision:rev(),kind:'publish',confirm:true}));
      take(await api('tella_publish',{id:E().id,revision:rev(),confirm:true,account_id:d.account,title:d.title,description:d.description,privacy:d.privacy}));U.toast('Sent to YouTube as '+d.privacy+'.');});};
  const onEdit=e=>{const el=e.target.closest('#tl-story [data-p]');if(!el||!S.plan)return;const redraw=setPath(el.dataset.p,el);if(redraw){S.dirty=true;draw();}else markDirty();};
  document.addEventListener('change',onEdit);
  document.addEventListener('input',e=>{if(e.target.closest('#tl-story input[type=text],#tl-story input:not([type])'))onEdit(e);});
  window.addEventListener('beforeunload',e=>{if(S.dirty||S.busy){e.preventDefault();e.returnValue='';}});
  window.TellaEditor={mode,shell,switcher,state:()=>S,load,reset:()=>{S.key=null;scope();},
    allowLeave:async()=>{if(S.busy){U.toast('Wait for the current Tella step to finish.');return false;}if(!S.dirty)return true;return !!await U.dialog({title:'Leave this storyboard?',body:'Your unsaved storyboard changes will be discarded.',ok:'Leave',danger:true});}};
})();

(() => {
  const U=window.UI,V=window.V,VS=window.VS,ACT=window.ACT,P=window.AgentSchema,{esc,icon}=U;
  const live=()=>!!window.App?.isLive(),ws=()=>window.App?.liveCtx().ws?.id,key=()=>[live()?'live':'demo',ws()].join(':');
  const S={key:null,loaded:false,loading:false,agents:[],tasks:[],runs:[],models:{},error:'',editor:null,cadence:null,proposal:null,busy:false,tab:'active',requests:{}};
  const render=()=>{if(['agents','routines','approvals'].includes(VS.view))window.App.render(true);};
  function scope(){const k=key();if(S.key!==k){Object.assign(S,{key:k,loaded:false,loading:false,agents:[],tasks:[],runs:[],models:{},error:'',editor:null,cadence:null,proposal:null,busy:false,tab:'active',requests:{}});}return k;}
  async function api(action,body={}){
    const workspace=ws();const session=await window.Auth.session();if(!session)throw new Error('Sign in first.');
    const r=await fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,workspace_id:workspace,...body})});
    let j={};try{j=await r.json();}catch{}if(!r.ok)throw new Error(j.error||'The agent request could not be completed. Try again.');return j;
  }
  async function load(force=false){
    const k=scope();if(S.loading||(S.loaded&&!force))return;S.loading=true;
    try{const r=live()?await api('list'):{agents:S.agents,tasks:S.tasks,runs:S.runs,models:{}};if(k!==key())return;Object.assign(S,r,{loaded:true,error:''});}
    catch(e){if(k===key()){S.error=e.message;S.loaded=true;}}
    finally{if(k===key()){S.loading=false;render();}}
  }
  const tz=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const freshTask=()=>P.task({name:'',deliverable:'Draft for review',instructions:'',output:'brief',schedule:{cadence:'weekly',time:'08:00',timezone:tz(),weekday:1,month_day:1},...{name:'Weekly brief'}});
  const taskData=t=>({...t,count:t.idea_count??t.count??5});
  const fields=(t,i,prefix='task')=>{
    const n=prefix==='task'?`tasks.${i}.`:'',f=P.formats.find(x=>x.id===t.format)||P.formats[5],s=t.schedule;
    const inp=(name,label,value,extra='')=>`<label class="os-field"><span>${label}</span><input name="${n+name}" value="${esc(value??'')}" ${extra}></label>`;
    return `<div class="os-fields">${inp('name','Task name',t.name,'required maxlength="140"')}
      <label class="os-field"><span>Deliver as</span><select name="${n}output" data-action="ag-output" data-index="${i}" ${prefix==='cadence'?'disabled':''}><option value="brief" ${t.output==='brief'?'selected':''}>Brief in run history</option><option value="ideas" ${t.output==='ideas'?'selected':''}>Ideas in the Newsfeed</option></select></label>
      <label class="os-field wide"><span>Task instructions</span><textarea name="${n}instructions" rows="3" maxlength="12000">${esc(t.instructions)}</textarea></label>
      <label class="os-field wide"><span>Deliverable</span><textarea name="${n}deliverable" rows="2" maxlength="2000" required>${esc(t.deliverable)}</textarea></label>
      ${t.output==='ideas'?`<label class="os-field"><span>Format</span><select name="${n}format" data-action="ag-format" data-index="${i}">${P.formats.map(f=>`<option value="${f.id}" ${f.id===t.format?'selected':''}>${f.name}</option>`).join('')}</select></label>
      <label class="os-field"><span>Platform</span><select name="${n}platform">${f.platforms.map(p=>`<option value="${p}" ${p===t.platform?'selected':''}>${P.platforms[p]}</option>`).join('')}</select></label>
      ${inp('count','Ideas per run',t.count,'type="number" min="1" max="10" required')}${inp('tags','Tags, comma separated',(t.tags||[]).join(', '),'maxlength="500"')}`:''}
      <label class="os-field"><span>Cadence</span><select name="${n}schedule.cadence" data-action="ag-cadence-mode" data-index="${i}">${Object.entries(P.cadences).map(([k,v])=>`<option value="${k}" ${s.cadence===k?'selected':''}>${v}</option>`).join('')}</select></label>
      ${inp('schedule.time','Local time',s.time,'type="time" required')}
      ${s.cadence==='weekly'?`<label class="os-field"><span>Day</span><select name="${n}schedule.weekday">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((v,i)=>`<option value="${i}" ${Number(s.weekday)===i?'selected':''}>${v}</option>`).join('')}</select></label>`:''}
      ${s.cadence==='monthly'?inp('schedule.month_day','Day of month, 1–28',s.month_day,'type="number" min="1" max="28" required'):''}
      ${inp('schedule.timezone','IANA time zone',s.timezone,'required maxlength="80" list="agent-timezones"')}
      <label class="os-check"><input type="checkbox" name="${n}enabled" ${t.enabled?'checked':''}>Task schedule enabled</label></div>`;
  };
  function capture(){
    const form=document.querySelector('#agent-form')||document.querySelector('#cadence-form');if(!form)return;
    const cadence=form.id==='cadence-form',target=cadence?S.cadence?.data:S.editor?.data;if(!target)return;
    for(const[k,v]of new FormData(form)){
      const path=k.split('.');let obj=target;
      if(k==='tasks'||k==='enabled')continue;
      for(const name of path.slice(0,-1))obj=obj[name];obj[path.at(-1)]=v;
    }
    if(cadence){target.enabled=form.elements.enabled.checked;target.tags=P.tags(target.tags);}
    else{target.enabled=form.elements.enabled.checked;target.tasks.forEach((t,i)=>{t.enabled=!!form.elements[`tasks.${i}.enabled`]?.checked;t.tags=P.tags(t.tags);});}
  }
  const zones='<datalist id="agent-timezones">'+['Europe/London','Europe/Berlin','Europe/Helsinki','America/New_York','America/Chicago','America/Los_Angeles','Asia/Singapore','Australia/Sydney','UTC'].map(x=>`<option value="${x}"></option>`).join('')+'</datalist>';
  function editor(){
    const e=S.editor,a=e.data;return U.title(e.revision?'Edit '+a.name:'Create an agent','Give it a role, reusable instructions and concrete recurring deliverables.',
      `<button class="btn" data-action="ag-back" ${S.busy?'disabled':''}>Back</button><button class="btn primary" data-action="ag-save" ${S.busy?'disabled':''}>${S.busy?U.spin+'Saving':'Save agent'}</button>`)+
      `<form id="agent-form" class="os-editor" data-nosubmit><div class="os-fields">
      <label class="os-field"><span>Name</span><input name="name" value="${esc(a.name)}" maxlength="100" required></label>
      <label class="os-field"><span>Role</span><input name="role" value="${esc(a.role)}" maxlength="240" required></label>
      <label class="os-field wide"><span>Operating instructions</span><textarea name="instructions" rows="5" maxlength="16000" required>${esc(a.instructions)}</textarea></label>
      <label class="os-field"><span>Model</span><select name="model"><option value="">Auto, from your connected keys</option>${Object.entries(S.models).map(([k,v])=>`<option value="${k}" ${a.model===k?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>
      <label class="os-check"><input name="enabled" type="checkbox" ${a.enabled?'checked':''}>Enable this agent and its active schedules</label></div>
      <p class="os-notice">Runs use your connected model key and may incur provider charges. Every run reads current Brand DNA, saved research, Vault briefs and content learning. No publishing, sending, MCP execution or program changes.</p>
      <div class="os-section-head"><h2>Recurring tasks</h2><button type="button" class="btn sm" data-action="ag-add-task" ${a.tasks.length>=12?'disabled':''}>${icon('plus')}Add task</button></div>
      ${a.tasks.map((t,i)=>`<section class="agent-task-edit"><header><h3>${esc(t.name||'Recurring task')}</h3><button type="button" class="btn sm ghost danger" data-action="ag-remove-task" data-index="${i}" ${a.tasks.length===1?'disabled':''}>Remove task</button></header>${fields(t,i)}</section>`).join('')}
      ${zones}${S.error?`<p class="os-error" role="alert">${esc(S.error)}</p>`:''}<footer class="os-editor-foot"><span class="meta">Schedules run within the next five-minute check. Times follow the selected time zone.</span><button type="button" class="btn primary" data-action="ag-save" ${S.busy?'disabled':''}>${S.busy?'Saving':'Save agent'}</button></footer></form>`;
  }
  const date=x=>x?new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not run yet';
  function taskRow(t){return `<div class="agent-task"><div class="grow"><h3>${esc(t.name)}</h3><p>${esc(t.deliverable)}</p><p class="meta">${esc(P.scheduleLabel(t.schedule))} · ${t.output==='ideas'?P.platforms[t.platform]+' ideas in the Newsfeed':'Brief in run history'}${!t.enabled?' · Task paused':''}</p>
    <p class="meta">${t.enabled?'Next: '+esc(P.nextRunLabel(t.next_run_at,t.schedule)):'No scheduled runs'}${t.last_status?' · Last run: '+esc(t.last_status):''}</p>${t.last_error?`<p class="os-error">${esc(t.last_error)}</p>`:''}</div><button class="btn sm" data-action="ag-run" data-id="${t.id}" ${S.requests[t.id]?.busy?'disabled':''}>${S.requests[t.id]?.busy?U.spin+'Running':'Run now'}</button></div>`;}
  function history(runs=S.runs){return `<div class="agent-history">${runs.length?runs.map(r=>{const t=S.tasks.find(t=>t.id===r.task_id);return `<button class="agent-run-row" data-action="ag-run-open" data-id="${r.id}"><div><b>${esc(t?.name||'Recurring task')}</b><span>${esc(date(r.created_at))} · ${r.trigger==='manual'?'Manual run':'Scheduled run'}</span></div><span class="pill ${r.status==='done'?'pos':r.status==='error'?'neg':''}">${esc(r.status)}</span>${icon('chevron')}</button>`;}).join(''):U.empty('No runs yet','Run a task now or wait for its next scheduled time.')}</div>`;}
  function view(){
    scope();if(!S.loaded&&!S.loading)queueMicrotask(()=>load());if(S.editor)return editor();
    const archived=S.tab==='archived',rows=S.agents.filter(a=>!!a.archived===archived);
    return U.title('Agents','Named roles, clear instructions and recurring work. Briefs stay here; ideas wait for you in the Newsfeed.',
      `<button class="btn" data-action="ag-chat">${icon('chat')}Create in AI Chat</button><button class="btn primary" data-action="ag-new">${icon('plus')}New agent</button>`) +
      (!live()?'<p class="os-notice">Demo workspace. You can try the editor, but no schedules or model calls run here.</p>':'')+
      `<div class="os-toolbar"><div class="os-tabs" role="group" aria-label="Agents view">${[['active','Your agents'],['history','Run history'],['archived','Archived']].map(([k,v])=>`<button data-action="ag-tab" data-v="${k}" aria-pressed="${S.tab===k}">${v}</button>`).join('')}</div><button class="btn sm ghost" data-action="ag-reload">${icon('refresh')}Refresh</button></div>
      ${S.error?`<div class="os-error" role="alert">${esc(S.error)}</div>`:''}
      ${S.loading&&!S.loaded?U.empty('Loading agents','One moment.'):S.tab==='history'?history():`<div class="agent-list">${rows.map(a=>`<article class="agent-row"><header><div><h2>${esc(a.name)}</h2><p>${esc(a.role)}</p></div><div class="actions"><span class="pill ${a.enabled&&!a.archived?'pos':''}">${a.archived?'Archived':a.enabled?'Active':'Paused'}</span><button class="btn sm" data-action="ag-edit" data-id="${a.id}">Edit</button><button class="btn sm ghost" data-action="ag-state" data-id="${a.id}">${a.enabled?'Pause':'Resume'}</button>${!a.archived?`<button class="btn sm ghost" data-action="ag-archive" data-id="${a.id}">Archive</button>`:''}</div></header>
      ${!a.archived?S.tasks.filter(t=>t.agent_id===a.id&&!t.archived).map(taskRow).join(''):''}</article>`).join('')||(!S.error?U.empty(archived?'No archived agents':'What should your first agent own?',archived?'Archived agents keep their run history.':'Create an agent in Chat, review its recurring tasks, then activate it. Or write the role and instructions yourself.','<button class="btn" data-action="ag-chat">Describe an agent in Chat</button>'):'')}</div>`}`;
  }
  function cadences(){
    scope();if(!S.loaded&&!S.loading)queueMicrotask(()=>load());const rows=S.tasks.filter(t=>t.kind==='ideation'&&!t.archived);
    return `<section class="cadence-section"><div class="os-section-head"><div><h2>Proactive ideation</h2><p>Set a separate schedule for each format and platform. Nothing is generated until you enable a cadence.</p></div><button class="btn" data-action="ag-cadence-new">${icon('plus')}Add cadence</button></div>
      ${S.error?`<p class="os-error">${esc(S.error)} <button class="btn sm" data-action="ag-reload">Retry</button></p>`:''}
      ${rows.length?rows.map(t=>`<article class="cadence-row"><div><h3>${esc(P.formats.find(f=>f.id===t.format)?.name||t.format)} <span class="meta">/ ${esc(P.platforms[t.platform])}</span></h3><p>${t.idea_count} ideas · ${esc(P.scheduleLabel(t.schedule))}</p><p class="meta">${t.enabled?'Next: '+esc(P.nextRunLabel(t.next_run_at,t.schedule)):'Paused'}${t.last_status?' · Last run '+esc(t.last_status):''}</p>${t.last_error?`<p class="os-error">${esc(t.last_error)}</p>`:''}</div><div class="actions"><button class="btn sm" data-action="ag-run" data-id="${t.id}" ${S.requests[t.id]?.busy?'disabled':''}>${S.requests[t.id]?.busy?'Running':'Run now'}</button><button class="btn sm" data-action="ag-cadence-edit" data-id="${t.id}">Edit cadence</button></div></article>`).join(''):!S.loading?'<p class="meta">No active cadences yet. Start with the formats you actually publish.</p>':'<p class="meta">Loading cadence settings.</p>'}
      <p class="meta">Schedules use your model keys and follow local time, including daylight saving changes. Server checks run every five minutes. Missed slots do not create a backlog of duplicate ideas.</p></section>`;
  }
  function drawCadence(){
    const e=S.cadence;if(!e)return;
    U.drawer(`<h2>${e.revision?'Edit cadence':'New idea cadence'}</h2><p class="meta">Ideas arrive in the Newsfeed with written drafts. You decide what moves to Content.</p>
      <form id="cadence-form" data-nosubmit>${fields(e.data,0,'cadence')}${zones}<p class="os-notice">Enabling this schedule authorizes recurring use of your connected AI key. It cannot send or publish.</p>
      ${S.error?`<p class="os-error" role="alert">${esc(S.error)}</p>`:''}<div class="actions"><button type="button" class="btn primary" data-action="ag-cadence-save" ${S.busy?'disabled':''}>${S.busy?'Saving':'Save cadence'}</button>${e.revision?'<button type="button" class="btn ghost danger" data-action="ag-cadence-remove">Archive cadence</button>':''}</div></form>`,{wide:true,label:'Proactive idea cadence'});
  }
  function start(row){scope();S.error='';S.editor=row?{revision:row.revision,data:{...JSON.parse(JSON.stringify(row)),tasks:S.tasks.filter(t=>t.agent_id===row.id&&!t.archived).map(t=>taskData(JSON.parse(JSON.stringify(t))))}}:
    {revision:0,data:{id:P.uuid(),name:'',role:'',instructions:'',model:'',enabled:true,tasks:[freshTask()]}};render();}
  async function save(){
    if(S.busy||!S.editor)return;const f=document.getElementById('agent-form');if(!f.reportValidity())return;capture();let a;try{a=P.agent(S.editor.data);}catch(e){S.error=e.message;render();return;}
    const k=key(),revision=S.editor.revision;S.busy=true;S.error='';render();
    try{if(live())await api('save',{agent:a,revision});else{S.agents=[{...a,revision:revision+1,archived:false},...S.agents.filter(x=>x.id!==a.id)];S.tasks=[...S.tasks.filter(t=>t.agent_id!==a.id),...a.tasks.map(t=>({...t,idea_count:t.count,agent_id:a.id,kind:'agent',next_run_at:null,archived:false}))];}
      if(k!==key())return;S.editor=null;U.toast('Agent saved'+(a.enabled?' with its schedules.':', paused.'));await load(true);
    }catch(e){if(k===key())S.error=e.message;}finally{if(k===key()){S.busy=false;render();}}
  }
  async function state(id,archive=false){
    const a=S.agents.find(x=>x.id===id);if(!a||S.busy)return;const k=key();
    if(archive&&!await U.dialog({title:'Archive '+a.name+'?',body:'Future runs stop. Existing drafts and run history are kept. A run already in progress may finish.',ok:'Archive agent'}))return;
    if(k!==key())return;S.busy=true;
    try{if(live())await api('state',{id,revision:a.revision,enabled:!archive&&!a.enabled,archived:archive});else Object.assign(a,{enabled:!archive&&!a.enabled,archived:archive,revision:a.revision+1});if(k===key())await load(true);}
    catch(e){if(k===key())U.toast(e.message);}finally{if(k===key()){S.busy=false;render();}}
  }
  async function run(id){
    if(!live())return U.toast('No provider calls run in the demo. Use your live workspace.');
    const t=S.tasks.find(x=>x.id===id);if(!t||S.requests[id]?.busy)return;
    const k=key(),yes=await U.dialog({title:'Run '+t.name+' now?',body:'This uses your connected AI key. The output stays a draft, and any ideas go to the Newsfeed. Nothing publishes or sends.',ok:'Run task'});
    if(!yes||k!==key())return;const request=S.requests[id]||={id:P.uuid()};request.busy=true;render();
    try{const r=await api('run',{id,request_id:request.id,confirm:true});if(k!==key())return;
      if(r.run?.status==='error')U.toast(r.run.error||'This run failed. Review its history.');else U.toast(r.run?.status==='done'?'Deliverable ready.':'Run queued. Check run history.');
      delete S.requests[id];window.OSBoard?.reset();await load(true);
    }catch(e){if(k===key())U.toast(e.message+' Check history before starting another run.');}
    finally{if(k===key()){if(S.requests[id])S.requests[id].busy=false;render();}}
  }
  async function openRun(id){
    const k=scope();try{const r=live()?(await api('detail',{id})).run:S.runs.find(r=>r.id===id);if(k!==key()||!r)return;
      const o=r.output||{};U.drawer(`<h2>${esc(o.title||r.snapshot?.task?.name||'Run details')}</h2><p class="meta">${esc(r.status)} · ${esc(date(r.created_at))}${r.model?' · '+esc(r.model):''}</p>
      ${r.error?`<p class="os-error" role="alert">${esc(r.error)}</p>`:''}${o.notice?`<p class="os-notice">${esc(o.notice)}</p>`:''}
      ${o.body?`<pre class="os-deliverable">${esc(o.body)}</pre><button class="btn sm" data-action="ag-copy-run" data-id="${r.id}">Copy deliverable</button>`:''}
      ${o.ideas?.map((x,i)=>`<section class="dsec"><h3>${esc(x.title)}</h3><p>${esc(x.hook)}</p><pre class="os-deliverable">${esc(x.body||x.outline?.join('\n')||'')}</pre>${o.content_ids?.[i]?`<button class="btn sm" data-action="ap-open" data-id="${o.content_ids[i]}">Review idea</button>`:''}</section>`).join('')||''}
      ${o.sources?.length?`<details class="dsec"><summary>Sources supplied to the agent</summary>${o.sources.map(s=>`<p>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title)}${s.observed_at?' · '+esc(date(s.observed_at)):''}</p>`).join('')}</details>`:''}
      ${['queued','running'].includes(r.status)?'<p>The job is still in progress. Refresh run history to check its result.</p>':''}`,{wide:true,label:'Agent deliverable'});S.openRun=r;
    }catch(e){if(k===key())U.toast(e.message);}
  }
  async function review(id){
    const k=scope();try{const {proposal:p}=await api('proposal',{id});if(k!==key())return;S.proposal=p;const a=p.data;
      U.drawer(`<h2>${esc(a.name)}</h2><p>${esc(a.role)}</p><section class="dsec"><h3>Operating instructions</h3><pre class="os-deliverable">${esc(a.instructions)}</pre></section>
      ${a.tasks.map(t=>`<section class="dsec"><h3>${esc(t.name)}</h3><p>${esc(t.deliverable)}</p><p class="meta">${esc(P.scheduleLabel(t.schedule))} · ${t.output==='ideas'?'Ideas in the Newsfeed':'Brief in run history'}${!t.enabled?' · Paused':''}</p><pre class="os-deliverable">${esc(t.instructions)}</pre></section>`).join('')}
      <p class="os-notice">This creates a new agent only. Existing agents and programs are unchanged. Scheduled runs use your connected model key. No sending, publishing or MCP execution.</p>
      ${p.status==='pending'?'<label class="os-check"><input id="agent-confirm-check" type="checkbox">I approve this role, these instructions and these recurring schedules.</label><div class="actions"><button class="btn primary" data-action="ag-confirm">Create agent & schedules</button><button class="btn" data-action="ag-dismiss">Dismiss proposal</button></div>':`<p>${p.status==='applied'?'This agent has been created. Manage it from Agents.':'This proposal was dismissed.'}</p>`}`,{wide:true,label:'Review agent proposal'});
    }catch(e){if(k===key())U.toast(e.message);}
  }
  V.agents=view;V.agents.live=view;
  V.routines=()=>U.title('Routines','Recurring work lives with your agents and idea cadence settings.','<a class="btn primary" href="#agents">Manage agents</a><a class="btn" href="#approvals">Idea cadences</a>')+cadences();V.routines.live=V.routines;
  ACT['ag-new']=()=>start();ACT['ag-edit']=el=>start(S.agents.find(x=>x.id===el.dataset.id));
  ACT['ag-save']=save;ACT['ag-reload']=()=>load(true);ACT['ag-tab']=el=>{S.tab=el.dataset.v;render();};
  ACT['ag-back']=async()=>{if(S.busy)return;if(await U.dialog({title:'Discard unsaved agent changes?',body:'Your saved agent and schedules remain unchanged.',ok:'Discard changes'})){S.editor=null;S.error='';render();}};
  ACT['ag-add-task']=()=>{capture();if(S.editor.data.tasks.length<12)S.editor.data.tasks.push(freshTask());render();};
  ACT['ag-remove-task']=el=>{capture();if(S.editor.data.tasks.length>1)S.editor.data.tasks.splice(Number(el.dataset.index),1);render();};
  for(const action of ['ag-output','ag-cadence-mode','ag-format'])ACT[action]=el=>{
    capture();const cadence=!!el.closest('#cadence-form'),t=cadence?S.cadence.data:S.editor.data.tasks[Number(el.dataset.index)];
    if(action==='ag-format'){const f=P.formats.find(f=>f.id===t.format);if(!f.platforms.includes(t.platform))t.platform=f.platforms[0];}
    cadence?drawCadence():render();
  };
  ACT['ag-state']=el=>state(el.dataset.id);ACT['ag-archive']=el=>state(el.dataset.id,true);ACT['ag-run']=el=>run(el.dataset.id);ACT['ag-run-open']=el=>openRun(el.dataset.id);
  ACT['ag-copy-run']=()=>{if(S.openRun?.output?.body)U.copy(S.openRun.output.body);};
  ACT['ag-cadence-new']=()=>{scope();S.error='';S.cadence={revision:0,data:{...freshTask(),name:'Weekly written ideas',output:'ideas',format:'post',platform:'linkedin',deliverable:'Complete written drafts, each with a hook, useful body, evidence and topic tags.'}};drawCadence();};
  ACT['ag-cadence-edit']=el=>{const t=S.tasks.find(t=>t.id===el.dataset.id);if(t){S.error='';S.cadence={revision:t.revision,data:taskData(JSON.parse(JSON.stringify(t)))};drawCadence();}};
  async function saveCadence(archived=false){
    if(S.busy||!S.cadence)return;const f=document.getElementById('cadence-form');if(!archived&&!f.reportValidity())return;capture();let t;
    try{t=P.task(S.cadence.data);}catch(e){S.error=e.message;drawCadence();return;}
    const k=key(),revision=S.cadence.revision;S.busy=true;S.error='';drawCadence();
    try{if(live())await api('cadence',{task:t,revision,archived});else S.tasks=[{...t,idea_count:t.count,kind:'ideation',revision:revision+1,archived,next_run_at:null},...S.tasks.filter(x=>x.id!==t.id)];
      if(k!==key())return;S.cadence=null;U.closeDrawer();await load(true);U.toast(archived?'Cadence archived.':t.enabled?'Idea cadence saved.':'Cadence saved, paused.');
    }catch(e){if(k===key()){S.error=e.message;}}
    finally{if(k===key()){S.busy=false;if(S.cadence)drawCadence();render();}}
  }
  ACT['ag-cadence-save']=()=>saveCadence();ACT['ag-cadence-remove']=()=>saveCadence(true);
  ACT['ag-review']=el=>review(el.dataset.id);
  ACT['ag-dismiss']=async el=>{
    const p=S.proposal,k=key();if(!p||el.disabled)return;el.disabled=true;
    try{await api('dismiss',{id:p.id});if(k!==key())return;S.proposal=null;U.closeDrawer();U.toast('Proposal dismissed. No agent or schedule was created.');}
    catch(e){if(k===key()){el.disabled=false;U.toast(e.message);}}
  };
  ACT['ag-confirm']=async el=>{
    const p=S.proposal,k=key();if(!p||el.disabled)return;if(!document.getElementById('agent-confirm-check')?.checked)return U.toast('Review the proposal and tick the approval box first.');
    el.disabled=true;try{await api('confirm',{id:p.id,digest:p.digest,confirm:true});if(k!==key())return;S.proposal=null;U.closeDrawer();await load(true);location.hash='#agents';U.toast('Agent created. Its enabled schedules are now active.');}
    catch(e){if(k===key()){el.disabled=false;U.toast(e.message);}}
  };
  ACT['ag-chat']=()=>{VS.chScope='agents';VS.chRoom=false;VS.chDraft='Create an agent that ';location.hash='#chat';window.App.render(true);document.getElementById('ch-input')?.focus();};
  document.addEventListener('input',e=>{if(e.target.closest('#agent-form,#cadence-form')){try{capture();}catch{/* validation is shown on save */}}});
  window.OSAgents={api,load,view,cadences,review,state:()=>S,reset:()=>{S.key=null;scope();}};
})();

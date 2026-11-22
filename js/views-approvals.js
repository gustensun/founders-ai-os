// The Newsfeed: one idea queue, shown as the posts the ideas would become.
// Approve moves the same row into Content. Deny takes it out of the feed for good.
(() => {
  const U=window.UI,V=window.V,VS=window.VS,ACT=window.ACT,P=window.AgentSchema,F=window.FeedPost,{esc,icon}=U;
  const PAGE=20,KEEP_DENIED_DAYS=30;
  const ws=()=>window.App?.liveCtx().ws?.id,key=()=>[window.App?.isLive()?'live':'demo',ws()].join(':');
  const fresh=()=>({feed:'ideas',tab:'ideas',q:'',format:'all',platform:'all',tag:'all',source:'all',more:false,limit:PAGE,open:{},editor:null,drafts:{},openRequest:0,busy:false,kitFor:null,purged:false});
  const S={key:null,...fresh()};
  function scope(){const k=key();if(S.key!==k)Object.assign(S,{key:k,...fresh()});return k;}
  const rows=()=>window.OSBoard?.all()||[],format=x=>x.meta?.idea_format||({'instagram':'reel','linkedin':'post','x':'post','facebook':'post'}[x.channel]||x.channel);
  const platform=x=>x.meta?.platform||({youtube:'youtube',short:'youtube',reel:'instagram',carousel:'instagram',tiktok:'tiktok',email:'email',podcast:'podcast'}[x.channel]||(['linkedin','x','facebook','instagram'].includes(x.channel)?x.channel:''));
  const origin=x=>x.meta?.agent_id?'agent':x.meta?.task_id?'cadence':x.meta?.funnel?'funnel':x.meta?.remix?'remix':x.meta?.from==='call'?'call':x.meta?.from==='watch'?'watch':x.meta?.from_memory?'memory':x.meta?.legacy_draft?'imported':'research';
  const sourceNames={agent:'Agents',cadence:'Cadences',remix:'Remixes',funnel:'Content Funnel',call:'Calls',watch:'Web watches',memory:'Memory',imported:'Earlier drafts',research:'Research & ideas'};
  const tags=x=>Array.isArray(x.meta?.tags)?x.meta.tags.filter(t=>typeof t==='string'):[];
  const body=x=>x.meta?.post_body??x.meta?.draft_body??x.meta?.body??x.meta?.script??'';
  const editable=x=>({title:x.title,hook:x.meta?.hook||'',body:body(x),outline:(x.meta?.outline||[]).join('\n'),tags:tags(x).join(', '),why:x.meta?.why||''});
  const draftStatus=e=>e?.dirty?'Unsaved edits are kept in this tab. Save them to keep them in your workspace.':'Your saved draft is up to date.';
  const safeURL=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const render=()=>{if(['approvals','jarvis'].includes(VS.view))window.App.render(true);};
  const formatName=x=>P.formats.find(f=>f.id===format(x))?.name||format(x);
  const SHORT={youtube:'Video',short:'Short',reel:'Reel',tiktok:'Video',carousel:'Carousel',post:'Post',email:'Email',newsletter:'Newsletter',article:'Article',podcast:'Episode'};
  const waiting=()=>rows().filter(x=>x.stage==='suggested');
  // Approved from this feed and still sitting in the first Content column.
  const approved=()=>rows().filter(x=>x.stage==='approved'&&(x.meta?.decision==='approved'||x.meta?.approved_at));

  /* ---------- the founder's brand, for the drawn thumbnails ---------- */
  const PLAIN={palette:{bg:'#ffffff',ink:'#141414',deep:'#141414',soft:'#f0f0f0',accent:'#595959'},fonts:{display:'Geist'},photos:[],handle:''};
  function brand(){
    const K=window.OSBrandKit;if(!K?.brand)return PLAIN;
    if(window.App?.isLive()&&S.kitFor!==key()){const k=S.kitFor=key();Promise.resolve().then(()=>K.load()).then(()=>{if(k===key())render();}).catch(()=>{});}
    return K.brand()||PLAIN;
  }
  // The headline face from the brand board: an uploaded font, or the Google font of that name.
  function loadFont(b){
    const fam=String(b.fonts?.display||'').trim();if(!/^[A-Za-z0-9 ]{2,40}$/.test(fam)||fam==='Geist')return 'Geist';
    const own=(window.OSBrandKit?.kit()?.kit?.custom_fonts||[]).find(f=>f&&f.family===fam&&f.file);
    if(own){
      let st=document.getElementById('nf-fontface');if(!st){st=document.createElement('style');st.id='nf-fontface';document.head.appendChild(st);}
      const css=`@font-face{font-family:"${fam}";src:url("${String(window.OSBrandKit.src(own.file)).replace(/["\\<>]/g,'')}");font-display:swap}`;if(st.textContent!==css)st.textContent=css;
      return fam;
    }
    let ln=document.getElementById('nf-fontlink');if(!ln){ln=document.createElement('link');ln.id='nf-fontlink';ln.rel='stylesheet';document.head.appendChild(ln);}
    const base='https://fonts.googleapis.com/css2?family='+fam.replace(/ /g,'+'),href=base+':wght@700&display=swap';
    if(ln.dataset.fam!==fam){ln.dataset.fam=fam;ln.onerror=()=>{ln.onerror=null;ln.href=base+'&display=swap';};ln.href=href;}
    return fam;
  }
  function founder(b){
    const live=window.App?.isLive(),c=window.App?.liveCtx()||{};
    return String((live?c.name:window.Store?.s?.settings?.name)||b.handle||'You').trim();
  }
  function avatar(b,name){
    const p=b.photos[0],u=p?window.OSBrandKit.src(p):'';
    const ini=esc(name.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()||'Y');
    return u?`<span class="nf-av"><img src="${esc(u)}" alt="" data-onerr="remove">${ini}</span>`:`<span class="nf-av">${ini}</span>`;
  }
  // A thumbnail or cover drawn from the brand board: its colours, its headline face and the founder's own photos.
  function thumb(x,b,shape){
    const own=shape==='wide'&&safeURL(x.meta?.thumb);
    if(own)return `<div class="nf-thumb wide" aria-hidden="true"><img class="nf-own" src="${esc(own)}" alt="" loading="lazy" data-onerr="gone:.nf-thumb"></div>`;
    const g=F.pick(F.grounds(b.palette),x.id,'g'),photo=F.pick(b.photos,x.id,'p'),url=photo?window.OSBrandKit.src(photo):'',text=F.thumbText(x);
    return `<div class="nf-thumb ${shape} fit-${F.fit(text)}" style="--g:${g.ground};--t:${g.text}" aria-hidden="true">${url?`<img class="nf-photo" src="${esc(url)}" alt="" loading="lazy" data-onerr="remove">`:''}<span>${esc(text)}</span></div>`;
  }
  const clampText=(x,text,lines)=>text?`<div class="nf-text clamp${S.open[x.id]?' open':''}" data-clamp style="--lines:${lines}">${esc(text)}</div><button class="nf-more" data-action="ap-more" data-id="${esc(x.id)}" aria-expanded="${!!S.open[x.id]}" hidden>${S.open[x.id]?'Show less':'Show more'}</button>`:'';
  const heading=x=>`<h2><button data-action="ap-open" data-id="${esc(x.id)}">${esc(x.title)}</button></h2>`;
  // Beside a cover that already carries the whole title, the title is not printed a second time.
  const beside=x=>F.thumbText(x)===F.tidy(x.title)?'':heading(x);
  // What a call idea carries instead of a draft: why it came up and what was said.
  const context=x=>{const m=x.meta||{};return `${m.why?`<p class="nf-why">${esc(m.why)}</p>`:''}${m.quote?`<p class="nf-quote">${esc('\u201c'+String(m.quote).replace(/^["\u201c]+|["\u201d]+$/g,'')+'\u201d')}</p>`:''}`;};
  const beats=(x,n)=>{const o=(x.meta?.outline||[]).filter(Boolean);return o.length?`<ol class="nf-beats">${o.slice(0,n).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${o.length>n?`<p class="nf-rest">${o.length-n} more ${o.length-n===1?'beat':'beats'} in the draft</p>`:''}`:'';};
  const LAYOUT={
    video:(x,b)=>{const m=x.meta||{};return `${thumb(x,b,'wide')}${heading(x)}${m.hook?`<p class="nf-hook">${esc(m.hook)}</p>`:context(x)}`;},
    vertical:(x,b)=>{const m=x.meta||{};return `<div class="nf-split">${thumb(x,b,'tall')}<div class="nf-copy">${beside(x)}${m.hook?`<p class="nf-hook">${esc(m.hook)}</p>`:''}${beats(x,4)}${m.caption?clampText(x,m.caption,4):!m.hook&&!m.outline?.length?context(x):''}</div></div>`;},
    audio:(x,b)=>{const m=x.meta||{};return `<div class="nf-split">${thumb(x,b,'square')}<div class="nf-copy">${beside(x)}${m.hook?`<p class="nf-hook">${esc(m.hook)}</p>`:context(x)}${beats(x,4)}</div></div>`;},
    carousel:(x,b)=>{
      const m=x.meta||{},list=F.slides(x),gs=F.grounds(b.palette),darks=gs.filter(g=>g.dark),cover=F.pick(darks.length?darks:gs,x.id,'g'),inner=gs.find(g=>!g.dark)||{ground:'#f2f2f2',text:'#141414'};
      return `<div class="nf-slides" role="group" aria-label="${esc(`Carousel, ${list.length} slides`)}" tabindex="0">${list.map((t,i)=>{const edge=i===0||(i===list.length-1&&list.length>2),g=edge?cover:inner;return `<div class="nf-slide${i===0?' cover':''} fit-${F.fit(t)}" style="--g:${g.ground};--t:${g.text}"><span>${esc(t)}</span><i>${i+1} / ${list.length}</i></div>`;}).join('')}</div>${heading(x)}${clampText(x,m.caption||m.hook||body(x),3)}`;
    },
    mail:(x)=>{const m=x.meta||{},text=body(x);return `<div class="nf-mail">${heading({...x,title:m.subject||x.title})}${m.preview||m.hook?`<p class="nf-preview">${esc(m.preview||m.hook)}</p>`:''}${text?clampText(x,text,7):context(x)}</div>`;},
    article:(x)=>{const m=x.meta||{},text=body(x);return `${heading(x)}${m.hook?`<p class="nf-hook">${esc(m.hook)}</p>`:''}${text?clampText(x,text,5):beats(x,5)||context(x)}`;},
    text:(x)=>{const m=x.meta||{},text=body(x)||[m.hook,...(m.outline||[])].filter(Boolean).join('\n\n');return text?clampText(x,text,9):`${heading(x)}${context(x)}`;},
  };
  function post(x,b,name){
    const fmt=format(x),pf=platform(x),place=P.platforms[pf]||'',what=(fmt==='post'&&F.tidy(x.meta?.requested_artifact).slice(0,24))||SHORT[fmt]||formatName(x),line=[place,place===what?'':what,F.ago(x.created_at)].filter(Boolean).join(' \u00b7 ');
    const done=x.stage!=='suggested',why=F.evidence(x);
    return `<article class="ap-idea nf-post" data-post="${esc(x.id)}" data-kind="${F.kind(fmt)}" aria-label="${esc(x.title)}">
      <header class="nf-head">${avatar(b,name)}<div><b>${esc(name)}</b><span>${esc(line)}</span></div></header>
      <div class="nf-body">${(LAYOUT[F.kind(fmt)]||LAYOUT.text)(x,b)}</div>
      ${why?`<button class="nf-why-link" data-action="ap-open" data-id="${esc(x.id)}">${esc(why)}</button>`:''}
      ${S.drafts[x.id]?.dirty?'<p class="meta nf-note">Unsaved edits in this tab. Open Edit to continue.</p>':''}
      <footer class="nf-actions">${done?`<button class="btn sm" data-action="ap-open" data-id="${esc(x.id)}">Open in Content${icon('arrow')}</button>`:
        `<button class="btn sm primary" data-action="ap-approve" data-id="${esc(x.id)}">${icon('check')}<span>Approve</span></button><button class="btn sm" data-action="ap-trash" data-id="${esc(x.id)}" aria-label="Deny ${esc(x.title)}">${icon('close')}<span>Deny</span></button><button class="btn sm ghost nf-edit" data-action="ap-open" data-id="${esc(x.id)}">${icon('edit')}<span>Edit</span></button>`}</footer></article>`;
  }

  // V2: three feeds. Your own posts, the creators you follow, and the ideas waiting for a yes or no.
  const FEEDS=[['mine','My content'],['creators','Creators'],['ideas','Ideas']];
  function feeds(){return `<div class="os-tabs nf-feeds" role="tablist" aria-label="Newsfeed">${FEEDS.map(([id,n])=>`<button role="tab" data-action="ap-feed" data-v="${id}" aria-selected="${S.feed===id}" aria-pressed="${S.feed===id}">${n}${id==='ideas'?`<span>${waiting().length}</span>`:''}</button>`).join('')}</div>`;}
  function tabs(){return `<div class="segmented nf-sub" role="group" aria-label="Ideas view">${[['ideas','Waiting'],['approved','Approved'],['cadences','Idea cadences']].map(([id,n])=>`<button data-action="ap-tab" data-v="${id}" aria-pressed="${S.tab===id}">${n}</button>`).join('')}</div>`;}
  function filters(base){
    const counts=base.reduce((m,x)=>(m[format(x)]=(m[format(x)]||0)+1,m),{}),active=['platform','tag','source'].filter(k=>S[k]!=='all').length+(S.q.trim()?1:0),show=S.more||active>0;
    const chip=(id,name,n)=>`<button data-action="ap-filter" data-field="format" value="${esc(id)}" aria-pressed="${S.format===id}">${esc(name)}<span>${n}</span></button>`;
    const opts=(field,label,list)=>`<label class="ap-filter"><span>${label}</span><select data-action="ap-filter" data-field="${field}"><option value="all">All ${label.toLowerCase()}s</option>${list.map(([k,n])=>`<option value="${esc(k)}" ${S[field]===k?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
    return `<div class="nf-bar"><div class="nf-chips" role="group" aria-label="Format">${chip('all','All',base.length)}${P.formats.filter(f=>counts[f.id]||S.format===f.id).map(f=>chip(f.id,F.CHIP[f.id]||f.name,counts[f.id]||0)).join('')}</div>
      <button class="btn sm ghost nf-filter-toggle" data-action="ap-filters" aria-expanded="${show}" aria-controls="nf-filters">Filters${active?`<span>${active}</span>`:''}</button></div>
      ${show?`<div class="ap-filters" id="nf-filters">${opts('platform','Platform',Object.entries(P.platforms))}${opts('tag','Tag',[...new Set(base.flatMap(tags))].sort().map(x=>[x,x]))}${opts('source','Source',Object.entries(sourceNames))}
      <label class="os-search"><span class="sr">Search posts</span><input type="search" data-apsearch value="${esc(S.q)}" placeholder="Search posts and drafts"></label></div>`:''}`;
  }
  function matching(base){
    const q=S.q.trim().toLowerCase();
    const list=base.filter(x=>(S.format==='all'||format(x)===S.format)&&(S.platform==='all'||platform(x)===S.platform)&&(S.tag==='all'||tags(x).includes(S.tag))&&(S.source==='all'||origin(x)===S.source)&&(!q||[x.title,body(x),x.meta?.hook,tags(x).join(' ')].join(' ').toLowerCase().includes(q))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    return F.mix(list,format);
  }
  const moreRow=(left)=>left>0?`<div class="nf-next" data-nfnext><button class="btn" data-action="ap-page">Show ${Math.min(PAGE,left)} more</button></div>`:'<p class="meta nf-end">That is everything waiting. Nothing publishes on its own.</p>';
  // Denied posts are kept out of sight for a while so the same idea is not suggested again, then removed for good.
  function purge(){
    if(S.purged||!window.App?.isLive()||window.OSBoard.status().loading)return;const all=rows();if(!all.length)return;S.purged=true;
    const cut=Date.now()-KEEP_DENIED_DAYS*864e5;
    const old=all.filter(x=>x.stage==='passed'&&x.meta?.decision==='passed'&&!x.meta?.passed_reason&&!x.meta?.funnel&&Date.parse(x.meta?.decision_at||x.updated_at)<cut).slice(0,40);
    old.reduce((p,x)=>p.then(()=>window.Auth.content.remove(x.id)).catch(()=>{}),Promise.resolve());
  }
  function feed(){
    const status=window.OSBoard.status(),done=S.tab==='approved',base=done?approved().sort((a,b)=>String(b.meta?.approved_at||b.updated_at||'').localeCompare(String(a.meta?.approved_at||a.updated_at||''))):waiting();
    const list=done?base:matching(base),b=brand(),name=founder(b),shown=list.slice(0,S.limit);
    U.after(wire);
    return `${done||!base.length?'':filters(base)}${status.error?`<p class="os-error" role="alert">${esc(status.error)} <button class="btn sm" data-action="ap-refresh">Retry</button></p>`:''}
      ${!done&&list.length!==base.length?`<p class="meta ap-count">${list.length} of ${base.length} posts</p>`:''}
      ${done&&list.length?'<p class="meta ap-count">Approved posts live in Content. This is the short list of what you said yes to here.</p>':''}
      ${status.loading&&!base.length?U.empty('Loading your feed','Reading your saved ideas.'):list.length?`<div class="nf-list" data-nflist>${shown.map(x=>post(x,b,name)).join('')}</div>${done&&list.length<=S.limit?'':moreRow(list.length-shown.length)}`:
      done?U.empty('Nothing approved yet','Posts you approve in the Newsfeed move to Content and show up here.','<button class="btn" data-action="ap-tab" data-v="ideas">Back to the Newsfeed</button>'):
      U.empty(base.length?'No posts match these filters':'Your feed is clear',base.length?'Try another format, platform or tag.':'New ideas arrive here as finished-looking posts. Add a daily or weekly cadence, or remix a post that already worked.',
      base.length?'<button class="btn" data-action="ap-clear">Clear filters</button>':'<div class="nf-empty-actions"><button class="btn" data-action="ap-tab" data-v="cadences">Set idea cadences</button><a class="btn ghost" href="#proven">Remix proven content</a></div>')}`;
  }
  // Web watches (Perplexity Monitor): new findings land here as ideas. Read when the Newsfeed opens, at most every ten minutes.
  const W={list:null,for:null,at:0,busy:false,err:null};
  async function wapi(action,body={}){const s=await window.Auth.session();if(!s)throw new Error('Sign in first');const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action,workspace_id:ws(),...body})});let j={};try{j=await r.json();}catch{}if(!r.ok)throw new Error(j.error||'Web watches could not be read. Check Perplexity under Connections.');return j;}
  function watchSync(force){
    if(!window.App?.isLive()||!window.Conn?.on?.('perplexity')||W.busy)return;
    const k=key();if(!force&&W.for===k&&Date.now()-W.at<6e5)return;
    W.busy=true;W.for=k;W.at=Date.now();
    wapi('watches').then(r=>{W.list=r.watches||[];W.err=null;render();return W.list.length?wapi('watch_pull'):null;})
      .then(p=>{if(p&&p.added){window.OSBoard.load(true);U.toast(p.added+' new '+(p.added===1?'idea':'ideas')+' from your web watches');}})
      .catch(e=>{W.err=e.message;render();}).finally(()=>{W.busy=false;});
  }
  function watches(){
    if(!W.list||W.for!==key()||(!W.list.length&&!W.err))return '';
    const every={'6h':'every 6 hours','1d':'daily','1w':'weekly'};
    return `<div class="nf-watches"><span class="meta">Web watches</span>${W.err?`<span class="meta">${esc(W.err)} <a href="#connect">Open Connections</a></span>`:W.list.map(w=>`<span class="chip">${esc(w.name)} <span class="meta">${esc(every[w.every]||'')}</span><button class="nf-unwatch" data-action="ap-unwatch" data-id="${esc(w.id)}" aria-label="Stop watching ${esc(w.name)}">Stop</button></span>`).join('')}<span class="meta">Ask AI Chat to watch a topic or page.</span></div>`;
  }
  ACT['ap-unwatch']=async(el)=>{el.disabled=true;try{const r=await wapi('watch_stop',{id:el.dataset.id});W.list=(W.list||[]).filter(w=>w.id!==el.dataset.id);U.toast('Stopped watching '+(r.stopped||'that'));render();}catch(e){el.disabled=false;U.toast(e.message);}};
  function view(){
    scope();queueMicrotask(()=>window.OSBoard?.load());if(!['ideas','approved','cadences'].includes(S.tab))S.tab='ideas';
    const b=brand();purge();
    if(!FEEDS.some(([id])=>id===S.feed))S.feed='ideas';
    const sub={mine:'Every post from your own channels in one feed. Remix the ones worth another round.',creators:'Every new post from the creators you follow. Remix what fits your brand.',ideas:'Researched ideas, drafted and shown the way they would look. Approve the ones worth making and they move to Content. Deny the rest and they are gone.'}[S.feed];
    if(S.feed==='ideas')queueMicrotask(()=>watchSync(false));
    const body=S.feed==='ideas'?`<div class="os-toolbar nf-ideabar">${tabs()}</div>${S.tab==='ideas'?watches():''}${S.tab==='cadences'?window.OSAgents.cadences():feed()}`:(window.NFStreams?window.NFStreams.render(S.feed):'');
    return `<div class="nf" style="--nf-display:'${loadFont(b)}'">${U.title('Newsfeed',sub)}
      <div class="os-toolbar">${feeds()}<button class="btn sm ghost" data-action="ap-refresh">${icon('refresh')}Refresh</button></div>
      ${body}</div>`;
  }
  // After each render: reveal "Show more" only where text is really cut, keep the chosen chip in view, and load the next page near the end.
  let watcher=null;
  function wire(){
    const box=document.querySelector('#canvas .nf');if(!box)return;
    box.querySelectorAll('[data-clamp]').forEach(el=>{const b=el.nextElementSibling;if(b?.matches('.nf-more'))b.hidden=!el.classList.contains('open')&&el.scrollHeight<=el.clientHeight+2;});
    const chips=box.querySelector('.nf-chips'),on=chips?.querySelector('[aria-pressed="true"]');
    if(on&&(on.offsetLeft<chips.scrollLeft||on.offsetLeft+on.offsetWidth>chips.scrollLeft+chips.clientWidth))chips.scrollLeft=Math.max(0,on.offsetLeft-12);
    watcher?.disconnect();const next=box.querySelector('[data-nfnext]');
    if(next&&'IntersectionObserver' in window){watcher=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))page();},{rootMargin:'600px 0px'});watcher.observe(next);}
  }
  // The next page is added below the posts already on screen, so nothing above it moves or reloads.
  function page(){
    const box=document.querySelector('#canvas [data-nflist]'),next=document.querySelector('#canvas [data-nfnext]');if(!box||!next||S.tab==='cadences')return;
    const list=S.tab==='approved'?approved():matching(waiting()),from=box.querySelectorAll('.nf-post').length,b=brand(),name=founder(b);
    S.limit=from+PAGE;box.insertAdjacentHTML('beforeend',list.slice(from,S.limit).map(x=>post(x,b,name)).join(''));
    next.outerHTML=moreRow(list.length-S.limit);wire();
  }
  async function open(id){
    if(S.busy)return U.toast('Wait for the current save or decision to finish.');
    const k=scope();capture();const request=++S.openRequest;try{await window.OSBoard.load();if(k!==key()||request!==S.openRequest)return;const x=rows().find(x=>x.id===id);if(!x)throw new Error('This post is no longer available. Refresh your feed.');
      if(!['suggested','passed'].includes(x.stage)){U.closeDrawer();return window.OSBoard.open(id);}
      const saved=S.drafts[id],data=editable(x);
      S.editor=saved?.dirty?saved:{id:x.id,updated_at:x.updated_at,data,baseline:JSON.stringify(data),dirty:false};S.drafts[id]=S.editor;
      drawEditor(x);
    }catch(e){if(k===key())U.toast(e.message);}
  }
  function drawEditor(x){
    const e=S.editor,m=x.meta||{},d=e.data,refs=m.evidence||[];
    U.drawer(`<h2>${esc(x.title)}</h2><p class="meta">${esc(formatName(x))}${platform(x)?' / '+esc(P.platforms[platform(x)]||platform(x)):''} · ${x.stage==='passed'?'Denied':'Waiting for your decision'}</p>
      <p class="meta" data-apdraft role="status">${esc(draftStatus(e))}</p>
      <form id="approval-form" data-idea="${esc(x.id)}" data-nosubmit><label class="os-field"><span>Title</span><input name="title" value="${esc(d.title)}" required maxlength="300"></label>
      <label class="os-field"><span>Hook / opening</span><textarea name="hook" rows="2" maxlength="4000">${esc(d.hook)}</textarea></label>
      <label class="os-field"><span>Written content / script</span><textarea name="body" rows="14" maxlength="45000" placeholder="Write or refine the actual content here.">${esc(d.body)}</textarea></label>
      <label class="os-field"><span>Outline / production beats, one per line</span><textarea name="outline" rows="5" maxlength="15000">${esc(d.outline)}</textarea></label>
      <label class="os-field"><span>Tags, comma separated</span><input name="tags" maxlength="500" value="${esc(d.tags)}"></label>
      <label class="os-field"><span>Why this idea fits</span><textarea name="why" rows="3" maxlength="4000">${esc(d.why)}</textarea></label>
      ${refs.length||safeURL(m.source_url)?`<section class="dsec"><h3>Behind the idea</h3>${refs.map(r=>`<p>${safeURL(r.url)?`<a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title||'Saved reference')}</a>`:esc(r.title||'Workspace context')}${r.outlier?' · '+Number(r.outlier).toFixed(1)+'x creator median':''}</p>`).join('')}${!refs.length?`<p><a href="${esc(safeURL(m.source_url))}" target="_blank" rel="noopener noreferrer">View original reference</a></p>`:''}<p class="meta">${esc(m.evidence_status||'Saved source evidence, not a promise about this draft’s performance.')}</p></section>`:''}
      <p class="os-notice">Save your edits before approving. Approving moves this same post into Content, with its draft, tags and evidence intact.</p>
      <p class="os-error" data-aperror role="alert"></p><div class="actions"><button type="button" class="btn" data-action="ap-save">Save edits</button>${x.stage==='passed'?`<button type="button" class="btn primary" data-action="ap-restore" data-id="${x.id}">Put back in the feed</button>`:`<button type="button" class="btn primary" data-action="ap-approve" data-id="${x.id}">Approve</button><button type="button" class="btn ghost" data-action="ap-trash" data-id="${x.id}">Deny</button>`}<button type="button" class="btn ghost" data-action="ap-discard" ${e.dirty?'':'disabled'}>Discard unsaved edits</button></div></form>`,{wide:true,label:'Review and edit idea'});
  }
  function capture(){
    const f=document.getElementById('approval-form'),e=S.editor;if(!f||!e||f.dataset.idea!==e.id)return;
    e.data=Object.fromEntries(new FormData(f));const wasDirty=e.dirty;e.dirty=JSON.stringify(e.data)!==e.baseline;S.drafts[e.id]=e;
    const status=document.querySelector('[data-apdraft]');if(status)status.textContent=draftStatus(e);
    const discard=f.querySelector('[data-action="ap-discard"]');if(discard)discard.disabled=!e.dirty||S.busy;
    if(wasDirty!==e.dirty)queueMicrotask(render);
  }
  function dirty(x){capture();return !!S.drafts[x.id]?.dirty;}
  async function save(){
    const f=document.getElementById('approval-form');if(S.busy||!S.editor||!f||!f.reportValidity())return false;capture();
    const x=rows().find(x=>x.id===S.editor.id),k=key(),d=S.editor.data;if(!x)return false;S.busy=true;f.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=true);
    try{const meta={...x.meta,hook:d.hook,draft_body:d.body,post_body:d.body,outline:d.outline.split('\n').map(x=>x.trim()).filter(Boolean),tags:P.tags(d.tags),why:d.why};
      const ok=await window.OSBoard.edit(x.id,{title:d.title.trim(),meta},S.editor.updated_at);if(!ok||k!==key())return false;
      const saved=rows().find(row=>row.id===x.id),data=editable(saved);
      S.drafts[x.id]={id:x.id,updated_at:saved.updated_at,data,baseline:JSON.stringify(data),dirty:false};
      if(S.editor?.id===x.id){S.editor=S.drafts[x.id];if(document.querySelector('#drawer.open #approval-form')?.dataset.idea===x.id)drawEditor(saved);}
      U.toast('Idea edits saved.');render();return true;
    }catch(e){if(k===key()){const el=document.querySelector('[data-aperror]');if(el)el.textContent=e.message;}return false;}
    finally{if(k===key()){S.busy=false;f.querySelectorAll('button,input,textarea').forEach(b=>b.disabled=false);}}
  }
  // The post folds away once the decision is saved. Skipped when motion is reduced.
  function leave(id){
    const el=document.querySelector(`#canvas [data-post="${window.CSS?.escape?CSS.escape(id):id}"]`);
    if(!el||!el.animate||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return Promise.resolve();
    const h=el.offsetHeight;el.style.overflow='hidden';
    const a=el.animate([{height:h+'px',opacity:1},{height:h+'px',opacity:0,offset:.4},{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px'}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    return Promise.race([a.finished.catch(()=>{}),new Promise(r=>setTimeout(r,360))]);
  }
  async function decide(el,stage){
    const k=scope(),x=rows().find(x=>x.id===el.dataset.id);if(!x||S.busy||el.disabled)return;
    if(dirty(x)){await open(x.id);U.toast('Save your edits first so the decision includes your latest draft.');document.querySelector('[data-action="ap-save"]')?.focus();return;}
    const card=document.querySelector(`#canvas [data-post="${window.CSS?.escape?CSS.escape(x.id):x.id}"]`);
    S.busy=true;el.disabled=true;card?.classList.add('deciding');
    try{
      const changed=await window.OSBoard.decide(x.id,stage,x.updated_at);if(!changed||k!==key())return;
      delete S.drafts[x.id];delete S.open[x.id];S.editor=null;U.closeDrawer();
      if(stage==='passed')U.toast('Denied. It is out of your feed.',{undo:async()=>{if(k!==key())return;try{await window.OSBoard.decide(x.id,'suggested');render();}catch(e){U.toast(e.message);}}});
      else U.toast(stage==='approved'?'Approved. It is now in Content.':'Back in your feed.');
      if(stage!=='suggested')await leave(x.id);
      if(k===key())render();
    }
    catch(e){if(k===key())U.toast(e.message);}finally{if(k===key()){S.busy=false;el.disabled=false;card?.classList.remove('deciding');}}
  }
  function home(){
    scope();queueMicrotask(()=>window.OSBoard?.load());const xs=rows().filter(x=>x.stage==='suggested').sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6);
    return `<section class="morning-brief"><header class="mb-head"><div><h2>Posts waiting for you</h2><p>A short look at your Newsfeed. Open it to see each idea as the post it would become.</p></div><a class="btn sm" href="#approvals">Open Newsfeed${icon('arrow')}</a></header>
      <div class="mb-groups">${xs.map(x=>`<button class="mb-row" data-action="ap-open" data-id="${x.id}"><span class="mb-row-copy"><span class="mb-row-title">${esc(x.title)}</span><span class="mb-row-summary">${esc(formatName(x))}${platform(x)?' · '+esc(P.platforms[platform(x)]||platform(x)):''}</span></span><span class="mb-row-tail">${icon('chevron')}</span></button>`).join('')||'<p class="mb-group-empty">Nothing waiting. Set a daily or weekly idea cadence in the Newsfeed.</p>'}</div><footer class="mb-foot"><a href="#approvals">Manage idea cadences</a><button class="btn sm ghost" data-action="cl-open">Content learning</button></footer></section>`;
  }
  V.approvals=view;V.approvals.live=view;
  ACT['ap-tab']=el=>{S.feed='ideas';S.tab=el.dataset.v;S.limit=PAGE;render();};ACT['ap-feed']=el=>{S.feed=el.dataset.v;if(S.feed==='ideas'&&S.tab==='cadences')S.tab='ideas';render();};ACT['ap-open']=el=>open(el.dataset.id);ACT['ap-save']=save;
  ACT['ap-discard']=async()=>{
    capture();const k=key(),id=S.editor?.id;if(S.busy||!S.drafts[id]?.dirty)return;
    if(!await U.dialog({title:'Discard unsaved idea edits?',body:'Only the edits kept in this tab will be removed. Your saved draft stays unchanged.',ok:'Discard unsaved edits',danger:true})||k!==key())return;
    delete S.drafts[id];if(S.editor?.id===id)S.editor=null;await open(id);render();
  };
  ACT['ap-approve']=el=>decide(el,'approved');ACT['ap-trash']=el=>decide(el,'passed');ACT['ap-restore']=el=>decide(el,'suggested');
  ACT['ap-refresh']=()=>{window.OSBoard.load(true);window.OSAgents.load(true);window.NFStreams?.refresh();watchSync(true);if(window.App?.isLive())window.App.reloadConns?.().then(()=>render()).catch(()=>{});};
  ACT['ap-filter']=el=>{S[el.dataset.field]=el.value;S.limit=PAGE;render();};ACT['ap-tag']=el=>{S.tag=el.dataset.v;S.limit=PAGE;render();};
  ACT['ap-filters']=()=>{S.more=!S.more;if(!S.more)Object.assign(S,{q:'',platform:'all',tag:'all',source:'all'});render();};
  ACT['ap-page']=()=>page();
  ACT['ap-more']=el=>{const t=el.previousElementSibling,id=el.dataset.id;if(!t)return;const open=t.classList.toggle('open');if(open)S.open[id]=true;else delete S.open[id];el.setAttribute('aria-expanded',String(open));el.textContent=open?'Show less':'Show more';};
  ACT['ap-clear']=()=>{Object.assign(S,{q:'',format:'all',platform:'all',tag:'all',source:'all',more:false,limit:PAGE});render();};
  document.addEventListener('input',e=>{if(e.target.matches('[data-apsearch]')){const pos=e.target.selectionStart;S.q=e.target.value;S.limit=PAGE;render();const next=document.querySelector('[data-apsearch]');next?.focus();if(next?.type==='text')next.setSelectionRange(pos,pos);}else if(e.target.closest('#approval-form'))capture();});
  window.addEventListener('beforeunload',e=>{if(S.key===key()&&Object.values(S.drafts).some(d=>d.dirty)){e.preventDefault();e.returnValue='';}});
  window.Approvals={view,open,home,tab:v=>{scope();if(['mine','creators'].includes(v)){S.feed=v;render();return;}S.feed='ideas';S.tab=v;S.limit=PAGE;render();},state:()=>S,reset:()=>{S.key=null;scope();}};
})();

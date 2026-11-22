// Tella edit storyboard: the only operations Founders OS will apply to a Tella video copy.
// Every moment is anchored to a stable Tella transcript word index, so cuts never shift a sound or graphic onto the wrong line.
(function(root){
  const text=(v,max=2000)=>String(v??'').replace(/\0/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  const int=v=>Number.isInteger(Number(v))?Number(v):NaN;
  const pick=(v,list,d)=>list.includes(v)?v:d;
  const SILENCE=['off','natural','fast','faster'],ZOOMS=['off','gentle','subtle','moderate','focused'];
  const LAYOUTS={'camera-only':'Camera only','screen-only':'Screen only','camera-bubble':'Screen with camera bubble','side-by-side':'Side by side','tv-presenter':'Presenter beside screen','fullscreen':'Full screen'};
  const POSITIONS={'camera-bubble':['bottom-right','bottom-left','top-right','top-left'],'side-by-side':['left','right'],'tv-presenter':['left','right']};
  const GRAPHICS={title:'Title card',lower_third:'Lower third',callout:'Callout',motion:'Animated graphic'};
  const LIMITS={cuts:300,layouts:200,graphics:200,sounds:200,chapters:40};
  const ms=(v,min,max,d)=>{v=Number(v);return Number.isFinite(v)?Math.round(Math.min(max,Math.max(min,v))):d;};
  function stamp(t){t=Math.max(0,Math.floor(Number(t)||0));const h=Math.floor(t/3600),m=Math.floor(t/60)%60,s=t%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');}

  // Bounds of the word indices Tella reported for each clip at import.
  function bounds(source){
    return (source?.clips||[]).map(c=>{const xs=c.sentences||[];return xs.length?{min:Math.min(...xs.map(x=>x.f)),max:Math.max(...xs.map(x=>x.l))}:null;});
  }
  function sentenceAt(source,clip,word){const xs=source?.clips?.[clip]?.sentences||[];return xs.find(x=>word>=x.f&&word<=x.l)||null;}
  // Approximate time on the imported timeline, for display only. Apply recalculates from Tella after cleanup.
  function at(source,clip,word){
    let off=0;for(let i=0;i<clip;i++)off+=Number(source.clips[i]?.duration||0);
    const s=sentenceAt(source,clip,word);return off+(s?s.s/1000:0);
  }

  function plan(raw,source,opts={}){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('The storyboard must be an object.');
    const B=bounds(source),dropped=[],seen=new Set();
    const sounds=new Set((source?.assets?.sounds||[]).map(x=>x.id)),music=new Set((source?.assets?.music||[]).map(x=>x.id)),presets=new Set((source?.assets?.text||[]).map(x=>x.id));
    const uid=(v,p,i)=>{let id=text(v,40).replace(/[^a-z0-9_-]/gi,'')||p+(i+1);while(seen.has(id))id=p+Math.random().toString(36).slice(2,7);seen.add(id);return id;};
    const word=(c,w)=>{const b=B[c];return b&&Number.isInteger(w)&&w>=b.min&&w<=b.max;};
    const clipOk=c=>Number.isInteger(c)&&c>=0&&c<B.length&&!!B[c];
    function list(name,max,fn){
      const xs=Array.isArray(raw[name])?raw[name]:[];const out=[];
      xs.forEach((x,i)=>{if(out.length>=max){dropped.push(name);return;}try{const v=fn(x||{},i);if(v)out.push(v);else dropped.push(name);}catch{dropped.push(name);}});
      return out;
    }
    const on=x=>x.on!==false;
    const cleanup=raw.cleanup||{};
    const p={
      title:text(raw.title,180)||text(source?.video?.name,180)||'Tella edit',
      summary:text(raw.summary,2000),hook:text(raw.hook,800),
      cleanup:{studio_sound:cleanup.studio_sound!==false,fillers:cleanup.fillers!==false,silences:pick(cleanup.silences,SILENCE,'natural'),zooms:pick(cleanup.zooms,ZOOMS,'subtle')},
      cuts:list('cuts',LIMITS.cuts,(x,i)=>{const c=int(x.clip),f=int(x.from),t=int(x.to);if(!clipOk(c)||!word(c,f)||!word(c,t)||t<f)return null;return{id:uid(x.id,'cut',i),clip:c,from:f,to:t,reason:text(x.reason,300),on:on(x)};}),
      layouts:list('layouts',LIMITS.layouts,(x,i)=>{const c=int(x.clip),a=int(x.at),u=x.until==null||x.until===''?null:int(x.until);if(!clipOk(c)||!word(c,a)||(u!=null&&(!word(c,u)||u<a))||!LAYOUTS[x.kind])return null;
        return{id:uid(x.id,'layout',i),clip:c,at:a,until:u,kind:x.kind,position:pick(x.position,POSITIONS[x.kind]||[],(POSITIONS[x.kind]||[null])[0]),reason:text(x.reason,300),on:on(x)};}),
      graphics:list('graphics',LIMITS.graphics,(x,i)=>{const c=int(x.clip),a=int(x.at);if(!clipOk(c)||!word(c,a)||!GRAPHICS[x.kind])return null;const t=text(x.text,x.kind==='motion'?600:140);if(!t)return null;
        return{id:uid(x.id,'gfx',i),clip:c,at:a,ms:ms(x.ms,600,20000,3500),kind:x.kind,text:t,notes:text(x.notes,600),preset:x.preset&&presets.has(x.preset)?x.preset:null,on:on(x)};}),
      sounds:list('sounds',LIMITS.sounds,(x,i)=>{const c=int(x.clip),a=int(x.at);if(!clipOk(c)||!word(c,a)||!x.preset||(sounds.size&&!sounds.has(x.preset)))return null;
        const meta=(source?.assets?.sounds||[]).find(s=>s.id===x.preset);return{id:uid(x.id,'sfx',i),clip:c,at:a,preset:text(x.preset,120),name:text(x.name||meta?.name,80)||'Sound',volume:Math.min(1,Math.max(.05,Number(x.volume)||.5)),ms:ms(meta?.ms||x.ms,100,8000,800),on:on(x)};}),
      music:(()=>{const m=raw.music||{};const ok=m.preset&&(!music.size||music.has(m.preset));return{on:!!(ok&&m.on!==false),preset:ok?text(m.preset,120):null,name:ok?text(m.name||(source?.assets?.music||[]).find(s=>s.id===m.preset)?.name,80):'',volume:Math.min(.6,Math.max(.02,Number(m.volume)||.12))};})(),
      chapters:list('chapters',LIMITS.chapters,(x,i)=>{const c=int(x.clip),a=int(x.at);const t=text(x.title,90);if(!clipOk(c)||!word(c,a)||!t)return null;return{id:uid(x.id,'ch',i),clip:c,at:a,title:t,description:text(x.description,300)};}),
      motion_agent:raw.motion_agent===true,
      export:{resolution:pick(raw.export?.resolution,['4k','1080p'],'4k'),fps:[30,60].includes(Number(raw.export?.fps))?Number(raw.export.fps):30,captions:raw.export?.captions===true},
      publish:{title:text(raw.publish?.title,100),description:text(raw.publish?.description,4800),privacy:pick(raw.publish?.privacy,['private','unlisted','public'],'private')},
      limitations:(Array.isArray(raw.limitations)?raw.limitations:[]).map(x=>text(x,300)).filter(Boolean).slice(0,20),
    };
    p.chapters.sort((a,b)=>a.clip-b.clip||a.at-b.at);
    if(dropped.length&&opts.strict)throw new Error('Some storyboard items point at words or clips that do not exist.');
    if(dropped.length&&opts.note!==false){const n={};dropped.forEach(k=>n[k]=(n[k]||0)+1);p.limitations.unshift('Removed '+Object.entries(n).map(([k,v])=>v+' '+k).join(', ')+' that did not match the transcript or Tella library.');}
    return p;
  }

  // Word timings after cleanup: {index:[startMs,endMs]} per clip plus the clip's playback length.
  function wordMap(words,durationMs){const m=new Map();(words||[]).forEach(w=>{if(!w.cut&&!w.hidden&&Number.isFinite(w.startTimeMs))m.set(w.index,[w.startTimeMs,w.endTimeMs??w.startTimeMs]);});
    return{m,keys:[...m.keys()].sort((a,b)=>a-b),end:Number(durationMs)||Math.max(0,...[...m.values()].map(v=>v[1]))};}
  function anchor(map,w,edge=0){if(!map)return null;if(map.m.has(w))return map.m.get(w)[edge];const next=map.keys.find(k=>k>w);if(next!=null)return map.m.get(next)[0];return map.keys.length?map.m.get(map.keys[map.keys.length-1])[1]:null;}

  const LAYOUT_BODY=(x)=>({
    'camera-only':{kind:'camera-only',style:'fullscreen'},'screen-only':{kind:'screen-only',style:'fullscreen'},
    'camera-bubble':{kind:'camera-bubble',position:x.position||'bottom-right',size:'M'},'side-by-side':{kind:'side-by-side',position:x.position||'left',style:'regular'},
    'tv-presenter':{kind:'tv-presenter',position:x.position||'left',style:'regular'},'fullscreen':{kind:'fullscreen'},
  })[x.kind];
  const TEXT_STYLE={
    title:{point:{xPct:8,yPct:38},textAlign:'left',fontWeight:700,animation:{intro:{preset:'blur_slide_up'},outro:{preset:'fade'}}},
    lower_third:{point:{xPct:5,yPct:80},textAlign:'left',fontWeight:600,animation:{intro:{preset:'slide_up'},outro:{preset:'fade'}}},
    callout:{point:{xPct:6,yPct:8},textAlign:'left',fontWeight:600,animation:{intro:{preset:'mask_up'},outro:{preset:'fade'}}},
  };

  // Turns the approved storyboard into Tella batch operations. Pure, so it is tested without the network.
  function operations(p,clipIds,maps){
    const ops=[],skipped=[];
    const fit=(clip,start,dur)=>{const end=maps[clip]?.end||0;if(start==null||start>=end-100)return null;return[Math.max(0,Math.round(start)),Math.max(100,Math.round(Math.min(dur,end-start)))];};
    for(const x of p.layouts.filter(x=>x.on)){const s=anchor(maps[x.clip],x.at,0),e=x.until!=null?anchor(maps[x.clip],x.until,1):maps[x.clip]?.end;const r=fit(x.clip,s,(e??0)-(s??0));
      if(!r||!clipIds[x.clip]){skipped.push(x.id);continue;}ops.push({type:'add_layout',operationId:'fos-'+x.id,clipId:clipIds[x.clip],startTimeMs:r[0],durationMs:r[1],layout:LAYOUT_BODY(x),transitionStyle:'spring'});}
    for(const x of p.graphics.filter(x=>x.on&&x.kind!=='motion')){const r=fit(x.clip,anchor(maps[x.clip],x.at,0),x.ms);if(!r||!clipIds[x.clip]){skipped.push(x.id);continue;}
      ops.push({type:'add_text_overlay',operationId:'fos-'+x.id,clipId:clipIds[x.clip],startTimeMs:r[0],durationMs:r[1],text:x.text,...(x.preset?{presetId:x.preset}:{}),...TEXT_STYLE[x.kind]});}
    for(const x of p.sounds.filter(x=>x.on)){const r=fit(x.clip,anchor(maps[x.clip],x.at,0),x.ms);if(!r||!clipIds[x.clip]){skipped.push(x.id);continue;}
      ops.push({type:'add_sound_effect',operationId:'fos-'+x.id,clipId:clipIds[x.clip],startTimeMs:r[0],durationMs:r[1],presetId:x.preset,volume:x.volume,name:x.name});}
    return{ops,skipped};
  }
  // Chapters on the final timeline. YouTube needs the first at 0:00 and at least 10 seconds between chapters.
  function chapters(p,maps){
    let off=0;const offs=maps.map(m=>{const o=off;off+=(m?.end||0);return o;});const out=[];
    for(const x of p.chapters){const a=anchor(maps[x.clip],x.at,0);if(a==null)continue;let t=Math.floor((offs[x.clip]+a)/1000);if(!out.length)t=0;
      if(out.length&&t<out[out.length-1].timestampSeconds+10)continue;if(t>=off/1000)continue;out.push({title:x.title,description:x.description||x.title,timestampSeconds:t});}
    return out.length>=3?out:[];
  }
  function motionPrompt(p,source,maps){
    const xs=p.graphics.filter(x=>x.on&&x.kind==='motion');if(!xs.length)return '';
    return ['Add these animated graphics to this video as Tella Motion overlays. Keep the presenter visible and readable. Use clean, minimal, on-brand motion with no emojis.',
      'Change nothing else: no cuts, captions, layouts, zooms, sound effects, music, chapters, export or publishing.',
      ...xs.map((x,i)=>{const a=anchor(maps[x.clip],x.at,0);return`${i+1}. Clip ${x.clip+1} "${source.clips[x.clip]?.name||''}" at ${stamp((a||0)/1000)} for about ${Math.round(x.ms/100)/10} seconds: ${x.text}${x.notes?' Notes: '+x.notes:''}`;})].join('\n');
  }
  function counts(p){return{cuts:p.cuts.filter(x=>x.on).length,layouts:p.layouts.filter(x=>x.on).length,graphics:p.graphics.filter(x=>x.on).length,sounds:p.sounds.filter(x=>x.on).length,chapters:p.chapters.length};}
  const api={text,stamp,plan,bounds,sentenceAt,at,wordMap,anchor,operations,chapters,motionPrompt,counts,LAYOUTS,POSITIONS,GRAPHICS,SILENCE,ZOOMS,LIMITS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TellaSchema=api;
})(typeof window!=='undefined'?window:globalThis);

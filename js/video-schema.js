// Shared edit-decision schema. The renderer executes only these bounded operations.
(function(root){
  const MAX_BYTES=524288000,MAX_DURATION=14400,ASPECTS={'16:9':[1920,1080],'9:16':[1080,1920],'1:1':[1080,1080]};
  const text=(v,max=4000)=>String(v??'').replace(/\0/g,'').trim().slice(0,max);
  const num=(v,min,max,label)=>{v=Number(v);if(!Number.isFinite(v)||v<min||v>max)throw new Error(label+' is outside the supported range.');return v;};
  function time(v){if(typeof v==='number')return v;const xs=String(v).replace(',','.').split(':').map(Number);return xs.reduce((s,n)=>s*60+n,0);}
  function stamp(t,millis=false){t=Math.max(0,Number(t)||0);const h=Math.floor(t/3600),m=Math.floor(t/60)%60,s=Math.floor(t)%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(millis?'.'+String(Math.round(t%1*1000)).padStart(3,'0'):'');}
  function transcript(rows,duration){
    if(!Array.isArray(rows)||rows.length>12000)throw new Error('Use a timestamped transcript with no more than 12,000 cues.');
    return rows.map(x=>({start:num(x.start,0,duration,'Transcript start'),end:num(x.end,0,duration+.15,'Transcript end'),text:text(x.text,2000)}))
      .filter(x=>x.end>x.start&&x.text).sort((a,b)=>a.start-b.start);
  }
  function parseTranscript(value,duration){
    const t=String(value||'').replace(/\r/g,'').trim();if(!t)return [];
    if(t.startsWith('[')){try{return transcript(JSON.parse(t),duration);}catch(e){throw new Error('Transcript JSON must contain start, end and text for every cue.');}}
    const rows=[];const re=/((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g;
    for(const m of t.matchAll(re))rows.push({start:time(m[1]),end:time(m[2]),text:m[3].replace(/<[^>]+>/g,'').replace(/\n/g,' ')});
    if(!rows.length)throw new Error('Paste an SRT or WebVTT transcript with start and end timestamps, or upload its file.');
    return transcript(rows,duration);
  }
  function plan(x,duration){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('A storyboard is required.');
    const s=x.style||{},aspect=Object.hasOwn(ASPECTS,s.aspect)?s.aspect:'16:9';
    if(!Array.isArray(x.segments)||!x.segments.length||x.segments.length>500)throw new Error('Keep between 1 and 500 shots in the storyboard.');
    const segments=x.segments.map((v,i)=>{
      const start=num(v.start,0,duration,'Shot '+(i+1)+' start'),end=num(v.end,0,duration+.05,'Shot '+(i+1)+' end');
      if(end-start<.1)throw new Error('Every shot must be at least 0.1 seconds long.');
      return {start:Math.round(start*1000)/1000,end:Math.round(Math.min(end,duration)*1000)/1000,
        title:text(v.title||'Shot '+(i+1),100),purpose:text(v.purpose,1500),overlay:text(v.overlay,150),
        zoom:num(v.zoom??1,1,1.8,'Zoom'),focus_x:num(v.focus_x??.5,0,1,'Horizontal focus'),focus_y:num(v.focus_y??.5,0,1,'Vertical focus')};
    });
    if(segments.reduce((n,s)=>n+s.end-s.start,0)>MAX_DURATION)throw new Error('The edited timeline cannot exceed four hours.');
    const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#ffffff';
    return {title:text(x.title||'Edit storyboard',180),summary:text(x.summary,4000),style:{name:text(s.name||'Clean editorial',120),
      notes:text(s.notes,4000),aspect,fit:s.fit==='contain'?'contain':'cover',captions:s.captions===true,
      text_color:color(s.text_color),accent:color(s.accent||'#ffffff'),font:'Geist',fps:30},segments,
      limitations:(Array.isArray(x.limitations)?x.limitations:[]).map(v=>text(v,800)).filter(Boolean).slice(0,12)};
  }
  function refs(xs){if(!Array.isArray(xs)||xs.length>10)throw new Error('Use up to ten style references.');return xs.map(x=>{
    let url=text(x.url,2000);if(url){let u;try{u=new URL(url);}catch{throw new Error('Use a full reference URL.');}if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('Use a public reference link without credentials.');url=u.href;}
    return {url,notes:text(x.notes,4000),path:text(x.path,700),name:text(x.name,240)};
  });}
  function project(v){
    const title=text(v.title,180);if(!title)throw new Error('Give this edit a title.');
    const source=v.source||null,duration=source?num(source.duration,.1,MAX_DURATION,'Source duration'):0;
    if(source){num(source.size,1,MAX_BYTES,'Source file size');num(source.width,1,16384,'Source width');num(source.height,1,16384,'Source height');if(!source.path||!source.name)throw new Error('Upload the source video first.');}
    return {title,brief:text(v.brief,14000),revision_notes:text(v.revision_notes,8000),
      source:source?{path:text(source.path,700),name:text(source.name,240),size:source.size,duration,width:source.width,height:source.height,has_audio:source.has_audio===true,mime:text(source.mime,80)}:null,
      references:refs(v.references||[]),transcript:transcript(v.transcript||[],duration||MAX_DURATION),
      plan:v.plan?plan(v.plan,duration):null};
  }
  function whole(source,aspect='16:9'){
    return plan({title:'Full source, ready to shape',summary:'A manual starting point. No AI analysis or automatic cleanup has been performed.',
      style:{name:'Clean editorial',aspect,fit:'contain',captions:false,notes:'Keep the full source. Trim or reorder the shots before approving.'},
      segments:[{start:0,end:source.duration,title:'Full source',purpose:'Review and trim the source recording.'}],limitations:['No editor MCP or template library has been connected.']},source.duration);
  }
  function cues(p,rows){
    let offset=0;const out=[];for(const s of p.segments){for(const r of rows){const start=Math.max(r.start,s.start),end=Math.min(r.end,s.end);if(end>start)out.push({start:offset+start-s.start,end:offset+end-s.start,text:r.text});}offset+=s.end-s.start;}return out;
  }
  function srt(rows){const ts=t=>{const ms=Math.round(t*1000),s=Math.floor(ms/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};return rows.map((x,i)=>`${i+1}\n${ts(x.start)} --> ${ts(x.end)}\n${x.text}`).join('\n\n');}
  function shotAt(p,t){let at=0;for(let i=0;i<p.segments.length;i++){const s=p.segments[i],d=s.end-s.start;if(t<at+d)return{...s,index:i,source_time:s.start+t-at,output_start:at};at+=d;}return null;}
  const api={MAX_BYTES,MAX_DURATION,ASPECTS,text,time,stamp,transcript,parseTranscript,plan,project,refs,whole,cues,srt,shotAt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VideoSchema=api;
})(typeof window!=='undefined'?window:globalThis);

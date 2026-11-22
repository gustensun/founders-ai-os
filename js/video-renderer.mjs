import {Input,BlobSource,UrlSource,ALL_FORMATS,CanvasSink,AudioBufferSink,AudioSampleSink,Output,StreamTarget,BufferTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,AudioSampleSource,canEncodeVideo,canEncodeAudio,Quality} from '../vendor/mediabunny.mjs';
const P=window.VideoSchema;
const input=source=>new Input({source:typeof source==='string'?new UrlSource(source):new BlobSource(source),formats:ALL_FORMATS});
const abort=signal=>{if(signal?.aborted)throw new DOMException('Stopped. Your saved project is unchanged.','AbortError');};
export async function inspect(file){
  if(file.size>P.MAX_BYTES)throw new Error('This upload is over 500 MB. Export a smaller H.264 source before uploading.');
  const i=input(file);
  try{
    const [v,a,duration]=await Promise.all([i.getPrimaryVideoTrack(),i.getPrimaryAudioTrack(),i.computeDuration()]);
    if(!v)throw new Error('This file does not contain a video track.');
    if(!await v.canDecode())throw new Error('This browser cannot decode that video. Export H.264 MP4 or VP9 WebM, then try again.');
    if(a&&!await a.canDecode())throw new Error('This browser cannot decode the audio track. Re-export with AAC or Opus audio before uploading.');
    if(duration>P.MAX_DURATION||duration<=0)throw new Error('Use a source video between 0.1 seconds and four hours.');
    return {name:file.name,size:file.size,duration,width:await v.getDisplayWidth(),height:await v.getDisplayHeight(),has_audio:!!a,mime:file.type||'application/octet-stream'};
  }finally{i.dispose();}
}
export async function frames(source,duration,signal){
  const i=input(source),out=[];
  try{
    const v=await i.getPrimaryVideoTrack(),sink=new CanvasSink(v,{width:640});
    for(const fraction of [.02,.18,.38,.58,.78,.95]){
      abort(signal);const time=Math.max(0,Math.min(duration-.05,duration*fraction)),f=await sink.getCanvas(time);
      if(f)out.push({time,label:'Source frame at '+P.stamp(time),media_type:'image/jpeg',data:f.canvas.toDataURL('image/jpeg',.62).split(',')[1]});
    }
    return out;
  }finally{i.dispose();}
}
function wrap(ctx,text,width){
  const lines=[];let line='';for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;
}
function label(ctx,text,w,h,caption,color){
  const size=Math.round(Math.min(w,h)*(caption?.047:.055));ctx.font=`600 ${size}px Geist, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=wrap(ctx,text,w*.82).slice(0,4),lineH=size*1.3;
  const y=caption?h*.82-(lines.length-1)*lineH/2:h*.12+lineH;
  const widest=Math.min(w*.9,Math.max(...lines.map(x=>ctx.measureText(x).width))+size);
  ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect((w-widest)/2,y-lineH/2-size*.3,widest,lines.length*lineH+size*.6);
  ctx.fillStyle=color;lines.forEach((t,k)=>ctx.fillText(t,w/2,y+k*lineH,w*.85));
}
export function paint(ctx,frame,p,shot,sourceTime,elapsed,rows){
  const w=ctx.canvas.width,h=ctx.canvas.height,iw=frame.width,ih=frame.height;
  ctx.fillStyle='#111111';ctx.fillRect(0,0,w,h);
  const base=p.style.fit==='contain'?Math.min(w/iw,h/ih):Math.max(w/iw,h/ih),scale=base*shot.zoom;
  const dw=iw*scale,dh=ih*scale;
  const x=dw>w?-(dw-w)*shot.focus_x:(w-dw)/2,y=dh>h?-(dh-h)*shot.focus_y:(h-dh)/2;
  ctx.drawImage(frame,x,y,dw,dh);
  if(shot.overlay&&elapsed<Math.min(4,shot.end-shot.start))label(ctx,shot.overlay,w,h,false,p.style.text_color);
  if(p.style.captions){
    const cue=rows.find(x=>x.start<=sourceTime&&x.end>sourceTime);
    if(cue){
      const words=cue.text.split(/\s+/),pages=Math.ceil(words.length/9),part=Math.min(pages-1,Math.floor((sourceTime-cue.start)/(cue.end-cue.start)*pages));
      label(ctx,words.slice(part*9,part*9+9).join(' '),w,h,true,p.style.text_color);
    }
  }
}
export async function preview(source,snapshot,shotIndex=0,signal){
  const i=input(source);
  try{
    const v=await i.getPrimaryVideoTrack(),shot=snapshot.plan.segments[shotIndex],f=await new CanvasSink(v,{width:960}).getCanvas(shot.start+.01);abort(signal);
    if(!f)throw new Error('No frame at this timestamp. Move the shot start slightly forward.');
    const [w,h]=P.ASPECTS[snapshot.plan.style.aspect],c=document.createElement('canvas');c.width=Math.round(w/2);c.height=Math.round(h/2);
    paint(c.getContext('2d'),f.canvas,snapshot.plan,shot,shot.start,.01,snapshot.transcript||[]);
    return c.toDataURL('image/jpeg',.85);
  }finally{i.dispose();}
}
export async function capabilities(snapshot){
  if(!window.VideoEncoder||!window.VideoDecoder)throw new Error('This browser does not support video rendering. Open the editor in a current Chrome or Edge desktop browser.');
  const [width,height]=P.ASPECTS[snapshot.plan.style.aspect],audio=snapshot.source.has_audio;
  if(await canEncodeVideo('avc',{width,height,frameRate:30})&&(!audio||await canEncodeAudio('aac')))return {ext:'mp4',mime:'video/mp4',video:'avc',audio:'aac'};
  if(await canEncodeVideo('vp9',{width,height,frameRate:30})&&(!audio||await canEncodeAudio('opus')))return {ext:'webm',mime:'video/webm',video:'vp9',audio:'opus'};
  throw new Error('This browser cannot encode the required video and audio. Use current Chrome or Edge on desktop.');
}
export async function render(source,snapshot,{signal,onProgress=()=>{},forceBuffer=false}={}){
  const p=P.plan(snapshot.plan,snapshot.source.duration),caps=await capabilities({...snapshot,plan:p});
  const i=input(source),total=p.segments.reduce((s,x)=>s+x.end-x.start,0);let output,writable,root,tmpName,handle,target,file,bytes=0,wake;
  try{
    if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen').catch(()=>null);
    if(navigator.storage?.getDirectory&&!forceBuffer){
      root=await navigator.storage.getDirectory();tmpName='founders-edit-'+crypto.randomUUID()+'.'+caps.ext;
      handle=await root.getFileHandle(tmpName,{create:true});writable=await handle.createWritable();
      target=new StreamTarget(new WritableStream({async write(chunk){abort(signal);bytes=Math.max(bytes,chunk.position+chunk.data.length);await writable.write(chunk);},async close(){await writable.close();writable=null;}}),{chunked:true,chunkSize:2*1024*1024});
    }else{
      if(total*600000>128*1024*1024)throw new Error('Long exports need browser file storage. Use Chrome or Edge in a regular window, not private mode.');
      target=new BufferTarget();
    }
    const [v,a]=await Promise.all([i.getPrimaryVideoTrack(),i.getPrimaryAudioTrack()]);
    if(!v||!await v.canDecode()||(a&&!await a.canDecode()))throw new Error('This browser cannot decode every source track. Re-export as H.264/AAC MP4.');
    const [width,height]=P.ASPECTS[p.style.aspect],canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{alpha:false});
    output=new Output({format:caps.ext==='mp4'?new Mp4OutputFormat({fastStart:'fragmented'}):new WebMOutputFormat(),target});
    const video=new CanvasSource(canvas,{codec:caps.video,quality:new Quality({bitrate:4500000}),keyFrameInterval:2});
    output.addVideoTrack(video,{frameRate:30});
    const audio=a?new AudioSampleSource({codec:caps.audio,quality:new Quality({bitrate:128000})}):null;
    if(audio)output.addAudioTrack(audio);
    await document.fonts?.load('600 44px Geist');await output.start();let offset=0,frameCount=0;
    const videoSink=new CanvasSink(v,{width:Math.min(await v.getDisplayWidth(),1920),poolSize:2}),audioSink=a?new AudioSampleSink(a):null;
    for(let si=0;si<p.segments.length;si++){
      const shot=p.segments[si],duration=shot.end-shot.start;abort(signal);
      const ai=audioSink?.samples(Math.max(0,shot.start-.15),shot.end)[Symbol.asyncIterator]();let next=ai?await ai.next():null;
      async function addAudioUntil(sourceEnd){
        while(next&&!next.done&&next.value.timestamp<sourceEnd){
          abort(signal);const sample=next.value,rate=sample.sampleRate;
          const from=Math.max(0,Math.ceil((shot.start-sample.timestamp)*rate)),to=Math.min(sample.numberOfFrames,Math.floor((shot.end-sample.timestamp)*rate));
          try{if(to>from){const cut=sample.trim(from,to);try{cut.setTimestamp(offset+sample.timestamp+from/rate-shot.start);await audio.add(cut);}finally{cut.close();}}}finally{sample.close();}
          next=await ai.next();
        }
      }
      try{
        function* timestamps(){for(let f=0;f<Math.ceil(duration*30);f++)yield shot.start+f/30;}
        let f=0;
        for await(const frame of videoSink.canvasesAtTimestamps(timestamps())){
          abort(signal);const elapsed=f/30,ts=shot.start+elapsed;
          await addAudioUntil(Math.min(shot.end,ts+.4));
          if(!frame)throw new Error('A source frame could not be decoded at '+P.stamp(ts)+'. Move this shot start and retry.');
          paint(context,frame.canvas,p,shot,ts,elapsed,snapshot.transcript||[]);
          await video.add(offset+elapsed,Math.min(1/30,duration-elapsed));f++;frameCount++;
          if(frameCount%12===0){onProgress({phase:'Rendering',ratio:(offset+elapsed)/total,shot:si+1,shots:p.segments.length,bytes});await new Promise(r=>setTimeout(r,0));}
        }
        await addAudioUntil(shot.end+.01);
      }finally{if(next&&!next.done)next.value.close();await ai?.return();}
      offset+=duration;
    }
    video.close();audio?.close();abort(signal);onProgress({phase:'Finalizing',ratio:.99});await output.finalize();
    file=handle?await handle.getFile():new Blob([target.buffer],{type:caps.mime});
    onProgress({phase:'Rendered',ratio:1,bytes:file.size});
    return {blob:file,mime:caps.mime,extension:caps.ext,duration:total,cleanup:async()=>{if(root&&tmpName)await root.removeEntry(tmpName).catch(()=>{});}};
  }catch(e){
    await output?.cancel().catch(()=>{});await writable?.abort().catch(()=>{});if(root&&tmpName)await root.removeEntry(tmpName).catch(()=>{});throw e;
  }finally{i.dispose();await wake?.release().catch(()=>{});}
}
function wav(samples,rate=16000){
  const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b),s=(p,t)=>{for(let j=0;j<t.length;j++)v.setUint8(p+j,t.charCodeAt(j));};
  s(0,'RIFF');v.setUint32(4,b.byteLength-8,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,samples.length*2,true);
  for(let k=0;k<samples.length;k++)v.setInt16(44+k*2,Math.max(-1,Math.min(1,samples[k]))*32767,true);
  return new Blob([b],{type:'audio/wav'});
}
export async function* audioChunks(source,duration,signal,startAt=0){
  const i=input(source);
  try{
    const a=await i.getPrimaryAudioTrack();if(!a||!await a.canDecode())throw new Error('This browser cannot read the audio track. Upload an SRT transcript instead.');
    const sink=new AudioBufferSink(a);
    for(let start=startAt;start<duration;start+=60){
      abort(signal);const end=Math.min(start+60,duration),mono=new Float32Array(Math.ceil((end-start)*16000));
      for await(const w of sink.buffers(Math.max(0,start-.1),end)){
        abort(signal);const b=w.buffer,rate=b.sampleRate,first=Math.max(0,Math.ceil((w.timestamp-start)*16000)),last=Math.min(mono.length,Math.ceil((w.timestamp+b.duration-start)*16000));
        const channels=Array.from({length:b.numberOfChannels},(_,c)=>b.getChannelData(c));
        for(let n=first;n<last;n++){const pos=(start+n/16000-w.timestamp)*rate,j=Math.floor(pos);if(j<0||j>=b.length)continue;let value=0;for(const data of channels)value+=data[j]*(1-(pos-j))+(data[Math.min(j+1,b.length-1)]||0)*(pos-j);mono[n]=value/channels.length;}
      }
      yield {offset:start,duration:end-start,blob:wav(mono)};
    }
  }finally{i.dispose();}
}

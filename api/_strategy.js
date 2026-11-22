// Read-time strategy overlay. Never rewrites manual DNA or its compiled history.
const {sb,rpc,q}=require('./_lib'),S=require('../js/strategy');
const columns='id,kind,name,lifecycle,summary,price,currency,price_note,url,steps,details,linked_offer_id,stream,updated_at';
async function rows(jwt,ws){
  return sb(jwt,`/rest/v1/founder_strategy?workspace_id=eq.${q(ws)}&lifecycle=in.(live,planned)&select=${columns}&order=updated_at.desc&limit=500`);
}
async function cron(ws){
  return rpc(null,'cron_strategy_context',{p_secret:process.env.CRON_SECRET,p_ws:ws});
}
function apply(input,strategy){
  return {...input,dna:S.context(input?.dna||'',strategy),offers:strategy.filter(x=>x.lifecycle==='live'),strategy};
}
async function liveInput(jwt,ws,input){return apply(input,await rows(jwt,ws));}
async function cronInput(ws,input){return apply(input,await cron(ws));}
module.exports={rows,cron,apply,liveInput,cronInput,context:S.context,cleanDNA:S.cleanDNA};

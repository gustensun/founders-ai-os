// Retained for old clients. The only active queue is now the Newsfeed.
const {rpc}=require('./_lib');
module.exports=async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const send=(status,data)=>{res.statusCode=status;return res.end(JSON.stringify(data));};
  try{
    let b=req.body;if(typeof b==='string')b=JSON.parse(b);b||={};
    if(req.method!=='POST'||b.action!=='read')return send(410,{error:'Morning generation and direct promotion have moved to the Newsfeed. Set your idea cadences there.',route:'approvals'});
    const jwt=(/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization||''))||[])[1];
    if(!jwt)return send(401,{error:'Sign in first.'});
    return send(200,{...await rpc(jwt,'morning_read',{p_ws:b.workspace_id}),route:'approvals',read_only:true});
  }catch(e){return send(Number(e.code)||400,{error:e.message||'Could not read earlier suggestions.'});}
};

// Explicit founder strategy, never an inferred HighLevel product status.
(function(root) {
  const statuses = { live: 'Live', planned: 'Planned', paused: 'Paused', archived: 'Archived' };
  const offerFields = [['audience','Who it is for'],['transformation','Outcome / transformation'],['delivery','Delivery and timeline'],['inclusions','What is included'],['positioning','Positioning and difference'],['proof','Approved proof'],['guarantee','Guarantee / terms'],['objections','Objections to address'],['content_angles','Content angles'],['next_step','Next action']];
  const funnelFields = [['goal','Conversion goal'],['audience','Audience'],['traffic','Traffic sources'],['journey','Funnel steps, in order'],['cta','Primary call to action'],['follow_up','Follow-up plan'],['measurement','What to measure'],['content_angles','Content angles'],['next_step','Next action']];
  const txt = (v,max,label) => { if (typeof v !== 'string' || v.length > max || v.includes('\0')) throw new Error(label + ' is too long or invalid.'); return v.trim(); };
  function url(s) { if (!s) return ''; try { const u=new URL(s); if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw 0; return u.href; } catch { throw new Error('Use a full https:// or http:// page link without credentials.'); } }
  function normalize(x) {
    if (!['offer','funnel'].includes(x.kind) || !Object.hasOwn(statuses,x.lifecycle)) throw new Error('Choose an offer or funnel and a valid status.');
    const name=txt(x.name,200,'Name'); if (!name) throw new Error('Give it a name.');
    const price=x.price==='' || x.price==null ? null : Number(x.price);
    if (price!=null && (!Number.isFinite(price) || price<0 || price>1e9)) throw new Error('Enter a valid price, or leave it empty.');
    const currency=String(x.currency || 'USD').toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Use a three-letter currency code.');
    const details={}; for (const [k] of (x.kind==='offer' ? offerFields : funnelFields).concat([['launch_date'],['notes'],['stream']])) details[k]=txt(x.details?.[k] || '',k==='notes'?10000:4000,k);
    if (details.launch_date && !/^\d{4}-\d{2}-\d{2}$/.test(details.launch_date)) throw new Error('Enter a valid launch date.');
    const steps=x.kind==='funnel' ? details.journey.split('\n').filter(x=>x.trim()).length || null : null;
    return { kind:x.kind,name,lifecycle:x.lifecycle,summary:txt(x.summary||'',4000,'Summary'),price,currency,price_note:txt(x.price_note||'',200,'Price note'),url:url(x.url||''),details,steps,linked_offer_id:x.kind==='funnel' ? x.linked_offer_id || null : null,inventory_id:x.inventory_id||null };
  }
  function cleanDNA(body) {
    return String(body||'')
      .replace(/(?:^|\n)WHAT OTHERS SELL \(my swipe file[^\n]*\n[\s\S]*?(?=\n\n[A-Z][A-Z ()',:.]+(?:\n|$)|$)/g, '')
      .replace(/(?:^|\n)MY (?:OFFERS|FUNNELS)[^\n]*\n[\s\S]*?(?=\n\n[A-Z][A-Z ()',:.]+(?:\n|$)|$)/g,'')
      .replace('Only use the offers and funnels listed here, with these names and prices.','Current offers and funnels come only from the live strategy records supplied separately.')
      .replace('Every piece of content should start from a proven pattern and point to one of these offers or funnels.','Use proven patterns when supported. Content does not require a sales pitch.').trim();
  }
  function context(body,rows=[]) {
    const active=rows.filter(r=>['live','planned'].includes(r.lifecycle)).sort((a,b)=>(a.lifecycle==='live'?0:1)-(b.lifecycle==='live'?0:1));
    const entries=active.map(r=>({
      name:r.name,kind:r.kind,status:r.lifecycle,
      availability:r.lifecycle==='live'?'Founder-confirmed live':'Future plan only. Not currently available.',
      summary:String(r.summary||'').slice(0,500),price:r.price,currency:r.currency,price_note:r.price_note,url:r.url,
      details:Object.fromEntries(Object.entries(r.details||{}).filter(([,v])=>v).map(([k,v])=>[k,String(v).slice(0,350)])),linked_offer_id:r.linked_offer_id,updated_at:r.updated_at
    })).slice(0,50);
    const brief=entries.map(x=>JSON.stringify(x)).join('\n');
    return ['CURRENT FOUNDER STRATEGY\nOnly records marked live below are current offers or funnels. Other catalogue mentions in historical facts, recordings or reference material are not proof of current availability. Planned records must never be sold as available. Content need not promote any offer.\n'+(brief.slice(0,9000)||'No live or planned strategy records saved.')+(brief.length>9000||active.length>50?'\nAdditional strategy details omitted for context length. Do not infer missing offers.':''),cleanDNA(body)].filter(Boolean).join('\n\n');
  }
  const api={statuses,offerFields,funnelFields,normalize,url,cleanDNA,context};
  if(typeof module!=='undefined'&&module.exports)module.exports=api; else root.StrategySchema=api;
})(typeof window!=='undefined'?window:globalThis);

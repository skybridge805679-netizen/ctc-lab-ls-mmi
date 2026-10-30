(function(root){'use strict';
// Oral reference items 1, 13 and 19: display berths, authoritative motion and plan are distinct.
function list({model,ls,now,position,network,journeys=new Map(),authoritative=false,codeOf=s=>s}){
 const entries=new Map();for(const [station,s]of Object.entries(ls.stations||{}))for(const [slot,rows]of Object.entries(s.windows||{}))for(const r of rows){const a=entries.get(r.number)||[];a.push({station,slot,...r});entries.set(r.number,a);}
 const trains=new Map(model.trains.map(t=>[t.id,t]));for(const [id,rows]of entries)if(!trains.has(id))trains.set(id,{id,direction:rows[0].direction,kind:'수동 등록',calls:[]});
 return [...trains.values()].map(train=>{const berths=entries.get(train.id)||[],p=train.calls.length?position(train,now):null,actual=p?.actual===true,first=train.calls[0],last=train.calls.at(-1),journey=journeys.get(train.id);
 const locations=berths.map(b=>({...b,order:network[b.station]?.order})),fallback=locations[0],station=actual?p.station:fallback?.station||p?.station;
 const state=train.cancelled?'운휴':actual||berths.length?'운행중':p?'운행중':authoritative?'위치 미확인':!first||now<first.arrival?'운행대기':'운행완료';
 return {id:train.id,train,direction:berths[0]?.direction||train.direction,kind:train.kind,state,position:p,station,order:actual?p.order:fallback?.order??p?.order,locations,berths:berths.map(b=>b.station+' · '+b.slot),circuits:[...new Set([journey,p?.actual&&p.circuit].filter(Boolean).map(codeOf))],basis:actual?'실제 운행':berths.length?'열번 표시':p?'시간표 추정':authoritative?'엔진 위치 없음':'시간표',first,last};
 });
}
const api={list};if(typeof module!=='undefined')module.exports=api;else root.SimTrainStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
 'use strict';
 const N=typeof module!=='undefined'?require('./network.js'):root.SimNetwork;
 const R=typeof module!=='undefined'?require('./schedule-routes.js'):root.SimScheduleRoutes;
 const ROUTE=/^$|^\d{1,2}[A-Z]?_[A-Z0-9]{1,12}$/,STOPS=['시발','정차','통과','종착'],KINDS=['전동열차','일반열차','회송열차','KTX'],FLAGS=['입고','출고','주박','회차','회송','영업','직통'];
 const clock=seconds=>{const value=8*3600+Math.round(seconds);return `${String(Math.floor(value/3600)%24).padStart(2,'0')}:${String(Math.floor(value%3600/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;};
 function initial(){
  const trains=[];
  for(const direction of ['down','up'])for(let n=0;n<6;n++){
   const stations=direction==='down'?N.stations:[...N.stations].reverse();
   const calls=stations.map((station,i)=>({station:station.id,arrival:n*360+i*150,departure:n*360+i*150+30,...R.routesFor(station.id,direction,i===0,i===stations.length-1)}));
   const number=direction==='down'?1131+n*2:1002+n*2;
   trains.push({id:'K'+number,direction,kind:'전동열차',service:'정기',flags:[],cancelled:false,plan:calls.map(c=>({...c})),calls});
  }
  return {trains,changes:[],serviceDate:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})};
 }
 function delay(model,id,station,minutes){
  const train=model.trains.find(t=>t.id===id),index=train?.calls.findIndex(c=>c.station===station);
  if(!train||index<0||!Number.isInteger(minutes)||minutes<1||minutes>120||train.cancelled)return {ok:false,message:'열차·변경역·지연분(1~120분)을 확인하세요.'};
  const candidate=structuredClone(train);for(let i=index;i<candidate.calls.length;i++){candidate.calls[i].arrival+=minutes*60;candidate.calls[i].departure+=minutes*60;}
  if(!valid(candidate))return {ok:false,message:'변경 시각이 동일 운행일 범위를 벗어납니다.'};
  train.calls=candidate.calls;
  model.changes.push({type:'delay',id,station,minutes});return {ok:true,message:`${id} ${N.catalog[station].name}부터 ${minutes}분 지연 적용`};
 }
 function cancel(model,id){const t=model.trains.find(t=>t.id===id);if(!t)return {ok:false};t.cancelled=!t.cancelled;t.calls.forEach(c=>{c.cancelled=t.cancelled;});model.changes.push({type:'cancel',id,cancelled:t.cancelled});return {ok:true};}
 // partial cancellation (운휴): from..to stations of the train, inclusive, in running order
 function setCancelled(model,id,from,to,cancelled){
  const train=model.trains.find(t=>t.id===id);if(!train)return {ok:false,message:'열차를 선택하세요.'};
  const a=train.calls.findIndex(c=>c.station===from),b=train.calls.findIndex(c=>c.station===to);
  if(a<0||b<0||a>b)return {ok:false,message:'시작역과 마지막역을 열차 진행 순서대로 선택하세요.'};
  for(let i=a;i<=b;i++)train.calls[i].cancelled=!!cancelled;
  train.cancelled=train.calls.every(c=>c.cancelled);
  model.changes.push({type:'partial-cancel',id,from,to,cancelled:!!cancelled});
  return {ok:true,message:`${id} ${N.catalog[from].name}~${N.catalog[to].name} ${cancelled?'운휴':'운행'} 설정`};
 }
 function position(train,now){
  if(train.cancelled||now<train.calls[0].arrival||now>train.calls.at(-1).departure)return null;
  for(let i=0;i<train.calls.length;i++){
   const call=train.calls[i],order=N.catalog[call.station].order;
   if(now<=call.departure)return call.cancelled?null:{order,station:call.station,status:'정차'};
   const next=train.calls[i+1];
   if(next&&now<next.arrival){if(call.cancelled||next.cancelled)return null;const fraction=(now-call.departure)/(next.arrival-call.departure);return {order:order+(N.catalog[next.station].order-order)*fraction,station:call.station,nextStation:next.station,status:'운행'};}
  }
  return null;
 }
 function valid(train){
  if(!/^[A-Z][0-9]{3,5}$/.test(train.id)||!Array.isArray(train.calls)||train.calls.length<2)return false;
  if(!Number.isInteger(train.carCount??10)||(train.carCount??10)<1||(train.carCount??10)>20)return false;
  if(!KINDS.includes(train.kind))return false;
  if(train.service!==undefined&&!['정기','부정기'].includes(train.service))return false;
  if(train.flags!==undefined&&(!Array.isArray(train.flags)||train.flags.some(f=>!FLAGS.includes(f))))return false;
  if(train.relatedTrain&&(!/^[A-Z][0-9]{3,5}$/.test(train.relatedTrain)||train.relatedTrain===train.id))return false;
  const orders=train.calls.map(c=>N.catalog[c.station]?.order);
  if(orders.some(o=>o===undefined)||new Set(orders).size!==orders.length)return false;
  const direction=orders.at(-1)>orders[0]?1:-1;
  if(train.direction!==(direction>0?'down':'up'))return false;
  for(let i=0;i<train.calls.length;i++){
   const c=train.calls[i];
   if(!Number.isInteger(c.arrival)||!Number.isInteger(c.departure)||c.arrival>c.departure||c.arrival< -28800||c.departure>=57600)return false;
   if(typeof(c.track??'')!=='string'||(c.track??'').length>32)return false;
   if(!ROUTE.test(c.arrivalRoute??'')||!ROUTE.test(c.departureRoute??'')||(c.stopType!==undefined&&!STOPS.includes(c.stopType))||(c.cancelled!==undefined&&typeof c.cancelled!=='boolean'))return false;
   if(i&&(c.arrival<=train.calls[i-1].departure||orders[i]-orders[i-1]!==direction))return false;
  }
  return true;
 }
 function pattern({id,from,to,start,kind='전동열차',carCount=10,relatedTrain=''}){
  const a=N.catalog[from]?.order,b=N.catalog[to]?.order;
  if(a===undefined||b===undefined||a===b||!Number.isInteger(start))return null;
  const direction=b>a?'down':'up',stations=N.stations.slice(Math.min(a,b),Math.max(a,b)+1);
  if(direction==='up')stations.reverse();
  const calls=stations.map((station,i)=>({station:station.id,arrival:start+i*150-(i?30:0),departure:start+i*150,track:'',...R.routesFor(station.id,direction,i===0,i===stations.length-1)}));
  return {id,direction,kind,service:'정기',flags:[],carCount,relatedTrain,cancelled:false,calls};
 }
 function create(model,draft){
  if(!draft||!valid(draft)||model.trains.some(t=>t.id===draft.id))return {ok:false,message:'열차번호 중복, 역 순서, 시각(동일 운행일), 차량수 및 속성을 확인하세요.'};
  const train=structuredClone(draft);train.plan=train.calls.map(c=>({...c}));model.trains.push(train);model.changes.push({type:'create',id:train.id});return {ok:true,message:train.id+' 스케줄 생성 완료'};
 }
 function update(model,id,draft){
  const train=model.trains.find(t=>t.id===id);
  if(!train||!draft||draft.id!==id||!valid(draft)||draft.calls.length!==train.calls.length||draft.calls.some((c,i)=>c.station!==train.calls[i].station))return {ok:false,message:'역별 시각·차량수·속성을 확인하세요. 기존 열차번호는 복사로 변경하세요.'};
  const plan=train.plan;Object.assign(train,structuredClone(draft));train.plan=plan;train.direction=N.catalog[train.calls[0].station].order<N.catalog[train.calls.at(-1).station].order?'down':'up';if(train.cancelled)train.calls.forEach(c=>{c.cancelled=true;});model.changes.push({type:'update',id});return {ok:true,message:id+' 편집 적용 완료'};
 }
 function copy(model,sourceId,id,start,attributes={}){
  const source=model.trains.find(t=>t.id===sourceId);
  if(!source||!Number.isInteger(start))return {ok:false,message:'복사 원본과 시작출발시각을 확인하세요.'};
  const draft=structuredClone(source),offset=start-source.calls[0].departure;
  draft.id=id;draft.cancelled=false;delete draft.plan;
  draft.calls=draft.calls.map(c=>({...c,arrival:c.arrival+offset,departure:c.departure+offset}));
  for(const key of ['kind','carCount','relatedTrain'])if(attributes[key]!==undefined)draft[key]=attributes[key];
  const result=create(model,draft);if(result.ok){model.changes.at(-1).type='copy';model.changes.at(-1).sourceId=sourceId;result.message=id+' 스케줄 복사 완료';}return result;
 }
 const api={initial,delay,cancel,setCancelled,position,clock,valid,pattern,create,update,copy,KINDS,FLAGS,STOPS};if(typeof module!=='undefined')module.exports=api;else root.SimTimetable=api;
})(typeof window!=='undefined'?window:globalThis);

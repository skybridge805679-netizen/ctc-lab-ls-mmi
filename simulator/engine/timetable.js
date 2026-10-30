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
  if(!train||typeof train!=='object')return false;
  if(!/^[A-Z][0-9]{3,5}$/.test(train.id)||!Array.isArray(train.calls)||train.calls.length<2)return false;
  if(!Number.isInteger(train.carCount??10)||(train.carCount??10)<1||(train.carCount??10)>20)return false;
  if(!KINDS.includes(train.kind))return false;
  if(train.boardingHeight!==undefined&&!['unknown','high','low','both'].includes(train.boardingHeight))return false;
  if(train.service!==undefined&&!['정기','부정기'].includes(train.service))return false;
  if(train.flags!==undefined&&(!Array.isArray(train.flags)||train.flags.some(f=>!FLAGS.includes(f))))return false;
  if(train.relatedTrain&&(!/^[A-Z][0-9]{3,5}$/.test(train.relatedTrain)||train.relatedTrain===train.id))return false;
  if(train.calls.some(c=>!c||typeof c!=='object'))return false;
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
 function pattern({id,from,to,start,kind='전동열차',carCount=10,relatedTrain='',boardingHeight='unknown'}){
  const a=N.catalog[from]?.order,b=N.catalog[to]?.order;
  if(a===undefined||b===undefined||a===b||!Number.isInteger(start))return null;
  const direction=b>a?'down':'up',stations=N.stations.slice(Math.min(a,b),Math.max(a,b)+1);
  if(direction==='up')stations.reverse();
  const calls=stations.map((station,i)=>({station:station.id,arrival:start+i*150-(i?30:0),departure:start+i*150,track:'',...R.routesFor(station.id,direction,i===0,i===stations.length-1)}));
  return {id,direction,kind,service:'정기',flags:[],carCount,relatedTrain,boardingHeight,cancelled:false,calls};
 }
 function create(model,draft){
  if(!draft||!valid(draft)||model.trains.some(t=>t.id===draft.id))return {ok:false,message:'열차번호 중복, 역 순서, 시각(동일 운행일), 차량수 및 속성을 확인하세요.'};
  const train=structuredClone(draft);train.plan=train.calls.map(c=>({...c}));model.trains.push(train);model.changes.push({type:'create',id:train.id});return {ok:true,message:train.id+' 스케줄 생성 완료'};
 }
 // used by the 경합해소 실습 to take the exercise train away again
 function remove(model,id){const i=model.trains.findIndex(t=>t.id===id);if(i<0)return {ok:false,message:'열차를 찾을 수 없습니다.'};model.trains.splice(i,1);model.changes.push({type:'delete',id});return {ok:true,message:id+' 스케줄 삭제'};}
 function update(model,id,draft){
  const train=model.trains.find(t=>t.id===id);
  if(!train||!draft||draft.id!==id||!valid(draft)||draft.calls.length!==train.calls.length||draft.calls.some((c,i)=>c.station!==train.calls[i].station))return {ok:false,message:'역별 시각·차량수·속성을 확인하세요. 기존 열차번호는 복사로 변경하세요.'};
  // what the edit touched, for the 운전정리 대장 (운전명령 / 관제승인 / 단순 운전정리)
  const flags=[];
  if(draft.calls.some((c,i)=>c.arrival!==train.calls[i].arrival||c.departure!==train.calls[i].departure))flags.push('time');
  if(draft.calls.some((c,i)=>(c.arrivalRoute??'')!==(train.calls[i].arrivalRoute??'')||(c.departureRoute??'')!==(train.calls[i].departureRoute??'')||(c.track??'')!==(train.calls[i].track??'')))flags.push('route');
  if(draft.kind!==train.kind)flags.push('kind');
  if((draft.boardingHeight||'unknown')!==(train.boardingHeight||'unknown'))flags.push('boardingHeight');
  if((draft.relatedTrain??'')!==(train.relatedTrain??''))flags.push('related');
  if(draft.calls.some((c,i)=>(c.cancelled??false)!==(train.calls[i].cancelled??false)))flags.push('cancel');
  const plan=train.plan;Object.assign(train,structuredClone(draft));train.plan=plan;train.direction=N.catalog[train.calls[0].station].order<N.catalog[train.calls.at(-1).station].order?'down':'up';if(train.cancelled)train.calls.forEach(c=>{c.cancelled=true;});model.changes.push({type:'update',id,flags});return {ok:true,message:id+' 편집 적용 완료'};
 }
 function copy(model,sourceId,id,start,attributes={}){
  const source=model.trains.find(t=>t.id===sourceId);
  if(!source||!Number.isInteger(start))return {ok:false,message:'복사 원본과 시작출발시각을 확인하세요.'};
  const first=attributes.from?source.calls.findIndex(c=>c.station===attributes.from):0,last=attributes.to?source.calls.findIndex(c=>c.station===attributes.to):source.calls.length-1;
  if(first<0||last<=first)return {ok:false,message:'복사구간을 열차 진행 순서대로 선택하세요.'};
  const draft=structuredClone(source),offset=start-source.calls[first].departure;draft.calls=draft.calls.slice(first,last+1);
  draft.id=id;draft.cancelled=false;delete draft.plan;
  draft.calls=draft.calls.map(c=>({...c,arrival:c.arrival+offset,departure:c.departure+offset,cancelled:false}));
  if(first>0){draft.calls[0].stopType='시발';draft.calls[0].arrivalRoute='';}if(last<source.calls.length-1){draft.calls.at(-1).stopType='종착';draft.calls.at(-1).departureRoute='';}
  for(const key of ['kind','carCount','relatedTrain','service','flags','boardingHeight'])if(attributes[key]!==undefined)draft[key]=attributes[key];
  const result=create(model,draft);if(result.ok){model.changes.at(-1).type='copy';model.changes.at(-1).sourceId=sourceId;result.message=id+' 스케줄 복사 완료';}return result;
 }
 // 경합 검지 (실기3 4장, p.64-70): 같은 방향 열차끼리의 추월경합, 도착/출발 운전시격 경합, 같은 도착선 동시 점유(플랫폼 할당 경합).
// 교행경합은 단선 구간 전용이라 복선인 이 선로에는 없습니다. 최소 운전시격 120초는 교재의 "2~3분 고밀도" 설명에 맞춘 교육용 값입니다.
const MIN_HEADWAY=120;
const RESOLVE_STATIONS=['yongsan','yeongdeungpo','geumcheon','anyang','gunpo','uiwang'];
function conflicts(model,minHeadway=MIN_HEADWAY){
 const out=[],trains=model.trains.filter(t=>!t.cancelled);
 const index=typeof module!=='undefined'?require('./conflict-index'):root.SimConflictIndex;
 for(const [i,j]of index.pairs(trains,minHeadway,id=>N.catalog[id].order)){
  const a=trains[i],b=trains[j];if(a.direction!==b.direction)continue;
  const calls=new Map(b.calls.filter(c=>!c.cancelled).map(c=>[c.station,c]));
  const common=a.calls.filter(c=>!c.cancelled&&calls.has(c.station)).map(c=>({a:c,b:calls.get(c.station)}));
  common.sort((x,y)=>(N.catalog[x.a.station].order-N.catalog[y.a.station].order)*(a.direction==='down'?1:-1));
  const found=[];let lastSign=0,lastStation=null;
  for(const {a:ca,b:cb} of common){
   const aFirst=ca.arrival+ca.departure<=cb.arrival+cb.departure,lead=aFirst?ca:cb,follow=aFirst?cb:ca,leader=aFirst?a:b,follower=aFirst?b:a,sign=aFirst?1:-1;
   if(lastSign&&sign!==lastSign)found.push({type:'추월경합',station:ca.station,from:lastStation,trains:[a.id,b.id],time:Math.min(ca.arrival,cb.arrival)});
   lastSign=sign;lastStation=ca.station;
   const arr=follow.arrival-lead.arrival,dep=follow.departure-lead.departure;
   if(arr>=0&&arr<minHeadway)found.push({type:'도착 운전시격 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.arrival,gap:arr});
   if(dep>0&&dep<minHeadway)found.push({type:'출발 운전시격 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.departure,gap:dep});
   if(lead.arrivalRoute&&lead.arrivalRoute===follow.arrivalRoute&&follow.arrival<lead.departure)found.push({type:'플랫폼 할당 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.arrival,route:lead.arrivalRoute});
  }
  out.push(...found);
 }
 return out.sort((x,y)=>N.catalog[x.station].order-N.catalog[y.station].order||x.time-y.time);
}
// 경합 해소는 경합지에서 가장 가까운 앞쪽(상류) 해소역에서 한다 (경합 시나리오 ※)
function nearestResolveStation(station,direction){
 const order=N.catalog[station].order,sign=direction==='down'?1:-1;
 const candidates=RESOLVE_STATIONS.map(id=>N.catalog[id]).filter(s=>(s.order-order)*sign<=0).sort((x,y)=>(y.order-x.order)*sign);
 return candidates[0]?.id??null;
}
const H=typeof module!=='undefined'?require('./timetable-history'):root.SimTimetableHistory,histories=new WeakMap();
 const history=model=>{if(!histories.has(model))histories.set(model,H.create());return histories.get(model);};
 function importFile(model,input){
  const data=input?.timetable||input;
  if(!data||!Array.isArray(data.trains)||data.trains.length>20000||!/^\d{4}-\d{2}-\d{2}$/.test(data.serviceDate||''))return {ok:false,message:'ORPHEIA 시간표 JSON 형식과 운행일을 확인하세요. (최대 20,000열차)'};
  const timestamp=Date.parse(data.serviceDate+'T00:00:00Z');if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==data.serviceDate)return {ok:false,message:'시간표 운행일을 확인하세요.'};
  const ids=new Set();for(const train of data.trains){if(!valid(train)||ids.has(train.id))return {ok:false,message:'잘못되거나 중복된 열차 데이터입니다: '+String(train?.id||'')};ids.add(train.id);}
  const copies=structuredClone(data.trains);for(const t of copies)if(!Array.isArray(t.plan)||!valid({...t,calls:t.plan}))t.plan=structuredClone(t.calls);
  return history(model).perform(model,[...new Set([...model.trains.map(t=>t.id),...ids])],()=>{model.trains=copies;model.serviceDate=data.serviceDate;model.changes.push({type:'import',count:copies.length});return {ok:true,message:copies.length+'개 열차 시간표를 열었습니다.'};});
 }
 const api={initial,delay,cancel,setCancelled,position,clock,valid,pattern,create,update,remove,copy,conflicts,nearestResolveStation,MIN_HEADWAY,RESOLVE_STATIONS,KINDS,FLAGS,STOPS};
 for(const method of ['delay','cancel','setCancelled','create','update','remove','copy']){const fn=api[method];api[method]=(model,...args)=>history(model).perform(model,[method==='create'?args[0]?.id:method==='copy'?args[1]:args[0]],()=>fn(model,...args));}
 Object.assign(api,{import:importFile,undo:model=>history(model).undo(model),redo:model=>history(model).redo(model),history:model=>history(model).status()});
 if(typeof module!=='undefined')module.exports=api;else root.SimTimetable=api;
})(typeof window!=='undefined'?window:globalThis);

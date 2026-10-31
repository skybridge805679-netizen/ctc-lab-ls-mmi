(function(root){
'use strict';
// 기본 시나리오 → FTS 능동형 문제 데이터.
// 부본선 대피 5종(scenarios.js)과 비상시 조치 9종(emergency.js)의 대본을, 순서를 강제하지 않는 문제 데이터로 바꾼다.
//   setup          : 대본이 시작할 때의 LS (역 초기화 · 진로 · 접근 열차 · 열번창 열차)
//   objectives     : 대본의 조작 단계 하나하나 = 순서 없는 목표 (AUTO 복귀는 끝날 때 유지되어야 하는 final 목표)
//   communications : 대본의 통보·지시(구술) 단계 = 교수가 확인하는 통보
//   reactions      : 대본에서 어떤 단계가 끝나면 일어나던 열차 이동 · 열번 변화 = 그 목표/통보가 처음 이루어졌을 때의 상황 반응
// 대본의 순서는 '참고 순서(예시)'로만 조치사항에 남는다. 무엇을 먼저 지시하고 조작할지는 관제사가 상황을 보고 정한다.
// 순서가 꼭 필요한 곳만 조건으로 묶는다: 바꾼 번호를 이동·삭제하는 목표는 그 번호를 만든(옮긴) 목표가 먼저 이루어져야 한다.
const node=typeof module!=='undefined';
const SC=()=>node?require('./scenarios.js'):root.SimScenarios;
const EM=()=>node?require('./emergency.js'):root.SimEmergency;
const N=()=>node?require('./network.js'):root.SimNetwork;
const Core=()=>node?require('./core.js'):root.SimCore;
const T=()=>node?require('./timetable.js'):root.SimTimetable;
const nm=id=>N().catalog[id]?.name||id;
const OP_POINTS=2,COMM_POINTS=1;
const short=(s,n=48)=>{s=String(s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
const exists=number=>({type:'not',condition:{type:'trainGone',number}});
const deductions=()=>[{label:'거부된 조작 3회 이상 (연동 조건을 확인하지 않은 취급)',condition:{type:'failedOp',count:3},points:10}];

// 목표 목록을 만든다. 같은 조건은 한 번만 두고, 번호를 다루는 목표는 앞선 번호 목표에 묶는다.
function objectiveBook(){
 const list=[],byKey=new Map(),lastFor=new Map();
 const add=(id,label,condition,extra={})=>{const key=JSON.stringify(condition);if(byKey.has(key))return byKey.get(key);
  let uid=id,i=2;while(list.some(o=>o.id===uid))uid=id+'-'+i++;
  list.push({id:uid,label,condition,points:OP_POINTS,...extra});byKey.set(key,uid);return uid;};
 const after=(number,cond)=>{const prev=lastFor.get(number);return prev?{type:'all',conditions:[{type:'objective',id:prev},cond]}:cond;};
 const api={list,
  mode(station,value){
   if(value==='AUTO')return add('auto-'+station,`${nm(station)}역 AUTO 복귀 (끝날 때 AUTO 유지)`,{type:'all',conditions:[{type:'event',eventType:'mode',station,value:'AUTO'},{type:'mode',station,value:'AUTO'}]},{final:true});
   return add(value.toLowerCase()+'-'+station,`${nm(station)}역 ${value} 전환`,{type:'event',eventType:'mode',station,value});
  },
  cancel:(station,signal)=>add(`stop-${station}-${signal}`,`${nm(station)}역 ${signal} 신호 취소(정지 취급)`,{type:'signalCancelled',station,signal}),
  released:(station,signal)=>add(`free-${station}-${signal}`,`${nm(station)}역 ${signal} 진로 해정 확인 (접근쇄정 시간 경과)`,{type:'signalStop',station,signal}),
  route:(station,route,label)=>add(`route-${station}-${route}`,`${nm(station)}역 ${route} ${label||'진로 설정'}`,{type:'route',station,route}),
  rename(from,to){const id=add('rename-'+to,`열차번호 ${from} → ${to} 수정`,after(from,{type:'all',conditions:[exists(to),{type:'trainGone',number:from}]}));lastFor.set(to,id);return id;},
  move(number,station,slot,label){const c={type:'trainAt',number,station};if(slot)c.slot=slot;const id=add('move-'+number,label||`열차번호 ${number} → ${nm(station)}역${slot?' '+slot:''} 열번창`,after(number,c));lastFor.set(number,id);return id;},
  remove(number){const id=add('delete-'+number,`열차번호 ${number} 삭제`,after(number,{type:'trainGone',number}));lastFor.set(number,id);return id;},
  schedule:(c)=>add(`schedule-${c.train}-${c.station}`,`${c.train} ${nm(c.station)} 출발진로 ${c.value} (스케줄 수정)`,c)
 };
 return api;
}

// 대본 진로 seed와 같은 방식으로 신호기마다 첫 진로를 고르고, 실제로 설정되는 진로만 남긴다
function seedRoutes(station,signals,approach=[]){
 const c=Core().forStation(station),s=c.initial(),out=[];
 c.dispatch(s,{type:'mode',value:'CCM',source:'SCENARIO'});
 for(const sig of signals){
  const departure=c.signals[sig]?.kind==='출발';
  const id=typeof sig==='string'&&c.routes[sig]?sig:Object.keys(c.routes).filter(r=>c.routes[r].signal===sig&&/^B/.test(c.routes[r].destination)===departure).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))[0]||Object.keys(c.routes).find(r=>c.routes[r].signal===sig);
  if(id&&c.dispatch(s,{type:'route',id,source:'SCENARIO'}).ok)out.push({station,route:id});
 }
 return {routes:out,approach:approach.map(signal=>({station,signal}))};
}
const reference=steps=>'참고 순서(예시 — 실제 순서는 관제사가 상황을 보고 판단):\n'+steps.map((s,i)=>`${i+1}. ${s}`).join('\n');

// ---------------------------------------------------------------- 비상시 조치 9종
function emergency({limits={}}={}){
 const E=EM();
 return E.list.map(sc=>{
  const book=objectiveBook(),comms=[],reactions=[],order=[],tagTo={};
  // 대본 seed 가운데 연동 조건으로 설정되지 않는 진로의 신호기는 처음부터 정지 상태라 취소할 신호가 없다
  const setupRoutes=Object.entries(sc.seeds).flatMap(([st,sigs])=>seedRoutes(st,sigs).routes);
  const proceeding=new Set(setupRoutes.map(r=>r.station+'|'+(Core().forStation(r.station).routes[r.route]?.signal)));
  for(const st of sc.steps){
   if(st.kind==='say'){const id='n'+st.no;comms.push({id,label:short(`${st.no}. ${st.heading}`,60),text:st.lines.join('\n'),points:COMM_POINTS});tagTo[st.tag]={type:'communication',id};order.push(`[통보] ${st.no}. ${st.heading}`);continue;}
   const a=st.act;let id;
   if(a.type==='mode')id=book.mode(a.station,a.value);
   else if(a.type==='stop')id=a.ids.filter(sig=>proceeding.has(a.station+'|'+sig)).map(sig=>book.cancel(a.station,sig)).at(-1);
   else if(a.type==='route')id=book.route(a.station,a.id,/입환/.test(st.text)?'입환표지 진로설정':/출발/.test(st.text)?'출발 진행':'장내 진행');
   else if(a.type==='rename')id=book.rename(a.from,a.to);
   else if(a.type==='move')id=book.move(a.number,a.station,a.slot,st.text);
   else if(a.type==='delete')id=book.remove(a.number);
   if(st.tag&&id)tagTo[st.tag]={type:'objective',id};
   order.push(`[조작] ${st.text}`);
  }
  // 상황 반응: 대본에서 단계 tag가 끝나면 일어나던 변화. 첫 조작 전 단계(사고 발생 보고)의 변화는 문제 시작과 함께 일어난다.
  const opening=new Set([sc.steps.find(s=>s.kind==='say')?.tag].filter(Boolean));
  for(const [tag,actions] of Object.entries(sc.autos)){
   const dos=[],runs=new Map();
   for(const a of actions){
    if(a.op==='insert'){dos.push({type:'insertTrain',station:a.station,slot:a.slot||E.platform(a.station,a.dir),number:a.number,direction:a.dir});continue;}
    const r=runs.get(a.number)||{type:'runTrain',number:a.number,legs:[]};runs.set(a.number,r);
    if(a.op==='move')r.legs.push({station:a.station,slot:a.slot,...(a.handover?{handover:true}:{})});else r.exit=true;
   }
   dos.push(...runs.values());
   const trigger=opening.has(tag)?null:tagTo[tag];if(!opening.has(tag)&&!trigger)continue;
   const guards=[...runs.keys()].map(exists),when=[...(trigger?[trigger]:[]),...guards];
   reactions.push({id:'r-'+tag,label:trigger?`${trigger.type==='communication'?'통보':'목표'} ${trigger.id} 이후 열차 변화`:'사고 발생 시점의 열차 변화',...(when.length?{when:when.length===1?when[0]:{type:'all',conditions:when}}:{}),do:dos});
  }
  return {id:'P-'+sc.id,subject:'비상 시 조치',name:`비상시 조치 ${sc.title}`,limit:limits[sc.id]||900,score:100,voice:sc.problem,
   situation:[sc.problem,...sc.trains,...sc.notes].join('\n'),actions:reference(order),source:sc.source,
   trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:deductions(),
   setup:{reset:[...sc.stations],clear:E.numbersOf(sc),routes:setupRoutes,approach:[],modes:sc.stations.map(station=>({station,value:'AUTO'})),
    trains:E.castFor(sc).map(c=>({station:c.station,slot:c.slot,number:c.number,direction:c.dir}))},
   objectives:book.list,communications:comms,reactions};
 });
}

// ---------------------------------------------------------------- 부본선 대피 5종
const fillSpec=(c,station,train)=>JSON.parse(JSON.stringify(c).replaceAll('"{역}"',JSON.stringify(station)).replaceAll('"{고장}"',JSON.stringify(train)));
function evacuation({limits={}}={}){
 return SC().list.map(sc=>{
  const fault=/교재\s*([A-Z]{0,2}\d+)/.exec(sc.problem)?.[1]||'A1002',fill=s=>String(s).replaceAll('{고장}',fault);
  const book=objectiveBook(),comms=[],reactions=[],order=[],tagTo={};
  for(const st of sc.steps){
   if(st.kind==='say'){const id='s'+(comms.length+1),text=fill(st.text);comms.push({id,label:short(text.replace(/^\([^)]*\)\s*/,''),60),text,points:COMM_POINTS});if(st.tag)tagTo[st.tag]={type:'communication',id};order.push(`[통보] ${short(text,70)}`);continue;}
   let id;
   for(const c of (st.check.spec||[]).map(x=>fillSpec(x,sc.station,fault))){
    if(c.type==='mode')id=book.mode(c.station,c.value);
    else if(c.type==='signalCancelled')id=book.cancel(c.station,c.signal);
    else if(c.type==='signalStop')id=book.released(c.station,c.signal);
    else if(c.type==='route')id=book.route(c.station,c.route,/출발/.test(st.text)?'출발 진행':'장내 진행');
    else if(c.type==='schedule')id=book.schedule(c);
    else throw new Error(`${sc.id}: 변환할 수 없는 조건 ${c.type}`);
   }
   if(!id)throw new Error(`${sc.id}: 조작 단계에 조건이 없습니다 · ${st.text}`);
   if(st.tag)tagTo[st.tag]={type:'objective',id};
   order.push(`[조작] ${fill(st.text)}`);
  }
  // 고장열차의 출발 진로(§out§)는 그 열차가 부본선에 들어간 뒤(§route§ 장내 진로)에만 의미가 있다
  if(tagTo.out?.type==='objective'&&tagTo.route?.type==='objective'){const o=book.list.find(x=>x.id===tagTo.out.id);o.condition={type:'all',conditions:[{type:'objective',id:tagTo.route.id},o.condition]};}
  // 열번창 열차: 고장열차는 교재 번호, 나머지는 대본의 예비 번호
  const used=new Set([fault]);let follow=0;
  const cast=sc.cast.map(c=>{let id=c.role==='fault'?fault:c.fallback;while(c.role!=='fault'&&used.has(id))id=id.replace(/\d$/,d=>String((+d+1)%10));used.add(id);return {key:c.role==='fault'?'fault':c.role==='follow'?'follow'+(++follow):'other',id,dir:c.dir,slot:c.slot,label:c.label||''};});
  for(const [tag,beats] of Object.entries(sc.beats||{})){
   const trigger=tagTo[tag];if(!trigger)throw new Error(`${sc.id}: 없는 단계 tag ${tag}`);
   const runs=new Map();
   for(const [key,slot] of beats){const c=cast.find(x=>x.key===key);if(!c)continue;const r=runs.get(c.id)||{type:'runTrain',number:c.id,legs:[]};runs.set(c.id,r);if(slot===null)r.exit=true;else r.legs.push({station:sc.station,slot});}
   const when=[trigger,...[...runs.keys()].map(exists)];
   reactions.push({id:'r-'+tag,label:`${trigger.type==='communication'?'통보':'목표'} ${trigger.id} 이후 열차 이동`,when:{type:'all',conditions:when},do:[...runs.values()]});
  }
  // 고장열차의 스케줄(출발진로를 수정할 대상): 지금부터 약 10분 뒤 대피역에 도착하도록 만든다
  const down=sc.direction==='down',from=down?'seoul':'suwon',to=down?'suwon':'seoul';
  const t=T().pattern({id:fault,from,to,start:0}),at=t?.calls.find(c=>c.station===sc.station);
  reactions.unshift({id:'r-schedule',label:`${fault} 고장열차 스케줄`,do:[{type:'createTrain',train:fault,from,to,startIn:600-(at?.arrival||0),replace:true}]});
  const seeded=seedRoutes(sc.station,sc.seed.routes,sc.seed.approach);
  if(seeded.routes.length!==sc.seed.routes.length)throw new Error(`${sc.id}: 초기 진로를 설정할 수 없습니다`);
  return {id:'P-'+sc.id,subject:'운행선 관리',name:`${sc.title}를 시행하시오`,limit:limits[sc.id]||600,score:100,voice:fill(sc.problem),
   situation:[fill(sc.problem),...cast.map(c=>`${c.id} : ${{fault:'고장열차',other:c.label||'다른 선 열차'}[c.key]||c.label||'후속열차'} (${nm(sc.station)}역 ${c.slot})`)].join('\n'),
   actions:reference(order)+'\n\n'+sc.notes.join('\n'),source:sc.source,
   trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:deductions(),
   setup:{reset:[sc.station],clear:cast.map(c=>c.id),routes:seeded.routes,approach:seeded.approach,modes:[{station:sc.station,value:'AUTO'}],
    trains:cast.map(c=>({station:sc.station,slot:c.slot,number:c.id,direction:c.dir}))},
   objectives:book.list,communications:comms,reactions};
 });
}

const api={emergency,evacuation,all:o=>[...evacuation(o),...emergency(o)]};
if(node)module.exports=api;else root.SimFTSBuiltins=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
'use strict';
// 선택용 FTS 프리셋 → 능동형 문제 데이터.
// 부본선 대피 5종(scenarios.js)과 비상시 조치 9종(emergency.js)의 대본을, 순서를 강제하지 않는 문제 데이터로 바꾼다.
//   setup          : 대본이 시작할 때의 LS (역 초기화 · 진로 · 접근 열차 · 열번창 열차).
//                    FTS 선택 시 이 문제의 열차만 담은 시간표를 함께 적용한다.
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
const VB=()=>node?require('./emergency-branches.js'):root.SimEmergencyBranches;
const nm=id=>N().catalog[id]?.name||id;
const OP_POINTS=2,COMM_POINTS=1;
// 원문 HWP 글머리 기호(사용자 정의 문자)는 화면에서 깨지므로 가운뎃점으로 바꾼다 (예: 112·119)
const clean=s=>String(s).replace(/[\uE000-\uF8FF]/g,'·');
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
  cancel:(station,signal)=>add(`stop-${station}-${signal}`,`${nm(station)}역 ${signal} 신호 취소(정지 취급)`,{type:'signalCancelled',station,signal,orStopped:true}),
  released:(station,signal)=>add(`free-${station}-${signal}`,`${nm(station)}역 ${signal} 진로 해정 확인 (접근쇄정 시간 경과)`,{type:'signalStop',station,signal}),
  route:(station,route,label)=>add(`route-${station}-${route}`,`${nm(station)}역 ${route} ${label||'진로 설정'}`,{type:'route',station,route}),
  rename(from,to){const id=add('rename-'+to,`열차번호 ${from} → ${to} 수정`,after(from,{type:'all',conditions:[exists(to),{type:'trainGone',number:from}]}));lastFor.set(to,id);return id;},
  move(number,station,slot,label){const c={type:'trainAt',number,station};if(slot)c.slot=slot;const id=add('move-'+number,label||`열차번호 ${number} → ${nm(station)}역${slot?' '+slot:''} 열번창`,after(number,c));lastFor.set(number,id);return id;},
  // 구원연결: 관제 지시를 받은 구원열차가 실제로 운행해 사고 열차의 열번창에 도착해야 한다 (열번 수동 이동으로는 인정하지 않음)
  rescue(number,station,slot,target){const id=add('move-'+number,`${number} 구원운전 → ${nm(station)} ${slot}${target?' ('+target+')':''} 도착 · 구원연결 (관제 지시 후 열차가 운행 — 열번 수동 이동은 인정 안 함)`,after(number,{type:'trainRun',number,station,slot}));lastFor.set(number,id);return id;},
  remove(number){const id=add('delete-'+number,`열차번호 ${number} 삭제`,after(number,{type:'trainGone',number}));lastFor.set(number,id);return id;},
  schedule:(c)=>add(`schedule-${c.train}-${c.station}`,`${c.train} ${nm(c.station)} 출발진로 ${c.value} (스케줄 수정)`,c)
 };
 api.last=number=>lastFor.get(number);
 return api;
}
const lastFor=(book,number)=>book.last(number);
const routeOf=c=>c?.type==='route'?c:c?.type==='all'?c.conditions.map(routeOf).find(Boolean):null;

// 대본 진로 seed와 같은 방식으로 신호기마다 첫 진로를 고르고, 실제로 설정되는 진로만 남긴다
function seedRoutes(station,signals,approach=[],occupied=new Set()){
 const c=Core().forStation(station),s=c.initial(),out=[];
 c.dispatch(s,{type:'mode',value:'CCM',source:'SCENARIO'});
 for(const sig of signals){
  const departure=c.signals[sig]?.kind==='출발';
  const L=node?require('./line.js'):root.SimLine,wrong=r=>!!L?.wrongDirection?.(station,c.routes[r].destination);   // 반대 방향(단선 운전) 진로는 고르지 않는다
  // 처음부터 열번창에 열차가 서 있는 선로로 들어가는 진로는 고르지 않는다 (본선 신호는 점유 선로에 진행을 내지 않는다)
  const straight=EM().straightRoute(station,sig);if(straight&&occupied.has(c.routes[straight].destination)){continue;}   // 정상 진로의 도착 선로에 열차가 서 있으면 그 신호는 정지로 둔다
  const id=typeof sig==='string'&&c.routes[sig]?sig:straight||Object.keys(c.routes).filter(r=>c.routes[r].signal===sig&&/^B/.test(c.routes[r].destination)===departure&&!occupied.has(c.routes[r].destination)).sort((a,b)=>Number(wrong(a))-Number(wrong(b))||a.localeCompare(b,'en',{numeric:true}))[0]||Object.keys(c.routes).find(r=>c.routes[r].signal===sig&&!occupied.has(c.routes[r].destination));
  if(id&&c.dispatch(s,{type:'route',id,source:'SCENARIO'}).ok)out.push({station,route:id});
 }
 return {routes:out,approach:approach.map(signal=>({station,signal}))};
}
// 시작할 때 이미 서 있는 신호를 다시 내는 진로 목표는, 그 신호를 먼저 취소(정지)한 뒤에만 인정한다
// (그러지 않으면 문제 시작 순간 자동으로 달성된다 — 예: 비상 03 안양 3B-B655T)
function gateRoutes(list){
 for(const o of list){
  if(o.condition.type!=='route')continue;const {station,route}=o.condition,sig=Core().forStation(station).routes[route]?.signal;
  const stop=list.find(x=>x.condition.type==='signalCancelled'&&x.condition.station===station&&x.condition.signal===sig);
  if(stop&&stop!==o)o.condition={type:'all',conditions:[{type:'objective',id:stop.id},o.condition]};
 }
}
const reference=steps=>'참고 순서(예시 — 실제 순서는 관제사가 상황을 보고 판단):\n'+steps.map((s,i)=>`${i+1}. ${s}`).join('\n');

// ---------------------------------------------------------------- 비상시 조치 9종
// 한 대본에서 문제 세 갈래를 만든다 (베타 피드백 · 시험 대비):
//   기본          P-em-XX            대본을 그대로 따라간다 (관제사가 운행선 변경·단선지령식을 건의)
//   감독관 지시형  P-em-XX-order      열차 통제가 끝나면 관제팀장(감독관)이 운행선 변경·단선지령식을 직접 지시한다 (대본의 B형 문구)
//   상황별        P-em-XX-<상황>     「상황별 대응 요령」의 상황 하나가 정해진 시점에 저절로 일어난다 (기본 문제에서는 교수가 주입)
// 상황이 일어나는 시점: 원문에 시점이 적힌 것은 그 통보·진로·열차 출발 뒤, 없는 것은 문제 시작 직후
const ANCHOR={
 '02':{'v-derail-k602':{type:'communication',id:'n7'},'v-point-23b':{type:'communication',id:'n13'}},
 '03':{'v-g450-first':{type:'reaction',id:'r-g0450'}},
 '04':{'v-delay':{type:'reaction',id:'r-n17'},'v-a1005':{type:'communication',id:'n12'}},
 '05':{'v-bogie':{type:'communication',id:'n12'},'v-before-platform':{type:'communication',id:'n6'}},
 '06':{'v-change-after-control':{type:'communication',id:'n6'},'v-change-during-rescue':{type:'communication',id:'n15'},'v-self-run-first':{type:'communication',id:'n10'},'v-self-run-late':{type:'objective',id:'route-anyang-3B-B655T'}},
 '06-1':{'v-change-after-control':{type:'communication',id:'n6'},'v-change-during-rescue':{type:'communication',id:'n15'},'v-self-run-first':{type:'communication',id:'n10'},'v-self-run-late':{type:'objective',id:'route-anyang-3B-B655T'}}
};
const WITH={'02':{'v-point-23b':['v-derail-k602']}};      // 23B 선로전환기 불량은 K0602 탈선에 이어지는 상황
// 대본의 관제팀장 지시(B형): 「(관제팀장) 열차지연이 가중되니 … 운행선 변경 하세요!」
function supervisorOrder(sc){
 const st=sc.steps.find(s=>s.kind==='say'&&s.tag&&s.lines.some(l=>/^\s*\(관제팀장\)/.test(l)));if(!st)return null;
 const lines=st.lines.map(l=>l.trim().replace(/\s+/g,' ')),heads=lines.map((l,i)=>/^\(관제팀장\)/.test(l)?i:-1).filter(i=>i>=0),from=heads.at(-1),out=[];
 for(let i=from;i<lines.length;i++){out.push(lines[i].replace(/^\(관제팀장\)\s*/,'').replace(/^관제사님!\s*/,''));if(/(하세요|운행하세요)[.!]*$/.test(lines[i]))break;}
 const control=sc.steps.find(s=>s.kind==='say'&&s.tag&&s.lines.some(l=>/추가\s*정차/.test(l)));
 return control?{tag:st.tag,control:control.tag,text:out.filter(Boolean).join(' '),single:/지령식/.test(out.join(' '))}:null;
}
function emergency({limits={}}={}){
 const E=EM();
 return E.list.flatMap(sc=>{
  const base=emergencyBase(sc,limits),out=[base],order=supervisorOrder(sc);
  if(order&&base.communications.some(c=>c.id===order.tag)&&base.communications.some(c=>c.id===order.control)){
   const p=structuredClone(base),kind=order.single?'단선지령식':'운행선 변경';
   Object.assign(p,{id:base.id+'-order',variant:'order',name:`${base.name} · 감독관 지시 ${kind}`,branches:[],
    situation:base.situation+`\n※ 감독관 지시형: 관제사가 먼저 건의하지 않는다. 열차 통제가 끝나면 관제팀장(감독관)이 ${kind}을 직접 지시하고, 관제사는 복명한 뒤 시행한다.`});
   p.communications=p.communications.filter(c=>c.id!=='proactive');
   const c=p.communications.find(c=>c.id===order.tag);c.label='관제팀장 지시 복명 · '+c.label;
   p.reactions.push({id:'r-order',label:`관제팀장(감독관)의 ${kind} 지시`,when:{type:'communication',id:order.control},after:15,do:[{type:'notice',text:'관제팀장: '+order.text}]});
   out.push(p);
  }
  for(const b of base.branches){
   const p=structuredClone(base),ids=[...(WITH[sc.key]?.[b.id]||[]),b.id];
   Object.assign(p,{id:base.id+'-'+b.id.replace(/^v-/,''),variant:'branch',name:`${base.name} · ${b.label}`,
    situation:base.situation+`\n※ 상황별 대응: 진행 중에 「${b.label}」 상황이 일어난다.`,
    branches:ids.map(id=>({...structuredClone(base.branches.find(x=>x.id===id)),when:ANCHOR[sc.key]?.[id]||{type:'elapsed',seconds:5}}))});
   out.push(p);
  }
  return out;
 });
}
function emergencyBase(sc,limits){
 const E=EM();
 {
  const book=objectiveBook(),comms=[],reactions=[],order=[],tagTo={};
  // 대본 seed 가운데 연동 조건으로 설정되지 않는 진로의 신호기는 처음부터 정지 상태라 취소할 신호가 없다
  const castAt=st=>new Set(E.castFor(sc).filter(c=>c.station===st).map(c=>c.slot));
  const setupRoutes=Object.entries(sc.seeds).flatMap(([st,sigs])=>seedRoutes(st,sigs,[],castAt(st)).routes);
  const proceeding=new Set(setupRoutes.map(r=>r.station+'|'+(Core().forStation(r.station).routes[r.route]?.signal)));
  for(let st of sc.steps){
   if(st.kind==='say'){const id='n'+st.no;comms.push({id,label:short(clean(`${st.no}. ${st.heading}`),60),text:clean(st.lines.join('\n')),points:COMM_POINTS});tagTo[st.tag]={type:'communication',id};order.push(`[통보] ${st.no}. ${st.heading}`);continue;}
   const a=st.act;let id;
   if(a.type==='mode')id=book.mode(a.station,a.value);
   else if(a.type==='stop')id=a.ids.filter(sig=>proceeding.has(a.station+'|'+sig)).map(sig=>book.cancel(a.station,sig)).at(-1);
   else if(a.type==='route')id=book.route(a.station,a.id,st.text.split(a.id).slice(1).join(a.id).trim()||'진로 설정');   // 대본 단계의 목적(예: K0456 상1선 운행선 변경)을 목표 이름에 남긴다
   else if(a.type==='rename')id=book.rename(a.from,a.to);
   else if(a.type==='move'&&/구원연결/.test(st.text)){const before=lastFor(book,a.number);id=book.rescue(a.number,a.station,a.slot,/(\w+)(?:이|가) 있는/.exec(st.text)?.[1]);
    // 구원열차는 "구원열차 … 지시" 통보(그 앞 마지막 것)와 구원열차 번호 수정 뒤에 출발해 전령법으로 사고 열차까지 운행한다
    const order=comms.filter(c=>/구원/.test(c.label)&&/지시|출발/.test(c.label)).at(-1)||comms.at(-1);
    reactions.push({id:'r-rescue-'+a.number,label:`${a.number} 구원열차 출발 (통보 ${order?.id||'-'} 확인 후 전령법 운행)`,when:{type:'all',conditions:[...(order?[{type:'communication',id:order.id}]:[]),...(before?[{type:'objective',id:before}]:[]),exists(a.number)]},do:[{type:'runTrain',number:a.number,legs:[{station:a.station,slot:a.slot,rescue:true}]}]});
    book.list.push({id:'ack-'+a.number,label:`열차번호 중복 알람 확인 (${a.number} 구원연결 후 MMI 알람 체크 → [확인])`,condition:{type:'alarmAck',contains:'중복',afterObjective:id},points:OP_POINTS});
    // 조치사항(참고 순서)도 채점과 같게: 원문의 「열번 이동」 대신 구원 지시와 실제 운행을 적는다
    st={...st,text:`${a.number} 구원열차 출발 지시(통보 ${order?.id?.replace(/^n/,'')||'-'}) → ${a.number}가 전령법으로 ${nm(a.station)} ${a.slot}(사고 열차)까지 스스로 운행·구원연결 — 열번을 손으로 옮기지 않는다 → 열차번호 중복 알람 확인`};}
   else if(a.type==='move'){id=book.move(a.number,a.station,a.slot,st.text);
    // 구원연결로 한 열번창에 번호가 겹치면 "열차번호 중복 알람"을 확인해야 한다 (대본)
    if(/중복 알람/.test(st.text))book.list.push({id:'ack-'+a.number,label:`열차번호 중복 알람 확인 (${a.number} 구원연결 후 MMI 알람 체크 → [확인])`,condition:{type:'alarmAck',contains:'중복',afterObjective:id},points:OP_POINTS});}
   else if(a.type==='delete')id=book.remove(a.number);
   if(st.tag&&id)tagTo[st.tag]={type:'objective',id};
   order.push(`[조작] ${st.text}`);
  }
  // 사고 발생 보고와 함께 한 열번창에 두 번호가 겹치면(충돌·추돌) 그 중복 알람을 확인해야 한다
  if(Object.values(sc.autos).flat().some(a=>a.op==='insert'))book.list.unshift({id:'ack-incident',label:'사고 열차번호 중복 알람 확인 (MMI 알람 체크 → [확인])',condition:{type:'alarmAck',contains:'중복'},points:OP_POINTS});
  gateRoutes(book.list);
  // 상황 반응: 대본에서 단계 tag가 끝나면 일어나던 변화. 첫 조작 전 단계(사고 발생 보고)의 변화는 문제 시작과 함께 일어난다.
  const opening=new Set([sc.steps.find(s=>s.kind==='say')?.tag].filter(Boolean));
  for(const [tag,actions] of Object.entries(sc.autos)){
   const dos=[],runs=new Map();
   for(const a of actions){
    if(a.op==='insert'){dos.push({type:'insertTrain',station:a.station,slot:a.slot||E.platform(a.station,a.dir),number:a.number,direction:a.dir});continue;}
    const r=runs.get(a.number)||{type:'runTrain',number:a.number,legs:[]};runs.set(a.number,r);
    if(a.op==='move')r.legs.push({station:a.station,slot:a.slot,...(a.handover?{handover:true}:{})});else r.exit=true;
   }
   // 마지막 구간이 역간 폐색(승강장이 아닌 열번창)에서 끝나고 그 뒤로 다룰 목표가 없는 열차는 관제구간 밖으로 계속 간다
   // (안 그러면 폐색에 서서 뒤 열차를 막는다 — 비상 03 K0456이 B963T에 서서 G0450·G0452가 못 나가던 문제)
   const Wd=(node?require('./wiring.js'):root.SimWiring).data,named=new Set(JSON.stringify(book.list.map(o=>o.condition)).match(/[A-Z]\d{4}/g)||[]);
   for(const r of runs.values()){const last=r.legs.at(-1);if(!r.exit&&last&&!Wd[last.station]?.rails.some(x=>x[0]===last.slot)&&!named.has(r.number))r.exit=true;}
   dos.push(...runs.values());
   const trigger=opening.has(tag)?null:tagTo[tag];if(!opening.has(tag)&&!trigger)continue;
   // 진로를 기다려 달리는 열차(운행선 변경 등)는 관제사가 그 구간 진로를 내면 바로 출발 준비를 한다 — 통보 확인만 기다리지 않는다
   const routeGoals=trigger?.type==='communication'?book.list.filter(o=>{const c=routeOf(o.condition);if(!c)return false;const r=Core().forStation(c.station).routes[c.route];return [...runs.values()].some(x=>(x.legs||[]).some(l=>l.station===c.station&&r?.destination===l.slot));}).map(o=>({type:'objective',id:o.id})):[];
   const start=trigger&&routeGoals.length?{type:'any',conditions:[trigger,...routeGoals]}:trigger;
   const guards=[...runs.keys()].map(exists),when=[...(start?[start]:[]),...guards];
   reactions.push({id:'r-'+tag,label:trigger?`${trigger.type==='communication'?'통보':'목표'} ${trigger.id}${routeGoals.length?' 또는 '+routeGoals.map(g=>g.id).join('·'):''} 이후 열차 변화`:'사고 발생 시점의 열차 변화',...(when.length?{when:when.length===1?when[0]:{type:'all',conditions:when}}:{}),do:dos});
  }
  // 정지시켜야 할 신호 앞의 열차가 상황 반응(운행 재개 등)으로 이미 그 신호를 지나가 버리면, 그 신호 취소 목표는 이룰 기회가 지난 것이다:
  // 0점으로 닫혀 완료를 막지 않는다 (예: 비상 03 — 통보 14 뒤 A1002가 안양 2B로 출발하면 2B 취소는 놓침)
  const W=node?require('./wiring.js'):root.SimWiring,cast=E.castFor(sc);
  for(const o of book.list){if(o.condition.type!=='signalCancelled')continue;const {station,signal}=o.condition,rail=W.data[station]?.signals.find(x=>x[0]===signal)?.[1];
   const standing=cast.filter(c=>c.station===station&&c.slot===rail).map(c=>c.number);
   const runs=reactions.filter(r=>r.do.some(d=>d.type==='runTrain'&&standing.includes(d.number)));
   if(runs.length)o.missedWhen={type:'all',conditions:[{type:'any',conditions:runs.map(r=>({type:'reaction',id:r.id}))},{type:'signalStop',station,signal}]};}
  return {id:'P-'+sc.id,subject:'비상 시 조치',name:`비상시 조치 ${sc.title}`,limit:limits[sc.id]||900,score:100,voice:sc.problem,
   situation:[sc.problem,...sc.trains,...sc.notes].join('\n'),actions:reference(order),source:sc.source,
   trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:deductions(),
   setup:{clearTimetable:true,resetAll:true,reset:[...sc.stations],clear:E.numbersOf(sc),routes:setupRoutes,approach:[],modes:sc.stations.map(station=>({station,value:'AUTO'})),
    trains:E.castFor(sc).map(c=>({station:c.station,slot:c.slot,number:c.number,direction:c.dir}))},
   objectives:book.list,communications:[...comms,...(VB()?.proactiveFor(sc.key)||[])],reactions,
   // 상황별 대응 요령: 감독관이 상황을 바꾸는 분기 (교수가 모니터링에서 주입)
   branches:VB()?.branchesFor(sc.key)||[]};
 }
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
  gateRoutes(book.list);
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
  const seeded=seedRoutes(sc.station,sc.seed.routes,sc.seed.approach);
  if(seeded.routes.length!==sc.seed.routes.length)throw new Error(`${sc.id}: 초기 진로를 설정할 수 없습니다`);
  return {id:'P-'+sc.id,subject:'운행선 관리',name:`${sc.title}를 시행하시오`,limit:limits[sc.id]||600,score:100,voice:fill(sc.problem),
   situation:[fill(sc.problem),...cast.map(c=>`${c.id} : ${{fault:'고장열차',other:c.label||'다른 선 열차'}[c.key]||c.label||'후속열차'} (${nm(sc.station)}역 ${c.slot})`)].join('\n'),
   actions:reference(order)+'\n\n'+sc.notes.join('\n'),source:sc.source,
   trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:deductions(),
   setup:{clearTimetable:true,resetAll:true,reset:[sc.station],clear:cast.map(c=>c.id),routes:seeded.routes,approach:seeded.approach,modes:[{station:sc.station,value:'AUTO'}],
    trains:cast.map(c=>({station:sc.station,slot:c.slot,number:c.id,direction:c.dir}))},
   objectives:book.list,communications:comms,reactions};
 });
}

// Generated training schedules belong to a selected FTS preset, never to startup.
// Source scripts specify train numbers/directions/starting positions, not absolute times.
// Place the starting station at +10 minutes with 3-minute spacing in cast order.
function castLine(c){
 const Line=node?require('./line'):root.SimLine,W=node?require('./wiring'):root.SimWiring;
 const rail=W.data[c.station]?.rails.find(r=>r[0]===c.slot||r[3]===c.slot||r[4]===c.slot);
 const trunk=Line.trunkOf(c.slot)||Line.trunkOf(rail?.[c.direction==='down'?3:4])||Line.trunkOf(rail?.[3])||Line.trunkOf(rail?.[4]);
 return trunk?Line.mainLineOf(trunk)[0]:c.number?.startsWith('A')?'G':'E';
}
function routesOnLine(station,direction,family,standingTrack){
 const Line=node?require('./line'):root.SimLine,W=node?require('./wiring'):root.SimWiring,def=W.data[station];if(!def)return null;
 const core=Core().forStation(station),dir=direction==='down'?1:-1;
 const matches=code=>{const trunk=Line.trunkOf(code);return trunk&&Line.mainLineOf(trunk)[0]===family;};
 const routes=Object.entries(core.routes).map(([id,r])=>({id,...r})),rank=r=>Object.values(r.pointPositions).filter(x=>x==='R').length;
 const arrivals=routes.filter(r=>core.signals[r.signal].kind==='장내'&&core.signals[r.signal].dir===dir&&r.geometryRails.some(id=>{const rail=def.rails.find(x=>x[0]===id);return matches(rail?.[dir===1?3:4]);})).sort((a,b)=>rank(a)-rank(b));
 const arr=arrivals.find(r=>r.destination===standingTrack)||arrivals[0];
 const departures=routes.filter(r=>core.signals[r.signal].kind==='출발'&&core.signals[r.signal].dir===dir&&matches(r.destination)).sort((a,b)=>rank(a)-rank(b));
 const dep=departures.find(r=>r.geometryRails[0]===(standingTrack||arr?.destination))||departures.find(r=>r.geometryRails[0]===arr?.destination);
 if(!arr&&!dep)return {arrivalRoute:'',departureRoute:'',track:'',stopType:'통과',routeSource:'scenario-line'};
 const linked=dep&&arrivals.find(r=>r.destination===dep.geometryRails[0]);
 return {arrivalRoute:(linked||arr)?.id.replace('-','_')||'',departureRoute:dep?.id.replace('-','_')||'',track:(linked||arr)?.destination||standingTrack||'',routeSource:'scenario-line'};
}
function initialTrack(problem,c,family){
 const W=node?require('./wiring'):root.SimWiring;if(W.data[c.station]?.rails.some(r=>r[0]===c.slot))return c.slot;
 const core=Core().forStation(c.station),dir=c.direction==='down'?1:-1;
 for(const x of problem.setup?.routes||[]){if(x.station!==c.station)continue;const r=core.routes[x.route];if(r&&core.signals[r.signal].kind==='장내'&&core.signals[r.signal].dir===dir){const first=r.geometryRails[0],rail=W.data[c.station]?.rails.find(r=>r[0]===first),code=rail?.[dir===1?3:4];if(castLine({station:c.station,slot:code,direction:c.direction})===family)return r.destination;}}
 return undefined;
}
function timetableFor(problem){
 const Tt=T(),network=N(),model={trains:[]},cast=problem.setup?.trains||[];
 const specs=cast.map((c,i)=>{const family=castLine(c);return {id:c.number,direction:c.direction,station:c.station,slot:initialTrack(problem,c,family),family,arrival:600+i*180};});
 if(problem.id==='P-TG-01')specs.push({id:'K1135',direction:'down',station:'yongsan',arrival:600});
 if(problem.id==='P-sch-conflict')specs.push({id:'K1131',direction:'down',station:network.stations[0].id,arrival:600});
 const seen=new Set();
 for(const c of specs){
  if(seen.has(c.id))continue;seen.add(c.id);
  const down=c.direction==='down',family=c.family||'E',north=family==='G'?'seoul':network.stations[0].id,from=down?north:network.stations.at(-1).id,to=down?network.stations.at(-1).id:north;
  const train=Tt.pattern({id:c.id,from,to,start:0,kind:c.id.startsWith('A')?'KTX':'전동열차'});
  const at=train.calls.find(x=>x.station===c.station);if(!at)throw Error(problem.id+' timetable station missing: '+c.station);
  const shift=c.arrival-at.arrival;for(const [i,call] of train.calls.entries()){call.arrival+=shift;call.departure+=shift;const routes=routesOnLine(call.station,c.direction,family,call.station===c.station?c.slot:undefined);if(routes)Object.assign(call,routes);if(i===0){call.arrivalRoute='';call.stopType='시발';}if(i===train.calls.length-1){call.departureRoute='';call.stopType='종착';}}
  train.plan=structuredClone(train.calls);if(!Tt.valid(train))throw Error(problem.id+' timetable invalid: '+c.id);
  model.trains.push(train);
 }
 return {serviceDate:'2000-01-01',trains:model.trains};
}
const api={emergency,evacuation,timetableFor,all:o=>[...evacuation(o),...emergency(o)]};
if(node)module.exports=api;else root.SimFTSBuiltins=api;
})(typeof globalThis!=='undefined'?globalThis:this);

'use strict';
// Authoritative instructor session: no DOM, browser timer or renderer-local training state.
const F=require('./fts'),V=require('./voice'),Line=require('./line'),Net=require('./network');
const clone=structuredClone,active=s=>s&&!s.finished;
function create(host){
 let library=clone(host.defaults()),users=[{role:'교수',id:'001',name:'교수'},{role:'교육생',id:'tester',name:'교육생',number:'202201'}],history=[],session=null,runLibrary=null,events=[],ui={},revision=0,sequence=0,notice=null,configured=false,logs=[];
 // 제어통제 로그: 교수 프로그램(FTS)의 기록. 교육생이 쓰는 MMI 로그에는 남기지 않는다.
 const log=(text,level='I')=>{logs.unshift({seq:++sequence,at:now(),time:new Date().toISOString(),text,level});if(logs.length>500)logs.length=500;};
 const now=()=>host.context().now;
 const announce=(kind,text,logText=text)=>{notice={id:++sequence,kind,text,index:session?.current};log(logText,kind==='error'?'E':'I');};
 const error=r=>{if(r?.ok===false)throw Error(r.message||'현상 적용 실패');return r;};
 const current=()=>session?.items[session.current];
 const problem=it=>runLibrary.problems.find(p=>p.id===it.problem);
 const taskKey=it=>'fts:'+session.id+':'+session.current+':'+(session.attempt||0);
 function context(it,elapsed){const c=host.context(),p=problem(it);return {...c,events:events.filter(e=>e.seq>(it.eventSeq??0)&&e.source!=='FTS'),elapsed,ui,manual:session.manual[session.current]||{},script:p.script?host.scriptStatus(p.script):null};}
 function syncAssessment(it){const p=problem(it);host.beginTask({key:it.taskKey,title:p.name,subject:{'열차 운행 계획':'plan','철도관제시스템 운용':'operation','운행선 관리':'line','비상 시 조치':'emergency'}[p.subject],limitSeconds:p.limit});}
 function apply(ph){const action=(station,a)=>error(host.apply({type:'control',station,action:{...a,source:'FTS'}}));const c=host.context();switch(ph.type){
  case 'insertTrain':owned.add(ph.number);error(host.apply({type:'numbers',action:{op:'insert',station:ph.station,slot:ph.slot,number:ph.number,direction:ph.direction}}));break;
  case 'deleteTrain':for(const [station,s]of Object.entries(c.ls.stations))for(const [slot,rows]of Object.entries(s.windows))for(const r of [...rows])if(r.number===ph.number)error(host.apply({type:'numbers',action:{op:'delete',station,slot,uid:r.uid}}));break;
  case 'mode':if(c.states[ph.station].mode!==ph.value)action(ph.station,{type:'mode',value:ph.value});break;
  case 'route':{const before=c.states[ph.station].mode;if(before==='LOCAL')throw Error('LOCAL 역의 진로는 CCM 전환 후 설정하세요.');try{if(before!=='CCM')action(ph.station,{type:'mode',value:'CCM'});action(ph.station,{type:'route',id:ph.route});}finally{if(before!=='CCM')action(ph.station,{type:'mode',value:before});}break;}
  case 'approach':action(ph.station,{type:'approach',signal:ph.signal,present:true});break;
  case 'createTrain':{const [h,m,s=0]=String(ph.start||'').split(':').map(Number),start=ph.startIn!==undefined?Math.round(now()+ph.startIn):h*3600+m*60+s-28800,t=host.pattern({id:ph.train,from:ph.from,to:ph.to,start,kind:ph.kind||'전동열차'});if(ph.replace&&c.model.trains.some(x=>x.id===ph.train))error(host.apply({type:'timetable',method:'remove',args:[ph.train]}));error(host.apply({type:'timetable',method:'create',args:[t]}));break;}
  case 'delay':error(host.apply({type:'timetable',method:'delay',args:[ph.train,ph.station,ph.minutes]}));break;
  case 'cancel':error(host.apply({type:'timetable',method:'setCancelled',args:[ph.train,ph.from,ph.to,true]}));break;
  case 'moveTrain':{let found=null;for(const [station,s]of Object.entries(c.ls.stations))for(const [slot,rows]of Object.entries(s.windows))for(const r of rows)if(r.number===ph.number)found={station,slot,uid:r.uid};
   if(!found)throw Error(ph.number+' 열차번호가 LS에 없습니다');if(found.station!==ph.station||found.slot!==ph.slot)error(host.apply({type:'numbers',action:{op:'move',station:found.station,slot:found.slot,uid:found.uid,targetStation:ph.station,targetSlot:ph.slot}}));break;}
  case 'resetStation':host.resetStation(ph.station);break;
  case 'resetAll':host.resetAll();break;
  case 'clearTimetable':error(host.apply({type:'timetable',method:'import',args:[{serviceDate:c.model.serviceDate,trains:[]}]}));break;
  case 'stopTrain':{let f=null;for(const [station,s]of Object.entries(host.context().ls.stations))for(const [slot,rows]of Object.entries(s.windows))for(const r of rows)if(r.number===ph.number)f={station,slot,uid:r.uid};
   if(!f)throw Error(ph.number+' 열차번호가 LS에 없습니다');error(host.apply({type:'scenario:move',auto:true,action:{op:'stop',station:f.station,slot:f.slot,uid:f.uid,...(ph.station?{targetStation:ph.station}:{})}}));break;}
  case 'runTrain':{let f=null;for(const [station,s]of Object.entries(host.context().ls.stations))for(const [slot,rows]of Object.entries(s.windows))for(const r of rows)if(r.number===ph.number)f={station,slot,uid:r.uid};
   if(!f){if(ph.ifPresent)break;throw Error(ph.number+' 열차번호가 LS에 없습니다');}
   for(const l of ph.legs||[])error(host.apply({type:'scenario:move',auto:true,action:{op:'move',station:f.station,slot:f.slot,uid:f.uid,targetStation:l.station,targetSlot:l.slot,handover:!!l.handover,...(l.rescue?{rescue:true}:{})}}));
   if(ph.exit)error(host.apply({type:'scenario:move',auto:true,action:{op:'delete',station:f.station,slot:f.slot,uid:f.uid,...(ph.handSignal?{handSignal:true}:{}),...(ph.dwell?{dwell:ph.dwell}:{})}}));break;}
  case 'alarm':host.alarm(ph.text);break;
  case 'notice':session.notice=ph.text;announce('notice',ph.text,'안내 · '+ph.text);break;
  default:throw Error('지원하지 않는 현상');
 }log('현상 발생 · '+F.PHENOMENA[ph.type].label);}
 // 대본 열차: FTS가 배치·등장시킨 열차와 그 열차가 바꾼 번호(K0450 → G0450). 시간표 자동운전은 이 번호들을 만들거나 옮기지 않는다 —
 // 문제가 끝난 뒤에도 그 시간표를 쓰는 동안은 그대로 (전에는 문제 진행 중에만 처음 배치한 번호를 막아, 끝나면 시간표의 K0450이 다시 생겼다)
 const owned=new Set();
 function loadTimetable(t,relative=false){
  owned.clear();
  const table=F.scheduleTable({timetable:t,relative},now(),host.context().model.serviceDate);
  error(host.apply({type:'timetable',method:'import',args:[table]}));
 }
 function loadSituation(it){if(session.loadedEntry===it.situationIndex)return;host.stopScript();const s=runLibrary.situations.find(s=>s.id===it.situation),sch=runLibrary.schedules?.find(x=>x.id===s.scheduleId),t=s.timetable||sch?.timetable;if(t)loadTimetable(t,!s.timetable&&sch?.relative);session.loadedEntry=it.situationIndex;session.situationStartedAt=now();session.situationDeadline=s.limit?now()+s.limit:null;session.notice='';log('상황 시작 · '+s.name);}
 function close(reason){if(!session||session.closed)return;const t=now();host.endScript();for(let i=session.current;i<session.items.length;i++){const it=session.items[i];if(it.status==='진행'){it.endedAt=t;it.status='종료';host.endTask(it.taskKey,'stopped');}else if(it.status==='대기'){it.status='미실시';it.endedAt=t;}}
  session.finished=true;session.closed=true;session.endedAt=t;session.reason=reason;const sum=F.summary(runLibrary,session);history.unshift({id:session.id,at:new Date().toISOString(),professor:session.professor,student:session.student,scenario:session.scenarioName,reason,duration:t-session.startedAt,overtime:Math.max(0,t-session.startedAt-(session.totalLimit||3600)),...sum,attempts:clone(session.attempts||[])});history=history.slice(0,200);host.finishAssessment();host.pause(true);announce('finished',`교육 종료 · ${session.scenarioName} · ${sum.got}/${sum.full}점 (${reason})`);
 }
 function fail(it,e){it.error=String(e.message||e);host.pause(true);announce('error','교육 현상 적용 오류 · '+it.error+' · 상황 재로딩 또는 교육 종료로 처리하세요.');}
 // 문제가 끝나도 상황 반응이 보낸 열차는 계속 달린다(회송열차 G0452 등): 대본 실행(script)만 멈춘다. 운행 작업은 다음 문제가 역을 초기화할 때 지워진다.
 function ended(it,status){host.endTask(it.taskKey,status==='완료'?'completed':'stopped');host.endScript();announce('end',`문제 ${status} · ${problem(it).name} · ${it.score}점`);}
 function step(){if(!active(session))return;const it=current();if(!it){close('모든 문제 종료');return;}if(it.error)return;
  try{loadSituation(it);
   if(session.situationDeadline!==null&&now()>=session.situationDeadline){const entry=it.situationIndex;host.endScript();      // 시간초과도 완료와 같다: 대본 실행만 멈추고 상황 반응이 보낸 열차는 계속 달린다 (A7)
while(current()?.situationIndex===entry){const x=current();if(x.startedAt===null)x.startedAt=now();F.finish(session,x,'시간초과',now());ended(x,'시간초과');}if(session.finished)close('상황 제한시간 종료');return;}
   for(let pass=0;pass<4&&active(session);pass++){
    const out=F.advance(runLibrary,session,(x,e)=>context(x,e),now());if(!out.length)break;let again=false;
    for(const o of out){
     if(o.kind==='activate'){host.clearAlarms?.();
      if(o.problem.setup?.scheduleId){const sch=runLibrary.schedules?.find(s=>s.id===o.problem.setup.scheduleId);if(!sch)throw Error('문제 시간표를 찾을 수 없습니다: '+o.problem.setup.scheduleId);loadTimetable(sch.timetable,sch.relative);}
      o.item.eventSeq=sequence;o.item.taskKey=taskKey(o.item);if(o.problem.script){const started=error(host.startScript(o.problem.script,o.problem.train,o.item.taskKey,ui));if(started?.problem)o.item.statement=started.problem;else delete o.item.statement;}syncAssessment(o.item);announce('activate',o.problem.voice||o.problem.name,'문제 발생 · '+o.problem.name);again=true;}
     if(o.kind==='phenomenon'){if(!(o.reaction&&voiceRan(o.reaction,o.phenomenon)))apply(o.phenomenon);again=true;}
     if(o.kind==='branch'){const said=String(o.branch.text||o.branch.label).split('\n')[0].replace(/^[\s▪•·-]+/,'').trim()||o.branch.label;announce('branch','상황 변경 · '+said,'상황 변경 · '+o.branch.label);again=true;}
     if(o.kind==='end'){ended(o.item,o.status);again=false;}
     if(o.kind==='finished')close('모든 문제 종료');
    }
    for(const o of out)if(o.kind==='activate'&&session.voice)voiceBegin(o.item);
    if(!again)break;
   }
  }catch(e){fail(current()||it,e);}
 }
 function configure(next){const errors=F.validate(next,{scripts:host.scripts,drafts:true});if(errors.length)return {ok:false,message:errors.join('\n')};library=clone(next);library.schedules??=[];configured=true;revision++;return {ok:true};}
 function command(a){switch(a.op){
  case 'bootstrap':if(!configured){if(a.library){const up=F.upgrade(a.library,host.defaults()),r=configure(up);if(up!==a.library)log('내장 문제를 이 앱 버전의 최신 내용으로 갱신했습니다.','I');if(!r.ok)return r;}if(Array.isArray(a.history))history=clone(a.history.slice(0,200));if(Array.isArray(a.users)&&a.users.length){const r=command({op:'users',users:a.users});if(!r.ok)return r;}configured=true;}return {ok:true};
  case 'library':return configure(a.library);
  case 'users':if(!Array.isArray(a.users)||a.users.some(u=>!u||!['교수','교육생'].includes(u.role)||typeof u.id!=='string'||!u.id||typeof u.name!=='string'||!u.name)||new Set(a.users.map(u=>u.id)).size!==a.users.length)return {ok:false,message:'사용자 ID·이름·구분을 확인하세요.'};users=clone(a.users);revision++;return {ok:true};
  case 'start':{if(active(session))return {ok:false,message:'진행 중인 교육을 먼저 종료하세요.'};const sc=library.scenarios.find(s=>s.id===a.scenario);if(!sc)return {ok:false,message:'시나리오를 선택하세요.'};const sits=library.situations.filter(s=>sc.situations.includes(s.id)),pids=sits.flatMap(s=>s.problems),selected={...library,scenarios:[sc],situations:sits,problems:library.problems.filter(p=>pids.includes(p.id))};const errors=F.validate(selected,{scripts:host.scripts});if(errors.length)return {ok:false,message:errors.join('\n')};const prof=users.find(u=>u.id===a.professor&&u.role==='교수'),stud=users.find(u=>u.id===a.student&&u.role==='교육생');if(!prof||!stud)return {ok:false,message:'교수와 교육생을 선택하세요.'};configured=true;runLibrary=clone(library);session=F.createSession(runLibrary,sc.id,{professor:prof.name,student:stud.id,startedAt:now()});Object.assign(session,{id:'E'+Date.now()+'-'+(++sequence),showActions:a.showActions!==false,...(a.voice?{voice:{items:{}}}:{}),loadedEntry:null,attempt:0,attempts:[]});events=[];const budget=host.startAssessment();session.totalLimit=budget?.session?.limitSeconds||3600;host.pause(false);host.auto(a.autoRun!==false);announce('start','교육 시작 · '+sc.name);step();return {ok:true};}
  case 'ui':if(!a.ui||!Array.isArray(a.ui.windows)||a.ui.windows.length>100)return {ok:false,message:'화면 상태를 확인하세요.'};ui=clone(a.ui);return {ok:true};
  case 'manual':{const it=current();if(!active(session)||!it||it.error)return {ok:false,message:'진행 중인 문제가 없습니다.'};const p=F.view(problem(it),it),allowed=(problem(it).branches||[]).map(b=>'branch:'+b.id);const visit=c=>{if(c?.type==='manual')allowed.push(c.key||c.label);if(Array.isArray(c?.conditions))c.conditions.forEach(visit);if(c?.condition)visit(c.condition);};[...(p.checks||[]),...(p.deductions||[]),...(p.objectives||[])].forEach(k=>visit(k.condition));for(const c of p.communications||[])allowed.push('comm:'+c.id);if(!allowed.includes(a.key))return {ok:false,message:'현재 문제의 구술 확인 항목이 아닙니다.'};if(a.key.startsWith('branch:')&&session.manual[session.current]?.[a.key])return {ok:false,message:'이미 발생한 상황 변경입니다.'};if(a.key.startsWith('branch:'))a={...a,checked:true};const m=session.manual[session.current]??={};m[a.key]=a.checked??!m[a.key];log('교수 확인 · '+a.key+' · '+(m[a.key]?'확인':'취소'));return {ok:true};}
  case 'next':if(active(session)){const it=current();if(it){ended(it,'종료');F.endCurrent(session,now());if(session.finished)close('모든 문제 종료');}}return {ok:true};
  case 'stop':close('교수 종료');return {ok:true};
  case 'reload':{if(!active(session))return {ok:false,message:'진행 중인 교육이 없습니다.'};const it=current(),entry=it.situationIndex,indices=session.items.map((x,i)=>x.situationIndex===entry?i:-1).filter(i=>i>=0);session.attempts.push({entry,at:now(),items:clone(indices.map(i=>session.items[i]))});for(const i of indices){const x=session.items[i];Object.assign(x,{status:'대기',startedAt:null,endedAt:null,met:[],deducted:[],score:0});delete x.error;delete x.fired;delete session.manual[i];}session.current=indices[0];session.readyAt=now();session.loadedEntry=null;session.attempt++;host.pause(false);announce('reload','상황 재로딩 · 이전 시도 기록 보존');step();return {ok:true};}
  case 'clearHistory':history=[];return {ok:true};
  case 'voice':{const it=current();if(!active(session)||!session.voice||!it||it.error||it.status!=='진행')return {ok:false,message:'음성 모드로 진행 중인 문제가 없습니다.'};const r=voiceHear(it,String(a.text||'').slice(0,500));step();return r;}
  default:return {ok:false,message:'알 수 없는 FTS 명령'};
 }}
 function event(e){if(active(session)){events.push({...clone(e),seq:++sequence,at:now()});if(events.length>4000)events.shift();
  // 열번 이동은 LS 표시를 고치는 조작일 뿐 열차를 움직이지 않는다: 열차 운행·구원연결 목표로 인정하지 않는다는 것을 교수 로그에 남긴다
  if(e.type==='lsOperation'&&e.ok&&e.source!=='FTS'&&e.operation?.op==='move')manualMove(e.operation);}}
 // 열번 수동 이동: 문제가 그 열차의 열번 이동을 요구하면(목표·채점 항목에 trainAt — 단선지령식 반대선 운행, 관제시스템 운용·열차운행계획의 「열번 이동」 문제) 정상 조작, 그 밖에는 표시 정정일 뿐이다
 function manualMove(op){const it=current();if(!it)return;const target=op.targetStation||op.station;let number='';for(const rows of Object.values(host.context().ls.stations[target]?.windows||{}))for(const r of rows)if(r.uid===op.uid)number=r.number;
  const leaf=(c,n)=>c?.type==='trainAt'&&c.number===n||(c?.conditions||[]).some(k=>leaf(k,n))||(c?.condition&&leaf(c.condition,n));
  const v=F.view(problem(it),it),expected=number&&[...(v?.objectives||[]),...(v?.checks||[])].some(o=>leaf(o.condition,number));
  if(expected)log(`열번 수동 이동 · ${number} → ${target} ${op.targetSlot||''} (문제가 요구한 열번 이동 — 단선지령식 반대선 운행, 열번 이동 문제 등)`,'I');
  else log(`수동 열번 이동 · ${number||''} → ${target} ${op.targetSlot||''} (표시 정정 — 열차 운행으로 채점하지 않음. 열차는 진로·신호와 지시로 움직여야 합니다)`,'W');}
 // ── 음성 1인 모드 (engine/voice.js): 교육생의 무전 한 마디 = 대본 한 단계. 그 말에 나온 열차만 반응하고, 상대 대사를 화면이 음성으로 읽는다.
 const plans=new Map();
 function voicePlan(it){const v=F.view(problem(it),it),key=it.problem+'|'+JSON.stringify(it.branch||{});if(!plans.has(key))plans.set(key,V.plan(v));return plans.get(key);}
 function voiceState(it){const k=session.items.indexOf(it);return session.voice.items[k]??={done:{},ran:[],played:{},queue:[],heard:[],seq:0};}
 function say(st,lines){for(const l of lines)st.queue.push({seq:++st.seq,who:l.who,name:l.name,text:l.text});if(st.queue.length>200)st.queue.splice(0,st.queue.length-200);}
 const voiceRan=(rid,ph)=>{const it=current();if(!session?.voice||!it)return false;return voiceState(it).ran.includes(rid+'|'+JSON.stringify(ph));};
 function findTrain(number){for(const [station,x] of Object.entries(host.context().ls.stations))for(const [slot,rows] of Object.entries(x.windows))for(const r of rows)if(r.number===number)return {station,slot,uid:r.uid,direction:r.direction};return null;}
 // 지금 열차가 닿아 있는 곳의 노선 순서 (비연동 중간역 열번창이면 그 역, 아니면 그 연동역)
 function orderAt(f){for(const [id,I] of Object.entries(Line.INTERMEDIATE))if(I.host===f.station&&Object.values(I.slots).some(x=>x===f.slot||Line.circuitOf(f.station,f.slot)===x))return Net.catalog[id].order;return Net.catalog[f.station].order;}
 // 「○○열차 ○○역 정차 / 출발 정지」: 그 역(비연동 중간역은 그 역 정차 칸)에 세운다. 이미 지나쳤으면 다음 역에 선다.
 function voiceStop(st,{number,station}){
  const f=findTrain(number);if(!f){log('음성 · '+number+' 열차를 LS에서 찾지 못했습니다','W');return;}
  const target=Net.catalog[station],passed=(orderAt(f)-target.order)*(f.direction==='down'?1:-1)>0;
  let action={op:'stop',station:f.station,slot:f.slot,uid:f.uid};
  if(passed)log(`음성 · ${number} 열차는 이미 ${target.name}역을 지났습니다 — 다음 역에 정차`,'W');
  else if(target.controlled)action.targetStation=station;
  else{const z=V.stopSlot(station,f.direction);if(z){const win=Object.keys(host.context().ls.stations[z.host]?.windows||{});action.targetStation=z.host;action.targetSlot=win.includes(z.slot)?z.slot:win.find(w=>Line.circuitOf(z.host,w)===z.slot)||z.slot;}}
  error(host.apply({type:'scenario:move',auto:true,action}));
 }
 // 열차별 반응: 통보의 상황 반응 중 「통보 + 그 열차들이 남아 있음」만 조건인 것은, 그 열차에게 할 말을 다 하면 그 열차 몫만 먼저 실행한다
 const simple=(r,cid)=>{const w=r.when,leaf=c=>c?.type==='communication'?c.id===cid:c?.type==='not'?c.condition?.type==='trainGone':c?.type==='any'||c?.type==='all'?(c.conditions||[]).every(leaf):false;return w?.type==='communication'?w.id===cid:w?.type==='all'&&w.conditions.some(c=>c.type==='communication'&&c.id===cid)&&w.conditions.every(leaf);};
 function voiceTrainDone(it,st,P,cid,number){
  const mine=P.steps.filter(s=>s.comm===cid&&s.required&&s.to.includes(number));if(!mine.every(s=>st.done[s.id]!=null))return;
  for(const r of F.view(problem(it),it).reactions||[]){if(!simple(r,cid)||it.reactions?.[r.id]?.fired)continue;
   for(const ph of r.do){const key=r.id+'|'+JSON.stringify(ph);if(ph.number!==number||st.ran.includes(key))continue;st.ran.push(key);apply(ph);}}
 }
 // 문제 시작: 대본에서 「정차」 지시를 받는 열차는 달리고 있다 — 말할 틈을 주고(대본 순서만큼) 출발한다. 상대가 먼저 거는 무전이면 그 무전부터 울린다.
 function voiceBegin(it){const st=voiceState(it),P=voicePlan(it),req=P.steps.filter(s=>s.required);if(st.begun)return;st.begun=true;
  const begun=new Set();
  for(const s of P.steps)if(s.stop&&!begun.has(s.stop.number)){begun.add(s.stop.number);const f=findTrain(s.stop.number);if(!f)continue;/* 대본에 두 번 나오는 열차(「정차」 뒤 「출발 정지」)는 처음 지시를 기준으로 한 번만 */const startIn=60+15*Math.max(0,req.indexOf(s));
   const r=host.apply({type:'scenario:move',auto:true,action:{op:'delete',station:f.station,slot:f.slot,uid:f.uid,startIn}});if(r?.ok===false)log('음성 · '+s.stop.number+' 운행 시작 실패: '+r.message,'W');}
  voiceLead(st,P);}
 function voiceLead(st,P){const next=P.comms.find(c=>c.steps.some(id=>{const s=P.steps.find(x=>x.id===id);return s.required&&st.done[id]==null;})||c.steps.every(id=>!P.steps.find(x=>x.id===id).required)&&!st.played[c.id]);
  if(next?.incoming&&!st.played[next.id]){st.played[next.id]=true;say(st,next.lead);}}
 function voiceHear(it,text){
  const st=voiceState(it),P=voicePlan(it),elapsed=now()-(it.startedAt??now());
  const open=P.comms.find(c=>c.steps.some(id=>{const s=P.steps.find(x=>x.id===id);return s.required&&st.done[id]==null;}));
  const hits=V.match(P,st.done,text,{current:open?.id});
  st.heard.push({at:elapsed,text,norm:V.normalize(text),steps:hits.map(h=>h.step.id)});if(st.heard.length>300)st.heard.shift();
  if(!hits.length&&V.isAck(text)){st.heard.at(-1).ack=true;return {ok:true,matched:[],ack:true,heard:V.normalize(text)};}
  if(!hits.length){log('음성 · 알아듣지 못함 · '+text,'W');return {ok:true,matched:[],heard:V.normalize(text)};}
  const m=session.manual[session.current]??={};
  for(const {step:s} of hits){
   st.done[s.id]=elapsed;log('음성 · '+s.comm+' · '+s.text.slice(0,60));
   if(s.stop)voiceStop(st,s.stop);
   say(st,s.reply);
   for(const n of s.to)voiceTrainDone(it,st,P,s.comm,n);
   const c=P.comms.find(c=>c.id===s.comm);
   if(c.steps.every(id=>{const x=P.steps.find(y=>y.id===id);return !x.required||st.done[id]!=null;})&&!m['comm:'+c.id]){m['comm:'+c.id]=true;log('음성 · 통보 '+c.id+' 확인 (필요한 말을 모두 함)');}
  }
  voiceLead(st,P);
  return {ok:true,matched:hits.map(h=>({id:h.step.id,comm:h.step.comm,text:h.step.text})),heard:V.normalize(text)};
 }
 // 원격 리모컨(모바일)용 요약: 엔진 전체 스냅숏 대신 지금 문제·시간·교수가 누를 항목만 내려 준다
 function remoteView(){
  // 교육 전(또는 끝난 뒤): 리모컨에서 시나리오를 골라 교육을 시작할 수 있게 목록을 같이 준다
  const setup={scenarios:library.scenarios.map(s=>({id:s.id,name:s.name,count:library.situations.filter(x=>s.situations.includes(x.id)).reduce((n,x)=>n+x.problems.length,0)})),
   professors:users.filter(u=>u.role==='교수').map(u=>({id:u.id,name:u.name})),students:users.filter(u=>u.role==='교육생').map(u=>({id:u.id,name:u.name||u.id}))};
  if(!session)return {active:false,setup};
  const it=session.items[Math.min(session.current,session.items.length-1)],p=it&&problem(it),idx=session.items.indexOf(it);
  if(!it||!p)return {active:false,setup};
  const v=F.view(p,it),elapsed=it.startedAt!=null?(it.endedAt??now())-it.startedAt:0,manual=[],seen=new Set();
  const visit=c=>{if(c?.type==='manual'){const key=c.key||c.label;if(!seen.has(key)){seen.add(key);manual.push({key,label:c.label,on:!!session.manual[idx]?.[key]});}}(c?.conditions||[]).forEach(visit);if(c?.condition)visit(c.condition);};
  [...(p.checks||[]),...(p.deductions||[])].forEach(k=>visit(k.condition));
  return {active:!session.finished,finished:!!session.finished,scenario:session.scenarioName,professor:session.professor,student:session.student,index:session.current,total:session.items.length,
   problem:{name:p.name,subject:p.subject,limit:p.limit||0,status:it.status,error:it.error||null},elapsed,remaining:Math.max(0,(p.limit||0)-elapsed),
   comms:(v?.communications||[]).map(c=>({key:'comm:'+c.id,label:c.label,text:c.text||'',at:it.comm?.[c.id]??null,optional:!!c.optional})),
   branches:(p.branches||[]).map(b=>({key:'branch:'+b.id,label:b.label,at:it.branch?.[b.id]??null})),manual,
   voice:session.voice?(()=>{const st=session.voice.items[idx];return {on:true,heard:(st?.heard||[]).slice(-6).reverse().map(h=>({text:h.text,ok:!!h.steps.length||!!h.ack,steps:h.steps.map(id=>{const step=voicePlan(it).steps.find(x=>x.id===id);return step?step.comm+' · '+step.text.slice(0,40):id;})}))};})():null,
   result:session.finished?F.summary(runLibrary,session):null,...(session.finished?{setup}:{})};
 }
 function checkpoint(){return clone({library,users,history,session,runLibrary,events,ui,revision,sequence,notice,configured,logs});}
 function restore(data){if(!data){session=null;runLibrary=null;events=[];ui={};notice=null;return;}validateCheckpoint(data,host.scripts);({library,users,history,session,runLibrary,events,ui,revision,sequence,notice,configured}=clone(data));const up=F.upgrade(library,host.defaults()),stale=up!==library;library=up;logs=Array.isArray(data.logs)?clone(data.logs.slice(0,500)):[];if(stale)log('내장 문제를 이 앱 버전의 최신 내용으로 갱신했습니다.','I');}
 return {command,step,event,checkpoint,restore,remoteView,isActive:()=>active(session),ownsScript:()=>!!(active(session)&&current()&&problem(current()).script),library:()=>library,runLibrary:()=>runLibrary,reservedNumbers:()=>[...new Set([...owned,...(active(session)?(problem(current())?.setup?.trains||[]).map(t=>t.number):[])])],own:(from,to)=>{if(owned.has(from))owned.add(to);},snapshot:()=>({session,history,users,revision,notice,logs})};
}
function validateCheckpoint(d,scripts){if(!d||!Number.isInteger(d.sequence)||d.sequence<0||!Number.isInteger(d.revision)||d.revision<0||F.validate(d.library,{scripts,drafts:true}).length||d.runLibrary&&F.validate(d.runLibrary,{scripts,drafts:true}).length||!Array.isArray(d.users)||d.users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||!['교수','교육생'].includes(u.role))||!Array.isArray(d.history)||d.history.some(h=>!h||!Array.isArray(h.rows)||!Number.isFinite(h.got)||!Number.isFinite(h.full))||!Array.isArray(d.events)||!Number.isInteger(d.sequence)||!Number.isInteger(d.revision))throw Error('Invalid FTS checkpoint');if(d.session){const s=d.session;if(!d.runLibrary||!Array.isArray(s.items)||!Number.isInteger(s.current)||s.current<0||s.current>s.items.length||!Number.isFinite(s.startedAt)||!s.manual||s.items.some(it=>!d.runLibrary.problems.some(p=>p.id===it.problem)||!d.runLibrary.situations.some(x=>x.id===it.situation)||!Number.isInteger(it.situationIndex)||!Number.isFinite(it.score)||!Array.isArray(it.met)||!Array.isArray(it.deducted)||it.startedAt!==null&&!Number.isFinite(it.startedAt)||it.endedAt!==null&&!Number.isFinite(it.endedAt)||!['대기','진행','완료','시간초과','종료','미실시'].includes(it.status)))throw Error('Invalid FTS session');}}
module.exports={create,validateCheckpoint};

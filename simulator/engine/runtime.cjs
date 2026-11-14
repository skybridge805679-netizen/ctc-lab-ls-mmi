'use strict';
const Session=require('./session'),Core=require('./core'),Network=require('./network'),Timetable=require('./timetable'),Windows=require('./train-windows'),Operations=require('./ls-operations');
function create(){
 const session=Session.create(),states=session.states,model=Timetable.initial();
 const assessment=require('./assessment').create(),now=()=>states[session.selected].clock;
 let scheduleIds={today:null,tomorrow:null,reserved:{}};
 const ops=Operations.create(Object.fromEntries(Object.entries(Windows.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=ops.initial();
  // 단선지령식 반대선 운행처럼 대본이 「반대선 운행이라 수동 이동」하는 열차는 LS가 번호를 따라가지 못할 뿐 실제로는 지나간다:
  // 역을 넘어 열번을 옮기면, 그 사이 역들에 같은 방향으로 세워 둔 입환진로(종각 51-1T, 동묘앞 24-B015T 등)는 열차가 지나가 해정된 것으로 본다.
  function passedShuntRoutes(a){
   if(a.op!=='move'||!a.targetStation||a.targetStation===a.station)return;
   const N=root.SimNetwork,from=N.catalog[a.station]?.order,to=N.catalog[a.targetStation]?.order,row=(ls.stations[a.targetStation]?.windows[a.targetSlot]||[]).find(t=>t.uid===a.uid);if(from==null||to==null||!row)return;
   const dir=row.direction==='down'?1:-1,lo=Math.min(from,to),hi=Math.max(from,to);
   for(const st of N.stations){if(!st.controlled||st.order<lo||st.order>hi)continue;const s=states[st.id],C=root.SimCore.forStation(st.id);if(!s)continue;
    for(const [id,x] of Object.entries(s.routes)){const sig=C.signals[C.routes[id]?.signal];if(x.occupied||sig?.kind!=='입환'||sig.dir!==dir)continue;
     const o=C.dispatch(s,{type:'occupy',id,number:row.number,seconds:1,source:'LS'});const c=o.ok?C.dispatch(s,{type:'clear',id,source:'LS'}):o;
     s.logs.unshift({time:s.clock,source:'LS',action:'pass',result:c.ok?'완료':'보류',message:row.number+' 반대선 통과 · '+id+(c.ok?' 진로 해정':' · '+c.message)});}}
  }
 let seq=0,paused=false,speed=1,replay=false,revision=0,cache=null,tableCache=null,tableDirty=true;let ftsLibrarySource=null,ftsRunSource=null,ftsLibraryCache=null,ftsRunCache=null;const published=new Map();const events=[];
 const emit=(kind,data)=>{events.push({seq:++seq,kind,...data});if(events.length>1000)events.shift();};
 const root={SimCore:{...Core,forStation:session.core},SimNetwork:Network,SimTimetable:Timetable,SimTrainWindows:Windows,SimTrackNetwork:require('./track-network'),SimLine:require('./line'),SimAuto:require('./autocontrol'),SimScenarios:require('./scenarios'),SimEmergency:require('./emergency'),SimScheduleScenarios:require('./schedule-scenarios'),SimScenarioMotion:require('./scenario-motion')};
 root.SimLine.journeys.clear();root.SimLine.state.enforce=true;root.SimLine.state.single.clear();
 // 열차번호 중복 알람: 한 열번창에 이미 열차가 있는데 다른 열차가 새로 들어와 겹칠 때만 낸다(충돌·구원연결).
 // 열번 고유 ID로 본다 — 번호를 고치거나(K0450→G0450) 겹친 열차 중 하나가 빠지는 것은 새 중복이 아니다.
 const windowUids=new Map();
 function checkDuplicates(station){for(const [slot,rows]of Object.entries(ls.stations[station]?.windows||{})){const key=station+'|'+slot,prev=windowUids.get(key)||new Set(),now=new Set(rows.map(r=>r.uid));windowUids.set(key,now);if(rows.length<2||![...now].some(u=>!prev.has(u)))continue;const info=Network.catalog[station];emit('alarm',{text:info.name+'역 '+rows.map(r=>r.number).join(' + ')+' 열차번호 중복',state:'',level:'E',station:info.name});}}
 root.SimMMI={replaying:()=>replay,checkDuplicates,stationInfo:id=>Network.catalog[id],markAuto:key=>emit('markAuto',{key}),log:(channel,text,_date,level='I')=>emit('log',{channel,text,level})};
 root.SimMMI.raiseAlarm=(text,state,level,station)=>emit('alarm',{text,state,level,station});
 root.SimEquipment=require('./equipment-controller.cjs').create(root);
 root.SimLSUI={getModel:()=>ls,dispatch:a=>root.SimScenarioUI?.intercept(a)??ops.dispatch(ls,a),dispatchDirect:a=>ops.dispatch(ls,a),validate:a=>ops.dispatch(structuredClone(ls),a)};
 root.SimDiagram={getModel:()=>model};
 const host={context:()=>({stationStates:states}),assessment:()=>assessment.snapshot(now())};
 root.SimDrill=require('./conflict-drill.cjs').create(root);
 root.SimScenarioUI=require('./scenario-controller.cjs').create(root,host);
 root.SimAutoUI=require('./auto-controller.cjs').create(root,host);
 host.moved=m=>fts.event({type:'trainRun',...m,ok:true,source:'motion'});
 const F=require('./fts'),FTS=require('./fts-controller.cjs'),scripts=[...root.SimScenarios.list,...root.SimEmergency.list,...root.SimScheduleScenarios.list].map(s=>s.id);
 const fts=FTS.create({scripts,defaults:()=>F.seed({scripts,limits:Object.fromEntries(scripts.map(id=>[id,require('./assessment').limitsFor(id)[0]]).filter(([,v])=>v))}),context:()=>({states,ls,model,now:now()}),pattern:Timetable.pattern,
  apply:a=>{const r=execute({...a,fts:true});if(['timetable','scenario:start'].includes(a.type))tableDirty=true;return r;},
  alarm:text=>emit('alarm',{text,state:'교육 현상',level:'W',station:''}),
  clearAlarms:()=>emit('alarmClear',{}),
  pause:value=>{paused=value;},auto:on=>root.SimAutoUI.set(on),startAssessment:()=>assessment.start({subject:'integrated'},now()),beginTask:o=>assessment.begin(o,now()),endTask:(key,status)=>{if(key)assessment.finishTask(now(),status,key);},finishAssessment:()=>assessment.finish(now()),
  stopScript:()=>root.SimScenarioUI.stop(),
  resetStation:st=>{const c=root.SimCore.forStation(st),clock=states[st].clock;for(const k of Object.keys(states[st]))delete states[st][k];Object.assign(states[st],c.initial(),{clock});},
  // 새 문제는 깨끗한 LS에서: 모든 역의 진로·모드·점유와 열차번호, 운행 중이던 시나리오 열차를 지운다
  resetAll:()=>{root.SimScenarioUI.stop();const a=root.SimAutoUI.checkpoint();root.SimAutoUI.restore({...a,transit:[]});
   for(const st of Object.keys(states)){const c=root.SimCore.forStation(st),clock=states[st].clock;for(const k of Object.keys(states[st]))delete states[st][k];Object.assign(states[st],c.initial(),{clock});ls.stations[st]={windows:{},boards:[]};}
   windowUids.clear();refresh();},
  startScript:(id,number,key,ui)=>{const sc=root.SimScenarios.list.find(s=>s.id===id);if(!number&&sc)number=root.SimScenarios.candidates(sc,model)[0];const r=root.SimScenarioUI.start(id,number,ui);if(r.ok){const run=root.SimScenarioUI.snapshot().run;run.assessmentKey=key;tableDirty=true;
   // 경합·스케줄생성 대본은 시작할 때 열차번호·구간·시각을 새로 정한다: 그 문제 문장을 FTS 문제 화면에 넘긴다
   if(run.sc?.group==='schedule'&&run.sc.problem)return {...r,problem:run.sc.problem};}return r;},
  scriptStatus:id=>{const r=root.SimScenarioUI.snapshot().run;return r?.sc.id===id?{done:r.done.filter(Boolean).length,total:r.done.length,complete:!!r.passed}:{done:0,total:0,complete:false};}
 });
 host.reservedNumbers=()=>fts.reservedNumbers();
 function refresh(){root.SimLine.refresh(states,ls);for(const station of Object.keys(states))checkDuplicates(station);}
 function updateAssessment(){const task=assessment.snapshot(now()).task;if(task&&Number.isInteger(task.practiceIndex)&&['running','expired'].includes(task.status)){const s=states['underground-seoul'],p=require('./practice').tasks[task.practiceIndex];if(p?.check(s.events,s))assessment.finishTask(now(),'completed',task.key);}
 const run=root.SimScenarioUI.snapshot().run;if(run?.passed&&run.assessmentKey)assessment.finishTask(now(),'completed',run.assessmentKey);for(const e of assessment.update(now()))emit('log',{channel:'event',text:e.text,level:'W'});}
 function step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid clock step');session.tick(seconds);root.SimScenarioUI.step();root.SimAutoUI.step();root.SimEquipment.tick(states[session.selected].clock);fts.step();updateAssessment();refresh();}
 function tick(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid clock step');
  const quantum=root.SimScenarioUI.snapshot().run||fts.snapshot().session&&!fts.snapshot().session.finished?1:root.SimAutoUI.enabled()?5:Math.max(seconds,1);
  if(seconds===0)step(0);else for(let left=seconds;left>0;){const dt=Math.min(quantum,left);step(dt);left-=dt;}
  if(root.SimAutoUI.enabled()&&root.SimAutoUI.reflecting())tableDirty=true;
 }
 function execute(action){
  const {type}=action;
  if(type==='poll')return {ok:true};
  if(type==='replay'){replay=!!action.on;return {ok:true};}
  if(replay&&!['clock','select','numbers:validate'].includes(type))return {ok:false,message:'로그재생 중에는 실시간 제어를 할 수 없습니다.'};
  if(type==='assessment'){if(fts.isActive())return {ok:false,message:'진행 중인 FTS 교육의 시간은 총괄제어에서 관리합니다.'};const op=action.op;if(op==='start'){assessment.start(action.options,now());paused=false;}else if(op==='begin'){if(action.options?.practiceIndex!==null&&action.options?.practiceIndex!==undefined&&(!Number.isInteger(action.options.practiceIndex)||!require('./practice').tasks[action.options.practiceIndex]))throw Error('Invalid practice task');assessment.begin(action.options,now());paused=false;}else if(op==='complete'||op==='cancel'){if(typeof action.key!=='string')throw Error('Assessment task key required');assessment.finishTask(now(),op==='complete'?'completed':'stopped',action.key);}else if(op==='finish')assessment.finish(now());else throw Error('Unknown assessment operation');return {ok:true};}
  if(type==='fts')return fts.command(action);
  if(type==='alarm:ack'){const texts=(Array.isArray(action.texts)?action.texts:[]).map(String).slice(0,50);fts.event({type:'alarmAck',text:texts.join(' | '),ok:true,source:'MMI'});return {ok:true};}
  if(type==='clock'){if(action.paused!==undefined)paused=!!action.paused;if(action.speed!==undefined){if(!Number.isFinite(action.speed)||action.speed<0||action.speed>120)throw new Error('Invalid clock speed');speed=action.speed;}return {ok:true};}
  if(type==='tick'){tick(action.seconds);return {ok:true};}
  if(type==='select'){session.select(action.station);return {ok:true};}
  if(type==='control'){
   refresh();const result=session.dispatch(action.station,action.action);fts.event({...action.action,station:action.station,ok:result.ok!==false});emit('control',{station:action.station,action:action.action,result});root.SimScenarioUI.event({...action.action,station:action.station,ok:result.ok!==false});refresh();return result;
  }
  if(type==='numbers'){const a=action.action,r=ops.dispatch(ls,a),s=states[a.station];if(r.ok){root.SimScenarioUI.manualNumberAction(a);passedShuntRoutes(a);}if(s){s.logs.unshift({time:s.clock,source:'LS',action:a.op,result:r.ok?'완료':'보류',message:r.message});if(r.ok)s.events.push({type:'lsOperation',operation:a,time:s.clock,source:'LS'});}root.SimScenarioUI.event({type:'lsOperation',operation:a,station:a.station,ok:r.ok});fts.event({type:'lsOperation',operation:a,station:a.station,ok:r.ok,source:action.fts?'FTS':a.source==='MMI'?'MMI':'LS'});refresh();return r;}
  if(type==='numbers:validate')return root.SimLSUI.validate(action.action);
  if(type==='numbers:reset'){ls.stations[action.station]={windows:{},boards:[]};refresh();return {ok:true};}
  if(type==='station:reset'){const clock=states[action.station].clock;Object.assign(states[action.station],session.core(action.station).initial(),{clock});return {ok:true};}
  // [CA028_01] 온라인열차스케줄ID관리: 스케줄 ID 목록(FTS 열차 스케줄)에서 골라 오늘/내일에 설정하거나 날짜에 예약한다.
  // 「오프라인ID 실시간변경」은 오늘 설정이면 그 스케줄을 지금 운행 중인 열차스케줄로 바로 올린다 (원본: 이후 온라인 열차스케줄관리에서 확인)
  if(type==='scheduleId'){
   const list=scheduleIdList(),sch=list.find(s=>s.id===String(action.id||''));
   if(action.op==='realtime'){if(!sch)return {ok:false,message:'열차스케줄 ID를 목록에서 선택하세요.'};const day=action.day==='tomorrow'?'tomorrow':'today';
    if(day==='today'){const r=command({type:'timetable',method:'import',args:[F.scheduleTable({timetable:sch.timetable,relative:sch.relative},now(),model.serviceDate)]});if(r?.ok===false)return r;}
    scheduleIds[day]={id:sch.id,name:sch.name};revision++;cache=null;emit('log',{channel:'event',text:`오프라인ID 실시간변경 · ${day==='today'?'오늘':'내일'} [${sch.id}] ${sch.name}`,level:'I'});return {ok:true,id:sch.id,name:sch.name,trains:day==='today'?model.trains.length:null};}
   if(action.op==='reserve'){if(!sch)return {ok:false,message:'예약할 열차스케줄 ID를 목록에서 선택하세요.'};const days=(Array.isArray(action.days)?action.days:[]).map(String).filter(d=>/^\d{8}$/.test(d)).slice(0,400);if(!days.length)return {ok:false,message:'스케줄을 적용할 운행일을 달력에서 선택하세요.'};for(const d of days)scheduleIds.reserved[d]={id:sch.id,name:sch.name};revision++;cache=null;return {ok:true,days};}
   return {ok:false,message:'지원하지 않는 스케줄 ID 조작'};
  }
  if(type==='timetable'){
   const allowed=['delay','cancel','setCancelled','create','update','remove','copy','import','undo','redo'];if(!allowed.includes(action.method))throw new Error('Unknown timetable operation');
   const r=Timetable[action.method](model,...action.args);const id=typeof action.args[0]==='string'?action.args[0]:action.args[0]?.id;fts.event({type:'schedule',id,method:action.method,ok:r.ok!==false,source:action.fts?'FTS':'MMI'});root.SimScenarioUI.step();return r;
  }
  if(type==='line'){if(action.enforce!==undefined)root.SimLine.state.enforce=!!action.enforce;if(action.key!==undefined){if(!root.SimLine.line.sections.some(sec=>sec.west+'>'+sec.east+':'+sec.trunk[0]===action.key))throw new Error('Invalid single-line section');if(action.on)root.SimLine.state.single.add(action.key);else root.SimLine.state.single.delete(action.key);}refresh();return {ok:true};}
  if(type==='equipment'){if(action.reset)root.SimEquipment.reset();else{if(!states[action.station])throw new Error('Unknown station');root.SimEquipment.set(action.station,action.name,action.on);}return {ok:true};}
  if(type==='auto'){if(action.enabled!==undefined)root.SimAutoUI.set(action.enabled);if(action.reflect!==undefined)root.SimAutoUI.reflect(action.reflect);return {ok:true};}
  if(type==='scenario:start'){if(fts.ownsScript())return {ok:false,message:'FTS 교육 대본이 진행 중입니다. 총괄제어에서 문제를 종료하거나 교육을 종료하세요.'};if(action.limitSeconds!==undefined&&action.limitSeconds!==null&&(!Number.isFinite(action.limitSeconds)||action.limitSeconds<1||action.limitSeconds>86400))throw Error('Invalid scenario time');const r=root.SimScenarioUI.start(action.id,action.train,action.ui);if(r.station)session.select(r.station);if(r.ok){const run=root.SimScenarioUI.snapshot().run;if(!fts.isActive())assessment.beginScenario(run.sc,run,now(),action.limitSeconds);paused=false;}return r;}
  if(type==='scenario:stop'){if(fts.ownsScript())return {ok:false,message:'FTS 교육 대본은 총괄제어의 문제종료·교육종료로 중지하세요.'};const key=root.SimScenarioUI.snapshot().run?.assessmentKey;if(key)assessment.finishTask(now(),'stopped',key);root.SimScenarioUI.stop();return {ok:true};}
  if(type==='scenario:say'){root.SimScenarioUI.say(action.index,action.checked);return {ok:true};}
  // 화면에서만 일어나는 기능(L/S 재실행 · 오버뷰 · 그래프 노트 · 열차추적)을 실행했다는 기록 — FTS 채점용. 엔진 상태는 바꾸지 않는다
  if(type==='practice'){if(!['lsRestart','overview','note','trace'].includes(action.name))throw Error('Unknown practice event');fts.event({type:action.name,station:typeof action.station==='string'?action.station:undefined,id:typeof action.id==='string'?action.id.slice(0,40):undefined,ok:true,source:action.source==='MMI'?'MMI':'LS'});return {ok:true};}
  if(type==='scenario:ui'){root.SimScenarioUI.ui(action.ui);return {ok:true};}
  if(type==='scenario:move')return action.auto?root.SimScenarioUI.run(action.action):root.SimScenarioUI.request(action.action);
  if(type==='drill:create'){const r=root.SimDrill.createProblem(action.options);if(r.ok&&action.options?.select!==false&&!fts.isActive()){assessment.begin({key:'drill:'+seq+':'+now(),title:'열차운행계획 · 경합 해소',subject:'plan'},now());paused=false;}return r;}
  if(type==='drill:grade'){const r=root.SimDrill.grade(),task=assessment.snapshot(now()).task;if(r.message?.startsWith('합격:')&&task?.key.startsWith('drill:'))assessment.finishTask(now(),'completed',task.key);return r;}
  if(type==='drill:reset'){const task=assessment.snapshot(now()).task;if(task?.key.startsWith('drill:'))assessment.finishTask(now(),'stopped',task.key);root.SimDrill.reset();return {ok:true};}
  throw new Error('Unknown engine command: '+type);
 }
 function command(action){const result=execute(action);if(action.type!=='poll'&&(action.type!=='fts'||['start','manual','next','reload','ui'].includes(action.op)))fts.step();updateAssessment();if(!['poll','numbers:validate'].includes(action.type)){revision++;cache=null;if(['timetable','scenario:start','drill:create','drill:reset','auto','fts'].includes(action.type))tableDirty=true;}return result;}
  // 스케줄 ID 목록 = FTS 열차 스케줄(문제별 교육 시간표 + 교수가 FTS 스케줄관리에서 만든 것). 앱은 빈 시간표로 시작한다.
  function scheduleIdList(){return (fts.library().schedules||[]).map(s=>({id:s.id,name:s.name,relative:!!s.relative,timetable:s.timetable}));}
 function current(){
  if(cache)return cache;

  const positions=Object.fromEntries(model.trains.map(t=>[t.id,root.SimAutoUI.position(t,states[session.selected].clock)]));
  // 시나리오 열차(시간표 밖 예약 번호)의 실제 위치도 엔진이 낸다 — 화면은 계산하지 않는다
  for(const id of root.SimScenarioUI.reservedNumbers?.()||[])if(!(id in positions))positions[id]=root.SimScenarioUI.position({id});
  if(ftsLibrarySource!==fts.library()){ftsLibrarySource=fts.library();ftsLibraryCache=structuredClone(ftsLibrarySource);}if(ftsRunSource!==fts.runLibrary()){ftsRunSource=fts.runLibrary();ftsRunCache=structuredClone(ftsRunSource);}
  const value={fts:fts.snapshot(),editHistory:Timetable.history(model),seq,pid:process.pid,selected:session.selected,states,ls,clock:{paused,speed,replay},assessment:assessment.snapshot(now()),line:{enforce:root.SimLine.state.enforce,single:[...root.SimLine.state.single]},equipment:{faults:root.SimEquipment.faultList(),sent:root.SimEquipment.sentTimes()},auto:{enabled:root.SimAutoUI.enabled(),reflect:root.SimAutoUI.reflecting(),transits:root.SimAutoUI.transits(),troubles:root.SimAutoUI.troubles(),actuals:root.SimAutoUI.actuals(),positions},scenario:root.SimScenarioUI.snapshot(),drill:root.SimDrill.snapshot(),journeys:[...root.SimLine.journeys],scheduleIds:{...scheduleIds,list:scheduleIdList().map(s=>({id:s.id,name:s.name,trains:s.timetable?.trains?.length||0}))},events};
  if(tableDirty||!tableCache){tableCache=JSON.parse(JSON.stringify(model));tableDirty=false;}
  cache=JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v));cache.timetable=tableCache;cache.ftsLibrary=ftsLibraryCache;cache.ftsRunLibrary=ftsRunCache;
  for(const [key,v]of Object.entries(cache)){if(key==='events')continue;const previous=published.get(key);if(previous?.value===v)continue;const hash=JSON.stringify(v);if(previous?.hash!==hash)published.set(key,{at:revision,hash,value:v});}
  return cache;
 }
 function snapshot(since=0){const copy=structuredClone(current());copy.events=events.filter(e=>e.seq>since).map(e=>structuredClone(e));return copy;}
 function transport(version=-1,since=0){const data=current(),delta=Number.isInteger(version)&&version>=0&&version<=revision,out={delta,version:revision,seq,events:events.filter(e=>e.seq>since)};for(const [key,value]of Object.entries(data))if(key!=='events'&&(!delta||published.get(key)?.at>version))out[key]=value;return out;}
 function checkpoint(){return structuredClone({format:'ORPHEIA-SESSION',schema:1,fts:fts.checkpoint(),selected:session.selected,states,ls,timetable:model,clock:{paused,speed},assessment:assessment.checkpoint(),line:{enforce:root.SimLine.state.enforce,single:[...root.SimLine.state.single],journeys:[...root.SimLine.journeys]},equipment:root.SimEquipment.checkpoint(),auto:root.SimAutoUI.checkpoint(),scenario:root.SimScenarioUI.checkpoint(),drill:root.SimDrill.snapshot(),scheduleIds,seq,events});}
 function restore(saved){const before=checkpoint();try{restoreInto(saved);Timetable.resetHistory(model);}catch(error){try{restoreInto(before);}catch{}throw error;}}
 function restoreInto(saved){
  if(saved?.format!=='ORPHEIA-SESSION'||saved.schema!==1||!states[saved.selected]||!Array.isArray(saved.timetable?.trains)||saved.timetable.trains.some(t=>!Timetable.valid(t))||new Set(saved.timetable.trains.map(t=>t.id)).size!==saved.timetable.trains.length)throw new Error('Invalid saved session');
  for(const id of Object.keys(states)){const st=saved.states?.[id],numbers=saved.ls?.stations?.[id];if(!st||!numbers||!Number.isFinite(st.clock)||!['AUTO','CCM','LOCAL'].includes(st.mode)||Object.keys(st.routes||{}).some(key=>!session.core(id).routes[key]))throw new Error('Invalid saved station '+id);for(const [slot,rows]of Object.entries(numbers.windows))if(!Windows.data[id].some(w=>w.slot===slot)||!Array.isArray(rows))throw new Error('Invalid saved number window');}
  if(!Number.isFinite(saved.clock?.speed)||saved.clock.speed<0||saved.clock.speed>120||!saved.auto?.engine||!saved.scenario?.motion||!Array.isArray(saved.events))throw new Error('Invalid saved controller');
  if(saved.fts)FTS.validateCheckpoint(saved.fts,scripts);
  const checkAssessment=require('./assessment').create();checkAssessment.restore(saved.assessment);
  const data=structuredClone(saved);for(const id of Object.keys(states)){for(const k of Object.keys(states[id]))delete states[id][k];Object.assign(states[id],data.states[id]);}
  Object.assign(ls,data.ls);Object.assign(model,data.timetable);session.select(data.selected);paused=true;speed=data.clock.speed;replay=false;
  root.SimLine.state.enforce=data.line.enforce;root.SimLine.state.single.clear();for(const key of data.line.single)root.SimLine.state.single.add(key);root.SimLine.journeys.clear();for(const [key,value]of data.line.journeys)root.SimLine.journeys.set(key,value);
  fts.restore(data.fts);
  assessment.restore(data.assessment);root.SimEquipment.restore(data.equipment);root.SimAutoUI.restore(data.auto);root.SimDrill.restore(data.drill);root.SimScenarioUI.restore(data.scenario);scheduleIds=data.scheduleIds&&typeof data.scheduleIds==='object'?{today:data.scheduleIds.today||null,tomorrow:data.scheduleIds.tomorrow||null,reserved:{...(data.scheduleIds.reserved||{})}}:{today:null,tomorrow:null,reserved:{}};seq=data.seq;events.length=0;events.push(...data.events);emit('log',{channel:'event',text:'저장된 실습 세션을 복원했습니다. 일시정지 상태에서 시작합니다.',level:'I'});refresh();revision++;cache=null;tableDirty=true;published.clear();
 }
 // 실시간 맞춤: 타이머가 늦게 와도(창이 뒤에 있거나 macOS App Nap) 실제로 흐른 시간만큼 진행한다. 한 번에 최대 30초까지 따라잡는다.
 let wall=null,carry=0;
 function pulse(at=Date.now()){if(paused||replay){wall=at;carry=0;return;}const real=wall===null?1:Math.min(30,Math.max(1,Math.max(0,(at-wall)/1000)+carry));wall=at;const whole=Math.floor(real);carry=real-whole;tick(speed*whole);revision++;cache=null;}
 return {command,snapshot,transport,checkpoint,restore,pulse};
}
module.exports={create};

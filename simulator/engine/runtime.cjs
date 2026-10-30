'use strict';
const Session=require('./session'),Core=require('./core'),Network=require('./network'),Timetable=require('./timetable'),Windows=require('./train-windows'),Operations=require('./ls-operations');
function create(){
 const session=Session.create(),states=session.states,model=Timetable.initial();
 const assessment=require('./assessment').create(),now=()=>states[session.selected].clock;
 const ops=Operations.create(Object.fromEntries(Object.entries(Windows.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=ops.initial();
 let seq=0,paused=false,speed=1,replay=false,revision=0,cache=null,tableCache=null,tableDirty=true;const published=new Map();const events=[];
 const emit=(kind,data)=>{events.push({seq:++seq,kind,...data});if(events.length>1000)events.shift();};
 const root={SimCore:{...Core,forStation:session.core},SimNetwork:Network,SimTimetable:Timetable,SimTrainWindows:Windows,SimTrackNetwork:require('./track-network'),SimLine:require('./line'),SimAuto:require('./autocontrol'),SimScenarios:require('./scenarios'),SimEmergency:require('./emergency'),SimScheduleScenarios:require('./schedule-scenarios'),SimScenarioMotion:require('./scenario-motion')};
 root.SimLine.journeys.clear();root.SimLine.state.enforce=true;root.SimLine.state.single.clear();
 const dupSeen=new Set();
 function checkDuplicates(station){for(const [slot,rows]of Object.entries(ls.stations[station]?.windows||{})){const key=station+'|'+slot+'|',sig=key+rows.map(r=>r.number).join('+');for(const old of dupSeen)if(old.startsWith(key)&&old!==sig)dupSeen.delete(old);if(rows.length<2||dupSeen.has(sig))continue;dupSeen.add(sig);const info=Network.catalog[station];emit('alarm',{text:info.name+'역 '+rows.map(r=>r.number).join(' + ')+' 열차번호 중복',state:'',level:'E',station:info.name});}}
 root.SimMMI={replaying:()=>replay,checkDuplicates,stationInfo:id=>Network.catalog[id],markAuto:key=>emit('markAuto',{key}),log:(channel,text,_date,level='I')=>emit('log',{channel,text,level})};
 root.SimMMI.raiseAlarm=(text,state,level,station)=>emit('alarm',{text,state,level,station});
 root.SimEquipment=require('./equipment-controller.cjs').create(root);
 root.SimLSUI={getModel:()=>ls,dispatch:a=>root.SimScenarioUI?.intercept(a)??ops.dispatch(ls,a),dispatchDirect:a=>ops.dispatch(ls,a),validate:a=>ops.dispatch(structuredClone(ls),a)};
 root.SimDiagram={getModel:()=>model};
 const host={context:()=>({stationStates:states}),assessment:()=>assessment.snapshot(now())};
 root.SimDrill=require('./conflict-drill.cjs').create(root);
 root.SimScenarioUI=require('./scenario-controller.cjs').create(root,host);
 root.SimAutoUI=require('./auto-controller.cjs').create(root,host);
 function refresh(){root.SimLine.refresh(states,ls);for(const station of Object.keys(states))checkDuplicates(station);}
 function updateAssessment(){const task=assessment.snapshot(now()).task;if(task&&Number.isInteger(task.practiceIndex)&&['running','expired'].includes(task.status)){const s=states['underground-seoul'],p=require('./practice').tasks[task.practiceIndex];if(p?.check(s.events,s))assessment.finishTask(now(),'completed',task.key);}
 const run=root.SimScenarioUI.snapshot().run;if(run?.passed&&run.assessmentKey)assessment.finishTask(now(),'completed',run.assessmentKey);for(const e of assessment.update(now()))emit('log',{channel:'event',text:e.text,level:'W'});}
 function step(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid clock step');session.tick(seconds);root.SimScenarioUI.step();root.SimAutoUI.step();root.SimEquipment.tick(states[session.selected].clock);updateAssessment();refresh();}
 function tick(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid clock step');
  const quantum=root.SimScenarioUI.snapshot().run?1:root.SimAutoUI.enabled()?5:Math.max(seconds,1);
  if(seconds===0)step(0);else for(let left=seconds;left>0;){const dt=Math.min(quantum,left);step(dt);left-=dt;}
  if(root.SimAutoUI.enabled()&&root.SimAutoUI.reflecting())tableDirty=true;
 }
 function execute(action){
  const {type}=action;
  if(type==='poll')return {ok:true};
  if(type==='replay'){replay=!!action.on;return {ok:true};}
  if(replay&&!['clock','select','numbers:validate'].includes(type))return {ok:false,message:'로그재생 중에는 실시간 제어를 할 수 없습니다.'};
  if(type==='assessment'){const op=action.op;if(op==='start'){assessment.start(action.options,now());paused=false;}else if(op==='begin'){if(action.options?.practiceIndex!==null&&action.options?.practiceIndex!==undefined&&(!Number.isInteger(action.options.practiceIndex)||!require('./practice').tasks[action.options.practiceIndex]))throw Error('Invalid practice task');assessment.begin(action.options,now());paused=false;}else if(op==='complete'||op==='cancel'){if(typeof action.key!=='string')throw Error('Assessment task key required');assessment.finishTask(now(),op==='complete'?'completed':'stopped',action.key);}else if(op==='finish')assessment.finish(now());else throw Error('Unknown assessment operation');return {ok:true};}
  if(type==='clock'){if(action.paused!==undefined)paused=!!action.paused;if(action.speed!==undefined){if(!Number.isFinite(action.speed)||action.speed<0||action.speed>120)throw new Error('Invalid clock speed');speed=action.speed;}return {ok:true};}
  if(type==='tick'){tick(action.seconds);return {ok:true};}
  if(type==='select'){session.select(action.station);return {ok:true};}
  if(type==='control'){
   refresh();const result=session.dispatch(action.station,action.action);emit('control',{station:action.station,action:action.action,result});root.SimScenarioUI.event({...action.action,station:action.station,ok:result.ok!==false});refresh();return result;
  }
  if(type==='numbers'){const a=action.action,r=ops.dispatch(ls,a),s=states[a.station];if(r.ok)root.SimScenarioUI.manualNumberAction(a);if(s){s.logs.unshift({time:s.clock,source:'LS',action:a.op,result:r.ok?'완료':'보류',message:r.message});if(r.ok)s.events.push({type:'lsOperation',operation:a,time:s.clock,source:'LS'});}root.SimScenarioUI.event({type:'lsOperation',operation:a,station:a.station,ok:r.ok});refresh();return r;}
  if(type==='numbers:validate')return root.SimLSUI.validate(action.action);
  if(type==='numbers:reset'){ls.stations[action.station]={windows:{},boards:[]};refresh();return {ok:true};}
  if(type==='station:reset'){const clock=states[action.station].clock;Object.assign(states[action.station],session.core(action.station).initial(),{clock});return {ok:true};}
  if(type==='timetable'){
   const allowed=['delay','cancel','setCancelled','create','update','remove','copy','import','undo','redo'];if(!allowed.includes(action.method))throw new Error('Unknown timetable operation');
   const r=Timetable[action.method](model,...action.args);root.SimScenarioUI.step();return r;
  }
  if(type==='line'){if(action.enforce!==undefined)root.SimLine.state.enforce=!!action.enforce;if(action.key!==undefined){if(!root.SimLine.line.sections.some(sec=>sec.west+'>'+sec.east+':'+sec.trunk[0]===action.key))throw new Error('Invalid single-line section');if(action.on)root.SimLine.state.single.add(action.key);else root.SimLine.state.single.delete(action.key);}refresh();return {ok:true};}
  if(type==='equipment'){if(action.reset)root.SimEquipment.reset();else{if(!states[action.station])throw new Error('Unknown station');root.SimEquipment.set(action.station,action.name,action.on);}return {ok:true};}
  if(type==='auto'){if(action.enabled!==undefined)root.SimAutoUI.set(action.enabled);if(action.reflect!==undefined)root.SimAutoUI.reflect(action.reflect);return {ok:true};}
  if(type==='scenario:start'){if(action.limitSeconds!==undefined&&action.limitSeconds!==null&&(!Number.isFinite(action.limitSeconds)||action.limitSeconds<1||action.limitSeconds>86400))throw Error('Invalid scenario time');const r=root.SimScenarioUI.start(action.id,action.train,action.ui);if(r.station)session.select(r.station);if(r.ok){const run=root.SimScenarioUI.snapshot().run;assessment.beginScenario(run.sc,run,now(),action.limitSeconds);paused=false;}return r;}
  if(type==='scenario:stop'){const key=root.SimScenarioUI.snapshot().run?.assessmentKey;if(key)assessment.finishTask(now(),'stopped',key);root.SimScenarioUI.stop();return {ok:true};}
  if(type==='scenario:say'){root.SimScenarioUI.say(action.index,action.checked);return {ok:true};}
  if(type==='scenario:ui'){root.SimScenarioUI.ui(action.ui);return {ok:true};}
  if(type==='scenario:move')return root.SimScenarioUI.request(action.action);
  if(type==='drill:create'){const r=root.SimDrill.createProblem(action.options);if(r.ok&&action.options?.select!==false){assessment.begin({key:'drill:'+seq+':'+now(),title:'열차운행계획 · 경합 해소',subject:'plan'},now());paused=false;}return r;}
  if(type==='drill:grade'){const r=root.SimDrill.grade(),task=assessment.snapshot(now()).task;if(r.message?.startsWith('합격:')&&task?.key.startsWith('drill:'))assessment.finishTask(now(),'completed',task.key);return r;}
  if(type==='drill:reset'){const task=assessment.snapshot(now()).task;if(task?.key.startsWith('drill:'))assessment.finishTask(now(),'stopped',task.key);root.SimDrill.reset();return {ok:true};}
  throw new Error('Unknown engine command: '+type);
 }
 function command(action){const result=execute(action);updateAssessment();if(!['poll','numbers:validate'].includes(action.type)){revision++;cache=null;if(['timetable','scenario:start','drill:create','drill:reset','auto'].includes(action.type))tableDirty=true;}return result;}
 function current(){
  if(cache)return cache;

  const positions=Object.fromEntries(model.trains.map(t=>[t.id,root.SimAutoUI.position(t,states[session.selected].clock)]));
  const value={editHistory:Timetable.history(model),seq,pid:process.pid,selected:session.selected,states,ls,clock:{paused,speed,replay},assessment:assessment.snapshot(now()),line:{enforce:root.SimLine.state.enforce,single:[...root.SimLine.state.single]},equipment:{faults:root.SimEquipment.faultList(),sent:root.SimEquipment.sentTimes()},auto:{enabled:root.SimAutoUI.enabled(),reflect:root.SimAutoUI.reflecting(),transits:root.SimAutoUI.transits(),troubles:root.SimAutoUI.troubles(),actuals:root.SimAutoUI.actuals(),positions},scenario:root.SimScenarioUI.snapshot(),drill:root.SimDrill.snapshot(),journeys:[...root.SimLine.journeys],events};
  if(tableDirty||!tableCache){tableCache=JSON.parse(JSON.stringify(model));tableDirty=false;}
  cache=JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v));cache.timetable=tableCache;
  for(const [key,v]of Object.entries(cache)){if(key==='events')continue;const previous=published.get(key);if(previous?.value===v)continue;const hash=JSON.stringify(v);if(previous?.hash!==hash)published.set(key,{at:revision,hash,value:v});}
  return cache;
 }
 function snapshot(since=0){const copy=structuredClone(current());copy.events=events.filter(e=>e.seq>since).map(e=>structuredClone(e));return copy;}
 function transport(version=-1,since=0){const data=current(),delta=Number.isInteger(version)&&version>=0&&version<=revision,out={delta,version:revision,seq,events:events.filter(e=>e.seq>since)};for(const [key,value]of Object.entries(data))if(key!=='events'&&(!delta||published.get(key)?.at>version))out[key]=value;return out;}
 function checkpoint(){return structuredClone({format:'ORPHEIA-SESSION',schema:1,selected:session.selected,states,ls,timetable:model,clock:{paused,speed},assessment:assessment.checkpoint(),line:{enforce:root.SimLine.state.enforce,single:[...root.SimLine.state.single],journeys:[...root.SimLine.journeys]},equipment:root.SimEquipment.checkpoint(),auto:root.SimAutoUI.checkpoint(),scenario:root.SimScenarioUI.checkpoint(),drill:root.SimDrill.snapshot(),seq,events});}
 function restore(saved){
  if(saved?.format!=='ORPHEIA-SESSION'||saved.schema!==1||!states[saved.selected]||!Array.isArray(saved.timetable?.trains)||saved.timetable.trains.some(t=>!Timetable.valid(t))||new Set(saved.timetable.trains.map(t=>t.id)).size!==saved.timetable.trains.length)throw new Error('Invalid saved session');
  for(const id of Object.keys(states)){const st=saved.states?.[id],numbers=saved.ls?.stations?.[id];if(!st||!numbers||!Number.isFinite(st.clock)||!['AUTO','CCM','LOCAL'].includes(st.mode)||Object.keys(st.routes||{}).some(key=>!session.core(id).routes[key]))throw new Error('Invalid saved station '+id);for(const [slot,rows]of Object.entries(numbers.windows))if(!Windows.data[id].some(w=>w.slot===slot)||!Array.isArray(rows))throw new Error('Invalid saved number window');}
  if(!Number.isFinite(saved.clock?.speed)||saved.clock.speed<0||saved.clock.speed>120||!saved.auto?.engine||!saved.scenario?.motion||!Array.isArray(saved.events))throw new Error('Invalid saved controller');
  const checkAssessment=require('./assessment').create();checkAssessment.restore(saved.assessment);
  const data=structuredClone(saved);for(const id of Object.keys(states)){for(const k of Object.keys(states[id]))delete states[id][k];Object.assign(states[id],data.states[id]);}
  Object.assign(ls,data.ls);Object.assign(model,data.timetable);session.select(data.selected);paused=true;speed=data.clock.speed;replay=false;
  root.SimLine.state.enforce=data.line.enforce;root.SimLine.state.single.clear();for(const key of data.line.single)root.SimLine.state.single.add(key);root.SimLine.journeys.clear();for(const [key,value]of data.line.journeys)root.SimLine.journeys.set(key,value);
  assessment.restore(data.assessment);root.SimEquipment.restore(data.equipment);root.SimAutoUI.restore(data.auto);root.SimDrill.restore(data.drill);root.SimScenarioUI.restore(data.scenario);seq=data.seq;events.length=0;events.push(...data.events);emit('log',{channel:'event',text:'저장된 실습 세션을 복원했습니다. 일시정지 상태에서 시작합니다.',level:'I'});refresh();revision++;cache=null;tableDirty=true;published.clear();
 }
 return {command,snapshot,transport,checkpoint,restore,pulse:()=>{if(!paused&&!replay){tick(speed);revision++;cache=null;}}};
}
module.exports={create};

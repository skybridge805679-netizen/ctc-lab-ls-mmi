'use strict';
const Session=require('./session'),Core=require('./core'),Network=require('./network'),Timetable=require('./timetable'),Windows=require('./train-windows'),Operations=require('./ls-operations');
function create(){
 const session=Session.create(),states=session.states,model=Timetable.initial();
 const ops=Operations.create(Object.fromEntries(Object.entries(Windows.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=ops.initial();
 let seq=0,paused=false,speed=1,replay=false;const events=[];
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
 const host={context:()=>({stationStates:states})};
 root.SimDrill=require('./conflict-drill.cjs').create(root);
 root.SimScenarioUI=require('./scenario-controller.cjs').create(root,host);
 root.SimAutoUI=require('./auto-controller.cjs').create(root,host);
 function refresh(){root.SimLine.refresh(states,ls);for(const station of Object.keys(states))checkDuplicates(station);}
 function tick(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw new Error('Invalid clock step');session.tick(seconds);root.SimScenarioUI.step();root.SimAutoUI.step();root.SimEquipment.tick(states[session.selected].clock);refresh();}
 function command(action){
  const {type}=action;
  if(type==='poll')return {ok:true};
  if(type==='replay'){replay=!!action.on;return {ok:true};}
  if(replay&&!['clock','select','numbers:validate'].includes(type))return {ok:false,message:'로그재생 중에는 실시간 제어를 할 수 없습니다.'};
  if(type==='clock'){if(action.paused!==undefined)paused=!!action.paused;if(action.speed!==undefined){if(!Number.isFinite(action.speed)||action.speed<0||action.speed>120)throw new Error('Invalid clock speed');speed=action.speed;}return {ok:true};}
  if(type==='tick'){tick(action.seconds);return {ok:true};}
  if(type==='select'){session.select(action.station);return {ok:true};}
  if(type==='control'){
   refresh();const result=session.dispatch(action.station,action.action);emit('control',{station:action.station,action:action.action,result});root.SimScenarioUI.event({...action.action,station:action.station,ok:result.ok!==false});refresh();return result;
  }
  if(type==='numbers'){const r=root.SimLSUI.dispatch(action.action),a=action.action,s=states[a.station];if(s){s.logs.unshift({time:s.clock,source:'LS',action:a.op,result:r.ok?'완료':'보류',message:r.message});if(r.ok)s.events.push({type:'lsOperation',operation:a,time:s.clock,source:'LS'});}root.SimScenarioUI.event({type:'lsOperation',operation:a,station:a.station,ok:r.ok});refresh();return r;}
  if(type==='numbers:validate')return root.SimLSUI.validate(action.action);
  if(type==='numbers:reset'){ls.stations[action.station]={windows:{},boards:[]};refresh();return {ok:true};}
  if(type==='station:reset'){const clock=states[action.station].clock;Object.assign(states[action.station],session.core(action.station).initial(),{clock});return {ok:true};}
  if(type==='timetable'){
   const allowed=['delay','cancel','setCancelled','create','update','remove','copy'];if(!allowed.includes(action.method))throw new Error('Unknown timetable operation');
   const r=Timetable[action.method](model,...action.args);root.SimScenarioUI.step();return r;
  }
  if(type==='line'){if(action.enforce!==undefined)root.SimLine.state.enforce=!!action.enforce;if(action.key!==undefined){if(!root.SimLine.line.sections.some(sec=>sec.west+'>'+sec.east+':'+sec.trunk[0]===action.key))throw new Error('Invalid single-line section');if(action.on)root.SimLine.state.single.add(action.key);else root.SimLine.state.single.delete(action.key);}refresh();return {ok:true};}
  if(type==='equipment'){if(action.reset)root.SimEquipment.reset();else{if(!states[action.station])throw new Error('Unknown station');root.SimEquipment.set(action.station,action.name,action.on);}return {ok:true};}
  if(type==='auto'){if(action.enabled!==undefined)root.SimAutoUI.set(action.enabled);if(action.reflect!==undefined)root.SimAutoUI.reflect(action.reflect);return {ok:true};}
  if(type==='scenario:start'){const r=root.SimScenarioUI.start(action.id,action.train,action.ui);if(r.station)session.select(r.station);return r;}
  if(type==='scenario:stop'){root.SimScenarioUI.stop();return {ok:true};}
  if(type==='scenario:say'){root.SimScenarioUI.say(action.index,action.checked);return {ok:true};}
  if(type==='scenario:ui'){root.SimScenarioUI.ui(action.ui);return {ok:true};}
  if(type==='scenario:move')return root.SimScenarioUI.request(action.action);
  if(type==='drill:create')return root.SimDrill.createProblem(action.options);
  if(type==='drill:grade')return root.SimDrill.grade();
  if(type==='drill:reset'){root.SimDrill.reset();return {ok:true};}
  throw new Error('Unknown engine command: '+type);
 }
 function snapshot(since=0){
  const positions=Object.fromEntries(model.trains.map(t=>[t.id,root.SimAutoUI.position(t,states[session.selected].clock)]));
  const value={seq,pid:process.pid,selected:session.selected,states,ls,timetable:model,clock:{paused,speed,replay},line:{enforce:root.SimLine.state.enforce,single:[...root.SimLine.state.single]},equipment:{faults:root.SimEquipment.faultList(),sent:root.SimEquipment.sentTimes()},auto:{enabled:root.SimAutoUI.enabled(),reflect:root.SimAutoUI.reflecting(),transits:root.SimAutoUI.transits(),troubles:root.SimAutoUI.troubles(),actuals:root.SimAutoUI.actuals(),positions},scenario:root.SimScenarioUI.snapshot(),drill:root.SimDrill.snapshot(),journeys:[...root.SimLine.journeys],events:events.filter(e=>e.seq>since)};
  return JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='function'?undefined:v instanceof Set?[...v]:v));
 }
 return {command,snapshot,pulse:()=>{if(!paused&&!replay)tick(speed);}};
}
module.exports={create};

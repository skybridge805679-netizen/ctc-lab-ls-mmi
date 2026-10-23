'use strict';
const Flow=require('./scenario-flow');
function create(root,host){
 const SC=()=>root.SimScenarios,EM=()=>root.SimEmergency,SS=()=>root.SimScheduleScenarios,mmi=()=>root.SimMMI;
 const isEm=sc=>sc?.group==='emergency',isSch=sc=>sc?.group==='schedule';
 const lsm=()=>root.SimLSUI.getModel();
 let run=null,lastUI={};
 const motion=root.SimScenarioMotion.create({states:()=>host.context().stationStates,model:lsm,validate:a=>root.SimLSUI.validate(a),commit:a=>{const result=root.SimLSUI.dispatchDirect(a);if(result.ok)mmi().log('event','시나리오 열차 이동 완료 · '+a.station+' '+a.slot+' → '+(a.targetSlot||'관제구간 밖'));return result;}});
function findRow(number){
 for(const [station,st] of Object.entries(lsm().stations))for(const [slot,rows] of Object.entries(st.windows))for(const r of rows)if(r.number===number)return {station,slot,uid:r.uid};
 return null;
}
function clearNumbers(numbers){for(const n of numbers){let f;while((f=findRow(n)))root.SimLSUI.dispatch({op:'delete',...f});}}
function placeCast(){
 const sc=run.sc;clearNumbers(isEm(sc)?EM().numbersOf(sc):run.cast.map(c=>c.id));
 for(const c of run.cast){const r=root.SimLSUI.dispatch({op:'insert',station:c.station||sc.station,slot:c.slot,number:c.id,direction:c.dir});if(!r.ok)mmi().log('event',`열차번호 표시 실패 · ${c.id} · ${r.message}`);}
}
function moveCast(key,slot){
 const c=run.cast.find(x=>x.key===key);if(!c)return;
 const f=findRow(c.id);if(!f)return;
 if(slot===null)motion.request({op:'delete',...f});
 else if(f.slot!==slot)motion.request({op:'move',station:f.station,slot:f.slot,uid:f.uid,targetStation:run.sc.station,targetSlot:slot});
}
// when a tagged step is newly done, queue its moves (each `after` sim-seconds after the previous one); the queue runs on the station clock
function fireBeats(){
 run.sc.steps.forEach((s,i)=>{
  if(!s.tag||!run.done[i]||run.fired.has(s.tag))return;
  run.fired.add(s.tag);let due=station().clock;
  for(const m of SC().movesFor(run.sc,s.tag)){due+=m.after;run.queue.push({due,key:m.key,slot:m.slot});run.queue.sort((a,b)=>a.due-b.due);}
 });
}
function runQueue(){
 let moved=false;const now=station().clock;
 while(run.queue.length&&run.queue[0].due<=now){const m=run.queue.shift();moveCast(m.key,m.slot);moved=true;}
 return moved;
}
const station=()=>host.context().stationStates[run.sc.station];
const ctx=()=>({state:station(),model:root.SimDiagram.getModel(),states:host.context().stationStates,ls:lsm(),ui:lastUI});
function evaluate(){
 if(!run||mmi().replaying())return;
 SC().advance(run,ctx());Flow.advance(run,station().clock);
 if(isSch(run.sc)){const k=run.sc.steps.findIndex((x,i)=>x.kind==='do'&&!run.done[i]);run.explain=k>=0&&run.sc.steps[k].explain?run.sc.steps[k].explain(ctx()):'';}
 if(isEm(run.sc)){EM().applyAutos(run.sc,run,a=>a.op==='move'||a.op==='delete'?motion.request(a):root.SimLSUI.dispatch(a),lsm);}
 else{fireBeats();runQueue();}
 if(motion.step())SC().advance(run,ctx());
 if(run.done.every(Boolean)&&!motion.busy()&&!run.queue.length&&!run.passed){run.passed=true;mmi().log('event','실기 시나리오 합격 · '+run.sc.title);}
}
function intercept(){return null;}
function manualNumberAction(a){if(['move','swap','delete'].includes(a.op)){motion.cancel(a.uid);if(a.targetUid)motion.cancel(a.targetUid);}}

function actualPosition(train){
 const f=findRow(train.id);if(!f)return null;
 const catalog=root.SimNetwork.catalog,j=motion?.list().find(j=>j.uid===f.uid&&!['done','cancelled'].includes(j.phase));
 const from=catalog[f.station];if(!from)return null;
 if(j?.phase==='handover'&&j.action.targetStation){const to=catalog[j.action.targetStation],now=host.context().stationStates[j.station].clock,fraction=Math.max(0,Math.min(1,(now-j.fromTime)/(j.until-j.fromTime)));
  return {station:f.station,nextStation:to.id,order:from.order+(to.order-from.order)*fraction,status:'관할 인계',actual:true};}
 return {station:f.station,order:from.order,status:j&&j.phase!=='waiting'?'진행':j?'진로 대기':'정차',actual:true};
}

function start(id,train='',ui={}){
 motion.reset();if(run)clearNumbers(isEm(run.sc)?EM().numbersOf(run.sc):run.cast.map(c=>c.id));lastUI=ui;
 let parameters=null;
 let sc=SC().list.concat(EM().list,SS().list).find(s=>s.id===id);if(!sc)return {ok:false,message:'시나리오를 확인하세요.'};
 const model=root.SimDiagram.getModel();
 if(isSch(sc)){
  if(id==='sch-conflict'){const d=root.SimDrill;if(model.trains.some(t=>t.id===d.ID))d.reset();const r=d.createProblem({select:false});if(!r.ok)return r;parameters={id:d.ID,leader:r.leader,nearest:r.nearest,baseline:r.baseline};sc=SS().conflictScenario(parameters);}
  else{parameters=SS().planCreate(model);sc=SS().createScenario(parameters);}
 }else if(isEm(sc))EM().seed(sc,host.context().stationStates);
 else{
  if(sc.steps.some(s=>s.kind==='do'&&/스케줄 수정/.test(s.text))&&!model.trains.some(t=>t.id===train&&t.calls.some(c=>c.station===sc.station)))return {ok:false,message:'스케줄 수정에 사용할 시간표 열차를 선택하세요.'};
  SC().seed(sc,host.context().stationStates[sc.station]);
 }
 run=SC().newRun(sc,train);run.parameters=parameters;run.fired=new Set();run.queue=[];run.explain='';
 run.cast=isSch(sc)?[]:isEm(sc)?EM().castFor(sc).map(c=>({key:c.number,id:c.number,dir:c.dir,slot:c.slot,station:c.station})):SC().pickCast(sc,model,train);
 if(!isSch(sc))placeCast();evaluate();return {ok:true,station:sc.station};
}
function checkpoint(){return {run:run?{...run,sc:null,scID:run.sc.id,fired:[...run.fired],autoApplied:[...(run.autoApplied||[])]}:null,motion:motion.checkpoint()};}
function restore(data){
 if(!data.run){run=null;motion.restore(data.motion);return;}
 const saved=data.run,id=saved.scID,sc=id==='sch-conflict'?SS().conflictScenario(saved.parameters):id==='sch-create'?SS().createScenario(saved.parameters):SC().list.concat(EM().list).find(s=>s.id===id);
 if(!sc)throw new Error('Unknown saved scenario');
 run={...saved,sc,fired:new Set(saved.fired),autoApplied:new Set(saved.autoApplied)};lastUI={};motion.restore(data.motion);
}
function snapshot(){return {run,jobs:motion.list(),reserved:!run||isSch(run.sc)?[]:isEm(run.sc)?EM().numbersOf(run.sc):run.cast.map(c=>c.id)};}
return {checkpoint,restore,reservedNumbers:()=>snapshot().reserved,start,intercept,manualNumberAction,position:actualPosition,snapshot,step:()=>{evaluate();},ui:value=>{lastUI=value;evaluate();},say(index,checked){if(run&&run.sc.steps[index]?.kind==='say'){run.done[index]=!!checked;evaluate();}},event(e){if(run){run.events.push(e);evaluate();}},stop(){motion.reset();run=null;},request:a=>motion.request(a,true)};
}
module.exports={create};

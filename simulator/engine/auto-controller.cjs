'use strict';
// DOM-free automatic running and circuit transit controller.
function create(root,host){
 const A=()=>root.SimAuto,mmi=()=>root.SimMMI,model=()=>root.SimLSUI.getModel(),name=id=>root.SimNetwork.catalog[id].name;
 let enabled=false,reflect=false;
 const engine=A().create({core:root.SimCore,stations:root.SimNetwork.stations,refresh:()=>root.SimLine.refresh(host.context().stationStates,model())});
 const label=()=>{},drawTroubles=()=>{},drawDelays=()=>{};
function removeEverywhere(number){
 for(const [station,st] of Object.entries(model().stations))for(const [slot,rows] of Object.entries(st.windows))for(const r of [...rows])if(r.number===number)root.SimLSUI.dispatch({op:'delete',station,slot,uid:r.uid});
}
const transit=new Map();      // 연동역 사이를 지나는 열차: {train, from, h(다음 역·진입 열번창), via(중간역), at}
function put(station,slot,train){removeEverywhere(train.id);root.SimLSUI.dispatch({op:'insert',station,slot,number:train.id,direction:train.direction});}
function moveTransit(tr){
 const L=root.SimLine,states=host.context().stationStates,now=states[tr.h.station]?.clock??0,t=root.SimDiagram.getModel().trains.find(x=>x.id===tr.train.id);
 const checkpoints=tr.via.flatMap(v=>{const c=t?.calls.find(c=>c.station===v.station&&!c.cancelled),code=root.SimTrackNetwork.codeOf(v.slot),i=tr.codes.indexOf(code);return c&&i>=0?[{arrival:c.arrival+tr.delay,departure:c.departure+tr.delay,index:i}]:[];});
 const call=t?.calls.find(c=>c.station===tr.h.station&&!c.cancelled);
 checkpoints.push({arrival:Math.max(tr.start+1,(call?.arrival??tr.start+120)-root.SimAuto.ENTER_LEAD+tr.delay),departure:Infinity,index:tr.codes.length-1});
 let before={time:tr.start,index:0},desired=0;
 for(const c of checkpoints){if(now<c.arrival){const f=Math.max(0,Math.min(1,(now-before.time)/Math.max(1,c.arrival-before.time)));desired=Math.floor(before.index+(c.index-before.index)*f);break;}desired=c.index;if(now<c.departure)break;before={time:c.departure,index:c.index};}
 const occupied=L.circuitOccupancy(model(),states);
 while(tr.index<desired){const next=tr.codes[tr.index+1];if(occupied[next]?.some(n=>n!==tr.train.id))break;tr.index++;}
 const code=tr.codes[tr.index];L.setJourney(tr.train.id,code);if(tr.at===code)return false;tr.at=code;
 const windows=Object.entries(root.SimTrainWindows.data).flatMap(([station,ws])=>ws.map(w=>({station,slot:w.slot,index:tr.codes.indexOf(root.SimTrackNetwork.codeOf(w.slot))}))).filter(w=>w.index>=0).sort((a,b)=>Math.abs(a.index-tr.index)-Math.abs(b.index-tr.index)||Number(b.index<=tr.index)-Number(a.index<=tr.index));
 const target=windows[0];if(target)put(target.station,target.slot,tr.train);
 if(tr.index>=Math.max(0,tr.codes.length-3)){const st=states[tr.h.station];if(st&&tr.h.signal&&!st.approach?.[tr.h.signal])root.SimCore.forStation(tr.h.station).dispatch(st,{type:'approach',signal:tr.h.signal,present:true,source:'AUTO'});}
 return true;
}

const numbers={
 ready(station,train){const tr=transit.get(train.id);return !tr||tr.h.station===station&&tr.index>=Math.max(0,tr.codes.length-3);},
 canEnter(station,train){const tr=transit.get(train.id);return !tr||tr.h.station===station&&tr.index===tr.codes.length-1;},
 place(station,slot,train){root.SimLine.setJourney(train.id,null);transit.delete(train.id);removeEverywhere(train.id);if(slot)root.SimLSUI.dispatch({op:'insert',station,slot,number:train.id,direction:train.direction});},
 depart(station,slot,train){removeEverywhere(train.id);if(slot&&root.SimTrainWindows.data[station].some(w=>w.slot===slot))root.SimLSUI.dispatch({op:'insert',station,slot,number:train.id,direction:train.direction});},
 remove(station,train){root.SimLine.setJourney(train.id,null);transit.delete(train.id);removeEverywhere(train.id);},
 // 선로망: 역을 빠져나간 열차번호는 같은 본선의 다음 연동역 진입 열번창(경계 회로)으로 넘어간다 — 그 역의 자동제어가 승강장에 놓을 때까지 그곳에 서 있다.
 // 사이에 정차하는 비연동 중간역(석수·시청 등)이 있으면 그 역의 열번창에서 출발시각까지 서 있다가 넘어간다.
 handoff(station,train,dest,delay=0){
  const h=dest&&root.SimLine.handoff(station,dest,id=>(root.SimTrainWindows.data[id]||[]).map(w=>w.slot),train.direction);
  if(!h)return;
  const codes=[...root.SimLine.graph.chains[h.section.id]];if(train.direction==='up')codes.reverse();
  const tr={train,delay,from:station,h,codes,index:0,start:host.context().stationStates[station].clock,via:root.SimLine.viaStations(station,h.station,h.trunk),at:null};transit.set(train.id,tr);moveTransit(tr);
 }
};

function set(on){
 enabled=!!on;engine.reset();transit.clear();root.SimLine.journeys.clear();
 label();mmi().log('event',`열차 자동제어(AUTO) ${enabled?'사용':'중지'}`);
 if(enabled)step();
 drawTroubles();
}
function step(){
 if(!enabled||!host||mmi().replaying())return false;
 const model=root.SimDiagram.getModel(),reserved=new Set(root.SimScenarioUI?.reservedNumbers?.()||[]);
 root.SimLine.refresh(host.context().stationStates,root.SimLSUI.getModel());
 let transitChanged=false;for(const tr of transit.values())transitChanged=moveTransit(tr)||transitChanged;
 root.SimLine.refresh(host.context().stationStates,root.SimLSUI.getModel());
 const events=engine.run({states:host.context().stationStates,model:{...model,trains:model.trains.filter(t=>!reserved.has(t.id))},numbers,reflect});
 for(const e of events){
  if(e.type==='route')mmi().markAuto(`${e.station}|${e.route}|설정`);
  else if((e.type==='arrived'||e.type==='left')&&e.route)mmi().markAuto(`${e.station}|${e.route}|해정`);
  if(e.type==='externalHandover')mmi().log('event',`${name(e.station)}역 ${e.train} 기지 경계 인계 · ${e.boundary}`);
  if(e.type==='trouble')mmi().log('event',`${name(e.station)}역 자동진로제어 트러블등록 · ${e.train} ${e.route} · ${e.reason}`,undefined,'W');
  else if(e.type==='delay')mmi().log('event',`${name(e.station)}역 ${e.train} 신호 대기 지연 · 도착 ${e.arrDelay}초 · 출발 ${e.depDelay}초`,undefined,'W');
  else if(e.type==='reflected')mmi().log('event',`${e.train} 지연 ${e.seconds}초를 ${name(e.station)}역 이후 스케줄에 반영`);
  else if(e.type==='resolved')mmi().log('event',`${name(e.station)}역 자동진로제어 트러블 해소 · ${e.train} ${e.route}`);
 }
 if(events.length){drawTroubles();drawDelays();}
 root.SimLine.refresh(host.context().stationStates,root.SimLSUI.getModel());
 return events.length>0||transitChanged;
}
function position(train,now){
 if(root.SimScenarioUI?.reservedNumbers().includes(train.id))return root.SimScenarioUI.position(train);
 if(!enabled)return root.SimTimetable.position(train,now);
 const tr=transit.get(train.id);if(tr){const a=root.SimNetwork.catalog[tr.from],b=root.SimNetwork.catalog[tr.h.station],fraction=tr.codes.length<2?1:tr.index/(tr.codes.length-1);return {station:a.id,nextStation:b.id,order:a.order+(b.order-a.order)*fraction,status:'역간 운행',actual:true,circuit:tr.codes[tr.index]};}
 return engine.position(train,now);
}
return {step,set,enabled:()=>enabled,reflecting:()=>reflect,reflect:on=>{reflect=!!on;},position,transits:()=>[...transit.values()],troubles:()=>engine.troubles(),actuals:()=>engine.actuals()};
}
module.exports={create};

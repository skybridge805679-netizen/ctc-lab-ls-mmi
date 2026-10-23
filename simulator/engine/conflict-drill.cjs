'use strict';
function create(root){
 const N=root.SimNetwork,T=root.SimTimetable,ID='B0000',OFFSET=240,SHIFTS=[50,100,150,150,150,100,50];
 const mmi=()=>root.SimMMI,D=()=>root.SimDiagram,model=()=>D().getModel();let baseline=null,start=null;
function problemTrain(){return model().trains.find(t=>t.id===ID);}
// The timetable is user data (typed in, changed by scenarios), so nothing here assumes particular train numbers or spacing:
// every down train is tried as the leader on a scratch copy of the CURRENT timetable until B0000 behind it makes a conflict
// that involves only B0000 and that a +2분 shift at the nearest 해소역 really resolves.
const involves=c=>c.trains.includes(ID);
function build(m,leader){
 const made=T.copy(m,leader.id,ID,leader.calls[0].departure+OFFSET,{});if(!made.ok)return null;
 const train=m.trains.find(t=>t.id===ID),a=N.stations.findIndex(s=>s.id==='yeongdeungpo')+1;
 SHIFTS.forEach((shift,k)=>{const st=N.stations[a+k]?.id,c=train.calls.find(x=>x.station===st);if(!c)return;c.arrival-=shift;c.departure-=shift;});
 train.plan=train.calls.map(c=>({...c}));
 return T.valid(train)?train:null;
}
function viable(leader){
 const m=structuredClone(model()),train=build(m,leader);if(!train)return null;
 const found=T.conflicts(m);
 if(!found.some(involves)||found.some(c=>involves(c)&&!c.trains.includes(leader.id)))return null;      // only B0000 vs its leader
 const first=found.filter(involves)[0],nearest=T.nearestResolveStation(first.station,'down'),i=train.calls.findIndex(c=>c.station===nearest);
 if(i<0)return null;
 for(let k=i;k<train.calls.length;k++){train.calls[k].departure+=120;if(k>i)train.calls[k].arrival+=120;}      // the +2분 the scenario asks for
 return T.conflicts(m).filter(involves).length===0?first:null;
}
// builds the exercise on the current timetable; shared by the drill window and the 경합 시나리오 (which lets the operator find the train by search)
function createProblem({select=true}={}){
 if(problemTrain())return {ok:false,message:baseline?'이미 출제된 문제가 있습니다. 채점하거나 [초기화] 후 다시 출제하세요.':`현재 시간표에 ${ID} 열차가 이미 있습니다. 다른 번호로 바꾸거나 삭제한 뒤 출제하세요.`};
 const downs=model().trains.filter(t=>t.direction==='down'&&!t.cancelled).sort((x,y)=>y.calls[0].departure-x.calls[0].departure);
 if(!downs.length)return {ok:false,message:'현재 시간표에 운행 중인 하행 열차가 없습니다. 하행 열차를 만든 뒤 출제하세요.'};
 let leader=null,first=null;
 for(const t of downs){const f=viable(t);if(f){leader=t;first=f;break;}}
 if(!leader)return {ok:false,message:'현재 시간표에서는 해소 가능한 경합 문제를 만들 수 없습니다. 하행 열차 사이 간격이 좁거나 영등포~수원 구간을 지나는 열차가 없습니다. 열차 간격을 넓히거나 하행 열차를 추가한 뒤 다시 출제하세요.'};
 const made=build(model(),leader);
 if(!made)return {ok:false,message:'문제 열차를 만들지 못했습니다. 시각표를 확인하세요.'};
 const m2=model();m2.trains.find(t=>t.id===ID).plan=made.plan;
 baseline=structuredClone(problemTrain().calls);start={station:first.station,leader:leader.id};
 mmi().log('event','경합해소 실습 출제');
 return {ok:true,leader:leader.id,first,nearest:T.nearestResolveStation(first.station,'down'),baseline};
}
const name=id=>root.SimMMI.stationInfo(id).name;
function grade(){let message='';const say=text=>{message=text;},list=()=>{};
 function evaluate(){
 const train=problemTrain();
 if(!train||!baseline){say('출제된 문제가 없습니다. [문제 출제]를 누르세요.');return;}
 const remaining=T.conflicts(model()).filter(involves);
 if(remaining.length){list();say(`경합이 ${remaining.length}건 남아 있습니다. 경합 구간은 ${name(remaining[0].station)}부터입니다 — 다시 확인하세요.`);return;}
 const changed=train.calls.findIndex((c,i)=>c.arrival!==baseline[i].arrival||c.departure!==baseline[i].departure||c.arrivalRoute!==baseline[i].arrivalRoute||c.departureRoute!==baseline[i].departureRoute);
 if(changed<0){say('B0000을 수정하지 않았는데 경합이 없습니다. 상태를 확인하세요.');return;}
 const nearest=T.nearestResolveStation(start.station,'down'),at=train.calls[changed].station;
 const parts=[];
 if(at!==nearest)parts.push(`경합은 해소되었지만 해소역이 원칙과 다릅니다. 경합지(${name(start.station)})에서 가장 가까운 앞쪽 해소역은 ${name(nearest)}역이며, 수정은 ${name(at)}역에서 시작했습니다. (※ 해소역: ${T.RESOLVE_STATIONS.map(name).join('·')})`);
 const idx=train.calls.findIndex(c=>c.station===nearest),cur=train.calls[idx],base=baseline[idx];
 if(idx>=0&&cur.arrivalRoute===base.arrivalRoute&&cur.departureRoute===base.departureRoute)parts.push(`${name(nearest)}역의 도착진로·출발진로를 수정하지 않았습니다.`);
 if(idx>=0&&cur.departure<=base.departure)parts.push(`${name(nearest)}역 출발시각을 늦추지 않았습니다. (해소역에서 +2분)`);
 list();
 if(parts.length){say(parts.join(' '));mmi().log('event','경합해소 실습 채점 · 보완 필요');return;}
 say(`합격: ${name(nearest)}역에서 시각(${T.clock(cur.departure)})과 진로(${cur.arrivalRoute||'—'} / ${cur.departureRoute||'—'})를 수정해 경합을 해소했습니다. 다른 열차와의 3차 경합도 없습니다.`);
 mmi().log('event','경합해소 실습 채점 · 합격');
}
 evaluate();return {ok:true,message};
}
return {ID,createProblem,grade,reset(){if(problemTrain())T.remove(model(),ID);baseline=null;start=null;},snapshot:()=>({baseline,start})};
}
module.exports={create};

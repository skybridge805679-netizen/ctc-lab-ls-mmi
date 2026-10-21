(function(root){
'use strict';
// Default arrival / departure routes of a train call, written like the real MMI schedule table ("1A_1T", "4A_B002T").
// Values marked source:'photo' were read from the real MMI (2026-10-21: K0004 down, K0013 up); all other controlled
// stations are filled from the derived routes with the rule validated on the confirmed LS lists (source:'estimate').
const OBSERVED={
 down:{
  cheongnyangni:{dep:'4A_B002T'},dongmyo:{arr:'1B_1T',dep:'4A_B016T'},jonggak:{arr:'1A_1T',dep:'4A_B046T'},
  'underground-seoul':{arr:'1A_1T',dep:'4A_B072T'},seoul:{arr:'1A_1T',dep:'4A_B902T'},yongsan:{arr:'1A_1T',dep:'4A_B916T'},
  noryangjin:{arr:'1A_1T',dep:'4A_B928T'},yeongdeungpo:{arr:'1B_6T',dep:'4E_B942T'},guro:{arr:'1B_3T',dep:'4A_B950T'},geumcheon:{arr:'1A_2T',dep:'4B_B968T'}
 },
 up:{
  suwon:{dep:'3C_B1035T'},uiwang:{arr:'2B_6T',dep:'3B_B1011T'},gunpo:{arr:'2A_4T',dep:'3A_B999T'},
  geumjeong:{arr:'2A_4T',dep:'3B_B993T'},anyang:{arr:'2A_5T',dep:'3B_B981T'},geumcheon:{arr:'2A_5T',dep:'3B_B963T'}
 }
};
const core=()=>typeof module!=='undefined'?require('./core.js'):root.SimCore;
const name=id=>id.replace('-','_');
function estimate(stationId,direction){
 let C;try{C=core().forStation(stationId);}catch{return {};}
 const dir=direction==='down'?1:-1,ids=Object.keys(C.routes),nat=(a,b)=>a.localeCompare(b,'en',{numeric:true});
 const of=(kind)=>ids.filter(id=>C.signals[C.routes[id].signal].kind===kind&&C.signals[C.routes[id].signal].dir===dir).sort(nat);
 const track=direction==='down'?'1T':'2T';
 const arrivals=of('장내').filter(id=>!/^B\d+T/.test(C.routes[id].destination));
 const arr=arrivals.find(id=>C.routes[id].destination===track)||arrivals[0];
 const departures=of('출발').filter(id=>{const m=C.routes[id].destination.match(/^B(\d+)T/);return m&&((+m[1])%2===0)===(direction==='down');});
 const dep=departures[0];
 return {arr:arr&&name(arr),dep:dep&&name(dep)};
}
// stopType: 시발 / 정차 / 종착 as shown in the "정차구분" column.
function routesFor(stationId,direction,first,last){
 const seen=OBSERVED[direction]?.[stationId],est=seen?null:estimate(stationId,direction),v=seen||est||{};
 return {arrivalRoute:first?'':(v.arr||''),departureRoute:last?'':(v.dep||''),stopType:first?'시발':last?'종착':'정차',routeSource:seen?'photo':(v.arr||v.dep)?'estimate':'none'};
}
const api={OBSERVED,routesFor,estimate};
if(typeof module!=='undefined')module.exports=api;else root.SimScheduleRoutes=api;
})(typeof window!=='undefined'?window:globalThis);

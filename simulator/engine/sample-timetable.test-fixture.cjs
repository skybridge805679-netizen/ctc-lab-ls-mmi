'use strict';
const N=require('./network'),R=require('./schedule-routes');
module.exports=function sampleTimetable(){
  const trains=[];
  for(const direction of ['down','up'])for(let n=0;n<6;n++){
   const stations=direction==='down'?N.stations:[...N.stations].reverse();
   const calls=stations.map((station,i)=>({station:station.id,arrival:n*360+i*150,departure:n*360+i*150+30,...R.routesFor(station.id,direction,i===0,i===stations.length-1)}));
   const number=direction==='down'?1131+n*2:1002+n*2;
   trains.push({id:'K'+number,direction,kind:'전동열차',service:'정기',flags:[],cancelled:false,plan:calls.map(c=>({...c})),calls});
  }
  return {trains,changes:[],serviceDate:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})};
 };

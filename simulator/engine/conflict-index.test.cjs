'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('./timetable'),N=require('./network'),MIN_HEADWAY=120;
function oracle(model,minHeadway=MIN_HEADWAY){
 const out=[],trains=model.trains.filter(t=>!t.cancelled);
 for(let i=0;i<trains.length;i++)for(let j=i+1;j<trains.length;j++){
  const a=trains[i],b=trains[j];if(a.direction!==b.direction)continue;
  const common=a.calls.filter(c=>!c.cancelled&&b.calls.some(d=>d.station===c.station&&!d.cancelled)).map(c=>({a:c,b:b.calls.find(d=>d.station===c.station)}));
  common.sort((x,y)=>(N.catalog[x.a.station].order-N.catalog[y.a.station].order)*(a.direction==='down'?1:-1));
  const found=[];let lastSign=0,lastStation=null;
  for(const {a:ca,b:cb} of common){
   const aFirst=ca.arrival+ca.departure<=cb.arrival+cb.departure,lead=aFirst?ca:cb,follow=aFirst?cb:ca,leader=aFirst?a:b,follower=aFirst?b:a,sign=aFirst?1:-1;
   if(lastSign&&sign!==lastSign)found.push({type:'추월경합',station:ca.station,from:lastStation,trains:[a.id,b.id],time:Math.min(ca.arrival,cb.arrival)});
   lastSign=sign;lastStation=ca.station;
   const arr=follow.arrival-lead.arrival,dep=follow.departure-lead.departure;
   if(arr>=0&&arr<minHeadway)found.push({type:'도착 운전시격 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.arrival,gap:arr});
   if(dep>0&&dep<minHeadway)found.push({type:'출발 운전시격 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.departure,gap:dep});
   if(lead.arrivalRoute&&lead.arrivalRoute===follow.arrivalRoute&&follow.arrival<lead.departure)found.push({type:'플랫폼 할당 경합',station:ca.station,trains:[leader.id,follower.id],time:follow.arrival,route:lead.arrivalRoute});
  }
  out.push(...found);
 }
 return out.sort((x,y)=>N.catalog[x.station].order-N.catalog[y.station].order||x.time-y.time);
}
test('indexed conflicts exactly match all-pair detection, including overtakes, ties, cancellations and partial routes',()=>{
 let seed=73;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let round=0;round<100;round++){const trains=[];for(let i=0;i<20;i++){const direction=i%3?'down':'up',stations=direction==='down'?N.stations:[...N.stations].reverse(),a=Math.floor(random()*15),b=a+3+Math.floor(random()*(stations.length-a-3));let time=Math.floor(random()*1000);const calls=stations.slice(a,b).map(st=>{time+=40+Math.floor(random()*200);return {station:st.id,arrival:time,departure:time+Math.floor(random()*150),arrivalRoute:'R'+(i%3),cancelled:random()<.15};});trains.push({id:'K'+(1000+i),direction,calls,cancelled:random()<.1});}
  const model={trains};assert.deepEqual(T.conflicts(model),oracle(model),'round '+round);
 }
});

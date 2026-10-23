(function(root){'use strict';
// Candidate pairs from headway windows, platform intervals and order inversions.
// The exact original conflict predicates are applied to those candidates by timetable.js.
function pairs(trains,minHeadway,order){
 const found=new Set(),n=trains.length,stations=new Map(),maps=trains.map(t=>new Map(t.calls.filter(c=>!c.cancelled).map(c=>[c.station,c])));
 const add=(a,b)=>{if(a!==b)found.add(Math.min(a,b)*n+Math.max(a,b));};
 trains.forEach((t,i)=>{for(const c of t.calls)if(!c.cancelled){const key=t.direction+'|'+c.station;if(!stations.has(key))stations.set(key,[]);stations.get(key).push({i,c});}});
 for(const rows of stations.values()){
  for(const field of ['arrival','departure']){const sorted=[...rows].sort((a,b)=>a.c[field]-b.c[field]);let left=0;for(let j=0;j<sorted.length;j++){while(left<j&&sorted[j].c[field]-sorted[left].c[field]>=minHeadway)left++;for(let k=left;k<j;k++)add(sorted[k].i,sorted[j].i);}}
  const routes=new Map();for(const r of rows)if(r.c.arrivalRoute){if(!routes.has(r.c.arrivalRoute))routes.set(r.c.arrivalRoute,[]);routes.get(r.c.arrivalRoute).push(r);}
  for(const group of routes.values()){group.sort((a,b)=>a.c.arrival-b.c.arrival);let active=[];for(const r of group){active=active.filter(a=>a.c.departure>r.c.arrival);for(const a of active)add(a.i,r.i);active.push(r);}}
 }
 function inversions(rows){if(rows.length<2)return rows;const mid=rows.length>>1,left=inversions(rows.slice(0,mid)),right=inversions(rows.slice(mid)),out=[];let i=0,j=0;while(i<left.length&&j<right.length){if(left[i].rank<=right[j].rank)out.push(left[i++]);else{for(let k=i;k<left.length;k++)add(left[k].i,right[j].i);out.push(right[j++]);}}return out.concat(left.slice(i),right.slice(j));}
 for(const direction of ['up','down']){
  const ids=[...new Set(trains.filter(t=>t.direction===direction).flatMap(t=>t.calls.filter(c=>!c.cancelled).map(c=>c.station)))].sort((a,b)=>(order(a)-order(b))*(direction==='down'?1:-1));
  const skip=trains.some(t=>t.direction===direction&&t.calls.some(c=>c.cancelled));
  for(let a=0;a<ids.length-1;a++)for(let b=a+1;b<ids.length&&(skip||b===a+1);b++){
   const before=(stations.get(direction+'|'+ids[a])||[]).filter(r=>maps[r.i].has(ids[b])).sort((x,y)=>x.c.arrival+x.c.departure-y.c.arrival-y.c.departure||x.i-y.i),rank=new Map(before.map((r,i)=>[r.i,i]));
   const after=(stations.get(direction+'|'+ids[b])||[]).filter(r=>rank.has(r.i)).sort((x,y)=>x.c.arrival+x.c.departure-y.c.arrival-y.c.departure||x.i-y.i);inversions(after.map(r=>({i:r.i,rank:rank.get(r.i)})));
  }
 }
 return [...found].sort((a,b)=>a-b).map(key=>[Math.floor(key/n),key%n]);
}
const api={pairs};if(typeof module!=='undefined')module.exports=api;else root.SimConflictIndex=api;
})(typeof globalThis!=='undefined'?globalThis:this);

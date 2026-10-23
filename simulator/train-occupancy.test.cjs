const assert=require('node:assert/strict');
const N=require('./network'),W=require('./wiring'),Core=require('./core'),LS=require('./ls-view');
for(const st of N.stations.filter(s=>s.controlled)){
 const C=Core.forStation(st.id),id=Object.keys(C.routes)[0],s=C.initial();
 assert(C.dispatch(s,{type:'mode',value:'CCM'}).ok);
 assert(C.dispatch(s,{type:'route',id}).ok);assert(C.dispatch(s,{type:'occupy',id,seconds:20}).ok);
 const geometry=[];
 for(const seconds of [0,10,15]){
  if(seconds)C.dispatch(s,{type:'tick',seconds});
  const svg=LS.render(st,W.data[st.id],C,s).svg;
  assert(!/NaN|Infinity|undefined/.test(svg),st.id);
  const path=svg.match(/data-train-run="[^"]+"[^>]*d="([^"]+)"/);assert(path,st.id+' missing moving occupancy');geometry.push(path[1]);
  assert.equal((svg.match(/data-active-route=/g)||[]).length,1);assert(s.routes[id].occupied);
 }
 assert.notEqual(geometry[0],geometry[1],st.id);assert.notEqual(geometry[1],geometry[2],st.id);
 C.dispatch(s,{type:'clear',id});assert(!LS.render(st,W.data[st.id],C,s).svg.includes('data-train-run='));
}
console.log('PASS all 15 stations: timed occupancy moves, remains finite and clears without altering route control');
const C=Core.forStation('yongsan');
for(const value of [0,-1,'oops',Infinity,NaN,'30']){
 const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2A-5T',control:'continuous'});C.dispatch(s,{type:'occupy',id:'2A-5T',seconds:value});
 assert.equal(s.routes['2A-5T'].train.to,value==='30'?30:20);
 C.dispatch(s,{type:'clear',id:'2A-5T'});assert(!s.routes['2A-5T'].train);assert(!s.routes['2A-5T'].occupied);
}
console.log('PASS invalid travel times use a finite default; continuous routes discard completed train metadata');

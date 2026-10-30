(function(root){
'use strict';
// Locking rules taken from the course text (실무5 구술 8·9번, 대피 대본). Anything not listed here is not modelled.
const approach={
 seconds:{'장내':90,'출발':30},
 source:'실무5 구술 8번 · KR S-06030: 열차가 신호기 외방 일정구간에 진입한 뒤 신호를 정지시키면 장내 90초, 출발 30초 진로 쇄정'
};
const overlap={
 geumcheon:{
  '2B-6T':{points:{'26':'N'},note:'전방 26 선로전환기 정위 쇄정(오버랩)',source:'실무5 금천구청 상선 6번 대피 대본 해설(2B-6T 장내 진행, 전방 26B 정위)'},
  '1B-1T':{points:{'54':'R'},note:'1번선 끝 54 선로전환기 반위 쇄정(오버랩)',source:'실무5 금천구청 하선 1번 대피 대본 해설(1B-1T 장내 진행, 54번 반위)'}
 },
 yeongdeungpo:{
  '1A-1T':{points:{},clearSignals:['4B'],note:'4B 출발신호기 해정 후 진행(오버랩 때문)',source:'실무5 영등포 1번 대피 대본 해설(1A 해정 후 4B 오버랩 해정)'}
 }
};
// Simultaneous routes confirmed by the user's observation of the real LS.
// This is a regression observation for the generic shared-N rule, not a route-pair exception.
const parallel={anyang:[{routes:['4C-B660T','4A-B984T'],source:'사용자 실물 LS 확인 · 2026-10-23 · 4C-B660T 설정 중 4A-B984T 동시 설정 가능'}]};
const parallelFor=(station,a,b)=>parallel[station]?.find(rule=>rule.routes.includes(a)&&rule.routes.includes(b)&&a!==b)||null;
// ---------------------------------------------------------------- general rules, every station
// The course gives the definitions, not per-station tables (구술 8·9번):
//  접근쇄정 — a train is in the section in rear of (외방) a 장내·출발 signal when the signal is cancelled → 90 s / 30 s route lock.
//  오버랩   — for an 장내 route, the points beyond the 출발 signal at the end of the track are put to the safe side and locked.
// Both are derived here from the network data so that they hold at every station. The three overlap cases of the scripts
// (금천구청 2B-6T 26 정위, 1B-1T 54 반위, 영등포 1A-1T → 4B 해정) and the 용산 6번 "출발 먼저" order come out of the same rule
// and stay listed above as checked cases.
const isNode=typeof module!=='undefined';
const lib=name=>isNode?require('./'+name):root[{network:'SimNetwork',wiring:'SimWiring',line:'SimLine'}[name]];
const STUB=d=>!/^B\d+T/.test(d)&&!/^\d+T$/.test(d);          // 26BT, CT, AT …: dead-end / safety tracks, not the line or a platform track
const cache={approach:new Map(),overlap:new Map()};
const xOf=p=>Number(String(p).split(':')[1].split(',')[0]);
function signalRow(station,signal){return lib('wiring').data[station]?.signals.find(x=>x[0]===signal);}
// rear edges of a signal on its own rail, nearest first, up to the first point; with the line circuit codes they belong to
function approachSection(station,signal){
 const key=station+'|'+signal;if(cache.approach.has(key))return cache.approach.get(key);
 const N=lib('network'),st=N.catalog[station],meta=st?.signals[signal],row=signalRow(station,signal);let out={resources:[],codes:[]};
 if(st&&meta&&row&&approach.seconds[meta.kind]){
  const r2c=lib('line')?.graph?.resourceToCode||{},x=row[2],rear=st.topology.edges.filter(e=>e.rail===row[1]&&!e.point).map(e=>{const [x1,x2]=[xOf(e.a),xOf(e.b)].sort((a,b)=>a-b);return {e,x1,x2};})
   .filter(o=>meta.dir>0?o.x1<x-.5:o.x2>x+.5).sort((a,b)=>meta.dir>0?b.x2-a.x2:a.x1-b.x1);
  for(const o of rear){out.resources.push(o.e.resource);const c=r2c[o.e.resource];if(c&&!out.codes.includes(c))out.codes.push(c);if(out.codes.length>=2)break;}
  if(!out.codes.length)out.resources=out.resources.slice(0,3);
 }
 cache.approach.set(key,out);return out;
}
// is a train in the approach section of the signal right now? (LS 열번 · 자동운행 열차 · 진로 점유, as refreshed by SimLine)
function approachTrain(station,signal,state){
 const sec=approachSection(station,signal);
 const code=sec.codes.find(c=>(state.circuitOccupied?.[c]||[]).length);if(code)return {code,train:state.circuitOccupied[code][0]};
 const res=sec.resources.find(r=>state.occupied?.[r]);if(res)return {code:res,train:''};
 return null;
}
function orderedPoints(st,r){const out=[];for(const res of r.resources||[]){const e=st.topology.edges.find(x=>x.resource===res);if(e?.point&&!out.includes(e.point))out.push(e.point);}for(const p of r.pointLocks||[])if(!out.includes(p))out.push(p);return out;}
function derivedOverlap(station,routeId){
 const key=station+'|'+routeId;if(cache.overlap.has(key))return cache.overlap.get(key);
 const N=lib('network'),st=N.catalog[station],r=st?.routes[routeId],sig=r&&st.signals[r.signal];let out=null;
 if(sig?.kind==='장내'){
  const exits=lib('wiring').data[station].signals.filter(x=>x[1]===r.destination&&st.signals[x[0]]?.dir===sig.dir&&st.signals[x[0]].kind==='출발').map(x=>x[0]);
  const deps=Object.values(st.routes).filter(x=>exits.includes(x.signal)).map(x=>({x,pts:orderedPoints(st,x)}));
  const points={};
  for(let i=0;deps.length;i++){
   const ids=new Set(deps.map(q=>q.pts[i]));if(ids.size!==1||ids.has(undefined))break;
   const p=[...ids][0],pos=[...new Set(deps.map(q=>q.x.pointPositions[p]))];
   if(pos.length===1){points[p]=pos[0];continue;}                     // every way out of the track uses it this way (trailing)
   const safe=pos.filter(v=>deps.filter(q=>q.x.pointPositions[p]===v).every(q=>STUB(q.x.destination)));
   if(safe.length===1)points[p]=safe[0];                               // facing: towards the dead-end / safety track
   break;
  }
  if(Object.keys(points).length)out={points,exits,derived:true,note:`출발신호기(${exits.join('·')}) 전방 전환기 ${Object.entries(points).map(([p,v])=>p+(v==='R'?' 반위':' 정위')).join(', ')} 쇄정 (오버랩 · 규칙)`,source:'구술 9번 정의에 따른 규칙: 도착선 출발진로가 공통으로 쓰는 전환기, 대향 전환기는 막힌 선(안전측선) 쪽'};
 }
 cache.overlap.set(key,out);return out;
}
function rulesFor(station,route){
 const explicit=overlap[station]?.[route],derived=derivedOverlap(station,route);
 if(explicit)return {...explicit,points:{...(derived?.points||{}),...explicit.points},exits:derived?.exits||[],checked:true};
 return derived;
}
const api={approach,overlap,parallel,parallelFor,rulesFor,derivedOverlap,approachSection,approachTrain};
if(typeof module!=='undefined')module.exports=api;else root.SimInterlocking=api;
})(typeof window!=='undefined'?window:globalThis);

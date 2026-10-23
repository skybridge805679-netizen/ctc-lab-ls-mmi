(function(root){
'use strict';
// 선로망 (큰 그림): 역마다 따로 있던 선로를 노선 전체의 "큰 가지(본선 trunk)"로 잇는다.
// 큰 가지 = 역 구내를 곧게 지나 양쪽 경계 회로(B###T)로 이웃 역과 이어지는 본선. 작은 가지 = 부본선·대피선·승강장선처럼 본선에서 갈라지는 선(역 안에서만 쓰임).
// 본선은 회로 번호 계열로 알아본다: 0xx = 지하철 구간(상선/하선), 6xx·7xx = 일반선(상1/하1), 9xx·10xx = 전동선(상2/하2). 짝수 = 하행, 홀수 = 상행.
// 같은 본선(trunk)을 가진 이웃 연동역끼리 구간(section)으로 이어 열차가 역을 빠져나가면 다음 역의 진입 회로로 넘어가게 한다.
const isNode=typeof module!=='undefined';
const N=isNode?require('./network.js'):root.SimNetwork;
const W=isNode?require('./wiring.js'):root.SimWiring;
const NAMES={MD:'하선(지하철)',MU:'상선(지하철)',GD:'하1선(일반)',GU:'상1선(일반)',ED:'하2선(전동)',EU:'상2선(전동)'};
const numberOf=name=>{const m=/^B(\d+)T/.exec(name||'');return m?+m[1]:null;};
const trunkOf=name=>{const n=numberOf(name);if(n===null)return null;return (n<600?'M':n<900?'G':'E')+(n%2===0?'D':'U');};

function build(){
 const stations={},order=N.stations.filter(s=>s.controlled).map(s=>s.id);
 for(const id of order){
  const def=W.data[id],t={},branches=[],transitions=[];
  for(const [rail,poly,,left,right] of def.rails){
   const a=trunkOf(left),b=trunkOf(right),trunk=a||b;
   if(!trunk){branches.push(rail);continue;}
   if(a&&b&&a!==b){      // 계열이 바뀌는 선 (서울역: 지하철 0xx → 전동 9xx): 왼쪽은 a 본선의 끝, 오른쪽은 b 본선의 시작
    (t[a]??={left:null,right:null,rails:[]}).left=left;t[a].rails.push(rail);
    (t[b]??={left:null,right:null,rails:[]}).right=right;t[b].rails.push(rail);transitions.push({from:a,to:b,rail});continue;
   }
   const e=t[trunk]??={left:null,right:null,rails:[]};
   if(numberOf(left)!==null)e.left=left;if(numberOf(right)!==null)e.right=right;e.rails.push(rail);
  }
  stations[id]={id,order:N.catalog[id].order,trunks:t,branches,transitions};
 }
 // sections: consecutive controlled stations that both carry the trunk
 const sections=[];
 for(const trunk of Object.keys(NAMES)){
  const have=order.filter(id=>stations[id].trunks[trunk]);
  for(let i=1;i<have.length;i++){
   const a=stations[have[i-1]],b=stations[have[i]],ta=a.trunks[trunk],tb=b.trunks[trunk];
   sections.push({id:`${trunk}:${a.id}>${b.id}`,trunk,west:a.id,east:b.id,westSide:ta.right,eastSide:tb.left,           // the circuits at each station's edge facing the section
    skipped:order.slice(order.indexOf(a.id)+1,order.indexOf(b.id)).filter(x=>!stations[x].trunks[trunk])});
  }
 }
 return {order,stations,sections,NAMES};
}
const line=build();
// 본선마다 그 본선으로 들어오는 장내신호기(예: 금천구청 하2선 1A, 하1선 1B, 상1선 2B, 상2선 2A)
function arrivalSignal(station,trunk){
 const t=line.stations[station]?.trunks[trunk];if(!t)return null;const dir=trunk.endsWith('D')?1:-1;
 const sig=W.data[station].signals.find(x=>/^[12][A-Z]$/.test(x[0])&&t.rails.includes(x[1])&&x[4]===dir);
 return sig?sig[0]:null;
}
// the station a train reaches next when it leaves `station` on `trunk` going down (towards 수원) or up, and the circuit it enters at
function next(station,trunk,direction){
 const s=direction==='down'?line.sections.find(x=>x.trunk===trunk&&x.west===station):line.sections.find(x=>x.trunk===trunk&&x.east===station);
 if(!s)return null;
 return direction==='down'?{station:s.east,entry:s.eastSide,section:s}:{station:s.west,entry:s.westSide,section:s};
}
// the 열번창 a train number appears in when it enters the next station: among B's windows of the same trunk, the one nearest the entry circuit
function entrySlot(station,trunk,direction,slots){
 const s=line.stations[station],t=s?.trunks[trunk];if(!t)return null;
 const edge=direction==='down'?t.left:t.right,n=numberOf(edge);if(n===null)return null;
 const cand=slots.filter(x=>/^B\d+T$/.test(x)&&trunkOf(x)===trunk).map(x=>({x,n:numberOf(x)}));
 if(!cand.length)return null;
 cand.sort((a,b)=>Math.abs(a.n-n)-Math.abs(b.n-n)||(direction==='down'?a.n-b.n:b.n-a.n));
 return cand[0].x;
}
// leaving `station` through its departure route that ends at boundary circuit `dest`: where does the train go?
function handoff(station,dest,slotsOf){
 const trunk=trunkOf(dest);if(!trunk)return null;
 const direction=trunk.endsWith('D')?'down':'up',n=next(station,trunk,direction);if(!n)return null;
 const slot=entrySlot(n.station,trunk,direction,slotsOf(n.station));return slot?{station:n.station,slot,trunk,direction,section:n.section,signal:arrivalSignal(n.station,trunk)}:null;
}
// 비연동 중간역: 이웃 연동역 LS 화면의 역판 아래에 있는 열번창 (본선별). 석수 상2선(EU)=B967T처럼 LS 좌표와 열번창 위치로 정했다.
const INTERMEDIATE={
 cityhall:{host:'jonggak',slots:{"MD": "B060T", "MU": "B055T"}},
 sinseoldong:{host:'dongmyo',slots:{"MD": "B012T", "MU": "B011T"}},
 dongdaemun:{host:'dongmyo',slots:{"MD": "B020T", "MU": "B021T"}},
 jongno5:{host:'dongmyo',slots:{"MD": "B026T", "MU": "B025T"}},
 jongno3:{host:'dongmyo',slots:{"MD": "B034T", "MU": "B031T"}},
 namyeong:{host:'seoul',slots:{"ED": "B908T", "EU": "B909T", "GD": "B602T", "GU": "B601T"}},
 gasan:{host:'guro',slots:{"ED": "B956T", "GD": "B632T", "GU": "B631T", "EU": "B953T"}},
 doksan:{host:'guro',slots:{"ED": "B962T", "GD": "B636T", "GU": "B637T", "EU": "B959T"}},
 seoksu:{host:'geumcheon',slots:{"ED": "B974T", "GD": "B650T", "GU": "B643T", "EU": "B967T"}},
 gwanak:{host:'anyang',slots:{"ED": "B978T", "GD": "B652T", "GU": "B653T", "EU": "B975T"}},
 myeonghak:{host:'anyang',slots:{"ED": "B990T", "GD": "B666T", "GU": "B663T", "EU": "B989T"}},
 dangjeong:{host:'gunpo',slots:{"ED": "B1006T", "GD": "B682T", "GU": "B679T", "EU": "B1005T"}},
 skku:{host:'uiwang',slots:{"ED": "B1022T", "GD": "B700T", "GU": "B693T", "EU": "B1019T"}},
 hwaseo:{host:'uiwang',slots:{"ED": "B1032T", "GD": "B710T", "GU": "B703T", "EU": "B1029T"}},
 sindorim:{host:'yeongdeungpo',slots:{"GD": "B622T", "GU": "B623T", "ED": "B946T", "EU": "B945T"}},
 daebang:{host:'noryangjin',slots:{"GD": "B616T1T", "ED": "B932T", "GU": "B615T2T"}},
 singil:{host:'noryangjin',slots:{"GD": "B618T2T", "ED": "B938T", "GU": "B619T1T"}},
 jegidong:{host:'cheongnyangni',slots:{"MD": "B006T", "MU": "B005T"}},
};
// 연동역 A에서 B로 가는 본선 위에서 열차가 설 수 있는 비연동 중간역 (진행 순서)
function viaStations(a,b,trunk){
 const lo=Math.min(N.catalog[a].order,N.catalog[b].order),hi=Math.max(N.catalog[a].order,N.catalog[b].order);
 const list=N.stations.filter(x=>!x.controlled&&x.order>lo&&x.order<hi&&INTERMEDIATE[x.id]?.slots[trunk]).map(x=>({station:x.id,host:INTERMEDIATE[x.id].host,slot:INTERMEDIATE[x.id].slots[trunk]}));
 return N.catalog[a].order<N.catalog[b].order?list:list.reverse();
}
// ---- 폐색(구간) 점유: 구간 안(양쪽 역의 경계 열번창 포함)에 열차번호가 있으면 그 구간으로 나가는 출발 진로를 막는다 (한 폐색에 한 열차)
const state={enforce:true,single:new Set()};            // single: "서쪽>동쪽:M|G|E" 단선지령식 시행 중인 구간
const TW=isNode?require('./train-windows.js'):root.SimTrainWindows;
const slotsOfDefault=id=>((TW.data||TW)[id]||[]).map(x=>x.slot);
function sectionNumbers(sec,ls,slotsOf=slotsOfDefault){
 const out=[],pick=(station,test)=>{for(const slot of slotsOf(station)){if(!/^B\d+T$/.test(slot)||trunkOf(slot)!==sec.trunk||!test(numberOf(slot)))continue;for(const r of ls?.stations?.[station]?.windows?.[slot]||[])out.push(r.number);}};
 pick(sec.west,n=>n>=numberOf(sec.westSide));pick(sec.east,n=>n<=numberOf(sec.eastSide));return out;
}
const key=(sec)=>`${sec.west}>${sec.east}:${sec.trunk[0]}`;
// exits that are closed right now: {station:{destination circuit: train number}}
function blockedExits(ls,slotsOf){
 const out={},put=(st,name,who)=>{if(name)(out[st]??={})[name]??=who;};
 const occ=new Map(line.sections.map(sec=>[sec.id,sectionNumbers(sec,ls,slotsOf)]));
 for(const sec of line.sections){
  const nums=occ.get(sec.id);if(!nums.length)continue;
  if(sec.trunk.endsWith('D'))put(sec.west,sec.westSide,nums[0]);else put(sec.east,sec.eastSide,nums[0]);
  if(state.single.has(key(sec))){       // 단선지령식: 한 선로를 양방향이 쓰므로 어느 쪽 열차가 있어도 양쪽 끝에서 나가는 진로를 막는다
   for(const mate of line.sections.filter(x=>x.west===sec.west&&x.east===sec.east&&x.trunk[0]===sec.trunk[0])){
    const t=line.stations;for(const st of [sec.west,sec.east])for(const d of ['D','U']){const tr=t[st].trunks[sec.trunk[0]+d];if(tr){put(st,sec.west===st?tr.right:tr.left,nums[0]);}}
   }
  }
 }
 return out;
}
function refresh(states,ls,slotsOf){
 const blocked=state.enforce?blockedExits(ls,slotsOf):{};
 for(const [id,s] of Object.entries(states)){if(blocked[id])s.exitBlocked=blocked[id];else delete s.exitBlocked;}
 return blocked;
}
const api={INTERMEDIATE,viaStations,state,sectionNumbers,blockedExits,refresh,line,NAMES,trunkOf,numberOf,arrivalSignal,next,entrySlot,handoff,build};
if(isNode)module.exports=api;else root.SimLine=api;
})(typeof window!=='undefined'?window:globalThis);

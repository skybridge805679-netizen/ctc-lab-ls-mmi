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
 const slot=entrySlot(n.station,trunk,direction,slotsOf(n.station));return slot?{station:n.station,slot,trunk,direction,section:n.section}:null;
}
const api={line,NAMES,trunkOf,numberOf,next,entrySlot,handoff,build};
if(isNode)module.exports=api;else root.SimLine=api;
})(typeof window!=='undefined'?window:globalThis);

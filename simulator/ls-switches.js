/* Physical switch display derived from the same N/R positions and locks as the control core. */
(function(root){
'use strict';
const BAR=18,GAP=4,OFFSET=BAR/2+3;
const dpath=points=>'M'+points.map(p=>p.join(' ')).join('L');
function onSegment(p,a,b){return Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<.01&&p[0]>=Math.min(a[0],b[0])-.01&&p[0]<=Math.max(a[0],b[0])+.01&&p[1]>=Math.min(a[1],b[1])-.01&&p[1]<=Math.max(a[1],b[1])+.01;}
function at(rail,x){const poly=rail[1];for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&b[0]!==a[0])return [x,a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])];}throw Error('Switch anchor is off rail '+rail[0]);}
function towards(a,b,distance,limit=.44){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);const t=Math.min(limit,distance/(length||1));return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function build(st,def,core,model,T){
 const rails=new Map(def.rails.map(r=>[r[0],r])),cuts=[],connectors=[],states=[];
 const locked=new Set(Object.keys(model.routes).flatMap(id=>[...(core.routes[id].pointLocks||[]),...Object.keys(core.overlapOf(id)?.points||{})]));
 const flags=id=>({id,position:model.points[id]||'N',locked:locked.has(id)||model.blockedPoints.includes(id)});
 const cut=(id,a,b)=>cuts.push({id,points:[a,b]});
 const mainGap=(id,rail,anchor,direction)=>{
  const x1=anchor[0]+direction*OFFSET,x2=anchor[0]+direction*(OFFSET+GAP);
  cut(id,[x1,anchor[1]],[x2,anchor[1]]);
 };
 for(const [id,a,x,b,z]of def.links){
  const p=T(at(rails.get(a),x)),q=T(at(rails.get(b),z)),state=flags(id),R=state.position==='R';
  // With the diagonal selected, its two alternate straight continuations have real gaps.
  if(R){const direction=Math.sign(q[0]-p[0])||1;mainGap(id,a,p,direction);mainGap(id,b,q,-direction);}
  // A normal crossover remains attached at its heel; only the toe is open.
  const points=R?[p,q]:[towards(p,q,OFFSET+GAP),q];
  connectors.push({...state,kind:'crossover',points});states.push({...state,kind:'crossover',connected:R});
 }
 // Terminal rail joins (sidings and refuge tracks) also contain blades; they are not independent crossovers.
 for(const rail of def.rails){
  const poly=rail[1],branchIds=rail[5]||[];let branchIndex=0;
  for(const endpointIndex of [0,poly.length-1]){
   const endpoint=poly[endpointIndex];
   for(const parent of def.rails){
    if(parent[0]===rail[0]||!parent[1].slice(1).some((p,i)=>onSegment(endpoint,parent[1][i],p)))continue;
    const id=branchIds[Math.min(branchIndex++,branchIds.length-1)];if(!id||!core.points[id])continue;
    const state=flags(id),node=T(endpoint),inner=T(poly[endpointIndex===0?1:poly.length-2]);
    const direction=Math.sign(inner[0]-node[0])||1;
    if(state.position==='R')mainGap(id,parent[0],node,direction);
    else {const length=Math.hypot(inner[0]-node[0],inner[1]-node[1]),start=Math.min(OFFSET,length*.35);cut(id,towards(node,inner,start,.9),towards(node,inner,Math.min(start+GAP,length*.65),.9));}
    states.push({...state,kind:'turnout',connected:state.position==='R',node});
   }
  }
 }
 const maskId='switch-shape-'+st.id;
 const mask=`<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="1680" height="2400"><rect x="-40" y="-40" width="1680" height="2400" fill="white"/>${cuts.map(c=>`<path data-switch-gap="${c.id}" d="${dpath(c.points)}" fill="none" stroke="black" stroke-width="${BAR+2}" stroke-linecap="butt"/>`).join('')}</mask></defs>`;
 const svg=connectors.map(c=>`<path class="switch-connection" data-switch-connection="${c.id}" data-position="${c.position}" data-connected="${c.position==='R'}" data-locked="${c.locked}" d="${dpath(c.points)}"/>`).join('');
 const metadata=states.map(s=>`<g data-switch-geometry="${s.id}" data-position="${s.position}" data-locked="${s.locked}" data-connected="${s.connected}" data-switch-kind="${s.kind}"><title>${s.id} ${s.position==='R'?'반위 · 분기 연결':'정위 · 직선 연결'}${s.locked?' · 쇄정':''}</title></g>`).join('');
 return {mask,maskId,svg,metadata,states,cuts,connectors};
}
const api={build};if(typeof module!=='undefined')module.exports=api;else root.SimLSSwitches=api;
})(typeof window!=='undefined'?window:globalThis);

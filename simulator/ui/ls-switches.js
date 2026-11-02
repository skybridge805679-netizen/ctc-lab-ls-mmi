/* Physical switch display derived from the same N/R positions and locks as the control core. */
(function(root){
'use strict';
const BAR=18,GAP=6,SLOT=4,END_GAP=3,OFFSET=BAR/2+3;
const dpath=points=>'M'+points.map(p=>p.join(' ')).join('L');
function onSegment(p,a,b){return Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<.01&&p[0]>=Math.min(a[0],b[0])-.01&&p[0]<=Math.max(a[0],b[0])+.01&&p[1]>=Math.min(a[1],b[1])-.01&&p[1]<=Math.max(a[1],b[1])+.01;}
function at(rail,x){const poly=rail[1];for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&b[0]!==a[0])return [x,a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])];}throw Error('Switch anchor is off rail '+rail[0]);}
function towards(a,b,distance,limit=.44){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);const t=Math.min(limit,distance/(length||1));return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function unit(a,b){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return length?[(b[0]-a[0])/length,(b[1]-a[1])/length]:[1,0];}
function intersection(a,b,c,d){
 const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],cross=(x,y)=>x[0]*y[1]-x[1]*y[0],den=cross(u,v);if(Math.abs(den)<1e-6)return null;
 const w=[c[0]-a[0],c[1]-a[1]],t=cross(w,v)/den,z=cross(w,u)/den;if(t<=.001||t>=.999||z<=.001||z>=.999)return null;
 return {point:[a[0]+t*u[0],a[1]+t*u[1]],t,z,sine:Math.abs(den)/(Math.hypot(...u)*Math.hypot(...v))};
}
function splitLine(a,b,intervals){
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),along=d=>[a[0]+(b[0]-a[0])*d/length,a[1]+(b[1]-a[1])*d/length],gaps=intervals.map(([lo,hi])=>[Math.max(0,lo),Math.min(length,hi)]).filter(([lo,hi])=>hi>lo).sort((x,y)=>x[0]-y[0]);
 const parts=[];let cursor=0;for(const [lo,hi]of gaps){if(lo>cursor+.01)parts.push([along(cursor),along(lo)]);cursor=Math.max(cursor,hi);}if(cursor<length-.01)parts.push([along(cursor),b]);return parts;
}
function railTangent(rail,anchor,T){
 const poly=rail[1].map(T);let best;
 for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],u=unit(a,b),length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=Math.max(0,Math.min(length,(anchor[0]-a[0])*u[0]+(anchor[1]-a[1])*u[1])),distance=Math.hypot(anchor[0]-a[0]-t*u[0],anchor[1]-a[1]-t*u[1]);if(!best||distance<best.distance)best={u,distance};}return best?.u||[1,0];
}
function bladeOffset(tangent,branch,length){
 const sine=Math.abs(tangent[0]*branch[1]-tangent[1]*branch[0]),cosine=Math.abs(tangent[0]*branch[0]+tangent[1]*branch[1]);
 return Math.min(length*.3,Math.max(OFFSET,(BAR/2*(1+cosine))/Math.max(.1,sine)+GAP/2));
}
function build(st,def,core,model,T,{width=1600}={}){
 const rails=new Map(def.rails.map(r=>[r[0],r])),cuts=[],connectors=[],states=[],diamonds=[];
 const locked=new Set(Object.keys(model.routes).flatMap(id=>[...(core.routes[id].pointLocks||[]),...Object.keys(core.overlapOf(id,model)?.points||{})]));
 const flags=id=>({id,position:model.points[id]||'N',locked:locked.has(id)||model.blockedPoints.includes(id)});
 const cut=(id,a,b)=>cuts.push({id,points:[a,b]});
 const mainGap=(id,rail,anchor,direction,branch)=>{
  const tangent=railTangent(rails.get(rail),anchor,T),sign=(Math.abs(tangent[0])>.001?Math.sign(tangent[0])*direction:1),offset=branch?bladeOffset(tangent,branch,200):OFFSET;
  cut(id,[anchor[0]+tangent[0]*sign*offset,anchor[1]+tangent[1]*sign*offset],[anchor[0]+tangent[0]*sign*(offset+GAP),anchor[1]+tangent[1]*sign*(offset+GAP)]);
 };
 for(const [id,a,x,b,z]of def.links){
  const p=T(at(rails.get(a),x)),q=T(at(rails.get(b),z)),state=flags(id),R=state.position==='R',length=Math.hypot(q[0]-p[0],q[1]-p[1]),branch=unit(p,q),intervals=[];
  const paired=def.links.some(([other,c,u,d,v])=>other!==id&&a===d&&b===c&&Math.abs(x-u)<5&&Math.abs(z-v)<5);
  if(R){const direction=Math.sign(q[0]-p[0])||1;mainGap(id,a,p,direction,branch);mainGap(id,b,q,-direction,branch);}
  connectors.push({...state,kind:paired?'scissors':'crossover',from:a,to:b,points:[p,q],fullPoints:[p,q],endpoints:[p,q],length,intervals,crossings:[]});states.push({...state,kind:'crossover',connected:R});
 }
 // Each photographed crossing has four trapezoidal arms, not four bevelled strokes.
 // Outer faces are parallel to their parent rails; inner faces surround a fixed cross slot.
 for(let i=0;i<connectors.length;i++)for(let j=i+1;j<connectors.length;j++){
  const a=connectors[i],b=connectors[j],hit=intersection(...a.endpoints,...b.endpoints);if(!hit)continue;
  const id=a.id+'-'+b.id,diamond={id,point:hit.point,members:[a.id,b.id]};diamonds.push(diamond);
  for(const [own,other]of [[a,b],[b,a]]){
   own.crossings.push({other:other.id,point:hit.point,diamond:id});const [cx,cy]=hit.point,g=SLOT/2;
   own.quarters=own.endpoints.map((end,index)=>{
    const x=end[0]<cx?-1:1,y=end[1]<cy?-1:1,inner=[cx+x*(g+BAR/2),cy+y*g],tangent=railTangent(rails.get(index===0?own.from:own.to),end,T),direction=unit(end,inner),sine=Math.abs(tangent[0]*direction[1]-tangent[1]*direction[0]),distance=own.position==='N'?(BAR/2+END_GAP)/Math.max(.1,sine):0;
    const outer=towards(end,inner,distance,.75),half=BAR*.75,one=[outer[0]-tangent[0]*half,outer[1]-tangent[1]*half],two=[outer[0]+tangent[0]*half,outer[1]+tangent[1]*half];
    const left=[cx+(x<0?-g-BAR:g),cy+y*g],right=[cx+(x<0?-g:g+BAR),cy+y*g];
    return {name:`${y<0?'n':'s'}${x<0?'w':'e'}`,outer,inner,points:[one,two,right,left]};
   });
   own.fullPoints=[own.endpoints[0],own.quarters[0].inner,hit.point,own.quarters[1].inner,own.endpoints[1]];
   own.segments=own.quarters.map(q=>[q.outer,q.inner]);
  }
 }
 for(const c of connectors)if(!c.crossings.length){const [p,q]=c.endpoints,mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];c.segments=c.position==='N'?[[p,mid],[mid,q]]:[[p,q]];}
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
    if(state.position==='R')mainGap(id,parent[0],node,direction,unit(node,inner));
    else {const length=Math.hypot(inner[0]-node[0],inner[1]-node[1]),start=bladeOffset(railTangent(parent,node,T),unit(node,inner),length);cut(id,towards(node,inner,start,.9),towards(node,inner,Math.min(start+GAP,length*.65),.9));}
    states.push({...state,kind:'turnout',connected:state.position==='R',node});
   }
  }
 }
 const maskId='switch-shape-'+st.id;
 const bounds=`<rect x="-40" y="-40" width="${width+80}" height="2400" fill="white"/>`;
 const normalMasks=connectors.filter(c=>!c.crossings.length&&c.position==='N').map(c=>{
  const [p,q]=c.endpoints,mid=[(p[0]+q[0])/2,(p[1]+q[1])/2],tangent=railTangent(rails.get(c.from),p,T),span=c.length+BAR*2;
  const band=(anchor,u,width)=>`<path d="M${anchor[0]-u[0]*span} ${anchor[1]-u[1]*span}L${anchor[0]+u[0]*span} ${anchor[1]+u[1]*span}" stroke="black" stroke-width="${width}"/>`;
  return `<mask id="crossover-trim-${st.id}-${c.id}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${width+80}" height="2400">${bounds}${band(p,tangent,BAR+END_GAP*2)}${band(q,railTangent(rails.get(c.to),q,T),BAR+END_GAP*2)}${band(mid,tangent,SLOT)}</mask>`;
 }).join('');
 const mask=`<defs>${normalMasks}<mask id="${maskId}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${width+80}" height="2400">${bounds}${cuts.map(c=>`<path data-switch-gap="${c.id}" d="${dpath(c.points)}" fill="none" stroke="black" stroke-width="${BAR+2}" stroke-linecap="butt"/>`).join('')}</mask></defs>`;
 const connection=c=>`<g data-switch-connection="${c.id}" data-switch-form="${c.kind}" data-switch-endpoints="${c.endpoints.map(p=>p.join(',')).join(';')}" data-switch-segments="${c.segments.length}" ${!c.crossings.length&&c.position==='N'?`mask="url(#crossover-trim-${st.id}-${c.id})"`:''} data-crossing-peers="${c.crossings.map(x=>x.other).join(',')}" data-position="${c.position}" data-connected="${c.position==='R'}" data-locked="${c.locked}">${c.quarters?c.quarters.map(q=>`<polygon class="switch-quarter" data-crossing-quarter="${q.name}" points="${q.points.map(p=>p.join(',')).join(' ')}"/>`).join(''):c.segments.map(points=>`<path class="switch-connection" d="${dpath(points)}"/>`).join('')}</g>`;
 const drawn=new Set();
 const svg=diamonds.map(d=>`<g data-crossing-diamond="${d.id}" data-crossing-centre="${d.point.join(',')}" aria-label="건넘선 ${d.id} 교차부"><title>${d.id} · 4분할 교차부</title>${d.members.filter(id=>!drawn.has(id)).map(id=>{drawn.add(id);return connection(connectors.find(c=>c.id===id));}).join('')}</g>`).join('')+connectors.filter(c=>!drawn.has(c.id)).map(connection).join('');
 const metadata=states.map(s=>`<g data-switch-geometry="${s.id}" data-position="${s.position}" data-locked="${s.locked}" data-connected="${s.connected}" data-switch-kind="${s.kind}"><title>${s.id} ${s.position==='R'?'반위 · 분기 연결':'정위 · 직선 연결'}${s.locked?' · 쇄정':''}</title></g>`).join('');
 const paint=connectors.map(c=>c.quarters?c.quarters.map(q=>`<polygon points="${q.points.map(p=>p.join(',')).join(' ')}" fill="white" stroke="none"/>`).join(''):c.segments.map(points=>`<path d="${dpath(points)}"/>`).join('')).join('');
 const bridges=diamonds.map(d=>`<rect x="${d.point[0]-SLOT/2}" y="${d.point[1]-BAR}" width="${SLOT}" height="${BAR*2}" fill="white" stroke="none"/><rect x="${d.point[0]-BAR}" y="${d.point[1]-SLOT/2}" width="${BAR*2}" height="${SLOT}" fill="white" stroke="none"/>`).join('');
 return {mask,maskId,svg,metadata,states,cuts,connectors,diamonds,paint,bridges};
}
const api={build,intersection,splitLine};if(typeof module!=='undefined')module.exports=api;else root.SimLSSwitches=api;
})(typeof window!=='undefined'?window:globalThis);

(function(root){'use strict';
// Layout constraints join horizontal display runs across station boundaries.
// This does not alter the simulation graph or create physical track connections.
let cached;
function build(){
 if(cached)return cached;
 const node=typeof module!=='undefined',N=node?require('../engine/network'):root.SimNetwork,W=node?require('../engine/wiring').data:root.SimWiring.data,G=node?require('../engine/track-geometry'):root.SimTrackGeometry,S=node?require('./ls-seams'):root.SimLSSeams;
 const stations=N.stations.filter(s=>s.controlled),byStation={},all=[],parents=[];
 const find=i=>parents[i]===i?i:(parents[i]=find(parents[i])),join=(a,b)=>{parents[find(a)]=find(b);};
 for(const st of stations){
  const def=W[st.id],scene=G.sceneOf(st),segments=[],rows=[];
  const row=y=>{const near=rows.filter(r=>Math.abs(r-y)<6).sort((a,b)=>Math.abs(a-y)-Math.abs(b-y))[0];if(near!==undefined)return near;rows.push(y);return y;};
  for(const poly of [...def.rails.map(r=>r[1]),...(scene.joins||[])])for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i];if(Math.abs(a[1]-b[1])<2)segments.push({left:Math.min(a[0],b[0]),right:Math.max(a[0],b[0]),y:row(a[1])});}
  for(const [x,y,width,label]of scene.cells)if(label)segments.push({left:x,right:x+width,y:row(y)});
  const runs=[];for(const y of rows){const spans=segments.filter(s=>s.y===y).sort((a,b)=>a.left-b.left);for(const span of spans){const last=runs.at(-1);if(last&&last.y===y&&span.left<=last.right+12)last.right=Math.max(last.right,span.right);else runs.push({...span});}}
  for(const run of runs){run.id=all.length;parents.push(run.id);all.push(run);}
  const ports=S.ports(st,def,scene);for(const port of ports){const run=runs.filter(r=>Math.abs(r.y-port.y)<6&&port.x>=r.left-14&&port.x<=r.right+14).sort((a,b)=>Math.abs(a.y-port.y)-Math.abs(b.y-port.y))[0];if(!run)throw new Error('Missing display port '+st.id+' '+port.code);port.node=run.id;port.y=run.y;}
  byStation[st.id]={runs,ports};
 }
 for(let i=1;i<stations.length;i++){const a=byStation[stations[i-1].id].ports.filter(p=>p.side==='right'),b=byStation[stations[i].id].ports.filter(p=>p.side==='left');for(const p of a){const q=b.find(q=>q.trunk===p.trunk);if(q)join(p.node,q.node);}}
 const edges=new Map(),incoming=new Map(),levels=new Map();for(const run of all){const id=find(run.id);edges.set(id,new Set());incoming.set(id,0);levels.set(id,0);}
 for(const {runs}of Object.values(byStation))for(const a of runs)for(const b of runs){if(b.y<=a.y+6||Math.min(a.right,b.right)-Math.max(a.left,b.left)<8)continue;const from=find(a.id),to=find(b.id);if(from===to)throw new Error('Conflicting display rows');if(!edges.get(from).has(to)){edges.get(from).add(to);incoming.set(to,incoming.get(to)+1);}}
 const queue=[...incoming.keys()].filter(id=>incoming.get(id)===0);let visited=0;
 for(let i=0;i<queue.length;i++){const from=queue[i];visited++;for(const to of edges.get(from)){levels.set(to,Math.max(levels.get(to),levels.get(from)+1));incoming.set(to,incoming.get(to)-1);if(incoming.get(to)===0)queue.push(to);}}
 if(visited!==edges.size)throw new Error('Display row constraints form a cycle');
 // Compact slack rows against their successors; boundary components remain shared.
 for(let i=queue.length-1;i>=0;i--){const id=queue[i],next=[...edges.get(id)];if(next.length)levels.set(id,Math.min(...next.map(to=>levels.get(to)))-1);}
 const depth=Math.max(...levels.values());for(const run of all)run.level=levels.get(find(run.id));for(const {ports}of Object.values(byStation))for(const port of ports)port.level=levels.get(find(port.node));
 return cached={byStation,depth,components:edges.size};
}
function forStation(id,height){
 const graph=build(),data=graph.byStation[id],top=100,bottom=100,gap=(height-top-bottom)/Math.max(1,graph.depth),ys=[...new Set(data.runs.map(r=>r.y))].sort((a,b)=>a-b),pitch=Math.min(...ys.slice(1).map((y,i)=>y-ys[i]).filter(v=>v>20),51),sy=gap/pitch;
 const yAt=(x,y)=>{
  const covering=data.runs.filter(r=>x>=r.left-1&&x<=r.right+1),runs=covering.length?covering:data.runs;
  const near=runs.filter(r=>Math.abs(r.y-y)<6).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];if(near&&Math.abs(near.y-y)<2)return top+near.level*gap;
  const above=runs.filter(r=>r.y<=y).sort((a,b)=>b.y-a.y)[0],below=runs.filter(r=>r.y>y).sort((a,b)=>a.y-b.y)[0];
  if(above&&below&&below.y>above.y)return top+(above.level+(y-above.y)*(below.level-above.level)/(below.y-above.y))*gap;
  const anchor=above||below;return top+anchor.level*gap+(y-anchor.y)*sy;
 };
 return {H:height,sy,yAt,ports:data.ports.map(p=>({...p,lane:(top+p.level*gap)/height}))};
}
const api={build,forStation};if(typeof module!=='undefined')module.exports=api;else root.SimLSAlignment=api;
})(typeof globalThis!=='undefined'?globalThis:this);

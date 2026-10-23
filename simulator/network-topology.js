/* One composite network: the line spine owns all stops, each interlocking owns its native track graph.
   Inter-station edges express known station order, not unprovided physical block/interlocking tables. */
(function(root){'use strict';
const node=typeof module!=='undefined',N=node?require('./network'):root.SimNetwork,L=node?require('./line'):root.SimLine;
const spine=N.stations.map(s=>({id:s.id,name:s.name,order:s.order,controlled:s.controlled}));
const segments=spine.slice(1).map((s,i)=>({id:`line:${spine[i].id}:${s.id}`,from:spine[i].id,to:s.id,kind:'interstation',source:'배선도 교육 범위의 역 순서'}));
const locals=Object.fromEntries(N.stations.filter(s=>s.controlled).map(s=>[s.id,s.topology]));
const ports=Object.entries(locals).flatMap(([station,g])=>g.ports.map(p=>({...p,id:`${station}:port:${p.rail}:${p.side}`,station,kind:/^B\d+T/.test(p.code)?'line-boundary':'branch-boundary'})));
function path(from,to){
 const a=spine.findIndex(s=>s.id===from),b=spine.findIndex(s=>s.id===to);if(a<0||b<0)return null;
 const stops=spine.slice(Math.min(a,b),Math.max(a,b)+1).map(s=>s.id);if(a>b)stops.reverse();
 return {from,to,direction:a<=b?'down':'up',stations:stops,segments:stops.slice(1).map((s,i)=>segments[Math.min(N.catalog[s].order,N.catalog[stops[i]].order)].id)};
}
function localPath(station,route){
 const s=N.catalog[station],r=s?.routes[route];if(!r)return null;
 const def=node?require('./wiring').data[station]:root.SimWiring.data[station],sig=def.signals.find(x=>x[0]===r.signal);
 const start=s.topology.nodes.find(n=>n.rail===sig[1]&&Math.abs(n.point[0]-sig[2])<.001);let cursor=start?.id;
 const nodes=[cursor];let contiguous=!!cursor;
 for(const resource of r.resources){const edge=s.topology.edges.find(e=>e.resource===resource);if(!edge||(edge.a!==cursor&&edge.b!==cursor)){contiguous=false;break;}cursor=edge.a===cursor?edge.b:edge.a;nodes.push(cursor);}
 return {station,route,nodes,contiguous,resources:[...r.resources],points:{...r.pointPositions}};
}
function audit(){
 const issues=[],inferredCompositeRoutes=[];let nodes=0,edges=0,routes=0;
 for(const [station,g]of Object.entries(locals)){
  const ids=new Set(g.nodes.map(n=>n.id)),resources=new Set(g.edges.map(e=>e.resource));nodes+=ids.size;edges+=g.edges.length;
  for(const e of g.edges)if(!ids.has(e.a)||!ids.has(e.b))issues.push(station+' missing edge endpoint '+e.id);
  for(const [id,r]of Object.entries(N.catalog[station].routes)){routes++;if(r.resources.some(e=>!resources.has(e)))issues.push(station+' route resource missing '+id);if(r.resourceModel==='conservative-composite')inferredCompositeRoutes.push({station,route:id,note:r.evidence});else if(!localPath(station,id).contiguous)issues.push(station+' disconnected route '+id);}
  for(const p of g.ports)if(!ids.has(p.node))issues.push(station+' missing boundary '+p.code);
 }
 return {stations:spine.length,controlled:Object.keys(locals).length,segments:segments.length,nodes,edges,routes,branchBoundaries:ports.filter(p=>p.kind==='branch-boundary').length,inferredCompositeRoutes,issues};
}
const api={spine,segments,locals,ports,trunks:L.line.stations,sections:L.line.sections,path,localPath,audit};
if(node)module.exports=api;else root.SimNetworkTopology=api;
})(typeof window!=='undefined'?window:globalThis);

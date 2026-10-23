(function(root){'use strict';
const W=typeof module!=='undefined'?require('./wiring'):root.SimWiring,I=typeof module!=='undefined'?require('./wings'):root.SimWings,cache=new Map();
function at(rail,x){for(let i=1;i<rail[1].length;i++){const a=rail[1][i-1],b=rail[1][i];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&a[0]!==b[0])return [x,a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])];}return rail[1][0];}
function forStation(id){
 if(cache.has(id))return cache.get(id);const def=W.data[id],inventory=I[id],parts={},labels=[];if(!def||!inventory)return {parts,labels};
 // The old geometric link IDs are transposed relative to the source inscriptions at these crossovers.
 const sourceGroups=id==='geumcheon'||id==='uiwang'?{'51':'52','52':'51'}:{};
 const endpoints=def.links.map(([group,a,x,b,z])=>({group,ends:[at(def.rails.find(r=>r[0]===a),x),at(def.rails.find(r=>r[0]===b),z)]}));
 for(const [x,y,part]of inventory.labels.filter(p=>/^\d{2}[AB]$/.test(p[2]))){const matches=endpoints.flatMap(link=>link.ends.map((p,index)=>({link,index,distance:Math.hypot(x-p[0],y-p[1])}))).sort((a,b)=>a.distance-b.distance),best=matches[0],group=sourceGroups[part.slice(0,-1)]||best?.link.group;if(!group||(!sourceGroups[part.slice(0,-1)]&&best.distance>42))continue;parts[part]=group;labels.push({part,group,x,y});}
 // Both lower labels are visible in the user's Geumcheon photograph, but absent from the old text extraction.
 if(id==='geumcheon')for(const part of ['51A','52B']){const group=parts[part],link=endpoints.find(e=>e.group===group),seen=labels.find(p=>p.part===part);if(!link||!seen)continue;const near=link.ends.map(p=>Math.hypot(p[0]-seen.x,p[1]-seen.y)),opposite=near[0]<near[1]?link.ends[1]:link.ends[0],mate=part.slice(0,-1)+(part.endsWith('A')?'B':'A');parts[mate]=group;labels.push({part:mate,group,x:opposite[0],y:opposite[1]+16});}
 const result={parts,labels};cache.set(id,result);return result;
}
const api={forStation};if(typeof module!=='undefined')module.exports=api;else root.SimPointParts=api;
})(typeof globalThis!=='undefined'?globalThis:this);

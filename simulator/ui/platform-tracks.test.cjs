'use strict';
// Every scheduled EMU stop must be on a track served by a high (yellow) platform when the LS draws platforms beside that track.
const {test}=require('node:test'),assert=require('node:assert/strict');
const LS=require('./ls-view'),N=require('../engine/network'),W=require('../engine/wiring').data,T=require('../engine/timetable'),P=require('../engine/platforms');
const yAt=(poly,x)=>{for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i];if(a[0]!==b[0]&&x>=Math.min(a[0],b[0])-1&&x<=Math.max(a[0],b[0])+1)return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return null;};
// A platform glyph serves the nearest track above and below it (island) within one track pitch.
function servedHeights(stationId){const st=N.catalog[stationId],def=W[stationId],out={};
 for(const p of LS.wingOf(st,def).platforms){const cx=(p[0]+p[2])/2,cy=(p[1]+p[3])/2,rows=def.rails.map(r=>({id:r[0],y:yAt(r[1],cx)})).filter(r=>r.y!==null);
  for(const r of [rows.filter(r=>r.y<=cy).sort((a,b)=>b.y-a.y)[0],rows.filter(r=>r.y>cy).sort((a,b)=>a.y-b.y)[0]])if(r&&Math.abs(r.y-cy)<45)(out[r.id]=out[r.id]||new Set()).add(P.describe(p[4]).height);}
 return out;}
test('scheduled stopping tracks match the boarding height of the train class',()=>{
 const m=T.initial(),bad=[];let checked=0;
 for(const t of m.trains)for(const c of t.plan){if(c.stopType!=='정차'||!c.arrivalRoute)continue;const track=c.arrivalRoute.split('_')[1],served=W[c.station]&&servedHeights(c.station)[track];if(!served)continue;checked++;
  const need=P.boardingOf(t);if(need==='high'||need==='low'){if(!served.has(need))bad.push(t.id+' '+c.station+' '+c.arrivalRoute);}}
 assert.deepEqual(bad,[]);assert.ok(checked>50,checked);
});

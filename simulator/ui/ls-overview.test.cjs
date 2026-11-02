'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../engine/network'),C=require('../engine/core'),O=require('./ls-overview');
const stations=N.stations.filter(s=>s.controlled),states=Object.fromEntries(stations.map(s=>[s.id,C.forStation(s.id).initial()]));
test('continuous overview uses native source scale, correct boundary families and all 18 station/corridor targets',()=>{
 const before=structuredClone(states),v=O.build(stations.map(s=>s.id),states);assert.deepEqual(states,before);assert.equal(v.panels.length,15);assert.equal(v.joins.length,40);assert.equal([...v.svg.matchAll(/data-overview-station="/g)].length,18);assert(!v.svg.includes('${'));assert(!/NaN|undefined/.test(v.svg));
 for(const p of v.panels){const a=p.view.sourcePoint([200,200]),b=p.view.sourcePoint([300,300]);assert.deepEqual(b.map((n,i)=>+(n-a[i]).toFixed(2)),[100,100]);assert(p.view.width>=p.width);}
 for(const j of v.joins){const a=v.panels.find(p=>p.id===j.fromStation),b=v.panels.find(p=>p.id===j.toStation),pa=a.ports.find(p=>p.side==='right'&&p.key===j.trunk),pb=b.ports.find(p=>p.side==='left'&&p.key===j.trunk);assert(pa&&pb);assert(Math.hypot(j.from[0]-a.x-pa.at[0]*a.scale,j.from[1]-a.y-pa.at[1]*a.scale)<1e-7);assert(Math.hypot(j.to[0]-b.x-pb.at[0]*b.scale,j.to[1]-b.y-pb.at[1]*b.scale)<1e-7);for(let i=1;i<j.points.length;i++)assert(j.points[i][0]===j.points[i-1][0]||j.points[i][1]===j.points[i-1][1]);}
});
test('photo regions have the exact station ranges and row breaks, fill each row and center vertically',()=>{
 const expected=[['north',[5,3],8,16],['south',[4,3],10,20],['central',[4],4,12]];
 for(const [key,lengths,targets,links]of expected){
  const region=O.REGIONS.find(r=>r.id===key),v=O.build(region.rows.flat(),states,{}, {aspect:1.6});
  assert.equal(v.region,key);assert.deepEqual(v.rows.map(r=>r.panels.length),lengths);assert.deepEqual(v.rows.map(r=>r.panels.map(p=>p.id)),region.rows);
  assert.equal([...v.svg.matchAll(/data-overview-station="/g)].length,targets);assert.equal(v.joins.length,links);
  for(const row of v.rows){const first=row.panels[0],last=row.panels.at(-1);assert.equal(first.x,60);assert(Math.abs(last.x+last.width*last.scale-(v.width-60))<1e-7);assert(row.y>=0&&row.y+row.height<=v.height);}
  const first=v.rows[0],last=v.rows.at(-1);assert(Math.abs(first.y-(v.height-last.y-last.height))<1e-7);
  const ids=[...v.svg.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of v.svg.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(m[1]),m[1]);
 }
});

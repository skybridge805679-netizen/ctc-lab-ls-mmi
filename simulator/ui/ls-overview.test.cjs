'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),N=require('../engine/network'),C=require('../engine/core'),O=require('./ls-overview');
const stations=N.stations.filter(s=>s.controlled),states=Object.fromEntries(stations.map(s=>[s.id,C.forStation(s.id).initial()]));
test('continuous overview uses native source scale, correct boundary families and all 18 station/corridor targets',()=>{
 const before=structuredClone(states),v=O.build(stations.map(s=>s.id),states);assert.deepEqual(states,before);assert.equal(v.panels.length,15);assert.equal(v.joins.length,40);assert.equal([...v.svg.matchAll(/data-overview-station="/g)].length,18);assert(!v.svg.includes('${'));assert(!/NaN|undefined/.test(v.svg));
 for(const p of v.panels){const a=p.view.sourcePoint([200,200]),b=p.view.sourcePoint([300,300]);assert.deepEqual(b.map((n,i)=>+(n-a[i]).toFixed(2)),[100,100]);assert(p.view.width>=p.width);}
 for(const j of v.joins){const a=v.panels.find(p=>p.id===j.fromStation),b=v.panels.find(p=>p.id===j.toStation),pa=a.ports.find(p=>p.side==='right'&&p.key===j.trunk),pb=b.ports.find(p=>p.side==='left'&&p.key===j.trunk);assert(pa&&pb);assert(Math.hypot(j.from[0]-a.x-pa.at[0],j.from[1]-a.y-pa.at[1])<1e-7);assert(Math.hypot(j.to[0]-b.x-pb.at[0],j.to[1]-b.y-pb.at[1])<1e-7);for(let i=1;i<j.points.length;i++)assert(j.points[i][0]===j.points[i-1][0]||j.points[i][1]===j.points[i-1][1]);}
});
test('each original regional overview remains a continuous row and its SVG references are scoped',()=>{
 for(let start=0;start<15;start+=5){const v=O.build(stations.slice(start,start+5).map(s=>s.id),states);assert.equal(v.panels.length,5);assert.equal(v.joins.length,start===0?8:16);const ids=[...v.svg.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of v.svg.matchAll(/url\(#([^)]*)\)/g))assert(ids.includes(m[1]),m[1]);}
});

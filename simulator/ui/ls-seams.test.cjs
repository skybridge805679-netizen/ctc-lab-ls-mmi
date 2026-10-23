'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('./ls-seams'),LS=require('./ls-view'),A=require('./ls-alignment'),N=require('../engine/network'),W=require('../engine/wiring').data,C=require('../engine/core');
const stations=N.stations.filter(s=>s.controlled),ports=Object.fromEntries(stations.map(st=>[st.id,A.forStation(st.id,900).ports]));
test('all neighboring display ports align by real trunk identity and retain natural line order changes',()=>{
 for(let i=1;i<stations.length;i++){const a=ports[stations[i-1].id].filter(p=>p.side==='right'),b=ports[stations[i].id].filter(p=>p.side==='left');for(const p of a){const q=b.find(q=>q.trunk===p.trunk);assert.ok(q,p.trunk);assert.equal(p.lane,q.lane,stations[i-1].id+' '+stations[i].id+' '+p.trunk);}}
 assert.ok(ports.guro.find(p=>p.trunk==='ED'&&p.side==='left').lane>ports.guro.find(p=>p.trunk==='GD'&&p.side==='left').lane);
 assert.ok(ports.guro.find(p=>p.trunk==='ED'&&p.side==='right').lane<ports.guro.find(p=>p.trunk==='GD'&&p.side==='right').lane);
 assert.deepEqual(ports.geumjeong.filter(p=>p.side==='right').map(p=>p.trunk).sort(),['ED','EU','GD','GU']);
 assert.ok(!ports.geumcheon.some(p=>p.code==='B1T'||p.trunk==='MU'));
});
test('seam rendering preserves engine state and identifiers, and never adds curved track geometry',()=>{
 for(const st of stations){const core=C.forStation(st.id),state=core.initial(),before=structuredClone(state),view=LS.render(st,W[st.id],core,state,{aspect:16/9});assert.deepEqual(state,before);assert.equal(view.height,900);assert.ok(!/NaN|undefined/.test(view.svg));const seam=view.svg.match(/<g class="screen-continuations"[^]*?<\/g>/)?.[0]||'';assert.ok(!/d="[^"]*[CQ]/.test(seam));for(const path of view.svg.matchAll(/class="seam-rail" d="([^"]+)"/g)){const values=path[1].match(/-?\d+(?:\.\d+)?/g).map(Number);assert.equal(values.length,4,'no added bends at the boundary');assert.equal(values[1],values[3],'boundary continuation is horizontal');}for(const p of ports[st.id])assert.ok(view.svg.includes('data-seam-code="'+p.code+'"'));}
});
test('display continuation inherits occupation of its real boundary circuit',()=>{const st=N.catalog.guro,core=C.forStation(st.id),state=core.initial(),view=LS.render(st,W.guro,core,state,{aspect:16/9,occupied:new Set(['B964T'])});assert.match(view.svg,/class="seam-link occupied"[^>]*data-seam-code="B964T"/);});

test('the shared row constraint layout keeps each original horizontal run horizontal',()=>{const graph=A.build();for(const st of stations){const layout=A.forStation(st.id,900);for(const run of graph.byStation[st.id].runs){const width=run.right-run.left;if(width<3)continue;const ys=[.1,.5,.9].map(f=>layout.yAt(run.left+width*f,run.y));assert.ok(ys.every(y=>Math.abs(y-ys[0])<.001),st.id+' '+JSON.stringify(run));}}});

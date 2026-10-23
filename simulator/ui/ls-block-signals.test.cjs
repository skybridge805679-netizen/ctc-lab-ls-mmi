'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const inventory=require('../engine/block-signals'),N=require('../engine/network'),W=require('../engine/wiring').data,C=require('../engine/core'),LS=require('./ls-view');
const source=require('../../references/transcriptions/block-signals.json');
test('block identifiers retain reviewed PPT evidence, including supplemental intermediate-station slides',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../..',source.source))).digest('hex'),source.sha256);
 assert.equal(source.indicators.length,274);assert.equal(new Set(source.indicators.map(r=>r.id)).size,274);
 assert.ok([13,16,18].every(slide=>source.indicators.some(r=>r.slide===slide)));
 for(const r of source.indicators){assert.equal(r.reviewed,true);assert.equal(r.sourceSymbol.length,4);assert.ok(r.number>0);const item=inventory[r.station].find(i=>i.id===r.id);assert.equal(item.number,r.number);assert.equal(item.code,r.code);}
});
test('all 15 stations render every numbered block without changing authoritative route and point state',()=>{
 for(const st of N.stations.filter(s=>s.controlled)){
  const core=C.forStation(st.id),state=core.initial(),before=structuredClone(state),v=LS.render(st,W[st.id],core,state,{aspect:16/9});
  assert.deepEqual(state,before);assert.equal([...v.svg.matchAll(/data-source-symbol="block-number"/g)].length,inventory[st.id].length);
  assert.ok(!v.svg.includes('data-source-symbol="capsule"'));
  for(const item of inventory[st.id])assert.ok(v.svg.includes('data-block-id="'+item.id+'"'));
 }
});
test('source block numbers remain independent of circuit suffixes and circuit numbering direction',()=>{
 const get=(st,code)=>inventory[st].find(r=>r.code===code).number;
 assert.equal(get('guro','B952T'),8);assert.equal(get('guro','B964T'),2);assert.equal(get('guro','B953T'),2);
 assert.equal(get('uiwang','B1016T'),11);assert.equal(get('uiwang','B1034T'),2);assert.equal(get('uiwang','B1031T'),10);
 assert.equal(get('suwon','B1033T'),11);
});

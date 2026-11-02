'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../engine/network'),C=require('../engine/core'),W=require('../engine/wiring'),LS=require('./ls-view'),R=require('./circuit-label-review'),O=require('./ls-overview'),proof=require('../../references/transcriptions/yongsan-circuit-labels.json');
const labels=svg=>[...svg.matchAll(/<text[^>]*data-circuit-label="([^"]+)"[^>]*>([^<]+)<\/text>/g)].map(m=>{assert.equal(m[1],m[2]);return m[1];});
test('Yongsan renders all 55 source-reviewed circuit names exactly once, including OCR blanks and merged names',()=>{
 assert.equal(proof.rows.flat().length,55);assert.deepEqual(R.corrections.yongsan,proof.corrections);
 const st=N.catalog.yongsan,source=structuredClone(LS.sceneOf(st)),core=C.forStation(st.id);
 for(const fix of proof.corrections)assert.equal(source.cells.filter(c=>c.slice(0,4).every((v,i)=>v===fix[i])).length,1,'review anchor '+fix[4]);
 for(const position of ['N','R'])for(const overview of [false,true]){
  const state=core.initial();for(const id of Object.keys(state.points))state.points[id]=position;const before=structuredClone(state);
  const view=LS.render(st,W.data[st.id],core,state,{overview});
  assert.deepEqual(labels(view.svg).sort(),proof.rows.flat().sort(),position+' overview='+overview);assert.deepEqual(state,before);
 }
 assert.deepEqual(LS.sceneOf(st),source,'display corrections do not change engine circuit names');
});
test('both complete and Cheongnyangni–Yeongdeungpo overviews retain every Yongsan label',()=>{
 const states=Object.fromEntries(N.stations.filter(s=>s.controlled).map(s=>[s.id,C.forStation(s.id).initial()]));
 for(const ids of [Object.keys(states),O.REGIONS.find(r=>r.id==='north').rows.flat()]){
  const v=O.build(ids,states),panel=v.panels.find(p=>p.id==='yongsan');assert.deepEqual(labels(panel.view.svg).sort(),proof.rows.flat().sort());
 }
});
const inventory=require('../../references/transcriptions/circuit-label-review.json'),Presets=require('./ls-presets');
const expectedFor=preset=>{
 const monitor=inventory.corridors[preset.id];if(monitor)return monitor.rows.flat();
 const p=inventory.stations[preset.station];return [...p.coreLabels,...p.blockLabels.filter(code=>Presets.circuitView(preset.station,code)===preset.id)];
};
test('all 15 source inventories and correction anchors are complete, and rendering preserves engine cells',()=>{
 assert.equal(Object.keys(inventory.stations).length,15);
 for(const [id,p]of Object.entries(inventory.stations)){
  assert.equal(new Set([...p.coreLabels,...p.blockLabels]).size,p.coreLabels.length+p.blockLabels.length,id+' duplicate inventory');
  assert.deepEqual(R.corrections[id]||[],p.corrections,id);assert.deepEqual(R.additionalLabels[id]||[],p.additionalLabels||[],id);
  const source=structuredClone(LS.sceneOf(N.catalog[id]));assert.equal(p.blankCellReview.length,source.cells.filter(c=>!c[3]).length,id);
  for(const fix of p.corrections)assert.equal(source.cells.filter(c=>c.every((v,i)=>v===fix[i])).length,1,id+' correction anchor '+fix[4]);
  const core=C.forStation(id);for(const overview of [false,true]){
   const actual=labels(LS.render(N.catalog[id],W.data[id],core,core.initial(),{overview}).svg);
   assert.deepEqual(actual.sort(),[...p.coreLabels,...p.blockLabels].sort(),id+' source labels, overview='+overview);
  }
  assert.deepEqual(LS.sceneOf(N.catalog[id]),source,id+' engine cells preserved');
 }
});
test('every detailed station and all three corridor views match the independent source inventory in N and R',()=>{
 assert.equal(Presets.list().length,18);assert.equal(Object.keys(inventory.corridors).length,3);
 for(const preset of Presets.list())for(const pos of ['N','R']){
  const st=N.catalog[preset.station],core=C.forStation(st.id),state=core.initial();for(const id of Object.keys(state.points))state.points[id]=pos;
  const view=LS.render(st,W.data[st.id],core,state,{preset:preset.id});assert.deepEqual(labels(view.svg).sort(),expectedFor(preset).sort(),preset.id+' '+pos);
 }
});
test('every panel in all four overview choices preserves its station source inventory',()=>{
 const states=Object.fromEntries(Object.keys(inventory.stations).map(id=>[id,C.forStation(id).initial()]));
 for(const ids of [Object.keys(states),...O.REGIONS.map(r=>r.rows.flat())])for(const panel of O.build(ids,states).panels){
  const p=inventory.stations[panel.id];assert.deepEqual(labels(panel.view.svg).sort(),[...p.coreLabels,...p.blockLabels].sort(),panel.id);
 }
});

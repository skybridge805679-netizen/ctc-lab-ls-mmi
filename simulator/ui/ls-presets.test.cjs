'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('./ls-presets'),LS=require('./ls-view'),N=require('../engine/network'),W=require('../engine/wiring').data,C=require('../engine/core');
const core=C.forStation('uiwang'),initial=core.initial();
const view=preset=>LS.render(N.catalog.uiwang,W.uiwang,core,initial,{preset,aspect:16/9});
const attrs=(v,name)=>[...v.svg.matchAll(new RegExp(name+'="([^"]+)"','g'))].map(m=>m[1]);
test('the corridor is a display preset between Uiwang and Suwon, retaining only 15 control stations',()=>{
 assert.equal(V.list().length,16);assert.equal(N.stations.filter(s=>s.controlled).length,15);
 const i=V.list().findIndex(v=>v.id==='uiwang');assert.deepEqual(V.list().slice(i,i+3).map(v=>v.id),['uiwang','uiwang-suwon','suwon']);assert.equal(V.get('uiwang-suwon').station,'uiwang');assert.equal(V.get('uiwang-suwon').monitor,true);
});
test('splitting Uiwang preserves every circuit, block number and train slot exactly once across both presets',()=>{
 const all=view(''),main=view('uiwang'),corridor=view('uiwang-suwon');
 for(const name of ['data-train-slot','data-block-id','data-track-circuit']){
  const original=attrs(all,name).filter(Boolean),a=attrs(main,name).filter(Boolean),b=attrs(corridor,name).filter(Boolean);
  assert.deepEqual([...a,...b].sort(),original.sort(),name);assert.ok(!a.some(x=>b.includes(x)),name+' duplicated');
 }
 assert.ok(!main.svg.includes('성균관대'));assert.ok(!main.svg.includes('화서'));assert.ok(corridor.svg.includes('성균관대'));assert.ok(corridor.svg.includes('화서'));
 assert.equal(attrs(corridor,'data-signal').length,0);assert.equal(attrs(corridor,'data-point-control').length,0);assert.equal(attrs(main,'data-signal').length,W.uiwang.signals.length);
});
test('main-station layout enlarges Uiwang without changing engine state or drawing remote locked routes on the corridor',()=>{
 const all=view(''),main=view('uiwang');
 const x=id=>Number(all.svg.match(new RegExp('data-signal-view="'+id+'" data-anchor-x="([^"]+)'))[1]);
 const larger=Number(main.svg.match(/data-signal-view="4A" data-anchor-x="([^"]+)"/)[1]);assert.ok(larger>x('4A')*1.2);
 const before=structuredClone(initial);view('uiwang-suwon');assert.deepEqual(initial,before);
 const state=core.initial();core.dispatch(state,{type:'mode',value:'CCM'});const route=Object.keys(core.routes).find(id=>core.dispatch(structuredClone(state),{type:'route',id}).ok);core.dispatch(state,{type:'route',id:route});const frozen=structuredClone(state);const corridor=LS.render(N.catalog.uiwang,W.uiwang,core,state,{preset:'uiwang-suwon',aspect:16/9});assert.ok(!corridor.svg.includes('data-active-route'));assert.deepEqual(state,frozen);
});

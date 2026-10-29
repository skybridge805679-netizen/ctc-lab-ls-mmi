'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('./ls-presets'),LS=require('./ls-view'),N=require('../engine/network'),W=require('../engine/wiring').data,C=require('../engine/core');
const core=C.forStation('uiwang'),initial=core.initial();
const view=preset=>LS.render(N.catalog.uiwang,W.uiwang,core,initial,{preset,aspect:16/9});
const attrs=(v,name)=>[...v.svg.matchAll(new RegExp(name+'="([^"]+)"','g'))].map(m=>m[1]);
test('three interstation monitors sit between their stations, retaining only 15 control stations',()=>{
 assert.equal(V.list().length,18);
 const ids=V.list().map(v=>v.id);for(const [a,c,b] of [['anyang','anyang-geumjeong','geumjeong'],['gunpo','gunpo-uiwang','uiwang']]){const i=ids.indexOf(a);assert.deepEqual(ids.slice(i,i+3),[a,c,b]);assert.equal(V.get(c).monitor,true);assert.equal(V.get(c).station,a);}
 assert.deepEqual(V.get('anyang-geumjeong').plates,['명학']);assert.deepEqual(V.get('gunpo-uiwang').plates,['당정']);
 assert.deepEqual(V.neighbours('anyang-geumjeong').left.id,'anyang');assert.deepEqual(V.neighbours('anyang').right.id,'anyang-geumjeong');assert.equal(N.stations.filter(s=>s.controlled).length,15);
 const i=V.list().findIndex(v=>v.id==='uiwang');assert.deepEqual(V.list().slice(i,i+3).map(v=>v.id),['uiwang','uiwang-suwon','suwon']);assert.equal(V.get('uiwang-suwon').station,'uiwang');assert.equal(V.get('uiwang-suwon').monitor,true);
});
test('split presets retain every train slot and block number; handoff circuits remain visible at Suwon',()=>{
 const all=view(''),main=view('uiwang'),corridor=view('uiwang-suwon');
 for(const name of ['data-train-slot','data-block-id','data-track-circuit']){
  let original=attrs(all,name).filter(Boolean);const a=attrs(main,name).filter(Boolean),b=attrs(corridor,name).filter(Boolean);if(name==='data-track-circuit'){const handoff=require('./ls-corridor-source')['18'].handoff,suwon=C.forStation('suwon'),v=LS.render(N.catalog.suwon,W.suwon,suwon,suwon.initial());for(const code of handoff)assert.ok(v.svg.includes('data-circuit-label="'+code+'"'),'Suwon retains '+code);original=original.filter(code=>!handoff.includes(code));}
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
test('Anyang~Geumjeong and Gunpo~Uiwang monitors take their circuits out of the station screens (PPT slides 13 and 16)',()=>{
 for(const [station,preset,codes,plate] of [['anyang','anyang-geumjeong',['B986T','B988T','B990T','B662T','B668T','B985T','B989T'],'명학'],['gunpo','gunpo-uiwang',['B1004T','B1010T','B682T','B688T','B677T','B1003T','B1009T'],'당정']]){
  const core=C.forStation(station),render=p=>LS.render(N.catalog[station],W[station],core,core.initial(),{preset:p,aspect:16/9});
  const main=render(station),monitor=render(preset);
  for(const code of codes){assert.ok(monitor.svg.includes('data-circuit-label="'+code+'"'),preset+' '+code);assert.ok(!main.svg.includes('data-circuit-label="'+code+'"'),station+' still draws '+code);}
  assert.ok(monitor.svg.includes(plate));assert.ok(!main.svg.includes('>'+plate+'<'));
  assert.equal(attrs(monitor,'data-signal').length,0);assert.equal(attrs(main,'data-signal').length,W[station].signals.length);
  assert.ok(monitor.svg.includes('data-nav-view="'+station+'"'),'yellow arrow back to '+station);
 }
});

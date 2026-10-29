'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Core=require('./core'),N=require('./network');
test('source A/B IDs dispatch to their physical pair at every controlled station',()=>{
 let count=0;for(const station of N.stations.filter(s=>s.controlled)){const C=Core.forStation(station.id);for(const [part,group]of Object.entries(C.pointParts)){const mate=part.slice(0,-1)+(part.endsWith('A')?'B':'A');if(C.pointParts[mate])assert.equal(C.pointParts[mate],group,station.id+' paired '+part);const state=C.initial();assert.equal(C.dispatch(state,{type:'point',id:part,value:'R'}).ok,false);C.dispatch(state,{type:'mode',value:'CCM'});assert.ok(C.dispatch(state,{type:'point',id:part,value:'R'}).ok,station.id+' '+part);assert.equal(state.points[group],'R');assert.ok(C.dispatch(state,{type:'point',id:part,value:'N'}).ok);assert.equal(state.points[group],'N');count++;}}assert.ok(count>80);console.log('source A/B controls',count);
});
test('Geumcheon 51A/B selects the ascending leg, and 52A/B selects the other leg',()=>{const C=Core.forStation('geumcheon');assert.equal(C.pointParts['51A'],C.pointParts['51B']);assert.equal(C.pointParts['52A'],C.pointParts['52B']);assert.equal(C.pointParts['51A'],'52');assert.equal(C.pointParts['52B'],'51');const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert.ok(C.dispatch(s,{type:'route',id:'4B-B968T'}).ok);assert.equal(C.dispatch(s,{type:'point',id:'51A',value:'R'}).ok,false);C.dispatch(s,{type:'stop',id:'4B'});C.dispatch(s,{type:'fault',kind:'point',id:'51B',on:true});assert.equal(C.dispatch(s,{type:'point',id:'51A',value:'R'}).ok,false);});

test('Uiwang paired source IDs retain both ends of each neighboring crossover',()=>{const C=Core.forStation('uiwang');assert.equal(C.pointParts['51A'],'52');assert.equal(C.pointParts['51B'],'52');assert.equal(C.pointParts['52A'],'51');assert.equal(C.pointParts['52B'],'51');});

test('every source crossover has both controllable A/B ends and all declared branch blades exist',()=>{
 const W=require('./wiring').data,survey=require('../../references/transcriptions/switch-survey.json');
 for(const [station,def]of Object.entries(W)){const C=Core.forStation(station);assert.deepEqual(Object.keys(C.points).sort(),survey.stations[station].groups);
  for(const [id]of def.links){const parts=Object.entries(C.pointParts).filter(([,group])=>group===id).map(([part])=>part);assert.equal(parts.length,2,station+' '+id+' both source ends');assert.deepEqual(parts.map(p=>p.slice(0,-1)),[parts[0].slice(0,-1),parts[0].slice(0,-1)]);}
  for(const id of new Set([...def.links.map(l=>l[0]),...def.rails.flatMap(r=>r[5]||[])]))assert(C.points[id],station+' source blade '+id+' lost from engine');
 }
});
test('reviewed scissors source IDs select the correct physical diagonal',()=>{
 for(const [station,parts]of Object.entries({cheongnyangni:{'51A':'52','52B':'51'},geumcheon:{'21A':'22','22A':'21'},seoul:{'58A':'59','59B':'58'}}))for(const [part,group]of Object.entries(parts)){const C=Core.forStation(station),s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'point',id:part,value:'R'}).ok);assert.equal(s.points[group],'R');for(const [other,value]of Object.entries(s.points))if(other!==group)assert.equal(value,'N');}
});
test('Guro 55 is a real selectable branch: N reaches the depot and R reaches B950T, with route and fault protection',()=>{
 const C=Core.forStation('guro');assert(C.points['55']);assert.equal(C.routes['4A-F1T'].pointPositions['55'],'N');assert.equal(C.routes['4A-F2T'].pointPositions['55'],'N');assert.equal(C.routes['4A-B950T'].pointPositions['55'],'R');
 for(const route of ['4A-F1T','4A-F2T','4A-B950T']){const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id:route}).ok);const before=s.points['55'];assert(!C.dispatch(s,{type:'point',id:'55',value:before==='R'?'N':'R'}).ok);assert.equal(s.points['55'],before);assert(C.dispatch(s,{type:'stop',id:'4A'}).ok);assert(C.dispatch(s,{type:'point',id:'55',value:before==='R'?'N':'R'}).ok);}
 const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'fault',kind:'point',id:'55',on:true});assert(!C.dispatch(s,{type:'point',id:'55',value:'R'}).ok);assert(!C.dispatch(s,{type:'route',id:'4A-B950T'}).ok);
});

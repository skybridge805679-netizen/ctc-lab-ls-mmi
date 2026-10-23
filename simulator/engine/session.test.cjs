'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('./session.js');
test('a session runs all 15 station clocks without a document or UI',()=>{
 const s=create();assert.equal(Object.keys(s.states).length,15);s.tick(90);
 assert.ok(Object.values(s.states).every(st=>st.clock===90));
 s.dispatch('anyang',{type:'mode',value:'CCM'});
 for(const id of ['4C-B660T','4A-B984T'])assert.equal(s.dispatch('anyang',{type:'route',id}).ok,true);
 assert.equal(Object.keys(s.states.anyang.routes).length,2);
 s.select('suwon');s.tick(30);assert.equal(s.state.clock,120);assert.equal(Object.keys(s.states.anyang.routes).length,2);
});
test('sessions isolate state and snapshots; core instances are reused',()=>{
 const a=create(),b=create();assert.equal(a.core('anyang'),a.core('anyang'));
 a.dispatch('anyang',{type:'mode',value:'CCM'});assert.equal(b.states.anyang.mode,'AUTO');
 const snapshot=a.snapshot();snapshot.stations.anyang.mode='LOCAL';assert.equal(a.states.anyang.mode,'CCM');
 assert.throws(()=>a.select('unknown'),RangeError);
});

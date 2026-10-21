const assert=require('node:assert/strict');
const C=require('./core.js');
const {tasks}=require('./practice.js');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
function session(actions){const s=C.initial();for(const a of actions)C.dispatch(s,{source:'LS',...a});return s;}
const mode={type:'mode',value:'CCM'};
const route={type:'route',id:'3A-B065T'};
const cancel={type:'cancel',target:'stop',id:'3A'};
const stop={type:'stop',id:'3A'};
const cycle=s=>tasks[8].check(s.events,s);
test('complete LS cycle passes only after release',()=>{
 const s=session([mode,route,cancel]);assert.equal(cycle(s),false);
 assert.equal(s.signals['3A'],'GO');
 assert.deepEqual(s.events.at(-1).activeRoutes,['3A-B065T']);
 C.dispatch(s,{...stop,source:'LS'});assert.equal(cycle(s),true);
 assert.deepEqual(s.events.at(-2).activeRoutes,['3A-B065T']);
});
test('missing, early, wrong-signal and wrong-dialog cancellation do not pass',()=>{
 for(const actions of [[mode,route,stop],[mode,cancel,route,stop],
  [mode,route,{...cancel,id:'1A'},stop],
  [mode,route,{...cancel,target:'mode'},stop]])assert.equal(cycle(session(actions)),false);
});
test('MMI actions cannot satisfy the LS cycle',()=>{
 for(const index of [1,2,3]){
  const actions=[mode,route,cancel,stop];actions[index]={...actions[index],source:'MMI'};
  assert.equal(cycle(session(actions)),false);
 }
});
test('rejected route commands and later reestablishment do not pass',()=>{
 assert.equal(cycle(session([route,mode,cancel,stop])),false);
 assert.equal(cycle(session([mode,route,cancel,stop,route])),false);
});
test('route comparison enforces the documented order and final route',()=>{
 const other={type:'route',id:'3A-B070T'};
 for(const release of [stop,{type:'withdraw',id:'3A-B070T'}]){
  const s=session([mode,other,release,route]);assert.equal(tasks[4].check(s.events,s),true);
 }
 for(const actions of [[mode,route,stop,other],[mode,other,stop,route,stop]]){
  const s=session(actions);assert.equal(tasks[4].check(s.events,s),false);
 }
});
test('approach-lock task needs a real lock, the timed release and a fresh route',()=>{
 const seq=[mode,{type:'route',id:'1A-1T'},{type:'approach',signal:'1A'},{type:'stop',id:'1A'}];
 const s=session(seq);assert.equal(tasks[9].check(s.events,s),false);
 C.dispatch(s,{type:'route',id:'1A-1T',source:'LS'});assert.equal(s.routes['1A-1T'].lock.seconds,90,'rejected while locked');
 C.dispatch(s,{type:'tick',seconds:90});assert.equal(tasks[9].check(s.events,s),false,'released but not re-set');
 C.dispatch(s,{type:'route',id:'1A-1T',source:'LS'});assert.equal(tasks[9].check(s.events,s),true);
 const plain=session([mode,{type:'route',id:'1A-1T'},{type:'stop',id:'1A'},{type:'route',id:'1A-1T'}]);
 assert.equal(tasks[9].check(plain.events,plain),false,'no approaching train means no lock to wait for');
});
console.log(count+' practice tests passed');

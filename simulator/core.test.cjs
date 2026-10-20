const assert=require('node:assert/strict');
const C=require('./core.js');let n=0;
function test(name,fn){fn();console.log('PASS '+name);n++;}
function ccm(){const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});return s;}
test('AUTO rejects route without mutation',()=>{const s=C.initial();assert.equal(C.dispatch(s,{type:'route',id:'3A-B065T'}).ok,false);assert.deepEqual(s.routes,{});});
test('every supported route sets and releases signal',()=>{for(const [id,r]of Object.entries(C.routes)){const s=ccm();assert(C.dispatch(s,{type:'route',id}).ok);assert.equal(s.signals[r.signal],'GO');assert(C.dispatch(s,{type:'withdraw',id}).ok);assert.equal(s.signals[r.signal],'STOP');assert.deepEqual(s.routes,{});}});
test('same signal and west crossover conflicts leave existing route intact',()=>{const s=ccm();C.dispatch(s,{type:'route',id:'3A-B065T'});for(const id of ['3A-B070T','1A-1T'])assert.equal(C.dispatch(s,{type:'route',id}).ok,false);assert.deepEqual(Object.keys(s.routes),['3A-B065T']);});
test('cancel and base scan preserve established route',()=>{const s=ccm();C.dispatch(s,{type:'route',id:'3A-B065T'});for(const a of [{type:'cancel'},{type:'scan',scope:'all'}])C.dispatch(s,a);assert.equal(s.signals['3A'],'GO');assert.equal(s.routes['3A-B065T'].status,'SET');});
test('stop releases only selected signal',()=>{const s=ccm();for(const id of ['3A-B065T','4A-B072T'])C.dispatch(s,{type:'route',id});C.dispatch(s,{type:'stop',id:'3A'});assert.deepEqual(Object.keys(s.routes),['4A-B072T']);assert.equal(s.signals['4A'],'GO');});
test('point rejects movement beside active route then accepts after release',()=>{const s=ccm();C.dispatch(s,{type:'route',id:'3A-B065T'});assert.equal(C.dispatch(s,{type:'point',id:'21',value:'R'}).ok,false);C.dispatch(s,{type:'stop',id:'3A'});assert(C.dispatch(s,{type:'point',id:'21',value:'R'}).ok);assert.equal(s.points['21'],'R');});
test('LOCAL handover must be accepted and forbids CCM controls',()=>{const s=ccm();C.dispatch(s,{type:'mode',value:'LOCAL'});assert.equal(C.dispatch(s,{type:'route',id:'3A-B065T'}).ok,false);C.dispatch(s,{type:'handover',accept:false});assert.equal(s.mode,'CCM');C.dispatch(s,{type:'mode',value:'LOCAL'});C.dispatch(s,{type:'handover',accept:true});assert.equal(s.mode,'LOCAL');assert.equal(C.dispatch(s,{type:'point',id:'21',value:'R'}).ok,false);});
test('elapsed time never invents automatic release',()=>{const s=ccm();C.dispatch(s,{type:'route',id:'3A-B065T'});C.dispatch(s,{type:'tick',seconds:3600});assert.equal(s.signals['3A'],'GO');});
console.log(n+' tests passed');

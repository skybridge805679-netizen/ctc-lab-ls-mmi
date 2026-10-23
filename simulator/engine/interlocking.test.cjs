const assert=require('node:assert/strict');
const Base=require('./core.js');let n=0;
function test(name,fn){fn();console.log('PASS '+name);n++;}
const ccm=id=>{const C=Base.forStation(id),s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});return [C,s];};
test('home signal with an approaching train keeps the route locked for 90 s after stop',()=>{
 const [C,s]=ccm('underground-seoul');
 assert(C.dispatch(s,{type:'route',id:'1A-1T'}).ok);
 assert(C.dispatch(s,{type:'approach',signal:'1A'}).ok);
 const r=C.dispatch(s,{type:'stop',id:'1A'});assert(r.ok);assert.equal(s.signals['1A'],'STOP');
 assert.equal(s.routes['1A-1T'].status,'APPROACH_LOCK');assert.equal(s.routes['1A-1T'].lock.seconds,90);
 const again=C.dispatch(s,{type:'route',id:'1A-1T'});assert.equal(again.ok,false);assert.match(again.message,/90/);
 C.dispatch(s,{type:'tick',seconds:89});assert(s.routes['1A-1T'],'still locked at 89 s');
 C.dispatch(s,{type:'tick',seconds:1});assert.equal(s.routes['1A-1T'],undefined);
 assert.equal(s.logs[0].action,'approachRelease');
 assert(C.dispatch(s,{type:'route',id:'1A-1T'}).ok,'can be set again after release');
});
test('departure signal locks for 30 s and blocks conflicting routes and point movement',()=>{
 const [C,s]=ccm('underground-seoul');
 C.dispatch(s,{type:'route',id:'3A-B065T'});C.dispatch(s,{type:'approach',signal:'3A'});C.dispatch(s,{type:'stop',id:'3A'});
 assert.equal(s.routes['3A-B065T'].lock.seconds,30);
 assert.equal(C.dispatch(s,{type:'route',id:'3A-B070T'}).ok,false);
 const p=C.dispatch(s,{type:'point',id:'21',value:'R'});assert.equal(p.ok,false);assert.match(p.message,/접근쇄정/);
 C.dispatch(s,{type:'tick',seconds:30});assert.deepEqual(Object.keys(s.routes),[]);assert(C.dispatch(s,{type:'point',id:'21',value:'R'}).ok);
});
test('without an approaching train stopping releases at once (basic practice unchanged)',()=>{
 const [C,s]=ccm('underground-seoul');C.dispatch(s,{type:'route',id:'1A-1T'});C.dispatch(s,{type:'stop',id:'1A'});assert.deepEqual(s.routes,{});
});
test('approach rules reject shunting signals, duplicate trains, entry during lock and removal during lock',()=>{
 const [C,s]=ccm('underground-seoul');
 assert.equal(C.dispatch(s,{type:'approach',signal:'21'}).ok,false);
 C.dispatch(s,{type:'route',id:'1A-1T'});C.dispatch(s,{type:'approach',signal:'1A'});
 assert.equal(C.dispatch(s,{type:'approach',signal:'1A'}).ok,false);
 C.dispatch(s,{type:'stop',id:'1A'});
 assert.equal(C.dispatch(s,{type:'occupy',id:'1A-1T'}).ok,false);
 assert.equal(C.dispatch(s,{type:'approach',signal:'1A',present:false}).ok,false);
 assert.equal(C.dispatch(s,{type:'stop',id:'1A'}).ok,false,'second stop does not restart the timer');
 assert.equal(s.routes['1A-1T'].lock.until,90);
});
test('a train that enters consumes the approach flag',()=>{
 const [C,s]=ccm('underground-seoul');C.dispatch(s,{type:'route',id:'1A-1T'});C.dispatch(s,{type:'approach',signal:'1A'});
 assert(C.dispatch(s,{type:'occupy',id:'1A-1T'}).ok);assert.equal(s.approach['1A'],undefined);
});
test('time alone never creates a lock or release without an approaching train',()=>{
 const [C,s]=ccm('underground-seoul');C.dispatch(s,{type:'route',id:'1A-1T'});C.dispatch(s,{type:'tick',seconds:3600});assert(s.routes['1A-1T']);
});
test('Geumcheon 2B-6T locks overlap point 26 normal; 1B-1T locks 54 reverse; released with the route',()=>{
 const [C,s]=ccm('geumcheon');
 s.points['26']='R';assert(C.dispatch(s,{type:'route',id:'2B-6T'}).ok);assert.equal(s.points['26'],'N');
 const m=C.dispatch(s,{type:'point',id:'26',value:'R'});assert.equal(m.ok,false);assert.match(m.message,/오버랩/);
 C.dispatch(s,{type:'stop',id:'2B'});assert(C.dispatch(s,{type:'point',id:'26',value:'R'}).ok);
 assert(C.dispatch(s,{type:'route',id:'1B-1T'}).ok);assert.equal(s.points['54'],'R');
 assert.equal(C.dispatch(s,{type:'point',id:'54',value:'N'}).ok,false);
 const table=C.lockTable(s);assert.deepEqual(table[0].overlap.points,{'54':'R'});
});
test('Yeongdeungpo 1A-1T requires the 4B overlap signal to be released first',()=>{
 const [C,s]=ccm('yeongdeungpo');
 assert(C.dispatch(s,{type:'route',id:'4B-B622T'}).ok);
 const r=C.dispatch(s,{type:'route',id:'1A-1T'});assert.equal(r.ok,false);assert.match(r.message,/4B/);
 C.dispatch(s,{type:'stop',id:'4B'});assert(C.dispatch(s,{type:'route',id:'1A-1T'}).ok);
});
test('an existing overlap rejects opposing point settings regardless of route order',()=>{
 for(const [protectedRoute,conflict]of [['2B-6T','3A-B963T'],['1B-1T','4B-B968T']])for(const order of [[protectedRoute,conflict],[conflict,protectedRoute]]){
  const [C,s]=ccm('geumcheon');assert(C.dispatch(s,{type:'route',id:order[0]}).ok);
  const before=JSON.stringify({routes:s.routes,points:s.points,signals:s.signals});
  const result=C.dispatch(s,{type:'route',id:order[1]});assert.equal(result.ok,false,order.join(' -> '));assert.match(result.message,/오버랩/);
  assert.equal(JSON.stringify({routes:s.routes,points:s.points,signals:s.signals}),before);
 }
});
test('all-stop does not restart a lock timer when other routes are still set',()=>{
 const [C,s]=ccm('geumcheon');
 C.dispatch(s,{type:'route',id:'1A-2T'});C.dispatch(s,{type:'route',id:'2A-5T'});
 C.dispatch(s,{type:'approach',signal:'1A'});C.dispatch(s,{type:'stop',id:'1A'});
 const deadline=s.routes['1A-2T'].lock.until;C.dispatch(s,{type:'tick',seconds:20});
 const stopped=C.dispatch(s,{type:'stopAll'});assert(stopped.ok);assert.match(stopped.message,/70초/);assert.equal(s.routes['1A-2T'].lock.until,deadline);
 assert(!s.routes['2A-5T']);C.dispatch(s,{type:'tick',seconds:70});assert(!s.routes['1A-2T']);
});
console.log(n+' interlocking tests passed');

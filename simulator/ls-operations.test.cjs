const assert=require('node:assert/strict'),Ops=require('./ls-operations');
const C=Ops.create({geumcheon:['B965T','B967T','4T'],anyang:['B979T','B981T']});
const base={station:'geumcheon',slot:'B965T'};
let tests=0;function test(name,fn){fn();tests++;console.log('PASS '+name);}
function add(s,number,slot=base.slot,station=base.station){const r=C.dispatch(s,{op:'insert',station,slot,number});assert(r.ok,r.message);return C.entries(s,station,slot).at(-1);}
function reject(s,a){const before=JSON.stringify(s);assert(!C.dispatch(s,a).ok);assert.equal(JSON.stringify(s),before,'rejected operation mutated state');}
test('multi-number windows preserve identities; rename/delete touch only the selected number',()=>{
 const s=C.initial(),one=add(s,'k1234'),two=add(s,'G1234');assert.equal(one.number,'K1234');assert.equal(C.entries(s,...Object.values(base)).length,2);
 assert(C.dispatch(s,{...base,op:'rename',uid:one.uid,number:'K5678',direction:'down'}).ok);assert.equal(two.number,'G1234');
 assert(C.dispatch(s,{...base,op:'delete',uid:two.uid}).ok);assert.deepEqual(s.stations.geumcheon.windows.B965T,[one]);
});
test('move and swap are atomic across stations and preserve unrelated occupants',()=>{
 const s=C.initial(),one=add(s,'K1234'),two=add(s,'K5678','B979T','anyang'),three=add(s,'G1000','B979T','anyang');
 reject(s,{...base,op:'move',uid:one.uid,targetStation:'anyang',targetSlot:'missing'});
 reject(s,{...base,op:'swap',uid:one.uid,targetStation:'anyang',targetSlot:'B979T',targetUid:'missing'});
 assert(C.dispatch(s,{...base,op:'swap',uid:one.uid,targetStation:'anyang',targetSlot:'B979T',targetUid:two.uid}).ok);
 assert.deepEqual(s.stations.anyang.windows.B979T,[one,three]);assert.deepEqual(s.stations.geumcheon.windows.B965T,[two]);
 assert(C.dispatch(s,{...base,op:'move',uid:two.uid,targetStation:'anyang',targetSlot:'B981T'}).ok);assert.equal(C.entries(s,'geumcheon','B965T').length,0);assert.equal(C.entries(s,'anyang','B981T')[0].uid,two.uid);
});
test('invalid input, stale selection and same-window moves leave all windows intact',()=>{
 const s=C.initial(),one=add(s,'K1234');
 for(const number of ['', '<script>', 'ABC123', '1234567'])reject(s,{...base,op:'rename',uid:one.uid,number});
 reject(s,{...base,op:'delete',uid:'stale'});reject(s,{...base,op:'move',uid:one.uid,targetStation:base.station,targetSlot:base.slot});
 reject(s,{...base,op:'insert',number:'K1000',direction:'wrong'});
});
test('duplicate numbers are allowed for the manual duplicate-alarm scenarios and reported',()=>{
 const s=C.initial();add(s,'K1234');const result=C.dispatch(s,{...base,slot:'B967T',op:'insert',number:'K1234'});assert(result.ok);assert(result.message.includes('중복'));assert.equal(C.entries(s,'geumcheon','B967T')[0].number,'K1234');
});
test('boards retain text/location; fixing blocks dragging, edits validate before mutation',()=>{
 const s=C.initial();assert(C.dispatch(s,{station:base.station,op:'boardAdd',kind:'서행표시',text:'25',x:20,y:30}).ok);const b=s.stations.geumcheon.boards[0];
 assert(C.dispatch(s,{station:base.station,op:'boardFix',id:b.id,fixed:true}).ok);reject(s,{station:base.station,op:'boardMove',id:b.id,x:40,y:50});
 reject(s,{station:base.station,op:'boardEdit',id:b.id,kind:'서행표시',text:'0'});reject(s,{station:base.station,op:'boardAdd',kind:'사용자입력',text:'작업',x:-1,y:20});
 assert(C.dispatch(s,{station:base.station,op:'boardFix',id:b.id,fixed:false}).ok);assert(C.dispatch(s,{station:base.station,op:'boardMove',id:b.id,x:40,y:50}).ok);assert.equal(b.x,40);
 assert(C.dispatch(s,{station:base.station,op:'boardDelete',id:b.id}).ok);assert.equal(s.stations.geumcheon.boards.length,0);
});
console.log(tests+' LS operation tests passed');

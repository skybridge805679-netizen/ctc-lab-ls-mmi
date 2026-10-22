const assert=require('assert'),T=require('./timetable.js'),C=require('./cdrs.js');
function tight(){
 const m=T.initial(),lead=m.trains.find(t=>t.id==='K1131');
 // a follower 60초 behind the leader of the first down train: headway conflicts from the start
 const r=T.copy(m,'K1131','K9001',lead.calls[0].departure+60,{});assert.ok(r.ok);return m;
}
const m=tight(),found=T.conflicts(m);assert.ok(found.length>0,'conflicts exist');
const plans=C.propose(m);assert.strictEqual(plans.length,found.length);
const solvable=plans.filter(p=>p.plan);assert.ok(solvable.length>0,'some proposals');
for(const p of solvable){assert.ok(C.describe(p).length>5);}
// approving never leaves the same conflict behind and never creates new ones for that train
const first=solvable[0],before=T.conflicts(m).length;
const res=C.approve(m,first);assert.ok(res.ok,res.message);
const after=T.conflicts(m);assert.ok(after.length<before,'fewer conflicts after approval');
assert.ok(!after.some(c=>C.key(c)===first.key),'approved conflict resolved');
assert.strictEqual(m.changes.at(-1).type,'cdrs');
// dismissed (취소) conflicts are not proposed again
const dismissed=C.propose(m).map(p=>p.key);
assert.strictEqual(C.propose(m,dismissed).length,0);
// a timetable with no conflicts gives nothing
assert.strictEqual(C.propose(T.initial()).length,T.conflicts(T.initial()).length);
console.log('cdrs: ok',plans.length,'proposals');

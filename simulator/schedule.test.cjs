const assert=require('node:assert/strict');
const T=require('./timetable.js');
let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name);}
const full=()=>T.pattern({id:'K2001',from:'cheongnyangni',to:'suwon',start:3600});
test('create includes all 33 stations; reverse and noncontrolled endpoints work',()=>{
 const model=T.initial(),draft=full();assert(T.create(model,draft).ok);
 assert.equal(model.trains.at(-1).calls.length,33);assert.equal(model.trains.at(-1).calls[0].departure,3600);
 draft.calls[0].departure=9999;assert.equal(model.trains.at(-1).calls[0].departure,3600);
 const up=T.pattern({id:'K2002',from:'hwaseo',to:'jegidong',start:7200});assert(T.create(model,up).ok);
 assert.equal(model.trains.at(-1).direction,'up');assert.equal(model.trains.at(-1).calls.length,31);
});
test('duplicate, invalid order/time/attributes do not change any model state',()=>{
 const model=T.initial();assert(T.create(model,full()).ok);const before=structuredClone(model);
 const candidates=[full(),{...full(),id:'INVALID'},{...full(),id:'K2003',carCount:0},
  {...full(),id:'K2003',relatedTrain:'K2003'}, {...full(),id:'K2003',kind:'unknown'}];
 const unordered=full();unordered.id='K2003';unordered.calls.reverse();candidates.push(unordered);
 const badTime=full();badTime.id='K2003';badTime.calls[1].arrival=0;candidates.push(badTime);
 for(const c of candidates)assert.equal(T.create(model,c).ok,false);
 assert.deepEqual(model,before);
});
test('edits are atomic, retain first plan and prevent changing train identity',()=>{
 const model=T.initial(),source=model.trains[0],original=structuredClone(source),draft=structuredClone(source);
 draft.calls[3].track='2T';draft.calls[3].departure+=10;draft.kind='회송열차';draft.carCount=8;draft.relatedTrain='K1002';draft.cancelled=true;
 assert(T.update(model,source.id,draft).ok);assert.deepEqual(source.plan,original.plan);assert.equal(source.calls[3].track,'2T');assert(source.cancelled);
 const before=structuredClone(model),bad=structuredClone(source);bad.calls[1].arrival=bad.calls[1].departure+1;
 assert.equal(T.update(model,source.id,bad).ok,false);
 assert.equal(T.update(model,source.id,{...draft,id:'C9999'}).ok,false);
 assert.deepEqual(model,before);
});
test('copy shifts times and preserves original/cancelled source without deleting it',()=>{
 const model=T.initial();T.cancel(model,'K1131');const source=structuredClone(model.trains[0]);
 assert(T.copy(model,'K1131','C1923',7200,{carCount:8}).ok);
 const copied=model.trains.at(-1);assert.equal(copied.calls[0].departure,7200);assert.equal(copied.carCount,8);assert(!copied.cancelled);
 assert.deepEqual(model.trains[0],source);assert.deepEqual(copied.calls,copied.plan);
 const before=structuredClone(model);assert.equal(T.copy(model,'K1131','C1923',8000).ok,false);assert.deepEqual(model,before);
});
test('delays that cross the supported service day are rejected atomically',()=>{
 const model=T.initial(),draft=T.pattern({id:'K2001',from:'skku',to:'suwon',start:57000});
 assert(T.create(model,draft).ok);const before=structuredClone(model);
 assert.equal(T.delay(model,'K2001','skku',120).ok,false);assert.deepEqual(model,before);
});
console.log(n+' schedule tests passed');

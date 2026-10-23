'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('./timetable');
test('timetable undo/redo and file import are reversible and reject malformed or duplicate trains',()=>{
 const model=T.initial(),id=model.trains[0].id,station=model.trains[0].calls[0].station,before=model.trains[0].calls[0].departure;
 assert.ok(T.delay(model,id,station,2).ok);assert.ok(T.undo(model).ok);assert.equal(model.trains.find(t=>t.id===id).calls[0].departure,before);assert.ok(T.redo(model).ok);assert.equal(model.trains.find(t=>t.id===id).calls[0].departure,before+120);
 const file=structuredClone(model);file.trains=file.trains.slice(0,2);assert.ok(T.import(model,{timetable:file}).ok);assert.equal(model.trains.length,2);assert.ok(T.undo(model).ok);assert.equal(model.trains.length,12);
 const untouched=structuredClone(model);assert.equal(T.import(model,{...file,trains:[null]}).ok,false);assert.equal(T.import(model,{...file,trains:[file.trains[0],file.trains[0]]}).ok,false);assert.deepEqual(model,untouched);
});
test('undo never overwrites changes to the same train made after the edit',()=>{const model=T.initial(),t=model.trains[0];T.delay(model,t.id,t.calls[0].station,1);t.calls[0].departure++;assert.equal(T.undo(model).ok,false);});

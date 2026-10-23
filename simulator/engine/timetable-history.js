(function(root){'use strict';
// Store only the edited trains. Independent automatic changes are never silently overwritten.
function create(limit=64*1024*1024){
 const undo=[],redo=[];let bytes=0;
 const take=(model,ids)=>{const index=new Map(model.trains.map(t=>[t.id,t]));return Object.fromEntries(ids.map(id=>[id,structuredClone(index.get(id)||null)]));};
 function apply(model,rows){const remaining=new Map(Object.entries(rows));model.trains=model.trains.flatMap(train=>{if(!remaining.has(train.id))return [train];const next=remaining.get(train.id);remaining.delete(train.id);return next?[structuredClone(next)]:[];});for(const train of remaining.values())if(train)model.trains.push(structuredClone(train));}

 function perform(model,ids,fn){ids=[...new Set(ids)];const before=take(model,ids),date=model.serviceDate,result=fn();if(!result.ok)return result;const entry={before,after:take(model,ids),dateBefore:date,dateAfter:model.serviceDate};entry.bytes=JSON.stringify(entry).length*2;undo.push(entry);bytes+=entry.bytes-redo.reduce((n,e)=>n+e.bytes,0);redo.length=0;while(undo.length>100||bytes>limit&&undo.length>1)bytes-=undo.shift().bytes;return result;}
 function travel(model,from,to,reverse){const entry=from.at(-1);if(!entry)return {ok:false,message:reverse?'실행 취소할 편집이 없습니다.':'다시 실행할 편집이 없습니다.'};const expected=reverse?entry.after:entry.before;
  if(JSON.stringify(take(model,Object.keys(expected)))!==JSON.stringify(expected)||model.serviceDate!==(reverse?entry.dateAfter:entry.dateBefore))return {ok:false,message:'편집 이후 열차 데이터가 변경되었습니다. 현재 운행 데이터를 보호하기 위해 실행 취소·다시 실행을 중단합니다.'};
  from.pop();to.push(entry);apply(model,reverse?entry.before:entry.after);model.serviceDate=reverse?entry.dateBefore:entry.dateAfter;model.changes.push({type:reverse?'undo':'redo',ids:Object.keys(expected)});return {ok:true,message:reverse?'시간표 편집 실행 취소':'시간표 편집 다시 실행'};
 }
 return {perform,undo:model=>travel(model,undo,redo,true),redo:model=>travel(model,redo,undo,false),status:()=>({undo:undo.length,redo:redo.length,bytes}),reset:()=>{undo.length=redo.length=bytes=0;}};
}
const api={create};if(typeof module!=='undefined')module.exports=api;else root.SimTimetableHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);

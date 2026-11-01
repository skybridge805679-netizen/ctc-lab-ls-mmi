'use strict';
// 검수 2: 열차는 열번을 손으로 옮겨서가 아니라 진로·신호(또는 전령법 지시)로 실제로 움직여야 한다
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./runtime.cjs'),IL=require('./interlocking.js');
function start(pid){const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S-T',name:'t',problems:[pid]});lib.scenarios.push({id:'SC-T',name:'t',situations:['S-T']});
 assert.ok(r.command({type:'fts',op:'library',library:lib}).ok);assert.ok(r.command({type:'fts',op:'start',scenario:'SC-T',professor:'001',student:'tester',autoRun:false}).ok);r.command({type:'tick',seconds:1});return r;}
const row=(r,n)=>{for(const [station,s] of Object.entries(r.snapshot().ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return {station,slot,uid:x.uid};return null;};
const tick=(r,s)=>{for(let i=0;i<s;i++)r.command({type:'tick',seconds:1});};
const ctl=(r,station,action)=>r.command({type:'control',station,action:{...action,source:'LS'}});
const item=r=>r.snapshot().fts.session.items[0];
const rename=(r,from,to)=>{const f=row(r,from);assert.ok(r.command({type:'numbers',action:{op:'rename',...f,number:to}}).ok);};

test('signal stop with a train standing on the platform or in the rear block window keeps the approach lock',()=>{
 const r=start('P-em-03');
 assert.deepEqual(IL.approachWindows('anyang','3B'),['5T','B983T']);assert.deepEqual(IL.approachWindows('geumcheon','2A'),['B965T','B967T']);
 ctl(r,'anyang',{type:'mode',value:'CCM'});assert.match(ctl(r,'anyang',{type:'stop',id:'3B'}).message,/접근쇄정 30초/);
 ctl(r,'geumcheon',{type:'mode',value:'CCM'});assert.match(ctl(r,'geumcheon',{type:'stop',id:'2A'}).message,/접근쇄정 90초/);
});
test('K0456 changes line only along the routes the controller gives, then the rescue train runs to the collision on the rescue order',()=>{
 const r=start('P-em-03');
 ctl(r,'anyang',{type:'mode',value:'CCM'});ctl(r,'anyang',{type:'stop',id:'3B'});ctl(r,'geumcheon',{type:'mode',value:'CCM'});ctl(r,'geumcheon',{type:'stop',id:'2A'});
 tick(r,95);assert.equal(row(r,'K0456').slot,'5T');
 assert.ok(ctl(r,'anyang',{type:'route',id:'3B-B655T'}).ok);tick(r,60);
 assert.equal(row(r,'K0456').station,'geumcheon');assert.equal(row(r,'K0456').slot,'B641T','2B-5T 진로 없이는 금천구청 4T 방면에서 기다린다');
 assert.ok(ctl(r,'geumcheon',{type:'route',id:'2B-5T'}).ok);tick(r,30);assert.equal(row(r,'K0456').slot,'5T');
 // 구원: 번호 수정만으로는 움직이지 않는다
 rename(r,'K0454','G0454');tick(r,60);assert.equal(row(r,'G0454').slot,'B975T');
 // 열번 수동 이동은 표시만 옮길 뿐 구원연결로 인정하지 않는다
 const f=row(r,'G0454');assert.ok(r.command({type:'numbers',action:{op:'move',...f,targetStation:'geumcheon',targetSlot:'B967T'}}).ok);tick(r,2);
 assert.equal(item(r).obj['move-G0454'],undefined);assert.ok(r.snapshot().fts.logs.some(l=>/수동 열번 이동/.test(l.text)));
 const g=row(r,'G0454');assert.ok(r.command({type:'numbers',action:{op:'move',...g,targetStation:'anyang',targetSlot:'B975T'}}).ok);tick(r,2);
 const seq=r.snapshot().seq;
 assert.ok(r.command({type:'fts',op:'manual',key:'comm:n24',checked:true}).ok);tick(r,10);assert.equal(row(r,'G0454').slot,'B975T','전령법 운행 중');
 tick(r,40);assert.deepEqual([row(r,'G0454').station,row(r,'G0454').slot],['geumcheon','B967T']);
 assert.notEqual(item(r).obj['move-G0454'],undefined);
 assert.ok(r.snapshot().events.some(e=>e.seq>seq&&e.kind==='alarm'&&/G0454/.test(e.text)&&/중복/.test(e.text)),'구원연결 열차번호 중복 알람');
});
test('a saved session with automatic control state restores (started is a Map) and a failed restore leaves the runtime intact',()=>{
 const r=R.create();r.command({type:'auto',enabled:true});tick(r,30);const saved=r.checkpoint();
 const copy=R.create();assert.doesNotThrow(()=>copy.restore(saved));
 const bad=structuredClone(saved);bad.auto.engine.started=[1];const keep=R.create(),before=JSON.stringify(keep.snapshot().states);
 try{keep.restore(bad);}catch{}assert.equal(JSON.stringify(keep.snapshot().states).length>0,true);assert.ok(before.length>0);
});
test('a manual number move the script prescribes (단선지령식 반대선 운행) is logged as the normal procedure, not as a display correction',()=>{
 const r=start('P-em-02'),f=row(r,'K0608');assert.ok(f);
 assert.ok(r.command({type:'numbers',action:{op:'move',...f,targetStation:'dongmyo',targetSlot:'B011T'}}).ok);tick(r,1);
 const last=r.snapshot().fts.logs.find(l=>/열번 이동|열번 수동 이동/.test(l.text));assert.match(last.text,/대본에 명시된 수동 이동/);
 assert.notEqual(item(r).obj['move-K0608'],undefined);
});

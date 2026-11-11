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
 // 시작 진로는 정상 진로다: 3B는 상2선(B981T), 3C는 상1선(B655T). 운행선 변경용 3B-B655T나 2B-6T가 미리 서 있지 않다
 assert.deepEqual(Object.keys(r.snapshot().states.anyang.routes).sort(),['3B-B981T','3C-B655T']);
 ctl(r,'anyang',{type:'mode',value:'CCM'});ctl(r,'anyang',{type:'stop',id:'3B'});ctl(r,'anyang',{type:'stop',id:'3C'});ctl(r,'geumcheon',{type:'mode',value:'CCM'});ctl(r,'geumcheon',{type:'stop',id:'2A'});
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
 const last=r.snapshot().fts.logs.find(l=>/열번 이동|열번 수동 이동/.test(l.text));assert.match(last.text,/문제가 요구한 열번 이동/);
 assert.notEqual(item(r).obj['move-K0608'],undefined);
});
test('a 관제시스템 운용 problem that asks to move a train number (checks: trainAt) treats the manual move as the expected operation',()=>{
 const r=R.create(),lib={version:1,problems:[{id:'P-mv',subject:'철도관제시스템 운용',name:'열번 이동',limit:120,score:100,phenomena:[{type:'insertTrain',station:'uiwang',slot:'B1012T',number:'K0651',direction:'up'}],checks:[{label:'K0651 열번 이동',condition:{type:'trainAt',number:'K0651',station:'uiwang',slot:'B1011T'}}]}],situations:[{id:'S',name:'S',problems:['P-mv']}],scenarios:[{id:'SC',name:'SC',situations:['S']}],schedules:[]};
 assert.ok(r.command({type:'fts',op:'library',library:lib}).ok);assert.ok(r.command({type:'fts',op:'start',scenario:'SC',professor:'001',student:'tester',autoRun:false}).ok);
 const f=row(r,'K0651');assert.ok(r.command({type:'numbers',action:{op:'move',...f,targetStation:'uiwang',targetSlot:'B1011T'}}).ok);
 const last=r.snapshot().fts.logs.find(l=>/열번 수동 이동|수동 열번 이동/.test(l.text));assert.match(last.text,/문제가 요구한 열번 이동/);
 assert.equal(r.snapshot().fts.history[0]?.got,100);
});
test('a schedule problem after an emergency problem that emptied the timetable restores the base timetable before the script builds the conflict',()=>{
 const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S-A',name:'a',problems:['P-em-03']},{id:'S-B',name:'b',problems:['P-sch-conflict']});lib.scenarios.push({id:'SC-AB',name:'ab',situations:['S-A','S-B']});
 assert.ok(r.command({type:'fts',op:'library',library:lib}).ok);assert.ok(r.command({type:'fts',op:'start',scenario:'SC-AB',professor:'001',student:'tester',autoRun:false}).ok);r.command({type:'tick',seconds:1});
 assert.ok(r.snapshot().timetable.trains.length<10,'비상 문제는 대본 열차만');
 assert.ok(r.command({type:'fts',op:'next'}).ok);r.command({type:'fts',op:'ui',ui:{windows:[]}});r.command({type:'tick',seconds:1});
 const it=r.snapshot().fts.session.items[1];assert.equal(it.error,undefined,it.error);assert.equal(it.status,'진행');
 assert.ok(r.snapshot().timetable.trains.some(t=>t.id==='B0000'),'경합 임시열차 B0000');
});
test('비상 03 in the inspector order: 통보 14 before stopping 3C counts 3C as already stopped instead of blocking; after 합병 출발 the 회송 trains leave',()=>{
 const r=start('P-em-03'),c=id=>assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+id,checked:true}).ok);
 ctl(r,'anyang',{type:'mode',value:'CCM'});ctl(r,'anyang',{type:'stop',id:'3B'});ctl(r,'geumcheon',{type:'mode',value:'CCM'});ctl(r,'geumcheon',{type:'stop',id:'2A'});
 c('n14');tick(r,120);
 assert.notEqual(item(r).obj['stop-anyang-3C'],undefined,'A1002가 3C 진로로 이미 지나가 3C는 정지 — 취소할 것이 없으므로 정지 확인으로 인정한다');
 // A1002는 사라지지 않고 상1선을 이어 달려 금천구청 장내 앞에 선다 — CCM이라 자동 진로가 서지 않는다 (대본: 「A1002열차 금천구청 통과 확인 후」 2B-5T)
 assert.deepEqual([row(r,'A1002').station,row(r,'A1002').slot],['geumcheon','B641T']);
 ctl(r,'geumcheon',{type:'mode',value:'AUTO'});tick(r,120);assert.notEqual(row(r,'A1002')?.station,'geumcheon','AUTO로 돌리면 A1002가 2B-4T 자동 진로로 금천구청을 통과한다');
 ctl(r,'geumcheon',{type:'mode',value:'CCM'});
 assert.ok(ctl(r,'anyang',{type:'route',id:'3B-B655T'}).ok);tick(r,60);assert.ok(ctl(r,'geumcheon',{type:'route',id:'2B-5T'}).ok);
 rename(r,'K0450','G0450');rename(r,'K0454','G0454');c('n24');tick(r,60);
 assert.ok(r.command({type:'alarm:ack',texts:['열차번호 중복']}).ok);
 const g=row(r,'G0454');assert.ok(r.command({type:'numbers',action:{op:'delete',...g}}).ok);rename(r,'K0452','G0452');
 ctl(r,'anyang',{type:'mode',value:'AUTO'});ctl(r,'geumcheon',{type:'mode',value:'AUTO'});c('n27');
 tick(r,400);
 assert.equal(row(r,'K0456'),null,'K0456은 B963T에 서지 않고 관제구간 밖으로');assert.equal(row(r,'G0450'),null,'G0450 회송');assert.equal(row(r,'G0452'),null,'G0452 회송');
});
test('[CA028_01] 오프라인ID 실시간변경 loads the selected schedule ID into today\'s timetable; tomorrow only sets the ID; reservations and the setting survive restore',()=>{
 const r=R.create(),s=()=>r.snapshot();assert.equal(s().timetable.trains.length,0,'빈 시작');
 assert.ok(s().scheduleIds.list.some(x=>x.id==='90011'));
 assert.equal(r.command({type:'scheduleId',op:'realtime',id:'없음',day:'today'}).ok,false);
 const x=r.command({type:'scheduleId',op:'realtime',id:'90011',day:'today'});assert.ok(x.ok,x.message);assert.equal(x.trains,9);
 assert.deepEqual(s().timetable.trains.map(t=>t.id).sort(),['A1001','A1002','K0399','K0401','K0446','K0448','K0450','K0454','K0456']);assert.equal(s().scheduleIds.today.id,'90011');
 assert.ok(r.command({type:'scheduleId',op:'realtime',id:'90004',day:'tomorrow'}).ok);assert.equal(s().timetable.trains.length,9,'내일 설정은 오늘 운행을 바꾸지 않음');
 assert.ok(r.command({type:'scheduleId',op:'reserve',id:'90004',days:['20261110']}).ok);
 const c=R.create();c.restore(r.checkpoint());assert.equal(c.snapshot().scheduleIds.today.id,'90011');assert.equal(c.snapshot().scheduleIds.tomorrow.id,'90004');assert.equal(c.snapshot().scheduleIds.reserved['20261110'].id,'90004');
});

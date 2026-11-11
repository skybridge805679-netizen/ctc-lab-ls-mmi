'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./runtime.cjs'),T=require('./timetable'),Line=require('./line');
const act=(r,a)=>{const x=r.command(a);assert.equal(x.ok,true,x.message);return x;};
function single(r,id){const lib=structuredClone(r.snapshot().ftsLibrary),p=lib.problems.find(p=>p.id===id);lib.problems=[p];lib.situations=[{id:'TEST',name:'선택 프리셋',problems:[id]}];lib.scenarios=[{id:'TEST',name:'선택 프리셋',situations:['TEST']}];act(r,{type:'fts',op:'library',library:lib});act(r,{type:'fts',op:'start',scenario:'TEST',professor:'001',student:'tester',autoRun:false});return p;}
test('fresh startup has no timetable, running scenario, active training or train numbers, even after AUTO ticks',()=>{
 assert.deepEqual(T.initial().trains,[]);const r=R.create(),s=r.snapshot();assert.deepEqual(s.timetable.trains,[]);assert.equal(s.scenario.run,null);assert.equal(s.fts.session,null);assert(s.ftsLibrary.scenarios.length>0,'FTS selection catalog is retained');
 act(r,{type:'auto',enabled:true});act(r,{type:'tick',seconds:1200});assert.deepEqual(r.snapshot().timetable.trains,[]);assert(Object.values(r.snapshot().ls.stations).every(s=>Object.values(s.windows).every(rows=>!rows.length)));
});
test('every FTS starting problem explicitly loads its own valid schedule from an empty runtime',()=>{
 const presets=R.create().snapshot().ftsLibrary.problems.filter(p=>p.setup?.scheduleId);assert.equal(presets.length,60);assert.equal(new Set(presets.map(p=>p.setup.scheduleId)).size,19,"감독관 지시형·상황별 문제는 기본 문제의 시간표를 함께 쓴다");
 for(const source of presets){const r=R.create();single(r,source.id);const s=r.snapshot(),item=s.fts.session.items[0];assert.equal(item.error,undefined,source.id);const expected=s.ftsLibrary.schedules.find(t=>t.id===source.setup.scheduleId).timetable;const ids=s.timetable.trains.map(t=>t.id).sort();
  if(source.id==='P-sch-conflict'){assert.deepEqual(ids,['B0000','K1131']);assert(T.conflicts(s.timetable).some(c=>c.trains.includes('B0000')));}
  else assert.deepEqual(ids,expected.trains.map(t=>t.id).sort(),source.id);
  assert(s.timetable.trains.every(T.valid));for(const train of s.timetable.trains)for(const call of train.calls){const routes=require('./schedule-routes');assert(routes.validate(call.station,call.arrivalRoute,'arrival'),source.id+' '+train.id+' '+call.station);assert(routes.validate(call.station,call.departureRoute,'departure'));}
  for(const c of source.setup.trains||[])assert(ids.includes(c.number),source.id+' '+c.number);
 }
});
test('preset reload rebases its schedule at the current clock and cast trains are not duplicated by timetable AUTO',()=>{
 const r=R.create();act(r,{type:'tick',seconds:300});single(r,'P-yongsan-5');const before=r.snapshot().timetable.trains.find(t=>t.id==='A1002').calls.find(c=>c.station==='yongsan').arrival;assert.equal(before,900);
 const counts=()=>Object.values(r.snapshot().ls.stations).flatMap(s=>Object.values(s.windows)).flat().map(t=>t.number).sort();const cast=counts();act(r,{type:'auto',enabled:true});act(r,{type:'tick',seconds:300});assert.deepEqual(counts(),cast);
 act(r,{type:'fts',op:'reload'});const after=r.snapshot().timetable.trains.find(t=>t.id==='A1002').calls.find(c=>c.station==='yongsan').arrival;assert.equal(after-before,300);
});
test('the C4201 creation task starts empty and follow-up questions keep the timetable entered by the trainee',()=>{
 const r=R.create();act(r,{type:'fts',op:'start',scenario:'SC-01',professor:'001',student:'tester',autoRun:false});assert.deepEqual(r.snapshot().timetable.trains,[]);
 const t=T.pattern({id:'C4201',from:'yongsan',to:'suwon',start:3600});act(r,{type:'timetable',method:'create',args:[t]});act(r,{type:'tick',seconds:0});act(r,{type:'tick',seconds:0});assert.equal(r.snapshot().fts.session.items[1].status,'진행');assert.equal(r.snapshot().timetable.trains[0].id,'C4201');
});
test('metro up/down and general/electric four-track families remain distinct in actual handovers',()=>{
 for(const [code,trunk]of [['B002T','MD'],['B001T','MU'],['B606T','GD'],['B605T','GU'],['B916T','ED'],['B917T','EU']])assert.equal(Line.trunkOf(code),trunk);
 assert.deepEqual(Object.keys(Line.line.stations.cheongnyangni.trunks).sort(),['MD','MU']);assert.equal(Line.mainLineOf('MD'),'ED');assert.equal(Line.mainLineOf('MU'),'EU');assert.equal(Line.lineNameOf('MD'),'하2선');assert.equal(Line.lineNameOf('MU'),'상2선');assert.equal(Line.lineNameOf('GD'),'하1선');assert.equal(Line.lineNameOf('GU'),'상1선');
 const slots=id=>require('./train-windows').data[id].map(w=>w.slot);
 for(const [from,code,direction,to,trunk] of [['cheongnyangni','B002T','down','dongmyo','MD'],['dongmyo','B001T','up','cheongnyangni','MU'],['yongsan','B610T','down','noryangjin','GD'],['yongsan','B607T','up','seoul','GU'],['yongsan','B924T','down','noryangjin','ED'],['yongsan','B913T','up','seoul','EU']]){const h=Line.handoff(from,code,slots,direction);assert.equal(h?.station,to,code);assert.equal(h?.trunk,trunk,code);}
});
test('relative preset tables are detached, rebase once and retain user-owned schedule overrides on upgrade',()=>{
 const F=require('./fts'),lib=R.create().snapshot().ftsLibrary,sch=lib.schedules.find(s=>s.timetable.trains.length),original=structuredClone(sch),table=F.scheduleTable(sch,321,'2026-11-02');assert.deepEqual(sch,original);assert.equal(table.serviceDate,'2026-11-02');assert.equal(table.trains[0].calls[0].arrival-original.timetable.trains[0].calls[0].arrival,321);
 const edited=structuredClone(lib);delete edited.schedules[0].builtin;edited.schedules[0].name='사용자가 저장한 시간표';const upgraded=F.upgrade(edited,lib);assert.equal(upgraded.schedules[0].name,'사용자가 저장한 시간표');
 const broken=structuredClone(lib);broken.problems[0].setup.scheduleId='missing';assert(F.validate(broken).some(e=>e.includes('없는 스케줄 missing')));
});

test('generated schedules follow the cast line: Yongsan general-line KTX does not enter metro tracks',()=>{
 const r=R.create();single(r,'P-yongsan-5');const t=r.snapshot().timetable.trains.find(t=>t.id==='A1002');assert.equal(t.calls.at(-1).station,'seoul');assert(!t.calls.some(c=>c.station==='cheongnyangni'));const call=t.calls.find(c=>c.station==='yongsan');assert.equal(call.track,'7T');const core=require('./core').forStation('yongsan'),dep=core.routes[call.departureRoute.replace('_','-')];assert.equal(Line.trunkOf(dep.destination),'GU');assert.notEqual(call.departureRoute,'3C_B605T','the required diversion is not pre-completed');
});

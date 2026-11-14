'use strict';
// CTC LAB을 끼워 쓰는 관제 게임(오르페이아)에서 나온 엔진 이슈 (2026-11-14, v0.39.60 기준) 가운데 고친 것
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./runtime.cjs');
function start(pid){const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S-G',name:'g',problems:[pid]});lib.scenarios.push({id:'SC-G',name:'g',situations:['S-G']});
 assert.ok(r.command({type:'fts',op:'library',library:lib}).ok);assert.ok(r.command({type:'fts',op:'start',scenario:'SC-G',professor:'001',student:'tester',autoRun:false}).ok);r.command({type:'tick',seconds:1});return r;}
const row=(r,n)=>{for(const [station,s] of Object.entries(r.snapshot().ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return {station,slot,uid:x.uid};return null;};
const at=(r,n)=>{const x=row(r,n);return x&&x.station+':'+x.slot;};
const tick=(r,s)=>{for(let i=0;i<s;i+=5)r.command({type:'tick',seconds:5});};
const ctl=(r,station,action)=>r.command({type:'control',station,action:{...action,source:'LS'}});
const say=(r,id)=>assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+id,checked:true}).ok,id);
const rename=(r,from,to)=>{const f=row(r,from);assert.ok(r.command({type:'numbers',action:{op:'rename',...f,number:to}}).ok);};

test('A1: 운행선 변경 진로를 열어도 기관사 지시(통보) 전에는 떠나지 않는다',()=>{
 const r=start('P-em-05');ctl(r,'geumcheon',{type:'mode',value:'CCM'});for(const id of ['2A','3A','3B','3C'])ctl(r,'geumcheon',{type:'stop',id});tick(r,95);
 const before=at(r,'K1212');const o=ctl(r,'geumcheon',{type:'route',id:'3B-B639T'});assert.ok(o.ok,o.message);tick(r,60);assert.equal(at(r,'K1212'),before,'진로만으로는 그대로');
 say(r,'n15');tick(r,60);assert.notEqual(at(r,'K1212'),before,'통보 n15 뒤 출발');
});
test('A2: 회송열차는 열번 변경과 회송 출발 통보가 둘 다 있어야 떠난다',()=>{
 const r=start('P-em-02');rename(r,'K0604','G0604');tick(r,60);assert.equal(at(r,'G0604'),'dongmyo:2T','열번만 바꿔서는 떠나지 않는다');
 const p=r.snapshot().ftsRunLibrary.problems.find(p=>p.id==='P-em-02'),x=p.reactions.find(x=>x.id==='r-g0604');
 assert.deepEqual(JSON.stringify(x.when).match(/"communication","id":"n\d+"/g),['"communication","id":"n25"']);
});
test('A3: 여러 열차를 한꺼번에 보내는 반응은 한 대가 먼저 없어져도 나머지를 보낸다',()=>{
 const r=start('P-em-04'),gone=row(r,'K1114');assert.ok(r.command({type:'numbers',action:{op:'delete',...gone}}).ok);
 const before=at(r,'K1116');say(r,'n12');tick(r,120);
 const rx=r.snapshot().fts.session.items[0].reactions||{};assert.ok(Object.keys(rx).includes('r-n12')||at(r,'K1116')!==before,'r-n12가 일어난다');
 assert.ok((r.snapshot().scenario.jobs||[]).some(j=>j.number==='K1116'),'K1116 출발 작업이 생긴다');
});
test('A4: 「각 역 n분 추가정차」 통보 뒤 선행열차는 역마다 n분 더 서며 가고, 정상운행 통보가 추가정차를 푼다',()=>{
 const r=start('P-em-03');assert.equal(at(r,'K0446'),'guro:B953T');
 say(r,'n6');tick(r,240);assert.equal(at(r,'K0446'),'guro:B953T','가산디지털에서 5분 추가정차');
 assert.ok((r.snapshot().scenario.jobs||[]).some(j=>j.number==='K0446'&&/추가정차/.test(j.reason)));
 tick(r,120);assert.notEqual(at(r,'K0446'),'guro:B953T','5분 뒤 다음 역으로');
 say(r,'n28');tick(r,5);assert.ok(!(r.snapshot().scenario.jobs||[]).some(j=>j.number==='K0446'&&!['done','cancelled'].includes(j.phase)&&j.action.hold>0),'정상운행: 남은 추가정차 없음');
});
test('B1: 자동진로는 스케줄 있는 열차에 스케줄 진로만 낸다 · 번호를 바꾼 열차는 원래 스케줄을 쓴다 · 스케줄 없는 열차는 기다린다',()=>{
 const r=start('P-em-02'),ins=r.command({type:'numbers',action:{op:'insert',station:'dongmyo',slot:'B021T',number:'Z9999',direction:'up'}});assert.ok(ins.ok);
 const z=row(r,'Z9999');r.command({type:'scenario:move',auto:true,action:{op:'delete',...z}});tick(r,60);
 assert.equal(at(r,'Z9999'),'dongmyo:B021T','스케줄 없는 열차는 AUTO 역에서 진로를 받지 못한다');
 assert.ok((r.snapshot().scenario.jobs||[]).some(j=>j.number==='Z9999'&&/스케줄/.test(j.reason)));
 const g=row(r,'K0606');assert.ok(r.command({type:'numbers',action:{op:'rename',...g,number:'G0606'}}).ok);
 assert.deepEqual(r.snapshot().ls.stations[g.station].windows[g.slot].find(t=>t.uid===g.uid).was,['K0606'],'이전 번호가 남는다');
});
test('C1: 반대선 운행 열차의 열번을 역 너머로 옮기면 지나간 입환진로가 해정된다',()=>{
 const r=start('P-em-02');for(const st of ['jonggak','dongmyo']){ctl(r,st,{type:'mode',value:'CCM'});}
 ctl(r,'dongmyo',{type:'stop',id:'3A'});ctl(r,'dongmyo',{type:'stop',id:'1B'});ctl(r,'dongmyo',{type:'stop',id:'4A'});ctl(r,'jonggak',{type:'stop',id:'2A'});ctl(r,'jonggak',{type:'stop',id:'1A'});ctl(r,'jonggak',{type:'stop',id:'4A'});tick(r,95);
 assert.ok(ctl(r,'jonggak',{type:'route',id:'51-1T'}).ok);assert.ok(ctl(r,'dongmyo',{type:'route',id:'24-B015T'}).ok);
 const k=row(r,'K0608');assert.ok(r.command({type:'numbers',action:{op:'move',...k,targetStation:'dongmyo',targetSlot:'B011T'}}).ok);
 assert.equal(r.snapshot().states.jonggak.routes['51-1T'],undefined);assert.equal(r.snapshot().states.dongmyo.routes['24-B015T'],undefined);
});

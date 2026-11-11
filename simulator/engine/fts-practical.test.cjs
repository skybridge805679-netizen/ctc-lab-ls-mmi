'use strict';
// 철도관제시스템 운용 실기 10항목 (실기평가서 Ⅱ): 지정한 화면(L/S · MMI)에서 한 조작만 인정되고, 10항목이 모두 풀린다
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./runtime.cjs');
function start(){const r=R.create();r.command({type:'fts',op:'bootstrap'});assert.ok(r.command({type:'fts',op:'start',scenario:'SC-OP',professor:'001',student:'tester',autoRun:false}).ok);r.command({type:'tick',seconds:1});return r;}
const item=r=>{const s=r.snapshot().fts.session;return s.items[s.current];},lib=r=>r.snapshot().ftsRunLibrary;
const ctl=(r,action)=>r.command({type:'control',station:'uiwang',action}),num=(r,action)=>r.command({type:'numbers',action:{station:'uiwang',...action}});
const prof=(r,key)=>assert.ok(r.command({type:'fts',op:'manual',key,checked:true}).ok,key),tick=r=>r.command({type:'tick',seconds:2});
const next=(r,id)=>{tick(r);const s=r.snapshot().fts.session,done=s.items.find(x=>x.problem===id);assert.equal(done.status,'완료',id+' '+JSON.stringify(done.obj));assert.equal(done.score,100,id);};
test('the ten 실기 items of 평가서 Ⅱ are graded from real L/S and MMI operations',()=>{
 const r=start();assert.deepEqual(lib(r).situations.find(s=>s.id==='S-OP').problems.map(p=>p.slice(5)),['MODE','ROUTE','POINT','NUMBER','TRACE','SCAN','SIGN','RESTART','OVERVIEW','NOTE']);
 // 1 제어모드
 assert.equal(item(r).problem,'P-OP-MODE');ctl(r,{type:'mode',value:'CCM',source:'LS'});const local=ctl(r,{type:'mode',value:'LOCAL',source:'LS'});assert.ok(local.ok);
 const pending=r.snapshot().states.uiwang.pending;assert.ok(pending,'현장 인계 응답 대기');
 for(const a of [{type:'handover',accept:true},{type:'respond',accept:true},{type:'pending',accept:true},{type:'accept'}])if(r.snapshot().states.uiwang.mode!=='LOCAL')ctl(r,a);
 if(r.snapshot().states.uiwang.mode!=='LOCAL')r.command({type:'tick',seconds:30});
 assert.equal(r.snapshot().states.uiwang.mode,'LOCAL');ctl(r,{type:'mode',value:'CCM',source:'LS'});
 for(const a of [{type:'handover',accept:true},{type:'respond',accept:true},{type:'accept'}])if(r.snapshot().states.uiwang.mode!=='CCM')ctl(r,a);
 if(r.snapshot().states.uiwang.mode!=='CCM')r.command({type:'tick',seconds:30});
 assert.ok(ctl(r,{type:'mode',value:'AUTO',source:'LS'}).ok);next(r,'P-OP-MODE');
 // 2 진로제어: 화면을 바꿔 하면 인정되지 않는다
 assert.equal(item(r).problem,'P-OP-ROUTE');ctl(r,{type:'mode',value:'CCM',source:'LS'});
 assert.ok(ctl(r,{type:'route',id:'1A-2T',source:'MMI'}).ok);tick(r);assert.equal(item(r).obj.ls,undefined,'MMI에서 한 1A-2T는 L/S 과제로 인정하지 않는다');
 ctl(r,{type:'stop',id:'1A',source:'LS'});r.command({type:'tick',seconds:95});assert.ok(ctl(r,{type:'route',id:'1A-2T',source:'LS'}).ok);tick(r);assert.notEqual(item(r).obj.ls,undefined);
 assert.ok(ctl(r,{type:'route',id:'2A-5T',source:'MMI'}).ok);next(r,'P-OP-ROUTE');
 // 3 선로전환기
 assert.equal(item(r).problem,'P-OP-POINT');ctl(r,{type:'mode',value:'CCM',source:'LS'});
 assert.ok(ctl(r,{type:'point',id:'21',value:'R',source:'LS'}).ok);assert.ok(ctl(r,{type:'point',id:'22',value:'R',source:'MMI'}).ok);next(r,'P-OP-POINT');
 // 4 열차번호
 assert.equal(item(r).problem,'P-OP-NUMBER');
 assert.ok(num(r,{op:'insert',slot:'2T',number:'K9001',direction:'down'}).ok);assert.ok(num(r,{op:'insert',source:'MMI',slot:'5T',number:'K9002',direction:'up'}).ok);next(r,'P-OP-NUMBER');
 // 5 열차추적 (지적확인 환호는 교수 확인)
 assert.equal(item(r).problem,'P-OP-TRACE');assert.ok(Object.values(r.snapshot().ls.stations.uiwang.windows).flat().some(t=>t.number==='K9005'));
 r.command({type:'practice',name:'trace',id:'K9005',source:'MMI'});tick(r);assert.equal(item(r).status,'진행','환호 확인 전');prof(r,'call-trace');next(r,'P-OP-TRACE');
 // 6 베이스스캔
 assert.equal(item(r).problem,'P-OP-SCAN');ctl(r,{type:'scan',scope:'current',source:'LS'});tick(r);assert.equal(item(r).obj.mmi,undefined);ctl(r,{type:'scan',scope:'current',source:'MMI'});next(r,'P-OP-SCAN');
 // 7 L/S 표지판
 assert.equal(item(r).problem,'P-OP-SIGN');const b=num(r,{op:'boardAdd',kind:'선로일시사용정지',text:'선로일시사용정지',x:300,y:300});assert.ok(b.ok,b.message);prof(r,'call-sign');next(r,'P-OP-SIGN');
 // 8 L/S 재실행  9 오버뷰  10 노트
 assert.equal(item(r).problem,'P-OP-RESTART');r.command({type:'practice',name:'lsRestart',station:'uiwang',source:'LS'});prof(r,'call-restart');next(r,'P-OP-RESTART');
 assert.equal(item(r).problem,'P-OP-OVERVIEW');r.command({type:'practice',name:'overview',id:'north',source:'LS'});tick(r);assert.equal(item(r).obj.overview,undefined,'지정 구간이 아닌 오버뷰');
 r.command({type:'practice',name:'overview',id:'south',source:'LS'});prof(r,'call-overview');next(r,'P-OP-OVERVIEW');
 assert.equal(item(r).problem,'P-OP-NOTE');r.command({type:'practice',name:'note',id:'N0001',source:'MMI'});prof(r,'call-note');tick(r);
 const s=r.snapshot().fts;assert.ok(s.session.finished);assert.equal(s.history[0].got,s.history[0].full);
});
test('the oral scenario lists the professor\'s questions with their answers; an unknown practice event is refused',()=>{
 const r=R.create();r.command({type:'fts',op:'bootstrap'});const l=r.snapshot().ftsLibrary,all=l.situations.find(s=>s.id==='S-ORAL-ALL').problems;
 assert.equal(all.length,24);for(const id of all){const p=l.problems.find(p=>p.id===id);assert.ok(p.checks[0].condition.type==='manual',id);if(!['P-ORAL-MODE','P-ORAL-SCAN','P-ORAL-TRACE'].includes(id))assert.ok(p.actions.length>20,id);}
 assert.match(l.problems.find(p=>p.id==='P-ORAL-APPROACH').actions,/장내 90초, 출발 30초/);
 assert.throws(()=>r.command({type:'practice',name:'anything'}));
});
// 열차운행선 관리 — 지장작업 5단계 (실기평가서 Ⅲ): 단계마다 감점 5줄, LOCAL · 표지판이 다음 단계로 이어진다
test('the five 지장작업 stages run as one situation: signs and LOCAL carry over, each stage is graded on its five lines',()=>{
 const r=R.create();r.command({type:'fts',op:'bootstrap'});const l=r.snapshot().ftsLibrary;
 for(const id of l.situations.find(s=>s.id==='S-WORK').problems){const p=l.problems.find(p=>p.id===id);assert.equal(p.objectives.filter(o=>!o.id.startsWith('local-')&&!o.id.startsWith('auto-')).length+p.communications.length+(p.objectives.some(o=>/^(local|auto)-/.test(o.id))?1:0)>=5,true,id+' 감점 5줄');}
 assert.ok(r.command({type:'fts',op:'start',scenario:'SC-03',professor:'001',student:'tester',autoRun:false}).ok);r.command({type:'tick',seconds:1});
 const S=()=>r.snapshot(),cur=()=>{const s=S().fts.session;return s.items[s.current];},ctl=(station,action)=>r.command({type:'control',station,action:{...action,source:'LS'}});
 const board=(station,kind)=>{const x=r.command({type:'numbers',action:{op:'boardAdd',station,kind,text:kind==='서행표시'?'25':kind,x:300,y:300}});assert.ok(x.ok,x.message);return x;};
 const comms=()=>{const p=S().ftsRunLibrary.problems.find(p=>p.id===cur().problem);for(const c of p.communications)assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+c.id,checked:true}).ok,c.id);};
 const finish=id=>{r.command({type:'tick',seconds:2});const it=S().fts.session.items.find(x=>x.problem===id);assert.equal(it.status,'완료',id+' '+JSON.stringify(it.obj));assert.equal(it.score,100,id);};
 const hand=(station,value)=>{assert.ok(ctl(station,{type:'mode',value}).ok);if(S().states[station].pending)assert.ok(ctl(station,{type:'handover',accept:true}).ok!==false);assert.equal(S().states[station].mode,value,station+' '+value);};
 // 1 계획수립: 표지판 · 노트 · 통보
 assert.equal(cur().problem,'P-WORK-1');board('geumcheon','선로일시사용정지');r.command({type:'practice',name:'note',id:'N1',source:'MMI'});r.command({type:'tick',seconds:2});assert.equal(cur().status,'진행','통보 전');comms();finish('P-WORK-1');
 // 2 단전 · 승인: 양 끝 역 LOCAL
 assert.equal(cur().problem,'P-WORK-2');comms();board('anyang','전차선단전');for(const st of ['geumcheon','anyang']){hand(st,'CCM');hand(st,'LOCAL');}finish('P-WORK-2');
 // 3 열차통제: LOCAL과 표지판이 그대로 남아 있다
 assert.equal(cur().problem,'P-WORK-3');assert.equal(S().states.anyang.mode,'LOCAL');assert.equal(S().ls.stations.geumcheon.boards.length,1);board('geumcheon','서행표시');comms();finish('P-WORK-3');
 // 4 완료 · 급전: 제어권 인수 → AUTO, 표지판 철거
 assert.equal(cur().problem,'P-WORK-4');comms();for(const st of ['geumcheon','anyang']){hand(st,'CCM');assert.ok(ctl(st,{type:'mode',value:'AUTO'}).ok);}
 const b=S().ls.stations.geumcheon.boards[0];assert.ok(r.command({type:'numbers',action:{op:'boardDelete',station:'geumcheon',id:b.id}}).ok);finish('P-WORK-4');
 // 5 최초열차: 통보 3 뒤에 K0401이 떠나 작업구간을 지난다
 assert.equal(cur().problem,'P-WORK-5');const at=()=>Object.entries(S().ls.stations).flatMap(([st,x])=>Object.entries(x.windows).filter(([,rows])=>rows.some(t=>t.number==='K0401')).map(([slot])=>st+':'+slot));
 assert.deepEqual(at(),['geumcheon:2T']);r.command({type:'tick',seconds:60});assert.deepEqual(at(),['geumcheon:2T'],'통보 전에는 떠나지 않는다');
 comms();for(let i=0;i<40&&cur()?.problem==='P-WORK-5'&&cur().status==='진행';i++)r.command({type:'tick',seconds:5});
 const s=S().fts;assert.ok(s.session.finished);assert.equal(s.history[0].got,s.history[0].full);assert.ok(!at().includes('geumcheon:2T'));
});

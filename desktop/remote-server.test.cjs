'use strict';
// 원격 조작 서버: PIN 로그인 · 모바일은 리모컨(FTS 진행)만 · PC는 앱 화면 · 세션 파일/초기화 금지 · PIN 잠금 · 끄면 접속 종료
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),R=require('../simulator/engine/runtime.cjs'),S=require('./remote-server.cjs');
const MOBILE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148',PC='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140';
function setup(){
 const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S-G',name:'g',problems:['P-em-01']});lib.scenarios.push({id:'SC-G',name:'원격 시험',situations:['S-G']});r.command({type:'fts',op:'library',library:lib});
 const srv=S.create({root:path.join(__dirname,'../simulator'),request:(action,since,reply,version)=>{try{const result=r.command(action);reply({result,snapshot:r.transport(version,since)});}catch(e){reply({error:e.message});}}});
 return {r,srv};
}
async function login(base,pin,ua){const res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':ua},body:JSON.stringify({pin})});return {res,json:await res.json(),cookie:(res.headers.get('set-cookie')||'').split(';')[0]};}
const api=(base,cookie,ua,action,extra={})=>fetch(base+'/api/request',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':ua,Cookie:cookie},body:JSON.stringify({action,since:0,version:-1,...extra})});
test('PIN 로그인과 기기별 권한: 모바일은 리모컨만, PC는 앱 화면',async()=>{
 const {r,srv}=setup(),info=await srv.start(0),base=`http://127.0.0.1:${info.port}`;
 try{
  assert.match(info.pin,/^\d{4}$/);assert.ok(info.on);
  assert.equal((await fetch(base+'/index.html',{headers:{'User-Agent':PC}})).status,200,'로그인 전에는 로그인 화면');
  assert.match(await (await fetch(base+'/',{headers:{'User-Agent':PC}})).text(),/PIN을 입력하세요/);
  assert.equal((await api(base,'',MOBILE,{type:'remote:view'})).status,401,'로그인 전 명령 거부');
  const wrong=await login(base,info.pin==='0000'?'1111':'0000',MOBILE);assert.equal(wrong.res.status,401);
  const m=await login(base,info.pin,MOBILE);assert.ok(m.json.ok);assert.equal(m.json.role,'remote');assert.match(m.cookie,/^orpheia_remote=[a-f0-9]{48}$/);
  assert.match(await (await fetch(base+'/',{headers:{'User-Agent':MOBILE,Cookie:m.cookie}})).text(),/ORPHEIA 리모컨/,'모바일은 리모컨 화면');
  assert.equal((await fetch(base+'/ui/fts.js',{headers:{'User-Agent':MOBILE,Cookie:m.cookie}})).status,403,'모바일은 앱 화면 파일을 열 수 없다');
  assert.equal((await api(base,m.cookie,MOBILE,{type:'control',station:'jonggak',action:{type:'mode',value:'CCM',source:'LS'}})).status,403,'모바일은 LS/MMI 조작 금지');
  assert.equal((await api(base,m.cookie,MOBILE,{type:'fts',op:'library',library:{}})).status,403,'모바일은 문제·시나리오 편집 금지');
  let v=(await (await api(base,m.cookie,MOBILE,{type:'remote:view'})).json()).view;assert.equal(v.active,false);
  assert.ok(v.setup.scenarios.some(s=>s.id==='SC-G'&&s.count===1),'교육 전에는 시나리오 목록');assert.ok(v.setup.professors.length&&v.setup.students.some(s=>s.id==='tester'));
  // 리모컨에서 교육 시작: 허용한 필드만 엔진에 간다 (끼워 보낸 library는 버린다)
  const started=await (await api(base,m.cookie,MOBILE,{type:'fts',op:'start',scenario:'SC-G',professor:v.setup.professors[0].id,student:'tester',library:{problems:[]}})).json();
  assert.equal(started.result.ok,true,JSON.stringify(started));assert.ok(r.snapshot().ftsLibrary.problems.length>10,'라이브러리는 그대로');r.command({type:'tick',seconds:2});
  v=(await (await api(base,m.cookie,MOBILE,{type:'remote:view'})).json()).view;assert.equal(v.active,true);assert.equal(v.scenario,'원격 시험');assert.ok(v.comms.length>5);
  const j=await (await api(base,m.cookie,MOBILE,{type:'fts',op:'manual',key:v.comms[0].key})).json();assert.notEqual(j.result?.ok,false,JSON.stringify(j));assert.notEqual(j.view.comms[0].at,null,'통보 확인이 엔진에 반영되고 요약이 함께 온다');
  assert.ok(srv.info().clients.some(c=>c.role==='remote'));
  const p=await login(base,info.pin,PC);assert.equal(p.json.role,'pc');
  const home=await fetch(base+'/',{headers:{'User-Agent':PC,Cookie:p.cookie},redirect:'manual'});assert.equal(home.status,302);assert.equal(home.headers.get('location'),'/index.html?remote=1');
  assert.equal((await fetch(base+'/ui/fts.js',{headers:{'User-Agent':PC,Cookie:p.cookie}})).status,200);
  const ctl=await (await api(base,p.cookie,PC,{type:'control',station:'jonggak',action:{type:'mode',value:'CCM',source:'LS'}})).json();assert.equal(ctl.result.ok,true,'PC는 LS 조작 가능');assert.ok(ctl.snapshot.states);
  assert.equal((await api(base,p.cookie,PC,{type:'session:save',file:'/tmp/x'})).status,403,'PC도 세션 파일 금지');
  assert.equal((await fetch(base+'/../desktop/main.cjs',{headers:{'User-Agent':PC,Cookie:p.cookie}})).status!==200,true,'시뮬레이터 폴더 밖 파일 금지');
 }finally{srv.stop();}
 assert.equal(srv.info().on,false);assert.equal(srv.info().clients.length,0);
});
test('PIN을 5번 틀리면 1분 잠금, 끊기(kick) 하면 그 기기는 다시 로그인해야 한다',async()=>{
 const {srv}=setup(),info=await srv.start(0),base=`http://127.0.0.1:${info.port}`,bad=info.pin==='0000'?'1111':'0000';
 try{
  for(let i=0;i<5;i++)assert.equal((await login(base,bad,PC)).res.status,401);
  assert.equal((await login(base,info.pin,PC)).res.status,429,'잠금 중에는 맞는 PIN도 거부');
 }finally{srv.stop();}
 const info2=await srv.start(0),base2=`http://127.0.0.1:${info2.port}`;
 try{const m=await login(base2,info2.pin,MOBILE);assert.equal((await api(base2,m.cookie,MOBILE,{type:'remote:view'})).status,200);
  srv.kick(srv.info().clients[0].id);assert.equal((await api(base2,m.cookie,MOBILE,{type:'remote:view'})).status,401);
 }finally{srv.stop();}
});
test('리모컨 명령 허용 목록',()=>{
 assert.ok(S.remoteAllowed({type:'fts',op:'voice',text:'K1210열차 금천구청역 정차'}));assert.ok(!S.remoteAllowed({type:'fts',op:'voice'}));assert.ok(!S.remoteAllowed({type:'fts',op:'voice',text:'x'.repeat(501)}));      // 음성 1인 모드: 휴대폰 키보드 음성 입력 무전
 assert.deepEqual(S.remoteAction({type:'fts',op:'voice',text:'K1210',extra:1}),{type:'fts',op:'voice',text:'K1210'});
 assert.ok(S.remoteAllowed({type:'remote:view'}));assert.ok(S.remoteAllowed({type:'fts',op:'manual',key:'comm:n1'}));assert.ok(S.remoteAllowed({type:'fts',op:'next'}));
 assert.ok(S.remoteAllowed({type:'fts',op:'start',scenario:'a',professor:'b',student:'c'}));assert.deepEqual(S.remoteAction({type:'fts',op:'start',scenario:'a',professor:'b',student:'c',library:{},autoRun:false}),{type:'fts',op:'start',scenario:'a',professor:'b',student:'c'});
 for(const a of [{type:'poll'},{type:'fts',op:'start'},{type:'fts',op:'library'},{type:'numbers'},{type:'control'},{type:'fts',op:'manual'}])assert.equal(S.remoteAllowed(a),false,JSON.stringify(a));
 assert.equal(S.pcAllowed({type:'session:open'}),false);assert.ok(S.pcAllowed({type:'control'}));
});

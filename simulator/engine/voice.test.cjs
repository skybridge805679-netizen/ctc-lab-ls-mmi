const test=require('node:test'),assert=require('node:assert/strict');
const V=require('./voice.js'),F=require('./fts.js'),R=require('./runtime.cjs');
const plan=id=>V.plan(F.seed().problems.find(p=>p.id===id));
test('음성인식 결과를 열번으로 읽는다: 한글 숫자 · 흔들린 숫자 · 조사',()=>{
 const known=['K1208','K1210','K1212','K1214','A0168','K0452','K0454'];
 assert.equal(V.normalize('케이 천이백십 열차 금천구청역 정차'),'K1210 열차 금천구청역 정차');      // 「금천구청」의 천은 숫자가 아니다
 assert.deepEqual(V.trainsIn('K11이 열차 석수역 정차',known),['K1212']);
 assert.deepEqual(V.trainsIn('가산 디지털력 K-1200 8 열차 차량 고장',known),['K1208']);
 assert.deepEqual(V.trainsIn('케이 공사오이 열차',known),['K0452']);
 assert.deepEqual(V.trainsIn('K1210이 출발합니다',known),['K1210']);
 assert.deepEqual(V.stationsIn('K1210차 금청구청역 정차'),['geumcheon']);assert.deepEqual(V.stationsIn('가산 디지털력'),['gasan']);assert.deepEqual(V.stationsIn('금정역'),['geumjeong']);
 assert.ok(V.isAck('철도관제 이상!'));assert.ok(!V.isAck('K1210열차 금천구청역 정차'));
});
test('대본의 통보 하나가 관제사의 말 한 마디씩 단계로 나뉘고, 한 문장에 이어 말한 단계도 알아듣는다',()=>{
 const P=plan('P-em-05-1'),n3=P.steps.filter(s=>s.comm==='n3'&&s.required);
 assert.equal(n3.length,5);assert.deepEqual(n3[1].stop,{number:'K1210',station:'geumcheon',kind:'정차'});assert.equal(n3[2].stop.station,'seoksu');
 assert.deepEqual(V.match(P,{},'K1212 석수역 정차',{current:'n3'}).map(m=>m.step.id),['n3#2']);
 // 긴 지시 속 열번 때문에 짧은 호출 단계(「K1208열차. 관제 이상!」)가 덩달아 인정되지 않는다
 assert.deepEqual(V.match(P,{},'A0168 열차 가산디지털역 K1208열차 차량고장으로 정차해 있습니다 진입시 주의운전하세요',{current:'n3'}).map(m=>m.step.id),['n3#0']);
 assert.deepEqual(V.match(P,{'n3#2':0},'K1212 석수역 정차',{current:'n3'}),[],'0초에 한 말도 한 것');
});
test('음성 1인 모드: 「K1210열차 금천구청역 정차」를 들으면 K1210만 그 역에 서고, 정차 지시를 받지 못한 열차는 달려간다',()=>{
 const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S',name:'v',problems:['P-em-05-1']});lib.scenarios.push({id:'SC',name:'v',situations:['S']});
 r.command({type:'fts',op:'library',library:lib});assert.ok(r.command({type:'fts',op:'start',scenario:'SC',professor:'001',student:'tester',autoRun:false,voice:true}).ok);
 const at=n=>{for(const [st,s] of Object.entries(r.snapshot().ls.stations))for(const [sl,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return st+':'+sl;};
 const v=()=>r.snapshot().fts.session.voice.items[0];
 assert.match(v().queue[0].text,/K1208열차 이상/,'수보: 고장열차 기관사가 먼저 무전한다');
 const o=r.command({type:'fts',op:'voice',text:'케이 천이백십 열차 금천구청역 정차'});assert.deepEqual(o.matched.map(m=>m.id),['n3#1']);
 assert.match(v().queue.at(-1).text,/K1210 열차. 수신 이상/,'그 말의 상대 대사');
 for(let i=0;i<60;i++)r.command({type:'tick',seconds:5});
 assert.equal(at('K1210'),'geumcheon:5T','정차 지시를 받은 열차는 그 역에 선다');
 assert.notEqual(at('K1212'),'geumcheon:B967T','지시를 받지 못한 열차는 석수역을 떠나 달린다');
 assert.equal(r.snapshot().fts.session.manual[0]?.['comm:n3'],undefined,'통보 n3의 다른 말을 아직 하지 않았다');
});
test('대본의 모든 상대 대사·안내는 미리 만든 음성 파일이 있다 (대본이 바뀌면 node tools/build-voice-lines.cjs)',()=>{
 const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../assets/voice'),index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
 const missing=[];for(const p of F.seed().problems.filter(p=>/^P-(em|ev)/.test(p.id)))for(const l of V.linesOf(p)){const k=V.lineKey(l);if(!index[k]||!fs.existsSync(path.join(dir,k+'.ogg')))missing.push(p.id+' '+l.name+': '+l.text.slice(0,30));}
 assert.deepEqual(missing.slice(0,5),[],missing.length+'줄 음성 없음');
 assert.equal(V.readable('K1210 열차. 관제승인 3호로 K0452열차'),'케이 천이백십 열차. 관제승인 삼호로 케이 공사오이열차');
});

test('긴 단계를 숨 쉬며 나눠 말해도 합쳐서 알아듣는다 (비상 06-1 13번: 안내방송 / 호출) · 비슷한 소리 · 앞 마디의 열차',()=>{
 const V=require('./voice.js'),F=require('./fts.js');
 const p=F.seed().problems.find(p=>p.id==='P-em-06-1'),P=V.plan(F.view(p,{status:'진행'}));
 const start=()=>{const ti=P.steps.findIndex(s=>s.id==='n13#0'),done={};P.steps.slice(0,ti).forEach(s=>done[s.id]=1);const near=[];for(const s of P.steps)if(done[s.id]==null&&s.required&&near.length<4)near.push(s.id);return {done,near,mem:{}};};
 const say=(st,t)=>{const r=V.match(P,st.done,t,{current:'n13',near:st.near,memory:st.mem});if(!r.length&&r.partial)(st.mem[r.partial.id]??=[]).push(t);r.forEach(h=>st.done[h.step.id]=1);return r;};
 // 실제로 받아써진 말 (인접선→인정성, 재개→제기, 역간→역 관, 안양역→아내로)
 const A='철도관제에서 열립니다. 석수 관악역 관, 열차 화재지점, 인정성 열차 운행 제기하겠습니다. 호출하는 열차는 사고지점 운행하는 최초 열차이니 사고지점에서 관악역 관 주의운전 바랍니다.',B='금천구청역 A1001열차 금천구청역 K401열차 아내로 A1004열차 신호 확인 출발.';
 for(const order of [[A,B],[B,A]]){const st=start(),r1=say(st,order[0]);assert.equal(r1.length,0,'한 마디만으로는 아직');assert.equal(r1.partial?.id,'n13#0','일부로 기억');
  const r2=say(st,order[1]);assert.deepEqual(r2.map(h=>h.step.id),['n13#0'],'두 마디를 합쳐 인정');}
 const st=start();say(st,A);const R=V.remaining(P.steps.find(s=>s.id==='n13#0'),st.mem['n13#0']);
 assert.ok(R.got>=2&&R.got<R.parts&&!/철도관제에서 알립니다/.test(R.rest)&&/신호 확인 출발/.test(R.rest),'남은 말은 호출 부분: '+R.rest);
 // 받침 빠짐·모음 바뀜으로 받아써진 정차 지시 (「아양역 추바정지」)
 const q=F.seed().problems.find(p=>p.id==='P-em-03'),Q=V.plan(F.view(q,{status:'진행'})),stop=Q.steps.find(s=>s.stop&&s.stop.kind==='출발정지');
 const d={};Q.steps.slice(0,Q.steps.indexOf(stop)).forEach(s=>d[s.id]=1);
 const noisy=stop.text.replace('안양','아양').replace('출발','추바');assert.ok(V.match(Q,d,noisy,{current:stop.comm,near:[stop.id]}).some(h=>h.step.id===stop.id),noisy);
});

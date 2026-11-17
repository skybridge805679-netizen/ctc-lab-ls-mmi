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

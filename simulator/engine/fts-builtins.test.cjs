const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./runtime.cjs'),F=require('./fts.js'),B=require('./fts-builtins.js'),EM=require('./emergency.js'),SC=require('./scenarios.js');
// 대피 5종 · 비상 9종 대본을 바꾼 능동형 문제: 형식이 맞고, 대본과 다른 순서로 조작해도 모두 풀린다.
const problems=B.all({});
const libraryOf=p=>{const next=structuredClone(p);delete next.setup.clearTimetable;next.setup.scheduleId='TEST';return {version:F.VERSION,problems:[next],situations:[{id:'S',name:'S',section:'',scheduleId:'',limit:0,timetable:null,problems:[p.id]}],scenarios:[{id:'SC',name:'SC',situations:['S']}],schedules:[{id:'TEST',relative:true,timetable:B.timetableFor(p)}]};};
const refs=(c,out=[])=>{if(!c)return out;if(c.type==='objective')out.push(c.id);(c.conditions||[]).forEach(k=>refs(k,out));refs(c.condition,out);return out;};
// 선행 조건(목표 · 상황 반응)을 벗긴 실제 조건
const gated=c=>c.type==='all'&&['objective','reaction'].includes(c.conditions[0].type)?c.conditions[1]:c;
const waits=(c,out=[])=>{if(!c)return out;if(c.type==='reaction')out.push(c.id);(c.conditions||[]).forEach(k=>waits(k,out));waits(c.condition,out);return out;};
const leaf=(c,type)=>c.type===type?c:(c.conditions||[]).map(k=>leaf(k,type)).find(Boolean)||(c.condition&&leaf(c.condition,type))||null;

// 대본과 다른 순서: 목표는 목록 뒤쪽(나중 역 · 나중 단계)부터 할 수 있는 것을 고르고, 통보는 그 뒤에 대본과 거꾸로 확인한다.
function solve(p0,{log=false,branches=[],first=[]}={}){
 const p1=p0;
 const r=R.create(),S=()=>r.snapshot(),item=()=>S().fts.session.items[0];
 assert.ok(r.command({type:'fts',op:'library',library:libraryOf(p0)}).ok);
 const started=r.command({type:'fts',op:'start',scenario:'SC',professor:'001',student:'tester',autoRun:false});assert.ok(started.ok,started.message);
 r.command({type:'tick',seconds:1});
 // 상황 변경: 교수가 모니터링에서 주입한 것처럼 켠 뒤, 그 분기가 반영된 목표·통보로 푼다
 // 상황 변경이 주입되는 시점까지 이미 한 통보 (예: 비상 04 — 통보 12로 A1003이 떠난 뒤에 후속 A1005가 근접한다)
 for(const id of first){assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+id,checked:true}).ok);for(let i=0;i<24;i++)r.command({type:'tick',seconds:5});}
 for(const id of branches){const x=r.command({type:'fts',op:'manual',key:'branch:'+id});assert.ok(x.ok,x.message);}
 r.command({type:'tick',seconds:0});
 assert.deepEqual(Object.keys(item().branch||{}).sort(),[...branches].sort());
 const p=F.view(p1,item());
 const row=n=>{for(const [station,s] of Object.entries(S().ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return {station,slot,uid:x.uid,direction:x.direction};return null;};
 const control=(station,action)=>r.command({type:'control',station,action});
 const ccm=st=>S().states[st].mode==='CCM'||control(st,{type:'mode',value:'CCM'}).ok;
 const order=[];let commsDone=false;
 const done=()=>item().obj||{};
 const ready=o=>{const d=done();if(refs(o.condition).some(id=>d[id]==null))return false;if(waits(o.condition).some(id=>!item().reactions?.[id]?.fired))return false;if(o.condition.type==='alarmAck'&&o.condition.afterObjective&&d[o.condition.afterObjective]==null)return false;
  if(o.final)return p.objectives.every(x=>x.final||d[x.id]!=null);
  const k=gated(o.condition),st=k.station;
  if(k.type==='route')return p.objectives.filter(x=>x.condition.station===st&&['signalCancelled','signalStop'].includes(x.condition.type)).every(x=>d[x.id]!=null);
  if(o.condition.type==='signalStop')return p.objectives.filter(x=>x.condition.type==='signalCancelled'&&x.condition.station===st&&x.condition.signal===o.condition.signal).every(x=>d[x.id]!=null);
  return true;};
 function perform(o){
  // MMI 알람을 체크하고 [확인] (열차번호 중복 알람)
  if(o.condition.type==='alarmAck')return r.command({type:'alarm:ack',texts:['열차번호 중복 알람']}).ok;
  const c=gated(o.condition);
  // 열차가 스스로 지나가야 하는 목표(상황 반응의 열차 운행)는 진로를 내 주고 기다린다
  if(o.condition.type==='all'&&o.condition.conditions[0].type==='reaction'&&c.type==='trainGone')return false;
  if(o.final){const st=leaf(c,'mode').station;return control(st,{type:'mode',value:'AUTO'}).ok;}
  if(c.type==='event')return control(c.station,{type:'mode',value:c.value}).ok;
  if(c.type==='signalCancelled')return ccm(c.station)&&control(c.station,{type:'stop',id:c.signal}).ok;
  if(c.type==='signalStop')return false;                                           // 접근쇄정 시간이 지나기를 기다린다
  if(c.type==='schedule'){const t=structuredClone(S().timetable.trains.find(x=>x.id===c.train));if(!t)return false;t.calls.find(k=>k.station===c.station)[c.field]=c.value;return r.command({type:'timetable',method:'update',args:[c.train,t]}).ok!==false;}
  const k=c;
  if(k.type==='route'){if(!ccm(k.station))return false;if(control(k.station,{type:'route',id:k.route}).ok)return true;
   // 진로가 서지 않으면 관제사처럼 그 역에 남아 있는 다른 진로를 취소하고 해정을 기다린다
   const sig=k.route.split('-')[0];for(const id of Object.keys(S().states[k.station].routes))if(!id.startsWith(sig+'-'))control(k.station,{type:'withdraw',id});return false;}
  // 구원연결: 열번을 옮기지 않는다. 구원열차 출발 지시(통보)를 하고 열차가 전령법으로 도착하기를 기다린다
  const run=leaf(k,'trainRun');if(run){const rx=p.reactions.find(x=>x.do.some(d=>d.type==='runTrain'&&d.number===run.number&&d.legs.some(l=>l.rescue)));const comm=rx&&leaf(rx.when,'communication');if(comm&&!item().comm?.[comm.id])r.command({type:'fts',op:'manual',key:'comm:'+comm.id,checked:true});return false;}
  const at=leaf(k,'trainAt'),made=k.type==='all'?k.conditions[0]:null,gone=made?k.conditions[1]:leaf(k,'trainGone');
  if(at){const f=row(at.number);if(!f)return false;const slot=at.slot||EM.platform(at.station,f.direction);return f.station===at.station&&f.slot===slot||r.command({type:'numbers',action:{op:'move',...f,targetStation:at.station,targetSlot:slot}}).ok;}
  if(made&&gone){const f=row(gone.number);if(!f)return false;return r.command({type:'numbers',action:{op:'rename',...f,number:made.condition.number}}).ok;}
  if(gone){const f=row(gone.number);return !f||r.command({type:'numbers',action:{op:'delete',...f}}).ok;}
  throw new Error('no reference operation for '+o.id);
 }
 for(let pass=0;pass<240&&item().status==='진행';pass++){
  for(const o of [...p.objectives].reverse()){if(item().status!=='진행')break;if(done()[o.id]==null&&ready(o)&&perform(o))order.push(o.id);r.command({type:'tick',seconds:0});}
  // 통보는 조작을 다 한 뒤 대본과 거꾸로 확인한다 (운행 재개 통보를 신호 정지 전에 하면 열차가 먼저 지나가 버린다 — 실제와 같다)
  if(!commsDone&&p.objectives.every(o=>done()[o.id]!=null)){commsDone=true;for(const c of [...p.communications].reverse()){assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+c.id,checked:true}).ok);order.push('comm:'+c.id);}}
  r.command({type:'tick',seconds:5});
 }
 const it=item(),failed=S().fts.session&&r.snapshot();
 if(log)console.log(p.id,it.status,it.score,order.join(' '));
 return {item:it,order,missing:p.objectives.filter(o=>(it.obj||{})[o.id]==null).map(o=>o.id),error:it.error};
}

test('every built-in script becomes a valid active problem with no script dependency',()=>{
 assert.equal(problems.length,SC.list.length+EM.list.length);
 const lib={version:F.VERSION,problems,situations:[{id:'S',name:'S',problems:problems.map(p=>p.id)}],scenarios:[{id:'SC',name:'SC',situations:['S']}]};
 assert.deepEqual(F.validate(lib),[]);
 for(const p of problems){
  assert.equal(p.script,undefined);assert.ok(p.objectives.length>=4,p.id);assert.ok(p.communications.length>=8,p.id);
  assert.ok(p.objectives.some(o=>o.final),p.id+' AUTO 복귀');assert.match(p.actions,/참고 순서\(예시/);
  for(const x of p.setup.trains)assert.ok(p.setup.clear.includes(x.number),p.id+' '+x.number);
 }
 // 고장열차 스케줄은 교재 번호로 만들고, 출발진로 목표는 처음부터 이루어져 있지 않다
 const y=problems.find(p=>p.id==='P-yongsan-5');assert.ok(B.timetableFor(y).trains.some(t=>t.id==='A1002'));assert.ok(y.objectives.some(o=>o.condition.type==='schedule'&&o.condition.value==='3C_B605T'));
 // 번호를 바꾼 뒤에만 그 번호를 옮기거나 지울 수 있다 (순서가 꼭 필요한 곳만 묶는다)
 const e2=problems.find(p=>p.id==='P-em-02'),del=e2.objectives.find(o=>o.id==='delete-G0606');assert.deepEqual(refs(del.condition),['move-G0606']);
 assert.deepEqual(refs(e2.objectives.find(o=>o.id==='move-G0606').condition),['rename-G0606']);
 // 사고 발생 보고(첫 통보)의 열차 변화는 문제 시작과 함께, 다른 변화는 해당 통보·목표 뒤에 일어난다
 assert.equal(e2.reactions.find(r=>r.id==='r-n1').when,undefined);assert.ok(e2.reactions.filter(r=>r.id!=='r-n1').every(r=>r.when));
});

test('the FTS default library uses the active problems for 대피·비상 and keeps the schedule scripts',()=>{
 const scripts=['sch-create','sch-conflict'],lib=F.seed({scripts});
 assert.deepEqual(F.validate(lib,{scripts}),[]);
 assert.deepEqual(lib.problems.filter(p=>p.script).map(p=>p.script).sort(),[...scripts].sort());
 for(const p of problems)assert.ok(lib.problems.some(x=>x.id===p.id&&x.objectives?.length),p.id);
});

for(const p of problems)test(`${p.id}: solvable in an order different from the script`,()=>{
 const {item,order,missing,error}=solve(p);
 assert.equal(error,undefined);
 assert.deepEqual(missing,[],`${p.id} 남은 목표 · 순서 ${order.join(' ')}`);
 assert.equal(item.status,'완료');
 const script=p.objectives.map(o=>o.id),ops=order.filter(x=>!x.startsWith('comm:'));
 assert.notDeepEqual(ops,script.filter(id=>ops.includes(id)),'다른 순서로 풀어야 합니다');
 assert.ok(item.score>=90,`${p.id} 점수 ${item.score}`);
});
// 상황별 대응 요령: 분기 원문이 붙어 있고, 분기를 주입하면 그 분기의 목표·통보로 바뀌어도 풀린다
test('emergency problems carry the situation-change branches of the response guide',()=>{
 const em=Object.fromEntries(problems.filter(p=>p.id.startsWith('P-em-')).map(p=>[p.id,p]));
 for(const id of ['P-em-01','P-em-02','P-em-03','P-em-04','P-em-05','P-em-06','P-em-06-1'])assert.ok(em[id].branches.length>=2,id);
 for(const p of Object.values(em))for(const b of p.branches||[]){assert.ok(b.text.length>3,b.id);assert.ok(b.communications.every(c=>c.text.trim()),p.id+' '+b.id);assert.doesNotMatch(b.text,/[\uE000-\uF8FF]/);}
 const delay=em['P-em-04'].branches.find(b=>b.id==='v-delay');assert.deepEqual(delay.drop,['n18','n19']);assert.match(delay.communications[0].text,/조치지연 수신/);
 const view=F.view(em['P-em-05'],{branch:{'v-bogie':0}});assert.ok(!view.objectives.some(o=>o.id==='rename-G1210'));assert.ok(view.communications.some(c=>c.id==='v13'));
 assert.equal(F.view(em['P-em-05'],{branch:{}}),em['P-em-05']);
 assert.ok(em['P-em-03'].communications.find(c=>c.id==='proactive')?.optional);
});
for(const [id,branches,first=[]] of [['P-em-05',['v-bogie']],['P-em-04',['v-delay','v-a1005'],['n12']],['P-em-01',['v-k1008-approach','v-k1006-passed']],['P-em-01',['v-k1008-far']],['P-em-06',['v-self-run-first']],['P-em-02',['v-derail-k604','v-point-23b']]])
 test(`${id} with ${branches.join('+')}: solvable after the situation changes`,()=>{
  const p=problems.find(x=>x.id===id),{item,missing,error}=solve(p,{branches,first});
  assert.equal(error,undefined);assert.deepEqual(missing,[]);assert.equal(item.status,'완료');
 });
test('비상 04 starts with the straight routes; 통보 12 sends the adjacent trains off; A1005 passes Anyang on automatic routes only in AUTO',()=>{
 const p=problems.find(x=>x.id==='P-em-04'),r=R.create(),S=()=>r.snapshot(),item=()=>S().fts.session.items[0];
 assert.ok(r.command({type:'fts',op:'library',library:libraryOf(p)}).ok);assert.ok(r.command({type:'fts',op:'start',scenario:'SC',professor:'001',student:'tester',autoRun:false}).ok);
 r.command({type:'tick',seconds:1});
 // 시작: K0811은 하2선 정상 출발 진로(4B-B984T), 운행선 변경용 4B-B660T는 서 있지 않다. A1003은 하1선 3T
 assert.ok(S().states.anyang.routes['4B-B984T']);assert.equal(S().states.anyang.routes['4B-B660T'],undefined);
 const where=n=>Object.entries(S().ls.stations).flatMap(([st,x])=>Object.entries(x.windows).filter(([,rows])=>rows.some(t=>t.number===n)).map(([slot])=>st+':'+slot));
 assert.deepEqual(where('A1003'),['anyang:3T']);assert.deepEqual(where('K0809'),['geumjeong:2T']);
 // 통보 12 「각 열차 신호 확인 출발」: A1003·A0346·K1114·K1116·K1118이 떠난다
 assert.ok(r.command({type:'fts',op:'manual',key:'comm:n12',checked:true}).ok);for(let i=0;i<40;i++)r.command({type:'tick',seconds:5});
 for(const n of ['A1003','A0346','K1114','K1116','K1118'])assert.deepEqual(where(n),[],n+' 출발');
 // 후속 A1005 근접(상황2): 4B만 해정하고 1B·4C는 진행을 유지해야 A1005가 지나간다 — CCM에서는 자동 진로가 서지 않고, AUTO로 돌리면 1B-3T · 4C-B660T 자동 진로로 통과한다
 const anyang=a=>r.command({type:'control',station:'anyang',action:a});
 anyang({type:'mode',value:'CCM'});assert.ok(anyang({type:'stop',id:'4B'}).ok!==false);
 assert.ok(r.command({type:'fts',op:'manual',key:'branch:v-a1005'}).ok);r.command({type:'tick',seconds:2});
 const at=()=>where('A1005');
 assert.deepEqual(at(),['anyang:B658T']);
 r.command({type:'tick',seconds:120});assert.deepEqual(at(),['anyang:B658T'],'CCM에서는 자동 진로가 서지 않는다');
 anyang({type:'mode',value:'AUTO'});
 for(let i=0;i<120&&at().length;i++)r.command({type:'tick',seconds:5});
 assert.deepEqual(at(),[],'4B 해정 · AUTO 복귀 뒤 A1005가 자동 진로로 통과한다');assert.notEqual(item().obj['a1005-passed'],undefined);
 assert.deepEqual(where('K0811'),['anyang:2T'],'K0811은 운행선 변경 진로를 받을 때까지 안양 2T에 선다');
});
module.exports={solve,problems};

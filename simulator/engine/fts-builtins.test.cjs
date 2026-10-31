const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./runtime.cjs'),F=require('./fts.js'),B=require('./fts-builtins.js'),EM=require('./emergency.js'),SC=require('./scenarios.js');
// 대피 5종 · 비상 9종 대본을 바꾼 능동형 문제: 형식이 맞고, 대본과 다른 순서로 조작해도 모두 풀린다.
const problems=B.all({});
const libraryOf=p=>({version:F.VERSION,problems:[p],situations:[{id:'S',name:'S',section:'',scheduleId:'',limit:0,timetable:null,problems:[p.id]}],scenarios:[{id:'SC',name:'SC',situations:['S']}],schedules:[]});
const refs=(c,out=[])=>{if(!c)return out;if(c.type==='objective')out.push(c.id);(c.conditions||[]).forEach(k=>refs(k,out));refs(c.condition,out);return out;};
const leaf=(c,type)=>c.type===type?c:(c.conditions||[]).map(k=>leaf(k,type)).find(Boolean)||(c.condition&&leaf(c.condition,type))||null;

// 대본과 다른 순서: 통보를 먼저 모두 거꾸로 확인하고, 목표는 목록 뒤쪽(나중 역 · 나중 단계)부터 할 수 있는 것을 고른다.
function solve(p,{log=false}={}){
 const r=R.create(),S=()=>r.snapshot(),item=()=>S().fts.session.items[0];
 assert.ok(r.command({type:'fts',op:'library',library:libraryOf(p)}).ok);
 const started=r.command({type:'fts',op:'start',scenario:'SC',professor:'001',student:'tester',autoRun:false});assert.ok(started.ok,started.message);
 r.command({type:'tick',seconds:1});
 const row=n=>{for(const [station,s] of Object.entries(S().ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return {station,slot,uid:x.uid,direction:x.direction};return null;};
 const control=(station,action)=>r.command({type:'control',station,action});
 const ccm=st=>S().states[st].mode==='CCM'||control(st,{type:'mode',value:'CCM'}).ok;
 const order=[];
 for(const c of [...p.communications].reverse()){assert.ok(r.command({type:'fts',op:'manual',key:'comm:'+c.id,checked:true}).ok);order.push('comm:'+c.id);}
 const done=()=>item().obj||{};
 const ready=o=>{const d=done();if(refs(o.condition).some(id=>d[id]==null))return false;
  if(o.final)return p.objectives.every(x=>x.final||d[x.id]!=null);
  const k=o.condition.type==='all'&&o.condition.conditions[0].type==='objective'?o.condition.conditions[1]:o.condition,st=k.station;
  if(k.type==='route')return p.objectives.filter(x=>x.condition.station===st&&['signalCancelled','signalStop'].includes(x.condition.type)).every(x=>d[x.id]!=null);
  if(o.condition.type==='signalStop')return p.objectives.filter(x=>x.condition.type==='signalCancelled'&&x.condition.station===st&&x.condition.signal===o.condition.signal).every(x=>d[x.id]!=null);
  return true;};
 function perform(o){
  const c=o.condition;
  if(o.final){const st=leaf(c,'mode').station;return control(st,{type:'mode',value:'AUTO'}).ok;}
  if(c.type==='event')return control(c.station,{type:'mode',value:c.value}).ok;
  if(c.type==='signalCancelled')return ccm(c.station)&&control(c.station,{type:'stop',id:c.signal}).ok;
  if(c.type==='signalStop')return false;                                           // 접근쇄정 시간이 지나기를 기다린다
  if(c.type==='route')return ccm(c.station)&&control(c.station,{type:'route',id:c.route}).ok;
  if(c.type==='schedule'){const t=structuredClone(S().timetable.trains.find(x=>x.id===c.train));if(!t)return false;t.calls.find(k=>k.station===c.station)[c.field]=c.value;return r.command({type:'timetable',method:'update',args:[c.train,t]}).ok!==false;}
  const k=c.type==='all'&&c.conditions[0].type==='objective'?c.conditions[1]:c;
  if(k.type==='route'){if(!ccm(k.station))return false;if(control(k.station,{type:'route',id:k.route}).ok)return true;
   // 진로가 서지 않으면 관제사처럼 그 역에 남아 있는 다른 진로를 취소하고 해정을 기다린다
   const sig=k.route.split('-')[0];for(const id of Object.keys(S().states[k.station].routes))if(!id.startsWith(sig+'-'))control(k.station,{type:'withdraw',id});return false;}
  const at=leaf(k,'trainAt'),made=k.type==='all'?k.conditions[0]:null,gone=made?k.conditions[1]:leaf(k,'trainGone');
  if(at){const f=row(at.number);if(!f)return false;const slot=at.slot||EM.platform(at.station,f.direction);return f.station===at.station&&f.slot===slot||r.command({type:'numbers',action:{op:'move',...f,targetStation:at.station,targetSlot:slot}}).ok;}
  if(made&&gone){const f=row(gone.number);if(!f)return false;return r.command({type:'numbers',action:{op:'rename',...f,number:made.condition.number}}).ok;}
  if(gone){const f=row(gone.number);return !f||r.command({type:'numbers',action:{op:'delete',...f}}).ok;}
  throw new Error('no reference operation for '+o.id);
 }
 for(let pass=0;pass<240&&item().status==='진행';pass++){
  for(const o of [...p.objectives].reverse()){if(item().status!=='진행')break;if(done()[o.id]==null&&ready(o)&&perform(o))order.push(o.id);r.command({type:'tick',seconds:0});}
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
 const y=problems.find(p=>p.id==='P-yongsan-5');assert.equal(y.reactions[0].do[0].train,'A1002');assert.ok(y.objectives.some(o=>o.condition.type==='schedule'&&o.condition.value==='3C_B605T'));
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
module.exports={solve,problems};

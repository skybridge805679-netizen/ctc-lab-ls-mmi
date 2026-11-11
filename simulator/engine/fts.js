(function(root){
'use strict';
// FTS 제어통제 시스템 (photos 2026-10-30): the instructor program that puts scenarios into the LS/MMI.
//   문제(problem)  : 과목 · 문제명칭 · 제한시간 · 배점 · 음성 표출 · 상황 · 조치사항 · 발생조건(발생시간, 조건1~3) · 현상 설정 · 감점사항
//   상황(situation): 상황명칭 · 구간 · 스케줄ID · 제한시간 · 열차 스케줄 · 문제 목록
//   시나리오        : 시나리오 이름 · 작성자ID · 작성일자 · 상황 목록
//   교육            : 교수 · 교육생 · 시나리오 → 교육 시작 → 문제 발생 화면 + 모니터링(제한시간 · 경과시간 · 문제종료 · 교육종료)
// Everything is plain data (JSON), so a scenario written by hand or by an AI can be checked here and loaded as it is.
// Problems either carry declarative checks, or point at one of the built-in scripts (부본선 대피 · 비상시 조치 · 경합/스케줄생성)
// whose own step detection grades them.
const node=typeof module!=='undefined';
const N=node?require('./network.js'):root.SimNetwork;
const VERSION=1;
// 내장(기본) 문제·상황·시나리오의 판. 앱이 바뀌어 이 값이 달라지면, 저장된 라이브러리의 같은 id 내장 항목을 새 것으로 바꾼다
// (사용자가 만든 문제·응용 복사본은 id가 달라 그대로 남는다).
const BUILTIN='2026-11-01';
const SUBJECTS=['철도관제시스템 운용','운행선 관리','열차 운행 계획','비상 시 조치'];
const nm=id=>N.catalog[id]?.name||id;
const stationIds=()=>N.stations.map(s=>s.id);
const hms=v=>{const m=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(v??''));return m&&+m[1]<24&&+m[2]<60&&+(m[3]||0)<60?+m[1]*3600+ +m[2]*60+ +(m[3]||0)-28800:NaN;};

// ---------------------------------------------------------------- conditions (발생조건 · 채점 항목 · 감점사항)
// ctx = {states, ls, model, events, ui, manual, elapsed, script}
const rowsOf=(ctx,number)=>{const out=[];for(const [station,st] of Object.entries(ctx.ls?.stations||{}))for(const [slot,rows] of Object.entries(st.windows||{}))for(const r of rows)if(r.number===number)out.push({station,slot});return out;};
const trainOf=(ctx,id)=>ctx.model?.trains.find(t=>t.id===id);
const callOf=(t,station)=>t?.calls.find(c=>c.station===station);
const span=(t,from,to)=>{const a=t.calls.findIndex(c=>c.station===from),b=t.calls.findIndex(c=>c.station===to);return a<0||b<0||a>b?null:t.calls.slice(a,b+1);};
const CONDITIONS={
 mode:{label:'역제어모드',fields:['station','value'],test:(c,x)=>x.states?.[c.station]?.mode===c.value,text:c=>`${nm(c.station)}역 ${c.value} 모드`},
 route:{label:'진로 설정',fields:['station','route'],test:(c,x)=>!!x.states?.[c.station]?.routes?.[c.route],text:c=>`${nm(c.station)}역 ${c.route} 진로 설정`},
 signalStop:{label:'신호 정지',fields:['station','signal'],test:(c,x)=>{const s=x.states?.[c.station];return !!s&&s.signals?.[c.signal]==='STOP'&&!Object.keys(s.routes||{}).some(r=>r.startsWith(c.signal+'-'));},text:c=>`${nm(c.station)}역 ${c.signal} 신호 정지`},
 point:{label:'선로전환기',fields:['station','point','value'],test:(c,x)=>x.states?.[c.station]?.points?.[c.point]===c.value,text:c=>`${nm(c.station)}역 ${c.point} ${c.value==='R'?'반위':'정위'}`},
 trainAt:{label:'열번창 열차번호',fields:['number','station'],test:(c,x)=>rowsOf(x,c.number).some(r=>r.station===c.station&&(!c.slot||r.slot===c.slot)),text:c=>`열차번호 ${c.number} → ${nm(c.station)}역${c.slot?' '+c.slot:''} 열번창`},
 trainGone:{label:'열차번호 없음',fields:['number'],test:(c,x)=>!rowsOf(x,c.number).length,text:c=>`열차번호 ${c.number} 삭제`},
 trainExists:{label:'스케줄 열차 있음',fields:['train'],test:(c,x)=>{const t=trainOf(x,c.train);return !!t&&(!c.from||t.calls[0].station===c.from)&&(!c.to||t.calls.at(-1).station===c.to)&&(!c.start||t.calls[0].departure===hms(c.start));},text:c=>`${c.train} 스케줄${c.from?` ${nm(c.from)}~${nm(c.to)}`:''}${c.start?` ${c.start} 출발`:''}`},
 trainMissing:{label:'스케줄 열차 없음',fields:['train'],test:(c,x)=>!trainOf(x,c.train),text:c=>`${c.train} 스케줄 삭제`},
 schedule:{label:'스케줄 값',fields:['train','station','field','value'],test:(c,x)=>{const k=callOf(trainOf(x,c.train),c.station);if(!k)return false;
   if(c.field==='dwell')return k.departure-k.arrival===Number(c.value);if(c.field==='arrival'||c.field==='departure')return k[c.field]===hms(c.value);if(c.field==='cancelled')return !!k.cancelled===!!c.value;return (k[c.field]||'')===String(c.value||'');},
  text:c=>`${c.train} ${nm(c.station)} ${{dwell:'정차시분',arrival:'도착',departure:'출발',arrivalRoute:'도착진로',departureRoute:'출발진로',cancelled:'운휴'}[c.field]||c.field} ${c.field==='dwell'?`${Math.round(c.value/60*10)/10}분`:c.field==='cancelled'?(c.value?'운휴':'운행'):c.value}`},
 cancelled:{label:'구간 운휴/운행',fields:['train','from','to'],test:(c,x)=>{const t=trainOf(x,c.train),part=t&&span(t,c.from,c.to);return !!part&&part.every(k=>!!k.cancelled===(c.value!==false));},text:c=>`${c.train} ${nm(c.from)}~${nm(c.to)} ${c.value===false?'운행(부활)':'운휴'}`},
 windowOpen:{label:'MMI 창 열림',fields:['window'],test:(c,x)=>!!x.ui?.windows?.includes(c.window),text:c=>`${c.window} 창 열기`},
 graphTrain:{label:'그래프 열차 선택',fields:['train'],test:(c,x)=>x.ui?.graphTrain===c.train&&!!x.ui?.windows?.includes('graph'),text:c=>`열차그래프에서 ${c.train} 검색`},
 trainRun:{label:'열차 운행 도착 (진로·신호 또는 전령법으로 실제 운행)',fields:['number','station'],test:(c,x)=>(x.events||[]).some(e=>e.type==='trainRun'&&e.number===c.number&&e.station===c.station&&(!c.slot||e.slot===c.slot)),text:c=>`${c.number} 열차가 ${nm(c.station)}역${c.slot?' '+c.slot:''}까지 운행 (열번 수동 이동은 인정 안 함)`},
 event:{label:'조작 기록',fields:['eventType'],test:(c,x)=>(x.events||[]).some(e=>e.ok!==false&&e.type===c.eventType&&(!c.station||e.station===c.station)&&(c.id===undefined||String(e.id)===String(c.id))&&(c.value===undefined||e.value===c.value)
  // source: 조작한 화면('LS' · 'MMI') — 평가서 Ⅱ의 「L/S에서 … · MMI에서 …」 지정 과제. op: 열번창·표지판 조작 종류(insert · boardAdd …)
  &&(c.source===undefined||e.source===c.source)&&(c.op===undefined||e.operation?.op===c.op)&&(c.slot===undefined||e.operation?.slot===c.slot)&&(c.kind===undefined||e.operation?.kind===c.kind)),text:c=>`${c.source?c.source+'에서 ':''}${c.station?nm(c.station)+'역 ':''}${c.eventType}${c.op?' '+c.op:''}${c.id!==undefined?' '+c.id:''}${c.value!==undefined?' '+c.value:''} 조작`},
 signalCancelled:{label:'신호 취소 조작',fields:['station','signal'],test:(c,x)=>(x.events||[]).some(e=>e.ok!==false&&e.station===c.station&&((e.type==='stop'&&String(e.id)===c.signal)||(e.type==='withdraw'&&String(e.id).startsWith(c.signal+'-'))||(e.type==='stopAll')))
  // orStopped: 그 신호로 열차가 이미 지나가 정지로 돌아와 있으면 취소할 것이 없다 — 정지 확인으로 인정한다
  ||!!c.orStopped&&CONDITIONS.signalStop.test(c,x),text:c=>`${nm(c.station)}역 ${c.signal} 신호 취소(해정 조작)`},
 failedOp:{label:'실패한 조작',fields:[],test:(c,x)=>(x.events||[]).filter(e=>e.ok===false&&(!c.station||e.station===c.station)&&(!c.eventType||e.type===c.eventType)).length>=(c.count||1),text:c=>`${c.station?nm(c.station)+'역 ':''}거부된 조작${c.count>1?` ${c.count}회`:''}`},
 objective:{label:'목표 달성',fields:['id'],test:(c,x)=>x.objectives?.[c.id]!=null,text:c=>`목표 ${c.id} 달성`},
 // MMI 알람 확인(체크 후 [확인]). contains: 알람 문구에 들어 있어야 할 말, afterObjective: 그 목표를 이룬 뒤의 확인만 인정
 alarmAck:{label:'알람 확인',fields:[],test:(c,x)=>{const from=c.afterObjective!=null?x.objectives?.[c.afterObjective]:0;if(from==null)return false;const start=(x.now??0)-(x.elapsed??0);return (x.events||[]).some(e=>e.type==='alarmAck'&&e.ok!==false&&(!c.contains||String(e.text||'').includes(c.contains))&&(e.at==null||e.at-start>=from));},text:c=>`알람 확인${c.contains?` ("${c.contains}")`:''}${c.afterObjective?` · 목표 ${c.afterObjective} 뒤`:''}`},
 reaction:{label:'상황 반응 발생',fields:['id'],test:(c,x)=>!!x.reactions?.[c.id]?.fired,text:c=>`상황 반응 ${c.id} 발생`},
 branch:{label:'상황 변경 발생',fields:['id'],test:(c,x)=>x.branches?.[c.id]!=null,text:c=>`상황 변경 ${c.id} 발생`},
 communication:{label:'통보 확인',fields:['id'],test:(c,x)=>x.manual?.['comm:'+c.id]===true,text:c=>`통보 ${c.id} 확인`},
 elapsed:{label:'경과시간',fields:['seconds'],test:(c,x)=>(x.elapsed||0)>=Number(c.seconds),text:c=>`${c.seconds}초 경과`},
 script:{label:'대본 단계 완료',fields:[],test:(c,x)=>!!x.script&&x.script.total>0&&x.script.done>=(c.steps??x.script.total),text:c=>c.steps?`대본 ${c.steps}단계까지 완료`:'대본 전체 단계 완료'},
 manual:{label:'교수 확인 (구술)',fields:['label'],test:(c,x)=>Object.hasOwn(x.manual||{},c.key||c.label)&&x.manual[c.key||c.label]===true,text:c=>`${c.label} (교수 확인)`},
 all:{label:'모두',fields:['conditions'],test:(c,x)=>c.conditions.every(k=>test(k,x)),text:c=>c.conditions.map(describe).join(' 그리고 ')},
 any:{label:'하나 이상',fields:['conditions'],test:(c,x)=>c.conditions.some(k=>test(k,x)),text:c=>c.conditions.map(describe).join(' 또는 ')},
 not:{label:'아님',fields:['condition'],test:(c,x)=>!test(c.condition,x),text:c=>`${describe(c.condition)} 아님`}
};
function test(c,ctx){const d=Object.hasOwn(CONDITIONS,c?.type)?CONDITIONS[c.type]:null;try{return !!d&&!!d.test(c,ctx);}catch{return false;}}
function describe(c){const d=CONDITIONS[c?.type];return d?d.text(c):`(알 수 없는 조건 ${c?.type})`;}

// ---------------------------------------------------------------- 현상 (phenomena): what the system makes happen
const PHENOMENA={
 insertTrain:{label:'열번창 열차번호 표시',fields:['station','slot','number','direction']},
 deleteTrain:{label:'열차번호 지우기',fields:['number']},
 route:{label:'진로 설정',fields:['station','route']},
 mode:{label:'역제어모드',fields:['station','value']},
 approach:{label:'접근 열차',fields:['station','signal']},
 createTrain:{label:'스케줄 열차 생성',fields:['train','from','to']},
 delay:{label:'열차 지연',fields:['train','station','minutes']},
 cancel:{label:'구간 운휴',fields:['train','from','to']},
 moveTrain:{label:'열차번호 이동',fields:['number','station','slot']},
 runTrain:{label:'열차 운행 (진로를 기다려 이동)',fields:['number','legs']},
 resetStation:{label:'역 상태 초기화',fields:['station']},
 resetAll:{label:'LS 전체 초기화 (모든 역 진로·모드·열차번호)',fields:[]},
 clearTimetable:{label:'시간표 비우기 (대본 열차만 남김)',fields:[]},
 alarm:{label:'알람 발생',fields:['text']},
 notice:{label:'안내 메시지',fields:['text']}
};

// ---------------------------------------------------------------- library validation (also for AI-made JSON)
const object=x=>x&&typeof x==='object'&&!Array.isArray(x),finite=(v,min=0,max=86400)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function checkStation(id,where,errors){if(!Object.hasOwn(N.catalog,id))errors.push(`${where}: 없는 역 ${id}`);}
function checkCondition(c,where,errors,depth=0){
 if(depth>12){errors.push(`${where}: 조건 중첩은 12단계까지 가능합니다`);return;}
 const d=object(c)&&Object.hasOwn(CONDITIONS,c.type)?CONDITIONS[c.type]:null;if(!d){errors.push(`${where}: 알 수 없는 조건 종류 ${c?.type}`);return;}
 for(const f of d.fields)if(c[f]===undefined||c[f]==='')errors.push(`${where}: ${c.type} 조건에 ${f}가 없습니다`);
 for(const f of ['station','from','to'])if(c[f]!==undefined)checkStation(c[f],where,errors);
 const st=N.catalog[c.station];
 if(c.type==='route'&&st&&!Object.hasOwn(st.routes||{},c.route))errors.push(`${where}: ${nm(c.station)}역에 없는 진로 ${c.route}`);
 if(c.type==='point'&&(!['N','R'].includes(c.value)||st&&!Object.hasOwn(st.points||{},c.point)))errors.push(`${where}: 선로전환기와 위치(N 또는 R)를 확인하세요`);
 if(c.type==='signalStop'&&st&&!Object.hasOwn(st.signals||{},c.signal))errors.push(`${where}: 없는 신호기 ${c.signal}`);
 if(c.type==='mode'&&!['CCM','AUTO','LOCAL'].includes(c.value))errors.push(`${where}: 제어모드는 CCM·AUTO·LOCAL`);
 if(c.type==='manual'&&(typeof c.label!=='string'||!c.label.trim()||c.key!==undefined&&typeof c.key!=='string'))errors.push(`${where}: 구술 확인 이름·키는 문자열이어야 합니다`);
 if(c.type==='manual'&&['__proto__','constructor','prototype'].includes(c.key||c.label))errors.push(`${where}: 구술 확인 키를 변경하세요`);
 if(c.type==='elapsed'&&!finite(c.seconds))errors.push(`${where}: 경과시간은 0~86400초`);
 if(c.type==='script'&&c.steps!==undefined&&(!Number.isInteger(c.steps)||c.steps<1))errors.push(`${where}: 대본 단계는 양의 정수`);
 if(c.type==='trainExists'&&c.start!==undefined&&!Number.isFinite(hms(c.start)))errors.push(`${where}: 출발시각을 확인하세요`);
 if(c.type==='cancelled'&&c.value!==undefined&&typeof c.value!=='boolean')errors.push(`${where}: 운휴 값은 true/false`);
 if(c.type==='schedule'){
  if(!['dwell','arrival','departure','arrivalRoute','departureRoute','cancelled'].includes(c.field))errors.push(`${where}: 스케줄 항목이 잘못되었습니다`);
  if(c.field==='dwell'&&!finite(c.value))errors.push(`${where}: 정차시간은 0~86400초`);
  if(['arrival','departure'].includes(c.field)&&!Number.isFinite(hms(c.value)))errors.push(`${where}: 시각을 확인하세요`);
  if(c.field==='cancelled'&&typeof c.value!=='boolean')errors.push(`${where}: 운휴 값은 true/false`);
 }
 if(c.type==='all'||c.type==='any'){if(!Array.isArray(c.conditions)||!c.conditions.length||c.conditions.length>100)errors.push(`${where}: 조건은 1~100개 배열이어야 합니다`);else c.conditions.forEach((k,i)=>checkCondition(k,`${where}.${i+1}`,errors,depth+1));}
 if(c.type==='not')checkCondition(c.condition,where,errors,depth+1);
}
// 능동형 문제: 초기 상태(setup) · 순서 없는 목표(objectives) · 통보/구술(communications) · 상황 반응(reactions)
function checkPhenomenon(k,where,errors){
 const d=object(k)&&Object.hasOwn(PHENOMENA,k.type)?PHENOMENA[k.type]:null;if(!d){errors.push(`${where}: 알 수 없는 현상 ${k?.type}`);return;}
 for(const f of d.fields)if(k[f]===undefined||k[f]==='')errors.push(`${where}: ${f}가 없습니다`);
 for(const f of ['station','from','to'])if(k[f]!==undefined)checkStation(k[f],where,errors);
 if(k.after!==undefined&&!finite(k.after))errors.push(`${where}: 발생시간은 0~86400초`);
 if(k.type==='route'&&N.catalog[k.station]&&!Object.hasOwn(N.catalog[k.station].routes||{},k.route))errors.push(`${where}: ${nm(k.station)}역에 없는 진로 ${k.route}`);
 if(k.type==='mode'&&!['CCM','AUTO','LOCAL'].includes(k.value))errors.push(`${where}: 제어모드는 CCM·AUTO·LOCAL`);
 if(k.type==='approach'&&N.catalog[k.station]&&!Object.hasOwn(N.catalog[k.station].signals||{},k.signal))errors.push(`${where}: 없는 신호기 ${k.signal}`);
 if(k.type==='insertTrain'||k.type==='moveTrain'){
  const ws=node?require('./train-windows').data:root.SimTrainWindows.data;if(k.slot!==undefined&&!(ws[k.station]||[]).some(w=>w.slot===k.slot))errors.push(`${where}: 없는 열번창 ${k.slot}`);
  if(k.type==='insertTrain'&&!['up','down'].includes(k.direction))errors.push(`${where}: 방향은 up/down`);
  if(!/^[A-Za-z]{0,2}[0-9]{1,6}$/.test(k.number||''))errors.push(`${where}: 열차번호를 확인하세요`);
 }
 if(k.type==='delay'&&!finite(k.minutes,-120,120))errors.push(`${where}: 지연은 -120~120분`);
 if(k.type==='createTrain'&&!(k.start!==undefined?Number.isFinite(hms(k.start)):finite(k.startIn,-86400)))errors.push(`${where}: 출발시각(start) 또는 지금부터 초(startIn)를 확인하세요`);
 if(k.type==='createTrain'&&k.replace!==undefined&&typeof k.replace!=='boolean')errors.push(`${where}: replace는 true/false`);
 if(k.type==='runTrain'){
  if(!/^[A-Za-z]{0,2}[0-9]{1,6}$/.test(k.number||''))errors.push(`${where}: 열차번호를 확인하세요`);
  const ws=node?require('./train-windows').data:root.SimTrainWindows.data;
  if(!Array.isArray(k.legs)||k.legs.length>20)errors.push(`${where}: legs는 20개 이하 배열`);
  else k.legs.forEach((l,j)=>{if(!object(l)){errors.push(`${where} 구간 ${j+1}: 객체여야 합니다`);return;}checkStation(l.station,`${where} 구간 ${j+1}`,errors);if(!(ws[l.station]||[]).some(w=>w.slot===l.slot))errors.push(`${where} 구간 ${j+1}: 없는 열번창 ${l.slot}`);});
  if(k.exit!==undefined&&typeof k.exit!=='boolean')errors.push(`${where}: exit는 true/false`);
  if(!k.exit&&!k.legs?.length)errors.push(`${where}: 이동 구간(legs)이나 퇴장(exit)이 필요합니다`);
 }
}
function checkActive(p,w,errors){
 const list=(key,max=500)=>{if(p[key]===undefined)return [];if(!Array.isArray(p[key])||p[key].length>max){errors.push(`${w}: ${key}는 ${max}개 이하 배열이어야 합니다`);return [];}return p[key];};
 const ids=new Set(),idOk=(x,where)=>{if(!object(x)||typeof x.id!=='string'||!/^[\w.-]{1,60}$/.test(x.id)){errors.push(`${where}: id는 영문·숫자·_.- 1~60자`);return false;}if(ids.has(x.id))errors.push(`${where}: id 중복 ${x.id}`);ids.add(x.id);return true;};
 const branches=list('branches',100);
 // 상황 변경(분기)의 목표·통보·반응도 같은 문제 안의 id로 검사한다
 const sub=(b,key)=>object(b)&&Array.isArray(b[key])?b[key]:[];
 const objectives=[...list('objectives'),...branches.flatMap(b=>sub(b,'objectives'))],comms=[...list('communications'),...branches.flatMap(b=>sub(b,'communications'))],reactions=[...list('reactions'),...branches.flatMap(b=>sub(b,'reactions'))];
 objectives.forEach((o,i)=>{const where=`${w} 목표 ${i+1}`;if(!idOk(o,where))return;if(typeof o.label!=='string'||!o.label.trim())errors.push(`${where}: 이름이 없습니다`);checkCondition(o.condition,where,errors);if(o.points!==undefined&&!finite(o.points,0,100000))errors.push(`${where}: 점수는 0 이상`);if(o.deadline!==undefined&&!finite(o.deadline,1))errors.push(`${where}: 기한은 1~86400초`);for(const f of ['final','optional'])if(o[f]!==undefined&&typeof o[f]!=='boolean')errors.push(`${where}: ${f}는 true/false`);if(o.missedWhen!=null)checkCondition(o.missedWhen,where+' 놓침 조건',errors);});
 comms.forEach((c,i)=>{const where=`${w} 통보 ${i+1}`;if(!idOk(c,where))return;if(typeof c.label!=='string'||!c.label.trim())errors.push(`${where}: 이름이 없습니다`);if(c.text!==undefined&&typeof c.text!=='string')errors.push(`${where}: 문안은 문자열`);if(c.points!==undefined&&!finite(c.points,0,100000))errors.push(`${where}: 점수는 0 이상`);if(c.deadline!==undefined&&!finite(c.deadline,1))errors.push(`${where}: 기한은 1~86400초`);});
 const known={objective:new Set(objectives.map(o=>o?.id)),communication:new Set(comms.map(c=>c?.id)),branch:new Set(branches.map(b=>b?.id)),reaction:new Set(reactions.map(r=>r?.id))};
 const refs=(c,where)=>{if(!object(c))return;if(c.type==='alarmAck'&&c.afterObjective!=null&&!known.objective.has(c.afterObjective))errors.push(`${where}: 없는 목표 ${c.afterObjective}`);if(['objective','communication','branch','reaction'].includes(c.type)&&!known[c.type].has(c.id))errors.push(`${where}: 없는 ${{objective:'목표',communication:'통보',branch:'상황 변경',reaction:'상황 반응'}[c.type]} ${c.id}`);(c.conditions||[]).forEach(k=>refs(k,where));if(c.condition)refs(c.condition,where);};
 objectives.forEach((o,i)=>{refs(o.condition,`${w} 목표 ${i+1}`);if(o.missedWhen!=null)refs(o.missedWhen,`${w} 목표 ${i+1} 놓침 조건`);});
 reactions.forEach((r,i)=>{const where=`${w} 상황반응 ${i+1}`;if(!idOk(r,where))return;if(r.when!=null){checkCondition(r.when,where,errors);refs(r.when,where);}if(r.after!==undefined&&!finite(r.after))errors.push(`${where}: 지연은 0~86400초`);if(!Array.isArray(r.do)||!r.do.length||r.do.length>50)errors.push(`${where}: 현상(do)은 1~50개`);else r.do.forEach((k,j)=>checkPhenomenon(k,`${where}.${j+1}`,errors));});
 const base={objective:new Set((p.objectives||[]).map(o=>o?.id)),communication:new Set((p.communications||[]).map(c=>c?.id)),reaction:new Set((p.reactions||[]).map(r=>r?.id))};
 branches.forEach((b,i)=>{const where=`${w} 상황변경 ${i+1}`;if(!idOk(b,where))return;
  if(typeof b.label!=='string'||!b.label.trim())errors.push(`${where}: 이름이 없습니다`);if(b.text!==undefined&&typeof b.text!=='string')errors.push(`${where}: 내용은 문자열`);
  for(const k of ['objectives','communications','reactions','drop'])if(b[k]!==undefined&&(!Array.isArray(b[k])||b[k].length>200))errors.push(`${where}: ${k}는 200개 이하 배열`);
  if(b.when!=null){checkCondition(b.when,where,errors);refs(b.when,where);}
  for(const id of b.drop||[])if(!base.objective.has(id)&&!base.communication.has(id)&&!base.reaction.has(id))errors.push(`${where}: 뺄 항목 ${id}가 기본 목표·통보·반응에 없습니다`);});
 if(p.setup!==undefined){
  const st=p.setup,where=`${w} 초기상태`;if(!object(st)){errors.push(`${where}: 객체여야 합니다`);return;}
  (st.reset||[]).forEach((x,i)=>checkStation(x,`${where} 초기화 ${i+1}`,errors));
  for(const k of ['reset','modes','routes','approach','trains','clear'])if(st[k]!==undefined&&(!Array.isArray(st[k])||st[k].length>200))errors.push(`${where}: ${k}는 배열`);
  if(st.clearTimetable!==undefined&&typeof st.clearTimetable!=='boolean')errors.push(`${where}: clearTimetable은 true/false`);
  if(st.resetAll!==undefined&&typeof st.resetAll!=='boolean')errors.push(`${where}: resetAll은 true/false`);
  if(st.scheduleId!==undefined&&typeof st.scheduleId!=='string')errors.push(`${where}: scheduleId는 스케줄 ID 문자열`);
  (st.modes||[]).forEach((x,i)=>checkPhenomenon({...x,type:'mode'},`${where} 모드 ${i+1}`,errors));
  (st.routes||[]).forEach((x,i)=>checkPhenomenon({...x,type:'route'},`${where} 진로 ${i+1}`,errors));
  (st.approach||[]).forEach((x,i)=>checkPhenomenon({...x,type:'approach'},`${where} 접근열차 ${i+1}`,errors));
  (st.trains||[]).forEach((x,i)=>checkPhenomenon({...x,type:'insertTrain'},`${where} 열차 ${i+1}`,errors));
  (st.clear||[]).forEach((n,i)=>{if(!/^[A-Za-z]{0,2}[0-9]{1,6}$/.test(n))errors.push(`${where} 지울 번호 ${i+1}: 열차번호를 확인하세요`);});
 }
}
function validate(lib,{scripts=[],drafts=false}={}){
 const errors=[];if(!object(lib))return ['라이브러리가 JSON 객체가 아닙니다.'];
 if(lib.version!==undefined&&lib.version!==VERSION)errors.push('지원하지 않는 라이브러리 버전입니다.');
 for(const key of ['problems','situations','scenarios'])if(!Array.isArray(lib[key])||lib[key].length>10000)errors.push(`${key} 목록은 10000개 이하 배열이어야 합니다.`);
 if(errors.length)return errors;
 const ids=new Map();
 for(const kind of ['problems','situations','scenarios','schedules']){const list=lib[kind]??[];if(!Array.isArray(list)||list.length>10000){errors.push(`${kind}: 목록은 배열이어야 합니다`);continue;}const seen=new Set();for(const x of list){if(!object(x)||typeof x.id!=='string'||!x.id.trim()||x.id.length>120||['__proto__','constructor','prototype'].includes(x.id)){errors.push(`${kind}: 올바른 id가 필요합니다`);continue;}if(seen.has(x.id))errors.push(`${kind}: id 중복 ${x.id}`);seen.add(x.id);}ids.set(kind,seen);}
 for(const p of lib.problems){if(!object(p))continue;const w=`문제 ${p.id}`;
  if(!SUBJECTS.includes(p.subject))errors.push(`${w}: 과목은 ${SUBJECTS.join('/')} 중 하나`);
  if(typeof p.name!=='string'||!p.name.trim())errors.push(`${w}: 문제명칭이 없습니다`);
  if(!finite(p.limit,1))errors.push(`${w}: 제한시간(초)은 1~86400이어야 합니다`);
  if(p.score!==undefined&&!finite(p.score,0,100000))errors.push(`${w}: 배점은 유한한 0 이상 숫자`);
  if(p.script&&!scripts.includes(p.script))errors.push(`${w}: 없는 대본 ${p.script}`);
  const tasks=(p.checks?.length||0)+(p.objectives?.length||0)+(p.communications?.length||0);
  if(!p.script&&!tasks)errors.push(`${w}: 목표(objectives)·통보(communications)·채점 항목(checks) 중 하나나 대본(script)이 필요합니다`);
  checkActive(p,w,errors);
  for(const key of ['checks','deductions','phenomena'])if(p[key]!==undefined&&(!Array.isArray(p[key])||p[key].length>1000))errors.push(`${w}: ${key}는 1000개 이하 배열이어야 합니다`);
  if(p.trigger!==undefined&&!object(p.trigger))errors.push(`${w}: 발생조건 설정은 객체여야 합니다`);
  if(p.trigger?.at!==undefined&&!finite(p.trigger.at))errors.push(`${w}: 발생시간은 0~86400초`);
  if(p.trigger?.useTime!==undefined&&typeof p.trigger.useTime!=='boolean')errors.push(`${w}: 발생시간 사용은 true/false`);
  if(p.trigger?.conditions!==undefined&&!Array.isArray(p.trigger.conditions))errors.push(`${w}: 발생조건은 배열이어야 합니다`);
  for(const key of ['checks','deductions'])if(Array.isArray(p[key]))p[key].forEach((k,i)=>{const where=`${w} ${key==='checks'?'채점':'감점'} ${i+1}`;if(!object(k)){errors.push(`${where}: 항목이 잘못되었습니다`);return;}if(k.points!==undefined&&!finite(k.points,0,100000))errors.push(`${where}: 점수는 유한한 0 이상 숫자`);checkCondition(k.condition,where,errors);});
  if(Array.isArray(p.trigger?.conditions))p.trigger.conditions.forEach((k,i)=>checkCondition(k,`${w} 발생조건 ${i+1}`,errors));
  if(Array.isArray(p.phenomena))p.phenomena.forEach((k,i)=>checkPhenomenon(k,`${w} 현상 ${i+1}`,errors));
 }
 const timetable=(t,w)=>{const date=t?.serviceDate,dateTime=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(dateTime)||new Date(dateTime).toISOString().slice(0,10)!==date)errors.push(`${w}: 운행일을 확인하세요`);const T=node?require('./timetable'):root.SimTimetable;if(!object(t)||!Array.isArray(t.trains)||t.trains.length>20000||!/^\d{4}-\d{2}-\d{2}$/.test(t.serviceDate||'')||t.trains.some(x=>!T.valid(x))||new Set(t.trains.map(x=>x?.id)).size!==t.trains.length)errors.push(`${w}: 유효한 운행일·중복 없는 열차 스케줄이 필요합니다`);};
 if(Array.isArray(lib.schedules))for(const s of lib.schedules)if(object(s)){timetable(s.timetable,`스케줄 ${s.id}`);if(s.relative!==undefined&&typeof s.relative!=='boolean')errors.push(`스케줄 ${s.id}: relative는 true/false`);}
 for(const p of lib.problems)if(object(p)&&p.setup?.scheduleId&&!ids.get('schedules')?.has(p.setup.scheduleId))errors.push(`문제 ${p.id}: 없는 스케줄 ${p.setup.scheduleId}`);
 for(const s of lib.situations){if(!object(s))continue;const w=`상황 ${s.id}`;if(typeof s.name!=='string'||!s.name.trim())errors.push(`${w}: 상황명칭이 없습니다`);if(!Array.isArray(s.problems)||!drafts&&!s.problems.length)errors.push(`${w}: 문제가 없습니다`);else for(const id of s.problems)if(!ids.get('problems').has(id))errors.push(`${w}: 없는 문제 ${id}`);if(s.limit!==undefined&&!finite(s.limit))errors.push(`${w}: 제한시간은 0~86400초`);if(s.timetable!=null)timetable(s.timetable,w);}
 for(const s of lib.scenarios){if(!object(s))continue;const w=`시나리오 ${s.id}`;if(typeof s.name!=='string'||!s.name.trim())errors.push(`${w}: 시나리오 이름이 없습니다`);if(!Array.isArray(s.situations)||!drafts&&!s.situations.length)errors.push(`${w}: 상황이 없습니다`);else for(const id of s.situations)if(!ids.get('situations').has(id))errors.push(`${w}: 없는 상황 ${id}`);}
 return errors;
}

// ---------------------------------------------------------------- 교육 (session)
// problems run one after another in scenario order. A problem is 대기 until its 발생조건 hold (발생시간 = seconds after the
// previous problem ended), then 진행 until every check is met (완료), the instructor ends it (종료) or its time runs out (시간초과).
function createSession(lib,scenarioId,{professor='',student='',startedAt=0}={}){
 const sc=lib.scenarios.find(s=>s.id===scenarioId);if(!sc)return null;
 const items=[];
 for(const [situationIndex,sid] of sc.situations.entries()){const s=lib.situations.find(x=>x.id===sid);for(const pid of s.problems)items.push({situation:sid,situationIndex,problem:pid,status:'대기',startedAt:null,endedAt:null,met:[],deducted:[],score:0});}
 return {version:VERSION,scenario:sc.id,scenarioName:sc.name,professor,student,startedAt,readyAt:startedAt,current:0,items,finished:false,manual:{}};
}
const problemOf=(lib,item)=>lib.problems.find(p=>p.id===item.problem);
// 초기 상태 → 현상 목록 (지울 번호 → 진로 → 접근 열차 → 제어모드 → 열번 표시)
function setupActions(st){
 if(!st)return [];
 // resetAll: 앞 문제가 남긴 진로·모드·열차번호·운행 중 열차를 모두 지우고 새 LS에서 시작한다 (구간이 겹치는 문제를 이어 풀 때 열차 증발 방지)
 return [...(st.clearTimetable?[{type:'clearTimetable'}]:[]),...(st.resetAll?[{type:'resetAll'}]:[]),...(st.reset||[]).map(station=>({type:'resetStation',station})),...(st.clear||[]).map(number=>({type:'deleteTrain',number})),...(st.routes||[]).map(x=>({...x,type:'route'})),...(st.approach||[]).map(x=>({...x,type:'approach'})),
  ...(st.modes||[]).map(x=>({...x,type:'mode'})),...(st.trains||[]).map(x=>({...x,type:'insertTrain'}))];
}
// 상황 변경(분기): 교수가 주입하거나(조건 키 branch:<id>) when 조건이 맞으면 켜진다. 켜진 분기의 목표·통보·반응이 더해지고
// drop에 적힌 기본 항목은 빠진다 (예: 자력 운행 가능 → 구원 관련 목표 제외). 켜진 분기는 문제가 끝날 때까지 유지된다.
function view(p,item){
 const on=(p?.branches||[]).filter(b=>item?.branch?.[b.id]!=null);if(!on.length)return p;
 const drop=new Set(on.flatMap(b=>b.drop||[])),pick=k=>[...(p[k]||[]).filter(x=>!drop.has(x.id)),...on.flatMap(b=>b[k]||[])];
 return {...p,objectives:pick('objectives'),communications:pick('communications'),reactions:pick('reactions')};
}
// 목표는 한 번 달성하면 그 시각을 기록한다(순서 없음). 기한을 넘겨 달성하면 절반만 인정한다.
function latch(p0,item,ctx){
 const p=view(p0,item);
 // final:true = a state that must hold when the problem ends (e.g. AUTO 복귀): not latched, re-checked every tick
 for(const o of p.objectives||[]){if(o.final){const ok=test(o.condition,{...ctx,objectives:item.obj||{}});if(ok&&item.obj?.[o.id]==null)(item.obj??={})[o.id]=ctx.elapsed??0;else if(!ok&&item.obj?.[o.id]!=null)delete item.obj[o.id];continue;}if(item.obj?.[o.id]!=null||item.missed?.[o.id]!=null)continue;const c2={...ctx,objectives:item.obj||{}};if(test(o.condition,c2))(item.obj??={})[o.id]=ctx.elapsed??0;
  // missedWhen: 이룰 기회가 지나간 목표 (예: 정지시켜야 할 열차가 이미 그 신호로 지나감) — 0점으로 닫고 완료를 막지 않는다
  else if(o.missedWhen!=null&&test(o.missedWhen,c2))(item.missed??={})[o.id]=ctx.elapsed??0;}
 for(const c of p.communications||[])if(item.comm?.[c.id]==null&&ctx.manual?.['comm:'+c.id]===true)(item.comm??={})[c.id]=ctx.elapsed??0;
}
function credit(task,doneAt){if(doneAt==null)return 0;const pts=task.points??1;return task.deadline!==undefined&&doneAt>task.deadline?pts/2:pts;}
function grade(p0,item,ctx){
 const p=view(p0,item),checks=p.checks||[],met=checks.map(k=>test(k.condition,ctx));
 const objectives=p.objectives||[],comms=p.communications||[];
 latch(p0,item,ctx);
 const required=[...objectives.filter(o=>!o.optional).map(o=>item.obj?.[o.id]??item.missed?.[o.id]),...comms.filter(c=>!c.optional).map(c=>item.comm?.[c.id])];
 const total=checks.reduce((s,k)=>s+(k.points??1),0)+objectives.reduce((s,o)=>s+(o.points??1),0)+comms.reduce((s,c)=>s+(c.points??1),0);
 const got=checks.reduce((s,k,i)=>s+(met[i]?(k.points??1):0),0)+objectives.reduce((s,o)=>s+credit(o,item.obj?.[o.id]),0)+comms.reduce((s,c)=>s+credit(c,item.comm?.[c.id]),0);
 const deducted=(p.deductions||[]).map((k,i)=>!!item.deducted?.[i]||test(k.condition,ctx));
 const minus=(p.deductions||[]).reduce((s,k,i)=>s+(deducted[i]?Number(k.points)||0:0),0);
 const scriptDone=!p.script||(ctx.script&&ctx.script.total>0&&ctx.script.done>=ctx.script.total&&ctx.script.complete!==false);
 const base=p.script&&!total?(ctx.script?.total?ctx.script.done/ctx.script.total:0):total?got/total:met.every(Boolean)?1:0;
 return {met,deducted,complete:met.every(Boolean)&&required.every(v=>v!=null)&&scriptDone,score:Math.max(0,Math.round((p.score??100)*base-minus))};
}
// returns the actions to carry out now: {kind:'activate'|'phenomenon'|'end', ...}
function advance(lib,session,ctxFor,now){
 const out=[];if(session.finished)return out;
 const item=session.items[session.current];if(!item){session.finished=true;out.push({kind:'finished'});return out;}
 const p=problemOf(lib,item);
 if(item.status==='대기'){
  const since=now-session.readyAt,ctx={...ctxFor(item,since),elapsed:since};
  const at=p.trigger?.useTime?Number(p.trigger.at)||0:0;
  item.triggerTimeMet=since>=at;item.triggerMet=(p.trigger?.conditions||[]).map(c=>test(c,ctx));
  if(item.triggerTimeMet&&item.triggerMet.every(Boolean)){item.status='진행';item.startedAt=now;item.fired=[];item.obj={};item.missed={};item.comm={};item.reactions={};item.branch={};out.push({kind:'activate',item,problem:p});for(const ph of setupActions(p.setup))out.push({kind:'phenomenon',item,phenomenon:ph,setup:true});return out;}
  else return out;
 }
 const elapsed=now-item.startedAt,ctx={...ctxFor(item,elapsed),elapsed,objectives:item.obj||{},branches:item.branch||{},reactions:item.reactions||{}};
 for(const b of p.branches||[]){if(item.branch?.[b.id]!=null)continue;if(ctx.manual?.['branch:'+b.id]===true||(b.when!=null&&test(b.when,ctx))){(item.branch??={})[b.id]=elapsed;out.push({kind:'branch',item,branch:b});}}
 (p.phenomena||[]).forEach((ph,i)=>{if(!item.fired.includes(i)&&elapsed>=(Number(ph.after)||0)){item.fired.push(i);out.push({kind:'phenomenon',item,phenomenon:ph});}});
 // 상황 반응: 조건이 처음 맞은 때(없으면 문제 시작)부터 after초 뒤에 한 번 일어난다
 latch(p,item,ctx);ctx.objectives=item.obj||{};
 for(const r of view(p,item).reactions||[]){const st=(item.reactions??={})[r.id]??={armedAt:null,fired:false};if(st.fired)continue;
  if(st.armedAt===null&&(r.when==null||test(r.when,ctx)))st.armedAt=elapsed;
  if(st.armedAt!==null&&elapsed-st.armedAt>=(Number(r.after)||0)){st.fired=true;st.firedAt=elapsed;for(const ph of r.do)out.push({kind:'phenomenon',item,phenomenon:ph,reaction:r.id});}}
 if(out.length)return out;
 const g=grade(p,item,ctx);item.met=g.met;item.deducted=g.deducted;item.score=g.score;
 if(g.complete&&elapsed<=Number(p.limit))finish(session,item,'완료',now,out);
 else if(elapsed>=Number(p.limit))finish(session,item,'시간초과',now,out);
 return out;
}
function finish(session,item,status,now,out=[]){
 item.status=status;item.endedAt=now;session.current++;session.readyAt=now;
 out.push({kind:'end',item,status});
 if(session.current>=session.items.length){session.finished=true;out.push({kind:'finished'});}
 return out;
}
// 문제종료 by the instructor
function endCurrent(session,now){const item=session.items[session.current];if(!item||session.finished)return [];if(item.status==='대기'){item.status='진행';item.startedAt=now;}return finish(session,item,'종료',now);}
function summary(lib,session){
 const rows=session.items.map(it=>{const p0=problemOf(lib,it),p=view(p0,it);return {problem:p?.name||it.problem,subject:p?.subject||'',status:it.status,score:it.score,full:p?.score??100,seconds:it.endedAt!=null&&it.startedAt!=null?it.endedAt-it.startedAt:null,error:it.error||null,checks:(p?.checks||[]).map((k,i)=>({label:k.label||describe(k.condition),met:!!it.met?.[i],points:k.points??1})),deductions:(p?.deductions||[]).map((k,i)=>({label:k.label||describe(k.condition),applied:!!it.deducted?.[i],points:k.points??0})),
  objectives:(p?.objectives||[]).map(o=>({id:o.id,label:o.label,doneAt:it.obj?.[o.id]??null,missedAt:it.missed?.[o.id]??null,late:o.deadline!==undefined&&it.obj?.[o.id]>o.deadline,points:o.points??1})),
  communications:(p?.communications||[]).map(c=>({id:c.id,label:c.label,doneAt:it.comm?.[c.id]??null,points:c.points??1})),
  branches:(p0?.branches||[]).filter(b=>it.branch?.[b.id]!=null).map(b=>({id:b.id,label:b.label,at:it.branch[b.id]}))};});
 const got=rows.reduce((s,r)=>s+r.score,0),full=rows.reduce((s,r)=>s+r.full,0);
 return {rows,got,full,percent:full?Math.round(got/full*1000)/10:0};
}

// ---------------------------------------------------------------- built-in library
// Problems seen on the photographed 문제 관리 list that can be graded from the simulator's state, the built-in scripts,
// and scenarios that combine them. Numbers of the photos (C4201, 스케줄ID 01178 …) are kept.
function seed({scripts=[],limits={}}={}){
 const P=[],S=[],SC=[];
 const prob=(o)=>{P.push({score:100,voice:'',situation:'',actions:'',trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:[],...o});return o.id;};
 // 열차 운행 계획 — 임시열차 C4201 (사진: 시나리오 상황#4 · 스케줄ID 01178)
 const C='C4201';
 const c1=prob({id:'P-C4201-01',subject:'열차 운행 계획',name:'용산-수원간 운행하는 임시열차 C4201열차의 스케줄을 생성하시오',limit:600,situation:'임시열차 C4201 운행 요청 (용산 → 수원)',actions:'열차스케줄 → 온라인 열차스케줄관리(생성) 또는 T/G 열차생성 → 패턴 선택 → 열차번호 C4201 → 편집적용',checks:[{label:'C4201 용산~수원 스케줄',condition:{type:'trainExists',train:C,from:'yongsan',to:'suwon'}}]});
 const c2=prob({id:'P-C4201-02',subject:'열차 운행 계획',name:'임시열차 C4201열차를 영등포 정차시분 10분으로 수정하시오',limit:60,actions:'열차스케줄 수정 → 영등포 정차시간 00:10:00 → 편집적용',checks:[{label:'영등포 정차 10분',condition:{type:'schedule',train:C,station:'yeongdeungpo',field:'dwell',value:600}}]});
 const c3=prob({id:'P-C4201-03',subject:'열차 운행 계획',name:'임시열차 C4201열차를 용산-영등포 구간운휴 조치하시오',limit:60,actions:'운휴운행설정 → 부분 → 시작역 용산 · 마지막역 영등포 → 운휴',checks:[{label:'용산~영등포 운휴',condition:{type:'cancelled',train:C,from:'yongsan',to:'yeongdeungpo'}}]});
 const c4=prob({id:'P-C4201-04',subject:'열차 운행 계획',name:'임시열차 C4201열차를 용산-영등포 부활운행 조치하시오',limit:60,actions:'운휴운행설정 → 부분 → 용산~영등포 → 운행',checks:[{label:'용산~영등포 운행',condition:{type:'cancelled',train:C,from:'yongsan',to:'yeongdeungpo',value:false}}]});
 const c5=prob({id:'P-C4201-05',subject:'열차 운행 계획',name:'임시열차 C4201열차를 용산-수원 전구간 운휴 조치하시오',limit:60,actions:'운휴운행설정 → 전체 → 운휴',checks:[{label:'전구간 운휴',condition:{type:'cancelled',train:C,from:'yongsan',to:'suwon'}}]});
 const g1=prob({id:'P-TG-01',subject:'열차 운행 계획',name:'온라인 열차그래프를 실행하여 K1135열차를 검색하시오',limit:120,actions:'열차스케줄 → 온라인 열차그래프 → 열차검색 → K1135',checks:[{label:'그래프에서 K1135 선택',condition:{type:'graphTrain',train:'K1135'}}]});
 // 철도관제시스템 운용 — 구술 (교수 확인)
 const o1=prob({id:'P-ORAL-MODE',subject:'철도관제시스템 운용',name:'제어모드의 종류에 대해 설명하시오',limit:60,actions:'AUTO(자동) · CCM(중앙 수동) · LOCAL(역 취급) 모드 설명',checks:[{label:'제어모드 구술',condition:{type:'manual',label:'제어모드 구술'}}]});
 const o2=prob({id:'P-ORAL-SCAN',subject:'철도관제시스템 운용',name:'베이스스캔에 대하여 설명하시오',limit:60,actions:'현장 설비 상태를 다시 수신해 LS 표시를 갱신하는 기능 설명',checks:[{label:'베이스스캔 구술',condition:{type:'manual',label:'베이스스캔 구술'}}]});
 const o3=prob({id:'P-ORAL-TRACE',subject:'철도관제시스템 운용',name:'열차추적에 대하여 설명하시오',limit:90,actions:'열차번호를 궤도회로 점유에 따라 따라가며 표시하는 기능 설명',checks:[{label:'열차추적 구술',condition:{type:'manual',label:'열차추적 구술'}}]});
 // 철도관제시스템 운용 — 실기 10항목 (관제교육훈련 실기평가서 Ⅱ: 항목당 2점). 「L/S에서 …」「MMI에서 …」는 따로 지정되는 두 과제다.
 // 의왕역에서 한다(대피·비상 시나리오와 겹치지 않는 역). 지적확인 환호는 교수가 확인한다.
 const OPS='uiwang',ev=(eventType,extra={})=>({type:'event',eventType,station:OPS,...extra}),call=id=>({id:'call',label:'지적확인 환호 시행 (교수 확인)',condition:{type:'manual',label:'지적확인 환호',key:'call-'+id},points:1});
 const op=(id,name,actions,objectives,setup={})=>prob({id:'P-OP-'+id,subject:'철도관제시스템 운용',name,limit:180,actions,objectives,communications:[],reactions:[],setup:{reset:[OPS],modes:[{station:OPS,value:'AUTO'}],...setup}});
 const ops=[
  op('MODE','의왕역 제어모드를 AUTO → CCM → LOCAL로 전환한 뒤 CCM을 거쳐 AUTO로 되돌리시오','L/S 상단 또는 MMI 현장설비제어 → 역제어모드: CCM → LOCAL(현장 인계 응답 처리) → CCM → AUTO',[
   {id:'ccm',label:'AUTO → CCM 전환',condition:ev('mode',{value:'CCM'}),points:1},{id:'local',label:'CCM → LOCAL 전환 (현장 인계)',condition:{type:'mode',station:OPS,value:'LOCAL'},points:1},
   {id:'auto',label:'CCM을 거쳐 AUTO 복귀',condition:{type:'all',conditions:[{type:'objective',id:'local'},ev('mode',{value:'AUTO'}),{type:'mode',station:OPS,value:'AUTO'}]},points:1,final:true}]),
  op('ROUTE','의왕역 진로제어: L/S에서 1A-2T 진로를, MMI에서 2A-5T 진로를 설정하시오','CCM 전환 → L/S: 1A 신호기 → 1A-2T / MMI: 현장설비제어 → 진로제어 → 2A-5T 선택',[
   {id:'ls',label:'L/S에서 1A-2T 진로 설정',condition:ev('route',{id:'1A-2T',source:'LS'}),points:1},{id:'mmi',label:'MMI에서 2A-5T 진로 설정',condition:ev('route',{id:'2A-5T',source:'MMI'}),points:1}]),
  op('POINT','의왕역 선로전환기 제어: L/S에서 21호를, MMI에서 22호를 반위로 전환하시오','CCM 전환 → L/S: 21호 선로전환기 → 반위 / MMI: 현장설비제어 → 선로전환기 제어 → 22 반위',[
   {id:'ls',label:'L/S에서 21호 반위 전환',condition:{type:'all',conditions:[{type:'point',station:OPS,point:'21',value:'R'},ev('point',{source:'LS'})]},points:1},
   {id:'mmi',label:'MMI에서 22호 반위 전환',condition:{type:'all',conditions:[{type:'point',station:OPS,point:'22',value:'R'},ev('point',{source:'MMI'})]},points:1}]),
  op('NUMBER','의왕역 열차번호 제어: L/S에서 2T 열번창에 K9001을, MMI에서 5T 열번창에 K9002를 입력하시오','L/S: 2T 열번창 우클릭 → 열차번호 입력 / MMI: 열차제어 → 열차번호제어 → 5T · 입력',[
   {id:'ls',label:'L/S에서 2T 열번창에 K9001 입력',condition:{type:'all',conditions:[{type:'trainAt',number:'K9001',station:OPS,slot:'2T'},ev('lsOperation',{op:'insert',slot:'2T',source:'LS'})]},points:1},
   {id:'mmi',label:'MMI에서 5T 열번창에 K9002 입력',condition:{type:'all',conditions:[{type:'trainAt',number:'K9002',station:OPS,slot:'5T'},ev('lsOperation',{op:'insert',slot:'5T',source:'MMI'})]},points:1}],{clear:['K9001','K9002']}),
  op('TRACE','K9005열차를 열차추적 하시오','MMI 열차제어 → 열차추적 → K9005 → 추적시작 (L/S에 추적 표시)',[
   {id:'trace',label:'K9005 열차추적 시작 (L/S 화면에 표출)',condition:{type:'event',eventType:'trace',id:'K9005'},points:1},call('trace')],{clear:['K9005'],trains:[{station:OPS,slot:'3T',number:'K9005',direction:'down'}]}),
  op('SCAN','베이스스캔을 L/S와 MMI에서 각각 실행하시오','L/S: 빈 곳 우클릭 → 베이스스캔 / MMI: 현장설비제어 → 베이스스캔',[
   {id:'ls',label:'L/S에서 베이스스캔 실행',condition:{type:'event',eventType:'scan',source:'LS'},points:1},{id:'mmi',label:'MMI에서 베이스스캔 실행',condition:{type:'event',eventType:'scan',source:'MMI'},points:1}]),
  op('SIGN','의왕역 구간에 L/S 표지판(선로일시사용정지)을 설정하시오','L/S 의왕역 화면 빈 곳 우클릭 → L/S 표지판 → 종류 선택 → 내용 입력 → 확인',[
   {id:'sign',label:'의왕역 화면에 L/S 표지판 설정',condition:ev('lsOperation',{op:'boardAdd'}),points:1},call('sign')]),
  op('RESTART','L/S 화면을 재실행하시오','L/S 화면 빈 곳 우클릭 → L/S 재실행',[
   {id:'restart',label:'L/S 재실행',condition:{type:'event',eventType:'lsRestart'},points:1},call('restart')]),
  op('OVERVIEW','[구로 - 수원] 구간 오버뷰를 실행하시오','L/S 화면 빈 곳 우클릭 → L/S Overview → [구로 - 수원]',[
   {id:'overview',label:'[구로 - 수원] 오버뷰 실행',condition:{type:'event',eventType:'overview',id:'south'},points:1},call('overview')]),
  op('NOTE','열차운행 그래프에 노트를 생성하시오','열차스케줄 → 온라인 열차그래프 → 노트관리 → 새노트작성 → 제목·내용 → 확인',[
   {id:'note',label:'그래프 노트 생성',condition:{type:'event',eventType:'note'},points:1},call('note')])];
 // 구술: 교수님 구술 문항(references/scenarios/구술(관제)_열차운행계획,운용및 실무.hwp)과 평가서 Ⅱ 예시. 답은 조치사항에 있고 교수가 답변을 확인한다.
 const oral=(id,name,answer,limit=90)=>prob({id:'P-ORAL-'+id,subject:'철도관제시스템 운용',name,limit,actions:answer,checks:[{label:name.replace(/(에 대하여|에 대해|을|를)? ?설명하시오$/,'')+' 구술',condition:{type:'manual',label:name.replace(/(에 대하여|에 대해|을|를)? ?설명하시오$/,'')+' 구술'}}]});
 const orals=[
  oral('SIGN','L/S 표지판에 대하여 설명하시오','L/S 화면상에 표지판 심벌(선로일시사용중지 등)을 설정하는 기능. 열차 운행 중 선로 지장 정보를 제공하여 열차운행에 안정성을 제공한다. 종류: 선로일시사용중지, 폐색방식변경, 열간작업, 전차선단전, 사용자입력, 서행속도표시'),
  oral('OVERVIEW','오버뷰에 대하여 설명하시오','각 콘솔별 제어역 전체의 열차운행상태, 현장설비 상태 등을 한번에 볼 수 있도록 표시하는 기능'),
  oral('RESTART','L/S 재실행과 베이스스캔의 차이점을 설명하시오','L/S 재실행: 3개의 L/S 화면 중 1개 이상이 비정상적으로 다운되었을 때 L/S를 새로 실행시키지 않고 다운된 화면만 재실행하는 기능. 베이스스캔: 현장설비의 모든 정보상태를 재수신 받을 때 쓰는 기능. 차이점: L/S 재실행은 L/S에서만 실행, 베이스스캔은 MMI 및 L/S에서 실행'),
  oral('NOTE','온라인 열차그래프의 노트에 대하여 설명하시오','열차그래프에 사용자가 어떤 구간에 대한 공사내용이나 중요한 내용을 열차그래프 안에 메시지 박스 형식으로 표시하는 것'),
  oral('RUNQUERY','열차운행 관련 조회에 대하여 설명하시오','열차운행계획 대비 실적을 바탕으로 열차운행 흐름을 파악하고 상황대처를 위해 역실적, 열차실적, 임시열차, 지연열차, 운휴열차 등의 실적 및 상황을 조회하는 기능'),
  oral('GRAPHMODE','열차그래프 화면모드를 설명하고 기능을 실행하시오','특정열차의 기본정보를 간단히 보여주거나 특정부분을 확대하거나 마우스 위치의 키로정·시간을 보여주는 기능. 툴팁 보기: 선택한 열차의 기본정보(열차번호, 종류, 시발종착, 출발·도착시각, 연계열번) 표시. 십자선 보기: 선택한 부분의 시간과 키로정 표시. 돋보기 기능: 보고 싶은 부분을 확대 (화면설정 → 화면모드설정)',120),
  oral('APPROACH','접근쇄정에 대하여 설명하시오','열차가 신호기 외방 일정구간에 진입한 뒤 신호를 취소하여도 철도시설물 및 열차를 보호하기 위해 신호기 정지를 현시한 후 장내 90초, 출발 30초간 진로를 쇄정하는 것'),
  oral('OVERLAP','오버랩(조사쇄정)에 대하여 설명하시오','장내 진입하는 열차가 전방의 출발신호기 정지를 무시하고 과주할 경우에 대비하여, 안전확보를 위해 출발신호기 전방 일정거리 내의 선로전환기를 안전측으로 쇄정하는 것'),
  oral('MANUALLOG','수동제어 이력조회에 대하여 설명하시오','운영자가 현장설비 및 열차번호, 장비절체, 로그재생 이력, 선로지장스케줄 조작이력 등을 관리·조회하는 기능. 종류: 열차번호 제어이력, 역모드 제어이력, 현장설비 제어이력, 장비계절체 이력, 장비고장 복구이력 등'),
  oral('REPLAY','로그재생을 설명하고 실행하시오','서버에 저장된 열차운행 관련 로그를 바탕으로 조건에 따라 검색된 역의 열차 운행상황을 다시 확인할 수 있도록 재현하는 다시보기 기능. 사고발생 원인 검증이나 재발방지 교육에 쓴다',120),
  oral('OPQUERY','운용자 조작 관련 조회에 대하여 설명하시오','운영자가 L/S나 MMI에서 조작하는 열차번호, 역모드, 현장설비, 수동조작이력 등은 운영자 정보와 함께 DB에 저장된다. 수동제어 이력조회는 이 조작정보에 쉽게 접근하도록 일정한 형식의 폼으로 관리한다'),
  oral('POSITION','열차위치목록 조회에 대하여 설명하시오','관할 영역 안에서 운행 중·운행 대기 중·운행 완료된 모든 열차의 운행상황을 파악하도록 정보를 제공하며, 운행 중인 열차는 점유역, 점유 열번창, 점유 궤도회로 등 상세정보를 제공한다'),
  oral('STAFF','관제업무종사자의 정의를 설명하시오','철도교통의 안전과 질서를 유지하기 위하여 철도차량의 운행을 집중 제어, 감시하는 자'),
  oral('ADJUSTDEF','「철도교통관제운영규정」상의 운전정리의 정의를 설명하시오','철도사고등으로 열차운행에 혼란이 발생하거나 혼란의 염려가 있을 경우 열차의 운행조건 및 일정 등을 변경하여 열차가 정상적으로 운행할 수 있도록 행하는 수단'),
  oral('ADJUSTKIND','「철도교통관제운영규정」상의 운전정리의 종류를 설명하시오','운전휴지, 운행순서변경, 운행선로변경, 단선운행, 운행시각변경, 열차합병, 특발, 교행변경, 대피변경, 열차번호변경, 폐색구간 또는 폐색방식변경, 임시서행, 임시정차, 편성차량변경, 임시열차운전, 그 밖에 철도교통의 안전과 질서유지에 필요한 사항'),
  oral('ROUTE','진로제어에 대하여 설명하시오','운행열차에 대해 선로를 확보해 주는 중요한 기능으로 해당역의 진로를 선택적으로 설정 및 해정할 수 있다'),
  oral('ENTRY','진입열차 예고 관리에 대하여 설명하시오','운행대기 중인 열차를 관리하는 기능으로, 열차정리 및 운행 대기열에 임시열차 등록을 통해 운행대기 열을 조정하여 운행순서를 정할 수 있다'),
  oral('PROPERTY','열차속성 조회에 대하여 설명하시오','열차의 상태정보 및 운행스케줄 정보를 제공한다. 조회정보: 열차번호, 종별, 출발역, 마지막역, 시발시각, 종착시각, 열차상태, 현재위치, 열차계획/실적정보 등'),
  oral('POINT','선로전환기 제어(Local 취급)에 대하여 설명하시오','선로전환기: 역구내 및 중간건넘선의 분기기를 전환하여 열차의 운행선로를 변경하는 설비. 선로전환기 전환: CCM모드에서 현장역으로 전환요청을 하여 정/반위 제어를 할 수 있는 기능. Local 취급 시: 시간(00시부터 00시까지), 목적(긴급점검을 위해), 승인번호 부여(관제승인 1호로 Local 취급)'),
  oral('ALARM','알람/이벤트 조회에 대하여 설명하시오','시스템 운영과정의 각종 경고메시지는 중요도와 사용목적, 사용빈도에 따라 분류되고 메시지 코드에 따라 처리된다. 알람/이벤트는 DB에 저장되어 필요시 검색하여 확인할 수 있다. 중요도: 중대한 오류(F), 오류(E), 경고(W)'),
  oral('NUMBER','열차번호 제어에 대하여 설명하시오','L/S 열번창 또는 MMI 열차번호제어 창에서 열차번호를 입력·수정·삭제·이동·교환하는 기능 (평가서 Ⅱ 구술 예시 — 교수님 구술 문항에는 답안이 없어 기능 설명으로 적음)')];
 // 열차운행선 관리 — 지장작업 5단계 (실기평가서 Ⅲ: 단계마다 5점, 감점 한 줄 = 채점 항목 하나).
 // 교수님 대본이 없는 과목이라 실기평가서의 감점 문장과 실무 교재(운행선관리 제3장 업무 진행 순서)로 만들었다. 구간·시각·열차는 연습용 설정이다:
 //   금천구청~안양역간 하2선 선로일시사용중지 (전차선 단전 동반 · 장비 투입), 양 끝 역(금천구청 · 안양)을 LOCAL로 이관한다.
 // 다섯 문제는 한 상황으로 이어진다(LOCAL · 표지판이 다음 단계로 넘어간다). 통보는 교수가 확인하고, 화면 조작은 실제 조작으로 채점한다.
 const WK=['geumcheon','anyang'],say=(id,label,text)=>({id,label,text,points:1}),done=(id,label,condition)=>({id,label,condition,points:1});
 const work=(n,name,situation,actions,objectives,communications,extra={})=>prob({id:'P-WORK-'+n,subject:'운행선 관리',name,limit:600,situation,actions,objectives,communications,reactions:[],...extra});
 const WORK='금천구청~안양역간 하2선 선로일시사용중지 작업 (전차선 단전 동반, 장비 투입) · 작업시간 01:00~04:00';
 const works=[
  work(1,'지장작업 계획을 수립하시오',WORK+'\n운전명령으로 시달된 작업이다. 작업시간대에 하2선을 운행하는 열차가 있다.','작업 구분(선로일시사용중지 / 각 열차 사이 차단) → 단전·장비 구분 → 경합 확인 · 운행조정 결정 통보 → L/S 표지판 · T/G 노트 표기 → 작업책임자 확인 · 인수인계',[
    done('sign','L/S 표지판 [선로일시사용정지] 설정 (금천구청 또는 안양 화면)',{type:'any',conditions:WK.map(station=>({type:'event',eventType:'lsOperation',station,op:'boardAdd',kind:'선로일시사용정지'}))}),
    done('note','T/G 노트 작성 (작업구간 · 시간)',{type:'event',eventType:'note'})],[
    say('c1','① 선로일시사용중지와 각 열차 사이 차단작업 구분','금일 01시 00분부터 04시 00분까지 금천구청~안양역간 하2선 작업은 열차운행을 중지하고 시행하는 선로일시사용중지 작업입니다. (각 열차 사이 차단작업 아님)'),
    say('c2','② 전차선 단전 · 장비운행 필요 여부 구분','전차선 단전이 필요한 작업이고, 장비 운행이 필요한 작업입니다.'),
    say('c3','③ 열차운행계획과 경합 확인 · 운행조정 결정 통보','(관) 금천구청역, 안양역. 관제 이상!\n(관) 금일 01시 00분부터 04시 00분까지 금천구청~안양역간 하2선 선로일시사용중지 작업 있습니다. 전차선 단전 동반, 장비 투입 작업입니다. 작업시간대 하2선 열차는 하1선으로 운행조정합니다. 관제 이상!\n   (역) 수신 이상!'),
    say('c5','⑤ 작업책임자 통해 영향 사항 확인 · 중요사항 인수인계','(관) 작업책임자 통해 장비 운행순서와 특이사항 확인 후 통보 바랍니다. 관제 이상!\n(교대 시) 금천구청~안양역간 01시 00분 지장작업, L/S 표지판 · T/G 노트 설정 완료, 단전 예정 01시 00분입니다.')],
   {setup:{clearTimetable:true,resetAll:true,reset:[...WK],modes:WK.map(station=>({station,value:'AUTO'}))}}),
  work(2,'전차선 단전 및 지장작업 시행을 승인하시오',WORK+'\n시행시간이 임박했다. 작업구간에 열차가 없다.','작업구간 열차 없음 확인 → 단전 준비 확인 → 전기운용자 단전 요청 · 단전 통보(직 · 성명 기록) → 주의사항 통보 · 승인번호 부여 → 양 끝 역 LOCAL 이관 확인 · 감시',[
    ...WK.map(station=>done('local-'+station,`${nm(station)}역 LOCAL 이관 (현장이 제어권을 받았는지 확인)`,{type:'mode',station,value:'LOCAL'})),
    done('power','L/S 표지판 [전차선단전] 설정',{type:'any',conditions:WK.map(station=>({type:'event',eventType:'lsOperation',station,op:'boardAdd',kind:'전차선단전'}))})],[
    say('c1','① 작업구간에 열차 · 차량 운행, 특이사항 없음 확인','금천구청~안양역간 하2선 작업구간 열차 및 차량 운행 없음, 특이사항 없음. 확인!'),
    say('c2','② 단전 준비사항 확인 (차량 정비 · 청소 · 입고)','(관) 안양역. 관제 이상!\n(관) 01시 00분 금천구청~안양역간 하2선 전차선 단전 예정입니다. 해당 구간 주박차량 정비 · 청소 · 입고 완료되었습니까? 관제 이상!\n   (역) 정비 · 청소 · 입고 완료되었습니다. 이상!'),
    say('c3','③ 전기운용자 단전 요청 · 단전시각 · 구간 통보, 통고받은 자 직 · 성명 기록','(관) 전기운용자. 관제 이상!\n(관) 금천구청~안양역간 하2선 단전준비 완료되었습니다. 단전 바랍니다. 관제 이상!\n(관) 금천구청역, 안양역. 관제 이상! 금천구청~안양역간 하2선 01시 00분 단전되었습니다. 단전구간으로 전기차 운행하지 않도록 하시고, 통고받은 분 직 · 성명 말씀해 주세요. 관제 이상!'),
    say('c4','④ 운전취급상 주의사항 통보 · 승인번호 부여','(관) 금천구청역, 안양역. 관제 이상!\n(관) 금천구청~안양역간 하2선 선로일시사용중지 작업, 관제승인 1호로 승인합니다. 작업시간 01시 00분부터 04시 00분까지입니다. 차단장비 이동, 인접선 열차 서행, 열차감시원 배치 확인 바랍니다. 역 조작취급은 관제승인 2호로 Local 취급합니다. 관제 이상!\n   (역) 수신 이상!')]),
  work(3,'지장작업 중 열차를 통제하시오',WORK+'\n작업이 진행 중이다. 인접선(하1선)으로 열차가 운행한다.','단전구간 진입 신호 정지 지시 → 디젤 · 장비도 관제 지시 후 취급 → 인접선 열차 속도준수 · 주의운전 통보 → 장비 위치 감시, 승인 · 주의사항은 운행 직전에 → 규정 준수 감시',[
    done('slow','L/S 표지판 [서행표시] 설정 (인접선 서행)',{type:'any',conditions:WK.map(station=>({type:'event',eventType:'lsOperation',station,op:'boardAdd',kind:'서행표시'}))})],[
    say('c1','① 단전구간 진입 신호기 정지 현시 지시','(관) 금천구청역. 관제 이상!\n(관) 단전구간 진입 하2선 출발신호기 정지 유지 바랍니다. 관제 이상!\n   (역) 금천구청역 수신 이상!'),
    say('c2','② 단전과 관련 없는 차량(디젤 · 장비)도 신호현시 전 관제 지시','(관) 디젤차 · 장비도 신호 현시 전 관제 지시 받고 취급하시기 바랍니다. 관제 이상!'),
    say('c3','③ 인접선 열차에 속도준수 · 주의운전 통보','(관) 하1선 운행열차. 관제 이상!\n(관) 금천구청~안양역간 하2선 작업 중입니다. 인접선 규정 속도 준수하시고, 작업원 있으니 주의운전 하시기 바랍니다. 관제 이상!\n   (기) 수신 이상!'),
    say('c4','④ 장비 위치 · 이동 감시, 관제승인 · 주의사항은 열차운행 직전에 부여','장비 작업위치 확인, 이동 감시. 폐색방식 변경 · 단선운전 · 선로변경이 있으면 관제승인과 주의사항은 열차운행 직전에 부여합니다.'),
    say('c5','⑤ 현장 역 · 소와 열차의 규정 준수 감시','작업구간 현장 역 · 소 및 열차 운행 규정 준수 여부 DLP · L/S로 감시. 확인!')]),
  work(4,'지장작업 완료 및 전차선 급전을 처리하시오',WORK+'\n작업책임자가 작업 완료를 통보했다.','작업구간 장비 · 차량 없음 확인 → 철수 · 급전 지장 없음 확인 → 완료시각 상호 기록, LOCAL → CCM → AUTO → 급전준비 확인 · 전기운용자 통보 → 급전시각 통보 · 출고 지시 → 표지판 철거',[
    ...WK.map(station=>({id:'auto-'+station,label:`${nm(station)}역 CTC 취급 복귀 (LOCAL → CCM → AUTO)`,condition:{type:'all',conditions:[{type:'event',eventType:'mode',station,value:'AUTO'},{type:'mode',station,value:'AUTO'}]},points:1,final:true})),
    done('remove','L/S 표지판 철거',{type:'any',conditions:WK.map(station=>({type:'event',eventType:'lsOperation',station,op:'boardDelete'}))})],[
    say('c1','① 작업구간 내 장비 · 차량 운행 없음 확인 (DLP · L/S)','작업완료 통보 수신. 작업구간 내 장비 및 차량 운행 없음. 확인!'),
    say('c2','② 장비 · 작업자 철수 완료, 급전하여도 문제 없음 확인','(관) 안양역. 관제 이상!\n(관) 작업완료 통보 받았습니다. 작업원 · 장비 철수 완료되었습니까? 전차선 급전하여도 문제 없습니까? 관제 이상!\n   (역) 철수 완료, 급전 지장 없습니다. 이상!'),
    say('c3','③ 작업완료시각 상호 기록 · 제어권 인수','(관) 작업완료시각 04시 00분으로 상호 기록합니다. 제어권 관제로 넘겨 주시기 바랍니다. 관제 이상!\n금천구청역 · 안양역 CCM 전환, AUTO 전환. 확인!'),
    say('c4','④ 급전 준비 완료 확인 → 전기운용자 통보','(관) 전기운용자. 관제 이상!\n(관) 금천구청~안양역간 하2선 작업 완료, 현장 역 급전준비 완료되었습니다. 급전 바랍니다. 관제 이상!'),
    say('c5','⑤ 급전시각 통보 · 주박차량 기동 · 열차 출고 지시','(관) 금천구청역, 안양역. 관제 이상!\n(관) 04시 05분 급전 완료되었습니다. 주박차량 기동하시고 열차 출고 준비 바랍니다. 관제 이상!\n   (역) 수신 이상!')]),
  work(5,'작업 완료 후 최초열차를 운행시키시오',WORK+'\n작업과 급전이 끝났다. K0401열차가 작업구간을 지나는 최초열차다 (금천구청역 하2선 정차 중).','최초열차 특정 · 통제 → 작업책임자에게 최초열차 감시 지시 → 역에 최초열차 · 주의사항 통보 지시 → 통과 감시 · 현장상태 확인 → 이상 유무를 작업책임자에게 통보하도록 지시',[
    done('passed','K0401(최초열차) 작업구간 통과 — 안양역 도착',{type:'all',conditions:[{type:'reaction',id:'r-first'},{type:'not',condition:{type:'trainAt',number:'K0401',station:'geumcheon'}}]})],[
    say('c1','① 작업구간 최초 운행 열차 통제','작업구간 최초열차는 금천구청역 하2선 K0401열차. 확인!'),
    say('c2','② 작업책임자에게 최초열차 운행상황 면밀히 감시하도록 지시','(관) 금천구청역. 관제 이상!\n(관) 작업책임자에게 최초열차 통과상태를 면밀히 감시하도록 하시기 바랍니다. 관제 이상!'),
    say('c3','③ 역에 최초열차임과 주의사항 통보 지시','(관) K0401열차가 금천구청~안양역간 작업 완료 후 최초열차입니다. 기관사에게 작업 후 최초열차임과 주의운전을 통보하시기 바랍니다. 관제 이상!\n   (역) 금천구청역 수신 이상!'),
    say('c4','④ 최초열차 운행상황 감시 · 통과 후 현장상태 확인','(관) 금천구청역, 안양역. 관제 이상! K0401열차 작업구간 통과 확인했습니다. 현장 이상 유무 확인 바랍니다. 관제 이상!'),
    say('c5','⑤ 이상 유무를 작업책임자에게 통보하도록 지시','(관) 이상 유무 확인 결과는 작업책임자에게 통보 바랍니다. 관제 이상!\n   (역) 수신 이상!')],
   {setup:{clear:['K0401'],trains:[{station:'geumcheon',slot:'2T',number:'K0401',direction:'down'}]},
    reactions:[{id:'r-first',label:'최초열차 통보 뒤 K0401 출발',when:{type:'communication',id:'c3'},do:[{type:'runTrain',number:'K0401',legs:[],exit:true}]}]})];
 // built-in scripts
 const titles={'yongsan-5':'용산역 부본선(5번) 대피','yongsan-4':'용산역 부본선(하 4번선) 대피','yeongdeungpo-1':'영등포역 부본선(1번) 대피','geumcheon-1':'금천구청역 부본선(1번) 대피','geumcheon-6':'금천구청역 부본선(6번) 대피','sch-conflict':'경합 해소','sch-create':'스케줄 생성'};
 const scriptProblem=(sid,subject,name)=>prob({id:'P-'+sid,subject,name,limit:limits[sid]||600,script:sid,actions:'실기 시나리오 대본의 조작·구술 단계',checks:[]});
 // 부본선 대피 · 비상시 조치: 대본을 능동형 데이터 문제(초기상태 · 순서 없는 목표 · 통보 · 상황반응)로 바꾼 것 (engine/fts-builtins.js)
 const B=node?require('./fts-builtins.js'):root.SimFTSBuiltins,data=id=>{const p=P.find(x=>x.id===id);return p;};
 const active=B?B.all({limits}):[];for(const p of active)prob(p);
 const evac=active.filter(p=>p.subject==='운행선 관리').map(p=>p.id);
 // 상황은 교육생에게 보이는 사실만: 해소 방법(해소역 · +2분 · 진로 변경)은 조치사항에 둔다 (조치사항 표시를 끄면 보이지 않음)
 const SITUATION={'sch-conflict':['임시열차 B0000 운행 요청이 들어와 시간표에 추가되었습니다. 경합을 확인하고 해소하시오.','온라인 열차그래프에서 경합 구간을 찾고, 경합지에서 가장 가까운 앞쪽 해소역(용산·영등포·금천구청·안양·군포·의왕)에서 B0000의 시각을 +2분 늦추고 도착·출발진로를 바꿔 해소합니다. 3차 경합이 생기지 않게 하고 최소 운전시격은 120초입니다.'],
  'sch-create':['지금 시간표에 새 열차를 만들어야 합니다. 열차를 생성하고 편집적용하시오.','열차스케줄 → 패턴을 불러와 열차를 생성 → 편집적용']};
 const plan=['sch-create','sch-conflict'].filter(s=>scripts.includes(s)).map(s=>{const id=scriptProblem(s,'열차 운행 계획',`${titles[s]} 문제를 시행하시오`),x=P.find(x=>x.id===id);x.situation=SITUATION[s][0];x.actions=SITUATION[s][1]+'\n\n'+(x.actions||'');x.setup={};return id;});

 const emergency=active.filter(p=>p.subject==='비상 시 조치'&&!p.variant).map(p=>p.id),emergencyVariants=active.filter(p=>p.variant).map(p=>p.id);
 const sit=(o)=>{S.push({section:'지하청량리-수원',scheduleId:'',limit:0,timetable:null,...o});return o.id;};
 const s4=sit({id:'S-04',name:'시나리오 상황#4',scheduleId:'01178',limit:3600,problems:[c1,c2,c3,c4,c5]});
 const sTg=sit({id:'S-TG',name:'#1-열차운행계획-009(구술)',scheduleId:'01105',limit:600,problems:[g1]});
 const sPlan=plan.length?sit({id:'S-PLAN',name:'#1-열차운행계획-004(스케줄)',scheduleId:'01106',limit:1800,problems:plan}):null;
 const sOral=sit({id:'S-ORAL',name:'#2-철도관제시스템운용실무(구술)',section:'지하청량리-영등포',scheduleId:'01105',limit:300,problems:[o1,o2,o3]});
 const sOp=sit({id:'S-OP',name:'#2-철도관제시스템운용-실기 10항목',section:'군포-수원',limit:2400,problems:ops});
 const sOralAll=sit({id:'S-ORAL-ALL',name:'#2-철도관제시스템운용-구술 전체',limit:3000,problems:[o1,o2,o3,...orals]});
 const sWork=sit({id:'S-WORK',name:'#3-열차운행선관리-지장작업 5단계',section:'구로-수원',limit:3000,problems:works});
 const sEvac=evac.map((p,i)=>sit({id:'S-EVAC-'+(i+1),name:'#2-운행선관리-'+data(p).name.replace(/를 시행하시오$/,''),limit:data(p).limit,problems:[p]}));
 const sEm=emergency.map(p=>sit({id:'S-'+p.slice(2),name:'#4-비상시조치-'+p.slice(5),limit:data(p).limit,problems:[p]}));
 const sEmV=emergencyVariants.map(p=>sit({id:'S-'+p.slice(2),name:'#4-비상시조치-'+p.slice(5),limit:data(p).limit,problems:[p]}));   // 감독관 지시형 · 상황별 (종합 시나리오에는 넣지 않는다)
 const scen=(o)=>{SC.push({author:'C001',createdAt:'2026-10-30 00:00:00',...o});};
 scen({id:'SC-01',name:'#1-열차운행계획-(종합)02',situations:[s4,sTg,...(sPlan?[sPlan]:[])]});
 scen({id:'SC-02',name:'#2-철도관제시스템운용·운행선관리-(종합)01',situations:[sOral,...sEvac]});
 if(sEm.length)scen({id:'SC-04',name:'#4-비상시조치-(종합)01',situations:sEm});
 scen({id:'SC-03',name:'#3-열차운행선관리-지장작업(종합)01',situations:[sWork]});
 scen({id:'SC-OP',name:'#2-철도관제시스템운용-실기 10항목',situations:[sOp]});
 scen({id:'SC-ORAL',name:'#2-철도관제시스템운용-구술 전체',situations:[sOralAll]});
 // 문제 하나씩 골라 풀기: 종합 시나리오는 순서대로 이어지므로, 상황마다 단독 시나리오도 둔다 (베타 피드백 — 특정 시나리오만 반복 연습)
 for(const id of [...sEvac,...sEm,...sEmV]){const x=S.find(v=>v.id===id),pr=data(x.problems[0]);scen({id:'SC-'+id.slice(2),name:pr.subject==='비상 시 조치'?'#4-비상시조치-'+pr.name.replace(/^비상시 조치\s*/,''):x.name,situations:[id]});}
 // 내장 표지는 내용의 지문: 앱의 내장 문제가 바뀌면 저장된 라이브러리의 옛 내장 문제가 자동으로 갱신된다
 const schedules=[];
 // A problem may replace the timetable explicitly; follow-up edits of C4201 keep the work done before them.
 const starters=new Set(['P-C4201-01','P-TG-01','P-ORAL-MODE','P-sch-create','P-sch-conflict',...active.filter(p=>!p.variant).map(p=>p.id)]);
 for(const p of P)if(starters.has(p.id)){
  const id=String(90001+schedules.length);p.setup={...p.setup,scheduleId:id};delete p.setup.clearTimetable;delete p.setup.baseTimetable;
  schedules.push({id,name:p.name+' · 교육 시간표',relative:true,generated:true,timing:'대본 열번·방향·초기 위치에 맞춘 교육용 생성 시각 (+10분, 열차 간격 3분)',timetable:B.timetableFor(p)});
 }
 // 감독관 지시형 · 상황별 문제는 같은 대본의 기본 문제 시간표를 함께 쓴다 (스케줄 ID가 밀리지 않는다)
 for(const p of P)if(p.variant){const base=P.filter(b=>!b.variant&&p.id.startsWith(b.id+'-')).sort((a,b)=>b.id.length-a.id.length)[0];p.setup={...p.setup,scheduleId:base.setup.scheduleId};delete p.setup.clearTimetable;delete p.setup.baseTimetable;}
 for(const sit of S){const first=P.find(p=>p.id===sit.problems[0]);sit.scheduleId=first?.setup?.scheduleId||'';}
 for(const x of [...P,...S,...SC,...schedules])x.builtin=BUILTIN+'#'+stamp(x);
 return {version:VERSION,problems:P,situations:S,scenarios:SC,schedules};
}
// 저장된 라이브러리의 내장 항목을 지금 앱의 내장 항목으로 갱신한다. 사용자 항목은 건드리지 않는다.
function stamp(x){const j=JSON.stringify(x);let h=2166136261;for(let i=0;i<j.length;i++){h^=j.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(36);}
function upgrade(lib,defaults){
 if(!object(lib)||!object(defaults))return lib;const next=structuredClone(lib);let changed=0;
 for(const kind of ['problems','situations','scenarios','schedules']){const list=next[kind]=Array.isArray(next[kind])?next[kind]:[];
  for(const d of defaults[kind]||[]){const i=list.findIndex(x=>x?.id===d.id);if(i<0){list.push(structuredClone(d));changed++;}else if(kind==='schedules'&&!list[i].builtin){continue;}else if(list[i].builtin!==d.builtin){list[i]=structuredClone(d);changed++;}}}
 return changed?next:lib;
}

// Pure conversion: browser timetable.initial() can be a live view, so never use it for templates.
function scheduleTable(schedule,now=0,serviceDate){
 const table=structuredClone(schedule.timetable);
 if(schedule.relative){table.serviceDate=serviceDate;const shift=Math.round(now);for(const train of table.trains)for(const calls of new Set([train.calls,train.plan].filter(Boolean)))for(const call of calls){call.arrival+=shift;call.departure+=shift;}}
 return table;
}
const api={scheduleTable,VERSION,BUILTIN,upgrade,SUBJECTS,CONDITIONS,PHENOMENA,test,describe,validate,view,createSession,advance,endCurrent,finish,grade,summary,seed,stationIds,setupActions};
if(node)module.exports=api;else root.SimFTS=api;
})(typeof globalThis!=='undefined'?globalThis:this);

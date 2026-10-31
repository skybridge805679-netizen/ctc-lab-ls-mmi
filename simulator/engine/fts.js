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
 event:{label:'조작 기록',fields:['eventType'],test:(c,x)=>(x.events||[]).some(e=>e.ok!==false&&e.type===c.eventType&&(!c.station||e.station===c.station)&&(c.id===undefined||String(e.id)===String(c.id))&&(c.value===undefined||e.value===c.value)),text:c=>`${c.station?nm(c.station)+'역 ':''}${c.eventType}${c.id!==undefined?' '+c.id:''}${c.value!==undefined?' '+c.value:''} 조작`},
 signalCancelled:{label:'신호 취소 조작',fields:['station','signal'],test:(c,x)=>(x.events||[]).some(e=>e.ok!==false&&e.station===c.station&&((e.type==='stop'&&String(e.id)===c.signal)||(e.type==='withdraw'&&String(e.id).startsWith(c.signal+'-'))||(e.type==='stopAll'))),text:c=>`${nm(c.station)}역 ${c.signal} 신호 취소(해정 조작)`},
 failedOp:{label:'실패한 조작',fields:[],test:(c,x)=>(x.events||[]).filter(e=>e.ok===false&&(!c.station||e.station===c.station)&&(!c.eventType||e.type===c.eventType)).length>=(c.count||1),text:c=>`${c.station?nm(c.station)+'역 ':''}거부된 조작${c.count>1?` ${c.count}회`:''}`},
 objective:{label:'목표 달성',fields:['id'],test:(c,x)=>x.objectives?.[c.id]!=null,text:c=>`목표 ${c.id} 달성`},
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
 objectives.forEach((o,i)=>{const where=`${w} 목표 ${i+1}`;if(!idOk(o,where))return;if(typeof o.label!=='string'||!o.label.trim())errors.push(`${where}: 이름이 없습니다`);checkCondition(o.condition,where,errors);if(o.points!==undefined&&!finite(o.points,0,100000))errors.push(`${where}: 점수는 0 이상`);if(o.deadline!==undefined&&!finite(o.deadline,1))errors.push(`${where}: 기한은 1~86400초`);for(const f of ['final','optional'])if(o[f]!==undefined&&typeof o[f]!=='boolean')errors.push(`${where}: ${f}는 true/false`);});
 comms.forEach((c,i)=>{const where=`${w} 통보 ${i+1}`;if(!idOk(c,where))return;if(typeof c.label!=='string'||!c.label.trim())errors.push(`${where}: 이름이 없습니다`);if(c.text!==undefined&&typeof c.text!=='string')errors.push(`${where}: 문안은 문자열`);if(c.points!==undefined&&!finite(c.points,0,100000))errors.push(`${where}: 점수는 0 이상`);if(c.deadline!==undefined&&!finite(c.deadline,1))errors.push(`${where}: 기한은 1~86400초`);});
 const known={objective:new Set(objectives.map(o=>o?.id)),communication:new Set(comms.map(c=>c?.id)),branch:new Set(branches.map(b=>b?.id)),reaction:new Set(reactions.map(r=>r?.id))};
 const refs=(c,where)=>{if(!object(c))return;if(['objective','communication','branch','reaction'].includes(c.type)&&!known[c.type].has(c.id))errors.push(`${where}: 없는 ${{objective:'목표',communication:'통보',branch:'상황 변경',reaction:'상황 반응'}[c.type]} ${c.id}`);(c.conditions||[]).forEach(k=>refs(k,where));if(c.condition)refs(c.condition,where);};
 objectives.forEach((o,i)=>refs(o.condition,`${w} 목표 ${i+1}`));
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
 if(Array.isArray(lib.schedules))for(const s of lib.schedules)if(object(s))timetable(s.timetable,`스케줄 ${s.id}`);
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
 return [...(st.reset||[]).map(station=>({type:'resetStation',station})),...(st.clear||[]).map(number=>({type:'deleteTrain',number})),...(st.routes||[]).map(x=>({...x,type:'route'})),...(st.approach||[]).map(x=>({...x,type:'approach'})),
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
 for(const o of p.objectives||[]){if(o.final){const ok=test(o.condition,{...ctx,objectives:item.obj||{}});if(ok&&item.obj?.[o.id]==null)(item.obj??={})[o.id]=ctx.elapsed??0;else if(!ok&&item.obj?.[o.id]!=null)delete item.obj[o.id];continue;}if(item.obj?.[o.id]==null&&test(o.condition,{...ctx,objectives:item.obj||{}}))(item.obj??={})[o.id]=ctx.elapsed??0;}
 for(const c of p.communications||[])if(item.comm?.[c.id]==null&&ctx.manual?.['comm:'+c.id]===true)(item.comm??={})[c.id]=ctx.elapsed??0;
}
function credit(task,doneAt){if(doneAt==null)return 0;const pts=task.points??1;return task.deadline!==undefined&&doneAt>task.deadline?pts/2:pts;}
function grade(p0,item,ctx){
 const p=view(p0,item),checks=p.checks||[],met=checks.map(k=>test(k.condition,ctx));
 const objectives=p.objectives||[],comms=p.communications||[];
 latch(p0,item,ctx);
 const required=[...objectives.filter(o=>!o.optional).map(o=>item.obj?.[o.id]),...comms.filter(c=>!c.optional).map(c=>item.comm?.[c.id])];
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
  if(item.triggerTimeMet&&item.triggerMet.every(Boolean)){item.status='진행';item.startedAt=now;item.fired=[];item.obj={};item.comm={};item.reactions={};item.branch={};out.push({kind:'activate',item,problem:p});for(const ph of setupActions(p.setup))out.push({kind:'phenomenon',item,phenomenon:ph,setup:true});return out;}
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
  objectives:(p?.objectives||[]).map(o=>({id:o.id,label:o.label,doneAt:it.obj?.[o.id]??null,late:o.deadline!==undefined&&it.obj?.[o.id]>o.deadline,points:o.points??1})),
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
 // built-in scripts
 const titles={'yongsan-5':'용산역 부본선(5번) 대피','yongsan-4':'용산역 부본선(하 4번선) 대피','yeongdeungpo-1':'영등포역 부본선(1번) 대피','geumcheon-1':'금천구청역 부본선(1번) 대피','geumcheon-6':'금천구청역 부본선(6번) 대피','sch-conflict':'경합 해소','sch-create':'스케줄 생성'};
 const scriptProblem=(sid,subject,name)=>prob({id:'P-'+sid,subject,name,limit:limits[sid]||600,script:sid,actions:'실기 시나리오 대본의 조작·구술 단계',checks:[]});
 // 부본선 대피 · 비상시 조치: 대본을 능동형 데이터 문제(초기상태 · 순서 없는 목표 · 통보 · 상황반응)로 바꾼 것 (engine/fts-builtins.js)
 const B=node?require('./fts-builtins.js'):root.SimFTSBuiltins,data=id=>{const p=P.find(x=>x.id===id);return p;};
 const active=B?B.all({limits}):[];for(const p of active)prob(p);
 const evac=active.filter(p=>p.subject==='운행선 관리').map(p=>p.id);
 const plan=['sch-create','sch-conflict'].filter(s=>scripts.includes(s)).map(s=>scriptProblem(s,'열차 운행 계획',`${titles[s]} 문제를 시행하시오`));
 const emergency=active.filter(p=>p.subject==='비상 시 조치').map(p=>p.id);
 const sit=(o)=>{S.push({section:'지하청량리-수원',scheduleId:'',limit:0,timetable:null,...o});return o.id;};
 const s4=sit({id:'S-04',name:'시나리오 상황#4',scheduleId:'01178',limit:3600,problems:[c1,c2,c3,c4,c5]});
 const sTg=sit({id:'S-TG',name:'#1-열차운행계획-009(구술)',scheduleId:'01105',limit:600,problems:[g1]});
 const sPlan=plan.length?sit({id:'S-PLAN',name:'#1-열차운행계획-004(스케줄)',scheduleId:'01106',limit:1800,problems:plan}):null;
 const sOral=sit({id:'S-ORAL',name:'#2-철도관제시스템운용실무(구술)',section:'지하청량리-영등포',scheduleId:'01105',limit:300,problems:[o1,o2,o3]});
 const sEvac=evac.map((p,i)=>sit({id:'S-EVAC-'+(i+1),name:'#2-운행선관리-'+data(p).name.replace(/를 시행하시오$/,''),limit:data(p).limit,problems:[p]}));
 const sEm=emergency.map(p=>sit({id:'S-'+p.slice(2),name:'#4-비상시조치-'+p.slice(5),limit:data(p).limit,problems:[p]}));
 const scen=(o)=>{SC.push({author:'C001',createdAt:'2026-10-30 00:00:00',...o});};
 scen({id:'SC-01',name:'#1-열차운행계획-(종합)02',situations:[s4,sTg,...(sPlan?[sPlan]:[])]});
 scen({id:'SC-02',name:'#2-철도관제시스템운용·운행선관리-(종합)01',situations:[sOral,...sEvac]});
 if(sEm.length)scen({id:'SC-04',name:'#4-비상시조치-(종합)01',situations:sEm});
 return {version:VERSION,problems:P,situations:S,scenarios:SC};
}

const api={VERSION,SUBJECTS,CONDITIONS,PHENOMENA,test,describe,validate,view,createSession,advance,endCurrent,finish,grade,summary,seed,stationIds,setupActions};
if(node)module.exports=api;else root.SimFTS=api;
})(typeof globalThis!=='undefined'?globalThis:this);

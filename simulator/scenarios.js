(function(root){
'use strict';
// 관제 실기 시나리오: the five 부본선 대피 exam scripts (references/scenarios/*.hwp). Each script is a list of what the
// controller says (say) and what must be done on the LS/MMI (do). 'do' steps are detected from the simulated station state and the
// operator events, in order; 'say' steps are ticked by the operator. The scripts' train numbers (A1002, B3191 …) are replaced
// by timetable trains of the simulator (shown in `trains`), because the timetable edit step needs a real train.
const core=()=>typeof module!=='undefined'?require('./core.js'):root.SimCore;

// ---- predicates over ctx = {state, events, model}
const sawMode=(station,value)=>ctx=>ctx.events.some(e=>e.ok&&e.type==='mode'&&e.station===station&&e.value===value)&&ctx.state.mode===value;
const stopped=signals=>ctx=>signals.every(sig=>ctx.events.some(e=>e.ok&&((e.type==='stop'&&e.id===sig)||(e.type==='withdraw'&&String(e.id).startsWith(sig+'-')))));
const released=signals=>ctx=>signals.every(sig=>ctx.state.signals[sig]==='STOP'&&!Object.keys(ctx.state.routes).some(r=>r.startsWith(sig+'-')));
const routeSet=id=>ctx=>!!ctx.state.routes[id];
const modeIs=value=>ctx=>ctx.state.mode===value;
// the broken-down train is whichever timetable train the operator picked (the timetable changes from scenario to scenario)
const departureRoute=(station,route)=>ctx=>{const t=ctx.model.trains.find(x=>x.id===ctx.train),c=t?.calls.find(x=>x.station===station);return !!c&&c.departureRoute===route;};

const NOTE_APPROACH='접근쇄정: 열차가 신호기 외방 일정구간에 진입한 뒤 신호를 취소해도 장내 90초·출발 30초 동안 진로를 쇄정하는 것.';
const NOTE_OVERLAP='오버랩: 장내 진입 열차가 출발신호기 정지를 넘어 과주할 경우에 대비해 출발신호기 전방 일정거리 안의 선로전환기를 안전측으로 쇄정하는 것.';
const NOTE_RULE='※ 대피 시 고장열차 취급: 용산역·영등포역은 스케줄 수정(출발진로)으로 운행시키고, 금천구청역은 CCM 취급으로 운행시킨다(금천구청역은 2선을 지나서 나오기 때문).';

const say=text=>({kind:'say',text});
const doStep=(text,check,hint)=>({kind:'do',text,check,hint});

const list=[
 {id:'yongsan-5',title:'용산역 부본선(5번) 대피',station:'yongsan',source:'용산역 부본선(5,6번)대피.hwp',
  problem:'{고장}열차(교재 A1002) 차량고장이 발생했습니다. 조치하세요.',direction:'up',
  seed:{routes:['2A-7T'],approach:['2A']},
  steps:[
   say('{고장}열차 차량고장으로 관제승인 1호로 용산역 5번 부본선 대피합니다. 용산역 장내신호기 앞에 정차합니다. 장내신호기 정지됩니다. 관제 이상!'),
   doStep('용산역 CCM 전환',sawMode('yongsan','CCM'),'MMI 현장설비제어 → 역제어모드 설정 → CCM, 또는 LS 상단 CCM → 예'),
   say('용산역 CCM 전환, CCM 전환 확인!'),
   doStep('2A 해정 (접근쇄정이 걸립니다)',stopped(['2A']),'LS에서 2A 신호기를 눌러 정지 확인창 [예]'),
   say('후속열차, 관제 이상! 선행 {고장}열차 용산역 부본선 대피 대기중입니다. 주의운전 하시고 안내방송 하시기 바랍니다.'),
   say('용산역, 관제 이상! {고장}열차 차량고장으로 5번 부본선 대피합니다. 안내방송 하시고 기동검수 통보 바랍니다.'),
   doStep('접근쇄정 90초가 지나 2A 진로가 해정됨',released(['2A']),'+10초 버튼으로 90초 경과시키기'),
   doStep('2A-5T 장내 진행 (5번 부본선)',routeSet('2A-5T'),'CCM → 2A → RT_2A_5T'),
   doStep('AUTO 전환',modeIs('AUTO'),'역제어모드 AUTO (CCM에서만 전환 가능)'),
   say('{고장}열차 신호 확인하고 5번 부본선 주의해서 진입하시기 바랍니다.'),
   say('({고장}열차 진입 완료 및 2A-7T 장내 진행신호 현시 확인 후) 후속열차 신호 확인하고 빠르게 운행 바랍니다.'),
   say('{고장}열차 수리 완료됐습니까? 후속열차로 가겠습니다. 잠시 대기 바랍니다.'),
   doStep('MMI에서 스케줄 수정: {고장} 용산 출발진로 3C_B605T (진입한 선로의 출발신호)',departureRoute('yongsan','3C_B605T'),'열차스케줄 관리(수정) → {고장} → 용산 출발진로 → 편집적용'),
   say('{고장}열차, 신호 확인하고 주의해서 발차하시기 바랍니다. 관제 이상! 이상입니다!')],
  notes:['※ 상2선의 2A-부본선과 하2선(1B-3T, 4B-B610T)의 상관관계를 명심할 것.','※ 용산역 6번 통과 조치 시 출발(3B-B605T)을 먼저 취급한 뒤 장내(2A-6T)를 취급할 것(오버랩).',NOTE_RULE,NOTE_APPROACH,NOTE_OVERLAP]},
 {id:'yongsan-4',title:'용산역 부본선(하 4번선) 대피',station:'yongsan',source:'용산역 부본선(하,4번선)대피.hwp',
  problem:'{고장}열차(교재 A1001) 차량고장이 발생했습니다. 조치하세요.',direction:'down',
  seed:{routes:['1B-3T'],approach:['1B']},
  steps:[
   say('{고장}열차 차량고장으로 관제승인 1호로 용산역 4번 부본선 대피합니다. 용산역 장내신호기 앞에 정차합니다. 장내신호기 정지됩니다. 관제 이상!'),
   doStep('용산역 CCM 전환',sawMode('yongsan','CCM')),
   say('용산역 CCM 전환, CCM 전환 확인!'),
   doStep('1B 해정 (접근쇄정)',stopped(['1B'])),
   say('후속열차 나오세요. 관제 이상! 선행 {고장}열차 용산역 부본선 대피 대기중입니다. 주의운전 하시고 안내방송 하시기 바랍니다.'),
   say('용산역, 관제 이상! {고장}열차 차량고장으로 4번 부본선 대피합니다. 안내방송 하시고 기동검수 통보 바랍니다.'),
   doStep('접근쇄정 90초 경과 후 1B 해정 확인',released(['1B'])),
   doStep('1B-4T 장내 진행',routeSet('1B-4T')),
   doStep('AUTO 전환 (끝까지 AUTO 유지)',modeIs('AUTO')),
   say('{고장}열차 신호 확인하고 4번 부본선 주의해서 진입하시기 바랍니다.'),
   say('({고장}열차 진입 완료 및 1B-3T, 4B-B610T 장내 및 출발 진행신호 현시 확인 후) 후속열차 신호 확인하고 빠르게 운행 바랍니다.'),
   say('{고장}열차 수리 완료됐습니까? 후속열차 후속으로 가겠습니다. 잠시 대기 바랍니다.'),
   doStep('MMI에서 스케줄 수정: {고장} 용산 출발진로 4C_B610T (진입한 선로의 출발신호)',departureRoute('yongsan','4C_B610T')),
   say('{고장}열차, 신호 확인하고 주의해서 발차하시기 바랍니다. 관제 이상! 이상입니다!')],
  notes:['※ 용산역 6번 통과 조치 시 출발(3B-B605T)을 먼저 취급한 뒤 장내(2A-6T)를 취급할 것(오버랩).',NOTE_RULE,NOTE_APPROACH,NOTE_OVERLAP]},
 {id:'yeongdeungpo-1',title:'영등포역 부본선(1번) 대피',station:'yeongdeungpo',source:'영등포역 부본선(1번)대피.hwp',
  problem:'{고장}열차(교재 A1001) 차량고장이 발생했습니다. 조치하세요.',direction:'down',
  seed:{routes:['1A-2T','4B-B622T'],approach:['1A']},
  steps:[
   say('{고장}열차 차량고장으로 관제승인 1호로 영등포역 1번 부본선 대피합니다. 영등포역 장내신호기 앞에 정차합니다. 장내신호기 정지됩니다. 관제 이상!'),
   doStep('영등포역 CCM 전환',sawMode('yeongdeungpo','CCM')),
   say('영등포역 CCM 전환, CCM 전환 확인!'),
   doStep('1A 해정(접근쇄정)과 4B 해정(오버랩 때문)',stopped(['1A','4B'])),
   say('후속열차, 관제 이상! 선행 {고장}열차 영등포역 부본선 대피 대기중입니다. 주의운전 하시고 안내방송 하시기 바랍니다.'),
   say('영등포역, 관제 이상! {고장}열차 차량고장으로 1번 부본선 대피합니다. 안내방송 하시고 기동검수 통보 바랍니다.'),
   doStep('접근쇄정 90초 경과 후 1A·4B 해정 확인',released(['1A','4B'])),
   doStep('1A-1T 장내 진행 (오버랩)',routeSet('1A-1T')),
   doStep('AUTO 전환',modeIs('AUTO')),
   say('{고장}열차 신호 확인하고 1번 부본선 주의해서 진입하시기 바랍니다.'),
   say('({고장}열차 진입 완료 및 1A-2T 장내 진행신호 현시 확인 후) 후속열차 신호 확인하고 빠르게 운행 바랍니다.'),
   say('{고장}열차 수리 완료됐습니까? 후속열차 후속으로 가겠습니다. 잠시 대기 바랍니다.'),
   doStep('MMI에서 스케줄 수정: {고장} 영등포 출발진로 4A_B622T',departureRoute('yeongdeungpo','4A_B622T')),
   say('{고장}열차, 신호 확인하고 주의해서 발차하시기 바랍니다. 관제 이상! 이상입니다!')],
  notes:['※ 영등포역 4번선·5번선 대피도 1번 대피와 같은 방법으로 한다.',NOTE_RULE,NOTE_APPROACH,NOTE_OVERLAP]},
 {id:'geumcheon-1',title:'금천구청역 부본선(1번) 대피',station:'geumcheon',source:'금천구청역 부본(1번)대피.hwp',
  problem:'{고장}열차(교재 B3191) 차량고장으로 금천구청역 부본선 대피, 후속 후속열차는 통과시키세요.',direction:'down',
  seed:{routes:['1B-3T','4B-B968T'],approach:['1B']},
  steps:[
   say('{고장}열차 차량고장으로 관제승인 1호로 금천구청역 1번 부본선 대피합니다. 금천구청역 장내신호기 앞에 정차 바랍니다. 장내신호기 정지됩니다. 관제 이상!'),
   doStep('금천구청역 CCM 전환',sawMode('geumcheon','CCM')),
   say('금천구청역 CCM 전환, CCM 전환 확인!'),
   doStep('1B 해정(접근쇄정), 4B 해정(오버랩) — 교재의 1A 해정은 이 시뮬레이터에서 1B-3T와 1A-2T를 동시에 설정할 수 없어 생략',stopped(['1B','4B'])),
   say('후속열차 나오세요. 관제 이상! 선행열차 금천구청역 대피 대기중입니다. 주의운전 하시고 안내방송 하시기 바랍니다.'),
   say('하2선 열차, 관제 이상! 금천구청역 1번 부본선 대피하는 열차 있습니다. 장내신호기 앞에 정차하시고 안내방송 하시기 바랍니다.'),
   say('금천구청역 관제 이상! {고장}열차 차량고장으로 1번 부본선 대피합니다. 안내방송 하시고 기동검수 통보 바랍니다.'),
   doStep('접근쇄정 90초 경과 후 1B·4B 해정 확인',released(['1B','4B'])),
   doStep('1B-1T 장내 진행 (54번 선로전환기 반위 → 오버랩 구술)',routeSet('1B-1T')),
   doStep('AUTO 전환',modeIs('AUTO')),
   say('{고장}열차 신호 확인하고 1번 부본선 주의해서 진입하시기 바랍니다.'),
   say('(1B-3T 장내 진행신호 확인 후) 후속열차 신호 확인하고 빠르게 운행 바랍니다.'),
   say('(1A-2T 장내 진행, 4B-B968T 출발 진행 확인 후) 하2선 열차 신호 확인하고 빠르게 운행 바랍니다.'),
   say('{고장}열차 수리 완료됐습니까? 본선열차 운행 후 신호 현시됩니다. 잠시 대기 바랍니다.'),
   doStep('CCM 전환 (본선열차 통과 후)',modeIs('CCM')),
   doStep('4A-B644T 출발 진행 (이때 하1·2선 장내신호가 현시되어 있으면 OFF할 것)',routeSet('4A-B644T')),
   doStep('AUTO 전환',modeIs('AUTO')),
   say('{고장}열차, 신호 확인하고 주의해서 발차하시기 바랍니다. 이상입니다!')],
  notes:['※ 하1·2선 본선열차가 접근해 오고 있으면 고장열차와 본선열차 중 어느 열차를 먼저 보낼지 선임관제사에게 물어볼 것.',NOTE_RULE,NOTE_APPROACH,NOTE_OVERLAP]},
 {id:'geumcheon-6',title:'금천구청역 부본선(6번) 대피',station:'geumcheon',source:'금천구청역 부본선(6번)대피.hwp',
  problem:'{고장}열차(교재 A1542) 6번선 대피, 후속열차(4번선 통과)(A1026) 4번선 통과! 후속열차(5번선)(S0502)보다 먼저 시행하시오.',direction:'up',
  seed:{routes:['2B-4T'],approach:['2B']},
  steps:[
   say('{고장}열차 차량고장으로 관제승인 1호로 금천구청역 6번 부본선 대피합니다. 금천구청역 장내신호기 앞에 정차 바랍니다. 장내신호기 정지됩니다. 관제 이상!'),
   doStep('금천구청역 CCM 전환',sawMode('geumcheon','CCM')),
   say('금천구청역 CCM 전환, CCM 전환 확인!'),
   doStep('2B 해정(접근쇄정) — 교재의 2A 해정은 2B-4T와 2A-5T가 동시에 설정되지 않아 생략',stopped(['2B'])),
   say('후속열차(5번선), 관제 이상! 6번 부본선 대피하는 열차 있습니다. 금천구청역 장내신호기 앞에 정차하시고 안내방송 하시기 바랍니다.'),
   say('후속열차(4번선 통과), 관제 이상! 선행열차 금천구청역 대피 대기중입니다. 주의운전 하시고 안내방송 하시기 바랍니다.'),
   say('금천구청역, 관제 이상! {고장}열차 차량고장으로 6번 부본선 대피합니다. 안내방송 하시고 기동검수 통보 바랍니다. (2B 신호 → 접근쇄정 구술)'),
   doStep('접근쇄정 90초 경과 후 2B 해정 확인',released(['2B'])),
   doStep('2B-6T 장내 진행 (전방 26B 정위 : 오버랩)',routeSet('2B-6T')),
   doStep('AUTO 전환',modeIs('AUTO')),
   say('{고장}열차 신호 확인하고 6번 부본선 주의해서 진입하세요.'),
   say('({고장}열차 6번 부본선 진입 및 2B-4T 장내 진행 확인 후) 후속열차(4번선 통과) 신호 확인하고 빠르게 운행 바랍니다.'),
   say('(2A-5T 장내 진행 확인 후) 후속열차(5번선), 관제 이상! 신호 확인하고 빠르게 운행 바랍니다.'),
   say('{고장}열차 수리 완료됐습니까? 본선 열차 운행 후 신호 현시됩니다. 잠시 대기 바랍니다.'),
   doStep('CCM 전환 (후속열차들이 운행한 후)',modeIs('CCM')),
   doStep('({고장}열차 6번 부본선 진입 완료 후) 2B-6T 해정(2B 정지 후 접근쇄정 경과) — 오버랩 쇄정이 풀려야 출발을 낼 수 있습니다',released(['2B'])),
   doStep('3A-B639T 출발 진행 → {고장}열차',routeSet('3A-B639T')),
   doStep('AUTO 전환',modeIs('AUTO')),
   say('{고장}열차, 신호 확인하고 주의해서 발차하시기 바랍니다. 관제 이상! 이상입니다!')],
  notes:[NOTE_RULE,NOTE_APPROACH,NOTE_OVERLAP]}
];

// Trains of the CURRENT timetable that call at the scenario station in the scenario's direction.
function candidates(sc,model){return model.trains.filter(t=>t.direction===sc.direction&&!t.cancelled&&t.calls.some(c=>c.station===sc.station)).map(t=>t.id);}

// ---- engine
function seed(sc,state){
 const c=core().forStation(sc.station),fresh=c.initial();
 for(const k of Object.keys(state))delete state[k];Object.assign(state,fresh);
 c.dispatch(state,{type:'mode',value:'CCM',source:'SCENARIO'});
 for(const id of sc.seed.routes){const r=c.dispatch(state,{type:'route',id,source:'SCENARIO'});if(!r.ok)throw new Error(`${sc.id}: seed route ${id}: ${r.message}`);}
 for(const sig of sc.seed.approach)c.dispatch(state,{type:'approach',signal:sig,present:true,source:'SCENARIO'});
 c.dispatch(state,{type:'mode',value:'AUTO',source:'SCENARIO'});
 return state;
}
// A run keeps `done` flags per step; do-steps complete strictly in order, say-steps are ticked freely.
function newRun(sc,train=''){return {sc,train,done:sc.steps.map(()=>false),events:[],started:Date.now()};}
// '{고장}' in a script line stands for the chosen train
const fill=(text,run)=>text.replaceAll('{고장}',run.train||'고장열차');
function advance(run,ctx){
 const c={...ctx,events:run.events,train:run.train};let changed=false;
 for(let i=0;i<run.sc.steps.length;i++){
  const s=run.sc.steps[i];if(s.kind!=='do'||run.done[i])continue;
  if(s.check(c)){run.done[i]=true;changed=true;}else break;     // the first unmet do-step blocks the later ones
 }
 return changed;
}
const finished=run=>run.done.every(Boolean);
const api={list,seed,newRun,advance,finished,fill,candidates};
if(typeof module!=='undefined')module.exports=api;else root.SimScenarios=api;
})(typeof window!=='undefined'?window:globalThis);

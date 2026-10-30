(function(root){
'use strict';
// 경합 시나리오·스케줄생성 시나리오 (references/scenarios/*.hwpx): MMI의 온라인 열차스케줄관리와 온라인 열차그래프에서 하는 순서를 단계로 두고,
// 시간표(모델)와 화면 상태에서 각 단계를 인식한다. 시간표는 수시로 바뀌는 자료라 문제는 시작할 때 현재 시간표로 만든다.
// ctx = {model, ui:{graphOpen, graphTrain, tgMode, station, scheduleOpen, scheduleMode, scheduleSelected, patternOpen}, events}
const isNode=typeof module!=='undefined';
const T=isNode?require('./timetable.js'):root.SimTimetable;
const N=isNode?require('./network.js'):root.SimNetwork;
const nm=id=>N.catalog[id]?.name||id;
const say=text=>({kind:'say',text});
const doStep=(text,check,hint,explain)=>({kind:'do',text,check,hint,explain});
const train=(ctx,id)=>ctx.model.trains.find(t=>t.id===id);

// ---- 경합 시나리오: 경합 찾기 → 해소역에서 +2분 → 도착·출발진로 수정
function conflictScenario(p){
 const {id,leader,nearest,baseline}=p;
 const idx=t=>t.calls.findIndex(c=>c.station===nearest);
 const at=ctx=>{const t=train(ctx,id);return t&&idx(t)>=0?{t,c:t.calls[idx(t)],b:baseline[idx(t)]}:null;};
 const involves=c=>c.trains.includes(id);
 const diff=t=>t.calls.findIndex((c,i)=>c.arrival!==baseline[i].arrival||c.departure!==baseline[i].departure||c.arrivalRoute!==baseline[i].arrivalRoute||c.departureRoute!==baseline[i].departureRoute);
 const steps=[
  doStep('열차스케줄 → 온라인 열차그래프 실행',ctx=>ctx.ui.graphOpen,'MMI 열차스케줄 메뉴 → 온라인 열차그래프'),
  doStep(`열차번호 검색(Ctrl+F)으로 ${id}열차 선택`,ctx=>ctx.ui.graphTrain===id&&ctx.ui.graphOpen,`그래프의 열차 검색에 ${id} 입력 후 검색`),
  doStep('십자선 보기 (필요시 돋보기)',ctx=>ctx.ui.tgMode==='cross','T/G 보기(V) → 화면모드 → 십자선보기'),
  say(`1차 경합은 ${leader}열차와 ${id}열차가 ○○역과 ○○역 구간에서 발생하였습니다. ○○역에서 해소하겠습니다. (경합 구간과 경합지에서 가장 가까운 앞쪽 해소역을 직접 판단해 구술)`),
  doStep(`열차스케줄 관리(수정)에서 ${id}열차 검색`,ctx=>ctx.ui.scheduleOpen&&ctx.ui.scheduleMode==='edit'&&ctx.ui.scheduleSelected===id,'열차스케줄 → 온라인열차스케줄관리 → 열차스케줄관리(수정) → 열차번호 검색'),
  doStep('해소역에서 출발시각 +2분 (3차 경합 주의)',ctx=>{const a=at(ctx);return !!a&&a.c.departure>=a.b.departure+120;},'해소역은 경합지에서 가장 가까운 앞쪽 해소역: 용산·영등포·금천구청·안양·군포·의왕',
   ctx=>{const t=train(ctx,id);if(!t)return '';const k=diff(t);if(k<0)return '';if(t.calls[k].station!==nearest)return `수정이 ${nm(t.calls[k].station)}역에서 시작했습니다. 경합지에서 가장 가까운 앞쪽 해소역에서 해소하세요. (해소역: ${T.RESOLVE_STATIONS.map(nm).join('·')})`;return '';}),
  doStep('편집적용 후 운영자 선호화면에서 해소역 L/S 선택',ctx=>ctx.ui.station===nearest,'MMI 시스템관리 → 제어화면관리 → 운영자선호화면 설정, 또는 LS의 역 선택'),
  doStep('해소역 도착진로·출발진로 수정 후 편집적용',ctx=>{const a=at(ctx);return !!a&&a.c.arrivalRoute!==a.b.arrivalRoute&&a.c.departureRoute!==a.b.departureRoute;},'열차스케줄관리(수정) → 해소역의 도착진로·출발진로 → 편집적용'),
  doStep('경합 해소 확인 (다른 열차와의 3차 경합 없음)',ctx=>{const t=train(ctx,id);return !!t&&T.conflicts(ctx.model).filter(involves).length===0&&diff(t)>=0;},'그래프에서 십자선보기로 다른 열차와 겹치는 곳이 남지 않았는지 확인',
   ctx=>{const left=T.conflicts(ctx.model).filter(involves);return left.length?`경합이 ${left.length}건 남아 있습니다 (${nm(left[0].station)}역 부근부터). 3차 경합이 생기지 않았는지 확인하세요.`:'';}),
  say('1차 경합 해소하였습니다. 이상입니다!')];
 return {id:'sch-conflict',group:'schedule',title:'경합 해소 (경합 시나리오)',source:'경합 시나리오.hwpx',station:'yongsan',stations:[],cast:[],autos:{},
  problem:`${leader}열차와 ${id}열차 사이에 경합이 발생했습니다. 온라인 열차그래프에서 경합을 찾아 해소하세요. (${id}는 이 연습을 위해 만든 임시열차입니다. 경합 위치와 해소역은 직접 판단합니다)`,
  trains:[],notes:['※ 경합해소는 경합지에서 가장 최근 해소역에서 해야 합니다.','※ 해소역: 용산역, 영등포역, 금천구청역, 안양역, 군포역, 의왕역.'],steps};
}

// ---- 스케줄생성 시나리오: 열차운행패턴으로 생성 → 수정에서 속성 변경
function planCreate(model,pick=Math.random){
 const used=new Set(model.trains.map(t=>t.id)),down=pick()<0.5,list=down?N.stations:[...N.stations].reverse();
 const a=Math.floor(pick()*(list.length-5)),b=a+4+Math.floor(pick()*(list.length-a-4));
 let id;do{id='A'+String(Math.floor(1000+pick()*8999));}while(used.has(id));
 const others=model.trains.filter(t=>t.id!==id);
 const kinds=['일반열차','회송열차','전동열차'],flags=['회송','주박','직통','입고'];
 return {id,dir:down?'down':'up',from:list[a].id,to:list[b].id,start:Math.floor(pick()*6)*3600-8*3600+9*3600,       // 정각 (표시시각 09~14시)
  carCount:4+2*Math.floor(pick()*5),kind:kinds[Math.floor(pick()*2)],service:'부정기',flag:flags[Math.floor(pick()*flags.length)],related:others.length?others[Math.floor(pick()*others.length)].id:''};
}
function createScenario(p){
 const t0=ctx=>train(ctx,p.id);
 const made=ctx=>{const t=t0(ctx);return !!t&&t.direction===p.dir&&t.calls[0].station===p.from&&t.calls.at(-1).station===p.to&&t.calls[0].departure===p.start;};
 const props=ctx=>{const t=t0(ctx);return !!t&&t.carCount===p.carCount&&t.kind===p.kind&&t.service===p.service&&(t.flags||[]).includes(p.flag)&&(!p.related||t.relatedTrain===p.related);};
 const steps=[
  doStep('열차스케줄 → 온라인열차스케줄관리 → 열차스케줄관리(생성)',ctx=>ctx.ui.scheduleOpen&&ctx.ui.scheduleMode==='create','MMI 열차스케줄 → 온라인열차스케줄관리 → 생성'),
  doStep('열차운행패턴선택 창 열기',ctx=>ctx.ui.patternOpen||made(ctx),'열차운행패턴선택 버튼'),
  doStep(`패턴으로 ${p.id}열차 생성 (${p.dir==='down'?'하행':'상행'}, ${nm(p.from)}~${nm(p.to)}, 시작 ${T.clock(p.start)}) 후 편집적용`,made,'임시열차번호·시작시간 입력 → [열차운행패턴선택] → 열차방향 → 열차패턴조회 → 전동 패턴 선택 → 출발역·종착역 → 확인 → 편집적용',
   ctx=>{const t=t0(ctx);if(!t)return '';const w=[];if(t.direction!==p.dir)w.push('운행방향');if(t.calls[0].station!==p.from||t.calls.at(-1).station!==p.to)w.push('운행구간');if(t.calls[0].departure!==p.start)w.push(`시작시각(${T.clock(p.start)} 정각)`);return w.length?`${p.id}열차가 만들어졌지만 ${w.join('·')}이(가) 문제와 다릅니다. 열차스케줄관리(수정)에서 시각을 고치거나 삭제 후 다시 생성하세요.`:'';}),
  doStep(`열차스케줄관리(수정)에서 ${p.id}열차 검색`,ctx=>ctx.ui.scheduleOpen&&ctx.ui.scheduleMode==='edit'&&ctx.ui.scheduleSelected===p.id,'경부선, 오늘, 모두 → 온라인 열차번호 검색 → 확인'),
  doStep(`연계열차 ${p.related||'(없음)'}, 차량수 ${p.carCount}량, 열차등급 ${p.kind}, 운행구분 ${p.service}, 기능열차 ${p.flag} 로 수정 후 편집적용`,props,'선택열차정보에서 값을 바꾸고 편집적용 (분할합병은 이 시뮬레이터에서 지원하지 않습니다)',
   ctx=>{const t=t0(ctx);if(!t||t.plan===undefined)return '';const w=[];if(t.carCount!==p.carCount)w.push('차량수');if(t.kind!==p.kind)w.push('열차등급');if(t.service!==p.service)w.push('운행구분');if(!(t.flags||[]).includes(p.flag))w.push('기능열차');if(p.related&&t.relatedTrain!==p.related)w.push('연계열차');return w.length&&T.valid(t)?`아직 문제와 다른 항목: ${w.join('·')} (편집적용을 눌러야 반영됩니다)`:'';}),
  say('이상입니다!')];
 return {id:'sch-create',group:'schedule',title:'스케줄 생성 (스케줄생성 시나리오)',source:'스케줄생성 시나리오.hwpx',station:'yongsan',stations:[],cast:[],autos:{},
  problem:`${p.dir==='down'?'하행':'상행'} 전동열차 ${p.id}를 ${nm(p.from)}~${nm(p.to)} 구간으로 시작시각 ${T.clock(p.start)} 정각에 생성한 뒤, 연계열차 ${p.related||'(없음)'} · 차량수 ${p.carCount}량 · 열차등급 ${p.kind} · 운행구분 ${p.service} · 기능열차 ${p.flag}로 수정하세요.`,
  trains:[],notes:['※ 분할합병 항목은 이 시뮬레이터에서 지원하지 않아 문제에서 제외했습니다.'],steps};
}
const list=[{id:'sch-conflict',title:'경합 해소 (경합 시나리오)',group:'schedule'},{id:'sch-create',title:'스케줄 생성 (스케줄생성 시나리오)',group:'schedule'}];
const api={list,conflictScenario,createScenario,planCreate};
if(isNode)module.exports=api;else root.SimScheduleScenarios=api;
})(typeof window!=='undefined'?window:globalThis);

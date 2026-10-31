(function(root){
'use strict';
// 비상시조치 평가 시 상황별 대응 요령 (references/scenarios/emergency/비상시조치(상황변경시대응).hwp, emergency-data.js variants)
// → FTS 문제의 상황 변경(branches). 6개 기본 시나리오(사상사고 · 차량고장 · 동묘충돌 · 석수화재 · 석수충돌 · 시청침수)에서
// 감독관(교수)이 상황을 바꾸면 교육생이 그에 맞게 대응해야 하는 분기다.
//   at    : 원문 줄 범위 [시작, 끝) — 분기 내용(교수가 보는 원문)
//   head  : 시작 줄의 원문 (원문이 바뀌면 시험이 잡는다)
//   comms : [id, 이름, 시작, 끝] — 그 분기에서 교육생이 해야 할 통보·지시 (원문 줄 그대로)
//   drop  : 이 분기에서 하지 않게 되는 기본 목표·통보 (원문이 바꾼다고 명시한 번호, 또는 '정상운행 가능'으로 필요 없어진 구원 조치)
// 원문에 없는 조작·번호는 만들지 않는다. 통보·지시는 교수가 모니터링에서 확인한다.
const node=typeof module!=='undefined';
const D=node?require('./emergency-data.js'):root.SimEmergencyData;
const L=()=>D.variants.lines;
const RESCUE={'05':['rename-G1210','move-G1210','delete-G1210','rename-G1208','n16','n17','n18'],'06':['rename-G0454','move-G0454','delete-G0454','rename-G0452'],'06-1':['rename-G0454','move-G0454','delete-G0454','rename-G0452']};
const FIRE=key=>[
 {id:'v-change-after-control',label:'열차통제 종료 후 운행선 변경 지시',at:[209,212],head:'열차통제 종료 후 운행선 변경지시'},
 {id:'v-change-during-rescue',label:'구원준비 중 운행선 변경 지시 (기존 순서 변경)',at:[212,214],head:'구원준비 중 운행선 변경 지시'},
 {id:'v-self-run-first',label:'화재차량 완전부동취급 · 자력 운행 가능 (최초 #11 사고복구반 수보 시)',at:[214,240],head:'화재발생 차량 완전부동취급',drop:RESCUE[key],
  comms:[['v-pan','MCB 차단·판타그래프 하강 · 연장급전 조치 통보',214,217],['v-self-first','사고복구반 수보 · K0452 출발 준비 · 인접선 운행 재개',217,226],['v-seoksu','석수역 · K0452 정상운행 안내방송',226,229],['v-guro','구로역 · K0452 차량교체 준비',229,233],['v-depart','K0452 출발 지시 (구로역까지)',233,240]]},
 {id:'v-self-run-late',label:'자력 운행 가능 (운행선 변경 후 수보 시)',at:[240,259],head:'시나리오 진행 중(운행선 변경 후) 수보 시',drop:RESCUE[key],
  comms:[['v-self-late','사고복구반 수보 · K0452 출발 준비',240,247],['v-seoksu-late','석수역 · K0452 정상운행 · 열차지연 안내방송',247,251],['v-guro-late','구로역 · K0452 차량교체 준비',251,255],['v-depart-late','K0452 출발 지시 (구로역까지)',255,259]]}
];
const BRANCHES={
 // ■ 사상사고 (04 금정 하선)
 '04':[
  {id:'v-delay',label:'상황1 · 사고조치 지연 (K0811 발차 후)',at:[2,23],head:'<상황1> 사고조치 지연(K811 발차후)',drop:['n18','n19'],
   comms:[['v18','18 · 조치지연 수신 · 금정역 운행중지·회송 예정 통보',5,17],['v18-1','18-1 · 복구상황 재확인 후 금정역까지 운행·여객 하차',17,23]]},
  // 원문: 「A1005열차 안양역 통과 후 K0811열차를 하1선으로 운행선 변경 · 안양역 CCM 4B해정(1B, 4C 진행 확인 유지) ·
  // A1005 자동진로 확보 위해 군포 AUTO유지 · A1005열차 군포역 통과하면 1B-1T」
  // → 주입하면 A1005가 안양역 1B 장내 앞(B658T)에 나타난다. A1005는 연동을 지키며 1B-3T → 4C-B660T로 지나간다.
  //   K0811용 4B-B660T가 서 있으면 오버랩·경합으로 들어오지 못하므로 교육생이 4B를 해정해야 한다. 역이 AUTO면 1B·4C가
  //   자동 진로로 서고, CCM이면 교육생이 직접 설정해야 한다(진행 확인 유지).
  //   K0811 운행선 변경 진로(4B-B660T)와 군포 1B-1T는 A1005가 지나간 뒤에만 인정한다.
  {id:'v-a1005',label:'상황2 · A1003 후속 A1005 근접',at:[23,30],head:'<상황2> A1003열차의 후속열차(A1005) 근접해 있을 경우',
   comms:[['v15-A','15-A · A1005 안양역 통과 후 K0811 하1선 운행선 변경 보고 (각 역·열차 통보에 전제)',24,30]],
   drop:['route-anyang-4B-B660T','route-gunpo-1B-1T'],
   reactions:[{id:'r-a1005',label:'A1005 안양역 접근 · 통과',do:[{type:'insertTrain',station:'anyang',slot:'B658T',number:'A1005',direction:'down'},{type:'runTrain',number:'A1005',legs:[{station:'anyang',slot:'3T'},{station:'anyang',slot:'B660T'}],exit:true}]}],
   objectives:[
    {id:'a1005-entry',label:'안양역 1B-3T 진행 확인 (A1005 · CCM이면 직접 설정)',condition:{type:'all',conditions:[{type:'reaction',id:'r-a1005'},{type:'route',station:'anyang',route:'1B-3T'}]},points:2},
    {id:'a1005-exit',label:'안양역 4C-B660T 진행 확인 (A1005 · CCM이면 직접 설정)',condition:{type:'all',conditions:[{type:'reaction',id:'r-a1005'},{type:'route',station:'anyang',route:'4C-B660T'}]},points:2},
    {id:'a1005-passed',label:'A1005 안양역 통과 (4B 해정 → 1B-3T · 4C-B660T 자동 진로)',condition:{type:'all',conditions:[{type:'reaction',id:'r-a1005'},{type:'trainGone',number:'A1005'}]},points:2},
    {id:'route-anyang-4B-B660T-after',label:'안양역 4B-B660T 출발 진행 (A1005 통과 후 K0811 하1선 운행선 변경)',condition:{type:'all',conditions:[{type:'objective',id:'a1005-passed'},{type:'route',station:'anyang',route:'4B-B660T'}]},points:2},
    {id:'route-gunpo-1B-1T-after',label:'군포역 1B-1T 장내 진행 (A1005 군포역 통과 후)',condition:{type:'all',conditions:[{type:'objective',id:'a1005-passed'},{type:'route',station:'gunpo',route:'1B-1T'}]},points:2}]},
  {id:'v-myeonghak-before',label:'상황3 · 사고열차 정차위치 변경 (명학 진입 전)',at:[30,35],head:'<상황3> 사고열차 정차위치 변경(명학 진입전)',
   comms:[['v-control3','열차 통제 변경 (K1114 금정 · K1116 군포 · K1118 당정 정차)',31,35]]},
  {id:'v-myeonghak',label:'상황4 · 사고열차 정차위치 변경 (명학역)',at:[35,41],head:'<상황4> 사고열차 정차위치 변경(명학역)',
   comms:[['v-control4','열차 통제 변경 · 명학역에서 운행중지',36,41]]},
  {id:'v-myeonghak-after',label:'상황5 · 사고열차 정차위치 변경 (명학역 진출 후)',at:[41,47],head:'<상황5> 사고열차 정차위치 변경(명학역 진출 후)',
   comms:[['v-control5','열차 통제 변경 (운행정지는 기본 시나리오)',42,47]]}],
 // ■ 차량고장 (05 가산디지털 상선)
 '05':[
  {id:'v-bogie',label:'상황1 · 고장대차 차단 조치 (정상운행 가능)',at:[48,72],head:'<상황1> 고장대차 차단 조치(정상운행 가능)',drop:RESCUE['05'],
   comms:[['v13','13 · 차량상태 재통보 · 기동검수반 확인',50,60],['v15','15 · 정상운행 · 구로역 차량교체 · 출발 지시',60,72]]},
  {id:'v-before-platform',label:'상황2 · 정거장 진입 전 정차',at:[72,101],head:'<상황2> 정거장 진입 전 정차',drop:RESCUE['05'],
   comms:[['v7','7 · 정차위치 확인 (승강장 진입 전)',73,80],['v15-platform','15 · 가산디지털역 정지위치까지 운행 · 정상운행 통보',80,87],['v-normal','정상운행 · 출발 지시',87,93],['v-swap','차량교체 · 구로역',93,101]]}],
 // 동묘충돌 (02)
 '02':[
  {id:'v-adjacent',label:'인접선 지장여부 확인 불가',at:[102,105],head:'인접선 지장여부 확인 불가'},
  {id:'v-k602-cannot',label:'K0602 회송 불가 → K1008 상선 단선지령식 우선',at:[105,111],head:'K602 회송 불가'},
  {id:'v-g602-first',label:'G0602 회송 후 단선지령식 지시',at:[111,114],head:'G602 회송후 K1008 단선지령식 지시'},
  {id:'v-g607-passed',label:'G0607 통과 후 또는 설정 없음 (#21 일부 변경)',at:[114,117],head:'G607 통과 후 또는 설정 없음',
   reactions:[{id:'r-g607-gone',label:'인접선 최초열차(K0607)가 이미 지나감',when:{type:'not',condition:{type:'trainGone',number:'K0607'}},do:[{type:'deleteTrain',number:'K0607'}]}]},
  {id:'v-derail-k602',label:'충돌 시 열차탈선 · K0602 23B 선로전환기 탈선 (2차 확인 시)',at:[117,139],head:'충돌시 열차탈선',drop:['n8'],
   comms:[['v8','8 · K0602·K0604 운행중지 · 동묘앞역 승객 대피',120,129],['v8-report','관제팀장·관제운영실 보고 · 탈선복구장비 출동',129,133],['v8-recover','사고복구반 탈선 복구 확인',133,139]]},
  {id:'v-point-23b',label:'탈선 복구 확인 중 23B 선로전환기 불량',at:[139,150],head:'※ 탈선 복구 완료 확인 중 23B 선로전환기 불량 수보',
   comms:[['v23b-key','23B 정위 키볼트 쇄정 지시 · 45km/h 서행',139,144],['v23b-hand','동묘앞역 상출발 수신호 현시 · G0602 발차 지시',144,150]]},
  {id:'v-derail-k604',label:'충돌 시 열차탈선 · K0604 탈선 (최초 수보 시)',at:[151,205],head:'충돌시 열차탈선',drop:['n1','n5','n6','n11','n24'],
   comms:[['v1','1 · K0604 운행중지 · 선로반대편 하차 / K0602 상황 확인',154,162],['v5','5 · 동묘앞역 초기대응 · 전차선 단전 여부',162,172],['v6','6 · 비상 전파 · 탈선복구장비 지원',172,177],['v11','11 · 대피 완료 확인 · 무선방호 해제',177,187],['v-recover21','탈선사고 복구 상황 확인 (#21-1)',187,196],['v24','24 · 구원연결 · 합병승인 · G0604 회송',196,205]]}],
 // 석수화재 (06 구원연결 · 06-1 역간정차)
 '06':FIRE('06'),'06-1':FIRE('06-1'),
 // 석수충돌 (03)
 '03':[
  {id:'v-adjacent',label:'인접선 지장 여부 확인 불가',at:[260,264],head:'인접선 지장 여부 확인 불가'},
  {id:'v-k450-cannot',label:'K0450 회송 불가 → K0456 운행선 변경 우선',at:[264,269],head:'K450 회송 불가'},
  {id:'v-g450-first',label:'G0450 발차 후 K0456 운행선 변경',at:[269,272],head:'G450 발차 후 K456 운행선 변경지시'},
  {id:'v-brake-pipe',label:'충돌 시 제동관 파손',at:[272,280],head:'충돌 시 제동관 파손',
   comms:[['v-brake-report','제동관 파손 수보 · 조치완료 통보 요청',272,275],['v-brake-check','사고복구반 제동기능 확인 후 구원 순차 시행',275,280]]},
  {id:'v-derail',label:'K0450 또는 K0452 탈선 (동묘 탈선 참고)',at:[280,287],head:'탈선'}],
 // 시청침수 (01)
 '01':[
  {id:'v-swap-lines',label:'침수선로 상하선 변경',at:[288,290],head:'침수선로 상하선 변경'},
  {id:'v-k1006-passed',label:'K1006 이미 통과 또는 설정 없음',at:[290,295],head:'K1006 이미 통과 또는 설정 없음',
   reactions:[{id:'r-k1006-gone',label:'K1006이 이미 지나감',when:{type:'not',condition:{type:'trainGone',number:'K1006'}},do:[{type:'deleteTrain',number:'K1006'}]}]},
  // 원문: 「K1008 지하서울 장내신호기외방 접근 중 … ※ 장내신호외방 정차 중 장내 해정시 접근쇄정 90초」
  // → K1008을 지하서울 2A 장내 외방(B067T, 접근구간)에 두고 2A-2T 진로를 세운다. 2A를 취소하면 접근쇄정 90초가 걸린다.
  {id:'v-k1008-approach',label:'K1008 지하서울 장내신호기 외방 접근 중',at:[297,302],head:'K1008 지하서울 장내신호기외방 접근 중',
   reactions:[{id:'r-k1008-approach',label:'K1008 지하서울 2A 장내 외방 접근 · 2A 진행',when:{type:'not',condition:{type:'trainGone',number:'K1008'}},do:[{type:'moveTrain',number:'K1008',station:'underground-seoul',slot:'B067T'},{type:'route',station:'underground-seoul',route:'2A-2T'}]}],
   objectives:[{id:'stop-underground-seoul-2A',label:'지하서울역 2A 신호 취소 (접근쇄정 90초)',condition:{type:'all',conditions:[{type:'reaction',id:'r-k1008-approach'},{type:'signalCancelled',station:'underground-seoul',signal:'2A'}]},points:2}]},
  // 원문: 「K1008 원거리 접근 · 지하서울 3A, 2A 정지 · K1008 접근 확인 가능시 지하서울 정거장 밖 정차 지시」
  // → K1008을 접근구간 밖(서울역 B069T)에 두고 2A-2T 진로를 세운다. 접근구간 밖이라 취소해도 접근쇄정이 걸리지 않는다.
  {id:'v-k1008-far',label:'K1008 원거리 접근',at:[302,305],head:'K1008 원거리 접근',
   reactions:[{id:'r-k1008-far',label:'K1008 원거리 접근 · 지하서울 2A 진행',when:{type:'not',condition:{type:'trainGone',number:'K1008'}},do:[{type:'moveTrain',number:'K1008',station:'seoul',slot:'B069T'},{type:'route',station:'underground-seoul',route:'2A-2T'}]}],
   objectives:[{id:'stop-underground-seoul-2A-far',label:'지하서울역 2A 신호 정지 (원거리 · 접근쇄정 없음)',condition:{type:'all',conditions:[{type:'reaction',id:'r-k1008-far'},{type:'signalCancelled',station:'underground-seoul',signal:'2A'}]},points:2}]},
  {id:'v-track-circuit',label:'궤도회로 낙하',at:[305,308],head:'궤도회로낙하'}]
};
// 관제사가 선제적으로 할 수 있는 요청 (원문 끝 ※): 점수 없는 선택 통보로 기록만 한다
const PROACTIVE={'03':[309,311],'02':[311,313],'06':[313,315],'06-1':[313,315],'05':[315,317]};
const marker=l=>/^\s*-?\d+(-[\dA-Z]+)?\s*$/.test(l);
// 원문 HWP의 글머리 기호는 사용자 정의 문자(U+F0A7 등)로 들어 있어 '▪'로 바꾼다
const clean=t=>String(t).replace(/[\uE000-\uF8FF]/g,'▪');
const text=(a,b)=>L().slice(a,b).filter(l=>!marker(l)&&clean(l).replace(/[▪\s]/g,'')).map(l=>clean(l).replace(/\s+$/,'')).join('\n').trim();
function branchesFor(key){
 return (BRANCHES[key]||[]).map(b=>{
  const norm=t=>String(t).replace(/[\uE000-\uF8FF]/g,"").replace(/\s+/g," ").trim();if(norm(L()[b.at[0]])!==norm(b.head))throw new Error(`상황별 대응 요령 원문 줄이 바뀌었습니다: ${key} ${b.id} (${L()[b.at[0]]})`);
  const comms=(b.comms||[[b.id+'-c',b.label+' 대응',b.at[0],b.at[1]]]).map(([id,label,a,z])=>({id,label,text:text(a,z),points:1}));
  return {id:b.id,label:b.label,text:text(...b.at),source:D.variants.source,lines:[...b.at],...(b.drop?{drop:[...b.drop]}:{}),communications:comms,...(b.objectives?{objectives:structuredClone(b.objectives)}:{}),...(b.reactions?{reactions:structuredClone(b.reactions)}:{})};
 });
}
function proactiveFor(key){const r=PROACTIVE[key];if(!r)return [];return [{id:'proactive',label:'선제적 운행선 변경(단선지령식) 요청 — 관제사 판단 (점수 없음)',text:'※ 관제사가 선제적으로 운행선변경(단선지령식) 요청 가능\n'+text(...r),points:0,optional:true}];}
const api={BRANCHES,branchesFor,proactiveFor,keys:Object.keys(BRANCHES)};
if(node)module.exports=api;else root.SimEmergencyBranches=api;
})(typeof globalThis!=='undefined'?globalThis:this);

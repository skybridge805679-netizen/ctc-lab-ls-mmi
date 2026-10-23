(function(root){
'use strict';
// Locking rules taken from the course text (실무5 구술 8·9번, 대피 대본). Anything not listed here is not modelled.
const approach={
 seconds:{'장내':90,'출발':30},
 source:'실무5 구술 8번 · KR S-06030: 열차가 신호기 외방 일정구간에 진입한 뒤 신호를 정지시키면 장내 90초, 출발 30초 진로 쇄정'
};
const overlap={
 geumcheon:{
  '2B-6T':{points:{'26':'N'},note:'전방 26 선로전환기 정위 쇄정(오버랩)',source:'실무5 금천구청 상선 6번 대피 대본 해설(2B-6T 장내 진행, 전방 26B 정위)'},
  '1B-1T':{points:{'54':'R'},note:'1번선 끝 54 선로전환기 반위 쇄정(오버랩)',source:'실무5 금천구청 하선 1번 대피 대본 해설(1B-1T 장내 진행, 54번 반위)'}
 },
 yeongdeungpo:{
  '1A-1T':{points:{},clearSignals:['4B'],note:'4B 출발신호기 해정 후 진행(오버랩 때문)',source:'실무5 영등포 1번 대피 대본 해설(1A 해정 후 4B 오버랩 해정)'}
 }
};
// Simultaneous routes confirmed by the user's observation of the real LS.
// This only permits shared switches in the same known position; shared track is still forbidden.
const parallel={anyang:[{routes:['4C-B660T','4A-B984T'],source:'사용자 실물 LS 확인 · 2026-10-23 · 4C-B660T 설정 중 4A-B984T 동시 설정 가능'}]};
const parallelFor=(station,a,b)=>parallel[station]?.find(rule=>rule.routes.includes(a)&&rule.routes.includes(b)&&a!==b)||null;
const api={approach,overlap,parallel,parallelFor,rulesFor:(station,route)=>overlap[station]?.[route]||null};
if(typeof module!=='undefined')module.exports=api;else root.SimInterlocking=api;
})(typeof window!=='undefined'?window:globalThis);

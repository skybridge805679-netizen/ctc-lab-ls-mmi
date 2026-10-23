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
// Route pairs that share a point (both with it in the same position) but are set together on the real LS (사진/사용자 확인).
// 다른 진로쌍은 같은 전환기를 쓰면 경합으로 본다 (예: 지하서울 서쪽 건넘선).
const compatible={
 anyang:[['4A-B984T','4C-B660T']]    // 안양역: 4C-B660T가 나 있을 때 4A-B984T 설정 가능 (2026-10-23 LS 사진)
};
const isCompatible=(station,a,b)=>(compatible[station]||[]).some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
const api={approach,overlap,compatible,isCompatible,rulesFor:(station,route)=>overlap[station]?.[route]||null};
if(typeof module!=='undefined')module.exports=api;else root.SimInterlocking=api;
})(typeof window!=='undefined'?window:globalThis);

(function(root){
'use strict';
// 운전정리 대장 (교통관제운영 1권 3.1 운전정리 관련 사항, p.50-52): 스케줄에 한 변경을 운전명령 / 관제승인 / 단순 운전정리로 나눠 기록한다.
// 운전명령: 운행변경·종별변경·단선운전·합병운전·운행휴지·임시열차운행·차량교환·반대선 운전·특별지시. 관제승인: 순서변경·운전시각변경·반복변경·밀기·후진·임시서행·운행속도변경.
// 단순 운전정리(출발·도착선 변경, 임시대피, 간격조정 등)는 별도 명령·승인을 하지 않는다. 승인번호는 종류별 순번("관제승인 N호")이다.
const ORDER='운전명령',APPROVAL='관제승인',SIMPLE='단순 운전정리';
// one timetable change -> list of {cls, kind, text}; an edit can touch several things at once
function classify(c){
 const out=[],add=(cls,kind,text)=>out.push({cls,kind,text});
 switch(c.type){
  case 'create':add(ORDER,'임시열차운행',`${c.id} 임시 스케줄 생성`);break;
  case 'copy':add(ORDER,'임시열차운행',`${c.id} 스케줄 복사 생성 (원본 ${c.sourceId})`);break;
  case 'delete':add(ORDER,'운행휴지',`${c.id} 스케줄 삭제`);break;
  case 'cancel':add(ORDER,'운행휴지',`${c.id} ${c.cancelled?'전 구간 운휴':'운휴 해제'}`);break;
  case 'partial-cancel':add(ORDER,'운행휴지',`${c.id} 구간운휴 ${c.cancelled?'설정':'해제'}`);break;
  case 'delay':add(APPROVAL,'운전시각변경',`${c.id} ${c.minutes?c.minutes+'분':(c.seconds||0)+'초'} 지연${c.auto?' (자동제어 반영)':''}`);break;
  case 'cdrs':if(c.route)add(SIMPLE,'출발·도착선 변경',`${c.id} 도착진로 ${c.route} (CDRS)`);else add(APPROVAL,'운전시각변경',`${c.id} ${c.minutes}분 지연 (CDRS 해소안)`);break;
  case 'update':{
   const f=c.flags||[];
   if(f.includes('kind'))add(ORDER,'종별변경',`${c.id} 열차종별 변경`);
   if(f.includes('cancel'))add(ORDER,'운행휴지',`${c.id} 구간운휴 변경`);
   if(f.includes('related'))add(APPROVAL,'반복변경',`${c.id} 연계(반복) 열차 변경`);
   if(f.includes('time'))add(APPROVAL,'운전시각변경',`${c.id} 운전시각 변경`);
   if(f.includes('route'))add(SIMPLE,'출발·도착선 변경',`${c.id} 도착·출발진로(선) 변경`);
   if(!out.length)add(SIMPLE,'속성 변경',`${c.id} 스케줄 편집`);
   break;}
  default:return out;
 }
 return out;
}
// ledger rows from a changes array; numbers are per class, in order
function entries(changes){
 const count={[ORDER]:0,[APPROVAL]:0,[SIMPLE]:0},rows=[];
 changes.forEach((c,index)=>{for(const e of classify(c)){const number=e.cls===SIMPLE?null:++count[e.cls];rows.push({index,...e,number,label:number?`${e.cls} ${number}호`:e.cls,at:c.at??null});}});
 return rows;
}
const api={ORDER,APPROVAL,SIMPLE,classify,entries};
if(typeof module!=='undefined')module.exports=api;else root.SimLedger=api;
})(typeof window!=='undefined'?window:globalThis);

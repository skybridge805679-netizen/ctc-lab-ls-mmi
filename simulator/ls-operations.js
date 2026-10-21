/* Manual LS train-number windows and information boards. These do not simulate track occupancy. */
(function(root){
'use strict';
const boardTypes=['선로일시사용정지','폐색방식변경','열간작업','전차선단전','사용자입력','서행표시'];
function create(catalog){
 const allowed=Object.fromEntries(Object.entries(catalog).map(([s,ids])=>[s,new Set(ids)]));
 const initial=()=>({serial:0,stations:Object.fromEntries(Object.keys(allowed).map(s=>[s,{windows:{},boards:[]}]))});
 const entries=(model,station,slot)=>model.stations[station]?.windows[slot]||[];
 function dispatch(model,a){
  const fail=message=>({ok:false,message}),ok=message=>({ok:true,message});
  const st=model.stations[a.station];if(!st)return fail('취급역을 확인하세요.');
  const validSlot=(s,k)=>!!allowed[s]?.has(k),list=entries(model,a.station,a.slot);
  const index=list.findIndex(t=>t.uid===a.uid),entry=list[index];
  if(['insert','rename','delete','move','swap'].includes(a.op)){
   if(!validSlot(a.station,a.slot))return fail('등록된 열번창을 선택하세요.');
   if(a.op!=='insert'&&!entry)return fail('열차번호가 변경되었습니다. 다시 선택하세요.');
   if(a.op==='insert'||a.op==='rename'){
    const number=String(a.number||'').trim().toUpperCase();
    if(!/^[A-Z]{0,2}\d{1,6}$/.test(number))return fail('열차번호는 영문 0~2자와 숫자 1~6자로 입력하세요.');
    if(a.direction&&!['up','down'].includes(a.direction))return fail('상하행을 확인하세요.');
    const duplicate=Object.values(model.stations).some(s=>Object.values(s.windows).some(ts=>ts.some(t=>t.uid!==a.uid&&t.number===number)));
    if(a.op==='insert')(st.windows[a.slot]??=[]).push({uid:'T'+(++model.serial),number,direction:a.direction||'up'});
    else Object.assign(entry,{number,direction:a.direction||entry.direction});
    return ok(number+' 열차번호 '+(a.op==='insert'?'추가':'수정')+(duplicate?' · 열차번호 중복 표시 확인':''));
   }
   if(a.op==='delete'){list.splice(index,1);return ok(entry.number+' 열차번호 삭제');}
   if(!validSlot(a.targetStation,a.targetSlot))return fail('이동·교환할 열번창을 확인하세요.');
   const target=entries(model,a.targetStation,a.targetSlot);
   if(a.station===a.targetStation&&a.slot===a.targetSlot)return fail('다른 열번창을 선택하세요.');
   if(a.op==='move'){
    list.splice(index,1);(model.stations[a.targetStation].windows[a.targetSlot]??=[]).push(entry);
    return ok(entry.number+' → '+a.targetSlot+' 열차번호 이동');
   }
   const other=target.findIndex(t=>t.uid===a.targetUid);if(other<0)return fail('교환할 열차번호를 선택하세요.');
   const swapped=target[other];target[other]=entry;list[index]=swapped;return ok(entry.number+' ↔ '+swapped.number+' 열차번호 교환');
  }
  const board=st.boards.find(b=>b.id===a.id);
  if(a.op==='boardAdd'||a.op==='boardEdit'){
   if(!boardTypes.includes(a.kind))return fail('표지판 종류를 확인하세요.');
   const text=String(a.text||'').trim();if(!text||text.length>80)return fail('표지판 내용을 1~80자로 입력하세요.');
   if(a.kind==='서행표시'&&(!Number.isInteger(Number(text))||Number(text)<1||Number(text)>200))return fail('서행속도는 1~200 km/h로 입력하세요.');
   if(a.op==='boardEdit'&&!board)return fail('표지판이 없습니다.');
   if(a.op==='boardAdd'){
    if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.y<0)return fail('표지판 위치를 확인하세요.');
    st.boards.push({id:'B'+(++model.serial),kind:a.kind,text,x:a.x,y:a.y,fixed:false});
   }else Object.assign(board,{kind:a.kind,text});
   return ok(a.kind+' 표지판 '+(board?'수정':'추가'));
  }
  if(!board)return fail('표지판이 없습니다.');
  if(a.op==='boardFix'){board.fixed=!!a.fixed;return ok('표지판 '+(board.fixed?'고정':'고정 해제'));}
  if(a.op==='boardMove'){
   if(board.fixed)return fail('고정된 표지판입니다. 고정을 해제하세요.');
   if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.y<0)return fail('표지판 위치를 확인하세요.');
   Object.assign(board,{x:a.x,y:a.y});return ok('표지판 위치 이동');
  }
  if(a.op==='boardDelete'){st.boards.splice(st.boards.indexOf(board),1);return ok('표지판 삭제');}
  return fail('지원하지 않는 표시 명령입니다.');
 }
 return {initial,dispatch,entries};
}
const api={create,boardTypes};if(typeof module!=='undefined')module.exports=api;else root.SimLSOperations=api;
})(typeof window!=='undefined'?window:globalThis);

(function(root){
'use strict';
// 연습 힌트 「본선 색」: LS 칸 테두리를 본선마다 다른 색으로 (상1선·상2선·하1선·하2선 — 지하 구간도 하2선·상2선).
// 「XX역 nT가 몇 선이었지?」 할 때 켠다. 실습 동작은 바꾸지 않고 보이는 색만. FTS 교육(시험)이 진행 중이면 꺼지고 누를 수 없다.
// 켠 상태는 이 컴퓨터에 기억되고, 열린 LS 창(LS +)들이 함께 따른다.
const KEY='orpheia-ls-mainline-hint';
const doc=root.document;if(!doc?.querySelector('.ls-topbar'))return;
const read=()=>{try{return root.localStorage.getItem(KEY)==='1';}catch{return false;}};
const write=v=>{try{root.localStorage.setItem(KEY,v?'1':'0');}catch{}};
const exam=()=>{const s=root.SimRemote?.snapshot?.fts?.session;return !!(s&&!s.finished);};
let btn=null,legend=null;
function apply(){
 const locked=exam(),on=read()&&!locked;
 doc.body.classList.toggle('ls-mainline-hint',on);
 if(btn){btn.setAttribute('aria-pressed',String(on));btn.disabled=locked;btn.title=locked?'FTS 교육(시험) 중에는 힌트를 쓸 수 없습니다':'연습 힌트: 본선마다 다른 색으로 표시 (상1선·상2선·하1선·하2선)';}
 if(legend)legend.hidden=!on;
}
function mount(){
 const bar=doc.querySelector('.ls-topbar .top-actions');if(!bar||doc.getElementById('lsHintBtn'))return;
 btn=doc.createElement('button');btn.id='lsHintBtn';btn.type='button';btn.className='subtle ls-hint-btn';btn.innerHTML='<span aria-hidden="true">◐</span> 본선 색';
 btn.onclick=()=>{write(!read());apply();};bar.prepend(btn);
 legend=doc.createElement('div');legend.id='lsHintLegend';legend.className='ls-hint-legend';legend.hidden=true;legend.setAttribute('aria-label','본선 색 범례');
 legend.innerHTML=[['GU','상1선'],['EU','상2선'],['GD','하1선'],['ED','하2선']].map(([k,n])=>`<span><i data-mainline="${k}"></i>${n}</span>`).join('')+'<small>연습 힌트</small>';
 (doc.getElementById('lsDisplay')||doc.body).appendChild(legend);
 apply();
}
root.addEventListener?.('storage',e=>{if(e.key===KEY)apply();});
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
setInterval(apply,1000);      // 교육(시험)이 시작되면 꺼진다
root.SimLSHint={apply,on:()=>doc.body.classList.contains('ls-mainline-hint')};
})(typeof window!=='undefined'?window:globalThis);

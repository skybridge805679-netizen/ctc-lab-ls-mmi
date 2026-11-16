'use strict';
// 정적 점검: 모든 내장 FTS 문제의 처음 배치에서, 미리 세워 둔 진로를 취소하면 접근쇄정이 걸리는 곳과 그 원인 열차·열번창.
// (대본 원문에 그 역 접근쇄정 안내가 있는지도 같이 표시 — 안내가 없으면 배치를 의심할 곳)  node simulator/tools/audit-approach.cjs
const R=require('../engine/runtime.cjs'),F=require('../engine/fts.js'),D=require('../engine/emergency-data.js'),N=require('../engine/network.js'),IL=require('../engine/interlocking.js'),L=require('../engine/line.js');
const lib=F.seed(),out=[];
const rawText=key=>JSON.stringify(D.scenarios[key]||{});
for(const p of lib.problems.filter(p=>p.builtin&&p.setup?.routes?.length)){
 const r=R.create(),l=r.snapshot().ftsLibrary;l.situations.push({id:'S-A',name:'a',problems:[p.id]});l.scenarios.push({id:'SC-A',name:'a',situations:['S-A']});
 r.command({type:'fts',op:'library',library:l});const s=r.command({type:'fts',op:'start',scenario:'SC-A',professor:'001',student:'tester',autoRun:false});if(!s.ok){out.push({p:p.id,error:s.message});continue;}
 r.command({type:'clock',paused:true});
 const key=(/^P-em-([\d-]+?)(?:-[a-z].*)?$/.exec(p.id)||[])[1];
 for(const {station,route} of p.setup.routes){
  const st=r.snapshot().states[station],C=require('../engine/core.js').forStation(station),sig=C.routes[route]?.signal;if(!sig)continue;
  const w=IL.approachTrain(station,sig,st);if(!w)continue;
  const name=N.catalog[station].name,txt=key?rawText(key):'',mention=new RegExp(name+'[^"]{0,40}'+sig+'[^"]{0,60}접근쇄정|'+sig+'[^"]{0,40}접근쇄정').test(txt);
  out.push({p:p.id,station:name,route,signal:sig,window:w.code,circuit:L.circuitOf(station,w.code),train:w.train,mentioned:mention});
 }
}
const seen=new Set();
for(const x of out){if(x.error){console.log(x.p,'오류',x.error);continue;}const k=[x.station,x.route,x.window,x.train].join('|');const dup=seen.has(k);seen.add(k);
 console.log(`${x.mentioned?'  (원문 안내 있음)':'★ 원문 안내 없음'} ${x.p} · ${x.station} ${x.route} 취소 시 접근쇄정 ← ${x.train} @ ${x.window}${x.circuit!==x.window?' (회로 '+x.circuit+')':''}${dup?' · 같은 배치 반복':''}`);}

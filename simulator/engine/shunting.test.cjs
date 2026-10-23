// 입환진로 제어 (교통관제운영 4권 p.384): 입환신호기도 주진로와 같은 방식으로 진로를 설정·해정한다.
const assert=require('assert'),Core=require('./core.js'),N=require('./network.js');
let n=0;
for(const st of N.stations.filter(s=>s.controlled)){
 const c=Core.forStation(st.id);
 for(const id of Object.keys(c.routes).filter(id=>c.signals[c.routes[id].signal].kind==='입환')){
  const s=c.initial();assert.ok(c.dispatch(s,{type:'mode',value:'CCM',source:'x'}).ok);
  const r=c.dispatch(s,{type:'route',id,source:'x'});assert.ok(r.ok,st.id+' '+id+' '+r.message);
  assert.strictEqual(s.signals[c.routes[id].signal],'GO');
  const stop=c.dispatch(s,{type:'stop',id:c.routes[id].signal,source:'x'});assert.ok(stop.ok,id);
  assert.ok(!s.routes[id]||s.routes[id].lock,'released or in approach lock');n++;
 }
}
assert.ok(n>=100,'shunting routes tested '+n);
// 비상 CTC (4권 p.383): LOCAL -> CCM 은 현장 응답 없이 즉시 전환, 일반 요청은 현장 응답을 기다린다
{const c=Core.forStation('seoul'),s=c.initial();c.dispatch(s,{type:'mode',value:'LOCAL',source:'x'});c.dispatch(s,{type:'handover',accept:true,source:'x'});assert.strictEqual(s.mode,'LOCAL');
 c.dispatch(s,{type:'mode',value:'CCM',source:'x'});assert.strictEqual(s.mode,'LOCAL');assert.strictEqual(s.pending,'CCM');c.dispatch(s,{type:'handover',accept:false,source:'x'});
 const r=c.dispatch(s,{type:'mode',value:'CCM',emergency:true,source:'x'});assert.ok(r.ok&&s.mode==='CCM'&&!s.pending,r.message);
 const t=c.initial();assert.ok(!c.dispatch(t,{type:'mode',value:'CCM',emergency:true,source:'x'}).message.includes('비상'),'emergency only from LOCAL');}
console.log('shunting routes: ok',n);

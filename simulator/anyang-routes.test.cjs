// 안양역 4B: RT_4B_B984T, RT_4B_B660T (LS에서 확인된 진로)
const assert=require('assert'),Core=require('./core.js'),N=require('./network.js'),R=require('./schedule-routes.js');
const c=Core.forStation('anyang'),r=c.routes['4B-B660T'];
assert.ok(c.routes['4B-B984T']&&r,'both 4B routes exist');
assert.strictEqual(r.signal,'4B');assert.strictEqual(r.destination,'B660T');assert.strictEqual(r.pointPositions['53'],'R');
assert.ok(/^M[\d. ]+(L[\d. ]+)+$/.test(r.path)&&r.resources.length>4);
// settable from CCM; it excludes the other 4B route and 4C's routes that share its track
const s=c.initial();c.dispatch(s,{type:'mode',value:'CCM',source:'x'});
const set=c.dispatch(s,{type:'route',id:'4B-B660T',source:'x'});assert.ok(set.ok,set.message);assert.strictEqual(s.signals['4B'],'GO');assert.strictEqual(s.points['53'],'R');
for(const other of ['4B-B984T','4C-B660T','4C-B984T'])assert.ok(!c.dispatch(s,{type:'route',id:other,source:'x'}).ok,other+' conflicts');
assert.ok(c.dispatch(s,{type:'stop',id:'4B',source:'x'}).ok);
assert.ok(c.dispatch(s,{type:'route',id:'4B-B984T',source:'x'}).ok,'the other 4B route is still settable after the stop');
// 4A (사진: RT_4A_B984T, RT_4A_B660T): both exist, the long one crosses 1T→2T→3T and excludes the 4B routes
const a=c.routes['4A-B660T'];assert.ok(a&&c.routes['4A-B984T']);assert.deepStrictEqual([a.pointPositions['55'],a.pointPositions['53']],['R','R']);
{const t=c.initial();c.dispatch(t,{type:'mode',value:'CCM',source:'x'});assert.ok(c.dispatch(t,{type:'route',id:'4A-B660T',source:'x'}).ok);
 for(const other of ['4A-B984T','4B-B660T','4B-B984T','4C-B660T'])assert.ok(!c.dispatch(t,{type:'route',id:other,source:'x'}).ok,other+' conflicts with 4A-B660T');}
assert.deepStrictEqual(Object.keys(c.routes).filter(id=>c.routes[id].signal==='4A').sort(),['4A-B660T','4A-B984T']);
// the LS popup of 4B lists both routes; the schedule table accepts it as a departure route
const menu=Object.keys(c.routes).filter(id=>c.routes[id].signal==='4B').sort();assert.deepStrictEqual(menu,['4B-B660T','4B-B984T']);
assert.ok(R.options('anyang','departure').includes('4B_B660T'));
// 사진: 4C-B660T가 나 있을 때 4A-B984T도 LS에서 설정 가능 (같은 53번 전환기를 같은 위치로 사용). 다른 쌍은 그대로 경합.
{const t=c.initial();c.dispatch(t,{type:'mode',value:'CCM',source:'x'});
 assert.ok(c.dispatch(t,{type:'route',id:'4C-B660T',source:'x'}).ok);const both=c.dispatch(t,{type:'route',id:'4A-B984T',source:'x'});assert.ok(both.ok,both.message);
 assert.ok(t.routes['4C-B660T']&&t.routes['4A-B984T']);
 assert.ok(!c.dispatch(t,{type:'route',id:'4B-B984T',source:'x'}).ok,'same 2T track as 4A-B984T');
 {const w=c.initial();c.dispatch(w,{type:'mode',value:'CCM',source:'x'});assert.ok(c.dispatch(w,{type:'route',id:'4B-B984T',source:'x'}).ok);assert.ok(!c.dispatch(w,{type:'route',id:'4C-B660T',source:'x'}).ok,'not whitelisted: still a conflict');}
 // opposite position of the same point still conflicts: 4A-B660T needs 53 reversed, 4C-B660T has it normal
 const u=c.initial();c.dispatch(u,{type:'mode',value:'CCM',source:'x'});assert.ok(c.dispatch(u,{type:'route',id:'4C-B660T',source:'x'}).ok);assert.ok(!c.dispatch(u,{type:'route',id:'4A-B660T',source:'x'}).ok);}
console.log('anyang routes: ok');

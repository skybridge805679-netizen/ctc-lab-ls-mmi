// 선로망: 본선(trunk)·구간(section)이 노선 전체를 잇는다
const assert=require('assert'),L=require('./line.js'),N=require('./network.js'),W=require('./train-windows.js');
const {line,NAMES}=L,order=line.order;
// every controlled station carries at least two trunks, and every pair of neighbouring controlled stations is joined on at least two
for(const id of order)assert.ok(Object.keys(line.stations[id].trunks).length>=2,id+' has trunks');
for(let i=1;i<order.length;i++){
 const joined=line.sections.filter(s=>s.west===order[i-1]&&s.east===order[i]);
 assert.ok(joined.length>=2,`${order[i-1]} - ${order[i]} joined on ${joined.length} trunks`);
}
// the 4-track corridor 금천구청 ~ 의왕 is joined on all four trunks at every step
for(const [a,b] of [['geumcheon','anyang'],['gunpo','uiwang']])assert.strictEqual(line.sections.filter(s=>s.west===a&&s.east===b).length,4,a+'-'+b);
// 안양 ~ 군포 skips 금정 (it only has the 전동 trunks): the other two trunks jump over it
assert.ok(line.sections.some(s=>s.trunk==='GD'&&s.west==='anyang'&&s.east==='gunpo'&&s.skipped.includes('geumjeong')));
// circuit numbers grow towards 수원 along every trunk, and neighbouring edges are close (the shared B647T case is allowed)
for(const s of line.sections){
 const a=L.numberOf(s.westSide),b=L.numberOf(s.eastSide);
 assert.ok(a!==null&&b!==null,s.id+' has named edges');
 if(s.trunk[0]==='M'&&s.east==='seoul')assert.ok(b-a<=4,s.id);
 else if(!(s.trunk[0]==='E'&&s.west==='seoul'))assert.ok(b>=a&&b-a<=30,`${s.id} ${s.westSide}->${s.eastSide}`);
 assert.strictEqual(L.trunkOf(s.westSide),s.trunk);assert.strictEqual(L.trunkOf(s.eastSide),s.trunk,s.id);
}
// 서울역: the 지하철 trunks turn into the 전동 trunks
assert.deepStrictEqual(line.stations.seoul.transitions.map(t=>t.from+'>'+t.to).sort(),['MD>ED','MU>EU']);
// hand-off: leaving 금천구청 on the 하2선 (3B-.. departure ends at B968T) the train enters 안양 at its 하2선 window; going up from 안양 on 상1선 (B655T) it reaches 금천구청
const slots=id=>(W.data||W)[id].map(x=>x.slot);
const h1=L.handoff('geumcheon','B968T',slots);assert.deepStrictEqual([h1.station,h1.trunk,h1.direction],['anyang','ED','down']);assert.ok(/^B9\d\dT$/.test(h1.slot)&&slots('anyang').includes(h1.slot),h1.slot);
const h2=L.handoff('anyang','B655T',slots);assert.deepStrictEqual([h2.station,h2.trunk,h2.direction],['geumcheon','GU','up']);assert.ok(slots('geumcheon').includes(h2.slot),h2.slot);
assert.strictEqual(L.handoff('suwon','B1035T',slots).station,'uiwang');assert.strictEqual(L.handoff('seoul','B902T',slots).station,'yongsan');assert.strictEqual(L.handoff('underground-seoul','B072T',slots).station,'seoul');
assert.strictEqual(L.handoff('cheongnyangni','B001T',slots),null,'청량리 up: nothing further');
// 장내신호기: every trunk with an arrival signal on it (the 3 stations missing one are terminals/yards) and the known 금천구청 / 안양 layout
assert.deepStrictEqual(['ED','GD','GU','EU'].map(t=>L.arrivalSignal('geumcheon',t)),['1A','1B','2B','2A']);
assert.deepStrictEqual(['ED','GD','GU','EU'].map(t=>L.arrivalSignal('anyang',t)),['1A','1B','2B','2A']);
assert.strictEqual(L.handoff('geumcheon','B968T',slots).signal,'1A');assert.strictEqual(L.handoff('anyang','B655T',slots).signal,'2B');
console.log('line: ok',line.sections.length,'sections');

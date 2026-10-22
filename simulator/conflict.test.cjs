const assert=require('assert');
const T=require('./timetable.js'),N=require('./network.js');
const model=T.initial();
// the default timetable has no conflicts
assert.deepStrictEqual(T.conflicts(model),[]);
// a copy one minute behind: every station breaks the 120 s headway, arrival and departure
assert.ok(T.copy(model,'K1131','B0000',model.trains[0].calls[0].departure+60,{}).ok);
let c=T.conflicts(model);
assert.ok(c.length>=33*2&&c.every(x=>x.trains.join()==='K1131,B0000'),c.length);
assert.ok(c.some(x=>x.type==='도착 운전시격 경합')&&c.some(x=>x.type==='출발 운전시격 경합'));
// 4 minutes behind is fine; opposite direction and cancelled trains are ignored
const m2=T.initial();T.copy(m2,'K1131','B0001',m2.trains[0].calls[0].departure+240,{});assert.deepStrictEqual(T.conflicts(m2),[]);
const m3=T.initial();T.copy(m3,'K1131','B0002',m3.trains[0].calls[0].departure+60,{});T.cancel(m3,'B0002');assert.deepStrictEqual(T.conflicts(m3),[]);
// same arrival track while the leader is still at the platform
const m4=T.initial();const L=m4.trains[0];T.copy(m4,'K1131','B0003',L.calls[0].departure+240,{});
const F=m4.trains.find(t=>t.id==='B0003');const iy=F.calls.findIndex(x=>x.station==='yongsan');
L.calls[iy].arrivalRoute='1A_1T';L.calls[iy].departure=L.calls[iy].arrival+300;F.calls[iy].arrivalRoute='1A_1T';
c=T.conflicts(m4);assert.ok(c.some(x=>x.type==='플랫폼 할당 경합'&&x.station==='yongsan'),JSON.stringify(c));
// overtaking
const m5=T.initial();T.copy(m5,'K1131','B0004',m5.trains[0].calls[0].departure+240,{});
const G=m5.trains.find(t=>t.id==='B0004');const k=G.calls.findIndex(x=>x.station==='guro');
for(let i=k;i<G.calls.length;i++){G.calls[i].arrival-=300;G.calls[i].departure-=300;}
c=T.conflicts(m5);assert.ok(c.some(x=>x.type==='추월경합'),JSON.stringify(c.slice(0,3)));
// nearest upstream 해소역
assert.strictEqual(T.nearestResolveStation('guro','down'),'yeongdeungpo');
assert.strictEqual(T.nearestResolveStation('yongsan','down'),'yongsan');
assert.strictEqual(T.nearestResolveStation('cheongnyangni','down'),null);
assert.strictEqual(T.nearestResolveStation('guro','up'),'geumcheon');
console.log('conflict detection: ok');

const assert=require('node:assert/strict');
const T=require('./timetable.js'),R=require('./schedule-routes.js'),Core=require('./core.js'),N=require('./network.js');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
const id=r=>r.replace('_','-');
test('sample trains carry the routes read from the real MMI photos',()=>{
 const model=T.initial(),down=model.trains.find(t=>t.id==='K1131'),at=s=>down.calls.find(c=>c.station===s);
 assert.equal(at('dongmyo').arrivalRoute,'1B_1T');assert.equal(at('dongmyo').departureRoute,'4A_B016T');
 assert.equal(at('yeongdeungpo').arrivalRoute,'1B_6T');assert.equal(at('yeongdeungpo').departureRoute,'4E_B942T');
 assert.equal(at('geumcheon').arrivalRoute,'1A_2T');assert.equal(at('geumcheon').departureRoute,'4B_B968T');
 const up=model.trains.find(t=>t.id==='K1002'),u=s=>up.calls.find(c=>c.station===s);
 assert.equal(u('uiwang').arrivalRoute,'2B_6T');assert.equal(u('uiwang').departureRoute,'3B_B1011T');assert.equal(u('suwon').departureRoute,'3C_B1035T');
});
test('first call is 시발 without an arrival route, last is 종착 without a departure route, jurisdiction stops have no routes',()=>{
 const c=T.initial().trains[0].calls;
 assert.equal(c[0].stopType,'시발');assert.equal(c[0].arrivalRoute,'');assert.equal(c.at(-1).stopType,'종착');assert.equal(c.at(-1).departureRoute,'');
 for(const x of c)if(!N.catalog[x.station].controlled){assert.equal(x.arrivalRoute,'');assert.equal(x.departureRoute,'');}
});
test('every default route exists in the station\'s derived routes (photo values and estimates)',()=>{
 for(const train of T.initial().trains)for(const c of train.calls)for(const r of [c.arrivalRoute,c.departureRoute])if(r){assert(Core.forStation(c.station).routes[id(r)],`${c.station} ${r}`);}
 for(const station of N.stations.filter(s=>s.controlled))for(const dir of ['down','up']){const v=R.estimate(station.id,dir);for(const r of [v.arr,v.dep])if(r)assert(Core.forStation(station.id).routes[id(r)],station.id+' '+r);}
});
test('route text is validated and a created pattern fills the routes',()=>{
 const model=T.initial(),d=T.pattern({id:'K2001',from:'cheongnyangni',to:'suwon',start:3600});
 assert.equal(d.calls.find(c=>c.station==='guro').arrivalRoute,'1B_3T');
 d.calls[3].departureRoute='4A-B016T';assert.equal(T.create(model,d).ok,false,'hyphen is not the MMI notation');
 d.calls[3].departureRoute='4A_B016T';assert(T.create(model,d).ok);
});
test('partial cancellation: validated range, flags, position and whole-train sync',()=>{
 const model=T.initial(),train=model.trains[0];
 assert.equal(T.setCancelled(model,train.id,'guro','dongmyo',true).ok,false);
 assert(T.setCancelled(model,train.id,'dongmyo','jonggak',true).ok);
 const flagged=train.calls.filter(c=>c.cancelled).map(c=>c.station);assert.deepEqual(flagged,['dongmyo','dongdaemun','jongno5','jongno3','jonggak']);
 const mid=(train.calls.find(c=>c.station==='dongdaemun').arrival+train.calls.find(c=>c.station==='dongdaemun').departure)/2;
 assert.equal(T.position(train,mid),null,'no position inside the cancelled range');
 assert(T.position(train,train.calls[0].arrival+5));
 assert(T.setCancelled(model,train.id,'dongmyo','jonggak',false).ok);assert(train.calls.every(c=>!c.cancelled));
 assert(T.cancel(model,train.id).ok);assert(train.calls.every(c=>c.cancelled));assert(T.cancel(model,train.id).ok);assert(train.calls.every(c=>!c.cancelled));
});
console.log(n+' schedule-route tests passed');
{
 const model=T.initial(),source=model.trains[0],snapshot=JSON.stringify(source);T.cancel(model,source.id);
 const before=JSON.stringify(model);assert.equal(T.copy(model,source.id,'C3001',4000,{from:'guro',to:'dongmyo'}).ok,false);assert.equal(JSON.stringify(model),before);
 assert(T.copy(model,source.id,'C3001',4000,{from:'dongmyo',to:'guro',kind:'KTX',service:'부정기',flags:['회송']}).ok);
 const t=model.trains.at(-1);assert.equal(t.calls[0].station,'dongmyo');assert.equal(t.calls.at(-1).station,'guro');assert.equal(t.calls[0].departure,4000);assert(t.calls.every(c=>!c.cancelled));assert.equal(t.calls[0].stopType,'시발');assert.equal(t.calls.at(-1).departureRoute,'');assert.equal(t.service,'부정기');assert.deepEqual(t.flags,['회송']);assert(source.cancelled);
 console.log('PASS range copy is atomic, clears source cancellation and applies service/flags');
}

const test=require('node:test'),assert=require('node:assert');
const P=require('./patterns.js'),T=require('./timetable.js');
test('photographed patterns pass the 저장 checks (stations, times, routes that exist)',()=>{
 const list=P.seed();
 for(const p of list)assert.equal(P.validate(p),null,p.name);
 const passenger=list.find(p=>p.id==='0120202');
 assert.equal(passenger.name,'여객_하_(서울-수원)_NEW');assert.equal(passenger.calls.length,23);
 const ydp=passenger.calls.find(c=>c.station==='yeongdeungpo');assert.deepEqual([ydp.arrive,ydp.dwell,P.depart(ydp),ydp.arrivalRoute,ydp.departureRoute],[660,120,780,'1A_2T','4B_B622T']);
 assert.equal(passenger.calls.at(-1).arrive,36*60+30);
 const chuseok=list.find(p=>p.name==='추석');assert.equal(chuseok.direction,'up');assert.equal(chuseok.calls.at(-1).arrive,31*60);
});
test('apply shifts the chosen stretch to the 시발시각 and builds a valid train',()=>{
 const p=P.seed().find(p=>p.id==='0120202'),start=3600; // 09:00
 const calls=P.apply(p,{from:'yongsan',to:'anyang',start});
 assert.equal(calls[0].station,'yongsan');assert.equal(calls[0].stopType,'시발');assert.equal(calls[0].arrivalRoute,'');assert.equal(calls[0].departure,start);
 assert.equal(calls.at(-1).station,'anyang');assert.equal(calls.at(-1).stopType,'종착');assert.equal(calls.at(-1).departureRoute,'');
 assert.equal(calls.at(-1).arrival,start+(26*60+30)-(3*60+30));
 const model=T.initial();
 assert.ok(T.create(model,{id:'A1234',direction:'down',kind:'무궁화호',service:'정기',flags:[],carCount:8,relatedTrain:'',cancelled:false,calls}).ok);
 assert.equal(P.apply(p,{from:'anyang',to:'yongsan'}),null);
});
test('validate refuses wrong order, going-back times and unknown routes',()=>{
 const p=structuredClone(P.seed()[0]);
 const swap=structuredClone(p);[swap.calls[1],swap.calls[2]]=[swap.calls[2],swap.calls[1]];assert.match(P.validate(swap),/역 순서/);
 const time=structuredClone(p);time.calls[3].arrive=0;assert.match(P.validate(time),/진입 시간/);
 const route=structuredClone(p);route.calls[2].arrivalRoute='9Z_1T';assert.match(P.validate(route),/없는 진입 진로/);
 assert.match(P.validate({...p,name:' '}),/패턴이름/);
 assert.equal(P.nextId(P.seed()),'0129104');
 assert.deepEqual(P.search(P.seed(),{direction:'down',kind:'KTX'}).map(p=>p.id),['0120202','0129103']);
});

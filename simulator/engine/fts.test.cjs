const test=require('node:test'),assert=require('node:assert');
const F=require('./fts.js'),T=require('./timetable.js'),P=require('./patterns.js'),A=require('./assessment.js');
const SC=require('./scenarios.js'),EM=require('./emergency.js'),SS=require('./schedule-scenarios.js');
const scripts=[...SC.list,...EM.list,...SS.list].map(s=>s.id);
const limits=Object.fromEntries(scripts.map(id=>[id,A.limitsFor(id)[0]]).filter(([,v])=>v));
const lib=()=>F.seed({scripts,limits});
test('the built-in library is valid and uses every script once',()=>{
 const l=lib();assert.deepEqual(F.validate(l,{scripts}),[]);
 assert.deepEqual(l.problems.filter(p=>p.script).map(p=>p.script).sort(),[...scripts].sort());
 assert.equal(l.problems.find(p=>p.script==='em-01').limit,A.limitsFor('em-01')[0]);
});
test('validation names what is wrong in a hand- or AI-made library',()=>{
 const bad={problems:[{id:'X',subject:'수학',name:'',limit:0,checks:[{condition:{type:'route',station:'yongsan',route:'9Z-1T'}},{condition:{type:'teleport'}}],phenomena:[{type:'route',station:'nowhere',route:'1A-1T'}]}],situations:[{id:'S',name:'s',problems:['Y']}],scenarios:[{id:'C',name:'c',situations:['Q']}]};
 const e=F.validate(bad,{scripts}).join('\n');
 for(const s of ['과목은','문제명칭','제한시간','없는 진로 9Z-1T','알 수 없는 조건 종류 teleport','없는 역 nowhere','없는 문제 Y','없는 상황 Q'])assert.match(e,new RegExp(s.replace(/[()]/g,'\\$&')));
});
test('a session runs problems in order: trigger, phenomena, grading, time-out and 문제종료',()=>{
 const l=lib(),model=T.initial(),ctx={model,states:{},ls:{stations:{}},events:[],ui:{},manual:{}};
 const s=F.createSession(l,'SC-01',{professor:'박교수',student:'tester',startedAt:0});
 assert.equal(s.items[0].problem,'P-C4201-01');
 let out=F.advance(l,s,()=>ctx,0);assert.equal(out[0].kind,'activate');assert.equal(s.items[0].status,'진행');
 // student creates C4201 Yongsan -> Suwon from the photographed pattern
 const p=P.seed().find(x=>x.id==='0120202');
 assert.ok(T.create(model,{id:'C4201',direction:'down',kind:'KTX',service:'정기',flags:[],carCount:8,relatedTrain:'',cancelled:false,calls:P.apply(p,{from:'yongsan',to:'suwon',start:3600})}).ok);
 out=F.advance(l,s,()=>ctx,30);assert.ok(out.some(o=>o.kind==='end'&&o.status==='완료'));assert.equal(s.items[0].score,100);
 // next: dwell 10 min at Yeongdeungpo — run past its 60 s limit
 F.advance(l,s,()=>ctx,31);assert.equal(s.items[1].status,'진행');
 F.advance(l,s,()=>ctx,95);assert.equal(s.items[1].status,'시간초과');assert.equal(s.items[1].score,0);
 // partial cancel Yongsan-Yeongdeungpo is graded from the timetable
 F.advance(l,s,()=>ctx,96);assert.ok(T.setCancelled(model,'C4201','yongsan','yeongdeungpo',true).ok);
 F.advance(l,s,()=>ctx,100);assert.equal(s.items[2].status,'완료');
 // 문제종료 by the instructor ends the current one
 F.advance(l,s,()=>ctx,101);F.endCurrent(s,110);assert.equal(s.items[3].status,'종료');
 const sum=F.summary(l,s);assert.equal(sum.rows.length,s.items.length);assert.ok(sum.got>=200);
});
test('conditions read LS, station state, events, schedule and manual marks',()=>{
 const model=T.initial(),ctx={model,states:{uiwang:{mode:'CCM',routes:{'2A-6T':{}},signals:{'3A':'STOP'},points:{'54':'R'}}},ls:{stations:{uiwang:{windows:{'B1011T':[{number:'K0651'}]}}}},events:[{type:'stop',station:'uiwang',id:'2B',ok:true}],ui:{windows:['graph'],graphTrain:'K1131'},manual:{'구술':true}};
 const yes=[{type:'mode',station:'uiwang',value:'CCM'},{type:'route',station:'uiwang',route:'2A-6T'},{type:'signalStop',station:'uiwang',signal:'3A'},{type:'point',station:'uiwang',point:'54',value:'R'},{type:'trainAt',number:'K0651',station:'uiwang'},{type:'trainGone',number:'K9999'},{type:'trainExists',train:'K1131',from:'cheongnyangni',to:'suwon'},{type:'event',eventType:'stop',station:'uiwang',id:'2B'},{type:'graphTrain',train:'K1131'},{type:'manual',label:'구술'},{type:'schedule',train:'K1131',station:'jegidong',field:'dwell',value:30}];
 for(const c of yes)assert.ok(F.test(c,ctx),F.describe(c));
 assert.ok(!F.test({type:'route',station:'uiwang',route:'2B-4T'},ctx));
 assert.ok(F.test({type:'all',conditions:yes},ctx));assert.ok(!F.test({type:'not',condition:yes[0]},ctx));
});
test('library survives a JSON round trip (export -> import)',()=>{const l=lib();assert.deepEqual(F.validate(JSON.parse(JSON.stringify(l)),{scripts}),[]);});

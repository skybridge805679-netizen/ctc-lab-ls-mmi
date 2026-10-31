const test=require('node:test'),assert=require('node:assert');
const F=require('./fts.js'),T=require('./timetable.js'),P=require('./patterns.js'),A=require('./assessment.js');
const SC=require('./scenarios.js'),EM=require('./emergency.js'),SS=require('./schedule-scenarios.js');
const scripts=[...SC.list,...EM.list,...SS.list].map(s=>s.id);
const limits=Object.fromEntries(scripts.map(id=>[id,A.limitsFor(id)[0]]).filter(([,v])=>v));
const lib=()=>F.seed({scripts,limits});
test('the built-in library is valid: schedule scripts once, 대피·비상 as active data problems',()=>{
 const l=lib();assert.deepEqual(F.validate(l,{scripts}),[]);
 assert.deepEqual(l.problems.filter(p=>p.script).map(p=>p.script).sort(),SS.list.map(s=>s.id).sort());
 for(const id of [...SC.list,...EM.list].map(s=>s.id))assert.ok(l.problems.find(p=>p.id==='P-'+id)?.objectives.length,id);
 assert.equal(l.problems.find(p=>p.id==='P-em-01').limit,A.limitsFor('em-01')[0]);
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
test('active problem: setup, objectives in any order, communications, reactions and deadlines',()=>{
 const p={id:'A',subject:'운행선 관리',name:'용산 5번 대피',limit:600,score:100,
  setup:{routes:[{station:'yongsan',route:'2A-7T'}],approach:[{station:'yongsan',signal:'2A'}],modes:[{station:'yongsan',value:'AUTO'}],trains:[{number:'A1002',station:'yongsan',slot:'B607T',direction:'up'}]},
  objectives:[{id:'ccm',label:'CCM 전환',condition:{type:'mode',station:'yongsan',value:'CCM'}},{id:'cancel',label:'2A 취소',condition:{type:'signalCancelled',station:'yongsan',signal:'2A'}},{id:'route',label:'2A-5T',condition:{type:'route',station:'yongsan',route:'2A-5T'},deadline:300}],
  communications:[{id:'follow',label:'후속열차 통보',text:'후속열차 주의운전'},{id:'station',label:'용산역 통보'}],
  reactions:[{id:'enter',label:'고장열차 5번선 진입',when:{type:'objective',id:'route'},after:30,do:[{type:'moveTrain',number:'A1002',station:'yongsan',slot:'5T'}]}]};
 const lib={problems:[p],situations:[{id:'S',name:'s',problems:['A']}],scenarios:[{id:'C',name:'c',situations:['S']}]};
 assert.deepEqual(F.validate(lib),[]);
 const s=F.createSession(lib,'C',{startedAt:0}),state={mode:'AUTO',routes:{},signals:{}},ctx={states:{yongsan:state},events:[],manual:{}};const at=t=>F.advance(lib,s,()=>ctx,t);
 let out=at(0);assert.deepEqual(out.filter(o=>o.setup).map(o=>o.phenomenon.type),['route','approach','mode','insertTrain']);
 // communications first, then operations in a different order than the script — all count
 ctx.manual['comm:station']=true;at(10);
 ctx.events.push({type:'stop',station:'yongsan',id:'2A',ok:true});at(20);
 state.mode='CCM';at(30);
 assert.equal(s.items[0].status,'진행');
 state.routes['2A-5T']={};at(400);                                   // after its 300 s deadline: half credit
 assert.ok(s.items[0].obj.route>300);
 out=at(429);assert.ok(!out.some(o=>o.reaction));out=at(431);assert.deepEqual(out.filter(o=>o.reaction).map(o=>o.phenomenon.slot),['5T']);
 ctx.manual['comm:follow']=true;at(440);
 assert.equal(s.items[0].status,'완료');
 const sum=F.summary(lib,s).rows[0];assert.equal(sum.objectives.find(o=>o.id==='route').late,true);
 assert.equal(s.items[0].score,Math.round(100*(1+1+0.5+1+1)/5));
 // references to unknown objectives / phenomena are refused
 const bad=structuredClone(lib);bad.problems[0].reactions[0].when={type:'objective',id:'nope'};bad.problems[0].reactions[0].do[0].slot='ZZT';
 assert.match(F.validate(bad).join('\n'),/없는 목표 nope[\s\S]*없는 열번창 ZZT/);
});

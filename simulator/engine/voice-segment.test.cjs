'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('./voice-segment.js');
// 소리 흉내: [초, 크기] 구간들을 16kHz로 이어 붙인다 (크기 0.1 = 말소리, 0.002 = 조용함)
function signal(parts){const n=parts.reduce((a,[s])=>a+Math.round(s*16000),0),x=new Float32Array(n);let o=0,ph=0;
 for(const [s,amp] of parts){const m=Math.round(s*16000);for(let i=0;i<m;i++)x[o+i]=amp*Math.sin(ph+=0.2);o+=m;}return x;}
function run(x,opt){const segs=[];const g=G.create({...opt,onSegment:(a,info)=>segs.push({dur:a.length/16000,cut:info.cut})});for(let i=0;i<x.length;i+=2048)g.feed(x.subarray(i,i+2048));return {segs,g};}

test('말 자르기: 무음 0.9초에서 한 마디 (음성 1인 모드 기본)',()=>{
 const {segs}=run(signal([[1,0.002],[3,0.1],[1.2,0.002],[2,0.1],[1.2,0.002]]),{end:0.9,hard:25});
 assert.equal(segs.length,2);assert.ok(segs.every(s=>s.cut==='end'));assert.ok(Math.abs(segs[0].dur-(0.3+3+0.9))<0.15,String(segs[0].dur));
});
test('쉬지 않고 말하기: 6초가 지나면 짧은 숨 고르기(0.25초)에서 자르고, 소리는 하나도 버리지 않는다',()=>{
 const parts=[[0.5,0.002]];for(let i=0;i<8;i++)parts.push([3,0.1],[0.25,0.002]);parts.push([1.5,0.002]);
 const x=signal(parts),{segs}=run(x,{end:0.9,soft:6,gap:0.2,hard:12});
 assert.ok(segs.length>=3&&segs.length<=5,'마디 '+segs.length);
 for(const s of segs.slice(0,-1)){assert.equal(s.cut,'gap');assert.ok(s.dur>=6&&s.dur<=12.5,String(s.dur));}
 const total=segs.reduce((a,s)=>a+s.dur,0);assert.ok(total>=8*3.25-0.1,'버린 소리 없음 '+total);
});
test('숨 고르기도 없으면 12초에서 소리가 가장 작은 곳에서 자른다 (단어 한가운데를 피한다)',()=>{
 const {segs}=run(signal([[0.5,0.002],[8.5,0.1],[0.1,0.03],[6,0.1],[1.5,0.002]]),{end:0.9,soft:6,gap:0.2,hard:12});
 assert.equal(segs[0].cut,'hard');assert.ok(Math.abs(segs[0].dur-9.1)<0.25,'작은 소리에서 잘림 '+segs[0].dur);assert.equal(segs.length,2);
});
test('flush: 끝나지 않은 말을 바로 내보낸다 (구술 시간 종료) · current: 중간 받아쓰기용 소리',()=>{
 const {segs,g}=run(signal([[0.5,0.002],[4,0.1]]),{end:0.9,soft:6,hard:12});
 assert.equal(segs.length,0);assert.ok(g.talking);assert.ok(g.current().length/16000>4);g.flush();assert.equal(segs.at(-1).cut,'flush');assert.ok(!g.talking);
});
test('받아쓰기 다듬기: 지어낸 말 거르기 · 토큰 예산',()=>{
 assert.equal(G.tidy('시청해주셔서 감사합니다.',3),'');
 assert.equal(G.tidy('감사합니다',2),'');
 assert.equal(G.tidy('관제사에게 보고 관제사에게 보고 관제사에게 보고 관제사에게 보고',4),'관제사에게 보고');
 assert.equal(G.tidy('가'.repeat(80),2),'','2초에 80글자는 지어낸 글');
 assert.equal(G.tidy('작업책임자를 지정하여 작업 현장에 배치한다',4),'작업책임자를 지정하여 작업 현장에 배치한다');
 assert.equal(G.budget(25),366);assert.ok(G.budget(60)<=440);
});

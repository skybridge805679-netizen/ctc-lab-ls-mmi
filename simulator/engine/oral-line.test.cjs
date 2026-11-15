'use strict';
// 열차운행선 관리 구술 (사용자가 준 「운행선관리 요약」 2026-09-18): 데이터 · FTS 문제 · 공부용 문서가 같은 내용인지
const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('./oral-line.js'),F=require('./fts.js'),fs=require('fs'),path=require('path'),cp=require('child_process');
test('요약의 62문항이 빠짐없이 들어 있고 출제 표시가 정해진 값만 쓴다',()=>{
 assert.equal(O.items.length,62);assert.equal(new Set(O.items.map(i=>i.id)).size,62);
 for(const i of O.items){assert.ok(i.q&&i.a.length,i.id);assert.ok(O.CHAPTERS.includes(i.ch),i.id);for(const t of i.tags)assert.ok(['기출','신출','예상','1차','2차','3차'].includes(t),i.id+' '+t);}
 assert.equal(O.items.filter(i=>i.tags.includes('예상')).length,6,'점선 상자 6문항');
 assert.deepEqual(O.items.filter(i=>i.tags.includes('신출')).map(i=>i.id),['ZONE-HARM']);
 assert.equal(O.items.filter(i=>['1차','2차','3차'].every(t=>i.tags.includes(t))).length,15,'26년 세 회차 모두 나온 문항');
 const pre=O.items.find(i=>i.id==='PRE-EDU');assert.equal(pre.page,'45');assert.equal(pre.a.length,7);
 assert.match(O.items.find(i=>i.id==='MULTI-EQUIP').a[0],/200m/);assert.match(O.items.find(i=>i.id==='COORD-TIME').a[0],/3시간 전까지/);
});
test('FTS: 문항마다 구술 문제 하나 · 전체 / 26년 출제 / 예상·신출 시나리오',()=>{
 const L=F.seed(),ps=L.problems.filter(p=>p.id.startsWith('P-LORAL-'));assert.equal(ps.length,62+O.book.length);
 for(const p of ps){assert.equal(p.subject,'운행선 관리');assert.equal(p.checks.length,1);assert.equal(p.checks[0].condition.type,'manual');assert.ok(p.actions.length>10,p.id);assert.ok(p.limit>=60&&p.limit<=240);}
 const n=id=>L.situations.find(s=>s.id===L.scenarios.find(c=>c.id===id).situations[0]).problems.length;
 assert.equal(n('SC-LORAL'),62);assert.equal(n('SC-LORAL-ASKED'),32);assert.equal(n('SC-LORAL-NEW'),7);
 assert.deepEqual(F.validate(L),[]);
 assert.match(ps.find(p=>p.id==='P-LORAL-ZONE-HARM').situation,/신출 · 26년 1차·3차 · 교재 14쪽/);
 assert.match(ps.find(p=>p.id==='P-LORAL-EQUIP-BLOCK').actions,/※ 교재 37~38쪽 원문/);
});
test('교재 문항(기출 외): 장마다 있고 기출과 id가 겹치지 않으며 FTS 장별·전체 시나리오로 풀린다',()=>{
 assert.equal(O.book.length,171);const ids=new Set(O.items.map(i=>i.id));
 for(const i of O.book){assert.ok(!ids.has(i.id),i.id);ids.add(i.id);assert.deepEqual(i.tags,['교재']);assert.ok(O.CHAPTERS.includes(i.ch),i.id);assert.match(i.page,/^\d+(~\d+)?$/,i.id);assert.doesNotMatch(i.q,/제\d+조/,i.id);assert.ok(i.q&&i.a.length,i.id);}
 for(const ch of O.CHAPTERS)assert.ok(O.book.some(i=>i.ch===ch),ch);
 const L=F.seed(),sc=id=>L.scenarios.find(c=>c.id===id),cnt=id=>sc(id).situations.reduce((t,s)=>t+L.situations.find(x=>x.id===s).problems.length,0);
 assert.equal(sc('SC-LORAL-BOOK').situations.length,O.CHAPTERS.length);assert.equal(cnt('SC-LORAL-BOOK'),171);assert.equal(cnt('SC-LORAL-TOTAL'),233);
 const p=L.problems.find(x=>x.id==='P-LORAL-B-ORDER-ISSUE-A');assert.equal(p.situation,'교재 문항(기출 외) · 교재 58쪽');assert.match(p.actions,/작업시작일 1일 전 17시까지/);
 assert.ok(fs.readFileSync(path.join(__dirname,'..','..','docs','운행선관리-교재구술.md'),'utf8').includes('### '+O.book[0].q));
});
test('모든 문항에 개조식 본답과 [참고]가 있고 FTS 모범답안에 본답·참고·원문 순으로 실린다',()=>{
 const F2=require('./fts.js'),L=F2.seed();
 for(const i of [...O.items,...O.book]){assert.ok(Array.isArray(i.key)&&i.key.length>0,i.id);assert.ok(Array.isArray(i.ref),i.id);for(const x of i.key)assert.ok(x.length<=140,i.id+' 본답 줄이 너무 길다: '+x);}
 const p=L.problems.find(x=>x.id==='P-LORAL-COORD-TIME');assert.match(p.actions,/^1\) 차단장비 운행 있음 → 착수 3시간 전까지/);assert.match(p.actions,/\[참고\][\s\S]*\[교재 원문\]/);
});
test('공부용 문서(docs/운행선관리-구술.md)가 데이터와 같다',()=>{
 const file=path.join(__dirname,'..','..','docs','운행선관리-구술.md'),before=fs.readFileSync(file,'utf8');
 cp.execFileSync(process.execPath,[path.join(__dirname,'..','..','tools','build-oral-line-doc.cjs')]);
 assert.equal(fs.readFileSync(file,'utf8'),before,'tools/build-oral-line-doc.cjs를 다시 돌려 문서를 갱신하세요');
 const bookFile=path.join(__dirname,'..','..','docs','운행선관리-교재구술.md');assert.ok(fs.existsSync(bookFile));
});

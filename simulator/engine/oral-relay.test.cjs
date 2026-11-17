const test=require('node:test'),assert=require('node:assert/strict'),R=require('./oral-relay.js');
test('구술 릴레이 항목 판정: 모범 답안을 말하면 모든 문항의 항목이 다 체크되고, 다른 문항의 답으로는 거의 체크되지 않는다',()=>{
 const all=R.pool('all');assert.equal(all.length,233);assert.equal(R.pool('exam').length,62);assert.ok(R.chapters().every(c=>R.pool('ch:'+c).length>0));
 for(const x of all)assert.equal(R.check(x,x.key.join(' ')).length,x.key.length,x.id);
 let cross=0,tot=0;for(const [i,x] of all.entries())for(const off of [37,91,150]){cross+=R.check(x,all[(i+off)%all.length].key.join(' ')).length;tot+=x.key.length;}
 assert.ok(cross/tot<0.02,`다른 문항 답으로 잘못 체크 ${cross}/${tot}`);
 const it=all.find(x=>x.id==='TEST-PLAN');      // 문제 글에 나온 말(종합시험운행)은 되풀이하지 않아도 된다
 assert.deepEqual(R.check(it,'방법 및 절차, 평가항목 및 평가 기준, 일정'),[0,1,2]);assert.deepEqual(R.check(it,'시험기기 및 장비'),[4]);assert.deepEqual(R.check(it,'방법'),[]);
 assert.ok(R.isSkip('패스')&&R.isSkip('다음 문제요')&&!R.isSkip('철도운영자와 합동으로'));
 // 「이상입니다」: 끝말로 문제를 마친다. 함께 말한 앞부분은 채점에 쓰고, 수량 뒤의 「이상」(200m 이상입니다)은 답으로 본다
 for(const t of ['이상입니다','이상입니다.','이상 입니다','이상.'])assert.equal(R.endOf(t),'',t);
 assert.equal(R.endOf('관제사에게 보고합니다. 이상입니다.'),'관제사에게 보고합니다.');
 assert.equal(R.endOf('현장 확인 후 보고함 이상입니다 감사합니다'),'현장 확인 후 보고함');
 for(const t of ['200m 이상입니다','2년 이상입니다.','두 명 이상입니다','30mm 이상','이상 유무를 확인합니다','이상이 있으면 보고합니다','정차 시간은 30초 이상입니다'])assert.equal(R.endOf(t),null,t);
 assert.equal(R.endOf('30초 이상입니다. 이상입니다.'),'30초 이상입니다.');
 // 문제 은행 어느 답안 줄도 끝말로 오인하지 않는다
 for(const x of R.all())for(const l of [...x.a,...x.key])assert.equal(R.endOf(l),null,x.id+': '+l);
 assert.ok(R.hint(R.all()[0]).endsWith('이상입니다. 패스.'));assert.ok(R.hint(R.all()[0],'앞에서 말한 글').endsWith('앞에서 말한 글'));
});
test('결과 화면: 모범 답안에서 말하지 못한 항목의 말만 강조한다 (문제 글에 있는 말은 제외)',()=>{
 const x=R.all().find(x=>x.id==='B-TEST-RECORD-A'),miss=R.highlight(x,[1,2])[0].filter(p=>p.miss).map(p=>p.text.trim());
 assert.ok(miss.includes('조치내용')&&miss.includes('국토교통부장관에게'));assert.ok(!miss.some(t=>/철도운영자|종합시험운행/.test(t)));
});
test('간격 반복: 틀린 문제는 곧 다시, 맞힌 문제는 점점 뜸하게, 기한이 된 문제부터 낸다',()=>{
 const now=Date.UTC(2026,10,17),DAY=86400000;
 const bad=R.grade({},0.3,now);assert.ok(bad.due-now<10*60*1000&&bad.lapses===1);
 let good=R.grade({},1,now);assert.equal(good.interval,1);good=R.grade(good,1,now);assert.equal(good.interval,3);good=R.grade(good,1,now);assert.ok(good.interval>=7);
 const items=R.pool('ch:총칙'),stats={[items[0].id]:{due:now-DAY},[items[1].id]:{due:now+DAY}};
 assert.equal(R.pick(items,stats,{now}).id,items[0].id,'기한이 지난 문제 먼저');
 assert.ok(!stats[R.pick(items,stats,{now:now-2*DAY,random:()=>0}).id],'기한이 없으면 처음 보는 문제');
 assert.notEqual(R.pick(items,stats,{now,recent:[items[0].id]}).id,items[0].id,'방금 낸 문제는 피한다');
});

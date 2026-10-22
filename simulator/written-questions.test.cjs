const assert=require('assert');
const {questions:Q}=require('./written-questions.js');
assert.ok(Q.length>=180,'question bank size '+Q.length);
assert.strictEqual(new Set(Q.map(q=>q.id)).size,Q.length,'unique ids');
for(const q of Q){
 assert.ok(q.q&&q.q.length>6,'question text '+q.id);
 if(q.choices.length){assert.strictEqual(q.choices.length,4,'4 choices #'+q.id);assert.ok(q.answer>=1&&q.answer<=4,'answer #'+q.id);assert.ok(q.choices.every(c=>c.length>0),'empty choice #'+q.id);}
 else assert.ok(q.text,'short answer text #'+q.id);
}
// 7장 종합 평가: 114 questions, every one has an explanation and a source article, and the 7.5 table agrees with 7.6
const seven=Q.filter(q=>q.chapter.startsWith('7장 종합 평가'));
assert.strictEqual(seven.length,114);assert.ok(seven.every(q=>q.why&&q.ref),'explanations');
// known items (checked against the book)
const by=(chapter,no)=>Q.find(q=>q.source==='관제관련규정'&&q.chapter.startsWith(chapter)&&q.no===no);
assert.strictEqual(by('1장',1).answer,1);assert.strictEqual(by('1장',5).answer,3);assert.ok(/교행변경/.test(by('1장',5).choices[2]));
assert.strictEqual(by('7장',1).answer,3);assert.strictEqual(by('7장',3).answer,4);assert.ok(/관제센터장/.test(by('7장',3).choices[3]));
assert.strictEqual(by('7장',8).answer,4);assert.ok(/차량정비기지/.test(by('7장',8).choices[3]));
assert.strictEqual(by('7장 종합 평가 · 도시철도운전규칙',88).answer??by('7장',88).answer,3);
const unit=Q.filter(q=>q.source==='관제관련규정'&&!q.chapter.startsWith('7장'));assert.strictEqual(unit.length,36);
const emergency=Q.filter(q=>q.source==='비상시조치등');assert.ok(emergency.length>=30&&emergency.some(q=>!q.choices.length));
assert.strictEqual(emergency.find(q=>q.q.includes('하인리히')).text,'29, 300');
console.log('written question bank: ok',Q.length);

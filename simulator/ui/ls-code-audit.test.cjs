'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../../tools/audit-ls-code.cjs');
test('LS 코드 점검: 15개 역의 T칸·신호기·입환표지·선로전환기·열번칸에 예상 밖 문제가 없다',()=>{
 const out=A.audit();assert.equal(Object.keys(out).length,15);
 assert.deepEqual(A.unexpected(out),{});
});

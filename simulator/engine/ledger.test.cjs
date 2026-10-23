const assert=require('assert'),L=require('./ledger.js'),T=require('./timetable.js');
const m=T.initial();
assert.ok(T.delay(m,'K1131','seoul',3).ok);                               // 운전시각변경 -> 관제승인 1호
assert.ok(T.setCancelled(m,'K1133','seoul','yongsan',true).ok);          // 구간운휴 -> 운전명령 1호
assert.ok(T.cancel(m,'K1135').ok);                                        // 운휴 -> 운전명령 2호
const d=structuredClone(m.trains.find(t=>t.id==='K1137'));
d.calls[3].arrivalRoute=d.calls[3].arrivalRoute?'':d.calls[3].arrivalRoute;d.calls[3].track='2번선';  // 선 변경 only
assert.ok(T.update(m,'K1137',d).ok);
const e=structuredClone(m.trains.find(t=>t.id==='K1139'));e.calls[4].arrival-=10;e.calls[4].departure+=10;e.kind='회송열차';
assert.ok(T.update(m,'K1139',e).ok);                                      // 종별변경(운전명령 3호) + 운전시각변경(관제승인 2호)
const rows=L.entries(m.changes);
const by=k=>rows.filter(r=>r.kind===k);
assert.strictEqual(by('운전시각변경')[0].label,'관제승인 1호');
assert.deepStrictEqual(rows.filter(r=>r.cls==='운전명령').map(r=>r.label),['운전명령 1호','운전명령 2호','운전명령 3호']);
assert.strictEqual(by('출발·도착선 변경').length,1);assert.strictEqual(by('출발·도착선 변경')[0].number,null);
assert.strictEqual(by('종별변경').length,1);
assert.strictEqual(rows.filter(r=>r.kind==='운전시각변경').at(-1).label,'관제승인 2호');
// CDRS and auto-delay records
assert.strictEqual(L.classify({type:'cdrs',id:'A1',station:'seoul',minutes:2})[0].cls,'관제승인');
assert.strictEqual(L.classify({type:'cdrs',id:'A1',station:'seoul',route:'1A_1T'})[0].cls,'단순 운전정리');
assert.strictEqual(L.classify({type:'delay',id:'A1',station:'seoul',seconds:45,auto:true})[0].text.includes('자동제어'),true);
console.log('ledger: ok',rows.length);

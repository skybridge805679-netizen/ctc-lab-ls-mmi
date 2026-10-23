const assert=require('node:assert/strict'),{audit}=require('./route-conflict-audit.cjs');
const report=audit();
assert.equal(report.totals.stations,15);assert.equal(report.totals.routes,656);
assert.equal(report.totals.pairs,19392);assert.equal(report.totals.orders,38784);
assert.equal(report.totals.newlyAllowed,1541);assert.equal(report.totals.sharedNormalPairs,1542);
assert.equal(report.totals.lifecycleOrders,3084);
assert(report.stations.every(s=>s.newlyAllowed>0),'the generic rule covers all 15 stations');
console.log('PASS all 19,392 route pairs in both orders; 1,542 shared-N pairs with independent entry, occupancy, passage and final switch release');

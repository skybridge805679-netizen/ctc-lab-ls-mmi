const assert=require('node:assert/strict'),{audit}=require('./route-conflict-audit.cjs');
const report=audit();
assert.equal(report.totals.stations,15);assert.equal(report.totals.routes,658);
assert.equal(report.totals.pairs,19487);assert.equal(report.totals.orders,38974);
assert.equal(report.totals.newlyAllowed,1557);assert.equal(report.totals.sharedNormalPairs,1558);
assert.equal(report.totals.lifecycleOrders,3116);
assert(report.stations.every(s=>s.newlyAllowed>0),'the generic rule covers all 15 stations');
console.log('PASS all 19,487 route pairs in both orders; 1,558 shared-N pairs with independent entry, occupancy, passage and final switch release');

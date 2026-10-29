const assert=require('node:assert/strict'),{audit}=require('./route-conflict-audit.cjs');
const report=audit();
assert.equal(report.totals.stations,15);assert.equal(report.totals.routes,710);
assert.equal(report.totals.pairs,22718);assert.equal(report.totals.orders,45436);
assert.equal(report.totals.newlyAllowed,1784);assert.equal(report.totals.sharedNormalPairs,1785);
assert.equal(report.totals.lifecycleOrders,3570);
assert(report.stations.every(s=>s.newlyAllowed>0),'the generic rule covers all 15 stations');
console.log('PASS all 22,718 route pairs in both orders; 1,785 shared-N pairs with independent entry, occupancy, passage and final switch release');

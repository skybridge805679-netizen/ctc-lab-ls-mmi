const {audit}=require('../simulator/engine/route-conflict-audit.cjs');
const report=audit();
if(process.argv[2])require('node:fs').writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,stations:report.stations},null,2));

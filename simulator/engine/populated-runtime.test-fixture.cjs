'use strict';
module.exports=()=>{const r=require('./runtime.cjs').create();const result=r.command({type:'timetable',method:'import',args:[require('./sample-timetable.test-fixture.cjs')()]});if(!result.ok)throw Error(result.message);return r;};

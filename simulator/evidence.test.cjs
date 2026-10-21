// Routes read from photos of the real MMI (references/route-menus/evidence) must exist in the simulator.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Core=require('./core.js'),MENUS=require('./route-menus.js');
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
const rows=[];let st=null;
for(const l of fs.readFileSync(path.join(__dirname,'../references/route-menus/evidence/mmi-photos-2026-10-21.txt'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#'))){
 if(!/ - /.test(l)){st=l.trim();continue;}const m=l.split(' - ')[1].trim().match(/^RT_(\w+?)_(\w+)$/);rows.push([st,m[1],m[2]]);}
test('every route seen on the real MMI is derived by the simulator',()=>{
 assert(rows.length>=30);for(const [s,sig,d] of rows)assert(Core.forStation(s).routes[sig+'-'+d],`${s} ${sig}-${d}`);
});
test('where a verified LS menu exists it contains the route seen on the real MMI',()=>{
 for(const [s,sig,d] of rows)if(MENUS[s]?.[sig])assert(MENUS[s][sig].includes(d),`${s} ${sig}-${d}`);
});
console.log(n+' evidence tests passed');

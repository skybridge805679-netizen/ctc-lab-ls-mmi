// Compares a hand-transcribed LS route-menu list (references/route-menus/*.txt) with the routes the simulator derives.
// Usage: node tools/compare-route-menus.cjs [file]   — format: a station id line, then "<signal> - RT_<signal>_<dest>, ..." lines.
const fs=require('fs'),path=require('path');
const Core=require('../simulator/core.js');
const file=process.argv[2]||path.join(__dirname,'../references/route-menus/ls-route-menus-transcribed.txt');
const user={};let st=null;
for(const l of fs.readFileSync(file,'utf8').split('\n').filter(Boolean)){
 if(!/ - /.test(l)){st=l.trim();user[st]=new Set();continue;}
 // a line may hold several "<signal> - RT_..." groups; the signal before each group is the expected prefix
 for(const [sig,rest] of l.split(/\s+(?=\d+[A-Z]?\s-\s)/).map(g=>g.split(' - '))){
  for(const r of rest.split(',').map(s=>s.trim())){
   const m=r.match(/^RT_(\w+?)_(\w+)$/);
   if(!m){console.log('?? unreadable token',st,r);continue;}
   if(m[1]!==sig.trim())console.log('!! signal prefix differs from its line (possible typo):',st,'line',sig.trim(),'token',r);
   user[st].add(m[1]+'-'+m[2]);}}}
// Rule drafted from the transcribed stations: arrival signals end on station tracks; departure signals end on a
// boundary track whose number parity matches the direction (even = down/right, odd = up/left).
function mainRule(C,id){const r=C.routes[id],s=C.signals[r.signal],d=r.destination,m=d.match(/^B(\d+)T/);
 if(s.kind==='장내')return !m;if(m){const even=(+m[1])%2===0;return s.dir===1?even:!even;}return /^(A1T|AT)$/.test(d);}
const T={tp:0,fp:0,fn:0,user:0,found:0,shuntUser:0,shuntFound:0,shuntExtra:0};
for(const [id,set] of Object.entries(user)){
 const C=Core.forStation(id),ours=new Set(Object.keys(C.routes)),sigs=new Set([...set].map(x=>x.split('-')[0]));
 const miss=[...set].filter(x=>!ours.has(x));
 console.log('\n==',id,'transcribed',set.size,'| found in derived routes',set.size-miss.length,'| not derivable:',miss.join(' ')||'-');
 for(const rid of ours){const sig=rid.split('-')[0];if(!sigs.has(sig))continue;const kind=C.signals[sig].kind,truth=set.has(rid);
  if(kind==='입환'){if(!truth){T.shuntExtra++;console.log('  shunt not in list:',rid);}continue;}
  const pred=mainRule(C,rid);if(pred&&truth)T.tp++;else if(pred){T.fp++;console.log('  rule FALSE POSITIVE:',rid);}else if(truth){T.fn++;console.log('  rule MISS:',rid);}}
 for(const x of set){T.user++;if(ours.has(x))T.found++;if(C.signals[x.split('-')[0]]?.kind==='입환'){T.shuntUser++;if(ours.has(x))T.shuntFound++;}}
 const noList=[...new Set([...ours].map(x=>x.split('-')[0]))].filter(s=>!sigs.has(s));if(noList.length)console.log('  signals with routes in the simulator but absent from the list:',noList.join(','));
}
console.log('\nTOTAL',T,'\nmain-signal rule precision',(T.tp/(T.tp+T.fp)).toFixed(2),'recall',(T.tp/(T.tp+T.fn)).toFixed(2));

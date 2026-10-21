// Writes a DRAFT LS route-menu list for the stations that have no verified list yet.
// Arrival/departure signals use the rule induced from the verified stations (see docs/진로목록-원본대조.md);
// shunting signals list every route the wiring allows (candidates: delete the ones the real LS does not offer).
const fs=require('fs'),path=require('path'),Core=require('../simulator/core.js'),N=require('../simulator/network.js'),MENUS=require('../simulator/route-menus.js');
function mainRule(C,id){const r=C.routes[id],s=C.signals[r.signal],d=r.destination,m=d.match(/^B(\d+)T/);
 if(s.kind==='장내')return !m;if(m){const even=(+m[1])%2===0;return s.dir===1?even:!even;}return /^(A1T|AT)$/.test(d);}
const nat=(a,b)=>a.localeCompare(b,'en',{numeric:true});
// User answers (references/route-menus/answers/*.txt) override the rule-based draft per signal.
const answers={};const adir=path.join(__dirname,'../references/route-menus/answers');
for(const f of fs.existsSync(adir)?fs.readdirSync(adir).filter(f=>f.endsWith('.txt')):[]){let st=null;
 for(const l of fs.readFileSync(path.join(adir,f),'utf8').split('\n').filter(Boolean)){if(!/ - /.test(l)){st=l.trim();answers[st]=answers[st]||{};continue;}const [sig,rest]=l.split(' - ');answers[st][sig.trim()]=rest.trim();}}
let out='',main=0,shunt=0,answered=0;
for(const st of N.stations.filter(s=>s.controlled&&!MENUS[s.id])){
 const C=Core.forStation(st.id);out+=st.id+'\n';
 const sigs=Object.keys(C.signals).sort((a,b)=>(C.signals[a].kind==='입환')-(C.signals[b].kind==='입환')||nat(a,b));
 for(const sig of sigs){const ids=Object.keys(C.routes).filter(id=>C.routes[id].signal===sig);
  if(answers[st.id]?.[sig]){out+=`${sig} - ${answers[st.id][sig]}\n`;answered++;continue;}
  const keep=C.signals[sig].kind==='입환'?ids:ids.filter(id=>mainRule(C,id));
  if(!keep.length)continue;out+=`${sig} - ${keep.map(id=>'RT_'+id.replace('-','_')).join(', ')}\n`;
  if(C.signals[sig].kind==='입환')shunt+=keep.length;else main+=keep.length;}}
fs.writeFileSync(path.join(__dirname,'../references/route-menus/ls-route-menus-draft.txt'),out);
console.log('draft written: main routes',main,'shunt candidates',shunt,'| signals taken from user answers',answered);

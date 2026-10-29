const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const N=require('../engine/network'),W=require('../engine/wiring').data,C=require('../engine/core'),L=require('../ui/ls-view'),D=require('../engine/train-windows').data;
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../../references/transcriptions/train-windows.json')));
let count=0,inline=0;
for(const st of N.stations.filter(s=>s.controlled)){
 const entries=D[st.id],core=C.forStation(st.id),v=L.render(st,W[st.id],core,core.initial());
 assert.equal(new Set(entries.map(w=>w.slot)).size,entries.length,st.id+' duplicated window identity');
 assert.equal((v.svg.match(/data-train-slot=/g)||[]).length,entries.length,st.id+' omitted source windows');
 for(const w of entries){
  const source=raw.windows.find(r=>r.station===st.id&&r.slot===w.slot);assert(source?.reviewed);assert.deepEqual(w.sourceWindow,source.sourceWindow);
  assert(w.sourceWindow[2]>65&&w.sourceWindow[3]>=20);assert(v.svg.includes('data-train-slot="'+w.slot+'"'));assert(!/NaN|undefined/.test(v.svg));
  if(w.side==='inline')inline++;
 }count+=entries.length;
}
assert.equal(count,276);assert.equal(inline,71);
// The unmodified PPT media are still the original assets used for the placement inventory.
const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/stations/SOURCES.json')));
for(const im of sources.images){const b=fs.readFileSync(path.join(__dirname,'../assets/stations',im.path));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),im.sha256);}
console.log('PASS 276 PPT train windows / 71 on-rail windows across 15 stations, unique identities and original media hashes');
// Restored circuits retain their original train-number slot identities, with no neighboring anchor.
for(const [station,code]of [['geumjeong','B997T'],['suwon','B1033T']]){const w=D[station].find(w=>w.code===code);assert.equal(w.anchorCode,code);const source=raw.windows.find(r=>r.station===station&&r.code===code),[x,,width]=source.sourceWindow,[cx,,cw]=source.sourceCell;assert(Math.abs(w.fraction-(x+width/2-cx)/cw)<.0001);assert(require('../engine/line').graph.circuits[code]);}

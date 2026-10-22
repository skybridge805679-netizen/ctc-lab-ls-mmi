const assert=require('assert'),S=require('./scenarios.js'),T=require('./timetable.js');
const W=require('./train-windows.js'),slots=st=>new Set((W.data||W)[st].map(s=>s.slot));
for(const sc of S.list){
 assert.ok(sc.cast&&sc.cast[0].role==='fault',sc.id+' has a cast');
 const ok=slots(sc.station),tags=new Set(sc.steps.map(s=>s.tag).filter(Boolean));
 for(const c of sc.cast)assert.ok(ok.has(c.slot),`${sc.id}: start slot ${c.slot} is a 열번창 of ${sc.station}`);
 const keys=new Set(['fault','other']);let f=0;for(const c of sc.cast)if(c.role==='follow')keys.add('follow'+(++f));
 for(const [tag,moves] of Object.entries(sc.beats)){
  assert.ok(tags.has(tag),`${sc.id}: beat tag ${tag} exists on a step`);
  for(const [key,slot] of moves){assert.ok(keys.has(key),`${sc.id}: beat key ${key}`);assert.ok(slot===null||ok.has(slot),`${sc.id}: slot ${slot} of ${sc.station}`);}
 }
 // every tag used in the steps has text without the marker
 assert.ok(sc.steps.every(s=>!s.text.includes('§')));
 // the cast follows the CURRENT timetable: the fault train is the chosen one, nobody is listed twice
 const model=T.initial(),fault=S.candidates(sc,model)[0],cast=S.pickCast(sc,model,fault);
 assert.strictEqual(cast[0].id,fault);assert.strictEqual(new Set(cast.map(c=>c.id)).size,cast.length);
 assert.ok(cast.filter(c=>c.source==='timetable').every(c=>model.trains.find(t=>t.id===c.id)));
 // a timetable with other numbers and only the fault train: fall back to the script's numbers
 const m2=T.initial();m2.trains=m2.trains.filter(t=>t.id===fault);
 const c2=S.pickCast(sc,m2,fault);assert.ok(c2.slice(1).every(c=>c.source==='fallback'&&c.id),sc.id+' fallback');
}
console.log('scenario cast: ok',S.list.length);

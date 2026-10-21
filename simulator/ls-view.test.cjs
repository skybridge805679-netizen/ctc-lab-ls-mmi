const assert=require('node:assert/strict');
const N=require('./network.js'),W=require('./wiring.js'),Core=require('./core.js'),LS=require('./ls-view.js');
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
const controlled=N.stations.filter(s=>s.controlled);
test('every control station renders every signal exactly once, no image and finite size',()=>{
 for(const st of controlled){
  const C=Core.forStation(st.id),view=LS.render(st,W.data[st.id],C,C.initial(),{left:'A',right:'B'});
  assert(Number.isFinite(view.height)&&view.height>120&&view.height<1400,st.id+' height '+view.height);
  assert.equal(view.width,1280);
  assert(!/<image/.test(view.svg),st.id+' must not use a background image');
  assert(!/NaN|undefined/.test(view.svg),st.id+' has NaN/undefined in svg');
  assert.equal((view.svg.match(/data-signal="/g)||[]).length,Object.keys(C.signals).length,st.id);
  assert(!/data-point="/.test(view.svg),st.id+' must not expose point buttons');
  assert.equal((view.svg.match(/data-point-label="/g)||[]).length,Object.keys(C.points).length,st.id);
 }
});
test('jurisdiction stations are drawn with their plates from the original strips',()=>{
 for(const st of controlled){
  const wing=LS.wingOf(st,W.data[st.id]),names=st.map.view.intermediate;
  assert.equal(wing.plates.length,names.length,st.id+' plates vs '+names.join('/'));
  assert.deepEqual(wing.plates.map(p=>p.name),names);
  if(names.length){assert(wing.cells.length>=3,st.id+' cells');assert(wing.platforms.length>=1,st.id+' platforms');}
 }
});
test('route lines, approach trains and overlap rings are drawn from the same state',()=>{
 const st=N.catalog.geumcheon,C=Core.forStation('geumcheon'),s=C.initial();
 C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2B-6T'});C.dispatch(s,{type:'approach',signal:'2B'});C.dispatch(s,{type:'stop',id:'2B'});
 const svg=LS.render(st,W.data.geumcheon,C,s).svg;
 assert(/data-route-state="locked"/.test(svg));assert(/data-approach-train="2B"/.test(svg));assert(/data-overlap-point="26"/.test(svg));
});
console.log(n+' ls-view tests passed');

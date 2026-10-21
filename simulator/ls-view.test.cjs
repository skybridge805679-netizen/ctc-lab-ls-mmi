const assert=require('node:assert/strict');
const N=require('./network.js'),W=require('./wiring.js'),Core=require('./core.js'),LS=require('./ls-view.js');
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
const controlled=N.stations.filter(s=>s.controlled);
test('every control station renders every signal exactly once, no image and finite size',()=>{
 for(const st of controlled){
  const C=Core.forStation(st.id),view=LS.render(st,W.data[st.id],C,C.initial(),{left:'A',right:'B'});
  assert(Number.isFinite(view.height)&&view.height>120&&view.height<1400,st.id+' height '+view.height);
  assert.equal(view.width,1600);
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
test('readable vertical lanes and the Gwanak handover retain a complete desktop diagram',()=>{
 for(const st of controlled){const d=W.data[st.id],wing=LS.wingOf(st,d),L=LS.layout(d,wing);assert(L.sy>=L.sx,st.id+' compressed vertical lanes');}
 const g=LS.wingOf(N.catalog.geumcheon,W.data.geumcheon),a=LS.wingOf(N.catalog.anyang,W.data.anyang);
 assert.deepEqual(g.plates.map(p=>p.name),['석수']);assert.deepEqual(a.plates.map(p=>p.name),['관악','명학']);
 assert(a.platforms.some(p=>p[0]<0),'Gwanak platforms must move with its plate');
 const before=LS.sceneOf(N.catalog.anyang).cells.filter(c=>c[0]<0);
 assert.equal(new Set(before.map(c=>Math.round(c[1]))).size,4,'all four Gwanak tracks are retained');
});
test('Geumcheon 4T/5T crossover has no OCR glyphs rendered as horizontal track beds',()=>{
 const cells=LS.sceneOf(N.catalog.geumcheon).cells;
 assert(!cells.some(([x,y,w,label])=>x>160&&x<220&&y>440&&y<460),'false horizontal bars inside 21/22 crossing');
 assert(cells.some(c=>c[3]==='21AT'));assert(cells.some(c=>c[3]==='21BT'));
});
test('route lines, approach trains and overlap rings are drawn from the same state',()=>{
 const st=N.catalog.geumcheon,C=Core.forStation('geumcheon'),s=C.initial();
 C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2B-6T'});C.dispatch(s,{type:'approach',signal:'2B'});C.dispatch(s,{type:'stop',id:'2B'});
 const svg=LS.render(st,W.data.geumcheon,C,s).svg;
 assert(/data-route-state="locked"/.test(svg));assert(/data-approach-train="2B"/.test(svg));assert(/data-overlap-point="26"/.test(svg));
});
test('all 654 routes update track-section state and preserve state through occupancy',()=>{
 let count=0;
 for(const st of controlled){const C=Core.forStation(st.id);for(const id of Object.keys(C.routes)){
  const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id}).ok);
  assert(LS.render(st,W.data[st.id],C,s).svg.includes('data-track-state="set"'),st.id+' '+id);
  C.dispatch(s,{type:'occupy',id});assert(LS.render(st,W.data[st.id],C,s).svg.includes('data-track-state="occupied"'),st.id+' '+id+' occupied');count++;
 }}assert.equal(count,654);
});
test('source station tracks, platforms, circuit identifiers and SP/SS symbols are vector objects',()=>{
 const details=require('./schematic-details');
 for(const st of controlled){const C=Core.forStation(st.id),svg=LS.render(st,W.data[st.id],C,C.initial()).svg;
  assert(svg.includes('data-track-section='),st.id);assert(svg.includes('data-circuit-label='),st.id);
  assert.equal((svg.match(/class="platform /g)||[]).length,LS.wingOf(st,W.data[st.id]).platforms.length,st.id);
  for(const [,,label]of details[st.id].markers)assert(svg.includes('data-source-symbol="'+label+'"'),st.id+' '+label);
 }
 const C=Core.forStation('geumjeong'),svg=LS.render(N.catalog.geumjeong,W.data.geumjeong,C,C.initial()).svg;
 assert(svg.includes('B996T'));assert(svg.includes('B995T'));
});
test('all original rail boundary identifiers remain visible or retain their adjoining-cell alias',()=>{
 for(const st of controlled){const C=Core.forStation(st.id),svg=LS.render(st,W.data[st.id],C,C.initial()).svg;
  for(const rail of W.data[st.id].rails)for(const id of [rail[2]!==null?rail[0]:null,rail[3],rail[4]].filter(Boolean))assert(svg.includes('data-circuit-label="'+id+'"')||svg.includes('data-circuit-alias="'+id+'"'),st.id+' '+id);
 }
});
console.log(n+' ls-view tests passed');

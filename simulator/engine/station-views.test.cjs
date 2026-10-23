const assert=require('node:assert/strict');
const N=require('./network');
const controlled=N.stations.filter(s=>s.controlled);
assert.equal(controlled.length,15);
for(const st of controlled){
 const [x,y,w,h]=st.map.view.bounds;
 assert.ok(w<2048&&h<768,st.id+' must have an individual screen');
 for(const [id,p]of Object.entries({...st.map.signals,...st.map.points}))
  assert.ok(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h,`${st.id} ${id} clipped`);
}
// Source-page rectangles around the intermediate labels and platforms in the supplied photos.
for(const [id,rectangles]of Object.entries({
 cheongnyangni:[[447,76,42,105]],
 dongmyo:[[539,76,45,110],[823,76,43,110],[907,76,45,110],[1024,76,43,110]],
 seoul:[[407,410,45,130]],
 guro:[[1277,250,50,130],[1352,250,46,130]]
})){
 const [x,y,w,h]=N.catalog[id].map.view.bounds;
 for(const [a,b,c,d]of rectangles)assert.ok(a>=x&&b>=y&&a+c<=x+w&&b+d<=y+h,id+' intermediate station clipped');
}
console.log('PASS all 15 individual view bounds include signals/points and photographed intermediate stations');

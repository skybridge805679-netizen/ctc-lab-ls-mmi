(function(root){
'use strict';
const details=typeof module!=='undefined'?require('./schematic-details.js'):root.SimSchematicDetails;
const switchView=typeof module!=='undefined'?require('./ls-switches.js'):root.SimLSSwitches;
const inventory=typeof module!=='undefined'?require('./wings.js'):root.SimWings;
const trainWindows=typeof module!=='undefined'?require('./train-windows.js'):root.SimTrainWindows;
const fixedSymbols=typeof module!=='undefined'?require('./fixed-symbols.js'):root.SimFixedSymbols;
const windowLayouts=new WeakMap();
const WIDTH=1600,BAR=18,PADDING=30;
const COLORS={set:'#35dc82',occupied:'#ff5c50',locked:'#ffbd55'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dpath=points=>'M'+points.map(p=>p.join(' ')).join('L');
const mean=(points,axis)=>points.reduce((a,p)=>a+p[axis],0)/points.length;
function railY(def,id,x){
 const poly=def.rails.find(r=>r[0]===id)[1];
 for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i];
  if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&a[0]!==b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
 }
 return poly[0][1];
}
// 관악 belongs to the Anyang screen. Move its complete source strip, retaining the source registration.
const GWANAK={cut:1496,dx:-1607.4,dy:108.8};
function sourceSceneOf(st){
 const data=details[st.id];if(!['geumcheon','anyang'].includes(st.id))return data;
 const g=details.geumcheon,{cut,dx,dy}=GWANAK;
 if(st.id==='geumcheon')return {...data,cells:data.cells.filter(c=>c[0]<cut).map(([x,y,w,label])=>[x,y,Math.min(w,cut-x),label]),capsules:data.capsules.filter(c=>c[0]<cut)};
 return {...data,cells:[...data.cells.filter(c=>c[0]>=109),...g.cells.filter(c=>c[0]+c[2]>cut).map(([x,y,w,label])=>[Math.max(x,cut)+dx,y+dy,x+w-Math.max(x,cut),label])],capsules:[...data.capsules,...g.capsules.filter(c=>c[0]>=cut).map(([x,y,...rest])=>[x+dx,y+dy,...rest])]};
}
function sceneOf(st){
 const data=sourceSceneOf(st);let cells=data.cells;
 for(const [x,y]of data.ignoreCells||[])cells=cells.filter(c=>Math.abs(c[0]-x)>1||Math.abs(c[1]-y)>2);
 for(const strip of data.strips||[]){
  const {left,right,y,codes}=strip,next=[];
  for(const c of cells){
   const [x,row,w,label]=c;if(Math.abs(row-y)>6||x+w<=left||x>=right){next.push(c);continue;}
   if(x<left)next.push([x,row,left-x,label]);if(x+w>right)next.push([right,row,x+w-right,label]);
  }
  const w=(right-left)/codes.length;
  codes.forEach((label,i)=>next.push([left+i*w,y,w-2,label]));cells=next;
 }
 return {...data,cells:cells.filter(c=>c[2]>=2)};
}
function wingOf(st,def){
 const original=inventory[st.id],data=sceneOf(st),{cut,dx,dy}=GWANAK;
 const move=([a,b,c,d,...rest])=>[a+dx,b+dy,c+dx,d+dy,...rest];
 const source=st.id==='geumcheon'?{...original,plates:original.plates.filter(p=>p[0]<cut),platforms:original.platforms.filter(p=>p[0]<cut)}:st.id==='anyang'?{...original,plates:[inventory.geumcheon.plates.find(p=>p[0]>=cut)].map(move).concat(original.plates),platforms:inventory.geumcheon.platforms.filter(p=>p[0]>=cut).map(move).concat(original.platforms.filter(p=>p[0]>=0))}:original;
 const xs=def.rails.flatMap(r=>r[1].map(p=>p[0]));
 const lo=Math.min(...xs),hi=Math.max(...xs),outside=x=>x<lo-1||x>hi+1;
 const minY=Math.min(...def.rails.flatMap(r=>r[1].map(p=>p[1]))),band=y=>y>=minY-60;
 const [bx,by,bw,bh]=st.map.view.bounds,[ox,oy,rw,rh]=st.map.referenceWindow,[iw,ih]=def.size;
 const inside=(x,y)=>{const px=ox+x*rw/iw,py=oy+y*rh/ih;return px>=bx&&px<=bx+bw&&py>=by&&py<=by+bh;};
 const plates=[...source.plates].sort((a,b)=>a[0]-b[0]);
 return {
  fixed:fixedSymbols[st.id]||{brackets:[],captions:[]},
  markers:data.markers,
  cells:data.cells.filter(c=>outside(c[0]+c[2]/2)),
  diags:source.diags.filter(p=>inside(mean(p,0),mean(p,1))&&band(mean(p,1))&&(Math.max(...p.map(q=>q[0]))>hi+1||Math.min(...p.map(q=>q[0]))<lo-1)),
  platforms:source.platforms.filter(p=>(inside((p[0]+p[2])/2,(p[1]+p[3])/2)||(st.id==='anyang'&&p[0]<0))&&band((p[1]+p[3])/2)),
  plates:plates.map((box,i)=>({box,name:st.map.view.intermediate[i]||''})),
  labels:source.labels.filter(p=>inside(p[0],p[1])&&outside(p[0])&&band(p[1])&&!def.signals.some(s=>s[0]===p[2].replace(/^0+/,''))),
  signals:source.signals.filter(p=>inside(p[0],p[1])&&outside(p[0])&&band(p[1]))
 };
}
function layout(def,wing){
 const xs=[],ys=[];
 for(const rail of def.rails)for(const [x,y]of rail[1]){xs.push(x);ys.push(y);}
 for(const signal of def.signals)ys.push(signal[3]);
 for(const [x,y,w]of wing.cells){xs.push(x,x+w);ys.push(y);}
 for(const poly of wing.diags)for(const [x,y]of poly){xs.push(x);ys.push(y);}
 for(const p of wing.platforms){xs.push(p[0],p[2]);ys.push(p[1],p[3]);}
 for(const p of wing.plates)xs.push(p.box[0],p.box[2]);
 for(const s of wing.signals){xs.push(s[0]);ys.push(s[1]);}
 for(const [x,y]of wing.markers||[]){xs.push(x-14,x+14);}
 for(const b of wing.fixed?.brackets||[]){const [x,y,w,h]=b.bounds;xs.push(x,x+w);ys.push(y,y+h);}
 for(const c of wing.fixed?.captions||[]){xs.push(c.at[0]-55,c.at[0]+55);ys.push(c.at[1]-10,c.at[1]+10);}
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 // Use vertical desktop space for readable rail and signal lanes; preserve every connection.
 const railRows=[...new Set(def.rails.flatMap(r=>r[1].slice(1).filter((p,i)=>Math.abs(p[1]-r[1][i][1])<2).map(p=>p[1])))].sort((a,b)=>a-b);
 const pitches=railRows.slice(1).map((y,i)=>y-railRows[i]).filter(d=>d>=20);
 const pitch=Math.min(...pitches,80);
 const sx=(WIDTH-2*PADDING)/(maxX-minX),sy=Math.max(sx,80/pitch);
 // Reserve the original broad scissors footprint after increasing the rail spacing.
 // One monotone X transform moves rails, cells, signals and active routes together.
 const spans=def.links.filter(([id,a,x,b,z])=>def.links.some(([other,c,u,d,v])=>other!==id&&a===d&&b===c&&Math.abs(x-u)<5&&Math.abs(z-v)<5)).map(([,a,x,b,z])=>[Math.min(x,z),Math.max(x,z)]);
 const knots=[...new Set([minX,maxX,...spans.flat()])].sort((a,b)=>a-b);
 const weights=knots.slice(1).map((x,i)=>{const lo=knots[i],mid=(x+lo)/2,span=spans.find(([a,b])=>mid>=a&&mid<=b);return span?Math.max(1,100/((span[1]-span[0])*sx)):1;});
 const cumulative=[0];weights.forEach((w,i)=>cumulative.push(cumulative.at(-1)+(knots[i+1]-knots[i])*w));
 const xAt=x=>{let i=0;while(i<weights.length-1&&x>knots[i+1])i++;return PADDING+(cumulative[i]+(x-knots[i])*weights[i])*(WIDTH-2*PADDING)/cumulative.at(-1);};
 const top=140,yAt=y=>top+(y-minY)*sy;
 return {sx,sy,H:Math.max(460,Math.ceil(yAt(maxY)+72)),pt:([x,y])=>[+xAt(x).toFixed(2),+yAt(y).toFixed(2)]};
}
function intersects(a,b,gap=3){return a[0]<b[2]+gap&&a[2]>b[0]-gap&&a[1]<b[3]+gap&&a[3]>b[1]-gap;}
function render(st,def,core,model,neighbours={}){
 const data=sceneOf(st),wing=wingOf(st,def),L=layout(def,wing),T=L.pt;
 const [ox,oy,rw,rh]=st.map.referenceWindow,[iw,ih]=def.size;
 const toLocal=(x,y)=>[(x-ox)*iw/rw,(y-oy)*ih/rh];
 const routePoints=path=>{const values=path.match(/-?\d+(?:\.\d+)?/g).map(Number),out=[];for(let i=0;i<values.length;i+=2)out.push(T(toLocal(values[i],values[i+1])));return out;};
 const rows=def.rails.flatMap(r=>r[1].slice(1).filter((p,i)=>Math.abs(p[1]-r[1][i][1])<2).map(p=>p[1]));
 // One coordinate model for the throat and all adjoining cells. Extraction drift is snapped to the same centreline.
 const cells=data.cells.map((source,index)=>{
  let [x,y,w,label]=source;
  const nearby=rows.filter(row=>Math.abs(row-y)<6).sort((a,b)=>Math.abs(a-y)-Math.abs(b-y));
  if(nearby.length)y=nearby[0];
  const [X,Y]=T([x,y]);return {index,source,x:X,y:Y,width:T([x+w,y])[0]-X,label};
 });
 // Fixed source symbols use the same transform as rails; they never mutate interlocking state.
 const bracketBoxes=wing.fixed.brackets.map(b=>{const [x,y,w,h]=b.bounds,a=T([x,y]),z=T([x+w,y+h]);return {...b,box:[...a,...z]};});
 const captionBoxes=wing.fixed.captions.map(c=>{const [x,y]=T(c.at),w=Math.max(...c.lines.map(t=>t.length))*14+12,h=c.lines.length*22;return {...c,x,y,box:[x-w/2,y-h/2,x+w/2,y+h/2]};});
 const fixedObstacles=[...bracketBoxes.map(b=>b.box),...captionBoxes.map(c=>c.box)];
 const switches=switchView.build(st,def,core,model,T);
 const projectRoute=(points,destination)=>{
  const out=[points[0]],near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.1;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],c=switches.connectors.find(c=>c.kind==='scissors'&&((near(a,c.endpoints[0])&&near(b,c.endpoints[1]))||(near(a,c.endpoints[1])&&near(b,c.endpoints[0]))));
   if(c){const shape=near(a,c.endpoints[0])?c.fullPoints:[...c.fullPoints].reverse();out.push(...shape.slice(1).map(p=>[...p]));}else out.push(b);
  }
  // Stop at the named boundary section, rather than painting adjoining intermediate blocks.
  if(/^B\d{3,4}T(?:[12]T)?$/.test(destination)&&out.length>1){
   const a=out.at(-2),b=out.at(-1);
   if(Math.abs(a[1]-b[1])<.1)for(const c of cells.filter(c=>c.label.replaceAll(' · ','')===destination&&Math.abs(c.y-b[1])<6)){
    if(b[0]>a[0]&&c.x+c.width>a[0]&&c.x+c.width<b[0])b[0]=c.x+c.width;
    else if(b[0]<a[0]&&c.x<a[0]&&c.x>b[0])b[0]=c.x;
   }
  }return out;
 };
 const active=Object.entries(model.routes).map(([id,state])=>({id,state:state.occupied?'occupied':state.lock?'locked':'set',points:projectRoute(routePoints(core.routes[id].path),core.routes[id].destination)}));
 const onRoute=cell=>active.find(route=>route.points.slice(1).some((b,i)=>{const a=route.points[i];return Math.abs(a[1]-b[1])<.5&&Math.abs(a[1]-cell.y)<5&&Math.min(a[0],b[0])<cell.x+cell.width-2&&Math.max(a[0],b[0])>cell.x+2;}));
 const paths=[...def.rails.map(r=>r[1].map(T)),...(data.joins||[]).map(poly=>poly.map(T))];
 const pointAnchors={};
 for(const [id,a,x,b,z]of def.links){const p=T([x,railY(def,a,x)]),q=T([z,railY(def,b,z)]);pointAnchors[id]=[(p[0]+q[0])/2,(p[1]+q[1])/2];}
 // Adjacent source cells form continuous rail runs; circuit boundaries are drawn once as ticks, never nested boxes.
 const cellRows=[];
 for(const cell of cells){let row=cellRows.find(r=>Math.abs(r.y-cell.y)<3);if(!row){row={y:cell.y,cells:[]};cellRows.push(row);}row.cells.push(cell);}
 const boundaries=[];
 for(const row of cellRows){
  row.cells.sort((a,b)=>a.x-b.x);let start=row.cells[0].x,end=start+row.cells[0].width;
  for(let i=0;i<row.cells.length;i++){
   const c=row.cells[i],previous=row.cells[i-1];
   if(i&&c.x-end>10){paths.push([[start,row.y],[end,row.y]]);start=c.x;}
   if(previous&&Math.abs(c.x-(previous.x+previous.width))<10)boundaries.push([(c.x+previous.x+previous.width)/2,row.y]);
   end=Math.max(i?end:0,c.x+c.width);
  }
  paths.push([[start,row.y],[end,row.y]]);
 }
 let platforms='',rails='',sections='',labels='',routes='',symbols='',plates='',pointSymbols='',signalSymbols='',trains='',leaders='',annotations='';
 const occupiedBoxes=fixedObstacles.map(b=>[...b]);
 let trainShapes='';
 let cached=windowLayouts.get(def)?.get(st.id);
 if(!cached){
 const windowBoxes=[];
 const obstacles=[...fixedObstacles,...cells.map(c=>[c.x,c.y-BAR/2,c.x+c.width,c.y+BAR/2]),...wing.platforms.map(p=>{const a=T([p[0],p[1]]),b=T([p[2],p[3]]);return [a[0],a[1],b[0],a[1]+Math.max(8,b[1]-a[1])];}),...def.signals.map(([id,rail,x,y,dir])=>{const [X,Y]=T([x,y]);return [X-40,Y-11,X+40,Y+11];})];
 const capsulePositions=[];
 for(const [x,y]of data.capsules){
  if(!data.cells.some(c=>Math.abs(c[1]-y)<30&&x>=c[0]-8&&x<=c[0]+c[2]+8)||def.signals.some(s=>Math.abs(s[2]-x)<22&&Math.abs(s[3]-y)<14))continue;
  const [X,rawY]=T([x,y]),near=cells.filter(c=>X>=c.x-8&&X<=c.x+c.width+8).sort((a,b)=>Math.abs(a.y-rawY)-Math.abs(b.y-rawY))[0];
  const Y=near&&Math.abs(near.y-rawY)<Math.max(17,L.sy*30)?near.y+(rawY<near.y?-17:17):rawY;
  capsulePositions.push([X,Y]);obstacles.push([X-8,Y-5,X+11,Y+5]);
 }
 for(const item of trainWindows.data[st.id]||[]){
  const code=item.anchorCode||item.code,inline=item.side==='inline';
  const cell=cells.find(c=>c.label.split(' · ').includes(code)||c.label.replaceAll(' · ','')===code);
  const rail=def.rails.find(r=>r[0]===code||r[3]===code||r[4]===code);
  let cx,cy;
  if(inline&&rail?.[0]===code){[cx,cy]=T([rail[2]??(rail[1][0][0]+rail[1].at(-1)[0])/2,railY(def,code,rail[2]??rail[1][0][0])]);}
  else if(cell){cx=cell.x+cell.width*item.fraction;cy=cell.y;}
  else if(rail){const p=rail[3]===code?rail[1][0]:rail[4]===code?rail[1].at(-1):[rail[2],railY(def,rail[0],rail[2])];[cx,cy]=T(p);cx+=rail[3]===code?42:rail[4]===code?-42:0;}
  else throw new Error(st.id+' train window anchor missing: '+code);
  const width=inline?100:80,height=inline?28:20;
  const x=Math.max(4,Math.min(WIDTH-width-4,cx-width/2)),y=cy+(inline?-height/2:item.side==='above'?-50:30);
  windowBoxes.push({item,inline,x,y,width,height,cy});
 }
 // A shared baseline for each rail/side prevents staircase placement. Reserve signals and platforms first.
 const windowTop=Math.min(...paths.flat().map(p=>p[1]));
 for(const plate of wing.plates){const [a]=T([plate.box[0],0]),[b]=T([plate.box[2],0]),x=(a+b)/2,w=Math.max(b-a,plate.name.length*16+18);obstacles.push([x-w/2,windowTop-130,x+w/2,windowTop-105]);}
 for(const [x,y,kind]of data.markers){const [X]=T([x,y]),Y=Math.max(44,windowTop-44,T([x,y])[1]);obstacles.push([X-17,Y-26,X+17,Y+26]);}
 const windowLanes=new Map();for(const b of windowBoxes.filter(b=>!b.inline)){const key=b.cy.toFixed(0)+b.item.side;if(!windowLanes.has(key))windowLanes.set(key,[]);windowLanes.get(key).push(b);}
 for(const lane of windowLanes.values()){let best;for(const dy of (Array.from({length:41},(_,i)=>lane[0].item.side==='above'?-28-i*2:20+i*2))){let cost=0,choices=[];for(const b of lane){let chosen;for(const width of [80,64,56,48])for(const dx of [0,-8,8,-16,16,-24,24,-32,32]){const x=Math.max(4,Math.min(WIDTH-width-4,b.x+(b.width-width)/2+dx)),y=b.cy+dy,box=[x,y,x+width,y+20],hits=[...obstacles,...choices.map(c=>[c.x,c.y,c.x+c.width,c.y+20]),...lane.filter(other=>other!==b).map(other=>[other.x+other.width/2-24,y,other.x+other.width/2+24,y+20])].filter(o=>intersects(box,o,.6)).length;const score=hits*10000+(80-width)+Math.abs(dx)*2;if(!chosen||score<chosen.cost)chosen={x,y,width,cost:score};}cost+=chosen.cost;choices.push(chosen);}cost+=Math.abs(dy-(lane[0].item.side==='above'?-50:30));if(!best||cost<best.cost)best={cost,choices};}lane.forEach((b,i)=>{Object.assign(b,best.choices[i]);obstacles.push([b.x,b.y,b.x+b.width,b.y+b.height]);});}
 cached={windowBoxes,capsulePositions};if(!windowLayouts.has(def))windowLayouts.set(def,new Map());windowLayouts.get(def).set(st.id,cached);
 }
 const {windowBoxes,capsulePositions}=cached;
 for(const {item,inline,x,y,width,height,cy}of windowBoxes){
  occupiedBoxes.push([x-3,y-3,x+width+3,y+height+3]);
  trainShapes+=`<g class="ls-train-slot ${inline?'inline':'detached'}" data-train-slot="${esc(item.slot)}" data-window-code="${esc(item.code)}" data-window-side="${item.side}" data-window-rail-y="${cy}" role="button" tabindex="0" aria-label="${esc(item.code)} 열차번호 입력"><rect x="${x}" y="${y}" width="${width}" height="${height}"/><title>${esc(item.code)} 열차번호 입력</title></g>`;
 }

 for(const p of wing.platforms){
  const [x,y]=T([p[0],p[1]]),[right,bottom]=T([p[2],p[3]]);
  platforms+=`<rect class="platform ${p[4]==='c'?'cyan':'orange'}" x="${x}" y="${y}" width="${right-x}" height="${Math.max(8,bottom-y)}" rx="2"/>`;
  occupiedBoxes.push([x-3,y-3,right+3,bottom+3]);
 }
 for(const points of paths)rails+=`<path d="${dpath(points)}"/>`;
 for(const polygon of (data.joins?.length?[]:wing.diags))rails+=`<polygon class="rail-join" points="${polygon.map(p=>T(p).join(',')).join(' ')}"/>`;
 for(const c of cells){
  const state=onRoute(c)?.state||'clear';
  sections+=`<g class="track-cell ${state}" data-track-section="${st.id}-${c.index}" data-track-circuit="${esc(c.label)}" data-track-state="${state}"><rect class="cell-bed" x="${c.x}" y="${c.y-BAR/2}" width="${c.width}" height="${BAR}"/><title>${esc(c.label||'원본 무기명 구간')} · ${state}</title></g>`;
  const atomic=c.label.replaceAll(' · ','');
  const tokens=/^B\d{3,4}T[12]T$/.test(atomic)?[atomic]:c.label.split(' · ').filter(Boolean);
  tokens.forEach((label,i)=>{
   let x=c.x+c.width*(i+.5)/tokens.length;const width=c.width/tokens.length;
   if(trainWindows.data[st.id]?.some(w=>w.side==='inline'&&w.code===label)){const box=occupiedBoxes.find(b=>x>b[0]&&x<b[2]&&c.y>b[1]&&c.y<b[3]);if(box)x=box[2]+label.length*3.6+4;}
   const fit=label.length*7.2>width-6?` textLength="${Math.max(12,width-6)}" lengthAdjust="spacingAndGlyphs"`:'';
   labels+=`<text class="cell-name" data-circuit-label="${esc(label)}" x="${x}" y="${c.y+4.3}" text-anchor="middle"${fit}>${esc(label)}</text>`;
   occupiedBoxes.push([x-Math.min(width-3,label.length*7)/2,c.y-8,x+Math.min(width-3,label.length*7)/2,c.y+8]);
  });
 }
 // Source aliases such as B615T1T represent adjoining identifiers, not an extra overlapping label.
 const hasName=name=>cells.some(c=>c.label.split(' · ').includes(name)||c.label.replaceAll(' · ','')===name);
 const addRailName=(name,anchor,poly,offset=0)=>{
  if(!name||hasName(name))return;
  const [baseX,y]=T(anchor),width=name.length*7.2+6;
  const intervals=poly.slice(1).flatMap((p,i)=>{const a=T(poly[i]),b=T(p);return Math.abs(a[1]-b[1])<2&&Math.abs(y-a[1])<2?[[Math.min(a[0],b[0]),Math.max(a[0],b[0])]]:[];});
  let x=baseX+offset;
  const deltas=[0];for(let d=6;d<WIDTH;d+=6)deltas.push(-d,d);
  for(const dx of deltas){const candidate=baseX+offset+dx,box=[candidate-width/2,y-8,candidate+width/2,y+8];if(!intervals.some(([a,b])=>box[0]>a+2&&box[2]<b-2))continue;if(!occupiedBoxes.some(o=>intersects(box,o,3))){x=candidate;break;}}
  labels+=`<text class="rail-name" data-circuit-label="${esc(name)}" x="${x}" y="${y+4.3}" text-anchor="middle">${esc(name)}</text>`;
  occupiedBoxes.push([x-width/2,y-8,x+width/2,y+8]);
 };
 for(const [id,poly,target,left,right]of def.rails){
  if(target!==null)addRailName(id,[target,railY(def,id,target)],poly);
  addRailName(left,poly[0],poly,42);addRailName(right,poly.at(-1),poly,-42);
  for(const name of [left,right])if(name&&cells.some(c=>c.label.replaceAll(' · ','')===name))labels+=`<g data-circuit-alias="${esc(name)}"><title>${esc(name)}</title></g>`;
 }
 for(const route of active)routes+=`<path class="route-line ${route.state}" data-active-route="${esc(route.id)}" data-route-station="${st.id}" data-route-state="${route.state}" stroke="${COLORS[route.state]}" d="${dpath(route.points)}" ${route.state==='locked'?'stroke-dasharray="14 8"':''}/>`;
 // FTS: a circuit holding a train (its number stands in that 열번창) is shown red and follows the train as the number moves
 const occupiedNow=neighbours.occupied||new Set(),hitCells=new Map();
 for(const c of cells){const names=[c.label.replaceAll(' · ',''),...c.label.split(' · ').filter(Boolean)],hit=names.find(t=>occupiedNow.has(t));if(hit)hitCells.set(c,hit);}
 // a platform window stands on an unnamed circuit: use the cell under the window
 const stubs=[];
 for(const b of windowBoxes)if(b.inline&&occupiedNow.has(b.item.slot)){const mid=b.x+b.width/2,c=cells.find(c=>Math.abs(c.y-b.cy)<5&&mid>=c.x-1&&mid<=c.x+c.width+1);
  if(c&&!hitCells.has(c))hitCells.set(c,{name:b.item.slot,x:Math.max(c.x,b.x-9),width:Math.min(c.x+c.width,b.x+b.width+9)-Math.max(c.x,b.x-9)});
  else if(!c)stubs.push({name:b.item.slot,x:b.x-9,y:b.cy,width:b.width+18});}       // rail drawn as a plain path: red either side of the window
 for(const t of stubs)routes+=`<rect class="train-occ" data-train-occupied="${esc(t.name)}" x="${t.x}" y="${t.y-BAR/2}" width="${t.width}" height="${BAR}"/>`;
 for(const [c,hit] of hitCells){const named=typeof hit==='string';routes+=`<rect class="train-occ" data-train-occupied="${esc(named?hit:hit.name)}" x="${named?c.x:hit.x}" y="${c.y-BAR/2}" width="${named?c.width:hit.width}" height="${BAR}"/>`;}
 for(const [x,y]of boundaries)symbols+=`<path class="circuit-boundary" d="M${x} ${y-BAR/2}V${y+BAR/2}"/>`;
 const topRow=Math.min(...paths.flat().map(p=>p[1]));
 for(const plate of wing.plates){
  const [left]=T([plate.box[0],0]),[right]=T([plate.box[2],0]),x=(left+right)/2,width=Math.max(right-left,plate.name.length*16+18);
  // Station names have their own upper band; train-number windows stay on straight row baselines.
  const y=topRow-130;
  plates+=`<g class="inter-station" data-inter-station="${esc(plate.name)}"><rect class="plate" x="${x-width/2}" y="${y}" width="${width}" height="25" rx="3"/><text class="plate-name" x="${x}" y="${y+18}" text-anchor="middle">${esc(plate.name)}</text><title>${esc(plate.name)} · 관할 중간역</title></g>`;
  occupiedBoxes.push([x-width/2-3,y-4,x+width/2+3,y+36]);
 }
 for(const [x,y,label]of data.markers){
  const [X]=T([x,y]),Y=Math.max(44,topRow-44,T([x,y])[1]);
  symbols+=`<g data-source-symbol="${label}">${label==='SP'?`<path d="M${X-13} ${Y-23}H${X+13}L${X} ${Y}Z" class="sp-board"/><text x="${X}" y="${Y-10}" class="board-label" text-anchor="middle">SP</text>`:`<rect x="${X-9}" y="${Y-23}" width="18" height="28" class="ss-board"/><path d="M${X-8} ${Y+3}L${X+8} ${Y-21}" class="ss-stripe"/><text x="${X}" y="${Y-29}" class="board-label" text-anchor="middle">SS</text>`}<title>원본 ${label} 표지</title></g>`;
  occupiedBoxes.push([X-16,Y-38,X+16,Y+6]);
 }
 for(const b of bracketBoxes){
  const [x,y,right,bottom]=b.box,w=(right-x)*.30,t=Math.min(2.5,w*.45);
  const shape=(a,dir)=>dpath([[a,y],[a+dir*w,y],[a+dir*w,bottom],[a,bottom],[a,bottom-t],[a+dir*(w-t),bottom-t],[a+dir*(w-t),y+t],[a,y+t]])+'Z';
  symbols+=`<g class="source-bracket-pair" data-source-symbol="bracket-pair" data-source-bracket="${esc(b.id)}" pointer-events="none"><path d="${shape(x,1)}"/><path d="${shape(right,-1)}"/><title>원본 대향 괄호 표식 · ${esc(b.id)}</title></g>`;
 }
 for(const c of captionBoxes){
  annotations+=`<g class="source-caption" data-source-caption="${esc(c.id)}" pointer-events="none">${c.lines.map((line,i)=>`<text x="${c.x}" y="${c.y+(i-(c.lines.length-1)/2)*22}" dominant-baseline="central" text-anchor="middle">${esc(line)}</text>`).join('')}</g>`;
 }
 for(const [X,Y]of capsulePositions)symbols+=`<g data-source-symbol="capsule"><path class="capsule" d="M${X-7} ${Y}h14"/><path class="capsule-stop" d="M${X+10} ${Y-4}v8"/><title>원본 캡슐 표시</title></g>`;
 const segments=[...paths.flatMap(poly=>poly.slice(1).map((p,i)=>[poly[i],p])),...def.links.map(([,a,x,b,z])=>[T([x,railY(def,a,x)]),T([z,railY(def,b,z)])])];
 const touchesRail=box=>segments.some(([a,b])=>{
  const r=[box[0]-BAR/2-1,box[1]-BAR/2-1,box[2]+BAR/2+1,box[3]+BAR/2+1];
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++){
   const delta=b[axis]-a[axis];
   if(Math.abs(delta)<.01){if(a[axis]<r[axis]||a[axis]>r[axis+2])return false;continue;}
   const t1=(r[axis]-a[axis])/delta,t2=(r[axis+2]-a[axis])/delta;
   lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;
  }
  return true;
 });
 // Each signal stays at its surveyed mast and lamp coordinates. Paired signals retain their source stack.
 const placed=def.signals.map(([id,rail,x,lampY,dir])=>{const railLocal=railY(def,rail,x),[X,Y]=T([x,railLocal]);return {id,rail,dir,lampY,railLocal,X,Y,anchorX:X,side:Math.sign(lampY-railLocal||1)};});
 for(const s of placed){
  const {id,dir,Y,anchorX}=s,X=anchorX,kind=core.signals[id].kind;
  const LY=T([0,s.lampY])[1],lampX=X+dir*18;
  const go=model.signals[id]==='GO',locked=Object.entries(model.routes).some(([rid,r])=>r.lock&&core.routes[rid].signal===id);
  const shape=`<rect class="signal-body" x="${Math.min(X,lampX)-3}" y="${LY-7}" width="28" height="14" rx="7"/><circle class="lamp ${go?'go':'stop'} ${locked?'lock':''}" cx="${lampX}" cy="${LY}" r="6"/>`;
  const box=dir===1?[X-30,LY-8,X+25,LY+8]:[X-25,LY-8,X+30,LY+8];
  occupiedBoxes.push(dir===1?[X-8-id.length*7.5,LY-8,X+23,LY+8]:[X-23,LY-8,X+8+id.length*7.5,LY+8]);
  signalSymbols+=`<g class="signal ${kind==='입환'?'shunt':'main'}" data-signal-view="${id}" data-anchor-x="${X}" data-lamp-y="${LY}"><path class="mast" d="M${X} ${Y+s.side*7}V${LY}H${lampX}"/>${shape}<circle class="mast-foot" cx="${X}" cy="${LY}" r="3"/><text class="sig-name" data-label-kind="signal" data-label-id="${id}" x="${X-dir*8}" y="${LY+3.5}" text-anchor="${dir===1?'end':'start'}">${id}</text><g class="signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${esc(st.name)} ${id} ${kind}신호기"><rect x="${box[0]}" y="${LY-8}" width="${box[2]-box[0]}" height="16" fill="transparent"/><title>${id} ${kind}신호기</title></g></g>`;
  if(model.approach?.[id]){
   const x=anchorX-dir*46;trains+=`<g class="approach-train" data-approach-train="${id}"><rect x="${x-24}" y="${Y-10}" width="48" height="20" rx="3"/><text x="${x}" y="${Y+5}" text-anchor="middle">열차</text></g>`;
  }
 }
 const takeLabel=(text,anchor,kind,id,preferred=anchor)=>{
  // Resolve dense labels locally only. Never detach an annotation from its turnout.
  const width=text.length*7+2;
  preferred=[Math.max(20,Math.min(WIDTH-20,preferred[0])),Math.max(20,Math.min(L.H-20,preferred[1]))];
  let [x,y]=preferred;
  const offsets=[[0,0]];
  for(let d=12;d<=36;d+=12)offsets.push([d,0],[-d,0],[0,-d],[0,d],[d,-12],[-d,-12],[d,12],[-d,12]);
  for(const [dx,dy]of offsets){
   const xx=preferred[0]+dx,yy=preferred[1]+dy,box=[xx-width/2,yy-7,xx+width/2,yy+7];
   if(xx<width/2+8||xx>WIDTH-width/2-8)continue;
   if(!occupiedBoxes.some(o=>intersects(box,o,1))&&!touchesRail(box)){x=xx;y=yy;break;}
  }
  occupiedBoxes.push([x-width/2,y-7,x+width/2,y+7]);
  return {x,y,svg:`<text class="annotation ${kind}" data-label-kind="${kind}" data-label-id="${esc(id)}" x="${x}" y="${y+3.5}" text-anchor="middle">${esc(text)}</text>`};
 };
 const overlapPoints=new Set(Object.keys(model.routes).flatMap(id=>Object.keys(core.overlapOf(id)?.points||{})));
 // Switch identifiers and source A/B part identifiers use the same placement solver.
 for(const [id,pos]of Object.entries(core.points)){
  const anchor=pointAnchors[id]||T(toLocal(pos.x,pos.y)),R=model.points[id]==='R',locked=model.blockedPoints.includes(id);
  const surveyed=inventory[st.id].labels.filter(p=>p[2]===id).map(p=>T(p)).filter(p=>p[0]>=12&&p[0]<=WIDTH-12&&p[1]>=16&&p[1]<=L.H-16).sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]))[0];
  const scissors=switches.connectors.find(c=>c.id===id&&c.kind==='scissors');
  const preferred=scissors?[scissors.endpoints[0][0]+(scissors.endpoints[1][0]-scissors.endpoints[0][0])*.25,scissors.endpoints[0][1]+(scissors.endpoints[0][1]<scissors.endpoints[1][1]?-24:24)]:surveyed||[anchor[0],anchor[1]-13];
  const label=takeLabel(id,anchor,'point',id,preferred);
  pointSymbols+=`<g class="point-tag ${R?'rev':''} ${locked?'locked':''}" data-point-label="${id}">${label.svg}<title>${id} · ${R?'반위':'정위'}${locked?' · 수동 쇄정':''}</title></g>`;
  if(overlapPoints.has(id))pointSymbols+=`<circle class="overlap-ring" data-overlap-point="${id}" cx="${label.x}" cy="${label.y}" r="18"/>`;
 }
 const xs=def.rails.flatMap(r=>r[1].map(p=>p[0])),lo=Math.min(...xs),hi=Math.max(...xs);
 const partLabels=inventory[st.id].labels.filter(p=>/^\d{2}[AB]$/.test(p[2])&&p[0]>=lo&&p[0]<=hi);
 const seen=new Set();
 for(const item of [...wing.labels,...partLabels]){
  const key=item.join('|');if(seen.has(key))continue;seen.add(key);
  const anchor=T(item);annotations+=takeLabel(item[2],anchor,'part',key).svg;
 }
 for(const [x,y,id,dir]of wing.signals){if(def.signals.some(s=>s[0]===id.replace(/^0+/,'')))continue;const [X,Y]=T([x,y]);signalSymbols+=`<g class="signal wing" data-wing-signal="${esc(id)}"><path class="mast" d="M${X} ${Y}h${dir*12}"/><circle class="lamp stop" cx="${X}" cy="${Y}" r="7"/><text class="sig-name" x="${X-dir*13}" y="${Y+5}" text-anchor="${dir===1?'end':'start'}">${esc(id)}</text></g>`;}
 const edgeY=topRow-28;
 if(neighbours.left)plates+=`<text class="nb-tag" x="12" y="${edgeY}" text-anchor="start">◀ ${esc(neighbours.left)}</text>`;
 if(neighbours.right)plates+=`<text class="nb-tag" x="${WIDTH-12}" y="${edgeY}" text-anchor="end">${esc(neighbours.right)} ▶</text>`;
 return {width:WIDTH,height:L.H,svg:`${switches.mask}${platforms}<g class="track-shape" mask="url(#${switches.maskId})"><g class="bed-inner rail-network">${rails}</g><g class="wing-inner section-network">${sections}</g></g><g class="switch-network">${switches.svg}${switches.metadata}</g>${routes}${symbols}${labels}${plates}${leaders}${annotations}${pointSymbols}${signalSymbols}${trains}${trainShapes}`};
}
const api={render,layout,wingOf,sceneOf};
if(typeof module!=='undefined')module.exports=api;else root.SimLS=api;
})(typeof window!=='undefined'?window:globalThis);

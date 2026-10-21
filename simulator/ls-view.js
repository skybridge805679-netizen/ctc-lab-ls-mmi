(function(root){
'use strict';
const details=typeof module!=='undefined'?require('./schematic-details.js'):root.SimSchematicDetails;
const switchView=typeof module!=='undefined'?require('./ls-switches.js'):root.SimLSSwitches;
const inventory=typeof module!=='undefined'?require('./wings.js'):root.SimWings;
const WIDTH=1600,BAR=14,PADDING=30;
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
function sceneOf(st){
 const data=details[st.id];if(!['geumcheon','anyang'].includes(st.id))return data;
 const g=details.geumcheon,{cut,dx,dy}=GWANAK;
 if(st.id==='geumcheon')return {...data,cells:data.cells.filter(c=>c[0]<cut).map(([x,y,w,label])=>[x,y,Math.min(w,cut-x),label]),capsules:data.capsules.filter(c=>c[0]<cut)};
 return {...data,cells:[...data.cells.filter(c=>c[0]>=109),...g.cells.filter(c=>c[0]+c[2]>cut).map(([x,y,w,label])=>[Math.max(x,cut)+dx,y+dy,x+w-Math.max(x,cut),label])],capsules:[...data.capsules,...g.capsules.filter(c=>c[0]>=cut).map(([x,y,...rest])=>[x+dx,y+dy,...rest])]};
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
  markers:data.markers,
  cells:data.cells.filter(c=>outside(c[0]+c[2]/2)),
  diags:source.diags.filter(p=>inside(mean(p,0),mean(p,1))&&band(mean(p,1))&&(Math.max(...p.map(q=>q[0]))>hi+1||Math.min(...p.map(q=>q[0]))<lo-1)),
  platforms:source.platforms.filter(p=>(inside((p[0]+p[2])/2,(p[1]+p[3])/2)||(st.id==='anyang'&&p[0]<0))&&band((p[1]+p[3])/2)),
  plates:plates.map((box,i)=>({box,name:st.map.view.intermediate[i]||''})),
  labels:source.labels.filter(p=>inside(p[0],p[1])&&outside(p[0])&&band(p[1])),
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
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 // Preserve the source aspect ratio: independent Y expansion turns crossovers into floating steep bars.
 const sx=(WIDTH-2*PADDING)/(maxX-minX),sy=sx;
 const top=110;
 const yAt=y=>top+(y-minY)*sy;
 return {sx,sy,H:Math.max(420,Math.ceil(yAt(maxY)+110)),pt:([x,y])=>[+(PADDING+(x-minX)*sx).toFixed(2),+yAt(y).toFixed(2)]};
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
  const [X,Y]=T([x,y]);return {index,source,x:X,y:Y,width:w*L.sx,label};
 });
 const active=Object.entries(model.routes).map(([id,state])=>({id,state:state.occupied?'occupied':state.lock?'locked':'set',points:routePoints(core.routes[id].path)}));
 const onRoute=cell=>active.find(route=>route.points.slice(1).some((b,i)=>{const a=route.points[i];return Math.abs(a[1]-b[1])<.5&&Math.abs(a[1]-cell.y)<5&&Math.min(a[0],b[0])<cell.x+cell.width-2&&Math.max(a[0],b[0])>cell.x+2;}));
 const paths=def.rails.map(r=>r[1].map(T));
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
 const occupiedBoxes=[];
 for(const p of wing.platforms){
  const [x,y]=T([p[0],p[1]]),[right,bottom]=T([p[2],p[3]]);
  platforms+=`<rect class="platform ${p[4]==='c'?'cyan':'orange'}" x="${x}" y="${y}" width="${right-x}" height="${Math.max(8,bottom-y)}" rx="2"/>`;
  occupiedBoxes.push([x-3,y-3,right+3,bottom+3]);
 }
 for(const points of paths)rails+=`<path d="${dpath(points)}"/>`;
 for(const polygon of wing.diags)rails+=`<polygon class="rail-join" points="${polygon.map(p=>T(p).join(',')).join(' ')}"/>`;
 for(const c of cells){
  const state=onRoute(c)?.state||'clear';
  sections+=`<g class="track-cell ${state}" data-track-section="${st.id}-${c.index}" data-track-circuit="${esc(c.label)}" data-track-state="${state}"><rect class="cell-bed" x="${c.x}" y="${c.y-BAR/2}" width="${c.width}" height="${BAR}"/><title>${esc(c.label||'원본 무기명 구간')} · ${state}</title></g>`;
  const tokens=c.label.split(' · ').filter(Boolean);
  tokens.forEach((label,i)=>{
   const x=c.x+c.width*(i+.5)/tokens.length,width=c.width/tokens.length;
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
 for(const [x,y]of boundaries)symbols+=`<path class="circuit-boundary" d="M${x} ${y-BAR/2}V${y+BAR/2}"/>`;
 const topRow=Math.min(...paths.flat().map(p=>p[1]));
 for(const plate of wing.plates){
  const [left]=T([plate.box[0],0]),[right]=T([plate.box[2],0]),x=(left+right)/2,width=Math.max(right-left,plate.name.length*16+18);
  const near=wing.platforms.filter(p=>Math.abs(T([(p[0]+p[2])/2,0])[0]-x)<150).map(p=>T([p[0],p[1]])[1]);
  const y=(near.length?Math.min(...near):topRow)-48;
  plates+=`<g class="inter-station" data-inter-station="${esc(plate.name)}"><path class="stn-line" d="M${x} ${y+24}V${(near.length?Math.min(...near):topRow)-9}"/><rect class="plate" x="${x-width/2}" y="${y}" width="${width}" height="25" rx="3"/><text class="plate-name" x="${x}" y="${y+18}" text-anchor="middle">${esc(plate.name)}</text><title>${esc(plate.name)} · 관할 중간역</title></g>`;
  occupiedBoxes.push([x-width/2-3,y-4,x+width/2+3,y+36]);
 }
 for(const [x,y,label]of data.markers){
  const [X]=T([x,y]),Y=Math.max(44,topRow-44,T([x,y])[1]);
  symbols+=`<g data-source-symbol="${label}">${label==='SP'?`<path d="M${X-13} ${Y-23}H${X+13}L${X} ${Y}Z" class="sp-board"/><text x="${X}" y="${Y-10}" class="board-label" text-anchor="middle">SP</text>`:`<rect x="${X-9}" y="${Y-23}" width="18" height="28" class="ss-board"/><path d="M${X-8} ${Y+3}L${X+8} ${Y-21}" class="ss-stripe"/><text x="${X}" y="${Y-29}" class="board-label" text-anchor="middle">SS</text>`}<title>원본 ${label} 표지</title></g>`;
  occupiedBoxes.push([X-16,Y-38,X+16,Y+6]);
 }
 for(const [x,y]of data.capsules){
  if(!data.cells.some(c=>Math.abs(c[1]-y)<30&&x>=c[0]-8&&x<=c[0]+c[2]+8)||def.signals.some(s=>Math.abs(s[2]-x)<22&&Math.abs(s[3]-y)<14))continue;
  const [X,rawY]=T([x,y]);const near=cells.filter(c=>X>=c.x-8&&X<=c.x+c.width+8).sort((a,b)=>Math.abs(a.y-rawY)-Math.abs(b.y-rawY))[0];
  const Y=near&&Math.abs(near.y-rawY)<17?near.y+(rawY<near.y?-17:17):rawY;symbols+=`<g data-source-symbol="capsule"><path class="capsule" d="M${X-7} ${Y}h14"/><path class="capsule-stop" d="M${X+10} ${Y-4}v8"/><title>원본 캡슐 표시</title></g>`;
 }
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
  const shape=`<rect class="signal-body" x="${Math.min(X,lampX)-3}" y="${LY-5}" width="24" height="10" rx="5"/><circle class="lamp ${go?'go':'stop'} ${locked?'lock':''}" cx="${lampX}" cy="${LY}" r="4.5"/>`;
  const box=dir===1?[X-30,LY-6,X+25,LY+6]:[X-25,LY-6,X+30,LY+6];
  occupiedBoxes.push(dir===1?[X-8-id.length*6,LY-6,X+23,LY+6]:[X-23,LY-6,X+8+id.length*6,LY+6]);
  signalSymbols+=`<g class="signal ${kind==='입환'?'shunt':'main'}" data-signal-view="${id}" data-anchor-x="${X}" data-lamp-y="${LY}"><path class="mast" d="M${X} ${Y+s.side*7}V${LY}H${lampX}"/>${shape}<circle class="mast-foot" cx="${X}" cy="${LY}" r="3"/><text class="sig-name" data-label-kind="signal" data-label-id="${id}" x="${X-dir*8}" y="${LY+3.5}" text-anchor="${dir===1?'end':'start'}">${id}</text><g class="signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${esc(st.name)} ${id} ${kind}신호기"><rect x="${box[0]}" y="${LY-6}" width="${box[2]-box[0]}" height="12" fill="transparent"/><title>${id} ${kind}신호기</title></g></g>`;
  if(model.approach?.[id]){
   const x=anchorX-dir*46;trains+=`<g class="approach-train" data-approach-train="${id}"><rect x="${x-24}" y="${Y-10}" width="48" height="20" rx="3"/><text x="${x}" y="${Y+5}" text-anchor="middle">열차</text></g>`;
  }
 }
 const takeLabel=(text,anchor,kind,id,preferred=anchor)=>{
  // Resolve dense labels locally only. Never detach an annotation from its turnout.
  const width=text.length*5.8+2;
  preferred=[Math.max(20,Math.min(WIDTH-20,preferred[0])),Math.max(20,Math.min(L.H-20,preferred[1]))];
  let [x,y]=preferred;
  const offsets=[[0,0]];
  for(let d=12;d<=36;d+=12)offsets.push([d,0],[-d,0],[0,-d],[0,d],[d,-12],[-d,-12],[d,12],[-d,12]);
  for(const [dx,dy]of offsets){
   const xx=preferred[0]+dx,yy=preferred[1]+dy,box=[xx-width/2,yy-6,xx+width/2,yy+6];
   if(xx<width/2+8||xx>WIDTH-width/2-8)continue;
   if(!occupiedBoxes.some(o=>intersects(box,o,1))&&!touchesRail(box)){x=xx;y=yy;break;}
  }
  occupiedBoxes.push([x-width/2,y-6,x+width/2,y+6]);
  return {x,y,svg:`<text class="annotation ${kind}" data-label-kind="${kind}" data-label-id="${esc(id)}" x="${x}" y="${y+3.5}" text-anchor="middle">${esc(text)}</text>`};
 };
 const overlapPoints=new Set(Object.keys(model.routes).flatMap(id=>Object.keys(core.overlapOf(id)?.points||{})));
 // Switch identifiers and source A/B part identifiers use the same placement solver.
 for(const [id,pos]of Object.entries(core.points)){
  const anchor=pointAnchors[id]||T(toLocal(pos.x,pos.y)),R=model.points[id]==='R',locked=model.blockedPoints.includes(id);
  const surveyed=inventory[st.id].labels.filter(p=>p[2]===id).map(p=>T(p)).filter(p=>p[0]>=12&&p[0]<=WIDTH-12&&p[1]>=16&&p[1]<=L.H-16).sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]))[0];
  const label=takeLabel(id,anchor,'point',id,surveyed||[anchor[0],anchor[1]-13]);
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
 const switches=switchView.build(st,def,core,model,T);
 return {width:WIDTH,height:L.H,svg:`${switches.mask}${platforms}<g class="track-shape" mask="url(#${switches.maskId})"><g class="bed-inner rail-network">${rails}</g><g class="wing-inner section-network">${sections}</g></g><g class="switch-network">${switches.svg}${switches.metadata}</g>${routes}${symbols}${labels}${plates}${leaders}${annotations}${pointSymbols}${signalSymbols}${trains}`};
}
const api={render,layout,wingOf,sceneOf};
if(typeof module!=='undefined')module.exports=api;else root.SimLS=api;
})(typeof window!=='undefined'?window:globalThis);

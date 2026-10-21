(function(root){
'use strict';
// Vector LS drawn from the traced wiring (SimWiring.data) plus the jurisdiction "wings" (SimWings): the
// inter-station / intermediate-station track strips extracted from the supplied 1.전체노선.pdf images, in the
// same local coordinates. No background image is used.
const W=1280,TOP=50,BOTTOM=50,GAP=64,PADX=26,BAR=21;
const COLOR={set:'#2fe872',occupied:'#ff5a4f',locked:'#ffb02e'};
const wingsData=typeof module!=='undefined'?require('./wings.js'):root.SimWings;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const through=n=>/^B\d+T$/.test(n||'');
function railY(def,railId,x){
 const p=def.rails.find(r=>r[0]===railId)[1];
 for(let i=1;i<p.length;i++)if(x>=Math.min(p[i-1][0],p[i][0])&&x<=Math.max(p[i-1][0],p[i][0])&&p[i][0]!==p[i-1][0])return p[i-1][1]+(p[i][1]-p[i-1][1])*(x-p[i-1][0])/(p[i][0]-p[i-1][0]);
 return p[0][1];
}
function onSeg(p,a,b){const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);return Math.abs(cross)<.5&&p[0]>=Math.min(a[0],b[0])-.5&&p[0]<=Math.max(a[0],b[0])+.5&&p[1]>=Math.min(a[1],b[1])-.5&&p[1]<=Math.max(a[1],b[1])+.5;}
// Parts of the extracted strips that lie outside the traced station rails.
function wingOf(st,def){
 const raw=wingsData?.[st.id];if(!raw)return {cells:[],diags:[],platforms:[],plates:[],labels:[],signals:[]};
 const xs=def.rails.flatMap(r=>r[1].map(p=>p[0])),lo=Math.min(...xs),hi=Math.max(...xs),out=x=>x<lo-1||x>hi+1;
 const cx=poly=>poly.reduce((a,p)=>a+p[0],0)/poly.length,cy=poly=>poly.reduce((a,p)=>a+p[1],0)/poly.length;
 const ys=def.rails.flatMap(r=>r[1].map(p=>p[1])),band=y=>y>=Math.min(...ys)-60;
 const plates=[...raw.plates].sort((a,b)=>a[0]-b[0]),names=st.map.view?.intermediate||[];
 return {
  cells:raw.cells.filter(c=>out(c[0]+c[2]/2)),
  diags:raw.diags.filter(p=>band(cy(p))&&(Math.max(...p.map(q=>q[0]))>hi+1||Math.min(...p.map(q=>q[0]))<lo-1)),
  platforms:raw.platforms.filter(p=>out((p[0]+p[2])/2)&&band((p[1]+p[3])/2)),
  plates:plates.map((p,i)=>({box:p,name:plates.length===names.length?names[i]:''})),
  labels:raw.labels.filter(l=>out(l[0])&&band(l[1])),
  signals:raw.signals.filter(s=>out(s[0])&&band(s[1]))
 };
}
function layout(def,wing){
 const xs=[],ys=[],railYs=new Set();
 for(const r of def.rails)for(const [x,y] of r[1]){xs.push(x);ys.push(y);railYs.add(Math.round(y));}
 for(const s of def.signals)ys.push(s[3]);
 for(const c of wing.cells){xs.push(c[0],c[0]+c[2]);ys.push(c[1]);}
 for(const p of wing.diags)for(const q of p){xs.push(q[0]);ys.push(q[1]);}
 for(const p of wing.platforms){xs.push(p[0],p[2]);ys.push(p[1],p[3]);}
 for(const p of wing.plates)xs.push(p.box[0],p.box[2]);
 for(const s of wing.signals){xs.push(s[0]);ys.push(s[1]);}
 const sorted=[...railYs].sort((a,b)=>a-b);let pitch=Infinity;
 for(let i=1;i<sorted.length;i++)if(sorted[i]-sorted[i-1]>=20)pitch=Math.min(pitch,sorted[i]-sorted[i-1]);
 if(!isFinite(pitch))pitch=51;
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),top=TOP+(wing.plates.length?66:0);
 const sx=(W-2*PADX)/(maxX-minX),sy=Math.min(1.5,Math.max(.6,66/pitch));
 return {sx,sy,H:Math.round(top+(maxY-minY)*sy+BOTTOM),pt:([x,y])=>[+(PADX+(x-minX)*sx).toFixed(1),+(top+(y-minY)*sy).toFixed(1)]};
}
function render(st,def,core,model,nb={}){
 const wing=wingOf(st,def),L=layout(def,wing),T=L.pt,[ox,oy,w,h]=st.map.referenceWindow,[iw,ih]=def.size;
 const toLocal=(px,py)=>[(px-ox)*iw/w,(py-oy)*ih/h];
 const pathLocal=d=>{const n=d.match(/-?\d+(?:\.\d+)?/g).map(Number),pts=[];for(let i=0;i<n.length;i+=2)pts.push(T(toLocal(n[i],n[i+1])));return pts;};
 let bed='',top='',tags='',routes='',points='',signals='',trains='',under='',wOuter='',wInner='',wText='',wPlates='',wSig='';
 const stroke=(pts)=>'M'+pts.map(p=>p.join(' ')).join('L');
 const railYAt=(r,x)=>railY(def,r,x);
 // --- wings (outside the traced station): track-circuit cells, diagonals, platforms, plates, labels, signals
 const fit=(label,width,size)=>{const need=label.length*size*.62;return need>width?` textLength="${Math.max(8,width-1).toFixed(1)}" lengthAdjust="spacingAndGlyphs"`:'';};
 for(const c of wing.cells){
  const [X,Y]=T([c[0],c[1]]),cw=c[2]*L.sx;
  wOuter+=`<rect x="${(X-1.6).toFixed(1)}" y="${Y-BAR/2-3}" width="${(cw+3.2).toFixed(1)}" height="${BAR+6}" rx="2"/>`;
  wInner+=`<rect x="${(X+1).toFixed(1)}" y="${Y-BAR/2}" width="${Math.max(2,cw-2).toFixed(1)}" height="${BAR}" rx="1"/>`;
  if(c[3])wText+=`<text class="cell-name" x="${(X+cw/2).toFixed(1)}" y="${Y+4.6}" text-anchor="middle"${fit(c[3],cw-5,13)}>${esc(c[3])}</text>`;
 }
 for(const p of wing.diags){const pts=p.map(q=>T(q).join(',')).join(' ');wOuter+=`<polygon class="diag" points="${pts}"/>`;wInner+=`<polygon class="diag-in" points="${pts}"/>`;}
 for(const p of wing.platforms){const [a,b]=T([p[0],p[1]]),[c,d]=T([p[2],p[3]]);under+=`<rect class="platform ${p[4]==='c'?'cyan':'orange'}" x="${a}" y="${b}" width="${(c-a).toFixed(1)}" height="${(d-b).toFixed(1)}" rx="3"/>`;}
 const topRow=Math.min(...def.rails.map(r=>Math.min(...r[1].map(q=>T(q)[1]))),...wing.cells.map(c=>T([c[0],c[1]])[1]));
 const nearTop=(ax,bx,minLocalY)=>{const ys=[];for(const c of wing.cells){const [X,Y]=T([c[0],c[1]]);if(c[1]>=minLocalY&&X+c[2]*L.sx>=ax&&X<=bx)ys.push(Y-BAR/2);}for(const p of wing.platforms){const [X,Y]=T([p[0],p[1]]),[X2]=T([p[2],p[3]]);if(p[1]>=minLocalY-30&&X2>=ax&&X<=bx)ys.push(Y);}return ys.length?Math.min(...ys):topRow;};
 for(const p of wing.plates){const [a]=T([p.box[0],0]),[c]=T([p.box[2],0]),cxm=(a+c)/2,wd=Math.max(c-a,p.name.length*24+28),ht=40,rowY=nearTop(cxm-170,cxm+170,p.box[3]-6),b=rowY-(rowY-topRow<4?96:70)-ht+ht;
  under+=`<path class="stn-line" d="M${cxm.toFixed(1)} ${b+ht}V${rowY-6}"/>`;
  wPlates+=`<g class="inter-station" data-inter-station="${esc(p.name)}"><rect class="plate" x="${(cxm-wd/2).toFixed(1)}" y="${b}" width="${wd.toFixed(1)}" height="${ht}" rx="4"/><text class="plate-name" x="${cxm.toFixed(1)}" y="${(b+ht/2+7).toFixed(1)}" text-anchor="middle">${esc(p.name)}</text><title>${esc(p.name)} · 관할 중간역(조작 없음)</title></g>`;}
 for(const l of wing.labels){const [X,Y]=T([l[0],l[1]]);wText+=`<text class="wing-label" x="${X}" y="${Y+5}" text-anchor="middle">${esc(l[2])}</text>`;}
 for(const s of wing.signals){const [X,Y]=T([s[0],s[1]]),d=s[3];wSig+=`<g class="signal wing" data-wing-signal="${esc(s[2])}"><path class="mast" d="M${X} ${Y}h${d*13}"/><circle class="lamp stop" cx="${X}" cy="${Y}" r="8"/><text class="sig-name" x="${X-d*13}" y="${Y+5.5}" text-anchor="${d===1?'end':'start'}">${esc(s[2])}</text></g>`;}
 // --- traced station rails
 for(const [id,poly,,left,right] of def.rails){
  const pts=poly.map(T);bed+=`<path d="${stroke(pts)}"/>`;top+=`<path d="${stroke(pts)}"/>`;
  const a=pts[0],b=pts.at(-1),free=end=>!def.rails.some(r=>r[0]!==id&&r[1].slice(1).some((q,i)=>onSeg(end,r[1][i],q)));
  const nameAt=(x,y,label)=>{tags+=`<text class="rail-name" x="${x}" y="${y+4.6}" text-anchor="middle">${esc(label)}</text>`;};
  const lt=through(left)&&wing.cells.length,rt=through(right)&&wing.cells.length;let named=false;
  const row=wing.cells.filter(c=>Math.abs(c[1]-poly.at(-1)[1])<10);
  if(rt){const nxt=row.filter(c=>c[0]>=poly.at(-1)[0]-2).sort((p,q)=>p[0]-q[0])[0];if(nxt&&nxt[0]-poly.at(-1)[0]>1){const q=T([nxt[0],poly.at(-1)[1]]);bed+=`<path d="M${b.join(' ')}L${q.join(' ')}"/>`;top+=`<path d="M${b.join(' ')}L${q.join(' ')}"/>`;}}
  const rowL=wing.cells.filter(c=>Math.abs(c[1]-poly[0][1])<10);
  if(lt){const prv=rowL.filter(c=>c[0]+c[2]<=poly[0][0]+2).sort((p,q)=>(q[0]+q[2])-(p[0]+p[2]))[0];if(prv&&poly[0][0]-(prv[0]+prv[2])>1){const q=T([prv[0]+prv[2],poly[0][1]]);bed+=`<path d="M${q.join(' ')}L${a.join(' ')}"/>`;top+=`<path d="M${q.join(' ')}L${a.join(' ')}"/>`;}}
  if(!lt&&free(poly[0])){nameAt(a[0]+46,a[1],left||id);named=true;}
  if(!rt&&!named&&free(poly.at(-1)))nameAt(b[0]-46,b[1],right||id);
 }
 const mid={};
 for(const [pid,a,x,b,z] of def.links){
  const p=T([x,railYAt(a,x)]),q=T([z,railYAt(b,z)]);bed+=`<path d="M${p.join(' ')}L${q.join(' ')}"/>`;top+=`<path d="M${p.join(' ')}L${q.join(' ')}"/>`;
  mid[pid]=[(p[0]+q[0])/2,(p[1]+q[1])/2];
 }
 for(const [id,active] of Object.entries(model.routes)){
  const cls=active.occupied?'occupied':active.lock?'locked':'set',pts=pathLocal(core.routes[id].path);
  routes+=`<path class="route-halo" d="${stroke(pts)}"/><path class="route-line ${cls}" data-active-route="${esc(id)}" data-route-station="${st.id}" data-route-state="${cls}" d="${stroke(pts)}" stroke="${COLOR[cls]}" ${cls==='locked'?'stroke-dasharray="14 9"':''}/>`;
 }
 const placed=def.signals.map(([id,rail,x,lampY,dir])=>{const railLocal=railYAt(rail,x),[X,Y]=T([x,railLocal]);return {id,rail,dir,lampY,railLocal,X,Y,side:Math.sign(lampY-railLocal||1)};});
 const groups=new Map();for(const s of placed){const k=s.rail+'|'+s.side;(groups.get(k)||groups.set(k,[]).get(k)).push(s);}
 for(const list of groups.values()){list.sort((p,q)=>p.X-q.X||(core.signals[p.id].kind==='입환')-(core.signals[q.id].kind==='입환'));for(let i=1;i<list.length;i++)if(list[i].X-list[i-1].X<GAP)list[i].X=list[i-1].X+GAP;}
 const geom=s=>{const offset=Math.max(24,Math.min(34,Math.abs(s.lampY-s.railLocal)*L.sy))*Math.sign(s.lampY-s.railLocal||1);return {offset,LY:s.Y+offset};};
 const obstacles=placed.map(s=>{const g=geom(s);return s.dir===1?[s.X-46,g.LY-15,s.X+26,g.LY+15]:[s.X-26,g.LY-15,s.X+46,g.LY+15];});
 const hit=(b,box)=>b[0]-18<box[2]&&b[0]+18>box[0]&&b[1]-12<box[3]&&b[1]+12>box[1];
 const overlapIds=new Set();for(const id of Object.keys(model.routes))for(const pid of Object.keys(core.overlapOf(id)?.points||{}))overlapIds.add(pid);
 const taken=[];
 for(const [pid,pos] of Object.entries(core.points)){
  const [px,py]=toLocal(pos.x,pos.y),base=[...(mid[pid]||(()=>{const q=T([px,py]);return [q[0]+16,q[1]-24];})())];
  const free=b=>!obstacles.some(o=>hit(b,o))&&!taken.some(q=>Math.abs(q[0]-b[0])<40&&Math.abs(q[1]-b[1])<26);
  for(const [dx,dy] of [[0,0],[0,-24],[0,24],[44,0],[-44,0],[44,-24],[-44,-24],[44,24],[-44,24],[88,0],[-88,0]]){const c=[base[0]+dx,base[1]+dy];if(free(c)){base[0]=c[0];base[1]=c[1];break;}}
  taken.push(base);
  const R=model.points[pid]==='R',locked=model.blockedPoints.includes(pid);
  points+=`<g class="point-tag ${R?'rev':''} ${locked?'locked':''}" data-point-label="${esc(pid)}"><title>${esc(st.name)} ${esc(pid)}번 전환기 · ${R?'반위':'정위'}${locked?' · 수동 쇄정':''}${overlapIds.has(pid)?' · 오버랩 쇄정':''}</title>`
   +`<rect x="${base[0]-17}" y="${base[1]-11}" width="34" height="22" rx="5"/><text x="${base[0]}" y="${base[1]+5.5}" text-anchor="middle">${esc(pid)}${R?'R':''}</text></g>`;
  if(overlapIds.has(pid))points+=`<circle class="overlap-ring" data-overlap-point="${esc(pid)}" cx="${base[0]}" cy="${base[1]}" r="22"/>`;
 }
 for(const {id,rail,dir,lampY,railLocal,X,Y} of placed){
  const kind=core.signals[id].kind,offset=geom({lampY,railLocal,Y}).offset,LY=Y+offset;
  const go=model.signals[id]==='GO',lockedHere=Object.keys(model.routes).some(r=>model.routes[r].lock&&core.routes[r].signal===id);
  const lampX=X+dir*13,shape=kind==='입환'?`<rect class="lamp ${go?'go shunt':'stop'}" x="${lampX-6}" y="${LY-6}" width="12" height="12" rx="2"/>`:`<circle class="lamp ${go?'go':'stop'} ${lockedHere?'lock':''}" cx="${lampX}" cy="${LY}" r="9"/>`;
  signals+=`<g class="signal ${kind==='입환'?'shunt':'main'}" data-signal-view="${esc(id)}"><path class="mast" d="M${X} ${Y+Math.sign(offset)*11}V${LY}H${lampX-dir*(kind==='입환'?6:9)}"/>${shape}`
   +`<text class="sig-name" x="${X-dir*8}" y="${LY+5.5}" text-anchor="${dir===1?'end':'start'}">${esc(id)}</text>`
   +`<g class="signal-hit" data-signal="${esc(id)}" role="button" tabindex="0" aria-label="${esc(st.name)} ${esc(id)} ${kind}신호기"><rect x="${Math.min(X-dir*30,lampX)-8}" y="${LY-17}" width="62" height="34" fill="transparent"/><title>${esc(st.name)} ${esc(id)} ${kind}신호기</title></g></g>`;
  if(model.approach?.[id]){const [tx,ty]=[X-dir*46,Y];trains+=`<g class="approach-train" data-approach-train="${esc(id)}" pointer-events="none"><rect x="${tx-24}" y="${ty-10}" width="48" height="20" rx="4"/><path d="M${tx-dir*24} ${ty}h${dir*8}"/><text x="${tx}" y="${ty+5}" text-anchor="middle">열차</text><title>${esc(id)} 외방 접근 열차</title></g>`;}
 }
 // neighbouring control stations at both ends, above the top track
 const edgeY=Math.min(...def.rails.map(r=>T(r[1][0])[1]),...wing.cells.map(c=>T([c[0],c[1]])[1]))-26;
 if(nb.left)tags+=`<text class="nb-tag" x="12" y="${edgeY}" text-anchor="start">◀ ${esc(nb.left)}</text>`;
 if(nb.right)tags+=`<text class="nb-tag" x="${W-12}" y="${edgeY}" text-anchor="end">${esc(nb.right)} ▶</text>`;
 return {height:L.H,width:W,svg:`${under}<g class="wing-outer">${wOuter}</g><g class="bed-outer">${bed}</g><g class="wing-inner">${wInner}</g><g class="bed-inner">${top}</g>${wText}${wPlates}${wSig}${routes}${tags}${points}${signals}${trains}`};
}
const api={render,layout,wingOf};
if(typeof module!=='undefined')module.exports=api;else root.SimLS=api;
})(typeof window!=='undefined'?window:globalThis);

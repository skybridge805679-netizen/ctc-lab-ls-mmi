(function(root){
'use strict';
const details=typeof module!=='undefined'?require('../engine/schematic-details.js'):root.SimSchematicDetails;
const switchView=typeof module!=='undefined'?require('./ls-switches.js'):root.SimLSSwitches;
const inventory=typeof module!=='undefined'?require('../engine/wings.js'):root.SimWings;
const trainWindows=typeof module!=='undefined'?require('../engine/train-windows.js'):root.SimTrainWindows;
const fixedSymbols=typeof module!=='undefined'?require('./fixed-symbols.js'):root.SimFixedSymbols;
const seams=typeof module!=='undefined'?require('./ls-seams'):root.SimLSSeams;
const blockView=typeof module!=='undefined'?require('./ls-block-signals'):root.SimLSBlockSignals;
const presets=typeof module!=='undefined'?require('./ls-presets'):root.SimLSPresets;
const platformInfo=typeof module!=='undefined'?require('../engine/platforms'):root.SimPlatforms;
const labelReview=typeof module!=='undefined'?require('./circuit-label-review'):root.SimCircuitLabelReview;
// 지연 참조: 브라우저에서는 이 파일이 engine/line.js보다 먼저 읽힐 수 있다
const lineInfo=()=>typeof module!=='undefined'?require('../engine/line.js'):root.SimLine,networkInfo=()=>typeof module!=='undefined'?require('../engine/network.js'):root.SimNetwork;
const windowLayouts=new WeakMap();
const WIDTH=1600,BAR=18,PADDING=30;
const COLORS={set:'#35dc82',occupied:'#ff5c50',locked:'#ffbd55'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dpath=points=>'M'+points.map(p=>p.join(' ')).join('L');
const mean=(points,axis)=>points.reduce((a,p)=>a+p[axis],0)/points.length;
const {railY,sceneOf,sourceSceneOf,GWANAK}=typeof module!=='undefined'?require('../engine/track-geometry'):root.SimTrackGeometry;
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
const SY_MAX=1.9;
// 원본 LS 화면 가로 배치 (tools/build-ls-xmap.py): PDF x -> 원본 화면 x. 역 화면에서만 쓴다.
const xmapInfo=()=>typeof module!=='undefined'?require('../engine/ls-xmap.js'):root.SimLSXMap;
const knotAt=(knots,x)=>{const n=knots.length;if(n===1)return knots[0][1]+x-knots[0][0];
 const avg=(knots[n-1][1]-knots[0][1])/Math.max(1e-6,knots[n-1][0]-knots[0][0]);   // 바깥쪽은 평균 기울기로 (이름판이 늘어나지 않게)
 if(x<=knots[0][0])return knots[0][1]+(x-knots[0][0])*avg;if(x>=knots[n-1][0])return knots[n-1][1]+(x-knots[n-1][0])*avg;
 const seg=knots.findIndex((k,i)=>i<n-1&&x>=k[0]&&x<=knots[i+1][0]);
 const [a,b]=[knots[seg],knots[seg+1]];return a[1]+(x-a[0])*(b[1]-a[1])/Math.max(1e-6,b[0]-a[0]);};
function layout(def,wing,aspect,top=108,native=false,xmap=null){   // top: 원본 노란 화살표 자리
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
 if(native)return {sx:1,sy:1,width:maxX-minX+PADDING*2,H:maxY-minY+top+64,pt:([x,y])=>[+(x-minX+PADDING).toFixed(2),+(y-minY+top).toFixed(2)]};
 // Use vertical desktop space for readable rail and signal lanes; preserve every connection.
 const railRows=[...new Set(def.rails.flatMap(r=>r[1].slice(1).filter((p,i)=>Math.abs(p[1]-r[1][i][1])<2).map(p=>p[1])))].sort((a,b)=>a-b);
 const pitches=railRows.slice(1).map((y,i)=>y-railRows[i]).filter(d=>d>=20);
 const pitch=Math.min(...pitches,80);
 const sx=(WIDTH-2*PADDING)/(maxX-minX),targetH=Number.isFinite(aspect)&&aspect>0?Math.max(420,WIDTH/aspect):null;
 // 세로 배율은 모든 역이 같은 상한(SY_MAX)을 쓴다: 화면 높이에 맞춰 역마다 늘리면 선로 간격이 역마다 달라져
 // (지하청량리~지하서울은 3배 이상) 열번칸·폐색 표식·이름판 정렬이 들쭉날쭉해진다. 남는 높이는 위아래로 나눈다.
 // 시저스(X자)가 걸친 선로 사이는 화면에서 120px 안쪽으로: 더 벌리면 X가 기둥처럼 길어진다 (지하청량리~지하서울)
 const xspan=Math.max(0,...def.links.filter(([id,a,x,b,z])=>def.links.some(([o,c,u,d,v])=>o!==id&&a===d&&b===c&&Math.abs(x-u)<5&&Math.abs(z-v)<5)).map(([,a,x,b,z])=>Math.abs(railY(def,a,x)-railY(def,b,z))));
 const syCap=xspan?Math.min(SY_MAX,120/xspan):SY_MAX;
 /* 줄이 많아 화면 높이에 맞추면 줄 간격이 좁아지는 화면(구로 8줄): 선로 묶음 사이의 큰 빈 간격(줄 3개 넘게)만 1.9줄로 줄여 줄 간격을 넓힌다.
    신호기·열번칸이 선로에 바짝 붙어 칸을 가리던 것 (다른 역은 줄 간격이 넉넉해 그대로) */
 const span0=Math.max(1,maxY-minY),fill0=targetH?(targetH-top-64)/span0:null,cramped=!!xmap&&targetH&&!(xmap.rows?.length)&&Math.min(syCap,fill0)*pitch<56;
 const gapCut=cramped?railRows.slice(1).map((y,i)=>[railRows[i],y]).filter(([a,b])=>b-a>3*pitch).map(([a,b])=>[a,b,b-a-1.9*pitch]):[];
 const yC=y=>{let v=y;for(const [a,b,cut] of gapCut){if(y>=b)v-=cut;else if(y>a)v-=cut*(y-a)/(b-a);}return v;};
 const bottom=64,fill=targetH?(targetH-top-bottom)/Math.max(1,yC(maxY)-yC(minY)):null,sy=targetH?Math.max(40/pitch,Math.min(syCap,fill)):Math.max(sx,80/pitch);   /* 줄이 많은 화면(구로 8줄)도 화면 높이 안에: 원본 줄 간격은 약 39px */
 if(targetH&&fill>sy)top+=Math.floor((fill-sy)*(yC(maxY)-yC(minY))/2);
 // Reserve the original broad scissors footprint after increasing the rail spacing.
 // One monotone X transform moves rails, cells, signals and active routes together.
 const spans=def.links.filter(([id,a,x,b,z])=>def.links.some(([other,c,u,d,v])=>other!==id&&a===d&&b===c&&Math.abs(x-u)<5&&Math.abs(z-v)<5)).map(([,a,x,b,z])=>[Math.min(x,z),Math.max(x,z),Math.abs(railY(def,a,x)-railY(def,b,z))*sy,railY(def,a,x),railY(def,b,z)]);
 const knots=[...new Set([minX,maxX,...spans.flatMap(s=>s.slice(0,2))])].sort((a,b)=>a-b);
 const weights=knots.slice(1).map((x,i)=>{const lo=knots[i],mid=(x+lo)/2,span=spans.find(([a,b])=>mid>=a&&mid<=b);return span?Math.max(1,Math.max(100,Math.min(300,span[2]*.85))/((span[1]-span[0])*sx)):1;});
 const cumulative=[0];weights.forEach((w,i)=>cumulative.push(cumulative.at(-1)+(knots[i+1]-knots[i])*w));
 const xAt=x=>{let i=0;while(i<weights.length-1&&x>knots[i+1])i++;return PADDING+(cumulative[i]+(x-knots[i])*weights[i])*(WIDTH-2*PADDING)/cumulative.at(-1);};
 /* 이어지는 화면(지하청량리~지하서울)은 본선 두 줄을 모든 화면에서 같은 높이에 둔다 (ls-xmap-overrides rows: 원본 y → 화면 y) */
 const rowFix=xmap?.rows?.length===2?xmap.rows:null,syR=rowFix?(rowFix[1][1]-rowFix[0][1])/(rowFix[1][0]-rowFix[0][0]):sy;
 /* 화면이 기본(713)보다 높으면 네 화면 모두 같은 만큼 내려 가운데에 둔다 (이음은 유지) */
 const rowShift=rowFix&&targetH?Math.max(0,Math.round((targetH-713)/2)):0;
 const yAt=rowFix?y=>rowFix[0][1]+rowShift+(y-rowFix[0][0])*syR:y=>top+(yC(y)-yC(minY))*sy;
 if(xmap){const k=WIDTH/xmap.width,orig=xmap.knots.map(([a,b])=>[a,b*k]);let knots=orig;
  // 시저스(X자 건넘선)는 세로 간격에 비해 가로가 좁으면 기둥처럼 보인다: 높이의 0.8배 이상 가로폭을 확보하고, 늘린 만큼 좌우 구간을 비례해 줄인다
  // 원본 좌표 화면에서는 칸 경계를 움직이지 않는다: 시저스가 높이의 0.8배보다 좁으면 X 그림만 양옆으로 늘린다 (금천구청 21·22)
  const pads=[];for(const [x0,x1,h,ya,yb] of spans){const need=h*.8,g0=knotAt(knots,x0),g1=knotAt(knots,x1),cur=g1-g0;if(cur>=need)continue;
   const pad=(need-cur)/2,inside=y=>(xmap.cells||[]).some(c=>Math.abs(c[1]-y)<4&&c[3]*k<=g0-pad-4&&c[4]*k>=g1+pad+4);
   if(inside(ya)&&inside(yb)){pads.push({x0,x1,ya,yb,pad});continue;}
   const lo=knots[0][0],hi=knots.at(-1)[0],G0=knotAt(knots,lo),G1=knotAt(knots,hi),extra=need-cur,leftW=g0-G0,rightW=G1-g1;if(leftW+rightW<=extra*1.5)continue;
   const dl=extra*leftW/(leftW+rightW),dr=extra-dl,pts=[...new Set([...knots.map(q=>q[0]),x0,x1])].sort((a,b)=>a-b);
   knots=pts.map(x=>{const g=knotAt(knots,x);if(x<=x0)return [x,G0+(g-G0)*(leftW-dl)/Math.max(1e-6,leftW)];if(x>=x1)return [x,G1-(G1-g)*(rightW-dr)/Math.max(1e-6,rightW)];const a=G0+leftW-dl;return [x,a+(g-g0)*need/Math.max(1e-6,cur)];});}
  // 원본 화면 x(열번칸·폐색 칸의 원본 좌표)에도 같은 보정을 적용하는 함수
  const adjKnots=knots.map(([x,g])=>[knotAt(orig,x),g]).filter((q,i,a)=>i===0||q[0]>a[i-1][0]+1e-6),adj=v=>adjKnots.length>1?knotAt(adjKnots,v):v;
  return {sx,sy:syR,H:Math.max(targetH||460,Math.ceil(yAt(maxY)+bottom)),xmap,adj,pads,pt:([x,y])=>[+knotAt(knots,x).toFixed(2),+yAt(y).toFixed(2)]};}
 return {sx,sy:syR,H:Math.max(targetH||460,Math.ceil(yAt(maxY)+bottom)),pt:([x,y])=>[+xAt(x).toFixed(2),+yAt(y).toFixed(2)]};
}
function intersects(a,b,gap=3){return a[0]<b[2]+gap&&a[2]>b[0]-gap&&a[1]<b[3]+gap&&a[3]>b[1]-gap;}
function render(st,def,core,model,neighbours={}){
 const prepared=presets.prepare(st,def,sceneOf(st),wingOf(st,def),neighbours.preset),{data,wing}=prepared;def=prepared.def;
 if(prepared.corridor)model={...model,routes:{},approach:{},scenarioMotions:[]};
 const visibleWindows=presets.windows(trainWindows.data[st.id]||[],def,data.cells,prepared.split,prepared.corridor,prepared.slide);
 const xmap=!neighbours.overview&&!prepared.corridor&&neighbours.preset===st.id?xmapInfo()?.[st.id]:null;   // 역 화면(프리셋 = 역)에서만
 const L=layout(def,wing,neighbours.aspect,neighbours.overview?80:prepared.corridor?150:108,!!neighbours.overview,xmap)   // 역판·열번창 위 여백을 유지한다
,T=L.pt;
 const WIDTH=neighbours.overview?Math.max(1600,L.width):1600;
 const plateGap=prepared.corridor?128:94;
 const edgePorts=seams.ports(st,def,data);
 // 원본 슬라이드의 빨간 등 위치(tools/build-ls-xmap.py)가 있으면 그 자리를 신호기 기준으로 쓴다
 // 원본 위치로 고정한 선로 꼭짓점(railPoints)이 있는 선로는, 그 선로 위의 모든 점(선로전환기 틈·번호)을 같은 원본 위치로 옮긴다
 const Tw=p=>{{const ex=railFix.find(([fx,fy])=>Math.abs(fx-p[0])<.6&&Math.abs(fy-p[1])<2);if(ex)return [L.adj(ex[2]*WIDTH/L.xmap.width),T(p)[1]];}   /* 원본 위치를 직접 적은 점이 먼저 */const sp=(L.pads||[]).find(s=>(Math.abs(p[0]-s.x0)<.6||Math.abs(p[0]-s.x1)<.6)&&(Math.abs(p[1]-s.ya)<2||Math.abs(p[1]-s.yb)<2));if(sp){const P=T(p);return [P[0]+(Math.abs(p[0]-sp.x0)<.6?-sp.pad:sp.pad),P[1]];}if(!railFix.length)return T(p);const F=v=>fixPt(v,T(v));
  for(const r of def.rails)for(let i=1;i<r[1].length;i++){const a=r[1][i-1],b=r[1][i],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(!L2)continue;const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;if(t<-.02||t>1.02)continue;
   const qx=a[0]+t*dx,qy=a[1]+t*dy;if(Math.hypot(p[0]-qx,p[1]-qy)>3)continue;if(Math.abs(dy)<2)continue;   /* 가로 구간은 공통 배치(T) */const A=F(a),B=F(b);if(A[0]===T(a)[0]||B[0]===T(b)[0])continue;return [A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];}   /* 양 끝이 다 고정된 구간(꺾인 사선)만 그대로 보간 */
  const P=T(p),f=railFix.map(([fx,fy,ox])=>({d:Math.hypot(fx-p[0],fy-p[1]),dx:L.adj(ox*WIDTH/L.xmap.width)-T([fx,fy])[0]})).sort((a,b)=>a.d-b.d)[0];return f&&f.d<30?[P[0]+f.dx,P[1]]:P;};   /* 고정 꼭짓점 근처(선로전환기 틈)는 그 꼭짓점만큼 */
 // 선로 밖의 번호(선로전환기 번호 등)는 가장 가까운 고정 꼭짓점과 같은 만큼 옮긴다
 const Tnear=p=>{const P=T(p);if(!railFix.length)return P;const f=railFix.map(([fx,fy,ox])=>({fx,fy,d:Math.hypot(fx-p[0],(fy-p[1])*.5),dx:L.adj(ox*WIDTH/L.xmap.width)-T([fx,fy])[0]})).sort((a,b)=>a.d-b.d)[0];return f&&f.d<45?[P[0]+f.dx,P[1]]:P;};
 const sigBase=(id,P)=>{const v=L.xmap?.signals?.[id];return v?[L.adj(v[0]*WIDTH/L.xmap.width)-v[1]*18,P[1]]:P;};
 // 기둥이 칸 틈에 선 뒤 원본 빨간 등이 기둥에서 24~40px 떨어져 있으면(등 두 개짜리 장내·출발 신호기) 몸체를 그만큼 늘린다 (안양 1A·3B·4C·2B 등)
 const sigReach=(id,X,dir)=>{const v=L.xmap?.signals?.[id];if(!v)return 18;const d=(L.adj(v[0]*WIDTH/L.xmap.width)-X)*dir;return d>=24&&d<=40?Math.round(d):d>=0&&d<15&&core.signals[id]?.kind==="입환"?12:18;};   /* 원본 등이 기둥에 바짝 붙은 짧은 신호기(금천구청 51·54)는 12 */
 // 원본에서 줄마다 위치가 다른 꼭짓점(노량진 B929T·B930T가 꺾여 내려가는 두 수직선)은 원본 x에 고정한다
 const railFix=L.xmap?.railPoints||[],fixPt=([x,y],P)=>{const f=railFix.find(([fx,fy])=>Math.abs(fx-x)<1&&Math.abs(fy-y)<2);return f?[+L.adj(f[2]*WIDTH/L.xmap.width).toFixed(2),P[1]]:P;};
 const [ox,oy,rw,rh]=st.map.referenceWindow,[iw,ih]=def.size;
 const toLocal=(x,y)=>[(x-ox)*iw/rw,(y-oy)*ih/rh];
 const routePoints=path=>{const values=path.match(/-?\d+(?:\.\d+)?/g).map(Number),out=[];for(let i=0;i<values.length;i+=2)out.push(Tw(toLocal(values[i],values[i+1])));return out;};   /* 선로전환기 그림과 같은 변환(원본 위치로 고정한 점 포함): 시저스 X 위 경로가 X를 따른다 (서울 58·59) */
 const rows=def.rails.flatMap(r=>r[1].slice(1).filter((p,i)=>Math.abs(p[1]-r[1][i][1])<2).map(p=>p[1]));
 // One coordinate model for the throat and all adjoining cells. Extraction drift is snapped to the same centreline.
 const cells=data.cells.map((source,index)=>{
  let [x,y,w,label]=source;
  const nearby=rows.filter(row=>Math.abs(row-y)<6).sort((a,b)=>Math.abs(a-y)-Math.abs(b-y));
  if(nearby.length)y=nearby[0];
  const [X,Y]=T([x,y]);return {index,source,x:X,y:Y,width:T([x+w,y])[0]-X,label};
 });
 // 폐색 칸(B…)은 행마다 따로 원본 위치에 맞춘다: 원본은 하선·상선 폐색 칸이 서로 엇갈려 놓여 하나의 가로 함수로는 맞출 수 없다.
 // 그 행에서 원본 좌표를 아는 칸(전사)을 기준점으로, 모르는 칸은 기준점 사이에 원래 폭 비율대로 나눈다. 역 구내 칸·선로는 공통 함수 그대로.
 if(L.xmap){const k=WIDTH/L.xmap.width,ref=new Map();
  for(const c of cells){const m=L.xmap.cells.find(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6);if(m)ref.set(c,[L.adj(m[3]*k),L.adj(m[4]*k)]);}
  const isBlock=c=>/^B\d/.test(c.label||'');
  const byRow=new Map();for(const c of cells){const key=Math.round(c.y);if(!byRow.has(key))byRow.set(key,[]);byRow.get(key).push(c);}
  // 분기 사선·꺾인 연결이 붙는 칸 끝은 공통 함수 자리에 고정한다 (선이 끊기지 않게)
  /* 건넘선 끝은 원본 칸 끝(refX)이 그 근처일 때만 칸 끝을 끌어당긴다 (금천구청 24AT·25BT는 25 건넘선과 떨어져 있다) */
  const linkPts=def.links.flatMap(([id,a,x,b,z])=>[Tw([x,railY(def,a,x)]),Tw([z,railY(def,b,z)])]);   /* 실제로 그려지는 건넘선 끝 */
  const fixedPts=[...def.rails.flatMap(r=>r[1].filter((p,i,a)=>(i>0&&Math.abs(a[i-1][1]-p[1])>=2)||(i<a.length-1&&Math.abs(a[i+1][1]-p[1])>=2)).map(p=>fixPt(p,T(p)))),...(data.joins||[]).flatMap(j=>j.map(p=>fixPt(p,T(p))))];
  /* 원본 칸이 그 점을 넘어 덮으면(사선이 칸 가운데에 내려앉는 곳) 고정하지 않는다 */
  const near=(x,y,refX)=>([px,py],k)=>Math.abs(py-y)<4&&(Math.abs(px-refX)<10||(k>=linkPts.length&&Math.abs(px-x)<10)),allPts=[...linkPts,...fixedPts];
  const pinned=(x,y,refX,side)=>allPts.some((p,k)=>near(x,y,refX)(p,k)&&!(side<0?refX<p[0]-10:refX>p[0]+10));
  const pinX=(x,y,refX)=>{const f=allPts.filter((p,k)=>near(x,y,refX)(p,k)).sort((a,b)=>Math.abs(a[0]-refX)-Math.abs(b[0]-refX))[0];return f?f[0]:x;};
  for(const row of byRow.values()){if(!row.some(c=>ref.has(c)))continue;row.sort((a,b)=>a.source[0]-b.source[0]);
   // 1순위: 폐색 칸의 원본 좌표(전사)와 행 양 끝. 2순위: 역 구내 칸 — 1순위와 어긋나지 않을 때만 넣는다
   // 잘못 기록된 전사 걸러내기: 한 줄의 폐색 칸은 원본/PDF 폭 비율이 거의 같다 — 중앙값에서 크게 벗어나거나 앞 칸과 겹치면 버린다
   const blockRefs=row.filter(c=>isBlock(c)&&ref.has(c)),ratios=blockRefs.map(c=>(ref.get(c)[1]-ref.get(c)[0])/Math.max(1,c.source[2])).sort((a,b)=>a-b),med=ratios[ratios.length>>1]||1;
   const good=new Map();let prevEnd=-Infinity;
   for(const c of blockRefs){const [a,b]=ref.get(c);if(a<prevEnd-3)continue;good.set(c,[a,b]);prevEnd=b;}   /* 겹치는 전사만 버린다 (폭은 원본이 기준) */
   // 원본에서 맞닿은 두 칸의 경계가 서로 어긋나면(틈이 벌어지면) 가운데로 맞춘다
   const gl=[...good.keys()];for(let i=0;i<gl.length-1;i++){const A=gl[i],B=gl[i+1];if(B.source[0]-(A.source[0]+A.source[2])>8)continue;const ea=good.get(A),eb=good.get(B);if(eb[0]-ea[1]>12){const m=(ea[1]+eb[0])/2;ea[1]=m-3;eb[0]=m+3;}}
   const primary=[],secondary=[];
   for(const c of row){const s0=c.source[0],s1=c.source[0]+c.source[2];
    if(isBlock(c)&&good.has(c)){const [a,b]=good.get(c);primary.push([s0,a],[s1,b]);}
    else if(isBlock(c)){}
    else if(ref.has(c)&&L.xmap?.pinned?.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6)){const [a,b]=ref.get(c);secondary.push([s0,a],[s1,b]);}   /* overrides로 원본 위치를 직접 적은 칸은 그대로 */
    else if(ref.has(c)){const [a,b]=ref.get(c);secondary.push([s0,!pinned(c.x,c.y,a,-1)?a:pinX(c.x,c.y,a)],[s1,!pinned(c.x+c.width,c.y,b,1)?b:pinX(c.x+c.width,c.y,b)-BAR/2]);}
    else secondary.push([s0,c.x],[s1,c.x+c.width]);}
   if(!ref.has(row[0]))primary.push([row[0].source[0],row[0].x]);if(!ref.has(row.at(-1)))primary.push([row.at(-1).source[0]+row.at(-1).source[2],row.at(-1).x+row.at(-1).width]);   /* 행 끝 칸이 원본 좌표를 가지면 그쪽을 따른다 */
   const fit=list=>{list.sort((a,b)=>a[0]-b[0]);const out=[];for(const a of list){if(out.length&&a[0]-out.at(-1)[0]<.5)continue;if(out.length&&a[1]<=out.at(-1)[1])continue;out.push(a);}return out;};
   let mono=fit(primary);
   for(const a of secondary){const lo=[...mono].reverse().find(m=>m[0]<a[0]-.5),hi=mono.find(m=>m[0]>a[0]+.5);if(mono.some(m=>Math.abs(m[0]-a[0])<.5))continue;if((!lo||a[1]>lo[1]+4)&&(!hi||a[1]<hi[1]-4))mono=fit([...mono,a]);}
   if(mono.length<2)continue;
   for(const c of row){if(!isBlock(c)&&!ref.has(c))continue;const x0=knotAt(mono,c.source[0]),x1=knotAt(mono,c.source[0]+c.source[2]);if(x1-x0>8){c.x=x0;c.width=x1-x0;}/* 원본 좌표에 칸 사이 틈이 이미 들어 있다 */}}}
 // 원본처럼 화면 끝으로 나가는 선로는 그 행의 끝 회로 칸이 화면 끝까지 닿는다 (빈 선로 조각을 덧붙이지 않는다)
 for(const port of edgePorts){const [px,py]=T([port.x,port.y]);const row=cells.filter(c=>Math.abs(c.y-py)<3);if(!row.length)continue;
  if(port.side==='left'){const c=row.reduce((a,b)=>a.x<b.x?a:b);if(c.x>0&&c.x<220&&Math.abs(c.x-px)<30){c.width+=c.x;c.x=0;}}
  else{const c=row.reduce((a,b)=>a.x+a.width>b.x+b.width?a:b),r=c.x+c.width;const pinnedOther=port.code&&c.label&&port.code!==c.label.replaceAll(' · ','')&&L.xmap?.pinned?.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6);   /* 원본 위치를 적은 칸 뒤에 다른 회로(용산 BT 뒤 B610T)가 있으면 늘리지 않는다 */
   if(!pinnedOther&&r<WIDTH&&r>WIDTH-220&&Math.abs(r-px)<30)c.width=WIDTH-c.x;}}
 // 꺾인 모서리·분기 끝 바로 옆 칸은 그 모서리에서 틈 하나만 띄우고 시작한다 (행별 원본 배치로 벌어진 빈 선로를 없앤다, 서울 B903T·B904T)
 for(const [sx,sy,name] of L.xmap?.relabel||[]){const c=cells.find(c=>Math.abs(c.source[0]-sx)<1&&Math.abs(c.source[1]-sy)<1.5);if(c)c.forceLabel=name;}   // 표시 이름만 원본대로 (회로 식별은 그대로)
 // 'nT · 회로'처럼 두 회로가 한 칸으로 추출된 곳은 원본 경계에서 두 칸으로 나눈다 (노량진 1T·51AT, 3T·52AT, 4T·52BT)
 for(const [sx,sy,ox] of L.xmap?.splits||[]){const c=cells.find(c=>Math.abs(c.source[0]-sx)<1&&Math.abs(c.source[1]-sy)<1.5);if(!c)continue;
  const tokens=c.label.split(' · ').filter(Boolean);if(tokens.length<2)continue;const bx=L.adj(ox*WIDTH/L.xmap.width),end=c.x+c.width;if(bx<c.x+10||bx>end-10)continue;
  c.width=bx-c.x;c.label=c.forceLabel=tokens[0];cells.push({...c,x:bx,width:end-bx,label:tokens.slice(1).join(' · '),forceLabel:tokens.slice(1).join(' · ')});}
 // 원본: 꺾인 모서리는 앞 회로에 속하고, 모서리 바깥으로 짧은 꼬리(TAIL)를 낸 뒤 틈, 그다음 칸 (서울 B902T→B904T, B901T→B903T)
 const GAP=7,cornerGaps=[],cornerTails=[],TAIL=28;
 // 연결선(join)의 꺾인 곳이 누구 것인가: 반대쪽 끝이 이름 있는 선로 끝(또는 칸)에 붙어 있으면 그 회로의 꼬리(→ 꼬리 뒤에 틈),
 // 반대쪽 끝이 이름 없는 조각이면 꺾인 선 전체가 이쪽 칸의 회로 (→ 틈 없이 칸을 모서리까지, 노량진 B618T2T)
 const anchoredEnd=([x,y])=>def.rails.some(r=>[[r[1][0],r[3]],[r[1].at(-1),r[4]]].some(([p,code])=>code&&Math.abs(p[0]-x)<4&&Math.abs(p[1]-y)<4));
 if(L.xmap){const corners=[...def.rails.flatMap(r=>r[1].filter((p,i,a)=>(i>0&&Math.abs(a[i-1][1]-p[1])>=2)||(i<a.length-1&&Math.abs(a[i+1][1]-p[1])>=2)).map(p=>fixPt(p,T(p)))),...(data.joins||[]).flatMap(j=>j.slice(1,-1).map(p=>{const P=fixPt(p,T(p));const near=Math.abs(j[0][1]-p[1])<2?j.at(-1):j[0];P.own=!anchoredEnd(Math.abs(j[0][1]-p[1])<2?j.at(-1):j[0]);P.far=near;return P;}))];
  const hasRef=c=>L.xmap.cells.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6);
  for(const c of cells){const fixedC=hasRef(c);   /* 원본 위치를 아는 칸은 옮기지 않고 앞에 틈·꼬리만 */const others=cells.filter(o=>o!==c&&Math.abs(o.y-c.y)<3);
   const left=corners.filter(([x,y])=>Math.abs(y-c.y)<4&&x<c.x+4&&c.x-x<90&&!others.some(o=>o.x+o.width>x&&o.x+o.width<=c.x+1)).sort((a,b)=>b[0]-a[0])[0];
   if(left&&left.own&&!fixedC){const nx=left[0]+BAR/2;if(nx<c.x-1&&nx<c.x+c.width-24){c.width+=c.x-nx;c.x=nx;}}
   else if(left&&fixedC){if(c.x-(left[0]+BAR/2)>GAP+2){cornerGaps.push([c.x-GAP/2,c.y]);cornerTails.push([[left[0],c.y],[c.x,c.y]]);}}
   else if(left){const nx=left[0]+BAR/2+TAIL+7;if(Math.abs(nx-c.x)>1&&nx<c.x+c.width-24){c.width+=c.x-nx;c.x=nx;cornerGaps.push([nx-3.5,c.y]);cornerTails.push([[left[0],c.y],[nx,c.y]]);}}
   const right=corners.filter(([x,y])=>Math.abs(y-c.y)<4&&x>c.x+c.width-4&&x-(c.x+c.width)<90&&!others.some(o=>o.x<x&&o.x>=c.x+c.width-1)).sort((a,b)=>a[0]-b[0])[0];
   if(right&&right.own&&!fixedC){const nr=right[0]-BAR/2;if(nr>c.x+c.width+1)c.width=nr-c.x;}
   else if(right&&fixedC){if((right[0]-BAR/2)-(c.x+c.width)>GAP+2){cornerGaps.push([c.x+c.width+GAP/2,c.y]);cornerTails.push([[c.x+c.width,c.y],[right[0],c.y]]);}}
   else if(right){const nr=right[0]-BAR/2-TAIL-7;if(Math.abs(nr-(c.x+c.width))>1&&nr>c.x+24){c.width=nr-c.x;cornerGaps.push([nr+3.5,c.y]);cornerTails.push([[nr,c.y],[right[0],c.y]]);}}}}
 // 회로 칸 사이 틈 (원본 LS): 같은 줄의 서로 다른 회로 경계마다 같은 폭(GAP)의 틈을 두고, 신호기·입환표지는 그 틈에 선다.
 // 떼지 않는 곳: 같은 회로 조각(이름이 같은 칸), 승강장 열번창과 그 nT(한 회로), 꺾인 연결·분기 사선(칸 끝에 붙음).
 const cellGaps=[...cornerGaps,...(L.xmap?.gaps||[]).map(([sx,py])=>[L.adj(sx*WIDTH/L.xmap.width),T([0,py])[1]])];   /* 칸 없이 선로만 있는 곳의 원본 틈 (노량진 4T 괄호 사이) */
 if(!neighbours.overview){
  const sigX=def.signals.map(([id,rail,x])=>{const [X,Y]=T([x,railY(def,rail,x)]);return {id,X,Y};});
  const rowMap=new Map();for(const c of cells){const k=[...rowMap.keys()].find(y=>Math.abs(y-c.y)<3)??c.y;if(!rowMap.has(k))rowMap.set(k,[]);rowMap.get(k).push(c);}
  for(const [y,row] of rowMap){row.sort((a,b)=>a.x-b.x);
   for(let i=0;i<row.length-1;i++){const L1=row[i],R1=row[i+1],end=L1.x+L1.width,gap=R1.x-end;
    if(gap>30||gap<-Math.min(L1.width,R1.width)*.5)continue;   // 멀리 떨어진 칸(사이에 분기·다른 선로)은 그대로
    if(L1.label&&L1.label===R1.label){if(gap>0)L1.width=R1.x-L1.x;continue;}
    const platSlot=n=>/^\d+T$/.test(n)&&(trainWindows.data[st.id]||[]).some(w=>w.side==='inline'&&(w.slot===n||w.code===n));
    if((!L1.label&&platSlot(R1.label))||(!R1.label&&platSlot(L1.label))){if(gap>0)L1.width=R1.x-L1.x;continue;}   // 승강장 칸과 그 nT는 한 회로   // 같은 회로 조각은 잇는다
    /* overrides로 원본 위치를 적은 두 칸이 틈보다 넓게 떨어져 있으면(사이에 괄호·세로 선로) 옮기지 않고 양쪽 끝에 틈을 둔다 (구로 52BT·52AT) */
    const pin=c=>!!L.xmap?.pinned?.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6);
    if(gap>GAP+4&&pin(L1)&&pin(R1)){cellGaps.push([end+GAP/2,y],[R1.x-GAP/2,y]);continue;}
    let b=(end+R1.x)/2;   /* 경계는 칸(원본 배치)이 정한다; 신호기는 아래에서 이 틈으로 옮긴다 */
    b=Math.max(L1.x+12,Math.min(R1.x+R1.width-12,b));const r=R1.x+R1.width;L1.width=b-GAP/2-L1.x;R1.x=b+GAP/2;R1.width=r-R1.x;cellGaps.push([b,y]);}}}
 // 틈 열(여러 선로의 틈이 한 세로줄로 맞춰진 곳)을 찾고, 승강장 옆 열은 하나로 모아 칸 경계도 함께 옮긴다 (칸을 그리기 전에)
 const gapColumns=(()=>{
  const columns=[];for(const [gx] of cellGaps){const col=columns.find(c=>Math.abs(c.x-gx)<12);if(col){col.n++;col.x+=(gx-col.x)/col.n;}else columns.push({x:gx,n:1});}
  // 승강장 열번창(원본 위치)의 좌우 끝 — nT 칸 바로 뒤가 틈 열이다
  const platRows=(trainWindows.data[st.id]||[]).filter(w=>w.side==='inline'&&/^\d+T$/.test(w.slot||w.code)).map(w=>{const r=def.rails.find(r=>r[0]===(w.slot||w.code));if(!r||r[2]==null)return null;const P=T([r[2],railY(def,r[0],r[2])]);
   const cx=L.xmap&&w.sourceWindow&&w.slide===L.xmap.slide?L.adj((w.sourceWindow[0]+w.sourceWindow[2]/2)*WIDTH/L.xmap.width):P[0];return [cx,P[1]];}).filter(Boolean);
  const platX=x=>platRows.length?Math.min(...platRows.map(([px])=>Math.min(Math.abs(px+50-x),Math.abs(px-50-x)))):Infinity;
  // 승강장 옆에서 40px 안에 두 열이 생기면 승강장에 가까운 열 하나로 모은다 (원본: nT 칸 바로 뒤 한 줄)
  let strong=columns.filter(c=>(c.n>=3||(c.n>=2&&platX(c.x)<120))&&platX(c.x)>=35).sort((a,b)=>platX(a.x)-platX(b.x));   /* nT 칸 자리(열번창 끝에서 35px 이상)는 남긴다 */   /* 승강장 바로 옆은 두 줄만 맞아도 열 */const kept=[];for(const c of strong)if(!kept.some(k=>Math.abs(k.x-c.x)<40&&platX(c.x)<250))kept.push(c);strong=kept;
  /* overrides로 원본 위치를 직접 적은 두 칸 사이 경계는 열에 맞추려고 옮기지 않는다 (금천구청 3T 24AT|25AT는 5T·6T 열과 원본에서도 어긋나 있다) */
  const refd=c=>!!L.xmap?.pinned?.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6),bothRef=g=>{const near=cells.filter(c=>Math.abs(c.y-g[1])<3);const a=near.find(c=>Math.abs(c.x+c.width-(g[0]-GAP/2))<6),b=near.find(c=>Math.abs(c.x-(g[0]+GAP/2))<6);return (a||b)&&(!a||refd(a))&&(!b||refd(b));};   /* 한쪽이 꺾임 꼬리면 칸 쪽만 본다 */
  for(const k of strong){if(platX(k.x)>=250)continue;for(const g of cellGaps){if(Math.abs(g[0]-k.x)>=40||Math.abs(g[0]-k.x)<=3||!platRows.some(([,py])=>Math.abs(py-g[1])<3)||bothRef(g))continue;
   for(const c of cells){if(Math.abs(c.y-g[1])>=3)continue;if(Math.abs(c.x+c.width-(g[0]-GAP/2))<6)c.width=k.x-GAP/2-c.x;else if(Math.abs(c.x-(g[0]+GAP/2))<6){const r=c.x+c.width;c.x=k.x+GAP/2;c.width=r-c.x;}}g[0]=k.x;}}
  return {strong,platRows,platX};})();
 // Platform glyphs keep a readable size and a consistent offset from their rail.
 /* 원본 좌표로 고정한 승강장(ls-xmap-overrides platforms)은 원본 x 그대로 */
 const pinPlat=(p,box)=>{const q=(L.xmap?.platforms||[]).find(q=>Math.abs(q[0]-p[0])<1&&Math.abs(q[1]-p[1])<1);if(q){box.x=L.adj(q[2]*WIDTH/L.xmap.width);box.right=L.adj(q[3]*WIDTH/L.xmap.width);box.pinned=true;}return box;};
 const coreXs=def.rails.flatMap(r=>r[1].map(p=>p[0])),platformBoxes=wing.platforms.map(p=>pinPlat(p,(()=>{
  const [x,a]=T([p[0],p[1]]),[right,b]=T([p[2],p[3]]),mid=(p[0]+p[2])/2,central=!prepared.corridor&&(p[3]-p[1]>=15||p[6]==='central')&&mid>=Math.min(...coreXs)&&mid<=Math.max(...coreXs);   // p[6]: 두 선로 사이 섬식 승강장(높이가 낮아도 구내 승강장)
  const height=p[6]==='central'?Math.max(4,b-a):Math.max(8,Math.min(central?64:16,b-a));let y=(a+b-height)/2;
  // 한쪽 승강장(선로 하나에만 붙은 고상·저상 표시): 화면이 세로로 늘어나도 그 선로 승강장 칸 바로 위/아래에 얇게 붙인다 (종각·노량진 1T 위 등)
  if(central&&p[6]!=='central'){const cy=(p[1]+p[3])/2,srcRows=[...new Set(rows)],near=srcRows.filter(r=>Math.abs(r-cy)<40).sort((u,v)=>Math.abs(u-cy)-Math.abs(v-cy))[0];
   if(near!==undefined){const above=cy<near,opposite=srcRows.some(r=>above?(r<cy&&cy-r<60):(r>cy&&r-cy<60));
    if(!opposite){const [,ry]=T([p[0],near]),h=10;
     // 그 선로 승강장 칸(열번창, 폭 100)과 같은 폭·위치로
     const rail=def.rails.find(r=>r[2]!=null&&Math.abs(railY(def,r[0],r[2])-near)<2&&Math.abs(r[2]-(p[0]+p[2])/2)<80);let bx=x,br=right;if(rail){let [cx]=T([rail[2],near]);const sw=L.xmap&&(trainWindows.data[st.id]||[]).find(w=>w.side==='inline'&&(w.slot===rail[0]||w.code===rail[0])&&w.sourceWindow&&w.slide===L.xmap.slide);if(sw)cx=L.adj((sw.sourceWindow[0]+sw.sourceWindow[2]/2)*WIDTH/L.xmap.width);bx=cx-50;br=cx+50;}
     return {x:bx,y:above?ry-14-3-h:ry+14+3,right:br,height:h,kind:p[4],central:true,row:null,side:true};}}}
  // 구내 승강장 표시는 원본처럼 그 승강장 선로 열번창(폭 100)과 같은 폭·위치로 맞춘다 (청량리·동묘앞 등 섬식)
  if(central){const cy=(p[1]+p[3])/2,rail=def.rails.filter(r=>/^\d+T$/.test(r[0])&&r[2]!=null&&Math.abs(railY(def,r[0],r[2])-cy)<70&&Math.abs(r[2]-mid)<120).sort((u,v)=>Math.abs(railY(def,u[0],u[2])-cy)-Math.abs(railY(def,v[0],v[2])-cy))[0];if(rail){const [cx]=T([rail[2],cy]);const sw=L.xmap&&(trainWindows.data[st.id]||[]).find(w=>w.side==='inline'&&(w.slot===rail[0]||w.code===rail[0])&&w.sourceWindow&&w.slide===L.xmap.slide),x0=sw?L.adj((sw.sourceWindow[0]+sw.sourceWindow[2]/2)*WIDTH/L.xmap.width):cx;
   /* 한 승강장이 두 색(하늘색·주황)으로 나뉘면 원본처럼 열번창 폭 100을 원본 길이 비율로 나눈다 (안양 2T·3T 사이) */
   const grp=wing.platforms.filter(q=>Math.abs((q[1]+q[3])/2-cy)<4&&q[2]>=p[0]-80&&q[0]<=p[2]+80&&q[6]!=='central');const gx0=Math.min(...grp.map(q=>q[0])),gx1=Math.max(...grp.map(q=>q[2]));
   if(grp.length>1&&gx1-gx0<120){const f=v=>x0-50+100*(v-gx0)/(gx1-gx0);const nx=grp.map(q=>q[0]).filter(v=>v>p[2]-1&&v-p[2]<4)[0];return {x:f(p[0]),y,right:f(nx??p[2]),height,kind:p[4],central,row:null};}
   return {x:x0-50,y,right:x0+50,height,kind:p[4],central,row:null};}}
  let row=null;if(!central){const cell=cells.filter(c=>c.x<right&&c.x+c.width>x).sort((c,d)=>Math.abs(c.y-(a+b)/2)-Math.abs(d.y-(a+b)/2))[0];if(cell){row=cell.y;y=prepared.corridor?cell.y+p[5]-height/2:L.xmap?.platformAdjacent?cell.y+((a+b)/2<cell.y?-BAR/2-4-height:BAR/2+4):cell.y+((a+b)/2<cell.y?-28-height:28);}}   /* platformAdjacent: 원본처럼 칸 바로 위/아래(폐색 표식 띠)에 (지하청량리~지하서울) */
  return {x,y,right,height,kind:p[4],central,row};
 })()));
 // 원본 좌표 화면: 같은 열에 쌓인 구내 승강장은 한쪽 승강장(맨 아래 등)도 원본처럼 같은 높이로 (서울 7T 아래)
 if(L.xmap)for(const pb of platformBoxes){if(!pb.central)continue;const hs=platformBoxes.filter(q=>q!==pb&&q.central&&!q.side&&Math.abs(q.x-pb.x)<2&&Math.abs(q.right-pb.right)<2).map(q=>q.height),H=hs.find(h=>hs.filter(v=>Math.abs(v-h)<.5).length>=3);if(H&&pb.height<H-.5)pb.height=H;}   // 같은 높이 승강장이 셋 이상 쌓인 열에서만
 // 중간역 승강장(고상홈) 표시는 그 역의 정차 회로(line.js INTERMEDIATE의 전동선 ED·EU) 가운데에 붙인다.
 // 원본 좌표 그대로 두면 역간 폐색 회로가 화면에서 고르게 다시 배치될 때 옆 회로로 어긋난다 (노량진 신길 B938T).
 const tokenCentre=code=>cells.flatMap(c=>{const t=c.label.split(' · ').filter(Boolean),k=t.indexOf(code);return k<0&&c.label.replaceAll(' · ','')!==code?[]:[{cx:k<0?c.x+c.width/2:c.x+c.width*(k+.5)/t.length,y:c.y}];});
 const stops=Object.entries(lineInfo()?.INTERMEDIATE||{}).filter(([,v])=>v.host===st.id).flatMap(([id,v])=>Object.entries(v.slots).filter(([trunk])=>/^[EM]/.test(trunk)).map(([trunk,code])=>({id,name:networkInfo()?.catalog?.[id]?.name,trunk,code})));
 for(const pb of platformBoxes){if(pb.central||pb.row===null)continue;const mid=(pb.x+pb.right)/2;
  const hit=stops.flatMap(s=>tokenCentre(s.code).filter(c=>Math.abs(c.y-pb.row)<3).map(c=>({...s,cx:c.cx}))).sort((a,b)=>Math.abs(a.cx-mid)-Math.abs(b.cx-mid))[0];
  if(hit&&Math.abs(hit.cx-mid)<200){if(!pb.pinned){const w=pb.right-pb.x;pb.x=hit.cx-w/2;pb.right=hit.cx+w/2;}pb.stop=hit;}}   /* 원본 x로 고정한 승강장은 자리는 두고 정차역만 잇는다 */
 // 중간역 이름판은 그 역 하선 승강장 표시 위(열번칸 자리를 띄우고)에 둔다. 위쪽 선로와 겹치면 예전처럼 화면 위 띠에 둔다.
 // 이름판도 화면 좌우 끝 선로명 자리(62px)는 비운다
 const plateX=(x,w)=>Math.max(62+w/2,Math.min(WIDTH-62-w/2,x));
 const plateAt=(plate,x)=>{const v=L.xmap?.captions?.[plate.name];if(Array.isArray(v))return L.adj((v[0]+v[1])/2*WIDTH/L.xmap.width);return v?L.adj(v*WIDTH/L.xmap.width):x;};
 const plateW=(plate,w)=>{const v=L.xmap?.captions?.[plate.name];return Array.isArray(v)?L.adj(v[1]*WIDTH/L.xmap.width)-L.adj(v[0]*WIDTH/L.xmap.width):w;};   /* [왼쪽, 오른쪽]이면 폭도 원본대로 */   /* 원본 화면 가운데 x를 아는 이름판 (금천구청 석수) */
 // 하선 승강장 표시가 없는 중간역 이름판(서울 남영 등)은 원본처럼 이름판 아래 첫 선로의 열번칸 바로 위에 둔다.
 const plateOverRow=(plate,fallback)=>{const [a]=T([plate.box[0],0]),[b]=T([plate.box[2],0]),w=Math.max(b-a,plate.name.length*16+18),w2=w,mid=(a+b)/2;
  const under=cells.filter(c=>c.x<mid+w/2&&c.x+c.width>mid-w/2).sort((p,q)=>p.y-q.y)[0];if(!under)return fallback;
  /* 원본처럼 이름판 → 열번칸 → 폐색 표식 → 선로 순서: 이름판 아래에 원본 열번칸이 오면 그 띠(폐색 표식 위로 밀린 높이까지)를 비운다 (금천구청 석수 · B974T) */
  const winUnder=L.xmap&&visibleWindows.some(w=>w.side==='above'&&w.sourceWindow&&w.slide===L.xmap.slide&&(()=>{const a=L.adj(w.sourceWindow[0]*WIDTH/L.xmap.width),b=L.adj((w.sourceWindow[0]+w.sourceWindow[2])*WIDTH/L.xmap.width);return a<mid+w2/2&&b>mid-w2/2;})());
  const y=under.y-(winUnder?96:84);return y>=8&&!cells.some(c=>c.y<under.y-4&&c.y>y-12&&c.x<mid+w/2+20&&c.x+c.width>mid-w/2-20)?y:fallback;};
 const plateY=(plate,fallback)=>{const own=platformBoxes.filter(pb=>pb.stop?.name===plate.name&&pb.y<pb.row).sort((a,b)=>a.y-b.y)[0];if(!own)return plateOverRow(plate,fallback);
  const y=own.y-84,mid=(own.x+own.right)/2,half=Math.max(own.right-own.x,plate.name.length*16+18)/2+6,above=Math.max(-Infinity,...cells.filter(c=>c.x<mid+half&&c.x+c.width>mid-half).map(c=>c.y).filter(v=>v<own.row-3));return y-4>above+BAR/2?y:fallback;};
 // Fixed source symbols use the same transform as rails; they never mutate interlocking state.
 const bracketBoxes=wing.fixed.brackets.map(b=>{
  const [x,y,w,h]=b.bounds;let cx=T([x+w/2,y])[0];
  { /* 괄호 표식은 그 사이를 지나는 수직선에 맞춘다 */ const v=(L.xmap?.railPoints||[]).filter(([fx])=>Math.abs(fx-(x+w/2))<12).sort((a,b)=>Math.abs(a[0]-x-w/2)-Math.abs(b[0]-x-w/2))[0];if(v)cx=L.adj(v[2]*WIDTH/L.xmap.width); }
  const crossed=[...new Set(rows.filter(row=>row>=y-5&&row<=y+h+5))];
  const top=crossed.length?T([x,Math.min(...crossed)])[1]-17:T([x,y])[1];
  const bottom=crossed.length?T([x,Math.max(...crossed)])[1]+17:T([x,y+h])[1];
  return {...b,box:[cx-14,top,cx+14,bottom]};
 });
 // Presentation follows the yard tracks, rather than treating raster text centres as a layout grid.
 // Matching above/below bays share a centreline and a 90px centre-to-rail offset.
 const captionAnchors={
  'gunja-out':{rail:'CT',side:-1},'gunja-in':{rail:'DT',side:1},
  'freight-a':{rail:'1T',side:-1,end:716},'freight-b':{rail:'6T',side:1,start:201,end:716}
 };
 const captionBlockers=def.signals.map(([id,rail,x,lampY])=>{const [X,Y]=T([x,lampY]);return [X-48,Y-12,X+48,Y+12];});
 const captionBoxes=wing.fixed.captions.map(c=>{
  const notesW=c.notes?Math.max(...c.notes.map(t=>t.length))*13+18+22:0,w=Math.max(...c.lines.map(t=>t.length))*15+32+notesW;   /* 22: 원본 두 글자 열 사이 간격 */let h=c.lines.length*22+20;
  let [x,y]=T(c.at);const anchor=captionAnchors[c.id];
  if(anchor){const rail=def.rails.find(r=>r[0]===anchor.rail),left=rail[1][0],end=anchor.end??rail[1].at(-1)[0];[x,y]=T([((anchor.start??left[0])+end)/2,left[1]]);y+=anchor.side*(L.xmap?.captions?.[c.id]?h/2+12:90);}   /* 원본 위치를 아는 화면은 그 선로 바로 옆 (동묘앞 군자기지 출고선·입고선) */
  { /* 원본 화면 위치를 아는 역은 그 가로 위치에 둔다 (의왕 남부화물기지 A·B선) */ const v=L.xmap?.captions?.[c.id];if(v)x=L.adj(v*WIDTH/L.xmap.width); }
  if(c.id==='depot-lead'){
   const a=def.rails.find(r=>r[4]==='F1T')[1].at(-1),b=def.rails.find(r=>r[0]==='4T')[1].at(-1);
   const right=T([Math.max(a[0],b[0]),a[1]])[0];y=(T(a)[1]+T(b)[1])/2;x=right+32+w/2;
   /* 원본: 글자 줄이 F1T·F2T 선로 높이에 하나씩 (차량기지 [경인 하선] / 입출고선 [경인 상선]) */
   c={...c,rowYs:[T(a)[1],T(b)[1]]};h=Math.abs(T(b)[1]-T(a)[1])+40;
   { const v=L.xmap?.captions?.[c.id];if(v)x=L.adj(v*WIDTH/L.xmap.width); }
  }
  const preferred=y,direction=anchor?.side||1;for(const offset of [0,...Array.from({length:10},(_,i)=>(i+1)*14*direction),...Array.from({length:10},(_,i)=>-(i+1)*14*direction)]){const next=preferred+offset,box=[x-w/2,next-h/2,x+w/2,next+h/2];if(box[1]<8||captionBlockers.some(other=>intersects(box,other,6)))continue;y=next;break;}
  const box=[x-w/2,y-h/2,x+w/2,y+h/2];captionBlockers.push(box);return {...c,x,y,box,notesW};
 });
 // Keep bottom captions within the same comfortable canvas inset as the upper bays.
 L.H=Math.max(L.H,...captionBoxes.map(c=>Math.ceil(c.box[3]+12)));   /* 화면 높이를 넘으면 그림 전체가 줄어든다 (동묘앞·의왕 98%) */
 const fixedObstacles=[...bracketBoxes.map(b=>b.box),...captionBoxes.map(c=>c.box)];
 const switches=switchView.build(st,def,core,model,Tw,{width:WIDTH});
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
 const snapJoin=([x,y])=>{const nearest=rows.filter(row=>Math.abs(row-y)<2).sort((a,b)=>Math.abs(a-y)-Math.abs(b-y))[0];return fixPt([x,y],T([x,nearest??y]));};
 // 꺾인 연결선의 가로 구간이 화면에서 0 길이로 겹치면(양 끝이 같은 세로 선로에 고정) 모서리 바깥 칸이 비어 계단처럼 보인다:
 // 원래 가로였던 방향으로 짧은 앞 구간을 붙여 모서리를 채운다 (노량진 B930T·B929T·B619T1T)
 const fillCorner=(src,pts)=>{const out=pts.filter((p,i)=>!i||Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>.5);
  const fix=(a,b,srcA,srcB)=>Math.abs(srcA[1]-srcB[1])<2&&Math.abs(srcA[0]-srcB[0])>2&&Math.abs(a[0]-b[0])<1?Math.sign(srcB[0]-srcA[0]):0;
  if(out.length>=2&&src.length>=2&&Math.abs(out[0][0]-out[1][0])<1){const d=fix(pts[0],pts[1],src[0],src[1]);if(d)out.unshift([out[0][0]-d*BAR/2,out[0][1]]);}
  const n=out.length,m=src.length;if(n>=2&&m>=2&&Math.abs(out[n-1][0]-out[n-2][0])<1){const d=fix(pts.at(-2),pts.at(-1),src[m-2],src[m-1]);if(d)out.push([out[n-1][0]+d*BAR/2,out[n-1][1]]);}
  return out;};
 const paths=[...def.rails.map(r=>r[1].map(p=>fixPt(p,T(p)))),...(data.joins||[]).map(poly=>fillCorner(poly,poly.map(snapJoin)))];
 paths.push(...cornerTails);   // 모서리 꼬리 (앞 회로 색으로 이어진다)
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
 // 꺾이는 곳 정리: 회로 칸 줄로 만든 가로선이 선로가 수직·사선으로 꺾이는 꼭짓점 바깥으로 삐져나오면(원본 회로 사각형이 모서리 앞에서 시작)
 // 그 꼭짓점에서 자른다 — 꺾인 하나의 선으로 보이게. 같은 줄을 계속 잇는 다른 선로가 있으면 자르지 않는다.
 const railPolys=paths.slice(0,def.rails.length+(data.joins||[]).length),STUB=40;   // 선로 + 검토된 연결선(joins)의 꺾인 곳
 const horizontalCovers=(y,a,b)=>railPolys.some(poly=>poly.slice(1).some((q,i)=>{const p=poly[i];return Math.abs(p[1]-y)<2&&Math.abs(q[1]-y)<2&&Math.min(p[0],q[0])<a+1&&Math.max(p[0],q[0])>b-1;}));
 const bends=[];for(const poly of railPolys)poly.forEach((v,i)=>{const prev=poly[i-1],next=poly[i+1];for(const [h,o] of [[prev,next],[next,prev]]){if(!h||!o)continue;if(Math.abs(h[1]-v[1])<2&&Math.abs(o[1]-v[1])>=2)bends.push({x:v[0],y:v[1],inside:Math.sign(h[0]-v[0])});}});
 let trimmedStubs=0;
 for(let k=def.rails.length+(data.joins||[]).length;k<paths.length;k++){const seg=paths[k],y=seg[0][1];
  for(const b of bends){if(Math.abs(b.y-y)>=2)continue;
   if(b.inside>0&&seg[0][0]<b.x-.5&&seg[0][0]>b.x-STUB&&seg[1][0]>b.x&&!horizontalCovers(y,seg[0][0],b.x)){seg[0][0]=b.x;trimmedStubs++;}
   if(b.inside<0&&seg[1][0]>b.x+.5&&seg[1][0]<b.x+STUB&&seg[0][0]<b.x&&!horizontalCovers(y,b.x,seg[1][0])){seg[1][0]=b.x;trimmedStubs++;}
  }}
 let platforms='',rails='',sections='',labels='',routes='',symbols='',plates='',pointSymbols='',signalSymbols='',trains='',leaders='',annotations='';
 const occupiedBoxes=fixedObstacles.map(b=>[...b]);
 let trainShapes='';
 const layoutKey=st.id+':'+!!neighbours.overview+':'+(neighbours.preset||'')+':'+L.H+':'+L.sy;
 let cached=windowLayouts.get(def)?.get(layoutKey);
 if(!cached){
 const windowBoxes=[];
 const sigObsList=def.signals.map(([id,rail,x,y,dir])=>{const [X,Y]=sigBase(id,T([x,y]));return [X-48,Y-11,X+48,Y+11];});
 const obstacles=[...fixedObstacles,...cells.map(c=>[c.x,c.y-BAR/2,c.x+c.width,c.y+BAR/2]),...platformBoxes.map(p=>[p.x,p.y,p.right,p.y+p.height]),...sigObsList];
 const capsulePositions=blockView.build(st,def,cells,T,prepared.split);
 for(const b of capsulePositions)obstacles.push(b.box);
 const capsuleBoxes=new Set(capsulePositions.map(b=>b.box));   // 열번칸 자리 찾기: 원본 좌표 화면에서는 폐색 표식 상자를 2px만 좁혀 본다(그려진 폭 ±18)
 for(const item of visibleWindows){
  const code=item.anchorCode||item.code,inline=item.side==='inline';
  const cell=cells.find(c=>c.label.split(' · ').includes(code)||c.label.replaceAll(' · ','')===code);
  const rail=def.rails.find(r=>r[0]===code||r[3]===code||r[4]===code);
  let cx,cy,beside=false;
  if(inline&&rail?.[0]===code){[cx,cy]=T([rail[2]??(rail[1][0][0]+rail[1].at(-1)[0])/2,railY(def,code,rail[2]??rail[1][0][0])]);}
  // 열번칸은 자기 회로의 가운데에 둔다 (원본 슬라이드의 비율은 우리 화면의 회로 폭과 맞지 않아 옆 회로·폐색 표식 위로 밀린다)
  // 원본에서 회로 밖(선로 끝 옆)에 있는 칸(예: 청량리 MT, 비율 -0.5)은 그 선로 끝 옆, 선로 높이에 둔다
  else if(cell&&(item.fraction<-.2||item.fraction>1.2)){cx=item.fraction<0?cell.x-46:cell.x+cell.width+46;cy=cell.y;beside=true;}
  else if(cell){const tokens=cell.label.split(' · ').filter(Boolean),k=Math.max(0,tokens.indexOf(code));cx=tokens.length>1&&tokens.includes(code)?cell.x+cell.width*(k+.5)/tokens.length:cell.x+cell.width/2;cy=cell.y;}
  else if(rail){const p=rail[3]===code?rail[1][0]:rail[4]===code?rail[1].at(-1):[rail[2],railY(def,rail[0],rail[2])];[cx,cy]=T(p);cx+=rail[3]===code?42:rail[4]===code?-42:0;}
  else throw new Error(st.id+' train window anchor missing: '+code);
  // 가로 좌표가 원본 화면과 같은 역 화면에서는 열번칸을 원본 슬라이드의 그 자리에 둔다 (선로 끝 옆 칸 포함: 지하청량리 MT)
  if(L.xmap&&item.sourceWindow&&item.slide===L.xmap.slide)cx=L.adj((item.sourceWindow[0]+item.sourceWindow[2]/2)*WIDTH/L.xmap.width);
  /* 원본 좌표 화면에서는 떨어진 열번칸도 원본 폭(슬라이드 112px ≈ 94)으로 그린다 */
  const srcW=L.xmap&&!inline&&item.sourceWindow&&item.slide===L.xmap.slide?Math.round(item.sourceWindow[2]*WIDTH/L.xmap.width):0;
  const width=inline?100:Math.max(80,Math.min(100,srcW)),height=inline?28:20;
  const x=Math.max(4,Math.min(WIDTH-width-4,cx-width/2)),y=cy+(inline?-height/2:item.side==='above'?-50:30);
  windowBoxes.push({item,inline,x,y:beside?cy-10:y,width,height:beside?20:height,cy,beside});
 }
 // A shared baseline for each rail/side prevents staircase placement. Reserve signals and platforms first.
 const windowTop=Math.min(...paths.flat().map(p=>p[1]));
 for(const plate of wing.plates){const [a]=T([plate.box[0],0]),[b]=T([plate.box[2],0]),own=platformBoxes.filter(pb=>pb.stop?.name===plate.name).sort((a,b)=>a.y-b.y)[0],w=plateW(plate,Math.max(b-a,plate.name.length*16+18)),x=plateAt(plate,plateX(own?(own.x+own.right)/2:(a+b)/2,w)),py=plateY(plate,Math.max(8,windowTop-plateGap));obstacles.push([x-w/2,py,x+w/2,py+25]);}
 for(const [x,y,kind]of data.markers){const [X]=T([x,y]),Y=Math.max(44,windowTop-44,T([x,y])[1]);obstacles.push([X-17,Y-26,X+17,Y+26]);}
 // 화면 좌우 끝 선로명(하1선·상1선 …)이 들어갈 자리를 먼저 비워 둔다: 하선 이름은 선로 위, 상선 이름은 선로 아래 (ls-seams와 같은 규칙)
 for(const p of edgePorts){if(true)continue;   /* 선로명 표기 삭제(원본에 없음): 자리 예약도 하지 않는다 */const [,py]=T([p.x,p.y]),lw=p.name.includes(' · ')?104:48,lx=p.side==='left'?6:WIDTH-6-lw,dy=/^상/.test(p.name)?34:-18;obstacles.push([lx-8,py+dy-22,lx+lw+8,py+dy+11]);/* 창 상자(±3)와 이름 검사(±3) 여유까지 */}
 /* 원본 좌표로 고정한 칸 위 열번칸은, 그 x 위/아래로 실제로 지나가는 이웃 선로가 다르면 다른 줄(lane)로 둔다.
    원본도 그렇다: 구로 B628T 위 열번칸은 55T 줄이 없는 곳이라 오른쪽 열번칸보다 높이 있다. */
 /* 20px 넘게 걸친 고정 칸만 본다 (종각 B043T 열번칸은 AT 고정 칸 끝에 2px 걸칠 뿐) */
 const pinnedUnder=b=>cells.some(c=>Math.abs(c.y-b.cy)<3&&Math.min(c.x+c.width,b.x+b.width)-Math.max(c.x,b.x)>=20&&L.xmap?.pinned?.some(e=>Math.abs(e[0]-c.source[0])<.6&&Math.abs(e[1]-c.source[1])<.6));
 const laneNeighbour=b=>{const x0=b.x-20,x1=b.x+b.width+20,ys=[...new Set([...cells.filter(c=>c.x<x1&&c.x+c.width>x0).map(c=>Math.round(c.y)),...paths.flatMap(pts=>pts.slice(1).flatMap((p,i)=>Math.abs(p[1]-pts[i][1])<2&&Math.min(p[0],pts[i][0])<x1&&Math.max(p[0],pts[i][0])>x0?[Math.round(p[1])]:[]))])];
  return b.item.side==='above'?Math.max(-Infinity,...ys.filter(y=>y<b.cy-3)):Math.min(Infinity,...ys.filter(y=>y>b.cy+3));};
 const windowObs=new Set(),windowLanes=new Map();for(const b of windowBoxes.filter(b=>b.beside))obstacles.push([b.x,b.y,b.x+b.width,b.y+b.height]);for(const b of windowBoxes.filter(b=>!b.inline&&!b.beside)){const key=b.cy.toFixed(0)+b.item.side+(L.xmap&&pinnedUnder(b)?'|'+laneNeighbour(b):'');b.lane=key;if(!windowLanes.has(key))windowLanes.set(key,[]);windowLanes.get(key).push(b);}
 // 원본 좌표 화면: 같은 높이 띠라도 멀리 떨어진 열번칸 무리는 높이를 따로 정한다(한쪽 끝 장애물이 반대쪽 끝까지 밀지 않게).
 if(L.xmap)for(const [key,lane] of [...windowLanes]){if(!key.includes('|'))continue;lane.sort((a,b)=>a.x-b.x);let part=0;lane.forEach((b,i)=>{if(i&&b.x-(lane[i-1].x+lane[i-1].width)>400)part++;if(part){const k=key+'#'+part;b.lane=k;if(!windowLanes.has(k))windowLanes.set(k,[]);windowLanes.get(k).push(b);}});windowLanes.set(key,lane.filter(b=>b.lane===key));}
 for(const lane of windowLanes.values()){
  // 열번칸은 자기 선로와 그쪽 이웃 선로 사이(띠)에만 둔다 — 다른 선로를 건너가지 않는다. 띠 안에서는 선로에 가장 가까운 빈자리.
  const side=lane[0].item.side,cy=lane[0].cy,H=20,trackRows=[...new Set(cellRows.map(r=>Math.round(r.y)).concat(rows.map(y=>Math.round(T([0,y])[1]))))];
  const neighbour=lane[0].lane.includes('|')?laneNeighbour(lane[0]):side==='above'?Math.max(-Infinity,...trackRows.filter(y=>y<cy-3)):Math.min(Infinity,...trackRows.filter(y=>y>cy+3));
  /* 원본 좌표 화면에서 줄 간격이 좁으면(넓은 창의 구로 등) 원본처럼 선로에 바짝(1px) 붙여서라도 줄 사이에 둔다: 안 그러면 다른 선로 너머로 밀린다 */
  const m0=3,m1=L.xmap&&Number.isFinite(neighbour)&&Math.abs(neighbour-cy)-BAR-2*m0-H<0?1:m0;
  const near=BAR/2+m1,far=Number.isFinite(neighbour)?Math.abs(neighbour-cy)-BAR/2-m1-H:110;
  const band=far>=near?Array.from({length:Math.floor((far-near)/2)+1},(_,i)=>side==='above'?-(near+H+i*2):near+i*2):[];
  const EDGE=4,preferred=side==='above'?-50:30,wide=Array.from({length:41},(_,i)=>side==='above'?-28-i*2:20+i*2).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
  const search=(deltas,inBand)=>{let best;
   for(const dy of deltas){let cost=0,choices=[];
    for(const b of lane){let chosen;
     candidates:for(const width of [...new Set([b.width,80,64,56,48])])for(const dx of [0,-8,8,-16,16,-24,24,-32,32,-48,48,-64,64]){
      const x=Math.max(EDGE,Math.min(WIDTH-width-EDGE,b.x+(b.width-width)/2+dx)),y=b.cy+dy,box=[x,y,x+width,y+20],hits=[...obstacles,...choices.map(c=>[c.x,c.y,c.x+c.width,c.y+20]),...lane.filter(other=>other!==b).map(other=>[other.x+other.width/2-24,y,other.x+other.width/2+24,y+20])].filter(o=>intersects(box,L.xmap&&capsuleBoxes.has(o)?[o[0]+2,o[1],o[2]-2,o[3]]:o,L.xmap&&(windowObs.has(o)||sigObsList.includes(o))?-1:.6)).length;   /* 원본 좌표 화면: 원본처럼 맞닿은 열번칸끼리는 1px까지 허용 (수원 B714T) */
      const score=hits*10000+(b.width-width)*3+Math.abs(dx)*4;if(!chosen||score<chosen.cost)chosen={x,y,width,cost:score};if(score===0)break candidates;
     }
     cost+=chosen.cost;choices.push(chosen);
    }
    cost+=inBand?Math.abs(dy)*.5:Math.abs(dy-preferred);if(!best||cost<best.cost)best={cost,choices};
    if(cost===0)break;   // 띠 안에서는 끝까지 비교: 옆으로 크게 밀리는 것보다 조금 더 바깥(승강장 표시 아래 등)이 낫다
   }
   return best;};
  const hitsOf=r=>r?r.choices.filter(c=>c.cost>=10000).length:Infinity;
  let best=band.length?search(band,true):null;
  // 띠 안에 겹치지 않는 자리가 없을 때만 예전 넓은 탐색(이웃 선로 너머 포함)을 쓴다
  if(!best||hitsOf(best)){const fallback=search(wide,false);if(hitsOf(fallback)<hitsOf(best))best=fallback;}
  lane.forEach((b,i)=>{Object.assign(b,best.choices[i]);const o=[b.x,b.y,b.x+b.width,b.y+b.height];windowObs.add(o);obstacles.push(o);});
 }

 cached={windowBoxes,capsulePositions};if(!windowLayouts.has(def))windowLayouts.set(def,new Map());windowLayouts.get(def).set(layoutKey,cached);if(windowLayouts.get(def).size>4)windowLayouts.get(def).delete(windowLayouts.get(def).keys().next().value);
 }
 const {windowBoxes,capsulePositions}=cached;
 occupiedBoxes.push(...capsulePositions.map(p=>p.box));
 for(const {item,inline,x,y,width,height,cy,lane}of windowBoxes){
  occupiedBoxes.push([x-3,y-3,x+width+3,y+height+3]);
  trainShapes+=`<g class="ls-train-slot ${inline?'inline':'detached'}" data-train-slot="${esc(item.slot)}" data-window-code="${esc(item.code)}" data-window-side="${item.side}" data-window-rail-y="${cy}" data-window-lane="${esc(lane||"")}" role="button" tabindex="0" aria-label="${esc(item.code)} 열차번호 입력"><rect x="${x}" y="${y}" width="${width}" height="${height}"/><title>${esc(item.code)} 열차번호 입력</title></g>`;
 }

 for(const p of platformBoxes){
  const info=platformInfo.describe(p.kind);
  platforms+=`<rect data-platform-height="${info.height}" class="platform ${info.css}" x="${p.x}" y="${p.y}" width="${p.right-p.x}" height="${p.height}" rx="2"><title>${info.colour} 승강장 · ${info.label}</title></rect>`;
  occupiedBoxes.push([p.x-3,p.y-3,p.right+3,p.y+p.height+3]);
 }
 for(const [i,points]of paths.entries())rails+=`<path${i>=def.rails.length&&i<def.rails.length+(data.joins||[]).length?` data-reviewed-join="${i-def.rails.length}"`:''} d="${dpath(points)}"/>`;
 for(const polygon of (data.joins?.length?[]:wing.diags))rails+=`<polygon class="rail-join" points="${polygon.map(p=>T(p).join(',')).join(' ')}"/>`;
 for(const c of cells){
  const state=onRoute(c)?.state||'clear';
  sections+=`<g class="track-cell ${state}" data-track-section="${st.id}-${c.index}" data-track-circuit="${esc(c.label)}" data-track-state="${state}"><rect class="cell-bed" x="${c.x}" y="${c.y-BAR/2}" width="${c.width}" height="${BAR}"/><title>${esc(c.label||'원본 무기명 구간')} · ${state}</title></g>`;
 }
 // Adjacent extraction fragments may belong to one named circuit. Consolidate text only;
 // every original circuit rectangle, hit target and interlocking resource stays intact.
 const labelCells=cells.map(c=>({...c,label:c.forceLabel??labelReview.labelFor(st.id,c.source)}));
 const fragments=labelCells.flatMap(c=>{
  const atomic=c.label.replaceAll(' · ',''),tokens=/^B\d{3,4}T[12]T$/.test(atomic)?[atomic]:c.label.split(' · ').filter(Boolean);
  return tokens.map((label,i)=>({...c,label,x:c.x+c.width*i/tokens.length,width:c.width/tokens.length}));
 });
 // 표기 통일: 승강장 선로 번호(nT)는 그 선로 승강장(열번창) 바로 오른쪽 칸에 둔다. 자리가 없을 때만 원래 위치를 쓴다.
 const platformBox=name=>/^\d+T$/.test(name)?windowBoxes.find(b=>b.inline&&(b.item.slot===name||b.item.code===name)):null;
 // 승강장 선로 번호(nT) 자리를 먼저 잡는다: 다른 회로명(예: 동묘앞 XT)이 그 자리에 오면 자기 칸 안에서 비켜 간다 — 원본 순서(승강장 · 1T · XT)
 const platformLabelBoxes=windowBoxes.filter(b=>b.inline&&/^\d+T$/.test(b.item.slot||b.item.code)).map(b=>{const n=b.item.slot||b.item.code,w=n.length*7.2+4;return {name:n,cy:b.cy,box:[b.x+b.width+7,b.cy-8,b.x+b.width+7+w,b.cy+8]};});
 const labelRuns=[];
 for(const c of fragments.sort((a,b)=>a.y-b.y||a.x-b.x)){
  const prev=labelRuns.at(-1);
  if(prev&&prev.label===c.label&&Math.abs(prev.y-c.y)<2&&c.x<=prev.x+prev.width+10)prev.width=Math.max(prev.width,c.x+c.width-prev.x);
  else labelRuns.push({...c});
 }
 for(const c of labelRuns){
  const atomic=c.label.replaceAll(' · ','');
  const tokens=/^B\d{3,4}T[12]T$/.test(atomic)?[atomic]:c.label.split(' · ').filter(Boolean);
  tokens.forEach((label,i)=>{
   const left=c.x+c.width*i/tokens.length,right=c.x+c.width*(i+1)/tokens.length;
   let intervals=[[left+3,right-3]];
   for(const box of windowBoxes.filter(b=>b.inline&&Math.abs(b.cy-c.y)<4))intervals=intervals.flatMap(([a,b])=>box.x>=b||box.x+box.width<=a?[[a,b]]:[[a,Math.min(b,box.x-5)],[Math.max(a,box.x+box.width+5),b]].filter(([l,r])=>r-l>6));
   for(const r of platformLabelBoxes.filter(r=>r.name!==label&&Math.abs(r.cy-c.y)<4))intervals=intervals.flatMap(([a,b])=>r.box[0]>=b||r.box[2]<=a?[[a,b]]:[[a,Math.min(b,r.box[0]-3)],[Math.max(a,r.box[2]+3),b]].filter(([l,r])=>r-l>6));
   if(!intervals.length)intervals=[[left+3,right-3]];
   const pb=platformBox(label),need=pb?label.length*6.4:label.length*7.2+4,beside=pb&&Math.abs(pb.cy-c.y)<4?intervals.map(([a,b])=>a>=pb.x+pb.width-1?[a,b]:b>pb.x+pb.width+2?[pb.x+pb.width+2,b]:null).filter(v=>v&&v[1]-v[0]>=need).sort((p,q)=>p[0]-q[0])[0]??(()=>{const nx=Math.min(WIDTH-4,...cells.filter(o=>Math.abs(o.y-c.y)<3&&o.x>=pb.x+pb.width-1).map(o=>o.x));return nx-(pb.x+pb.width+4)>=need?[pb.x+pb.width+3,nx-2]:null;})():null;   // 칸 안에 자리가 없으면 열번창 오른쪽 빈 선로에
   const [a,b]=beside||intervals.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0],width=Math.max(6,b-a),textWidth=Math.min(width,label.length*7.2),x=beside?Math.min(b-textWidth/2-2,Math.max(a,pb.x+pb.width+8)+textWidth/2):(a+b)/2;
   const fit=label.length*7.2>width?` textLength="${Math.max(6,width)}" lengthAdjust="spacingAndGlyphs"`:'';
   labels+=`<text class="cell-name" data-circuit-label="${esc(label)}" x="${x}" y="${c.y+4.3}" text-anchor="middle"${fit}>${esc(label)}</text>`;
   occupiedBoxes.push([x-textWidth/2,c.y-8,x+textWidth/2,c.y+8]);
  });
 }
 // Source aliases such as B615T1T represent adjoining identifiers, not an extra overlapping label.
 const hasName=name=>fragments.some(c=>c.label===name);
 const addRailName=(name,anchor,poly,offset=0)=>{
  if(!name||hasName(name))return;
  const [baseX,y]=fixPt(anchor,T(anchor)),width=name.length*7.2+6;
  let intervals=poly.slice(1).flatMap((p,i)=>{const a=fixPt(poly[i],T(poly[i])),b=fixPt(p,T(p));return Math.abs(a[1]-b[1])<2&&Math.abs(y-a[1])<2?[[Math.min(a[0],b[0]),Math.max(a[0],b[0])]]:[];});
  // An unnamed boundary segment belongs beyond the local endpoint, on the existing
  // horizontal screen continuation. Never push B607T back into the named YT circuit.
  const port=offset<0&&/^B\d{3,4}T(?:[12]T)?$/.test(name)&&edgePorts.find(p=>p.side==='right'&&p.code===name&&Math.abs(T([p.x,p.y])[1]-y)<2);
  const edgeX=port?Math.max(T([port.x,port.y])[0],...cells.filter(c=>Math.abs(c.y-y)<3&&c.x<WIDTH-40).map(c=>c.x+c.width)):null,extension=port&&WIDTH-12-edgeX>width+8;   /* 확장 구간은 그 줄 마지막 칸 뒤부터 (용산 BT 뒤 B610T) */
  if(extension){intervals=[[edgeX+4+GAP/2,WIDTH-12]];if(cellGaps.length)cellGaps.push([edgeX+GAP/2,y]);else symbols+=`<path class="circuit-boundary" data-boundary-label="${esc(name)}" d="M${edgeX} ${y-BAR/2}V${y+BAR/2}"/>`;}
  const pb=!extension&&platformBox(name),onRow=pb&&Math.abs(pb.cy-y)<4;
  // 칸이 없는 선로 끝 구간의 이름은 그 빈 구간(화면 끝~첫 칸) 가운데에 둔다 (수원 B1036T가 XT에 붙지 않게)
  const rowCells=cells.filter(c=>Math.abs(c.y-y)<3),gapL=Math.max(4,...rowCells.filter(c=>c.x+c.width<=baseX+offset+1).map(c=>c.x+c.width)),gapR=Math.min(WIDTH-4,...rowCells.filter(c=>c.x>=baseX+offset-1).map(c=>c.x));
  const iv=intervals.find(([a,b])=>baseX+offset>=a-2&&baseX+offset<=b+2),fl=iv?Math.max(gapL,iv[0]):gapL,fr=iv?Math.min(gapR,iv[1]-BAR):gapR;   /* 그 선로의 가로 구간 안에서 */
  const freeMid=fr-fl>width+16?(fl+fr)/2:null;
  const preferredX=extension?(edgeX+4+WIDTH-12)/2:onRow?pb.x+pb.width+7+width/2:freeMid??baseX+offset;
  let x=preferredX;
  // 승강장 오른쪽 칸을 먼저 찾고(오른쪽으로만 이동), 없으면 원래 방식(양쪽)으로 찾는다
  const deltas=[0];if(onRow){for(let d=6;d<120;d+=6)deltas.push(d);for(let d=6;d<WIDTH;d+=6)deltas.push(baseX+offset-preferredX-d,baseX+offset-preferredX+d);}else for(let d=6;d<WIDTH;d+=6)deltas.push(-d,d);
  for(const dx of deltas){const candidate=preferredX+dx,box=[candidate-width/2,y-8,candidate+width/2,y+8];if(!intervals.some(([a,b])=>box[0]>a+2&&box[2]<b-2))continue;/* 글자 높이(±6)로만 겹침을 본다: 선로 바로 밑 열번창이 이름을 밀어내지 않게 */if(!occupiedBoxes.some(o=>intersects([box[0],y-6,box[2],y+6],o,3))){x=candidate;break;}}
  // 칸 없이 선로만 그린 회로(예: 서울 B901T)도 이웃 회로 칸과 틈으로 나눈다
  if(!extension&&cellGaps.length){const row=cells.filter(c=>Math.abs(c.y-y)<3),inRail=v=>intervals.some(([a,b])=>v>a+4&&v<b-4);
   const lc=row.filter(c=>c.x+c.width<=x).sort((a,b)=>b.x+b.width-a.x-a.width)[0],rc=row.filter(c=>c.x>=x).sort((a,b)=>a.x-b.x)[0];
   if(lc&&inRail(lc.x+lc.width+GAP)&&!cellGaps.some(([gx,gy])=>Math.abs(gy-y)<3&&Math.abs(gx-lc.x-lc.width)<8))cellGaps.push([lc.x+lc.width+GAP/2,y]);
   if(rc&&inRail(rc.x-GAP)&&!cellGaps.some(([gx,gy])=>Math.abs(gy-y)<3&&Math.abs(gx-rc.x)<8))cellGaps.push([rc.x-GAP/2,y]);}
  labels+=`<text class="rail-name" data-label-placement="${extension?'edge-extension':'native-rail'}" data-circuit-label="${esc(name)}" x="${x}" y="${y+4.3}" text-anchor="middle">${esc(name)}</text>`;
  occupiedBoxes.push([x-width/2,y-8,x+width/2,y+8]);
 };
 for(const [id,poly,target,left,right]of def.rails){
  if(target!==null)addRailName(id,[target,railY(def,id,target)],poly);
  addRailName(left,poly[0],poly,42);addRailName(right,poly.at(-1),poly,-42);
  for(const name of [left,right])if(name&&cells.some(c=>c.label.replaceAll(' · ','')===name))labels+=`<g data-circuit-alias="${esc(name)}"><title>${esc(name)}</title></g>`;
 }
 // Some source labels sit on rails whose white cell was missed by extraction.
 for(const item of labelReview.additionalLabels[st.id]||[]){const rail=def.rails.find(r=>r[0]===item.rail);if(rail)addRailName(item.name,item.at,rail[1]);}
 // FTS: a train running over a route reddens only the circuits it is on, from the tail to the head, and moves on with the clock
 const lenOf=pts=>pts.slice(1).reduce((t,p,i)=>t+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
 const slicePath=(pts,d0,d1)=>{const out=[];let acc=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],seg=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!seg)continue;const s0=acc,s1=acc+seg;if(s1>d0&&s0<d1){const t0=Math.max(0,(d0-s0)/seg),t1=Math.min(1,(d1-s0)/seg);if(!out.length)out.push([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0]);out.push([a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1]);}acc=s1;}return out;};
 const TRAIN_PX=150;
 for(const route of active){
  const t=model.routes[route.id]?.train;
  if(route.state==='occupied'&&t&&t.to>t.from){
   const L=lenOf(route.points),f=Math.max(0,Math.min(1,((model.clock??0)-t.from)/(t.to-t.from))),head=L*f,tail=Math.max(0,head-Math.min(TRAIN_PX,L*.55)),part=slicePath(route.points,tail,Math.max(head,tail+1));
   routes+=`<path class="route-line occupied-base" data-active-route="${esc(route.id)}" data-route-station="${st.id}" data-route-state="occupied" stroke="${COLORS.set}" d="${dpath(route.points)}"/>`;
   if(part.length>1)routes+=`<path class="route-line occupied train-run" data-train-run="${esc(route.id)}" data-route-state="occupied" stroke="${COLORS.occupied}" d="${dpath(part)}"/>`;
   continue;
  }
  routes+=`<path class="route-line ${route.state}" data-active-route="${esc(route.id)}" data-route-station="${st.id}" data-route-state="${route.state}" stroke="${COLORS[route.state]}" d="${dpath(route.points)}" ${route.state==='locked'?'stroke-dasharray="14 8"':''}/>`;
 }
 // Scenario block travel follows surveyed local rows; manual handovers remain separate on each screen.
 for(const m of model.scenarioMotions||[]){
  if(model.clock<m.from||model.clock>m.to)continue;
  const pts=m.points.map(T),len=lenOf(pts),fraction=Math.max(0,Math.min(1,(model.clock-m.from)/(m.to-m.from))),head=Math.max(1,len*fraction),part=slicePath(pts,Math.max(0,head-90),head);
  if(part.length>1)routes+=`<path class="route-line occupied scenario-run" data-scenario-run="${esc(m.id)}" data-scenario-train="${esc(m.number)}" data-manual-handover="${!!m.manual}" stroke="${COLORS.occupied}" d="${dpath(part)}"/>`;
 }
 // an approaching train (접근 열차) reddens the circuit just outside its signal
 for(const [sig,on] of Object.entries(model.approach||{})){
  if(!on)continue;const sg=core.signals[sig],rid=Object.keys(core.routes).find(id=>core.routes[id].signal===sig);if(!sg||!rid)continue;
  const p0=projectRoute(routePoints(core.routes[rid].path),core.routes[rid].destination)[0],dir=sg.dir,row=cells.filter(c=>Math.abs(c.y-p0[1])<6&&(dir>0?c.x<p0[0]-2:c.x+c.width>p0[0]+2));      // the circuit holding the signal's outer side (or just outside it)
  const c=dir>0?row.sort((a,b)=>b.x+b.width-(a.x+a.width))[0]:row.sort((a,b)=>a.x-b.x)[0];
  if(c)routes+=`<rect class="train-occ" data-train-occupied="접근 ${esc(sig)}" x="${c.x}" y="${c.y-BAR/2}" width="${c.width}" height="${BAR}"/>`;
 }
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
 if(!cellGaps.length)for(const [x,y]of boundaries)symbols+=`<path class="circuit-boundary" d="M${x} ${y-BAR/2}V${y+BAR/2}"/>`;
 const topRow=Math.min(...paths.flat().map(p=>p[1]));
 for(const plate of wing.plates){
  const [left]=T([plate.box[0],0]),[right]=T([plate.box[2],0]),own=platformBoxes.filter(pb=>pb.stop?.name===plate.name).sort((a,b)=>a.y-b.y)[0],width=plateW(plate,Math.max(right-left,plate.name.length*16+18)),x=plateAt(plate,plateX(own?(own.x+own.right)/2:(left+right)/2,width));
  // 이름판은 자기 역 하선 승강장 위 (자리가 없으면 화면 위 띠)
  const y=plateY(plate,Math.max(8,topRow-plateGap));
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
  annotations+=`<g class="source-caption${L.xmap?" plain":""}" data-source-caption="${esc(c.id)}" pointer-events="none"><rect class="caption-surface" x="${c.box[0]}" y="${c.box[1]}" width="${c.box[2]-c.box[0]}" height="${c.box[3]-c.box[1]}" rx="6"/><path class="caption-accent" d="M${c.box[0]+1} ${c.box[1]+11}V${c.box[3]-11}"/>${c.lines.map((line,i)=>{const ly=c.rowYs?c.rowYs[i]+(c.y-(c.rowYs[0]+c.rowYs.at(-1))/2):c.y+(i-(c.lines.length-1)/2)*22,lx=c.notes?c.box[0]+16+Math.max(...c.lines.map(t=>t.length))*15/2:c.x;return `<text x="${lx}" y="${ly}" dominant-baseline="central" text-anchor="middle">${esc(line)}</text>`+(c.notes?.[i]?`<text class="caption-note" x="${c.box[2]-16-(c.notesW-22)/2}" y="${ly}" dominant-baseline="central" text-anchor="middle">${esc(c.notes[i])}</text>`:'');}).join('')}</g>`;
 }
 symbols+=blockView.render(capsulePositions);
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
 // 원본 LS: 신호기·입환표지는 회로 사이 틈에 선다. 역 구내는 여러 선로의 틈이 한 세로줄(열)로 맞춰져 있다.
 // 1) 같은 줄의 가까운 틈, 없으면 2) 이웃 줄들이 이루는 틈 열로 신호기를 옮기고, 그 자리에 자기 선로가 이어져 있으면 틈을 낸다.
 // 3) 승강장 선로(nT)는 그 열을 지나가면 틈을 낸다 (영등포 22T·24AT·1T, 3B 선로 등).
 const sigAt=new Map();
 if(cellGaps.length){
  const onRail=(x,y)=>paths.some(pts=>pts.some((p,i)=>i&&Math.abs(p[1]-y)<3&&Math.abs(pts[i-1][1]-y)<3&&Math.min(p[0],pts[i-1][0])<x-6&&Math.max(p[0],pts[i-1][0])>x+6))||cells.some(c=>Math.abs(c.y-y)<3&&c.x<x-6&&c.x+c.width>x+6);
  const hasGap=(x,y,r=12)=>cellGaps.some(([gx,gy])=>Math.abs(gy-y)<3&&Math.abs(gx-x)<r);
  const {strong,platRows}=gapColumns;
  for(const [id,rail,x,lampY] of def.signals){const [X,Y]=sigBase(id,T([x,railY(def,rail,x)])),LY0=T([0,lampY])[1];
   const own=cellGaps.filter(([gx,gy])=>Math.abs(gy-Y)<3&&Math.abs(gx-X)<45).sort((a,b)=>Math.abs(a[0]-X)-Math.abs(b[0]-X))[0];
   const col=strong.filter(c=>Math.abs(c.x-X)<40).sort((a,b)=>Math.abs(a.x-X)-Math.abs(b.x-X))[0];
   const nx=own?own[0]:col?col.x:null;if(nx==null)continue;
   /* 원본 등이 틈의 등 쪽으로 12px도 안 나가면(원본에서 기둥이 칸 안에 선 신호기, 구로 54·4A) 틈에 세우지 않고 원본 등 자리에서 기둥을 정한다 */
   {const v=L.xmap?.signals?.[id];const pinC=cc=>L.xmap?.pinned?.some(e=>Math.abs(e[0]-cc.source[0])<.6&&Math.abs(e[1]-cc.source[1])<.6),pinnedGap=cells.some(cc=>pinC(cc)&&Math.abs(cc.y-Y)<3&&(Math.abs(cc.x+cc.width-nx)<8||Math.abs(cc.x-nx)<8));
    if(v&&pinnedGap){const lx=L.adj(v[0]*WIDTH/L.xmap.width),d=v[1];if((lx-nx)*d<12){sigAt.set(id,lx-d*(core.signals[id]?.kind==='입환'?12:25));continue;}}}
   {const dd=L.xmap?.signals?.[id]?.[1]??Math.sign(X-nx||1),bodyAt=m=>[Math.min(m,m+dd*36)-6,LY0-9,Math.max(m,m+dd*36)+6,LY0+9];   /* 몸체는 기둥에서 등 쪽으로만 뻗는다 (동묘앞 2A: 반대쪽 폐색 표식 1 때문에 틈에 못 서던 것) */
    const symAt=m=>[m-30,LY0-9,m+30,LY0+9],blocks=f=>capsulePositions.some(c=>intersects(f(nx),c.box,2))&&!capsulePositions.some(c=>intersects(f(X),c.box,2));
    if(blocks(bodyAt)&&blocks(symAt))continue;}   // 폐색 표식과 겹치면 옮기지 않는다
   sigAt.set(id,nx);
   if(!hasGap(nx,Y)&&onRail(nx,Y))cellGaps.push([nx,Y]);}
  /* overrides로 원본 위치를 적은 칸(과 그 꺾임 꼬리) 안에는 열 틈을 새로 넣지 않는다 (원본에 없는 틈: 금천구청 1T·3T·4T의 x≈412) */
  const isPin=cc=>!!L.xmap?.pinned?.some(e=>Math.abs(e[0]-cc.source[0])<.6&&Math.abs(e[1]-cc.source[1])<.6);
  const pinnedAt=(x,y)=>cells.some(cc=>isPin(cc)&&Math.abs(cc.y-y)<3&&x>cc.x+8&&x<cc.x+cc.width-8)||cornerTails.some(([[a,ay],[b]])=>Math.abs(ay-y)<3&&x>=Math.min(a,b)&&x<=Math.max(a,b)&&cells.some(cc=>isPin(cc)&&Math.abs(cc.y-y)<3&&(Math.abs(cc.x-b)<2||Math.abs(cc.x+cc.width-a)<2)));
  for(const [px,py] of platRows)for(const c of strong){if(Math.abs(c.x-px)>260||hasGap(c.x,py,16)||pinnedAt(c.x,py))continue;if(onRail(c.x,py))cellGaps.push([c.x,py]);}
 }
 const placed=def.signals.map(([id,rail,x,lampY,dir])=>{const railLocal=railY(def,rail,x);let [X,Y]=sigBase(id,T([x,railLocal]));if(sigAt.has(id))X=sigAt.get(id);
  {const LY=T([0,lampY])[1],body=x0=>[Math.min(x0,x0+dir*18)-4,LY-8,Math.max(x0,x0+dir*18)+12,LY+8];for(let k=0;k<12;k++){const hit=capsulePositions.find(c=>intersects(body(X),c.box,1));if(!hit)break;X+=Math.sign(X-(hit.box[0]+hit.box[2])/2||1)*4;}} /* 폐색 표식과 겹치면 옆으로 비킨다 */return {id,rail,dir,lampY,railLocal,X,Y,anchorX:X,side:Math.sign(lampY-railLocal||1)};});
 /* 세로로 바짝 붙은 두 신호기 몸체(높이 14)는 위아래로 벌린다 (줄 간격을 좁힌 화면: 동묘앞 3A·23) */
 const lampDy=new Map();
 /* 신호기 몸체(높이 14)가 자기 선로 칸(높이 18)에 겹치지 않게 선로에서 최소 17px: 원본 칸은 얇아 원본 간격 그대로면 칸을 가린다 (구로 2A·53·1A 등).
    같은 기둥 줄(같은 쪽)의 바깥 신호기도 같은 만큼 옮겨 쌓인 순서를 지킨다 */
 {const CLR=BAR/2+8;for(const s of placed){const ly=T([0,s.lampY])[1],d=ly-s.Y,side=Math.sign(d)||s.side||1;if(Math.abs(d)>=CLR)continue;const shift=side*CLR-d;
   for(const o of placed){const oy=T([0,o.lampY])[1],od=oy-o.Y;if(o===s||(Math.abs(o.anchorX-s.anchorX)<45&&Math.abs(o.Y-s.Y)<3&&Math.sign(od)===side&&Math.abs(od)>=Math.abs(d)&&Math.abs(od)<Math.abs(d)+40))lampDy.set(o.id,Math.max(Math.abs(lampDy.get(o.id)||0),Math.abs(shift))*side);}}}
 {const ps=placed.map(s=>({id:s.id,x:s.anchorX,y:T([0,s.lampY])[1]+(lampDy.get(s.id)||0)})).sort((a,b)=>a.y-b.y);
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j],gap=b.y-a.y;if(gap>0&&gap<16&&Math.abs(a.x-b.x)<45){const d=(16-gap)/2;lampDy.set(a.id,(lampDy.get(a.id)||0)-d);lampDy.set(b.id,(lampDy.get(b.id)||0)+d);}}}
 const lampLY=s=>T([0,s.lampY])[1]+(lampDy.get(s.id)||0);
 // Give a tight stack of names its own minimum line spacing, without moving lamps.
 const nameY=new Map(placed.map(s=>[s.id,lampLY(s)])),nameColumns=new Map();
 for(const s of placed){const key=s.anchorX.toFixed(1)+'|'+s.dir;if(!nameColumns.has(key))nameColumns.set(key,[]);nameColumns.get(key).push(s);}
 for(const column of nameColumns.values()){
  column.sort((a,b)=>nameY.get(a.id)-nameY.get(b.id));let first=0;
  while(first<column.length){let end=first+1;while(end<column.length&&nameY.get(column[end].id)-nameY.get(column[end-1].id)<18)end++;
   const group=column.slice(first,end);
   if(group.length>1){const base=group.reduce((sum,s,i)=>sum+nameY.get(s.id)-i*18,0)/group.length;group.forEach((s,i)=>nameY.set(s.id,base+i*18));}
   first=end;
  }
 }
 const placedNames=[];
 for(const s of placed){
  const {id,dir,Y,anchorX}=s,X=anchorX,kind=core.signals[id].kind;
  const reach=sigReach(id,X,dir),LY=lampLY(s),lampX=X+dir*reach;
  const labelY=nameY.get(id);
  const go=model.signals[id]==='GO',locked=Object.entries(model.routes).some(([rid,r])=>r.lock&&core.routes[rid].signal===id);
  /* 입환표지는 등이 기둥에서 멀어도(구로 23) 등 하나짜리 짧은 몸체: 몸체는 등 쪽 끝에만, 기둥에서 몸체까지는 마스트 선 */
  const shunt=kind==='입환'&&reach>18,bodyX=shunt?lampX-dir*18:X,bodyR=shunt?18:reach;
  const shape=`<rect class="signal-body" x="${Math.min(bodyX,lampX)-3}" y="${LY-7}" width="${bodyR+10}" height="14" rx="7"/>${reach>18&&!shunt?`<circle class="lamp off" cx="${lampX-dir*13}" cy="${LY}" r="6"/>`:''}<circle class="lamp ${go?'go':'stop'} ${locked?'lock':''}" cx="${lampX}" cy="${LY}" r="6"/>`;
  const box=dir===1?[X-30,LY-8,X+reach+7,LY+8]:[X-reach-7,LY-8,X+30,LY+8];
  // 신호기 이름이 승강장 표시에 걸리면 마스트 반대쪽에 쓴다 (동묘앞 23)
  // 원본: 이름은 등 반대쪽. 열번창·승강장에 조금 걸리면 위아래로 8px까지 비키고, 그래도 안 되면 등 너머(몸체 밖)에 쓴다 (구로 3C·4A)
  const nameOff=d=>d===dir?8:reach+14,nameAt=(d,dy=0)=>d===1?[X-nameOff(d)-id.length*7.5,labelY-8+dy,X-nameOff(d),labelY+8+dy]:[X+nameOff(d),labelY-8+dy,X+nameOff(d)+id.length*7.5,labelY+8+dy];
  const keepOut=[...platformBoxes.map(p=>[p.x,p.y,p.right,p.y+p.height]),...windowBoxes.filter(b=>b.inline).map(b=>[b.x,b.y,b.x+b.width,b.y+b.height]),...capsulePositions.map(c=>c.box)];   // 승강장·승강장 열번창
  const hitK=b=>[...keepOut,...placedNames].some(k=>intersects([b[0],b[1]-.5,b[2],b[3]-1.5],k,.3)),dys=[0,...Array.from({length:32},(_,i)=>((i>>1)+1)*.5*(i%2?-1:1))];   /* 글자 실제 상자(기준선 -12~+3), 0.5px씩 비킨다 */   /* 글자 실제 높이로, 1px씩 비킨다. 먼저 쓴 신호기 이름도 피한다 */let nameDir=dir,nameDy=dys.find(dy=>!hitK(nameAt(dir,dy)));
  if(nameDy===undefined){const f=dys.find(dy=>!hitK(nameAt(-dir,dy)));if(f!==undefined){nameDir=-dir;nameDy=f;}else nameDy=0;}
  occupiedBoxes.push(nameAt(nameDir,nameDy));placedNames.push(nameAt(nameDir,nameDy));
  occupiedBoxes.push(dir===1?[X-8-id.length*7.5,LY-8,X+reach+5,LY+8]:[X-reach-5,LY-8,X+8+id.length*7.5,LY+8]);
  signalSymbols+=`<g class="signal ${kind==='입환'?'shunt':'main'}" data-signal-view="${id}" data-anchor-x="${X}" data-lamp-y="${LY}"><path class="mast" d="M${X} ${Y+s.side*7}V${LY}H${lampX}"/>${shape}<circle class="mast-foot" cx="${X}" cy="${LY}" r="3"/><text class="sig-name" data-label-kind="signal" data-label-id="${id}" data-label-offset-y="${labelY+nameDy-LY}" x="${X-nameDir*nameOff(nameDir)}" y="${labelY+nameDy+3.5}" text-anchor="${nameDir===1?'end':'start'}">${id}</text><g class="signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${esc(st.name)} ${id} ${kind}신호기"><rect x="${box[0]}" y="${LY-8}" width="${box[2]-box[0]}" height="16" fill="transparent"/><title>${id} ${kind}신호기</title></g></g>`;
 }
 const takeLabel=(text,anchor,kind,id,preferred=anchor)=>{
  // Resolve dense labels locally only. Never detach an annotation from its turnout.
  const width=text.length*7+2;
  preferred=[Math.max(20,Math.min(WIDTH-20,preferred[0])),Math.max(20,Math.min(L.H-20,preferred[1]))];
  let [x,y]=preferred;
  const offsets=[[0,0],[0,-4],[0,4],[0,-8],[0,8]];   /* 선로에 1~2px 닿을 때 멀리 뛰지 않게 (구로 21B) */
  for(let d=12;d<=72;d+=12)offsets.push([d,0],[-d,0],[0,-d],[0,d],[d,-12],[-d,-12],[d,12],[-d,12]);
  for(const [dx,dy]of offsets){
   const xx=preferred[0]+dx,yy=preferred[1]+dy,box=[xx-width/2,yy-7,xx+width/2,yy+7];
   if(xx<width/2+8||xx>WIDTH-width/2-8)continue;
   if(!occupiedBoxes.some(o=>intersects(box,o,1))&&!touchesRail(box)){x=xx;y=yy;break;}
  }
  occupiedBoxes.push([x-width/2,y-7,x+width/2,y+7]);
  return {x,y,svg:`<text class="annotation ${kind}" data-label-kind="${kind}" data-label-id="${esc(id)}" x="${x}" y="${y+3.5}" text-anchor="middle">${esc(text)}</text>`};
 };
 const overlapPoints=new Set(Object.keys(model.routes).flatMap(id=>Object.keys(core.overlapOf(id,model)?.points||{})));
 // Switch identifiers and source A/B part identifiers use the same placement solver.
 for(const [id,pos]of Object.entries(prepared.corridor?{}:core.points)){
  if(Object.values(core.pointParts||{}).includes(id)){pointSymbols+=`<g data-point-label="${id}" data-paired-switch="true"></g>`;continue;}
  const anchor=pointAnchors[id]||Tnear(toLocal(pos.x,pos.y)),R=model.points[id]==='R',manualLock=model.blockedPoints.includes(id),locked=manualLock||overlapPoints.has(id)||Object.keys(model.routes).some(route=>(core.routes[route].pointLocks||[]).includes(id));
  const surveyed=inventory[st.id].labels.filter(p=>p[2]===id).map(p=>Tnear(p)).filter(p=>p[0]>=12&&p[0]<=WIDTH-12&&p[1]>=16&&p[1]<=L.H-16&&Math.hypot(p[0]-anchor[0],p[1]-anchor[1])<160)/* 멀리 떨어진 같은 번호(안양 55 신호기 이름)는 선로전환기 번호가 아니다 */.sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]))[0];
  const scissors=switches.connectors.find(c=>c.id===id&&c.kind==='scissors');
  const preferred=scissors?[scissors.endpoints[0][0]+(scissors.endpoints[1][0]-scissors.endpoints[0][0])*.25,scissors.endpoints[0][1]+(scissors.endpoints[0][1]<scissors.endpoints[1][1]?-24:24)]:surveyed||[anchor[0],anchor[1]-13];
  const label=takeLabel(id,anchor,'point',id,preferred);
  pointSymbols+=`<g class="point-tag ${R?'rev':''} ${locked?'locked':''}" data-point-label="${id}" data-point-control="${id}" role="button" tabindex="0" aria-label="선로전환기 ${id}"><rect x="${label.x-18}" y="${label.y-11}" width="36" height="22" fill="transparent"/>${label.svg}<title>${id} · ${R?'반위':'정위'}${locked?(manualLock?' · 수동 쇄정':' · 진로 쇄정'):''}</title></g>`;
  if(overlapPoints.has(id))pointSymbols+=`<circle class="overlap-ring" data-overlap-point="${id}" cx="${label.x}" cy="${label.y}" r="18"/>`;
 }
 const xs=def.rails.flatMap(r=>r[1].map(p=>p[0])),lo=Math.min(...xs),hi=Math.max(...xs);
 const partLabels=inventory[st.id].labels.filter(p=>/^\d{2}[AB]$/.test(p[2])&&p[0]>=lo&&p[0]<=hi);
 const seen=new Set();
 for(const item of [...wing.labels,...partLabels,...(prepared.corridor?[]:core.pointPartLabels||[]).map(p=>[p.x,p.y,p.part])]){
  const key=item.join('|');if(seen.has(key))continue;seen.add(key);
  const anchor=Tnear(item),label=takeLabel(item[2],anchor,'part',key),group=core.pointParts?.[item[2]];
  if(group){const R=model.points[group]==='R',locked=model.blockedPoints.includes(group)||Object.keys(model.routes).some(id=>(core.routes[id].pointLocks||[]).includes(group)||core.overlapOf(id,model)?.points[group]);annotations+=`<g class="point-tag ${R?'rev':''} ${locked?'locked':''}" data-point-control="${item[2]}" data-point-group="${group}" role="button" tabindex="0" aria-label="선로전환기 ${item[2]}"><rect x="${label.x-18}" y="${label.y-11}" width="36" height="22" fill="transparent"/>${label.svg}<title>SW_${item[2]} · ${R?'반위':'정위'} · 쌍동 A/B 동시 전환${locked?' · 쇄정':''}</title></g>`;if(overlapPoints.has(group))annotations+=`<circle class="overlap-ring" data-overlap-point="${group}" cx="${label.x}" cy="${label.y}" r="18"/>`;}else annotations+=label.svg;
 }
 for(const [x,y,id,dir]of wing.signals){if(def.signals.some(s=>s[0]===id.replace(/^0+/,'')))continue;const [X,Y]=T([x,y]);signalSymbols+=`<g class="signal wing" data-wing-signal="${esc(id)}"><path class="mast" d="M${X} ${Y}h${dir*12}"/><circle class="lamp stop" cx="${X}" cy="${Y}" r="7"/><text class="sig-name" x="${X-dir*13}" y="${Y+5}" text-anchor="${dir===1?'end':'start'}">${esc(id)}</text></g>`;}
 // 원본 LS의 노란 화살표: 위 글자는 방향(지하청량리/수원), 아래 글자는 눌렀을 때 열리는 이웃 화면.
 // 이웃이 역간 감시 화면이면 원본처럼 그 방향의 역 이름을 쓴다 (안양 → 「금정」, 금정 ← 「안양」).
 const arrow=(nb,side)=>{if(!nb)return '';const view=typeof nb==='string'?{id:'',name:nb}:nb,L=side==='left',x0=L?3:157,dx=L?1:-1,body=12,head=26,len=150,cy=28;
  const pts=[[0,0],[head,-head/2],[head,-body/2],[len,-body/2],[len,body/2],[head,body/2],[head,head/2]].map(([px,py])=>[x0+dx*px,cy+py].join(',')).join(' '),tx=x0+dx*(head+(len-head)/2);
  return `<svg class="ls-nav-arrow" viewBox="0 0 160 56" aria-label="${esc(view.name)} 화면"><g class="nb-arrow" data-nav-side="${side}"${view.id?` data-nav-view="${esc(view.id)}" role="button" tabindex="0"`:''} aria-label="${esc(view.name)} 화면으로"><polygon class="nb-arrow-shape" points="${pts}"/><text class="nb-arrow-dir" x="${tx}" y="${cy-11}" text-anchor="middle">${L?'지하청량리':'수 원'}</text><text class="nb-tag nb-arrow-to" x="${tx}" y="${cy+22}" text-anchor="middle">${esc(view.monitor?(L?view.hostName:view.nextName)||view.name:view.name)}</text></g></svg>`;};
 const around=presets.neighbours?.(neighbours.preset||st.id)||{};
 const navigation={left:arrow(neighbours.left===undefined?around.left:neighbours.left,'left'),right:arrow(neighbours.right===undefined?around.right:neighbours.right,'right')};
 // Extend through horizontal SVG letterboxing without stretching the stable station geometry.
 const ports=edgePorts.map(p=>{const c=cells.find(c=>c.label.replaceAll(' · ','')===p.code);return {...p,state:c&&(hitCells.has(c)?'occupied':onRoute(c)?.state)||'clear'};});
 // Trim route colour to the same rail/quarter silhouette; preserve its continuous centre bridge.
 const routeMaskId='route-trim-'+st.id,routeMask=`<defs><mask id="${routeMaskId}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${WIDTH+80}" height="2400"><rect x="-40" y="-40" width="${WIDTH+80}" height="2400" fill="black"/><g mask="url(#${switches.maskId})" fill="none" stroke="white" stroke-width="${BAR}" stroke-linejoin="miter" stroke-miterlimit="2" stroke-linecap="butt">${rails.replaceAll(/ data-reviewed-join="[^"]*"/g,'')}</g><g fill="none" stroke="white" stroke-width="${BAR}" stroke-linejoin="bevel" stroke-linecap="butt">${switches.paint}${switches.bridges}</g></mask></defs>`;
 const gapMaskId='cell-gap-'+st.id,gapAttr=cellGaps.length?` mask="url(#${gapMaskId})"`:'';
 const gapMask=cellGaps.length?`<defs><mask id="${gapMaskId}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${WIDTH+80}" height="2400"><rect x="-40" y="-40" width="${WIDTH+80}" height="2400" fill="white"/>${cellGaps.map(([x,y])=>`<rect data-cell-gap="${x.toFixed(1)}" x="${(x-GAP/2).toFixed(2)}" y="${(y-BAR/2-2).toFixed(2)}" width="${GAP}" height="${BAR+4}" fill="black"/>`).join('')}</mask></defs>`:'';
 return {width:WIDTH,height:L.H,contentWidth:L.width||WIDTH,sourcePoint:T,ports:edgePorts.map(p=>({...p,at:T([p.x,p.y])})),navigation,svg:`${neighbours.overview?'':seams.render(ports,T,L.H,WIDTH,Math.max(0,(L.H*(neighbours.aspect||WIDTH/L.H)-WIDTH)/2),[...occupiedBoxes,...cells.map(c=>[c.x,c.y-BAR/2,c.x+c.width,c.y+BAR/2]),...paths.flatMap(pts=>pts.slice(1).map((p,i)=>[Math.min(p[0],pts[i][0]),Math.min(p[1],pts[i][1])-BAR/2,Math.max(p[0],pts[i][0]),Math.max(p[1],pts[i][1])+BAR/2]))])}${switches.mask}${platforms}${gapMask}<g class="cell-gaps"${gapAttr}><g class="track-shape" mask="url(#${switches.maskId})"><g class="bed-inner rail-network">${rails}</g><g class="wing-inner section-network">${sections}</g></g></g><g class="switch-network">${switches.svg}${switches.metadata}</g>${routeMask}<g class="cell-gaps"${gapAttr}><g class="route-network" mask="url(#${routeMaskId})">${routes}</g></g>${symbols}${labels}${plates}${leaders}${annotations}${pointSymbols}${signalSymbols}${trains}${trainShapes}`};
}
const api={render,layout,wingOf,sceneOf,railY};
if(typeof module!=='undefined')module.exports=api;else root.SimLS=api;
})(typeof window!=='undefined'?window:globalThis);

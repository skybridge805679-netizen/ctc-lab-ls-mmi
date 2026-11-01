'use strict';
// Read executable engine definitions only. Never opens LS images, screenshots, PDF or PPTX.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const N=require('../simulator/engine/network'),W=require('../simulator/engine/wiring'),L=require('../simulator/engine/line'),G=require('../simulator/engine/network-topology');
const root=path.join(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'docs/code-network-2026-11-01'));
fs.mkdirSync(out,{recursive:true});
const g=L.graph,order=L.line.order,scale=.76,height=1230,margin=160,stationLayout={},positions={},circuitLayout={},sectionLayout={},colors={MD:'#52d6b5',MU:'#a4e9d7',ED:'#f4c56f',EU:'#ffe2a6',GD:'#58bde8',GU:'#addff4'};
let cursor=margin;
for(let i=0;i<order.length;i++){
 const id=order[i],pts=N.catalog[id].topology.nodes.map(n=>n.point),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),w=(Math.max(...xs)-minX)*scale,h=(Math.max(...ys)-minY)*scale;
 stationLayout[id]={x:cursor,w,minX,minY,top:340,scale,center:cursor+w/2};
 for(const n of N.catalog[id].topology.nodes)positions[id+':'+n.id]=[cursor+(n.point[0]-minX)*scale,340+(n.point[1]-minY)*scale];
 const next=order[i+1],sections=L.line.sections.filter(s=>s.west===id&&s.east===next),longest=Math.max(1,...sections.map(s=>g.chains[s.id].length));
 cursor+=w+Math.max(440,longest*92+100);
}
const width=stationLayout[order.at(-1)].x+stationLayout[order.at(-1)].w+margin;
const port=(id,code,side)=>{const p=N.catalog[id].topology.ports.find(p=>p.side===side&&L.graph.circuits[Lcode(p.code)]?.id===Lcode(code));assert(p,`no port ${id} ${code} ${side}`);return positions[id+':'+p.node];};
function Lcode(code){return /^B\d+T/.exec(code||'')?.[0];}
for(const sec of L.line.sections){
 const a=port(sec.west,sec.westSide,'right'),b=port(sec.east,sec.eastSide,'left'),chain=g.chains[sec.id],x0=stationLayout[sec.west].x+stationLayout[sec.west].w+45,x1=stationLayout[sec.east].x-45;
 const bypass=sec.skipped.length>0,yBypass=sec.trunk==='GD'?1000:1080;
 sectionLayout[sec.id]={a,b,x0,x1,bypass,yBypass};
 chain.forEach((code,i)=>{
  assert(!circuitLayout[code],`duplicate circuit placement: ${code}`);
  const center=x0+(x1-x0)*(i+.5)/chain.length,half=Math.min(35,(x1-x0)/chain.length*.34),at=x=>bypass?yBypass:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
  positions[code+':W']=[center-half,at(center-half)];positions[code+':E']=[center+half,at(center+half)];
  circuitLayout[code]={center:[center,at(center)],section:sec.id,trunk:sec.trunk};
 });
}
assert.equal(Object.keys(circuitLayout).length,Object.keys(g.circuits).length,'unplaced circuit');
for(const [i,b]of g.boundaries.entries()){
 const p=positions[b.node],st=stationLayout[b.station],up=b.station==='dongmyo'&&b.code==='CT';
 positions[b.id]=[p[0]+(i%2?65:-65),up?245:Math.max(830,...N.catalog[b.station].topology.nodes.map(n=>positions[b.station+':'+n.id][1]))+65+(i%3)*45];
}
assert.equal(Object.keys(positions).length,Object.keys(g.nodes).length,'every physical node placed');
const adjacent=Object.fromEntries(Object.keys(g.nodes).map(id=>[id,[]]));for(const e of g.edges){assert(positions[e.a]&&positions[e.b],e.id);adjacent[e.a].push(e.b);adjacent[e.b].push(e.a);}
const seen=new Set(),components=[];for(const id of Object.keys(adjacent)){if(seen.has(id))continue;const ids=[],stack=[id];seen.add(id);while(stack.length){const v=stack.pop();ids.push(v);for(const n of adjacent[v])if(!seen.has(n)){seen.add(n);stack.push(n);}}components.push(ids);}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sources=Object.keys(require.cache).filter(f=>f.startsWith(path.join(root,'simulator/engine'))).sort().map(f=>({path:path.relative(root,f),sha256:sha(f)}));
const report={commit,generated:'2026-11-01',inputPolicy:'Executable JS/JSON engine data only; no LS image, screenshot, PDF or PPTX opened',audit:G.audit(),components:components.map(ids=>({nodes:ids.length,stations:[...new Set(ids.map(id=>g.nodes[id].station).filter(Boolean))]})),edgeKinds:Object.fromEntries([...new Set(g.edges.map(e=>e.kind))].map(kind=>[kind,g.edges.filter(e=>e.kind===kind).length])),drawnNodes:Object.keys(positions).length,drawnEdges:g.edges.length,sections:L.line.sections.length,bypasses:L.line.sections.filter(s=>s.skipped.length),outsideBoundaries:g.boundaries,intermediate:L.INTERMEDIATE,sources,layout:{width,height,note:'Local node coordinates retain uniform scale. Interstation lengths and join slopes are schematic, not surveyed distances. Crossing strokes connect only at graph nodes.'}};
fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const num=n=>Math.round(n*100)/100,xy=p=>p.map(num).join(','),parts=[];
function add(s){parts.push(s);}
function text(x,y,s,cls='label',extra=''){add(`<text x="${num(x)}" y="${num(y)}" class="${cls}" ${extra}>${esc(s)}</text>`);}
function line(a,b,cls,extra=''){add(`<path d="M${xy(a)}L${xy(b)}" class="${cls}" ${extra}/>`);}
const style=`text{font-family:'Noto Sans CJK KR','Noto Sans CJK JP',sans-serif;fill:#dcece7}.label{font-size:14px;paint-order:stroke;stroke:#142d31;stroke-width:4px;stroke-linejoin:round}.tiny{font-size:11px;fill:#acc9c7;paint-order:stroke;stroke:#142d31;stroke-width:3px}.station{font-size:25px;font-weight:700;fill:#bee3e3}.sub{font-size:14px;fill:#a9c9c5}.minor{font-size:18px;font-weight:600;fill:#f4dca5}.rail{stroke:#e6f1ed;stroke-width:5;fill:none;stroke-linecap:butt}.link{stroke:#e6f1ed;stroke-width:4;fill:none}.boundary{stroke:#ed9d8b;stroke-width:3;stroke-dasharray:7 5;fill:none}.circuit{stroke-width:5;fill:none}.join{stroke-width:3;fill:none}.dot{fill:#bee3e3;stroke:#142d31;stroke-width:1}.switch{fill:#142d31;stroke:#bee3e3;stroke-width:1.5}.signal{fill:#142d31;stroke:#daeae6;stroke-width:1.5}`;
// Background panels are display guides only, never introduce graph edges.
for(const id of order){const s=stationLayout[id];add(`<rect x="${num(s.x-20)}" y="265" width="${num(s.w+40)}" height="650" rx="12" fill="#1b373b"/>`);text(s.center,156,N.catalog[id].name,'station','text-anchor="middle"');text(s.center,180,`${N.catalog[id].code} · ${W.data[id].rails.length}개 선로 · ${Object.keys(N.catalog[id].points).length}개 전환기`,'sub','text-anchor="middle"');}
for(const sec of L.line.sections){const c=sectionLayout[sec.id],codes=g.chains[sec.id],m=circuitLayout[codes[Math.floor(codes.length/2)]].center;const name=L.line.NAMES[sec.trunk];text(m[0],m[1]-33,name,'tiny','text-anchor="middle"');if(c.bypass)text((c.x0+c.x1)/2,c.yBypass+28,`${sec.skipped.map(id=>N.catalog[id].name).join('·')} ${name} 구내 미모델링 — 역간 연결만 존재`,'label','text-anchor="middle" fill="#ffb692"');}
const edgeIds=[];
for(const e of g.edges){
 const a=positions[e.a],b=positions[e.b];let d=`M${xy(a)}L${xy(b)}`,cls='rail',color='',extra='';
 if(e.kind==='local')cls=e.rail==='link'?'link':'rail';
 if(e.kind==='circuit'){const c=circuitLayout[g.nodes[e.a].code];cls='circuit';color=colors[c.trunk];}
 if(e.kind==='circuit-join'){cls='join';color=colors[circuitLayout[g.nodes[e.a].code].trunk];if(sectionLayout[e.section].bypass)extra='stroke-dasharray="8 5"';}
 if(e.kind==='boundary-join'){
  cls='join';const node=g.nodes[e.b],c=circuitLayout[node.code],sec=sectionLayout[c.section];color=colors[c.trunk];
  if(sec.bypass){const mid=[b[0],a[1]];d=`M${xy(a)}L${xy(mid)}L${xy(b)}`;extra='stroke-dasharray="8 5"';}
 }
 if(e.kind==='external-handover')cls='boundary';
 add(`<path id="edge-${esc(e.id)}" data-kind="${e.kind}" d="${d}" class="${cls}"${color?` stroke="${color}"`:''} ${extra}><title>${esc(e.id)} | ${esc(e.a)} → ${esc(e.b)}</title></path>`);edgeIds.push(e.id);
}
for(const [id,ns]of Object.entries(adjacent))if(ns.length>=3){const [x,y]=positions[id];add(`<circle cx="${num(x)}" cy="${num(y)}" r="3.2" class="dot"><title>${esc(id)} · degree ${ns.length}</title></circle>`);}
for(const [code,c]of Object.entries(circuitLayout)){const [x,y]=c.center;text(x,y+19,code,'label','text-anchor="middle"');const a=positions[code+':W'],b=positions[code+':E'];for(const p of [a,b])line([p[0],p[1]-6],[p[0],p[1]+6],'join',`stroke="${colors[c.trunk]}"`);}
for(const id of order){
 const st=N.catalog[id],def=W.data[id],s=stationLayout[id],project=p=>[s.x+(p[0]-s.minX)*scale,s.top+(p[1]-s.minY)*scale];
 for(const [rail,,targetX]of def.rails){const ns=st.topology.nodes.filter(n=>n.rail===rail);const n=ns.find(n=>targetX!==null&&Math.abs(n.point[0]-targetX)<.01)||ns[Math.floor(ns.length/2)];const p=positions[id+':'+n.id];text(p[0],p[1]+22,rail,'label','text-anchor="middle"');}
 for(const sig of def.signals){const [name,,x,y,dir]=sig,p=project([x,y]);add(`<circle cx="${num(p[0])}" cy="${num(p[1])}" r="4" class="signal"/>`);line(p,[p[0]+dir*12,p[1]],'join','stroke="#dcece7"');text(p[0]+dir*16,p[1]+4,name,'tiny',`text-anchor="${dir===1?'start':'end'}"`);}
 const printed=new Set();
 for(const e of st.topology.edges){if(!e.point||printed.has(e.point))continue;printed.add(e.point);const a=positions[id+':'+e.a],b=positions[id+':'+e.b],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];add(`<path d="M${p[0]},${p[1]-4}l4,4 -4,4 -4,-4Z" class="switch"/>`);text(p[0]+7,p[1]-8,e.point,'tiny');}
 for(const p of st.topology.ports.filter(p=>!Lcode(p.code))){const [x,y]=positions[id+':'+p.node];text(x+(p.side==='left'?-5:5),y-16,p.code,'tiny',`text-anchor="${p.side==='left'?'end':'start'}"`);}
}
for(const b of g.boundaries){const p=positions[b.id];add(`<rect x="${num(p[0]-5)}" y="${num(p[1]-5)}" width="10" height="10" fill="#ed9d8b"/>`);text(p[0],p[1]+24,b.name,'label','text-anchor="middle"');text(p[0],p[1]+43,'외부 경계 · 구외 배선 미정의','tiny','text-anchor="middle"');}
for(const [id,def]of Object.entries(L.INTERMEDIATE)){
 const markers=Object.entries(def.slots).map(([trunk,slot])=>({trunk,slot,c:circuitLayout[Lcode(slot)]})).filter(m=>m.c),sorted=markers.map(m=>m.c.center[0]).sort((a,b)=>a-b),x=sorted[Math.floor(sorted.length/2)];
 assert.equal(markers.length,Object.keys(def.slots).length,'every intermediate station slot mapped: '+id);
 text(x,215,N.catalog[id].name,'minor','text-anchor="middle"');
 text(x,237,markers.map(m=>m.trunk).join(' · '),'tiny','text-anchor="middle"');
 for(const m of markers){const p=m.c.center;add(`<rect x="${num(p[0]-9)}" y="${num(p[1]-7)}" width="18" height="14" fill="${colors[m.trunk]}" stroke="#10262a"><title>${esc(N.catalog[id].name+' '+m.trunk+' '+m.slot)}</title></rect>`);}
}
assert.equal(new Set(edgeIds).size,g.edges.length,'render every edge exactly once');
const body=parts.join('\n'),metadata=`${commit.slice(0,7)} · ${Object.keys(g.nodes).length} nodes / ${g.edges.length} edges / ${components.length} component · 320 circuits · 46 sections`;
function svgHead(w,h,viewBox){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}"><style>${style}</style>`;}
const full=svgHead(Math.ceil(width),height,`0 0 ${width} ${height}`)+`<rect width="${width}" height="${height}" fill="#142d31"/><text x="40" y="48" class="station">코드만으로 재구성한 전체 연결 배선도</text><text x="40" y="78" class="sub">${metadata}</text><text x="40" y="108" class="sub">구내 선형: topology.nodes.point · 역간 연결: line.graph.edges · 점 없는 교차는 접속 아님 · 거리는 도식화</text>`+body+'</svg>';
fs.writeFileSync(path.join(out,'network-full.svg'),full);
const cuts=[0,...[5,10].map(n=>(stationLayout[order[n-1]].x+stationLayout[order[n-1]].w+stationLayout[order[n]].x)/2),width],overviewW=6400;
const rowSizes=cuts.slice(1).map((end,i)=>({w:end-cuts[i],h:1040*6370/(end-cuts[i])})),overviewH=Math.ceil(140+rowSizes.reduce((sum,r)=>sum+r.h+50,0));
let overview=svgHead(overviewW,overviewH,`0 0 ${overviewW} ${overviewH}`)+`<rect width="${overviewW}" height="${overviewH}" fill="#142d31"/><text x="28" y="38" class="station">코드 전용 배선 연결 검증 — 전체 노선 (3행 펼침)</text><text x="28" y="66" class="sub">${metadata} · 각 행 오른쪽에서 다음 행 왼쪽으로 이어집니다. 전체 연속본: network-full.svg</text><text x="28" y="95" class="sub">흰색: 구내 / 민트: 지하철 / 금색: 전동선 / 청색: 일반선 / 붉은 점선: 외부 경계 / 일반선 점선: 금정 구내 미모델링 / 점 없는 교차: 비접속</text>`;
let rowTop=125;
for(let i=0;i<3;i++){
 const {w,h}=rowSizes[i];
 overview+=`<svg x="15" y="${rowTop}" width="6370" height="${h}" viewBox="${cuts[i]} 130 ${w} 1040" overflow="hidden"><defs><clipPath id="row-${i}"><rect x="${cuts[i]}" y="130" width="${w}" height="1040"/></clipPath></defs><g clip-path="url(#row-${i})">${body}</g></svg><text x="25" y="${rowTop+h+26}" class="sub">${i+1}행 · ${N.catalog[order[i*5]].name} → ${N.catalog[order[i*5+4]].name}${i<2?' → 다음 행 계속':''}</text>`;
 rowTop+=h+50;
}
overview+='</svg>';fs.writeFileSync(path.join(out,'network-overview.svg'),overview);
const stationOptions=order.map(id=>`<option value="${esc(id)}">${esc(N.catalog[id].name)}</option>`).join('');
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>코드 전체 배선도</title><style>body{margin:0;background:#142d31;color:#bee3e3;font:15px sans-serif}header{padding:16px;background:#203d42;position:sticky;top:0;z-index:2;display:flex;gap:14px;align-items:center}a{color:#bee3e3}button,select{padding:8px;background:#bee3e3;border:0;border-radius:5px;color:#173c42}#canvas{overflow:auto;height:calc(100vh - 100px)}svg{display:block}#note{padding:10px;color:#cbded9}#scale{width:180px}</style><header><b>코드 전용 전체 배선도</b><label>확대 <input id="scale" type="range" min="15" max="150" value="65"></label><select id="station">${stationOptions}</select><button id="go">역으로 이동</button><a href="network-full.svg">원본 SVG</a><a href="network-overview.png">전체 이미지</a><a href="audit.json">연결 검사 JSON</a></header><div id="note">${metadata} | 기존 LS 이미지 열람 없음. 기지 외부 7곳은 경계까지만 정의됨. 금정 일반선은 구내 모델 없이 안양–군포로 연결됨.</div><div id="canvas">${full}</div><script>const positions=${JSON.stringify(stationLayout)},w=${width},h=${height},svg=document.querySelector('#canvas>svg'),canvas=document.querySelector('#canvas');function zoom(){const k=+document.querySelector('#scale').value/100;svg.style.width=w*k+'px';svg.style.height=h*k+'px'}document.querySelector('#scale').oninput=zoom;document.querySelector('#go').onclick=()=>{const k=+document.querySelector('#scale').value/100;canvas.scrollLeft=positions[document.querySelector('#station').value].center*k-canvas.clientWidth/2};zoom();</script></html>`);
console.log(JSON.stringify({commit:commit.slice(0,7),nodes:report.drawnNodes,edges:report.drawnEdges,components:components.length,width:Math.ceil(width),height,bypasses:report.bypasses.map(s=>s.id),output:out},null,2));

(function(root){'use strict';
// Display ports only: these do not add circuits, switches, routes or engine connections.
const lineOf=()=>typeof module!=='undefined'?require('../engine/line'):root.SimLine;
const trunks=['MD','MU','ED','GD','GU','EU'];
// Main-line names are distinct from station track numbers (1T/2T).
function ports(st,def,scene){
 const Line=lineOf(),own=Line.line.stations[st.id].trunks,out=[];
 for(const side of ['left','right'])for(const trunk of trunks){
  const entry=own[trunk];
  const rows=def.rails.flatMap(r=>r[1].map(p=>p[1]));
  const cells=scene.cells.filter(c=>/^B\d{3,4}T/.test(c[3])&&Line.trunkOf(c[3])===trunk);
  // Non-controlled through tracks (e.g. Geumjeong's general lines) remain visible.
  if(entry?!entry[side]:!cells.length)continue;
  const candidates=cells.map(c=>{const row=rows.filter(y=>Math.abs(y-c[1])<6).sort((a,b)=>Math.abs(a-c[1])-Math.abs(b-c[1]))[0];return {x:c[0]+(side==='right'?c[2]:0),y:row??c[1],code:c[3]};});
  for(const rail of def.rails)if(Line.trunkOf(rail[side==='left'?3:4])===trunk){const p=side==='left'?rail[1][0]:rail[1].at(-1);candidates.push({x:p[0],y:p[1],code:rail[side==='left'?3:4]});}
  // 검토된 연결선(joins)이 이 끝에서 더 바깥으로 이어지면(예: 용산 B605T는 AT 줄에서 꺾여 내려가 화면 왼쪽 아래로 나간다) 그 바깥 끝에서 화면 끝으로 잇는다
  for(const c of candidates)for(const poly of scene.joins||[]){for(const [end,other] of [[poly[0],poly.at(-1)],[poly.at(-1),poly[0]]]){
   if(Math.abs(end[1]-c.y)<4&&Math.abs(end[0]-c.x)<20&&(side==='left'?other[0]<c.x-5:other[0]>c.x+5)){c.x=other[0];c.y=other[1];}}}
  candidates.sort((a,b)=>side==='left'?a.x-b.x:b.x-a.x);
  if(candidates[0])out.push({side,trunk,...candidates[0],name:Line.lineNameOf(trunk)});
 }
 return out;
}
function render(ports,T,height,width,inset=0,obstacles=[]){
 const paths=[],labels=[];
 // 화면 끝으로 이어지는 선로 자체도 이름이 덮지 않게 장애물로 둔다
 for(const port of ports){const [x,y]=T([port.x,port.y]);obstacles.push([Math.min(x,port.side==='left'?0:width),y-9,Math.max(x,port.side==='left'?0:width),y+9]);}
 for(const port of ports){const [x,y]=T([port.x,port.y]),edge=port.side==='left'?-inset:width+inset,toY=y;
  const d=`M${x} ${y}L${edge} ${toY}`;
  // Clear the edge underlay without adding a junction or a change in direction.
  paths.push(`<g class="seam-link ${port.state||'clear'}" data-track-state="${port.state||'clear'}" data-seam-side="${port.side}" data-seam-trunk="${port.trunk}" data-seam-code="${port.code}" data-seam-y="${toY}"><title>${port.name} · 화면 연결 · ${port.code}</title><path class="seam-clearance" d="${d}"/><path class="seam-rail" d="${d}"/></g>`);
  // 선로명(하2선·상1선 …)은 원본 LS에 없어 그리지 않는다
 }
 return `<g class="screen-continuations" aria-label="본선 화면 연결">${paths.join('')}${labels.join('')}</g>`;
}
const api={ports,render};if(typeof module!=='undefined')module.exports=api;else root.SimLSSeams=api;
})(typeof globalThis!=='undefined'?globalThis:this);

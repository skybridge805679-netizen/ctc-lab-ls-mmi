(function(root){'use strict';
// Display ports only: these do not add circuits, switches, routes or engine connections.
const lineOf=()=>typeof module!=='undefined'?require('../engine/line'):root.SimLine;
const trunks=['MD','MU','ED','GD','GU','EU'];
// The underground pair is surveyed as 1T (down) and 2T (up); retain both direction and track number.
const names={MD:'하선 · 1선',MU:'상선 · 2선',ED:'하2선',GD:'하1선',GU:'상1선',EU:'상2선'};
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
  candidates.sort((a,b)=>side==='left'?a.x-b.x:b.x-a.x);
  if(candidates[0])out.push({side,trunk,...candidates[0],name:names[trunk]});
 }
 return out;
}
function render(ports,T,height,width,inset=0){
 const paths=[],labels=[];
 for(const port of ports){const [x,y]=T([port.x,port.y]),edge=port.side==='left'?-inset:width+inset,toY=y;
  const d=`M${x} ${y}L${edge} ${toY}`;
  // Clear the edge underlay without adding a junction or a change in direction.
  paths.push(`<g class="seam-link ${port.state||'clear'}" data-track-state="${port.state||'clear'}" data-seam-side="${port.side}" data-seam-trunk="${port.trunk}" data-seam-code="${port.code}" data-seam-y="${toY}"><title>${port.name} · 화면 연결 · ${port.code}</title><path class="seam-clearance" d="${d}"/><path class="seam-rail" d="${d}"/></g>`);
  labels.push(`<text class="seam-name" x="${port.side==='left'?6:width-6}" y="${toY-18}" text-anchor="${port.side==='left'?'start':'end'}">${port.name}</text>`);
 }
 return `<g class="screen-continuations" aria-label="본선 화면 연결">${paths.join('')}${labels.join('')}</g>`;
}
const api={ports,render};if(typeof module!=='undefined')module.exports=api;else root.SimLSSeams=api;
})(typeof globalThis!=='undefined'?globalThis:this);

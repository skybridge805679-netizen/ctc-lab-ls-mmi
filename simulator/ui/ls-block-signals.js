(function(root){'use strict';
const inventory=typeof module!=='undefined'?require('../engine/block-signals'):root.SimBlockSignals;
const {railY}=typeof module!=='undefined'?require('../engine/track-geometry'):root.SimTrackGeometry;
function build(st,def,cells,T,visibleOnly=false){
 const items=(inventory[st.id]||[]).map(item=>{
  const code=item.anchorCode||item.code;
  const cell=cells.find(c=>c.label.replaceAll(' · ','')===code);
  const rail=def.rails.find(r=>r[3]===code||r[4]===code||r[0]===code);
  let x,y;
  let cellY;if(cell){x=cell.x+cell.width*item.fraction;y=cell.y;cellY=cell.y;}
  else if(rail){const p=rail[3]===code?rail[1][0]:rail[4]===code?rail[1].at(-1):[rail[2],railY(def,rail[0],rail[2])];[x,y]=T(p);x+=rail[3]===code?20:/^B\d+T/.test(code)?20:-20;}
  else {if(visibleOnly)return null;throw new Error(st.id+' block number anchor missing: '+code);}
  x=Math.max(22,Math.min(1578,x));y+=item.side==='above'?-17:17;
  return {...item,x,y,cellY,minX:cell?cell.x+22:22,maxX:cell?cell.x+cell.width-22:1578,box:[x-22,y-10,x+22,y+10]};
 }).filter(Boolean);
 // 폐색호주는 회로 경계에 선다: 표식의 기둥(⊢, 몸체에서 21px)이 그 줄의 회로 경계와 일치해야 「x~y호주 사이」가 한 회로를 가리킨다.
 // 하선(기둥 왼쪽)은 회로의 왼쪽 경계, 상선(기둥 오른쪽)은 오른쪽 경계. 원본 슬라이드의 회로 내 비율은 가장 가까운 경계를 고르는 데만 쓰고,
 // 한 경계에는 같은 쪽 표식이 하나만 선다 (노량진 B618T1T의 3·2호주가 한 회로 안에 겹치던 문제).
 const rowsOf=new Map();for(const c of cells){const k=[...rowsOf.keys()].find(y=>Math.abs(y-c.y)<3)??c.y;if(!rowsOf.has(k))rowsOf.set(k,[]);rowsOf.get(k).push(c.x,c.x+c.width);}
 const edges=y=>{const k=[...rowsOf.keys()].find(r=>Math.abs(r-y)<3);if(k===undefined)return [];const xs=[...rowsOf.get(k)].sort((a,b)=>a-b),out=[];for(const x of xs)if(!out.length||x-out.at(-1)>4)out.push(x);return out;};
 const used=new Map();
 for(const item of items.filter(i=>i.cellY!==undefined).sort((a,b)=>a.x-b.x)){
  const stem=item.stem==='left'?-1:1,bar=item.x+stem*21,key=item.cellY.toFixed(0)+'|'+item.side+'|'+item.stem,taken=used.get(key)||new Set();
  const pick=edges(item.cellY).filter(x=>!taken.has(Math.round(x))&&Math.abs(x-bar)<160).sort((a,b)=>Math.abs(a-bar)-Math.abs(b-bar))[0];
  if(pick===undefined)continue;taken.add(Math.round(pick));used.set(key,taken);
  item.x=Math.max(22,Math.min(1578,pick-stem*21));item.boundary=pick;item.minX=Math.min(item.minX,item.x);item.maxX=Math.max(item.maxX,item.x);item.box=[item.x-22,item.y-10,item.x+22,item.y+10];
 }
 // Resolve collisions within each original circuit and side, keeping both identity and order.
 const lanes=new Map();for(const item of items){const key=(item.anchorCode||item.code)+'|'+item.side+'|'+item.y.toFixed(1);if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(item);}
 for(const lane of lanes.values()){
  lane.sort((a,b)=>a.x-b.x);let start=0;
  while(start<lane.length){let end=start+1;while(end<lane.length&&lane[end].x-lane[end-1].x<48)end++;
   const group=lane.slice(start,end);
   if(group.length>1&&!group.every(p=>p.boundary!==undefined)){
    const lo=Math.max(22,...group.map(p=>p.minX)),hi=Math.min(1578,...group.map(p=>p.maxX)),span=(group.length-1)*48;
    if(hi-lo>=span){const ideal=group.reduce((sum,p,i)=>sum+p.x-i*48,0)/group.length,base=Math.max(lo,Math.min(hi-span,ideal));group.forEach((p,i)=>{p.x=base+i*48;p.box=[p.x-22,p.y-10,p.x+22,p.y+10];});}
   }
   start=end;
  }
 }
 return items;
}

function render(items){return items.map(p=>{
 const stem=p.stem==='left'?-1:1;
 return `<g class="block-indicator" data-source-symbol="block-number" data-block-id="${p.id}" data-block-number="${p.number}" data-block-code="${p.code}" data-block-anchor="${p.anchorCode||p.code}" aria-label="폐색 ${p.number} · ${p.code}"><path class="block-stem" d="M${p.x+stem*12} ${p.y}h${stem*9}m0 -6v12"/><rect class="block-body" x="${p.x-15}" y="${p.y-8}" width="30" height="16" rx="7"/><text class="block-number" x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central">${p.number}</text><title>폐색 번호 ${p.number} · 원본 인접 회로 ${p.code}</title></g>`;
 }).join('');}
const api={build,render};if(typeof module!=='undefined')module.exports=api;else root.SimLSBlockSignals=api;
})(typeof globalThis!=='undefined'?globalThis:this);

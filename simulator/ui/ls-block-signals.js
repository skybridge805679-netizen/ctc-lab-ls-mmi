(function(root){'use strict';
const inventory=typeof module!=='undefined'?require('../engine/block-signals'):root.SimBlockSignals;
const {railY}=typeof module!=='undefined'?require('../engine/track-geometry'):root.SimTrackGeometry;
function build(st,def,cells,T,visibleOnly=false){
 return (inventory[st.id]||[]).map(item=>{
  const code=item.anchorCode||item.code;
  const cell=cells.find(c=>c.label.replaceAll(' · ','')===code);
  const rail=def.rails.find(r=>r[3]===code||r[4]===code||r[0]===code);
  let x,y;
  if(cell){x=cell.x+cell.width*item.fraction;y=cell.y;}
  else if(rail){const p=rail[3]===code?rail[1][0]:rail[4]===code?rail[1].at(-1):[rail[2],railY(def,rail[0],rail[2])];[x,y]=T(p);x+=rail[3]===code?20:-20;}
  else {if(visibleOnly)return null;throw new Error(st.id+' block number anchor missing: '+code);}
  x=Math.max(22,Math.min(1578,x));y+=item.side==='above'?-17:17;
  return {...item,x,y,box:[x-22,y-10,x+22,y+10]};
 }).filter(Boolean);
}
function render(items){return items.map(p=>{
 const stem=p.stem==='left'?-1:1;
 return `<g class="block-indicator" data-source-symbol="block-number" data-block-id="${p.id}" data-block-number="${p.number}" data-block-code="${p.code}" data-block-anchor="${p.anchorCode||p.code}" aria-label="폐색 ${p.number} · ${p.code}"><path class="block-stem" d="M${p.x+stem*12} ${p.y}h${stem*9}m0 -6v12"/><rect class="block-body" x="${p.x-15}" y="${p.y-8}" width="30" height="16" rx="7"/><text class="block-number" x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central">${p.number}</text><title>폐색 번호 ${p.number} · 원본 인접 회로 ${p.code}</title></g>`;
 }).join('');}
const api={build,render};if(typeof module!=='undefined')module.exports=api;else root.SimLSBlockSignals=api;
})(typeof globalThis!=='undefined'?globalThis:this);

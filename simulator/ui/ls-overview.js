(function(root){'use strict';
const node=typeof module!=='undefined',N=node?require('../engine/network'):root.SimNetwork,W=node?require('../engine/wiring'):root.SimWiring,C=node?require('../engine/core'):root.SimCore,LS=node?require('./ls-view'):root.SimLS,P=node?require('./ls-presets'):root.SimLSPresets,L=node?require('../engine/line'):root.SimLine;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]||0;
const REGIONS=[
 {id:'north',name:'[청량리 - 영등포]',rows:[['cheongnyangni','dongmyo','jonggak','underground-seoul','seoul'],['yongsan','noryangjin','yeongdeungpo']]},
 {id:'south',name:'[구로 - 수원]',rows:[['guro','geumcheon','anyang','geumjeong'],['gunpo','uiwang','suwon']]},
 {id:'central',name:'[노량진 - 금천구청]',rows:[['noryangjin','yeongdeungpo','guro','geumcheon']]}
];
function build(ids,states,occupied={},options={}){
 const all=N.stations.filter(s=>s.controlled),panels=[],rows=[],joins=[],header=64,gap=70;
 const region=REGIONS.find(r=>{const members=r.rows.flat();return members.length===ids.length&&members.every(id=>ids.includes(id));});
 const groups=region?region.rows:[all.slice(0,5).map(s=>s.id),all.slice(5,10).map(s=>s.id),all.slice(10).map(s=>s.id)];
 for(const group of groups){
  const stations=group.filter(id=>ids.includes(id)).map(id=>all.find(s=>s.id===id));if(!stations.length)continue;const row=[];
  for(const st of stations){
   const view=LS.render(st,W.data[st.id],C.forStation(st.id),states[st.id],{overview:true,occupied:occupied[st.id]||new Set()}),panel={id:st.id,row:rows.length,station:st,view,x:0,y:0,width:view.contentWidth,height:view.height+header,ports:view.ports.map(p=>({...p,key:L.mainLineOf(p.trunk),at:[p.at[0],p.at[1]+header]}))};
   const prev=row.at(-1);if(prev){panel.x=prev.x+prev.width+gap;const pairs=prev.ports.filter(p=>p.side==='right').flatMap(a=>panel.ports.filter(b=>b.side==='left'&&b.key===a.key).map(b=>({a,b})));panel.y=median(pairs.map(({a,b})=>prev.y+a.at[1]-b.at[1]));
    for(const [i,{a,b}]of pairs.entries()){const from=[prev.x+a.at[0],prev.y+a.at[1]],to=[panel.x+b.at[0],panel.y+b.at[1]],x=prev.x+prev.width+gap*(i+1)/(pairs.length+1);joins.push({row:rows.length,fromStation:prev.id,toStation:panel.id,trunk:a.key,from,to,points:Math.abs(from[1]-to[1])<1?[from,to]:[from,[x,from[1]],[x,to[1]],to]});}
   }row.push(panel);
  }
  const shift=60-Math.min(...row.map(p=>p.y));for(const p of row)p.y+=shift;for(const j of joins.filter(j=>j.row===rows.length)){j.from[1]+=shift;j.to[1]+=shift;for(const p of j.points)if(p!==j.from&&p!==j.to)p[1]+=shift;}
  rows.push({panels:row,height:Math.max(...row.map(p=>p.y+p.height))+60,width:row.at(-1).x+row.at(-1).width});panels.push(...row);
 }
 // Each reference row spans the canvas. Fit uniformly within each row so labels,
 // switch arms and circles retain their proportions rather than stretching X alone.
 const padding=60,contentWidth=Math.max(1600,...rows.map(r=>r.width)),width=contentWidth+padding*2;
 for(const row of rows){row.scale=contentWidth/row.width;row.height*=row.scale;}
 const naturalHeight=rows.reduce((n,r)=>n+r.height,0)+padding*2;
 const height=Math.max(naturalHeight,Number.isFinite(options.aspect)&&options.aspect>0?width/options.aspect:width*9/16);
 const spare=height-naturalHeight,between=spare/(rows.length+1);
 let y=padding+between;
 for(const [r,row]of rows.entries()){
  row.y=y;
  for(const p of row.panels){p.scale=row.scale;p.x=padding+p.x*row.scale;p.y=y+p.y*row.scale;}
  for(const j of joins.filter(j=>j.row===r))for(const p of new Set(j.points)){p[0]=padding+p[0]*row.scale;p[1]=y+p[1]*row.scale;}
  y+=row.height+between;
 }
 const connections=joins.map(j=>`<path class="overview-link" style="stroke-width:${18*rows[j.row].scale}" data-overview-link="${j.fromStation}:${j.toStation}:${j.trunk}" d="M${j.points.map(p=>p.join(' ')).join('L')}"/>`).join('');
 const content=panels.map(p=>{
  const st=p.station,state=states[p.id],prefix='ov-'+p.id+'-',svg=p.view.svg.replace(/ id="([^"]+)"/g,(_,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}${id})`).replace(/ tabindex="0"/g,'').replace(/data-signal="/g,'data-overview-signal="');
  const monitors=P.CORRIDORS.filter(c=>c.host===p.id),coreWidth=monitors.length?p.view.sourcePoint([monitors[0].cut,0])[0]:p.width;
  const modes=['AUTO','CCM','LOCAL'].map((m,i)=>`<rect class="overview-mode ${state.mode===m?m.toLowerCase():''}" x="${i*74}" width="68" height="30"/><text x="${i*74+34}" y="20" text-anchor="middle">${m}</text>`).join('');
  const equipment=['N1','N2','C','REC','UPS','ShP','EIS1','EIS2','DTS1','DTS2','RC'].map((name,i)=>{const col=i%6,row=Math.floor(i/6),fault=root.SimEquipment?.isFault?.(p.id,name),kind=fault?'fault':['N2','RC'].includes(name)?'idle':['EIS2','DTS2'].includes(name)?'standby':'';return `<rect class="overview-equipment ${kind}" x="${522+col*26}" y="${row*20}" width="23" height="17"/><text class="overview-equipment-label" x="${533.5+col*26}" y="${row*20+12}" text-anchor="middle">${name}</text>`;}).join('');
  const title=`<g class="overview-header" transform="translate(${Math.max(8,coreWidth/2-340)} 6)">${modes}<rect class="overview-stop" x="222" width="84" height="44"/><text x="264" y="18" text-anchor="middle">신호기</text><text x="264" y="36" text-anchor="middle">일괄정지</text><rect class="overview-name ${['cheongnyangni','dongmyo','jonggak','underground-seoul'].includes(p.id)?'metro':''}" x="316" width="190" height="44"/><text class="overview-name-text" x="411" y="18" text-anchor="middle">${esc(st.name)}</text><text class="overview-code" x="411" y="36" text-anchor="middle">${st.code}</text>${equipment}</g>`;
  const regions=monitors.map(c=>{const left=p.view.sourcePoint([c.cut,0])[0],right=p.view.sourcePoint([c.right,0])[0];return `<g data-overview-station="${c.id}" data-overview-control-station="${p.id}" role="button" tabindex="0" aria-label="${esc(c.name)} 화면"><rect class="overview-hit" x="${left}" y="0" width="${Math.max(20,Math.min(p.width,right)-left)}" height="${p.height}"/><text class="overview-monitor-title" x="${(left+Math.min(p.width,right))/2}" y="30" text-anchor="middle">${esc(c.name)}</text></g>`;}).join('');
  return `<g transform="translate(${p.x} ${p.y}) scale(${p.scale})" data-overview-row="${p.row}" data-overview-station="${p.id}" data-overview-control-station="${p.id}" role="button" tabindex="0" aria-label="${esc(st.name)} ${state.mode} 화면"><rect class="overview-hit" width="${p.width}" height="${p.height}"/>${title}<svg class="overview-detail" data-overview-detail="${p.id}" data-monitor="false" x="0" y="${header}" width="${p.view.width}" height="${p.view.height}" viewBox="0 0 ${p.view.width} ${p.view.height}" style="width:${p.view.width}px;height:${p.view.height}px;pointer-events:none;overflow:hidden">${svg}</svg>${regions}</g>`;
 }).join('');
 return {width,height,panels,joins,rows,region:region?.id||'all',svg:`<svg class="ls-svg overview-network" preserveAspectRatio="xMidYMid meet" viewBox="0 0 ${width} ${height}" role="img" aria-label="전체 구간 연속 배선도">${connections}${content}</svg>`};
}
const api={build,REGIONS};if(node)module.exports=api;else root.SimLSOverview=api;
})(typeof window!=='undefined'?window:globalThis);

/* Circuit identities from reviewed source strips. Numeric gaps are recorded, never filled with invented circuits. */
(function(root){'use strict';
const node=typeof module!=='undefined',N=node?require('./network'):root.SimNetwork,D=node?require('./schematic-details'):root.SimSchematicDetails;
const codeOf=name=>/^B\d+T/.exec(name||'')?.[0]||null;
const number=name=>+(codeOf(name)?.slice(1,-1)||NaN);
const trunk=name=>{const n=number(name);return Number.isFinite(n)?(n<600?'M':n<900?'G':'E')+(n%2===0?'D':'U'):null;};
const DEPOTS=[
 {station:'dongmyo',code:'CT',name:'군자기지 출고선'}, {station:'dongmyo',code:'DT',name:'군자기지 입고선'},
 {station:'guro',code:'F1T',name:'구로 차량기지 입출고선'}, {station:'guro',code:'F2T',name:'구로 차량기지 입출고선'},
 {station:'uiwang',code:'GT',name:'남부화물기지 A선'}, {station:'uiwang',code:'FT',name:'남부화물기지 A선'}, {station:'uiwang',code:'ET',name:'남부화물기지 B선'}
];
function build(sections){
 const circuits={},nodes={},edges=[],chains={},resourceToCode={};
 const add=(name,source)=>{const code=codeOf(name);if(!code)return;const c=circuits[code]??={id:code,trunk:trunk(code),sources:[]};c.sources.push(source);};
 for(const st of N.stations.filter(s=>s.controlled)){
  for(const strip of D[st.id]?.strips||[])for(const code of strip.codes)add(code,{station:st.id,kind:'reviewed-strip',slide:strip.slide||null});
  for(const p of st.topology.ports){add(p.code,{station:st.id,kind:'native-port',rail:p.rail,side:p.side});for(const e of st.topology.edges)if(e.a===p.node||e.b===p.node)if(codeOf(p.code))resourceToCode[e.resource]=codeOf(p.code);}
  for(const n of st.topology.nodes)nodes[`${st.id}:${n.id}`]={...n,id:`${st.id}:${n.id}`,station:st.id,kind:'local'};
  for(const e of st.topology.edges)edges.push({...e,id:e.resource,a:`${st.id}:${e.a}`,b:`${st.id}:${e.b}`,kind:'local'});
 }
 for(const c of Object.values(circuits)){nodes[c.id+':W']={id:c.id+':W',kind:'circuit-end',code:c.id};nodes[c.id+':E']={id:c.id+':E',kind:'circuit-end',code:c.id};edges.push({id:'circuit:'+c.id,a:c.id+':W',b:c.id+':E',resource:'circuit:'+c.id,kind:'circuit'});}
 for(const st of N.stations.filter(s=>s.controlled))for(const p of st.topology.ports){const c=codeOf(p.code);if(c)edges.push({id:`port:${st.id}:${p.rail}:${p.side}`,a:`${st.id}:${p.node}`,b:c+(p.side==='left'?':E':':W'),kind:'boundary-join'});}
 for(const sec of sections){
  const list=Object.values(circuits).filter(c=>c.trunk===sec.trunk&&number(c.id)>=number(sec.westSide)&&number(c.id)<=number(sec.eastSide)).sort((a,b)=>number(a.id)-number(b.id)).map(c=>c.id);
  chains[sec.id]=list;
  for(let i=1;i<list.length;i++)edges.push({id:`join:${list[i-1]}>${list[i]}`,a:list[i-1]+':E',b:list[i]+':W',kind:'circuit-join',section:sec.id,numberGap:number(list[i])-number(list[i-1])>2});
 }
 const boundaries=DEPOTS.map(b=>{const p=N.catalog[b.station].topology.ports.find(p=>p.code===b.code),id=`external:${b.station}:${b.code}`;if(!p)throw Error('Unknown depot boundary '+id);nodes[id]={id,kind:'external-boundary',name:b.name};edges.push({id:'handover:'+id,a:`${b.station}:${p.node}`,b:id,kind:'external-handover'});return {...b,id,rail:p.rail,node:`${b.station}:${p.node}`,outsideSurvey:true};});
 return {circuits,nodes,edges,chains,boundaries,resourceToCode};
}
const api={build,codeOf,trunk,number,DEPOTS};if(node)module.exports=api;else root.SimTrackNetwork=api;
})(typeof window!=='undefined'?window:globalThis);

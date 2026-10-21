(function(root){
 'use strict';
 const N=root.SimNetwork,T=root.SimTimetable,$=id=>document.getElementById(id);
 const model=T.initial(),subscribers=new Set();let notified=0;let context=null,selected=model.trains[0].id;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const options=N.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
 function message(text){$('graphMessage').textContent=text;}
 function selectTrain(id){selected=id;$('graphTrain').value=id;render();}
 function render(){
  if(!context)return;
  while(notified<model.changes.length){const change=model.changes[notified++];for(const listener of subscribers)listener(change);}
  $('graphTrain').innerHTML=model.trains.map(t=>`<option>${escape(t.id)}</option>`).join('');$('graphTrain').value=selected;
  if($('graphPanel').hidden)return;
  const from=N.catalog[$('graphFrom').value].order,to=N.catalog[$('graphTo').value].order;
  const parts=$('graphStart').value.split(':').map(Number),span=Number($('graphSpan').value)*60;
  if(parts.length!==2||!parts.every(Number.isFinite)||from>to){message('시작역은 종착역 앞에, 시작시각은 올바른 시각으로 지정하세요.');$('diaSvg').innerHTML='';return;}
  const start=parts[0]*3600+parts[1]*60-8*3600;
  // Layout and look follow the real "T/G" window (photo 2026-10-21): code + red station name on the left, 5-minute time axis on
  // top, green scale on the right, dotted dark-blue train lines with rotated train numbers, orange-brown plot border.
  const row=Number($('graphRow').value),left=196,right=74,plotW=1180,width=left+plotW+right,top=92,height=top+(to-from)*row+34;
  const x=t=>left+(t-start)/span*plotW,y=order=>top+(order-from)*row,plotTop=top-14,plotH=(to-from)*row+28;
  const info=id=>window.SimMMI?.stationInfo?.(id)||{name:N.catalog[id].name,code:N.catalog[id].code};
  const sod=t=>8*3600+t,day=T.clock(0)&&model.serviceDate?new Date(model.serviceDate+'T00:00:00'):new Date();
  let svg=`<defs><clipPath id="diaClip"><rect x="${left}" y="${plotTop}" width="${plotW}" height="${plotH}"/></clipPath></defs><rect width="${width}" height="${height}" fill="#fff"/>`;
  svg+=`<text x="10" y="20" font-size="13" fill="#111">${day.getFullYear()}년 ${day.getMonth()+1}월 ${day.getDate()}일 (${'일월화수목금토'[day.getDay()]}요일)</text><text x="${left+plotW/2}" y="24" text-anchor="middle" font-size="19" font-weight="700" fill="#d6251f" letter-spacing="8">경 부 선</text><text x="${left+plotW+8}" y="24" font-size="10" fill="#1f9d4a">역 순서</text>`;
  const minor=span<=3600?60:span<=21600?300:600;
  for(let t=Math.ceil(start/minor)*minor;t<=start+span;t+=minor){
   const s=sod(t),hour=s%3600===0,half=s%1800===0,px=x(t).toFixed(1),mm=String(Math.floor((s%3600)/60)).padStart(2,'0');
   svg+=`<line x1="${px}" y1="${plotTop}" x2="${px}" y2="${plotTop+plotH}" stroke="${hour?'#6f9a7b':half?'#b3c8b9':'#d2d2d2'}" stroke-width="${hour?1.3:1}" ${hour||half?'':'stroke-dasharray="1 3"'}/>`;
   svg+=hour?`<text x="${px}" y="${plotTop-5}" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${T.clock(t).slice(0,5)}</text>`:`<text x="${px}" y="${plotTop-5}" text-anchor="middle" font-size="9" fill="${half?'#e08a00':'#333'}">${mm}</text>`;
  }
  for(const st of N.stations.slice(from,to+1)){
   const i=info(st.id),ry=y(st.order);
   svg+=`<line x1="${left}" y1="${ry}" x2="${left+plotW}" y2="${ry}" stroke="${st.controlled?'#b9b9b9':'#d6d6d6'}" ${st.controlled?'':'stroke-dasharray="1 3"'}/>`;
   svg+=`<text x="10" y="${ry+4}" font-size="11" fill="#111" pointer-events="none">${escape(i.code&&i.code!=='—'?i.code:'')}</text>`;
   svg+=`<text ${st.controlled?`data-dia-station="${st.id}" tabindex="0" role="button" aria-label="${escape(i.name)} LS 열기"`:`data-dia-stop="${st.id}"`} x="${left-8}" y="${ry+4}" text-anchor="end" fill="#d6251f" font-size="12" font-weight="${st.controlled?700:500}">${escape(i.name)}</text>`;
   svg+=`<text x="${left+plotW+8}" y="${ry+4}" font-size="10.5" fill="#1f9d4a" pointer-events="none">${st.order+1}</text>`;
  }
  svg+=`<rect x="${left}" y="${plotTop}" width="${plotW}" height="${plotH}" fill="none" stroke="#b8541f" stroke-width="2"/>`;
  svg+='<g clip-path="url(#diaClip)">';
  const direction=$('graphDirection').value;
  for(const train of model.trains){
   if(direction!=='all'&&train.direction!==direction)continue;
   const points=calls=>calls.flatMap(c=>[[c.arrival,N.catalog[c.station].order],[c.departure,N.catalog[c.station].order]]).map(([time,order])=>[x(time),y(order)]);
   const path=pts=>pts.map(([px,py],i)=>`${i?'L':'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
   const ink=train.cancelled?'#94a3a0':'#1b2a78',pts=points(train.calls);
   svg+=`<path d="${path(points(train.plan))}" stroke="#c6c6c6" stroke-dasharray="5 4" stroke-width="1" fill="none"/>`;
   let currentPath=path(pts);if(!train.cancelled&&train.calls.some(c=>c.cancelled)){currentPath='';for(let i=0;i<train.calls.length;i++){const c=train.calls[i],n=train.calls[i+1];if(!c.cancelled)currentPath+=path([[x(c.arrival),y(N.catalog[c.station].order)],[x(c.departure),y(N.catalog[c.station].order)]]);if(n&&!c.cancelled&&!n.cancelled)currentPath+=path([[x(c.departure),y(N.catalog[c.station].order)],[x(n.arrival),y(N.catalog[n.station].order)]]);}}
   svg+=`<path data-dia-train="${train.id}" d="${currentPath}" stroke="${ink}" stroke-width="${selected===train.id?2.8:1.7}" stroke-dasharray="${train.cancelled?'8 5':'2 3'}" fill="none"><title>${train.id} · ${train.kind} · ${train.direction==='down'?'하행':'상행'}${train.cancelled?' · 운휴':''} · ${T.clock(train.calls[0].departure)}–${T.clock(train.calls.at(-1).arrival)}</title></path>`;
   // Cancelled calls and their connecting legs are shown separately on the same online model.
   if(!train.cancelled)for(let i=0;i<train.calls.length;i++){const c=train.calls[i],next=train.calls[i+1];let p='';if(c.cancelled)p+=path([[x(c.arrival),y(N.catalog[c.station].order)],[x(c.departure),y(N.catalog[c.station].order)]]);if(next&&(c.cancelled||next.cancelled))p+=path([[x(c.departure),y(N.catalog[c.station].order)],[x(next.arrival),y(N.catalog[next.station].order)]]);if(p)svg+=`<path data-dia-cancelled-segment="${train.id}" data-dia-select="${train.id}" d="${p}" stroke="#8b969c" stroke-width="3" stroke-dasharray="7 4" fill="none"/>`;}
   // train number rotated along the longest visible segment
   let best=null;for(let i=1;i<pts.length;i++){const [x1,y1]=pts[i-1],[x2,y2]=pts[i],len=Math.hypot(x2-x1,y2-y1);if(len>12&&Math.max(x1,x2)>left&&Math.min(x1,x2)<left+plotW&&(!best||len>best.len))best={len,x1,y1,x2,y2};}
   if(best){let ang=Math.atan2(best.y2-best.y1,best.x2-best.x1)*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;const mx=(best.x1+best.x2)/2,my=(best.y1+best.y2)/2;
    svg+=`<text transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})" text-anchor="middle" dy="-3" fill="${ink}" font-size="10" pointer-events="none">${train.id}${train.cancelled?' 운휴':''}</text>`;}
   const pos=T.position(train,context.clock());if(pos)svg+=`<circle data-dia-position="${train.id}" cx="${x(context.clock())}" cy="${y(pos.order)}" r="3.6" fill="${ink}" stroke="white"/>`;
  }
  const now=x(context.clock());svg+=`<line id="diaNow" data-seconds="${context.clock()}" x1="${now}" y1="${plotTop}" x2="${now}" y2="${plotTop+plotH}" stroke="#d6251f" stroke-width="1.6"/></g>`;
  svg+=`<text x="10" y="${height-8}" font-size="11" fill="#555">준비</text>`;
  $('diaSvg').setAttribute('viewBox',`0 0 ${width} ${height}`);$('diaSvg').setAttribute('width',width);$('diaSvg').setAttribute('height',height);$('diaSvg').innerHTML=svg;
  const train=model.trains.find(t=>t.id===selected),pos=T.position(train,context.clock());
  $('graphCancel').textContent=train.cancelled?'운휴 복원':'전체 운휴';
  $('graphDetails').innerHTML=`<h3>${escape(train.id)} · ${train.direction==='down'?'하행':'상행'} · ${train.cancelled?'전체 운휴':pos?(N.catalog[pos.station].name+' '+pos.status):'운행 전 / 운행 종료'}</h3><p>시발 ${N.catalog[train.calls[0].station].name} ${T.clock(train.calls[0].departure)} → 종착 ${N.catalog[train.calls.at(-1).station].name} ${T.clock(train.calls.at(-1).arrival)} · 현재 ${T.clock(context.clock())}</p><div class="call-table"><table><thead><tr><th>역</th><th>최초 도착</th><th>현재 도착</th><th>현재 출발</th></tr></thead><tbody>${train.calls.filter(c=>N.catalog[c.station].order>=from&&N.catalog[c.station].order<=to).map(c=>`<tr><td>${N.catalog[c.station].name}</td><td>${T.clock(train.plan.find(p=>p.station===c.station).arrival)}</td><td>${T.clock(c.arrival)}</td><td>${T.clock(c.departure)}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function init(api){
  context=api;
  for(const id of ['graphFrom','graphTo','graphDelayStation'])$(id).innerHTML=options;
  $('graphTo').value=N.stations.at(-1).id;
  $('graphTrain').innerHTML=model.trains.map(t=>`<option>${t.id}</option>`).join('');
  $('trainGraphMenu').onclick=()=>$('graphSubmenu').hidden=!$('graphSubmenu').hidden;
  $('onlineGraphBtn').onclick=()=>{$('graphPanel').hidden=false;render();$('graphPanel').scrollIntoView({behavior:'smooth'});};
  $('closeGraph').onclick=()=>$('graphPanel').hidden=true;
  for(const id of ['graphFrom','graphTo','graphStart','graphSpan','graphRow','graphDirection'])$(id).onchange=()=>{message('');render();};
  $('graphTrain').onchange=e=>selectTrain(e.target.value);
  $('graphFind').onclick=()=>{const id=$('graphSearch').value.trim().toUpperCase();const train=model.trains.find(t=>t.id===id);if(!train){message('해당 열차번호가 없습니다.');return;}$('graphDirection').value='all';$('graphFrom').value=N.stations[0].id;$('graphTo').value=N.stations.at(-1).id;$('graphStart').value=T.clock(train.calls[0].arrival).slice(0,5);selectTrain(id);message(id+' 열차 선택');};
  $('graphSearch').onkeydown=e=>{if(e.key==='Enter')$('graphFind').click();};
  $('graphNow').onclick=()=>{$('graphStart').value=T.clock(Math.max(-8*3600,context.clock()-600)).slice(0,5);message('');render();};
  $('graphApplyDelay').onclick=()=>{const result=T.delay(model,selected,$('graphDelayStation').value,Number($('graphDelay').value));message(result.message);render();};
  $('graphCancel').onclick=()=>{T.cancel(model,selected);message(selected+' 운휴 상태 변경');render();};
  $('diaSvg').onclick=e=>{const train=e.target.closest('[data-dia-train],[data-dia-select]'),station=e.target.closest('[data-dia-station]');if(train)selectTrain(train.dataset.diaTrain||train.dataset.diaSelect);if(station){context.selectStation(station.dataset.diaStation);$('graphDelayStation').value=station.dataset.diaStation;}};
  $('diaSvg').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-dia-station]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
  $('graphExport').onclick=()=>{const data={schemaVersion:1,kind:'CTC LAB training timetable',sampleSchedule:true,clock:context.clock(),...model};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-dia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 root.SimDiagram={init,render,getModel:()=>model,subscribe:fn=>{subscribers.add(fn);return ()=>subscribers.delete(fn);},selectTrain};
})(window);

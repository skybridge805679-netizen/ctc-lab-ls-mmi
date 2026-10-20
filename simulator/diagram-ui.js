(function(root){
 'use strict';
 const N=root.SimNetwork,T=root.SimTimetable,$=id=>document.getElementById(id);
 const model=T.initial();let context=null,selected=model.trains[0].id;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const options=N.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
 function message(text){$('graphMessage').textContent=text;}
 function selectTrain(id){selected=id;$('graphTrain').value=id;render();}
 function render(){
  if(!context)return;
  $('graphTrain').innerHTML=model.trains.map(t=>`<option>${escape(t.id)}</option>`).join('');$('graphTrain').value=selected;
  if($('graphPanel').hidden)return;
  const from=N.catalog[$('graphFrom').value].order,to=N.catalog[$('graphTo').value].order;
  const parts=$('graphStart').value.split(':').map(Number),span=Number($('graphSpan').value)*60;
  if(parts.length!==2||!parts.every(Number.isFinite)||from>to){message('시작역은 종착역 앞에, 시작시각은 올바른 시각으로 지정하세요.');$('diaSvg').innerHTML='';return;}
  const start=parts[0]*3600+parts[1]*60-8*3600;
  const row=Number($('graphRow').value),width=1300,height=70+(to-from+1)*row;
  const x=t=>105+(t-start)/span*(width-140),y=order=>50+(order-from)*row;
  let svg=`<defs><clipPath id="diaClip"><rect x="104" y="32" width="${width-125}" height="${height-45}"/></clipPath></defs><rect width="${width}" height="${height}" fill="#fcfdfb"/>`;
  const interval=span<=1800?120:span<=3600?300:600;
  for(let t=Math.ceil(start/interval)*interval;t<=start+span;t+=interval)svg+=`<line x1="${x(t)}" y1="32" x2="${x(t)}" y2="${height-20}" stroke="#dce4df"/><text x="${x(t)}" y="22" text-anchor="middle" font-size="12" fill="#52645c">${T.clock(t).slice(0,5)}</text>`;
  for(const st of N.stations.slice(from,to+1))svg+=`<line x1="104" y1="${y(st.order)}" x2="${width-20}" y2="${y(st.order)}" stroke="${st.controlled?'#a9bbb2':'#e0e8e3'}"/><text ${st.controlled?`data-dia-station="${st.id}" tabindex="0" role="button" aria-label="${st.name} LS 열기"`:"data-dia-stop=\""+st.id+"\""} x="96" y="${y(st.order)+4}" text-anchor="end" fill="#344e43" font-size="12">${st.name}</text>`;
  svg+='<g clip-path="url(#diaClip)">';
  const direction=$('graphDirection').value;
  for(const train of model.trains){
   if(direction!=='all'&&train.direction!==direction)continue;
   const path=calls=>calls.flatMap(c=>[[c.arrival,N.catalog[c.station].order],[c.departure,N.catalog[c.station].order]]).map(([time,order],i)=>`${i?'L':'M'}${x(time).toFixed(2)} ${y(order).toFixed(2)}`).join(' ');
   const color=train.cancelled?'#94a3a0':train.direction==='down'?'#cc543e':'#246ca6';
   svg+=`<path d="${path(train.plan)}" stroke="#bac4bf" stroke-dasharray="4 5" stroke-width="1" fill="none"/>`;
   svg+=`<path data-dia-train="${train.id}" d="${path(train.calls)}" stroke="${color}" stroke-width="${selected===train.id?3:1.5}" ${train.cancelled?'stroke-dasharray="8 5"':''} fill="none"><title>${train.id} · ${train.kind} · ${train.direction==='down'?'하행':'상행'}${train.cancelled?' · 운휴':''} · ${T.clock(train.calls[0].departure)}–${T.clock(train.calls.at(-1).arrival)}</title></path>`;
   const first=train.calls.find(c=>c.arrival>=start&&c.arrival<=start+span&&N.catalog[c.station].order>=from&&N.catalog[c.station].order<=to);
   if(first)svg+=`<text x="${x(first.arrival)+5}" y="${y(N.catalog[first.station].order)-5}" fill="${color}" font-size="11" pointer-events="none">${train.id}${train.cancelled?' 운휴':''}</text>`;
   const pos=T.position(train,context.clock());if(pos)svg+=`<circle data-dia-position="${train.id}" cx="${x(context.clock())}" cy="${y(pos.order)}" r="4" fill="${color}" stroke="white"/>`;
  }
  const now=x(context.clock());svg+=`<line id="diaNow" data-seconds="${context.clock()}" x1="${now}" y1="32" x2="${now}" y2="${height-20}" stroke="#bb2f45" stroke-width="2"/></g>`;
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
  $('diaSvg').onclick=e=>{const train=e.target.closest('[data-dia-train]'),station=e.target.closest('[data-dia-station]');if(train)selectTrain(train.dataset.diaTrain);if(station){context.selectStation(station.dataset.diaStation);$('graphDelayStation').value=station.dataset.diaStation;}};
  $('diaSvg').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-dia-station]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
  $('graphExport').onclick=()=>{const data={schemaVersion:1,kind:'CTC LAB training timetable',sampleSchedule:true,clock:context.clock(),...model};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-dia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 root.SimDiagram={init,render,getModel:()=>model,selectTrain};
})(window);

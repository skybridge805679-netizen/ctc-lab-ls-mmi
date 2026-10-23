(function(){
'use strict';
// Presentation only: consistent, locally rendered control glyphs. Buttons keep their IDs and handlers.
const paths={
 workspace:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
 guide:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z M12 6v15',
 export:'M12 3v12 m-4-4 4 4 4-4 M5 16v5h14v-5',
 reset:'M4 10a8 8 0 1 1 1 8 M4 4v6h6',
 scenario:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
 equipment:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
 cdrs:'M4 4v4l16 8v4 M20 4v4L4 16v4 M2 4h4 M18 4h4 M2 20h4 M18 20h4',
 ledger:'M5 3h14v18H5z M8 7h2 M13 7h3 M8 11h2 M13 11h3 M8 15h2 M13 15h3'
};
function init(){
 const ids={workspaceNav:'workspace',guideBtn:'guide',exportBtn:'export',resetBtn:'reset',mmiScenarioBtn:'scenario',mmiEquipBtn:'equipment',mmiCdrsBtn:'cdrs',mmiLedgerBtn:'ledger'};
 for(const [id,key]of Object.entries(ids)){
  const b=document.getElementById(id);if(!b)continue;
  const label=b.textContent.replace(/^[\s▦▤↓↻]+/,'').replace(/01$/,'').trim();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[key]);svg.append(path);
  const span=document.createElement('span');span.textContent=label;b.replaceChildren(svg,span);b.classList.add('icon-button');
 }
 document.documentElement.classList.add('orpheia-ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

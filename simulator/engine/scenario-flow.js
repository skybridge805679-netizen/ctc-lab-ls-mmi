(function(root){'use strict';
// Spoken instructions are timed scenario events. Operator controls remain actual controls.
function duration(step){return Math.max(3,Math.min(18,Math.ceil((step.lines?.join(' ')||step.text||'').length/14)));}
function advance(run,clock){
 run.speechDue??={};run.completedAt??={};run.flowStartedAt??=clock;let ready=run.flowStartedAt,changed=false;
 for(let i=0;i<run.sc.steps.length;i++){
  if(run.done[i]){ready=Math.max(ready,run.completedAt[i]??ready);continue;}
  const step=run.sc.steps[i];if(step.kind!=='say')break;
  run.speechDue[i]??=ready+duration(step);
  if(clock<run.speechDue[i])break;
  run.done[i]=true;run.completedAt[i]=run.speechDue[i];ready=run.speechDue[i];changed=true;
 }
 return changed;
}
const api={advance,duration};if(typeof module!=='undefined')module.exports=api;else root.SimScenarioFlow=api;
})(typeof globalThis!=='undefined'?globalThis:this);

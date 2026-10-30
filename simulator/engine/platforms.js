(function(root){'use strict';
// User-confirmed LS legend, 2026-10-30. Colour does not establish served track faces or a millimetre height.
const heights={high:{label:'고상홈',colour:'황색',css:'orange'},low:{label:'저상홈',colour:'청색',css:'cyan'}};
const trainHeights={unknown:'미확인',high:'고상홈 대응',low:'저상홈 대응',both:'고상·저상홈 대응'};
function describe(kind){const height={o:'high',c:'low',platform:'high','platform-cyan':'low',high:'high',low:'low'}[kind];return height?{height,...heights[height]}:null;}
function assess(height,boardingHeight='unknown',operation='stop'){
 if(!['stop','pass','shunt'].includes(operation))throw Error('Invalid platform operation');
 if(operation!=='stop')return {status:'not-applicable',message:'승하차를 하지 않는 통과·입환은 홈 높이 비교 대상이 아닙니다. 진로·쇄정 조건은 별도로 적용됩니다.'};
 if(!heights[height]||!trainHeights[boardingHeight]||boardingHeight==='unknown')return {status:'unknown',message:'차량의 대응 홈 높이가 미확인입니다. 열차 종별만으로 승하차 적합성을 확정하지 않습니다.'};
 return boardingHeight==='both'||boardingHeight===height?{status:'compatible',message:'기록된 대응 홈 높이와 일치합니다. 유효장·정차 위치·선로 조건도 확인하세요.'}:{status:'mismatch',message:'홈 높이가 맞지 않습니다. 승하차 정차에 적합한 홈과 차량 승강설비를 확인하세요. 통과·입환 금지를 뜻하지는 않습니다.'};
}
const api={heights,trainHeights,describe,assess};if(typeof module!=='undefined')module.exports=api;else root.SimPlatforms=api;
})(typeof globalThis!=='undefined'?globalThis:this);

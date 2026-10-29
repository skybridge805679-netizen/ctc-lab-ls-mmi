(function(root){'use strict';
// Source A/B identities are reviewed data. Screen distance never chooses a control target.
const survey=typeof module!=='undefined'?require('./point-survey'):root.SimPointSurvey;
const empty={parts:{},labels:[]};
const api={forStation:id=>survey[id]||empty};
if(typeof module!=='undefined')module.exports=api;else root.SimPointParts=api;
})(typeof globalThis!=='undefined'?globalThis:this);

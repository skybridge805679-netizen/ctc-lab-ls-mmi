(function(root){'use strict';
function fit(width,height){const scale=Math.min(1,width/1280,height/720);return {scale,width:width/scale,height:height/scale};}
if(typeof module!=='undefined')module.exports={fit};else root.SimViewport={fit};
})(typeof window!=='undefined'?window:globalThis);

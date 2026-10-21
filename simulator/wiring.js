/* Hand-traced connections from 1.전체노선.pdf, pages 2–4.
 * Coordinates below refer to documented inspection windows (not display crops).
 * This is a geometric training model, not an imported interlocking route table.
 * rail: [id, polyline, targetX, leftBoundary, rightBoundary, branchPointIds]
 * link: [pointId, fromRail, fromX, toRail, toX]
 * signal: [id, rail, x, lampY, direction]; lamp is the coloured end of the symbol.
 */
(function(root){
'use strict';
const line=(id,y,left,right,target,l,r)=>[id,[[left,y],[right,y]],target,l,r];
const data={
'cheongnyangni':{size:[1462,731],cells:[['1T',1104,'Y1T']],rails:[line('1T',379,145,1190,750,'AT','B002T'),line('2T',481,145,1190,750,'A1T','B001T'),['MT',[[295,430],[548,430],[565,379]],340,'MT',null,['22']]],links:[['21','MT',465,'2T',485],['51','1T',919,'2T',961],['52','2T',919,'1T',961]],signals:[['1A','1T',290,360,1],['2A','2T',1095,501,-1],['3A','2T',603,501,-1],['4A','1T',847,360,1],['4B','2T',847,461,1],['21','MT',395,413,1],['22','2T',603,517,-1],['23','1T',603,396,-1],['51','1T',1034,396,-1],['52','1T',847,346,1]]},
'dongmyo':{size:[1547,731],rails:[line('1T',379,230,820,620,'B014T','B016T'),line('2T',481,230,820,620,'B015T','B017T'),['CT',[[383,328],[545,328]],400,'CT',null],['DT',[[383,532],[545,532]],400,'DT',null]],links:[['21','2T',389,'1T',421],['22','CT',505,'1T',521],['23','DT',505,'2T',521]],signals:[['1A','CT',451,310,1],['1B','1T',298,359,1],['2A','2T',733,499,-1],['3A','2T',549,499,-1],['4A','1T',699,359,1],['21','2T',295,465,1],['22','DT',445,516,1],['23','2T',550,512,-1],['24','1T',550,395,-1]]},
'jonggak':{size:[1477,731],cells:[['1T',828,'BT']],rails:[line('1T',379,326,982,545,'B044T','B046T'),line('2T',481,326,982,545,'B043T','B045T')],links:[['51','2T',690,'1T',730],['52','1T',690,'2T',730]],signals:[['1A','1T',414,360,1],['2A','2T',921,499,-1],['3A','2T',446,499,-1],['4A','1T',638,360,1],['51','2T',923,514,-1],['52','1T',820,395,-1],['53','1T',638,346,1],['54','2T',638,464,1]]},
'underground-seoul':{size:[1316,731],rails:[line('1T',379,313,1280,740,'B070T','B072T'),line('2T',481,313,1280,740,'B065T','B067T'),['MT',[[912,481],[928,429],[1148,429]],1110,null,'MT',['52']]],links:[['21','1T',549,'2T',588],['22','2T',549,'1T',588],['51','MT',980,'1T',964]],signals:[['1A','1T',405,360,1],['2A','2T',1165,499,-1],['3A','2T',625,499,-1],['4A','1T',847,360,1],['21','2T',400,464,1],['22','2T',627,514,-1],['23','1T',627,395,-1],['51','MT',1077,445,-1],['52','1T',847,346,1],['53','2T',847,464,1]]},
'seoul':{size:[1603,1069],cells:[['1T',689,'BT']],rails:[line('1T',344,35,815,355,'B074T','B902T'),line('2T',395,85,815,355,'B069T','B901T'),['3T',[[112,498],[460,498],[494,395]],180,null,null,['56']],['4T',[[112,550],[661,550],[661,654],[1100,654]],180,null,'B602T'],['5T',[[112,601],[553,601],[584,705]],180,null,null,['57']],['6T',[[112,653],[375,653],[390,705]],180,null,null,['60']],line('7T',705,112,1100,180,null,'B601T')],links:[['55','2T',555,'1T',575],['54','4T',565,'2T',619],['58','4T',368,'3T',405],['59','3T',368,'4T',405],['52','4T',750,'7T',785],['53','7T',750,'4T',785],['51','7T',925,'4T',940]],signals:[['1A','1T',218,325,1],['2B','2T',737,413,-1],['2A','7T',998,722,-1],['3A','2T',283,413,-1],['4A','1T',450,325,1],['4B','3T',290,480,1],['4C','4T',290,531,1],['4D','5T',290,583,1],['4E','6T',290,634,1],['4F','7T',290,686,1],['51','7T',998,739,-1],['52','4T',1000,670,-1],['53','1T',631,361,-1],['54','2T',444,381,1],['55','3T',290,464,1],['56','4T',290,517,1],['57','5T',290,568,1],['58','6T',290,619,1],['59','7T',290,671,1]]},
'yongsan':{size:[2048,1024],rails:[line('1T',477,136,995,700,'B914T','B916T'),line('2T',527,67,1090,700,'B915T','B917T'),line('3T',577,155,1210,700,'B608T','B610T'),['4T',[[155,626],[970,626],[991,577]],700,'B605T',null,['52']],line('YT',626,1021,1210,null,null,'B607T'),['5T',[[590,626],[605,676],[930,676],[948,626]],700,null,null,['28','53']],['6T',[[443,725],[880,725],[897,676]],700,'CT',null,['54']],['7T',[[367,626],[404,774],[983,774],[1021,626]],700,null,null,['22','51']]],links:[['21','4T',299,'3T',319],['23','3T',421,'2T',441],['24','3T',465,'4T',485],['25','6T',537,'7T',557],['26','4T',547,'6T',587],['27','2T',540,'1T',558],['51','3T',1038,'YT',1058],['55','7T',824,'6T',844]],signals:[['1A','1T',220,459,1],['1B','3T',249,559,1],['2A','YT',1165,645,-1],['2B','2T',985,544,-1],['3A','7T',631,791,-1],['3B','6T',631,741,-1],['3C','5T',631,694,-1],['3D','4T',631,644,-1],['3E','2T',631,549,-1],['4A','1T',788,459,1],['4B','3T',788,560,1],['4C','4T',788,611,1],['4D','5T',788,660,1],['4E','6T',788,709,1],['4F','7T',788,759,1],['21','4T',263,611,1],['22','6T',491,711,1],['23','7T',631,805,-1],['24','6T',631,754,-1],['25','5T',631,707,-1],['26','4T',631,657,-1],['27','1T',631,492,-1],['51','3T',1101,593,-1],['52','3T',784,545,1],['53','4T',784,598,1],['54','5T',784,646,1],['55','6T',784,694,1],['56','7T',784,743,1]]},
'noryangjin':{size:[1519,956],rails:[line('1T',388,82,800,504,'B926T','B928T'),line('2T',439,82,800,504,'B927T','B929T'),line('3T',490,82,800,504,'B612T','B614T'),line('4T',541,82,800,504,'B613T','B615T1T')],links:[['21','1T',370,'2T',386],['51','2T',655,'1T',672],['52','4T',655,'3T',672]],signals:[['1A','1T',230,369,1],['1B','3T',253,470,1],['2A','4T',733,559,-1],['2B','2T',733,457,-1],['3A','4T',427,559,-1],['3B','2T',427,456,-1],['4A','1T',613,369,1],['4B','3T',613,471,1],['21','1T',332,371,1],['22','2T',427,471,-1],['51','3T',695,507,-1],['52','1T',695,405,-1],['53','1T',610,354,1],['54','2T',610,421,1],['55','4T',610,523,1]]},
'yeongdeungpo':{size:[2048,928],rails:[line('2T',346,170,1275,770,'B620T','B622T'),line('3T',395,170,1275,770,'B619T2T','B621T'),line('6T',692,170,1275,770,'B940T','B942T'),line('7T',742,170,1275,770,'B941T','B943T'),['1T',[[635,346],[652,295],[899,295],[915,346]],770,null,null,['25','57']],['4T',[[616,395],[645,494],[953,494],[986,395]],770,null,null,['26','55']],['5T',[[392,692],[422,593],[984,593],[1016,692]],770,null,null,['22','54']]],links:[['21','7T',306,'6T',324],['23','3T',422,'2T',440],['24','5T',458,'3T',530],['51','6T',1045,'7T',1065],['52','2T',1035,'3T',1072],['53','3T',1035,'2T',1072],['56','4T',907,'5T',941]],signals:[['1A','2T',328,327,1],['1B','6T',233,674,1],['2A','7T',1143,758,-1],['2B','3T',1152,413,-1],['3A','7T',682,758,-1],['3B','4T',682,513,-1],['3C','3T',682,414,-1],['4A','1T',867,279,1],['4B','2T',867,327,1],['4C','4T',867,476,1],['4D','5T',867,575,1],['4E','6T',867,675,1],['21','3T',322,379,1],['22','6T',228,660,1],['23','7T',228,725,1],['24','4T',682,526,-1],['25','3T',682,428,-1],['26','2T',682,363,-1],['27','1T',682,311,-1],['51','7T',1089,759,-1],['52','2T',1110,361,-1],['53','1T',864,263,1],['54','3T',864,379,1],['55','4T',864,461,1],['56','5T',864,561,1]]},
'guro':{size:[1744,956],rails:[line('1T',369,155,1090,553,'B628T','B630T'),line('2T',421,155,1090,553,'B627T','B629T'),['3T',[[30,729],[714,729],[732,677],[774,677],[774,318],[1090,318]],553,'B948T','B950T',['55']],line('4T',778,30,1009,553,'B949T','F2T'),['5T',[[175,829],[832,829],[832,471],[1090,471]],553,'AT','B951T'],line('F1T',729,733,1009,970,null,'F1T')],links:[['21','5T',235,'4T',255],['22','4T',280,'3T',298],['23','4T',306,'5T',326],['24','3T',388,'4T',408],['51','2T',904,'5T',886],['52','1T',806,'2T',826],['53','4T',759,'F1T',800],['54','F1T',759,'4T',800]],signals:[['1A','1T',346,353,1],['1B','3T',193,709,1],['2A','5T',1004,488,-1],['2B','2T',1004,437,-1],['3A','5T',447,851,-1],['3B','4T',447,800,-1],['3C','3T',447,747,-1],['3D','2T',447,438,-1],['4A','3T',665,709,1],['4B','1T',665,353,1],['21','4T',187,762,1],['22','5T',212,814,1],['23','5T',447,866,-1],['51','4T',910,795,-1],['52','F1T',910,745,-1],['53','2T',940,438,-1],['54','3T',665,695,1],['55','4T',665,761,1],['56','1T',665,338,1]]},
'geumcheon':{size:[1766,956],rails:[line('2T',319,14,1180,605,'B966T','B968T'),line('3T',370,14,1180,605,'B642T','B644T'),line('4T',421,14,1180,605,'B639T','B641T'),line('5T',473,14,1000,605,'B963T','B965T'),['1T',[[391,319],[406,268],[798,268],[813,319]],605,null,null,['27','54']],['6T',[[355,524],[725,524],[744,473]],605,'26BT',null,['56']]],links:[['21','4T',175,'5T',216],['22','5T',175,'4T',216],['23','4T',251,'3T',270],['24','3T',320,'2T',338],['25','3T',410,'4T',430],['26','5T',394,'6T',413],['51','2T',965,'3T',985],['52','3T',1006,'2T',1026],['53','4T',824,'3T',843],['55','5T',777,'4T',797],['57','2T',728,'3T',747]],signals:[['1A','2T',126,300,1],['1B','3T',126,352,1],['2A','5T',940,492,-1],['2B','4T',1063,439,-1],['3A','6T',504,543,-1],['3B','5T',504,491,-1],['3C','4T',504,439,-1],['3D','1T',504,286,-1],['4A','1T',704,251,1],['4B','2T',704,302,1],['4C','3T',704,353,1],['21','5T',122,489,1],['22','6T',504,557,-1],['23','5T',504,506,-1],['24','1T',504,300,-1],['51','2T',1066,336,-1],['52','2T',849,336,-1],['53','1T',701,235,1],['54','2T',701,286,1],['55','4T',701,405,1],['56','6T',701,508,1]]},
'anyang':{size:[1308,788],rails:[line('2T',426,155,1163,648,'B982T','B984T'),line('3T',478,155,1163,648,'B658T','B660T'),line('4T',530,155,1163,648,'B655T','B657T'),line('5T',581,155,1163,648,'B981T','B983T'),['1T',[[506,426],[522,375],[804,375],[818,426]],648,null,null,['25','55']],['6T',[[384,633],[804,633],[820,581]],648,'CT',null,['54']]],links:[['21','4T',355,'3T',375],['22','4T',441,'5T',460],['23','3T',441,'2T',460],['24','5T',493,'6T',513],['51','4T',944,'3T',964],['52','5T',852,'4T',872],['53','3T',852,'2T',872]],signals:[['1A','2T',262,406,1],['1B','3T',262,458,1],['2A','5T',1070,599,-1],['2B','4T',1070,548,-1],['3A','6T',572,650,-1],['3B','5T',572,600,-1],['3C','4T',572,549,-1],['4A','1T',744,357,1],['4B','2T',744,407,1],['4C','3T',744,459,1],['21','4T',327,514,1],['22','6T',473,614,1],['23','6T',572,665,-1],['24','1T',572,392,-1],['51','3T',990,494,-1],['52','2T',990,443,-1],['53','1T',741,341,1],['54','2T',741,392,1],['55','6T',741,615,1]]},
'geumjeong':{size:[1063,788],rails:[line('2T',426,150,1008,608,'B994T','B996T'),line('3T',581,150,1008,608,'B993T','B995T'),['1T',[[250,375],[824,375],[840,426]],608,'CT',null,['51']],['4T',[[392,581],[408,632],[824,632],[840,581]],608,null,null,['22','52']]],links:[['21','2T',364,'1T',384]],signals:[['1A','2T',224,407,1],['2A','3T',909,599,-1],['3A','4T',520,650,-1],['3B','3T',520,599,-1],['4A','1T',724,356,1],['4B','2T',724,407,1],['21','1T',328,358,1],['22','1T',520,392,-1],['51','1T',724,340,1]]},
'gunpo':{size:[1322,872],rails:[line('1T',391,40,1130,540,'B1000T','B1002T'),line('2T',443,40,1130,540,'B678T','B680T'),line('3T',495,40,1130,540,'B673T','B675T'),line('4T',546,40,1130,540,'B999T','B1001T')],links:[['21','3T',247,'4T',268],['22','2T',247,'1T',268],['51','3T',894,'2T',914],['52','4T',786,'3T',806],['53','1T',786,'2T',806]],signals:[['1A','1T',167,374,1],['1B','2T',167,425,1],['2A','4T',1013,565,-1],['2B','3T',1013,513,-1],['3A','4T',449,565,-1],['3B','3T',449,513,-1],['4A','1T',650,374,1],['4B','2T',650,425,1],['51','2T',968,459,-1],['52','1T',647,359,1],['53','2T',647,410,1],['54','3T',647,479,1],['55','4T',647,530,1]]},
'uiwang':{size:[2025,872],rails:[line('1T',339,201,1195,716,'GT','FT'),line('2T',391,70,1320,716,'B1012T','B1014T'),line('3T',443,70,1320,716,'B690T','B692T'),line('4T',494,70,1320,716,'B685T','B687T'),line('5T',546,70,1320,716,'B1011T','B1013T'),line('6T',597,190,1010,716,'ET','55BT')],links:[['21','5T',264,'4T',284],['22','4T',337,'5T',358],['23','5T',418,'6T',438],['24','4T',418,'3T',438],['25','3T',477,'2T',497],['26','2T',558,'1T',578],['27','6T',525,'5T',546],['51','4T',1154,'3T',1174],['52','3T',1154,'2T',1174],['53','1T',1013,'2T',1033],['54','5T',1008,'4T',1028],['55','6T',944,'5T',964]],signals:[['1A','2T',246,374,1],['1B','3T',246,427,1],['1C','1T',230,320,1],['2A','5T',1191,565,-1],['2B','4T',1178,513,-1],['3A','6T',625,614,-1],['3B','5T',625,565,-1],['3C','4T',625,514,-1],['3D','2T',625,410,-1],['3E','1T',625,357,-1],['4A','1T',828,320,1],['4B','2T',828,374,1],['4C','3T',828,426,1],['21','5T',240,533,1],['22','6T',625,630,-1],['23','5T',625,580,-1],['24','2T',625,426,-1],['25','1T',625,372,-1],['51','2T',1198,407,-1],['52','1T',1110,356,-1],['53','1T',825,304,1],['54','2T',825,357,1],['55','6T',825,583,1]]},
'suwon':{size:[1406,872],rails:[line('3T',391,38,1307,1220,'B1036T',null),line('4T',443,38,1307,1220,'B714T',null),['BT',[[38,494],[1008,494],[1028,443]],null,'B709T',null,['30']],line('5T',546,38,1307,1220,'B1035T',null),['1T',[[804,391],[835,288],[1307,288]],1220,null,null,['27']],['2T',[[1008,391],[1028,340],[1307,340]],1220,null,null,['29']],['6T',[[1018,546],[1033,598],[1307,598]],1220,null,null,['31']],['7T',[[1080,598],[1097,649],[1307,649]],1220,null,null,['33']]],links:[['21','5T',321,'BT',342],['22','3T',350,'4T',370],['23','BT',471,'4T',491],['24','4T',585,'BT',604],['25','4T',689,'3T',709],['26','BT',837,'5T',857],['28','4T',899,'3T',919],['32','1T',1068,'2T',1088]],signals:[['1A','3T',168,372,1],['1B','4T',168,422,1],['3A','7T',1130,666,-1],['3B','6T',1130,615,-1],['3C','5T',1130,563,-1],['3D','4T',1130,458,-1],['3E','3T',1130,408,-1],['3F','2T',1130,357,-1],['3G','1T',1130,306,-1],['21','3T',224,373,1],['22','5T',261,527,1],['23','7T',1130,682,-1],['24','6T',1130,630,-1],['25','5T',1130,579,-1],['26','4T',1130,474,-1],['27','3T',1130,423,-1],['28','2T',1130,373,-1],['29','1T',1130,322,-1]]}
};
function compile(st,def){
 const [ox,oy,w,h]=st.map.referenceWindow,[iw,ih]=def.size;
 const pagePoint=([x,y])=>[+(ox+x*w/iw).toFixed(3),+(oy+y*h/ih).toFixed(3)];
 const rails=new Map(def.rails.map(r=>[r[0],r]));
 const at=(rail,x)=>{const p=rails.get(rail)[1];for(let i=1;i<p.length;i++)if(x>=p[i-1][0]&&x<=p[i][0]&&p[i][0]!==p[i-1][0])return[x,p[i-1][1]+(p[i][1]-p[i-1][1])*(x-p[i-1][0])/(p[i][0]-p[i-1][0])];throw Error(st.id+' off rail '+rail+' '+x);};
 const features=new Map([...rails.keys()].map(id=>[id,[]]));
 const add=(rail,p)=>features.get(rail).push(p);
 for(const [id,p,tx]of def.rails){p.forEach(q=>add(id,q));if(tx!==null)add(id,at(id,tx));}
 for(const [,rail,x]of def.signals)add(rail,at(rail,x));
 for(const [rail,x]of (def.cells||[]).map(c=>[c[0],c[1]]))add(rail,at(rail,x));
 for(const [,a,x,b,z]of def.links){add(a,at(a,x));add(b,at(b,z));}
 const on=(p,a,b)=>{const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);return Math.abs(cross)<0.01&&p[0]>=Math.min(a[0],b[0])-0.01&&p[0]<=Math.max(a[0],b[0])+0.01&&p[1]>=Math.min(a[1],b[1])-0.01&&p[1]<=Math.max(a[1],b[1])+0.01;};
 // Only explicit rail ends merge. Crossing lines do not acquire a phantom junction.
 const joins=[];
 for(const [id,p,,,,branch=[]]of def.rails){let n=0;for(const end of [p[0],p.at(-1)])for(const [other,q]of def.rails)if(id!==other&&q.slice(1).some((v,i)=>on(end,q[i],v))){add(other,end);joins.push([id,other,end,branch[Math.min(n++,branch.length-1)]]);}}
 const nodes=new Map(),edges=[],railNodes=new Map(),key=(rail,p)=>rail+':'+p.map(v=>v.toFixed(3)).join(',');
 for(const [rail,poly]of def.rails){const list=[];for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i],pts=features.get(rail).filter(p=>on(p,a,b));pts.sort((p,q)=>Math.hypot(p[0]-a[0],p[1]-a[1])-Math.hypot(q[0]-a[0],q[1]-a[1]));
  for(const p of pts){const k=key(rail,p);if(list.at(-1)!==k){if(!nodes.has(k))nodes.set(k,{p,rail,adj:[],points:new Set(),targets:[],pass:[]});list.push(k);}}
 }
 railNodes.set(rail,list);for(let i=1;i<list.length;i++)edge(list[i-1],list[i],rail);
 }
 function edge(a,b,rail,point=null){const id=edges.length,e={id,a,b,rail,point};edges.push(e);nodes.get(a).adj.push(e);nodes.get(b).adj.push(e);if(point){nodes.get(a).points.add(point);nodes.get(b).points.add(point);}return e;}
 for(const [a,b,p,point]of joins)edge(key(a,p),key(b,p),'join',point);
 for(const [point,a,x,b,z]of def.links)edge(key(a,at(a,x)),key(b,at(b,z)),'link',point);
 for(const [rail,x,name]of def.cells||[])nodes.get(key(rail,at(rail,x))).pass.push(name);
 for(const [id,p,tx,left,right]of def.rails){if(tx!==null)nodes.get(key(id,at(id,tx))).targets.push(id);if(left)nodes.get(key(id,p[0])).targets.push(left);if(right)nodes.get(key(id,p.at(-1))).targets.push(right);}
 const signals={},points={},routes={},paths={},mapSignals={},mapPoints={};
 for(const [id,rail,x,y,dir]of def.signals){const [px,py]=pagePoint([x,y]);signals[id]={kind:/^\d+[A-Z]$/.test(id)?(id[0]==='1'||id[0]==='2'?'장내':'출발'):'입환',direction:dir===1?'하행':'상행',dir,x:px,y:py};mapSignals[id]={x:px,y:py,dir};}
 for(const [k,node]of nodes)for(const id of node.points){if(!points[id]){const [x,y]=pagePoint(node.p);points[id]={parts:[id],x,y};mapPoints[id]={x,y};}}
 for(const [signal,rail,x,,dir]of def.signals){const start=key(rail,at(rail,x)),found=new Map();
  function walk(k,trail,seen){if(trail.length>90)return;const n=nodes.get(k);
   if(trail.length&&n.pass.length){const physical=trail.filter(e=>e.rail!=='join');if(physical.length)for(const name of n.pass){const previous=found.get(name);if(!previous||physical.length<previous.trail.filter(e=>e.rail!=='join').length)found.set(name,{trail:[...trail],end:k});}}
   if(trail.length&&n.targets.length){for(const target of n.targets){const physical=trail.filter(e=>e.rail!=='join');if(!physical.length)continue;const previous=found.get(target);if(!previous||physical.length<previous.trail.filter(e=>e.rail!=='join').length)found.set(target,{trail:[...trail],end:k});}return;}
   for(const e of n.adj){const next=e.a===k?e.b:e.a,p=nodes.get(next).p;if(seen.has(next)||(p[0]-n.p[0])*dir<-0.001)continue;const nextSeen=new Set(seen);nextSeen.add(next);walk(next,[...trail,e],nextSeen);}
  }
  walk(start,[],new Set([start]));
  for(const [target,{trail}]of found){const id=signal+'-'+target,coords=[pagePoint(nodes.get(start).p)],locks=new Set(),trackNames=[],resources=[];let current=start;
   for(const e of trail){resources.push(st.id+':edge:'+e.id);for(const p of nodes.get(current).points)locks.add(p);current=e.a===current?e.b:e.a;for(const p of nodes.get(current).points)locks.add(p);const point=pagePoint(nodes.get(current).p);if(String(point)!==String(coords.at(-1)))coords.push(point);if(e.rail!=='join'&&e.rail!=='link'&&!trackNames.includes(e.rail))trackNames.push(e.rail);}
   const path=coords.map((p,i)=>(i?'L':'M')+p.join(' ')).join('');
   routes[id]={signal,destination:target,pathTracks:[signal,target],geometryRails:trackNames,path,resources,pointLocks:[...locks],pointPositions:Object.fromEntries([...locks].map(id=>[id,trail.some(e=>e.point===id||rails.get(e.rail)?.[5]?.includes(id))?'R':'N'])),source:[st.sources.display],evidence:'PDF 배선 연결을 추적한 연습 경로 · 실설비 진로표 대조 전',switchConditions:null,releaseSeconds:null,geometryDerived:true};paths[id]=path;
  }
 }
 return{signals,points,routes,map:{...st.map,signals:mapSignals,points:mapPoints,paths,labels:{}},traced:{rails:def.rails.length,signals:def.signals.length,points:Object.keys(points).length,routes:Object.keys(routes).length}};
}
function apply(network){
 for(const [id,def]of Object.entries(data)){const st=network.catalog[id];Object.assign(st,compile(st,def));}
 // Preserve documented route evidence and original track names for the training tasks.
 const st=network.catalog['underground-seoul'];
 const known={'1A-1T':['XT','21AT','1T'],'2A-2T':['YT','52T','2T'],'3A-B070T':['21BT','21AT','XT','B070T'],'3A-B065T':['21BT','X1T','B065T'],'4A-B072T':['51BT','Y1T','B072T']};
 for(const [id,tracks]of Object.entries(known)){if(!st.routes[id])throw Error('Missing documented route '+id);Object.assign(st.routes[id],{pathTracks:tracks,geometryDerived:false,evidence:'배선도·기존 교재/MMI 진로목록 대조',source:[st.sources.display,'CTC 운영 매뉴얼 · 진로제어 p.4–8 / 실무5 p.362·374']});}
 // Explicit examples in the supplied textbook appendix; its own wording calls
 // these basic paths read from the wiring, not the complete equipment route table.
 const examples={
  cheongnyangni:[361,375,'4A-B002T 4B-B002T 2A-1T 2A-2T'],
  dongmyo:[361,375,'1A-1T 1B-1T 4A-B016T 2A-2T 3A-B015T 3A-DT'],
  jonggak:[362,375,'1A-1T 4A-B046T 2A-2T 3A-B043T'],
  seoul:[363,374,'1A-1T 4A-B902T 2B-2T 3A-B069T'],
  yongsan:[363,377,'1A-1T 4A-B916T 1B-3T 4B-B610T 2B-2T 3E-B915T 2A-4T 2A-5T 2A-6T 2A-7T 3A-B605T'],
  noryangjin:[364,377,'1A-1T 4A-B928T 1B-3T 4B-B614T 2B-2T 3B-B927T 2A-4T 3A-B613T'],
  yeongdeungpo:[364,376,'1B-6T 1B-5T 4E-B942T 1A-2T 4B-B622T 2A-7T 3A-B941T 2B-3T 2B-4T 3C-B619T2T'],
  guro:[365,376,'1B-3T 4A-B950T 1A-1T 4B-B630T 2A-5T 3A-B949T 2B-2T 3D-B627T'],
  geumcheon:[365,376,'1A-1T 1A-2T 4A-B968T 4B-B968T 1B-3T 4C-B644T 2A-5T 2A-6T 3B-B963T 3A-B963T 2B-4T 3C-B639T'],
  anyang:[366,376,'1A-1T 1A-2T 4A-B984T 4B-B984T 1B-3T 4C-B660T 2A-5T 2A-6T 3B-B981T 3A-B981T 2B-4T 3C-B655T'],
  geumjeong:[366,371,'1A-1T 1A-2T 4A-B996T 4B-B996T 2A-3T 2A-4T 3B-B993T 3A-B993T'],
  gunpo:[366,376,'1A-1T 4A-B1002T 1B-2T 4B-B680T 2A-4T 3A-B999T 2B-3T 3B-B673T'],
  uiwang:[367,376,'1A-2T 4B-B1014T 1B-3T 4C-B692T 2A-5T 3B-B1011T 2B-4T 3C-B685T'],
  suwon:[367,376,'1A-1T 1A-2T 1A-3T 1B-4T 3A-B1035T 3B-B1035T 3C-B1035T 3D-B709T']
 };
 for(const [station,[from,to,ids]]of Object.entries(examples))for(const id of ids.split(' ')){
  const route=network.catalog[station].routes[id];if(!route)throw Error('Textbook path missing: '+station+' '+id);
  Object.assign(route,{geometryDerived:false,evidence:'실무5 부록 A 기본 경로 예시·PDF 배선 대조',source:[network.catalog[station].sources.display,`실무5 부록 A · 본문 p.${from}–${to} / PDF ${from+8}–${to+8}쪽`]});
 }
 for(const [station,ids,source]of [
  ['dongmyo',['24-B015T'],'02.열차충돌시, 동묘앞역 상선 · 추출문 254–255행'],
  ['jonggak',['51-1T'],'02.열차충돌시, 동묘앞역 상선 · 추출문 254–255행'],
  ['jonggak',['53-B045T'],'01.선로침수시, 시청역 하선 · 추출문 190–191행'],
  ['underground-seoul',['21-1T'],'01.선로침수시, 시청역 하선 · 추출문 190–191행']
 ])for(const id of ids)Object.assign(network.catalog[station].routes[id],{geometryDerived:false,evidence:'비상시조치 대본의 진로명·PDF 배선 대조',source:[network.catalog[station].sources.display,source]});
 const copies={noryangjin:{page:2,dx:943,dy:120,headerDy:-41},yeongdeungpo:{page:2,dx:958,dy:120,headerDy:-41},guro:{page:3,dx:-768,dy:-156,headerDx:-2,headerDy:-2},geumcheon:{page:3,dx:-765,dy:-157,headerDx:-2,headerDy:0}};
 for(const [id,copy]of Object.entries(copies))network.catalog[id].map.copies=[copy];
 return network;
}
const api={data,compile,apply};if(typeof module!=='undefined')module.exports=api;else root.SimWiring=api;
})(typeof window!=='undefined'?window:globalThis);

"""Register the Uiwang–Suwon monitor to original PPT slide 18, preserving unequal circuit widths."""
from pathlib import Path
import json,hashlib
from PIL import Image
import numpy as np
from scipy.ndimage import label,find_objects
ROOT=Path(__file__).resolve().parents[1]
ref=ROOT/'references/transcriptions/corridor-layout.json'
if not ref.exists():
 source=json.loads((ROOT/'references/transcriptions/block-signals.json').read_text())
 image=ROOT/'simulator/assets/stations/slide18.png';im=Image.open(image).convert('RGB');a=np.array(im)
 cells=[{'code':r['code'],'box':r['sourceCell']} for r in source['indicators'] if r['slide']==18]
 assert len(cells)==39 and len({c['code'] for c in cells})==39
 plates=[];labs,n=label(a.max(2)<55)
 for sl in find_objects(labs):
  yy,xx=sl;x,y,w,h=xx.start,yy.start,xx.stop-xx.start,yy.stop-yy.start
  if y<200 and 120<=w<=300 and 25<=h<=80:plates.append([x,y,w,h])
 plates.sort();assert len(plates)==2,plates
 platforms=[];labs,n=label((a[:,:,0]>200)&(a[:,:,1]>120)&(a[:,:,1]<225)&(a[:,:,2]<85))
 for sl in find_objects(labs):
  yy,xx=sl;x,y,w,h=xx.start,yy.start,xx.stop-xx.start,yy.stop-yy.start
  if w<50 or h<8:continue
  candidates=[c for c in cells if c['box'][0]<=x+w/2<=c['box'][0]+c['box'][2]]
  cell=min(candidates,key=lambda c:abs(y+h/2-c['box'][1]-c['box'][3]/2));platforms.append({'box':[x,y,w,h],'code':cell['code'],'offset':y+h/2-cell['box'][1]-cell['box'][3]/2})
 assert len(platforms)==4,platforms
 out={'source':source['source'],'slide':18,'image':str(image.relative_to(ROOT)),'sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'size':list(im.size),'cells':cells,'plates':[{'name':name,'box':box} for name,box in zip(['성균관대','화서'],plates)],'platforms':platforms,'handoffToSuwon':['B1036T','B714T','B709T','B1035T']}
 ref.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
data=json.loads(ref.read_text());assert hashlib.sha256((ROOT/data['image']).read_bytes()).hexdigest()==data['sha256']
(ROOT/'simulator/ui/ls-corridor-source.js').write_text("(function(root){'use strict';\n// Generated from original PPT slide 18 by tools/build-corridor-layout.py.\nconst data="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";\nif(typeof module!=='undefined')module.exports=data;else root.SimLSCorridorSource=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n")
print('Registered',len(data['cells']),'source circuits;',data['plates'],'platforms',data['platforms'])

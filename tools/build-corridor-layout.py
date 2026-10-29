"""Register the interstation monitor views (no CCM) to their original PPT slides, preserving unequal circuit widths.

Slide 13 = 안양~금정 (명학), slide 16 = 군포~의왕 (당정), slide 18 = 의왕~수원 (성균관대·화서).
"""
from pathlib import Path
import json,hashlib
from PIL import Image
import numpy as np
from scipy.ndimage import label,find_objects
ROOT=Path(__file__).resolve().parents[1]
SLIDES={13:{'plates':['명학'],'platforms':2,'handoff':['B992T','B670T','B665T','B991T']},
        16:{'plates':['당정'],'platforms':2,'handoff':['B1012T','B690T','B685T','B1011T']},
        18:{'plates':['성균관대','화서'],'platforms':4,'handoff':['B1036T','B714T','B709T','B1035T']}}
source=json.loads((ROOT/'references/transcriptions/block-signals.json').read_text())
out={}
for slide,spec in SLIDES.items():
 ref=ROOT/f'references/transcriptions/corridor-layout-{slide}.json'
 if not ref.exists():
  image=ROOT/f'simulator/assets/stations/slide{slide}.png';im=Image.open(image).convert('RGB');a=np.array(im)
  cells=[];seen=set()
  for r in source['indicators']:
   if r['slide']==slide and r['code'] not in seen:seen.add(r['code']);cells.append({'code':r['code'],'box':r['sourceCell']})
  plates=[];labs,n=label(a.max(2)<55)
  for sl in find_objects(labs):
   yy,xx=sl;x,y,w,h=xx.start,yy.start,xx.stop-xx.start,yy.stop-yy.start
   if y<200 and 120<=w<=300 and 25<=h<=80:plates.append([x,y,w,h])
  plates.sort();assert len(plates)==len(spec['plates']),(slide,plates)
  platforms=[];labs,n=label((a[:,:,0]>200)&(a[:,:,1]>120)&(a[:,:,1]<225)&(a[:,:,2]<85))
  for sl in find_objects(labs):
   yy,xx=sl;x,y,w,h=xx.start,yy.start,xx.stop-xx.start,yy.stop-yy.start
   if w<50 or h<8:continue
   candidates=[c for c in cells if c['box'][0]<=x+w/2<=c['box'][0]+c['box'][2]]
   cell=min(candidates,key=lambda c:abs(y+h/2-c['box'][1]-c['box'][3]/2));platforms.append({'box':[x,y,w,h],'code':cell['code'],'offset':y+h/2-cell['box'][1]-cell['box'][3]/2})
  assert len(platforms)==spec['platforms'],(slide,platforms)
  data={'source':source['source'],'slide':slide,'image':str(image.relative_to(ROOT)),'sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'size':list(im.size),'cells':cells,'plates':[{'name':name,'box':box} for name,box in zip(spec['plates'],plates)],'platforms':platforms,'handoff':spec['handoff']}
  ref.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 data=json.loads(ref.read_text());assert hashlib.sha256((ROOT/data['image']).read_bytes()).hexdigest()==data['sha256']
 out[str(slide)]=data
 print('slide',slide,len(data['cells']),'circuits;',[p['name'] for p in data['plates']],'platforms',len(data['platforms']))
(ROOT/'simulator/ui/ls-corridor-source.js').write_text("(function(root){'use strict';\n// Generated from original PPT slides 13, 16 and 18 by tools/build-corridor-layout.py.\nconst data="+json.dumps(out,ensure_ascii=False,separators=(',',':'))+";\nif(typeof module!=='undefined')module.exports=data;else root.SimLSCorridorSource=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n")

"""Inventory detached and on-rail white train-number windows from the original PPT media.
Requires Pillow/numpy/scipy/tesseract. OCR is recorded for review; runtime uses only vectors.
"""
from pathlib import Path
from PIL import Image,ImageOps
from scipy.ndimage import label,find_objects,minimum_filter,maximum_filter,minimum_filter1d,maximum_filter1d
import numpy as np, subprocess, json, tempfile, concurrent.futures, difflib, os, sys
ROOT=Path(__file__).resolve().parents[1]
known=json.loads(subprocess.check_output(['node','-e',"const N=require('./simulator/engine/network'),L=require('./simulator/ui/ls-view');console.log(JSON.stringify(N.stations.filter(s=>s.controlled).map(s=>({id:s.id,slide:s.slide,codes:[...new Set(L.sceneOf(s).cells.map(c=>c[3].replaceAll(' · ',''))).values()]}))))"],cwd=ROOT,text=True))
slides={s['slide']:s['id'] for s in known};slides.update({13:'anyang',16:'gunpo',18:'uiwang'})
allcodes=set(c for s in known for c in s['codes'] if c)
jobs=[]
for slide,sid in slides.items():
 im=Image.open(ROOT/f'simulator/assets/stations/slide{slide}.png').convert('RGB');a=np.array(im).min(2)>225;labs,n=label(a);rects=[]
 for sl in find_objects(labs):
  ys,xs=sl;x,y,w,h=xs.start,ys.start,xs.stop-xs.start,ys.stop-ys.start
  if y<im.height*.18 or y>im.height*.82:continue
  rects.append((x,y,w,h,float(a[sl].mean())))
 # Fill small glyph holes, then isolate broad 23px-high white rectangles, including on-rail windows.
 b=minimum_filter1d(maximum_filter1d(a,6,axis=1),6,axis=1)
 b=maximum_filter(minimum_filter(b,size=(23,65)),size=(23,65));wl,wn=label(b);windows=[]
 for sl in find_objects(wl):
  ys,xs=sl;x,y,w,h=xs.start,ys.start,xs.stop-xs.start,ys.stop-ys.start
  if 65<w<160 and 20<h<40 and 3.2<w/h<5.5 and im.height*.18<y<im.height*.82:windows.append((x,y,w,h))
 rails=[r[:4] for r in rects if r[2]>35 and 8<=r[3]<=20 and r[4]>.70]
 for i,(x,y,w,h) in enumerate(sorted(windows,key=lambda r:(r[1],r[0]))):
  cx,cy=x+w/2,y+h/2
  coreX={2:[806],3:[783],4:[658],5:[1032],6:[328,74],7:[984],8:[603],9:[895],10:[610,556],11:[605,598,611,618,568,569],12:[1092],14:[894],15:[888],17:[923],19:[1712]}.get(slide,[])
  inline=any(abs(x-v)<5 for v in coreX)
  if inline:rail=(x+w+2,y,100,h)
  else:
   candidates=[r for r in rails if r[0]-4<=cx<=r[0]+r[2]+4] or rails
   rail=min(candidates,key=lambda r:abs(cy-r[1]-r[3]/2)+max(0,r[0]-cx,cx-r[0]-r[2])*2)
  jobs.append((slide,sid,i,[x,y,w,h],rail,im,inline))
def read(job):
 slide,sid,i,box,rail,im,inline=job;x,y,w,h=rail
 cut=ImageOps.expand(im.crop((x,y,x+w,y+h)),15,'white');cut=cut.resize((cut.width*4,cut.height*4))
 with tempfile.TemporaryDirectory() as d:
  p=Path(d)/'ocr.png';cut.save(p);raw=subprocess.run(['tesseract',str(p),'stdout','--psm','7','-c','tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'],capture_output=True,text=True,env={**os.environ,'OMP_THREAD_LIMIT':'1'}).stdout.strip().replace(' ','')
 text=raw
 if raw.startswith('B'):text='B'+raw[1:].translate(str.maketrans('OISGUY','015609'))
 if text not in allcodes and not __import__('re').fullmatch(r'B\d{3,4}T(?:[12]T)?',text):
  candidates=difflib.get_close_matches(text,[c for st in known if st['id']==sid for c in st['codes'] if c.startswith('B')==text.startswith('B')],n=1,cutoff=.5);text=candidates[0] if candidates else raw
 return dict(station=sid,slide=slide,sourceWindow=box,sourceCell=list(rail),candidate=raw,code=text,side='inline' if inline else ('above' if box[1]+box[3]/2<y+h/2 else 'below'),fraction=.5 if inline else round((box[0]+box[2]/2-x)/w,4))
if '--compile-only' in sys.argv:records=json.loads((ROOT/'references/transcriptions/train-windows.json').read_text())['windows']
else:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(read,jobs))
# Track window numbers are explicitly ordered in the source, including the rectangles crossing the rails.
for sid in slides.values():
 core=sorted([r for r in records if r['station']==sid and r['side']=='inline'],key=lambda r:r['sourceWindow'][1])
 for i,r in enumerate(core):r.update(code=str(i+1)+'T',fraction=.5)
review=json.loads((ROOT/'references/transcriptions/train-window-review.json').read_text())['overrides']
seen={};data={s:[] for s in dict.fromkeys(r['station'] for r in records)}
for r in records:
 key=f"{r['slide']}:{r['sourceWindow'][0]},{r['sourceWindow'][1]}";r.update(review.get(key,{}));r['reviewed']=True
 identity=(r['station'],r['code']);seen[identity]=seen.get(identity,0)+1;r['slot']=r['code']+('@'+str(seen[identity]) if seen[identity]>1 else '')
 data[r['station']].append({k:r[k] for k in ['slot','code','side','fraction','slide','sourceWindow']+(['anchorCode'] if 'anchorCode' in r else [])})
out={'source':'references/diagrams/배선도(관제교육장).pptx','notes':'Includes detached and on-rail train-number windows. Original coordinates/OCR and reviewed code/row corrections are retained. anchorCode maps source-edition boundary labels to current PDF geometry. Runtime uses SVG.','windows':records}
(ROOT/'references/transcriptions/train-windows.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'simulator/engine/train-windows.js').write_text("(function(root){'use strict';\n// Reviewed PPT train-number windows; source coordinates in references/transcriptions/train-windows.json.\nconst data="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";\nconst api={data};if(typeof module!=='undefined')module.exports=api;else root.SimTrainWindows=api;\n})(typeof window!=='undefined'?window:globalThis);\n")
for r in records:print(r['station'],r['slide'],r['sourceWindow'],r['candidate'],'=>',r['code'],r['side'],r['fraction'])
print('Extracted',len(records))

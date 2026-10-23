"""One-time source inventory extraction. Runtime draws editable SVG objects, never raster images.
Requires Pillow, numpy, scipy and tesseract. OCR candidates must be reviewed before use.
"""
from pathlib import Path
from PIL import Image,ImageOps
from scipy.ndimage import binary_closing,binary_opening,label,find_objects
import numpy as np,subprocess,concurrent.futures,json,re,tempfile
ROOT=Path(__file__).resolve().parents[1]
regions={2:[(0,90,2048,115),(0,380,1900,235)],3:[(0,120,2048,120),(0,275,500,65),(0,485,1590,155)],4:[(0,290,2048,215)]}
def inside(page,x,y):return any(a<=x<=a+w and b<=y<=b+h for a,b,w,h in regions[page])
def read_word(item):
 page,record,crop=item
 with tempfile.TemporaryDirectory() as d:
  f=Path(d)/'crop.png';ImageOps.expand(crop,12,'white').resize(((crop.width+24)*3,(crop.height+24)*3)).save(f)
  p=subprocess.run(['tesseract',str(f),'stdout','--psm','7','-c','tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'],capture_output=True,text=True)
 word=p.stdout.strip().replace(' ','')
 if re.fullmatch(r'B[0-9OISG]+T',word):word='B'+word[1:-1].translate(str.maketrans('OISG','0156'))+'T'
 record['candidate']=word
 record['label']=word if re.fullmatch(r'(?:B\d{3,4}|\d{1,2}[AB]?|[A-Z]\d?|\d[A-Z])T',word) else ''
 return page,record
pages={};jobs=[]
for page in [2,3,4]:
 im=Image.open(ROOT/f'simulator/assets/line-map/page-{page}.jpg').convert('RGB');a=np.array(im);scale=im.width/2048
 white=a.min(2)>215
 mask=binary_opening(binary_closing(white,structure=np.ones((14,1))),structure=np.ones((1,35)))
 labs,n=label(mask);records=[]
 for sl in find_objects(labs):
  ys,xs=sl;y1,y2=ys.start,ys.stop;x1,x2=xs.start,xs.stop
  x,y,w,h=[round(v/scale,3) for v in [x1,y1,x2-x1,y2-y1]]
  if not inside(page,x+w/2,y+h/2) or h<3 or h>14:continue
  record=dict(id=f'p{page}-section-{len(records)+1}',x=x,y=y,width=w,height=h)
  records.append(record);jobs.append((page,record,im.crop((x1,y1,x2,y2))))
 platforms=[]
 for color,m in [('platform',(a[:,:,0]>180)&(a[:,:,1]>100)&(a[:,:,1]<210)&(a[:,:,2]<70)),('platform-cyan',(a[:,:,0]<80)&(a[:,:,1]>170)&(a[:,:,2]>170))]:
  labs,n=label(m)
  for sl in find_objects(labs):
   ys,xs=sl;x,y,w,h=[round(v/scale,3) for v in [xs.start,ys.start,xs.stop-xs.start,ys.stop-ys.start]]
   if w>10 and h>2 and inside(page,x+w/2,y+h/2):platforms.append(dict(x=x,y=y,width=w,height=h,kind=color))
 pages[page]=dict(sections=records,platforms=platforms)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for _ in pool.map(read_word,jobs):pass
out={'source':'1.전체노선.pdf, pages 2–4','coordinateSystem':[2048,768],'pages':pages}
(ROOT/'simulator/engine/schematic-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print({p:(len(d['sections']),sum(bool(r['label']) for r in d['sections']),len(d['platforms'])) for p,d in pages.items()})

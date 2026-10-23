"""Map reviewed PDF bracket glyphs and yard captions into the native wiring coordinates."""
import json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'references/transcriptions/fixed-symbols.json').read_text())
info=json.loads(subprocess.check_output(['node','-e',"const N=require('./simulator/engine/network'),W=require('./simulator/engine/wiring').data;console.log(JSON.stringify(Object.fromEntries(N.stations.filter(s=>s.controlled).map(s=>[s.id,{page:s.map.page,ref:s.map.referenceWindow,size:W[s.id].size}]))))"],cwd=ROOT))
out={}
for sid,entry in source['stations'].items():
 st=info[sid];ox,oy,rw,rh=st['ref'];iw,ih=st['size']
 assert entry['page']==st['page']
 def local(x,y):return [round((x-ox)*iw/rw,3),round((y-oy)*ih/rh,3)]
 out[sid]={'brackets':[],'captions':[]}
 for b in entry.get('brackets',[]):
  x,y,w,h=b['bounds'];out[sid]['brackets'].append({'id':b['id'],'bounds':[*local(x,y),round(w*iw/rw,3),round(h*ih/rh,3)]})
 for c in entry.get('captions',[]):out[sid]['captions'].append({'id':c['id'],'at':local(*c['at']),'lines':c['lines']})
js="(function(root){'use strict';\n// Generated from references/transcriptions/fixed-symbols.json by tools/build-fixed-symbols.py.\nconst data="+json.dumps(out,ensure_ascii=False,separators=(',',':'))+";\nif(typeof module!=='undefined')module.exports=data;else root.SimFixedSymbols=data;\n})(typeof window!=='undefined'?window:globalThis);\n"
(ROOT/'simulator/ui/fixed-symbols.js').write_text(js)
print('Built',sum(len(s['brackets']) for s in out.values()),'bracket pairs and',sum(len(s['captions']) for s in out.values()),'captions')

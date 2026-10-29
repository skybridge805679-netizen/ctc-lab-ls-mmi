"""Compile the reviewed explicit source A/B map, without nearest-label inference."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
survey=json.loads((ROOT/'references/transcriptions/switch-survey.json').read_text())
sha=lambda path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
assert sha(survey['source'])==survey['sha256']
data={}
for station,s in survey['stations'].items():
 assert sha(s['image'])==s['sha256']
 assert len(s['groups'])==len(set(s['groups']))
 for part,group in s['parts'].items():
  assert group in s['groups']
  mate=part[:-1]+('B' if part[-1]=='A' else 'A')
  assert s['parts'].get(mate)==group
 assert len(s['labels'])==len(s['parts']) and len({l['part'] for l in s['labels']})==len(s['parts'])
 for label in s['labels']:assert s['parts'][label['part']]==label['group']
 data[station]={'parts':s['parts'],'labels':s['labels']}
(ROOT/'simulator/engine/point-survey.js').write_text("(function(root){'use strict';\n// Generated from reviewed PPT switch survey by tools/build-switch-survey.py.\nconst data="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+";\nif(typeof module!=='undefined')module.exports=data;else root.SimPointSurvey=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n")
print('Compiled',sum(len(s['groups']) for s in survey['stations'].values()),'source switch groups and',sum(len(s['parts']) for s in survey['stations'].values()),'A/B controls')

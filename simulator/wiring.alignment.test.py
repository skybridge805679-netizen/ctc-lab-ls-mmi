"""Check every traced route against the unchanged source JPEG rail pixels.
Requires Pillow. This detects displaced geometry; it does not certify interlocking.
"""
import json, math, re, subprocess
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent
stations = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require('./network.js').stations.filter(s=>s.controlled)))"], cwd=ROOT))
images = {p:Image.open(ROOT/f'assets/line-map/page-{p}.jpg').convert('RGB') for p in (2,3,4)}
checked = 0
for st in stations:
    worst = (2, '')
    for copy in [{'page':st['map']['page'],'dx':0,'dy':0}, *st['map'].get('copies',[])]:
        im = images[copy['page']]
        for route, data in st['routes'].items():
            points = [list(map(float,p.split())) for p in re.split('[ML]',data['path'])[1:]]
            hits = total = 0
            for a,b in zip(points,points[1:]):
                n = max(1,round(math.dist(a,b)))
                for i in range(n):
                    x,y = [round((a[j]+(b[j]-a[j])*i/n+[copy['dx'],copy['dy']][j])*2.8125) for j in (0,1)]
                    patch = im.crop((x-5,y-5,x+6,y+6))
                    # A small tolerance permits JPEG edges, text and track separators.
                    hits += any(min(rgb)>190 for rgb in (list(patch.get_flattened_data()) if hasattr(patch,'get_flattened_data') else list(patch.getdata())))
                    total += 1
            score = hits/total
            assert score >= .90, (st['id'],copy['page'],route,score)
            worst = min(worst,(score,route));checked += 1
    print(f"PASS {st['name']}: worst rail pixel alignment {worst[0]:.1%} ({worst[1]})")
print(f'PASS {checked} route depictions on original PDF images (including repeated station depictions)')

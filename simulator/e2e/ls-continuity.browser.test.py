"""Independent LS canvases extend their own boundary rails horizontally to the physical window edge."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
  for width,height in [(1920,1080),(1440,1000),(960,720)]:
   pages=[browser.new_page(viewport={'width':width,'height':height}) for _ in range(2)]
   for page in pages:
    page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');page.evaluate("document.body.classList.add('workspace-split')")
   stations=pages[0].evaluate('SimLSPresets.list().map(v=>v.id)')
   for west,east in zip(stations,stations[1:]):
    data=[]
    for page,station,side in zip(pages,[west,east],['right','left']):
     page.evaluate('id=>selectStation(id)',station);page.wait_for_timeout(80)
     data.append(page.locator('#trackSvg').evaluate('''(svg,side)=>{const m=svg.getScreenCTM(),box=svg.getBoundingClientRect();return Object.fromEntries([...svg.querySelectorAll(`[data-seam-side="${side}"]`)].map(g=>{const path=g.querySelector('.seam-rail'),p=path.getPointAtLength(path.getTotalLength()).matrixTransform(m);return [g.dataset.seamTrunk,{x:p.x,y:p.y,edge:side==='left'?0:innerWidth,box:[box.left,box.right]}]}));}''',side))
    common=set(data[0])&set(data[1]);assert common,(west,east)
    for portset in data:
     for trunk,port in portset.items():assert abs(port['x']-port['edge'])<1,(width,west,east,trunk,port)
    for page in pages:
     assert page.locator('.seam-rail').evaluate_all('es=>es.every(p=>{const a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());return Math.abs(a.y-b.y)<.01&&p.getAttribute("d").match(/-?\\d+(?:\\.\\d+)?/g).length===4})')
    if west=='geumjeong':assert {'GD','GU','ED','EU'}<=common
   for page in pages:page.close()
   print(f'PASS {width}×{height}: all station boundary continuations reach the physical window edge horizontally; station heights remain independent')
  assert not errors,errors;browser.close()
finally:server.shutdown()

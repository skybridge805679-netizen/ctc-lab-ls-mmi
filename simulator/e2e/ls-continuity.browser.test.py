"""Adjacent LS canvases meet at the same physical pixel by line identity, including through tracks."""
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
   stations=pages[0].locator('#lsStationSelect option').evaluate_all('es=>es.map(e=>e.value)')
   for west,east in zip(stations,stations[1:]):
    data=[]
    for page,station,side in zip(pages,[west,east],['right','left']):
     page.select_option('#lsStationSelect',station);page.wait_for_timeout(80)
     data.append(page.locator('#trackSvg').evaluate('''(svg,side)=>{const m=svg.getScreenCTM(),box=svg.getBoundingClientRect();return Object.fromEntries([...svg.querySelectorAll(`[data-seam-side="${side}"]`)].map(g=>{const path=g.querySelector('.seam-rail'),p=path.getPointAtLength(path.getTotalLength()).matrixTransform(m);return [g.dataset.seamTrunk,{x:p.x,y:p.y,edge:side==='left'?0:innerWidth,box:[box.left,box.right]}]}));}''',side))
    common=set(data[0])&set(data[1]);assert common,(west,east)
    for trunk in common:
     a,b=data[0][trunk],data[1][trunk];assert abs(a['y']-b['y'])<.5,(width,west,east,trunk,a,b)
     for port in [a,b]:assert abs(port['x']-port['edge'])<1,(width,west,east,trunk,port)
    if west=='geumjeong':assert {'GD','GU','ED','EU'}<=common
   for page in pages:page.close()
   print(f'PASS {width}×{height}: all 14 adjacent station interfaces align by trunk at the physical window edge')
  assert not errors,errors;browser.close()
finally:server.shutdown()

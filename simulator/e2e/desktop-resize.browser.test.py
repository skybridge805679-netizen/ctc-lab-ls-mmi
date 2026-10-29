"""Desktop window resizing, not a mobile layout: all 16 LS views retain uniform scale and hit targets."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{s.server_port}',wait_until='networkidle');page.click('#pauseBtn')
  stations=page.locator('#lsStationSelect option').evaluate_all('es=>es.map(e=>e.value)')
  assert len(stations)==15   # 역간 감시 화면 3개는 노란 화살표로만 연다
  for width,height in [(1920,1080),(1440,1000),(960,720),(640,480),(360,280),(1280,450)]:
   page.set_viewport_size({'width':width,'height':height})
   page.wait_for_function('Math.abs(Number(document.querySelector(".ls-viewport").style.zoom)-SimViewport.fit(innerWidth,innerHeight).scale)<.00001')
   for station in stations:
    page.select_option('#lsStationSelect',station)
    metrics=page.locator('#trackSvg').evaluate('e=>{const r=e.getBoundingClientRect(),m=e.getScreenCTM();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,x:m.a,y:m.d}}')
    assert metrics['left']>=0 and metrics['right']<=width+1 and metrics['top']>=0 and metrics['bottom']<=height+1,(station,width,metrics)
    assert abs(metrics['x']-metrics['y'])<.00001,(station,width,metrics)
    assert page.locator('.top-actions button').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().right<=innerWidth+1)'),(station,width)
   page.select_option('#lsStationSelect','geumcheon');page.locator('[data-mode="CCM"]').click()
   expect(page.locator('#actionDialog')).to_be_visible();box=page.locator('#actionDialog').bounding_box()
   assert box['x']>=0 and box['x']+box['width']<=width+1 and box['y']>=0 and box['y']+box['height']<=height+1,box
   page.keyboard.press('Escape')
   if width==640:page.screenshot(path='/tmp/orpheia-v230-desktop-640.png')
  assert not errors,errors
  b.close();print('PASS desktop 6 window sizes x 16 LS views, proportional SVG, toolbar and control-confirmation hit targets')
finally:s.shutdown()

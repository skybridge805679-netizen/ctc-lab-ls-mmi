"""Native scene regression: no raster LS, retained source objects and shared route state."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1000});requests=[];errors=[]
   page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   stations=page.locator('#stationSelect option').evaluate_all('(os)=>os.map(o=>o.value)')
   for station in stations:
    page.select_option('#lsStationSelect',station)
    expect(page.locator('#lsStage image, #lsStage img, #lsStage canvas')).to_have_count(0)
    assert page.locator('[data-track-section]').count()>0
    assert page.locator('[data-circuit-label]').count()>0
    expect(page.locator('[data-equipment]')).to_have_count(11)
    if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/f'docs/preview-v0.18.0-{station}.png'))
   page.select_option('#lsStationSelect','underground-seoul')
   page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
   page.locator('[data-signal="1A"]').click();page.locator('[data-route-choice="1A-1T"]').click()
   assert page.locator('[data-track-state="set"]').count()>0
   page.locator('[data-sim-enter="1A-1T"]').click()
   assert page.locator('[data-track-state="occupied"]').count()>0
   page.locator('[data-sim-clear="1A-1T"]').click()
   expect(page.locator('[data-track-state="occupied"]')).to_have_count(0)
   allowed={'/assets/orpheia/'+name+'.png' for name in ['guide','emblem','banner']}
   assert not [u for u in requests if any(ext in urlparse(u).path.lower() for ext in ['.jpg','.jpeg','.png','.webp']) and urlparse(u).path not in allowed],requests
   assert page.locator('#lsStage').evaluate("el=>[el,...el.querySelectorAll('*')].every(e=>!getComputedStyle(e).backgroundImage.includes('url('))")
   assert not errors,errors
   page.close();print(f'PASS {width}px: 15 native scenes, no raster LS, equipment identifiers and track-state linkage')
  browser.close()
finally:server.shutdown();server.server_close()

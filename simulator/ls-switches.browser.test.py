"""The photographed Seoul crossover changes shape and holds its physical position while locked."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=b.new_page(viewport={'width':width,'height':1000});page.goto(f'http://127.0.0.1:{server.server_port}')
   page.add_style_tag(content='#toast{display:none!important}');page.click('#pauseBtn');page.select_option('#stationSelect','seoul')
   connector=page.locator('[data-switch-connection="58"]')
   normal=connector.get_attribute('d');expect(connector).to_have_attribute('data-position','N')
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.17.1-seoul-switch-normal.png'),style='#toast{visibility:hidden}')
   page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
   page.locator('[data-signal="4C"]').click();page.locator('[data-route-choice="4C-B902T"]').click()
   expect(connector).to_have_attribute('data-position','R');expect(connector).to_have_attribute('data-locked','true')
   reverse=connector.get_attribute('d');assert reverse!=normal
   expect(page.locator('[data-switch-gap="58"]')).to_have_count(2)
   expect(page.locator('[data-active-route="4C-B902T"]')).to_have_attribute('data-route-state','set')
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.17.1-seoul-switch-route.png'),style='#toast{visibility:hidden}')
   page.locator('[data-approach-toggle="4C"]').click();page.locator('[data-signal="4C"]').click();page.click('#dialogConfirm')
   expect(page.locator('[data-active-route="4C-B902T"]')).to_have_attribute('data-route-state','locked')
   expect(connector).to_have_attribute('d',reverse)
   page.select_option('#controlSelect','point');page.select_option('#mmiPoint','58');page.locator('input[name="pointPosition"][value="N"]').check();page.click('#mmiApply')
   expect(connector).to_have_attribute('data-position','R')
   for _ in range(3):page.click('#skipBtn')
   expect(connector).to_have_attribute('data-position','R');expect(connector).to_have_attribute('data-locked','false')
   page.click('#mmiApply');expect(connector).to_have_attribute('data-position','N');expect(connector).to_have_attribute('d',normal)
   page.close();print(f'PASS {width}px: 4C-B902T changes the 58 crossover geometry, keeps it while locked and permits N after release')
  b.close()
finally:server.shutdown();server.server_close()

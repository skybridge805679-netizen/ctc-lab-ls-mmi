"""Regression for crossing the final motion frame at 60x and shared Overview occupancy."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
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
   page=browser.new_page(viewport={'width':width,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install();page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   page.select_option('#stationSelect','yongsan')
   run=lambda a:page.evaluate('a=>SimMMI.run(a)',a)
   for a in [{'type':'mode','value':'CCM'},{'type':'route','id':'2A-5T'},{'type':'occupy','id':'2A-5T','seconds':20}]:assert run(a)['ok']
   path=page.locator('[data-train-run="2A-5T"]');start=path.get_attribute('d')
   page.select_option('#graphSpeed','10',force=True);page.clock.run_for(1000)
   assert path.get_attribute('d')!=start
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.3-train-run.png'),style='#toast{visibility:hidden}')
   page.select_option('#graphSpeed','60',force=True);page.clock.run_for(1000)
   end=path.get_attribute('d');assert end!=start,'last frame must redraw even when the clock jumps past completion'
   page.clock.run_for(1000);assert path.get_attribute('d')==end,'completed train stays at the end until clear'
   assert run({'type':'clear','id':'2A-5T'})['ok'];expect(path).to_have_count(0)
   assert run({'type':'lsOperation','operation':{'op':'insert','station':'yongsan','slot':'5T','number':'K1004','direction':'up'},'source':'LS'})['ok']
   expect(page.locator('[data-train-occupied="5T"]')).to_have_count(1)
   assert page.locator('[data-train-slot="5T"] rect').evaluate('e=>getComputedStyle(e).fill')!='rgb(255, 92, 80)'
   # The overview is a snapshot, but it must use the same train windows as the active station.
   page.locator('#trackSvg').click(button='right',position={'x':20,'y':20})
   page.get_by_role('menuitem',name='L/S Overview',exact=False).hover()
   page.get_by_role('menuitem',name='전체 관제구간',exact=True).click()
   expect(page.locator('#lsOverview [data-overview-station="yongsan"] [data-train-occupied="5T"]')).to_have_count(1)
   page.click('#lsOverviewClose')
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.3-occupancy.png'),style='#toast{visibility:hidden}')
   assert not errors,errors;page.close();print(f'PASS {width}px: 60x final frame, clear, white train window and shared Overview occupancy')
  browser.close()
finally:server.shutdown();server.server_close()

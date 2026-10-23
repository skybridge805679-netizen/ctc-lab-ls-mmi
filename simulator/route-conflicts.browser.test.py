"""Shared normal locking through LS menus at every station, desktop only."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   candidates=json.loads((ROOT.parent/'docs/route-conflict-audit-v0.19.4.json').read_text())['newlyAllowed']
   menus=page.evaluate('SimRouteMenus');plans={}
   for pair in candidates:
    st=pair['station']
    def offered(route):
     sig,dest=route.split('-');return any(c.isalpha() for c in sig) and (st not in menus or sig not in menus[st] or dest in menus[st][sig])
    if st not in plans and all(offered(r) for r in pair['routes']):plans[st]=pair
   for pair in candidates:
    if pair['station'] not in plans:plans[pair['station']]=pair
   plans['anyang']={'station':'anyang','routes':['4C-B660T','4A-B984T'],'points':{'53':'N'}}
   assert len(plans)==15,plans.keys()
   for st,plan in plans.items():
    for order in [plan['routes'],list(reversed(plan['routes']))]:
     page.reload(wait_until='networkidle');page.click('#pauseBtn');page.select_option('#stationSelect',st)
     page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
     for route in order:
      page.locator(f'[data-signal="{route.split("-")[0]}"]').click();page.locator(f'[data-route-choice="{route}"]').click()
     expect(page.locator('[data-active-route]')).to_have_count(2)
     assert page.evaluate('([st,ids])=>ids.every(id=>SimField.state(st).signals[id.split("-")[0]]==="GO")',[st,order])
     if width==1440 and st=='anyang' and order[0]=='4C-B660T':page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.2-parallel.png'),style='#toast{visibility:hidden}')
     run=lambda a:page.evaluate('a=>SimMMI.run(a)',a)
     for route in order:assert run({'type':'occupy','id':route,'source':'LS'})['ok']
     assert run({'type':'clear','id':order[0],'source':'LS'})['ok']
     expect(page.locator(f'[data-active-route="{order[1]}"]')).to_have_count(1)
     for point in plan['points']:assert not run({'type':'point','id':point,'value':'R','source':'LS'})['ok']
     assert run({'type':'clear','id':order[1],'source':'LS'})['ok']
     expect(page.locator('[data-active-route]')).to_have_count(0)
     assert not errors,errors
    print(f'PASS {width}px {st}: both LS menu orders, independent occupancy/release, shared switch protection',flush=True)
   page.close()
  browser.close()
finally:server.shutdown();server.server_close()

"""Regression for individual LS navigation and intermediate-station visibility."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,390]:
   page=b.new_page(viewport={'width':width,'height':1000});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}')
   stations=page.locator('#lsStationSelect option').evaluate_all('(os)=>os.map(o=>o.value)')
   for station in stations:
    page.locator(f'#stationTabs [data-station="{station}"]').click()
    expect(page.locator('#mapSheet')).to_have_value('station')
    expect(page.locator('[data-control-station]')).to_have_count(1)
    expect(page.locator('[data-control-station]')).to_have_attribute('data-control-station',station)
    bounds=page.evaluate('(id)=>SimNetwork.catalog[id].map.view.bounds.join(" ")',station)
    expect(page.locator('#trackSvg')).to_have_attribute('viewBox',bounds)
   page.select_option('#lsStationSelect','cheongnyangni')
   expect(page.locator('#previousStation')).to_be_disabled()
   page.click('#nextStation');expect(page.locator('#stationSelect')).to_have_value('dongmyo')
   page.click('#previousStation');expect(page.locator('#stationSelect')).to_have_value('cheongnyangni')
   page.click('#mapOverview');expect(page.locator('#mapSheet')).to_have_value('1')
   page.locator('[data-map-station="guro"]').press('Enter')
   expect(page.locator('#mapSheet')).to_have_value('station')
   expect(page.locator('#lsStationSelect')).to_have_value('guro')
   page.select_option('#mapSheet','all')
   page.locator('[data-control-station="dongmyo"] [data-select-control]').click()
   expect(page.locator('#mapSheet')).to_have_value('station')
   expect(page.locator('#lsStationSelect')).to_have_value('dongmyo')
   for station in ['cheongnyangni','dongmyo','seoul','guro']:
    page.select_option('#lsStationSelect',station)
    if width==1440:page.locator('.ls-panel').screenshot(path=str(ROOT.parent/f'docs/preview-v0.6.1-{station}.png'))
   assert not errors,errors
   page.close();print(f'PASS {width}px: 15 tabs, LS/MMI synchronization, arrows, overview and PDF station headers')
  b.close()
finally:server.shutdown();server.server_close()

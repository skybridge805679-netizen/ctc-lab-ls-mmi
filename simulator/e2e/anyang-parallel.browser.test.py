"""The user's real-LS observation: Anyang 4C-B660T and 4A-B984T coexist."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   for order in [['4C-B660T','4A-B984T'],['4A-B984T','4C-B660T']]:
    page=browser.new_page(viewport={'width':width,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn');page.select_option('#stationSelect','anyang')
    page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
    for route in order:
     signal=route.split('-')[0];page.locator(f'[data-signal="{signal}"]').click();page.locator(f'[data-route-choice="{route}"]').click()
    expect(page.locator('[data-active-route]')).to_have_count(2)
    assert page.evaluate('SimField.state("anyang").signals["4A"]==="GO"&&SimField.state("anyang").signals["4C"]==="GO"')
    expect(page.locator('.mmi-alarm:not([hidden])')).to_have_count(0)
    if width==1440 and order[0]=='4C-B660T':page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.1-anyang-parallel.png'),style='#toast{visibility:hidden}')
    for route in order:assert page.evaluate('id=>SimMMI.run({type:"occupy",id,source:"LS"})',route)['ok']
    assert page.evaluate('id=>SimMMI.run({type:"clear",id,source:"LS"})',order[0])['ok']
    expect(page.locator(f'[data-active-route="{order[1]}"]')).to_have_count(1)
    assert page.evaluate('SimField.state("anyang").points["53"]')=='N'
    assert not errors,errors;page.close()
   print(f'PASS {width}px: both LS command orders, two progressing signals, independent occupancy and passage')
  browser.close()
finally:server.shutdown();server.server_close()

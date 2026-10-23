"""A separate corridor view shares Uiwang train slots and control state, without an extra control station."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn')
  assert page.locator('#stationSelect option').count()==15
  assert page.locator('#lsStationSelect option').count()==16
  page.select_option('#lsStationSelect','uiwang');expect(page.locator('#lsStage')).not_to_contain_text('성균관대');main_signals=page.locator('[data-signal]').count();assert main_signals>0
  page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm');page.click('#nextStation')
  expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon');expect(page.locator('#stationSelect')).to_have_value('uiwang');expect(page.locator('#lsStage')).to_contain_text('성균관대');expect(page.locator('#lsStage')).to_contain_text('화서');assert page.locator('#lsStage [data-mode],#lsStage [data-stop-all],#lsStage [data-equipment]').count()==0
  assert page.locator('#lsStage').get_attribute('data-control-station')==''
  expect(page.locator('#resetBtn')).to_be_hidden();expect(page.locator('#drawerBtn')).to_be_hidden()
  assert page.locator('[data-point-control]').count()==0
  page.locator('[data-train-slot="B1022T"]').dblclick();expect(page.locator('#actionDialog')).not_to_be_visible()
  page.locator('[data-train-slot="B1022T"]').click(button='right');assert page.locator('[data-context-action="train-input"],[data-context-action="train-move"],[data-context-action="scan-current"]').count()==0;page.keyboard.press('Escape')
  page.evaluate("SimLSUI.dispatchDirect({op:'insert',station:'uiwang',slot:'B1022T',number:'K252',direction:'down'});render()");expect(page.locator('#trackSvg')).to_contain_text('K252')
  assert page.locator('[data-train-occupied="B1022T"]').count()==1
  page.locator('[data-train-slot="B1022T"]').click(button='right');expect(page.locator('[data-context-action="monitor-properties"]')).to_be_visible();assert page.locator('[data-context-action="train-rename"],[data-context-action="train-delete"]').count()==0;page.keyboard.press('Escape')
  assert page.evaluate("SimLSUI.getModel().stations.uiwang.windows.B1022T[0].number")=='K252'
  page.click('#previousStation');expect(page.locator('#lsStationSelect')).to_have_value('uiwang');assert page.locator('[data-signal]').count()==main_signals
  page.click('#nextStation');expect(page.locator('#trackSvg')).to_contain_text('K252');page.click('#nextStation');expect(page.locator('#lsStationSelect')).to_have_value('suwon');page.click('#previousStation');expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon')
  # Re-applying preferred screens must keep the new preset and current selection.
  page.evaluate('SimPreferred.apply()');expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon')
  for width,height in [(1440,1000),(960,720)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200);expect(page.locator('#trackSvg')).to_contain_text('K252');expect(page.locator('#trackSvg')).to_contain_text('화서')
   assert page.locator('[data-train-slot="B1022T"]').is_visible()
  assert not errors,errors;browser.close();print('PASS 16 LS views / 15 control stations, Uiwang–Suwon navigation, passive monitor controls and shared live train state, preferred screens and corridor resizing')
finally:server.shutdown()

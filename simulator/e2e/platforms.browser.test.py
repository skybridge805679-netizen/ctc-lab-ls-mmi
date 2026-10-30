"""Typed high/low platforms, boarding-purpose comparison and persisted MMI vehicle capability (desktop)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');page.select_option('#lsStationSelect','seoul');expect(page.locator('.platform-legend')).to_contain_text('고상홈');expect(page.locator('.platform-legend')).to_contain_text('저상홈')
  page.evaluate("SimMMI.open('schedule')");page.select_option('#scheduleList','K1131');page.click('#scheduleLoad');expect(page.locator('#scheduleBoardingHeight')).to_have_value('unknown');page.select_option('#scheduleBoardingHeight','low');page.select_option('#scheduleKind','일반열차');page.click('#scheduleApply');page.click('#mmiAlertOk');assert page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='K1131').boardingHeight")=='low';page.evaluate("SimMMI.close('schedule')")
  high=page.locator('#trackSvg [data-platform-height=high]').first;high.click();expect(page.locator('#actionDialog')).to_contain_text('고상홈');page.select_option('#platformTrain','K1131');expect(page.locator('#platformResult')).to_have_attribute('data-status','mismatch');assert page.evaluate("Object.keys(SimField.state('seoul').routes).length")==0
  page.screenshot(path=str(ROOT.parent/'docs/preview-v0.27.2-platform-check.png'))
  page.select_option('#platformOperation','pass');expect(page.locator('#platformResult')).to_have_attribute('data-status','not-applicable');page.click('#dialogConfirm')
  low=page.locator('#trackSvg [data-platform-height=low]').first;low.focus();page.keyboard.press('Enter');expect(page.locator('#actionDialog')).to_contain_text('저상홈');page.select_option('#platformTrain','K1131');expect(page.locator('#platformResult')).to_have_attribute('data-status','compatible');page.select_option('#platformTrain','K1133');expect(page.locator('#platformResult')).to_have_attribute('data-status','unknown');page.click('#dialogConfirm')
  # Monitoring corridors still allow read-only platform inspection without CCM or a command.
  page.evaluate("selectStation('uiwang-suwon')");page.locator('#trackSvg [data-platform-height=high]').first.click();expect(page.locator('#actionDialog')).to_contain_text('고상홈');page.click('#dialogConfirm')
  assert not errors,errors
  print('PASS platform colours/heights, MMI edit persistence, mismatch/compatible/unknown/pass, keyboard and corridor inspection without route mutation')
  b.close()
finally:server.shutdown()

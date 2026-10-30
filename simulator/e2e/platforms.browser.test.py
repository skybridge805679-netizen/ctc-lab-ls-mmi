"""High (yellow) / low (cyan) platforms as static LS symbols; boarding height follows the train class (desktop)."""
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
  # 승강장은 LS의 정적 표시다: 클릭해도 대화상자를 열지 않고, 마우스를 올리면 색과 높이만 알려 준다.
  high=page.locator('#trackSvg [data-platform-height=high]').first;low=page.locator('#trackSvg [data-platform-height=low]').first
  expect(high.locator('title')).to_have_text('황색 승강장 · 고상홈');expect(low.locator('title')).to_have_text('청색 승강장 · 저상홈')
  assert high.get_attribute('tabindex') is None and high.get_attribute('role') is None
  high.dispatch_event('click');expect(page.locator('#actionDialog')).not_to_be_visible()
  # MMI 스케줄 화면은 원본에 없는 칸을 더하지 않는다: 열차등급이 대응 홈 높이를 정한다.
  page.evaluate("SimMMI.open('schedule')");expect(page.locator('#scheduleBoardingHeight')).to_have_count(0)
  page.select_option('#scheduleList','K1131');page.click('#scheduleLoad');page.select_option('#scheduleKind','일반열차');page.click('#scheduleApply');page.click('#mmiAlertOk')
  assert page.evaluate("SimPlatforms.boardingOf(SimDiagram.getModel().trains.find(t=>t.id==='K1131'))")=='low'
  assert page.evaluate("SimPlatforms.boardingOf(SimDiagram.getModel().trains.find(t=>t.id==='K1133'))")=='high'
  assert page.evaluate("Object.keys(SimField.state('seoul').routes).length")==0
  page.evaluate("selectStation('uiwang-suwon')");expect(page.locator('#trackSvg [data-platform-height=high]').first.locator('title')).to_contain_text('고상홈')
  assert not errors,errors
  print('PASS platform colours/heights as static LS symbols, class-derived boarding height and corridor legend')
  b.close()
finally:server.shutdown()

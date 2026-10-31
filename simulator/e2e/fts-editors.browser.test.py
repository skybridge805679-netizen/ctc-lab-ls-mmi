"""Instructor editor ordering, native-safe schedule copy and stable monitoring focus (desktop only)."""
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
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];dialogs=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:(dialogs.append(d.type),d.dismiss()))
  page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#ftsWinBtn');fts=page.locator('#ftsPanel');fts.locator('[data-fts-page=scenarios]').first.click();page.fill('#cName','순서 보존 검증')
  for sid in ['S-04','S-ORAL','S-04']:
   page.locator(f'#cLeft tr[data-key="{sid}"]').click();page.click('#cIn')
  expect(page.locator('#cName')).to_have_value('순서 보존 검증');page.locator('#cRight tr[data-key="2"]').click();page.click('#cUp');page.click('#cOut');expect(page.locator('#cRight tr[data-key]')).to_have_count(2)
  assert page.locator('#cRight tr[data-key]').all_text_contents()[0].find('시나리오 상황#4')>=0
  page.click('#cSave');page.click('#mmiConfirmYes');page.click('#mmiAlertOk');assert page.evaluate("SimFTSUI.library().scenarios.find(s=>s.name==='순서 보존 검증').situations")==['S-04','S-ORAL']
  fts.locator('[data-fts-page=situations]').first.click()
  for code in ['221','222']:
   page.check('input[name=schMode][value=create]');page.fill('#schId',code);page.fill('#schName','시간표 '+code);page.click('#schApply');page.click('#mmiAlertOk')
  page.locator('#schDown tr[data-key="K1131"]').click();page.click('#schTrainDel');page.click('#mmiConfirmYes');page.locator('#schTable tr[data-key="01221"]').click();page.locator('#schDown tr[data-key="K1131"]').click();page.click('#schCopy');expect(page.locator('#ftsCopyTarget')).to_be_visible();page.select_option('#ftsCopyTarget','01222');page.click('#ftsCopyApply');page.click('#mmiAlertOk')
  assert page.evaluate("SimFTSUI.library().schedules.find(s=>s.id==='01222').timetable.trains.some(t=>t.id==='K1131')")
  page.locator('#sTable tr[data-key="S-04"]').click();page.locator('#schTable tr[data-key="01222"]').click();page.click('#schApplySit');page.click('#schDelete');expect(page.locator('.mmi-alert')).to_contain_text('사용 중');page.click('#mmiAlertOk')
  fts.locator('[data-fts-page=setup]').first.click();page.click('#suPick');page.locator('#pkScen tr[data-key="SC-02"]').click();page.click('#pkOk');page.uncheck('#suAuto');page.click('#suStart');fts.locator('[data-fts-page=monitor]').first.click();manual=page.locator('[data-manual="제어모드 구술"]');expect(manual).to_be_visible();manual.focus();page.wait_for_timeout(1200);assert manual.evaluate('e=>document.activeElement===e')
  page.click('#mEnd');page.click('#mmiConfirmYes');fts.locator('[data-fts-page=situations]').first.click();page.click('#sClear');page.fill('#sName','작성 중인 상황');page.click('#sSave');page.click('#mmiConfirmYes');page.click('#mmiAlertOk');page.reload(wait_until='networkidle');assert page.evaluate("SimFTSUI.library().situations.some(s=>s.name==='작성 중인 상황'&&!s.problems.length)");assert page.evaluate("SimFTSUI.library().scenarios.some(s=>s.name==='순서 보존 검증')")
  assert not errors,errors
  assert not dialogs,dialogs
  print('PASS FTS editor: order/duplicates/name retention, schedule copy without prompt, referenced deletion guard and stable monitoring focus')
  b.close()
finally:server.shutdown()

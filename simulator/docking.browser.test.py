"""Shared LS/MMI/train-number/timetable state and real desktop docking workflows."""
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
   page=browser.new_page(viewport={'width':width,'height':1080});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('response',lambda r:errors.append(f'HTTP {r.status} {r.url}') if r.status>=400 else None)
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   def menu(top,*items):
    page.locator('.mmi-top-btn',has_text=top).click()
    for item in items[:-1]:page.locator('.mmi-menu-list .has-sub > button',has_text=item).first.click()
    page.locator('.mmi-menu-list [data-mmi-open]',has_text=items[-1]).first.click()
   def field():menu('현장제어','현장설비제어(A)')
   def numbers():menu('현장제어','열차제어','열차번호제어(B)')
   def graph():menu('열차스케줄','온라인 열차그래프(O)')
   def schedule():menu('열차스케줄','온라인열차스케줄 관리','온라인 열차스케줄관리(G)')
   def confirm():page.click('#dialogConfirm');page.wait_for_function('dialogAction===null')
   def acknowledge():page.locator('#mmiAlertOk').click()
   def entries(st,slot):return page.evaluate('([s,k])=>SimLSUI.getModel().stations[s].windows[k]||[]',[st,slot])
   expect(page.locator('[data-mmi-window="field"]')).to_have_class(__import__('re').compile('docked'))
   page.select_option('#stationSelect','geumcheon');page.check('[name="mmiMode"][value="CCM"]');page.click('#mmiApply')
   expect(page.locator('#stateMode')).to_have_text('CCM');expect(page.locator('#eventLogBody')).to_contain_text('금천구청[010090] CCM MODE')
   page.select_option('#controlSelect','route');page.select_option('#mmiSignal','4A');page.select_option('#mmiRoute','4A-B968T');page.click('#mmiApply')
   expect(page.locator('#lsStage [data-active-route="4A-B968T"]')).to_have_count(1)
   expect(page.locator('#alarmLogBody')).to_contain_text('RT_4A_B968T진로설정')
   core=page.evaluate('JSON.stringify(stationStates.geumcheon.routes)')
   # Insert on LS, then edit and transfer that exact UID through the MMI.
   win=lambda slot:page.locator(f'#trackSvg [data-train-slot="{slot}"]')
   win('B965T').dblclick();page.fill('#lsTrainNumber','K1131');confirm();uid=entries('geumcheon','B965T')[0]['uid']
   numbers();page.select_option('#mmiTrainSlot','B965T');expect(page.locator('#mmiTrainEntry option')).to_have_count(1)
   page.select_option('#mmiTrainOp','rename');page.fill('#mmiTrainNumber','K1133');page.select_option('#mmiTrainDirection','down');page.click('#mmiTrainApply');page.locator('#actionDialog [value="cancel"]').click();page.wait_for_function('dialogAction===null');assert entries('geumcheon','B965T')[0]['number']=='K1131'
   page.click('#mmiTrainApply');confirm();expect(win('B965T').locator('text')).to_have_text('>K1133');assert entries('geumcheon','B965T')[0]['uid']==uid
   page.select_option('#mmiTrainOp','move');page.select_option('#mmiTrainTargetStation','anyang');page.select_option('#mmiTrainTargetSlot','1T');page.click('#mmiTrainApply');confirm();assert not entries('geumcheon','B965T');assert entries('anyang','1T')[0]['uid']==uid
   page.select_option('#mmiTrainStation','anyang');expect(page.locator('#stationSelect')).to_have_value('anyang');expect(win('1T').locator('text')).to_have_text('>K1133')
   page.select_option('#mmiTrainSlot','1T');page.click('#mmiTrainProperty');expect(page.locator('#graphTrain')).to_have_value('K1133')
   expect(page.locator('[data-mmi-window="graph"]')).to_have_class(__import__('re').compile('docked'))
   page.locator('[data-dia-station="geumcheon"]').click();expect(page.locator('#stationSelect')).to_have_value('geumcheon');expect(page.locator('#mmiTrainStation')).to_have_value('geumcheon')
   assert page.evaluate('JSON.stringify(stationStates.geumcheon.routes)')==core
   # One clock drives the LS and graph. Model changes go to MMI event logs.
   graph();page.click('#skipBtn');assert page.locator('#diaNow').get_attribute('data-seconds')==str(page.evaluate('state.clock'))
   page.select_option('#graphTrain','K1131');schedule();page.fill('#scheduleSearch','K1131');page.click('#scheduleFind')
   page.check('[name="scheduleCancelType"][value="part"]');page.select_option('#scheduleCancelFrom','dongmyo');page.select_option('#scheduleCancelTo','jonggak');page.click('#scheduleSuspend');acknowledge();expect(page.locator('#scheduleCancelTo')).to_have_value('jonggak')
   assert page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='K1131').calls.find(c=>c.station==='dongmyo').cancelled")
   graph();assert page.locator('[data-dia-cancelled-segment="K1131"]').count()>0
   expect(page.locator('#eventLogBody')).to_contain_text('partial-cancel')
   # Opening an already open editor preserves its draft; an intervening graph edit rejects a stale commit.
   schedule();page.fill('#scheduleCars','12');graph();page.select_option('#graphDelayStation','suwon');page.fill('#graphDelay','3');page.click('#graphApplyDelay')
   schedule();expect(page.locator('#scheduleCars')).to_have_value('12');page.click('#scheduleApply');expect(page.locator('.mmi-alert')).to_contain_text('다시 조회');acknowledge()
   page.click('#scheduleLoad');page.fill('#scheduleCars','12');page.click('#scheduleApply');acknowledge();assert page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='K1131').carCount")==12
   expect(page.locator('#eventLogBody')).to_contain_text('온라인 스케줄 K1131 · update')
   graph();expect(page.locator('#graphTrain')).to_have_value('K1131')
   # Reopening and docking keep draft values, and floating windows stay inside the desktop horizontally.
   page.locator('[data-mmi-window="graph"] .mmi-dock').click();w=page.locator('[data-mmi-window="graph"]');assert 'docked' not in w.get_attribute('class')
   bar=w.locator('.mmi-title');box=bar.bounding_box();page.mouse.move(box['x']+100,box['y']+10);page.mouse.down();page.mouse.move(width+300,box['y']+80,steps=6);page.mouse.up()
   bounds=w.bounding_box();desktop=page.locator('#mmiDesktop').bounding_box();assert bounds['x']>=desktop['x']-1 and bounds['x']+bounds['width']<=desktop['x']+desktop['width']+1
   w.locator('.mmi-dock').click();expect(w).to_have_class(__import__('re').compile('docked'))
   w.locator('.mmi-close').click();graph();expect(page.locator('#graphTrain')).to_have_value('K1131')
   with page.expect_download() as download:page.click('#exportBtn')
   saved=json.loads(Path(download.value.path()).read_text());assert saved['timetable']['trains'];assert saved['mmiLogs']['event'];assert saved['lsDisplay']['stations']['anyang']['windows']['1T'][0]['number']=='K1133'
   assert not errors,errors
   if width==1440:
    page.evaluate("window.getSelection().removeAllRanges()")
    for wid in ['field','trainNumber','schedule']:page.evaluate('(id)=>SimMMI.close(id)',wid)
    graph();page.locator('#toast').evaluate('(e)=>e.style.visibility="hidden"')
    page.locator('#graphPanel').screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-graph.png'),style='#toast {visibility:hidden!important}')
    schedule();page.evaluate("document.querySelector('[data-mmi-window=\"schedule\"] .mmi-win-body').scrollTop=0");page.locator('[data-mmi-window="schedule"]').screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-schedule.png'))
    page.evaluate("SimMMI.close('schedule')");numbers();page.locator('[data-mmi-window="trainNumber"]').screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-train-number.png'))
    page.locator('#mmiShell').screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-mmi.png'))
   print(f'PASS shared LS/MMI routes, train-number UID transfer, graph/schedule revision/cancel/logs, clock/export and dock/drag/reopen: {width}px',flush=True)
   page.close()
  browser.close()
finally:server.shutdown();server.server_close()

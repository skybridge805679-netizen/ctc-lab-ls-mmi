"""Two desktop windows, one engine, screen-local alerts and lossless restoration."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1080});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.clock.install();page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   page.click('#pauseBtn')
   with page.expect_popup() as new:page.click('#detachMMIBtn')
   mmi=new.value;mmi.on('pageerror',lambda e:errors.append(str(e)))
   expect(mmi.locator('#mmiShell')).to_be_visible();expect(page.locator('#mmiShell')).to_have_count(0)
   assert mmi.evaluate('typeof SimCore')=='undefined' # no second engine
   expect(mmi.locator('#stationSelect')).to_be_hidden()   # MMI starts clean: no field-control window
   page.evaluate("SimMMI.open('field')")
   mmi.select_option('#stationSelect','anyang')
   mmi.select_option('#controlSelect','mode')
   mmi.check('input[name="mmiMode"][value="CCM"]');mmi.click('#mmiApply',position={'x':12,'y':12})
   assert page.evaluate('SimField.state("anyang").mode')=='CCM'
   placement=mmi.locator('[data-mmi-window="field"] .mmi-dock')
   expect(placement).to_have_text('자유 배치');placement.click();expect(placement).to_have_text('창 고정');placement.click();expect(placement).to_have_text('자유 배치')
   # Actual simultaneous-route conflict -> red MMI alarm; LS keeps working.
   pair=page.evaluate('''()=>{const C=SimCore.forStation('anyang');const ids=Object.keys(C.routes);for(const a of ids)for(const b of ids){if(a===b)continue;const s=C.initial();s.mode='CCM';if(C.dispatch(s,{type:'route',id:a}).ok&&!C.dispatch(s,{type:'route',id:b}).ok)return [a,b];}}''')
   assert pair
   for route in pair:page.evaluate('id=>SimMMI.run({type:"route",id,source:"LS"})',route)
   expect(mmi.locator('.mmi-alarm')).to_be_visible();expect(page.locator('.mmi-alarm')).to_have_count(0)
   page.select_option('#lsStationSelect','suwon')
   expect(mmi.locator('#stationSelect')).to_have_value('suwon')
   page.locator('[data-mode="CCM"]').click()
   expect(page.locator('#actionDialog')).to_be_visible();expect(mmi.locator('#actionDialog')).to_have_count(0)
   page.click('#dialogConfirm');page.wait_for_function('SimField.state("suwon").mode==="CCM"');assert page.evaluate('SimField.state("suwon").mode')=='CCM'
   expect(mmi.locator('.mmi-alarm')).to_be_visible()
   # MMI modal confirmation is confined to MMI's document.
   mmi.select_option('#controlSelect','stopAll');mmi.click('#mmiApply',position={'x':12,'y':12})
   expect(mmi.locator('.mmi-shield[open]')).to_be_visible()
   page.select_option('#lsStationSelect','guro')
   mmi.click('#mmiConfirmYes')
   page.wait_for_function('SimField.state("suwon").logs[0].action==="stopAll"')
   assert page.evaluate('SimField.state("guro").logs.every(r=>r.action!=="stopAll")')
   expect(page.locator('#lsStationSelect')).to_have_value('guro')
   # A visible MMI alarm does not stop the session clock either.
   before=page.evaluate('SimField.state("guro").clock');page.click('#pauseBtn');page.clock.run_for(1200);page.click('#pauseBtn')
   assert page.evaluate('SimField.state("guro").clock')>before
   # The same non-CCM refusal stays on the screen that requested control.
   for source in ['LS','MMI']:
    page.evaluate('source=>SimMMI.run({type:"route",id:Object.keys(SimCore.forStation("guro").routes)[0],source})',source)
    owner=page if source=='LS' else mmi;other=mmi if source=='LS' else page
    expect(owner.locator('.mmi-shield[open]')).to_be_visible();expect(other.locator('.mmi-shield[open]')).to_have_count(0)
    owner.click('#mmiAlertOk')
   # Menus outside click and Escape work in the adopted document.
   mmi.locator('.mmi-top-btn').first.click();expect(mmi.locator('.mmi-menu-top.open')).to_have_count(1)
   mmi.keyboard.press('Escape');expect(mmi.locator('.mmi-menu-top.open')).to_have_count(0)
   # Graph and schedule are the original panels and share the clock/model.
   with page.expect_popup() as tg:page.evaluate('SimMMI.open("graph")')   # T/G is its own window, not part of the MMI
   graph=tg.value;expect(graph.locator('#diaSvg')).to_be_visible();expect(mmi.locator('#diaSvg')).to_have_count(0)
   graph.close();page.wait_for_function('!SimWorkspace.graphDetached()')
   page.evaluate('SimMMI.open("schedule")');expect(mmi.locator('#schedulePanel')).to_be_visible()
   before=page.evaluate('SimField.state("guro").clock');page.click('#skipBtn')
   assert page.evaluate('SimField.state("guro").clock')==before+10
   mmi.screenshot(path=f'/tmp/orpheia-mmi-{width}.png')
   # Edits remain in the same live timetable; MMI success dialog stays here.
   train=mmi.input_value('#scheduleSelected')
   mmi.select_option('#scheduleKind','회송열차')
   mmi.click('#scheduleApply');expect(mmi.locator('.mmi-shield[open]')).to_be_visible()
   assert page.evaluate('id=>SimDiagram.getModel().trains.find(t=>t.id===id).kind',train)=='회송열차'
   mmi.click('#mmiAlertOk')
   # Unacknowledged alarms, station and route state survive closing/reopening.
   mmi.close();page.clock.run_for(600);expect(page.locator('#mmiShell')).to_have_count(0);expect(page.locator('.mmi-alarm')).to_have_count(0)
   expect(page.frame_locator('#mmiParking').locator('#stationSelect')).to_have_value('guro')
   with page.expect_popup() as new:page.click('#detachMMIBtn')
   mmi=new.value;expect(mmi.locator('.mmi-alarm')).to_be_visible()
   # Existing popup is focused rather than duplicated.
   page.click('#detachMMIBtn');assert len(page.context.pages)==2
   # Closing with an MMI modal restores that dialog and its handlers too.
   page.evaluate('SimMMI.alertBox("창 복원 확인")')
   mmi.locator('.mmi-shield[open]').evaluate('el=>el.ownerDocument.defaultView.close()')
   page.clock.run_for(600);expect(page.locator('#mmiShell')).to_have_count(0)
   expect(page.frame_locator('#mmiParking').locator('.mmi-shield[open]')).to_have_count(1)
   with page.expect_popup() as new:page.click('#detachMMIBtn')
   mmi=new.value;expect(mmi.locator('.mmi-shield[open]')).to_be_visible();mmi.click('#mmiAlertOk')
   page.evaluate('SimWorkspace.closeMMI()');expect(page.locator('#mmiShell')).to_have_count(0)
   assert len(page.context.pages)==1
   # Scenario controls in MMI drive timed train movement on the other screen.
   page.reload(wait_until='networkidle');page.click('#pauseBtn')
   with page.expect_popup() as new:page.click('#detachMMIBtn')
   mmi=new.value;page.evaluate("SimMMI.open('scenario')");mmi.select_option('#scSelect','yongsan-5');mmi.click('#scStart')
   number=mmi.input_value('#scTrain')
   for action in [{'type':'mode','value':'CCM','source':'MMI'},{'type':'stop','id':'2A','source':'LS'},{'type':'tick','seconds':90},{'type':'route','id':'2A-5T','source':'LS'}]:
    assert page.evaluate('a=>SimMMI.run(a)',action)['ok']
   page.clock.run_for(600);expect(page.locator('[data-train-run="2A-5T"]')).to_have_count(1)
   page.evaluate('SimMMI.run({type:"tick",seconds:60})')
   expect(page.locator('[data-train-slot="5T"]')).to_contain_text(number)
   expect(mmi.locator('#eventLogBody')).to_contain_text('시나리오 열차 이동 완료')
   page.evaluate('SimWorkspace.closeMMI()')
   # Browsers denying window.open leave the combined UI intact.
   page.evaluate('window.open=()=>null');page.click('#detachMMIBtn');expect(page.locator('#mmiShell')).to_have_count(0)
   assert not errors,errors
   print(f'PASS {width}px: shared controls, alarm-time clock, screen-local dialogs, original target, schedule edit, timed scenario, closed MMI stays off LS, reopen, popup fallback',flush=True)
   page.close()
  browser.close()
finally:
 server.shutdown();server.server_close()

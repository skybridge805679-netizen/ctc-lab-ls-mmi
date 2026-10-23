"""Desktop UI: clickable switch parts, immediate manual relocation, files and undo/redo."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1920,'height':1080},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn')
  stations=page.locator('#lsStationSelect option').evaluate_all('es=>es.map(e=>e.value)')
  for station in stations:
   page.select_option('#lsStationSelect',station);page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
   controls=page.locator('[data-point-control]').evaluate_all('es=>es.map(e=>e.dataset.pointControl)');assert controls,station
   for part in controls:
    before=page.evaluate('([st,part])=>{const C=SimCore.forStation(st);return SimField.state(st).points[C.pointParts[part]||part]}',[station,part])
    page.locator(f'[data-point-control="{part}"]').first.click();expect(page.locator('#actionDialog')).to_contain_text('SW_'+part);page.click('#dialogConfirm')
    try:page.wait_for_function('([st,part,value])=>{const C=SimCore.forStation(st);return SimField.state(st).points[C.pointParts[part]||part]===value}',arg=[station,part,'N' if before=='R' else 'R'],timeout=3000)
    except Exception:
     print(station,part,before,page.evaluate('id=>SimField.state(id).logs.slice(0,4)',station),page.locator('#toast').inner_text());raise
   if station=='geumcheon':page.screenshot(path='/tmp/v240-switch-parts.png')
  page.evaluate("SimMMI.open('graph')");page.wait_for_selector('#tgStatus');table=page.evaluate('SimDiagram.getModel()');t=table['trains'][0];station=t['calls'][0]['station'];old=t['calls'][0]['departure']
  page.evaluate('([id,st])=>{const m=SimDiagram.getModel();SimTimetable.delay(m,id,st,2);SimDiagram.render()}',[t['id'],station]);page.locator('.tg-tool[title*="실행 취소"]').click();page.click('#mmiAlertOk');assert page.evaluate('id=>SimDiagram.getModel().trains.find(t=>t.id===id).calls[0].departure',t['id'])==old
  page.locator('.tg-tool[title*="다시 실행"]').click();page.click('#mmiAlertOk');assert page.evaluate('id=>SimDiagram.getModel().trains.find(t=>t.id===id).calls[0].departure',t['id'])==old+120
  with page.expect_download() as download:page.evaluate('SimTimetableFiles.save()')
  assert download.value.suggested_filename.endswith('.json')
  with page.expect_file_chooser() as chooser:page.evaluate('SimTimetableFiles.open()')
  chooser.value.set_files({'name':'timetable.json','mimeType':'application/json','buffer':json.dumps({'timetable':table}).encode()});page.wait_for_selector('#mmiConfirmYes');page.click('#mmiConfirmYes');page.click('#mmiAlertOk');assert page.evaluate('id=>SimDiagram.getModel().trains.find(t=>t.id===id).calls[0].departure',t['id'])==old
  page.evaluate("SimMMI.close('graph');SimMMI.open('scenario')");page.select_option('#scSelect','em-03');page.click('#scStart');expect(page.locator('#scSteps input')).to_have_count(0);page.evaluate("SimMMI.run({type:'tick',seconds:600})");assert page.evaluate('SimScenarioUI.snapshot().done.filter(Boolean).length')>0;assert page.evaluate('SimScenarioUI.motionJobs().length')>0
  assert not errors,errors;browser.close();print('PASS every displayed switch control across all 15 stations, timed unchecked scenarios, timetable JSON open/save and undo/redo')
finally:server.shutdown()

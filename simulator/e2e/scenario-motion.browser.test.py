"""Automatic scenario journeys use the clock; manual number relocation remains immediate."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=b.new_page(viewport={'width':width,'height':1080});page.clock.install();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');page.click('#mmiScenarioBtn')
   page.select_option('#scSelect','yongsan-5');page.click('#scStart');number=page.input_value('#scTrain')
   # starting a scenario starts the exam clock (v0.27.0), so pause again for the frozen-motion check
   if '일시정지' in page.inner_text('#pauseBtn'):page.click('#pauseBtn')
   run=lambda a:page.evaluate('a=>SimMMI.run(a)',a)
   for a in [{'type':'mode','value':'CCM','source':'MMI'},{'type':'stop','id':'2A','source':'LS'},{'type':'tick','seconds':90},{'type':'route','id':'2A-5T','source':'LS'}]:assert run(a)['ok']
   page.clock.run_for(600)
   expect(page.locator('[data-train-run="2A-5T"]')).to_have_count(1)
   assert number not in page.locator('[data-train-slot="B607T"]').text_content(),'in-transit number must not remain visible at the origin'
   assert number not in page.locator('[data-train-slot="5T"]').text_content(),'number must not arrive before travel ends'
   old=page.locator('[data-train-run="2A-5T"]').get_attribute('d');page.clock.run_for(3000)
   assert page.locator('[data-train-run="2A-5T"]').get_attribute('d')==old,'pausing freezes physical movement'
   run({'type':'tick','seconds':10});assert page.locator('[data-train-run="2A-5T"]').get_attribute('d')!=old
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.0-scenario-moving.png'),style='#toast{visibility:hidden}')
   run({'type':'tick','seconds':50});expect(page.locator('[data-train-slot="5T"]')).to_contain_text(number)
   expect(page.locator('[data-train-run="2A-5T"]')).to_have_count(0)
   assert page.evaluate('SimScenarioUI.motionJobs().every(j=>j.phase==="done")')
   page.click('#scStart');assert not page.evaluate('SimScenarioUI.motionJobs().length');assert number in page.locator('[data-train-slot="B607T"]').text_content()
   # Every emergency script has a reviewed spoken cue that creates motion work.
   for sid in page.evaluate('SimEmergency.list.map(s=>s.id)'):
    page.select_option('#scSelect',sid);page.click('#scStart')
    expect(page.locator('#scSteps input[data-say]')).to_have_count(0)
    for _ in range(150):
     run({'type':'tick','seconds':10});page.clock.run_for(600)
     if page.evaluate('SimScenarioUI.motionJobs().length'):break
     action=page.evaluate("id=>{const s=SimEmergency.list.find(s=>s.id===id),r=SimScenarioUI.snapshot();return s.steps.find((step,i)=>step.kind==='do'&&!r.done[i])?.act}",sid)
     if not action:continue
     page.select_option('#lsStationSelect',action['station'])
     if action['type']=='mode':run({'type':'mode','value':action['value'],'source':'MMI'})
     elif action['type']=='stop':
      for sig in action['ids']:run({'type':'stop','id':sig,'source':'LS'})
     elif action['type']=='route':run({'type':'route','id':action['id'],'source':'LS'})
    assert page.evaluate('SimScenarioUI.motionJobs().length')>0,sid
    expect(page.locator('#scMotionStatus')).to_be_visible()
   if width==1440:page.locator('#scMotionStatus').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.0-scenario-status.png'),style='.mmi-alarm{visibility:hidden!important}')
   page.click('#scStop');assert not page.evaluate('SimScenarioUI.motionJobs().length');assert page.evaluate('SimScenarioUI.reservedNumbers().length')==0
   assert page.evaluate('Object.values(SimNetwork.catalog).filter(s=>s.controlled).every(s=>!Object.values(SimField.state(s.id).routes).some(r=>r.train?.scenario))')
   assert not errors,errors;page.close();print(f'PASS {width}px: timed scenario arrival, hidden origin, pause, 60x clear, restart/stop and movement cues in all 9 emergencies')
  b.close()
finally:server.shutdown();server.server_close()

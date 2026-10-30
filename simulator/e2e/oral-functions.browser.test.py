"""Oral reference 1/7/13/19: real berth beats plan, manual trains, shared properties and unknown engine positions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn')
  page.evaluate("""()=>{for(const [slot,number,direction]of [['B950T','K1131','up'],['F1T','Z123','down']])SimMMI.run({type:'lsOperation',operation:{op:'insert',station:'guro',slot,number,direction},source:'LS'});SimMMI.open('trainPositions');}""")
  row=page.locator('#trainPositionsBody tr').filter(has=page.locator('td',has_text='Z123'));expect(row).to_contain_text('수동 등록');expect(row).to_contain_text('F1T');expect(row).to_contain_text('하행')
  scheduled=page.locator('#trainPositionsBody tr').filter(has=page.locator('td',has_text='K1131'));expect(scheduled).to_contain_text('구로');expect(scheduled).to_contain_text('B950T');expect(scheduled).to_contain_text('열번 표시')
  page.evaluate("SimMMI.close('trainPositions');SimMMI.open('trace')");page.fill('#traceInput','K1131');page.click('#traceStart');expect(page.locator('#lsStationSelect')).to_have_value('guro');expect(page.locator('#traceMsg')).to_contain_text('열번 표시');page.click('#traceStop');page.click('#traceClose')
  page.evaluate("SimMMI.open('trainNumber')");page.select_option('#mmiTrainSlot','B950T');page.click('#mmiTrainProperty');expect(page.locator('#actionDialog')).to_contain_text('시발시각');expect(page.locator('#actionDialog')).to_contain_text('계획 도착');expect(page.locator('#actionDialog')).to_contain_text('미기록');page.click('#dialogConfirm')
  page.select_option('#mmiTrainSlot','F1T');page.click('#mmiTrainProperty');expect(page.locator('#actionDialog')).to_contain_text('Z123');expect(page.locator('#actionDialog')).to_contain_text('스케줄 없음');page.click('#dialogConfirm')
  assert page.evaluate("""()=>{window.SimRemote={snapshot:{auto:{positions:{K1131:null}}}};try{return SimAutoUI.position(SimDiagram.getModel().trains.find(t=>t.id==='K1131'),0)===null;}finally{delete window.SimRemote;}}""")
  page.evaluate("SimMMI.close('trainNumber');SimMMI.open('trainPositions')");page.screenshot(path=str(ROOT.parent/'docs/preview-v0.27.1-oral-positions.png'))
  page.evaluate("SimMMI.close('trainPositions')");page.locator('#trackSvg').click(button='right',position={'x':12,'y':12});page.locator('[data-context-action=overview]').hover();page.locator('[data-context-action=overview-all]').click()
  page.evaluate("SimMMI.run({type:'lsOperation',operation:{op:'insert',station:'guro',slot:'F2T',number:'Z456',direction:'down'},source:'LS'})")
  expect(page.locator('#lsOverview [data-overview-station=guro]')).to_contain_text('Z456')
  assert not errors,errors
  print('PASS oral reference: actual berths, manual numbers, real trace, shared LS/MMI properties and no null-to-plan substitution')
  b.close()
finally:server.shutdown()

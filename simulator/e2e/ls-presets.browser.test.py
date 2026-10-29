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
  assert page.locator('#lsStationSelect option').count()==15   # 역간 감시 화면은 하단 목록에 없다
  assert page.locator('#stationTabs [data-view]').count()==15
  page.select_option('#lsStationSelect','uiwang');expect(page.locator('#lsStage')).not_to_contain_text('성균관대');main_signals=page.locator('[data-signal]').count();assert main_signals>0
  page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm');page.click('#nextStation')
  expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon');expect(page.locator('#stationSelect')).to_have_value('uiwang');expect(page.locator('#lsStage')).to_contain_text('성균관대');expect(page.locator('#lsStage')).to_contain_text('화서');assert page.locator('#lsStage [data-mode],#lsStage [data-stop-all],#lsStage [data-equipment]').count()==0
  assert page.locator('#lsStage').get_attribute('data-control-station')==''
  expect(page.locator('#resetBtn')).to_be_hidden();expect(page.locator('#drawerBtn')).to_be_hidden()
  assert page.locator('[data-point-control]').count()==0
  def win(slot):return page.locator(f'#trackSvg [data-train-slot="{slot}"]')
  def action(name):return page.locator(f'[data-context-action="{name}"]')
  def confirm():page.click('#dialogConfirm');expect(page.locator('#actionDialog')).not_to_be_visible();page.wait_for_function('dialogAction===null')
  def branch(slot,name):
   win(slot).click(button='right');action(name).hover();action(name).locator('..').locator('.ls-submenu button').first.click()
  def entries(slot):return page.evaluate('(slot)=>SimLSUI.getModel().stations.uiwang.windows[slot]||[]',slot)
  equipment=page.evaluate('JSON.stringify({routes:state.routes,points:state.points,occupied:state.occupied,mode:state.mode})')
  # Monitor-only refers to field equipment, not train-number management.
  win('B1022T').dblclick();expect(page.locator('#actionDialog')).to_be_visible();page.fill('#lsTrainNumber','K252');confirm()
  expect(win('B1022T')).to_contain_text('K252');assert page.locator('[data-train-occupied="B1022T"]').count()==1
  branch('B1022T','train-rename');page.fill('#lsTrainNumber','K254');confirm();assert entries('B1022T')[0]['number']=='K254'
  branch('B1022T','train-move');page.evaluate('render()');assert page.locator('#lsStage').evaluate("e=>e.classList.contains('select-train-target')")
  win('B1032T').click();confirm();assert entries('B1022T')==[] and entries('B1032T')[0]['number']=='K254'
  win('B1022T').focus();page.keyboard.press('Enter');page.fill('#lsTrainNumber','K252');confirm()
  branch('B1032T','train-swap');win('B1022T').click();confirm();assert entries('B1032T')[0]['number']=='K252' and entries('B1022T')[0]['number']=='K254'
  branch('B1022T','train-delete');confirm();assert entries('B1022T')==[]
  # A pending move can cross the preset boundary in either direction.
  branch('B1032T','train-move');page.click('#previousStation')
  main_slot=page.locator('#trackSvg [data-train-slot]').first.get_attribute('data-train-slot');win(main_slot).click();confirm();assert entries(main_slot)[0]['number']=='K252'
  branch(main_slot,'train-move');page.click('#nextStation');win('B1022T').focus();page.keyboard.press(' ');confirm()
  assert entries(main_slot)==[] and entries('B1022T')[0]['number']=='K252'
  win('B1022T').focus();page.keyboard.press('Shift+F10');action('train-properties').click();expect(page.locator('.ls-properties')).to_contain_text('K252');confirm()
  # Blank-space menu still has no field controls, scan or annotation editing.
  page.locator('.fidelity-note').click(button='right');assert page.locator('[data-context-action="scan-current"],[data-context-action="boards"]').count()==0;page.keyboard.press('Escape')
  assert page.evaluate('JSON.stringify({routes:state.routes,points:state.points,occupied:state.occupied,mode:state.mode})')==equipment
  page.click('#previousStation');expect(page.locator('#lsStationSelect')).to_have_value('uiwang');assert page.locator('[data-signal]').count()==main_signals
  page.click('#nextStation');expect(page.locator('#trackSvg')).to_contain_text('K252');page.click('#nextStation');expect(page.locator('#lsStationSelect')).to_have_value('suwon');page.click('#previousStation');expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon')
  # Re-applying preferred screens must keep the new preset and current selection.
  page.evaluate('SimPreferred.apply()');expect(page.locator('#lsStationSelect')).to_have_value('uiwang-suwon')
  for width,height in [(1920,1080),(1440,1000),(960,720)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200);expect(page.locator('#trackSvg')).to_contain_text('K252');expect(page.locator('#trackSvg')).to_contain_text('화서')
   assert page.locator('[data-train-slot="B1022T"]').is_visible()
   plates=page.locator('#trackSvg').evaluate("svg=>{const box=svg.getBoundingClientRect();return [...svg.querySelectorAll('.inter-station .plate')].map(e=>{const r=e.getBoundingClientRect();return {center:(r.x+r.width/2-box.x)/box.width,width:r.width/box.width,left:(r.x-box.x)/box.width,right:(r.right-box.x)/box.width}})}")
   assert .33<plates[0]['center']<.38 and .82<plates[1]['center']<.88,(width,plates)
   assert all(.07<r['width']<.11 for r in plates),(width,plates)
   assert plates[1]['left']-plates[0]['right']>.38,(width,plates)
  # All three windows are viewports of existing circuit state, navigated by source arrows.
  for host,monitor,nxt,plate in [('anyang','anyang-geumjeong','geumjeong','명학'),('gunpo','gunpo-uiwang','uiwang','당정'),('uiwang','uiwang-suwon','suwon','화서')]:
   page.evaluate('id=>selectStation(id)',host)
   assert page.locator(f'#stationTabs [data-view="{monitor}"]').count()==0
   before=page.evaluate('JSON.stringify(stationStates)')
   page.locator(f'[data-nav-view="{monitor}"]').focus();page.keyboard.press('Enter')
   expect(page.locator('#lsStage')).to_have_attribute('data-preset',monitor);expect(page.locator('#lsStage')).to_contain_text(plate)
   assert page.locator('#lsStage [data-mode],#lsStage [data-point-control],#lsStage [data-signal],#lsStage [data-stop-all]').count()==0
   assert page.evaluate('JSON.stringify(stationStates)')==before
   slot=page.locator('#trackSvg [data-train-slot]').first.get_attribute('data-train-slot')
   win(slot).dblclick();expect(page.locator('#dialogBody')).to_contain_text(page.evaluate('SimLSPresets.get(selectedView).name'));page.fill('#lsTrainNumber','K261');confirm()
   win(slot).click(button='right');action('train-properties').click();expect(page.locator('.ls-properties')).to_contain_text(page.evaluate('SimLSPresets.get(selectedView).name'));confirm()
   model=page.evaluate('JSON.stringify(SimLSUI.getModel())')
   page.locator(f'[data-nav-view="{nxt}"]').click();page.locator(f'[data-nav-view="{monitor}"]').click()
   expect(win(slot)).to_contain_text('K261');assert page.evaluate('JSON.stringify(SimLSUI.getModel())')==model
   page.locator(f'[data-nav-view="{host}"]').click();expect(page.locator('#lsStage')).to_have_attribute('data-preset',host)
  assert not errors,errors;browser.close();print('PASS 18 LS viewports / 15 control stations, Uiwang–Suwon navigation, monitor equipment restrictions and editable shared train numbers, preferred screens and corridor resizing')
finally:server.shutdown()

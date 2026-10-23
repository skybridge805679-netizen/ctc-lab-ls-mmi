"""Source circuit chains drive real movement and the corrected Anyang crossover."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1080});page.clock.install();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn');page.select_option('#stationSelect','cheongnyangni')
   page.evaluate('SimDiagram.getModel().trains.splice(1);SimAutoUI.set(true)')
   run=lambda a:page.evaluate('a=>SimMMI.run(a)',a)
   # Depart at 30 s, clear at 50 s; the number then progresses through actual B codes.
   run({'type':'tick','seconds':30});run({'type':'tick','seconds':20})
   assert page.evaluate('SimLine.journeys.get("K1131")')=='B002T'
   run({'type':'tick','seconds':50});assert page.evaluate('SimLine.journeys.get("K1131")')=='B004T'
   expect(page.locator('[data-train-occupied="B004T"]')).to_have_count(1)
   result=run({'type':'lsOperation','operation':{'op':'insert','station':'cheongnyangni','slot':'B006T','number':'K7777','direction':'down'}});assert result['ok']
   run({'type':'tick','seconds':100});assert page.evaluate('SimLine.journeys.get("K1131")')=='B004T','occupied next circuit must hold the follower'
   assert page.evaluate('SimAutoUI.position(SimDiagram.getModel().trains[0],200).circuit')=='B004T'
   uid=page.evaluate('SimLSUI.getModel().stations.cheongnyangni.windows.B006T[0].uid')
   run({'type':'lsOperation','operation':{'op':'delete','station':'cheongnyangni','slot':'B006T','uid':uid}})
   run({'type':'tick','seconds':10});assert page.evaluate('SimLine.journeys.get("K1131")')=='B006T'
   run({'type':'tick','seconds':110});assert page.evaluate('SimField.state("dongmyo").approach["1B"]')
   page.select_option('#stationSelect','dongmyo');expect(page.locator('[data-train-occupied="B012T"]')).to_have_count(1)
   page.click('#mmiLineBtn');expect(page.locator('#lnSummary')).to_contain_text('317개 회로');expect(page.locator('#lnRows')).to_contain_text('B012T')
   if width==1440:page.locator('[data-mmi-window="lineNet"]').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.4-circuits.png'))
   # Corrected 53B→53A gives both confirmed departures native contiguous resource paths.
   page.reload(wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn');page.evaluate('SimAutoUI.set(false)');page.select_option('#stationSelect','anyang')
   assert run({'type':'mode','value':'CCM'})['ok']
   for route in ['4A-B660T','4B-B660T']:
    assert page.evaluate('r=>SimNetworkTopology.localPath("anyang",r).contiguous',route)
    assert run({'type':'route','id':route})['ok']
    assert page.evaluate('SimField.state("anyang").points["53"]')=='R'
    if route=='4A-B660T' and width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.19.4-anyang.png'),style='#toast{visibility:hidden}')
    assert run({'type':'stop','id':route.split('-')[0]})['ok']
   assert page.evaluate('SimNetworkTopology.audit().inferredCompositeRoutes.length')==0
   page.reload(wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn')
   page.evaluate('''()=>{const m=SimDiagram.getModel(),t=SimTimetable.pattern({id:'G9101',from:'uiwang',to:'suwon',start:0});t.calls[0].departureRoute='4A_FT';m.trains.splice(0,m.trains.length,t);SimAutoUI.set(true);}''')
   run({'type':'tick','seconds':20})
   assert page.evaluate('SimAutoUI.position(SimDiagram.getModel().trains[0],20).boundary')=='external:uiwang:FT'
   run({'type':'tick','seconds':600});assert page.evaluate('Object.keys(SimField.state("suwon").routes).length')==0
   expect(page.locator('#eventLogBody')).to_contain_text('기지 경계 인계')
   assert not errors,errors;page.close()
   print(f'PASS {width}px: circuit progression, occupied-block hold/release, approach, native Anyang 53 crossover',flush=True)
  browser.close()
finally:server.shutdown();server.server_close()

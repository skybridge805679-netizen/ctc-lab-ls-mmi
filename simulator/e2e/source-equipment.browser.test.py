"""Reviewed block anchors and missing Guro 55: real desktop pointer actions, not image overlays."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright,expect
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');source=json.loads((ROOT.parent/'references/transcriptions/block-signals.json').read_text());seen=[]
  for view in page.evaluate('SimLSPresets.list().map(v=>v.id)'):
   page.evaluate('id=>selectStation(id)',view)
   marks=page.locator('#trackSvg .block-indicator').evaluate_all("""es=>es.map(g=>{const code=g.dataset.blockAnchor,cell=document.querySelector(`[data-track-circuit="${code}"] > .cell-bed`),body=g.querySelector('.block-body').getBBox();return {id:g.dataset.blockId,code,body:{x:body.x,y:body.y,w:body.width,h:body.height},cell:cell?{x:+cell.getAttribute('x'),y:+cell.getAttribute('y')+9,w:+cell.getAttribute('width')}:null}})""")
   for m in marks:
    r=next(r for r in source['indicators'] if r['id']==m['id']);seen.append(m['id']);assert m['code']==r['code']
    if m['cell']:
     expected=max(22,min(1578,m['cell']['x']+m['cell']['w']*r['fraction']))
     assert abs(m['body']['x']+m['body']['w']/2-expected)<.1,(view,m)
     assert abs(m['body']['y']+m['body']['h']/2-m['cell']['y']-(-17 if r['side']=='above' else 17))<.1,(view,m)
  assert len(seen)==274 and len(set(seen))==274
  for station,code in [('geumjeong','B998T'),('geumjeong','B997T'),('suwon','B1033T')]:
   page.evaluate('id=>selectStation(id)',station);expect(page.locator(f'[data-circuit-label="{code}"]')).to_be_visible();expect(page.locator(f'[data-block-code="{code}"]')).to_be_visible()
  page.evaluate("selectStation('guro')");page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
  point=page.locator('[data-point-control="55"]');shape=page.locator('[data-switch-geometry="55"]');expect(point).to_be_visible();expect(shape).to_have_attribute('data-position','N')
  for value in ['R','N']:
   point.click();page.click('#dialogConfirm');expect(shape).to_have_attribute('data-position',value)
  for route,value in [('4A-F1T','N'),('4A-F2T','N'),('4A-B950T','R')]:
   page.locator('[data-signal="4A"]').click();page.locator(f'[data-route-choice="{route}"]').click();expect(shape).to_have_attribute('data-position',value);expect(shape).to_have_attribute('data-locked','true');assert point.evaluate("e=>e.classList.contains('locked')")
   if route in ['4A-F1T','4A-B950T']:page.screenshot(path=str(ROOT.parent/('docs/preview-v0.26.2-guro55-'+('normal' if value=='N' else 'reverse')+'.png')),style='#toast{visibility:hidden}')
   point.click();page.click('#dialogConfirm');expect(shape).to_have_attribute('data-position',value);expect(page.locator('#toast')).to_contain_text('먼저 해정')
   page.locator('[data-signal="4A"]').click();page.click('#dialogConfirm');expect(shape).to_have_attribute('data-locked','false');assert not point.evaluate("e=>e.classList.contains('locked')")
  # Source 59A is the ascending Seoul diagonal (internal 58), not the opposite branch.
  page.evaluate("selectStation('seoul')");page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm');page.locator('[data-point-control="59A"]').click();page.click('#dialogConfirm');expect(page.locator('[data-switch-connection="58"]')).to_have_attribute('data-position','R');expect(page.locator('[data-switch-connection="59"]')).to_have_attribute('data-position','N')
  assert not errors,errors;print('PASS 274 source block positions across 18 viewports, exact restored circuit labels, Guro 55 N/R destinations and route locking, reviewed Seoul 59A identity');b.close()
finally:server.shutdown()

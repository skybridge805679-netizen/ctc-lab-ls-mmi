"""ORPHEIA assets, complete desktop surfaces, accessible controls and unchanged LS colours."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1080},reduced_motion='reduce');errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 else None)
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn')
   expect(page.locator('.brand-icon img')).to_have_attribute('src','assets/orpheia/emblem.png')
   assert page.locator('.brand-icon img').evaluate('e=>e.complete&&e.naturalWidth>0')
   expect(page.locator('#exportBtn .ui-icon')).to_have_count(1)
   page.click('#guideBtn');expect(page.locator('#guideDialog')).to_be_visible();page.locator('.guide-intro').scroll_into_view_if_needed();page.wait_for_function("document.querySelector('.guide-intro img').naturalWidth>0")
   if width==1440:page.locator('#guideDialog').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-guide.png'))
   page.click('#closeGuide');page.select_option('#lsStationSelect','suwon');assert page.locator('.ls-name').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(8, 11, 8)'
   page.locator('[data-mode="CCM"]').click();expect(page.locator('#actionDialog')).to_have_class('mode-confirm');page.keyboard.press('n');expect(page.locator('#actionDialog')).not_to_be_visible()
   page.locator('#toast').evaluate('e=>e.style.visibility="hidden"');page.evaluate('window.scrollTo(0,0)')
   if width==1440:page.screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-workspace.png'),style='#toast{display:none!important}')
   for wid in ['scheduleId','entryNotice','trace','noteManage','scenario','settings','equipment','cdrs','ledger','preferredScreen','logReplay','schedule']:
    page.evaluate("for(const id of SimMMI.windowIds())SimMMI.close(id)");page.evaluate('(id)=>SimMMI.open(id)',wid)
    win=page.locator(f'[data-mmi-window="{wid}"]');expect(win).to_be_visible();win.scroll_into_view_if_needed()
    bounds=win.bounding_box();desktop=page.locator('#mmiDesktop').bounding_box();assert bounds['x']>=desktop['x']-1 and bounds['x']+bounds['width']<=desktop['x']+desktop['width']+1,(wid,width,bounds)
    assert win.locator('.mmi-title').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(190, 227, 227)',wid
    if width==1440 and wid in ['scheduleId','scenario','graph','schedule','noteManage','equipment']:win.screenshot(path=str(ROOT.parent/f'docs/preview-v0.18.0-{wid}.png'),style='#toast{visibility:hidden!important}')
   page.evaluate("for(const id of SimMMI.windowIds())SimMMI.close(id)");page.locator('#mmiDesktop').scroll_into_view_if_needed();page.wait_for_function("document.querySelector('.mmi-guide').naturalWidth>0")
   assert page.locator('.mmi-wallpaper').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
   if width==1440:page.locator('#mmiShell').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-desktop.png'),style='#toast{display:none!important}')
   assert not errors,errors;print('PASS generated assets, hero/guide, 13 mint windows, desktop fit, native LS and no errors:',width,flush=True);page.close()
  browser.close()
finally:server.shutdown()

"""Desktop station-strip coverage, compact MMI menus and Yongsan boundary labels."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  measurements=[]
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce');errors=[]
   page.add_init_script('window.open=()=>null');page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true});selectStation('yongsan')")
   page.add_style_tag(content='*,*::before,*::after{transition:none!important;animation:none!important}')
   strip=page.locator('#stationTabs').bounding_box();buttons=page.locator('#stationTabs [data-view]');assert buttons.count()==15
   boxes=[b.bounding_box() for b in buttons.all()]
   assert abs(boxes[0]['x']-strip['x'])<2
   assert abs(boxes[-1]['x']+boxes[-1]['width']-strip['x']-strip['width'])<2
   assert max(b['width'] for b in boxes)-min(b['width'] for b in boxes)<2
   assert page.locator('#stationTabs').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert page.locator('#stationTabs button').evaluate_all('es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)')
   # B607T must be on the existing continuation to the right of YT, never squeezed into it.
   yt=page.locator('[data-circuit-label="YT"]').bounding_box();boundary=page.locator('[data-circuit-label="B607T"]').bounding_box()
   assert boundary['x']>yt['x']+yt['width']+30
   expect(page.locator('[data-track-circuit="B607T"]')).to_have_count(1)   # 원본 LS(slide 7)처럼 B607T는 YT 오른쪽의 별도 칸 (v0.39.31)
   expect(page.locator('#trackSvg .rail-join')).to_have_count(0)
   expect(page.locator('#trackSvg [data-reviewed-join]')).to_have_count(2)   # B606T·B605T 꺾여 내려가는 연결 (원본 LS slide 7)
   for code in ['YT','B607T','BT','B610T','B605T']:
    expect(page.locator(f'[data-circuit-label="{code}"]')).to_have_count(1)
   menu=page.locator('.mmi-menubar');assert menu.bounding_box()['height']<=26
   # Compact top menu must still open its real submenu and field-control window.
   page.locator('.mmi-top-btn',has_text='현장제어').click();expect(page.locator('.mmi-menu-top.open')).to_have_count(1)
   page.locator('[data-mmi-open="field"]').first.click();expect(page.locator('[data-mmi-window="field"]')).to_be_visible()
   page.evaluate("SimMMI.close('field');document.querySelector('.ls-viewport>main').scrollTop=0;window.scrollTo(0,0)")
   page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
   if width==1920:
    page.screenshot(path=str(ROOT.parent/'docs/preview-v0.38.1-ls.png'),animations='disabled')
    for code,name in [('B605T','b605'),('YT','yt')]:
     b=page.locator(f'[data-circuit-label="{code}"]').first.bounding_box();x=max(0,b['x']-150);y=max(0,b['y']-60)
     page.screenshot(path=str(ROOT.parent/f'docs/preview-v0.38.1-after-{name}.png'),clip={'x':x,'y':y,'width':min(500,width-x),'height':230},animations='disabled')
   measurements.append({'viewport':width,'stripWidth':strip['width'],'stationButtonWidth':boxes[0]['width'],'mmiMenuHeight':menu.bounding_box()['height'],'ytToB607Gap':round(boundary['x']-yt['x']-yt['width'],1)})
   assert not errors,errors;page.close();print('PASS full-width 15 presets, compact usable MMI menu and clean Yongsan boundary at',width)
  browser.close();print(json.dumps(measurements,ensure_ascii=False))
finally:server.shutdown()

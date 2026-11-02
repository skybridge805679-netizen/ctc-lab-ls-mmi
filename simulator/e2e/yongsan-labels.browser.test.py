"""Check the complete source inventory in real detailed/overview SVGs and rendered pixels."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright,expect
import json,math
ROOT=Path(__file__).resolve().parent.parent
PROOF=json.loads((ROOT.parent/'references/transcriptions/yongsan-circuit-labels.json').read_text())
EXPECTED=sorted(sum(PROOF['rows'],[]))
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true});selectStation('yongsan')")
   def verify(scope,pixels=False):
    names=page.locator(scope+' text[data-circuit-label]');assert sorted(names.all_text_contents())==EXPECTED
    if pixels:
     screenshot=Image.open(BytesIO(page.screenshot(animations='disabled'))).convert('RGB')
     for name in ['Y1T1T','Y1T','X1T','53T','51AT']:
      label=page.locator(scope+f' text[data-circuit-label="{name}"]');box=label.bounding_box();assert box and box['width']>5 and box['height']>5
      assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height,box
      crop=screenshot.crop((math.floor(box['x']),math.floor(box['y']),math.ceil(box['x']+box['width']),math.ceil(box['y']+box['height'])))
      assert sum(max(rgb)<90 for rgb in crop.getdata())>=5,(width,name,'missing rendered ink')
   for position in ['N','R']:
    page.evaluate("pos=>{SimRemote.command({type:'control',station:'yongsan',action:{type:'mode',value:'CCM'}});for(const id of Object.keys(SimCore.forStation('yongsan').points)){const r=SimRemote.command({type:'control',station:'yongsan',action:{type:'point',id,value:pos}});if(!r.ok)throw Error(r.message)}render()}",position)
    verify('#trackSvg',pixels=True)
    for region in ['north','all']:
     page.locator('.ls-head').click(button='right',position={'x':12,'y':12});page.locator('[data-context-action=overview]').hover();page.locator('[data-context-action=overview-'+region+']').click()
     verify('#lsOverview [data-overview-detail=yongsan]');page.click('#lsOverviewClose')
   assert not errors,errors;page.close();print('PASS 55 Yongsan source labels, five missing-label pixel checks, N/R and both overviews',width,flush=True)
  browser.close()
finally:server.shutdown()

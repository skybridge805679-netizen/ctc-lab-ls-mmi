"""Verify all station/corridor label geometry, then operate relocated signal names."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from tempfile import TemporaryDirectory
import json,subprocess,sys
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
with TemporaryDirectory(prefix='orpheia-layout-') as out:
 subprocess.run([sys.executable,str(ROOT.parent/'tools/audit-ls-layout.py'),'--out',out,'--check'],check=True)
 rows=json.loads((Path(out)/'audit.json').read_text())
 assert len(rows)==18*3*2
 assert len({r['preset'] for r in rows})==18
 assert all(not r['issues'] for r in rows)
 for preset in {r['preset'] for r in rows}:
  cases=[r for r in rows if r['preset']==preset]
  assert len({r['signals'] for r in cases})==1
  assert len({tuple(sorted(r['parts'])) for r in cases})==1
  assert len({tuple(sorted(r['trainWindows'])) for r in cases})==1
  assert len({tuple(sorted((b['id'],b['code'],b['number']) for b in r['blocks'])) for r in cases})==1
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce');page.add_init_script('window.open=()=>null')
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true})")
   for station,signal in [('yongsan','2A'),('guro','4A'),('guro','54')]:
    page.evaluate('id=>{selectStation(id);SimRemote.command({type:"control",station:id,action:{type:"mode",value:"CCM"}});render()}',station)
    label=page.locator(f'[data-label-kind="signal"][data-label-id="{signal}"]');b=label.bounding_box()
    page.mouse.click(b['x']+b['width']/2,b['y']+b['height']/2)
    expect(page.locator('#actionDialog')).to_be_visible()
    choices=page.locator('[data-route-choice]').evaluate_all('es=>es.map(e=>e.dataset.routeChoice)')
    assert choices and all(c.startswith(signal+'-') for c in choices),(station,signal,choices)
    page.keyboard.press('Escape')
   page.evaluate("selectStation('suwon')")
   expect(page.locator('[data-circuit-label="80T"]')).to_have_count(0)
   expect(page.locator('[data-circuit-label="30T"]')).to_have_count(1)
   # A legitimate source name resembling an OCR anomaly remains intact.
   page.evaluate("selectStation('geumcheon')")
   expect(page.locator('[data-circuit-label="28T"]')).to_have_count(1)
   page.close()
  browser.close()
 print('PASS 108 layout cases preserve every control/window/block identity; relocated names open the correct signal menu; source-verified 30T correction')
finally:server.shutdown()

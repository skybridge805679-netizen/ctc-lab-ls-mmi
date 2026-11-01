"""Desktop control removal, direct station tabs, annotation identity and browser factory reset."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce');errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null')
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   page.evaluate("SimRemote.command({type:'clock',paused:true})")
   expect(page.locator('#lsStationSelect,#previousStation,#nextStation,#guideBtn,#exportBtn,.mmi-appbar')).to_have_count(0)
   expect(page.locator('#stationTabs [data-view]')).to_have_count(15)
   assert page.locator('#stationTabs button').first.bounding_box()['height']>=44
   for station in page.locator('#stationTabs [data-view]').evaluate_all('es=>es.map(e=>e.dataset.view)'):
    page.locator(f'#stationTabs [data-view="{station}"]').click()
    expect(page.locator('#lsStage')).to_have_attribute('data-preset',station)
    assert page.locator('#stationTabs .selected').get_attribute('data-view')==station
    assert page.locator('#trackSvg [data-signal]').count()>0,station
    parts=page.locator('#trackSvg [data-point-control]').evaluate_all("es=>es.map(e=>e.dataset.pointControl).filter(s=>/^\\d+[AB]$/.test(s))")
    assert len(parts)==len(set(parts)),(station,'duplicate switch part')
    expected_parts=page.evaluate('(id)=>Object.keys(SimCore.forStation(id).pointParts)',station)
    assert set(parts)==set(expected_parts),(station,'missing switch part',set(expected_parts)-set(parts))
    box=page.locator('#trackSvg').bounding_box();footer=page.locator('.ls-bottom').bounding_box()
    assert box['y']+box['height']<=footer['y']+1,(station,box,footer)
    assert footer['y']+footer['height']<=height+1
   page.locator('#stationTabs [data-view="yongsan"]').click()
   assert page.locator('[data-circuit-label="23AT"]').count()==1
   if width==1920:page.screenshot(path=str(ROOT.parent/'docs/preview-v0.38.0-ls.png'),animations='disabled')
   # Yellow arrows, not removed footer controls, retain access to all monitoring presets.
   for main,corridor in [('anyang','anyang-geumjeong'),('gunpo','gunpo-uiwang'),('uiwang','uiwang-suwon')]:
    page.locator(f'#stationTabs [data-view="{main}"]').click()
    page.locator(f'[data-nav-view="{corridor}"]').click()
    expect(page.locator('#lsStage')).to_have_attribute('data-preset',corridor)
    assert page.locator('#trackSvg [data-train-slot]').count()>0
    expect(page.locator('#resetBtn')).to_be_visible()
   page.evaluate("localStorage.setItem('ctclab-v03-completed','[1]');sessionStorage.setItem('old-draft','old');SimRemote.command({type:'tick',seconds:100});SimRemote.command({type:'control',station:'anyang',action:{type:'mode',value:'CCM'}})")
   before=page.evaluate('SimRemote.snapshot.states.anyang.clock')
   page.once('dialog',lambda d:d.dismiss());page.click('#resetBtn')
   assert page.evaluate('SimRemote.snapshot.states.anyang.clock')==before
   page.once('dialog',lambda d:d.accept());page.click('#resetBtn')
   page.wait_for_function("window.SimRemote?.snapshot.states.anyang.clock===0&&!window.SimResetting")
   assert page.evaluate('SimRemote.snapshot.clock.paused')
   assert page.evaluate('SimRemote.snapshot.states.anyang.mode')=='AUTO'
   assert page.evaluate("localStorage.getItem('ctclab-v03-completed')") is None
   assert page.evaluate("sessionStorage.getItem('old-draft')") is None
   assert not errors,errors
   page.close();print(f'PASS desktop UI cleanup: all 15 stations, 3 corridors, unique parts, readable footer and complete browser reset at {width}x{height}')
  browser.close()
finally:server.shutdown()

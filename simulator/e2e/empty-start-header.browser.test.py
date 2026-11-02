"""Desktop empty startup, explicit online schedule input, reset, and uniform LS navigation."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json,os
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT.parent/'docs/layout-review-v0.39.0'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
rows=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null')
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true})")
   assert page.evaluate('SimRemote.snapshot.timetable.trains.length')==0
   assert page.evaluate('SimRemote.snapshot.fts.session') is None
   expect(page.locator('.fidelity-note,.platform-legend')).to_have_count(0)
   for view in page.evaluate('SimLSPresets.list()'):
    page.evaluate('id=>selectStation(id)',view['id'])
    m=page.evaluate('''()=>{const b=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {head:b(document.querySelector('.ls-head')),mode:document.querySelector('.ls-modes')&&b(document.querySelector('.ls-modes')),arrows:[...document.querySelectorAll('.ls-nav [data-nav-side]')].map(e=>({side:e.dataset.navSide,target:e.dataset.navView,b:b(e.querySelector('polygon'))})),controls:[...document.querySelectorAll('.ls-controls>div,.ls-controls>button')].map(b),nav:[...document.querySelectorAll('.ls-nav')].map(b)}}''')
    for arrow in m['arrows']:
     a=arrow['b'];assert abs(a['y']+a['h']/2-(m['head']['y']+m['head']['h']/2))<1,(view,m)
     if m['mode']:assert abs(a['y']+a['h']/2-(m['mode']['y']+m['mode']['h']/2))<1,(view,m)
    for c in m['controls']:
     assert c['x']>=m['nav'][0]['x']+m['nav'][0]['w']-1 and c['x']+c['w']<=m['nav'][1]['x']+1,(view,m)
    rows.append({'viewport':width,'view':view['id'],**m})
    if view['id']=='cheongnyangni':
     names=page.locator('.seam-name').all_text_contents();assert set(names)=={'하2선','상2선'},names
    if os.environ.get('UPDATE_DOCS_PREVIEWS')=='1' and width==1920 and view['id'] in ['cheongnyangni','dongmyo','yongsan','guro','uiwang-suwon']:
     OUT.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(OUT/(view['id']+'.png')),animations='disabled')
   # Both click and keyboard navigation retain the original station destinations.
   page.evaluate("selectStation('dongmyo')");page.locator('[data-nav-side=left]').click();expect(page.locator('#lsStage')).to_have_attribute('data-preset','cheongnyangni')
   page.locator('[data-nav-side=right]').focus();page.keyboard.press('Enter');expect(page.locator('#lsStage')).to_have_attribute('data-preset','dongmyo')
   # Add a train through the actual online schedule form and pattern picker, starting empty.
   page.evaluate("SimMMI.open('schedule')")
   page.locator('input[name=scheduleMode][value=create]').check();page.fill('#scheduleNumber','C4201');page.click('#schedulePatternOpen')
   page.click('[data-pl=find]');page.locator('[data-pl-id]').first.click();page.select_option('[data-pl=from]','yongsan');page.select_option('[data-pl=to]','suwon');page.click('[data-pl=ok]')
   page.click('#scheduleApply');expect(page.locator('#mmiAlertOk')).to_be_visible();page.click('#mmiAlertOk')
   assert page.evaluate('SimRemote.snapshot.timetable.trains.map(t=>t.id)')==['C4201']
   page.evaluate("SimMMI.close('schedule')")
   # Reset warns that the result is empty, rather than restoring a sample timetable.
   dialogs=[]
   def accept(dialog):
    dialogs.append(dialog.message);dialog.accept()
   page.once('dialog',accept);page.click('#resetBtn');page.wait_for_function("window.SimRemote?.snapshot.states.anyang.clock===0&&!window.SimResetting")
   assert dialogs and '빈 상태' in dialogs[0] and '기본 시간표' not in dialogs[0]
   assert page.evaluate('SimRemote.snapshot.timetable.trains.length')==0
   assert page.evaluate('SimRemote.snapshot.fts.session') is None
   assert page.evaluate('SimRemote.snapshot.ftsLibrary.scenarios.length')>0
   # FTS stores all 19 schedule presets without inserting them into the live timetable.
   page.evaluate('SimFTSUI.open()');page.locator('[data-fts-page=situations]').first.click()
   expect(page.locator('#schTable tr[data-key]')).to_have_count(19)
   schedule=page.evaluate("SimRemote.snapshot.ftsLibrary.problems.find(p=>p.id==='P-yongsan-5').setup.scheduleId")
   assert len(schedule)==5 and schedule.isdigit()
   page.locator(f'#schTable tr[data-key="{schedule}"]').click()
   if os.environ.get('UPDATE_DOCS_PREVIEWS')=='1' and width==1920:page.screenshot(path=str(OUT/'fts-schedules.png'),animations='disabled')
   page.click('#schEdit');page.click('#mmiAlertOk')
   assert len(page.evaluate('SimRemote.snapshot.timetable.trains'))==4
   calls=page.evaluate('SimRemote.snapshot.timetable.trains')
   page.click('#schApply');page.click('#mmiAlertOk')
   assert page.evaluate('id=>SimRemote.snapshot.ftsLibrary.schedules.find(s=>s.id===id).relative',schedule) is False
   assert page.evaluate('id=>SimRemote.snapshot.ftsLibrary.schedules.find(s=>s.id===id).timetable.trains',schedule)==calls
   assert not errors,errors
   page.close();print('PASS empty startup, online timetable input, full reset and 18 uniform arrow headers',width,flush=True)
  browser.close()
 if os.environ.get('UPDATE_DOCS_PREVIEWS')=='1':(OUT/'header-metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
finally:server.shutdown()

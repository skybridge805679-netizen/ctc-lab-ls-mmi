"""Desktop LS context menus: real pointer/keyboard actions and shared-state preservation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1100}); errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   # this test deliberately stacks several numbers in one 열번창; acknowledge the resulting 열차번호 중복 alarm pop-ups as they appear
   page.add_init_script("window.addEventListener('DOMContentLoaded',()=>setInterval(()=>document.querySelector('.mmi-alarm:not([hidden]) [data-alarm-ok]')?.click(),40))")
   page.on('response',lambda r:errors.append(f'HTTP {r.status} {r.url}') if r.status>=400 else None)
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle')
   page.select_option('#stationSelect','geumcheon')
   def win(slot): return page.locator(f'#trackSvg [data-train-slot="{slot}"]')
   def action(name): return page.locator(f'.ls-context-menu [data-context-action="{name}"]')
   def background(): page.locator('.fidelity-note').click(button='right')
   def confirm(): page.click('#dialogConfirm'); expect(page.locator('#actionDialog')).not_to_be_visible(); page.wait_for_function('dialogAction===null')
   def cancel(): page.locator('#actionDialog [value="cancel"]').click(); expect(page.locator('#actionDialog')).not_to_be_visible(); page.wait_for_function('dialogAction===null')
   def entries(slot,station='geumcheon'): return page.evaluate('([s,k])=>SimLSUI.getModel().stations[s].windows[k]||[]',[station,slot])
   def branch(slot,command,index=0):
    win(slot).click(button='right'); action(command).hover()
    action(command).locator('..').locator('.ls-submenu button').nth(index).click()
   def add(slot,number):
    win(slot).click(button='right'); action('train-add' if entries(slot) else 'train-input').click()
    page.fill('#lsTrainNumber',number); confirm()
   background()
   expect(page.locator('.ls-menu-items > .ls-menu-row')).to_have_count(6)
   action('boards').hover(); expect(action('board-5')).to_be_visible()
   page.keyboard.press('Escape'); expect(page.locator('.ls-context-menu')).to_have_count(0)
   win('B965T').focus(); page.keyboard.press('Shift+F10'); expect(action('train-input')).to_be_visible(); action('train-input').click()
   page.fill('#lsTrainNumber','INVALID'); page.click('#dialogConfirm'); expect(page.locator('#actionDialog')).to_be_visible(); cancel(); assert entries('B965T')==[]
   add('B965T','k1234'); expect(win('B965T').locator('text')).to_have_text('<K1234')
   add('B965T','K5678'); assert len(entries('B965T'))==2
   branch('B965T','train-rename',1); page.fill('#lsTrainNumber','G1000'); page.select_option('#lsTrainDirection','down'); confirm()
   assert [t['number'] for t in entries('B965T')]==['K1234','G1000'],entries('B965T')
   branch('B965T','train-delete'); cancel(); assert len(entries('B965T'))==2
   branch('B965T','train-move'); page.keyboard.press('Escape'); win('B967T').click(); assert entries('B967T')==[]
   branch('B965T','train-move'); win('B967T').click(); confirm(); assert entries('B967T')[0]['number']=='K1234'
   add('B967T','G2000')
   branch('B965T','train-swap'); win('B967T').click(); page.select_option('#lsSwapNumber',entries('B967T')[1]['uid']); confirm()
   assert entries('B965T')[0]['number']=='G2000'; assert [t['number'] for t in entries('B967T')]==['K1234','G1000']
   branch('B967T','train-delete',1); confirm(); assert len(entries('B967T'))==1
   win('B967T').click(button='right'); action('train-properties').click(); expect(page.locator('.ls-properties')).to_contain_text('K1234'); confirm()
   # Cross-station move uses the destination station's visible window, not a stale source slot.
   branch('B965T','train-move'); page.select_option('#stationSelect','anyang')
   target=page.locator('#trackSvg [data-train-slot]').first.get_attribute('data-train-slot')
   win(target).click(); confirm(); assert entries(target,'anyang')[0]['number']=='G2000'
   page.select_option('#stationSelect','geumcheon')
   # Six signs are selectable; user text remains text, drag/fix/delete are functional.
   for i in range(6):
    background(); action('boards').hover(); action(f'board-{i}').click(); page.fill('#lsBoardText','25' if i==5 else ('작업 <주의>' if i==4 else f'표지{i}')); confirm()
   boards=lambda:page.evaluate('SimLSUI.getModel().stations.geumcheon.boards')
   assert len(boards())==6
   bid=boards()[4]['id']; board=lambda:page.locator(f'#trackSvg [data-ls-board="{bid}"]')
   # Separate overlapping signs through model-backed rendering, then exercise real pointer drag.
   page.evaluate("""()=>{SimLSUI.getModel().stations.geumcheon.boards.forEach((b,i)=>SimLSUI.dispatch({op:'boardMove',station:'geumcheon',id:b.id,x:30+i*190,y:30}));render()}""")
   board().dblclick(position={'x':35,'y':35}); page.fill('#lsBoardText','작업 확인'); confirm(); assert boards()[4]['text']=='작업 확인'
   before=boards()[4].copy(); box=board().bounding_box(); page.mouse.move(box['x']+25,box['y']+30); page.mouse.down(); page.mouse.move(box['x']+45,box['y']+130,steps=5); page.mouse.up(); assert boards()[4]['x']>before['x']
   board().click(button='right',position={'x':30,'y':30}); action('board-fix').click(); assert boards()[4]['fixed']
   before=boards()[4].copy(); box=board().bounding_box(); page.mouse.move(box['x']+25,box['y']+30); page.mouse.down(); page.mouse.move(box['x']+45,box['y']+130,steps=5); page.mouse.up(); assert boards()[4]==before
   board().click(button='right',position={'x':30,'y':30}); action('board-delete').click(); cancel(); assert len(boards())==6
   board().locator('[data-board-close]').click(); confirm(); assert len(boards())==5
   # Use a real route, then verify display operations do not change its route/point/occupancy state.
   page.locator('#lsStage [data-mode="CCM"]').click(); confirm()
   page.locator('#lsStage [data-signal="1A"]').click(); page.locator('[data-route-choice]').first.click()
   snapshot=lambda:page.evaluate('JSON.stringify({routes:state.routes,points:state.points,occupied:state.occupied})')
   before=snapshot(); display=page.evaluate('JSON.stringify(SimLSUI.getModel())')
   for scan in ['scan-current','scan-all']:
    background(); action(scan).click(); confirm(); assert snapshot()==before
   background(); action('restart').click(); assert snapshot()==before; assert page.evaluate('JSON.stringify(SimLSUI.getModel())')==display
   page.evaluate('()=>{window.printCalls=0;window.print=()=>window.printCalls++}'); background(); action('print').click(); assert page.evaluate('printCalls')==1
   background(); action('overview').hover(); action('overview-all').click()
   expect(page.locator('[data-overview-station]')).to_have_count(15)
   expect(page.locator('[data-overview-station="geumcheon"] [data-train-slot="B967T"] text')).to_have_text('<K1234')
   assert page.locator('[data-overview-station="geumcheon"] [data-ls-board]').count()==5
   page.locator('[data-overview-station="anyang"]').click(); expect(page.locator('#stationSelect')).to_have_value('anyang'); assert page.evaluate('JSON.stringify({routes:stationStates.geumcheon.routes,points:stationStates.geumcheon.points,occupied:stationStates.geumcheon.occupied})')==before
   # Every station has visible windows; placement must not cover rails, signals, labels or platforms.
   total=0
   for station in page.locator('#stationSelect option').evaluate_all('(os)=>os.map(o=>o.value)'):
    page.select_option('#stationSelect',station); total+=page.locator('#trackSvg [data-train-slot]').count()
    overlaps=page.evaluate("""()=>{const svg=document.querySelector('#trackSvg'),bs=[...svg.querySelectorAll('.signal .sig-name,.signal .lamp,.annotation,.inter-station .plate,.platform,[data-source-symbol] path')].map(e=>e.getBBox());return [...svg.querySelectorAll('[data-train-slot] > rect')].filter(e=>{const a=e.getBBox();return bs.some(b=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)}).map(e=>e.parentNode.dataset.trainSlot)}""")
    assert not overlaps,(station,overlaps)
    checks=page.evaluate('''()=>{const lanes={};for(const g of document.querySelectorAll('#trackSvg [data-train-slot]')){const y=+g.dataset.windowRailY,b=g.querySelector('rect').getBBox();if(g.dataset.windowSide==='inline'){if(!(b.y<y&&b.y+b.height>y))return false;}else{const k=y.toFixed(0)+g.dataset.windowSide;if(k in lanes&&Math.abs(lanes[k]-b.y)>.1)return false;lanes[k]=b.y;}}return true}''')
    assert checks,station+' window baseline/inline geometry'
    pairs=page.evaluate('''()=>{const ws=[...document.querySelectorAll('#trackSvg [data-train-slot]')].map(e=>({id:e.dataset.trainSlot,b:e.querySelector('rect').getBBox()})),bad=[];for(let i=0;i<ws.length;i++)for(let j=i+1;j<ws.length;j++){const a=ws[i].b,b=ws[j].b;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5)bad.push([ws[i].id,ws[j].id]);}return bad}''')
    assert not pairs,(station,'overlapping train windows',pairs)
   assert total==276,total
   # Mouse menu placement at the viewport edge keeps its entire submenu visible.
   page.select_option('#stationSelect','jonggak'); background(); action('boards').hover()
   bounds=action('boards').locator('..').locator('.ls-submenu').bounding_box(); assert bounds['x']>=0 and bounds['x']+bounds['width']<=width
   if width==1440:
    page.screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-context-background.png'))
    page.keyboard.press('Escape'); page.select_option('#stationSelect','geumcheon'); win('B967T').click(button='right'); action('train-move').hover(); page.screenshot(path=str(ROOT.parent/'docs/preview-v0.16.0-context-train.png'))
   assert not errors,errors
   print(f'PASS LS menus: input/edit/delete/move/swap, signs, scan/restart/print/Overview, {total} windows: {width}px',flush=True)
   page.close()
  browser.close()
finally:
 server.shutdown();server.server_close()

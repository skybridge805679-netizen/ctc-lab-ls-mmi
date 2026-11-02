"""Connected overview keeps live train numbers, scoped SVGs and read-only navigation on desktop."""
from functools import partial
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import os,json
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=b.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{s.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true})")
   def check_fill(expected_rows):
    layout=page.locator('.overview-network').evaluate("""e=>{
     const canvas=e.parentElement.getBoundingClientRect(),vb=e.viewBox.baseVal;
     const rows=Array.from({length:3},(_,i)=>[...e.querySelectorAll('[data-overview-row="'+i+'"]')]).filter(es=>es.length).map(es=>{const bs=es.map(e=>e.getBoundingClientRect());return {ids:es.map(e=>e.dataset.overviewStation),left:Math.min(...bs.map(b=>b.left)),right:Math.max(...bs.map(b=>b.right)),top:Math.min(...bs.map(b=>b.top)),bottom:Math.max(...bs.map(b=>b.bottom))}});
     return {aspect:vb.width/vb.height,canvas:{left:canvas.left,right:canvas.right,top:canvas.top,bottom:canvas.bottom,width:canvas.width,height:canvas.height},rows};
    }""")
    c=layout['canvas'];assert abs(layout['aspect']-c['width']/c['height'])<.001,layout
    assert [r['ids'] for r in layout['rows']]==expected_rows,layout
    for r in layout['rows']:
     assert (r['right']-r['left'])/c['width']>.95,layout
     assert r['top']>=c['top'] and r['bottom']<=c['bottom'],layout
    first,last=layout['rows'][0],layout['rows'][-1]
    assert abs((first['top']-c['top'])-(c['bottom']-last['bottom']))<25,layout
   regions={'north':[['cheongnyangni','dongmyo','jonggak','underground-seoul','seoul'],['yongsan','noryangjin','yeongdeungpo']], 'south':[['guro','geumcheon','anyang','geumjeong'],['gunpo','uiwang','suwon']], 'central':[['noryangjin','yeongdeungpo','guro','geumcheon']]}
   def show(kind='all'):
    page.locator('#trackSvg').click(button='right',position={'x':12,'y':12});page.locator('[data-context-action=overview]').hover();page.locator(f'[data-context-action=overview-{kind}]').click()
   show();check_fill([regions['north'][0],['yongsan','noryangjin','yeongdeungpo','guro','geumcheon'],['anyang','geumjeong','gunpo','uiwang','suwon']]);expect(page.locator('#lsOverview [data-overview-station]')).to_have_count(18);expect(page.locator('#lsOverview [data-overview-detail]')).to_have_count(15);expect(page.locator('#lsOverview [data-overview-link]')).to_have_count(40)
   assert page.locator('#lsOverview .ls-overview-grid,.ls-overview-station').count()==0
   metrics=page.locator('.overview-network').evaluate('e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}}');assert metrics['x']>=0 and metrics['right']<=width and metrics['bottom']<=height,metrics
   ids=page.locator('#lsOverview [id]').evaluate_all('es=>es.map(e=>e.id)');assert len(ids)==len(set(ids))
   # Live changes appear during the modal; the SVG remains a projection of the same engine.
   page.evaluate("()=>{const r=SimRemote.command({type:'numbers',action:{op:'insert',station:'geumcheon',slot:'B967T',number:'K1234',direction:'up'}});if(!r.ok)throw Error(r.message)}")
   expect(page.locator('#lsOverview [data-overview-station=geumcheon] [data-train-slot=B967T] text')).to_have_text('<K1234')
   snapshot=page.evaluate('JSON.stringify({states:SimRemote.snapshot.states,ls:SimRemote.snapshot.ls,timetable:SimRemote.snapshot.timetable})')
   page.locator('#lsOverview [data-overview-station=anyang-geumjeong]').focus();page.wait_for_timeout(1200);assert page.evaluate("document.activeElement.dataset.overviewStation")=='anyang-geumjeong';page.keyboard.press('Enter');expect(page.locator('#lsOverview')).not_to_be_visible();expect(page.locator('#lsStage')).to_have_attribute('data-preset','anyang-geumjeong')
   assert page.evaluate('JSON.stringify({states:SimRemote.snapshot.states,ls:SimRemote.snapshot.ls,timetable:SimRemote.snapshot.timetable})')==snapshot
   # Monitor context has direct access to all views; return to a controlled view to test regions.
   page.evaluate("selectStation('guro')")
   for name,count,links in [('north',8,16),('south',10,20),('central',4,12)]:
    show(name);check_fill(regions[name]);expect(page.locator('#lsOverview [data-overview-station]')).to_have_count(count);expect(page.locator('#lsOverview [data-overview-link]')).to_have_count(links);
    if width==1920 and os.environ.get('UPDATE_DOCS_PREVIEWS')=='1':
     page.mouse.move(0,0);page.screenshot(path=str(ROOT.parent/f'docs/layout-review-v0.39.1/overview-{name}.png'),animations='disabled')
    page.click('#lsOverviewClose')
   if width==1920 and os.environ.get('UPDATE_DOCS_PREVIEWS')=='1':
    show();page.mouse.move(0,0);page.screenshot(path=str(ROOT.parent/'docs/layout-review-v0.39.1/overview.png'),animations='disabled');page.click('#lsOverviewClose')
   assert not errors,errors;page.close();print('PASS connected overview, live train numbers, keyboard focus, all regions and unchanged engine state',width,flush=True)
  b.close()
finally:s.shutdown()

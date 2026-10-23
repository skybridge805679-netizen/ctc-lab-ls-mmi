"""Desktop source-symbol regression: opposing brackets and legible yard captions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1100});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
   for sid in page.locator('#stationSelect option').evaluate_all('(es)=>es.map(e=>e.value)'):
    page.select_option('#stationSelect',sid)
    expect(page.locator('[data-source-bracket]')).to_have_count({'guro':4,'noryangjin':2}.get(sid,0))
    expect(page.locator('[data-source-caption]')).to_have_count({'guro':1,'dongmyo':2,'uiwang':2}.get(sid,0))
    result=page.evaluate('''()=>{
     const svg=document.querySelector('#trackSvg'),vb=svg.viewBox.baseVal;
     const brackets=[...svg.querySelectorAll('[data-source-bracket]')];
     const captions=[...svg.querySelectorAll('[data-source-caption]')];
     const hit=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1;
     const clips=[],overlaps=[];
     const alignedPairs=[['gunja-out','gunja-in'],['freight-a','freight-b']];
     for(const [first,second] of alignedPairs){
      const a=svg.querySelector(`[data-source-caption="${first}"]`),b=svg.querySelector(`[data-source-caption="${second}"]`);
      if(a&&b){const x=a.getBBox(),y=b.getBBox();if(Math.abs(x.x-y.x)>.1||Math.abs(x.width-y.width)>.1)overlaps.push(['caption-alignment',first,second]);}
     }
     for(const el of brackets)if(Math.abs(el.getBBox().width-28)>.1)overlaps.push(['bracket-width',el.dataset.sourceBracket]);
     for(const el of [...brackets,...captions]){
      const a=el.getBBox();if(a.x<0||a.y<0||a.x+a.width>vb.width||a.y+a.height>vb.height)clips.push(el.dataset);
      for(const other of svg.querySelectorAll('text,.ls-train-slot'))if(!el.contains(other)&&hit(a,other.getBBox()))overlaps.push([el.dataset,other.textContent||other.dataset.windowCode]);
     }
     return {clips,overlaps,bracketsNative:brackets.every(e=>e.querySelectorAll('path').length===2&&getComputedStyle(e).pointerEvents==='none')};
    }''')
    assert result=={'clips':[],'overlaps':[],'bracketsNative':True},(width,sid,result)
    if sid in ['guro','noryangjin','dongmyo','uiwang'] and width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/f'docs/preview-v0.18.2-{sid}.png'))
   page.select_option('#stationSelect','guro')
   expect(page.locator('[data-source-caption="depot-lead"]')).to_have_text('차량기지입출고선')
   before=page.locator('[data-source-bracket="52BT-52B"]').evaluate('(el)=>el.outerHTML')
   page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm')
   page.locator('[data-signal="4A"]').click();page.locator('[data-route-choice="4A-B950T"]').click()
   expect(page.locator('[data-source-bracket="52BT-52B"]')).to_have_count(1)
   assert page.locator('[data-source-bracket="52BT-52B"]').evaluate('(el)=>el.outerHTML')==before
   assert page.locator('[data-track-state="set"]').count()>0
   assert not errors,errors
   page.close();print(f'PASS {width}px: 15 stations, 6 native bracket pairs, 5 yard captions, no overlap/clipping and route controls preserved')
  browser.close()
finally:server.shutdown();server.server_close()

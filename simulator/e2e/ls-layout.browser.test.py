"""Measure real text boxes in the browser for every station, including reverse switch labels."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':1000})
   page.goto(f'http://127.0.0.1:{server.server_port}');page.wait_for_load_state('networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
   stations=page.locator('#stationSelect option').evaluate_all('(es)=>es.map(e=>e.value)')
   for station in stations:
    page.select_option('#stationSelect',station)
    for reverse in [False,True]:
     if reverse:
      page.evaluate('''id=>{const st=SimNetwork.catalog[id],C=SimCore.forStation(id),s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});for(const id of Object.keys(C.points))C.dispatch(s,{type:'point',id,value:'R'});const v=SimLS.render(st,SimWiring.data[id],C,s);document.querySelector('#trackSvg').innerHTML=v.svg;}''',station)
     result=page.evaluate('''()=>{
      const svg=document.querySelector('#trackSvg'),v=svg.viewBox.baseVal;
      const texts=[...svg.querySelectorAll('text')].map(e=>({name:e.textContent,b:e.getBBox()}));
      const overlaps=[],clipped=[];
      for(let i=0;i<texts.length;i++){
       const a=texts[i].b;if(a.x<0||a.y<0||a.x+a.width>v.width+1||a.y+a.height>v.height+1)clipped.push(texts[i].name);
       for(let j=i+1;j<texts.length;j++){const b=texts[j].b;
        if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)overlaps.push([texts[i].name,texts[j].name]);
       }
      }return {overlaps,clipped};}''')
     assert result=={'overlaps':[],'clipped':[]},(width,station,reverse,result)
     expect(page.locator('#trackSvg .point-tag rect, #trackSvg .bed-outer, #trackSvg .wing-outer')).to_have_count(0)
   page.close();print(f'PASS {width}px: every text label at all 15 stations is separate and inside the canvas in N/R states')
  browser.close()
finally:server.shutdown();server.server_close()

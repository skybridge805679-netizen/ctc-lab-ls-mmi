"""Pixel-check every geometric crossover in all four point combinations and desktop sizes."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright
import json,os
ROOT=Path(__file__).resolve().parent.parent
PAIRS=[('cheongnyangni','51','52'),('jonggak','51','52'),('underground-seoul','21','22'),('seoul','58','59'),('seoul','52','53'),('yeongdeungpo','52','53'),('guro','53','54'),('geumcheon','21','22')]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();rows=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1280,800),(1440,1000),(1920,1080)]:
   page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.evaluate("SimRemote.command({type:'clock',paused:true})")
   for station,a,b in PAIRS:
    for state in ['NN','RN','NR','RR']:
     page.evaluate('''([station,a,b,state])=>{selectStation(station);const command=action=>{const r=SimRemote.command({type:'control',station,action});if(!r.ok)throw Error(r.message);};if(SimField.state(station).mode!=='CCM')command({type:'mode',value:'CCM'});for(const id of Object.keys(SimField.state(station).points))command({type:'point',id,value:id===a?state[0]:id===b?state[1]:'N'});render();}''',[station,a,b,state])
     data=page.evaluate(r'''([a,b])=>{const read=id=>{const e=document.querySelector(`[data-switch-connection="${id}"]`);return {position:e.dataset.position};};const diamond=document.querySelector(`[data-crossing-diamond="${a}-${b}"]`),centre=diamond.dataset.crossingCentre.split(',').map(Number),m=document.querySelector('#trackSvg').getScreenCTM(),screen=p=>({x:m.a*p[0]+m.e,y:m.d*p[1]+m.f});return {centre:screen(centre),a:read(a),b:read(b),quarters:[...diamond.querySelectorAll('[data-crossing-quarter]')].map(e=>{const pts=[...e.points].map(p=>[p.x,p.y]);return {name:e.dataset.crossingQuarter,vertices:pts.length,...screen([pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length])};})};}''',[a,b])
     assert data['a']['position']==state[0] and data['b']['position']==state[1]
     assert len(data['quarters'])==4 and all(q['vertices']==4 for q in data['quarters'])
     samples=[data['centre'],*data['quarters']];x=max(0,int(min(p['x'] for p in samples))-3);y=max(0,int(min(p['y'] for p in samples))-3)
     clip={'x':x,'y':y,'width':int(max(p['x'] for p in samples))-x+4,'height':int(max(p['y'] for p in samples))-y+4}
     im=Image.open(BytesIO(page.screenshot(clip=clip,animations='disabled'))).convert('RGB')
     def whites(point):
      cx=int(point['x'])-x;cy=int(point['y'])-y
      return sum(min(im.getpixel((cx+dx,cy+dy)))>220 for dx in [-1,0,1] for dy in [-1,0,1])
     counts=[whites(p) for p in samples]
     assert counts[0]==0 and all(n>=7 for n in counts[1:]),(station,a,b,state,width,counts)
     rows.append({'station':station,'points':[a,b],'state':state,'viewport':width,'centreWhitePixels':counts[0],'quarterWhitePixels':counts[1:],'samplesPerPatch':9,'trapezoids':4})
   # Reference-specific checks: the ordinary Seoul 54 crossover must have air at both ends,
   # and the surveyed return rail must have square, snapped corners.
   page.evaluate("()=>{selectStation('seoul');for(const id of Object.keys(SimField.state('seoul').points))SimRemote.command({type:'control',station:'seoul',action:{type:'point',id,value:'N'}});render();}")
   checks=page.evaluate(r'''()=>{const svg=document.querySelector('#trackSvg'),m=svg.getScreenCTM(),screen=p=>({x:m.a*p[0]+m.e,y:m.d*p[1]+m.f}),c=document.querySelector('[data-switch-connection="54"]').dataset.switchEndpoints.split(';').map(s=>s.split(',').map(Number)),points=c.map((p,i)=>{const q=c[1-i],dy=q[1]-p[1],t=10.5/Math.abs(dy);return screen([p[0]+(q[0]-p[0])*t,p[1]+dy*t]);}),rail=document.querySelector('[data-reviewed-join="0"]'),v=rail.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),native=document.querySelector('.rail-network').children[2].getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return {air:points,corners:[screen([v[2]+7,v[3]-7]),screen([v[4]-7,v[5]+7])],join:getComputedStyle(rail).strokeLinejoin,snapped:v[5]===native[1]};}''')
   assert checks['join']=='miter' and checks['snapped'],checks
   for point in checks['air']:
    im=Image.open(BytesIO(page.screenshot(clip={'x':int(point['x']),'y':int(point['y']),'width':1,'height':1},animations='disabled'))).convert('RGB');assert min(im.getpixel((0,0)))<220,('crossover touches parent',width,checks)
   for point in checks['corners']:
    im=Image.open(BytesIO(page.screenshot(clip={'x':int(point['x'])-1,'y':int(point['y'])-1,'width':3,'height':3},animations='disabled'))).convert('RGB');assert sum(min(im.getpixel((x,y)))>220 for x in range(3) for y in range(3))>=7,('bevelled corner',width,checks)
   # Route colour follows the selected pair continuously across the central separator.
   page.evaluate('''()=>{selectStation('seoul');const command=a=>{const r=SimRemote.command({type:'control',station:'seoul',action:a});if(!r.ok)throw Error(r.message);};if(SimField.state('seoul').mode!=='CCM')command({type:'mode',value:'CCM'});for(const id of Object.keys(SimField.state('seoul').points))command({type:'point',id,value:'N'});command({type:'route',id:'4C-B902T'});render();}''')
   centre=page.evaluate('''()=>{const c=document.querySelector('[data-crossing-diamond="58-59"]').dataset.crossingCentre.split(',').map(Number),m=document.querySelector('#trackSvg').getScreenCTM();return {x:m.a*c[0]+m.e,y:m.d*c[1]+m.f};}''')
   im=Image.open(BytesIO(page.screenshot(clip={'x':int(centre['x'])-1,'y':int(centre['y'])-1,'width':3,'height':3},animations='disabled'))).convert('RGB')
   assert sum(im.getpixel((x,y))[1]>150 and im.getpixel((x,y))[0]<120 for x in range(3) for y in range(3))>=7
   if os.environ.get('UPDATE_DOCS_PREVIEWS')=='1' and width==1920:page.screenshot(path=str(ROOT.parent/'docs/layout-review-v0.39.1/selected-route.png'),animations='disabled')
   assert not errors,errors
   page.close();print('PASS 8 crossing pairs × NN/RN/NR/RR with four trapezoids and real screen pixels',width,flush=True)
  browser.close()
 if os.environ.get('UPDATE_DOCS_PREVIEWS')=='1':
  out=ROOT.parent/'docs/layout-review-v0.39.1';out.mkdir(parents=True,exist_ok=True);(out/'crossing-pixels.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
finally:server.shutdown()

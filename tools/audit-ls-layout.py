"""Measure real SVG text and controls over every LS preset; capture desktop evidence."""
import argparse,json
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--root',default=str(ROOT));parser.add_argument('--out',required=True);parser.add_argument('--sizes',default='1920,1440,1280');parser.add_argument('--states',default='N,R');parser.add_argument('--capture',action='store_true');parser.add_argument('--check',action='store_true');args=parser.parse_args()
ROOT=Path(args.root).resolve();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT/'simulator')));Thread(target=server.serve_forever,daemon=True).start()
MEASURE=r'''()=>{
 const svg=document.querySelector('#trackSvg'),v=svg.viewBox.baseVal;
 const box=e=>{const b=e.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height}};
 const overlap=(a,b)=>{const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return w>.8&&h>.8?{w,h,area:w*h}:null};
 const texts=[...svg.querySelectorAll('[data-circuit-label],[data-label-kind]')].filter(e=>e.tagName==='text').map(e=>({id:e.dataset.circuitLabel||e.dataset.labelId||e.textContent,kind:e.dataset.circuitLabel?'circuit':e.dataset.labelKind,text:e.textContent,b:box(e),el:e}));
 const windows=[...svg.querySelectorAll('[data-train-slot]>rect')].map(e=>({id:e.parentNode.dataset.trainSlot,kind:'window',b:box(e)}));
 const bodies=[...svg.querySelectorAll('.signal-body,.block-body,.block-stem')].map(e=>({id:e.closest('[data-signal-view]')?.dataset.signalView||e.closest('[data-block-id]')?.dataset.blockId,kind:e.classList.contains('signal-body')?'signal-body':e.classList.contains('block-stem')?'block-stem':'block-body',b:box(e)}));
 const platforms=[...svg.querySelectorAll('.platform')].map((e,i)=>({id:'platform-'+i,kind:'platform',b:box(e)}));
 const issues=[];
 const put=(kind,a,b,hit)=>issues.push({kind,a:{id:a.id,kind:a.kind,text:a.text,b:a.b},b:b?{id:b.id,kind:b.kind,text:b.text,b:b.b}:null,hit});
 texts.forEach((a,i)=>{
  if(a.b.x<-.8||a.b.y<-.8||a.b.x+a.b.w>v.width+.8||a.b.y+a.b.h>v.height+.8)put('clipped',a,null,null);
  const squeeze=+a.el.getAttribute('textLength');if(squeeze&&squeeze<Math.min(38,a.text.length*5))put('compressed',a,null,{width:squeeze});
  for(const b of texts.slice(i+1)){const hit=overlap(a.b,b.b);if(hit)put('text-overlap',a,b,hit);}
  for(const b of windows){const hit=overlap(a.b,b.b);if(hit)put('text-window',a,b,hit);}
  if(a.kind!=='circuit')for(const b of platforms){const hit=overlap(a.b,b.b);if(hit)put('text-platform',a,b,hit);}
  for(const b of bodies){if(a.kind==='signal'&&a.id===b.id)continue;const hit=overlap(a.b,b.b);if(hit)put('text-symbol',a,b,hit);}
 });
 bodies.forEach((a,i)=>{for(const b of bodies.slice(i+1)){if(a.id===b.id)continue;const hit=overlap(a.b,b.b);if(hit)put('symbol-symbol',a,b,hit);}});
 for(const a of [...windows,...bodies])if(a.b.x<-.8||a.b.y<-.8||a.b.x+a.b.w>v.width+.8||a.b.y+a.b.h>v.height+.8)put('clipped-symbol',a,null,null);
 windows.forEach((a,i)=>{for(const b of [...windows.slice(i+1),...bodies]){const hit=overlap(a.b,b.b);if(hit)put('window-symbol',a,b,hit);}});
 const ctm=svg.getScreenCTM();
 return {screenTransform:{a:ctm.a,d:ctm.d,e:ctm.e,f:ctm.f},circuitHighlights:texts.filter(t=>t.kind==='circuit'&&['30T','80T'].includes(t.id)).map(({el,...t})=>t),preset:document.querySelector('#lsStage').dataset.preset,width:v.width,height:v.height,texts:texts.map(({el,...rest})=>rest),signalOffsets:[...svg.querySelectorAll('[data-label-kind=signal]')].map(e=>({id:e.dataset.labelId,dx:+e.dataset.labelOffsetX||0,dy:+e.dataset.labelOffsetY||0})).filter(p=>p.dx||p.dy),blocks:[...svg.querySelectorAll('[data-block-id]')].map(e=>({id:e.dataset.blockId,code:e.dataset.blockCode,number:e.dataset.blockNumber})),windows,signals:svg.querySelectorAll('[data-signal]').length,parts:[...svg.querySelectorAll('[data-point-control]')].map(e=>e.dataset.pointControl),rawPolygons:svg.querySelectorAll('.rail-join').length,issues};
}'''
report=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in map(int,args.sizes.split(',')):
   page=browser.new_page(viewport={'width':width,'height':1080 if width==1920 else 1000 if width==1440 else 800},reduced_motion='reduce');errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null')
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.add_style_tag(content='*,*::before,*::after{transition:none!important;animation:none!important}')
   page.evaluate("SimRemote.command({type:'clock',paused:true})")
   views=page.evaluate('SimLSPresets.list()')
   for state in args.states.split(','):
    for view in views:
     page.evaluate('([id,st,pos])=>{selectStation(id);SimRemote.command({type:"control",station:st,action:{type:"mode",value:"CCM"}});for(const point of Object.keys(SimCore.forStation(st).points)){const r=SimRemote.command({type:"control",station:st,action:{type:"point",id:point,value:pos}});if(!r.ok)throw Error(st+" "+point+" "+r.message);}if(Object.values(SimField.state(st).points).some(p=>p!==pos))throw Error("point position mismatch");render()}',[view['id'],view['station'],state])
     page.evaluate('document.fonts.ready')
     data=page.evaluate(MEASURE);data.update(viewport=width,state=state,name=view['name']);report.append(data)
     if args.capture and width==1920 and state=='N':
      page.screenshot(path=str(out/(view['id']+'.png')),animations='disabled')
    print('MEASURED',width,state,'presets',len(views),flush=True)
   assert not errors,errors;page.close()
  browser.close()
finally:server.shutdown()
compact=[{**{k:v for k,v in r.items() if k not in ['texts','windows']},'textCount':len(r['texts']),'trainWindows':[w['id'] for w in r['windows']]} for r in report]
(out/'audit.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2)+'\n')
summary=[{'view':r['preset'],'viewport':r['viewport'],'state':r['state'],'issues':len(r['issues']),'types':{k:sum(i['kind']==k for i in r['issues']) for k in sorted(set(i['kind'] for i in r['issues']))}} for r in report]
(out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([r for r in summary if r['viewport']==1920 and r['state']=='N'],ensure_ascii=False),flush=True)

if args.check:
 assert all(not r['issues'] for r in report), 'LS layout collisions or clipping detected; inspect audit.json'
 print('PASS no measured text/control collisions or clipping in',len(report),'desktop cases',flush=True)

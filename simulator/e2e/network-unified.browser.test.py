from sample_timetable_fixture import insert_sample_timetable
"""The full line shares actual train progression, block protection and scenario checks."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import _previews  # noqa: F401  (docs/ previews only with UPDATE_DOCS_PREVIEWS=1)
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=b.new_page(viewport={'width':width,'height':1080});page.clock.install();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');insert_sample_timetable(page);page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn')
   page.evaluate('''()=>{const m=structuredClone(SimRemote.snapshot.timetable);m.trains.splice(1);const r=SimRemote.command({type:'timetable',method:'import',args:[{serviceDate:m.serviceDate,trains:m.trains}]});if(r.ok===false)throw Error(r.message);const c=SimCore.forStation('cheongnyangni');c.dispatch(SimField.state('cheongnyangni'),{type:'fault',kind:'signal',id:'4A',on:true});SimAutoUI.set(true);}''')
   run=lambda a:page.evaluate('a=>SimMMI.run(a)',a)
   run({'type':'tick','seconds':600})
   assert page.evaluate('SimAutoUI.position(SimDiagram.getModel().trains[0],600).station')=='cheongnyangni'
   assert page.evaluate('''()=>{const rows=[];for(const [st,s]of Object.entries(SimLSUI.getModel().stations))for(const ts of Object.values(s.windows))for(const t of ts)if(t.number==='K1131')rows.push(st);return rows.length==1&&rows.every(st=>st==='cheongnyangni');}''')
   assert page.evaluate("SimNetwork.stations.length")==33 and page.evaluate("SimLine.line.sections.length")==46
   page.evaluate('''()=>{SimCore.forStation('cheongnyangni').dispatch(SimField.state('cheongnyangni'),{type:'fault',kind:'signal',id:'4A',on:false});SimAutoUI.step();}''')
   run({'type':'tick','seconds':20})
   pos=page.evaluate('SimAutoUI.position(SimDiagram.getModel().trains[0],620)');assert 0<=pos['order']<1,pos
   assert page.evaluate('SimDiagram.getModel().trains[0].calls[3].arrival')==450,'movement delay must not rewrite the plan with reflection off'
   for _ in range(42):run({'type':'tick','seconds':10})
   assert page.evaluate('SimAutoUI.position(SimDiagram.getModel().trains[0],1040).station')=='dongmyo'
   # A scripted emergency does not silently switch off shared block enforcement.
   page.evaluate("SimMMI.open('scenario')");page.select_option('#scSelect','em-03');page.click('#scStart');assert page.evaluate('SimLine.state.enforce')
   assert page.evaluate('''()=>{const id=SimScenarioUI.reservedNumbers().find(id=>Object.values(SimLSUI.getModel().stations).some(s=>Object.values(s.windows).some(rows=>rows.some(r=>r.number===id))));return SimAutoUI.position({id},1040)?.actual===true;}''')
   # Empty single-line reservation (LS only): a wrong-direction departure onto the up line rejects the opposite departure before a number enters.
   page.reload(wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn');page.evaluate('SimAutoUI.set(false)')
   page.evaluate('''()=>{for(const id of ['jonggak','underground-seoul'])SimCore.forStation(id).dispatch(SimField.state(id),{type:'mode',value:'CCM'});}''')
   page.select_option('#stationSelect','jonggak');assert run({'type':'route','id':'53-B045T'})['ok']
   page.select_option('#stationSelect','underground-seoul');r=run({'type':'route','id':'3A-B065T'});assert not r['ok'] and '단선 운전' in r['message'],r
   if width==1920:
    page.reload(wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)");page.click('#pauseBtn');page.evaluate('SimAutoUI.set(true)')
    result=page.evaluate('''()=>{SimRemote.command({type:'tick',seconds:12000});SimAutoUI.step();return {positions:SimDiagram.getModel().trains.map(t=>SimAutoUI.position(t,12000)),routes:SimNetwork.stations.filter(s=>s.controlled).flatMap(st=>Object.keys(SimField.state(st.id).routes)),numbers:Object.values(SimLSUI.getModel().stations).flatMap(s=>Object.values(s.windows).flat()),troubles:document.querySelector('#acTroubles').innerText};}''')
    assert not result['routes'] and not result['numbers'] and all(p is None for p in result['positions']),result
    assert result['troubles']=='등록된 트러블이 없습니다',result
    print('PASS 1920px: all 12 timetable trains finish the full protected network without leftover numbers, routes or troubles',flush=True)
   assert not errors,errors
   print(f'PASS {width}px: actual upstream delay / intermediate progression / shared scenario protection / empty single-line reservation',flush=True)
   page.close()
  b.close()
finally:server.shutdown();server.server_close()

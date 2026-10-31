"""Student briefing: full text, safe wrapping, separate artwork, sticky timer and exam-mode hiding (desktop)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,height in [(1440,1000),(1920,1080)]:
   page=b.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');page.click('#ftsWinBtn')
   name='의왕역 상행 K0651열차 운행선 변경을 시행하시오.\n도착진로와 승강장을 확인한 후 조치하시오.'
   situation='\n'.join(f'{i:02d}. 상황 확인: <원문> & 열차번호 K0651 — 관제 상황과 역간 점유를 확인합니다.' for i in range(1,17))
   actions='\n'.join(f'{i:02d}. 조치사항 원문: 신호·진로 확인 → 관계자 통보 → 운행상태 확인. '+('LONG_IDENTIFIER_'*10 if i==4 else '') for i in range(1,15))
   lib={'version':1,'problems':[{'id':'P','name':name,'subject':'운행선 관리','limit':600,'situation':situation,'actions':actions,'checks':[{'condition':{'type':'manual','label':'조치 확인'}}]}],'situations':[{'id':'S','name':'브리핑 검증','problems':['P']}],'scenarios':[{'id':'SC','name':'브리핑 가독성','situations':['S']}]}
   page.evaluate('l=>SimFTSUI.importLibrary(l,false)',lib);page.click('#mmiAlertOk');page.locator('#ftsPanel [data-fts-page=setup]').first.click();page.click('#suPick');page.locator('#pkScen tr[data-key=SC]').click();page.click('#pkOk');page.uncheck('#suAuto');page.click('#suStart')
   box=page.locator('#ftsProblemBody');expect(box.locator('[data-problem-section=name]')).to_have_text(name);expect(box.locator('[data-problem-section=situation]')).to_have_text(situation);expect(box.locator('[data-problem-section=actions]')).to_have_text(actions)
   image=box.locator('.fts-briefing-art img');expect(image).to_be_visible();assert image.evaluate('e=>e.complete&&e.naturalWidth===1312');assert box.locator('.fts-briefing-content img').count()==0
   assert box.evaluate("""e=>{const art=e.querySelector('.fts-briefing-art').getBoundingClientRect(),hero=e.querySelector('.fts-briefing-hero').getBoundingClientRect(),content=e.querySelector('.fts-briefing-content').getBoundingClientRect();return art.bottom<=hero.bottom+1&&content.top>=hero.bottom-1;}""")
   assert box.locator('[data-problem-section=situation]').evaluate("e=>getComputedStyle(e).whiteSpace==='pre-wrap'&&parseFloat(getComputedStyle(e).fontSize)>=16")
   page.locator('[data-problem-section=actions]').scroll_into_view_if_needed();assert page.locator('[data-mmi-window=ftsProblem] .mmi-win-body').evaluate('e=>e.scrollWidth<=e.clientWidth+2');expect(box.locator('#pbRemaining')).to_be_visible()
   # The instructor navigation stays reachable while the decorated student window is open.
   page.locator('#ftsPanel [data-fts-page=monitor]').first.click();page.click('#mEnd');page.click('#mmiConfirmYes');page.evaluate("SimMMI.close('ftsProblem')")
   page.locator('#ftsPanel [data-fts-page=setup]').first.click();page.uncheck('#suActions');page.click('#suStart');expect(box.locator('[data-problem-section=actions]')).to_have_count(0);expect(box.locator('[data-problem-section=name]')).to_have_text(name);expect(box.locator('[data-problem-section=situation]')).to_have_text(situation)
   assert not errors,errors
   print(f'PASS briefing full multiline text, escaping, artwork separation, wrapping, sticky timer and exam hiding at {width}x{height}');page.close()
  b.close()
finally:server.shutdown()

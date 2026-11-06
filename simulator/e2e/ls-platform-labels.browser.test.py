"""LS 표기 통일: 승강장 선로 번호(nT)는 15개 역 모두 그 선로 승강장(열번창) 바로 오른쪽 칸에 있다 (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a): pass
JS = """()=>{const svg=document.querySelector('#trackSvg');
 const wins=[...svg.querySelectorAll('.ls-train-slot.inline')].map(g=>{const b=g.querySelector('rect').getBBox();return {slot:g.dataset.trainSlot,x:b.x,cy:b.y+b.height/2,r:b.x+b.width};}).filter(w=>/^\\d+T$/.test(w.slot));
 return wins.map(w=>{const t=[...svg.querySelectorAll('text.cell-name,text.rail-name')].find(t=>t.textContent.trim()===w.slot);if(!t)return {slot:w.slot,ok:false,why:'라벨 없음'};
  const b=t.getBBox(),gap=b.x-w.r,dy=Math.abs(b.y+b.height/2-w.cy);return {slot:w.slot,ok:dy<6&&gap>=0&&gap<60,why:`gap ${gap.toFixed(0)} dy ${dy.toFixed(0)}`};});}"""
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT))); Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width in (1440, 1920):
            page = b.new_page(viewport={'width': width, 'height': 1000}); page.add_init_script('window.open=()=>null')
            page.goto(f'http://127.0.0.1:{server.server_port}', wait_until='networkidle')
            total, bad = 0, []
            for st in page.evaluate("SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id)"):
                page.evaluate("id=>selectStation(id)", st); page.wait_for_timeout(150)
                for r in page.evaluate(JS):
                    total += 1
                    if not r['ok']: bad.append(f"{st} {r['slot']} {r['why']}")
            assert total >= 70 and not bad, (total, bad)
            page.close()
        b.close()
    print(f'PASS platform track labels (nT) sit in the cell right of their platform window at all 15 stations ({total} labels)')
finally:
    server.shutdown()

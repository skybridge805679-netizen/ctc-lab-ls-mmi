"""선로망: 자동제어 열차가 역을 빠져나가면 다음 연동역의 진입 열번창에 나타나 붉게 표시된다 (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    page.evaluate("SimAutoUI.set(true)")
    seen = {}
    via = set()
    for _ in range(260):
        page.evaluate("()=>{SimMMI.run({type:'tick',seconds:10});SimAutoUI.step();}")
        where = page.evaluate("""()=>{const out={};for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number==='K1131')out[st]=slot;return out;}""")
        via.update(page.evaluate("""()=>{const out=[];const m=SimLSUI.getModel().stations;for(const [id,v] of Object.entries(SimLine.INTERMEDIATE))for(const sl of Object.values(v.slots))for(const r of (m[v.host]?.windows?.[sl]||[]))if(r.number)out.push(id);return out}"""))
        for st, slot in where.items():
            seen.setdefault(st, set()).add(slot)
            if st == 'dongmyo' and slot.startswith('B') and page.evaluate("!!SimField.state('dongmyo').approach['1B']"):
                seen.setdefault('approach-1B', set()).add(slot)
    # K1131 leaves 청량리 and shows up at 동묘앞 in a boundary (B###T) window before it stops on a platform track, and so on down the line
    assert any(s.startswith('B') for s in seen.get('dongmyo', [])), seen
    assert any(not s.startswith('B') for s in seen.get('dongmyo', [])), seen        # and later the platform window
    assert 'approach-1B' in seen, 'the next station gets the approach (접근) at its arrival signal'
    assert 'jonggak' in seen and 'underground-seoul' in seen, list(seen)
    # the boundary circuit is red on the next station's LS while the number stands there
    page.evaluate("SimAutoUI.set(false)")
    page.evaluate("SimLSUI.dispatch({op:'insert',station:'dongmyo',slot:'B008T',number:'K7777',direction:'down'})")
    page.evaluate("document.querySelector('#stationSelect').value='dongmyo';document.querySelector('#stationSelect').dispatchEvent(new Event('change'))")
    assert 'B008T' in page.evaluate("[...document.querySelectorAll('#lsStage .train-occ')].map(e=>e.dataset.trainOccupied)")
    assert via, '비연동 중간역(제기동 등) 열번창에 정차 열차가 표시되어야 한다'
    assert not errors, errors
    print('line hand-off: ok', {k: sorted(v) for k, v in list(seen.items())[:3]})


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

"""폐색 점유가 진로 설정을 막는다, LS 조작만으로 하는 단선지령식 보호 (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    ack = lambda: page.evaluate("()=>{document.querySelectorAll('.mmi-alarm:not([hidden]) input[data-alarm-i]').forEach(b=>{b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));});document.querySelector('.mmi-alarm:not([hidden]) [data-alarm-ok]')?.click();}")
    page.evaluate("document.querySelector('#stationSelect').value='anyang';document.querySelector('#stationSelect').dispatchEvent(new Event('change'))")
    run_ = lambda a: page.evaluate('a=>SimMMI.run(a)', a)
    run_({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    run_({'type': 'lsOperation', 'operation': {'op': 'insert', 'station': 'anyang', 'slot': 'B984T', 'number': 'K0001', 'direction': 'down'}, 'source': 'LS'})
    ack()
    r = run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})
    assert not r['ok'] and '전방 폐색' in r['message'] and 'K0001' in r['message'], r
    expect(page.locator('.mmi-alarm')).to_contain_text('전방 폐색'); ack()
    # the occupied section is the engine's block state (선로망 창은 실제 프로그램에 없어 뺐다)
    assert 'K0001' in page.evaluate("JSON.stringify(SimField.state('anyang').exitBlocked||{})")
    # switch the check off: the same route can be set
    line = lambda on: page.evaluate('on=>window.SimRemote?SimRemote.command({type:"line",enforce:on}):(SimLine.state.enforce=on)', on)
    line(False)
    assert run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']
    run_({'type': 'withdraw', 'id': '4A-B984T', 'source': 'LS'})
    line(True)
    assert not run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']; ack()
    uid = page.evaluate("SimLSUI.getModel().stations.anyang.windows.B984T[0].uid")
    run_({'type': 'lsOperation', 'operation': {'op': 'delete', 'station': 'anyang', 'slot': 'B984T', 'uid': uid}, 'source': 'LS'})
    assert run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']
    # 단선지령식은 LS 조작만으로: 종각에서 반대 방향 진로(53-B045T)를 내면 지하서울의 같은 선로 정방향 출발(3A-B065T)이 막힌다
    select = lambda st: page.evaluate("st=>{const s=document.querySelector('#stationSelect');s.value=st;s.dispatchEvent(new Event('change'));}", st)
    select('jonggak'); run_({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    assert run_({'type': 'route', 'id': '53-B045T', 'source': 'LS'})['ok']
    select('underground-seoul'); run_({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    r = run_({'type': 'route', 'id': '3A-B065T', 'source': 'LS'}); ack()
    assert not r['ok'] and '단선 운전' in r['message'], r
    select('jonggak'); run_({'type': 'withdraw', 'id': '53-B045T', 'source': 'LS'})
    select('underground-seoul'); assert run_({'type': 'route', 'id': '3A-B065T', 'source': 'LS'})['ok']
    assert not errors, errors
    print('line block: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

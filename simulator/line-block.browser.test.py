"""폐색 점유가 진로 설정을 막는다, 선로망 현황 창, 단선지령식 (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


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
    run_({'type': 'lsOperation', 'operation': {'op': 'insert', 'station': 'anyang', 'slot': 'B988T', 'number': 'K0001', 'direction': 'down'}, 'source': 'LS'})
    ack()
    r = run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})
    assert not r['ok'] and '전방 폐색' in r['message'] and 'K0001' in r['message'], r
    expect(page.locator('.mmi-alarm')).to_contain_text('전방 폐색'); ack()
    # the window shows the occupied section
    page.locator('#mmiLineBtn').click()
    expect(page.locator('[data-mmi-window="lineNet"]')).to_be_visible()
    expect(page.locator('#lnRows')).to_contain_text('K0001'); expect(page.locator('#lnRows')).to_contain_text('하2선')
    # switch the check off: the same route can be set
    page.locator('#lnEnforce').uncheck()
    assert run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']
    run_({'type': 'withdraw', 'id': '4A-B984T', 'source': 'LS'})
    page.locator('#lnEnforce').check()
    assert not run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']; ack()
    uid = page.evaluate("SimLSUI.getModel().stations.anyang.windows.B988T[0].uid")
    run_({'type': 'lsOperation', 'operation': {'op': 'delete', 'station': 'anyang', 'slot': 'B988T', 'uid': uid}, 'source': 'LS'})
    assert run_({'type': 'route', 'id': '4A-B984T', 'source': 'LS'})['ok']
    # 단선지령식 on/off is logged and listed
    page.locator('#lnPair').select_option(index=0); page.locator('#lnSingleOn').click()
    expect(page.locator('#lnSingleList')).not_to_contain_text('없음')
    expect(page.locator('#eventLogBody')).to_contain_text('단선지령식 시행')
    page.locator('#lnSingleOff').click(); expect(page.locator('#lnSingleList')).to_contain_text('없음')
    assert not errors, errors
    print('line block: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

"""비상시 조치 시나리오: 대본 단계, 연동역 조작 인식, LS 열번창 변화 (Chromium)."""
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
    page.locator('#mmiScenarioBtn').click()
    assert page.locator('#scSelect optgroup').count() == 3
    page.locator('#scSelect').select_option('em-02'); page.locator('#scSelect').dispatch_event('change')
    expect(page.locator('#scTrainRow')).to_be_hidden()
    page.locator('#scStart').click()
    expect(page.locator('#scProblem')).to_contain_text('K0602')
    steps = page.locator('#scSteps li').count()
    assert steps == 40, steps                                         # 27 spoken steps + 13 operations
    expect(page.locator('#scSteps li.sc-say').first).to_contain_text('상황수보')
    row = lambda n: page.evaluate("n=>{for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return st+'/'+slot+'/'+r.direction;return null;}", n)
    assert row('K0602') == 'dongmyo/2T/up', row('K0602')
    # ticking spoken step 1 (collision) puts K0604 into the same 열번창 -> 열차번호 중복 알람
    page.locator('#scSteps li.sc-say').first.locator('input').check()
    page.wait_for_function("()=>!!SimLSUI.getModel().stations.dongmyo.windows['2T'] && SimLSUI.getModel().stations.dongmyo.windows['2T'].length===2")
    expect(page.locator('#alarmLogBody')).to_contain_text('열차번호 중복')
    ack = lambda: page.locator('.mmi-alarm [data-alarm-ok]').click() if page.locator('.mmi-alarm:not([hidden])').count() else None
    ack()
    at = lambda st, a: (page.evaluate("st=>{const s=document.querySelector('#stationSelect');s.value=st;s.dispatchEvent(new Event('change'))}", st), page.evaluate('a=>SimMMI.run(a)', a), ack())
    ls = lambda op: page.evaluate("o=>SimMMI.run({type:'lsOperation',operation:o,source:'LS'})", op)       # the same path as the LS context menu
    def rename(a, b):
        f = page.evaluate("n=>{for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return {station:st,slot,uid:r.uid,direction:r.direction};}", a)
        assert ls({'op': 'rename', 'number': b, **f})['ok']
    cur = lambda: page.evaluate("[...document.querySelectorAll('#scSteps li.sc-do')].findIndex(l=>l.classList.contains('current'))")
    done = lambda: page.locator('#scSteps li.sc-do.done').count()
    rename('K0602', 'G0602')
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(1)
    page.wait_for_function("()=>JSON.stringify(SimLSUI.getModel().stations.dongmyo.windows).includes('K0606')")      # rescue train arrives, G0602 leaves
    assert row('G0602') is None
    at('dongmyo', {'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    for sig in ('3A', '1B', '4A'):
        at('dongmyo', {'type': 'stop', 'id': sig, 'source': 'LS'})
    at('jonggak', {'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    for sig in ('2A', '1A', '4A'):
        at('jonggak', {'type': 'stop', 'id': sig, 'source': 'LS'})
    at('jonggak', {'type': 'route', 'id': '51-1T', 'source': 'LS'})
    at('dongmyo', {'type': 'route', 'id': '24-B015T', 'source': 'LS'})
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length===7")
    rename('K0606', 'G0606')
    f = page.evaluate("()=>{for(const [slot,rows] of Object.entries(SimLSUI.getModel().stations.dongmyo.windows))for(const r of rows)if(r.number==='G0606')return {station:'dongmyo',slot,uid:r.uid};}")
    assert ls({'op': 'move', **f, 'targetStation': 'dongmyo', 'targetSlot': '2T'})['ok']
    expect(page.locator('#alarmLogBody')).to_contain_text('G0606'); ack()          # 구원연결: 번호 중복 알람
    f = page.evaluate("()=>{for(const [slot,rows] of Object.entries(SimLSUI.getModel().stations.dongmyo.windows))for(const r of rows)if(r.number==='G0606')return {station:'dongmyo',slot,uid:r.uid};}")
    assert ls({'op': 'delete', **f})['ok']
    rename('K0604', 'G0604')
    at('dongmyo', {'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    at('jonggak', {'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length===13")
    expect(page.locator('#scStatus')).to_contain_text('조작은 모두 끝났습니다')
    # restart: numbers of the previous run are cleared and the cast is back
    page.locator('#scStart').click()
    assert row('K0602') == 'dongmyo/2T/up' and row('G0604') is None and row('K0606') is None
    # every scenario starts and shows its script
    for sid in ['em-01', 'em-03', 'em-04', 'em-05', 'em-05-1', 'em-06', 'em-06-1', 'em-06-2']:
        page.locator('#scSelect').select_option(sid); page.locator('#scSelect').dispatch_event('change'); page.locator('#scStart').click()
        expect(page.locator('#scSteps li.sc-say').first).to_contain_text('1.')
        assert page.locator('#scSteps li.sc-do').count() >= 6
    expect(page.locator('#scVariants')).to_contain_text('상황별 대응')
    assert not errors, errors
    print('emergency scenarios: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

"""비상시 조치 시나리오: 대본 단계, 연동역 조작 인식, LS 열번창 변화 (Chromium)."""
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
    page.locator('#mmiScenarioBtn').click()
    assert page.locator('#scSelect optgroup').count() == 3
    page.locator('#scSelect').select_option('em-02'); page.locator('#scSelect').dispatch_event('change')
    expect(page.locator('#scTrainRow')).to_be_hidden()
    page.locator('#scStart').click()
    expect(page.locator('#scProblem')).to_contain_text('K0602')
    steps = page.locator('#scSteps li').count()
    assert steps == 41, steps                                         # 27 spoken steps + 14 operations
    expect(page.locator('#scSteps li.sc-say').first).to_contain_text('상황수보')
    row = lambda n: page.evaluate("n=>{for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return st+'/'+slot+'/'+r.direction;return null;}", n)
    assert row('K0602') == 'dongmyo/2T/up', row('K0602')
    # ticking spoken step 1 (collision) puts K0604 into the same 열번창 -> 열차번호 중복 알람
    expect(page.locator('#scSteps input[data-say]')).to_have_count(0);page.evaluate("SimMMI.run({type:'tick',seconds:20})")
    page.wait_for_function("()=>!!SimLSUI.getModel().stations.dongmyo.windows['2T'] && SimLSUI.getModel().stations.dongmyo.windows['2T'].length===2")
    expect(page.locator('#alarmLogBody')).to_contain_text('열차번호 중복')
    ack = lambda: page.evaluate("()=>{document.querySelectorAll('.mmi-alarm:not([hidden]) input[data-alarm-i]').forEach(b=>{if(!b.checked){b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));}});document.querySelector('.mmi-alarm:not([hidden]) [data-alarm-ok]')?.click()}")
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
    page.evaluate("SimMMI.run({type:'tick',seconds:20})")
    page.wait_for_function("()=>(SimLSUI.getModel().stations.dongmyo.windows.B017T||[]).some(r=>r.number==='K0606')")      # rescue train comes in from 동대문 (B021T), G0602 leaves
    assert row('K0607') == 'dongmyo/B012T/down' and row('K0608') == 'jonggak/B055T/up'
    page.wait_for_timeout(550)
    page.evaluate("SimMMI.run({type:'tick',seconds:20})")
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
    mv = lambda n, st, slot: ls({'op': 'move', **page.evaluate("n=>{for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return {station:st,slot,uid:r.uid};}", n), 'targetStation': st, 'targetSlot': slot})
    assert mv('K0608', 'dongmyo', 'B011T')['ok']                                       # 시청 → 신설동 (수동 열번 이동)
    page.evaluate("SimMMI.run({type:'tick',seconds:20})")
    rename('K0606', 'G0606')
    f = page.evaluate("()=>{for(const [slot,rows] of Object.entries(SimLSUI.getModel().stations.dongmyo.windows))for(const r of rows)if(r.number==='G0606')return {station:'dongmyo',slot,uid:r.uid};}")
    assert ls({'op': 'move', **f, 'targetStation': 'dongmyo', 'targetSlot': '2T'})['ok']
    page.evaluate("SimMMI.run({type:'tick',seconds:20})")
    expect(page.locator('#alarmLogBody')).to_contain_text('G0606'); ack()          # 구원연결: 번호 중복 알람
    f = page.evaluate("()=>{for(const [slot,rows] of Object.entries(SimLSUI.getModel().stations.dongmyo.windows))for(const r of rows)if(r.number==='G0606')return {station:'dongmyo',slot,uid:r.uid};}")
    assert ls({'op': 'delete', **f})['ok']
    rename('K0604', 'G0604')
    at('dongmyo', {'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    at('jonggak', {'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length===14")
    expect(page.locator('#scStatus')).to_contain_text('조작은 모두 끝났습니다')
    # restart: numbers of the previous run are cleared and the cast is back
    page.locator('#scStart').click()
    assert row('K0602') == 'dongmyo/2T/up' and row('G0604') is None and row('K0606') == 'dongmyo/B021T/up'
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
    for width, height in [(1440, 1000), (1920, 1080)]:
        page=browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        page.close()
    browser.close(); server.shutdown()

"""시나리오 재현: LS 열번창에 등장 열차(방향+번호)를 놓고 진행에 따라 이동시킨다 (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


# scenario -> (station, signals to stop, route that pulls the faulty train into the siding, siding slot, start slot, direction)
CASES = {
    'yongsan-5': ('yongsan', ['2A'], '2A-5T', '5T', 'B607T', 'up'),
    'yongsan-4': ('yongsan', ['1B'], '1B-4T', '4T', 'B606T', 'down'),
    'yeongdeungpo-1': ('yeongdeungpo', ['1A', '4B'], '1A-1T', '1T', 'B620T', 'down'),
    'geumcheon-1': ('geumcheon', ['1B', '4B'], '1B-1T', '1T', 'B642T', 'down'),
    'geumcheon-6': ('geumcheon', ['2B'], '2B-6T', '6T', 'B641T', 'up'),
}


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    do = lambda a: page.evaluate('a=>SimMMI.run(a)', a)
    rows = lambda st: page.evaluate("st=>Object.fromEntries(Object.entries(SimLSUI.getModel().stations[st].windows).filter(([k,v])=>v.length).map(([k,v])=>[k,v.map(r=>r.number+':'+r.direction)]))", st)
    for sid, (st, stops, route, siding, start, direction) in CASES.items():
        page.locator('#mmiScenarioBtn').click()
        page.locator('#scSelect').select_option(sid); page.locator('#scSelect').dispatch_event('change')
        page.locator('#scStart').click()
        train = page.locator('#scTrain').input_value()
        before = rows(st)
        assert any(r.startswith(train + ':' + direction) for r in before.get(start, [])), (sid, before)
        assert sum(len(v) for v in before.values()) >= 2, (sid, before)        # followers / other trains stand on the LS too
        do({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
        for sig in stops:
            do({'type': 'stop', 'id': sig, 'source': 'LS'})
        do({'type': 'tick', 'seconds': 90})
        expect(page.locator('#scSteps li.sc-do.done')).to_have_count(3)      # CCM, 해정, 접근쇄정 경과 (checked every 0.5 s)
        do({'type': 'route', 'id': route, 'source': 'LS'})
        page.wait_for_function("()=>SimScenarioUI.motionJobs().some(j=>j.phase==='moving')")
        do({'type':'tick','seconds':20})
        page.wait_for_function("([st,slot,n])=>(SimLSUI.getModel().stations[st].windows[slot]||[]).some(r=>r.number===n)", arg=[st, siding, train])
        assert not any(r.startswith(train + ':') for r in rows(st).get(start, []))
        if sid == 'yongsan-5':
            # the other trains run on when the script says so, and leave the station area a little later
            followers = [r.split(':')[0] for r in rows(st)[start] if not r.startswith(train)]
            assert len(followers) == 2, followers
            do({'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
            idx = page.evaluate("[...document.querySelectorAll('#scSteps li.sc-say')].findIndex(li=>li.textContent.includes('진입 완료'))")
            page.evaluate("SimMMI.run({type:'tick',seconds:120})")
            do({'type':'tick','seconds':20})
            page.wait_for_function("([n])=>(SimLSUI.getModel().stations.yongsan.windows['7T']||[]).some(r=>r.number===n)", arg=[followers[0]])
            do({'type': 'tick', 'seconds': 35})
            page.wait_for_timeout(550)
            do({'type':'tick','seconds':20})
            page.wait_for_function("([n])=>(SimLSUI.getModel().stations.yongsan.windows['B605T']||[]).some(r=>r.number===n)", arg=[followers[0]])
            do({'type': 'tick', 'seconds': 35})
            page.wait_for_timeout(550)
            do({'type':'tick','seconds':20})
            page.wait_for_function("([n])=>!JSON.stringify(SimLSUI.getModel().stations.yongsan.windows).includes(n)", arg=[followers[0]])
    assert not errors, errors
    print('scenario cast: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page=browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        page.close()
    browser.close(); server.shutdown()

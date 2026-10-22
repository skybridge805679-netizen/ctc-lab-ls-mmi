"""관제 실기 시나리오 (부본선 대피 5종) (Chromium)."""
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
    expect(page.locator('[data-mmi-window="scenario"] .mmi-title-text')).to_contain_text('실기 시나리오')
    assert page.locator('#scSelect option').count() == 5
    do = lambda a: page.evaluate('a=>SimMMI.run(a)', a)
    # the timetable is user data: rename every train and drop the first up train -> the choices follow the current timetable
    page.evaluate("""()=>{const m=SimDiagram.getModel();for(const t of m.trains)t.id=(t.direction==='up'?'U':'D')+t.id.slice(1);
      m.trains.splice(m.trains.findIndex(t=>t.direction==='up'),1);SimDiagram.render();}""")
    page.locator('#scSelect').select_option('yongsan-5')
    page.locator('#scSelect').dispatch_event('change')
    options = page.locator('#scTrainList option').evaluate_all('o=>o.map(x=>x.value)')
    assert options and all(o.startswith('U') for o in options) and 'U1002' not in options, options
    train = options[0]
    expect(page.locator('#scTrain')).to_have_value(train)
    page.locator('#scTrain').fill('Q9999'); page.locator('#scStart').click()
    expect(page.locator('.mmi-alert')).to_contain_text('시간표 열차'); page.locator('#mmiAlertOk').click()
    page.locator('#scTrain').fill(train); page.locator('#scStart').click()
    expect(page.locator('#scProblem')).to_contain_text(train)
    expect(page.locator('#stationSelect')).to_have_value('yongsan')
    assert page.evaluate("SimMMI.history().mode.length") == 0       # the seeding is silent
    # the trains of the script stand on the LS 열번창 with direction and number
    where = lambda n: page.evaluate("n=>{for(const [st,s] of Object.entries(SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return st+'/'+slot+'/'+r.direction;return null;}", n)
    assert where(train) == 'yongsan/B607T/up', where(train)
    cast = page.evaluate("[...document.querySelectorAll('#scProblem small')].map(e=>e.textContent).join(' ')")
    assert '등장 열차' in cast and train in cast, cast
    followers = [c for c in page.evaluate("SimLSUI.getModel().stations.yongsan.windows.B607T").__iter__()]
    assert len(followers) == 3, followers                                   # fault train + two following up trains behind it
    assert page.evaluate("SimLSUI.getModel().stations.yongsan.windows.B606T[0].direction") == 'down'     # the 하2선 train
    expect(page.locator('#lsStage')).to_contain_text(train)
    expect(page.locator('#scSteps li.current')).to_contain_text('CCM 전환')
    expect(page.locator('#scSteps li.current .sc-hint')).to_contain_text('힌트')
    # out-of-order action does not count (route before CCM / release): refused, nothing ticks
    do({'type': 'route', 'id': '2A-5T', 'source': 'LS'})
    page.locator('#mmiAlertOk').click() if page.locator('#mmiAlertOk').count() else None
    page.locator('.mmi-alarm [data-alarm-ok]').click() if page.locator('.mmi-alarm:not([hidden])').count() else None
    assert page.locator('#scSteps li.done').count() == 0
    do({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(1)
    do({'type': 'withdraw', 'id': '2A-7T', 'source': 'LS'})
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(2)
    expect(page.locator('#scSteps li.current')).to_contain_text('90초')
    do({'type': 'tick', 'seconds': 90})
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(3)
    do({'type': 'route', 'id': '2A-5T', 'source': 'LS'})
    do({'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(5)
    page.wait_for_function("(n)=>{for(const s of Object.values(SimLSUI.getModel().stations))if((s.windows['5T']||[]).some(r=>r.number===n))return true;return false;}", arg=train)   # the broken train pulled into 5번 부본선
    assert where(train) == 'yongsan/5T/up'
    expect(page.locator('#scSteps li.current')).to_contain_text('스케줄 수정')
    expect(page.locator('#scStatus')).not_to_contain_text('합격')
    page.evaluate("""id=>{const m=SimDiagram.getModel(),t=m.trains.find(x=>x.id===id),d=structuredClone(t);
      d.calls.find(c=>c.station==='yongsan').departureRoute='3C_B605T';SimTimetable.update(m,id,d);}""", train)
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(6)
    page.wait_for_function("(n)=>{for(const s of Object.values(SimLSUI.getModel().stations))if((s.windows['B605T']||[]).some(r=>r.number===n))return true;return false;}", arg=train)   # edited departure route -> out to B605T
    expect(page.locator('#scStatus')).to_contain_text('구술')
    for box in page.locator('#scSteps input[data-say]').all():
        box.check()
    expect(page.locator('#scStatus')).to_contain_text('합격')
    expect(page.locator('#eventLogBody')).to_contain_text('실기 시나리오 합격')
    # a second scenario seeds its own station
    page.locator('#scSelect').select_option('geumcheon-6'); page.locator('#scStart').click()
    expect(page.locator('#stationSelect')).to_have_value('geumcheon')
    assert page.evaluate("Object.keys(SimMMI.run({type:'tick',seconds:0}) && {}).length") == 0
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS exam scenarios: seeding, ordered detection, schedule step, spoken-line checklist at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

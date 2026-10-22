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
    page.locator('#scSelect').select_option('yongsan-5'); page.locator('#scStart').click()
    expect(page.locator('#stationSelect')).to_have_value('yongsan')
    assert page.evaluate("SimMMI.history().mode.length") == 0       # the seeding is silent
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
    expect(page.locator('#scSteps li.current')).to_contain_text('스케줄 수정')
    expect(page.locator('#scStatus')).not_to_contain_text('합격')
    page.evaluate("""()=>{const m=SimDiagram.getModel(),t=m.trains.find(x=>x.id==='K1002'),d=structuredClone(t);
      d.calls.find(c=>c.station==='yongsan').departureRoute='3C_B605T';SimTimetable.update(m,'K1002',d);}""")
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(6)
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

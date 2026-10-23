"""역 공통설비 장애(EIS1/EIS2·건널목)와 표준시각 전송 (Chromium)."""
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
    page.locator('#mmiEquipBtn').click()
    expect(page.locator('[data-mmi-window="equipment"]')).to_be_visible()
    page.locator('[data-eq="EIS1"]').check()
    expect(page.locator('#lsStage [data-equipment="EIS1"]')).to_have_class(__import__('re').compile('fault'))
    expect(page.locator('#alarmLogBody')).to_contain_text('EIS1(전자연동장치 1계) 장애')
    page.locator('[data-eq="RC"]').check()
    expect(page.locator('#alarmLogBody')).to_contain_text('건널목 장애')
    assert 'EIS2' not in page.evaluate("SimEquipment.faultList().join()")
    # the marker survives a redraw of the LS
    page.evaluate("document.querySelector('#stationSelect').dispatchEvent(new Event('change'))")
    expect(page.locator('#lsStage [data-equipment="RC"]')).to_have_class(__import__('re').compile('fault'))
    page.locator('[data-eq="EIS1"]').uncheck()
    expect(page.locator('#eventLogBody')).to_contain_text('복구')
    # standard time: DTS1+DTS2 down and back; and the 03:00:00 crossing
    page.locator('[data-eq="DTS1"]').check(); page.locator('[data-eq="DTS2"]').check()
    page.locator('[data-eq="DTS1"]').uncheck()
    assert page.evaluate("SimEquipment.sentTimes().length") == 0
    page.locator('[data-eq="DTS2"]').uncheck()
    expect(page.locator('#eventLogBody')).to_contain_text('표준시각 전송 (')
    n = page.evaluate("SimEquipment.sentTimes().length")
    page.evaluate("SimEquipment.tick(10790);SimEquipment.tick(10805)")
    assert page.evaluate("SimEquipment.sentTimes().length") == n + 1
    assert page.evaluate("SimEquipment.sentTimes().slice(-1)[0]") == '매일 03:00:00'
    # signal / point fault and TTB end up in the station state and block a route request
    page.evaluate("document.querySelector('#stationSelect').value='cheongnyangni';document.querySelector('#stationSelect').dispatchEvent(new Event('change'))")
    page.locator('#eqRt').select_option('4A-B002T')
    sig = page.evaluate("SimField.core('cheongnyangni').routes['4A-B002T'].signal")
    page.locator('#eqSig').select_option(sig); page.locator('#eqSigFault').check()
    assert sig in page.evaluate("SimField.state('cheongnyangni').faults.signals")
    page.locator('#eqTtb').check(); assert '4A-B002T' in page.evaluate("SimField.state('cheongnyangni').ttb")
    expect(page.locator('#eventLogBody')).to_contain_text('연속통과진로')
    page.locator('#eqClear').click()
    assert page.evaluate("SimField.state('cheongnyangni').faults.signals.length+SimField.state('cheongnyangni').ttb.length") == 0
    page.locator('#eqClear').click()
    assert page.evaluate("SimEquipment.faultList().filter(k=>k.startsWith('cheongnyangni')).length") == 0
    assert not errors, errors
    print('equipment: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

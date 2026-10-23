"""CDRS 해소안 확인/취소 (Chromium)."""
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
    page.locator('#mmiCdrsBtn').click()
    expect(page.locator('[data-mmi-window="cdrs"]')).to_be_visible()
    expect(page.locator('#cdrsRows tr.empty')).to_have_count(1)   # default timetable has no conflict
    # a follower 60 s behind creates conflicts (the timetable is whatever is loaded: pick the first down train)
    page.evaluate("""()=>{const m=SimDiagram.getModel(),d=m.trains.find(t=>t.direction==='down');
      SimTimetable.copy(m,d.id,'B7777',d.calls[0].departure+60,{});SimDiagram.render();}""")
    page.locator('#cdrsDetect').click()
    expect(page.locator('#alarmLogBody')).to_contain_text('CDRS 경합 검지')
    n = page.locator('#cdrsRows tr:not(.empty)').count(); assert n >= 1
    # 취소: proposal withdrawn, conflict stays, schedule unchanged
    before = page.evaluate("JSON.stringify(SimDiagram.getModel().trains.find(t=>t.id==='B7777').calls)")
    page.locator('[data-cdrs-no]').first.click()
    assert page.locator('#cdrsRows tr:not(.empty)').count() == n - 1
    expect(page.locator('#cdrsMsg')).to_contain_text('수동')
    assert page.evaluate("JSON.stringify(SimDiagram.getModel().trains.find(t=>t.id==='B7777').calls)") == before
    assert page.evaluate("SimTimetable.conflicts(SimDiagram.getModel()).length") >= n
    page.locator('#cdrsRestore').click(); assert page.locator('#cdrsRows tr:not(.empty)').count() == n
    # 확인: schedule changed automatically, that conflict gone
    c0 = page.evaluate("SimTimetable.conflicts(SimDiagram.getModel()).length")
    enabled = page.locator('[data-cdrs-ok]:not([disabled])').first
    enabled.click()
    expect(page.locator('#cdrsMsg')).to_contain_text('승인')
    assert page.evaluate("SimTimetable.conflicts(SimDiagram.getModel()).length") < c0
    assert page.evaluate("SimDiagram.getModel().changes.some(c=>c.type==='cdrs')")
    expect(page.locator('#eventLogBody')).to_contain_text('CDRS 해소안 승인')
    assert not errors, errors
    print('cdrs: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

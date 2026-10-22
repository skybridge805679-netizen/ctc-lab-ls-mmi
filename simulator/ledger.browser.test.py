"""운전정리 대장 (Chromium)."""
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
    page.locator('#mmiLedgerBtn').click()
    expect(page.locator('[data-mmi-window="ledger"]')).to_be_visible()
    expect(page.locator('#ldRows tr.empty')).to_have_count(1)
    page.evaluate("""()=>{const m=SimDiagram.getModel(),t=m.trains.find(x=>x.direction==='down');
      SimTimetable.delay(m,t.id,t.calls[2].station,2);SimTimetable.cancel(m,m.trains.find(x=>x.direction==='up').id);SimDiagram.render();}""")
    page.wait_for_timeout(1300)
    expect(page.locator('#ldRows')).to_contain_text('관제승인 1호')
    expect(page.locator('#ldRows')).to_contain_text('운전명령 1호')
    expect(page.locator('#ldCount')).to_contain_text('관제승인 1건')
    page.locator('#ldFilter').select_option('운전명령')
    assert page.locator('#ldRows tr:not(.empty)').count() == 1
    assert not errors, errors
    print('ledger: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

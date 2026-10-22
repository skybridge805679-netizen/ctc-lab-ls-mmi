"""비상 CTC 전환: LOCAL 상태에서 CCM 클릭 → 대화상자 → 현장 응답 없이 즉시 전환 (Chromium)."""
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
    mode = lambda m: page.locator(f'#lsStage [data-mode="{m}"]')
    st = lambda: page.evaluate("SimField.state(document.querySelector('#lsStage').dataset.controlStation).mode")
    mode('LOCAL').click(); page.locator('#dialogConfirm').click()
    page.locator('[data-handover="yes"]').click(); assert st() == 'LOCAL'
    # normal request: waits for the field
    mode('CCM').click(); expect(page.locator('#emgCtc')).to_be_visible(); page.locator('#dialogConfirm').click()
    assert st() == 'LOCAL'; page.locator('[data-handover="no"]').click()
    # 비상 CTC: immediate
    mode('CCM').click(); page.locator('#emgCtc').check(); page.locator('#dialogConfirm').click()
    assert st() == 'CCM'
    assert page.locator('[data-handover]').count() == 0 or not page.locator('#handoverBar').is_visible()
    assert not errors, errors
    print('emergency ctc: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

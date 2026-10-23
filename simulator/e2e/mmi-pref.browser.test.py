"""운영자선호화면 설정 (Chromium)."""
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
    page.evaluate("localStorage.removeItem('orpheia.preferred')"); page.reload(wait_until='networkidle')
    page.evaluate("SimMMI.open('preferredScreen')")
    expect(page.locator('[data-mmi-window="preferredScreen"]')).to_be_visible()
    expect(page.locator('#prefList .empty')).to_have_count(1)
    first = page.locator('#prefPool li').nth(0).get_attribute('data-id'); third = page.locator('#prefPool li').nth(2).get_attribute('data-id')
    page.locator('#prefAdd').click(); expect(page.locator('#prefMsg')).to_contain_text('선택')
    page.locator(f'#prefPool li[data-id="{third}"]').click(); page.locator('#prefAdd').click()
    page.locator(f'#prefPool li[data-id="{first}"]').click(); page.locator('#prefAdd').click()
    assert page.locator('#prefList li[data-i]').count() == 2
    page.locator('#prefUp').click()
    page.locator('#prefOk').click(); expect(page.locator('#prefMsg')).to_contain_text('적용')
    ids = page.evaluate("[...document.querySelectorAll('#lsStationSelect optgroup:first-child option')].map(o=>o.value)")
    assert ids == [first, third], ids
    # monitor 2 is independent
    page.locator('[data-pref-mon="2"]').click(); expect(page.locator('#prefList .empty')).to_have_count(1)
    assert page.evaluate("JSON.parse(localStorage.getItem('orpheia.preferred'))[1].length") == 2
    page.reload(wait_until='networkidle')
    assert page.evaluate("document.querySelectorAll('#lsStationSelect optgroup').length") == 2
    assert not errors, errors
    print('mmi-pref: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    run(page, f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

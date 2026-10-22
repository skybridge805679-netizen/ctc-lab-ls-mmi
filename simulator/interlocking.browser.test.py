"""Approach locking and overlap in the real UI. Run with python3 simulator/interlocking.browser.test.py (requires Playwright and Chromium)."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def exercise(page, url, width):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    page.locator('#lsStationSelect').select_option('geumcheon')
    expect(page.locator('#stateMode')).to_have_text('AUTO')

    def click_svg(selector):
        page.locator(selector).first.dispatch_event('click')

    def confirm():
        page.locator('#dialogConfirm').click()
        expect(page.locator('#actionDialog')).not_to_be_visible()

    click_svg('[data-control-station="geumcheon"][data-primary="true"] [data-mode="CCM"]')
    confirm()
    expect(page.locator('#stateMode')).to_have_text('CCM')
    click_svg('[data-signal="2B"]')
    page.locator('[data-route-choice="2B-6T"]').click()
    row = page.locator('[data-lock-row="2B-6T"]')
    expect(row).to_be_visible()
    expect(row.locator('.chip.set')).to_have_text('설정')
    expect(row.locator('.overlap-note')).to_contain_text('26')
    expect(page.locator('[data-overlap-point="26"]')).to_have_count(1)
    expect(page.locator('[data-point-label="26"]')).to_have_count(1)

    # No approaching train: stop releases immediately.
    click_svg('[data-signal="2B"]')
    expect(page.locator('#dialogTitle')).to_contain_text('제어 확인'); expect(page.locator('#dialogBody')).to_contain_text('해정 하시겠습니까?')
    confirm()
    try:
        expect(page.locator('[data-lock-row]')).to_have_count(0)
    except AssertionError:
        print('DEBUG toast:', page.locator('#toast').text_content(), '| log:', page.locator('#logList').inner_text()[:400])
        raise
    expect(page.locator('[data-overlap-point]')).to_have_count(0)

    # Approaching train: stop starts the 90 s approach lock.
    click_svg('[data-signal="2B"]')
    page.locator('[data-route-choice="2B-6T"]').click()
    page.locator('[data-approach-toggle="2B"]').click()
    expect(page.locator('[data-approach-train="2B"]')).to_have_count(1)
    click_svg('[data-signal="2B"]')
    confirm()
    expect(row.locator('.chip.locked')).to_have_text('접근쇄정')
    expect(page.locator('[data-active-route="2B-6T"]')).to_have_attribute('data-route-state', 'locked')
    expect(row.locator('.lock-timer')).to_contain_text('/ 90초')
    expect(row.locator('[data-sim-enter]')).to_be_disabled()
    expect(row.locator('[data-lock-remaining]')).to_have_text(__import__('re').compile(r'^(8[5-9]|90)$'))

    # Overlap point cannot be moved while the route (or its lock) exists.
    page.locator('#controlSelect').select_option('point')
    page.locator('#mmiPoint').select_option('26')
    page.locator('input[name="pointPosition"][value="R"]').check()
    page.locator('#mmiApply').click()
    expect(page.locator('#toast')).to_contain_text('오버랩 쇄정 전환기')

    # Time alone releases it after 90 s; the skip button adds 10 s at a time.
    for _ in range(9):
        page.locator('#skipBtn').click()
    expect(page.locator('[data-lock-row]')).to_have_count(0, timeout=5000)
    expect(page.locator('[data-overlap-point]')).to_have_count(0)
    expect(page.locator('#logList')).to_contain_text('접근쇄정 90초 경과')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'page scrolls horizontally'
    assert not errors, errors
    print(f'PASS approach lock 90 s, overlap ring/point lock, release by time: {width}px')


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_address[1]}/'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium')
            for width, height in ((1440, 1000), (1920, 1080)):
                page = browser.new_page(viewport={'width': width, 'height': height})
                exercise(page, url, width)
                page.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()

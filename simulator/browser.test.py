"""Run with python3 simulator/browser.test.py (requires Playwright and Chromium)."""
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


def exercise(page, url):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(url, wait_until='networkidle')
    expect(page.locator('#taskSelect option')).to_have_count(9)

    def confirm():
        page.locator('#dialogConfirm').click()
        expect(page.locator('#actionDialog')).not_to_be_visible()

    def ccm():
        page.locator('[data-mode="CCM"]').click()
        confirm()
        expect(page.locator('#stateMode')).to_have_text('CCM')

    def route(signal, route_id):
        page.locator(f'[data-signal="{signal}"]').click()
        page.locator(f'[data-route-choice="{route_id}"]').click()
        expect(page.locator('#stateRoutes')).to_have_text('1개 설정')

    def release():
        page.locator('[data-signal="3A"]').click()
        confirm()
        expect(page.locator('#stateRoutes')).to_have_text('0개 설정')

    for index in range(9):
        page.locator('#taskSelect').select_option(str(index))
        page.locator('#startTask').click()
        page.locator('#checkTask').click()
        expect(page.locator('#taskResult')).not_to_have_class('complete-banner')
        if index != 1:
            ccm()
        if index == 1:
            page.locator('#mmiApply').click()
            expect(page.locator('#stateMode')).to_have_text('CCM')
        elif index == 2:
            route('1A', '1A-1T')
        elif index == 3:
            page.locator('#controlSelect').select_option('route')
            page.locator('#mmiSignal').select_option('3A')
            page.locator('#mmiRoute').select_option('3A-B065T')
            page.locator('#mmiApply').click()
            expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
        elif index == 4:
            route('3A', '3A-B070T')
            release()
            route('3A', '3A-B065T')
        elif index == 5:
            for point in ['21', '22']:
                page.locator(f'[data-point="{point}"]').click()
                confirm()
                expect(page.locator('.point-states')).to_contain_text(point+' 반위')
        elif index == 6:
            for response in ['no', 'yes']:
                page.locator('[data-mode="LOCAL"]').click()
                confirm()
                page.locator(f'[data-handover="{response}"]').click()
            expect(page.locator('#stateMode')).to_have_text('LOCAL')
        elif index == 7:
            page.locator('#lsDisplay').click(button='right')
            confirm()
            page.locator('#controlSelect').select_option('scan')
            page.locator('input[name="mmiScope"][value="all"]').check()
            page.locator('#mmiApply').click()
        elif index == 8:
            route('3A', '3A-B065T')
            page.locator('[data-signal="3A"]').click()
            page.locator('#actionDialog button[value="cancel"]').click()
            expect(page.locator('#actionDialog')).not_to_be_visible()
            expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
            page.locator('#checkTask').click()
            expect(page.locator('#taskResult')).not_to_have_class('complete-banner')
            release()
        page.locator('#checkTask').click()
        expect(page.locator('#taskResult')).to_have_class('complete-banner')
        expect(page.locator('#completedCount')).to_have_text(f'{index+1} / 9 완료')
    page.reload(wait_until='networkidle')
    expect(page.locator('#completedCount')).to_have_text('9 / 9 완료')
    assert not errors, errors


parser = argparse.ArgumentParser()
parser.add_argument('--include-file', action='store_true', help='Also verify file:// loading when browser policy permits it')
args = parser.parse_args()

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                             args=['--no-sandbox'])
        targets = [
            (1440, 1000, f'http://127.0.0.1:{server.server_port}/'),
            (390, 844, f'http://127.0.0.1:{server.server_port}/'),
        ]
        if args.include_file:
            targets.append((1440, 1000, (ROOT/'index.html').as_uri()))
        for width, height, url in targets:
            context = browser.new_context(viewport={'width': width, 'height': height})
            exercise(context.new_page(), url)
            context.close()
            print(f'PASS all 9 tasks, incomplete checks, persistence: {width}x{height} {url.split(":")[0]}')
        browser.close()
finally:
    server.shutdown()
    server.server_close()

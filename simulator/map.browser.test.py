"""Verify replacement PDF backgrounds, sheet switching and station hit regions."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for width in [1440, 390]:
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            expect(page.locator('#trackSvg image')).to_have_attribute('href', 'assets/line-map/page-2.jpg')
            expect(page.locator('#mapSheet')).to_be_disabled()
            # Exercise each source-aligned mode control and station overview link.
            stations = page.locator('#stationSelect option').evaluate_all('(options)=>options.map(o=>o.value)')
            for station in stations:
                page.locator('#mapOverview').click()
                expect(page.locator('[data-map-station]')).to_have_count(15)
                page.locator(f'[data-map-station="{station}"]').click()
                expect(page.locator('#stationSelect')).to_have_value(station)
                page.locator('[data-mode="CCM"]').click()
                page.locator('#dialogConfirm').click()
                expect(page.locator('#stateMode')).to_have_text('CCM')
                expect(page.locator('#trackSvg image')).to_have_attribute('href', 'assets/line-map/page-'+('2' if station in ['cheongnyangni','dongmyo','jonggak','underground-seoul','seoul','yongsan'] else '4' if station in ['noryangjin','yeongdeungpo','guro','geumcheon'] else '3')+'.jpg')
            page.locator('#mapOverview').click()
            for number in [1, 2, 3, 4]:
                page.locator('#mapSheet').select_option(str(number))
                expect(page.locator('#trackSvg image')).to_have_attribute('href', f'assets/line-map/page-{number}.jpg')
                expect(page.locator('[data-mode]')).to_have_count(0)
                expect(page.locator('.fidelity-note')).to_contain_text(f'PDF {number}쪽')
            page.locator('#mapSheet').select_option('1')
            if width == 1440:
                page.locator('.ls-panel').screenshot(path=str(ROOT.parent/'docs/preview-v0.5.1-overview.png'), style='#toast {visibility:hidden}')
            page.locator('[data-map-station="underground-seoul"]').press('Enter')
            page.locator('[data-signal="3A"]').click()
            page.locator('[data-route-choice="3A-B065T"]').click()
            expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
            expect(page.locator('[data-active-route="3A-B065T"]')).to_have_count(1)
            expect(page.locator('[data-track-label="B065T"]')).to_have_text('B065T')
            if width == 1440:
                page.locator('.ls-panel').screenshot(path=str(ROOT.parent/'docs/preview-v0.5.1-station.png'), style='#toast {visibility:hidden}')
            assert not errors, errors
            context.close()
            print(f'PASS PDF sheets 1–4, 15 overview links/mode controls, Seoul route at width {width}')
        browser.close()
finally:
    server.shutdown()
    server.server_close()

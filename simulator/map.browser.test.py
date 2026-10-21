"""Station jurisdictions, full sheets, all traced LS signals and station-independent controls (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for width in [1440, 390]:
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            page = context.new_page(); errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            expect(page.locator('#mapSheet')).to_have_value('station')
            expect(page.locator('#trackSvg image')).to_have_count(1)
            expect(page.locator('[data-primary="true"]')).to_have_count(1)
            stations = page.locator('#stationSelect option').evaluate_all('(os)=>os.map(o=>o.value)')
            tested = 0
            for station in stations:
                page.locator('#stationSelect').select_option(station)
                bounds=page.evaluate('(id)=>SimNetwork.catalog[id].map.view.bounds.join(" ")',station)
                expect(page.locator('#trackSvg')).to_have_attribute('viewBox', bounds)
                expect(page.locator('#trackSvg image')).to_have_count(1)
                expect(page.locator('[data-primary="true"]')).to_have_count(1)
                expect(page.locator('#mapZoomValue')).to_have_text('100%')
                assert page.locator('.track-frame').evaluate('(e)=>e.scrollTop')==0
                if width==390:
                    for _ in range(4): page.locator('#mapZoomIn').click()
                layer = page.locator(f'[data-control-station="{station}"][data-primary="true"]')
                layer.locator('[data-mode="CCM"]').click(); page.locator('#dialogConfirm').click()
                expect(page.locator('#stateMode')).to_have_text('CCM')
                signals = layer.locator('[data-signal]').evaluate_all('(els)=>els.map(e=>e.dataset.signal)')
                for signal in signals:
                    layer.locator(f'[data-signal="{signal}"]').click()
                    choice = page.locator('[data-route-choice]').first
                    route = choice.get_attribute('data-route-choice'); choice.click()
                    expect(layer.locator(f'[data-active-route="{route}"]')).to_have_count(1)
                    expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
                    layer.locator(f'[data-signal="{signal}"]').click(); page.locator('#dialogConfirm').click()
                    expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
                    tested += 1
                print(f'PASS {width}px {station}: {len(signals)} LS signal menus / set / visible path / release', flush=True)
            assert tested == 246
            # Documented Yongsan 7T path must be available beyond a generic first-route check.
            page.locator('#stationSelect').select_option('yongsan')
            layer = page.locator('[data-control-station="yongsan"][data-primary="true"]')
            layer.locator('[data-signal="2A"]').click();page.locator('[data-route-choice="2A-7T"]').click()
            expect(layer.locator('[data-active-route="2A-7T"]')).to_have_count(1)
            layer.locator('[data-signal="2A"]').click();page.locator('#dialogConfirm').click()
            # The prior broken example: Anyang refuge route and all neighbouring stations remain available.
            page.locator('#stationSelect').select_option('anyang')
            page.locator('#controlSelect').select_option('route')
            page.locator('#mmiSignal').select_option('2A')
            page.locator('#mmiRoute').select_option('2A-6T')
            page.locator('#routeControl').select_option('continuous')
            page.locator('#mmiApply').click()
            page.locator('[data-sim-enter="2A-6T"]').click()
            expect(page.locator('[data-control-station="anyang"] [data-active-route="2A-6T"]')).to_have_attribute('stroke', '#ff453b')
            page.locator('[data-sim-clear="2A-6T"]').click()
            expect(page.locator('[data-control-station="anyang"] [data-active-route="2A-6T"]')).to_have_attribute('stroke', '#36ed06')
            page.locator('#controlSelect').select_option('stopAll');page.locator('#mmiApply').click();page.locator('#dialogConfirm').click()
            expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
            # Duplicate PDF depictions share the same model, including their actual click regions.
            page.locator('#stationSelect').select_option('geumcheon')
            page.locator('#mapSheet').select_option('all')
            copy = page.locator('[data-control-station="geumcheon"][data-primary="false"]')
            copy.locator('[data-signal="1A"]').click();page.locator('[data-route-choice="1A-1T"]').click()
            expect(page.locator('[data-control-station="geumcheon"] [data-active-route="1A-1T"]')).to_have_count(2)
            # All four original sheets can be selected without removing any pixels of the sheet.
            for number in [1, 2, 3, 4]:
                page.locator('#mapSheet').select_option(str(number))
                expect(page.locator('#trackSvg image')).to_have_attribute('href', f'assets/line-map/page-{number}.jpg')
                expect(page.locator('#trackSvg')).to_have_attribute('viewBox', '0 0 2048 768')
            page.locator('#mapSheet').select_option('1')
            page.locator('[data-map-station="anyang"]').press('Enter')
            expect(page.locator('#mapSheet')).to_have_value('station')
            expect(page.locator('#stationSelect')).to_have_value('anyang')
            page.locator('#controlSelect').select_option('route');page.locator('#mmiSignal').select_option('1A');page.locator('#mmiRoute').select_option('1A-1T');page.locator('#mmiApply').click()
            if width == 1440:
                page.locator('#mapFit').click()
                page.locator('#stationSelect').select_option('anyang')
                page.evaluate("window.scrollTo(0,document.querySelector('.ls-panel').getBoundingClientRect().top+window.scrollY-60);scrollToStation()")
                page.screenshot(path=str(ROOT.parent/'docs/preview-v0.6.1-anyang.png'))
                for _ in range(3): page.locator('#mapZoomIn').click()
                page.locator('#stationSelect').select_option('anyang')
                page.evaluate("window.scrollTo(0,document.querySelector('.ls-panel').getBoundingClientRect().top+window.scrollY-60);scrollToStation()")
                page.screenshot(path=str(ROOT.parent/'docs/preview-v0.6.1-anyang-zoom.png'))
            assert not errors, errors
            context.close()
            print(f'PASS full sheets, {tested} LS signals, refuge/continuous/occupancy/all-stop, duplicate sheets, overview keyboard: {width}px', flush=True)
        browser.close()
finally:
    server.shutdown(); server.server_close()

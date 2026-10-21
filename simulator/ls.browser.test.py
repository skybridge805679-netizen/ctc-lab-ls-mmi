"""Redrawn vector LS: every traced signal, station navigation, layout and removed controls (Chromium)."""
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
        for width in [1440, 1920]:
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            page = context.new_page(); errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda r: errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            # Removed: PDF background, sheet/zoom tools, LS point buttons, decorative frame elements.
            for gone in ['#mapSheet', '#mapOverview', '#mapZoomIn', '.track-frame', '#trackSvg image', '[data-point]', '.point-hit', '[data-select-control]']:
                expect(page.locator(gone)).to_have_count(0)
            stations = page.locator('#stationSelect option').evaluate_all('(os)=>os.map(o=>o.value)')
            assert len(stations) == 15
            tested = 0
            for station in stations:
                page.locator(f'#stationTabs [data-station="{station}"]').click()
                stage = page.locator(f'#lsStage[data-control-station="{station}"][data-primary="true"]')
                expect(stage).to_have_count(1)
                expected = page.evaluate('(id)=>Object.keys(SimCore.forStation(id).signals).length', station)
                expect(stage.locator('[data-signal]')).to_have_count(expected)
                assert stage.locator('.bed-inner path').count() >= 2
                # Jurisdiction (intermediate) stations are drawn from the original strips, with their plates.
                inter = page.evaluate('(id)=>SimNetwork.catalog[id].map.view.intermediate', station)
                expect(stage.locator('[data-inter-station]')).to_have_count(len(inter))
                for name in inter:
                    expect(stage.locator(f'[data-inter-station="{name}"]')).to_have_count(1)
                if inter:
                    assert stage.locator('.wing-inner rect').count() >= 4, station
                    assert stage.locator('.platform').count() >= 1, station
                # Diagram fills the stage width and is centred (no wasted side space), nothing overflows the page.
                box = page.evaluate("""()=>{const s=document.querySelector('#trackSvg').getBoundingClientRect(),h=document.querySelector('#lsStage').getBoundingClientRect(),g=document.querySelector('#trackSvg').getBBox(),v=document.querySelector('#trackSvg').viewBox.baseVal;return {fill:s.width/h.width,left:g.x,right:v.width-(g.x+g.width),top:g.y,bottom:v.height-(g.y+g.height)}}""")
                if width == 1440:
                    assert box['fill'] > 0.9, box
                assert stage.locator('#trackSvg').evaluate('(s)=>s.getBoundingClientRect().width <= s.parentElement.clientWidth+1'), 'diagram is cropped inside station screen'
                assert abs(box['left'] - box['right']) < 90, box
                assert box['top'] < 160 and box['bottom'] < 250, box
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'page scrolls horizontally'
                stage.locator('[data-mode="CCM"]').click(); page.locator('#dialogConfirm').click()
                expect(page.locator('#stateMode')).to_have_text('CCM')
                signals = stage.locator('[data-signal]').evaluate_all('(els)=>els.map(e=>e.dataset.signal)')
                for signal in signals:
                    stage.locator(f'[data-signal="{signal}"]').click()
                    choice = page.locator('[data-route-choice]').first
                    route = choice.get_attribute('data-route-choice'); choice.click()
                    expect(stage.locator(f'[data-active-route="{route}"]')).to_have_count(1)
                    expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
                    stage.locator(f'[data-signal="{signal}"]').click(); page.locator('#dialogConfirm').click()
                    expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
                    tested += 1
                print(f'PASS {width}px {station}: {len(signals)} signals set / visible path / release, fills and centres', flush=True)
            assert tested == 246
            # Navigation arrows and select stay in sync.
            page.select_option('#lsStationSelect', 'cheongnyangni')
            expect(page.locator('#previousStation')).to_be_disabled()
            page.click('#nextStation'); expect(page.locator('#stationSelect')).to_have_value('dongmyo')
            page.click('#previousStation'); expect(page.locator('#stationSelect')).to_have_value('cheongnyangni')
            # Refuge route with continuous control and occupancy colours.
            page.locator('#stationSelect').select_option('anyang')
            page.locator('#controlSelect').select_option('route')
            page.locator('#mmiSignal').select_option('2A')
            page.locator('#mmiRoute').select_option('2A-6T')
            page.locator('#routeControl').select_option('continuous')
            page.locator('#mmiApply').click()
            page.locator('[data-sim-enter="2A-6T"]').click()
            expect(page.locator('#lsStage [data-active-route="2A-6T"]')).to_have_attribute('data-route-state', 'occupied')
            page.locator('[data-sim-clear="2A-6T"]').click()
            expect(page.locator('#lsStage [data-active-route="2A-6T"]')).to_have_attribute('data-route-state', 'set')
            page.locator('#controlSelect').select_option('stopAll'); page.locator('#mmiApply').click(); page.locator('#dialogConfirm').click()
            expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
            if width == 1440:
                for station in ['underground-seoul', 'geumcheon', 'yongsan', 'seoul']:
                    page.select_option('#lsStationSelect', station)
                    page.locator('#lsDisplay').screenshot(path=str(ROOT.parent / f'docs/preview-v0.13.0-{station}.png'))
            assert not errors, errors
            context.close()
            print(f'PASS vector LS: {tested} signals, navigation, continuous/occupancy, removed controls: {width}px', flush=True)
        browser.close()
finally:
    server.shutdown(); server.server_close()

"""열차자동제어 (AUTO) UI: switch, routes, train numbers following the virtual train, histories (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def menu(page, top, *path):
    page.locator('.mmi-top-btn', has_text=top).click()
    for name in path[:-1]:
        page.locator('.mmi-menu-list .has-sub > button', has_text=name).first.click()
    page.locator('.mmi-menu-list [data-mmi-open], .mmi-menu-list [data-mmi-act]', has_text=path[-1]).first.click()


def numbers(page, station):
    return page.evaluate("s=>Object.entries(SimLSUI.getModel().stations[s].windows).flatMap(([slot,r])=>r.map(x=>slot+':'+x.number))", station)


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    tick = lambda n: page.evaluate('n=>SimMMI.run({type:"tick",seconds:n})', n)
    page.locator('#stationSelect').select_option('cheongnyangni')
    # default OFF: AUTO mode alone changes nothing
    expect(page.locator('#mmiAutoBtn')).to_have_text('자동제어 OFF')
    tick(10)
    expect(page.locator('#stateRoutes')).to_contain_text('0개 설정')
    # ON: the first train (시발 at 청량리, departs at 30 s) gets its departure route at once
    page.locator('#mmiAutoBtn').click()
    expect(page.locator('#mmiAutoBtn')).to_have_text('자동제어 ON')
    expect(page.locator('#stateRoutes')).to_contain_text('1개 설정')
    expect(page.locator('#alarmLogBody')).to_contain_text('진로설정')
    tick(30)                                         # t=40: the train has left the station track and runs through the departure route
    assert any(n.endswith(':K1131') for n in numbers(page, 'cheongnyangni')), numbers(page, 'cheongnyangni')
    tick(30)                                         # t=70: cleared, route released, number gone
    expect(page.locator('#stateRoutes')).to_contain_text('0개 설정')
    # (제기동 같은 비연동 중간역 열번창에는 정차 중인 열차가 남을 수 있다)
    via = page.evaluate("Object.values(SimLine.INTERMEDIATE).filter(v=>v.host==='cheongnyangni').flatMap(v=>Object.values(v.slots))")
    assert not any(n.endswith(':K1131') and n.split(':')[0] not in via for n in numbers(page, 'cheongnyangni')), numbers(page, 'cheongnyangni')
    # the manual-operation history does not list what the controller did
    assert page.evaluate("SimMMI.history().field.filter(r=>r.kind==='진로').length") == 0
    # the next station gets the train: its number appears at 동묘앞 while it arrives
    page.evaluate("SimMMI.run({type:'tick',seconds:300})")
    assert page.evaluate("SimMMI.history().field.length") == 0
    # CCM at a station: the controller no longer requests routes there
    page.locator('#stationSelect').select_option('geumcheon')
    page.evaluate("SimMMI.run({type:'mode',value:'CCM',source:'MMI'})")
    before = page.evaluate("Object.keys(SimLSUI.getModel().stations.geumcheon.windows).length")
    page.evaluate("SimMMI.run({type:'tick',seconds:3000})")
    expect(page.locator('#stateRoutes')).to_contain_text('0개 설정')
    # settings window with the switch and the trouble list
    menu(page, '프로그램', '프로그램 환경설정')
    expect(page.locator('#acEnabled')).to_be_checked()
    page.locator('#acEnabled').uncheck()
    expect(page.locator('#mmiAutoBtn')).to_have_text('자동제어 OFF')
    expect(page.locator('#eventLogBody')).to_contain_text('열차 자동제어(AUTO) 중지')
    # replay keeps the automatic changes (the log is the source for 로그재생)
    assert page.evaluate("SimMMI.replayLog('cheongnyangni').length") >= 2
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS auto control: switch, routes, numbers, histories, settings at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

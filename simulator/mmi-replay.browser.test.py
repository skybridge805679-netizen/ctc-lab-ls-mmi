"""로그재생 (실기1 p.39-42) (Chromium)."""
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


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
    do = lambda a: page.evaluate('a=>SimMMI.run(a)', a)
    page.locator('#stationSelect').select_option('geumcheon')
    do({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    do({'type': 'route', 'id': '4A-B968T', 'source': 'LS'})
    do({'type': 'withdraw', 'id': '4A-B968T', 'source': 'LS'})
    page.evaluate("SimMMI.run({type:'tick',seconds:100})")
    menu(page, '프로그램', '로그재생(R)')
    expect(page.locator('[data-mmi-window="logReplay"] .mmi-title-text')).to_have_text('로그재생')
    page.locator('#rpStation').select_option('geumcheon')
    # no logs for another day -> the textbook's message
    page.locator('#rpDate').fill('2020-01-01'); page.locator('#rpSearch').click()
    expect(page.locator('.mmi-alert')).to_contain_text('관련로그 정보가 없습니다!'); page.locator('#mmiAlertOk').click()
    today = page.evaluate("new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})")
    page.locator('#rpDate').fill(today); page.locator('#rpSearch').click()
    n = page.locator('#rpRows tr[data-i]').count()
    assert n >= 3, n
    texts = page.locator('#rpRows').inner_text()
    assert 'CCM MODE로 전환' in texts and 'RT_4A_B968T진로설정' in texts and 'RT_4A_B968T진로해정' in texts, texts
    # step to the 진로설정 row: LS shows 1 route and the 로그재생중 text, live operations are refused
    set_row = page.locator('#rpRows tr[data-i]', has_text='진로설정').first
    set_row.click()
    expect(page.locator('#lsReplayBadge')).to_contain_text('로그재생중')
    expect(page.locator('#stateRoutes')).to_contain_text('1개 설정')
    refused = do({'type': 'mode', 'value': 'AUTO', 'source': 'MMI'})
    assert refused['ok'] is False
    page.locator('#rpRows tr[data-i]', has_text='진로해정').first.click()
    expect(page.locator('#stateRoutes')).to_contain_text('0개 설정')
    # first / down / up / last
    page.locator('#rpFirst').click(); assert page.locator('#rpRows tr.sel td').first.inner_text() == '1'
    page.locator('#rpDown').click(); assert page.locator('#rpRows tr.sel td').first.inner_text() == '2'
    page.locator('#rpUp').click(); assert page.locator('#rpRows tr.sel td').first.inner_text() == '1'
    page.locator('#rpLast').click(); assert page.locator('#rpRows tr.sel td').first.inner_text() == str(n)
    # playback from the start runs to the end (10x), pause remembers the place
    page.locator('#rpSpeed').select_option('10'); page.locator('#rpFirst').click(); page.locator('#rpPlay').click()
    page.wait_for_function(f"document.querySelector('#rpRows tr.sel td')?.textContent==='{n}'", timeout=8000)
    page.locator('#rpFirst').click(); page.locator('#rpPlay').click(); page.locator('#rpPause').click()
    expect(page.locator('#rpState')).to_contain_text('잠시 멈춤')
    # save as a file
    with page.expect_download() as info:
        page.locator('#rpSave').click()
    body = Path(info.value.path()).read_text(encoding='utf-8-sig')
    assert 'RT_4A_B968T진로설정' in body and body.splitlines()[0].startswith('"번호"')
    # 종료 restores the live state and re-enables operations
    page.locator('#rpStop').click()
    expect(page.locator('#lsReplayBadge')).to_be_hidden()
    expect(page.locator('#stateRoutes')).to_contain_text('0개 설정')
    expect(page.locator('#stateMode')).to_contain_text('CCM')
    assert do({'type': 'route', 'id': '4A-B968T', 'source': 'LS'})['ok'] is True
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS log replay: search, controls, snapshot on LS, operation lock, CSV save, restore at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

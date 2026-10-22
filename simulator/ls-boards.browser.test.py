"""L/S 표지판(반투명·크기 조절)과 사진 모양의 진로 제어 팝업·제어 확인 상자 (Chromium)."""
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
    page.evaluate("document.querySelector('#stationSelect').value='anyang';document.querySelector('#stationSelect').dispatchEvent(new Event('change'))")
    run_ = lambda a: page.evaluate('a=>SimMMI.run(a)', a)
    run_({'type': 'mode', 'value': 'CCM', 'source': 'MMI'})
    # ---- 진로 제어 팝업: 제목 + RT_ 목록만, 신호기 옆에 뜸
    page.locator('#lsStage [data-signal="4A"]').click()
    dlg = page.locator('#actionDialog')
    expect(dlg).to_have_attribute('data-variant', 'route')
    expect(page.locator('#dialogTitle')).to_have_text('[ 진로 제어 ]')
    assert page.locator('[data-route-choice]').all_inner_texts() == ['RT_4A_B984T', 'RT_4A_B660T'], page.locator('[data-route-choice]').all_inner_texts()
    box = dlg.bounding_box(); sig = page.locator('#lsStage [data-signal="4A"]').bounding_box()
    assert abs(box['x'] - sig['x']) < 120 and abs(box['y'] - sig['y']) < 120, (box, sig)      # near the signal, not centred
    page.locator('[data-route-choice="4A-B660T"]').click()
    assert page.evaluate("SimField.state('anyang').routes['4A-B660T']!==undefined")
    # ---- 해정: 윈도 스타일 제어 확인 상자, Y 키로 [예]
    page.locator('#lsStage [data-signal="4A"]').click()
    expect(dlg).to_have_attribute('data-variant', 'confirm')
    expect(page.locator('#dialogTitle')).to_have_text('제어 확인')
    expect(dlg).to_contain_text('해정 하시겠습니까?')
    expect(page.locator('#dialogConfirm')).to_have_text('예(Y)')
    expect(dlg.locator('[value="cancel"]')).to_have_text('아니요(N)')
    page.keyboard.press('n'); expect(dlg).not_to_be_visible()
    assert page.evaluate("SimField.state('anyang').routes['4A-B660T']!==undefined")      # N keeps the route
    page.locator('#lsStage [data-signal="4A"]').click(); page.keyboard.press('y')
    page.wait_for_function("()=>SimField.state('anyang').routes['4A-B660T']===undefined")
    # ---- L/S 표지판: 반투명, 제목줄 + 본문, 늘리고 줄임, 고정하면 조절 불가
    run_({'type': 'lsOperation', 'operation': {'op': 'boardAdd', 'station': 'anyang', 'kind': '열간작업', 'text': '열간작업', 'x': 600, 'y': 300}, 'source': 'LS'})
    board = page.locator('#lsStage [data-ls-board]').first
    expect(board).to_be_visible()
    assert float(board.locator('.bd-body').evaluate("e=>getComputedStyle(e).fillOpacity")) < 1          # 반투명
    w0 = page.evaluate("SimLSUI.getModel().stations.anyang.boards[0].w")
    grip = board.locator('[data-board-resize]').bounding_box()
    page.mouse.move(grip['x'] + grip['width'] / 2, grip['y'] + grip['height'] / 2); page.mouse.down()
    page.mouse.move(grip['x'] + 160, grip['y'] + 70, steps=6); page.mouse.up()
    b = page.evaluate("SimLSUI.getModel().stations.anyang.boards[0]")
    assert b['w'] > w0 + 50 and b['h'] > 80, b
    page.mouse.move(grip['x'] + 160 - 2, grip['y'] + 70 - 2)
    grip = page.locator('#lsStage [data-ls-board] [data-board-resize]').bounding_box()
    page.mouse.move(grip['x'] + grip['width'] / 2, grip['y'] + grip['height'] / 2); page.mouse.down(); page.mouse.move(grip['x'] - 300, grip['y'] - 150, steps=6); page.mouse.up()
    s = page.evaluate("SimLSUI.getModel().stations.anyang.boards[0]")
    assert s['w'] >= 60 and s['h'] >= 30 and s['w'] < b['w'], s                                          # shrinks, never below the minimum
    run_({'type': 'lsOperation', 'operation': {'op': 'boardFix', 'station': 'anyang', 'id': s['id'], 'fixed': True}, 'source': 'LS'})
    expect(page.locator('#lsStage [data-ls-board] [data-board-resize]')).to_have_count(0)
    assert not errors, errors
    print('ls boards and dialogs: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1700, 'height': 1100}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

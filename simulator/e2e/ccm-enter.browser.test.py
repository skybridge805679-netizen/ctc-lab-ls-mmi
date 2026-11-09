"""제어확인창: 기본 단추 「예」 — 엔터로 운행모드 전환 (베타 피드백: CCM 전환이 엔터로 안 됨)."""
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
    mode = lambda m: page.locator(f'#lsStage [data-mode="{m}"]')
    cur = "SimField.state(document.querySelector('#lsStage').dataset.controlStation)"
    wait = lambda m: page.wait_for_function(cur + f".mode==='{m}'")
    start = page.evaluate(cur + '.mode')
    target = 'CCM' if start != 'CCM' else 'AUTO'
    mode(target).click(); expect(page.locator('#actionDialog')).to_be_visible()
    assert page.evaluate("document.activeElement.id") == 'dialogConfirm'
    page.keyboard.press('Enter'); wait(target)
    # 「아니요」에 포커스를 옮긴 뒤 엔터는 취소
    back = 'AUTO' if target == 'CCM' else 'CCM'
    mode(back).click(); expect(page.locator('#actionDialog')).to_be_visible()
    page.locator('#actionDialog [value="cancel"]').focus(); page.keyboard.press('Enter')
    expect(page.locator('#actionDialog')).not_to_be_visible(); page.wait_for_timeout(300)
    assert page.evaluate(cur + '.mode') == target
    # LOCAL → CCM 대화상자(비상 CTC 확인란)도 엔터로 실행
    mode('LOCAL').click(); page.keyboard.press('Enter')
    page.locator('[data-handover="yes"]').click(); wait('LOCAL')
    mode('CCM').click(); page.locator('#emgCtc').check(); page.keyboard.press('Enter'); wait('CCM')
    assert not errors, errors
    print('ccm enter: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    run(browser.new_page(viewport={'width': 1440, 'height': 1000}), f'http://127.0.0.1:{server.server_port}/')
    browser.close(); server.shutdown()

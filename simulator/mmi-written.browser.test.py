"""필기 연습 (Chromium)."""
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
    page.evaluate("localStorage.removeItem('orpheia.written')")
    page.locator('#mmiWrittenBtn').click()
    expect(page.locator('[data-mmi-window="written"]')).to_be_visible()
    assert page.locator('#wrSource option').count() == 3
    expect(page.locator('#wrCount')).to_contain_text('185문항')
    page.locator('#wrSource').select_option('비상시조치등')
    assert page.locator('#wrChapter option').count() >= 2
    page.locator('#wrSource').select_option('')
    page.locator('#wrShuffle').uncheck(); page.locator('#wrNum').fill('3')
    page.locator('#wrStart').click()
    expect(page.locator('#wrStatus')).to_contain_text('1 / 3')
    page.locator('#wrSubmit').click(); expect(page.locator('#wrResult')).to_contain_text('선택')
    def solve(wrong):
        q = page.evaluate("(()=>{const t=document.querySelector('.wr-q').textContent;return SimWrittenQuestions.find(x=>x.q===t);})()")
        if q['choices']:
            pick = q['answer'] if not wrong else (q['answer'] % 4) + 1
            page.locator(f'input[name="wrAns"][value="{pick}"]').check()
        else:
            page.locator('#wrText').fill(q['text'] if not wrong else '틀린답')
        page.locator('#wrSubmit').click()
        expect(page.locator('#wrResult')).to_contain_text('오답입니다' if wrong else '정답입니다')
        return q['id']
    solve(False); page.locator('#wrNext').click()
    bad = solve(True); page.locator('#wrNext').click()
    solve(False); page.locator('#wrNext').click()
    expect(page.locator('.wr-summary')).to_contain_text('2 / 3')
    assert page.evaluate("JSON.parse(localStorage.getItem('orpheia.written')).wrong") == [bad]
    # retry only the wrong-answer book; answering it right removes it
    page.locator('#wrScope').select_option('wrong'); expect(page.locator('#wrCount')).to_contain_text('출제 대상 1문항')
    page.locator('#wrStart').click(); solve(False); page.locator('#wrNext').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('orpheia.written')).wrong") == []
    page.locator('#wrStart').click(); expect(page.locator('#wrBody')).to_contain_text('문제가 없습니다')
    assert not errors, errors
    print('mmi-written: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        page.close()
    browser.close(); server.shutdown()

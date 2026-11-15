"""운행선관리 구술: FTS 시나리오 선택 → 교육생 문제 화면에는 질문만, 교수 모니터링에는 모범답안과 구술 확인 칸 (Chromium)."""
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parent.parent
SHOTS = os.environ.get('ORAL_SHOTS')


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script('window.open=()=>null'); page.goto(url, wait_until='networkidle'); page.click('#ftsWinBtn'); fts = page.locator('#ftsPanel')
    fts.locator('[data-fts-page=setup]').first.click(); page.click('#suPick')
    for key in ['SC-LORAL', 'SC-LORAL-ASKED', 'SC-LORAL-NEW', 'SC-LORAL-BOOK', 'SC-LORAL-TOTAL']:
        expect(page.locator(f'#pkScen tr[data-key="{key}"]')).to_have_count(1)
    page.locator('#pkScen tr[data-key="SC-LORAL-NEW"]').click(); page.click('#pkOk'); page.uncheck('#suAuto'); page.uncheck('#suActions'); page.click('#suStart')   # 시험처럼: 조치사항(모범답안) 숨김
    # 교육생 문제 화면: 질문은 보이고 모범답안은 보이지 않는다
    body = page.locator('#problemPanel #ftsProblemBody')
    expect(body).to_contain_text('철도보호지구에서 안전운행 저해 행위')
    assert '폭발물이나 인화물질' not in body.inner_text()
    if SHOTS: page.locator('#problemPanel').screenshot(path=f'{SHOTS}/oral-problem.png')
    # 교수 모니터링: 출제 표시 · 모범답안 · 구술 확인
    fts.locator('[data-fts-page=monitor]').first.click()
    expect(fts).to_contain_text('신출 · 26년 1차·3차 · 교재 14쪽')
    check = fts.locator('[data-manual$=" — 구술"]').first   # 교수 확인 (구술) 단추
    expect(check).to_be_visible()
    if SHOTS: fts.screenshot(path=f'{SHOTS}/oral-monitor.png')
    check.click()
    page.wait_for_function("SimRemote.snapshot.fts.session.items[0].status==='완료'")
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    run(page, f'http://127.0.0.1:{server.server_port}/')
    print('PASS 운행선관리 구술: 시나리오 5종(기출·교재), 문제 화면은 질문만, 모니터링은 출제 표시·모범답안·구술 확인')
    browser.close(); server.shutdown()

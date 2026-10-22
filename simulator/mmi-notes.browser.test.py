"""노트관리 + T/G note boxes + reminder pop-up (실기1 4장 8절, 5장) (Chromium)."""
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
    page.goto(url, wait_until='networkidle')
    ok = lambda: page.locator('#mmiAlertOk').click()
    menu(page, '열차스케줄', '온라인 열차그래프(O)')
    expect(page.locator('#diaSvg')).to_be_visible()
    menu(page, '시스템 관리', '노트관리')
    expect(page.locator('[data-mmi-window="noteManage"] .mmi-title-text')).to_have_text('노트관리')
    expect(page.locator('#ntRows tr.empty')).to_have_count(1)
    page.locator('#ntAppend').is_disabled() and None
    # 새노트작성 validation
    page.locator('#ntNew').click()
    page.locator('#neOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('제목'); ok()
    page.locator('#neTitle').fill('선로 보수'); page.locator('#neOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('내용'); ok()
    page.locator('#neBody').fill('동묘앞~종각 구간 서행 작업')
    page.locator('#neKind').select_option('열차번호'); page.locator('#neTarget').fill('Q0000'); page.locator('#neOk').click()
    expect(page.locator('.mmi-alert')).to_contain_text('찾을 수 없습니다'); ok()
    page.locator('#neKind').select_option('시설물'); page.locator('#neTarget').fill('SG_1A')
    page.locator('#neFrom').fill('08:30'); page.locator('#neTo').fill('08:10'); page.locator('#neOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('뒤'); ok()
    page.locator('#neFrom').fill('08:10'); page.locator('#neTo').fill('08:40')
    page.locator('#neStFrom').select_option('jonggak'); page.locator('#neOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('모두'); ok()
    page.locator('#neStFrom').select_option('dongmyo'); page.locator('#neStTo').select_option('jonggak')
    page.locator('#neReminder').check(); page.locator('#neJournal').check()
    page.locator('#neOk').click()
    # reminder: the note area is inside the visible T/G range -> pop-up
    expect(page.locator('.mmi-alert')).to_contain_text('선로 보수'); ok()
    expect(page.locator('#ntRows tr[data-id]')).to_have_count(1)
    expect(page.locator('[data-dia-note]')).to_have_count(1)
    expect(page.locator('#eventLogBody')).to_contain_text('노트 N0001 생성')
    assert len(page.evaluate('SimNotes.journals()')) == 1
    # 추가기록
    page.locator('#ntRows tr[data-id]').first.click()
    expect(page.locator('#ntContent')).to_have_value(__import__('re').compile('동묘앞~종각'))
    page.locator('#ntAppend').click(); page.locator('#naOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('내용'); ok()
    page.locator('#naText').fill('작업 종료 예정 08:40'); page.locator('#naOk').click()
    expect(page.locator('.mmi-alert')).to_contain_text('선로 보수'); ok()   # reminder fires again after a change
    assert page.locator('#ntContent').input_value().count('[') >= 2
    assert len(page.evaluate('SimNotes.journals()')) == 2
    # 노트수정: the first body is locked once there are additions
    page.locator('#ntEdit').click()
    expect(page.locator('#neBody')).to_be_disabled()
    page.locator('#neTitle').fill('선로 보수 (수정)'); page.locator('#neOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('수정'); ok()
    expect(page.locator('#ntRows')).to_contain_text('선로 보수 (수정)')
    # selecting the drawn note and 열차정보수정(F5) edits the note
    page.locator('[data-dia-note]').first.dispatch_event('click', {'bubbles': True})
    page.locator('.tg-tool[title="열차정보수정(F5)"]').click()
    expect(page.locator('[data-mmi-window="noteEdit"] .mmi-title-text')).to_contain_text('노트수정')
    page.locator('#neCancel').click()
    # search conditions
    page.locator('#ntKind').select_option('시스템'); page.locator('#ntSearch').click()
    expect(page.locator('#ntRows tr.empty')).to_have_count(1)
    page.locator('#ntKind').select_option(''); page.locator('#ntTarget').fill('sg_1a'); page.locator('#ntSearch').click()
    expect(page.locator('#ntRows tr[data-id]')).to_have_count(1)
    # 삭제 needs [예]
    page.locator('#ntRows tr[data-id]').first.click(); page.locator('#ntDelete').click()
    page.locator('#mmiConfirmNo').click()
    expect(page.locator('#ntRows tr[data-id]')).to_have_count(1)
    page.locator('#ntDelete').click(); page.locator('#mmiConfirmYes').click()
    expect(page.locator('#ntRows tr.empty')).to_have_count(1)
    expect(page.locator('[data-dia-note]')).to_have_count(0)
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS notes: manager, editor validation, T/G note box, reminder, journal, delete confirm at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

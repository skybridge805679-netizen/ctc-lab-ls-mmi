"""[MA007_01] 열차운행패턴 관리 · [CA028_02] columns, 출력 미리보기, [CA028_03] 실적 전송 (photos 2026-10-30) (Chromium)."""
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
    page.add_init_script('window.open=()=>null')
    page.goto(url, wait_until='networkidle')
    ok = lambda: page.locator('#mmiAlertOk').click()
    # ---- [MA007_01] from the MMI menu
    page.locator('.mmi-top-btn', has_text='열차스케줄').click()
    page.locator('.mmi-menu-list [data-mmi-open="pattern"]').click()
    win = page.locator('[data-mmi-window="pattern"]')
    expect(win.locator('.mmi-title-text')).to_have_text('[MA007_01] 열차운행패턴 관리')
    expect(win.locator('.mmi-pending')).to_have_count(0)
    expect(win.locator('#pmList tbody tr')).to_have_count(4)
    win.locator('#pmList tr', has_text='추석').click()
    rows = win.locator('#pmGrid tbody tr')
    expect(rows).to_have_count(23)
    expect(rows.nth(0)).to_contain_text('010140'); expect(rows.nth(0)).to_contain_text('3C_B709T')
    expect(rows.nth(16)).to_contain_text('3C_B619T2T'); expect(rows.nth(22)).to_contain_text('00:31:00')
    assert win.locator('#pmReg').input_value() == 'MIG_USR' and win.locator('#pmRegAt').input_value() == '2021-12-30 16:04:30'
    # 조회: 하행 only
    win.locator('input[name="pmDir"][value="down"]').check(); win.locator('#pmFind').click()
    expect(win.locator('#pmList tbody tr')).to_have_count(2)
    win.locator('input[name="pmDir"][value="all"]').check(); win.locator('#pmFind').click()
    # 패턴복사 -> edit a row -> 저장 (예)
    win.locator('#pmList tr', has_text='추석').click(); win.locator('#pmCopy').click()
    expect(win.locator('#pmState')).to_contain_text('새 패턴')
    win.locator('#pmName').fill('추석_연습'); win.locator('#pmName').dispatch_event('change')
    win.locator('[aria-label="화서 정차 시간"]').fill('00:00:30'); win.locator('[aria-label="화서 정차 시간"]').dispatch_event('change')
    win.locator('#pmSave').click(); page.locator('#mmiConfirmYes').click(); expect(page.locator('.mmi-alert')).to_contain_text('저장'); ok()
    expect(win.locator('#pmList tbody tr')).to_have_count(5)
    assert page.evaluate("SimScheduleDialogs.patterns().find(p=>p.name==='추석_연습').calls[1].dwell") == 30
    assert page.evaluate("JSON.parse(localStorage.getItem('orpheia.patterns.v1')).length") == 5
    # a wrong route is refused on 저장
    win.locator('#pmEdit').click()
    win.locator('[aria-label="화서 진입 시간"]').fill('00:00:00'); win.locator('[aria-label="화서 진입 시간"]').dispatch_event('change')
    win.locator('#pmSave').click(); expect(page.locator('.mmi-alert')).to_contain_text('진입 시간'); ok()
    # 추가: a new two-station pattern built from the blank row
    win.locator('input[name="pmDir"][value="down"]').check(); win.locator('#pmAdd').click()
    win.locator('#pmName').fill('연습_하'); win.locator('#pmName').dispatch_event('change')
    win.locator('[aria-label="1번째 역 이름"]').select_option('yongsan')
    win.locator('[aria-label="2번째 역 이름"]').select_option('noryangjin')
    win.locator('[aria-label="노량진 진입 진로"]').select_option('1B_3T')
    win.locator('#pmSave').click(); page.locator('#mmiConfirmYes').click(); ok()
    expect(win.locator('#pmList tbody tr')).to_have_count(6)
    # 삭제 needs 예
    win.locator('#pmDel').click(); page.locator('#mmiConfirmYes').click()
    assert not page.evaluate("SimScheduleDialogs.patterns().some(p=>p.name==='연습_하')")
    win.locator('#pmClose').click()
    # ---- [CA028_02]: photographed columns, ■운휴 check box, 인쇄, 실적입력
    page.evaluate("SimScheduleUI.open('edit','K1131')")
    heads = page.locator('#scheduleCalls thead th').all_inner_texts()
    assert heads == ['역명', '방향', '도착일', '도착시간', '정차시간', '출발일', '출발시간', '도착진로', '출발진로', '운휴', '실적도착시간', '실적정차시간', '실적출발시간'], heads
    page.locator('#scheduleCalls [aria-label="동묘앞 정차시간"]').fill('00:01:00'); page.locator('#scheduleCalls [aria-label="동묘앞 정차시간"]').dispatch_event('change')
    assert page.locator('#scheduleCalls [aria-label="동대문 도착시간"]').input_value() == '08:10:30'
    page.locator('#scheduleCalls [aria-label="수원 운휴"]').check()
    expect(page.locator('#scheduleCalls tbody tr').last).to_contain_text('운휴')
    page.locator('#scheduleApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료'); ok()
    assert page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='K1131').calls.at(-1).cancelled")
    page.locator('#schedulePrint').click()
    sheet = page.locator('#prvSheet')
    expect(sheet.locator('h1')).to_have_text('온라인 열차 스케줄 경유역')
    expect(sheet).to_contain_text('K1131'); expect(sheet.locator('tbody tr')).to_have_count(33)
    expect(sheet.locator('tbody tr').first).to_contain_text('010000')
    page.locator('#prvClose').click()
    page.locator('#scheduleCalls tbody tr').nth(3).locator('td').first.click()
    page.locator('#scheduleActual').click()
    act = page.locator('[data-mmi-window="schedActual"]')
    expect(act.locator('.mmi-title-text')).to_have_text('[CA028_03]실적 전송')
    assert page.locator('#actStation').input_value() == '동묘앞' and page.locator('#actTrain').input_value() == 'K1131'
    page.locator('#actArr').fill('8:75'); page.locator('#actSend').click(); expect(page.locator('.mmi-alert')).to_contain_text('HH:MM:SS'); ok()
    page.locator('#actArr').fill('08:15:00'); page.locator('#actDep').fill('08:15:40'); page.locator('#actSend').click(); ok()
    row = page.locator('#scheduleCalls tbody tr').nth(3)
    expect(row).to_contain_text('08:15:00'); expect(row).to_contain_text('00:00:40'); expect(row).to_contain_text('08:15:40')
    expect(page.locator('#eventLogBody')).to_contain_text('실적 전송')
    page.locator('#actClose').click()
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS schedule dialogs: MA007_01 pattern CRUD, CA028_02 columns, print preview, CA028_03 actual at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

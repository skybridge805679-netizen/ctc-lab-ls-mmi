"""Windows added from the 2026-10-22 MMI photos: menus, [CA028_01], [CA018_05], [CF003_1], reports (Chromium)."""
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


def labels(page, top, *sub):
    page.locator('.mmi-top-btn', has_text=top).click()
    for name in sub:
        page.locator('.mmi-menu-list .has-sub > button', has_text=name).first.click()
    list_ = page.locator('.mmi-menu-top.open > .mmi-menu-list') if not sub else page.locator('.has-sub.open > .mmi-menu-list').last
    items = list_.locator(':scope > li > button').all_inner_texts()
    page.keyboard.press('Escape')
    return [i.replace('▸', '').strip() for i in items]


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    ok = lambda: page.locator('#mmiAlertOk').click()
    # menu structure exactly as photographed
    assert labels(page, '프로그램') == ['로그재생(R)', '도구모음설정', '프로그램 환경설정']
    assert labels(page, '프로그램', '도구모음설정') == ['메뉴바', '상태표시줄', '이벤트로그창', '알람로그창']
    assert labels(page, '시스템 조회') == ['경광등상태', '알람메시지 확인이력 조회', '수동제어 이력 조회', '열차위치목록 조회', '열차스케줄 이력조회', '알람/이벤트조회', '실적조회']
    assert labels(page, '시스템 조회', '수동제어 이력 조회') == ['열차번호 수동조작 이력', '역제어모드 수동조작 이력', '현장설비 수동조작 이력']
    assert labels(page, '시스템 조회', '실적조회') == ['역실적 조회', '열차실적 조회', '운휴열차조회', '임시열차 조회', '지연열차조회']
    assert labels(page, '시스템 관리', '제어화면 관리') == ['운영자선호화면 설정', '모니터 위치 설정', 'RAIL Track ROUTE', 'FTS 스케줄편집']
    # not photographed -> says so
    menu(page, '시스템 조회', '경광등상태')
    expect(page.locator('[data-mmi-window="beacon"]')).to_contain_text('구현하지 않았습니다')
    page.locator('[data-mmi-window="beacon"] .mmi-close').click()
    # [CA028_01]: pick a date + a schedule, reserve it, see it in the list
    menu(page, '열차스케줄', '온라인열차스케줄 관리', '온라인 열차스케줄ID관리(I)')
    expect(page.locator('[data-mmi-window="scheduleId"] .mmi-title-text')).to_have_text('[CA028_01] 온라인열차스케줄ID관리')
    expect(page.locator('#idmCal .idm-month')).to_have_count(6)
    expect(page.locator('#idmCal button.set')).to_have_count(1)
    page.locator('#idmApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('스케줄 ID'); ok()
    page.locator('#idmList tr[data-sid="01002"]').click()
    page.locator('#idmApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('운행일'); ok()
    free = page.locator('#idmCal button:not(.set)[data-date]').nth(20)
    date = free.get_attribute('data-date')
    free.click(); page.locator('#idmApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('01002'); ok()
    expect(page.locator(f'#idmCal button.set[data-date="{date}"]')).to_have_count(1)
    expect(page.locator('#idmRows')).to_contain_text(date)
    page.locator('#idmOffline').click(); expect(page.locator('.mmi-alert')).to_contain_text('구현하지 않았습니다'); ok()
    page.locator('#idmClose').click(); expect(page.locator('[data-mmi-window="scheduleId"]')).to_be_hidden()
    # [CA018_05]: register, show, delete
    menu(page, '열차스케줄', '온라인열차스케줄 관리', '진입예고열차관리(E)')
    expect(page.locator('[data-mmi-window="entryNotice"] .mmi-title-text')).to_have_text('[CA018_05] 진입예고열차정리')
    expect(page.locator('#entStationList option')).to_have_count(15)
    page.locator('#entStationList').select_option('guro')
    assert page.locator('#entSig option').count() >= 2
    page.locator('input[name="entDir"][value="down"]').check()
    expect(page.locator('#entTrains option')).to_have_count(6)
    page.locator('#entAdd').click(); expect(page.locator('.mmi-alert')).to_contain_text('선택'); ok()
    page.locator('#entTrains').select_option(['K1131', 'K1133', 'K1135'])
    page.locator('#entAdd').click(); expect(page.locator('.mmi-alert')).to_contain_text('3건'); ok()
    expect(page.locator('#entRows tr[data-i]')).to_have_count(3)
    page.locator('#entTrains').select_option(['K1131']); page.locator('#entAdd').click(); expect(page.locator('.mmi-alert')).to_contain_text('이미'); ok()
    # registration order is the running order (순번); 선택열차이전삭제 removes only the trains before the selection
    assert [r.split('\t')[2] for r in page.locator('#entRows tr[data-i]').all_inner_texts()] == ['K1131', 'K1133', 'K1135']
    page.locator('#entRows tr[data-i]').first.click(); page.locator('#entDelBefore').click(); expect(page.locator('.mmi-alert')).to_contain_text('없습니다'); ok()
    page.locator('#entRows tr[data-i]').nth(2).click(); page.locator('#entDelBefore').click()
    expect(page.locator('#entRows tr[data-i]')).to_have_count(1)
    expect(page.locator('#entRows')).to_contain_text('K1135')
    page.locator('#entRows tr[data-i]').first.click(); page.locator('#entDel').click()
    expect(page.locator('#entRows tr.empty')).to_have_count(1)
    expect(page.locator('#eventLogBody')).to_contain_text('진입예고열차')
    page.locator('#entClose').click()
    # [CF003_1]: list running trains, follow one across stations, stop
    menu(page, '현장제어', '열차제어', '열차추적(T)')
    expect(page.locator('[data-mmi-window="trace"] .mmi-title-text')).to_have_text('[CF003_1]열차위치추적')
    expect(page.locator('.trc-mon:not([disabled])')).to_have_count(1)
    expect(page.locator('#traceMsg')).to_contain_text('운행열차번호를 수신하였습니다')
    page.locator('#traceInput').fill(''); page.locator('#traceStart').click(); expect(page.locator('.mmi-alert')).to_contain_text('입력'); ok()
    page.locator('#traceInput').fill('Z9999'); page.locator('#traceStart').click(); expect(page.locator('.mmi-alert')).to_contain_text('찾을 수 없습니다'); ok()
    page.locator('#traceList').select_option('K1131')
    expect(page.locator('#traceInput')).to_have_value('K1131')
    page.locator('#traceStart').click()
    expect(page.locator('#traceMsg')).to_contain_text('K1131 추적 중')
    expect(page.locator('#lsTraceBadge')).to_contain_text('열차추적중 K1131')
    expect(page.locator('#traceStop')).to_be_enabled()
    page.locator('#traceStop').click(); expect(page.locator('#traceMsg')).to_contain_text('종료')
    expect(page.locator('#lsTraceBadge')).to_be_hidden()
    page.locator('#traceClose').click()
    # reports are built from the simulator's own data
    menu(page, '시스템 조회', '열차위치목록 조회')
    expect(page.locator('#trainPositionsBody tr')).to_have_count(12)
    page.locator('[data-mmi-window="trainPositions"] .mmi-close').click()
    menu(page, '시스템 조회', '실적조회', '운휴열차조회')
    page.locator('#cancelledListSearch').click()
    expect(page.locator('#cancelledListBody tr.empty')).to_have_count(1)
    page.locator('[data-mmi-window="cancelledList"] .mmi-close').click()
    # 도구모음설정: log panes toggle
    menu(page, '프로그램', '도구모음설정', '알람로그창')
    expect(page.locator('[aria-label="알람 로그"]')).to_be_hidden()
    menu(page, '프로그램', '도구모음설정', '알람로그창')
    expect(page.locator('[aria-label="알람 로그"]')).to_be_visible()
    # 열차정보수정: cells that already have 실적 are read-only, the train number is locked (실기1 p.139)
    menu(page, '열차스케줄', '온라인열차스케줄 관리', '온라인 열차스케줄관리(G)')
    page.locator('input[name="scheduleMode"][value="edit"]').check()
    page.locator('#scheduleList').select_option('K1131')
    expect(page.locator('#scheduleCalls [data-call="0"][data-field="arrival"]')).to_be_disabled()
    expect(page.locator('#scheduleCalls [data-call="5"][data-field="arrival"]')).to_be_enabled()
    expect(page.locator('#scheduleNumber')).to_have_attribute('readonly', '')
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    # 제어 확인: a control command outside CCM is refused with the modal error box
    page.locator('#stationSelect').select_option('uiwang')
    page.locator('#controlSelect').select_option('route')
    page.locator('#mmiApply').click()
    expect(page.locator('.mmi-alert.error .mmi-title-text')).to_have_text('제어 확인')
    expect(page.locator('.mmi-alert.error')).to_contain_text('CCM 모드가 아니므로 제어할 수 없습니다.')
    expect(page.locator('.mmi-err')).to_be_visible()
    expect(page.locator('.mmi-alarm')).to_be_hidden()
    ok()
    # 알람메시지 pop-up (other refusals / situations)
    page.evaluate("SimMMI.raiseAlarm('의왕(010130)역 RT_3D_B685T진로 요구중 대향진로( )','수동진로설정불가')")
    box = page.locator('.mmi-alarm')
    expect(box).to_be_visible()
    expect(box).to_contain_text('미확인 알람 갯수 : 1개')
    expect(box).to_contain_text('의왕(010130)역 RT_3D_B685T진로 요구중')
    expect(box).to_contain_text('설정상태 [수동진로설정불가]')
    page.locator('[data-alarm-mute]').click(); expect(page.locator('[data-alarm-mute]')).to_be_disabled()
    # 체크 없이 [확인]만 누르면 계속 표시되고, 체크칸에 체크하고 [확인]을 눌러야 사라진다
    page.locator('#alarmOk').click(); expect(box).to_be_visible(); expect(box).to_contain_text('미확인 알람 갯수 : 1개')
    cb = page.locator('.mmi-alarm input[data-alarm-i]'); expect(cb).to_be_enabled(); cb.check(); expect(cb).to_be_checked()
    page.locator('#alarmOk').click(); expect(box).to_be_hidden()
    # 열차번호 중복 알람 (실무5 p.15): two numbers in one 열번창 raise an alarm pop-up
    menu(page, '현장제어', '열차제어', '열차번호제어(B)')
    page.locator('#mmiTrainStation').select_option('underground-seoul')
    slot = page.locator('#mmiTrainSlot option').first.get_attribute('value')
    for number in ['K0602', 'K0604']:
        page.select_option('#mmiTrainOp', 'insert'); page.select_option('#mmiTrainSlot', slot)
        page.fill('#mmiTrainNumber', number); page.click('#mmiTrainApply'); page.click('#dialogConfirm')
    expect(page.locator('.mmi-alarm')).to_contain_text('K0602 + K0604 열차번호 중복')
    expect(page.locator('#alarmLogBody tr').first).to_contain_text('[오류]')
    # two alarms: only the checked one is acknowledged
    page.evaluate("SimMMI.raiseAlarm('두 번째 알람')"); expect(box).to_contain_text('미확인 알람 갯수 : 2개')
    page.locator('.mmi-alarm input[data-alarm-i]').first.check(); page.locator('#alarmOk').click()
    expect(box).to_contain_text('미확인 알람 갯수 : 1개')
    page.locator('.mmi-alarm input[data-alarm-i]').first.check(); page.locator('#alarmOk').click(); expect(box).to_be_hidden()
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS MMI photo windows: menus, schedule ID, entry notices, tracking, reports at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

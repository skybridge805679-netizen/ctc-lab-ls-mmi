"""Whole-line station and timetable functional checks. Requires Playwright/Chromium."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

def open_menu(page, top, *path):
    """Open an MMI window through the real menu bar: top menu, then each submenu entry."""
    page.locator('.mmi-top-btn', has_text=top).click()
    for name in path[:-1]:
        page.locator('.mmi-menu-list .has-sub > button', has_text=name).first.click()
    page.locator('.mmi-menu-list [data-mmi-open]', has_text=path[-1]).first.click()


def front(page, window_id):
    """Bring an MMI window to the front through the menu (windows overlap like on the real MMI)."""
    if window_id == 'graph':
        open_menu(page, '열차스케줄', '온라인 열차그래프(O)')
    else:
        open_menu(page, '열차스케줄', '온라인열차스케줄 관리', '온라인 열차스케줄관리(G)')


ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check(page, url, screenshot=False):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    expect(page.locator('#stationSelect option')).to_have_count(15)
    stations = page.locator('#stationSelect option').evaluate_all('(options)=>options.map(o=>({id:o.value,label:o.textContent}))')
    for station in stations:
        page.locator('#lsStationSelect').select_option(station['id'])
        expect(page.locator('#stationSelect')).to_have_value(station['id'])
        expect(page.locator('#stationScope')).to_contain_text(station['label'].split(' [')[0].split(' ·')[0])
        # The LS is drawn as vector; no background image may be used.
        expect(page.locator('#trackSvg image')).to_have_count(0)
        expect(page.locator('#trackSvg .bed-inner path').first).to_be_attached()
        if '비연동' in station['label']:
            expect(page.locator('#mmiApply')).to_be_disabled()
            continue
        page.locator('input[name="mmiMode"][value="CCM"]').check()
        page.locator('#mmiApply').click()
        expect(page.locator('#stateMode')).to_have_text('CCM')
        page.locator('#controlSelect').select_option('route')
        signal = page.locator('#mmiSignal').input_value()
        page.locator('#mmiApply').click()
        expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
        page.locator(f'[data-control-station="{station["id"]}"][data-primary="true"] [data-signal="{signal}"]').click()
        page.locator('#actionDialog button[value="cancel"]').click()
        expect(page.locator('#actionDialog')).not_to_be_visible()
        expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
        page.locator('input[name="routeAction"][value="withdraw"]').check()
        page.locator('#mmiApply').click()
        expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
        page.locator('#controlSelect').select_option('mode')
    # A similarly named route in another station must not complete a Seoul exercise.
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('#taskSelect').select_option('2')
    page.locator('#startTask').click()
    page.locator('#stationSelect').select_option('cheongnyangni')
    page.locator('[data-control-station="cheongnyangni"][data-primary="true"] [data-signal="1A"]').click()
    page.locator('[data-route-choice="1A-1T"]').click()
    page.locator('#checkTask').click()
    expect(page.locator('#completedCount')).to_have_text('0 / 10 완료')
    expect(page.locator('#toast')).to_contain_text('지하서울로 전환')
    page.locator('#controlSelect').select_option('route')
    page.locator('input[name="routeAction"][value="withdraw"]').check()
    page.locator('#mmiApply').click()
    # Establish a route and verify it survives a station round trip.
    page.locator('#stationSelect').select_option('guro')
    page.locator('#controlSelect').select_option('route')
    page.locator('#mmiApply').click()
    expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
    page.locator('#stationSelect').select_option('cheongnyangni')
    expect(page.locator('#stateRoutes')).to_have_text('0개 설정')
    page.locator('#stationSelect').select_option('guro')
    expect(page.locator('#stateRoutes')).to_have_text('1개 설정')
    page.locator('#pauseBtn').click()
    open_menu(page, '열차스케줄', '온라인 열차그래프(O)')
    expect(page.locator('#diaSvg [data-dia-train]')).to_have_count(12)
    expect(page.locator('#diaSvg [data-dia-station], #diaSvg [data-dia-stop]')).to_have_count(33)
    expect(page.locator('#graphDetails tbody tr')).to_have_count(33)
    page.locator('#graphSearch').fill('K1002')
    page.locator('#graphFind').click()
    expect(page.locator('#graphTrain')).to_have_value('K1002')
    expect(page.locator('#graphDetails h3')).to_contain_text('상행')
    page.locator('#graphSearch').fill('missing')
    page.locator('#graphFind').click()
    expect(page.locator('#graphMessage')).to_contain_text('없습니다')
    page.locator('#graphTrain').select_option('K1131')
    before = page.locator('#graphDetails tbody tr').all_text_contents()
    page.locator('#graphDelayStation').select_option('guro')
    page.locator('#graphApplyDelay').click()
    after = page.locator('#graphDetails tbody tr').all_text_contents()
    assert before[:18] == after[:18] and before[18] != after[18]
    expect(page.locator('#graphMessage')).to_contain_text('2분 지연')
    page.locator('#graphCancel').click()
    expect(page.locator('#graphDetails h3')).to_contain_text('운휴')
    page.locator('#graphCancel').click()
    expect(page.locator('#graphDetails h3')).not_to_contain_text('운휴')
    page.locator('#graphDirection').select_option('up')
    expect(page.locator('#diaSvg [data-dia-train]')).to_have_count(6)
    page.locator('#graphDirection').select_option('all')
    page.locator('#graphFrom').select_option('guro')
    page.locator('#graphTo').select_option('suwon')
    expect(page.locator('#diaSvg [data-dia-station], #diaSvg [data-dia-stop]')).to_have_count(15)
    page.locator('#graphSpan').select_option('30')
    before_path = page.locator('[data-dia-train="K1131"]').get_attribute('d')
    page.locator('#graphSpan').select_option('60')
    assert page.locator('[data-dia-train="K1131"]').get_attribute('d') != before_path
    page.locator('#diaSvg [data-dia-station="anyang"]').press('Enter')
    expect(page.locator('#stationSelect')).to_have_value('anyang')
    expect(page.locator('#graphDelayStation')).to_have_value('anyang')
    now = int(page.locator('#diaNow').get_attribute('data-seconds'))
    page.locator('#skipBtn').click()
    expect(page.locator('#diaNow')).to_have_attribute('data-seconds', str(now+10))
    with page.expect_download() as download_info:
        page.locator('#graphExport').click()
    exported = json.loads(Path(download_info.value.path()).read_text())
    assert len(exported['trains']) == 12 and exported['sampleSchedule']
    assert exported['changes'][0] == {'type': 'delay', 'id': 'K1131', 'station': 'guro', 'minutes': 2}
    page.locator('#graphFrom').select_option('suwon')
    page.locator('#graphTo').select_option('guro')
    expect(page.locator('#graphMessage')).to_contain_text('시작역')
    page.locator('#graphFrom').select_option('cheongnyangni')
    page.locator('#graphTo').select_option('suwon')
    # [CA028_02]: pattern-based creation, linked/single edits, partial cancel, copy, message boxes.
    def ok_box():
        page.locator('#mmiAlertOk').click()
    def mode(value):
        page.locator(f'input[name="scheduleMode"][value="{value}"]').check()
    open_menu(page, '열차스케줄', '온라인열차스케줄 관리', '온라인 열차스케줄관리(G)')
    expect(page.locator('#scheduleFrom option')).to_have_count(33)
    expect(page.locator('#scheduleTo option')).to_have_count(33)
    expect(page.locator('#scheduleList option')).to_have_count(12)
    mode('create')
    page.locator('#schedulePatternOpen').click()
    page.locator('#patApply').click()
    expect(page.locator('#scheduleCalls tbody tr')).to_have_count(33)
    expect(page.locator('#scheduleCalls tbody tr').nth(1)).to_contain_text('정차')
    expect(page.locator('#scheduleCalls tbody tr').nth(0)).to_contain_text('시발')
    expect(page.locator('#scheduleCalls tbody tr').nth(32)).to_contain_text('종착')
    expect(page.locator('#graphTrain option')).to_have_count(12)
    page.locator('#scheduleNumber').fill('K1131')
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('중복')
    ok_box()
    expect(page.locator('#graphTrain option')).to_have_count(12)
    page.locator('#scheduleNumber').fill('K2001')
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('생성 완료')
    ok_box()
    expect(page.locator('#graphTrain option')).to_have_count(13)
    expect(page.locator('#graphTrain')).to_have_value('K2001')
    expect(page.locator('#scheduleList')).to_have_value('K2001')
    original_row = page.locator('#graphDetails tbody tr').nth(3).text_content()
    page.locator('input[name="scheduleEditType"][value="single"]').check()
    page.locator('#scheduleCalls [data-call="3"][data-field="departure"]').fill('09:07:40')
    page.locator('#scheduleCalls [data-call="3"][data-field="arrivalRoute"]').fill('1b_2t')
    page.locator('#scheduleKind').select_option('회송열차')
    page.locator('#scheduleCars').fill('8')
    page.locator('#scheduleRelated').fill('K1002')
    assert page.locator('#graphDetails tbody tr').nth(3).text_content() == original_row
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료')
    ok_box()
    expect(page.locator('#graphDetails tbody tr').nth(3)).to_contain_text('09:07:40')
    # linked edit moves every later time of the section
    page.locator('input[name="scheduleEditType"][value="linked"]').check()
    page.locator('#scheduleEditTo').select_option('suwon')
    before = page.locator('#scheduleCalls [data-call="5"][data-field="departure"]').input_value()
    page.locator('#scheduleCalls [data-call="4"][data-field="arrival"]').fill('09:11:00')
    page.locator('#scheduleCalls [data-call="4"][data-field="arrival"]').press('Tab')
    after = page.locator('#scheduleCalls [data-call="5"][data-field="departure"]').input_value()
    assert before != after
    page.locator('#scheduleDiscard').click()
    assert page.locator('#scheduleCalls [data-call="5"][data-field="departure"]').input_value() == before
    # partial 운휴 then whole-train 운휴
    page.locator('input[name="scheduleCancelType"][value="part"]').check()
    page.locator('#scheduleCancelFrom').select_option('dongmyo')
    page.locator('#scheduleCancelTo').select_option('jonggak')
    page.locator('#scheduleSuspend').click()
    expect(page.locator('.mmi-alert')).to_contain_text('운휴 설정')
    ok_box()
    expect(page.locator('#scheduleCalls tbody tr.cx')).to_have_count(5)
    page.locator('#scheduleResume').click()
    ok_box()
    expect(page.locator('#scheduleCalls tbody tr.cx')).to_have_count(0)
    page.locator('input[name="scheduleCancelType"][value="all"]').check()
    page.locator('#scheduleSuspend').click()
    ok_box()
    expect(page.locator('#graphDetails h3')).to_contain_text('운휴')
    expect(page.locator('#scheduleList option[value="K2001"]')).to_contain_text('미운행열차')
    page.locator('#scheduleCars').fill('7')
    page.locator('#scheduleDiscard').click()
    expect(page.locator('#scheduleCars')).to_have_value('8')
    mode('copy')
    page.locator('#scheduleStart').fill('10:00:00')
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('복사 완료')
    ok_box()
    expect(page.locator('#graphTrain option')).to_have_count(14)
    expect(page.locator('#graphTrain')).to_have_value('C2001')
    expect(page.locator('#graphDetails h3')).not_to_contain_text('운휴')
    expect(page.locator('#graphDetails')).to_contain_text('10:00:00')
    front(page, 'graph')
    page.locator('#graphApplyDelay').click()
    front(page, 'schedule')
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('다시 조회')
    ok_box()
    mode('create')
    page.locator('#schedulePatternOpen').click()
    page.locator('#patApply').click()
    page.locator('#scheduleNumber').fill('K2001')
    page.locator('#scheduleApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('중복')
    ok_box()
    expect(page.locator('#graphTrain option')).to_have_count(14)
    mode('edit')
    page.locator('#scheduleSearch').fill('K2001')
    page.locator('#scheduleFind').click()
    expect(page.locator('#scheduleList')).to_have_value('K2001')
    expect(page.locator('#scheduleList option[value="K2001"]')).to_contain_text('미운행열차')
    front(page, 'graph')
    with page.expect_download() as info:
        page.locator('#graphExport').click()
    final = json.loads(Path(info.value.path()).read_text())
    assert len(final['trains']) == 14
    edited = next(t for t in final['trains'] if t['id'] == 'K2001')
    assert edited['carCount'] == 8 and edited['relatedTrain'] == 'K1002'
    assert edited['calls'][3]['arrivalRoute'] == '1B_2T' and edited['cancelled'], (edited['calls'][3], edited['cancelled'])
    page.locator('#graphTrain').select_option('K1131')
    page.locator('#graphSearch').fill('K1131')
    page.locator('#graphSpan').select_option('120')
    if screenshot:
        page.locator('#graphPanel').screenshot(path=str(ROOT.parent/'docs/preview-v0.14.0-diagram.png'), style='#toast {visibility:hidden}')
        page.locator('#schedulePanel').screenshot(path=str(ROOT.parent/'docs/preview-v0.14.0-schedule-editor.png'), style='#toast {visibility:hidden}')
    assert not errors, errors


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for width, height in [(1440, 1000), (1920, 1080)]:
            context = browser.new_context(viewport={'width': width, 'height': height})
            check(context.new_page(), f'http://127.0.0.1:{server.server_port}/', screenshot=width==1440)
            context.close()
            print(f'PASS 15 station selectors / 33 timetable stops / 15 route controls / graph + schedule create/edit/copy/cancel at {width}x{height}')
        browser.close()
finally:
    server.shutdown()
    server.server_close()

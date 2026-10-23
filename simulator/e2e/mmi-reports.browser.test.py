"""시스템 조회 windows built from the 실기1 search conditions (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def menu(page, top, *path):
    page.locator('.mmi-top-btn', has_text=top).click()
    for name in path[:-1]:
        page.locator('.mmi-menu-list .has-sub > button', has_text=name).first.click()
    page.locator('.mmi-menu-list [data-mmi-open], .mmi-menu-list [data-mmi-act]', has_text=path[-1]).first.click()


def rows(page, rid):
    return page.locator(f'#{rid}Body tr:not(.empty)')


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
    # 열차위치목록: 선/운행방향/구분/열차종별 + 열차번호찾기
    menu(page, '시스템 조회', '열차위치목록 조회')
    expect(rows(page, 'trainPositions')).to_have_count(12)
    page.locator('#trainPositionsState').select_option('운행중'); page.locator('#trainPositionsSearch').click()
    expect(rows(page, 'trainPositions')).to_have_count(2)
    page.locator('#trainPositionsState').select_option(''); page.locator('#trainPositionsSearch').click()
    page.locator('#trainPositionsFind').fill('K1133'); page.locator('#trainPositionsFindBtn').click()
    expect(page.locator('#trainPositionsBody tr.sel')).to_contain_text('K1133')
    page.locator('#trainPositionsFind').fill('Q0000'); page.locator('#trainPositionsFindBtn').click()
    expect(page.locator('.mmi-alert')).to_contain_text('찾을 수 없습니다'); page.locator('#mmiAlertOk').click()
    page.locator('#trainPositionsClose').click()
    # 역실적: date/time/direction/station -> plan vs 실적 columns
    menu(page, '시스템 조회', '실적조회', '역실적 조회')
    page.locator('#stationActualStation').select_option('cheongnyangni'); page.locator('#stationActualSearch').click()
    expect(rows(page, 'stationActual')).to_have_count(12)
    assert [h for h in page.locator('#stationActualHead th').all_inner_texts()] == ['열차등급', '열차번호', '계획도착', '계획출발', '실적도착', '정차', '실적출발', '도착진로', '출발진로']
    first = page.locator('#stationActualBody tr').first.inner_text()
    assert 'K1' in first and '08:00:00' in first, first
    page.locator('#stationActualDate').fill('2020-01-01'); page.locator('#stationActualSearch').click()
    expect(page.locator('#stationActualBody tr.empty')).to_have_count(1)
    page.locator('#stationActualClose').click()
    # 열차실적: 열차번호검색 first, then 검색
    menu(page, '시스템 조회', '실적조회', '열차실적 조회')
    page.locator('#trainActualList').click(); expect(page.locator('#trainActualTrain option')).to_have_count(12)
    page.locator('#trainActualTrain').select_option('K1131'); page.locator('#trainActualSearch').click()
    expect(rows(page, 'trainActual')).to_have_count(33)
    page.locator('#trainActualPrint').click()  # prints through a hidden frame, must not throw
    page.locator('#trainActualClose').click()
    # data-changing operations through the simulator model, then the lists
    page.evaluate("""()=>{const m=SimDiagram.getModel(),T=SimTimetable;
      T.delay(m,'K1131','guro',3);T.setCancelled(m,'K1133','dongmyo','jonggak',true);T.copy(m,'K1135','C9999',3600,{});SimDiagram.render();}""")
    menu(page, '시스템 조회', '실적조회', '지연열차조회')
    page.locator('#delayListSearch').click()
    expect(rows(page, 'delayList')).to_have_count(1)          # default 기준: 마지막 역이 지연
    page.locator('#delayListBasis').select_option('any'); page.locator('#delayListSearch').click()
    expect(rows(page, 'delayList')).to_have_count(15)
    assert '3:00' in page.locator('#delayListBody tr').first.inner_text()
    page.locator('#delayListMin').fill('5'); page.locator('#delayListSearch').click()
    expect(page.locator('#delayListBody tr.empty')).to_have_count(1)
    page.locator('#delayListClose').click()
    menu(page, '시스템 조회', '실적조회', '운휴열차조회')
    page.locator('#cancelledListSearch').click()
    expect(rows(page, 'cancelledList')).to_have_count(1)
    assert '동묘앞~종각' in page.locator('#cancelledListBody').inner_text()
    page.locator('#cancelledListClose').click()
    menu(page, '시스템 조회', '실적조회', '임시열차 조회')
    page.locator('#createdListSearch').click()
    expect(rows(page, 'createdList')).to_have_count(1)
    assert 'C9999' in page.locator('#createdListBody').inner_text()
    page.locator('#createdListClose').click()
    menu(page, '시스템 조회', '열차스케줄 이력조회', '온라인 스케줄 이력')
    page.locator('#scheduleHistorySearch').click()
    assert rows(page, 'scheduleHistory').count() >= 3
    page.locator('#scheduleHistoryUseType').check(); page.locator('#scheduleHistoryType').select_option('운휴'); page.locator('#scheduleHistorySearch').click()
    expect(rows(page, 'scheduleHistory')).to_have_count(1)
    page.locator('#scheduleHistoryUseText').check(); page.locator('#scheduleHistoryText').fill('ZZZZ'); page.locator('#scheduleHistorySearch').click()
    expect(page.locator('#scheduleHistoryBody tr.empty')).to_have_count(1)
    page.locator('#scheduleHistoryClose').click()
    # operator histories: station mode + route through the field control window
    page.locator('#stationSelect').select_option('geumcheon')
    page.locator('input[name="mmiMode"][value="CCM"]').check(); page.locator('#mmiApply').click()
    page.locator('#controlSelect').select_option('route')
    page.locator('#mmiSignal').select_option('4A'); page.locator('#mmiRoute').select_option('4A-B968T'); page.locator('#mmiApply').click()
    menu(page, '시스템 조회', '수동제어 이력 조회', '역제어모드 수동조작 이력')
    page.locator('#manualModeSearch').click()
    expect(rows(page, 'manualMode')).to_have_count(1)
    assert '→ CCM' in page.locator('#manualModeBody').inner_text()
    page.locator('#manualModeClose').click()
    menu(page, '시스템 조회', '수동제어 이력 조회', '현장설비 수동조작 이력')
    page.locator('#manualFieldKind').select_option('진로'); page.locator('#manualFieldSearch').click()
    expect(rows(page, 'manualField')).to_have_count(1)
    assert 'RT_4A_B968T진로설정' in page.locator('#manualFieldBody').inner_text()
    page.locator('#manualFieldKind').select_option('선로전환기'); page.locator('#manualFieldSearch').click()
    expect(page.locator('#manualFieldBody tr.empty')).to_have_count(1)
    page.locator('#manualFieldClose').click()
    # alarm level F/E/W/I/D in the log, 알람/이벤트 조회 filters, 확인이력 after acknowledging the pop-up
    expect(page.locator('#alarmLogBody tr').first).to_contain_text('[안내]')
    page.evaluate("SimMMI.raiseAlarm('의왕(010130)역 RT_3D_B685T진로 요구중 대향진로( )','수동진로설정불가')")
    expect(page.locator('#alarmLogBody tr').first).to_contain_text('[오류]')
    page.locator('.mmi-alarm input[data-alarm-i]').check(); page.locator('#alarmOk').click()
    menu(page, '시스템 조회', '알람/이벤트조회')
    page.locator('#alarmEventSearch').click()
    assert rows(page, 'alarmEvent').count() >= 3
    page.locator('#alarmEventUseLevel').check(); page.locator('#alarmEventLevel').select_option('E'); page.locator('#alarmEventSearch').click()
    expect(rows(page, 'alarmEvent')).to_have_count(1)
    assert '오류' in page.locator('#alarmEventBody').inner_text()
    page.locator('#alarmEventClose').click()
    menu(page, '시스템 조회', '알람메시지 확인이력 조회')
    page.locator('#alarmAckSearch').click()
    expect(rows(page, 'alarmAck')).to_have_count(1)
    assert '관제사' in page.locator('#alarmAckBody').inner_text() and 'MMI-1' in page.locator('#alarmAckBody').inner_text()
    page.locator('#alarmAckLevel').select_option('F'); page.locator('#alarmAckSearch').click()
    expect(page.locator('#alarmAckBody tr.empty')).to_have_count(1)
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS system-lookup lists: positions, station/train actuals, delay, cancelled, temporary, histories, alarms at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

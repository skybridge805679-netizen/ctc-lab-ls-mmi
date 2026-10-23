"""ORPHEIA MMI shell: menu bar, windows, alarm/event logs (Chromium). Run: python3 simulator/mmi.browser.test.py"""
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
    page.locator('.mmi-menu-list [data-mmi-open]', has_text=path[-1]).first.click()


def run(page, url, width, height):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script('window.open=()=>null')  # popups blocked: T/G stays in the MMI window
    page.goto(url, wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
    # brand: parody, never the school logo
    body = page.locator('body').inner_text()
    assert 'ORPHEIA MMI' in body and '송원' not in body and 'SONGWON' not in body.upper() and 'SWU' not in body and 'SWON' not in body
    expect(page.locator('.mmi-brand-text b').first).to_have_text('ORPHEIA')
    # menu bar exactly as photographed
    tops = page.locator('.mmi-top-btn').all_inner_texts()
    assert tops == ['프로그램', '현장제어', '열차스케줄', '시스템 조회', '시스템 관리'], tops
    page.locator('.mmi-top-btn', has_text='현장제어').click()
    labels = page.locator('.mmi-menu-top.open .mmi-menu-list button').all_inner_texts()
    assert [l.replace('▸', '').strip() for l in labels] == ['현장설비제어(A)', '열차제어', '열차번호제어(B)', '열차추적(T)'], labels
    page.keyboard.press('Escape')
    page.locator('.mmi-top-btn', has_text='열차스케줄').click()
    sched = [l.replace('▸', '').strip() for l in page.locator('.mmi-menu-top.open .mmi-menu-list button').all_inner_texts()]
    for want in ['열차운행패턴 관리(P)', '온라인열차스케줄 관리', '온라인 열차스케줄ID관리(I)', '온라인 열차스케줄관리(G)', '진입예고열차관리(E)', '온라인 열차그래프(O)', '오프라인 열차그래프(F)', '오프라인 열차스케줄']:
        assert want in sched, (want, sched)
    page.keyboard.press('Escape')
    # windows: field control is open at start; graph/schedule open from the menu and close with their X
    expect(page.locator('[data-mmi-window="field"]')).to_be_visible()
    menu(page, '열차스케줄', '온라인 열차그래프(O)')
    expect(page.locator('[data-mmi-window="graph"]')).to_be_visible()
    expect(page.locator('#diaSvg')).to_be_visible()
    page.locator('[data-mmi-window="graph"] .mmi-close').click()
    expect(page.locator('[data-mmi-window="graph"]')).to_be_hidden()
    menu(page, '열차스케줄', '온라인열차스케줄 관리', '온라인 열차스케줄관리(G)')
    expect(page.locator('[data-mmi-window="schedule"]')).to_be_visible()
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    expect(page.locator('[data-mmi-window="schedule"]')).to_be_hidden()
    # windows known from photos but not implemented say so instead of pretending
    menu(page, '현장제어', '열차제어', '열차번호제어(B)')
    expect(page.locator('#mmiTrainOp')).to_be_visible()
    page.locator('[data-mmi-window="trainNumber"] .mmi-close').click()
    # dragging by the title bar
    page.locator('[data-mmi-window="field"] .mmi-dock').click()
    title = page.locator('[data-mmi-window="field"] .mmi-title')
    before = page.locator('[data-mmi-window="field"]').evaluate('e=>[e.offsetLeft,e.offsetTop]')
    box = title.bounding_box()
    page.mouse.move(box['x'] + 80, box['y'] + 8); page.mouse.down(); page.mouse.move(box['x'] + 200, box['y'] + 60, steps=5); page.mouse.up()
    after = page.locator('[data-mmi-window="field"]').evaluate('e=>[e.offsetLeft,e.offsetTop]')
    assert after[0] > before[0] + 50 and after[1] > before[1] + 20, (before, after)
    # logs: nothing before any command
    expect(page.locator('#alarmLogBody tr.empty')).to_have_count(1)
    # CCM -> route set -> release through the field control window
    page.locator('#stationSelect').select_option('geumcheon')
    page.locator('input[name="mmiMode"][value="CCM"]').check(); page.locator('#mmiApply').click()
    expect(page.locator('#eventLogBody')).to_contain_text('금천구청[010090] CCM MODE로 전환')
    page.locator('#controlSelect').select_option('route')
    page.locator('#mmiSignal').select_option('4A'); page.locator('#mmiRoute').select_option('4A-B968T'); page.locator('#mmiApply').click()
    expect(page.locator('#alarmLogBody tr').first).to_contain_text('금천구청역 RT_4A_B968T진로설정')
    first = page.locator('#alarmLogBody tr').first.inner_text()
    assert first.startswith('[안내]') and '/' in first and ':' in first, first
    page.locator('input[name="routeAction"][value="withdraw"]').check(); page.locator('#mmiApply').click()
    expect(page.locator('#alarmLogBody tr').first).to_contain_text('금천구청역 RT_4A_B968T진로해정')
    assert page.locator('#alarmLogBody tr').count() == 2
    # base scan -> event log
    page.locator('#controlSelect').select_option('scan'); page.locator('input[name="mmiScope"][value="all"]').check(); page.locator('#mmiApply').click()
    expect(page.locator('#eventLogBody tr').first).to_contain_text('전체 제어역 Basescan 수신')
    # a reset replaces the state object: it must not be logged as a release
    page.on('dialog', lambda d: d.accept())
    page.locator('#controlSelect').select_option('route'); page.locator('#mmiSignal').select_option('4A'); page.locator('#mmiRoute').select_option('4A-B968T'); page.locator('input[name="routeAction"][value="select"]').check(); page.locator('#mmiApply').click()
    count = page.locator('#alarmLogBody tr').count()
    page.locator('#resetBtn').click()
    assert page.locator('#alarmLogBody tr').count() == count
    assert not errors, errors
    print(f'PASS ORPHEIA MMI shell: menus, windows, drag, alarm/event logs at {width}x{height}')


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width, height in ((1440, 1000), (1920, 1080)):
            page = browser.new_page(viewport={'width': width, 'height': height})
            run(page, f'http://127.0.0.1:{server.server_port}/', width, height)
            page.close()
        browser.close()
finally:
    server.shutdown()

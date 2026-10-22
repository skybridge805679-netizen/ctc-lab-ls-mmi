"""경합해소 실습 (경합 시나리오 + 실기3 경합 검지) (Chromium)."""
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def tg(page, top, *path):
    page.locator('.tg-menubar .tg-menu').filter(has_text=re.compile('^' + re.escape(top) + '$')).click()
    for name in path[:-1]:
        page.locator('.tg-has-sub > button', has_text=name).first.click()
    page.locator('.tg-list [data-tg-run]', has_text=path[-1]).first.click()


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    ok = lambda: page.locator('#mmiAlertOk').click()
    page.locator('.mmi-top-btn', has_text='열차스케줄').click(); page.locator('.mmi-menu-list [data-mmi-open="graph"]').first.click()
    tg(page, '보기(V)', '경합해소 실습')
    expect(page.locator('[data-mmi-window="conflictDrill"]')).to_be_visible()
    expect(page.locator('#drillRows tr.empty')).to_have_count(1)
    page.locator('#drillGrade').click(); expect(page.locator('#drillMsg')).to_contain_text('출제된 문제가 없습니다')
    page.locator('#drillNew').click()
    expect(page.locator('#drillMsg')).to_contain_text('출제되었습니다')
    assert page.evaluate("SimDiagram.getModel().trains.some(t=>t.id==='B0000')")
    assert page.locator('#drillRows tr:not(.empty)').count() >= 3
    page.locator('#drillNew').click(); expect(page.locator('#drillMsg')).to_contain_text('이미 출제')
    page.locator('#drillGrade').click(); expect(page.locator('#drillMsg')).to_contain_text('경합이')
    # 경합 표시 toggles the red markers on the T/G
    tg(page, '보기(V)', '경합 표시')
    assert page.locator('[data-dia-conflict]').count() >= 1
    tg(page, '보기(V)', '경합 표시')
    assert page.locator('[data-dia-conflict]').count() == 0
    # edit B0000 at 용산 (a 해소역, but not the nearest one) -> conflict gone, principle violated
    def edit_at(station_id, delta, change_routes):
        page.evaluate("SimScheduleUI.open('edit','B0000')")
        idx = page.evaluate(f"SimNetwork.stations.findIndex(s=>s.id==='{station_id}')")
        dep = page.locator(f'#scheduleCalls [data-call="{idx}"][data-field="departure"]')
        h, m, s = [int(x) for x in dep.input_value().split(':')]
        total = h * 3600 + m * 60 + s + delta
        dep.fill(f'{total // 3600:02d}:{total % 3600 // 60:02d}:{total % 60:02d}')
        if change_routes:
            for field, kind in (('arrivalRoute', 'arrival'), ('departureRoute', 'departure')):
                cur = page.locator(f'#scheduleCalls [data-call="{idx}"][data-field="{field}"]')
                options = page.evaluate(f"SimScheduleRoutes.options('{station_id}','{kind}')")
                new = next(o for o in options if o != cur.input_value())
                cur.fill(new)
        page.locator('#scheduleApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료'); ok()
        page.locator('[data-mmi-window="schedule"] .mmi-close').click()
        page.evaluate("SimMMI.open('conflictDrill')")
    edit_at('yongsan', 120, False)
    page.locator('#drillGrade').click()
    expect(page.locator('#drillMsg')).to_contain_text('해소역이 원칙과 다릅니다')
    expect(page.locator('#drillMsg')).to_contain_text('영등포')
    expect(page.locator('#drillMsg')).to_contain_text('진로')
    # reset and redo properly at 영등포 (nearest upstream 해소역) with time and routes
    page.locator('#drillReset').click()
    assert not page.evaluate("SimDiagram.getModel().trains.some(t=>t.id==='B0000')")
    page.locator('#drillNew').click()
    edit_at('yeongdeungpo', 120, False)
    page.locator('#drillGrade').click(); expect(page.locator('#drillMsg')).to_contain_text('도착진로·출발진로를 수정하지 않았습니다')
    edit_at('yeongdeungpo', 0, True)
    page.locator('#drillGrade').click(); expect(page.locator('#drillMsg')).to_contain_text('합격')
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS conflict drill: detection, markers, grading rules at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

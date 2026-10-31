"""경합 시나리오·스케줄생성 시나리오를 MMI와 열차그래프에서 수행 (Chromium)."""
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


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
    page.add_init_script('window.open=()=>null')  # popups blocked: T/G stays in the MMI window
    page.goto(url, wait_until='networkidle');page.evaluate("SimMMI.open('field');SimShell.drawer(true)")
    ok = lambda: page.locator('#mmiAlertOk').click()
    done = lambda: page.locator('#scSteps li.sc-do.done').count()
    # ------------------------------------------------------------ 경합 시나리오
    page.evaluate("SimMMI.open('scenario')")
    page.locator('#scSelect').select_option('sch-conflict'); page.locator('#scSelect').dispatch_event('change')
    page.locator('#scStart').click()
    expect(page.locator('#scProblem')).to_contain_text('B0000')
    assert done() == 0
    first = page.locator('#scSteps li.sc-do').first
    expect(first).to_contain_text('온라인 열차그래프 실행')
    page.locator('.mmi-top-btn', has_text='열차스케줄').click(); page.locator('.mmi-menu-list [data-mmi-open="graph"]').first.click()
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=1")
    # the problem is solved by searching the train, looking with the crosshair, editing time and routes at the nearest 해소역
    page.locator('#graphSearch').fill('B0000'); page.locator('#graphFind').click()
    tg(page, '화면설정(D)', '화면모드설정', '십자선보기')
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=3")
    nearest = page.evaluate("(()=>{const d=SimDrill.started();return SimTimetable.nearestResolveStation(d.station,'down');})()")
    page.evaluate("SimScheduleUI.open('edit','B0000')")
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=4")
    idx = page.evaluate("n=>SimNetwork.stations.findIndex(s=>s.id===n)", nearest)
    # wrong station first: the hint explains
    dep = page.locator(f'#scheduleCalls [data-call="{idx}"][data-field="departure"]')
    h, m, s = [int(x) for x in dep.input_value().split(':')]
    total = h * 3600 + m * 60 + s + 120
    dep.fill(f'{total // 3600:02d}:{total % 3600 // 60:02d}:{total % 60:02d}')
    for field, kind in (('arrivalRoute', 'arrival'), ('departureRoute', 'departure')):
        cur = page.locator(f'#scheduleCalls [data-call="{idx}"][data-field="{field}"]')
        options = page.evaluate(f"SimScheduleRoutes.options('{nearest}','{kind}')")
        cur.fill(next(o for o in options if o != cur.input_value()))
    page.locator('#scheduleApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료'); ok()
    page.evaluate("()=>{const s=document.querySelector('#stationSelect');s.value='%s';s.dispatchEvent(new Event('change'))}" % nearest)
    expect(page.locator('#scSteps li.sc-do.done')).to_have_count(8, timeout=5000)
    # the last step needs the spoken line ticked; the whole thing is a pass
    page.evaluate("SimMMI.run({type:'tick',seconds:60})");page.wait_for_timeout(600)
    expect(page.locator('#scStatus')).to_contain_text('합격')
    # ------------------------------------------------------------ 스케줄 생성 시나리오
    page.evaluate("SimMMI.close('schedule')") if False else None
    page.evaluate("SimMMI.open('scenario')")
    page.locator('#scSelect').select_option('sch-create'); page.locator('#scSelect').dispatch_event('change')
    page.locator('#scStart').click()
    problem = page.locator('#scProblem').inner_text()
    m = re.search(r'(상행|하행) 전동열차 (A\d{4})를 (\S+)~(\S+) 구간으로 시작시각 (\d\d:\d\d:\d\d)', problem)
    assert m, problem
    direction, tid, frm, to, start = m.groups()
    props = re.search(r'연계열차 (\S+) · 차량수 (\d+)량 · 열차등급 (\S+) · 운행구분 (\S+) · 기능열차 (\S+)로', problem)
    assert props, problem
    related, cars, kind, service, flag = props.groups()
    page.evaluate("SimScheduleUI.open('create')")
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=1")
    page.locator('#scheduleNumber').fill(tid); page.locator('#scheduleStart').fill(start)       # 임시열차번호·시작시각 (패턴 적용 때 쓰입니다)
    page.locator('#schedulePatternOpen').click()
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=2")
    names = page.evaluate("()=>Object.fromEntries(SimNetwork.stations.map(s=>[s.name,s.id]))")
    win = page.locator('[data-mmi-window="ptnLoad"]')
    win.locator('input[value="down"]' if direction == '하행' else 'input[value="up"]').check(); win.locator('[data-pl=find]').click()
    win.locator('[data-pl-id="0129103"]' if direction == '하행' else '[data-pl-id="0119103"]').click()
    win.locator('[data-pl=from]').select_option(names[frm]); win.locator('[data-pl=to]').select_option(names[to])
    win.locator('[data-pl=ok]').click()
    page.locator('#scheduleApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('완료'); ok()
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=3")
    # edit: the form is now on the new train
    page.evaluate("t=>SimScheduleUI.open('edit',t)", tid)
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=4")
    page.locator('#scheduleCars').fill(cars); page.locator('#scheduleKind').select_option(kind); page.locator('#scheduleService').select_option(service)
    if related != '(없음)':
        page.locator('#scheduleRelated').fill(related)
    for box in page.locator('input[name="scheduleFlag"]').all():
        box.set_checked(box.get_attribute('value') == flag)
    page.locator('#scheduleApply').click(); expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료'); ok()
    page.wait_for_function("()=>document.querySelectorAll('#scSteps li.sc-do.done').length>=5")
    page.evaluate("SimMMI.run({type:'tick',seconds:60})");page.wait_for_timeout(600)
    expect(page.locator('#scStatus')).to_contain_text('합격')
    assert not errors, errors
    print('schedule scenarios: ok')


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page=browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        page.close()
    browser.close(); server.shutdown()

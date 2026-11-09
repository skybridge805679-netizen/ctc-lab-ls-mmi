"""베타 피드백 「열차 스케줄 생성이 안 된다」: 빈 시간표로 시작한 앱에서 FTS 스케줄 생성 문제를 받아, 문제 화면에 나온 열차를
MMI 온라인 열차스케줄관리(생성) → 열차운행패턴선택 → 열차패턴조회 → 확인 → 편집적용으로 만들고 채점되는지 (Chromium)."""
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT))); Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox']); page = b.new_page(viewport={'width': 1600, 'height': 1000})
        errors = []; page.on('pageerror', lambda e: errors.append(str(e))); page.add_init_script('window.open=()=>null')
        page.goto(f'http://127.0.0.1:{server.server_port}', wait_until='networkidle')
        assert page.evaluate("SimRemote.snapshot.timetable.trains.length") == 0, '앱은 빈 시간표로 시작'
        # 교수: 스케줄 생성 문제 하나로 교육 시작 (조치사항 숨김 — 실제 시험처럼)
        page.evaluate("""()=>{const lib=structuredClone(SimRemote.snapshot.ftsLibrary);lib.situations.push({id:'S-CR',name:'생성',problems:['P-sch-create']});lib.scenarios.push({id:'SC-CR',name:'생성',situations:['S-CR']});
          SimRemote.command({type:'fts',op:'library',library:lib});return SimRemote.command({type:'fts',op:'start',scenario:'SC-CR',professor:'001',student:'tester',autoRun:false,showActions:false});}""")
        page.evaluate("SimRemote.command({type:'tick',seconds:1});SimRemote.poll()")
        # 교육생 문제 화면에 만들 열차(번호·방향·구간·시작시각)가 나와야 한다
        situation = page.locator('#problemPanel [data-problem-section=situation]')
        expect(situation).to_contain_text(re.compile(r'A\d{4}'))
        text = situation.inner_text()
        m = re.search(r'(하행|상행) 전동열차 (A\d{4})를 (\S+)~(\S+) 구간으로 시작시각 (\d\d:\d\d:\d\d)', text); assert m, text
        direction, number, origin, dest, start = m.groups()
        # 교육생: MMI 열차스케줄 → 온라인열차스케줄 관리 → 온라인 열차스케줄관리(G) → 생성
        page.evaluate("SimFTSUI.closeProblem?.()")   # 브라우저판에서는 문제 화면이 MMI 위에 떠 있다 (데스크톱은 별도 창)
        page.evaluate("SimMMI.open('schedule');SimShell.drawer(true)")
        page.locator('input[name="scheduleMode"][value="create"]').check(force=True)
        page.locator('#scheduleNumber').fill(number)
        page.locator('#scheduleFrom').select_option(label=origin); page.locator('#scheduleTo').select_option(label=dest)
        page.locator('#scheduleStart').fill(start)
        page.locator('button', has_text='열차운행패턴선택').first.click()
        load = page.locator('[data-mmi-window="ptnLoad"]')
        expect(load.locator('[data-pl-hint]')).to_contain_text('열차패턴조회')            # 조회 전에는 안내가 보인다
        load.locator('input[value="%s"]' % ('down' if direction == '하행' else 'up')).check()
        load.locator('[data-pl=kind]').select_option('전동열차')
        load.locator('[data-pl=find]').click()
        load.locator('[data-pl-id]', has_text='전동').first.click()
        load.locator('[data-pl=from]').select_option(label=origin); load.locator('[data-pl=to]').select_option(label=dest)
        load.locator('[data-pl=ok]').click()
        page.locator('#scheduleApply').click()
        expect(page.locator('.mmi-alert')).to_contain_text(number + ' 스케줄 생성 완료'); page.locator('#mmiAlertOk').click()
        made = page.evaluate("n=>SimRemote.snapshot.timetable.trains.find(t=>t.id===n)", number)
        assert made and made['direction'] == ('down' if direction == '하행' else 'up'), made
        # 채점: 대본의 생성 단계가 이루어졌다
        page.evaluate("SimRemote.command({type:'tick',seconds:1});SimRemote.poll()")
        done = page.evaluate("SimRemote.snapshot.scenario.run.done")
        steps = page.evaluate("SimRemote.snapshot.scenario.run.sc.steps.map(s=>s.text)")
        i = next(k for k, t in enumerate(steps) if t and '패턴으로' in t); assert done[i], (steps[i], done)
        assert not errors, errors
        b.close()
    print('PASS empty start: FTS 스케줄 생성 문제가 만들 열차를 보여 주고, MMI 생성·열차패턴조회·편집적용으로 만든 열차가 채점된다')
finally:
    server.shutdown()

"""FTS 제어통제 시스템: 문제·상황·시나리오 관리, 교육 시작 → 문제 발생 → 채점 → 교육이력, JSON 가져오기 (Chromium)."""
import json
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
    yes = lambda: page.locator('#mmiConfirmYes').click()
    page.locator('#ftsWinBtn').click()
    fts = page.locator('#ftsPanel')
    expect(fts.locator('.fts-head b')).to_have_text('FTS 제어통제 시스템')
    assert fts.locator('.fts-nav > button').all_inner_texts() == ['▸ 교육설정', '▸ 시스템관리', '▸ 사용자관리', '▸ 시나리오관리', '▸ 모니터링관리', '▸ 교육이력관리']
    expect(fts.locator('.fts-banner')).to_be_visible()
    assert fts.locator('.fts-banner').evaluate('e=>e.complete&&e.naturalWidth===2172')
    # ---- 문제 관리: write a problem with a phenomenon and a graded check
    fts.locator('[data-fts-page="problems"]').first.click()
    assert fts.locator('#pTable tr[data-key]').count() >= 20
    page.locator('#pSubject').select_option('철도관제시스템 운용'); page.locator('#pLimit').fill('120')
    page.locator('#pName').fill('의왕역 K0651열차를 B1011T 열번창으로 이동하시오')
    page.locator('#pSituation').fill('의왕역 열번 정리')
    page.locator('#pfType').select_option('insertTrain'); page.locator('#pfType').dispatch_event('change')
    page.locator('#pf-station').select_option('uiwang'); page.locator('#pf-slot').fill('B1012T'); page.locator('#pf-number').fill('K0651'); page.locator('#pfAdd').click()
    expect(page.locator('#pTabs tbody tr')).to_have_count(1)
    page.locator('[data-ptab="check"]').click()
    page.locator('#pfType').select_option('trainAt'); page.locator('#pfType').dispatch_event('change')
    page.locator('#pf-number').fill('K0651'); page.locator('#pf-station').select_option('uiwang'); page.locator('#pf-slot').fill('B1011T')
    page.locator('#pfLabel').fill('K0651 이동'); page.locator('#pfAdd').click()
    page.locator('#pSave').click(); yes(); expect(page.locator('.mmi-alert')).to_contain_text('저장'); ok()
    made = page.evaluate("SimFTSUI.library().problems.find(p=>p.name.startsWith('의왕역 K0651'))")
    assert made['phenomena'][0]['type'] == 'insertTrain' and made['checks'][0]['condition']['slot'] == 'B1011T'
    # a wrong route is refused when it is registered
    page.locator('[data-ptab="check"]').click()
    page.locator('#pfType').select_option('route'); page.locator('#pfType').dispatch_event('change')
    page.locator('#pf-station').select_option('uiwang'); page.locator('#pf-route').fill('9Z-1T'); page.locator('#pfAdd').click()
    expect(page.locator('.mmi-alert')).to_contain_text('없는 진로'); ok()
    # ---- 상황 관리: a new situation with that problem; 열차 스케줄 생성 from the online timetable
    fts.locator('[data-fts-page="situations"]').first.click()
    page.locator('#sName').fill('의왕 열번 연습'); page.locator('#sSave').click(); yes(); ok()
    page.locator('#sAddProblem').select_option(made['id']); page.locator('#sAdd').click()
    expect(page.locator('#sProblems tbody tr')).to_have_count(1)
    page.locator('input[name="schMode"][value="create"]').check(); page.locator('#schId').fill('201'); page.locator('#schName').fill('연습 스케줄'); page.locator('#schApply').click()
    expect(page.locator('.mmi-alert')).to_contain_text('01201'); ok()
    expect(page.locator('#schUp tbody tr')).to_have_count(6)
    page.locator('#schApplySit').click()
    sit = page.evaluate("SimFTSUI.library().situations.find(s=>s.name==='의왕 열번 연습')")
    assert sit['scheduleId'] == '01201' and sit['problems'] == [made['id']]
    # ---- 시나리오 관리: >> then 저장
    fts.locator('[data-fts-page="scenarios"]').first.click()
    page.locator('#cLeft tr', has_text='의왕 열번 연습').click(); page.locator('#cIn').click()
    page.locator('#cLeft tr', has_text='#2-철도관제시스템운용실무(구술)').click(); page.locator('#cIn').click()
    page.locator('#cName').fill('연습 시나리오 A'); page.locator('#cSave').click(); yes(); ok()
    scen = page.evaluate("SimFTSUI.library().scenarios.find(c=>c.name==='연습 시나리오 A')")
    assert len(scen['situations']) == 2
    # ---- 교육설정 → 시나리오 선택 → 교육 시작
    fts.locator('[data-fts-page="setup"]').first.click()
    page.locator('#suPick').click()
    picker = page.locator('[data-mmi-window="ftsPicker"]')
    picker.locator('#pkScen tr', has_text='연습 시나리오 A').click()
    expect(picker.locator('#pkProbs tbody tr')).to_have_count(1)
    picker.locator('#pkOk').click()
    expect(page.locator('#suName')).to_have_value('연습 시나리오 A')
    page.locator('#suStart').click()
    # problem 1 fires: its phenomenon puts K0651 on the LS and the 문제 발생 screen opens
    expect(page.locator('[data-mmi-window="ftsProblem"]')).to_be_visible()
    expect(page.locator('#ftsProblemBody')).to_contain_text('의왕역 K0651열차를 B1011T')
    page.wait_for_function("()=>Object.values(SimLSUI.getModel().stations.uiwang.windows).flat().some(r=>r.number==='K0651')")
    assert page.evaluate("SimDiagram.getModel().trains.length") == 12   # 01201 schedule loaded
    page.evaluate("""()=>{const m=SimLSUI.getModel().stations.uiwang;const row=m.windows['B1012T'].find(r=>r.number==='K0651');SimLSUI.dispatch({op:'move',station:'uiwang',slot:'B1012T',uid:row.uid,targetStation:'uiwang',targetSlot:'B1011T'});}""")
    page.wait_for_function("()=>SimFTSUI.session().items[0].status==='완료'")
    assert page.evaluate("SimFTSUI.session().items[0].score") == 100
    # problem 2.. are oral: graded by the instructor's 교수 확인 buttons; 문제종료 skips one
    page.locator('[data-fts-page="monitor"]').first.click()
    page.wait_for_function("()=>SimFTSUI.session().items[1].status==='진행'")
    page.locator('[data-manual="제어모드 구술"]').click()
    page.wait_for_function("()=>SimFTSUI.session().items[1].status==='완료'")
    page.wait_for_function("()=>SimFTSUI.session().items[2].status==='진행'")
    page.locator('#mNext').click()
    assert page.evaluate("SimFTSUI.session().items[2].status") == '종료'
    page.locator('#mEnd').click(); yes()
    expect(page.locator('.fts-result')).to_contain_text('결과 200/400점')
    fts.locator('[data-fts-page="history"]').first.click()
    expect(page.locator('#hTable tbody tr').first).to_contain_text('연습 시나리오 A')
    page.locator('#hTable tbody tr').first.click(); expect(page.locator('#hRows tbody tr')).to_have_count(4)
    # ---- 시스템관리: an AI-made JSON is checked before it is merged
    fts.locator('[data-fts-page="system"]').first.click()
    bad = {'problems': [{'id': 'AI-1', 'subject': '비상 시 조치', 'name': 'x', 'limit': 60, 'checks': [{'condition': {'type': 'route', 'station': 'yongsan', 'route': '9Z-1T'}}]}], 'situations': [], 'scenarios': []}
    page.locator('#libText').fill(json.dumps(bad, ensure_ascii=False)); page.locator('#libCheck').click()
    expect(page.locator('#libReport')).to_contain_text('없는 진로 9Z-1T')
    good = {'problems': [{'id': 'AI-1', 'subject': '운행선 관리', 'name': '용산역 2A-5T 장내 진로를 설정하시오', 'limit': 60, 'checks': [{'label': '2A-5T', 'condition': {'type': 'route', 'station': 'yongsan', 'route': '2A-5T'}}]}],
            'situations': [{'id': 'AI-S1', 'name': 'AI 상황', 'section': '용산-수원', 'problems': ['AI-1']}], 'scenarios': [{'id': 'AI-C1', 'name': 'AI 시나리오', 'situations': ['AI-S1']}]}
    page.locator('#libText').fill(json.dumps(good, ensure_ascii=False)); page.locator('#libPaste').click()
    expect(page.locator('.mmi-alert')).to_contain_text('가져왔습니다'); ok()
    assert page.evaluate("SimFTSUI.library().scenarios.some(c=>c.id==='AI-C1')")
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS FTS: problem/situation/scenario management, session grading, history, JSON import at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

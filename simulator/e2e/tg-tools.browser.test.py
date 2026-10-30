"""T/G chrome and functions (photos + 실기1 5장): menus, modes, Dia 보기, favourites, search (Chromium)."""
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


def open_graph(page):
    page.locator('.mmi-top-btn', has_text='열차스케줄').click()
    page.locator('.mmi-menu-list [data-mmi-open="graph"]').first.click()


def tg(page, top, *path):
    page.locator('.tg-menu').filter(has_text=re.compile('^' + re.escape(top))).click()
    for name in path[:-1]:
        page.locator('.tg-has-sub > button', has_text=name).first.click()
    page.locator('.tg-list [data-tg-run]', has_text=path[-1]).first.click()


def tg_labels(page, top, *sub):
    page.locator('.tg-menu').filter(has_text=re.compile('^' + re.escape(top))).click()
    for name in sub:
        page.locator('.tg-has-sub > button', has_text=name).first.click()
    lst = page.locator('.tg-top.open > .tg-list') if not sub else page.locator('.tg-has-sub.open > .tg-list').last
    out = [' '.join(t.replace('▸', '').split()) for t in lst.locator(':scope > li > button').all_inner_texts()]
    page.keyboard.press('Escape'); page.locator('.tg-menu').filter(has_text=re.compile('^' + re.escape(top))).click()
    return out


def plot_point(page, fx, fy):
    # bring the plot under the sticky top bar out of the way before computing screen points
    page.evaluate("document.getElementById('diaSvg').scrollIntoView({block:'center'})")
    box = page.locator('#diaSvg').bounding_box()
    return box['x'] + box['width'] * fx, box['y'] + box['height'] * fy


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script('window.open=()=>null')  # popups blocked: T/G stays in the MMI window
    page.goto(url, wait_until='networkidle')
    open_graph(page)
    expect(page.locator('#tgStatus')).to_have_text('준비')
    # menus: photographed 편집(E) plus the textbook's Dia 보기 / 화면설정 / 즐겨찾기 structure
    assert tg_labels(page, '편집(E)') == ['실행 취소 Ctrl+Z', '다시 실행 Ctrl+Shift+Z', '열차복사(C) Ctrl+C', '붙여놓기(V) Ctrl+V', '열차생성(A) Ctrl+A', '열차정보수정(F5) F5', '노트편집(N) Ctrl+N']
    assert tg_labels(page, 'Dia 보기') == ['확대/축소', '다이얼로그', '보이기/감추기', '열차색상 및 라인속성 설정']
    assert tg_labels(page, 'Dia 보기', '확대/축소') == ['시간축 확대 +', '시간축 축소 -', '역축 확대 *', '역축 축소 /']
    assert tg_labels(page, 'Dia 보기', '다이얼로그') == ['역축/시간축 설정', '열차정보보기옵션']
    assert tg_labels(page, '화면설정') == ['화면모드설정', '열차검색']
    assert tg_labels(page, '화면설정', '화면모드설정') == ['툴팁보기', '십자선보기', '돋보기', '영역확대']
    assert tg_labels(page, '즐겨찾기') == ['즐겨찾기설정', '즐겨찾기가기']
    assert tg_labels(page, '파일(F)') == ['열기(O)', '인쇄(P)']
    assert tg_labels(page, '보기(V)') == ['현재시각으로(F9) F9']
    page.keyboard.press('Escape')
    # the 18 left icons in the order the operator named them
    assert page.locator('.tg-tool').evaluate_all('b=>b.map(x=>x.title)') == ['열기', '복사', '붙여넣기', '열차생성', '열차수정', '인쇄', '이전화면', '다음화면', '열차속성', '열차보기옵션', '열차검색', '확대영역설정', '툴팁보기', '십자선보기', '영역확대', '돋보기', '즐겨찾기 설정', '즐겨찾기 가기']
    assert page.locator('.tg-tool[disabled]').count() == 0
    # right-hand scale: 4.9 per station row, 0.0 ... 156.8
    assert page.locator('[data-dia-km="cheongnyangni"]').text_content() == '0.0' and page.locator('[data-dia-km="suwon"]').text_content() == '156.8'
    # 툴팁보기 (default mode): clicking a train selects it (red dots) and shows the green box
    cx, cy = plot_point(page, .5, .5)
    page.locator('[data-dia-train="K1131"]').first.dispatch_event('click', {'clientX': cx, 'clientY': cy, 'bubbles': True})
    expect(page.locator('.tg-info')).to_contain_text('열차번호 : K1131(하행)')
    expect(page.locator('.tg-info')).to_contain_text('시발종착 : 지하청량리발 ->수원')
    expect(page.locator('.tg-info')).to_contain_text('연계열선 : 없음')
    assert page.locator('.tg-info').inner_text().count('시') >= 4
    assert page.locator('#graphTrain').input_value() == 'K1131'
    assert page.locator('[data-dia-mark="K1131"]').count() == 66
    # ... then F5 opens 열차 스케줄 수정; Ctrl+C shows nothing, Ctrl+V opens [TRN_ADD] filled with the copied train
    page.keyboard.press('F5')
    expect(page.locator('[data-mmi-window="trnEdit"]')).to_be_visible()
    expect(page.locator('#teId')).to_have_value('K1131')
    page.locator('#teCancel').click()
    page.locator('.tg-menubar').click(); page.keyboard.press('Control+c')
    expect(page.locator('#tgStatus')).to_contain_text('K1131')
    expect(page.locator('[data-mmi-window="trnAdd"]')).to_have_count(0)
    page.keyboard.press('Control+v')
    expect(page.locator('[data-mmi-window="trnAdd"]')).to_be_visible()
    expect(page.locator('#taCalls tbody tr')).to_have_count(33)
    assert page.locator('#taId').input_value() == ''
    src = page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='K1131')")
    assert page.locator('#taStart').input_value() == page.evaluate("s=>SimTimetable.clock(s)", src['calls'][0]['departure'])
    assert page.locator('#taEnd').input_value() == page.evaluate("s=>SimTimetable.clock(s)", src['calls'][-1]['arrival'])
    page.locator('#taStart').fill('13:00:00'); page.locator('#taStart').dispatch_event('change')
    page.locator('#taId').fill('C1131'); page.locator('#taOk').click()
    expect(page.locator('.mmi-alert')).to_contain_text('생성 완료'); page.locator('#mmiAlertOk').click()
    copy = page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='C1131')")
    assert copy['calls'][0]['departure'] == 5 * 3600   # 13:00
    assert copy['calls'][-1]['arrival'] - copy['calls'][0]['departure'] == src['calls'][-1]['arrival'] - src['calls'][0]['departure']
    assert [c['departureRoute'] for c in copy['calls'][:-1]] == [c['departureRoute'] for c in src['calls'][:-1]]
    # 십자선보기: left click draws the cross with "(hh시 mm분 , km)"
    page.locator('.tg-tool[title="십자선보기"]').click()
    assert page.locator('[data-dia-mark]').count() == 0
    box = page.locator('#diaSvg').bounding_box()
    page.locator('#diaSvg').click(position={'x': box['width'] * .4, 'y': box['height'] * .5})
    expect(page.locator('#diaCross')).to_have_count(1)
    assert re.fullmatch(r'\(\d\d시 \d\d분 , \d+\.\d{3}Km \)', page.locator('#diaCrossLabel').text_content()), page.locator('#diaCrossLabel').text_content()
    page.locator('.tg-tool[title="십자선보기"]').click()
    expect(page.locator('#diaCross')).to_have_count(0)
    # 돋보기: click -> magnified box
    page.locator('.tg-tool[title="돋보기"]').click()
    x, y = plot_point(page, .3, .4); page.mouse.click(x, y)
    expect(page.locator('.tg-lens')).to_have_count(1)
    page.locator('.tg-tool[title="돋보기"]').click()
    expect(page.locator('.tg-lens')).to_have_count(0)
    # 영역확대: dragging an area enlarges it at once
    page.locator('.tg-tool[title="영역확대"]').click()
    sx, sy = plot_point(page, .25, .3)
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 120, sy + 90, steps=6); page.mouse.up()
    assert page.locator('#graphSpan').input_value() not in ('360',)
    assert page.locator('#graphFrom').input_value() != 'cheongnyangni' or page.locator('#graphTo').input_value() != 'suwon'
    page.locator('.tg-tool[title="영역확대"]').click()
    # 이전화면 / 다음화면 move the graph one screen left / right
    page.locator('#graphSpan').select_option('60'); page.locator('#graphStart').fill('10:00'); page.locator('#graphStart').dispatch_event('change')
    page.locator('.tg-tool[title="다음화면"]').click()
    assert page.locator('#graphStart').input_value() == '11:00'
    page.locator('.tg-tool[title="이전화면"]').click(); page.locator('.tg-tool[title="이전화면"]').click()
    assert page.locator('#graphStart').input_value() == '09:00'
    # Dia 보기: time axis zoom, station axis zoom
    page.locator('#graphSpan').select_option('360'); page.locator('#graphFrom').select_option('cheongnyangni'); page.locator('#graphTo').select_option('suwon')
    tg(page, 'Dia 보기', '확대/축소', '시간축 확대')
    assert page.locator('#graphSpan').input_value() == '180'
    tg(page, 'Dia 보기', '확대/축소', '시간축 축소')
    assert page.locator('#graphSpan').input_value() == '360'
    row = page.locator('#graphRow').input_value()
    tg(page, 'Dia 보기', '확대/축소', '역축 확대')
    assert int(page.locator('#graphRow').input_value()) > int(row)
    tg(page, 'Dia 보기', '확대/축소', '역축 축소')
    assert page.locator('#graphRow').input_value() == row
    # 역축/시간축 설정 dialog
    tg(page, 'Dia 보기', '다이얼로그', '역축/시간축 설정')
    page.locator('#axFrom').select_option('dongmyo'); page.locator('#axTo').select_option('yongsan')
    page.locator('#axStart').fill('08:10')
    page.locator('#axEnd').fill('09:10'); page.locator('#axApply').click()
    assert page.locator('#graphFrom').input_value() == 'dongmyo' and page.locator('#graphTo').input_value() == 'yongsan'
    assert page.locator('#graphStart').input_value() == '08:10' and page.locator('#graphSpan').input_value() == '60'
    # 열차정보보기옵션: hide train numbers and the plan line, show 하행 only
    tg(page, 'Dia 보기', '다이얼로그', '열차정보보기옵션')
    page.locator('#vwNumbers').uncheck(); page.locator('#vwPlan').uncheck(); page.locator('#vwDir').select_option('down'); page.locator('#vwApply').click()
    assert page.locator('#diaSvg text', has_text='K1131').count() == 0
    assert page.locator('#graphDirection').input_value() == 'down'
    tg(page, 'Dia 보기', '다이얼로그', '열차정보보기옵션')
    page.locator('#vwNumbers').check(); page.locator('#vwPlan').check(); page.locator('#vwDir').select_option('all'); page.locator('#vwApply').click()
    # [TRN_PROPERTY] 열차색상 및 라인속성 설정 (열차속성 icon): 27 categories with the photographed values
    page.locator('.tg-tool[title="열차속성"]').click()
    expect(page.locator('[data-mmi-window="tgStyle"] .mmi-title-text')).to_have_text('[TRN_PROPERTY] 열차색상 및 라인속성 설정')
    assert page.locator('[data-sty-color]').count() == 27
    assert page.locator('[data-sty-dash="KTX"]').input_value() == 'dashdot' and page.locator('[data-sty-dash="전동(일반)"]').input_value() == 'dot'
    page.locator('[data-sty-color="전동(일반)"]').fill('#ff0000'); page.locator('[data-sty-dash="전동(일반)"]').select_option('solid'); page.locator('#stOk').click()
    path = page.locator('[data-dia-train="K1131"]').first
    assert path.get_attribute('stroke') == '#ff0000' and path.get_attribute('stroke-dasharray') in ('', None)
    tg(page, 'Dia 보기', '열차색상 및 라인속성 설정')
    assert page.locator('[data-sty-color="전동(일반)"]').input_value() == '#ff0000'
    page.locator('#stReset').click(); page.locator('#stOk').click()
    path = page.locator('[data-dia-train="K1131"]').first
    assert path.get_attribute('stroke') == '#1a5a1a' and path.get_attribute('stroke-dasharray') == '1.5 2.5'
    # 즐겨찾기 설정 / 가기
    page.locator('#graphSpan').select_option('30'); tg(page, '즐겨찾기', '즐겨찾기설정')
    page.locator('#graphSpan').select_option('360'); tg(page, '즐겨찾기', '즐겨찾기가기')
    assert page.locator('#graphSpan').input_value() == '30'
    # F9 jumps to the current time
    page.locator('#graphStart').select_option if False else None
    page.locator('#graphSpan').select_option('360')
    page.locator('.tg-menubar').click(); page.keyboard.press('F9')
    # 열차검색
    tg(page, '화면설정', '열차검색')
    page.locator('#fdNumber').fill('Z9999'); page.locator('#fdGo').click(); expect(page.locator('.mmi-alert')).to_contain_text('찾을 수 없습니다'); page.locator('#mmiAlertOk').click()
    page.locator('#fdNumber').fill('K1135'); page.locator('#fdGo').click()
    assert page.locator('#graphTrain').input_value() == 'K1135'
    # [OPN] 온라인 열차스케줄 열기 (파일 > 열기): 노선선택 경부선 -> the whole line
    tg(page, '파일(F)', '열기(O)')
    expect(page.locator('[data-mmi-window="tgOpen"] .mmi-title-text')).to_have_text('[OPN] 온라인 열차스케줄 열기')
    page.locator('#opnOk').click()
    assert page.locator('#graphFrom').input_value() == 'cheongnyangni' and page.locator('#graphTo').input_value() == 'suwon'
    # 열차생성: [PTN_LOAD] -> [TRN_ADD]; 시발시각 with 시간설정 동기화 moves every row
    page.locator('.tg-tool[title="열차생성"]').click()
    load = page.locator('[data-mmi-window="ptnLoadTg"]')
    expect(load.locator('[data-pl-id]')).to_have_count(0)
    assert load.locator('[data-pl=kind]').input_value() == 'KTX' and load.locator('input[value="down"]').is_checked()
    load.locator('[data-pl=find]').click()
    assert load.locator('[data-pl-id]').count() == 2
    load.locator('[data-pl-id="0120202"]').click()
    expect(load.locator('[data-pl=calls] tbody tr')).to_have_count(23)
    load.locator('[aria-label="영등포 정차시간"]').fill('00:03:00'); load.locator('[aria-label="영등포 정차시간"]').dispatch_event('change')
    load.locator('[data-pl=from]').select_option('yongsan')
    load.locator('[data-pl=ok]').click()
    add = page.locator('[data-mmi-window="trnAdd"]')
    expect(add.locator('.mmi-title-text')).to_have_text('[TRN_ADD] 온라인 열차 스케줄 추가')
    expect(add.locator('#taCalls tbody tr')).to_have_count(21)
    assert page.locator('#taStart').input_value() == '00:00:00'
    page.locator('#taStart').fill('10:00:00'); page.locator('#taStart').dispatch_event('change')
    assert page.locator('#taEnd').input_value() == '10:33:00'   # 용산 00:03:30 -> 수원 00:36:30 (영등포 dwell edited alone)
    page.locator('#taOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('열차번호'); page.locator('#mmiAlertOk').click()
    page.locator('#taId').fill('A0101'); page.locator('#taKind').select_option('무궁화호'); page.locator('#taOk').click()
    expect(page.locator('.mmi-alert')).to_contain_text('생성 완료'); page.locator('#mmiAlertOk').click()
    made = page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='A0101')")
    assert made['kind'] == '무궁화호' and made['calls'][0]['station'] == 'yongsan' and len(made['calls']) == 21
    # 열차수정 (F5 window): 계획정보 edit with 동기화 + 실적정보 table
    page.locator('.tg-tool[title="열차수정"]').click()
    expect(page.locator('#teId')).to_have_value('A0101')
    expect(page.locator('#teActual tbody tr')).to_have_count(21)
    page.locator('#teCalls [aria-label="노량진 출발시간"]').fill('10:03:00'); page.locator('#teCalls [aria-label="노량진 출발시간"]').dispatch_event('change')
    assert page.locator('#teEnd').input_value() == '10:34:00'
    page.locator('#teOk').click(); expect(page.locator('.mmi-alert')).to_contain_text('편집 적용 완료'); page.locator('#mmiAlertOk').click()
    assert page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='A0101').calls.at(-1).arrival") == page.evaluate("SimDiagram.getModel().trains.find(t=>t.id==='A0101').plan.at(-1).arrival") + 60
    # 복사 / 붙여넣기 icons: the same as Ctrl+C / Ctrl+V
    page.locator('#graphTrain').select_option('K1133')
    page.locator('.tg-tool[title="복사"]').click()
    expect(page.locator('#tgStatus')).to_contain_text('K1133')
    page.locator('.tg-tool[title="붙여넣기"]').click()
    expect(page.locator('#taCalls tbody tr').first).to_contain_text('지하청량리')
    page.locator('#taCancel').click()
    # dark label column / header like the real T/G
    assert page.locator('#diaSvg > rect').first.get_attribute('fill') == '#1e1e1e'
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS T/G: menus, modes, Dia 보기, styles, favourites, search, edit actions at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

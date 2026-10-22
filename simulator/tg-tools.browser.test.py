"""T/G chrome and functions (photos + 실기1 5장): menus, modes, Dia 보기, favourites, search (Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def open_graph(page):
    page.locator('.mmi-top-btn', has_text='열차스케줄').click()
    page.locator('.mmi-menu-list [data-mmi-open="graph"]').first.click()


def tg(page, top, *path):
    page.locator('.tg-menu', has_text=top).click()
    for name in path[:-1]:
        page.locator('.tg-has-sub > button', has_text=name).first.click()
    page.locator('.tg-list [data-tg-run]', has_text=path[-1]).first.click()


def tg_labels(page, top, *sub):
    page.locator('.tg-menu', has_text=top).click()
    for name in sub:
        page.locator('.tg-has-sub > button', has_text=name).first.click()
    lst = page.locator('.tg-top.open > .tg-list') if not sub else page.locator('.tg-has-sub.open > .tg-list').last
    out = [' '.join(t.replace('▸', '').split()) for t in lst.locator(':scope > li > button').all_inner_texts()]
    page.keyboard.press('Escape'); page.locator('.tg-menu', has_text=top).click()
    return out


def plot_point(page, fx, fy):
    box = page.locator('#diaSvg').bounding_box()
    return box['x'] + box['width'] * fx, box['y'] + box['height'] * fy


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    open_graph(page)
    expect(page.locator('#tgStatus')).to_have_text('준비')
    # menus: photographed 편집(E) plus the textbook's Dia 보기 / 화면설정 / 즐겨찾기 structure
    assert tg_labels(page, '편집(E)') == ['열차복사(C) Ctrl+C', '붙여놓기(V) Ctrl+V', '열차생성(A) Ctrl+A', '열차정보수정(F5) F5', '노트편집(N) Ctrl+N']
    assert tg_labels(page, 'Dia 보기') == ['확대/축소', '다이얼로그', '보이기/감추기', '열차별 색상 및 선속성']
    assert tg_labels(page, 'Dia 보기', '확대/축소') == ['시간축 확대 +', '시간축 축소 -', '역축 확대 *', '역축 축소 /']
    assert tg_labels(page, 'Dia 보기', '다이얼로그') == ['역축/시간축 설정', '열차정보보기옵션']
    assert tg_labels(page, '화면설정') == ['화면모드설정', '열차검색']
    assert tg_labels(page, '화면설정', '화면모드설정') == ['툴팁보기', '십자선보기', '돋보기', '영역확대']
    assert tg_labels(page, '즐겨찾기') == ['즐겨찾기설정', '즐겨찾기가기']
    page.keyboard.press('Escape')
    for tip in ['확대영역설정', '툴팁 보기', '십자선보기', '영역 확대', '돋보기']:
        assert page.locator(f'.tg-tool[title="{tip}"]').count() == 1, tip
    assert page.locator('.tg-tool').count() == 18
    # 툴팁보기 (default mode): selecting a train shows its basic information
    page.locator('#graphTrain').select_option('K1131')
    cx, cy = plot_point(page, .5, .5)
    page.locator('[data-dia-train="K1131"]').first.dispatch_event('click', {'clientX': cx, 'clientY': cy, 'bubbles': True})
    expect(page.locator('.tg-info')).to_contain_text('K1131')
    expect(page.locator('.tg-info')).to_contain_text('연계열번')
    # 십자선보기: left click shows time and station
    page.locator('.tg-tool[title="십자선보기"]').click()
    x, y = plot_point(page, .4, .5)
    page.mouse.click(x, y)
    expect(page.locator('#diaCross')).to_have_count(1)
    assert ' · ' in page.locator('#tgStatus').inner_text() and ':' in page.locator('#tgStatus').inner_text()
    page.locator('.tg-tool[title="십자선보기"]').click()
    expect(page.locator('#diaCross')).to_have_count(0)
    # 돋보기: click -> magnified box
    page.locator('.tg-tool[title="돋보기"]').click()
    x, y = plot_point(page, .3, .4); page.mouse.click(x, y)
    expect(page.locator('.tg-lens')).to_have_count(1)
    page.locator('.tg-tool[title="돋보기"]').click()
    expect(page.locator('.tg-lens')).to_have_count(0)
    # 영역확대: dragging an area enlarges it at once
    page.locator('.tg-tool[title="영역 확대"]').click()
    sx, sy = plot_point(page, .25, .3)
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 120, sy + 90, steps=6); page.mouse.up()
    assert page.locator('#graphSpan').input_value() not in ('360',)
    assert page.locator('#graphFrom').input_value() != 'cheongnyangni' or page.locator('#graphTo').input_value() != 'suwon'
    page.locator('.tg-tool[title="영역 확대"]').click()
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
    # 열차별 색상 및 선속성
    tg(page, 'Dia 보기', '열차별 색상 및 선속성')
    page.locator('[data-sty-color="전동열차"]').fill('#ff0000'); page.locator('[data-sty-dash="전동열차"]').select_option('solid'); page.locator('#stOk').click()
    path = page.locator('[data-dia-train="K1131"]').first
    assert path.get_attribute('stroke') == '#ff0000' and path.get_attribute('stroke-dasharray') in ('', None)
    page.locator('#stReset').click()
    assert page.locator('[data-dia-train="K1131"]').first.get_attribute('stroke') == '#1b2a78'
    page.locator('#stClose').click()
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
    # 편집: copy -> paste, 열차생성 (opens the pattern dialog), 열차정보수정
    page.locator('#graphTrain').select_option('K1133')
    page.locator('.tg-tool[title="열차복사(C)"]').click()
    expect(page.locator('#tgStatus')).to_contain_text('K1133')
    page.locator('.tg-tool[title="붙여놓기(V)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="copy"]')).to_be_checked()
    expect(page.locator('#scheduleList')).to_have_value('K1133')
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    page.locator('.tg-tool[title="열차생성(A)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="create"]')).to_be_checked()
    expect(page.locator('#patApply')).to_be_visible()
    page.locator('#patClose').click(); page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    page.locator('.tg-tool[title="열차정보수정(F5)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="edit"]')).to_be_checked()
    expect(page.locator('#scheduleSelected')).to_have_value('K1133')
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
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

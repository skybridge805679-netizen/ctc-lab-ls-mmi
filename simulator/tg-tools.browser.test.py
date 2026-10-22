"""T/G chrome from the photos: 편집 menu, icon toolbar, crosshair, area zoom, copy/paste/create/edit (Chromium)."""
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


def run(page, url):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url, wait_until='networkidle')
    open_graph(page)
    expect(page.locator('#tgStatus')).to_have_text('준비')
    # 편집(E) menu entries and shortcuts exactly as photographed
    page.locator('.tg-menu', has_text='편집(E)').click()
    items = page.locator('.tg-top.open .tg-list li button').all_inner_texts()
    flat = [' '.join(i.split()) for i in items]
    assert flat == ['열차복사(C) Ctrl+C', '붙여놓기(V) Ctrl+V', '열차생성(A) Ctrl+A', '열차정보수정(F5) F5', '노트편집(N) Ctrl+N'], flat
    page.keyboard.press('Escape'); page.locator('.tg-menu', has_text='편집(E)').click()  # close
    # tooltips of the icons that were photographed
    for tip in ['확대영역설정', '툴팁 보기', '십자선보기', '영역 확대', '돋보기']:
        assert page.locator(f'.tg-tool[title="{tip}"]').count() == 1, tip
    assert page.locator('.tg-tool').count() == 18
    assert page.locator('.tg-tool:disabled').count() >= 8
    # copy -> paste opens the schedule window in copy mode for that train
    page.locator('#graphTrain').select_option('K1133')
    page.locator('.tg-tool[title="열차복사(C)"]').click()
    expect(page.locator('#tgStatus')).to_contain_text('K1133')
    page.locator('.tg-tool[title="붙여놓기(V)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="copy"]')).to_be_checked()
    expect(page.locator('#scheduleList')).to_have_value('K1133')
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    page.locator('.tg-tool[title="열차생성(A)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="create"]')).to_be_checked()
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    page.locator('.tg-tool[title="열차정보수정(F5)"]').click()
    expect(page.locator('input[name="scheduleMode"][value="edit"]')).to_be_checked()
    expect(page.locator('#scheduleSelected')).to_have_value('K1133')
    page.locator('[data-mmi-window="schedule"] .mmi-close').click()
    # tooltips toggle removes the <title> of the train lines
    assert page.locator('[data-dia-train] title').count() > 0
    page.locator('.tg-tool[title="툴팁 보기"]').click()
    assert page.locator('[data-dia-train] title').count() == 0
    page.locator('.tg-tool[title="툴팁 보기"]').click()
    # crosshair: status shows time and station under the pointer
    page.locator('.tg-tool[title="십자선보기"]').click()
    box = page.locator('#diaSvg').bounding_box()
    page.mouse.move(box['x'] + box['width'] * 0.4, box['y'] + box['height'] * 0.5)
    expect(page.locator('#diaCross')).to_have_count(1)
    assert ':' in page.locator('#tgStatus').inner_text() and ' · ' in page.locator('#tgStatus').inner_text()
    page.locator('.tg-tool[title="십자선보기"]').click()
    expect(page.locator('#diaCross')).to_have_count(0)
    # area zoom: drag an area, then 영역 확대 narrows time span and stations
    page.locator('.tg-tool[title="확대영역설정"]').click()
    box = page.locator('#diaSvg').bounding_box()
    sx, sy = box['x'] + box['width'] * 0.25, box['y'] + box['height'] * 0.3
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 120, sy + 90, steps=6); page.mouse.up()
    expect(page.locator('#tgStatus')).to_contain_text('영역을 지정')
    page.locator('.tg-tool[title="영역 확대"]').click()
    assert page.locator('#graphSpan').input_value() in ('30', '60', '120'), page.locator('#graphSpan').input_value()
    assert page.locator('#graphFrom').input_value() != 'cheongnyangni' or page.locator('#graphTo').input_value() != 'suwon'
    page.locator('.tg-tool[title="확대영역설정"]').click()
    # magnifier halves the span when possible
    page.locator('#graphSpan').select_option('120'); page.locator('.tg-tool[title="돋보기"]').click()
    assert page.locator('#graphSpan').input_value() == '60'
    # dark label column / header like the real T/G
    fills = page.locator('#diaSvg > rect').first.get_attribute('fill')
    assert fills == '#1e1e1e', fills
    assert not errors, errors


with sync_playwright() as p:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in [(1440, 1000), (1920, 1080)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        run(page, f'http://127.0.0.1:{server.server_port}/')
        print(f'PASS T/G chrome: 편집 menu, icon toolbar, copy/paste/create/edit, tooltips, crosshair, area zoom at {width}x{height}')
        page.close()
    browser.close(); server.shutdown()

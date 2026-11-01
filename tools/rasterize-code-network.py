"""Rasterize only this task's generated SVG; never opens existing LS reference images."""
from pathlib import Path
import argparse
import re
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('directory', nargs='?', default='docs/code-network-2026-11-01')
args = parser.parse_args()
out = Path(args.directory)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name in ['network-overview', 'network-full']:
        svg = (out / (name + '.svg')).read_text()
        width, height = map(int, re.search(r'<svg[^>]*width="(\d+)" height="(\d+)"', svg).groups())
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        page.set_content('<style>html,body{margin:0}svg{display:block}</style>' + svg)
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(out / (name + '.png')))
        page.close()
        print('PASS rasterized', name, width, height)
    svg = (out / 'network-overview.svg').read_text()
    width, height = map(int, re.search(r'<svg[^>]*width="(\d+)" height="(\d+)"', svg).groups())
    preview_width = 2400
    preview_height = round(height * preview_width / width)
    page = browser.new_page(viewport={'width': preview_width, 'height': preview_height}, device_scale_factor=1)
    page.set_content('<style>html,body{margin:0}svg{display:block;width:2400px;height:auto}</style>' + svg)
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(out / 'network-preview.png'))
    page.close()
    browser.close()

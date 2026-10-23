"""Photo-based mode confirmation, LS district/equipment colours, exclusive pointer hover."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1440,1920]:
   page=b.new_page(viewport={'width':width,'height':1080},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{s.server_port}',wait_until='networkidle');page.click('#pauseBtn')
   rgb=lambda selector:page.locator(selector).evaluate('e=>getComputedStyle(e).backgroundColor')
   blue=['cheongnyangni','dongmyo','jonggak','underground-seoul']
   for sid in page.locator('#lsStationSelect option').evaluate_all('es=>es.map(e=>e.value)'):
    page.select_option('#lsStationSelect',sid)
    assert rgb('.ls-name')==('rgb(32, 104, 230)' if sid in blue else 'rgb(8, 11, 8)'),sid
    assert page.locator('.ls-name').evaluate('e=>getComputedStyle(e).flexDirection')=='column'
    for rect in page.locator('.inter-station .plate').all():
     fill=rect.evaluate('e=>getComputedStyle(e).fill');assert fill==('rgb(32, 104, 230)' if sid in blue else 'rgb(29, 36, 30)'),(sid,fill)
   page.select_option('#lsStationSelect','suwon')
   page.locator('[data-mode="CCM"]').click();d=page.locator('#actionDialog');expect(d).to_have_class('mode-confirm')
   expect(page.locator('#dialogTitle')).to_have_text('제어확인');expect(d).to_contain_text('역 운행모드를 CCM 모드로 전환하시겠습니까?')
   expect(page.locator('#dialogConfirm')).to_have_text('예(Y)');expect(d.locator('[value="cancel"]')).to_have_text('아니요(N)')
   if width==1440:d.screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-ccm-confirm.png'))
   page.keyboard.press('n');expect(d).not_to_be_visible();page.wait_for_function('dialogAction===null');assert page.evaluate("SimField.state('suwon').mode")=='AUTO'
   page.locator('[data-mode="CCM"]').click();page.keyboard.press('y');page.wait_for_function("SimField.state('suwon').mode==='CCM'")
   for names,col in [(['N1','C','REC','UPS','ShP','EIS1','DTS1'],'rgb(24, 223, 0)'),(['N2','RC'],'rgb(242, 242, 240)'),(['EIS2','DTS2'],'rgb(244, 236, 0)')]:
    for name in names:assert rgb(f'[data-equipment="{name}"]')==col,name
   page.evaluate("SimEquipment.set('suwon','N2',true)");assert rgb('[data-equipment="N2"]')=='rgb(188, 48, 39)'
   page.locator('.mmi-alarm input[data-alarm-i]').check();page.click('#alarmOk');page.evaluate("SimEquipment.set('suwon','N2',false)");assert rgb('[data-equipment="N2"]')=='rgb(242, 242, 240)'
   page.select_option('#lsStationSelect','jonggak');page.locator('[data-mode="CCM"]').click();page.keyboard.press('y');page.wait_for_function("SimField.state('jonggak').mode==='CCM'")
   page.locator('[data-signal="53"]').click();rows=page.locator('[data-route-choice]');expect(rows).to_have_count(2)
   active='rgb(40, 101, 106)';assert rows.nth(0).evaluate('e=>getComputedStyle(e).backgroundColor')!=active
   for index in [0,1,0,1]:
    rows.nth(index).hover()
    assert [r.evaluate('e=>getComputedStyle(e).backgroundColor')==active for r in rows.all()]==[index==0,index==1]
   if width==1440:d.screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-route-hover.png'))
   page.locator('#dialogTitle').hover();assert all(r.evaluate('e=>getComputedStyle(e).backgroundColor')!=active for r in rows.all())
   page.keyboard.press('Tab');assert page.locator('[data-route-choice]:focus-visible').count()==1
   page.keyboard.press('Escape');expect(d).not_to_be_visible()
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-underground-header.png'))
   page.select_option('#lsStationSelect','suwon')
   if width==1440:page.locator('#lsDisplay').screenshot(path=str(ROOT.parent/'docs/preview-v0.18.0-suwon-header.png'))
   assert not errors,errors;print('PASS LS photo colours, 15 station names, CCM Y/N, equipment faults, exclusive hover and keyboard:',width,flush=True);page.close()
  b.close()
finally:s.shutdown()

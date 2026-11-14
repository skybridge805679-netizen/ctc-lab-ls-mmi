"""능동형 FTS 문제: 기본 비상시 조치 문제를 복사해 응용 문제를 만들고(목표·통보·상황 반응·초기 상태 편집), 교육에서 순서 없이 채점되는지."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('window.open=()=>null');page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#ftsWinBtn');fts=page.locator('#ftsPanel')
  # 기본 문제는 대본이 아니라 능동형 데이터: 목표 탭이 먼저 열리고 대본의 조작이 순서 없는 목표로 보인다
  fts.locator('[data-fts-page=problems]').first.click()
  row=page.locator('#pTable tr[data-key="P-em-02"]');expect(row).to_contain_text('능동형');row.click()
  expect(page.locator('[data-ptab="obj"]')).to_have_class('on');expect(page.locator('#pTabs tbody tr')).to_have_count(20)
  expect(page.locator('#pTabs')).to_contain_text('순서 없이');expect(page.locator('#pActions')).to_have_value(__import__('re').compile('참고 순서'))
  # 상황별 대응 요령: 비상 04에는 원문 분기 5개가 붙어 있다
  page.locator('#pTable tr[data-key="P-em-04"]').click();page.click('[data-ptab="branch"]');expect(page.locator('#pTabs tbody tr')).to_have_count(5);expect(page.locator('#pTabs')).to_contain_text('사고조치 지연')
  page.locator('#pTable tr[data-key="P-em-02"]').click();page.click('[data-ptab="obj"]')
  # 복사 (응용): 새 문제로 열리고 목표·통보·반응을 그대로 가져온다
  page.click('#pCopy');expect(page.locator('#pName')).to_have_value(__import__('re').compile(r'\(복사\)$'));page.fill('#pName','응용 · 동묘앞역 충돌 + 구로역 CCM')
  page.fill('#pfLabel','구로역 CCM 전환 (응용)');page.select_option('#pfType','mode');page.dispatch_event('#pfType','change');page.select_option('#pf-station','guro');page.fill('#pf-value','CCM');page.fill('#pfDeadline','120');page.select_option('#pfPre','rename-G0602');page.click('#pfAdd')
  expect(page.locator('#pTabs tbody tr')).to_have_count(21);expect(page.locator('#pTabs tbody tr').last).to_contain_text('기한 120초')
  page.click('[data-ptab="comm"]');expect(page.locator('#pTabs tbody tr')).to_have_count(28);page.fill('#pfLabel','구로역 CCM 통보');page.fill('#pfText','구로역, 관제 이상! CCM 전환합니다.');page.click('#pfAdd');expect(page.locator('#pTabs tbody tr')).to_have_count(29)
  page.click('[data-ptab="react"]');page.fill('#pfLabel','구로역 경보');page.select_option('#pfWhen','objective:o21');page.fill('#pfAfter','5');page.select_option('#pfType','alarm');page.dispatch_event('#pfType','change');page.fill('#pf-text','응용 상황: 구로역 선로 장애물');page.click('#pfAdd')
  expect(page.locator('#pTabs tbody tr').last).to_contain_text('5초 뒤')
  page.click('[data-ptab="setup"]');assert page.locator('#pSetupSchedule').input_value()==page.evaluate("SimFTSUI.library().problems.find(p=>p.id==='P-em-02').setup.scheduleId");setup_rows=page.locator('#pTabs tbody tr').count();page.select_option('#pfType','resetStation');page.dispatch_event('#pfType','change');page.select_option('#pf-station','guro');page.click('#pfAdd');expect(page.locator('#pTabs tbody tr')).to_have_count(setup_rows+1)
  # 잘못된 항목은 등록 전에 거른다
  page.click('[data-ptab="react"]');page.select_option('#pfType','runTrain');page.dispatch_event('#pfType','change');page.fill('#pf-number','K0602');page.fill('#pf-legs','dongmyo:없는창');page.click('#pfAdd');expect(page.locator('.mmi-alert')).to_contain_text('없는 열번창');page.click('#mmiAlertOk')
  page.click('#pSave');page.click('#mmiConfirmYes');page.click('#mmiAlertOk')
  made=page.evaluate("(()=>{const p=SimFTSUI.library().problems.find(x=>x.name==='응용 · 동묘앞역 충돌 + 구로역 CCM');return p&&{id:p.id,obj:p.objectives.length,comm:p.communications.length,react:p.reactions.length,reset:p.setup.reset,pre:p.objectives.at(-1).condition.conditions[0].id,errors:SimFTS.validate(SimFTSUI.library(),{drafts:true,scripts:SimScheduleScenarios.list.map(s=>s.id)})}})()")
  assert made and made['obj']==21 and made['comm']==29 and made['react']==8 and 'guro' in made['reset'] and made['pre']=='rename-G0602' and made['errors']==[],made
  # 교육: 비상시 조치 종합 → 첫 문제(em-01)는 초기 상태가 LS에 놓이고, 통보를 아무 순서로나 확인할 수 있다
  fts.locator('[data-fts-page=setup]').first.click();page.click('#suPick');page.locator('#pkScen tr[data-key="SC-04"]').click();page.click('#pkOk');page.uncheck('#suAuto');page.click('#suStart')
  fts.locator('[data-fts-page=monitor]').first.click()
  expect(page.locator('[data-objective="ccm-jonggak"]')).to_be_visible()
  page.wait_for_function("Object.values(SimLSUI.getModel().stations).some(s=>Object.values(s.windows).some(r=>r.some(x=>x.number==='K1137')))")
  # 상황 변경 주입: 분기 통보가 더해지고 제어통제 로그에 남는다
  inject=page.locator('[data-manual="branch:v-k1006-passed"]');inject.click();expect(inject).to_be_disabled();expect(page.locator('[data-manual="comm:v-k1006-passed-c"]')).to_be_visible()
  expect(page.locator('#ftsLog')).to_contain_text('상황 변경 · K1006 이미 통과')
  # 교육생 문제 화면에는 감독관이 알려 주는 상황 변경만 보이고 모범 대응(원문 뒤쪽)은 보이지 않는다
  change=page.locator('#problemPanel [data-problem-section=change]');expect(change).to_be_visible();expect(change).to_contain_text('K1006')
  last=page.locator('[data-manual="comm:n22"]');last.click();expect(page.locator('[data-manual="comm:n22"]')).to_be_disabled()
  expect(page.locator('[data-manual="comm:n1"]')).to_be_enabled()
  # 교수 프로그램의 기록은 FTS 제어통제 로그에만 남고, 교육생의 MMI 로그에는 남지 않는다. 문제 발생 화면은 MMI 창이 아니다.
  expect(page.locator('#ftsLog')).to_contain_text('교육 시작');expect(page.locator('#ftsLog')).to_contain_text('문제 발생')
  assert 'FTS' not in page.evaluate("JSON.stringify(SimMMI.getLogs())") and '교육 시작' not in page.evaluate("JSON.stringify(SimMMI.getLogs())")
  expect(page.locator('#problemPanel #ftsProblemBody')).to_contain_text('비상시 조治'.replace('治','치'));assert page.locator('[data-mmi-window=ftsProblem]').count()==0
  assert not errors,errors
  b.close()
 print('PASS active FTS problems: built-ins open as unordered objectives, copy-to-apply editing of objectives/communications/reactions/setup, validation before add, session setup and any-order confirmations')
finally:server.shutdown()

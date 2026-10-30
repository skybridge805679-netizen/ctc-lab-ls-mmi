"""Countdown follows exercise state and the same virtual clock as trains, across subjects and LS views."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle');page.click('#pauseBtn');expect(page.locator('#clock')).to_have_text('--:--')
  page.evaluate('run({type:"tick",seconds:25})');expect(page.locator('#clock')).to_have_text('--:--')
  page.click('#assessmentBtn');page.fill('#assessmentMinutes','2');page.select_option('#assessmentSubject','integrated');page.click('#assessmentStart');expect(page.locator('#actionDialog')).not_to_be_visible();page.click('#pauseBtn')
  remain=lambda:page.evaluate('SimAssessmentUI.snapshot().session.remaining')
  before=remain();page.click('#skipBtn');assert remain()==before-10
  page.select_option('#lsStationSelect','guro');assert remain()==before-10
  page.evaluate("SimMMI.open('scenario')");page.select_option('#scSelect','em-05-1');expect(page.locator('#scTimeLimit option')).to_have_count(3);page.select_option('#scTimeLimit','420');page.click('#scStart');page.click('#pauseBtn')
  assert page.evaluate('SimAssessmentUI.snapshot().task.limitSeconds')==420
  assert remain()<=before-10 and remain()>before-13
  page.click('#scStop');assert page.evaluate('SimAssessmentUI.snapshot().task.status')=='stopped'
  page.select_option('#scSelect','em-01');page.click('#scStart');page.click('#pauseBtn');assert page.evaluate('SimAssessmentUI.snapshot().task.limitSeconds')==360
  before=remain();page.click('#skipBtn');assert remain()==before-10
  # Zero is a deadline marker; it neither passes the scenario nor blocks LS controls.
  page.evaluate('run({type:"tick",seconds:130})');expect(page.locator('#clock')).to_have_text('00:00');expect(page.locator('#clockLabel')).to_have_text('제한시간 종료');assert page.evaluate('SimAssessmentUI.snapshot().task.status')!='completed'
  page.evaluate("SimMMI.close('scenario');selectStation('guro')");page.locator('[data-mode="CCM"]').click();page.click('#dialogConfirm');page.locator('[data-point-control="55"]').click();page.click('#dialogConfirm');page.wait_for_function("SimField.state('guro').points['55']==='R'")
  page.screenshot(path=str(ROOT.parent/'docs/preview-v0.27.0-countdown-expired.png'))
  page.click('#assessmentBtn');expect(page.locator('#dialogBody')).to_contain_text('임의로 나누지');page.click('#assessmentFinish');assert page.evaluate('SimAssessmentUI.snapshot().session.status')=='ended'
  # A source-timed refuge exercise starts its 4m30s timer, not an invented operation-subject duration.
  page.evaluate("SimMMI.open('scenario')");page.select_option('#scSelect','geumcheon-6');expect(page.locator('#scTimeLimit')).to_have_value('270');page.click('#scStart');page.click('#pauseBtn');assert page.evaluate('SimAssessmentUI.snapshot().task.limitSeconds')==270;expect(page.locator('#assessmentPhase')).to_contain_text('04:30')
  page.screenshot(path=str(ROOT.parent/'docs/preview-v0.27.0-countdown-scenario.png'))
  assert not errors,errors;print('PASS idle has no stopwatch, explicit start, shared total budget, ranged scenario limit, pause/skip/navigation, source 4m30 refuge, expiry without false pass or LS blocking');b.close()
finally:server.shutdown()

"""LS 표기 통일: 열번칸은 원본 화면(슬라이드)의 그 가로 위치에, 자기 선로와 그쪽 이웃 선로 사이에 놓이고(다른 선로를 건너지 않음),
꺾이는 선로는 모서리 밖으로 튀어나온 조각 없이 하나의 꺾인 선으로 그린다 (15개 역, Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a): pass
JS = """()=>{const svg=document.querySelector('#trackSvg');
 const beds=[...svg.querySelectorAll('.cell-bed')].map(r=>r.getBBox()),rows=[...new Set(beds.map(b=>Math.round(b.y+b.height/2)))];
 const names=[...svg.querySelectorAll('text.cell-name,text.rail-name')].map(t=>{const b=t.getBBox();return {n:t.textContent.trim(),cx:b.x+b.width/2,cy:b.y+b.height/2};});
 return [...svg.querySelectorAll('.ls-train-slot.detached')].map(g=>{const r=g.querySelector('rect').getBBox(),slot=g.dataset.trainSlot,c=names.find(x=>x.n===slot);if(!c)return null;
  const above=r.y+r.height/2<c.cy,top=r.y,bottom=r.y+r.height;
  const st=window.selectedStation||document.querySelector('[data-station-id]')?.dataset.stationId,xm=window.SimLSXMap?.[window.__st],src=(window.SimTrainWindows.data[window.__st]||[]).find(w=>w.slot===slot&&w.side!=='inline');
  const want=xm&&src?.sourceWindow&&src.slide===xm.slide?(src.sourceWindow[0]+src.sourceWindow[2]/2)*1600/xm.width:null;
  return {slot,dx:want==null?0:Math.round(r.x+r.width/2-want),crossed:rows.some(y=>Math.abs(y-c.cy)>4&&(above?(y<c.cy&&y>bottom):(y>c.cy&&y<top)))};}).filter(Boolean);}"""
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT))); Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = b.new_page(viewport={'width': 1600, 'height': 900}); page.add_init_script('window.open=()=>null')
        page.goto(f'http://127.0.0.1:{server.server_port}', wait_until='networkidle')
        rows, crossed, centred = 0, [], 0
        for st in page.evaluate("SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id)"):
            page.evaluate("id=>{selectStation(id);window.__st=id;}", st); page.wait_for_timeout(150)
            for r in page.evaluate(JS):
                rows += 1; centred += abs(r['dx']) <= 40   # 원본 위치에서 40px 안 (시저스 폭 보정·화면 끝 여백)
                if r['crossed']: crossed.append(f"{st} {r['slot']}")
        # 노량진 B618T2T도 원본처럼 1T 위 줄로 올라가 예외가 없다
        assert crossed == [], crossed
        assert rows >= 160 and centred / rows >= .85, (rows, centred)
        # 꺾이는 곳: 어느 역에서도 가로선이 꺾인 꼭짓점 바깥으로 1~40px 튀어나오지 않는다 (구로 55T 모서리 포함)
        STUB = """()=>{const P=[...document.querySelectorAll('#trackSvg .rail-network path')].map(p=>(p.getAttribute('d').match(/-?[\\d.]+/g)||[]).map(Number)).map(a=>{const o=[];for(let i=0;i+1<a.length;i+=2)o.push([a[i],a[i+1]]);return o;});
          const bends=[];for(const poly of P)poly.forEach((v,i)=>{for(const [h,o] of [[poly[i-1],poly[i+1]],[poly[i+1],poly[i-1]]]){if(h&&o&&Math.abs(h[1]-v[1])<2&&Math.abs(o[1]-v[1])>=2)bends.push({x:v[0],y:v[1],inside:Math.sign(h[0]-v[0])});}});
          const out=[];for(const poly of P){if(poly.length!==2||Math.abs(poly[0][1]-poly[1][1])>=2)continue;const [a,b]=[Math.min(poly[0][0],poly[1][0]),Math.max(poly[0][0],poly[1][0])],y=poly[0][1];
           for(const k of bends){if(Math.abs(k.y-y)>=2)continue;const cover=P.some(q=>q!==poly&&q.some((p,i)=>i&&Math.abs(p[1]-y)<2&&Math.abs(q[i-1][1]-y)<2&&Math.min(p[0],q[i-1][0])<(k.inside>0?a:k.x)+1&&Math.max(p[0],q[i-1][0])>(k.inside>0?k.x:b)-1));
            if(!cover&&((k.inside>0&&a<k.x-1&&a>k.x-40&&b>k.x)||(k.inside<0&&b>k.x+1&&b<k.x+40&&a<k.x)))out.push(Math.round(k.x)+','+Math.round(y));}}return out;}"""
        stubs = []
        for st in page.evaluate("SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id)"):
            page.evaluate("id=>selectStation(id)", st); page.wait_for_timeout(120)
            stubs += [st + ' ' + x for x in page.evaluate(STUB)]
        assert not stubs, stubs
        # 폐색호주: 표식의 기둥(⊢)이 회로 경계에 선다 — 「x~y호주 사이」가 한 회로를 가리킨다 (화면 끝 회로 몇 개만 예외)
        BLK = """()=>{const svg=document.querySelector('#trackSvg');const beds=[...svg.querySelectorAll('.cell-bed')].map(r=>{const b=r.getBBox();return {x1:b.x,x2:b.x+b.width,y:b.y+b.height/2};});
          return [...svg.querySelectorAll('.block-indicator')].map(g=>{const st=g.querySelector('.block-stem').getBBox(),body=g.querySelector('.block-body').getBBox(),bar=st.x<body.x?st.x:st.x+st.width,cy=body.y+body.height/2;
           const ry=beds.filter(b=>Math.abs(b.y-cy)<30).sort((a,b)=>Math.abs(a.y-cy)-Math.abs(b.y-cy))[0]?.y;const e=beds.filter(b=>Math.abs(b.y-ry)<3).flatMap(b=>[b.x1,b.x2]);return e.length&&Math.min(...e.map(x=>Math.abs(x-bar)))<=5;   /* 원본 칸 사이 틈(4~8px)의 가운데 */});}"""
        marks = []
        for st in page.evaluate("SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id)"):
            page.evaluate("id=>selectStation(id)", st); page.wait_for_timeout(120); marks += page.evaluate(BLK)
        assert len(marks) >= 200 and sum(marks) >= 195, (len(marks), sum(marks))
        b.close()
    print(f'PASS train windows: {centred}/{rows} at their original screen position, none crosses another track (one source exception), bends drawn without stubs')
finally:
    server.shutdown()

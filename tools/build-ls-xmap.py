#!/usr/bin/env python3
"""LS 가로 배치를 원본 화면(PPT 슬라이드 2~19)에 맞추는 좌표표를 만든다.

원본 슬라이드 이미지에서 흰 회로 칸을 찾아, 우리 회로 칸(PDF 좌표)과 행마다 순서대로 맞춘다.
- knots: PDF x -> 원본 화면 x 의 단조 함수 (역 구내 칸에 가중치를 크게 두어 선로·전철기·신호기 연결을 지킨다)
- cells: 행 안의 칸 경계를 원본 위치로 옮기기 위한 칸별 원본 좌표 (칸 테두리만 움직인다)

usage: python3 tools/build-ls-xmap.py   (cv2·numpy 필요)
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SLIDES = {'cheongnyangni': 2, 'dongmyo': 3, 'jonggak': 4, 'underground-seoul': 5, 'seoul': 6, 'yongsan': 7,
          'noryangjin': 8, 'yeongdeungpo': 9, 'guro': 10, 'geumcheon': 11, 'anyang': 12, 'geumjeong': 14,
          'gunpo': 15, 'uiwang': 17, 'suwon': 19}
CORE_WEIGHT = 12


def slide_bars(slide):
    """흰 회로 칸: 행 띠마다 칸의 위·아래 테두리 줄(글자가 없는 줄)을 가로로 읽어 칸을 나눈다."""
    im = cv2.imread(str(ROOT / f'simulator/assets/stations/slide{slide}.png'))
    b, g, r = (im[:, :, i].astype(int) for i in range(3))
    white = (r > 215) & (g > 215) & (b > 215)
    cnt = white.sum(1)
    bands = []
    for y in range(150, im.shape[0]):
        if cnt[y] > 300:
            if bands and y - bands[-1][1] <= 1:
                bands[-1][1] = y
            else:
                bands.append([y, y])
    out = []
    for t, bt in bands:
        h = bt - t + 1
        cands = [(t, bt)] if 12 <= h <= 22 else [(t, t + 17), (bt - 17, bt)] if h > 22 else []
        for top, bot in cands:
            line = white[top + 1] | white[bot - 1]
            if line.sum() < 0.5 * len(line):   # 열번창 줄(띄엄띄엄 놓인 흰 상자)은 선로 행이 아니다
                continue
            x, W = 0, len(line)
            while x < W:
                if line[x]:
                    s0 = x
                    while x < W and line[x]:
                        x += 1
                    if x - s0 >= 15:
                        out.append((s0, top, x - s0, bot - top + 1))
                else:
                    x += 1
    return out, im.shape[1]


def our_cells():
    js = ("const LS=require('./simulator/ui/ls-view.js'),N=require('./simulator/engine/network.js');const o={};"
          "const W=require('./simulator/engine/wiring.js');"
          f"for(const id of {json.dumps(list(SLIDES))}){{const xs=W.data[id].rails.flatMap(r=>r[1].map(p=>p[0]));o[id]={{cells:LS.sceneOf(N.catalog[id]).cells,railMin:Math.min(...xs),railMax:Math.max(...xs),signals:W.data[id].signals}};}}"
          "process.stdout.write(JSON.stringify(o))")
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


def seeds(sid, slide, cells):
    R = ROOT / 'references/transcriptions'
    recs = json.loads((R / 'block-signals.json').read_text())['indicators'] + json.loads((R / 'train-windows.json').read_text())['windows']
    seen, out = set(), []
    for r in recs:
        if r.get('slide') != slide or not r.get('sourceCell') or not r.get('code'):
            continue
        key = (r['code'], round(r['sourceCell'][1] / 10))
        if key in seen:
            continue
        seen.add(key)
        mine = [c for c in cells if r['code'] in c[3].split(' · ') or c[3].replace(' · ', '') == r['code']]
        if len(mine) == 1:
            c, s = mine[0], r['sourceCell']
            out.append((c, (s[0], s[0] + s[2]), s[1] + s[3] / 2))
    return out


def isotonic(points):
    """weighted pool-adjacent-violators on (x, y, w) sorted by x -> knots"""
    blocks = []
    for x, y, w in sorted(points):
        blocks.append([y * w, w, [x]])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] > blocks[-1][0] / blocks[-1][1]:
            a = blocks.pop()
            blocks[-1][0] += a[0]; blocks[-1][1] += a[1]; blocks[-1][2] += a[2]
    return [(float(np.mean(b[2])), b[0] / b[1]) for b in blocks]


def min_slope(knots, ratio=0.45):
    """어느 구간도 평균 기울기의 ratio 배보다 눌리지 않게 한다 (시저스 크로싱이 찌그러지지 않게). 양 끝 좌표는 유지."""
    if len(knots) < 3:
        return knots
    xs = [k[0] for k in knots]; ys = [k[1] for k in knots]
    smin = ratio * (ys[-1] - ys[0]) / max(1e-6, xs[-1] - xs[0])
    dx = [xs[i] - xs[i - 1] for i in range(1, len(xs))]
    dy = [max(ys[i] - ys[i - 1], smin * dx[i - 1]) for i in range(1, len(ys))]
    base = [smin * d for d in dx]
    extra = sum(dy) - (ys[-1] - ys[0])
    room = sum(a - b for a, b in zip(dy, base))
    f = max(0.0, 1 - extra / room) if room > 0 else 0.0
    dy = [b + (a - b) * f for a, b in zip(dy, base)]
    out, y = [(xs[0], ys[0])], ys[0]
    for i, d in enumerate(dy):
        y += d; out.append((xs[i + 1], y))
    return out


def interp(knots, x):
    kx, ky = [k[0] for k in knots], [k[1] for k in knots]
    if len(kx) == 1:
        return ky[0] + x - kx[0]
    if x <= kx[0]:
        return ky[0] + (x - kx[0]) * (ky[1] - ky[0]) / max(1e-6, kx[1] - kx[0])
    if x >= kx[-1]:
        return ky[-1] + (x - kx[-1]) * (ky[-1] - ky[-2]) / max(1e-6, kx[-1] - kx[-2])
    return float(np.interp(x, kx, ky))


def rows_of(items, key, tol=5):
    rows = {}
    for it in items:
        k = next((k for k in rows if abs(k - key(it)) < tol), None)
        rows.setdefault(k if k is not None else key(it), []).append(it)
    return rows


def build(sid, slide, scene):
    bars, width = slide_bars(slide)
    cells = scene['cells']
    ours = [c for c in cells if c[2] >= 8]
    seed = seeds(sid, slide, ours)
    ys = [(c[1], py) for c, _, py in seed]
    # 행마다 전사 높이의 중앙값을 쓴다 (다른 행 위치로 잘못 기록된 몇 개가 행 대응을 흐트러뜨리지 않게)
    groups = rows_of(ys, lambda t: t[0])
    pts = [(float(np.median([a for a, _ in g])), float(np.median([b for _, b in g]))) for g in groups.values()]
    # 두 행씩 골라 가장 많은 행이 맞는 직선을 고른다 (잘못 기록된 행 하나가 전체를 기울이지 않게)
    best = None
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            (a0, b0), (a1, b1) = pts[i], pts[j]
            if abs(a1 - a0) < 20:
                continue
            k = (b1 - b0) / (a1 - a0)
            if not 0.6 < k < 2.0:
                continue
            inl = [(a, b) for a, b in pts if abs(b0 + k * (a - a0) - b) < 12]
            if best is None or len(inl) > len(best):
                best = inl
    if best and len(best) >= 2:
        A = np.polyfit([a for a, _ in best], [b for _, b in best], 1)
    else:
        A = np.array([1.05, pts[0][1] - 1.05 * pts[0][0]])
    seed = [(c, sr, py) for c, sr, py in seed if abs(np.polyval(A, c[1]) - py) < 10]   # 다른 행 위치로 기록된 전사 제외
    srows = rows_of(bars, lambda t: t[1] + t[3] / 2)
    orows = rows_of(ours, lambda c: c[1])
    SEED_WEIGHT = 40   # 원본 전사에 코드와 함께 기록된 칸: 이미지 검출 짝보다 훨씬 믿는다
    seedpts = [(c[0], s[0], SEED_WEIGHT) for c, s, _ in seed] + [(c[0] + c[2], s[1], SEED_WEIGHT) for c, s, _ in seed]
    seeded = {(round(c[0], 2), round(c[1], 2)): s for c, s, _ in seed}
    # 선로가 화면 양 끝까지 이어지는 원본처럼, 가장 바깥 선로 끝을 원본 화면 양 끝에 둔다 (칸 없이 선로 이름만 있는 끝 구간이 눌리지 않게)
    allov = json.loads((ROOT / 'references/transcriptions/ls-xmap-overrides.json').read_text())
    overrides = allov.get(sid, [])
    seedpts += [(sx, x, SEED_WEIGHT) for sx, x, _ in allov.get('points', {}).get(sid, [])]
    forced = {}
    for sx, sy, x0, x1, _ in overrides:
        c = next((c for c in ours if abs(c[0] - sx) < 1.5 and abs(c[1] - sy) < 1.5), None)
        if c is None:
            raise SystemExit(f'{sid}: override anchor {sx},{sy} not found')
        key = (round(c[0], 2), round(c[1], 2))
        seeded[key] = (x0, x1); forced[key] = (c[3], x0, x1)
        seedpts += [(c[0], x0, SEED_WEIGHT), (c[0] + c[2], x1, SEED_WEIGHT)]
    left = min(t[0] for t in bars); right = max(t[0] + t[2] for t in bars)
    seedpts += [(scene['railMin'], left, CORE_WEIGHT), (scene['railMax'], right, CORE_WEIGHT)]
    points, matches = list(seedpts), {}
    for _ in range(4):
        knots = min_slope(isotonic(points))
        new, matches, trusted = [], {}, set()
        for oy, oc in orows.items():
            py = float(np.polyval(A, oy))
            sk = min(srows, key=lambda k: abs(k - py))
            if abs(sk - py) > 18:
                continue
            O = sorted(oc, key=lambda c: c[0]); S = []
            for t in sorted(srows[sk], key=lambda t: t[0]):   # 키 큰 띠에서 두 번 읽힌 같은 칸은 하나로
                if S and min(S[-1][0] + S[-1][2], t[0] + t[2]) - max(S[-1][0], t[0]) > 0.6 * min(S[-1][2], t[2]):
                    continue
                S.append(t)
            # 전사로 위치를 아는 칸을 기준점으로 행을 구간으로 나누고, 구간 안의 칸 수가 같으면 순서대로 짝짓는다
            known = []
            for oi, c in enumerate(O):
                sr = seeded.get((round(c[0], 2), round(c[1], 2)))
                if sr is None:
                    continue
                sj = min(range(len(S)), key=lambda j: abs(S[j][0] - sr[0]))
                if abs(S[sj][0] - sr[0]) < 12 and (not known or sj > known[-1][1]):
                    known.append((oi, sj))
            bounds = [(-1, -1)] + known + [(len(O), len(S))]
            filled = False
            for (a0, b0), (a1, b1) in zip(bounds, bounds[1:]):
                if a1 - a0 == b1 - b0 and a1 - a0 > 1:
                    for c, (x, _, w, _) in zip(O[a0 + 1:a1], S[b0 + 1:b1]):
                        key = (round(c[0], 2), round(c[1], 2))
                        wt = CORE_WEIGHT if not c[3].startswith('B') else 1
                        new += [(c[0], x, wt), (c[0] + c[2], x + w, wt)]
                        matches[key] = (c[3], x, x + w); trusted.add(key)
                        filled = True
            if filled:
                continue
            if len(O) == len(S):
                # 칸 수가 같으면 순서대로 짝짓는다 (위치 추정보다 확실하다)
                for c, (x, _, w, _) in zip(O, S):
                    key = (round(c[0], 2), round(c[1], 2))
                    if key in seeded and abs(seeded[key][0] - x) > 12:
                        continue
                    wt = CORE_WEIGHT if not c[3].startswith('B') else 1
                    new += [(c[0], x, wt), (c[0] + c[2], x + w, wt)]
                    matches[key] = (c[3], x, x + w); trusted.add(key)
                continue
            m = [(interp(knots, c[0]), interp(knots, c[0] + c[2])) for c in O]
            P = 160; n1, n2 = len(O), len(S)
            D = [[0.0] * (n2 + 1) for _ in range(n1 + 1)]; B = [[None] * (n2 + 1) for _ in range(n1 + 1)]
            for i in range(n1 + 1):
                for j in range(n2 + 1):
                    if i == 0 and j == 0:
                        continue
                    best = (1e18, None)
                    if i: best = min(best, (D[i - 1][j] + P, 'o'))
                    if j: best = min(best, (D[i][j - 1] + P, 's'))
                    if i and j:
                        x, _, w, _ = S[j - 1]
                        best = min(best, (D[i - 1][j - 1] + abs(m[i - 1][0] - x) + abs(m[i - 1][1] - x - w), 'm'))
                    D[i][j], B[i][j] = best
            i, j = n1, n2
            while i or j:
                t = B[i][j]
                if t == 'm':
                    c = O[i - 1]; x, _, w, _ = S[j - 1]
                    key = (round(c[0], 2), round(c[1], 2))
                    if key in seeded and abs(seeded[key][0] - x) > 12:
                        pass   # 전사로 위치를 아는 칸을 다른 원본 칸과 잘못 짝지은 경우
                    elif abs(m[i - 1][0] - x) + abs(m[i - 1][1] - x - w) < 2.2 * P:
                        core = not c[3].startswith('B')
                        wt = CORE_WEIGHT if core else 1
                        if core:   # 폐색 칸(B…)은 같은 폭 칸이 반복돼 한 칸씩 밀려 짝지어지기 쉽다: 전사 좌표만 쓴다
                            new += [(c[0], x, wt), (c[0] + c[2], x + w, wt)]
                            matches[key] = (c[3], x, x + w)
                    i -= 1; j -= 1
                elif t == 'o':
                    i -= 1
                else:
                    j -= 1
        points = seedpts + new
    knots = min_slope(isotonic(points))
    # 최종 함수로 다시 대 보고, 원본 칸과 충분히 겹치는 짝만 칸 경계 보정에 쓴다 (잘못 짝지은 칸이 쪼그라들지 않게)
    for (c, sr, _) in seed:
        matches[(round(c[0], 2), round(c[1], 2))] = (c[3], sr[0], sr[1])
    matches.update(forced); trusted |= set(forced)
    good = {}
    for (sx, sy), (label, a, b) in matches.items():
        c = next(c for c in ours if round(c[0], 2) == sx and round(c[1], 2) == sy)
        m0, m1 = interp(knots, c[0]), interp(knots, c[0] + c[2])
        iou = (min(m1, b) - max(m0, a)) / (max(m1, b) - min(m0, a))
        if (sx, sy) in trusted or (iou >= 0.5 and 0.6 <= (b - a) / max(1, m1 - m0) <= 1.7):
            good[(sx, sy)] = (label, a, b)
    matches = good
    # 신호기 위치: 원본 슬라이드의 빨간 등(신호 현시)을 찾아 그 신호기의 원본 x로 쓴다
    im = cv2.imread(str(ROOT / f'simulator/assets/stations/slide{slide}.png'))
    red = ((im[:, :, 2] > 190) & (im[:, :, 1] < 80) & (im[:, :, 0] < 80)).astype(np.uint8)
    n, _, st, cen = cv2.connectedComponentsWithStats(red, 8)
    lamps = [(float(cen[i][0]), float(cen[i][1])) for i in range(1, n) if 4 <= st[i][2] <= 26 and 4 <= st[i][3] <= 26 and st[i][1] > 150]
    sigx, used = {}, set()
    cand = []
    for sig in scene['signals']:
        sid_, rail, x, lampY, d = sig
        ex, ey = interp(knots, x), float(np.polyval(A, lampY))
        for j, (lx, ly) in enumerate(lamps):
            if abs(ly - ey) < 14 and abs(lx - ex) < 170:
                cand.append((abs(lx - ex) + 3 * abs(ly - ey), sid_, j, lx, d))
    for _, sid_, j, lx, d in sorted(cand):
        if sid_ in sigx or j in used:
            continue
        sigx[sid_] = [round(lx, 1), d]; used.add(j)
    return {'slide': slide, 'width': width, 'signals': sigx, 'splits': allov.get('splits', {}).get(sid, []), 'relabel': [[a, b, c] for a, b, c, *_ in allov.get('relabel', {}).get(sid, [])], 'captions': allov.get('captions', {}).get(sid, {}), 'platforms': [[a, b, c, d] for a, b, c, d, *_ in allov.get('platforms', {}).get(sid, [])], 'railPoints': [[a, b, c] for a, b, c, *_ in allov.get('railPoints', {}).get(sid, [])],
            'knots': [[round(a, 1), round(b, 1)] for a, b in knots],
            'pinned': sorted([list(k) for k in forced]),
            'cells': sorted([[k[0], k[1], v[0], v[1], v[2]] for k, v in matches.items()])}


def main():
    cells = our_cells()
    out = {sid: build(sid, slide, cells[sid]) for sid, slide in SLIDES.items()}
    (ROOT / 'references/transcriptions/ls-xmap.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    js = ("(function(root){'use strict';\n// Generated by tools/build-ls-xmap.py: PDF x -> 원본 LS 화면 x (PPT 슬라이드 픽셀)\n"
          "const data=" + json.dumps(out, ensure_ascii=False, separators=(',', ':')) +
          ";\nif(typeof module!=='undefined')module.exports=data;else root.SimLSXMap=data;\n})(typeof window!=='undefined'?window:globalThis);\n")
    (ROOT / 'simulator/engine/ls-xmap.js').write_text(js)
    for sid, v in out.items():
        print(sid.ljust(18), 'knots', len(v['knots']), 'cells', len(v['cells']))


if __name__ == '__main__':
    main()

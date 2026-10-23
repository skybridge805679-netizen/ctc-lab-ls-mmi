"""Extract the jurisdiction (intermediate station / inter-station) track strips from the supplied
1.전체노선.pdf page images into simulator/engine/wings.js, in each station's wiring-local coordinates.

Usage: python3 tools/extract-wings.py [station-id ...]   (needs opencv-python-headless, numpy, rapidocr-onnxruntime)
Everything outside the traced station rails is taken from the image: white track-circuit cells (+ OCR names),
white diagonals, platforms (orange/cyan), name plates and loose labels. Black capsule marks are not extracted.
"""
import json, re, subprocess, sys
from pathlib import Path
import cv2, numpy as np
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
S = 5760 / 2048
ocr = RapidOCR()
cat = json.loads(subprocess.check_output(['node', '-e', """
const N=require('./simulator/engine/network.js'),W=require('./simulator/engine/wiring.js');
const out={};for(const s of N.stations.filter(x=>x.controlled))out[s.id]={name:s.name,page:s.map.page,bounds:s.map.view.bounds,inter:s.map.view.intermediate,ref:s.map.referenceWindow,def:W.data[s.id]};
console.log(JSON.stringify(out));""" ], cwd=ROOT, text=True))
pages = {}
def page(n):
    if n not in pages: pages[n] = cv2.imread(str(ROOT / f'simulator/assets/line-map/page-{n}.jpg'))
    return pages[n]
import os
DEBUG = os.environ.get('DEBUG')
NAME = re.compile(r'^[A-Z0-9]{1,9}$')

def fixname(s):
    # track-circuit names end in T; OCR often reads that trailing T as 1 (B620T -> B6201)
    return s[:-1] + 'T' if len(s) > 3 and s.endswith('1') and not s.endswith('T') and s.startswith('B') else s

def extract(sid):
    st = cat[sid]; img = page(st['page']); bx, by, bw, bh = st['bounds']
    M = 40  # widen the window a little so an intermediate station cut by the window edge is complete
    ex0, ex1 = max(0, bx - M), min(2048, bx + bw + M)
    x0, y0, x1, y1 = [int(v * S) for v in (ex0, by, ex1, by + bh)]
    inside = lambda px: bx * S <= x0 + px <= (bx + bw) * S
    crop = img[y0:y1, x0:x1]; b, g, r = [crop[..., i].astype(int) for i in range(3)]
    white = ((r > 225) & (g > 225) & (b > 225)).astype(np.uint8) * 255
    orange = ((r > 230) & (g > 130) & (g < 190) & (b < 60)).astype(np.uint8) * 255
    cyan = ((r < 60) & (g > 200) & (b > 200)).astype(np.uint8) * 255
    black = ((r < 45) & (g < 45) & (b < 45)).astype(np.uint8) * 255
    ox, oy, w, h = st['ref']; iw, ih = st['def']['size']
    def loc(px, py):  # crop pixel -> station local
        gx = (x0 + px) / S; gy = (y0 + py) / S
        return (gx - ox) * iw / w, (gy - oy) * ih / h
    def comps(mask, minarea):
        cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); out = []
        for c in cs:
            a = cv2.contourArea(c)
            if a >= minarea: out.append((c, a, cv2.boundingRect(c)))
        return out
    cells, diags = [], []
    for c, a, (x, y, cw, ch) in comps(white, 150):
        fill = a / (cw * ch)
        if 12 <= ch <= 26 and cw >= 18: cells.append([x, y, cw, ch]); continue   # thin horizontal bar = track-circuit cell (glyph-notched or not)
        if max(cw, ch) < 40 or a > 90000: continue           # glyphs / huge blocks
        if fill > .88 and min(cw, ch) > 24: continue          # header buttons, platform blocks
        ap = cv2.approxPolyDP(c, 2.2, True)
        if 3 <= len(ap) <= 40: diags.append([[int(p[0][0]), int(p[0][1])] for p in ap])
    plat = [[x, y, x + cw, y + ch, 'o'] for c, a, (x, y, cw, ch) in comps(orange, 300) if cw > 20 and ch > 8]
    plat += [[x, y, x + cw, y + ch, 'c'] for c, a, (x, y, cw, ch) in comps(cyan, 300) if cw > 20 and ch > 8]
    plates = [[x, y, x + cw, y + ch] for c, a, (x, y, cw, ch) in comps(black, 800) if 90 <= cw <= 220 and 28 <= ch <= 60 and a / (cw * ch) > .8 and inside(x + cw / 2)]
    # OCR on a 2x enlargement
    big = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    res, _ = ocr(big); texts = []
    for box, txt, score in (res or []):
        xs = [p[0] / 2 for p in box]; ys = [p[1] / 2 for p in box]
        t = txt.replace(' ', '').upper().replace('O', '0') if False else txt.replace(' ', '').upper()
        texts.append((min(xs), min(ys), max(xs), max(ys), t, float(score)))
    named = []
    for x, y, cw, ch in cells:
        inside = [t for t in texts if x - 2 <= (t[0] + t[2]) / 2 <= x + cw + 2 and y - 4 <= (t[1] + t[3]) / 2 <= y + ch + 4]
        inside.sort(key=lambda t: t[0]); label = ''.join(t[4] for t in inside)
        named.append((x, y, cw, ch, fixname(label) if NAME.match(label) else ''))
    for i, (x, y, cw, ch, lab) in enumerate(named):
        if lab: continue
        c2 = cv2.copyMakeBorder(crop[max(0, y - 2):y + ch + 2, max(0, x):x + cw], 8, 8, 8, 8, cv2.BORDER_CONSTANT, value=(255, 255, 255))
        c2 = cv2.resize(c2, None, fx=5, fy=5, interpolation=cv2.INTER_CUBIC)
        rr, _ = ocr(c2)
        s = ''.join(sorted([(bx_[0][0], tt) for bx_, tt, sc in (rr or [])])[k][1] for k in range(len(rr or []))).replace(' ', '').upper() if rr else ''
        if NAME.match(s): named[i] = (x, y, cw, ch, fixname(s))
    cellbox = [(x - 3, y - 3, x + cw + 3, y + ch + 3) for x, y, cw, ch, _ in named]
    labels = []
    for x0_, y0_, x1_, y1_, t, sc in texts:
        cx, cy = (x0_ + x1_) / 2, (y0_ + y1_) / 2
        if any(a <= cx <= c and b_ <= cy <= d for a, b_, c, d in cellbox): continue
        if re.match(r'^\d{1,2}[A-C]?$', t): labels.append((cx, cy, t))
    red = ((r > 200) & (g < 70) & (b < 70)).astype(np.uint8) * 255
    lamps = [(x + cw / 2, y + ch / 2, cw, ch) for c, a, (x, y, cw, ch) in comps(red, 30) if 6 <= cw <= 22 and 6 <= ch <= 22 and .6 < cw / ch < 1.6]
    sigs, used = [], set()
    for tt in sorted(labels, key=lambda l: l[0]):
        cx, cy, tx = tt
        if not re.match(r'^\d{1,2}[A-Z]?$', tx): continue
        near = [(abs(lx - cx) + abs(ly - cy) * 2, i) for i, (lx, ly, lw, lh) in enumerate(lamps) if i not in used and abs(ly - cy) < 12 and 4 < abs(lx - cx) < 80]
        if near:
            i = min(near)[1]; used.add(i); lx, ly = lamps[i][:2]
            sigs.append((lx, ly, tx, 1 if lx > cx else -1, cx, cy))
    sigset = {(s[4], s[5], s[2]) for s in sigs}
    labels = [l for l in labels if (l[0], l[1], l[2]) not in sigset]
    if DEBUG:
        ov = crop.copy()
        for x, y, cw, ch, lab in named:
            cv2.rectangle(ov, (x, y), (x + cw, y + ch), (0, 200, 0) if lab else (0, 0, 255), 1)
            cv2.putText(ov, lab, (x + 2, y + ch + 11), cv2.FONT_HERSHEY_SIMPLEX, .35, (255, 0, 0), 1)
        for poly in diags: cv2.polylines(ov, [np.array(poly)], True, (255, 0, 255), 1)
        for a, b_, c, d, k in plat: cv2.rectangle(ov, (a, b_), (c, d), (0, 255, 255), 2)
        for a, b_, c, d in plates: cv2.rectangle(ov, (a, b_), (c, d), (255, 255, 0), 2)
        for lx, ly, tx, dr, _, _ in sigs: cv2.circle(ov, (int(lx), int(ly)), 9, (0, 128, 255), 2); cv2.putText(ov, tx, (int(lx) - 10, int(ly) - 12), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 128, 255), 1)
        for cx, cy, tx in labels: cv2.putText(ov, tx, (int(cx), int(cy)), cv2.FONT_HERSHEY_SIMPLEX, .4, (0, 0, 255), 1)
        cv2.imwrite(str(ROOT / f'tools/debug-{sid}.png'), ov)
    L = lambda px, py: [round(v, 1) for v in loc(px, py)]
    rail_ys = [pt[1] for r in st['def']['rails'] for pt in r[1]]
    cells_out = [[*L(x, y + ch / 2), round(cw / S * iw / w, 1), lab] for x, y, cw, ch, lab in named]
    lo = min(rail_ys) - 60  # only the header area above the tracks is excluded; the window bounds limit the rest
    cells_out = [c for c in cells_out if c[1] >= lo]
    return {
        'cells': cells_out, '_old': [[*L(x, y + ch / 2), round(cw * w / S / iw, 1) if False else round(cw / S * iw / w, 1), lab] for x, y, cw, ch, lab in named],
        'diags': [[L(*p) for p in poly] for poly in diags],
        'platforms': [[*L(a, b_), *L(c, d), k] for a, b_, c, d, k in plat],
        'plates': sorted([[*L(a, b_), *L(c, d)] for a, b_, c, d in plates], key=lambda p: p[0]),
        'labels': [[*L(cx, cy), t] for cx, cy, t in labels],
        'signals': [[*L(lx, ly), tx, dr] for lx, ly, tx, dr, _, _ in sigs],
        'debug': {'ocr': len(texts), 'cells': len(cells)},
    }

if __name__ == '__main__':
    want = sys.argv[1:] or list(cat)
    out = {}
    for sid in want:
        out[sid] = extract(sid); d = out[sid]
        print(sid, 'cells', len(d['cells']), 'named', sum(1 for c in d['cells'] if c[3]), 'diags', len(d['diags']), 'platforms', len(d['platforms']), 'plates', len(d['plates']), 'labels', len(d['labels']), 'signals', len(d['signals']), flush=True)
    for d in out.values(): d.pop('_old', None); d.pop('debug', None)
    js = '(function(root){\n\'use strict\';\n// Generated by tools/extract-wings.py from simulator/assets/line-map (1.전체노선.pdf). Do not edit by hand.\nconst data=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\nif(typeof module!==\'undefined\')module.exports=data;else root.SimWings=data;\n})(typeof window!==\'undefined\'?window:globalThis);\n'
    (ROOT / 'simulator/engine/wings.js').write_text(js, encoding='utf8')

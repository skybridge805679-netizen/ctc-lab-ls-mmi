"""Read LS route-popup screenshots (RT_<signal>_<destination> lines) into the answers format.

Usage:  python3 tools/parse-popup-screenshots.py <station-id> <image> [<image> ...] [--out references/route-menus/answers/<name>.txt]

- Every image may hold one popup or several; lines are grouped by their signal prefix and kept in the order they appear
  on the screen (top to bottom) because that is the LS menu order.
- Each token is checked against the routes the simulator derives for the station. Unknown destinations are reported as
  UNKNOWN (new cell name, wiring gap or OCR error) and a close known name is suggested; nothing is silently corrected
  unless it is an unambiguous look-alike fix (O/0 inside numbers, trailing 1/I/l for T).
- Needs: opencv-python-headless numpy rapidocr-onnxruntime
"""
import json, re, subprocess, sys, difflib
from pathlib import Path
import cv2
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--out')]
out_path = None
if '--out' in sys.argv:
    out_path = Path(sys.argv[sys.argv.index('--out') + 1]); args = [a for a in args if a != str(out_path)]
if len(args) < 2:
    sys.exit(__doc__)
station, images = args[0], args[1:]

known = json.loads(subprocess.check_output(['node', '-e', """
const C=require('./simulator/core.js').forStation(process.argv[1]);
const W=require('./simulator/wiring.js').data[process.argv[1]];
const dests=new Set(Object.values(C.routes).map(r=>r.destination));
for(const c of (W.cells||[]))dests.add(c[2]);
console.log(JSON.stringify({signals:Object.keys(C.signals),routes:Object.keys(C.routes),dests:[...dests]}));""", station], cwd=ROOT, text=True))
ocr = RapidOCR()
TOKEN = re.compile(r'RT[_\s\-]*([0-9]{1,2}[A-Z]?)[_\s\-]+([A-Z0-9]{1,12})', re.I)

def fix_dest(d):
    d = d.upper()
    d = re.sub(r'(?<=\d)O(?=\d)', '0', d)          # B6O5T -> B605T
    if re.fullmatch(r'B\d{3,4}[1IL]', d): d = d[:-1] + 'T'  # B6201 -> B620T
    return d

by_signal, order, report = {}, [], []
for img_path in images:
    img = cv2.imread(img_path)
    if img is None:
        report.append(f'!! cannot read {img_path}'); continue
    big = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    res, _ = ocr(big)
    lines = sorted(((min(p[1] for p in b), min(p[0] for p in b), t.strip(), float(s)) for b, t, s in (res or [])))
    found = 0
    for y, x, text, score in lines:
        for m in TOKEN.finditer(text.replace('|', 'I')):
            sig, dest = m.group(1).upper(), fix_dest(m.group(2))
            found += 1
            if sig not in known['signals']:
                report.append(f'?? {img_path}: signal {sig} is not a signal of {station} (text "{text}")')
            note = ''
            if dest not in known['dests']:
                near = difflib.get_close_matches(dest, known['dests'], n=2, cutoff=.6)
                note = f'UNKNOWN destination {dest}' + (f' (close: {", ".join(near)})' if near else '')
            elif sig + '-' + dest not in known['routes']:
                note = f'not derived by the simulator: {sig}-{dest} (needs a wiring `cells` entry or path fix)'
            if note: report.append(f'{note}  <- {img_path} "{text}" score {score:.2f}')
            if sig not in by_signal: by_signal[sig] = []; order.append(sig)
            if dest not in by_signal[sig]: by_signal[sig].append(dest)
    if not found: report.append(f'!! no RT_ lines found in {img_path}')

lines_out = [station] + [f'{s} - ' + ', '.join(f'RT_{s}_{d}' for d in by_signal[s]) for s in order]
text = '\n'.join(lines_out) + '\n'
if out_path:
    out_path.parent.mkdir(parents=True, exist_ok=True); out_path.write_text(text, encoding='utf8')
    print(f'written {out_path}')
print(text)
if report: print('--- check these ---'); print('\n'.join(report))

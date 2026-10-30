#!/usr/bin/env python3
"""references/ 원본(PDF·HWP·HWPX·PPTX) -> references/extracted/text/<같은 경로>.txt

원본을 저장소에서 빼도 검색·인용할 수 있도록 전문을 텍스트로 남긴다.
PDF는 쪽마다 "=== 쪽 N ===" 표시, PPTX는 "=== 슬라이드 N ===" 표시를 붙인다. 그림·표 모양은 남지 않으므로
그림이 필요하면 원본을 되살린다(references/README.md의 '원본 되살리기').
사용: python3 tools/extract-reference-text.py [원본 폴더=references]
"""
import re, struct, subprocess, sys, zipfile, zlib
from pathlib import Path
import olefile

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'references'
OUT = ROOT / 'references' / 'extracted' / 'text'


def pdf(path):
    pages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', str(path)], capture_output=True, text=True).stdout).group(1))
    text = subprocess.run(['pdftotext', '-layout', str(path), '-'], capture_output=True, text=True).stdout.split('\f')
    return '\n'.join(f'=== 쪽 {i + 1} ===\n{text[i].rstrip()}' for i in range(pages) if i < len(text)) + '\n'


def hwp(path):
    ole = olefile.OleFileIO(str(path))
    compressed = ole.openstream('FileHeader').read()[36] & 1
    out = []
    for i in range(1000):
        name = f'BodyText/Section{i}'
        if not ole.exists(name):
            break
        data = ole.openstream(name).read()
        if compressed:
            data = zlib.decompress(data, -15)
        pos = 0
        while pos + 4 <= len(data):
            header = struct.unpack_from('<I', data, pos)[0]
            tag, size = header & 0x3FF, header >> 20
            pos += 4
            if size == 0xFFF:
                size = struct.unpack_from('<I', data, pos)[0]
                pos += 4
            if tag == 67:  # HWPTAG_PARA_TEXT
                chars, j, line = data[pos:pos + size], 0, []
                while j + 1 < len(chars):
                    c = struct.unpack_from('<H', chars, j)[0]
                    if c < 32:
                        if c in (1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23):
                            j += 16
                            continue
                        if c == 9:
                            line.append('\t')
                        j += 2
                        continue
                    line.append(chr(c))
                    j += 2
                out.append(''.join(line).rstrip())
            pos += size
    return '\n'.join(out) + '\n'


def hwpx(path):
    with zipfile.ZipFile(path) as z:
        names = sorted(n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n))
        out = []
        for n in names:
            xml = z.read(n).decode('utf-8')
            for para in xml.split('</hp:p>'):        # tables nest paragraphs, so split at every paragraph end
                line = ''.join(re.findall(r'<hp:t\b[^>]*>(.*?)</hp:t>', para, re.S))
                if line.strip():
                    out.append(line)
    return '\n'.join(re.sub(r'<[^>]+>', '', p) for p in out) + '\n'


def pptx(path):
    with zipfile.ZipFile(path) as z:
        slides = sorted((n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=lambda n: int(re.search(r'(\d+)', n.rsplit('/', 1)[1]).group(1)))
        return '\n'.join(f'=== 슬라이드 {i + 1} ===\n' + '\n'.join(re.findall(r'<a:t>(.*?)</a:t>', z.read(n).decode('utf-8'))) for i, n in enumerate(slides)) + '\n'


READERS = {'.pdf': pdf, '.hwp': hwp, '.hwpx': hwpx, '.pptx': pptx}
count = 0
for f in sorted(SRC.rglob('*')):
    reader = READERS.get(f.suffix.lower())
    if not reader or 'extracted' in f.parts:
        continue
    target = OUT / f.relative_to(SRC).with_suffix(f.suffix + '.txt')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(reader(f), encoding='utf-8')
    count += 1
    print(f'{target.relative_to(ROOT)}  {target.stat().st_size // 1024} KB')
print(f'{count}개 원본의 텍스트를 추출했습니다.')

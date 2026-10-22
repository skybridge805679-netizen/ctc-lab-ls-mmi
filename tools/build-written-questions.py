#!/usr/bin/env python3
"""Extract the multiple-choice questions of the written-exam textbooks into simulator/written-questions.js.

Sources (references/textbooks): (학과1)관제관련규정.pdf  -> 단원 평가 문제(1~4장) + 7장 종합 평가 문제(정답·해설·근거 조문 포함)
                                (학과3)비상시조치등.pdf   -> 단원 평가 문제(4지선다·단답)
Run: python3 tools/build-written-questions.py   (needs pdftotext)
Every question is cross-checked (4 choices, answer present; 7장 answers must agree between 7.5 and 7.6).
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TB = ROOT / 'references' / 'textbooks'
CIRC = '①②③④'


def text_of(pdf):
    return subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True, check=True).stdout.replace('\x0c', '\n')


HEADER = re.compile(r'^\s*(\d{1,3}\s+도시철도\s?[·ㆍ]\s?철도[^\n]*|공통\(도시철도[·ㆍ]철도\)[^\n]*\s\d{1,3}|도시철도\s?[·ㆍ]?\s?철도[^\n]*\s\d{1,3})\s*$')


def lines_of(block):
    out = []
    for ln in block.splitlines():
        if HEADER.match(ln) or not ln.strip():
            continue
        out.append(ln.rstrip())
    return out


def split_choices(joined):
    """'question ① a ② b ③ c ④ d' -> (question, [a,b,c,d]) or None."""
    parts = re.split(r'(?=[①②③④])', joined)
    q = parts[0].strip()
    ch = {}
    for p in parts[1:]:
        ch[p[0]] = re.sub(r'\s+', ' ', p[1:]).strip()
    if [c for c in CIRC if c in ch] != list(CIRC):
        return None
    return q, [ch[c] for c in CIRC]


def parse_answers(line_block):
    out = {}
    for n, a in re.findall(r'(\d{1,3})-(.+?)(?=,\s*\d{1,3}-|\s*$)', line_block):
        a = a.strip()
        out[int(n)] = a
    return out


def eval_blocks(txt, labels):
    """Each '정답 : 1-..' line closes one 단원 평가 block; the block starts at the last '단원 평가 문제' heading before it."""
    heads = [m.start() for m in re.finditer(r'\n[ \t]+단원 평가 문제[ \t]*\n', txt)]
    ans = [m for m in re.finditer(r'\n[ \t]+정답 :[ \t]*1-', txt)]
    out = []
    last_end = -1
    for m in ans:
        h = [x for x in heads if x < m.start()]
        if not h:
            continue
        start = h[-1] if h[-1] > last_end else h[0]
        # the heading is repeated on page breaks inside one block: take the first heading after the previous answer
        first = [x for x in heads if x > last_end and x < m.start()]
        start = first[0] if first else start
        line_end = txt.find('\n', m.end())
        ans_line = txt[m.start():line_end]
        extra = txt[line_end + 1:line_end + 200].split('\n')[0]
        if re.match(r'^[\s\d\-①②③④(),가-힣·]+$', extra) and re.search(r'\d-', extra):
            ans_line += ' ' + extra.strip()
        out.append((start, m.start(), ans_line.split('정답 :', 1)[1]))
        last_end = line_end
    return out


def unit_blocks(txt, source, labels):
    items = []
    blocks = eval_blocks(txt, labels)
    if len(blocks) != len(labels):
        print('WARN', source, 'blocks', len(blocks), 'labels', len(labels), file=sys.stderr)
    for (s, e, ans_line), ch in zip(blocks, labels):
        answers = parse_answers(ans_line)
        cur = None
        buf = []
        qs = []
        for ln in lines_of(txt[s:e]):
            m = re.match(r'^\s*(\d{1,2})(?:\.|\s)\s*(\S.*)$', ln)
            # numbering may skip a number or miss the dot in the source ("6 다음 …"); a question line never starts with a circled number
            if m and not m.group(2).startswith(tuple(CIRC)) and (cur is None or cur[0] < int(m.group(1)) <= cur[0] + 3):
                if cur:
                    qs.append((cur[0], ' '.join(buf)))
                cur = (int(m.group(1)), None)
                buf = [m.group(2)]
            elif cur and '단원 평가 문제' not in ln:
                buf.append(ln.strip())
        if cur:
            qs.append((cur[0], ' '.join(buf)))
        for n, joined in qs:
            sc = split_choices(joined)
            a = answers.get(n)
            if a is None:
                print('WARN no answer', source, ch, n, file=sys.stderr)
                continue
            if sc and a in CIRC:
                q, choices = sc
                items.append(dict(source=source, chapter=ch, no=n, q=q, choices=choices, answer=CIRC.index(a) + 1, topic='', why='', ref=''))
            else:
                items.append(dict(source=source, chapter=ch, no=n, q=re.sub(r'\s+', ' ', joined), choices=[], answer=None, text=(a[1:-1] if a.startswith('(') and a.endswith(')') else a).strip(), topic='', why='', ref=''))
    return items


def part1():
    txt = text_of(TB / '(학과1)관제관련규정.pdf')
    items = unit_blocks(txt, '관제관련규정', ['1장 철도교통관제 운영규정', '2장 철도차량운전규칙', '3장 도시철도운전규칙', '4장 세 규정 비교'])
    # 7장
    s = txt.find('7.1. 철도교통관제 운영규정 · 01~37')
    a5 = txt.find('7.5. 정답 한눈에 보기', s)
    a6 = txt.find('7.6. 정답과 해설', a5)
    body = txt[s:a5]
    answers = {int(n): c for n, c in re.findall(r'(\d{1,3})\s+([①②③④])', txt[a5:a6])}
    sections = [('관제 운영규정', 1, 37), ('차량운전규칙', 38, 75), ('도시철도운전규칙', 76, 100), ('세 규정 비교', 101, 114)]
    heads = re.findall(r'^\s*7\.[1-4]\.\s+(\S[^\n]*?)\s·\s(\d{2,3})~(\d{2,3})', txt[s:a5], re.M)
    if heads:
        sections = [(h[0], int(h[1]), int(h[2])) for h in heads]
    cur = None
    buf = []
    qs = []
    for ln in lines_of(body):
        if re.match(r'^\s*7\.[1-4]\.', ln):
            continue
        m = re.match(r'^(\d{2,3})\s+(\S.*)$', ln)
        if m and not ln.lstrip().startswith(tuple(CIRC)) and (cur is None or int(m.group(1)) == cur + 1):
            if cur is not None:
                qs.append((cur, ' '.join(buf)))
            cur = int(m.group(1))
            buf = [m.group(2)]
        elif cur is not None:
            buf.append(ln.strip())
    if cur is not None:
        qs.append((cur, ' '.join(buf)))
    # explanations
    expl = {}
    ex_txt = txt[a6:]
    ent = re.split(r'\n(?=\d{2,3} [①②③④] )', ex_txt)
    for e in ent:
        m = re.match(r'(\d{2,3}) ([①②③④]) (.*?)\n(.*)', e, re.S)
        if not m:
            continue
        rest = [l for l in lines_of(m.group(4))]
        ref = ''
        why = []
        for l in rest:
            if l.strip().startswith('근거'):
                ref = l.strip().split('·', 1)[-1].strip()
            elif not re.match(r'^\s*\d+\s+(도시|공통)', l):
                why.append(l.strip())
        expl[int(m.group(1))] = (m.group(2), re.sub(r'\s+', ' ', ' '.join(why)).strip(), ref)
    for n, joined in qs:
        sc = split_choices(joined)
        if not sc:
            print('WARN 7장 q', n, joined[:60], file=sys.stderr)
            continue
        q, choices = sc
        topic = ''
        m = re.match(r'^(.*[?」])\s+([가-힣·\s]{1,14})$', q)
        if m:
            q, topic = m.group(1), m.group(2).strip()
        src = next((nm for nm, lo, hi in sections if lo <= n <= hi), '')
        ans = answers.get(n)
        e = expl.get(n)
        if ans is None or (e and e[0] != ans):
            print('WARN answer mismatch', n, ans, e and e[0], file=sys.stderr)
        items.append(dict(source='관제관련규정', chapter='7장 종합 평가 · ' + src, no=n, q=q, choices=choices, answer=CIRC.index(ans) + 1 if ans else None, topic=topic, why=e[1] if e else '', ref=e[2] if e else ''))
    return items


def part3():
    txt = text_of(TB / '(학과3)비상시조치등(20240430).pdf')
    labels = ['1장 인적오류', '2장 지적확인 환호응답', '2장 관제사 비상조치 기본 개요', '3장 사고발생시 관제업무절차', '4장 관제업무 수행 시 관련 절차', '5장 비상 상황 발생 시 조치 및 대응', '6장 이례사항 발생 시 유형별 취급요령', '7장 주요 철도사고(장애) 상세조치']
    return unit_blocks(txt, '비상시조치등', labels)


def main():
    items = part1() + part3()
    items = [i for i in items if i.get('answer') or i.get('text')]
    for k, i in enumerate(items, 1):
        i['id'] = k
    out = ROOT / 'simulator' / 'written-questions.js'
    data = json.dumps(items, ensure_ascii=False, indent=0)
    out.write_text('(function(root){\n// generated by tools/build-written-questions.py from references/textbooks (필기 교재 단원 평가·종합 평가 문제)\nconst data=' + data + ';\nif(typeof module!==\'undefined\')module.exports={questions:data};else root.SimWrittenQuestions=data;\n})(typeof window!==\'undefined\'?window:globalThis);\n', encoding='utf-8')
    mc = [i for i in items if i['choices']]
    print(len(items), 'questions,', len(mc), 'multiple choice,', len(items) - len(mc), 'short answer')


main()

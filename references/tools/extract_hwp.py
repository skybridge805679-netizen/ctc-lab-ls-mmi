"""Extract HWP 5 BodyText paragraphs, including table-cell paragraphs.

Requires olefile==0.47. Does not execute macros or embedded instructions.
Output follows record order, not visual page/table layout. Images are not OCRed.
"""
import argparse
from pathlib import Path
import struct
import zlib
import olefile


def paragraph_text(data):
    if len(data) % 2:
        raise ValueError('Odd UTF-16 paragraph size')
    words = struct.unpack('<' + 'H' * (len(data) // 2), data)
    output = []
    index = 0
    while index < len(words):
        code = words[index]
        if code >= 32:
            output.append(code)
            index += 1
        elif code in (0, 10, 13, 24, 30, 31):
            output.extend({10: [10], 13: [10], 24: [45], 30: [32], 31: [32]}.get(code, []))
            index += 1
        else:
            # HWP inline/extended controls occupy eight UTF-16 code units.
            if index + 8 > len(words):
                raise ValueError('Truncated HWP paragraph control')
            if code == 9:
                output.append(9)
            index += 8
    packed = struct.pack('<' + 'H' * len(output), *output)
    return packed.decode('utf-16le', errors='strict')


def extract(path):
    paragraphs = []
    with olefile.OleFileIO(str(path)) as document:
        header = document.openstream('FileHeader').read()
        if not header.startswith(b'HWP Document File'):
            raise ValueError('Not an HWP 5 document')
        flags = struct.unpack_from('<I', header, 36)[0]
        if flags & (2 | 4):
            raise ValueError('Encrypted/distribution documents are not supported')
        sections = sorted(
            (name for name in document.listdir() if len(name) == 2
             and name[0] == 'BodyText' and name[1].startswith('Section')),
            key=lambda name: int(name[1][7:]),
        )
        if not sections:
            raise ValueError('No BodyText sections')
        for section in sections:
            data = document.openstream(section).read()
            if flags & 1:
                data = zlib.decompress(data, -15)
            position = 0
            while position < len(data):
                if position + 4 > len(data):
                    raise ValueError('Truncated record header')
                record = struct.unpack_from('<I', data, position)[0]
                position += 4
                tag, size = record & 1023, record >> 20
                if size == 4095:
                    if position + 4 > len(data):
                        raise ValueError('Truncated extended record size')
                    size = struct.unpack_from('<I', data, position)[0]
                    position += 4
                if position + size > len(data):
                    raise ValueError('Truncated record payload')
                if tag == 67:
                    text = paragraph_text(data[position:position + size]).strip('\n')
                    if text.strip():
                        paragraphs.append(text)
                position += size
    if not paragraphs:
        raise ValueError('No paragraph text extracted')
    return '\n'.join(paragraphs) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output already exists; use a new path to preserve existing files')
    args.output.write_text(extract(args.source), encoding='utf-8')

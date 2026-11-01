# -*- coding: utf-8 -*-
"""
Маски для практики «Что здесь не так» (js/practice-masks.js).

Зачем: сайт открывается файлом (file:///), и там браузер не даёт JavaScript
читать пиксели картинок. Поэтому заранее, этим скриптом, для каждого
PNG-слоя из images/practice/<папка>/ считается «маска» — где слой непрозрачный.

Как запускать (из папки сайта):
    python tools/make-masks.py

Запускать каждый раз, когда добавили или заменили картинки практики.
Нужен только Python 3, дополнительных библиотек не нужно.
"""

import base64
import glob
import json
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "practice-masks.js")

CELL = 4         # маска хранится клетками 4×4 пикселя
ALPHA_MIN = 20   # пиксель считается частью предмета, если непрозрачность больше 20 (из 255)


def read_png_alpha(path):
    """Читает PNG (8 бит, RGBA, без чередования строк) и возвращает ширину, высоту и строки альфа-канала."""
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("не PNG")
    pos, idat = 8, []
    width = height = None
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if depth != 8 or color != 6 or interlace != 0:
                raise ValueError("нужен PNG 8 бит RGBA без чередования строк")
        elif kind == b"IDAT":
            idat.append(body)
        elif kind == b"IEND":
            break
        pos += 12 + length

    raw = zlib.decompress(b"".join(idat))
    bpp, stride = 4, width * 4
    prev = bytearray(stride)
    rows = []
    i = 0
    for _ in range(height):
        ftype = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        if ftype == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif ftype == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif ftype == 3:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((left + prev[x]) >> 1)) & 255
        elif ftype == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 255
        rows.append(line[3::4])  # только альфа-канал
        prev = line
    return width, height, rows


def make_mask(path):
    width, height, rows = read_png_alpha(path)
    cols = (width + CELL - 1) // CELL
    rws = (height + CELL - 1) // CELL
    bits = bytearray((cols * rws + 7) // 8)
    for y in range(height):
        row = rows[y]
        cy = y // CELL
        for x in range(width):
            if row[x] > ALPHA_MIN:
                n = cy * cols + x // CELL
                bits[n >> 3] |= 1 << (n & 7)
    return {
        "width": width, "height": height, "cell": CELL, "cols": cols, "rows": rws,
        "bits": base64.b64encode(bytes(bits)).decode("ascii"),
    }


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # русские буквы в любом терминале
    masks = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "images", "practice", "*", "*.png"))):
        key = os.path.relpath(path, ROOT).replace(os.sep, "/")
        try:
            masks[key] = make_mask(path)
            print("готово:", key)
        except Exception as e:  # битый или неподходящий файл — пропускаем, остальное делаем
            print("пропущено:", key, "-", e)

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Файл создан скриптом tools/make-masks.py — вручную не править.\n")
        f.write("   Маски непрозрачных мест слоёв практики: по ним сайт понимает, на какой предмет навели курсор. */\n")
        f.write("const PRACTICE_MASKS = " + json.dumps(masks, indent=1) + ";\n")
    print("записано:", os.path.relpath(OUT, ROOT), "(" + str(len(masks)) + " масок)")


if __name__ == "__main__":
    main()

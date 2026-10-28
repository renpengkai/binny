#!/usr/bin/env python3
"""用小猫精灵图生成 AppIcon.iconset。"""
import struct
import zlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "cat.png"


def read_png(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    i = 8
    w = h = None
    raw = b""
    while i < len(data):
        ln = struct.unpack(">I", data[i : i + 4])[0]
        typ = data[i + 4 : i + 8]
        chunk = data[i + 8 : i + 8 + ln]
        i += 12 + ln
        if typ == b"IHDR":
            w, h, bit, ctype, *_ = struct.unpack(">IIBBBBB", chunk)
        elif typ == b"IDAT":
            raw += chunk
        elif typ == b"IEND":
            break
    rows = zlib.decompress(raw)
    bpp = 4 if ctype == 6 else 3
    stride = w * bpp
    out = bytearray()
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        f = rows[pos]
        pos += 1
        row = bytearray(rows[pos : pos + stride])
        pos += stride
        if f == 1:
            for x in range(stride):
                left = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + left) & 255
        elif f == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                left = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif f == 4:
            def paeth(a, b, c):
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                if pa <= pb and pa <= pc:
                    return a
                if pb <= pc:
                    return b
                return c

            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + paeth(a, b, c)) & 255
        prev = row
        out += row
    if bpp == 3:
        rgba = bytearray()
        for i in range(0, len(out), 3):
            rgba.extend(out[i : i + 3])
            rgba.append(255)
        out = rgba
    return w, h, out


def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    )


def resize_nearest(src_w, src_h, src, n):
    # 放到正方形画布中央
    out = bytearray(n * n * 4)
    scale = min(n / src_w, n / src_h) * 0.92
    dw = max(1, int(src_w * scale))
    dh = max(1, int(src_h * scale))
    ox = (n - dw) // 2
    oy = (n - dh) // 2
    for y in range(dh):
        sy = min(src_h - 1, int(y * src_h / dh))
        for x in range(dw):
            sx = min(src_w - 1, int(x * src_w / dw))
            si = (sy * src_w + sx) * 4
            di = ((oy + y) * n + (ox + x)) * 4
            out[di : di + 4] = src[si : si + 4]
    return out


def main():
    w, h, rgba = read_png(SRC)
    out = ROOT / "dist" / "AppIcon.iconset"
    out.mkdir(parents=True, exist_ok=True)
    sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
    }
    cache = {}
    for name, n in sizes.items():
        if n not in cache:
            cache[n] = resize_nearest(w, h, rgba, n)
        write_png(out / name, n, n, cache[n])
    print(out)


if __name__ == "__main__":
    main()

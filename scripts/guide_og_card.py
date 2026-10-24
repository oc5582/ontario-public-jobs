"""Make a 1200x630 share card for a guide in the site's og-image style (IBM Plex Sans, civic blue).

Usage: python scripts/guide_og_card.py "<title>" "<subtitle>" web/public/guides/<slug>.png
Needs Pillow, fonttools and brotli (to read fonts/ibm-plex-sans-latin.woff2).
"""
import io
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
INK, PAPER, CIVIC, MUTED, RULE = "#16202c", "#fbfbf9", "#1f4e79", "#4b5563", "#d9dce0"


def plex(size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = TTFont(ROOT / "fonts" / "ibm-plex-sans-latin.woff2")
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    face = ImageFont.truetype(buf, size)
    face.set_variation_by_axes([weight])
    return face


def wrap(draw, text, font, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def main(title: str, subtitle: str, out: str) -> None:
    img = Image.new("RGB", (1200, 630), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1200, 120], fill=CIVIC)
    d.text((72, 60), "PublicJobs.ca", font=plex(52, 700), fill="#ffffff", anchor="lm")
    size = 68
    while True:
        tfont = plex(size, 700)
        lines = wrap(d, title, tfont, 1056)
        if len(lines) <= 3 or size <= 48:
            break
        size -= 4
    sfont = plex(30, 400)
    sub_lines = wrap(d, subtitle, sfont, 1056)[:2]
    block = 50 + len(lines) * int(size * 1.18) + 14 + len(sub_lines) * 42
    top = 120 + max(24, (540 - 120 - block) // 2)
    d.text((72, top + 15), "Guide", font=plex(30, 600), fill=CIVIC, anchor="lm")
    y = top + 50
    for line in lines:
        d.text((72, y), line, font=tfont, fill=INK)
        y += int(size * 1.18)
    for line in sub_lines:
        d.text((72, y + 14), line, font=sfont, fill=MUTED)
        y += 42
    d.line([72, 540, 1128, 540], fill=RULE, width=2)
    d.text((72, 574), "Independent. Not affiliated with any government.", font=plex(26, 400), fill=MUTED, anchor="lm")
    img.save(out, optimize=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])

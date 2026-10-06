"""Contact sheet for review: one row per candidate, the flat source then each dot frame on the
lcd ground at 360 px wide (the panel's size on a phone, in points).

Usage: sheet.py <out.png> <label>|<source.png>|<frame-0.png>|<frame-1.png>[|<frame-2.png>] ...
"""
import sys
from PIL import Image, ImageDraw, ImageFont

LCD = (0x12, 0x12, 0x11)
FW, FH, PAD, LABEL = 360, 240, 12, 26
out, rows = sys.argv[1], [r.split("|") for r in sys.argv[2:]]
cols = max(len(r) - 2 for r in rows)
SW = int(FH * 16 / 9)
W = PAD + SW + PAD + cols * (FW + PAD)
H = PAD + len(rows) * (LABEL + FH + PAD)
sheet = Image.new("RGB", (W, H), (40, 40, 40))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 18)
except OSError:
    font = ImageFont.load_default()
y = PAD
for label, source, *frames in rows:
    d.text((PAD, y + 3), label, fill=(240, 240, 240), font=font)
    y += LABEL
    try:
        s = Image.open(source).convert("RGB")
        s.thumbnail((SW, FH))
        sheet.paste(s, (PAD, y))
    except OSError:
        d.text((PAD, y + FH // 2), "no source", fill=(255, 80, 80), font=font)
    x = PAD + SW + PAD
    for f in frames:
        ground = Image.new("RGBA", (FW, FH), LCD + (255,))
        try:
            fr = Image.open(f).convert("RGBA").resize((FW, FH), Image.LANCZOS)
            ground.alpha_composite(fr)
        except OSError:
            ImageDraw.Draw(ground).text((10, FH // 2), "missing", fill=(255, 80, 80), font=font)
        sheet.paste(ground.convert("RGB"), (x, y))
        x += FW + PAD
    y += FH + PAD
sheet.save(out, optimize=True)
print("sheet", out)

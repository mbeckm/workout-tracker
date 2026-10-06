"""Looping GIF preview of approved or candidate frames, a grid of panels on the lcd ground.

Usage: loop.py <out.gif> <frame-0.png>,<frame-1.png>[,<frame-2.png>] ...   (one argument per lift)
"""
import sys
from PIL import Image

LCD = (0x12, 0x12, 0x11, 255)
FW, FH, GAP, COLS, MS = 360, 240, 8, 3, 900
out, lifts = sys.argv[1], [a.split(",") for a in sys.argv[2:]]
rows = (len(lifts) + COLS - 1) // COLS
W, H = COLS * FW + (COLS + 1) * GAP, rows * FH + (rows + 1) * GAP
steps = max(len(l) for l in lifts)
images = []
for t in range(steps):
    im = Image.new("RGBA", (W, H), (40, 40, 40, 255))
    for i, frames in enumerate(lifts):
        panel = Image.new("RGBA", (FW, FH), LCD)
        panel.alpha_composite(Image.open(frames[t % len(frames)]).convert("RGBA").resize((FW, FH), Image.LANCZOS))
        im.paste(panel, (GAP + (i % COLS) * (FW + GAP), GAP + (i // COLS) * (FH + GAP)))
    images.append(im.convert("RGB"))
images[0].save(out, save_all=True, append_images=images[1:], duration=MS, loop=0)
print("loop", out)

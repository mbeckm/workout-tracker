"""Turn a two-up flat source (start figure left, end figure right, white ground) into two
transparent dot-matrix PNG frames: 120x80 dots, 9 px pitch, 1080x720.

Usage: dots.py <two-up.png> <out-start.png> <out-end.png>
One shared scale for both frames, feet on one baseline. Orange in the source becomes the lit
muscle; mid-grey the body; dark grey the equipment.
"""
import sys
from PIL import Image, ImageDraw
src, out0, out1 = sys.argv[1:4]
GW, GH, P = 120, 80, 9
FIG_H = 0.64                       # tallest frame fills this share of the panel height
BODY=(176,86,32,255); GEAR=(112,58,30,255); LIT=(255,106,26,255); OFF=(255,106,26,40)
im = Image.open(src).convert("RGB")
W, H = im.size
mask = Image.eval(im.convert("L"), lambda v: 255 if v < 235 else 0)
# split at the emptiest column near the middle
cols = [sum(1 for y in range(0, H, 4) if mask.getpixel((x, y))) for x in range(W)]
mid = min(range(int(W*0.4), int(W*0.6)), key=lambda x: cols[x])
halves = [(im.crop((0, 0, mid, H)), mask.crop((0, 0, mid, H))),
          (im.crop((mid, 0, W, H)), mask.crop((mid, 0, W, H)))]
crops = []
for img, m in halves:
    b = m.getbbox(); crops.append((img.crop(b), b[2]-b[0], b[3]-b[1]))
# one shared scale for both frames (as drawn), feet on one baseline
tallest = max(h for _, _, h in crops)
k = (FIG_H * GH * 4) / tallest
scaled = [img.resize((int(w*k), int(h*k)), Image.LANCZOS) for img, w, h in crops]
base_y = int(GH*4*0.5 + max(i.size[1] for i in scaled)/2)       # shared feet baseline
def render(fig, path):
    can = Image.new("RGB", (GW*4, GH*4), (255, 255, 255))
    can.paste(fig, (int((GW*4 - fig.size[0])/2), base_y - fig.size[1]))
    c = Image.new("RGBA", (int(GW*P), int(GH*P)), (0, 0, 0, 0)); d = ImageDraw.Draw(c)
    for gy in range(GH):
        for gx in range(GW):
            px = [can.getpixel((gx*4+i, gy*4+j)) for i in range(4) for j in range(4)]
            r = sum(p[0] for p in px)/16; g = sum(p[1] for p in px)/16; b = sum(p[2] for p in px)/16
            lum = (r+g+b)/3
            if lum > 222: col = OFF
            elif r > 165 and r > g*1.6 and r > b*2.2: col = LIT
            elif lum > 120: col = BODY
            else: col = GEAR
            x = gx*P + P/2; y = gy*P + P/2; rad = P*0.38 if col != OFF else P*0.15
            d.rounded_rectangle((x-rad, y-rad, x+rad, y+rad), radius=rad*0.45, fill=col)
    c.save(path, optimize=True)
render(scaled[0], out0); render(scaled[1], out1)

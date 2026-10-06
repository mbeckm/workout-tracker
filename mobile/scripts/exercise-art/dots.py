"""Turn a two-up (or three-up) flat source (figures left to right, white ground) into transparent
dot-matrix PNG frames: 120x80 dots, 9 px pitch, 1080x720.

Usage: dots.py <source.png> <out-0.png> <out-1.png> [<out-2.png>] [--anchor floor|top]

One shared scale for every frame. `floor` (default) puts the lowest body pixels (the feet) on one
baseline and lines them up horizontally; `top` lines up the highest equipment pixels instead (the
pull-up bar), for lifts where the body moves and the bar stays. Orange in the source
becomes the lit muscle; mid-grey the body; dark grey the equipment.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

args = [a for a in sys.argv[1:] if not a.startswith("--")]
anchor = "top" if "--anchor" in sys.argv and sys.argv[sys.argv.index("--anchor") + 1] == "top" else "floor"
args = [a for a in args if a not in ("floor", "top")]
src, outs = args[0], args[1:]
N = len(outs)
GW, GH, P = 120, 80, 9
S = 4                              # canvas pixels per dot
CW, CH = GW * S, GH * S
FIG_H = 0.64                       # the tallest frame fills this share of the panel height
MAX_W = 0.86                       # every frame fits this share of the panel width
BAND = 0.05                        # anchor band: this share of the tallest frame's height
BODY = (176, 86, 32, 255); GEAR = (112, 58, 30, 255); LIT = (255, 106, 26, 255); OFF = (255, 106, 26, 40)

im = Image.open(src).convert("RGB")
W, H = im.size
mask = Image.eval(im.convert("L"), lambda v: 255 if v < 235 else 0).filter(ImageFilter.MedianFilter(5))

# split at the emptiest column near each boundary
cols = [sum(1 for y in range(0, H, 4) if mask.getpixel((x, y))) for x in range(W)]
cuts = [0]
for i in range(1, N):
    lo, hi = int(W * (i / N - 0.1)), int(W * (i / N + 0.1))
    cuts.append(min(range(lo, hi), key=lambda x: (cols[x], abs(x - W * i / N))))
cuts.append(W)

def body_px(p):
    r, g, b = p
    return abs(r - g) < 24 and abs(g - b) < 24 and 115 < (r + g + b) / 3 < 215

crops = []
for a, b in zip(cuts, cuts[1:]):
    m = mask.crop((a, 0, b, H))
    box = m.getbbox()
    crops.append((im.crop((a, 0, b, H)).crop(box), m.crop(box)))

def gear_px(p):
    r, g, b = p
    return abs(r - g) < 24 and abs(g - b) < 24 and (r + g + b) / 3 <= 115

def anchor_at(img, m, band):
    """The anchor point: feet (mean x of body pixels in the bottom band, y at the bottom), or the
    bar (mean x of equipment pixels in the band under its top row, y at that row)."""
    w, h = img.size
    if anchor == "floor":
        top, keep = h - band, body_px
    else:
        top = next((y for y in range(h) if any(m.getpixel((x, y)) and gear_px(img.getpixel((x, y)))
                                              for x in range(0, w, 2))), 0)
        keep = gear_px
    rows = range(top, min(h, top + band))
    xs = [x for y in rows for x in range(0, w, 2) if m.getpixel((x, y)) and keep(img.getpixel((x, y)))]
    if not xs:
        xs = [x for y in rows for x in range(0, w, 2) if m.getpixel((x, y))]
    return (sum(xs) / len(xs) if xs else w / 2), (h if anchor == "floor" else top)

tallest = max(c.size[1] for c, _ in crops)
k = (FIG_H * CH) / tallest
while True:
    scaled = [(c.resize((max(1, int(c.size[0] * k)), max(1, int(c.size[1] * k))), Image.LANCZOS),
               m.resize((max(1, int(m.size[0] * k)), max(1, int(m.size[1] * k))), Image.NEAREST))
              for c, m in crops]
    band = max(2, int(BAND * tallest * k))
    at = [anchor_at(c, m, band) for c, m in scaled]
    # place every frame with its anchor at (0, 0), then centre the union on the panel
    lefts = [-a[0] for a in at]; tops = [-a[1] for a in at]
    rights = [l + c.size[0] for l, (c, _) in zip(lefts, scaled)]
    bottoms = [t + c.size[1] for t, (c, _) in zip(tops, scaled)]
    span, tall = max(rights) - min(lefts), max(bottoms) - min(tops)
    if span <= MAX_W * CW and tall <= FIG_H * CH * 1.15:
        break
    k *= min(MAX_W * CW / span, FIG_H * CH * 1.15 / tall, 1) * 0.98
shift = CW / 2 - (min(lefts) + max(rights)) / 2
shift_y = CH / 2 - (min(tops) + max(bottoms)) / 2

def render(i, path):
    fig, m = scaled[i]
    can = Image.new("RGB", (CW, CH), (255, 255, 255))
    can.paste(fig, (int(lefts[i] + shift), int(tops[i] + shift_y)), m)
    c = Image.new("RGBA", (GW * P, GH * P), (0, 0, 0, 0)); d = ImageDraw.Draw(c)
    for gy in range(GH):
        for gx in range(GW):
            px = [can.getpixel((gx * S + i, gy * S + j)) for i in range(S) for j in range(S)]
            r = sum(p[0] for p in px) / 16; g = sum(p[1] for p in px) / 16; b = sum(p[2] for p in px) / 16
            lum = (r + g + b) / 3
            if lum > 222: col = OFF
            elif r > 165 and r > g * 1.6 and r > b * 2.2: col = LIT
            elif lum > 120: col = BODY
            else: col = GEAR
            x = gx * P + P / 2; y0 = gy * P + P / 2; rad = P * 0.38 if col != OFF else P * 0.15
            d.rounded_rectangle((x - rad, y0 - rad, x + rad, y0 + rad), radius=rad * 0.45, fill=col)
    c.save(path, optimize=True)

for i, out in enumerate(outs):
    render(i, out)

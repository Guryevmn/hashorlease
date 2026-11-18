"""Measures optical centering of icons in the round chips of a screenshot (2x).
For each chip: circle bbox (pixels that differ from white and are 'pale tint') vs glyph bbox (dark/saturated pixels inside).
Also the heading text cap-center in the same row. Usage: uv run --with pillow python3 measure.py image.png"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
W, H = im.size
px = im.load()
def is_white(p): return p[0] > 250 and p[1] > 250 and p[2] > 250
# circle pixels: pale non-white tint (all channels > 215, not white) ; glyph: any channel < 190 and different from text colour
def pale(p): return min(p) > 215 and not is_white(p) and max(p) - min(p) >= 4
seen = [[False]*W for _ in range(H)]
chips = []
for y in range(H):
    for x in range(W):
        if seen[y][x] or not pale(px[x, y]): continue
        stack = [(x, y)]; seen[y][x] = True; pts = []
        while stack:
            cx, cy = stack.pop(); pts.append((cx, cy))
            for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and pale(px[nx, ny]):
                    seen[ny][nx] = True; stack.append((nx, ny))
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        w = max(xs)-min(xs)+1; h = max(ys)-min(ys)+1
        if 30 <= w <= 60 and 30 <= h <= 60 and abs(w-h) <= 3:
            chips.append((min(xs), min(ys), max(xs), max(ys)))
for (x0, y0, x1, y1) in chips:
    gx, gy = [], []
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            p = px[x, y]
            if min(p) < 190:
                gx.append(x); gy.append(y)
    if not gx: continue
    ccx, ccy = (x0+x1)/2, (y0+y1)/2
    gcx, gcy = (min(gx)+max(gx))/2, (min(gy)+max(gy))/2
    print(f"chip@({x0},{y0}) circle {x1-x0+1}px  glyph offset dx={ (gcx-ccx)/2:+.2f}px dy={(gcy-ccy)/2:+.2f}px (css px; + = right/down)")

"""Builds before/after sheets (Was | Now) from raw/ into design/check-green/. Run: uv run --with pillow python3 compare.py"""
from PIL import Image, ImageDraw, ImageFont
import os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here); raw = os.path.join(root, "raw")
try: font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 30)
except Exception: font = ImageFont.load_default()
for name in ["sources-402", "receipt-402", "sources-1280", "receipt-1280"]:
    a = Image.open(os.path.join(raw, f"before-{name}.png")).convert("RGB")
    b = Image.open(os.path.join(raw, f"after-{name}.png")).convert("RGB")
    gap, top = 40, 70; h = max(a.height, b.height)
    sheet = Image.new("RGB", (a.width + b.width + gap * 3, h + top + gap), "#e9ecf0")
    d = ImageDraw.Draw(sheet)
    d.text((gap, 18), "Was", fill="#14171c", font=font); d.text((gap * 2 + a.width, 18), "Now", fill="#14171c", font=font)
    sheet.paste(a, (gap, top)); sheet.paste(b, (gap * 2 + a.width, top))
    out = os.path.join(root, f"{name}.png"); sheet.save(out); print(out)

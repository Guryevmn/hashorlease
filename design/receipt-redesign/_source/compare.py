# Glue "было / стало" screenshots for Mikhail: design/receipt-redesign/*.png
# Run from the repo root: uv run --with pillow python3 design/receipt-redesign/_source/compare.py
# Inputs: raw/before-*.png (main), raw/a-*.png (variant A, default), raw/b-*.png (variant B, ?receipt=b / ?pause=b).
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent.parent
raw = here / "raw"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
BG = (236, 238, 242)
INK = (20, 23, 28)
MUTED = (93, 102, 115)
ACCENT = (91, 63, 209)


def load(name, crop=None, scale=1.0):
    im = Image.open(raw / name).convert("RGB")
    if crop:
        im = im.crop(crop)
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    return im


def sheet(out, title, cols, direction="row", u=1.0):
    """cols: [(label, sublabel, image)]. Side by side (row) or stacked (column)."""
    gap, pad = int(40 * u), int(56 * u)
    head = int(150 * u)
    lab = int(84 * u)
    ft, fl, fs = (ImageFont.truetype(BOLD, int(48 * u)), ImageFont.truetype(BOLD, int(40 * u)), ImageFont.truetype(REG, int(28 * u)))
    if direction == "row":
        w = pad * 2 + sum(c[2].width for c in cols) + gap * (len(cols) - 1)
        h = head + lab + max(c[2].height for c in cols) + pad
    else:
        w = pad * 2 + max(c[2].width for c in cols)
        h = head + sum(lab + c[2].height for c in cols) + gap * (len(cols) - 1) + pad
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    d.text((pad, int(52 * u)), title, fill=INK, font=ft)
    x, y = pad, head
    for i, (label, sub, im) in enumerate(cols):
        color = MUTED if i == 0 else ACCENT
        d.text((x, y), label, fill=color, font=fl)
        if sub:
            lw = d.textlength(label, font=fl)
            d.text((x + lw + int(20 * u), y + int(10 * u)), sub, fill=MUTED, font=fs)
        img.paste(im, (x, y + lab))
        # thin frame so white screens don't melt into each other
        d.rectangle([x - 1, y + lab - 1, x + im.width, y + lab + im.height], outline=(210, 214, 220), width=2)
        if direction == "row":
            x += im.width + gap
        else:
            y += lab + im.height + gap
    img.save(here / out, optimize=True)
    print(here / out, img.size)


# Receipt sheet, phone 402 (screens are 2x: 804 px wide).
sheet(
    "receipt-402.png",
    "Шторка чека · телефон 402",
    [
        ("Было", "плоская таблица", load("before-receipt-402.png")),
        ("Вариант А", "рекомендую", load("a-receipt-402.png")),
        ("Вариант Б", "детали свёрнуты", load("b-receipt-402.png")),
    ],
)
# Receipt popover, computer 1280: the part of the screen around the popover (x 160–720, y 120–860 at 2x).
crop = (320, 240, 1440, 1720)
sheet(
    "receipt-1280.png",
    "Шторка чека · компьютер 1280 (фрагмент экрана)",
    [
        ("Было", None, load("before-receipt-1280.png", crop)),
        ("Вариант А", "рекомендую", load("a-receipt-1280.png", crop)),
        ("Вариант Б", None, load("b-receipt-1280.png", crop)),
    ],
)
# History pause 17 Nov, phone.
sheet(
    "pause-402.png",
    "History · пауза 17.11 · телефон 402",
    [
        ("Было", "39 серых строк", load("before-pause-402.png")),
        ("Вариант А", "рекомендую: один блок", load("a-pause-402.png")),
        ("Вариант Б", "строка на час", load("b-pause-402.png")),
    ],
)
# History pause, computer: full 1280 screens at 1x, stacked.
sheet(
    "pause-1280.png",
    "History · пауза 17.11 · компьютер 1280",
    [
        ("Было", None, load("before-pause-1280.png", scale=0.5)),
        ("Вариант А", "рекомендую", load("a-pause-1280.png", scale=0.5)),
        ("Вариант Б", None, load("b-pause-1280.png", scale=0.5)),
    ],
    direction="column",
    u=0.6,
)
# One purple: chips and switches, phone and computer.
sheet(
    "chips-402.png",
    "Один фиолетовый: чипсы и переключатели · телефон 402",
    [("Было", "чёрный, зелёный и фиолетовый", load("before-chips-402.png")), ("Стало", "один фиолетовый", load("a-chips-402.png"))],
)
sheet(
    "chips-1280.png",
    "Один фиолетовый: чипсы и переключатели · компьютер 1280",
    [("Было", None, load("before-chips-1280.png", scale=0.5)), ("Стало", None, load("a-chips-1280.png", scale=0.5))],
    direction="column",
    u=0.6,
)

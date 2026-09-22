#!/usr/bin/env python3
"""Generuje vizuály pre Google Play a App Store z klubových assetov.

Spúšťaj z rootu repozitára:

    pip install Pillow
    python3 docs/store/pripravit-vizualy.py                      # ikona + feature graphic
    python3 docs/store/pripravit-vizualy.py --screenshoty ~/snimky   # + úprava screenshotov

Screenshoty z telefónu majú často pomer mimo toho, čo Play povoľuje
(vyžaduje 16:9 až 9:16, teda 0.5625–1.7778). Skript ich preto neškáluje
násilne, ale doplní klubovou navy na presných 9:16 a odstrihne stavovú
lištu aj navigačnú lištu Androidu.
"""
import argparse
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "store"

# klubová paleta (zhodná s apps/mobile/src/theme.ts)
NAVY = (0x16, 0x22, 0x3C)
CLUB800 = (0x1A, 0x28, 0x48)
LIGHT = (0xD9, 0xE1, 0xF0)
MUTED = (0x8F, 0xA3, 0xC8)
RED = (0xD8, 0x1F, 0x2A)
WHITE = (255, 255, 255)

BOLD = ROOT / "apps/api/assets/fonts/DejaVuSans-Bold.ttf"
REG = ROOT / "apps/api/assets/fonts/DejaVuSans.ttf"

# Play: telefónny screenshot musí mať pomer medzi 9:16 a 16:9
CANVAS = (1125, 2000)  # presne 9:16
CROP_TOP = 62          # stavová lišta (čas, batéria, notifikácie)
CROP_BOTTOM = 80       # navigačná lišta Androidu


def ikona() -> None:
    """Play vyžaduje 512×512 bez priehľadnosti."""
    src = Image.open(ROOT / "apps/mobile/assets/icon.png").convert("RGB")
    src.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png", optimize=True)
    print("icon-512.png  512x512")


def feature_graphic() -> None:
    """Play feature graphic 1024×500, bez alfa kanála.

    Play obrázok v niektorých plochách kropuje, preto text drží odstup
    od pravého okraja a nič podstatné nie je pri hranách.
    """
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), NAVY)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, 10, h], fill=RED)  # červený akcent vľavo
    for i in range(260):                  # jemný prechod vpravo pre hĺbku
        t = i / 260
        d.line(
            [(w - 260 + i, 0), (w - 260 + i, h)],
            fill=tuple(int(NAVY[k] + (CLUB800[k] - NAVY[k]) * t) for k in range(3)),
        )

    crest = Image.open(ROOT / "apps/mobile/assets/logo.png").convert("RGBA")
    ch = 372
    cw = int(crest.width * ch / crest.height)
    crest = crest.resize((cw, ch), Image.LANCZOS)
    cx, cy = 74, (h - ch) // 2
    img.paste(crest, (cx, cy), crest)

    def fit(text: str, font_path: pathlib.Path, start: int, maxw: int) -> ImageFont.FreeTypeFont:
        """Najväčšia veľkosť fontu, pri ktorej sa text ešte zmestí."""
        for size in range(start, 10, -1):
            font = ImageFont.truetype(str(font_path), size)
            if d.textlength(text, font=font) <= maxw:
                return font
        return ImageFont.truetype(str(font_path), 10)

    tx = cx + cw + 56
    maxw = w - tx - 110
    l1, l2, l3 = (
        "FK Košická Nová Ves",
        "Klubový portál pre hráčov a rodičov",
        "Kalendár · Nominácie · Dochádzka",
    )
    f1, f2, f3 = fit(l1, BOLD, 56, maxw), fit(l2, REG, 30, maxw), fit(l3, REG, 25, maxw)
    height = lambda f: f.getbbox("Ag")[3] - f.getbbox("Ag")[1]
    h1, h2, h3 = height(f1), height(f2), height(f3)

    gap, rule = 26, 22
    y = (h - (h1 + gap + h2 + gap + rule + h3)) // 2 + 14  # optické vyváženie
    d.text((tx, y), l1, font=f1, fill=WHITE)
    y += h1 + gap
    d.text((tx, y), l2, font=f2, fill=LIGHT)
    y += h2 + gap
    d.line([(tx, y), (tx + 96, y)], fill=RED, width=4)
    y += rule
    d.text((tx, y), l3, font=f3, fill=MUTED)

    img.save(OUT / "feature-graphic-1024x500.png", optimize=True)
    print(f"feature-graphic-1024x500.png  {w}x{h}")


def screenshoty(src_dir: pathlib.Path) -> None:
    """Odstrihne systémové lišty a doplní snímky na presných 9:16."""
    files = sorted(
        p for p in src_dir.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )
    if not files:
        sys.exit(f"V {src_dir} nie sú žiadne obrázky")

    cw, ch = CANVAS
    for i, path in enumerate(files, start=1):
        im = Image.open(path).convert("RGB")
        im = im.crop((0, CROP_TOP, im.width, im.height - CROP_BOTTOM))
        scale = min(cw / im.width, ch / im.height)
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", CANVAS, NAVY)
        canvas.paste(im, ((cw - im.width) // 2, (ch - im.height) // 2))
        name = f"{i:02d}-{path.stem}.png"
        canvas.save(OUT / name, optimize=True)
        print(f"{name}  {cw}x{ch}  pomer={cw / ch:.4f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--screenshoty", type=pathlib.Path, help="priečinok so snímkami z telefónu")
    args = ap.parse_args()

    ikona()
    feature_graphic()
    if args.screenshoty:
        screenshoty(args.screenshoty)

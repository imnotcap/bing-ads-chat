#!/usr/bin/env python3
"""Generates the themed NSIS installer bitmaps (run once; the BMPs are committed).

  python3 scripts/make-installer-art.py

  src-tauri/installer/sidebar.bmp  164x314  welcome + finish page
  src-tauri/installer/header.bmp   150x57   top of the other pages
Drawn at 4x and scaled down for smooth edges. NSIS needs 24-bit BMPs.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "installer"
ICON = Image.open(ROOT / "src-tauri" / "icons" / "icon.png").convert("RGBA")
S = 4  # supersampling


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for name in (f"/usr/share/fonts/opentype/inter/Inter-{weight}.otf", f"/usr/share/fonts/opentype/inter/InterDisplay-{weight}.otf"):
        if Path(name).exists():
            return ImageFont.truetype(name, size * S)
    return ImageFont.load_default()


def glow(size, center, radius, color, alpha):
    # Blur only the alpha mask – blurring an RGBA layer pulls in the black of
    # transparent pixels and turns the light grey.
    mask = Image.new("L", size, 0)
    x, y = center
    ImageDraw.Draw(mask).ellipse((x - radius, y - radius, x + radius, y + radius), fill=alpha)
    layer = Image.new("RGBA", size, (*color, 0))
    layer.putalpha(mask.filter(ImageFilter.GaussianBlur(radius * 0.55)))
    return layer


def sidebar():
    w, h = 164 * S, 314 * S
    img = Image.new("RGBA", (w, h), (251, 251, 252, 255))
    # Soft lavender light from the top, like the chat's start screen.
    for center, r, color, a in [
        ((w * 0.5, h * 0.3), w * 0.75, (169, 157, 255), 150),
        ((w * 0.15, h * 0.12), w * 0.45, (201, 192, 255), 140),
        ((w * 0.9, h * 0.42), w * 0.4, (156, 67, 254), 70),
        ((w * 0.5, h * 0.95), w * 0.6, (239, 236, 255), 200),
    ]:
        img = Image.alpha_composite(img, glow((w, h), center, r, color, a))
    # Faint ASCII texture (the chat's GradientASCII horizon).
    tex = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(tex)
    chars = " =+xX0S8#@"
    f = font("Medium", 9)
    import random
    random.seed(7)
    for row in range(0, h, 15 * S):
        for col in range(0, w, 10 * S):
            band = 1 - abs(row / h - 0.32) * 3.2
            if band <= 0 or random.random() > band:
                continue
            ch = chars[min(len(chars) - 1, int(random.random() * band * len(chars)))]
            d.text((col, row), ch, font=f, fill=(109, 92, 246, int(55 * band)))
    img = Image.alpha_composite(img, tex)
    # App icon with a soft shadow.
    size = 72 * S
    icon = ICON.resize((size, size), Image.LANCZOS)
    x, y = (w - size) // 2, int(h * 0.3 - size / 2)
    smask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(smask).rounded_rectangle((x + 4 * S, y + 10 * S, x + size - 4 * S, y + size + 6 * S), radius=18 * S, fill=90)
    shadow = Image.new("RGBA", (w, h), (90, 72, 232, 0))
    shadow.putalpha(smask.filter(ImageFilter.GaussianBlur(9 * S)))
    img = Image.alpha_composite(img, shadow)
    img.alpha_composite(icon, (x, y))
    d = ImageDraw.Draw(img)
    title = "Bing Ads Chat"
    tf = font("SemiBold", 17)
    tw = d.textlength(title, font=tf)
    d.text(((w - tw) / 2, y + size + 16 * S), title, font=tf, fill=(18, 18, 22, 255))
    sub = "AI-assistent til"
    sub2 = "Microsoft Advertising"
    sf = font("Regular", 10)
    for i, line in enumerate((sub, sub2)):
        lw = d.textlength(line, font=sf)
        d.text(((w - lw) / 2, y + size + 42 * S + i * 14 * S), line, font=sf, fill=(110, 110, 120, 255))
    return img.resize((164, 314), Image.LANCZOS).convert("RGB")


def header():
    w, h = 150 * S, 57 * S
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    img = Image.alpha_composite(img, glow((w, h), (w * 0.82, h * 0.5), h * 0.9, (201, 192, 255), 120))
    size = 34 * S
    icon = ICON.resize((size, size), Image.LANCZOS)
    x, y = w - size - 14 * S, (h - size) // 2
    img.alpha_composite(icon, (x, y))
    return img.resize((150, 57), Image.LANCZOS).convert("RGB")


OUT.mkdir(parents=True, exist_ok=True)
sidebar().save(OUT / "sidebar.bmp")
header().save(OUT / "header.bmp")
print("Skrev", OUT / "sidebar.bmp", "og", OUT / "header.bmp")

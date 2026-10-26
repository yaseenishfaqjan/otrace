"""
Turn the generated campaign shots into web assets.

Product tiles are 4:5 (the fashion standard) but the sources are 1:1, so each
is centre-cropped — for these compositions that only trims empty backdrop.
Heroes keep their native aspect.
"""
from pathlib import Path
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE / "generated"
OUT = HERE.parent / "site" / "public"
(OUT / "products").mkdir(parents=True, exist_ok=True)

# (source, destination, target aspect W/H or None to keep, long edge, quality)
JOBS = [
    ("hero_desktop",             "hero-desktop.jpg",               None, 2000, 84),
    ("hero_mobile",              "hero-mobile.jpg",                None, 1400, 84),
    ("campaign_pair",            "campaign.jpg",                   None, 1600, 84),

    ("hoodie_black_flat_front",  "products/hoodie-onyx-front.jpg",       0.8, 1400, 86),
    ("hoodie_black_flat_back",   "products/hoodie-onyx-back.jpg",        0.8, 1400, 86),
    ("hoodie_black_worn_front",  "products/hoodie-onyx-worn-front.jpg",  0.8, 1400, 86),
    ("hoodie_black_worn_back",   "products/hoodie-onyx-worn-back.jpg",   0.8, 1400, 86),

    ("hoodie_cream_flat_front",  "products/hoodie-cream-front.jpg",      0.8, 1400, 86),
    ("hoodie_cream_flat_back",   "products/hoodie-cream-back.jpg",       0.8, 1400, 86),
    ("hoodie_cream_worn_front",  "products/hoodie-cream-worn-front.jpg", 0.8, 1400, 86),
    ("hoodie_cream_worn_back",   "products/hoodie-cream-worn-back.jpg",  0.8, 1400, 86),

    ("pants_black_flat_front",   "products/pant-onyx-front.jpg",         0.8, 1400, 86),
    ("pants_black_worn",         "products/pant-onyx-worn.jpg",          0.8, 1400, 86),
    ("pants_cream_flat_front",   "products/pant-cream-front.jpg",        0.8, 1400, 86),
    ("pants_cream_worn",         "products/pant-cream-worn.jpg",         0.8, 1400, 86),

    ("detail_fabric",            "detail-fabric.jpg",              None, 1400, 84),
    ("detail_drawcord",          "detail-drawcord.jpg",            None, 1400, 84),
    ("detail_stitch",            "detail-stitch.jpg",              None, 1400, 84),
]

# The black garments render a touch warm/brown. A small saturation pull moves
# them toward the true onyx of the brand sheet without flattening the fabric.
COOL_DOWN = {
    "hoodie_black_worn_back", "hoodie_black_worn_front",
    "hoodie_black_flat_front", "hoodie_black_flat_back",
}


def crop_to(im: Image.Image, aspect: float) -> Image.Image:
    w, h = im.size
    if w / h > aspect:                      # too wide — trim the sides
        new_w = int(h * aspect)
        left = (w - new_w) // 2
        return im.crop((left, 0, left + new_w, h))
    new_h = int(w / aspect)                 # too tall — trim top and bottom
    top = (h - new_h) // 2
    return im.crop((0, top, w, top + new_h))


total = 0
for name, dest, aspect, long_edge, quality in JOBS:
    src = SRC / f"{name}.png"
    if not src.exists():
        print(f"  MISSING {name}")
        continue

    im = Image.open(src).convert("RGB")
    if aspect:
        im = crop_to(im, aspect)

    scale = long_edge / max(im.size)
    if scale < 1:
        im = im.resize((round(im.size[0] * scale), round(im.size[1] * scale)), Image.LANCZOS)

    if name in COOL_DOWN:
        im = ImageEnhance.Color(im).enhance(0.82)

    path = OUT / dest
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    total += path.stat().st_size
    print(f"  {dest:<40} {im.size[0]}x{im.size[1]}  {path.stat().st_size/1024:>5.0f} KB")

print(f"\ntotal {total/1024/1024:.1f} MB across {len(JOBS)} images")

"""
Turn the generated lookbook frames into web assets in site/public/lookbook.

Wide (desktop) frames keep 16:9, tall (phone) frames keep 9:16, portraits keep
3:4. Each is capped at a long edge that stays sharp full screen on a retina
phone or a 1440-2560px desktop without shipping the raw 2K PNG.
"""
from pathlib import Path
from PIL import Image, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC = HERE / "generated" / "lookbook"
OUT = HERE.parent / "site" / "public" / "lookbook"
OUT.mkdir(parents=True, exist_ok=True)

JOBS = []
for n in (1, 4, 7, 10):
    JOBS.append((f"look{n:02d}_wide", f"look-{n:02d}-wide.jpg", 2400, 80))
    JOBS.append((f"look{n:02d}_tall", f"look-{n:02d}-tall.jpg", 1800, 80))
for n in (2, 3, 5, 6, 8, 9):
    JOBS.append((f"look{n:02d}", f"look-{n:02d}.jpg", 1800, 82))

# Onyx garments render a touch warm/brown; the same small saturation pull the
# product shots get (prepare_images.py) moves them toward the brand sheet's onyx.
COOL_DOWN = {"look01_wide", "look01_tall", "look03", "look08", "look09"}

total = 0
for name, dest, long_edge, quality in JOBS:
    src = SRC / f"{name}.png"
    if not src.exists():
        print(f"  MISSING {name}")
        continue
    im = Image.open(src).convert("RGB")
    scale = long_edge / max(im.size)
    if scale < 1:
        im = im.resize((round(im.size[0] * scale), round(im.size[1] * scale)), Image.LANCZOS)
    if name in COOL_DOWN:
        im = ImageEnhance.Color(im).enhance(0.85)
    path = OUT / dest
    im.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    total += path.stat().st_size
    print(f"  {dest:<22} {im.size[0]}x{im.size[1]}  {path.stat().st_size / 1024:>5.0f} KB")

print(f"\ntotal {total / 1024 / 1024:.1f} MB across {len(JOBS)} images")

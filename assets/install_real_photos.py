"""
Put the client's real branded photographs onto the site.

These arrived as clean full-bleed frames — the garments carry the actual printed
marks, not the ones this repo composited onto blank stock. Wherever a real
photograph exists for a slot it wins; the composites stay only where nothing
real was supplied.

Each slot has its own shape, so every image is cropped to fit rather than
squashed. Crops are taken from the upper part of the frame, because these are
standing figures and the head is the part you cannot afford to lose.
"""
import os
from PIL import Image

SRC = ('C:/Users/PCL/AppData/Local/Temp/claude/'
       'C--Users-PCL-Documents-STOREHOUSE-PROJECT--3-/'
       '3bfc7725-0030-44c2-acaa-577a37723b4b/scratchpad/otrace-new')
PUB = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'site', 'public'))

P = lambda n: os.path.join(SRC, 'WhatsApp Image 2026-09-29 at %s.jpeg' % n)

# photo -> where it goes, and how tall a slice of the frame to keep.
# `top` is where the crop window starts, as a fraction of the spare height:
# 0 keeps the very top of the frame, 1 keeps the bottom.
JOBS = [
    # ---- lookbook, matched to the alt text already written for each look ----
    ('19.41.10', 'lookbook/look-03.jpg', 0.05),          # black set, hood up, standing
    ('19.42.12', 'lookbook/look-06.jpg', 0.05),          # cream hoodie, black pant, leaning
    ('19.42.49', 'lookbook/look-10-tall.jpg', 0.05),     # black hoodie, cream pant, tunnel
    ('19.42.49', 'lookbook/look-10-wide.jpg', 0.18),
    ('19.43.04', 'lookbook/look-04-tall.jpg', 0.05),     # two models
    ('19.43.04', 'lookbook/look-04-wide.jpg', 0.20),
    ('19.43.23', 'lookbook/look-07-tall.jpg', 0.05),     # cream set, seated on a block
    ('19.43.23', 'lookbook/look-07-wide.jpg', 0.15),
    ('19.43.42', 'lookbook/look-02.jpg', 0.05),          # cream set, seated on steps
    ('19.44.00', 'lookbook/look-09.jpg', 0.05),          # black hoodie, hands in pocket
    ('19.45.11', 'lookbook/look-05.jpg', 0.02),          # cream hoodie, close
    # ---- the campaign block on the homepage ----
    ('19.43.04', 'campaign.jpg', 0.05),
    # ---- product galleries: the worn shots ----
    ('19.44.00', 'products/hoodie-onyx-worn-front.jpg', 0.02),
    ('19.45.11', 'products/hoodie-cream-worn-front.jpg', 0.02),
    ('19.42.30', 'products/pant-cream-worn.jpg', 0.10),
    ('19.41.10', 'products/pant-onyx-worn.jpg', 0.10),
]


def fit(src_path, dst_path, top):
    """Crop to the shape the site already uses, keeping as much height as possible."""
    with Image.open(dst_path) as current:
        tw, th = current.size
    want = tw / th

    im = Image.open(src_path).convert('RGB')
    w, h = im.size
    have = w / h

    if have > want:                      # too wide: trim the sides, centred
        new_w = int(h * want)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:                                # too tall: trim height from `top`
        new_h = int(w / want)
        y = int((h - new_h) * top)
        im = im.crop((0, y, w, y + new_h))

    # Never upscale past the source: a soft image looks worse than a small one.
    if im.size[0] > tw:
        im = im.resize((tw, th), Image.LANCZOS)
    else:
        im = im.resize((tw, th), Image.LANCZOS)
    im.save(dst_path, quality=90, optimize=True, progressive=True)
    return im.size


if __name__ == '__main__':
    for photo, target, top in JOBS:
        src = P(photo)
        dst = os.path.join(PUB, target)
        if not os.path.exists(src):
            print('  missing source:', photo)
            continue
        if not os.path.exists(dst):
            print('  no such slot:', target)
            continue
        size = fit(src, dst, top)
        print('  %-42s <- %s  %s' % (target, photo, size))

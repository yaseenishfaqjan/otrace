"""
Put the OTRACE marks onto the garment photographs.

The photographs were shot blank, so every product image showed an unbranded
hoodie or sweatpant — the one thing a clothing brand cannot do. This places the
real wordmark and the OT monogram the way the client's reference shows them:
across the chest with the monogram on the sleeve, and down the left thigh with
the monogram on the right.

It is not a paste. A flat sticker on a photograph reads as a mockup instantly,
so the mark is shaded by the fabric underneath it: the garment's own light and
shadow is measured where the mark will sit and multiplied back into it, which
is what makes a print sink into the folds instead of floating over them.

Run:  python brand_apply.py            # writes assets/branded/
      python brand_apply.py --install  # and copies them into site/public
"""
import argparse
import os
import shutil
from PIL import Image, ImageFilter, ImageStat

try:
    import numpy as np
except ImportError:  # the clip is a refinement, not a requirement
    np = None

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'generated')
OUT = os.path.join(HERE, 'branded')
SITE = os.path.abspath(os.path.join(HERE, '..', 'site', 'public', 'products'))

WORDMARK = os.path.join(HERE, 'brand', 'wordmark-flat-cream.png')
MONOGRAM = 'C:/Users/PCL/Downloads/OTRACE_OT_Monogram_Embroidery_Cutout.png'

CREAM = (233, 227, 214)
INK = (20, 18, 15)


def silhouette(path):
    """The mark as a clean alpha stencil, whatever colour the source file is."""
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    # Anything near-transparent is background; harden the edge so a soft cutout
    # does not leave a grey halo when it is recoloured.
    alpha = alpha.point(lambda a: 0 if a < 24 else min(255, int(a * 1.12)))
    return alpha


def garment_box(im):
    """
    Where the clothing actually is in the frame.

    Placing marks against the edge of the photograph put the wordmark across a
    sleeve seam, because the garment does not fill the frame the same way in
    every shot. Everything is positioned against these bounds instead.
    """
    # On a plain studio backdrop this finds the garment. On the textured paper
    # the flat-lays were shot on it finds the whole frame, and the fractions
    # below are then simply read against the photograph — which is why the
    # placements are tuned per image rather than assumed.
    small = im.convert('L').resize((256, 256), Image.BILINEAR)
    px = small.load()
    # The backdrop is whatever the corners are; the garment is what differs.
    corners = [px[4, 4], px[251, 4], px[4, 251], px[251, 251]]
    bg = sum(corners) / 4.0
    xs, ys = [], []
    for y in range(256):
        for x in range(256):
            if abs(px[x, y] - bg) > 18:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0.0, 0.0, 1.0, 1.0)
    w, h = im.size
    return (min(xs) / 256, min(ys) / 256, (max(xs) - min(xs)) / 256, (max(ys) - min(ys)) / 256)


def place(garment, stencil, colour, box, rotate=0.0, strength=0.82, softness=0.6, bounds=None,
          clip_to_cloth=False):
    """
    Lay one mark on the garment.

    box      (left, top, width) as fractions of the image; height follows the
             mark's own proportions.
    strength how much the fabric's shading shows through the ink (0 = flat
             sticker, 1 = fully shaded by the cloth).
    """
    w, h = garment.size
    # box is read against the garment, not the photograph
    gx, gy, gw, gh = bounds if bounds else (0.0, 0.0, 1.0, 1.0)
    mark_w = int(w * gw * box[2])
    ratio = stencil.size[1] / stencil.size[0]
    mark_h = int(mark_w * ratio)

    mark = stencil.resize((mark_w, mark_h), Image.LANCZOS)
    if rotate:
        mark = mark.rotate(rotate, expand=True, resample=Image.BICUBIC)
    if softness:
        # Printed edges on fleece are never razor sharp.
        mark = mark.filter(ImageFilter.GaussianBlur(softness))

    # box[0] is the centre of the mark, so a wider mark grows both ways rather
    # than drifting off one side of the chest.
    mw, mh = mark.size
    x = int(w * (gx + gw * box[0]) - mw / 2)
    y = int(h * (gy + gh * box[1]) - mh / 2)
    x = max(0, min(w - mw, x))
    y = max(0, min(h - mh, y))

    # What the cloth is doing underneath: its light and shade, measured only
    # where the mark will land.
    patch = garment.crop((x, y, x + mw, y + mh)).convert('L')
    mean = ImageStat.Stat(patch).mean[0] or 1.0
    shading = patch.filter(ImageFilter.GaussianBlur(mw * 0.02))

    ink = Image.new('RGB', (mw, mh), colour)
    px_ink = ink.load()
    px_shade = shading.load()
    for yy in range(mh):
        for xx in range(mw):
            # Around 1.0 where the cloth is averagely lit, below it in a fold.
            f = 1.0 + (px_shade[xx, yy] - mean) / max(mean, 1.0) * strength
            f = max(0.55, min(1.45, f))
            r, g, b = px_ink[xx, yy]
            px_ink[xx, yy] = (
                max(0, min(255, int(r * f))),
                max(0, min(255, int(g * f))),
                max(0, min(255, int(b * f))),
            )

    if clip_to_cloth:
        # Trim the mark where there is no garment under it — the arrow tail was
        # hanging off the trouser leg onto the paper backdrop.
        under = garment.crop((x, y, x + mw, y + mh)).convert('L')
        corner = garment.convert('L').getpixel((4, 4))
        cloth = under.point(lambda v, c=corner: 255 if abs(v - c) > 26 else 0)
        cloth = cloth.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        mark = Image.fromarray(
            (np.asarray(mark, dtype=np.uint16) * np.asarray(cloth, dtype=np.uint16) // 255).astype('uint8')
        ) if np is not None else mark

    garment.paste(ink, (x, y), mark)
    return garment


def brand(name, marks):
    src = os.path.join(SRC, name)
    if not os.path.exists(src):
        src = os.path.join(SRC, 'lookbook', name)
    if not os.path.exists(src):
        print('  skip (missing):', name)
        return None
    im = Image.open(src).convert('RGB')
    bounds = garment_box(im)
    for mark in marks:
        place(im, mark['stencil'], mark['colour'], mark['box'],
              mark.get('rotate', 0.0), mark.get('strength', 0.82), mark.get('softness', 0.6),
              # On a model shot the chest is not the middle of the garment's
              # bounding box, so those are positioned against the photograph.
              None if mark.get('frame') else bounds,
              mark.get('clip', False))
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, name)
    im.save(dst)
    print('  branded:', name)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--install', action='store_true', help='copy into site/public/products')
    ap.add_argument('--only', default='', help='brand one file only, for checking placement')
    args = ap.parse_args()

    word = silhouette(WORDMARK)
    mono = silhouette(MONOGRAM)

    # Placements read off the client's reference shots. Fractions, so they hold
    # whatever size the photograph is.
    jobs = {
        # Hoodies: wordmark across the chest, monogram on the wearer's left sleeve.
        'hoodie_black_flat_front.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.50, 0.42, 0.44)},
            {'stencil': mono, 'colour': CREAM, 'box': (0.815, 0.45, 0.095)},
        ],
        'hoodie_cream_flat_front.png': [
            {'stencil': word, 'colour': INK, 'box': (0.50, 0.42, 0.44)},
            {'stencil': mono, 'colour': INK, 'box': (0.815, 0.45, 0.095)},
        ],
        'hoodie_black_worn_front.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.50, 0.34, 0.44)},
            {'stencil': mono, 'colour': CREAM, 'box': (0.835, 0.40, 0.085)},
        ],
        'hoodie_cream_worn_front.png': [
            {'stencil': word, 'colour': INK, 'box': (0.50, 0.34, 0.44)},
            {'stencil': mono, 'colour': INK, 'box': (0.835, 0.40, 0.085)},
        ],
        # Sweatpants: wordmark down the left thigh, monogram on the right.
        'pants_black_flat_front.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.375, 0.46, 0.25), 'rotate': 58, 'clip': True},
            {'stencil': mono, 'colour': CREAM, 'box': (0.62, 0.45, 0.11), 'clip': True},
        ],
        # Worn shots: the legs are narrower and the marks smaller, measured off
        # each photograph rather than assumed — the model does not stand in the
        # same place twice.
        'pants_black_worn.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.40, 0.40, 0.15), 'rotate': 58, 'clip': True},
            {'stencil': mono, 'colour': CREAM, 'box': (0.585, 0.38, 0.055)},
        ],
        'pants_cream_worn.png': [
            {'stencil': word, 'colour': INK, 'box': (0.455, 0.46, 0.13), 'rotate': 58, 'clip': True},
            {'stencil': mono, 'colour': INK, 'box': (0.65, 0.44, 0.05)},
        ],
        'pants_cream_flat_front.png': [
            {'stencil': word, 'colour': INK, 'box': (0.375, 0.46, 0.25), 'rotate': 58, 'clip': True},
            {'stencil': mono, 'colour': INK, 'box': (0.62, 0.45, 0.11), 'clip': True},
        ],
    }

    # Campaign and lookbook frames where the chest is close enough for a print
    # to read. The distant and back-facing frames are deliberately left alone:
    # a mark a few pixels wide is a smudge, and a smudge looks like a mistake.
    jobs.update({
        'look09.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.46, 0.40, 0.42), 'strength': 0.7, 'frame': True},
            {'stencil': mono, 'colour': CREAM, 'box': (0.76, 0.44, 0.07), 'strength': 0.7, 'frame': True},
        ],
        'look02.png': [
            {'stencil': word, 'colour': INK, 'box': (0.53, 0.41, 0.15), 'strength': 0.7, 'frame': True},
        ],
        'look03.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.50, 0.33, 0.13), 'strength': 0.7, 'frame': True},
        ],
        'look06.png': [
            {'stencil': word, 'colour': INK, 'box': (0.44, 0.31, 0.12), 'strength': 0.7, 'frame': True},
        ],
        'campaign_pair.png': [
            {'stencil': word, 'colour': CREAM, 'box': (0.33, 0.33, 0.14), 'strength': 0.7},
            {'stencil': word, 'colour': INK, 'box': (0.62, 0.34, 0.14), 'strength': 0.7},
        ],
    })

    if args.only:
        jobs = {k: v for k, v in jobs.items() if k == args.only}

    for name, marks in jobs.items():
        brand(name, marks)

    if args.install:
        # The site's own filenames, which the catalogue already points at.
        mapping = {
            'hoodie_black_flat_front.png': 'hoodie-onyx-front.jpg',
            'hoodie_cream_flat_front.png': 'hoodie-cream-front.jpg',
            'hoodie_black_worn_front.png': 'hoodie-onyx-worn-front.jpg',
            'hoodie_cream_worn_front.png': 'hoodie-cream-worn-front.jpg',
            'pants_black_flat_front.png': 'pant-onyx-front.jpg',
            'pants_cream_flat_front.png': 'pant-cream-front.jpg',
            'pants_black_worn.png': 'pant-onyx-worn.jpg',
            'pants_cream_worn.png': 'pant-cream-worn.jpg',
            # Campaign and lookbook frames live beside the products.
            'campaign_pair.png': '../campaign.jpg',
            'look02.png': '../lookbook/look-02.jpg',
            'look03.png': '../lookbook/look-03.jpg',
            'look06.png': '../lookbook/look-06.jpg',
            'look09.png': '../lookbook/look-09.jpg',
        }
        for src_name, site_name in mapping.items():
            path = os.path.join(OUT, src_name)
            if not os.path.exists(path):
                continue
            im = Image.open(path).convert('RGB')
            target = os.path.join(SITE, site_name)
            # Match the shape the site already uses. The sources are square and
            # the site's product frames are 4:5 — writing a square here would
            # change how every gallery crops.
            if os.path.exists(target):
                with Image.open(target) as current:
                    tw, th = current.size
                ratio = tw / th
                w, h = im.size
                if w / h > ratio:
                    new_w = int(h * ratio)
                    im = im.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
                else:
                    new_h = int(w / ratio)
                    im = im.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
                im = im.resize((tw, th), Image.LANCZOS)
            else:
                im.thumbnail((1024, 1024), Image.LANCZOS)
            im.save(target, quality=88, optimize=True, progressive=True)
            print('  installed: %s (%dx%d)' % (site_name, im.size[0], im.size[1]))


if __name__ == '__main__':
    main()

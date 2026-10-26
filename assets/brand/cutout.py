"""Cut the OTRACE wordmark out of the baked-in checkerboard backgrounds."""
import numpy as np
from PIL import Image, ImageFilter

ONYX = (13, 12, 11)

# 1. Flat black version -> alpha from darkness (checker is >= ~190 luminance).
blk = np.asarray(Image.open('src-wordmark-black.jpg').convert('L')).astype(np.float32)
a_flat = np.clip((170 - blk) / 110, 0, 1)
# 2. Embroidery -> alpha from warmth (thread is cream, checker is neutral grey/white).
emb = np.asarray(Image.open('src-wordmark-embroidery.jpg').convert('RGB')).astype(np.float32)
warm = emb[..., 0] - emb[..., 2]
a_emb = np.clip((warm - 7) / 10, 0, 1)
a_emb = np.asarray(Image.fromarray((a_emb * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))).astype(np.float32) / 255

for name, a in [('flat', a_flat), ('emb', a_emb)]:
    ys, xs = np.where(a > 0.5)
    print(name, 'bbox x', xs.min(), xs.max(), 'y', ys.min(), ys.max(), 'coverage', round(float((a > .5).mean()) * 100, 2), '%')

# overlap of the two masks (are they the same drawing in the same place?)
f, e = a_flat > .5, a_emb > .5
print('IoU flat vs embroidery', round(float((f & e).sum() / (f | e).sum()), 3))

def crop_box(a, pad=24):
    ys, xs = np.where(a > 0.5)
    return (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, a.shape[1]), min(ys.max() + pad, a.shape[0]))

# flat cream master (colour is irrelevant for a CSS mask, cream for direct use)
box = crop_box(a_flat)
rgba = np.zeros(a_flat.shape + (4,), np.uint8)
rgba[..., :3] = (240, 235, 224)
rgba[..., 3] = (a_flat * 255).astype(np.uint8)
Image.fromarray(rgba).crop(box).save('wordmark-flat-cream.png', optimize=True)

box_e = crop_box(a_emb)
rgba = np.dstack([emb.astype(np.uint8), (a_emb * 255).astype(np.uint8)])
Image.fromarray(rgba).crop(box_e).save('wordmark-embroidery.png', optimize=True)

# previews on onyx
for fn in ['wordmark-flat-cream.png', 'wordmark-embroidery.png']:
    im = Image.open(fn)
    bg = Image.new('RGBA', im.size, ONYX + (255,))
    bg.alpha_composite(im)
    bg.convert('RGB').save('preview-' + fn.replace('.png', '.jpg'), quality=88)
    print(fn, im.size)

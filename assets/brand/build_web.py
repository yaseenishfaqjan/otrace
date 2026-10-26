"""Web assets for the OTRACE wordmark.
   - otrace-wordmark.svg : exact potrace vector of the flat logo, tight viewBox, fill currentColor-ready (black; used as a CSS mask)
   - otrace-wordmark-embroidery.png/.webp : embroidered version, alpha from the clean flat drawing, gaps in-filled with thread colour
"""
import re
import numpy as np
from PIL import Image, ImageFilter

OUT = '../../site/public/brand/'
import os; os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- vector
svg = open('src-wordmark-vector.svg', encoding='utf-8').read()
body = svg[svg.index('<g '):svg.rindex('</svg>')]
# flat bbox in source pixels: x 263..2091, y 132..1410 ; the svg viewBox is 2x the jpg
pad = 14
x0, y0, x1, y1 = (263 - pad) * 2, (132 - pad) * 2, (2091 + pad) * 2, (1410 + pad) * 2
clean = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d">' % (x0, y0, x1 - x0, y1 - y0)) + body + '</svg>\n'
clean = re.sub(r'\s*\n\s*', ' ', clean)
open(OUT + 'otrace-wordmark.svg', 'w', encoding='utf-8').write(clean)
print('svg bytes', len(clean), 'viewBox', x0, y0, x1 - x0, y1 - y0, 'aspect', round((x1 - x0) / (y1 - y0), 4))

# ------------------------------------------------------------ embroidery
blk = np.asarray(Image.open('src-wordmark-black.jpg').convert('L')).astype(np.float32)
a_flat = np.clip((170 - blk) / 110, 0, 1)
emb = np.asarray(Image.open('src-wordmark-embroidery.jpg').convert('RGB')).astype(np.float32)
warm = emb[..., 0] - emb[..., 2]
lum = emb.mean(-1)
w = np.clip((warm - 12) / 10, 0, 1) * np.clip((lum - 95) / 40, 0, 1)   # confidence "this is thread"

def mf(a, size, kind):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = im.filter(ImageFilter.MaxFilter(size) if kind == 'max' else ImageFilter.MinFilter(size))
    return np.asarray(im).astype(np.float32) / 255

# silhouette: the clean flat drawing grown 1px, united with confident thread, never beyond a 4px halo
alpha = np.minimum(np.maximum(mf(a_flat, 3, 'max'), mf(w, 3, 'min')), mf(a_flat, 9, 'max'))
alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255

# in-fill non-thread pixels inside the silhouette from nearby thread (normalised convolution)
def blur(a, r):
    # three separable box passes ~ gaussian (Pillow cannot blur float images)
    out = a.astype(np.float32)
    k = 2 * r + 1
    for _ in range(3):
        for ax in (0, 1):
            pad = [(r + 1, r) if i == ax else (0, 0) for i in range(2)]
            c = np.cumsum(np.pad(out, pad, mode='edge'), axis=ax)
            hi = c[k:, :] if ax == 0 else c[:, k:]
            lo = c[:-k, :] if ax == 0 else c[:, :-k]
            out = (hi - lo) / k
    return out
fill = np.zeros_like(emb)
den = blur(w, 5) + 1e-4
for c in range(3):
    fill[..., c] = blur(emb[..., c] * w, 5) / den
# gap pixels become a slightly deeper thread tone so the relief still reads
fill *= 0.82
rgb = emb * w[..., None] + fill * (1 - w[..., None])

ys, xs = np.where(a_flat > .5)
box = (xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad)
out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])).crop(box)
big = out.resize((1600, round(1600 * out.height / out.width)), Image.LANCZOS)
big.save(OUT + 'otrace-wordmark-embroidery.png', optimize=True)
big.save(OUT + 'otrace-wordmark-embroidery.webp', quality=86, method=6)
for f in ['otrace-wordmark-embroidery.png', 'otrace-wordmark-embroidery.webp']:
    print(f, big.size, os.path.getsize(OUT + f) // 1024, 'KB')

bg = Image.new('RGBA', out.size, (13, 12, 11, 255)); bg.alpha_composite(out)
bg.convert('RGB').save('preview-wordmark-embroidery.jpg', quality=90)
bg.crop((900, 700, 1500, 1100)).resize((1200, 800), Image.LANCZOS).convert('RGB').save('preview-emb-zoom.jpg', quality=90)

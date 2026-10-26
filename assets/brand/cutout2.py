import numpy as np
from PIL import Image, ImageFilter
blk = np.asarray(Image.open('src-wordmark-black.jpg').convert('L')).astype(np.float32)
a_flat = np.clip((170 - blk) / 110, 0, 1)
emb = np.asarray(Image.open('src-wordmark-embroidery.jpg').convert('RGB')).astype(np.float32)
warm = emb[..., 0] - emb[..., 2]
lum = emb.mean(-1)
# thread = warm AND bright enough; the cast shadow on the checker is dark + near-neutral
a = np.clip((warm - 12) / 10, 0, 1) * np.clip((lum - 95) / 40, 0, 1)
img = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
a = np.asarray(img).astype(np.float32) / 255
# never extend past the clean flat drawing (plus a small allowance for thread relief)
limit = np.asarray(Image.fromarray((a_flat * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
a = np.minimum(a, limit)
ys, xs = np.where(a_flat > .5); pad = 24
box = (xs.min()-pad, ys.min()-pad, xs.max()+pad, ys.max()+pad)
Image.fromarray(np.dstack([emb.astype(np.uint8), (a*255).astype(np.uint8)])).crop(box).save('wordmark-embroidery.png', optimize=True)
im = Image.open('wordmark-embroidery.png'); bg = Image.new('RGBA', im.size, (13,12,11,255)); bg.alpha_composite(im)
bg.convert('RGB').save('preview-wordmark-embroidery.jpg', quality=90)
bg.crop((900, 700, 1500, 1100)).resize((1200, 800), Image.LANCZOS).convert('RGB').save('preview-emb-zoom.jpg', quality=90)
print('ok', im.size)

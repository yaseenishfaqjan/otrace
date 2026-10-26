"""Share image (og.jpg, 1200x630): logo + drop line on onyx, campaign frame on the right."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "site" / "public" / "og.jpg"
ONYX, DIM = (13, 12, 11), (185, 179, 168)
W, H = 1200, 630

canvas = Image.new("RGB", (W, H), ONYX)

# right: look 01 (tall framing) scaled to 560 wide, cropped head to feet
photo = Image.open(HERE / "generated" / "lookbook" / "look01_tall.png").convert("RGB")
pw = 560
scaled = photo.resize((pw, round(photo.height * pw / photo.width)), Image.LANCZOS)
top = 330
canvas.paste(scaled.crop((0, top, pw, top + H)), (W - pw, 0))

# feather the photo's left edge into the onyx
fade = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(fade)
for x in range(160):
    d.line([(W - pw + x, 0), (W - pw + x, H)], fill=round(255 * (1 - x / 160) ** 1.6))
canvas.paste(Image.new("RGB", (W, H), ONYX), (0, 0), fade)

# left: the wordmark and one line
logo = Image.open(HERE / "brand" / "wordmark-flat-cream.png")
lw = 470
logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
lx, ly = 80, (H - logo.height) // 2 - 34
canvas.paste(logo, (lx, ly), logo)

font = None
for f in ("C:/Windows/Fonts/segoeuisb.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"):
    try:
        font = ImageFont.truetype(f, 17)
        break
    except OSError:
        pass
text, x, y = "AW2026  \u2014  PRE-ORDER OPEN", lx + 6, ly + logo.height + 34
draw = ImageDraw.Draw(canvas)
for ch in text:
    draw.text((x, y), ch, font=font, fill=DIM)
    x += draw.textlength(ch, font=font) + 3.2

canvas.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
print("og.jpg", canvas.size, OUT.stat().st_size // 1024, "KB")

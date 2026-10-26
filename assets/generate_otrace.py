"""
OTRACE AW2026 campaign imagery.

Editorial product and lifestyle photography for the storefront. Garments are
generated PLAIN — no lettering — because image models garble embroidered text;
the OTRACE wordmark is composited afterwards by brand_composite.py at a known
position. See reference_ai_media_pipeline memory.

Palette from the brand sheet: Onyx Black #0D0C0B, Warm Cream #F0EBE0.
"""
import time
from pathlib import Path
from google import genai
from google.genai import types

OUT = Path(__file__).resolve().parent / "generated"
OUT.mkdir(exist_ok=True)
PROJECT = "project-ca7a75f1-8fff-4168-8b6"
MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]

NEG = ("No text, no words, no lettering, no logo, no brand name, no watermark, "
       "no graphics or prints on the garment — the chest must be completely plain.")

STUDIO = ("Editorial fashion photography for a high-end streetwear label. Shot on "
          "medium format, soft large-source directional light, gentle falloff, "
          "subtle film grain, muted warm neutral colour grade, expensive and "
          "restrained. Not oversaturated, not HDR.")

BLACK = "deep onyx black (#0D0C0B), garment-dyed heavyweight 450gsm cotton fleece"
CREAM = "warm cream off-white (#F0EBE0), garment-dyed heavyweight 450gsm cotton fleece"

PROMPTS = [
    # ---- hero / campaign ----
    ("hero_desktop", "16:9",
     f"A tall model standing in a vast empty concrete room with a shaft of window light, "
     f"wearing an oversized boxy hoodie and matching wide-leg sweatpants in {BLACK}. "
     f"Full body, centred, generous negative space above and to the sides for a wordmark. "
     f"Face partly in shadow. {STUDIO} {NEG}"),
    ("hero_mobile", "9:16",
     f"A tall model standing in a vast empty concrete room with a shaft of window light, "
     f"wearing an oversized boxy hoodie and matching wide-leg sweatpants in {BLACK}. "
     f"Full length vertical composition, generous empty space above the head. "
     f"{STUDIO} {NEG}"),
    ("campaign_pair", "4:5",
     f"Two models side by side against a warm grey seamless studio backdrop — one in an "
     f"oversized hoodie and sweatpants in {BLACK}, the other in the same set in {CREAM}. "
     f"Relaxed confident stance, cropped at mid-shin. {STUDIO} {NEG}"),

    # ---- hoodie, onyx black ----
    ("hoodie_black_flat_front", "1:1",
     f"Overhead flat lay of an oversized boxy hoodie in {BLACK}, sleeves folded neatly, "
     f"kangaroo pocket visible, ribbed cuffs, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("hoodie_black_flat_back", "1:1",
     f"Overhead flat lay of the BACK of an oversized boxy hoodie in {BLACK}, hood laid flat, "
     f"dropped shoulder seams visible, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("hoodie_black_worn_front", "1:1",
     f"Cropped torso shot of a model wearing an oversized boxy hoodie in {BLACK}, hands in "
     f"the kangaroo pocket, shot from chest to hip, warm grey seamless backdrop. {STUDIO} {NEG}"),
    ("hoodie_black_worn_back", "1:1",
     f"Model photographed from behind wearing an oversized boxy hoodie in {BLACK}, hood down, "
     f"dropped shoulders visible, warm grey seamless backdrop. {STUDIO} {NEG}"),

    # ---- hoodie, warm cream ----
    ("hoodie_cream_flat_front", "1:1",
     f"Overhead flat lay of an oversized boxy hoodie in {CREAM}, sleeves folded neatly, "
     f"kangaroo pocket visible, ribbed cuffs, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("hoodie_cream_flat_back", "1:1",
     f"Overhead flat lay of the BACK of an oversized boxy hoodie in {CREAM}, hood laid flat, "
     f"dropped shoulder seams visible, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("hoodie_cream_worn_front", "1:1",
     f"Cropped torso shot of a model wearing an oversized boxy hoodie in {CREAM}, hands in the "
     f"kangaroo pocket, chest to hip, warm grey seamless backdrop. {STUDIO} {NEG}"),
    ("hoodie_cream_worn_back", "1:1",
     f"Model photographed from behind wearing an oversized boxy hoodie in {CREAM}, hood down, "
     f"warm grey seamless backdrop. {STUDIO} {NEG}"),

    # ---- sweatpants ----
    ("pants_black_flat_front", "1:1",
     f"Overhead flat lay of wide-leg relaxed sweatpants in {BLACK}, drawcord with metal tips at "
     f"the waist, ribbed ankle cuffs, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("pants_black_worn", "1:1",
     f"Lower-body shot of a model wearing wide-leg relaxed sweatpants in {BLACK}, from waist to "
     f"shoes, ribbed ankle cuffs stacking slightly, warm grey seamless backdrop. {STUDIO} {NEG}"),
    ("pants_cream_flat_front", "1:1",
     f"Overhead flat lay of wide-leg relaxed sweatpants in {CREAM}, drawcord with metal tips at "
     f"the waist, ribbed ankle cuffs, on a warm grey paper backdrop. {STUDIO} {NEG}"),
    ("pants_cream_worn", "1:1",
     f"Lower-body shot of a model wearing wide-leg relaxed sweatpants in {CREAM}, waist to shoes, "
     f"ribbed ankle cuffs, warm grey seamless backdrop. {STUDIO} {NEG}"),

    # ---- craft / detail, for the story section ----
    ("detail_fabric", "4:3",
     f"Extreme macro of heavyweight garment-dyed cotton fleece in {CREAM}, showing the looped "
     f"brushed texture and a ribbed cuff edge, raking light. {STUDIO} {NEG}"),
    ("detail_drawcord", "4:3",
     f"Macro detail of a hoodie drawcord in {BLACK} with polished matte metal drawcord tips and "
     f"metal eyelets, shallow depth of field. {STUDIO} {NEG}"),
    ("detail_stitch", "4:3",
     f"Macro detail of a dropped shoulder seam and flatlock stitching on heavyweight fleece in "
     f"{BLACK}, raking light showing the thread. {STUDIO} {NEG}"),
]


def gen(client, model, prompt, ar, path):
    resp = client.models.generate_content(
        model=model, contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=ar),
        ),
    )
    for cand in (resp.candidates or []):
        for part in (getattr(cand.content, "parts", None) or []):
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                path.write_bytes(inline.data)
                return True
    return False


def main():
    client = genai.Client(vertexai=True, project=PROJECT, location="global")
    ok = skipped = failed = 0
    for name, ar, prompt in PROMPTS:
        path = OUT / f"{name}.png"
        if path.exists() and path.stat().st_size > 10_000:
            skipped += 1
            continue
        done = False
        # Free-trial has a hard per-minute cap; back off rather than give up.
        for attempt in range(5):
            for model in MODELS:
                try:
                    if gen(client, model, prompt, ar, path):
                        done = True
                        break
                except Exception as e:
                    print(f"  {name} [{model}]: {str(e)[:100]}", flush=True)
            if done:
                break
            time.sleep(10)
        if done:
            ok += 1
            print(f"  OK {name}", flush=True)
        else:
            failed += 1
            print(f"  FAILED {name}", flush=True)
        time.sleep(7)
    print(f"done: {ok} generated, {skipped} skipped, {failed} failed", flush=True)


main()

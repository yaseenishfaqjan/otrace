"""
OTRACE AW2026 lookbook — Chapter I, "Concrete".

Ten looks in one consistent world. Full-bleed looks get a WIDE (desktop) and a
TALL (phone) framing; the rest are 3:4 portraits shown in pairs on desktop and
full screen on phones. Garments stay PLAIN (image models garble lettering);
the reference images pin the garment design, fabric and grade.
"""
import time
from pathlib import Path
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
OUT = HERE / "generated" / "lookbook"
OUT.mkdir(parents=True, exist_ok=True)
PROJECT = "project-ca7a75f1-8fff-4168-8b6"
MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]
# The garment references must show the REAL sweatpant (ribbed ankle cuff). hero_desktop.png
# shows a straight open hem and the model copied it, so the product shots replace it.
REFS = [
    HERE / "generated" / "campaign_pair.png",
    HERE / "generated" / "pants_black_flat_front.png",
    HERE / "generated" / "pants_cream_worn.png",
]

WORLD = ("AW2026 campaign 'Concrete': brutalist raw board-marked concrete architecture, soft natural "
         "window light with long gentle shadows, quiet and monumental. Editorial fashion photography for "
         "a luxury streetwear label, shot on medium format, muted warm neutral colour grade, deep true "
         "blacks, subtle film grain, restrained and expensive. Not oversaturated, not HDR, no lens flare.")
SET = ("The clothing is exactly the set in the reference images: an oversized boxy heavyweight fleece hoodie "
       "with dropped shoulders, a kangaroo pocket and a double-layer hood, and relaxed wide-leg sweatpants: roomy and wide through the whole leg, finished with a ribbed "
       "elastic ankle cuff that gathers and stacks softly over the shoe, exactly as in the reference - "
       "never a slim tapered jogger and never an open straight hem. "
       "Colours: Onyx Black (#0D0C0B) and Warm Cream (#F0EBE0), garment dyed, soft matte fleece.")
REF = ("Use the reference images ONLY for the garment design, fabric and colour grade. Create a completely "
       "new scene, pose and casting - do not copy the reference composition.")
NEG = ("No text, no words, no lettering, no logos, no brand names, no watermark, no graphics or prints on any "
       "garment - chests and legs completely plain. No other branded clothing. Minimal plain sneakers only.")
ONYX = "Onyx Black"
CREAM = "Warm Cream"

WIDE = "Wide horizontal composition, subject placed with generous negative space."
TALL = "Tall vertical full-length composition, subject centred with space above the head."
PORT = "Vertical portrait composition, subject centred."

SCENES = {
    "look01": (f"A tall androgynous model with a shaved head walking slowly toward the camera down a long brutalist "
               f"concrete corridor lit by narrow slit windows, wearing the hoodie and sweatpants both in {ONYX}."),
    "look02": (f"A woman with short cropped dark hair seated on wide concrete steps, forearms resting on her knees, "
               f"looking off-frame, wearing the hoodie and sweatpants both in {CREAM}. Full body."),
    "look03": (f"A man with a short beard standing in a shaft of window light against a concrete wall, hood up, "
               f"hands in the kangaroo pocket, wearing the hoodie and sweatpants both in {ONYX}. Three-quarter length."),
    "look04": (f"Two models standing apart in a vast empty concrete hall with square columns, full bodies small in "
               f"the frame: one wears the full set in {ONYX}, the other the full set in {CREAM}."),
    "look05": (f"Close editorial crop of a woman wearing the hoodie in {CREAM} with the double-layer hood up, half of "
               f"her face in soft shadow, the texture of the heavyweight fleece clearly visible. Chest up."),
    "look06": (f"A man with short curly hair leaning back against a raw concrete wall, one knee bent, wearing the "
               f"hoodie in {CREAM} with the sweatpants in {ONYX}. Full length."),
    "look07": (f"A woman with long dark hair tied back sitting on the edge of a low concrete block in a large empty "
               f"room, late light casting a long shadow across the floor, wearing the hoodie and sweatpants both "
               f"in {CREAM}."),
    "look08": (f"A model seen from behind walking up a concrete stairwell toward a bright opening, wearing the "
               f"hoodie and sweatpants both in {ONYX}. Full body."),
    "look09": (f"Detail crop from the waist to the lower chest of a model wearing the hoodie in {ONYX}: hands resting "
               f"in the kangaroo pocket, drawcords with metal tips hanging down, heavy fleece folds. No face."),
    "look10": (f"A model standing at the open end of a long concrete tunnel, silhouetted against soft bright "
               f"daylight, wearing the hoodie in {ONYX} with the sweatpants in {CREAM}. Full body, calm and final."),
}

JOBS = []
for key in ("look01", "look04", "look07", "look10"):
    JOBS.append((f"{key}_wide", "16:9", f"{SCENES[key]} {WIDE}"))
    JOBS.append((f"{key}_tall", "9:16", f"{SCENES[key]} {TALL}"))
for key in ("look02", "look03", "look05", "look06", "look08", "look09"):
    JOBS.append((key, "3:4", f"{SCENES[key]} {PORT}"))


def gen(client, model, prompt, ar, size, path, refs):
    cfg = types.ImageConfig(aspect_ratio=ar, image_size=size) if size else types.ImageConfig(aspect_ratio=ar)
    resp = client.models.generate_content(
        model=model,
        contents=[*refs, f"{prompt} {SET} {WORLD} {REF} {NEG}"],
        config=types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=cfg),
    )
    for cand in (resp.candidates or []):
        for part in (getattr(cand.content, "parts", None) or []):
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                path.write_bytes(inline.data)
                return True
    return False


def main():
    # A request with no timeout hung for 20+ minutes once; fail it after 3 minutes
    # and let the retry loop try again instead.
    client = genai.Client(vertexai=True, project=PROJECT, location="global",
                          http_options=types.HttpOptions(timeout=180_000))
    refs = [types.Part.from_bytes(data=p.read_bytes(), mime_type="image/png") for p in REFS]
    ok = skipped = failed = 0
    for name, ar, prompt in JOBS:
        path = OUT / f"{name}.png"
        if path.exists() and path.stat().st_size > 10_000:
            skipped += 1
            continue
        done = False
        for attempt in range(6):
            for model in MODELS:
                for size in ("2K", None):
                    try:
                        if gen(client, model, prompt, ar, size, path, refs):
                            done = True
                            print(f"  OK {name} [{model} {size or 'default'}]", flush=True)
                            break
                    except Exception as e:
                        print(f"  {name} [{model} {size}]: {str(e)[:110]}", flush=True)
                if done:
                    break
            if done:
                break
            time.sleep(12)
        ok += done
        failed += not done
        if not done:
            print(f"  FAILED {name}", flush=True)
        time.sleep(8)
    print(f"done: {ok} generated, {skipped} skipped, {failed} failed", flush=True)


if __name__ == "__main__":
    main()

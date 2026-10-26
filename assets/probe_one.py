"""Try ONE frame (look04_tall) with a hard per-call timeout and timings, to see where it hangs."""
import time
import generate_lookbook as g
from google import genai
from google.genai import types

client = genai.Client(vertexai=True, project=g.PROJECT, location="global",
                      http_options=types.HttpOptions(timeout=90_000))
refs = [types.Part.from_bytes(data=p.read_bytes(), mime_type="image/png") for p in g.REFS]
name, ar, prompt = next(j for j in g.JOBS if j[0] == "look04_tall")
for size in ("2K", None):
    t = time.time()
    try:
        ok = g.gen(client, g.MODELS[0], prompt, ar, size, g.OUT / f"{name}.png", refs)
        print(f"{size or 'default'}: {'IMAGE SAVED' if ok else 'no image returned'} in {time.time() - t:.0f}s", flush=True)
        if ok:
            break
    except Exception as e:
        print(f"{size or 'default'}: {type(e).__name__}: {str(e)[:160]} after {time.time() - t:.0f}s", flush=True)

"""
Generate ONE lookbook frame by name, e.g. `python gen_one.py look07_wide`.

The SDK's http timeout does not bound a slow image call (a 2K frame took 270s
with a 90s timeout set), and killing the Windows venv launcher can orphan the
real interpreter. So a watchdog thread inside this process hard-exits it after
DEADLINE seconds; an outer loop retries.
"""
import os
import sys
import threading
import time

import generate_lookbook as g
from google import genai
from google.genai import types

DEADLINE = 450
name = sys.argv[1]
job = next(j for j in g.JOBS if j[0] == name)
path = g.OUT / f"{name}.png"

if path.exists() and path.stat().st_size > 10_000:
    print(f"SKIP {name} (exists)", flush=True)
    sys.exit(0)


def watchdog():
    time.sleep(DEADLINE)
    print(f"HARDCAP {name} after {DEADLINE}s", flush=True)
    os._exit(124)


threading.Thread(target=watchdog, daemon=True).start()

client = genai.Client(vertexai=True, project=g.PROJECT, location="global")
refs = [types.Part.from_bytes(data=p.read_bytes(), mime_type="image/png") for p in g.REFS]
started = time.time()
for model in g.MODELS:
    for size in ("2K", None):
        try:
            if g.gen(client, model, job[2], job[1], size, path, refs):
                print(f"OK {name} [{model} {size or 'default'}] {time.time() - started:.0f}s", flush=True)
                os._exit(0)
        except Exception as e:
            print(f"ERR {name} [{model} {size}]: {str(e)[:140]}", flush=True)
print(f"NOIMAGE {name}", flush=True)
os._exit(2)

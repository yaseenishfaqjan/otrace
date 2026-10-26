# IndexNow

The IndexNow key is public ownership proof. IndexNow only accepts a submission after it can fetch the key file from the site. It is not an API secret, so it is stored in git next to the file the site serves.

| | |
|---|---|
| Constant | `INDEXNOW_KEY` in `api/indexnow.js` |
| Public file | `site/public/32dfcb834125ce46de389d323db4c3b0.txt` |
| Live URL, after deploy | `https://otrace.co/32dfcb834125ce46de389d323db4c3b0.txt` |
| File body | the key and nothing else (no trailing newline) |

`site/scripts/seo-public.mjs` reads the constant and writes that file, so the served body cannot drift from the poster.

## When it runs

- API boot calls `submitIndexNow` unless `INDEXNOW_SUBMIT=0`. A failure is logged and does not stop checkout.
- `sh deploy/after-deploy.sh` runs `node api/indexnow.js` from the repo root. The CLI retries once after 15 seconds and exits 1 if the key URL is not the key, or if IndexNow does not return 200 or 202.
- The CLI refuses to POST until `GET` of the key URL returns the key. That is the check that can fail.

Measured against the live host on 2026-10-26, before this branch was deployed: the key URL returned 404 and the CLI exited without submitting. Output is in `checks/indexnow-before-key-live.txt`. Do not treat that run as a successful ping.

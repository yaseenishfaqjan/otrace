# Theme cart cookies

Each browser has its own cart. The cookie `otrace_theme_cart` holds a random id. The API stores that visitor's lines under that id, in memory and in `THEME_CART_FILE` (default `/tmp/otrace-theme-carts.json` inside the API container). The cart JSON `token` is the same id.

`otrace-theme-cart` is not a cart. Older responses used that string for every visitor. This process never reads or writes it. If a store file still has that key, it is dropped the next time the process loads the file.

A cookie that still contains the old base64 line list is copied into a new private id for that browser only. Other visitors do not see those lines.

## Clear carts on the server

Do this once after deploy if you want the in-memory and on-disk baskets gone. It does not need a special script. Restarting without deleting the file loads the file again.

```sh
docker exec "$(docker ps -qf name=otrace-api)" rm -f /tmp/otrace-theme-carts.json
docker restart "$(docker ps -qf name=otrace-api)"
```

If `THEME_CART_FILE` is set, delete that path instead of `/tmp/otrace-theme-carts.json`.

The Onyx Black / XS hoodie from the shared-token report was not a row on disk. It lived in the httpOnly cookie of the browser that added it. After this deploy, that browser's next visit keeps the hoodie in its own cart. To drop it, clear `otrace_theme_cart` in that browser, or remove the line there. A cookieless `GET /api/theme-preview/cart.js` is an empty cart with a new id.

## Check two visitors

```sh
curl -sS -c /tmp/a.txt -b /tmp/a.txt -D - -o /tmp/a.json \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -X POST https://otrace.co/api/theme-preview/cart/add.js \
  --data '{"id":"OT-HOOD-onyx-black-xs","quantity":1,"sections":"cart-drawer"}'

curl -sS -c /tmp/b.txt -b /tmp/b.txt -D - -o /tmp/b.json \
  -H 'content-type: application/json' -H 'accept: application/json' \
  -X POST https://otrace.co/api/theme-preview/cart/add.js \
  --data '{"id":"OT-PANT-warm-cream-m","quantity":1,"sections":"cart-drawer"}'

curl -sS -b /tmp/a.txt https://otrace.co/api/theme-preview/cart.js
curl -sS -b /tmp/b.txt https://otrace.co/api/theme-preview/cart.js
curl -sS https://otrace.co/api/theme-preview/cart.js
```

Jar A should show only the hoodie, jar B only the sweatpant. The two `token` values differ, neither is `otrace-theme-cart`, and each `Set-Cookie` matches that token. The last request, with no cookie, is `item_count` 0 and a third token. Remove the two test lines from those jars when you are done (`POST /api/theme-preview/cart/change.js` with `{"line":1,"quantity":0}`).

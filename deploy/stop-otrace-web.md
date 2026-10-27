# Stopping otrace-web

The storefront is the Kalles theme, rendered by `otrace-api`. `otrace-web` is the old React image. Nginx no longer sends public traffic to it. Leave the container up until the checks below pass, then stop it.

Apply the routes first, from a checkout of this repo on the VPS:

```sh
sh deploy/apply-nginx-routes.sh --dest /opt/scalaro/nginx.conf
```

The script writes into the existing file. It refuses `sed -i` style replacement because `/opt/scalaro/nginx.conf` is a single-file bind mount: a new inode detaches it from `scalaro-nginx-1`. If `nginx -t` fails, the script puts the previous bytes back.

## Check the theme before stopping React

```sh
origin=https://otrace.co
for path in / /shop /product/oversized-hoodie /product/complete-set /privacy /terms /shipping /blog /blog/what-is-a-450-gsm-hoodie /order/success /account '/search/?view=wishlist' /robots.txt /sitemap.xml /llms.txt /merchant-feed.xml /products/hoodie-onyx-front.jpg /brand/otrace-wordmark.svg; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$origin$path")
  echo "$code  $path"
done
```

Expect `200` on each, except `/search/?view=wishlist` which is also `200`. `/cart` is `200` and `noindex`. A `302` to `/` on `/privacy` or `/blog` means the new server block is not loaded.

Prices on `/product/oversized-hoodie` stay `$80.00` from `$100.00`. `/product/complete-set` stays `$140.00` from `$200.00`.

## Stop

```sh
docker update --restart=no otrace-web
docker stop otrace-web
```

Do not delete the image the same day. Start it again with `docker start otrace-web` if you need the old files while debugging. Public URLs still will not use it until the nginx server block is reverted from the `.otrace-bak` file the apply script writes beside the live config.

```sh
# restore, still without changing the inode
cp /opt/scalaro/nginx.conf.otrace-bak /tmp/otrace-nginx-restore.conf
cat /tmp/otrace-nginx-restore.conf > /opt/scalaro/nginx.conf
docker exec scalaro-nginx-1 nginx -t && docker exec scalaro-nginx-1 nginx -s reload
docker start otrace-web
```

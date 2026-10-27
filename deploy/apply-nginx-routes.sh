#!/bin/sh
# Apply deploy/nginx-theme-routes.conf onto the live nginx file without
# replacing its inode. See deploy/apply-nginx-routes.mjs.
set -eu
cd "$(dirname "$0")/.."
exec node deploy/apply-nginx-routes.mjs "$@"

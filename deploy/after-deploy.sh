#!/bin/sh
# Last step of a production deploy, after the new static files answer on
# https://otrace.co. The API also calls this on boot; this script is the
# path that still runs when only the web container was replaced.
set -eu
cd "$(dirname "$0")/.."
node api/indexnow.js

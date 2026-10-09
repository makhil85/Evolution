#!/bin/sh
# Evolution (Mac / Linux): double-click (Mac) or run ./play.command.
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then exec node play-server.mjs; fi
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open http://localhost:8173/ 2>/dev/null || xdg-open http://localhost:8173/ 2>/dev/null) &
  exec python3 -m http.server 8173 --bind 127.0.0.1
fi
echo "Evolution needs Node.js to run. Install it (free) from https://nodejs.org and try again."
read -r _

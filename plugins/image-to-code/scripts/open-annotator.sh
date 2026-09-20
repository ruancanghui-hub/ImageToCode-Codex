#!/usr/bin/env bash
set -euo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
asset_dir="$script_dir/../assets/annotator"
port="${1:-4173}"

if [[ ! -f "$asset_dir/index.html" ]]; then
  echo "ImageToCode Annotator assets are missing: $asset_dir" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$port" --bind 127.0.0.1 --directory "$asset_dir"
fi

if command -v node >/dev/null 2>&1; then
  exec node -e '
    const fs = require("fs");
    const http = require("http");
    const path = require("path");
    const root = process.argv[1];
    const port = Number(process.argv[2]);
    const types = {".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml"};
    http.createServer((req, res) => {
      const requestPath = new URL(req.url, "http://localhost").pathname;
      const filePath = path.resolve(root, "." + (requestPath === "/" ? "/index.html" : requestPath));
      if (!filePath.startsWith(root)) return res.writeHead(403).end();
      fs.readFile(filePath, (error, body) => {
        if (error) return res.writeHead(404).end();
        res.writeHead(200, {"Content-Type": types[path.extname(filePath)] || "application/octet-stream"});
        res.end(body);
      });
    }).listen(port, "127.0.0.1");
  ' "$asset_dir" "$port"
fi

echo "ImageToCode Annotator needs Python 3 or Node.js to serve its bundled page." >&2
exit 1

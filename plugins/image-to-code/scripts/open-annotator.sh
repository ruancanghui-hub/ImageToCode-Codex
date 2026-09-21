#!/usr/bin/env bash
set -euo pipefail
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "ImageToCode Annotator needs Python 3 to serve its page and send annotated images to Codex." >&2
  exit 1
fi
exec python3 "$script_dir/annotator-server.py" --port "${1:-4173}" --workspace "${2:-$PWD}" --thread "${3:-${CODEX_THREAD_ID:-}}"

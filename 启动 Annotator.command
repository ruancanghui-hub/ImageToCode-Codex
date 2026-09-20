#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/apps/annotator"

cd "$APP"

if [[ ! -d node_modules ]]; then
  echo "→ 首次运行，安装依赖…"
  npm install
fi

# 若 5173 已被占用，仍启动 Vite（它会自动换端口）
echo "→ 启动 ImageToCode Annotator…"
echo "  目录: $APP"
echo "  浏览器打开后即可标注；Ctrl+C 结束。"
echo

# 稍等后打开默认地址（Vite 默认 5173）
(sleep 2 && open "http://localhost:5173/" >/dev/null 2>&1) &

npm run dev

# 双击 .command 时，进程结束后暂停，方便看报错
echo
read -r -p "按回车关闭窗口…"

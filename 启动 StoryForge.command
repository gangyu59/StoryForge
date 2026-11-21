#!/usr/bin/env bash
# macOS 双击启动 StoryForge；关闭终端窗口即停止
cd "$(cd "$(dirname "$0")" && pwd)" || exit 1
PY=$(command -v python3 || command -v python) || { echo "找不到 python"; read -r _; exit 1; }
"$PY" run.py "$@"

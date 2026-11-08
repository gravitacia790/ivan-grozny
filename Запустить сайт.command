#!/bin/bash
set -e
cd "$(dirname "$0")"

# Prefer an installed Node.js >=22.13 without changing the user's default.
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin; do
    if [ -x "$candidate/node" ] && "$candidate/node" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null; then
  echo "Нужен Node.js 22.13 или новее. Установите его и запустите файл повторно."
  read -r -p "Нажмите Enter, чтобы закрыть окно. "
  exit 1
fi
if [ ! -d node_modules/next ]; then
  npm ci --no-audit --no-fund
fi
echo "Сайт будет доступен по адресу http://127.0.0.1:3000"
echo "Для остановки нажмите Ctrl+C в этом окне."
python3 scripts/with-local-key.py dev

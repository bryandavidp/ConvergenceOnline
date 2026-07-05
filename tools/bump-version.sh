#!/usr/bin/env bash
# Sube de versión la app de una sola vez y sin olvidos:
#   - VERSION en game.js
#   - CACHE en sw.js
#   - los query strings ?v= de styles.css y game.js en index.html (se incrementan +1)
#
# Uso:  tools/bump-version.sh 1.7.3
set -euo pipefail

cd "$(dirname "$0")/.."

NEW="${1:-}"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Uso: tools/bump-version.sh X.Y.Z" >&2
  exit 1
fi

OLD=$(grep -oP "const VERSION = '\K[0-9.]+" game.js)

# 1) VERSION en game.js
sed -i "s/const VERSION = '$OLD'/const VERSION = '$NEW'/" game.js

# 2) CACHE en sw.js
sed -i "s/const CACHE = 'cv-cache-v[0-9.]*'/const CACHE = 'cv-cache-v$NEW'/" sw.js

# 3) Cache-busting en index.html (incrementa el número de cada ?v=vNNN)
for asset in styles.css game.js; do
  CUR=$(grep -oP "$asset\?v=v\K[0-9]+" index.html)
  sed -i "s/$asset?v=v$CUR/$asset?v=v$((CUR + 1))/" index.html
done

echo "Versión: $OLD → $NEW"
grep -n "const VERSION" game.js
grep -n "const CACHE" sw.js
grep -n "?v=v" index.html
echo
echo "Commit sugerido: git commit -am \"Bump version to $NEW; update cache version and asset links\""

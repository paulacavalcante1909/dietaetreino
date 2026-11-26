#!/usr/bin/env bash
# Monta a versão de produção em deploy/release/ (Laravel + PWA na mesma pasta public).
# Uso: bash deploy/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/release"

echo "▶ 1/4 Build do app (PWA)"
cd "$ROOT/frontend"
npm ci --silent
npm run build

echo "▶ 2/4 Copiando o back-end"
rm -rf "$OUT"
mkdir -p "$OUT"
rsync -a "$ROOT/backend/" "$OUT/" \
  --exclude vendor --exclude node_modules --exclude tests \
  --exclude .env --exclude '.env.*' --exclude 'storage/' \
  --exclude 'bootstrap/cache/*.php' --exclude 'database/database.sqlite' \
  --exclude CLAUDE.md --exclude AGENTS.md --exclude .phpunit.result.cache \
  --exclude .claude --exclude .mcp.json --exclude boost.json --exclude .ai

# Estrutura de storage vazia (no servidor ela é preservada entre deploys)
mkdir -p "$OUT"/storage/app/private "$OUT"/storage/framework/{cache/data,sessions,views} "$OUT"/storage/logs

echo "▶ 3/4 Dependências PHP de produção"
cd "$OUT"
composer install --no-dev --optimize-autoloader --no-interaction --quiet

echo "▶ 4/4 Juntando o PWA na pasta public"
cp -r "$ROOT/frontend/dist/." "$OUT/public/"
cp "$ROOT/deploy/public.htaccess" "$OUT/public/.htaccess"
cp "$ROOT/deploy/user.ini" "$OUT/public/.user.ini"
cp "$ROOT/deploy/root.htaccess" "$OUT/.htaccess"   # proteção se a raiz do subdomínio for a pasta do app

du -sh "$OUT" | awk '{print "✔ Pronto: deploy/release (" $1 ")"}'

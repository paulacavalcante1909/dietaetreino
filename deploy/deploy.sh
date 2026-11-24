#!/usr/bin/env bash
# Envia deploy/release para o servidor via SSH e roda as migrações.
# Uso: bash deploy/build.sh && bash deploy/deploy.sh [--seed]
#   --seed  importa TACO e biblioteca de exercícios (necessário no 1º deploy; seguro repetir)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/deploy/deploy.config"
[ -f "$CONFIG" ] || { echo "Crie $CONFIG a partir de deploy/deploy.config.example"; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
[ -d "$ROOT/deploy/release" ] || { echo "Rode antes: bash deploy/build.sh"; exit 1; }

# Usa só a chave deste projeto, se configurada (IdentitiesOnly evita tentar outras chaves)
SSH_OPTS="-p ${SSH_PORT:-22}"
if [ -n "${SSH_KEY:-}" ]; then
  SSH_OPTS="$SSH_OPTS -i ${SSH_KEY/#\~/$HOME} -o IdentitiesOnly=yes"
fi
SSH="ssh $SSH_OPTS ${SSH_USER}@${SSH_HOST}"
SEED=${1:-}

echo "▶ Enviando arquivos para ${SSH_HOST}:${REMOTE_DIR}"
# Preserva no servidor: .env e storage/ (fotos dos check-ins, logs)
rsync -az --delete -e "ssh $SSH_OPTS" \
  --exclude '.env' --exclude 'storage/' \
  "$ROOT/deploy/release/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

# 1º deploy: envia o .env de produção local se o servidor ainda não tiver um
if [ -f "$ROOT/deploy/.env.production" ] && ! $SSH "test -f ${REMOTE_DIR}/.env"; then
  echo "▶ Enviando .env de produção (primeira vez)"
  scp ${SSH_OPTS/-p/-P} -q "$ROOT/deploy/.env.production" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/.env"
  $SSH "chmod 600 ${REMOTE_DIR}/.env"
fi

echo "▶ Preparando o servidor"
$SSH bash -s <<REMOTE
set -euo pipefail
cd "${REMOTE_DIR}"
mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chmod -R u+rwX,go-rwx storage bootstrap/cache

if [ ! -f .env ]; then
  echo "✖ Falta o arquivo ${REMOTE_DIR}/.env no servidor (modelo: deploy/env.production.example)"; exit 1
fi
if ! grep -q '^APP_KEY=base64' .env; then
  ${PHP_BIN} artisan key:generate --force
fi

${PHP_BIN} artisan down --retry=15 || true
${PHP_BIN} artisan migrate --force
if [ "${SEED}" = "--seed" ]; then ${PHP_BIN} artisan db:seed --force; fi
${PHP_BIN} artisan config:cache
${PHP_BIN} artisan route:cache
${PHP_BIN} artisan view:cache || true
${PHP_BIN} artisan up
REMOTE

echo "✔ Deploy concluído"

#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
PORT="${PORT:-3000}"

mkdir -p \
  "$DATA_DIR/db/backups" \
  "$DATA_DIR/workspaces" \
  "$DATA_DIR/knowledge" \
  "$DATA_DIR/channels" \
  "$DATA_DIR/opencode"

# Snapshot the platform database before migrations run.
DB="$DATA_DIR/db/platform.sqlite"
if [ -f "$DB" ]; then
  BACKUP="$DATA_DIR/db/backups/platform-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
  cp "$DB" "$BACKUP"
  ls -1t "$DATA_DIR"/db/backups/platform-*.sqlite 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

# Internal service token shared with the OpenCode plugin tools.
export PLATFORM_SERVICE_TOKEN="${PLATFORM_SERVICE_TOKEN:-$(head -c 32 /dev/urandom | base64 | tr -d '\n')}"
export PLATFORM_API_URL="${PLATFORM_API_URL:-http://127.0.0.1:${PORT}}"
export OPENCODE_MODE="${OPENCODE_MODE:-auto}"

# Load the platform tool namespace into every OpenCode location.
OPENCODE_CONFIG_DIR="${HOME:-/root}/.config/opencode"
mkdir -p "$OPENCODE_CONFIG_DIR"
if [ ! -f "$OPENCODE_CONFIG_DIR/opencode.json" ]; then
  cat > "$OPENCODE_CONFIG_DIR/opencode.json" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "plugins": ["/app/packages/opencode-plugin"]
}
JSON
fi

echo "[entrypoint] data=${DATA_DIR} port=${PORT} opencode_mode=${OPENCODE_MODE}"
exec bun /app/apps/server/src/index.ts

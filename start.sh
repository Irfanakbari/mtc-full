#!/bin/bash
set -eu

if [ -n "${SERVICE_ROLE:-}" ]; then
  TARGET="$SERVICE_ROLE"
elif [ -n "${ROLE:-}" ]; then
  TARGET="$ROLE"
elif [ -n "${APP_TYPE:-}" ]; then
  TARGET="$APP_TYPE"
elif [ -n "${1:-}" ]; then
  TARGET="$1"
else
  TARGET="api"
fi

run_migrations() {
  echo "[MTC] Applying database migrations..."
  cd /app/apps/api
  node node_modules/prisma/build/index.js migrate deploy
}

case "$TARGET" in
  api|backend)
    run_migrations
    echo "[MTC] Starting API server on port ${PORT:-31000}..."
    cd /app
    exec node apps/api/dist/src/main.js
    ;;

  web|frontend)
    echo "[MTC] Starting Web frontend on port ${PORT:-31001}..."
    cd /app/web-runtime
    exec node apps/web/server.js
    ;;

  all|monolith)
    run_migrations
    cd /app
    echo "[MTC] Starting API and Web services in single-container mode..."
    trap 'kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true' TERM INT

    PORT="${API_PORT:-31000}" node apps/api/dist/src/main.js &
    API_PID=$!
    (cd /app/web-runtime && PORT="${WEB_PORT:-31001}" node apps/web/server.js) &
    WEB_PID=$!

    set +e
    wait -n "$API_PID" "$WEB_PID"
    EXIT_CODE=$?
    set -e
    echo "[MTC] A service exited with code $EXIT_CODE. Stopping remaining services..."
    kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
    wait "$API_PID" "$WEB_PID" 2>/dev/null || true
    exit "$EXIT_CODE"
    ;;

  *)
    exec "$@"
    ;;
esac

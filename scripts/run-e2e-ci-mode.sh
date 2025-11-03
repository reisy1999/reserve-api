#!/bin/bash
# scripts/run-e2e-ci-mode.sh
# CI環境と完全に同じ条件でローカルE2Eを実行

set -e

echo "=== Running E2E in CI-equivalent mode ==="
echo ""

# CI環境変数を明示的に設定
export NODE_ENV=test
export CI=true

# Jest環境変数（CI推奨設定）
export JEST_WORKERS=1  # --runInBand と同義

# タイムゾーン明示
export TZ=Asia/Tokyo

# .envを読まずにテスト環境変数を直接設定
export DB_TYPE=mysql
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USERNAME=reserve_user
export DB_PASSWORD=reserve_password_change_me
export DB_DATABASE=reserve_db
export DB_SYNCHRONIZE=true
export DB_LOGGING=false

export ADMIN_TOKEN=test-admin-token
export JWT_SECRET=test-jwt-secret
export JWT_EXPIRES_IN=900s
export REFRESH_SECRET=test-refresh-secret
export REFRESH_EXPIRES_IN=30d
export REFRESH_ROTATE=true
export SECURITY_PIN_PEPPER=$(echo -n "test-pepper" | base64)

# Node/npmバージョン確認
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Jest version: $(npm list jest --depth=0 2>/dev/null | grep jest@ || echo 'Not found')"
echo ""

# Jestキャッシュをクリア（CIは毎回クリーンな状態）
echo "Clearing Jest cache..."
npx jest --clearCache

# node_modules/.cacheも削除（完全にクリーン）
rm -rf node_modules/.cache 2>/dev/null || true

echo ""
echo "Environment variables:"
echo "  NODE_ENV=$NODE_ENV"
echo "  CI=$CI"
echo "  TZ=$TZ"
echo "  DB_HOST=$DB_HOST"
echo "  JWT_SECRET=${JWT_SECRET:0:10}..."
echo ""

# CIと同じコマンドで実行
# --runInBand: 並列実行を無効化
# --forceExit: テスト後強制終了
# --detectOpenHandles: 開いたままのハンドルを検出
# --no-cache: キャッシュを使用しない
echo "Running: jest --config ./test/jest-e2e.json --runInBand --forceExit --no-cache"
echo ""

npx jest \
  --config ./test/jest-e2e.json \
  --runInBand \
  --forceExit \
  --detectOpenHandles \
  --no-cache \
  --verbose

echo ""
echo "✅ E2E tests completed in CI mode"

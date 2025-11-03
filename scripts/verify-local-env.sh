#!/bin/bash
# scripts/verify-local-env.sh
# ローカル環境の検証とE2E実行を行う標準手順

set -e

echo "=== Step 1: Docker MySQL Health Check ==="
docker-compose ps mysql
# 期待: State=Up (healthy)
# 失敗時: docker-compose up -d mysql && docker-compose logs mysql

echo ""
echo "=== Step 2: MySQL Connection Test ==="
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SELECT VERSION(), @@time_zone, NOW();" reserve_db
# 期待: Version=8.0.x, time_zone=Asia/Tokyo, NOW()=JST時刻
# 失敗時: docker-compose down -v && docker-compose up -d mysql

echo ""
echo "=== Step 3: Environment Variables Check ==="
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET?.substring(0,10) + '...'); console.log('DB_HOST:', process.env.DB_HOST); console.log('DB_DATABASE:', process.env.DB_DATABASE);"
# 期待: JWT_SECRET=test-jwt-s..., DB_HOST=localhost, DB_DATABASE=reserve_db
# 失敗時: .envファイルの存在確認、dotenvの読み込み順を確認

echo ""
echo "=== Step 4: Database Reset ==="
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SET FOREIGN_KEY_CHECKS=0; SELECT CONCAT('TRUNCATE TABLE ', table_name, ';') FROM information_schema.tables WHERE table_schema='reserve_db' AND table_type='BASE TABLE';" reserve_db | grep TRUNCATE | docker exec -i reserve-api-mysql mysql -ureserve_user -preserve_password_change_me reserve_db 2>/dev/null || true
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SET FOREIGN_KEY_CHECKS=1; SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='reserve_db';" reserve_db
# 期待: table_count > 0 (テーブルは存在するが空)
# 失敗時: TypeORM synchronize を確認、手動でDROP DATABASE → CREATE DATABASE

echo ""
echo "=== Step 5: Verify Seed Data ==="
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SELECT id, name, active FROM departments LIMIT 5;" reserve_db 2>/dev/null || echo "No departments yet (will be seeded by test)"
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SELECT staff_id, status, pin_must_change FROM staffs LIMIT 3;" reserve_db 2>/dev/null || echo "No staffs yet (will be seeded by test)"
# 期待: No data yet (beforeEachでseed実行)
# 失敗時: 古いデータが残っている場合はStep 4に戻る

echo ""
echo "=== Step 6: Jest Cache Clear ==="
npx jest --clearCache
# 期待: Cleared /home/.../jest-cache
# 失敗時: キャッシュディレクトリを手動削除

echo ""
echo "=== Step 7: Run Single E2E Test (dry run) ==="
NODE_ENV=test npm run test:e2e -- --testNamePattern="正しいPINでJWTトークンが払い出される" --verbose
# 期待: PASS auth-and-refresh.e2e-spec.ts
# 失敗時: ログからエラー箇所を特定、test/e2e/support/debug-401.ts を使用

echo ""
echo "=== Step 8: Run Full E2E Suite ==="
NODE_ENV=test npm run test:e2e
# 期待: Test Suites: 4 passed, Tests: 10 passed
# 失敗時: 最初に失敗したテストを --testNamePattern で単独実行

echo ""
echo "✅ All verification steps passed!"

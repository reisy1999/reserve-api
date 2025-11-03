# CI vs ローカル環境差分チェックリスト

CIでは全E2Eパス、ローカルで401/404が出る場合の切り分けチェックリスト。

## 1. DB接続設定

### 🔍 確認項目

| 項目 | CI | ローカル | 確認方法 |
|------|----|----|---------|
| **DB_HOST** | `127.0.0.1` | `localhost` or `127.0.0.1` | `echo $DB_HOST` |
| **接続プロトコル** | TCP/IP | Unix socket or TCP/IP | `mysql -h $DB_HOST --protocol=tcp` |
| **ポート** | 3306 | 3306 | `docker-compose ps mysql` |
| **認証情報** | reserve_user / reserve_password_change_me | 同じか確認 | `.env` と `test-helpers.ts:24-26` |
| **文字セット** | utf8mb4 | utf8mb4 | `docker exec mysql mysql -e "SHOW VARIABLES LIKE 'character_set%';"` |

### ⚠️ 問題パターン

**パターンA: localhost vs 127.0.0.1**
- **症状**: Connection refused or timeout
- **原因**: WSL2 では `localhost` が IPv6 (`::1`) に解決される場合がある
- **対策**:
  ```bash
  # test-helpers.ts:22 が 127.0.0.1 を強制
  # ローカルでも .env の DB_HOST=127.0.0.1 に統一
  ```

**パターンB: Docker network未起動**
- **症状**: ECONNREFUSED
- **対策**:
  ```bash
  docker-compose ps  # mysql が Up (healthy) か確認
  docker-compose up -d mysql
  docker-compose logs mysql | tail -20
  ```

---

## 2. 環境変数の読み込み順序

### 🔍 読み込みフロー

```
main.ts (production):
  import 'dotenv/config' → .env 読み込み

test-helpers.ts (E2E):
  ensureTestEnvDefaults() → process.env ?? デフォルト値
  ↓
  .env がある場合: .env の値が優先
  .env がない場合: test-helpers.ts のデフォルト値
```

### ⚠️ 問題パターン

**パターンC: JWT_SECRET の不一致**
- **症状**: 401 Unauthorized (token verification failed)
- **原因**:
  - `.env`: `JWT_SECRET=test-jwt-secret-change-in-production`
  - `test-helpers.ts:31`: `JWT_SECRET=test-jwt-secret`
  - トークン生成と検証で異なる秘密鍵を使用
- **検証**:
  ```bash
  node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET);"
  # ローカル: test-jwt-secret-change-in-production
  # CI: test-jwt-secret (test-helpers.tsのデフォルト)
  ```
- **対策**:
  ```bash
  # Option 1: ローカル .env を CI と揃える
  sed -i 's/JWT_SECRET=.*/JWT_SECRET=test-jwt-secret/' .env

  # Option 2: E2E実行時に .env を無視
  unset $(grep -v '^#' .env | sed -E 's/(.*)=.*/\1/' | xargs)
  npm run test:e2e
  ```

**パターンD: SECURITY_PIN_PEPPER の形式**
- **症状**: 401 on login (PIN hash mismatch)
- **原因**:
  - `.env`: `SECURITY_PIN_PEPPER=dGVzdC1wZXBwZXI=` (base64)
  - `test-helpers.ts:39`: `Buffer.from('test-pepper').toString('base64')`
  - デコード後の値が一致しない
- **検証**:
  ```bash
  echo "dGVzdC1wZXBwZXI=" | base64 -d  # → "test-pepper"
  node -e "console.log(Buffer.from('test-pepper').toString('base64'));"  # → "dGVzdC1wZXBwZXI="
  ```

---

## 3. テーブル初期化タイミング

### 🔍 確認項目

| フェーズ | CI | ローカル | 確認方法 |
|---------|----|----|---------|
| **synchronize** | true | true | `app.module.ts:42` |
| **dropSchema** | false | false | SQLite のみ true |
| **reset タイミング** | beforeEach | beforeEach | `test-helpers.ts:63-99` |
| **seed タイミング** | beforeEach | beforeEach | `test-helpers.ts:101-176` |

### ⚠️ 問題パターン

**パターンE: 古いデータが残留**
- **症状**: Duplicate entry 'seed-user-001' (間欠的)
- **原因**: 前回実行の TRUNCATE が不完全
- **対策**:
  ```bash
  # 完全リセット
  docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me \
    -e "DROP DATABASE IF EXISTS reserve_db; CREATE DATABASE reserve_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
    reserve_db
  ```

**パターンF: TypeORM synchronize のタイミング**
- **症状**: Table 'refresh_sessions' already exists
- **原因**: 並列実行時に複数プロセスが同時に CREATE TABLE
- **対策**: `--runInBand` 必須（`package.json:20` で設定済み）

---

## 4. 時刻・タイムゾーン

### 🔍 確認項目

| 項目 | CI | ローカル | 確認方法 |
|------|----|----|---------|
| **TZ env** | Asia/Tokyo | Asia/Tokyo or 未設定 | `echo $TZ` |
| **MySQL TZ** | Asia/Tokyo | Asia/Tokyo | `docker exec mysql mysql -e "SELECT @@time_zone, NOW();"` |
| **Node TZ** | Asia/Tokyo | システムに依存 | `node -e "console.log(new Date().toString());"` |

### ⚠️ 問題パターン

**パターンG: JWT exp/iat の解釈ずれ**
- **症状**: Token expired (実際は有効期間内)
- **原因**:
  - JWT の `exp` は UNIX timestamp (UTC)
  - ローカルのシステム時刻が NTP 同期されていない
- **検証**:
  ```bash
  # CI時刻とローカル時刻の差分
  date -u  # UTC
  docker exec mysql mysql -e "SELECT NOW(), UTC_TIMESTAMP();"
  ```
- **対策**:
  ```bash
  sudo ntpdate ntp.ubuntu.com  # WSL
  # または
  sudo hwclock -s  # ハードウェアクロック同期
  ```

---

## 5. 並列実行設定

### 🔍 確認項目

| 項目 | CI | ローカル | 確認方法 |
|------|----|----|---------|
| **--runInBand** | ✅ | ✅ | `package.json:20` |
| **JEST_WORKERS** | 1 | 自動 | `echo $JEST_WORKERS` |
| **maxWorkers** | 未設定 | 未設定 | `jest-e2e.json` |

### ⚠️ 問題パターン

**パターンH: Jest が並列実行している**
- **症状**: Race condition エラー (Duplicate entry, Table already exists)
- **原因**: `--runInBand` が無効化されている
- **検証**:
  ```bash
  npm run test:e2e -- --debug 2>&1 | grep -i "worker"
  # Running with 4 workers → NG
  # Running with 1 worker → OK
  ```

---

## 6. dotenv/app 初期化

### 🔍 確認項目

| ファイル | ロード方法 | 対象 |
|---------|----------|-----|
| **main.ts** | `import 'dotenv/config'` | production 起動 |
| **test-helpers.ts** | `ensureTestEnvDefaults()` | E2E テスト |
| **jest** | 明示的な dotenv なし | test-helpers に依存 |

### ⚠️ 問題パターン

**パターンI: .env が二重読み込み**
- **症状**: 環境変数の優先順位が不明瞭
- **原因**:
  - `main.ts:2` で dotenv が読み込まれる
  - jest 実行時に AppModule が import される
  - → .env の値が test-helpers より優先される
- **対策**:
  ```bash
  # E2E テスト時は .env を無効化
  mv .env .env.backup
  npm run test:e2e
  mv .env.backup .env
  ```

**パターンJ: AppModule での TypeORM 設定**
- **症状**: DB 接続エラー (Incorrect string value)
- **原因**: `app.module.ts:44` の charset/timezone 設定が不十分
- **検証**:
  ```typescript
  // app.module.ts:44-45
  charset: 'utf8mb4',
  timezone: '+09:00',
  ```

---

## 7. globalPrefix と ValidationPipe の二重設定

### 🔍 確認項目

| ファイル | 設定内容 | 呼び出し箇所 |
|---------|---------|-----------|
| **app.config.ts:5** | `setGlobalPrefix('api')` | main.ts:14 / test-helpers.ts:49 |
| **app.config.ts:6-13** | `useGlobalPipes(ValidationPipe)` | 同上 |

### ⚠️ 問題パターン

**パターンK: configureApp() の二重実行**
- **症状**: 404 Not Found (routes が見つからない)
- **原因**:
  - `main.ts:14` で `configureApp(app)`
  - テストでも `test-helpers.ts:49` で `configureApp(app)`
  - prefix が二重に適用される可能性
- **検証**:
  ```bash
  # テスト実行時のルート確認
  npm run test:e2e -- --testNamePattern="正しいPIN" --verbose 2>&1 | grep -i "GET /api"
  ```
- **対策**:
  - `configureApp()` がべき等であることを確認
  - `setGlobalPrefix()` は複数回呼んでも最後の値が有効

**パターンL: ValidationPipe の transform 設定**
- **症状**: 400 Bad Request (DTO validation failed)
- **原因**: `transformOptions: { enableImplicitConversion: true }` が有効
- **検証**: E2E で送信する DTO の型を確認

---

## 8. Jest キャッシュ

### 🔍 確認項目

| 項目 | CI | ローカル | 確認方法 |
|------|----|----|---------|
| **キャッシュ利用** | なし | あり | `ls -la /tmp/jest_*` |
| **--no-cache** | 未使用 | 使用推奨 | `npm run test:e2e -- --no-cache` |

### ⚠️ 問題パターン

**パターンM: 古いモジュールがキャッシュされている**
- **症状**: コード変更が反映されない
- **対策**:
  ```bash
  npx jest --clearCache
  rm -rf node_modules/.cache
  npm run test:e2e
  ```

---

## 9. Docker MySQL のヘルスチェック

### 🔍 確認項目

```bash
docker-compose ps mysql
# State: Up (healthy) であること

docker exec reserve-api-mysql mysqladmin ping -h localhost -ureserve_user -preserve_password_change_me
# mysqladmin: [Warning] Using a password on the command line interface can be insecure.
# mysqld is alive
```

### ⚠️ 問題パターン

**パターンN: MySQL が起動中だが準備未完了**
- **症状**: ECONNREFUSED / Connection timeout
- **原因**: `docker-compose up -d` 直後にテスト実行
- **対策**:
  ```bash
  docker-compose up -d mysql
  docker-compose exec mysql mysqladmin ping --wait=30 -h localhost -ureserve_user -preserve_password_change_me
  npm run test:e2e
  ```

---

## 10. WSL2 特有の問題

### 🔍 確認項目

| 項目 | 確認方法 | 対策 |
|------|---------|-----|
| **メモリ不足** | `free -h` | `.wslconfig` で memory=8GB 設定 |
| **ファイルシステム** | `df -h /home/reisy/project` | WSL2 内 (not /mnt/c/) |
| **DNS 解決** | `nslookup localhost` | `/etc/hosts` に 127.0.0.1 追加 |
| **ポート競合** | `netstat -tlnp \| grep 3306` | 他の MySQL が 3306 を使用していないか |

### ⚠️ 問題パターン

**パターンO: WSL2 で localhost が IPv6 になる**
- **症状**: Connection refused
- **対策**:
  ```bash
  # /etc/hosts に明示的に追加
  echo "127.0.0.1 localhost" | sudo tee -a /etc/hosts
  ```

---

## まとめ: 最も頻繁な原因 Top 3

### 🥇 1位: JWT_SECRET の不一致
- **.env に異なる値**: `JWT_SECRET=test-jwt-secret-change-in-production`
- **test-helpers.ts**: `JWT_SECRET=test-jwt-secret`
- **対策**: `.env` を削除して E2E 実行、または値を揃える

### 🥈 2位: DB_HOST の localhost vs 127.0.0.1
- **WSL2 での挙動差**: localhost が IPv6 に解決される
- **対策**: 常に `127.0.0.1` を使用

### 🥉 3位: Jest キャッシュの影響
- **コード変更が反映されない**
- **対策**: `npx jest --clearCache` を毎回実行

---

## クイック診断コマンド

```bash
# 1行で全項目チェック
bash scripts/verify-local-env.sh

# または CI モードで実行
bash scripts/run-e2e-ci-mode.sh
```

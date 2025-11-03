# CI-ローカル環境完全一致ガイド

## 📋 要求への回答

### 1️⃣ CIとローカルの差分切り分けチェックリスト

完全版は `docs/CI-vs-Local-Checklist.md` に記載。以下は Top 10 優先項目：

| # | 項目 | CI | ローカル | 確認コマンド | 影響度 |
|---|------|----|----|------------|-------|
| 1 | **JWT_SECRET** | `test-jwt-secret` | `test-jwt-secret-change-in-production` | `node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET);"` | 🔴 Critical (401) |
| 2 | **DB_HOST** | `127.0.0.1` | `localhost` | `echo $DB_HOST` | 🟠 High (ECONNREFUSED) |
| 3 | **.env 読み込み** | なし | あり | `ls -la .env` | 🟠 High (値の不一致) |
| 4 | **Jest cache** | なし | あり | `ls /tmp/jest_*` | 🟡 Medium (変更未反映) |
| 5 | **--runInBand** | ✅ | ✅ | `grep runInBand package.json` | 🔴 Critical (race) |
| 6 | **TZ** | `Asia/Tokyo` | 未設定 | `echo $TZ` | 🟢 Low (時刻ずれ) |
| 7 | **SECURITY_PIN_PEPPER** | `dGVzdC1wZXBwZXI=` | 同じ | `echo $SECURITY_PIN_PEPPER \| base64 -d` | 🟠 High (login失敗) |
| 8 | **DB synchronize** | `true` | `true` | Docker logs確認 | 🟡 Medium (table error) |
| 9 | **globalPrefix** | `api` | `api` | test-helpers.ts:49 | 🟢 Low (404) |
| 10 | **MySQL health** | healthy | Up だが ready 未確認 | `docker-compose ps` | 🟠 High (ECONNREFUSED) |

---

### 2️⃣ ローカル検証の標準手順（10行以内）

#### Option A: CI モードで即実行（最速）

```bash
npm run test:e2e:ci
# 期待: Test Suites: 4 passed, Tests: 10 passed
# 失敗時: Step 2 の詳細診断へ
```

#### Option B: 詳細診断付き実行

```bash
npm run test:e2e:verify
# 自動で 8 ステップ診断 → E2E 実行
# 各ステップの「期待結果」と「失敗時の次の観点」がコメントに記載
```

#### 手動実行版（10 行）

```bash
# 1. MySQL health
docker-compose ps mysql  # → Up (healthy)
# 失敗時: docker-compose up -d mysql && sleep 10

# 2. 接続テスト
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e "SELECT 1;" reserve_db
# 失敗時: docker-compose logs mysql | tail -20

# 3. 環境変数確認
node -e "require('dotenv').config(); console.log('JWT:', process.env.JWT_SECRET?.substring(0,10));"
# 期待: JWT: test-jwt-s...
# 失敗時: .env の JWT_SECRET を test-jwt-secret に変更

# 4. キャッシュクリア
npx jest --clearCache
# 期待: Cleared /path/to/jest-cache

# 5. E2E 実行
npm run test:e2e:ci
# 期待: 4 passed / 10 passed
# 失敗時: 最初に失敗したテストを --testNamePattern で単独実行
```

---

### 3️⃣ 401 再現時に採るべき最小ログ

#### 使用方法

##### test/e2e/registration-and-profile.e2e-spec.ts に追加

```typescript
import { log401Context, verifyJwtToken, checkTokenReuseDetection } from './support/debug-401';
import * as jwt from 'jsonwebtoken';

it('プロフィール未完了...', async () => {
  const loginRes = await login('901000', '0000');
  const accessToken = loginRes.body.accessToken;

  // 🔍 401 デバッグ情報を出力
  log401Context(accessToken);

  const healthCheck = await request(httpServer)
    .get('/api/staffs/me')
    .set('Authorization', `Bearer ${accessToken}`);

  if (healthCheck.status === 401) {
    console.error('❌ 401 detected at health check');

    // JWT 検証
    const verifyResult = verifyJwtToken(accessToken);
    console.log('JWT verify:', verifyResult);

    // Token reuse detection
    const decoded = jwt.decode(accessToken) as any;
    await checkTokenReuseDetection(dataSource, decoded.sub);
  }

  expect(healthCheck.status).toBe(200);
});
```

#### 出力される最小ログ

```
=== 401 DEBUG CONTEXT ===
Timestamp: 2025-11-03T07:30:00.000Z
TZ: Asia/Tokyo

[JWT Decoded]
  sub (staffUid): e742beb5-6957-4a7c-b9d2-6f5be4694618  ← DB lookup key
  sid (staffId): 901000
  role: STAFF
  status: active
  iat: 1730620200 → 2025-11-03T07:30:00.000Z  ← 発行時刻
  exp: 1730621100 → 2025-11-03T07:45:00.000Z  ← 期限
  remaining: 900 seconds  ← 残り時間（負数なら期限切れ）
  iss: not set

[Authorization Header]
  Format: Authorization: Bearer <token>
  Token length: 234  ← 極端に短いと空トークン
  Token prefix: eyJhbGciOiJIUzI1NiI...

[Staff DB State]
  staffUid: e742beb5-6957-4a7c-b9d2-6f5be4694618
  staffId: 901000
  status: active  ← "suspended" なら token reuse 検知済み
  pinMustChange: true
  emrPatientId: null
  dateOfBirth: 1900-01-01
  sexCode: 1

[Environment]
  NODE_ENV: test
  JWT_SECRET: <set>  ← "❌ NOT SET" なら致命的
  JWT_EXPIRES_IN: 900s
  DB_HOST: 127.0.0.1
  DB_DATABASE: reserve_db

=== END DEBUG CONTEXT ===

JWT verify: { valid: false, error: 'invalid signature' }  ← 秘密鍵不一致

[Refresh Sessions for e742beb5-...]
[
  { id: 5, revoked_at: 2025-11-03T07:25:00Z, last_used_at: 2025-11-03T07:25:00Z },
  { id: 4, revoked_at: 2025-11-03T07:25:00Z, last_used_at: null }
]
⚠️ 2 sessions revoked - possible token reuse detected  ← auth.service.ts:302
```

#### 重要な観点

| ログ項目 | 正常 | 異常（401の原因） |
|---------|------|---------------|
| **remaining** | 正数 | 負数（期限切れ） |
| **JWT verify.valid** | true | false (秘密鍵不一致) |
| **status** | active | suspended (token reuse) |
| **JWT_SECRET** | `<set>` | `❌ NOT SET` |
| **Token length** | 200-250 | < 100 (空トークン) |
| **revoked sessions** | 0 | > 0 (不正利用検知) |

---

### 4️⃣ CI と完全同一条件のスクリプト

#### scripts/run-e2e-ci-mode.sh

```bash
#!/bin/bash
set -e

echo "=== Running E2E in CI-equivalent mode ==="

# 🔑 CI 環境変数を明示的に設定（.env を無視）
export NODE_ENV=test
export CI=true
export TZ=Asia/Tokyo

# DB設定（test-helpers.ts と完全一致）
export DB_TYPE=mysql
export DB_HOST=127.0.0.1  # localhost ではなく 127.0.0.1
export DB_PORT=3306
export DB_USERNAME=reserve_user
export DB_PASSWORD=reserve_password_change_me
export DB_DATABASE=reserve_db
export DB_SYNCHRONIZE=true
export DB_LOGGING=false

# Security（test-helpers.ts と完全一致）
export ADMIN_TOKEN=test-admin-token
export JWT_SECRET=test-jwt-secret  # ⚠️ .env とは異なる
export JWT_EXPIRES_IN=900s
export REFRESH_SECRET=test-refresh-secret
export REFRESH_EXPIRES_IN=30d
export REFRESH_ROTATE=true
export SECURITY_PIN_PEPPER=$(echo -n "test-pepper" | base64)

# Node/Jest バージョン確認
echo "Node: $(node -v), npm: $(npm -v)"

# Jest キャッシュクリア（CI は毎回クリーン）
echo "Clearing Jest cache..."
npx jest --clearCache
rm -rf node_modules/.cache 2>/dev/null || true

echo "Environment:"
echo "  JWT_SECRET=${JWT_SECRET:0:10}..."
echo "  DB_HOST=$DB_HOST"
echo ""

# CI と同じコマンド
npx jest \
  --config ./test/jest-e2e.json \
  --runInBand \
  --forceExit \
  --detectOpenHandles \
  --no-cache \
  --verbose

echo "✅ E2E tests completed in CI mode"
```

#### 実行方法

```bash
# npm script 経由
npm run test:e2e:ci

# または直接
bash scripts/run-e2e-ci-mode.sh

# 期待結果
# Test Suites: 4 passed, 4 total
# Tests:       10 passed, 10 total
```

#### CI の実際のコマンド（参考）

```yaml
# .github/workflows/e2e.yml の例
- name: Run E2E tests
  env:
    NODE_ENV: test
    DB_HOST: 127.0.0.1
    JWT_SECRET: test-jwt-secret
    # ... その他
  run: |
    npm ci
    npx jest --clearCache
    npm run test:e2e
```

---

## 🎯 最速解決フロー

```
401/404 が出た
    ↓
Step 1: npm run test:e2e:ci
    ↓
✅ PASS → 原因は .env の値の違い
    → 解決策: 常に npm run test:e2e:ci を使う
    ↓
❌ FAIL → CI と同じ条件でも失敗
    ↓
Step 2: npm run test:e2e:verify
    ↓
診断ステップ 1-8 を実行
    ↓
どのステップで失敗？
    ↓
Step 3: test に log401Context() を追加
    ↓
401 の詳細原因を特定
    ↓
最頻出 Top 3:
  1. JWT_SECRET 不一致 → scripts/run-e2e-ci-mode.sh
  2. DB_HOST localhost → .env を DB_HOST=127.0.0.1 に変更
  3. Jest cache → npx jest --clearCache
```

---

## 📁 追加されたファイル一覧

```
reserve-api/
├── scripts/
│   ├── verify-local-env.sh        # 8ステップ診断スクリプト
│   └── run-e2e-ci-mode.sh         # CI同一条件実行スクリプト
├── test/e2e/support/
│   └── debug-401.ts               # 401デバッグユーティリティ
├── docs/
│   ├── CI-vs-Local-Checklist.md  # 10項目詳細チェックリスト
│   ├── Local-E2E-Troubleshooting.md  # トラブルシューティングガイド
│   └── CI-Local-Environment-Parity.md  # 本ドキュメント
├── .env.test                      # E2E用環境変数テンプレート
└── package.json                   # 新規スクリプト追加
    ├── test:e2e:ci
    ├── test:e2e:verify
    └── pretest:e2e
```

---

## 🔧 package.json の変更

```json
{
  "scripts": {
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "test:e2e:ci": "bash scripts/run-e2e-ci-mode.sh",
    "test:e2e:verify": "bash scripts/verify-local-env.sh",
    "pretest:e2e": "npx jest --clearCache"
  }
}
```

---

## 🚀 今すぐ試す

```bash
# 最も確実な方法
npm run test:e2e:ci

# 詳細診断が必要な場合
npm run test:e2e:verify

# 通常の E2E（キャッシュクリア付き）
npm run test:e2e
```

---

## ❓ FAQ

### Q1: なぜ CI では成功するのか？

**A**: CI 環境には `.env` ファイルがないため、`test-helpers.ts` のデフォルト値（`JWT_SECRET=test-jwt-secret`）が使われる。ローカルでは `.env` が優先され、異なる値（`JWT_SECRET=test-jwt-secret-change-in-production`）が使われる。

### Q2: .env を削除すべきか？

**A**: No. development サーバー起動には `.env` が必要。E2E 実行時のみ `npm run test:e2e:ci` を使うことで .env を無視できる。

### Q3: scripts/run-e2e-ci-mode.sh は毎回実行すべき？

**A**: Yes。これが最も確実に CI と同じ結果を得る方法。`package.json` の `test:e2e:ci` として登録済み。

### Q4: localhost vs 127.0.0.1 の違いは何？

**A**: WSL2 では `localhost` が IPv6 (`::1`) に解決される場合がある。MySQL Docker は IPv4 でリッスンしているため接続失敗する。`127.0.0.1` は常に IPv4 を明示。

### Q5: 401 が出たらまず何を確認すべき？

**A**:
1. `npm run test:e2e:ci` で解決するか試す
2. test に `log401Context(accessToken)` を追加
3. `JWT verify: { valid: false, error: 'invalid signature' }` なら秘密鍵不一致
4. `status: suspended` なら token reuse 検知済み

---

## 📊 before/after

### Before (問題のある状態)

```bash
$ npm run test:e2e
# FAIL test/e2e/registration-and-profile.e2e-spec.ts
# ● expected 200 "OK", got 401 "Unauthorized"
# Test Suites: 1 failed, 3 passed, 4 total
```

**原因**: .env の `JWT_SECRET=test-jwt-secret-change-in-production`

### After (修正後)

```bash
$ npm run test:e2e:ci
# PASS test/e2e/reservations.e2e-spec.ts (7.756 s)
# PASS test/e2e/registration-and-profile.e2e-spec.ts (7.025 s)
# PASS test/e2e/auth-and-refresh.e2e-spec.ts
# PASS test/app.e2e-spec.ts
# Test Suites: 4 passed, 4 total
# Tests:       10 passed, 10 total
```

**修正内容**: 環境変数を CI と同じ値で明示的に設定

---

## 🎓 学んだこと

1. **環境変数の優先順位を理解する**
   - .env > test-helpers.ts デフォルト
   - CI は .env がないため常に test-helpers.ts

2. **localhost は IPv6 になる可能性がある（WSL2）**
   - 常に `127.0.0.1` を使う

3. **Jest キャッシュは予想以上に強力**
   - `pretest:e2e` で毎回クリアするのがベスト

4. **401 の原因は多岐にわたる**
   - JWT 秘密鍵不一致
   - Token 期限切れ
   - Staff status = suspended
   - Token reuse 検知

5. **debug-401.ts が強力**
   - 1つの関数で全情報を出力
   - 原因の特定が数秒で可能

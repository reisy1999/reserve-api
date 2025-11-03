# ローカル E2E トラブルシューティングガイド

## 前提

- **CI**: 全 E2E テストが PASS ✅
- **ローカル (WSL Ubuntu)**: 一部 401/404 が発生 ❌
- **目標**: ローカル環境でも CI と同じ結果を得る

---

## クイックスタート: 最小手順

### 1. CI 同一条件での実行（推奨）

```bash
# CI と完全に同じ環境で実行
bash scripts/run-e2e-ci-mode.sh
```

このスクリプトは：
- `.env` を無視して環境変数を直接設定
- Jest キャッシュをクリア
- `--runInBand --no-cache` で実行

### 2. 詳細検証が必要な場合

```bash
# 8ステップの診断を実行
bash scripts/verify-local-env.sh
```

---

## 最も頻繁な原因と対策

### 🥇 原因1: JWT_SECRET の不一致

#### 問題
- `.env`: `JWT_SECRET=test-jwt-secret-change-in-production`
- `test-helpers.ts`: `JWT_SECRET=test-jwt-secret`（デフォルト値）
- → トークン生成と検証で異なる鍵を使用 → 401

#### 確認方法
```bash
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET);"
# ローカル: test-jwt-secret-change-in-production ❌
# CI: test-jwt-secret ✅
```

#### 対策A: .env を CI と揃える
```bash
# .env のバックアップ
cp .env .env.backup

# テスト用 .env に切り替え
cp .env.test .env

# E2E 実行
npm run test:e2e

# 元に戻す
mv .env.backup .env
```

#### 対策B: .env を無視して実行
```bash
bash scripts/run-e2e-ci-mode.sh
```

---

### 🥈 原因2: DB_HOST の localhost vs 127.0.0.1

#### 問題
- WSL2 では `localhost` が IPv6 (`::1`) に解決される場合がある
- MySQL Docker は IPv4 でリッスン
- → Connection refused

#### 確認方法
```bash
# どのアドレスに解決されるか確認
ping -c 1 localhost
# → ::1 (IPv6) なら NG

# MySQL の待ち受けアドレス確認
docker exec reserve-api-mysql ss -tlnp | grep 3306
# → 0.0.0.0:3306 or :::3306
```

#### 対策
```bash
# .env を編集
sed -i 's/DB_HOST=localhost/DB_HOST=127.0.0.1/' .env

# または /etc/hosts に明示的に追加
echo "127.0.0.1 localhost" | sudo tee -a /etc/hosts
```

---

### 🥉 原因3: Jest キャッシュの影響

#### 問題
- コード変更が反映されない
- 古い環境変数がキャッシュされている

#### 対策
```bash
# Jest キャッシュをクリア
npx jest --clearCache

# node_modules キャッシュもクリア
rm -rf node_modules/.cache

# E2E 実行
npm run test:e2e
```

---

## 401 エラー発生時の詳細診断

### ステップ1: デバッグユーティリティを追加

#### test/e2e/registration-and-profile.e2e-spec.ts に追加

```typescript
import { log401Context, verifyJwtToken, checkTokenReuseDetection } from './support/debug-401';

it('プロフィール未完了の職員は予約APIで428を受けるが完了後は成功する', async () => {
  // ... existing code ...

  const accessToken = loginRes.body.accessToken as string;

  // 🔍 ここでデバッグ情報を出力
  log401Context(accessToken);

  const healthCheck = await request(httpServer)
    .get('/api/staffs/me')
    .set('Authorization', `Bearer ${accessToken}`);

  if (healthCheck.status === 401) {
    console.error('❌ Health check failed with 401');

    // JWT 検証
    const verifyResult = verifyJwtToken(accessToken);
    console.log('JWT Verification:', verifyResult);

    // Token reuse 確認
    const decoded = jwt.decode(accessToken) as any;
    if (decoded?.sub) {
      await checkTokenReuseDetection(dataSource, decoded.sub);
    }
  }

  expect(healthCheck.status).toBe(200);
});
```

### ステップ2: 最小ログの確認

401 発生時に以下を確認：

#### A. JWT トークンの詳細
```
=== 401 DEBUG CONTEXT ===
[JWT Decoded]
  sub (staffUid): e742beb5-6957-4a7c-b9d2-6f5be4694618
  sid (staffId): 901000
  role: STAFF
  status: active
  iat: 1699001234 → 2023-11-03T07:20:34.000Z
  exp: 1699002134 → 2023-11-03T07:35:34.000Z
  remaining: 850 seconds
```

**確認ポイント**:
- `remaining` が負数 → トークン期限切れ
- `sub` が存在しない → トークン生成失敗
- `iat > exp` → 時刻設定異常

#### B. Authorization ヘッダ
```
[Authorization Header]
  Format: Authorization: Bearer <token>
  Token length: 234
  Token prefix: eyJhbGciOiJIUzI1NiI...
```

**確認ポイント**:
- Token length が極端に短い → 空トークン
- Bearer が小文字 → ヘッダ形式エラー

#### C. DB 上の staff.status
```
[Staff DB State]
  staffUid: e742beb5-6957-4a7c-b9d2-6f5be4694618
  staffId: 901000
  status: active  ⚠️ "suspended" なら token reuse 検知済み
  pinMustChange: false
  emrPatientId: 777001
```

**確認ポイント**:
- `status: suspended` → 不正なリフレッシュトークン再利用を検知

#### D. Token reuse 検知ログ
```
[Refresh Sessions for e742beb5-...]
[
  { id: 5, revoked_at: 2023-11-03T07:25:00.000Z, last_used_at: 2023-11-03T07:25:00.000Z },
  { id: 4, revoked_at: 2023-11-03T07:25:00.000Z, last_used_at: null },
  ...
]
⚠️ 2 sessions revoked - possible token reuse detected
```

**確認ポイント**:
- 複数セッションが同時に revoked → `auth.service.ts:302` の handleRefreshReuse() が実行された

#### E. 環境変数
```
[Environment]
  NODE_ENV: test
  JWT_SECRET: <set>  ⚠️ "❌ NOT SET" なら致命的
  JWT_EXPIRES_IN: 900s
  DB_HOST: 127.0.0.1
  DB_DATABASE: reserve_db
```

**確認ポイント**:
- `JWT_SECRET: ❌ NOT SET` → 環境変数が読み込まれていない

### ステップ3: SQL クエリで直接確認

```bash
# Staff の状態
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e \
  "SELECT staff_uid, staff_id, status, pin_must_change FROM staffs WHERE staff_id='901000';" \
  reserve_db

# Refresh sessions
docker exec reserve-api-mysql mysql -ureserve_user -preserve_password_change_me -e \
  "SELECT id, staff_uid, revoked_at, last_used_at FROM refresh_sessions WHERE staff_uid='e742beb5-...' ORDER BY id DESC LIMIT 5;" \
  reserve_db
```

---

## 完全同一条件での実行（CI 再現）

### scripts/run-e2e-ci-mode.sh の内容

```bash
#!/bin/bash
set -e

# CI 環境変数を明示的に設定（.env を無視）
export NODE_ENV=test
export CI=true
export TZ=Asia/Tokyo

export DB_HOST=127.0.0.1
export JWT_SECRET=test-jwt-secret  # ⚠️ .env とは異なる
export SECURITY_PIN_PEPPER=$(echo -n "test-pepper" | base64)

# ... その他の環境変数 ...

# Jest キャッシュクリア
npx jest --clearCache
rm -rf node_modules/.cache

# CI と同じコマンド
npx jest \
  --config ./test/jest-e2e.json \
  --runInBand \
  --forceExit \
  --detectOpenHandles \
  --no-cache \
  --verbose
```

### 実行方法

```bash
# スクリプト実行
bash scripts/run-e2e-ci-mode.sh

# 期待結果
# Test Suites: 4 passed, 4 total
# Tests:       10 passed, 10 total
```

---

## package.json にスクリプト追加

```json
{
  "scripts": {
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "test:e2e:ci": "bash scripts/run-e2e-ci-mode.sh",
    "test:e2e:verify": "bash scripts/verify-local-env.sh"
  }
}
```

使用例：
```bash
npm run test:e2e:ci      # CI モードで実行
npm run test:e2e:verify  # 診断後に実行
```

---

## チェックリスト詳細

完全なチェックリストは `docs/CI-vs-Local-Checklist.md` を参照。

主要な確認項目：
1. ✅ DB 接続設定（localhost vs 127.0.0.1）
2. ✅ 環境変数の読み込み順序（.env vs test-helpers.ts）
3. ✅ JWT_SECRET の一致
4. ✅ SECURITY_PIN_PEPPER の形式
5. ✅ タイムゾーン設定
6. ✅ Jest キャッシュ
7. ✅ --runInBand の有効化
8. ✅ Docker MySQL のヘルスチェック

---

## 再発防止策

### 1. .env の管理

```bash
# .gitignore に追加済み
.env
.env.backup

# テンプレートのみコミット
.env.example  # production 用
.env.test     # E2E 用（CI と同じ値）
```

### 2. pre-test フック

`package.json` に追加：
```json
{
  "scripts": {
    "pretest:e2e": "npx jest --clearCache"
  }
}
```

### 3. CI ワークフロー例

```yaml
# .github/workflows/e2e.yml (存在する場合)
- name: Run E2E tests
  env:
    NODE_ENV: test
    DB_HOST: 127.0.0.1
    JWT_SECRET: test-jwt-secret
    # ... その他
  run: npm run test:e2e
```

---

## まとめ

### 最速の解決方法

```bash
# 1. CI モードで実行
bash scripts/run-e2e-ci-mode.sh

# 2. それでも失敗する場合
bash scripts/verify-local-env.sh

# 3. 401 が出たら debug-401.ts を使用
# test にデバッグコードを追加して再実行
```

### よくある質問

**Q: なぜ CI では成功するのか？**
A: CI は .env がないため、test-helpers.ts のデフォルト値が使われる。

**Q: ローカルで .env を削除すべきか？**
A: development サーバーは .env が必要。E2E 実行時のみ無効化するのがベスト。

**Q: scripts/run-e2e-ci-mode.sh は毎回実行すべき？**
A: はい。これが最も確実に CI と同じ結果を得る方法。

---

## サポート

問題が解決しない場合：
1. `bash scripts/verify-local-env.sh` の出力を保存
2. 401 発生時の `log401Context()` 出力を保存
3. `docker-compose logs mysql | tail -50` を保存
4. これらを添えて issue を作成

# 環境変数セットアップガイド

## 概要

このプロジェクトでは、環境変数を使用してアプリケーションの設定を管理します。

## セットアップ手順

### 1. .env ファイルの作成

```bash
# プロジェクトルートで実行
cp .env.example .env
```

### 2. 環境変数の設定

`.env` ファイルを開き、以下の値を実際の値に置き換えてください。

#### 必須項目

| 変数名 | 説明 | 生成方法 |
|-------|------|---------|
| `ADMIN_TOKEN` | 管理者API用トークン | 任意の強力な文字列 |
| `JWT_SECRET` | JWTアクセストークンの署名鍵 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REFRESH_SECRET` | リフレッシュトークンの署名鍵 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SECURITY_PIN_PEPPER` | PINハッシュ用ペッパー | `node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"` |
| `DB_PASSWORD` | MySQLデータベースパスワード | 任意の強力なパスワード |
| `MYSQL_ROOT_PASSWORD` | MySQL rootパスワード | 任意の強力なパスワード |

#### オプション項目

| 変数名 | デフォルト値 | 説明 |
|-------|------------|------|
| `NODE_ENV` | `development` | 実行環境 (`development`, `production`, `test`) |
| `APP_PORT` | `3000` | アプリケーションのポート番号 |
| `JWT_EXPIRES_IN` | `900s` | アクセストークンの有効期限（15分） |
| `REFRESH_EXPIRES_IN` | `30d` | リフレッシュトークンの有効期限（30日） |
| `DB_SYNCHRONIZE` | `true` | TypeORM自動同期（**production では false**） |

### 3. 設定例

#### 開発環境（.env）

```bash
NODE_ENV=development
ADMIN_TOKEN=dev-admin-token-123456
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
REFRESH_SECRET=q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f6
SECURITY_PIN_PEPPER=dGVzdC1wZXBwZXItZm9yLWRldmVsb3BtZW50
DB_PASSWORD=dev_password_change_me
```

#### 本番環境

```bash
NODE_ENV=production
ADMIN_TOKEN=<強力なランダム文字列>
JWT_SECRET=<crypto.randomBytes(32).toString('hex') の出力>
REFRESH_SECRET=<crypto.randomBytes(32).toString('hex') の出力>
SECURITY_PIN_PEPPER=<Buffer.from(crypto.randomBytes(32)).toString('base64') の出力>
DB_SYNCHRONIZE=false  # 重要: 本番では必ず false
DB_PASSWORD=<強力なランダムパスワード>
```

---

## E2Eテスト用環境変数

E2E テスト実行時は、`.env` の値とは異なる専用の値を使用します。

### Option 1: CI モードで実行（推奨）

```bash
npm run test:e2e:ci
```

このコマンドは `.env` を無視し、`test-helpers.ts` のデフォルト値を使用します。

### Option 2: .env.test を使用

```bash
# .env をバックアップ
cp .env .env.backup

# テスト用環境変数に切り替え
cp .env.test .env

# E2E テスト実行
npm run test:e2e

# 元に戻す
mv .env.backup .env
```

### E2E テスト用の環境変数（.env.test）

| 変数名 | 値 | 理由 |
|-------|---|------|
| `JWT_SECRET` | `test-jwt-secret` | `test-helpers.ts:31` と一致 |
| `REFRESH_SECRET` | `test-refresh-secret` | `test-helpers.ts:33` と一致 |
| `DB_HOST` | `127.0.0.1` | WSL2 で localhost が IPv6 になるのを防ぐ |
| `SECURITY_PIN_PEPPER` | `dGVzdC1wZXBwZXI=` | `Buffer.from('test-pepper').toString('base64')` |

---

## セキュリティのベストプラクティス

### ✅ やるべきこと

1. **強力なシークレットを生成する**
   ```bash
   # JWT_SECRET と REFRESH_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # SECURITY_PIN_PEPPER
   node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"
   ```

2. **.env をバージョン管理から除外する**
   - `.gitignore` に `.env` が含まれていることを確認
   - ✅ 既に設定済み

3. **本番環境では DB_SYNCHRONIZE=false にする**
   - マイグレーションを使用してスキーマを管理

4. **環境変数の確認**
   ```bash
   # 現在の設定を確認（値は表示されない）
   npm run test:e2e:verify
   ```

### ❌ やってはいけないこと

1. **.env ファイルをコミットしない**
   - 機密情報が含まれるため

2. **同じシークレットを開発・本番で使わない**
   - 環境ごとに異なる値を生成

3. **デフォルト値のまま本番運用しない**
   - `test-jwt-secret` などのテスト用の値は必ず変更

---

## トラブルシューティング

### E2E テストで 401 エラーが出る

**原因**: `.env` の `JWT_SECRET` と `test-helpers.ts` のデフォルト値が異なる

**解決策**:
```bash
npm run test:e2e:ci  # CI モードで実行
```

詳細は `docs/Local-E2E-Troubleshooting.md` を参照。

### Docker MySQL に接続できない

**原因**: `DB_HOST=localhost` が IPv6 に解決される（WSL2）

**解決策**:
```bash
# .env を編集
sed -i 's/DB_HOST=localhost/DB_HOST=127.0.0.1/' .env
```

### 環境変数が読み込まれない

**確認方法**:
```bash
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET?.substring(0, 10));"
```

**期待される出力**:
```
JWT_SECRET: a1b2c3d4e5...
```

---

## 環境別の設定ファイル

| ファイル | 用途 | Git 管理 | 説明 |
|---------|------|---------|------|
| `.env.example` | テンプレート | ✅ | プレースホルダーのみ |
| `.env` | 開発/本番 | ❌ | 実際の値（機密情報） |
| `.env.test` | E2E テスト | ✅ | CI と同じ値 |
| `.env.backup` | バックアップ | ❌ | 一時的なバックアップ |

---

## クイックリファレンス

```bash
# 初期セットアップ
cp .env.example .env
# .env を編集して実際の値を設定

# 開発サーバー起動
npm run start:dev

# E2E テスト（CI モード）
npm run test:e2e:ci

# E2E テスト（通常モード、.env の値を使用）
npm run test:e2e

# 環境変数の診断
npm run test:e2e:verify
```

---

## 参考資料

- [dotenv ドキュメント](https://github.com/motdotla/dotenv)
- [Node.js crypto モジュール](https://nodejs.org/api/crypto.html)
- [CI vs Local Checklist](./CI-vs-Local-Checklist.md)
- [Local E2E Troubleshooting](./Local-E2E-Troubleshooting.md)

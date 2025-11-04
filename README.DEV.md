# Reserve API - 開発環境ガイド

## 🚀 クイックスタート

### 1. 環境変数の設定

```bash
cd /home/reisy/project/reserve-api
cp .env.dev .env
```

必要に応じて`.env`を編集してください。

### 2. サービスの起動

```bash
# バックエンド + MySQL + phpMyAdminを起動
docker-compose -f docker-compose.dev.yml up -d

# ログを確認
docker-compose -f docker-compose.dev.yml logs -f
```

### 3. アクセス確認

- **API**: http://localhost:3001/api
- **API仕様書**: http://localhost:3001/api-docs
- **phpMyAdmin**: http://localhost:8080

## 📦 起動されるサービス

| サービス | ポート | 説明 |
|---------|--------|------|
| MySQL | 3306 | データベース |
| API | 3001 | NestJS バックエンド |
| phpMyAdmin | 8080 | データベース管理ツール |

## 🔧 よく使うコマンド

```bash
# ログを確認
docker-compose -f docker-compose.dev.yml logs -f

# 特定のサービスのログ
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f mysql

# サービスを再起動
docker-compose -f docker-compose.dev.yml restart

# サービスを停止
docker-compose -f docker-compose.dev.yml down

# データベースもリセットして停止
docker-compose -f docker-compose.dev.yml down -v

# コンテナ内でシェル実行
docker-compose -f docker-compose.dev.yml exec api sh

# テストを実行
docker-compose -f docker-compose.dev.yml exec api npm run test
```

## 🗄️ データベース管理

### phpMyAdminでの管理

1. http://localhost:8080 にアクセス
2. 以下の情報でログイン：
   - **サーバー**: mysql
   - **ユーザー名**: root
   - **パスワード**: root_password_dev（.envで設定した値）

### MySQLに直接接続

```bash
# MySQLコンテナ内でシェル実行
docker-compose -f docker-compose.dev.yml exec mysql mysql -u root -p

# データベースを確認
SHOW DATABASES;
USE reserve_db;
SHOW TABLES;
```

## 🔄 ホットリロード

`src/`ディレクトリ内のファイルを編集すると、自動的に再読み込みされます。

## 🐛 トラブルシューティング

### ポートが既に使用されている

```bash
# 使用中のポートを確認
sudo lsof -i :3001
sudo lsof -i :3306
sudo lsof -i :8080

# .envファイルでポートを変更するか、使用中のプロセスを終了
```

### データベース接続エラー

```bash
# MySQLのログを確認
docker-compose -f docker-compose.dev.yml logs mysql

# MySQLの起動を待ってから再起動
docker-compose -f docker-compose.dev.yml restart api
```

### ビルドエラー

```bash
# キャッシュをクリアして再ビルド
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

## 📝 開発ワークフロー

1. **起動**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **コード編集**
   - `src/`配下のファイルを編集
   - 保存すると自動的にホットリロード

3. **動作確認**
   - Swagger UI: http://localhost:3001/api-docs
   - curl等でAPIをテスト

4. **停止**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

## 🔗 フロントエンドとの接続

フロントエンド（reserve-web）からこのAPIに接続する場合：

1. フロントエンドの`.env`で以下を設定：
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
   ```

2. バックエンドの`.env`で以下を設定（CORS）：
   ```
   CORS_ORIGINS=http://localhost:3000
   ```

これでフロントエンドからバックエンドAPIにアクセスできます。

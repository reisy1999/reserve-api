# 🚀 バックエンド クイックスタート

## 最短2ステップで起動

### 1️⃣ 環境変数を設定

```bash
cd /home/reisy/project/reserve-api
cp .env.dev .env
```

### 2️⃣ サービスを起動

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## ✅ 起動確認

```bash
# ヘルスチェック
curl http://localhost:3001/api/health

# ログを確認
docker-compose -f docker-compose.dev.yml logs -f
```

## 📍 アクセスURL

- **API**: http://localhost:3001/api
- **API仕様書**: http://localhost:3001/api-docs  
- **phpMyAdmin**: http://localhost:8080

## 🛑 停止

```bash
docker-compose -f docker-compose.dev.yml down
```

詳細は [README.DEV.md](./README.DEV.md) を参照

#!/bin/bash
set -e

echo "======================================"
echo "MySQL Schema Initialization Script"
echo "======================================"

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# .env.dev から環境変数を読み込む
if [ -f .env.dev ]; then
    export $(cat .env.dev | grep -v '^#' | xargs)
fi

# MySQL接続情報
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${MYSQL_USER:-reserve_user}
DB_PASS=${MYSQL_PASSWORD:-reserve_password}
DB_NAME=${MYSQL_DATABASE:-reserve_db}

echo -e "${YELLOW}[1/5] Waiting for MySQL to be ready...${NC}"

# MySQL起動待ち（最大60秒）
MAX_TRIES=30
COUNT=0
until docker-compose -f docker-compose.dev.yml exec -T mysql mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --silent 2>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_TRIES ]; then
        echo -e "${RED}Error: MySQL did not become ready in time${NC}"
        exit 1
    fi
    echo "  Waiting for MySQL... ($COUNT/$MAX_TRIES)"
    sleep 2
done

echo -e "${GREEN}✓ MySQL is ready${NC}"

# テーブル数を確認
echo -e "${YELLOW}[2/5] Checking existing tables...${NC}"
TABLE_COUNT=$(docker-compose -f docker-compose.dev.yml exec -T mysql mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE';" 2>/dev/null || echo "0")

echo "  Current table count: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}[3/5] No tables found. Creating schema with synchronize=true...${NC}"

    # 一時的にsynchronize=trueで起動してテーブル作成
    # docker-compose.dev.ymlのDB_SYNCHRONIZEを有効化
    sed -i 's/# - DB_SYNCHRONIZE=true/- DB_SYNCHRONIZE=true/' docker-compose.dev.yml || \
    sed -i 's/- DB_SYNCHRONIZE=false/- DB_SYNCHRONIZE=true/' docker-compose.dev.yml || \
    echo "  Synchronize already enabled or not found in config"

    # APIコンテナを再起動してテーブル作成
    echo "  Restarting API service to create tables..."
    docker-compose -f docker-compose.dev.yml restart api

    # テーブル作成を待つ（アプリ起動待ち）
    sleep 10

    # テーブルが作成されたか確認
    NEW_TABLE_COUNT=$(docker-compose -f docker-compose.dev.yml exec -T mysql mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE';" 2>/dev/null || echo "0")

    if [ "$NEW_TABLE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Tables created successfully ($NEW_TABLE_COUNT tables)${NC}"
    else
        echo -e "${RED}Warning: Tables may not have been created. Continuing anyway...${NC}"
    fi

    # migrationディレクトリ内のファイルをチェック
    MIGRATION_COUNT=$(docker-compose -f docker-compose.dev.yml exec -T api sh -c "ls -1 src/migrations/*.ts 2>/dev/null | wc -l" || echo "0")

    if [ "$MIGRATION_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}[4/5] Generating initial migration...${NC}"
        docker-compose -f docker-compose.dev.yml exec -T api npm run migration:generate src/migrations/InitialSchema || {
            echo -e "${RED}Warning: Migration generation failed, but tables exist${NC}"
        }
    else
        echo -e "${GREEN}✓ Migrations already exist, skipping generation${NC}"
    fi

    # synchronize=trueを無効化
    echo "  Disabling synchronize..."
    sed -i 's/- DB_SYNCHRONIZE=true/# - DB_SYNCHRONIZE=true/' docker-compose.dev.yml

    # APIを再起動
    docker-compose -f docker-compose.dev.yml restart api
    sleep 5

else
    echo -e "${GREEN}✓ Tables already exist ($TABLE_COUNT tables)${NC}"
    echo -e "${YELLOW}[3/5] Skipping table creation${NC}"
    echo -e "${YELLOW}[4/5] Skipping migration generation${NC}"
fi

# Migration実行（既に実行済みの場合はスキップされる）
echo -e "${YELLOW}[5/5] Running migrations...${NC}"
docker-compose -f docker-compose.dev.yml exec -T api npm run migration:run || {
    echo -e "${YELLOW}  No pending migrations or migration:run not needed${NC}"
}

# 最終検証
echo ""
echo -e "${GREEN}======================================"
echo "Schema Verification"
echo "======================================${NC}"

docker-compose -f docker-compose.dev.yml exec -T mysql mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES;"

FINAL_COUNT=$(docker-compose -f docker-compose.dev.yml exec -T mysql mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_type='BASE TABLE';")

echo ""
if [ "$FINAL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Success! Database initialized with $FINAL_COUNT tables${NC}"
else
    echo -e "${RED}✗ Error: No tables found in database${NC}"
    exit 1
fi

echo -e "${GREEN}======================================"
echo "Initialization Complete!"
echo "======================================${NC}"

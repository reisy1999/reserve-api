# 02. システムアーキテクチャ

本章では reserve-api の論理構成・インフラ構成・デプロイフローをまとめる。アプリケーションは NestJS をベースにしたモジュール構成を採用し、MySQL を単一の永続データストアとする。Docker を用いたコンテナデプロイ、およびオフライン環境向けに提供する tar パッケージ展開を想定している。

---

## 2.1 論理構成

```
Client (Web / Native)
        │  REST + JWT / Admin Token
        ▼
reserve-api (NestJS)
  ├── AuthModule
  ├── StaffModule
  ├── ReservationsModule
  ├── ReservationTypeModule
  ├── AdminModule
  └── SecurityModule
        │  TypeORM Repository
        ▼
MySQL 8.0 (reserve_db)
```

### 主要モジュール

| モジュール             | 役割                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **AuthModule**         | JWT 発行・リフレッシュ。`POST /api/auth/login` / `POST /api/auth/refresh` を提供。               |
| **StaffModule**        | 職員プロフィール管理・PIN 変更。`/api/staffs/*` 配下を担当。                                     |
| **ReservationsModule** | 予約作成と枠制約。`/api/reservations` を提供し、楽観ロックとユニーク制約で重複を防止。           |
| **ReservationTypeModule** | 予約種別の CRUD。公開 GET `/api/reservation-types` はヘルスチェックにも利用。               |
| **AdminModule**        | CSV インポートや枠一括登録など、`/api/admin/*` 管理者系エンドポイントを提供。                  |
| **SecurityModule**     | PIN ハッシュ (argon2) や共通セキュリティユーティリティ。                                        |

---

## 2.2 インフラ構成

| レイヤー        | 使用技術 / バージョン                                | 備考                                         |
| --------------- | ---------------------------------------------------- | -------------------------------------------- |
| コンテナ実行環境 | Docker / docker-compose                              | 本番・検証ともに MySQL をコンテナで提供。    |
| ランタイム      | Node.js `20.19.3`, npm `10.8.2`                       | Dockerfile と CI で固定。                    |
| フレームワーク  | NestJS `11.x`, TypeORM `0.3.x`                        | モジュール指向アーキテクチャ。               |
| データベース    | MySQL `8.0`                                           | `utf8mb4`, `timezone='+09:00'` に統一。      |
| キャッシュ      | なし                                                   | 必要に応じて将来導入。                       |
| CI / テスト     | Jest + Supertest                                     | `npm run test:e2e:ci` が CI モード。         |

---

## 2.3 デプロイメントシナリオ

### 2.3.1 Docker イメージ

1. `Dockerfile` (multi-stage) でビルド → `dist/` を生成。
2. Production ステージで `npm ci --only=production` を実行し、イメージを固定。
3. 起動時に `.env` を読み込み `node dist/main.js` を実行。

### 2.3.2 オフライン配布 (tar)

1. `npm ci --only=production` + `npm run build` をローカルで実行。
2. `dist/`, `node_modules/`, `.env` テンプレートを含む tar を作成。
3. 展開先では環境変数を `.env` に設定し `node dist/main.js` を起動。

---

## 2.4 環境変数管理

| ファイル        | 用途                                           |
| --------------- | ---------------------------------------------- |
| `.env.example`  | 本番・開発用のテンプレート。                   |
| `.env.test`     | E2E / CI 専用セット。DB 接続先が 127.0.0.1。   |
| `.env`          | 実行時に配置する実値 (Git 管理外)。            |

キーフィールド (一部):

```
ADMIN_TOKEN               # 管理者 API 用共有トークン
JWT_SECRET / REFRESH_SECRET
SECURITY_PIN_PEPPER       # Base64 で保護された PIN ペッパー
DB_TYPE=mysql, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
TZ=Asia/Tokyo
```

---

## 2.5 データベースとマイグレーション

* TypeORM エンティティを `dist` ビルドに含め、MySQL を前提とした `synchronize=false` 運用を想定。
* 初期ロードと E2E テストではシード処理 (`seedBaselineData`) が冪等になるよう設計。
* 予約関連はユニーク制約 (`UQ_reservations_staff_type_period`, `UQ_reservations_slot_staff`) による整合性を確保。

---

## 2.6 ログと監視

* NestJS 標準ロガーを利用し、`NODE_ENV=production` 時は info 以上を出力。
* ヘルスチェック: `GET /api/reservation-types` を利用。
* 今後の課題: 構造化ログ (JSON) と APM 連携 (Datadog 等)。

---

## 2.7 セキュリティ要点

| 項目              | 内容                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| 認証              | JWT (アクセス・リフレッシュ)、管理者トークン (X-Admin-Token)。                         |
| 認可              | ガード (JwtAuthGuard / AdminTokenGuard) による。                                       |
| PIN 管理          | argon2id + pepper。PIN ローテーション時はリトライ数リセット。                          |
| CSRF              | REST API かつ認証は Bearer のため対象外。                                             |
| Rate Limiting     | 未実装。将来的には API Gateway か NestJS Guard で実装検討。                          |

---

## 2.8 デプロイ & 運用チェックリスト

1. `npm run lint`, `npm run build`, `npm run test:e2e:ci` が成功。
2. `.env` と `.env.test` のキー整合性を確認 (JWT/REFRESH/PEPPER/TZ/DB_*)。
3. Docker イメージ (`node:20.19.3-alpine`) をビルドし、本番へプッシュ。
4. マイグレーション/シードが冪等であることを確認。
5. 監視用ヘルスチェックを `/api/reservation-types` に設定。

---

**最終更新**: 2025-11-03  
**バージョン**: 1.0.0

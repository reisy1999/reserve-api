# 予約API 学習特化型 実装計画書（改訂版）

**目的**: TypeScript/NestJSを**実践で学びながら**、職員向け予約APIを11/5までに可視化可能な形で完成させる
**方針**: 小さく作る → 正常系をまず通す → 入口を堅くする → 最低限の運用安全ラインを足す

---

## 前提

* **技術**: NestJS, TypeORM, SQLite（開発は `synchronize: true`、本番はマイグレを別途）
* **学習重点**: Controller / Service / Entity / DTO / ValidationPipe
* **後回し**: 本格RBAC/JWT、E2E自動テスト、Docker、本番向け運用チューニング

---

## スプリント計画（11/5〆に間に合わせる）

* **Day 0（今日）**: Phase 1 完了（POST/GET 正常系、SQLite永続化）
* **Day 1**: Phase 2（PATCH/DELETE と例外ハンドリング）
* **Day 2**: Phase 3（DTO＋ValidationPipeで入口を堅く）
* **Day 3**: Phase 4（`periodKey`算出＋年度1回制限/サービス層チェック）
* **Day 4（11/5）**: Phase 5（管理UI/管理APIの簡易ガード）＋ Phase 6（Swaggerで可視化）→ ドキュメント整備

> 時間帯重複チェックは**Phase 7（任意）**へ回す。まずは“動く＋年度1回の要件”を満たす。

---

## Phase 1: 最小CRUD（学習のコア）

### 目標

「予約を作成・取得できる」を実現。NestJS/TypeORMの骨格を掴む。

### やること

1. **環境**

   * `nest new reserve-api`
   * TypeORM + SQLite導入、`synchronize: true`（開発時のみ）
2. **Reservation エンティティ（最小）**

   * `id: number (PK)`
   * `staffId: number`
   * `reservationTypeId: number`
   * `serviceDateLocal: string (YYYY-MM-DD)`
   * `startMinuteOfDay: number (0..1439)`
   * `durationMinutes: number (>0)`
   * ※ この段階では `periodKey` は未保存（後で自動算出して追加）
3. **Service（正常系のみ）**

   * `create(dto)`, `findAll()`, `findOne(id)`
4. **Controller**

   * `POST /reservations`
   * `GET /reservations`
   * `GET /reservations/:id`

### 検証

* POSTで作成 → SQLiteに保存
* GETで取得 → 作成レコードが返る
* 再起動後も残る

### 完了条件

* [ ] POST/GET 正常系が通る
* [ ] 保存内容を自分の言葉で説明できる

---

## Phase 2: 更新・削除 + 例外

### 目標

CRUDを完成させ、例外の基本（404等）を押さえる。

### やること

* Service: `update(id, dto)`, `remove(id)`
* Controller: `PATCH /reservations/:id`, `DELETE /reservations/:id`
* 例外: 見つからない場合は `NotFoundException`

### 検証

* PATCHで値が更新される
* DELETE後にGETで404

### 完了条件

* [ ] 全CRUD動作
* [ ] 404の返り方を説明できる

---

## Phase 3: 入力検証（DTOで“入口を堅く”）

### 目標

**不正入力の遮断**。DTO最小主義＋ValidationPipeを定着させる。

### やること

1. **CreateReservationDto（最小）**

   * `serviceDateLocal`：`YYYY-MM-DD` 厳密一致＋実在日付（カスタムバリデータ）
   * `startMinuteOfDay`：整数 `0..1439`
   * `durationMinutes`：整数 `>0`
   * `staffId` / `reservationTypeId`：整数 `>0`
   * **`periodKey` は受け取らない**（サーバ算出）
2. **ValidationPipe（global）**

   * `whitelist: true`
   * `forbidNonWhitelisted: true`
   * `transform: true`（数値文字列→number）

### 検証

* フォーマット不正・範囲外は **400**
* 正常値は **201**

### 完了条件

* [ ] 不正入力が確実に 400 で落ちる
* [ ] DTOに“必要最小限しかない”理由を説明できる

---

## Phase 4: 業務ロジック（`periodKey`算出 & 年度1回）

### 目標

`serviceDateLocal` から **`periodKey`（例: `FY2025`）を算出**して保存。
同一 `(staffId, reservationTypeId, periodKey)` の2件目を **409** で弾く（まずはサービス層チェック）。

### やること

* `periodKey` 算出（4/1起点：4–12月は当年、1–3月は前年）
* `create()` 内で保存前に同一キーの既存有無を検索 → あれば `ConflictException`
* 余裕があれば **DBのUNIQUE制約**（`(staffId, reservationTypeId, periodKey)`）をマイグレーションで追加
  ※ 締切優先なら**サービス層チェックでOK**（後でDB制約を足す）

### 検証

* `2026-03-31 → FY2025` / `2026-04-01 → FY2026`
* 同一年度・同一種別の2件目は 409

### 完了条件

* [ ] `periodKey` が正しく入る
* [ ] 年度1回ルールが機能する

---

## Phase 5: 管理アクセス（MVPの安全ライン）

### 目標

ログイン機能なしで**管理者専用ページとAPI**を最低限守る。

### やること

* ルーティング分離：

  * 一般API：`/api/reservations/*`
  * **管理API**：`/api/admin/*`（**`X-Admin-Token`** を `ADMIN_TOKEN`（env）で検証）
  * **管理UI**：`/admin`（ServeStaticで配信、**API側で必ずガード**）
* 可能ならリバースプロキシ（Nginx等）で `/admin` と `/api/admin/*` に **Basic認証 + IP許可** を追加（ダブルロック）
* 監査ログ：`who / what / when` を最小で記録（stdoutで可）

### 検証

* `X-Admin-Token` が無い/不一致 → 401/403
* トークン一致で管理APIが動作

### 完了条件

* [ ] `/api/admin/*` がトークン必須
* [ ] `/admin` で管理UIが見える（UI判定に依存せず**APIは常にサーバ側で検証**）

---

## Phase 6: Swagger導入（可視化）

### 目標

**作ったAPIを見せられる状態**に。操作もSwagger UIから実行可能に。

### やること

* Swaggerを有効化して `/api-docs` 配信（タイトル「職員予約API」）
* 主要DTO/レスポンスを反映

### 検証

* `/api-docs` にアクセスできる
* UIからCRUDと管理APIを試せる

### 完了条件

* [ ] Swagger UIで主要操作が確認できる
* [ ] 第三者にデモ可能

---

## 完成判定（Definition of Done）

**技術**

* [ ] Module/Controller/Service/Entity/DTO/ValidationPipe の役割を説明できる
* [ ] SQLite+TypeORM でCRUDが安定
* [ ] `periodKey` の算出と年度1回チェックが入っている

**成果物**

* [ ] 予約API（CRUD）＋管理API（トークンガード）
* [ ] Swaggerで可視化
* [ ] docs（`data-specification.md`, `system-architecture.md` など）整備

**学習**

* [ ] “動く”から“堅くする”へ進める観点を言語化できる

---

## 後回し（Phase 7以降・余裕があれば）

* [ ] 時間帯重複チェック（同一日 `[start, end)` の重なり禁止）
* [ ] DBのUNIQUE制約を正式にマイグレーション化
* [ ] E2E自動テスト（CRUD + 業務制約）
* [ ] Staff/Department/ReservationType のマスタAPI
* [ ] Docker 化 / 本番向け設定最適化（CORS, Helmet, Rate Limit 等）

---

## 学習のコツ（再掲・締切対応版）

1. **まず正常系だけを通す**（異常系は後から）
2. **“入口は堅く”を一箇所（DTO/ValidationPipe）に集中**
3. **サービス層でドメイン制約を一旦吸収**（DB制約は後追い）
4. **管理アクセスは** UIではなく**APIで守る**（トークン＋可能ならプロキシBasic認証）
5. **毎日デモ可能な状態**を維持（Swaggerで見せる）
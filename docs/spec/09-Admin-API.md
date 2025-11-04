# 09. 管理者API

## 9.1 概要

管理者APIは、人事部・総務部の担当者が職員情報の一括登録や予約枠の設定を行う機能を提供します。

---

## 9.2 認証方式

### 管理者トークン認証

**ヘッダー形式**:
```http
X-Admin-Token: <admin_token>
Idempotency-Key: <unique_key>
```

| ヘッダー | 必須 | 説明 |
|---------|------|------|
| `X-Admin-Token` | ◯ | 環境変数 `ADMIN_TOKEN` の値 |
| `Idempotency-Key` | △ | べき等性キー（一括登録時に推奨） |

**環境変数**:
```bash
ADMIN_TOKEN=your-secret-admin-token
```

**エラー**:
- **401 Unauthorized**: トークン無効・未設定

---

## 9.3 POST /api/admin/staffs/import

### 概要
CSV形式で職員情報を一括登録します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Idempotency-Key: import-20251103-001
Content-Type: text/csv
```

**Body** (CSV形式):
```csv
名前(漢字),本部ID,部署,職種
山田太郎,900100,ER,医師
佐藤花子,900101,RAD,放射線技師
鈴木一郎,900102,VAC,看護師
```

**必須カラム**:
| カラム名 | 説明 | バリデーション |
|---------|------|---------------|
| `名前(漢字)` | 職員氏名 | 必須（空白不可） |
| `本部ID` | 職員ID | 必須・数字のみ |
| `部署` | 部署ID | 必須（空白不可） |
| `職種` | 職種 | 任意（未設定時は`未設定`） |

**クエリパラメータ**:
| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `dryRun` | string | `false` | `true`の場合、登録せずに検証のみ実行 |

**例**:
```bash
curl -X POST "http://localhost:3000/api/admin/staffs/import?dryRun=true" \
  -H "X-Admin-Token: test-admin-token" \
  -H "Idempotency-Key: import-20251103-001" \
  -H "Content-Type: text/csv" \
  --data-binary @staffs.csv
```

---

### レスポンス

#### 成功 (201 Created)

```json
{
  "summary": {
    "created": 2,
    "skippedExisting": 1,
    "skippedInvalid": 0,
    "duplicateInFile": 0,
    "warnings": []
  },
  "rows": [
    {
      "rowNumber": 2,
      "staffId": "900100",
      "status": "created"
    },
    {
      "rowNumber": 3,
      "staffId": "900101",
      "status": "skippedExisting"
    },
    {
      "rowNumber": 4,
      "staffId": "900102",
      "status": "created"
    }
  ],
  "importBatchId": "e742beb5-6957-4a7c-b9d2-6f5be4694618"
}
```

**summary**:
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `created` | number | 新規登録数 |
| `skippedExisting` | number | 既存スキップ数 |
| `skippedInvalid` | number | バリデーションエラー数 |
| `duplicateInFile` | number | ファイル内重複数 |
| `warnings` | string[] | 警告メッセージ配列 |

**rows**:
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `rowNumber` | number | CSV行番号（ヘッダー=1、データ開始=2） |
| `staffId` | string \| null | 職員ID |
| `status` | string | `created` / `skippedExisting` / `skippedInvalid` / `duplicateInFile` |
| `reason` | string[] | エラー理由（status=skippedInvalidの場合） |

**importBatchId**:
- `dryRun=false` かつ `created > 0` の場合のみ発行される一括登録ID

---

#### エラー

**401 Unauthorized** - トークン無効
```json
{
  "statusCode": 401,
  "message": "Invalid admin token"
}
```

---

### ビジネスルール

#### べき等性キー

`Idempotency-Key` ヘッダーを使用することで、同じCSVの重複実行を防止できます。

```http
Idempotency-Key: import-20251103-001
```

- 同じキーで再実行 → 既存データをスキップ（409を返さない）
- 異なるキー → 新規インポート

---

#### バリデーション

各行について以下をチェック：

1. **必須カラムの存在**
   - `名前(漢字)`, `本部ID`, `部署`, `職種`

2. **本部ID（職員ID）**
   - 数字のみ（`/^\d+$/` にマッチ）
   - 空白不可

3. **ファイル内重複チェック**
   - 同じ本部IDが複数行ある場合、すべて `duplicateInFile` ステータス

4. **既存チェック**
   - DBに既に存在する本部ID → `skippedExisting` ステータス

**バリデーション失敗例**:
```json
{
  "rowNumber": 3,
  "staffId": null,
  "status": "skippedInvalid",
  "reason": [
    "staffId is required.",
    "名前(漢字) is required."
  ]
}
```

---

#### 初期値

新規登録時、以下の初期値が設定されます：

| フィールド | 初期値 | 説明 |
|-----------|--------|------|
| `familyName` | CSV の `名前(漢字)` | 姓（CSVから分離不可のため同じ値） |
| `givenName` | CSV の `名前(漢字)` | 名（CSVから分離不可のため同じ値） |
| `emrPatientId` | `null` | 初回ログイン時に職員が設定 |
| `dateOfBirth` | `1900-01-01` | 初回ログイン時に職員が設定 |
| `sexCode` | `1` | 初回ログイン時に職員が設定 |
| `pinHash` | argon2(`0000`) | 初期PIN（初回ログイン時に変更必須） |
| `pinMustChange` | `true` | 初回ログイン時に強制変更 |
| `status` | `active` | 有効な職員 |
| `role` | `STAFF` | 一般職員 |
| `version` | `0` | 楽観ロックの初期値 |

---

### シーケンス図

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant API as /api/admin/staffs/import
    participant DB as MySQL

    Admin->>API: POST (CSV + dryRun=true)
    API->>API: CSVパース<br/>(BOM対応, 日本語ヘッダー)

    loop 各行
        API->>API: 必須カラムチェック
        API->>API: 本部IDバリデーション
        API->>API: ファイル内重複チェック
        API->>DB: SELECT * FROM staffs<br/>WHERE staff_id = ?

        alt 既存あり
            API->>API: status = 'skippedExisting'
        else バリデーションエラー
            API->>API: status = 'skippedInvalid'
        else OK
            API->>API: status = 'created' (実行しない)
        end
    end

    API-->>Admin: { summary, rows } (dryRun結果)

    Admin->>API: POST (CSV + dryRun=false)

    loop 各行 (status='created'のみ)
        API->>DB: INSERT INTO staffs (...)
        API->>DB: INSERT INTO departments (存在しない場合)
    end

    API-->>Admin: { summary, rows, importBatchId }
```

---

### 使用例

#### Dry Run（検証のみ）

```bash
curl -X POST "http://localhost:3000/api/admin/staffs/import?dryRun=true" \
  -H "X-Admin-Token: test-admin-token" \
  -H "Idempotency-Key: import-20251103-001" \
  -H "Content-Type: text/csv" \
  --data-binary @staffs.csv
```

**レスポンス** (201 Created):
```json
{
  "summary": {
    "created": 3,
    "skippedExisting": 0,
    "skippedInvalid": 0,
    "duplicateInFile": 0,
    "warnings": []
  },
  "rows": [
    { "rowNumber": 2, "staffId": "900100", "status": "created" },
    { "rowNumber": 3, "staffId": "900101", "status": "created" },
    { "rowNumber": 4, "staffId": "900102", "status": "created" }
  ]
}
```

**確認後、本番実行**:
```bash
curl -X POST "http://localhost:3000/api/admin/staffs/import?dryRun=false" \
  -H "X-Admin-Token: test-admin-token" \
  -H "Idempotency-Key: import-20251103-001" \
  -H "Content-Type: text/csv" \
  --data-binary @staffs.csv
```

---

## 9.4 POST /api/admin/reservation-types

### 概要
予約種別（予防接種・健診等の種類）を作成します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Content-Type: application/json
```

**Body**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | ◯ | 種別名（例: `Baseline Vaccination`） |
| `description` | string | - | 説明 |
| `active` | boolean | - | 有効フラグ（デフォルト: `true`） |

**例**:
```json
{
  "name": "Influenza Vaccination",
  "description": "インフルエンザ予防接種",
  "active": true
}
```

---

### レスポンス

#### 成功 (201 Created)

```json
{
  "id": 2,
  "name": "Influenza Vaccination",
  "description": "インフルエンザ予防接種",
  "active": true,
  "createdAt": "2025-11-03T10:00:00.000Z",
  "updatedAt": "2025-11-03T10:00:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 種別ID（自動採番） |
| `name` | string | 種別名 |
| `description` | string \| null | 説明 |
| `active` | boolean | 有効フラグ |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

---

#### エラー

**401 Unauthorized** - トークン無効
```json
{
  "statusCode": 401,
  "message": "Invalid admin token"
}
```

---

### 使用例

```bash
curl -X POST http://localhost:3000/api/admin/reservation-types \
  -H "X-Admin-Token: test-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Annual Health Checkup",
    "description": "年次健康診断",
    "active": true
  }'
```

---

## 9.5 POST /api/admin/slots/bulk

### 概要
予約枠を一括作成します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Content-Type: application/json
```

**Body**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `slots` | array | ◯ | 予約枠配列 |

**slots配列の各要素**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `reservationTypeId` | number | ◯ | 予約種別ID |
| `serviceDateLocal` | string | ◯ | サービス提供日（YYYY-MM-DD） |
| `startMinuteOfDay` | number | ◯ | 開始分（0〜1439） |
| `durationMinutes` | number | ◯ | 所要時間（分） |
| `capacity` | number | ◯ | 定員 |
| `status` | string | ◯ | `draft` / `published` / `closed` |
| `bookingStart` | string | - | 受付開始日時（ISO 8601） |
| `bookingEnd` | string | - | 受付終了日時（ISO 8601） |
| `notes` | string | - | 備考 |

**例**:
```json
{
  "slots": [
    {
      "reservationTypeId": 1,
      "serviceDateLocal": "2025-12-15",
      "startMinuteOfDay": 540,
      "durationMinutes": 30,
      "capacity": 10,
      "status": "published",
      "bookingStart": "2025-11-01T00:00:00+09:00",
      "bookingEnd": "2025-12-14T23:59:59+09:00",
      "notes": "午前枠"
    },
    {
      "reservationTypeId": 1,
      "serviceDateLocal": "2025-12-15",
      "startMinuteOfDay": 840,
      "durationMinutes": 30,
      "capacity": 10,
      "status": "published",
      "bookingStart": "2025-11-01T00:00:00+09:00",
      "bookingEnd": "2025-12-14T23:59:59+09:00",
      "notes": "午後枠"
    }
  ]
}
```

---

### レスポンス

#### 成功 (201 Created)

```json
{
  "slots": [
    {
      "id": 10,
      "reservationTypeId": 1,
      "serviceDateLocal": "2025-12-15",
      "startMinuteOfDay": 540,
      "durationMinutes": 30,
      "capacity": 10,
      "bookedCount": 0,
      "status": "published",
      "bookingStart": "2025-11-01T00:00:00.000Z",
      "bookingEnd": "2025-12-14T23:59:59.000Z",
      "notes": "午前枠",
      "createdAt": "2025-11-03T10:00:00.000Z",
      "updatedAt": "2025-11-03T10:00:00.000Z"
    },
    {
      "id": 11,
      "reservationTypeId": 1,
      "serviceDateLocal": "2025-12-15",
      "startMinuteOfDay": 840,
      "durationMinutes": 30,
      "capacity": 10,
      "bookedCount": 0,
      "status": "published",
      "bookingStart": "2025-11-01T00:00:00.000Z",
      "bookingEnd": "2025-12-14T23:59:59.000Z",
      "notes": "午後枠",
      "createdAt": "2025-11-03T10:00:00.000Z",
      "updatedAt": "2025-11-03T10:00:00.000Z"
    }
  ]
}
```

**各slot**:
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 枠ID（自動採番） |
| `reservationTypeId` | number | 予約種別ID |
| `serviceDateLocal` | string | サービス提供日 |
| `startMinuteOfDay` | number | 開始分 |
| `durationMinutes` | number | 所要時間 |
| `capacity` | number | 定員 |
| `bookedCount` | number | 現在の予約数（初期値: `0`） |
| `status` | string | ステータス |
| `bookingStart` | string \| null | 受付開始日時 |
| `bookingEnd` | string \| null | 受付終了日時 |
| `notes` | string \| null | 備考 |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

---

#### エラー

**401 Unauthorized** - トークン無効
```json
{
  "statusCode": 401,
  "message": "Invalid admin token"
}
```

**404 Not Found** - 予約種別が存在しない
```json
{
  "statusCode": 404,
  "message": "Reservation type not found"
}
```

---

### ビジネスルール

#### ステータスの意味

| ステータス | 説明 | 職員への表示 |
|-----------|------|------------|
| **draft** | 下書き | 非表示 |
| **published** | 公開中 | 表示・予約可能 |
| **closed** | 締切 | 表示（締切済み表示） |

**推奨フロー**:
1. `draft` で作成
2. 内容確認後、`published` に変更（別途PATCH APIが必要）
3. 受付終了後、`closed` に変更

---

#### 受付期間の設定

受付期間を設定しない場合（`bookingStart` / `bookingEnd` を `null` または未指定）:
- 枠が `published` の間は常に予約可能

受付期間を設定する場合:
- `bookingStart` 〜 `bookingEnd` の間のみ予約可能
- ISO 8601形式で指定（タイムゾーン: `+09:00`）

**例**:
```json
{
  "bookingStart": "2025-11-01T00:00:00+09:00",
  "bookingEnd": "2025-12-14T23:59:59+09:00"
}
```

→ 2025年11月1日 00:00 〜 2025年12月14日 23:59 まで受付

---

### シーケンス図

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant API as /api/admin/slots/bulk
    participant DB as MySQL

    Admin->>API: POST { slots: [...] }

    loop 各枠
        API->>DB: SELECT * FROM reservation_types<br/>WHERE id = ?

        alt 種別が存在しない
            API-->>Admin: 404 Not Found<br/>"Reservation type not found"
        end

        API->>DB: INSERT INTO reservation_slots (...)
    end

    API-->>Admin: 201 Created<br/>{ slots: [...] }
```

---

### 使用例

#### 1日分の枠を一括作成

```bash
curl -X POST http://localhost:3000/api/admin/slots/bulk \
  -H "X-Admin-Token: test-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {
        "reservationTypeId": 1,
        "serviceDateLocal": "2025-12-15",
        "startMinuteOfDay": 540,
        "durationMinutes": 30,
        "capacity": 10,
        "status": "draft",
        "bookingStart": "2025-11-01T00:00:00+09:00",
        "bookingEnd": "2025-12-14T23:59:59+09:00"
      },
      {
        "reservationTypeId": 1,
        "serviceDateLocal": "2025-12-15",
        "startMinuteOfDay": 600,
        "durationMinutes": 30,
        "capacity": 10,
        "status": "draft"
      },
      {
        "reservationTypeId": 1,
        "serviceDateLocal": "2025-12-15",
        "startMinuteOfDay": 660,
        "durationMinutes": 30,
        "capacity": 10,
        "status": "draft"
      }
    ]
  }'
```

---

## 9.6 べき等性の実装

### Idempotency-Keyの使用

管理者APIは `Idempotency-Key` ヘッダーによりべき等性を保証します。

**例**:
```http
POST /api/admin/staffs/import
X-Admin-Token: test-admin-token
Idempotency-Key: import-20251103-001
```

**動作**:
- 同じキーで再実行 → 既存データをスキップ（409を返さない）
- 異なるキー → 新規インポート

**キーの命名規則例**:
- `import-YYYYMMDD-NNN` (例: `import-20251103-001`)
- `bulk-slot-YYYYMMDD-HHmmss` (例: `bulk-slot-20251103-143000`)

---

## 9.7 CSV形式の詳細

### エンコーディング

- **文字コード**: UTF-8
- **BOM**: あり・なしの両方に対応
- **改行コード**: LF / CRLF の両方に対応

### 必須ヘッダー

```csv
名前(漢字),本部ID,部署,職種
```

**注意**: ヘッダー名は完全一致必須（全角括弧、大文字小文字も区別）

### サンプルCSV

```csv
名前(漢字),本部ID,部署,職種
山田太郎,900100,ER,医師
佐藤花子,900101,RAD,放射線技師
鈴木一郎,900102,VAC,看護師
田中美咲,900103,CARD,臨床検査技師
```

---

## 9.6 GET /api/admin/departments

### 概要
部署の一覧を取得します（ページネーション、フィルタリング、ソート機能付き）。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
```

**Query Parameters**:
| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `limit` | number | `50` | 1ページあたりの件数（最大100） |
| `page` | number | `1` | ページ番号（1から開始） |
| `name` | string | - | 部署名の部分一致検索（大文字小文字区別なし） |
| `active` | boolean | - | 有効フラグでフィルタ（`true`/`false`） |
| `sort` | string | `id` | ソート対象（`id`/`name`/`updatedAt`） |
| `order` | string | `asc` | ソート順（`asc`/`desc`） |

**例**:
```bash
curl -X GET "http://localhost:3000/api/admin/departments?limit=50&page=1&name=ER&active=true&sort=name&order=asc" \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "data": [
    {
      "id": "CARD",
      "name": "Cardiology",
      "active": true,
      "createdAt": "2025-11-03T10:00:00.000Z",
      "updatedAt": "2025-11-03T10:00:00.000Z"
    },
    {
      "id": "ER",
      "name": "Emergency",
      "active": true,
      "createdAt": "2025-11-03T09:00:00.000Z",
      "updatedAt": "2025-11-03T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 50
  }
}
```

**data配列の各要素**:
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 部署ID |
| `name` | string | 部署名 |
| `active` | boolean | 有効フラグ |
| `createdAt` | string | 作成日時（ISO 8601） |
| `updatedAt` | string | 更新日時（ISO 8601） |

**meta**:
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `total` | number | 総件数 |
| `page` | number | 現在のページ |
| `limit` | number | 1ページあたりの件数 |

---

#### エラー

**400 Bad Request** - パラメータ検証エラー
```json
{
  "statusCode": 400,
  "message": "limit must not be greater than 100"
}
```

**401 Unauthorized** - トークン無効
```json
{
  "statusCode": 401,
  "message": "Invalid admin token"
}
```

---

### ビジネスルール

#### ソート動作
- デフォルトは `id` の昇順
- 指定されたソートキーで並び替え後、安定性のため常に `id ASC` で第2ソート
- 例: `sort=name&order=desc` の場合、`ORDER BY name DESC, id ASC`

#### フィルタリング
- `name`: トリムされた文字列の部分一致（大文字小文字区別なし）
- `active`: 真偽値の完全一致

---

## 9.7 GET /api/admin/departments/:id

### 概要
特定の部署の詳細情報を取得します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
```

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 部署ID |

**例**:
```bash
curl -X GET http://localhost:3000/api/admin/departments/ER \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "id": "ER",
  "name": "Emergency",
  "active": true,
  "createdAt": "2025-11-03T09:00:00.000Z",
  "updatedAt": "2025-11-03T09:00:00.000Z"
}
```

---

#### エラー

**404 Not Found** - 部署が存在しない
```json
{
  "statusCode": 404,
  "message": "Department with id 'NONEXISTENT' not found"
}
```

---

## 9.8 GET /api/admin/reservation-types

### 概要
予約種別の一覧を取得します（ページネーション、フィルタリング、ソート機能付き）。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
```

**Query Parameters**:
| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `limit` | number | `50` | 1ページあたりの件数（最大100） |
| `page` | number | `1` | ページ番号（1から開始） |
| `name` | string | - | 種別名の部分一致検索（大文字小文字区別なし） |
| `active` | boolean | - | 有効フラグでフィルタ（`true`/`false`） |
| `sort` | string | `id` | ソート対象（`id`/`name`/`updatedAt`） |
| `order` | string | `asc` | ソート順（`asc`/`desc`） |

**例**:
```bash
curl -X GET "http://localhost:3000/api/admin/reservation-types?active=true&sort=name&order=asc" \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "name": "Annual Health Checkup",
      "description": "年次健康診断",
      "active": true,
      "createdAt": "2025-11-03T10:00:00.000Z",
      "updatedAt": "2025-11-03T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Influenza Vaccination",
      "description": "インフルエンザ予防接種",
      "active": true,
      "createdAt": "2025-11-03T11:00:00.000Z",
      "updatedAt": "2025-11-03T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 50
  }
}
```

---

## 9.9 GET /api/admin/reservation-types/:id

### 概要
特定の予約種別の詳細情報を取得します。

### 認証
管理者トークン認証

### リクエスト

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 予約種別ID |

**例**:
```bash
curl -X GET http://localhost:3000/api/admin/reservation-types/1 \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "id": 1,
  "name": "Influenza Vaccination",
  "description": "インフルエンザ予防接種",
  "active": true,
  "createdAt": "2025-11-03T10:00:00.000Z",
  "updatedAt": "2025-11-03T10:00:00.000Z"
}
```

---

#### エラー

**404 Not Found** - 予約種別が存在しない
```json
{
  "statusCode": 404,
  "message": "Reservation type not found"
}
```

---

## 9.10 PATCH /api/admin/reservation-types/:id

### 概要
予約種別を更新します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Content-Type: application/json
```

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 予約種別ID |

**Body**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | - | 種別名 |
| `description` | string | - | 説明 |
| `active` | boolean | - | 有効フラグ |

**例**:
```bash
curl -X PATCH http://localhost:3000/api/admin/reservation-types/1 \
  -H "X-Admin-Token: test-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Influenza Vaccination 2025",
    "active": false
  }'
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "id": 1,
  "name": "Influenza Vaccination 2025",
  "description": "インフルエンザ予防接種",
  "active": false,
  "createdAt": "2025-11-03T10:00:00.000Z",
  "updatedAt": "2025-11-04T15:00:00.000Z"
}
```

---

## 9.11 DELETE /api/admin/reservation-types/:id

### 概要
予約種別を削除します（物理削除）。

### 認証
管理者トークン認証

### リクエスト

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 予約種別ID |

**例**:
```bash
curl -X DELETE http://localhost:3000/api/admin/reservation-types/1 \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (200 OK)

```json
{}
```

---

#### エラー

**404 Not Found** - 予約種別が存在しない
```json
{
  "statusCode": 404,
  "message": "Reservation type not found"
}
```

---

## 9.12 POST /api/admin/slots/:id/departments

### 概要
予約枠に部署を割り当てます（部署別の定員オーバーライド機能付き）。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Content-Type: application/json
```

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 予約枠ID |

**Body**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `departmentId` | string | ◯ | 部署ID |
| `enabled` | boolean | ◯ | 利用可否 |
| `capacityOverride` | number \| null | - | 部署別定員（nullの場合は枠全体の定員を使用） |

**例**:
```bash
curl -X POST http://localhost:3000/api/admin/slots/10/departments \
  -H "X-Admin-Token: test-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "departmentId": "ER",
    "enabled": true,
    "capacityOverride": 5
  }'
```

---

### レスポンス

#### 成功 (201 Created)

```json
{
  "id": 1,
  "slotId": 10,
  "departmentId": "ER",
  "enabled": true,
  "capacityOverride": 5,
  "createdAt": "2025-11-04T10:00:00.000Z",
  "updatedAt": "2025-11-04T10:00:00.000Z"
}
```

---

#### エラー

**404 Not Found** - 予約枠または部署が存在しない
```json
{
  "statusCode": 404,
  "message": "Slot not found"
}
```

**409 Conflict** - 既に同じ部署が割り当て済み
```json
{
  "statusCode": 409,
  "message": "Department already linked to this slot"
}
```

---

## 9.13 PATCH /api/admin/slots/:slotId/departments/:deptId

### 概要
予約枠の部署割り当て設定を更新します。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
Content-Type: application/json
```

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `slotId` | number | 予約枠ID |
| `deptId` | string | 部署ID |

**Body**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `enabled` | boolean | - | 利用可否 |
| `capacityOverride` | number \| null | - | 部署別定員 |

**例**:
```bash
curl -X PATCH http://localhost:3000/api/admin/slots/10/departments/ER \
  -H "X-Admin-Token: test-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "capacityOverride": null
  }'
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "id": 1,
  "slotId": 10,
  "departmentId": "ER",
  "enabled": false,
  "capacityOverride": null,
  "createdAt": "2025-11-04T10:00:00.000Z",
  "updatedAt": "2025-11-04T15:00:00.000Z"
}
```

---

#### エラー

**404 Not Found** - 割り当てが存在しない
```json
{
  "statusCode": 404,
  "message": "Slot-department link not found"
}
```

---

## 9.14 DELETE /api/admin/slots/:slotId/departments/:deptId

### 概要
予約枠の部署割り当てを削除します（冪等）。

### 認証
管理者トークン認証

### リクエスト

**Headers**:
```http
X-Admin-Token: test-admin-token
```

**Path Parameters**:
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `slotId` | number | 予約枠ID |
| `deptId` | string | 部署ID |

**例**:
```bash
curl -X DELETE http://localhost:3000/api/admin/slots/10/departments/ER \
  -H "X-Admin-Token: test-admin-token"
```

---

### レスポンス

#### 成功 (204 No Content)

レスポンスボディなし。

---

### ビジネスルール

#### 冪等性
- 2回目以降の削除も `204 No Content` を返す
- 存在しない割り当ての削除もエラーにならない

---

## 9.15 べき等性の実装

### Idempotency-Keyの使用

管理者APIは `Idempotency-Key` ヘッダーによりべき等性を保証します。

**例**:
```http
POST /api/admin/staffs/import
X-Admin-Token: test-admin-token
Idempotency-Key: import-20251103-001
```

**動作**:
- 同じキーで再実行 → 既存データをスキップ（409を返さない）
- 異なるキー → 新規インポート

**キーの命名規則例**:
- `import-YYYYMMDD-NNN` (例: `import-20251103-001`)
- `bulk-slot-YYYYMMDD-HHmmss` (例: `bulk-slot-20251103-143000`)

---

## 9.16 CSV形式の詳細

### エンコーディング

- **文字コード**: UTF-8
- **BOM**: あり・なしの両方に対応
- **改行コード**: LF / CRLF の両方に対応

### 必須ヘッダー

```csv
名前(漢字),本部ID,部署,職種
```

**注意**: ヘッダー名は完全一致必須（全角括弧、大文字小文字も区別）

### サンプルCSV

```csv
名前(漢字),本部ID,部署,職種
山田太郎,900100,ER,医師
佐藤花子,900101,RAD,放射線技師
鈴木一郎,900102,VAC,看護師
田中美咲,900103,CARD,臨床検査技師
```

---

## 9.17 関連ドキュメント

- **[05-API-Overview.md](./05-API-Overview.md)** - API共通仕様
- **[13-Business-Rules.md](./13-Business-Rules.md)** - 業務ルール（べき等性）
- **[03-Data-Model.md](./03-Data-Model.md)** - データモデル（初期値・制約）

---

**最終更新**: 2025-11-04
**バージョン**: 2.0.0

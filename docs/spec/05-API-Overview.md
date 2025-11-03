# 05. API共通仕様

## 5.1 ベースURL

```
http://localhost:3000/api
```

### 本番環境

```
https://reserve-api.example.com/api
```

**重要**: すべてのエンドポイントは `/api` プレフィックスを持つ。

---

## 5.2 認証方式

### 5.2.1 JWT Bearer認証

**対象エンドポイント**: `/api/staffs/*`, `/api/reservations/*`

**ヘッダー形式**:

```http
Authorization: Bearer <access_token>
```

**トークン取得方法**: `POST /api/auth/login` で取得

---

### 5.2.2 管理者トークン認証

**対象エンドポイント**: `/api/admin/*`

**ヘッダー形式**:

```http
X-Admin-Token: <admin_token>
Idempotency-Key: <unique_key>
```

**環境変数**: `ADMIN_TOKEN` で設定

---

## 5.3 リクエスト形式

### 5.3.1 JSON

**Content-Type**: `application/json`

```json
{
  "field": "value"
}
```

### 5.3.2 CSV（管理者のみ）

**Content-Type**: `text/csv`

```csv
名前(漢字),本部ID,部署,職種
山田太郎,900100,ER,医師
```

---

## 5.4 レスポンス形式

### 5.4.1 成功レスポンス

**200 OK / 201 Created**

```json
{
  "id": 1,
  "field": "value",
  "createdAt": "2025-11-03T12:00:00.000Z"
}
```

**204 No Content**

```
(レスポンスボディなし)
```

---

### 5.4.2 エラーレスポンス

**標準形式**:

```json
{
  "statusCode": 400,
  "message": "エラーメッセージ",
  "error": "Bad Request"
}
```

**バリデーションエラー**:

```json
{
  "statusCode": 400,
  "message": ["staffId must be a string", "pin must be exactly 4 characters"],
  "error": "Bad Request"
}
```

**拡張情報付きエラー**:

```json
{
  "statusCode": 401,
  "message": "invalid credentials",
  "attemptsRemaining": 3
}
```

---

## 5.5 HTTPステータスコード

### 5.5.1 成功系（2xx）

| コード  | 意味       | 使用場面                   |
| ------- | ---------- | -------------------------- |
| **200** | OK         | GET・PATCH成功             |
| **201** | Created    | POST成功（リソース作成）   |
| **204** | No Content | POST成功（レスポンスなし） |

---

### 5.5.2 クライアントエラー（4xx）

| コード  | 意味                  | 使用場面                               |
| ------- | --------------------- | -------------------------------------- |
| **400** | Bad Request           | バリデーションエラー・不正なパラメータ |
| **401** | Unauthorized          | 認証失敗・トークン無効・PIN誤り        |
| **403** | Forbidden             | 権限不足・受付期間外                   |
| **404** | Not Found             | リソース未存在                         |
| **409** | Conflict              | 重複エラー・楽観ロック失敗・年度重複   |
| **423** | Locked                | PINロック中                            |
| **428** | Precondition Required | プロフィール未完了・PIN未変更          |

---

### 5.5.3 サーバーエラー（5xx）

| コード  | 意味                  | 使用場面         |
| ------- | --------------------- | ---------------- |
| **500** | Internal Server Error | 予期しないエラー |

---

## 5.6 エンドポイント一覧

### 5.6.1 認証（詳細: [06-Auth-API.md](./06-Auth-API.md)）

| メソッド | パス                | 認証 | 説明                 |
| -------- | ------------------- | ---- | -------------------- |
| POST     | `/api/auth/login`   | 不要 | ログイン             |
| POST     | `/api/auth/refresh` | 不要 | トークンリフレッシュ |

---

### 5.6.2 職員（詳細: [07-Staff-API.md](./07-Staff-API.md)）

| メソッド | パス                 | 認証 | 説明             |
| -------- | -------------------- | ---- | ---------------- |
| GET      | `/api/staffs/me`     | JWT  | 自身の情報取得   |
| PATCH    | `/api/staffs/me`     | JWT  | プロフィール更新 |
| POST     | `/api/staffs/me/pin` | JWT  | PIN変更          |

---

### 5.6.3 予約（詳細: [08-Reservation-API.md](./08-Reservation-API.md)）

| メソッド | パス                | 認証 | 説明     |
| -------- | ------------------- | ---- | -------- |
| POST     | `/api/reservations` | JWT  | 予約登録 |

---

### 5.6.4 管理者（詳細: [09-Admin-API.md](./09-Admin-API.md)）

| メソッド | パス                           | 認証  | 説明            |
| -------- | ------------------------------ | ----- | --------------- |
| POST     | `/api/admin/staffs/import`     | Admin | 職員CSV一括登録 |
| POST     | `/api/admin/reservation-types` | Admin | 予約種別作成    |
| POST     | `/api/admin/slots/bulk`        | Admin | 予約枠一括作成  |

---

### 5.6.5 公開エンドポイント

| メソッド | パス                     | 認証 | 説明         |
| -------- | ------------------------ | ---- | ------------ |
| GET      | `/api/reservation-types` | 不要 | 予約種別一覧 |

---

## 5.7 共通ヘッダー

### 5.7.1 リクエストヘッダー

| ヘッダー          | 必須 | 説明                              | 例                    |
| ----------------- | ---- | --------------------------------- | --------------------- |
| `Content-Type`    | ◯    | リクエストボディの形式            | `application/json`    |
| `Authorization`   | △    | JWTトークン（認証が必要な場合）   | `Bearer eyJhbGc...`   |
| `X-Admin-Token`   | △    | 管理者トークン（管理者APIの場合） | `test-admin-token`    |
| `Idempotency-Key` | △    | べき等性キー（管理者APIの場合）   | `import-20251103-001` |

---

### 5.7.2 レスポンスヘッダー

| ヘッダー         | 説明           | 例                 |
| ---------------- | -------------- | ------------------ |
| `Content-Type`   | レスポンス形式 | `application/json` |
| `Content-Length` | ボディサイズ   | `123`              |

---

## 5.8 バリデーション

### 5.8.1 共通ルール

| 項目           | ルール                                       |
| -------------- | -------------------------------------------- |
| **職員ID**     | 数字のみ、6桁程度                            |
| **PIN**        | 数字のみ、厳密に4桁                          |
| **EMR患者ID**  | 数字のみ、任意桁数                           |
| **生年月日**   | YYYY-MM-DD 形式                              |
| **性別コード** | `1` (男性) または `2` (女性)                 |
| **日付**       | YYYY-MM-DD 形式                              |
| **日時**       | ISO 8601 形式（`2025-11-03T12:00:00+09:00`） |

---

### 5.8.2 バリデーションエラーの例

**リクエスト**:

```json
{
  "staffId": "",
  "pin": "12345"
}
```

**レスポンス** (400 Bad Request):

```json
{
  "statusCode": 400,
  "message": [
    "staffId should not be empty",
    "pin must be exactly 4 characters"
  ],
  "error": "Bad Request"
}
```

---

## 5.9 ページネーション

**現バージョンでは未実装**。将来的に実装する場合：

```
GET /api/reservations?page=1&limit=20
```

**レスポンス**:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## 5.10 レート制限

**現バージョンでは未実装**。将来的に実装する場合：

- ログインAPI: 1分間に5回まで
- その他API: 1分間に100回まで

**レスポンス** (429 Too Many Requests):

```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## 5.11 タイムゾーン

すべての日時は **Asia/Tokyo (JST)** を使用。

### 5.11.1 サーバー側

- 環境変数 `TZ=Asia/Tokyo` を設定
- MySQL: `timezone: '+09:00'` を設定

### 5.11.2 クライアント側

- ISO 8601形式で送受信（例: `2025-11-03T12:00:00+09:00`）
- タイムゾーン指定がない場合は JST として扱う

---

## 5.12 べき等性

### 5.12.1 管理者API

管理者APIは **Idempotency-Key** ヘッダーによりべき等性を保証。

```http
POST /api/admin/staffs/import
X-Admin-Token: test-admin-token
Idempotency-Key: import-20251103-001
```

- 同じキーでの再実行は既存データをスキップ
- 異なるキーは新規インポートとして扱う

---

### 5.12.2 予約API

予約APIは **データベース制約** によりべき等性を保証。

- 同一 `(staffId, reservationTypeId, periodKey)` の重複予約を拒否（409 Conflict）
- 同一 `(slotId, staffId)` の重複予約を拒否（409 Conflict）

---

## 5.13 CORS設定

**開発環境**:

```javascript
{
  origin: 'http://localhost:3001',
  credentials: true
}
```

**本番環境**:

```javascript
{
  origin: 'https://reserve.example.com',
  credentials: true
}
```

---

## 5.14 APIバージョニング

**現バージョン**: v1（URLに含めない）

将来的にバージョンアップする場合：

```
/api/v2/reservations
```

---

## 5.15 ヘルスチェック

```
GET /api/reservation-types
```

認証不要の公開エンドポイントをヘルスチェックに使用。

**期待レスポンス** (200 OK):

```json
[
  {
    "id": 1,
    "name": "Baseline Vaccination",
    "active": true
  }
]
```

---

## 5.16 関連ドキュメント

- **[06-Auth-API.md](./06-Auth-API.md)** - 認証API詳細
- **[07-Staff-API.md](./07-Staff-API.md)** - 職員API詳細
- **[08-Reservation-API.md](./08-Reservation-API.md)** - 予約API詳細
- **[09-Admin-API.md](./09-Admin-API.md)** - 管理者API詳細
- **[19-Error-Codes.md](./19-Error-Codes.md)** - エラーコード一覧

---

**最終更新**: 2025-11-03
**バージョン**: 1.0.0

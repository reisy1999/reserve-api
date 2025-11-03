# 07. 職員API

## 7.1 概要

職員APIは、ログイン済み職員が自身の情報を取得・更新する機能を提供します。

---

## 7.2 GET /api/staffs/me

### 概要
ログイン中の職員情報を取得します。

### 認証
必須（JWT Bearer認証）

### リクエスト

**Headers**:
```http
Authorization: Bearer <access_token>
```

**Body**: なし

**例**:
```bash
curl -X GET http://localhost:3000/api/staffs/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### レスポンス

#### 成功 (200 OK)

```json
{
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "emrPatientId": "123456",
  "familyName": "山田",
  "givenName": "太郎",
  "familyNameKana": "やまだ",
  "givenNameKana": "たろう",
  "jobTitle": "医師",
  "departmentId": "ER",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1",
  "pinMustChange": false,
  "pinRetryCount": 0,
  "pinLockedUntil": null,
  "status": "active",
  "role": "STAFF",
  "version": 3,
  "lastLoginAt": "2025-11-03T09:00:00.000Z",
  "createdAt": "2025-04-01T00:00:00.000Z",
  "updatedAt": "2025-11-03T09:00:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `staffUid` | string | 職員UUID |
| `staffId` | string | 職員ID |
| `emrPatientId` | string \| null | EMR患者ID（未設定時はnull） |
| `familyName` | string | 姓 |
| `givenName` | string | 名 |
| `familyNameKana` | string \| null | 姓カナ |
| `givenNameKana` | string \| null | 名カナ |
| `jobTitle` | string | 職種 |
| `departmentId` | string | 部署ID |
| `dateOfBirth` | string | 生年月日（YYYY-MM-DD形式） |
| `sexCode` | string | 性別コード（`1`: 男性、`2`: 女性） |
| `pinMustChange` | boolean | PIN変更必須フラグ |
| `pinRetryCount` | number | PIN失敗回数 |
| `pinLockedUntil` | string \| null | PINロック解除日時 |
| `status` | string | ステータス（`active` / `suspended` / `left`） |
| `role` | string | ロール（`STAFF` / `ADMIN`） |
| `version` | number | 楽観ロックバージョン |
| `lastLoginAt` | string \| null | 最終ログイン日時 |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

---

#### エラー

**401 Unauthorized** - トークン無効
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## 7.3 PATCH /api/staffs/me

### 概要
ログイン中の職員のプロフィールを更新します。

### 認証
必須（JWT Bearer認証）

### リクエスト

**Headers**:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
| フィールド | 型 | 必須 | 説明 | バリデーション |
|-----------|-----|------|------|---------------|
| `version` | number | ◯ | 楽観ロックバージョン | 0以上の整数 |
| `currentPin` | string | △ | 現在のPIN（重要項目更新時のみ必須） | 数字4桁 |
| `emrPatientId` | string | - | EMR患者ID | 数字のみ、最大64桁 |
| `dateOfBirth` | string | - | 生年月日 | YYYY-MM-DD形式 |
| `sexCode` | string | - | 性別コード | `1` または `2` |
| `familyNameKana` | string | - | 姓カナ | 任意文字列 |
| `givenNameKana` | string | - | 名カナ | 任意文字列 |
| `jobTitle` | string | - | 職種 | 任意文字列 |

**例**:
```json
{
  "version": 3,
  "currentPin": "1234",
  "emrPatientId": "123456",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1"
}
```

---

### レスポンス

#### 成功 (200 OK)

更新後の職員情報を返します（GET /api/staffs/me と同じ形式）。

```json
{
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "emrPatientId": "123456",
  "familyName": "山田",
  "givenName": "太郎",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1",
  "version": 4,
  ...
}
```

**重要**: `version` が自動的にインクリメントされます。

---

#### エラー

**400 Bad Request** - バリデーションエラー
```json
{
  "statusCode": 400,
  "message": [
    "version must be an integer number",
    "dateOfBirth must match /^\\d{4}-\\d{2}-\\d{2}$/ regular expression"
  ],
  "error": "Bad Request"
}
```

**400 Bad Request** - EMR患者ID重複
```json
{
  "statusCode": 400,
  "message": "emrPatientId already exists."
}
```

**409 Conflict** - バージョン不一致（楽観ロック失敗）
```json
{
  "statusCode": 409,
  "message": "Version mismatch"
}
```

**428 Precondition Required** - PIN再認証が必要
```json
{
  "statusCode": 428,
  "message": "PIN re-authentication required"
}
```

**428 Precondition Required** - PIN不一致
```json
{
  "statusCode": 428,
  "message": "PIN mismatch"
}
```

---

### ビジネスルール

#### PIN再認証が必要な項目

以下の項目を更新する場合、`currentPin` が必須です：

- `emrPatientId`
- `dateOfBirth`
- `sexCode`
- `jobTitle`

**理由**: これらは医療記録に影響する重要情報のため、本人確認を要求。

#### 楽観ロック

`version` フィールドで更新競合を検出します。

```mermaid
sequenceDiagram
    participant User1 as ユーザー1
    participant User2 as ユーザー2
    participant API as /api/staffs/me
    participant DB as MySQL

    User1->>API: GET /api/staffs/me
    API-->>User1: { version: 3, ... }

    User2->>API: GET /api/staffs/me
    API-->>User2: { version: 3, ... }

    User1->>API: PATCH { version: 3, jobTitle: "医師" }
    API->>DB: UPDATE ... WHERE version = 3
    API->>DB: SET version = 4
    API-->>User1: 200 OK { version: 4 }

    User2->>API: PATCH { version: 3, jobTitle: "看護師" }
    API->>DB: WHERE version = 3<br/>(不一致検知)
    API-->>User2: 409 Conflict<br/>"Version mismatch"
```

**対処**: 409エラーが返された場合、最新データを再取得してから再試行。

---

### シーケンス図

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant API as /api/staffs/me
    participant DB as MySQL

    Client->>API: PATCH { version: 3, currentPin, emrPatientId }
    API->>API: バージョンチェック

    alt バージョン不一致
        API-->>Client: 409 Conflict
    end

    API->>API: PIN再認証が必要か判定<br/>(emrPatientId等の更新)

    alt PIN再認証が必要だがcurrentPinなし
        API-->>Client: 428 Precondition Required<br/>"PIN re-authentication required"
    end

    API->>API: argon2.verify(currentPin, pinHash)

    alt PIN不一致
        API-->>Client: 428 Precondition Required<br/>"PIN mismatch"
    end

    API->>DB: SELECT * FROM staffs<br/>WHERE emr_patient_id = ?

    alt EMR患者ID重複
        API-->>Client: 400 Bad Request<br/>"emrPatientId already exists."
    end

    API->>DB: UPDATE staffs<br/>SET emr_patient_id = ?,<br/>version = version + 1<br/>WHERE staff_uid = ?
    API-->>Client: 200 OK<br/>{ version: 4, ... }
```

---

### 使用例

```bash
# 1. 現在の情報を取得（versionを確認）
curl -X GET http://localhost:3000/api/staffs/me \
  -H "Authorization: Bearer <token>"

# 2. 重要項目を更新（PIN再認証あり）
curl -X PATCH http://localhost:3000/api/staffs/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 3,
    "currentPin": "1234",
    "emrPatientId": "123456",
    "dateOfBirth": "1990-05-15",
    "sexCode": "1"
  }'

# 3. カナ情報のみ更新（PIN再認証不要）
curl -X PATCH http://localhost:3000/api/staffs/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 4,
    "familyNameKana": "やまだ",
    "givenNameKana": "たろう"
  }'
```

---

## 7.4 POST /api/staffs/me/pin

### 概要
ログイン中の職員のPINを変更します。

### 認証
必須（JWT Bearer認証）

### リクエスト

**Headers**:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
| フィールド | 型 | 必須 | 説明 | バリデーション |
|-----------|-----|------|------|---------------|
| `currentPin` | string | ◯ | 現在のPIN | 数字4桁（例: `1234`） |
| `newPin` | string | ◯ | 新しいPIN | 数字4桁（例: `5678`） |

**例**:
```json
{
  "currentPin": "0000",
  "newPin": "1234"
}
```

---

### レスポンス

#### 成功 (204 No Content)

レスポンスボディなし。

---

#### エラー

**400 Bad Request** - バリデーションエラー
```json
{
  "statusCode": 400,
  "message": [
    "currentPin must match /^\\d{4}$/ regular expression",
    "newPin must match /^\\d{4}$/ regular expression"
  ],
  "error": "Bad Request"
}
```

**428 Precondition Required** - 現在のPIN不一致
```json
{
  "statusCode": 428,
  "message": "Current PIN is invalid"
}
```

---

### ビジネスルール

#### PIN変更時の処理

1. 現在のPINで再認証
2. 新PINをargon2でハッシュ化
3. 以下のフィールドを更新：
   - `pinHash`: 新しいハッシュ
   - `pinUpdatedAt`: 現在時刻
   - `pinMustChange`: `false` に設定
   - `pinRetryCount`: `0` にリセット
   - `pinLockedUntil`: `null` にリセット
   - `pinVersion`: インクリメント

**効果**: PIN変更によりロックが自動解除され、初回ログイン要求もクリアされます。

---

### シーケンス図

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant API as /api/staffs/me/pin
    participant DB as MySQL

    Client->>API: POST { currentPin, newPin }
    API->>API: argon2.verify(currentPin, pinHash)

    alt PIN不一致
        API-->>Client: 428 Precondition Required<br/>"Current PIN is invalid"
    end

    API->>API: argon2.hash(newPin + pepper)
    API->>DB: UPDATE staffs<br/>SET pin_hash = ?,<br/>pin_updated_at = NOW(),<br/>pin_must_change = false,<br/>pin_retry_count = 0,<br/>pin_locked_until = NULL,<br/>pin_version = pin_version + 1<br/>WHERE staff_uid = ?
    API-->>Client: 204 No Content
```

---

### 使用例

```bash
# 初回ログイン時にPIN変更（0000 → 1234）
curl -X POST http://localhost:3000/api/staffs/me/pin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPin": "0000",
    "newPin": "1234"
  }'

# 通常のPIN変更（1234 → 5678）
curl -X POST http://localhost:3000/api/staffs/me/pin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPin": "1234",
    "newPin": "5678"
  }'
```

---

## 7.5 初回ログインフロー

```mermaid
sequenceDiagram
    participant Staff as 職員
    participant Auth as /api/auth/login
    participant Me as /api/staffs/me
    participant Patch as /api/staffs/me (PATCH)
    participant Pin as /api/staffs/me/pin

    Note over Staff,Pin: 1. 初回ログイン
    Staff->>Auth: POST { staffId, pin: "0000" }
    Auth-->>Staff: 200 OK<br/>{ accessToken, ... }

    Note over Staff,Pin: 2. プロフィール確認
    Staff->>Me: GET (with JWT)
    Me-->>Staff: 200 OK<br/>{ pinMustChange: true, emrPatientId: null, ... }

    Note over Staff,Pin: 3. プロフィール更新
    Staff->>Patch: PATCH { version, currentPin, emrPatientId, dateOfBirth, sexCode }
    Patch-->>Staff: 200 OK<br/>{ version: 1, ... }

    Note over Staff,Pin: 4. PIN変更
    Staff->>Pin: POST { currentPin: "0000", newPin: "1234" }
    Pin-->>Staff: 204 No Content

    Note over Staff,Pin: 5. 再ログイン
    Staff->>Auth: POST { staffId, pin: "1234" }
    Auth-->>Staff: 200 OK<br/>{ accessToken, ... }

    Note over Staff,Pin: 6. 完了確認
    Staff->>Me: GET (with JWT)
    Me-->>Staff: 200 OK<br/>{ pinMustChange: false, emrPatientId: "123456", ... }
```

---

## 7.6 プロフィール完了要件

予約機能を利用するには、以下の条件を満たす必要があります：

| 項目 | フィールド | 初期値 | 必須 |
|------|-----------|--------|------|
| **EMR患者ID** | `emrPatientId` | `null` | ◯ |
| **生年月日** | `dateOfBirth` | `1900-01-01` | ◯ |
| **性別コード** | `sexCode` | `1` | ◯ |
| **PIN変更** | `pinMustChange` | `true` | ◯（`false`にする） |

**チェックロジック**: 予約API実行時に以下を検証：
```typescript
if (staff.pinMustChange) {
  throw new HttpException('PIN change required before reserving.', 428);
}
if (!staff.emrPatientId || staff.dateOfBirth === '1900-01-01') {
  throw new HttpException('Profile incomplete for reservation.', 428);
}
```

---

## 7.7 関連ドキュメント

- **[05-API-Overview.md](./05-API-Overview.md)** - API共通仕様
- **[06-Auth-API.md](./06-Auth-API.md)** - 認証API詳細
- **[13-Business-Rules.md](./13-Business-Rules.md)** - 業務ルール（プロフィール完了要件）
- **[15-State-Transitions.md](./15-State-Transitions.md)** - 状態遷移図

---

**最終更新**: 2025-11-03
**バージョン**: 1.0.0

# 08. 予約API

## 8.1 概要

予約APIは、職員が予約枠を選択して予約を登録する機能を提供します。

---

## 8.2 POST /api/reservations

### 概要
指定した予約枠に対して予約を登録します。

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
| `slotId` | number | ◯ | 予約枠ID | 1以上の整数 |

**例**:
```json
{
  "slotId": 10
}
```

---

### レスポンス

#### 成功 (201 Created)

```json
{
  "id": 123,
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "reservationTypeId": 1,
  "slotId": 10,
  "serviceDateLocal": "2025-12-15",
  "startMinuteOfDay": 540,
  "durationMinutes": 30,
  "periodKey": "FY2025",
  "canceledAt": null,
  "createdAt": "2025-11-03T10:00:00.000Z",
  "updatedAt": "2025-11-03T10:00:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | number | 予約ID |
| `staffUid` | string | 職員UUID |
| `staffId` | string | 職員ID |
| `reservationTypeId` | number | 予約種別ID |
| `slotId` | number | 予約枠ID |
| `serviceDateLocal` | string | サービス提供日（YYYY-MM-DD） |
| `startMinuteOfDay` | number | 開始分（0〜1439、0 = 00:00、540 = 09:00） |
| `durationMinutes` | number | 所要時間（分） |
| `periodKey` | string | 期間キー（例: `FY2025`） |
| `canceledAt` | null | キャンセル日時（通常はnull） |
| `createdAt` | string | 作成日時 |
| `updatedAt` | string | 更新日時 |

---

#### エラー

**400 Bad Request** - バリデーションエラー
```json
{
  "statusCode": 400,
  "message": [
    "slotId must be an integer number",
    "slotId must not be less than 1"
  ],
  "error": "Bad Request"
}
```

**403 Forbidden** - 受付期間外
```json
{
  "statusCode": 403,
  "message": "Reservation window closed"
}
```

**404 Not Found** - 予約枠が存在しない
```json
{
  "statusCode": 404,
  "message": "Reservation slot not found"
}
```

**409 Conflict** - 年度1回制限違反
```json
{
  "statusCode": 409,
  "message": "Already reserved once in this fiscal year."
}
```

**409 Conflict** - 定員到達
```json
{
  "statusCode": 409,
  "message": "Reservation capacity has been reached."
}
```

**409 Conflict** - 同一枠重複
```json
{
  "statusCode": 409,
  "message": "Duplicate reservation for this slot."
}
```

**428 Precondition Required** - プロフィール未完了
```json
{
  "statusCode": 428,
  "message": "Profile incomplete for reservation."
}
```

**428 Precondition Required** - PIN未変更
```json
{
  "statusCode": 428,
  "message": "PIN change required before reserving."
}
```

---

## 8.3 ビジネスルール

### 8.3.1 プロフィール完了チェック

予約を行うには、以下の条件を満たす必要があります：

| 項目 | フィールド | 初期値 | 必須条件 |
|------|-----------|--------|----------|
| **EMR患者ID** | `emrPatientId` | `null` | 設定済み（`null`でない） |
| **生年月日** | `dateOfBirth` | `1900-01-01` | 仮値でない |
| **性別コード** | `sexCode` | `1` | 任意（初期値のままでもOK） |
| **PIN変更** | `pinMustChange` | `true` | `false`（変更済み） |

**チェックロジック**:
```typescript
if (staff.pinMustChange) {
  throw new HttpException('PIN change required before reserving.', 428);
}
if (!staff.emrPatientId || !staff.dateOfBirth || !staff.sexCode) {
  throw new HttpException('Profile incomplete for reservation.', 428);
}
```

---

### 8.3.2 受付期間チェック

予約枠には受付期間が設定されています：

| 条件 | 判定 |
|------|------|
| `slot.status !== 'published'` | 受付不可 |
| `now < slot.bookingStart` | 受付開始前 |
| `now > slot.bookingEnd` | 受付終了後 |

**受付可能**: `status = 'published'` かつ `bookingStart ≤ now ≤ bookingEnd`

---

### 8.3.3 年度1回制限

同一職員は、同一年度・同一予約種別の予約を **1回のみ** 実施可能。

#### 期間キー（Period Key）の計算

```typescript
// src/utils/date.ts
export function calculatePeriodKey(serviceDateLocal: string): string {
  const [year, month] = serviceDateLocal.split('-').map(Number);
  const fiscalYear = month >= 4 ? year : year - 1;
  return `FY${fiscalYear}`;
}
```

**例**:
| サービス提供日 | 期間キー | 説明 |
|--------------|---------|------|
| 2025-04-15 | FY2025 | 2025年度 |
| 2025-12-01 | FY2025 | 2025年度 |
| 2026-03-31 | FY2025 | 2025年度（3月まで） |
| 2026-04-01 | FY2026 | 2026年度（4月から） |

#### 制約の実装

**データベース制約**:
```sql
UNIQUE (staff_id, reservation_type_id, period_key)
```

**チェックロジック**:
```typescript
const existing = await reservationRepo.findOne({
  where: {
    staffId: staff.staffId,
    reservationTypeId: slot.reservationTypeId,
    periodKey,
  },
});
if (existing) {
  throw new ConflictException('Already reserved once in this fiscal year.');
}
```

---

### 8.3.4 定員管理

予約枠には定員があり、定員に達したら新規予約を受け付けません。

| フィールド | 説明 |
|-----------|------|
| `capacity` | 枠の最大予約数 |
| `bookedCount` | 現在の予約数 |
| **条件** | `bookedCount < capacity` の場合のみ予約可能 |

#### 悲観的ロック（Pessimistic Locking）

定員管理のため、予約枠を悲観的ロック（`FOR UPDATE`）で取得します。

```typescript
const lockedSlot = await slotRepo.findOne({
  where: { id: slotId },
  lock: { mode: 'pessimistic_write' }  // FOR UPDATE
});

if (lockedSlot.bookedCount >= lockedSlot.capacity) {
  throw new ConflictException('Reservation capacity has been reached.');
}

lockedSlot.bookedCount += 1;
await slotRepo.save(lockedSlot);
```

**効果**: 複数ユーザーが同時に予約しても、定員を超えることを防止。

---

### 8.3.5 重複予約防止

同一職員が同一枠に複数回予約することを防止します。

**データベース制約**:
```sql
UNIQUE (slot_id, staff_id)
```

---

## 8.4 シーケンス図

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant API as /api/reservations
    participant DB as MySQL

    Client->>API: POST { slotId: 10 }

    Note over API: 1. プロフィール完了チェック
    API->>API: ensureStaffEligible(staff)

    alt プロフィール未完了
        API-->>Client: 428 Precondition Required<br/>"Profile incomplete for reservation."
    end

    alt PIN未変更
        API-->>Client: 428 Precondition Required<br/>"PIN change required before reserving."
    end

    Note over API: 2. 予約枠取得
    API->>DB: SELECT * FROM reservation_slots<br/>WHERE id = 10

    alt 枠が存在しない
        API-->>Client: 404 Not Found<br/>"Reservation slot not found"
    end

    Note over API: 3. 受付期間チェック
    API->>API: isBookingWindowOpen(slot)

    alt 受付期間外
        API-->>Client: 403 Forbidden<br/>"Reservation window closed"
    end

    Note over API: 4. 期間キー計算
    API->>API: periodKey = calculatePeriodKey(serviceDateLocal)

    Note over API: 5. 年度1回制限チェック
    API->>DB: SELECT * FROM reservations<br/>WHERE staff_id = ? AND<br/>reservation_type_id = ? AND<br/>period_key = ?

    alt 既に予約済み
        API-->>Client: 409 Conflict<br/>"Already reserved once in this fiscal year."
    end

    Note over API: 6. トランザクション開始
    API->>DB: BEGIN TRANSACTION

    Note over API: 7. 悲観的ロック
    API->>DB: SELECT * FROM reservation_slots<br/>WHERE id = 10<br/>FOR UPDATE

    alt 定員到達
        API->>DB: ROLLBACK
        API-->>Client: 409 Conflict<br/>"Reservation capacity has been reached."
    end

    Note over API: 8. 予約登録 + カウント更新
    API->>DB: INSERT INTO reservations (...)
    API->>DB: UPDATE reservation_slots<br/>SET booked_count = booked_count + 1<br/>WHERE id = 10
    API->>DB: COMMIT

    API-->>Client: 201 Created<br/>{ id, staffId, slotId, periodKey, ... }
```

---

## 8.5 開始時刻の表現

### startMinuteOfDay の説明

`startMinuteOfDay` は、1日の開始（00:00）からの経過分数で時刻を表現します。

| startMinuteOfDay | 時刻 | 計算 |
|-----------------|------|------|
| 0 | 00:00 | 0:00 |
| 60 | 01:00 | 1時間 |
| 540 | 09:00 | 9時間 = 9 × 60 |
| 720 | 12:00 | 12時間 = 12 × 60 |
| 1020 | 17:00 | 17時間 = 17 × 60 |
| 1439 | 23:59 | 23:59 |

**計算式**:
```typescript
// 時刻 → startMinuteOfDay
const startMinuteOfDay = hour * 60 + minute;

// startMinuteOfDay → 時刻
const hour = Math.floor(startMinuteOfDay / 60);
const minute = startMinuteOfDay % 60;
```

**例**: `serviceDateLocal: "2025-12-15"` + `startMinuteOfDay: 540` = **2025年12月15日 09:00**

---

## 8.6 複数年度の予約例

### シナリオ: 職員Aが「インフルエンザ予防接種」を予約

| 予約日 | サービス提供日 | 期間キー | 予約可否 | 理由 |
|--------|--------------|---------|---------|------|
| 2025-04-01 | 2025-10-15 | FY2025 | ✅ 可能 | 初回予約 |
| 2025-12-01 | 2026-03-15 | FY2025 | ❌ 不可 | 既にFY2025で予約済み |
| 2026-04-01 | 2026-10-15 | FY2026 | ✅ 可能 | 新年度（FY2026） |

---

## 8.7 予約枠ステータス

### ステータス遷移

```mermaid
stateDiagram-v2
    [*] --> draft: 管理者が作成
    draft --> published: 管理者が公開
    published --> closed: 管理者が締切
    draft --> closed: 直接締切

    note right of draft
        職員には表示されない
    end note

    note right of published
        職員が予約可能
        bookingStart/End内のみ
    end note

    note right of closed
        新規予約不可
        既存予約は有効
    end note
```

### ステータス別の動作

| ステータス | 予約可否 | 表示 |
|-----------|---------|------|
| **draft** | ❌ | 非表示 |
| **published** | ✅ (受付期間内) | 表示 |
| **closed** | ❌ | 表示（締切表示） |

---

## 8.8 使用例

### 成功ケース

```bash
# 1. プロフィール完了確認
curl -X GET http://localhost:3000/api/staffs/me \
  -H "Authorization: Bearer <token>"

# 2. 予約登録
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": 10
  }'
```

**レスポンス** (201 Created):
```json
{
  "id": 123,
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "reservationTypeId": 1,
  "slotId": 10,
  "serviceDateLocal": "2025-12-15",
  "startMinuteOfDay": 540,
  "durationMinutes": 30,
  "periodKey": "FY2025",
  "canceledAt": null,
  "createdAt": "2025-11-03T10:00:00.000Z",
  "updatedAt": "2025-11-03T10:00:00.000Z"
}
```

---

### エラーケース例

#### プロフィール未完了

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "slotId": 10 }'
```

**レスポンス** (428 Precondition Required):
```json
{
  "statusCode": 428,
  "message": "Profile incomplete for reservation."
}
```

**対処**: プロフィールを完了させる（EMR患者ID、生年月日、PIN変更）

---

#### 年度1回制限違反

```bash
# 既にFY2025で予約済みの状態で再度予約
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "slotId": 15 }'
```

**レスポンス** (409 Conflict):
```json
{
  "statusCode": 409,
  "message": "Already reserved once in this fiscal year."
}
```

**対処**: 次年度（4月1日以降）まで待つ

---

#### 定員到達

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "slotId": 20 }'
```

**レスポンス** (409 Conflict):
```json
{
  "statusCode": 409,
  "message": "Reservation capacity has been reached."
}
```

**対処**: 別の予約枠を選択

---

## 8.9 トランザクション分離レベル

### READ COMMITTED（MySQL デフォルト）

予約処理では以下を使用：

- **悲観的ロック（FOR UPDATE）**: 定員管理
- **UNIQUE制約**: 年度1回制限・重複防止

**理由**: 楽観ロックだけでは定員超過を防げないため。

---

## 8.10 予約キャンセル

### 現状

**API未実装**（予約キャンセル機能なし）

### 運用回避策

管理者がDBから直接処理：

```sql
-- 方法1: 物理削除
DELETE FROM reservations WHERE id = 123;
UPDATE reservation_slots SET booked_count = booked_count - 1 WHERE id = 10;

-- 方法2: 論理削除
UPDATE reservations SET canceled_at = NOW() WHERE id = 123;
UPDATE reservation_slots SET booked_count = booked_count - 1 WHERE id = 10;
```

---

## 8.11 関連ドキュメント

- **[05-API-Overview.md](./05-API-Overview.md)** - API共通仕様
- **[06-Auth-API.md](./06-Auth-API.md)** - 認証API詳細
- **[07-Staff-API.md](./07-Staff-API.md)** - 職員API詳細（プロフィール完了手順）
- **[13-Business-Rules.md](./13-Business-Rules.md)** - 業務ルール（年度1回制限・定員管理）
- **[03-Data-Model.md](./03-Data-Model.md)** - データモデル（UNIQUE制約）

---

**最終更新**: 2025-11-03
**バージョン**: 1.0.0

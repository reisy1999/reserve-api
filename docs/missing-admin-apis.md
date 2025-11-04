# 管理者API 実装状況

**作成日**: 2025-11-04
**最終更新**: 2025-11-04
**対象**: 予約管理システム（reserve-api）

---

## 概要

このドキュメントは、管理者APIの実装状況を追跡します。
仕様書で「未実装」「API未実装」「運用回避策（DB直接操作）」と記載されていた機能のうち、
実装済み・未実装の状態を明記します。

**実装済み機能は ✅ でマーク**

---

## 1. スタッフ管理API

### 1.1 現状
- ✅ `POST /api/admin/staffs/import` - CSV一括登録のみ実装済み
- ❌ 個別のCRUD操作が**すべて未実装**

### 1.2 必要なAPI

| 優先度 | メソッド | エンドポイント | 説明 | 根拠 |
|--------|---------|---------------|------|------|
| **高** | `GET` | `/api/admin/staffs` | スタッフ一覧取得（検索・フィルタ機能付き） | 管理画面で必須 |
| **高** | `GET` | `/api/admin/staffs/:staffUid` | 特定スタッフの詳細取得 | 編集画面で必須 |
| **高** | `PATCH` | `/api/admin/staffs/:staffUid` | スタッフ情報更新 | 編集機能で必須 |
| **高** | `POST` | `/api/admin/staffs/:staffUid/reset-pin` | PIN初期化（0000に戻す） | 仕様書13.10.2「運用回避策」 |
| **高** | `POST` | `/api/admin/staffs/:staffUid/unlock` | PINロック解除 | 仕様書10-Authentication.md:273 |
| **中** | `DELETE` | `/api/admin/staffs/:staffUid` | スタッフ削除（論理削除） | 退職者管理 |
| **中** | `POST` | `/api/admin/staffs` | スタッフ個別作成 | CSV以外の登録方法 |

### 1.3 検索機能の要件

`GET /api/admin/staffs` には以下のクエリパラメータが必要：

```
GET /api/admin/staffs?
  search=山田          # 名前・職員ID部分一致
  &departmentId=ER     # 部署フィルタ
  &status=active       # ステータスフィルタ
  &page=1
  &limit=50
```

### 1.4 編集可能項目の制御

管理者によるスタッフ編集では、以下の項目のみ変更可能にすべき：

**編集可能**:
- `familyName`, `givenName` - 名前
- `familyNameKana`, `givenNameKana` - カナ
- `jobTitle` - 職種
- `departmentId` - 部署
- `status` - ステータス（active/suspended/left）
- `role` - ロール（STAFF/ADMIN）

**編集不可**:
- `staffId` - 職員ID（主キー相当）
- `staffUid` - UUID
- `emrPatientId` - 本人のみ変更可能
- `dateOfBirth`, `sexCode` - 本人のみ変更可能
- PINハッシュ関連 - 専用APIで操作

---

## 2. 部署管理API

### 2.1 現状
- ✅ **実装済み** (2025-11-04)
- CSV一括登録時に自動作成される機能に加え、管理者APIが実装されました

### 2.2 実装済みAPI

| 優先度 | メソッド | エンドポイント | 説明 | ステータス |
|--------|---------|---------------|------|-----------|
| **高** | `GET` | `/api/admin/departments` | 部署一覧取得（ページネーション、フィルタ、ソート） | ✅ 実装済み |
| **高** | `GET` | `/api/admin/departments/:id` | 部署詳細取得 | ✅ 実装済み |
| **高** | `GET` | `/api/departments` | 部署一覧取得（職員用・active-only） | ✅ 実装済み |

**クエリパラメータ** (GET /api/admin/departments):
- `limit` (default: 50, max: 100) - ページサイズ
- `page` (default: 1) - ページ番号
- `name` - 部署名部分一致検索（大文字小文字区別なし）
- `active` - 有効フラグフィルタ
- `sort` - ソート対象 (id/name/updatedAt)
- `order` - ソート順 (asc/desc)

**レスポンス形式**:
```json
{
  "data": [
    {
      "id": "ER",
      "name": "Emergency",
      "active": true,
      "createdAt": "2025-11-03T09:00:00.000Z",
      "updatedAt": "2025-11-03T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

### 2.3 未実装API

| 優先度 | メソッド | エンドポイント | 説明 | ステータス |
|--------|---------|---------------|------|-----------|
| **中** | `POST` | `/api/admin/departments` | 部署作成 | ❌ 未実装 |
| **中** | `PATCH` | `/api/admin/departments/:id` | 部署情報更新 | ❌ 未実装 |
| **低** | `DELETE` | `/api/admin/departments/:id` | 部署削除（論理削除） | ❌ 未実装 |

---

## 3. 予約管理API

### 3.1 現状
- ✅ `POST /api/reservations` - 予約登録のみ実装済み
- ❌ 一覧取得、キャンセル、変更が**すべて未実装**

### 3.2 必要なAPI

| 優先度 | メソッド | エンドポイント | 説明 | 根拠 |
|--------|---------|---------------|------|------|
| **高** | `GET` | `/api/admin/reservations` | 全予約一覧取得（管理者用） | 予約状況確認 |
| **高** | `DELETE` | `/api/admin/reservations/:id` | 予約キャンセル（管理者用） | 仕様書13.10.1「運用回避策」 |
| **中** | `GET` | `/api/reservations` | 自分の予約一覧取得（職員用） | マイページで必要 |
| **中** | `DELETE` | `/api/reservations/:id` | 予約キャンセル（職員用） | 仕様書01-Overview.md:143 |
| **低** | `GET` | `/api/admin/reservations/stats` | 予約統計情報 | ダッシュボード用 |

### 3.3 一覧取得の要件

```
GET /api/admin/reservations?
  staffId=900100          # 特定職員の予約
  &slotId=123             # 特定枠の予約
  &reservationTypeId=1    # 特定種別の予約
  &serviceDateFrom=2025-12-01
  &serviceDateTo=2025-12-31
  &status=active          # active/canceled
  &page=1
  &limit=50
```

### 3.4 キャンセル時の処理

```
DELETE /api/admin/reservations/:id
または
PATCH /api/admin/reservations/:id
{
  "canceled": true
}
```

**必要な処理**:
1. `canceled_at` を現在時刻に更新
2. `reservation_slots.booked_count` をデクリメント
3. トランザクション制御

---

## 4. 予約枠管理API

### 4.1 現状
- ✅ `POST /api/admin/slots/bulk` - 一括作成実装済み
- ✅ **部署割り当てAPI完全実装** (2025-11-04)
- ❌ 一覧取得、編集、削除、ステータス変更が未実装

### 4.2 実装済みAPI

| 優先度 | メソッド | エンドポイント | 説明 | ステータス |
|--------|---------|---------------|------|-----------|
| **高** | `POST` | `/api/admin/slots/bulk` | 予約枠一括作成 | ✅ 実装済み |
| **高** | `POST` | `/api/admin/slots/:id/departments` | 枠に部署を割り当て | ✅ 実装済み |
| **高** | `PATCH` | `/api/admin/slots/:slotId/departments/:deptId` | 部署割り当て更新 | ✅ 実装済み |
| **高** | `DELETE` | `/api/admin/slots/:slotId/departments/:deptId` | 部署割り当て削除（冪等） | ✅ 実装済み |

**部署割り当て機能**:
- `enabled` - 部署の利用可否フラグ
- `capacityOverride` - 部署別定員（nullの場合は枠全体の定員を使用）
- 冪等なDELETE操作（2回目以降も204を返す）
- 409エラー（重複割り当て時）

**リクエスト例** (POST /api/admin/slots/:id/departments):
```json
{
  "departmentId": "ER",
  "enabled": true,
  "capacityOverride": 5
}
```

### 4.3 未実装API

| 優先度 | メソッド | エンドポイント | 説明 | ステータス |
|--------|---------|---------------|------|-----------|
| **高** | `GET` | `/api/admin/slots` | 予約枠一覧取得 | ❌ 未実装 |
| **高** | `PATCH` | `/api/admin/slots/:id` | 予約枠更新（ステータス変更など） | ❌ 未実装 |
| **高** | `GET` | `/api/slots` | 予約可能枠一覧（職員用） | ❌ 未実装 |
| **中** | `DELETE` | `/api/admin/slots/:id` | 予約枠削除 | ❌ 未実装 |
| **中** | `GET` | `/api/admin/slots/:id` | 特定枠の詳細取得 | ❌ 未実装 |
| **低** | `POST` | `/api/admin/slots` | 予約枠個別作成 | ❌ 未実装 |

### 4.4 職員用一覧取得の要件（未実装）

```
GET /api/slots?
  reservationTypeId=1
  &serviceDateFrom=2025-12-01
  &serviceDateTo=2025-12-31
  &departmentId=ER        # ログイン職員の部署で自動フィルタ
```

**レスポンス要件**:
- `status=published` かつ受付期間内の枠のみ
- ログイン職員の `departmentId` で自動フィルタリング
- `reservation_slot_departments` で部署別アクセス制御

---

## 5. 予約種別管理API

### 5.1 現状
- ✅ **完全実装済み** (2025-11-04)
- 作成、一覧、詳細、更新、削除のすべてが実装されました

### 5.2 実装済みAPI

| 優先度 | メソッド | エンドポイント | 説明 | ステータス |
|--------|---------|---------------|------|-----------|
| **高** | `POST` | `/api/admin/reservation-types` | 予約種別作成 | ✅ 実装済み |
| **高** | `GET` | `/api/admin/reservation-types` | 一覧取得（ページネーション、フィルタ、ソート） | ✅ 実装済み |
| **高** | `GET` | `/api/admin/reservation-types/:id` | 特定種別の詳細取得 | ✅ 実装済み |
| **中** | `PATCH` | `/api/admin/reservation-types/:id` | 予約種別更新 | ✅ 実装済み |
| **低** | `DELETE` | `/api/admin/reservation-types/:id` | 予約種別削除（物理削除） | ✅ 実装済み |
| **高** | `GET` | `/api/reservation-types` | 一覧取得（職員用・active-only） | ✅ 実装済み |

**クエリパラメータ** (GET /api/admin/reservation-types):
- `limit` (default: 50, max: 100) - ページサイズ
- `page` (default: 1) - ページ番号
- `name` - 種別名部分一致検索（大文字小文字区別なし）
- `active` - 有効フラグフィルタ
- `sort` - ソート対象 (id/name/updatedAt)
- `order` - ソート順 (asc/desc)

**編集可能項目** (PATCH):
```json
{
  "name": "インフルエンザ予防接種（2025年度）",
  "description": "2025年度のインフルエンザ予防接種です",
  "active": false
}
```

---

## 6. システム運用・監視API

### 6.1 必要なAPI（将来的）

| 優先度 | メソッド | エンドポイント | 説明 |
|--------|---------|---------------|------|
| **低** | `GET` | `/api/admin/dashboard` | ダッシュボード統計情報 |
| **低** | `GET` | `/api/admin/audit-logs` | 監査ログ |
| **低** | `GET` | `/api/admin/health` | システムヘルスチェック |

---

## 7. 優先順位付け

### Phase 1（最優先・管理画面で必須）
1. **スタッフ管理**
   - `GET /api/admin/staffs` - 一覧
   - `GET /api/admin/staffs/:staffUid` - 詳細
   - `PATCH /api/admin/staffs/:staffUid` - 編集
   - `POST /api/admin/staffs/:staffUid/reset-pin` - PIN初期化
   - `POST /api/admin/staffs/:staffUid/unlock` - ロック解除

2. **部署管理**
   - `GET /api/admin/departments` - 一覧

3. **予約枠管理（職員用）**
   - `GET /api/slots` - 予約可能枠一覧

### Phase 2（重要・運用改善）
1. **予約管理**
   - `GET /api/admin/reservations` - 全予約一覧
   - `DELETE /api/admin/reservations/:id` - キャンセル
   - `GET /api/reservations` - 自分の予約一覧

2. **予約枠管理（管理者用）**
   - `GET /api/admin/slots` - 一覧
   - `PATCH /api/admin/slots/:id` - ステータス変更

### Phase 3（機能拡充）
- 部署のCRUD
- 予約種別の編集・削除
- スタッフ個別作成
- 統計情報・ダッシュボード

---

## 8. 実装時の注意点

### 8.1 認証・認可
すべて `X-Admin-Token` による管理者認証が必要

### 8.2 べき等性
更新・削除系は `Idempotency-Key` ヘッダーを推奨

### 8.3 外部キー制約
- スタッフ削除時: 予約が存在する場合は `409 Conflict`
- 部署削除時: 所属職員がいる場合は `409 Conflict`
- 予約枠削除時: 予約が存在する場合は `409 Conflict`

### 8.4 楽観ロック
編集系APIでは `version` フィールドによる楽観ロックを実装

### 8.5 ページネーション
一覧取得APIはページネーション必須（デフォルト: `limit=50`）

---

## 9. 関連ドキュメント

- **現在の仕様書**: `docs/api-spec/`
- **データモデル**: `docs/api-spec/03-Data-Model.md`
- **業務ルール**: `docs/api-spec/13-Business-Rules.md`
- **管理者API**: `docs/api-spec/09-Admin-API.md`

---

## 10. まとめ

### 実装状況（2025-11-04時点）

| カテゴリ | 実装済み | 未実装 | 合計 |
|---------|---------|--------|------|
| **部署管理** | 3 | 3 | 6 |
| **予約種別管理** | 6 | 0 | 6 |
| **予約枠管理** | 4 | 6 | 10 |
| **予約管理** | 1 | 6 | 7 |
| **スタッフ管理** | 1 | 10 | 11 |
| **合計** | **15** | **25** | **40** |

### 最近の実装（2025-11-04）

**✅ 実装完了**:
1. Admin Departments API（一覧・詳細） - ページネーション、フィルタ、ソート対応
2. Admin ReservationTypes API（完全CRUD） - 一覧、詳細、作成、更新、削除
3. Slot-Department関係管理（完全CRUD） - 部署割り当て機能
4. **合計15エンドポイント**が実装済み（基本APIを含む）

**テスト状況**:
- E2Eテスト: 68 passing
- Departments: 27 tests
- Slot-Departments: 6 tests
- ReservationTypes: 24 tests

### Phase 1（最優先）で残っている実装

1. **スタッフ管理API**（5エンドポイント）
   - GET /api/admin/staffs - 一覧
   - GET /api/admin/staffs/:staffUid - 詳細
   - PATCH /api/admin/staffs/:staffUid - 編集
   - POST /api/admin/staffs/:staffUid/reset-pin - PIN初期化
   - POST /api/admin/staffs/:staffUid/unlock - ロック解除

2. **予約枠管理（職員用）**（1エンドポイント）
   - GET /api/slots - 予約可能枠一覧

### 運用上の影響

**実装済みのため改善された作業**:
- ✅ 部署の確認・検索
- ✅ 予約種別の完全管理（CRUD）
- ✅ 予約枠への部署割り当て

**未実装のため運用回避が必要な作業**:
- ❌ スタッフのPIN初期化・ロック解除 → **DB直接操作**
- ❌ 予約のキャンセル → **DB直接操作**
- ❌ 予約枠のステータス変更 → **DB直接操作**
- ❌ スタッフ情報の修正 → **DB直接操作**

---

**最終更新**: 2025-11-04
**次回更新予定**: 次のPhase完了時

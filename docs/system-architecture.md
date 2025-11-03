# system-architecture.md（改訂版）

最終更新: 2025-11-03 (Asia/Tokyo)

## 目的

- 自己登録（事前登録なし）＋ **PIN(4桁)ログイン → JWT** による本人性の確立
- **枠（ReservationSlot）制** で予約の重複・定員管理を単純化
- **年度1回制** 等の業務制約は DB 制約＋Txで強固に

---

## ディレクトリ構成（NestJS）

```

src/
├─ main.ts
├─ app.module.ts
├─ app.controller.ts
├─ app.service.ts
│
├─ auth/
│  ├─ auth.controller.ts           # /auth/login, /auth/refresh, /auth/logout
│  ├─ auth.service.ts
│  ├─ jwt.strategy.ts               # Access Token 検証
│  ├─ refresh.strategy.ts           # Refresh Token 検証
│  ├─ entities/
│  │   └─ refresh-session.entity.ts # Refresh Token をDB管理
│  ├─ dto/
│  │   ├─ login.dto.ts
│  │   └─ refresh-token.dto.ts
│  └─ auth.module.ts
│
├─ staff/
│  ├─ dto/
│  │   ├─ register-staff.dto.ts     # 自己登録（pin 平文→サーバで Argon2id + Pepper）
│  │   ├─ update-staff.dto.ts
│  │   └─ change-pin.dto.ts         # 初回・任意のPIN変更
│  ├─ entities/
│  │   └─ staff.entity.ts           # PK: staffUid(uuid), staffIdは業務キー
│  ├─ staff.controller.ts           # /api/staffs（自己登録・自分のプロフィール閲覧/更新）
│  ├─ staff.service.ts
│  └─ staff.module.ts
│
├─ departments/
│  ├─ entities/
│  │   └─ department.entity.ts
│  ├─ departments.controller.ts     # /api/departments（一覧）
│  ├─ departments.service.ts
│  └─ departments.module.ts
│
├─ reservation-types/
│  ├─ entities/
│  │   └─ reservation-type.entity.ts
│  ├─ reservation-types.controller.ts   # /api/admin/reservation-types/*
│  ├─ reservation-types.service.ts
│  └─ reservation-types.module.ts
│
├─ slots/
│  ├─ dto/
│  │   ├─ create-slot.dto.ts
│  │   └─ bulk-create-slots.dto.ts
│  ├─ entities/
│  │   └─ reservation-slot.entity.ts
│  ├─ slots.controller.ts            # /api/slots（公開GET） /api/admin/slots（管理）
│  ├─ slots.service.ts
│  └─ slots.module.ts
│
├─ reservations/
│  ├─ dto/
│  │   ├─ create-reservation.dto.ts  # { slotId } のみ
│  │   └─ update-reservation.dto.ts
│  ├─ entities/
│  │   └─ reservation.entity.ts      # staffUid(FK) + 冗長 staffId
│  ├─ reservations.controller.ts     # /api/reservations（要JWT）
│  ├─ reservations.service.ts
│  └─ reservations.module.ts
│
├─ admin/                            # ★ 管理API（薄いガード）
│  ├─ admin.controller.ts            # /api/admin/*（集計・強制操作）
│  ├─ admin.service.ts
│  └─ admin.module.ts
│
├─ common/
│  ├─ guards/
│  │   ├─ admin-token.guard.ts       # ★ X-Admin-Token 検証（env: ADMIN_TOKEN）
│  │   └─ jwt-auth.guard.ts          # Access Token 必須
│  ├─ filters/
│  ├─ interceptors/
│  └─ pipes/
│
├─ config/
│  ├─ app.config.ts
│  ├─ database.config.ts
│  └─ security.config.ts             # Helmet/CORS/RateLimit 設定
│
├─ static-admin/                     # 管理UIを配信するなら（任意）
│  └─ index.html                     # ServeStaticModule で /admin にマウント
│
├─ typeorm/
│  ├─ data-source.ts
│  └─ migrations/
│      └─ 1700000000000-init.ts
│
└─ utils/
└─ date.ts                        # periodKey 算出（FY=4/1境界）
test/
└─ reservations.e2e-spec.ts

```

---

## 役割とアクセス方針

- **CSV取り込み（管理者）**：`POST /api/admin/staffs/import?dryRun=true|false`
  - ヘッダ必須: `名前(漢字)`, `本部ID(staffId)`, `部署(コード)`, `職種`。不要列は破棄。
  - `dryRun=true` は検証のみ。`dryRun=false` は合格行のみ作成し、`importBatchId` を払い出す。既存 `staffId` は `skippedExisting`。同一ファイル内重複は双方 `duplicateInFile`。`Idempotency-Key` で重送排除。
  - レスポンス: `summary`（`created`, `skippedExisting`, `skippedInvalid`, `duplicateInFile`, `warnings`）と `rows[]`（行番号, 入力値, 処理結果, 理由）。
- **自己登録/本人完了**：`POST /api/staffs/register`
  - 入力: `staffId, familyName, givenName, jobTitle, departmentId, dateOfBirth, sexCode, pin`（Kana/`emrPatientId` は任意）。
  - サーバ: `staffUid(uuid)` 生成。PIN=`0000` を **Argon2id + Pepper** でハッシュ保存し `pinMustChange=true`。`staffId` は数字チェック＆UNIQUE。
- **認証**：`POST /auth/login`（`staffId + pin` → JWT発行）, `POST /auth/refresh`, `POST /auth/logout`
- **PIN変更**：`POST /api/staffs/me/pin`（旧PIN＋新PIN）。`pinMustChange=true` の職員はここを通過するまで業務 API を 428 等で拒否。
- **本人プロフィール更新**：`PATCH /api/staffs/me`（`version` と現 PIN（センシティブ項目時）必須）。`emrPatientId`/`dateOfBirth`/`sexCode` を揃えて初回完了とし、成功時に `version++`。
- **管理者更新**：`PATCH /api/admin/staffs/:staffUid`（理由必須）。`staffId` / `emrPatientId` 変更時は RefreshSession を全失効。
- **PIN解除（管理）**：`POST /api/admin/staffs/:staffUid/pin/unlock`（`pinRetryCount=0`, `pinLockedUntil=null`, `pinMustChange=true`）。
- **一般API（要JWT）**：`/api/reservations/*`, `/api/slots`（GETは公開/STAFF限定いずれか運用）
- **管理API（要 AdminTokenGuard）**：`/api/admin/*`（枠一括作成/公開・集計・強制キャンセル 等）
- **管理UI**：`/admin`（ServeStatic）。フロント判定は信用せず、APIガードで防御。
- **予約ガード**：`pinMustChange=false` かつ `emrPatientId/dateOfBirth/sexCode` 登録済み、`status='active'` の職員のみ `/api/reservations` にアクセス可。

---

## ガード / セキュリティ

- `JwtAuthGuard`：`/api/*` の保護（ログイン後のみ操作可）。
  - 予約作成は `{ slotId }` だけ受け、JWT 内の `staffUid` から職員を解決。
- `AdminTokenGuard`：`/api/admin/*` を `X-Admin-Token` で防御（最小運用）。
  - 将来は `role=ADMIN` をJWTに統合し、`RolesGuard` に置換可能。
- PIN ハッシュは **Argon2id + Pepper (`SECURITY_PIN_PEPPER`)**。`pinVersion` でパラメータを管理。
- 失敗時のロック：`pinRetryCount` を加算し **5回でロック**。`pinLockedUntil` に非 `null` をセットし、管理者が `pinLockedUntil=null` / `pinRetryCount=0` に戻すまで拒否。
- `pinMustChange=true` の職員は PIN 変更完了まで業務 API を 428 などで拒否。
- Refresh Token は **RefreshSession** テーブルで管理し、ローテーション運用。再利用検知で全セッション失効。`staffId` / `emrPatientId` を変更した際は当該職員のセッションを全失効。
- Staff プロフィールは `version` による楽観ロックで競合を防止。`If-Match` と同等の挙動。
- Staff の削除は行わず `status='left'` 等へ遷移。ログイン不可・予約不可に制御。
- Helmet / CORS / RateLimit を `security.config.ts` で集中管理。

---

## 二段階登録と本人完了

1. 管理者が `POST /api/admin/staffs/import?dryRun=true|false` を実行し、dryRun で検証→apply で作成。`Idempotency-Key` で再送吸収。レスポンスの `summary` と `rows[]` を監査保管する。
2. 本人は初回ログイン時に PIN=`0000` で認証されるが `pinMustChange=true` のため業務APIは拒否。`POST /api/staffs/me/pin` で新PINへ更新する。
3. `PATCH /api/staffs/me` で `emrPatientId` / `dateOfBirth` / `sexCode` / カナなど不足情報を登録。`version` を必須とし、センシティブな変更時は現PINを再入力する。
4. 予約APIは `pinMustChange=false` かつ必須項目完了かつ `status='active'` のときのみ許可する。未完了時は 428 を返す。

---

## 主要ユースケース（I/O概要）

- **予約作成（STAFF / 要JWT）**  
  `POST /api/reservations`  
  入力: `{ "slotId": number }`  
  処理順: JWT→`staffUid` 解決 → 枠状態（`status='published'` & `bookingStart=null` は即時受付 / `bookingEnd=null` は無期限 / 両方nullは常時受付） → 年度1回制（`UNIQUE(staffId,reservationTypeId,periodKey)`） → **Txで `bookedCount++` と予約挿入** → 返却
  - `UNIQUE(slotId, staffId)` に違反する重複申込は 409。
- **予約参照**  
  `GET /api/reservations/me`（自分の予約一覧）
- **予約変更/削除**  
  `PATCH|DELETE /api/reservations/:id`（所有者のみ）
- **枠（管理）**  
  `POST /api/admin/slots/bulk`（日付範囲×時間割×定員） / `PATCH /api/admin/slots/:id/publish|close`
- **集計（管理）**  
  `GET /api/admin/reservations?from=&to=&type=`

---

## periodKey（年度キー）/ 時間表現

- **年度境界**：毎年 4/1 00:00
- **保存**：`Reservation.periodKey` は **入力不可・NOT NULL**（サーバが算出）
- **時間**：`serviceDateLocal` + `startMinuteOfDay(0–1439)` + `durationMinutes`（UTC変換はAPI側で必要時のみ）

---

## .env（最小）

```
ADMIN_TOKEN=長くてランダムな文字列
JWT_SECRET=ランダム32+ bytes 等
JWT_EXPIRES_IN=900s             # 例: 15分
REFRESH_SECRET=別のランダム値
REFRESH_EXPIRES_IN=30d
REFRESH_ROTATE=true
SECURITY_PIN_PEPPER=base64で十分長いランダム値
APP_PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

---

## 非機能 / 運用

- **監査ログ（AuditLog）**：`LOGIN_SUCCESS/FAIL`, `RESERVE_CREATE/UPDATE/CANCEL`, `SLOT_PUBLISH/CLOSE`, 管理者の `staffId` / `emrPatientId` 変更（旧→新・理由）を記録
- **レート制限**：`/auth/login` と 予約POST を強化
- **冪等**：予約POSTは `Idempotency-Key` を受理
- **テスト**：E2E は `JwtAuthGuard` 有効時の正常/異常系（重複・年度1回制・満席）を優先
- **Secrets 管理**：`SECURITY_PIN_PEPPER` / `JWT_SECRET` / `REFRESH_SECRET` は Secret Manager 等で集中管理し、ログ出力禁止。
- **DB マイグレーション**：開発初期は `synchronize=true` で制約検証 → 固定後に `synchronize=false` + TypeORM Migration 化。`staffUid` 追加 → 予約/セッション FK を `staffUid` 化 → `staffId` UNIQUE 制約の順で移行。Department / ReservationType はシード Migration で投入。

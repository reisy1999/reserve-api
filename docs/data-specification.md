# data-specification.md（改訂版）

最終更新: 2025-11-03 (Asia/Tokyo)

---

## 1. 背景と目的

- **対象**: 職員向け予約（例：インフルワクチン、職員健診 など）。
- **目的**: データモデルと入力契約を明確化し、自己登録（事前登録なし）＋JWT運用＋枠（Slot）制の要件を堅牢に満たす。
- **方針**:
  - **本人性の起点**は `staffId (数字のみ・一意)` ＋ **PIN(4桁)**。以後の予約操作は **JWT** に一本化（クライアントは `staffId` を送らない）。
  - **氏名**は姓/名＋カナで**正規化**保存。`fullName`／`fullNameKana` は**派生値**（APIで連結返却）。
  - **emrPatientId** は**必須**、**数字のみ**、**一意**。
  - 性別は内部 `sexCode`（'1' | '2'）を使用。フロントは男女2択。外部連携時は ISO 5218 へマップ可能。
  - 予約は**枠（ReservationSlot）に対する申込み**。年度1回制は `staffUid + reservationTypeId + periodKey` の一意制約で担保。

---

## 2. 用語

- **JWT**: ログイン成功時に発行されるアクセストークン／リフレッシュトークン。
- **PIN**: 数字4桁の秘密値。DBには**ハッシュ**で保存（塩＋ペッパー）。
- **FY（periodKey）**: 年度（境界=毎年4/1）に対応するキー。年度1回制に使用。
- **1440分方式**: 日付＋分（0–1439）で時刻を保持。

### 2.1 二段階登録フロー

- フロー: `管理者CSVアップロード → 取り込み検証(dryRun/apply) → 本人初回ログイン(PIN=0000, pinMustChange=true) → プロフィール必須項目完了(emrPatientId/dateOfBirth/sexCode/pin)` とする。
- 管理者CSV必須列: `名前(漢字)`, `本部ID(staffId)`, `部署(コード)`, `職種`。
- 管理者CSVで無視する列: `役職`, `部会`, `部会管理`, `機種`, `入職日`, `ログイン時刻`, `ロック`, `電話登録`, `Email`, `管理者ロール`, `ユーザー権限`, `設定`。
- `POST /api/admin/staffs/import?dryRun=true|false` は `Idempotency-Key` を受理し、レスポンスで `summary`（`created`, `skippedExisting`, `skippedInvalid`, `duplicateInFile`, `warnings`）と `rows[]`（行番号, 入力値, 処理結果, 理由）および `importBatchId`（apply時のみ）を返す。
- 既存 `staffId` は作成しない（`skippedExisting`）。同一ファイル内で重複する `staffId` は両行とも `duplicateInFile`。検証エラーは `skippedInvalid` に分類する。

---

## 3. エンティティ定義

### 3.1 Staff（職員アカウント：**真実の源泉**）

| フィールド名     | 型 / 例                             | 必須 | 仕様・制約                                                  |
| ---------------- | ----------------------------------- | ---: | ----------------------------------------------------------- |
| `staffUid`       | `uuid` / `"7f3c...`                |  Yes | **PK**（内部不変キー）。自己生成し変更不可                 |
| `staffId`        | `string` / `"446752"`               |  Yes | **数字のみ**（`^[0-9]+$`）、**UNIQUE**、業務識別子。管理者のみ変更可 |
| `emrPatientId`   | `string \| null`                    |   No | **数字のみ**（`^[0-9]+$`）。初回プロフィール完了時に必須・UNIQUE |
| `familyName`     | `string` / `山田`                   |  Yes | 姓                                                          |
| `givenName`      | `string` / `太郎`                   |  Yes | 名                                                          |
| `familyNameKana` | `string \| null`                    |   No | 全角カナ（長音・中点は運用規約に従う）                      |
| `givenNameKana`  | `string \| null`                    |   No | 全角カナ                                                    |
| `jobTitle`       | `string` / `看護師`                 |  Yes | **自由入力**（当面マスタ化しない）                          |
| `departmentId`   | `string` / `REHA`                   |  Yes | **FK → Department.id**                                      |
| `dateOfBirth`    | `string` / `YYYY-MM-DD`             |  Yes | 厳格日付、未来日不可                                        |
| `sexCode`        | `'1' \| '2'`                        |  Yes | 1=男, 2=女。外部連携時は ISO 5218 へマップ可                |
| `pinHash`        | `string`                            |  Yes | **PIN(4桁)のハッシュ**のみ保存（塩＋ペッパー）。平文PIN不可 |
| `pinRetryCount`  | `number`                            |  Yes | 既定0。5回でロック                                          |
| `pinLockedUntil` | `datetime \| null`                  |   No | 連続失敗時の手動解除時刻（`null`=ロックなし）               |
| `pinUpdatedAt`   | `datetime`                          |  Yes | 最終更新                                                    |
| `pinVersion`     | `number`                            |  Yes | ハッシュ方式更新に備える                                    |
| `pinMustChange`  | `boolean`                           |  Yes | `true` の間は PIN 変更が必須（予約API等は 428 で拒否）      |
| `version`        | `number`                            |  Yes | プロフィール更新用の楽観ロック（`If-Match` 相当）           |
| `status`         | `'active' \| 'suspended' \| 'left'` |  Yes | 稼働状態                                                    |
| `role`           | `'STAFF' \| 'ADMIN'`                |  Yes | 権限                                                        |
| `lastLoginAt`    | `datetime \| null`                  |   No | 直近ログイン                                                |
| `createdAt`      | `datetime`                          |  Yes | 監査                                                        |
| `updatedAt`      | `datetime`                          |  Yes | 監査                                                        |

**主キー**

- `staffUid (uuid)`（内部不変キー）

**インデックス**

- `staffId (unique)`、`emrPatientId (unique)`、`departmentId`
- （任意）`familyNameKana`（五十音検索強化時）

> **派生値（DBに保持しない推奨）**: `fullName = familyName + givenName`、`fullNameKana = familyNameKana + givenNameKana`

---

### 3.2 Department（部署マスタ）

| フィールド名 | 型 / 例                        | 必須 | 仕様・制約               |
| ------------ | ------------------------------ | ---: | ------------------------ |
| `id`         | `string` / `3A`, `REHA`, `DOC` |  Yes | **PK**（人間可読コード） |
| `name`       | `string` / `3階A病棟`          |  Yes | 表示名                   |
| `active`     | `boolean`                      |  Yes | 無効化可                 |
| `createdAt`  | `datetime`                     |  Yes | 監査                     |
| `updatedAt`  | `datetime`                     |  Yes | 監査                     |

---

### 3.3 ReservationType（予約種別マスタ）

最小定義（既存方針を踏襲）:
| フィールド名 | 型 | 必須 | 仕様 |
|---|---|---:|---|
| `id` | `number` | Yes | PK |
| `name` | `string` | Yes | 名称 |
| `description` | `string` | No | 説明 |
| `active` | `boolean` | Yes | 利用可否 |

---

### 3.4 ReservationSlot（**枠**）

| フィールド名              | 型                                   | 必須 | 仕様・制約               |
| ------------------------- | ------------------------------------ | ---: | ------------------------ |
| `id`                      | `number`                             |  Yes | PK                       |
| `reservationTypeId`       | `number`                             |  Yes | **FK → ReservationType** |
| `serviceDateLocal`        | `string(YYYY-MM-DD)`                 |  Yes | カレンダー日付           |
| `startMinuteOfDay`        | `number(0–1439)`                     |  Yes | 1日の開始からの分        |
| `durationMinutes`         | `number`                             |  Yes | 枠長（分）               |
| `capacity`                | `number`                             |  Yes | 定員                     |
| `bookedCount`             | `number`                             |  Yes | 予約済み数（Txで整合）   |
| `status`                  | `'draft' \| 'published' \| 'closed'` |  Yes | 公開状態                 |
| `bookingStart`            | `datetime \| null`                   |   No | 受付開始                 |
| `bookingEnd`              | `datetime \| null`                   |   No | 受付締切                 |
| `notes`                   | `string`                             |   No | 備考                     |
| `createdAt` / `updatedAt` | `datetime`                           |  Yes | 監査                     |

**索引例**: `(serviceDateLocal, startMinuteOfDay)`, `reservationTypeId`

**受付判定**

- `status='draft'` / `'closed'` は予約不可。
- `status='published'` かつ `bookingStart` ≤ 現在時刻 ≤ `bookingEnd` を満たすとき受付可。`bookingStart=null` は「公開時点から受付可」、`bookingEnd=null` は「締切なし」、両方 `null` は常時受付（公開ステータスが前提）。

---

### 3.5 Reservation（予約）

| フィールド名              | 型                   | 必須 | 仕様・制約                                 |
| ------------------------- | -------------------- | ---: | ------------------------------------------ |
| `id`                      | `number`             |  Yes | PK                                         |
| `staffUid`                | `uuid`               |  Yes | **FK → Staff.staffUid**（不変キーを参照）  |
| `staffId`                 | `string`             |  Yes | 冗長保持（検索用途）。管理者変更で同期    |
| `reservationTypeId`       | `number`             |  Yes | **FK → ReservationType**（枠の種別と一致） |
| `slotId`                  | `number`             |  Yes | **FK → ReservationSlot**                   |
| `serviceDateLocal`        | `string(YYYY-MM-DD)` |  Yes | **枠からの冗長保持**（検索高速化）         |
| `startMinuteOfDay`        | `number`             |  Yes | 同上（冗長保持）                           |
| `durationMinutes`         | `number`             |  Yes | 同上（冗長保持）                           |
| `periodKey`               | `string`             |  Yes | **NOT NULL**（FYキー：4/1境界で算出）      |
| `createdAt` / `updatedAt` | `datetime`           |  Yes | 監査                                       |
| `canceledAt`              | `datetime \| null`   |   No | キャンセル時刻                             |

**一意制約**

- **年度1回制**：`UNIQUE (staffId, reservationTypeId, periodKey)`
- **枠内重複禁止**：`UNIQUE (slotId, staffId)`

**整合ルール**

- `reservationTypeId` は `slot.reservationTypeId` と一致必須（アプリ層でも検証）。
- 予約作成は **Tx** で `bookedCount++` と挿入を同時確定。競合は 409。
- 受付判定順序：
  1. `slot.status === 'published'`
  2. `bookingStart` / `bookingEnd` による制約（`null` は「制約なし」）
  3. `capacity > bookedCount`
  4. 年度1回制ユニーク制約

---

### 3.6 RefreshSession（リフレッシュトークンセッション）

| フィールド名              | 型                   | 必須 | 仕様・制約                                               |
| ------------------------- | -------------------- | ---: | -------------------------------------------------------- |
| `id`                      | `number`             |  Yes | PK                                                       |
| `staffUid`                | `uuid`               |  Yes | **FK → Staff.staffUid**（不変キー）                       |
| `staffIdSnapshot`         | `string`             |   No | 変更履歴追跡用に当時の業務IDを冗長保持                   |
| `refreshTokenHash`        | `string`             |  Yes | Argon2 等でハッシュ化したリフレッシュトークン            |
| `expiresAt`               | `datetime`           |  Yes | 失効日時                                                 |
| `revokedAt`               | `datetime \| null`   |   No | ログアウト/再発行で即時セット                            |
| `lastUsedAt`              | `datetime \| null`   |   No | `/auth/refresh` 成功時に更新                             |
| `userAgent`               | `string \| null`     |   No | クライアント情報                                         |
| `ipAddress`               | `string \| null`     |   No | IP アドレス                                              |
| `createdAt` / `updatedAt` | `datetime`           |  Yes | 監査                                                     |

**運用ルール**

- `/auth/refresh` が成功すると新しいセッションを作成し、旧セッションは `revokedAt` を即時セット（ローテーション）。
- 失効済みトークンの再利用を検知した場合は該当職員の全セッションを失効し、警戒ログを発行。
- `staffId`/`emrPatientId` を管理者が変更した場合は紐づく RefreshSession を全失効し再ログインを強制。

---

## 4. 入出力契約（自己登録・認証・予約）

### 4.1 自己登録 DTO（**初回登録で必須**）

> クライアントは以下を送信。サーバで検証・正規化し、`pin` をハッシュ化して保存（`pinHash`）。

必須:

- `staffId`（数字のみ）
- `familyName`, `givenName`
- `jobTitle`
- `departmentId`
- `dateOfBirth`（`YYYY-MM-DD`）
- `sexCode`（'1' \| '2'）
- `pin`（**数字4桁固定**）→ **保存は `pinHash` のみ**

任意（初回ログイン後に補完必須）:

- `emrPatientId`（数字のみ）
- `familyNameKana`, `givenNameKana`

**バリデーション**:

- `staffId`: `^[0-9]+$`、DB側でも **UNIQUE**
- `emrPatientId`: `^[0-9]+$`。初回プロフィール完了まで `null` 許容だが完了時に UNIQUE チェックする。
- `familyName*`, `givenName*`: 空白・機種依存・サロゲート等の扱いは院内規約に従う
- `familyNameKana`, `givenNameKana`: 全角カナ。長音・中点は許可（院内規約に従う）
- `dateOfBirth`: 厳密に `YYYY-MM-DD`、未来日不可
- `sexCode`: `'1' \| '2'`
- `pin`: `^[0-9]{4}$`（4桁固定）
- 初期配布運用: 新規登録／再発行時は `pinMustChange=true` とし、既定 PIN `"0000"` を通知。初回ログインで必ず新PINへ変更させる（自己登録で入力された PIN も強制変更対象）。

> **セキュリティ**: `pin`（平文）はログに出さない。送信経路はHTTPS限定。ハッシュは塩＋ペッパーで保存。JWT payload／予約／セッション等の内部識別には `staffUid` を使用し、`staffId` は業務表示・検索用の UNIQUE キー（管理者のみ変更可）として扱う。

---

### 4.2 認証（最小）

- `POST /auth/login`: `staffId` + `pin` → 成功で **access token**（短命）＋**refresh token**（長命）。
- ログイン失敗は `pinRetryCount` を加算。**5回でロック**し、管理者が解除するまで拒否（`pinLockedUntil` で管理）。
- `POST /auth/refresh`: refresh → access 再発行。
- 監査: 成功/失敗を **AuditLog** へ（`actorType=STAFF`）。

#### 4.2.1 PIN ハッシュとロック

- ハッシュ方式: **Argon2id**（`timeCost=3`, `memoryCost=64*1024`, `parallelism=1` を目安）。
- Pepper: `SECURITY_PIN_PEPPER`（base64 推奨）を環境変数から取得し、ハッシュ前に付与。
- `pinVersion` でハッシュパラメータのバージョン管理を行い、将来の再ハッシュに備える。
- ログイン失敗ごとに `pinRetryCount++`。5回到達でロックし、`pinLockedUntil` に解除予定時刻や管理メモ日時をセット（`null` 以外 = ロック中）。管理操作で `pinLockedUntil=null` / `pinRetryCount=0` に戻すまで拒否。
- `pinMustChange=true` の職員は、PIN変更 API 完了まで予約などの業務 API を拒否（HTTP 428 など）。

#### 4.2.2 Refresh Token（DB ローテーション）

- リフレッシュトークンは **RefreshSession** テーブルで管理し、発行時はハッシュ（Argon2 など）を保存。
- `/auth/refresh` 成功時に新セッションを発行し、旧セッションの `revokedAt` を即時セット（ワンタイム利用）。
- 失効済みトークンの再利用は「窃取の疑い」として、対象職員のセッションを全失効し監査ログへ。
- 関連環境変数: `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_SECRET`, `REFRESH_EXPIRES_IN`, `REFRESH_ROTATE=true`。
- JWT Payload は `staffUid` を主体識別子として保持し、以後の API 判定は `staffUid` を利用（表示用途に限り `staffId` も返却）。

---

### 4.3 予約API（原則）

- **作成**: `POST /api/reservations`  
  入力: `{ slotId }` のみ。`staffUid` は **JWT からサーバが解決**。  
  チェック: 枠公開・受付期間・空席・年度1回制 → **Tx確定**。競合は 409。
- **参照**: `GET /api/reservations/me`（自分の予約のみ）
- **変更/削除**: `PATCH/DELETE /api/reservations/:id`（**所有者のみ**）

---

### 4.4 Staff プロフィール更新ポリシー

| 項目                              | 本人（JWT）        | 管理者（AdminToken） | 備考                                                         |
| --------------------------------- | ------------------ | -------------------- | ------------------------------------------------------------ |
| `staffId`（数字・一意）           | ✗                  | ○                    | 数字チェック＋重複検証必須。変更時は理由と監査ログを記録し、RefreshSession を全失効。 |
| `emrPatientId`（数字・一意）      | ✗                  | ○                    | `staffId` と同様に誤登録リスクが大きいため管理者のみ。       |
| `familyName` / `givenName`        | ○                  | ○                    | 正規化・トリム。本人更新時は現 PIN の再入力が必要。          |
| `familyNameKana` / `givenNameKana`| ○                  | ○                    | 全角カナ検証。                                               |
| `jobTitle`                        | ○                  | ○                    | 自由入力。                                                   |
| `departmentId`                    | ○                  | ○                    | FK 存在チェック。                                            |
| `dateOfBirth`                     | ○                  | ○                    | 厳格日付・未来日不可。                                       |
| `sexCode` (`'1' \| '2'`)          | ○                  | ○                    | UI は男女 2 択。                                             |
| `pin`（4桁）                      | ○（現 PIN 再入力） | ○                    | 本人変更は `/api/staffs/pin/change` で `pinMustChange` を解除。 |
| `status` (`active/suspended/left`)| ✗                  | ○                    | 離職処理は `status='left'`。物理削除は行わない。             |
| `role` (`STAFF/ADMIN`)            | ✗                  | ○                    | RBAC 運用。                                                  |

- 本人更新は `PATCH /api/staffs/me`（入力: 変更フィールド＋`version`＋必要に応じて現 PIN）。
- 管理者更新は `PATCH /api/admin/staffs/:staffUid`（入力: 任意フィールド＋理由）。`staffId` / `emrPatientId` を変更した場合は RefreshSession を全失効。
- 両 API とも `version`（楽観ロック）を必須とし、ミスマッチ時は 409 を返す。
- 変更内容は監査ログ（旧値→新値、理由、操作者）へ保存する。
- `status='left'` の職員はログイン・予約不可。監査・予約整合維持のため物理削除は行わない。

---

### 4.5 予約ガード条件（本人向け）

- 条件: JWT が有効で `pinMustChange=false`。
- プロフィール必須項目（`emrPatientId`, `dateOfBirth`, `sexCode`）がすべて登録済みであること。欠落時は 428 を返す。
- `status='active'` の職員のみ予約 API を許可する（`suspended/left` は 403 または同等で拒否）。

---

## 5. periodKey（FY）と時間表現

- **年度境界**: 毎年 **4/1 00:00**。
- **算出**: `periodKey = FYyyyy` など（例: `FY2025`）。
- **保存**: `Reservation.periodKey` は**入力不可**・**必須**。サーバが算出して保存。
- **時間**: 1440分方式（`serviceDateLocal` + `startMinuteOfDay` + `durationMinutes`）。UTCへの変換はAPI層で必要時のみ。

---

## 6. 監査・レート制限・冪等

- **AuditLog**: `LOGIN_SUCCESS/FAIL`, `RESERVE_CREATE/UPDATE/CANCEL`, `SLOT_PUBLISH/CLOSE` 等を `who/what/when` で記録。
- **レート制限**: `/auth/login` と予約POSTにIP/Staff単位の制限を推奨。
- **冪等**: 予約POSTは `Idempotency-Key` を受理（同一キーの重送は同一結果）。

---

## 7. 非機能（抜粋）

- **管理系API**: `/api/admin/*` は **Adminトークン**で保護（将来RBAC/JWT統合可）。
- **移行**: 既存データにはFY算出で `periodKey` を埋め、`NOT NULL` 化。`slotId` 追加時は暫定枠で対応。
- **可観測性**: 最初はstdoutログで十分。後でテーブル化（AuditLog）およびダッシュボード化。
- **PIN 運用**: 解除 API と PIN 強制変更（`pinMustChange`）の手順を標準化。再利用検知ログは SOC に連携。
- **秘密情報管理**: `SECURITY_PIN_PEPPER`, `JWT_SECRET`, `REFRESH_SECRET` などは Secrets 基盤で管理し、ログ・ダンプへの出力は禁止。
- **削除ポリシー**: Staff は物理削除せず `status` 遷移で運用（`left` 等）。必要に応じ個人情報はマスキングで対応を検討。

---

## 付録 B: TDD 受け入れ観点

### P0

- 管理者CSV取り込み: 既存 `staffId` は `skippedExisting`。非数字・部署未登録・重複は `rows[].reason` へ記録し `skippedInvalid`。同一ファイル内で同じ `staffId` が複数出現した場合は該当行すべて `duplicateInFile`。
- 初回ログイン: PIN=`0000` で `pinMustChange=true`。新PIN登録後に解除される。
- プロフィール未完了（`emrPatientId` or `dateOfBirth` or `sexCode` 未設定）で予約POSTすると 428。
- JWT 認証済みかつ `pinMustChange=false` で、公開枠・空席ありの場合のみ予約作成成功。
- 年度1回制: `UNIQUE(staffId, reservationTypeId, periodKey)` に違反すると 409。
- 枠内重複禁止: `UNIQUE(slotId, staffId)` に違反すると 409。
- 予約作成はトランザクションで `bookedCount++` と予約挿入を同時確定し、競合時は 409。

### P1

- 本人プロフィール更新 (`PATCH /api/staffs/me`) は `version` ミスマッチで 409。成功時は `version` がインクリメントされる。
- 管理者による `staffId` / `emrPatientId` 変更は理由必須。変更後に RefreshSession 全失効と監査ログ（旧→新＋理由）が作成される。

---

## 付録 A: ISO 5218 マッピング指針（参考）

| 内部 `sexCode` | ISO 5218 | 意味 |
| -------------: | -------: | ---- |
|            '1' |        1 | 男   |
|            '2' |        2 | 女   |

> 必要に応じ `0: 不明`, `9: 適用不能` へ拡張可能だが、当面は内部2択で運用し、外部連携時にのみマップ。

```

```

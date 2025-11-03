# 04. エンティティ仕様

本章では reserve-api が扱う主要テーブルのスキーマを定義する。すべて MySQL 8.0 を対象とし、文字コードは `utf8mb4`, タイムゾーンは `+09:00` を採用する。

---

## 4.1 共通カラム規約

| カラム          | 型         | 備考                                           |
| --------------- | ---------- | ---------------------------------------------- |
| `created_at`    | `datetime` | 自動設定 (`@CreateDateColumn`)                 |
| `updated_at`    | `datetime` | 自動更新 (`@UpdateDateColumn`)                |
| `*_id`          | `varchar` or `int` | 主キー or 外部キーに利用                   |
| `*_uid`         | `uuid`     | グローバル一意識別。                           |
| `*_hash`        | `varchar`  | ハッシュ済データ (PIN など)。                  |

---

## 4.2 `staffs` テーブル

| カラム名              | 型・制約                                 | 説明                                         |
| --------------------- | ---------------------------------------- | -------------------------------------------- |
| `staff_uid`           | `uuid`, PK                               | 職員の一意 ID。                              |
| `staff_id`            | `varchar(255)`, UNIQUE                   | 事務局から割当済の職員 ID (数字文字列)。    |
| `emr_patient_id`      | `varchar(255)`, UNIQUE, nullable         | EMR 連携用 ID。                              |
| `family_name`         | `varchar(255)`                           | 姓                                           |
| `given_name`          | `varchar(255)`                           | 名                                           |
| `family_name_kana`    | `varchar(255)`, nullable                 | 姓（カナ）                                   |
| `given_name_kana`     | `varchar(255)`, nullable                 | 名（カナ）                                   |
| `job_title`           | `varchar(255)`                           | 役職                                         |
| `department_id`       | `varchar(100)` FK → `departments.id`     | 所属部署 ID。                                |
| `date_of_birth`       | `varchar(255)`                           | 生年月日 (YYYY-MM-DD)。                       |
| `sex_code`            | `varchar(255)`                           | 性別コード (`1` or `2`)。                    |
| `pin_hash`            | `varchar(255)`                           | argon2 + pepper 済の PIN ハッシュ。          |
| `pin_retry_count`     | `int`, default 0                         | 連続 PIN 誤り回数。                          |
| `pin_locked_until`    | `datetime`, nullable                     | PIN ロック解除予定時刻。                     |
| `pin_updated_at`      | `datetime`                               | PIN 最終更新日時。                           |
| `pin_version`         | `int`, default 1                         | PIN バージョン。                             |
| `pin_must_change`     | `bool`, default true                     | 初回ログインで PIN 変更が必要か。            |
| `version`             | `int`, default 0                         | 職員情報の楽観ロック用。                     |
| `status`              | `varchar(50)`, default `'active'`        | 職員状態 (`active`, `suspended`, `left`)。   |
| `role`                | `varchar(50)`, default `'STAFF'`         | 権限 (`STAFF` or `ADMIN`)。                  |
| `last_login_at`       | `datetime`, nullable                     | 最終ログイン日時。                           |
| `created_at`          | `datetime`                               | 生成日時。                                   |
| `updated_at`          | `datetime`                               | 更新日時。                                   |

外部キー: `department_id` → `departments.id` (RESTRICT)  
ユニーク制約: `UQ_staffs_staff_id`, `UQ_staffs_emr_patient_id`  
索引: `IDX_staffs_staff_id`, `IDX_staffs_emr_patient_id`

---

## 4.3 `departments` テーブル

| カラム名     | 型・制約                    | 説明                               |
| ------------ | --------------------------- | ---------------------------------- |
| `id`         | `varchar(100)`, PK          | 部署 ID (CSV など外部与件を想定)。 |
| `name`       | `varchar(255)`              | 部署名。                           |
| `active`     | `bool`, default true        | アクティブ可否。                   |
| `created_at` | `datetime`                  | 生成日時。                         |
| `updated_at` | `datetime`                  | 更新日時。                         |

`staffs` との 1:N リレーションを保持。

---

## 4.4 `reservation_types` テーブル

| カラム名     | 型・制約            | 説明                               |
| ------------ | ------------------- | ---------------------------------- |
| `id`         | `int`, PK, AUTO     | 予約種別 ID。                      |
| `name`       | `varchar(255)`      | 種別名 (例: インフルエンザ)。      |
| `description`| `varchar(255)`, nullable | 説明。                        |
| `active`     | `bool`, default true| 公開可否。                         |
| `created_at` | `datetime`          | 生成日時。                         |
| `updated_at` | `datetime`          | 更新日時。                         |

`reservation_slots` / `reservations` から参照される。

---

## 4.5 `reservation_slots` テーブル

| カラム名            | 型・制約                           | 説明                                              |
| ------------------- | ---------------------------------- | ------------------------------------------------- |
| `id`                | `int`, PK, AUTO                    | 予約枠 ID。                                       |
| `reservation_type_id` | `int` FK → `reservation_types.id` | 対応する種別。                                    |
| `service_date_local` | `varchar(255)`                    | 実施日 (YYYY-MM-DD, ローカル表記)。               |
| `start_minute_of_day`| `int`                             | 開始分 (0=00:00)。                                |
| `duration_minutes`    | `int`                             | 枠の時間（分）。                                  |
| `capacity`          | `int`                             | 枠定員。                                          |
| `booked_count`      | `int`, default 0                  | 現在の予約数。                                    |
| `status`            | `varchar(50)`, default `'draft'`  | 状態 (`draft`, `published`, `closed`)。           |
| `booking_start`     | `datetime`, nullable              | 受付開始日時。                                   |
| `booking_end`       | `datetime`, nullable              | 受付終了日時。                                   |
| `notes`             | `varchar(255)`, nullable          | 備考。                                           |
| `created_at`        | `datetime`                        | 生成日時。                                       |
| `updated_at`        | `datetime`                        | 更新日時。                                       |

`reservations` による参照がある場合は `onDelete='RESTRICT'`。

---

## 4.6 `reservations` テーブル

| カラム名              | 型・制約                                  | 説明                                                     |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `id`                  | `int`, PK, AUTO                           | 予約 ID。                                               |
| `staff_uid`           | `varchar(255)` FK → `staffs.staff_uid`    | 予約者 UID。                                            |
| `staff_id`            | `varchar(255)`                            | 予約者 ID。冪等判定用。                                 |
| `reservation_type_id` | `int` FK → `reservation_types.id`         | 予約種別。                                               |
| `slot_id`             | `int` FK → `reservation_slots.id`         | 予約枠。                                                 |
| `service_date_local`  | `varchar(255)`                            | サービス提供日。                                         |
| `start_minute_of_day` | `int`                                     | 開始時刻 (分)。                                          |
| `duration_minutes`    | `int`                                     | 所要時間 (分)。                                         |
| `period_key`          | `varchar(255)`                            | 期間キー (`FY2024` 等)。                                |
| `canceled_at`         | `datetime`, nullable                      | 取消日時。                                               |
| `created_at`          | `datetime`                                | 生成日時。                                               |
| `updated_at`          | `datetime`                                | 更新日時。                                               |

ユニーク制約:  
* `UQ_reservations_staff_type_period` (`staffId`, `reservationTypeId`, `periodKey`)  
* `UQ_reservations_slot_staff` (`slotId`, `staffId`)

`Reservation` エンティティでは `ManyToOne` に `onDelete='RESTRICT'` を指定。

---

## 4.7 `refresh_sessions` テーブル

| カラム名             | 型・制約                                 | 説明                                      |
| -------------------- | ---------------------------------------- | ----------------------------------------- |
| `id`                 | `int`, PK, AUTO                          | セッション ID。                            |
| `staff_uid`          | `varchar(255)` FK → `staffs.staff_uid`   | 所有者 UID。                               |
| `refresh_token_hash` | `varchar(255)`                           | 現行リフレッシュトークンのハッシュ。        |
| `expires_at`         | `datetime`                               | 有効期限。                                |
| `revoked_at`         | `datetime`, nullable                     | 失効日時。                                 |
| `last_used_at`       | `datetime`, nullable                     | 最終利用日時。                             |
| `user_agent`         | `varchar(255)`, nullable                 | UA 情報。                                   |
| `ip_address`         | `varchar(255)`, nullable                 | 発行時 IP。                                |
| `created_at`         | `datetime`                               | 生成日時。                                 |
| `updated_at`         | `datetime`                               | 更新日時。                                 |

`AuthService` でリフレッシュ再利用検出時に `revoked_at` を更新し、該当職員のセッションを失効させる。

---

## 4.8 `reservation_types` 以外の参照マスタ

現バージョンでは上記以外にマスタテーブルはない。必要に応じ以下を検討する:

* 施設マスタ (`clinics`)
* 受付時間帯マスタ (`time_slots`)

導入時は `Reservation` / `ReservationSlot` との外部キー整合を考慮すること。

---

## 4.9 E2E シード仕様

`test/e2e/support/test-helpers.ts` の `seedBaselineData` は以下を冪等に作成する:

1. 部署 `DEFAULT`
2. 予約種別 `Baseline Vaccination`
3. 職員 `seed-user-001` (PIN `0000`)

このシードは複数回実行しても重複しない。テストおよびオフライン導入時の初期データとして活用する。

---

## 4.10 将来拡張

| 追加検討中エンティティ | 目的                                 | 備考                                 |
| ---------------------- | ------------------------------------ | ------------------------------------ |
| `reservation_cancellations` | 取消履歴の保持                         | 取消理由や取消者を追跡。             |
| `staff_audit_logs`     | 職員操作ログの保存                     | 重要操作 (PIN 変更等) の証跡管理。    |
| `notifications`        | 予約通知履歴                           | メール/SMS/Push 送信結果の記録。      |

導入時はイベントトランザクションと整合性制約を再検討する。

---

**最終更新**: 2025-11-03  
**バージョン**: 1.0.0

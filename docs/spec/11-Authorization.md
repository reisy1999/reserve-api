# 11. 認証 / 認可仕様

本章では reserve-api の認証・認可フロー、トークン運用、ガード構成を記述する。

---

## 11.1 認証方式一覧

| 種別             | 対象エンドポイント                         | 概要                                    |
| ---------------- | ------------------------------------------ | --------------------------------------- |
| **JWT Bearer**   | `/api/staffs/*`, `/api/reservations/*`     | 職員ログイン後のアクセス制御。         |
| **リフレッシュ** | `/api/auth/refresh`                        | 新しい JWT / リフレッシュトークン発行。|
| **管理者トークン** | `/api/admin/*`                           | CSV インポート等の管理系操作。         |
| **公開**         | `/api/reservation-types`                   | ヘルスチェック兼一覧取得。             |

---

## 11.2 JWT 認証フロー

1. `POST /api/auth/login`  
   * 入力: `staffId`, `pin`  
   * 認証成功後:
     - アクセストークン (JWT, `JwtService.sign`)  
     - リフレッシュトークン (`refresh_sessions` にハッシュ保存)
2. クライアントはリクエストヘッダー `Authorization: Bearer <token>` を付与。
3. API 側では `JwtAuthGuard` がトークン検証 → `JwtStrategy.validate()` が `staff_uid` を解決。
4. 職員ステータスや PIN ロック状態は `ReservationsService` / `StaffService` で再確認。

### JWT ペイロード

```json
{
  "sub": "<staff_uid>",
  "sid": "<staff_id>",
  "role": "STAFF",
  "status": "active",
  "iat": 1709539200,
  "exp": 1709539800
}
```

* 署名: `HS256` (デフォルト) / `JWT_SECRET`。
* 有効期限: `JWT_EXPIRES_IN` (既定 900 秒)。

---

## 11.3 リフレッシュトークン

| 項目          | 内容                                                       |
| ------------- | ---------------------------------------------------------- |
| 発行エンドポイント | `POST /api/auth/refresh`                              |
| 保存方法      | ハッシュ値のみ (`refresh_sessions.refresh_token_hash`)    |
| 再利用検知    | 古いトークン使用時は全セッション失効 (`handleRefreshReuse`) |
| 有効期限      | `REFRESH_EXPIRES_IN` (既定 30 日)                         |
| Rotating Refresh | 新しいトークンを返し、旧トークンは即座に失効。         |

---

## 11.4 管理者トークン

* ヘッダー:  
  - `X-Admin-Token: <ADMIN_TOKEN>`  
  - `Idempotency-Key: <unique>` (再実行対策)
* ガード: `AdminTokenGuard`
  - `.env` / `ADMIN_TOKEN` と一致しない場合は `401 Unauthorized`。
  - API 側では CSV インポート、枠一括登録、予約種別作成を提供。

トークンは共有シークレットのため、VPN + IP 制限を併用することを推奨。

---

## 11.5 認可 (Role / State 管理)

| 対象             | 制約内容                                                    |
| ---------------- | ----------------------------------------------------------- |
| 職員ステータス   | `status !== 'active'` の場合はログイン済でもアクセス拒否。  |
| PIN ロック       | `pin_locked_until` が未来 → `423 Locked` を返す。           |
| プロフィール未完 | `pinMustChange`, `emrPatientId` 等の不足 → `428` 応答。    |

トークン自体は `role` を含むが現バージョンでは `STAFF` のみ。将来的に `ADMIN` を拡張する場合は Route Guard を追加する。

---

## 11.6 セッション管理

* 成功ログイン時: `StaffService.resetPinFailures` / `recordSuccessfulLogin` を実行。
* PIN 変更時: 再認証を行い、`pinHash`, `pinVersion`, `pinRetryCount` を更新。
* リフレッシュセッションテーブルは `revoked_at` を冪等更新し、再利用防止を保証。

---

## 11.7 テスト戦略

| テスト種別  | 内容                                                                 |
| ----------- | -------------------------------------------------------------------- |
| ユニット    | `AuthService` の `login`, `refreshToken` でガードロジックのモック検証。 |
| E2E         | `test:e2e` / `test:e2e:ci` で MySQL を用い、ログイン → API 呼び出しを網羅。 |
| シード      | `seedBaselineData` が `seed-user-001` を生成し、PIN `0000` でログイン可能にする。 |

---

## 11.8 将来課題

1. **Role-Based Access Control (RBAC)**  
   - 管理画面ユーザ種別に応じて細粒度権限を付与。
2. **トークン失効 API**  
   - 職員自らデバイスをログアウトする機能。
3. **MFA 対応**  
   - PIN + TOTP の併用。リフレッシュ発行時のセキュリティ強化。
4. **Rate Limiting**  
   - Auth API への多重要求抑止。CloudFront / API Gateway も検討。

---

**最終更新**: 2025-11-03  
**バージョン**: 1.0.0

# Frontend Implementation Guide (Next.js App Router)

本ドキュメントは現行バックエンド (reserve-api) の挙動に基づき、Next.js (App Router) でフロントエンドを構築する際の指針をまとめたものです。以下の内容は **実装済みのバックエンド仕様** を根拠とし、推奨フロー・API 連携方法を整理しています。詳細な API 仕様は `/docs/spec` 配下 (特に `05-API-Overview.md`, `06-Auth-API.md`, `07-Staff-API.md`, `08-Reservation-API.md`, `09-Admin-API.md`, `11-Authorization.md`) を参照してください。

---

## 1. プロジェクトセットアップ

- Next.js 14 以降 (App Router) を想定。
- フロントエンドからバックエンドへは REST API を利用。
- `.env.local` などに API ベース URL を定義:

  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
  ```

- fetch ベースの軽量クライアント or `ky` 等の薄いラッパ利用を推奨。`axios` でも問題なし。

---

## 2. API ベース URL

- すべてのエンドポイントは `/api` プレフィックスを持つ (例: `GET /api/reservation-types`)。
- 本番 API: `https://reserve-api.example.com/api`
- 開発時: `.env` に合わせて `http://localhost:3000/api`

---

## 3. 認証フロー (職員向け)

### 3.1 ログイン

- エンドポイント: `POST /api/auth/login`
- 入力: `{ staffId: string, pin: string }`
- 成功レスポンス: `{ tokenType: "Bearer", accessToken, refreshToken, expiresIn }`
- **必ず TLS 配下に配置し、ブラウザから直接 PIN が送信される点を考慮すること。**

### 3.2 トークン管理

- アクセストークンは短命 (デフォルト 15 分)。リフレッシュトークンで更新。
- Next.js App Router では以下の運用を推奨:

  1. サーバーアクション or Route Handler (`app/api/session/route.ts`) でログイン API を呼び出す。
  2. セキュア Cookie (HttpOnly, Secure, SameSite=Lax) にアクセストークン・リフレッシュトークンを保存。
  3. クライアントからは Route Handler 経由で API 呼び出し → Cookie から Authorization ヘッダーをセット。

- 自動再ログイン:
  - アクセス時に 401 が返却された場合、`POST /api/auth/refresh` で再取得。
  - 失敗した場合はログアウト → ログインページへ遷移。

### 3.3 ログアウト

- 明示的なログアウト API は未実装。クライアント側で Cookie を削除し、再認証を促す。
- 将来サーバー側でセッション終了 API が追加された場合は対応を追加。

---

## 4. スタッフ向けページ実装指針

### 4.1 プロフィール閲覧

- `GET /api/staffs/me`
- 401 対応: トークン再取得 or ログインへリダイレクト。

### 4.2 プロフィール更新

- `PATCH /api/staffs/me`
- バリデーションエラーは配列で返却される可能性あり (例: `"message": ["pin must be ..."]`)。
- センシティブ項目 (EMR ID, 性別, 生年月日, 役職等) 更新時は `currentPin` 必須。レスポンス 428 の場合は PIN 入力フォームを再提示。

### 4.3 PIN 変更

- `POST /api/staffs/me/pin`
- 入力: `{ currentPin: string, newPin: string }`
- 成功時 `204 No Content`。失敗時 428 (再認証失敗) や 400 (フォーマット不一致) を考慮。

### 4.4 予約作成

- エンドポイント: `POST /api/reservations`
- 入力: `{ slotId: number }`
- エラー例:
  - 403: 受付期間外 (`Reservation window closed`)
  - 409: 年度重複や枠満員
  - 428: プロフィール未完了
- UI はエラー内容に応じたトーストやモーダル表示を行う。

---

## 5. 公開 / 管理機能

### 5.1 公開 (ヘルスチェック)

- `GET /api/reservation-types` を利用。認証不要。
- App Router の SSG/ISR で一覧をキャッシュ可能。

### 5.2 管理者機能 (CSV インポート等)

- `AdminTokenGuard` により保護。ヘッダー:

  ```
  X-Admin-Token: <ADMIN_TOKEN>
  Idempotency-Key: <unique key per request>
  ```

- Next.js で管理画面を実装する場合:
  - 管理者は別 UI とし、`.env` で ADMIN_TOKEN を取り扱う or 専用プロキシ経由にする。
  - 直接ブラウザから呼ぶ場合は Token が露出するため **推奨されない**。バックエンド管理ツール (CLI/BFF) を推奨。

---

## 6. データ取得戦略

### 6.1 Server Components (App Router)

- 認証が必要なデータは Route Handler (例: `app/api/*`) を介して SSR/CSR 双方を吸収。
- `cookies()` API からアクセストークンを取得し、バックエンド REST API を呼び出す。
- 401 時はリフレッシュ処理を挟んで再試行。2 回目も失敗した場合はエラーページ or ログインへ遷移。

### 6.2 クライアントサイド取り回し

- `useEffect` での直接 fetch ではなく、`app/api` 経由を推奨 (CORS/TLS/Token 処理を集約)。
- React Query や SWR を使う場合も fetcher は Route Handler に委譲する。

---

## 7. エラーハンドリング指針

| ステータス | シナリオ                                    | UI 対応例                           |
| ---------- | ------------------------------------------- | ----------------------------------- |
| 401        | 認証エラー、トークン失効                   | リフレッシュ → 失敗時ログインへ    |
| 403        | 予約受付外、権限不足                       | 受付時間内である旨を表示           |
| 409        | 重複予約、楽観ロック失敗                   | 既存予約を案内                      |
| 423        | PIN ロック                                 | サポートへ連絡 or 指定時間後に再試行 |
| 428        | プロフィール未完了、PIN未変更             | プロフィール更新ウィザードを表示   |
| 500        | 予期しないエラー                           | 通知・リトライ案内                  |

レスポンス形式は `05-API-Overview.md` の 5.4 / 5.5 を参照。

---

## 8. 状態管理

- セッション情報 (staff profile) は Server Component からのフェッチを SSR 時に行い、Context に注入する手法が有効。
- PIN 変更やプロフィール更新後は `router.refresh()` で最新情報を再取得。

---

## 9. ルーティング例 (App Router)

```
app/
 ├─ layout.tsx              # 共通レイアウト
 ├─ page.tsx                # ログイン / ダッシュボードの出し分け
 ├─ login/
 │   └─ page.tsx            # ログインフォーム
 ├─ reservations/
 │   └─ page.tsx            # 予約一覧/作成フォーム
 ├─ profile/
 │   └─ page.tsx            # プロフィール + PIN 管理
 └─ api/
     ├─ auth/
     │   ├─ login/route.ts  # backend /api/auth/login 呼び出し
     │   └─ refresh/route.ts
     ├─ staff/
     │   └─ me/route.ts     # GET/PATCH
     └─ reservations/
         └─ route.ts        # POST
```

Route Handler 内でバックエンドの base URL を参照し、Cookie からトークンを抽出してヘッダー付与する。

---

## 10. テスト

- E2E テストはバックエンドと同じ `.env.test` を利用し、Playwright や Cypress で実ブラウザテストを実施。
- MSW などを併用し、オフラインやバックエンド未接続状態でも UI を検証できるようにする。

---

## 11. 参考資料

- `/docs/spec/05-API-Overview.md` — API 基本仕様
- `/docs/spec/06-Auth-API.md` — 認証 API 詳細
- `/docs/spec/07-Staff-API.md` — 職員 API
- `/docs/spec/08-Reservation-API.md` — 予約 API
- `/docs/spec/09-Admin-API.md` — 管理者 API
- `/docs/spec/11-Authorization.md` — 認証・認可説明

---

**最終更新**: 2025-11-03  
**バージョン**: 1.0.0

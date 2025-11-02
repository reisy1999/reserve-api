# 予約API ハンズオン実装プラン（リビルド版）

**目的**: 初学者が NestJS/TypeORM を学びながら、職員向け予約APIを仕様通りに完成させる。  
**ゴール**: `docs/data-specification.md` の要件（年度1回制限・DTO最小主義など）を意図的に満たし、Swaggerでデモできる状態にする。

---

## 全体方針

- 段階ごとに「学ぶ → 手を動かす → 動作確認」のループを繰り返す。
- 仕様が満たされているか毎ステップで確認し、次のステップまで余計な実装はしない。
- すべてのエンドポイントは `/api/...` に集約し、管理系は `/api/admin/...` でガードする。
- SQLite + TypeORM の開発環境では `synchronize: true` を使い、移行は最後にマイグレーションで固める。

---

## マイルストーン一覧

| 番号 | マイルストン名     | 目的                                                          |
| ---- | ------------------ | ------------------------------------------------------------- |
| M0   | オリエンテーション | プロジェクトと仕様を把握する                                  |
| M1   | 基盤セットアップ   | Nest/TypeORMの骨格と設定を固める                              |
| M2   | 予約CRUDの正常系   | Reservationテーブルの基本操作を通す                           |
| M3   | 入力バリデーション | DTO＋ValidationPipeで入口を堅くする                           |
| M4   | 業務制約の実装     | `periodKey`算出と年度1回制限を保証する                        |
| M5   | マスタAPI整備      | Staff / Department / ReservationType を実装する               |
| M6   | 管理APIガード      | `/api/admin/*` をトークンで保護し、管理ユースケースを追加する |
| M7   | 可視化と運用準備   | Swagger・設定・マイグレーションを整備する                     |
| M8   | テストと振り返り   | ユニット/E2Eテストとドキュメント更新で締める                  |

以下、各マイルストーンの詳細。

---

## M0: オリエンテーション（学習準備）

**到達目標**: 仕様・実装範囲・利用技術を説明できる。

- `README.md`, `docs/data-specification.md`, `docs/system-architecture.md` を読み、要件にマーキングする。
- 必要なコマンド（`npm run start:dev`, `npm run test`, `npm run test:e2e`）を確認し手元で実行する。
- `src/` のモジュール構成を把握し、どのフォルダに何を置くかを図示する。

**確認リスト**

- [ ] 仕様で必須の機能と任意機能を区別できる
- [ ] メインとなるエンドポイント一覧を自分の言葉で整理したノートがある

---

## M1: 基盤セットアップ

**目的**: NestJS + TypeORM + SQLite を動作させ、`Reservation` エンティティを永続化できる基盤を整える。

- `AppModule` に `TypeOrmModule.forRoot` を設定し、`Reservation` エンティティを登録。
- `ReservationModule` を生成 (`nest g resource reservations --no-spec` など) し、Controller/Service/Entityの骨格を整える。
- `Reservation` エンティティに仕様に沿ったカラムを定義（`periodKey` は一旦 nullable）。
- 開発環境用に `.env.development` を用意し、`ADMIN_TOKEN` など最低限の設定値を追加。

**確認リスト**

- [ ] `npm run start:dev` が成功し、アプリが起動する
- [ ] SQLite に `reservations` テーブルが生成される（`sqlite3 db.sqlite ".schema reservations"`）

---

## M2: 予約CRUDの正常系

**目的**: DTOなしの暫定実装で構わないので、Reservationの基本CRUDを通す。要件を満たす前に動作を理解する。

- Serviceに `create`, `findAll`, `findOne`, `update`, `remove` を実装。
- Controllerに `POST /api/reservations`, `GET /api/reservations`, `GET /api/reservations/:id`, `PATCH /api/reservations/:id`, `DELETE /api/reservations/:id` を追加。
- 正常系のみを対象に、`curl` や Thunder Client で手動検証する。  
  例: `curl -X POST http://localhost:3000/api/reservations -H "Content-Type: application/json" -d '{"staffId":"S001","reservationTypeId":1,"serviceDateLocal":"2025-04-01","startMinuteOfDay":540,"durationMinutes":30}'`
- `findOne` と `remove` では存在しない場合に `NotFoundException` を投げる。

**確認リスト**

- [ ] CRUDすべてが正常に動作し、再起動後もデータが残る
- [ ] `NotFoundException` の挙動を説明できる（どこで投げているか理解する）

---

## M3: 入力バリデーションとDTO

**目的**: `CreateReservationDto` / `UpdateReservationDto` を導入し、仕様通りの入力制約を掛ける。

- Global `ValidationPipe` を `main.ts` に追加（`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`）。
- `CreateReservationDto` に以下の検証を実装:
  - `serviceDateLocal`: `YYYY-MM-DD` 形式＋実在日付（カスタムバリデータ）
  - `startMinuteOfDay`: 整数かつ `0..1439`
  - `durationMinutes`: 正の整数
  - `staffId`: 空文字禁止の文字列
  - `reservationTypeId`: 正の整数
- `UpdateReservationDto` は `PartialType(CreateReservationDto)` を利用しつつ、部分更新時のバリデーションが効くようにする。
- 不正入力ケース（形式/範囲/余分なプロパティ）の手動検証を行い、400が返ることを確認。

**確認リスト**

- [ ] DTOに存在しないプロパティを送ると 400 が返る
- [ ] うるう年を含む実在/非実在日付のテストケースを用意している

---

## M4: 業務制約の実装（periodKey と年度1回制限）

**目的**: 仕様で最重要となる年度制約を実装し、意図的にテストする。

- `src/utils/date.ts` などに `calculatePeriodKey(serviceDateLocal: string): string` を実装。
- `ReservationsService.create` で保存前に `periodKey` を算出し、DTOに含めずエンティティへ設定する。
- 同一 `(staffId, reservationTypeId, periodKey)` が存在する場合は `ConflictException` を投げる。
- TypeORM のユニーク制約（`@Index(['staffId', 'reservationTypeId', 'periodKey'], { unique: true })`）を追加し、DBレベルでも保証する。
  - `synchronize: true` で動作確認後、`typeorm migration:generate` で正式なマイグレーションファイルを作成（M7で適用）。
- 年度が境界（3/31→4/1）を跨ぐテストデータで periodKey が変わることを確認。

**確認リスト**

- [ ] 同一スタッフ・同一年度・同一種別で2件目が 409 になる
- [ ] periodKeyの算出ロジックをユニットテストでカバーしている

---

## M5: マスタAPI整備（Staff / Department / ReservationType）

**目的**: 予約が参照するマスタデータを整備し、FK整合性をチェックできるようにする。

- `Staff`, `Department`, `ReservationType` の各モジュールを実装（エンティティ/DTO/Controller/Service）。
- 仕様の必須フィールドを実装し、`Create/Update` DTO にバリデーションを付与。
- Reservation 登録時に存在しない `staffId` / `reservationTypeId` を弾くため、`ReservationsService.create` 内で存在確認を行う。
- Staff 作成時の `departmentId` 参照チェックも実装。

**確認リスト**

- [ ] 参照整合性違反が明示的なエラーメッセージで返る
- [ ] マスタAPIのCRUD操作が Swagger（後述）に反映されている

---

## M6: 管理APIとガード

**目的**: 管理者向けエンドポイントを `/api/admin/*` に切り出し、トークンで保護する。

- `AdminTokenGuard` を `src/common/guards/admin-token.guard.ts` に実装し、`X-Admin-Token` と `process.env.ADMIN_TOKEN` の一致を検証。
- 管理用モジュールを作成し、最低限の機能を実装（例: 予約一覧の期間フィルタ、強制キャンセル、集計など）。
- 一般向けAPIと管理APIを `AppModule` で別ルートにまとめ、`/api/admin` プレフィックスには必ず `UseGuards(AdminTokenGuard)` を設定。
- （任意）`ServeStaticModule` を用いて `/admin` へ静的ファイルを配信し、ブラウザから管理UIにアクセスできるようにする。

**確認リスト**

- [ ] トークン無し/不一致で 401/403 が返る
- [ ] 管理APIを使って年度別集計を取得できる

---

## M7: 可視化と運用準備

**目的**: APIを第三者に見せられる状態にし、設定/マイグレーションを整える。

- `main.ts` に Swagger を導入し、`/api-docs` で公開。主要な DTO とレスポンスに説明を付ける。
- `config` ディレクトリを整備し、`ConfigModule` で環境変数を型安全に読み出す（ポート番号、Adminトークン等）。
- `typeorm` ディレクトリで migration を生成・適用し、`synchronize: false` に切り替えても動作することを確認。
- `.env.example` を作成し、必要な環境変数を明記する。

**確認リスト**

- [ ] Swagger UI から CRUD と管理API が操作できる
- [ ] `npm run typeorm migration:run` 実行後もアプリが正常に起動する

---

## M8: テスト・振り返り・ドキュメント

**目的**: 実装した仕様をテストで裏付け、学習内容を言語化する。

- `ReservationsService` のユニットテストで periodKey 算出・年度制約・重複チェックを検証。
- `test/` 配下で E2E テストを作成し、代表的なシナリオ（正常系/400/409/404）を網羅する。
- `docs/data-specification.md` や 本ファイルを最新状態に更新し、実装との差異がないか見直す。
- 学習ログ（困った点・解決策）を README もしくは別ドキュメントに追記。

**確認リスト**

- [ ] `npm run test` と `npm run test:e2e` がどちらも成功する
- [ ] 今後追加したい改善点と優先度を明記している

---

## 追加チャレンジ（任意タスク）

- 時間帯重複チェック（Service層もしくは DB チェック制約）
- 予約キャンセル履歴テーブル・監査ログの実装
- Jenkins / GitHub Actions など CI でテストとマイグレーションを自動化
- Docker Compose で SQLite から他 RDB（PostgreSQL 等）への移行検証

---

## 進め方のヒント

1. 各マイルストーンごとにブランチを切り、`README` に達成度をメモする。
2. 仕様を満たしたら実際にAPIを叩いてスクリーンショットやレスポンス例を残す。
3. 予期せぬエラーに遭遇したら、ログと再現手順をチケット化してから修正する。
4. 「何を学んだか」を言語化しながら進めると、次のステップで迷わなくなる。

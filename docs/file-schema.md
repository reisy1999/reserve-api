src/
├─ main.ts                        # アプリ起動エントリ。NestFactory.create() → listen()
│                                 # グローバルパイプ・フィルタ・CORS設定などもここで登録。
│
├─ app.module.ts                  # ルートモジュール。全モジュール(imports)を束ねる。
├─ app.controller.ts              # 共通API（/health, /versionなど）。業務ロジックなし。
├─ app.service.ts                 # 軽処理・ヘルスチェック用。予約ロジックは置かない。
│
├─ reservations/                  # ドメイン（職員予約）の主モジュール
│  ├─ dto/                        # 入出力契約（型＋class-validator）
│  │  ├─ create-reservation.dto.ts
│  │  └─ update-reservation.dto.ts
│  │
│  ├─ entities/                   # DB構造（TypeORM Entity）
│  │  └─ reservation.entity.ts    # periodKey生成列＋一意制約＋1440分方式など
│  │
│  ├─ reservations.controller.ts  # ルーティング層。DTO受取→Service呼出→レスポンス返却。
│  ├─ reservations.service.ts     # 業務ロジック層。年度1回制限・時間重複判定など。
│  └─ reservations.module.ts      # このドメインの配線。Controller/Service/Entity登録。
│
├─ staff/                         # （今後追加予定）職員マスタ
│  ├─ dto/
│  ├─ entities/
│  ├─ staff.controller.ts
│  ├─ staff.service.ts
│  └─ staff.module.ts
│
├─ department/                    # （今後追加予定）部署マスタ
│  ├─ dto/
│  ├─ entities/
│  ├─ department.controller.ts
│  ├─ department.service.ts
│  └─ department.module.ts
│
├─ reservation-type/              # （今後追加予定）予約種別マスタ
│  ├─ dto/
│  ├─ entities/
│  ├─ reservation-type.controller.ts
│  ├─ reservation-type.service.ts
│  └─ reservation-type.module.ts
│
├─ common/                        # 共通層（横断関心）
│  ├─ filters/                    # 例外をHTTPレスポンスへ正規化（例：DB制約→409）
│  ├─ pipes/                      # 入力変換（数値文字列→number等）
│  ├─ guards/                     # 認可やJWTガードなど
│  └─ interceptors/               # ロギング・レスポンス整形
│
├─ config/                        # 設定層
│  ├─ database.config.ts          # SQLite設定（TypeORM）
│  └─ app.config.ts               # env読込など
│
└─ typeorm/                       # （オプション）マイグレーション・データソース
   ├─ data-source.ts
   └─ migrations/
       └─ 1700000000000-init.ts   # 初期DDL（periodKey生成列・UNIQUE制約含む）

test/                             # E2E テスト
└─ reservations.e2e-spec.ts       # CRUD + 年度制約 + 重複チェック検証
```

---

### ✅ 役割のまとめ

| 階層              | 目的                           |
| --------------- | ---------------------------- |
| `main.ts`       | 起動と全体設定（HTTPサーバ作成）           |
| `app.*`         | 全体構成の“ルート”だけを担当（業務ロジックは持たない） |
| `reservations/` | 職員予約の責務を全て閉じるモジュール           |
| `dto/`          | 入力値の型・妥当性定義（バリデーション層）        |
| `entities/`     | データベース構造定義（TypeORM Entity）   |
| `controller.ts` | HTTP入口層                      |
| `service.ts`    | ドメインロジック層                    |
| `module.ts`     | 構成情報（DI登録）                   |
| `common/`       | 例外、バリデーション、ガードなど横断的な機能       |
| `config/`       | 設定・環境変数管理                    |
| `typeorm/`      | DB接続・マイグレーション再現性の担保          |

---

この構成のまま開発を進めると、NestJSの設計哲学（責務分離 + モジュール境界）を保ちながら、
職員予約（reservations）を**単独モジュールで完結**させられます。
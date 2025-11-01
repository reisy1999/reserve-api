# system-architecture.md

src/
├─ main.ts
├─ app.module.ts
├─ app.controller.ts
├─ app.service.ts
│
├─ reservations/
│  ├─ dto/
│  │   ├─ create-reservation.dto.ts
│  │   └─ update-reservation.dto.ts
│  ├─ entities/
│  │   └─ reservation.entity.ts
│  ├─ reservations.controller.ts        # /api/reservations (一般利用)
│  ├─ reservations.service.ts
│  └─ reservations.module.ts
│
├─ admin/                                # ★ 管理用API一式（アプリ側の“薄い”ガード込み）
│  ├─ admin.controller.ts                # /api/admin/* : 管理操作（全件参照/強制キャンセル等）
│  ├─ admin.service.ts                   # 管理専用のユースケース集約（予約種別停止/集計 など）
│  ├─ admin.module.ts
│  └─ dto/
│      └─ admin-cancel.dto.ts            # 例: 強制キャンセル理由など
│
├─ common/
│  ├─ guards/
│  │   ├─ admin-token.guard.ts           # ★ X-Admin-Token を検証（envの ADMIN_TOKEN と一致）
│  │   └─ staff.guard.ts                 # （任意）X-Staff-Id を検証・req.user に載せる
│  ├─ filters/
│  ├─ interceptors/
│  └─ pipes/
│
├─ config/
│  ├─ app.config.ts
│  ├─ database.config.ts
│  └─ security.config.ts                 # CORS/Helmet/RateLimit 設定読み出し
│
├─ static-admin/                         # ★ 管理者専用ページ（最小SPAを配信するならここにビルド配置）
│  └─ index.html                         #   Nestの ServeStaticModule で /admin にマウント
│
├─ typeorm/
│  ├─ data-source.ts
│  └─ migrations/
│      └─ 1700000000000-init.ts
│
└─ utils/
   └─ date.ts
test/
└─ reservations.e2e-spec.ts
```

## 役割とアクセス方針（要点）

* **一般API**：`/api/reservations/*`（認証なし or 将来のStaffGuard）
* **管理API**：`/api/admin/*`（`AdminTokenGuard` 必須）
* **管理UI**：`/admin` を **ServeStatic** で配信（※フロント判定は信用せず、API側で必ずガード）

## ガードの最小ルール

* `AdminTokenGuard`：リクエストヘッダ `X-Admin-Token` が `process.env.ADMIN_TOKEN` と一致 → 通す

  * すべての **/api/admin/** ルートに `@UseGuards(AdminTokenGuard)`
* （任意）プロキシ側でも **Basic認証 + IP制限** を /admin と /api/admin/* に設定すると二重ロック

## 管理APIの例

* `GET /api/admin/reservations?from=&to=&type=` 全件/期間/種別で集計
* `POST /api/admin/reservations/:id/cancel` 強制キャンセル（理由必須）
* `POST /api/admin/reservation-types/:id/disable` 予約種別停止（将来拡張）

## .env（最小）

```
ADMIN_TOKEN=長くてランダムな文字列
APP_PORT=3000
NODE_ENV=production
```

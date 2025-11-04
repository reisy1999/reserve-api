# Staff Update API - TDD Implementation Plan

_作成日: 2025-11-04 (JST)_

---

## 1. 概要

職員（staffs）の更新APIを追加します。本人による自己プロフィール更新と、管理者による職員情報管理の2つの側面を持ちます。TDDアプローチで実装し、権限管理・バリデーション・楽観的ロックを含む堅牢なAPIを構築します。

---

## 2. 更新可能項目の分類

### 2.1 本人が変更可能な項目

**エンドポイント**: `PATCH /api/staffs/me`

| 項目 | フィールド | バリデーション | PIN再認証 |
|------|-----------|---------------|----------|
| 姓・名 | `familyName`, `givenName` | 文字列（1-100文字） | 不要 |
| 姓カナ・名カナ | `familyNameKana`, `givenNameKana` | 文字列（1-100文字） | 不要 |
| 職種 | `jobTitle` | 文字列（1-100文字） | **必須** |
| 部署ID | `departmentId` | 既存部門FK | **必須** |
| EMR患者ID | `emrPatientId` | 1-64桁、重複不可 | **必須** |
| 生年月日 | `dateOfBirth` | YYYY-MM-DD形式 | **必須** |
| 性別コード | `sexCode` | `1` (男性) または `2` (女性) | **必須** |
| PIN変更 | `pinHash` | 別エンドポイント: `POST /api/staffs/me/pin` | - |

**注意**:
- `familyName`, `givenName` の更新は本人が可能だが、通常は管理者による訂正を想定
- PIN再認証が必要な項目を更新する場合は `currentPin` パラメータが必須（428エラー）

### 2.2 管理者が変更可能な項目

**エンドポイント**: `PATCH /api/admin/staffs/:staffUid`

| 項目 | フィールド | バリデーション | 備考 |
|------|-----------|---------------|------|
| EMR患者ID | `emrPatientId` | 1-64桁、重複不可 | 重要項目 |
| 部署ID | `departmentId` | 既存部門FK | 外部キー制約 |
| 職種 | `jobTitle` | 文字列（1-100文字） | - |
| ステータス | `status` | `active` \| `suspended` \| `left` | - |
| ロール | `role` | `STAFF` \| `ADMIN` | 権限管理 |
| 姓・名 | `familyName`, `givenName` | 文字列（1-100文字） | 訂正対応 |
| 姓カナ・名カナ | `familyNameKana`, `givenNameKana` | 文字列（1-100文字） | 訂正対応 |
| PINリセット | 別エンドポイント: `POST /api/admin/staffs/:staffUid/reset-pin` | - | `pinMustChange=true` |

**エンドポイント**: `POST /api/admin/staffs/:staffUid/reset-pin`
- PINを初期値（`0000`）にリセット
- `pinMustChange` を `true` に設定
- `pinRetryCount` を `0` にリセット
- `pinLockedUntil` を `null` にリセット

### 2.3 システム管理（読み取り専用）

以下のフィールドは更新不可（システムが自動管理）：

| 項目 | フィールド | 説明 |
|------|-----------|------|
| 職員UUID | `staffUid` | 主キー（UUID） |
| 職員ID | `staffId` | ログインID（一意） |
| 楽観ロックバージョン | `version` | 更新時に自動インクリメント |
| 最終ログイン日時 | `lastLoginAt` | ログイン時に自動更新 |
| 作成日時 | `createdAt` | レコード作成時に自動設定 |
| 更新日時 | `updatedAt` | 更新時に自動設定 |
| PIN失敗回数 | `pinRetryCount` | 認証時に自動管理 |
| PINロック解除日時 | `pinLockedUntil` | 認証時に自動管理 |
| PIN更新日時 | `pinUpdatedAt` | PIN変更時に自動設定 |
| PINバージョン | `pinVersion` | PIN変更時に自動インクリメント |
| PIN変更必須 | `pinMustChange` | PIN変更/リセット時に設定 |

---

## 3. API仕様

### 3.1 PATCH /api/staffs/me（本人更新）- 既存機能の拡張

#### 概要
ログイン中の職員が自身のプロフィールを更新します。既存実装を拡張し、氏名フィールドの更新を追加します。

#### リクエスト

**Headers**:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "version": 3,
  "currentPin": "1234",
  "familyName": "山田",
  "givenName": "太郎",
  "familyNameKana": "やまだ",
  "givenNameKana": "たろう",
  "jobTitle": "医師",
  "departmentId": "ER",
  "emrPatientId": "123456",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1"
}
```

| フィールド | 型 | 必須 | バリデーション | PIN再認証 |
|-----------|-----|------|---------------|----------|
| `version` | number | ◯ | 0以上の整数 | - |
| `currentPin` | string | △ | 数字4桁 | 重要項目更新時のみ必須 |
| `familyName` | string | - | 1-100文字 | 不要 |
| `givenName` | string | - | 1-100文字 | 不要 |
| `familyNameKana` | string | - | 1-100文字 | 不要 |
| `givenNameKana` | string | - | 1-100文字 | 不要 |
| `jobTitle` | string | - | 1-100文字 | **必須** |
| `departmentId` | string | - | 既存部門FK | **必須** |
| `emrPatientId` | string | - | 1-64桁、数字のみ | **必須** |
| `dateOfBirth` | string | - | YYYY-MM-DD形式 | **必須** |
| `sexCode` | string | - | `1` または `2` | **必須** |

#### レスポンス

**成功 (200 OK)**:
```json
{
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "emrPatientId": "123456",
  "familyName": "山田",
  "givenName": "太郎",
  "familyNameKana": "やまだ",
  "givenNameKana": "たろう",
  "jobTitle": "医師",
  "departmentId": "ER",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1",
  "version": 4,
  "pinMustChange": false,
  "status": "active",
  "role": "STAFF",
  "lastLoginAt": "2025-11-03T09:00:00.000Z",
  "createdAt": "2025-04-01T00:00:00.000Z",
  "updatedAt": "2025-11-04T10:00:00.000Z"
}
```

#### エラー

| ステータス | 条件 | メッセージ |
|-----------|------|-----------|
| **400 Bad Request** | バリデーションエラー | 各フィールドのバリデーションメッセージ |
| **400 Bad Request** | EMR患者ID重複 | `"emrPatientId already exists."` |
| **404 Not Found** | 部署ID不正 | `"Department not found"` |
| **409 Conflict** | バージョン不一致 | `"Version mismatch"` |
| **428 Precondition Required** | PIN再認証が必要 | `"PIN re-authentication required"` |
| **428 Precondition Required** | PIN不一致 | `"PIN mismatch"` |

---

### 3.2 PATCH /api/admin/staffs/:staffUid（管理者更新）- 新規

#### 概要
管理者が職員情報を更新します。本人では変更できない `status`, `role` フィールドも更新可能です。

#### 認証
必須（JWT Bearer認証 + 管理者権限）

#### リクエスト

**Path Parameters**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `staffUid` | string | ◯ | 職員UUID |

**Headers**:
```http
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "version": 3,
  "familyName": "山田",
  "givenName": "太郎",
  "familyNameKana": "やまだ",
  "givenNameKana": "たろう",
  "jobTitle": "医師",
  "departmentId": "ER",
  "emrPatientId": "123456",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1",
  "status": "active",
  "role": "STAFF"
}
```

| フィールド | 型 | 必須 | バリデーション | 備考 |
|-----------|-----|------|---------------|------|
| `version` | number | ◯ | 0以上の整数 | 楽観的ロック |
| `familyName` | string | - | 1-100文字 | 訂正対応 |
| `givenName` | string | - | 1-100文字 | 訂正対応 |
| `familyNameKana` | string | - | 1-100文字 | 訂正対応 |
| `givenNameKana` | string | - | 1-100文字 | 訂正対応 |
| `jobTitle` | string | - | 1-100文字 | - |
| `departmentId` | string | - | 既存部門FK | 外部キー制約 |
| `emrPatientId` | string | - | 1-64桁、数字のみ | 重複不可 |
| `dateOfBirth` | string | - | YYYY-MM-DD形式 | - |
| `sexCode` | string | - | `1` または `2` | - |
| `status` | string | - | `active` \| `suspended` \| `left` | **管理者のみ** |
| `role` | string | - | `STAFF` \| `ADMIN` | **管理者のみ** |

#### レスポンス

**成功 (200 OK)**:
```json
{
  "staffUid": "e742beb5-6957-4a7c-b9d2-6f5be4694618",
  "staffId": "900100",
  "emrPatientId": "123456",
  "familyName": "山田",
  "givenName": "太郎",
  "familyNameKana": "やまだ",
  "givenNameKana": "たろう",
  "jobTitle": "医師",
  "departmentId": "ER",
  "dateOfBirth": "1990-05-15",
  "sexCode": "1",
  "status": "active",
  "role": "STAFF",
  "version": 4,
  "pinMustChange": false,
  "pinRetryCount": 0,
  "pinLockedUntil": null,
  "lastLoginAt": "2025-11-03T09:00:00.000Z",
  "createdAt": "2025-04-01T00:00:00.000Z",
  "updatedAt": "2025-11-04T10:00:00.000Z"
}
```

#### エラー

| ステータス | 条件 | メッセージ |
|-----------|------|-----------|
| **400 Bad Request** | バリデーションエラー | 各フィールドのバリデーションメッセージ |
| **400 Bad Request** | EMR患者ID重複 | `"emrPatientId already exists."` |
| **401 Unauthorized** | 認証失敗 | `"Unauthorized"` |
| **403 Forbidden** | 管理者権限なし | `"Forbidden resource"` |
| **404 Not Found** | 職員が存在しない | `"Staff not found"` |
| **404 Not Found** | 部署が存在しない | `"Department not found"` |
| **409 Conflict** | バージョン不一致 | `"Version mismatch"` |

---

### 3.3 POST /api/admin/staffs/:staffUid/reset-pin（PINリセット）- 新規

#### 概要
管理者が職員のPINを初期値（`0000`）にリセットします。職員は次回ログイン時にPIN変更を要求されます。

#### 認証
必須（JWT Bearer認証 + 管理者権限）

#### リクエスト

**Path Parameters**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `staffUid` | string | ◯ | 職員UUID |

**Headers**:
```http
Authorization: Bearer <admin_access_token>
```

**Body**: なし

#### レスポンス

**成功 (204 No Content)**:
レスポンスボディなし

#### エラー

| ステータス | 条件 | メッセージ |
|-----------|------|-----------|
| **401 Unauthorized** | 認証失敗 | `"Unauthorized"` |
| **403 Forbidden** | 管理者権限なし | `"Forbidden resource"` |
| **404 Not Found** | 職員が存在しない | `"Staff not found"` |

#### 処理内容

1. PINを初期値（`0000`）でハッシュ化
2. 以下のフィールドを更新：
   - `pinHash`: 初期値のハッシュ
   - `pinMustChange`: `true` に設定
   - `pinRetryCount`: `0` にリセット
   - `pinLockedUntil`: `null` にリセット
   - `pinUpdatedAt`: 現在時刻に設定
   - `pinVersion`: インクリメント

---

## 4. バリデーション仕様

### 4.1 emrPatientId

- **形式**: 1-64桁の数字のみ（`^[0-9]{1,64}$`）
- **一意制約**: データベースレベルで`UNIQUE KEY`
- **重複チェック**: 更新前にSELECTクエリで確認、重複時は`400 Bad Request`

```typescript
// 重複チェックロジック
const existing = await staffRepo.findOne({
  where: { emrPatientId: dto.emrPatientId },
});
if (existing && existing.staffUid !== targetStaffUid) {
  throw new BadRequestException('emrPatientId already exists.');
}
```

### 4.2 departmentId

- **外部キー制約**: `departments.department_id` への参照
- **バリデーション**: 更新前に部署の存在を確認
- **存在しない場合**: `404 Not Found: "Department not found"`

```typescript
// 部署存在チェック
const department = await departmentRepo.findOne({
  where: { departmentId: dto.departmentId },
});
if (!department) {
  throw new NotFoundException('Department not found');
}
```

### 4.3 楽観的ロック（version）

- **必須パラメータ**: 更新リクエストには`version`が必須
- **不一致時**: `409 Conflict: "Version mismatch"`
- **TypeORM実装**: `@VersionColumn()`デコレータを使用

```typescript
// 楽観的ロック実装
const staff = await staffRepo.findOne({
  where: { staffUid },
});

if (staff.version !== dto.version) {
  throw new ConflictException('Version mismatch');
}

// TypeORMが自動的にversionをインクリメント
staff.emrPatientId = dto.emrPatientId;
await staffRepo.save(staff);
```

---

## 5. TDD実装順序（Red → Green）

### Phase 1: 本人更新API拡張（PATCH /api/staffs/me）

#### Step 1.1: 氏名フィールド更新のテスト追加（E2E Red）

**テストファイル**: `test/e2e/staffs-me.e2e-spec.ts`

**追加テストケース**:
```typescript
describe('PATCH /api/staffs/me - Name Fields', () => {
  it('should update familyName and givenName without PIN', async () => {
    // GIVEN: 職員が自身の氏名を更新
    const updateDto = {
      version: 0,
      familyName: '佐藤',
      givenName: '花子',
    };

    // WHEN: PATCH /api/staffs/me
    const response = await request(app.getHttpServer())
      .patch('/api/staffs/me')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(updateDto)
      .expect(200);

    // THEN: 氏名が更新される
    expect(response.body.familyName).toBe('佐藤');
    expect(response.body.givenName).toBe('花子');
    expect(response.body.version).toBe(1);
  });

  it('should update familyNameKana and givenNameKana without PIN', async () => {
    // 同様にカナの更新テスト
  });

  it('should fail with 400 if familyName exceeds 100 chars', async () => {
    // バリデーションエラーテスト
  });
});
```

#### Step 1.2: 実装（E2E Green）

**ファイル**: `src/staffs/dto/update-staff-me.dto.ts`

```typescript
export class UpdateStaffMeDto {
  @IsInt()
  @Min(0)
  version: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyNameKana?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenNameKana?: string;

  // 既存フィールド...
}
```

**ファイル**: `src/staffs/staffs.service.ts`

```typescript
async updateMe(
  staffUid: string,
  dto: UpdateStaffMeDto,
): Promise<Staff> {
  const staff = await this.staffRepo.findOne({ where: { staffUid } });

  // バージョンチェック
  if (staff.version !== dto.version) {
    throw new ConflictException('Version mismatch');
  }

  // 氏名フィールドの更新（PIN不要）
  if (dto.familyName !== undefined) {
    staff.familyName = dto.familyName;
  }
  if (dto.givenName !== undefined) {
    staff.givenName = dto.givenName;
  }
  if (dto.familyNameKana !== undefined) {
    staff.familyNameKana = dto.familyNameKana;
  }
  if (dto.givenNameKana !== undefined) {
    staff.givenNameKana = dto.givenNameKana;
  }

  // 重要項目のPIN再認証（既存ロジック継続）
  const criticalFieldsUpdating = !!(
    dto.emrPatientId || dto.dateOfBirth || dto.sexCode || dto.jobTitle || dto.departmentId
  );

  if (criticalFieldsUpdating) {
    if (!dto.currentPin) {
      throw new HttpException('PIN re-authentication required', 428);
    }
    // PIN検証ロジック...
  }

  // 部署IDバリデーション
  if (dto.departmentId) {
    const department = await this.departmentRepo.findOne({
      where: { departmentId: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    staff.departmentId = dto.departmentId;
  }

  // EMR患者ID重複チェック
  if (dto.emrPatientId) {
    const existing = await this.staffRepo.findOne({
      where: { emrPatientId: dto.emrPatientId },
    });
    if (existing && existing.staffUid !== staffUid) {
      throw new BadRequestException('emrPatientId already exists.');
    }
    staff.emrPatientId = dto.emrPatientId;
  }

  // その他フィールドの更新...

  return await this.staffRepo.save(staff);
}
```

---

### Phase 2: 管理者更新API（PATCH /api/admin/staffs/:staffUid）

#### Step 2.1: ルーティングとガードのテスト（E2E Red）

**テストファイル**: `test/e2e/admin-staffs.e2e-spec.ts`（新規作成）

**テストケース**:
```typescript
describe('Admin Staffs API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let targetStaffUid: string;

  beforeAll(async () => {
    // セットアップ: 管理者トークンと一般職員トークンを取得
    adminToken = await getAdminToken();
    staffToken = await getStaffToken();
    targetStaffUid = 'test-staff-uid';
  });

  describe('PATCH /api/admin/staffs/:staffUid', () => {
    it('should return 401 if not authenticated', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/staffs/${targetStaffUid}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(401);
    });

    it('should return 403 if not admin', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/staffs/${targetStaffUid}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(403);
    });

    it('should return 404 if staff not found', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/staffs/non-existent-uid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: 0, jobTitle: '看護師' })
        .expect(404);
    });

    it('should update staff as admin', async () => {
      const updateDto = {
        version: 0,
        jobTitle: '看護師',
        status: 'suspended',
        role: 'STAFF',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/admin/staffs/${targetStaffUid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.jobTitle).toBe('看護師');
      expect(response.body.status).toBe('suspended');
      expect(response.body.version).toBe(1);
    });
  });
});
```

#### Step 2.2: コントローラー・サービス実装（E2E Green）

**ファイル**: `src/staffs/admin-staffs.controller.ts`（新規作成）

```typescript
import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/guards/admin-token.guard';
import { StaffsService } from './staffs.service';
import { UpdateStaffAdminDto } from './dto/update-staff-admin.dto';

@Controller('admin/staffs')
@UseGuards(AdminTokenGuard)
export class AdminStaffsController {
  constructor(private readonly staffsService: StaffsService) {}

  @Patch(':staffUid')
  async updateStaff(
    @Param('staffUid') staffUid: string,
    @Body() dto: UpdateStaffAdminDto,
  ) {
    return await this.staffsService.updateStaffByAdmin(staffUid, dto);
  }
}
```

**ファイル**: `src/staffs/dto/update-staff-admin.dto.ts`（新規作成）

```typescript
import { IsInt, Min, IsOptional, IsString, Length, IsEnum } from 'class-validator';

export class UpdateStaffAdminDto {
  @IsInt()
  @Min(0)
  version: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyNameKana?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenNameKana?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{1,64}$/)
  emrPatientId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(['1', '2'])
  sexCode?: string;

  @IsOptional()
  @IsEnum(['active', 'suspended', 'left'])
  status?: string;

  @IsOptional()
  @IsEnum(['STAFF', 'ADMIN'])
  role?: string;
}
```

**ファイル**: `src/staffs/staffs.service.ts`

```typescript
async updateStaffByAdmin(
  staffUid: string,
  dto: UpdateStaffAdminDto,
): Promise<Staff> {
  const staff = await this.staffRepo.findOne({ where: { staffUid } });

  if (!staff) {
    throw new NotFoundException('Staff not found');
  }

  // バージョンチェック
  if (staff.version !== dto.version) {
    throw new ConflictException('Version mismatch');
  }

  // 部署IDバリデーション
  if (dto.departmentId) {
    const department = await this.departmentRepo.findOne({
      where: { departmentId: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    staff.departmentId = dto.departmentId;
  }

  // EMR患者ID重複チェック
  if (dto.emrPatientId) {
    const existing = await this.staffRepo.findOne({
      where: { emrPatientId: dto.emrPatientId },
    });
    if (existing && existing.staffUid !== staffUid) {
      throw new BadRequestException('emrPatientId already exists.');
    }
    staff.emrPatientId = dto.emrPatientId;
  }

  // 全フィールドの更新（管理者のみ可能なフィールドを含む）
  Object.assign(staff, {
    familyName: dto.familyName ?? staff.familyName,
    givenName: dto.givenName ?? staff.givenName,
    familyNameKana: dto.familyNameKana ?? staff.familyNameKana,
    givenNameKana: dto.givenNameKana ?? staff.givenNameKana,
    jobTitle: dto.jobTitle ?? staff.jobTitle,
    dateOfBirth: dto.dateOfBirth ?? staff.dateOfBirth,
    sexCode: dto.sexCode ?? staff.sexCode,
    status: dto.status ?? staff.status,
    role: dto.role ?? staff.role,
  });

  return await this.staffRepo.save(staff);
}
```

---

### Phase 3: PINリセットAPI（POST /api/admin/staffs/:staffUid/reset-pin）

#### Step 3.1: PINリセットのテスト（E2E Red）

**テストファイル**: `test/e2e/admin-staffs.e2e-spec.ts`

**テストケース**:
```typescript
describe('POST /api/admin/staffs/:staffUid/reset-pin', () => {
  it('should return 401 if not authenticated', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/staffs/${targetStaffUid}/reset-pin`)
      .expect(401);
  });

  it('should return 403 if not admin', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/staffs/${targetStaffUid}/reset-pin`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });

  it('should return 404 if staff not found', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/staffs/non-existent-uid/reset-pin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('should reset PIN and set pinMustChange to true', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/staffs/${targetStaffUid}/reset-pin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // 確認: pinMustChangeがtrueになっている
    const staff = await staffRepo.findOne({ where: { staffUid: targetStaffUid } });
    expect(staff.pinMustChange).toBe(true);
    expect(staff.pinRetryCount).toBe(0);
    expect(staff.pinLockedUntil).toBeNull();

    // 確認: 初期PIN（0000）でログイン可能
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ staffId: staff.staffId, pin: '0000' })
      .expect(200);

    expect(loginResponse.body.accessToken).toBeDefined();
  });
});
```

#### Step 3.2: 実装（E2E Green）

**ファイル**: `src/staffs/admin-staffs.controller.ts`

```typescript
@Post(':staffUid/reset-pin')
async resetPin(@Param('staffUid') staffUid: string) {
  await this.staffsService.resetPinByAdmin(staffUid);
}
```

**ファイル**: `src/staffs/staffs.service.ts`

```typescript
async resetPinByAdmin(staffUid: string): Promise<void> {
  const staff = await this.staffRepo.findOne({ where: { staffUid } });

  if (!staff) {
    throw new NotFoundException('Staff not found');
  }

  // 初期PIN（0000）をハッシュ化
  const pepper = this.configService.get<string>('PIN_PEPPER');
  const defaultPin = '0000';
  const pinHash = await argon2.hash(defaultPin + pepper);

  // PINリセット
  staff.pinHash = pinHash;
  staff.pinMustChange = true;
  staff.pinRetryCount = 0;
  staff.pinLockedUntil = null;
  staff.pinUpdatedAt = new Date();
  staff.pinVersion += 1;

  await this.staffRepo.save(staff);
}
```

---

## 6. E2Eテストマトリックス

### 6.1 本人更新API（PATCH /api/staffs/me）

| シナリオ | 期待結果 |
|---------|---------|
| 氏名フィールド更新（PIN不要） | `200 OK`, `version`インクリメント |
| カナフィールド更新（PIN不要） | `200 OK`, `version`インクリメント |
| 重要項目更新（PIN必須） | `currentPin`なし → `428`, あり → `200 OK` |
| 部署ID不正 | `404 Not Found: "Department not found"` |
| EMR患者ID重複 | `400 Bad Request: "emrPatientId already exists."` |
| バージョン不一致 | `409 Conflict: "Version mismatch"` |
| バリデーションエラー | `400 Bad Request` |

### 6.2 管理者更新API（PATCH /api/admin/staffs/:staffUid）

| シナリオ | 期待結果 |
|---------|---------|
| 管理者として職員情報更新 | `200 OK`, 全フィールド更新可 |
| 認証なし | `401 Unauthorized` |
| 一般職員として実行 | `403 Forbidden` |
| 職員が存在しない | `404 Not Found: "Staff not found"` |
| 部署ID不正 | `404 Not Found: "Department not found"` |
| EMR患者ID重複 | `400 Bad Request: "emrPatientId already exists."` |
| バージョン不一致 | `409 Conflict: "Version mismatch"` |
| status/role更新 | `200 OK`, 管理者のみ更新可 |

### 6.3 PINリセットAPI（POST /api/admin/staffs/:staffUid/reset-pin）

| シナリオ | 期待結果 |
|---------|---------|
| 管理者としてPINリセット | `204 No Content`, `pinMustChange=true` |
| 認証なし | `401 Unauthorized` |
| 一般職員として実行 | `403 Forbidden` |
| 職員が存在しない | `404 Not Found: "Staff not found"` |
| リセット後のログイン | 初期PIN（`0000`）でログイン可能 |
| リセット後のPIN変更要求 | `pinMustChange=true`が設定される |

---

## 7. ドキュメント更新

### 7.1 更新対象

| ファイル | 更新内容 |
|---------|---------|
| `docs/spec/07-Staff-API.md` | 本人更新API仕様の拡張（氏名フィールド追加） |
| `docs/spec/09-Admin-API.md` | 管理者更新API仕様の追加 |
| `docs/spec/03-Data-Model.md` | バリデーション仕様の明記（補足セクション） |
| `docs/spec/11-Authorization.md` | 権限マトリックスの更新 |

### 7.2 OpenAPI仕様

- 新規エンドポイントを`@nestjs/swagger`でドキュメント化
- DTO検証ルールをデコレータで明示
- エラーレスポンスを`@ApiResponse`で記載

---

## 8. Definition of Done

### 8.1 実装完了条件

- [ ] Phase 1: 本人更新API拡張のE2Eテスト全てpass
- [ ] Phase 2: 管理者更新APIのE2Eテスト全てpass
- [ ] Phase 3: PINリセットAPIのE2Eテスト全てpass
- [ ] 全てのバリデーション仕様がテストでカバーされる
- [ ] 楽観的ロック（`version`）が全てのケースで機能する
- [ ] RBAC（管理者権限チェック）が全てのadminルートで機能する

### 8.2 ドキュメント完了条件

- [ ] `07-Staff-API.md`に氏名フィールド更新仕様を追記
- [ ] `09-Admin-API.md`に管理者更新API仕様を追記
- [ ] OpenAPI仕様が最新の状態に更新される
- [ ] 権限マトリックスが更新される

### 8.3 CI/CD完了条件

- [ ] 全てのE2Eテストがローカルでpass
- [ ] 全てのE2EテストがCIでpass
- [ ] Lint/Format（prettier, eslint）がpass
- [ ] ビルドエラーなし

---

## 9. リスクと軽減策

### 9.1 権限管理の複雑性

**リスク**: 本人と管理者の権限境界が曖昧になる可能性

**軽減策**:
- 本人更新API（`/api/staffs/me`）と管理者更新API（`/api/admin/staffs/:staffUid`）を明確に分離
- E2Eテストで権限チェックを網羅的にカバー
- 403エラーと401エラーを明確に区別

### 9.2 データ整合性

**リスク**: EMR患者ID重複、部署FK違反

**軽減策**:
- データベースレベルでUNIQUE制約、FK制約を設定
- アプリケーションレベルで事前チェック
- トランザクション内で更新処理を実行

### 9.3 楽観的ロックの失敗

**リスク**: 複数ユーザーが同時に同一職員を更新

**軽減策**:
- `version`フィールドで楽観的ロックを実装
- 409エラーを返し、フロントエンドで再試行フローを実装
- E2Eテストで同時更新シナリオをカバー

---

## 10. 参考資料

- **[07-Staff-API.md](../spec/07-Staff-API.md)** - 既存の職員API仕様
- **[09-Admin-API.md](../spec/09-Admin-API.md)** - 管理者API概要
- **[03-Data-Model.md](../spec/03-Data-Model.md)** - staffsテーブル定義
- **[11-Authorization.md](../spec/11-Authorization.md)** - 権限管理仕様
- **[API_Refactoring_&_TDD_Plan.md](../API_Refactoring_&_TDD_Plan.md)** - TDD実装参考例

---

**作成日**: 2025-11-04 (JST)
**ステータス**: Draft
**次のステップ**: Phase 1からTDD実装を開始

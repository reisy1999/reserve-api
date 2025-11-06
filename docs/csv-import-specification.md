# 職員データCSVインポート実装確認書

## 概要
本ドキュメントは、職員データのCSVインポート機能をフロントエンドで実装する際の厳密な仕様を定義します。

---

## 1. APIエンドポイント

### エンドポイントURL
```
POST /api/admin/staffs/import
```

### 認証方式
リクエストヘッダーに以下を含める必要があります：
```
X-Admin-Token: {ADMIN_TOKEN環境変数の値}
```

**重要**: このエンドポイントは管理者専用であり、`X-Admin-Token`ヘッダーが必須です。

---

## 2. リクエスト仕様

### Content-Type
```
Content-Type: text/csv; charset=utf-8
```

### リクエストボディ
- UTF-8エンコードのCSVテキスト
- BOM（Byte Order Mark）付き・なし両方サポート
- 1行目はヘッダー行（必須）
- 2行目以降がデータ行

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 | デフォルト値 |
|-----------|-----|------|------|------------|
| dryRun | string | × | テストモード。`"true"`の場合、DBに保存せず検証のみ実行 | `"false"` |

#### 使用例
```
POST /api/admin/staffs/import?dryRun=true
```

---

## 3. CSVフォーマット仕様

### 3.1 必須ヘッダー列

CSVの1行目には以下の**5つの列名を完全一致で**含める必要があります：

| 列名 | 説明 | 備考 |
|------|------|------|
| 本部ID | 職員の一意識別子 | ※「職員ID」ではありません |
| 姓 | 職員の姓（苗字） | |
| 名 | 職員の名（名前） | |
| 部署ID | 所属部署の識別子 | |
| 職種 | 職員の職種 | |

**重要な注意点**:
- ヘッダー名は**全角・半角も含めて完全一致**する必要があります
- 列の順序は問いません（どの順番でも可）
- 余分な列があっても問題ありません（無視されます）

### 3.2 正しいCSVの例

```csv
本部ID,姓,名,部署ID,職種
12345,佐藤,太郎,Dr,医師
67890,鈴木,花子,Ns,看護師
11111,田中,次郎,ER,救急救命士
```

### 3.3 よくある間違い

❌ **間違い**: ヘッダーに「職員ID」を使用
```csv
職員ID,姓,名,部署ID,職種
12345,佐藤,太郎,Dr,医師
```

❌ **間違い**: 姓と名を結合した「名前」列を使用
```csv
本部ID,名前,部署ID,職種
12345,佐藤太郎,Dr,医師
```

---

## 4. バリデーションルール

### 4.1 本部ID（staffId）

| 項目 | 仕様 |
|------|------|
| 必須 | ✓ |
| 形式 | 半角数字のみ |
| 正規表現 | `^\d+$` |
| 例 | `12345`, `00001` |

**エラー例**:
- 空白: `"本部ID is required."`
- 文字含む: `"staffId must be numeric."`

### 4.2 姓（familyName）

| 項目 | 仕様 |
|------|------|
| 必須 | ✓ |
| 形式 | 任意の文字列（全角・半角可） |
| 最大長 | 255文字 |

**エラー例**:
- 空白: `"姓 is required."`

### 4.3 名（givenName）

| 項目 | 仕様 |
|------|------|
| 必須 | ✓ |
| 形式 | 任意の文字列（全角・半角可） |
| 最大長 | 255文字 |

**エラー例**:
- 空白: `"名 is required."`

### 4.4 部署ID（departmentId）

| 項目 | 仕様 |
|------|------|
| 必須 | ✓ |
| 形式 | 任意の文字列（全角・半角・記号可） |
| 最大長 | 255文字 |
| 自動作成 | 存在しない部署IDの場合、自動的に新規部署が作成される |

**エラー例**:
- 空白: `"部署ID is required."`

**注意**: 部署IDが存在しない場合、そのIDを持つ新しい部署が自動的に作成されます（部署名はIDと同じになります）。

### 4.5 職種（jobTitle）

| 項目 | 仕様 |
|------|------|
| 必須 | × (オプション) |
| 形式 | 任意の文字列（全角・半角可） |
| 最大長 | 255文字 |
| デフォルト値 | 空白の場合、`"未設定"` が設定される |

### 4.6 重複チェック

#### 4.6.1 ファイル内重複
同一CSVファイル内に同じ本部IDが複数回出現する場合：
- ステータス: `"duplicateInFile"`
- 理由: `"Duplicate staffId within uploaded file."`
- **すべての該当行がスキップされます**

#### 4.6.2 既存データとの重複
データベースに既に同じ本部IDが存在する場合：
- ステータス: `"skippedExisting"`
- 既存のレコードは変更されません
- エラーではなく、正常な動作として扱われます

---

## 5. レスポンス仕様

### 5.1 成功レスポンス

#### ステータスコード
```
201 Created
```

#### レスポンスボディ構造
```typescript
{
  "summary": {
    "created": number,           // 新規作成された職員数
    "skippedExisting": number,   // 既存のためスキップされた数
    "skippedInvalid": number,    // バリデーションエラーでスキップされた数
    "duplicateInFile": number,   // ファイル内で重複していた数
    "warnings": string[]         // 警告メッセージの配列
  },
  "rows": [
    {
      "rowNumber": number,       // CSV内の行番号（ヘッダーを1行目として）
      "staffId": string | null,  // 本部ID
      "status": "created" | "skippedExisting" | "skippedInvalid" | "duplicateInFile",
      "reason": string[]         // エラーがある場合のエラー理由配列
    }
  ],
  "importBatchId": string        // インポートバッチID（dryRun=trueの場合は存在しない）
}
```

#### レスポンス例（成功）
```json
{
  "summary": {
    "created": 2,
    "skippedExisting": 0,
    "skippedInvalid": 0,
    "duplicateInFile": 0,
    "warnings": []
  },
  "rows": [
    {
      "rowNumber": 2,
      "staffId": "12345",
      "status": "created"
    },
    {
      "rowNumber": 3,
      "staffId": "67890",
      "status": "created"
    }
  ],
  "importBatchId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### レスポンス例（バリデーションエラーあり）
```json
{
  "summary": {
    "created": 1,
    "skippedExisting": 0,
    "skippedInvalid": 1,
    "duplicateInFile": 0,
    "warnings": []
  },
  "rows": [
    {
      "rowNumber": 2,
      "staffId": "12345",
      "status": "created"
    },
    {
      "rowNumber": 3,
      "staffId": "abc",
      "status": "skippedInvalid",
      "reason": [
        "staffId must be numeric."
      ]
    }
  ],
  "importBatchId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### レスポンス例（既存データスキップ）
```json
{
  "summary": {
    "created": 1,
    "skippedExisting": 1,
    "skippedInvalid": 0,
    "duplicateInFile": 0,
    "warnings": []
  },
  "rows": [
    {
      "rowNumber": 2,
      "staffId": "12345",
      "status": "created"
    },
    {
      "rowNumber": 3,
      "staffId": "67890",
      "status": "skippedExisting"
    }
  ],
  "importBatchId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 5.2 エラーレスポンス

#### 認証エラー（401 Unauthorized）
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**原因**: `X-Admin-Token`ヘッダーがないか、トークンが無効

#### CSVパースエラー（400 Bad Request）
CSVの形式が不正な場合（例: ヘッダー行がない、形式が壊れているなど）

```json
{
  "statusCode": 400,
  "message": "Invalid CSV format"
}
```

---

## 6. 作成される職員データの初期値

CSVインポートで作成される職員には、以下の初期値が自動設定されます：

| フィールド | 初期値 | 説明 |
|-----------|--------|------|
| staffUid | UUID v4 | システムが自動生成する一意識別子 |
| familyNameKana | `null` | 姓（カナ） |
| givenNameKana | `null` | 名（カナ） |
| emrPatientId | `null` | 電子カルテ患者ID |
| dateOfBirth | `"1900-01-01"` | 生年月日（仮の値） |
| sexCode | `"1"` | 性別（1=男性、仮の値） |
| pinHash | ハッシュ化された`"0000"` | 初期PIN |
| pinMustChange | `true` | PIN変更必須フラグ |
| pinRetryCount | `0` | PINエラー回数 |
| pinLockedUntil | `null` | アカウントロック日時 |
| status | `"active"` | 職員ステータス |
| role | `"STAFF"` | 権限ロール |
| version | `0` | 楽観的ロックバージョン |

**重要**:
- 初期PINは `0000` です
- 初回ログイン時にPIN変更が必須となります

---

## 7. 実装のベストプラクティス

### 7.1 dryRunの活用

本番インポート前に必ず`dryRun=true`でテスト実行することを推奨します：

```javascript
// ステップ1: テスト実行
const testResponse = await fetch('/api/admin/staffs/import?dryRun=true', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'X-Admin-Token': adminToken
  },
  body: csvContent
});

const testResult = await testResponse.json();

// エラーや警告をユーザーに表示
if (testResult.summary.skippedInvalid > 0 || testResult.summary.duplicateInFile > 0) {
  // エラー詳細を表示し、ユーザーに確認を求める
  displayErrors(testResult.rows.filter(r => r.reason));
}

// ステップ2: ユーザーが確認後、本番実行
if (userConfirmed) {
  const realResponse = await fetch('/api/admin/staffs/import?dryRun=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Admin-Token': adminToken
    },
    body: csvContent
  });
}
```

### 7.2 エラーハンドリング

```javascript
const response = await fetch('/api/admin/staffs/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'X-Admin-Token': adminToken
  },
  body: csvContent
});

if (response.status === 401) {
  // 認証エラー
  showError('管理者トークンが無効です');
  return;
}

if (!response.ok) {
  // その他のエラー
  const error = await response.json();
  showError(`インポートに失敗しました: ${error.message}`);
  return;
}

const result = await response.json();

// 成功時の処理
console.log(`${result.summary.created}件の職員を作成しました`);
console.log(`${result.summary.skippedExisting}件は既に登録済みです`);
console.log(`${result.summary.skippedInvalid}件にエラーがあります`);
```

### 7.3 ユーザーへのフィードバック

結果サマリーと詳細を分けて表示することを推奨します：

```javascript
// サマリー表示
const summary = result.summary;
showSummary({
  total: result.rows.length,
  created: summary.created,
  skipped: summary.skippedExisting,
  errors: summary.skippedInvalid + summary.duplicateInFile
});

// エラー詳細表示
const errorRows = result.rows.filter(row => row.reason && row.reason.length > 0);
if (errorRows.length > 0) {
  showErrorDetails(errorRows);
}
```

---

## 8. テストケース

フロントエンド実装時には、以下のケースでテストすることを推奨します：

### 8.1 正常系

1. **最小構成のCSV**
   ```csv
   本部ID,姓,名,部署ID,職種
   12345,佐藤,太郎,Dr,医師
   ```

2. **複数行のCSV**
   ```csv
   本部ID,姓,名,部署ID,職種
   12345,佐藤,太郎,Dr,医師
   67890,鈴木,花子,Ns,看護師
   11111,田中,次郎,ER,救急救命士
   ```

3. **職種が空のCSV**
   ```csv
   本部ID,姓,名,部署ID,職種
   12345,佐藤,太郎,Dr,
   ```

4. **列の順序が異なるCSV**
   ```csv
   姓,名,職種,部署ID,本部ID
   佐藤,太郎,医師,Dr,12345
   ```

### 8.2 異常系

1. **本部IDが数字以外**
   ```csv
   本部ID,姓,名,部署ID,職種
   ABC123,佐藤,太郎,Dr,医師
   ```

2. **必須項目が空白**
   ```csv
   本部ID,姓,名,部署ID,職種
   12345,,太郎,Dr,医師
   ```

3. **ヘッダーが間違っている**
   ```csv
   職員ID,姓,名,部署ID,職種
   12345,佐藤,太郎,Dr,医師
   ```

4. **同一ファイル内で本部IDが重複**
   ```csv
   本部ID,姓,名,部署ID,職種
   12345,佐藤,太郎,Dr,医師
   12345,鈴木,花子,Ns,看護師
   ```

5. **既存の本部IDを含むCSV** (skippedExistingとなることを確認)

### 8.3 dryRunモード

- `dryRun=true`で実行した後、データベースに追加されていないことを確認
- `dryRun=true`と`dryRun=false`で同じCSVを実行し、結果が一致することを確認（importBatchIdの有無を除く）

---

## 9. よくある質問（FAQ）

### Q1: CSVの文字コードは何ですか？
**A**: UTF-8を使用してください。BOM（Byte Order Mark）の有無は問いません。

### Q2: 列の順序を変えても問題ありませんか？
**A**: はい、列の順序は自由です。ヘッダー名で列を識別します。

### Q3: 余分な列があっても問題ありませんか？
**A**: はい、APIは必要な列のみを使用し、余分な列は無視します。

### Q4: 既存の職員と同じ本部IDを含むCSVをインポートするとどうなりますか？
**A**: その行は`skippedExisting`ステータスとなり、既存データは変更されません。

### Q5: 部署IDが存在しない場合はどうなりますか？
**A**: 新しい部署が自動的に作成されます。部署名は部署IDと同じになります。

### Q6: 職種を空にした場合はどうなりますか？
**A**: 自動的に"未設定"という値が設定されます。

### Q7: dryRunモードと本番モードの違いは何ですか？
**A**: dryRunモードでは、バリデーションは実行されますが、データベースへの書き込みは行われません。また、importBatchIdも生成されません。

### Q8: 1回のリクエストで何件までインポートできますか？
**A**: 技術的な上限は設定されていませんが、大量データの場合はタイムアウトの可能性があります。数百〜数千件程度を推奨します。

---

## 10. 完全なサンプルコード（JavaScript/TypeScript）

```typescript
interface ImportSummary {
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  duplicateInFile: number;
  warnings: string[];
}

interface ImportRowResult {
  rowNumber: number;
  staffId: string | null;
  status: 'created' | 'skippedExisting' | 'skippedInvalid' | 'duplicateInFile';
  reason?: string[];
}

interface ImportResponse {
  summary: ImportSummary;
  rows: ImportRowResult[];
  importBatchId?: string;
}

async function importStaffCsv(
  csvContent: string,
  adminToken: string,
  dryRun: boolean = false
): Promise<ImportResponse> {
  const url = `/api/admin/staffs/import?dryRun=${dryRun}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Admin-Token': adminToken
    },
    body: csvContent
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('認証に失敗しました。管理者トークンを確認してください。');
    }
    const error = await response.json();
    throw new Error(`インポートに失敗しました: ${error.message || '不明なエラー'}`);
  }

  return await response.json();
}

// 使用例
async function handleCsvUpload(file: File, adminToken: string) {
  try {
    // ファイル読み込み
    const csvContent = await file.text();

    // ステップ1: テストモードで実行
    console.log('テストモードで検証中...');
    const testResult = await importStaffCsv(csvContent, adminToken, true);

    // 結果の確認
    console.log('テスト結果:', testResult.summary);

    const hasErrors = testResult.summary.skippedInvalid > 0 ||
                     testResult.summary.duplicateInFile > 0;

    if (hasErrors) {
      // エラーがある場合は詳細を表示
      const errorRows = testResult.rows.filter(row => row.reason);
      console.error('以下の行にエラーがあります:', errorRows);

      // ユーザーに確認を求める
      const shouldContinue = confirm(
        `${testResult.summary.skippedInvalid + testResult.summary.duplicateInFile}件のエラーがあります。\n` +
        `正常な${testResult.summary.created}件のみをインポートしますか？`
      );

      if (!shouldContinue) {
        return;
      }
    }

    // ステップ2: 本番実行
    console.log('本番インポート実行中...');
    const realResult = await importStaffCsv(csvContent, adminToken, false);

    // 成功メッセージ
    alert(
      `インポートが完了しました！\n` +
      `作成: ${realResult.summary.created}件\n` +
      `スキップ（既存）: ${realResult.summary.skippedExisting}件\n` +
      `エラー: ${realResult.summary.skippedInvalid + realResult.summary.duplicateInFile}件`
    );

    console.log('インポートバッチID:', realResult.importBatchId);

  } catch (error) {
    console.error('インポートエラー:', error);
    alert(`エラーが発生しました: ${error.message}`);
  }
}
```

---

## 11. チェックリスト

フロントエンド実装完了前に、以下の項目を確認してください：

- [ ] CSVヘッダーに「本部ID」「姓」「名」「部署ID」「職種」を含めている
- [ ] `Content-Type: text/csv; charset=utf-8`ヘッダーを設定している
- [ ] `X-Admin-Token`ヘッダーを設定している
- [ ] dryRunモードでテスト実行する機能を実装している
- [ ] レスポンスのsummaryをユーザーに表示している
- [ ] エラー行（reasonがある行）を詳細表示している
- [ ] 401エラー時の処理を実装している
- [ ] 正常系・異常系のテストケースを実行している

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-06 | 1.0.0 | 初版作成 |

---

## お問い合わせ

本仕様書に関する質問や不明点がある場合は、バックエンド開発チームまでお問い合わせください。

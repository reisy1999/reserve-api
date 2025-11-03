# 予約管理システム 仕様書インデックス

## 📋 仕様書構成

### 第1部：システム概要
- **[01-Overview.md](./01-Overview.md)** - システム概要・目的・用語集
- **[02-Architecture.md](./02-Architecture.md)** - システムアーキテクチャ・技術スタック

### 第2部：データ設計
- **[03-Data-Model.md](./03-Data-Model.md)** - ER図・テーブル定義・リレーション
- **[04-Entity-Specifications.md](./04-Entity-Specifications.md)** - エンティティ詳細仕様

### 第3部：API仕様
- **[05-API-Overview.md](./05-API-Overview.md)** - APIエンドポイント一覧・共通仕様
- **[06-Auth-API.md](./06-Auth-API.md)** - 認証API（login/refresh）
- **[07-Staff-API.md](./07-Staff-API.md)** - 職員API（プロフィール/PIN変更）
- **[08-Reservation-API.md](./08-Reservation-API.md)** - 予約API
- **[09-Admin-API.md](./09-Admin-API.md)** - 管理者API（インポート/枠管理）

### 第4部：認証・セキュリティ
- **[10-Authentication.md](./10-Authentication.md)** - 認証フロー・JWTトークン仕様
- **[11-Authorization.md](./11-Authorization.md)** - 認可・ロール・アクセス制御
- **[12-Security.md](./12-Security.md)** - セキュリティ要件・PIN管理

### 第5部：ビジネスロジック
- **[13-Business-Rules.md](./13-Business-Rules.md)** - 業務ルール・制約条件
- **[14-Validation.md](./14-Validation.md)** - バリデーション仕様
- **[15-State-Transitions.md](./15-State-Transitions.md)** - 状態遷移図

### 第6部：運用
- **[16-Deployment.md](./16-Deployment.md)** - デプロイ手順・環境構築
- **[17-Operations.md](./17-Operations.md)** - 運用手順・バックアップ・監視
- **[18-Troubleshooting.md](./18-Troubleshooting.md)** - トラブルシューティング

### 付録
- **[19-Error-Codes.md](./19-Error-Codes.md)** - エラーコード一覧
- **[20-Glossary.md](./20-Glossary.md)** - 用語集
- **[21-Change-Log.md](./21-Change-Log.md)** - 変更履歴

---

## 🎯 対象読者別ガイド

### プロダクトオーナー・ビジネス側
- 第1部：システム概要
- 第5部：ビジネスロジック
- 付録：用語集

### 開発者
- 全章（特に第2-4部）

### インフラ・運用担当者
- 第1部：システム概要
- 第2部：データ設計（バックアップ対象）
- 第6部：運用

### QA・テスター
- 第3部：API仕様
- 第5部：ビジネスロジック
- 付録：エラーコード一覧

---

## 📖 読み方のガイド

### 新規参画者（初めて読む場合）
1. **01-Overview.md** でシステム全体を把握
2. **03-Data-Model.md** でデータ構造を理解
3. **05-API-Overview.md** でAPI全体像を把握
4. **13-Business-Rules.md** で業務ルールを理解

### API実装者
1. **05-API-Overview.md** で共通仕様を確認
2. 対応する API 仕様（06-09）を参照
3. **13-Business-Rules.md** で制約条件を確認
4. **14-Validation.md** でバリデーションを実装

### 運用担当者
1. **16-Deployment.md** でデプロイ手順を確認
2. **17-Operations.md** で日次運用を理解
3. **18-Troubleshooting.md** をブックマーク

---

## 📝 仕様書記法

### マークダウン記法
- 見出しは `#` で階層化
- コードブロックは言語指定（```typescript）
- テーブルは GitHub Flavored Markdown

### API仕様記法
```markdown
## POST /api/endpoint

**概要**: エンドポイントの説明

**認証**: 必要 / 不要

**リクエスト**:
| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| field     | string | ◯ | 説明 |

**レスポンス** (200 OK):
```json
{
  "key": "value"
}
```

**エラー**:
- 400: バリデーションエラー
- 401: 認証エラー
```

### ER図記法
- Mermaid記法を使用
- テーブル定義はマークダウンテーブル

---

## 🔄 更新履歴

このインデックスは仕様書全体の目次です。各章の詳細な変更履歴は **21-Change-Log.md** を参照してください。

---

## ✅ レビュー状態

| 章 | 初稿 | レビュー | 承認 | 備考 |
|----|-----|---------|------|------|
| 01 | - | - | - | 作成予定 |
| 02 | - | - | - | 作成予定 |
| ... | - | - | - | - |

---

## 📞 問い合わせ

仕様書に関する質問・修正依頼は以下へ：
- GitHub Issues: [プロジェクトリポジトリ]
- Slack: #reserve-api-dev

---

**最終更新**: 2025-11-03
**バージョン**: 1.0.0-draft

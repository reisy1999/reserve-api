// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import jestPlugin from 'eslint-plugin-jest';

export default tseslint.config(
  // 1) 無視対象
  {
    ignores: ['node_modules/**', 'dist/**', '.turbo/**'],
  },

  // 2) ベース推奨（JS + TS/型チェック）
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // 3) 言語/パーサ設定
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true, // 型情報を使ったlint
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 4) ルール（実害=error / 学習阻害=warn / 整形=Prettier）
  {
    rules: {
      // --- 実害系（Error） ---
      eqeqeq: 'error',
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: true },
      ],
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // --- 学習阻害しにくい系（Warn） ---
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-ignore': 'allow-with-description' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // --- 整形はPrettierに委譲 ---
      // Prettierの実際の適用は "eslint-plugin-prettier/recommended"（最後のブロック）で行う
    },
  },

  // 5) Prettier を最後に（整形系ルール無効化＋フォーマッタ適用）
  eslintPluginPrettierRecommended,

  // 6) 任意：行末コード差異の吸収（Windows混在対策）
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // 7) テストファイルのオーバーライド
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // 健全性チェック（最小）
      'jest/expect-expect': 'error', // 断言漏れ防止
      'jest/no-identical-title': 'error', // タイトル重複禁止
      'jest/no-disabled-tests': 'warn', // skip放置の可視化
      'jest/valid-expect': 'error', // expectの誤用検知
      'jest/prefer-called-with': 'warn', // モック呼び出しの引数検証を促す

      // テストでのconsoleは許容（デバッグ容易化）
      'no-console': 'off',
      // any許容（テスト柔軟性を優先）
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);

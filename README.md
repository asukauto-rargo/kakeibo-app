# 家計簿アプリ (Kakeibo App)

Supabase + Vite + React + TypeScript で構築した家計簿Webアプリケーションです。

## 機能

- ログイン認証（Supabase Auth）
- 支出・収入の記録（18種類の支出カテゴリ、4種類の収入カテゴリ）
- レシート画像アップロード → OCR自動読取（Tesseract.js）
- 固定費の登録と毎月自動記録
- 月別サマリー（収支切替、円グラフ、ユーザー比較）
- カテゴリ別月間目標設定
- 一覧フィルタ（カテゴリ・日付・ユーザー）
- CSVエクスポート
- 3ユーザー対応

## セットアップ

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でアカウント作成・ログイン
2. 「New Project」で新しいプロジェクトを作成（リージョン: Tokyo推奨）
3. SQL Editor で `setup.sql`（Supabase版フォルダ内）を実行してテーブルを作成
4. Authentication → Users からログイン用ユーザーを作成
5. Project Settings → API から **Project URL** と **anon public key** をコピー

### 2. Supabase Storage（レシート画像保存用）

SQL Editor で以下を実行:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true);

CREATE POLICY "Auth users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receipts');
```

### 3. ローカル開発

```bash
cd kakeibo-app
cp .env.example .env
# .env を編集して Supabase の URL と ANON KEY を設定

npm install
npm run dev
```

ブラウザで `http://localhost:5173/kakeibo-app/` を開く。

### 4. GitHub Pages デプロイ

#### リポジトリ作成

```bash
cd kakeibo-app
git init
git add .
git commit -m "Initial commit"
gh repo create kakeibo-app --public --source=. --push
```

#### Secrets 設定

GitHub リポジトリの Settings → Secrets and variables → Actions で以下を追加:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Supabase の Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase の anon public key |

#### Pages 有効化

Settings → Pages → Source を **GitHub Actions** に変更。

#### デプロイ実行

`main` ブランチにプッシュすると自動でビルド・デプロイされます。

```bash
git push origin main
```

デプロイ後のURL: `https://<ユーザー名>.github.io/kakeibo-app/`

#### Supabase リダイレクトURL設定

Supabase ダッシュボードの Authentication → URL Configuration で、
Site URL に GitHub Pages の URL を設定してください。

## 技術スタック

- **Frontend**: React 18 + TypeScript
- **Build**: Vite 6
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **OCR**: Tesseract.js 5 (日本語+英語)
- **Deploy**: GitHub Pages + GitHub Actions
# Updated

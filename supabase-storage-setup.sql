-- ============================================
-- Supabase Storage: receipts バケット作成
-- ============================================
-- レシート画像を保存するためのバケットを作成します。
-- Supabase ダッシュボード → SQL Editor で実行してください。

-- バケット作成（公開読み取り可能）
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 認証ユーザーがアップロードできるポリシー
CREATE POLICY "Auth users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 誰でも閲覧できるポリシー（公開バケット）
CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receipts');

-- 認証ユーザーが自分のファイルを削除できるポリシー
CREATE POLICY "Auth users can delete receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts');

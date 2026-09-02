-- Migration 0016: Tạo public bucket 'club-assets' và thiết lập phân quyền (RLS) cho Supabase Storage.
-- Bucket này dùng để lưu trữ ảnh đại diện (Avatar) của CLB, tài khoản, thành viên, và ảnh mã QR.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-assets',
  'club-assets',
  true,
  2097152, -- Giới hạn 2MB / file
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy 1: Mọi người đều có quyền đọc ảnh công khai (Public Read qua CDN)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Read Club Assets'
  ) THEN
    CREATE POLICY "Public Read Club Assets"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'club-assets');
  END IF;
END $$;

-- Policy 2: Người dùng đã đăng nhập có quyền tải ảnh lên (Upload)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated Upload Club Assets'
  ) THEN
    CREATE POLICY "Authenticated Upload Club Assets"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'club-assets');
  END IF;
END $$;

-- Policy 3: Người dùng đã đăng nhập có quyền cập nhật ảnh (Update)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated Update Club Assets'
  ) THEN
    CREATE POLICY "Authenticated Update Club Assets"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'club-assets');
  END IF;
END $$;

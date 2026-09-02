-- Migration 0017: Siết quyền ghi trên bucket 'club-assets'.
--
-- LỖ HỔNG Ở 0016: policy UPDATE chỉ kiểm tra `bucket_id` — bất kỳ tài khoản đã đăng nhập nào
-- cũng ghi đè được ảnh của người khác. Kèm `upsert: true` phía client thì INSERT cũng biến
-- thành ghi đè. Với bucket đang chứa ảnh QR nhận tiền, đó là đường đổi số tài khoản của CLB.
--
-- SAU MIGRATION: chỉ người đã tải file lên (`storage.objects.owner`) mới sửa / xoá được file đó.
--
-- KHÔNG đụng policy SELECT: bucket vẫn public để CDN phục vụ ảnh avatar.
-- KHÔNG siết INSERT: tên file do client sinh ngẫu nhiên và `upsert` đã tắt, nên INSERT chỉ tạo
-- được object MỚI, không đè lên được cái đang có.

BEGIN;

DROP POLICY IF EXISTS "Authenticated Update Club Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner Update Club Assets" ON storage.objects;

CREATE POLICY "Owner Update Club Assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'club-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'club-assets' AND owner = auth.uid());

-- 0016 không có policy DELETE nào → không ai xoá được file, ảnh cũ nằm lại vĩnh viễn.
DROP POLICY IF EXISTS "Owner Delete Club Assets" ON storage.objects;

CREATE POLICY "Owner Delete Club Assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'club-assets' AND owner = auth.uid());

COMMIT;

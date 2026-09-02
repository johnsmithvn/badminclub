-- Migration 0012: Thêm cột map_url cho bảng courts (đường dẫn Google Maps / link vị trí sân).
-- Hỗ trợ lưu URL bản đồ và mở liên kết trực tiếp trên giao diện.

ALTER TABLE courts ADD COLUMN IF NOT EXISTS map_url text;

COMMENT ON COLUMN courts.map_url IS 'Đường dẫn bản đồ vị trí sân (Google Maps URL)';

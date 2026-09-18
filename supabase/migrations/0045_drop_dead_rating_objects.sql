-- 0045_drop_dead_rating_objects.sql
-- Dọn hai thứ chưa bao giờ được dùng ở tầng rating:
--   1. player_ratings.rating_deviation — app KHÔNG tính độ lệch chuẩn ở bất kỳ đâu, cột này chỉ
--      nhận đi nhận lại đúng giá trị mặc định 350. Nó từng nuôi một nhánh chết trong
--      `confidenceOf()` khiến người đọc code tin rằng hệ có đo độ lệch.
--   2. public.player_rating_context — tạo ở 0021, chưa từng có một dòng INSERT hay SELECT nào
--      trong mã nguồn (không có trong dbmap.js, không có trong storage.js).
--
-- ⚠️ ĐÂY LÀ LỆNH XOÁ. Chạy thủ công bằng psql -f, KHÔNG dùng `supabase db reset`.
-- Khối DO ở dưới sẽ HUỶ giao dịch nếu phát hiện có dữ liệu thật, để không xoá nhầm.
--
-- Muốn quay lại mô hình có độ lệch (Glicko) thì viết migration mới dựng lại cột + sửa
-- `calcPlayerDeltas`, chứ không phải khôi phục một cột hằng số.

BEGIN;

-- 1. Chỉ xoá cột khi MỌI dòng đều đang ở đúng giá trị mặc định 350.
DO $$
DECLARE
  odd_rows integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_ratings' AND column_name = 'rating_deviation'
  ) THEN
    SELECT count(*) INTO odd_rows
    FROM public.player_ratings
    WHERE rating_deviation IS DISTINCT FROM 350;

    IF odd_rows > 0 THEN
      RAISE EXCEPTION
        'Có % dòng player_ratings.rating_deviation khác 350 — nghĩa là đã có ai đó ghi dữ liệu thật vào cột này. DỪNG, không xoá. Kiểm tra lại trước khi chạy tiếp.',
        odd_rows;
    END IF;

    ALTER TABLE public.player_ratings DROP COLUMN rating_deviation;
  END IF;
END $$;

-- 2. Bảng bối cảnh rating: chỉ xoá khi rỗng.
DO $$
DECLARE
  ctx_rows integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'player_rating_context'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.player_rating_context' INTO ctx_rows;

    IF ctx_rows > 0 THEN
      RAISE EXCEPTION
        'Bảng player_rating_context đang có % dòng — không còn là bảng chết nữa. DỪNG, không xoá.',
        ctx_rows;
    END IF;

    DROP TABLE public.player_rating_context;
  END IF;
END $$;

COMMIT;

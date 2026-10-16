-- 0068_match_challenge_set_no.sql — Chặn ghi trùng một ván kèo.
--
-- Hai người cùng ghi sân trên hai máy: máy B chưa nạp lại nên vẫn thấy kèo "chưa đánh" dù máy A
-- đã ghi xong → B ghi thêm một trận nữa cho cùng kèo. Mỗi máy tự sinh id trận nên DB không thấy
-- gì là trùng, cùng một kèo ra hai dòng `matches`.
--
-- Cách chặn: mỗi trận của kèo mang số ván `set_no` (BO1 = 1; BO3 = 1, 2, 3), và một kèo không được
-- có hai trận cùng số ván. Máy đang giữ dữ liệu cũ luôn tính ra một số ván ĐÃ CÓ (nó không biết
-- ván mới nhất) → Postgres từ chối bằng 23505 → app nạp lại từ DB (`setSyncFatalHandler`).
--
-- CHỈ THÊM MỚI, chạy lại được bao nhiêu lần cũng được:
--   1. Cột `matches.set_no` (NULL với trận thường).
--   2. Đánh số cho trận kèo cũ theo thứ tự thời gian. Kèo đã bị ghi trùng trước đây được đánh 1, 2…
--      nên index không vỡ — dọn bản trùng bằng nút "Huỷ trận" trong app (tự tính lại Elo).
--   3. Unique (challenge_id, set_no). Dòng set_no NULL không bị ràng buộc: bản app cũ còn trong cache
--      ghi trận không có set_no vẫn lưu được như trước.
--
-- Không đụng Elo / điểm mùa.
-- Kiểm tra sau khi chạy: supabase/manual/0068_match_challenge_set_no_check.sql (tự huỷ, không để lại dữ liệu).

BEGIN;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS set_no smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = 'matches' AND constraint_name = 'matches_set_no_check'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_set_no_check CHECK (set_no IS NULL OR set_no >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.matches.set_no IS
  'Ván thứ mấy của kèo (1-based). NULL với trận thường. Unique theo (challenge_id, set_no) để hai máy không ghi trùng một ván.';

-- Chỉ đánh số kèo CHƯA có ván nào mang số: chạy lại không đánh số lại kèo app đã ghi set_no.
UPDATE public.matches m
   SET set_no = r.rn
  FROM (
    SELECT id, row_number() OVER (PARTITION BY challenge_id ORDER BY ended_at, id) AS rn
      FROM public.matches
     WHERE challenge_id IN (
       SELECT challenge_id FROM public.matches
        WHERE challenge_id IS NOT NULL
        GROUP BY challenge_id
       HAVING bool_and(set_no IS NULL)
     )
  ) r
 WHERE m.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_challenge_set
  ON public.matches (challenge_id, set_no)
  WHERE challenge_id IS NOT NULL AND set_no IS NOT NULL;

COMMIT;

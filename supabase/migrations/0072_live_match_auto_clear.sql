-- 0072_live_match_auto_clear.sql — Trận đã ghi thì trận nháp trên sân TỰ biến mất, ngay trong DB.
--
-- Vì sao: ghi tỉ số từ trận nháp (0069), app gửi ~10 lệnh lên DB lần lượt — lưu trận, người chơi,
-- kèo, Elo… — và lệnh XOÁ trận nháp đứng CUỐI (xoá luôn chạy sau ghi, vì khoá ngoại). Khoá màn hình,
-- chuyển app, tải lại hay mạng chập một nhịp trước lệnh cuối là trận đã lưu nhưng nháp nằm lại DB:
-- máy nào tải lại cũng thấy trận vừa ghi "bay" lại lên sân, bấm ghi thì bị báo "đã được ghi".
--
-- Cách làm:
--   1. Trigger trên `matches`: dòng trận mang `live_id` vừa chèn (hoặc vừa gắn) là xoá trận nháp đó
--      CÙNG giao dịch. Trận đã nằm trong DB thì nháp chắc chắn đã đi — không còn phụ thuộc lệnh cuối
--      của app. Chỉ xoá nháp CÙNG buổi với trận. Lệnh xoá của app tới sau thì xoá 0 dòng, không lỗi.
--   2. Dọn một lần các nháp đang sót:
--      a. nháp đã có trận mang đúng mã của nó;
--      b. nháp mà ĐÚNG những người đó (không kể chia đội) đã có trận cùng buổi ghi lúc / sau khi xếp —
--         người kia ghi từ khung sân của họ, hoặc máy còn bản app cũ. Giống hệt `assign.js: isLiveDone`.
--
-- Không đụng Elo / điểm mùa. Chạy lại được bao nhiêu lần cũng được.
-- Kiểm tra sau khi chạy: supabase/manual/0072_live_match_auto_clear_check.sql (tự huỷ).

BEGIN;

CREATE OR REPLACE FUNCTION public.matches_clear_live()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- DEFINER: người ghi trận (đã qua RLS của `matches`) không cần thêm quyền gì để nháp của chính trận
  -- đó rời sân. Ràng buộc cùng buổi để một `live_id` bịa không xoá được nháp của buổi / CLB khác.
  DELETE FROM session_live_matches
   WHERE id = NEW.live_id AND session_id = NEW.session_id;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.matches_clear_live() FROM PUBLIC;

DROP TRIGGER IF EXISTS matches_clear_live ON public.matches;
CREATE TRIGGER matches_clear_live
  AFTER INSERT OR UPDATE OF live_id ON public.matches
  FOR EACH ROW
  WHEN (NEW.live_id IS NOT NULL)
  EXECUTE FUNCTION public.matches_clear_live();

DO $$
DECLARE
  n_id   int;
  n_same int;
BEGIN
  DELETE FROM session_live_matches l
   USING matches m
   WHERE m.live_id = l.id;
  GET DIAGNOSTICS n_id = ROW_COUNT;

  DELETE FROM session_live_matches l
   WHERE EXISTS (
     SELECT 1 FROM matches m
      WHERE m.session_id = l.session_id
        AND m.ended_at >= l.started_at
        AND (SELECT array_agg(mp.player_id::text ORDER BY mp.player_id::text)
               FROM match_players mp WHERE mp.match_id = m.id)
          = (SELECT array_agg(x ORDER BY x)
               FROM unnest(l.team_a || l.team_b) AS x
              WHERE x IS NOT NULL AND x <> '')
   );
  GET DIAGNOSTICS n_same = ROW_COUNT;

  RAISE NOTICE '0072: dọn % trận nháp đã ghi (cùng mã) + % trận nháp đã ghi (cùng người)', n_id, n_same;
END $$;

COMMIT;

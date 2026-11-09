-- 0091_games_board.sql — Bảng xếp hạng mini-game: cộng dồn kết quả các ván đã xong.
--
-- CHỈ THÊM MỘT HÀM ĐỌC. Không tạo bảng, không sửa dữ liệu, không đụng Elo / điểm mùa cầu lông.
-- Chạy lại được (CREATE OR REPLACE). Kiểm tay: supabase/manual/0091_games_board_check.sql.
--
-- game_board(p_club, p_month) → mỗi (game, thành viên) một dòng: số ván, thắng, hoà, thua, tổng điểm.
--   - p_month 'YYYY-MM' = các ván KẾT THÚC trong tháng đó theo giờ Việt Nam; NULL = từ trước tới nay.
--   - Chỉ tính phòng 'finished' (phòng bỏ dở 'abandoned' không tính).
--   - Người rời ván GIỮA CHỪNG vẫn tính (đã bị xử thua). Người rời lúc phòng còn chờ (left_at < started_at)
--     không tính — họ chưa chơi, và game_start đã đánh số lại ghế nên ghế cũ của họ có thể trùng người khác.
--   - Thắng = ghế có trong result.winners (Ma sói: cả phe). Hoà = result.draw = true.
--   - points = tổng result.scores[ghế] của MỌI game có điểm; client chỉ dùng cho game điểm cộng dồn có
--     nghĩa (Phỏm, Tiến lên — lib/games/registry.js BOARD_POINTS). Game khác điểm là số ô / quân của ván.
--   - Đọc result phòng thủ: Cờ vua / Cờ tướng / Cá ngựa nhận result client gửi (game_finish 0075), nên
--     không ép kiểu (::boolean, ::numeric) trên giá trị chưa chắc đúng kiểu — một result lạ không làm hỏng cả bảng.
--   - SECURITY INVOKER: RLS game_rooms / game_room_players (is_club_member) tự giới hạn trong CLB của người gọi.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_board(p_club uuid, p_month text DEFAULT NULL)
RETURNS TABLE (game text, member_id uuid, played int, won int, drawn int, lost int, points numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    SELECT r.game, p.member_id,
           r.result -> 'draw' = 'true'::jsonb AS is_draw,
           coalesce(r.result -> 'winners' @> jsonb_build_array(p.seat), false) AS is_win,
           CASE WHEN jsonb_typeof(r.result -> 'scores' -> (p.seat::text)) = 'number'
                THEN (r.result -> 'scores' ->> (p.seat::text))::numeric END AS score
      FROM game_rooms r
      JOIN game_room_players p ON p.room_id = r.id
     WHERE r.club_id = p_club
       AND r.status = 'finished'
       AND r.result IS NOT NULL
       AND r.started_at IS NOT NULL
       AND (p.left_at IS NULL OR p.left_at >= r.started_at)
       AND (p_month IS NULL OR to_char(r.ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = p_month)
  )
  SELECT x.game, x.member_id,
         count(*)::int,
         count(*) FILTER (WHERE x.is_win AND x.is_draw IS NOT TRUE)::int,
         count(*) FILTER (WHERE x.is_draw IS TRUE)::int,
         count(*) FILTER (WHERE NOT x.is_win AND x.is_draw IS NOT TRUE)::int,
         coalesce(sum(x.score), 0)
    FROM x
   GROUP BY x.game, x.member_id;
$$;

REVOKE ALL ON FUNCTION public.game_board(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_board(uuid, text) TO authenticated;

COMMIT;

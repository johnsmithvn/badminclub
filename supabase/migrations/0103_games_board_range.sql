-- 0103_games_board_range.sql — BXH mini-game theo KHOẢNG NGÀY + chuỗi + xu (bản thiết kế 1c: cột Chuỗi, Xu, mốc Mùa).
--
-- CHỈ THÊM MỘT HÀM ĐỌC. Không tạo bảng, không sửa dữ liệu, không đụng Elo / điểm mùa cầu lông.
-- Chạy lại được (CREATE OR REPLACE). game_board (0091) giữ nguyên — máy khách lùi về nó khi DB chưa chạy file này.
--
-- game_board_range(p_club, p_from, p_to) → mỗi (game, thành viên) một dòng như game_board, thêm:
--   - p_from / p_to: ngày (giờ Việt Nam) ván KẾT THÚC, tính cả hai đầu; NULL = không chặn đầu đó.
--     Tháng = ngày 1 → cuối tháng; Mùa = startDate → endDate của mùa cầu lông đang chạy (máy khách tự tính).
--   - streak: chuỗi hiện tại trong khoảng, tính từ ván mới nhất lùi lại: +n = thắng n ván liền, -n = thua n ván liền,
--     0 = ván mới nhất hoà.
--   - coins: xu ăn / thua từ các ván của game đó trong khoảng = tổng delta sổ xu (0101 game_coin_tx) của những phòng
--     đã chốt (có dòng cashout / refund / legacy — cùng cách game_wallets đếm). Game không cược → 0.
-- Luật lọc ván / người giống hệt 0091 (phòng 'finished', người rời lúc phòng còn chờ không tính).
-- SECURITY INVOKER: RLS game_rooms / game_room_players / game_coin_tx (is_club_member) tự giới hạn trong CLB.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_board_range(p_club uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE (game text, member_id uuid, played int, won int, drawn int, lost int, points numeric, streak int, coins int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH x AS (
    SELECT r.id AS room_id, r.game, p.member_id, r.ended_at,
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
       AND (p_from IS NULL OR (r.ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= p_from)
       AND (p_to IS NULL OR (r.ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_to)
  ),
  o AS (  -- kết cục từng ván: 1 thắng, 0 hoà, -1 thua; rn = 1 là ván mới nhất
    SELECT x.*,
           CASE WHEN x.is_draw IS TRUE THEN 0 WHEN x.is_win THEN 1 ELSE -1 END AS res,
           row_number() OVER (PARTITION BY x.game, x.member_id ORDER BY x.ended_at DESC, x.room_id) AS rn
      FROM x
  ),
  l AS (
    SELECT o.*, first_value(o.res) OVER (PARTITION BY o.game, o.member_id ORDER BY o.rn) AS last_res FROM o
  ),
  s AS (
    SELECT l.game, l.member_id,
           max(l.last_res) AS last_res,
           coalesce(min(l.rn) FILTER (WHERE l.res <> l.last_res) - 1, count(*)) AS run
      FROM l GROUP BY l.game, l.member_id
  ),
  c AS (  -- xu ròng mỗi (phòng, người) của phòng đã chốt
    SELECT t.room_id, t.member_id, sum(t.delta) AS net
      FROM game_coin_tx t
     WHERE t.club_id = p_club AND t.room_id IS NOT NULL
     GROUP BY t.room_id, t.member_id
    HAVING bool_or(t.kind IN ('cashout', 'refund', 'legacy'))
  )
  SELECT x.game, x.member_id,
         count(*)::int,
         count(*) FILTER (WHERE x.is_win AND x.is_draw IS NOT TRUE)::int,
         count(*) FILTER (WHERE x.is_draw IS TRUE)::int,
         count(*) FILTER (WHERE NOT x.is_win AND x.is_draw IS NOT TRUE)::int,
         coalesce(sum(x.score), 0),
         (max(s.last_res) * max(s.run))::int,
         coalesce(sum(c.net), 0)::int
    FROM x
    JOIN s ON s.game = x.game AND s.member_id = x.member_id
    LEFT JOIN c ON c.room_id = x.room_id AND c.member_id = x.member_id
   GROUP BY x.game, x.member_id
  UNION ALL
  -- Dòng game = '*': chuỗi tính trên MỌI game (cho BXH "Tất cả"); các cột khác 0 — máy khách bỏ qua khi cộng.
  SELECT '*', a.member_id, 0, 0, 0, 0, 0,
         (max(a.last_res) * coalesce(min(a.rn) FILTER (WHERE a.res <> a.last_res) - 1, count(*)))::int, 0
    FROM (
      SELECT q.member_id, q.res, q.rn, first_value(q.res) OVER (PARTITION BY q.member_id ORDER BY q.rn) AS last_res
        FROM (SELECT o.member_id, o.res, row_number() OVER (PARTITION BY o.member_id ORDER BY o.ended_at DESC, o.room_id) AS rn FROM o) q
    ) a
   GROUP BY a.member_id;
$$;

REVOKE ALL ON FUNCTION public.game_board_range(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_board_range(uuid, date, date) TO authenticated;

COMMIT;

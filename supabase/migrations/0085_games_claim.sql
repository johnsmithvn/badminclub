-- 0085_games_claim.sql — Mất kết nối: chỉ xử người mà ván đang chờ (docs/GAMES.md §5.1b). Chạy sau 0078.
--
-- Lỗi của bản 0074 / 0078: game_claim xử MỌI người ngồi ghế quá 120 giây không thấy nhịp. Điện thoại tự khoá màn
-- hình là tab ẩn, ngừng nhịp — nên người đang chờ đối thủ nghĩ (Cờ vua) hay đang bàn bạc ngoài đời (Ma sói) bị xử
-- thua / chết dù ván không chờ họ; ván 3–12 người xử một người treo ván là xử luôn mọi người đang khoá máy.
--
-- SỬA game_claim (đổi chữ ký: thêm p_seats, bỏ bản một tham số):
--   p_seats = các ghế ván đang chờ đi nước — máy khách tính theo luật (registry.waitingOf: người tới lượt; Ma sói là
--   người còn sống chưa bấm; Bắn tàu là người chưa chốt tàu). Server CHỈ xử ghế trong danh sách, và chỉ khi:
--     1. ván đã đứng yên đủ 120 giây: nước gần nhất (chưa có nước thì lúc bắt đầu ván) đã quá hạn — ván vừa chuyển sang
--        chờ một người thì người đó luôn có đủ 120 giây, dù đã khoá máy từ trước;
--     2. người đó quá 120 giây không thấy nhịp (như cũ).
--   Server không hiểu luật nên không kiểm được ghế nêu có đúng là ghế đang được chờ không: máy khách sửa code để nêu
--   ghế khác cũng chỉ xử được người đã mất nhịp quá hạn lúc ván đứng yên — vẫn chặt hơn bản cũ (bản cũ xử tất cả).
-- Phần sau giữ nguyên 0078: còn đúng 1 người → người đó thắng; còn ≥ 2 → ghi { out: true } cho từng người bị xử.
--
-- Số 120 phải khớp app.json → games.reconnectGraceSec (contract.test.js gác mọi chỗ "interval '… seconds'" trong file).
-- Máy khách cũ (chưa tải bản mới) gọi game_claim một tham số sẽ báo lỗi và im lặng bỏ qua (gameActions.gameClaim) —
-- không ai bị xử nhầm. supabase/manual/0074_games_check.sql gọi bản cũ nên chỉ chạy được trước file này.
-- Không đụng bảng / dữ liệu. Chạy lại được (DROP … IF EXISTS · CREATE OR REPLACE).

BEGIN;

DROP FUNCTION IF EXISTS public.game_claim(uuid);

CREATE OR REPLACE FUNCTION public.game_claim(p_room uuid, p_seats int[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c      record;
  v_last timestamptz;
  v_gone smallint[];
  v_left int;
  v_seat smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;

  -- 1. Ván đứng yên đủ hạn. GREATEST bỏ qua NULL: chưa có nước nào thì tính từ lúc bắt đầu ván.
  SELECT GREATEST(max(created_at), (c.o_room).started_at) INTO v_last FROM game_moves WHERE room_id = p_room;
  IF v_last > now() - interval '120 seconds' THEN RAISE EXCEPTION 'games.err.notIdle'; END IF;

  -- 2. Chỉ ghế được nêu, đã mất nhịp quá hạn, không phải chính người gọi.
  WITH g AS (
    UPDATE game_room_players SET left_at = now()
     WHERE room_id = p_room AND left_at IS NULL AND member_id <> c.o_me
       AND seat = ANY (p_seats)
       AND seen_at < now() - interval '120 seconds'
    RETURNING seat
  )
  SELECT array_agg(seat ORDER BY seat) INTO v_gone FROM g;
  IF v_gone IS NULL THEN RAISE EXCEPTION 'games.err.notIdle'; END IF;

  SELECT count(*) INTO v_left FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  IF v_left = 1 THEN
    SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
    UPDATE game_rooms SET status = 'finished', ended_at = now(),
      result = jsonb_build_object('winners', jsonb_build_array(v_seat), 'draw', false, 'forfeit', true, 'idle', true)
     WHERE id = p_room;
  ELSIF v_left >= 2 THEN
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT p_room, (SELECT COALESCE(max(seq), 0) FROM game_moves WHERE room_id = p_room) + u.o, (c.o_room).club_id, u.s, '{"out": true}'::jsonb
      FROM unnest(v_gone) WITH ORDINALITY AS u(s, o);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.game_claim(uuid, int[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_claim(uuid, int[]) TO authenticated;

COMMIT;

-- 0102: sửa game_start — bấm "Bắt đầu" báo lỗi
--   new row for relation "game_room_players" violates check constraint "game_room_players_seat_check".
-- Nguyên nhân: 0074 / 0078 đánh số lại ghế bằng hai bước, bước đầu tạm đặt `seat = seat + 100`, nhưng cột seat có
-- CHECK (seat BETWEEN 0 AND 15) — ràng buộc kiểm ngay từng dòng nên ghế 100+ bị chặn.
-- Cách mới: đi lần lượt theo ghế tăng dần, người thứ n (đếm từ 0) chuyển về ghế n. Mọi người đứng trước đã nằm ở
-- 0..n-1, mọi người đứng sau còn ở ghế > ghế hiện tại ≥ n, nên ghế n luôn trống với unique (room_id, seat) của
-- người ĐANG ngồi (game_room_players_seat_uq). Phần còn lại giữ nguyên như 0078 (chia bài qua game_<id>_deal).

CREATE OR REPLACE FUNCTION public.game_start(p_room uuid, p_min int, p_max int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  r record;
  v_n int;
  v_i int := 0;
  v_fn text;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).host_id <> c.o_me THEN RAISE EXCEPTION 'games.err.notHost'; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  SELECT count(*) INTO v_n FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  IF v_n < GREATEST(p_min, 2) OR v_n > p_max THEN RAISE EXCEPTION 'games.err.badCount'; END IF;

  -- Dồn ghế về 0..n-1 theo thứ tự ghế cũ.
  FOR r IN SELECT member_id, seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    IF r.seat <> v_i THEN
      UPDATE game_room_players SET seat = v_i WHERE room_id = p_room AND member_id = r.member_id;
    END IF;
    v_i := v_i + 1;
  END LOOP;

  UPDATE game_rooms SET status = 'playing', started_at = now(), seed = gen_random_uuid()::text WHERE id = p_room;

  -- 0078: game có bài úp thì chia bài ở đây, sau khi ghế đã đánh số lại.
  v_fn := 'game_' || (c.o_room).game || '_deal';
  IF to_regprocedure('public.' || v_fn || '(uuid)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1)', v_fn) USING p_room;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.game_start(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_start(uuid, int, int) TO authenticated;

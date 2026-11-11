-- 0105_games_lobby.sql — Phòng chờ: Sẵn sàng · chủ phòng mời ra · chủ phòng sửa luật; đồng hồ tổng Cờ vua / Cờ tướng.
--
-- CHẠY SAU 0104. Chạy lại được: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP TRIGGER IF EXISTS.
--
-- Bảng game_room_players thêm 2 cột:
--   ready  — người (không phải chủ phòng) đã bấm Sẵn sàng. Vào lại ghế (left_at về NULL) thì tự về false.
--   kicked — bị chủ phòng mời ra: không vào lại phòng này được nữa (trigger chặn, game_join 0074 giữ nguyên).
-- Hàm mới:
--   game_ready(room, ready)          — người đang ngồi bật / tắt Sẵn sàng (chỉ lúc chờ).
--   game_kick(room, member)          — chủ phòng mời một người ra (chỉ lúc chờ). Buy-in chưa trừ (0101 trừ lúc bắt
--                                      đầu) nên không phải hoàn xu.
--   game_set_options(room, options)  — chủ phòng đổi luật lúc chờ. Giữ nguyên mức cược (`stake` — 0093 chỉ kiểm lúc
--                                      tạo phòng). Đổi luật thì mọi người phải bấm Sẵn sàng lại.
--   game_start                       — như 0102, thêm: mọi người không phải chủ phòng phải Sẵn sàng.
-- Đồng hồ tổng Cờ vua / Cờ tướng (options.clock = 5 | 10 | 15 phút mỗi bên, +5 giây mỗi nước đã đi):
--   game_chess_deadline(room)        — dựng lại đồng hồ từ log → hạn của người tới lượt (giờ server).
--   game_covua_deal / game_cotuong_deal   — (game_start gọi) phòng có đồng hồ thì ghi nước 1 { start: true }.
--   game_covua_check / game_cotuong_check — (game_move gọi) { timeout: true } chỉ nhận khi now() đã qua hạn.
-- Chép luật lib/games/chessClock.js (clockMins, INC_SEC, tick) — đổi luật thì sửa cả hai.

BEGIN;

/* ---------- 1. Bảng ---------- */

ALTER TABLE public.game_room_players ADD COLUMN IF NOT EXISTS ready boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_room_players ADD COLUMN IF NOT EXISTS kicked boolean NOT NULL DEFAULT false;

-- Vào lại ghế: bỏ Sẵn sàng cũ; người bị mời ra thì chặn. Bắt cả game_join (ON CONFLICT DO UPDATE chạy trigger UPDATE).
CREATE OR REPLACE FUNCTION public.game_players_rejoin_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.left_at IS NULL AND OLD.left_at IS NOT NULL THEN
    IF OLD.kicked THEN RAISE EXCEPTION 'games.err.kicked'; END IF;
    NEW.ready := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_players_rejoin_guard ON public.game_room_players;
CREATE TRIGGER game_players_rejoin_guard BEFORE UPDATE OF left_at ON public.game_room_players
  FOR EACH ROW EXECUTE FUNCTION public.game_players_rejoin_guard();

/* ---------- 2. Phòng chờ ---------- */

CREATE OR REPLACE FUNCTION public.game_ready(p_room uuid, p_ready boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  UPDATE game_room_players SET ready = COALESCE(p_ready, false)
   WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'games.err.notSeated'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_kick(p_room uuid, p_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).host_id <> c.o_me THEN RAISE EXCEPTION 'games.err.notHost'; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  IF p_member = c.o_me THEN RAISE EXCEPTION 'games.err.badTarget'; END IF;
  UPDATE game_room_players SET left_at = now(), kicked = true, ready = false
   WHERE room_id = p_room AND member_id = p_member AND left_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'games.err.notSeated'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_set_options(p_room uuid, p_options jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c     record;
  v_opt jsonb;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).host_id <> c.o_me THEN RAISE EXCEPTION 'games.err.notHost'; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  IF jsonb_typeof(p_options) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'games.err.badOptions'; END IF;
  -- Như game_create 0088: cỡ bàn Caro do server chặn.
  IF (c.o_room).game = 'caro' AND NOT (
    COALESCE((p_options ->> 'size')::int, 15) BETWEEN 3 AND 25
    AND COALESCE((p_options ->> 'win')::int, 5) BETWEEN 3 AND COALESCE((p_options ->> 'size')::int, 15)
  ) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;

  v_opt := (p_options - 'stake') || CASE WHEN (c.o_room).options ? 'stake'
    THEN jsonb_build_object('stake', (c.o_room).options -> 'stake') ELSE '{}'::jsonb END;
  UPDATE game_rooms SET options = v_opt WHERE id = p_room;
  UPDATE game_room_players SET ready = false WHERE room_id = p_room AND left_at IS NULL AND ready;
END;
$$;

-- Như 0102, thêm: mọi người không phải chủ phòng phải Sẵn sàng.
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
  IF EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND left_at IS NULL AND member_id <> c.o_me AND NOT ready) THEN
    RAISE EXCEPTION 'games.err.needReady';
  END IF;

  -- Dồn ghế về 0..n-1 theo thứ tự ghế cũ (0102).
  FOR r IN SELECT member_id, seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    IF r.seat <> v_i THEN
      UPDATE game_room_players SET seat = v_i WHERE room_id = p_room AND member_id = r.member_id;
    END IF;
    v_i := v_i + 1;
  END LOOP;

  UPDATE game_rooms SET status = 'playing', started_at = now(), seed = gen_random_uuid()::text WHERE id = p_room;

  v_fn := 'game_' || (c.o_room).game || '_deal';
  IF to_regprocedure('public.' || v_fn || '(uuid)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1)', v_fn) USING p_room;
  END IF;
END;
$$;

/* ---------- 3. Đồng hồ tổng Cờ vua / Cờ tướng ---------- */

-- Phút mỗi bên theo options.clock (= clockMins). Khác 5 / 10 / 15 (số JSON) là không đồng hồ.
CREATE OR REPLACE FUNCTION public.game_chess_mins(p_options jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_options -> 'clock' = '5'::jsonb THEN 5
              WHEN p_options -> 'clock' = '10'::jsonb THEN 10
              WHEN p_options -> 'clock' = '15'::jsonb THEN 15
              ELSE 0 END
$$;

-- Dựng lại đồng hồ từ log (= tick trong chessClock.js): mỗi nước thường trừ thời gian nghĩ của người tới lượt, cộng
-- c_inc giây, đổi lượt. Nước { start } lấy giờ bắt đầu; { draw } / { timeout } / { out } không đụng đồng hồ.
-- Trả hạn của người đang tới lượt; phòng không đồng hồ / chưa có { start } → NULL.
-- ponytail: server không chấm luật cờ nên đếm MỌI nước thường trong log; máy khách bỏ qua nước sai luật (replay). Log chỉ
-- lệch khi có máy khách bị sửa gửi nước sai — khi viết SQL chấm Cờ vua / Cờ tướng thì dựng đồng hồ trong hàm chấm đó.
CREATE OR REPLACE FUNCTION public.game_chess_deadline(p_room uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_inc   CONSTANT numeric := 5;   -- = INC_SEC
  v_mins  int;
  v_left  numeric[];
  v_turn  int := 0;
  v_since timestamptz;
  m       record;
BEGIN
  SELECT game_chess_mins(options) INTO v_mins FROM game_rooms WHERE id = p_room;
  IF COALESCE(v_mins, 0) = 0 THEN RETURN NULL; END IF;
  v_left := ARRAY[v_mins * 60, v_mins * 60]::numeric[];
  FOR m IN SELECT move, created_at FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF m.move -> 'start' = 'true'::jsonb THEN
      IF v_since IS NULL THEN v_since := m.created_at; END IF;
      CONTINUE;
    END IF;
    IF v_since IS NULL OR m.move ? 'draw' OR m.move ? 'timeout' OR m.move ? 'out' THEN CONTINUE; END IF;
    v_left[v_turn + 1] := v_left[v_turn + 1] - extract(epoch FROM m.created_at - v_since) + c_inc;
    v_since := m.created_at;
    v_turn := 1 - v_turn;
  END LOOP;
  IF v_since IS NULL THEN RETURN NULL; END IF;
  RETURN v_since + make_interval(secs => v_left[v_turn + 1]);
END;
$$;

CREATE OR REPLACE FUNCTION public.game_chess_check(p_room uuid, p_move jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due timestamptz;
BEGIN
  IF p_move ? 'start' THEN RETURN 'games.err.badMove'; END IF;   -- chỉ server ghi (game_<id>_deal)
  IF NOT (p_move ? 'timeout') THEN RETURN NULL; END IF;           -- nước thường: luật ở client (game_finish tin client)
  v_due := game_chess_deadline(p_room);
  IF v_due IS NULL THEN RETURN 'games.err.badMove'; END IF;
  IF now() < v_due THEN RETURN 'games.err.notYet'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_chess_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room game_rooms;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE id = p_room;
  IF game_chess_mins(v_room.options) > 0 THEN
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (p_room, 1, v_room.club_id, 0, '{"start": true}'::jsonb);
  END IF;
END;
$$;

-- game_move / game_start tìm hàm theo tên game_<id>_check / game_<id>_deal.
CREATE OR REPLACE FUNCTION public.game_covua_check(p_room uuid, p_seat integer, p_move jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.game_chess_check(p_room, p_move) $$;
CREATE OR REPLACE FUNCTION public.game_cotuong_check(p_room uuid, p_seat integer, p_move jsonb)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.game_chess_check(p_room, p_move) $$;
CREATE OR REPLACE FUNCTION public.game_covua_deal(p_room uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.game_chess_deal(p_room) $$;
CREATE OR REPLACE FUNCTION public.game_cotuong_deal(p_room uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.game_chess_deal(p_room) $$;

/* ---------- 4. Quyền ---------- */

REVOKE ALL ON FUNCTION public.game_players_rejoin_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_chess_deadline(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_chess_check(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_chess_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_covua_check(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_cotuong_check(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_covua_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_cotuong_deal(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.game_ready(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_kick(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_set_options(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_start(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_ready(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_kick(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_set_options(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_start(uuid, int, int) TO authenticated;

COMMIT;

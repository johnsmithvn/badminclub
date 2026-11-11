-- 0104_games_oanquan_rules.sql — Ô ăn quan: tuỳ chọn phòng (2 / 3 quan, 5–7 ô dân mỗi hàng, 5–7 dân mỗi ô, luật nhón)
-- + đồng hồ mỗi nước 20 / 30 / 50 giây theo giờ SERVER (cùng mẫu Bài bịp 0082 / Xì dách 0098).
--
-- CHẠY SAU 0102 (game_start đánh số ghế 0..n-1 rồi gọi game_<id>_deal; game_move 0078 gọi _check / _fill).
-- CHỈ THAY / THÊM HÀM. Chạy lại được. Không đổi bảng, không đổi dữ liệu.
-- Phòng cũ (options {}) = 2 quan, 5 ô, 5 dân, không nhón, không đồng hồ → chấm y hệt 0075.
--
-- game_oanquan_run    — dựng lại ván từ log theo options của phòng; có p_move thì kiểm nước đó → o_err
--                       (nước sai trong log bị BỎ QUA như registry.replay).
-- game_oanquan_result — (game_finish 0075 gọi) điểm cao nhất thắng, bằng nhau ở đầu thì cùng thắng, ai cũng bằng = hoà.
-- game_oanquan_check  — (game_move gọi) mã lỗi hoặc NULL. { timeout } chỉ nhận khi now() đã qua hạn (games.err.notYet).
-- game_oanquan_fill   — (game_move gọi) { timeout } → server chọn một ô có dân + chiều ngẫu nhiên cho người tới lượt,
--                       log { cell, dir, timeout: true } (seat của dòng log là máy báo; luật áp cho người tới lượt).
-- game_oanquan_deal   — (game_start gọi) số người phải = số quan; phòng có đồng hồ thì ghi nước 1 { start: true }
--                       để lấy giờ bắt đầu lượt đầu.
-- Chép luật lib/games/oanquan.js (optsOf, validate, apply) — đổi luật thì sửa cả hai.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_oanquan_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_over boolean, OUT o_score int[], OUT o_turn int, OUT o_side int[], OUT o_quans int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_quan  CONSTANT int := 10;      -- = QUAN_VALUE
  c_max   CONSTANT int := 2000;    -- = MAX_STEPS
  c_non   CONSTANT int := 5;       -- = QUAN_NON
  v_opt   jsonb;
  v_p     int;                     -- số quan = số người
  v_r     int;                     -- ô dân mỗi hàng
  v_w     int;                     -- R + 1: quan k ở ô k·v_w
  v_n     int;                     -- số ô cả vòng
  v_nhon  boolean;
  v_time  bigint;                  -- giây mỗi nước, 0 = không giới hạn
  v_st    int[];
  v_q     boolean[];
  v_score int[];
  v_turn  int := 0;
  v_ply   int := 0;
  v_over  boolean := false;
  v_since bigint;                  -- giờ server (ms) của nước hợp lệ gần nhất
  v_err   text;
  m       record;
  v_cell  numeric;
  v_dir   numeric;
  v_seat  int;
  v_d     int;
  v_i     int;
  v_nx    int;
  v_m     int;
  v_hand  int;
  v_steps int;
  v_base  int;
  k       int;
  y       int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_p := CASE WHEN v_opt -> 'quans' = '3'::jsonb THEN 3 ELSE 2 END;
  v_r := CASE WHEN v_opt -> 'rows' IN ('6'::jsonb, '7'::jsonb) THEN (v_opt ->> 'rows')::numeric::int ELSE 5 END;
  v_nhon := coalesce(v_opt -> 'nhon' = 'true'::jsonb, false);
  v_time := CASE WHEN v_opt -> 'time' IN ('20'::jsonb, '30'::jsonb, '50'::jsonb) THEN (v_opt ->> 'time')::numeric::int ELSE 0 END;
  v_w := v_r + 1;
  v_n := v_p * v_w;
  v_st := array_fill(CASE WHEN v_opt -> 'stones' IN ('6'::jsonb, '7'::jsonb) THEN (v_opt ->> 'stones')::numeric::int ELSE 5 END, ARRAY[v_n]);
  v_q := array_fill(false, ARRAY[v_n]);
  v_score := array_fill(0, ARRAY[v_p]);
  FOR k IN 0 .. v_p - 1 LOOP v_st[k * v_w + 1] := 0; v_q[k * v_w + 1] := true; END LOOP;

  -- Log + (nếu có) nước đang kiểm ở cuối (probe): cùng một đường kiểm như JS validate.
  FOR m IN
    SELECT q.seat, q.move, q.at, q.probe FROM (
      SELECT g.seq, g.seat::int AS seat, g.move, (extract(epoch FROM g.created_at) * 1000)::bigint AS at, false AS probe
        FROM game_moves g WHERE g.room_id = p_room
      UNION ALL
      SELECT NULL, p_seat, p_move, (extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) q ORDER BY q.probe, q.seq
  LOOP
    v_err := NULL;
    v_seat := m.seat;
    IF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.move -> 'start' = 'true'::jsonb THEN
      -- Chỉ server ghi (game_oanquan_deal); máy khách gửi thì từ chối.
      IF m.probe OR v_ply > 0 OR v_since IS NOT NULL THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'timeout' = 'true'::jsonb AND NOT (m.move ? 'cell') THEN
      -- Báo hết giờ trơn: trong log thì không làm gì (JS cũng bỏ qua); đang kiểm thì xét giờ.
      IF NOT m.probe THEN CONTINUE; END IF;
      IF v_time = 0 THEN v_err := 'games.err.badMove';
      ELSIF v_since IS NULL OR m.at < v_since + v_time * 1000 THEN v_err := 'games.err.notYet';
      END IF;
    ELSE
      IF m.move -> 'timeout' = 'true'::jsonb THEN v_seat := v_turn; END IF;
      v_base := v_seat * v_w;
      IF v_seat IS DISTINCT FROM v_turn THEN
        v_err := 'games.err.notYourTurn';
      ELSIF jsonb_typeof(m.move -> 'cell') IS DISTINCT FROM 'number' THEN
        v_err := 'games.err.notYourCell';
      ELSE
        v_cell := (m.move ->> 'cell')::numeric;
        IF v_cell <> trunc(v_cell) OR v_cell < v_base + 1 OR v_cell > v_base + v_r THEN
          v_err := 'games.err.notYourCell';
        ELSIF jsonb_typeof(m.move -> 'dir') IS DISTINCT FROM 'number' OR (m.move ->> 'dir')::numeric NOT IN (1, -1) THEN
          v_err := 'games.err.badMove';
        ELSIF v_st[v_cell::int + 1] = 0 THEN
          v_err := 'games.err.emptyCell';
        END IF;
      END IF;
    END IF;

    IF m.probe THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;
    IF m.move -> 'start' = 'true'::jsonb THEN v_since := m.at; CONTINUE; END IF;

    v_i := v_cell::int;
    v_dir := (m.move ->> 'dir')::numeric;
    v_d := v_dir::int;
    v_hand := v_st[v_i + 1];
    v_st[v_i + 1] := 0;
    v_steps := 0;
    LOOP
      WHILE v_hand > 0 LOOP
        v_i := (v_i + v_d + v_n) % v_n;
        v_st[v_i + 1] := v_st[v_i + 1] + 1;
        v_hand := v_hand - 1;
        v_steps := v_steps + 1;
      END LOOP;
      v_nx := (v_i + v_d + v_n) % v_n;
      IF v_st[v_nx + 1] > 0 OR v_q[v_nx + 1] THEN
        EXIT WHEN v_steps > c_max;
        IF v_nx % v_w = 0 THEN
          -- Nhón: ô quan có dân → lấy 1 DÂN (v_st; quan v_q không bao giờ bị nhón), rơi xuống ô ngay sau quan, xét tiếp.
          -- Ô quan không còn dân → không nhón được, dừng như luật thường.
          EXIT WHEN NOT v_nhon OR v_st[v_nx + 1] = 0;
          v_st[v_nx + 1] := v_st[v_nx + 1] - 1;
          v_hand := 1;
          v_i := v_nx;
          CONTINUE;
        END IF;
        v_hand := v_st[v_nx + 1];
        v_st[v_nx + 1] := 0;
        v_i := v_nx;
        CONTINUE;
      END IF;
      v_m := (v_nx + v_d + v_n) % v_n;
      -- eatable(): dân còn sỏi, hoặc quan đủ c_non dân.
      WHILE v_st[v_nx + 1] = 0 AND NOT v_q[v_nx + 1]
            AND CASE WHEN v_q[v_m + 1] THEN v_st[v_m + 1] >= c_non ELSE v_st[v_m + 1] > 0 END LOOP
        v_score[v_seat + 1] := v_score[v_seat + 1] + v_st[v_m + 1] + CASE WHEN v_q[v_m + 1] THEN c_quan ELSE 0 END;
        v_st[v_m + 1] := 0;
        v_q[v_m + 1] := false;
        v_nx := (v_m + v_d + v_n) % v_n;
        v_m := (v_nx + v_d + v_n) % v_n;
      END LOOP;
      EXIT;
    END LOOP;

    v_ply := v_ply + 1;
    v_since := m.at;
    v_turn := (v_seat + 1) % v_p;
    v_base := v_turn * v_w;
    IF NOT EXISTS (SELECT 1 FROM generate_series(0, v_p - 1) q WHERE v_st[q * v_w + 1] > 0 OR v_q[q * v_w + 1]) THEN
      v_over := true;                            -- hết quan
    ELSIF (SELECT sum(v_st[x]) FROM generate_series(v_base + 2, v_base + v_r + 1) x) = 0 THEN
      IF v_score[v_turn + 1] < v_r THEN
        v_over := true;                          -- hết dân mà không đủ điểm rải lại
      ELSE
        v_score[v_turn + 1] := v_score[v_turn + 1] - v_r;
        FOR k IN v_base + 2 .. v_base + v_r + 1 LOOP v_st[k] := 1; END LOOP;
      END IF;
    END IF;

    IF v_over THEN                               -- hết quan, tàn dân: dân còn bên nào về bên đó
      FOR y IN 0 .. v_p - 1 LOOP
        FOR k IN y * v_w + 2 .. y * v_w + v_r + 1 LOOP v_score[y + 1] := v_score[y + 1] + v_st[k]; v_st[k] := 0; END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  o_over := v_over;
  o_score := v_score;
  o_turn := v_turn;
  o_quans := v_p;
  o_side := ARRAY(SELECT x FROM generate_series(v_turn * v_w + 1, v_turn * v_w + v_r) x WHERE v_st[x + 1] > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

/* ---------- Chấm (game_finish 0075) ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r     record;
  v_top int;
BEGIN
  SELECT * INTO r FROM game_oanquan_run(p_room, NULL, NULL);
  IF NOT r.o_over THEN RETURN NULL; END IF;
  SELECT max(x) INTO v_top FROM unnest(r.o_score) x;
  IF (SELECT bool_and(x = v_top) FROM unnest(r.o_score) x) THEN
    RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true);
  END IF;
  RETURN jsonb_build_object('winners',
    (SELECT jsonb_agg(i - 1 ORDER BY i) FROM generate_subscripts(r.o_score, 1) i WHERE r.o_score[i] = v_top), 'draw', false);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_result(uuid) FROM PUBLIC, anon, authenticated;

/* ---------- Kiểm nước (game_move 0078) ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_check(p_room uuid, p_seat integer, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o_err FROM public.game_oanquan_run(p_room, p_seat, p_move)
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_check(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

/* ---------- Hết giờ: đi thay người tới lượt ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_move -> 'timeout' IS DISTINCT FROM 'true'::jsonb THEN RETURN p_move; END IF;
  SELECT * INTO r FROM game_oanquan_run(p_room, NULL, NULL);
  RETURN jsonb_build_object(
    'cell', r.o_side[1 + floor(random() * cardinality(r.o_side))::int],
    'dir', CASE WHEN random() < 0.5 THEN 1 ELSE -1 END,
    'timeout', true);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

/* ---------- Bắt đầu (game_start 0102) ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room game_rooms;
  v_p    int;
BEGIN
  SELECT * INTO v_room FROM game_rooms WHERE id = p_room;
  v_p := CASE WHEN v_room.options -> 'quans' = '3'::jsonb THEN 3 ELSE 2 END;
  IF (SELECT count(*) FROM game_room_players WHERE room_id = p_room AND left_at IS NULL) <> v_p THEN
    RAISE EXCEPTION 'games.err.badCount';
  END IF;
  IF v_room.options -> 'time' IN ('20'::jsonb, '30'::jsonb, '50'::jsonb) THEN
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (p_room, 1, v_room.club_id, 0, '{"start": true}'::jsonb);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_deal(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

-- 0096_games_baucua.sql — Bầu cua cá cọp (docs/GAMES.md §5.2, §12). Chạy sau 0078. Chỉ thêm hàm, không đụng bảng / data.
--
-- game_baucua_deal  — game_start gọi: ghi nước 1 { deal: { n } } (n = số người ngồi), mở đồng hồ đặt của ván đầu.
-- game_baucua_run   — dựng lại trận từ log (như replay() của lib/games/baucua.js), kiểm nước đang xin ghi → o_err,
--                     hết trận → o_result (điểm từng ghế, người còn ngồi nhiều điểm nhất thắng).
-- game_baucua_check — game_move gọi: mở bát chỉ nhận khi cả bàn đã chốt hoặc đã hết giờ đặt (sớm → games.err.notYet,
--                     máy khách im lặng thử lại); { out } / { deal } chỉ server ghi.
-- game_baucua_fill  — game_move gọi: { roll } → server lắc ba hột 0..5 (bầu, cua, tôm, cá, gà, nai) bằng random().
-- game_baucua_result — game_finish (0075) dùng hàm này, bỏ kết quả client.
-- Giờ đặt: options.time giây (15 / 20 / 30, sai dạng → 20) tính từ created_at nước mở ván. Số ván = options.laps
-- (1 / 2 / 3, sai dạng → 1) × số người. Chép luật lib/games/baucua.js — đổi luật thì sửa cả hai.
-- Mảng plpgsql đánh số từ 1: ghế s ở [s + 1], điểm đặt con k của ghế s ở v_bets[s * 6 + k + 1].

BEGIN;

-- Số nguyên 0..99 trong jsonb, sai dạng → NULL.
CREATE OR REPLACE FUNCTION public.game_baucua_int(j jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'number' AND (j #>> '{}') ~ '^[0-9]{1,2}$' THEN (j #>> '{}')::int END
$$;

CREATE OR REPLACE FUNCTION public.game_baucua_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n    int;
  v_club uuid;
BEGIN
  SELECT count(*), min(club_id::text)::uuid INTO v_n, v_club FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, 0, jsonb_build_object('deal', jsonb_build_object('n', v_n)));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_baucua_run(p_room uuid, p_seat int, p_move jsonb, OUT o_err text, OUT o_result jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt     jsonb;
  v_time    bigint;
  v_laps    int;
  v_started boolean := false;
  v_over    boolean := false;
  v_n       int := 0;
  v_out     boolean[];
  v_ready   boolean[];
  v_bets    int[];
  v_scores  int[];
  v_round   int := 0;
  v_rounds  int;
  v_banker  int;
  v_since   bigint;
  v_err     text;
  v_act     text;
  v_bet     int[];
  v_dice    int[];
  v_won     int;
  v_best    int;
  m         record;
  d         jsonb;
  i         int;
  k         int;
  y         int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (15, 20, 30) THEN (v_opt ->> 'time')::numeric::int ELSE 20 END
                        ELSE 20 END;
  v_laps := CASE WHEN jsonb_typeof(v_opt -> 'laps') = 'number'
                 THEN CASE WHEN (v_opt ->> 'laps')::numeric IN (1, 2, 3) THEN (v_opt ->> 'laps')::numeric::int ELSE 1 END
                 ELSE 1 END;

  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    v_act := NULL;

    /* ----- validate (như JS; nước đang xin ghi khắt hơn: out / deal chỉ server ghi, mở bát phải đúng giờ) ----- */
    IF jsonb_typeof(m.move -> 'deal') = 'object' THEN
      v_act := 'deal';
      IF v_started OR m.cand OR m.seat <> 0 OR game_baucua_int(m.move #> '{deal,n}') NOT BETWEEN 2 AND 10
         OR game_baucua_int(m.move #> '{deal,n}') IS NULL THEN
        v_err := 'games.err.badMove';
      END IF;
    ELSIF NOT v_started THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      v_act := 'out';
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'roll' = 'true'::jsonb THEN
      v_act := 'roll';
      IF m.cand THEN
        IF EXISTS (SELECT 1 FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1] AND g <> v_banker AND NOT v_ready[g + 1])
           AND m.at < v_since + v_time THEN
          v_err := 'games.err.notYet';
        END IF;
      ELSE
        v_dice := ARRAY(SELECT game_baucua_int(e) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.move -> 'dice') = 'array' THEN m.move -> 'dice' ELSE '[]' END) e);
        IF cardinality(v_dice) <> 3 OR EXISTS (SELECT 1 FROM unnest(v_dice) x WHERE x IS NULL OR x > 5) THEN v_err := 'games.err.badMove'; END IF;
      END IF;
    ELSIF m.seat = v_banker OR v_ready[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSE
      v_act := 'bet';
      v_bet := ARRAY(SELECT game_baucua_int(e) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.move -> 'bet') = 'array' THEN m.move -> 'bet' ELSE '[]' END) e);
      IF cardinality(v_bet) <> 6 OR EXISTS (SELECT 1 FROM unnest(v_bet) x WHERE x IS NULL OR x > 10)
         OR (SELECT sum(x) FROM unnest(v_bet) x) > 10 THEN
        v_err := 'games.err.badMove';
      END IF;
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;

    /* ----- apply ----- */
    IF v_act = 'deal' THEN
      v_n := game_baucua_int(m.move #> '{deal,n}');
      v_started := true;
      v_out := array_fill(false, ARRAY[v_n]);
      v_ready := array_fill(false, ARRAY[v_n]);
      v_bets := array_fill(0, ARRAY[v_n * 6]);
      v_scores := array_fill(0, ARRAY[v_n]);
      v_rounds := v_laps * v_n;
      v_banker := 0;
      v_since := m.at;
      CONTINUE;
    ELSIF v_act = 'bet' THEN
      -- Đặt = chốt luôn.
      FOR k IN 0..5 LOOP v_bets[m.seat * 6 + k + 1] := v_bet[k + 1]; END LOOP;
      v_ready[m.seat + 1] := true;
      CONTINUE;
    ELSIF v_act = 'out' THEN
      v_out[m.seat + 1] := true;
      FOR k IN 0..5 LOOP v_bets[m.seat * 6 + k + 1] := 0; END LOOP;
      IF m.seat <> v_banker THEN
        v_ready[m.seat + 1] := true;
        CONTINUE;
      END IF;
      -- Cái rời: ván bỏ, sang ván mới (bên dưới).
      v_bets := array_fill(0, ARRAY[v_n * 6]);
    ELSE
      -- Mở bát: con ra k hột → được k lần số điểm đặt, không ra → mất số điểm đặt. Cái trả / ăn hết.
      FOR i IN 0..v_n - 1 LOOP
        v_won := 0;
        FOR k IN 0..5 LOOP
          y := (SELECT count(*) FROM unnest(v_dice) x WHERE x = k);
          v_won := v_won + CASE WHEN y > 0 THEN v_bets[i * 6 + k + 1] * y ELSE -v_bets[i * 6 + k + 1] END;
        END LOOP;
        v_scores[i + 1] := v_scores[i + 1] + v_won;
        v_scores[v_banker + 1] := v_scores[v_banker + 1] - v_won;
      END LOOP;
    END IF;

    -- nextRound() của JS.
    v_round := v_round + 1;
    IF v_round >= v_rounds OR (SELECT count(*) FROM unnest(v_out) o WHERE NOT o) < 2 THEN
      v_over := true;
      v_banker := NULL;
      CONTINUE;
    END IF;
    FOR k IN 1..v_n LOOP
      y := (v_banker + k) % v_n;
      IF NOT v_out[y + 1] THEN v_banker := y; EXIT; END IF;
    END LOOP;
    v_bets := array_fill(0, ARRAY[v_n * 6]);
    v_ready := array_fill(false, ARRAY[v_n]);
    v_since := m.at;
  END LOOP;

  IF NOT v_over THEN RETURN; END IF;
  SELECT max(v_scores[g + 1]) INTO v_best FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1];
  IF v_best IS NULL THEN
    SELECT max(x) INTO v_best FROM unnest(v_scores) x;
    o_result := jsonb_build_object('winners', (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE v_scores[g + 1] = v_best));
  ELSE
    o_result := jsonb_build_object('winners', (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1] AND v_scores[g + 1] = v_best));
  END IF;
  o_result := o_result || jsonb_build_object('draw', false,
    'scores', (SELECT jsonb_object_agg(g::text, v_scores[g + 1]) FROM generate_series(0, v_n - 1) g));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_baucua_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_baucua_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_baucua_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_baucua_run(p_room, NULL, NULL) $$;

-- Mở bát: server lắc. Nước khác: bỏ dice client tự gửi (check đã chặn nước sai).
CREATE OR REPLACE FUNCTION public.game_baucua_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_move -> 'roll' = 'true'::jsonb THEN
    RETURN jsonb_build_object('roll', true, 'dice', jsonb_build_array(floor(random() * 6)::int, floor(random() * 6)::int, floor(random() * 6)::int));
  END IF;
  RETURN p_move - 'dice';
END;
$$;

REVOKE ALL ON FUNCTION public.game_baucua_int(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

-- 0088_games_loto.sql — Lô tô (docs/GAMES.md §5.2, §12). Chạy sau 0078. Chỉ thêm hàm, không đụng bảng / data.
--
-- game_loto_deal   — game_start gọi: chia mỗi người một tờ dò 9 hàng × 5 số (cột c: số c*10..c*10+9, cột 0 là 1–9,
--                    cột 8 là 80–90; cả tờ không trùng số), ghi nước 1 { deal: { tickets } } — tờ công khai.
-- game_loto_run    — dựng lại ván (như replay() của lib/games/loto.js): số đã xướng, giờ số trước, người kinh đúng trước.
-- game_loto_check  — game_move gọi: gọi số sớm hơn opts.time giây (3 / 5 / 8, sai dạng → 5) so với số trước →
--                    games.err.notYet (máy khách im lặng thử lại); kinh khi chưa có hàng đủ → games.err.noKinh;
--                    { deal } / { out } chỉ server ghi.
-- game_loto_fill   — game_move gọi: { call } → server bốc ngẫu nhiên một số chưa xướng.
-- game_loto_result — game_finish (0075) dùng hàm này: người kinh đúng trước thắng.
-- Chép luật lib/games/loto.js — đổi luật thì sửa cả hai.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_loto_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club    uuid;
  v_tickets jsonb := '[]';
  v_t       int[];
  v_cols    int[];
  r         record;
  row_i     int;
  c         int;
BEGIN
  FOR r IN SELECT seat, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    v_club := r.club_id;
    v_t := '{}';
    FOR row_i IN 1..9 LOOP
      v_cols := ARRAY(SELECT g FROM (SELECT g FROM generate_series(0, 8) g ORDER BY random() LIMIT 5) q ORDER BY g);
      FOREACH c IN ARRAY v_cols LOOP
        v_t := v_t || (SELECT x FROM generate_series(CASE WHEN c = 0 THEN 1 ELSE c * 10 END, CASE WHEN c = 8 THEN 90 ELSE c * 10 + 9 END) x
                        WHERE NOT (x = ANY(v_t)) ORDER BY random() LIMIT 1);
      END LOOP;
    END LOOP;
    v_tickets := v_tickets || jsonb_build_array(to_jsonb(v_t));
  END LOOP;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, 0, jsonb_build_object('deal', jsonb_build_object('tickets', v_tickets)));
END;
$$;

-- o_called = các số đã xướng · o_since = giờ (ms) số trước / lúc chia · o_winner = người kinh đúng trước (NULL = chưa).
CREATE OR REPLACE FUNCTION public.game_loto_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_called int[], OUT o_winner int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt     jsonb;
  v_time    bigint;
  v_tickets jsonb;
  v_n       int := 0;
  v_out     boolean[];
  v_since   bigint;
  v_err     text;
  v_c       int;
  m         record;
BEGIN
  o_called := '{}';
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (3, 5, 8) THEN (v_opt ->> 'time')::numeric::int ELSE 5 END
                        ELSE 5 END;
  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    IF jsonb_typeof(m.move -> 'deal') = 'object' THEN
      -- Chỉ nước 1 do game_loto_deal ghi: tin hình dạng tờ của server.
      IF v_tickets IS NOT NULL OR m.cand THEN v_err := 'games.err.badMove';
      ELSE
        v_tickets := m.move #> '{deal,tickets}';
        v_n := jsonb_array_length(v_tickets);
        v_out := array_fill(false, ARRAY[v_n]);
        v_since := m.at;
        CONTINUE;
      END IF;
    ELSIF v_tickets IS NULL THEN
      v_err := 'games.err.badMove';
    ELSIF o_winner IS NOT NULL THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      IF m.cand THEN v_err := 'games.err.badMove'; ELSE v_out[m.seat + 1] := true; CONTINUE; END IF;
    ELSIF m.move -> 'kinh' = 'true'::jsonb THEN
      -- Có hàng (5 số liền nhau trong tờ) mà cả 5 số đã xướng.
      IF NOT EXISTS (SELECT 1 FROM generate_series(0, 8) r
                      WHERE (SELECT count(*) FROM generate_series(0, 4) k
                              WHERE ((v_tickets -> m.seat -> (r * 5 + k)) #>> '{}')::int = ANY(o_called)) = 5) THEN
        v_err := 'games.err.noKinh';
      ELSIF NOT m.cand THEN
        o_winner := m.seat;
        CONTINUE;
      END IF;
    ELSIF m.cand THEN
      IF m.move -> 'call' IS DISTINCT FROM 'true'::jsonb OR cardinality(o_called) >= 90 THEN v_err := 'games.err.badMove';
      ELSIF m.at < v_since + v_time THEN v_err := 'games.err.notYet';
      END IF;
    ELSE
      v_c := CASE WHEN jsonb_typeof(m.move -> 'call') = 'number' AND (m.move ->> 'call') ~ '^[0-9]{1,2}$' THEN (m.move ->> 'call')::int END;
      IF v_c IS NULL OR v_c NOT BETWEEN 1 AND 90 OR v_c = ANY(o_called) THEN v_err := 'games.err.badMove';
      ELSE
        o_called := o_called || v_c;
        v_since := m.at;
        CONTINUE;
      END IF;
    END IF;
    IF m.cand THEN o_err := v_err; EXIT; END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_loto_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_loto_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_loto_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o_winner IS NOT NULL THEN jsonb_build_object('winners', jsonb_build_array(o_winner), 'draw', false) END
    FROM public.game_loto_run(p_room, NULL, NULL)
$$;

-- { call } → bốc ngẫu nhiên một số chưa xướng (check đã chặn gọi sớm / hết số). Nước khác giữ nguyên.
CREATE OR REPLACE FUNCTION public.game_loto_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_called int[];
BEGIN
  IF p_move -> 'call' IS DISTINCT FROM 'true'::jsonb THEN RETURN p_move; END IF;
  SELECT o_called INTO v_called FROM game_loto_run(p_room, NULL, NULL);
  RETURN jsonb_build_object('call', (SELECT x FROM generate_series(1, 90) x WHERE NOT (x = ANY(v_called)) ORDER BY random() LIMIT 1));
END;
$$;

REVOKE ALL ON FUNCTION public.game_loto_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_loto_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_loto_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_loto_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_loto_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

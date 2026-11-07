-- 0081_games_domino.sql — Domino: chia quân, nọc úp, kiểm từng nước, chấm điểm (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần bảng game_hands + game_start / game_move bản 0078 gọi game_<id>_deal / game_<id>_fill).
-- CHỈ THÊM HÀM. Chạy lại được.
--
-- game_domino_deal  — xào 28 quân, 7 quân mỗi ghế, còn lại là nọc ở ghế -1 (RLS 0078: ghế âm không ai đọc được).
--                     Ghi nước 1 { deal: { first, lead, n, pile } }.
-- game_domino_fill  — dựng lại ván (game_domino_run) với đủ quân từng tay, từ chối nước sai (không vào log).
--                     Bốc: chuyển một quân ngẫu nhiên từ nọc vào tay, log chỉ ghi { draw: true }.
-- game_domino_result — kết quả + điểm (cần quân còn lại); game_finish 0075 dùng hàm này, bỏ kết quả client.
-- Chép luật lib/games/domino.js — đổi luật thì sửa cả hai (domino.test.js gác bảng quân + mã lỗi).

-- Quân t (0..27) = [c_a[t+1], c_b[t+1]]; đôi là 0, 7, 13, 18, 22, 25, 27 (đôi càng cao số càng lớn).

/* ---------- Dựng lại ván ---------- */
-- p_move NULL: chỉ dựng lại, trả o_result khi hết ván. p_move có: kiểm nước đó của p_seat trên thế hiện tại → o_err.
CREATE OR REPLACE FUNCTION public.game_domino_run(p_room uuid, p_seat int, p_move jsonb, OUT o_err text, OUT o_result jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_a CONSTANT int[] := ARRAY[0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6];
  c_b CONSTANT int[] := ARRAY[0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 3, 4, 5, 6, 4, 5, 6, 5, 6, 6];
  v_hands  jsonb;
  v_n      int;
  v_turn   int;
  v_lead   int;
  v_left   int;
  v_right  int;
  v_len    int := 0;
  v_passes int := 0;
  v_pile   int := 0;
  v_out    boolean[];
  v_counts int[];
  v_played int[] := '{}';
  v_over   boolean := false;
  v_winner int;
  v_alive  int;
  v_hand   int[];
  v_pips   jsonb;
  v_scores jsonb;
  v_min    int;
  v_sum    int;
  m        record;
  mv       jsonb;
  s        int;
  t        int;
  k        int;
  y        int;
BEGIN
  SELECT jsonb_object_agg(seat::text, to_jsonb(cards)) INTO v_hands FROM game_hands WHERE room_id = p_room AND seat >= 0;

  FOR m IN
    SELECT x.seat, x.move, x.cand FROM (
      SELECT seq, seat::int AS seat, move, false AS cand FROM game_moves WHERE room_id = p_room
      UNION ALL SELECT 2147483647, p_seat, p_move, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    mv := m.move;
    s := m.seat;

    IF mv ? 'deal' THEN
      IF m.cand THEN o_err := 'games.err.badMove'; RETURN; END IF;
      v_n := jsonb_array_length(mv #> '{deal,n}');
      v_turn := (mv #>> '{deal,first}')::int;
      v_lead := (mv #>> '{deal,lead}')::int;
      v_pile := (mv #>> '{deal,pile}')::int;
      v_out := array_fill(false, ARRAY[v_n]);
      v_counts := array_fill(7, ARRAY[v_n]);
      CONTINUE;
    END IF;

    IF m.cand THEN
      IF v_n IS NULL THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF v_over THEN o_err := 'games.err.over'; RETURN; END IF;
      IF s IS NULL OR s < 0 OR s >= v_n OR v_out[s + 1] OR jsonb_typeof(mv) IS DISTINCT FROM 'object' OR mv ? 'out' THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      IF s <> v_turn THEN o_err := 'games.err.notYourTurn'; RETURN; END IF;
      v_hand := ARRAY(SELECT (e)::int FROM jsonb_array_elements_text(v_hands -> s::text) e WHERE NOT ((e)::int = ANY(v_played)));
      IF mv -> 'draw' = 'true'::jsonb OR mv -> 'pass' = 'true'::jsonb THEN
        IF v_len = 0 THEN o_err := 'games.err.mustLead'; RETURN; END IF;
        IF EXISTS (SELECT 1 FROM unnest(v_hand) h WHERE c_a[h + 1] IN (v_left, v_right) OR c_b[h + 1] IN (v_left, v_right)) THEN
          o_err := 'games.err.mustPlay'; RETURN;
        END IF;
        IF mv -> 'draw' = 'true'::jsonb THEN
          IF v_pile <= 0 THEN o_err := 'games.err.pileEmpty'; END IF;
        ELSIF v_pile > 0 THEN
          o_err := 'games.err.mustDraw';
        END IF;
        RETURN;
      END IF;
      IF jsonb_typeof(mv -> 'play') IS DISTINCT FROM 'number' OR (mv ->> 'play') !~ '^[0-9]{1,2}$' OR (mv ->> 'play')::int > 27 THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      t := (mv ->> 'play')::int;
      IF NOT (t = ANY(v_hand)) THEN o_err := 'games.err.notYourCard'; RETURN; END IF;
      IF v_lead IS NOT NULL AND t <> v_lead THEN o_err := 'games.err.mustOpen'; RETURN; END IF;
      IF v_len > 0 THEN
        IF NOT (c_a[t + 1] IN (v_left, v_right) OR c_b[t + 1] IN (v_left, v_right)) THEN o_err := 'games.err.noMatch'; RETURN; END IF;
        IF mv ->> 'end' IS NULL THEN o_err := 'games.err.pickEnd'; RETURN; END IF;
        IF NOT ((mv ->> 'end' = 'L' AND v_left IN (c_a[t + 1], c_b[t + 1])) OR (mv ->> 'end' = 'R' AND v_right IN (c_a[t + 1], c_b[t + 1]))) THEN
          o_err := 'games.err.noMatch'; RETURN;
        END IF;
      END IF;
      RETURN;
    END IF;

    /* Nước trong log — đã kiểm lúc ghi, chỉ áp. */
    IF v_n IS NULL OR v_over OR s < 0 OR s >= v_n OR v_out[s + 1] THEN CONTINUE; END IF;
    IF mv -> 'out' = 'true'::jsonb THEN
      v_out[s + 1] := true;
      IF v_turn = s THEN
        FOR k IN 1..v_n LOOP y := (s + k) % v_n; IF NOT v_out[y + 1] THEN v_turn := y; EXIT; END IF; END LOOP;
      END IF;
    ELSIF mv -> 'draw' = 'true'::jsonb THEN
      v_pile := v_pile - 1;
      v_counts[s + 1] := v_counts[s + 1] + 1;
      v_passes := 0;
      CONTINUE;
    ELSIF mv -> 'pass' = 'true'::jsonb THEN
      v_passes := v_passes + 1;
      FOR k IN 1..v_n LOOP y := (s + k) % v_n; IF NOT v_out[y + 1] THEN v_turn := y; EXIT; END IF; END LOOP;
    ELSE
      t := (mv ->> 'play')::int;
      IF v_len = 0 THEN
        v_left := c_a[t + 1]; v_right := c_b[t + 1];
      ELSIF mv ->> 'end' = 'L' THEN
        v_left := CASE WHEN c_b[t + 1] = v_left THEN c_a[t + 1] ELSE c_b[t + 1] END;
      ELSE
        v_right := CASE WHEN c_a[t + 1] = v_right THEN c_b[t + 1] ELSE c_a[t + 1] END;
      END IF;
      v_len := v_len + 1;
      v_played := v_played || t;
      v_lead := NULL;
      v_passes := 0;
      v_counts[s + 1] := v_counts[s + 1] - 1;
      IF v_counts[s + 1] = 0 THEN v_over := true; v_winner := s; CONTINUE; END IF;
      FOR k IN 1..v_n LOOP y := (s + k) % v_n; IF NOT v_out[y + 1] THEN v_turn := y; EXIT; END IF; END LOOP;
    END IF;
    v_alive := (SELECT count(*) FROM unnest(v_out) o WHERE NOT o);
    IF v_alive <= 1 THEN
      v_over := true;
      v_winner := (SELECT g - 1 FROM generate_subscripts(v_out, 1) g WHERE NOT v_out[g] LIMIT 1);
    ELSIF v_passes >= v_alive THEN
      v_over := true; -- tắc: chấm theo nút bên dưới
    END IF;
  END LOOP;

  IF p_move IS NOT NULL OR NOT v_over THEN RETURN; END IF;

  -- Nút còn trên tay từng người còn ngồi; tắc thì ai ít nút nhất thắng (bằng nhau: hoà).
  v_pips := '{}'::jsonb;
  FOR k IN 0..v_n - 1 LOOP
    IF v_out[k + 1] THEN CONTINUE; END IF;
    v_pips := v_pips || jsonb_build_object(k::text, COALESCE((
      SELECT sum(c_a[(e)::int + 1] + c_b[(e)::int + 1]) FROM jsonb_array_elements_text(v_hands -> k::text) e
       WHERE NOT ((e)::int = ANY(v_played))), 0));
  END LOOP;
  IF v_winner IS NULL THEN
    v_min := (SELECT min(value::int) FROM jsonb_each_text(v_pips));
    IF (SELECT count(*) FROM jsonb_each_text(v_pips) WHERE value::int = v_min) = 1 THEN
      v_winner := (SELECT key::int FROM jsonb_each_text(v_pips) WHERE value::int = v_min);
    END IF;
  END IF;
  v_scores := (SELECT jsonb_object_agg(g::text, 0) FROM generate_series(0, v_n - 1) g);
  IF v_winner IS NULL THEN
    o_result := jsonb_build_object('winners', '[]'::jsonb, 'draw', true, 'scores', v_scores, 'pips', v_pips);
    RETURN;
  END IF;
  v_sum := COALESCE((SELECT sum(value::int) FROM jsonb_each_text(v_pips) WHERE key <> v_winner::text), 0);
  v_scores := jsonb_set(v_scores, ARRAY[v_winner::text], to_jsonb(v_sum));
  o_result := jsonb_build_object('winners', jsonb_build_array(v_winner), 'draw', false, 'scores', v_scores, 'pips', v_pips);
END;
$$;

CREATE OR REPLACE FUNCTION public.game_domino_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_domino_run(p_room, NULL, NULL) $$;

/* ---------- Kiểm + điền nước (game_move 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_domino_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_err text;
  v_t   int;
BEGIN
  SELECT o_err INTO v_err FROM game_domino_run(p_room, p_seat, p_move);
  IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;
  IF p_move -> 'draw' = 'true'::jsonb THEN
    SELECT x INTO v_t FROM game_hands h, unnest(h.cards) x WHERE h.room_id = p_room AND h.seat = -1 ORDER BY random() LIMIT 1;
    UPDATE game_hands SET cards = array_remove(cards, v_t) WHERE room_id = p_room AND seat = -1;
    UPDATE game_hands SET cards = cards || v_t WHERE room_id = p_room AND seat = p_seat;
    RETURN '{"draw": true}'::jsonb;
  END IF;
  IF p_move -> 'pass' = 'true'::jsonb THEN RETURN '{"pass": true}'::jsonb; END IF;
  RETURN jsonb_build_object('play', (p_move ->> 'play')::int, 'end', COALESCE(p_move ->> 'end', 'L'));
END;
$$;

/* ---------- Chia quân (game_start 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_domino_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_hand CONSTANT int := 7;
  c_a CONSTANT int[] := ARRAY[0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6];
  c_b CONSTANT int[] := ARRAY[0, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 3, 4, 5, 6, 4, 5, 6, 5, 6, 6];
  v_set   int[];
  v_club  uuid;
  v_mem   uuid;
  v_first int;
  v_lead  int;
  v_prev  game_rooms;
  k       int := 0;
  r       record;
BEGIN
  v_set := ARRAY(SELECT x FROM generate_series(0, 27) x ORDER BY random());
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    VALUES (p_room, r.seat, r.member_id, r.club_id, ARRAY(SELECT x FROM unnest(v_set[k * c_hand + 1 : k * c_hand + c_hand]) x ORDER BY x))
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_club := r.club_id;
    v_mem := r.member_id;
    k := k + 1;
  END LOOP;
  -- Nọc: ghế -1, không ai đọc được (cột member_id bắt buộc nên ghi tạm người ngồi cuối — RLS không xét cột này ở ghế âm).
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
  VALUES (p_room, -1, v_mem, v_club, COALESCE(v_set[k * c_hand + 1 : 28], '{}'))
  ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;

  SELECT * INTO v_prev FROM game_rooms WHERE next_room = p_room AND status = 'finished' LIMIT 1;
  IF v_prev.id IS NOT NULL AND v_prev.result #>> '{winners,0}' IS NOT NULL THEN
    SELECT n.seat INTO v_first
      FROM game_room_players o JOIN game_room_players n ON n.member_id = o.member_id AND n.room_id = p_room AND n.left_at IS NULL
     WHERE o.room_id = v_prev.id AND o.seat = (v_prev.result #>> '{winners,0}')::int
     ORDER BY o.left_at NULLS FIRST LIMIT 1;
  END IF;
  IF v_first IS NULL THEN
    -- Đôi cao nhất; không ai có đôi thì quân nhiều nút nhất.
    SELECT h.seat, x INTO v_first, v_lead
      FROM game_hands h, unnest(h.cards) x
     WHERE h.room_id = p_room AND h.seat >= 0
     ORDER BY (c_a[x + 1] = c_b[x + 1]) DESC, c_a[x + 1] + c_b[x + 1] DESC, x DESC
     LIMIT 1;
  END IF;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_first,
          jsonb_build_object('deal', jsonb_build_object('first', v_first, 'lead', v_lead, 'n', to_jsonb(array_fill(c_hand, ARRAY[k])), 'pile', 28 - c_hand * k)));
END;
$$;

REVOKE ALL ON FUNCTION public.game_domino_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_domino_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_domino_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_domino_deal(uuid) FROM PUBLIC, anon, authenticated;

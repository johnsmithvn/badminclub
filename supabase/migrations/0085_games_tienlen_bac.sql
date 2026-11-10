-- 0085_games_tienlen_bac.sql — Tiến lên MIỀN BẮC: tuỳ chọn phòng options.variant = 'bac' (docs/GAMES.md §12). Chạy sau 0078.
--
-- THÊM: game_tienlen_bac_combo / _bac_beats / _bac_thoi.
-- SỬA (chép nguyên bản 0078, thêm đúng phần ghi chú "0085"): game_tienlen_run, game_tienlen_deal.
-- Phòng không có variant (mọi phòng cũ) → miền Nam y như trước. Chỉ thay hàm, không đụng bảng / data.
-- Tuỳ chọn options.lead = 'free' (cả hai miền): người cầm lá nhỏ nhất vẫn đi trước nhưng nước đầu đánh tự do —
--   game_tienlen_deal ghi low = null, game_tienlen_run chỉ bắt mustLow khi low khác null.
--
-- Luật chép lib/games/tienlen.js (comboOf / beats / thoiOf với bac = true, finish có `chot`) — đổi một bên phải đổi bên kia:
--   chặn phải đồng chất: lẻ cùng chất, đôi / sám cùng bộ chất, sảnh cả dây một chất (sảnh lẫn chất không thành bộ);
--   heo chặn mọi lẻ / đôi không phải heo; không đôi thông, không chặt ngoài lượt, không tới trắng, không cóng;
--   tứ quý chặt heo, đôi heo, tứ quý nhỏ hơn; về bằng nước có heo / tứ quý = về chót; thối chỉ tính heo + tứ quý.

BEGIN;

-- comboOf(cards, true): như game_tienlen_combo, thêm mask = các chất (bit 1 << chất); bỏ đôi thông, bỏ sảnh lẫn chất.
CREATE OR REPLACE FUNCTION public.game_tienlen_bac_combo(p_cards int[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k    jsonb := game_tienlen_combo(p_cards);
  mask int;
BEGIN
  IF k IS NULL THEN RETURN NULL; END IF;
  SELECT bit_or(1 << (x & 3)) INTO mask FROM unnest(p_cards) x;
  IF k ->> 'kind' = 'pairs' OR (k ->> 'kind' = 'straight' AND mask & (mask - 1) <> 0) THEN RETURN NULL; END IF;
  RETURN k || jsonb_build_object('mask', mask);
END;
$$;

-- beats(a, t, true). Heo = lẻ / đôi có lá cao nhất là 2 (hạng 12).
CREATE OR REPLACE FUNCTION public.game_tienlen_bac_beats(a jsonb, t jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  a_heo boolean;
  t_heo boolean;
BEGIN
  IF t IS NULL THEN RETURN true; END IF;
  a_heo := a ->> 'kind' IN ('single', 'pair') AND ((a ->> 'top')::int >> 2) = 12;
  t_heo := t ->> 'kind' IN ('single', 'pair') AND ((t ->> 'top')::int >> 2) = 12;
  IF a ->> 'kind' = 'quad' THEN
    IF t ->> 'kind' = 'quad' THEN RETURN (a ->> 'top')::int > (t ->> 'top')::int; END IF;
    RETURN t_heo;
  END IF;
  IF a ->> 'kind' <> t ->> 'kind' OR a ->> 'len' <> t ->> 'len' THEN RETURN false; END IF;
  IF a_heo AND NOT t_heo THEN RETURN true; END IF;
  RETURN (a ->> 'top')::int > (t ->> 'top')::int AND (a_heo OR a ->> 'mask' = t ->> 'mask');
END;
$$;

-- thoiOf(hand, true): heo (đen 1, đỏ 2) + mỗi tứ quý 4.
CREATE OR REPLACE FUNCTION public.game_tienlen_bac_thoi(p_hand int[])
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((SELECT sum(CASE WHEN (x & 3) >= 2 THEN 2 ELSE 1 END)::int FROM unnest(p_hand) x WHERE x >> 2 = 12), 0)
       + 4 * (SELECT count(*)::int FROM (SELECT x >> 2 AS r FROM unnest(p_hand) x WHERE x >> 2 < 12 GROUP BY 1 HAVING count(*) = 4) q)
$$;

CREATE OR REPLACE FUNCTION public.game_tienlen_run(p_room uuid, p_seat int, p_move jsonb, OUT o_err text, OUT o_result jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_hand    CONSTANT int := 13;   -- = HAND
  v_hands   jsonb;
  v_started boolean := false;
  v_over    boolean := false;
  v_white   boolean := false;
  v_n       int := 0;
  v_n0      int[];
  v_counts  int[];
  v_out     boolean[];
  v_passed  boolean[];
  v_table   jsonb;
  v_tcards  int[];
  v_by      int;
  v_turn    int;
  v_low     int;
  v_gone    int[] := '{}';
  v_order   int[] := '{}';
  v_fin     int[] := '{}';
  v_cong    int[] := '{}';
  v_left_s  int[] := '{}';
  v_pot_amt int;
  v_pot_fr  int;
  v_pot_to  int;
  v_pay     jsonb := '[]';
  v_err     text;
  v_act     text;
  v_mine    boolean;
  v_len     int;
  v_play    int[];
  v_k       jsonb;
  v_alive   int[];
  v_left    int[];
  v_y       int;
  v_pts     int[];
  v_scores  jsonb;
  v_v       int;
  v_bac     boolean;
  v_chot    int[] := '{}';
  m         record;
  d         jsonb;
  i         int;
BEGIN
  -- 0085: miền Bắc theo options.variant (sai dạng → miền Nam, như variantOf của JS).
  SELECT COALESCE(options ->> 'variant' = 'bac', false) INTO v_bac FROM game_rooms WHERE id = p_room;
  SELECT jsonb_object_agg(seat::text, to_jsonb(cards)) INTO v_hands FROM game_hands WHERE room_id = p_room AND seat >= 0;

  FOR m IN
    SELECT x.seat, x.move, x.cand FROM (
      SELECT seat::int AS seat, move, false AS cand, seq FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT p_seat, p_move, true, 2147483647 WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    v_act := NULL;

    /* ----- validate ----- */
    IF jsonb_typeof(m.move -> 'deal') = 'object' THEN
      v_act := 'deal';
      IF v_started OR m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF NOT v_started THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      v_act := 'out';
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'pass' = 'true'::jsonb THEN
      v_act := 'pass';
      IF m.seat IS DISTINCT FROM v_turn THEN v_err := 'games.err.notYourTurn';
      ELSIF v_table IS NULL THEN v_err := 'games.err.mustLead';
      END IF;
    ELSE
      v_act := 'play';
      v_mine := m.seat IS NOT DISTINCT FROM v_turn;
      d := m.move -> 'play';
      v_len := CASE WHEN jsonb_typeof(d) = 'array' THEN jsonb_array_length(d) END;
      -- Ngoài lượt chỉ có thể là 4 đôi thông chặt (≥ 8 lá). IF lồng nhau: SQL không hứa thứ tự xét của OR.
      IF NOT v_mine AND COALESCE(v_len, 0) < 8 THEN
        v_err := 'games.err.notYourTurn';
      ELSIF v_len IS NULL OR v_len NOT BETWEEN 1 AND c_hand THEN
        v_err := 'games.err.badMove';
      ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(d) e WHERE jsonb_typeof(e) <> 'number') THEN
        v_err := 'games.err.badMove';
      ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(d) e
                     WHERE (e #>> '{}')::numeric <> trunc((e #>> '{}')::numeric) OR (e #>> '{}')::numeric NOT BETWEEN 0 AND 51) THEN
        v_err := 'games.err.badMove';
      ELSE
        v_play := ARRAY(SELECT (e #>> '{}')::numeric::int FROM jsonb_array_elements(d) e);
        IF EXISTS (SELECT 1 FROM unnest(v_play) x
                    WHERE x = ANY(v_gone) OR NOT COALESCE((v_hands -> m.seat::text) @> jsonb_build_array(x), false)) THEN
          v_err := 'games.err.notYourCard';
        ELSE
          v_k := CASE WHEN v_bac THEN game_tienlen_bac_combo(v_play) ELSE game_tienlen_combo(v_play) END;
          IF v_k IS NULL THEN
            v_err := 'games.err.badCombo';
          ELSIF NOT v_mine THEN
            IF NOT (v_k ->> 'kind' = 'pairs' AND (v_k ->> 'len')::int >= 4 AND v_table IS NOT NULL AND game_tienlen_beats(v_k, v_table)) THEN
              v_err := 'games.err.notYourTurn';
            END IF;
          ELSIF v_low IS NOT NULL AND NOT (v_low = ANY(v_play)) THEN
            v_err := 'games.err.mustLow';
          ELSIF NOT CASE WHEN v_bac THEN game_tienlen_bac_beats(v_k, v_table) ELSE game_tienlen_beats(v_k, v_table) END THEN
            v_err := 'games.err.tooLow';
          END IF;
        END IF;
      END IF;
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;

    /* ----- apply ----- */
    IF v_act = 'deal' THEN
      d := m.move -> 'deal';
      v_n0 := ARRAY(SELECT e::int FROM jsonb_array_elements_text(d -> 'n') e);
      v_counts := v_n0;
      v_n := cardinality(v_n0);
      v_out := array_fill(false, ARRAY[v_n]);
      v_passed := array_fill(false, ARRAY[v_n]);
      v_turn := (d ->> 'first')::int;
      v_low := (d ->> 'low')::int;
      v_started := true;
      IF jsonb_typeof(d -> 'white') = 'number' AND v_bac THEN
        v_started := false;  -- miền Bắc không có tới trắng: { deal } kèm white là sai, như validate của JS
        CONTINUE;
      END IF;
      IF jsonb_typeof(d -> 'white') = 'number' THEN
        v_white := true;
        v_over := true;
        v_turn := NULL;
        v_order := ARRAY[(d ->> 'white')::int] || ARRAY(SELECT g FROM generate_series(0, v_n - 1) g WHERE g <> (d ->> 'white')::int ORDER BY g);
      END IF;
      CONTINUE;
    ELSIF v_act = 'out' THEN
      v_out[m.seat + 1] := true;
      v_left_s := m.seat || v_left_s;  -- rời sau xếp trên người rời trước
    ELSIF v_act = 'pass' THEN
      v_passed[m.seat + 1] := true;
    ELSE
      IF v_table IS NOT NULL AND v_k ->> 'kind' IN ('quad', 'pairs')
         AND ((v_table ->> 'kind' IN ('single', 'pair') AND ((v_table ->> 'top')::int >> 2) = 12) OR v_table ->> 'kind' IN ('quad', 'pairs')) THEN
        v_pot_amt := COALESCE(v_pot_amt, 0) + game_tienlen_price(v_tcards);
        v_pot_fr := v_by;
        v_pot_to := m.seat;
      END IF;
      v_counts[m.seat + 1] := v_counts[m.seat + 1] - cardinality(v_play);
      v_gone := v_gone || v_play;
      v_table := v_k;
      v_tcards := v_play;
      v_by := m.seat;
      v_low := NULL;
      v_turn := m.seat;
      v_passed[m.seat + 1] := false;
      -- 0085 miền Bắc: về bằng nước có heo / tứ quý → về chót (ra khỏi ván, xếp dưới người còn bài), không có cóng.
      IF v_counts[m.seat + 1] <= 0 AND v_bac AND (v_k ->> 'kind' = 'quad' OR EXISTS (SELECT 1 FROM unnest(v_play) x WHERE x >> 2 = 12)) THEN
        v_out[m.seat + 1] := true;
        v_chot := v_chot || m.seat;
        v_fin := v_fin || m.seat;
      ELSIF v_counts[m.seat + 1] <= 0 AND v_bac THEN
        v_out[m.seat + 1] := true;
        v_order := v_order || m.seat;
        v_fin := v_fin || m.seat;
      -- Hết bài: về đích. Người về Nhất thì ai chưa đánh lá nào là cóng, ra khỏi ván luôn.
      ELSIF v_counts[m.seat + 1] <= 0 THEN
        v_out[m.seat + 1] := true;
        v_order := v_order || m.seat;
        v_fin := v_fin || m.seat;
        IF cardinality(v_order) = 1 THEN
          FOR i IN 0..v_n - 1 LOOP
            IF NOT v_out[i + 1] AND v_counts[i + 1] = v_n0[i + 1] THEN
              v_cong := v_cong || i;
              v_out[i + 1] := true;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    /* ----- settle (như settle() của JS) ----- */
    v_alive := ARRAY(SELECT j - 1 FROM generate_subscripts(v_out, 1) j WHERE NOT v_out[j] ORDER BY j);
    IF cardinality(v_alive) <= 1 THEN
      IF v_pot_amt IS NOT NULL THEN
        v_pay := v_pay || jsonb_build_object('amount', v_pot_amt, 'from', v_pot_fr, 'to', v_pot_to);
        v_pot_amt := NULL;
      END IF;
      v_order := v_order || v_alive || v_chot || v_cong || v_left_s;
      v_over := true;
      v_turn := NULL;
      v_table := NULL;
      CONTINUE;
    END IF;
    IF v_table IS NOT NULL THEN
      v_left := ARRAY(SELECT j - 1 FROM generate_subscripts(v_out, 1) j WHERE NOT v_out[j] AND NOT v_passed[j] ORDER BY j);
      IF cardinality(v_left) = 0 OR (cardinality(v_left) = 1 AND v_left[1] = v_by) THEN
        IF v_out[v_by + 1] THEN
          v_turn := NULL;
          FOR i IN 1..v_n - 1 LOOP
            v_y := (v_by + i) % v_n;
            IF NOT v_out[v_y + 1] THEN v_turn := v_y; EXIT; END IF;
          END LOOP;
        ELSE
          v_turn := v_by;
        END IF;
        IF v_pot_amt IS NOT NULL THEN
          v_pay := v_pay || jsonb_build_object('amount', v_pot_amt, 'from', v_pot_fr, 'to', v_pot_to);
          v_pot_amt := NULL;
        END IF;
        v_table := NULL;
        v_passed := array_fill(false, ARRAY[v_n]);
        CONTINUE;
      END IF;
    END IF;
    IF m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    v_turn := NULL;
    FOR i IN 1..v_n - 1 LOOP
      v_y := (m.seat + i) % v_n;
      IF NOT v_out[v_y + 1] AND NOT v_passed[v_y + 1] THEN v_turn := v_y; EXIT; END IF;
    END LOOP;
  END LOOP;

  IF NOT v_over THEN RETURN; END IF;

  -- tally() của JS: điểm hạng (cóng: gấp đôi điểm Bét) + tiền chặt.
  v_pts := CASE v_n WHEN 2 THEN ARRAY[1, -1] WHEN 3 THEN ARRAY[2, 0, -2] ELSE ARRAY[3, 1, -1, -3] END;
  v_scores := (SELECT jsonb_object_agg(g::text, 0) FROM generate_series(0, v_n - 1) g);
  FOR i IN 1..cardinality(v_order) LOOP
    v_v := CASE WHEN v_order[i] = ANY(v_cong) THEN v_pts[v_n] * 2 ELSE v_pts[i] END;
    v_scores := jsonb_set(v_scores, ARRAY[v_order[i]::text], to_jsonb((v_scores ->> v_order[i]::text)::int + v_v));
  END LOOP;
  FOR d IN SELECT value FROM jsonb_array_elements(v_pay) LOOP
    v_scores := jsonb_set(v_scores, ARRAY[d ->> 'from'], to_jsonb((v_scores ->> (d ->> 'from'))::int - (d ->> 'amount')::int));
    v_scores := jsonb_set(v_scores, ARRAY[d ->> 'to'], to_jsonb((v_scores ->> (d ->> 'to'))::int + (d ->> 'amount')::int));
  END LOOP;
  -- Thối (chỉ server làm được — cần bài còn trên tay): người chưa về đích, không rời ván, còn heo / hàng thì trả người
  -- về Nhất. Ván tới trắng không tính thối.
  IF NOT v_white THEN
    FOR i IN 0..v_n - 1 LOOP
      IF i = ANY(v_fin) OR i = ANY(v_left_s) OR i = v_order[1] THEN CONTINUE; END IF;
      v_v := (CASE WHEN v_bac THEN game_tienlen_bac_thoi(ARRAY(SELECT (e #>> '{}')::int FROM jsonb_array_elements(v_hands -> i::text) e
                                     WHERE NOT ((e #>> '{}')::int = ANY(v_gone)))) ELSE game_tienlen_thoi(ARRAY(SELECT (e #>> '{}')::int FROM jsonb_array_elements(v_hands -> i::text) e
                                     WHERE NOT ((e #>> '{}')::int = ANY(v_gone)))) END);
      IF v_v > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[i::text], to_jsonb((v_scores ->> i::text)::int - v_v));
        v_scores := jsonb_set(v_scores, ARRAY[v_order[1]::text], to_jsonb((v_scores ->> v_order[1]::text)::int + v_v));
      END IF;
    END LOOP;
  END IF;
  o_result := jsonb_build_object('winners', jsonb_build_array(v_order[1]), 'draw', false, 'ranks', to_jsonb(v_order), 'scores', v_scores);
END;
$$;


CREATE OR REPLACE FUNCTION public.game_tienlen_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_hand  CONSTANT int := 13;
  v_deck  int[];
  v_club  uuid;
  v_first int;
  v_low   int;
  v_white int;
  v_prev  game_rooms;
  k       int := 0;
  r       record;
BEGIN
  v_deck := ARRAY(SELECT c FROM generate_series(0, 51) c ORDER BY random());
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    VALUES (p_room, r.seat, r.member_id, r.club_id, ARRAY(SELECT x FROM unnest(v_deck[k * c_hand + 1 : k * c_hand + c_hand]) x ORDER BY x))
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_club := r.club_id;
    k := k + 1;
  END LOOP;

  SELECT * INTO v_prev FROM game_rooms WHERE next_room = p_room AND status = 'finished' LIMIT 1;
  IF v_prev.id IS NOT NULL THEN
    SELECT n.seat INTO v_first
      FROM game_room_players o JOIN game_room_players n ON n.member_id = o.member_id AND n.room_id = p_room AND n.left_at IS NULL
     WHERE o.room_id = v_prev.id AND o.seat = (v_prev.result #>> '{winners,0}')::int
     ORDER BY o.left_at NULLS FIRST LIMIT 1;
  END IF;
  IF v_first IS NULL THEN
    SELECT h.seat, q.lo INTO v_first, v_low
      FROM game_hands h CROSS JOIN LATERAL (SELECT min(x) AS lo FROM unnest(h.cards) x) q
     WHERE h.room_id = p_room AND h.seat >= 0 ORDER BY q.lo LIMIT 1;
  END IF;
  -- 0085: phòng chọn lead = 'free' thì nước đầu không buộc có lá nhỏ nhất.
  IF (SELECT options ->> 'lead' FROM game_rooms WHERE id = p_room) = 'free' THEN
    v_low := NULL;
  END IF;
  -- 0085: miền Bắc không có tới trắng.
  IF COALESCE((SELECT options ->> 'variant' = 'bac' FROM game_rooms WHERE id = p_room), false) IS NOT TRUE THEN
    SELECT seat INTO v_white FROM game_hands WHERE room_id = p_room AND seat >= 0 AND game_tienlen_white(cards) ORDER BY seat LIMIT 1;
  END IF;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_first,
          jsonb_build_object('deal', jsonb_build_object('first', v_first, 'low', v_low, 'n', to_jsonb(array_fill(c_hand, ARRAY[k])), 'white', v_white)));
END;
$$;


REVOKE ALL ON FUNCTION public.game_tienlen_bac_combo(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_bac_beats(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_bac_thoi(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_deal(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

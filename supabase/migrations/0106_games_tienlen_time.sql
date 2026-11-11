-- 0106_games_tienlen_time.sql — Tiến lên: ĐỒNG HỒ LƯỢT (docs/GAMES.md §12). Chạy sau 0094.
--
-- Tuỳ chọn phòng options.time = 15 | 20 | 30 giây mỗi lượt (khác = 0 = không giới hạn — mọi phòng cũ). Hạn lượt = giờ
-- ghi (created_at) của nước gần nhất + time. Máy bất kỳ đang ngồi bàn báo { timeout } → game_tienlen_run chỉ nhận khi
-- now() đã qua hạn (sớm → games.err.notYet, máy khách im lặng thử lại); game_tienlen_fill đi thay người tới lượt:
--   có bộ trên bàn → { timeout: true, pass: true } · mở vòng → { timeout: true, play: [lá nhỏ nhất còn trên tay] }.
-- Nước đó ghi ở ghế người báo nhưng áp như nước của người tới lượt (giống Bài bịp 0082).
--
-- THÊM: game_tienlen_fill.
-- SỬA: game_tienlen_run — chép nguyên bản 0094, thêm đúng các chỗ ghi chú "0106": đọc options.time, giờ từng nước,
--      nhánh { timeout }, ghế áp nước (v_seat) thay cho m.seat, ba cột ra o_turn / o_lead / o_gone cho _fill.
--      Đổi cột ra = đổi kiểu trả về → phải DROP rồi tạo lại; _check / _result (gọi _run) tạo lại y bản 0078.
-- Chỉ thay hàm, không đụng bảng / data. Luật chép lib/games/tienlen.js (TIMES, timeOf, deadlineOf, validate / apply
-- nhánh timeout) — đổi một bên phải đổi bên kia.

BEGIN;

DROP FUNCTION IF EXISTS public.game_tienlen_run(uuid, int, jsonb);

CREATE FUNCTION public.game_tienlen_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_result jsonb, OUT o_turn int, OUT o_lead boolean, OUT o_gone int[])
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
  v_time    int;      -- 0106: ms mỗi lượt, 0 = không giới hạn (như timeOf của JS)
  v_since   bigint;   -- 0106: giờ (ms) của nước gần nhất đã áp
  v_seat    int;      -- 0106: ghế áp nước — nước hết giờ áp như người tới lượt
  m         record;
  d         jsonb;
  i         int;
BEGIN
  -- 0094: miền Bắc theo options.variant (sai dạng → miền Nam, như variantOf của JS).
  -- 0106: options.time — CASE lồng nhau: chỉ ép kiểu số khi đúng là số.
  SELECT COALESCE(options ->> 'variant' = 'bac', false),
         1000 * CASE WHEN jsonb_typeof(options -> 'time') = 'number'
                     THEN CASE WHEN (options ->> 'time')::numeric IN (15, 20, 30) THEN (options ->> 'time')::numeric::int ELSE 0 END
                     ELSE 0 END
    INTO v_bac, v_time FROM game_rooms WHERE id = p_room;
  SELECT jsonb_object_agg(seat::text, to_jsonb(cards)) INTO v_hands FROM game_hands WHERE room_id = p_room AND seat >= 0;

  FOR m IN
    SELECT x.seat, x.move, x.cand, x.at FROM (
      SELECT seat::int AS seat, move, false AS cand, seq, floor(extract(epoch FROM created_at) * 1000)::bigint AS at
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT p_seat, p_move, true, 2147483647, floor(extract(epoch FROM now()) * 1000)::bigint WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    v_act := NULL;
    v_seat := m.seat;

    /* ----- 0106: hết giờ ----- */
    IF m.move -> 'timeout' = 'true'::jsonb THEN
      IF m.cand THEN
        -- Máy khách báo: ai ngồi bàn cũng báo được, server đo bằng giờ của nó.
        IF NOT v_started THEN o_err := 'games.err.badMove';
        ELSIF v_over THEN o_err := 'games.err.over';
        ELSIF v_time = 0 OR v_turn IS NULL OR m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n THEN o_err := 'games.err.badMove';
        ELSIF m.at < v_since + v_time THEN o_err := 'games.err.notYet';
        END IF;
        o_turn := v_turn;
        o_lead := v_table IS NULL;
        o_gone := v_gone;
        EXIT;
      END IF;
      v_seat := v_turn;  -- nước server đã đi thay: kiểm + áp như của người tới lượt
    END IF;

    /* ----- validate ----- */
    IF jsonb_typeof(m.move -> 'deal') = 'object' THEN
      v_act := 'deal';
      IF v_started OR m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF NOT v_started THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF v_seat IS NULL OR v_seat < 0 OR v_seat >= v_n OR v_out[v_seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      v_act := 'out';
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'pass' = 'true'::jsonb THEN
      v_act := 'pass';
      IF v_seat IS DISTINCT FROM v_turn THEN v_err := 'games.err.notYourTurn';
      ELSIF v_table IS NULL THEN v_err := 'games.err.mustLead';
      END IF;
    ELSE
      v_act := 'play';
      v_mine := v_seat IS NOT DISTINCT FROM v_turn;
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
                    WHERE x = ANY(v_gone) OR NOT COALESCE((v_hands -> v_seat::text) @> jsonb_build_array(x), false)) THEN
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
          -- CASE phải nằm trong ngoặc: plpgsql cắt điều kiện IF ở chữ THEN đầu tiên ngoài ngoặc.
          ELSIF NOT (CASE WHEN v_bac THEN game_tienlen_bac_beats(v_k, v_table) ELSE game_tienlen_beats(v_k, v_table) END) THEN
            v_err := 'games.err.tooLow';
          END IF;
        END IF;
      END IF;
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;
    v_since := m.at;  -- 0106: như `since` của JS — giờ của mọi nước đã áp

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
      v_out[v_seat + 1] := true;
      v_left_s := v_seat || v_left_s;  -- rời sau xếp trên người rời trước
    ELSIF v_act = 'pass' THEN
      v_passed[v_seat + 1] := true;
    ELSE
      IF v_table IS NOT NULL AND v_k ->> 'kind' IN ('quad', 'pairs')
         AND ((v_table ->> 'kind' IN ('single', 'pair') AND ((v_table ->> 'top')::int >> 2) = 12) OR v_table ->> 'kind' IN ('quad', 'pairs')) THEN
        v_pot_amt := COALESCE(v_pot_amt, 0) + game_tienlen_price(v_tcards);
        v_pot_fr := v_by;
        v_pot_to := v_seat;
      END IF;
      v_counts[v_seat + 1] := v_counts[v_seat + 1] - cardinality(v_play);
      v_gone := v_gone || v_play;
      v_table := v_k;
      v_tcards := v_play;
      v_by := v_seat;
      v_low := NULL;
      v_turn := v_seat;
      v_passed[v_seat + 1] := false;
      -- 0094 miền Bắc: về bằng nước có heo / tứ quý → về chót (ra khỏi ván, xếp dưới người còn bài), không có cóng.
      IF v_counts[v_seat + 1] <= 0 AND v_bac AND (v_k ->> 'kind' = 'quad' OR EXISTS (SELECT 1 FROM unnest(v_play) x WHERE x >> 2 = 12)) THEN
        v_out[v_seat + 1] := true;
        v_chot := v_chot || v_seat;
        v_fin := v_fin || v_seat;
      ELSIF v_counts[v_seat + 1] <= 0 AND v_bac THEN
        v_out[v_seat + 1] := true;
        v_order := v_order || v_seat;
        v_fin := v_fin || v_seat;
      -- Hết bài: về đích. Người về Nhất thì ai chưa đánh lá nào là cóng, ra khỏi ván luôn.
      ELSIF v_counts[v_seat + 1] <= 0 THEN
        v_out[v_seat + 1] := true;
        v_order := v_order || v_seat;
        v_fin := v_fin || v_seat;
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
    IF v_seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    v_turn := NULL;
    FOR i IN 1..v_n - 1 LOOP
      v_y := (v_seat + i) % v_n;
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

-- Tạo lại y bản 0078 (gọi _run mới).
CREATE OR REPLACE FUNCTION public.game_tienlen_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_tienlen_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_tienlen_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_tienlen_run(p_room, NULL, NULL) $$;

-- game_move (0078) tự tìm hàm này, gọi sau _check. Nước thường giữ nguyên; { timeout } → server đi thay người tới lượt.
CREATE OR REPLACE FUNCTION public.game_tienlen_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r     record;
  v_low int;
BEGIN
  IF p_move -> 'timeout' IS DISTINCT FROM 'true'::jsonb THEN RETURN p_move; END IF;
  SELECT * INTO r FROM game_tienlen_run(p_room, p_seat, p_move);
  IF r.o_err IS NOT NULL THEN RAISE EXCEPTION '%', r.o_err; END IF;
  IF NOT r.o_lead THEN RETURN '{"timeout": true, "pass": true}'::jsonb; END IF;
  -- Mở vòng: lá nhỏ nhất còn trên tay (nước đầu bắt lá low thì lá đó chính là lá nhỏ nhất của người đi trước).
  SELECT min(x) INTO v_low
    FROM game_hands h CROSS JOIN LATERAL unnest(h.cards) x
   WHERE h.room_id = p_room AND h.seat = r.o_turn AND NOT (x = ANY(r.o_gone));
  RETURN jsonb_build_object('timeout', true, 'play', jsonb_build_array(v_low));
END;
$$;

REVOKE ALL ON FUNCTION public.game_tienlen_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

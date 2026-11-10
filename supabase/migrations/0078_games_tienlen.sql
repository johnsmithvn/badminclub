-- 0078_games_tienlen.sql — Tiến lên miền Nam + khung cho game có THÔNG TIN ẨN (docs/GAMES.md §5.2, §12). Chạy sau 0075.
--
-- Không dùng Edge Function: bài trên tay nằm ở bảng game_hands, RLS chỉ cho chủ bài đọc (hết ván thì cả CLB xem được
-- để lật bài). Server tự chia bài, tự kiểm từng nước bằng SQL (có đủ bài mọi tay) và tự chấm — client không thấy bài
-- người khác, cũng không ghi được nước đánh lá mình không có.
--
-- THÊM: bảng game_hands · game_tienlen_combo / _beats / _price / _thoi / _white / _run / _check / _result / _deal.
-- SỬA (chép nguyên bản 0074, thêm đúng phần ghi chú "0078"):
--   game_start — xong thì gọi game_<id>_deal(uuid) nếu game có (chia bài + ghi nước 1 { deal }).
--   game_move  — khoá phòng; gọi game_<id>_check(uuid, int, jsonb) nếu có: trả mã lỗi là từ chối luôn, không ghi;
--                rồi gọi game_<id>_fill(uuid, int, jsonb) nếu có: server điền / che nước trước khi ghi (đổ xúc xắc,
--                kết quả phát bắn, rút bài — 0079+). Game không có hai hàm này → y như trước.
--   game_leave / game_claim — ván còn ≥ 2 người (chỉ xảy ra ở game 3–4 người) thì ghi nước { out: true } cho người
--                vừa rời, để luật bỏ qua lượt của họ. Game 2 người: còn 1 người là xong ván như cũ, không ghi gì thêm.
-- Không đụng matches / player_ratings / clubs.seasons → không đổi Elo, điểm mùa, sổ quỹ.
--
-- Luật chép từ lib/games/tienlen.js — đổi một bên là phải đổi bên kia. tienlen.test.js chấm lại bộ mẫu trong
-- supabase/manual/0078_games_tienlen_check.sql bằng JS; file kiểm chấm bằng SQL trên DB thật.
-- Mã lỗi RAISE / trả về là key i18n `games.err.*`.

BEGIN;

/* ---------- 1. BÀI TRÊN TAY ---------- */

-- Bài từng ghế. Tiến lên: chia một lần, không đổi — bài còn lại = bài chia − các lá đã đánh trong game_moves.
-- Game có kho bài (Domino, 0081) cất kho ở seat = -1 và tự sửa `cards` khi rút. Ghế âm KHÔNG ai đọc được.
CREATE TABLE IF NOT EXISTS public.game_hands (
  room_id   uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  seat      smallint NOT NULL,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id   uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  cards     int[] NOT NULL,
  PRIMARY KEY (room_id, seat)
);

ALTER TABLE public.game_hands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_hands FROM anon, authenticated;
GRANT SELECT ON public.game_hands TO authenticated;

-- Đang chơi: chỉ chủ bài đọc được tay của mình. Hết ván (xong / bỏ): cả CLB đọc được mọi tay để lật bài.
-- Không bật realtime cho bảng này.
DROP POLICY IF EXISTS game_hands_own ON public.game_hands;
CREATE POLICY game_hands_own ON public.game_hands FOR SELECT TO authenticated
  USING (seat >= 0 AND (
    EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR (is_club_member(club_id) AND EXISTS (SELECT 1 FROM game_rooms r WHERE r.id = room_id AND r.status IN ('finished', 'abandoned')))
  ));

/* ---------- 2. LUẬT (chép lib/games/tienlen.js) ---------- */

-- comboOf: lá c = hạng * 4 + chất, hạng = c >> 2 (0 = 3 … 12 = 2). Trả { kind, len, top } hoặc NULL.
CREATE OR REPLACE FUNCTION public.game_tienlen_combo(p_cards int[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_two CONSTANT int := 12;      -- = TWO
  cs int[];
  rs int[];
  n  int;
  i  int;
  ok boolean;
BEGIN
  cs := ARRAY(SELECT x FROM unnest(p_cards) x ORDER BY x);
  n := cardinality(cs);
  IF n = 0 OR (SELECT count(DISTINCT x) FROM unnest(cs) x) <> n THEN RETURN NULL; END IF;
  rs := ARRAY(SELECT x >> 2 FROM unnest(cs) x ORDER BY x);
  IF n = 1 THEN RETURN jsonb_build_object('kind', 'single', 'len', 1, 'top', cs[n]); END IF;
  IF n <= 4 AND rs[1] = rs[n] THEN
    RETURN jsonb_build_object('kind', (ARRAY['pair', 'triple', 'quad'])[n - 1], 'len', n, 'top', cs[n]);
  END IF;
  IF rs[n] = c_two THEN RETURN NULL; END IF;
  IF n >= 3 THEN
    ok := true;
    FOR i IN 2..n LOOP
      IF rs[i] <> rs[i - 1] + 1 THEN ok := false; EXIT; END IF;
    END LOOP;
    IF ok THEN RETURN jsonb_build_object('kind', 'straight', 'len', n, 'top', cs[n]); END IF;
  END IF;
  -- Đôi thông: lá thứ chẵn (đánh số từ 1) cùng hạng lá trước, lá thứ lẻ (từ lá 3) hơn lá trước đúng một hạng.
  IF n >= 6 AND n % 2 = 0 THEN
    ok := true;
    FOR i IN 2..n LOOP
      IF (i % 2 = 0 AND rs[i] <> rs[i - 1]) OR (i % 2 = 1 AND rs[i] <> rs[i - 1] + 1) THEN ok := false; EXIT; END IF;
    END LOOP;
    IF ok THEN RETURN jsonb_build_object('kind', 'pairs', 'len', n / 2, 'top', cs[n]); END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- beats: bộ a chặn / chặt được bộ đang trên bàn t (NULL = vòng mới).
CREATE OR REPLACE FUNCTION public.game_tienlen_beats(a jsonb, t jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_two CONSTANT int := 12;
  ak   text := a ->> 'kind';
  al   int  := (a ->> 'len')::int;
  tk   text;
  tl   int;
  tr   int;
  quad boolean;
  p3   boolean;
  p4   boolean;
BEGIN
  IF t IS NULL THEN RETURN true; END IF;
  tk := t ->> 'kind';
  tl := (t ->> 'len')::int;
  tr := ((t ->> 'top')::int) >> 2;
  IF ak = tk AND al = tl THEN RETURN (a ->> 'top')::int > (t ->> 'top')::int; END IF;
  quad := ak = 'quad';
  p3 := ak = 'pairs' AND al = 3;
  p4 := ak = 'pairs' AND al >= 4;
  IF tk = 'single' AND tr = c_two THEN RETURN quad OR p3 OR p4; END IF;
  IF tk = 'pair' AND tr = c_two THEN RETURN quad OR p4; END IF;
  IF tk = 'pairs' AND tl = 3 THEN RETURN quad OR p4; END IF;
  IF tk = 'quad' THEN RETURN p4; END IF;
  IF tk = 'pairs' AND tl >= 4 THEN RETURN ak = 'pairs' AND al > tl; END IF;
  RETURN false;
END;
$$;

-- priceOf: giá một bộ khi bị chặt — heo đen 1, heo đỏ 2 (đôi heo cộng hai lá), 3 đôi thông 3, tứ quý / 4 đôi thông 4.
CREATE OR REPLACE FUNCTION public.game_tienlen_price(p_cards int[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_two CONSTANT int := 12;
  k jsonb := game_tienlen_combo(p_cards);
BEGIN
  IF k IS NULL THEN RETURN 0; END IF;
  IF k ->> 'kind' IN ('single', 'pair') AND ((k ->> 'top')::int >> 2) = c_two THEN
    RETURN (SELECT sum(CASE WHEN (x & 3) >= 2 THEN 2 ELSE 1 END) FROM unnest(p_cards) x);
  END IF;
  IF k ->> 'kind' = 'pairs' THEN RETURN CASE WHEN (k ->> 'len')::int = 3 THEN 3 ELSE 4 END; END IF;
  IF k ->> 'kind' = 'quad' THEN RETURN 4; END IF;
  RETURN 0;
END;
$$;

-- thoiOf: giá thối của bài còn trên tay — từng heo + mỗi tứ quý (không phải heo) 4 + mỗi dải đôi thông
-- (≥ 3 hạng liền, mỗi hạng ≥ 2 lá, không có heo) 3 nếu dài 3, 4 nếu dài hơn.
CREATE OR REPLACE FUNCTION public.game_tienlen_thoi(p_hand int[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_two CONSTANT int := 12;
  cnt int[] := array_fill(0, ARRAY[13]);
  x   int;
  r   int;
  v   int := 0;
  run int := 0;
BEGIN
  FOREACH x IN ARRAY COALESCE(p_hand, '{}') LOOP
    cnt[(x >> 2) + 1] := cnt[(x >> 2) + 1] + 1;
    IF (x >> 2) = c_two THEN v := v + CASE WHEN (x & 3) >= 2 THEN 2 ELSE 1 END; END IF;
  END LOOP;
  FOR r IN 0..c_two - 1 LOOP
    IF cnt[r + 1] = 4 THEN v := v + 4; END IF;
  END LOOP;
  FOR r IN 0..c_two LOOP
    IF r < c_two AND cnt[r + 1] >= 2 THEN run := run + 1; CONTINUE; END IF;
    IF run >= 3 THEN v := v + CASE WHEN run = 3 THEN 3 ELSE 4 END; END IF;
    run := 0;
  END LOOP;
  RETURN v;
END;
$$;

-- whiteOf: tới trắng khi vừa chia — sảnh rồng (3 → A), tứ quý heo, 5 đôi thông, hoặc 6 đôi (tứ quý tính hai đôi).
CREATE OR REPLACE FUNCTION public.game_tienlen_white(p_hand int[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_two CONSTANT int := 12;
  cnt int[] := array_fill(0, ARRAY[13]);
  x   int;
  r   int;
  run int := 0;
BEGIN
  FOREACH x IN ARRAY p_hand LOOP cnt[(x >> 2) + 1] := cnt[(x >> 2) + 1] + 1; END LOOP;
  IF (SELECT bool_and(k >= 1) FROM unnest(cnt[1:c_two]) k) THEN RETURN true; END IF;
  IF cnt[c_two + 1] = 4 THEN RETURN true; END IF;
  IF (SELECT sum(k / 2) FROM unnest(cnt) k) >= 6 THEN RETURN true; END IF;
  FOR r IN 0..c_two - 1 LOOP
    run := CASE WHEN cnt[r + 1] >= 2 THEN run + 1 ELSE 0 END;
    IF run >= 5 THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- Dựng lại ván từ log (validate → apply y như replay() của JS) rồi, nếu có p_move, kiểm nước đó của ghế p_seat.
--   o_err    = mã lỗi của p_move (NULL = hợp lệ). Khác JS ở hai chỗ, cả hai đều vì server biết nhiều hơn:
--              lá không có trên tay ghế đó → notYourCard (JS chỉ chặn lá đã ra bàn); { out } / { deal } do client gửi
--              → badMove (chỉ server ghi hai loại này).
--   o_result = kết quả sau log (bỏ qua p_move): như result() của JS, CỘNG THÊM THỐI vào `scores`.
-- Mảng plpgsql đánh số từ 1: ghế s ở v_counts[s + 1].
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
  m         record;
  d         jsonb;
  i         int;
BEGIN
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
          v_k := game_tienlen_combo(v_play);
          IF v_k IS NULL THEN
            v_err := 'games.err.badCombo';
          ELSIF NOT v_mine THEN
            IF NOT (v_k ->> 'kind' = 'pairs' AND (v_k ->> 'len')::int >= 4 AND v_table IS NOT NULL AND game_tienlen_beats(v_k, v_table)) THEN
              v_err := 'games.err.notYourTurn';
            END IF;
          ELSIF v_low IS NOT NULL AND NOT (v_low = ANY(v_play)) THEN
            v_err := 'games.err.mustLow';
          ELSIF NOT game_tienlen_beats(v_k, v_table) THEN
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
      -- Hết bài: về đích. Người về Nhất thì ai chưa đánh lá nào là cóng, ra khỏi ván luôn.
      IF v_counts[m.seat + 1] <= 0 THEN
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
      v_order := v_order || v_alive || v_cong || v_left_s;
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
      v_v := game_tienlen_thoi(ARRAY(SELECT (e #>> '{}')::int FROM jsonb_array_elements(v_hands -> i::text) e
                                     WHERE NOT ((e #>> '{}')::int = ANY(v_gone))));
      IF v_v > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[i::text], to_jsonb((v_scores ->> i::text)::int - v_v));
        v_scores := jsonb_set(v_scores, ARRAY[v_order[1]::text], to_jsonb((v_scores ->> v_order[1]::text)::int + v_v));
      END IF;
    END LOOP;
  END IF;
  o_result := jsonb_build_object('winners', jsonb_build_array(v_order[1]), 'draw', false, 'ranks', to_jsonb(v_order), 'scores', v_scores);
END;
$$;

-- game_move (bên dưới) tự tìm hàm này: trả mã lỗi là từ chối nước đi.
CREATE OR REPLACE FUNCTION public.game_tienlen_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_tienlen_run(p_room, p_seat, p_move) $$;

-- game_finish (0075) tự tìm hàm này.
CREATE OR REPLACE FUNCTION public.game_tienlen_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_tienlen_run(p_room, NULL, NULL) $$;

-- game_start (bên dưới) tự tìm hàm này. Xào 52 lá, chia mỗi ghế 13 lá (2–3 người thì thừa lá, bỏ úp), rồi ghi
-- nước 1 = { deal: { first, low, n, white } } — cả phòng đọc được:
--   ván "chơi lại" (phòng trước có next_room trỏ về đây) mà người về Nhất ván trước còn ngồi → người đó đi trước,
--   không bắt buộc lá nào (low = null); không thì ai cầm lá nhỏ nhất đã chia đi trước, nước đầu phải có lá đó;
--   white = ghế đầu tiên (theo số ghế) tới trắng, null nếu không ai.
-- random() của server: không ai thấy bộ bài trước khi chia (seed của phòng KHÔNG dùng ở đây vì ai cũng đọc được).
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
  SELECT seat INTO v_white FROM game_hands WHERE room_id = p_room AND seat >= 0 AND game_tienlen_white(cards) ORDER BY seat LIMIT 1;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_first,
          jsonb_build_object('deal', jsonb_build_object('first', v_first, 'low', v_low, 'n', to_jsonb(array_fill(c_hand, ARRAY[k])), 'white', v_white)));
END;
$$;

/* ---------- 3. RPC CHUNG: thêm móc theo game ---------- */

-- Như 0074, thêm: gọi game_<id>_deal nếu có.
CREATE OR REPLACE FUNCTION public.game_start(p_room uuid, p_min int, p_max int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_n int;
  v_fn text;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).host_id <> c.o_me THEN RAISE EXCEPTION 'games.err.notHost'; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  SELECT count(*) INTO v_n FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  IF v_n < GREATEST(p_min, 2) OR v_n > p_max THEN RAISE EXCEPTION 'games.err.badCount'; END IF;

  -- Hai bước để không đụng unique (room_id, seat) giữa chừng.
  UPDATE game_room_players SET seat = seat + 100 WHERE room_id = p_room AND left_at IS NULL;
  UPDATE game_room_players p SET seat = r.n
    FROM (SELECT member_id, (row_number() OVER (ORDER BY seat) - 1)::smallint AS n
            FROM game_room_players WHERE room_id = p_room AND left_at IS NULL) r
   WHERE p.room_id = p_room AND p.member_id = r.member_id;

  UPDATE game_rooms SET status = 'playing', started_at = now(), seed = gen_random_uuid()::text WHERE id = p_room;

  -- 0078: game có bài úp thì chia bài ở đây, sau khi ghế đã đánh số lại.
  v_fn := 'game_' || (c.o_room).game || '_deal';
  IF to_regprocedure('public.' || v_fn || '(uuid)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1)', v_fn) USING p_room;
  END IF;
END;
$$;

-- Như 0074, thêm: khoá phòng (nước đi xếp hàng sau game_leave / game_claim — hai bên cùng ghi game_moves),
-- gọi game_<id>_check rồi game_<id>_fill nếu có.
CREATE OR REPLACE FUNCTION public.game_move(p_room uuid, p_seq int, p_move jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c      record;
  v_seat smallint;
  v_last int;
  v_fn   text;
  v_err  text;
  v_move jsonb := p_move;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RAISE EXCEPTION 'games.err.notPlaying'; END IF;
  SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL;
  IF v_seat IS NULL THEN RAISE EXCEPTION 'games.err.notSeated'; END IF;
  SELECT COALESCE(max(seq), 0) INTO v_last FROM game_moves WHERE room_id = p_room;
  IF p_seq <> v_last + 1 THEN RAISE EXCEPTION 'games.err.stale'; END IF;

  v_fn := 'game_' || (c.o_room).game || '_check';
  IF to_regprocedure('public.' || v_fn || '(uuid, integer, jsonb)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1, $2, $3)', v_fn) INTO v_err USING p_room, v_seat::int, p_move;
    IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;
  END IF;
  -- Server điền / che nước (xúc xắc, kết quả phát bắn, lá vừa rút…). Hàm tự RAISE nếu nước sai.
  v_fn := 'game_' || (c.o_room).game || '_fill';
  IF to_regprocedure('public.' || v_fn || '(uuid, integer, jsonb)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1, $2, $3)', v_fn) INTO v_move USING p_room, v_seat::int, p_move;
  END IF;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (p_room, p_seq, (c.o_room).club_id, v_seat, v_move);
  UPDATE game_room_players SET seen_at = now() WHERE room_id = p_room AND member_id = c.o_me;
END;
$$;

-- Như 0074, thêm: đang chơi mà còn ≥ 2 người thì ghi { out: true } cho người vừa rời.
CREATE OR REPLACE FUNCTION public.game_leave(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_left int;
  v_next uuid;
  v_seat smallint;
  v_mine smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status IN ('finished', 'abandoned') THEN RETURN; END IF;
  UPDATE game_room_players SET left_at = now() WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL
  RETURNING seat INTO v_mine;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_left FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;

  IF (c.o_room).status = 'waiting' THEN
    IF v_left = 0 THEN
      UPDATE game_rooms SET status = 'abandoned', ended_at = now() WHERE id = p_room;
    ELSIF (c.o_room).host_id = c.o_me THEN
      SELECT member_id INTO v_next FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LIMIT 1;
      UPDATE game_rooms SET host_id = v_next WHERE id = p_room;
    END IF;
    RETURN;
  END IF;

  -- status = 'playing'
  IF v_left = 0 THEN
    UPDATE game_rooms SET status = 'abandoned', ended_at = now() WHERE id = p_room;
  ELSIF v_left = 1 THEN
    SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
    UPDATE game_rooms SET status = 'finished', ended_at = now(),
      result = jsonb_build_object('winners', jsonb_build_array(v_seat), 'draw', false, 'forfeit', true)
     WHERE id = p_room;
  ELSE
    -- 0078: ván 3–4 người chơi tiếp, luật bỏ qua lượt của người đã rời.
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT p_room, COALESCE(max(seq), 0) + 1, (c.o_room).club_id, v_mine, '{"out": true}'::jsonb
      FROM game_moves WHERE room_id = p_room;
  END IF;
END;
$$;

-- Như 0074, thêm: còn ≥ 2 người thì ghi { out: true } cho từng người bị xử rời. Hạn 120 giây giữ nguyên
-- (contract.test.js gác khớp app.json → games.reconnectGraceSec ở cả 0074 lẫn file này).
CREATE OR REPLACE FUNCTION public.game_claim(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_gone smallint[];
  v_left int;
  v_seat smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;

  WITH g AS (
    UPDATE game_room_players SET left_at = now()
     WHERE room_id = p_room AND left_at IS NULL AND member_id <> c.o_me
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

/* ---------- 4. QUYỀN ---------- */

REVOKE ALL ON FUNCTION public.game_tienlen_combo(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_beats(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_price(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_thoi(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_white(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_tienlen_deal(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.game_start(uuid, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_move(uuid, int, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_start(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_move(uuid, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_claim(uuid) TO authenticated;

COMMIT;

-- 0082_games_baibip.sql — Bài bịp: chia bài từng ván, lá úp, tố "Bịp!", bom cắt dây (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần bảng game_hands + game_start / game_move bản 0078 gọi game_<id>_deal / game_<id>_fill).
-- CHỈ THÊM HÀM. Chạy lại được.
--
-- game_hands của phòng Bài bịp:
--   ghế ≥ 0 — bài trên tay ván đang chơi (server bớt lá khi đánh, chia lại mỗi ván);
--   ghế -1  — dây nổ của từng ghế (0..5, phần tử k+1 là của ghế k), chọn một lần cho cả trận;
--   ghế -2  — các lá của nước đánh gần nhất, giấu tới khi bị tố. Ghế âm không ai đọc được (RLS 0078).
-- Lá c: 0..5 Q · 6..11 K · 12..17 A · 18, 19 Joker. Lá chủ: 0 = Q, 1 = K, 2 = A.
--
-- game_baibip_round  — xào 20 lá, chia 5 lá cho mỗi người còn trụ, chọn lá chủ; trả { table, n, first }.
-- game_baibip_deal   — (game_start gọi) tạo hàng game_hands, giấu dây nổ, chia ván đầu, ghi nước 1 { deal }.
-- game_baibip_run    — dựng lại trận từ log; có p_move thì kiểm nước đó (o_err) và trả thế hiện tại cho _fill.
-- game_baibip_fill   — (game_move gọi) từ chối nước sai; đánh → bớt lá, cất lá úp, log { play: k };
--                      tố → lật lá úp, log { call, cards, liar }; cắt → tra dây nổ, log { cut, boom };
--                      ván mới (sau khi cắt, hoặc người thua đã rời bàn, hoặc bấm chia lại) → gắn { deal } vào nước đó.
-- game_baibip_result — người cuối cùng còn trụ; game_finish 0075 dùng hàm này, bỏ kết quả client.
-- Đồng hồ lượt: options.time giây (0 = không giới hạn), tính từ created_at của nước gần nhất. Máy bất kỳ báo
-- { timeout } → _run chỉ nhận khi now() đã qua hạn (sớm → games.err.notYet, máy khách im lặng thử lại); _fill đi thay
-- người tới lượt (1 lá ngẫu nhiên / tố khi bắt buộc / 1 dây ngẫu nhiên / chia ván) và log thêm "timeout": true.
-- Chép luật lib/games/baibip.js — đổi luật thì sửa cả hai.

/* ---------- Chia một ván ---------- */
CREATE OR REPLACE FUNCTION public.game_baibip_round(p_room uuid, p_out boolean[], p_first int)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_hand CONSTANT int := 5;
  v_deck int[] := ARRAY(SELECT c FROM generate_series(0, 19) c ORDER BY random());
  v_cnt  int[] := '{}';
  k      int := 0;
  s      int;
BEGIN
  FOR s IN 0 .. cardinality(p_out) - 1 LOOP
    IF p_out[s + 1] THEN
      UPDATE game_hands SET cards = '{}' WHERE room_id = p_room AND seat = s;
      v_cnt := v_cnt || 0;
    ELSE
      UPDATE game_hands SET cards = ARRAY(SELECT x FROM unnest(v_deck[k * c_hand + 1 : k * c_hand + c_hand]) x ORDER BY x)
       WHERE room_id = p_room AND seat = s;
      v_cnt := v_cnt || c_hand;
      k := k + 1;
    END IF;
  END LOOP;
  UPDATE game_hands SET cards = '{}' WHERE room_id = p_room AND seat = -2;
  RETURN jsonb_build_object('table', floor(random() * 3)::int, 'n', to_jsonb(v_cnt), 'first', p_first);
END;
$$;

/* ---------- Bắt đầu trận (game_start 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_baibip_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club uuid;
  v_mem  uuid;
  v_n    int := 0;
  v_out  boolean[] := '{}';
  v_deal jsonb;
  r      record;
BEGIN
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, r.seat, r.member_id, r.club_id, '{}')
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_club := r.club_id;
    v_mem := r.member_id;
    v_n := v_n + 1;
    v_out := v_out || false;
  END LOOP;
  -- Ghế âm: member_id bắt buộc nên ghi tạm người ngồi cuối — RLS không cho ai đọc ghế âm.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
  VALUES (p_room, -1, v_mem, v_club, ARRAY(SELECT floor(random() * 6)::int FROM generate_series(1, v_n))),
         (p_room, -2, v_mem, v_club, '{}')
  ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;

  v_deal := game_baibip_round(p_room, v_out, floor(random() * v_n)::int);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, (v_deal ->> 'first')::int, jsonb_build_object('deal', v_deal));
END;
$$;

/* ---------- Dựng lại trận ---------- */
-- p_move NULL: chỉ dựng lại (o_winner khi xong). p_move có: kiểm nước đó của p_seat trên thế hiện tại → o_err.
-- o_table = lá chủ ván này · o_last = ghế đánh gần nhất trong ván · o_out = đã loại · o_turn · o_phase.
-- Đổi danh sách OUT so với bản đầu → phải xoá bản cũ (chỉ là hàm, không đụng dữ liệu).
DROP FUNCTION IF EXISTS public.game_baibip_run(uuid, int, jsonb);
CREATE OR REPLACE FUNCTION public.game_baibip_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_table int, OUT o_last int, OUT o_out boolean[], OUT o_turn int, OUT o_phase text, OUT o_winner int,
  OUT o_counts int[], OUT o_cuts int[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n      int;
  v_counts int[];
  v_cuts   int[];          -- bit w = dây w đã cắt
  v_cutter int;
  v_over   boolean := false;
  v_liar   boolean;
  v_loser  int;
  v_k      int;
  v_opt    jsonb;
  v_time   bigint;
  v_since  bigint;
  d        jsonb;
  m        record;
  mv       jsonb;
  s        int;
  y        int;
  i        int;
BEGIN
  -- Đọc options như optsOf ở JS. CASE lồng nhau: chỉ ép kiểu số khi đúng là số.
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (0, 20, 30, 60) THEN (v_opt ->> 'time')::numeric::int ELSE 30 END
                        ELSE 30 END;
  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    mv := m.move;
    s := m.seat;

    /* Nước đang xin ghi (máy khách gửi) — như validate ở JS. */
    IF m.cand THEN
      o_counts := v_counts;
      o_cuts := v_cuts;
      IF v_n IS NULL THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF v_over THEN o_err := 'games.err.over'; RETURN; END IF;
      IF jsonb_typeof(mv) IS DISTINCT FROM 'object' OR s IS NULL OR s < 0 OR s >= v_n OR o_out[s + 1] OR mv ? 'out' THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      -- Báo hết giờ: ai còn trụ cũng báo được, server đo bằng giờ của nó.
      IF mv -> 'timeout' = 'true'::jsonb THEN
        IF v_time = 0 OR o_turn IS NULL THEN o_err := 'games.err.badMove';
        ELSIF m.at < v_since + v_time THEN o_err := 'games.err.notYet';
        END IF;
        RETURN;
      END IF;
      IF s <> o_turn THEN o_err := 'games.err.notYourTurn'; RETURN; END IF;
      IF o_phase = 'redeal' THEN
        IF mv -> 'deal' IS DISTINCT FROM 'true'::jsonb THEN o_err := 'games.err.badMove'; END IF;
        RETURN;
      END IF;
      IF mv ? 'deal' THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF o_phase = 'cut' THEN
        IF NOT mv ? 'cut' THEN o_err := 'games.err.mustCut'; RETURN; END IF;
        IF jsonb_typeof(mv -> 'cut') IS DISTINCT FROM 'number' OR (mv ->> 'cut') !~ '^[0-5]$' THEN
          o_err := 'games.err.wireCut'; RETURN;
        END IF;
        IF (v_cuts[s + 1] >> (mv ->> 'cut')::int) & 1 = 1 THEN o_err := 'games.err.wireCut'; END IF;
        RETURN;
      END IF;
      IF mv ? 'cut' THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF mv -> 'call' = 'true'::jsonb THEN
        IF o_last IS NULL OR o_last = s THEN o_err := 'games.err.nothingToCall'; END IF;
        RETURN;
      END IF;
      -- Đánh: máy khách gửi đúng các lá (mảng) — _fill kiểm lá có trên tay.
      IF jsonb_typeof(mv -> 'play') IS DISTINCT FROM 'array' THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(mv -> 'play') e
                  WHERE CASE WHEN jsonb_typeof(e) = 'number' AND e::text ~ '^[0-9]{1,2}$' THEN e::text::int > 19 ELSE true END)
         OR (SELECT count(DISTINCT e::text) FROM jsonb_array_elements(mv -> 'play') e) <> jsonb_array_length(mv -> 'play') THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      v_k := jsonb_array_length(mv -> 'play');
      IF v_k < 1 OR v_k > 3 THEN o_err := 'games.err.playCount'; RETURN; END IF;
      IF v_k > v_counts[s + 1] THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF NOT EXISTS (SELECT 1 FROM generate_series(0, v_n - 1) g WHERE g <> s AND NOT o_out[g + 1] AND v_counts[g + 1] > 0) THEN
        o_err := 'games.err.mustCall';
      END IF;
      RETURN;
    END IF;

    /* Nước trong log — đã kiểm lúc ghi, chỉ áp (như apply ở JS). Nước hết giờ áp như của người tới lượt. */
    v_since := m.at;
    IF mv -> 'timeout' = 'true'::jsonb THEN
      IF o_turn IS NULL THEN CONTINUE; END IF;
      s := o_turn;
    END IF;
    d := NULL;
    IF v_n IS NULL THEN
      IF jsonb_typeof(mv -> 'deal') IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
      v_n := jsonb_array_length(mv #> '{deal,n}');
      o_out := array_fill(false, ARRAY[v_n]);
      v_cuts := array_fill(0, ARRAY[v_n]);
      d := mv -> 'deal';
    ELSIF v_over OR s < 0 OR s >= v_n OR o_out[s + 1] THEN
      CONTINUE;
    ELSIF mv -> 'out' = 'true'::jsonb THEN
      o_out[s + 1] := true;
      v_counts[s + 1] := 0;
      IF (SELECT count(*) FROM unnest(o_out) o WHERE NOT o) <= 1 THEN v_over := true; CONTINUE; END IF;
      -- Đang chờ người khác cắt dây thì họ vẫn phải cắt; còn lại thì ván dở huỷ, chia lại.
      IF o_phase = 'cut' AND v_cutter IS DISTINCT FROM s THEN CONTINUE; END IF;
      IF o_turn IS NULL OR o_turn = s THEN
        FOR i IN 1..v_n LOOP y := (s + i) % v_n; IF NOT o_out[y + 1] THEN o_turn := y; EXIT; END IF; END LOOP;
      END IF;
      o_phase := 'redeal';
      o_last := NULL;
      v_cutter := NULL;
      CONTINUE;
    ELSIF jsonb_typeof(mv -> 'play') = 'number' THEN
      v_k := (mv ->> 'play')::int;
      v_counts[s + 1] := v_counts[s + 1] - v_k;
      o_last := s;
      o_turn := NULL;
      FOR i IN 1..v_n - 1 LOOP
        y := (s + i) % v_n;
        IF NOT o_out[y + 1] AND v_counts[y + 1] > 0 THEN o_turn := y; EXIT; END IF;
      END LOOP;
      IF o_turn IS NULL THEN
        FOR i IN 1..v_n LOOP y := (s + i) % v_n; IF NOT o_out[y + 1] THEN o_turn := y; EXIT; END IF; END LOOP;
      END IF;
      CONTINUE;
    ELSIF mv -> 'call' = 'true'::jsonb THEN
      v_liar := EXISTS (SELECT 1 FROM jsonb_array_elements_text(mv -> 'cards') e WHERE (e)::int < 18 AND (e)::int / 6 <> o_table);
      v_loser := CASE WHEN v_liar THEN o_last ELSE s END;
      IF jsonb_typeof(mv -> 'deal') = 'object' THEN
        d := mv -> 'deal';
      ELSIF o_out[v_loser + 1] THEN
        o_phase := 'redeal';
        o_last := NULL;
        FOR i IN 1..v_n LOOP y := (v_loser + i) % v_n; IF NOT o_out[y + 1] THEN o_turn := y; EXIT; END IF; END LOOP;
        CONTINUE;
      ELSE
        o_phase := 'cut';
        v_cutter := v_loser;
        o_turn := v_loser;
        CONTINUE;
      END IF;
    ELSIF mv ? 'cut' THEN
      v_cuts[s + 1] := v_cuts[s + 1] | (1 << (mv ->> 'cut')::int);
      IF mv -> 'boom' = 'true'::jsonb THEN o_out[s + 1] := true; END IF;
      v_cutter := NULL;
      v_counts := array_fill(0, ARRAY[v_n]);
      IF (SELECT count(*) FROM unnest(o_out) o WHERE NOT o) <= 1 THEN v_over := true; CONTINUE; END IF;
      IF jsonb_typeof(mv -> 'deal') = 'object' THEN
        d := mv -> 'deal';
      ELSE
        o_phase := 'redeal';
        o_last := NULL;
        o_turn := s;
        IF mv -> 'boom' = 'true'::jsonb THEN
          FOR i IN 1..v_n LOOP y := (s + i) % v_n; IF NOT o_out[y + 1] THEN o_turn := y; EXIT; END IF; END LOOP;
        END IF;
        CONTINUE;
      END IF;
    ELSIF jsonb_typeof(mv -> 'deal') = 'object' THEN
      d := mv -> 'deal'; -- chia lại sau khi ván bị huỷ
    ELSE
      CONTINUE;
    END IF;

    -- Ván mới.
    o_table := (d ->> 'table')::int;
    v_counts := ARRAY(SELECT (e)::int FROM jsonb_array_elements_text(d -> 'n') e);
    o_turn := (d ->> 'first')::int;
    o_phase := 'play';
    o_last := NULL;
    v_cutter := NULL;
  END LOOP;

  IF v_over THEN
    o_winner := (SELECT g - 1 FROM generate_subscripts(o_out, 1) g WHERE NOT o_out[g] ORDER BY g LIMIT 1);
    o_turn := NULL;
    o_phase := NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_baibip_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o_winner IS NOT NULL THEN jsonb_build_object('winners', jsonb_build_array(o_winner), 'draw', false) END
    FROM public.game_baibip_run(p_room, NULL, NULL)
$$;

/* ---------- Kiểm + điền nước (game_move 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_baibip_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_out   boolean[];
  v_auto  jsonb;
  v_cnt   int[];
  v_mask  int;
  v_n     int;
  v_hand  int[];
  v_play  int[];
  v_cards int[];
  v_liar  boolean;
  v_loser int;
  v_boom  boolean;
  v_first int;
  v_w     int;
  i       int;
  y       int;
BEGIN
  SELECT * INTO r FROM game_baibip_run(p_room, p_seat, p_move);
  IF r.o_err IS NOT NULL THEN RAISE EXCEPTION '%', r.o_err; END IF;
  v_out := r.o_out;
  v_n := cardinality(v_out);

  -- Hết giờ: server đi thay người tới lượt, log thêm "timeout": true.
  IF p_move -> 'timeout' = 'true'::jsonb THEN
    y := r.o_turn;
    v_cnt := r.o_counts;
    v_mask := r.o_cuts[y + 1];
    IF r.o_phase = 'redeal' THEN
      v_auto := '{"deal": true}'::jsonb;
    ELSIF r.o_phase = 'cut' THEN
      v_auto := jsonb_build_object('cut', (SELECT w FROM generate_series(0, 5) w WHERE (v_mask >> w) & 1 = 0 ORDER BY random() LIMIT 1));
    ELSE
      SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = y;
      IF COALESCE(cardinality(v_hand), 0) = 0
         OR NOT EXISTS (SELECT 1 FROM generate_series(0, v_n - 1) g WHERE g <> y AND NOT v_out[g + 1] AND v_cnt[g + 1] > 0) THEN
        v_auto := '{"call": true}'::jsonb;
      ELSE
        v_auto := jsonb_build_object('play', jsonb_build_array(v_hand[1 + floor(random() * cardinality(v_hand))::int]));
      END IF;
    END IF;
    RETURN game_baibip_fill(p_room, y, v_auto) || '{"timeout": true}'::jsonb;
  END IF;

  -- Chia lại ván bị huỷ (có người rời bàn giữa ván): người bấm đi trước.
  IF p_move -> 'deal' = 'true'::jsonb THEN
    RETURN jsonb_build_object('deal', game_baibip_round(p_room, v_out, p_seat));
  END IF;

  -- Đánh: lá phải có trên tay. Bớt khỏi tay, cất vào ghế -2; log chỉ ghi số lá.
  IF jsonb_typeof(p_move -> 'play') = 'array' THEN
    v_play := ARRAY(SELECT (e)::int FROM jsonb_array_elements_text(p_move -> 'play') e);
    SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = p_seat;
    IF EXISTS (SELECT 1 FROM unnest(v_play) c WHERE NOT (c = ANY(COALESCE(v_hand, '{}')))) THEN
      RAISE EXCEPTION 'games.err.notYourCard';
    END IF;
    UPDATE game_hands SET cards = ARRAY(SELECT c FROM unnest(v_hand) c WHERE NOT (c = ANY(v_play)) ORDER BY c)
     WHERE room_id = p_room AND seat = p_seat;
    UPDATE game_hands SET cards = v_play WHERE room_id = p_room AND seat = -2;
    RETURN jsonb_build_object('play', cardinality(v_play));
  END IF;

  -- Tố: lật các lá vừa úp. Người thua đã rời bàn thì khỏi cắt — chia ván mới luôn, người kế sau họ đi trước.
  IF p_move -> 'call' = 'true'::jsonb THEN
    SELECT cards INTO v_cards FROM game_hands WHERE room_id = p_room AND seat = -2;
    v_liar := EXISTS (SELECT 1 FROM unnest(v_cards) c WHERE c < 18 AND c / 6 <> r.o_table);
    v_loser := CASE WHEN v_liar THEN r.o_last ELSE p_seat END;
    IF v_out[v_loser + 1] THEN
      FOR i IN 1..v_n LOOP y := (v_loser + i) % v_n; IF NOT v_out[y + 1] THEN v_first := y; EXIT; END IF; END LOOP;
      RETURN jsonb_build_object('call', true, 'cards', to_jsonb(v_cards), 'liar', v_liar,
                                'deal', game_baibip_round(p_room, v_out, v_first));
    END IF;
    RETURN jsonb_build_object('call', true, 'cards', to_jsonb(v_cards), 'liar', v_liar);
  END IF;

  -- Cắt dây: trúng dây nổ là bị loại. Còn ≥ 2 người thì chia ván mới: người vừa cắt đi trước, nổ rồi thì người kế.
  v_w := (p_move ->> 'cut')::int;
  SELECT cards[p_seat + 1] INTO y FROM game_hands WHERE room_id = p_room AND seat = -1;
  v_boom := v_w = y;
  IF v_boom THEN v_out[p_seat + 1] := true; END IF;
  IF (SELECT count(*) FROM unnest(v_out) o WHERE NOT o) <= 1 THEN
    RETURN jsonb_build_object('cut', v_w, 'boom', v_boom);
  END IF;
  v_first := p_seat;
  IF v_boom THEN
    FOR i IN 1..v_n LOOP y := (p_seat + i) % v_n; IF NOT v_out[y + 1] THEN v_first := y; EXIT; END IF; END LOOP;
  END IF;
  RETURN jsonb_build_object('cut', v_w, 'boom', v_boom, 'deal', game_baibip_round(p_room, v_out, v_first));
END;
$$;

REVOKE ALL ON FUNCTION public.game_baibip_round(uuid, boolean[], int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baibip_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baibip_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baibip_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baibip_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

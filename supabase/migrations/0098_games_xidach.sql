-- 0098_games_xidach.sql — Xì dách (docs/GAMES.md §5.2, §12). Chạy sau 0078. Chỉ thêm hàm, không đụng bảng / data.
--
-- Bài ván đang chơi ở game_hands ghế ≥ 0 (RLS: chỉ chủ bài đọc), nọc ở ghế -1 (không ai đọc). Mỗi ván chia lại, ghi đè.
-- game_xidach_deal   — game_start gọi: chia ván đầu (cái = ghế 0), ghi nước 1 { deal }.
-- game_xidach_round  — chia một ván: xáo 52 lá, mỗi người còn ngồi 2 lá; `xi` = bài các tay có xì (công khai);
--                      cái có xì thì `show` = bài cả bàn (lật luôn).
-- game_xidach_run    — dựng lại phần công khai (như replay() của lib/games/xidach.js), kiểm nước đang xin ghi → o_err,
--                      hết trận → o_result (điểm cộng dồn từ các lần lật bài trong log).
-- game_xidach_check  — game_move gọi: dằn phải đủ tuổi (con 16, cái 15 — server biết bài), hết giờ phải đúng là hết
--                      (sớm → games.err.notYet, máy khách im lặng thử lại); { out } / { deal: {…} } chỉ server ghi.
-- game_xidach_fill   — game_move gọi: rút → chuyển lá đầu nọc vào tay, log chỉ { draw: true }; cái dằn / rút đủ 5 lá →
--                      kèm `show` (lật bài cả bàn); hết giờ → đi thay người tới lượt (đủ tuổi thì dằn, chưa thì rút);
--                      { deal: true } → chia ván mới, cái chuyển sang người còn ngồi kế tiếp.
-- game_xidach_result — game_finish (0075) dùng hàm này, bỏ kết quả client.
-- options.time = giây mỗi lượt (0 / 20 / 30 / 45, sai dạng → 30; 0 = tắt), options.laps = số lượt làm cái mỗi người
-- (1 / 2 / 3, sai dạng → 1). Chép luật lib/games/xidach.js — đổi luật thì sửa cả hai.
-- Lá c = hạng * 4 + chất như Tiến lên: hạng 0..12 = 3 … 10 (7), J Q K (8..10), A (11), 2 (12).

BEGIN;

/* ---------- Luật bài ---------- */

-- pointsOf: điểm tốt nhất ≤ 21; A = 1 / 10 / 11 khi 2 lá, 1 / 10 khi từ 3 lá; không cách nào ≤ 21 thì điểm nhỏ nhất.
CREATE OR REPLACE FUNCTION public.game_xidach_points(p int[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n     int := cardinality(p);
  aces  int;
  base  int;
  best  int;
  mn    int;
  v     int;
  i     int;
  j     int;
BEGIN
  SELECT count(*) FILTER (WHERE x >> 2 = 11),
         COALESCE(sum(CASE WHEN x >> 2 <= 7 THEN (x >> 2) + 3 WHEN x >> 2 <= 10 THEN 10 WHEN x >> 2 = 12 THEN 2 ELSE 0 END), 0)
    INTO aces, base FROM unnest(p) x;
  FOR i IN 0..aces LOOP          -- i lá A tính 10
    FOR j IN 0..aces - i LOOP    -- j lá A tính 11 (chỉ khi 2 lá)
      IF j > 0 AND n > 2 THEN CONTINUE; END IF;
      v := base + (aces - i - j) + 10 * i + 11 * j;
      IF v <= 21 AND (best IS NULL OR v > best) THEN best := v; END IF;
      mn := LEAST(COALESCE(mn, v), v);
    END LOOP;
  END LOOP;
  RETURN COALESCE(best, mn);
END;
$$;

-- kindOf: 'xiban' · 'xidach' · 'ngulinh' · 'quac' · 'du'.
CREATE OR REPLACE FUNCTION public.game_xidach_kind(p int[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  aces int;
BEGIN
  IF cardinality(p) = 2 THEN
    SELECT count(*) INTO aces FROM unnest(p) x WHERE x >> 2 = 11;
    IF aces = 2 THEN RETURN 'xiban'; END IF;
    IF aces = 1 AND EXISTS (SELECT 1 FROM unnest(p) x WHERE x >> 2 BETWEEN 7 AND 10) THEN RETURN 'xidach'; END IF;
  END IF;
  IF game_xidach_points(p) > 21 THEN RETURN 'quac'; END IF;
  RETURN CASE WHEN cardinality(p) >= 5 THEN 'ngulinh' ELSE 'du' END;
END;
$$;

-- payOf: điểm con được (+) / mất (−) khi so với cái; thắng bằng xì bàn / xì dách / ngũ linh ăn 2.
CREATE OR REPLACE FUNCTION public.game_xidach_pay(p_player int[], p_banker int[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  kp text := game_xidach_kind(p_player);
  kb text := game_xidach_kind(p_banker);
  pp int := game_xidach_points(p_player);
  pb int := game_xidach_points(p_banker);
  lp int;
  lb int;
  v  int;
BEGIN
  lp := array_position(ARRAY['quac', 'du', 'ngulinh', 'xidach', 'xiban'], kp);
  lb := array_position(ARRAY['quac', 'du', 'ngulinh', 'xidach', 'xiban'], kb);
  IF kp = 'quac' OR kb = 'quac' THEN v := CASE WHEN kp = kb THEN 0 WHEN kp = 'quac' THEN -1 ELSE 1 END;
  ELSIF lp <> lb THEN v := CASE WHEN lp > lb THEN 1 ELSE -1 END;
  ELSIF kp = 'ngulinh' THEN v := sign(pb - pp);
  ELSIF kp = 'du' THEN v := sign(pp - pb);
  ELSE v := 0;
  END IF;
  RETURN v * CASE WHEN (CASE WHEN v > 0 THEN kp ELSE kb END) IN ('ngulinh', 'xidach', 'xiban') THEN 2 ELSE 1 END;
END;
$$;

/* ---------- Chia bài ---------- */

-- Bài cả bàn của ván đang chơi (tay có ≥ 2 lá), dạng { "ghế": [lá] }.
CREATE OR REPLACE FUNCTION public.game_xidach_show(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(seat::text, to_jsonb(cards)), '{}') FROM game_hands
   WHERE room_id = p_room AND seat >= 0 AND cardinality(cards) >= 2
$$;

CREATE OR REPLACE FUNCTION public.game_xidach_round(p_room uuid, p_round int, p_banker int, p_out boolean[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deck int[] := ARRAY(SELECT c FROM generate_series(0, 51) c ORDER BY random());
  v_xi   jsonb := '{}';
  v_hand int[];
  v_o    jsonb;
  r      record;
  y      int;
BEGIN
  -- Ván đầu: tạo hàng bài cho người đang ngồi (ghế đã đánh số lại 0..n-1). Ván sau: chỉ ghi đè lá của các hàng đó.
  IF p_round = 0 THEN
    FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
      INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, r.seat, r.member_id, r.club_id, '{}')
      ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    END LOOP;
    -- Ghế âm: member_id bắt buộc nên ghi tạm người ngồi ghế 0 — RLS không cho ai đọc ghế âm.
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    SELECT p_room, -1, member_id, club_id, '{}' FROM game_hands WHERE room_id = p_room AND seat = 0
    ON CONFLICT (room_id, seat) DO NOTHING;
  END IF;
  FOR y IN 0..cardinality(p_out) - 1 LOOP
    IF p_out[y + 1] THEN
      v_hand := '{}';
    ELSE
      v_hand := v_deck[1:2];
      v_deck := v_deck[3:];
      IF game_xidach_kind(v_hand) IN ('xiban', 'xidach') THEN v_xi := v_xi || jsonb_build_object(y::text, to_jsonb(v_hand)); END IF;
    END IF;
    UPDATE game_hands SET cards = v_hand WHERE room_id = p_room AND seat = y;
  END LOOP;
  UPDATE game_hands SET cards = v_deck WHERE room_id = p_room AND seat = -1;

  v_o := jsonb_build_object('n', cardinality(p_out), 'round', p_round, 'banker', p_banker, 'xi', v_xi);
  IF v_xi ? p_banker::text THEN v_o := v_o || jsonb_build_object('show', game_xidach_show(p_room)); END IF;
  RETURN v_o;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_xidach_deal(p_room uuid)
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
  VALUES (p_room, 1, v_club, 0, jsonb_build_object('deal', game_xidach_round(p_room, 0, 0, array_fill(false, ARRAY[v_n]))));
END;
$$;

/* ---------- Dựng lại trận ---------- */
-- o_turn / o_banker / o_round / o_out / o_phase / o_count = thế hiện tại (fill dùng). Mảng plpgsql: ghế s ở [s + 1].
CREATE OR REPLACE FUNCTION public.game_xidach_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_result jsonb, OUT o_turn int, OUT o_banker int, OUT o_round int, OUT o_out boolean[],
  OUT o_phase text, OUT o_count int[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt    jsonb;
  v_time   bigint;
  v_laps   int;
  v_n      int := 0;
  v_rounds int;
  v_over   boolean := false;
  v_stood  boolean[];
  v_order  int[];
  v_scores int[];
  v_since  bigint;
  v_err    text;
  v_who    int;
  v_show   jsonb;
  v_bh     int[];
  v_v      int;
  m        record;
  d        jsonb;
  e        record;
  k        int;
  y        int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (0, 20, 30, 45) THEN (v_opt ->> 'time')::numeric::int ELSE 30 END
                        ELSE 30 END;
  v_laps := CASE WHEN jsonb_typeof(v_opt -> 'laps') = 'number'
                 THEN CASE WHEN (v_opt ->> 'laps')::numeric IN (1, 2, 3) THEN (v_opt ->> 'laps')::numeric::int ELSE 1 END
                 ELSE 1 END;
  o_round := -1;

  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    d := m.move -> 'deal';

    /* ----- validate ----- */
    IF jsonb_typeof(d) = 'object' THEN
      -- Chỉ server ghi (game_xidach_deal / fill): tin hình dạng, chỉ kiểm đúng lúc.
      IF m.cand OR (o_phase IS NOT NULL AND o_phase <> 'done') OR v_over OR (d ->> 'round')::int <> o_round + 1 THEN
        v_err := 'games.err.badMove';
      END IF;
    ELSIF o_phase IS NULL THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR o_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF d = 'true'::jsonb THEN
      IF o_phase <> 'done' THEN v_err := 'games.err.badMove'; END IF;
    ELSIF o_phase <> 'play' OR o_turn IS NULL THEN
      v_err := 'games.err.notYourTurn';
    ELSIF m.cand AND m.move -> 'timeout' = 'true'::jsonb THEN
      IF v_time = 0 THEN v_err := 'games.err.badMove';
      ELSIF m.at < v_since + v_time THEN v_err := 'games.err.notYet';
      END IF;
    ELSE
      v_who := CASE WHEN m.move -> 'timeout' = 'true'::jsonb THEN o_turn ELSE m.seat END;
      IF v_who <> o_turn THEN
        v_err := 'games.err.notYourTurn';
      ELSIF m.move -> 'draw' = 'true'::jsonb THEN
        IF o_count[v_who + 1] >= 5 THEN v_err := 'games.err.badMove'; END IF;
      ELSIF m.move -> 'stand' = 'true'::jsonb THEN
        -- Dằn: chỉ nước đang xin ghi mới kiểm đủ tuổi (bài ván cũ đã bị ghi đè, nước trong log đã kiểm lúc ghi).
        -- CASE phải nằm trong ngoặc: plpgsql cắt điều kiện IF ở chữ THEN đầu tiên ngoài ngoặc.
        IF m.cand AND game_xidach_points((SELECT cards FROM game_hands WHERE room_id = p_room AND seat = v_who))
                      < (CASE WHEN v_who = o_banker THEN 15 ELSE 16 END) THEN
          v_err := 'games.err.notEnough';
        END IF;
      ELSE
        v_err := 'games.err.badMove';
      END IF;
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;

    /* ----- apply ----- */
    v_show := NULL;
    IF jsonb_typeof(d) = 'object' THEN
      IF o_phase IS NULL THEN
        v_n := (d ->> 'n')::int;
        o_out := array_fill(false, ARRAY[v_n]);
        v_scores := array_fill(0, ARRAY[v_n]);
        v_rounds := v_laps * v_n;
      END IF;
      o_round := (d ->> 'round')::int;
      o_banker := (d ->> 'banker')::int;
      o_phase := 'play';
      o_count := array_fill(0, ARRAY[v_n]);
      v_stood := array_fill(false, ARRAY[v_n]);
      FOR y IN 0..v_n - 1 LOOP
        IF NOT o_out[y + 1] THEN o_count[y + 1] := 2; END IF;
        v_stood[y + 1] := o_out[y + 1] OR (d -> 'xi') ? y::text;
      END LOOP;
      v_order := ARRAY(SELECT (o_banker + g) % v_n FROM generate_series(1, v_n - 1) g
                        WHERE NOT o_out[(o_banker + g) % v_n + 1] AND NOT (d -> 'xi') ? ((o_banker + g) % v_n)::text ORDER BY g)
                 || o_banker;
      v_since := m.at;
      v_show := d -> 'show';
      IF v_show IS NULL THEN
        o_turn := (SELECT x FROM unnest(v_order) WITH ORDINALITY u(x, o) WHERE NOT v_stood[x + 1] AND NOT o_out[x + 1] ORDER BY o LIMIT 1);
        CONTINUE;
      END IF;
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      o_out[m.seat + 1] := true;
      IF o_phase <> 'play' THEN
        IF (SELECT count(*) FROM unnest(o_out) o WHERE NOT o) < 2 THEN v_over := true; END IF;
        CONTINUE;
      END IF;
      IF m.seat <> o_banker THEN
        o_turn := (SELECT x FROM unnest(v_order) WITH ORDINALITY u(x, o) WHERE NOT v_stood[x + 1] AND NOT o_out[x + 1] ORDER BY o LIMIT 1);
        CONTINUE;
      END IF;
      -- Cái rời: ván bỏ (xuống roundEnd bên dưới, không so bài).
    ELSIF d = 'true'::jsonb THEN
      CONTINUE;  -- xin chia: fill đã đổi thành { deal: {…} }; dòng trơn trong log (không có) thì bỏ qua
    ELSE
      v_since := m.at;
      IF m.move -> 'draw' = 'true'::jsonb THEN
        o_count[v_who + 1] := o_count[v_who + 1] + 1;
        IF o_count[v_who + 1] < 5 THEN CONTINUE; END IF;
      END IF;
      v_stood[v_who + 1] := true;
      IF v_who <> o_banker THEN
        o_turn := (SELECT x FROM unnest(v_order) WITH ORDINALITY u(x, o) WHERE NOT v_stood[x + 1] AND NOT o_out[x + 1] ORDER BY o LIMIT 1);
        CONTINUE;
      END IF;
      v_show := m.move -> 'show';
    END IF;

    -- settle() + roundEnd() của JS.
    IF jsonb_typeof(v_show) = 'object' AND v_show ? o_banker::text THEN
      v_bh := ARRAY(SELECT (x #>> '{}')::int FROM jsonb_array_elements(v_show -> o_banker::text) x);
      FOR e IN SELECT key, value FROM jsonb_each(v_show) LOOP
        y := e.key::int;
        IF y = o_banker OR y >= v_n OR o_out[y + 1] THEN CONTINUE; END IF;
        v_v := game_xidach_pay(ARRAY(SELECT (x #>> '{}')::int FROM jsonb_array_elements(e.value) x), v_bh);
        v_scores[y + 1] := v_scores[y + 1] + v_v;
        v_scores[o_banker + 1] := v_scores[o_banker + 1] - v_v;
      END LOOP;
    END IF;
    o_phase := 'done';
    o_turn := NULL;
    IF o_round + 1 >= v_rounds OR (SELECT count(*) FROM unnest(o_out) o WHERE NOT o) < 2 THEN v_over := true; END IF;
  END LOOP;

  IF NOT v_over THEN RETURN; END IF;
  SELECT max(v_scores[g + 1]) INTO k FROM generate_series(0, v_n - 1) g WHERE NOT o_out[g + 1];
  o_result := jsonb_build_object(
    'winners', CASE WHEN k IS NULL
                    THEN (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE v_scores[g + 1] = (SELECT max(x) FROM unnest(v_scores) x))
                    ELSE (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE NOT o_out[g + 1] AND v_scores[g + 1] = k) END,
    'draw', false,
    'scores', (SELECT jsonb_object_agg(g::text, v_scores[g + 1]) FROM generate_series(0, v_n - 1) g));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_xidach_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_xidach_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_xidach_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_xidach_run(p_room, NULL, NULL) $$;

/* ---------- Điền nước ---------- */
CREATE OR REPLACE FUNCTION public.game_xidach_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c      record;
  y      int;
  v_hand int[];
  v_deck int[];
  v_act  text;
  v_o    jsonb;
  k      int;
BEGIN
  SELECT * INTO c FROM game_xidach_run(p_room, NULL, NULL);
  IF p_move -> 'deal' = 'true'::jsonb THEN
    y := c.o_banker;
    FOR k IN 1..cardinality(c.o_out) LOOP
      y := (c.o_banker + k) % cardinality(c.o_out);
      EXIT WHEN NOT c.o_out[y + 1];
    END LOOP;
    RETURN jsonb_build_object('deal', game_xidach_round(p_room, c.o_round + 1, y, c.o_out));
  END IF;
  IF p_move -> 'out' = 'true'::jsonb THEN RETURN p_move; END IF;

  y := CASE WHEN p_move -> 'timeout' = 'true'::jsonb THEN c.o_turn ELSE p_seat END;
  SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = y;
  IF p_move -> 'timeout' = 'true'::jsonb THEN
    v_act := CASE WHEN cardinality(v_hand) < 5 AND game_xidach_points(v_hand) < CASE WHEN y = c.o_banker THEN 15 ELSE 16 END
                  THEN 'draw' ELSE 'stand' END;
  ELSE
    v_act := CASE WHEN p_move -> 'draw' = 'true'::jsonb THEN 'draw' ELSE 'stand' END;
  END IF;

  IF v_act = 'draw' THEN
    SELECT cards INTO v_deck FROM game_hands WHERE room_id = p_room AND seat = -1;
    v_hand := v_hand || v_deck[1];
    UPDATE game_hands SET cards = v_hand WHERE room_id = p_room AND seat = y;
    UPDATE game_hands SET cards = v_deck[2:] WHERE room_id = p_room AND seat = -1;
  END IF;
  v_o := jsonb_build_object(v_act, true);
  IF p_move -> 'timeout' = 'true'::jsonb THEN v_o := v_o || '{"timeout": true}'; END IF;
  -- Cái dằn hoặc rút đủ 5 lá → lật bài cả bàn.
  IF y = c.o_banker AND (v_act = 'stand' OR cardinality(v_hand) >= 5) THEN
    v_o := v_o || jsonb_build_object('show', game_xidach_show(p_room));
  END IF;
  RETURN v_o;
END;
$$;

REVOKE ALL ON FUNCTION public.game_xidach_points(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_kind(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_pay(int[], int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_show(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_round(uuid, int, int, boolean[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xidach_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

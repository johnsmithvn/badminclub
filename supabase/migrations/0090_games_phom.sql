-- 0090_games_phom.sql — Phỏm / Tá lả (docs/GAMES.md §5.2, §12). Chạy sau 0078. Chỉ thêm hàm, không đụng bảng / data.
--
-- Bài: game_hands ghế ≥ 0 = bài còn trên tay (RLS chỉ chủ bài đọc; hết ván cả CLB xem để lật bài), ghế -1 = nọc,
--   ghế -10 - s = các nhóm bị khoá của ghế s (lá ăn + lá ghép), mã hoá [độ dài, lá…, độ dài, lá…]. Ghế âm không ai đọc.
-- game_phom_deal   — game_start gọi: xáo 52 lá, người đi đầu 10 lá, còn lại 9; ván "chơi lại" thì người Nhất ván trước
--                    đi đầu, không thì bốc ngẫu nhiên; ghi nước 1 { deal: { n, first } }.
-- game_phom_run    — dựng lại phần công khai (như replay() của lib/games/phom.js); kiểm nước đang xin ghi bằng bài thật
--                    → o_err; hết ván → o_result (finalOf của JS, dùng bài còn trên tay).
-- game_phom_check  — game_move gọi. game_phom_fill — game_move gọi: chuyển lá giữa tay / nọc / nhóm khoá, giấu lá ghép
--                    khi ăn, hết giờ thì đi thay người tới lượt (bốc · hạ các nhóm khoá · đánh lá to nhất không khoá).
-- game_phom_result — game_finish (0075) dùng hàm này, bỏ kết quả client.
-- options.time = giây mỗi lượt (0 / 20 / 30 / 45, sai dạng → 30; 0 = tắt). Chép luật lib/games/phom.js — đổi luật thì sửa
-- cả hai. Lá c = hạng * 4 + chất như Tiến lên; số Phỏm: hạng ≤ 10 → hạng + 3, A (11) → 1, 2 (12) → 2.

BEGIN;

/* ---------- Luật bài ---------- */

CREATE OR REPLACE FUNCTION public.game_phom_val(c int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN c >> 2 <= 10 THEN (c >> 2) + 3 WHEN c >> 2 = 11 THEN 1 ELSE 2 END $$;

-- isPhom: 3+ lá khác nhau, cùng số; hoặc cùng chất và số liền nhau.
CREATE OR REPLACE FUNCTION public.game_phom_ok(p int[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  vs int[];
BEGIN
  IF p IS NULL OR cardinality(p) < 3 OR (SELECT count(DISTINCT x) FROM unnest(p) x) <> cardinality(p) THEN RETURN false; END IF;
  vs := ARRAY(SELECT game_phom_val(x) FROM unnest(p) x ORDER BY 1);
  IF vs[1] = vs[cardinality(vs)] THEN RETURN true; END IF;
  IF (SELECT count(DISTINCT x & 3) FROM unnest(p) x) <> 1 THEN RETURN false; END IF;
  RETURN vs[cardinality(vs)] - vs[1] = cardinality(vs) - 1 AND (SELECT count(DISTINCT x) FROM unnest(vs) x) = cardinality(vs);
END;
$$;

-- Mảng số lá 0..51 trong jsonb, sai dạng → NULL.
CREATE OR REPLACE FUNCTION public.game_phom_ints(j jsonb)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF jsonb_typeof(j) IS DISTINCT FROM 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(j) e WHERE jsonb_typeof(e) <> 'number' OR (e #>> '{}') !~ '^[0-9]{1,2}$') THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(j) e WHERE (e #>> '{}')::int > 51) THEN RETURN NULL; END IF;
  RETURN ARRAY(SELECT (e #>> '{}')::int FROM jsonb_array_elements(j) e);
END;
$$;

-- Nhóm khoá của ghế s, dạng jsonb [[lá…]…].
CREATE OR REPLACE FUNCTION public.game_phom_locks(p_room uuid, p_seat int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a   int[];
  o   jsonb := '[]';
  i   int := 1;
BEGIN
  SELECT cards INTO a FROM game_hands WHERE room_id = p_room AND seat = -10 - p_seat;
  WHILE a IS NOT NULL AND i <= cardinality(a) LOOP
    o := o || jsonb_build_array(to_jsonb(a[i + 1 : i + a[i]]));
    i := i + a[i] + 1;
  END LOOP;
  RETURN o;
END;
$$;

-- Hạ / ù hợp lệ: các phỏm hợp lệ, không trùng lá, nằm trong tay; mỗi nhóm khoá nằm trọn trong đúng một phỏm và không
-- dính phỏm khác; một phỏm chứa tối đa một nhóm khoá; tổng số lá ≥ p_need.
CREATE OR REPLACE FUNCTION public.game_phom_groups_ok(p_groups jsonb, p_hand int[], p_locks jsonb, p_need int)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  g    jsonb;
  l    jsonb;
  gs   int[];
  ls   int[];
  flat int[] := '{}';
  k    int;
BEGIN
  IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    gs := game_phom_ints(g);
    IF NOT game_phom_ok(gs) THEN RETURN false; END IF;
    flat := flat || gs;
    k := 0;
    FOR l IN SELECT value FROM jsonb_array_elements(p_locks) LOOP
      ls := game_phom_ints(l);
      IF gs @> ls THEN k := k + 1;
      ELSIF gs && ls THEN RETURN false;
      END IF;
    END LOOP;
    IF k > 1 THEN RETURN false; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM unnest(flat) x) <> cardinality(flat) OR NOT (p_hand @> flat) OR cardinality(flat) < p_need THEN
    RETURN false;
  END IF;
  FOR l IN SELECT value FROM jsonb_array_elements(p_locks) LOOP
    IF NOT (flat @> game_phom_ints(l)) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

/* ---------- Chia bài ---------- */

CREATE OR REPLACE FUNCTION public.game_phom_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deck  int[] := ARRAY(SELECT c FROM generate_series(0, 51) c ORDER BY random());
  v_n     int;
  v_first int;
  v_club  uuid;
  v_mem   uuid;
  v_prev  game_rooms;
  v_k     int;
  r       record;
BEGIN
  SELECT count(*) INTO v_n FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  SELECT * INTO v_prev FROM game_rooms WHERE next_room = p_room AND status = 'finished' LIMIT 1;
  IF v_prev.id IS NOT NULL THEN
    SELECT n.seat INTO v_first
      FROM game_room_players o JOIN game_room_players n ON n.member_id = o.member_id AND n.room_id = p_room AND n.left_at IS NULL
     WHERE o.room_id = v_prev.id AND o.seat = (v_prev.result #>> '{winners,0}')::int
     ORDER BY o.left_at NULLS FIRST LIMIT 1;
  END IF;
  v_first := COALESCE(v_first, floor(random() * v_n)::int);

  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    v_k := CASE WHEN r.seat = v_first THEN 10 ELSE 9 END;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, r.seat, r.member_id, r.club_id, v_deck[1:v_k])
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, -10 - r.seat, r.member_id, r.club_id, '{}')
    ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;
    v_deck := v_deck[v_k + 1:];
    v_club := r.club_id;
    v_mem := r.member_id;
  END LOOP;
  -- Ghế âm: member_id bắt buộc nên ghi tạm một người ngồi — RLS không cho ai đọc ghế âm.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, -1, v_mem, v_club, v_deck)
  ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_first, jsonb_build_object('deal', jsonb_build_object('n', v_n, 'first', v_first)));
END;
$$;

/* ---------- Dựng lại ván ---------- */
-- o_turn / o_step / o_top = thế hiện tại (fill dùng). Mảng plpgsql: ghế s ở [s + 1]; v_laid = jsonb mảng n phần tử.
CREATE OR REPLACE FUNCTION public.game_phom_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_result jsonb, OUT o_turn int, OUT o_step text, OUT o_top int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt    jsonb;
  v_time   bigint;
  v_n      int := 0;
  v_out    boolean[];
  v_turns  int[];
  v_eaten  jsonb;            -- [[lá ăn của ghế 0], …]
  v_laid   jsonb;            -- [null | [[lá…]…], …]
  v_order  int[] := '{}';    -- thứ tự hạ
  v_eats   jsonb := '[]';    -- [{ from, to, chot }]
  v_top_s  int;
  v_u      int;
  v_over   boolean := false;
  v_since  bigint;
  v_err    text;
  v_who    int;
  v_hand   int[];
  v_locks  jsonb;
  v_w      int[];
  v_c      int;
  v_to     int;
  v_gi     int;
  v_tgt    jsonb;
  v_k      int;
  m        record;
  d        jsonb;
  y        int;
  -- chấm điểm
  v_pts    int[];
  v_scores int[];
  v_mom    int[];
  v_ok     int[];
  v_ranks  int[];
  v_den    int;
  e        jsonb;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (0, 20, 30, 45) THEN (v_opt ->> 'time')::numeric::int ELSE 30 END
                        ELSE 30 END;

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
      IF v_n > 0 OR m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF v_n = 0 THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF o_turn IS NULL THEN
      v_err := 'games.err.notYourTurn';
    ELSIF m.cand AND m.move -> 'timeout' = 'true'::jsonb THEN
      IF v_time = 0 THEN v_err := 'games.err.badMove';
      ELSIF m.at < v_since + v_time THEN v_err := 'games.err.notYet';
      END IF;
    ELSE
      v_who := CASE WHEN m.move -> 'timeout' = 'true'::jsonb THEN o_turn ELSE m.seat END;
      IF v_who <> o_turn THEN
        v_err := 'games.err.notYourTurn';
      ELSE
        IF m.cand THEN
          SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = v_who;
          v_locks := game_phom_locks(p_room, v_who);
        END IF;
        IF m.move -> 'draw' = 'true'::jsonb THEN
          IF o_step <> 'take' THEN v_err := 'games.err.badMove';
          ELSIF m.cand AND COALESCE((SELECT cardinality(cards) FROM game_hands WHERE room_id = p_room AND seat = -1), 0) = 0 THEN
            v_err := 'games.err.badMove';
          END IF;
        ELSIF m.move -> 'eat' = 'true'::jsonb THEN
          IF o_step <> 'take' OR o_top IS NULL OR v_out[v_top_s + 1] THEN v_err := 'games.err.badMove';
          ELSIF m.cand THEN
            -- Lá ghép: 2+ lá trên tay, chưa bị khoá, ghép với lá ăn thành phỏm.
            v_w := game_phom_ints(m.move -> 'with');
            IF v_w IS NULL OR cardinality(v_w) < 2 OR NOT (v_hand @> v_w) OR NOT game_phom_ok(v_w || o_top)
               OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_locks) l WHERE game_phom_ints(l) && v_w) THEN
              v_err := 'games.err.cantEat';
            END IF;
          END IF;
        ELSIF m.move ? 'u' THEN
          IF o_step = 'take' OR v_turns[v_who + 1] >= 4 OR v_laid -> v_who <> 'null'::jsonb THEN v_err := 'games.err.badMove';
          ELSIF m.cand AND NOT game_phom_groups_ok(m.move -> 'u', v_hand, v_locks, cardinality(v_hand) - 1) THEN
            v_err := 'games.err.badLay';
          END IF;
        ELSIF m.move ? 'lay' THEN
          IF o_step <> 'lay' THEN v_err := 'games.err.badMove';
          ELSIF m.cand AND NOT game_phom_groups_ok(m.move -> 'lay', v_hand, v_locks, 0) THEN v_err := 'games.err.badLay';
          END IF;
        ELSIF m.move ? 'send' THEN
          v_c := game_phom_ints(jsonb_build_array(m.move #> '{send,card}'))[1];
          v_to := CASE WHEN (m.move #>> '{send,to}') ~ '^[0-9]$' THEN (m.move #>> '{send,to}')::int END;
          v_gi := CASE WHEN (m.move #>> '{send,group}') ~ '^[0-9]{1,2}$' THEN (m.move #>> '{send,group}')::int END;
          v_tgt := CASE WHEN v_to < v_n THEN v_laid -> v_to -> v_gi END;
          IF o_step <> 'discard' OR v_laid -> v_who = 'null'::jsonb OR v_c IS NULL OR v_to IS NULL OR v_to = v_who
             OR jsonb_typeof(v_tgt) IS DISTINCT FROM 'array' OR NOT game_phom_ok(game_phom_ints(v_tgt) || v_c) THEN
            v_err := 'games.err.badMove';
          ELSIF m.cand AND NOT (v_c = ANY(v_hand)) THEN
            v_err := 'games.err.notYourCard';
          END IF;
        ELSIF m.move ? 'discard' THEN
          v_c := game_phom_ints(jsonb_build_array(m.move -> 'discard'))[1];
          IF o_step <> 'discard' OR v_c IS NULL THEN v_err := 'games.err.badMove';
          ELSIF v_eaten -> v_who @> to_jsonb(v_c) THEN v_err := 'games.err.locked';
          ELSIF m.cand AND NOT (v_c = ANY(v_hand)) THEN v_err := 'games.err.notYourCard';
          ELSIF m.cand AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_locks) l WHERE v_c = ANY(game_phom_ints(l))) THEN
            v_err := 'games.err.locked';
          END IF;
        ELSE
          v_err := 'games.err.badMove';
        END IF;
      END IF;
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;

    /* ----- apply ----- */
    IF jsonb_typeof(d) = 'object' THEN
      v_n := (d ->> 'n')::int;
      o_turn := (d ->> 'first')::int;
      o_step := 'discard';
      v_out := array_fill(false, ARRAY[v_n]);
      v_turns := array_fill(0, ARRAY[v_n]);
      v_eaten := (SELECT jsonb_agg('[]'::jsonb) FROM generate_series(1, v_n));
      v_laid := (SELECT jsonb_agg('null'::jsonb) FROM generate_series(1, v_n));
      v_since := m.at;
      CONTINUE;
    END IF;
    IF m.move -> 'out' = 'true'::jsonb THEN
      v_out[m.seat + 1] := true;
      IF v_top_s = m.seat THEN o_top := NULL; v_top_s := NULL; END IF;
      IF m.seat <> o_turn THEN CONTINUE; END IF;
      v_who := m.seat;
      v_k := NULL;
      FOR y IN 1..v_n LOOP
        IF NOT v_out[(v_who + y) % v_n + 1] AND v_turns[(v_who + y) % v_n + 1] < 4 THEN v_k := (v_who + y) % v_n; EXIT; END IF;
      END LOOP;
      IF v_k IS NULL THEN o_turn := NULL; v_over := true; ELSE o_turn := v_k; o_step := 'take'; v_since := m.at; END IF;
      CONTINUE;
    END IF;
    v_since := m.at;
    IF m.move -> 'draw' = 'true'::jsonb OR m.move -> 'eat' = 'true'::jsonb THEN
      IF m.move -> 'eat' = 'true'::jsonb THEN
        v_eats := v_eats || jsonb_build_object('from', v_top_s, 'to', v_who, 'chot', v_turns[v_who + 1] = 3);
        v_eaten := jsonb_set(v_eaten, ARRAY[v_who::text], (v_eaten -> v_who) || to_jsonb(o_top));
        o_top := NULL;
        v_top_s := NULL;
      END IF;
      o_step := CASE WHEN v_turns[v_who + 1] = 3 THEN 'lay' ELSE 'discard' END;
    ELSIF m.move ? 'u' THEN
      v_u := v_who;
      v_laid := jsonb_set(v_laid, ARRAY[v_who::text], m.move -> 'u');
      v_over := true;
      o_turn := NULL;
    ELSIF m.move ? 'lay' THEN
      v_laid := jsonb_set(v_laid, ARRAY[v_who::text], m.move -> 'lay');
      v_order := v_order || v_who;
      o_step := 'discard';
    ELSIF m.move ? 'send' THEN
      v_laid := jsonb_set(v_laid, ARRAY[v_to::text, v_gi::text], v_tgt || to_jsonb(v_c));
    ELSE
      v_turns[v_who + 1] := v_turns[v_who + 1] + 1;
      o_top := v_c;
      v_top_s := v_who;
      v_k := NULL;
      FOR y IN 1..v_n LOOP
        IF NOT v_out[(v_who + y) % v_n + 1] AND v_turns[(v_who + y) % v_n + 1] < 4 THEN v_k := (v_who + y) % v_n; EXIT; END IF;
      END LOOP;
      IF v_k IS NULL THEN o_turn := NULL; o_top := NULL; v_over := true; ELSE o_turn := v_k; o_step := 'take'; END IF;
    END IF;
  END LOOP;

  IF NOT v_over THEN RETURN; END IF;

  /* ----- finalOf() của JS: bài còn trên tay ----- */
  v_scores := array_fill(0, ARRAY[v_n]);
  FOR e IN SELECT value FROM jsonb_array_elements(v_eats) LOOP
    v_k := CASE WHEN (e ->> 'chot')::boolean THEN 4 ELSE 1 END;
    v_scores[(e ->> 'from')::int + 1] := v_scores[(e ->> 'from')::int + 1] - v_k;
    v_scores[(e ->> 'to')::int + 1] := v_scores[(e ->> 'to')::int + 1] + v_k;
  END LOOP;
  v_pts := ARRAY(SELECT COALESCE((SELECT sum(game_phom_val(x)) FROM game_hands h, unnest(h.cards) x WHERE h.room_id = p_room AND h.seat = g), 0)::int
                   FROM generate_series(0, v_n - 1) g ORDER BY g);
  IF v_u IS NOT NULL THEN
    SELECT (q.f)::int INTO v_den FROM (
      SELECT x ->> 'from' AS f FROM jsonb_array_elements(v_eats) x WHERE (x ->> 'to')::int = v_u GROUP BY 1 HAVING count(*) >= 3 ORDER BY 1 LIMIT 1) q;
    FOR y IN 0..v_n - 1 LOOP
      IF y = v_u THEN CONTINUE; END IF;
      v_scores[COALESCE(v_den, y) + 1] := v_scores[COALESCE(v_den, y) + 1] - 5;
      v_scores[v_u + 1] := v_scores[v_u + 1] + 5;
    END LOOP;
    v_ranks := v_u || ARRAY(SELECT g FROM generate_series(0, v_n - 1) g WHERE g <> v_u AND NOT v_out[g + 1] ORDER BY g)
                   || ARRAY(SELECT g FROM generate_series(0, v_n - 1) g WHERE g <> v_u AND v_out[g + 1] ORDER BY g);
  ELSE
    v_mom := ARRAY(SELECT g FROM generate_series(0, v_n - 1) g
                    WHERE NOT v_out[g + 1] AND COALESCE(jsonb_array_length(NULLIF(v_laid -> g, 'null'::jsonb)), 0) = 0
                    ORDER BY COALESCE(array_position(v_order, g), 99), g);
    v_ok := ARRAY(SELECT g FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1] AND NOT (g = ANY(v_mom))
                   ORDER BY v_pts[g + 1], COALESCE(array_position(v_order, g), 99), g);
    IF cardinality(v_ok) = 0 THEN
      v_ok := ARRAY(SELECT x FROM unnest(v_mom) x ORDER BY v_pts[x + 1], COALESCE(array_position(v_order, x), 99), x);
      v_mom := '{}';
    END IF;
    v_ranks := v_ok || v_mom || ARRAY(SELECT g FROM generate_series(0, v_n - 1) g WHERE v_out[g + 1] ORDER BY g);
    FOR y IN 2..cardinality(v_ok) LOOP
      v_scores[v_ok[y] + 1] := v_scores[v_ok[y] + 1] - (y - 1);
      v_scores[v_ranks[1] + 1] := v_scores[v_ranks[1] + 1] + (y - 1);
    END LOOP;
    FOR y IN 1..v_n LOOP
      IF NOT (y - 1 = ANY(v_mom) OR v_out[y]) THEN CONTINUE; END IF;
      v_scores[y] := v_scores[y] - 4;
      v_scores[v_ranks[1] + 1] := v_scores[v_ranks[1] + 1] + 4;
    END LOOP;
  END IF;
  o_result := jsonb_build_object('winners', jsonb_build_array(v_ranks[1]), 'draw', false, 'ranks', to_jsonb(v_ranks),
    'scores', (SELECT jsonb_object_agg(g::text, v_scores[g + 1]) FROM generate_series(0, v_n - 1) g),
    'points', (SELECT jsonb_object_agg(g::text, v_pts[g + 1]) FROM generate_series(0, v_n - 1) g),
    'mom', to_jsonb(COALESCE(v_mom, '{}')));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_phom_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_phom_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_phom_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_result FROM public.game_phom_run(p_room, NULL, NULL) $$;

/* ---------- Điền nước (check đã chặn nước sai) ---------- */
CREATE OR REPLACE FUNCTION public.game_phom_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c       record;
  y       int;
  v_hand  int[];
  v_deck  int[];
  v_lock  int[];
  v_locks jsonb;
  v_mv    jsonb := p_move;
  v_c     int;
  v_w     int[];
  v_flat  int[];
  v_to    boolean := p_move -> 'timeout' = 'true'::jsonb;
BEGIN
  IF p_move -> 'out' = 'true'::jsonb THEN RETURN p_move; END IF;
  SELECT * INTO c FROM game_phom_run(p_room, NULL, NULL);
  y := CASE WHEN v_to THEN c.o_turn ELSE p_seat END;
  SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = y;
  v_locks := game_phom_locks(p_room, y);

  -- Hết giờ: bốc · hạ đúng các nhóm khoá · đánh lá to nhất không bị khoá.
  IF v_to THEN
    IF c.o_step = 'take' THEN v_mv := '{"draw": true}';
    ELSIF c.o_step = 'lay' THEN v_mv := jsonb_build_object('lay', v_locks);
    ELSE
      v_c := (SELECT x FROM unnest(v_hand) x
               WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_locks) l WHERE x = ANY(game_phom_ints(l)))
               ORDER BY game_phom_val(x) DESC, x DESC LIMIT 1);
      v_mv := jsonb_build_object('discard', v_c);
    END IF;
  END IF;

  IF v_mv -> 'draw' = 'true'::jsonb THEN
    SELECT cards INTO v_deck FROM game_hands WHERE room_id = p_room AND seat = -1;
    UPDATE game_hands SET cards = v_hand || v_deck[1] WHERE room_id = p_room AND seat = y;
    UPDATE game_hands SET cards = v_deck[2:] WHERE room_id = p_room AND seat = -1;
    v_mv := '{"draw": true}';
  ELSIF v_mv -> 'eat' = 'true'::jsonb THEN
    v_w := game_phom_ints(v_mv -> 'with');
    UPDATE game_hands SET cards = v_hand || c.o_top WHERE room_id = p_room AND seat = y;
    UPDATE game_hands SET cards = cards || (cardinality(v_w) + 1) || c.o_top || v_w WHERE room_id = p_room AND seat = -10 - y;
    v_mv := '{"eat": true}';  -- lá ghép giữ kín
  ELSIF v_mv ? 'discard' THEN
    v_c := (v_mv ->> 'discard')::int;
    UPDATE game_hands SET cards = array_remove(v_hand, v_c) WHERE room_id = p_room AND seat = y;
    v_mv := jsonb_build_object('discard', v_c);
  ELSIF v_mv ? 'lay' THEN
    v_flat := ARRAY(SELECT (x #>> '{}')::int FROM jsonb_array_elements(v_mv -> 'lay') g, jsonb_array_elements(g) x);
    UPDATE game_hands SET cards = ARRAY(SELECT x FROM unnest(v_hand) x WHERE NOT (x = ANY(v_flat))) WHERE room_id = p_room AND seat = y;
    UPDATE game_hands SET cards = '{}' WHERE room_id = p_room AND seat = -10 - y;
    v_mv := jsonb_build_object('lay', v_mv -> 'lay');
  ELSIF v_mv ? 'send' THEN
    v_c := (v_mv #>> '{send,card}')::int;
    UPDATE game_hands SET cards = array_remove(v_hand, v_c) WHERE room_id = p_room AND seat = y;
    v_mv := jsonb_build_object('send', v_mv -> 'send');
  ELSIF v_mv ? 'u' THEN
    v_flat := ARRAY(SELECT (x #>> '{}')::int FROM jsonb_array_elements(v_mv -> 'u') g, jsonb_array_elements(g) x);
    v_mv := jsonb_build_object('u', v_mv -> 'u', 'rest', to_jsonb(ARRAY(SELECT x FROM unnest(v_hand) x WHERE NOT (x = ANY(v_flat)))));
  END IF;
  IF v_to THEN v_mv := v_mv || '{"timeout": true}'; END IF;
  RETURN v_mv;
END;
$$;

REVOKE ALL ON FUNCTION public.game_phom_val(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_ok(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_ints(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_locks(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_groups_ok(jsonb, int[], jsonb, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

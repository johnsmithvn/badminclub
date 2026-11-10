-- 0084_games_masoi.sql — Ma sói: server làm quản trò — chia vai bí mật, giấu lựa chọn ban đêm, tính ai chết / ai thắng
-- (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần bảng game_hands + game_start / game_move bản 0078 gọi game_<id>_deal / game_<id>_fill).
-- CHỈ THÊM HÀM. Chạy lại được.
--
-- Vai: 0 Dân làng · 1 Sói · 2 Sói nguyền · 3 Tiên tri · 4 Bảo vệ · 5 Phù thủy · 6 Thợ săn · 7 Già làng · 8 Thần tình yêu.
-- game_hands của phòng Ma sói:
--   ghế ≥ 0 — [vai, k, a, b, k, a, b, …]: vai của người đó rồi các dữ kiện riêng, mỗi dữ kiện 3 số (k = loại):
--             1 đồng đội Sói (a = ghế) · 2 Tiên tri đã soi (a = ghế, b = 1 nếu là Sói) · 3 người bị cắn đêm nay
--             (Phù thủy; a = ghế hoặc -1, b = đêm) · 4 đôi tình nhân (a, b) · 5 Sói chọn cắn đêm nay (a = Sói, b = ghế)
--             · 6 bình còn lại (Phù thủy; a = cứu, b = độc) · 7 người che đêm trước (Bảo vệ) · 8 lời nguyền còn
--             (Sói nguyền) · 9 bị nguyền thành Sói (a = đêm);
--   ghế -1  — vai của từng ghế (phần tử k+1 là của ghế k), đổi khi có người bị nguyền;
--   ghế -2  — lựa chọn đêm nay, 2 số mỗi ghế: Sói [ghế cắn, 1 nếu dùng lời nguyền] · Bảo vệ [ghế che, -]
--             · Phù thủy [1 nếu cứu, ghế đầu độc]; -1 = chưa chọn;
--   ghế -3  — [ghế đã che đêm trước, bình cứu, bình độc, khiên Già làng, lời nguyền, tình nhân A, tình nhân B,
--             nạn nhân đêm nay]. Ghế âm không ai đọc được (RLS 0078).
--
-- game_masoi_table — bộ vai theo số người (như tableOf ở JS).
-- game_masoi_deal  — (game_start gọi) xáo vai, tạo hàng game_hands, ghi nước 1 { deal: { n } }.
-- game_masoi_run   — dựng lại phần ai cũng thấy từ log; có p_move thì kiểm nước đó (o_err).
-- game_masoi_after — người chết + chết theo tình nhân → Thợ săn bắn? lộ vai nào? hết ván chưa? → nước { next } để ghi.
-- game_masoi_fill  — (game_move gọi) { night } → kiểm theo vai, cất lựa chọn, log { night: true };
--                    { next } → chốt bước (đêm / phù thủy / ngày / thợ săn / có người rời) và log kết quả.
-- game_masoi_result — đội thắng; game_finish 0075 dùng hàm này, bỏ kết quả client.
-- Đồng hồ: options.time = giây ban ngày (0 = không giới hạn cả ván), đêm / Phù thủy / Thợ săn 45 giây, tính từ created_at
-- của nước mở bước. Qua hạn thì { next } được nhận dù chưa đủ người (sớm → games.err.notYet, máy khách im lặng thử lại).
-- Chép luật lib/games/masoi.js — đổi luật thì sửa cả hai.

/* ---------- Tiện ích ---------- */
-- Số nguyên trong jsonb (ghế 0..15 hoặc -1), sai dạng → NULL.
CREATE OR REPLACE FUNCTION public.game_masoi_pick(j jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'number' AND (j #>> '{}') ~ '^(-1|[0-9]{1,2})$' THEN (j #>> '{}')::int END
$$;

-- Bỏ các dữ kiện loại p_kinds khỏi hàng [vai, k, a, b, …].
CREATE OR REPLACE FUNCTION public.game_masoi_drop(p int[], p_kinds int[])
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  o int[] := p[1:1];
  i int := 2;
BEGIN
  WHILE i + 2 <= cardinality(p) LOOP
    IF NOT (p[i] = ANY(p_kinds)) THEN o := o || p[i:i + 2]; END IF;
    i := i + 3;
  END LOOP;
  RETURN o;
END;
$$;

-- 5 người: 1 Sói · 6–8: 2 · 9–12: 3 (từ 8 người một con là Sói nguyền). Vai đặc biệt theo thứ tự Tiên tri, Bảo vệ,
-- Phù thủy, Thợ săn, Già làng, Thần tình yêu; còn lại là Dân làng.
CREATE OR REPLACE FUNCTION public.game_masoi_table(p_n int)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_w  int := CASE WHEN p_n <= 5 THEN 1 WHEN p_n <= 8 THEN 2 ELSE 3 END;
  v_sp int;
  v    int[] := '{}';
  i    int;
BEGIN
  v_sp := LEAST(6, GREATEST(2, p_n - v_w - 2));
  FOR i IN 1 .. v_w LOOP
    v := v || CASE WHEN i = 1 AND p_n >= 8 THEN 2 ELSE 1 END;
  END LOOP;
  v := v || (ARRAY[3, 4, 5, 6, 7, 8])[1:v_sp];
  WHILE cardinality(v) < p_n LOOP v := v || 0; END LOOP;
  RETURN v;
END;
$$;

/* ---------- Bắt đầu trận (game_start 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_masoi_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club  uuid;
  v_mem   uuid;
  v_n     int;
  v_roles int[];
  v_row   int[];
  v_role  int;
  r       record;
  w       int;
BEGIN
  SELECT count(*) INTO v_n FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  v_roles := ARRAY(SELECT x FROM unnest(game_masoi_table(v_n)) x ORDER BY random());
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    v_role := v_roles[r.seat + 1];
    v_row := ARRAY[v_role];
    IF v_role IN (1, 2) THEN
      FOR w IN 0 .. v_n - 1 LOOP
        IF v_roles[w + 1] IN (1, 2) THEN v_row := v_row || ARRAY[1, w, 0]; END IF;
      END LOOP;
    END IF;
    IF v_role = 2 THEN v_row := v_row || ARRAY[8, 1, 0]; END IF;
    IF v_role = 4 THEN v_row := v_row || ARRAY[7, -1, 0]; END IF;
    IF v_role = 5 THEN v_row := v_row || ARRAY[6, 1, 1]; END IF;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, r.seat, r.member_id, r.club_id, v_row)
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_club := r.club_id;
    v_mem := r.member_id;
  END LOOP;
  -- Ghế âm: member_id bắt buộc nên ghi tạm người ngồi cuối — RLS không cho ai đọc ghế âm.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
  VALUES (p_room, -1, v_mem, v_club, v_roles),
         (p_room, -2, v_mem, v_club, array_fill(-1, ARRAY[2 * v_n])),
         (p_room, -3, v_mem, v_club, ARRAY[-1, 1, 1, 1, 1, -1, -1, -1])
  ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, 0, jsonb_build_object('deal', jsonb_build_object('n', v_n)));
END;
$$;

/* ---------- Dựng lại phần ai cũng thấy ---------- */
-- p_move NULL: chỉ dựng lại (o_over khi xong). p_move có: kiểm nước đó của p_seat trên thế hiện tại → o_err.
-- o_votes: ghế bị bầu, -1 bỏ qua, NULL chưa bầu · o_shot: NULL chưa bắn, -1 không bắn · o_after: pha sau khi Thợ săn bắn.
CREATE OR REPLACE FUNCTION public.game_masoi_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_n int, OUT o_phase text, OUT o_night int, OUT o_alive boolean[], OUT o_acted boolean[],
  OUT o_votes int[], OUT o_hunter int, OUT o_shot int, OUT o_after text, OUT o_settle boolean, OUT o_over jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m    record;
  mv   jsonb;
  s    int;
  t    int;
  nx   text;
  i    int;
  done boolean;
  v_opt   jsonb;
  v_time  bigint;
  v_since bigint;
BEGIN
  o_settle := false;
  -- Đọc options như optsOf ở JS. CASE lồng nhau: chỉ ép kiểu số khi đúng là số.
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (0, 60, 120, 180, 300) THEN (v_opt ->> 'time')::numeric::int ELSE 120 END
                        ELSE 120 END;
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
      IF o_over IS NOT NULL THEN o_err := 'games.err.over'; RETURN; END IF;
      IF o_n IS NULL OR jsonb_typeof(mv) IS DISTINCT FROM 'object' OR mv ? 'deal' OR mv ? 'out'
         OR s IS NULL OR s < 0 OR s >= o_n THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      IF mv ? 'next' THEN
        done := o_settle
          OR (o_phase IN ('night', 'witch') AND NOT EXISTS (SELECT 1 FROM generate_series(1, o_n) j WHERE o_alive[j] AND NOT o_acted[j]))
          OR (o_phase = 'day' AND NOT EXISTS (SELECT 1 FROM generate_series(1, o_n) j WHERE o_alive[j] AND o_votes[j] IS NULL))
          OR (o_phase = 'hunter' AND o_shot IS NOT NULL)
          OR (v_time > 0 AND m.at >= v_since + CASE WHEN o_phase = 'day' THEN v_time ELSE 45000 END);
        IF mv -> 'next' IS DISTINCT FROM 'true'::jsonb THEN o_err := 'games.err.badMove';
        ELSIF NOT done THEN o_err := 'games.err.notYet';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'night' THEN
        IF COALESCE(o_phase, '') NOT IN ('night', 'witch') THEN o_err := 'games.err.badMove';
        ELSIF NOT o_alive[s + 1] THEN o_err := 'games.err.dead';
        ELSIF o_acted[s + 1] THEN o_err := 'games.err.acted';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'vote' THEN
        t := game_masoi_pick(mv -> 'vote');
        IF COALESCE(o_phase, '') <> 'day' THEN o_err := 'games.err.badMove';
        ELSIF NOT o_alive[s + 1] THEN o_err := 'games.err.dead';
        ELSIF o_votes[s + 1] IS NOT NULL THEN o_err := 'games.err.acted';
        ELSIF t IS NULL OR (t <> -1 AND (t >= o_n OR t = s OR NOT o_alive[t + 1])) THEN o_err := 'games.err.badTarget';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'shoot' THEN
        t := game_masoi_pick(mv -> 'shoot');
        IF COALESCE(o_phase, '') <> 'hunter' OR s IS DISTINCT FROM o_hunter OR o_shot IS NOT NULL THEN o_err := 'games.err.badMove';
        ELSIF t IS NULL OR (t <> -1 AND (t >= o_n OR t = s OR NOT o_alive[t + 1])) THEN o_err := 'games.err.badTarget';
        END IF;
        RETURN;
      END IF;
      o_err := 'games.err.badMove';
      RETURN;
    END IF;

    /* Nước đã ghi (server đã kiểm lúc ghi). */
    IF mv ? 'deal' THEN
      o_n := (mv -> 'deal' ->> 'n')::int;
      o_alive := array_fill(true, ARRAY[o_n]);
      o_acted := array_fill(false, ARRAY[o_n]);
      o_votes := array_fill(NULL::int, ARRAY[o_n]);
      o_phase := 'night';
      o_night := 1;
      v_since := m.at;
      CONTINUE;
    END IF;
    IF o_n IS NULL OR o_over IS NOT NULL THEN CONTINUE; END IF;

    IF mv -> 'out' = 'true'::jsonb THEN
      IF o_phase = 'hunter' AND o_hunter = s AND o_shot IS NULL THEN o_shot := -1; END IF;
      IF o_alive[s + 1] THEN
        o_alive[s + 1] := false;
        o_votes[s + 1] := NULL;
        o_settle := true;
      END IF;
    ELSIF mv ? 'night' THEN
      o_acted[s + 1] := true;
    ELSIF mv ? 'vote' THEN
      o_votes[s + 1] := (mv ->> 'vote')::int;
    ELSIF mv ? 'shoot' THEN
      o_shot := (mv ->> 'shoot')::int;
    ELSIF mv ? 'next' THEN
      nx := mv ->> 'next';
      IF nx <> 'settle' THEN v_since := m.at; END IF;
      FOR t IN SELECT (e)::int FROM jsonb_array_elements_text(COALESCE(mv -> 'dead', '[]'::jsonb)) e LOOP
        o_alive[t + 1] := false;
      END LOOP;
      FOR i IN 1 .. o_n LOOP
        IF NOT o_alive[i] THEN o_votes[i] := NULL; END IF;
      END LOOP;
      IF nx = 'over' THEN
        o_over := mv -> 'over';
        o_phase := NULL;
        o_settle := false;
      ELSIF nx = 'settle' THEN
        o_settle := false;
      ELSIF nx = 'witch' THEN
        o_phase := 'witch';
        o_acted := array_fill(false, ARRAY[o_n]);
      ELSIF nx = 'hunter' THEN
        o_after := CASE WHEN o_phase = 'day' THEN 'night' ELSE 'day' END;
        o_phase := 'hunter';
        o_hunter := (mv ->> 'hunter')::int;
        o_shot := NULL;
      ELSIF nx = 'day' THEN
        o_phase := 'day';
        o_votes := array_fill(NULL::int, ARRAY[o_n]);
      ELSE
        o_phase := 'night';
        o_night := o_night + 1;
        o_acted := array_fill(false, ARRAY[o_n]);
        o_votes := array_fill(NULL::int, ARRAY[o_n]);
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_masoi_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o_over IS NOT NULL THEN jsonb_build_object('winners', o_over -> 'winners', 'draw', false) END
    FROM public.game_masoi_run(p_room, NULL, NULL)
$$;

/* ---------- Sau khi có người chết ---------- */
-- p_dead: người chết trong bước này (trước khi tính chết theo). Trả nước { next } để ghi:
--   có Thợ săn trong số người chết → { next: 'hunter', hunter } (chưa xét thắng — phát bắn có thể đổi kết cục);
--   hết ván → { next: 'over', over: { team, winners, roles } }; không thì { next: p_next }.
-- p_settle (có người rời bàn): người chết theo không được bắn. Lộ vai: 'all' mọi người chết · 'hanged' người bị
-- treo cổ (p_hang) · Thợ săn sắp bắn luôn lộ.
CREATE OR REPLACE FUNCTION public.game_masoi_after(p_alive boolean[], p_dead int[], p_roles int[], p_mem int[],
  p_reveal text, p_hang int, p_settle boolean, p_next text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n       int := cardinality(p_alive);
  v_alive boolean[] := p_alive;
  v_dead  int[] := '{}';
  v_shown jsonb := '[]'::jsonb;
  v_a     int := p_mem[6];
  v_b     int := p_mem[7];
  v_hunt  int;
  v_w     int;
  v_o     int;
  v_team  text;
  v_win   int[];
  x       int;
BEGIN
  FOREACH x IN ARRAY p_dead LOOP
    IF v_alive[x + 1] THEN
      v_alive[x + 1] := false;
      v_dead := v_dead || x;
    END IF;
  END LOOP;
  -- Đôi tình nhân: một người chết thì người kia chết theo.
  IF v_a >= 0 AND v_alive[v_a + 1] <> v_alive[v_b + 1] THEN
    x := CASE WHEN v_alive[v_a + 1] THEN v_a ELSE v_b END;
    v_alive[x + 1] := false;
    v_dead := v_dead || x;
  END IF;
  IF NOT p_settle THEN
    v_hunt := (SELECT d FROM unnest(v_dead) d WHERE p_roles[d + 1] = 6 LIMIT 1);
  END IF;
  FOREACH x IN ARRAY v_dead LOOP
    IF p_reveal = 'all' OR (p_reveal = 'hanged' AND x = p_hang) OR x = v_hunt THEN
      v_shown := v_shown || jsonb_build_array(jsonb_build_array(x, p_roles[x + 1]));
    END IF;
  END LOOP;
  IF v_hunt IS NOT NULL THEN
    RETURN jsonb_build_object('next', 'hunter', 'hunter', v_hunt, 'dead', to_jsonb(v_dead), 'shown', v_shown, 'hang', p_hang);
  END IF;

  SELECT count(*) FILTER (WHERE v_alive[i] AND p_roles[i] IN (1, 2)), count(*) FILTER (WHERE v_alive[i] AND p_roles[i] NOT IN (1, 2))
    INTO v_w, v_o FROM generate_series(1, n) i;
  IF v_a >= 0 AND v_alive[v_a + 1] AND v_alive[v_b + 1] AND v_w + v_o = 2
     AND (p_roles[v_a + 1] IN (1, 2)) <> (p_roles[v_b + 1] IN (1, 2)) THEN
    v_team := 'lovers';
    v_win := ARRAY[LEAST(v_a, v_b), GREATEST(v_a, v_b)];
  ELSIF v_w = 0 THEN
    v_team := 'village';
    v_win := ARRAY(SELECT i - 1 FROM generate_series(1, n) i WHERE p_roles[i] NOT IN (1, 2) ORDER BY i);
  ELSIF v_w >= v_o THEN
    v_team := 'wolves';
    v_win := ARRAY(SELECT i - 1 FROM generate_series(1, n) i WHERE p_roles[i] IN (1, 2) ORDER BY i);
  END IF;
  IF v_team IS NOT NULL THEN
    RETURN jsonb_build_object('next', 'over', 'dead', to_jsonb(v_dead), 'shown', v_shown, 'hang', p_hang,
      'over', jsonb_build_object('team', v_team, 'winners', to_jsonb(v_win), 'roles', to_jsonb(p_roles)));
  END IF;
  RETURN jsonb_build_object('next', p_next, 'dead', to_jsonb(v_dead), 'shown', v_shown, 'hang', p_hang);
END;
$$;

/* ---------- Kiểm + điền nước (game_move 0078 gọi) ---------- */
CREATE OR REPLACE FUNCTION public.game_masoi_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_roles int[];
  v_acts  int[];
  v_mem   int[];
  v_role  int;
  v_rev   text;
  v_heal  boolean;
  v_dead  int[] := '{}';
  v_hang  int;
  v_wit   int;
  v_grd   int;
  v_cur   int;
  p       jsonb;
  t       int;
  b       int;
BEGIN
  SELECT * INTO r FROM game_masoi_run(p_room, p_seat, p_move);
  IF r.o_err IS NOT NULL THEN RAISE EXCEPTION '%', r.o_err; END IF;
  -- Phiếu và phát bắn là công khai: ghi đúng như gửi (đã chuẩn hoá).
  IF p_move ? 'vote' THEN RETURN jsonb_build_object('vote', game_masoi_pick(p_move -> 'vote')); END IF;
  IF p_move ? 'shoot' THEN RETURN jsonb_build_object('shoot', game_masoi_pick(p_move -> 'shoot')); END IF;

  SELECT cards INTO v_roles FROM game_hands WHERE room_id = p_room AND seat = -1;
  SELECT cards INTO v_acts FROM game_hands WHERE room_id = p_room AND seat = -2;
  SELECT cards INTO v_mem FROM game_hands WHERE room_id = p_room AND seat = -3;

  /* Lựa chọn ban đêm — kiểm theo vai, cất vào ghế -2, log chỉ ghi { night: true }. */
  IF p_move ? 'night' THEN
    v_role := v_roles[p_seat + 1];
    p := p_move -> 'night';
    t := game_masoi_pick(p -> 'target');
    IF r.o_phase = 'night' THEN
      IF v_role IN (1, 2) THEN
        IF t IS NULL OR t < 0 OR t >= r.o_n OR NOT r.o_alive[t + 1] OR v_roles[t + 1] IN (1, 2) THEN
          RAISE EXCEPTION 'games.err.badTarget';
        END IF;
        IF p -> 'curse' = 'true'::jsonb AND (v_role <> 2 OR v_mem[5] <> 1) THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
        v_acts[2 * p_seat + 1] := t;
        v_acts[2 * p_seat + 2] := CASE WHEN p -> 'curse' = 'true'::jsonb THEN 1 ELSE 0 END;
        UPDATE game_hands SET cards = cards || ARRAY[5, p_seat, t] WHERE room_id = p_room AND seat >= 0 AND cards[1] IN (1, 2);
      ELSIF v_role = 3 THEN
        IF t IS NULL OR t < 0 OR t >= r.o_n OR t = p_seat OR NOT r.o_alive[t + 1] THEN RAISE EXCEPTION 'games.err.badTarget'; END IF;
        UPDATE game_hands SET cards = cards || ARRAY[2, t, CASE WHEN v_roles[t + 1] IN (1, 2) THEN 1 ELSE 0 END]
         WHERE room_id = p_room AND seat = p_seat;
      ELSIF v_role = 4 THEN
        IF t IS NULL OR t < 0 OR t >= r.o_n OR NOT r.o_alive[t + 1] THEN RAISE EXCEPTION 'games.err.badTarget'; END IF;
        IF t = v_mem[1] THEN RAISE EXCEPTION 'games.err.guardTwice'; END IF;
        v_acts[2 * p_seat + 1] := t;
      ELSIF v_role = 8 AND r.o_night = 1 THEN
        t := game_masoi_pick(p -> 'pair' -> 0);
        b := game_masoi_pick(p -> 'pair' -> 1);
        IF t IS NULL OR b IS NULL OR t = b OR t < 0 OR b < 0 OR t >= r.o_n OR b >= r.o_n
           OR NOT r.o_alive[t + 1] OR NOT r.o_alive[b + 1] THEN
          RAISE EXCEPTION 'games.err.badTarget';
        END IF;
        v_mem[6] := t;
        v_mem[7] := b;
        UPDATE game_hands SET cards = cards || ARRAY[4, t, b] WHERE room_id = p_room AND seat IN (p_seat, t, b);
      END IF;
    ELSIF v_role = 5 THEN
      -- Bước Phù thủy: tối đa một bình mỗi đêm. Cứu được cả chính mình; không tự đầu độc.
      v_heal := COALESCE(p -> 'heal' = 'true'::jsonb, false);
      b := COALESCE(game_masoi_pick(p -> 'poison'), -1);
      IF v_heal AND b >= 0 THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
      IF (v_heal AND (v_mem[2] <> 1 OR v_mem[8] < 0)) OR (b >= 0 AND v_mem[3] <> 1) THEN RAISE EXCEPTION 'games.err.noPotion'; END IF;
      IF b >= 0 AND (b >= r.o_n OR b = p_seat OR NOT r.o_alive[b + 1]) THEN RAISE EXCEPTION 'games.err.badTarget'; END IF;
      IF v_heal THEN v_mem[2] := 0; END IF;
      IF b >= 0 THEN v_mem[3] := 0; END IF;
      v_acts[2 * p_seat + 1] := CASE WHEN v_heal THEN 1 ELSE 0 END;
      v_acts[2 * p_seat + 2] := b;
      UPDATE game_hands SET cards = game_masoi_drop(cards, ARRAY[6]) || ARRAY[6, v_mem[2], v_mem[3]]
       WHERE room_id = p_room AND seat = p_seat;
    END IF;
    UPDATE game_hands SET cards = v_acts WHERE room_id = p_room AND seat = -2;
    UPDATE game_hands SET cards = v_mem WHERE room_id = p_room AND seat = -3;
    RETURN '{"night": true}'::jsonb;
  END IF;

  /* { next } — chốt bước vừa xong. */
  v_rev := (SELECT options ->> 'reveal' FROM game_rooms WHERE id = p_room);
  IF v_rev IS NULL OR v_rev NOT IN ('all', 'hanged', 'none') THEN v_rev := 'all'; END IF;

  -- Có người vừa rời bàn: người đó coi như chết — tính chết theo + thắng thua trước, bước đang dở giữ nguyên.
  IF r.o_settle THEN
    RETURN game_masoi_after(r.o_alive, '{}', v_roles, v_mem, v_rev, -1, true, 'settle');
  END IF;

  -- Hết bước 1 của đêm: chốt nạn nhân của bầy Sói (nhiều phiếu nhất, hoà thì bốc ngẫu nhiên).
  IF r.o_phase = 'night' THEN
    v_mem[8] := COALESCE((
      SELECT v_acts[2 * w + 1] FROM generate_series(0, r.o_n - 1) w
       WHERE r.o_alive[w + 1] AND v_roles[w + 1] IN (1, 2) AND v_acts[2 * w + 1] >= 0 AND r.o_alive[v_acts[2 * w + 1] + 1]
       GROUP BY v_acts[2 * w + 1] ORDER BY count(*) DESC, random() LIMIT 1), -1);
    IF 5 = ANY(game_masoi_table(r.o_n)) THEN
      -- Có Phù thủy trong bộ vai: sang bước 2 (kể cả khi Phù thủy đã chết — để không lộ).
      v_wit := array_position(v_roles, 5) - 1;
      IF v_wit IS NOT NULL AND r.o_alive[v_wit + 1] THEN
        UPDATE game_hands SET cards = cards || ARRAY[3, v_mem[8], r.o_night] WHERE room_id = p_room AND seat = v_wit;
      END IF;
      UPDATE game_hands SET cards = v_mem WHERE room_id = p_room AND seat = -3;
      RETURN '{"next": "witch"}'::jsonb;
    END IF;
  END IF;

  -- Trời sáng: ai chết đêm qua.
  IF r.o_phase IN ('night', 'witch') THEN
    v_wit := array_position(v_roles, 5) - 1;
    v_grd := array_position(v_roles, 4) - 1;
    v_cur := array_position(v_roles, 2) - 1;
    t := v_mem[8];
    b := CASE WHEN v_grd IS NULL THEN -1 ELSE v_acts[2 * v_grd + 1] END;
    v_heal := v_wit IS NOT NULL AND v_acts[2 * v_wit + 1] = 1;
    IF t >= 0 AND t <> b AND NOT v_heal THEN
      IF v_cur IS NOT NULL AND r.o_alive[v_cur + 1] AND v_acts[2 * v_cur + 2] = 1 AND v_mem[5] = 1 THEN
        -- Sói nguyền: nạn nhân thành Sói, mất vai cũ (dữ kiện cũ giữ lại), biết mặt cả bầy.
        v_mem[5] := 0;
        UPDATE game_hands SET cards = cards || ARRAY[1, t, 0] WHERE room_id = p_room AND seat >= 0 AND cards[1] IN (1, 2);
        v_roles[t + 1] := 1;
        UPDATE game_hands SET cards = ARRAY[1] || cards[2:] || ARRAY[9, r.o_night, 0]
          || ARRAY(SELECT x FROM generate_series(1, r.o_n) w, unnest(ARRAY[1, w - 1, 0]) WITH ORDINALITY u(x, o)
                    WHERE v_roles[w] IN (1, 2) ORDER BY w, o)
         WHERE room_id = p_room AND seat = t;
        UPDATE game_hands SET cards = game_masoi_drop(cards, ARRAY[8]) || ARRAY[8, 0, 0] WHERE room_id = p_room AND seat = v_cur;
        UPDATE game_hands SET cards = v_roles WHERE room_id = p_room AND seat = -1;
      ELSIF v_roles[t + 1] = 7 AND v_mem[4] = 1 THEN
        v_mem[4] := 0; -- Già làng sống sót lần đầu bị cắn trúng
      ELSE
        v_dead := v_dead || t;
      END IF;
    END IF;
    IF v_wit IS NOT NULL AND v_acts[2 * v_wit + 2] >= 0 THEN v_dead := v_dead || v_acts[2 * v_wit + 2]; END IF;
    -- Bảo vệ không che lại người vừa che ở đêm sau.
    v_mem[1] := b;
    IF v_grd IS NOT NULL THEN
      UPDATE game_hands SET cards = game_masoi_drop(cards, ARRAY[7]) || ARRAY[7, b, 0] WHERE room_id = p_room AND seat = v_grd;
    END IF;
    v_mem[8] := -1;
    UPDATE game_hands SET cards = game_masoi_drop(cards, ARRAY[3, 5]) WHERE room_id = p_room AND seat >= 0;
    UPDATE game_hands SET cards = array_fill(-1, ARRAY[2 * r.o_n]) WHERE room_id = p_room AND seat = -2;
    UPDATE game_hands SET cards = v_mem WHERE room_id = p_room AND seat = -3;
    RETURN game_masoi_after(r.o_alive, v_dead, v_roles, v_mem, v_rev, -1, false, 'day');
  END IF;

  -- Hết ngày: treo cổ người nhiều phiếu nhất — phải hơn hẳn mọi lựa chọn khác, kể cả "bỏ qua".
  IF r.o_phase = 'day' THEN
    SELECT CASE WHEN count(*) = 1 THEN max(v) END INTO v_hang FROM (
      SELECT v, count(*) AS c, max(count(*)) OVER () AS top
        FROM unnest(r.o_votes) WITH ORDINALITY u(v, i)
       WHERE v IS NOT NULL AND r.o_alive[i::int]
       GROUP BY v) x
     WHERE c = top;
    v_hang := COALESCE(v_hang, -1);
    RETURN game_masoi_after(r.o_alive, CASE WHEN v_hang >= 0 THEN ARRAY[v_hang] ELSE '{}'::int[] END,
                            v_roles, v_mem, v_rev, v_hang, false, 'night');
  END IF;

  -- Thợ săn đã bắn (-1 = không bắn / đã rời bàn).
  RETURN game_masoi_after(r.o_alive, CASE WHEN r.o_shot >= 0 THEN ARRAY[r.o_shot] ELSE '{}'::int[] END,
                          v_roles, v_mem, v_rev, -1, false, r.o_after);
END;
$$;

REVOKE ALL ON FUNCTION public.game_masoi_pick(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_drop(int[], int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_table(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_after(boolean[], int[], int[], int[], text, int, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

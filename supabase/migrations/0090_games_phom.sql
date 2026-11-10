-- 0090_games_phom.sql — Phỏm / Tá lả: server chia bài, kiểm từng nước với bài thật, chấm điểm (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần bảng game_hands + game_start / game_move bản 0078 gọi game_<id>_deal / game_<id>_fill) và 0075
-- (game_finish tự tìm game_<id>_result). CHỈ THÊM HÀM, không đổi bảng / dữ liệu. Chạy lại được (CREATE OR REPLACE).
--
-- game_hands của phòng Phỏm: ghế ≥ 0 = bài đang cầm (sắp tăng dần; ăn / bốc thêm vào, đánh / hạ / gửi bớt ra) · ghế -1 =
-- nọc (bốc lá đầu). RLS 0078: đang chơi chỉ chủ bài đọc được tay mình, ghế âm không ai đọc.
-- Log (game_moves) chỉ có phần công khai: { deal } · { draw: true } · { eat: lá } · { discard: lá } · { lay, send } ·
-- { u, tron, discard } · { out } (game_leave / game_claim ghi).
--
-- Luật chép từ lib/games/phom.js (state công khai + referee / judge) — đổi một bên là phải đổi bên kia. phom.test.js
-- chạy trọng tài JS trên đúng bộ ván mẫu trong supabase/manual/0090_games_phom_check.sql; file kiểm chạy các ván đó qua
-- game_phom_fill / game_phom_result trên DB thật. Mã lỗi RAISE là key i18n games.err.*, THỨ TỰ KIỂM khớp referee().

BEGIN;

-- Dọn bản Phỏm cũ (nhánh feat/games trước khi gộp, cùng số 0090): nếu DB đã chạy bản đó thì còn các hàm dưới đây.
-- game_move (0078) tự gọi game_<id>_check nếu hàm tồn tại → game_phom_check cũ sẽ kiểm nước của bản này bằng luật cũ
-- và chặn sai. Bản này không có _check / _run / … nên xoá hẳn. deal / fill / result cùng chữ ký → CREATE OR REPLACE đè.
-- DB chưa từng chạy bản cũ: IF EXISTS bỏ qua. Chỉ xoá hàm, không đụng data.
DROP FUNCTION IF EXISTS public.game_phom_check(uuid, int, jsonb);
DROP FUNCTION IF EXISTS public.game_phom_run(uuid, int, jsonb);
DROP FUNCTION IF EXISTS public.game_phom_groups_ok(jsonb, int[], jsonb, int);
DROP FUNCTION IF EXISTS public.game_phom_locks(uuid, int);
DROP FUNCTION IF EXISTS public.game_phom_ints(jsonb);
DROP FUNCTION IF EXISTS public.game_phom_ok(int[]);
DROP FUNCTION IF EXISTS public.game_phom_val(int);

/* ---------- Tiện ích thuần ---------- */

-- Số nguyên trong jsonb (kể cả viết 5.0), khác → NULL.
CREATE OR REPLACE FUNCTION public.game_phom_int(p jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(p) = 'number' AND (p #>> '{}')::numeric = trunc((p #>> '{}')::numeric)
                   AND abs((p #>> '{}')::numeric) < 1000000 THEN (p #>> '{}')::numeric::int END
$$;

-- Phỏm hợp lệ (như meldOk): ≥ 3 lá khác nhau 0..51, cùng hạng — hoặc cùng chất và hạng liên tiếp (A thấp nhất, không vòng).
CREATE OR REPLACE FUNCTION public.game_phom_meld(p int[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(cardinality(p), 0) >= 3
     AND NOT EXISTS (SELECT 1 FROM unnest(p) x WHERE x IS NULL OR x < 0 OR x > 51)
     AND (SELECT count(DISTINCT x) FROM unnest(p) x) = cardinality(p)
     AND ((SELECT count(DISTINCT x / 4) FROM unnest(p) x) = 1
          OR ((SELECT count(DISTINCT x % 4) FROM unnest(p) x) = 1
              AND (SELECT max(x / 4) - min(x / 4) FROM unnest(p) x) = cardinality(p) - 1))
$$;

-- Như cover(): xếp được mọi lá ăn vào các phỏm 3 lá rời nhau, mỗi phỏm một lá ăn + hai lá trên tay (không gồm lá ăn).
CREATE OR REPLACE FUNCTION public.game_phom_cover(p_hand int[], p_eaten int[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  e  int;
  r  int;
  s  int;
  a  int;
  b  int;
  pr int[];
BEGIN
  IF COALESCE(cardinality(p_eaten), 0) = 0 THEN RETURN true; END IF;
  e := p_eaten[1];
  r := e / 4;
  s := e % 4;
  -- Bộ: hai lá cùng hạng trên tay.
  FOR a, b IN SELECT x, y FROM unnest(p_hand) x, unnest(p_hand) y WHERE x < y AND x / 4 = r AND y / 4 = r LOOP
    IF game_phom_cover(array_remove(array_remove(p_hand, a), b), p_eaten[2:]) THEN RETURN true; END IF;
  END LOOP;
  -- Dây: hai lá cùng chất ở hạng (r-2, r-1) · (r-1, r+1) · (r+1, r+2).
  FOREACH pr SLICE 1 IN ARRAY ARRAY[[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]] LOOP
    CONTINUE WHEN pr[1] < 0 OR pr[2] > 12;
    a := pr[1] * 4 + s;
    b := pr[2] * 4 + s;
    IF a = ANY(p_hand) AND b = ANY(p_hand)
       AND game_phom_cover(array_remove(array_remove(p_hand, a), b), p_eaten[2:]) THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- Ù khan (như khanOf): không có hai lá cùng hạng, hay cùng chất cách nhau ≤ 2 hạng.
CREATE OR REPLACE FUNCTION public.game_phom_khan(p int[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest(p) x, unnest(p) y
                      WHERE x < y AND (x / 4 = y / 4 OR (x % 4 = y % 4 AND abs(x / 4 - y / 4) <= 2)))
$$;

-- Mảng các phỏm (jsonb) → mỗi phỏm sắp tăng dần (như normMelds). Sai dạng — không phải mảng các mảng số nguyên 0..51
-- (như meldsShape) — trả NULL. Phỏm rỗng giữ nguyên [] để game_phom_meld báo badMeld như JS.
CREATE OR REPLACE FUNCTION public.game_phom_melds(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  m   jsonb;
  res jsonb := '[]';
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  FOR m IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(m) x
                WHERE game_phom_int(x) IS NULL OR game_phom_int(x) < 0 OR game_phom_int(x) > 51) THEN
      RETURN NULL;
    END IF;
    res := res || jsonb_build_array(COALESCE((SELECT jsonb_agg(game_phom_int(x) ORDER BY game_phom_int(x)) FROM jsonb_array_elements(m) x), '[]'::jsonb));
  END LOOP;
  RETURN res;
END;
$$;

-- Lá trong một phỏm (jsonb) → int[].
CREATE OR REPLACE FUNCTION public.game_phom_cards(p jsonb)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
AS $$ SELECT COALESCE(ARRAY(SELECT game_phom_int(x) FROM jsonb_array_elements(p) x), '{}') $$;

-- Người kế tiếp còn chơi sau p_from (như nextActive): chưa rời, chưa xong (đã hạ và chồng đủ 4 lá). Không còn ai → NULL.
CREATE OR REPLACE FUNCTION public.game_phom_next(p_n int, p_out boolean[], p_order int[], p_pile int[], p_from int)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k int;
  y int;
BEGIN
  FOR k IN 1 .. p_n LOOP
    y := (p_from + k) % p_n;
    IF NOT p_out[y + 1] AND NOT (y = ANY(p_order) AND p_pile[y + 1] >= 4) THEN RETURN y; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

/* ---------- Chia bài (game_start 0078 gọi) ---------- */
-- Xào 52 lá bằng random() của server. Người đi đầu 10 lá, còn lại 9, phần dư úp làm nọc (ghế -1). Ván chơi lại (phòng
-- trước có next_room trỏ về đây) mà người về Nhất ván trước còn ngồi → người đó đi đầu; không thì bốc ngẫu nhiên.
-- Ù khan xét từ người đi đầu theo vòng. Nước 1 = { deal: { first, n, stock, khan } }.
CREATE OR REPLACE FUNCTION public.game_phom_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deck  int[];
  v_n     int;
  v_first int;
  v_khan  int;
  v_prev  game_rooms;
  v_club  uuid;
  v_mem   uuid;
  v_pos   int := 0;
  k       int;
  i       int;
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
  IF v_first IS NULL THEN v_first := floor(random() * v_n)::int; END IF;

  v_deck := ARRAY(SELECT c FROM generate_series(0, 51) c ORDER BY random());
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    k := CASE WHEN r.seat = v_first THEN 10 ELSE 9 END;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    VALUES (p_room, r.seat, r.member_id, r.club_id, ARRAY(SELECT x FROM unnest(v_deck[v_pos + 1 : v_pos + k]) x ORDER BY x))
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_pos := v_pos + k;
    v_club := r.club_id;
    v_mem := r.member_id;
  END LOOP;
  -- Ghế âm: member_id bắt buộc nên ghi tạm người ngồi cuối — RLS không cho ai đọc ghế âm.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, -1, v_mem, v_club, v_deck[v_pos + 1 :])
  ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;

  FOR i IN 0 .. v_n - 1 LOOP
    IF game_phom_khan((SELECT cards FROM game_hands WHERE room_id = p_room AND seat = (v_first + i) % v_n)) THEN
      v_khan := (v_first + i) % v_n;
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_first, jsonb_build_object('deal', jsonb_build_object(
    'first', v_first,
    'n', (SELECT jsonb_agg(CASE WHEN s = v_first THEN 10 ELSE 9 END ORDER BY s) FROM generate_series(0, v_n - 1) s),
    'stock', 52 - v_pos,
    'khan', v_khan)));
END;
$$;

/* ---------- Dựng lại phần ai cũng thấy (như apply ở JS) ---------- */
-- Log chỉ có nước server đã kiểm (game_phom_fill) nên ở đây áp thẳng, không kiểm lại.
-- o_pile = số lá trong chồng bài trước mặt từng người · o_last = lá vừa đánh còn ăn được (NULL = không có) ·
-- o_ec / o_eby / o_efrom / o_echot = các lá đã ăn: lá, người ăn, người bị ăn, ăn chốt · o_melds = phỏm đã hạ theo ghế
-- (null = chưa hạ) · o_order = thứ tự hạ · o_u = { seat, tron, khan } khi có người ù.
CREATE OR REPLACE FUNCTION public.game_phom_run(p_room uuid,
  OUT o_n int, OUT o_first int, OUT o_out boolean[], OUT o_left int[], OUT o_counts int[], OUT o_stock int,
  OUT o_pile int[], OUT o_turn int, OUT o_step text, OUT o_last int, OUT o_lseat int, OUT o_lchot boolean,
  OUT o_ec int[], OUT o_eby int[], OUT o_efrom int[], OUT o_echot boolean[],
  OUT o_melds jsonb, OUT o_order int[], OUT o_mom boolean[], OUT o_over boolean, OUT o_u jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m     record;
  mv    jsonb;
  s     int;
  c     int;
  v_to  int;
  v_k   int;
  v_new int[];
  x     jsonb;
  v_gone int;
BEGIN
  o_over := false;
  o_left := '{}'; o_ec := '{}'; o_eby := '{}'; o_efrom := '{}'; o_echot := '{}'; o_order := '{}';
  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    mv := m.move;
    s := m.seat;
    IF o_over THEN CONTINUE; END IF;

    IF mv ? 'deal' THEN
      o_n := jsonb_array_length(mv -> 'deal' -> 'n');
      o_first := (mv -> 'deal' ->> 'first')::int;
      o_out := array_fill(false, ARRAY[o_n]);
      o_counts := ARRAY(SELECT game_phom_int(e) FROM jsonb_array_elements(mv -> 'deal' -> 'n') e);
      o_stock := (mv -> 'deal' ->> 'stock')::int;
      o_pile := array_fill(0, ARRAY[o_n]);
      o_turn := o_first;
      o_step := 'discard';
      o_melds := to_jsonb(array_fill(NULL::int, ARRAY[o_n]));
      o_mom := array_fill(false, ARRAY[o_n]);
      IF jsonb_typeof(mv -> 'deal' -> 'khan') = 'number' THEN
        o_over := true; o_turn := NULL; o_step := NULL;
        o_u := jsonb_build_object('seat', (mv -> 'deal' ->> 'khan')::int, 'tron', false, 'khan', true);
      END IF;
      CONTINUE;
    END IF;
    IF o_n IS NULL THEN CONTINUE; END IF;

    IF mv -> 'out' = 'true'::jsonb THEN
      o_out[s + 1] := true;
      o_left := o_left || s;
      IF o_lseat = s THEN o_last := NULL; END IF;
      IF (SELECT count(*) FROM unnest(o_out) z WHERE NOT z) <= 1 THEN
        o_over := true; o_turn := NULL; o_step := NULL;
      ELSIF o_turn = s THEN
        o_turn := game_phom_next(o_n, o_out, o_order, o_pile, s);
        IF o_turn IS NULL THEN o_over := true; o_step := NULL; ELSE o_step := 'take'; END IF;
      END IF;
      CONTINUE;
    END IF;

    IF mv -> 'draw' = 'true'::jsonb THEN
      o_counts[s + 1] := o_counts[s + 1] + 1;
      o_stock := o_stock - 1;
      o_step := CASE WHEN NOT s = ANY(o_order) AND o_pile[s + 1] = 3 THEN 'lay' ELSE 'discard' END;
      CONTINUE;
    END IF;

    IF mv ? 'eat' THEN
      c := game_phom_int(mv -> 'eat');
      o_ec := o_ec || c; o_eby := o_eby || s; o_efrom := o_efrom || o_lseat; o_echot := o_echot || o_lchot;
      -- Chuyển bài: lá rời chồng người bị ăn; lá trên cùng chồng người ăn chuyển sang (người ăn chưa đánh lá nào thì thôi).
      o_pile[o_lseat + 1] := o_pile[o_lseat + 1] - 1;
      IF o_pile[s + 1] > 0 THEN
        o_pile[s + 1] := o_pile[s + 1] - 1;
        o_pile[o_lseat + 1] := o_pile[o_lseat + 1] + 1;
      END IF;
      o_last := NULL;
      o_counts[s + 1] := o_counts[s + 1] + 1;
      o_step := CASE WHEN NOT s = ANY(o_order) AND o_pile[s + 1] = 3 THEN 'lay' ELSE 'discard' END;
      CONTINUE;
    END IF;

    IF mv ? 'u' THEN
      o_over := true; o_turn := NULL; o_step := NULL;
      o_u := jsonb_build_object('seat', s, 'tron', (mv ->> 'tron')::boolean, 'khan', false);
      CONTINUE;
    END IF;

    IF mv ? 'lay' THEN
      o_melds := jsonb_set(o_melds, ARRAY[s::text], mv -> 'lay');
      v_gone := (SELECT count(*) FROM jsonb_array_elements(mv -> 'lay') q, jsonb_array_elements(q) z);
      FOR x IN SELECT value FROM jsonb_array_elements(COALESCE(mv -> 'send', '[]')) LOOP
        v_to := game_phom_int(x -> 0);
        v_k := game_phom_int(x -> 1);
        c := game_phom_int(x -> 2);
        v_new := ARRAY(SELECT y FROM unnest(game_phom_cards(o_melds -> v_to -> v_k) || c) y ORDER BY y);
        o_melds := jsonb_set(o_melds, ARRAY[v_to::text, v_k::text], to_jsonb(v_new));
        v_gone := v_gone + 1;
      END LOOP;
      o_order := o_order || s;
      o_mom[s + 1] := jsonb_array_length(mv -> 'lay') = 0;
      o_counts[s + 1] := o_counts[s + 1] - v_gone;
      o_step := 'discard';
      CONTINUE;
    END IF;

    IF mv ? 'discard' THEN
      c := game_phom_int(mv -> 'discard');
      o_pile[s + 1] := o_pile[s + 1] + 1;
      o_counts[s + 1] := o_counts[s + 1] - 1;
      o_last := c; o_lseat := s; o_lchot := s = ANY(o_order);  -- đánh sau khi đã hạ = lá chốt
      o_turn := game_phom_next(o_n, o_out, o_order, o_pile, s);
      IF o_turn IS NULL THEN o_over := true; o_step := NULL; ELSE o_step := 'take'; END IF;
    END IF;
  END LOOP;
END;
$$;

/* ---------- Kiểm + điền nước (game_move 0078 gọi) — như referee() ở JS ---------- */
CREATE OR REPLACE FUNCTION public.game_phom_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_hand  int[];
  v_pend  int[];
  v_non   int[];
  v_stock int[];
  v_melds jsonb;
  v_all   int[];
  v_send  jsonb;
  v_work  jsonb;
  v_sent  int[] := '{}';
  v_new   int[];
  v_tron  boolean;
  v_disc  int;
  v_to    int;
  v_k     int;
  c       int;
  x       jsonb;
BEGIN
  IF jsonb_typeof(p_move) IS DISTINCT FROM 'object' OR p_move ? 'out' OR p_move ? 'deal' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  SELECT * INTO r FROM game_phom_run(p_room);
  IF r.o_n IS NULL THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  IF r.o_over THEN RAISE EXCEPTION 'games.err.over'; END IF;
  IF p_seat IS DISTINCT FROM r.o_turn THEN RAISE EXCEPTION 'games.err.notYourTurn'; END IF;

  SELECT cards INTO v_hand FROM game_hands WHERE room_id = p_room AND seat = p_seat;
  v_hand := COALESCE(v_hand, '{}');
  -- Lá ăn chưa hạ: chưa hạ thì là mọi lá người này đã ăn.
  v_pend := CASE WHEN p_seat = ANY(r.o_order) THEN '{}'::int[]
                 ELSE ARRAY(SELECT r.o_ec[i] FROM generate_subscripts(r.o_ec, 1) i WHERE r.o_eby[i] = p_seat ORDER BY i) END;
  v_non := ARRAY(SELECT y FROM unnest(v_hand) y WHERE NOT y = ANY(v_pend));

  /* Bốc nọc: lá đầu nọc vào tay, log không lộ lá. */
  IF p_move -> 'draw' = 'true'::jsonb THEN
    IF r.o_step IS DISTINCT FROM 'take' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    SELECT cards INTO v_stock FROM game_hands WHERE room_id = p_room AND seat = -1;
    IF COALESCE(cardinality(v_stock), 0) = 0 THEN RAISE EXCEPTION 'games.err.pileEmpty'; END IF;
    UPDATE game_hands SET cards = v_stock[2:] WHERE room_id = p_room AND seat = -1;
    UPDATE game_hands SET cards = ARRAY(SELECT y FROM unnest(v_hand || v_stock[1]) y ORDER BY y) WHERE room_id = p_room AND seat = p_seat;
    RETURN '{"draw": true}'::jsonb;
  END IF;

  /* Ăn lá vừa đánh: vẫn phải xếp được mọi lá ăn vào các phỏm rời nhau. */
  IF p_move -> 'eat' = 'true'::jsonb THEN
    IF r.o_step IS DISTINCT FROM 'take' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    IF r.o_last IS NULL THEN RAISE EXCEPTION 'games.err.nothingToEat'; END IF;
    IF NOT game_phom_cover(v_non, v_pend || r.o_last) THEN RAISE EXCEPTION 'games.err.cantEat'; END IF;
    UPDATE game_hands SET cards = ARRAY(SELECT y FROM unnest(v_hand || r.o_last) y ORDER BY y) WHERE room_id = p_room AND seat = p_seat;
    RETURN jsonb_build_object('eat', r.o_last);
  END IF;

  /* Ù và hạ dùng chung bước kiểm cách xếp phỏm (như meldsErr: dạng → phỏm → trùng → trên tay → lá ăn). */
  IF p_move ? 'u' OR p_move ? 'lay' THEN
    IF p_move ? 'u' THEN
      IF r.o_step IS DISTINCT FROM 'discard' AND r.o_step IS DISTINCT FROM 'lay' OR p_seat = ANY(r.o_order) THEN
        RAISE EXCEPTION 'games.err.badMove';
      END IF;
      v_melds := game_phom_melds(p_move -> 'u');
    ELSE
      IF r.o_step IS DISTINCT FROM 'lay' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
      v_melds := game_phom_melds(p_move -> 'lay');
    END IF;
    IF v_melds IS NULL THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_melds) q WHERE NOT game_phom_meld(game_phom_cards(q))) THEN
      RAISE EXCEPTION 'games.err.badMeld';
    END IF;
    v_all := ARRAY(SELECT game_phom_int(z) FROM jsonb_array_elements(v_melds) q, jsonb_array_elements(q) z);
    IF (SELECT count(DISTINCT y) FROM unnest(v_all) y) <> cardinality(v_all) THEN RAISE EXCEPTION 'games.err.badMeld'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_all) y WHERE NOT y = ANY(v_hand)) THEN RAISE EXCEPTION 'games.err.notYourCard'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_pend) p
                WHERE (SELECT count(*) FROM jsonb_array_elements(v_melds) q WHERE p = ANY(game_phom_cards(q))) <> 1)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_melds) q
                   WHERE (SELECT count(*) FROM unnest(game_phom_cards(q)) y WHERE y = ANY(v_pend)) > 1) THEN
      RAISE EXCEPTION 'games.err.eatenMeld';
    END IF;

    IF p_move ? 'u' THEN
      IF cardinality(v_all) < cardinality(v_hand) - 1 THEN RAISE EXCEPTION 'games.err.notU'; END IF;
      v_tron := cardinality(v_all) = cardinality(v_hand);
      IF NOT v_tron THEN v_disc := (SELECT y FROM unnest(v_hand) y WHERE NOT y = ANY(v_all) ORDER BY y LIMIT 1); END IF;
      RETURN jsonb_build_object('u', v_melds, 'tron', v_tron, 'discard', v_disc);
    END IF;

    -- Gửi bài vào phỏm đã hạ của người khác (như layErr).
    v_send := p_move -> 'send';
    IF v_send IS NULL OR v_send = 'null'::jsonb THEN v_send := '[]'; END IF;
    IF jsonb_typeof(v_send) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    IF jsonb_array_length(v_send) > 0 AND jsonb_array_length(v_melds) = 0 THEN RAISE EXCEPTION 'games.err.momSend'; END IF;
    v_work := r.o_melds;
    FOR x IN SELECT value FROM jsonb_array_elements(v_send) LOOP
      IF jsonb_typeof(x) IS DISTINCT FROM 'array' OR jsonb_array_length(x) <> 3
         OR game_phom_int(x -> 0) IS NULL OR game_phom_int(x -> 1) IS NULL OR game_phom_int(x -> 2) IS NULL THEN
        RAISE EXCEPTION 'games.err.badSend';
      END IF;
      v_to := game_phom_int(x -> 0);
      v_k := game_phom_int(x -> 1);
      c := game_phom_int(x -> 2);
      IF v_to = p_seat OR v_to < 0 OR v_to >= r.o_n OR jsonb_typeof(v_work -> v_to) IS DISTINCT FROM 'array'
         OR v_k < 0 OR v_k >= jsonb_array_length(v_work -> v_to) THEN
        RAISE EXCEPTION 'games.err.badSend';
      END IF;
      IF c < 0 OR c > 51 OR c = ANY(v_all) OR c = ANY(v_sent) OR c = ANY(v_pend) OR NOT c = ANY(v_hand) THEN
        RAISE EXCEPTION 'games.err.badSend';
      END IF;
      v_new := ARRAY(SELECT y FROM unnest(game_phom_cards(v_work -> v_to -> v_k) || c) y ORDER BY y);
      IF NOT game_phom_meld(v_new) THEN RAISE EXCEPTION 'games.err.badSend'; END IF;
      v_work := jsonb_set(v_work, ARRAY[v_to::text, v_k::text], to_jsonb(v_new));
      v_sent := v_sent || c;
    END LOOP;
    -- Hạ / gửi xong vẫn phải còn ít nhất một lá để đánh (phủ hết bài là ù, không phải hạ).
    IF cardinality(v_all) + cardinality(v_sent) > cardinality(v_hand) - 1 THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    UPDATE game_hands SET cards = ARRAY(SELECT y FROM unnest(v_hand) y WHERE NOT y = ANY(v_all) AND NOT y = ANY(v_sent) ORDER BY y)
     WHERE room_id = p_room AND seat = p_seat;
    RETURN jsonb_build_object('lay', v_melds, 'send', v_send);
  END IF;

  /* Đánh một lá: phải có trên tay, không phải lá ăn, và vẫn giữ được phỏm cho mọi lá ăn chưa hạ. */
  IF p_move ? 'discard' THEN
    IF r.o_step IS DISTINCT FROM 'discard' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
    c := game_phom_int(p_move -> 'discard');
    IF c IS NULL OR NOT c = ANY(v_hand) THEN RAISE EXCEPTION 'games.err.notYourCard'; END IF;
    IF c = ANY(v_pend) OR NOT game_phom_cover(array_remove(v_non, c), v_pend) THEN RAISE EXCEPTION 'games.err.keepEaten'; END IF;
    UPDATE game_hands SET cards = array_remove(v_hand, c) WHERE room_id = p_room AND seat = p_seat;
    RETURN jsonb_build_object('discard', c);
  END IF;

  RAISE EXCEPTION 'games.err.badMove';
END;
$$;

/* ---------- Chấm ván (game_finish 0075 gọi) — như judge() ở JS ---------- */
-- Ăn bài: người bị ăn trả người ăn 1 (ăn chốt 4). Ù: mỗi người trả 5 (ù tròn 10, ù khan 5); người ù đã ăn ≥ 3 lá của cùng
-- một người thì người đó (ghế nhỏ nhất nếu nhiều) đền thay cả làng. Không ai ù: điểm rác = tổng hạng + 1 bài còn trên tay;
-- xếp người còn ngồi theo (móm sau, ít điểm trước, hạ trước), rồi người rời (rời trước đứng dưới); Nhì −1, Ba −2, người
-- cuối −3, móm −4 — Nhất nhận tổng. NULL khi ván chưa xong.
CREATE OR REPLACE FUNCTION public.game_phom_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_pay   int[];
  v_pts   int[];
  v_ranks int[];
  v_amt   int;
  v_w     int;
  v_den   int;
  i       int;
  x       int;
BEGIN
  SELECT * INTO r FROM game_phom_run(p_room);
  IF r.o_n IS NULL OR NOT r.o_over THEN RETURN NULL; END IF;
  v_pay := array_fill(0, ARRAY[r.o_n]);
  FOR i IN 1 .. COALESCE(cardinality(r.o_ec), 0) LOOP
    v_amt := CASE WHEN r.o_echot[i] THEN 4 ELSE 1 END;
    v_pay[r.o_efrom[i] + 1] := v_pay[r.o_efrom[i] + 1] - v_amt;
    v_pay[r.o_eby[i] + 1] := v_pay[r.o_eby[i] + 1] + v_amt;
  END LOOP;

  IF r.o_u IS NOT NULL THEN
    v_w := (r.o_u ->> 'seat')::int;
    v_amt := CASE WHEN (r.o_u ->> 'tron')::boolean THEN 10 ELSE 5 END;
    SELECT f INTO v_den FROM (
      SELECT r.o_efrom[j] AS f, count(*) AS k FROM generate_subscripts(r.o_ec, 1) j WHERE r.o_eby[j] = v_w GROUP BY 1
    ) q WHERE k >= 3 ORDER BY f LIMIT 1;
    FOR x IN 0 .. r.o_n - 1 LOOP
      CONTINUE WHEN x = v_w;
      v_pay[COALESCE(v_den, x) + 1] := v_pay[COALESCE(v_den, x) + 1] - v_amt;
      v_pay[v_w + 1] := v_pay[v_w + 1] + v_amt;
    END LOOP;
    v_ranks := ARRAY[v_w] || ARRAY(SELECT y FROM generate_series(0, r.o_n - 1) y WHERE y <> v_w ORDER BY y);
    RETURN jsonb_build_object('winners', jsonb_build_array(v_w), 'draw', false, 'ranks', to_jsonb(v_ranks),
      'scores', (SELECT jsonb_object_agg(s::text, v_pay[s + 1]) FROM generate_series(0, r.o_n - 1) s), 'u', r.o_u);
  END IF;

  v_pts := ARRAY(SELECT COALESCE((SELECT sum(c / 4 + 1) FROM game_hands h, unnest(h.cards) c WHERE h.room_id = p_room AND h.seat = s), 0)::int
                   FROM generate_series(0, r.o_n - 1) s ORDER BY s);
  v_ranks := ARRAY(SELECT s FROM generate_series(0, r.o_n - 1) s WHERE NOT r.o_out[s + 1]
                    ORDER BY r.o_mom[s + 1], v_pts[s + 1], COALESCE(array_position(r.o_order, s), 99), s)
          || ARRAY(SELECT y FROM unnest(r.o_left) WITH ORDINALITY AS q(y, k) ORDER BY k DESC);
  FOR i IN 2 .. r.o_n LOOP
    x := v_ranks[i];
    v_amt := CASE WHEN r.o_mom[x + 1] THEN 4 WHEN i = r.o_n THEN 3 ELSE i - 1 END;
    v_pay[x + 1] := v_pay[x + 1] - v_amt;
    v_pay[v_ranks[1] + 1] := v_pay[v_ranks[1] + 1] + v_amt;
  END LOOP;
  RETURN jsonb_build_object('winners', jsonb_build_array(v_ranks[1]), 'draw', false, 'ranks', to_jsonb(v_ranks),
    'scores', (SELECT jsonb_object_agg(s::text, v_pay[s + 1]) FROM generate_series(0, r.o_n - 1) s),
    'points', (SELECT jsonb_object_agg(s::text, v_pts[s + 1]) FROM generate_series(0, r.o_n - 1) s WHERE NOT r.o_out[s + 1]));
END;
$$;

REVOKE ALL ON FUNCTION public.game_phom_int(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_meld(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_cover(int[], int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_khan(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_melds(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_cards(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_next(int, boolean[], int[], int[], int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_phom_result(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

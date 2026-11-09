-- 0087_games_masoi_roles.sql — Ma sói: chủ phòng tự chọn bộ vai (docs/GAMES.md §12). Chạy sau 0086.
--
-- Chủ dự án chốt 2026-11-09: lúc tạo phòng chọn "Tự động" (bảng theo số người như 0084) hoặc "Tự chọn": số Sói thường
-- + bật / tắt từng vai đặc biệt (mỗi vai tối đa 1), ai dư là Dân làng. Lúc bắt đầu server xáo bộ vai rồi chia ngẫu nhiên
-- — không ai biết trước ai cầm vai gì, chỉ biết bàn có những vai nào. Bộ vai lưu ở options.roles của phòng.
--
-- THÊM game_masoi_deck(options, n) — luật: ít nhất 1 Sói; không quá n vai; Sói ít hơn số người còn lại. Sai thì RAISE
--   games.err.noWolf / tooManyRoles / tooManyWolves → game_start (0078) huỷ cả lượt bắt đầu, phòng vẫn chờ.
-- SỬA game_masoi_deal (chép 0084) — chia theo game_masoi_deck thay cho game_masoi_table.
-- SỬA game_masoi_fill (chép 0086) — có bước Phù thủy hay không theo bộ vai của phòng, không theo bảng tự động.
-- Chỗ đổi có ghi chú "0087". Phòng không có options.roles chạy y như trước. Không đụng bảng / dữ liệu. Chạy lại được.
-- Kiểm: supabase/manual/0087_games_masoi_roles_check.sql.

BEGIN;
-- Bộ vai của ván p_n người — như deckOf ở lib/games/masoi.js. options.roles = các vai KHÔNG phải Dân làng (1 Sói thường
-- lặp được; 2..8 tối đa một), thiếu thì bù Dân làng (0). Không có / sai dạng → bảng tự động game_masoi_table.
CREATE OR REPLACE FUNCTION public.game_masoi_deck(p_opts jsonb, p_n int)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  j   jsonb := p_opts -> 'roles';
  v   int[];
  v_w int;
BEGIN
  -- Dạng như rolesOf: mảng 1..12 phần tử, mỗi phần tử là số nguyên 1..8 (CASE để không ép kiểu chữ sang số).
  IF jsonb_typeof(j) = 'array' AND jsonb_array_length(j) BETWEEN 1 AND 12
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) e
                      WHERE CASE WHEN jsonb_typeof(e) = 'number'
                                 THEN (e::text)::numeric NOT BETWEEN 1 AND 8 OR (e::text)::numeric <> trunc((e::text)::numeric)
                                 ELSE true END) THEN
    v := ARRAY(SELECT (e::text)::numeric::int FROM jsonb_array_elements(j) e);
    -- Vai khác Sói thường không được lặp.
    IF (SELECT count(*) FROM unnest(v) x WHERE x <> 1) <> (SELECT count(DISTINCT x) FROM unnest(v) x WHERE x <> 1) THEN
      v := NULL;
    END IF;
  END IF;
  IF v IS NULL THEN RETURN game_masoi_table(p_n); END IF;

  v_w := (SELECT count(*) FROM unnest(v) x WHERE x IN (1, 2));
  IF v_w = 0 THEN RAISE EXCEPTION 'games.err.noWolf'; END IF;
  IF cardinality(v) > p_n THEN RAISE EXCEPTION 'games.err.tooManyRoles'; END IF;
  -- Sói phải ít hơn số người còn lại, không thì vừa chia đã thắng.
  IF 2 * v_w >= p_n THEN RAISE EXCEPTION 'games.err.tooManyWolves'; END IF;
  RETURN v || array_fill(0, ARRAY[p_n - cardinality(v)]);
END;
$$;

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
  -- 0087: bộ vai theo tuỳ chọn phòng (tự chọn hoặc bảng tự động) — sai luật thì RAISE, game_start huỷ cả lượt bắt đầu.
  v_roles := ARRAY(SELECT x FROM unnest(game_masoi_deck((SELECT options FROM game_rooms WHERE id = p_room), v_n)) x ORDER BY random());
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
        -- 0086: được cắn bất kỳ ai còn sống, kể cả Sói và chính mình (0084 chặn Sói cắn Sói).
        IF t IS NULL OR t < 0 OR t >= r.o_n OR NOT r.o_alive[t + 1] THEN
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
    -- 0087: theo bộ vai của phòng (tự chọn có thể có Phù thủy dù ít người) — vẫn không theo ai còn sống, để không lộ.
    IF 5 = ANY(game_masoi_deck((SELECT options FROM game_rooms WHERE id = p_room), r.o_n)) THEN
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
      -- 0086: nạn nhân đã là Sói thì lời nguyền không có tác dụng, KHÔNG mất lượt nguyền — chết như thường.
      IF v_cur IS NOT NULL AND r.o_alive[v_cur + 1] AND v_acts[2 * v_cur + 2] = 1 AND v_mem[5] = 1
         AND v_roles[t + 1] NOT IN (1, 2) THEN
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

REVOKE ALL ON FUNCTION public.game_masoi_deck(jsonb, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_masoi_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

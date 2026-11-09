-- 0086_games_masoi_wolfbite.sql — Ma sói: Sói được cắn cả Sói (docs/GAMES.md §12). Chạy sau 0084.
--
-- Luật mới (chủ dự án chốt 2026-11-09): ban đêm bầy Sói được chọn cắn BẤT KỲ ai còn sống — kể cả đồng đội và chính
-- mình (hy sinh một con để đánh lạc hướng cả làng). Bản 0084 từ chối nước đó (games.err.badTarget).
--   - Nạn nhân là Sói: chết như thường. Bảo vệ che được, Phù thủy cứu được (họ không biết đó là Sói).
--   - Sói nguyền dùng lời nguyền mà nạn nhân đã là Sói: lời nguyền không có tác dụng, KHÔNG mất lượt nguyền, nạn
--     nhân chết như thường (đã là Sói thì không còn gì để "hoá Sói").
--
-- SỬA game_masoi_fill: chép nguyên bản 0084, chỉ đổi đúng 2 chỗ có ghi chú "0086". Các hàm khác của 0084 giữ nguyên.
-- Không đụng bảng / dữ liệu. Chạy lại được (CREATE OR REPLACE). Kiểm: supabase/manual/0086_games_masoi_wolfbite_check.sql.

BEGIN;
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

REVOKE ALL ON FUNCTION public.game_masoi_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

-- 0092_games_bacay.sql — Ba cây (so bài): server chia bài, điền lá khi lật, chấm điểm (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (bảng game_hands + game_start / game_move gọi game_<id>_deal / game_<id>_fill) và 0075 (game_finish tự
-- tìm game_<id>_result). CHỈ THÊM HÀM, không đổi bảng / dữ liệu. Chạy lại được (CREATE OR REPLACE).
--
-- game_hands: ghế ≥ 0 = 3 lá của người đó (không có nọc). Log: nước 1 { deal: { n } } · { flip: true, cards } (server
-- điền lá thật) · { out } (game_leave / game_claim ghi). RLS 0078: đang chơi chỉ chủ bài đọc được tay mình.
--
-- Luật chép từ lib/games/bacay.js — đổi một bên là phải đổi bên kia. bacay.test.js chấm bằng JS đúng bộ ván mẫu trong
-- supabase/manual/0092_games_bacay_check.sql; file kiểm chấm các ván đó bằng game_bacay_score trên DB thật.
--   Bộ 36 lá A…9 (bỏ 10, J, Q, K) = lá 0..35: hạng c >> 2 (0 = A … 8 = 9), chất c & 3 (♠ ♣ ♦ ♥).
--   Điểm lá: A = 1, 2…9 đúng số; nút = tổng % 10. So: nút > lá to nhất (chất ♦ > ♥ > ♠ > ♣, cùng chất A > 9 > … > 2).
--   Người rời thua. Người thắng ăn mỗi người 1 điểm.

BEGIN;

/* ---------- Chấm (thuần) ---------- */

-- p_hands = [[3 lá] | null, …] theo ghế, p_out = [bool, …]. Trả { winners, draw, ranks, scores } như bacay.js scoreOf,
-- NULL khi không còn ai để thắng hoặc người còn chơi thiếu bài.
CREATE OR REPLACE FUNCTION public.game_bacay_score(p_hands jsonb, p_out jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_n     int := jsonb_array_length(p_hands);
  v_ranks int[];
  v_live  int;
  v_ok    int;
  v_w     int;
BEGIN
  WITH h AS (
    SELECT s.i AS s, o.o,
           q.cnt,
           CASE WHEN o.o THEN NULL ELSE q.nut END AS nut,
           CASE WHEN o.o THEN NULL ELSE q.top END AS top
      FROM generate_series(0, v_n - 1) s(i)
      CROSS JOIN LATERAL (SELECT coalesce(p_out -> s.i = 'true'::jsonb, false) AS o) o
      CROSS JOIN LATERAL (
        SELECT count(*) AS cnt,
               sum((x >> 2) + 1) % 10 AS nut,
               max((ARRAY[1, 0, 3, 2])[(x & 3) + 1] * 9 + CASE WHEN (x >> 2) = 0 THEN 8 ELSE (x >> 2) - 1 END) AS top
          FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_hands -> s.i) = 'array' THEN p_hands -> s.i ELSE '[]'::jsonb END) e(v)
          CROSS JOIN LATERAL (SELECT e.v::int AS x) c
      ) q
  )
  SELECT array_agg(s ORDER BY o, nut DESC NULLS LAST, top DESC NULLS LAST, s),
         count(*) FILTER (WHERE NOT o),
         count(*) FILTER (WHERE NOT o AND cnt = 3)
    INTO v_ranks, v_live, v_ok
    FROM h;
  IF v_live = 0 OR v_ok <> v_live THEN RETURN NULL; END IF;

  v_w := v_ranks[1];
  RETURN jsonb_build_object(
    'winners', jsonb_build_array(v_w),
    'draw', false,
    'ranks', to_jsonb(v_ranks),
    'scores', (SELECT jsonb_object_agg(i::text, CASE WHEN i = v_w THEN v_n - 1 ELSE -1 END) FROM generate_series(0, v_n - 1) i));
END;
$$;

/* ---------- Chia ---------- */

-- game_start (0078) tự tìm hàm này. Xào 36 lá A…9 (lá 0..35), mỗi ghế 3 lá (sắp tăng dần), ghi nước 1 = { deal: { n } }.
-- random() của server: không ai thấy bộ bài trước khi chia (seed của phòng ai cũng đọc được nên không dùng).
CREATE OR REPLACE FUNCTION public.game_bacay_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deck int[];
  v_club uuid;
  k      int := 0;
  r      record;
BEGIN
  -- 8 người × 3 lá = 24 lá trong 36; game_start nhận p_max từ máy khách nên chặn lại ở đây.
  IF (SELECT count(*) FROM game_room_players WHERE room_id = p_room AND left_at IS NULL) > 8 THEN
    RAISE EXCEPTION 'games.err.badCount';
  END IF;
  v_deck := ARRAY(SELECT c FROM generate_series(0, 35) c ORDER BY random());
  FOR r IN SELECT seat, member_id, club_id FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LOOP
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    VALUES (p_room, r.seat, r.member_id, r.club_id, ARRAY(SELECT x FROM unnest(v_deck[k * 3 + 1 : k * 3 + 3]) x ORDER BY x))
    ON CONFLICT (room_id, seat) DO UPDATE SET member_id = EXCLUDED.member_id, cards = EXCLUDED.cards;
    v_club := r.club_id;
    k := k + 1;
  END LOOP;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, 0, jsonb_build_object('deal', jsonb_build_object('n', k)));
END;
$$;

/* ---------- Lật bài ---------- */

-- game_move (0078) gọi hàm này: máy khách gửi đúng { flip: true }, server trả nước ghi log kèm 3 lá thật.
CREATE OR REPLACE FUNCTION public.game_bacay_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cards int[];
BEGIN
  IF p_move IS DISTINCT FROM '{"flip": true}'::jsonb THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  IF EXISTS (SELECT 1 FROM game_moves WHERE room_id = p_room AND seat = p_seat AND move ? 'flip') THEN
    RAISE EXCEPTION 'games.err.flipped';
  END IF;
  SELECT cards INTO v_cards FROM game_hands WHERE room_id = p_room AND seat = p_seat;
  IF coalesce(array_length(v_cards, 1), 0) <> 3 THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  RETURN jsonb_build_object('flip', true, 'cards', to_jsonb(v_cards));
END;
$$;

/* ---------- Kết quả ---------- */

-- game_finish (0075) tự tìm hàm này. Đọc log theo seq như apply ở JS: ván xong khi mọi ghế đã lật hoặc đã rời (nước sau
-- lúc đó bỏ qua, như JS báo 'over'). Chưa xong → NULL. Bài so lấy từ game_hands (y lá đã điền vào log lúc lật).
CREATE OR REPLACE FUNCTION public.game_bacay_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n     int;
  v_flip  boolean[];
  v_out   boolean[];
  v_done  boolean := false;
  v_hands jsonb;
  m       record;
BEGIN
  SELECT (move #>> '{deal,n}')::int INTO v_n FROM game_moves WHERE room_id = p_room AND seq = 1 AND move ? 'deal';
  IF v_n IS NULL THEN RETURN NULL; END IF;
  v_flip := array_fill(false, ARRAY[v_n]);
  v_out := array_fill(false, ARRAY[v_n]);

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room AND seq > 1 ORDER BY seq LOOP
    EXIT WHEN v_done;
    CONTINUE WHEN m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1];
    IF m.move -> 'out' = 'true'::jsonb THEN
      v_out[m.seat + 1] := true;
    ELSIF m.move -> 'flip' = 'true'::jsonb AND NOT v_flip[m.seat + 1] THEN
      v_flip[m.seat + 1] := true;
    ELSE
      CONTINUE;
    END IF;
    -- Như settled() ở JS: mọi ghế lật / rời, hoặc chỉ còn ≤ 1 người chưa rời.
    v_done := (SELECT bool_and(v_flip[i] OR v_out[i]) FROM generate_series(1, v_n) i)
           OR (SELECT count(*) FROM generate_series(1, v_n) i WHERE NOT v_out[i]) <= 1;
  END LOOP;
  IF NOT v_done THEN RETURN NULL; END IF;
  -- Chỉ còn một người, chưa lật (mọi người kia rời) → người đó thắng, không có điểm — như result() ở JS.
  IF (SELECT count(*) FROM generate_series(1, v_n) i WHERE NOT v_out[i]) = 1
     AND NOT (SELECT bool_or(v_flip[i]) FROM generate_series(1, v_n) i WHERE NOT v_out[i]) THEN
    RETURN jsonb_build_object('winners', (SELECT jsonb_agg(i - 1) FROM generate_series(1, v_n) i WHERE NOT v_out[i]), 'draw', false);
  END IF;

  SELECT jsonb_agg(CASE WHEN v_flip[i + 1] AND NOT v_out[i + 1] THEN (SELECT to_jsonb(cards) FROM game_hands WHERE room_id = p_room AND seat = i) END ORDER BY i)
    INTO v_hands FROM generate_series(0, v_n - 1) i;
  RETURN game_bacay_score(v_hands, to_jsonb(v_out));
END;
$$;

REVOKE ALL ON FUNCTION public.game_bacay_score(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_bacay_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_bacay_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_bacay_result(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

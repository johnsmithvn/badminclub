-- 0095_games_coup.sql — Cờ úp (docs/GAMES.md §5.2, §12). Chạy sau 0078. Chỉ thêm hàm, không đụng bảng / data.
--
-- game_coup_deal — game_start (0078) gọi: xáo mặt thật các quân úp trong từng phe vào đúng các ô xuất phát của Cờ tướng
--   (trừ tướng), cất ở game_hands ghế -1: cards[i + 1] = 0 (ô không có quân úp) | 1..6 = 'AEHRCP' — RLS không ai đọc được.
--   Không ghi nước nào: đỏ đi trước như Cờ tướng.
-- game_coup_fill — game_move (0078) gọi trước khi ghi: bỏ flip / took client tự gửi, điền mặt thật theo ô xuất phát:
--   flip = quân úp ở ô `from`, took = quân úp ở ô `to`. Điền theo ô, không xét quân còn úp hay đã lật (ô đã có người đi
--   qua thì mặt thật đã công khai) — lib/games/coup.js chỉ dùng khi quân trên bàn còn úp.
-- ponytail: server chưa kiểm luật đi (luật Cờ tướng chưa chép sang SQL), kết quả ván vẫn do client báo như Cờ tướng.
--   Máy sửa code gửi nước sai thì mọi máy bỏ qua nước đó nhưng dò được một quân úp. Thêm kiểm luật nếu CLB đánh giải.
-- Mã lỗi RAISE là key i18n `games.err.*`.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_coup_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- = START của lib/games/cotuong.js: hàng 0 trên cùng (đen, chữ thường), chữ hoa = đỏ.
  c_start CONSTANT text := 'rheakaehr..........c.....c.p.p.p.p.p..................P.P.P.P.P.C.....C..........RHEAKAEHR';
  v_ids   int[] := array_fill(0, ARRAY[90]);
  v_sq    int[];
  v_kinds int[];
  v_club  uuid;
  v_mem   uuid;
  side    int;
  i       int;
BEGIN
  SELECT club_id, member_id INTO v_club, v_mem FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LIMIT 1;
  FOR side IN 0..1 LOOP
    v_sq := ARRAY(SELECT g FROM generate_series(0, 89) g
                   WHERE substr(c_start, g + 1, 1) NOT IN ('.', 'K', 'k')
                     AND (substr(c_start, g + 1, 1) = upper(substr(c_start, g + 1, 1))) = (side = 0)
                   ORDER BY g);
    v_kinds := ARRAY(SELECT strpos('AEHRCP', upper(substr(c_start, g + 1, 1))) FROM unnest(v_sq) g ORDER BY random());
    FOR i IN 1..cardinality(v_sq) LOOP
      v_ids[v_sq[i] + 1] := v_kinds[i];
    END LOOP;
  END LOOP;
  -- Ghế âm: member_id bắt buộc nên ghi tạm người ngồi ghế 0 — RLS không cho ai đọc ghế âm.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES (p_room, -1, v_mem, v_club, v_ids)
  ON CONFLICT (room_id, seat) DO UPDATE SET cards = EXCLUDED.cards;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_coup_fill(p_room uuid, p_seat int, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids int[];
  f     int;
  t     int;
  o     jsonb;
BEGIN
  IF jsonb_typeof(p_move -> 'from') IS DISTINCT FROM 'number' OR jsonb_typeof(p_move -> 'to') IS DISTINCT FROM 'number'
     OR (p_move ->> 'from') !~ '^[0-9]{1,2}$' OR (p_move ->> 'to') !~ '^[0-9]{1,2}$' THEN
    RAISE EXCEPTION 'games.err.badMove';
  END IF;
  f := (p_move ->> 'from')::int;
  t := (p_move ->> 'to')::int;
  IF f > 89 OR t > 89 OR f = t THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  SELECT cards INTO v_ids FROM game_hands WHERE room_id = p_room AND seat = -1;
  o := jsonb_build_object('from', f, 'to', t);
  IF COALESCE(v_ids[f + 1], 0) > 0 THEN o := o || jsonb_build_object('flip', substr('AEHRCP', v_ids[f + 1], 1)); END IF;
  IF COALESCE(v_ids[t + 1], 0) > 0 THEN o := o || jsonb_build_object('took', substr('AEHRCP', v_ids[t + 1], 1)); END IF;
  RETURN o;
END;
$$;

REVOKE ALL ON FUNCTION public.game_coup_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_coup_fill(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;

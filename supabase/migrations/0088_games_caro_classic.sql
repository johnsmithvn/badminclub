-- 0088_games_caro_classic.sql — Caro: thêm bàn X-O cổ điển 3 × 3, 3 quân liền là thắng (docs/GAMES.md §12). Chạy sau 0074.
--
-- SỬA game_create (chép nguyên 0074, chỉ đổi đúng dòng có ghi chú "0088"): nhận cỡ bàn Caro 3..25 thay vì 5..25.
-- game_caro_result (0074) đã chấm đúng mọi cỡ bàn và số quân thắng (win ≤ size) — không cần sửa.
-- Không đụng bảng / dữ liệu. Chạy lại được (CREATE OR REPLACE giữ quyền EXECUTE đã cấp ở 0074).

BEGIN;
CREATE OR REPLACE FUNCTION public.game_create(p_club uuid, p_game text, p_options jsonb, p_private boolean, p_from uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   uuid := game_me(p_club);
  v_id   uuid;
  v_code text;
BEGIN
  -- Cỡ bàn Caro do server chặn: game_caro_result dựng mảng size×size, để client gửi size tuỳ ý là tự làm nặng DB.
  IF p_game = 'caro' AND NOT (
    -- 0088: cho cả bàn 3×3 (X-O cổ điển, 3 quân thắng).
    COALESCE((p_options ->> 'size')::int, 15) BETWEEN 3 AND 25
    AND COALESCE((p_options ->> 'win')::int, 5) BETWEEN 3 AND COALESCE((p_options ->> 'size')::int, 15)
  ) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;

  -- Bỏ 0/O/1/I để đọc mã qua miệng không nhầm.
  LOOP
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      INTO v_code FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE club_id = p_club AND code = v_code);
  END LOOP;

  INSERT INTO game_rooms (club_id, game, code, host_id, private, options)
  VALUES (p_club, p_game, v_code, v_me, COALESCE(p_private, false), COALESCE(p_options, '{}'::jsonb))
  RETURNING id INTO v_id;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_id, v_me, p_club, 0);

  IF p_from IS NOT NULL THEN
    UPDATE game_rooms SET next_room = v_id
     WHERE id = p_from AND club_id = p_club AND next_room IS NULL AND status IN ('finished', 'abandoned')
       AND EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_from AND member_id = v_me);
  END IF;
  RETURN v_id;
END;
$$;

COMMIT;

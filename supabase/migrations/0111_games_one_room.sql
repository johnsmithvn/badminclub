-- 0111_games_one_room.sql — Mỗi người chỉ ngồi MỘT phòng chưa xong (chủ dự án yêu cầu 2026-11-16, docs/GAMES.md §4c).
--
-- Ngồi ghế (tạo phòng, vào, vào lại) khi đang ngồi phòng khác chưa xong:
--   - phòng kia đang CHỜ  → tự rời phòng đó (qua game_leave: chuyển chủ phòng / bỏ phòng trống như bấm Rời);
--   - phòng kia đang CHƠI → từ chối 'games.err.busy' (đánh nốt hoặc vào lại bấm Rời — rời giữa ván là thua).
-- Tự rời thay vì chặn để không ai bị kẹt vì một phòng chờ bỏ quên (sảnh ẩn phòng chờ quá staleHours).
-- Kèm theo: cược điểm mùa (0110) không còn chuyện ngồi nhiều bàn cùng lúc mà bàn nào cũng thấy đủ số dư.
-- Người xem không bị ảnh hưởng (không ngồi ghế). Chơi với máy chạy trong trình duyệt, không đụng tới.
-- Chạy lại được: CREATE OR REPLACE · DROP TRIGGER IF EXISTS. Chạy sau 0110.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_players_one_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self boolean;
  o      record;
BEGIN
  IF NEW.left_at IS NULL AND (TG_OP = 'INSERT' OR OLD.left_at IS NOT NULL) THEN
    -- game_leave rời theo người gọi (auth.uid), nên chỉ tự rời khi người ngồi ghế chính là người gọi.
    v_self := EXISTS (SELECT 1 FROM club_members WHERE id = NEW.member_id AND user_id = auth.uid());
    FOR o IN
      SELECT r.id, r.status
        FROM game_room_players gp JOIN game_rooms r ON r.id = gp.room_id
       WHERE gp.member_id = NEW.member_id AND gp.room_id <> NEW.room_id AND gp.left_at IS NULL
         AND r.status IN ('waiting', 'playing')
    LOOP
      IF o.status = 'playing' OR NOT v_self THEN RAISE EXCEPTION 'games.err.busy'; END IF;
      PERFORM game_leave(o.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_players_one_room ON public.game_room_players;
CREATE TRIGGER game_players_one_room BEFORE INSERT OR UPDATE OF left_at ON public.game_room_players
  FOR EACH ROW EXECUTE FUNCTION public.game_players_one_room();

REVOKE ALL ON FUNCTION public.game_players_one_room() FROM PUBLIC, anon, authenticated;

COMMIT;

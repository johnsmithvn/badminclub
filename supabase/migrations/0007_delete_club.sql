-- Migration 0007: xoá CỨNG một CLB và toàn bộ dữ liệu của nó.
--
-- ⚠️ KHÔNG HỒI ĐƯỢC. Chạy xong là mất sạch điểm danh, quỹ tháng, giao dịch, kho cầu, lịch sử
-- trận của CLB đó. Không có thùng rác, không có bản sao. Đây là yêu cầu có chủ ý của chủ CLB,
-- không phải đường dọn dẹp tự động — không hàm nào khác được gọi hàm này.
--
-- VÌ SAO PHẢI LÀ RPC, không xoá thẳng từ client:
--   1. `clubs` cố ý KHÔNG có policy DELETE (0001_init.sql) — RLS chặn mọi lệnh xoá từ client;
--   2. cả 22 bảng con trỏ về `clubs(id)` đều là `REFERENCES clubs(id)` TRẦN, không có
--      ON DELETE CASCADE. `DELETE FROM clubs` sẽ nổ khoá ngoại ngay dòng đầu.
--
-- CỐ Ý KHÔNG đổi các khoá ngoại đó thành ON DELETE CASCADE: `club_members` và `sessions` đang
-- được khoá ngoại bảo vệ đúng như thiết kế — `appActions.js: deleteMember` dựa vào chính cái
-- chặn đó làm lưới an toàn cuối ("dính lịch sử thì khoá ngoại dưới DB cũng chặn"). Mở CASCADE
-- toàn cục là xoá một thành viên kéo theo cả điểm danh và quỹ tháng của họ, im lặng.
-- Nên: thứ tự xoá viết tay ở đây, và CHỈ ở đây.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_club(p_club uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- Cổng 1: phải là CHỦ CLB đang hoạt động của đúng CLB này. Thủ quỹ không xoá được.
  IF NOT EXISTS (
    SELECT 1 FROM club_members
     WHERE club_id = p_club AND user_id = auth.uid() AND active AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Chỉ chủ CLB mới xoá được CLB này';
  END IF;

  -- Cổng 2: gõ đúng mã CLB. Chặn bấm nhầm ở UI, và chặn cả lệnh gọi RPC vu vơ từ console.
  SELECT name INTO v_name FROM clubs
   WHERE id = p_club AND upper(code) = upper(btrim(coalesce(p_code, '')));
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Mã CLB không khớp — chưa xoá gì cả';
  END IF;

  -- Thứ tự dưới đây suy từ đồ thị khoá ngoại thật của 0001_init.sql: con trước, cha sau.
  -- Thêm bảng mới có club_id thì PHẢI thêm một dòng vào đây, không thì xoá CLB nổ 23503.

  -- 1. Buổi tập — cascade sẵn xuống attendances · session_courts · session_guests ·
  --    session_lineups · session_court_groups · matches → match_players.
  --    Phải đi TRƯỚC courts/guests/club_members/shuttle_types: mấy bảng con đó trỏ sang bằng
  --    khoá ngoại TRẦN, xoá cha trước là nổ.
  DELETE FROM sessions  WHERE club_id = p_club;
  -- 2. Lịch cố định — cascade xuống schedule_slots (schedule_slots.court_id trỏ courts trần).
  DELETE FROM schedules WHERE club_id = p_club;

  -- 3. Bảng con của member_groups / club_members mà KHÔNG có club_id riêng.
  DELETE FROM group_courts
   WHERE group_id  IN (SELECT id FROM member_groups WHERE club_id = p_club);
  DELETE FROM group_memberships
   WHERE group_id  IN (SELECT id FROM member_groups WHERE club_id = p_club);
  DELETE FROM member_changes
   WHERE member_id IN (SELECT id FROM club_members  WHERE club_id = p_club);

  -- 4. Tiền: quỹ tháng, back, đối chiếu, hoá đơn sân, sổ quỹ.
  DELETE FROM monthly_dues       WHERE club_id = p_club;
  DELETE FROM back_credits       WHERE club_id = p_club;
  DELETE FROM member_adjustments WHERE club_id = p_club;
  DELETE FROM court_bills        WHERE club_id = p_club;
  DELETE FROM transactions       WHERE club_id = p_club;

  -- 5. Kho cầu — trước shuttle_types vì cả ba đều trỏ type_id sang đó.
  DELETE FROM shuttle_purchases  WHERE club_id = p_club;
  DELETE FROM shuttle_movements  WHERE club_id = p_club;
  DELETE FROM stock_checks       WHERE club_id = p_club;

  -- 6. Khách và bảng giá khách — guests.invited_by trỏ club_members, phải trước bước 8.
  DELETE FROM guest_price_rules  WHERE club_id = p_club;
  DELETE FROM guests             WHERE club_id = p_club;

  -- 7. Phụ trợ, đều trỏ club_members.
  DELETE FROM notifications       WHERE club_id = p_club;
  DELETE FROM zalo_links          WHERE club_id = p_club;
  DELETE FROM audit_logs          WHERE club_id = p_club;
  DELETE FROM club_invites        WHERE club_id = p_club;
  DELETE FROM club_join_requests  WHERE club_id = p_club;
  DELETE FROM roster_locks        WHERE club_id = p_club;

  -- 8. Danh mục — giờ mới hết bảng con trỏ vào.
  DELETE FROM courts         WHERE club_id = p_club;
  DELETE FROM member_groups  WHERE club_id = p_club;
  DELETE FROM shuttle_types  WHERE club_id = p_club;

  -- 9. Thành viên — cascade xuống club_member_groups. `invited_by` tự trỏ chính bảng này,
  --    xoá cả cụm trong MỘT câu lệnh nên RI kiểm ở cuối câu, không vướng.
  DELETE FROM club_members WHERE club_id = p_club;

  -- 10. Và cuối cùng là chính CLB.
  DELETE FROM clubs WHERE id = p_club;
END;
$$;

COMMENT ON FUNCTION public.delete_club(uuid, text) IS
  'Xoá CỨNG một CLB và toàn bộ dữ liệu. Không hồi được. Hai cổng: người gọi phải là owner đang '
  'hoạt động của CLB đó, và phải gõ đúng clubs.code. Thứ tự xoá bám đồ thị khoá ngoại của '
  '0001_init.sql — thêm bảng có club_id thì phải cập nhật hàm này.';

REVOKE ALL  ON FUNCTION public.delete_club(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_club(uuid, text) TO authenticated;

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
   Câu này phải trả về 0 dòng — bảng nào có club_id mà hàm trên chưa đụng tới:

     SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'club_id' AND a.attnum > 0
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND position(c.relname IN pg_get_functiondef(
              'public.delete_club(uuid, text)'::regprocedure)) = 0;
*/

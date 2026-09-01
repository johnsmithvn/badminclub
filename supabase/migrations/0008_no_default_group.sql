-- Migration 0008: CLB mới KHÔNG còn tự sinh nhóm cố định "Cố định".
--
-- VÌ SAO BỎ. Nhóm mặc định sinh ở `create_club` (0002) đi kèm một luật ngầm ở client:
-- "`groups[0]` là nhóm mặc định, không cho xoá". Đó là luật theo VỊ TRÍ TRONG MẢNG, không phải
-- một cờ thật trong DB — nhập cài đặt từ CLB khác là thứ tự đổi, và người dùng kẹt với một
-- nhóm rác không xoá nổi. Luật đó đã gỡ ở client (`appActions.js: deleteGroup` giờ chặn theo
-- dữ liệu thật qua `money.js: groupRefs`), nên nguồn sinh ra nó cũng phải gỡ theo.
--
-- MÔ HÌNH MỚI: không có nhóm nào là mặc định. CLB mới bắt đầu với 0 nhóm; ai chưa thuộc nhóm
-- nào thì tính là ĐI LẺ (vãng lai) — trả theo giá khách từng buổi, không đóng quỹ tháng.
-- Muốn thu quỹ tháng thì tự tạo nhóm. Màn tạo lịch tập chặn hẳn khi CLB chưa có nhóm nào,
-- vì `monthly_dues` · `unitPrice` · công nợ đều đếm theo `group_id`.
--
-- ⚠️ KHÔNG đụng dữ liệu đang có. CLB cũ giữ nguyên nhóm "Cố định" của mình; giờ xoá được nếu
-- nhóm đó không còn buổi, lịch, quỹ tháng, đối chiếu hay danh sách cố định nào.
-- Migration này CHỈ đổi hành vi của CLB tạo MỚI từ đây trở đi.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_club(
  p_name            text,
  p_opening_balance bigint DEFAULT 0,
  p_opening_date    date   DEFAULT CURRENT_DATE,
  p_lock_day        int    DEFAULT 25,
  p_bank_holder     text   DEFAULT NULL,
  p_bank_no         text   DEFAULT NULL,
  p_bank_name       text   DEFAULT NULL
)
RETURNS clubs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_club clubs;
  me profiles;
  new_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF length(coalesce(trim(p_name), '')) < 2 THEN RAISE EXCEPTION 'Tên CLB quá ngắn'; END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này chưa có hồ sơ. Đăng xuất rồi đăng nhập lại; nếu vẫn lỗi thì chạy lại migration hoặc đăng ký tài khoản mới.';
  END IF;

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name, multi_group)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name, false)
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.phone,
          COALESCE(me.gender, 'nam'), COALESCE(me.level, new_club.levels[1]),
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  -- Cố ý DỪNG Ở ĐÂY. Không sinh nhóm "Cố định", không gán owner vào nhóm nào:
  -- chủ CLB tự tạo nhóm khi cần thu quỹ tháng. Chưa có nhóm thì mọi người là đi lẻ.

  RETURN new_club;
END;
$$;

COMMENT ON FUNCTION public.create_club(text, bigint, date, int, text, text, text) IS
  'Tạo CLB + bản ghi owner + một loại cầu mặc định. KHÔNG sinh nhóm cố định (0008): không có '
  'nhóm nào là "mặc định", chưa thuộc nhóm nào thì tính là đi lẻ.';

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
   Phải trả về 0 dòng — hàm không được còn chỗ nào chèn member_groups:

     SELECT 1
      WHERE position('member_groups' IN pg_get_functiondef(
              'public.create_club(text, bigint, date, int, text, text, text)'::regprocedure)) > 0;
*/

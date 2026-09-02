-- Migration 0011: lịch sử trình độ nhiều mốc · CLB mới lấy thang từ app · dọn RPC chết.
--
-- BA VIỆC:
--
--   1. LỊCH SỬ TRÌNH ĐỘ (bảng `member_levels`).
--
--      Trước đây mỗi thành viên chỉ có MỘT ô chờ: `pending_level` + `pending_level_from`. Đổi
--      trình độ lần thứ hai là ghi đè lần thứ nhất, và đoạn giữa hai lần đổi rơi về `level` gốc:
--
--         01/2026 Newbie → duyệt lên TBY từ 03/2026 → duyệt tiếp lên TB từ 06/2026
--         thì tháng 03,04,05 lẽ ra là TBY, nhưng ô chờ đã bị ghi đè nên app đọc ra Newbie.
--
--      Sai này không lộ ra ở đâu cả: nó chỉ hiện qua giá khách của người đi lẻ và qua cách cân
--      sân của những buổi trong đoạn giữa.
--
--      Mô hình mới: mỗi lần đổi "từ tháng sau" ghi thêm MỘT MỐC. `levelOf(m, month)` lấy mốc
--      lớn nhất còn <= tháng đang hỏi, không có mốc nào thì dùng `club_members.level`.
--
--      `pending_level` / `pending_level_from` GIỮ NGUYÊN dưới DB và được backfill sang bảng mới,
--      nhưng client thôi đọc/ghi. Không DROP cột: dữ liệu cũ còn nằm đó, và xoá cột là việc một
--      chiều — để lại vô hại.
--
--   2. `create_club` nhận `p_levels`: CLB mới lấy thang trình độ từ `app.json → levelsDefault`
--      (10 bậc) thay vì thang mặc định 4 bậc của DB. Chọn 'Y+' lúc đăng ký rồi tạo CLB thì
--      trước đây `create_club` hạ về bậc thấp nhất trong im lặng, vì 'Y+' không có trong thang
--      4 bậc kia. CLB ĐANG CHẠY không bị đụng — thang của họ nằm trong `clubs.levels` của chính họ.
--
--   3. DROP `search_users_for_club` — tạo ở 0006, chưa từng có consumer nào trong `src/`. Code
--      chết dưới DB là thứ người sau đọc rồi tưởng đang chạy. Cần lại thì lấy trong git.
--
-- ⚠️ KHÔNG xoá dữ liệu nào. Backfill ở việc 1 chạy lại nhiều lần vẫn ra một kết quả.

BEGIN;

/* ==================== 1. Lịch sử trình độ ==================== */

CREATE TABLE IF NOT EXISTS member_levels (
  member_id  uuid    NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  from_month char(7) NOT NULL,          -- 'YYYY-MM', áp dụng TỪ tháng này trở đi
  level      text    NOT NULL,
  PRIMARY KEY (member_id, from_month)
);

COMMENT ON TABLE member_levels IS
  'Mốc đổi trình độ. levelOf(member, month) = level của mốc LỚN NHẤT còn <= month; không có mốc '
  'nào thì dùng club_members.level. Cho phép đổi nhiều lần mà đoạn giữa vẫn đúng — một ô '
  'pending_level không làm được việc đó.';

CREATE INDEX IF NOT EXISTS member_levels_member_idx ON member_levels (member_id, from_month);

-- Backfill: mỗi ô chờ cũ thành một mốc. `ON CONFLICT DO NOTHING` để chạy lại vô hại.
INSERT INTO member_levels (member_id, from_month, level)
SELECT id, pending_level_from, pending_level
  FROM club_members
 WHERE pending_level IS NOT NULL AND pending_level_from IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE member_levels ENABLE ROW LEVEL SECURITY;

-- Đúng khuôn `club_member_groups`: đọc được nếu là thành viên CLB, ghi được nếu có cờ `members`.
DROP POLICY IF EXISTS ml_read ON member_levels;
CREATE POLICY ml_read ON member_levels FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND is_club_member(m.club_id)));

DROP POLICY IF EXISTS ml_all ON member_levels;
CREATE POLICY ml_all ON member_levels FOR ALL USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')));

-- GRANT và RLS là HAI lớp: thiếu GRANT thì client nhận "permission denied for table
-- member_levels" chứ không phải 0 dòng. `ALTER DEFAULT PRIVILEGES` ở 0001 chỉ áp cho bảng do
-- cùng role tạo, nên cấp tay ở đây cho chắc.
GRANT SELECT, INSERT, UPDATE, DELETE ON member_levels TO authenticated;

COMMENT ON COLUMN club_members.pending_level IS
  'KHÔNG CÒN DÙNG từ 0011 — lịch sử trình độ nằm ở member_levels. Giữ cột cho dữ liệu cũ.';

/* ==================== 2. CLB mới lấy thang trình độ từ app ==================== */

-- DROP bản cũ trước: thêm tham số là tạo hàm NẠP CHỒNG, hai hàm cùng tên thì PostgREST không
-- chọn được cái nào và nút Tạo CLB chết ngay sau khi apply (đúng bẫy đã gặp ở 0009).
DROP FUNCTION IF EXISTS public.create_club(text, bigint, date, int, text, text, text);

CREATE OR REPLACE FUNCTION public.create_club(
  p_name            text,
  p_opening_balance bigint DEFAULT 0,
  p_opening_date    date   DEFAULT CURRENT_DATE,
  p_lock_day        int    DEFAULT 25,
  p_bank_holder     text   DEFAULT NULL,
  p_bank_no         text   DEFAULT NULL,
  p_bank_name       text   DEFAULT NULL,
  p_levels          text[] DEFAULT NULL
)
RETURNS clubs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_club clubs;
  me profiles;
  new_member_id uuid;
  v_levels text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF length(coalesce(trim(p_name), '')) < 2 THEN RAISE EXCEPTION 'Tên CLB quá ngắn'; END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này chưa có hồ sơ. Đăng xuất rồi đăng nhập lại; nếu vẫn lỗi thì chạy lại migration hoặc đăng ký tài khoản mới.';
  END IF;

  -- Không truyền hoặc truyền mảng rỗng thì rơi về default của cột `clubs.levels`, không tự bịa.
  v_levels := CASE WHEN p_levels IS NULL OR array_length(p_levels, 1) IS NULL
                   THEN NULL ELSE p_levels END;

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name, multi_group, levels)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name, false,
          COALESCE(v_levels, ARRAY['Newbie','TBY','TB-','TB']))
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, full_name, phone, email, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.name, me.phone, me.email,
          COALESCE(me.gender, 'nam'),
          -- Thang là của TỪNG CLB (0009): ngoài thang thì lấy bậc thấp nhất.
          CASE WHEN me.level = ANY (new_club.levels) THEN me.level ELSE new_club.levels[1] END,
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  -- Cố ý DỪNG Ở ĐÂY (0008). Không sinh nhóm "Cố định", không gán owner vào nhóm nào.

  RETURN new_club;
END;
$$;

COMMENT ON FUNCTION public.create_club(text, bigint, date, int, text, text, text, text[]) IS
  'Tạo CLB + bản ghi owner + một loại cầu mặc định. p_levels = thang trình độ khởi tạo (client '
  'truyền app.json levelsDefault); NULL thì dùng default của cột clubs.levels.';

/* ==================== 3. Dọn RPC chết ==================== */

-- Tạo ở 0006 cho một ô "tìm tài khoản để ghép" chưa bao giờ được dựng. Màn ghép hiện dùng danh
-- sách thả xuống lấy từ `db.users`, không gọi hàm này.
DROP FUNCTION IF EXISTS public.search_users_for_club(uuid, text);

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Bảng mới có RLS và đã backfill:

        SELECT count(*) FROM member_levels;
        -- mong đợi: bằng số thành viên đang có pending_level

        SELECT relrowsecurity FROM pg_class WHERE relname = 'member_levels';
        -- mong đợi: t

   b) Chỉ còn MỘT create_club, và nó có 8 tham số:

        SELECT oid::regprocedure FROM pg_proc WHERE proname = 'create_club';
        -- mong đợi: create_club(text,bigint,date,integer,text,text,text,text[])

   c) RPC chết đã biến mất:

        SELECT count(*) FROM pg_proc WHERE proname = 'search_users_for_club';
        -- mong đợi: 0
*/

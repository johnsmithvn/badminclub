-- Migration 0023: gỡ bỏ hoàn toàn module Kho cầu và Tầng B (giá thành từng buổi).
--
-- ⚠️ XOÁ DỮ LIỆU, KHÔNG HỒI ĐƯỢC. Chạy xong là mất sạch lịch sử nhập cầu, kiểm kho, và mọi
-- con số giá thành đã đóng băng của các buổi cũ.
--
-- PHẢI LÀM TRƯỚC KHI CHẠY:
--   Các đợt mua cầu do QUỸ tự trả đang là dòng chi thật trong sổ quỹ. Xoá bảng đi là mấy dòng
--   chi đó biến mất → tổng chi giảm → SỐ DƯ QUỸ TĂNG VỌT so với thực tế.
--   Ghi lại tay ở Sổ quỹ → Ghi thu/chi → Chi → hạng mục "Mua cầu", đúng ngày và đúng số tiền:
--
--     SELECT p.date, p.total_amount, p.note, m.name AS nguoi_tra, p.repaid_at
--       FROM shuttle_purchases p
--       LEFT JOIN club_members m ON m.id = p.payer_member_id
--      ORDER BY p.date;
--
--   Dòng có `nguoi_tra` mà `repaid_at` NULL = CLB đang nợ người đó, khoản này CHƯA vào sổ quỹ.
--   Xoá bảng là mất luôn dấu khoản nợ ấy — xử lý xong rồi hãy chạy migration này.
--
-- CÁCH CHẠY:  psql "$DATABASE_URL" -f supabase/migrations/0023_drop_shuttle.sql
-- KHÔNG dùng `supabase db reset` — lệnh đó xoá sạch cả database.
--
-- SAU KHI CHẠY XONG, sửa nốt bên client (chúng đang ghi giá trị giả để thoả NOT NULL):
--   · dbmap.js  — bỏ `shuttle_mode: 'quota'` và `quota: 24`
--   · dbmap.test.js — bỏ assert `shuttle_mode === 'quota'`
--   · data/schema.js — bỏ 4 bảng cầu và các cột tương ứng khỏi trang Sơ đồ dữ liệu

BEGIN;

-- 1. create_club: thôi sinh loại cầu mặc định cho CLB mới.
--    Giữ nguyên phần còn lại của bản 0020 (thang trình độ 10 bậc).
--
--    PHẢI DROP trước, không `CREATE OR REPLACE` được: Postgres từ chối với 42P13 "cannot remove
--    parameter defaults from existing function" khi hàm có tham số DEFAULT. `0011_level_history`
--    đã đi đúng đường này. `create_club` không có GRANT riêng ở migration nào (khác `delete_club`
--    ở 0007) nên drop xong không phải cấp lại quyền.
DROP FUNCTION IF EXISTS public.create_club(text, bigint, date, int, text, text, text, text[]);

CREATE FUNCTION public.create_club(
  p_name            text,
  p_opening_balance bigint,
  p_opening_date    date,
  p_lock_day        int DEFAULT 25,
  p_bank_holder     text DEFAULT NULL,
  p_bank_no         text DEFAULT NULL,
  p_bank_name       text DEFAULT NULL,
  p_levels          text[] DEFAULT NULL
)
RETURNS public.clubs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me            public.profiles%ROWTYPE;
  new_club      public.clubs%ROWTYPE;
  v_levels      text[];
BEGIN
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này chưa có hồ sơ. Đăng xuất rồi đăng nhập lại; nếu vẫn lỗi thì chạy lại migration hoặc đăng ký tài khoản mới.';
  END IF;

  -- Không truyền hoặc truyền mảng rỗng thì dùng thang mặc định 10 bậc của CLB
  v_levels := CASE WHEN p_levels IS NULL OR array_length(p_levels, 1) IS NULL
                   THEN NULL ELSE p_levels END;

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name, multi_group, levels)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name, false,
          COALESCE(v_levels, ARRAY['Y', 'Y+', 'TBY-', 'TBY', 'TBY+', 'TB-', 'TB', 'TB+', 'TBK', 'Khá']))
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, full_name, phone, email, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.name, me.phone, me.email,
          COALESCE(me.gender, 'nam'),
          -- Thang là của TỪNG CLB (0009): ngoài thang thì lấy bậc thấp nhất.
          CASE WHEN me.level = ANY (new_club.levels) THEN me.level ELSE new_club.levels[1] END,
          CURRENT_DATE, now());

  RETURN new_club;
END $$;

COMMENT ON FUNCTION public.create_club(text, bigint, date, int, text, text, text, text[]) IS
  'Tạo CLB + bản ghi owner. p_levels = thang trình độ khởi tạo (client truyền app.json levelsDefault); NULL thì dùng default 10 bậc của cột clubs.levels.';

-- 2. delete_club: bỏ 4 lệnh DELETE trỏ vào bảng sắp biến mất.
--    Không sửa thì xoá CLB sẽ nổ 42P01 (relation does not exist).
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

  -- 5. (Kho cầu đã gỡ ở 0023 — không còn bảng nào để xoá ở bước này.)

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

-- 3. Cột của `sessions`.
--    `shuttle_type_id` phải đi TRƯỚC khi drop `shuttle_types` — nó là khoá ngoại trỏ sang đó.
--    Bảy cột `cost_*` là Tầng B, đã gỡ khỏi client.
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS shuttle_type_id,
  DROP COLUMN IF EXISTS shuttle_mode,
  DROP COLUMN IF EXISTS tubes_opened,
  DROP COLUMN IF EXISTS loose_units,
  DROP COLUMN IF EXISTS shuttle_used,
  DROP COLUMN IF EXISTS shuttle_est,
  DROP COLUMN IF EXISTS cost_court,
  DROP COLUMN IF EXISTS cost_shuttle_unit,
  DROP COLUMN IF EXISTS cost_shuttle,
  DROP COLUMN IF EXISTS cost_total,
  DROP COLUMN IF EXISTS cost_guest_rev,
  DROP COLUMN IF EXISTS cost_heads,
  DROP COLUMN IF EXISTS cost_frozen_at;

-- `session_courts.cost` GIỮ LẠI: đó là tiền sân đóng băng lúc chốt buổi (0012), chống trôi sổ
-- quỹ khi chủ sân đổi giá. Không liên quan Tầng B.

-- 4. Định mức cầu của nhóm.
ALTER TABLE public.member_groups DROP COLUMN IF EXISTS quota;

-- 5. Bốn bảng. `shuttle_purchases` và `shuttle_movements` trỏ `type_id` sang `shuttle_types`
--    nên phải xoá trước nó; `stock_checks` chỉ có `club_id` nhưng xếp cùng cụm cho gọn.
DROP TABLE IF EXISTS public.shuttle_purchases;
DROP TABLE IF EXISTS public.shuttle_movements;
DROP TABLE IF EXISTS public.stock_checks;
DROP TABLE IF EXISTS public.shuttle_types;

-- 6. Enum giờ không cột nào dùng nữa.
DROP TYPE IF EXISTS public.shuttle_mode;

COMMIT;

-- PostgREST cache danh sách hàm và schema. Không có dòng này thì `create_club` / `delete_club`
-- trả 404 cho tới lần reload cache tiếp theo, và lỗi đó trông y như "chưa chạy migration".
NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   1. Không còn bảng/cột nào của kho cầu — cả hai câu phải trả 0 dòng:

     SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('shuttle_types','shuttle_purchases','shuttle_movements','stock_checks');

     SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sessions'
        AND (column_name LIKE 'shuttle%' OR column_name LIKE 'cost_%'
             OR column_name IN ('tubes_opened','loose_units'));

   2. `delete_club` vẫn phủ hết bảng có club_id — câu này chỉ được trả về các bảng của 0021
      (challenges · match_edits · player_ratings · player_rating_context · club_calibration),
      vì chúng khai `REFERENCES clubs(id) ON DELETE CASCADE` nên tự xoá theo. Bất kỳ tên nào
      KHÁC hiện ra là một bảng bị bỏ quên, xoá CLB sẽ nổ 23503:

     SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'club_id' AND a.attnum > 0
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND position(c.relname IN pg_get_functiondef(
              'public.delete_club(uuid,text)'::regprocedure)) = 0;

   3. Tạo một buổi mới trên app — phải lên được Supabase (đây là đường vừa mất 6 cột).
*/

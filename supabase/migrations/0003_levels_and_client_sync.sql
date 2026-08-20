-- 0003_levels_and_client_sync.sql
-- Hai việc:
--   A. Trình độ (`Newbie`, `TBY`…) chuyển từ ENUM cứng sang danh sách RIÊNG của từng CLB,
--      để CLB tự thêm `Y`, `Y-`, `Y+`, `TB+`… Thứ tự trong mảng = thứ tự mạnh dần,
--      thuật toán cân sân dùng đúng thứ tự này.
--   B. Vá những chỗ state của client chưa có cột để chứa (groupIds, groupMode, courtMin,
--      người ghi sổ quỹ). Xem docs/DATABASE.md §4.
--
-- CHẠY BẰNG:  psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -f supabase/migrations/0003_levels_and_client_sync.sql
-- KHÔNG dùng `supabase db reset` (xoá sạch data — xem docs/RULES.md §7).

BEGIN;

/* ============ A. TRÌNH ĐỘ THEO CLB ============ */

-- Thứ tự phần tử = thứ tự mạnh dần. Đổi ở Cài đặt → Chung.
ALTER TABLE clubs ADD COLUMN levels     text[] NOT NULL DEFAULT ARRAY['Newbie','TBY','TB-','TB'];
ALTER TABLE clubs ADD COLUMN opening_by text;

-- enum → text. Bỏ enum vì Postgres không cho xoá / đổi thứ tự giá trị của enum,
-- mà CLB thì cần cả hai.
ALTER TABLE profiles          ALTER COLUMN level         TYPE text USING level::text;
ALTER TABLE club_members      ALTER COLUMN level         TYPE text USING level::text;
ALTER TABLE club_members      ALTER COLUMN pending_level TYPE text USING pending_level::text;
ALTER TABLE guests            ALTER COLUMN level         TYPE text USING level::text;
ALTER TABLE session_guests    ALTER COLUMN level         TYPE text USING level::text;
ALTER TABLE guest_price_rules ALTER COLUMN level         TYPE text USING level::text;

-- Trigger tạo profile lúc đăng ký còn cast ::skill_level. Postgres KHÔNG chặn DROP TYPE vì
-- thân hàm plpgsql chỉ là text — bỏ type mà không sửa hàm thì đăng ký sẽ chết lúc chạy.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, phone, name, nick, gender, level)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'nick', ''),
    (NULLIF(NEW.raw_user_meta_data->>'gender', ''))::gender,
    NULLIF(NEW.raw_user_meta_data->>'level', '')
  );
  RETURN NEW;
END;
$$;

DROP TYPE skill_level;

/* ============ B. CHỖ CHỨA CÒN THIẾU ============ */

-- members[].groupIds — nhóm cố định "gốc" của thành viên.
-- Khác group_memberships: bảng kia là danh sách CHỐT theo từng tháng, bảng này là mặc định
-- dùng để suy ra tháng chưa chốt.
CREATE TABLE club_member_groups (
  member_id uuid NOT NULL REFERENCES club_members(id)  ON DELETE CASCADE,
  group_id  uuid NOT NULL REFERENCES member_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, group_id)
);
ALTER TABLE club_member_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY cmg_read ON club_member_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND is_club_member(m.club_id)));
CREATE POLICY cmg_all ON club_member_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')));

-- groupMode[sessionId] — chế độ "cố định người theo sân" của buổi.
ALTER TABLE sessions ADD COLUMN group_mode bool NOT NULL DEFAULT false;

-- courtMin[sessionId][courtIdx] — số phút mặc định của sân khi ghi trận không bấm giờ.
ALTER TABLE session_courts ADD COLUMN default_minutes int;

-- Buổi đột xuất có thể là của TOÀN CLB, không thuộc nhóm cố định nào (client dùng groupId
-- 'ALL' cho trường hợp này). Trước đây group_id NOT NULL nên buổi kiểu đó không lưu được.
ALTER TABLE sessions ALTER COLUMN group_id DROP NOT NULL;

-- manual[].by — tên người ghi dòng thu/chi tay. created_by là uuid tài khoản; cột này
-- giữ đúng chữ hiển thị trong sổ tại thời điểm ghi (người đó có thể rời CLB sau).
ALTER TABLE transactions ADD COLUMN payer_name text;

-- back_credits: client chỉ giữ cờ ĐÃ TRẢ, mấy con số kia tính lại được từ buổi + quỹ tháng.
-- Cho phép ghi dòng chỉ có (month, group, member, paid).
ALTER TABLE back_credits ALTER COLUMN sessions_total  SET DEFAULT 0;
ALTER TABLE back_credits ALTER COLUMN sessions_absent SET DEFAULT 0;
ALTER TABLE back_credits ALTER COLUMN unit_price      SET DEFAULT 0;
ALTER TABLE back_credits ALTER COLUMN amount          SET DEFAULT 0;

/* ============ C. CLB MỚI KHÔNG ĐƯỢC RỖNG TRƠ ============ */

-- Thêm 1 loại cầu mặc định để màn Kho cầu dùng được ngay. Sân / nhóm / thành viên vẫn do
-- chủ CLB tự nhập — đó là dữ liệu thật, không bịa hộ.
-- Bảng giá khách KHÔNG seed: client suy ra đủ dòng từ clubs.levels, thiếu thì hiện giá 0.
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
DECLARE new_club clubs; me profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF length(coalesce(trim(p_name), '')) < 2 THEN RAISE EXCEPTION 'Tên CLB quá ngắn'; END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name)
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.phone,
          COALESCE(me.gender, 'nam'), COALESCE(me.level, new_club.levels[1]),
          CURRENT_DATE, now());

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  RETURN new_club;
END;
$$;

/* ============ D. DUYỆT VÀO CLB: trình độ mặc định theo thang của CLB ============ */

-- Bản cũ gán cứng 'Newbie'; CLB đổi thang trình độ thì giá trị đó không còn tồn tại.
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request uuid, p_member_id uuid DEFAULT NULL)
RETURNS club_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE req club_join_requests; u profiles; m club_members; c clubs;
BEGIN
  SELECT * INTO req FROM club_join_requests WHERE id = p_request AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã xử lý'; END IF;
  IF NOT has_club_perm(req.club_id, 'members') THEN RAISE EXCEPTION 'Không có quyền duyệt thành viên'; END IF;

  SELECT * INTO u FROM profiles WHERE id = req.user_id;
  SELECT * INTO c FROM clubs WHERE id = req.club_id;

  IF p_member_id IS NOT NULL THEN
    -- Một user chỉ gắn 1 bản ghi trong 1 CLB: bỏ ghép bản ghi cũ trước.
    UPDATE club_members SET user_id = NULL
     WHERE club_id = req.club_id AND user_id = req.user_id AND id <> p_member_id;
    UPDATE club_members SET user_id = req.user_id, linked_at = now()
     WHERE id = p_member_id AND club_id = req.club_id
    RETURNING * INTO m;
    IF m.id IS NULL THEN RAISE EXCEPTION 'Bản ghi thành viên không thuộc CLB này'; END IF;
  ELSE
    INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
    VALUES (req.club_id, u.id, 'member', COALESCE(u.nick, u.name), u.phone,
            COALESCE(u.gender, 'nam'),
            CASE WHEN u.level = ANY (c.levels) THEN u.level ELSE c.levels[1] END,
            CURRENT_DATE, now())
    RETURNING * INTO m;
  END IF;

  UPDATE club_join_requests
     SET status = 'approved', matched_member_id = m.id, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_request;
  RETURN m;
END;
$$;

/* ============ E. DANH SÁCH CHỜ DUYỆT VÀO CLB ============ */

-- Người xin vào CLB CHƯA phải thành viên, nên policy profiles_same_club không cho đọc tên họ.
-- RPC này chạy quyền definer, chỉ trả đúng phần màn Cài đặt → Tài khoản & quyền cần hiện.
CREATE OR REPLACE FUNCTION public.club_pending_requests(p_club uuid)
RETURNS TABLE (
  id uuid, user_id uuid, note text, created_at timestamptz,
  name text, nick text, phone text, gender gender, level text
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.note, r.created_at,
         p.name, p.nick, p.phone, p.gender, p.level
    FROM club_join_requests r JOIN profiles p ON p.id = r.user_id
   WHERE r.club_id = p_club AND r.status = 'pending'
     AND has_club_perm(p_club, 'members')
   ORDER BY r.created_at;
$$;

COMMIT;

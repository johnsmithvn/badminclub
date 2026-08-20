-- 0002_auth_rls.sql — nối Supabase Auth, RPC nghiệp vụ, và RLS.
--
-- Đăng ký: email + username + mật khẩu (bắt buộc), SĐT không bắt buộc.
-- Đăng nhập: nhập email HOẶC username HOẶC SĐT → resolve_login() đổi ra email cho signInWithPassword.
-- KHÔNG gửi email xác thực, KHÔNG OTP (config.toml: enable_confirmations = false).

BEGIN;

/* ==================== tạo profile khi có tài khoản mới ==================== */

-- Trigger đọc raw_user_meta_data mà client truyền lúc signUp({ options: { data: {...} } }).
-- Làm bằng trigger để profile luôn tồn tại, không phụ thuộc client gọi thêm một lượt insert.
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
    (NULLIF(NEW.raw_user_meta_data->>'level', ''))::skill_level
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/* ==================== đăng nhập bằng email / username / SĐT ==================== */

-- Client chưa đăng nhập nên không đọc được profiles (RLS). Hàm này SECURITY DEFINER,
-- chỉ trả về đúng một cột email — không lộ thêm thông tin gì.
CREATE OR REPLACE FUNCTION public.resolve_login(identifier text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT email::text FROM profiles
  WHERE email = identifier::citext
     OR username = identifier::citext
     OR (phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(identifier, '\D', '', 'g')
         AND regexp_replace(identifier, '\D', '', 'g') <> '')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login(text) TO anon, authenticated;

-- Kiểm trùng khi điền form đăng ký. Trả về true nếu CÒN TRỐNG.
CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE username = p_username::citext);
$$;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

/* ==================== helper quyền ==================== */

-- Người đang đăng nhập có phải thành viên CLB này không.
CREATE OR REPLACE FUNCTION public.is_club_member(p_club uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = p_club AND user_id = auth.uid() AND active
  );
$$;

-- Người đang đăng nhập có cờ quyền này trong CLB không (money/members/sessions/assign/settings).
CREATE OR REPLACE FUNCTION public.has_club_perm(p_club uuid, p_flag text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE r club_role; ok boolean;
BEGIN
  SELECT role INTO r FROM club_members
   WHERE club_id = p_club AND user_id = auth.uid() AND active LIMIT 1;
  IF r IS NULL THEN RETURN false; END IF;
  SELECT CASE p_flag
           WHEN 'money'    THEN can_money
           WHEN 'members'  THEN can_members
           WHEN 'sessions' THEN can_sessions
           WHEN 'assign'   THEN can_assign
           WHEN 'settings' THEN can_settings
           WHEN 'view_all' THEN can_view_all
           ELSE false
         END INTO ok
    FROM role_permissions WHERE role = r;
  RETURN COALESCE(ok, false);
END;
$$;

-- CLB của một buổi tập (dùng cho RLS các bảng con không có club_id).
CREATE OR REPLACE FUNCTION public.club_of_session(p_session uuid)
RETURNS uuid
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$ SELECT club_id FROM sessions WHERE id = p_session $$;

/* ==================== tạo CLB / vào CLB bằng mã ==================== */

-- Mã 8 ký tự, bỏ chữ dễ đọc lẫn (0/O, 1/I).
CREATE OR REPLACE FUNCTION public.gen_club_code()
RETURNS char(8)
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE clubs.code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Tạo CLB: insert clubs + tự đưa người tạo thành owner trong một transaction.
-- Phải là RPC vì RLS không cho insert club_members vào CLB mà mình chưa là thành viên.
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

  INSERT INTO clubs (name, code, opening_balance, opening_date, lock_day, bank_holder, bank_no, bank_name)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date, p_lock_day,
          p_bank_holder, p_bank_no, p_bank_name)
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.phone,
          COALESCE(me.gender, 'nam'), COALESCE(me.level, 'Newbie'),
          CURRENT_DATE, now());

  RETURN new_club;
END;
$$;

-- Xin vào CLB bằng mã. Trả về bản ghi yêu cầu để client hiện trạng thái chờ.
CREATE OR REPLACE FUNCTION public.join_club_by_code(p_code text, p_note text DEFAULT NULL)
RETURNS club_join_requests
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE c clubs; req club_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT * INTO c FROM clubs WHERE code = upper(trim(p_code));
  IF c.id IS NULL THEN RAISE EXCEPTION 'Mã CLB không tồn tại'; END IF;
  IF NOT c.allow_code_join THEN RAISE EXCEPTION 'CLB này không cho vào bằng mã'; END IF;
  IF EXISTS (SELECT 1 FROM club_members WHERE club_id = c.id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Bạn đã là thành viên CLB này';
  END IF;

  INSERT INTO club_join_requests (club_id, user_id, code_used, note)
  VALUES (c.id, auth.uid(), c.code, NULLIF(trim(coalesce(p_note, '')), ''))
  ON CONFLICT DO NOTHING
  RETURNING * INTO req;

  IF req.id IS NULL THEN
    SELECT * INTO req FROM club_join_requests
     WHERE club_id = c.id AND user_id = auth.uid() AND status = 'pending';
  END IF;
  RETURN req;
END;
$$;

-- Chủ CLB duyệt: ghép vào bản ghi có sẵn (p_member_id) hoặc tạo thành viên mới (NULL).
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request uuid, p_member_id uuid DEFAULT NULL)
RETURNS club_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE req club_join_requests; u profiles; m club_members;
BEGIN
  SELECT * INTO req FROM club_join_requests WHERE id = p_request AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã xử lý'; END IF;
  IF NOT has_club_perm(req.club_id, 'members') THEN RAISE EXCEPTION 'Không có quyền duyệt thành viên'; END IF;

  SELECT * INTO u FROM profiles WHERE id = req.user_id;

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
            COALESCE(u.gender, 'nam'), COALESCE(u.level, 'Newbie'), CURRENT_DATE, now())
    RETURNING * INTO m;
  END IF;

  UPDATE club_join_requests
     SET status = 'approved', matched_member_id = m.id, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_request;
  RETURN m;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE req club_join_requests;
BEGIN
  SELECT * INTO req FROM club_join_requests WHERE id = p_request AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã xử lý'; END IF;
  IF NOT has_club_perm(req.club_id, 'members') THEN RAISE EXCEPTION 'Không có quyền duyệt thành viên'; END IF;
  UPDATE club_join_requests
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_request;
END;
$$;

-- Danh sách CLB của tôi + vai + số thành viên, cho màn "CLB của tôi".
CREATE OR REPLACE FUNCTION public.my_clubs()
RETURNS TABLE (
  id uuid, name text, code char(8), role club_role,
  member_count bigint, joined_at date
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.code, cm.role,
         (SELECT count(*) FROM club_members x WHERE x.club_id = c.id AND x.active),
         cm.joined_at
    FROM club_members cm JOIN clubs c ON c.id = cm.club_id
   WHERE cm.user_id = auth.uid() AND cm.active
   ORDER BY cm.joined_at, c.name;
$$;

-- Yêu cầu vào CLB của chính tôi đang chờ (để màn CLB hiện "đang chờ duyệt").
CREATE OR REPLACE FUNCTION public.my_join_requests()
RETURNS TABLE (id uuid, club_id uuid, club_name text, status join_state, created_at timestamptz)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.club_id, c.name, r.status, r.created_at
    FROM club_join_requests r JOIN clubs c ON c.id = r.club_id
   WHERE r.user_id = auth.uid()
   ORDER BY r.created_at DESC;
$$;

/* ============================== RLS ============================== */
-- Nguyên tắc: đọc được nếu là thành viên CLB; ghi được nếu có cờ quyền tương ứng.
-- Bảng con không có club_id thì join lên cha để lấy club_id.

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_join_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_courts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_locks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_courts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_guests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_price_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_lineups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_court_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_dues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE back_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_bills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_purchases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_checks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_links          ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- profiles: tự đọc/sửa mình; đọc được profile của người cùng CLB.
CREATE POLICY profiles_self ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_same_club ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM club_members me
     JOIN club_members other ON other.club_id = me.club_id
    WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
  )
);
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- role_permissions: ai đăng nhập cũng đọc được (bảng tra cứu).
CREATE POLICY role_perm_read ON role_permissions FOR SELECT TO authenticated USING (true);

-- clubs: thành viên đọc; chỉ vai có cờ settings được sửa. Tạo CLB đi qua RPC create_club.
CREATE POLICY clubs_read ON clubs FOR SELECT USING (is_club_member(id));
CREATE POLICY clubs_update ON clubs FOR UPDATE USING (has_club_perm(id, 'settings'))
  WITH CHECK (has_club_perm(id, 'settings'));

-- club_members: thành viên đọc cả danh sách; chỉ cờ members được thêm/sửa.
CREATE POLICY cm_read ON club_members FOR SELECT USING (is_club_member(club_id));
CREATE POLICY cm_write ON club_members FOR INSERT WITH CHECK (has_club_perm(club_id, 'members'));
CREATE POLICY cm_update ON club_members FOR UPDATE USING (has_club_perm(club_id, 'members'))
  WITH CHECK (has_club_perm(club_id, 'members'));

-- club_join_requests: người xin thấy yêu cầu của mình; chủ CLB thấy của CLB mình.
CREATE POLICY jr_read_own ON club_join_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY jr_read_admin ON club_join_requests FOR SELECT USING (has_club_perm(club_id, 'members'));

CREATE POLICY inv_read ON club_invites FOR SELECT USING (is_club_member(club_id));
CREATE POLICY inv_write ON club_invites FOR INSERT WITH CHECK (has_club_perm(club_id, 'members'));
CREATE POLICY inv_update ON club_invites FOR UPDATE USING (has_club_perm(club_id, 'members'))
  WITH CHECK (has_club_perm(club_id, 'members'));

/* --- bảng có club_id: sinh policy bằng vòng lặp cho gọn và khỏi sai sót --- */
DO $$
DECLARE
  t record;
  spec text[][] := ARRAY[
    ['courts',            'settings'],
    ['member_groups',     'settings'],
    ['guest_price_rules', 'settings'],
    ['shuttle_types',     'settings'],
    ['schedules',         'sessions'],
    ['sessions',          'sessions'],
    ['roster_locks',      'members'],
    ['monthly_dues',      'money'],
    ['back_credits',      'money'],
    ['court_bills',       'money'],
    ['transactions',      'money'],
    ['shuttle_purchases', 'money'],
    ['shuttle_movements', 'money'],
    ['stock_checks',      'money'],
    ['guests',            'sessions'],
    ['notifications',     'settings'],
    ['zalo_links',        'settings'],
    ['audit_logs',        'settings']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_read ON %1$s FOR SELECT USING (is_club_member(club_id));',
      spec[i][1]);
    EXECUTE format(
      'CREATE POLICY %1$s_ins ON %1$s FOR INSERT WITH CHECK (has_club_perm(club_id, %2$L));',
      spec[i][1], spec[i][2]);
    EXECUTE format(
      'CREATE POLICY %1$s_upd ON %1$s FOR UPDATE USING (has_club_perm(club_id, %2$L)) '
      'WITH CHECK (has_club_perm(club_id, %2$L));',
      spec[i][1], spec[i][2]);
    EXECUTE format(
      'CREATE POLICY %1$s_del ON %1$s FOR DELETE USING (has_club_perm(club_id, %2$L));',
      spec[i][1], spec[i][2]);
  END LOOP;
END $$;

/* --- bảng con của sessions: lấy club_id qua club_of_session() --- */
DO $$
DECLARE
  t text;
  spec text[][] := ARRAY[
    ['session_courts',       'sessions'],
    ['attendances',          'sessions'],
    ['session_guests',       'sessions'],
    ['session_lineups',      'assign'],
    ['session_court_groups', 'assign'],
    ['matches',              'assign']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(spec, 1) LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_read ON %1$s FOR SELECT USING (is_club_member(club_of_session(session_id)));',
      spec[i][1]);
    EXECUTE format(
      'CREATE POLICY %1$s_ins ON %1$s FOR INSERT WITH CHECK (has_club_perm(club_of_session(session_id), %2$L));',
      spec[i][1], spec[i][2]);
    EXECUTE format(
      'CREATE POLICY %1$s_upd ON %1$s FOR UPDATE USING (has_club_perm(club_of_session(session_id), %2$L)) '
      'WITH CHECK (has_club_perm(club_of_session(session_id), %2$L));',
      spec[i][1], spec[i][2]);
    EXECUTE format(
      'CREATE POLICY %1$s_del ON %1$s FOR DELETE USING (has_club_perm(club_of_session(session_id), %2$L));',
      spec[i][1], spec[i][2]);
  END LOOP;
END $$;

-- group_courts / group_memberships / schedule_slots / member_changes / match_players:
-- không có club_id lẫn session_id, join lên cha.
CREATE POLICY gc_read ON group_courts FOR SELECT USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND is_club_member(g.club_id)));
CREATE POLICY gc_all ON group_courts FOR ALL USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'settings')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'settings')));

CREATE POLICY gm_read ON group_memberships FOR SELECT USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND is_club_member(g.club_id)));
CREATE POLICY gm_all ON group_memberships FOR ALL USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'members')));

CREATE POLICY ss_read ON schedule_slots FOR SELECT USING (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND is_club_member(s.club_id)));
CREATE POLICY ss_all ON schedule_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND has_club_perm(s.club_id, 'sessions')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND has_club_perm(s.club_id, 'sessions')));

-- member_changes: chính chủ tạo/xem được, người có cờ members duyệt được.
CREATE POLICY mc_read ON member_changes FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id
          AND (m.user_id = auth.uid() OR is_club_member(m.club_id))));
CREATE POLICY mc_ins ON member_changes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id
          AND (m.user_id = auth.uid() OR has_club_perm(m.club_id, 'members'))));
CREATE POLICY mc_upd ON member_changes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')));

CREATE POLICY mp_read ON match_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND is_club_member(club_of_session(m.session_id))));
CREATE POLICY mp_all ON match_players FOR ALL USING (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND has_club_perm(club_of_session(m.session_id), 'assign')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND has_club_perm(club_of_session(m.session_id), 'assign')));

-- device_tokens: của riêng mỗi user.
CREATE POLICY dt_own ON device_tokens FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMIT;

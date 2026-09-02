-- Migration 0010: hai tên + email trong sổ CLB · thành viên tự đổi tên mình · đăng ký bằng email.
--
-- BỐN VIỆC:
--
--   1. `club_members` có thêm `email` và `full_name`, cả hai KHÔNG bắt buộc.
--
--      `full_name` = tên đầy đủ, `name` = TÊN HIỂN THỊ trong CLB (giống cặp `profiles.name` /
--      `profiles.nick`). Mọi màn vẫn đọc `name` như cũ — không đổi chỗ nào đang chạy; tên đầy đủ
--      chỉ hiện nhỏ bên dưới ở màn danh sách và hồ sơ.
--
--      `email` cùng lý do với `phone`: chủ CLB nhập tay để liên lạc, người đó chưa cần có tài
--      khoản. KHÔNG UNIQUE — cả nhà dùng chung một email là chuyện thường, chặn cứng ở đây là
--      chặn oan việc nhập liệu.
--
--      Nó KHÔNG phải `profiles.email`: cột kia là danh tính đăng nhập (UNIQUE, khớp
--      `auth.users.email`, chỉ đổi được qua Supabase Auth). Cột này chỉ là thông tin liên lạc
--      trong sổ của một CLB, sửa thoải mái, và giống mọi cột khác của `club_members`, nó là bản
--      sao độc lập — không tự đổi theo hồ sơ tài khoản.
--
--   2. `approve_join_request` nhận thêm 'email' trong `p_fields`, và nhánh tạo thành viên mới
--      chép luôn email của tài khoản xuống.
--
--   3. Thành viên TỰ đổi được tên của mình trong CLB (`name`, `full_name`) — thêm lại policy
--      UPDATE cho chính chủ, nhưng lần này có trigger chặn đúng phạm vi: mọi cột khác phải giữ
--      nguyên. So bằng `to_jsonb(NEW) - 'name' - 'full_name'` chứ không liệt kê từng cột: thêm
--      cột mới sau này mà quên sửa trigger thì cột đó tự động bị chặn, không bị lọt.
--      (0009 gỡ `cm_update_self` vì nó KHÔNG giới hạn cột — tự đặt `role = 'owner'` được.)
--      Trình độ · SĐT · vai vẫn phải xin duyệt qua `member_changes`.
--
--   4. Form đăng ký thôi hỏi **tên đăng nhập**: email là tên đăng nhập. Cột `profiles.username`
--      GIỮ NGUYÊN (NOT NULL UNIQUE) — tài khoản cũ đang dùng nó và `resolve_login` vẫn cho đăng
--      nhập bằng username — nên trigger tự sinh từ phần trước dấu @, thêm số đuôi khi trùng.
--      Không tự sinh thì `abc@gmail.com` và `abc@yahoo.com` đụng UNIQUE và người thứ hai nhận
--      một câu lỗi về "tên đăng nhập" mà họ chưa từng nhập.
--
-- ⚠️ KHÔNG đụng dữ liệu đang có.

BEGIN;

/* ==================== 1. Email trong sổ thành viên của CLB ==================== */

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS email citext;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS full_name text;

COMMENT ON COLUMN club_members.email IS
  'Email liên lạc trong sổ của CLB. KHÔNG bắt buộc, KHÔNG unique, KHÔNG phải danh tính đăng '
  'nhập (cái đó là profiles.email). Bản sao độc lập như mọi cột khác của club_members.';

COMMENT ON COLUMN club_members.name IS
  'TÊN HIỂN THỊ trong CLB — cái tên nằm trên mọi bảng điểm danh, mọi dòng tiền, mọi báo cáo. '
  'NOT NULL. Tương ứng profiles.nick.';

COMMENT ON COLUMN club_members.full_name IS
  'Tên đầy đủ, KHÔNG bắt buộc. Chỉ để đối chiếu khi cần (chuyển khoản, danh sách giấy) — hiện '
  'nhỏ bên dưới tên hiển thị, không thay nó ở đâu cả. Tương ứng profiles.name.';

/* ============ 2. Ghép: cho tick thêm trường email và tên đầy đủ ============ */

CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request   uuid,
  p_member_id uuid   DEFAULT NULL,
  p_fields    text[] DEFAULT '{}'
)
RETURNS club_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE req club_join_requests; u profiles; m club_members; c clubs; f text[];
BEGIN
  SELECT * INTO req FROM club_join_requests WHERE id = p_request AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã xử lý'; END IF;
  IF NOT has_club_perm(req.club_id, 'members') THEN RAISE EXCEPTION 'Không có quyền duyệt thành viên'; END IF;

  SELECT * INTO u FROM profiles WHERE id = req.user_id;
  SELECT * INTO c FROM clubs WHERE id = req.club_id;
  IF u.id IS NULL AND p_member_id IS NULL THEN
    RAISE EXCEPTION 'Người xin vào chưa có hồ sơ. Ghép họ vào một bản ghi thành viên có sẵn, hoặc bảo họ đăng nhập lại một lượt.';
  END IF;

  f := COALESCE(p_fields, '{}');

  IF p_member_id IS NOT NULL THEN
    UPDATE club_members SET user_id = NULL
     WHERE club_id = req.club_id AND user_id = req.user_id AND id <> p_member_id;

    UPDATE club_members SET
      user_id   = req.user_id,
      linked_at = now(),
      name      = CASE WHEN 'name' = ANY (f) AND COALESCE(NULLIF(u.nick, ''), NULLIF(u.name, '')) IS NOT NULL
                       THEN COALESCE(NULLIF(u.nick, ''), u.name) ELSE name END,
      phone     = CASE WHEN 'phone' = ANY (f) AND NULLIF(u.phone, '') IS NOT NULL
                       THEN u.phone ELSE phone END,
      email     = CASE WHEN 'email' = ANY (f) AND u.email IS NOT NULL
                       THEN u.email ELSE email END,
      -- `fullName` lấy `profiles.name` (tên đầy đủ), còn `name` ở trên lấy nick — hai tên khác
      -- nhau, tick riêng. Đặt tên khoá theo camelCase cho khớp client, không phải tên cột.
      full_name = CASE WHEN 'fullName' = ANY (f) AND NULLIF(u.name, '') IS NOT NULL
                       THEN u.name ELSE full_name END,
      gender    = CASE WHEN 'gender' = ANY (f) AND u.gender IS NOT NULL
                       THEN u.gender ELSE gender END,
      -- Ngoài thang của CLB thì BỎ QUA, không hạ về bậc thấp nhất (xem 0009).
      level     = CASE WHEN 'level' = ANY (f) AND u.level = ANY (c.levels)
                       THEN u.level ELSE level END
     WHERE id = p_member_id AND club_id = req.club_id
    RETURNING * INTO m;

    IF m.id IS NULL THEN RAISE EXCEPTION 'Bản ghi thành viên không thuộc CLB này'; END IF;
  ELSE
    INSERT INTO club_members (club_id, user_id, role, name, full_name, phone, email, gender, level, joined_at, linked_at)
    VALUES (req.club_id, u.id, 'member', COALESCE(NULLIF(u.nick, ''), u.name), u.name, u.phone, u.email,
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

COMMENT ON FUNCTION public.approve_join_request(uuid, uuid, text[]) IS
  'Duyệt yêu cầu vào CLB. p_member_id = ghép vào bản ghi có sẵn, NULL = tạo thành viên mới. '
  'p_fields: các trường (name · fullName · phone · email · gender · level) lấy từ hồ sơ tài '
  'khoản đè lên '
  'bản ghi khi ghép; rỗng = chỉ gắn tài khoản. role KHÔNG bao giờ lấy từ hồ sơ tài khoản, level '
  'chỉ ghi khi thuộc clubs.levels.';

/* ============ 3. create_club: ghi luôn tên đầy đủ và email của người tạo ============ */

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

  INSERT INTO club_members (club_id, user_id, role, name, full_name, phone, email, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.name, me.phone, me.email,
          COALESCE(me.gender, 'nam'),
          -- Thang trình độ là của TỪNG CLB (0009): ngoài thang thì lấy bậc thấp nhất.
          CASE WHEN me.level = ANY (new_club.levels) THEN me.level ELSE new_club.levels[1] END,
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  -- Cố ý DỪNG Ở ĐÂY (0008). Không sinh nhóm "Cố định", không gán owner vào nhóm nào.

  RETURN new_club;
END;
$$;

/* ============ 3b. Màn duyệt phải đọc được email của người xin vào ============ */

/* `club_pending_requests` là nguồn DUY NHẤT cho hồ sơ của người đang xin vào: họ chưa phải
 * thành viên nên policy `profiles_same_club` không cho client đọc `profiles` của họ. Thiếu cột
 * `email` ở đây thì ô tick Email trong bảng ghép luôn hiện "Hồ sơ tài khoản để trống" — bảng
 * chọn trường nói dối, và không ai đoán ra vì sao.
 *
 * DROP trước: đổi danh sách cột của một hàm RETURNS TABLE thì `CREATE OR REPLACE` báo
 * "cannot change return type of existing function". */
DROP FUNCTION IF EXISTS public.club_pending_requests(uuid);

CREATE OR REPLACE FUNCTION public.club_pending_requests(p_club uuid)
RETURNS TABLE (
  id uuid, user_id uuid, note text, created_at timestamptz,
  name text, nick text, phone text, email text, gender gender, level text
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.note, r.created_at,
         p.name, p.nick, p.phone, p.email::text, p.gender, p.level
    FROM club_join_requests r JOIN profiles p ON p.id = r.user_id
   WHERE r.club_id = p_club AND r.status = 'pending'
     AND has_club_perm(p_club, 'members')
   ORDER BY r.created_at;
$$;

/* ============ 4. Thành viên tự đổi TÊN của mình trong CLB ============ */

/* Chỉ hai cột `name` và `full_name`, không hơn.
 *
 * RLS không so được OLD với NEW nên policy một mình không đủ — nó chỉ biết "dòng này của bạn",
 * không biết "bạn vừa đổi cột nào". Trigger dưới đây làm phần đó, và cố ý so bằng
 * `to_jsonb(...) - 'name' - 'full_name'` thay vì liệt kê từng cột: thêm cột mới vào bảng sau
 * này mà quên sửa trigger thì cột đó tự động bị chặn thay vì lọt qua trong im lặng.
 *
 * Người có cờ quyền `members` đi thẳng, không đụng trigger — họ vốn sửa được cả bảng.
 *
 * SĐT · trình độ · vai KHÔNG nằm trong phạm vi này: trình độ là đầu vào của giá khách và cân
 * sân, SĐT là thứ chủ CLB dùng để đối chiếu chuyển khoản và ghép tài khoản. Hai cái đó xin qua
 * `member_changes` rồi chủ CLB duyệt. */

CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF has_club_perm(NEW.club_id, 'members') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'name' - 'full_name') IS DISTINCT FROM (to_jsonb(OLD) - 'name' - 'full_name') THEN
    RAISE EXCEPTION 'Bạn chỉ đổi được tên hiển thị và tên đầy đủ của mình. Trình độ, số điện thoại và vai trò phải nhờ chủ CLB duyệt.';
  END IF;
  IF length(coalesce(trim(NEW.name), '')) = 0 THEN
    RAISE EXCEPTION 'Tên hiển thị không được để trống';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cm_guard_self_update ON club_members;
CREATE TRIGGER cm_guard_self_update
  BEFORE UPDATE ON club_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_self_update();

DROP POLICY IF EXISTS cm_update_self_name ON club_members;
CREATE POLICY cm_update_self_name ON club_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

/* ============ 5. Đăng ký bằng email: username tự sinh ============ */

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE base text; uname text; n int := 0;
BEGIN
  -- Form đăng ký không hỏi tên đăng nhập nữa: EMAIL là tên đăng nhập. Nhưng cột `username` vẫn
  -- NOT NULL UNIQUE và `resolve_login` vẫn cho đăng nhập bằng nó (tài khoản cũ đang dùng), nên
  -- sinh từ phần trước dấu @. Trùng thì thêm số: `abc@gmail.com` và `abc@yahoo.com` cùng ra
  -- 'abc', không xử lý thì người thứ hai đâm vào UNIQUE và đọc một câu lỗi về thứ họ chưa nhập.
  base := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9._-]', '', 'g');
  base := left(base, 24);
  IF length(base) < 3 THEN base := 'user' || base; END IF;

  uname := base;
  -- ponytail: vòng lặp này không khoá gì cả — hai người đăng ký CÙNG một base trong cùng mili
  -- giây vẫn có thể chọn trùng và người sau nhận lỗi UNIQUE (client dịch thành câu tiếng Việt).
  -- Muốn chắc thì phải retry trong EXCEPTION hoặc thêm sequence; chưa đáng cho ca hiếm đó.
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = uname::citext) LOOP
    n := n + 1;
    uname := base || n::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, email, phone, name, nick, gender, level)
  VALUES (
    NEW.id,
    -- Vẫn nhận username client gửi (nếu có) để không phá client cũ; không gửi thì dùng bản tự sinh.
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), uname),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'nick', ''),
    (NULLIF(NEW.raw_user_meta_data->>'gender', ''))::gender,
    NULLIF(NEW.raw_user_meta_data->>'level', '')   -- text, KHÔNG cast enum
  );
  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Cột mới có mặt và cho phép NULL:

        SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
         WHERE table_name = 'club_members' AND column_name = 'email';
        -- mong đợi: email · USER-DEFINED (citext) · YES

   b) Thành viên thường KHÔNG leo quyền được — đăng nhập bằng tài khoản vai `member` rồi thử:

        UPDATE club_members SET role = 'owner' WHERE user_id = auth.uid();
        -- mong đợi: lỗi "Bạn chỉ đổi được tên hiển thị và tên đầy đủ của mình..."
        UPDATE club_members SET name = 'Tên mới' WHERE user_id = auth.uid();
        -- mong đợi: 1 dòng được sửa

   c) Username tự sinh không đụng nhau — đăng ký thử hai tài khoản cùng phần trước @
      (vd `thu@gmail.com` và `thu@yahoo.com`), rồi:

        SELECT email, username FROM profiles ORDER BY created_at DESC LIMIT 2;
        -- mong đợi: 'thu' và 'thu1', không có lỗi duplicate key
*/

-- Migration 0009: Tách hồ sơ TÀI KHOẢN khỏi hồ sơ THÀNH VIÊN, và ghép có chọn trường.
--
-- BA VIỆC, một transaction:
--
--   1. GỠ policy `cm_update_self` (0006). Nó chỉ kiểm `user_id = auth.uid()` mà KHÔNG giới hạn
--      cột, nên một lệnh PostgREST là thành viên thường tự đặt `role = 'owner'` — hoặc tự bật
--      lại `active`, tự sửa `joined_at`. Lỗ leo thang quyền, không phải lỗi phong cách.
--      Đường hợp lệ để thành viên sửa thông tin của mình trong CLB là bảng `member_changes`
--      (policy `mc_ins` đã cho chính chủ ghi) rồi chủ CLB duyệt. Không cần policy UPDATE nào.
--
--      Cố ý KHÔNG thay bằng trigger chặn cột: RLS đã không còn cho thành viên thường UPDATE
--      dòng nào của `club_members`, thêm trigger là gác một cánh cửa đã khoá.
--
--   2. `approve_join_request` nhận thêm `p_fields` — danh sách trường mà chủ CLB TICK để lấy
--      từ hồ sơ tài khoản đè lên bản ghi thành viên. Không tick trường nào (mặc định) thì ghép
--      chỉ gắn `user_id`, y như trước. Đây là điểm khác biệt cốt lõi giữa hai bảng:
--      `club_members` là BẢN SAO tại thời điểm ghi, không phải khung nhìn của `profiles` —
--      sau này người đó đổi tên trong tài khoản thì CLB không đổi theo, và ngược lại.
--
--      `role` KHÔNG bao giờ nằm trong `p_fields`: vai trò là dữ liệu của CLB, hồ sơ tài khoản
--      không có quyền đụng tới. `level` chỉ ghi khi giá trị đó thuộc thang `clubs.levels` của
--      CLB — thang trình độ là dữ liệu riêng từng CLB (RULES §3.4), lấy 'TB+' của CLB khác đè
--      vào CLB chỉ có 4 bậc là `db.levels.indexOf(level)` ra -1: sắp xếp trình độ và cân sân
--      sai im lặng, không có gì báo.
--
--   3. `create_club` gác `level` cùng một luật. Trước đây `COALESCE(me.level, levels[1])` lấy
--      thẳng trình độ trong hồ sơ tài khoản, mà CLB mới dùng thang mặc định của DB — người tạo
--      CLB có level ngoài thang ngay từ dòng đầu tiên. `approve_join_request` đã gác từ 0001,
--      chỗ này bị sót.
--
-- ⚠️ KHÔNG đụng dữ liệu đang có. Không xoá, không sửa dòng nào.

BEGIN;

/* ==================== 1. Đóng đường tự sửa vai ==================== */

DROP POLICY IF EXISTS cm_update_self ON club_members;

COMMENT ON TABLE club_members IS
  'Hồ sơ của một người TRONG một CLB. Là bản sao độc lập, KHÔNG phải khung nhìn của profiles: '
  'ghép tài khoản chỉ gắn user_id, muốn lấy dữ liệu từ hồ sơ tài khoản thì phải tick trường ở '
  'màn duyệt (approve_join_request.p_fields). Thành viên thường KHÔNG có policy UPDATE nào — '
  'họ xin sửa qua member_changes, người có cờ quyền members duyệt.';

/* ==================== 2. Ghép có chọn trường ==================== */

-- DROP trước khi tạo bản 3 tham số: `CREATE OR REPLACE` với số tham số khác là tạo hàm NẠP
-- CHỒNG, không phải thay thế. Hai hàm cùng tên rồi PostgREST gọi `{p_request, p_member_id}`
-- sẽ không chọn được cái nào ("Could not choose the best candidate function") và nút Ghép
-- chết ngay sau khi apply migration.
DROP FUNCTION IF EXISTS public.approve_join_request(uuid, uuid);

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
  -- Cùng bẫy với create_club: profile mồ côi thì nhánh "tạo thành viên mới" dưới sẽ ghi
  -- name = NULL và chết ở ràng buộc NOT NULL. Nhánh "ghép vào bản ghi có sẵn" thì không sao —
  -- mọi trường đều có nhánh ELSE giữ nguyên giá trị cũ.
  IF u.id IS NULL AND p_member_id IS NULL THEN
    RAISE EXCEPTION 'Người xin vào chưa có hồ sơ. Ghép họ vào một bản ghi thành viên có sẵn, hoặc bảo họ đăng nhập lại một lượt.';
  END IF;

  f := COALESCE(p_fields, '{}');

  IF p_member_id IS NOT NULL THEN
    -- Một user chỉ gắn 1 bản ghi trong 1 CLB: bỏ ghép bản ghi cũ TRƯỚC, không thì UNIQUE
    -- (club_id, user_id) chặn ngang câu UPDATE dưới.
    UPDATE club_members SET user_id = NULL
     WHERE club_id = req.club_id AND user_id = req.user_id AND id <> p_member_id;

    -- Mỗi trường: tick VÀ có giá trị thật thì mới ghi đè, còn lại giữ nguyên cái CLB đang có.
    -- Không tick gì = chỉ gắn tài khoản, đúng hành vi cũ.
    UPDATE club_members SET
      user_id   = req.user_id,
      linked_at = now(),
      name      = CASE WHEN 'name' = ANY (f) AND COALESCE(NULLIF(u.nick, ''), NULLIF(u.name, '')) IS NOT NULL
                       THEN COALESCE(NULLIF(u.nick, ''), u.name) ELSE name END,
      phone     = CASE WHEN 'phone' = ANY (f) AND NULLIF(u.phone, '') IS NOT NULL
                       THEN u.phone ELSE phone END,
      gender    = CASE WHEN 'gender' = ANY (f) AND u.gender IS NOT NULL
                       THEN u.gender ELSE gender END,
      -- Ngoài thang của CLB thì BỎ QUA, không phải rơi về levels[1]: người duyệt đang nhìn
      -- một trình độ cụ thể, hạ thầm xuống bậc thấp nhất là đổi tiền khách và cách cân sân
      -- mà không ai thấy. Client cũng khoá ô tick này và nói rõ vì sao.
      level     = CASE WHEN 'level' = ANY (f) AND u.level = ANY (c.levels)
                       THEN u.level ELSE level END
     WHERE id = p_member_id AND club_id = req.club_id
    RETURNING * INTO m;

    IF m.id IS NULL THEN RAISE EXCEPTION 'Bản ghi thành viên không thuộc CLB này'; END IF;
  ELSE
    -- Tạo mới: lấy trọn hồ sơ tài khoản, `p_fields` không có vai trò gì ở đây (không có dữ
    -- liệu cũ nào để giữ). `level` vẫn gác theo thang của CLB.
    INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
    VALUES (req.club_id, u.id, 'member', COALESCE(NULLIF(u.nick, ''), u.name), u.phone,
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
  'p_fields: các trường (name · phone · gender · level) lấy từ hồ sơ tài khoản đè lên bản ghi '
  'khi ghép; rỗng = chỉ gắn tài khoản. role KHÔNG bao giờ lấy từ hồ sơ tài khoản, level chỉ ghi '
  'khi thuộc clubs.levels.';

/* ==================== 3. create_club: gác trình độ theo thang CLB ==================== */

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
          COALESCE(me.gender, 'nam'),
          -- Thang trình độ là của TỪNG CLB. Hồ sơ tài khoản giữ 'TB+' từ CLB cũ mà CLB mới chỉ
          -- có 4 bậc thì `db.levels.indexOf(level)` ra -1: cột trình độ sắp sai, thuật toán cân
          -- sân đọc sai bậc, và không màn nào lộ ra. Ngoài thang thì lấy bậc thấp nhất.
          CASE WHEN me.level = ANY (new_club.levels) THEN me.level ELSE new_club.levels[1] END,
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  -- Cố ý DỪNG Ở ĐÂY (0008). Không sinh nhóm "Cố định", không gán owner vào nhóm nào.

  RETURN new_club;
END;
$$;

COMMENT ON FUNCTION public.create_club(text, bigint, date, int, text, text, text) IS
  'Tạo CLB + bản ghi owner + một loại cầu mặc định. KHÔNG sinh nhóm cố định (0008). Trình độ '
  'của owner lấy từ hồ sơ tài khoản CHỈ KHI thuộc thang của CLB mới (0009).';

COMMIT;

-- PostgREST giữ cache chữ ký hàm. Không nạp lại thì client vẫn gọi bản 2 tham số và nhận 404.
NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Chỉ còn MỘT approve_join_request, và nó có 3 tham số:

        SELECT oid::regprocedure FROM pg_proc WHERE proname = 'approve_join_request';
        -- mong đợi: approve_join_request(uuid,uuid,text[])

   b) club_members không còn policy UPDATE nào cho chính chủ:

        SELECT policyname, cmd FROM pg_policies
         WHERE tablename = 'club_members' ORDER BY policyname;
        -- mong đợi: cm_read (SELECT) · cm_write (INSERT) · cm_update (UPDATE, theo cờ quyền)
        -- KHÔNG được còn cm_update_self

   c) Thử leo quyền bằng chính tài khoản thành viên thường (chạy ở SQL editor với vai đó,
      hoặc từ client): UPDATE club_members SET role='owner' WHERE user_id = auth.uid();
      -- mong đợi: 0 dòng bị sửa
*/

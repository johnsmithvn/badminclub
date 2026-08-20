/* =====================================================================
   0007_member_adjustments.sql — Đối chiếu buổi HAI CHIỀU + đơn giá đúng
   Đặc tả: docs/DATABASE.md §8 mục 1 · TASKS.md Phase 9 · P3

   Vì sao cần:
   Hôm nay `back_credits` chỉ chạy MỘT chiều — trả lại tiền cho người cố định nghỉ buổi.
   Chiều ngược lại không có chỗ ghi:

     Anh B cố định nhóm T6, đã đóng quỹ nhóm T6. Chủ nhật anh đi thêm một buổi nhóm CN.
     Anh phải trả 63.000 cho buổi đó — nhưng anh không nằm trong monthly_dues nhóm CN,
     và cũng không phải khách giao lưu.

   Cách duy nhất để thu bây giờ là nhét anh vào `session_guests` với giá khách 75.000. Sai ba chỗ:
   anh là thành viên chứ không phải khách · thu vượt 12.000 · báo cáo "khách theo trình độ" và
   "số lượt khách" phồng lên vì đếm cả người nhà.

   Cùng một đơn giá, hai chiều, chỉ khác dấu:
     absent_back    vắng buổi cố định      amount ÂM     quỹ nợ người
     extra_session  đi thêm buổi nhóm khác amount DƯƠNG  người nợ quỹ

   AN TOÀN:
   - KHÔNG xoá `back_credits`, KHÔNG xoá dữ liệu. Bảng cũ được chuyển sang bảng mới rồi để đó
     (RULES §4: không xoá cứng dữ liệu dính tiền). App thôi không đọc `back_credits` nữa.
   - CHẠY LẠI ĐƯỢC nhiều lần.
   ===================================================================== */

/* ---------- 1. Điểm danh có thêm trạng thái "đi thêm" ---------- */

/* Đây là nguồn sinh ra `extra_session`. `IF NOT EXISTS` cần Postgres 12+; Supabase dùng 15/17
   nên chạy trong transaction của SQL editor được, miễn là không dùng giá trị mới ngay trong
   cùng transaction — file này chỉ THÊM giá trị chứ không ghi dòng nào dùng nó. */

ALTER TYPE attend_state ADD VALUE IF NOT EXISTS 'extra';

/* ---------- 2. Hai enum của bảng đối chiếu ---------- */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjust_kind') THEN
    CREATE TYPE adjust_kind AS ENUM ('absent_back', 'extra_session');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settle_mode') THEN
    -- 'offset_next_dues': anh A được back 63.000 nhưng không nhận tiền mặt, xin trừ vào quỹ
    -- tháng sau → tháng sau đóng 187.000. Rất hay gặp, trước đây DB không ghi được.
    CREATE TYPE settle_mode AS ENUM ('cash', 'offset_next_dues');
  END IF;
END $$;

/* ---------- 3. Bảng đối chiếu ---------- */

CREATE TABLE IF NOT EXISTS member_adjustments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  month      char(7) NOT NULL,
  group_id   uuid NOT NULL REFERENCES member_groups(id),  -- nhóm SINH RA đơn giá
  member_id  uuid NOT NULL REFERENCES club_members(id),
  kind       adjust_kind NOT NULL,
  sessions   int    NOT NULL DEFAULT 0,   -- số buổi vắng, hoặc số buổi đi thêm
  unit_price bigint NOT NULL DEFAULT 0,   -- đơn giá 1 buổi — ngoại lệ ĐƯỢC làm tròn khi lưu
  amount     bigint NOT NULL DEFAULT 0,   -- ÂM = quỹ nợ người · DƯƠNG = người nợ quỹ
  settle     settle_mode NOT NULL DEFAULT 'cash',
  paid       bool NOT NULL DEFAULT false,
  paid_at    date,
  UNIQUE (month, group_id, member_id, kind)
);

CREATE INDEX IF NOT EXISTS member_adjustments_month_idx ON member_adjustments (club_id, month);

COMMENT ON COLUMN member_adjustments.amount IS
  'ÂM = quỹ nợ người (vắng, được back) · DƯƠNG = người nợ quỹ (đi thêm buổi). '
  'Con số này ĐÓNG BĂNG lúc chốt: sửa quỹ nhóm hay sửa điểm danh về sau không được làm đổi '
  'khoản đã trả. Cùng nguyên tắc với sessions.cost_* — dữ liệu đã chốt thì lưu, không tính lại.';

COMMENT ON COLUMN member_adjustments.settle IS
  'cash = ghi một dòng transactions khi paid. offset_next_dues = KHÔNG ghi giao dịch nào, '
  'trừ thẳng vào monthly_dues.amount của tháng sau lúc chốt danh sách.';

/* ---------- 4. RLS: đúng khuôn của back_credits (cờ quyền `money`) ---------- */

ALTER TABLE member_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS madj_read ON member_adjustments;
CREATE POLICY madj_read ON member_adjustments FOR SELECT USING (is_club_member(club_id));

DROP POLICY IF EXISTS madj_all ON member_adjustments;
CREATE POLICY madj_all ON member_adjustments FOR ALL
  USING (has_club_perm(club_id, 'money')) WITH CHECK (has_club_perm(club_id, 'money'));

/* 0006 đã đặt default privileges cho schema public nên bảng mới tự có GRANT. Cấp lại cho chắc,
   phòng trường hợp file này chạy trên DB chưa apply 0006. */
GRANT SELECT, INSERT, UPDATE, DELETE ON member_adjustments TO authenticated;

/* ---------- 5. Chuyển dữ liệu back_credits cũ sang ---------- */

/* back_credits chỉ được client ghi cờ `paid`, mấy cột số đều để DEFAULT 0 (xem 0003) — nên
   dòng chuyển sang cũng mang số 0. Không bịa số: chuyển để không mất dấu vết ai đã được trả,
   còn số tiền thì bảng mới tính lại từ điểm danh + quỹ tháng cho tới khi có người chốt. */

INSERT INTO member_adjustments (club_id, month, group_id, member_id, kind,
                                sessions, unit_price, amount, settle, paid, paid_at)
SELECT club_id, month, group_id, member_id, 'absent_back',
       sessions_absent, unit_price, -abs(amount), 'cash', paid, paid_at
  FROM back_credits
ON CONFLICT (month, group_id, member_id, kind) DO NOTHING;

/* `back_credits` GIỮ NGUYÊN, không DROP — dữ liệu dính tiền thì không xoá cứng. App từ bản này
   không đọc/ghi bảng đó nữa. */

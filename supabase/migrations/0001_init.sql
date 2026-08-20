-- 0001_init.sql — schema khởi tạo cho Quản lý CLB cầu lông
-- Nguồn: design_handoff_clb_cau_long/03-data-model.md
-- Sửa so với handoff: bảng `users` thay bằng `profiles` gắn vào auth.users của Supabase,
-- thêm `username` (tên đăng nhập bắt buộc) và cho `phone` nullable.
--
-- CHẠY BẰNG:  psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
-- KHÔNG dùng `supabase db reset` — lệnh đó xoá sạch dữ liệu (xem docs/RULES.md #12).
--
-- Nguyên tắc:
--   · Mọi bảng nghiệp vụ có club_id (trừ users) — đa CLB là bắt buộc từ đầu.
--   · Tiền là bigint VND. KHÔNG lưu số đã làm tròn.
--   · Ngày buổi tập là date (không timestamp). Tháng là char(7) dạng '2026-08'.
--   · Không xoá cứng: dùng status / active / deleted_at.
--   · Timezone Asia/Ho_Chi_Minh.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- username/email không phân biệt hoa thường

/* ============================ ENUM ============================ */

CREATE TYPE gender          AS ENUM ('nam','nu');
CREATE TYPE skill_level     AS ENUM ('Newbie','TBY','TB-','TB');   -- thứ tự tăng dần trình độ
CREATE TYPE club_role       AS ENUM ('owner','treasurer','host','member','viewer');
CREATE TYPE session_state   AS ENUM ('draft','open','closed','cancelled');
CREATE TYPE roster_state    AS ENUM ('fixed','off','pending');
CREATE TYPE attend_state    AS ENUM ('present','absent','registered');
CREATE TYPE shuttle_mode    AS ENUM ('quota','tubes','exact');
CREATE TYPE tx_direction    AS ENUM ('in','out');
CREATE TYPE court_pay_mode  AS ENUM ('month','session');
CREATE TYPE join_state      AS ENUM ('pending','approved','rejected');
CREATE TYPE invite_state    AS ENUM ('sent','accepted','expired');
CREATE TYPE player_kind     AS ENUM ('member','guest');

/* ==================== TÀI KHOẢN, CLB, QUYỀN ==================== */

-- Thông tin người dùng. Mật khẩu và phiên do Supabase Auth giữ ở auth.users;
-- bảng này chỉ chứa phần app cần đọc/ghi.
--   · username  BẮT BUỘC, dùng làm tên đăng nhập
--   · email     BẮT BUỘC (khớp auth.users.email)
--   · phone     KHÔNG bắt buộc; có thì cũng đăng nhập được bằng SĐT (xem resolve_login ở 0002)
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     citext UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
  email        citext UNIQUE NOT NULL,
  phone        text UNIQUE,
  name         text NOT NULL,                  -- tên đầy đủ
  nick         text,                           -- tên gọi trong CLB, hiện khắp UI
  avatar_url   text,
  gender       gender,
  level        skill_level,
  zalo_user_id text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_phone_idx ON profiles (phone) WHERE phone IS NOT NULL;

CREATE TABLE clubs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  code                char(8) UNIQUE NOT NULL,      -- mã mời, VD 8NJHE8
  logo_url            text,
  opening_balance     bigint NOT NULL DEFAULT 0,    -- quỹ mang sang từ Excel
  opening_date        date NOT NULL,
  bank_holder         text,
  bank_no             text,
  bank_name           text,
  court_pay_mode      court_pay_mode NOT NULL DEFAULT 'month',
  lock_day            int NOT NULL DEFAULT 25 CHECK (lock_day BETWEEN 1 AND 28),
  round_unit          bool NOT NULL DEFAULT true,   -- làm tròn đơn giá/buổi về nghìn
  see_debt_each_other bool NOT NULL DEFAULT false,
  see_fund            bool NOT NULL DEFAULT true,
  allow_code_join     bool NOT NULL DEFAULT true,   -- 3 công tắc ghép tài khoản
  allow_invite        bool NOT NULL DEFAULT true,
  allow_phone_suggest bool NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  name            text NOT NULL,
  address         text,
  price_per_hour  bigint NOT NULL,
  active          bool NOT NULL DEFAULT true
);
CREATE INDEX courts_club_idx ON courts (club_id, active);

-- Thành viên TRONG một CLB. user_id NULL = chủ CLB tạo tay, người đó chưa có tài khoản.
-- Vẫn điểm danh, vẫn tính quỹ, vẫn chia sân bình thường.
CREATE TABLE club_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            uuid NOT NULL REFERENCES clubs(id),
  user_id            uuid REFERENCES profiles(id),
  role               club_role NOT NULL DEFAULT 'member',
  name               text NOT NULL,
  phone              text,
  gender             gender NOT NULL,
  level              skill_level NOT NULL,
  pending_level      skill_level,        -- đổi trình độ chờ áp dụng
  pending_level_from char(7),            -- áp dụng từ tháng này
  joined_at          date NOT NULL,
  active             bool NOT NULL DEFAULT true,
  linked_at          timestamptz,
  invited_by         uuid REFERENCES club_members(id),
  UNIQUE (club_id, user_id)              -- một tài khoản chỉ gắn 1 bản ghi trong 1 CLB
);
CREATE INDEX club_members_active_idx ON club_members (club_id, active);
CREATE INDEX club_members_phone_idx  ON club_members (club_id, phone);

CREATE TABLE club_join_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           uuid NOT NULL REFERENCES clubs(id),
  user_id           uuid NOT NULL REFERENCES profiles(id),
  code_used         char(8) NOT NULL,
  note              text,
  status            join_state NOT NULL DEFAULT 'pending',
  matched_member_id uuid REFERENCES club_members(id),   -- ghép vào bản ghi có sẵn
  reviewed_by       uuid REFERENCES profiles(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX club_join_pending_idx ON club_join_requests (club_id, user_id) WHERE status = 'pending';

CREATE TABLE club_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES clubs(id),
  member_id        uuid NOT NULL REFERENCES club_members(id),
  phone            text NOT NULL,
  token            text UNIQUE NOT NULL,
  status           invite_state NOT NULL DEFAULT 'sent',
  sent_at          timestamptz NOT NULL DEFAULT now(),
  accepted_user_id uuid REFERENCES profiles(id),
  expires_at       timestamptz
);
CREATE INDEX club_invites_member_idx ON club_invites (club_id, member_id);

-- Ma trận quyền: seed cứng, KHÔNG cho sửa trong app.
CREATE TABLE role_permissions (
  role         club_role PRIMARY KEY,
  can_money    bool NOT NULL,
  can_members  bool NOT NULL,
  can_sessions bool NOT NULL,
  can_assign   bool NOT NULL,
  can_settings bool NOT NULL,
  can_view_all bool NOT NULL
);
INSERT INTO role_permissions VALUES
  ('owner',     true,  true,  true,  true,  true,  true),
  ('treasurer', true,  false, false, false, false, true),
  ('host',      false, false, true,  true,  false, true),
  ('member',    false, false, false, false, false, false),
  ('viewer',    false, false, false, false, false, true);

/* ============ NHÓM CỐ ĐỊNH, DANH SÁCH THEO THÁNG ============ */

CREATE TABLE member_groups (           -- "Cố định Chủ nhật", "Cố định Thứ 6"
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  name       text NOT NULL,
  short      text,                     -- CN / T6, dùng trong sổ quỹ
  weekday    int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0=CN … 6=T7
  fee_male   bigint NOT NULL,          -- quỹ tháng nam
  fee_female bigint NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  quota      int NOT NULL DEFAULT 24,  -- định mức cầu/buổi khi đủ sân
  active     bool NOT NULL DEFAULT true
);
CREATE INDEX member_groups_club_idx ON member_groups (club_id, active);

CREATE TABLE group_courts (            -- sân mặc định của nhóm
  group_id uuid NOT NULL REFERENCES member_groups(id),
  court_id uuid NOT NULL REFERENCES courts(id),
  PRIMARY KEY (group_id, court_id)
);

-- Cố định THEO THÁNG: nguồn duy nhất để biết ai phải đóng quỹ tháng đó.
CREATE TABLE group_memberships (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month     char(7) NOT NULL,
  group_id  uuid NOT NULL REFERENCES member_groups(id),
  member_id uuid NOT NULL REFERENCES club_members(id),
  state     roster_state NOT NULL DEFAULT 'fixed',
  UNIQUE (month, group_id, member_id)
);
CREATE INDEX group_memberships_month_idx ON group_memberships (month, group_id);

CREATE TABLE roster_locks (            -- chốt danh sách tháng → sinh monthly_dues
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   uuid NOT NULL REFERENCES clubs(id),
  month     char(7) NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid REFERENCES profiles(id),
  UNIQUE (club_id, month)
);

CREATE TABLE member_changes (          -- thành viên tự sửa, chờ duyệt
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES club_members(id),
  field        text NOT NULL CHECK (field IN ('level','phone','gender','name')),
  from_value   text,
  to_value     text,
  requested_by uuid REFERENCES profiles(id),
  effective    text NOT NULL CHECK (effective IN ('now','next')),  -- SĐT: now · trình độ: next
  status       join_state NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_changes_pending_idx ON member_changes (member_id) WHERE status = 'pending';

/* ==================== LỊCH VÀ BUỔI TẬP ==================== */

CREATE TABLE schedules (               -- lịch lặp theo tuần
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  group_id   uuid NOT NULL REFERENCES member_groups(id),
  name       text NOT NULL,
  weekdays   int[] NOT NULL,
  start_date date NOT NULL,
  end_date   date,
  active     bool NOT NULL DEFAULT true
);

CREATE TABLE schedule_slots (          -- 1 dòng = 1 sân + khung giờ
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  court_id    uuid NOT NULL REFERENCES courts(id),
  start_time  time NOT NULL,
  end_time    time NOT NULL
);

CREATE TABLE shuttle_types (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id),
  name           text NOT NULL,
  per_tube       int NOT NULL DEFAULT 12,
  price_per_tube bigint,               -- CHỈ để gợi nhập, KHÔNG dùng tính tiền
  active         bool NOT NULL DEFAULT true
);

CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  group_id        uuid NOT NULL REFERENCES member_groups(id),
  schedule_id     uuid REFERENCES schedules(id),        -- NULL = buổi đột xuất
  date            date NOT NULL,
  status          session_state NOT NULL DEFAULT 'draft',
  shuttle_type_id uuid REFERENCES shuttle_types(id),
  shuttle_mode    shuttle_mode NOT NULL DEFAULT 'quota',
  tubes_opened    int NOT NULL DEFAULT 0,
  loose_units     int NOT NULL DEFAULT 0,
  shuttle_used    int NOT NULL DEFAULT 0,
  shuttle_est     bool NOT NULL DEFAULT true,           -- true = đang lấy định mức, chờ kiểm kho
  note            text,
  closed_at       timestamptz,
  closed_by       uuid REFERENCES profiles(id),
  UNIQUE (schedule_id, date)
);
CREATE INDEX sessions_club_date_idx ON sessions (club_id, date);

CREATE TABLE session_courts (          -- sân THỰC TẾ của buổi
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_id    uuid NOT NULL REFERENCES courts(id),
  court_index int NOT NULL,             -- 0,1,2… dùng cho slot id khi chia sân
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  is_extra    bool NOT NULL DEFAULT false,  -- thuê thêm ngoài hoá đơn tháng
  is_sold     bool NOT NULL DEFAULT false,  -- bán cho CLB khác
  sold_amount bigint NOT NULL DEFAULT 0,
  sold_to     text,
  UNIQUE (session_id, court_index)
);

/* ================ ĐIỂM DANH VÀ KHÁCH GIAO LƯU ================ */

CREATE TABLE attendances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES club_members(id),
  status     attend_state NOT NULL,
  marked_at  timestamptz,
  marked_by  uuid REFERENCES profiles(id),
  UNIQUE (session_id, member_id)
);

CREATE TABLE guests (                  -- khách giao lưu, tái sử dụng nhiều buổi
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  name       text NOT NULL,
  gender     gender NOT NULL,
  level      skill_level NOT NULL,
  phone      text,
  invited_by uuid REFERENCES club_members(id)
);
CREATE INDEX guests_club_idx ON guests (club_id);

CREATE TABLE session_guests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guest_id   uuid NOT NULL REFERENCES guests(id),
  level      skill_level NOT NULL,
  gender     gender NOT NULL,
  price      bigint NOT NULL,           -- CHỐT tại thời điểm buổi, không join lại bảng giá
  invited_by uuid REFERENCES club_members(id),
  paid       bool NOT NULL DEFAULT false,
  paid_at    timestamptz
);
CREATE INDEX session_guests_session_idx ON session_guests (session_id);

CREATE TABLE guest_price_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id),
  level          skill_level NOT NULL,
  gender         gender NOT NULL,
  price          bigint NOT NULL,
  effective_from date NOT NULL,
  UNIQUE (club_id, level, gender, effective_from)
);

/* ==================== CHIA SÂN VÀ SỐ TRẬN ==================== */

CREATE TABLE session_lineups (         -- trạng thái tạm: ai đang ở ô nào
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slot        text NOT NULL,           -- 'c0t1s0'
  court_index int NOT NULL,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, slot)
);

CREATE TABLE session_court_groups (    -- chế độ "cố định người theo sân"
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_index int NOT NULL,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  UNIQUE (session_id, player_type, player_id)
);

CREATE TABLE matches (                 -- 1 bản ghi = 1 trận đã đánh xong
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_index int NOT NULL,
  minutes     int NOT NULL,            -- đo bằng đồng hồ, hoặc nhập tay (mặc định 20)
  started_at  timestamptz,
  ended_at    timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES profiles(id)
);
CREATE INDEX matches_session_idx ON matches (session_id);

CREATE TABLE match_players (           -- 4 dòng mỗi trận
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  team        int NOT NULL CHECK (team IN (0,1))
);
CREATE INDEX match_players_player_idx ON match_players (player_type, player_id);

/* ============================ TIỀN ============================ */

CREATE TABLE monthly_dues (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   uuid NOT NULL REFERENCES clubs(id),
  month     char(7) NOT NULL,
  group_id  uuid NOT NULL REFERENCES member_groups(id),
  member_id uuid NOT NULL REFERENCES club_members(id),
  amount    bigint NOT NULL,
  paid      bool NOT NULL DEFAULT false,
  paid_at   date,
  method    text,
  note      text,
  UNIQUE (month, group_id, member_id)
);
CREATE INDEX monthly_dues_month_idx ON monthly_dues (club_id, month);

CREATE TABLE back_credits (            -- back tiền cho người cố định nghỉ
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  month           char(7) NOT NULL,
  group_id        uuid NOT NULL REFERENCES member_groups(id),
  member_id       uuid NOT NULL REFERENCES club_members(id),
  sessions_total  int NOT NULL,
  sessions_absent int NOT NULL,
  unit_price      bigint NOT NULL,     -- đơn giá 1 buổi — ngoại lệ ĐƯỢC làm tròn khi lưu
  amount          bigint NOT NULL,
  paid            bool NOT NULL DEFAULT false,
  paid_at         date,
  UNIQUE (month, group_id, member_id)
);

CREATE TABLE court_bills (             -- hoá đơn sân trọn tháng (court_pay_mode='month')
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  month   char(7) NOT NULL,
  paid_on date NOT NULL,
  venue   text NOT NULL,
  amount  bigint NOT NULL,
  payer   text,
  note    text
);
CREATE INDEX court_bills_month_idx ON court_bills (club_id, month);

-- SỔ QUỸ DUY NHẤT, append-only. Số dư = SUM(in) - SUM(out), không tính lại từ nhiều nguồn.
CREATE TABLE transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  date       date NOT NULL,
  direction  tx_direction NOT NULL,
  category   text NOT NULL,            -- 'Quỹ tháng' | 'Khách giao lưu' | 'Tiền sân' | 'Bán sân dư'
                                       -- | 'Thuê thêm sân' | 'Mua cầu' | 'Back cố định nghỉ'
                                       -- | 'Trích quỹ' | 'Khác' | 'Số dư mang sang'
  label      text NOT NULL,            -- câu mô tả hiện nguyên văn trong sổ
  amount     bigint NOT NULL,
  ref_type   text,                     -- trỏ về dues / session_guest / purchase / bill / back
  ref_id     uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_club_date_idx ON transactions (club_id, date);

/* ============================ KHO CẦU ============================ */

CREATE TABLE shuttle_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  date            date NOT NULL,
  type_id         uuid NOT NULL REFERENCES shuttle_types(id),
  tubes           int NOT NULL DEFAULT 0,
  extra_units     int NOT NULL DEFAULT 0,
  total_units     int NOT NULL,        -- tubes×per_tube + extra_units
  price_per_tube  bigint,              -- giá THỰC của đợt này (320k rồi 330k…)
  total_amount    bigint NOT NULL,     -- tổng đã trả — nguồn của giá bình quân
  payer_member_id uuid REFERENCES club_members(id),
  funded_by       text,
  note            text
);
CREATE INDEX shuttle_purchases_club_idx ON shuttle_purchases (club_id, date);

CREATE TABLE shuttle_movements (       -- sổ kho: in từ purchase, out từ session
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES clubs(id),
  type_id       uuid NOT NULL REFERENCES shuttle_types(id),
  date          date NOT NULL,
  direction     tx_direction NOT NULL,
  qty           int NOT NULL,
  ref_type      text,
  ref_id        uuid,
  balance_after int
);

CREATE TABLE stock_checks (            -- kiểm kho cuối tháng
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES clubs(id),
  date             date NOT NULL,
  month            char(7) NOT NULL,
  counted          int NOT NULL,
  system_left      int NOT NULL,
  diff             int NOT NULL,
  spread_sessions  int NOT NULL        -- lệch chia vào bao nhiêu buổi ước lượng
);

/* ============ GIAI ĐOẠN 2 — dựng sẵn bảng, chưa cần code ============ */

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  member_id    uuid REFERENCES club_members(id),
  kind         text NOT NULL,          -- nhắc điểm danh / đóng quỹ / nợ
  channel      text NOT NULL CHECK (channel IN ('push','zalo')),
  payload      jsonb,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  status       text NOT NULL DEFAULT 'pending'
);

CREATE TABLE zalo_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  member_id    uuid NOT NULL REFERENCES club_members(id),
  zalo_user_id text NOT NULL,
  oa_id        text,
  linked_at    timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'active'
);

CREATE TABLE device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id),
  platform     text NOT NULL CHECK (platform IN ('ios','android','web')),
  token        text NOT NULL,
  last_seen_at timestamptz
);

-- Bắt buộc có vì liên quan tiền: ai sửa gì.
CREATE TABLE audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  actor_id   uuid REFERENCES profiles(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_club_idx ON audit_logs (club_id, created_at DESC);

COMMIT;

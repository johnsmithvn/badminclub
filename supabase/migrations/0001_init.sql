-- =====================================================================
-- 0001_init.sql — TOÀN BỘ schema Quản lý CLB cầu lông, một file.
--
-- Gộp từ 12 migration cũ (0001→0012) ngày 2026-09-01. Đây là HÌNH CUỐI CÙNG của schema,
-- không phải lịch sử: những gì 0003 sửa của 0001, 0004 vá của 0002, 0006 vá của 0002 đã được
-- áp thẳng vào đây. Lý do từng thay đổi nằm ở `docs/DATABASE.md` §6 — đọc ở đó, đừng đi tìm
-- file migration cũ nữa (chúng nằm trong git history).
--
-- CHẠY:
--   Supabase cloud → SQL editor → dán cả file → Run.
--   Local          → psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
--
-- CHẠY LẠI ĐƯỢC NHIỀU LẦN. Mọi lệnh đều IF NOT EXISTS / OR REPLACE / DROP-then-CREATE.
-- Dán hai lần không hỏng gì, không mất dữ liệu.
--
-- ⛔ KHÔNG dùng `supabase db reset`, `DROP DATABASE`, `TRUNCATE` — xem docs/RULES.md §7.
--
-- SÁU LUẬT (docs/DATABASE.md §1):
--   1. Mọi bảng nghiệp vụ có club_id (trừ profiles) — đa CLB bắt buộc từ đầu.
--   2. Tiền là bigint VND, KHÔNG lưu số đã làm tròn (ngoại lệ: unit_price của đối chiếu buổi).
--   3. `transactions` là sổ quỹ duy nhất, append-only.
--   4. Không xoá cứng: dùng status / active / deleted_at.
--   5. Ngày buổi tập là `date`; tháng là `char(7)` dạng '2026-08'. TZ Asia/Ho_Chi_Minh.
--   6. Giá chốt tại thời điểm giao dịch, không join lại bảng giá về sau.
--
-- GRANT và RLS là HAI LỚP khác nhau, thiếu lớp nào cũng chặn:
--   GRANT → vai `authenticated` có được ĐỤNG vào bảng không. Thiếu → "permission denied for
--           table X" (403), không đọc được dòng nào kể cả của chính mình.
--   RLS   → trong số đụng được thì thấy DÒNG NÀO. Thiếu → thấy hết mọi CLB.
-- RLS chặn thì trả 0 dòng chứ KHÔNG báo "permission denied" — thấy câu đó là biết thiếu GRANT.
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- username/email không phân biệt hoa thường

/* ============================ ENUM ============================ */

/* KHÔNG có `skill_level`. Trình độ là DỮ LIỆU CỦA TỪNG CLB (`clubs.levels text[]`), không phải
   enum: Postgres không cho xoá hoặc đổi thứ tự giá trị enum, mà CLB thì cần cả hai. Thứ tự
   phần tử trong mảng chính là thứ tự mạnh dần mà thuật toán cân sân dùng. */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
    CREATE TYPE gender AS ENUM ('nam','nu');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_role') THEN
    CREATE TYPE club_role AS ENUM ('owner','treasurer','host','member','viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_state') THEN
    CREATE TYPE session_state AS ENUM ('draft','open','closed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roster_state') THEN
    CREATE TYPE roster_state AS ENUM ('fixed','off','pending');
  END IF;
  -- 'extra' = đi thêm buổi của nhóm khác. Vẫn tính là CÓ MẶT, chỉ khác chỗ tiền đi qua bảng
  -- đối chiếu chứ không qua quỹ tháng của nhóm.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attend_state') THEN
    CREATE TYPE attend_state AS ENUM ('present','absent','registered','extra');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shuttle_mode') THEN
    CREATE TYPE shuttle_mode AS ENUM ('quota','tubes','exact');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_direction') THEN
    CREATE TYPE tx_direction AS ENUM ('in','out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'court_pay_mode') THEN
    CREATE TYPE court_pay_mode AS ENUM ('month','session');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'join_state') THEN
    CREATE TYPE join_state AS ENUM ('pending','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_state') THEN
    CREATE TYPE invite_state AS ENUM ('sent','accepted','expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_kind') THEN
    CREATE TYPE player_kind AS ENUM ('member','guest');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjust_kind') THEN
    CREATE TYPE adjust_kind AS ENUM ('absent_back','extra_session');
  END IF;
  -- 'offset_next_dues': được back 63.000 nhưng không nhận tiền mặt, xin trừ vào quỹ tháng sau.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settle_mode') THEN
    CREATE TYPE settle_mode AS ENUM ('cash','offset_next_dues');
  END IF;
END $$;

/* ==================== TÀI KHOẢN, CLB, QUYỀN ==================== */

-- Mật khẩu và phiên do Supabase Auth giữ ở auth.users; bảng này chỉ chứa phần app đọc/ghi.
--   · username BẮT BUỘC, dùng làm tên đăng nhập
--   · email    BẮT BUỘC (khớp auth.users.email)
--   · phone    KHÔNG bắt buộc; có thì cũng đăng nhập được bằng SĐT (xem resolve_login)
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     citext UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
  email        citext UNIQUE NOT NULL,
  phone        text UNIQUE,
  name         text NOT NULL,                  -- tên đầy đủ
  nick         text,                           -- tên gọi trong CLB, hiện khắp UI
  avatar_url   text,
  gender       gender,
  level        text,                           -- theo clubs.levels, KHÔNG phải enum
  zalo_user_id text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON profiles (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS clubs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  code                char(8) UNIQUE NOT NULL,      -- mã mời 8 ký tự
  logo_url            text,
  opening_balance     bigint NOT NULL DEFAULT 0,    -- quỹ mang sang từ Excel
  opening_date        date NOT NULL,
  opening_by          text,                         -- tên người chốt số mang sang
  levels              text[] NOT NULL DEFAULT ARRAY['Newbie','TBY','TB-','TB'],
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

COMMENT ON COLUMN clubs.levels IS
  'Thang trình độ RIÊNG của CLB. Thứ tự phần tử = thứ tự mạnh dần, thuật toán cân sân dùng '
  'đúng thứ tự này. Cố ý không phải enum: Postgres không cho xoá / đổi thứ tự giá trị enum.';

CREATE TABLE IF NOT EXISTS courts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  name            text NOT NULL,
  address         text,
  price_per_hour  bigint NOT NULL,
  active          bool NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS courts_club_idx ON courts (club_id, active);

-- Thành viên TRONG một CLB. user_id NULL = chủ CLB tạo tay, người đó chưa có tài khoản.
-- Đó là TRẠNG THÁI BÌNH THƯỜNG: vẫn điểm danh, vẫn tính quỹ, vẫn chia sân.
CREATE TABLE IF NOT EXISTS club_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            uuid NOT NULL REFERENCES clubs(id),
  user_id            uuid REFERENCES profiles(id),
  role               club_role NOT NULL DEFAULT 'member',
  name               text NOT NULL,
  phone              text,
  gender             gender NOT NULL,
  level              text NOT NULL,
  pending_level      text,               -- đổi trình độ chờ áp dụng
  pending_level_from char(7),            -- áp dụng từ tháng này
  joined_at          date NOT NULL,
  active             bool NOT NULL DEFAULT true,
  linked_at          timestamptz,
  invited_by         uuid REFERENCES club_members(id),
  UNIQUE (club_id, user_id)              -- một tài khoản chỉ gắn 1 bản ghi trong 1 CLB
);
CREATE INDEX IF NOT EXISTS club_members_active_idx ON club_members (club_id, active);
CREATE INDEX IF NOT EXISTS club_members_phone_idx  ON club_members (club_id, phone);

CREATE TABLE IF NOT EXISTS club_join_requests (
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
CREATE UNIQUE INDEX IF NOT EXISTS club_join_pending_idx
  ON club_join_requests (club_id, user_id) WHERE status = 'pending';

/* Mời qua SĐT: bảng GIỮ NGUYÊN nhưng app KHÔNG dùng. Phần TẠO chạy được, phần NHẬN (mở link →
   tạo tài khoản → tự ghép) chưa từng tồn tại vì cần gửi SMS. Chờ module invite riêng. */
CREATE TABLE IF NOT EXISTS club_invites (
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
CREATE INDEX IF NOT EXISTS club_invites_member_idx ON club_invites (club_id, member_id);

-- Ma trận quyền: seed cứng, KHÔNG cho sửa trong app.
-- Phải khớp `src/config/permissions.json` — có test khoá ở src/__tests__/lib/roles.test.js.
CREATE TABLE IF NOT EXISTS role_permissions (
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
  ('viewer',    false, false, false, false, false, true)
ON CONFLICT (role) DO NOTHING;

/* ============ NHÓM CỐ ĐỊNH, DANH SÁCH THEO THÁNG ============ */

CREATE TABLE IF NOT EXISTS member_groups (   -- "Cố định Chủ nhật", "Cố định Thứ 6"
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id),
  name        text NOT NULL,
  short       text,                     -- CN / T6, dùng trong sổ quỹ
  weekday     int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0=CN … 6=T7
  fee_male    bigint NOT NULL,          -- quỹ THÁNG nam
  fee_female  bigint NOT NULL,
  unit_male   bigint,                   -- đơn giá MỘT BUỔI do CLB tự đặt; NULL/0 = app tự chia
  unit_female bigint,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  quota       int NOT NULL DEFAULT 24,  -- định mức cầu/buổi khi đủ sân
  active      bool NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS member_groups_club_idx ON member_groups (club_id, active);

COMMENT ON COLUMN member_groups.unit_male IS
  'Đơn giá MỘT BUỔI cho nam do CLB tự chốt. NULL/0 = app tự chia (quỹ tháng ÷ số buổi). '
  'Chỉ dùng cho ĐỐI CHIẾU (trả người nghỉ, thu người đi lẻ) — quỹ tháng vẫn thu trọn gói '
  'theo fee_male.';
COMMENT ON COLUMN member_groups.unit_female IS 'Như unit_male, cho nữ.';

CREATE TABLE IF NOT EXISTS group_courts (    -- sân mặc định của nhóm
  group_id uuid NOT NULL REFERENCES member_groups(id),
  court_id uuid NOT NULL REFERENCES courts(id),
  PRIMARY KEY (group_id, court_id)
);

-- Cố định THEO THÁNG: nguồn duy nhất để biết ai phải đóng quỹ tháng đó.
CREATE TABLE IF NOT EXISTS group_memberships (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month     char(7) NOT NULL,
  group_id  uuid NOT NULL REFERENCES member_groups(id),
  member_id uuid NOT NULL REFERENCES club_members(id),
  state     roster_state NOT NULL DEFAULT 'fixed',
  UNIQUE (month, group_id, member_id)
);
CREATE INDEX IF NOT EXISTS group_memberships_month_idx ON group_memberships (month, group_id);

/* Nhóm cố định "gốc" của thành viên. KHÁC group_memberships: bảng kia là danh sách CHỐT theo
   từng tháng, bảng này là mặc định dùng để suy ra tháng chưa chốt. */
CREATE TABLE IF NOT EXISTS club_member_groups (
  member_id uuid NOT NULL REFERENCES club_members(id)  ON DELETE CASCADE,
  group_id  uuid NOT NULL REFERENCES member_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, group_id)
);

CREATE TABLE IF NOT EXISTS roster_locks (    -- chốt danh sách tháng → sinh monthly_dues
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   uuid NOT NULL REFERENCES clubs(id),
  month     char(7) NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid REFERENCES profiles(id),
  UNIQUE (club_id, month)
);

CREATE TABLE IF NOT EXISTS member_changes (  -- thành viên tự xin sửa, chờ duyệt
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
CREATE INDEX IF NOT EXISTS member_changes_pending_idx ON member_changes (member_id) WHERE status = 'pending';

/* ==================== LỊCH VÀ BUỔI TẬP ==================== */

CREATE TABLE IF NOT EXISTS schedules (       -- lịch lặp theo tuần
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  group_id   uuid NOT NULL REFERENCES member_groups(id),
  name       text NOT NULL,
  weekdays   int[] NOT NULL,
  start_date date NOT NULL,
  end_date   date,
  active     bool NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS schedule_slots (  -- 1 dòng = 1 sân + khung giờ
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  court_id    uuid NOT NULL REFERENCES courts(id),
  start_time  time NOT NULL,
  end_time    time NOT NULL
);

CREATE TABLE IF NOT EXISTS shuttle_types (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id),
  name           text NOT NULL,
  per_tube       int NOT NULL DEFAULT 12,
  price_per_tube bigint,               -- CHỈ để gợi nhập, KHÔNG dùng tính tiền
  active         bool NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  -- NULL = buổi đột xuất của TOÀN CLB, không thuộc nhóm cố định nào (client gọi là 'ALL').
  group_id        uuid REFERENCES member_groups(id),
  schedule_id     uuid REFERENCES schedules(id),        -- NULL = buổi đột xuất
  date            date NOT NULL,
  status          session_state NOT NULL DEFAULT 'draft',
  shuttle_type_id uuid REFERENCES shuttle_types(id),
  shuttle_mode    shuttle_mode NOT NULL DEFAULT 'quota',
  tubes_opened    int NOT NULL DEFAULT 0,
  loose_units     int NOT NULL DEFAULT 0,
  shuttle_used    int NOT NULL DEFAULT 0,
  shuttle_est     bool NOT NULL DEFAULT true,           -- true = đang lấy định mức, chờ kiểm kho
  group_mode      bool NOT NULL DEFAULT false,          -- chế độ "cố định người theo sân"
  note            text,
  closed_at       timestamptz,
  closed_by       uuid REFERENCES profiles(id),
  -- Ảnh chụp giá thành lúc CHỐT buổi. Không đóng băng thì mua thêm một đợt cầu giá khác là mọi
  -- buổi quá khứ đổi số, sang năm mở lại tháng cũ user thấy số khác số họ đã đọc hôm nay.
  cost_court        bigint,   -- courtNet lúc chốt (đã loại sân bán)
  cost_shuttle_unit bigint,   -- giá bình quân MỘT QUẢ lúc đó
  cost_shuttle      bigint,   -- shuttle_used × cost_shuttle_unit
  cost_total        bigint,   -- cost_court + cost_shuttle
  cost_guest_rev    bigint,   -- thu khách chốt tại buổi
  cost_heads        int,      -- số có mặt + số khách
  cost_frozen_at    date,     -- NULL = chưa đóng băng
  UNIQUE (schedule_id, date)
);
CREATE INDEX IF NOT EXISTS sessions_club_date_idx ON sessions (club_id, date);

COMMENT ON COLUMN sessions.cost_frozen_at IS
  'NULL = chưa đóng băng, đọc số tính live. Có giá trị = ĐỌC cost_*, KHÔNG tính lại. '
  'Kiểu date chứ không phải timestamptz vì client chỉ giữ tới ngày — timestamptz đi qua lớp map '
  'client sẽ lệch múi giờ mỗi vòng đọc-ghi.';
COMMENT ON COLUMN sessions.cost_shuttle_unit IS
  'Lưu riêng là có chủ ý: để sau còn giải thích được con số — "buổi này tính theo 27.500 đ/quả, '
  'giá bình quân lúc đó".';

/* Ba trạng thái của một con số giá thành, đọc bằng hai cờ:
     cost_frozen_at NULL                   → buổi chưa chốt, đang tính live
     cost_frozen_at có · shuttle_est true  → đóng băng TẠM, chờ kiểm kho
     cost_frozen_at có · shuttle_est false → SỐ CHỐT, không đổi nữa                */

CREATE TABLE IF NOT EXISTS session_courts (  -- sân THỰC TẾ của buổi
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_id        uuid NOT NULL REFERENCES courts(id),
  court_index     int NOT NULL,             -- 0,1,2… dùng cho slot id khi chia sân
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  default_minutes int,                      -- số phút mặc định khi ghi trận không bấm giờ
  is_extra        bool NOT NULL DEFAULT false,  -- thuê thêm ngoài hoá đơn tháng
  is_sold         bool NOT NULL DEFAULT false,  -- bán cho CLB khác
  sold_amount     bigint NOT NULL DEFAULT 0,
  sold_to         text,
  cost            bigint,                   -- đóng băng lúc chốt buổi; NULL = tính live
  UNIQUE (session_id, court_index)
);

COMMENT ON COLUMN session_courts.cost IS
  'Tiền dòng sân này, đóng băng lúc chốt buổi (money.js: freezeCost). NULL = buổi chưa chốt, '
  'tính live theo courts.price_per_hour. Năm hàm tiền sân đều cộng từ money.js: rowCost nên '
  'khoá ở đây là cả năm đứng yên cùng lúc — kể cả dòng chi tiền sân trong lib/ledger.js.';

/* ================ ĐIỂM DANH VÀ KHÁCH GIAO LƯU ================ */

CREATE TABLE IF NOT EXISTS attendances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES club_members(id),
  status     attend_state NOT NULL,
  marked_at  timestamptz,
  marked_by  uuid REFERENCES profiles(id),
  UNIQUE (session_id, member_id)
);

CREATE TABLE IF NOT EXISTS guests (          -- khách giao lưu, tái sử dụng nhiều buổi
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  name       text NOT NULL,
  gender     gender NOT NULL,
  level      text NOT NULL,
  phone      text,
  invited_by uuid REFERENCES club_members(id)
);
CREATE INDEX IF NOT EXISTS guests_club_idx ON guests (club_id);

CREATE TABLE IF NOT EXISTS session_guests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guest_id   uuid NOT NULL REFERENCES guests(id),
  level      text NOT NULL,
  gender     gender NOT NULL,
  price      bigint NOT NULL,           -- CHỐT tại thời điểm buổi, không join lại bảng giá
  invited_by uuid REFERENCES club_members(id),
  paid       bool NOT NULL DEFAULT false,
  paid_at    timestamptz
);
CREATE INDEX IF NOT EXISTS session_guests_session_idx ON session_guests (session_id);

CREATE TABLE IF NOT EXISTS guest_price_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id),
  level          text NOT NULL,
  gender         gender NOT NULL,
  price          bigint NOT NULL,
  effective_from date NOT NULL,
  UNIQUE (club_id, level, gender, effective_from)
);

/* ==================== CHIA SÂN VÀ SỐ TRẬN ==================== */

CREATE TABLE IF NOT EXISTS session_lineups ( -- trạng thái tạm: ai đang ở ô nào
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slot        text NOT NULL,           -- 'c0t1s0'
  court_index int NOT NULL,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, slot)
);

CREATE TABLE IF NOT EXISTS session_court_groups (  -- chế độ "cố định người theo sân"
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_index int NOT NULL,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  UNIQUE (session_id, player_type, player_id)
);

CREATE TABLE IF NOT EXISTS matches (         -- 1 bản ghi = 1 trận đã đánh xong
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_index int NOT NULL,
  minutes     int NOT NULL,            -- đo bằng đồng hồ, hoặc nhập tay (mặc định 20)
  started_at  timestamptz,
  ended_at    timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS matches_session_idx ON matches (session_id);

CREATE TABLE IF NOT EXISTS match_players (   -- 4 dòng mỗi trận
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_type player_kind NOT NULL,
  player_id   uuid NOT NULL,
  team        int NOT NULL CHECK (team IN (0,1))
);
CREATE INDEX IF NOT EXISTS match_players_player_idx ON match_players (player_type, player_id);

/* ============================ TIỀN ============================ */

CREATE TABLE IF NOT EXISTS monthly_dues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id),
  month       char(7) NOT NULL,
  group_id    uuid NOT NULL REFERENCES member_groups(id),
  member_id   uuid NOT NULL REFERENCES club_members(id),
  amount      bigint NOT NULL,
  paid_amount bigint NOT NULL DEFAULT 0,   -- nguồn sự thật; ghi được cảnh ĐÓNG THIẾU
  paid        bool NOT NULL DEFAULT false, -- DEPRECATED, bản sao suy ra
  paid_at     date,
  method      text,
  note        text,
  UNIQUE (month, group_id, member_id)
);
CREATE INDEX IF NOT EXISTS monthly_dues_month_idx ON monthly_dues (club_id, month);

COMMENT ON COLUMN monthly_dues.paid_amount IS
  'Số tiền THỰC ĐÃ NHẬN. Trạng thái suy ra từ đây: 0 chưa đóng · < amount đóng thiếu · '
  '>= amount đủ. Đây là nguồn sự thật, không phải cột paid. Boolean không ghi được cảnh hay '
  'gặp nhất: phải đóng 250.000, đưa trước 150.000 — tick thì thừa 100.000, không tick thì thiếu 150.000.';
COMMENT ON COLUMN monthly_dues.paid IS
  'DEPRECATED — bản sao suy ra từ (paid_amount >= amount), app ghi lại mỗi lần đồng bộ để cột '
  'này không nói dối. Truy vấn mới đọc paid_amount. Giữ lại vì dữ liệu dính tiền không xoá cứng.';

/* DEPRECATED — app KHÔNG còn đọc/ghi bảng này, đã thay bằng member_adjustments (đối chiếu hai
   chiều). Giữ lại vì RULES §4: dữ liệu dính tiền thì không xoá cứng. */
CREATE TABLE IF NOT EXISTS back_credits (    -- back tiền cho người cố định nghỉ
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  month           char(7) NOT NULL,
  group_id        uuid NOT NULL REFERENCES member_groups(id),
  member_id       uuid NOT NULL REFERENCES club_members(id),
  sessions_total  int NOT NULL DEFAULT 0,
  sessions_absent int NOT NULL DEFAULT 0,
  unit_price      bigint NOT NULL DEFAULT 0,  -- ngoại lệ ĐƯỢC làm tròn khi lưu
  amount          bigint NOT NULL DEFAULT 0,
  paid            bool NOT NULL DEFAULT false,
  paid_at         date,
  UNIQUE (month, group_id, member_id)
);

/* Đối chiếu buổi HAI CHIỀU, cùng một đơn giá, chỉ khác dấu:
     absent_back   vắng buổi cố định       amount ÂM     quỹ nợ người
     extra_session đi thêm buổi nhóm khác  amount DƯƠNG  người nợ quỹ
   Trước đây chiều thứ hai không có chỗ ghi, phải nhét vào session_guests với GIÁ KHÁCH —
   sai cả tiền lẫn báo cáo (người nhà bị đếm thành khách). */
CREATE TABLE IF NOT EXISTS member_adjustments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  month      char(7) NOT NULL,
  group_id   uuid NOT NULL REFERENCES member_groups(id),  -- nhóm SINH RA đơn giá
  member_id  uuid NOT NULL REFERENCES club_members(id),
  kind       adjust_kind NOT NULL,
  sessions   int    NOT NULL DEFAULT 0,   -- số buổi vắng, hoặc số buổi đi thêm
  unit_price bigint NOT NULL DEFAULT 0,   -- ngoại lệ ĐƯỢC làm tròn khi lưu
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
  'khoản đã trả. Cùng nguyên tắc với sessions.cost_*.';
COMMENT ON COLUMN member_adjustments.settle IS
  'cash = ghi một dòng transactions khi paid. offset_next_dues = KHÔNG ghi giao dịch nào, '
  'trừ thẳng vào monthly_dues.amount của tháng sau lúc chốt danh sách — tiền không đổi tay lần nào.';

CREATE TABLE IF NOT EXISTS court_bills (     -- hoá đơn sân trọn tháng (court_pay_mode='month')
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id),
  month           char(7) NOT NULL,
  paid_on         date NOT NULL,
  venue           text NOT NULL,
  amount          bigint NOT NULL,
  payer_member_id uuid REFERENCES club_members(id),
  payer           text,                    -- CHỈ cho dữ liệu cũ nhập tay
  note            text,
  repaid_at       date                     -- ngày CLB trả lại tiền cho người ứng
);
CREATE INDEX IF NOT EXISTS court_bills_month_idx ON court_bills (club_id, month);

COMMENT ON COLUMN court_bills.payer IS
  'CHỈ còn dùng cho dữ liệu cũ nhập tay. Bản ghi mới dùng payer_member_id.';
COMMENT ON COLUMN court_bills.repaid_at IS
  'Ngày CLB trả lại tiền cho người ứng — cùng luật với shuttle_purchases.repaid_at.';

-- SỔ QUỸ DUY NHẤT, append-only. Số dư = SUM(in) − SUM(out).
CREATE TABLE IF NOT EXISTS transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id),
  date       date NOT NULL,
  direction  tx_direction NOT NULL,
  -- KEY ổn định (dues · guest · court · courtSold · courtExtra · shuttle · back · extra ·
  -- withdraw · other · opening), KHÔNG phải chữ hiển thị: đổi ngôn ngữ không được làm đổi dữ
  -- liệu tiền đã ghi. Xem CATS trong src/lib/ledger.js.
  category   text NOT NULL,
  label      text NOT NULL,            -- câu mô tả hiện nguyên văn trong sổ
  amount     bigint NOT NULL,
  ref_type   text,                     -- trỏ về dues / session_guest / purchase / bill / back
  ref_id     uuid,
  payer_name text,                     -- chữ hiển thị lúc ghi (người đó có thể rời CLB sau)
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_club_date_idx ON transactions (club_id, date);

/* ============================ KHO CẦU ============================ */

CREATE TABLE IF NOT EXISTS shuttle_purchases (
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
  note            text,
  repaid_at       date
);
CREATE INDEX IF NOT EXISTS shuttle_purchases_club_idx ON shuttle_purchases (club_id, date);

COMMENT ON COLUMN shuttle_purchases.funded_by IS
  'Nguồn tiền: fund = quỹ trả · member_advance = thành viên ứng. KHÔNG phải tên người trả — '
  'người trả nằm ở payer_member_id.';
COMMENT ON COLUMN shuttle_purchases.repaid_at IS
  'Ngày CLB trả lại tiền cho người ứng. NULL + người trả KHÔNG phải owner/treasurer = quỹ đang '
  'nợ người đó, khoản chi CHƯA vào sổ (LUẬT NGƯỜI GIỮ QUỸ). Người trả là owner/treasurer hoặc '
  'để trống thì cột này không dùng đến: chi vào sổ ngay theo `date`.';

CREATE TABLE IF NOT EXISTS shuttle_movements (  -- sổ kho: in từ purchase, out từ session
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

/* Mỗi tháng CHỈ MỘT lần kiểm kho: kiểm kho chia phần lệch vào các buổi còn cờ ước lượng rồi
   tắt cờ đó đi. Chạy hai lần cùng tháng thì lần hai chia chồng lên phần đã chia. App đã chặn
   ở tầng action; đây là chốt chặn cuối ở DB. */
CREATE TABLE IF NOT EXISTS stock_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES clubs(id),
  date             date NOT NULL,
  month            char(7) NOT NULL,
  counted          int NOT NULL,
  system_left      int NOT NULL,
  diff             int NOT NULL,
  spread_sessions  int NOT NULL,       -- lệch chia vào bao nhiêu buổi ước lượng
  CONSTRAINT uq_check_month UNIQUE (club_id, month)
);

/* ============ GIAI ĐOẠN 2 — dựng sẵn bảng, chưa cần code ============ */

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE TABLE IF NOT EXISTS zalo_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  member_id    uuid NOT NULL REFERENCES club_members(id),
  zalo_user_id text NOT NULL,
  oa_id        text,
  linked_at    timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id),
  platform     text NOT NULL CHECK (platform IN ('ios','android','web')),
  token        text NOT NULL,
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
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
CREATE INDEX IF NOT EXISTS audit_logs_club_idx ON audit_logs (club_id, created_at DESC);

/* ==================== TẠO PROFILE KHI CÓ TÀI KHOẢN MỚI ==================== */

-- Trigger đọc raw_user_meta_data mà client truyền lúc signUp({ options: { data: {...} } }).
-- Làm bằng trigger để profile LUÔN tồn tại, không phụ thuộc client gọi thêm một lượt insert.
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
    NULLIF(NEW.raw_user_meta_data->>'level', '')   -- text, KHÔNG cast enum
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/* ==================== ĐĂNG NHẬP BẰNG EMAIL / USERNAME / SĐT ==================== */

-- Client chưa đăng nhập nên không đọc được profiles (RLS). Hàm này SECURITY DEFINER,
-- chỉ trả về đúng MỘT cột email — không lộ thêm thông tin gì.
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

/* ==================== HELPER QUYỀN ==================== */

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

/* ==================== TẠO CLB / VÀO CLB BẰNG MÃ ==================== */

/* Biến tên `v_code` chứ KHÔNG phải `code`: trùng tên cột `clubs.code` thì plpgsql chạy mặc định
   `variable_conflict = error` và từ chối đoán → `create_club` trả 400 "column reference code is
   ambiguous", không tạo được CLB nào. Thân plpgsql chỉ là text lúc CREATE nên lỗi KHÔNG lộ khi
   apply migration, chỉ lộ khi có người bấm tạo CLB. Đừng đổi lại tên biến. */
CREATE OR REPLACE FUNCTION public.gen_club_code()
RETURNS char(8)
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- bỏ 0/O/1/I cho khỏi đọc nhầm
  v_code   text;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE clubs.code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Tạo CLB: insert clubs + tự đưa người tạo thành owner trong MỘT transaction.
-- Phải là RPC vì RLS không cho insert club_members vào CLB mà mình chưa là thành viên.
-- Seed thêm 1 loại cầu để màn Kho cầu dùng được ngay; sân / nhóm / thành viên vẫn do chủ CLB
-- tự nhập — đó là dữ liệu thật, không bịa hộ.
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
-- Trình độ mặc định lấy theo THANG CỦA CLB, không gán cứng 'Newbie' — CLB đổi thang thì giá trị
-- đó không còn tồn tại.
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

/* ============================== RLS ============================== */
-- Nguyên tắc: ĐỌC được nếu là thành viên CLB; GHI được nếu có cờ quyền tương ứng.
-- Bảng con không có club_id thì join lên cha để lấy club_id.

DO $$
DECLARE tb text;
BEGIN
  FOREACH tb IN ARRAY ARRAY[
    'profiles','clubs','club_members','club_join_requests','club_invites','role_permissions',
    'courts','member_groups','group_courts','group_memberships','club_member_groups',
    'roster_locks','member_changes','schedules','schedule_slots','shuttle_types','sessions',
    'session_courts','attendances','guests','session_guests','guest_price_rules',
    'session_lineups','session_court_groups','matches','match_players','monthly_dues',
    'back_credits','member_adjustments','court_bills','transactions','shuttle_purchases',
    'shuttle_movements','stock_checks','notifications','zalo_links','device_tokens','audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tb);
  END LOOP;
END $$;

-- profiles: tự đọc/sửa mình; đọc được profile của người cùng CLB.
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS profiles_same_club ON profiles;
CREATE POLICY profiles_same_club ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM club_members me
     JOIN club_members other ON other.club_id = me.club_id
    WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
  )
);
DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- role_permissions: ai đăng nhập cũng đọc được (bảng tra cứu).
DROP POLICY IF EXISTS role_perm_read ON role_permissions;
CREATE POLICY role_perm_read ON role_permissions FOR SELECT TO authenticated USING (true);

-- clubs: thành viên đọc; chỉ vai có cờ settings được sửa. Tạo CLB đi qua RPC create_club.
DROP POLICY IF EXISTS clubs_read ON clubs;
CREATE POLICY clubs_read ON clubs FOR SELECT USING (is_club_member(id));
DROP POLICY IF EXISTS clubs_update ON clubs;
CREATE POLICY clubs_update ON clubs FOR UPDATE USING (has_club_perm(id, 'settings'))
  WITH CHECK (has_club_perm(id, 'settings'));

-- club_members: thành viên đọc cả danh sách; chỉ cờ members được thêm/sửa.
DROP POLICY IF EXISTS cm_read ON club_members;
CREATE POLICY cm_read ON club_members FOR SELECT USING (is_club_member(club_id));
DROP POLICY IF EXISTS cm_write ON club_members;
CREATE POLICY cm_write ON club_members FOR INSERT WITH CHECK (has_club_perm(club_id, 'members'));
DROP POLICY IF EXISTS cm_update ON club_members;
CREATE POLICY cm_update ON club_members FOR UPDATE USING (has_club_perm(club_id, 'members'))
  WITH CHECK (has_club_perm(club_id, 'members'));

-- club_join_requests: người xin thấy yêu cầu của mình; chủ CLB thấy của CLB mình.
DROP POLICY IF EXISTS jr_read_own ON club_join_requests;
CREATE POLICY jr_read_own ON club_join_requests FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS jr_read_admin ON club_join_requests;
CREATE POLICY jr_read_admin ON club_join_requests FOR SELECT USING (has_club_perm(club_id, 'members'));

DROP POLICY IF EXISTS inv_read ON club_invites;
CREATE POLICY inv_read ON club_invites FOR SELECT USING (is_club_member(club_id));
DROP POLICY IF EXISTS inv_write ON club_invites;
CREATE POLICY inv_write ON club_invites FOR INSERT WITH CHECK (has_club_perm(club_id, 'members'));
DROP POLICY IF EXISTS inv_update ON club_invites;
CREATE POLICY inv_update ON club_invites FOR UPDATE USING (has_club_perm(club_id, 'members'))
  WITH CHECK (has_club_perm(club_id, 'members'));

/* --- bảng CÓ club_id: sinh policy bằng vòng lặp cho gọn và khỏi sai sót --- */
DO $$
DECLARE
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
    EXECUTE format('DROP POLICY IF EXISTS %1$s_read ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_ins  ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_upd  ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_del  ON %1$s;', spec[i][1]);
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
    EXECUTE format('DROP POLICY IF EXISTS %1$s_read ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_ins  ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_upd  ON %1$s;', spec[i][1]);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_del  ON %1$s;', spec[i][1]);
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

/* --- bảng không có club_id lẫn session_id: join lên cha --- */

DROP POLICY IF EXISTS gc_read ON group_courts;
CREATE POLICY gc_read ON group_courts FOR SELECT USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND is_club_member(g.club_id)));
DROP POLICY IF EXISTS gc_all ON group_courts;
CREATE POLICY gc_all ON group_courts FOR ALL USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'settings')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'settings')));

DROP POLICY IF EXISTS gm_read ON group_memberships;
CREATE POLICY gm_read ON group_memberships FOR SELECT USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND is_club_member(g.club_id)));
DROP POLICY IF EXISTS gm_all ON group_memberships;
CREATE POLICY gm_all ON group_memberships FOR ALL USING (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM member_groups g WHERE g.id = group_id AND has_club_perm(g.club_id, 'members')));

DROP POLICY IF EXISTS cmg_read ON club_member_groups;
CREATE POLICY cmg_read ON club_member_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND is_club_member(m.club_id)));
DROP POLICY IF EXISTS cmg_all ON club_member_groups;
CREATE POLICY cmg_all ON club_member_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')));

DROP POLICY IF EXISTS ss_read ON schedule_slots;
CREATE POLICY ss_read ON schedule_slots FOR SELECT USING (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND is_club_member(s.club_id)));
DROP POLICY IF EXISTS ss_all ON schedule_slots;
CREATE POLICY ss_all ON schedule_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND has_club_perm(s.club_id, 'sessions')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND has_club_perm(s.club_id, 'sessions')));

-- member_changes: chính chủ tạo/xem được, người có cờ members duyệt được.
DROP POLICY IF EXISTS mc_read ON member_changes;
CREATE POLICY mc_read ON member_changes FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id
          AND (m.user_id = auth.uid() OR is_club_member(m.club_id))));
DROP POLICY IF EXISTS mc_ins ON member_changes;
CREATE POLICY mc_ins ON member_changes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id
          AND (m.user_id = auth.uid() OR has_club_perm(m.club_id, 'members'))));
DROP POLICY IF EXISTS mc_upd ON member_changes;
CREATE POLICY mc_upd ON member_changes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM club_members m WHERE m.id = member_id AND has_club_perm(m.club_id, 'members')));

DROP POLICY IF EXISTS mp_read ON match_players;
CREATE POLICY mp_read ON match_players FOR SELECT USING (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND is_club_member(club_of_session(m.session_id))));
DROP POLICY IF EXISTS mp_all ON match_players;
CREATE POLICY mp_all ON match_players FOR ALL USING (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND has_club_perm(club_of_session(m.session_id), 'assign')))
  WITH CHECK (
  EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND has_club_perm(club_of_session(m.session_id), 'assign')));

-- member_adjustments: đúng khuôn back_credits (cờ quyền `money`).
DROP POLICY IF EXISTS madj_read ON member_adjustments;
CREATE POLICY madj_read ON member_adjustments FOR SELECT USING (is_club_member(club_id));
DROP POLICY IF EXISTS madj_all ON member_adjustments;
CREATE POLICY madj_all ON member_adjustments FOR ALL
  USING (has_club_perm(club_id, 'money')) WITH CHECK (has_club_perm(club_id, 'money'));

-- device_tokens: của riêng mỗi user.
DROP POLICY IF EXISTS dt_own ON device_tokens;
CREATE POLICY dt_own ON device_tokens FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

/* ============================== GRANT ============================== */
/* GRANT mở cửa, RLS soát vé — xem khối chú thích đầu file. Cấp quyền bảng cho `authenticated`
   KHÔNG làm lộ dữ liệu CLB khác: policy is_club_member / has_club_perm vẫn lọc từng dòng.
   `anon` KHÔNG được cấp quyền bảng nào — chưa đăng nhập thì không đọc được gì; đăng nhập và
   đăng ký đi qua RPC SECURITY DEFINER đã cấp EXECUTE riêng ở trên.
   DELETE có cấp vì lớp đồng bộ (contexts/dbmap.js: diff) sinh thao tác xoá dòng khi user bỏ một
   sân khỏi buổi, bỏ một người khỏi danh sách… Policy vẫn gác theo quyền của vai. */

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO authenticated;

/* Bảng thêm về sau cũng tự có quyền — không có hai dòng này thì mỗi migration sau lại phải nhớ
   GRANT tay, quên một lần là "permission denied for table X". */
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
   Cả ba câu dưới phải trả về 0 dòng.

   1) Bảng nào chưa có GRANT:
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');

   2) Bảng nào chưa bật RLS:
        SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

   3) Bảng nào bật RLS mà KHÔNG có policy nào (bật rồi mà trống policy = khoá sạch, không ai đọc được):
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
           AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
                                                                              */

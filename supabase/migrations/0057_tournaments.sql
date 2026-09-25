-- 0057_tournaments.sql — Module Giải đấu (docs/TOURNAMENT_PLAN.md v2.1 §2)
--
-- CHỈ THÊM MỚI: 14 bảng tournament_*, hàm và RPC tournament_*. KHÔNG sửa bảng / hàm / dữ liệu có sẵn.
-- Chưa có màn hình nào dùng các bảng này → áp lên production không đổi gì với người dùng.
-- Áp xong chạy supabase/manual/0057_tournament_check.sql (tự huỷ mọi dữ liệu thử, xem đầu file đó).
--
-- Chạy lại được: CREATE … IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS trước CREATE POLICY/TRIGGER.
--
-- Hành vi RPC viết theo đặc tả chạy được src/lib/tournament/advance.js (test: src/__tests__/tournament/).
-- Mã lỗi RAISE là key i18n `tournament.err.*`, trùng với key JS trả về.

BEGIN;

-- Bản nháp 0057 trước đây (policy tên `tour_read`, trigger function `check_tournament_team_players_lock`)
-- nếu đã lỡ áp thì CREATE TABLE IF NOT EXISTS bên dưới sẽ GIỮ schema cũ — dừng hẳn, không áp nửa vời.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'tour_read')
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_tournament_team_players_lock') THEN
    RAISE EXCEPTION 'Bản nháp cũ của 0057 đã có trên DB này. Dừng lại — cần dọn bản cũ trước (hỏi lại người viết migration).';
  END IF;
END $$;

/* =========================================================================
   1. BẢNG
   ========================================================================= */

CREATE TABLE IF NOT EXISTS public.tournaments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name           text NOT NULL,
  starts_on      date NOT NULL,
  start_time     time,
  end_time       time,
  venue          text,
  court_labels   text[] NOT NULL DEFAULT '{}',
  scope          text NOT NULL DEFAULT 'club_only' CHECK (scope IN ('club_only','open')),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','registration','running','finished','cancelled')),
  fee_male       bigint NOT NULL DEFAULT 0 CHECK (fee_male >= 0),
  fee_female     bigint NOT NULL DEFAULT 0 CHECK (fee_female >= 0),
  rules          jsonb NOT NULL DEFAULT '[]',
  created_by     uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tournaments_club ON public.tournaments (club_id, starts_on);

CREATE TABLE IF NOT EXISTS public.tournament_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('md','wd','xd','ms','ws','open_doubles','open_singles')),
  team_size     int  NOT NULL CHECK (team_size IN (1, 2)),
  gender_rule   text NOT NULL CHECK (gender_rule IN ('male','female','mixed','any')),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pairing','drawn','running','finished')),
  template_key  text,
  note          text,
  sort_order    int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tournament_events_tour ON public.tournament_events (tournament_id);

CREATE TABLE IF NOT EXISTS public.tournament_stages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id  uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES public.tournament_events(id) ON DELETE CASCADE,
  seq            int  NOT NULL,
  type           text NOT NULL CHECK (type IN ('knockout','round_robin')),
  title          text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done')),
  config         jsonb NOT NULL DEFAULT '{}',
  match_rule     jsonb NOT NULL,
  rule_overrides jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT uq_tournament_stages_seq UNIQUE (event_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_tournament_stages_tour ON public.tournament_stages (tournament_id);

CREATE TABLE IF NOT EXISTS public.tournament_stage_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  from_stage_id uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  to_stage_id   uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  ranks         int[] NOT NULL,
  CONSTRAINT uq_tournament_stage_links_pair UNIQUE (from_stage_id, to_stage_id),
  CONSTRAINT chk_tournament_stage_links_diff CHECK (from_stage_id <> to_stage_id)
);

-- player_type text+CHECK thay vì enum player_kind: cùng hai giá trị, nhưng đổi CHECK rẻ hơn đổi enum.
CREATE TABLE IF NOT EXISTS public.tournament_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_type     text NOT NULL DEFAULT 'member' CHECK (player_type IN ('member','guest')),
  player_id       uuid NOT NULL,
  gender          text NOT NULL CHECK (gender IN ('nam','nu')),   -- snapshot lúc đăng ký
  level           text,                                           -- snapshot lúc đăng ký
  rating_snapshot numeric,
  fee             bigint NOT NULL DEFAULT 0 CHECK (fee >= 0),      -- chốt lúc đăng ký
  paid            boolean NOT NULL DEFAULT false,
  paid_at         timestamptz,
  status          text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','withdrawn')),
  CONSTRAINT uq_tournament_registrations_player UNIQUE (tournament_id, player_type, player_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_event_entries (
  club_id         uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES public.tournament_events(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.tournament_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, registration_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL REFERENCES public.tournament_events(id) ON DELETE CASCADE,
  seed          int,
  draw_no       int,
  pinned        boolean NOT NULL DEFAULT false,
  name          text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn')),
  CONSTRAINT uq_tournament_teams_event UNIQUE (id, event_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_team_players (
  club_id         uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL,
  event_id        uuid NOT NULL,
  registration_id uuid NOT NULL,
  PRIMARY KEY (team_id, registration_id),
  CONSTRAINT uq_tournament_team_players_event UNIQUE (event_id, registration_id),  -- 1 người / 1 đội / nội dung
  CONSTRAINT fk_tournament_team_players_team FOREIGN KEY (team_id, event_id)
    REFERENCES public.tournament_teams(id, event_id) ON DELETE CASCADE,
  -- chỉ vào đội của nội dung mà người đó ĐÃ đăng ký
  CONSTRAINT fk_tournament_team_players_entry FOREIGN KEY (event_id, registration_id)
    REFERENCES public.tournament_event_entries(event_id, registration_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.tournament_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  stage_id      uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  label         text NOT NULL,
  seq           int  NOT NULL,
  CONSTRAINT uq_tournament_groups_stage_label UNIQUE (stage_id, label)
);

CREATE TABLE IF NOT EXISTS public.tournament_group_teams (
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_id      uuid NOT NULL REFERENCES public.tournament_groups(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  seed_in_group int,
  final_rank    int,
  PRIMARY KEY (group_id, team_id)
);

-- Khoá ngoại tới đội và tới chính bảng này để mặc định (NO ACTION): kiểm ở CUỐI câu lệnh. Nhờ vậy xoá
-- cả giai đoạn / cả giải trong một câu (reset_stage, cascade) không vấp thứ tự xoá; còn xoá lẻ một đội
-- đang nằm trong trận thì bị chặn. SET NULL trên khoá kép (team_a_id, event_id) sẽ NULL luôn event_id.
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id       uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES public.tournament_events(id) ON DELETE CASCADE,
  stage_id            uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  group_id            uuid REFERENCES public.tournament_groups(id) ON DELETE CASCADE,
  round               int  NOT NULL CHECK (round >= 0),
  slot                int  NOT NULL CHECK (slot >= 0),
  round_kind          text NOT NULL CHECK (round_kind IN ('r32','r16','qf','sf','final','third','group')),
  team_a_id           uuid,
  team_b_id           uuid,
  source_a            jsonb,
  source_b            jsonb,
  next_match_id       uuid REFERENCES public.tournament_matches(id),
  next_side           text CHECK (next_side IN ('A','B')),
  loser_next_match_id uuid REFERENCES public.tournament_matches(id),
  loser_next_side     text CHECK (loser_next_side IN ('A','B')),
  rule                jsonb NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','ready','live','done','walkover','retired','bye')),
  sets                jsonb NOT NULL DEFAULT '[]',   -- [[21,18],[19,21]] — cùng shape matches.sets
  winner              text CHECK (winner IN ('A','B')),
  result_note         text,
  seq_no              int,
  court_label         text,
  started_at          timestamptz,
  finished_at         timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  CONSTRAINT fk_tournament_matches_team_a FOREIGN KEY (team_a_id, event_id) REFERENCES public.tournament_teams(id, event_id),
  CONSTRAINT fk_tournament_matches_team_b FOREIGN KEY (team_b_id, event_id) REFERENCES public.tournament_teams(id, event_id),
  -- Lưới an toàn cuối: kể cả RPC viết sai, DB cũng không nhận một trận vô lý.
  CONSTRAINT chk_tm_next_pair  CHECK ((next_match_id IS NULL) = (next_side IS NULL)),
  CONSTRAINT chk_tm_loser_pair CHECK ((loser_next_match_id IS NULL) = (loser_next_side IS NULL)),
  CONSTRAINT chk_tm_two_teams  CHECK (status NOT IN ('ready','live','done','walkover','retired')
                                      OR (team_a_id IS NOT NULL AND team_b_id IS NOT NULL)),
  CONSTRAINT chk_tm_bye_shape  CHECK (status <> 'bye' OR ((team_a_id IS NULL) <> (team_b_id IS NULL))),
  CONSTRAINT chk_tm_winner     CHECK ((winner IS NULL) = (status NOT IN ('done','walkover','retired','bye'))),
  CONSTRAINT chk_tm_sets       CHECK (jsonb_typeof(sets) = 'array' AND (status IN ('done','retired') OR sets = '[]'::jsonb)),
  CONSTRAINT chk_tm_note       CHECK (status NOT IN ('walkover','retired') OR btrim(coalesce(result_note, '')) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_matches_slot
  ON public.tournament_matches (stage_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), round, slot);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tour  ON public.tournament_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next  ON public.tournament_matches (next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_loser ON public.tournament_matches (loser_next_match_id);

CREATE TABLE IF NOT EXISTS public.tournament_match_edits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id      uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  action        text NOT NULL CHECK (action IN ('commit','edit','undo','walkover','retire')),
  old_sets      jsonb,
  new_sets      jsonb,
  old_winner    text,
  new_winner    text,
  reason        text,
  edited_by     uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  edited_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tournament_match_edits_reason CHECK (action = 'commit' OR btrim(coalesce(reason, '')) <> '')
);
CREATE INDEX IF NOT EXISTS idx_tournament_match_edits_tour ON public.tournament_match_edits (tournament_id);

-- Chỉ để xem (plan D2): không phải dòng sổ quỹ. `event_id` NULL = áp cho mọi nội dung.
CREATE TABLE IF NOT EXISTS public.tournament_prizes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES public.tournament_events(id) ON DELETE CASCADE,
  rank          int  NOT NULL,
  label         text NOT NULL,
  description   text,
  cash          bigint NOT NULL DEFAULT 0 CHECK (cash >= 0)
);

CREATE TABLE IF NOT EXISTS public.tournament_budget_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  label         text NOT NULL,
  amount        bigint NOT NULL DEFAULT 0 CHECK (amount >= 0),
  sort_order    int  NOT NULL DEFAULT 0
);

/* =========================================================================
   2. KHOÁ ĐỘI HÌNH
   Nội dung đã `drawn` trở đi thì không thêm / bớt / chuyển người, không thêm / xoá đội.
   Sửa seed, draw_no của đội VẪN được — bốc thăm diễn ra SAU khi chốt đội hình.
   Xoá do cascade (xoá giải, xoá CLB qua delete_club) phải luôn qua. Đã thử trên PG15: Postgres xoá
   tournament_events TRƯỚC nên trigger không còn thấy nội dung bị khoá — delete_club chạy được khi CLB đang
   có giải `running`. `pg_trigger_depth() > 1` (lệnh xoá đến từ trigger khoá ngoại, không từ người dùng)
   là lớp dự phòng nếu thứ tự cascade đó đổi: chặn nhầm ở đây = không xoá được CLB.
   ========================================================================= */

CREATE OR REPLACE FUNCTION public.tournament_lineup_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    v_ids := ARRAY[OLD.event_id];
  ELSIF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.event_id];
  ELSE
    v_ids := ARRAY[OLD.event_id, NEW.event_id];
  END IF;
  IF EXISTS (SELECT 1 FROM tournament_events
              WHERE id = ANY(v_ids) AND status NOT IN ('draft','pairing')) THEN
    RAISE EXCEPTION 'tournament.err.eventLocked';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_team_players_lock ON public.tournament_team_players;
CREATE TRIGGER trg_tournament_team_players_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.tournament_team_players
  FOR EACH ROW EXECUTE FUNCTION public.tournament_lineup_guard();

DROP TRIGGER IF EXISTS trg_tournament_teams_lock ON public.tournament_teams;
CREATE TRIGGER trg_tournament_teams_lock
  BEFORE INSERT OR DELETE ON public.tournament_teams
  FOR EACH ROW EXECUTE FUNCTION public.tournament_lineup_guard();

-- Bỏ tick nội dung (xoá entry) cascade xuống tournament_team_players — ở đó pg_trigger_depth() = 2 nên được
-- cho qua. Phải chặn ngay ở entry, không thì người đã ở đội bị rút khỏi đội mà không ai hay.
DROP TRIGGER IF EXISTS trg_tournament_event_entries_lock ON public.tournament_event_entries;
CREATE TRIGGER trg_tournament_event_entries_lock
  BEFORE INSERT OR DELETE ON public.tournament_event_entries
  FOR EACH ROW EXECUTE FUNCTION public.tournament_lineup_guard();

-- Tương tự khi xoá hẳn một thí sinh: cascade entry → team_players. Rút lui là đổi `status`, không xoá.
CREATE OR REPLACE FUNCTION public.tournament_registration_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;                        -- cascade từ xoá giải / xoá CLB
  END IF;
  IF EXISTS (SELECT 1 FROM tournament_event_entries x JOIN tournament_events e ON e.id = x.event_id
              WHERE x.registration_id = OLD.id AND e.status NOT IN ('draft','pairing')) THEN
    RAISE EXCEPTION 'tournament.err.eventLocked';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_registrations_lock ON public.tournament_registrations;
CREATE TRIGGER trg_tournament_registrations_lock
  BEFORE DELETE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.tournament_registration_guard();

/* =========================================================================
   3. RLS & GRANT
   Đọc: thành viên CLB. Ghi trực tiếp: cờ `sessions`.
   tournament_matches, tournament_match_edits: KHÔNG có policy ghi → chỉ RPC (SECURITY DEFINER) ghi được.
   ========================================================================= */

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tournaments','tournament_events','tournament_stages','tournament_stage_links',
    'tournament_registrations','tournament_event_entries','tournament_teams','tournament_team_players',
    'tournament_groups','tournament_group_teams','tournament_matches','tournament_match_edits',
    'tournament_prizes','tournament_budget_lines']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_club_member(club_id))',
                   t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    IF t IN ('tournament_matches','tournament_match_edits') THEN
      -- Supabase mặc định cấp ALL cho anon/authenticated trên bảng mới → phải thu hồi tường minh.
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated, anon', t);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
                     'USING (public.has_club_perm(club_id, %L)) WITH CHECK (public.has_club_perm(club_id, %L))',
                     t || '_write', t, 'sessions', 'sessions');
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

/* =========================================================================
   4. HÀM NỘI BỘ (không cấp cho client)
   ========================================================================= */

-- Bản SQL của setWinner (src/lib/tournament/scoring.js): 'A' | 'B' | 'open' (đang đánh) | 'invalid'.
-- Luật "điểm dừng": bên thắng phải ĐÚNG bằng điểm dừng; thấp hơn = chưa xong; cao hơn = nhập sai.
CREATE OR REPLACE FUNCTION public.tournament_set_state(p_set jsonb, p_rule jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_points int; v_cap int; v_by2 boolean;
  v_a int; v_b int; v_w int; v_l int; v_stop int;
BEGIN
  IF jsonb_typeof(p_set) IS DISTINCT FROM 'array' OR jsonb_array_length(p_set) <> 2
     OR jsonb_typeof(p_set->0) IS DISTINCT FROM 'number' OR jsonb_typeof(p_set->1) IS DISTINCT FROM 'number'
     OR (p_set->>0) !~ '^[0-9]{1,4}$' OR (p_set->>1) !~ '^[0-9]{1,4}$' THEN
    RETURN 'invalid';                                     -- không phải cặp số nguyên ≥ 0 (≤ 4 chữ số: khỏi tràn int)
  END IF;
  IF coalesce(p_rule->>'points', '') !~ '^[0-9]{1,4}$' OR coalesce(p_rule->>'cap', '') !~ '^[0-9]{1,4}$'
     OR jsonb_typeof(p_rule->'winBy2') IS DISTINCT FROM 'boolean' THEN
    RETURN 'invalid';                                     -- luật hỏng: không đoán
  END IF;
  v_points := (p_rule->>'points')::int;
  v_cap    := (p_rule->>'cap')::int;
  v_by2    := (p_rule->>'winBy2')::boolean;
  v_a := (p_set->>0)::int;
  v_b := (p_set->>1)::int;

  IF v_a > v_cap OR v_b > v_cap THEN RETURN 'invalid'; END IF;
  IF v_a = v_b THEN
    RETURN CASE WHEN v_a >= (CASE WHEN v_by2 THEN v_cap ELSE v_points END) THEN 'invalid' ELSE 'open' END;
  END IF;
  v_w := greatest(v_a, v_b);
  v_l := least(v_a, v_b);
  v_stop := CASE
              WHEN NOT v_by2 THEN v_points
              WHEN v_l <= v_points - 2 THEN v_points
              WHEN v_l < v_cap - 1 THEN v_l + 2
              ELSE v_cap
            END;
  IF v_w < v_stop THEN RETURN 'open'; END IF;
  IF v_w > v_stop THEN RETURN 'invalid'; END IF;
  RETURN CASE WHEN v_a > v_b THEN 'A' ELSE 'B' END;
END;
$$;

-- Kiểm kết quả trận theo trạng thái chốt — cùng hành vi `resultError` trong advance.js.
--   done:     mọi set xong theo luật, không thừa set, `p_winner` = bên đủ ceil(sets/2) set.
--   walkover: không có set.
--   retired:  set dở dang được, nhưng từng set không được sai luật và không quá số set.
CREATE OR REPLACE FUNCTION public.tournament_valid_sets(p_sets jsonb, p_rule jsonb, p_winner text, p_status text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_max int; v_need int; v_len int;
  v_wa int := 0; v_wb int := 0;
  v_state text;
  i int;
BEGIN
  IF p_winner IS NULL OR p_winner NOT IN ('A','B') OR jsonb_typeof(p_sets) IS DISTINCT FROM 'array'
     OR (p_rule->>'sets') IS NULL OR (p_rule->>'sets') NOT IN ('1','3','5') THEN
    RETURN false;
  END IF;
  v_max := (p_rule->>'sets')::int;
  v_need := (v_max + 1) / 2;
  v_len := jsonb_array_length(p_sets);

  IF p_status = 'walkover' THEN
    RETURN v_len = 0;
  END IF;
  IF v_len > v_max THEN
    RETURN false;
  END IF;
  IF p_status = 'retired' THEN
    FOR i IN 0 .. v_len - 1 LOOP
      IF tournament_set_state(p_sets->i, p_rule) = 'invalid' THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;
  IF p_status <> 'done' OR v_len = 0 THEN
    RETURN false;
  END IF;

  FOR i IN 0 .. v_len - 1 LOOP
    IF v_wa >= v_need OR v_wb >= v_need THEN RETURN false; END IF;   -- thừa set
    v_state := tournament_set_state(p_sets->i, p_rule);
    IF v_state = 'A' THEN v_wa := v_wa + 1;
    ELSIF v_state = 'B' THEN v_wb := v_wb + 1;
    ELSE RETURN false;                                                -- set sai hoặc chưa xong
    END IF;
  END LOOP;

  RETURN (p_winner = 'A' AND v_wa >= v_need) OR (p_winner = 'B' AND v_wb >= v_need);
END;
$$;

-- Người gọi → club_members.id (ghi vào updated_by / edited_by). Không nhận từ client.
CREATE OR REPLACE FUNCTION public.tournament_caller_member(p_club uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM club_members WHERE club_id = p_club AND user_id = auth.uid() AND active LIMIT 1;
$$;

-- Bản SQL của seatTeam (advance.js): đặt / gỡ đội ở một bên; đủ 2 đội → ready, thiếu → pending.
CREATE OR REPLACE FUNCTION public.tournament_seat(p_match uuid, p_side text, p_team uuid, p_caller uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE tournament_matches SET
    team_a_id = CASE WHEN p_side = 'A' THEN p_team ELSE team_a_id END,
    team_b_id = CASE WHEN p_side = 'B' THEN p_team ELSE team_b_id END,
    status = CASE
               WHEN p_team IS NULL THEN 'pending'
               WHEN status = 'pending'
                    AND (CASE WHEN p_side = 'A' THEN team_b_id ELSE team_a_id END) IS NOT NULL THEN 'ready'
               ELSE status
             END,
    updated_at = now(),
    updated_by = p_caller
  WHERE id = p_match;
$$;

-- Khoá {trận, trận sau, trận 3-4} trong MỘT câu, theo id tăng dần: CK và 3-4 cùng tầng, hai bán kết chốt
-- cùng lúc mà khoá hai dòng này khác thứ tự là deadlock. reset_stage cũng khoá theo id tăng dần.
CREATE OR REPLACE FUNCTION public.tournament_lock_match(p_match uuid)
RETURNS public.tournament_matches
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
BEGIN
  SELECT * INTO v FROM tournament_matches WHERE id = p_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.matchNotFound'; END IF;
  PERFORM 1 FROM tournament_matches
   WHERE id IN (v.id, v.next_match_id, v.loser_next_match_id)
   ORDER BY id FOR UPDATE;
  SELECT * INTO v FROM tournament_matches WHERE id = p_match;        -- đọc lại sau khi khoá
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.matchNotFound'; END IF;  -- vừa bị reset
  RETURN v;
END;
$$;

-- Quyền + giai đoạn còn mở. Trả người gọi (club_members.id).
CREATE OR REPLACE FUNCTION public.tournament_guard(p_club uuid, p_stage uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT has_club_perm(p_club, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;
  IF EXISTS (SELECT 1 FROM tournament_stages WHERE id = p_stage AND status = 'done') THEN
    RAISE EXCEPTION 'tournament.err.stageDone';
  END IF;
  RETURN tournament_caller_member(p_club);
END;
$$;

/* =========================================================================
   5. RPC (SECURITY DEFINER) — chỗ DUY NHẤT ghi tournament_matches / tournament_match_edits
   ========================================================================= */

-- Chỉ TẠO MỚI. Cấu trúc nhánh do bracket.js dựng (có test); ở đây chỉ kiểm + ghi nguyên tử.
-- Ghi 2 lượt: insert mọi trận với con trỏ NULL, rồi mới gắn next/loser_next — trận bán kết trỏ tới
-- chung kết CHƯA được insert, gắn ngay là vỡ khoá ngoại.
CREATE OR REPLACE FUNCTION public.tournament_generate_stage(p_stage uuid, p_groups jsonb, p_matches jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage  tournament_stages%ROWTYPE;
  v_event  text;
  v_caller uuid;
  v_n      int;
BEGIN
  SELECT * INTO v_stage FROM tournament_stages WHERE id = p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.stageNotFound'; END IF;
  IF NOT has_club_perm(v_stage.club_id, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;
  v_caller := tournament_caller_member(v_stage.club_id);

  IF v_stage.status <> 'pending' THEN RAISE EXCEPTION 'tournament.err.stageNotPending'; END IF;
  SELECT status INTO v_event FROM tournament_events WHERE id = v_stage.event_id;
  IF v_event NOT IN ('drawn','running') THEN RAISE EXCEPTION 'tournament.err.eventNotDrawn'; END IF;

  IF jsonb_typeof(p_matches) IS DISTINCT FROM 'array' OR jsonb_array_length(p_matches) = 0
     OR (p_groups IS NOT NULL AND jsonb_typeof(p_groups) <> 'array') THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  -- Trận mới sinh chưa có kết quả: chỉ pending / ready / bye, không điểm, không ghi chú.
  -- Người thắng chỉ có ở trận bye và phải là bên có đội (CHECK bảng bắt nốt phần hình dạng).
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_matches) x
     WHERE coalesce(x->>'status', '') NOT IN ('pending','ready','bye')
        OR coalesce(x->'sets', '[]'::jsonb) <> '[]'::jsonb
        OR (x->>'status' <> 'bye' AND x->>'winner' IS NOT NULL)
        OR (x->>'status' = 'bye' AND (x->>'winner' IS NULL
             OR (x->>'winner' = 'A' AND x->>'teamAId' IS NULL)
             OR (x->>'winner' = 'B' AND x->>'teamBId' IS NULL)))
        OR coalesce(x->'rule'->>'sets', '') NOT IN ('1','3','5')
        OR jsonb_typeof(x->'rule'->'winBy2') IS DISTINCT FROM 'boolean'
        -- CASE chứ không OR: Postgres không hứa tính OR từ trái sang, ép kiểu chuỗi rác là lỗi thô
        OR CASE WHEN coalesce(x->'rule'->>'points', '') ~ '^[0-9]{1,4}$' AND coalesce(x->'rule'->>'cap', '') ~ '^[0-9]{1,4}$'
                THEN (x->'rule'->>'cap')::int < (x->'rule'->>'points')::int
                ELSE true END
  ) THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  INSERT INTO tournament_groups (id, club_id, tournament_id, stage_id, label, seq)
  SELECT (g->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.id, g->>'label', (g->>'seq')::int
    FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g;

  -- Lượt 1: trận, chưa có con trỏ. club/tournament/event/stage lấy từ giai đoạn, không tin payload.
  INSERT INTO tournament_matches (
    id, club_id, tournament_id, event_id, stage_id, group_id, round, slot, round_kind,
    team_a_id, team_b_id, source_a, source_b, rule, status, sets, winner, seq_no, court_label, updated_by
  )
  SELECT (x->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.event_id, v_stage.id,
         (x->>'groupId')::uuid, (x->>'round')::int, (x->>'slot')::int, x->>'roundKind',
         (x->>'teamAId')::uuid, (x->>'teamBId')::uuid, x->'sourceA', x->'sourceB', x->'rule',
         x->>'status', '[]'::jsonb, x->>'winner', (x->>'seqNo')::int, x->>'courtLabel', v_caller
    FROM jsonb_array_elements(p_matches) x;

  -- Lượt 2: con trỏ.
  UPDATE tournament_matches m SET
    next_match_id       = (x->>'nextMatchId')::uuid,
    next_side           = x->>'nextSide',
    loser_next_match_id = (x->>'loserNextMatchId')::uuid,
    loser_next_side     = x->>'loserNextSide'
    FROM jsonb_array_elements(p_matches) x
   WHERE m.id = (x->>'id')::uuid;

  -- Con trỏ phải trỏ vào trận CÙNG giai đoạn và ở vòng SAU (vòng tăng dần ⇒ không thể có vòng lặp).
  -- Bảng (group) phải thuộc giai đoạn này.
  SELECT count(*) INTO v_n
    FROM tournament_matches m
    LEFT JOIN tournament_matches n ON n.id = m.next_match_id
    LEFT JOIN tournament_matches l ON l.id = m.loser_next_match_id
    LEFT JOIN tournament_groups  g ON g.id = m.group_id
   WHERE m.stage_id = p_stage
     AND ((m.next_match_id IS NOT NULL AND (n.stage_id <> p_stage OR n.round <= m.round))
       OR (m.loser_next_match_id IS NOT NULL AND (l.stage_id <> p_stage OR l.round <= m.round))
       OR (m.group_id IS NOT NULL AND g.stage_id <> p_stage));
  IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;

  -- Đội được miễn (bye) phải đã được điền sẵn vào đúng bên của trận sau.
  SELECT count(*) INTO v_n
    FROM tournament_matches b
    JOIN tournament_matches n ON n.id = b.next_match_id
   WHERE b.stage_id = p_stage AND b.status = 'bye'
     AND (CASE b.next_side WHEN 'A' THEN n.team_a_id ELSE n.team_b_id END)
         IS DISTINCT FROM (CASE b.winner WHEN 'A' THEN b.team_a_id ELSE b.team_b_id END);
  IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;

  -- Loại trực tiếp: một đội chỉ đứng ở MỘT trận ngoài trận bye của nó (đội được miễn nằm ở trận bye
  -- và trận kế tiếp). Vòng tròn (Phase 4) thì một đội đá nhiều trận — không áp.
  IF v_stage.type = 'knockout' THEN
    SELECT count(*) INTO v_n FROM (
      SELECT t.team
        FROM tournament_matches m
       CROSS JOIN LATERAL (VALUES (m.team_a_id), (m.team_b_id)) AS t(team)
       WHERE m.stage_id = p_stage AND m.status <> 'bye' AND t.team IS NOT NULL
       GROUP BY t.team HAVING count(*) > 1
    ) d;
    IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;
  END IF;

  UPDATE tournament_stages SET status = 'running' WHERE id = p_stage;
  UPDATE tournament_events SET status = 'running' WHERE id = v_stage.event_id AND status = 'drawn';
END;
$$;

-- Xoá mọi trận / bảng của giai đoạn để sinh lại (đổi chỗ đội vòng đầu = reset rồi generate).
CREATE OR REPLACE FUNCTION public.tournament_reset_stage(p_stage uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage tournament_stages%ROWTYPE;
BEGIN
  IF btrim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'tournament.err.missingReason'; END IF;
  SELECT * INTO v_stage FROM tournament_stages WHERE id = p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.stageNotFound'; END IF;
  IF NOT has_club_perm(v_stage.club_id, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;

  PERFORM 1 FROM tournament_matches WHERE stage_id = p_stage ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tournament_matches
              WHERE stage_id = p_stage AND status IN ('done','walkover','retired')) THEN
    RAISE EXCEPTION 'tournament.err.stageHasResults';
  END IF;
  -- Giai đoạn sau đã sinh trận (kể cả nhánh rỗng) thì chặn — MVP không cascade.
  IF EXISTS (SELECT 1 FROM tournament_stage_links k JOIN tournament_stages s ON s.id = k.to_stage_id
              WHERE k.from_stage_id = p_stage AND s.status <> 'pending') THEN
    RAISE EXCEPTION 'tournament.err.downstreamStageRunning';
  END IF;

  DELETE FROM tournament_matches WHERE stage_id = p_stage;   -- một câu: khoá ngoại nội bảng kiểm ở cuối câu
  DELETE FROM tournament_groups  WHERE stage_id = p_stage;
  UPDATE tournament_stages SET status = 'pending' WHERE id = p_stage;
  -- Không còn giai đoạn nào chạy → nội dung về `drawn` (đội hình vẫn khoá; muốn ghép lại thì BTC mở `pairing`).
  UPDATE tournament_events e SET status = 'drawn'
   WHERE e.id = v_stage.event_id AND e.status = 'running'
     AND NOT EXISTS (SELECT 1 FROM tournament_stages s WHERE s.event_id = e.id AND s.status <> 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_start_match(p_match uuid, p_court text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
BEGIN
  SELECT * INTO v FROM tournament_matches WHERE id = p_match FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.matchNotFound'; END IF;
  v_caller := tournament_guard(v.club_id, v.stage_id);
  IF v.status <> 'ready' THEN RAISE EXCEPTION 'tournament.err.matchNotReady'; END IF;
  UPDATE tournament_matches
     SET status = 'live', court_label = coalesce(nullif(btrim(p_court), ''), court_label),
         started_at = coalesce(started_at, now()), updated_at = now(), updated_by = v_caller
   WHERE id = p_match;
END;
$$;

-- Chốt: done / walkover / retired. Đội thắng → trận sau, đội thua → trận 3-4.
CREATE OR REPLACE FUNCTION public.tournament_commit_match(p_match uuid, p_sets jsonb, p_winner text, p_status text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
  v_sets jsonb := coalesce(p_sets, '[]'::jsonb);
  v_won uuid;
  v_lost uuid;
BEGIN
  v := tournament_lock_match(p_match);
  v_caller := tournament_guard(v.club_id, v.stage_id);

  IF v.status NOT IN ('ready','live') THEN
    RAISE EXCEPTION '%', CASE WHEN v.status IN ('done','walkover','retired','bye')
                              THEN 'tournament.err.alreadyCommitted' ELSE 'tournament.err.matchNotReady' END;
  END IF;
  IF p_winner IS NULL OR p_winner NOT IN ('A','B') THEN RAISE EXCEPTION 'tournament.err.invalidWinner'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('done','walkover','retired') THEN RAISE EXCEPTION 'tournament.err.invalidStatus'; END IF;
  IF p_status <> 'done' AND btrim(coalesce(p_note, '')) = '' THEN RAISE EXCEPTION 'tournament.err.missingReason'; END IF;
  IF p_status = 'walkover' AND jsonb_typeof(v_sets) = 'array' AND jsonb_array_length(v_sets) > 0 THEN
    RAISE EXCEPTION 'tournament.err.walkoverHasSets';
  END IF;
  IF NOT tournament_valid_sets(v_sets, v.rule, p_winner, p_status) THEN
    RAISE EXCEPTION 'tournament.err.invalidSetScore';
  END IF;

  UPDATE tournament_matches
     SET status = p_status, sets = v_sets, winner = p_winner,
         result_note = CASE WHEN p_status = 'done' THEN NULL ELSE btrim(p_note) END,
         finished_at = now(), updated_at = now(), updated_by = v_caller
   WHERE id = p_match;

  v_won  := CASE p_winner WHEN 'A' THEN v.team_a_id ELSE v.team_b_id END;
  v_lost := CASE p_winner WHEN 'A' THEN v.team_b_id ELSE v.team_a_id END;
  IF v.next_match_id IS NOT NULL THEN PERFORM tournament_seat(v.next_match_id, v.next_side, v_won, v_caller); END IF;
  IF v.loser_next_match_id IS NOT NULL THEN
    PERFORM tournament_seat(v.loser_next_match_id, v.loser_next_side, v_lost, v_caller);
  END IF;

  INSERT INTO tournament_match_edits (club_id, tournament_id, match_id, action, old_sets, new_sets, old_winner, new_winner, reason, edited_by)
  VALUES (v.club_id, v.tournament_id, v.id,
          CASE p_status WHEN 'done' THEN 'commit' WHEN 'walkover' THEN 'walkover' ELSE 'retire' END,
          v.sets, v_sets, v.winner, p_winner, nullif(btrim(coalesce(p_note, '')), ''), v_caller);
END;
$$;

-- Sửa ĐIỂM trận đã xong, người thắng giữ nguyên. Đổi người thắng = undo rồi commit.
CREATE OR REPLACE FUNCTION public.tournament_edit_match(p_match uuid, p_sets jsonb, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
BEGIN
  SELECT * INTO v FROM tournament_matches WHERE id = p_match FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.matchNotFound'; END IF;
  v_caller := tournament_guard(v.club_id, v.stage_id);
  IF v.status <> 'done' THEN RAISE EXCEPTION 'tournament.err.cannotEditNotDone'; END IF;
  IF btrim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'tournament.err.missingReason'; END IF;
  IF NOT tournament_valid_sets(p_sets, v.rule, v.winner, 'done') THEN
    RAISE EXCEPTION '%', CASE WHEN tournament_valid_sets(p_sets, v.rule, CASE v.winner WHEN 'A' THEN 'B' ELSE 'A' END, 'done')
                              THEN 'tournament.err.cannotChangeWinnerInEdit' ELSE 'tournament.err.invalidSetScore' END;
  END IF;

  UPDATE tournament_matches SET sets = p_sets, updated_at = now(), updated_by = v_caller WHERE id = p_match;
  INSERT INTO tournament_match_edits (club_id, tournament_id, match_id, action, old_sets, new_sets, old_winner, new_winner, reason, edited_by)
  VALUES (v.club_id, v.tournament_id, v.id, 'edit', v.sets, p_sets, v.winner, v.winner, btrim(p_reason), v_caller);
END;
$$;

-- Gỡ kết quả + gỡ đội ở CẢ trận sau lẫn trận 3-4. Chặn khi trận đích đã đánh / đang đánh.
CREATE OR REPLACE FUNCTION public.tournament_undo_match(p_match uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
BEGIN
  v := tournament_lock_match(p_match);
  v_caller := tournament_guard(v.club_id, v.stage_id);
  IF v.status = 'bye' THEN RAISE EXCEPTION 'tournament.err.cannotUndoBye'; END IF;
  IF v.status NOT IN ('done','walkover','retired') THEN RAISE EXCEPTION 'tournament.err.matchNotDone'; END IF;
  IF EXISTS (SELECT 1 FROM tournament_matches
              WHERE id IN (v.next_match_id, v.loser_next_match_id)
                AND status IN ('live','done','walkover','retired')) THEN
    RAISE EXCEPTION 'tournament.err.downstreamHasResult';
  END IF;
  IF btrim(coalesce(p_reason, '')) = '' THEN RAISE EXCEPTION 'tournament.err.missingReason'; END IF;

  IF v.next_match_id IS NOT NULL THEN PERFORM tournament_seat(v.next_match_id, v.next_side, NULL, v_caller); END IF;
  IF v.loser_next_match_id IS NOT NULL THEN
    PERFORM tournament_seat(v.loser_next_match_id, v.loser_next_side, NULL, v_caller);
  END IF;
  UPDATE tournament_matches
     SET status = 'ready', sets = '[]'::jsonb, winner = NULL, result_note = NULL, finished_at = NULL,
         updated_at = now(), updated_by = v_caller
   WHERE id = p_match;

  INSERT INTO tournament_match_edits (club_id, tournament_id, match_id, action, old_sets, new_sets, old_winner, new_winner, reason, edited_by)
  VALUES (v.club_id, v.tournament_id, v.id, 'undo', v.sets, '[]'::jsonb, v.winner, NULL, btrim(p_reason), v_caller);
END;
$$;

-- BTC chỉnh thứ tự / sân ("BTC có quyền điều chỉnh lịch"). Trận đã có kết quả thì thôi.
CREATE OR REPLACE FUNCTION public.tournament_schedule_match(p_match uuid, p_seq_no int, p_court text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
BEGIN
  SELECT * INTO v FROM tournament_matches WHERE id = p_match FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.matchNotFound'; END IF;
  v_caller := tournament_guard(v.club_id, v.stage_id);
  IF v.status IN ('done','walkover','retired','bye') THEN RAISE EXCEPTION 'tournament.err.cannotScheduleFinished'; END IF;
  UPDATE tournament_matches
     SET seq_no = p_seq_no, court_label = nullif(btrim(coalesce(p_court, '')), ''),
         updated_at = now(), updated_by = v_caller
   WHERE id = p_match;
END;
$$;

/* =========================================================================
   6. QUYỀN GỌI HÀM
   Hàm nội bộ: thu hồi khỏi client (chạy được bên trong RPC vì RPC chạy với quyền chủ hàm).
   ========================================================================= */

REVOKE ALL ON FUNCTION public.tournament_lineup_guard()                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_registration_guard()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_set_state(jsonb, jsonb)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_valid_sets(jsonb, jsonb, text, text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_caller_member(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_seat(uuid, text, uuid, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_lock_match(uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_guard(uuid, uuid)                     FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.tournament_generate_stage(uuid, jsonb, jsonb)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_reset_stage(uuid, text)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_start_match(uuid, text)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_commit_match(uuid, jsonb, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_edit_match(uuid, jsonb, text)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_undo_match(uuid, text)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tournament_schedule_match(uuid, int, text)             FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tournament_generate_stage(uuid, jsonb, jsonb)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_reset_stage(uuid, text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_start_match(uuid, text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_commit_match(uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_edit_match(uuid, jsonb, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_undo_match(uuid, text)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_schedule_match(uuid, int, text)             TO authenticated;

COMMIT;

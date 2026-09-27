-- 0063_tournament_swiss_double.sql — Module Giải đấu: thể thức Thụy Sĩ + Nhánh thắng/Nhánh thua (double elimination).
--
-- THỤY SĨ (tournament_stages.type = 'swiss'):
--   · Một giai đoạn = MỘT bảng chứa mọi đội (dùng lại tournament_groups / group_teams / final_rank / close_stage /
--     entrantsFromLinks như vòng tròn). Trận: round_kind 'group', không con trỏ next.
--   · Vòng 1 sinh bằng tournament_generate_stage (chỉ round 0). Các vòng sau sinh DẦN bằng
--     tournament_add_swiss_round khi vòng trước đã xong hết — cặp đấu do client ghép theo điểm hiện tại
--     (src/lib/tournament/swiss.js, có test). DB kiểm TOÀN VẸN (đủ mọi đội, mỗi đội đúng 1 lần, ≤ 1 bye);
--     số vòng tối đa và né đấu lại là chính sách ghép cặp, ở client.
--   · Bye (số đội lẻ): trận status 'bye' một đội, thắng sẵn — tính 1 trận thắng khi xếp hạng.
--   · Hoàn tác trận của vòng đã có vòng sau → chặn (cặp vòng sau ghép theo kết quả đó).
--
-- NHÁNH THẮNG / NHÁNH THUA (tournament_stages.type = 'knockout', config.bracket = 'double'):
--   · Không thêm cột: round_kind thêm 'wf' (chung kết nhánh thắng), 'lb' (nhánh thua), 'gf' (chung kết tổng),
--     'gf2' (chung kết tổng trận 2). `round` đánh số chung để con trỏ luôn trỏ tới vòng SAU (kiểm sẵn ở
--     generate): nhánh thắng 4r, nhánh thua 2k+5, chung kết tổng 4R (trận 2: 4R+1) — không trùng (stage, round, slot).
--   · Đội thua đi tiếp bằng loser_next_match_id có sẵn — commit/undo không đổi cho mọi trận thường.
--   · Chung kết tổng: đội nhánh thắng ở bên A. Đội nhánh thua (B) thắng → cả hai cùng mới thua 1 trận → RPC chèn
--     trận 'gf2' ngay trong commit. Hoàn tác 'gf' → xoá 'gf2' (chặn nếu 'gf2' đang/đã đánh).
--
-- Không đụng Elo / điểm mùa (D1) → không cần backtest.

BEGIN;

ALTER TABLE public.tournament_stages DROP CONSTRAINT IF EXISTS tournament_stages_type_check;
ALTER TABLE public.tournament_stages
  ADD CONSTRAINT tournament_stages_type_check CHECK (type IN ('knockout','round_robin','swiss'));

ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_round_kind_check;
ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_round_kind_check
  CHECK (round_kind IN ('r32','r16','qf','sf','final','third','group','wf','lb','gf','gf2'));

/* 1. Sinh lịch: thêm nhánh Thụy Sĩ (bản 0058 + phần 'swiss') ============== */

CREATE OR REPLACE FUNCTION public.tournament_generate_stage(
  p_stage   uuid,
  p_groups  jsonb,
  p_matches jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage  tournament_stages%ROWTYPE;
  v_caller uuid;
  v_event  text;
  v_n      int;
BEGIN
  SELECT * INTO v_stage FROM tournament_stages WHERE id = p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.stageNotFound'; END IF;
  IF NOT has_club_perm(v_stage.club_id, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;
  v_caller := tournament_caller_member(v_stage.club_id);

  IF v_stage.status <> 'pending' THEN RAISE EXCEPTION 'tournament.err.stageNotPending'; END IF;
  SELECT status INTO v_event FROM tournament_events WHERE id = v_stage.event_id;
  IF v_event NOT IN ('drawn','running') THEN RAISE EXCEPTION 'tournament.err.eventNotDrawn'; END IF;

  IF EXISTS (
    SELECT 1 FROM tournament_stage_links l
      JOIN tournament_stages s ON s.id = l.from_stage_id
     WHERE l.to_stage_id = p_stage AND s.status <> 'done'
  ) THEN
    RAISE EXCEPTION 'tournament.err.priorStageNotDone';
  END IF;

  IF jsonb_typeof(p_matches) IS DISTINCT FROM 'array' OR jsonb_array_length(p_matches) = 0
     OR (p_groups IS NOT NULL AND jsonb_typeof(p_groups) <> 'array') THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

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
        OR CASE WHEN coalesce(x->'rule'->>'points', '') ~ '^[0-9]{1,4}$' AND coalesce(x->'rule'->>'cap', '') ~ '^[0-9]{1,4}$'
                THEN (x->'rule'->>'cap')::int < (x->'rule'->>'points')::int
                ELSE true END
  ) THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  INSERT INTO tournament_groups (id, club_id, tournament_id, stage_id, label, seq)
  SELECT (g->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.id, g->>'label', (g->>'seq')::int
    FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g;

  INSERT INTO tournament_group_teams (club_id, tournament_id, group_id, team_id, seed_in_group)
  SELECT v_stage.club_id, v_stage.tournament_id, (g->>'id')::uuid, (t->>'teamId')::uuid, (t->>'seedInGroup')::int
    FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g,
         jsonb_array_elements(coalesce(g->'teams', '[]'::jsonb)) t;

  IF EXISTS (
    SELECT 1 FROM tournament_group_teams gt
      JOIN tournament_groups g ON g.id = gt.group_id
      JOIN tournament_teams  t ON t.id = gt.team_id
     WHERE g.stage_id = p_stage AND t.event_id <> v_stage.event_id
  ) OR EXISTS (
    SELECT 1 FROM tournament_group_teams gt
      JOIN tournament_groups g ON g.id = gt.group_id
     WHERE g.stage_id = p_stage
     GROUP BY gt.team_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  INSERT INTO tournament_matches (
    id, club_id, tournament_id, event_id, stage_id, group_id, round, slot, round_kind,
    team_a_id, team_b_id, source_a, source_b, rule, status, sets, winner, seq_no, court_label, updated_by
  )
  SELECT (x->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.event_id, v_stage.id,
         (x->>'groupId')::uuid, (x->>'round')::int, (x->>'slot')::int, x->>'roundKind',
         (x->>'teamAId')::uuid, (x->>'teamBId')::uuid, x->'sourceA', x->'sourceB', x->'rule',
         x->>'status', '[]'::jsonb, x->>'winner', (x->>'seqNo')::int, x->>'courtLabel', v_caller
    FROM jsonb_array_elements(p_matches) x;

  UPDATE tournament_matches m SET
    next_match_id       = (x->>'nextMatchId')::uuid,
    next_side           = x->>'nextSide',
    loser_next_match_id = (x->>'loserNextMatchId')::uuid,
    loser_next_side     = x->>'loserNextSide'
    FROM jsonb_array_elements(p_matches) x
   WHERE m.id = (x->>'id')::uuid;

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

  SELECT count(*) INTO v_n
    FROM tournament_matches b
    JOIN tournament_matches n ON n.id = b.next_match_id
   WHERE b.stage_id = p_stage AND b.status = 'bye'
     AND (CASE b.next_side WHEN 'A' THEN n.team_a_id ELSE n.team_b_id END)
         IS DISTINCT FROM (CASE b.winner WHEN 'A' THEN b.team_a_id ELSE b.team_b_id END);
  IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;

  -- Vòng tròn / Thụy Sĩ: trận nào cũng thuộc một bảng, đội nằm trong bảng đó. Bye chỉ Thụy Sĩ có.
  IF v_stage.type IN ('round_robin','swiss') THEN
    SELECT count(*) INTO v_n
      FROM tournament_matches m
     WHERE m.stage_id = p_stage
       AND (m.group_id IS NULL
         OR (m.status = 'bye' AND v_stage.type <> 'swiss')
         OR (m.status <> 'bye' AND (m.team_a_id IS NULL OR m.team_b_id IS NULL OR m.team_a_id = m.team_b_id))
         OR (m.team_a_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_group_teams gt WHERE gt.group_id = m.group_id AND gt.team_id = m.team_a_id))
         OR (m.team_b_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tournament_group_teams gt WHERE gt.group_id = m.group_id AND gt.team_id = m.team_b_id)));
  ELSE
    SELECT count(*) INTO v_n FROM tournament_matches m WHERE m.stage_id = p_stage AND m.group_id IS NOT NULL;
  END IF;
  IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;

  -- Thụy Sĩ: đúng một bảng; chỉ sinh vòng 1; không con trỏ; mỗi đội đúng một lần trong vòng (kể cả bye).
  IF v_stage.type = 'swiss' THEN
    IF (SELECT count(*) FROM tournament_groups WHERE stage_id = p_stage) <> 1
       OR EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = p_stage
                   AND (round <> 0 OR next_match_id IS NOT NULL OR loser_next_match_id IS NOT NULL))
       OR (SELECT count(*) FROM tournament_matches WHERE stage_id = p_stage AND status = 'bye') > 1
       OR EXISTS (SELECT 1 FROM tournament_matches m
                   CROSS JOIN LATERAL (VALUES (m.team_a_id), (m.team_b_id)) AS t(team)
                   WHERE m.stage_id = p_stage AND t.team IS NOT NULL
                   GROUP BY t.team HAVING count(*) > 1)
       OR (SELECT count(*) FROM tournament_group_teams gt JOIN tournament_groups g ON g.id = gt.group_id WHERE g.stage_id = p_stage)
          <> (SELECT count(*) FROM tournament_matches m
               CROSS JOIN LATERAL (VALUES (m.team_a_id), (m.team_b_id)) AS t(team)
               WHERE m.stage_id = p_stage AND t.team IS NOT NULL) THEN
      RAISE EXCEPTION 'tournament.err.invalidPayload';
    END IF;
  END IF;

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

/* 2. Thụy Sĩ: sinh vòng kế tiếp ============================================ */

CREATE OR REPLACE FUNCTION public.tournament_add_swiss_round(p_stage uuid, p_matches jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage  tournament_stages%ROWTYPE;
  v_caller uuid;
  v_group  uuid;
  v_round  int;
  v_teams  int;
BEGIN
  SELECT * INTO v_stage FROM tournament_stages WHERE id = p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.stageNotFound'; END IF;
  IF NOT has_club_perm(v_stage.club_id, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;
  v_caller := tournament_caller_member(v_stage.club_id);
  IF v_stage.type <> 'swiss' THEN RAISE EXCEPTION 'tournament.err.stageNotSwiss'; END IF;
  IF v_stage.status <> 'running' THEN RAISE EXCEPTION 'tournament.err.stageNotRunning'; END IF;

  -- Khoá cả tập trận (cùng thứ tự các RPC khác) rồi mới kiểm vòng trước đã xong.
  PERFORM 1 FROM tournament_matches WHERE stage_id = p_stage ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = p_stage AND status IN ('pending','ready','live')) THEN
    RAISE EXCEPTION 'tournament.err.swissRoundNotFinished';
  END IF;
  SELECT coalesce(max(round), -1) + 1 INTO v_round FROM tournament_matches WHERE stage_id = p_stage;
  SELECT id INTO v_group FROM tournament_groups WHERE stage_id = p_stage;
  SELECT count(*) INTO v_teams FROM tournament_group_teams WHERE group_id = v_group;

  IF jsonb_typeof(p_matches) IS DISTINCT FROM 'array' OR jsonb_array_length(p_matches) = 0 THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_matches) x
     WHERE coalesce(x->>'status', '') NOT IN ('ready','bye')
        OR coalesce(x->'sets', '[]'::jsonb) <> '[]'::jsonb
        OR (x->>'groupId')::uuid IS DISTINCT FROM v_group
        OR (x->>'round')::int IS DISTINCT FROM v_round
        OR x->>'roundKind' IS DISTINCT FROM 'group'
        OR x->>'nextMatchId' IS NOT NULL OR x->>'loserNextMatchId' IS NOT NULL
        OR (x->>'status' = 'ready' AND (x->>'winner' IS NOT NULL OR x->>'teamAId' IS NULL OR x->>'teamBId' IS NULL
             OR x->>'teamAId' = x->>'teamBId'))
        OR (x->>'status' = 'bye' AND (x->>'winner' IS DISTINCT FROM 'A' OR x->>'teamAId' IS NULL OR x->>'teamBId' IS NOT NULL))
        OR coalesce(x->'rule'->>'sets', '') NOT IN ('1','3','5')
        OR jsonb_typeof(x->'rule'->'winBy2') IS DISTINCT FROM 'boolean'
        OR CASE WHEN coalesce(x->'rule'->>'points', '') ~ '^[0-9]{1,4}$' AND coalesce(x->'rule'->>'cap', '') ~ '^[0-9]{1,4}$'
                THEN (x->'rule'->>'cap')::int < (x->'rule'->>'points')::int
                ELSE true END
  ) OR (SELECT count(*) FROM jsonb_array_elements(p_matches) x WHERE x->>'status' = 'bye') > 1 THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  -- Đủ và đúng: mọi đội của bảng xuất hiện đúng một lần trong vòng (đánh hoặc bye), không đội lạ.
  IF (SELECT count(*) FROM (
        SELECT t.team FROM jsonb_array_elements(p_matches) x
         CROSS JOIN LATERAL (VALUES ((x->>'teamAId')::uuid), ((x->>'teamBId')::uuid)) AS t(team)
         WHERE t.team IS NOT NULL) a) <> v_teams
     OR (SELECT count(DISTINCT t.team) FROM jsonb_array_elements(p_matches) x
          CROSS JOIN LATERAL (VALUES ((x->>'teamAId')::uuid), ((x->>'teamBId')::uuid)) AS t(team)
          JOIN tournament_group_teams gt ON gt.group_id = v_group AND gt.team_id = t.team) <> v_teams THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  INSERT INTO tournament_matches (
    id, club_id, tournament_id, event_id, stage_id, group_id, round, slot, round_kind,
    team_a_id, team_b_id, source_a, source_b, rule, status, sets, winner, seq_no, court_label, updated_by
  )
  SELECT (x->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.event_id, v_stage.id,
         v_group, v_round, (x->>'slot')::int, 'group',
         (x->>'teamAId')::uuid, (x->>'teamBId')::uuid, x->'sourceA', x->'sourceB', x->'rule',
         x->>'status', '[]'::jsonb, x->>'winner', NULL, NULL, v_caller
    FROM jsonb_array_elements(p_matches) x;
END;
$$;

/* 3. Chốt giai đoạn: nhận cả Thụy Sĩ (bản 0058, chỉ đổi điều kiện type) ===== */

CREATE OR REPLACE FUNCTION public.tournament_close_stage(
  p_stage uuid,
  p_ranks jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage  tournament_stages%ROWTYPE;
  v_caller uuid;
  v_total  int;
  v_n      int;
BEGIN
  SELECT * INTO v_stage FROM tournament_stages WHERE id = p_stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament.err.stageNotFound'; END IF;
  IF NOT has_club_perm(v_stage.club_id, 'sessions') THEN RAISE EXCEPTION 'tournament.err.permissionDenied'; END IF;
  v_caller := tournament_caller_member(v_stage.club_id);

  IF v_stage.type NOT IN ('round_robin','swiss') THEN RAISE EXCEPTION 'tournament.err.stageNotRoundRobin'; END IF;
  IF v_stage.status <> 'running' THEN RAISE EXCEPTION 'tournament.err.stageNotRunning'; END IF;

  PERFORM 1 FROM tournament_matches WHERE stage_id = p_stage ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = p_stage AND status IN ('pending','ready','live')) THEN
    RAISE EXCEPTION 'tournament.err.stageMatchesNotFinished';
  END IF;

  IF jsonb_typeof(p_ranks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ranks) = 0 THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  SELECT count(*) INTO v_total
    FROM tournament_group_teams gt JOIN tournament_groups g ON g.id = gt.group_id
   WHERE g.stage_id = p_stage;

  SELECT count(DISTINCT (r."groupId", r."teamId")) INTO v_n
    FROM jsonb_to_recordset(p_ranks) AS r("groupId" uuid, "teamId" uuid, "finalRank" int)
    JOIN tournament_group_teams gt ON gt.group_id = r."groupId" AND gt.team_id = r."teamId"
    JOIN tournament_groups g ON g.id = gt.group_id AND g.stage_id = p_stage;
  IF v_n <> v_total OR jsonb_array_length(p_ranks) <> v_total THEN
    RAISE EXCEPTION 'tournament.err.invalidRanks';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_ranks) AS r("groupId" uuid, "teamId" uuid, "finalRank" int) GROUP BY r."groupId", r."finalRank" HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM jsonb_to_recordset(p_ranks) AS r("groupId" uuid, "teamId" uuid, "finalRank" int)
                 WHERE r."finalRank" IS NULL OR r."finalRank" < 1
                    OR r."finalRank" > (SELECT count(*) FROM tournament_group_teams gt WHERE gt.group_id = r."groupId")) THEN
    RAISE EXCEPTION 'tournament.err.invalidRanks';
  END IF;

  UPDATE tournament_group_teams gt SET final_rank = r."finalRank"
    FROM jsonb_to_recordset(p_ranks) AS r("groupId" uuid, "teamId" uuid, "finalRank" int)
   WHERE gt.group_id = r."groupId" AND gt.team_id = r."teamId";

  UPDATE tournament_stages SET status = 'done' WHERE id = p_stage;

  IF NOT EXISTS (SELECT 1 FROM tournament_stage_links WHERE from_stage_id = p_stage) THEN
    UPDATE tournament_events SET status = 'finished' WHERE id = v_stage.event_id;
  END IF;
END;
$$;

/* 4. Chốt kết quả: + chèn trận 2 chung kết tổng (bản 0057 + khối cuối) ====== */

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

  -- Chung kết tổng: đội nhánh thua (bên B) thắng → hai đội cùng mới thua 1 trận → đá thêm trận 2.
  IF v.round_kind = 'gf' AND p_winner = 'B'
     AND NOT EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = v.stage_id AND round_kind = 'gf2') THEN
    INSERT INTO tournament_matches (
      club_id, tournament_id, event_id, stage_id, group_id, round, slot, round_kind,
      team_a_id, team_b_id, source_a, source_b, rule, status, sets, updated_by
    ) VALUES (
      v.club_id, v.tournament_id, v.event_id, v.stage_id, NULL, v.round + 1, 0, 'gf2',
      v.team_a_id, v.team_b_id,
      jsonb_build_object('kind', 'loser', 'match', v.id), jsonb_build_object('kind', 'winner', 'match', v.id),
      v.rule, 'ready', '[]'::jsonb, v_caller
    );
  END IF;

  INSERT INTO tournament_match_edits (club_id, tournament_id, match_id, action, old_sets, new_sets, old_winner, new_winner, reason, edited_by)
  VALUES (v.club_id, v.tournament_id, v.id,
          CASE p_status WHEN 'done' THEN 'commit' WHEN 'walkover' THEN 'walkover' ELSE 'retire' END,
          v.sets, v_sets, v.winner, p_winner, nullif(btrim(coalesce(p_note, '')), ''), v_caller);
END;
$$;

/* 5. Hoàn tác: + chặn Thụy Sĩ đã có vòng sau · + gỡ trận 2 chung kết tổng ===== */

CREATE OR REPLACE FUNCTION public.tournament_undo_match(p_match uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v tournament_matches%ROWTYPE;
  v_caller uuid;
  v_type text;
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

  SELECT type INTO v_type FROM tournament_stages WHERE id = v.stage_id;
  IF v_type = 'swiss' AND EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = v.stage_id AND round > v.round) THEN
    RAISE EXCEPTION 'tournament.err.swissLaterRound';
  END IF;

  IF v.round_kind = 'gf' THEN
    PERFORM 1 FROM tournament_matches WHERE stage_id = v.stage_id AND round_kind = 'gf2' FOR UPDATE;
    IF EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = v.stage_id AND round_kind = 'gf2'
                AND status IN ('live','done','walkover','retired')) THEN
      RAISE EXCEPTION 'tournament.err.downstreamHasResult';
    END IF;
    DELETE FROM tournament_matches WHERE stage_id = v.stage_id AND round_kind = 'gf2';
  END IF;

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

REVOKE ALL ON FUNCTION public.tournament_add_swiss_round(uuid, jsonb) FROM PUBLIC, anon;  -- Supabase cấp sẵn EXECUTE cho anon (khuôn 0057)
GRANT EXECUTE ON FUNCTION public.tournament_add_swiss_round(uuid, jsonb) TO authenticated;

COMMIT;

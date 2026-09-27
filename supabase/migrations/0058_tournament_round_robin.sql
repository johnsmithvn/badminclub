-- 0058_tournament_round_robin.sql — Module Giải đấu (docs/TOURNAMENT_PLAN.md Phase 4)
--
-- CẬP NHẬT:
-- 1. tournament_generate_stage:
--    - Chặn sinh trận khi giai đoạn trước (qua stage_links) chưa 'done'
--    - Lưu tournament_group_teams khi sinh bảng
--    - Kiểm đội trong bảng: thuộc đúng nội dung, mỗi đội 1 bảng; trận vòng bảng chỉ giữa 2 đội CÙNG bảng
-- 2. tournament_close_stage (chỉ vòng bảng):
--    - Khoá mọi trận của giai đoạn (ORDER BY id) rồi mới đếm trận chưa xong → không lọt hoàn tác chen ngang
--    - p_ranks phải phủ ĐÚNG mọi đội của các bảng thuộc giai đoạn này, hạng 1..n không trùng trong bảng
--    - Ghi final_rank, chuyển giai đoạn sang 'done'
--    - Không có link sang giai đoạn sau (mẫu `rr`) → nội dung sang 'finished'

BEGIN;

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

  -- Nếu giai đoạn này nhận liên kết từ giai đoạn trước, giai đoạn trước BẮT BUỘC phải status = 'done'
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
        OR CASE WHEN coalesce(x->'rule'->>'points', '') ~ '^[0-9]{1,4}$' AND coalesce(x->'rule'->>'cap', '') ~ '^[0-9]{1,4}$'
                THEN (x->'rule'->>'cap')::int < (x->'rule'->>'points')::int
                ELSE true END
  ) THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  -- Thêm bảng
  INSERT INTO tournament_groups (id, club_id, tournament_id, stage_id, label, seq)
  SELECT (g->>'id')::uuid, v_stage.club_id, v_stage.tournament_id, v_stage.id, g->>'label', (g->>'seq')::int
    FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g;

  -- Thêm danh sách đội vào bảng (kèm seed_in_group)
  INSERT INTO tournament_group_teams (club_id, tournament_id, group_id, team_id, seed_in_group)
  SELECT v_stage.club_id, v_stage.tournament_id, (g->>'id')::uuid, (t->>'teamId')::uuid, (t->>'seedInGroup')::int
    FROM jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g,
         jsonb_array_elements(coalesce(g->'teams', '[]'::jsonb)) t;

  -- Đội trong bảng: phải thuộc nội dung của giai đoạn, và mỗi đội chỉ ở MỘT bảng của giai đoạn.
  -- (PK group_teams là (group_id, team_id) nên không tự chặn một đội nằm 2 bảng.)
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

  -- Vòng bảng: trận nào cũng thuộc một bảng, hai đội đều nằm trong bảng đó. Loại trực tiếp: không có bảng.
  IF v_stage.type = 'round_robin' THEN
    SELECT count(*) INTO v_n
      FROM tournament_matches m
     WHERE m.stage_id = p_stage
       AND (m.group_id IS NULL OR m.team_a_id IS NULL OR m.team_b_id IS NULL OR m.team_a_id = m.team_b_id
         OR NOT EXISTS (SELECT 1 FROM tournament_group_teams gt WHERE gt.group_id = m.group_id AND gt.team_id = m.team_a_id)
         OR NOT EXISTS (SELECT 1 FROM tournament_group_teams gt WHERE gt.group_id = m.group_id AND gt.team_id = m.team_b_id));
  ELSE
    SELECT count(*) INTO v_n FROM tournament_matches m WHERE m.stage_id = p_stage AND m.group_id IS NOT NULL;
  END IF;
  IF v_n > 0 THEN RAISE EXCEPTION 'tournament.err.invalidPayload'; END IF;

  -- Loại trực tiếp: một đội chỉ đứng ở MỘT trận ngoài trận bye của nó.
  -- Vòng tròn thì một đội đá nhiều trận — không áp.
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

-- Chốt thứ hạng vòng bảng và kết thúc giai đoạn. Thứ hạng do client tính (standings.js) + BTC xử hoà;
-- RPC không xếp hạng lại, chỉ kiểm payload khớp đúng các đội của giai đoạn.
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

  IF v_stage.type <> 'round_robin' THEN RAISE EXCEPTION 'tournament.err.stageNotRoundRobin'; END IF;
  IF v_stage.status <> 'running' THEN RAISE EXCEPTION 'tournament.err.stageNotRunning'; END IF;

  -- Khoá cả tập trận (cùng thứ tự các RPC khác) rồi mới đếm: commit/undo khoá trận TRƯỚC khi kiểm
  -- `stageDone`, nên hoặc chúng chạy xong trước (ta thấy kết quả mới), hoặc chờ ta xong rồi bị `stageDone`.
  PERFORM 1 FROM tournament_matches WHERE stage_id = p_stage ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = p_stage AND status IN ('pending','ready','live')) THEN
    RAISE EXCEPTION 'tournament.err.stageMatchesNotFinished';
  END IF;

  IF jsonb_typeof(p_ranks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ranks) = 0 THEN
    RAISE EXCEPTION 'tournament.err.invalidPayload';
  END IF;

  -- Payload đọc bằng jsonb_to_recordset: khoá thiếu → NULL, sai kiểu → lỗi (đều bị từ chối).
  SELECT count(*) INTO v_total
    FROM tournament_group_teams gt JOIN tournament_groups g ON g.id = gt.group_id
   WHERE g.stage_id = p_stage;

  -- Đủ và đúng: mỗi đội của giai đoạn đúng 1 dòng, không dòng nào trỏ ra ngoài giai đoạn (hay sang CLB khác).
  SELECT count(DISTINCT (r."groupId", r."teamId")) INTO v_n
    FROM jsonb_to_recordset(p_ranks) AS r("groupId" uuid, "teamId" uuid, "finalRank" int)
    JOIN tournament_group_teams gt ON gt.group_id = r."groupId" AND gt.team_id = r."teamId"
    JOIN tournament_groups g ON g.id = gt.group_id AND g.stage_id = p_stage;
  IF v_n <> v_total OR jsonb_array_length(p_ranks) <> v_total THEN
    RAISE EXCEPTION 'tournament.err.invalidRanks';
  END IF;

  -- Hạng trong mỗi bảng là 1..số đội của bảng, không trùng.
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

  -- Không có giai đoạn nào nhận đội từ đây (mẫu `rr`) → nội dung xong.
  IF NOT EXISTS (SELECT 1 FROM tournament_stage_links WHERE from_stage_id = p_stage) THEN
    UPDATE tournament_events SET status = 'finished' WHERE id = v_stage.event_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tournament_close_stage(uuid, jsonb) FROM PUBLIC, anon;  -- Supabase cấp sẵn EXECUTE cho anon (khuôn 0057)
GRANT EXECUTE ON FUNCTION public.tournament_close_stage(uuid, jsonb) TO authenticated;

COMMIT;

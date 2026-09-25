-- 0058_tournament_round_robin_check.sql — kiểm tra migration 0058 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0058_tournament_round_robin.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0058 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ toàn bộ dữ liệu thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.

DO $check$
DECLARE
  v_club   uuid;
  v_owner  uuid;
  v_user   uuid;
  v_tour   uuid;
  v_event  uuid;
  v_stage1 uuid;
  v_stage2 uuid;
  v_grpA   uuid := '00000000-0000-4000-8400-000000000001';
  v_grpB   uuid := '00000000-0000-4000-8400-000000000002';
  T1       uuid := '00000000-0000-4000-8100-000000000001';
  T2       uuid := '00000000-0000-4000-8100-000000000002';
  T3       uuid := '00000000-0000-4000-8100-000000000003';
  T4       uuid := '00000000-0000-4000-8100-000000000004';
  M1       uuid := '00000000-0000-4000-8300-000000000001';
  M2       uuid := '00000000-0000-4000-8300-000000000002';
  v_n      int;
  v_err    text;
BEGIN
  CREATE FUNCTION pg_temp.err_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text;
  BEGIN
    BEGIN
      EXECUTE p_sql;
      RAISE EXCEPTION USING MESSAGE = '__no_error__';
    EXCEPTION WHEN OTHERS THEN v := SQLERRM;
    END;
    RETURN CASE WHEN v = '__no_error__' THEN '(không lỗi)' ELSE v END;
  END $f$;

  CREATE FUNCTION pg_temp.expect(p_step text, p_sql text, p_key text) RETURNS void LANGUAGE plpgsql AS $f$
  DECLARE v text := pg_temp.err_of(p_sql);
  BEGIN
    IF v <> p_key THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC %: mong đợi ''%'' nhưng nhận được ''%''', p_step, p_key, v;
    END IF;
  END $f$;

  -- 1. Tìm chủ CLB thử nghiệm
  SELECT m.club_id, m.id, m.user_id INTO v_club, v_owner, v_user
    FROM club_members m
    JOIN clubs c ON c.id = m.club_id
   WHERE m.role = 'owner' AND m.user_id IS NOT NULL AND c.deleted_at IS NULL
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Cần ít nhất một CLB có owner đã liên kết tài khoản để kiểm tra.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  -- 2. Tạo giải đấu & nội dung thử nghiệm
  INSERT INTO tournaments (club_id, name, starts_on, fee_male, fee_female, created_by)
  VALUES (v_club, '__TEST_RR_PHASE4__', current_date, 100000, 100000, v_owner)
  RETURNING id INTO v_tour;

  INSERT INTO tournament_events (club_id, tournament_id, kind, team_size, gender_rule, status)
  VALUES (v_club, v_tour, 'ms', 1, 'male', 'drawn')
  RETURNING id INTO v_event;

  -- 3. Tạo 2 giai đoạn: Stage 1 (round_robin), Stage 2 (knockout)
  INSERT INTO tournament_stages (club_id, tournament_id, event_id, seq, type, status, match_rule)
  VALUES (v_club, v_tour, v_event, 1, 'round_robin', 'pending', '{"sets":1,"points":21,"winBy2":true,"cap":30}')
  RETURNING id INTO v_stage1;

  INSERT INTO tournament_stages (club_id, tournament_id, event_id, seq, type, status, match_rule)
  VALUES (v_club, v_tour, v_event, 2, 'knockout', 'pending', '{"sets":1,"points":21,"winBy2":true,"cap":30}')
  RETURNING id INTO v_stage2;

  -- 4. Tạo liên kết stage_links (lấy rank 1, 2 từ Stage 1 sang Stage 2)
  INSERT INTO tournament_stage_links (club_id, tournament_id, from_stage_id, to_stage_id, ranks)
  VALUES (v_club, v_tour, v_stage1, v_stage2, ARRAY[1, 2]);

  -- 5. Tạo 4 đội
  INSERT INTO tournament_teams (id, club_id, tournament_id, event_id, name) VALUES
    (T1, v_club, v_tour, v_event, 'Đội 1'),
    (T2, v_club, v_tour, v_event, 'Đội 2'),
    (T3, v_club, v_tour, v_event, 'Đội 3'),
    (T4, v_club, v_tour, v_event, 'Đội 4');

  -- 6. Kiểm tra: Chưa xong Stage 1 mà sinh Stage 2 thì bị chặn (priorStageNotDone)
  PERFORM pg_temp.expect('Chặn sinh Stage 2 khi Stage 1 chưa done',
    format('SELECT tournament_generate_stage(%L, %L::jsonb, %L::jsonb)',
      v_stage2, '[]',
      format('[{"id":%L,"stageId":%L,"round":0,"slot":0,"roundKind":"final","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null}]',
        gen_random_uuid(), v_stage2, T1, T2)),
    'tournament.err.priorStageNotDone'
  );

  -- 6b. Một đội nằm ở 2 bảng → invalidPayload
  PERFORM pg_temp.expect('Chặn một đội ở 2 bảng',
    format('SELECT tournament_generate_stage(%L, %L::jsonb, %L::jsonb)', v_stage1,
      format('[{"id":%L,"label":"A","seq":1,"teams":[{"teamId":%L},{"teamId":%L}]},{"id":%L,"label":"B","seq":2,"teams":[{"teamId":%L},{"teamId":%L}]}]',
        v_grpA, T1, T2, v_grpB, T1, T4),
      format('[{"id":%L,"groupId":%L,"round":0,"slot":0,"roundKind":"group","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null}]',
        M1, v_grpA, T1, T2)),
    'tournament.err.invalidPayload');

  -- 6c. Trận vòng bảng giữa 2 đội KHÁC bảng → invalidPayload
  PERFORM pg_temp.expect('Chặn trận vòng bảng khác bảng',
    format('SELECT tournament_generate_stage(%L, %L::jsonb, %L::jsonb)', v_stage1,
      format('[{"id":%L,"label":"A","seq":1,"teams":[{"teamId":%L},{"teamId":%L}]},{"id":%L,"label":"B","seq":2,"teams":[{"teamId":%L},{"teamId":%L}]}]',
        v_grpA, T1, T2, v_grpB, T3, T4),
      format('[{"id":%L,"groupId":%L,"round":0,"slot":0,"roundKind":"group","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null}]',
        M1, v_grpA, T1, T3)),
    'tournament.err.invalidPayload');

  -- 7. Sinh trận và bảng cho Stage 1 (có kèm danh sách teams trong groups)
  PERFORM tournament_generate_stage(
    v_stage1,
    format('[
      {"id":%L,"label":"A","seq":1,"teams":[{"teamId":%L,"seedInGroup":1},{"teamId":%L,"seedInGroup":2}]},
      {"id":%L,"label":"B","seq":2,"teams":[{"teamId":%L,"seedInGroup":1},{"teamId":%L,"seedInGroup":2}]}
    ]', v_grpA, T1, T2, v_grpB, T3, T4)::jsonb,
    format('[
      {"id":%L,"groupId":%L,"round":0,"slot":0,"roundKind":"group","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null},
      {"id":%L,"groupId":%L,"round":0,"slot":0,"roundKind":"group","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null}
    ]', M1, v_grpA, T1, T2, M2, v_grpB, T3, T4)::jsonb
  );

  -- Kiểm tra dữ liệu tournament_group_teams đã được ghi
  SELECT count(*) INTO v_n FROM tournament_group_teams WHERE group_id IN (v_grpA, v_grpB);
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'SAI: tournament_group_teams phải có 4 dòng, nhưng có % dòng', v_n;
  END IF;

  -- 8. Thử chốt giai đoạn 1 khi trận chưa đánh xong -> lỗi stageMatchesNotFinished
  PERFORM pg_temp.expect('Chặn chốt khi trận chưa xong',
    format('SELECT tournament_close_stage(%L, %L::jsonb)',
      v_stage1, format('[{"groupId":%L,"teamId":%L,"finalRank":1}]', v_grpA, T1)),
    'tournament.err.stageMatchesNotFinished'
  );

  -- 9. Đánh xong 2 trận
  PERFORM tournament_commit_match(M1, '[[21, 19]]'::jsonb, 'A', 'done', null);
  PERFORM tournament_commit_match(M2, '[[21, 15]]'::jsonb, 'A', 'done', null);

  -- 9b. Thứ hạng sai → invalidRanks: thiếu đội · trùng hạng trong bảng · bảng không thuộc giai đoạn
  PERFORM pg_temp.expect('Chặn chốt thiếu đội',
    format('SELECT tournament_close_stage(%L, %L::jsonb)', v_stage1,
      format('[{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":2},{"groupId":%L,"teamId":%L,"finalRank":1}]',
        v_grpA, T1, v_grpA, T2, v_grpB, T3)),
    'tournament.err.invalidRanks');
  PERFORM pg_temp.expect('Chặn chốt trùng hạng',
    format('SELECT tournament_close_stage(%L, %L::jsonb)', v_stage1,
      format('[{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":2}]',
        v_grpA, T1, v_grpA, T2, v_grpB, T3, v_grpB, T4)),
    'tournament.err.invalidRanks');
  PERFORM pg_temp.expect('Chặn chốt trỏ ra bảng lạ',
    format('SELECT tournament_close_stage(%L, %L::jsonb)', v_stage1,
      format('[{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":2},{"groupId":%L,"teamId":%L,"finalRank":1},{"groupId":%L,"teamId":%L,"finalRank":2}]',
        v_grpA, T1, v_grpA, T2, gen_random_uuid(), T3, v_grpB, T4)),
    'tournament.err.invalidRanks');

  -- 10. Chốt giai đoạn 1 thành công
  PERFORM tournament_close_stage(
    v_stage1,
    format('[
      {"groupId":%L,"teamId":%L,"finalRank":1},
      {"groupId":%L,"teamId":%L,"finalRank":2},
      {"groupId":%L,"teamId":%L,"finalRank":1},
      {"groupId":%L,"teamId":%L,"finalRank":2}
    ]', v_grpA, T1, v_grpA, T2, v_grpB, T3, v_grpB, T4)::jsonb
  );

  -- Kiểm tra status của Stage 1
  SELECT count(*) INTO v_n FROM tournament_stages WHERE id = v_stage1 AND status = 'done';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI: stage 1 chưa chuyển sang done'; END IF;

  -- Kiểm tra final_rank trong tournament_group_teams
  SELECT count(*) INTO v_n FROM tournament_group_teams WHERE group_id = v_grpA AND team_id = T1 AND final_rank = 1;
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI: final_rank của T1 chưa được lưu'; END IF;

  -- 10b. Giai đoạn đã chốt: hoàn tác trận vòng bảng bị chặn
  PERFORM pg_temp.expect('Chặn hoàn tác sau khi chốt',
    format('SELECT tournament_undo_match(%L, %L)', M1, 'thử'),
    'tournament.err.stageDone');

  -- 11. Giờ sinh Stage 2 thành công vì Stage 1 đã done
  PERFORM tournament_generate_stage(
    v_stage2,
    '[]'::jsonb,
    format('[{"id":%L,"stageId":%L,"round":0,"slot":0,"roundKind":"final","teamAId":%L,"teamBId":%L,"rule":{"sets":1,"points":21,"winBy2":true,"cap":30},"status":"ready","sets":[],"winner":null}]',
      gen_random_uuid(), v_stage2, T1, T3)::jsonb
  );

  SELECT count(*) INTO v_n FROM tournament_stages WHERE id = v_stage2 AND status = 'running';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI: stage 2 chưa chuyển sang running'; END IF;

  -- Tự huỷ toàn bộ dữ liệu thử
  RAISE EXCEPTION '0058 CHECK OK — Mọi bước kiểm thử Phase 4 (vòng bảng + chốt giai đoạn + liên kết) thành công!';
END $check$;

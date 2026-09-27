-- 0057_tournament_check.sql — kiểm tra migration 0057 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0057_tournaments.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0057 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ toàn bộ dữ liệu thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
-- Cả 3 trường hợp đều KHÔNG ghi gì vào DB: mọi thứ nằm trong một khối DO, lỗi ở đâu là huỷ hết ở đó.
--
-- Cần: một chủ CLB (role owner) đã ghép tài khoản. Script đóng vai người đó (auth.uid()) để gọi RPC,
-- tạo một giải thử trong CLB của người đó — rồi huỷ.
-- Payload sinh nhánh là payload THẬT của src/lib/tournament/bracket.js (5 đội, hạt giống, có tranh 3-4).

DO $check$
DECLARE
  v_club   uuid;
  v_owner  uuid;   -- club_members.id
  v_user   uuid;   -- auth user id
  v_gender text;
  v_member_user uuid;
  v_tour   uuid;
  v_event  uuid;
  v_stage  uuid;
  v_reg    uuid;
  v_err    text;
  v_n      int;
  r        record;
  R30  constant jsonb := '{"sets":1,"points":30,"winBy2":false,"cap":30}';
  R21  constant jsonb := '{"sets":1,"points":21,"winBy2":true,"cap":30}';
  R315 constant jsonb := '{"sets":3,"points":15,"winBy2":false,"cap":15}';
  -- đội T1..T5 và trận M1..M8 có id cố định để khớp payload bên dưới
  T1 constant uuid := '00000000-0000-4000-8100-000000000001';
  T2 constant uuid := '00000000-0000-4000-8100-000000000002';
  T3 constant uuid := '00000000-0000-4000-8100-000000000003';
  T4 constant uuid := '00000000-0000-4000-8100-000000000004';
  T5 constant uuid := '00000000-0000-4000-8100-000000000005';
  QF2   constant uuid := '00000000-0000-4000-8300-000000000002';  -- T4 vs T5
  SF1   constant uuid := '00000000-0000-4000-8300-000000000005';  -- T1 vs thắng QF2
  SF2   constant uuid := '00000000-0000-4000-8300-000000000006';  -- T2 vs T3 (cả hai được bye)
  FINAL constant uuid := '00000000-0000-4000-8300-000000000007';
  THIRD constant uuid := '00000000-0000-4000-8300-000000000008';
  -- node: buildKnockout({ stage: {matchRule: 1×30, ruleOverrides: {final, third: 3×15}, config: {seeding:'seed', thirdPlace:true}}, 5 đội })
  PAYLOAD constant jsonb := '[{"id":"00000000-0000-4000-8300-000000000001","groupId":null,"round":0,"slot":0,"roundKind":"qf","teamAId":"00000000-0000-4000-8100-000000000001","teamBId":null,"sourceA":{"kind":"seed","n":1},"sourceB":{"kind":"bye"},"nextMatchId":"00000000-0000-4000-8300-000000000005","nextSide":"A","loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"bye","sets":[],"winner":"A","resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000002","groupId":null,"round":0,"slot":1,"roundKind":"qf","teamAId":"00000000-0000-4000-8100-000000000004","teamBId":"00000000-0000-4000-8100-000000000005","sourceA":{"kind":"seed","n":4},"sourceB":{"kind":"seed","n":5},"nextMatchId":"00000000-0000-4000-8300-000000000005","nextSide":"B","loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"ready","sets":[],"winner":null,"resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000003","groupId":null,"round":0,"slot":2,"roundKind":"qf","teamAId":"00000000-0000-4000-8100-000000000002","teamBId":null,"sourceA":{"kind":"seed","n":2},"sourceB":{"kind":"bye"},"nextMatchId":"00000000-0000-4000-8300-000000000006","nextSide":"A","loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"bye","sets":[],"winner":"A","resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000004","groupId":null,"round":0,"slot":3,"roundKind":"qf","teamAId":"00000000-0000-4000-8100-000000000003","teamBId":null,"sourceA":{"kind":"seed","n":3},"sourceB":{"kind":"bye"},"nextMatchId":"00000000-0000-4000-8300-000000000006","nextSide":"B","loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"bye","sets":[],"winner":"A","resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000005","groupId":null,"round":1,"slot":0,"roundKind":"sf","teamAId":"00000000-0000-4000-8100-000000000001","teamBId":null,"sourceA":{"kind":"winner","match":"00000000-0000-4000-8300-000000000001"},"sourceB":{"kind":"winner","match":"00000000-0000-4000-8300-000000000002"},"nextMatchId":"00000000-0000-4000-8300-000000000007","nextSide":"A","loserNextMatchId":"00000000-0000-4000-8300-000000000008","loserNextSide":"A","rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"pending","sets":[],"winner":null,"resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000006","groupId":null,"round":1,"slot":1,"roundKind":"sf","teamAId":"00000000-0000-4000-8100-000000000002","teamBId":"00000000-0000-4000-8100-000000000003","sourceA":{"kind":"winner","match":"00000000-0000-4000-8300-000000000003"},"sourceB":{"kind":"winner","match":"00000000-0000-4000-8300-000000000004"},"nextMatchId":"00000000-0000-4000-8300-000000000007","nextSide":"B","loserNextMatchId":"00000000-0000-4000-8300-000000000008","loserNextSide":"B","rule":{"sets":1,"points":30,"winBy2":false,"cap":30},"status":"ready","sets":[],"winner":null,"resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000007","groupId":null,"round":2,"slot":0,"roundKind":"final","teamAId":null,"teamBId":null,"sourceA":{"kind":"winner","match":"00000000-0000-4000-8300-000000000005"},"sourceB":{"kind":"winner","match":"00000000-0000-4000-8300-000000000006"},"nextMatchId":null,"nextSide":null,"loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":3,"points":15,"winBy2":false,"cap":15},"status":"pending","sets":[],"winner":null,"resultNote":null,"seqNo":null,"courtLabel":null},{"id":"00000000-0000-4000-8300-000000000008","groupId":null,"round":2,"slot":1,"roundKind":"third","teamAId":null,"teamBId":null,"sourceA":{"kind":"loser","match":"00000000-0000-4000-8300-000000000005"},"sourceB":{"kind":"loser","match":"00000000-0000-4000-8300-000000000006"},"nextMatchId":null,"nextSide":null,"loserNextMatchId":null,"loserNextSide":null,"rule":{"sets":3,"points":15,"winBy2":false,"cap":15},"status":"pending","sets":[],"winner":null,"resultNote":null,"seqNo":null,"courtLabel":null}]';
BEGIN
  -- Chạy một câu, trả key lỗi (SQLERRM) hoặc '(không lỗi)'. Chạy được thì cũng HUỶ tác dụng (raise nội bộ).
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
    IF v IS DISTINCT FROM p_key THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC %: mong "%", nhận "%"', p_step, p_key, v;
    END IF;
  END $f$;

  CREATE FUNCTION pg_temp.ok(p_step text, p_cond boolean) RETURNS void LANGUAGE plpgsql AS $f$
  BEGIN
    IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'SAI Ở BƯỚC %', p_step; END IF;
  END $f$;

  /* ---------- 1. Luật điểm: cùng bảng ca với src/__tests__/tournament/scoring.test.js ---------- */
  FOR r IN SELECT * FROM (VALUES
    -- sets, rule, winner, status, mong đợi
    ('[[21,19]]', R21, 'A', 'done', true),  ('[[21,5]]',  R21, 'A', 'done', true),
    ('[[22,20]]', R21, 'A', 'done', true),  ('[[29,27]]', R21, 'A', 'done', true),
    ('[[30,29]]', R21, 'A', 'done', true),  ('[[30,28]]', R21, 'A', 'done', true),
    ('[[19,21]]', R21, 'B', 'done', true),
    ('[[21,20]]', R21, 'A', 'done', false), ('[[29,29]]', R21, 'A', 'done', false),
    ('[[20,0]]',  R21, 'A', 'done', false), ('[[30,30]]', R21, 'A', 'done', false),
    ('[[31,29]]', R21, 'A', 'done', false), ('[[24,21]]', R21, 'A', 'done', false),
    ('[[25,10]]', R21, 'A', 'done', false), ('[[-1,21]]', R21, 'B', 'done', false),
    ('[[21.5,10]]', R21, 'A', 'done', false), ('[["21",10]]', R21, 'A', 'done', false),
    ('[[30,29]]', R30, 'A', 'done', true),  ('[[30,0]]',  R30, 'A', 'done', true),
    ('[[29,29]]', R30, 'A', 'done', false), ('[[30,30]]', R30, 'A', 'done', false),
    ('[[31,5]]',  R30, 'A', 'done', false),
    ('[[15,10],[15,12]]',         R315, 'A', 'done', true),
    ('[[15,10],[8,15],[15,14]]',  R315, 'A', 'done', true),
    ('[[15,10]]',                 R315, 'A', 'done', false),
    ('[[15,10],[15,12],[15,3]]',  R315, 'A', 'done', false),
    ('[[15,10],[15,12]]',         R315, 'B', 'done', false),
    ('[[15,15],[15,10]]',         R315, 'A', 'done', false),
    ('[[16,3],[15,10]]',          R315, 'A', 'done', false),
    ('[[15,10],[10,8],[15,12]]',  R315, 'A', 'done', false),
    ('[[21,19],[21,19]]',         R21,  'A', 'done', false),
    ('[]',                        R21,  'A', 'done', false),
    ('[]',        R21, 'A', 'walkover', true),  ('[[3,1]]',  R21, 'A', 'walkover', false),
    ('[[12,7]]',  R30, 'A', 'retired', true),   ('[[40,7]]', R30, 'A', 'retired', false),
    ('[[1,1],[1,1]]', R30, 'A', 'retired', false), ('[]',    R30, 'B', 'retired', true)
  ) AS c(sets, rule, winner, status, want) LOOP
    PERFORM pg_temp.ok(format('1 · %s %s %s → %s', r.sets, r.rule, r.status, r.want),
                       tournament_valid_sets(r.sets::jsonb, r.rule, r.winner, r.status) = r.want);
  END LOOP;

  /* ---------- 2. Đóng vai chủ CLB ---------- */
  SELECT cm.id, cm.user_id, cm.club_id, cm.gender::text INTO v_owner, v_user, v_club, v_gender
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  PERFORM pg_temp.ok('2 · cần một chủ CLB đã ghép tài khoản', v_owner IS NOT NULL);
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  PERFORM pg_temp.ok('2 · auth.uid() phải là chủ CLB', auth.uid() = v_user);
  PERFORM pg_temp.ok('2 · chủ CLB phải có cờ sessions', has_club_perm(v_club, 'sessions'));

  INSERT INTO tournaments (club_id, name, starts_on, fee_male, fee_female, created_by)
  VALUES (v_club, '0057 CHECK — sẽ bị huỷ', CURRENT_DATE, 200000, 150000, v_owner) RETURNING id INTO v_tour;
  INSERT INTO tournament_events (club_id, tournament_id, kind, team_size, gender_rule, status)
  VALUES (v_club, v_tour, 'md', 2, 'male', 'pairing') RETURNING id INTO v_event;
  INSERT INTO tournament_stages (club_id, tournament_id, event_id, seq, type, match_rule, rule_overrides, config)
  VALUES (v_club, v_tour, v_event, 1, 'knockout', R30, jsonb_build_object('final', R315, 'third', R315),
          '{"seeding":"seed","thirdPlace":true}') RETURNING id INTO v_stage;
  INSERT INTO tournament_teams (id, club_id, tournament_id, event_id, seed)
  SELECT t, v_club, v_tour, v_event, n FROM unnest(ARRAY[T1,T2,T3,T4,T5]) WITH ORDINALITY AS u(t, n);

  /* ---------- 3. Khoá đội hình ---------- */
  INSERT INTO tournament_registrations (club_id, tournament_id, player_id, gender, fee)
  VALUES (v_club, v_tour, v_owner, v_gender, 200000) RETURNING id INTO v_reg;
  INSERT INTO tournament_event_entries (club_id, tournament_id, event_id, registration_id)
  VALUES (v_club, v_tour, v_event, v_reg);
  -- đang ghép cặp: thêm người vào đội được
  INSERT INTO tournament_team_players (club_id, tournament_id, team_id, event_id, registration_id)
  VALUES (v_club, v_tour, T1, v_event, v_reg);
  PERFORM pg_temp.expect('3 · người chưa đăng ký nội dung không được vào đội',
    format('INSERT INTO tournament_team_players VALUES (%L,%L,%L,%L,%L)', v_club, v_tour, T2, v_event, gen_random_uuid()),
    'insert or update on table "tournament_team_players" violates foreign key constraint "fk_tournament_team_players_entry"');

  /* ---------- 4. Sinh nhánh ---------- */
  PERFORM pg_temp.expect('4 · chưa chốt đội hình thì không sinh nhánh',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]', PAYLOAD), 'tournament.err.eventNotDrawn');
  UPDATE tournament_events SET status = 'drawn' WHERE id = v_event;

  PERFORM pg_temp.expect('3 · đã chốt: không thêm/bớt người',
    format('DELETE FROM tournament_team_players WHERE team_id = %L', T1), 'tournament.err.eventLocked');
  PERFORM pg_temp.expect('3 · đã chốt: không xoá đội',
    format('DELETE FROM tournament_teams WHERE id = %L', T5), 'tournament.err.eventLocked');
  PERFORM pg_temp.expect('3 · đã chốt: bỏ tick nội dung (cascade rút người khỏi đội)',
    format('DELETE FROM tournament_event_entries WHERE registration_id = %L', v_reg), 'tournament.err.eventLocked');
  PERFORM pg_temp.expect('3 · đã chốt: xoá hẳn thí sinh đang ở đội',
    format('DELETE FROM tournament_registrations WHERE id = %L', v_reg), 'tournament.err.eventLocked');
  PERFORM pg_temp.expect('3 · đã chốt: đăng ký thêm vào nội dung',
    format('INSERT INTO tournament_event_entries VALUES (%L,%L,%L,%L)', v_club, v_tour, v_event, v_reg), 'tournament.err.eventLocked');
  UPDATE tournament_teams SET draw_no = seed WHERE event_id = v_event;   -- bốc thăm SAU khi chốt vẫn được

  PERFORM pg_temp.expect('4 · payload có trận đã có kết quả',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]',
           jsonb_set(jsonb_set(PAYLOAD, '{1,status}', '"done"'), '{1,winner}', '"A"')), 'tournament.err.invalidPayload');
  PERFORM pg_temp.expect('4 · payload có điểm sẵn',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]',
           jsonb_set(PAYLOAD, '{1,sets}', '[[30,1]]')), 'tournament.err.invalidPayload');
  PERFORM pg_temp.expect('4 · một đội đứng 2 lần (T4 gặp T4)',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]',
           jsonb_set(PAYLOAD, '{1,teamBId}', to_jsonb(T4::text))), 'tournament.err.invalidPayload');
  PERFORM pg_temp.expect('4 · con trỏ đi ngược vòng',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]',
           jsonb_set(PAYLOAD, '{4,nextMatchId}', to_jsonb(QF2::text))), 'tournament.err.invalidPayload');
  PERFORM pg_temp.expect('4 · đội được miễn chưa điền sẵn vào trận sau',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]',
           jsonb_set(PAYLOAD, '{4,teamAId}', 'null')), 'tournament.err.invalidPayload');

  PERFORM tournament_generate_stage(v_stage, '[]', PAYLOAD);
  SELECT count(*) INTO v_n FROM tournament_matches WHERE stage_id = v_stage;
  PERFORM pg_temp.ok('4 · đủ 8 trận (4 TK + 2 BK + CK + 3-4)', v_n = 8);
  PERFORM pg_temp.ok('4 · giai đoạn và nội dung chuyển running',
    (SELECT status FROM tournament_stages WHERE id = v_stage) = 'running'
    AND (SELECT status FROM tournament_events WHERE id = v_event) = 'running');
  PERFORM pg_temp.ok('4 · bye đã đẩy T1 vào BK1; BK2 (T2–T3) ready ngay',
    (SELECT team_a_id = T1 AND status = 'pending' FROM tournament_matches WHERE id = SF1)
    AND (SELECT team_a_id = T2 AND team_b_id = T3 AND status = 'ready' FROM tournament_matches WHERE id = SF2));
  PERFORM pg_temp.expect('4 · không sinh lần 2',
    format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]', PAYLOAD), 'tournament.err.stageNotPending');

  /* ---------- 5. Client không ghi thẳng được bảng trận (chỉ qua RPC) ---------- */
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    UPDATE tournament_matches SET status = 'done', winner = 'A' WHERE id = QF2;
    RAISE EXCEPTION USING MESSAGE = '__no_error__';
  EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  -- Khớp cả tên bảng: "không đổi được vai" cũng ra 42501, không được tính là đạt.
  PERFORM pg_temp.ok('5 · authenticated UPDATE tournament_matches phải bị từ chối, nhận: ' || v_err,
                     v_err LIKE '42501%tournament_matches%');
  PERFORM pg_temp.ok('5 · vai đã trả về postgres', current_user <> 'authenticated');

  /* ---------- 6. Chốt ---------- */
  PERFORM pg_temp.expect('6 · BK1 thiếu đội', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', SF1, '[[30,1]]', 'A', 'done'),
    'tournament.err.matchNotReady');
  PERFORM tournament_start_match(QF2, 'Sân 20');
  PERFORM pg_temp.ok('6 · TK2 live, ghi sân', (SELECT status = 'live' AND court_label = 'Sân 20' FROM tournament_matches WHERE id = QF2));
  PERFORM pg_temp.expect('6 · set chưa xong', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', QF2, '[[25,20]]', 'A', 'done'),
    'tournament.err.invalidSetScore');
  PERFORM pg_temp.expect('6 · người thắng lệch điểm', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', QF2, '[[28,30]]', 'A', 'done'),
    'tournament.err.invalidSetScore');
  PERFORM pg_temp.expect('6 · xử thua thiếu lý do', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', QF2, '[]', 'A', 'walkover'),
    'tournament.err.missingReason');
  PERFORM pg_temp.expect('6 · xử thua mà có điểm', format('SELECT tournament_commit_match(%L, %L, %L, %L, %L)', QF2, '[[3,1]]', 'A', 'walkover', 'vắng'),
    'tournament.err.walkoverHasSets');
  PERFORM tournament_commit_match(QF2, '[[28,30]]', 'B', 'done', NULL);
  PERFORM pg_temp.ok('6 · T5 thắng TK2 → BK1 bên B, BK1 ready',
    (SELECT team_b_id = T5 AND status = 'ready' FROM tournament_matches WHERE id = SF1));
  PERFORM pg_temp.expect('6 · chốt lần 2', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', QF2, '[[28,30]]', 'B', 'done'),
    'tournament.err.alreadyCommitted');

  /* ---------- 7. Sửa điểm ---------- */
  PERFORM tournament_edit_match(QF2, '[[27,30]]', 'biên bản ghi 27-30');
  PERFORM pg_temp.ok('7 · điểm mới được ghi', (SELECT sets = '[[27,30]]' FROM tournament_matches WHERE id = QF2));
  PERFORM pg_temp.expect('7 · sửa làm đổi người thắng', format('SELECT tournament_edit_match(%L, %L, %L)', QF2, '[[30,27]]', 'x'),
    'tournament.err.cannotChangeWinnerInEdit');
  PERFORM pg_temp.expect('7 · sửa thành điểm sai luật', format('SELECT tournament_edit_match(%L, %L, %L)', QF2, '[[31,29]]', 'x'),
    'tournament.err.invalidSetScore');
  PERFORM pg_temp.expect('7 · sửa thiếu lý do', format('SELECT tournament_edit_match(%L, %L, %L)', QF2, '[[26,30]]', ' '),
    'tournament.err.missingReason');

  /* ---------- 8. Bán kết: xử thua / bỏ cuộc → CK và 3-4 ---------- */
  PERFORM pg_temp.expect('7 · sửa điểm trận chưa đánh', format('SELECT tournament_edit_match(%L, %L, %L)', SF2, '[[30,1]]', 'x'),
    'tournament.err.cannotEditNotDone');
  PERFORM tournament_commit_match(SF1, '[]', 'A', 'walkover', 'T5 vắng mặt');
  PERFORM pg_temp.expect('7 · trận xử thua không có điểm để sửa', format('SELECT tournament_edit_match(%L, %L, %L)', SF1, '[[30,1]]', 'x'),
    'tournament.err.cannotEditNotDone');
  PERFORM tournament_commit_match(SF2, '[[12,7]]', 'A', 'retired', 'T3 chấn thương');
  PERFORM pg_temp.ok('8 · CK: T1–T2 ready; 3-4: T5–T3 ready (thua 2 BK vào 2 bên khác nhau)',
    (SELECT team_a_id = T1 AND team_b_id = T2 AND status = 'ready' FROM tournament_matches WHERE id = FINAL)
    AND (SELECT team_a_id = T5 AND team_b_id = T3 AND status = 'ready' FROM tournament_matches WHERE id = THIRD));

  /* ---------- 9. Hoàn tác ---------- */
  PERFORM pg_temp.expect('9 · hoàn tác thiếu lý do', format('SELECT tournament_undo_match(%L, %L)', SF2, ''), 'tournament.err.missingReason');
  PERFORM tournament_undo_match(SF2, 'nhầm người bỏ cuộc');
  PERFORM pg_temp.ok('9 · gỡ T2 khỏi CK và T3 khỏi 3-4; cả hai về pending',
    (SELECT team_b_id IS NULL AND status = 'pending' FROM tournament_matches WHERE id = FINAL)
    AND (SELECT team_b_id IS NULL AND status = 'pending' FROM tournament_matches WHERE id = THIRD));
  PERFORM pg_temp.ok('9 · BK2 về ready, xoá điểm, người thắng, lý do',
    (SELECT status = 'ready' AND sets = '[]' AND winner IS NULL AND result_note IS NULL FROM tournament_matches WHERE id = SF2));
  PERFORM tournament_commit_match(SF2, '[[30,29]]', 'A', 'done', NULL);

  PERFORM tournament_start_match(FINAL, 'Sân 21');
  PERFORM pg_temp.expect('9 · CK đang đánh thì không hoàn tác BK1', format('SELECT tournament_undo_match(%L, %L)', SF1, 'x'),
    'tournament.err.downstreamHasResult');
  PERFORM pg_temp.expect('9 · trận bye không hoàn tác', format('SELECT tournament_undo_match(%L, %L)',
    '00000000-0000-4000-8300-000000000001', 'x'), 'tournament.err.cannotUndoBye');

  /* ---------- 10. Chung kết, 3-4 (3 sec 15) ---------- */
  PERFORM pg_temp.expect('10 · CK dùng luật 3×15: 1 sec 30 là sai', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', FINAL, '[[30,20]]', 'A', 'done'),
    'tournament.err.invalidSetScore');
  PERFORM tournament_commit_match(FINAL, '[[15,12],[13,15],[15,14]]', 'A', 'done', NULL);
  PERFORM tournament_commit_match(THIRD, '[[3,15],[4,15]]', 'B', 'done', NULL);
  PERFORM pg_temp.ok('10 · mọi trận đều có kết quả hoặc là bye',
    NOT EXISTS (SELECT 1 FROM tournament_matches WHERE stage_id = v_stage AND status NOT IN ('done','walkover','retired','bye')));
  PERFORM pg_temp.expect('10 · trận đã xong không xếp lịch lại', format('SELECT tournament_schedule_match(%L, 1, %L)', THIRD, 'Sân 20'),
    'tournament.err.cannotScheduleFinished');

  /* ---------- 11. Reset giai đoạn đã có kết quả ---------- */
  PERFORM pg_temp.expect('11 · reset khi đã có kết quả', format('SELECT tournament_reset_stage(%L, %L)', v_stage, 'x'),
    'tournament.err.stageHasResults');

  /* ---------- 12. Nhật ký ---------- */
  PERFORM pg_temp.ok('12 · nhật ký đủ: 4 commit, 1 edit, 1 walkover, 1 retire, 1 undo — người ghi là chủ CLB',
    (SELECT count(*) FILTER (WHERE action = 'commit') = 4 AND count(*) FILTER (WHERE action = 'edit') = 1
        AND count(*) FILTER (WHERE action = 'walkover') = 1 AND count(*) FILTER (WHERE action = 'retire') = 1
        AND count(*) FILTER (WHERE action = 'undo') = 1 AND bool_and(edited_by = v_owner)
       FROM tournament_match_edits WHERE tournament_id = v_tour));

  /* ---------- 13. Thành viên thường không gọi được RPC ghi ---------- */
  SELECT cm.user_id INTO v_member_user
    FROM club_members cm JOIN role_permissions rp ON rp.role = cm.role
   WHERE cm.club_id = v_club AND cm.active AND cm.user_id IS NOT NULL AND NOT rp.can_sessions
   LIMIT 1;
  IF v_member_user IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
    -- Quyền được kiểm TRƯỚC mọi điều kiện khác, nên trận / giai đoạn đã xong vẫn phải ra permissionDenied.
    PERFORM pg_temp.expect('13 · thành viên: reset', format('SELECT tournament_reset_stage(%L, %L)', v_stage, 'x'),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: sinh nhánh', format('SELECT tournament_generate_stage(%L, %L, %L)', v_stage, '[]', PAYLOAD),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: bắt đầu trận', format('SELECT tournament_start_match(%L, NULL)', FINAL),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: chốt', format('SELECT tournament_commit_match(%L, %L, %L, %L, NULL)', FINAL, '[[15,1],[15,1]]', 'A', 'done'),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: sửa điểm', format('SELECT tournament_edit_match(%L, %L, %L)', FINAL, '[[15,1],[15,1]]', 'x'),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: hoàn tác', format('SELECT tournament_undo_match(%L, %L)', FINAL, 'x'),
      'tournament.err.permissionDenied');
    PERFORM pg_temp.expect('13 · thành viên: xếp lịch', format('SELECT tournament_schedule_match(%L, 1, NULL)', FINAL),
      'tournament.err.permissionDenied');
    -- RLS chỉ có hiệu lực dưới vai authenticated (postgres bỏ qua RLS) → đổi vai trong khối con, rồi huỷ.
    v_n := -1;
    BEGIN
      PERFORM set_config('role', 'authenticated', true);
      SELECT count(*) INTO v_err FROM tournaments WHERE id = v_tour;            -- đọc: phải thấy 1
      UPDATE tournaments SET name = 'bị sửa' WHERE id = v_tour;
      GET DIAGNOSTICS v_n = ROW_COUNT;                                          -- ghi: phải 0 dòng
      RAISE EXCEPTION USING MESSAGE = '__rollback__';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> '__rollback__' THEN RAISE; END IF;
    END;
    PERFORM pg_temp.ok('13 · thành viên ĐỌC được giải của CLB', v_err = '1');
    PERFORM pg_temp.ok('13 · thành viên KHÔNG sửa được giải (RLS), số dòng bị sửa: ' || v_n, v_n = 0);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  ELSE
    RAISE NOTICE '13 · bỏ qua: CLB này không có thành viên thường nào đã ghép tài khoản';
  END IF;

  /* ---------- 14. Xoá cả giải (cascade) KHÔNG bị khoá đội hình chặn — nếu bị chặn thì delete_club cũng hỏng ---------- */
  DELETE FROM tournaments WHERE id = v_tour;
  PERFORM pg_temp.ok('14 · xoá giải kéo theo toàn bộ dữ liệu con',
    NOT EXISTS (SELECT 1 FROM tournament_matches WHERE tournament_id = v_tour)
    AND NOT EXISTS (SELECT 1 FROM tournament_team_players WHERE tournament_id = v_tour));

  -- Cố ý lỗi để Postgres huỷ MỌI thứ script vừa tạo (giải thử, hàm pg_temp, ...).
  RAISE EXCEPTION '0057 CHECK OK — tất cả 14 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;

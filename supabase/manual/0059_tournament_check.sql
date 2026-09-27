-- 0059_tournament_check.sql — kiểm migration 0059 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0059_tournament_guests_canvas_notify.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0059 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ toàn bộ dữ liệu thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.

DO $check$
DECLARE
  v_club   uuid;
  v_member uuid;
  v_other  uuid;
  v_tour   uuid;
  v_event  uuid;
  v_stage  uuid;
  v_guest  uuid;
  v_rm     uuid;
  v_rg     uuid;
  v_ta     uuid := gen_random_uuid();
  v_tb     uuid := gen_random_uuid();
  v_match  uuid := gen_random_uuid();
  v_n      int;
  v_err    text;
BEGIN
  -- 1. Một CLB có ít nhất 1 thành viên; một CLB KHÁC để thử khách lạc CLB.
  SELECT m.club_id, m.id INTO v_club, v_member FROM club_members m JOIN clubs c ON c.id = m.club_id
   WHERE c.deleted_at IS NULL LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'Cần ít nhất một CLB có thành viên để kiểm tra.'; END IF;
  SELECT id INTO v_other FROM clubs WHERE id <> v_club LIMIT 1;

  INSERT INTO tournaments (club_id, name, starts_on) VALUES (v_club, '__TEST_0059__', current_date) RETURNING id INTO v_tour;
  INSERT INTO tournament_events (club_id, tournament_id, kind, team_size, gender_rule, status)
  VALUES (v_club, v_tour, 'open_singles', 1, 'any', 'draft') RETURNING id INTO v_event;

  -- 2. Khách ngoài CLB đăng ký được.
  INSERT INTO tournament_guests (club_id, name, gender, level) VALUES (v_club, '__Khách thử__', 'nam', 'TB')
  RETURNING id INTO v_guest;
  INSERT INTO tournament_registrations (club_id, tournament_id, player_type, player_id, gender)
  VALUES (v_club, v_tour, 'guest', v_guest, 'nam') RETURNING id INTO v_rg;
  INSERT INTO tournament_registrations (club_id, tournament_id, player_type, player_id, gender)
  VALUES (v_club, v_tour, 'member', v_member, 'nam') RETURNING id INTO v_rm;

  -- 3. Người không có thật / khách CLB khác / thành viên đem vào dạng khách → bị chặn.
  BEGIN
    INSERT INTO tournament_registrations (club_id, tournament_id, player_type, player_id, gender)
    VALUES (v_club, v_tour, 'guest', gen_random_uuid(), 'nam');
    RAISE EXCEPTION 'SAI Ở BƯỚC 3a: đăng ký khách không tồn tại mà không bị chặn';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'tournament.err.playerNotFound' THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3a: %', SQLERRM; END IF;
  END;
  BEGIN
    INSERT INTO tournament_registrations (club_id, tournament_id, player_type, player_id, gender)
    VALUES (v_club, v_tour, 'guest', v_member, 'nam');
    RAISE EXCEPTION 'SAI Ở BƯỚC 3b: id thành viên đăng ký dạng khách mà không bị chặn';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'tournament.err.playerNotFound' THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3b: %', SQLERRM; END IF;
  END;
  IF v_other IS NOT NULL THEN
    BEGIN
      UPDATE tournament_guests SET club_id = v_other WHERE id = v_guest;
      INSERT INTO tournament_registrations (club_id, tournament_id, player_type, player_id, gender)
      VALUES (v_club, v_tour, 'guest', v_guest, 'nu');
      RAISE EXCEPTION 'SAI Ở BƯỚC 3c: khách của CLB khác đăng ký được';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'tournament.err.playerNotFound' THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3c: %', SQLERRM; END IF;
    END;
  END IF;

  -- 4. Cột toạ độ canvas có mặt.
  INSERT INTO tournament_stages (club_id, tournament_id, event_id, seq, type, match_rule, canvas_x, canvas_y)
  VALUES (v_club, v_tour, v_event, 1, 'knockout', '{"sets":1,"points":21,"winBy2":true,"cap":30}', 120, 40)
  RETURNING id INTO v_stage;

  -- 5. Chuông: 2 đội (thành viên vs khách), trận pending → ready báo 1 dòng (khách không có tài khoản).
  INSERT INTO tournament_event_entries (club_id, tournament_id, event_id, registration_id) VALUES
    (v_club, v_tour, v_event, v_rm), (v_club, v_tour, v_event, v_rg);
  INSERT INTO tournament_teams (id, club_id, tournament_id, event_id) VALUES
    (v_ta, v_club, v_tour, v_event), (v_tb, v_club, v_tour, v_event);
  INSERT INTO tournament_team_players (club_id, tournament_id, team_id, event_id, registration_id) VALUES
    (v_club, v_tour, v_ta, v_event, v_rm), (v_club, v_tour, v_tb, v_event, v_rg);
  INSERT INTO tournament_matches (id, club_id, tournament_id, event_id, stage_id, round, slot, round_kind,
                                  team_a_id, team_b_id, rule, status)
  VALUES (v_match, v_club, v_tour, v_event, v_stage, 0, 0, 'final', v_ta, v_tb,
          '{"sets":1,"points":21,"winBy2":true,"cap":30}', 'pending');

  UPDATE tournament_matches SET status = 'ready' WHERE id = v_match;
  SELECT count(*) INTO v_n FROM notifications WHERE ref_id = v_tour AND type = 'tournament_match_ready';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 5: pending → ready phải báo đúng 1 thành viên, có %', v_n; END IF;

  -- 6. Xếp sân → báo tiếp; xếp lại đúng sân cũ → không báo lặp.
  UPDATE tournament_matches SET court_label = 'Sân 1' WHERE id = v_match;
  UPDATE tournament_matches SET court_label = 'Sân 1' WHERE id = v_match;
  SELECT count(*) INTO v_n FROM notifications WHERE ref_id = v_tour AND type = 'tournament_match_court';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: xếp sân phải báo đúng 1 lần, có %', v_n; END IF;

  -- 7. Đang đánh rồi kết thúc → không báo gì thêm.
  UPDATE tournament_matches SET status = 'live' WHERE id = v_match;
  SELECT count(*) INTO v_n FROM notifications WHERE ref_id = v_tour;
  IF v_n <> 2 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 7: trận đã đánh vẫn báo thêm (% dòng)', v_n; END IF;

  RAISE EXCEPTION '0059 CHECK OK — khách ngoài, toạ độ canvas, chuông sắp tới lượt đều đúng (dữ liệu thử đã huỷ)';
END $check$;

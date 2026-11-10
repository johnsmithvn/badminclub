-- 0091_games_board_check.sql — kiểm tra migration 0091 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0091_games_board.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0091 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản (như 0085_games_claim_check.sql).
-- Ván thử đặt ở tháng 01/2099 để không lẫn với ván thật của CLB.

DO $check$
DECLARE
  v_club uuid;
  v_u1   uuid;
  v_m1   uuid;
  v_m2   uuid;
  v_room uuid;
  v_n    int;
  g      record;
  -- Mỗi ván thử: game, kết quả, ghế A, ghế B, B rời lúc nào ('wait' = lúc phòng còn chờ, 'mid' = giữa ván), trạng thái, giờ kết thúc (UTC).
  -- Giờ kết thúc 17:30 UTC ngày 31/01 = 00:30 ngày 01/02 giờ Việt Nam → thuộc tháng 02.
BEGIN
  /* ---------- 1. Có hàm, quyền gọi đúng ---------- */
  IF to_regprocedure('public.game_board(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_board(uuid, text) — đã chạy 0091 chưa?';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.game_board(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_board(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: quyền gọi game_board sai (phải: authenticated có, anon không)';
  END IF;

  /* ---------- 2. Dựng ván thử của hai thành viên A (m1), B (m2) ---------- */
  SELECT a.club_id, a.user_id, a.id, b.id INTO v_club, v_u1, v_m1, v_m2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;

  FOR g IN
    SELECT * FROM (VALUES
      -- 1. Phỏm: A ghế 0 thắng +5, B ghế 1 thua -5
      (1, 'phom',  '{"winners":[0],"draw":false,"scores":{"0":5,"1":-5}}'::jsonb, 0, 1, NULL, 'finished', '2099-01-10 12:00+00'),
      -- 2. Caro hoà
      (2, 'caro',  '{"winners":[],"draw":true}'::jsonb,                           0, 1, NULL, 'finished', '2099-01-10 12:10+00'),
      -- 3. Caro: A ngồi ghế 1 và thắng
      (3, 'caro',  '{"winners":[1],"draw":false}'::jsonb,                         1, 0, NULL, 'finished', '2099-01-10 12:20+00'),
      -- 4. Caro bỏ dở → không tính
      (4, 'caro',  NULL::jsonb,                                                   0, 1, NULL, 'abandoned', '2099-01-10 12:30+00'),
      -- 5. Caro: B rời lúc phòng còn chờ → B không tính; A thắng
      (5, 'caro',  '{"winners":[0],"draw":false}'::jsonb,                         0, 1, 'wait', 'finished', '2099-01-10 12:40+00'),
      -- 6. Cờ vua: B bỏ giữa ván → B vẫn tính thua
      (6, 'covua', '{"winners":[0],"draw":false,"forfeit":true}'::jsonb,         0, 1, 'mid', 'finished', '2099-01-10 12:50+00'),
      -- 7. Caro A thắng, kết thúc 00:30 ngày 01/02 giờ VN → thuộc tháng 02, không thuộc tháng 01
      (7, 'caro',  '{"winners":[0],"draw":false}'::jsonb,                         0, 1, NULL, 'finished', '2099-01-31 17:30+00'),
      -- 8. Caro kết quả sai kiểu (client tự gửi bậy) → không làm hỏng bảng, cả hai tính thua, không có điểm
      (8, 'caro',  '{"winners":"x","draw":"yes","scores":{"0":"abc","1":[1]}}'::jsonb, 0, 1, NULL, 'finished', '2099-01-10 13:00+00')
    ) AS t(k, game, result, seat_a, seat_b, b_left, status, ended)
  LOOP
    INSERT INTO game_rooms (club_id, game, code, host_id, status, result, created_at, started_at, ended_at)
    VALUES (v_club, g.game, 'Z91' || lpad(g.k::text, 3, '0'), v_m1, g.status, g.result,
            g.ended::timestamptz - interval '30 minutes', g.ended::timestamptz - interval '20 minutes', g.ended::timestamptz)
    RETURNING id INTO v_room;
    INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_room, v_m1, v_club, g.seat_a);
    INSERT INTO game_room_players (room_id, member_id, club_id, seat, left_at) VALUES (v_room, v_m2, v_club, g.seat_b,
      CASE g.b_left WHEN 'wait' THEN g.ended::timestamptz - interval '25 minutes'
                    WHEN 'mid'  THEN g.ended::timestamptz - interval '5 minutes' END);
  END LOOP;

  /* ---------- 3. Tháng 01/2099: đếm đúng từng dòng ---------- */
  SELECT count(*) INTO v_n FROM game_board(v_club, '2099-01');
  IF v_n <> 6 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: tháng 01/2099 phải có 6 dòng (Phỏm, Caro, Cờ vua × A, B) — nhận %', v_n; END IF;

  FOR g IN
    SELECT * FROM (VALUES
      ('phom',  v_m1, 1, 1, 0, 0,  5::numeric),
      ('phom',  v_m2, 1, 0, 0, 1, -5::numeric),
      ('caro',  v_m1, 4, 2, 1, 1,  0::numeric),
      ('caro',  v_m2, 3, 0, 1, 2,  0::numeric),
      ('covua', v_m1, 1, 1, 0, 0,  0::numeric)
    ) AS t(game, member, played, won, drawn, lost, points)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM game_board(v_club, '2099-01') b
                    WHERE b.game = g.game AND b.member_id = g.member AND b.played = g.played AND b.won = g.won
                      AND b.drawn = g.drawn AND b.lost = g.lost AND b.points = g.points) THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 3: % của % phải là % ván, % thắng, % hoà, % thua, % điểm — nhận %',
        g.game, CASE WHEN g.member = v_m1 THEN 'A' ELSE 'B' END, g.played, g.won, g.drawn, g.lost, g.points,
        (SELECT row_to_json(b) FROM game_board(v_club, '2099-01') b WHERE b.game = g.game AND b.member_id = g.member);
    END IF;
  END LOOP;
  -- Cờ vua của B: bỏ giữa ván vẫn phải có dòng, tính thua.
  IF NOT EXISTS (SELECT 1 FROM game_board(v_club, '2099-01') b
                  WHERE b.game = 'covua' AND b.member_id = v_m2 AND b.played = 1 AND b.lost = 1) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: B bỏ giữa ván cờ vua phải tính 1 ván thua';
  END IF;

  /* ---------- 4. Tháng 02/2099: chỉ ván kết thúc 00:30 ngày 01/02 giờ VN ---------- */
  IF (SELECT count(*) FROM game_board(v_club, '2099-02')) <> 2
     OR NOT EXISTS (SELECT 1 FROM game_board(v_club, '2099-02') b
                     WHERE b.game = 'caro' AND b.member_id = v_m1 AND b.played = 1 AND b.won = 1) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: tháng tính theo giờ Việt Nam — ván kết thúc 00:30 ngày 01/02 phải thuộc tháng 02';
  END IF;

  /* ---------- 5. Từ trước tới nay (NULL) gồm cả ván tháng 02 ---------- */
  IF NOT EXISTS (SELECT 1 FROM game_board(v_club, NULL) b WHERE b.game = 'caro' AND b.member_id = v_m1 AND b.played >= 5) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: p_month NULL phải tính mọi tháng';
  END IF;

  /* ---------- 6. RLS: thành viên CLB thấy, người ngoài không thấy gì ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_n FROM game_board(v_club, '2099-01');
  IF v_n <> 6 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: thành viên CLB gọi phải thấy 6 dòng — nhận %', v_n; END IF;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM game_board(v_club, '2099-01');
  IF v_n <> 0 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: người ngoài CLB gọi vẫn thấy % dòng', v_n; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION '0091 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;

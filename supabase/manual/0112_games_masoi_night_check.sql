-- 0112_games_masoi_night_check.sql — kiểm tra migration 0112 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0112_games_masoi_night.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0112 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có ít nhất 5 thành viên (KHÔNG cần đã ghép tài khoản — phòng thử dựng thẳng bằng quyền SQL Editor).
-- Bộ vai 1 Sói + 4 Dân làng (options.roles = [1]) cho khỏi phụ thuộc vai đặc biệt. Trong một giao dịch now() đứng yên, nên "đã qua 45 giây" giả lập bằng cách lùi created_at các nước của phòng thử.

DO $check$
DECLARE
  v_club  uuid;
  v_mem   uuid[];
  v_room  uuid;
  v_roles int[];
  v_seq   int;
  v_mv    jsonb;
  v_err   text;
  k       int;
BEGIN
  /* ---------- 1. Có hàm, client không gọi thẳng được ---------- */
  IF to_regprocedure('public.game_masoi_run(uuid, int, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_masoi_run — đã chạy 0084 / 0112 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_masoi_run(uuid, int, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client gọi thẳng được game_masoi_run';
  END IF;

  SELECT club_id, (array_agg(id ORDER BY id))[1:5] INTO v_club, v_mem
    FROM club_members WHERE active GROUP BY club_id HAVING count(*) >= 5 LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 1: cần một CLB có ít nhất 5 thành viên'; END IF;

  /* ---------- 2. Phòng TẮT giờ: cả làng bấm xong ngay → chưa đủ 45 giây thì chưa sang bước ---------- */
  INSERT INTO game_rooms (club_id, game, code, host_id, status, private, options, seed, started_at)
  VALUES (v_club, 'masoi', upper(substr(md5(random()::text), 1, 6)), v_mem[1], 'playing', true,
          '{"reveal":"all","time":0,"roles":[1]}', 'check-0112a', now())
  RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat)
  SELECT v_room, v_mem[i + 1], v_club, i FROM generate_series(0, 4) i;
  PERFORM game_masoi_deal(v_room);
  SELECT cards INTO v_roles FROM game_hands WHERE room_id = v_room AND seat = -1;
  v_seq := 1;
  FOR k IN 0 .. 4 LOOP
    v_mv := game_masoi_fill(v_room, k,
      CASE WHEN v_roles[k + 1] = 1 THEN jsonb_build_object('night', jsonb_build_object('target', (k + 1) % 5))
           ELSE '{"night": {}}'::jsonb END);
    v_seq := v_seq + 1;
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, k, v_mv);
  END LOOP;
  SELECT o_err INTO v_err FROM game_masoi_run(v_room, 0, '{"next": true}');
  IF v_err IS DISTINCT FROM 'games.err.notYet' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cả làng vừa bấm xong (chưa đủ 45 giây) mà sang bước được — nhận %', v_err;
  END IF;

  /* ---------- 3. Cùng phòng, lùi giờ mở bước 46 giây → sang bước được ---------- */
  UPDATE game_moves SET created_at = created_at - interval '46 seconds' WHERE room_id = v_room;
  SELECT o_err INTO v_err FROM game_masoi_run(v_room, 0, '{"next": true}');
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: đủ 45 giây + cả làng đã bấm mà vẫn không sang bước — nhận %', v_err;
  END IF;

  /* ---------- 4. Phòng TẮT giờ: đủ 45 giây nhưng còn người chưa bấm → vẫn chờ (không có hạn giờ) ---------- */
  DELETE FROM game_moves WHERE room_id = v_room AND seq = v_seq; -- bỏ nước của ghế 4
  SELECT o_err INTO v_err FROM game_masoi_run(v_room, 0, '{"next": true}');
  IF v_err IS DISTINCT FROM 'games.err.notYet' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: phòng tắt giờ còn người chưa bấm mà sang bước được — nhận %', v_err;
  END IF;

  /* ---------- 5. Phòng CÓ giờ: chưa ai bấm, mở bước 10 giây trước → chưa được; 46 giây trước → được (hết giờ) ---------- */
  INSERT INTO game_rooms (club_id, game, code, host_id, status, private, options, seed, started_at)
  VALUES (v_club, 'masoi', upper(substr(md5(random()::text), 1, 6)), v_mem[1], 'playing', true,
          '{"reveal":"all","time":120,"roles":[1]}', 'check-0112b', now())
  RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat)
  SELECT v_room, v_mem[i + 1], v_club, i FROM generate_series(0, 4) i;
  PERFORM game_masoi_deal(v_room);
  UPDATE game_moves SET created_at = created_at - interval '10 seconds' WHERE room_id = v_room;
  SELECT o_err INTO v_err FROM game_masoi_run(v_room, 0, '{"next": true}');
  IF v_err IS DISTINCT FROM 'games.err.notYet' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: đêm mới mở 10 giây mà sang bước được — nhận %', v_err;
  END IF;
  UPDATE game_moves SET created_at = created_at - interval '36 seconds' WHERE room_id = v_room;
  SELECT o_err INTO v_err FROM game_masoi_run(v_room, 0, '{"next": true}');
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: phòng có giờ, đêm đã 46 giây mà không sang bước được — nhận %', v_err;
  END IF;

  RAISE EXCEPTION '0112 CHECK OK — đêm luôn đủ 45 giây mới sang bước (cả phòng tắt giờ lẫn có giờ)';
END;
$check$;

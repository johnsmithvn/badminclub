-- 0086_games_masoi_wolfbite_check.sql — kiểm tra migration 0086 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0086_games_masoi_wolfbite.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0086 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có ít nhất 5 thành viên (KHÔNG cần đã ghép tài khoản). Phòng thử dựng thẳng bằng quyền SQL Editor, vai
-- xếp sẵn thay vì xáo; mỗi nước gọi thẳng game_masoi_fill rồi ghi đúng nước server trả vào log — như game_move làm.
-- Ván thử 5 người: ghế 0 Sói nguyền · 1 Sói · 2 Tiên tri · 3 Bảo vệ · 4 Dân làng (không có Phù thủy → không có bước 2).

DO $check$
DECLARE
  v_club  uuid;
  v_mem   uuid[];
  v_room  uuid;
  v_seq   int := 1;
  v_mv    jsonb;
  v_err   text;
  st      record;
BEGIN
  /* ---------- 1. Dựng phòng thử: vai xếp sẵn, hàng bài y như game_masoi_deal ---------- */
  SELECT club_id, (array_agg(id ORDER BY id))[1:5] INTO v_club, v_mem
    FROM club_members WHERE active GROUP BY club_id HAVING count(*) >= 5 LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 1: cần một CLB có ít nhất 5 thành viên'; END IF;

  INSERT INTO game_rooms (club_id, game, code, host_id, status, private, options, seed, started_at)
  VALUES (v_club, 'masoi', upper(substr(md5(random()::text), 1, 6)), v_mem[1], 'playing', true, '{"reveal":"all"}', 'check-0086', now())
  RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat)
  SELECT v_room, v_mem[i + 1], v_club, i FROM generate_series(0, 4) i;
  -- Sói biết đồng đội (dữ kiện 1), Sói nguyền còn lời nguyền (8), Bảo vệ chưa che ai (7). Ghế âm như game_masoi_deal.
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES
    (v_room, 0, v_mem[1], v_club, ARRAY[2, 1, 0, 0, 1, 1, 0, 8, 1, 0]),
    (v_room, 1, v_mem[2], v_club, ARRAY[1, 1, 0, 0, 1, 1, 0]),
    (v_room, 2, v_mem[3], v_club, ARRAY[3]),
    (v_room, 3, v_mem[4], v_club, ARRAY[4, 7, -1, 0]),
    (v_room, 4, v_mem[5], v_club, ARRAY[0]),
    (v_room, -1, v_mem[5], v_club, ARRAY[2, 1, 3, 4, 0]),
    (v_room, -2, v_mem[5], v_club, array_fill(-1, ARRAY[10])),
    (v_room, -3, v_mem[5], v_club, ARRAY[-1, 1, 1, 1, 1, -1, -1, -1]);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, 1, v_club, 0, '{"deal":{"n":5}}');

  /* ---------- 2. Đêm 1: Sói cắn đồng đội, Sói tự chọn mình, Sói nguyền nguyền lên Sói — đều phải được nhận ---------- */
  BEGIN
    FOR st IN SELECT * FROM jsonb_to_recordset('[
        {"s": 0, "m": {"night": {"target": 1, "curse": true}}},
        {"s": 1, "m": {"night": {"target": 1}}},
        {"s": 2, "m": {"night": {"target": 0}}},
        {"s": 3, "m": {"night": {"target": 4}}},
        {"s": 4, "m": {"night": {}}}
      ]'::jsonb) AS x(s int, m jsonb) LOOP
      v_mv := game_masoi_fill(v_room, st.s, st.m);
      v_seq := v_seq + 1;
      INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, st.s, v_mv);
    END LOOP;
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: Sói chưa cắn được Sói (%) — đã chạy 0086 chưa?', v_err;
  END;

  /* ---------- 3. Sáng 1: Sói ghế 1 chết; lời nguyền không có tác dụng và vẫn còn ---------- */
  v_mv := game_masoi_fill(v_room, 4, '{"next": true}');
  v_seq := v_seq + 1;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, 4, v_mv);
  IF v_mv ->> 'next' IS DISTINCT FROM 'day' OR v_mv -> 'dead' IS DISTINCT FROM '[1]'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: Sói bị cả bầy cắn phải chết, ván sang ngày — nhận %', v_mv;
  END IF;
  IF (SELECT cards FROM game_hands WHERE room_id = v_room AND seat = -1) IS DISTINCT FROM ARRAY[2, 1, 3, 4, 0] THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: nguyền lên Sói không được đổi vai ai — nhận %',
      (SELECT cards FROM game_hands WHERE room_id = v_room AND seat = -1);
  END IF;
  IF (SELECT cards[5] FROM game_hands WHERE room_id = v_room AND seat = -3) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: nguyền lên Sói không có tác dụng thì phải còn lượt nguyền';
  END IF;

  /* ---------- 4. Ngày 1: cả làng bỏ qua → không ai bị treo ---------- */
  FOR st IN SELECT * FROM jsonb_to_recordset('[
      {"s": 0, "m": {"vote": -1}}, {"s": 2, "m": {"vote": -1}}, {"s": 3, "m": {"vote": -1}}, {"s": 4, "m": {"vote": -1}},
      {"s": 4, "m": {"next": true}}
    ]'::jsonb) AS x(s int, m jsonb) LOOP
    v_mv := game_masoi_fill(v_room, st.s, st.m);
    v_seq := v_seq + 1;
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, st.s, v_mv);
  END LOOP;
  IF v_mv ->> 'next' IS DISTINCT FROM 'night' THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: hết ngày phải sang đêm 2 — nhận %', v_mv; END IF;

  /* ---------- 5. Đêm 2: vẫn không cắn được người đã chết ---------- */
  BEGIN
    PERFORM game_masoi_fill(v_room, 0, '{"night": {"target": 1}}');
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: Sói cắn được người đã chết';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badTarget' THEN RAISE; END IF;
  END;

  /* ---------- 6. Đêm 2: nguyền lên Dân làng vẫn hoá Sói như cũ → 2 Sói đấu 2 người, bầy Sói thắng ---------- */
  FOR st IN SELECT * FROM jsonb_to_recordset('[
      {"s": 0, "m": {"night": {"target": 4, "curse": true}}},
      {"s": 2, "m": {"night": {"target": 0}}},
      {"s": 3, "m": {"night": {"target": 3}}},
      {"s": 4, "m": {"night": {}}},
      {"s": 4, "m": {"next": true}}
    ]'::jsonb) AS x(s int, m jsonb) LOOP
    v_mv := game_masoi_fill(v_room, st.s, st.m);
    v_seq := v_seq + 1;
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, st.s, v_mv);
  END LOOP;
  IF v_mv ->> 'next' IS DISTINCT FROM 'over' OR v_mv -> 'over' ->> 'team' IS DISTINCT FROM 'wolves'
     OR v_mv -> 'over' -> 'winners' IS DISTINCT FROM '[0, 1, 4]'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: Dân làng bị nguyền phải hoá Sói, bầy Sói (ghế 0, 1, 4) thắng — nhận %', v_mv;
  END IF;
  IF (SELECT cards[5] FROM game_hands WHERE room_id = v_room AND seat = -3) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: nguyền thành công phải hết lượt nguyền';
  END IF;

  RAISE EXCEPTION '0086 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;

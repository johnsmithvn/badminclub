-- 0087_games_masoi_roles_check.sql — kiểm tra migration 0087 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0087_games_masoi_roles.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0087 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có ít nhất 5 thành viên (KHÔNG cần đã ghép tài khoản — phòng thử dựng thẳng bằng quyền SQL Editor).

DO $check$
DECLARE
  v_club  uuid;
  v_mem   uuid[];
  v_room  uuid;
  v_roles int[];
  v_seq   int := 1;
  v_mv    jsonb;
  v_err   text;
  k       int;
  st      record;
BEGIN
  /* ---------- 1. game_masoi_deck: tự động / tự chọn / sai dạng về tự động ---------- */
  IF game_masoi_deck('{}', 5) IS DISTINCT FROM game_masoi_table(5)
     OR game_masoi_deck('{"reveal":"all"}', 9) IS DISTINCT FROM game_masoi_table(9) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: phòng không tự chọn vai phải chia y như bảng tự động';
  END IF;
  IF ARRAY(SELECT x FROM unnest(game_masoi_deck('{"roles":[3,1,1,5]}', 6)) x ORDER BY x) IS DISTINCT FROM ARRAY[0, 0, 1, 1, 3, 5] THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: tự chọn 2 Sói + Tiên tri + Phù thủy cho 6 người phải bù 2 Dân làng — nhận %',
      game_masoi_deck('{"roles":[3,1,1,5]}', 6);
  END IF;
  IF game_masoi_deck('{"roles":[3,3,1]}', 6) IS DISTINCT FROM game_masoi_table(6)
     OR game_masoi_deck('{"roles":["x",1]}', 6) IS DISTINCT FROM game_masoi_table(6)
     OR game_masoi_deck('{"roles":[1,1.5]}', 6) IS DISTINCT FROM game_masoi_table(6)
     OR game_masoi_deck('{"roles":[0,1]}', 6) IS DISTINCT FROM game_masoi_table(6) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: bộ vai sai dạng phải về bảng tự động (như rolesOf ở JS)';
  END IF;

  /* ---------- 2. Luật số người: thiếu Sói / quá nhiều vai / Sói không ít hơn phần còn lại → từ chối ---------- */
  FOR st IN SELECT * FROM (VALUES ('{"roles":[3,4]}'::jsonb, 6, 'games.err.noWolf'),
                                  ('{"roles":[1,3,4,5]}'::jsonb, 3, 'games.err.tooManyRoles'),
                                  ('{"roles":[1,1,2]}'::jsonb, 6, 'games.err.tooManyWolves')) AS x(o, n, e) LOOP
    BEGIN
      PERFORM game_masoi_deck(st.o, st.n);
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: % với % người phải bị từ chối (%)', st.o, st.n, st.e;
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err <> st.e THEN RAISE; END IF;
    END;
  END LOOP;

  /* ---------- 3. Chia theo bộ tự chọn: 5 người, 1 Sói + Phù thủy (bảng tự động 5 người không có Phù thủy) ---------- */
  SELECT club_id, (array_agg(id ORDER BY id))[1:5] INTO v_club, v_mem
    FROM club_members WHERE active GROUP BY club_id HAVING count(*) >= 5 LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một CLB có ít nhất 5 thành viên'; END IF;
  INSERT INTO game_rooms (club_id, game, code, host_id, status, private, options, seed, started_at)
  VALUES (v_club, 'masoi', upper(substr(md5(random()::text), 1, 6)), v_mem[1], 'playing', true,
          '{"reveal":"all","roles":[1,5]}', 'check-0087', now())
  RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat)
  SELECT v_room, v_mem[i + 1], v_club, i FROM generate_series(0, 4) i;
  PERFORM game_masoi_deal(v_room);
  SELECT cards INTO v_roles FROM game_hands WHERE room_id = v_room AND seat = -1;
  IF ARRAY(SELECT x FROM unnest(v_roles) x ORDER BY x) IS DISTINCT FROM ARRAY[0, 0, 0, 1, 5] THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: phải chia đúng bộ đã chọn (1 Sói, Phù thủy, 3 Dân) — nhận %', v_roles;
  END IF;

  /* ---------- 4. Hết bước đêm phải sang bước Phù thủy (theo bộ vai thật, không theo bảng 5 người) ---------- */
  FOR k IN 0 .. 4 LOOP
    v_mv := game_masoi_fill(v_room, k,
      CASE WHEN v_roles[k + 1] = 1 THEN jsonb_build_object('night', jsonb_build_object('target', (k + 1) % 5))
           ELSE '{"night": {}}'::jsonb END);
    v_seq := v_seq + 1;
    INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, k, v_mv);
  END LOOP;
  v_mv := game_masoi_fill(v_room, 0, '{"next": true}');
  IF v_mv ->> 'next' IS DISTINCT FROM 'witch' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: bộ có Phù thủy thì hết đêm phải sang bước Phù thủy — nhận %', v_mv;
  END IF;

  RAISE EXCEPTION '0087 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;

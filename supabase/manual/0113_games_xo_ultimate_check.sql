-- 0113_games_xo_ultimate_check.sql — kiểm tra migration 0113 (X-O lồng) TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0113 rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run. Sau đó chạy lại cả
-- 0107_games_xo_check.sql (ván cũ classic / move / vanish phải ra đúng kết quả cũ với game_xo_run mới).
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý (giống 0107_games_xo_check.sql):
--   ✅ "0113 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản.
--
-- Ván mẫu (hằng v_xu) do luật JS lib/games/xo.js (mode 'ultimate') sinh ra: X thắng, O thắng, hoà, ván chưa xong, kèm
-- nước rác (sai lượt, ngoài 0..80, ô có quân, sai bàn con bắt buộc / bàn con đã xong, i dạng chuỗi / số lẻ, nước di
-- quân, số viết dạng 5.0). xo.test.js đọc lại ĐÚNG khối này và chấm bằng JS → JS và SQL phải ra cùng kết quả. Đổi luật
-- thì sinh lại cả khối (node src/__tests__/games/fixtures.mjs), ĐỪNG sửa tay từng ván.

DO $check$
DECLARE
  v_club  uuid;
  v_u1    uuid;
  v_u2    uuid;
  v_room  uuid;
  v_fx    jsonb;
  v_got   jsonb;
  v_want  jsonb;
  v_n     int := 0;
  v_xu CONSTANT jsonb := $xu$
[
{"note":"X-O lồng · X thắng","options":{"mode":"ultimate"},"result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"i":56.0}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":18}},{"seat":0,"move":{"i":"0"}},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":13}},{"seat":0,"move":{}},{"seat":0,"move":{"i":42}},{"seat":1,"move":null},{"seat":1,"move":{"i":54}},{"seat":0,"move":{"from":0,"to":0}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":2,"from":null}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":57}},{"seat":1,"move":{"i":2}},{"seat":1,"move":{"i":33}},{"seat":0,"move":{"i":2}},{"seat":0,"move":{"i":61}},{"seat":0,"move":{"i":63}},{"seat":1,"move":{"i":69}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":58}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":36}},{"seat":0,"move":{"i":"2"}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":19}},{"seat":0,"move":{}},{"seat":0,"move":{"i":9}},{"seat":1,"move":null},{"seat":1,"move":{"i":45}},{"seat":0,"move":{"from":0,"to":10}},{"seat":0,"move":{"i":17}},{"seat":1,"move":{"i":72,"from":null}},{"seat":1,"move":{"i":75}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":27}},{"seat":1,"move":{"i":3}},{"seat":1,"move":{"i":24}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":55}},{"seat":0,"move":{"i":10}},{"seat":1,"move":{"i":12}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":29}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":22}},{"seat":0,"move":{"i":"37"}},{"seat":0,"move":{"i":44}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":72}},{"seat":0,"move":{}},{"seat":0,"move":{"i":28}},{"seat":1,"move":{"i":10}}]},
{"note":"X-O lồng · O thắng","options":{"mode":"ultimate"},"result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"i":5}},{"seat":1,"move":null},{"seat":1,"move":{"i":51}},{"seat":0,"move":{"from":0,"to":54}},{"seat":0,"move":{"i":56}},{"seat":1,"move":{"i":18,"from":null}},{"seat":1,"move":{"i":18}},{"seat":0,"move":{"i":5}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":1}},{"seat":0,"move":{"i":37}},{"seat":0,"move":{"i":9}},{"seat":1,"move":{"i":9}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":30}},{"seat":0,"move":{"i":"27"}},{"seat":0,"move":{"i":27}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{}},{"seat":0,"move":{"i":10}},{"seat":1,"move":null},{"seat":1,"move":{"i":17}},{"seat":0,"move":{"from":0,"to":72}},{"seat":0,"move":{"i":74}},{"seat":1,"move":{"i":19,"from":null}},{"seat":1,"move":{"i":19}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":11}},{"seat":1,"move":{"i":2}},{"seat":1,"move":{"i":20}},{"seat":0,"move":{"i":21}},{"seat":0,"move":{"i":63}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":54}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{"i":"64"}},{"seat":0,"move":{"i":64}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":13}},{"seat":0,"move":{"i":36}}]},
{"note":"X-O lồng · hoà","options":{"mode":"ultimate"},"result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"i":38}},{"seat":0,"move":{"i":18}},{"seat":1,"move":{"i":22}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":36}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{"i":"63"}},{"seat":0,"move":{"i":68}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":49}},{"seat":0,"move":{}},{"seat":0,"move":{"i":43}},{"seat":1,"move":null},{"seat":1,"move":{"i":63}},{"seat":0,"move":{"from":0,"to":0}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":1,"from":null}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":45}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":1}},{"seat":0,"move":{"i":55}},{"seat":0,"move":{"i":9}},{"seat":1,"move":{"i":17}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":80}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":72}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":9}},{"seat":0,"move":{}},{"seat":0,"move":{"i":2}},{"seat":1,"move":null},{"seat":1,"move":{"i":18}},{"seat":0,"move":{"from":0,"to":10}},{"seat":0,"move":{"i":52}},{"seat":1,"move":{"i":64,"from":null}},{"seat":1,"move":{"i":67}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":37}},{"seat":1,"move":{"i":3}},{"seat":1,"move":{"i":13}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":34}},{"seat":0,"move":{"i":64}},{"seat":1,"move":{"i":70}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":71}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":78}},{"seat":0,"move":{"i":"54"}},{"seat":0,"move":{"i":54}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":24}},{"seat":0,"move":{}},{"seat":0,"move":{"i":56}},{"seat":1,"move":null},{"seat":1,"move":{"i":21}},{"seat":0,"move":{"from":0,"to":27}},{"seat":0,"move":{"i":27}},{"seat":1,"move":{"i":28,"from":null}},{"seat":1,"move":{"i":48}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":29}},{"seat":1,"move":{"i":3}},{"seat":1,"move":{"i":65}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":66}},{"seat":0,"move":{"i":28}},{"seat":1,"move":{"i":33}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":64}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":75}},{"seat":0,"move":{"i":"28"}},{"seat":0,"move":{"i":31}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":53}},{"seat":0,"move":{}},{"seat":0,"move":{"i":51}},{"seat":1,"move":null},{"seat":1,"move":{"i":28}},{"seat":0,"move":{"from":0,"to":30}},{"seat":0,"move":{"i":30}},{"seat":1,"move":{"i":32,"from":null}},{"seat":1,"move":{"i":32}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":50}},{"seat":1,"move":{"i":3}},{"seat":1,"move":{"i":46}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":69}},{"seat":0,"move":{"i":35}},{"seat":1,"move":{"i":35}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":47}},{"seat":1,"move":{"cell":1,"dir":1}}]},
{"note":"X-O lồng · chưa xong ván","options":{"mode":"ultimate"},"result":null,"moves":[{"seat":0,"move":{"i":31}},{"seat":1,"move":{"i":36,"from":null}},{"seat":1,"move":{"i":38}},{"seat":0,"move":{"i":31}},{"seat":0,"move":{"i":25}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"i":70}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":63}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":36}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"i":6}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":55}},{"seat":0,"move":{}},{"seat":0,"move":{"i":13}},{"seat":1,"move":null},{"seat":1,"move":{"i":40}},{"seat":0,"move":{"from":0,"to":37}},{"seat":0,"move":{"i":41}},{"seat":1,"move":{"i":45,"from":null}},{"seat":1,"move":{"i":52}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":69}},{"seat":1,"move":{"i":1}},{"seat":1,"move":{"i":54}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":27}},{"seat":1,"move":{"i":27}},{"seat":0,"move":{"i":81}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":74}},{"seat":0,"move":{"i":"18"}}]}
]
$xu$;
BEGIN
  /* ---------- 1. Có hàm đọc ô X-O lồng, client không gọi thẳng được ---------- */
  IF to_regprocedure('public.game_xo_ucell(jsonb)') IS NULL OR to_regprocedure('public.game_xo_run(uuid)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_xo_ucell / game_xo_run — đã chạy 0109 và 0113 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_xo_ucell(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_xo_ucell(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_xo_run(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client gọi thẳng được hàm của X-O';
  END IF;

  /* ---------- 2. Tìm hai thành viên cùng CLB ---------- */
  SELECT a.club_id, a.user_id, b.user_id INTO v_club, v_u1, v_u2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);

  /* ---------- 3. Từng ván mẫu X-O lồng: SQL chấm ra đúng như JS ---------- */
  FOR v_fx IN SELECT value FROM jsonb_array_elements(v_xu) LOOP
    v_n := v_n + 1;
    v_room := game_create(v_club, 'xo', COALESCE((v_fx ->> 'options')::jsonb, '{}'::jsonb), false);
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
      FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
    v_got := game_xo_result(v_room);
    v_want := NULLIF(v_fx -> 'result', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 3: ván mẫu % (%) — SQL chấm %, JS chấm %', v_n, v_fx ->> 'note', v_got, v_want;
    END IF;
  END LOOP;
  IF v_n = 0 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: khối ván mẫu rỗng — chạy node src/__tests__/games/fixtures.mjs'; END IF;

  RAISE EXCEPTION '0113 CHECK OK — % ván mẫu X-O lồng SQL chấm khớp JS. Nhớ chạy lại 0107_games_xo_check.sql', v_n;
END;
$check$;

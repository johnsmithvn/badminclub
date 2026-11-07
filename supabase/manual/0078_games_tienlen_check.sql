-- 0078_games_tienlen_check.sql — kiểm tra migration 0078 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0074, 0075 rồi 0078, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý (giống 0077_games_chamo_check.sql):
--   ✅ "0078 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản.
--
-- Hai khối dùng chung với JS — tienlen.test.js đọc lại ĐÚNG hai khối này và chấm bằng lib/games/tienlen.js:
--   khối tc (hằng v_tc) — bộ lá → kiểu bộ, cặp bộ → chặn được không, giá chặt, giá thối, tới trắng.
--   khối tl (hằng v_tl) — ván mẫu viết tay: bài chia từng ghế (`first` = ván chơi lại, người đó đi trước, không bắt lá
--          nào), từng nước kèm mã lỗi server phải trả (null = hợp lệ, được ghi), kết quả cuối (đã cộng thối).
--          Nước `"log": true` là nước server tự ghi ({ out } khi có người rời) — chèn thẳng, không kiểm.
--          Có lá viết dạng 12.0 (jsonb giữ nguyên, JS đọc ra 12) để hai bên đọc số như nhau.
-- Lá c = hạng * 4 + chất (hạng 0 = 3 … 12 = 2; chất bích nhép rô cơ). Đổi luật thì sửa cả hai khối cho khớp.

DO $check$
DECLARE
  v_club  uuid;
  v_u1    uuid;
  v_u2    uuid;
  v_m1    uuid;
  v_room  uuid;
  v_fx    jsonb;
  v_st    jsonb;
  v_got   jsonb;
  v_want  jsonb;
  v_e     text;
  v_seq   int;
  v_n     int := 0;
  v_k     int;
  v_err   text;
  v_rows  int;
  v_first int;
  v_low   int;
  v_white int;
  v_tc CONSTANT jsonb := $tc$
{
  "combo": [
    { "cards": [0], "combo": { "kind": "single", "len": 1, "top": 0 } },
    { "cards": [1, 0], "combo": { "kind": "pair", "len": 2, "top": 1 } },
    { "cards": [0, 1, 2], "combo": { "kind": "triple", "len": 3, "top": 2 } },
    { "cards": [3, 2, 1, 0], "combo": { "kind": "quad", "len": 4, "top": 3 } },
    { "cards": [48, 49], "combo": { "kind": "pair", "len": 2, "top": 49 } },
    { "cards": [8, 0, 4], "combo": { "kind": "straight", "len": 3, "top": 8 } },
    { "cards": [0, 5, 8, 13, 16, 21], "combo": { "kind": "straight", "len": 6, "top": 21 } },
    { "cards": [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44], "combo": { "kind": "straight", "len": 12, "top": 44 } },
    { "cards": [36, 40, 44, 48], "combo": null },
    { "cards": [0, 1, 4, 5, 8, 9], "combo": { "kind": "pairs", "len": 3, "top": 9 } },
    { "cards": [0, 1, 4, 5, 8, 9, 12, 13], "combo": { "kind": "pairs", "len": 4, "top": 13 } },
    { "cards": [40, 41, 44, 45, 48, 49], "combo": null },
    { "cards": [0, 1, 4, 5], "combo": null },
    { "cards": [0, 1, 8, 9, 12, 13], "combo": null },
    { "cards": [0, 0], "combo": null },
    { "cards": [0, 1, 4], "combo": null },
    { "cards": [0, 1, 2, 3, 4], "combo": null },
    { "cards": [0, 48], "combo": null }
  ],
  "beats": [
    { "a": [48], "t": null, "beats": true },
    { "a": [5], "t": [4], "beats": true },
    { "a": [4], "t": [5], "beats": false },
    { "a": [48], "t": [47], "beats": true },
    { "a": [1, 5, 9], "t": [0, 4, 8], "beats": true },
    { "a": [0, 4, 8], "t": [1, 5, 9], "beats": false },
    { "a": [0, 4, 8, 12], "t": [1, 5, 9], "beats": false },
    { "a": [2, 3], "t": [0, 1], "beats": true },
    { "a": [0, 1, 4, 5, 8, 9], "t": [48], "beats": true },
    { "a": [0, 1, 4, 5, 8, 9], "t": [48, 49], "beats": false },
    { "a": [0, 1, 4, 5, 8, 9], "t": [44], "beats": false },
    { "a": [20, 21, 22, 23], "t": [48], "beats": true },
    { "a": [20, 21, 22, 23], "t": [48, 49], "beats": true },
    { "a": [20, 21, 22, 23], "t": [0, 1, 4, 5, 8, 9], "beats": true },
    { "a": [0, 1, 4, 5, 8, 9], "t": [20, 21, 22, 23], "beats": false },
    { "a": [20, 21, 22, 23], "t": [44], "beats": false },
    { "a": [0, 1, 4, 5, 8, 9, 12, 13], "t": [20, 21, 22, 23], "beats": true },
    { "a": [20, 21, 22, 23], "t": [0, 1, 4, 5, 8, 9, 12, 13], "beats": false },
    { "a": [0, 1, 4, 5, 8, 9, 12, 13], "t": [48, 49], "beats": true },
    { "a": [0, 1, 4, 5, 8, 9, 12, 13, 16, 17], "t": [20, 21, 24, 25, 28, 29, 32, 33], "beats": true },
    { "a": [20, 21, 22, 23], "t": [16, 17, 18], "beats": false }
  ],
  "price": [
    { "cards": [48], "price": 1 },
    { "cards": [49], "price": 1 },
    { "cards": [50], "price": 2 },
    { "cards": [51], "price": 2 },
    { "cards": [49, 51], "price": 3 },
    { "cards": [0, 1, 4, 5, 8, 9], "price": 3 },
    { "cards": [20, 21, 22, 23], "price": 4 },
    { "cards": [0, 1, 4, 5, 8, 9, 12, 13], "price": 4 },
    { "cards": [44], "price": 0 },
    { "cards": [0, 4, 8], "price": 0 }
  ],
  "thoi": [
    { "hand": [], "thoi": 0 },
    { "hand": [48, 51, 30], "thoi": 3 },
    { "hand": [16, 17, 18, 19], "thoi": 4 },
    { "hand": [0, 1, 4, 5, 8, 9, 40], "thoi": 3 },
    { "hand": [0, 1, 4, 5, 8, 9, 12, 13], "thoi": 4 },
    { "hand": [0, 1, 4, 5, 8, 9, 20, 21, 24, 25, 28, 29], "thoi": 6 },
    { "hand": [40, 41, 44, 45, 48, 49], "thoi": 2 },
    { "hand": [0, 1, 4, 5], "thoi": 0 }
  ],
  "white": [
    { "hand": [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 51], "white": true },
    { "hand": [48, 49, 50, 51, 0, 5, 10, 15, 20, 25, 30, 35, 40], "white": true },
    { "hand": [0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 30, 35, 51], "white": true },
    { "hand": [0, 1, 8, 9, 16, 17, 24, 25, 32, 33, 48, 49, 40], "white": true },
    { "hand": [0, 1, 2, 3, 8, 9, 16, 17, 24, 25, 32, 33, 51], "white": true },
    { "hand": [0, 1, 4, 5, 8, 9, 12, 13, 20, 24, 30, 35, 51], "white": false },
    { "hand": [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 51], "white": false }
  ]
}
$tc$;
  v_tl CONSTANT jsonb := $tl$
[
  {
    "note": "2 người · sảnh mở ván, bỏ lượt, vòng mới, chặn lẻ, đôi, hết bài · người còn lại thối heo đỏ",
    "hands": [[0, 4, 9, 26, 27], [1, 12, 42, 44, 45, 51]],
    "steps": [
      { "seat": 1, "move": { "play": [1] }, "err": "games.err.notYourTurn" },
      { "seat": 0, "move": { "play": [4] }, "err": "games.err.mustLow" },
      { "seat": 0, "move": { "play": [0, 4] }, "err": "games.err.badCombo" },
      { "seat": 0, "move": { "play": [0, 4, 9] }, "err": null },
      { "seat": 1, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "pass": true }, "err": "games.err.mustLead" },
      { "seat": 0, "move": { "play": [26] }, "err": null },
      { "seat": 1, "move": { "play": [12] }, "err": "games.err.tooLow" },
      { "seat": 1, "move": { "play": [26] }, "err": "games.err.notYourCard" },
      { "seat": 1, "move": { "play": [43] }, "err": "games.err.notYourCard" },
      { "seat": 1, "move": { "play": [42] }, "err": null },
      { "seat": 0, "move": { "play": [27] }, "err": "games.err.tooLow" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [44, 45] }, "err": null },
      { "seat": 0, "move": { "play": [27, "5"] }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "foo": 1 }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "pass": "true" }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "play": [] }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [1, 12] }, "err": "games.err.badCombo" },
      { "seat": 1, "move": { "play": [12.0] }, "err": null },
      { "seat": 0, "move": { "play": [27] }, "err": null },
      { "seat": 1, "move": { "play": [51] }, "err": "games.err.over" }
    ],
    "result": { "winners": [0], "draw": false, "ranks": [0, 1], "scores": { "0": 3, "1": -3 } }
  },
  {
    "note": "2 người · 3 đôi thông chặt heo đỏ, 4 đôi thông chặt chồng, tứ quý không chặt được 4 đôi thông · thối tứ quý",
    "hands": [[0, 4, 5, 8, 9, 12, 13, 16, 17, 18, 19], [51, 32, 33, 36, 37, 40, 41, 44, 45, 30]],
    "steps": [
      { "seat": 0, "move": { "play": [0] }, "err": null },
      { "seat": 1, "move": { "play": [51] }, "err": null },
      { "seat": 0, "move": { "play": [16, 17, 18] }, "err": "games.err.tooLow" },
      { "seat": 0, "move": { "play": [4, 5, 8, 9, 12, 13] }, "err": null },
      { "seat": 1, "move": { "play": [32, 33, 36, 37, 40, 41, 44, 45] }, "err": null },
      { "seat": 0, "move": { "play": [16, 17, 18, 19] }, "err": "games.err.tooLow" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [30] }, "err": null }
    ],
    "result": { "winners": [1], "draw": false, "ranks": [1, 0], "scores": { "0": -10, "1": 10 } }
  },
  {
    "note": "3 người · tứ quý chặt heo đen, người tới lượt rời ván (server ghi out) về Bét, ghế đã rời không đi được",
    "hands": [[2, 49, 6], [20, 21, 22, 23, 7, 40], [3, 11, 15]],
    "steps": [
      { "seat": 0, "move": { "play": [2] }, "err": null },
      { "seat": 1, "move": { "play": [7] }, "err": null },
      { "seat": 2, "move": { "play": [11] }, "err": null },
      { "seat": 0, "move": { "play": [49] }, "err": null },
      { "seat": 1, "move": { "play": [20, 21, 22, 23] }, "err": null },
      { "seat": 2, "move": { "out": true }, "err": "games.err.badMove" },
      { "seat": 2, "move": { "out": true }, "log": true },
      { "seat": 2, "move": { "play": [15] }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [40] }, "err": null }
    ],
    "result": { "winners": [1], "draw": false, "ranks": [1, 0, 2], "scores": { "0": -1, "1": 3, "2": -2 } }
  },
  {
    "note": "3 người · người đang giữ bàn rời ván, cả bàn bỏ lượt → người kế sau ghế đã rời mở vòng mới",
    "hands": [[0, 24], [44, 8], [4, 28, 12]],
    "steps": [
      { "seat": 0, "move": { "play": [0] }, "err": null },
      { "seat": 1, "move": { "play": [44] }, "err": null },
      { "seat": 1, "move": { "out": true }, "log": true },
      { "seat": 2, "move": { "play": [28] }, "err": "games.err.tooLow" },
      { "seat": 2, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "play": [24] }, "err": "games.err.notYourTurn" },
      { "seat": 2, "move": { "play": [4] }, "err": null },
      { "seat": 0, "move": { "play": [24] }, "err": null }
    ],
    "result": { "winners": [0], "draw": false, "ranks": [0, 2, 1], "scores": { "0": 2, "1": -2, "2": 0 } }
  },
  {
    "note": "2 người · đôi heo, 3 đôi thông không chặt được đôi heo, tứ quý chặt được · chưa xong ván",
    "hands": [[0, 48, 49, 30], [4, 5, 8, 9, 12, 13, 24, 25, 26, 27, 33]],
    "steps": [
      { "seat": 0, "move": { "play": [0, 48] }, "err": "games.err.badCombo" },
      { "seat": 0, "move": { "play": [0] }, "err": null },
      { "seat": 1, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "play": [48, 49] }, "err": null },
      { "seat": 1, "move": { "play": [4, 5, 8, 9, 12, 13] }, "err": "games.err.tooLow" },
      { "seat": 1, "move": { "play": [24, 25, 26, 27] }, "err": null },
      { "seat": 0, "move": { "play": [30] }, "err": "games.err.tooLow" }
    ],
    "result": null
  },
  {
    "note": "3 người · về Nhất ngay nước đầu, hai người chưa đánh lá nào bị cóng (gấp đôi điểm Bét) · cóng vẫn bị thối",
    "hands": [[0, 1], [51, 20], [44, 45]],
    "steps": [
      { "seat": 0, "move": { "play": [0, 1] }, "err": null },
      { "seat": 1, "move": { "play": [51] }, "err": "games.err.over" }
    ],
    "result": { "winners": [0], "draw": false, "ranks": [0, 1, 2], "scores": { "0": 4, "1": -6, "2": -4 } }
  },
  {
    "note": "3 người · đã bỏ lượt vẫn chặt heo bằng 4 đôi thông ngoài lượt, rồi về Nhất · người về đích giữ bàn thì người kế mở vòng",
    "hands": [[0, 48, 30], [8, 12, 33], [20, 21, 24, 25, 28, 29, 32, 34, 40]],
    "steps": [
      { "seat": 0, "move": { "play": [0] }, "err": null },
      { "seat": 1, "move": { "play": [8] }, "err": null },
      { "seat": 2, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "play": [48] }, "err": null },
      { "seat": 2, "move": { "play": [20, 21, 24, 25, 28, 29] }, "err": "games.err.notYourTurn" },
      { "seat": 2, "move": { "play": [20, 21, 24, 25, 28, 29, 32, 34] }, "err": null },
      { "seat": 1, "move": { "play": [12] }, "err": "games.err.notYourTurn" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "pass": true }, "err": null },
      { "seat": 2, "move": { "play": [40] }, "err": null },
      { "seat": 0, "move": { "play": [30] }, "err": "games.err.tooLow" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [33] }, "err": "games.err.tooLow" },
      { "seat": 1, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "play": [30] }, "err": null }
    ],
    "result": { "winners": [2], "draw": false, "ranks": [2, 0, 1], "scores": { "0": -1, "1": -2, "2": 3 } }
  },
  {
    "note": "2 người · tới trắng tứ quý heo ngay khi chia: thắng luôn, không ai đi được",
    "hands": [[48, 49, 50, 51, 0], [1, 2]],
    "steps": [
      { "seat": 1, "move": { "play": [1] }, "err": "games.err.over" }
    ],
    "result": { "winners": [0], "draw": false, "ranks": [0, 1], "scores": { "0": 1, "1": -1 } }
  },
  {
    "note": "2 người · ván chơi lại: người về Nhất ván trước đi trước, không bắt lá nhỏ nhất · người kia chưa đánh lá nào nên cóng",
    "first": 1,
    "hands": [[0, 4], [8, 12]],
    "steps": [
      { "seat": 0, "move": { "play": [0] }, "err": "games.err.notYourTurn" },
      { "seat": 1, "move": { "play": [12] }, "err": null },
      { "seat": 0, "move": { "play": [4] }, "err": "games.err.tooLow" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 1, "move": { "play": [8] }, "err": null }
    ],
    "result": { "winners": [1], "draw": false, "ranks": [1, 0], "scores": { "0": -2, "1": 1 } }
  },
  {
    "note": "4 người · tứ quý chặt heo, tứ quý lớn chặt chồng rồi về Nhất, người chưa đánh lá nào cóng · xếp đủ 4 hạng",
    "hands": [[0, 16, 17, 18, 19, 44], [20, 21, 22, 23, 1], [48, 2], [3, 7]],
    "steps": [
      { "seat": 0, "move": { "play": [0] }, "err": null },
      { "seat": 1, "move": { "play": [1] }, "err": null },
      { "seat": 2, "move": { "play": [48] }, "err": null },
      { "seat": 3, "move": { "pass": true }, "err": null },
      { "seat": 0, "move": { "play": [16, 17, 18, 19] }, "err": null },
      { "seat": 1, "move": { "play": [20, 21, 22, 23] }, "err": null },
      { "seat": 2, "move": { "pass": true }, "err": null },
      { "seat": 3, "move": { "pass": true }, "err": "games.err.badMove" },
      { "seat": 0, "move": { "pass": true }, "err": null },
      { "seat": 2, "move": { "play": [2] }, "err": null }
    ],
    "result": { "winners": [1], "draw": false, "ranks": [1, 2, 0, 3], "scores": { "0": -6, "1": 8, "2": 1, "3": -6 } }
  }
]
$tl$;
BEGIN
  /* ---------- 1. Có đủ hàm, client không gọi thẳng được hàm luật ---------- */
  IF to_regclass('public.game_hands') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có bảng game_hands — đã chạy 0078 chưa?';
  END IF;
  IF to_regprocedure('public.game_tienlen_result(uuid)') IS NULL OR to_regprocedure('public.game_tienlen_check(uuid, integer, jsonb)') IS NULL
     OR to_regprocedure('public.game_tienlen_deal(uuid)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu hàm game_tienlen_* — đã chạy 0078 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_tienlen_run(uuid, integer, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_tienlen_deal(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_tienlen_result(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client gọi thẳng được hàm luật / chia bài';
  END IF;
  IF has_table_privilege('authenticated', 'public.game_hands', 'INSERT') OR has_table_privilege('authenticated', 'public.game_hands', 'UPDATE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client ghi thẳng được game_hands';
  END IF;

  /* ---------- 2. Kiểu bộ, chặn, giá chặt, thối, tới trắng: SQL ra đúng như JS ---------- */
  FOR v_st IN SELECT value FROM jsonb_array_elements(v_tc -> 'combo') LOOP
    v_got := game_tienlen_combo(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 'cards') e));
    v_want := NULLIF(v_st -> 'combo', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: bộ % — SQL ra %, JS ra %', v_st -> 'cards', v_got, v_want;
    END IF;
  END LOOP;
  FOR v_st IN SELECT value FROM jsonb_array_elements(v_tc -> 'beats') LOOP
    IF game_tienlen_beats(
         game_tienlen_combo(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 'a') e)),
         CASE WHEN v_st -> 't' = 'null'::jsonb THEN NULL
              ELSE game_tienlen_combo(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 't') e)) END
       ) IS DISTINCT FROM (v_st ->> 'beats')::boolean THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: % chặn % — SQL khác JS (JS: %)', v_st -> 'a', v_st -> 't', v_st -> 'beats';
    END IF;
  END LOOP;
  FOR v_st IN SELECT value FROM jsonb_array_elements(v_tc -> 'price') LOOP
    IF game_tienlen_price(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 'cards') e)) IS DISTINCT FROM (v_st ->> 'price')::int THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: giá chặt % khác JS (JS: %)', v_st -> 'cards', v_st -> 'price';
    END IF;
  END LOOP;
  FOR v_st IN SELECT value FROM jsonb_array_elements(v_tc -> 'thoi') LOOP
    IF game_tienlen_thoi(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 'hand') e)) IS DISTINCT FROM (v_st ->> 'thoi')::int THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: thối % khác JS (JS: %)', v_st -> 'hand', v_st -> 'thoi';
    END IF;
  END LOOP;
  FOR v_st IN SELECT value FROM jsonb_array_elements(v_tc -> 'white') LOOP
    IF game_tienlen_white(ARRAY(SELECT e::int FROM jsonb_array_elements_text(v_st -> 'hand') e)) IS DISTINCT FROM (v_st ->> 'white')::boolean THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2: tới trắng % khác JS (JS: %)', v_st -> 'hand', v_st -> 'white';
    END IF;
  END LOOP;

  /* ---------- 3. Tìm hai thành viên cùng CLB ---------- */
  SELECT a.club_id, a.user_id, b.user_id, a.id INTO v_club, v_u1, v_u2, v_m1
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);

  /* ---------- 4. Bắt đầu ván thật: chia đúng 13 lá mỗi người, không trùng lá, ghi nước deal ---------- */
  v_room := game_create(v_club, 'tienlen', '{}'::jsonb, false);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 4);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 4);

  SELECT count(*) INTO v_rows FROM game_hands WHERE room_id = v_room AND cardinality(cards) = 13;
  IF v_rows <> 2 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: phải chia 2 tay × 13 lá, thấy % tay đủ 13 lá', v_rows; END IF;
  SELECT count(DISTINCT x) INTO v_rows FROM game_hands h, unnest(h.cards) x WHERE h.room_id = v_room;
  IF v_rows <> 26 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: hai tay có lá trùng nhau (% lá khác nhau / 26)', v_rows; END IF;
  SELECT move INTO v_got FROM game_moves WHERE room_id = v_room AND seq = 1;
  IF v_got -> 'deal' IS NULL OR v_got #> '{deal,n}' <> '[13, 13]'::jsonb
     OR (v_got #>> '{deal,low}')::int <> (SELECT min(x) FROM game_hands h, unnest(h.cards) x WHERE h.room_id = v_room)
     OR NOT EXISTS (SELECT 1 FROM game_hands WHERE room_id = v_room AND seat = (v_got #>> '{deal,first}')::int AND (v_got #>> '{deal,low}')::int = ANY(cards))
     OR (v_got #>> '{deal,white}')::int IS DISTINCT FROM
        (SELECT seat FROM game_hands WHERE room_id = v_room AND game_tienlen_white(cards) ORDER BY seat LIMIT 1) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: nước deal sai: %', v_got;
  END IF;

  /* ---------- 5. RLS: đang chơi thì mỗi người chỉ đọc được tay mình ---------- */
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_rows FROM game_hands WHERE room_id = v_room;
  EXECUTE 'RESET ROLE';
  IF v_rows <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 5: người chơi đọc được % tay (phải đúng 1 — tay của mình)', v_rows; END IF;

  /* ---------- 6. game_move từ chối nước sai (không ghi), nhận nước đúng ---------- */
  -- Ván vừa chia mà có người tới trắng thì đã xong — bỏ qua bước này (hiếm, chạy lại file là được).
  IF v_got #> '{deal,white}' = 'null'::jsonb THEN
    v_k := (v_got #>> '{deal,first}')::int;
    v_rows := (v_got #>> '{deal,low}')::int;
    -- u1 ngồi ghế 0, u2 ghế 1 sau khi đánh số lại: đổi phiên đăng nhập sang người đi trước.
    IF v_k = 1 THEN
      PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
    END IF;
    BEGIN
      PERFORM game_move(v_room, 2, jsonb_build_object('play', jsonb_build_array((SELECT x FROM game_hands h, unnest(h.cards) x
         WHERE h.room_id = v_room AND h.seat = 1 - v_k LIMIT 1))));
      RAISE EXCEPTION 'SAI Ở BƯỚC 6: đánh được lá của người khác';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err <> 'games.err.notYourCard' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM game_move(v_room, 2, '{"out": true}'::jsonb);
      RAISE EXCEPTION 'SAI Ở BƯỚC 6: client tự ghi được nước out';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err <> 'games.err.badMove' THEN RAISE; END IF;
    END;
    IF (SELECT count(*) FROM game_moves WHERE room_id = v_room) <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: nước bị từ chối vẫn vào log'; END IF;
    PERFORM game_move(v_room, 2, jsonb_build_object('play', jsonb_build_array(v_rows)));
    IF (SELECT count(*) FROM game_moves WHERE room_id = v_room) <> 2 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: nước đúng không vào log'; END IF;
  END IF;

  /* ---------- 7. Từng ván mẫu: mã lỗi từng nước + kết quả SQL ra đúng như JS ---------- */
  FOR v_fx IN SELECT value FROM jsonb_array_elements(v_tl) LOOP
    v_n := v_n + 1;
    DELETE FROM game_moves WHERE room_id = v_room;
    DELETE FROM game_hands WHERE room_id = v_room;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    SELECT v_room, (h.ord - 1)::smallint, v_m1, v_club, ARRAY(SELECT e::int FROM jsonb_array_elements_text(h.value) e)
      FROM jsonb_array_elements(v_fx -> 'hands') WITH ORDINALITY AS h(value, ord);
    -- Nước deal dựng y như game_tienlen_deal: `first` của ván chơi lại, không thì ai cầm lá nhỏ nhất đi trước.
    v_first := (v_fx ->> 'first')::int;
    v_low := NULL;
    IF v_first IS NULL THEN
      SELECT h.seat, q.lo INTO v_first, v_low
        FROM game_hands h CROSS JOIN LATERAL (SELECT min(x) AS lo FROM unnest(h.cards) x) q
       WHERE h.room_id = v_room ORDER BY q.lo LIMIT 1;
    END IF;
    SELECT seat INTO v_white FROM game_hands WHERE room_id = v_room AND game_tienlen_white(cards) ORDER BY seat LIMIT 1;
    IF NOT FOUND THEN v_white := NULL; END IF;
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    VALUES (v_room, 1, v_club, v_first, jsonb_build_object('deal', jsonb_build_object('first', v_first, 'low', v_low,
             'n', (SELECT jsonb_agg(jsonb_array_length(value) ORDER BY ord) FROM jsonb_array_elements(v_fx -> 'hands') WITH ORDINALITY AS t(value, ord)),
             'white', v_white)));
    v_seq := 1;
    v_k := 0;
    FOR v_st IN SELECT value FROM jsonb_array_elements(v_fx -> 'steps') LOOP
      v_k := v_k + 1;
      IF (v_st ->> 'log')::boolean IS TRUE THEN
        v_e := NULL;
      ELSE
        v_e := game_tienlen_check(v_room, (v_st ->> 'seat')::int, v_st -> 'move');
        IF v_e IS DISTINCT FROM (v_st ->> 'err') THEN
          RAISE EXCEPTION 'SAI Ở BƯỚC 7: ván mẫu % (%), nước % % — SQL trả %, phải là %',
            v_n, v_fx ->> 'note', v_k, v_st -> 'move', COALESCE(v_e, 'hợp lệ'), COALESCE(v_st ->> 'err', 'hợp lệ');
        END IF;
      END IF;
      IF v_e IS NULL THEN
        v_seq := v_seq + 1;
        INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, v_seq, v_club, (v_st ->> 'seat')::smallint, v_st -> 'move');
      END IF;
    END LOOP;
    v_got := game_tienlen_result(v_room);
    v_want := NULLIF(v_fx -> 'result', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 7: ván mẫu % (%) — SQL chấm %, JS chấm %', v_n, v_fx ->> 'note', v_got, v_want;
    END IF;
  END LOOP;

  /* ---------- 8. game_finish dùng kết quả server, bỏ kết quả client bịa ---------- */
  -- Ván mẫu cuối cùng ở bước 7 là ván 4 người đã xong → dựng lại ván mẫu 5 (chưa xong) để thử notOver.
  v_fx := v_tl -> 4;
  DELETE FROM game_moves WHERE room_id = v_room;
  DELETE FROM game_hands WHERE room_id = v_room;
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
  SELECT v_room, (h.ord - 1)::smallint, v_m1, v_club, ARRAY(SELECT e::int FROM jsonb_array_elements_text(h.value) e)
    FROM jsonb_array_elements(v_fx -> 'hands') WITH ORDINALITY AS h(value, ord);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, 1, v_club, 0, '{"deal": {"first": 0, "low": 0, "n": [4, 11], "white": null}}');
  BEGIN
    PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: ván chưa xong mà kết thúc được';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notOver' THEN RAISE; END IF;
  END;
  -- Ván mẫu 1 (ghế 0 về Nhất) rồi báo bịa "ghế 1 thắng".
  v_fx := v_tl -> 0;
  DELETE FROM game_moves WHERE room_id = v_room;
  DELETE FROM game_hands WHERE room_id = v_room;
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
  SELECT v_room, (h.ord - 1)::smallint, v_m1, v_club, ARRAY(SELECT e::int FROM jsonb_array_elements_text(h.value) e)
    FROM jsonb_array_elements(v_fx -> 'hands') WITH ORDINALITY AS h(value, ord);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (v_room, 1, v_club, 0, '{"deal": {"first": 0, "low": 0, "n": [5, 6], "white": null}}');
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  SELECT v_room, 1 + row_number() OVER (ORDER BY s.ord), v_club, (s.value ->> 'seat')::smallint, s.value -> 'move'
    FROM jsonb_array_elements(v_fx -> 'steps') WITH ORDINALITY AS s(value, ord)
   WHERE s.value -> 'err' = 'null'::jsonb;
  PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
  SELECT result INTO v_got FROM game_rooms WHERE id = v_room;
  IF v_got IS DISTINCT FROM v_fx -> 'result' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: game_finish lưu % thay vì kết quả server chấm %', v_got, v_fx -> 'result';
  END IF;

  /* ---------- 9. Hết ván: cả CLB đọc được mọi tay để lật bài ---------- */
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_rows FROM game_hands WHERE room_id = v_room;
  EXECUTE 'RESET ROLE';
  IF v_rows <> 2 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 9: hết ván mà chỉ đọc được % tay (phải 2)', v_rows; END IF;

  RAISE EXCEPTION '0078 CHECK OK — % ván mẫu, % bộ, % cặp chặn, giá chặt / thối / tới trắng khớp JS; chia bài, RLS, game_move, game_finish đạt. (Lỗi này cố ý để huỷ dữ liệu thử.)',
    v_n, jsonb_array_length(v_tc -> 'combo'), jsonb_array_length(v_tc -> 'beats');
END;
$check$;

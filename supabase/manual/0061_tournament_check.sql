-- 0061_tournament_check.sql — kiểm migration 0061 (ghi kết quả tự do về điểm) TRÊN DB THẬT. Không ghi dữ liệu nào.
--
-- CÁCH CHẠY: áp 0061_tournament_free_scores.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--   ✅ "0061 CHECK OK — ..."  → mọi ca đúng (script cố ý kết thúc bằng lỗi).
--   ❌ "SAI Ở CA ..."          → dán nguyên thông báo cho người viết migration.
-- Bộ ca này PHẢI khớp `src/__tests__/tournament/free_result.test.js` (cùng quy tắc với scoring.js#inspectResult).

DO $check$
DECLARE
  r1x30 jsonb := '{"sets":1,"points":30,"winBy2":false,"cap":30}';
  r3x21 jsonb := '{"sets":3,"points":21,"winBy2":true,"cap":30}';
  c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    -- tên ca                                 sets                              luật   winner status      mong đợi
    ('22-20 luật chạm 30 (đánh ngắn)',        '[[22,20]]'::jsonb,               r1x30, 'A',  'done',     true),
    ('11-9 set 3 ở luật 21',                  '[[15,21],[21,15],[11,9]]',       r3x21, 'A',  'done',     true),
    ('set hoà',                                '[[20,20]]',                      r1x30, 'A',  'done',     false),
    ('winner ngược điểm',                     '[[22,20]]',                      r1x30, 'B',  'done',     false),
    ('thừa set sau 2-0',                      '[[21,15],[21,10],[21,3]]',       r3x21, 'A',  'done',     false),
    ('chưa đủ set thắng',                     '[[21,15],[15,21]]',              r3x21, 'A',  'done',     false),
    ('quá số set của luật',                   '[[21,15],[21,10]]',              r1x30, 'A',  'done',     false),
    ('điểm 100 (gõ nhầm)',                    '[[100,5]]',                      r1x30, 'A',  'done',     false),
    ('điểm âm',                               '[[-1,5]]',                       r1x30, 'B',  'done',     false),
    ('không có set',                          '[]',                             r1x30, 'A',  'done',     false),
    ('xử thua không set',                     '[]',                             r1x30, 'A',  'walkover', true),
    ('xử thua mà có set',                     '[[3,1]]',                        r1x30, 'A',  'walkover', false),
    ('bỏ cuộc lúc đang hoà',                  '[[9,9]]',                        r1x30, 'A',  'retired',  true),
    ('bỏ cuộc 40-7 (điểm tự do)',             '[[40,7]]',                       r1x30, 'A',  'retired',  true),
    ('bỏ cuộc điểm 120',                      '[[120,7]]',                      r1x30, 'A',  'retired',  false)
  ) AS t(name, sets, rule, winner, status, expected)
  LOOP
    IF tournament_valid_sets(c.sets, c.rule, c.winner, c.status) IS DISTINCT FROM c.expected THEN
      RAISE EXCEPTION 'SAI Ở CA "%": mong đợi %, nhận %', c.name, c.expected, tournament_valid_sets(c.sets, c.rule, c.winner, c.status);
    END IF;
  END LOOP;

  RAISE EXCEPTION '0061 CHECK OK — 15/15 ca ghi kết quả tự do đúng';
END $check$;

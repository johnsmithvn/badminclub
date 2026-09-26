-- 0061_tournament_free_scores.sql — Module Giải đấu: ghi kết quả TỰ DO về điểm (quyết định D11, plan §1.1).
--
-- Trước: `tournament_valid_sets` bắt mọi set đúng luật điểm của trận (chạm 30, cách 2, trần) → đánh ngắn / dừng theo
-- giờ (vd. 22–20 ở luật chạm 30) không ghi được. Nay SỐ SET quyết định, điểm từng set tự do:
--   done:     1..sets set; mỗi set là 2 số nguyên 0..99, KHÔNG hoà (phải có bên cao hơn); không thừa set sau khi đã
--             đủ ceil(sets/2) set thắng; `p_winner` = bên đủ số set thắng.
--   walkover: không có set.
--   retired:  0..sets set, mỗi set 2 số nguyên 0..99 (set dở dang, kể cả đang hoà, được).
-- Luật điểm vẫn chép trong trận — chỉ để bảng ghi điểm từng quả tự chuyển set và ước tính giờ; không chặn ghi.
-- Hàm dùng chung cho `tournament_commit_match` và `tournament_edit_match` (0057) — hai RPC đó không phải sửa.
-- `tournament_set_state` (luật điểm) giữ nguyên, không còn ai gọi từ đây.
-- Cùng quy tắc với `src/lib/tournament/scoring.js#inspectResult` — bộ ca kiểm chung: supabase/manual/0061_tournament_check.sql.
-- Không đụng Elo / điểm mùa (D1) → không backtest.

BEGIN;

CREATE OR REPLACE FUNCTION public.tournament_valid_sets(p_sets jsonb, p_rule jsonb, p_winner text, p_status text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_max int; v_need int; v_len int;
  v_wa int := 0; v_wb int := 0;
  v_set jsonb; v_a int; v_b int;
  i int;
BEGIN
  IF p_winner IS NULL OR p_winner NOT IN ('A','B') OR jsonb_typeof(p_sets) IS DISTINCT FROM 'array'
     OR (p_rule->>'sets') IS NULL OR (p_rule->>'sets') NOT IN ('1','3','5') THEN
    RETURN false;
  END IF;
  v_max := (p_rule->>'sets')::int;
  v_need := (v_max + 1) / 2;
  v_len := jsonb_array_length(p_sets);

  IF p_status = 'walkover' THEN
    RETURN v_len = 0;
  END IF;
  IF v_len > v_max THEN
    RETURN false;
  END IF;

  -- Mỗi set: đúng 2 số nguyên 0..99 (≤ 2 chữ số: chặn gõ nhầm, khỏi tràn int).
  FOR i IN 0 .. v_len - 1 LOOP
    v_set := p_sets->i;
    IF jsonb_typeof(v_set) IS DISTINCT FROM 'array' OR jsonb_array_length(v_set) <> 2
       OR jsonb_typeof(v_set->0) IS DISTINCT FROM 'number' OR jsonb_typeof(v_set->1) IS DISTINCT FROM 'number'
       OR (v_set->>0) !~ '^[0-9]{1,2}$' OR (v_set->>1) !~ '^[0-9]{1,2}$' THEN
      RETURN false;
    END IF;
  END LOOP;

  IF p_status = 'retired' THEN
    RETURN true;
  END IF;
  IF p_status <> 'done' OR v_len = 0 THEN
    RETURN false;
  END IF;

  FOR i IN 0 .. v_len - 1 LOOP
    IF v_wa >= v_need OR v_wb >= v_need THEN RETURN false; END IF;   -- thừa set
    v_a := (p_sets->i->>0)::int;
    v_b := (p_sets->i->>1)::int;
    IF v_a = v_b THEN RETURN false; END IF;                          -- set hoà: không biết ai thắng
    IF v_a > v_b THEN v_wa := v_wa + 1; ELSE v_wb := v_wb + 1; END IF;
  END LOOP;

  RETURN (p_winner = 'A' AND v_wa >= v_need) OR (p_winner = 'B' AND v_wb >= v_need);
END;
$$;

REVOKE ALL ON FUNCTION public.tournament_valid_sets(jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;

COMMIT;

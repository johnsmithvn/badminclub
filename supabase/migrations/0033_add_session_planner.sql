-- Migration 0033: Bổ sung cột planner jsonb lưu cấu trúc kế hoạch buổi chơi (Session Planner)
-- Chứa danh sách các vòng đấu (rounds), nguyện vọng (wishes), thời lượng mỗi vòng (roundMinutes)

BEGIN;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS planner jsonb;

COMMENT ON COLUMN public.sessions.planner IS
  'Cấu trúc kế hoạch buổi chơi do host xếp trước (rounds, wishes, roundMinutes...). NULL = chưa lập kế hoạch riêng.';

COMMIT;

NOTIFY pgrst, 'reload schema';

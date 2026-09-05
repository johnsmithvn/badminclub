-- Migration 0025: Bổ sung nhãn số sân (court_label) cho từng dòng sân trong buổi tập và lịch tập
-- Ví dụ: 'Sân 19', 'Sân 20' tại cơ sở 'Tổ hợp sân cầu lông An Bình'

BEGIN;

ALTER TABLE public.session_courts ADD COLUMN IF NOT EXISTS court_label text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS court_label text;

COMMENT ON COLUMN public.session_courts.court_label IS
  'Nhãn hoặc số sân cụ thể của buổi tập (ví dụ: Sân 19, Sân 1...). NULL = không đặt nhãn riêng.';
COMMENT ON COLUMN public.schedule_slots.court_label IS
  'Nhãn hoặc số sân cụ thể của lịch tập cố định. NULL = không đặt nhãn riêng.';

COMMIT;

NOTIFY pgrst, 'reload schema';

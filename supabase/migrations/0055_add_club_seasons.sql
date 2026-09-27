-- Migration 0055: Thêm cột `seasons` vào bảng `clubs` để lưu trữ danh sách các mùa giải (gồm mùa active và các mùa lưu trữ)

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS seasons jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clubs.seasons IS
  'Danh sách các mùa giải của CLB. Mỗi mùa gồm: id, code, name, fullName, startDate, endDate, active, cycle, totalSessionsExpected, minMatchesOfficial, inactiveDays, closedAt, podiumSnapshot.';

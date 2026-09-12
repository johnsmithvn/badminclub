-- 0027_badges_and_shelf.sql
-- Thêm trường kệ 3 huy hiệu (badge_shelf) và châm ngôn thành viên (signature) vào club_members
-- phục vụ hệ thống Danh hiệu & Treo thưởng Anime (Hybrid computed architecture).

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS badge_shelf jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature text DEFAULT '';

COMMENT ON COLUMN public.club_members.badge_shelf IS 'Danh sách id tối đa 3 huy hiệu được ghim lên Kệ trưng bày cá nhân';
COMMENT ON COLUMN public.club_members.signature IS 'Châm ngôn / câu nói flex phong cách cá nhân của thành viên';
